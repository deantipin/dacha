export type Photo = {
  id: string; src: string; alt: string; caption: string; categoryId: string | null;
  scope: 'category' | 'territory' | 'property'; sourceUrl: string; credit: string;
};
export type Category = { id: string; name: string; areaM2: number | null; bedrooms: number | null; bathrooms: number | null; floors: number | null; officialUrl: string | null; format: string | null; photos?: Photo[] };
export type Place = { id: string; name: string; city: string | null; region: string | null; address: string | null; officialUrl: string | null; bookingUrl: string | null; latitude: number | null; longitude: number | null; categories: Category[]; sourceStatus: string; sourceCheckedAt: string | null; photos?: Photo[] };
export type Comparison = { place: Place; category: Category };
export type GallerySelection = { photos: Photo[]; index: number; title: string };
export function categoryName(category: Category) { return category.name === 'Категория не выбрана' ? 'Категория уточняется' : category.name; }
export function categoryPhotos(place: Place, category: Category): Photo[] {
  const exact = (category.photos || []).filter(p => p.scope === 'category' && p.categoryId === category.id);
  const general = (place.photos || []).filter(p => p.scope !== 'category');
  return [...exact, ...general].filter((photo, index, list) => list.findIndex(p => p.id === photo.id) === index);
}
export function safeUrl(url?: string | null) { if (!url) return undefined; try { const u = new URL(url); return ['https:', 'http:'].includes(u.protocol) ? u.href : undefined; } catch { return undefined; } }
