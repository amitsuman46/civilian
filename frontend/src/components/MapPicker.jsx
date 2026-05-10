import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, GeoJSON, useMapEvents } from 'react-leaflet';
import '@geoman-io/leaflet-geoman-free';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';

const TILES = {
  street: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  terrain: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a> contributors',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, USGS, NOAA',
  },
};

const DEFAULT_CENTER = [20.5937, 78.9629];
const DEFAULT_ZOOM  = 5;

function ClickHandler({ onMapClick }) {
  useMapEvents({ click: (e) => onMapClick(e.latlng) });
  return null;
}

export default function MapPicker({ lat, lng, polygon, onChange }) {
  const mapRef        = useRef(null);
  const [tileLayer, setTileLayer]     = useState('street');
  const [pin, setPin]                 = useState(lat && lng ? [lat, lng] : null);
  const [polyState, setPolyState]     = useState(polygon || null);
  const [gpsLoading, setGpsLoading]   = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchError, setSearchError] = useState('');
  const geomanReady = useRef(false);

  // Fly to pre-populated pin on first load (EditRecord)
  useEffect(() => {
    if (!mapRef.current || !lat || !lng) return;
    mapRef.current.flyTo([lat, lng], 15, { animate: false });
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  // Set up Geoman drawing controls after map mounts
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
        mapRef.current?.flyTo(newPin, 16, { animate: true });
        onChange({ lat: coords.latitude, lng: coords.longitude, polygon: polyState });
        setGpsLoading(false);
      },
      () => setGpsLoading(false),
      { timeout: 10000 }
    );
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearchError('');
    try {
      const res  = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await res.json();
      if (!data.length) { setSearchError('Location not found.'); return; }
      const { lat: sLat, lon: sLon } = data[0];
      const newPin = [parseFloat(sLat), parseFloat(sLon)];
      setPin(newPin);
      mapRef.current?.flyTo(newPin, 15, { animate: true });
      onChange({ lat: newPin[0], lng: newPin[1], polygon: polyState });
    } catch {
      setSearchError('Search failed. Check your connection.');
    }
  };

  const clearPin = () => {
    setPin(null);
    onChange({ lat: null, lng: null, polygon: polyState });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

      {/* Controls row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>

        {/* Tile toggle */}
        <div className="tab-switcher" style={{ flexShrink: 0 }}>
          {[['street','Street'],['terrain','Terrain'],['satellite','Satellite']].map(([key, label]) => (
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

        {/* Location search */}
        <div style={{ display: 'flex', gap: '0.4rem', flex: 1, minWidth: '200px' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search location…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.stopPropagation(), handleSearch())}
            style={{ flex: 1 }}
          />
          <button type="button" className="btn-primary" onClick={handleSearch} style={{ padding: '0 0.75rem', flexShrink: 0 }}>
            <i className="fas fa-search"></i>
          </button>
        </div>

        {/* GPS button */}
        <button type="button" className="btn-secondary" onClick={handleGPS} disabled={gpsLoading} style={{ flexShrink: 0 }}>
          {gpsLoading
            ? <><i className="fas fa-spinner fa-spin"></i> Locating…</>
            : <><i className="fas fa-location-crosshairs"></i> My Location</>
          }
        </button>
      </div>

      {searchError && (
        <div style={{ color: 'var(--danger)', fontSize: '.8rem' }}>{searchError}</div>
      )}

      {/* Map */}
      <MapContainer
        center={pin || DEFAULT_CENTER}
        zoom={pin ? 15 : DEFAULT_ZOOM}
        style={{ height: '380px', width: '100%', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}
        scrollWheelZoom={false}
        ref={(map) => {
          if (map && !mapRef.current) {
            mapRef.current = map;
            initGeoman(map);
          }
        }}
      >
        <TileLayer key={tileLayer} url={TILES[tileLayer].url} attribution={TILES[tileLayer].attribution} />
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

      {/* Coordinate display */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '.8rem', color: 'var(--text-muted)' }}>
        <i className="fas fa-map-pin" style={{ color: pin ? 'var(--primary)' : 'var(--text-muted)' }}></i>
        {pin
          ? <>
              <span>Lat: <strong>{pin[0].toFixed(6)}</strong></span>
              <span>Lng: <strong>{pin[1].toFixed(6)}</strong></span>
              <button type="button" onClick={clearPin} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '.8rem' }}>
                <i className="fas fa-times"></i> Clear pin
              </button>
            </>
          : <span>Click on the map to drop a pin, or use Search / My Location</span>
        }
      </div>
    </div>
  );
}
