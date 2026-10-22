import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AlertTriangle, Info, X } from 'lucide-react';

const Ctx = createContext(null);

/**
 * Usage:
 *   const { confirm, prompt, alert } = useAdminConfirm();
 *
 *   For "it worked / it failed" messages use useToast() from
 *   components/Feedback instead of alert().
 *
 *   // Simple confirmation
 *   if (!(await confirm('Delete this item?'))) return;
 *
 *   // Prompt for input
 *   const reason = await prompt('Reason for refund?');
 *   if (!reason) return;
 *
 *   // Info alert
 *   await alert('Done!');
 */
export function AdminConfirmProvider({ children }) {
  const [modal, setModal] = useState(null);
  const resolveRef = useRef(null);

  const open = useCallback((config) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setModal(config);
    });
  }, []);

  const close = useCallback((value) => {
    setModal(null);
    resolveRef.current?.(value);
    resolveRef.current = null;
  }, []);

  const confirm = useCallback((message, { title = 'Confirm', danger = true } = {}) =>
    open({ type: 'confirm', title, message, danger }), [open]);

  const prompt = useCallback((message, { title = 'Input required', placeholder = '' } = {}) =>
    open({ type: 'prompt', title, message, placeholder }), [open]);

  const alert = useCallback((message, { title = 'Notice' } = {}) =>
    open({ type: 'alert', title, message }), [open]);

  return (
    <Ctx.Provider value={{ confirm, prompt, alert }}>
      {children}
      {modal && (
        <AdminModal modal={modal} close={close} />
      )}
    </Ctx.Provider>
  );
}

function AdminModal({ modal, close }) {
  const [inputVal, setInputVal] = useState('');
  const isDanger = modal.danger !== false && modal.type === 'confirm';

  const handleOk = () => {
    if (modal.type === 'prompt') close(inputVal.trim() || null);
    else if (modal.type === 'confirm') close(true);
    else close(true);
  };

  const handleCancel = () => {
    if (modal.type === 'confirm') close(false);
    else if (modal.type === 'prompt') close(null);
    else close(true);
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(8,14,11,.5)',
        backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '0 16px',
      }}
      onClick={handleCancel}
    >
      <div
        style={{
          background: '#fff', borderRadius: 16,
          padding: '28px 28px 22px',
          maxWidth: 420, width: '100%',
          boxShadow: '0 12px 48px rgba(0,0,0,.22)',
          display: 'flex', flexDirection: 'column', gap: 14,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <span style={{
              width: 38, height: 38, borderRadius: 10, flexShrink: 0,
              background: isDanger ? 'var(--error-50)' : 'var(--info-50)',
              color: isDanger ? 'var(--error)' : 'var(--info)',
              display: 'grid', placeItems: 'center',
            }}>
              {isDanger ? <AlertTriangle size={18} /> : <Info size={18} />}
            </span>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>{modal.title}</h3>
              <p style={{ margin: '5px 0 0', fontSize: '.9rem', color: '#555', lineHeight: 1.5 }}>
                {modal.message}
              </p>
            </div>
          </div>
          <button
            onClick={handleCancel}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#888', padding: 4, flexShrink: 0,
            }}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {modal.type === 'prompt' && (
          <input
            autoFocus
            placeholder={modal.placeholder || ''}
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleOk(); if (e.key === 'Escape') handleCancel(); }}
            style={{
              width: '100%', padding: '10px 12px',
              border: '1.5px solid #ddd', borderRadius: 8,
              fontSize: '.9rem', outline: 'none', boxSizing: 'border-box',
            }}
          />
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          {modal.type !== 'alert' && (
            <button
              onClick={handleCancel}
              style={{
                padding: '9px 18px', borderRadius: 8,
                border: '1.5px solid #ddd', background: '#fff',
                fontSize: '.88rem', fontWeight: 600, cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleOk}
            autoFocus={modal.type !== 'prompt'}
            style={{
              padding: '9px 20px', borderRadius: 8,
              background: isDanger ? 'var(--error)' : 'var(--a-primary, #0A7E3E)',
              color: '#fff', border: 'none',
              fontSize: '.88rem', fontWeight: 700, cursor: 'pointer',
            }}
          >
            {modal.type === 'alert' ? 'OK' : modal.type === 'prompt' ? 'Submit' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function useAdminConfirm() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAdminConfirm must be used inside AdminConfirmProvider');
  return ctx;
}
