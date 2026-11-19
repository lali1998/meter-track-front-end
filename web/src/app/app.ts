import {Component,ChangeDetectionStrategy,inject} from '@angular/core';
import {RouterOutlet} from '@angular/router';
import {Store} from './core';
@Component({selector:'app-root',imports:[RouterOutlet],changeDetection:ChangeDetectionStrategy.OnPush,template:'<router-outlet /> @if(s.notice()){<div class="toast" role="status">{{s.notice()}}</div>}'})
export class App {s=inject(Store);}

