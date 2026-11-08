import {chromium,type BrowserContext} from 'playwright';
import {readFileSync,mkdirSync,writeFileSync,existsSync} from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {parseRequest,makeSlug} from '../server/core';
import {HamkadehUpload,HamkadehBuilder,BuildError} from '../server/adapters';

// Deliberately uses no CDP connection, saved browser session, real upload or production API.
const production=path.resolve('data/app.sqlite');
function mainCounter(){if(!existsSync(production))return null;const db=new DatabaseSync(production,{readOnly:true});try{return (db.prepare('SELECT next FROM counter WHERE id=1').get() as any).next;}finally{db.close();}}
const before=mainCounter();
const output=path.resolve('data/sandbox/darya-'+Date.now());mkdirSync(output,{recursive:true});
process.env.DATA_DIR=output;
const store=await import('../server/store');
assert.equal(store.dataDir,output);assert.notEqual(path.join(store.dataDir,'app.sqlite'),production);
const {createDraft,prepare,reserve,execute}=await import('../server/jobs');
const c=store.config();
c.browser={mode:'persistent',headless:true,channel:'msedge',timeout:10000};
Object.assign(c.selectors,{advanced:'#advanced',groupLabel:'انتخاب گروه',modal:'#confirm',uploadResult:'#upload-result',success:'#success',successText:'ثبت آزمایشی تأیید شد'});
store.db.prepare('UPDATE settings SET value=?').run(JSON.stringify(c));
store.setCounter('rezaei',771111);
const raw=readFileSync('tests/fixtures/darya-request.txt','utf8');
const parsed:any=parseRequest(raw,c);
assert.equal(parsed.category,'marital');assert.equal(parsed.supervisor,'rezaei');assert.equal(parsed.requestedType,'771111');
const file=path.resolve('#دریا_فلورا (14).jpg');const banner=readFileSync(file);assert.ok(banner.subarray(0,3).equals(Buffer.from([255,216,255])));
const slug=makeSlug(parsed.blogger,parsed.date,c);
const b=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'msedge'});
const results:any[]=[];let networkRequests=0;
const escaped=(v:string)=>v.replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]!));
try{
 for(const scenario of [
  {name:'upload-failed',message:'',expected:'failed',copies:0,after:771111},
  {name:'duplicate',message:'با تایپ و توکن این لندینگ ۱ لندینگ دیگر وجود دارد',expected:'duplicate',copies:0,after:771111},
  {name:'unknown-count',message:'تعداد موجود قابل تشخیص نیست',expected:'failed',copies:0,after:771111},
  {name:'zero-simulation',message:'با تایپ و توکن این لندینگ ۰ لندینگ دیگر وجود دارد',expected:'succeeded',copies:1,after:771112}
 ]){
  const ctx=await b.newContext({serviceWorkers:'block'});ctx.setDefaultTimeout(5000);
  let copies=0,uploads=0;const observations:any[]=[];
  await ctx.exposeFunction('recordCopy',()=>{copies++;});
  await ctx.exposeFunction('recordUpload',()=>{uploads++;});
  const imageUrl=c.cdnOrigin+'/sandbox/banner.jpg';
  const expectedToken=store.unseal(c.tokens.rezaei.adwise);
  const fixture=`<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><style>body{font:16px Tahoma;padding:32px;background:#f5f8fa}input,select{display:block;padding:10px;margin:8px;width:500px}#token{color:transparent}button{padding:12px}#confirm{background:#fff4d5;padding:20px}</style><h1>محیط شبیه‌سازی محلی — ساخت واقعی انجام نمی‌شود</h1>
   <label>عنوان<input id="EditetitleLanding"></label><label>اسلاگ<input id="EditeslugLanding"></label><select id="advanced"><option value="0">خیر</option><option value="1">بله</option></select>
   <input role="combobox" aria-label="انتخاب گروه"><div role="option" onclick="this.hidden=true;document.getElementById('chosen').textContent=this.textContent">مائده رضایی</div><p id="chosen"></p>
   <button data-bs-target="#collapse2" onclick="document.getElementById('collapse2').hidden=false">محتوای لندینگ</button><div id="collapse2" class="accordion-collapse" hidden><input name="mainPic"></div>
   <button data-bs-target="#collapse7" onclick="document.getElementById('collapse7').hidden=false">ملزومات لندینگ</button><div id="collapse7" class="accordion-collapse" hidden><input name="type"><input id="token" name="token"></div>
   <div hidden><input name="mainPic" value="untouched"><input name="type" value="untouched"><input name="token" value="untouched"></div>
   <button onclick="document.getElementById('confirm').hidden=false">ایجاد کپی</button><div id="confirm" hidden><p>${escaped(scenario.message)}</p><a href="https://new.hamkadeh.com/sandbox/existing">مشاهده</a><button onclick="recordCopy();document.getElementById('success').hidden=false">کپی</button></div><div id="success" hidden>ثبت آزمایشی تأیید شد</div></html>`;
  await ctx.route('**/*',async route=>{
   const url=route.request().url();
   if(url===c.cdnOrigin+'/')return route.fulfill({contentType:'text/html; charset=utf-8',body:`<h1>آپلود آزمایشی محلی</h1><input hidden type="file" id="file" onchange="recordUpload();document.getElementById('upload-result').value='${imageUrl}'"><button id="upload-button" onclick="document.getElementById('file').click()">Upload</button><input id="upload-result">`});
   if(url===c.landingPages.marital.url)return route.fulfill({contentType:'text/html; charset=utf-8',body:fixture});
   if(url===imageUrl)return route.fulfill({contentType:'image/jpeg',body:banner});
   if(url===c.landingOrigin+'/'+slug)return route.fulfill({contentType:'text/html; charset=utf-8',body:`<html><p>771111</p><input hidden value="${expectedToken}"></html>`});
   networkRequests++;return route.abort('blockedbyclient');
  });
  const newPage=ctx.newPage.bind(ctx);
  const newTrackedPage=async()=>{
   const p=await newPage();const close=p.close.bind(p);
   p.close=async options=>{
    if(await p.locator('#EditetitleLanding').count()){
     observations.push({title:await p.locator('#EditetitleLanding').inputValue(),slug:await p.locator('#EditeslugLanding').inputValue(),type:await p.locator(c.selectors.type).inputValue(),image:await p.locator(c.selectors.mainPic).inputValue()===imageUrl,tokenMatches:await p.locator(c.selectors.token).inputValue()===expectedToken,advanced:await p.locator('#advanced').inputValue(),group:await p.locator('#chosen').innerText(),secondParameterUnchanged:await p.locator('div[hidden] > input[value=untouched]').count()===3});
     await p.screenshot({path:path.join(output,scenario.name+'.png'),fullPage:true,mask:[p.locator('input[name=token]')]});
    }
    await close(options);
   };return p;
  };
  // APIRequestContext does not participate in browser routing, so its one image
  // probe is replaced explicitly. Unexpected probes throw before any network I/O.
  const sandboxContext=new Proxy(ctx,{get(target,key){if(key==='newPage')return newTrackedPage;if(key==='request')return {get:async(url:string)=>{assert.equal(url,imageUrl);return {ok:()=>true,headers:()=>({'content-type':'image/jpeg'})};}};const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}}) as BrowserContext;
  const d=createDraft({...parsed,raw,file,uploadId:'local-banner-only',type:771111,slug,simulation:true});
  prepare(d.id,{});reserve(d.id);
  const uploader=scenario.name==='upload-failed'?{upload:async()=>{throw new BuildError('آپلود شبیه‌سازی‌شده ناموفق بود.');}}:new HamkadehUpload();
  await execute(d.id,uploader,new HamkadehBuilder(),async()=>sandboxContext);
  const final=store.job(d.id);assert.equal(final.status,scenario.expected);assert.equal(copies,scenario.copies);assert.equal(store.nextType('rezaei'),scenario.after);assert.equal(store.locked(),undefined);
  for(const observation of observations){assert.equal(observation.title,'زناشویی 771111 دریا فلورا / رضایی');assert.equal(observation.slug,'daryaflora0816');assert.equal(observation.type,'771111');assert.equal(observation.tokenMatches,true);assert.equal(observation.group,'مائده رضایی');assert.equal(observation.secondParameterUnchanged,true);assert.equal(observation.advanced,'1');assert.equal(observation.image,true);}
  results.push({scenario:scenario.name,status:final.status,simulatedCopyClicks:copies,simulatedUploads:uploads,counterAfter:store.nextType('rezaei'),observations,error:final.error});
  await ctx.close();
 }
}finally{await b.close();store.db.close();}
assert.equal(networkRequests,0);const after=mainCounter();assert.equal(after,before);
const report={simulation:true,realLandingCreated:false,realCdnUpload:false,productionCounterBefore:before,productionCounterAfter:after,unexpectedBrowserRequests:networkRequests,metadata:{...parsed,type:771111,slug,title:'زناشویی 771111 دریا فلورا / رضایی',group:'مائده رضایی',token:'•••••••••••••',bannerBytes:banner.length},results};
writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
writeFileSync(path.join(output,'report.html'),`<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><title>نتیجه آزمون امن دریا فلورا</title><style>body{font:15px Tahoma;background:#f4f7fa;color:#263d4a;max-width:960px;margin:30px auto;padding:24px}section{background:white;padding:24px;margin:16px 0;border:1px solid #dde6ed;border-radius:12px}img{max-width:100%}pre{white-space:pre-wrap;direction:ltr;text-align:left}strong{color:#087869}</style><h1>آزمون امن — دریا فلورا</h1><strong>هیچ لندینگ واقعی ساخته نشد و بنر به CDN ارسال نشد.</strong><section><p>عنوان: زناشویی 771111 دریا فلورا / رضایی</p><p>اسلاگ پیشنهادی: <b dir="ltr">daryaflora0816</b></p><p>سرپرست: رضایی · گروه: مائده رضایی · شرکت: ادوایس · توکن: •••••••••••••</p><p>شمارنده اصلی قبل و بعد: ${before} → ${after}</p><img alt="بنر محلی" src="data:image/jpeg;base64,${banner.toString('base64')}"></section>${results.map(r=>`<section><h2>${escaped(r.scenario)}</h2><p>وضعیت در شبیه‌ساز: ${escaped(r.status)} · تعداد کلیک آزمایشی کپی: ${r.simulatedCopyClicks}</p>${r.observations.length?`<img alt="فرم شبیه‌سازی‌شده" src="${r.scenario}.png">`:''}</section>`).join('')}<section><pre>${escaped(JSON.stringify(report,null,2))}</pre></section></html>`);
console.log(JSON.stringify({report:path.join(output,'report.html'),realLandingCreated:false,realCdnUpload:false,productionCounterUnchanged:before===after,scenarios:results.map(r=>({scenario:r.scenario,status:r.status}))}));
