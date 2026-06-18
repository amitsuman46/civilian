import { useEffect, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, GeoJSON, useMapEvents } from 'react-leaflet';
import MapResize from './MapResize';
import '@geoman-io/leaflet-geoman-free';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';

/** India center — biases search toward subcontinent */
const DEFAULT_CENTER = [20.5937, 78.9629];
const DEFAULT_ZOOM  = 5;
const PIN_ZOOM      = 18;

const TILES = {
  /** OSM standard — shows building footprints (gray blocks) at high zoom */
  buildings: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    subdomains: 'abc',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxNativeZoom: 19,
    maxZoom: 19,
  },
  detailed: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    subdomains: 'abcd',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxNativeZoom: 20,
    maxZoom: 20,
  },
  terrain: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    subdomains: 'abc',
    attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a> contributors',
    maxNativeZoom: 17,
    maxZoom: 17,
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, USGS, NOAA',
    maxNativeZoom: 18,
    maxZoom: 18,
  },
  hybridLabels: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    attribution: '',
    maxNativeZoom: 17,
    maxZoom: 17,
  },
};

const TILE_BUTTONS = [
  ['buildings', 'Buildings'],
  ['detailed', 'Detailed'],
  ['hybrid', 'Hybrid'],
  ['terrain', 'Terrain'],
  ['satellite', 'Satellite'],
];

function formatPhotonLabel(p) {
  const parts = [
    p.name,
    p.housenumber && p.street ? `${p.housenumber} ${p.street}` : p.street,
    p.district || p.locality,
    p.city || p.county,
    p.state,
  ].filter(Boolean);
  return [...new Set(parts)].join(', ') || p.name || 'Unknown place';
}

function formatNominatimLabel(item) {
  return item.display_name || item.name || 'Unknown place';
}

function isIndiaResult(countryCode, countryName) {
  const code = (countryCode || '').toLowerCase();
  const name = (countryName || '').toLowerCase();
  return code === 'in' || name === 'india' || name.includes('india');
}

/** Fuzzy search (Photon) + structured fallback (Nominatim), India results ranked first */
async function searchLocations(query, bias) {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const seen = new Set();
  const results = [];

  const push = (lon, lat, label, bounds, india) => {
    const key = `${Number(lat).toFixed(4)},${Number(lon).toFixed(4)}`;
    if (seen.has(key)) return;
    seen.add(key);
    results.push({ x: Number(lon), y: Number(lat), label, bounds, india });
  };

  try {
    const photonRes = await fetch(
      `https://photon.komoot.io/api/?q=${encodeURIComponent(trimmed)}&limit=15&lang=en`
      + `&lat=${bias.lat}&lon=${bias.lng}`,
    );
    if (photonRes.ok) {
      const data = await photonRes.json();
      for (const f of data.features || []) {
        const [lon, lat] = f.geometry.coordinates;
        const p = f.properties || {};
        push(lon, lat, formatPhotonLabel(p), null, isIndiaResult(p.countrycode, p.country));
      }
    }
  } catch { /* continue to fallback */ }

  if (results.length < 8) {
    try {
      const nomRes = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json`
        + `&q=${encodeURIComponent(trimmed)}&limit=8&addressdetails=1&dedupe=1`,
        { headers: { 'Accept-Language': 'en' } },
      );
      if (nomRes.ok) {
        const data = await nomRes.json();
        for (const item of data) {
          const addr = item.address || {};
          push(
            parseFloat(item.lon),
            parseFloat(item.lat),
            formatNominatimLabel(item),
            item.boundingbox
              ? [[parseFloat(item.boundingbox[0]), parseFloat(item.boundingbox[2])],
                 [parseFloat(item.boundingbox[1]), parseFloat(item.boundingbox[3])]]
              : null,
            isIndiaResult(addr.country_code, addr.country),
          );
        }
      }
    } catch { /* ignore */ }
  }

  results.sort((a, b) => {
    if (a.india !== b.india) return a.india ? -1 : 1;
    return 0;
  });

  return results.slice(0, 10);
}

function ClickHandler({ onMapClick }) {
  useMapEvents({ click: (e) => onMapClick(e.latlng) });
  return null;
}

function MapTileLayer({ layerKey }) {
  if (layerKey === 'hybrid') {
    const sat = TILES.satellite;
    const lbl = TILES.hybridLabels;
    return (
      <>
        <TileLayer
          url={sat.url}
          attribution={sat.attribution}
          maxZoom={sat.maxZoom}
          maxNativeZoom={sat.maxNativeZoom}
        />
        <TileLayer
          url={lbl.url}
          attribution={lbl.attribution}
          maxZoom={lbl.maxZoom}
          maxNativeZoom={lbl.maxNativeZoom}
          opacity={0.9}
        />
      </>
    );
  }
  const t = TILES[layerKey] || TILES.buildings;
  return (
    <TileLayer
      key={layerKey}
      url={t.url}
      attribution={t.attribution}
      subdomains={t.subdomains}
      maxZoom={t.maxZoom}
      maxNativeZoom={t.maxNativeZoom}
    />
  );
}

export default function MapPicker({ lat, lng, polygon, onChange }) {
  const mapRef        = useRef(null);
  const searchWrapRef = useRef(null);
  const debounceRef   = useRef(null);
  const [tileLayer, setTileLayer]     = useState('buildings');
  const [pin, setPin]                 = useState(lat && lng ? [lat, lng] : null);
  const [polyState, setPolyState]     = useState(polygon || null);
  const [gpsLoading, setGpsLoading]   = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [searchOpen, setSearchOpen]   = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const geomanReady = useRef(false);

  const searchBias = pin
    ? { lat: pin[0], lng: pin[1] }
    : lat && lng
      ? { lat, lng }
      : { lat: DEFAULT_CENTER[0], lng: DEFAULT_CENTER[1] };

  const activeTile = TILES[tileLayer === 'hybrid' ? 'satellite' : tileLayer] || TILES.buildings;
  const mapMaxZoom = tileLayer === 'hybrid'
    ? Math.min(TILES.satellite.maxZoom, TILES.hybridLabels.maxZoom)
    : activeTile.maxZoom;

  useEffect(() => {
    if (!mapRef.current || !lat || !lng) return;
    mapRef.current.flyTo([lat, lng], PIN_ZOOM, { animate: false });
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onDocClick = (e) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const applyLocation = useCallback((newPin, bounds = null) => {
    setPin(newPin);
    onChange({ lat: newPin[0], lng: newPin[1], polygon: polyState });
    const map = mapRef.current;
    if (!map) return;
    if (bounds) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: PIN_ZOOM });
    } else {
      map.flyTo(newPin, PIN_ZOOM, { animate: true });
    }
  }, [onChange, polyState]);

  const fetchSuggestions = useCallback(async (query) => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setSearchOpen(false);
      return;
    }
    setSearchLoading(true);
    setSearchError('');
    try {
      const bias = pin
        ? { lat: pin[0], lng: pin[1] }
        : lat && lng
          ? { lat, lng }
          : { lat: DEFAULT_CENTER[0], lng: DEFAULT_CENTER[1] };
      const results = await searchLocations(trimmed, bias);
      setSuggestions(results);
      setSearchOpen(results.length > 0);
      setActiveSuggestion(-1);
      if (!results.length) setSearchError('No matching locations found. Try fewer or different words.');
    } catch {
      setSuggestions([]);
      setSearchOpen(false);
      setSearchError('Search failed. Check your connection.');
    } finally {
      setSearchLoading(false);
    }
  }, [pin, lat, lng]);

  const handleSearchInput = (value) => {
    setSearchQuery(value);
    setSearchError('');
    clearTimeout(debounceRef.current);
    if (!value.trim()) {
      setSuggestions([]);
      setSearchOpen(false);
      return;
    }
    debounceRef.current = setTimeout(() => fetchSuggestions(value), 280);
  };

  const selectSuggestion = (item) => {
    const newPin = [item.y, item.x];
    setSearchQuery(item.label);
    setSuggestions([]);
    setSearchOpen(false);
    setSearchError('');
    applyLocation(newPin, item.bounds || null);
  };

  const handleSearchSubmit = async () => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    if (suggestions.length) {
      selectSuggestion(suggestions[Math.max(activeSuggestion, 0)]);
      return;
    }
    setSearchLoading(true);
    setSearchError('');
    try {
      const results = await searchLocations(trimmed, searchBias);
      if (!results.length) {
        setSearchError('Location not found. Try a shorter or simpler search.');
        return;
      }
      selectSuggestion(results[0]);
    } catch {
      setSearchError('Search failed. Check your connection.');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSearchKeyDown = (e) => {
    if (!searchOpen || !suggestions.length) {
      if (e.key === 'Enter') {
        e.stopPropagation();
        handleSearchSubmit();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggestion(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestion(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (activeSuggestion >= 0) selectSuggestion(suggestions[activeSuggestion]);
      else handleSearchSubmit();
    } else if (e.key === 'Escape') {
      setSearchOpen(false);
    }
  };

  const initGeoman = (map) => {
    if (!map || geomanReady.current) return;
    geomanReady.current = true;

    map.pm.addControls({
      position: 'topleft',
      drawMarker: false,
      drawCircleMarker: false,
      drawPolyline: false,
      drawCircle: false,
      drawRectangle: true,
      drawPolygon: true,
      editMode: true,
      dragMode: true,
      cutPolygon: false,
      removalMode: true,
    });

    map.on('pm:create', (e) => {
      const geojson = e.layer.toGeoJSON();
      setPolyState(geojson);
      onChange({
        lat: pin ? pin[0] : null,
        lng: pin ? pin[1] : null,
        polygon: geojson,
      });
    });

    map.on('pm:remove', () => {
      setPolyState(null);
      onChange({
        lat: pin ? pin[0] : null,
        lng: pin ? pin[1] : null,
        polygon: null,
      });
    });
  };

  const handleMapClick = (latlng) => {
    const newPin = [latlng.lat, latlng.lng];
    setPin(newPin);
    onChange({ lat: latlng.lat, lng: latlng.lng, polygon: polyState });
  };

  const handleGPS = () => {
    if (!navigator.geolocation) return;
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const newPin = [coords.latitude, coords.longitude];
        setPin(newPin);
        mapRef.current?.flyTo(newPin, PIN_ZOOM, { animate: true });
        onChange({ lat: coords.latitude, lng: coords.longitude, polygon: polyState });
        setGpsLoading(false);
      },
      () => setGpsLoading(false),
      { timeout: 10000 }
    );
  };

  const clearPin = () => {
    setPin(null);
    onChange({ lat: null, lng: null, polygon: polyState });
  };

  return (
    <div className="map-picker">
      <div className="map-picker-controls">
        <div className="tab-switcher map-picker-tiles">
          {TILE_BUTTONS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`tab-btn${tileLayer === key ? ' active' : ''}`}
              onClick={() => setTileLayer(key)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="map-search-wrap" ref={searchWrapRef}>
          <div className="map-search-bar">
            <i className="fas fa-magnifying-glass map-search-icon" aria-hidden="true"></i>
            <input
              type="text"
              className="form-input map-search-input"
              placeholder="Search place, street, landmark…"
              value={searchQuery}
              onChange={e => handleSearchInput(e.target.value)}
              onFocus={() => suggestions.length && setSearchOpen(true)}
              onKeyDown={handleSearchKeyDown}
              autoComplete="off"
              role="combobox"
              aria-expanded={searchOpen}
              aria-controls="map-search-listbox"
              aria-autocomplete="list"
            />
            {searchLoading && (
              <span className="map-search-spinner" aria-hidden="true">
                <i className="fas fa-spinner fa-spin"></i>
              </span>
            )}
            <button
              type="button"
              className="btn-primary map-search-btn"
              onClick={handleSearchSubmit}
              aria-label="Search location"
            >
              <i className="fas fa-search"></i>
            </button>
          </div>

          {searchOpen && suggestions.length > 0 && (
            <ul className="map-search-suggestions" id="map-search-listbox" role="listbox">
              {suggestions.map((item, idx) => (
                <li key={`${item.x}-${item.y}-${idx}`} role="option" aria-selected={idx === activeSuggestion}>
                  <button
                    type="button"
                    className={`map-search-suggestion${idx === activeSuggestion ? ' is-active' : ''}`}
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => selectSuggestion(item)}
                  >
                    <i className="fas fa-location-dot"></i>
                    <span>{item.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button type="button" className="btn-secondary map-picker-gps" onClick={handleGPS} disabled={gpsLoading}>
          {gpsLoading
            ? <><i className="fas fa-spinner fa-spin"></i> Locating…</>
            : <><i className="fas fa-location-crosshairs"></i> My Location</>
          }
        </button>
      </div>

      {searchError && !searchOpen && (
        <div className="map-search-error">{searchError}</div>
      )}

      <p className="map-picker-hint">
        <i className="fas fa-circle-info"></i>
        Use <strong>Buildings</strong> layer and zoom in to see house blocks (where mapped). Search accepts partial names.
      </p>

      <MapContainer
        center={pin || DEFAULT_CENTER}
        zoom={pin ? PIN_ZOOM : DEFAULT_ZOOM}
        maxZoom={mapMaxZoom}
        style={{ height: '380px', width: '100%', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}
        scrollWheelZoom={false}
        ref={(map) => {
          if (map && !mapRef.current) {
            mapRef.current = map;
            initGeoman(map);
          }
        }}
      >
        <MapResize />
        <MapTileLayer layerKey={tileLayer} />
        <ClickHandler onMapClick={handleMapClick} />
        {pin && (
          <Marker position={pin}>
            <Popup>
              <span style={{ fontSize: '.8rem' }}>
                {pin[0].toFixed(6)}, {pin[1].toFixed(6)}
              </span>
            </Popup>
          </Marker>
        )}
        {polyState && <GeoJSON key={JSON.stringify(polyState)} data={polyState} />}
      </MapContainer>

      <div className="map-picker-coords">
        <i className={`fas fa-map-pin${pin ? ' has-pin' : ''}`}></i>
        {pin
          ? <>
              <span>Lat: <strong>{pin[0].toFixed(6)}</strong></span>
              <span>Lng: <strong>{pin[1].toFixed(6)}</strong></span>
              <button type="button" className="map-picker-clear" onClick={clearPin}>
                <i className="fas fa-times"></i> Clear pin
              </button>
            </>
          : <span>Click the map to drop a pin, pick a search result, or use My Location</span>
        }
      </div>
    </div>
  );
}
