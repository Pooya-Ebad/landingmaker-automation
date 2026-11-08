import {chromium} from 'playwright';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const config=JSON.parse(readFileSync('config/defaults.json','utf8'));
const b=await chromium.launch({headless:true,channel:'msedge'});
try{
 const ctx=await b.newContext({serviceWorkers:'block'});const errors=[];let phase='review';
 const data={blogger:'پوریا عزیزی',date:'1405/08/17',category:'infidelity',company:'trend',supervisor:'doosti',type:112297,slug:'pouriaazizi0817',slugDate:'1405/08/17'};
 const diagnostic={traceId:'fixture-upload-trace',code:'CDN_IMAGE_MIME',stage:'verify',events:[{event:'download_response',status:200,contentType:'application/octet-stream'},{event:'comparison',hashMatches:true,localBytes:100,receivedBytes:100}]};
 const job=()=>({id:'error-fixture',status:phase,data,error:phase==='failed'?'نوع فایل برگشتی تصویر نیست؛ لندینگ ساخته نشد.':null,result:phase==='failed'?{uploadDiagnostic:diagnostic}:null});
 await ctx.route('**/*',async route=>{const u=new URL(route.request().url());if(u.origin!=='http://127.0.0.1:3140')return route.abort();if(!u.pathname.startsWith('/api/'))return route.continue();let reply;
  switch(u.pathname){
   case '/api/bootstrap':reply={csrf:'fixture'};break;
   case '/api/settings':reply={config,counters:{doosti:112297},tokenOptions:{doosti:[{id:'',company:'trend',label:'توکن اصلی'}]},locked:null};break;
   case '/api/connection':reply={configured:true};break;
   case '/api/landing/batches/active':reply=null;break;
   case '/api/uploads':reply={id:'fixture-upload'};break;
   case '/api/landing/preview':reply=job();break;
   case '/api/landing/slug':reply={slug:data.slug,slugDate:data.slugDate};break;
   case '/api/tokens/selected':reply={value:'fixture-routing-token'};break;
   case '/api/landing/build':phase='failed';reply=job();break;
   default:throw Error('Unexpected debug UI API '+u.pathname);
  }
  await route.fulfill({json:reply});
 });
 const p=await ctx.newPage({viewport:{width:1440,height:1100}});p.setDefaultTimeout(10000);p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:3140');
 await p.getByLabel('تصویر بنر',{exact:true}).setInputFiles({name:'banner.png',mimeType:'image/png',buffer:Buffer.from('fixture')});await p.getByLabel('متن درخواست',{exact:true}).fill('درخواست آزمایشی');await p.getByRole('button',{name:'استخراج و بازبینی اطلاعات ←',exact:true}).click();await p.getByRole('button',{name:'آپلود و بررسی واقعی (بدون ساخت)',exact:true}).click();
 await p.getByText('جزئیات عیب‌یابی آپلود · CDN_IMAGE_MIME',{exact:true}).click();await p.getByText('fixture-upload-trace',{exact:true}).waitFor();await p.getByRole('button',{name:'کپی گزارش آپلود',exact:true}).waitFor();
 assert.equal(await p.getByRole('button',{name:'ثبت نهایی و دریافت لینک',exact:true}).count(),0);assert.ok((await p.locator('pre').last().innerText()).includes('hashMatches'));assert.deepEqual(errors,[]);mkdirSync('data/qa',{recursive:true});await p.screenshot({path:'data/qa/upload-diagnostic-fixture.png',fullPage:true});console.log('Upload error UI passed: distinct reason, trace, safe report and no final creation action. All API mocked.');
}finally{await b.close();}
