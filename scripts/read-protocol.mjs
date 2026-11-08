import {readFileSync,writeFileSync} from 'node:fs';
import {transform} from 'esbuild';
for(const [from,to] of [['data/protocol/landing-0-main.fe6034be.js','data/protocol/landing-readable.js'],['data/protocol/cdn-0-index-legacy-Cq7LuGdA.js','data/protocol/cdn-readable.js']]){
 const r=await transform(readFileSync(from,'utf8'),{minify:false,charset:'utf8'});writeFileSync(to,r.code);
}
