import { Outlet, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';

const PAGE_TITLES = {
  '/dashboard':         'Dashboard',
  '/dashboard/add':     'Add Data',
  '/dashboard/view':    'View Data',
  '/dashboard/update':  'Update / Delete',
  '/dashboard/houseno': 'Assign House No',
  '/dashboard/about':   'About',
  '/dashboard/weather': 'Weather',
};

function getTitle(pathname) {
  if (pathname.startsWith('/dashboard/report/')) return 'Full Report';
  if (pathname.startsWith('/dashboard/edit/'))   return 'Edit Record';
  return PAGE_TITLES[pathname] || 'Dashboard';
}

export default function Dashboard() {
  const location = useLocation();
  const title    = getTitle(location.pathname);
  const isHome   = location.pathname === '/dashboard';

  return (
    <div style={{ display:'flex', flexDirection:'column', minHeight:'100vh' }}>
      <Navbar />

      {/* Breadcrumb */}
      <div className="breadcrumb-bar">
        <div className="container">
          <i className="fas fa-house" style={{ fontSize:'.7rem', color:'var(--text-muted)' }}></i>
          <span>Home</span>
          {!isHome && (
            <>
              <span className="bc-sep"><i className="fas fa-chevron-right"></i></span>
              <span className="bc-current">{title}</span>
            </>
          )}
        </div>
      </div>

      {/* Page content */}
      <main className="main-content" style={{ flex: 1 }}>
        <div className="container">
          <Outlet />
        </div>
      </main>

      {/* Footer */}
      <footer className="site-footer">
        <div className="container">
          &copy; {new Date().getFullYear()} &nbsp;Civilian Database Management System &nbsp;·&nbsp; All Rights Reserved
        </div>
      </footer>
    </div>
  );
}
