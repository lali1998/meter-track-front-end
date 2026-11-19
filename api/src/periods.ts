import {BadRequestException,Body,ConflictException,Controller,Get,Param,Post,Put,Req,UseGuards} from '@nestjs/common';
import {DataSource,EntityManager} from 'typeorm';
import {z} from 'zod';
import {Access,Authed} from './security';
import {audit,json,locked,month,split} from './property';
import {allocate,Band,meterBill,Resident,Split} from '../../shared/billing';
const value=z.string().regex(/^\d{1,10}([.,]\d{1,4})?$/).nullable();
const draft=z.strictObject({version:z.number().int().nonnegative(),readings:z.array(z.strictObject({id:z.number().int().positive(),previous:value,current:value,date:z.iso.date().nullable(),note:z.string().max(500),verified:z.boolean()})).max(100),extras:z.array(z.strictObject({label:z.string().trim().min(1).max(100),category:z.enum(['utility','rent','other']),amount:z.number().int().min(-1000000000).max(1000000000),split})).max(200)});
type Draft=z.infer<typeof draft>;
@Controller('properties/:id/periods') @UseGuards(Access)
export class Periods {
 constructor(private db:DataSource){}
 @Get() async list(@Req() r:Authed){return this.db.query('SELECT period_key month,status,version,result_json result FROM billing_periods WHERE property_id=? ORDER BY period_key DESC',[r.actor.propertyId]);}
 @Get(':key') async open(@Req() r:Authed,@Param('key') key:string){month.parse(key);const id=r.actor.propertyId;
 const [saved]=await this.db.query('SELECT status,version,input_json input,result_json result FROM billing_periods WHERE property_id=? AND period_key=?',[id,key]);
 const meters=await this.db.query('SELECT m.id,m.label,m.unit,(SELECT mr.current_value FROM meter_readings mr JOIN billing_periods p ON p.id=mr.period_id WHERE mr.meter_id=m.id AND p.period_key<? AND mr.current_value IS NOT NULL ORDER BY p.period_key DESC LIMIT 1) previous FROM meters m WHERE m.property_id=? ORDER BY m.id',[key,id]);
 return {meters,status:saved?.status??'missing',version:saved?.version??0,input:saved?.input??{readings:meters.map((m:{id:number;previous:string|null})=>({id:m.id,previous:m.previous,current:null,date:null,note:'',verified:false})),extras:[]},result:saved?.result??null};}
 private async compute(m:EntityManager,id:number,key:string,d:Draft){
 const people:Resident[]=await m.query('SELECT id,weight FROM residents WHERE property_id=? AND active_from<=? AND (active_to IS NULL OR active_to>=?) ORDER BY id',[id,key,key]);
 const meters=await m.query('SELECT m.*, (SELECT t.rules_json FROM tariff_versions t WHERE t.meter_id=m.id AND t.valid_from<=? AND (t.valid_to IS NULL OR t.valid_to>=?) ORDER BY t.valid_from DESC LIMIT 1) rules FROM meters m WHERE m.property_id=?',[key,key,id]);
 const charges=await m.query('SELECT label,category,amount,allocation_rule AS splitRule FROM recurring_charges WHERE property_id=? AND valid_from<=? AND (valid_to IS NULL OR valid_to>=?)',[id,key,key]);
 const items:{label:string;category:string;amount:number;allocation:Record<string,number>;detail:unknown}[]=[],warnings:string[]=[];
 const add=(label:string,category:string,amount:number,rule:Split,detail:unknown)=>items.push({label,category,amount,allocation:allocate(amount,people,rule),detail});
 if(new Set(d.readings.map(x=>x.id)).size!==d.readings.length||d.readings.some(x=>!meters.some((m:{id:number})=>m.id===x.id)))throw new BadRequestException('Ismeretlen vagy ismételt mérő.');
 try{for(const meter of meters){const reading=d.readings.find(v=>v.id===meter.id);
 if(!reading||reading.current===null||reading.previous===null){warnings.push(meter.label+' · Hiányzó állás');continue;}
 if(!reading.date||!reading.date.startsWith(key))warnings.push(meter.label+' · Ellenőrizd a dátumot');
 const rules=json<{role:'info'|'billed';bands:Band[]}>(meter.rules??{role:meter.billing_role,bands:[]});
 if(rules.role==='billed'&&!rules.bands.length){warnings.push(meter.label+' · Hiányzó díjszabás');continue;}
 const calc=meterBill(reading.previous,reading.current,rules.bands,rules.role);
 for(const item of calc.items)add(meter.label,'utility',item.amount,{mode:'weights'},{...item,meterId:meter.id,rules});}
 for(const c of charges)add(c.label,c.category,c.amount,json(c.splitRule),c);
 for(const c of d.extras)add(c.label,c.category,c.amount,c.split,c);
 }catch(e){throw new BadRequestException((e as Error).message);}
 const total=(category?:string)=>items.filter(i=>!category||i.category===category).reduce((s,i)=>s+i.amount,0);
 return {items,warnings,total:total(),utility:total('utility'),rent:total('rent'),other:total('other')};}
 @Post(':key/preview') preview(@Req() r:Authed,@Param('key') key:string,@Body() b:unknown){return this.compute(this.db.manager,r.actor.propertyId,month.parse(key),draft.parse(b));}
 @Put(':key') save(@Req() r:Authed,@Param('key') key:string,@Body() b:unknown){return this.persist(r,key,b,false);}
 @Post(':key/finalize') finalize(@Req() r:Authed,@Param('key') key:string,@Body() b:unknown){return this.persist(r,key,b,true);}
 private persist(r:Authed,key:string,b:unknown,final:boolean){month.parse(key);const d=draft.parse(b),id=r.actor.propertyId;
 return locked(this.db,r.actor,async m=>{const [old]=await m.query('SELECT * FROM billing_periods WHERE property_id=? AND period_key=?',[id,key]);
 if(old?.status==='final'||(old?.version??0)!==d.version)throw new ConflictException('Lezárt vagy időközben módosult hónap. Töltsd újra.');
 const result=await this.compute(m,id,key,d);if(final&&(result.warnings.length||!result.items.length))throw new BadRequestException(result.warnings.join(' · ')||'Üres hónap.');
 const status=final?'final':'draft', version=d.version+1;const input=JSON.stringify(d),snapshot=JSON.stringify(result);
 let periodId=old?.id;if(old){await m.query('UPDATE billing_periods SET status=?,version=?,input_json=?,result_json=?,finalized_at=IF(?,UTC_TIMESTAMP(),NULL) WHERE id=?',[status,version,input,snapshot,final,periodId]);await m.query('DELETE FROM meter_readings WHERE period_id=?',[periodId]);await m.query('DELETE FROM billing_items WHERE period_id=?',[periodId]);}
 else periodId=(await m.query('INSERT INTO billing_periods(property_id,period_key,status,version,input_json,result_json,finalized_at) VALUES(?,?,?,?,?,?,IF(?,UTC_TIMESTAMP(),NULL))',[id,key,status,version,input,snapshot,final])).insertId;
 for(const x of d.readings){const qty=x.previous!==null&&x.current!==null?meterBill(x.previous,x.current,[],'info').consumption:null;await m.query('INSERT INTO meter_readings VALUES(?,?,?,?,?,?)',[x.id,periodId,x.date,x.previous?.replace(',','.')??null,x.current?.replace(',','.')??null,qty]);}
 for(const item of result.items){const row=await m.query('INSERT INTO billing_items(period_id,category,label,amount,origin,snapshot) VALUES(?,?,?,?,?,?)',[periodId,item.category,item.label,item.amount,'calculated',JSON.stringify(item)]);for(const [resident,amount] of Object.entries(item.allocation))await m.query('INSERT INTO resident_allocations VALUES(?,?,?)',[row.insertId,resident,amount]);}
 await audit(m,r.actor,key,status,old?.input_json??null,d);return {version,status,result};});}
 @Post(':key/reopen') reopen(@Req() r:Authed,@Param('key') key:string,@Body() b:unknown){month.parse(key);const v=z.strictObject({version:z.number().int(),reason:z.string().trim().min(1).max(500)}).parse(b);return locked(this.db,r.actor,async m=>{const u=await m.query("UPDATE billing_periods SET status='draft',finalized_at=NULL,version=version+1 WHERE property_id=? AND period_key=? AND version=? AND status='final'",[r.actor.propertyId,key,v.version]);if(!u.affectedRows)throw new ConflictException();await audit(m,r.actor,key,'reopen',null,v);return {ok:true};});}
}

