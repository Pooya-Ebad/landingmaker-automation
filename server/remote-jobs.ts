import {db,config,job,update,transaction,locked,nextType,seal,unseal,consumeType} from './store';
import {loadRemoteSession} from './remote-session';
import {HamkadehHttp,type Fetcher} from './remote-api';
import {BuildError} from './adapters';
import {target} from './providers';
db.exec('CREATE TABLE IF NOT EXISTS remote_plans(job TEXT PRIMARY KEY,payload TEXT NOT NULL)');
function failure(id:string,error:unknown,committed=false){const e=error instanceof BuildError?error:new BuildError(error instanceof Error&&error.message.startsWith('ابتدا نشست')?error.message:'ارتباط مستقیم تکمیل نشد؛ نشست و وضعیت سرویس را بررسی کنید.');const uncertain=committed||e.uncertain;transaction(()=>{update(id,uncertain?'uncertain':job(id).data.cancelRequested?'canceled':e.details?.count?'duplicate':'failed',e.message,e.details);if(!uncertain)db.prepare('DELETE FROM lease WHERE job=?').run(id);});}
export async function checkRemote(id:string,send?:Fetcher){
 if(job(id).status!=='running'||locked()?.job!==id)throw new Error('سفارش برای بررسی رزرو نشده است.');
 try{
  const d=job(id).data,c=config(),token=unseal(d.secretToken),selected=target(d,c);const api=new HamkadehHttp(loadRemoteSession(selected.id),c,send,selected.id);
  const canceled=()=>{if(job(id).data.cancelRequested)throw new BuildError('عملیات پیش از ثبت نهایی لغو شد.');};
  canceled();await api.health();update(id,'checking');const payload=await api.plan(d,token,'');
  canceled();update(id,'uploading');const image=await api.upload(d.file);canceled();
  const params=JSON.parse(payload.fields.parameters);params.mainPic=image;payload.fields.parameters=JSON.stringify(params);
  update(id,'checking');const count=await api.count(d.type,token);if(count>0)throw new BuildError('ترکیب تایپ و توکن تکراری شده است؛ ساخت انجام نشد.',false,{count});
  canceled();transaction(()=>{db.prepare('INSERT OR REPLACE INTO remote_plans VALUES(?,?)').run(id,seal(JSON.stringify(payload)));update(id,'checked',null,{mode:'check',duplicateCount:0,imageUrl:image,title:d.title,slug:d.slug,finalCreateSent:false});});
 }catch(e){failure(id,e);}
}
export function reserveRemoteCommit(id:string){return transaction(()=>{const j=job(id);if(j.status!=='checked'||locked()?.job!==id)throw new Error('ابتدا بررسی واقعی همین سفارش را تکمیل کنید.');if(j.data.type!==nextType(j.data.supervisor))throw new Error('شماره تایپ تغییر کرده است.');update(id,'checking');return job(id);});}
export async function commitRemote(id:string,send?:Fetcher){
 if(job(id).status!=='checking'||locked()?.job!==id)throw new Error('سفارش برای ثبت نهایی رزرو نشده است.');
 let committed=false;
 try{
  const j=job(id),d=j.data,c=config();const stored=db.prepare('SELECT payload FROM remote_plans WHERE job=?').get(id) as any;if(!stored)throw new BuildError('اطلاعات بررسی سفارش موجود نیست.');
  const selected=target(d,c);const api=new HamkadehHttp(loadRemoteSession(selected.id),c,send,selected.id);const payload=JSON.parse(unseal(stored.payload));
  const result=await api.commit(d,unseal(d.secretToken),payload,()=>{if(job(id).data.cancelRequested)throw new BuildError('عملیات لغو شد.');committed=true;update(id,'confirming');});
  transaction(()=>{consumeType(d,id);update(id,'succeeded',null,result);db.prepare('DELETE FROM lease WHERE job=?').run(id);});
 }catch(e){failure(id,e,committed);}
}
