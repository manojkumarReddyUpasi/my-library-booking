import { UserRole } from './user.role.model';

export interface LibraryUser {
  id: number;
  name: string;
  email: string;
  password: string;
  roles: UserRole[];
  status: 'Active' | 'Inactive';
  active?: boolean;
  tone?: string;
  initials?: string;
  joined?: string;
  reservations?: number;
}

export type ActiveUser = Pick<LibraryUser, 'id' | 'name' | 'email' | 'active'>;
