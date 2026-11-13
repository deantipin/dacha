import assert from 'node:assert/strict';
import test from 'node:test';
import { buildBookingHandoff } from '../lib/booking-handoff.ts';
const query = { checkIn: '2026-11-14', checkOut: '2026-11-15', adults: 2, childrenAges: [0] };
const fallback = 'https://rs-ambient.ru/original/?existing=1';
function ambient(q = query, categoryId = 'H07') { return buildBookingHandoff({ placeId: 'ambient-park', categoryId, officialUrl: fallback, query: q }); }
test('Ambient preserves infant zero, exact nights and verified category', () => {
  const result = ambient(); const url = new URL(result.url);
  assert.equal(url.origin, 'https://rs-ambient.ru'); assert.equal(url.pathname, '/booking/');
  assert.equal(url.searchParams.get('date'), query.checkIn); assert.equal(url.searchParams.get('nights'), '1');
  assert.equal(url.searchParams.get('adults'), '2'); assert.equal(url.searchParams.get('children'), '1');
  assert.equal(url.searchParams.get('children-age'), '0'); assert.equal(url.searchParams.get('room-type'), '349390');
  assert.equal(result.datesTransferred, true); assert.equal(result.categoryTransferred, true);
});
test('every verified Ambient category and unknown category stay separate', () => {
  for (const [id, external] of [['H01','350424'],['H06','349164'],['H07','349390']]) assert.equal(new URL(ambient(query,id).url).searchParams.get('room-type'), external);
  for (const id of ['unmapped','toString','constructor','__proto__']) { const result = ambient(query, id); assert.equal(new URL(result.url).searchParams.has('room-type'), false); assert.equal(result.categoryTransferred, false); }
});
test('Domingo passes actual dates, infant ages JSON and exact category mapping', () => {
  for (const [id, external] of [['S-N01-1','448468,660025,660026'],['S-N01-2','414182,660555,660556']]) {
    const result = buildBookingHandoff({ placeId: 'domingo-dacha', categoryId:id, officialUrl:'https://domingodacha.ru/booking', query });
    const url = new URL(result.url); assert.equal(url.searchParams.get('uid'),'a824ff30-0186-4dd5-b4e7-39b196d8e7d3');
    assert.equal(url.searchParams.get('dfrom'),'14-11-2026'); assert.equal(url.searchParams.get('dto'),'15-11-2026');
    assert.equal(url.searchParams.get('adults'),'2'); assert.equal(url.searchParams.get('children'),'[0]'); assert.equal(url.searchParams.get('onlyrooms'),external);
  }
});
test('no children, multiple ages, leap day and DST-independent duration', () => {
  const noChildren = new URL(ambient({ ...query, childrenAges:[] }).url); assert.equal(noChildren.searchParams.get('children'),'0'); assert.equal(noChildren.searchParams.has('children-age'),false);
  const multi = new URL(ambient({ ...query, childrenAges:[0,1,17] }).url); assert.equal(multi.searchParams.get('children'),'3'); assert.equal(multi.searchParams.get('children-age'),'0,1,17');
  for (const [checkIn,checkOut,nights] of [['2028-02-28','2028-03-01','2'],['2027-03-27','2027-03-29','2']]) assert.equal(new URL(ambient({ ...query,checkIn,checkOut }).url).searchParams.get('nights'),nights);
});
test('invalid or reversed queries leave the original official URL untouched', () => {
  for (const invalid of [null, undefined, { ...query,checkOut:query.checkIn }, { ...query,checkOut:'2026-11-13' }, { ...query,checkIn:'2026-02-30' }, { ...query,checkIn:'14-11-2026' }, { ...query,adults:0 }, { ...query,adults:2.5 }, { ...query,childrenAges:[-1] }, { ...query,childrenAges:[18] }, { ...query,childrenAges:['0'] }, { ...query,childrenAges:[true] }]) {
    const result = buildBookingHandoff({placeId:'ambient-park',categoryId:'H07',officialUrl:fallback,query:invalid}); assert.equal(result.url,fallback); assert.equal(result.datesTransferred,false); assert.equal(result.categoryTransferred,false);
  }
});
test('unknown properties receive no fabricated parameters even with a known category ID', () => {
  const officialUrl = 'https://lesresort.ru/booking/?existing=1';
  assert.deepEqual(buildBookingHandoff({placeId:'les-art-resort',categoryId:'H07',officialUrl,query}),{url:officialUrl,datesTransferred:false,categoryTransferred:false});
});
test('catalog filters never leak into provider query strings', () => {
  const url = new URL(ambient({...query,region:'Московская область',minBedrooms:'2',minArea:'60'}).url);
  for (const key of ['region','minBedrooms','minArea','refresh','force']) assert.equal(url.searchParams.has(key),false);
  assert.equal(url.searchParams.size,6);
});
test('unsafe fallback URLs are rejected and no query is required for an official link', () => {
  for (const officialUrl of ['javascript:alert(1)','https://name:secret@example.com/','not a url',null]) assert.equal(buildBookingHandoff({placeId:'unknown',officialUrl,query}).url,undefined);
  assert.equal(buildBookingHandoff({placeId:'unknown',officialUrl:'https://example.com/'}).url,'https://example.com/');
});
