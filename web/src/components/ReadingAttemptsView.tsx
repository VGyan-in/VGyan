import React, { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { Student } from '../types';
import { fmt, formatDateTime } from '../utils/format';
import { Card, Empty, ui } from './ui';

export const ReadingAttemptsView: React.FC<{ students: Student[]; onSelectStudent: (s: Student) => void }> = ({ students, onSelectStudent }) => {
  const [lang, setLang] = useState<'all' | 'English' | 'Kannada'>('all');
  const [level, setLevel] = useState<'all' | 'Easy' | 'Medium' | 'Advanced'>('all');
  const rows = useMemo(
    () =>
      students
        .flatMap((s) => s.recentReadingAttempts.map((a) => ({ a, s })))
        .filter(({ a }) => (lang === 'all' || a.language === lang) && (level === 'all' || a.level === level))
        .sort((x, y) => y.a.date.localeCompare(x.a.date)),
    [students, lang, level],
  );
  return (
    <div style={ui.page} className="fade-in">
      <Card
        title="Reading assessments"
        sub="Recent attempts per student. Metrics are computed on the phone from the offline speech-recognition transcript and re-checked by the server."
        right={
          <div style={ui.filters}>
            <select style={ui.input} value={lang} onChange={(e) => setLang(e.target.value as typeof lang)} aria-label="Language">
              <option value="all">All languages</option>
              <option>English</option>
              <option>Kannada</option>
            </select>
            <select style={ui.input} value={level} onChange={(e) => setLevel(e.target.value as typeof level)} aria-label="Level">
              <option value="all">All levels</option>
              <option>Easy</option>
              <option>Medium</option>
              <option>Advanced</option>
            </select>
          </div>
        }
      >
        {rows.length === 0 ? (
          <Empty>No reading attempts match.</Empty>
        ) : (
          <div style={ui.tableWrap}>
            <table style={ui.table}>
              <thead>
                <tr>
                  {['Date', 'Student', 'Passage', 'Lang / level', 'Accuracy', 'WPM', 'S / O / I', 'ASR model', 'AI'].map((h) => (
                    <th key={h} style={ui.th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ a, s }) => (
                  <tr key={a.id} style={ui.rowBtn} tabIndex={0} onClick={() => onSelectStudent(s)} onKeyDown={(e) => e.key === 'Enter' && onSelectStudent(s)}>
                    <td style={ui.td}>{formatDateTime(a.date)}</td>
                    <td style={{ ...ui.td, fontWeight: 600 }}>
                      {s.name}
                      <div style={ui.muted}>{s.participantId}</div>
                    </td>
                    <td style={{ ...ui.td, ...ui.kn }}>{a.passageTitle}</td>
                    <td style={ui.td}>
                      {a.language} · {a.level}
                    </td>
                    <td style={{ ...ui.td, fontWeight: 700 }}>
                      {a.asrStatus === 'pending' ? <span style={ui.muted}>pending</span> : `${fmt(a.accuracy)}%`}
                      {a.metricsVerified === false && (
                        <span title="Server re-calculation disagrees with the phone">
                          {' '}
                          <AlertTriangle size={12} color="#D97706" />
                        </span>
                      )}
                    </td>
                    <td style={ui.td}>{fmt(a.wpm)}</td>
                    <td style={ui.td}>
                      {a.asrStatus === 'pending' ? '—' : `${a.substitutions} / ${a.omissions} / ${a.insertions}`}
                    </td>
                    <td style={{ ...ui.td, ...ui.muted }}>{a.asrModelVersion || '—'}</td>
                    <td style={ui.td}>{a.aiStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
