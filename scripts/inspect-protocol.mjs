import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
const b=await chromium.connectOverCDP('http://127.0.0.1:9222',{timeout:15000});
const out='data/protocol';mkdirSync(out,{recursive:true});
try {
 const ctx=b.contexts()[0];
 for(const [name,url,ready] of [['landing','https://new.hamkadeh.com/dashboard/showLandings/newofcopy/62088','#EditetitleLanding'],['cdn','https://cdn.hamkadeh.com/','#upload-button']]){
  const p=await ctx.newPage();const pending=[];const requests=[];
  p.on('response',response=>{
   const task=(async()=>{
    const u=new URL(response.url());const kind=response.request().resourceType();
    if(['xhr','fetch'].includes(kind)){
     let keys;try{const json=await response.json();keys=Array.isArray(json)?['array',...Object.keys(json[0]||{})]:Object.keys(json||{});}catch{}
     requests.push({origin:u.origin,path:u.pathname,method:response.request().method(),status:response.status(),keys});
    }
    if(kind==='script'&&u.origin===new URL(url).origin){const content=await response.body();writeFileSync(out+'/'+name+'-'+requests.length+'-'+u.pathname.split('/').pop(),content);}
   })().catch(()=>{});pending.push(task);
  });
  try{
   await p.goto(url,{waitUntil:'domcontentloaded',timeout:45000});await p.locator(ready).waitFor({timeout:45000});await Promise.allSettled(pending);
   const auth=await p.evaluate(()=>({localKeys:Object.keys(localStorage),sessionKeys:Object.keys(sessionStorage)}));
   const cookies=(await ctx.cookies(url)).map(c=>({name:c.name,domain:c.domain,httpOnly:c.httpOnly}));
   console.log(JSON.stringify({name,requests,auth,cookies}));writeFileSync(out+'/'+name+'-requests.json',JSON.stringify(requests,null,2));
  }finally{await p.close();}
 }
}finally{await b.close();}
