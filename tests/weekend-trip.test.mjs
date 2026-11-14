import assert from 'node:assert/strict';
import test from 'node:test';
import { hasWeekendCoordinates, matchesWeekendQuery, weekendObservationIsValid, weekendOfferState } from '../lib/weekend-trip.ts';

const query = { checkIn: '2026-11-14', checkOut: '2026-11-15', adults: 2, childrenAges: [0] };
const checked = Date.parse('2026-11-13T15:00:00Z');
const offer = { id: 'comfort', categoryId: 'H07', categoryName: 'Комфорт вилла', status: 'observed_available', totalPriceRub: 22000, checkedAt: new Date(checked).toISOString(), expiresAt: new Date(checked + 3600000).toISOString() };
const location = { id: 'ambient', placeId: 'ambient-park', latitude: 55.5, longitude: 37.5, geoAccuracy: 'complex', offers: [offer] };
const trip = { id: 'family-2026-11-14', query, locations: [location] };
const places = [{ id: 'ambient-park', categories: [{ id: 'H07' }] }, { id: 'other-place', categories: [{ id: 'R04' }] }];
function state(changes = {}, now = checked + 1000, q = query, where = location) { return weekendOfferState(trip, where, { ...offer, ...changes }, q, now, places); }

test('family observations cannot be reused for different dates, guests or infant age', () => {
  assert.equal(matchesWeekendQuery(trip, query), true);
  for (const change of [{ checkOut: '2026-11-16' }, { checkIn: '2026-11-15' }, { adults: 3 }, { childrenAges: [] }, { childrenAges: [1] }, { childrenAges: ['0'] }, { childrenAges: [false] }]) {
    const different = { ...query, ...change };
    assert.equal(matchesWeekendQuery(trip, different), false);
    assert.equal(state({}, checked, different), 'recheck');
  }
});
test('malformed calendar days and reversed stays never match, even in a malformed snapshot', () => {
  for (const dates of [{ checkIn: '2026-02-30', checkOut: '2026-03-02' }, { checkIn: '2026-11-15', checkOut: '2026-11-14' }, { checkIn: '14-11-2026', checkOut: '15-11-2026' }]) {
    const invalid = { ...query, ...dates };
    assert.equal(matchesWeekendQuery({ ...trip, query: invalid }, invalid), false);
  }
});
test('prices expire at their deadline and never remain valid beyond one hour', () => {
  assert.equal(state({}, checked + 3599999), 'observed_available');
  assert.equal(state({}, checked + 3600000), 'recheck');
  assert.equal(state({ expiresAt: new Date(checked + 7200000).toISOString() }, checked + 3600000), 'recheck');
  assert.equal(state({ expiresAt: new Date(checked + 300000).toISOString() }, checked + 300000), 'recheck');
});
test('future, corrupt and impossible observation timestamps never make an offer available', () => {
  assert.equal(state({}, checked - 1), 'recheck');
  for (const invalid of [{ checkedAt: 'bad' }, { expiresAt: 'bad' }, { expiresAt: offer.checkedAt }]) assert.equal(state(invalid), 'recheck');
  assert.equal(state({}, NaN), 'recheck');
  for (const price of [null, 0, -1, NaN, Infinity]) assert.equal(state({ totalPriceRub: price }), 'recheck');
});
test('category identifiers cannot transfer a quote to another property or category', () => {
  assert.equal(state({ categoryId: 'R04' }), 'recheck');
  assert.equal(state({}, checked, query, { ...location, placeId: 'other-place' }), 'recheck');
  assert.equal(state({ categoryId: 'unknown' }), 'recheck');
  assert.equal(state({ categoryId: null }, checked, query, { ...location, placeId: null }), 'observed_available');
});
test('only valid observations may be described as historical map candidates', () => {
  assert.equal(weekendObservationIsValid(trip, location, offer, query, checked + 7200000, places), true);
  for (const changes of [{ checkedAt: 'bad' }, { expiresAt: 'bad' }, { categoryId: 'R04' }, { checkedAt: new Date(checked + 10000).toISOString() }, { totalPriceRub: null }]) assert.equal(weekendObservationIsValid(trip, location, { ...offer, ...changes }, query, checked, places), false);
  assert.equal(weekendObservationIsValid(trip, location, offer, { ...query, childrenAges: [1] }, checked, places), false);
});
test('a failed or uncertain observation is never represented as sold out', () => {
  assert.equal(state({ status: 'unverified', totalPriceRub: null }), 'unverified');
  assert.equal(state({ status: 'no_offer', totalPriceRub: null }), 'no_offer');
  assert.equal(state({ status: 'no_offer', totalPriceRub: null }, checked + 3600000), 'recheck');
});
test('unknown or invalid locations cannot silently acquire a map marker', () => {
  assert.equal(hasWeekendCoordinates(location), true);
  for (const changes of [{ geoAccuracy: 'unknown' }, { latitude: null }, { longitude: null }, { latitude: 91 }, { longitude: 181 }, { latitude: NaN }, { latitude: '55.5' }]) assert.equal(hasWeekendCoordinates({ ...location, ...changes }), false);
});
