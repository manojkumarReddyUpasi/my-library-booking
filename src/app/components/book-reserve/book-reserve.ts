import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Book } from '../../models/book.model';
import { Reservation } from '../../models/reservation.model';
import { ActiveUser } from '../../models/user.model';
import { UserService } from '../../services/user.service';

export interface ReserveRequest {
  users: ActiveUser[];
  issueDate: string;
  dueDate: string;
  returnDate: string;
}

const toIso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const defaultDates = () => {
  const today = new Date();
  const due = new Date(today);
  due.setDate(due.getDate() + 14);
  return { issue: toIso(today), due: toIso(due) };
};

@Component({
  selector: 'book-reserve',
  standalone: true,
  templateUrl: './book-reserve.html',
  styleUrl: './book-reserve.css',
})
export class BookReserve implements OnChanges {
  @Input({ required: true }) book!: Book;
  @Input() reservations: Reservation[] = [];
  @Input() copiesLeft = 0;
  @Output() reserved = new EventEmitter<ReserveRequest>();

  private readonly userService = inject(UserService);
  protected readonly users = signal<ActiveUser[]>([]);
  protected readonly loading = signal(false);
  protected readonly loadError = signal(false);
  protected readonly menuOpen = signal(false);
  protected readonly search = signal('');
  protected readonly selectedUsers = signal<ActiveUser[]>([]);
  protected readonly issueDate = signal(defaultDates().issue);
  protected readonly dueDate = signal(defaultDates().due);
  protected readonly returnDate = signal('');
  protected readonly datesInvalid = computed(
    () =>
      !this.issueDate() ||
      !this.dueDate() ||
      this.dueDate() < this.issueDate() ||
      (!!this.returnDate() && this.returnDate() < this.issueDate()),
  );
  protected readonly filteredUsers = computed(() => {
    const query = this.search().trim().toLowerCase();
    return this.users().filter(
      (user) => user.active !== false && `${user.name} ${user.email}`.toLowerCase().includes(query),
    );
  });

  ngOnChanges() {
    this.menuOpen.set(false);
    this.search.set('');
    this.selectedUsers.set([]);
    const dates = defaultDates();
    this.issueDate.set(dates.issue);
    this.dueDate.set(dates.due);
    this.returnDate.set('');
  }

  protected setDate(field: 'issue' | 'due' | 'return', event: Event) {
    const value = (event.target as HTMLInputElement).value;
    if (field === 'issue') this.issueDate.set(value);
    else if (field === 'due') this.dueDate.set(value);
    else this.returnDate.set(value);
  }

  protected get triggerLabel(): string {
    if (this.copiesLeft === 0) return 'No copies available';
    const count = this.selectedUsers().length;
    return count ? `${count} ${count === 1 ? 'user' : 'users'} selected` : 'Select users';
  }

  protected get reserveLabel(): string {
    const count = this.selectedUsers().length;
    return count > 1 ? `Reserve for ${count} users` : 'Reserve book';
  }

  protected get overCapacity(): boolean {
    return this.selectedUsers().length > this.copiesLeft;
  }

  protected toggleMenu() {
    const open = !this.menuOpen();
    this.menuOpen.set(open);
    this.search.set('');
    if (!open) return;
    this.loading.set(true);
    this.loadError.set(false);
    this.userService.getActiveUsers().subscribe({
      next: (users) => {
        this.users.set(users);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Unable to load users', error);
        this.loadError.set(true);
        this.loading.set(false);
      },
    });
  }

  protected setSearch(event: Event) {
    this.search.set((event.target as HTMLInputElement).value);
  }

  protected hasReserved(user: ActiveUser): boolean {
    const title = this.book.title.trim().toLowerCase();
    return this.reservations.some(
      (reservation) =>
        reservation.status === 'Active' &&
        reservation.title.trim().toLowerCase() === title &&
        reservation.borrower === user.name,
    );
  }

  protected isSelected(user: ActiveUser): boolean {
    return this.selectedUsers().some((selected) => selected.id === user.id);
  }

  protected toggleUser(user: ActiveUser) {
    this.selectedUsers.update((selected) =>
      selected.some((item) => item.id === user.id)
        ? selected.filter((item) => item.id !== user.id)
        : [...selected, user],
    );
  }

  protected reserve() {
    const users = this.selectedUsers().filter((user) => !this.hasReserved(user));
    if (!users.length || this.copiesLeft === 0 || this.datesInvalid()) return;
    this.reserved.emit({
      users,
      issueDate: this.issueDate(),
      dueDate: this.dueDate(),
      returnDate: this.returnDate(),
    });
  }
}
