import { Component, Input } from '@angular/core';
import { LibraryView } from '../../models/library-view.model';

@Component({
  selector: 'app-top-nav',
  standalone: true,
  templateUrl: './top-nav.html',
})
export class TopNavComponent {
  protected readonly views = LibraryView;
  @Input() activeView: LibraryView = LibraryView.Catalog;
}
