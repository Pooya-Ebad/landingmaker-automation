import {importChromeSession,loadRemoteSession} from '../server/remote-session';
await importChromeSession('http://127.0.0.1:9222');
const session=loadRemoteSession();
const get=async(path:string)=>{const r=await fetch('https://landing.hamkadeh.com/api'+path,{headers:{Authorization:'Bearer '+session.token},redirect:'manual'});if(!r.ok)throw new Error('API status '+r.status);return r.json();};
const d=(await get('/landing/show/62088?relations[]=groups&relations[]=parameterGroup.variants')).data;
const schema=(v:any):any=>Array.isArray(v)?v.slice(0,3).map(schema):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,typeof x==='object'?schema(x):typeof x])):typeof v;
console.log(JSON.stringify({nativeFetchWorks:true,templateId:d.template_id,baseKeys:Object.keys(d),parameterKeys:Object.keys(JSON.parse(d.parameters)),parameterGroup:schema(d.parameter_group),landingGroup:schema(d.landing_group)}));
const r=await fetch('https://cdn.hamkadeh.com/',{headers:{Cookie:session.cdnCookies.map(c=>c.name+'='+c.value).join('; ')},redirect:'manual'});const html=await r.text();console.log(JSON.stringify({cdnStatus:r.status,authenticated:html.includes('tablighat'),htmlLength:html.length}));
