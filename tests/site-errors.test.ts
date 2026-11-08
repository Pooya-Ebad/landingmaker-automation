import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cleanSiteText,siteErrorDetails,requestSecrets} from '../server/site-errors';
import {HamkadehHttp,type Fetcher} from '../server/remote-api';
import defaults from '../config/defaults.json';
test('site messages and validation errors remain readable while echoed credentials are redacted',()=>{
 const d=siteErrorDetails({message:'اسلاگ تکراری است؛ token=private-routing-secret',errors:{slug:['آدرس را تغییر دهید.'],token:['توکن private-routing-secret نامعتبر است.']},data:{token:'do-not-reflect-data'}},422,'hamkadeh','/landing/create',['private-routing-secret']);
 assert.ok(d.messages[0].includes('اسلاگ تکراری'));assert.equal(d.validation[0].field,'slug');const output=JSON.stringify(d);assert.ok(!output.includes('private-routing-secret'));assert.ok(!output.includes('do-not-reflect-data'));
 assert.equal(cleanSiteText('<b>خطا</b> Bearer secret-auth-token',[]),'خطا Bearer [حذف‌شده]');
});
test('request secret collection supports count JSON and creation multipart',()=>{
 assert.deepEqual(requestSecrets(JSON.stringify({type:'123',token:'routing-secret'})),['routing-secret']);const f=new FormData();f.append('title','title');f.append('token','multipart-secret');assert.deepEqual(requestSecrets(f),['multipart-secret']);
});
test('non-JSON server errors expose HTTP status without reflecting HTML or returning a false result',async()=>{
 const send:Fetcher=async()=>new Response('<html>private-debug-info</html>',{status:502,headers:{'Content-Type':'text/html'}});
 const api=new HamkadehHttp({token:'private-auth',userId:1,cdnCookies:[]},defaults,send);
 await assert.rejects(()=>api.health(),(e:any)=>e.details.siteError.httpStatus===502&&!JSON.stringify(e.details).includes('private-debug-info'));
});
