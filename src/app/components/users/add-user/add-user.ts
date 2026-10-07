import { Component, EventEmitter, inject, Input, Output, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { LibraryUser } from '../../../models/user.model';
import { UserRole } from '../../../models/user.role.model';

export type NewLibraryUser = Omit<LibraryUser, 'id'>;

function notBlank(control: AbstractControl): ValidationErrors | null {
  return control.value?.trim() ? null : { required: true };
}

@Component({
  selector: 'add-user',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './add-user.html',
  styleUrl: '../edit-user/edit-user.css',
})
export class AddUser {
  @Input({ required: true }) availableRoles: UserRole[] = [];
  @Output() userAdded = new EventEmitter<NewLibraryUser>();
  @Output() canceled = new EventEmitter<void>();

  private readonly formBuilder = inject(FormBuilder);
  protected readonly roleSearch = signal('');
  protected readonly selectedRoleIds = signal<number[]>([]);
  protected readonly roleMenuOpen = signal(false);
  protected readonly active = signal(true);

  protected readonly userForm = this.formBuilder.nonNullable.group({
    name: ['', [notBlank, Validators.minLength(3), Validators.maxLength(30)]],
    email: ['', [notBlank, Validators.email]],
    password: ['', [notBlank]],
  });

  protected get filteredRoles(): UserRole[] {
    const query = this.roleSearch().trim().toLocaleLowerCase();
    return this.availableRoles.filter((role) => role.name.toLocaleLowerCase().includes(query));
  }

  protected get selectedRoles(): UserRole[] {
    return this.availableRoles.filter((role) => this.selectedRoleIds().includes(role.id));
  }

  protected isRoleSelected(roleId: number): boolean {
    return this.selectedRoleIds().includes(roleId);
  }

  protected setRoleSearch(event: Event): void {
    this.roleSearch.set((event.target as HTMLInputElement).value);
  }

  protected toggleRoleMenu(): void {
    this.roleMenuOpen.update((isOpen) => !isOpen);
  }

  protected toggleRole(roleId: number, event?: Event): void {
    const checked = event ? (event.target as HTMLInputElement).checked : false;
    this.selectedRoleIds.update((selected) =>
      checked ? [...selected, roleId] : selected.filter((id) => id !== roleId),
    );
  }

  protected toggleActive(): void {
    this.active.update((isActive) => !isActive);
  }

  protected submit(): void {
    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      return;
    }

    this.userAdded.emit({
      ...this.userForm.getRawValue(),
      roles: this.selectedRoles,
      status: this.active() ? 'Active' : 'Inactive',
      active: this.active(),
    });
  }
}
