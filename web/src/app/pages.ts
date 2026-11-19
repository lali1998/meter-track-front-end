import {ChangeDetectionStrategy,Component,computed,inject,signal} from '@angular/core';
import {ActivatedRoute,RouterLink} from '@angular/router';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {Store,money,monthLabel,shiftMonth,monthKey} from './core';
import {EntryEditor} from './entry-editor';

interface Line {label:string; amount:number; previous?:number|null; current?:number|null; quantity?:number|null; price?:number|null}
interface Period {month:string;status:string;result:{total:number|null;utility:number|null;rent:number|null;other:number|null;items:Line[];personal?:Line[];warnings:string[]}}
interface Config {residents:{id:number;name:string;from:string;to:string|null;weight:number}[];meters:{id:number;label:string;unit:string}[];tariffs:{id:number;label:string;from:string}[];charges:{id:number;label:string;amount:number}[]}
@Component({imports:[RouterLink,EntryEditor],host:{'[class.table-page]':"view==='history'||view==='analytics'||view==='dashboard'"},changeDetection:ChangeDetectionStrategy.OnPush,templateUrl:'./pages.html'})
export class Page {
 readonly store=inject(Store);
 private route=inject(ActivatedRoute);
 readonly title=this.route.snapshot.title;
 readonly view=this.route.snapshot.routeConfig?.path?.split('/')[0];
 readonly periods=signal<Period[]>([]);
 readonly config=signal<Config|null>(null);
 readonly error=signal(''); readonly busy=signal(true); readonly year=signal('');
 readonly current=computed(()=>this.periods().find(p=>p.month===this.store.month()));
 readonly nextMonth=computed(()=>this.periods().length?shiftMonth(this.periods()[0].month,1):monthKey());
 readonly years=computed(()=>[...new Set(this.periods().map(p=>p.month.slice(0,4)))]);
 readonly yearOffset=signal(0);
 readonly yearPageSize=3;
 readonly visibleYears=computed(()=>this.years().slice(this.yearOffset(),this.yearOffset()+this.yearPageSize));
 readonly filtered=computed(()=>this.periods().filter(p=>p.month.startsWith(this.year())));
 readonly historyTotals=computed(()=>{
   const rows=this.filtered();
   const sum=(field:'utility'|'rent'|'total')=>{
     const amounts=rows.map(p=>p.result[field]).filter((n):n is number=>n!=null);
     return amounts.length?amounts.reduce((cents,n)=>cents+Math.round(n*100),0)/100:null;
   };
   return {utility:sum('utility'),rent:sum('rent'),total:sum('total')};
 });
 pageYears(direction:number){this.yearOffset.update(offset=>offset+direction*this.yearPageSize);}
 showAllYears(){this.yearOffset.set(0);this.year.set('');}
 readonly summary=computed(()=>this.years().map(year=>{
   const totals=this.periods().filter(p=>p.month.startsWith(year)).map(p=>p.result.total).filter((n):n is number=>n!==null);
   return {year,count:totals.length,total:totals.reduce((a,b)=>a+b,0)};
 }));
 readonly grandTotal=computed(()=>this.summary().reduce((sum,year)=>({
   count:sum.count+year.count,
   filler:sum.filler+Math.round(year.total*100)
 }),{count:0,filler:0}));
 readonly money=money;readonly label=monthLabel;
 readonly wholeForints=new Intl.NumberFormat('hu-HU',{style:'currency',currency:'HUF',minimumFractionDigits:0,maximumFractionDigits:0});
 constructor(){
   if(this.view==='entries')this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(p=>this.store.month.set(p.get('year')+'-'+p.get('month')!.padStart(2,'0')));
   void this.load();
 }
 async load(){this.busy.set(true);this.error.set('');
   try{if(['residents','settings','tariffs'].includes(this.view??''))this.config.set(await this.store.request<Config>(this.store.base+'/config'));
   else this.periods.set(await this.store.request<Period[]>(this.store.base+'/periods'));}
   catch(e){this.error.set((e as Error).message);}finally{this.busy.set(false);}
 }
 entry(key:string){return '/entries/'+key.replace('-','/');}
 status(s:string){return ({imported:'Importált',draft:'Tervezet',final:'Végleges'} as Record<string,string>)[s]??s;}
}
