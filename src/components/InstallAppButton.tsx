import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

// Chrome hands over an "install" prompt once, early. Keep it so the button can use it later.
let deferred: any = null;
const listeners = new Set<() => void>();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    listeners.forEach((l) => l());
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    listeners.forEach((l) => l());
  });
}

const isInstalled = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

/** Puts the panel on the phone's home screen / desktop so it opens like an app, with no link to type. */
export default function InstallAppButton({ compact = false }: { compact?: boolean }) {
  const [, force] = useState(0);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    const update = () => force((n) => n + 1);
    listeners.add(update);
    return () => { listeners.delete(update); };
  }, []);

  if (isInstalled()) return null;

  const onClick = async () => {
    if (deferred) {
      deferred.prompt();
      await deferred.userChoice;
      deferred = null;
      force((n) => n + 1);
    } else {
      setHelp(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        title="Install MilkyLush on this device"
        style={{
          display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontFamily: 'inherit',
          border: '1px solid var(--primary)', background: 'var(--nav-active-bg)', color: 'var(--primary)',
          borderRadius: '999px', padding: compact ? '6px' : '6px 14px', fontSize: '0.8rem', fontWeight: 600,
          ...(compact ? { width: '36px', height: '36px', justifyContent: 'center' } : {}),
        }}
      >
        <Download size={16} />
        {!compact && <span>Install app</span>}
      </button>

      {help && (
        <div
          role="dialog"
          aria-label="How to install"
          onClick={() => setHelp(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '16px', padding: '1.25rem', textAlign: 'left', maxWidth: '360px', width: '100%', boxShadow: '0 20px 50px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
              <strong style={{ fontSize: '1rem' }}>Install MilkyLush</strong>
              <button type="button" aria-label="Close" onClick={() => setHelp(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>
            {isIos() ? (
              <ol style={{ paddingLeft: '1.2rem', fontSize: '0.88rem', lineHeight: 1.7 }}>
                <li>Open this page in <b>Safari</b>.</li>
                <li>Tap the <b>Share</b> button (square with an arrow).</li>
                <li>Choose <b>Add to Home Screen</b>, then <b>Add</b>.</li>
              </ol>
            ) : (
              <ol style={{ paddingLeft: '1.2rem', fontSize: '0.88rem', lineHeight: 1.7 }}>
                <li>Open this page in <b>Chrome</b>.</li>
                <li>Tap the <b>⋮</b> menu (top right).</li>
                <li>Choose <b>Install app</b> (or <b>Add to Home screen</b>), then <b>Install</b>.</li>
              </ol>
            )}
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.6rem' }}>
              After that, MilkyLush has its own icon and opens in one tap, with no link to type.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
