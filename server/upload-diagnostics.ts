import {randomUUID} from 'node:crypto';
import {appendFileSync,mkdirSync,statSync,existsSync,renameSync,rmSync} from 'node:fs';
import path from 'node:path';
export type UploadEvent={time:string;traceId:string;jobId?:string;provider:string;event:string;[key:string]:unknown};
export type UploadLog=(event:UploadEvent)=>void;
// Only explicitly selected metadata may reach either the console, file or history.
const allowed=new Set(['localBytes','receivedBytes','localHash','receivedHash','hashMatches','format','extension','sourceHadExtension','status','contentType','pathHash','hasQuery','code','stage','networkKind']);
export function writeUploadEvent(event:UploadEvent){
 console.info('[upload] '+JSON.stringify(event));
 try{const dir=path.resolve(process.env.DATA_DIR||'data','logs');mkdirSync(dir,{recursive:true});const file=path.join(dir,'uploads.jsonl');
  if(existsSync(file)&&statSync(file).size>5*1024*1024){const previous=path.join(dir,'uploads.previous.jsonl');if(existsSync(previous))rmSync(previous);renameSync(file,previous);}
  appendFileSync(file,JSON.stringify(event)+'\n',{encoding:'utf8',mode:0o600});
 }catch{console.warn('[upload] Diagnostic file unavailable; console diagnostics remain available.');}
}
export function uploadTrace(provider:string,jobId?:string,log:UploadLog=writeUploadEvent){
 const traceId=randomUUID(),events:UploadEvent[]=[];
 const emit=(event:string,fields:Record<string,unknown>={})=>{const safe=Object.fromEntries(Object.entries(fields).filter(([key])=>allowed.has(key)));const row={time:new Date().toISOString(),traceId,...(jobId?{jobId}:{}),provider,event,...safe};events.push(row);if(events.length>20)events.shift();try{log(row);}catch{/* Diagnostics must not change the outcome of an upload. */}};
 return {traceId,emit,snapshot:()=>({traceId,events:[...events]})};
}
