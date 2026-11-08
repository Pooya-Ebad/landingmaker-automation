import {validatePage} from './core';
export type Provider='hamkadeh'|'moshavere';
export const providers={
 hamkadeh:{label:'همکده',dashboard:'https://new.hamkadeh.com',api:'https://landing.hamkadeh.com/api',landing:'https://landing.hamkadeh.com'},
 moshavere:{label:'مشاوره',dashboard:'https://new.moshavere.me',api:'https://landing.moshavere.me/api',landing:'https://landing.moshavere.me'}
};
export function target(d:any,c:any){
 const id:Provider=d.builder||'hamkadeh';if(id!=='hamkadeh'&&id!=='moshavere')throw new Error('لندینگ‌ساز انتخاب‌شده معتبر نیست.');
 const page=c.landingPages[d.category];const url=id==='moshavere'?page?.moshavereUrl:page?.url;
 if(!url)throw new Error('برای این موضوع آدرس مشاوره ثبت نشده است؛ مرجع را در تنظیمات تکمیل کنید.');
 return {id:id as Provider,...providers[id],url:validatePage(url,id),landing:id==='hamkadeh'?c.landingOrigin:providers.moshavere.landing};
}
