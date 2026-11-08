import {chromium} from 'playwright';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const config=JSON.parse(readFileSync('config/defaults.json','utf8'));
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{
 const ctx=await browser.newContext({serviceWorkers:'block'});const errors=[];let uploads=0,previews=0,submitted;
 const records=new Map();
 await ctx.route('**/*',async route=>{
  const u=new URL(route.request().url());if(u.origin!=='http://127.0.0.1:3140')return route.abort();if(!u.pathname.startsWith('/api/'))return route.continue();
  const body=()=>JSON.parse(route.request().postData()||'{}');let reply;
  switch(u.pathname){
   case '/api/bootstrap':reply={csrf:'fixture'};break;
   case '/api/settings':reply={config,counters:{doosti:112292,rezaei:771111},tokenOptions:{doosti:[{company:'trend',masked:'••••'}]},locked:null};break;
   case '/api/tokens/selected':reply={value:'fixture-token-'+body().supervisor};break;
   case '/api/connection':reply={configured:true};break;
   case '/api/landing/batches/active':reply=null;break;
   case '/api/uploads':reply={id:'upload-'+(++uploads)};break;
   case '/api/landing/preview':{
    const data=body();const n=++previews;assert.equal(data.uploadId,'upload-'+n);assert.equal(data.raw,'درخواست '+n);
    reply={id:'job-'+n,data:{blogger:'بلاگر '+n,date:'1405/08/17',slug:'blogger'+n,category:'infidelity',supervisor:'doosti',company:'trend',uploadId:data.uploadId},status:'review'};records.set(reply.id,reply);break;
   }
   case '/api/landing/batches':{
    submitted=body();assert.deepEqual(submitted.starts,{doosti:880001,rezaei:771555});assert.equal(submitted.confirm,true);assert.equal(submitted.items.length,2);
    assert.deepEqual(submitted.items.map(i=>i.data.uploadId),['upload-1','upload-2']);
    reply={id:'batch-fixture',status:'succeeded',data:{ids:submitted.items.map(i=>i.id)},jobs:submitted.items.map(i=>({...records.get(i.id),data:{...i.data,type:submitted.starts[i.data.supervisor]},status:'succeeded',result:{url:'https://test.invalid/'+i.data.slug}}))};break;
   }
   default:throw new Error('Unexpected fixture API '+u.pathname);
  }
  await route.fulfill({json:reply});
 });
 const p=await ctx.newPage({viewport:{width:1440,height:1000}});p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:3140');
 await p.getByRole('button',{name:'ساخت گروهی',exact:true}).click();
 const file=n=>({name:'banner-'+n+'.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jK1cAAAAASUVORK5CYII=','base64')});
 await p.getByLabel('بنر درخواست 1',{exact:true}).setInputFiles(file(1));await p.getByLabel('متن درخواست 1',{exact:true}).fill('درخواست 1');
 await p.getByRole('button',{name:'استخراج و بازبینی همین درخواست',exact:true}).click();
 await p.getByLabel('تایپ',{exact:true}).nth(0).fill('880001');
 await p.getByRole('button',{name:'+ افزودن درخواست و بنر جداگانه',exact:true}).click();
 await p.getByLabel('بنر درخواست 2',{exact:true}).setInputFiles(file(2));await p.getByLabel('متن درخواست 2',{exact:true}).fill('درخواست 2');
 await p.getByRole('button',{name:'استخراج و بازبینی همین درخواست',exact:true}).nth(1).click();
 await p.getByLabel('سرپرست',{exact:true}).nth(1).selectOption('rezaei');
 await p.getByLabel('تایپ',{exact:true}).nth(1).fill('771555');
 await p.locator('input[value="fixture-token-rezaei"]').waitFor();
 assert.equal(await p.getByText('شماره تایپ بعدی',{exact:true}).count(),0);
 const start=p.getByRole('button',{name:'شروع ساخت واقعی به‌ترتیب (2 درخواست)',exact:true});assert.equal(await start.isEnabled(),false);
 mkdirSync('data/qa',{recursive:true});await p.screenshot({path:'data/qa/batch-review-fixture.png',fullPage:true});
 await p.getByLabel('همه کارت‌ها، بنرها، اسلاگ‌ها و تایپ شروع را بررسی کردم؛ ساخت واقعی همه سفارش‌ها را تأیید می‌کنم.',{exact:true}).check();await start.click();
 await p.getByRole('heading',{name:'تمام سفارش‌ها ساخته شدند',exact:true}).waitFor();assert.ok(submitted);assert.deepEqual(errors,[]);
 assert.equal(await p.getByRole('link',{name:/https:\/\/test.invalid\/blogger/}).count(),2);
 await p.screenshot({path:'data/qa/batch-result-fixture.png',fullPage:true});
 console.log('Batch UI passed: separate text/banner pairs, start type, review, explicit batch consent, separate results. All API mocked; no real creation.');
}finally{await browser.close();}
