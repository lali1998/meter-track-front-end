import {Routes} from '@angular/router';
import {authGuard} from './core';
const page=()=>import('./pages').then(m=>m.Page);
export const routes:Routes=[{path:'login',title:'Bejelentkezés · Rezsi Flow',loadComponent:()=>import('./login').then(m=>m.Login)},
{path:'',canActivate:[authGuard],loadComponent:()=>import('./shell').then(m=>m.Shell),children:[
{path:'dashboard',title:'Áttekintés',loadComponent:page},{path:'entries/:year/:month',title:'Havi rögzítés',loadComponent:page},{path:'history',title:'Előzmények',loadComponent:page},{path:'analytics',title:'Statisztikák',loadComponent:page},{path:'residents',title:'Lakók',loadComponent:page},{path:'tariffs',title:'Díjszabások',loadComponent:page},{path:'data',pathMatch:'full',redirectTo:'history'},{path:'settings',title:'Beállítások',loadComponent:page},{path:'',pathMatch:'full',redirectTo:'dashboard'}]},{path:'**',redirectTo:'dashboard'}];

