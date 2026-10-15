import React from 'react';
import {
  Users,
  Target,
  Zap,
  AlertTriangle,
  ArrowUpRight,
  TrendingUp,
  FileCheck2,
  BookOpen,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from 'recharts';
import { Student } from '../types';
import { WEEKLY_ACTIVITY_DATA, ACCURACY_DISTRIBUTION } from '../data/mockData';

interface ClassOverviewProps {
  students: Student[];
  onNavigateTab: (tab: any) => void;
  onSelectStudent: (s: Student) => void;
}

export const ClassOverview: React.FC<ClassOverviewProps> = ({
  students,
  onNavigateTab,
  onSelectStudent,
}) => {
  const totalStudents = students.length;
  const atRiskStudents = students.filter((s) => s.isAtRisk);
  const avgAccuracy = Math.round(
    students.reduce((acc, s) => acc + s.overallReadingAccuracy, 0) / (totalStudents || 1)
  );
  const avgWpm = Math.round(
    students.reduce((acc, s) => acc + s.averageWpm, 0) / (totalStudents || 1)
  );
  const totalReadings = students.reduce((acc, s) => acc + s.recentReadingAttempts.length, 0);

  return (
    <div style={styles.container} className="fade-in">
      {/* Top Metric Cards */}
      <div style={styles.metricsGrid}>
        {/* Metric 1 */}
        <div style={styles.metricCard}>
          <div style={styles.metricHeader}>
            <span style={styles.metricLabel}>Total Enrolled</span>
            <div style={{ ...styles.iconWrapper, backgroundColor: 'var(--color-light-green)' }}>
              <Users size={18} color="var(--color-deep-forest)" />
            </div>
          </div>
          <div style={styles.metricValue}>{totalStudents}</div>
          <div style={styles.metricSub}>
            <span style={styles.positiveText}>Active State Syllabus</span>
          </div>
        </div>

        {/* Metric 2: Class Avg Accuracy */}
        <div style={styles.metricCard}>
          <div style={styles.metricHeader}>
            <span style={styles.metricLabel}>Class Avg Accuracy</span>
            <div style={{ ...styles.iconWrapper, backgroundColor: '#E6FFFA' }}>
              <Target size={18} color="#0D9488" />
            </div>
          </div>
          <div style={styles.metricValue}>{avgAccuracy}%</div>
          <div style={styles.metricSub}>
            <TrendingUp size={14} color="#059669" />
            <span style={styles.positiveText}>+3.4% from last week</span>
          </div>
        </div>

        {/* Metric 3: Avg Fluency WPM */}
        <div style={styles.metricCard}>
          <div style={styles.metricHeader}>
            <span style={styles.metricLabel}>Avg Reading Fluency</span>
            <div style={{ ...styles.iconWrapper, backgroundColor: '#FEF3C7' }}>
              <Zap size={18} color="#D97706" />
            </div>
          </div>
          <div style={styles.metricValue}>{avgWpm} <span style={styles.unitText}>WPM</span></div>
          <div style={styles.metricSub}>
            <span style={styles.neutralText}>Benchmark: 70 WPM (Class 4)</span>
          </div>
        </div>

        {/* Metric 4: At-Risk Students (< 75%) */}
        <div
          style={{
            ...styles.metricCard,
            borderLeft: '4px solid #DC2626',
            cursor: 'pointer',
          }}
          onClick={() => onNavigateTab('at-risk')}
          title="Click to view At-Risk watchlist"
        >
          <div style={styles.metricHeader}>
            <span style={{ ...styles.metricLabel, color: '#DC2626', fontWeight: 700 }}>
              At-Risk Students (&lt; 75%)
            </span>
            <div style={{ ...styles.iconWrapper, backgroundColor: '#FEE2E2' }}>
              <AlertTriangle size={18} color="#DC2626" />
            </div>
          </div>
          <div style={{ ...styles.metricValue, color: '#DC2626' }}>
            {atRiskStudents.length}
          </div>
          <div style={styles.metricSub}>
            <span style={{ color: '#DC2626', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
              Needs Immediate Support <ArrowUpRight size={13} />
            </span>
          </div>
        </div>
      </div>

      {/* Main Charts Row */}
      <div style={styles.chartsGrid}>
        {/* Weekly Progress Trend Chart */}
        <div style={styles.chartCard}>
          <div style={styles.chartHeader}>
            <div>
              <h3 style={styles.chartTitle}>Assessment Activity & Accuracy Trends</h3>
              <p style={styles.chartSubtitle}>Daily tablet sync records over the past 6 school days</p>
            </div>
            <span className="badge badge-forest">Weekly Sync</span>
          </div>
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <AreaChart data={WEEKLY_ACTIVITY_DATA} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorAcc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2EC4B6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#2EC4B6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2ECE6" vertical={false} />
                <XAxis dataKey="day" stroke="#64748B" fontSize={12} tickLine={false} />
                <YAxis domain={[50, 100]} stroke="#64748B" fontSize={12} tickLine={false} unit="%" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0B3D2E',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#FFFFFF',
                    fontSize: '12px',
                    boxShadow: 'var(--shadow-md)',
                  }}
                  formatter={(value: any, name: any) => [
                    `${value}${name === 'avgAccuracy' ? '%' : ''}`,
                    name === 'avgAccuracy' ? 'Avg Accuracy' : 'Reading Speed (WPM)',
                  ]}
                />
                <Legend verticalAlign="top" height={36} iconType="circle" />
                <Area
                  type="monotone"
                  dataKey="avgAccuracy"
                  name="Accuracy %"
                  stroke="#2EC4B6"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorAcc)"
                />
                <Area
                  type="monotone"
                  dataKey="avgWpm"
                  name="Fluency (WPM)"
                  stroke="#0B3D2E"
                  strokeWidth={2}
                  fillOpacity={0}
                  fill="transparent"
                  strokeDasharray="4 4"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Student Accuracy Tier Distribution */}
        <div style={styles.chartCard}>
          <div style={styles.chartHeader}>
            <div>
              <h3 style={styles.chartTitle}>Accuracy Distribution</h3>
              <p style={styles.chartSubtitle}>Reading proficiency levels across class</p>
            </div>
          </div>
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={ACCURACY_DISTRIBUTION} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2ECE6" vertical={false} />
                <XAxis dataKey="range" stroke="#64748B" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748B" fontSize={12} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid var(--color-slate-200)',
                    borderRadius: '8px',
                    boxShadow: 'var(--shadow-md)',
                  }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {ACCURACY_DISTRIBUTION.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* At-Risk Focus Banner & Quick Actions */}
      <div style={styles.atRiskBanner}>
        <div style={styles.atRiskBannerLeft}>
          <div style={styles.alertIconCircle}>
            <AlertTriangle size={20} color="#DC2626" />
          </div>
          <div>
            <h4 style={styles.bannerTitle}>
              {atRiskStudents.length} Students require targeted reading support (&lt; 75% accuracy)
            </h4>
            <p style={styles.bannerDesc}>
              Common challenges detected: Kannada conjunct consonants (ottakshara) and multi-syllabic English omissions.
            </p>
          </div>
        </div>
        <button
          onClick={() => onNavigateTab('at-risk')}
          style={styles.bannerButton}
        >
          <span>Open At-Risk List</span>
          <ArrowUpRight size={16} />
        </button>
      </div>

      {/* Recent High Priority Students Table */}
      <div style={styles.tableCard}>
        <div style={styles.tableHeader}>
          <div>
            <h3 style={styles.chartTitle}>Recent Student Assessments</h3>
            <p style={styles.chartSubtitle}>Synced offline attempts from student mobile tablets</p>
          </div>
          <button
            onClick={() => onNavigateTab('students')}
            style={styles.viewAllButton}
          >
            <span>View All Students ({students.length})</span>
            <ArrowUpRight size={14} />
          </button>
        </div>

        <div style={styles.tableResponsive}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.trHead}>
                <th style={styles.th}>Student</th>
                <th style={styles.th}>Participant ID</th>
                <th style={styles.th}>Reading Acc.</th>
                <th style={styles.th}>WPM</th>
                <th style={styles.th}>Writing Score</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {students.slice(0, 5).map((student) => (
                <tr key={student.studentId} style={styles.trBody}>
                  <td style={styles.td}>
                    <div style={styles.studentNameWrap}>
                      <span style={styles.studentAvatar}>
                        {student.name.slice(0, 2).toUpperCase()}
                      </span>
                      <div>
                        <div style={styles.nameText}>{student.name}</div>
                        <div style={styles.subText}>{student.studentId} • Age {student.age}</div>
                      </div>
                    </div>
                  </td>
                  <td style={styles.td}>
                    <code style={styles.codeBadge}>{student.participantId}</code>
                  </td>
                  <td style={styles.td}>
                    <div style={styles.accuracyWrap}>
                      <span
                        style={{
                          fontWeight: 700,
                          color: student.isAtRisk ? '#DC2626' : 'var(--color-deep-forest)',
                        }}
                      >
                        {student.overallReadingAccuracy}%
                      </span>
                      <div style={styles.progressBar}>
                        <div
                          style={{
                            ...styles.progressFill,
                            width: `${student.overallReadingAccuracy}%`,
                            backgroundColor: student.isAtRisk ? '#EF4444' : 'var(--color-mint-teal)',
                          }}
                        />
                      </div>
                    </div>
                  </td>
                  <td style={styles.td}>
                    <span style={styles.wpmText}>{student.averageWpm} WPM</span>
                  </td>
                  <td style={styles.td}>
                    <span style={styles.scoreText}>{student.writingScore}/100</span>
                  </td>
                  <td style={styles.td}>
                    {student.isAtRisk ? (
                      <span className="badge badge-risk">
                        <AlertTriangle size={11} /> At Risk (&lt;75%)
                      </span>
                    ) : (
                      <span className="badge badge-success">
                        <FileCheck2 size={11} /> On Track
                      </span>
                    )}
                  </td>
                  <td style={styles.td}>
                    <button
                      onClick={() => onSelectStudent(student)}
                      style={styles.detailButton}
                    >
                      View Report
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '1.25rem',
  },
  metricCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 'var(--radius-lg)',
    padding: '1.25rem',
    border: '1px solid var(--color-slate-200)',
    boxShadow: 'var(--shadow-sm)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
  },
  metricHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metricLabel: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--color-slate-500)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  iconWrapper: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValue: {
    fontSize: '1.9rem',
    fontWeight: 800,
    color: 'var(--color-deep-forest)',
    lineHeight: 1.2,
  },
  unitText: {
    fontSize: '1rem',
    fontWeight: 600,
    color: 'var(--color-slate-500)',
  },
  metricSub: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    fontSize: '0.78rem',
    marginTop: '0.15rem',
  },
  positiveText: {
    color: '#059669',
    fontWeight: 600,
  },
  neutralText: {
    color: 'var(--color-slate-500)',
    fontWeight: 500,
  },
  chartsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
    gap: '1.25rem',
  },
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 'var(--radius-lg)',
    padding: '1.35rem',
    border: '1px solid var(--color-slate-200)',
    boxShadow: 'var(--shadow-sm)',
  },
  chartHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '1rem',
  },
  chartTitle: {
    fontSize: '1.05rem',
    fontWeight: 700,
    color: 'var(--color-deep-forest)',
  },
  chartSubtitle: {
    fontSize: '0.78rem',
    color: 'var(--color-slate-500)',
    marginTop: '0.15rem',
  },
  atRiskBanner: {
    backgroundColor: '#FFF5F5',
    border: '1px solid #FECACA',
    borderRadius: 'var(--radius-lg)',
    padding: '1.15rem 1.5rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '1rem',
  },
  atRiskBannerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  alertIconCircle: {
    width: '42px',
    height: '42px',
    borderRadius: '50%',
    backgroundColor: '#FEE2E2',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  bannerTitle: {
    fontSize: '0.98rem',
    fontWeight: 700,
    color: '#991B1B',
  },
  bannerDesc: {
    fontSize: '0.8rem',
    color: '#7F1D1D',
    marginTop: '0.2rem',
  },
  bannerButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    backgroundColor: '#DC2626',
    color: '#FFFFFF',
    padding: '0.55rem 1.1rem',
    borderRadius: 'var(--radius-md)',
    fontWeight: 700,
    fontSize: '0.84rem',
  },
  tableCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 'var(--radius-lg)',
    padding: '1.35rem',
    border: '1px solid var(--color-slate-200)',
    boxShadow: 'var(--shadow-sm)',
  },
  tableHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '1.1rem',
  },
  viewAllButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    color: 'var(--color-deep-forest)',
    fontWeight: 700,
    fontSize: '0.84rem',
  },
  tableResponsive: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
  },
  trHead: {
    borderBottom: '1px solid var(--color-slate-200)',
  },
  th: {
    padding: '0.75rem 0.85rem',
    fontSize: '0.74rem',
    fontWeight: 700,
    color: 'var(--color-slate-500)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  trBody: {
    borderBottom: '1px solid var(--color-slate-100)',
    transition: 'background-color 0.1s ease',
  },
  td: {
    padding: '0.85rem',
    fontSize: '0.86rem',
    verticalAlign: 'middle',
  },
  studentNameWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  studentAvatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    backgroundColor: 'var(--color-light-green)',
    color: 'var(--color-deep-forest)',
    fontSize: '0.75rem',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameText: {
    fontWeight: 700,
    color: 'var(--color-slate-900)',
  },
  subText: {
    fontSize: '0.72rem',
    color: 'var(--color-slate-400)',
  },
  codeBadge: {
    fontSize: '0.76rem',
    backgroundColor: 'var(--color-soft-cream)',
    padding: '0.2rem 0.45rem',
    borderRadius: '4px',
    color: 'var(--color-deep-forest)',
    fontFamily: 'monospace',
    border: '1px solid var(--color-leaf-tint)',
  },
  accuracyWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
    width: '110px',
  },
  progressBar: {
    width: '100%',
    height: '5px',
    backgroundColor: 'var(--color-slate-200)',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: '3px',
  },
  wpmText: {
    fontWeight: 600,
    color: 'var(--color-slate-700)',
  },
  scoreText: {
    fontWeight: 600,
    color: 'var(--color-slate-700)',
  },
  detailButton: {
    padding: '0.45rem 0.85rem',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--color-leaf-tint)',
    backgroundColor: 'var(--color-soft-cream)',
    color: 'var(--color-deep-forest)',
    fontWeight: 600,
    fontSize: '0.78rem',
  },
};
