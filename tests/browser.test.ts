import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import defaults from '../config/defaults.json';
import {HamkadehBuilder} from '../server/adapters';
const fixture=(message:string,success=true)=>`<!doctype html><html lang="fa"><head><meta charset="UTF-8"></head><body>
 <input id="EditetitleLanding"><input id="EditeslugLanding"><select id="advanced"><option value="0">خیر</option><option value="1">بله</option></select>
 <input role="combobox" aria-label="انتخاب گروه"><div role="option" onclick="this.hidden=true">وفاداران</div>
 <button data-bs-target="#collapse2" onclick="document.getElementById('collapse2').hidden=false">محتوای لندینگ</button>
 <div id="collapse2" class="accordion-collapse" hidden><input name="mainPic" oninput="document.querySelector('#collapse20 input[name=mainPic]').value=this.value"></div>
 <button data-bs-target="#collapse7" onclick="document.getElementById('collapse7').hidden=false">ملزومات لندینگ</button>
 <div id="collapse7" class="accordion-collapse" hidden><input id="71" name="type"><input name="token"></div>
 <button data-bs-target="#collapse20" onclick="document.getElementById('collapse20').hidden=false">محتوای لندینگ دوم</button>
 <div id="collapse20" class="accordion-collapse" hidden><input name="mainPic"><input id="71" name="type"><input name="token"></div>
 <button onclick="document.getElementById('confirm').hidden=false">ایجاد کپی</button>
 <div id="confirm" role="dialog" hidden><p>${message}</p><a href="https://new.hamkadeh.com/view/1">مشاهده</a><button onclick="window.copies=(window.copies||0)+1; ${success?"document.getElementById('success').hidden=false;":""}">کپی</button></div>
 <div id="success" hidden>با موفقیت ثبت شد</div></body></html>`;
test('real browser: adapter copies only explicit zero and requires fresh success + final page proof',async()=>{
 const b=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'msedge'});
 try {
 for(const [message,expected,success,review] of [
  ['با تایپ و توکن این لندینگ ۰ لندینگ دیگر وجود دارد',1,true],
  ['با تایپ و توکن این لندینگ ۱ لندینگ دیگر وجود دارد',0,true],
  ['پیام نامعتبر 0',0,true],
  ['',0,true],
  ['با تایپ و توکن این لندینگ 0 لندینگ دیگر وجود دارد با تایپ و توکن این لندینگ 1 لندینگ دیگر وجود دارد',0,true],
  ['با تایپ و توکن این لندینگ 0 لندینگ دیگر وجود دارد',1,false],
  ['با تایپ و توکن این لندینگ 0 لندینگ دیگر وجود دارد',0,false,true],
 ] as const){
  const ctx=await b.newContext();ctx.setDefaultTimeout(3000);let copies=0;
  await ctx.exposeFunction('recordCopy',()=>{copies++;});
  await ctx.addInitScript(()=>{Object.defineProperty(window,'copies',{set:()=>{void (window as any).recordCopy();},get:()=>0});});
  await ctx.route('https://new.hamkadeh.com/**',r=>r.fulfill({contentType:'text/html',body:fixture(message,success)}));
  await ctx.route('https://landing.hamkadeh.com/**',r=>r.fulfill({contentType:'text/html',body:'<html>112292 token-fixture-only</html>'}));
  const c:any=structuredClone(defaults);Object.assign(c.selectors,{advanced:'#advanced',success:'#success',successText:'با موفقیت ثبت شد',groupLabel:'انتخاب گروه',modal:'[role=dialog]'});
  const d={category:'general',title:'کلی 112292 بهار / وفاداران',slug:'bahar0816',type:112292,supervisor:'vafadaran'};
  let result:any,error:any;
  try{result=await new HamkadehBuilder().build(ctx,d,c,'token-fixture-only','https://cdn.hamkadeh.com/banner.jpg',()=>{},()=>{if(review)throw new Error('Review must never commit');},{stopBeforeCopy:review});}catch(e){error=e;}
  assert.equal(copies,expected,`message: ${message}; error: ${error?.message}`);
  if(review){assert.equal(result.status,'awaiting_user_review');assert.equal(result.duplicateCount,0);assert.equal(result.finalCopyClicked,false);const p=ctx.pages().find(p=>p.url()===c.landingPages.general.url)!;assert.ok(p);assert.equal(await p.locator('#collapse20 input[name=mainPic]').inputValue(),'');assert.equal(await p.locator(c.selectors.mainPic).inputValue(),'https://cdn.hamkadeh.com/banner.jpg');}
  else if(expected===1&&success)assert.equal(result.url,'https://landing.hamkadeh.com/bahar0816');
  else {assert.ok(error);if(expected===1)assert.equal(error.uncertain,true);}
  if(message.includes('۱')){assert.equal(error.details.count,1);assert.equal(error.details.viewLinks.length,1);}
  await ctx.close();
 }
 }finally{await b.close();}
});
