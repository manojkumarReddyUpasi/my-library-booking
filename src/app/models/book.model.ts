import type { Reservation } from './reservation.model';

export interface Book {
  id: number;
  title: string;
  author: string;
  category: string;
  isbn: string;
  available: boolean;
  accent: string;
  bookCount?: number;
  active?: boolean;
}

export function availableCopies(book: Book, reservations: Reservation[]): number {
  if (!book.available) return 0;
  const title = book.title.trim().toLowerCase();
  const active = reservations.filter(
    (reservation) =>
      reservation.status === 'Active' && reservation.title.trim().toLowerCase() === title,
  ).length;
  return Math.max(0, (book.bookCount ?? 1) - active);
}
