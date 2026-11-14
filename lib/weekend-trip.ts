import type { Photo, Place } from '../app/components/catalog-types';

export type WeekendQuery = { checkIn: string; checkOut: string; adults: number; childrenAges: number[] };
export type WeekendOffer = {
  id: string; categoryId: string | null; categoryName: string;
  status: 'observed_available' | 'no_offer' | 'unverified';
  totalPriceRub: number | null; rateName: string | null; checkedAt: string; expiresAt: string;
  bookingUrl: string; sourceUrl: string; conditions: string[]; familyFacts: string[]; unknowns: string[];
  photos?: Photo[];
};
export type WeekendLocation = {
  id: string; placeId: string | null; name: string; address: string;
  latitude: number | null; longitude: number | null;
  geoAccuracy: 'complex' | 'house' | 'settlement' | 'unknown'; coordinateSourceUrl: string | null;
  offers: WeekendOffer[];
};
export type WeekendTrip = { id: string; title: string; query: WeekendQuery; researchedAt: string; locations: WeekendLocation[] };

function validDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T12:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}
export function matchesWeekendQuery(trip: WeekendTrip, query: WeekendQuery) {
  if (!validDay(query.checkIn) || !validDay(query.checkOut) || query.checkOut <= query.checkIn || !Number.isInteger(query.adults) || query.adults < 1 || !Array.isArray(query.childrenAges) || query.childrenAges.some(age => !Number.isInteger(age) || age < 0 || age > 17)) return false;
  return query.checkIn === trip.query.checkIn && query.checkOut === trip.query.checkOut && query.adults === trip.query.adults && [...query.childrenAges].sort((a, b) => a - b).join(',') === [...trip.query.childrenAges].sort((a, b) => a - b).join(',');
}
export function weekendObservationIsValid(trip: WeekendTrip, location: WeekendLocation, offer: WeekendOffer, query: WeekendQuery, now: number, places: Place[]) {
  const checked = Date.parse(offer.checkedAt); const expiry = Date.parse(offer.expiresAt);
  const categoryMatches = offer.categoryId === null || places.some(place => place.id === location.placeId && place.categories.some(category => category.id === offer.categoryId));
  if (!matchesWeekendQuery(trip, query) || !categoryMatches || !Number.isFinite(now) || !Number.isFinite(checked) || !Number.isFinite(expiry) || checked > now || expiry <= checked) return false;
  return offer.status !== 'observed_available' || (offer.totalPriceRub !== null && Number.isFinite(offer.totalPriceRub) && offer.totalPriceRub > 0);
}
export function weekendOfferState(trip: WeekendTrip, location: WeekendLocation, offer: WeekendOffer, query: WeekendQuery, now: number, places: Place[]): 'observed_available' | 'no_offer' | 'unverified' | 'recheck' {
  if (!weekendObservationIsValid(trip, location, offer, query, now, places) || now >= Math.min(Date.parse(offer.expiresAt), Date.parse(offer.checkedAt) + 60 * 60 * 1000)) return 'recheck';
  return offer.status;
}
export function hasWeekendCoordinates(location: WeekendLocation) {
  return location.geoAccuracy !== 'unknown' && typeof location.latitude === 'number' && Number.isFinite(location.latitude) && Math.abs(location.latitude) <= 90 && typeof location.longitude === 'number' && Number.isFinite(location.longitude) && Math.abs(location.longitude) <= 180;
}
export function weekendPrice(value: number) { return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value)} ₽`; }
export function weekendChecked(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'время не указано' : `${date.toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} МСК`;
}
