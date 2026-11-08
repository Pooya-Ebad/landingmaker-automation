import React from 'react';
export default function SiteErrorView({details}:{details:any}){
 if(!details)return null;
 return <div className="reviewPanel"><h3>پاسخ خطای سایت</h3><p>{details.provider==='moshavere'?'مشاوره':'همکده'} · HTTP {details.httpStatus}</p>{details.messages?.map((m:string,i:number)=><p key={i}>{m}</p>)}{details.validation?.map((v:any,i:number)=><p key={i}><strong>{v.field}: </strong>{v.message}</p>)}{!details.messages?.length&&!details.validation?.length&&<p>سایت پیام خطای قابل‌نمایش برنگرداند.</p>}<small>مرحله: <span dir="ltr">{details.phase}</span></small></div>;
}
