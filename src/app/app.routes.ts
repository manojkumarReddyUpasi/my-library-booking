import { Component } from '@angular/core';
import { Routes } from '@angular/router';
import { LoginComponent } from './components/auth/login/login';
import { RegisterComponent } from './components/auth/register/register';
import { authGuard, guestGuard } from './guards/auth.guard';

@Component({
  standalone: true,
  template: '',
})
class DashboardRouteComponent {}

export const routes: Routes = [
  { path: '', pathMatch: 'full', component: DashboardRouteComponent, canActivate: [authGuard] },
  { path: 'login', component: LoginComponent, canActivate: [guestGuard] },
  { path: 'register', component: RegisterComponent, canActivate: [guestGuard] },
  { path: '**', redirectTo: '' },
];
