import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,readFileSync,existsSync,writeFileSync} from 'node:fs';
import {randomBytes,createCipheriv,createDecipheriv} from 'node:crypto';
import path from 'node:path';
import defaults from '../config/defaults.json';
export const dataDir=path.resolve(process.env.DATA_DIR||'data');
mkdirSync(path.join(dataDir,'uploads'),{recursive:true});
const keyFile=path.join(dataDir,'secret.key');
if(!existsSync(keyFile))writeFileSync(keyFile,randomBytes(32),{mode:0o600});
const key=readFileSync(keyFile);
export function seal(value:string){const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key,iv);const out=Buffer.concat([c.update(value,'utf8'),c.final()]);return [iv,c.getAuthTag(),out].map(x=>x.toString('base64')).join('.');}
export function unseal(value:string){const [iv,tag,out]=value.split('.').map(x=>Buffer.from(x,'base64'));const c=createDecipheriv('aes-256-gcm',key,iv);c.setAuthTag(tag);return Buffer.concat([c.update(out),c.final()]).toString('utf8');}
export const db=new DatabaseSync(path.join(dataDir,'app.sqlite'));
db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS settings(id INTEGER PRIMARY KEY CHECK(id=1), value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS counter(id INTEGER PRIMARY KEY CHECK(id=1), next INTEGER NOT NULL);
 INSERT OR IGNORE INTO counter VALUES(1,112292);
 CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY, created TEXT NOT NULL, updated TEXT NOT NULL, status TEXT NOT NULL, data TEXT NOT NULL, error TEXT, result TEXT);
 CREATE TABLE IF NOT EXISTS lease(id INTEGER PRIMARY KEY CHECK(id=1),job TEXT NOT NULL UNIQUE);
 CREATE TABLE IF NOT EXISTS used_types(type INTEGER PRIMARY KEY,job TEXT NOT NULL);
`);
if(!db.prepare('SELECT id FROM settings').get()){
 const tokens:Record<string,Record<string,string>>={};
 const seed=path.resolve('config/tokens.seed.json');if(existsSync(seed)){const values=JSON.parse(readFileSync(seed,'utf8'));for(const s of Object.keys(values)){tokens[s]={};for(const c of Object.keys(values[s]))tokens[s][c]=seal(values[s][c]);}}
 db.prepare('INSERT INTO settings VALUES(1,?)').run(JSON.stringify({...defaults,tokens}));
}
// Add newly supported parser vocabulary to existing installations once, keeping
// user mappings, tokens, counters and custom transliterations intact.
{
 const current=JSON.parse((db.prepare('SELECT value FROM settings WHERE id=1').get() as any).value);
 if((current.settingsVersion||0)<5){
  current.parserAliases={...defaults.parserAliases,...current.parserAliases};
  current.landingPages.marital.aliases=[...new Set([...(current.landingPages.marital.aliases||[]),...defaults.landingPages.marital.aliases])];
  current.slug.dictionary={...defaults.slug.dictionary,...current.slug.dictionary};
  current.selectors.secondaryMainPic??=defaults.selectors.secondaryMainPic;
  current.execution??={transport:'http'};
  current.settingsVersion=5;
  db.prepare('UPDATE settings SET value=? WHERE id=1').run(JSON.stringify(current));
 }
 if(!current.typeRanges){current.typeRanges=defaults.typeRanges;db.prepare('UPDATE settings SET value=? WHERE id=1').run(JSON.stringify(current));}
}
// Interrupted operations retain the lease: no automatic resubmission after a crash.
db.prepare("UPDATE jobs SET status='uncertain', error='برنامه حین عملیات بسته شد؛ پیش از ادامه نتیجه را در سایت بررسی کنید.' WHERE status IN ('running','uploading','checking','confirming')").run();
export const config=()=>JSON.parse((db.prepare('SELECT value FROM settings WHERE id=1').get() as any).value);
// Keep the old counter as migration data only. New counters are scoped to a supervisor.
db.exec('CREATE TABLE IF NOT EXISTS supervisor_counters(supervisor TEXT PRIMARY KEY,next INTEGER NOT NULL)');
if(!(db.prepare('PRAGMA table_info(used_types)').all() as any[]).some(c=>c.name==='supervisor')){
 db.exec(`BEGIN IMMEDIATE;
 ALTER TABLE used_types RENAME TO legacy_used_types;
 CREATE TABLE used_types(supervisor TEXT NOT NULL,type INTEGER NOT NULL,job TEXT NOT NULL,PRIMARY KEY(supervisor,type));
 INSERT INTO used_types SELECT COALESCE(json_extract(j.data,'$.supervisor'),'legacy'),u.type,u.job FROM legacy_used_types u LEFT JOIN jobs j ON j.id=u.job;
 INSERT OR IGNORE INTO supervisor_counters SELECT supervisor,MAX(type)+1 FROM used_types GROUP BY supervisor;
 COMMIT;`);
}
export const nextType=(supervisor:string)=>Number((db.prepare('SELECT next FROM supervisor_counters WHERE supervisor=?').get(supervisor) as any)?.next||0);
export const counters=()=>Object.fromEntries(db.prepare('SELECT supervisor,next FROM supervisor_counters').all().map((r:any)=>[r.supervisor,Number(r.next)]));
export function setCounter(supervisor:string,value:number){
 if(!config().supervisors[supervisor]||!Number.isSafeInteger(value)||value<1||value>999999999)throw new Error('سرپرست یا تایپ شروع نامعتبر است.');
 if(value<(config().typeRanges?.[supervisor]?.min||1))throw new Error('تایپ شروع با بازه این سرپرست سازگار نیست.');
 const max=db.prepare('SELECT MAX(type) AS max FROM used_types WHERE supervisor=?').get(supervisor) as any;
 if(max.max&&value<=max.max)throw new Error('تایپ باید از شماره‌های مصرف‌شده همین سرپرست بیشتر باشد.');
 db.prepare('INSERT INTO supervisor_counters VALUES(?,?) ON CONFLICT(supervisor) DO UPDATE SET next=excluded.next').run(supervisor,value);
}
export function consumeType(d:any,id:string){
 db.prepare('INSERT INTO used_types VALUES(?,?,?)').run(d.supervisor,d.type,id);
 db.prepare('UPDATE supervisor_counters SET next=? WHERE supervisor=?').run(d.type+1,d.supervisor);
}
export const locked=()=>db.prepare('SELECT job FROM lease WHERE id=1').get() as {job:string}|undefined;
export function transaction<T>(fn:()=>T):T {db.exec('BEGIN IMMEDIATE');try{const r=fn();db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}
export function job(id:string){const r=db.prepare('SELECT * FROM jobs WHERE id=?').get(id) as any;if(!r)throw new Error('سفارش پیدا نشد.');return {...r,data:JSON.parse(r.data),result:r.result?JSON.parse(r.result):null};}
export function publicJob(j:any){const {secretToken,file,...data}=j.data;return {...j,data};}
export function update(id:string,status:string,error:string|null=null,result:any=null){db.prepare('UPDATE jobs SET status=?,error=?,result=?,updated=? WHERE id=?').run(status,error,result?JSON.stringify(result):null,new Date().toISOString(),id);}
