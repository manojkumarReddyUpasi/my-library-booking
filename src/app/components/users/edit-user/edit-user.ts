import { Component, EventEmitter, inject, Input, OnInit, Output, signal } from '@angular/core';
import { LibraryUser } from '../../../models/user.model';
import { UserRole } from '../../../models/user.role.model';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
function notBlank(control: { value: string }) {
  return control.value?.trim() ? null : { required: true };
}
@Component({
  selector: 'edit-user',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './edit-user.html',
  styleUrl: './edit-user.css',
})
export class EditUser implements OnInit {
  @Input({ required: true }) user!: LibraryUser;
  @Input({ required: true }) availableRoles: UserRole[] = [];
  private readonly formBuilder = inject(FormBuilder);
  @Output() userUpdated = new EventEmitter<LibraryUser>();
  @Output() canceled = new EventEmitter<void>();
  protected readonly roleSearch = signal('');
  protected readonly selectedRoleIds = signal<number[]>([]);
  protected readonly roleMenuOpen = signal(false);
  protected readonly active = signal(true);

  protected readonly userForm = this.formBuilder.nonNullable.group({
    name: ['', [notBlank, Validators.minLength(3), Validators.maxLength(30)]],
    email: ['', [notBlank, Validators.email]],
    password: ['', [notBlank]],
  });

  ngOnInit(): void {
    this.userForm.patchValue({
      name: this.user.name,
      email: this.user.email,
      password: this.user.password,
    });
    this.selectedRoleIds.set(this.user.roles.map((role) => role.id));
    this.active.set(this.user.active ?? this.user.status === 'Active');
  }

  protected toggleActive(): void {
    this.active.update((isActive) => !isActive);
  }

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

  protected submit(): void {
    if (this.userForm.valid) {
      const roles = this.selectedRoles;
      const updatedUser: LibraryUser = {
        ...this.user,
        name: this.userForm.controls.name.value,
        email: this.userForm.controls.email.value,
        password: this.userForm.controls.password.value,
        roles,
        active: this.active(),
        status: this.active() ? 'Active' : 'Inactive',
      };
      this.userUpdated.emit(updatedUser);
    } else {
      this.userForm.markAllAsTouched();
      return;
    }
  }
}
