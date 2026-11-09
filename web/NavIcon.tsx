import React from 'react';
export default function NavIcon({name}:{name:string}){
 return <svg className="navIcon" viewBox="0 0 24 24" aria-hidden="true">{name==='new'?<><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8M8 12h5M12 15v4M10 17h4"/></>:name==='batch'?<><rect x="7" y="7" width="14" height="14" rx="3"/><path d="M16 3H6a3 3 0 0 0-3 3v10M11 12h6M11 16h4"/></>:name==='history'?<><path d="M3 10a9 9 0 1 1 1 7M3 4v6h6M12 7v5l3 2"/></>:<><path d="M5 7h14M5 17h14"/><circle cx="9" cy="7" r="3" fill="white"/><circle cx="15" cy="17" r="3" fill="white"/></>}</svg>;
}
