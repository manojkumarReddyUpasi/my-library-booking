import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ActiveUser, LibraryUser } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly usersUrl = 'http://localhost:8081/api/';
  getUsers(): Observable<LibraryUser[]> {
    return this.http.get<LibraryUser[]>(this.usersUrl + 'users/needAllUsers');
  }
  getActiveUsers(): Observable<ActiveUser[]> {
    return this.http.get<ActiveUser[]>(this.usersUrl + 'users/active');
  }
  createUser(user: Omit<LibraryUser, 'id'>): Observable<LibraryUser> {
    return this.http.post<LibraryUser>(this.usersUrl + 'users', user);
  }
  updateUser(user: LibraryUser): Observable<LibraryUser> {
    return this.http.put<LibraryUser>(this.usersUrl + `users/${user.id}`, user);
  }
  deleteUser(user: LibraryUser): Observable<void> {
    return this.http.delete<void>(this.usersUrl + `users/${user.id}`);
  }
}
