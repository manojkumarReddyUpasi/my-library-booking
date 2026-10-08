import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { Book } from '../../models/book.model';
import { Reservation } from '../../models/reservation.model';
import { BooksService } from '../../services/books.service';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface PieSlice {
  label: string;
  count: number;
  color: string;
  percentage: number;
}

// "06 Oct 2026" -> Date
function parseDisplay(value?: string): Date | null {
  const match = value?.match(/^(\d{2}) (\w{3}) (\d{4})$/);
  if (!match || !MONTHS.includes(match[2])) return null;
  return new Date(Number(match[3]), MONTHS.indexOf(match[2]), Number(match[1]));
}

@Component({
  selector: 'app-admin-console',
  standalone: true,
  templateUrl: './admin-console.html',
  styleUrl: './admin-console.css',
})
export class AdminConsoleComponent {
  private readonly booksService = inject(BooksService);
  protected readonly books = signal<Book[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  @Input() reservations: Reservation[] = [];
  @Output() availabilityChange = new EventEmitter<Book>();

  protected readonly query = signal('');

  constructor() {
    this.booksService.getBooks().subscribe({
      next: (books) => {
        this.books.set(books);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Unable to load inventory. Please check that the backend is running.');
        this.loading.set(false);
      },
    });
  }

  protected get filteredBooks(): Book[] {
    const q = this.query().trim().toLowerCase();
    if (!q) return this.books();
    return this.books().filter((b) =>
      [b.title, b.author, b.isbn, b.category].some((v) => v.toLowerCase().includes(q)),
    );
  }

  protected get availableCount(): number {
    return this.books().filter((b) => b.available).length;
  }

  protected get bookAvailabilitySlices(): PieSlice[] {
    return this.toPieSlices([
      { label: 'Available', count: this.availableCount, color: '#568168' },
      {
        label: 'Checked out',
        count: this.books().length - this.availableCount,
        color: '#d96548',
      },
    ]);
  }

  protected get reservationStatusSlices(): PieSlice[] {
    const returned = this.reservations.filter((reservation) => reservation.status === 'Returned').length;
    return this.toPieSlices([
      { label: 'Returned', count: returned, color: '#58798a' },
      { label: 'Not returned', count: this.reservations.length - returned, color: '#c3974b' },
    ]);
  }

  protected pieBackground(slices: PieSlice[]): string {
    const total = slices.reduce((sum, slice) => sum + slice.count, 0);
    if (!total) return 'conic-gradient(#e9e8e2 0% 100%)';

    let offset = 0;
    const stops = slices.map((slice) => {
      const start = offset;
      offset += (slice.count / total) * 100;
      return `${slice.color} ${start}% ${offset}%`;
    });
    return `conic-gradient(${stops.join(', ')})`;
  }

  private toPieSlices(
    slices: Array<{ label: string; count: number; color: string }>,
  ): PieSlice[] {
    const total = slices.reduce((sum, slice) => sum + slice.count, 0);
    return slices.map((slice) => ({
      ...slice,
      percentage: total ? Math.round((slice.count / total) * 100) : 0,
    }));
  }

  protected get activeReservations(): Reservation[] {
    return this.reservations.filter((r) => r.status === 'Active');
  }

  protected get dueThisWeek(): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(today);
    end.setDate(end.getDate() + 7);
    return this.activeReservations.filter((r) => {
      const due = parseDisplay(r.dueDate);
      return !!due && due <= end;
    }).length;
  }

  protected setQuery(event: Event) {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected toggleAvailability(book: Book) { this.availabilityChange.emit(book); }
}
