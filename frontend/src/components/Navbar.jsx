import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const NAV_ITEMS = [
  { key: '',        path: '/dashboard',         icon: 'fa-house',         label: 'Dashboard' },
  { key: 'add',     path: '/dashboard/add',     icon: 'fa-user-plus',     label: 'Add Data' },
  { key: 'update',  path: '/dashboard/update',  icon: 'fa-pen-to-square', label: 'Update / Delete' },
  { key: 'view',    path: '/dashboard/view',    icon: 'fa-table-list',    label: 'View Data' },
  { key: 'news',    path: '/dashboard/news',    icon: 'fa-newspaper',     label: 'News' },
  { key: 'weather', path: '/dashboard/weather', icon: 'fa-cloud-sun',     label: 'Weather' },
  { key: 'about',   path: '/dashboard/about',   icon: 'fa-circle-info',   label: 'About' },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const showToast        = useToast();
  const navigate         = useNavigate();
  const location         = useLocation();
  const [open, setOpen]  = useState(false);

  const initials = (user?.user_name || 'A')
    .split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

  const handleLogout = async () => {
    await logout();
    showToast('Logged out successfully.', 'success');
    navigate('/');
  };

  const isActive = (path) => {
    if (path === '/dashboard') return location.pathname === '/dashboard';
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="navbar" id="mainNav">
      <div className="nav-container">
        <Link to="/dashboard" className="nav-brand">
          <div className="nav-brand-icon"><i className="fas fa-shield-halved"></i></div>
          <span>Civilian&nbsp;DBMS</span>
        </Link>

        <button className="nav-toggle" id="navToggle" onClick={() => setOpen(o => !o)} aria-label="Toggle menu">
          <span /><span /><span />
        </button>

        <ul className={`nav-links${open ? ' open' : ''}`} id="navLinks">
          {NAV_ITEMS.map(item => (
            <li key={item.key}>
              <Link
                to={item.path}
                className={`nav-link${isActive(item.path) ? ' active' : ''}`}
                onClick={() => setOpen(false)}
              >
                <i className={`fas ${item.icon}`}></i> {item.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="nav-user">
          <div className="nav-user-avatar">{initials}</div>
          <span className="nav-user-name">{user?.user_name}</span>
          <button className="btn-logout" onClick={handleLogout}>
            <i className="fas fa-power-off"></i> Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
