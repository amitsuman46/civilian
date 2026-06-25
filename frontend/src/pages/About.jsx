import { useEffect, useState } from 'react';
import API from '../api';

const CAPS = [
  ['fa-user-plus',        'Civilian Registration',    'Full household profiles — identity, location, property, income, health and family members'],
  ['fa-camera',           'Photo & Document Capture', 'Webcam capture or file upload for photos and identity documents'],
  ['fa-chart-bar',        'Analytics Dashboard',      'Live charts for daily, monthly, area-wise and village-wise registration trends'],
  ['fa-magnifying-glass', 'Instant Search',           'Real-time search across all fields with fast filtering and sorting'],
  ['fa-pen-to-square',    'Edit & Update Records',    'Pre-filled forms for quick updates with safe confirm-before-delete workflow'],
  ['fa-print',            'Print-Ready Reports',      'Full civilian profile reports formatted for printing or physical filing'],
];

const INFO = [
  ['Version',    'v 2.0 — Stable'],
  ['Platform',   'Node.js / Express on any OS'],
  ['Database',   'MySQL (mysql2)'],
  ['Interface',  'Web-based — React SPA'],
  ['Deployment', 'Local / Self-hosted'],
  ['Responsive', 'Yes — desktop, tablet and mobile'],
  ['Released',   String(new Date().getFullYear())],
];

const SEC_PILLS = [
  'Session-based authentication', 'SQL injection prevention (parameterized queries)',
  'MIME-verified file uploads', 'No public registration',
  'Local-only data storage', 'React XSS protection',
];

export default function About() {
  const [total, setTotal] = useState(0);
  const [today, setToday] = useState(0);

  useEffect(() => {
    API.get('/api/stats').then(data => {
      if (data.success) {
        setTotal(data.kpi?.total ?? 0);
        setToday(data.kpi?.today ?? 0);
      }
    });
  }, []);

  return (
    <div className="about-wrap">
      {/* Identity */}
      <div className="about-identity">
        <div className="about-identity-icon"><i className="fas fa-shield-halved"></i></div>
        <div className="about-identity-text">
          <div className="about-identity-title">Digital Demographic Profiling</div>
          <div className="about-identity-sub">
            A secure, field-ready platform for registering and managing civilian records —
            built for local administrators, field officers, and community workers.
          </div>
        </div>
      </div>

      {/* Live stats */}
      <div className="about-stats">
        <div className="about-stat">
          <div className="about-stat-val">{total.toLocaleString()}</div>
          <div className="about-stat-label">Records on File</div>
        </div>
        <div className="about-stat">
          <div className="about-stat-val">{today.toLocaleString()}</div>
          <div className="about-stat-label">Added Today</div>
        </div>
        <div className="about-stat">
          <div className="about-stat-val">v 2.0</div>
          <div className="about-stat-label">Current Version</div>
        </div>
      </div>

      {/* Capabilities */}
      <div className="about-section-title"><i className="fas fa-list-check"></i> Capabilities</div>
      <div className="about-caps">
        {CAPS.map(([icon, title, desc]) => (
          <div className="about-cap" key={title}>
            <div className="about-cap-icon"><i className={`fas ${icon}`}></i></div>
            <div>
              <div className="about-cap-title">{title}</div>
              <div className="about-cap-desc">{desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Security */}
      <div className="about-section-title"><i className="fas fa-lock"></i> Security</div>
      <div className="about-security">
        {SEC_PILLS.map(pill => (
          <span className="about-sec-pill" key={pill}>
            <i className="fas fa-check"></i> {pill}
          </span>
        ))}
      </div>

      {/* System info */}
      <div className="about-section-title"><i className="fas fa-circle-info"></i> System Information</div>
      <div className="about-info-table">
        {INFO.map(([k, v]) => (
          <div className="about-info-row" key={k}>
            <span className="about-info-key">{k}</span>
            <span className="about-info-val">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
