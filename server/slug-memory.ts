import {db} from './store';
import {normalize,makeSlug,todayJalali} from './core';
db.exec('CREATE TABLE IF NOT EXISTS slug_memory(name TEXT PRIMARY KEY,blogger TEXT NOT NULL,latin TEXT NOT NULL,updated TEXT NOT NULL)');
const nameKey=(name:string)=>normalize(name).replace(/[\u064b-\u065f\u0670\u0640]/g,'').toLowerCase();
export function suggestSlug(blogger:string,c:any,now=new Date()){
 const memory=db.prepare('SELECT latin FROM slug_memory WHERE name=?').get(nameKey(blogger)) as any;
 const slugDate=todayJalali(now);const suffix=makeSlug('x',slugDate,c).slice(1);
 return {slug:memory?memory.latin+suffix:makeSlug(blogger,slugDate,c),slugDate,remembered:!!memory};
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
