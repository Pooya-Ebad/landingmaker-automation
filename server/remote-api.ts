import {readFileSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import type {RemoteSession} from './remote-session';
import {validatePage} from './core';
import {BuildError} from './adapters';
import {providers,target,type Provider} from './providers';
export type Fetcher=(url:string,init?:RequestInit)=>Promise<Response>;
const record=(v:any)=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const decodeParams=(v:any)=>{try{const p=typeof v==='string'?JSON.parse(v):structuredClone(v);if(!record(p))throw new Error();return p;}catch{throw new BuildError('ساختار پارامترهای قالب تغییر کرده است؛ عملیات متوقف شد.');}};
const hash=(v:Buffer)=>createHash('sha256').update(v).digest('hex');
export function parseCount(j:any){const raw=j?.data?.count;if(j?.status!==true&&j?.status!==1)throw new BuildError('پاسخ کنترل تکراری بودن معتبر نیست؛ ساخت انجام نشد.');if(!(typeof raw==='number'||typeof raw==='string'&&/^\d+$/.test(raw)))throw new BuildError('تعداد تکراری قابل تشخیص نیست؛ ساخت انجام نشد.');const n=Number(raw);if(!Number.isSafeInteger(n)||n<0)throw new BuildError('تعداد تکراری نامعتبر است.');return n;}
export function creationFields(base:any,d:any,groupId:number,userId:number,image:string,token:string){
 if(!record(base)||!Number.isSafeInteger(base.template_id)||!record(base.parameter_group)||!Array.isArray(base.parameter_group.variants))throw new BuildError('ساختار قالب پیشرفته با نگاشت برنامه مطابقت ندارد.');
 const params=decodeParams(base.parameters);if(!('type' in params)||!('token' in params)||!('mainPic' in params))throw new BuildError('ملزومات قالب ناقص است.');
 Object.assign(params,{baseAndMainTitle:d.title,type:String(d.type),token,mainPic:image});
 for(const k of ['subjectSelect','labelSelect'])if(params[k]===undefined)params[k]='';
 const location=params.hamkadehOrNot??params.HamkadehOrNot;
 if(location===''&&params.labelSelect==='')throw new BuildError('برچسب و موضوع اجباری قالب باید مشخص شوند.');
 if(params.labelSelect!==''&&params.subjectSelect==='')throw new BuildError('موضوع متناظر برچسب قالب مشخص نیست.');
 const fields:Record<string,string>={title:d.title,slug:d.slug,access_group_id:String(groupId),description:'',parameters:JSON.stringify(params),template_id:String(base.template_id),user_id:String(userId),is_child:String(base.is_child??0),type:String(d.type),token};
 const pg=base.parameter_group;const first=pg.variants.filter((v:any)=>Number(v.priority)===1);
 if(first.length!==1)throw new BuildError('پارامتر اصلی قالب یکتا نیست.');
 if(pg.CTR_target!==undefined&&pg.CTR_target!=='')fields['parameter_group[CTR_target]']=String(pg.CTR_target);
 fields['parameter_group[change_type]']=String(pg.change_type??'view_change');
 const variants=pg.variants.filter((v:any)=>Number(v.priority)!==1);
 variants.forEach((v:any,index:number)=>{
  const p=decodeParams(v.parameters);Object.assign(p,{type:String(d.type),token});if(index===0)p.mainPic='';
  fields[`parameter_group[variants][${index}][parameters]`]=JSON.stringify(p);
  for(const k of ['priority','time_change','view_change'])if(v[k])fields[`parameter_group[variants][${index}][${k}]`]=String(v[k]);
 });
 const lg=base.landing_group?.[0];
 if(lg?.groups?.some((g:any)=>Number(g.pivot?.priority)!==1)&&Number(base.is_child)!==1){
  if(lg.CTR_target)fields['landing_group[CTR_target]']=String(lg.CTR_target);fields['landing_group[change_type]']=String(lg.change_type||'view_change');
  lg.groups.filter((g:any)=>Number(g.pivot?.priority)!==1).forEach((g:any,i:number)=>{for(const [k,v] of Object.entries({id:g.landing_id,priority:g.pivot?.priority,time_change:g.pivot?.time_change,view_change:g.pivot?.view_change}))if(v)fields[`landing_group[landings][${i}][${k}]`]=String(v);});
 }
 const root=lg?.groups?.find((g:any)=>Number(g.pivot?.priority)===1)?.pivot;
 const time=base.time_change||root?.time_change;if(time)fields.time_change=String(time);
 const change=base.parameter_change||first[0].view_change||first[0].time_change;if(change)fields.parameter_change=String(change);
 const view=base.view_change||root?.view_change;if(view)fields.view_change=String(view);
 const subjects=params.subjectSelect!==''?{landing_token:token,location:params.HamkadehOrNot===''?'hamkadeh':String(params.HamkadehOrNot)==='1'?'old_5040':'5040',type:String(d.type),subject:params.subjectSelect,...(params.labelSelect!==''?{label:params.labelSelect}:{})}:null;
 return {fields,subjects};
}
export class HamkadehHttp {
 constructor(private session:RemoteSession,private c:any,private send:Fetcher=fetch,private provider:Provider='hamkadeh'){}
 private async request(endpoint:string,init:RequestInit={}){
  let r:Response;try{r=await this.send(providers[this.provider].api+endpoint,{...init,headers:{Accept:'application/json',Authorization:'Bearer '+this.session.token,...init.headers},redirect:'manual',signal:AbortSignal.timeout(45000)});}catch{throw new BuildError('ارتباط با API لندینگ‌ساز برقرار نشد.');}
  if(r.status===401||r.status===403)throw new BuildError('نشست ورود یا مجوز همکده معتبر نیست؛ اتصال حساب را تازه کنید.');
  let j:any;try{j=await r.json();}catch{throw new BuildError('پاسخ API همکده قابل تشخیص نیست.');}
  if(!r.ok||!(j?.status===true||j?.status===1))throw new BuildError('API همکده درخواست را تأیید نکرد؛ اطلاعات و نشست را بررسی کنید.');return j;
 }
 private post(endpoint:string,body:any){return this.request(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});}
 async health(){const user=await this.request('/profile/current-user');if(Number(user.data?.id)!==this.session.userId)throw new BuildError('حساب متصل‌شده با نشست ذخیره‌شده یکسان نیست.');return {hamkadeh:true};}
 async count(type:number,token:string){return parseCount(await this.post('/landing/get-token-type-count',{type:String(type),token}));}
 async plan(d:any,token:string,image:string){
  const selected=target(d,this.c);if(selected.id!==this.provider)throw new BuildError('نشست ورود با لندینگ‌ساز انتخاب‌شده مطابقت ندارد.');const id=selected.url.split('/').pop();
  const base=(await this.request('/landing/show/'+id+'?relations[]=groups&relations[]=parameterGroup.variants')).data;
  const groups=(await this.request('/access-group/get-user-list?title='+encodeURIComponent(this.c.supervisors[d.supervisor].group))).data;
  if(!Array.isArray(groups))throw new BuildError('فهرست گروه‌های سایت معتبر نیست.');
  const group=groups.filter(g=>g.title===this.c.supervisors[d.supervisor].group);if(group.length!==1||!Number.isSafeInteger(group[0].id))throw new BuildError('گروه متناظر سرپرست در سایت یکتا نیست.');
  const payload=creationFields(base,d,group[0].id,this.session.userId,image,token);
  const count=await this.count(d.type,token);if(count>0)throw new BuildError('ترکیب تایپ و توکن تکراری است؛ ساخت انجام نشد.',false,{count,viewLinks:[selected.dashboard+'/dashboard/showLandings?type='+d.type]});
  return payload;
 }
 async commit(d:any,token:string,payload:ReturnType<typeof creationFields>,onCommit:()=>void){
  const selected=target(d,this.c);if(selected.id!==this.provider)throw new BuildError('نشست ورود با لندینگ‌ساز انتخاب‌شده مطابقت ندارد.');
  if(await this.count(d.type,token)!==0)throw new BuildError('ترکیب تایپ و توکن تکراری شده است؛ ساخت انجام نشد.');
  onCommit();let created:any;
  try{
   if(payload.subjects)await this.post('/landing/send-landing-subjects',payload.subjects);
   const form=new FormData();for(const [k,v] of Object.entries(payload.fields))form.append(k,v);
   created=await this.request('/landing/create',{method:'POST',body:form});
   let id=created.data?.id;
   if(!Number.isSafeInteger(id)){const list=(await this.request('/landing/search-landing?title='+encodeURIComponent(d.title))).data;const exact=Array.isArray(list)?list.filter(x=>x.title===d.title):[];if(exact.length!==1)throw new Error();id=exact[0].id;}
   if(!Number.isSafeInteger(id))throw new Error();const record=(await this.request('/landing/show/'+id)).data;
   const p=decodeParams(record.parameters);
   if(record.title!==d.title||record.slug!==d.slug||String(p.type)!==String(d.type)||p.token!==token)throw new Error();
   return {url:selected.landing+'/'+d.slug,imageUrl:JSON.parse(payload.fields.parameters).mainPic,remoteId:id,createdAt:new Date().toISOString(),evidence:'api-create-and-authenticated-readback',builder:selected.id};
  }catch{throw new BuildError('درخواست ثبت ارسال شد اما نتیجه قطعی نیست؛ قبل از تلاش مجدد نتیجه را در سایت بررسی کنید.',true);}
 }
 async upload(file:string){
  const bytes=readFileSync(file);const cookies=this.session.cdnCookies;if(cookies.length!==2||cookies.some(c=>c.expires>0&&c.expires*1000<Date.now()))throw new BuildError('نشست CDN منقضی شده است.');
  const cookie=cookies.map(c=>c.name+'='+c.value).join('; ');const headers={Cookie:cookie,'X-Hfs-Anti-Csrf':'1'};
  // Request path chooses the upload destination; output always uses server uri.
  const destination=this.c.cdnOrigin+'/'+encodeURIComponent(path.basename(file))+'?mtime='+Math.floor(statSync(file).mtimeMs)+'&resume=0!';
  let response:Response;try{response=await this.send(destination,{method:'PUT',headers:{...headers,'Content-Type':'application/octet-stream'},body:bytes,redirect:'manual',signal:AbortSignal.timeout(60000)});}catch{throw new BuildError('نتیجه آپلود مشخص نیست؛ پیش از آپلود مجدد CDN را بررسی کنید.');}
  if(!response.ok)throw new BuildError('CDN آپلود را تأیید نکرد؛ نشست و مجوز آپلود را بررسی کنید.');
  let j:any;try{j=await response.json();}catch{throw new BuildError('CDN لینک خروجی معتبری برنگرداند.');}
  if(typeof j.uri!=='string'||!j.uri.startsWith('/')||j.uri.startsWith('//'))throw new BuildError('آدرس خروجی CDN قابل تشخیص نیست.');
  const url=new URL(j.uri,this.c.cdnOrigin);if(url.origin!==this.c.cdnOrigin||url.hash||url.username||url.password)throw new BuildError('دامنه خروجی CDN معتبر نیست.');
  const image=await this.send(url.href,{headers,redirect:'manual',signal:AbortSignal.timeout(30000)});
  if(!image.ok||!image.headers.get('content-type')?.startsWith('image/')||hash(Buffer.from(await image.arrayBuffer()))!==hash(bytes))throw new BuildError('فایل آپلودشده با بنر اصلی مطابقت ندارد.');return url.href;
 }
}
