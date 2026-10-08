import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { Reservation } from '../models/reservation.model';

interface ReservationDto {
  userId: number;
  bookId: number;
  issueDate: string;
  dueDate: string;
  returnDate: string | null;
  status: 'ACTIVE' | 'RETURNED';
}

// Shape returned by the backend Reservation entity.
interface ReservationEntity {
  id: number;
  user: { id: number; name: string };
  book: { id: number; title: string };
  issueDate: string;
  returnDate: string | null;
  dueDate: string | null;
  status: 'ACTIVE' | 'RETURNED';
}

export interface NewReservation {
  userId: number;
  bookId: number;
  issueDate: string;
  dueDate: string;
  returnDate: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "2026-10-06" -> "06 Oct 2026"
function display(iso: string | null | undefined): string {
  if (!iso) return '';
  const [year, month, day] = iso.split('-');
  return `${day} ${MONTHS[Number(month) - 1]} ${year}`;
}

// "06 Oct 2026" -> "2026-10-06"
function toIso(value: string | undefined): string | null {
  const match = value?.match(/^(\d{2}) (\w{3}) (\d{4})$/);
  if (!match) return null;
  return `${match[3]}-${String(MONTHS.indexOf(match[2]) + 1).padStart(2, '0')}-${match[1]}`;
}

// The due date is stored separately from the actual return date.
function toReservation(entity: ReservationEntity): Reservation {
  const returned = entity.status === 'RETURNED';
  return {
    id: String(entity.id),
    userId: entity.user.id,
    bookId: entity.book.id,
    title: entity.book.title,
    borrower: entity.user.name,
    issueDate: display(entity.issueDate),
    dueDate: display(entity.dueDate),
    ...(entity.returnDate ? { returnDate: display(entity.returnDate) } : {}),
    status: returned ? 'Returned' : 'Active',
  };
}

@Injectable({ providedIn: 'root' })
export class ReservationService {
  private readonly http = inject(HttpClient);
  private readonly reservationsUrl = 'http://localhost:8081/reservations';

  getReservations(): Observable<Reservation[]> {
    return this.http
      .get<ReservationEntity[]>(this.reservationsUrl)
      .pipe(map((items) => items.map(toReservation)));
  }

  createReservation(request: NewReservation): Observable<Reservation> {
    const dto: ReservationDto = {
      userId: request.userId,
      bookId: request.bookId,
      issueDate: request.issueDate,
      dueDate: request.dueDate,
      returnDate: request.returnDate || null,
      status: request.returnDate ? 'RETURNED' : 'ACTIVE',
    };
    return this.http.post<ReservationEntity>(this.reservationsUrl, dto).pipe(map(toReservation));
  }

  // Requires a PUT /reservations/{id} endpoint accepting ReservationDto.
  updateReservation(reservation: Reservation): Observable<Reservation> {
    const returned = reservation.status === 'Returned';
    const dto: ReservationDto = {
      userId: reservation.userId ?? 0,
      bookId: reservation.bookId ?? 0,
      issueDate: toIso(reservation.issueDate) ?? '',
      dueDate: toIso(reservation.dueDate) ?? '',
      returnDate: returned ? toIso(reservation.returnDate) : null,
      status: returned ? 'RETURNED' : 'ACTIVE',
    };
    return this.http
      .put<ReservationEntity>(`${this.reservationsUrl}/${reservation.id}`, dto)
      .pipe(map(toReservation));
  }

  deleteReservation(id: string): Observable<void> {
    return this.http.delete<void>(`${this.reservationsUrl}/${id}`);
  }
}
