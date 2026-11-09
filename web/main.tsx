import BannerPicker from './BannerPicker';
import NavIcon from './NavIcon';
import LandingResult from './LandingResult';
import TypeReuseWarning from './TypeReuseWarning';
import SiteErrorView from './SiteErrorView';
import UploadDiagnosticView from './UploadDiagnosticView';
import ConnectionSettings from './ConnectionSettings';
import ProviderSelect from './ProviderSelect';
import SettingsPanel from './SettingsPanel';
import SlugEditor from './SlugEditor';
import React,{useState,useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import './style.css';
import './theme.css';
import Batch from './Batch';
import SelectedToken from './SelectedToken';
let csrf='';
async function api(url:string,body?:any,method?:string){const form=body instanceof FormData;const r=await fetch('/api'+url,{method:method||(body?'POST':'GET'),headers:{...(body&&!form?{'Content-Type':'application/json'}:{}),...(body?{'X-CSRF-Token':csrf}:{})},body:body?(form?body:JSON.stringify(body)):undefined});const data=await r.json();if(!r.ok)throw new Error(data.error||'خطا در ارتباط با سرور');return data;}
const statuses:Record<string,string>={review:'در انتظار بررسی',ready:'آماده بررسی واقعی',checked:'بررسی شد؛ منتظر تأیید ثبت',running:'در حال اجرا',uploading:'آپلود تصویر',checking:'بررسی تکراری بودن',confirming:'در حال تأیید ساخت',canceled:'لغوشده',succeeded:'ساخته‌شده',duplicate:'متوقف‌شده به علت تکراری بودن',failed:'ناموفق',uncertain:'نتیجه نامشخص؛ نیاز به بررسی'};
const fieldLabels:Record<string,string>={date:'تاریخ درخواست (شمسی)',blogger:'نام بلاگر',writer:'سناریونویس',idea:'ایده',subject:'موضوع سناریو',scenarioName:'اسم سناریو',stories:'تعداد استوری',style:'سبک'};
const formatTime=(s:string)=>new Intl.DateTimeFormat('fa-IR',{dateStyle:'short',timeStyle:'short',timeZone:'Asia/Tehran'}).format(new Date(s));
function App(){
 const [tab,setTab]=useState('new'),[settings,setSettings]=useState<any>(),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const [raw,setRaw]=useState(''),[file,setFile]=useState<File>(),[supervisor,setSupervisor]=useState('');
 const [current,setCurrent]=useState<any>(),[draft,setDraft]=useState<any>(),[slugManual,setSlugManual]=useState(false),[titleManual,setTitleManual]=useState(false),[approved,setApproved]=useState(false);
 const [history,setHistory]=useState<any[]>([]),[q,setQ]=useState(''),[status,setStatus]=useState(''),[historySupervisor,setHistorySupervisor]=useState(''),[date,setDate]=useState('');
 const [outcome,setOutcome]=useState(''),[note,setNote]=useState('');
 const [connection,setConnection]=useState<any>(),[commitApproved,setCommitApproved]=useState(false);
 const [reuseApproval,setReuseApproval]=useState('');
 useEffect(()=>setReuseApproval(''),[current?.id]);
 const run=async(fn:()=>Promise<any>)=>{setError('');setNotice('');setBusy(true);try{await fn();}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
 const loadSettings=async()=>{const s=await api('/settings');setSettings(s);setConnection(await api('/connection'));};
 useEffect(()=>{void run(async()=>{csrf=(await api('/bootstrap')).csrf;await loadSettings();});},[]);
 useEffect(()=>{if(!draft)return;let active=true;const t=setTimeout(()=>{void api('/landing/slug',{blogger:draft.blogger}).then(r=>{if(active)setDraft((d:any)=>({...d,slugAnalysis:r.slugAnalysis,...(slugManual?(d.blogger!==current?.data?.blogger?{remembered:false}:{}):{slug:r.slug,slugDate:r.slugDate,remembered:r.remembered})}));}).catch(()=>{});},180);return()=>{active=false;clearTimeout(t);};},[draft?.blogger,slugManual]);
 useEffect(()=>{if(!current||!['running','uploading','checking','confirming'].includes(current.status))return;let active=true;const timer=setInterval(()=>{void api('/landing/jobs/'+current.id).then(async j=>{if(active){setCurrent(j);if(!['running','uploading','checking','confirming'].includes(j.status))await loadSettings();}}).catch(e=>{if(active)setError(e.message);});},1500);return()=>{active=false;clearInterval(timer);};},[current?.id,current?.status]);
 const loadHistory=async()=>setHistory(await api('/landing/jobs?'+new URLSearchParams({q,status,supervisor:historySupervisor,date})));
 useEffect(()=>{if(tab==='history')void run(loadHistory);},[tab,q,status,historySupervisor,date]);
 const c=settings?.config;
 const derivedTitle=draft&&c?`${c.landingPages[draft.category]?.label||'…'} ${draft.type} ${draft.blogger||'…'} / ${c.supervisors[draft.supervisor]?.label||'…'}`:'';
 const change=(key:string,value:any)=>{if(['type','supervisor'].includes(key))setReuseApproval('');setDraft((d:any)=>({...d,[key]:value,...(['company','supervisor'].includes(key)?{tokenCompany:'',tokenId:''}:{})}));setApproved(false);};
 const select=(label:string,value:string,items:any,fn:(value:string)=>void,required=false)=><label>{label}<select aria-label={label} value={value||''} onChange={e=>fn(e.target.value)}><option value="">{required?'نیاز به انتخاب دستی':'انتخاب کنید'}</option>{Object.entries(items||{}).map(([k,v]:any)=><option key={k} value={k}>{v.label}</option>)}</select></label>;
 const openJob=(j:any)=>{setCurrent(j);setDraft(j.data);setSlugManual(true);setTitleManual(true);setApproved(j.status==='ready');setCommitApproved(false);setTab('new');};
 const retryable=current&&['failed','duplicate','canceled'].includes(current.status);
 const canEdit=current&&(['review','ready'].includes(current.status)||retryable);
 const result=current?.status==='succeeded'?current.result:null;
 return <><header><div className="brand"><img src="/brand-mark.png" width="32" height="32" alt="نشان همکده"/></div><div><h1>دستیار ساخت لندینگ</h1><p>همکده</p></div><span className="local">نسخه محلی</span></header>
 <div className="layout"><aside><nav>{[['new','ساخت لندینگ'],['batch','ساخت گروهی'],['history','تاریخچه عملیات'],['settings','تنظیمات']].map(([key,label])=><button key={key} className={tab===key?'active':''} onClick={()=>setTab(key)}><NavIcon name={key}/>{label}</button>)}</nav><button disabled={busy||!!settings?.locked} onClick={()=>void run(async()=>setNotice((await api('/browser/login',{})).message))}>ورود دستی به همکده ↗</button></aside>
 <main>{error&&<div role="alert" className="alert error">{error}</div>}{notice&&<div role="status" className="alert">{notice}</div>}
 <div hidden={tab!=='batch'}><Batch api={api} settings={settings} connection={connection} reload={loadSettings} onOpen={openJob}/></div>
 {tab==='new'&&!connection?.configured&&<div className="alert warning">ابتدا حساب را از تنظیمات متصل کنید.</div>}
 {settings?.locked&&<div className="alert warning">{current?.status==='checked'&&current.id===settings.locked.job?'این سفارش منتظر ثبت نهایی یا لغو شماست؛ شماره تایپ هنوز مصرف نشده است.':'یک عملیات فعال یا نامشخص وجود دارد.'} <button onClick={()=>void run(async()=>openJob(await api('/landing/jobs/'+settings.locked.job)))}>مشاهده عملیات</button></div>}
 {tab==='new'&&<><div className="pageHeading"><div><h2>لندینگ جدید</h2></div>{current&&<button onClick={()=>{setCurrent(undefined);setDraft(undefined);setRaw('');setFile(undefined);setApproved(false);}}>درخواست تازه</button>}</div>
 {!current&&<section><h3><b>۱</b> دریافت درخواست</h3><div className="inputGrid"><div><BannerPicker file={file} onChange={setFile}/>{select('سرپرست',supervisor,c?.supervisors,setSupervisor)}</div><label>متن درخواست<textarea className="request" value={raw} onChange={e=>setRaw(e.target.value)} placeholder={'نام بلاگر: شف سحر\nمورخ: 1405/08/16\nموضوع سناریو: خیانت\nشرکت: ادوایس'}/></label></div><div className="actions"><button className="primary" disabled={busy||!file||!raw.trim()} onClick={()=>void run(async()=>{const f=new FormData();f.append('image',file!);const upload=await api('/uploads',f);const j=await api('/landing/preview',{raw,uploadId:upload.id,supervisor});setCurrent(j);setDraft(j.data);setSlugManual(false);setTitleManual(false);setApproved(false);})}>{busy?'در حال پردازش…':'استخراج و بازبینی اطلاعات ←'}</button></div></section>}
 {draft&&current&&<><section><div className="sectionHeading"><h3><b>۲</b> بازبینی درخواست</h3><span className={'badge '+current.status}>{statuses[current.status]}</span></div><fieldset disabled={!canEdit||busy}><div className="fields"><label>نام بلاگر<input value={draft.blogger||''} onChange={e=>change('blogger',e.target.value)}/></label>
 {select('دسته‌بندی سناریو (بر اساس موضوع)',draft.category,c?.landingPages,v=>change('category',v),true)}{select('سرپرست',draft.supervisor,c?.supervisors,v=>{change('supervisor',v);change('tokenCompany','');change('type',settings?.counters?.[v]||0);},true)}{select('شرکت',draft.company,c?.companies,v=>change('company',v),true)}
 <ProviderSelect value={draft.builder} secondary={c?.landingPages[draft.category]?.moshavereUrl} onChange={v=>change('builder',v)}/>
 <SelectedToken api={api} revision={settings} supervisor={draft.supervisor} company={draft.company} tokenId={draft.tokenId} options={settings?.tokenOptions?.[draft.supervisor]} onSelect={id=>change('tokenId',id)}/>
 <label>تایپ<input type="number" min="1" value={draft.type||''} placeholder="تایپ این درخواست" onChange={e=>change('type',Number(e.target.value))}/></label></div>
 <TypeReuseWarning api={api} supervisor={draft.supervisor} type={Number(draft.type)} confirmed={reuseApproval===draft.supervisor+':'+draft.type} onConfirm={v=>setReuseApproval(v?draft.supervisor+':'+draft.type:'')}/>
 {draft.builder==='moshavere'&&!connection?.providers?.moshavere?.configured&&<p className="alert warning">نشست مشاوره هنوز متصل نیست؛ از تنظیمات، «اتصال یا تمدید نشست مشاوره» را انجام دهید.</p>}
 <h3 className="previewHeading">عنوان و اسلاگ نهایی</h3><label>عنوان لندینگ<input className="titleInput" value={titleManual?draft.title||'':derivedTitle} onChange={e=>{setTitleManual(true);change('title',e.target.value);}}/></label><SlugEditor api={api} blogger={draft.blogger} value={draft.slug} slugDate={draft.slugDate} remembered={draft.remembered} analysis={draft.slugAnalysis} onChange={v=>{setSlugManual(true);change('slug',v);}}/><div className="inline"><button className="textButton" onClick={()=>{setSlugManual(false);setTitleManual(false);setApproved(false);}}>تولید مجدد عنوان و اسلاگ</button></div>
 </fieldset>
 {['review','ready','running','uploading','checking'].includes(current.status)&&<button disabled={busy||current.data.cancelRequested} onClick={()=>void run(async()=>{setCurrent(await api('/landing/jobs/'+current.id+'/cancel',{}));await loadSettings();})}>{current.data.cancelRequested?'لغو در اولین نقطه امن انجام می‌شود':'لغو سفارش'}</button>}
 <details><summary>اطلاعات داخلی و متن اصلی</summary><pre>{JSON.stringify({unknown:draft.unknown,companyRaw:draft.companyRaw,raw:draft.raw},null,2)}</pre></details>
 
 {canEdit&&<div className="actions"><button className="primary" disabled={busy||!!settings?.locked||(draft.builder==='moshavere'?(!connection?.providers?.moshavere?.configured||!c?.landingPages[draft.category]?.moshavereUrl):!connection?.configured)} onClick={()=>void run(async()=>{setCommitApproved(false);setCurrent(await api(retryable?'/landing/jobs/'+current.id+'/retry':'/landing/build',{id:current.id,data:{...draft,confirmTypeReuse:reuseApproval===draft.supervisor+':'+draft.type,tokenCompany:draft.company,title:titleManual?draft.title:derivedTitle}}));await loadSettings();})}>{retryable?'بررسی دوباره با همین بنر':'آپلود بنر و بررسی'}</button></div>}
 </section>
 {current.status==='checked'&&<section className="successResult"><h3>بررسی واقعی تکمیل شد؛ هنوز لندینگ ساخته نشده است</h3><p>{current.result?.imageReused?'بنر قبلی بدون آپلود دوباره بررسی و تأیید شد.':'بنر آپلود و تطبیق داده شد.'}</p><p>{draft.title||derivedTitle}</p><p dir="ltr">{draft.slug}</p><label className="confirmChoice"><input type="checkbox" checked={commitApproved} onChange={e=>setCommitApproved(e.target.checked)}/>اطلاعات را بررسی کردم و می‌خواهم لندینگ واقعاً ساخته شود.</label><div className="actions"><button disabled={busy} onClick={()=>void run(async()=>{setCurrent(await api('/landing/jobs/'+current.id+'/cancel',{}));await loadSettings();})}>لغو بدون ساخت</button><button className="primary" disabled={busy||!commitApproved} onClick={()=>void run(async()=>{setCommitApproved(false);setCurrent(await api('/landing/jobs/'+current.id+'/commit',{confirm:true}));await loadSettings();})}>ثبت نهایی و دریافت لینک</button></div></section>}
 {current.error&&<section className="errorResult"><h3>{statuses[current.status]}</h3><p>{current.error}</p><p>تایپ {draft.type} · {draft.blogger} · {c?.supervisors[draft.supervisor]?.label} · {c?.companies[draft.company]?.label}</p><SiteErrorView details={current.result?.siteError}/><UploadDiagnosticView details={current.result?.uploadDiagnostic}/>{current.result?.count!==undefined&&<p>تعداد لندینگ‌های موجود: {current.result.count} — کپی انجام نشده است.</p>}{current.result?.viewLinks?.map((url:string)=><a key={url} href={url} target="_blank" rel="noreferrer">مشاهده لندینگ موجود ↗</a>)}</section>}
 {result&&<section className="successResult"><h3>لندینگ با موفقیت ساخته شد</h3><LandingResult url={result.url} type={draft.type} blogger={draft.blogger}/></section>}
 {current.status==='uncertain'&&<section><h3>بررسی نتیجه نامشخص</h3><p>پیش از آزاد کردن قفل، در سایت با تایپ، توکن و اسلاگ همین سفارش جست‌وجو کنید. این مرحله کپی را دوباره ارسال نمی‌کند.</p><label>نتیجه بررسی<select value={outcome} onChange={e=>setOutcome(e.target.value)}><option value="">انتخاب کنید</option><option value="created">ساخت در سایت تأیید شد</option><option value="not-created">عدم ساخت در سایت تأیید شد</option></select></label><label>شواهد بررسی<textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="لینک، اطلاعات صفحه و نتیجه تطبیق را بنویسید"/></label><button disabled={busy||!outcome||note.trim().length<15} onClick={()=>void run(async()=>{const j=await api('/landing/jobs/'+current.id+'/reconcile',{outcome,note});setCurrent(j);await loadSettings();})}>ثبت نتیجه بررسی</button></section>}
 </>}
 </>}
 {tab==='history'&&<><h2>تاریخچه عملیات</h2><section><div className="filters"><label>نام، تایپ یا اسلاگ<input value={q} onChange={e=>setQ(e.target.value)} placeholder="جست‌وجو…"/></label>{select('سرپرست',historySupervisor,c?.supervisors,setHistorySupervisor)}<label>وضعیت<select value={status} onChange={e=>setStatus(e.target.value)}><option value="">همه وضعیت‌ها</option>{Object.entries(statuses).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label><label>تاریخ درخواست (میلادی)<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label></div><div className="tableWrap"><table><thead><tr>{['زمان درخواست','بلاگر / اسلاگ','دسته‌بندی','سرپرست / شرکت','تایپ','وضعیت','جزئیات'].map(s=><th key={s}>{s}</th>)}</tr></thead><tbody>{history.map(j=><tr key={j.id}><td>{formatTime(j.created)}</td><td>{j.data.blogger||'—'}<small dir="ltr">{j.data.slug}</small></td><td>{c?.landingPages[j.data.category]?.label||'—'}</td><td>{c?.supervisors[j.data.supervisor]?.label}<small>{c?.companies[j.data.company]?.label}</small></td><td>{j.data.type}</td><td><span className={'badge '+j.status}>{statuses[j.status]}</span></td><td><button onClick={()=>openJob(j)}>مشاهده</button></td></tr>)}</tbody></table>{!history.length&&<p className="empty">عملیاتی یافت نشد.</p>}</div></section></>}
 {tab==='settings'&&<SettingsPanel api={api} settings={settings} reload={loadSettings}/>}
 {tab==='settings'&&<ConnectionSettings api={api} connection={connection} reload={loadSettings}/>}
 </main></div></>;
}
createRoot(document.getElementById('root')!).render(<App/>);
