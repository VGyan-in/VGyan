import React, { useState } from 'react';
import { Search, Filter, ShieldCheck, AlertTriangle, CheckCircle2, ChevronRight, User } from 'lucide-react';
import { Student } from '../types';

interface StudentDirectoryProps {
  students: Student[];
  onSelectStudent: (s: Student) => void;
}

export const StudentDirectory: React.FC<StudentDirectoryProps> = ({
  students,
  onSelectStudent,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'at-risk' | 'on-track'>('all');
  const [langFilter, setLangFilter] = useState<string>('all');

  const filteredStudents = students.filter((student) => {
    const matchesSearch =
      student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.studentId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.participantId.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'at-risk'
        ? student.isAtRisk
        : !student.isAtRisk;

    const matchesLang =
      langFilter === 'all' ? true : student.nativeLanguage === langFilter;

    return matchesSearch && matchesStatus && matchesLang;
  });

  return (
    <div style={styles.container} className="fade-in">
      {/* Control Bar: Search and Filters */}
      <div style={styles.controlBar}>
        <div style={styles.searchWrap}>
          <Search size={16} color="var(--color-slate-400)" />
          <input
            type="text"
            placeholder="Search by student name, ID or Participant ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={styles.searchInput}
          />
        </div>

        <div style={styles.filterGroup}>
          <div style={styles.filterItem}>
            <Filter size={14} color="var(--color-slate-500)" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              style={styles.select}
            >
              <option value="all">All Statuses ({students.length})</option>
              <option value="at-risk">At Risk (&lt; 75%)</option>
              <option value="on-track">On Track</option>
            </select>
          </div>

          <div style={styles.filterItem}>
            <select
              value={langFilter}
              onChange={(e) => setLangFilter(e.target.value)}
              style={styles.select}
            >
              <option value="all">All Home Languages</option>
              <option value="Kannada">Kannada</option>
              <option value="Tamil">Tamil</option>
              <option value="Urdu">Urdu</option>
            </select>
          </div>
        </div>
      </div>

      {/* Directory Table */}
      <div style={styles.tableCard}>
        <div style={styles.tableResponsive}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.trHead}>
                <th style={styles.th}>Student Name & ID</th>
                <th style={styles.th}>Participant ID (Research)</th>
                <th style={styles.th}>Home Language</th>
                <th style={styles.th}>Consent</th>
                <th style={styles.th}>Reading Acc.</th>
                <th style={styles.th}>Fluency (WPM)</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((student) => (
                <tr
                  key={student.studentId}
                  style={styles.trBody}
                  onClick={() => onSelectStudent(student)}
                >
                  <td style={styles.td}>
                    <div style={styles.studentNameWrap}>
                      <span style={styles.studentAvatar}>
                        {student.name.slice(0, 2).toUpperCase()}
                      </span>
                      <div>
                        <div style={styles.nameText}>{student.name}</div>
                        <div style={styles.subText}>{student.studentId} • Class {student.grade}{student.section}</div>
                      </div>
                    </div>
                  </td>
                  <td style={styles.td}>
                    <code style={styles.codeBadge}>{student.participantId}</code>
                  </td>
                  <td style={styles.td}>
                    <span style={styles.langPill}>{student.nativeLanguage}</span>
                  </td>
                  <td style={styles.td}>
                    <span className="badge badge-teal" title="Guardian Research Consent Active">
                      <ShieldCheck size={12} /> Active
                    </span>
                  </td>
                  <td style={styles.td}>
                    <div style={styles.accCol}>
                      <span
                        style={{
                          fontWeight: 700,
                          color: student.isAtRisk ? '#DC2626' : 'var(--color-deep-forest)',
                        }}
                      >
                        {student.overallReadingAccuracy}%
                      </span>
                      <div style={styles.bar}>
                        <div
                          style={{
                            ...styles.barFill,
                            width: `${student.overallReadingAccuracy}%`,
                            backgroundColor: student.isAtRisk ? '#EF4444' : 'var(--color-mint-teal)',
                          }}
                        />
                      </div>
                    </div>
                  </td>
                  <td style={styles.td}>
                    <span style={styles.wpmVal}>{student.averageWpm} WPM</span>
                  </td>
                  <td style={styles.td}>
                    {student.isAtRisk ? (
                      <span className="badge badge-risk">
                        <AlertTriangle size={11} /> At Risk
                      </span>
                    ) : (
                      <span className="badge badge-success">
                        <CheckCircle2 size={11} /> On Track
                      </span>
                    )}
                  </td>
                  <td style={styles.td}>
                    <button style={styles.actionBtn} onClick={() => onSelectStudent(student)}>
                      <span>Details</span>
                      <ChevronRight size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={8} style={styles.emptyTd}>
                    No students match your filter criteria.
                  </td>
                </tr>
              )}
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
    gap: '1.25rem',
  },
  controlBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '1rem',
  },
  searchWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
    backgroundColor: '#FFFFFF',
    border: '1px solid var(--color-slate-200)',
    borderRadius: 'var(--radius-md)',
    padding: '0.5rem 0.85rem',
    width: '380px',
    maxWidth: '100%',
    boxShadow: 'var(--shadow-sm)',
  },
  searchInput: {
    border: 'none',
    padding: 0,
    outline: 'none',
    width: '100%',
    fontSize: '0.86rem',
    boxShadow: 'none',
  },
  filterGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  filterItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    backgroundColor: '#FFFFFF',
    border: '1px solid var(--color-slate-200)',
    borderRadius: 'var(--radius-md)',
    padding: '0.2rem 0.65rem',
    boxShadow: 'var(--shadow-sm)',
  },
  select: {
    border: 'none',
    padding: '0.35rem 0.4rem',
    fontSize: '0.84rem',
    fontWeight: 600,
    color: 'var(--color-slate-700)',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    outline: 'none',
    boxShadow: 'none',
  },
  tableCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--color-slate-200)',
    boxShadow: 'var(--shadow-sm)',
    overflow: 'hidden',
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
    backgroundColor: 'var(--color-soft-cream)',
    borderBottom: '1px solid var(--color-slate-200)',
  },
  th: {
    padding: '0.85rem 1rem',
    fontSize: '0.74rem',
    fontWeight: 700,
    color: 'var(--color-slate-500)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  trBody: {
    borderBottom: '1px solid var(--color-slate-100)',
    cursor: 'pointer',
    transition: 'background-color 0.15s ease',
  },
  td: {
    padding: '0.85rem 1rem',
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
    fontWeight: 700,
    fontSize: '0.78rem',
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
  langPill: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--color-slate-700)',
  },
  accCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.2rem',
    width: '90px',
  },
  bar: {
    width: '100%',
    height: '5px',
    backgroundColor: 'var(--color-slate-200)',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: '3px',
  },
  wpmVal: {
    fontWeight: 600,
    color: 'var(--color-slate-700)',
  },
  actionBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
    color: 'var(--color-deep-forest)',
    fontWeight: 700,
    fontSize: '0.78rem',
  },
  emptyTd: {
    padding: '2.5rem',
    textAlign: 'center',
    color: 'var(--color-slate-400)',
    fontStyle: 'italic',
  },
};
