import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MapContainer, Marker, Popup, GeoJSON, useMap } from 'react-leaflet';
import MapResize from '../components/MapResize';
import MapTilerBasemap from '../components/MapTilerBasemap';
import MapStyleToggle from '../components/MapStyleToggle';
import { MAP_MAX_ZOOM, MAP_PIN_ZOOM, DEFAULT_MAP_STYLE } from '../config/maptiler';
import API from '../api';
import { uploadUrl } from '../utils/files';

function AutoFit({ pin, polygon }) {
  const map = useMap();
  useEffect(() => {
    if (pin && polygon) {
      const bounds = [];
      bounds.push(pin);
      const coords = polygon.geometry?.coordinates?.[0] || polygon.features?.[0]?.geometry?.coordinates?.[0] || [];
      coords.forEach(([lng, lat]) => bounds.push([lat, lng]));
      if (bounds.length > 1) { map.fitBounds(bounds, { padding: [40, 40] }); return; }
    }
    if (pin) { map.setView(pin, MAP_PIN_ZOOM); return; }
    if (polygon) {
      const coords = polygon.geometry?.coordinates?.[0] || polygon.features?.[0]?.geometry?.coordinates?.[0] || [];
      if (coords.length) {
        const bounds = coords.map(([lng, lat]) => [lat, lng]);
        map.fitBounds(bounds, { padding: [40, 40] });
      }
    }
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function fmt(str) {
  if (!str) return '—';
  return new Date(str).toLocaleString('en-US', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit', hour12:true });
}
function fmtMoney(v) { return v && parseFloat(v) > 0 ? '₹' + parseFloat(v).toLocaleString('en-IN', { minimumFractionDigits:2 }) : 'N/A'; }

export default function FullReport() {
  const { id } = useParams();
  const [rec, setRec]   = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [mapStyle, setMapStyle] = useState(DEFAULT_MAP_STYLE);

  useEffect(() => {
    API.get(`/api/civilians/${id}`).then(data => {
      if (!data.success) { setNotFound(true); return; }
      setRec(data.record);
    });
  }, [id]);

  if (notFound) return <div className="alert alert-danger"><i className="fas fa-triangle-exclamation"></i> Record not found.</div>;
  if (!rec) return <div style={{padding:'3rem', textAlign:'center'}}><div className="loading-spinner" style={{margin:'0 auto'}}></div></div>;

  const photoUrl = uploadUrl(rec.photo_path);
  const docUrl   = uploadUrl(rec.document_path);
  const docExt   = rec.document_path ? rec.document_path.split('.').pop().toLowerCase() : '';

  let familyMembers = [];
  try {
    const raw = rec.family_details;
    familyMembers = Array.isArray(raw) ? raw : JSON.parse(raw || '[]');
  } catch {}

  const pin     = rec.lat && rec.lng ? [parseFloat(rec.lat), parseFloat(rec.lng)] : null;
  const polygon = rec.polygon
    ? (typeof rec.polygon === 'string' ? JSON.parse(rec.polygon) : rec.polygon)
    : null;
  const hasMap  = pin || polygon;
  const mapLabel = pin && polygon ? 'Pin + Plot boundary' : pin ? 'Pin location' : polygon ? 'Plot boundary' : null;

  const income      = parseFloat(rec.income || 0);
  const expenditure = parseFloat(rec.expenditure || 0);
  const net         = income - expenditure;
  const showNet     = income > 0 && expenditure > 0;

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">
            <i className="fas fa-file-lines"></i> Full Civilian Report
            {rec.house_no && <span className="badge badge-primary" style={{fontSize:'.7em', verticalAlign:'middle', marginLeft:'.5rem'}}>H/No {rec.house_no}</span>}
          </div>
          <div className="page-subtitle">Detailed profile — Record #{rec.id}</div>
        </div>
        <div className="page-actions">
          <Link to="/dashboard/view" className="btn btn-secondary btn-sm"><i className="fas fa-arrow-left"></i> Back</Link>
          {rec.can_edit && (
            <Link to={`/dashboard/edit/${rec.id}`} className="btn btn-primary btn-sm"><i className="fas fa-pen"></i> Edit</Link>
          )}
          <button onClick={() => window.print()} className="btn btn-outline-primary btn-sm"><i className="fas fa-print"></i> Print</button>
        </div>
      </div>

      <div className="report-layout">
        {/* Sidebar */}
        <div className="report-sidebar">
          <div className="report-photo-wrap">
            <div className="report-photo-container">
              {photoUrl
                ? <><img src={photoUrl} className="report-photo" alt="Photo"
                    onError={e => { e.target.style.display='none'; e.target.nextElementSibling.style.display='flex'; }} />
                   <div className="report-photo-placeholder" style={{display:'none'}}><i className="fas fa-user"></i></div></>
                : <div className="report-photo-placeholder"><i className="fas fa-user"></i></div>
              }
              {rec.house_no && <span className="report-hno-badge">H/No {rec.house_no}</span>}
            </div>
          </div>
          <div className="report-name" style={{padding:'0 1rem', textAlign:'center'}}>{rec.name}</div>
          <div className="report-sub">{[rec.village, rec.area].filter(Boolean).join(', ') || '—'}</div>

          {docUrl && (
            <div style={{padding:'.75rem 1rem 1.25rem', borderTop:'1px solid var(--border)'}}>
              <p style={{fontSize:'.75rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', color:'var(--text-muted)', marginBottom:'.6rem'}}>
                <i className="fas fa-paperclip"></i> Attached Document
              </p>
              {docExt === 'pdf'
                ? <a href={docUrl} target="_blank" rel="noreferrer" className="btn btn-outline-primary btn-sm" style={{width:'100%', justifyContent:'center'}}>
                    <i className="fas fa-file-pdf"></i> View PDF
                  </a>
                : <>
                    <img src={docUrl} alt="Document" style={{width:'100%', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)', marginBottom:'.5rem'}} />
                    <a href={docUrl} target="_blank" rel="noreferrer" className="btn btn-outline-primary btn-sm" style={{width:'100%', justifyContent:'center'}}>
                      <i className="fas fa-expand"></i> View Full Size
                    </a>
                  </>
              }
            </div>
          )}

          <div style={{padding:'.75rem 1rem 1.25rem', borderTop:'1px solid var(--border)', fontSize:'.775rem', color:'var(--text-muted)', lineHeight:1.8}}>
            <strong>Record ID:</strong> #{rec.id}<br/>
            <strong>Added:</strong> {fmt(rec.created_at)}<br/>
            <strong>Updated:</strong> {fmt(rec.updated_at)}
          </div>
        </div>

        {/* Main Content */}
        <div>
          {/* Basic Identification */}
          <div className="card mb-2">
            <div className="card-header"><h3><i className="fas fa-hashtag"></i> Basic Identification</h3></div>
            <div className="card-body">
              <div className="report-detail-grid">
                <div className="detail-item">
                  <div className="detail-label"><i className="fas fa-house"></i> House No</div>
                  <div className="detail-value" style={{fontSize:'1.2rem', color:'var(--primary)'}}>{rec.house_no || 'N/A'}</div>
                </div>
                <div className="detail-item">
                  <div className="detail-label"><i className="fas fa-id-badge"></i> Head of Family</div>
                  <div className="detail-value">{rec.name}</div>
                </div>
                <div className="detail-item">
                  <div className="detail-label"><i className="fas fa-phone"></i> Contact No</div>
                  <div className="detail-value">{rec.mobile}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Location & Personal */}
          <div className="card mb-2">
            <div className="card-header"><h3><i className="fas fa-map-marker-alt"></i> Location &amp; Personal</h3></div>
            <div className="card-body">
              <div className="report-detail-grid">
                {[
                  { icon:'fa-house-flag',  label:'Village / Town', val: rec.village },
                  { icon:'fa-map',         label:'Area / Zone',    val: rec.area },
                  { icon:'fa-briefcase',   label:'Occupation',     val: rec.occupation },
                  { icon:'fa-users',       label:'Community',      val: rec.community },
                  { icon:'fa-mosque',      label:'Religion',       val: rec.religion },
                ].map(({ icon, label, val }) => (
                  <div className="detail-item" key={label}>
                    <div className="detail-label"><i className={`fas ${icon}`}></i> {label}</div>
                    <div className="detail-value">{val || 'N/A'}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Map Location */}
          {hasMap && (
            <div className="card mb-2">
              <div className="card-header">
                <h3><i className="fas fa-map-location-dot"></i> Mapped Location</h3>
                <div className="dash-chart-header-actions">
                  <MapStyleToggle value={mapStyle} onChange={setMapStyle} />
                  <span className="badge badge-primary" style={{ fontSize: '.75rem' }}>{mapLabel}</span>
                </div>
              </div>
              <div className="card-body" style={{ padding: 0, overflow: 'hidden', borderRadius: '0 0 var(--radius-lg) var(--radius-lg)' }}>
                <MapContainer
                  center={pin || [20.5937, 78.9629]}
                  zoom={pin ? MAP_PIN_ZOOM : 5}
                  maxZoom={MAP_MAX_ZOOM}
                  style={{ height: '340px', width: '100%' }}
                  scrollWheelZoom={false}
                  zoomControl={true}
                  dragging={true}
                >
                  <MapResize />
                  <MapTilerBasemap style={mapStyle} />
                  <AutoFit pin={pin} polygon={polygon} />
                  {pin && (
                    <Marker position={pin}>
                      <Popup>
                        <div style={{ lineHeight: 1.7 }}>
                          <strong>{rec.name}</strong><br />
                          {rec.house_no && <span style={{ fontSize: '.8rem' }}>H/No {rec.house_no}</span>}<br />
                          <span style={{ fontSize: '.75rem', color: '#888' }}>{pin[0].toFixed(6)}, {pin[1].toFixed(6)}</span>
                        </div>
                      </Popup>
                    </Marker>
                  )}
                  {polygon && (
                    <GeoJSON
                      key={JSON.stringify(polygon)}
                      data={polygon}
                      style={{ color: '#1d4ed8', weight: 2, fillOpacity: 0.15 }}
                    />
                  )}
                </MapContainer>
              </div>
            </div>
          )}

          {/* Property & Income */}
          <div className="card mb-2">
            <div className="card-header"><h3><i className="fas fa-building"></i> Property &amp; Income</h3></div>
            <div className="card-body">
              <div className="report-detail-grid">
                <div className="detail-item">
                  <div className="detail-label"><i className="fas fa-house-chimney"></i> Immovable Property</div>
                  <div className="detail-value">{rec.immovable_property || 'N/A'}</div>
                </div>
                <div className="detail-item">
                  <div className="detail-label"><i className="fas fa-tractor"></i> Movable Property</div>
                  <div className="detail-value">{rec.movable_property || 'N/A'}</div>
                </div>
                <div className="detail-item">
                  <div className="detail-label"><i className="fas fa-arrow-trend-up"></i> Monthly Income</div>
                  <div className="detail-value" style={{color:'var(--success)'}}>{fmtMoney(rec.income)}</div>
                </div>
                <div className="detail-item">
                  <div className="detail-label"><i className="fas fa-arrow-trend-down"></i> Monthly Expenditure</div>
                  <div className="detail-value" style={{color:'var(--danger)'}}>{fmtMoney(rec.expenditure)}</div>
                </div>
                <div className="detail-item">
                  <div className="detail-label"><i className="fas fa-wallet"></i> Salary / Earnings</div>
                  <div className="detail-value">{fmtMoney(rec.salary)}</div>
                </div>
                {showNet && (
                  <div className="detail-item">
                    <div className="detail-label"><i className="fas fa-scale-balanced"></i> Net Savings</div>
                    <div className="detail-value" style={{color: net >= 0 ? 'var(--success)' : 'var(--danger)'}}>
                      ₹{Math.abs(net).toLocaleString('en-IN', {minimumFractionDigits:2})} {net >= 0 ? '(Savings)' : '(Deficit)'}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Family Members */}
          <div className="card">
            <div className="card-header">
              <h3><i className="fas fa-people-group"></i> Family Details</h3>
              <span className="badge badge-primary">{familyMembers.length} member(s)</span>
            </div>
            <div className="card-body" style={{padding:0, overflowX:'auto'}}>
              {familyMembers.length > 0 ? (
                <table className="family-table-view">
                  <thead>
                    <tr>
                      <th className="sr" style={{width:'44px'}}>Sr.</th>
                      <th>Name</th>
                      <th>Relation to Head</th>
                      <th>Age</th>
                      <th>Occupation</th>
                      <th>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {familyMembers.map((m, i) => (
                      <tr key={i}>
                        <td className="sr">{i + 1}</td>
                        <td><strong>{m.name}</strong></td>
                        <td>{m.relation}</td>
                        <td>{m.age}</td>
                        <td>{m.occupation}</td>
                        <td style={{color:'var(--text-muted)'}}>{m.remarks || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="empty-state" style={{padding:'2rem'}}>
                  <i className="fas fa-users"></i>
                  <h3>No family members recorded</h3>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          .navbar, .breadcrumb-bar, .page-actions, .site-footer { display: none !important; }
          .report-layout { grid-template-columns: 200px 1fr; }
          body { background: #fff; }
          .main-content { padding: 0; }
          .leaflet-control-zoom { display: none !important; }
        }
      `}</style>
    </>
  );
}
