import express from 'express';
import multer from 'multer';
import {randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';
import {readFileSync,unlinkSync,existsSync} from 'node:fs';
import path from 'node:path';
import {z} from 'zod';
import {config,db,nextType,dataDir,job,publicJob,locked,seal,unseal,counters,setCounter} from './store';
import {parseRequest,makeCurrentSlug,todayJalali,validateConfig} from './core';
import {createDraft,prepare,prepareForBuild,prepareRetry,reserve,execute,reconcile,cancel} from './jobs';
import {browser,closeBrowser} from './browser';
import {remoteSessionStatus,importChromeSession,loadRemoteSession} from './remote-session';
import {HamkadehHttp} from './remote-api';
import {reserveRemoteCommit,commitRemote} from './remote-jobs';
import {activeBatch,batch,startBatch,runBatch,stopBatch,resumeBatch} from './batches';
import {suggestSlug,rememberSlug,forgetSlug} from './slug-memory';
import {selectedToken,saveToken,saveReferences} from './settings-manager';
import {providers,type Provider} from './providers';
const app=express();const port=Number(process.env.PORT||3140);const localOrigin=`http://127.0.0.1:${port}`;
app.disable('x-powered-by');app.use(express.json({limit:'1mb'}));
const csrf=randomBytes(32).toString('hex');
const eq=(a:string,b:string)=>a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
app.use('/api',(req,res,next)=>{
 const origin=req.headers.origin;
 if(origin&&origin!==localOrigin)return res.status(403).json({error:'مبدأ درخواست مجاز نیست.'});
 if(req.headers.host!==`127.0.0.1:${port}`)return res.status(403).json({error:'از آدرس 127.0.0.1 استفاده کنید.'});
 const bearer=process.env.HAMKADEH_API_KEY;
 const bot=!!bearer&&eq(req.headers.authorization||'',`Bearer ${bearer}`);
 if(!['GET','HEAD'].includes(req.method)&&!bot&&req.headers['x-csrf-token']!==csrf)return res.status(403).json({error:'صفحه را بازآوری کنید.'});
 res.setHeader('Cache-Control','no-store');next();
});
const wrap=(fn:any)=>(req:any,res:any,next:any)=>Promise.resolve().then(()=>fn(req,res)).catch(next);
app.use('/api',(req,res,next)=>{
 if(activeBatch()&&((req.method==='PUT'&&req.path==='/settings')||req.path.startsWith('/settings/')||['/landing/build','/landing/approve','/connection/import'].includes(req.path)||/\/landing\/jobs\/[^/]+\/(commit|reconcile|cancel|retry)$/.test(req.path)))return res.status(409).json({error:'صف گروهی فعال است؛ ابتدا آن را متوقف کنید.'});next();
});
app.get('/api/landing/batches/active',(_req,res)=>{const b=activeBatch();res.json(b?batch(b.id):null);});
app.get('/api/landing/batches/:id',wrap((req:any,res:any)=>res.json(batch(req.params.id))));
app.post('/api/landing/batches',wrap((req:any,res:any)=>{
 const input=z.object({items:z.array(z.object({id:z.string().uuid(),data:z.record(z.string(),z.any())})).min(1).max(50),starts:z.record(z.string(),z.number().int()),confirm:z.literal(true)}).parse(req.body);
 const b=startBatch(input.items,input.starts,input.confirm);void runBatch(b.id);res.status(202).json(b);
}));
app.post('/api/landing/batches/:id/stop',wrap((req:any,res:any)=>res.json(stopBatch(req.params.id))));
app.post('/api/landing/batches/:id/resume',wrap((req:any,res:any)=>{if(req.body.confirm!==true)throw new Error('Explicit confirmation required');const b=resumeBatch(req.params.id);void runBatch(b.id);res.status(202).json(b);}));
app.get('/api/bootstrap',(_req,res)=>res.json({csrf}));
function settings(){const c=config();const tokenOptions:any=Object.fromEntries(Object.keys(c.supervisors).map(s=>[s,Object.keys(c.tokens[s]||{}).map(company=>({company,id:'',label:'توکن اصلی',masked:'•••••••••••••'}))]));for(const [id,t] of Object.entries(c.tokenEntries||{}) as any){tokenOptions[t.supervisor]??=[];tokenOptions[t.supervisor].push({id,company:t.company,label:t.label,masked:'•••••••••••••'});}const {tokens,tokenEntries,...safe}=c;return {config:safe,tokenOptions,counters:counters(),locked:locked()||null};}
app.get('/api/settings',(_req,res)=>res.json(settings()));
app.post('/api/settings/tokens',wrap((req:any,res:any)=>{const d=z.object({mode:z.enum(['add','replace']),supervisor:z.string(),company:z.string().optional(),companyName:z.string().max(80).optional(),value:z.string(),label:z.string().optional(),tokenId:z.string().optional()}).parse(req.body);saveToken(d);res.json(settings());}));
app.put('/api/settings/references',wrap((req:any,res:any)=>{const pages=z.record(z.string().regex(/^[a-z][a-z0-9_]{0,79}$/),z.object({label:z.string().trim().min(1).max(80),url:z.string().max(500),moshavereUrl:z.string().max(500).optional(),aliases:z.array(z.string().trim().min(1).max(100)).max(30).optional()})).parse(req.body.landingPages);saveReferences(pages);res.json(settings());}));
// Explicitly authorized: reveal only the selected routing token, never login credentials.
app.post('/api/tokens/selected',wrap((req:any,res:any)=>{
 const {supervisor,company,tokenId}=z.object({supervisor:z.string(),company:z.string(),tokenId:z.string().optional(),display:z.literal(true)}).parse(req.body);
 const token=selectedToken(config(),supervisor,company,tokenId);if(!token)throw new Error('توکن این سرپرست و شرکت موجود نیست.');
 res.json({value:unseal(token)});
}));
app.put('/api/settings',wrap(async(req:any,res:any)=>{
 if(locked())throw new Error('حین اجرا یا نتیجه نامشخص، تنظیمات قابل تغییر نیست.');
 const c=req.body.config;validateConfig(c);
 const current=config();c.tokens=current.tokens;c.tokenEntries=current.tokenEntries;
 for(const t of req.body.tokenUpdates||[]){if(!c.supervisors[t.supervisor]||!c.companies[t.company]||!/^[a-zA-Z0-9_-]{8,128}$/.test(t.value))throw new Error('توکن یا نگاشت آن معتبر نیست.');c.tokens[t.supervisor]??={};c.tokens[t.supervisor][t.company]=seal(t.value);}
 db.exec('BEGIN IMMEDIATE');try{db.prepare('UPDATE settings SET value=? WHERE id=1').run(JSON.stringify(c));for(const [supervisor,value] of Object.entries(req.body.counters||{}))setCounter(supervisor,Number(value));db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
 await closeBrowser();res.json(settings());
}));
const uploads=new Map<string,string>();
// Upload references survive restart without exposing filesystem paths to clients.
db.exec('CREATE TABLE IF NOT EXISTS uploads(id TEXT PRIMARY KEY,path TEXT NOT NULL)');
const upload=multer({dest:path.join(dataDir,'uploads'),limits:{fileSize:15*1024*1024,files:1}});
app.post('/api/uploads',upload.single('image'),wrap((req:any,res:any)=>{
 if(!req.file)throw new Error('تصویر انتخاب نشده است.');
 const b=readFileSync(req.file.path);const valid=b.subarray(0,3).equals(Buffer.from([255,216,255]))||b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||(b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP');
 if(!valid){unlinkSync(req.file.path);throw new Error('فقط تصویر JPG، PNG یا WebP مجاز است.');}
 const id=randomUUID();db.prepare('INSERT INTO uploads VALUES(?,?)').run(id,req.file.path);res.json({id});
}));
app.post('/api/landing/preview',wrap((req:any,res:any)=>{
 const input=z.object({raw:z.string().min(1).max(30000),uploadId:z.string().uuid(),supervisor:z.string().optional()}).parse(req.body);
 const file=(db.prepare('SELECT path FROM uploads WHERE id=?').get(input.uploadId) as any)?.path;if(!file||!existsSync(file))throw new Error('تصویر معتبر بارگذاری کنید.');
 const c=config();const parsed:any=parseRequest(input.raw,c);const supervisor=input.supervisor||parsed.supervisor||'';const d:any={...parsed,raw:input.raw,uploadId:input.uploadId,file,supervisor,builder:'hamkadeh',type:nextType(supervisor),...suggestSlug(parsed.blogger||'',c)};
 res.json(publicJob(createDraft(d)));
}));
app.post('/api/landing/slug',wrap((req:any,res:any)=>res.json(suggestSlug(String(req.body.blogger||''),config()))));
app.post('/api/landing/slug-memory',wrap((req:any,res:any)=>{const d=z.object({blogger:z.string().min(1).max(200),slug:z.string().max(210),slugDate:z.string().max(20)}).parse(req.body);res.json(rememberSlug(d.blogger,d.slug,d.slugDate));}));
app.delete('/api/landing/slug-memory',wrap((req:any,res:any)=>res.json(forgetSlug(z.string().min(1).max(200).parse(req.body.blogger)))));
app.post('/api/landing/approve',wrap((req:any,res:any)=>res.json(publicJob(prepare(req.body.id,req.body.data)))));
app.post('/api/landing/build',wrap((req:any,res:any)=>{if(req.body.data)prepareForBuild(req.body.id,req.body.data);const j=reserve(req.body.id);void execute(j.id);res.status(202).json(publicJob(job(j.id)));}));
app.post('/api/landing/jobs/:id/retry',wrap((req:any,res:any)=>{prepareRetry(req.params.id,req.body.data||{});const j=reserve(req.params.id);void execute(j.id);res.status(202).json(publicJob(job(j.id)));}));
app.post('/api/landing/jobs/:id/commit',wrap((req:any,res:any)=>{if(req.body.confirm!==true)throw new Error('تأیید صریح ثبت نهایی لازم است.');const j=reserveRemoteCommit(req.params.id);void commitRemote(j.id);res.status(202).json(publicJob(job(j.id)));}));
app.get('/api/connection',(_req,res)=>res.json({...remoteSessionStatus(),providers:{hamkadeh:remoteSessionStatus(),moshavere:remoteSessionStatus('moshavere')}}));
app.post('/api/connection/import',wrap(async(req:any,res:any)=>{
 if(req.body.confirm!==true)throw new Error('اجازه صریح اتصال نشست حساب لازم است.');
 if(locked())throw new Error('ابتدا عملیات فعال را تمام یا لغو کنید.');
 const provider=z.enum(['hamkadeh','moshavere']).default('hamkadeh').parse(req.body.provider);
 await importChromeSession(config().browser.cdpEndpoint||'http://127.0.0.1:9222',provider);
 await new HamkadehHttp(loadRemoteSession(provider),config(),fetch,provider).health();res.json(remoteSessionStatus(provider));
}));
app.post('/api/landing/jobs/:id/cancel',wrap((req:any,res:any)=>{cancel(req.params.id);res.json(publicJob(job(req.params.id)));}));
app.post('/api/landing/jobs/:id/reconcile',wrap((req:any,res:any)=>{const d=z.object({outcome:z.enum(['created','not-created']),note:z.string().min(15)}).parse(req.body);reconcile(req.params.id,d.outcome,d.note);res.json(publicJob(job(req.params.id)));}));
app.get('/api/landing/jobs',wrap((req:any,res:any)=>{
 const jobs=db.prepare('SELECT id FROM jobs ORDER BY created DESC LIMIT 1000').all().map((r:any)=>publicJob(job(r.id)));
 const q=String(req.query.q||'').toLowerCase();const day=(created:string)=>{const p=new Intl.DateTimeFormat('en',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(created));return ['year','month','day'].map(k=>p.find(v=>v.type===k)?.value).join('-');};res.json(jobs.filter(j=>(!q||[j.data.blogger,j.data.type,j.data.slug].join(' ').toLowerCase().includes(q))&&(!req.query.status||j.status===req.query.status)&&(!req.query.supervisor||j.data.supervisor===req.query.supervisor)&&(!req.query.date||day(j.created)===String(req.query.date))));
}));
app.get('/api/landing/jobs/:id',wrap((req:any,res:any)=>res.json(publicJob(job(req.params.id)))));
app.post('/api/browser/login',wrap(async(_req:any,res:any)=>{if(locked())throw new Error('عملیات در جریان است.');const c=config();c.browser.headless=false;const ctx=await browser(c);const p=await ctx.newPage();await p.goto('https://new.hamkadeh.com',{waitUntil:'domcontentloaded'});res.json({message:'ورود را در مرورگر بازشده انجام دهید. نشست به‌صورت محلی حفظ می‌شود.'});}));
app.post('/api/browser/cdn',wrap(async(_req:any,res:any)=>{if(locked())throw new Error('عملیات در جریان است.');const c=config();c.browser.headless=false;const p=await (await browser(c)).newPage();await p.goto(c.cdnOrigin,{waitUntil:'domcontentloaded'});res.json({message:'صفحه CDN برای بررسی و ورود دستی باز شد.'});}));
if(existsSync('dist/index.html'))app.use(express.static('dist'));
else {const {createServer}=await import('vite');const vite=await createServer({server:{middlewareMode:true},appType:'spa'});app.use(vite.middlewares);}
app.use((error:any,_req:any,res:any,_next:any)=>{const message=error instanceof z.ZodError?'داده ورودی نامعتبر است.':error.code==='LIMIT_FILE_SIZE'?'حداکثر حجم تصویر ۱۵ مگابایت است.':error instanceof Error&&!/selector|browserType|page\.|sqlite|SQLITE|ENOENT|Timeout|net::/i.test(error.message)?error.message:'عملیات انجام نشد؛ اتصال، نشست و تنظیمات را بررسی کنید.';res.status(400).json({error:message});});
app.listen(port,'127.0.0.1',()=>console.log(`Hamkadeh panel: ${localOrigin}`));
