import {randomUUID,createHash} from 'node:crypto';
import {db,config,nextType,job,transaction,locked,update,unseal,seal,consumeType,setCounter,typeStatus,typeReuseApproved} from './store';
import {browser} from './browser';
import {HamkadehUpload,HamkadehBuilder,BuildError,type ImageUploadAdapter,type LandingBuilderAdapter} from './adapters';
import {validateConfig,validatePage} from './core';
import type {BrowserContext} from 'playwright';
import {selectedToken} from './settings-manager';
import {target} from './providers';
export function title(d:any,c:any){return `${c.landingPages[d.category]?.label||''} ${d.type} ${d.blogger||''} / ${c.supervisors[d.supervisor]?.label||''}`;}
export function createDraft(data:any){const id=randomUUID(),now=new Date().toISOString();db.prepare('INSERT INTO jobs(id,created,updated,status,data) VALUES(?,?,?,?,?)').run(id,now,now,'review',JSON.stringify(data));return job(id);}
export function prepareForBuild(id:string,changes:any){return transaction(()=>{
 if(locked())throw new Error('عملیات دیگری فعال است؛ ابتدا نتیجه آن را بررسی کنید.');
 const type=Number(changes.type);setCounter(changes.supervisor,type);
 return prepare(id,{...changes,type},type,true);
});}
db.exec('CREATE TABLE IF NOT EXISTS job_attempts(id INTEGER PRIMARY KEY,job TEXT NOT NULL,created TEXT NOT NULL,status TEXT NOT NULL,error TEXT,result TEXT,slug TEXT NOT NULL)');
export function prepareRetry(id:string,changes:any){return transaction(()=>{
 const j=job(id);if(locked())throw new Error('ابتدا نتیجه عملیات فعال یا نامشخص را بررسی کنید.');
 if(!['failed','duplicate','canceled'].includes(j.status))throw new Error('این سفارش برای تلاش مجدد امن آماده نیست.');
 db.prepare('INSERT INTO job_attempts(job,created,status,error,result,slug) VALUES(?,?,?,?,?,?)').run(id,new Date().toISOString(),j.status,j.error,JSON.stringify(j.result),j.data.slug||'');
 const data={...j.data,cancelRequested:false};db.prepare("UPDATE jobs SET status='review',data=? WHERE id=?").run(JSON.stringify(data),id);
 const type=Number(changes.type);setCounter(changes.supervisor,type);return prepare(id,{...changes,type},type,true);
});}
export function prepare(id:string,changes:any,expectedType?:number,inTransaction=false){const work=()=>{
 const j=job(id);if(!['review','ready'].includes(j.status))throw new Error('این سفارش قابل ویرایش یا اجرای دوباره نیست.');
 const c=config();validateConfig(c);
 const allowed=['date','blogger','writer','idea','subject','scenarioName','stories','style','company','category','supervisor','tokenCompany','tokenId','builder','type','slug','title'];
 const d={...j.data};for(const k of allowed)if(changes[k]!==undefined)d[k]=changes[k];
 if(!c.supervisors[d.supervisor]||!c.companies[d.company]||!c.landingPages[d.category])throw new Error('سرپرست، شرکت و دسته‌بندی را تکمیل کنید.');
 const tokenCompany=d.tokenCompany||d.company;const token=selectedToken(c,d.supervisor,tokenCompany,d.tokenId);if(!c.companies[tokenCompany]||!token)throw new Error('توکن مجاز این سرپرست موجود نیست.');
 if(!d.blogger?.trim()||!d.date?.trim()||!d.uploadId||!/^[a-z0-9]+$/.test(d.slug||''))throw new Error('نام بلاگر، تاریخ، تصویر و اسلاگ لاتین معتبر لازم است.');
 const expected=expectedType??nextType(d.supervisor);if(!expected)throw new Error('تایپ شروع این سرپرست را در تنظیمات وارد کنید.');
 d.type=Number(d.type);if(!Number.isSafeInteger(d.type)||d.type!==expected)throw new Error('تایپ این سرپرست تغییر کرده است؛ پیش‌نمایش را به‌روز کنید.');
 const used=typeStatus(d.supervisor,d.type).used;
 const confirmed=changes.confirmTypeReuse===true||(changes.confirmTypeReuse===undefined&&typeReuseApproved(d));
 if(used&&!confirmed)throw new Error('این تایپ قبلاً استفاده شده است؛ برای ادامه، هشدار استفاده مجدد را تأیید کنید.');
 d.typeReuseApproval=used&&confirmed?{supervisor:d.supervisor,type:d.type,confirmedAt:new Date().toISOString()}:null;
 d.title=changes.title?.trim()||title(d,c);d.tokenCompany=tokenCompany;d.secretToken=token;d.configVersion=createHash('sha256').update(JSON.stringify(c)).digest('hex');
 d.builder??='hamkadeh';target(d,c);
 if(d.builder==='moshavere'&&c.execution?.transport!=='http')throw new Error('مشاوره به اجرای مستقیم API نیاز دارد.');
 db.prepare("UPDATE jobs SET data=?,status='ready',updated=? WHERE id=?").run(JSON.stringify(d),new Date().toISOString(),id);return job(id);
};return inTransaction?work():transaction(work);}
export function reserve(id:string){return transaction(()=>{const j=job(id);if(j.status!=='ready')throw new Error('سفارش باید آماده ساخت باشد و قبلاً اجرا نشده باشد.');if(locked())throw new Error('عملیات دیگری در جریان است یا نتیجه نامشخص دارد.');if(j.data.configVersion!==createHash('sha256').update(JSON.stringify(config())).digest('hex'))throw new Error('تنظیمات تغییر کرده است؛ اطلاعات را دوباره تأیید کنید.');if(j.data.type!==nextType(j.data.supervisor))throw new Error('شماره تایپ تغییر کرده؛ پیش‌نمایش جدید بگیرید.');db.prepare('INSERT INTO lease VALUES(1,?)').run(id);update(id,'running');return j;});}
export async function execute(id:string,upload?:ImageUploadAdapter,builder:LandingBuilderAdapter=new HamkadehBuilder(),getBrowser:(c:any)=>Promise<BrowserContext>=browser){
 const j=job(id),d=j.data,c=config();let commit=false;
 if(!upload&&c.execution?.transport==='http'){const {checkRemote}=await import('./remote-jobs');await checkRemote(id);return;}
 const assertNotCanceled=()=>{if(job(id).data.cancelRequested)throw new BuildError('عملیات به درخواست کاربر پیش از ارسال کپی لغو شد.');};
 try {
  assertNotCanceled();
  if(!c.selectors.advanced||!c.selectors.uploadResult||!c.selectors.success||!c.selectors.successText)throw new BuildError('ابتدا نگاشت سایت در تنظیمات را پس از بررسی واقعی تکمیل کنید؛ ساخت ارسال نشد.');
  const ctx=await getBrowser(c);update(id,'uploading');
  const image=await (upload||new HamkadehUpload()).upload(ctx,d.file,c);assertNotCanceled();
  const result=await builder.build(ctx,d,c,unseal(d.secretToken),image,()=>{assertNotCanceled();update(id,'checking');},()=>{assertNotCanceled();update(id,'confirming');commit=true;});
  transaction(()=>{consumeType(d,id);update(id,'succeeded',null,result);db.prepare('DELETE FROM lease WHERE job=?').run(id);});
 }catch(e){
  const err=e instanceof BuildError?e:new BuildError(commit?'نتیجه نهایی نامشخص است؛ قبل از ادامه سایت را بررسی کنید.':'عملیات متوقف شد؛ ارتباط مرورگر و تنظیمات را بررسی کنید.',commit);
  const uncertain=commit||err.uncertain;
  transaction(()=>{update(id,uncertain?'uncertain':job(id).data.cancelRequested?'canceled':err.details?.count?'duplicate':'failed',err.message,err.details);if(!uncertain)db.prepare('DELETE FROM lease WHERE job=?').run(id);});
 }
}
export function cancel(id:string){transaction(()=>{const j=job(id);if(['review','ready','checked'].includes(j.status)){update(id,'canceled','سفارش پیش از ثبت نهایی لغو شد.');db.prepare('DELETE FROM lease WHERE job=?').run(id);return;}if(!['running','uploading','checking'].includes(j.status))throw new Error('در این مرحله لغو امن ممکن نیست؛ نتیجه عملیات را بررسی کنید.');db.prepare('UPDATE jobs SET data=? WHERE id=?').run(JSON.stringify({...j.data,cancelRequested:true}),id);});}
export function reconcile(id:string,outcome:'created'|'not-created',note:string){transaction(()=>{const j=job(id);if(j.status!=='uncertain'||locked()?.job!==id)throw new Error('این سفارش نتیجه نامشخص ندارد.');if(note.trim().length<15)throw new Error('شاهد بررسی دستی را کامل بنویسید.');if(outcome==='created'){consumeType(j.data,id);update(id,'succeeded',null,{url:target(j.data,config()).landing+'/'+j.data.slug,createdAt:new Date().toISOString(),evidence:'manual: '+note});}else update(id,'failed','عدم ساخت با بررسی دستی تأیید شد: '+note);db.prepare('DELETE FROM lease WHERE job=?').run(id);});}
