import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chromium,type BrowserContext} from 'playwright';
import {mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {HfsUpload} from '../server/hfs-upload';
test('HFS upload uses Pick files, Send, returned Copy links URL and verifies bytes',async()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'hamkadeh-hfs-'));const file=path.join(dir,'sample.png');const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jK1cAAAAASUVORK5CYII=','base64');writeFileSync(file,bytes);
 const returned='https://cdn.hamkadeh.com/renamed%20sample%20(7).png';
 const b=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'msedge'});
 try{
  const ctx=await b.newContext({serviceWorkers:'block'});ctx.setDefaultTimeout(5000);let probes=0;
  await ctx.route('**/*',route=>route.request().url()==='https://cdn.hamkadeh.com/'?route.fulfill({contentType:'text/html; charset=utf-8',body:`<button id="upload-button" onclick="document.getElementById('upload-dialog').hidden=false">Upload</button><div id="upload-dialog" hidden><select><option>Skip existing files</option><option>Rename to avoid overwriting</option></select><button onclick="document.getElementById('file').click()">Pick files</button><input hidden type="file" id="file" onchange="document.getElementById('send').hidden=false"><button id="send" hidden onclick="document.getElementById('status').textContent='1 finished (100 KB)'">Send 1 file, 100 KB</button><p id="status"></p><a onclick="navigator.clipboard.writeText('${returned}')">Copy links</a></div>`}):route.abort());
  const proxy=new Proxy(ctx,{get(target,key){if(key==='request')return {get:async(url:string)=>{assert.equal(url,returned);probes++;return {ok:()=>true,headers:()=>({'content-type':'image/png'}),body:async()=>bytes};}};const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}}) as BrowserContext;
  assert.equal(await new HfsUpload().upload(proxy,file,{cdnOrigin:'https://cdn.hamkadeh.com',browser:{timeout:5000},selectors:{uploadButton:'#upload-button'}}),returned);assert.equal(probes,1);
 }finally{await b.close();}
});
