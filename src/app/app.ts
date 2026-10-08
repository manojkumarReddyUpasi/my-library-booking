import { Component, inject, signal, ViewEncapsulation } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { RouterOutlet } from '@angular/router';
import { AdminConsoleComponent } from './components/admin-console/admin-console';
import { BooksComponent } from './components/books/books';
import { BookReserve, ReserveRequest } from './components/book-reserve/book-reserve';
import { ReservationsComponent } from './components/reservations/reservations';
import { SideNavComponent } from './components/side-nav/side-nav';
import { TopNavComponent } from './components/top-nav/top-nav';
import { Users } from './components/users/users';
import { Book, availableCopies } from './models/book.model';
import { LibraryView } from './models/library-view.model';
import { Reservation, countReservedUsers } from './models/reservation.model';
import { ReservationService } from './services/reservation.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    AdminConsoleComponent,
    BooksComponent,
    BookReserve,
    ReservationsComponent,
    Users,
    SideNavComponent,
    TopNavComponent,
  ],
  styleUrl: './app.css',
  templateUrl: './app.html',
  encapsulation: ViewEncapsulation.None,
})
export class App {
  protected readonly views = LibraryView;
  protected readonly view = signal<LibraryView>(LibraryView.Catalog);
  protected readonly reservations = signal<Reservation[]>([]);
  private readonly reservationService = inject(ReservationService);

  constructor() {
    this.reservationService.getReservations().subscribe({
      next: (items) => this.reservations.set(items),
      error: (error) =>
        this.showToast(this.apiMessage(error, 'Unable to load reservations.'), 'error'),
    });
  }

  private apiMessage(error: HttpErrorResponse, fallback: string): string {
    const body = error.error as { message?: string; error?: string } | null;
    return body?.message || body?.error || fallback;
  }
  protected readonly toast = signal('');
  protected readonly toastType = signal<'success' | 'error'>('success');
  protected readonly toastCentered = signal(false);
  protected readonly toastBook = signal<Book | null>(null);
  private toastTimer?: ReturnType<typeof setTimeout>;

  protected setView(view: LibraryView) {
    this.view.set(view);
  }
  protected reservedUsers(book: Book): number {
    return countReservedUsers(this.reservations(), book.title);
  }
  protected copiesLeft(book: Book): number {
    return availableCopies(book, this.reservations());
  }
  protected reserveBook(book: Book, request?: ReserveRequest) {
    if (!request) return;
    forkJoin(
      request.users.map((user) =>
        this.reservationService.createReservation({
          userId: user.id,
          bookId: book.id,
          issueDate: request.issueDate,
          dueDate: request.dueDate,
          returnDate: request.returnDate,
        }),
      ),
    ).subscribe({
      next: (created) => {
        this.reservations.update((items) => [...created, ...items]);
        const names = request.users.map((user) => user.name).join(', ');
        this.showToast(`${book.title} is reserved for ${names}.`, 'success');
      },
      error: (error) =>
        this.showToast(this.apiMessage(error, 'Unable to reserve this book.'), 'error'),
    });
  }
  protected updateReservation(updated: Reservation) {
    this.reservationService.updateReservation(updated).subscribe({
      next: (result) => {
        this.reservations.update((items) =>
          items.map((item) => (item.id === result.id ? result : item)),
        );
        this.showToast(`Reservation for ${result.borrower} was updated.`, 'success');
      },
      error: (error) =>
        this.showToast(this.apiMessage(error, 'Unable to update this reservation.'), 'error'),
    });
  }
  protected showToast(
    message: string,
    type: 'success' | 'error' = 'success',
    centered = false,
    book: Book | null = null,
  ) {
    this.toastType.set(type);
    this.toastCentered.set(centered);
    this.toastBook.set(book);
    this.toast.set(message);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.closeToast(), 60_000);
  }
  protected closeToast() {
    this.toast.set('');
    this.toastCentered.set(false);
    this.toastBook.set(null);
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
      this.toastTimer = undefined;
    }
  }
  protected toggleAvailability(book: Book) {
    book.available = !book.available;
  }
}
