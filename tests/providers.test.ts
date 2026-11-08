import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import defaults from '../config/defaults.json';
import {target} from '../server/providers';
import {validateConfig} from '../server/core';
import {HamkadehHttp,type Fetcher} from '../server/remote-api';
test('Hamkadeh is default; secondary URLs are optional and cannot point at the other provider',()=>{
 const c:any=structuredClone(defaults);assert.equal(target({category:'infidelity'},c).id,'hamkadeh');assert.throws(()=>target({category:'infidelity',builder:'moshavere'},c));
 c.landingPages.infidelity.moshavereUrl='https://new.moshavere.me/dashboard/showLandings/newofcopy/13550';validateConfig(c);assert.equal(target({category:'infidelity',builder:'moshavere'},c).landing,'https://landing.moshavere.me');
 c.landingPages.general.moshavereUrl=c.landingPages.infidelity.moshavereUrl;assert.throws(()=>validateConfig(c));delete c.landingPages.general.moshavereUrl;
 c.landingPages.infidelity.moshavereUrl=c.landingPages.infidelity.url;assert.throws(()=>validateConfig(c));assert.throws(()=>target({category:'infidelity',builder:'moshavere'},c));
});
test('Moshavere API uses its own host/session, checks duplicates, and verifies the provider-specific final URL',async()=>{
 const c:any=structuredClone(defaults);c.landingPages.infidelity.moshavereUrl='https://new.moshavere.me/dashboard/showLandings/newofcopy/13550';
 const session={token:'moshavere-only-fixture',userId:22,cdnCookies:[]};let copies=0,count=0,record:any;
 const params={type:'old',token:'old',mainPic:'old',HamkadehOrNot:'1',subjectSelect:'',labelSelect:''};
 const base={id:13550,template_id:2,is_child:0,parameters:JSON.stringify(params),parameter_group:{variants:[{priority:1,parameters:JSON.stringify(params)}]},landing_group:[]};
 const send:Fetcher=async(url,init={})=>{const u=new URL(url);assert.equal(u.origin,'https://landing.moshavere.me');assert.equal((init.headers as any).Authorization,'Bearer moshavere-only-fixture');let data:any;
  if(u.pathname==='/api/profile/current-user')data={id:22};
  else if(u.pathname==='/api/landing/show/13550')data=base;
  else if(u.pathname==='/api/access-group/get-user-list')data=[{id:7,title:'دوستی 1405'}];
  else if(u.pathname==='/api/landing/get-token-type-count')data={count};
  else if(u.pathname==='/api/landing/create'){copies++;const f=init.body as FormData;record={id:55,title:f.get('title'),slug:f.get('slug'),parameters:f.get('parameters')};data={id:55};}
  else if(u.pathname==='/api/landing/show/55')data=record;
  else throw Error('Unexpected provider fixture path');return Response.json({status:true,data});};
 const d={builder:'moshavere',category:'infidelity',supervisor:'doosti',type:112297,title:'خیانت 112297 نمونه / دوستی',slug:'example0817'};
 const api=new HamkadehHttp(session,c,send,'moshavere');await api.health();const payload=await api.plan(d,'routing-fixture','https://cdn.hamkadeh.com/test.jpg');
 count=1;await assert.rejects(()=>api.commit(d,'routing-fixture',payload,()=>{}));assert.equal(copies,0);
 count=0;const result=await api.commit(d,'routing-fixture',payload,()=>{});assert.equal(result.url,'https://landing.moshavere.me/example0817');assert.equal(copies,1);
 await assert.rejects(()=>new HamkadehHttp(session,c,send).plan(d,'routing-fixture',''));
});
test('saved login sessions are encrypted and isolated per provider; no implicit Hamkadeh fallback',async()=>{
 process.env.DATA_DIR=mkdtempSync(path.join(tmpdir(),'hamkadeh-providers-'));
 const auth=await import('../server/remote-session');const s=await import('../server/store');
 auth.saveRemoteSession({token:'hamkadeh-secret-fixture',userId:1,cdnCookies:[]});assert.throws(()=>auth.loadRemoteSession('moshavere'));assert.equal(auth.remoteSessionStatus('moshavere').configured,false);
 auth.saveRemoteSession({token:'moshavere-secret-fixture',userId:2,cdnCookies:[]},'moshavere');assert.equal(auth.loadRemoteSession().userId,1);assert.equal(auth.loadRemoteSession('moshavere').userId,2);
 assert.ok(!JSON.stringify(s.db.prepare('SELECT * FROM provider_sessions').all()).includes('secret-fixture'));s.db.close();
});
