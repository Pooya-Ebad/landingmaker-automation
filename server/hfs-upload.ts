import type {BrowserContext} from 'playwright';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {BuildError,type ImageUploadAdapter} from './adapters';

// HFS UI observed on cdn.hamkadeh.com: Upload -> Pick files -> Send -> Copy links.
export class HfsUpload implements ImageUploadAdapter {
 async upload(ctx:BrowserContext,file:string,c:any){
  const p=await ctx.newPage();let sent=false;let stage='باز کردن CDN';
  try{
   await p.goto(c.cdnOrigin,{waitUntil:'domcontentloaded'});
   await p.locator(c.selectors.uploadButton).waitFor();
   if(new URL(p.url()).origin!==c.cdnOrigin)throw new BuildError('ورود به CDN لازم است.');
   await p.locator(c.selectors.uploadButton).click();
   const dialog=p.locator('#upload-dialog');await dialog.waitFor();
   const collisionPolicy=dialog.locator('select');
   if(await collisionPolicy.count()===1)await collisionPolicy.selectOption({label:'Rename to avoid overwriting'});
   stage='انتخاب فایل';const chooser=p.waitForEvent('filechooser');await dialog.getByRole('button',{name:'Pick files',exact:true}).click();await (await chooser).setFiles(file);
   const send=dialog.getByRole('button',{name:/^Send 1 file,/});await send.waitFor();
   if(await send.count()!==1)throw new BuildError('صف آپلود باید فقط شامل یک تصویر باشد.');
   stage='ارسال فایل';sent=true;await send.click();
   await p.waitForFunction(()=>/(?:^|\D)1 (finished|failed)\b/.test(document.querySelector('#upload-dialog')?.textContent||''),null,{timeout:c.browser?.timeout||60000});
   if(!/(?:^|\D)1 finished\b/.test(await dialog.innerText()))throw new BuildError('آپلود CDN ناموفق بود؛ ساخت ارسال نشد.');
   stage='دریافت لینک خروجی';await p.evaluate(()=>{
    const w=window as any;w.__hfsGeneratedLinks='';w.__hfsOriginalWrite=navigator.clipboard.writeText;w.__hfsOriginalExec=document.execCommand;
    navigator.clipboard.writeText=async(text:string)=>{w.__hfsGeneratedLinks=text;};
    document.execCommand=function(command:string,...args:any[]){if(command==='copy'){w.__hfsGeneratedLinks=window.getSelection()?.toString()||(document.activeElement as HTMLInputElement)?.value||'';return true;}return w.__hfsOriginalExec.call(document,command,...args);};
   });
   let generated:string;
   try{
    await dialog.locator('a').filter({hasText:/^Copy links$/}).click();
    await p.waitForFunction(()=>!!(window as any).__hfsGeneratedLinks,null,{timeout:5000});
    generated=await p.evaluate(()=>(window as any).__hfsGeneratedLinks);
   }finally{await p.evaluate(()=>{const w=window as any;navigator.clipboard.writeText=w.__hfsOriginalWrite;document.execCommand=w.__hfsOriginalExec;});}
   const lines=generated.trim().split(/\r?\n/).filter(Boolean);if(lines.length!==1)throw new BuildError('لینک خروجی آپلود یکتا نیست.');
   const url=new URL(lines[0]);if(url.protocol!=='https:'||url.origin!==c.cdnOrigin||url.username||url.password)throw new BuildError('دامنه خروجی CDN معتبر نیست.');
   const response=await ctx.request.get(lines[0],{maxRedirects:0,timeout:30000});
   if(!response.ok()||!response.headers()['content-type']?.startsWith('image/'))throw new BuildError('تصویر آپلودشده در دسترس نیست.');
   const hash=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
   if(hash(await response.body())!==hash(readFileSync(file)))throw new BuildError('فایل CDN با بنر اصلی مطابقت ندارد.');
   return lines[0];
  }catch(e){if(e instanceof BuildError)throw e;throw new BuildError(sent?`مرحله «${stage}» تأیید نشد؛ پیش از تلاش مجدد CDN را بررسی کنید.`:`مرحله «${stage}» پیش از ارسال فایل متوقف شد.`);}
  finally{await p.close().catch(()=>{});}
 }
}
