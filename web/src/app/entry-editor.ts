import {Component,inject,Input,OnInit,output,signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {Store} from './core';

interface Reading {id:number;previous:string|null;current:string|null;date:string|null;note:string;verified:boolean}
interface Extra {label:string;amount:number|null;category:string;split:unknown}
interface Entry {status:string;version:number;meters:{id:number;label:string;unit:string}[];input:{readings:Reading[];extras:Extra[]}}
@Component({selector:'app-entry-editor',imports:[FormsModule],template:`
@if(error()){<p class="error" role="alert">{{error()}}</p>}
@if(data(); as d){<form class="stack" (submit)="save($event)">
<fieldset class="stack" [disabled]="saving()"><section class="panel stack"><h2>Mérőállások rögzítése</h2>
@for(r of d.input.readings;track r.id){<div class="stack"><h3>{{meterName(d,r.id)}}</h3><div class="fields">
<label>Előző állás<input inputmode="decimal" [(ngModel)]="r.previous" name="previous{{r.id}}"></label>
<label>Jelenlegi állás<input inputmode="decimal" [(ngModel)]="r.current" name="current{{r.id}}"></label>
<label>Leolvasás napja<input type="date" [(ngModel)]="r.date" name="date{{r.id}}"></label>
<label>Megjegyzés<input maxlength="500" [(ngModel)]="r.note" name="note{{r.id}}"></label></div></div>}</section>
<section class="panel stack"><h2>Havi díjak</h2>
@for(t of d.input.extras;track t;let n=$index){<div class="fields"><label>Tétel neve<input required maxlength="100" [(ngModel)]="t.label" name="label{{n}}"></label><label>Kategória<select [(ngModel)]="t.category" name="category{{n}}"><option value="utility">Rezsi</option><option value="rent">Lakbér</option><option value="other">Egyéb</option></select></label><label>Összeg (Ft)<input required type="number" step="1" [(ngModel)]="t.amount" name="amount{{n}}"></label><button type="button" (click)="d.input.extras.splice(n,1)">Eltávolítás</button></div>}
<div><button type="button" (click)="d.input.extras.push({label:'',amount:null,category:'utility',split:{mode:'equal'}})">Díjtétel hozzáadása</button></div></section>
<div><button class="primary" type="submit">{{saving()?'Mentés…':'Tervezet mentése'}}</button></div></fieldset></form>}
@else if(!error()){<p role="status">Mérőállások betöltése…</p>}`})
export class EntryEditor implements OnInit {
 @Input({required:true}) month!:string;
 readonly saved=output<void>(); readonly data=signal<Entry|null>(null);
 readonly error=signal(''); readonly saving=signal(false); private store=inject(Store);
 private get endpoint(){return this.store.base+'/periods/'+this.month;}
 async ngOnInit(){try{const d=await this.store.request<Entry>(this.endpoint);if(!['draft','missing'].includes(d.status))throw Error('Ez a hónap már rögzítve van.');this.data.set(d);}catch(e){this.error.set((e as Error).message);}}
 meterName(d:Entry,id:number){const m=d.meters.find(m=>m.id===id);return m?m.label+' ('+m.unit+')':'Mérő';}
 async save(event:Event){event.preventDefault();const d=this.data();if(!d||this.saving())return;
 this.error.set('');this.saving.set(true);
 try{const readings=d.input.readings.map(r=>({...r,previous:r.previous?.trim()||null,current:r.current?.trim()||null,date:r.date||null}));
 for(const r of readings){for(const v of [r.current,r.previous])if(v!==null&&!/^\d{1,10}([.,]\d{1,4})?$/.test(v))throw Error('A mérőállás pozitív szám vagy nulla lehet, legfeljebb négy tizedesjeggyel.');
 if(r.current!==null&&r.previous!==null&&Number(r.current.replace(',','.'))<Number(r.previous.replace(',','.')))throw Error(this.meterName(d,r.id)+': az új állás kisebb a korábbinál.');
 if(r.date&&!r.date.startsWith(this.month+'-'))throw Error('A leolvasás dátuma a kiválasztott hónapba essen.');}
 if(!readings.some(r=>r.current!==null||r.note.trim())&&!d.input.extras.length)throw Error('Adj meg mérőállást, megjegyzést vagy díjtételt.');
 await this.store.request(this.endpoint,'PUT',{version:d.version,readings,extras:d.input.extras});this.store.toast('Havi tervezet elmentve.');this.saved.emit();
 }catch(e){this.error.set((e as Error).message);}finally{this.saving.set(false);}}
}
