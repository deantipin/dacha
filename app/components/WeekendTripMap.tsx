import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, MapPin } from 'lucide-react';
import { hasWeekendCoordinates, matchesWeekendQuery, weekendChecked, weekendObservationIsValid, weekendOfferState, weekendPrice, type WeekendLocation, type WeekendOffer, type WeekendQuery, type WeekendTrip } from '../../lib/weekend-trip';
import { Modal } from './Modal';
import { PhotoCarousel } from './PhotoGallery';
import { categoryPhotos, safeUrl, type GallerySelection, type Place } from './catalog-types';
import { PropertyMap, type MapPoint } from './PropertyMap';

const noPlaces: Place[] = [];

function Offer({ offer, location, trip, query, now, places, onGallery }: { offer: WeekendOffer; location: WeekendLocation; trip: WeekendTrip; query: WeekendQuery; now: number; places: Place[]; onGallery: (selection: GallerySelection) => void }) {
  const state = weekendOfferState(trip, location, offer, query, now, places);
  const place = places.find(item => item.id === location.placeId);
  const category = place?.categories.find(item => item.id === offer.categoryId);
  const photos = offer.photos?.length ? offer.photos.filter(photo => photo.scope !== 'category' || photo.categoryId === offer.categoryId) : place && category ? categoryPhotos(place, category) : [];
  const price = state === 'observed_available' && offer.totalPriceRub !== null ? weekendPrice(offer.totalPriceRub) : null;
  const booking = safeUrl(offer.bookingUrl); const source = safeUrl(offer.sourceUrl);
  return <article className="weekend-offer">
    {photos.length > 0 ? <PhotoCarousel photos={photos} title={`${location.name} · ${offer.categoryName}`} variant="compare" onOpen={onGallery} /> : <div className="weekend-photo-note">Фотографии этой категории смотрите на официальном сайте.</div>}
    <div className="weekend-offer-content"><h3>{offer.categoryName}</h3>
      <div className="weekend-price">{price ? <><strong>{price}</strong><span>за всё проживание · 14–15 ноября · 2 взрослых и малыш</span></> : <strong>{state === 'no_offer' ? 'Предложение не найдено при проверке' : state === 'unverified' ? 'Наличие не подтверждено' : 'Нужна перепроверка'}</strong>}</div>
      <p className="weekend-checked">{price ? 'Предложение было доступно' : 'Проверка'}: {weekendChecked(offer.checkedAt)}. {price ? 'Стоимость и наличие могут измениться.' : 'Текущая цена и наличие не подтверждены.'}</p>
      {offer.rateName && <p className="weekend-rate">Тариф: {offer.rateName}</p>}
      {offer.conditions.length > 0 && <div className="weekend-facts"><h4>Условия предложения</h4><ul>{offer.conditions.map((fact, index) => <li key={index}>{fact}</li>)}</ul></div>}
      {offer.familyFacts.length > 0 && <div className="weekend-facts"><h4>Для поездки с малышом</h4><ul>{offer.familyFacts.map((fact, index) => <li key={index}>{fact}</li>)}</ul></div>}
      {offer.unknowns.length > 0 && <div className="weekend-facts weekend-unknowns"><h4>Уточнить перед оплатой</h4><ul>{offer.unknowns.map((fact, index) => <li key={index}>{fact}</li>)}</ul></div>}
      <div className="weekend-offer-links">{booking && <a className="primary-button" href={booking} target="_blank" rel="noopener noreferrer">Проверить у объекта <ArrowUpRight size={16} /></a>}{source && <a className="text-button" href={source} target="_blank" rel="noopener noreferrer">Описание на сайте <ArrowUpRight size={14} /></a>}</div>
    </div>
  </article>;
}

export function WeekendTripMap({ trip, query, places, onGallery }: { trip: WeekendTrip; query: WeekendQuery; places: Place[]; onGallery: (selection: GallerySelection) => void }) {
  const [now, setNow] = useState(Date.now);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    let timer: number | undefined;
    const resync = () => {
      window.clearTimeout(timer);
      const current = Date.now(); setNow(current);
      const deadlines = trip.locations.flatMap(location => location.offers.map(offer => Math.min(Date.parse(offer.expiresAt), Date.parse(offer.checkedAt) + 3600000))).filter(deadline => Number.isFinite(deadline) && deadline > current);
      if (deadlines.length) timer = window.setTimeout(resync, Math.min(2147483647, Math.max(1, Math.min(...deadlines) - current)));
    };
    resync(); window.addEventListener('focus', resync); document.addEventListener('visibilitychange', resync);
    return () => { window.clearTimeout(timer); window.removeEventListener('focus', resync); document.removeEventListener('visibilitychange', resync); };
  }, [trip]);
  const matched = matchesWeekendQuery(trip, query);
  const candidates = useMemo(() => trip.locations.filter(location => location.offers.some(offer => offer.status === 'observed_available' && weekendObservationIsValid(trip, location, offer, query, now, places))), [trip, query, now, places]);
  const points = useMemo<MapPoint[]>(() => !matched ? [] : candidates.filter(hasWeekendCoordinates).map(location => {
    const prices = location.offers.filter(offer => weekendOfferState(trip, location, offer, query, now, places) === 'observed_available').flatMap(offer => offer.totalPriceRub === null ? [] : [offer.totalPriceRub]);
    return { id: location.id, name: location.name, latitude: location.latitude as number, longitude: location.longitude as number, label: prices.length ? `от ${weekendPrice(Math.min(...prices))}` : 'Перепроверить' };
  }), [trip, query, now, places, matched, candidates]);
  function openLocation(id: string) { setNow(Date.now()); setSelectedId(id); }
  const selected = matched ? trip.locations.find(location => location.id === selectedId) : undefined;
  if (!matched) return <p className="weekend-summary">Подборка относится только к 14–15 ноября, двум взрослым и ребёнку до года. Для других параметров наличие нужно проверить заново.</p>;
  const unmapped = candidates.filter(location => !hasWeekendCoordinates(location));
  const otherLocations = trip.locations.filter(location => !candidates.includes(location));
  return <>
    <div className="weekend-summary"><strong>14–15 ноября · 1 ночь · 2 взрослых и ребёнок до года</strong><p>Проверено вручную: {weekendChecked(trip.researchedAt)}. Цены — за всё проживание по указанному тарифу. Через час после проверки цена скрывается; перед оплатой подтвердите предложение у объекта.</p></div>
    <PropertyMap places={noPlaces} points={points} onSelect={openLocation} />
    <p className="map-hint">Локаций на карте: {points.length}. Здесь при проверке были предложения. Нажмите на метку для условий и фотографий. Линия соединяет ценник с местоположением. Метка может обозначать комплекс или населённый пункт; точность указана в карточке.</p>
    {unmapped.length > 0 && <div className="unmapped"><h3>Адрес уточняется — без метки на карте</h3><div>{unmapped.map(location => <button type="button" key={location.id} onClick={() => openLocation(location.id)}>{location.name} <MapPin size={14} /></button>)}</div></div>}
    {otherLocations.length > 0 && <details className="weekend-other"><summary>Другие проверенные места · {otherLocations.length}</summary><p>При проверке предложение не найдено или наличие не удалось подтвердить.</p><div>{otherLocations.map(location => <button className="outline-button" type="button" key={location.id} onClick={() => openLocation(location.id)}>{location.name}</button>)}</div></details>}
    {selected && <Modal title={selected.name} onClose={() => setSelectedId(null)} wide className="weekend-modal"><div className="weekend-location"><p><MapPin size={15} />{selected.address || 'Точный адрес уточняется'}</p><span>{hasWeekendCoordinates(selected) ? selected.geoAccuracy === 'house' ? 'Метка конкретного дома' : selected.geoAccuracy === 'settlement' ? 'Метка населённого пункта; точный адрес дома уточните у объекта' : 'Метка комплекса; расположение конкретного дома уточните у объекта' : 'Координаты не подтверждены — метка на карте не показана'}</span>{safeUrl(selected.coordinateSourceUrl) && <a href={safeUrl(selected.coordinateSourceUrl)} target="_blank" rel="noopener noreferrer">Источник расположения <ArrowUpRight size={13} /></a>}</div><div className="weekend-offers">{selected.offers.map(offer => <Offer key={offer.id} offer={offer} location={selected} trip={trip} query={query} now={now} places={places} onGallery={onGallery} />)}</div></Modal>}
  </>;
}
