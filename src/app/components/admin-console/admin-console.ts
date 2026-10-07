import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Book } from '../../models/book.model';

@Component({
  selector: 'app-admin-console',
  standalone: true,
  templateUrl: './admin-console.html',
  styleUrl: './admin-console.css',
})
export class AdminConsoleComponent {
  @Input() books: Book[] = [];
  @Output() availabilityChange = new EventEmitter<Book>();

  protected toggleAvailability(book: Book) { this.availabilityChange.emit(book); }
}
