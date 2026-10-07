import { Component, EventEmitter, Input, Output } from '@angular/core';
import { LibraryView } from '../../models/library-view.model';

@Component({
  selector: 'app-side-nav',
  standalone: true,
  templateUrl: './side-nav.html',
})
export class SideNavComponent {
  protected readonly views = LibraryView;
  @Input() activeView: LibraryView = LibraryView.Catalog;
  @Output() viewChange = new EventEmitter<LibraryView>();

  protected navigate(view: LibraryView) {
    this.viewChange.emit(view);
  }
}
