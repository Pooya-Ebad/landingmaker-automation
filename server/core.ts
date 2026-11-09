import {normalize} from './persian-text';
export {normalize} from './persian-text';
import {analyzeName} from './name-transliterator';
export function parseRequest(raw:string,c:any){
 const fields:Record<string,string>={}; const unknown:Record<string,string>={};
 const looseLines:string[]=[];
 const aliases=Object.entries(c.parserAliases).flatMap(([key,values]:any)=>values.map((alias:string)=>({key,alias:normalize(alias)}))).sort((a,b)=>b.alias.length-a.alias.length);
 for(const line of raw.split(/\r?\n/)){
  const m=line.match(/^\s*(.+?)\s*[:：]\s*(.*?)\s*$/);
  if(m){const key=aliases.find(a=>a.alias===normalize(m[1]))?.key;(key?fields:unknown)[key||m[1]]=normalize(m[2]);continue;}
  const text=normalize(line);const match=aliases.find(a=>text.startsWith(a.alias+' '));
  if(match)fields[match.key]=text.slice(match.alias.length).trim();else if(text)looseLines.push(text);
 }
 if(!fields.supervisor){const candidates=[...new Set(looseLines.flatMap(line=>Object.keys(c.supervisors).filter(k=>[k,c.supervisors[k].label].some(label=>normalize(label)===line))))];if(candidates.length===1)fields.supervisor=c.supervisors[candidates[0]].label;}
 if(!fields.requestedType){const candidates=[...new Set(looseLines.filter(line=>/^\d{4,12}$/.test(line)))];if(candidates.length===1)fields.requestedType=candidates[0];}
 const company=Object.keys(c.companies).find(k=>[k,...c.companies[k].aliases].some((a:string)=>normalize(a).toLowerCase()===normalize(fields.company||'').toLowerCase()));
 const source=fields.category||fields.subject||'';const matches=Object.keys(c.landingPages).filter(k=>[c.landingPages[k].label,...(c.landingPages[k].aliases||[])].some(a=>normalize(source)===normalize(a)));
 const supervisor=Object.keys(c.supervisors).find(k=>[k,c.supervisors[k].label].some(a=>normalize(a)===normalize(fields.supervisor||'')));
 return {...fields,supervisor:supervisor||'',supervisorRaw:fields.supervisor||'',company:company||'',companyRaw:fields.company||'',category:matches.length===1?matches[0]:'',unknown,categoryConfidence:matches.length===1?1:0};
}
export function transliterate(name:string,dictionary:Record<string,string>={}){return analyzeName(name,dictionary).latin;}
export function makeSlug(name:string,date:string,c:any){const m=normalize(date).match(/^\d{4}[/-](\d{1,2})[/-](\d{1,2})$/);if(!m||+m[1]<1||+m[1]>12||+m[2]<1||+m[2]>(+m[1]<=6?31:30))return '';return transliterate(name,c.slug.dictionary)+m[1].padStart(2,'0')+m[2].padStart(2,'0');}
export function todayJalali(now:Date=new Date()){
 const parts=new Intl.DateTimeFormat('en-US-u-ca-persian',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 return ['year','month','day'].map(k=>parts.find(p=>p.type===k)?.value).join('/');
}
export function makeCurrentSlug(name:string,c:any,now:Date=new Date()){return makeSlug(name,todayJalali(now),c);}
export function duplicateCount(text:string):number {const t=normalize(text);const matches=[...t.matchAll(/با تایپ و توکن این لندینگ\s+(\d+)\s+لندینگ دیگر وجود دارد/g)];if(matches.length!==1)throw new Error('پیام کنترل تکراری بودن معتبر نیست؛ کپی انجام نشد.');const n=Number(matches[0][1]);if(!Number.isSafeInteger(n))throw new Error('تعداد نامعتبر؛ کپی انجام نشد.');return n;}
export function validatePage(url:string,provider='hamkadeh'){const u=new URL(url);const origin=provider==='hamkadeh'?'https://new.hamkadeh.com':provider==='moshavere'?'https://new.moshavere.me':'';if(u.origin!==origin||!/^\/dashboard\/showLandings\/newofcopy\/\d+$/.test(u.pathname)||u.search||u.hash||u.username||u.password)throw new Error('آدرس صفحه ساخت کپی با لندینگ‌ساز انتخاب‌شده مطابقت ندارد.');return u.href;}
function validateSecondaryPages(c:any){const urls=Object.values(c.landingPages).map((p:any)=>p.moshavereUrl).filter(Boolean);for(const url of urls)validatePage(String(url),'moshavere');if(new Set(urls).size!==urls.length)throw new Error('آدرس‌های مشاوره موضوع‌های مختلف باید متمایز باشند.');}
export function validateConfig(c:any){validateSecondaryPages(c);for(const k of ['general','marital','children','infidelity'])validatePage(c.landingPages[k].url);const urls=Object.values(c.landingPages).map((p:any)=>validatePage(p.url));if(new Set(urls).size!==urls.length)throw new Error('صفحات دسته‌بندی باید متمایز باشند.');for(const origin of [c.cdnOrigin,c.landingOrigin]){const u=new URL(origin);if(u.protocol!=='https:'||u.origin!==origin)throw new Error('دامنه باید HTTPS و بدون مسیر باشد.');}if(!c.browser||!['chromium','chrome','msedge'].includes(c.browser.channel)||c.browser.timeout<1000||c.browser.timeout>120000)throw new Error('تنظیمات مرورگر نامعتبر است.');if(c.browser.mode&&!['persistent','cdp'].includes(c.browser.mode))throw new Error('حالت مرورگر نامعتبر است.');if(c.browser.mode==='cdp'){const u=new URL(c.browser.cdpEndpoint);if(u.protocol!=='http:'||u.hostname!=='127.0.0.1'||!u.port||u.pathname!=='/'||u.search||u.hash||u.username||u.password)throw new Error('اتصال Chrome فقط به پورت محلی 127.0.0.1 مجاز است.');}}
