import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import defaults from '../config/defaults.json';
import {validateConfig} from '../server/core';
test('CDP configuration only accepts a local explicit port',()=>{
 const c:any=structuredClone(defaults);c.browser.mode='cdp';validateConfig(c);
 for(const endpoint of ['http://other.test:9222','http://127.0.0.1','https://127.0.0.1:9222','http://127.0.0.1:9222/path','http://user:pass@127.0.0.1:9222','http://127.0.0.1:9222?x=1']){c.browser.cdpEndpoint=endpoint;assert.throws(()=>validateConfig(c));}
});
test('CDP uses existing context and detaches without closing the user browser or tabs',async()=>{
 process.env.DATA_DIR=mkdtempSync(path.join(tmpdir(),'hamkadeh-cdp-data-'));
 const profile=mkdtempSync(path.join(tmpdir(),'hamkadeh-cdp-browser-'));
 const owner=await chromium.launchPersistentContext(profile,{headless:true,channel:process.env.BROWSER_CHANNEL||'msedge',args:['--remote-debugging-port=19322']});
 try {
  const original=owner.pages()[0];await original.goto('data:text/html,<title>Original tab</title>');
  const {browser,closeBrowser}=await import('../server/browser');
  const c:any=structuredClone(defaults);c.browser.mode='cdp';c.browser.cdpEndpoint='http://127.0.0.1:19322';
  const ctx=await browser(c);assert.ok(ctx.pages().some(p=>p.url().startsWith('data:text/html')));
  const ownPage=await ctx.newPage();await ownPage.goto('data:text/html,<title>Automation tab</title>');await ownPage.close();
  await closeBrowser();assert.equal(original.isClosed(),false);assert.equal(await original.title(),'Original tab');
  const reconnected=await browser(c);assert.ok(reconnected.pages().length>=1);await closeBrowser();assert.equal(original.isClosed(),false);
 }finally{await owner.close();}
});
