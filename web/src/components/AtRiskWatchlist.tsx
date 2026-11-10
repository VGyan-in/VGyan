import React from 'react';
import { AlertTriangle, ArrowRight, ShieldAlert } from 'lucide-react';
import type { Student } from '../types';
import { fmt, formatDate } from '../utils/format';
import { Card, Empty, ui } from './ui';

interface Props {
  students: Student[];
  onSelectStudent: (s: Student) => void;
}

/** Students whose last three readings average below 75% accuracy (a dashboard flag, not a diagnosis). */
export const AtRiskWatchlist: React.FC<Props> = ({ students, onSelectStudent }) => {
  const list = students.filter((s) => s.isAtRisk).sort((a, b) => (a.overallReadingAccuracy ?? 0) - (b.overallReadingAccuracy ?? 0));
  return (
    <div style={ui.page} className="fade-in">
      <Card>
        <div style={{ display: 'flex', gap: '0.9rem', alignItems: 'center' }}>
          <ShieldAlert size={26} color="#DC2626" />
          <div>
            <h3 style={ui.cardTitle}>Students who may need reading support</h3>
            <p style={ui.cardSub}>
              Flagged when the average accuracy of the last three readings is below 75%. This threshold is a prompt for a teacher's attention, not a validated
              screening cut-off.
            </p>
          </div>
        </div>
      </Card>
      {list.length === 0 ? (
        <Card>
          <Empty>No students are currently flagged in this class.</Empty>
        </Card>
      ) : (
        <div style={styles.grid}>
          {list.map((s) => {
            const last = s.recentReadingAttempts[0];
            const errs = s.recentReadingAttempts.slice(0, 3).reduce((acc, a) => ({ o: acc.o + (a.omissions ?? 0), s: acc.s + (a.substitutions ?? 0) }), { o: 0, s: 0 });
            const words = Array.from(new Set(s.recentReadingAttempts.slice(0, 3).flatMap((a) => a.practiceWords))).slice(0, 8);
            return (
              <Card key={s.studentId} style={{ borderLeft: '4px solid #DC2626' }}>
                <div style={styles.top}>
                  <div>
                    <h4 style={styles.name}>{s.name}</h4>
                    <code style={ui.code}>{s.participantId}</code>
                  </div>
                  <span className="badge badge-risk">{fmt(s.overallReadingAccuracy)}% accuracy</span>
                </div>
                <p style={styles.reason}>
                  <AlertTriangle size={13} color="#DC2626" /> {s.atRiskReason}
                </p>
                <div style={styles.stats}>
                  <div>
                    <div style={ui.metricLabel}>Avg WPM</div>
                    <strong>{fmt(s.averageWpm)}</strong>
                  </div>
                  <div>
                    <div style={ui.metricLabel}>Omissions (last 3)</div>
                    <strong>{errs.o}</strong>
                  </div>
                  <div>
                    <div style={ui.metricLabel}>Substitutions (last 3)</div>
                    <strong>{errs.s}</strong>
                  </div>
                  <div>
                    <div style={ui.metricLabel}>Last reading</div>
                    <strong>{last ? `${formatDate(last.date)} · ${last.language}` : '—'}</strong>
                  </div>
                </div>
                {words.length > 0 && (
                  <div style={{ marginTop: '0.6rem' }}>
                    <div style={ui.metricLabel}>Practice words</div>
                    <div style={styles.chips}>
                      {words.map((w) => (
                        <span key={w} style={{ ...styles.chip, ...ui.kn }}>
                          {w}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <button style={{ ...ui.secondaryBtn, marginTop: '0.8rem' }} onClick={() => onSelectStudent(s)}>
                  Open details & add note <ArrowRight size={14} />
                </button>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' },
  top: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' },
  name: { fontSize: '1rem', fontWeight: 700, color: 'var(--color-slate-900)', marginBottom: '0.2rem' },
  reason: { display: 'flex', gap: '0.35rem', alignItems: 'flex-start', fontSize: '0.82rem', color: '#991B1B', background: '#FEF2F2', borderRadius: 8, padding: '0.5rem 0.6rem', margin: '0.7rem 0' },
  stats: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', fontSize: '0.9rem' },
  chips: { display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.3rem' },
  chip: { background: 'var(--color-light-green)', borderRadius: 999, padding: '0.15rem 0.55rem', fontSize: '0.82rem', color: 'var(--color-deep-forest)' },
};
