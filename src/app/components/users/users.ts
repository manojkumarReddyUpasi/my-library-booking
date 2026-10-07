import { Component, inject, signal } from '@angular/core';
import { AddUser } from './add-user/add-user';
import type { NewLibraryUser } from './add-user/add-user';
import { EditUser } from './edit-user/edit-user';
import { LibraryUser } from '../../models/user.model';
import { UserRole } from '../../models/user.role.model';
import { RoleService } from '../../services/role.service';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [AddUser, EditUser],
  templateUrl: './users.html',
})
export class Users {
  protected readonly addingUser = signal(false);
  protected readonly editingUser = signal<LibraryUser | null>(null);
  protected readonly usersService = inject(UserService);
  protected readonly rolesService = inject(RoleService);
  protected readonly users = signal<LibraryUser[]>([]);
  protected readonly availableRoles = signal<UserRole[]>([]);
  protected readonly toastMessage = signal('');
  private readonly avatarTones = [
    'tone-coral',
    'tone-blue',
    'tone-gold',
    'tone-green',
    'tone-lavender',
  ];

  constructor() {
    this.rolesService.getRoles().subscribe({
      next: (roles) => this.availableRoles.set(roles),
      error: (error) => {
        console.error('Unable to load roles', error);
        this.showToast('Unable to load roles. Please try again.', true);
      },
    });
    this.usersService.getUsers().subscribe((users) => {
      this.users.set(
        users.map((user, index) => {
          const [firstName = '', ...lastNameParts] = (user.name ?? '').trim().split(/\s+/);
          const lastName = lastNameParts.join(' ');
          const initials =
            (user.initials ??
              `${firstName.charAt(0) || ''}${lastName.charAt(0) || ''}`.toUpperCase()) ||
            'U';

          return {
            ...user,
            tone: user.tone ?? this.avatarTones[index % this.avatarTones.length],
            initials,
            joined: user.joined ?? '2024',
            reservations: user.reservations ?? 0,
          };
        }),
      );
    });
  }
  protected openEditUser(user: LibraryUser, event: Event) {
    event.stopPropagation();
    this.addingUser.set(false);
    this.editingUser.set(user);
  }

  protected openAddUser(): void {
    this.editingUser.set(null);
    this.addingUser.set(true);
  }

  protected closeAddUser(): void {
    this.addingUser.set(false);
  }

  protected closeEditUser() {
    this.editingUser.set(null);
  }

  protected createUser(user: NewLibraryUser): void {
    this.usersService.createUser(user).subscribe({
      next: (createdUser) => {
        const [firstName = '', ...lastNameParts] = (createdUser.name ?? '').trim().split(/\s+/);
        const lastName = lastNameParts.join(' ');
        const userWithDefaults: LibraryUser = {
          ...createdUser,
          status: createdUser.status ?? 'Active',
          active: createdUser.active ?? true,
          tone: createdUser.tone ?? this.avatarTones[this.users().length % this.avatarTones.length],
          initials:
            (createdUser.initials ??
              `${firstName.charAt(0) || ''}${lastName.charAt(0) || ''}`.toUpperCase()) ||
            'U',
          joined: createdUser.joined ?? String(new Date().getFullYear()),
          reservations: createdUser.reservations ?? 0,
        };
        this.users.update((users) => [...users, userWithDefaults]);
        this.closeAddUser();
        this.showToast('User added successfully.');
      },
      error: (error) => {
        console.error('Unable to create user', error);
        this.showToast('Unable to add user. Please try again.', true);
      },
    });
  }

  protected updateUser(updatedUser: LibraryUser) {
    this.usersService.updateUser(updatedUser).subscribe({
      next: (user) => {
        this.users.update((users) => users.map((item) => (item.id === user.id ? user : item)));
        this.closeEditUser();
        this.showToast('User updated successfully.');
      },
      error: (error) => {
        console.error('Unable to update user', error);
        this.showToast('Unable to update user. Please try again.', true);
      },
    });
  }

  private showToast(message: string, isError = false) {
    this.toastMessage.set(message);
    window.setTimeout(() => this.toastMessage.set(''), isError ? 4000 : 3000);
  }

  protected deleteUser(user: LibraryUser, event: Event) {
    event.stopPropagation();
    this.usersService.deleteUser(user).subscribe({
      next: () => {
        this.users.update((users) => users.filter((item) => item.id !== user.id));
        this.showToast('User deleted successfully.');
      },
      error: (error) => {
        console.error('Unable to delete user', error);
        this.showToast('Unable to delete user. Please try again.', true);
      },
    });
  }

  protected isActive(user: LibraryUser): boolean {
    return user.active ?? user.status === 'Active';
  }

  protected get activeUsers() {
    return this.users().filter((user) => this.isActive(user)).length;
  }
}
