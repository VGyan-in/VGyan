import React, { useState } from 'react';
import { PenTool, Image as ImageIcon, Sparkles, CheckCircle, FileText } from 'lucide-react';
import { Student } from '../types';

interface WritingSubmissionsViewProps {
  students: Student[];
}

export const WritingSubmissionsView: React.FC<WritingSubmissionsViewProps> = ({ students }) => {
  const allWriting = students.flatMap((s) => s.recentWritingAttempts);

  return (
    <div style={styles.container} className="fade-in">
      <div style={styles.header}>
        <div>
          <h3 style={styles.title}>Student Writing Submissions & OCR Evaluations</h3>
          <p style={styles.subtitle}>
            Review digitized student handwritten pages and typed essays evaluated by the Gemini writing proxy.
          </p>
        </div>
        <span className="badge badge-forest">{allWriting.length} Submissions</span>
      </div>

      <div style={styles.list}>
        {allWriting.map((item) => (
          <div key={item.id} style={styles.card}>
            <div style={styles.cardTop}>
              <div style={styles.studentInfo}>
                <span style={styles.avatar}>{item.studentName.slice(0, 2).toUpperCase()}</span>
                <div>
                  <h4 style={styles.name}>{item.studentName}</h4>
                  <span style={styles.meta}>
                    {item.studentId} • {item.participantId} • Prompt: <strong>"{item.promptTitle}"</strong>
                  </span>
                </div>
              </div>
              <div style={styles.topRight}>
                <span className="badge badge-teal">
                  {item.mode === 'handwritten_photo' ? 'Handwritten OCR' : 'Typed Essay'}
                </span>
                <span className="badge badge-forest">Score: {item.grammarScore}/100</span>
              </div>
            </div>

            {/* Comparison Box */}
            <div style={styles.bodyGrid}>
              {item.rawOcrText && (
                <div style={styles.col}>
                  <div style={styles.colHeader}>
                    <ImageIcon size={14} color="var(--color-slate-500)" />
                    <span>Raw OCR Output (Backend OCR Space):</span>
                  </div>
                  <div style={styles.textBox}>{item.rawOcrText}</div>
                </div>
              )}

              <div style={styles.col}>
                <div style={styles.colHeader}>
                  <FileText size={14} color="var(--color-deep-forest)" />
                  <span>Student Final Corrected Text:</span>
                </div>
                <div style={{ ...styles.textBox, backgroundColor: '#FFFFFF', borderColor: 'var(--color-leaf-tint)' }}>
                  {item.studentCorrectedText}
                </div>
              </div>
            </div>

            {/* AI Feedback */}
            <div style={styles.aiBox}>
              <div style={styles.aiHeader}>
                <Sparkles size={14} color="#059669" />
                <span style={styles.aiTitle}>AI Feedback on Grammar, Vocabulary & Structure:</span>
              </div>
              <p style={styles.aiText}>{item.aiFeedback}</p>
            </div>
          </div>
        ))}
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
  header: {
    backgroundColor: '#FFFFFF',
    border: '1px solid var(--color-slate-200)',
    borderRadius: 'var(--radius-lg)',
    padding: '1.25rem 1.5rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: '1.15rem',
    fontWeight: 700,
    color: 'var(--color-deep-forest)',
  },
  subtitle: {
    fontSize: '0.82rem',
    color: 'var(--color-slate-500)',
    marginTop: '0.2rem',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  card: {
    backgroundColor: '#FFFFFF',
    border: '1px solid var(--color-slate-200)',
    borderRadius: 'var(--radius-lg)',
    padding: '1.35rem',
    boxShadow: 'var(--shadow-sm)',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  cardTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '0.75rem',
  },
  studentInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  avatar: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    backgroundColor: 'var(--color-light-green)',
    color: 'var(--color-deep-forest)',
    fontWeight: 700,
    fontSize: '0.82rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontSize: '1.05rem',
    fontWeight: 700,
    color: 'var(--color-deep-forest)',
  },
  meta: {
    fontSize: '0.78rem',
    color: 'var(--color-slate-500)',
  },
  topRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  bodyGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '1rem',
  },
  col: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
  },
  colHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    fontSize: '0.74rem',
    fontWeight: 700,
    color: 'var(--color-slate-600)',
    textTransform: 'uppercase',
  },
  textBox: {
    backgroundColor: 'var(--color-soft-cream)',
    border: '1px solid var(--color-slate-200)',
    borderRadius: 'var(--radius-md)',
    padding: '0.85rem',
    fontSize: '0.86rem',
    lineHeight: 1.45,
    color: 'var(--color-slate-800)',
    minHeight: '70px',
  },
  aiBox: {
    backgroundColor: '#F0FDF4',
    border: '1px solid #BBF7D0',
    borderRadius: 'var(--radius-md)',
    padding: '0.85rem 1rem',
  },
  aiHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    marginBottom: '0.25rem',
  },
  aiTitle: {
    fontSize: '0.76rem',
    fontWeight: 700,
    color: '#166534',
    textTransform: 'uppercase',
  },
  aiText: {
    fontSize: '0.84rem',
    color: '#14532D',
    lineHeight: 1.4,
  },
};
