import {chromium} from 'playwright';
import {mkdirSync} from 'node:fs';
mkdirSync('data/qa',{recursive:true});
const browser=await chromium.launch({headless:true,channel:'msedge'});
try {
 const p=await browser.newPage({viewport:{width:1440,height:1100}});
 const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:3140');await p.getByRole('heading',{name:'لندینگ جدید',exact:true}).waitFor();
 await p.screenshot({path:'data/qa/desktop.png',fullPage:true});
 await p.getByRole('button',{name:'تنظیمات',exact:true}).click();await p.getByRole('heading',{name:'تنظیمات برنامه'}).waitFor();
 await p.screenshot({path:'data/qa/settings.png',fullPage:true});
 await p.getByRole('button',{name:'تاریخچه عملیات',exact:true}).click();await p.getByRole('heading',{name:'تاریخچه عملیات',exact:true}).waitFor();
 await p.setViewportSize({width:390,height:844});await p.getByRole('button',{name:'ساخت لندینگ',exact:true}).click();await p.screenshot({path:'data/qa/mobile.png',fullPage:true});
 const overflow=await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth);if(overflow)throw new Error('Mobile layout overflows');
 if(errors.length)throw new Error(errors.join('\n'));console.log('Desktop, settings, history and mobile rendered; no browser runtime errors or mobile overflow.');
}finally{await browser.close();}
