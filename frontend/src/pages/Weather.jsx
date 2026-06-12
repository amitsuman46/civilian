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

function weatherTheme(code, isDay = 1) {
  const c = Number(code);
  if (c === 0) return isDay ? 'wx-theme--clear' : 'wx-theme--night';
  if (c <= 3) return 'wx-theme--partly';
  if (c <= 48) return 'wx-theme--fog';
  if (c <= 67) return 'wx-theme--rain';
  if (c <= 77) return 'wx-theme--snow';
  if (c <= 99) return 'wx-theme--storm';
  return 'wx-theme--default';
}

function windCompass(deg) {
  if (typeof deg !== 'number') return '—';
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}

/**
 * @param {number} lat
 * @param {number} lng
 */
async function reverseLabel(lat, lng) {
  const u = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=12&addressdetails=1`;
  const res = await fetch(u, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('Reverse geocode failed');

  const data = await res.json();
  const a = data.address || {};

  const city =
    a.city || a.town || a.village || a.hamlet || a.municipality || '';
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

function formatDayShort(iso) {
  return new Date(iso + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short' });
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
    else setBundle(null);
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
  const themeClass = cur ? weatherTheme(cur.weather_code, cur.is_day) : 'wx-theme--default';

  const dailyRange = useMemo(() => {
    if (!bundle?.daily7?.length) return { min: 0, max: 30 };
    const mins = bundle.daily7.map(d => d.min).filter(v => v != null);
    const maxs = bundle.daily7.map(d => d.max).filter(v => v != null);
    return {
      min: Math.min(...mins, 0),
      max: Math.max(...maxs, 30),
    };
  }, [bundle]);

  return (
    <div className="wx-wrap">
      {/* Hero */}
      <div className="wx-hero">
        <div className="wx-hero-content">
          <div className="wx-hero-badge"><i className="fas fa-satellite"></i> Live Forecast</div>
          <h1 className="wx-hero-title">Weather</h1>
          <p className="wx-hero-desc">
            Real-time conditions, 24-hour outlook, and 7-day forecast for your locations.
          </p>
        </div>
        <div className="wx-hero-actions">
          <button type="button" className="wx-hero-btn wx-hero-btn--solid" onClick={requestGpsCity}>
            <i className="fas fa-location-crosshairs"></i> Use GPS
          </button>
          {cities.some(c => c.id === GPS_ID) && (
            <button type="button" className="wx-hero-btn" onClick={requestGpsCity}>
              <i className="fas fa-rotate"></i> Refresh GPS
            </button>
          )}
        </div>
      </div>

      {geoStatus && (
        <div className="wx-alert">
          <i className="fas fa-circle-info"></i>
          <span>{geoStatus}</span>
        </div>
      )}

      {/* Locations toolbar */}
      <div className="wx-toolbar">
        <div className="wx-cities">
          {cities.length === 0 ? (
            <span className="wx-cities-empty">No saved locations yet</span>
          ) : (
            cities.map(c => (
              <div key={c.id} className={`wx-city-chip${activeId === c.id ? ' is-active' : ''}`}>
                <button type="button" className="wx-city-chip-btn" onClick={() => setActiveId(c.id)}>
                  {c.isGps && <i className="fas fa-location-dot"></i>}
                  <span>{c.label}</span>
                </button>
                <button
                  type="button"
                  className="wx-city-chip-remove"
                  title="Remove"
                  onClick={() => removeCity(c.id)}
                  aria-label="Remove city"
                >
                  <i className="fas fa-xmark"></i>
                </button>
              </div>
            ))
          )}
        </div>
        <div className="wx-add-city">
          <div className="wx-search">
            <i className="fas fa-magnifying-glass"></i>
            <input
              type="search"
              placeholder="Add a city…"
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && runSearch()}
            />
            <button type="button" className="wx-search-btn" onClick={runSearch} disabled={searching}>
              {searching ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-plus"></i>}
            </button>
          </div>
        </div>
      </div>

      {searchHits.length > 0 && (
        <div className="wx-search-results">
          <div className="wx-search-results-title">Search results</div>
          <div className="wx-search-results-list">
            {searchHits.map(r => (
              <button
                key={`${r.latitude}-${r.longitude}-${r.name}`}
                type="button"
                className="wx-search-hit"
                onClick={() => addFromSearch(r)}
              >
                <i className="fas fa-map-pin"></i>
                <span>
                  <strong>{r.name}</strong>
                  {r.admin1 && <>, {r.admin1}</>}
                  {r.country && <> · {r.country}</>}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {cities.length === 0 && !loading && (
        <div className="wx-empty">
          <div className="wx-empty-icon"><i className="fas fa-cloud-sun"></i></div>
          <h3>No locations yet</h3>
          <p>Use GPS or search above to add your first city.</p>
        </div>
      )}

      {loading && (
        <div className="wx-loading">
          <div className="loading-spinner"></div>
          <span>Fetching forecast…</span>
        </div>
      )}

      {!loading && error && (
        <div className="wx-error">
          <i className="fas fa-triangle-exclamation"></i>
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && cur && activeCity && (
        <div className="wx-body">
          {/* Current conditions */}
          <div className={`wx-now ${themeClass}`}>
            <div className="wx-now-glow" aria-hidden="true"></div>
            <div className="wx-now-main">
              <div className="wx-now-location">
                <i className="fas fa-location-dot"></i>
                {activeCity.label}
              </div>
              <div className="wx-now-row">
                <div className="wx-now-icon">
                  <i className={`fas ${wmoIcon(cur.weather_code)}`}></i>
                </div>
                <div className="wx-now-temp">
                  <span className="wx-now-deg">{Math.round(cur.temperature_2m)}</span>
                  <span className="wx-now-unit">°C</span>
                </div>
                <div className="wx-now-summary">
                  <div className="wx-now-condition">{wmoLabel(cur.weather_code)}</div>
                  <div className="wx-now-feels">
                    Feels like {Math.round(cur.apparent_temperature)}°C
                  </div>
                  <div className="wx-now-updated">
                    Updated {formatHour(cur.time)}
                  </div>
                </div>
              </div>
            </div>
            <div className="wx-now-stats">
              <div className="wx-stat-pill">
                <i className="fas fa-droplet"></i>
                <div>
                  <span className="wx-stat-val">{cur.relative_humidity_2m}%</span>
                  <span className="wx-stat-lbl">Humidity</span>
                </div>
              </div>
              <div className="wx-stat-pill">
                <i className="fas fa-wind"></i>
                <div>
                  <span className="wx-stat-val">{Math.round(cur.wind_speed_10m)} km/h</span>
                  <span className="wx-stat-lbl">Wind {windCompass(cur.wind_direction_10m)}</span>
                </div>
              </div>
              <div className="wx-stat-pill">
                <i className="fas fa-compass"></i>
                <div>
                  <span className="wx-stat-val">{activeCity.lat.toFixed(2)}°, {activeCity.lng.toFixed(2)}°</span>
                  <span className="wx-stat-lbl">Coordinates</span>
                </div>
              </div>
            </div>
          </div>

          {/* Hourly */}
          <section className="wx-section">
            <div className="wx-section-head">
              <div className="wx-section-title">
                <i className="fas fa-clock"></i> Next 24 Hours
              </div>
              <span className="wx-section-badge">Hourly</span>
            </div>
            <div className="wx-hourly-scroll">
              {bundle.hourly24.map((h, i) => (
                <div key={h.time + i} className={`wx-hour-card${i === 0 ? ' is-now' : ''}`}>
                  <span className="wx-hour-time">{i === 0 ? 'Now' : formatHour(h.time)}</span>
                  <i className={`fas ${wmoIcon(h.code)} wx-hour-icon`}></i>
                  <span className="wx-hour-temp">{h.temp != null ? `${Math.round(h.temp)}°` : '—'}</span>
                  {h.pop != null && (
                    <span className="wx-hour-pop">
                      <i className="fas fa-droplet"></i>{h.pop}%
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* 7-day */}
          <section className="wx-section">
            <div className="wx-section-head">
              <div className="wx-section-title">
                <i className="fas fa-calendar-week"></i> 7-Day Outlook
              </div>
              <span className="wx-section-badge">Extended</span>
            </div>
            <div className="wx-daily-list">
              {bundle.daily7.map((d, i) => {
                const span = dailyRange.max - dailyRange.min || 1;
                const lowPct  = ((d.min - dailyRange.min) / span) * 100;
                const highPct = ((d.max - dailyRange.min) / span) * 100;
                const barW    = Math.max(highPct - lowPct, 8);
                return (
                  <div key={d.date + i} className={`wx-daily-row${i === 0 ? ' is-today' : ''}`}>
                    <div className="wx-daily-day">
                      <span className="wx-daily-weekday">{i === 0 ? 'Today' : formatDayShort(d.date)}</span>
                      <span className="wx-daily-date">{formatDay(d.date)}</span>
                    </div>
                    <div className="wx-daily-icon">
                      <i className={`fas ${wmoIcon(d.code)}`}></i>
                    </div>
                    <div className="wx-daily-label">{wmoLabel(d.code)}</div>
                    <div className="wx-daily-bar-wrap">
                      <div
                        className="wx-daily-bar"
                        style={{ left: `${lowPct}%`, width: `${barW}%` }}
                      />
                    </div>
                    <div className="wx-daily-temps">
                      <span className="wx-daily-max">{d.max != null ? `${Math.round(d.max)}°` : '—'}</span>
                      <span className="wx-daily-min">{d.min != null ? `${Math.round(d.min)}°` : '—'}</span>
                    </div>
                    {d.pop != null && (
                      <div className="wx-daily-pop">
                        <i className="fas fa-droplet"></i>{Math.round(d.pop)}%
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <p className="wx-attribution">
            <i className="fas fa-cloud"></i> Data provided by Open-Meteo · Geocoding by Open-Meteo &amp; OpenStreetMap
          </p>
        </div>
      )}
    </div>
  );
}
