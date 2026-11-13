import snapshot from '../data/public-catalog.json';
import type { Place } from '../app/components/catalog-types';

export type PublicCatalog = {
  places: Place[];
  coverage: { totalPlaces: number; publishedPlaces: number; pendingPlaces: number; liveSources: number };
  catalogUpdatedOn: string;
  sourceUpdatedAt?: string;
};
type SearchQuery = {
  checkIn: string; checkOut: string; adults: number; childrenAges: number[];
  minBedrooms: string; minArea: string; region: string;
};
const catalog = snapshot as PublicCatalog;

// GitHub Pages has no API: both catalogue loading and filtering stay in this browser.
export async function loadPublicCatalog(): Promise<PublicCatalog> {
  return catalog;
}

export async function searchPublicCatalog(query: SearchQuery, signal?: AbortSignal): Promise<PublicCatalog> {
  signal?.throwIfAborted();
  const places = catalog.places
    .filter(place => !query.region || place.region === query.region || place.city === query.region)
    .map(place => {
      const categories = place.categories.filter(category =>
        (!query.minBedrooms || (category.bedrooms !== null && category.bedrooms >= Number(query.minBedrooms))) &&
        (!query.minArea || (category.areaM2 !== null && category.areaM2 >= Number(query.minArea))));
      const categoryIds = new Set(categories.map(category => category.id));
      return { ...place, categories, photos: (place.photos || []).filter(photo => photo.categoryId === null || categoryIds.has(photo.categoryId)) };
    })
    .filter(place => place.categories.length > 0);
  return { ...catalog, places };
}
