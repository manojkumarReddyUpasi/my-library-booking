import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, Observable, shareReplay, tap, throwError } from 'rxjs';
import { Book } from '../models/book.model';
import type { NewBookDetails } from '../components/books/add-book/add-book';

@Injectable({ providedIn: 'root' })
export class BooksService {
  private readonly http = inject(HttpClient);
  private readonly booksUrl = '/backend/books';
  private booksCache?: Observable<Book[]>;

  getBooks(): Observable<Book[]> {
    if (!this.booksCache) {
      this.booksCache = this.http.get<Book[]>(this.booksUrl).pipe(
        catchError((error: unknown) => {
          this.booksCache = undefined;
          return throwError(() => error);
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    }
    return this.booksCache;
  }

  insertBook(book: NewBookDetails): Observable<Book> {
    return this.http.post<Book>(this.booksUrl, book).pipe(tap(() => this.invalidateBooks()));
  }

  updateBook(book: Book): Observable<Book> {
    return this.http
      .put<Book>(`${this.booksUrl}/${book.id}`, book)
      .pipe(tap(() => this.invalidateBooks()));
  }

  deleteBook(id: number): Observable<void> {
    return this.http.delete<void>(`${this.booksUrl}/${id}`).pipe(tap(() => this.invalidateBooks()));
  }

  private invalidateBooks(): void {
    this.booksCache = undefined;
  }
}
