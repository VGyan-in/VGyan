import React, { useState } from 'react';
import { FileText, Volume2, Sparkles, BookOpen, Layers } from 'lucide-react';
import { MissedWord } from '../types';

interface MissedWordsViewProps {
  missedWords: MissedWord[];
}

export const MissedWordsView: React.FC<MissedWordsViewProps> = ({ missedWords }) => {
  const [selectedLang, setSelectedLang] = useState<'All' | 'English' | 'Kannada'>('All');

  const filtered = missedWords.filter((w) =>
    selectedLang === 'All' ? true : w.language === selectedLang
  );

  return (
    <div style={styles.container} className="fade-in">
      {/* Header Info */}
      <div style={styles.headerCard}>
        <div>
          <h3 style={styles.headerTitle}>Frequently Mispronounced & Skipped Words</h3>
          <p style={styles.headerSub}>
            Aggregated phonetic error patterns extracted by Vosk ASR across all student reading sessions.
          </p>
        </div>
        <div style={styles.langButtons}>
          {(['All', 'English', 'Kannada'] as const).map((lang) => (
            <button
              key={lang}
              onClick={() => setSelectedLang(lang)}
              style={{
                ...styles.langBtn,
                ...(selectedLang === lang ? styles.langBtnActive : {}),
              }}
            >
              {lang}
            </button>
          ))}
        </div>
      </div>

      {/* Words Grid */}
      <div style={styles.wordsGrid}>
        {filtered.map((item, idx) => (
          <div key={idx} style={styles.wordCard}>
            <div style={styles.wordTop}>
              <div>
                <span className={item.language === 'Kannada' ? 'badge badge-forest' : 'badge badge-teal'}>
                  {item.language}
                </span>
                <h4 style={styles.wordText}>{item.word}</h4>
              </div>
              <div style={styles.freqBadge}>
                <span style={styles.freqNum}>{item.frequency}</span>
                <span style={styles.freqLbl}>Misses</span>
              </div>
            </div>

            <div style={styles.errorTypeRow}>
              <span style={styles.errorLabel}>Primary Error:</span>
              <span
                style={{
                  ...styles.errorVal,
                  color: item.primaryError === 'omission' ? '#DC2626' : '#D97706',
                  backgroundColor: item.primaryError === 'omission' ? '#FEE2E2' : '#FEF3C7',
                }}
              >
                {item.primaryError.toUpperCase()}
              </span>
            </div>

            {item.commonSubstitutions.length > 0 && (
              <div style={styles.subsRow}>
                <span style={styles.subsLabel}>Commonly heard as:</span>
                <div style={styles.subsTags}>
                  {item.commonSubstitutions.map((sub, sIdx) => (
                    <span key={sIdx} style={styles.subTag}>
                      "{sub}"
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div style={styles.affectedRow}>
              <Layers size={13} color="var(--color-slate-400)" />
              <span style={styles.affectedText}>
                Impacts <strong>{item.affectedStudentsCount} students</strong> in this class
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Recommended Practice Drill */}
      <div style={styles.drillBanner}>
        <div style={styles.drillIcon}>
          <Sparkles size={22} color="#059669" />
        </div>
        <div>
          <h4 style={styles.drillTitle}>Teacher Recommendation for Next Session</h4>
          <p style={styles.drillDesc}>
            Prioritize classroom choral reading for Kannada words with the <em>"ಪ್ರ"</em> conjunct consonant, and English three-consonant cluster words (<em>"pitcher", "through"</em>).
          </p>
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
  headerCard: {
    backgroundColor: '#FFFFFF',
    border: '1px solid var(--color-slate-200)',
    borderRadius: 'var(--radius-lg)',
    padding: '1.25rem 1.5rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '1rem',
  },
  headerTitle: {
    fontSize: '1.15rem',
    fontWeight: 700,
    color: 'var(--color-deep-forest)',
  },
  headerSub: {
    fontSize: '0.82rem',
    color: 'var(--color-slate-500)',
    marginTop: '0.2rem',
  },
  langButtons: {
    display: 'flex',
    backgroundColor: 'var(--color-soft-cream)',
    padding: '0.25rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-leaf-tint)',
    gap: '0.2rem',
  },
  langBtn: {
    padding: '0.45rem 0.85rem',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--color-slate-600)',
  },
  langBtnActive: {
    backgroundColor: 'var(--color-deep-forest)',
    color: '#FFFFFF',
  },
  wordsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '1.25rem',
  },
  wordCard: {
    backgroundColor: '#FFFFFF',
    border: '1px solid var(--color-slate-200)',
    borderRadius: 'var(--radius-lg)',
    padding: '1.25rem',
    boxShadow: 'var(--shadow-sm)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  wordTop: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  wordText: {
    fontSize: '1.2rem',
    fontWeight: 800,
    color: 'var(--color-deep-forest)',
    marginTop: '0.35rem',
  },
  freqBadge: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    backgroundColor: 'var(--color-soft-cream)',
    border: '1px solid var(--color-leaf-tint)',
    padding: '0.35rem 0.65rem',
    borderRadius: 'var(--radius-md)',
  },
  freqNum: {
    fontSize: '1.1rem',
    fontWeight: 800,
    color: 'var(--color-deep-forest)',
  },
  freqLbl: {
    fontSize: '0.65rem',
    color: 'var(--color-slate-500)',
    textTransform: 'uppercase',
  },
  errorTypeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.82rem',
  },
  errorLabel: {
    color: 'var(--color-slate-500)',
  },
  errorVal: {
    fontSize: '0.72rem',
    fontWeight: 700,
    padding: '0.15rem 0.45rem',
    borderRadius: '4px',
  },
  subsRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
  },
  subsLabel: {
    fontSize: '0.74rem',
    color: 'var(--color-slate-500)',
  },
  subsTags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.35rem',
  },
  subTag: {
    backgroundColor: 'var(--color-soft-cream)',
    fontSize: '0.76rem',
    color: 'var(--color-slate-700)',
    padding: '0.2rem 0.5rem',
    borderRadius: '4px',
    border: '1px solid var(--color-leaf-tint)',
  },
  affectedRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    marginTop: 'auto',
    paddingTop: '0.5rem',
    borderTop: '1px solid var(--color-slate-100)',
  },
  affectedText: {
    fontSize: '0.76rem',
    color: 'var(--color-slate-500)',
  },
  drillBanner: {
    backgroundColor: '#ECFDF5',
    border: '1px solid #A7F3D0',
    borderRadius: 'var(--radius-lg)',
    padding: '1.25rem 1.5rem',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  drillIcon: {
    width: '42px',
    height: '42px',
    borderRadius: '50%',
    backgroundColor: '#D1FAE5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  drillTitle: {
    fontSize: '0.98rem',
    fontWeight: 700,
    color: '#065F46',
  },
  drillDesc: {
    fontSize: '0.84rem',
    color: '#047857',
    marginTop: '0.2rem',
    lineHeight: 1.4,
  },
};
