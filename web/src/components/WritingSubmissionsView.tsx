import React, { useMemo, useState } from 'react';
import { PenTool } from 'lucide-react';
import type { Student, WritingAssessment } from '../types';
import { fmt, formatDateTime } from '../utils/format';
import { WritingDetail } from './StudentDetailModal';
import { Card, Empty, ui } from './ui';

export const WritingSubmissionsView: React.FC<{ students: Student[] }> = ({ students }) => {
  const [lang, setLang] = useState<'all' | 'English' | 'Kannada'>('all');
  const [method, setMethod] = useState<'all' | 'typed' | 'image'>('all');
  const [open, setOpen] = useState<string | null>(null);
  const all = useMemo(
    () =>
      students
        .flatMap((s) => s.recentWritingAttempts)
        .filter((w) => lang === 'all' || w.language === lang)
        .filter((w) => method === 'all' || (method === 'typed' ? w.inputMethod === 'typed' : w.inputMethod !== 'typed'))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [students, lang, method],
  );

  return (
    <div style={ui.page} className="fade-in">
      <Card
        title="Writing submissions"
        sub="Most recent writing per student. Handwritten answers show the original OCR output next to the text the student corrected and submitted."
        right={
          <div style={ui.filters}>
            <select style={ui.input} value={lang} onChange={(e) => setLang(e.target.value as typeof lang)} aria-label="Language">
              <option value="all">All languages</option>
              <option>English</option>
              <option>Kannada</option>
            </select>
            <select style={ui.input} value={method} onChange={(e) => setMethod(e.target.value as typeof method)} aria-label="Input method">
              <option value="all">Typed and handwritten</option>
              <option value="typed">Typed</option>
              <option value="image">Handwritten (photo)</option>
            </select>
          </div>
        }
      >
        {all.length === 0 ? (
          <Empty>No writing has been synced for this class yet.</Empty>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
            {all.map((w: WritingAssessment) => (
              <div key={w.id} style={styles.item}>
                <button style={styles.head} onClick={() => setOpen(open === w.id ? null : w.id)} aria-expanded={open === w.id}>
                  <PenTool size={15} color="var(--color-deep-forest)" />
                  <strong>{w.studentName}</strong>
                  <code style={ui.code}>{w.participantId}</code>
                  <span style={ui.muted}>{w.promptTitle}</span>
                  <span className="badge badge-forest">{w.language}</span>
                  <span className="badge badge-teal">{w.inputMethod === 'typed' ? 'Typed' : 'Handwritten'}</span>
                  <span style={{ ...ui.muted, marginLeft: 'auto' }}>{formatDateTime(w.date)}</span>
                  <strong style={{ color: 'var(--color-deep-forest)' }}>{w.score != null ? `${fmt(w.score)}/10` : w.aiStatus}</strong>
                </button>
                {open === w.id && <WritingDetail w={w} />}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  item: { border: '1px solid var(--color-slate-200)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' },
  head: { width: '100%', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', background: 'var(--color-soft-cream-alt)', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: '0.88rem' },
};
