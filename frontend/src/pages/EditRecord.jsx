import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import FamilyTable   from '../components/FamilyTable';
import WebcamCapture from '../components/WebcamCapture';
import MapPicker     from '../components/MapPicker';
import { useToast }  from '../context/ToastContext';
import API from '../api';

const HEALTH_OPTIONS = ['Excellent','Good','Fair','Poor','Critical'];
const OCCUPATIONS    = ['Farmer','Teacher','Engineer','Doctor','Businessman','Driver','Tailor','Nurse','Homemaker','Labourer','Government Employee','Self-Employed','Student','Retired','Other'];
const AREAS          = ['Saujiya','Poonch','Rajouri','Mendhar','Krishna Ghati'];
const VILLAGES       = ['Gagariyan','Barmiya and Doba','Upper Gagariyan','Wazli','kainth','Sawjiya(Maidan)','Sawjiya','Sawjian(Mir Muhallah)','Sawjian(Bandi Muhallah)','Sawjian(Ladhi Muhallah)','Sawjian(Purya Muhallah)','Sawjian(Tantary Muhallah)','Sawjian(Gantar)','Sawjian(Sundri)'];
const COMMUNITIES    = ['Kashmiri','Hindu','Muslim','Sikh','Christian','Buddhist','Jain','Other'];
const RELIGIONS      = ['Islam','Hinduism','Sikhism','Christianity','Buddhism','Jainism','Other'];

export default function EditRecord() {
  const { id }    = useParams();
  const navigate  = useNavigate();
  const showToast = useToast();

  const [rec, setRec]       = useState(null);
  const [form, setForm]     = useState({});
  const [family, setFamily] = useState([]);
  const [photoFile, setPhotoFile] = useState(null);
  const [docFile, setDocFile]     = useState(null);
  const [photoB64, setPhotoB64]   = useState(null);
  const [docB64, setDocB64]       = useState(null);
  const [photoTab, setPhotoTab]   = useState('file');
  const [docTab, setDocTab]       = useState('file');
  const [photoName, setPhotoName] = useState('No file chosen');
  const [docName, setDocName]     = useState('No file chosen');
  const [mapData, setMapData]   = useState({ lat: null, lng: null, polygon: null });
  const [errors, setErrors] = useState({});
  const [busy, setBusy]     = useState(false);
  const [notFound, setNotFound] = useState(false);

  const photoRef = useRef(null);
  const docRef   = useRef(null);

  useEffect(() => {
    API.get(`/api/civilians/${id}`).then(data => {
      if (!data.success) { setNotFound(true); return; }
      const r = data.record;
      setRec(r);
      setForm({
        house_no: r.house_no || '', name: r.name || '', mobile: r.mobile || '',
        village: r.village || '', area: r.area || '', occupation: r.occupation || '',
        community: r.community || '', religion: r.religion || '', health_status: r.health_status || '',
        immovable_property: r.immovable_property || '', movable_property: r.movable_property || '',
        income: r.income || '', expenditure: r.expenditure || '', salary: r.salary || '',
      });
      try {
        const raw = r.family_details;
        setFamily(Array.isArray(raw) ? raw : JSON.parse(raw || '[]'));
      } catch { setFamily([]); }
      setMapData({
        lat:     r.lat     ? parseFloat(r.lat)  : null,
        lng:     r.lng     ? parseFloat(r.lng)  : null,
        polygon: r.polygon ? (typeof r.polygon === 'string' ? JSON.parse(r.polygon) : r.polygon) : null,
      });
    });
  }, [id]);

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }));

  const validate = () => {
    const e = {};
    if (!form.name?.trim())   e.name   = 'Name is required.';
    if (!form.mobile?.trim()) e.mobile = 'Contact number is required.';
    else if (!/^[6-9]\d{9}$/.test(form.mobile.trim())) e.mobile = 'Enter a valid 10-digit Indian mobile number.';
    setErrors(e);
    if (Object.keys(e).length > 0) {
      showToast(Object.values(e)[0], 'error');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setBusy(true);

    const fd = new FormData();
    fd.append('id', id);
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    fd.append('family_details', JSON.stringify(family.filter(m => m.name.trim())));
    if (mapData.lat !== null) fd.append('lat', mapData.lat);
    if (mapData.lng !== null) fd.append('lng', mapData.lng);
    if (mapData.polygon)      fd.append('polygon', JSON.stringify(mapData.polygon));

    if (photoB64) fd.append('photo_base64', photoB64);
    else if (photoFile) fd.append('photo_file', photoFile);

    if (docB64) fd.append('doc_base64', docB64);
    else if (docFile) fd.append('document_file', docFile);

    try {
      const data = await API.put(`/api/civilians/${id}`, fd);
      if (data.success) {
        showToast('Record updated successfully! Redirecting to report…', 'success');
        setTimeout(() => navigate(`/dashboard/report/${id}`), 1200);
      } else {
        showToast(data.message || 'Update failed.', 'error');
      }
    } catch {
      showToast('Network error. Please try again.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const ErrMsg = ({ field }) => errors[field]
    ? <span className="field-error">{errors[field]}</span> : null;

  if (notFound) return <div className="alert alert-danger"><i className="fas fa-triangle-exclamation"></i> Record not found.</div>;
  if (!rec) return <div style={{padding:'3rem', textAlign:'center'}}><div className="loading-spinner" style={{margin:'0 auto'}}></div></div>;

  const photoUrl = rec.photo_path ? `/uploads/${rec.photo_path}` : null;
  const docUrl   = rec.document_path ? `/uploads/${rec.document_path}` : null;
  const docExt   = rec.document_path ? rec.document_path.split('.').pop().toLowerCase() : '';

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title"><i className="fas fa-pen"></i> Edit Record</div>
          <div className="page-subtitle">
            Updating — <strong>{rec.name}</strong>
            {rec.house_no && <> &nbsp;<span className="badge badge-primary">H/No {rec.house_no}</span></>}
            &nbsp;(ID: #{rec.id})
          </div>
        </div>
        <div className="page-actions">
          <Link to="/dashboard/update" className="btn btn-secondary btn-sm">
            <i className="fas fa-arrow-left"></i> Back
          </Link>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        {/* Basic Identification */}
        <div className="form-card">
          <div className="form-card-header"><i className="fas fa-hashtag"></i> Basic Identification</div>
          <div className="form-card-body">
            <div className="form-grid three">
              <div className="form-group">
                <label>House No</label>
                <input type="text" value={form.house_no} onChange={e => set('house_no', e.target.value)} maxLength={20} />
              </div>
              <div className="form-group">
                <label>Head of Family (Name) <span className="req">*</span></label>
                <input type="text" value={form.name} onChange={e => set('name', e.target.value)} maxLength={100} className={errors.name ? 'invalid' : ''} />
                <ErrMsg field="name" />
              </div>
              <div className="form-group">
                <label>Contact No <span className="req">*</span></label>
                <input type="tel" value={form.mobile} onChange={e => set('mobile', e.target.value)} maxLength={15} className={errors.mobile ? 'invalid' : ''} />
                <ErrMsg field="mobile" />
              </div>
            </div>
          </div>
        </div>

        {/* Location & Personal */}
        <div className="form-card">
          <div className="form-card-header"><i className="fas fa-map-marker-alt"></i> Location &amp; Personal Details</div>
          <div className="form-card-body">
            <div className="form-grid three">
              {[
                { label:'Village / Town', field:'village',      opts: VILLAGES },
                { label:'Area / Zone',    field:'area',         opts: AREAS },
                { label:'Occupation',     field:'occupation',   opts: OCCUPATIONS },
                { label:'Community',      field:'community',    opts: COMMUNITIES },
                { label:'Religion',       field:'religion',     opts: RELIGIONS },
                { label:'Health Status',  field:'health_status',opts: HEALTH_OPTIONS },
              ].map(({ label, field, opts }) => (
                <div className="form-group" key={field}>
                  <label>{label}</label>
                  <select value={form[field] || ''} onChange={e => set(field, e.target.value)}>
                    <option value="">-- Select --</option>
                    {opts.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Map Location */}
        <div className="form-card">
          <div className="form-card-header">
            <i className="fas fa-map"></i> Pin Location on Map
            {mapData.lat && (
              <span className="badge badge-primary" style={{ marginLeft: 'auto', fontSize: '.75rem' }}>
                Pinned: {mapData.lat.toFixed(5)}, {mapData.lng.toFixed(5)}
              </span>
            )}
          </div>
          <div className="form-card-body">
            <MapPicker
              lat={mapData.lat}
              lng={mapData.lng}
              polygon={mapData.polygon}
              onChange={setMapData}
            />
          </div>
        </div>

        {/* Property & Income */}
        <div className="form-card">
          <div className="form-card-header"><i className="fas fa-building"></i> Property &amp; Income</div>
          <div className="form-card-body">
            <div className="form-grid">
              <div className="form-group">
                <label><i className="fas fa-house-chimney" style={{color:'var(--primary)'}}></i> Immovable Property</label>
                <input type="text" value={form.immovable_property} onChange={e => set('immovable_property', e.target.value)} maxLength={255} />
              </div>
              <div className="form-group">
                <label><i className="fas fa-tractor" style={{color:'var(--primary)'}}></i> Movable Property</label>
                <input type="text" value={form.movable_property} onChange={e => set('movable_property', e.target.value)} maxLength={255} />
              </div>
              <div className="form-group">
                <label><i className="fas fa-arrow-trend-up" style={{color:'var(--success)'}}></i> Monthly Income (₹)</label>
                <input type="number" value={form.income} onChange={e => set('income', e.target.value)} min={0} />
              </div>
              <div className="form-group">
                <label><i className="fas fa-arrow-trend-down" style={{color:'var(--danger)'}}></i> Monthly Expenditure (₹)</label>
                <input type="number" value={form.expenditure} onChange={e => set('expenditure', e.target.value)} min={0} />
              </div>
              <div className="form-group">
                <label><i className="fas fa-wallet" style={{color:'var(--warning)'}}></i> Salary / Earnings (₹)</label>
                <input type="number" value={form.salary} onChange={e => set('salary', e.target.value)} min={0} />
              </div>
            </div>
          </div>
        </div>

        {/* Family */}
        <div className="form-card">
          <FamilyTable members={family} onChange={setFamily} />
        </div>

        {/* Photo */}
        <div className="form-card">
          <div className="form-card-header">
            <span><i className="fas fa-camera"></i> Update Photo</span>
            <div className="tab-switcher">
              <button type="button" className={`tab-btn${photoTab==='file'?' active':''}`} onClick={() => setPhotoTab('file')}>
                <i className="fas fa-upload"></i> Upload
              </button>
              <button type="button" className={`tab-btn${photoTab==='cam'?' active':''}`} onClick={() => setPhotoTab('cam')}>
                <i className="fas fa-camera"></i> Capture
              </button>
            </div>
          </div>
          <div className="form-card-body">
            {photoTab === 'file' ? (
              <div className="form-grid">
                <div className="form-group">
                  <label>Current Photo</label>
                  {photoUrl
                    ? <div className="photo-overlay-wrap" style={{maxWidth:'200px'}}><img src={photoUrl} className="webcam-preview-img" alt="Current" /><span className="photo-hno-badge">H/No {rec.house_no || '—'}</span></div>
                    : <div style={{width:'120px',height:'120px',background:'var(--primary-soft)',borderRadius:'var(--radius)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'2.5rem',color:'var(--primary)'}}><i className="fas fa-user"></i></div>
                  }
                </div>
                <div className="form-group">
                  <label>Replace Photo (JPG/PNG, max 5 MB)</label>
                  <div className="upload-zone" onClick={() => photoRef.current?.click()}>
                    <input ref={photoRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" style={{display:'none'}}
                      onChange={e => { const f = e.target.files[0]; if(f){setPhotoFile(f); setPhotoName(f.name);} }} />
                    <div className="upload-icon"><i className="fas fa-image"></i></div>
                    <p>Leave blank to keep current photo</p>
                    <div className="file-name">{photoName}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="form-grid">
                <div className="form-group">
                  <label>Take New Photo via Webcam</label>
                  <WebcamCapture onCapture={setPhotoB64} houseNo={form.house_no} />
                </div>
                <div className="form-group">
                  <label style={{visibility:'hidden'}}>Tips</label>
                  <div className="info-box">
                    <strong>Tips for best results</strong><br/>
                    • Ensure good, even lighting<br/>• Face the camera directly<br/>
                    • Plain background preferred<br/><br/>
                    Capturing will replace the current photo.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Document */}
        <div className="form-card">
          <div className="form-card-header">
            <span><i className="fas fa-file-arrow-up"></i> Update Document</span>
            <div className="tab-switcher">
              <button type="button" className={`tab-btn${docTab==='file'?' active':''}`} onClick={() => setDocTab('file')}>
                <i className="fas fa-upload"></i> Upload
              </button>
              <button type="button" className={`tab-btn${docTab==='cam'?' active':''}`} onClick={() => setDocTab('cam')}>
                <i className="fas fa-camera"></i> Capture
              </button>
            </div>
          </div>
          <div className="form-card-body">
            {docTab === 'file' ? (
              <div className="form-grid">
                <div className="form-group">
                  <label>Current Document</label>
                  {docUrl
                    ? <a href={docUrl} target="_blank" rel="noreferrer" className="btn btn-outline-primary btn-sm"><i className="fas fa-file"></i> View Current Document</a>
                    : <span style={{color:'var(--text-muted)',fontSize:'.875rem'}}>No document attached</span>
                  }
                </div>
                <div className="form-group">
                  <label>Replace Document (PDF/Image, max 10 MB)</label>
                  <div className="upload-zone" onClick={() => docRef.current?.click()}>
                    <input ref={docRef} type="file" accept="application/pdf,image/jpeg,image/png" style={{display:'none'}}
                      onChange={e => { const f = e.target.files[0]; if(f){setDocFile(f); setDocName(f.name);} }} />
                    <div className="upload-icon"><i className="fas fa-file-pdf"></i></div>
                    <p>Leave blank to keep current</p>
                    <div className="file-name">{docName}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="form-grid">
                <div className="form-group">
                  <label>Capture Document via Camera</label>
                  <WebcamCapture onCapture={setDocB64} wide />
                </div>
                <div className="form-group">
                  <label style={{visibility:'hidden'}}>Tips</label>
                  <div className="info-box">Lay document flat with good lighting for best capture quality.</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="form-actions-bar">
          <button type="submit" className="btn btn-primary btn-lg" disabled={busy}>
            {busy ? <><span className="spinner"></span> Updating…</> : <><i className="fas fa-floppy-disk"></i> Update Record</>}
          </button>
          <Link to="/dashboard/update" className="btn btn-secondary">
            <i className="fas fa-xmark"></i> Cancel
          </Link>
        </div>
      </form>
    </>
  );
}
