import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { Reservation } from '../../models/reservation.model';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "06 Oct 2026" -> "2026-10-06"
function toIso(value?: string): string {
  const match = value?.match(/^(\d{2}) (\w{3}) (\d{4})$/);
  if (!match) return '';
  const month = MONTHS.indexOf(match[2]) + 1;
  return month ? `${match[3]}-${String(month).padStart(2, '0')}-${match[1]}` : '';
}

// "2026-10-06" -> "06 Oct 2026"
function fromIso(value: string): string {
  const [year, month, day] = value.split('-');
  return value ? `${day} ${MONTHS[Number(month) - 1]} ${year}` : '';
}

@Component({
  selector: 'app-reservations',
  standalone: true,
  templateUrl: './reservations.html',
})
export class ReservationsComponent {
  @Input() reservations: Reservation[] = [];
  @Output() reservationUpdated = new EventEmitter<Reservation>();
  @Output() reservationRemoved = new EventEmitter<string>();

  protected readonly editingId = signal<string | null>(null);
  protected readonly menuId = signal<string | null>(null);
  protected readonly confirmingRemove = signal(false);
  protected readonly dueDate = signal('');
  protected readonly returnDate = signal('');

  protected toggleMenu(reservation: Reservation) {
    this.menuId.set(this.menuId() === reservation.id ? null : reservation.id);
  }

  protected startRemove(reservation: Reservation) {
    this.startEdit(reservation);
    this.confirmingRemove.set(true);
  }

  protected startEdit(reservation: Reservation) {
    this.menuId.set(null);
    this.editingId.set(reservation.id);
    this.confirmingRemove.set(false);
    this.dueDate.set(toIso(reservation.dueDate));
    this.returnDate.set(toIso(reservation.returnDate));
  }

  protected setDue(event: Event) {
    this.dueDate.set((event.target as HTMLInputElement).value);
  }

  protected setReturn(event: Event) {
    this.returnDate.set((event.target as HTMLInputElement).value);
  }

  protected minDate(reservation: Reservation): string {
    return toIso(reservation.issueDate);
  }

  protected invalid(reservation: Reservation): boolean {
    const issued = toIso(reservation.issueDate);
    return (
      !this.dueDate() ||
      this.dueDate() < issued ||
      (!!this.returnDate() && this.returnDate() < issued)
    );
  }

  protected save(reservation: Reservation) {
    if (this.invalid(reservation)) return;
    const { returnDate: _previous, ...rest } = reservation;
    this.reservationUpdated.emit({
      ...rest,
      dueDate: fromIso(this.dueDate()),
      ...(this.returnDate() ? { returnDate: fromIso(this.returnDate()) } : {}),
      status: this.returnDate() ? 'Returned' : 'Active',
    });
    this.editingId.set(null);
  }

  protected remove(reservation: Reservation) {
    this.reservationRemoved.emit(reservation.id);
    this.editingId.set(null);
  }
}
