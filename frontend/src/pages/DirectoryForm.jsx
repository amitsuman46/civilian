import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import API from '../api';
import {
  DIRECTORY_DESIGNATIONS,
} from '../constants/directoryOptions';

const EMPTY = { name: '', mobile: '', designation: '', village: '', area: '' };

export default function DirectoryForm() {
  const { id }     = useParams();
  const isEdit     = Boolean(id);
  const navigate   = useNavigate();
  const showToast  = useToast();

  const [form, setForm]     = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(isEdit);
  const [busy, setBusy]     = useState(false);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    setLoading(true);
    API.get(`/api/directory/${id}`).then(data => {
      if (!data.success) {
        showToast(data.message || 'Entry not found.', 'error');
        navigate('/dashboard/directory');
        return;
      }
      if (!data.record.can_edit) {
        setForbidden(true);
        setLoading(false);
        return;
      }
      const r = data.record;
      setForm({
        name: r.name || '',
        mobile: r.mobile || '',
        designation: r.designation || '',
        village: r.village || '',
        area: r.area || '',
      });
      setLoading(false);
    });
  }, [id, isEdit, navigate, showToast]);

  const set = (field, value) => {
    setForm(f => ({ ...f, [field]: value }));
    setErrors(e => ({ ...e, [field]: '' }));
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required.';
    if (!form.mobile.trim()) e.mobile = 'Contact number is required.';
    else if (!/^[6-9]\d{9}$/.test(form.mobile.trim())) e.mobile = 'Enter a valid 10-digit mobile number.';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleSubmit = async ev => {
    ev.preventDefault();
    if (!validate()) return;
    setBusy(true);
    try {
      const body = {
        name: form.name.trim(),
        mobile: form.mobile.trim(),
        designation: form.designation.trim() || null,
        village: form.village.trim() || null,
        area: form.area.trim() || null,
      };
      const data = isEdit
        ? await API.put(`/api/directory/${id}`, body)
        : await API.post('/api/directory', body);
      if (data.success) {
        showToast(data.message || (isEdit ? 'Entry updated.' : 'Entry added.'), 'success');
        navigate('/dashboard/directory');
      } else {
        showToast(data.message || 'Save failed.', 'error');
      }
    } catch {
      showToast('Network error. Please try again.', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center' }}>
        <div className="loading-spinner" style={{ margin: '0 auto' }}></div>
      </div>
    );
  }

  if (forbidden) return (
    <div className="alert alert-warning">
      <i className="fas fa-lock"></i> You can only edit directory entries you created.{' '}
      <Link to="/dashboard/directory">Back to Civil Directory</Link>
    </div>
  );

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">
            <i className="fas fa-address-book"></i>
            {isEdit ? 'Edit Directory Entry' : 'Add Directory Entry'}
          </div>
          <div className="page-subtitle">
            {isEdit ? 'Update civilian directory information' : 'Add a new person to the civil directory'}
          </div>
        </div>
        <div className="page-actions">
          <Link to="/dashboard/directory" className="btn btn-secondary btn-sm">
            <i className="fas fa-arrow-left"></i> Back to Directory
          </Link>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="cdir-form">
        <div className="form-card">
          <div className="form-card-header">
            <i className="fas fa-user"></i> Civilian Information
          </div>
          <div className="form-card-body">
            <div className="form-grid">
              <div className="form-group">
                <label>Name <span className="req">*</span></label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                  placeholder="Full name"
                  maxLength={100}
                  className={errors.name ? 'invalid' : ''}
                />
                {errors.name && <div className="field-error">{errors.name}</div>}
              </div>
              <div className="form-group">
                <label>Contact Number <span className="req">*</span></label>
                <input
                  type="tel"
                  value={form.mobile}
                  onChange={e => set('mobile', e.target.value)}
                  placeholder="10-digit mobile"
                  maxLength={15}
                  className={errors.mobile ? 'invalid' : ''}
                />
                {errors.mobile && <div className="field-error">{errors.mobile}</div>}
              </div>
              <div className="form-group">
                <label>Designation</label>
                <input
                  type="text"
                  list="dir-designations"
                  value={form.designation}
                  onChange={e => set('designation', e.target.value)}
                  placeholder="e.g. Teacher, Farmer"
                  maxLength={100}
                />
                <datalist id="dir-designations">
                  {DIRECTORY_DESIGNATIONS.map(d => <option key={d} value={d} />)}
                </datalist>
              </div>
              <div className="form-group">
                <label>Village</label>
                <input
                  type="text"
                  value={form.village}
                  onChange={e => set('village', e.target.value)}
                  placeholder="e.g. Sawjian"
                  maxLength={100}
                />
              </div>
              <div className="form-group">
                <label>Area / Zone</label>
                <input
                  type="text"
                  value={form.area}
                  onChange={e => set('area', e.target.value)}
                  placeholder="e.g. Poonch"
                  maxLength={100}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="form-actions-bar">
          <Link to="/dashboard/directory" className="btn btn-secondary">Cancel</Link>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-check"></i>}
            {isEdit ? 'Save Changes' : 'Add to Directory'}
          </button>
        </div>
      </form>
    </>
  );
}
