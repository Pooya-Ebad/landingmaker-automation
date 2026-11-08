import {chromium} from 'playwright';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const config=JSON.parse(readFileSync('config/defaults.json','utf8'));
const state={config,counters:{doosti:112297},tokenOptions:{doosti:[{id:'',label:'توکن اصلی',company:'trend',masked:'••••'}]},locked:null};
const b=await chromium.launch({headless:true,channel:'msedge'});
try{
 const ctx=await b.newContext({serviceWorkers:'block'});const errors=[];let additions=0,replacements=0,refs=0;
 await ctx.route('**/*',async route=>{
  const u=new URL(route.request().url());if(u.origin!=='http://127.0.0.1:3140')return route.abort();if(!u.pathname.startsWith('/api/'))return route.continue();
  const body=()=>JSON.parse(route.request().postData()||'{}');let reply;
  switch(u.pathname){
   case '/api/bootstrap':reply={csrf:'fixture'};break;
   case '/api/settings':assert.equal(route.request().method(),'GET');reply=state;break;
   case '/api/connection':reply={configured:true};break;
   case '/api/landing/batches/active':reply=null;break;
   case '/api/settings/tokens':{const d=body();assert.equal(d.supervisor,'doosti');if(d.mode==='add'){assert.equal(d.companyName,'شرکت جدید آزمایشی');assert.equal(d.value,'new-fixture-token');additions++;state.config.companies.company_fixture={label:d.companyName,aliases:[d.companyName]};state.tokenOptions.doosti.push({id:'',company:'company_fixture',label:'توکن اصلی',masked:'••••'});}else{assert.equal(d.company,'company_fixture');assert.equal(d.tokenId,undefined);assert.equal(d.value,'replacement-fixture-token');replacements++;}reply=state;break;}
   case '/api/settings/references':{const d=body();assert.equal(Object.keys(d.landingPages).length,5);assert.ok(Object.values(d.landingPages).some(p=>p.label==='بازآفرینی'&&p.url.endsWith('/99999')&&!p.moshavereUrl));assert.equal(d.landingPages.general.moshavereUrl,'https://new.moshavere.me/dashboard/showLandings/newofcopy/13550');assert.ok(!('counters' in d));state.config.landingPages=d.landingPages;refs++;reply=state;break;}
   default:throw Error('Unexpected settings fixture route '+u.pathname);
  }
  await route.fulfill({json:reply});
 });
 const p=await ctx.newPage({viewport:{width:1440,height:1100}});p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:3140');await p.getByRole('button',{name:'تنظیمات',exact:true}).click();
 assert.equal(await p.locator('input[type=number]:visible').count(),0);assert.equal(await p.locator('.configEditor').count(),0);
 assert.equal(await p.getByRole('combobox',{name:'توکن مورد جایگزینی',exact:true}).count(),0);
 await p.getByRole('button',{name:'افزودن توکن جدید',exact:true}).click();await p.getByLabel('نام شرکت جدید',{exact:true}).fill('شرکت جدید آزمایشی');await p.getByLabel('مقدار توکن',{exact:true}).fill('new-fixture-token');await p.getByRole('button',{name:'ثبت شرکت و توکن',exact:true}).click();await p.getByText('شرکت جدید و توکن آن اضافه شدند.',{exact:true}).waitFor();
 await p.getByRole('button',{name:'جایگزینی توکن',exact:true}).click();await p.getByRole('combobox',{name:'شرکت توکن',exact:true}).selectOption('company_fixture');await p.getByLabel('مقدار توکن',{exact:true}).fill('replacement-fixture-token');await p.getByRole('button',{name:'ذخیره توکن جایگزین',exact:true}).click();await p.getByText('توکن جایگزین شد.',{exact:true}).waitFor();
 await p.getByLabel('آدرس مشاوره کلی',{exact:true}).fill('https://new.moshavere.me/dashboard/showLandings/newofcopy/13550');
 await p.getByRole('button',{name:'+ افزودن مرجع جدید',exact:true}).click();await p.getByLabel('نام مرجع مرجع جدید',{exact:true}).fill('بازآفرینی');await p.getByLabel('آدرس مرجع بازآفرینی',{exact:true}).fill('https://new.hamkadeh.com/dashboard/showLandings/newofcopy/99999');await p.getByRole('button',{name:'ذخیره مرجع‌ها',exact:true}).click();await p.getByText('مرجع‌های ساخت ذخیره شدند.',{exact:true}).waitFor();
 assert.equal(additions,1);assert.equal(replacements,1);assert.equal(refs,1);assert.deepEqual(errors,[]);mkdirSync('data/qa',{recursive:true});await p.screenshot({path:'data/qa/settings-simple-fixture.png',fullPage:true});console.log('Settings UI passed: no counter/JSON editor, add and replace named token, add reference. All writes mocked.');
}finally{await b.close();}
