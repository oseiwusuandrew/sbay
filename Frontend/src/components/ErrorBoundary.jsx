import { Component } from 'react';

/**
 * Last-resort catch for render errors. Without it, any exception in any
 * page unmounted the whole app and left users on a blank white screen.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('[sbay] render error', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{
        minHeight: '100svh', display: 'grid', placeItems: 'center', padding: 24,
        background: 'var(--bg)', fontFamily: 'var(--sans)',
      }}>
        <div style={{
          maxWidth: 420, textAlign: 'center', background: 'var(--surface)',
          border: '1px solid var(--border)', borderRadius: 20, padding: '32px 24px',
        }}>
          <h1 style={{ fontSize: '1.4rem', marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>
            This page hit an unexpected error. Your cart and account are safe.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>Reload page</button>
            <button className="btn btn-ghost" onClick={() => { window.location.href = '/home'; }}>Go home</button>
          </div>
        </div>
      </div>
    );
  }
}
