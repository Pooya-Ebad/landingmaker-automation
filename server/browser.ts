import {chromium,type BrowserContext,type Browser} from 'playwright';
import path from 'node:path';
import {dataDir} from './store';
let context:BrowserContext|undefined;
let opening:Promise<BrowserContext>|undefined;
let connected:Browser|undefined;
export function validateCdpEndpoint(value:string){
 const u=new URL(value);
 if(u.protocol!=='http:'||u.hostname!=='127.0.0.1'||!u.port||u.pathname!=='/'||u.search||u.hash||u.username||u.password)throw new Error('نشانی اتصال Chrome باید مانند http://127.0.0.1:9222 و فقط محلی باشد.');
 return u.origin;
}
export async function browser(c:any){
 if(context)return context;
 if(opening)return opening;
 opening=(async()=>{
  let ctx:BrowserContext;
  if(c.browser.mode==='cdp'){
   const endpoint=validateCdpEndpoint(c.browser.cdpEndpoint);
   try {connected=await chromium.connectOverCDP(endpoint,{timeout:c.browser.timeout});}
   catch {throw new Error('اتصال به Chrome آماده برقرار نشد؛ میان‌بر Google Chrome پروژه را باز کنید.');}
   const existing=connected.contexts();
   if(existing.length!==1){await connected.close();connected=undefined;throw new Error('پروفایل مرورگر یکتا نیست؛ اتصال متوقف شد.');}
   ctx=existing[0];
   connected.on('disconnected',()=>{context=undefined;connected=undefined;});
  }else ctx=await chromium.launchPersistentContext(path.join(dataDir,'browser-profile'),{headless:c.browser.headless,channel:c.browser.channel==='chromium'?undefined:c.browser.channel,acceptDownloads:false});
  context=ctx;ctx.setDefaultTimeout(c.browser.timeout);ctx.on('close',()=>{if(context===ctx)context=undefined;});return ctx;
 })().finally(()=>{opening=undefined;});
 return opening;
}
export async function closeBrowser(){
 // Never close the user's shared default context or their existing tabs.
 if(connected){const previous=connected;connected=undefined;context=undefined;await previous.close();}
 else {await context?.close();context=undefined;}
}
