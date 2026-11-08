import {readFileSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import type {RemoteSession} from './remote-session';
import {validatePage} from './core';
import {BuildError} from './adapters';
import {providers,target,type Provider} from './providers';
import {imageFormat} from './image-format';
import {uploadTrace,writeUploadEvent,type UploadLog} from './upload-diagnostics';
import {siteErrorDetails,requestSecrets} from './site-errors';
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
 private errorSecrets=new Set<string>();
 constructor(private session:RemoteSession,private c:any,private send:Fetcher=fetch,private provider:Provider='hamkadeh',private diagnostics?:{jobId?:string;log?:UploadLog}){}
 private async request(endpoint:string,init:RequestInit={}){
  for(const value of requestSecrets(init.body))this.errorSecrets.add(value);
  let r:Response;try{r=await this.send(providers[this.provider].api+endpoint,{...init,headers:{Accept:'application/json',Authorization:'Bearer '+this.session.token,...init.headers},redirect:'manual',signal:AbortSignal.timeout(45000)});}catch{throw new BuildError('ارتباط با API لندینگ‌ساز برقرار نشد.');}
  let j:any;try{j=await r.json();}catch{const details=siteErrorDetails(null,r.status,this.provider,endpoint.split('?')[0],[]);throw new BuildError('پاسخ سایت قابل تشخیص نیست (HTTP '+r.status+').',false,{siteError:details});}
  if(!r.ok||!(j?.status===true||j?.status===1)){
   const secrets=[this.session.token,...this.session.cdnCookies.map(c=>c.value),...this.errorSecrets];
   const details=siteErrorDetails(j,r.status,this.provider,endpoint.split('?')[0],secrets);
   const createRejected=endpoint==='/landing/create'&&(j?.status===false||j?.status===0)&&[200,400,409,422].includes(r.status)&&!j?.data?.id;
   const reason=details.messages[0]||details.validation[0]?.message||(r.status===401||r.status===403?'نشست ورود یا مجوز معتبر نیست؛ اتصال حساب را تازه کنید.':'سایت درخواست را تأیید نکرد.');
   throw new BuildError('پاسخ خطای سایت (HTTP '+r.status+'): '+reason,false,{siteError:details,...(createRejected?{retryAllowed:true}:{})});
  }return j;
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
  }catch(e){if(e instanceof BuildError&&e.details?.siteError)throw new BuildError(e.message+(e.details.retryAllowed?' می‌توانید اطلاعات همین سفارش را اصلاح کنید.':' نتیجه نهایی ثبت باید پیش از تلاش مجدد بررسی شود.'),!e.details.retryAllowed,e.details);throw new BuildError('درخواست ثبت ارسال شد اما نتیجه قطعی نیست؛ قبل از تلاش مجدد نتیجه را در سایت بررسی کنید.',true);}
 }
 async upload(file:string){
  const trace=uploadTrace(this.provider,this.diagnostics?.jobId,this.diagnostics?.log??(this.send===fetch?writeUploadEvent:()=>{}));
  const fail=(code:string,stage:string,message:string):never=>{trace.emit('failed',{code,stage});throw new BuildError(message+' [شناسه پیگیری: '+trace.traceId+']',false,{uploadDiagnostic:{...trace.snapshot(),code,stage}});};
  const mime=(r:Response)=>{const m=(r.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();return /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(m)?m:'unknown';};
  const networkKind=(e:unknown)=>e instanceof Error&&e.name==='TimeoutError'?'timeout':e instanceof Error&&e.name==='AbortError'?'aborted':'transport';
  let bytes:Buffer,mtime:number;try{bytes=readFileSync(file);mtime=Math.floor(statSync(file).mtimeMs);}catch{return fail('LOCAL_FILE_READ','local','خواندن فایل بنر ممکن نیست.');}
  const format=imageFormat(bytes);if(!format)return fail('LOCAL_IMAGE_FORMAT','local','فرمت واقعی بنر JPG، PNG یا WebP نیست.');
  const expectedHash=hash(bytes);const filename=path.parse(path.basename(file)).name+format.extension;
  trace.emit('local_image',{localBytes:bytes.length,localHash:expectedHash,format:format.mime,extension:format.extension,sourceHadExtension:!!path.extname(file)});
  const cookies=this.session.cdnCookies;if(cookies.length!==2||cookies.some(c=>c.expires>0&&c.expires*1000<Date.now()))return fail('CDN_SESSION_EXPIRED','session','نشست CDN منقضی شده است؛ اتصال حساب را تازه کنید.');
  const cookie=cookies.map(c=>c.name+'='+c.value).join('; ');const headers={Cookie:cookie,'X-Hfs-Anti-Csrf':'1'};
  // Storage files have random extensionless names. CDN requests use the verified image extension.
  const destination=this.c.cdnOrigin+'/'+encodeURIComponent(filename)+'?mtime='+mtime+'&resume=0!';
  trace.emit('upload_request',{extension:format.extension});
  let response:Response;try{response=await this.send(destination,{method:'PUT',headers:{...headers,'Content-Type':format.mime},body:new Uint8Array(bytes),redirect:'manual',signal:AbortSignal.timeout(60000)});}catch(e){trace.emit('network_error',{stage:'upload',networkKind:networkKind(e)});return fail('CDN_UPLOAD_NETWORK','upload','نتیجه آپلود مشخص نیست؛ پیش از آپلود مجدد CDN را بررسی کنید.');}
  trace.emit('upload_response',{status:response.status,contentType:mime(response)});
  if(!response.ok)return fail('CDN_UPLOAD_HTTP','upload','CDN آپلود را تأیید نکرد (HTTP '+response.status+'). نشست و مجوز آپلود را بررسی کنید.');
  let j:any;try{j=await response.json();}catch{return fail('CDN_UPLOAD_JSON','upload','CDN پاسخ JSON و لینک خروجی معتبر برنگرداند.');}
  if(typeof j?.uri!=='string'||!j.uri.startsWith('/')||j.uri.startsWith('//'))return fail('CDN_OUTPUT_URI','url','آدرس خروجی CDN قابل تشخیص نیست.');
  let url:URL;try{url=new URL(j.uri,this.c.cdnOrigin);}catch{return fail('CDN_OUTPUT_URI','url','آدرس خروجی CDN قابل تشخیص نیست.');}
  if(url.origin!==this.c.cdnOrigin||url.hash||url.username||url.password)return fail('CDN_OUTPUT_ORIGIN','url','دامنه خروجی CDN معتبر نیست.');
  trace.emit('download_request',{pathHash:hash(Buffer.from(url.pathname)),hasQuery:!!url.search});
  let image:Response;try{image=await this.send(url.href,{headers,redirect:'manual',signal:AbortSignal.timeout(30000)});}catch(e){trace.emit('network_error',{stage:'download',networkKind:networkKind(e)});return fail('CDN_IMAGE_NETWORK','download','بنر آپلود شد اما دریافت لینک برگشتی برای بررسی ممکن نشد؛ آپلود را خودکار تکرار نکنید.');}
  const contentType=mime(image);trace.emit('download_response',{status:image.status,contentType});
  if(!image.ok)return fail('CDN_IMAGE_HTTP','download','لینک بنر برگشتی از CDN قابل دریافت نیست (HTTP '+image.status+').');
  let downloaded:Buffer;try{downloaded=Buffer.from(await image.arrayBuffer());}catch(e){trace.emit('network_error',{stage:'body',networkKind:networkKind(e)});return fail('CDN_IMAGE_BODY','download','دریافت محتوای بنر از CDN کامل نشد.');}
  const receivedHash=hash(downloaded),matches=expectedHash===receivedHash;
  trace.emit('comparison',{localBytes:bytes.length,receivedBytes:downloaded.length,localHash:expectedHash,receivedHash,hashMatches:matches,contentType});
  if(!contentType.startsWith('image/'))return fail('CDN_IMAGE_MIME','verify','CDN فایل را با نوع تصویر برنگرداند ('+contentType+'). '+(matches?'محتوای فایل با بنر اصلی برابر است؛ مشکل از نوع فایل برگشتی است.':'محتوای دریافتی نیز با بنر اصلی برابر نیست.'));
  if(!matches)return fail('CDN_IMAGE_HASH','verify','محتوای فایل دریافتی از CDN با بنر اصلی متفاوت است؛ لندینگ ساخته نشد.');
  trace.emit('verified',{receivedBytes:downloaded.length,contentType,hashMatches:true});return url.href;
 }
 async verifyCachedImage(file:string,imageUrl:string){
  const trace=uploadTrace(this.provider,this.diagnostics?.jobId,this.diagnostics?.log??(this.send===fetch?writeUploadEvent:()=>{}));
  const fail=(code:string,message:string):never=>{trace.emit('failed',{code,stage:'reuse'});throw new BuildError(message+' بنر دوباره آپلود نشد.',false,{uploadDiagnostic:{...trace.snapshot(),code,stage:'reuse'}});};
  let url:URL;try{url=new URL(imageUrl);}catch{return fail('CDN_CACHE_URL','آدرس بنر ذخیره‌شده معتبر نیست.');}
  if(url.origin!==this.c.cdnOrigin||url.username||url.password||url.hash)return fail('CDN_CACHE_URL','آدرس بنر ذخیره‌شده با CDN تنظیم‌شده مطابقت ندارد.');
  const bytes=readFileSync(file),expectedHash=hash(bytes);trace.emit('reuse_image',{localBytes:bytes.length,localHash:expectedHash,pathHash:hash(Buffer.from(url.pathname))});
  const cookies=this.session.cdnCookies;if(cookies.length!==2||cookies.some(c=>c.expires>0&&c.expires*1000<Date.now()))return fail('CDN_SESSION_EXPIRED','نشست CDN را تازه کنید.');
  let response:Response,downloaded:Buffer;try{response=await this.send(url.href,{headers:{Cookie:cookies.map(c=>c.name+'='+c.value).join('; ')},redirect:'manual',signal:AbortSignal.timeout(30000)});if(!response.ok)return fail('CDN_IMAGE_HTTP','لینک بنر ذخیره‌شده قابل دریافت نیست (HTTP '+response.status+').');downloaded=Buffer.from(await response.arrayBuffer());}catch(e){if(e instanceof BuildError)throw e;return fail('CDN_IMAGE_NETWORK','بررسی مجدد بنر ذخیره‌شده کامل نشد.');}
  const matches=expectedHash===hash(downloaded);trace.emit('comparison',{localBytes:bytes.length,receivedBytes:downloaded.length,localHash:expectedHash,receivedHash:hash(downloaded),hashMatches:matches,status:response.status});
  if(!response.headers.get('content-type')?.toLowerCase().startsWith('image/'))return fail('CDN_IMAGE_MIME','نوع پاسخ بنر ذخیره‌شده تصویر نیست.');
  if(!matches)return fail('CDN_IMAGE_HASH','محتوای بنر ذخیره‌شده تغییر کرده است.');trace.emit('reused_verified',{hashMatches:true});return url.href;
 }
}
