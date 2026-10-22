import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

function notBlank(value: string): boolean {
  return value.trim().length > 0;
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: '../auth.css',
})
export class RegisterComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  protected readonly notice = signal('');
  protected readonly noticeType = signal<'success' | 'error'>('error');
  protected readonly submitting = signal(false);
  protected readonly registerForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.pattern(/\S/)]],
    email: ['', [Validators.required, Validators.email, Validators.pattern(/\S/)]],
    password: ['', [Validators.required, Validators.minLength(6), Validators.pattern(/\S/)]],
  });

  protected submit(): void {
    if (this.registerForm.invalid || this.submitting()) {
      this.registerForm.markAllAsTouched();
      return;
    }

    const request = this.registerForm.getRawValue();
    if (!notBlank(request.name) || !notBlank(request.email) || !notBlank(request.password)) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.notice.set('');
    this.submitting.set(true);
    this.authService.register(request).subscribe({
      next: () => {
        this.noticeType.set('success');
        this.notice.set('Account created successfully. You can now sign in.');
        this.registerForm.reset();
        this.submitting.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.noticeType.set('error');
        this.notice.set(this.errorMessage(error));
        this.submitting.set(false);
      },
    });
  }

  private errorMessage(error: HttpErrorResponse): string {
    const body: unknown = error.error;
    if (typeof body === 'string' && body.trim()) return body;
    if (body && typeof body === 'object') {
      const response = body as {
        message?: unknown;
        error?: unknown;
        errors?: unknown;
      };
      if (typeof response.message === 'string' && response.message.trim()) {
        return response.message;
      }
      if (response.errors && typeof response.errors === 'object') {
        const messages = Object.values(response.errors).filter(
          (message): message is string => typeof message === 'string' && !!message.trim(),
        );
        if (messages.length) return messages.join(' ');
      }
      if (typeof response.error === 'string' && response.error.trim()) {
        return response.error;
      }
    }

    return 'Unable to create your account. Please try again.';
  }
}
