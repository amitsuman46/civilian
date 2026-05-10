import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API from '../api';

export default function Login() {
  const { login }    = useAuth();
  const navigate     = useNavigate();
  const [form, setForm]   = useState({ user_id: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy]   = useState(false);
  const [showPw, setShowPw] = useState(false);

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async e => {
    e.preventDefault();
    if (!form.user_id || !form.password) {
      setError('Please enter both User ID and Password.');
      return;
    }
    setBusy(true); setError('');
    try {
      const data = await API.post('/api/login', form);
      if (data.success) {
        login(data.user);
        navigate('/dashboard');
      } else {
        setError(data.message || 'Invalid credentials.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-body">
      <div className="login-wrapper">
        <div className="login-card">
          <div className="login-brand">
            <div className="login-logo"><i className="fas fa-shield-halved"></i></div>
            <h1>Civilian DBMS</h1>
            <p>Secure Administration Portal</p>
          </div>

          {error && (
            <div className="alert alert-danger" style={{ marginBottom: '1.25rem' }}>
              <i className="fas fa-circle-exclamation"></i> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group" style={{ marginBottom: '1.1rem' }}>
              <label style={{ display:'flex', alignItems:'center', gap:'.4rem', fontSize:'.7rem', fontWeight:800, textTransform:'uppercase', letterSpacing:'.08em', color:'#334155', marginBottom:'.45rem' }}>
                <i className="fas fa-user" style={{ color:'var(--primary)' }}></i> User ID
              </label>
              <input
                type="text" name="user_id"
                placeholder="Enter your User ID"
                value={form.user_id}
                onChange={handleChange}
                autoComplete="username"
                style={{ fontSize:'.95rem', padding:'.72rem 1rem' }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label style={{ display:'flex', alignItems:'center', gap:'.4rem', fontSize:'.7rem', fontWeight:800, textTransform:'uppercase', letterSpacing:'.08em', color:'#334155', marginBottom:'.45rem' }}>
                <i className="fas fa-lock" style={{ color:'var(--primary)' }}></i> Password
              </label>
              <div className="input-icon-right">
                <input
                  type={showPw ? 'text' : 'password'} name="password"
                  placeholder="Enter your Password"
                  value={form.password}
                  onChange={handleChange}
                  autoComplete="current-password"
                  style={{ fontSize:'.95rem', padding:'.72rem 1rem', paddingRight:'2.75rem' }}
                />
                <button type="button" className="toggle-pass" onClick={() => setShowPw(p => !p)} tabIndex={-1}>
                  <i className={`fas ${showPw ? 'fa-eye-slash' : 'fa-eye'}`} id="eyeIcon"></i>
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-block btn-lg"
              disabled={busy}
              style={{ fontSize:'.9rem', fontWeight:800, letterSpacing:'.03em', padding:'.8rem' }}
            >
              {busy
                ? <><span className="spinner"></span>&nbsp; Signing In…</>
                : <><i className="fas fa-right-to-bracket"></i>&nbsp; Sign In to Dashboard</>
              }
            </button>
          </form>

          <div className="login-footer" style={{ marginTop:'1.5rem', paddingTop:'1.25rem', borderTop:'1px solid var(--border)' }}>
            <span>CONTACT THE ADMIN</span>
          </div>
        </div>

        <div style={{ textAlign:'center', marginTop:'1.25rem', fontSize:'.72rem', fontWeight:600, color:'rgba(255,255,255,.3)', letterSpacing:'.06em', textTransform:'uppercase' }}>
          Civilian DBMS &nbsp;v2.0 &nbsp;·&nbsp; Secure Cloud Deployment
        </div>
      </div>
    </div>
  );
}
