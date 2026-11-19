import {Body,Controller,Get,Param,Patch,Post,Req,UseGuards,ConflictException,NotFoundException} from '@nestjs/common';
import {DataSource,EntityManager} from 'typeorm';
import {z} from 'zod';
import {Access,Actor,Authed} from './security';
export const month=z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).refine(s=>s>='2022-09','Az első hónap 2022 szeptember.');
export const label=z.string().trim().min(1).max(100);
const dates={from:month,to:month.nullable()};const ordered=(a:{from:string;to:string|null})=>!a.to||a.from<=a.to;
export const split=z.discriminatedUnion('mode',[z.object({mode:z.literal('equal')}),z.object({mode:z.literal('weights')}),z.object({mode:z.literal('exclusive'),resident:z.number().int().positive()}),z.object({mode:z.enum(['percent','fixed']),values:z.record(z.string().regex(/^\d+$/),z.number().int().nonnegative().max(2000000000))})]);
const resident=z.strictObject({name:label,...dates,weight:z.number().int().min(0).max(10000)}).refine(ordered);
const decimal=z.string().regex(/^\d{1,10}([.,]\d{1,4})?$/);
const tariff=z.strictObject({meterId:z.number().int().positive(),...dates,bands:z.array(z.strictObject({limit:decimal.nullable(),price:decimal})).min(1).max(20),role:z.enum(['info','billed'])}).refine(ordered).refine(t=>t.bands.every((b,i)=>i===t.bands.length-1?b.limit===null:b.limit!==null&&Number(b.limit.replace(',','.'))>0),'Az utolsó sáv korlátlan, a többi sáv szélessége pozitív.');
const charge=z.strictObject({...dates,label,category:z.enum(['utility','rent','other']),amount:z.number().int().min(-1000000000).max(1000000000),split}).refine(ordered);
export function json<T>(v:T|string):T{return typeof v==='string'?JSON.parse(v):v;}
export async function audit(m:EntityManager,a:Actor,key:string,action:string,before:unknown,after:unknown){await m.query('INSERT INTO audit_logs(property_id,actor_id,entity_key,action,before_json,after_json) VALUES(?,?,?,?,?,?)',[a.propertyId,a.id,key,action,JSON.stringify(before),JSON.stringify(after)]);}
export async function locked<T>(db:DataSource,a:Actor,fn:(m:EntityManager)=>Promise<T>){return db.transaction(async m=>{await m.query('SELECT id FROM properties WHERE id=? FOR UPDATE',[a.propertyId]);return fn(m);});}
@Controller('properties') @UseGuards(Access)
export class PropertyController{
 constructor(private db:DataSource){}
 @Get() async properties(@Req() r:Authed){return this.db.query('SELECT p.id,p.name FROM properties p JOIN property_access a ON p.id=a.property_id WHERE a.user_id=?',[r.actor.id]);}
 @Get(':id/config') async config(@Req() r:Authed){const id=r.actor.propertyId;
 const [residents,meters,tariffs,charges]=await Promise.all([
 this.db.query('SELECT id,name,active_from AS `from`,active_to AS `to`,weight FROM residents WHERE property_id=? ORDER BY id',[id]),
 this.db.query('SELECT id,code,label,unit,billing_role role FROM meters WHERE property_id=? ORDER BY id',[id]),
 this.db.query('SELECT t.id,m.label,t.meter_id meterId,t.valid_from AS `from`,t.valid_to AS `to`,t.rules_json rules FROM tariff_versions t JOIN meters m ON m.id=t.meter_id WHERE m.property_id=? ORDER BY t.valid_from DESC,t.id DESC',[id]),
 this.db.query('SELECT id,label,category,amount,valid_from AS `from`,valid_to AS `to`,allocation_rule AS splitRule FROM recurring_charges WHERE property_id=? ORDER BY id',[id])]);return {residents,meters,tariffs,charges};}
 @Patch(':id/settings') async settings(@Req() r:Authed,@Body() b:unknown){const v=z.strictObject({name:label,readingDay:z.number().int().min(1).max(31)}).parse(b);return locked(this.db,r.actor,async m=>{await m.query('UPDATE properties SET name=?,reading_day=? WHERE id=?',[v.name,v.readingDay,r.actor.propertyId]);await audit(m,r.actor,'settings','update',{name:r.actor.propertyName,readingDay:r.actor.readingDay},v);return {ok:true};});}
 @Post(':id/residents') add(@Req() r:Authed,@Body() b:unknown){return this.saveResident(r,b);}
 @Patch(':id/residents/:residentId') edit(@Req() r:Authed,@Param('residentId') id:string,@Body() b:unknown){return this.saveResident(r,b,Number(id));}
 private saveResident(r:Authed,b:unknown,id?:number){const v=resident.parse(b);return locked(this.db,r.actor,async m=>{let before=null;
 if(id!==undefined){[before]=await m.query('SELECT * FROM residents WHERE id=? AND property_id=?',[id,r.actor.propertyId]);if(!before)throw new NotFoundException();await m.query('UPDATE residents SET name=?,active_from=?,active_to=?,weight=? WHERE id=?',[v.name,v.from,v.to,v.weight,id]);}
 else{id=(await m.query('INSERT INTO residents(name,active_from,active_to,weight,property_id) VALUES(?,?,?,?,?)',[v.name,v.from,v.to,v.weight,r.actor.propertyId])).insertId;}await audit(m,r.actor,'resident/'+id,'save',before,v);return {id};});}
 @Post(':id/meters') meter(@Req() r:Authed,@Body() b:unknown){const v=z.strictObject({code:z.string().regex(/^[a-z0-9_]{1,32}$/),label,unit:z.enum(['m³','kWh']),role:z.enum(['info','billed'])}).parse(b);return locked(this.db,r.actor,async m=>{if((await m.query('SELECT id FROM meters WHERE property_id=? AND code=?',[r.actor.propertyId,v.code])).length)throw new ConflictException('Ez a mérőkód foglalt.');const row=await m.query('INSERT INTO meters(property_id,code,label,unit,billing_role) VALUES(?,?,?,?,?)',[r.actor.propertyId,v.code,v.label,v.unit,v.role]);await audit(m,r.actor,'meter/'+row.insertId,'create',null,v);return {id:row.insertId};});}
 @Post(':id/tariffs') tariff(@Req() r:Authed,@Body() b:unknown){const v=tariff.parse(b);return locked(this.db,r.actor,async m=>{if(!(await m.query('SELECT id FROM meters WHERE id=? AND property_id=?',[v.meterId,r.actor.propertyId])).length)throw new NotFoundException();if((await m.query('SELECT id FROM tariff_versions WHERE meter_id=? AND valid_from=?',[v.meterId,v.from])).length)throw new ConflictException('Erre a kezdő hónapra már van díjszabás.');
 const row=await m.query('INSERT INTO tariff_versions(meter_id,valid_from,valid_to,rules_json) VALUES(?,?,?,?)',[v.meterId,v.from,v.to,JSON.stringify({role:v.role,bands:v.bands})]);await audit(m,r.actor,'tariff/'+row.insertId,'create',null,v);return {id:row.insertId};});}
 @Post(':id/charges') charge(@Req() r:Authed,@Body() b:unknown){const v=charge.parse(b);return locked(this.db,r.actor,async m=>{const row=await m.query('INSERT INTO recurring_charges(property_id,label,category,amount,valid_from,valid_to,allocation_rule) VALUES(?,?,?,?,?,?,?)',[r.actor.propertyId,v.label,v.category,v.amount,v.from,v.to,JSON.stringify(v.split)]);await audit(m,r.actor,'charge/'+row.insertId,'create',null,v);return {id:row.insertId};});}
}

