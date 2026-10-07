import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Book } from '../../../models/book.model';
import { NewBookDetails } from '../add-book/add-book';

function notBlank(control: AbstractControl): ValidationErrors | null {
  return control.value?.trim() ? null : { required: true };
}

@Component({
  selector: 'app-edit-book',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './edit-book.html',
})
export class EditBookComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  @Input({ required: true }) book!: Book;
  @Output() bookUpdated = new EventEmitter<Book>();
  @Output() canceled = new EventEmitter<void>();

  protected readonly bookForm = this.formBuilder.nonNullable.group({
    title: ['', notBlank],
    author: ['', notBlank],
    category: ['Fiction', notBlank],
    isbn: ['', [notBlank, Validators.minLength(10), Validators.maxLength(13)]],
    available: [true],
    accent: ['coral', notBlank],
    bookCount: [1, [Validators.min(1)]],
  });

  ngOnInit() {
    this.bookForm.setValue({
      title: this.book.title,
      author: this.book.author,
      category: this.book.category,
      isbn: this.book.isbn,
      available: this.book.available,
      accent: this.book.accent,
      bookCount: this.book.bookCount ?? 1,
    });
  }

  protected increaseCount() {
    const control = this.bookForm.controls.bookCount;
    control.setValue(control.value + 1);
  }

  protected decreaseCount() {
    const control = this.bookForm.controls.bookCount;
    control.setValue(Math.max(1, control.value - 1));
  }

  protected submit() {
    if (this.bookForm.invalid) {
      this.bookForm.markAllAsTouched();
      return;
    }

    this.bookUpdated.emit({ id: this.book.id, ...this.bookForm.getRawValue() });
  }

  protected cancel() {
    this.canceled.emit();
  }
}
