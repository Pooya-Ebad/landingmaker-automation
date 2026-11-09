import {chromium} from 'playwright';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const config=JSON.parse(readFileSync('config/defaults.json','utf8'));
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{
 const ctx=await browser.newContext({serviceWorkers:'block'});const errors=[];let remembered=0,learned=0;
 const suggestion=blogger=>{
  const unknown=blogger.includes('ژژژ'),hanieh=blogger.includes('هانیه');const givenName=unknown?'ژژژ':hanieh?'هانیه':'مهرنوش',familyName=unknown?'عزیزی':hanieh?'نوری':'ماهینی';
  const base=unknown?'zhzhzhazizi':hanieh?'haniehnouri':'mehrnoushmahini';
  return {slug:base+'0818',slugDate:'1405/08/18',remembered:false,slugAnalysis:{givenName,familyName,givenLatin:hanieh?'hanieh':'mehrnoush',familyLatin:hanieh?'nouri':'mahini',familyKnown:true,confidence:unknown?'low':'high',unknownParts:unknown?['ژژژ']:[],source:'given',canLearnGiven:!unknown,defaultSlug:base+'0818',alternatives:unknown||hanieh?[]:['mehrnooshmahini0818','mehrnoshmahini0818']}};
 };
 await ctx.route('**/*',async route=>{const u=new URL(route.request().url());if(u.origin!=='http://127.0.0.1:3140')return route.abort();if(!u.pathname.startsWith('/api/'))return route.continue();const body=()=>JSON.parse(route.request().postData()||'{}');let reply;
  switch(u.pathname){
   case '/api/bootstrap':reply={csrf:'fixture'};break;
   case '/api/settings':reply={config,counters:{rezaei:771113},tokenOptions:{rezaei:[{id:'',company:'adwise',label:'توکن اصلی'}]},locked:null};break;
   case '/api/connection':reply={configured:true};break;
   case '/api/landing/batches/active':reply=null;break;
   case '/api/landing/type-status':reply={used:false,count:0};break;
   case '/api/uploads':reply={id:'fixture-upload'};break;
   case '/api/tokens/selected':reply={value:'fixture-routing-token'};break;
   case '/api/landing/slug':reply=suggestion(body().blogger);break;
   case '/api/landing/preview':reply={id:'fixture-job',status:'review',data:{blogger:'مهرنوش ماهینی',date:'1405/08/18',type:771113,company:'adwise',supervisor:'rezaei',category:'marital',...suggestion('مهرنوش ماهینی')}};break;
   case '/api/landing/slug-memory':assert.equal(body().slug,'mehrnoshmahini0818');remembered++;reply={remembered:true};break;
   case '/api/landing/given-memory':assert.equal(body().blogger,'مهرنوش ماهینی');learned++;reply={givenName:'مهرنوش',givenLatin:'mehrnosh'};break;
   default:throw Error('Unexpected names UI API '+u.pathname);
  }
  await route.fulfill({json:reply});
 });
 const p=await ctx.newPage({viewport:{width:1440,height:1100}});p.setDefaultTimeout(10000);p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:3140');
 const file={name:'fixture.png',mimeType:'image/png',buffer:Buffer.from('fixture')};
 await p.getByLabel('تصویر بنر',{exact:true}).setInputFiles(file);await p.getByLabel('متن درخواست',{exact:true}).fill('مهرنوش ماهینی');await p.getByRole('button',{name:'استخراج و بازبینی اطلاعات ←',exact:true}).click();
 await p.getByRole('button',{name:'mehrnoshmahini0818',exact:true}).click();await p.getByText('املای انتخاب‌شده برای همین بلاگر ذخیره شد.',{exact:true}).waitFor();
 await p.getByRole('button',{name:'یادگیری املای «مهرنوش» برای بلاگرهای هم‌نام',exact:true}).click();await p.getByText('املای «مهرنوش» برای پیشنهادهای بعدی یاد گرفته شد: mehrnosh',{exact:true}).waitFor();assert.equal(remembered,1);assert.equal(learned,1);
 await p.getByLabel('نام بلاگر',{exact:true}).fill('هانیه نوری');assert.equal(await p.getByLabel('اسلاگ نهایی (قابل ویرایش)',{exact:true}).inputValue(),'mehrnoshmahini0818');
 await p.getByRole('button',{name:'ساخت گروهی',exact:true}).click();await p.getByLabel('سرپرست گروه',{exact:true}).selectOption('rezaei');await p.getByLabel('بنر درخواست 1',{exact:true}).setInputFiles(file);await p.getByLabel('متن درخواست 1',{exact:true}).fill('مهرنوش ماهینی');await p.getByRole('button',{name:'استخراج و بازبینی همین درخواست',exact:true}).click();
 await p.getByLabel('نام بلاگر',{exact:true}).fill('هانیه نوری');await p.locator('input[value="haniehnouri0818"]').waitFor();
 await p.getByLabel('نام بلاگر',{exact:true}).fill('مهرنوش ماهینی');await p.getByRole('button',{name:'mehrnoshmahini0818',exact:true}).click();await p.getByText('املای انتخاب‌شده برای همین بلاگر ذخیره شد.',{exact:true}).waitFor();
 await p.getByLabel('نام بلاگر',{exact:true}).fill('ژژژ عزیزی');await p.getByText('املای «ژژژ» در واژه‌نامه مشخص نیست؛ پیشنهاد را پیش از ساخت بررسی کنید.',{exact:true}).waitFor();assert.equal(await p.getByLabel('اسلاگ نهایی (قابل ویرایش)',{exact:true}).inputValue(),'mehrnoshmahini0818');
 assert.deepEqual(errors,[]);mkdirSync('data/qa',{recursive:true});await p.screenshot({path:'data/qa/name-engine-fixture.png',fullPage:true});console.log('Name UI passed: alternatives, explicit given-name learning, unknown-name warning, batch updates and manual slug preservation. All writes mocked.');
}finally{await browser.close();}
