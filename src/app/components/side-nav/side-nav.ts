import { Component, computed, EventEmitter, inject, Input, Output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { LibraryView } from '../../models/library-view.model';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-side-nav',
  standalone: true,
  templateUrl: './side-nav.html',
})
export class SideNavComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly user = this.auth.currentUser;
  protected readonly initials = computed(() =>
    (this.user()?.name ?? '')
      .split(/[\s._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join(''),
  );

  protected readonly menuOpen = signal(false);

  protected logout() {
    this.menuOpen.set(false);
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }

  protected readonly views = LibraryView;
  @Input() activeView: LibraryView = LibraryView.Catalog;
  @Output() viewChange = new EventEmitter<LibraryView>();

  protected navigate(view: LibraryView) {
    this.viewChange.emit(view);
  }
}
