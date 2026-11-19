import source from './database';
import * as argon2 from 'argon2';
import {randomBytes} from 'node:crypto';
import {writeFileSync,existsSync} from 'node:fs';
import {z} from 'zod';
async function run(){const email=z.email().parse(process.argv[2]||'admin@rezsiflow.local').toLowerCase();
 const password=process.env.BOOTSTRAP_PASSWORD||randomBytes(24).toString('base64url');if(password.length<12||password.length>256)throw new Error('12–256 karakteres jelszó szükséges.');
 const local=!process.env.BOOTSTRAP_PASSWORD;if(local&&existsSync('admin.local'))throw new Error('Az admin.local már létezik. Használd a meglévő fiókot vagy adj meg BOOTSTRAP_PASSWORD értéket.');
 await source.initialize();try{await source.transaction(async m=>{
 const hash=await argon2.hash(password,{type:argon2.argon2id});const u=await m.query('INSERT INTO users(email,password_hash) VALUES(?,?)',[email,hash]);
 const p=await m.query('INSERT INTO properties(name) VALUES(?)',['Otthonom']);await m.query('INSERT INTO property_access VALUES(?,?)',[u.insertId,p.insertId]);
 for(const name of ['Lakó 1','Lakó 2'])await m.query('INSERT INTO residents(property_id,name,active_from) VALUES(?,?,?)',[p.insertId,name,'2022-09']);
 for(const [code,label,unit,role] of [['water','Víz','m³','billed'],['electric','Villany','kWh','billed'],['t1','Villany T1 15.8.1','kWh','info'],['gas','Gáz','m³','billed']])await m.query('INSERT INTO meters(property_id,code,label,unit,billing_role) VALUES(?,?,?,?,?)',[p.insertId,code,label,unit,role]);
 if(local)writeFileSync('admin.local',email+'\n'+password+'\n',{flag:'wx',mode:0o600});});console.log(local?'Helyi belépési adatok az api/admin.local fájlban.':'Fiók és ingatlan létrehozva.');}finally{await source.destroy();}}
run().catch(e=>{console.error('Az admin létrehozása sikertelen.',e.code||e.message);process.exitCode=1;});

