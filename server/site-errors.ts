export function cleanSiteText(value:string,secrets:string[]=[]){
 let s=value;for(const secret of [...new Set(secrets.filter(Boolean))].sort((a,b)=>b.length-a.length))for(const variant of new Set([secret,encodeURIComponent(secret)]))s=s.split(variant).join('[حذف‌شده]');
 return s.replace(/Bearer\s+[^\s"'<>]+/gi,'Bearer [حذف‌شده]').replace(/((?:token|authorization|cookie|password|api[_-]?key)\s*[=:]\s*)[^\s,;"'<>]+/gi,'$1[حذف‌شده]').replace(/\b[a-f0-9]{12,}\b/gi,'[حذف‌شده]').replace(/<[^>]*>/g,'').replace(/[\u0000-\u0008\u000b-\u001f]/g,'').slice(0,600);
}
export function siteErrorDetails(body:any,status:number,provider:string,phase:string,secrets:string[]){
 const messages:string[]=[],validation:{field:string;message:string}[]=[];
 const add=(v:any,field?:string,depth=0)=>{if(depth>3)return;if(typeof v==='string'){const text=cleanSiteText(v,secrets).trim();if(text){if(field&&validation.length<20)validation.push({field:cleanSiteText(field,secrets),message:text});else if(messages.length<8)messages.push(text);}return;}if(Array.isArray(v)){for(const x of v.slice(0,8))add(x,field,depth+1);}else if(v&&typeof v==='object'){for(const [k,x]of Object.entries(v).slice(0,20)){if(/token|authorization|cookie|password|secret|api.?key/i.test(k)&&typeof x==='string'&&secrets.includes(x))continue;add(x,field||k,depth+1);}}};
 add(body?.message);add(body?.error);if(body?.errors)add(body.errors);
 return {provider,httpStatus:status,phase,messages:[...new Set(messages)],validation};
}
export function requestSecrets(body:any){
 const out:string[]=[];const collect=(v:any,depth=0)=>{if(depth>4||!v||typeof v!=='object')return;for(const [k,x]of Object.entries(v)){if(/token|authorization|cookie|password|secret|api.?key/i.test(k)&&typeof x==='string')out.push(x);else if(typeof x==='object')collect(x,depth+1);}};
 if(body instanceof FormData){for(const [k,v]of body.entries())if(typeof v==='string'&&/token|authorization|password|secret/i.test(k))out.push(v);}
 else if(typeof body==='string'){try{collect(JSON.parse(body));}catch{/* Never reflect raw request text. */}}
 return out;
}
