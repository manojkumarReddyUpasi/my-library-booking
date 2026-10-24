import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, Observable, shareReplay, throwError } from 'rxjs';
import { UserRole } from '../models/user.role.model';

@Injectable({ providedIn: 'root' })
export class RoleService {
  private readonly http = inject(HttpClient);
  private readonly rolesUrl = '/backend/roles';
  private rolesCache?: Observable<UserRole[]>;

  getRoles(): Observable<UserRole[]> {
    if (!this.rolesCache) {
      this.rolesCache = this.http.get<UserRole[]>(this.rolesUrl).pipe(
        catchError((error: unknown) => {
          this.rolesCache = undefined;
          return throwError(() => error);
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    }
    return this.rolesCache;
  }

  clearCache(): void {
    this.rolesCache = undefined;
  }
}
