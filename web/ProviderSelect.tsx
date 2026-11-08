import React from 'react';
export default function ProviderSelect({value='hamkadeh',secondary,onChange}:{value?:string;secondary?:string;onChange:(v:string)=>void}){
 return <label>لندینگ‌ساز<select aria-label="لندینگ‌ساز" value={value} onChange={e=>onChange(e.target.value)}><option value="hamkadeh">همکده (پیش‌فرض)</option><option value="moshavere" disabled={!secondary}>مشاوره · Moshavere</option></select>{!secondary&&<small>آدرس مشاوره این موضوع در تنظیمات اختیاری است.</small>}</label>;
}
