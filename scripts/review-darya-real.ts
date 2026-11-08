import {chromium} from 'playwright';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {createDecipheriv} from 'node:crypto';
import path from 'node:path';
import defaults from '../config/defaults.json';
import {parseRequest,makeCurrentSlug,validatePage} from '../server/core';
import {HfsUpload} from '../server/hfs-upload';
import {HamkadehBuilder} from '../server/adapters';

// This entry point deliberately never calls JobManager.build or increments counters.
// The builder stops unconditionally inside the confirmation modal.
const option=(flag:string,fallback:string)=>{const index=process.argv.indexOf(flag);return index<0?fallback:process.argv[index+1];};
const reviewName=option('--name','darya');if(!/^[a-z0-9-]+$/.test(reviewName))throw new Error('Invalid review name');
const requestFile=path.resolve(option('--request','tests/fixtures/darya-request.txt'));
const bannerFile=path.resolve(option('--image','#دریا_فلورا (14).jpg'));
const dir=path.resolve('data/real-review',reviewName);mkdirSync(dir,{recursive:true});
const checkpoint=path.join(dir,'checkpoint.json');
if(existsSync(checkpoint))throw new Error('A real review is already checkpointed; inspect its open tab before starting again.');
const db=new DatabaseSync(path.resolve('data/app.sqlite'),{readOnly:true});
let c:any,token:string,before:number;
try{
 const stored=JSON.parse((db.prepare('SELECT value FROM settings WHERE id=1').get() as any).value);
 if(db.prepare('SELECT job FROM lease').get())throw new Error('Another job holds the build lease');
 before=(db.prepare('SELECT next FROM counter WHERE id=1').get() as any).next;
 const landingPages=structuredClone(stored.landingPages);
 for(const [key,value] of Object.entries(defaults.landingPages))landingPages[key].aliases=[...new Set([...(landingPages[key].aliases||[]),...('aliases' in value?value.aliases:[])])];
 c={...stored,landingPages,parserAliases:{...defaults.parserAliases,...stored.parserAliases},slug:{...stored.slug,dictionary:{...defaults.slug.dictionary,...stored.slug.dictionary}},selectors:{...defaults.selectors,...stored.selectors}};
}finally{db.close();}
const raw=readFileSync(requestFile,'utf8');const parsed:any=parseRequest(raw,c);
if(!c.landingPages[parsed.category]||!c.supervisors[parsed.supervisor]||!c.companies[parsed.company]||!parsed.blogger||!/^\d+$/.test(parsed.requestedType||''))throw new Error('Request metadata needs manual review');
const encrypted=c.tokens[parsed.supervisor]?.[parsed.company];if(!encrypted)throw new Error('No token for the requested supervisor/company');
const [iv,tag,body]=encrypted.split('.').map((s:string)=>Buffer.from(s,'base64'));
const decipher=createDecipheriv('aes-256-gcm',readFileSync('data/secret.key'),iv);decipher.setAuthTag(tag);token=Buffer.concat([decipher.update(body),decipher.final()]).toString('utf8');
const type=Number(parsed.requestedType);if(!Number.isSafeInteger(type)||type<1)throw new Error('Invalid requested type');
const data={...parsed,type,slug:makeCurrentSlug(parsed.blogger,c),title:`${c.landingPages[parsed.category].label} ${type} ${parsed.blogger} / ${c.supervisors[parsed.supervisor].label}`};
validatePage(c.landingPages[data.category].url);
const b=await chromium.connectOverCDP('http://127.0.0.1:9222',{timeout:15000});
try{
 const ctx=b.contexts()[0];if(!ctx)throw new Error('Chrome context not found');ctx.setDefaultTimeout(45000);
 writeFileSync(checkpoint,JSON.stringify({stage:'upload-starting',createdAt:new Date().toISOString(),type:data.type,slug:data.slug,finalCopyClicked:false}));
 const image=await new HfsUpload().upload(ctx,bannerFile,c);
 writeFileSync(checkpoint,JSON.stringify({stage:'banner-verified',imageUrl:image,type:data.type,slug:data.slug,finalCopyClicked:false}));
 console.log(JSON.stringify({stage:'banner-verified',imageUrl:image}));
 const result=await new HamkadehBuilder().build(ctx,data,c,token,image,()=>console.log('Duplicate-check modal requested'),()=>{throw new Error('Final copy is prohibited for this review');},{stopBeforeCopy:true});
 let p;for(const candidate of ctx.pages().filter(p=>p.url()===result.pageUrl)){if(await candidate.locator(c.selectors.title).inputValue()===data.title){p=candidate;break;}}
 let secondImageEmpty:boolean|null=null;
 if(p){secondImageEmpty=await p.locator(c.selectors.secondaryMainPic).count()?await p.locator(c.selectors.secondaryMainPic).inputValue()==='':null;await p.bringToFront();await p.locator(c.selectors.modal).screenshot({path:path.join(dir,'confirmation.png'),mask:[p.locator('input[name=token]')]});}
 const check=new DatabaseSync(path.resolve('data/app.sqlite'),{readOnly:true});let after;
 try{after=(check.prepare('SELECT next FROM counter WHERE id=1').get() as any).next;}finally{check.close();}
 const report={...result,secondImageEmpty,group:c.supervisors[parsed.supervisor].group,request:{...parsed,type:data.type,title:data.title,slug:data.slug,token:'•••••••••••••'},productionCounterBefore:before,productionCounterAfter:after,landingCreated:false,stage:'paused-before-final-copy'};
 if(after!==before)throw new Error('Counter changed during review');
 writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2));writeFileSync(checkpoint,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}catch(e){console.error(e instanceof Error?e.message:'Review failed');process.exitCode=1;}
finally{await b.close();}
