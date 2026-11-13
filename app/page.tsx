'use client';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, ChevronDown, Columns3, Heart, House, MapPin, Minus, Plus, Search, SlidersHorizontal, Trees, X } from 'lucide-react';
import { PhotoCarousel, PhotoLightbox } from './components/PhotoGallery';
import { PropertyCard } from './components/PropertyCard';
import { PropertyDetail } from './components/PropertyDetail';
import { ComparisonView } from './components/ComparisonView';
import { categoryPhotos, type Category, type Place, type GallerySelection } from './components/catalog-types';
export type { Place } from './components/catalog-types';
import { Modal } from './components/Modal';
import { PropertyMap } from './components/PropertyMap';
import { loadPublicCatalog, searchPublicCatalog } from '../lib/catalog-client';

type Catalog = { places: Place[]; coverage: { totalPlaces: number; publishedPlaces: number; pendingPlaces: number; liveSources: number }; catalogUpdatedOn: string; sourceUpdatedAt?: string };
type Query = { checkIn: string; checkOut: string; adults: number; childrenAges: number[]; minBedrooms: string; minArea: string; region: string };
const blankQuery: Query = { checkIn: '', checkOut: '', adults: 2, childrenAges: [], minBedrooms: '', minArea: '', region: '' };
function readQuery(): Query {
  const p = new URLSearchParams(window.location.search);
  const ages = (p.get('children') || '').split(',').filter(Boolean).map(Number).filter(n => Number.isInteger(n) && n >= 0 && n <= 17).slice(0, 6);
  return { checkIn: p.get('in') || '', checkOut: p.get('out') || '', adults: Math.min(12, Math.max(1, Number(p.get('adults')) || 2)), childrenAges: ages, minBedrooms: p.get('bedrooms') || '', minArea: p.get('area') || '', region: p.get('region') || '' };
}
function dayText(value: string) { if (!value) return ''; return new Date(`${value}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }); }
function guestText(q: Query) { return `${q.adults} ${q.adults === 1 ? 'взрослый' : q.adults < 5 ? 'взрослых' : 'взрослых'}${q.childrenAges.length ? `, детей: ${q.childrenAges.length}` : ''}`; }
function dateToday() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function formatChecked(value: string | null) { if (!value) return 'Дата уточняется'; const d = new Date(value); return Number.isNaN(d.getTime()) ? 'Дата уточняется' : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }); }
function queryError(q: Query) { if (!!q.checkIn !== !!q.checkOut) return 'Укажите обе даты: заезд и выезд.'; if (q.checkIn && q.checkIn < dateToday()) return 'Выберите дату заезда сегодня или позже.'; if (q.checkIn && q.checkOut <= q.checkIn) return 'Дата выезда должна быть позже даты заезда.'; return ''; }

export default function Home() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [searchResult, setSearchResult] = useState<Catalog | null>(null);
  const [query, setQuery] = useState<Query>(blankQuery);
  const [applied, setApplied] = useState<Query>(blankQuery);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [modal, setModal] = useState<'guests' | 'filters' | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'map' | 'compare'>('list');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [compared, setCompared] = useState<string[]>([]);
  const [comparisonMessage, setComparisonMessage] = useState('');
  const [gallery, setGallery] = useState<GallerySelection | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [copied, setCopied] = useState(false);
  const [ready, setReady] = useState(false);
  const [today, setToday] = useState('');
  const resultsRef = useRef<HTMLElement>(null);
  const savedScroll = useRef(0);
  const requestId = useRef(0);
  const searchInFlight = useRef(false);
  const searchAbort = useRef<AbortController | null>(null);
  const loadCatalog = useCallback(async () => { setLoading(true); setError(''); try { const data: Catalog = await loadPublicCatalog(); if (!Array.isArray(data.places)) throw new Error('catalog'); setCatalog(data); } catch { setError('Не получилось загрузить подборку. Попробуйте ещё раз.'); } finally { setLoading(false); } }, []);
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
    if (cancelled) return;
    setToday(dateToday());
    const initial = readQuery(); clearSearch(); setQuery(initial); setApplied(initial);
    const p = new URLSearchParams(window.location.search); setView(p.get('view') === 'map' ? 'map' : p.get('view') === 'compare' ? 'compare' : 'list'); setSelected(p.get('place')); setSelectedCategoryId(p.get('category')); setOnlyFavorites(p.get('saved') === '1');
    try { const stored = JSON.parse(localStorage.getItem('dacha-favorites') || '[]'); if (Array.isArray(stored)) setFavorites(stored.filter(v => typeof v === 'string')); } catch { /* Storage can be unavailable in private browsing. */ }
    try { const stored = JSON.parse(localStorage.getItem('dacha-comparison') || '[]'); if (Array.isArray(stored)) setCompared([...new Set(stored.filter(v => typeof v === 'string'))].slice(0, 3)); } catch { /* Comparison still works during this visit. */ }
    setReady(true); void loadCatalog();
    });
    const restore = () => { const q = readQuery(); clearSearch(); setQuery(q); setApplied(q); const params = new URLSearchParams(window.location.search); setView(params.get('view') === 'map' ? 'map' : params.get('view') === 'compare' ? 'compare' : 'list'); setSelected(params.get('place')); setSelectedCategoryId(params.get('category')); setOnlyFavorites(params.get('saved') === '1');  };
    window.addEventListener('popstate', restore); return () => { cancelled = true; requestId.current += 1; searchAbort.current?.abort(); searchInFlight.current = false; window.removeEventListener('popstate', restore); };
  }, [loadCatalog]);
  useEffect(() => {
    if (!ready) return;
    const p = new URLSearchParams(); if (applied.checkIn) p.set('in', applied.checkIn); if (applied.checkOut) p.set('out', applied.checkOut); if (applied.adults !== 2) p.set('adults', String(applied.adults)); if (applied.childrenAges.length) p.set('children', applied.childrenAges.join(',')); if (applied.minBedrooms) p.set('bedrooms', applied.minBedrooms); if (applied.minArea) p.set('area', applied.minArea); if (applied.region) p.set('region', applied.region); if (view !== 'list') p.set('view', view); if (selected) p.set('place', selected); if (selected && selectedCategoryId) p.set('category', selectedCategoryId); if (onlyFavorites) p.set('saved', '1');
    const qs = p.toString(); window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
  }, [applied, view, selected, selectedCategoryId, onlyFavorites, ready]);
  const filtered = useMemo(() => (searchResult?.places || catalog?.places || []).map(p => ({ ...p, categories: p.categories.filter(c => (!applied.minBedrooms || (c.bedrooms !== null && c.bedrooms >= Number(applied.minBedrooms))) && (!applied.minArea || (c.areaM2 !== null && c.areaM2 >= Number(applied.minArea)))) })).filter(p => p.categories.length > 0 && (!onlyFavorites || favorites.includes(p.id)) && (!applied.region || p.region === applied.region)), [catalog, searchResult, applied, favorites, onlyFavorites]);
  const regions = useMemo(() => [...new Set((catalog?.places || []).map(p => p.region).filter((s): s is string => !!s))].sort(), [catalog]);
  const selectedPlace = filtered.find(p => p.id === selected && (!selectedCategoryId || p.categories.some(c => c.id === selectedCategoryId))) || catalog?.places.find(p => p.id === selected);
  const comparisonItems = useMemo(() => compared.flatMap(id => { for (const place of catalog?.places || []) { const category = place.categories.find(c => c.id === id); if (category) return [{ place, category }]; } return []; }), [catalog, compared]);
  const heroPlace = catalog?.places.find(p => p.id === 'pine-river');
  const heroCategory = heroPlace?.categories.find(c => c.photos?.length) || heroPlace?.categories[0];
  const heroReference = heroPlace?.photos?.filter(photo => photo.scope !== 'category' && /Кедр.*кухня|кухня.*Кедр/i.test(photo.caption || photo.alt));
  const heroPhotos = heroReference?.length ? heroReference : heroPlace && heroCategory ? categoryPhotos(heroPlace, heroCategory) : [];
  const hasDates = !!applied.checkIn && !!applied.checkOut;
  const filterCount = [applied.region, applied.minBedrooms, applied.minArea].filter(Boolean).length;
  const toggleFavorite = (id: string) => { setFavorites(current => { const next = current.includes(id) ? current.filter(item => item !== id) : [...current, id]; try { localStorage.setItem('dacha-favorites', JSON.stringify(next)); } catch { /* Favorites still work during this visit. */ } return next; }); };
  function clearSearch() {
    requestId.current += 1;
    searchAbort.current?.abort(); searchAbort.current = null; searchInFlight.current = false;
    setSearching(false); setSearchResult(null); setFormError('');
  }
  function resetSearch() {
    clearSearch();
    setQuery(blankQuery); setApplied(blankQuery); setOnlyFavorites(false);
  }
  async function runSearch(next: Query, scroll = true) {
    if (searchInFlight.current) return;
    const validation = queryError(next); setFormError(validation); if (validation) return;
    const id = ++requestId.current;
    const controller = new AbortController(); searchAbort.current = controller; searchInFlight.current = true;
    setSearching(true); setFormError(''); setApplied({ ...next }); setSearchResult(null); setCopied(false);
    try {
      if (next.checkIn && next.checkOut) {
        const result: Catalog = await searchPublicCatalog(next, controller.signal);
        if (id !== requestId.current) return;
        setSearchResult(result);
      }
      if (id !== requestId.current) return;
      if (scroll) requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } catch {
      if (id === requestId.current && !controller.signal.aborted) setFormError('Не удалось обновить подборку. Параметры сохранены — проверить даты можно на сайте объекта.');
    } finally {
      if (id === requestId.current) { searchInFlight.current = false; searchAbort.current = null; setSearching(false); }
    }
  }
  function submit(e: FormEvent) { e.preventDefault(); void runSearch(query); }
  function changeView(next: 'list' | 'map' | 'compare') { if (view === 'list') savedScroll.current = window.scrollY; setView(next); requestAnimationFrame(() => { if (next === 'list') window.scrollTo({ top: savedScroll.current, behavior: 'instant' }); else window.scrollTo({ top: 0, behavior: 'instant' }); }); }
  function resetHome() {
    resetSearch();
    setSelected(null); setSelectedCategoryId(null); setModal(null); setView('list'); setCopied(false); setGallery(null); setComparisonMessage('');
    window.history.replaceState(null, '', window.location.pathname);
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  }
  const openPlace = (id: string, categoryId?: string) => { setCopied(false); setSelectedCategoryId(categoryId || null); setSelected(id); };
  function updateComparison(ids: string[]) { setCompared(ids); setComparisonMessage(''); try { localStorage.setItem('dacha-comparison', JSON.stringify(ids)); } catch { /* Selection remains available during this visit. */ } }
  function toggleComparison(category: Category) { if (compared.includes(category.id)) updateComparison(compared.filter(id => id !== category.id)); else if (compared.length < 3) updateComparison([...compared, category.id]); else setComparisonMessage('В сравнении уже 3 варианта. Уберите один, чтобы добавить другой.'); }
  async function copyQuery() { try { await navigator.clipboard.writeText(hasDates ? `Заезд ${dayText(applied.checkIn)}, выезд ${dayText(applied.checkOut)}. ${guestText(applied)}${applied.childrenAges.length ? `. Возраст детей: ${applied.childrenAges.join(', ')}` : ''}.` : `Гости: ${guestText(applied)}.`); setCopied(true); } catch { setCopied(false); } }
  return <div className="app-shell">
    <header className="site-header"><a className="brand" href={import.meta.env.BASE_URL} aria-label="Дача — на главную" onClick={e => { e.preventDefault(); resetHome(); }}><span className="brand-mark"><House size={23} strokeWidth={1.8} /></span>дача<span className="brand-dot">.</span></a><nav aria-label="Главная навигация"><button type="button" className={`nav-button ${view === 'list' && !onlyFavorites ? 'active' : ''}`} onClick={() => { setOnlyFavorites(false); changeView('list'); }}>Каталог</button><button type="button" className={`nav-button ${view === 'compare' ? 'active' : ''}`} onClick={() => changeView('compare')}><Columns3 size={16} /><span>Сравнение</span>{comparisonItems.length > 0 && <b>{comparisonItems.length}</b>}</button><button type="button" className={`nav-button saved-button ${onlyFavorites && view !== 'compare' ? 'active' : ''}`} onClick={() => { setOnlyFavorites(v => !v); changeView('list'); }} aria-pressed={onlyFavorites}><Heart size={17} fill={onlyFavorites ? 'currentColor' : 'none'} /><span>Избранное</span>{favorites.length > 0 && <b>{favorites.length}</b>}</button></nav></header>
    {view === 'list' ? <>
      <section className="hero"><div className="hero-copy"><div className="eyebrow">ДОМА ДЛЯ ВЫХОДНЫХ НЕДАЛЕКО ОТ МОСКВЫ</div><h1>Найдите место,<br />в котором <span>хочется остаться.</span></h1><p>Настоящие фотографии. Понятные планировки.<br />Сравните дома и спланируйте свои выходные.</p><div className="hero-meta"><span>{catalog?.coverage.publishedPlaces ?? 23} места в подборке</span><span>Бронирование напрямую</span></div></div><div className="hero-photo"><PhotoCarousel photos={heroPhotos} title="Pine River" variant="compare" onOpen={setGallery} /><span className="hero-photo-label">Pine River <span>· Загородная жизнь</span></span></div></section>
      <section className="search-section" aria-label="Подобрать загородный дом"><form className="search-bar" onSubmit={submit}><label className="date-field"><span>ЗАЕЗД</span><input aria-label="Дата заезда" type="date" min={today || undefined} value={query.checkIn} onChange={e => setQuery(q => ({ ...q, checkIn: e.target.value, checkOut: q.checkOut && q.checkOut <= e.target.value ? '' : q.checkOut }))} /></label><label className="date-field"><span>ВЫЕЗД</span><input aria-label="Дата выезда" type="date" min={query.checkIn || today || undefined} value={query.checkOut} onChange={e => setQuery(q => ({ ...q, checkOut: e.target.value }))} /></label><button type="button" className="guests-field" onClick={() => setModal('guests')} aria-haspopup="dialog"><span>ГОСТИ</span><strong>{guestText(query)}</strong><ChevronDown size={17} /></button><button type="submit" className="search-button" disabled={searching || loading}><Search size={19} />{searching ? 'Подбираем…' : 'Найти дом'}</button></form><div className="search-bottom"><span>Выберите даты, чтобы перейти к проверке у объекта.</span><button type="button" className="text-button" onClick={() => setModal('filters')}><SlidersHorizontal size={15} /> Пожелания к дому {filterCount > 0 && <b className="small-count">{filterCount}</b>}</button></div>{formError && <p className="form-error" role="alert">{formError}</p>}</section>
      <section className="results-section" id="houses" ref={resultsRef}><div className="results-heading"><div><div className="eyebrow">ВАШИ БЛИЖАЙШИЕ ВЫХОДНЫЕ</div><h2>{onlyFavorites ? 'Сохранённые места' : hasDates ? 'Варианты для проверки' : 'Загородные дома и места'}<span className="result-count">{loading ? '…' : filtered.length}</span></h2></div><div className="view-switch" aria-label="Вид результатов"><button type="button" className="active" aria-pressed="true"><span className="grid-icon">▦</span> Список</button><button type="button" onClick={() => changeView('map')} aria-pressed="false"><MapPin size={16} /> Карта</button></div></div>
        {(hasDates || filterCount > 0 || onlyFavorites) && <div className="active-filters">{hasDates && <span>{dayText(applied.checkIn)} — {dayText(applied.checkOut)} · {guestText(applied)}</span>}{applied.region && <span>{applied.region}</span>}{applied.minBedrooms && <span>От {applied.minBedrooms} спален</span>}{applied.minArea && <span>От {applied.minArea} м²</span>}{onlyFavorites && <span>В избранном</span>}<button type="button" onClick={resetSearch}>Сбросить <X size={13} /></button></div>}
        <div className="availability-note"><span className="status-dot" /><p>{hasDates ? 'Даты и гости — параметры поездки. Автоматическая проверка цен пока не подключена; наличие и стоимость уточняйте на сайте объекта.' : 'Выбирайте дом по настроению. Наличие и стоимость уточняются на официальном сайте.'} <span>Бронирование и оплата — напрямую у объекта.</span></p></div>
        {loading && !catalog ? <div className="card-grid" aria-label="Загрузка домов">{[0,1,2,3,4,5].map(n => <div className="skeleton-card" key={n}><div /><span /><span /></div>)}</div> : error && !catalog ? <div className="empty-state" role="alert"><Trees size={38} /><h3>Подборка задержалась в пути</h3><p>{error}</p><button type="button" className="primary-button" onClick={() => void loadCatalog()}>Попробовать снова</button></div> : filtered.length === 0 ? <div className="empty-state"><Heart size={36} /><h3>{onlyFavorites ? 'Здесь будут ваши любимые дома' : 'Под эти пожелания домов пока нет'}</h3><p>{onlyFavorites ? 'Нажмите на сердечко в карточке — место останется под рукой.' : 'Попробуйте уменьшить площадь, число спален или выбрать другой регион.'}</p><button type="button" className="primary-button" onClick={resetSearch}>Посмотреть все дома</button></div> : <div className="card-grid">{filtered.map(place => <PropertyCard key={place.id} place={place} bookingQuery={applied} favorite={favorites.includes(place.id)} compared={compared} onFavorite={() => toggleFavorite(place.id)} onOpen={categoryId => openPlace(place.id, categoryId)} onGallery={setGallery} onCompare={toggleComparison} />)}</div>}
      </section>
    </> : view === 'compare' ? <ComparisonView items={comparisonItems} bookingQuery={applied} onRemove={id => updateComparison(compared.filter(value => value !== id))} onClear={() => updateComparison([])} onBack={() => changeView('list')} onGallery={setGallery} onDetails={openPlace} /> : <section className="map-page"><div className="map-heading"><div><button type="button" className="back-button" onClick={() => changeView('list')}><ArrowLeft size={17} /> К списку домов</button><h1>Ближе к природе<span className="result-count">{filtered.length}</span></h1><p>{hasDates ? `${dayText(applied.checkIn)} — ${dayText(applied.checkOut)} · ${guestText(applied)}` : 'Посмотрите, куда хочется отправиться.'}</p></div><button type="button" className="outline-button" onClick={() => setModal('filters')}><SlidersHorizontal size={16} /> Пожелания {filterCount > 0 && `(${filterCount})`}</button></div><PropertyMap places={filtered} onSelect={openPlace} /><p className="map-hint">Отмечено мест: {filtered.filter(p => p.latitude !== null && p.longitude !== null).length} из {filtered.length}. Метка показывает расположение комплекса; точный адрес дома уточняйте у объекта.</p>{filtered.some(p => p.latitude === null || p.longitude === null) && <div className="unmapped"><h3>Адрес ещё уточняется</h3><div>{filtered.filter(p => p.latitude === null || p.longitude === null).map(p => <button type="button" key={p.id} onClick={() => openPlace(p.id)}>{p.name} <ArrowRight size={14} /></button>)}</div></div>}</section>}
    <footer className="site-footer"><div><a className="brand" href={import.meta.env.BASE_URL} onClick={e => { e.preventDefault(); resetHome(); }}>дача<span className="brand-dot">.</span></a><p>Хорошим выходным нужно хорошее место.</p></div><div className="footer-meta"><p>{catalog?.coverage.publishedPlaces ?? 23} места в подборке · {catalog?.coverage.pendingPlaces ?? 4} уточняем</p><p>Каталог: {formatChecked(catalog?.catalogUpdatedOn || null)}</p><span>Фотографии с официальных сайтов объектов. Источник — в галерее.</span></div><span className="footer-year">© {new Date().getFullYear()} Дача</span></footer>
    {modal === 'guests' && <Modal title="Кто едет отдыхать?" onClose={() => setModal(null)}><div className="guest-content"><div className="counter-row"><div><strong>Взрослые</strong><span>От 18 лет</span></div><div className="counter"><button type="button" aria-label="Уменьшить число взрослых" disabled={query.adults <= 1} onClick={() => setQuery(q => ({ ...q, adults: q.adults - 1 }))}><Minus size={17} /></button><b aria-live="polite">{query.adults}</b><button type="button" aria-label="Увеличить число взрослых" disabled={query.adults >= 12} onClick={() => setQuery(q => ({ ...q, adults: q.adults + 1 }))}><Plus size={17} /></button></div></div><div className="children-heading"><strong>Дети</strong><span>Возраст на момент заезда</span></div>{query.childrenAges.map((age, index) => <div className="child-row" key={index}><label htmlFor={`child-${index}`}>Ребёнок {index + 1}</label><select id={`child-${index}`} value={age} onChange={e => setQuery(q => ({ ...q, childrenAges: q.childrenAges.map((a, i) => i === index ? Number(e.target.value) : a) }))}>{Array.from({ length: 18 }, (_, n) => <option key={n} value={n}>{n === 0 ? 'До 1 года' : `${n} ${n === 1 ? 'год' : n < 5 ? 'года' : 'лет'}`}</option>)}</select><button type="button" className="icon-button" aria-label={`Убрать ребёнка ${index + 1}`} onClick={() => setQuery(q => ({ ...q, childrenAges: q.childrenAges.filter((_, i) => i !== index) }))}><X size={17} /></button></div>)}{query.childrenAges.length < 6 && <button type="button" className="add-child" onClick={() => setQuery(q => ({ ...q, childrenAges: [...q.childrenAges, 0] }))}><Plus size={17} /> Добавить ребёнка</button>}<p className="field-note">Вместимость и правила размещения детей нужно подтвердить у выбранного объекта.</p><button type="button" className="primary-button full-width" onClick={() => setModal(null)}>Готово · {guestText(query)}</button></div></Modal>}
    {modal === 'filters' && <Modal title="Что важно для вашего дома?" onClose={() => setModal(null)}><div className="filter-content"><p className="modal-intro">Только самое важное. Остальное можно узнать, когда дом уже понравился.</p><label className="filter-field">Регион<select value={query.region} onChange={e => setQuery(q => ({ ...q, region: e.target.value }))}><option value="">Любой регион</option>{regions.map(r => <option key={r} value={r}>{r}</option>)}</select></label><div className="filter-pair"><label className="filter-field">Отдельные спальни<select value={query.minBedrooms} onChange={e => setQuery(q => ({ ...q, minBedrooms: e.target.value }))}><option value="">Неважно</option><option value="1">От 1 спальни</option><option value="2">От 2 спален</option><option value="3">От 3 спален</option><option value="4">От 4 спален</option></select></label><label className="filter-field">Площадь дома<select value={query.minArea} onChange={e => setQuery(q => ({ ...q, minArea: e.target.value }))}><option value="">Неважно</option><option value="40">От 40 м²</option><option value="60">От 60 м²</option><option value="80">От 80 м²</option><option value="100">От 100 м²</option></select></label></div><p className="field-note">При выборе пожеланий показываем дома, у которых эти данные подтверждены в описании.</p><div className="modal-actions"><button type="button" className="text-button" onClick={() => { clearSearch(); setQuery(q => ({ ...q, region: '', minBedrooms: '', minArea: '' })); }}>Сбросить</button><button type="button" className="primary-button" disabled={searching} onClick={() => { const validation = queryError(query); if (validation) { clearSearch(); setFormError(validation); setModal(null); return; } setModal(null); void runSearch(query, view === 'list'); }}>Показать дома <ArrowRight size={17} /></button></div></div></Modal>}
    {selectedPlace && <PropertyDetail key={selectedPlace.id} place={selectedPlace} bookingQuery={applied} initialCategoryId={selectedCategoryId} favorite={favorites.includes(selectedPlace.id)} compared={compared} dateSummary={hasDates ? `${dayText(applied.checkIn)} — ${dayText(applied.checkOut)} · ${guestText(applied)}` : ''} catalogDate={formatChecked(catalog?.catalogUpdatedOn || null)} onClose={() => { setSelected(null); setSelectedCategoryId(null); }} onFavorite={() => toggleFavorite(selectedPlace.id)} onCompare={toggleComparison} onGallery={setGallery} onCopy={() => void copyQuery()} copied={copied} comparisonMessage={comparisonMessage} onGoCompare={() => { setSelected(null); setSelectedCategoryId(null); changeView('compare'); }} />}
    {gallery && <PhotoLightbox selection={gallery} onClose={() => setGallery(null)} />}
    {comparisonItems.length > 0 && view !== 'compare' && <aside className="compare-tray" aria-label="Выбранные варианты для сравнения"><div><Columns3 size={20} /><span>В сравнении <b>{comparisonItems.length} из 3</b></span><div className="compare-preview">{comparisonItems.map(item => <span key={item.category.id} title={`${item.place.name} · ${item.category.name}`}>{item.place.name}<button type="button" aria-label={`Убрать ${item.place.name}, ${item.category.name} из сравнения`} onClick={() => updateComparison(compared.filter(id => id !== item.category.id))}><X size={12} /></button></span>)}</div></div><button type="button" className="primary-button" onClick={() => { setSelected(null); setSelectedCategoryId(null); setGallery(null); changeView('compare'); }}>Сравнить <ArrowRight size={16} /></button></aside>}
    {comparisonMessage && <div className="comparison-toast" role="status"><span>{comparisonMessage}</span><button type="button" aria-label="Закрыть сообщение" onClick={() => setComparisonMessage('')}><X size={16} /></button></div>}

  </div>;
}
