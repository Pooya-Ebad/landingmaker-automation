import {randomUUID} from 'node:crypto';
import {db,job,publicJob,locked,transaction,config,nextType,setCounter} from './store';
import {prepare,reserve,cancel} from './jobs';
import {checkRemote,reserveRemoteCommit,commitRemote} from './remote-jobs';
db.exec(`CREATE TABLE IF NOT EXISTS batches(id TEXT PRIMARY KEY,created TEXT NOT NULL,status TEXT NOT NULL,data TEXT NOT NULL);
 UPDATE batches SET status='stopped' WHERE status='running';`);
export function activeBatch(){return db.prepare("SELECT id FROM batches WHERE status='running'").get() as {id:string}|undefined;}
export function batch(id:string){
 const b=db.prepare('SELECT * FROM batches WHERE id=?').get(id) as any;if(!b)throw new Error('صف پیدا نشد.');
 const d=JSON.parse(b.data);return {...b,data:d,jobs:d.ids.map((id:string)=>publicJob(job(id)))};
}
export function startBatch(items:{id:string;data:any}[],starts:Record<string,number>,confirm:boolean){return transaction(()=>{
 if(confirm!==true)throw new Error('تأیید صریح ساخت همه سفارش‌ها لازم است.');
 if(config().execution?.transport!=='http')throw new Error('ساخت گروهی به حالت API نیاز دارد.');
 if(locked()||activeBatch())throw new Error('عملیات دیگری فعال است.');
 if(!items.length||items.length>50||new Set(items.map(i=>i.id)).size!==items.length)throw new Error('بین ۱ تا ۵۰ سفارش مجزا انتخاب کنید.');
 const allocated:Record<string,number>={};
 for(const item of items){const supervisor=item.data.supervisor??job(item.id).data.supervisor;
  if(allocated[supervisor]!==undefined)continue;
  const start=starts[supervisor]??nextType(supervisor);setCounter(supervisor,start);allocated[supervisor]=start;
 }
 const slugs=new Set<string>();
 for(const item of items){
  const supervisor=item.data.supervisor??job(item.id).data.supervisor;const type=allocated[supervisor]++;
  if(type>999999999)throw new Error('تایپ خارج از محدوده مجاز است.');
  const j=prepare(item.id,{...item.data,type,title:''},type,true);
  if(slugs.has(j.data.slug))throw new Error('اسلاگ دو درخواست یکسان است؛ قبل از شروع آن‌ها را اصلاح کنید.');slugs.add(j.data.slug);
 }
 const id=randomUUID();db.prepare('INSERT INTO batches VALUES(?,?,?,?)').run(id,new Date().toISOString(),'running',JSON.stringify({ids:items.map(i=>i.id),starts,stop:false}));return batch(id);
});}
export function stopBatch(id:string){const b=batch(id);if(b.status!=='running')return b;
 db.prepare('UPDATE batches SET data=? WHERE id=?').run(JSON.stringify({...b.data,stop:true}),id);
 const running=b.jobs.find((j:any)=>['running','checking','uploading','checked'].includes(j.status));if(running)cancel(running.id);return batch(id);
}
export function resumeBatch(id:string){return transaction(()=>{
 const b=batch(id);if(b.status!=='stopped'||locked()||activeBatch())throw new Error('ابتدا خطای سفارش و عملیات فعال را برطرف کنید.');
 if(b.jobs.some((j:any)=>!['ready','succeeded'].includes(j.status)))throw new Error('ابتدا سفارش متوقف‌شده را اصلاح و ساخت آن را کامل کنید.');
 if(b.jobs.every((j:any)=>j.status==='succeeded'))throw new Error('تمام سفارش‌های صف ساخته شده‌اند.');
 const numbers:Record<string,number>={};for(const j of b.jobs){if(j.status==='succeeded')continue;const supervisor=j.data.supervisor;const type=numbers[supervisor]??nextType(supervisor);prepare(j.id,{...j.data,type,title:''},type,true);numbers[supervisor]=type+1;}
 db.prepare("UPDATE batches SET status='running',data=? WHERE id=?").run(JSON.stringify({...b.data,stop:false}),id);return batch(id);
});}
export async function runBatch(id:string,check=checkRemote,commit=commitRemote){
 try{
  for(const jobId of batch(id).data.ids){
   if(job(jobId).status==='succeeded')continue;
   if(batch(id).data.stop)break;
   reserve(jobId);await check(jobId);
   if(batch(id).data.stop){if(job(jobId).status==='checked')cancel(jobId);break;}
   if(job(jobId).status!=='checked')break;
   reserveRemoteCommit(jobId);await commit(jobId);
   if(job(jobId).status!=='succeeded')break;
  }
 }catch{ /* Leave job and lease evidence intact; never retry creation. */ }
 finally{const b=batch(id);db.prepare('UPDATE batches SET status=? WHERE id=?').run(b.jobs.every((j:any)=>j.status==='succeeded')?'succeeded':'stopped',id);}
}
