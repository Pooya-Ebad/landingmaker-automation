import {chromium} from 'playwright';
import {writeFileSync,readFileSync} from 'node:fs';
const b=await chromium.connectOverCDP('http://127.0.0.1:9222',{timeout:15000});
try{
 const pages=b.contexts()[0].pages().filter(p=>p.url()==='https://new.hamkadeh.com/dashboard/showLandings/newofcopy/62229');
 let p;for(const candidate of pages){if(await candidate.locator('#EditeslugLanding').inputValue().catch(()=>'')==='daryaflora0816'){p=candidate;break;}}
 if(!p)throw new Error('Prepared review tab not found');
 const modal=p.locator('#askUserTodo');await modal.waitFor({state:'visible',timeout:15000});
 await modal.getByRole('button',{name:'کپی',exact:true}).waitFor({state:'visible',timeout:15000});
 const text=await modal.innerText();const count=text.match(/با تایپ و توکن این لندینگ\s+(\d+)\s+لندینگ دیگر وجود دارد/);
 const observed={modalText:text,duplicateCount:count?Number(count[1]):null,buttons:await modal.locator('button').evaluateAll(es=>es.map(e=>({text:e.textContent.trim(),disabled:e.disabled}))),finalCopyClicked:false};
 await modal.screenshot({path:'data/real-review/darya/confirmation.png',mask:[p.locator('input[name=token]')]});
 writeFileSync('data/real-review/darya/modal-observed.json',JSON.stringify(observed,null,2));
 const report=JSON.parse(readFileSync('data/real-review/darya/report.json','utf8'));report.duplicateCount=observed.duplicateCount;report.modalText=observed.modalText;
 writeFileSync('data/real-review/darya/report.json',JSON.stringify(report,null,2));writeFileSync('data/real-review/darya/checkpoint.json',JSON.stringify(report,null,2));
 await p.bringToFront();console.log(JSON.stringify(observed));
}finally{await b.close();}
