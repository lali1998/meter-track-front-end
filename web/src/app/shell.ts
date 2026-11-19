import {Component,ChangeDetectionStrategy,inject,signal} from '@angular/core';
import {Router, RouterLink, RouterLinkActive, RouterOutlet} from '@angular/router';
import {CdkTrapFocus} from '@angular/cdk/a11y';
import {Store,firstMonth,monthKey,shiftMonth} from './core';
const links=[['/dashboard','Áttekintés','▦'],['/entries','Havi rögzítés','✎'],['/history','Előzmények','◷'],['/analytics','Statisztikák','▥'],['/residents','Lakók','♧'],['/tariffs','Díjszabások','≋'],['/settings','Beállítások','⚙']];
@Component({imports:[RouterOutlet,RouterLink,RouterLinkActive,CdkTrapFocus],changeDetection:ChangeDetectionStrategy.OnPush,template:`
<div class="frame" [class.compact]="compact()" (keydown.escape)="drawer.set(false)">
@if(drawer()){<button class="scrim" aria-label="Menü bezárása" (click)="drawer.set(false)"></button>}
<aside [class.open]="drawer()" [cdkTrapFocus]="drawer()"><a class="wordmark" routerLink="/dashboard"><b>∿</b><span>Rezsi Flow</span></a>
<nav aria-label="Főmenü">@for(l of links;track l[0]){<a [routerLink]="l[0]==='/entries'?entry():l[0]" routerLinkActive="active" [attr.aria-label]="l[1]" [title]="l[1]" (click)="drawer.set(false)"><i aria-hidden="true">{{l[2]}}</i><span>{{l[1]}}</span></a>}</nav>
<div class="sidefoot"><button class="side-action" (click)="logout()" title="Kijelentkezés"><i>⏻</i><span>Kijelentkezés</span></button><button class="side-action collapse" (click)="compact.set(!compact())" aria-label="Navigáció mérete"><i>◧</i><span>Menü összecsukása</span></button></div></aside>
<div class="workspace"><header><button class="mobile-menu" (click)="drawer.set(true)" aria-label="Menü megnyitása">☰</button><strong class="property">{{s.user()?.propertyName}}</strong><div class="monthpicker"><button aria-label="Előző hónap" [disabled]="s.month()<=first" (click)="change(shift(s.month(),-1))">‹</button><input aria-label="Elszámolási hónap" type="month" [min]="first" [value]="s.month()" (change)="change($any($event.target).value)"><button aria-label="Következő hónap" (click)="change(shift(s.month(),1))">›</button></div><span class="avatar" [title]="s.user()?.email">{{s.user()?.email?.slice(0,1)?.toUpperCase()}}</span></header>
<main id="content"><router-outlet/></main></div></div>`})
export class Shell {s=inject(Store);router=inject(Router);links=links;compact=signal(false);drawer=signal(false);first=firstMonth;shift=shiftMonth;
entry(){return '/entries/'+this.s.month().replace('-','/');}
change(k:string){if(/^\d{4}-(0[1-9]|1[0-2])$/.test(k)&&k>=firstMonth){this.s.month.set(k);if(this.router.url.startsWith('/entries'))void this.router.navigateByUrl(this.entry());}}
async logout(){try{await this.s.request('auth/logout','POST',{});this.s.user.set(null);await this.router.navigateByUrl('/login');}catch(e){this.s.toast((e as Error).message);}}}

