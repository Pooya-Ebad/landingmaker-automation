import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import defaults from '../config/defaults.json';
import {HamkadehHttp,type Fetcher} from '../server/remote-api';
import {uploadTrace,writeUploadEvent,type UploadEvent} from '../server/upload-diagnostics';
const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jK1cAAAAASUVORK5CYII=','base64');
const session={token:'private-auth-fixture',userId:1,cdnCookies:[{name:'hfs_https',value:'private-cookie-fixture',expires:-1},{name:'hfs_https.sig',value:'private-signature-fixture',expires:-1}]};
async function scenario(options:{status?:number;mime?:string;received?:Buffer;uploadStatus?:number;body?:any;network?:'upload'|'download';expired?:boolean}={}){
 const dir=mkdtempSync(path.join(tmpdir(),'hamkadeh-diagnostic-'));const file=path.join(dir,'extensionless-storage-file');writeFileSync(file,bytes);const events:UploadEvent[]=[];let puts=0,gets=0;
 const send:Fetcher=async(url,init={})=>{const u=new URL(url);assert.equal(u.origin,defaults.cdnOrigin);
  if(init.method==='PUT'){puts++;assert.equal(u.pathname,'/extensionless-storage-file.png');assert.equal((init.headers as any)['Content-Type'],'image/png');assert.deepEqual(Buffer.from(init.body as Buffer),bytes);if(options.network==='upload')throw new Error('private-auth-fixture');return Response.json(options.body??{uri:'/returned.png?opaque=private-query-fixture'},{status:options.uploadStatus??200});}
  gets++;if(options.network==='download')throw new Error('private-cookie-fixture');return new Response(new Uint8Array(options.received??bytes),{status:options.status??200,headers:{'Content-Type':options.mime??'image/png'}});
 };
 const auth=structuredClone(session);if(options.expired)auth.cdnCookies[0].expires=1;
 const api=new HamkadehHttp(auth,defaults,send,'hamkadeh',{jobId:'fixture-job',log:e=>events.push(e)});
 let result:string|undefined,error:any;try{result=await api.upload(file);}catch(e){error=e;}
 const output=JSON.stringify({events,details:error?.details,message:error?.message});
 for(const secret of ['private-auth-fixture','private-cookie-fixture','private-signature-fixture','private-query-fixture',file])assert.ok(!output.includes(secret));
 return {result,error,events,puts,gets};
}
test('extensionless UI upload sends a verified image suffix/MIME and logs successful byte comparison',async()=>{
 const s=await scenario();assert.ok(!s.error);assert.equal(s.puts,1);assert.equal(s.gets,1);assert.equal(s.events.at(-1)?.event,'verified');assert.equal(s.events.find(e=>e.event==='local_image')?.sourceHadExtension,false);assert.equal(s.events.find(e=>e.event==='comparison')?.hashMatches,true);
});
test('diagnostics distinguish HTTP, MIME and real content mismatch without repeating the upload',async()=>{
 for(const [options,code] of [[{status:403},'CDN_IMAGE_HTTP'],[{mime:'application/octet-stream'},'CDN_IMAGE_MIME'],[{received:Buffer.from('different image')},'CDN_IMAGE_HASH'],[{network:'download'},'CDN_IMAGE_NETWORK'],[{uploadStatus:403},'CDN_UPLOAD_HTTP'],[{network:'upload'},'CDN_UPLOAD_NETWORK'],[{body:{uri:'https://evil.test/secret'}},'CDN_OUTPUT_URI'],[{expired:true},'CDN_SESSION_EXPIRED']] as const){
  const s=await scenario(options);assert.equal(s.error?.details?.uploadDiagnostic?.code,code);assert.ok(s.error.message.includes(s.error.details.uploadDiagnostic.traceId));assert.equal(s.events.at(-1)?.event,'failed');assert.ok(s.puts<=1);
  if(code==='CDN_IMAGE_MIME')assert.equal(s.events.find(e=>e.event==='comparison')?.hashMatches,true);
 }
});
test('persistent diagnostic output is JSONL and drops unapproved fields',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'hamkadeh-logfile-'));process.env.DATA_DIR=dir;
 const trace=uploadTrace('hamkadeh','fixture-job',writeUploadEvent);trace.emit('fixture',{status:403,stage:'download',Authorization:'private-auth-fixture',Cookie:'private-cookie-fixture',url:'https://test.invalid/?token=private-query-fixture'});
 const output=readFileSync(path.join(dir,'logs','uploads.jsonl'),'utf8');assert.ok(!output.includes('private-'));const row=JSON.parse(output);assert.equal(row.status,403);assert.equal(row.traceId,trace.traceId);
});
