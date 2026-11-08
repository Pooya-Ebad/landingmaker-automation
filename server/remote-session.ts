import {db,seal,unseal,config} from './store';
import {providers,type Provider} from './providers';
export interface RemoteSession {token:string;userId:number;cdnCookies:Array<{name:string;value:string;expires:number}>}
db.exec(`CREATE TABLE IF NOT EXISTS remote_session(id INTEGER PRIMARY KEY CHECK(id=1), value TEXT NOT NULL, updated TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS provider_sessions(provider TEXT PRIMARY KEY,value TEXT NOT NULL,updated TEXT NOT NULL);
 INSERT OR IGNORE INTO provider_sessions SELECT 'hamkadeh',value,updated FROM remote_session WHERE id=1;`);
export function loadRemoteSession(provider:Provider='hamkadeh'):RemoteSession {const row=db.prepare('SELECT value FROM provider_sessions WHERE provider=?').get(provider) as any;if(!row)throw new Error('ابتدا نشست ورود '+providers[provider].label+' و CDN را از تنظیمات متصل کنید.');return JSON.parse(unseal(row.value));}
export function saveRemoteSession(value:RemoteSession,provider:Provider='hamkadeh'){db.prepare('INSERT OR REPLACE INTO provider_sessions VALUES(?,?,?)').run(provider,seal(JSON.stringify(value)),new Date().toISOString());}
export function remoteSessionStatus(provider:Provider='hamkadeh'){const row=db.prepare('SELECT updated FROM provider_sessions WHERE provider=?').get(provider) as any;return {configured:!!row,updated:row?.updated||null};}
// Invoked only by the explicit account-connect action. Never invoked by jobs.
export async function importChromeSession(endpoint:string,provider:Provider='hamkadeh'){
 const {validateCdpEndpoint}=await import('./browser');validateCdpEndpoint(endpoint);
 const {chromium}=await import('playwright');const b=await chromium.connectOverCDP(endpoint,{timeout:15000});
 try{
  const contexts=b.contexts();if(contexts.length!==1)throw new Error('نشست Chrome یکتا نیست.');const ctx=contexts[0];
  const page=ctx.pages().find(p=>{try{return new URL(p.url()).origin===providers[provider].dashboard;}catch{return false;}});
  if(!page)throw new Error('یک تب واردشده '+providers[provider].label+' را در Chrome باز کنید.');
  const auth=await page.evaluate(()=>{const d=JSON.parse(localStorage.getItem('userData')||'{}');return {token:d.token,userId:d.user?.id};});
  const cookies=(await ctx.cookies('https://cdn.hamkadeh.com/')).filter(c=>['hfs_https','hfs_https.sig'].includes(c.name)).map(({name,value,expires})=>({name,value,expires}));
  if(typeof auth.token!=='string'||!Number.isSafeInteger(auth.userId)||cookies.length!==2)throw new Error('ورود معتبر هر دو سرویس لازم است.');
  const candidate={...auth,cdnCookies:cookies};const {HamkadehHttp}=await import('./remote-api');await new HamkadehHttp(candidate,config(),fetch,provider).health();
  saveRemoteSession(candidate,provider);return remoteSessionStatus(provider);
 }finally{await b.close();}
}
