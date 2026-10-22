import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CircleCheck, CircleAlert, TriangleAlert, Info, X } from 'lucide-react';
import './Feedback.css';

/**
 * The one way to tell users how something went.
 *
 *  - <Notice tone="error">…</Notice>  a message that stays on the page:
 *    a form error, a failed load, a warning about the current state.
 *  - const toast = useToast();  toast.success('Saved')
 *    a short-lived message about something that just happened.
 *
 * Tones map to the colour tokens in index.css and mean the same thing
 * everywhere: success (green), warning (amber), error (red), info (blue).
 */

const ICONS = {
  success: CircleCheck,
  warning: TriangleAlert,
  error: CircleAlert,
  info: Info,
};

export function Notice({ tone = 'info', title, children, action, className = '', style }) {
  const Icon = ICONS[tone] || Info;
  return (
    <div className={`notice notice--${tone} ${className}`} style={style} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon size={18} className="notice-ic" aria-hidden="true" />
      <div className="notice-body">
        {title && <strong>{title}</strong>}
        {children && <div>{children}</div>}
      </div>
      {action}
    </div>
  );
}

const ToastContext = createContext(null);

// Errors stay up longer: they usually need reading, not just noticing.
const DURATION = { success: 3000, info: 3500, warning: 5000, error: 6000 };

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((tone, message, { action } = {}) => {
    const id = ++nextId.current;
    // Keep at most three on screen; the newest pushes out the oldest.
    setToasts((list) => [...list.slice(-2), { id, tone, message, action }]);
    setTimeout(() => dismiss(id), DURATION[tone] || 3500);
    return id;
  }, [dismiss]);

  const api = useMemo(() => ({
    success: (msg, opts) => show('success', msg, opts),
    error:   (msg, opts) => show('error', msg, opts),
    warning: (msg, opts) => show('warning', msg, opts),
    info:    (msg, opts) => show('info', msg, opts),
    dismiss,
  }), [show, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-stack" aria-live="polite">
        <AnimatePresence initial={false}>
          {toasts.map((t) => {
            const Icon = ICONS[t.tone] || Info;
            return (
              <motion.div
                key={t.id}
                layout
                className={`toast toast--${t.tone}`}
                role={t.tone === 'error' ? 'alert' : 'status'}
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
              >
                <Icon size={18} className="toast-ic" aria-hidden="true" />
                <span className="toast-msg">{t.message}</span>
                {t.action && (
                  <Link to={t.action.to} className="toast-action" onClick={() => dismiss(t.id)}>
                    {t.action.label}
                  </Link>
                )}
                <button type="button" className="toast-close" onClick={() => dismiss(t.id)} aria-label="Dismiss">
                  <X size={15} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}
