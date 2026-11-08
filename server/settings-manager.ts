import {randomUUID} from 'node:crypto';
import {config,db,locked,seal} from './store';
import {validateConfig} from './core';
import {normalize} from './core';
export function selectedToken(c:any,supervisor:string,company:string,tokenId?:string){
 if(tokenId){const t=c.tokenEntries?.[tokenId];if(t?.supervisor!==supervisor||t.company!==company)throw new Error('توکن انتخاب‌شده متعلق به این سرپرست و شرکت نیست.');return t.secret;}
 return c.tokens[supervisor]?.[company];
}
export function saveToken(input:{mode:'add'|'replace';supervisor:string;company?:string;companyName?:string;value:string;label?:string;tokenId?:string}){
 if(locked())throw new Error('ابتدا عملیات فعال را تمام کنید.');
 const c=config();const {supervisor,value,mode,tokenId}=input;let company=input.company||'';
 if(mode==='add'&&input.companyName){const name=normalize(input.companyName);if(!name||name.length>80)throw new Error('نام شرکت جدید معتبر نیست.');
  if(Object.entries(c.companies).some(([id,v]:any)=>[id,v.label,...v.aliases||[]].some((s:string)=>normalize(s).toLowerCase()===name.toLowerCase())))throw new Error('این شرکت قبلاً ثبت شده است؛ از جایگزینی توکن استفاده کنید.');
  company='company_'+randomUUID().replaceAll('-','');c.companies[company]={label:name,aliases:[name]};
 }
 if(!c.supervisors[supervisor]||!c.companies[company]||!/^[a-zA-Z0-9_-]{8,128}$/.test(value))throw new Error('سرپرست، شرکت یا توکن معتبر نیست.');
 if(mode==='replace'){
  if(!selectedToken(c,supervisor,company,tokenId))throw new Error('توکنی برای جایگزینی انتخاب نشده است.');
  if(tokenId)c.tokenEntries[tokenId].secret=seal(value);else c.tokens[supervisor][company]=seal(value);
 }else if(input.companyName){c.tokens[supervisor]??={};c.tokens[supervisor][company]=seal(value);
 }else{
  c.tokenEntries??={};const label=input.label?.trim();if(!label||label.length>80)throw new Error('برای توکن جدید نامی حداکثر ۸۰ حرف وارد کنید.');
  if(Object.values(c.tokenEntries).some((t:any)=>t.supervisor===supervisor&&t.company===company&&t.label===label))throw new Error('این نام توکن قبلاً ثبت شده است.');
  c.tokenEntries[randomUUID()]={supervisor,company,label,secret:seal(value)};
 }
 db.prepare('UPDATE settings SET value=? WHERE id=1').run(JSON.stringify(c));
}
export function saveReferences(landingPages:any){
 if(locked())throw new Error('ابتدا عملیات فعال را تمام کنید.');
 if(!landingPages||Object.keys(landingPages).length>50||['general','marital','children','infidelity'].some(k=>!landingPages[k]))throw new Error('چهار مرجع اصلی باید حفظ شوند و حداکثر ۵۰ مرجع مجاز است.');
 const labels=Object.values(landingPages).map((p:any)=>p.label.trim());if(new Set(labels).size!==labels.length)throw new Error('نام مرجع‌ها باید متفاوت باشد.');
 const c=config();c.landingPages=landingPages;validateConfig(c);db.prepare('UPDATE settings SET value=? WHERE id=1').run(JSON.stringify(c));
}
