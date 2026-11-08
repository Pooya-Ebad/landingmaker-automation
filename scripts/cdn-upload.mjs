import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
const b=await chromium.connectOverCDP('http://127.0.0.1:9222',{timeout:15000});
const ctx=b.contexts()[0];if(!ctx)throw new Error('No browser context');
const p=await ctx.newPage();p.setDefaultTimeout(20000);
try {
 await p.goto('https://cdn.hamkadeh.com/',{waitUntil:'domcontentloaded'});
 await p.locator('#upload-button').waitFor();
 if(new URL(p.url()).origin!=='https://cdn.hamkadeh.com')throw new Error('CDN sign-in required');
 let chooser=false;p.on('filechooser',()=>{chooser=true;});
 await p.locator('#upload-button').click();
 const report={chooser,url:p.url(),buttons:await p.locator('button').evaluateAll(es=>es.filter(e=>e.getClientRects().length).map(e=>({id:e.id,text:e.textContent.trim(),label:e.getAttribute('aria-label')}))),inputs:await p.locator('input').evaluateAll(es=>es.map(e=>({id:e.id,type:e.type,name:e.name}))),dialogs:await p.locator('[role=dialog],dialog,.dialog').evaluateAll(es=>es.map(e=>({tag:e.tagName,id:e.id,class:e.className,text:e.textContent.slice(0,1500)})))};
 mkdirSync('data/inspection',{recursive:true});writeFileSync('data/inspection/cdn-upload-panel.json',JSON.stringify(report,null,2));await p.screenshot({path:'data/inspection/cdn-upload-panel.png',fullPage:true});console.log(JSON.stringify(report));
}finally{await p.close();await b.close();}
