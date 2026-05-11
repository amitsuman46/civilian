import { useCallback, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'civilian_weather_cities_v1';

/** @typedef {{ id: string; label: string; lat: number; lng: number; isGps?: boolean }} WeatherCity */

function loadCities() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      c => c && typeof c.lat === 'number' && typeof c.lng === 'number' && c.label && c.id
    );
  } catch {
    return [];
  }
}

/** @param {WeatherCity[]} cities */
function saveCities(cities) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cities));
  } catch { /* quota */ }
}

function wmoIcon(code) {
  const c = Number(code);
  if (c === 0) return 'fa-sun';
  if (c <= 3) return 'fa-cloud-sun';
  if (c <= 48) return 'fa-smog';
  if (c <= 57) return 'fa-cloud-rain';
  if (c <= 67) return 'fa-cloud-showers-heavy';
  if (c <= 77) return 'fa-snowflake';
  if (c <= 82) return 'fa-cloud-bolt';
  if (c <= 86) return 'fa-snowflake';
  if (c <= 99) return 'fa-bolt';
  return 'fa-cloud';
}

function wmoLabel(code) {
  const labels = {
    0: 'Clear', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
    45: 'Fog', 48: 'Fog', 51: 'Drizzle', 53: 'Drizzle', 55: 'Drizzle',
    61: 'Rain', 63: 'Rain', 65: 'Heavy rain', 71: 'Snow', 73: 'Snow', 75: 'Snow',
    77: 'Snow grains', 80: 'Rain showers', 81: 'Rain showers', 82: 'Violent showers',
    85: 'Snow showers', 86: 'Snow showers', 95: 'Thunderstorm', 96: 'Thunderstorm', 99: 'Thunderstorm',
  };
  return labels[Number(code)] || 'Weather';
}

/**
 * @param {number} lat
 * @param {number} lng
 */
async function reverseLabel(lat, lng) {
  // Open-Meteo geocoding currently doesn't support reverse lookups (it returns 404),
  // so we use OpenStreetMap/Nominatim (no API key required).
  const u = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=12&addressdetails=1`;
  const res = await fetch(u, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('Reverse geocode failed');

  const data = await res.json();
  const a = data.address || {};

  const city =
    a.city ||
    a.town ||
    a.village ||
    a.hamlet ||
    a.municipality ||
    '';
  const state = a.state || '';
  const country = a.country || '';
  const suburb = a.suburb || a.neighbourhood || a.county || '';

  const parts = [suburb, city, state, country].filter(Boolean);
  if (parts.length) return parts.join(', ');

  return data.display_name || `Location (${lat.toFixed(2)}, ${lng.toFixed(2)})`;
}

/**
 * @param {string} q
 */
async function searchPlaces(q) {
  const u = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q.trim())}&count=8&language=en&format=json`;
  const res = await fetch(u);
  if (!res.ok) throw new Error('Search failed');
  const data = await res.json();
  return data.results || [];
}

/**
 * @param {number} lat
 * @param {number} lng
 */
async function fetchForecast(lat, lng) {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    current: [
      'temperature_2m',
      'relative_humidity_2m',
      'apparent_temperature',
      'weather_code',
      'wind_speed_10m',
      'wind_direction_10m',
      'is_day',
    ].join(','),
    hourly: ['temperature_2m', 'weather_code', 'precipitation_probability'].join(','),
    daily: ['weather_code', 'temperature_2m_max', 'temperature_2m_min', 'precipitation_probability_mean'].join(','),
    timezone: 'auto',
    forecast_days: '7',
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!res.ok) throw new Error('Weather data unavailable');
  const data = await res.json();
  const h = data.hourly;
  const now = Date.now();
  const times = h?.time || [];
  let start = times.findIndex(t => new Date(t).getTime() >= now - 45 * 60 * 1000);
  if (start < 0) start = 0;
  const hourly24 = [];
  for (let i = start; i < start + 24 && i < times.length; i++) {
    hourly24.push({
      time: h.time[i],
      temp: h.temperature_2m[i],
      code: h.weather_code[i],
      pop: h.precipitation_probability[i],
    });
  }
  const d = data.daily;
  const daily7 = [];
  const dn = Math.min(7, d?.time?.length || 0);
  for (let i = 0; i < dn; i++) {
    daily7.push({
      date: d.time[i],
      max: d.temperature_2m_max[i],
      min: d.temperature_2m_min[i],
      code: d.weather_code[i],
      pop: d.precipitation_probability_mean?.[i],
    });
  }
  return {
    current: data.current,
    hourly24,
    daily7,
    utcOffsetSeconds: data.utc_offset_seconds ?? 0,
  };
}

function formatHour(iso) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function formatDay(iso) {
  return new Date(iso + 'T12:00:00').toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

const GPS_ID = '__gps__';

export default function Weather() {
  /** @type {[WeatherCity[], React.Dispatch<React.SetStateAction<WeatherCity[]>>]} */
  const [cities, setCities] = useState(() => loadCities());
  const [activeId, setActiveId] = useState(() => {
    const list = loadCities();
    return list[0]?.id ?? null;
  });
  const [bundle, setBundle] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [geoStatus, setGeoStatus] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const [searchHits, setSearchHits] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    saveCities(cities);
  }, [cities]);

  useEffect(() => {
    if (activeId && !cities.find(c => c.id === activeId)) {
      setActiveId(cities[0]?.id ?? null);
    }
  }, [cities, activeId]);

  const activeCity = useMemo(() => cities.find(c => c.id === activeId) ?? null, [cities, activeId]);

  const loadWeather = useCallback(async (city) => {
    if (!city) {
      setBundle(null);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await fetchForecast(city.lat, city.lng);
      setBundle(data);
    } catch (e) {
      setError(e.message || 'Could not load weather.');
      setBundle(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeCity) loadWeather(activeCity);
    else {
      setBundle(null);
    }
  }, [activeCity, loadWeather]);

  const requestGpsCity = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoStatus('Geolocation is not supported in this browser.');
      return;
    }
    setGeoStatus('Locating…');
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude, longitude } = pos.coords;
        let label = `Location (${latitude.toFixed(2)}, ${longitude.toFixed(2)})`;
        try {
          label = await reverseLabel(latitude, longitude);
        } catch { /* keep lat/lng fallback */ }
        const gpsCity = { id: GPS_ID, label, lat: latitude, lng: longitude, isGps: true };
        setCities(prev => {
          const rest = prev.filter(c => c.id !== GPS_ID);
          return [gpsCity, ...rest];
        });
        setActiveId(GPS_ID);
        setGeoStatus('');
      },
      err => {
        setGeoStatus(
          err.code === 1
            ? 'Location permission denied. Add a city manually or enable location in browser settings.'
            : 'Could not read GPS location. Try again or add a city.'
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 600000 }
    );
  }, []);

  useEffect(() => {
    if (cities.length === 0) requestGpsCity();
  }, [cities.length, requestGpsCity]);

  const refreshGps = () => requestGpsCity();

  const addFromSearch = r => {
    const label = [r.name, r.admin1, r.country].filter(Boolean).join(', ');
    const id = `place-${r.id ?? `${r.latitude},${r.longitude}`}`;
    const next = { id, label, lat: r.latitude, lng: r.longitude, isGps: false };
    setCities(prev => {
      if (prev.some(c => c.id === id)) return prev;
      return [...prev, next];
    });
    setActiveId(id);
    setSearchQ('');
    setSearchHits([]);
  };

  const removeCity = id => {
    setCities(prev => prev.filter(c => c.id !== id));
  };

  const runSearch = async () => {
    if (!searchQ.trim()) {
      setSearchHits([]);
      return;
    }
    setSearching(true);
    try {
      const hits = await searchPlaces(searchQ);
      setSearchHits(hits);
    } catch {
      setSearchHits([]);
    } finally {
      setSearching(false);
    }
  };

  const cur = bundle?.current;

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title"><i className="fas fa-cloud-sun"></i> Weather</div>
          <div className="page-subtitle">
            GPS and saved cities · 24-hour and 7-day forecast (Open-Meteo)
            {activeCity?.label ? ` — Showing: ${activeCity.label}` : ''}
          </div>
        </div>
        <div className="page-actions" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={requestGpsCity}>
            <i className="fas fa-location-crosshairs"></i> Use GPS
          </button>
          {cities.some(c => c.id === GPS_ID) && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={refreshGps} title="Update GPS position">
              <i className="fas fa-rotate"></i> Update location
            </button>
          )}
        </div>
      </div>

      {geoStatus && (
        <div className="alert alert-warning" style={{ marginBottom: '1rem' }}>
          <i className="fas fa-circle-info"></i> {geoStatus}
        </div>
      )}

      {/* City tabs */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem',
          alignItems: 'center',
          marginBottom: '1.25rem',
          paddingBottom: '1rem',
          borderBottom: '1px solid var(--border, rgba(0,0,0,.08))',
        }}
      >
        {cities.map(c => (
          <div
            key={c.id}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.35rem 0.65rem',
              borderRadius: 'var(--radius-lg, 10px)',
              border: activeId === c.id ? '2px solid var(--primary)' : '1px solid var(--border, rgba(0,0,0,.12))',
              background: activeId === c.id ? 'rgba(59, 130, 246, 0.08)' : 'var(--card-bg, #fff)',
              cursor: 'pointer',
            }}
          >
            <button
              type="button"
              onClick={() => setActiveId(c.id)}
              style={{
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontWeight: activeId === c.id ? 700 : 500,
                fontSize: '.85rem',
                color: 'var(--text)',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              {c.isGps && <i className="fas fa-location-dot" style={{ color: 'var(--primary)' }} />}
              <span style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.label}
              </span>
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              title="Remove"
              onClick={e => {
                e.stopPropagation();
                removeCity(c.id);
              }}
              style={{ padding: '0.15rem 0.35rem', lineHeight: 1 }}
            >
              <i className="fas fa-xmark" style={{ fontSize: '.75rem' }} />
            </button>
          </div>
        ))}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center', marginLeft: 'auto' }}>
          <input
            type="search"
            className="form-input"
            placeholder="Add city…"
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && runSearch()}
            style={{ minWidth: '160px', maxWidth: '220px', padding: '0.35rem 0.6rem', fontSize: '.85rem' }}
          />
          <button type="button" className="btn btn-primary btn-sm" onClick={runSearch} disabled={searching}>
            {searching ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-magnifying-glass" />}
          </button>
        </div>
      </div>

      {searchHits.length > 0 && (
        <div className="card" style={{ marginBottom: '1rem', padding: '0.75rem' }}>
          <div style={{ fontSize: '.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
            Search results
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {searchHits.map(r => (
              <button
                key={`${r.latitude}-${r.longitude}-${r.name}`}
                type="button"
                onClick={() => addFromSearch(r)}
                style={{
                  textAlign: 'left',
                  padding: '0.5rem 0.65rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border, rgba(0,0,0,.08))',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontSize: '.85rem',
                }}
              >
                <strong>{r.name}</strong>
                {r.admin1 && <span style={{ color: 'var(--text-muted)' }}>, {r.admin1}</span>}
                {r.country && <span style={{ color: 'var(--text-muted)' }}> · {r.country}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {cities.length === 0 && !loading && (
        <div className="empty-state">
          <i className="fas fa-cloud-sun"></i>
          <h3>No cities yet</h3>
          <p>Use GPS or search above to add a place.</p>
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <div className="loading-spinner" />
        </div>
      )}

      {!loading && error && (
        <div className="alert alert-danger">
          <i className="fas fa-triangle-exclamation" /> {error}
        </div>
      )}

      {!loading && !error && cur && activeCity && (
        <>
          <div className="card" style={{ marginBottom: '1.25rem', padding: '1.25rem' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center' }}>
              <div style={{ fontSize: '3rem', color: 'var(--primary)' }}>
                <i className={`fas ${wmoIcon(cur.weather_code)}`} />
              </div>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <div style={{ fontSize: '.85rem', fontWeight: 800, color: 'var(--text)' }}>
                  {activeCity.label}
                </div>
                <div style={{ fontSize: '2.25rem', fontWeight: 800, lineHeight: 1 }}>
                  {Math.round(cur.temperature_2m)}°C
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '.95rem' }}>
                  Feels like {Math.round(cur.apparent_temperature)}°C · {wmoLabel(cur.weather_code)}
                </div>
                <div style={{ fontSize: '.8rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                  Humidity {cur.relative_humidity_2m}% · Wind {Math.round(cur.wind_speed_10m)} km/h
                  {typeof cur.wind_direction_10m === 'number' && (
                    <span> · {Math.round(cur.wind_direction_10m)}°</span>
                  )}
                </div>
              </div>
              <div style={{ fontSize: '.8rem', color: 'var(--text-muted)' }}>
                <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: '0.15rem' }}>
                  {activeCity.label}
                </div>
                <div>
                  <i className="fas fa-map-pin" /> {activeCity.lat.toFixed(4)}, {activeCity.lng.toFixed(4)}
                </div>
                <div style={{ marginTop: '0.25rem' }}>Updated {formatHour(cur.time)}</div>
              </div>
            </div>
          </div>

          <div style={{ fontWeight: 700, fontSize: '.9rem', marginBottom: '0.65rem' }}>
            <i className="fas fa-clock" /> Next 24 hours
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))',
              gap: '0.5rem',
              marginBottom: '1.75rem',
            }}
          >
            {bundle.hourly24.map((h, i) => (
              <div
                key={h.time + i}
                className="card"
                style={{
                  padding: '0.5rem 0.35rem',
                  textAlign: 'center',
                  fontSize: '.72rem',
                }}
              >
                <div style={{ color: 'var(--text-muted)', marginBottom: '0.25rem' }}>{formatHour(h.time)}</div>
                <i className={`fas ${wmoIcon(h.code)}`} style={{ color: 'var(--primary)', fontSize: '1.1rem' }} />
                <div style={{ fontWeight: 700, marginTop: '0.25rem' }}>{h.temp != null ? `${Math.round(h.temp)}°` : '—'}</div>
                {h.pop != null && <div style={{ color: 'var(--text-muted)' }}>{h.pop}%</div>}
              </div>
            ))}
          </div>

          <div style={{ fontWeight: 700, fontSize: '.9rem', marginBottom: '0.65rem' }}>
            <i className="fas fa-calendar-week" /> 7-day forecast
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {bundle.daily7.map((d, i) => (
              <div
                key={d.date + i}
                className="card"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '0.65rem 1rem',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ minWidth: '100px', fontWeight: 600 }}>{formatDay(d.date)}</div>
                <i className={`fas ${wmoIcon(d.code)}`} style={{ color: 'var(--primary)', fontSize: '1.25rem' }} />
                <div style={{ flex: 1, fontSize: '.8rem', color: 'var(--text-muted)' }}>{wmoLabel(d.code)}</div>
                <div style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {d.max != null && d.min != null ? (
                    <>
                      <span style={{ color: 'var(--text)' }}>{Math.round(d.max)}°</span>
                      <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}> / {Math.round(d.min)}°</span>
                    </>
                  ) : (
                    '—'
                  )}
                </div>
                {d.pop != null && (
                  <div style={{ fontSize: '.75rem', color: 'var(--text-muted)', minWidth: '48px' }}>{d.pop}% rain</div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
