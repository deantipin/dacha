/** User-clicked links only. This module never requests a booking provider. */
export type BookingQuery = {
  checkIn: string;
  checkOut: string;
  adults: number;
  childrenAges: readonly number[];
};
export type BookingHandoff = { url: string | undefined; datesTransferred: boolean; categoryTransferred: boolean };
type Input = { placeId: string; categoryId?: string | null; officialUrl?: string | null; query?: BookingQuery | null };
const TL_CATEGORIES: Record<string, string> = { H01: '350424', H06: '349164', H07: '349390' };
const BN_CATEGORIES: Record<string, string> = { 'S-N01-1': '448468,660025,660026', 'S-N01-2': '414182,660555,660556' };
function day(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? parsed : null;
}
function valid(query: BookingQuery | null | undefined) {
  if (!query || !day(query.checkIn) || !day(query.checkOut)) return false;
  return query.checkOut > query.checkIn && Number.isInteger(query.adults) && query.adults >= 1 && query.adults <= 32 &&
    Array.isArray(query.childrenAges) && query.childrenAges.length <= 16 && query.childrenAges.every(age => Number.isInteger(age) && age >= 0 && age <= 17);
}
function fallback(value: string | null | undefined) {
  if (typeof value !== 'string') return undefined;
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? value : undefined; } catch { return undefined; }
}
export function buildBookingHandoff({ placeId, categoryId, officialUrl, query }: Input): BookingHandoff {
  const unchanged = { url: fallback(officialUrl), datesTransferred: false, categoryTransferred: false };
  if (!valid(query) || !query) return unchanged;
  if (placeId === 'ambient-park') {
    const url = new URL('https://rs-ambient.ru/booking/');
    const nights = Math.round(((day(query.checkOut) as Date).getTime() - (day(query.checkIn) as Date).getTime()) / 86_400_000);
    url.searchParams.set('date', query.checkIn); url.searchParams.set('nights', String(nights)); url.searchParams.set('adults', String(query.adults));
    url.searchParams.set('children', String(query.childrenAges.length));
    if (query.childrenAges.length) url.searchParams.set('children-age', query.childrenAges.join(','));
    const mapped = categoryId && Object.hasOwn(TL_CATEGORIES, categoryId) ? TL_CATEGORIES[categoryId] : undefined;
    if (mapped) url.searchParams.set('room-type', mapped);
    return { url: url.href, datesTransferred: true, categoryTransferred: !!mapped };
  }
  if (placeId === 'domingo-dacha') {
    const formatDate = (value: string) => value.split('-').reverse().join('-');
    const url = new URL('https://domingodacha.ru/booking/');
    url.searchParams.set('uid', 'a824ff30-0186-4dd5-b4e7-39b196d8e7d3');
    url.searchParams.set('dfrom', formatDate(query.checkIn)); url.searchParams.set('dto', formatDate(query.checkOut)); url.searchParams.set('adults', String(query.adults));
    url.searchParams.set('children', JSON.stringify(query.childrenAges));
    const mapped = categoryId && Object.hasOwn(BN_CATEGORIES, categoryId) ? BN_CATEGORIES[categoryId] : undefined;
    if (mapped) url.searchParams.set('onlyrooms', mapped);
    return { url: url.href, datesTransferred: true, categoryTransferred: !!mapped };
  }
  return unchanged;
}
