import {chromium} from 'playwright';
import {readFileSync,mkdirSync} from 'node:fs';
const defaults=JSON.parse(readFileSync('config/defaults.json','utf8'));
defaults.landingPages.infidelity.moshavereUrl='https://new.moshavere.me/dashboard/showLandings/newofcopy/13550';
const b=await chromium.launch({headless:true,channel:'msedge'});
const retryMode=process.argv.includes('--retry-flow');
const reuseTypeMode=process.argv.includes('--reuse-type');
const siteErrorMode=process.argv.includes('--site-error')||retryMode;
try{
 const ctx=await b.newContext({serviceWorkers:'block'});let phase='review',commits=0,learned=null,uploads=0,rechecks=0;const errors=[];
 const data={blogger:'مینا حیدری',date:'1405/08/17',writer:'قربانی',idea:'قدیم',subject:'خیانت',scenarioName:'خواب زمستانی',stories:'2',style:'دایرکت طولانی',company:'trend',supervisor:'doosti',category:'infidelity',type:112297,slug:'minaheydari0817',title:'خیانت 112297 مینا حیدری / دوستی'};
 data.slugDate='1405/08/17';
 const current=()=>({id:'ui-fixture',status:phase,data,error:['uncertain','failed'].includes(phase)?'سایت درخواست را رد کرد؛ اسلاگ را اصلاح کنید.':null,result:phase==='succeeded'?{url:'https://test.invalid/'+data.slug}:phase==='checked'?{mode:'check',duplicateCount:0,imageReused:rechecks>0,finalCreateSent:false}:['uncertain','failed'].includes(phase)?{retryAllowed:retryMode,siteError:{provider:'moshavere',httpStatus:422,phase:'/landing/create',messages:['اسلاگ قبلاً استفاده شده است.'],validation:[{field:'slug',message:'یک اسلاگ دیگر انتخاب کنید.'}]}}:null});
 await ctx.route('**/*',async route=>{
  const u=new URL(route.request().url());
  if(u.origin!=='http://127.0.0.1:3140')return route.abort();
  if(!u.pathname.startsWith('/api/'))return route.continue();
  const body=()=>JSON.parse(route.request().postData()||'{}');let reply;
  switch(u.pathname){
   case '/api/landing/type-status':reply={used:reuseTypeMode&&body().type===112310,count:reuseTypeMode&&body().type===112310?1:0};break;
   case '/api/bootstrap':reply={csrf:'test-only'};break;
   case '/api/landing/batches/active':reply=null;break;
   case '/api/settings':reply={config:defaults,counters:{doosti:112297},tokenOptions:{doosti:[{id:'',label:'توکن اصلی',company:'trend',masked:'•••••••••••••'},{id:'fixture-alt',label:'کمپین دوم',company:'trend',masked:'••••'}]},locked:['checked','uploading','checking'].includes(phase)?{job:'ui-fixture'}:null};break;
   case '/api/tokens/selected':reply={value:body().tokenId==='fixture-alt'?'fixture-alternative-token':'fixture-routing-token'};break;
   case '/api/connection':reply={configured:true,providers:{hamkadeh:{configured:true},moshavere:{configured:true}}};break;
   case '/api/uploads':uploads++;reply={id:'mock-upload'};break;
   case '/api/landing/preview':reply=current();break;
   case '/api/landing/slug':reply={slug:data.slug,slugDate:'1405/08/17'};break;
   case '/api/landing/slug-memory':if(route.request().method()==='DELETE'){learned=null;reply={remembered:false};}else{if(body().blogger!==data.blogger||body().slugDate!=='1405/08/17')throw new Error('Wrong blogger/date memory');learned=body().slug;reply={remembered:true};}break;
   case '/api/landing/approve':phase='ready';reply=current();break;
   case '/api/landing/build':if(body().data.type!==112310||body().data.tokenId!=='fixture-alt'||body().data.builder!=='moshavere'||reuseTypeMode&&body().data.confirmTypeReuse!==true)throw new Error('Review type/token/provider/reuse approval was not submitted');Object.assign(data,body().data);phase='checked';reply=current();break;
   case '/api/landing/jobs/ui-fixture':reply=current();break;
   case '/api/landing/jobs/ui-fixture/retry':if(body().data.slug!=='correctedmina0817')throw new Error('Corrected slug missing');Object.assign(data,body().data);rechecks++;phase='checked';reply=current();break;
   case '/api/landing/jobs/ui-fixture/commit':if(body().confirm!==true)throw new Error('Explicit confirmation missing');phase=siteErrorMode&&commits===0?(retryMode?'failed':'uncertain'):'succeeded';commits++;reply=current();break;
   default:throw new Error('Unexpected UI fixture API route '+u.pathname);
  }
  return route.fulfill({json:reply});
 });
 const p=await ctx.newPage({viewport:{width:1440,height:1100}});p.on('pageerror',e=>errors.push(e.message));
 p.setDefaultTimeout(10000);
 await p.goto('http://127.0.0.1:3140');
 await p.getByLabel('تصویر بنر',{exact:true}).setInputFiles({name:'banner.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jK1cAAAAASUVORK5CYII=','base64')});
 await p.getByLabel('متن درخواست',{exact:true}).fill(readFileSync('tests/fixtures/mina-request.txt','utf8'));
 await p.getByRole('button',{name:'استخراج و بازبینی اطلاعات ←',exact:true}).click();
 if(await p.getByRole('button',{name:'تأیید اطلاعات',exact:true}).count())throw new Error('Redundant approval button still present');
 await p.locator('input[value="fixture-routing-token"]').waitFor();
 if(await p.getByRole('combobox',{name:'لندینگ‌ساز',exact:true}).inputValue()!=='hamkadeh')throw new Error('Hamkadeh should be default');await p.getByRole('combobox',{name:'لندینگ‌ساز',exact:true}).selectOption('moshavere');
 await p.getByRole('combobox',{name:'انتخاب توکن',exact:true}).selectOption('fixture-alt');await p.locator('input[value="fixture-alternative-token"]').waitFor();
 await p.getByLabel('اسلاگ نهایی (قابل ویرایش)',{exact:true}).fill('minahaydari0817');
 await p.getByLabel('تایپ',{exact:true}).fill('112310');
 if(reuseTypeMode){const approval=p.getByLabel('این تایپ قبلاً استفاده شده؛ استفاده دوباره از همین شماره را تأیید می‌کنم.',{exact:true});await approval.check();await p.getByLabel('تایپ',{exact:true}).fill('112311');await p.getByLabel('تایپ',{exact:true}).fill('112310');if(await approval.isChecked())throw new Error('Reuse approval survived a number change');await approval.check();}
 await p.getByText('املای نام برای درخواست‌های بعدی ذخیره شد.',{exact:true}).waitFor();if(learned!=='minahaydari0817')throw new Error('Spelling was not learned');
 await p.getByRole('button',{name:'حذف املای ذخیره‌شده',exact:true}).click();await p.getByText('املای این بلاگر از حافظه حذف شد؛ اسلاگ فعلی تغییر نکرد.',{exact:true}).waitFor();if(learned!==null)throw new Error('Spelling was not forgotten');
 if(await p.getByLabel('اسلاگ نهایی (قابل ویرایش)',{exact:true}).inputValue()!=='minahaydari0817')throw new Error('Manual slug was overwritten');
 await p.getByRole('button',{name:'آپلود و بررسی واقعی (بدون ساخت)',exact:true}).click();
 await p.getByRole('heading',{name:'بررسی واقعی تکمیل شد؛ هنوز لندینگ ساخته نشده است',exact:true}).waitFor();
 const commit=p.getByRole('button',{name:'ثبت نهایی و دریافت لینک',exact:true});if(await commit.isEnabled())throw new Error('Commit enabled before explicit confirmation');if(commits!==0)throw new Error('Check mode submitted creation');
 mkdirSync('data/qa',{recursive:true});await p.screenshot({path:'data/qa/panel-checked-fixture.png',fullPage:true});
 await p.getByLabel('اطلاعات را بررسی کردم و می‌خواهم لندینگ واقعاً ساخته شود.',{exact:true}).check();await commit.click();
 if(siteErrorMode){await p.getByRole('heading',{name:'پاسخ خطای سایت',exact:true}).waitFor();await p.getByText('اسلاگ قبلاً استفاده شده است.',{exact:true}).waitFor();await p.getByText('یک اسلاگ دیگر انتخاب کنید.',{exact:false}).waitFor();if(await p.getByRole('link',{name:'https://test.invalid/minahaydari0817',exact:true}).count())throw new Error('False final result shown');}
 else {await p.getByRole('heading',{name:'لندینگ با موفقیت ساخته شد',exact:true}).waitFor();await p.getByRole('link',{name:'https://test.invalid/minahaydari0817',exact:true}).waitFor();}
 if(retryMode){const slug=p.getByLabel('اسلاگ نهایی (قابل ویرایش)',{exact:true});if(!await slug.isEditable())throw new Error('Rejected job cannot be edited inline');await slug.fill('correctedmina0817');await p.getByRole('button',{name:'بررسی دوباره با همین بنر',exact:true}).click();await p.getByText('بنر قبلی بدون آپلود دوباره بررسی و تأیید شد.',{exact:false}).waitFor();if(uploads!==1||rechecks!==1||commits!==1)throw new Error('Retry restarted upload or final creation');await p.getByLabel('اطلاعات را بررسی کردم و می‌خواهم لندینگ واقعاً ساخته شود.',{exact:true}).check();await p.getByRole('button',{name:'ثبت نهایی و دریافت لینک',exact:true}).click();await p.getByRole('link',{name:'https://test.invalid/correctedmina0817',exact:true}).waitFor();}
 if(commits!==(retryMode?2:1))throw new Error('Commit count is incorrect');if(errors.length)throw new Error(errors.join('\n'));
 await p.screenshot({path:siteErrorMode?'data/qa/panel-site-error-fixture.png':'data/qa/panel-result-fixture.png',fullPage:true});console.log(siteErrorMode?'Site error UI passed: remote error, HTTP status and field validation shown after one explicit submit; no false success. All API mocked.':'UI fixture passed: text/image -> review -> check-only -> explicit confirmation -> two-line result. No external requests or real creation.');
}finally{await b.close();}
