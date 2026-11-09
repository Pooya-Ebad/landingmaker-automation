import {db} from './store';
import {normalize,makeSlug,todayJalali} from './core';
import {analyzeName,canonicalGivenKey} from './name-transliterator';
db.exec('CREATE TABLE IF NOT EXISTS slug_memory(name TEXT PRIMARY KEY,blogger TEXT NOT NULL,latin TEXT NOT NULL,updated TEXT NOT NULL)');
db.exec('CREATE TABLE IF NOT EXISTS given_name_memory(name TEXT PRIMARY KEY,latin TEXT NOT NULL,updated TEXT NOT NULL)');
const nameKey=(name:string)=>normalize(name).replace(/[\u064b-\u065f\u0670\u0640]/g,'').toLowerCase();
export function suggestSlug(blogger:string,c:any,now=new Date()){
 const memory=db.prepare('SELECT latin FROM slug_memory WHERE name=?').get(nameKey(blogger)) as any;
 const slugDate=todayJalali(now);const suffix=makeSlug('x',slugDate,c).slice(1);
 const learned=Object.fromEntries(db.prepare('SELECT name,latin FROM given_name_memory').all().map((r:any)=>[r.name,r.latin]));
 const analysis=analyzeName(blogger,c.slug.dictionary,learned);
 const base=memory?memory.latin:analysis.latin;
 return {slug:base+suffix,slugDate,remembered:!!memory,slugAnalysis:{...analysis,givenLearned:analysis.source==='learned',source:memory?'memory':analysis.source,confidence:memory?'high':analysis.confidence,unknownParts:memory?[]:analysis.unknownParts,defaultSlug:analysis.latin+suffix,alternatives:analysis.alternatives.filter(v=>v!==base).map(v=>v+suffix)}};
}
export function rememberSlug(blogger:string,slug:string,slugDate:string){
 const name=nameKey(blogger);if(!name||name.length>200)throw new Error('نام بلاگر برای ذخیره املا معتبر نیست.');
 const date=normalize(slugDate);const match=date.match(/^\d{4}[/-](\d{1,2})[/-](\d{1,2})$/);
 if(!match||!makeSlug('x',date,{slug:{dictionary:{}}}))throw new Error('تاریخ مبنای اسلاگ مشخص نیست؛ دوباره پیش‌نمایش بگیرید.');
 const suffix=match[1].padStart(2,'0')+match[2].padStart(2,'0');
 if(!/^[a-z0-9]+$/.test(slug)||!slug.endsWith(suffix))throw new Error('برای یادگیری املا، ماه و روز انتهای اسلاگ را نگه دارید؛ اسلاگ دستی شما تغییر نکرد.');
 const latin=slug.slice(0,-4);if(!/^[a-z][a-z0-9]*$/.test(latin)||latin.length>200)throw new Error('بخش لاتین نام برای ذخیره در حافظه معتبر نیست.');
 db.prepare('INSERT INTO slug_memory VALUES(?,?,?,?) ON CONFLICT(name) DO UPDATE SET blogger=excluded.blogger,latin=excluded.latin,updated=excluded.updated').run(name,normalize(blogger),latin,new Date().toISOString());
 return {remembered:true,latin};
}
export function forgetSlug(blogger:string){db.prepare('DELETE FROM slug_memory WHERE name=?').run(nameKey(blogger));return {remembered:false};}
export function rememberGivenName(blogger:string,slug:string,slugDate:string,c:any){
 const analysis=analyzeName(blogger,c.slug.dictionary);if(!analysis.canLearnGiven||!/[آ-ی]/.test(analysis.givenName))throw new Error('تفکیک مطمئن نام کوچک و نام خانوادگی ممکن نیست؛ املای کامل همین بلاگر در حافظه قابل ذخیره است.');
 const date=normalize(slugDate);const probe=makeSlug('x',date,c);if(!probe||!slug.endsWith(probe.slice(1))||!/^[a-z0-9]+$/.test(slug))throw new Error('ماه و روز انتهای اسلاگ را نگه دارید.');
 const base=slug.slice(0,-4);if(!base.endsWith(analysis.familyLatin))throw new Error('املای نام خانوادگی هم تغییر کرده است؛ برای جلوگیری از یادگیری اشتباه فقط املای کامل این بلاگر ذخیره می‌شود.');
 const givenLatin=base.slice(0,-analysis.familyLatin.length);if(!/^[a-z]{2,80}$/.test(givenLatin))throw new Error('املای لاتین نام کوچک معتبر نیست.');
 db.prepare('INSERT INTO given_name_memory VALUES(?,?,?) ON CONFLICT(name) DO UPDATE SET latin=excluded.latin,updated=excluded.updated').run(canonicalGivenKey(analysis.givenName),givenLatin,new Date().toISOString());
 return {givenName:analysis.givenName,givenLatin};
}
export function forgetGivenName(blogger:string,c:any){const analysis=analyzeName(blogger,c.slug.dictionary);db.prepare('DELETE FROM given_name_memory WHERE name=?').run(canonicalGivenKey(analysis.givenName));return {remembered:false};}
