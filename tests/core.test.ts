import {test} from 'node:test';
import assert from 'node:assert/strict';
import defaults from '../config/defaults.json';
import {duplicateCount,parseRequest,makeSlug,makeCurrentSlug,todayJalali,transliterate,validatePage,validateConfig} from '../server/core';
test('Persian parser extracts metadata, preserves unknown fields and normalizes company',()=>{const d:any=parseRequest('مورخ : ۱۴۰۵/۰۸/۱۶\nنام بلاگر: شف سحر\nسناریونویس : نصیری\nایده: قدیم\nموضوع سناریو : خیانت\nاسم سناریو : خواب زمستانی\nاستوری : ۲\nسبک : دایرکت طولانی\nشرکت: ADWISE\nکد داخلی: ۱۲',defaults);assert.equal(d.date,'1405/08/16');assert.equal(d.blogger,'شف سحر');assert.equal(d.stories,'2');assert.equal(d.category,'infidelity');assert.equal(d.company,'adwise');assert.equal(d.unknown['کد داخلی'],'12');});
test('unknown company and ambiguous category require manual input',()=>{const d=parseRequest('شرکت: دیگر\nموضوع: خیانت و فرزند',defaults);assert.equal(d.company,'');assert.equal(d.category,'');});
test('slug removes spaces, normalizes digits and omits year',()=>{assert.equal(makeSlug('بهار فرمانی','۱۴۰۵/۰۸/۱۶',defaults),'baharfarmani0816');assert.equal(makeSlug('بهار','1405/13/16',defaults),'');assert.equal(makeSlug('بهار','',defaults),'');});
test('name-aware transliteration restores vowels, compounds and user spelling overrides',()=>{
 assert.equal(makeSlug('پوریا عزیزی','1405/08/17',defaults),'pouriaazizi0817');
 assert.equal(transliterate('پُوریا عزيزي'),'pouriaazizi');
 assert.equal(transliterate('پویا نوری'),'pouyanouri');
 assert.equal(transliterate('محمدرضا علیزاده'),'mohammadrezaalizadeh');
 assert.equal(transliterate('پورعلی حسن زاده'),'pouralihasanzadeh');
 assert.equal(transliterate('پوریا عزیزی',{'پوریا':'Pourya'}),'pouryaazizi');
 assert.equal(transliterate('پوریا عزیزی',{'پوریا عزیزی':'Custom Name'}),'customname');
 assert.equal(transliterate('Ali ۱۲ @!'),'ali12');
});
test('production slug uses today in Tehran and switches at Tehran midnight',()=>{
 assert.equal(todayJalali(new Date('2026-11-08T09:00:00Z')),'1405/08/17');
 assert.equal(makeCurrentSlug('دریا فلورا',defaults,new Date('2026-11-08T09:00:00Z')),'daryaflora0817');
 assert.equal(makeCurrentSlug('دریا فلورا',defaults,new Date('2026-11-07T20:29:00Z')),'daryaflora0816');
 assert.equal(makeCurrentSlug('دریا فلورا',defaults,new Date('2026-11-07T20:30:00Z')),'daryaflora0817');
});
test('zero count accepts all Persian and Arabic digits',()=>{for(const n of ['0','۰','٠'])assert.equal(duplicateCount(`با تایپ و توکن این لندینگ ${n} لندینگ دیگر وجود دارد آیا مایل به ایجاد کپی از این لندینگ هستید؟`),0);});
test('positive duplicate counts never become zero',()=>{assert.equal(duplicateCount('با تایپ و توکن این لندینگ ۱۲ لندینگ دیگر وجود دارد'),12);assert.equal(duplicateCount('با تایپ و توکن این لندینگ ١ لندینگ دیگر وجود دارد'),1);});
test('missing, malformed, negative, fractional and contradictory counts fail closed',()=>{for(const t of ['', '0','با تایپ و توکن این لندینگ -1 لندینگ دیگر وجود دارد','با تایپ و توکن این لندینگ 0.0 لندینگ دیگر وجود دارد','با تایپ و توکن این لندینگ صفر لندینگ دیگر وجود دارد','با تایپ و توکن این لندینگ 0 لندینگ دیگر وجود دارد با تایپ و توکن این لندینگ 1 لندینگ دیگر وجود دارد'])assert.throws(()=>duplicateCount(t));});
test('copy URL rejects foreign host, query, fragment and wrong path',()=>{validateConfig(defaults);for(const u of ['http://new.hamkadeh.com/dashboard/showLandings/newofcopy/1','https://evil.test/dashboard/showLandings/newofcopy/1','https://new.hamkadeh.com/dashboard/showLandings/newofcopy/1?x=2','https://new.hamkadeh.com/dashboard/showLandings/newofcopy/1#x','https://new.hamkadeh.com/dashboard'])assert.throws(()=>validatePage(u));const c=structuredClone(defaults);c.landingPages.marital.url=c.landingPages.general.url;assert.throws(()=>validateConfig(c));});
