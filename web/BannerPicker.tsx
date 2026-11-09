import React,{useEffect,useState} from 'react';
export default function BannerPicker({file,onChange,label='تصویر بنر'}:{file?:File;onChange:(file:File|undefined)=>void;label?:string}){
 const [preview,setPreview]=useState('');
 useEffect(()=>{if(!file){setPreview('');return;}const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url);},[file]);
 return <div className="bannerPicker"><label className="drop">{preview?<img src={preview} alt={'پیش‌نمایش '+label}/>:<strong>تصویر بنر را انتخاب کنید</strong>}<input aria-label={label} type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>onChange(e.target.files?.[0])}/></label>{file&&<small className="bannerFilename" title={file.name}>{file.name}</small>}</div>;
}
