import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
mkdirSync('data/inspection',{recursive:true});
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'msedge'});
try {for(const [name,url] of Object.entries({landing:'https://new.hamkadeh.com/dashboard/showLandings/newofcopy/62415',cdn:'https://cdn.hamkadeh.com/'})){
 const p=await browser.newPage();try{await p.goto(url,{waitUntil:'domcontentloaded',timeout:30000});await p.locator('input,select,button,[role=combobox]').first().waitFor({state:'visible',timeout:15000}).catch(()=>{});const report={url:p.url(),title:await p.title(),fields:await p.locator('input,select,button,[role=combobox]').evaluateAll(es=>es.map(e=>({tag:e.tagName,id:e.id,name:e.getAttribute('name'),role:e.getAttribute('role'),label:e.getAttribute('aria-label'),text:e.tagName==='BUTTON'?e.textContent?.trim():undefined})))};writeFileSync(`data/inspection/${name}.json`,JSON.stringify(report,null,2));await p.screenshot({path:`data/inspection/${name}.png`,fullPage:true});console.log(name,JSON.stringify(report));}catch{console.log(name,'Network/browser access failed; authenticated site not inspected.');}finally{await p.close();}
 }}finally{await browser.close();}
