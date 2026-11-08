import {chromium} from 'playwright';
import {readFileSync,mkdirSync} from 'node:fs';
const defaults=JSON.parse(readFileSync('config/defaults.json','utf8'));
const b=await chromium.launch({headless:true,channel:'msedge'});
try{
 const ctx=await b.newContext({serviceWorkers:'block'});let phase='review',commits=0,learned=null;const errors=[];
 const data={blogger:'مینا حیدری',date:'1405/08/17',writer:'قربانی',idea:'قدیم',subject:'خیانت',scenarioName:'خواب زمستانی',stories:'2',style:'دایرکت طولانی',company:'trend',supervisor:'doosti',category:'infidelity',type:112297,slug:'minaheydari0817',title:'خیانت 112297 مینا حیدری / دوستی'};
 data.slugDate='1405/08/17';
 const current=()=>({id:'ui-fixture',status:phase,data,result:phase==='succeeded'?{url:'https://test.invalid/'+data.slug}:phase==='checked'?{mode:'check',duplicateCount:0,finalCreateSent:false}:null});
 await ctx.route('**/*',async route=>{
  const u=new URL(route.request().url());
  if(u.origin!=='http://127.0.0.1:3140')return route.abort();
  if(!u.pathname.startsWith('/api/'))return route.continue();
  const body=()=>JSON.parse(route.request().postData()||'{}');let reply;
  switch(u.pathname){
   case '/api/bootstrap':reply={csrf:'test-only'};break;
   case '/api/landing/batches/active':reply=null;break;
   case '/api/settings':reply={config:defaults,counters:{doosti:112297},tokenOptions:{doosti:[{id:'',label:'توکن اصلی',company:'trend',masked:'•••••••••••••'},{id:'fixture-alt',label:'کمپین دوم',company:'trend',masked:'••••'}]},locked:['checked','uploading','checking'].includes(phase)?{job:'ui-fixture'}:null};break;
   case '/api/tokens/selected':reply={value:body().tokenId==='fixture-alt'?'fixture-alternative-token':'fixture-routing-token'};break;
   case '/api/connection':reply={configured:true};break;
   case '/api/uploads':reply={id:'mock-upload'};break;
   case '/api/landing/preview':reply=current();break;
   case '/api/landing/slug':reply={slug:data.slug,slugDate:'1405/08/17'};break;
   case '/api/landing/slug-memory':if(route.request().method()==='DELETE'){learned=null;reply={remembered:false};}else{if(body().blogger!==data.blogger||body().slugDate!=='1405/08/17')throw new Error('Wrong blogger/date memory');learned=body().slug;reply={remembered:true};}break;
   case '/api/landing/approve':phase='ready';reply=current();break;
   case '/api/landing/build':if(body().data.type!==112310||body().data.tokenId!=='fixture-alt')throw new Error('Review type/token was not submitted');Object.assign(data,body().data);phase='checked';reply=current();break;
   case '/api/landing/jobs/ui-fixture':reply=current();break;
   case '/api/landing/jobs/ui-fixture/commit':if(body().confirm!==true)throw new Error('Explicit confirmation missing');phase='succeeded';commits++;reply=current();break;
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
 await p.getByRole('combobox',{name:'انتخاب توکن',exact:true}).selectOption('fixture-alt');await p.locator('input[value="fixture-alternative-token"]').waitFor();
 await p.getByLabel('اسلاگ نهایی (قابل ویرایش)',{exact:true}).fill('minahaydari0817');
 await p.getByLabel('تایپ',{exact:true}).fill('112310');
 await p.getByText('املای نام برای درخواست‌های بعدی ذخیره شد.',{exact:true}).waitFor();if(learned!=='minahaydari0817')throw new Error('Spelling was not learned');
 await p.getByRole('button',{name:'حذف املای ذخیره‌شده',exact:true}).click();await p.getByText('املای این بلاگر از حافظه حذف شد؛ اسلاگ فعلی تغییر نکرد.',{exact:true}).waitFor();if(learned!==null)throw new Error('Spelling was not forgotten');
 if(await p.getByLabel('اسلاگ نهایی (قابل ویرایش)',{exact:true}).inputValue()!=='minahaydari0817')throw new Error('Manual slug was overwritten');
 await p.getByRole('button',{name:'آپلود و بررسی واقعی (بدون ساخت)',exact:true}).click();
 await p.getByRole('heading',{name:'بررسی واقعی تکمیل شد؛ هنوز لندینگ ساخته نشده است',exact:true}).waitFor();
 const commit=p.getByRole('button',{name:'ثبت نهایی و دریافت لینک',exact:true});if(await commit.isEnabled())throw new Error('Commit enabled before explicit confirmation');if(commits!==0)throw new Error('Check mode submitted creation');
 mkdirSync('data/qa',{recursive:true});await p.screenshot({path:'data/qa/panel-checked-fixture.png',fullPage:true});
 await p.getByLabel('اطلاعات را بررسی کردم و می‌خواهم لندینگ واقعاً ساخته شود.',{exact:true}).check();await commit.click();
 await p.getByRole('heading',{name:'لندینگ با موفقیت ساخته شد',exact:true}).waitFor();await p.getByRole('link',{name:'https://test.invalid/minahaydari0817',exact:true}).waitFor();
 if(commits!==1)throw new Error('Commit count is incorrect');if(errors.length)throw new Error(errors.join('\n'));
 await p.screenshot({path:'data/qa/panel-result-fixture.png',fullPage:true});console.log('UI fixture passed: text/image -> review -> check-only -> explicit confirmation -> two-line result. No external requests or real creation.');
}finally{await b.close();}
