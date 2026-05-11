import { useEffect, useState } from 'react';
import API from '../api';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function stripHtml(html) {
  return html ? html.replace(/<[^>]*>/g, '').trim() : '';
}

const GROUP_ORDER = ['Main', 'Cities', 'World', 'Blogs'];

export default function News() {
  const [feeds, setFeeds]       = useState([]);
  const [feedKey, setFeedKey]   = useState('jammu_kashmir');
  const [refreshKey, setRefreshKey] = useState(0);
  const [articles, setArticles] = useState([]);
  const [label, setLabel]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  // Load feed list once
  useEffect(() => {
    API.get('/api/news/feeds').then(data => {
      if (data.success) setFeeds(data.feeds);
    });
  }, []);

  // Fetch articles whenever feedKey or refreshKey changes
  useEffect(() => {
    setLoading(true);
    setError('');
    setArticles([]);

    API.get(`/api/news?feed=${feedKey}`).then(data => {
      setLoading(false);
      if (data.success) {
        setLabel(data.label);
        setArticles(data.items);
      } else {
        setError(data.message || 'Failed to load news.');
      }
    }).catch(() => {
      setLoading(false);
      setError('Network error. Please try again.');
    });
  }, [feedKey, refreshKey]);

  // Group feeds by group label (stable section order)
  const grouped = feeds.reduce((acc, f) => {
    (acc[f.group] = acc[f.group] || []).push(f);
    return acc;
  }, {});
  const sortedGroupEntries = Object.entries(grouped).sort(
    ([a], [b]) => (GROUP_ORDER.indexOf(a) === -1 ? 99 : GROUP_ORDER.indexOf(a))
               - (GROUP_ORDER.indexOf(b) === -1 ? 99 : GROUP_ORDER.indexOf(b))
  );

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title"><i className="fas fa-newspaper"></i> News Feed</div>
          <div className="page-subtitle">Latest headlines from Times of India{label ? ` — ${label}` : ''}</div>
        </div>
        <div className="page-actions">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '.85rem', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              <i className="fas fa-location-dot"></i> Region / Category
            </label>
            <select
              value={feedKey}
              onChange={e => setFeedKey(e.target.value)}
              className="form-input"
              style={{ minWidth: '180px', padding: '0.35rem 0.6rem', fontSize: '.85rem' }}
            >
              {sortedGroupEntries.map(([group, items]) => (
                <optgroup key={group} label={group}>
                  {items.map(f => (
                    <option key={f.key} value={f.key}>{f.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setRefreshKey(n => n + 1)}
              title="Refresh"
            >
              <i className={`fas fa-rotate-right${loading ? ' fa-spin' : ''}`}></i>
            </button>
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0', gap: '0.75rem', color: 'var(--text-muted)' }}>
          <div className="loading-spinner"></div>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="alert alert-danger">
          <i className="fas fa-triangle-exclamation"></i> {error}
        </div>
      )}

      {/* Articles grid */}
      {!loading && !error && articles.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
          {articles.map((item, i) => {
            const excerptPlain = item.description ? stripHtml(item.description) : '';
            return (
            <a
              key={i}
              href={item.link}
              target="_blank"
              rel="noreferrer noopener"
              style={{ textDecoration: 'none', color: 'inherit', display: 'flex' }}
            >
              <div className="card" style={{ display: 'flex', flexDirection: 'column', width: '100%', transition: 'box-shadow .15s, transform .15s', cursor: 'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,.1)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = ''; e.currentTarget.style.transform = ''; }}
              >
                {item.image && (
                  <div style={{ height: '170px', overflow: 'hidden', borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0', flexShrink: 0 }}>
                    <img
                      src={item.image}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={e => { e.target.parentElement.style.display = 'none'; }}
                    />
                  </div>
                )}
                <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                  <div style={{ fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--primary)' }}>
                    {label} &nbsp;·&nbsp; {timeAgo(item.pubDate)}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '.95rem', lineHeight: 1.4, color: 'var(--text)' }}>
                    {item.title}
                  </div>
                  {excerptPlain && (
                    <div style={{ fontSize: '.8rem', color: 'var(--text-muted)', lineHeight: 1.6, flex: 1 }}>
                      {excerptPlain.slice(0, 140)}{excerptPlain.length > 140 ? '…' : ''}
                    </div>
                  )}
                  <div style={{ fontSize: '.75rem', color: 'var(--primary)', fontWeight: 600, marginTop: 'auto' }}>
                    Read full story <i className="fas fa-arrow-up-right-from-square" style={{ fontSize: '.65rem' }}></i>
                  </div>
                </div>
              </div>
            </a>
            );
          })}
        </div>
      )}

      {/* Empty */}
      {!loading && !error && articles.length === 0 && (
        <div className="empty-state">
          <i className="fas fa-newspaper"></i>
          <h3>No articles found</h3>
          <p>Try selecting a different region or category.</p>
        </div>
      )}
    </>
  );
}
