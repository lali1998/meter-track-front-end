import {ChangeDetectionStrategy,Component,inject} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
@Component({changeDetection:ChangeDetectionStrategy.OnPush,template:'<h1>{{title}}</h1><div class="panel empty">Nincs rögzített adat.</div>'})
export class Page {title=inject(ActivatedRoute).snapshot.title;}

