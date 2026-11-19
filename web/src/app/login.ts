import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {FormControl,FormGroup,ReactiveFormsModule,Validators} from '@angular/forms';
import {Router} from '@angular/router';
import {Store} from './core';
@Component({imports:[ReactiveFormsModule],changeDetection:ChangeDetectionStrategy.OnPush,template:`
<main class="login"><section class="login-art" aria-label="Rezsi Flow"><span class="wordmark"><b>∿</b> Rezsi Flow</span>
<div class="art-lines" aria-hidden="true"><svg viewBox="0 0 400 260" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 236h380M42 235V126l68-42 65 42v110M42 126l68 40 65-40m-65 40v70M159 118V67l55-36 77 45v160M159 67l77 45 55-36m-55 36v124M268 162l45-29 54 31v72m-99-74 54 31 45-29m-45 29v43"/><path stroke-dasharray="4 6" d="M12 207 208 87l177 102M43 177l111 59M192 47v190"/></svg></div>
<div><h1>Otthonod<br>elszámolása.</h1><p>Mérőállások, havi költségek és lakói elszámolások egy helyen.</p></div></section>
<section class="login-form"><form (ngSubmit)="submit()" [formGroup]="form"><h2>Bejelentkezés</h2>
<label>E-mail-cím<input type="email" formControlName="email" autocomplete="username" required></label>
<label>Jelszó<input type="password" formControlName="password" autocomplete="current-password" required></label>
@if(error()){<p class="error" role="alert">{{error()}}</p>}<button class="primary" [disabled]="busy() || form.invalid">{{busy()?'Belépés folyamatban…':'Belépés'}}</button></form></section></main>`})
export class Login {
  s=inject(Store); router=inject(Router); error=signal('');busy=signal(false);
  form=new FormGroup({email:new FormControl('',[Validators.required,Validators.email]),password:new FormControl('',Validators.required)});
  async submit(){if(this.busy()||this.form.invalid)return;this.busy.set(true);this.error.set('');try{await this.s.request('auth/login','POST',this.form.getRawValue());await this.router.navigateByUrl('/dashboard');}catch(e){this.error.set((e as Error).message);}finally{this.busy.set(false);}}
}

