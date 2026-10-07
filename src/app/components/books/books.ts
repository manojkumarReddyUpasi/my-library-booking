import { Component, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, of } from 'rxjs';
import { AddBookComponent, NewBookDetails } from './add-book/add-book';
import { EditBookComponent } from './edit-book/edit-book';
import { Book, availableCopies } from '../../models/book.model';
import { Reservation, countReservedUsers } from '../../models/reservation.model';
import { BooksService } from '../../services/books.service';

@Component({
  selector: 'app-books',
  standalone: true,
  imports: [AddBookComponent, EditBookComponent],
  templateUrl: './books.html',
})
export class BooksComponent {
  private readonly booksService = inject(BooksService);
  @Input() reservations: Reservation[] = [];
  @Output() bookReserved = new EventEmitter<Book>();
  @Output() toastMessage = new EventEmitter<{
    message: string;
    type: 'success' | 'error';
    centered?: boolean;
    book?: Book;
  }>();
  protected readonly search = signal('');
  protected readonly selectedCategory = signal('All books');
  protected readonly addingBook = signal(false);
  protected readonly editingBook = signal<Book | null>(null);
  protected readonly pendingDelete = signal<Book | null>(null);
  protected readonly books = signal<Book[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly filteredBooks = computed(() => {
    const term = this.search().toLowerCase().trim();
    const category = this.selectedCategory();
    return this.books().filter(
      (book) =>
        (!term || `${book.title} ${book.author} ${book.category}`.toLowerCase().includes(term)) &&
        (category === 'All books' || book.category === category),
    );
  });

  constructor() {
    this.booksService
      .getBooks()
      .pipe(
        catchError(() => {
          this.error.set('Unable to load books. Please check that the backend is running.');
          this.toastMessage.emit({ message: this.error(), type: 'error' });
          return of([]);
        }),
      )
      .subscribe((books) => {
        this.books.set(books);
        this.loading.set(false);
      });
  }

  protected setSearch(event: Event) {
    this.search.set((event.target as HTMLInputElement).value);
  }
  protected reservedUsers(book: Book): number {
    return countReservedUsers(this.reservations, book.title);
  }
  protected copiesLeft(book: Book): number {
    return availableCopies(book, this.reservations);
  }
  protected openBook(book: Book) {
    this.toastMessage.emit({
      message: `${book.title} by ${book.author}`,
      type: 'success',
      book,
    });
  }
  protected openAddBook() {
    this.addingBook.set(true);
  }
  protected closeAddBook() {
    this.addingBook.set(false);
  }
  protected openEditBook(book: Book, event: Event) {
    event.stopPropagation();
    this.editingBook.set(book);
  }
  protected closeEditBook() {
    this.editingBook.set(null);
  }
  protected addBook(details: NewBookDetails) {
    this.booksService
      .insertBook(details)
      .pipe(
        catchError((error: HttpErrorResponse) => {
          const apiError = error.error as { message?: string; error?: string } | null;
          const message =
            apiError?.message ||
            apiError?.error ||
            error.message ||
            'Unable to add this book. Please try again.';
          this.error.set(message);
          this.toastMessage.emit({ message, type: 'error' });
          return of(null);
        }),
      )
      .subscribe((book) => {
        if (!book) return;
        this.books.update((books) => [
          ...books,
          {
            ...book,
            available: book.available ?? true,
            accent: book.accent || 'coral',
          },
        ]);
        this.error.set('');
        this.toastMessage.emit({
          message: `${book.title} was added to the collection.`,
          type: 'success',
        });
        this.closeAddBook();
      });
  }
  protected updateBook(book: Book) {
    this.booksService
      .updateBook(book)
      .pipe(
        catchError((error: HttpErrorResponse) => {
          const apiError = error.error as { message?: string; error?: string } | null;
          const message =
            apiError?.message || apiError?.error || error.message || 'Unable to update this book.';
          this.toastMessage.emit({ message, type: 'error' });
          return of(undefined);
        }),
      )
      .subscribe((response) => {
        if (response === undefined) return;
        const updatedBook: Book = { ...(response ?? {}), ...book };
        this.books.update((books) =>
          books.map((item) => (item.id === updatedBook.id ? updatedBook : item)),
        );
        this.toastMessage.emit({ message: `${updatedBook.title} was updated.`, type: 'success' });
        this.closeEditBook();
      });
  }
  protected requestDelete(book: Book, event: Event) {
    event.stopPropagation();
    this.pendingDelete.set(book);
  }

  protected cancelDelete() {
    this.pendingDelete.set(null);
  }

  protected confirmDelete() {
    const book = this.pendingDelete();
    if (!book) return;
    this.pendingDelete.set(null);

    this.booksService
      .deleteBook(book.id)
      .pipe(
        catchError((error: HttpErrorResponse) => {
          if (error.status === 404) {
            this.books.update((books) => books.filter((item) => item.id !== book.id));
            this.toastMessage.emit({
              message: `${book.title} was already removed from the backend.`,
              type: 'success',
              centered: true,
            });
            return of('already-removed' as const);
          }
          const apiError = error.error as { message?: string; error?: string } | null;
          const message =
            apiError?.message || apiError?.error || error.message || 'Unable to delete this book.';
          this.toastMessage.emit({ message, type: 'error', centered: true });
          return of(null);
        }),
      )
      .subscribe((result) => {
        if (result === null || result === 'already-removed') return;
        this.books.update((books) => books.filter((item) => item.id !== book.id));
        this.toastMessage.emit({
          message: `${book.title} was deleted.`,
          type: 'success',
          centered: true,
        });
      });
  }
  protected reserveBook(book: Book) {
    if (!book.available) return;
    book.available = false;
    this.bookReserved.emit(book);
  }
}
