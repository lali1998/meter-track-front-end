// Import the Hungarian monthly ledger layout, preserving every source cell and block.
const Excel = require('exceljs');
const Zip = require('jszip');
const mysql = require('mysql2/promise');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
require('dotenv').config({quiet:true});
const months='januar februar marcius aprilis majus junius julius augusztus szeptember oktober november december'.split(' ');
const norm=s=>s.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().trim();
const number=v=>typeof v==='number'?v:typeof v==='string' && /^-?\d+(?:[.,]\d+)?(?:\s*(?:kwh|m3|m³|ft))?$/i.test(v.trim())?parseFloat(v.replace(',','.')):null;
async function run(){
 const file=process.argv[2],bytes=fs.readFileSync(file),hash=crypto.createHash('sha256').update(bytes).digest('hex');
 const zip=await Zip.loadAsync(bytes),w=new Excel.Workbook();await w.xlsx.load(bytes);
 let year=2022;const sheets=[];
 for(const sheet of w.worksheets){
  const parts=norm(sheet.name).split('.');if(parts.length===2)year=Number(parts[0])+(parts[0].length===2?2000:0);
  const month=months.indexOf(parts.at(-1).replace('oktouber','oktober'))+1;if(!month)throw Error(sheet.name);
  const key=year+'-'+String(month).padStart(2,'0'),rows=[],starts=[];
  const workbookXml=await zip.file('xl/workbook.xml').async('string');
  const sheetTag=workbookXml.match(/<sheet\s[^>]+>/g).find(tag=>tag.includes('sheetId="'+sheet.id+'"'));
  const rid=sheetTag.match(/r:id="([^"]+)"/)[1];
  const rels=await zip.file('xl/_rels/workbook.xml.rels').async('string');
  const target=rels.match(/<Relationship\s[^>]+>/g).find(tag=>tag.includes('Id="'+rid+'"')).match(/Target="([^"]+)"/)[1];
  const xml=await zip.file('xl/'+target).async('string');
  const cached=new Map();for(const match of xml.matchAll(/<c\b([^>]*?)(?<!\/)>([\s\S]*?)<\/c>/g)){const address=match[1].match(/\br="([^"]+)"/)?.[1],v=match[2].match(/<v>([^<]*)<\/v>/)?.[1];if(address&&v!==undefined&&v!==''&&Number.isFinite(Number(v)))cached.set(address,Number(v));}
  const val=(n,c)=>{const cell=sheet.getCell(n,c);return cell.type===Excel.ValueType.Formula?(cell.result??cached.get(cell.address)??null):cell.value;};
  sheet.eachRow((r,n)=>{const cells={};r.eachCell(cell=>{if(cell.type!==Excel.ValueType.Merge)cells[cell.address]={value:cell.value,format:cell.numFmt,resolved:val(n,cell.col)};});rows.push({n,cells});if(val(n,1)==='Vízóra')starts.push(n);});
  const blocks=starts.map((start,index)=>{const items=[],personal=[];let utility=null,total=null,rent=null;
   for(let n=start;n<(starts[index+1]??sheet.rowCount+1);n++){const label=String(val(n,1)??''),amount=number(val(n,6)),a=norm(label);
    if(a.startsWith('rezsi fizetendo'))utility=amount;else if(a.startsWith('osszesen fizetendo'))total=amount;
    else if(label&&amount!==null){items.push({row:n,label,amount,previous:number(val(n,2)),current:number(val(n,3)),quantity:number(val(n,4)),price:number(val(n,5)),category:a==='alberleti dij'?'rent':a==='internet'?'other':'utility'});if(a==='alberleti dij')rent=amount;}
    if(typeof val(n,8)==='string' && number(val(n,9))!==null)personal.push({label:val(n,8),amount:number(val(n,9)),row:n});
   }return {start,items,personal,total,rent,utility};});
  sheets.push({sheet:sheet.name,key,rows,blocks});
 }
 const db=await mysql.createConnection({host:process.env.DB_HOST,port:Number(process.env.DB_PORT),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD});
 const q=async(sql,args=[])=>(await db.execute(sql,args))[0];
 try{await db.beginTransaction();const access=await q("SELECT a.property_id id,a.user_id actor FROM property_access a JOIN users u ON u.id=a.user_id WHERE u.email='admin@rezsiflow.local' FOR UPDATE");if(access.length!==1)throw Error('Az ingatlan nem egyértelmű.');const {id,actor}=access[0];
 const existing=await q('SELECT id FROM import_batches WHERE property_id=? AND JSON_UNQUOTE(JSON_EXTRACT(mapping_json,\'$.hash\'))=?',[id,hash]);if(existing.length){console.log('Már importálva',existing);return;}
 const batch=(await q('INSERT INTO import_batches(property_id,source_filename,status,mapping_json) VALUES(?,?,?,?)',[id,path.basename(file),'imported',JSON.stringify({hash})])).insertId;
 const meters=await q('SELECT id,code FROM meters WHERE property_id=?',[id]);let entries=0,readingCount=0,itemCount=0;
 for(const s of sheets){let pid=null;
 if(s.blocks.length){const b=s.key==='2024-05'?s.blocks[0]:s.blocks.at(-1),readings=[],warnings=[];
 if(s.blocks.length>1)warnings.push('Több forrásblokk. Kiválasztott kezdősor: '+b.start);
 for(const [code,rx] of [['water',/^Vízóra$/],['electric',/^Villany éves .*ig$/i],['t1',/^Villany T1 15.8.1$/],['gas',/^Gáz alapdíj .*ig$/i]]){
 const item=b.items.find(i=>rx.test(i.label));if(!item||item.previous===null||item.current===null)continue;
 if(item.current<item.previous)warnings.push(item.label+' · csökkenő állás');
 readings.push({id:meters.find(m=>m.code===code).id,previous:String(item.previous),current:String(item.current),date:null,note:'Excel '+s.sheet+' / '+item.row,verified:false});}
 const items=b.items.map(i=>({...i,allocation:{},origin:'imported'})),result={items,warnings,total:b.total,rent:b.rent,utility:b.utility,other:b.total!==null&&b.rent!==null&&b.utility!==null?+(b.total-b.rent-b.utility).toFixed(2):null,personal:b.personal,sourceBlock:b.start};
 if((await q('SELECT id FROM billing_periods WHERE property_id=? AND period_key=?',[id,s.key])).length)throw Error('Foglalt hónap: '+s.key);
 pid=(await q('INSERT INTO billing_periods(property_id,period_key,status,version,input_json,result_json) VALUES(?,?,?,1,?,?)',[id,s.key,'imported',JSON.stringify({readings,extras:[]}),JSON.stringify(result)])).insertId;
 for(const r of readings){await q('INSERT INTO meter_readings VALUES(?,?,NULL,?,?,?)',[r.id,pid,r.previous,r.current,Number(r.current)-Number(r.previous)]);readingCount++;}
 for(const i of items){await q('INSERT INTO billing_items(period_id,category,label,amount,origin,snapshot) VALUES(?,?,?,?,?,?)',[pid,i.category,i.label,Math.round(i.amount),'imported',JSON.stringify(i)]);itemCount++;}entries++;
 }
 await q('INSERT INTO import_rows(batch_id,period_key,period_id,original_json,parsed_json) VALUES(?,?,?,?,?)',[batch,s.key,pid,JSON.stringify({name:s.sheet,rows:s.rows}),JSON.stringify(s.blocks)]);
 }
 await q('INSERT INTO audit_logs(property_id,actor_id,entity_key,action,after_json) VALUES(?,?,?,?,?)',[id,actor,'import/'+batch,'import',JSON.stringify({entries,readingCount,itemCount,hash})]);
 const [check]=await q('SELECT COUNT(*) sheets,COUNT(p.id) periods,SUM(JSON_LENGTH(i.parsed_json)) blocks,SUM(JSON_LENGTH(i.original_json,\'$.rows\')) sourceRows FROM import_rows i LEFT JOIN billing_periods p ON p.id=i.period_id WHERE batch_id=?',[batch]);
 if(check.periods!==entries||check.sheets!==sheets.length)throw Error('Ellenőrzési hiba');await db.commit();console.log({batch,...check,readingCount,itemCount});
 }catch(e){await db.rollback();throw e;}finally{await db.end();}
}
run().catch(e=>{console.error(e.code||e.message);process.exitCode=1;});
