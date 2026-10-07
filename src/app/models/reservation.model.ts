export interface Reservation {
  id: string;
  userId?: number;
  bookId?: number;
  title: string;
  borrower: string;
  issueDate: string;
  dueDate: string;
  returnDate?: string;
  status: 'Active' | 'Returned';
}

export function countReservedUsers(reservations: Reservation[], bookTitle: string): number {
  const title = bookTitle.trim().toLowerCase();
  return new Set(
    reservations
      .filter((reservation) => reservation.title.trim().toLowerCase() === title)
      .map((reservation) => reservation.borrower),
  ).size;
}
