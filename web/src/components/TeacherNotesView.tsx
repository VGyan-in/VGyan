import React, { useState } from 'react';
import { MessageSquare, Plus, Send, Tag, User, Clock } from 'lucide-react';
import { TeacherComment, Student } from '../types';

interface TeacherNotesViewProps {
  comments: TeacherComment[];
  students: Student[];
  onAddComment: (studentId: string, studentName: string, text: string, category?: any) => void;
}

export const TeacherNotesView: React.FC<TeacherNotesViewProps> = ({
  comments,
  students,
  onAddComment,
}) => {
  const [selectedStudentId, setSelectedStudentId] = useState(students[0]?.studentId || '');
  const [category, setCategory] = useState<'Intervention' | 'Praise' | 'Parent Note' | 'General'>('Intervention');
  const [text, setText] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    const student = students.find((s) => s.studentId === selectedStudentId);
    if (!student) return;
    onAddComment(student.studentId, student.name, text, category);
    setText('');
  };

  const filtered = comments.filter((c) =>
    filterCategory === 'all' ? true : c.category === filterCategory
  );

  return (
    <div style={styles.container} className="fade-in">
      {/* Create Note Card */}
      <div style={styles.createCard}>
        <div style={styles.createHeader}>
          <MessageSquare size={18} color="var(--color-deep-forest)" />
          <h3 style={styles.createTitle}>Log Pedagogical Observation & Action Note</h3>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.formRow}>
            <div style={styles.fieldWrap}>
              <label style={styles.label}>Select Student:</label>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                style={styles.select}
              >
                {students.map((s) => (
                  <option key={s.studentId} value={s.studentId}>
                    {s.name} ({s.studentId}) {s.isAtRisk ? '— [At-Risk]' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div style={styles.fieldWrap}>
              <label style={styles.label}>Note Type:</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                style={styles.select}
              >
                <option value="Intervention">Intervention (1-on-1 Practice)</option>
                <option value="Praise">Praise & Achievement</option>
                <option value="Parent Note">Parent Communication</option>
                <option value="General">General Classroom Note</option>
              </select>
            </div>
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type your notes on student reading progress, behavioral observations or assigned practice passages..."
            rows={3}
            style={styles.textarea}
            required
          />

          <button type="submit" style={styles.submitBtn}>
            <Send size={15} />
            <span>Save Observation Note</span>
          </button>
        </form>
      </div>

      {/* Notes List */}
      <div style={styles.listSection}>
        <div style={styles.listHeader}>
          <h4 style={styles.listTitle}>Recorded Teacher Observations ({filtered.length})</h4>
          <div style={styles.categoryFilters}>
            {(['all', 'Intervention', 'Praise', 'Parent Note', 'General'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                style={{
                  ...styles.catFilterBtn,
                  ...(filterCategory === cat ? styles.catFilterBtnActive : {}),
                }}
              >
                {cat === 'all' ? 'All Categories' : cat}
              </button>
            ))}
          </div>
        </div>

        <div style={styles.notesGrid}>
          {filtered.map((cmt) => (
            <div key={cmt.id} style={styles.noteCard}>
              <div style={styles.noteTop}>
                <div style={styles.studentInfo}>
                  <User size={14} color="var(--color-slate-500)" />
                  <span style={styles.studentName}>{cmt.studentName}</span>
                  <span style={styles.studentIdBadge}>{cmt.studentId}</span>
                </div>
                <span
                  style={{
                    ...styles.categoryBadge,
                    backgroundColor:
                      cmt.category === 'Intervention'
                        ? '#FEF2F2'
                        : cmt.category === 'Praise'
                        ? '#ECFDF5'
                        : '#FFFBEB',
                    color:
                      cmt.category === 'Intervention'
                        ? '#DC2626'
                        : cmt.category === 'Praise'
                        ? '#059669'
                        : '#D97706',
                  }}
                >
                  {cmt.category}
                </span>
              </div>

              <p style={styles.noteText}>{cmt.text}</p>

              <div style={styles.noteFooter}>
                <span>By: <strong>{cmt.author}</strong></span>
                <div style={styles.timestamp}>
                  <Clock size={12} />
                  <span>{cmt.timestamp}</span>
                </div>
              </div>
            </div>
          ))}
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
  createCard: {
    backgroundColor: '#FFFFFF',
    border: '1px solid var(--color-slate-200)',
    borderRadius: 'var(--radius-lg)',
    padding: '1.35rem 1.5rem',
    boxShadow: 'var(--shadow-sm)',
  },
  createHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '1rem',
  },
  createTitle: {
    fontSize: '1.1rem',
    fontWeight: 700,
    color: 'var(--color-deep-forest)',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  formRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '1rem',
  },
  fieldWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
  },
  label: {
    fontSize: '0.78rem',
    fontWeight: 700,
    color: 'var(--color-slate-600)',
    textTransform: 'uppercase',
  },
  select: {
    width: '100%',
    padding: '0.55rem 0.75rem',
  },
  textarea: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '0.75rem',
  },
  submitBtn: {
    alignSelf: 'flex-end',
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    backgroundColor: 'var(--color-deep-forest)',
    color: '#FFFFFF',
    padding: '0.6rem 1.25rem',
    borderRadius: 'var(--radius-md)',
    fontWeight: 700,
    fontSize: '0.86rem',
  },
  listSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  listHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '0.75rem',
  },
  listTitle: {
    fontSize: '1.1rem',
    fontWeight: 700,
    color: 'var(--color-deep-forest)',
  },
  categoryFilters: {
    display: 'flex',
    gap: '0.35rem',
    flexWrap: 'wrap',
  },
  catFilterBtn: {
    fontSize: '0.76rem',
    fontWeight: 600,
    padding: '0.3rem 0.65rem',
    borderRadius: 'var(--radius-full)',
    backgroundColor: '#FFFFFF',
    border: '1px solid var(--color-slate-200)',
    color: 'var(--color-slate-600)',
  },
  catFilterBtnActive: {
    backgroundColor: 'var(--color-deep-forest)',
    color: '#FFFFFF',
    borderColor: 'var(--color-deep-forest)',
  },
  notesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '1rem',
  },
  noteCard: {
    backgroundColor: '#FFFFFF',
    border: '1px solid var(--color-slate-200)',
    borderRadius: 'var(--radius-lg)',
    padding: '1.25rem',
    boxShadow: 'var(--shadow-sm)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  noteTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  studentInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
  },
  studentName: {
    fontSize: '0.9rem',
    fontWeight: 700,
    color: 'var(--color-deep-forest)',
  },
  studentIdBadge: {
    fontSize: '0.72rem',
    color: 'var(--color-slate-400)',
  },
  categoryBadge: {
    fontSize: '0.72rem',
    fontWeight: 700,
    padding: '0.15rem 0.5rem',
    borderRadius: 'var(--radius-full)',
  },
  noteText: {
    fontSize: '0.86rem',
    lineHeight: 1.45,
    color: 'var(--color-slate-700)',
  },
  noteFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: '0.74rem',
    color: 'var(--color-slate-400)',
    marginTop: 'auto',
    paddingTop: '0.5rem',
    borderTop: '1px solid var(--color-slate-100)',
  },
  timestamp: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
  },
};
