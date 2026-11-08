import React,{useState} from 'react';
export default function LandingResult({url,type,blogger}:{url:string;type:number;blogger:string}){
 const [note,setNote]=useState('');
 const copy=async()=>{try{await navigator.clipboard.writeText(`${url}\n${type} ${blogger}`);setNote('لینک، نام و تایپ کپی شدند.');}catch{setNote('کپی خودکار ممکن نیست؛ دو خط نتیجه را انتخاب و کپی کنید.');}};
 return <><div className="copyLine"><a dir="ltr" href={url} target="_blank" rel="noreferrer">{url}</a></div><div className="copyLine"><span>{type} {blogger}</span><button onClick={()=>void copy()}>کپی لینک، نام و تایپ</button></div>{note&&<small role="status">{note}</small>}</>;
}
