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

  protected readonly editingId = signal<string | null>(null);
  protected readonly menuId = signal<string | null>(null);
  protected readonly dueDate = signal('');
  protected readonly returnDate = signal('');

  protected activeCount(): number {
    return this.reservations.filter((r) => r.status === 'Active').length;
  }

  // Earliest due date among active reservations; overdue ones count too so they aren't hidden.
  protected nextReturn(): { day: string; month: string } | null {
    let next: Date | null = null;
    for (const r of this.reservations) {
      const match = r.status === 'Active' ? r.dueDate?.match(/^(\d{2}) (\w{3}) (\d{4})$/) : null;
      if (!match || !MONTHS.includes(match[2])) continue;
      const due = new Date(Number(match[3]), MONTHS.indexOf(match[2]), Number(match[1]));
      if (!next || due < next) next = due;
    }
    return next
      ? { day: String(next.getDate()).padStart(2, '0'), month: MONTHS[next.getMonth()].toUpperCase() }
      : null;
  }

  protected reservedThisYear(): number {
    const year = String(new Date().getFullYear());
    return this.reservations.filter((r) => r.issueDate.endsWith(year)).length;
  }

  protected toggleMenu(reservation: Reservation) {
    this.menuId.set(this.menuId() === reservation.id ? null : reservation.id);
  }

  protected startEdit(reservation: Reservation) {
    this.menuId.set(null);
    this.editingId.set(reservation.id);
    this.dueDate.set(toIso(reservation.dueDate));
    this.returnDate.set(toIso(reservation.returnDate));
  }

  protected markReturned(reservation: Reservation) {
    const today = new Date();
    const returnDate = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0'),
    ].join('-');
    this.menuId.set(null);
    this.reservationUpdated.emit({
      ...reservation,
      returnDate: fromIso(returnDate),
      status: 'Returned',
    });
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

}
