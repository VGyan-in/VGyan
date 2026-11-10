import React from 'react';

export const Card: React.FC<{ title?: string; sub?: string; right?: React.ReactNode; children: React.ReactNode; style?: React.CSSProperties }> = ({
  title,
  sub,
  right,
  children,
  style,
}) => (
  <section style={{ ...ui.card, ...style }}>
    {(title || right) && (
      <div style={ui.cardHead}>
        <div>
          {title && <h3 style={ui.cardTitle}>{title}</h3>}
          {sub && <p style={ui.cardSub}>{sub}</p>}
        </div>
        {right}
      </div>
    )}
    {children}
  </section>
);

export const Metric: React.FC<{ label: string; value: React.ReactNode; hint?: string; tone?: 'risk' | 'normal' }> = ({ label, value, hint, tone }) => (
  <div style={{ ...ui.metric, ...(tone === 'risk' ? { borderLeft: '4px solid var(--color-risk-red)' } : {}) }}>
    <div style={ui.metricLabel}>{label}</div>
    <div style={{ ...ui.metricValue, ...(tone === 'risk' ? { color: 'var(--color-risk-red)' } : {}) }}>{value}</div>
    {hint && <div style={ui.metricHint}>{hint}</div>}
  </div>
);

export const Empty: React.FC<{ children: React.ReactNode }> = ({ children }) => <div style={ui.empty}>{children}</div>;

export const ErrorNote: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div role="alert" style={ui.error}>
    {children}
  </div>
);

export const ui: Record<string, React.CSSProperties> = {
  page: { display: 'flex', flexDirection: 'column', gap: '1.25rem' },
  card: { background: 'var(--color-surface-white)', border: '1px solid var(--color-slate-200)', borderRadius: 'var(--radius-lg)', padding: '1.25rem 1.4rem', boxShadow: 'var(--shadow-sm)' },
  cardHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '0.9rem', flexWrap: 'wrap' },
  cardTitle: { fontSize: '1.02rem', fontWeight: 700, color: 'var(--color-slate-900)', fontFamily: 'var(--font-heading)' },
  cardSub: { fontSize: '0.8rem', color: 'var(--color-slate-500)', marginTop: '0.15rem' },
  metrics: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '1rem' },
  metric: { background: 'var(--color-surface-white)', border: '1px solid var(--color-slate-200)', borderRadius: 'var(--radius-lg)', padding: '1rem 1.15rem', boxShadow: 'var(--shadow-sm)' },
  metricLabel: { fontSize: '0.78rem', color: 'var(--color-slate-500)', fontWeight: 600 },
  metricValue: { fontSize: '1.7rem', fontWeight: 700, color: 'var(--color-slate-900)', fontFamily: 'var(--font-heading)', marginTop: '0.25rem' },
  metricHint: { fontSize: '0.74rem', color: 'var(--color-slate-500)', marginTop: '0.15rem' },
  grid2: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.25rem' },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' },
  th: { textAlign: 'left', padding: '0.6rem 0.7rem', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-slate-500)', borderBottom: '1px solid var(--color-slate-200)', whiteSpace: 'nowrap' },
  td: { padding: '0.65rem 0.7rem', borderBottom: '1px solid var(--color-slate-100)', color: 'var(--color-slate-700)', verticalAlign: 'top' },
  rowBtn: { cursor: 'pointer' },
  code: { background: 'var(--color-slate-100)', padding: '0.1rem 0.4rem', borderRadius: 4, fontSize: '0.78rem' },
  input: { padding: '0.55rem 0.7rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-slate-200)', fontSize: '0.88rem', fontFamily: 'inherit', background: '#fff', boxSizing: 'border-box' },
  textarea: { padding: '0.6rem 0.7rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-slate-200)', fontSize: '0.92rem', fontFamily: "'Noto Sans Kannada', var(--font-body)", width: '100%', boxSizing: 'border-box', lineHeight: 1.6 },
  label: { fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-slate-500)', display: 'block', marginBottom: '0.25rem' },
  primaryBtn: { display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 1rem', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--color-deep-forest)', color: '#fff', fontWeight: 600, fontSize: '0.86rem', cursor: 'pointer' },
  secondaryBtn: { display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.9rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-leaf-tint)', background: 'var(--color-light-green)', color: 'var(--color-deep-forest)', fontWeight: 600, fontSize: '0.84rem', cursor: 'pointer' },
  dangerBtn: { display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.9rem', borderRadius: 'var(--radius-md)', border: '1px solid #FECACA', background: '#FEF2F2', color: '#991B1B', fontWeight: 600, fontSize: '0.84rem', cursor: 'pointer' },
  filters: { display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' },
  empty: { padding: '2rem 1rem', textAlign: 'center', color: 'var(--color-slate-500)', fontSize: '0.9rem' },
  error: { background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', borderRadius: 'var(--radius-md)', padding: '0.6rem 0.8rem', fontSize: '0.85rem' },
  muted: { fontSize: '0.78rem', color: 'var(--color-slate-500)' },
  kn: { fontFamily: "'Noto Sans Kannada', var(--font-body)" },
};
