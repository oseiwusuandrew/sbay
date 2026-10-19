import { useState } from 'react';
import { MapPin, ChevronDown } from 'lucide-react';
import { useLocation } from '../store/LocationContext';
import CampusPicker from './CampusPicker';
import './CampusBanner.css';

/**
 * Compact location bar for listing pages (Trending, etc.). Home uses a
 * fuller location header; both open the same CampusPicker.
 */
export default function CampusBanner() {
  const { campus } = useLocation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="campus-bar">
        <div className="campus-bar-inner">
          <MapPin size={15} className="campus-bar-ic" aria-hidden />
          <span className="campus-bar-label">
            {campus ? <>Showing listings near <strong>{campus.label}</strong></> : 'Showing listings from all campuses'}
          </span>
          <button className="campus-bar-change" onClick={() => setOpen(true)}>
            {campus ? 'Change' : 'Choose campus'} <ChevronDown size={13} />
          </button>
        </div>
      </div>
      <CampusPicker open={open} onClose={() => setOpen(false)} />
    </>
  );
}
