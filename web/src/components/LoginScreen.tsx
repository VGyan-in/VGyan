import React, { useState } from 'react';
import { LogIn } from 'lucide-react';
import { isApiConfigured, login } from '../api/dashboard';
import { ErrorNote, ui } from './ui';

export const LoginScreen: React.FC<{ onSignedIn: () => void }> = ({ onSignedIn }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      await login(email.trim(), password);
      onSignedIn();
    } catch (e2: unknown) {
      setErr(e2 instanceof Error ? e2.message : 'Sign-in failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main style={styles.screen}>
      <form style={styles.card} onSubmit={submit} aria-labelledby="login-title">
        <img src={`${import.meta.env.BASE_URL}vgyan_logo.png`} alt="" style={styles.logo} />
        <h1 id="login-title" style={styles.title}>
          VGyan Teacher Portal
        </h1>
        <p style={styles.sub}>ಶಿಕ್ಷಕರ ಪೋರ್ಟಲ್ · Sign in with the account your administrator created.</p>
        {!isApiConfigured && <ErrorNote>This build has no server address (VITE_API_BASE_URL). Sign-in is unavailable.</ErrorNote>}
        {err && <ErrorNote>{err}</ErrorNote>}
        <label style={ui.label} htmlFor="email">
          E-mail
        </label>
        <input id="email" style={{ ...ui.input, width: '100%' }} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label style={{ ...ui.label, marginTop: '0.7rem' }} htmlFor="password">
          Password
        </label>
        <input
          id="password"
          style={{ ...ui.input, width: '100%' }}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit" style={{ ...ui.primaryBtn, width: '100%', justifyContent: 'center', marginTop: '1.1rem', padding: '0.7rem' }} disabled={busy || !isApiConfigured}>
          <LogIn size={16} /> {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <p style={{ ...ui.muted, marginTop: '1rem' }}>Student data shown here is confidential research data. Do not share screenshots or exports.</p>
      </form>
    </main>
  );
};

const styles: Record<string, React.CSSProperties> = {
  screen: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: 'var(--color-soft-cream)' },
  card: { width: '100%', maxWidth: 400, background: '#fff', border: '1px solid var(--color-slate-200)', borderRadius: 'var(--radius-xl)', padding: '2rem 1.75rem', boxShadow: 'var(--shadow-lg)', display: 'flex', flexDirection: 'column', gap: '0.3rem' },
  logo: { width: 56, height: 56, objectFit: 'contain', marginBottom: '0.5rem' },
  title: { fontSize: '1.45rem', fontWeight: 700, color: 'var(--color-deep-forest)', fontFamily: 'var(--font-heading)' },
  sub: { fontSize: '0.85rem', color: 'var(--color-slate-500)', marginBottom: '0.8rem' },
};
