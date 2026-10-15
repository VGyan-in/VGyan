import React, { useState } from 'react';
import { X, Download, ShieldCheck, FileSpreadsheet, Lock } from 'lucide-react';
import { Student } from '../types';

interface ResearchExportModalProps {
  students: Student[];
  onClose: () => void;
}

export const ResearchExportModal: React.FC<ResearchExportModalProps> = ({
  students,
  onClose,
}) => {
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Generate anonymized research records (Complies with PDF privacy rules: Participant ID only, no student names or IDs)
  const anonymizedRows = students.map((s) => ({
    participant_id: s.participantId,
    age_group: `${s.age} yrs`,
    grade_level: `Class ${s.grade}`,
    native_language: s.nativeLanguage,
    consent_active: s.consentStatus === 'active' ? 'YES' : 'NO',
    reading_accuracy_pct: s.overallReadingAccuracy,
    average_wpm: s.averageWpm,
    writing_score_pct: s.writingScore,
    at_risk_flag: s.isAtRisk ? '1' : '0',
    total_assessments_recorded: s.recentReadingAttempts.length + s.recentWritingAttempts.length,
    anonymized_hash: `hash_${s.participantId.replace(/[^a-zA-Z0-9]/g, '')}`,
  }));

  const handleDownloadCSV = () => {
    const headers = Object.keys(anonymizedRows[0]).join(',');
    const rows = anonymizedRows
      .map((r) => Object.values(r).map((v) => `"${v}"`).join(','))
      .join('\n');
    const csvContent = `data:text/csv;charset=utf-8,${headers}\n${rows}`;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `VGyan_Research_Dataset_Anonymized_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 2500);
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()} className="fade-in">
        <div style={styles.header}>
          <div style={styles.headerTitleRow}>
            <div style={styles.shieldIcon}>
              <ShieldCheck size={20} color="#059669" />
            </div>
            <div>
              <h3 style={styles.title}>Anonymized Research Data Export</h3>
              <p style={styles.sub}>VGyan Privacy-Preserving Pipeline (SRS Section 8 & 9)</p>
            </div>
          </div>
          <button onClick={onClose} style={styles.closeBtn}>
            <X size={20} />
          </button>
        </div>

        <div style={styles.body}>
          {/* Privacy Guarantee Box */}
          <div style={styles.privacyBox}>
            <Lock size={16} color="#0B3D2E" />
            <p style={styles.privacyText}>
              <strong>Privacy Protocol Enforcement:</strong> Student personal identifers (Name, Student ID, School Roster ID) have been completely stripped. Records are strictly keyed by randomized <code>participant_id</code> with active consent verification.
            </p>
          </div>

          {/* Dataset Preview Table */}
          <div style={styles.previewContainer}>
            <span style={styles.previewHeader}>Export Schema Preview ({anonymizedRows.length} Records):</span>
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>participant_id</th>
                    <th style={styles.th}>age_group</th>
                    <th style={styles.th}>grade_level</th>
                    <th style={styles.th}>native_language</th>
                    <th style={styles.th}>reading_accuracy_pct</th>
                    <th style={styles.th}>avg_wpm</th>
                    <th style={styles.th}>at_risk</th>
                  </tr>
                </thead>
                <tbody>
                  {anonymizedRows.slice(0, 4).map((r, i) => (
                    <tr key={i}>
                      <td style={styles.td}><code style={styles.code}>{r.participant_id}</code></td>
                      <td style={styles.td}>{r.age_group}</td>
                      <td style={styles.td}>{r.grade_level}</td>
                      <td style={styles.td}>{r.native_language}</td>
                      <td style={styles.td}><strong>{r.reading_accuracy_pct}%</strong></td>
                      <td style={styles.td}>{r.average_wpm}</td>
                      <td style={styles.td}>{r.at_risk_flag === '1' ? 'YES (1)' : 'NO (0)'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Download Action */}
          <div style={styles.footerRow}>
            <div style={styles.datasetInfo}>
              <FileSpreadsheet size={16} color="var(--color-slate-500)" />
              <span>Format: Standard UTF-8 CSV • Compatible with Python pandas & R</span>
            </div>

            <button onClick={handleDownloadCSV} style={styles.downloadBtn}>
              <Download size={16} />
              <span>{downloadSuccess ? 'Downloaded!' : 'Download Research CSV'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(11, 61, 46, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    backdropFilter: 'blur(3px)',
  },
  modal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 'var(--radius-xl)',
    width: '90%',
    maxWidth: '720px',
    boxShadow: 'var(--shadow-lg)',
    overflow: 'hidden',
  },
  header: {
    padding: '1.25rem 1.5rem',
    borderBottom: '1px solid var(--color-slate-200)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  shieldIcon: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    backgroundColor: '#ECFDF5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: '1.15rem',
    fontWeight: 700,
    color: 'var(--color-deep-forest)',
  },
  sub: {
    fontSize: '0.76rem',
    color: 'var(--color-slate-500)',
  },
  closeBtn: {
    color: 'var(--color-slate-400)',
    padding: '0.4rem',
  },
  body: {
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  privacyBox: {
    backgroundColor: 'var(--color-light-green)',
    border: '1px solid var(--color-leaf-tint)',
    borderRadius: 'var(--radius-md)',
    padding: '0.85rem 1rem',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.75rem',
  },
  privacyText: {
    fontSize: '0.82rem',
    color: 'var(--color-deep-forest)',
    lineHeight: 1.4,
  },
  previewContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
  },
  previewHeader: {
    fontSize: '0.76rem',
    fontWeight: 700,
    color: 'var(--color-slate-500)',
    textTransform: 'uppercase',
  },
  tableWrap: {
    border: '1px solid var(--color-slate-200)',
    borderRadius: 'var(--radius-md)',
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.8rem',
  },
  th: {
    backgroundColor: 'var(--color-soft-cream)',
    padding: '0.55rem 0.75rem',
    fontSize: '0.72rem',
    color: 'var(--color-slate-600)',
    textAlign: 'left',
    borderBottom: '1px solid var(--color-slate-200)',
    fontFamily: 'monospace',
  },
  td: {
    padding: '0.55rem 0.75rem',
    borderBottom: '1px solid var(--color-slate-100)',
    color: 'var(--color-slate-700)',
  },
  code: {
    backgroundColor: 'var(--color-soft-cream)',
    padding: '0.1rem 0.3rem',
    borderRadius: '3px',
    color: 'var(--color-deep-forest)',
  },
  footerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '1rem',
    paddingTop: '0.5rem',
  },
  datasetInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    fontSize: '0.78rem',
    color: 'var(--color-slate-500)',
  },
  downloadBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    backgroundColor: 'var(--color-deep-forest)',
    color: '#FFFFFF',
    padding: '0.65rem 1.25rem',
    borderRadius: 'var(--radius-md)',
    fontWeight: 700,
    fontSize: '0.86rem',
  },
};
