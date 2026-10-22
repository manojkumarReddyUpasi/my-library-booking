import { Component, computed, inject, Input } from '@angular/core';
import { LibraryView } from '../../models/library-view.model';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-top-nav',
  standalone: true,
  templateUrl: './top-nav.html',
})
export class TopNavComponent {
  private readonly auth = inject(AuthService);
  protected readonly views = LibraryView;
  protected readonly initials = computed(() =>
    (this.auth.currentUser()?.name ?? '')
      .split(/[\s._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join(''),
  );
  @Input() activeView: LibraryView = LibraryView.Catalog;
}
