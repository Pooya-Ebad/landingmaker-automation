import {cleanName,compactName} from './persian-text';
import {commonNames} from './persian-names';
import {givenNames,givenAliases,givenVariants,compoundFollowers} from './given-names';
const letters:Record<string,string>={'ا':'a','آ':'a','ب':'b','پ':'p','ت':'t','ث':'s','ج':'j','چ':'ch','ح':'h','خ':'kh','د':'d','ذ':'z','ر':'r','ز':'z','ژ':'zh','س':'s','ش':'sh','ص':'s','ض':'z','ط':'t','ظ':'z','ع':'a','غ':'gh','ف':'f','ق':'gh','ک':'k','گ':'g','ل':'l','م':'m','ن':'n','و':'v','ه':'h','ی':'i','ئ':'y','ء':'','ؤ':'o'};
const latin=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
const knownGiven=Object.fromEntries(Object.entries(givenNames).map(([k,v])=>[compactName(k),latin(v)]));
for(const [alias,name]of Object.entries(givenAliases))knownGiven[compactName(alias)]??=knownGiven[compactName(name)];
const aliasKeys=Object.fromEntries(Object.entries(givenAliases).filter(([k,v])=>!givenNames[k]||givenNames[k]===givenNames[v]).map(([k,v])=>[compactName(k),compactName(v)]));
export const canonicalGivenKey=(name:string)=>aliasKeys[compactName(name)]||compactName(name);
const families:Record<string,string>={...commonNames,'فرهمند':'farahmand','رضوی':'razavi','رسولی':'rasouli','سلطانی':'soltani','صالحی':'salehi','نظری':'nazari','شاکری':'shakeri','بهرامی':'bahrami','مهرابی':'mehrabi','رحمانی':'rahmani','دهقانی':'dehghani','عزیزی':'azizi','ماهینی':'mahini','نجفی':'najafi','صفری':'safari','رجبی':'rajabi','زارعی':'zarei','فتحی':'fathi','تقوی':'taghavi','نعمتی':'nemati','مقدم':'moghadam','فلاح':'fallah','کریمی':'karimi','احسانی':'ehsani','صفوی':'safavi','مهدوی':'mahdavi','هاشمی':'hashemi','فراهانی':'farahani','محمدی':'mohammadi','علوی':'alavi','سعیدی':'saeedi','افشار':'afshar','جلالی':'jalali','منصوری':'mansouri','قریشی':'ghoreishi','رحیم':'rahim','خلیل':'khalil','حسن':'hasan','حسین':'hossein','اکبر':'akbar','اصغر':'asghar','علی':'ali','رضا':'reza','نژاد':'nejad','نیا':'nia','دوست':'doust','وند':'vand','آباد':'abad'};
const honorifics=new Set(['خانم','آقای','اقای','دکتر','مهندس','جناب','سرکار']);
type Piece={latin:string;known:boolean;source:'dictionary'|'given'|'compound'|'latin'|'fallback'|'learned'};
export type NameAnalysis={latin:string;givenName:string;givenLatin:string;familyName:string;familyLatin:string;familyKnown:boolean;prefixLatin:string;confidence:'high'|'medium'|'low';unknownParts:string[];alternatives:string[];canLearnGiven:boolean;source:string};
export function analyzeName(name:string,dictionary:Record<string,string>={},learned:Record<string,string>={}):NameAnalysis{
 const custom=Object.fromEntries(Object.entries(dictionary).map(([k,v])=>[cleanName(k),latin(v)]));
 const customCompact=Object.fromEntries(Object.entries(custom).map(([k,v])=>[compactName(k),v]));
 const personal=Object.fromEntries(Object.entries(learned).map(([k,v])=>[compactName(k),latin(v)]));
 const given=(text:string,depth=0):Piece|undefined=>{
  const key=compactName(text);if(personal[key]||personal[canonicalGivenKey(key)])return {latin:personal[key]||personal[canonicalGivenKey(key)],known:true,source:'learned'};
  if(customCompact[key])return {latin:customCompact[key],known:true,source:'dictionary'};
  if(knownGiven[key])return {latin:knownGiven[key],known:true,source:'given'};
  if(depth<2)for(const [prefix,followers]of Object.entries(compoundFollowers)){
   if(!key.startsWith(prefix)||key.length<=prefix.length)continue;const rest=key.slice(prefix.length);
   if(!followers.some(f=>rest===compactName(f)||rest.startsWith(compactName(f))&&Object.keys(compoundFollowers).includes(f)))continue;
   const tail=given(rest,depth+1);if(tail&&knownGiven[prefix])return {latin:knownGiven[prefix]+tail.latin,known:true,source:'compound'};
  }
 };
 const word=(text:string,depth=0):Piece=>{
  const key=compactName(text);if(custom[cleanName(text)]||customCompact[key])return {latin:custom[cleanName(text)]||customCompact[key],known:true,source:'dictionary'};
  if(families[key])return {latin:families[key],known:true,source:'dictionary'};
  if(/^[a-z0-9]+$/.test(key))return {latin:key,known:true,source:'latin'};
  if(depth<3){for(const suffix of ['زاده','نژاد','پور','نیا','وند','دوست','آباد'])if(key.endsWith(suffix)&&key.length>suffix.length){const root=word(key.slice(0,-suffix.length),depth+1);return {latin:root.latin+(families[suffix]||latin(suffix)),known:root.known,source:root.known?'compound':'fallback'};}
   if(key.startsWith('پور')&&key.length>3){const root=word(key.slice(3),depth+1);return {latin:'pour'+root.latin,known:root.known,source:root.known?'compound':'fallback'};}}
  return {latin:latin([...key].map(c=>letters[c]??c).join('')),known:false,source:'fallback'};
 };
 let tokens=cleanName(name).split(' ').filter(Boolean);while(tokens.length&&honorifics.has(tokens[0]))tokens.shift();
 let prefixLatin='';if(tokens[0]==='شف'||tokens[0]==='chef'){prefixLatin=custom[tokens[0]]||'chef';tokens=tokens.slice(1);}
 let givenCount=0,givenPiece:Piece|undefined;
 for(let count=Math.min(3,tokens.length);count>0;count--){const found=given(tokens.slice(0,count).join(' '));if(found){givenCount=count;givenPiece=found;break;}}
 if(!givenPiece&&tokens.length){givenCount=1;givenPiece=/^[a-z0-9]+$/.test(tokens[0])?{latin:tokens[0],known:true,source:'latin'}:word(tokens[0]);}
 const givenName=tokens.slice(0,givenCount).join(' '),familyTokens=tokens.slice(givenCount),familyPieces=familyTokens.map(t=>word(t));
 const familyName=familyTokens.join(' '),familyLatin=familyPieces.map(p=>p.latin).join('');
 const unknownParts=[...(!givenPiece?.known&&givenName?[givenName]:[]),...familyTokens.filter((_,i)=>!familyPieces[i].known)];
 const whole=custom[cleanName(name)];const assembled=prefixLatin+(givenPiece?.latin||'')+familyLatin;
 const result=whole||assembled;const confidence=whole?'high':unknownParts.length?'low':givenPiece?.source==='compound'||familyPieces.some(p=>p.source==='compound')?'medium':'high';
 const alternatives=whole?[]:[...new Set((givenVariants[canonicalGivenKey(givenName)]||[]).map(v=>prefixLatin+v+familyLatin))].filter(v=>v!==result).slice(0,3);
 return {latin:result,givenName,givenLatin:givenPiece?.latin||'',familyName,familyLatin,familyKnown:familyPieces.length>0&&familyPieces.every(p=>p.known),prefixLatin,confidence,unknownParts,alternatives,canLearnGiven:!!givenName&&!!familyName&&familyPieces.every(p=>p.known)&&!prefixLatin,source:whole?'dictionary':givenPiece?.source||'fallback'};
}
