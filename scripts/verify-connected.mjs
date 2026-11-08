import {chromium} from 'playwright';
import {readFileSync} from 'node:fs';
const config=JSON.parse(readFileSync('config/defaults.json','utf8'));
const b=await chromium.connectOverCDP('http://127.0.0.1:9222');
try {
 for(const [category,landing] of Object.entries(config.landingPages)){
  const p=await b.contexts()[0].newPage();try{
   await p.goto(landing.url,{waitUntil:'domcontentloaded',timeout:60000});await p.locator(config.selectors.title).waitFor({timeout:60000});
   const counts={};for(const k of ['title','slug','advanced','mainPic','type','token','modal'])counts[k]=await p.locator(config.selectors[k]).count();
   const group=await p.getByText(config.selectors.groupLabel,{exact:true}).locator('..').getByRole('combobox').count();
   console.log(JSON.stringify({category,correctUrl:p.url()===landing.url,counts,group,requiredFields:await p.locator('[required]').count()}));
  }catch(e){console.log(JSON.stringify({category,error:e.message.split('\n')[0]}));}finally{await p.close();}
 }
}finally{await b.close();}
