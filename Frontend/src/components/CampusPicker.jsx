import { useEffect, useRef, useState } from 'react';
import { MapPin, X, Navigation, Loader2, Check, Search } from 'lucide-react';
import { useLocation } from '../store/LocationContext';
import './CampusBanner.css';

/**
 * Campus picker sheet. Shared by the Home location header and the
 * compact CampusBanner so choosing a campus behaves the same everywhere.
 */
export default function CampusPicker({ open, onClose }) {
  const { campus, setCampus, clearCampus, schools, loading, locStatus, autoDetect } = useLocation();
  const [q, setQ] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    setQ('');
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { clearTimeout(t); window.removeEventListener('keydown', onKey); };
  }, [open, onClose]);

  // Close once auto-detect lands on a campus.
  useEffect(() => {
    if (open && locStatus === 'granted' && campus) onClose();
  }, [open, locStatus, campus, onClose]);

  if (!open) return null;

  const needle = q.trim().toLowerCase();
  const filtered = needle
    ? schools.filter((s) => s.label.toLowerCase().includes(needle) || (s.city || '').toLowerCase().includes(needle))
    : schools;

  const pick = (school) => { setCampus(school); onClose(); };

  return (
    <div className="campus-overlay" onClick={onClose}>
      <div className="campus-sheet" role="dialog" aria-modal="true" aria-label="Choose your campus" onClick={(e) => e.stopPropagation()}>
        <div className="campus-sheet-h">
          <div>
            <strong>Where do you study?</strong>
            <p>We'll show listings you can pick up nearby.</p>
          </div>
          <button className="campus-sheet-close" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>

        <button className="campus-detect" onClick={autoDetect} disabled={locStatus === 'prompting'}>
          {locStatus === 'prompting'
            ? <><Loader2 size={16} className="spin" /> Finding your campus…</>
            : <><Navigation size={16} /> Use my current location</>}
        </button>
        {locStatus === 'granted' && !campus && (
          <p className="campus-note">We couldn't match your location to a campus. Pick one below.</p>
        )}
        {locStatus === 'denied' && (
          <p className="campus-note">Location is off for sBay. You can still pick your campus below.</p>
        )}

        <div className="campus-search-wrap">
          <Search size={16} aria-hidden />
          <input
            ref={inputRef}
            className="campus-search"
            placeholder="Search campus or city"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search campuses"
          />
        </div>

        <ul className="campus-list">
          {loading && <li className="campus-loading">Loading campuses…</li>}
          {!loading && filtered.length === 0 && (
            <li className="campus-loading">No campus matches “{q}”.</li>
          )}
          {filtered.map((school) => (
            <li key={school.id}>
              <button
                className={`campus-opt ${campus?.id === school.id ? 'active' : ''}`}
                onClick={() => pick(school)}
                aria-current={campus?.id === school.id}
              >
                <span className="campus-opt-ic"><MapPin size={15} /></span>
                <span className="campus-opt-text">
                  <span className="campus-opt-name">{school.label}</span>
                  {school.city && <span className="campus-opt-city">{school.city}</span>}
                </span>
                {school.count > 0 && <span className="campus-opt-count">{school.count} listing{school.count === 1 ? '' : 's'}</span>}
                {campus?.id === school.id && <Check size={16} className="campus-opt-tick" />}
              </button>
            </li>
          ))}
        </ul>

        {campus && (
          <button className="campus-clear-all" onClick={() => { clearCampus(); onClose(); }}>
            Show listings from all campuses
          </button>
        )}
      </div>
    </div>
  );
}
