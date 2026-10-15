import React, { useState } from 'react';
import { AlertTriangle, Plus, CheckCircle, MessageSquare, ArrowRight, ShieldAlert } from 'lucide-react';
import { Student } from '../types';

interface AtRiskWatchlistProps {
  students: Student[];
  onSelectStudent: (s: Student) => void;
  onAddComment: (studentId: string, studentName: string, text: string) => void;
}

export const AtRiskWatchlist: React.FC<AtRiskWatchlistProps> = ({
  students,
  onSelectStudent,
  onAddComment,
}) => {
  const atRiskList = students.filter((s) => s.isAtRisk || s.overallReadingAccuracy < 75);
  const [commentStudent, setCommentStudent] = useState<Student | null>(null);
  const [commentText, setCommentText] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSubmitComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentStudent || !commentText.trim()) return;
    onAddComment(commentStudent.studentId, commentStudent.name, commentText);
    setCommentText('');
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      setCommentStudent(null);
    }, 1200);
  };

  return (
    <div style={styles.container} className="fade-in">
      {/* Header Banner */}
      <div style={styles.banner}>
        <div style={styles.bannerIcon}>
          <ShieldAlert size={28} color="#DC2626" />
        </div>
        <div>
          <h3 style={styles.bannerTitle}>
            Early Intervention Watchlist (Reading Accuracy &lt; 75%)
          </h3>
          <p style={styles.bannerDesc}>
            These students are flagged based on the VGyan pedagogical model for urgent 1-on-1 reading assistance and phonics practice.
          </p>
        </div>
      </div>

      {/* Cards Grid */}
      <div style={styles.cardsGrid}>
        {atRiskList.map((student) => (
          <div key={student.studentId} style={styles.card}>
            <div style={styles.cardTop}>
              <div style={styles.avatarWrap}>
                <span style={styles.avatar}>{student.name.slice(0, 2).toUpperCase()}</span>
                <div>
                  <h4 style={styles.name}>{student.name}</h4>
                  <span style={styles.id}>{student.studentId} • {student.participantId}</span>
                </div>
              </div>
              <span className="badge badge-risk">
                {student.overallReadingAccuracy}% Accuracy
              </span>
            </div>

            {/* Diagnostic Alert Box */}
            <div style={styles.reasonBox}>
              <div style={styles.reasonHeader}>
                <AlertTriangle size={14} color="#DC2626" />
                <span style={styles.reasonLabel}>Identified Obstacle:</span>
              </div>
              <p style={styles.reasonText}>
                {student.atRiskReason || 'Frequent omissions and low speech recognition confidence.'}
              </p>
            </div>

            {/* Stats Row */}
            <div style={styles.statsRow}>
              <div style={styles.statItem}>
                <span style={styles.statLabel}>Reading Speed</span>
                <span style={styles.statVal}>{student.averageWpm} WPM</span>
                <span style={styles.statBenchmark}>(Benchmark: 70 WPM)</span>
              </div>
              <div style={styles.statItem}>
                <span style={styles.statLabel}>Pronunciation</span>
                <span style={styles.statVal}>{student.radarSkills.pronunciation}%</span>
              </div>
              <div style={styles.statItem}>
                <span style={styles.statLabel}>Fluency Score</span>
                <span style={styles.statVal}>{student.radarSkills.fluency}%</span>
              </div>
            </div>

            {/* Action Bar */}
            <div style={styles.cardActions}>
              <button
                onClick={() => setCommentStudent(student)}
                style={styles.commentBtn}
              >
                <MessageSquare size={14} />
                <span>Log Intervention</span>
              </button>
              <button
                onClick={() => onSelectStudent(student)}
                style={styles.viewBtn}
              >
                <span>Full Diagnosis</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Comment Modal */}
      {commentStudent && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent} className="fade-in">
            <div style={styles.modalHeader}>
              <h4 style={styles.modalTitle}>Log Teacher Intervention Note</h4>
              <button
                onClick={() => setCommentStudent(null)}
                style={styles.closeBtn}
              >
                ✕
              </button>
            </div>
            <p style={styles.modalSubtitle}>
              Student: <strong>{commentStudent.name}</strong> ({commentStudent.studentId})
            </p>

            {savedSuccess ? (
              <div style={styles.successMessage}>
                <CheckCircle size={20} color="#059669" />
                <span>Note saved to student assessment file!</span>
              </div>
            ) : (
              <form onSubmit={handleSubmitComment}>
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="E.g., Conducted 10-minute paired reading on Kannada conjuncts. Recommended reading practice sheet #3."
                  rows={4}
                  style={styles.modalTextarea}
                  required
                />
                <div style={styles.modalActions}>
                  <button
                    type="button"
                    onClick={() => setCommentStudent(null)}
                    style={styles.cancelBtn}
                  >
                    Cancel
                  </button>
                  <button type="submit" style={styles.saveBtn}>
                    Save Note
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  banner: {
    backgroundColor: '#FEF2F2',
    border: '1px solid #FCA5A5',
    borderRadius: 'var(--radius-lg)',
    padding: '1.25rem 1.5rem',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  bannerIcon: {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    backgroundColor: '#FEE2E2',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  bannerTitle: {
    fontSize: '1.1rem',
    fontWeight: 700,
    color: '#991B1B',
  },
  bannerDesc: {
    fontSize: '0.84rem',
    color: '#7F1D1D',
    marginTop: '0.2rem',
  },
  cardsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '1.25rem',
  },
  card: {
    backgroundColor: '#FFFFFF',
    border: '1px solid #FECACA',
    borderRadius: 'var(--radius-lg)',
    padding: '1.25rem',
    boxShadow: 'var(--shadow-sm)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.85rem',
  },
  cardTop: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  avatarWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  avatar: {
    width: '38px',
    height: '38px',
    borderRadius: '50%',
    backgroundColor: '#FEE2E2',
    color: '#DC2626',
    fontWeight: 800,
    fontSize: '0.85rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontSize: '0.98rem',
    fontWeight: 700,
    color: 'var(--color-slate-900)',
  },
  id: {
    fontSize: '0.74rem',
    color: 'var(--color-slate-500)',
  },
  reasonBox: {
    backgroundColor: '#FFF5F5',
    borderRadius: 'var(--radius-sm)',
    padding: '0.7rem 0.85rem',
    border: '1px solid #FEE2E2',
  },
  reasonHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    marginBottom: '0.25rem',
  },
  reasonLabel: {
    fontSize: '0.72rem',
    fontWeight: 700,
    color: '#B91C1C',
    textTransform: 'uppercase',
  },
  reasonText: {
    fontSize: '0.8rem',
    color: '#7F1D1D',
    lineHeight: 1.35,
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: '0.5rem',
    padding: '0.65rem 0',
    borderTop: '1px solid var(--color-slate-100)',
    borderBottom: '1px solid var(--color-slate-100)',
  },
  statItem: {
    display: 'flex',
    flexDirection: 'column',
  },
  statLabel: {
    fontSize: '0.68rem',
    color: 'var(--color-slate-500)',
    fontWeight: 600,
    textTransform: 'uppercase',
  },
  statVal: {
    fontSize: '1rem',
    fontWeight: 700,
    color: 'var(--color-slate-800)',
  },
  statBenchmark: {
    fontSize: '0.65rem',
    color: '#DC2626',
  },
  cardActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
    marginTop: 'auto',
  },
  commentBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.35rem',
    backgroundColor: 'var(--color-soft-cream)',
    border: '1px solid var(--color-leaf-tint)',
    color: 'var(--color-deep-forest)',
    borderRadius: 'var(--radius-md)',
    padding: '0.5rem',
    fontWeight: 600,
    fontSize: '0.78rem',
  },
  viewBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.35rem',
    backgroundColor: 'var(--color-deep-forest)',
    color: '#FFFFFF',
    borderRadius: 'var(--radius-md)',
    padding: '0.5rem',
    fontWeight: 600,
    fontSize: '0.78rem',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(11, 61, 46, 0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 'var(--radius-lg)',
    padding: '1.5rem',
    width: '90%',
    maxWidth: '480px',
    boxShadow: 'var(--shadow-lg)',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '0.4rem',
  },
  modalTitle: {
    fontSize: '1.15rem',
    fontWeight: 700,
    color: 'var(--color-deep-forest)',
  },
  closeBtn: {
    fontSize: '1rem',
    color: 'var(--color-slate-400)',
    padding: '0.2rem 0.5rem',
  },
  modalSubtitle: {
    fontSize: '0.84rem',
    color: 'var(--color-slate-600)',
    marginBottom: '1rem',
  },
  modalTextarea: {
    width: '100%',
    boxSizing: 'border-box',
    marginBottom: '1rem',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.65rem',
  },
  cancelBtn: {
    padding: '0.55rem 1rem',
    borderRadius: 'var(--radius-md)',
    color: 'var(--color-slate-600)',
    fontWeight: 600,
    fontSize: '0.84rem',
  },
  saveBtn: {
    padding: '0.55rem 1.25rem',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--color-deep-forest)',
    color: '#FFFFFF',
    fontWeight: 700,
    fontSize: '0.84rem',
  },
  successMessage: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    color: '#059669',
    fontWeight: 600,
    fontSize: '0.9rem',
    padding: '1rem 0',
  },
};
