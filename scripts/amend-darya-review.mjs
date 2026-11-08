import {chromium} from 'playwright';
import {readFileSync,writeFileSync} from 'node:fs';
const b=await chromium.connectOverCDP('http://127.0.0.1:9222',{timeout:15000});
try{
 let p;
 const candidates=b.contexts()[0].pages().filter(page=>page.url()==='https://new.hamkadeh.com/dashboard/showLandings/newofcopy/62229');
 for(const page of candidates){if((await page.locator('#EditetitleLanding').inputValue({timeout:3000}).catch(()=>''))==='زناشویی 771111 دریا فلورا / رضایی'){p=page;break;}}
 if(!p)throw new Error('Prepared landing tab not found');
 p.setDefaultTimeout(20000);
 if(process.argv.includes('--apply')){
  const modal=p.locator('#askUserTodo');if(await modal.isVisible()){await modal.getByRole('button',{name:'انصراف',exact:true}).click();await modal.waitFor({state:'hidden'});}
  const parts=new Intl.DateTimeFormat('en-US-u-ca-persian',{timeZone:'Asia/Tehran',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const suffix=['month','day'].map(key=>parts.find(p=>p.type===key).value).join('');
  const newSlug='daryaflora'+suffix;
  const main=p.locator('#collapse2 input[name=mainPic]');const original=await main.inputValue();
  await p.locator('#EditeslugLanding').fill(newSlug);
  const secondary=p.locator('#collapse20 input[name=mainPic]');if(await secondary.count()!==1)throw new Error('Second image field is not unique');
  if(!await secondary.isVisible())await p.locator('button[data-bs-target="#collapse20"]').click();
  await secondary.fill('');
  if(await secondary.inputValue()!==''||await main.inputValue()!==original)throw new Error('Main/secondary image verification failed');
  if(await p.locator('#EditeslugLanding').inputValue()!==newSlug)throw new Error('Slug verification failed');
  await p.getByRole('button',{name:'ایجاد کپی',exact:true}).click();await modal.getByRole('button',{name:'کپی',exact:true}).waitFor({state:'visible'});
  const text=await modal.innerText();const matches=text.match(/با تایپ و توکن این لندینگ\s+(\d+)\s+لندینگ دیگر وجود دارد/);
  const report={slug:newSlug,secondImageEmpty:await secondary.inputValue()==='',primaryImageUnchanged:await main.inputValue()===original,duplicateCount:matches?Number(matches[1]):null,finalCopyClicked:false,modalText:text};
  writeFileSync('data/real-review/darya/amendment.json',JSON.stringify(report,null,2));
  const previous=JSON.parse(readFileSync('data/real-review/darya/report.json','utf8'));Object.assign(previous,report);previous.request.slug=newSlug;writeFileSync('data/real-review/darya/report.json',JSON.stringify(previous,null,2));
  await p.bringToFront();console.log(JSON.stringify(report));
 }
 const fields=await p.evaluate(()=>[...document.querySelectorAll('input')].filter(e=>/slug/i.test(e.id+' '+e.name)||/آدرس|ادرس/.test([...e.parentElement.querySelectorAll(':scope > label')].map(e=>e.textContent).join(' '))).map(e=>({id:e.id,name:e.name,placeholder:e.getAttribute('placeholder'),value:e.value,labels:[...e.parentElement.querySelectorAll(':scope > label')].map(e=>e.textContent),outer:e.parentElement.outerHTML})));
 console.log(JSON.stringify({date:new Intl.DateTimeFormat('en-US-u-ca-persian',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),fields}));
}finally{await b.close();}
