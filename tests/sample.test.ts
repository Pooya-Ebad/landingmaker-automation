import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import config from '../config/defaults.json';
import {parseRequest,makeSlug,makeCurrentSlug} from '../server/core';
test('Darya sample: explicit marital alias, colonless supervisor and requested type preserve all metadata',()=>{
 const d:any=parseRequest(readFileSync('tests/fixtures/darya-request.txt','utf8'),config);
 assert.equal(d.date,'1405/08/16');assert.equal(d.blogger,'دریا فلورا');assert.equal(d.writer,'خاکپور');assert.equal(d.idea,'جدید');assert.equal(d.subject,'مشکلات زناشویی');assert.equal(d.scenarioName,'شوهر غریبه');assert.equal(d.stories,'2');assert.equal(d.style,'گویش');assert.equal(d.company,'adwise');assert.equal(d.supervisor,'rezaei');assert.equal(d.requestedType,'771111');assert.equal(d.category,'marital');assert.equal(makeSlug(d.blogger,d.date,config),'daryaflora0816');
});
test('marital aliases never match ambiguous or conflicting categories',()=>{
 assert.equal(parseRequest('موضوع سناریو: مشکلات زناشویی و خیانت',config).category,'');
 assert.equal(parseRequest('موضوع سناریو: مشکلات زناشویی\nنوع سناریو: ناشناخته',config).category,'');
});
test('Mina sample: unlabeled standalone supervisor and type are extracted without changing story count',()=>{
 const d:any=parseRequest(readFileSync('tests/fixtures/mina-request.txt','utf8'),config);
 assert.equal(d.blogger,'مینا حیدری');assert.equal(d.writer,'قربانی');assert.equal(d.idea,'قدیم');assert.equal(d.category,'infidelity');assert.equal(d.supervisor,'doosti');assert.equal(d.company,'trend');assert.equal(d.requestedType,'112297');assert.equal(d.stories,'2');assert.equal(d.scenarioName,'خواب زمستانی');assert.equal(d.style,'دایرکت طولانی');
 assert.equal(makeCurrentSlug(d.blogger,config,new Date('2026-11-08T09:00:00Z')),'minaheydari0817');
});
test('multiple unlabeled supervisors or candidate type numbers require manual selection',()=>{
 const d:any=parseRequest('نام بلاگر: تست\nدوستی\nرضایی\n112297\n112298',config);assert.equal(d.supervisor,'');assert.equal(d.requestedType,undefined);
});
