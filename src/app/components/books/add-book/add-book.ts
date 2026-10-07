import { Component, EventEmitter, Output, inject } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Book } from '../../../models/book.model';

export type NewBookDetails = Pick<
  Book,
  'title' | 'author' | 'category' | 'isbn' | 'available' | 'accent' | 'bookCount'
>;

function notBlank(control: AbstractControl): ValidationErrors | null {
  return control.value?.trim() ? null : { required: true };
}

@Component({
  selector: 'app-add-book',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './add-book.html',
})
export class AddBookComponent {
  private readonly formBuilder = inject(FormBuilder);
  @Output() bookAdded = new EventEmitter<NewBookDetails>();
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

    this.bookAdded.emit(this.bookForm.getRawValue());
  }

  protected cancel() {
    this.canceled.emit();
  }
}
