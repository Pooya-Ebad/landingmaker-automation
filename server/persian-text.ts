export const normalize=(s:string)=>s.normalize('NFKC').replace(/[يى]/g,'ی').replace(/ك/g,'ک').replace(/[\u200c\u200f\u200e]/g,' ').replace(/[۰-۹٠-٩]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.includes(c)?'۰۱۲۳۴۵۶۷۸۹'.indexOf(c):'٠١٢٣٤٥٦٧٨٩'.indexOf(c))).replace(/\s+/g,' ').trim();
export const cleanName=(s:string)=>normalize(s).replace(/[\u064b-\u065f\u0670\u0640]/g,'').replace(/[-–—]+/g,' ').replace(/\s+/g,' ').trim().toLowerCase();
export const compactName=(s:string)=>cleanName(s).replace(/\s/g,'');
