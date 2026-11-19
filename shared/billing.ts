/** Mérőállás és egységár négy tizedesjeggyel. A sávszélesség az adott sávra értendő. */
const scale = 10000n;
function units(input: string): bigint {
  const normalized = input.trim().replace(',', '.');
  if (!/^\d{1,10}(\.\d{1,4})?$/.test(normalized)) throw new Error('Érvénytelen mérőállás vagy tarifa.');
  const [whole, fraction = ''] = normalized.split('.');
  return BigInt(whole) * scale + BigInt(fraction.padEnd(4,'0'));
}
export interface Band {limit:string|null; price:string}
export function meterBill(previous:string,current:string,bands:Band[],role:'info'|'billed'){
  const consumption=units(current)-units(previous);
  if(consumption<0n)throw new Error('A mérőállás csökkent.');
  let remaining=consumption;
  const items:{quantity:number;price:string;amount:number}[]=[];
  if(role==='billed'){
    if(!bands.length || bands.at(-1)?.limit!==null)throw new Error('Hiányzik a záró díjsáv.');
    for(const [index,band] of bands.entries()){
      if(band.limit===null && index!==bands.length-1)throw new Error('Csak az utolsó sáv lehet korlátlan.');
      const limit=band.limit===null?remaining:units(band.limit);
      if(band.limit!==null && limit===0n)throw new Error('A sávszélesség legyen pozitív.');
      const quantity=remaining<limit?remaining:limit;
      const amount=Number((quantity*units(band.price)+scale*scale/2n)/(scale*scale));
      if(!Number.isSafeInteger(amount)||amount>2147483647)throw new Error('A tétel összege túl nagy.');
      if(quantity>0n || (consumption===0n && index===0))items.push({quantity:Number(quantity)/Number(scale),price:band.price,amount});
      remaining-=quantity;
    }
  }
  return {consumption:Number(consumption)/Number(scale),items};
}
export interface Resident {id:number;weight:number}
export type Split={mode:'equal'|'weights'}|{mode:'exclusive';resident:number}|{mode:'percent'|'fixed';values:Record<string,number>};
export function allocate(amount:number,people:Resident[],rule:Split):Record<string,number>{
  if(!people.length||!Number.isSafeInteger(amount))throw new Error('Érvénytelen összeg vagy üres lakólista.');
  const residents=[...people].sort((a,b)=>a.id-b.id);
  if('values' in rule && Object.keys(rule.values).some(id=>!residents.some(r=>String(r.id)===id)))throw new Error('Ismeretlen lakó.');
  const weights=residents.map(r=>rule.mode==='equal'?1:rule.mode==='weights'?r.weight:rule.mode==='exclusive'?Number(r.id===rule.resident):'values' in rule?rule.values[r.id]??0:0);
  if(weights.some(w=>!Number.isSafeInteger(w)||w<0))throw new Error('Érvénytelen megosztás.');
  const sum=weights.reduce((a,b)=>a+b,0);
  if(rule.mode==='percent' && sum!==100 || rule.mode==='fixed' && sum!==Math.abs(amount) || sum===0 && !(rule.mode==='fixed' && amount===0))throw new Error('A megosztás összege hibás.');
  const shares=weights.map(w=>sum?Number(BigInt(Math.abs(amount))*BigInt(w)/BigInt(sum)):0);
  let rest=Math.abs(amount)-shares.reduce((a,b)=>a+b,0);
  for(let i=0;i<shares.length && rest;i++)if(weights[i]){shares[i]++;rest--;}
  return Object.fromEntries(residents.map((r,i)=>[r.id,shares[i]?Math.sign(amount)*shares[i]:0]));
}

