import React,{useEffect,useState} from 'react';
export default function TypeReuseWarning({api,supervisor,type,confirmed,onConfirm}:{api:(url:string,body?:any)=>Promise<any>;supervisor:string;type:number;confirmed:boolean;onConfirm:(v:boolean)=>void}){
 const pair=supervisor+':'+type;const [result,setResult]=useState<{pair:string;used:boolean;count:number}>();
 useEffect(()=>{let active=true;if(!supervisor||!Number.isSafeInteger(type)||type<1)return;const timer=setTimeout(()=>{void api('/landing/type-status',{supervisor,type}).then(r=>{if(active)setResult({pair,...r});}).catch(()=>{if(active)setResult(undefined);});},150);return()=>{active=false;clearTimeout(timer);};},[supervisor,type]);
 if(result?.pair!==pair||!result?.used)return null;
 return <div className="alert warning"><p>تایپ {type} برای این سرپرست قبلاً استفاده شده است ({result.count} بار). کنترل تکراری بودن تایپ و توکن در سایت همچنان انجام می‌شود.</p><label className="confirmChoice"><input type="checkbox" checked={confirmed} onChange={e=>onConfirm(e.target.checked)}/>این تایپ قبلاً استفاده شده؛ استفاده دوباره از همین شماره را تأیید می‌کنم.</label></div>;
}
