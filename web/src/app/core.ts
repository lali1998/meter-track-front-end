import { Injectable, signal, inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
export interface Account {email:string; propertyId:number; propertyName:string; readingDay:number}
export const firstMonth = '2022-09';
export function monthKey(date = new Date()) { return date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0'); }
export function shiftMonth(month:string, step:number) {const [y,m]=month.split('-').map(Number);return monthKey(new Date(y,m-1+step,1));}
export function monthLabel(month:string) { const [y,m]=month.split('-').map(Number);return new Intl.DateTimeFormat('hu-HU',{year:'numeric',month:'long'}).format(new Date(y,m-1,1)); }
export const money = (n:number|null|undefined) => n == null ? '—' : new Intl.NumberFormat('hu-HU').format(n)+' Ft';
export class ApiError extends Error {constructor(message:string,public status:number){super(message);}}
@Injectable({providedIn:'root'})
export class Store {
  user=signal<Account|null>(null); month=signal(monthKey()); notice=signal(''); private timer?:ReturnType<typeof setTimeout>;
  async request<T>(path:string, method='GET', body?:unknown):Promise<T>{
    const res=await fetch('/api/v1/'+path,{method, headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),credentials:'same-origin'});
    if(!res.ok){const data=await res.json().catch(()=>({}));throw new ApiError(Array.isArray(data.message)?data.message.join(' · '):data.message||'A kérés sikertelen. Próbáld újra.',res.status);}
    return res.status===204?undefined as T:res.json();
  }
  async refresh(){this.user.set(await this.request<Account>('auth/me'));}
  get base(){return 'properties/'+this.user()!.propertyId;}
  toast(message:string){this.notice.set(message);clearTimeout(this.timer);this.timer=setTimeout(()=>this.notice.set(''),4500);}
}
export const authGuard:CanActivateFn=async()=>{const s=inject(Store),r=inject(Router);try{await s.refresh();return true;}catch{return r.parseUrl('/login');}};

