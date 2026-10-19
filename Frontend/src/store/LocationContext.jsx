import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { sbay } from '../api/client';

const STORAGE_KEY = 'sbay.campus';
const DENIED_KEY  = 'sbay.loc_denied';

const Ctx = createContext(null);

/**
 * Known school coordinates for reverse-matching.
 * When a school is fetched from the catalog, we try to match by name.
 * If no GPS match, the user sees products anyway (no forced campus).
 */
const SCHOOL_COORDS = [
  { keyword: 'legon',      lat: 5.6501, lng: -0.1870 },
  { keyword: 'ug',         lat: 5.6501, lng: -0.1870 },
  { keyword: 'knust',      lat: 6.6745, lng: -1.5716 },
  { keyword: 'ucc',        lat: 5.1155, lng: -1.2900 },
  { keyword: 'uew',        lat: 6.6800, lng: -0.4510 },
  { keyword: 'upsa',       lat: 5.6650, lng: -0.1700 },
  { keyword: 'ashesi',     lat: 5.7597, lng: -0.2186 },
  { keyword: 'gimpa',      lat: 5.6430, lng: -0.2080 },
  { keyword: 'uds',        lat: 9.4035, lng: -0.8424 },
  { keyword: 'uhas',       lat: 6.9814, lng: -0.2277 },
  { keyword: 'umat',       lat: 5.3200, lng: -1.9700 },
  { keyword: 'uner',       lat: 6.6800, lng: -0.4510 },
  { keyword: 'central',    lat: 5.1095, lng: -1.2785 },
  { keyword: 'cape coast',lat: 5.1095, lng: -1.2785 },
  { keyword: 'kumasi',    lat: 6.6884, lng: -1.6244 },
  { keyword: 'accra',     lat: 5.6037, lng: -0.1870 },
  { keyword: 'tamale',    lat: 9.4008, lng: -0.8393 },
  { keyword: 'ho',        lat: 6.6000, lng: 0.4700 },
  { keyword: 'tarkwa',    lat: 5.3000, lng: -1.9833 },
];

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (d) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function matchSchoolByGeo(lat, lng, schools) {
  let best = null;
  let bestDist = Infinity;
  for (const school of schools) {
    const key = school.label.toLowerCase();
    for (const coord of SCHOOL_COORDS) {
      if (key.includes(coord.keyword) || coord.keyword.includes(key)) {
        const d = haversine(lat, lng, coord.lat, coord.lng);
        if (d < bestDist) { bestDist = d; best = school; }
      }
    }
  }
  // Only match if within 50 km
  return bestDist < 50 ? best : null;
}

export function LocationProvider({ children }) {
  const [campus, setCampusState] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null; }
    catch { return null; }
  });
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [locStatus, setLocStatus] = useState('idle'); // idle | prompting | granted | denied
  const prompted = useRef(false);

  // Load schools
  useEffect(() => {
    let alive = true;
    sbay.getSchoolTree()
      .then((tree) => { if (alive) setSchools(tree.filter((s) => s.id !== 'all')); })
      .catch(() => { if (alive) setSchools([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  // A saved campus is a snapshot; refresh it from the live list so label
  // fixes and listing counts reach people who picked it earlier.
  useEffect(() => {
    if (!campus || schools.length === 0) return;
    const fresh = schools.find((s) => s.id === campus.id);
    if (fresh && (fresh.label !== campus.label || fresh.count !== campus.count || fresh.city !== campus.city)) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh)); } catch { /* */ }
      setCampusState(fresh);
    }
  }, [schools, campus]);

  // Auto-detect location via browser geolocation once schools are loaded
  useEffect(() => {
    if (loading || schools.length === 0) return;
    if (campus) return; // already have a campus
    if (prompted.current) return;
    try { if (localStorage.getItem(DENIED_KEY)) { setLocStatus('denied'); return; } }
    catch { /* ignore */ }
    if (!navigator.geolocation) return;
    prompted.current = true;
    setLocStatus('prompting');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const match = matchSchoolByGeo(pos.coords.latitude, pos.coords.longitude, schools);
        if (match) {
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(match)); } catch { /* */ }
          setCampusState(match);
        }
        setLocStatus('granted');
      },
      () => {
        setLocStatus('denied');
        try { localStorage.setItem(DENIED_KEY, '1'); } catch { /* */ }
      },
      { timeout: 8000, maximumAge: 300000 }
    );
  }, [loading, schools, campus]);

  const setCampus = useCallback((school) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(school)); } catch { /* */ }
    try { localStorage.removeItem(DENIED_KEY); } catch { /* */ }
    setCampusState(school);
  }, []);

  const clearCampus = useCallback(() => {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* */ }
    setCampusState(null);
  }, []);

  const autoDetect = useCallback(() => {
    if (!navigator.geolocation) return;
    try { localStorage.removeItem(DENIED_KEY); } catch { /* */ }
    setLocStatus('prompting');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const match = matchSchoolByGeo(pos.coords.latitude, pos.coords.longitude, schools);
        if (match) {
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(match)); } catch { /* */ }
          setCampusState(match);
        }
        setLocStatus('granted');
      },
      () => {
        setLocStatus('denied');
        try { localStorage.setItem(DENIED_KEY, '1'); } catch { /* */ }
      },
      { timeout: 8000, maximumAge: 300000 }
    );
  }, [schools]);

  return (
    <Ctx.Provider value={{ campus, setCampus, clearCampus, schools, loading, locStatus, autoDetect }}>
      {children}
    </Ctx.Provider>
  );
}

export const useLocation = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useLocation must be inside LocationProvider');
  return ctx;
};
