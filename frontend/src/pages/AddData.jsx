import { useState, useRef, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import FamilyTable    from '../components/FamilyTable';
import WebcamCapture  from '../components/WebcamCapture';
import MapPicker      from '../components/MapPicker';
import { useToast }   from '../context/ToastContext';
import { useAuth }    from '../context/AuthContext';
import API from '../api';

const OCCUPATIONS    = ['Farmer','Teacher','Engineer','Doctor','Businessman','Driver','Tailor','Nurse','Homemaker','Labourer','Government Employee','Self-Employed','Student','Retired','Other'];
const AREAS          = ['Saujiya','Poonch','Rajouri','Mendhar','Krishna Ghati'];
const COMMUNITIES    = ['Dogras','Gujjars','Bakarwals','Paharis','Others'];
const RELIGIONS      = ['Islam','Hinduism','Sikhism','Christianity','Buddhism','Jainism','Other'];

const EMPTY = {
  house_no:'', name:'', mobile:'', village:'', area:'', occupation:'',
  community:'', religion:'',
  immovable_property:'', movable_property:'', income:'', expenditure:'', salary:'',
  formation:'', unit:'',
};

export default function AddData() {
  const navigate   = useNavigate();
  const showToast  = useToast();
  const { user }   = useAuth();

  const unitDefaults = useMemo(() => ({
    formation: user?.formation || '',
    unit: user?.unit || user?.user_id || '',
  }), [user]);

  const [form, setForm]         = useState(EMPTY);
  const [family, setFamily]     = useState([]);
  const [photoFile, setPhotoFile]   = useState(null);
  const [docFile, setDocFile]       = useState(null);
  const [photoB64, setPhotoB64]     = useState(null);
  const [docB64, setDocB64]         = useState(null);
  const [photoTab, setPhotoTab]     = useState('file');
  const [docTab, setDocTab]         = useState('file');
  const [photoFileName, setPhotoFileName] = useState('No file chosen');
  const [docFileName, setDocFileName]     = useState('No file chosen');
  const [filePreviewSrc, setFilePreviewSrc] = useState(null);
  const [mapData, setMapData]   = useState({ lat: null, lng: null, polygon: null });
  const [errors, setErrors]     = useState({});
  const [busy, setBusy]         = useState(false);

  const photoInputRef = useRef(null);
  const docInputRef   = useRef(null);

  useEffect(() => {
    if (!user) return;
    setForm(f => ({
      ...f,
      formation: user.formation || '',
      unit: user.unit || user.user_id || '',
    }));
  }, [user]);

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }));

  const validate = () => {
    const e = {};
    if (!form.house_no.trim()) e.house_no = 'House No is required.';
    if (!form.name.trim())     e.name     = 'Name is required.';
    if (!form.mobile.trim())   e.mobile   = 'Contact number is required.';
    else if (!/^[6-9]\d{9}$/.test(form.mobile.trim())) e.mobile = 'Enter a valid 10-digit Indian mobile number.';
    setErrors(e);
    if (Object.keys(e).length > 0) {
      showToast(Object.values(e)[0], 'error');
      return false;
    }
    return true;
  };

  const handlePhotoFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoFileName(file.name);
    const reader = new FileReader();
    reader.onload = ev => setFilePreviewSrc(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleDocFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setDocFile(file);
    setDocFileName(file.name);
  };

  const switchPhotoTab = (tab) => {
    setPhotoTab(tab);
    if (tab === 'file') { setPhotoB64(null); }
  };

  const switchDocTab = (tab) => {
    setDocTab(tab);
    if (tab === 'file') { setDocB64(null); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setBusy(true);
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    fd.append('family_details', JSON.stringify(family.filter(m => m.name.trim())));
    if (mapData.lat !== null) fd.append('lat', mapData.lat);
    if (mapData.lng !== null) fd.append('lng', mapData.lng);
    if (mapData.polygon)      fd.append('polygon', JSON.stringify(mapData.polygon));

    // Photo priority: webcam base64 > file upload
    if (photoB64) fd.append('photo_base64', photoB64);
    else if (photoFile) fd.append('photo_file', photoFile);

    // Doc priority: webcam base64 > file upload
    if (docB64) fd.append('doc_base64', docB64);
    else if (docFile) fd.append('document_file', docFile);

    try {
      const data = await API.post('/api/civilians', fd);
      if (data.success) {
        showToast('Record saved successfully! Redirecting to report…', 'success');
        setTimeout(() => navigate(`/dashboard/report/${data.id}`), 1200);
      } else {
        showToast(data.message || 'Save failed.', 'error');
      }
    } catch {
      showToast('Network error. Please try again.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const resetForm = () => {
    setForm({ ...EMPTY, ...unitDefaults });
    setFamily([]);
    setMapData({ lat: null, lng: null, polygon: null });
    setPhotoFile(null); setDocFile(null);
    setPhotoB64(null); setDocB64(null);
    setPhotoFileName('No file chosen');
    setDocFileName('No file chosen');
    setFilePreviewSrc(null);
    setPhotoTab('file'); setDocTab('file');
    setErrors({});
    if (photoInputRef.current) photoInputRef.current.value = '';
    if (docInputRef.current)   docInputRef.current.value   = '';
  };

  const ErrMsg = ({ field }) => errors[field]
    ? <span className="field-error">{errors[field]}</span> : null;

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title"><i className="fas fa-user-plus"></i> Add New Civilian Record</div>
          <div className="page-subtitle">Fill in all required fields to register a new civilian</div>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        {/* SECTION 1 — Basic Identification */}
        <div className="form-card">
          <div className="form-card-header"><i className="fas fa-hashtag"></i> Basic Identification</div>
          <div className="form-card-body">
            <div className="form-grid three">
              <div className="form-group">
                <label>Formation</label>
                <input type="text" value={form.formation} readOnly className="readonly-field"
                  placeholder="Set on your user account" />
              </div>
              <div className="form-group">
                <label>Unit</label>
                <input type="text" value={form.unit} readOnly className="readonly-field"
                  placeholder="Set on your user account" />
              </div>
              <div className="form-group">
                <label>House No <span className="req">*</span></label>
                <input type="text" value={form.house_no} onChange={e => set('house_no', e.target.value)}
                  placeholder="e.g. 01" maxLength={20} className={errors.house_no ? 'invalid' : ''} />
                <ErrMsg field="house_no" />
              </div>
              <div className="form-group">
                <label>Head of the Family (Name) <span className="req">*</span></label>
                <input type="text" value={form.name} onChange={e => set('name', e.target.value)}
                  placeholder="e.g. Mohd Zaman" maxLength={100} className={errors.name ? 'invalid' : ''} />
                <ErrMsg field="name" />
              </div>
              <div className="form-group">
                <label>Contact No <span className="req">*</span></label>
                <input type="tel" value={form.mobile} onChange={e => set('mobile', e.target.value)}
                  placeholder="10-digit mobile" maxLength={15} className={errors.mobile ? 'invalid' : ''} />
                <ErrMsg field="mobile" />
              </div>
            </div>
          </div>
        </div>
        <div className="form-card">
          <div className="form-card-header"><i className="fas fa-map-marker-alt"></i> Location &amp; Personal Details</div>
          <div className="form-card-body">
            <div className="form-grid three">
              <div className="form-group">
                <label>Village / Town</label>
                <input
                  type="text"
                  value={form.village}
                  onChange={e => set('village', e.target.value)}
                  placeholder="e.g. Sawjian"
                  maxLength={100}
                />
              </div>
              {[
                { label:'Area / Zone',    field:'area',    opts: AREAS },
                { label:'Occupation',     field:'occupation', opts: OCCUPATIONS },
                { label:'Community',      field:'community',  opts: COMMUNITIES },
                { label:'Religion',       field:'religion',   opts: RELIGIONS },
              ].map(({ label, field, opts }) => (
                <div className="form-group" key={field}>
                  <label>{label}</label>
                  <select value={form[field]} onChange={e => set(field, e.target.value)}>
                    <option value="">-- Select --</option>
                    {opts.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* SECTION 2b — Map Location */}
        <div className="form-card">
          <div className="form-card-header">
            <i className="fas fa-map"></i> Pin Location on Map
            <span style={{ fontSize: '.8rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: 'auto' }}>
              Optional — drop a pin or draw a plot boundary
            </span>
          </div>
          <div className="form-card-body">
            <MapPicker lat={null} lng={null} polygon={null} onChange={setMapData} />
          </div>
        </div>

        {/* SECTION 3 — Property & Income */}
        <div className="form-card">
          <div className="form-card-header"><i className="fas fa-building"></i> Property &amp; Income Details</div>
          <div className="form-card-body">
            <div className="form-grid">
              <div className="form-group">
                <label><i className="fas fa-house-chimney" style={{color:'var(--primary)'}}></i> Immovable Property</label>
                <input type="text" value={form.immovable_property} onChange={e => set('immovable_property', e.target.value)}
                  placeholder="e.g. 2 Houses and 2 Kanal of Land" maxLength={255} />
              </div>
              <div className="form-group">
                <label><i className="fas fa-tractor" style={{color:'var(--primary)'}}></i> Movable Property</label>
                <input type="text" value={form.movable_property} onChange={e => set('movable_property', e.target.value)}
                  placeholder="e.g. 01 x Cow and 01 x Goat" maxLength={255} />
              </div>
              <div className="form-group">
                <label><i className="fas fa-arrow-trend-up" style={{color:'var(--success)'}}></i> Monthly Income (₹)</label>
                <input type="number" value={form.income} onChange={e => set('income', e.target.value)} placeholder="e.g. 7000" min={0} />
              </div>
              <div className="form-group">
                <label><i className="fas fa-arrow-trend-down" style={{color:'var(--danger)'}}></i> Monthly Expenditure (₹)</label>
                <input type="number" value={form.expenditure} onChange={e => set('expenditure', e.target.value)} placeholder="e.g. 5000" min={0} />
              </div>
              <div className="form-group">
                <label><i className="fas fa-wallet" style={{color:'var(--warning)'}}></i> Total Salary / Earnings (₹)</label>
                <input type="number" value={form.salary} onChange={e => set('salary', e.target.value)} placeholder="e.g. 25000" min={0} />
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 4 — Family Members */}
        <div className="form-card">
          <FamilyTable members={family} onChange={setFamily} />
        </div>

        {/* SECTION 5 — Photo */}
        <div className="form-card">
          <div className="form-card-header">
            <span><i className="fas fa-camera"></i> Civilian Photo</span>
            <div className="tab-switcher">
              <button type="button" className={`tab-btn${photoTab==='file'?' active':''}`} onClick={() => switchPhotoTab('file')}>
                <i className="fas fa-upload"></i> Upload
              </button>
              <button type="button" className={`tab-btn${photoTab==='cam'?' active':''}`} onClick={() => switchPhotoTab('cam')}>
                <i className="fas fa-camera"></i> Capture
              </button>
            </div>
          </div>
          <div className="form-card-body">
            {photoTab === 'file' ? (
              <div className="form-grid">
                <div className="form-group">
                  <label>Upload Photo (JPG/PNG, max 5 MB)</label>
                  <div className="upload-zone" onClick={() => photoInputRef.current?.click()}>
                    <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={handlePhotoFileChange} style={{display:'none'}} />
                    <div className="upload-icon"><i className="fas fa-image"></i></div>
                    <p>Click to browse or drag &amp; drop</p>
                    <div className="file-name">{photoFileName}</div>
                  </div>
                  {filePreviewSrc && (
                    <div className="photo-overlay-wrap" style={{marginTop:'.75rem', maxWidth:'200px'}}>
                      <img src={filePreviewSrc} className="webcam-preview-img" alt="Preview" />
                      <span className="photo-hno-badge">H/No {form.house_no || '—'}</span>
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label style={{visibility:'hidden'}}>Info</label>
                  <div className="info-box">
                    <strong>Accepted formats</strong><br/>
                    • JPG / PNG / GIF / WebP<br/>• Max file size: 5 MB<br/><br/>
                    Use the <strong>Capture</strong> tab to take a live photo using your webcam.
                  </div>
                </div>
              </div>
            ) : (
              <div className="form-grid">
                <div className="form-group">
                  <label>Capture via Webcam</label>
                  <WebcamCapture onCapture={setPhotoB64} houseNo={form.house_no} />
                </div>
                <div className="form-group">
                  <label style={{visibility:'hidden'}}>Tips</label>
                  <div className="info-box">
                    <strong>Tips for best results</strong><br/>
                    • Ensure good, even lighting<br/>• Face the camera directly<br/>
                    • Plain background preferred<br/>• Hold still before capturing<br/><br/>
                    Captured image is saved as JPG.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* SECTION 6 — Document */}
        <div className="form-card">
          <div className="form-card-header">
            <span><i className="fas fa-file-arrow-up"></i> Document Upload</span>
            <div className="tab-switcher">
              <button type="button" className={`tab-btn${docTab==='file'?' active':''}`} onClick={() => switchDocTab('file')}>
                <i className="fas fa-upload"></i> File Upload
              </button>
              <button type="button" className={`tab-btn${docTab==='cam'?' active':''}`} onClick={() => switchDocTab('cam')}>
                <i className="fas fa-camera"></i> Capture
              </button>
            </div>
          </div>
          <div className="form-card-body">
            {docTab === 'file' ? (
              <div className="form-grid">
                <div className="form-group">
                  <label>Upload Document (PDF / Image, max 10 MB)</label>
                  <div className="upload-zone" onClick={() => docInputRef.current?.click()}>
                    <input ref={docInputRef} type="file" accept="application/pdf,image/jpeg,image/png" onChange={handleDocFileChange} style={{display:'none'}} />
                    <div className="upload-icon"><i className="fas fa-file-pdf"></i></div>
                    <p>Click to browse — PDF, JPG, PNG</p>
                    <div className="file-name">{docFileName}</div>
                  </div>
                </div>
                <div className="form-group">
                  <label style={{visibility:'hidden'}}>Info</label>
                  <div className="info-box">
                    <strong>Accepted formats</strong><br/>
                    • PDF documents (any size)<br/>• JPG / PNG images<br/>• Max file size: 10 MB<br/><br/>
                    Use the <strong>Capture</strong> tab to photograph a physical document.
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
                  <div className="info-box">
                    <strong>Tips for best results</strong><br/>
                    • Place document flat on a table<br/>• Ensure good, even lighting<br/>
                    • Avoid shadows on the document<br/>• Keep camera steady before capturing<br/><br/>
                    Captured image is saved as JPG.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="form-actions-bar">
          <button type="submit" className="btn btn-primary btn-lg" disabled={busy}>
            {busy ? <><span className="spinner"></span> Saving…</> : <><i className="fas fa-floppy-disk"></i> Save Record</>}
          </button>
          <button type="button" className="btn btn-secondary" onClick={resetForm}>
            <i className="fas fa-rotate-left"></i> Reset Form
          </button>
        </div>
      </form>
    </>
  );
}
