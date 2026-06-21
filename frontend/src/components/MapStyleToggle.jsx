export default function MapStyleToggle({ value, onChange, className = '' }) {
  return (
    <div className={`tab-switcher map-style-toggle${className ? ` ${className}` : ''}`}>
      <button
        type="button"
        className={`tab-btn${value === 'normal' ? ' active' : ''}`}
        onClick={() => onChange('normal')}
      >
        <i className="fas fa-map"></i> Normal
      </button>
      <button
        type="button"
        className={`tab-btn${value === 'satellite' ? ' active' : ''}`}
        onClick={() => onChange('satellite')}
      >
        <i className="fas fa-satellite"></i> Satellite
      </button>
    </div>
  );
}
