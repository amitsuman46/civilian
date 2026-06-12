import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider }         from './context/ToastContext';
import { ConfirmProvider }       from './context/ConfirmContext';

import Login         from './pages/Login';
import Dashboard     from './pages/Dashboard';
import Home          from './pages/Home';
import AddData       from './pages/AddData';
import ViewData      from './pages/ViewData';
import CivilDirectory from './pages/CivilDirectory';
import DirectoryForm  from './pages/DirectoryForm';
import UpdateDelete  from './pages/UpdateDelete';
import EditRecord    from './pages/EditRecord';
import FullReport    from './pages/FullReport';
import BulkHouse     from './pages/BulkHouse';
import About         from './pages/About';
import News          from './pages/News';
import Weather       from './pages/Weather';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}><div className="loading-spinner"></div></div>;
  return user ? children : <Navigate to="/" replace />;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/dashboard" replace /> : children;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <ConfirmProvider>
            <Routes>
              <Route path="/" element={<PublicRoute><Login /></PublicRoute>} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>}>
                <Route index          element={<Home />} />
                <Route path="add"     element={<AddData />} />
                <Route path="view"    element={<ViewData />} />
                <Route path="directory" element={<CivilDirectory />} />
                <Route path="directory/add" element={<DirectoryForm />} />
                <Route path="directory/edit/:id" element={<DirectoryForm />} />
                <Route path="update"  element={<UpdateDelete />} />
                <Route path="edit/:id"   element={<EditRecord />} />
                <Route path="report/:id" element={<FullReport />} />
                <Route path="houseno"    element={<BulkHouse />} />
                <Route path="news"       element={<News />} />
                <Route path="weather"    element={<Weather />} />
                <Route path="about"      element={<About />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ConfirmProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
