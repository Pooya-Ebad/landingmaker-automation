import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
const b=await chromium.connectOverCDP('http://127.0.0.1:9222',{timeout:10000});
try {
 const ctx=b.contexts()[0];if(!ctx)throw new Error('No browser context');
 console.log(JSON.stringify({connected:true,matchingPages:ctx.pages().filter(p=>/^https:\/\/(new|cdn)\.hamkadeh\.com\//.test(p.url())).map(p=>({url:p.url().split('?')[0]}))}));
 if(process.argv.includes('--pages')){
  mkdirSync('data/inspection',{recursive:true});
  for(const [name,url] of Object.entries({landing:'https://new.hamkadeh.com/dashboard/showLandings/newofcopy/62415',cdn:'https://cdn.hamkadeh.com/'})){
   const p=await ctx.newPage();try{
    await p.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
    await p.locator(name==='landing'?'#EditetitleLanding':'#upload-button').waitFor({timeout:45000}).catch(()=>{});
    const report={url:p.url().split('?')[0],title:await p.title(),fields:await p.locator('input,select,button,label,[role=combobox]').evaluateAll(es=>es.map(e=>({tag:e.tagName,id:e.id,name:e.getAttribute('name'),type:e.getAttribute('type'),role:e.getAttribute('role'),label:e.getAttribute('aria-label'),text:['BUTTON','LABEL'].includes(e.tagName)?e.textContent?.trim():undefined,options:e.tagName==='SELECT'?[...(e).querySelectorAll('option')].map(o=>({text:o.textContent,value:o.value})):undefined})))};
    writeFileSync(`data/inspection/connected-${name}.json`,JSON.stringify(report,null,2));await p.screenshot({path:`data/inspection/connected-${name}.png`,fullPage:true,mask:[p.locator('input[name=token],input[id="72"],input[type=password]')]});console.log(JSON.stringify({page:name,...report}));
   }catch(e){console.log(JSON.stringify({page:name,error:e.message.split('\n')[0]}));}finally{await p.close();}
  }
 }
}finally{await b.close();}
