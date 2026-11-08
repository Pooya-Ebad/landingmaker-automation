import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {db,seal,unseal} from './store';
db.exec('CREATE TABLE IF NOT EXISTS job_images(job TEXT PRIMARY KEY,payload TEXT NOT NULL)');
const fingerprint=(file:string)=>createHash('sha256').update(readFileSync(file)).digest('hex');
export function saveJobImage(id:string,file:string,origin:string,url:string){db.prepare('INSERT OR REPLACE INTO job_images VALUES(?,?)').run(id,seal(JSON.stringify({hash:fingerprint(file),origin,url})));}
export function jobImage(id:string,file:string,origin:string){
 const row=db.prepare('SELECT payload FROM job_images WHERE job=?').get(id) as any;
 if(row){const cached=JSON.parse(unseal(row.payload));if(cached.origin===origin&&cached.hash===fingerprint(file))return cached.url as string;return null;}
 // Recover an already-verified image from plans made before the image cache existed.
 const plan=db.prepare('SELECT payload FROM remote_plans WHERE job=?').get(id) as any;if(!plan)return null;
 try{const p=JSON.parse(unseal(plan.payload));const image=JSON.parse(p.fields.parameters).mainPic;const url=new URL(image);if(url.origin===origin&&!url.username&&!url.password&&!url.hash)return url.href;}catch{/* An invalid old plan is never used. */}return null;
}
