import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {config,unseal} from '../server/store';
import {loadRemoteSession} from '../server/remote-session';
import {HamkadehHttp} from '../server/remote-api';
import {parseRequest,makeCurrentSlug} from '../server/core';
const c=config();const request:any=parseRequest(readFileSync('tests/fixtures/mina-request.txt','utf8'),c);
const d={...request,type:Number(request.requestedType),title:`${c.landingPages[request.category].label} ${request.requestedType} ${request.blogger} / ${c.supervisors[request.supervisor].label}`,slug:makeCurrentSlug(request.blogger,c)};
const token=unseal(c.tokens[request.supervisor][request.company]);
const api=new HamkadehHttp(loadRemoteSession(),c);await api.health();
const image=JSON.parse(readFileSync('data/real-review/mina/report.json','utf8')).imageUrl;
const plan=await api.plan(d,token,image);
const proof:any={browserRequired:false,authenticatedRead:true,duplicateCount:0,payloadFieldNames:Object.keys(plan.fields),secondaryBannerEmpty:JSON.parse(plan.fields['parameter_group[variants][0][parameters]']).mainPic==='',finalCreateSent:false};
if(process.argv.includes('--upload')){
 const marker='data/protocol/live-upload-attempt.json';if(existsSync(marker))throw new Error('An HTTP upload was already attempted; inspect the saved outcome before retrying.');
 writeFileSync(marker,JSON.stringify({stage:'started',at:new Date().toISOString()}));
 proof.uploadedImage=await api.upload('#مینا_حیدری4 (2) (3).jpg');proof.uploadHashMatched=true;writeFileSync(marker,JSON.stringify({stage:'verified',url:proof.uploadedImage}));
}
writeFileSync('data/protocol/http-proof.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
