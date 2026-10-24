import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, Observable, shareReplay, tap, throwError } from 'rxjs';
import { ActiveUser, LibraryUser } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly usersUrl = '/backend/api/';
  private usersCache?: Observable<LibraryUser[]>;
  private activeUsersCache?: Observable<ActiveUser[]>;

  getUsers(): Observable<LibraryUser[]> {
    if (!this.usersCache) {
      this.usersCache = this.http.get<LibraryUser[]>(this.usersUrl + 'users/needAllUsers').pipe(
        catchError((error: unknown) => {
          this.usersCache = undefined;
          return throwError(() => error);
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    }
    return this.usersCache;
  }

  getActiveUsers(): Observable<ActiveUser[]> {
    if (!this.activeUsersCache) {
      this.activeUsersCache = this.http.get<ActiveUser[]>(this.usersUrl + 'users/active').pipe(
        catchError((error: unknown) => {
          this.activeUsersCache = undefined;
          return throwError(() => error);
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    }
    return this.activeUsersCache;
  }

  createUser(user: Omit<LibraryUser, 'id'>): Observable<LibraryUser> {
    return this.http
      .post<LibraryUser>(this.usersUrl + 'users', user)
      .pipe(tap(() => this.invalidateUsers()));
  }

  updateUser(user: LibraryUser): Observable<LibraryUser> {
    return this.http
      .put<LibraryUser>(this.usersUrl + `users/${user.id}`, user)
      .pipe(tap(() => this.invalidateUsers()));
  }

  deleteUser(user: LibraryUser): Observable<void> {
    return this.http
      .delete<void>(this.usersUrl + `users/${user.id}`)
      .pipe(tap(() => this.invalidateUsers()));
  }

  private invalidateUsers(): void {
    this.usersCache = undefined;
    this.activeUsersCache = undefined;
  }

  clearCache(): void {
    this.invalidateUsers();
  }
}
