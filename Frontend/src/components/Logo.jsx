import './Logo.css';

/**
 * sBay brand logo, drawn in markup instead of the old padded PNG so it is
 * crisp at any size and lines up with surrounding text.
 *
 * variant: 'wordmark' (sB + gold "ay" tile) | 'mark' (square app icon)
 * size:    'sm' | 'md' | 'lg' | 'xl'
 * tone:    'default' | 'light' (for dark backgrounds)
 */
export default function Logo({ variant = 'wordmark', size = 'md', tone = 'default' }) {
  if (variant === 'mark') {
    return (
      <span className={`sbay-mark size-${size}`} role="img" aria-label="sBay">
        <span className="sbay-mark-s">s</span><span className="sbay-mark-b">B</span>
      </span>
    );
  }
  return (
    <span className={`sbay-logo size-${size} tone-${tone}`} role="img" aria-label="sBay">
      <span className="sbay-logo-sb" aria-hidden="true">sB</span>
      <span className="sbay-logo-tile" aria-hidden="true">ay</span>
    </span>
  );
}
