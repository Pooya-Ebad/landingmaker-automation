import type {BrowserContext,Page,Locator} from 'playwright';
import {duplicateCount,validatePage} from './core';
export class BuildError extends Error {constructor(message:string,public uncertain=false,public details:any=null){super(message);}}
function checkedDuplicateCount(text:string){try{return duplicateCount(text);}catch{throw new BuildError('تعداد لندینگ‌های موجود از پیام تأیید قابل تشخیص نیست؛ کپی انجام نشد.');}}
async function one(locator:Locator,label:string){await locator.first().waitFor({state:'visible'});if(await locator.count()!==1)throw new BuildError(`المان «${label}» یکتا نیست؛ تنظیمات سایت را بررسی کنید.`);return locator;}
async function fill(page:Page,selector:string,value:string){
 const target=page.locator(selector);
 await target.first().waitFor({state:'attached'});
 if(await target.count()!==1)throw new BuildError('فیلد مقصد یکتا نیست؛ نگاشت ملزومات را بررسی کنید.');
 if(!await target.isVisible()){
  const panelId=await target.evaluate(e=>e.closest('.accordion-collapse')?.id);
  if(panelId)await (await one(page.locator(`button[data-bs-target=${JSON.stringify('#'+panelId)}]`),'باز کردن بخش ملزومات')).click();
 }
 const l=await one(target,'فیلد مقصد');await l.fill(value);if(await l.inputValue()!==value)throw new BuildError('مقدار فرم ثبت نشد.');
}
export interface ImageUploadAdapter {upload(ctx:BrowserContext,file:string,c:any):Promise<string>}
export class HamkadehUpload implements ImageUploadAdapter {
 async upload(ctx:BrowserContext,file:string,c:any){
  if(!c.selectors.uploadResult)throw new BuildError('Selector خروجی آپلود هنوز با سایت واقعی تنظیم نشده است.');
  const p=await ctx.newPage();
  try{
   await p.goto(c.cdnOrigin,{waitUntil:'domcontentloaded'});
   if(new URL(p.url()).origin!==c.cdnOrigin)throw new BuildError('ورود دستی به CDN لازم است.');
   // Clear evidence of an earlier upload: only a changed result is accepted.
   const before=await p.locator(c.selectors.uploadResult).evaluateAll(es=>es.map(e=>(e as HTMLInputElement).value||e.getAttribute('href')||e.textContent||''));
   const chooser=p.waitForEvent('filechooser');await (await one(p.locator(c.selectors.uploadButton),'آپلود')).click();await (await chooser).setFiles(file);
   await p.waitForFunction(({selector,before})=>{const es=[...document.querySelectorAll(selector)];return es.length===1&&!before.includes((es[0] as HTMLInputElement).value||es[0].getAttribute('href')||es[0].textContent||'');},{selector:c.selectors.uploadResult,before});
   const output=await one(p.locator(c.selectors.uploadResult),'لینک تصویر');
   const value=await output.evaluate(e=>(e as HTMLInputElement).value||e.getAttribute('href')||e.textContent||'');
   const url=new URL(value.trim());if(url.protocol!=='https:'||url.origin!==c.cdnOrigin||url.username||url.password)throw new BuildError('لینک خروجی CDN معتبر نیست.');
   const response=await ctx.request.get(url.href,{maxRedirects:0});if(!response.ok()||!response.headers()['content-type']?.startsWith('image/'))throw new BuildError('فایل تصویر در CDN قابل تأیید نیست.');
   return url.href;
  } finally {await p.close();}
 }
}
export interface LandingBuilderAdapter {build(ctx:BrowserContext,d:any,c:any,token:string,image:string,onChecking:()=>void,onCommit:()=>void):Promise<any>}
export class HamkadehBuilder implements LandingBuilderAdapter {
 async build(ctx:BrowserContext,d:any,c:any,token:string,image:string,onChecking:()=>void,onCommit:()=>void,options:{stopBeforeCopy?:boolean}={}){
  const s=c.selectors;
  if(!s.advanced||(!options.stopBeforeCopy&&(!s.success||!s.successText)))throw new BuildError('نگاشت لندینگ پیشرفته و شاهد موفقیت باید ابتدا با سایت واقعی تنظیم شود.');
  const p=await ctx.newPage();let submitted=false;let stage='باز کردن صفحه';
  try {
   const url=validatePage(c.landingPages[d.category].url);await p.goto(url,{waitUntil:'domcontentloaded'});
   if(p.url()!==url)throw new BuildError('نشست ورود منقضی شده یا صفحه تغییر مسیر داده است؛ دوباره وارد شوید.');
   stage='عنوان و اسلاگ';await fill(p,s.title,d.title);await fill(p,s.slug,d.slug);
   stage='لندینگ پیشرفته';const advanced=await one(p.locator(s.advanced),'لندینگ پیشرفته');await advanced.selectOption('1');if(await advanced.inputValue()!=='1')throw new BuildError('لندینگ پیشرفته فعال نشد.');
   stage='انتخاب گروه';let group=p.getByRole('combobox',{name:s.groupLabel,exact:true});
   if(await group.count()!==1)group=p.getByText(s.groupLabel,{exact:true}).locator('..').getByRole('combobox');
   await (await one(group,'انتخاب گروه')).fill(c.supervisors[d.supervisor].group);
   await (await one(p.getByRole('option',{name:c.supervisors[d.supervisor].group,exact:true}),'گروه')).click();
   stage='ملزومات';await fill(p,s.mainPic,image);await fill(p,s.type,String(d.type));await fill(p,s.token,token);
   for(const [selector,value] of Object.entries(s.extraFields as Record<string,string>))await fill(p,selector,value);
   if(s.secondaryMainPic&&await p.locator(s.secondaryMainPic).count()){
    await fill(p,s.secondaryMainPic,'');
    if(await p.locator(s.mainPic).inputValue()!==image)throw new BuildError('خالی‌کردن تصویر پارامتر دوم، تصویر اصلی را تغییر داد؛ ساخت متوقف شد.');
   }
   const invalid=await p.locator('input:invalid,select:invalid,textarea:invalid').count();if(invalid)throw new BuildError('فیلد اجباری تکمیل‌نشده وجود دارد؛ نگاشت extraFields را تنظیم کنید.');
   stage='Modal بررسی تکراری بودن';onChecking();await (await one(p.getByRole('button',{name:'ایجاد کپی',exact:true}),'ایجاد کپی')).click();
   const modal=await one(p.locator(s.modal),'Modal تأیید');
   // The modal first appears with a spinner; wait for its actual confirmation UI.
   await modal.getByRole('button',{name:'کپی',exact:true}).waitFor({state:'visible'});
   let count:number|null=null;
   try{count=checkedDuplicateCount(await modal.innerText());}catch(e){if(!options.stopBeforeCopy)throw e;}
   const links=await modal.getByRole('link',{name:'مشاهده'}).evaluateAll(es=>es.map(e=>(e as HTMLAnchorElement).href));
   const viewLinks=links.flatMap(v=>{try{const u=new URL(v);if(!['https://new.hamkadeh.com',c.landingOrigin].includes(u.origin))return [];for(const [key,value] of [...u.searchParams])if(/token|authorization|api.?key/i.test(key)||value.includes(token))u.searchParams.delete(key);if(u.pathname.includes(token)||u.hash.includes(token))return [];return [u.href];}catch{return [];}});
   if(options.stopBeforeCopy){await p.bringToFront();return {status:'awaiting_user_review',duplicateCount:count,viewLinks,finalCopyClicked:false,pageUrl:p.url(),title:d.title,slug:d.slug,imageUrl:image};}
   if(count!==null&&count>0)throw new BuildError('ترکیب تایپ و توکن تکراری است؛ کپی انجام نشد.',false,{count,viewLinks});
   // Re-read immediately before clicking. No branch or setting can bypass this guard.
   if(checkedDuplicateCount(await modal.innerText())!==0)throw new BuildError('پیام تکراری بودن تغییر کرد؛ کپی انجام نشد.');
   const success=p.locator(s.success).filter({hasText:s.successText});
   if(await success.isVisible())throw new BuildError('شاهد موفقیت از قبل روی صفحه وجود دارد.');
   onCommit();submitted=true;
   await (await one(modal.getByRole('button',{name:'کپی',exact:true}),'کپی')).click();
   await one(success,'پیام موفقیت');
   // A fresh success signal AND a public page containing this exact request's evidence.
   const finalUrl=c.landingOrigin+'/'+d.slug;
   const proof=await ctx.newPage();
   try {const response=await proof.goto(finalUrl,{waitUntil:'domcontentloaded'});if(!response?.ok()||proof.url()!==finalUrl)throw new Error();const html=await proof.content();if(!html.includes(String(d.type))||!html.includes(token))throw new Error();}catch{throw new BuildError('ثبت ارسال شد اما لینک نهایی و تایپ/توکن قابل تأیید نیست؛ نتیجه نامشخص است.',true);}finally{await proof.close();}
   return {url:finalUrl,imageUrl:image,evidence:'fresh-success-and-public-type-token',createdAt:new Date().toISOString()};
  }catch(e){if(e instanceof BuildError){if(submitted)e.uncertain=true;throw e;}throw new BuildError(submitted?'پس از ارسال کپی ارتباط یا تأیید نتیجه قطع شد؛ بررسی دستی لازم است.':`مرحله «${stage}» پیش از ارسال کپی متوقف شد؛ ورود، اینترنت یا نگاشت المان‌ها را بررسی کنید.`,submitted);}
  finally {if(!options.stopBeforeCopy)await p.close().catch(()=>{});}
 }
}
