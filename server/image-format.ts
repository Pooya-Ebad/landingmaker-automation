export function imageFormat(b:Buffer){
 if(b.subarray(0,3).equals(Buffer.from([255,216,255])))return {extension:'.jpg',mime:'image/jpeg'};
 if(b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return {extension:'.png',mime:'image/png'};
 if(b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP')return {extension:'.webp',mime:'image/webp'};
 return null;
}
