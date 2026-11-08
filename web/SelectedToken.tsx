import React,{useEffect,useState} from 'react';
export default function SelectedToken({api,supervisor,company,revision,tokenId='',options=[],onSelect}:{api:(url:string,body?:any)=>Promise<any>;supervisor:string;company:string;revision?:any;tokenId?:string;options?:any[];onSelect?:(id:string)=>void}){
 const [state,setState]=useState<{pair:string;value:string;error:string}>({pair:'',value:'',error:''});
 const pair=supervisor+':'+company+':'+tokenId;const allowed=options.filter(t=>t.company===company);
 useEffect(()=>{let active=true;if(supervisor&&company){if(!tokenId&&allowed.length&&!allowed.some(t=>!t.id)&&onSelect){onSelect(allowed[0].id);return;}void api('/tokens/selected',{supervisor,company,tokenId,display:true}).then(r=>{if(active)setState({pair,value:r.value,error:''});}).catch(()=>{if(active)setState({pair,value:'',error:'توکن این سرپرست و شرکت موجود نیست'});});}return()=>{active=false;};},[supervisor,company,tokenId,revision]);
 return <label>توکن{allowed.length>1&&<select aria-label="انتخاب توکن" value={tokenId} onChange={e=>onSelect?.(e.target.value)}>{allowed.map(t=><option key={t.id||''} value={t.id||''}>{t.label||'توکن اصلی'}</option>)}</select>}<input dir="ltr" readOnly autoComplete="off" value={state.pair===pair?state.value:''} placeholder={!supervisor||!company?'ابتدا سرپرست و شرکت را انتخاب کنید':state.pair===pair?state.error:'در حال دریافت…'}/></label>;
}
