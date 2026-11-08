import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import defaults from '../config/defaults.json';
import {creationFields,parseCount,HamkadehHttp,type Fetcher} from '../server/remote-api';
const parameters={type:'old',token:'old',mainPic:'old-image',HamkadehOrNot:'1',subjectSelect:'',labelSelect:'',centerText:'keep-me'};
const base={id:62088,template_id:2,is_child:0,parameters:JSON.stringify(parameters),parameter_group:{CTR_target:20,change_type:'view_change',variants:[{priority:1,view_change:100,parameters:JSON.stringify(parameters)},{priority:2,view_change:50,parameters:JSON.stringify(parameters)}]},landing_group:[]};
const session={token:'fake-auth-only',userId:10,cdnCookies:[{name:'hfs_https',value:'fake-cookie',expires:-1},{name:'hfs_https.sig',value:'fake-signature',expires:-1}]};
const fixture=(options:{count?:number;badReadback?:boolean;unauthorized?:boolean;rejectCreate?:boolean;badImage?:boolean}={})=>{
 let creations=0,uploaded=0,record:any;const seen:string[]=[];const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jK1cAAAAASUVORK5CYII=','base64');
 const send:Fetcher=async(url,init={})=>{
  const u=new URL(url);seen.push(init.method+' '+u.pathname);const json=(data:any,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
  if(options.unauthorized)return json({status:false},401);
  if(u.origin==='https://cdn.hamkadeh.com'){
   assert.ok((init.headers as any).Cookie.includes('fake-cookie'));
   if(init.method==='PUT'){uploaded++;return json({uri:'/returned%20name%20(9).png'});}
   assert.equal(u.pathname,'/returned%20name%20(9).png');return new Response(new Uint8Array(options.badImage?Buffer.from('changed image'):bytes),{headers:{'Content-Type':'image/png'}});
  }
  assert.equal(u.origin,'https://landing.hamkadeh.com');assert.equal((init.headers as any).Authorization,'Bearer fake-auth-only');
  if(u.pathname==='/api/profile/current-user')return json({status:true,data:{id:10}});
  if(u.pathname==='/api/landing/show/62088')return json({status:true,data:base});
  if(u.pathname==='/api/access-group/get-user-list')return json({status:true,data:[{id:4,title:'دوستی 1405'}]});
  if(u.pathname==='/api/landing/get-token-type-count')return json({status:true,data:{count:options.count??0}});
  if(u.pathname==='/api/landing/create'){
   creations++;assert.ok(init.body instanceof FormData);const form=init.body as FormData;
   if(options.rejectCreate)return json({status:false,message:'اسلاگ قبلاً استفاده شده است. '+form.get('token'),errors:{slug:['یک اسلاگ دیگر انتخاب کنید.']}},422);
   record={id:9001,title:form.get('title'),slug:options.badReadback?'wrong':form.get('slug'),parameters:form.get('parameters')};return json({status:true,data:{id:9001}});
  }
  if(u.pathname==='/api/landing/show/9001')return json({status:true,data:record});
  throw new Error('Unexpected fixture request');
 };
 return {send,bytes,seen,get creations(){return creations;},get uploaded(){return uploaded;}};
};
test('API count accepts explicit integer zero and rejects malformed/missing values',()=>{
 assert.equal(parseCount({status:true,data:{count:0}}),0);assert.equal(parseCount({status:true,data:{count:'2'}}),2);
 for(const value of [null,{},'zero',-1,0.5,NaN])assert.throws(()=>parseCount({status:true,data:{count:value}}));
 assert.throws(()=>parseCount({status:false,data:{count:0}}));
});
test('API payload preserves template defaults, sets group and token, clears only secondary banner',()=>{
 const result=creationFields(base,{title:'عنوان',slug:'test0817',type:112297},4,10,'https://cdn.hamkadeh.com/returned.png','private-fixture-token');
 const p=JSON.parse(result.fields.parameters);assert.equal(p.mainPic,'https://cdn.hamkadeh.com/returned.png');assert.equal(p.centerText,'keep-me');assert.equal(p.token,'private-fixture-token');
 const secondary=JSON.parse(result.fields['parameter_group[variants][0][parameters]']);assert.equal(secondary.mainPic,'');assert.equal(secondary.centerText,'keep-me');assert.equal(secondary.type,'112297');assert.equal(secondary.token,'private-fixture-token');
 assert.equal(result.fields.access_group_id,'4');assert.equal(result.fields.template_id,'2');assert.equal(result.fields.parameter_change,'100');assert.equal(result.subjects,null);
});
test('direct HTTP upload uses server returned uri and checks bytes without any browser',async()=>{
 const mock=fixture();const dir=mkdtempSync(path.join(tmpdir(),'hamkadeh-http-upload-'));const file=path.join(dir,'input.png');writeFileSync(file,mock.bytes);
 const api=new HamkadehHttp(session,defaults,mock.send);await api.health();assert.equal(await api.upload(file),'https://cdn.hamkadeh.com/returned%20name%20(9).png');assert.equal(mock.uploaded,1);
});
test('direct API jobs: check-only cannot create; explicit commit verifies result and advances once',async()=>{
 process.env.DATA_DIR=mkdtempSync(path.join(tmpdir(),'hamkadeh-http-jobs-'));
 const store=await import('../server/store');const jobs=await import('../server/jobs');const remote=await import('../server/remote-jobs');const auth=await import('../server/remote-session');
 auth.saveRemoteSession(session);const c=store.config();c.tokens.doosti.trend=store.seal('private-fixture-token');store.db.prepare('UPDATE settings SET value=?').run(JSON.stringify(c));
 const mock=fixture();const file=path.join(store.dataDir,'input.png');writeFileSync(file,mock.bytes);
 store.setCounter('doosti',112292);const draft=()=>jobs.createDraft({date:'1405/08/17',blogger:'مینا حیدری',category:'infidelity',company:'trend',supervisor:'doosti',type:store.nextType('doosti'),slug:'minaheydari0817',uploadId:'fixture',file});
 const j=draft();jobs.prepare(j.id,{});jobs.reserve(j.id);const before=store.nextType('doosti');await remote.checkRemote(j.id,mock.send);
 assert.equal(store.job(j.id).status,'checked');assert.equal(mock.creations,0);assert.equal(store.nextType('doosti'),before);assert.equal(store.locked()?.job,j.id);assert.equal(store.job(j.id).result.url,undefined);
 assert.ok(!(store.db.prepare('SELECT payload FROM remote_plans WHERE job=?').get(j.id) as any).payload.includes('private-fixture-token'));
 remote.reserveRemoteCommit(j.id);await remote.commitRemote(j.id,mock.send);assert.equal(mock.creations,1);assert.equal(store.job(j.id).status,'succeeded');assert.equal(store.nextType('doosti'),before+1);assert.equal(store.locked(),undefined);assert.equal(store.job(j.id).result.url,'https://landing.hamkadeh.com/minaheydari0817');
 await assert.rejects(()=>remote.commitRemote(j.id,mock.send));assert.equal(mock.creations,1);assert.equal(store.job(j.id).status,'succeeded');
 const blocked=draft();jobs.prepare(blocked.id,{});jobs.reserve(blocked.id);const duplicate=fixture({count:1});await remote.checkRemote(blocked.id,duplicate.send);assert.equal(store.job(blocked.id).status,'duplicate');assert.equal(duplicate.uploaded,0);assert.equal(duplicate.creations,0);assert.equal(store.nextType('doosti'),before+1);
 const pending=draft();jobs.prepare(pending.id,{});jobs.reserve(pending.id);await remote.checkRemote(pending.id,mock.send);jobs.cancel(pending.id);assert.equal(store.locked(),undefined);assert.equal(mock.creations,1);
 const rejected=draft();jobs.prepare(rejected.id,{});jobs.reserve(rejected.id);const reject=fixture({rejectCreate:true});await remote.checkRemote(rejected.id,reject.send);remote.reserveRemoteCommit(rejected.id);await remote.commitRemote(rejected.id,reject.send);
 assert.equal(store.job(rejected.id).status,'failed');assert.equal(store.locked(),undefined);assert.equal(store.nextType('doosti'),before+1);assert.equal(store.job(rejected.id).result.siteError.httpStatus,422);assert.ok(store.job(rejected.id).error.includes('اسلاگ قبلاً استفاده شده است.'));assert.ok(!JSON.stringify(store.publicJob(store.job(rejected.id))).includes('private-fixture-token'));
 jobs.prepareRetry(rejected.id,{...store.publicJob(store.job(rejected.id)).data,slug:'corrected0817'});jobs.reserve(rejected.id);
 const retry=fixture();await remote.checkRemote(rejected.id,retry.send);assert.equal(retry.uploaded,0);assert.equal(store.job(rejected.id).result.imageReused,true);assert.equal(store.job(rejected.id).data.slug,'corrected0817');assert.equal(retry.creations,0);assert.equal((store.db.prepare('SELECT COUNT(*) AS n FROM job_attempts WHERE job=?').get(rejected.id) as any).n,1);jobs.cancel(rejected.id);
 store.db.prepare('DELETE FROM job_images WHERE job=?').run(rejected.id);
 jobs.prepareRetry(rejected.id,store.publicJob(store.job(rejected.id)).data);jobs.reserve(rejected.id);const changed=fixture({badImage:true});await remote.checkRemote(rejected.id,changed.send);assert.equal(store.job(rejected.id).status,'failed');assert.equal(changed.uploaded,0);assert.equal(store.job(rejected.id).result.uploadDiagnostic.code,'CDN_IMAGE_HASH');
 jobs.prepareRetry(rejected.id,store.publicJob(store.job(rejected.id)).data);jobs.reserve(rejected.id);const legacy=fixture();await remote.checkRemote(rejected.id,legacy.send);assert.equal(store.job(rejected.id).status,'checked');assert.equal(legacy.uploaded,0);assert.equal(store.job(rejected.id).result.imageReused,true);jobs.cancel(rejected.id);
 const uncertain=draft();jobs.prepare(uncertain.id,{});jobs.reserve(uncertain.id);const bad=fixture({badReadback:true});await remote.checkRemote(uncertain.id,bad.send);remote.reserveRemoteCommit(uncertain.id);await remote.commitRemote(uncertain.id,bad.send);assert.equal(store.job(uncertain.id).status,'uncertain');assert.equal(store.nextType('doosti'),before+1);assert.equal(store.locked()?.job,uncertain.id);
 assert.throws(()=>jobs.prepareRetry(uncertain.id,{...store.publicJob(store.job(uncertain.id)).data,slug:'unsafe0817'}));assert.equal(store.job(uncertain.id).status,'uncertain');
 store.db.close();
});
test('expired or unauthorized API session fails without submitting creation',async()=>{
 const mock=fixture({unauthorized:true});const api=new HamkadehHttp(session,defaults,mock.send);await assert.rejects(()=>api.health());assert.equal(mock.creations,0);
});
