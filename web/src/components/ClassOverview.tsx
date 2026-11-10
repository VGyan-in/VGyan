import React, { useEffect, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { getAnalytics } from '../api/dashboard';
import type { Analytics, Student } from '../types';
import { fmt, formatDate } from '../utils/format';
import { Card, Empty, ErrorNote, Metric, ui } from './ui';

interface Props {
  students: Student[];
  classId: string;
  onNavigateTab: (tab: 'at-risk' | 'students') => void;
  onSelectStudent: (s: Student) => void;
}

const BANDS = [
  { range: '< 50%', min: 0, max: 50, color: '#DC2626' },
  { range: '50–74%', min: 50, max: 75, color: '#F97316' },
  { range: '75–89%', min: 75, max: 90, color: '#2EC4B6' },
  { range: '90–100%', min: 90, max: 101, color: '#0B3D2E' },
];

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export const ClassOverview: React.FC<Props> = ({ students, classId, onNavigateTab, onSelectStudent }) => {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAnalytics(classId)
      .then((a) => !cancelled && setAnalytics(a))
      .catch((e: unknown) => !cancelled && setErr(e instanceof Error ? e.message : 'Could not load analytics'));
    return () => {
      cancelled = true;
    };
  }, [classId]);

  const assessed = students.filter((s) => s.overallReadingAccuracy != null);
  const atRisk = students.filter((s) => s.isAtRisk);
  const avgAcc = mean(assessed.map((s) => s.overallReadingAccuracy as number));
  const avgWpm = mean(students.filter((s) => s.averageWpm != null).map((s) => s.averageWpm as number));
  const distribution = BANDS.map((b) => ({
    ...b,
    count: assessed.filter((s) => (s.overallReadingAccuracy as number) >= b.min && (s.overallReadingAccuracy as number) < b.max).length,
  }));
  const recent = [...students].filter((s) => s.lastAssessmentDate).sort((a, b) => (b.lastAssessmentDate ?? '').localeCompare(a.lastAssessmentDate ?? '')).slice(0, 8);

  return (
    <div style={ui.page} className="fade-in">
      <div style={ui.metrics}>
        <Metric label="Students in class" value={students.length} hint={`${assessed.length} with at least one reading`} />
        <Metric label="Average reading accuracy" value={avgAcc == null ? '—' : `${fmt(avgAcc)}%`} hint="Mean of each student's last 5 readings" />
        <Metric label="Average words per minute" value={fmt(avgWpm)} hint="English and Kannada combined" />
        <div onClick={() => onNavigateTab('at-risk')} style={{ cursor: 'pointer' }} title="Open the support list">
          <Metric label="Need reading support" value={atRisk.length} hint="Last 3 readings average below 75%" tone={atRisk.length ? 'risk' : 'normal'} />
        </div>
      </div>

      {err && <ErrorNote>{err}</ErrorNote>}

      <div style={ui.grid2}>
        <Card title="Weekly activity and accuracy" sub="Attempts synced per ISO week, with mean reading accuracy">
          {!analytics ? (
            <Empty>Loading…</Empty>
          ) : analytics.weekly.length === 0 ? (
            <Empty>No synced assessments yet.</Empty>
          ) : (
            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer>
                <ComposedChart data={analytics.weekly} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2ECE6" vertical={false} />
                  <XAxis dataKey="week" stroke="#64748B" fontSize={11} tickLine={false} />
                  <YAxis yAxisId="n" stroke="#64748B" fontSize={11} allowDecimals={false} tickLine={false} />
                  <YAxis yAxisId="pct" orientation="right" domain={[0, 100]} stroke="#64748B" fontSize={11} tickLine={false} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar yAxisId="n" dataKey="readingCount" name="Reading attempts" stackId="a" fill="#2EC4B6" />
                  <Bar yAxisId="n" dataKey="writingCount" name="Writing attempts" stackId="a" fill="#FBBF24" />
                  <Line yAxisId="pct" type="monotone" dataKey="avgAccuracy" name="Mean accuracy %" stroke="#0B3D2E" strokeWidth={2.5} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card title="Reading accuracy distribution" sub="Students by their recent average accuracy">
          {assessed.length === 0 ? (
            <Empty>No readings yet.</Empty>
          ) : (
            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer>
                <BarChart data={distribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2ECE6" vertical={false} />
                  <XAxis dataKey="range" stroke="#64748B" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748B" fontSize={12} tickLine={false} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" name="Students" radius={[6, 6, 0, 0]}>
                    {distribution.map((d) => (
                      <Cell key={d.range} fill={d.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      <div style={ui.grid2}>
        <Card title="By language and level" sub="Mean metrics over all synced reading attempts">
          {!analytics || analytics.byLanguageLevel.length === 0 ? (
            <Empty>{analytics ? 'No readings yet.' : 'Loading…'}</Empty>
          ) : (
            <div style={ui.tableWrap}>
              <table style={ui.table}>
                <thead>
                  <tr>
                    {['Language', 'Level', 'Attempts', 'Accuracy', 'WPM', 'Subst.', 'Omit.', 'Insert.'].map((h) => (
                      <th key={h} style={ui.th}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {analytics.byLanguageLevel.map((r) => (
                    <tr key={`${r.language}-${r.level}`}>
                      <td style={ui.td}>{r.language}</td>
                      <td style={ui.td}>{r.level}</td>
                      <td style={ui.td}>{r.attempts}</td>
                      <td style={ui.td}>{fmt(r.avgAccuracy)}%</td>
                      <td style={ui.td}>{fmt(r.avgWpm)}</td>
                      <td style={ui.td}>{fmt(r.avgSubstitutions)}</td>
                      <td style={ui.td}>{fmt(r.avgOmissions)}</td>
                      <td style={ui.td}>{fmt(r.avgInsertions)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Assessment completion" sub="Students with at least one synced attempt">
          {!analytics ? (
            <Empty>Loading…</Empty>
          ) : (
            <div style={ui.metrics}>
              <Metric label="Any reading" value={`${analytics.completion.readingAny ?? 0} / ${analytics.students}`} />
              <Metric label="Any writing" value={`${analytics.completion.writingAny ?? 0} / ${analytics.students}`} />
              <Metric label="English reading" value={analytics.completion.englishReading ?? 0} />
              <Metric label="Kannada reading" value={analytics.completion.kannadaReading ?? 0} />
              <Metric label="Nothing yet" value={analytics.completion.none ?? 0} />
              {(analytics.pendingTranscriptions ?? 0) > 0 && (
                <Metric label="Awaiting transcription" value={analytics.pendingTranscriptions} hint="Recorded before a speech model was installed" />
              )}
              {(analytics.unverifiedMetrics ?? 0) > 0 && (
                <Metric label="Metrics not verified" value={analytics.unverifiedMetrics} hint="Server recalculation disagreed" tone="risk" />
              )}
            </div>
          )}
        </Card>
      </div>

      <Card
        title="Recently assessed"
        sub="Latest synced activity in this class"
        right={
          <button style={ui.secondaryBtn} onClick={() => onNavigateTab('students')}>
            All students ({students.length}) <ArrowUpRight size={14} />
          </button>
        }
      >
        {recent.length === 0 ? (
          <Empty>No assessments have been synced for this class yet.</Empty>
        ) : (
          <div style={ui.tableWrap}>
            <table style={ui.table}>
              <thead>
                <tr>
                  {['Student', 'Participant ID', 'Accuracy', 'WPM', 'Writing', 'Last activity'].map((h) => (
                    <th key={h} style={ui.th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recent.map((s) => (
                  <tr key={s.studentId} style={ui.rowBtn} onClick={() => onSelectStudent(s)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onSelectStudent(s)}>
                    <td style={{ ...ui.td, fontWeight: 600 }}>{s.name}</td>
                    <td style={ui.td}>
                      <code style={ui.code}>{s.participantId}</code>
                    </td>
                    <td style={{ ...ui.td, color: s.isAtRisk ? 'var(--color-risk-red)' : undefined, fontWeight: 700 }}>
                      {s.overallReadingAccuracy == null ? '—' : `${fmt(s.overallReadingAccuracy)}%`}
                    </td>
                    <td style={ui.td}>{fmt(s.averageWpm)}</td>
                    <td style={ui.td}>{s.writingScore == null ? '—' : `${fmt(s.writingScore)}/10`}</td>
                    <td style={ui.td}>{formatDate(s.lastAssessmentDate)}</td>
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
