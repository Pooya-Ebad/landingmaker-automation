import React,{useState} from 'react';
export default function UploadDiagnosticView({details}:{details:any}){
 const [note,setNote]=useState('');if(!details)return null;
 return <details><summary>جزئیات عیب‌یابی آپلود · {details.code}</summary><p>شناسه پیگیری: <span dir="ltr">{details.traceId}</span></p><pre style={{direction:'ltr',textAlign:'left'}}>{JSON.stringify(details,null,2)}</pre><button onClick={()=>void navigator.clipboard.writeText(JSON.stringify(details,null,2)).then(()=>setNote('گزارش کپی شد.')).catch(()=>setNote('کپی خودکار ممکن نیست؛ متن گزارش را انتخاب و کپی کنید.'))}>کپی گزارش آپلود</button>{note&&<p role="status">{note}</p>}</details>;
}
