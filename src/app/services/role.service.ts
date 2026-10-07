import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { UserRole } from '../models/user.role.model';

@Injectable({ providedIn: 'root' })
export class RoleService {
  private readonly http = inject(HttpClient);
  private readonly rolesUrl = 'http://localhost:8081/roles';

  getRoles(): Observable<UserRole[]> {
    return this.http.get<UserRole[]>(this.rolesUrl);
  }
}
