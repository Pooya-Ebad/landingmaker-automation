import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
const b=await chromium.connectOverCDP('http://127.0.0.1:9222');
const p=await b.contexts()[0].newPage();
try{
 await p.goto('https://new.hamkadeh.com/dashboard/showLandings/newofcopy/62415',{waitUntil:'domcontentloaded'});
 await p.locator('#EditetitleLanding').waitFor({timeout:60000});
 const report=await p.evaluate(()=>{
  const chain=(e)=>{const a=[];for(let i=0;e&&i<6;i++,e=e.parentElement)a.push({tag:e.tagName,id:e.id,class:e.className,labels:[...e.querySelectorAll(':scope > label')].map(l=>l.textContent)});return a;};
  return {advanced:[...document.querySelectorAll('select')].slice(0,2).map(e=>({html:e.parentElement.outerHTML})),group:[...document.querySelectorAll('[role=combobox]')].map(chain),fields:[...document.querySelectorAll('input[name=type],input[name=token],input[name=mainPic]')].map(e=>({id:e.id,name:e.name,visible:!!e.getClientRects().length,ancestors:chain(e)})),modalTriggers:[...document.querySelectorAll('[data-bs-target]')].map(e=>({tag:e.tagName,id:e.id,target:e.getAttribute('data-bs-target'),text:e.textContent.trim()})),dialogs:[...document.querySelectorAll('.modal')].map(e=>({id:e.id,role:e.getAttribute('role'),buttons:[...e.querySelectorAll('button')].map(b=>b.textContent.trim())}))};
 });
 mkdirSync('data/inspection',{recursive:true});writeFileSync('data/inspection/structure.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await p.close();await b.close();}
