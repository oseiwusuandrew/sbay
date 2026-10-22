/**
 * Avatar — shows a profile image if available, otherwise renders the
 * user's name initials with a deterministic colour so the UI never
 * shows a broken image or a blank circle.
 *
 * Usage:
 *   <Avatar src={user.avatar} name={user.name} size={40} />
 */
import { useState } from 'react';
import { mediaUrl } from '../api/config';
import './Avatar.css';

const PALETTE = [
  '#0A7E3E', '#1565C0', '#6A1B9A', '#E65100', '#AD1457',
  '#00695C', '#4527A0', '#283593', '#4E342E', '#37474F',
];

function colorFor(name = '') {
  if (!name) return PALETTE[0];
  const code = name.split('').reduce((n, c) => n + c.charCodeAt(0), 0);
  return PALETTE[code % PALETTE.length];
}

function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Avatar({ src: rawSrc, name = '', size = 40, className = '', style = {} }) {
  const src = mediaUrl(rawSrc);
  const bg = colorFor(name);
  const ini = initials(name);
  const fontSize = Math.max(10, Math.round(size * 0.38));
  // Remember which src failed so a broken image falls back to initials
  // (previously it hid itself and left an empty circle).
  const [failedSrc, setFailedSrc] = useState(null);

  if (src && failedSrc !== src) {
    return (
      <img
        src={src}
        alt={name || 'Avatar'}
        className={`av-img ${className}`}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, ...style }}
        onError={() => setFailedSrc(src)}
      />
    );
  }

  return (
    <span
      className={`av-ini ${className}`}
      aria-label={name || 'User'}
      style={{ width: size, height: size, background: bg, fontSize, flexShrink: 0, ...style }}
    >
      {ini}
    </span>
  );
}
