import {test} from 'node:test';
import assert from 'node:assert/strict';
import {analyzeName} from '../server/name-transliterator';
import {givenNames} from '../server/given-names';
import {makeSlug,transliterate} from '../server/core';
import defaults from '../config/defaults.json';
const samples:Record<string,string>={
 'مهرنوش ماهینی':'mehrnoushmahini','مهسا رضایی':'mahsarezaei','مهتاب محمدی':'mahtabmohammadi','مهرناز نوری':'mehrnaznouri','مهرآفرین حیدری':'mehrafarinheydari',
 'آناهیتا عزیزی':'anahitaazizi','یلدا حسینی':'yaldahosseini','ژاله کریمی':'zhalehkarimi','ژیلا مرادی':'zhilamoradi','نفیسه جعفری':'nafisehjafari','حدیث صادقی':'hadissadeghi','شقایق رحیمی':'shaghayeghrahimi','معصومه قاسمی':'masoumehghasemi','محدثه اکبری':'mohaddesehakbari','مرضیه عباسی':'marziehabbasi',
 'هانیه نصیری':'haniehnasiri','زهره نوری':'zohrehnouri','زهرا موسوی':'zahramousavi','لیلا فرهمند':'leilafarahmand','نیلوفر سلطانی':'niloufarsoltani','فرشته شریفی':'fereshtehsharifi','رویا رستمی':'royarostami','پریسا رضوی':'parisarazavi','نگار مهرابی':'negarmehrabi','نگین بهرامی':'neginbahrami',
 'پویا کریمی':'pouyakarimi','پوریا عزیزی':'pouriaazizi','مهرداد حسینی':'mehrdadhosseini','مهیار احمدی':'mahyarahmadi','هومن محمدی':'houmanmohammadi','کوروش مرادی':'kouroshmoradi','یوسف صالحی':'yousefsalehi','سیروس نظری':'sirousnazari','محسن رحمانی':'mohsenrahmani','مجتبی حیدری':'mojtabaheydari','عرفان قاسمی':'erfanghasemi','حسام اکبری':'hesamakbari','مبین رضایی':'mobinrezaei','متین نصیری':'matinnasiri','سروش جعفری':'soroushjafari','پیمان دهقانی':'peymandehghani',
 'محمدرضا نصیری':'mohammadrezanasiri','محمد رضا نصیری':'mohammadrezanasiri','محمد‌رضا نصیری':'mohammadrezanasiri','محمد-رضا نصیری':'mohammadrezanasiri',
 'امیر حسین نوری':'amirhosseinnouri','امیرحسین نوری':'amirhosseinnouri','امیرمحمدرضا عزیزی':'amirmohammadrezaazizi','علی رضا محمدی':'alirezamohammadi','علی‌اکبر رحیمی':'aliakbarrahimi','غلام رضا رضایی':'gholamrezarezaei','فاطمه زهرا حسینی':'fatemehzahrahosseini',
 'ایدا عزیزی':'aidaazizi','آیدا عزیزی':'aidaazizi','پانته‌آ حیدری':'panteaheydari','پُوریا عزيزي':'pouriaazizi','خانم مهسا رضایی':'mahsarezaei','شف سحر':'chefsahar','محمد علیزاده':'mohammadalizadeh','علی رضایی':'alirezaei'
};
test('representative first names and compounds retain vowels across spacing and Arabic variants',()=>{
 for(const [name,expected]of Object.entries(samples))assert.equal(transliterate(name,defaults.slug.dictionary),expected,name);
});
test('all bundled given-name spellings are slug-safe and the list covers hundreds of names',()=>{
 assert.ok(Object.keys(givenNames).length>500);for(const [name,spelling]of Object.entries(givenNames))assert.match(spelling,/^[a-z]+$/,name);
});
test('unknown names are flagged rather than silently presented as reliable; custom spellings remain authoritative',()=>{
 const d=analyzeName('ژژژ عزیزی');assert.equal(d.confidence,'low');assert.ok(d.unknownParts.includes('ژژژ'));
 const a=analyzeName('علی رضایی');assert.equal(a.givenName,'علی');assert.equal(a.familyName,'رضایی');assert.equal(a.confidence,'high');
 assert.equal(transliterate('پوریا عزیزی',{'پوریا':'Pourya'}),'pouryaazizi');assert.equal(transliterate('پوریا عزیزی',{'پوریا عزیزی':'customname'}),'customname');
 assert.ok(analyzeName('پوریا عزیزی').alternatives.includes('pouryaazizi'));assert.equal(makeSlug('مهرنوش ماهینی','1405/08/18',defaults),'mehrnoushmahini0818');
});
