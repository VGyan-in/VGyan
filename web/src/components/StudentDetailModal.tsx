import React, { useEffect, useMemo, useState } from 'react';
import { X, BookOpen, PenTool, Volume2, Sparkles, Send, Image as ImageIcon, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { addComment, getAudioUrl, getImageUrl, getStudent } from '../api/dashboard';
import type { AiFeedback, AlignedWord, CommentCategory, ReadingAssessment, Student, TeacherComment, WritingAssessment } from '../types';
import { formatDate, formatDateTime, fmt } from '../utils/format';

interface Props {
  student: Student;
  comments: TeacherComment[];
  onClose: () => void;
  onCommentAdded: (c: TeacherComment) => void;
}

type Tab = 'progress' | 'reading' | 'writing' | 'notes';

export const StudentDetailModal: React.FC<Props> = ({ student: summary, comments, onClose, onCommentAdded }) => {
  const [tab, setTab] = useState<Tab>('progress');
  // The list view carries only recent attempts; fetch the full history for this student.
  const [student, setStudent] = useState<Student>(summary);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getStudent(summary.studentId)
      .then((s) => !cancelled && setStudent(s))
      .catch((e: unknown) => !cancelled && setLoadError(e instanceof Error ? e.message : 'Could not load full history'));
    return () => {
      cancelled = true;
    };
  }, [summary.studentId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const p = student.profile;
  const myComments = comments.filter((c) => c.studentId === student.studentId);

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()} className="fade-in" role="dialog" aria-modal="true" aria-label={`Student ${student.name}`}>
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <div style={styles.avatarBig}>{student.name.slice(0, 2).toUpperCase()}</div>
            <div>
              <div style={styles.nameRow}>
                <h3 style={styles.name}>{student.name}</h3>
                {student.isAtRisk ? (
                  <span className="badge badge-risk" title={student.atRiskReason ?? ''}>Needs support</span>
                ) : student.readingCount > 0 ? (
                  <span className="badge badge-success">On track</span>
                ) : null}
                <ConsentBadge student={student} />
              </div>
              <div style={styles.subMeta}>
                <span>
                  Participant <code style={styles.code}>{student.participantId}</code>
                </span>
                {student.className && <span>• {student.className}</span>}
                {p.nativeLanguage && <span>• Home language: {p.nativeLanguage}</span>}
                {p.medium && <span>• Medium: {p.medium}</span>}
                {p.ageGroup && <span>• Age {p.ageGroup}</span>}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={styles.closeButton} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div style={styles.tabsRow} role="tablist">
          {(
            [
              ['progress', 'Progress'],
              ['reading', `Reading (${student.readingCount})`],
              ['writing', `Writing (${student.writingCount})`],
              ['notes', `Notes (${myComments.length})`],
            ] as [Tab, string][]
          ).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} style={{ ...styles.tabBtn, ...(tab === id ? styles.tabBtnActive : {}) }}>
              {label}
            </button>
          ))}
        </div>

        <div style={styles.tabContent}>
          {loadError && <div style={styles.warn}>Showing recent attempts only: {loadError}</div>}
          {tab === 'progress' && <ProgressTab student={student} />}
          {tab === 'reading' && <ReadingTab attempts={student.recentReadingAttempts} />}
          {tab === 'writing' && <WritingTab attempts={student.recentWritingAttempts} />}
          {tab === 'notes' && <NotesTab student={student} comments={myComments} onCommentAdded={onCommentAdded} />}
        </div>
      </div>
    </div>
  );
};

const ConsentBadge: React.FC<{ student: Student }> = ({ student }) => {
  if (student.consentStatus === 'withdrawn') return <span className="badge badge-risk">Consent withdrawn</span>;
  if (student.consentStatus === 'pending') return <span className="badge badge-warning">Consent not received</span>;
  if (!student.consentCurrent) return <span className="badge badge-warning">Consent v{student.consentVersion} – renewal due</span>;
  return null;
};

// ---------- Progress ----------

const ProgressTab: React.FC<{ student: Student }> = ({ student }) => {
  const byLang = useMemo(() => {
    const out: Record<string, { date: string; accuracy: number; wpm: number }[]> = { English: [], Kannada: [] };
    [...student.recentReadingAttempts]
      .sort((a, b) => a.date.localeCompare(b.date))
      .forEach((a) => out[a.language].push({ date: formatDate(a.date), accuracy: a.accuracy, wpm: a.wpm }));
    return out;
  }, [student]);
  const writing = useMemo(
    () =>
      [...student.recentWritingAttempts]
        .filter((w) => w.score != null)
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((w) => ({ date: formatDate(w.date), grammar: w.grammarScore, vocabulary: w.vocabularyScore, spelling: w.spellingScore })),
    [student],
  );
  const errorTotals = student.recentReadingAttempts.reduce(
    (acc, a) => ({ s: acc.s + a.substitutions, o: acc.o + a.omissions, i: acc.i + a.insertions }),
    { s: 0, o: 0, i: 0 },
  );
  const practice = Array.from(new Set(student.recentReadingAttempts.flatMap((a) => a.practiceWords))).slice(0, 20);

  if (student.readingCount + student.writingCount === 0) {
    return <div style={styles.emptyState}>No assessments synced yet. Data appears here after the student's phone syncs.</div>;
  }
  return (
    <div style={styles.grid2}>
      {(['English', 'Kannada'] as const).map((lang) => (
        <div key={lang} style={styles.card}>
          <h4 style={styles.cardTitle}>{lang} reading</h4>
          <p style={styles.cardSub}>Accuracy (%) and words per minute, one point per attempt</p>
          {byLang[lang].length === 0 ? (
            <div style={styles.emptySmall}>No {lang} reading attempts.</div>
          ) : (
            <div style={{ width: '100%', height: 230 }}>
              <ResponsiveContainer>
                <LineChart data={byLang[lang]} margin={{ top: 10, right: 15, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2ECE6" vertical={false} />
                  <XAxis dataKey="date" stroke="#64748B" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748B" fontSize={11} tickLine={false} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="accuracy" name="Accuracy %" stroke="#0B3D2E" strokeWidth={2.5} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="wpm" name="WPM" stroke="#2EC4B6" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      ))}
      <div style={styles.card}>
        <h4 style={styles.cardTitle}>Writing scores</h4>
        <p style={styles.cardSub}>AI-assessed grammar, vocabulary and spelling (0–100)</p>
        {writing.length === 0 ? (
          <div style={styles.emptySmall}>No assessed writing yet.</div>
        ) : (
          <div style={{ width: '100%', height: 230 }}>
            <ResponsiveContainer>
              <LineChart data={writing} margin={{ top: 10, right: 15, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2ECE6" vertical={false} />
                <XAxis dataKey="date" stroke="#64748B" fontSize={11} tickLine={false} />
                <YAxis domain={[0, 100]} stroke="#64748B" fontSize={11} tickLine={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="grammar" name="Grammar" stroke="#0B3D2E" strokeWidth={2} />
                <Line type="monotone" dataKey="vocabulary" name="Vocabulary" stroke="#2EC4B6" strokeWidth={2} />
                <Line type="monotone" dataKey="spelling" name="Spelling" stroke="#F97316" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
      <div style={styles.card}>
        <h4 style={styles.cardTitle}>Reading mistakes (all attempts)</h4>
        <div style={styles.statRow}>
          <Stat label="Substitutions" value={errorTotals.s} />
          <Stat label="Omissions" value={errorTotals.o} />
          <Stat label="Insertions" value={errorTotals.i} />
        </div>
        <h4 style={{ ...styles.cardTitle, marginTop: '1rem' }}>Practice words</h4>
        {practice.length === 0 ? (
          <div style={styles.emptySmall}>None yet.</div>
        ) : (
          <div style={styles.chips}>
            {practice.map((w) => (
              <span key={w} style={styles.chip} lang="und">
                {w}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div style={styles.stat}>
    <div style={styles.statVal}>{value}</div>
    <div style={styles.statLabel}>{label}</div>
  </div>
);

// ---------- Reading ----------

const WORD_STYLE: Record<AlignedWord['status'], React.CSSProperties> = {
  correct: { color: '#0F172A' },
  substitution: { background: '#FEF3C7', color: '#92400E', borderBottom: '2px solid #F59E0B' },
  omission: { background: '#FEE2E2', color: '#991B1B', textDecoration: 'line-through' },
  insertion: { background: '#E0F2FE', color: '#075985', fontStyle: 'italic' },
};

const ReadingTab: React.FC<{ attempts: ReadingAssessment[] }> = ({ attempts }) => {
  const [open, setOpen] = useState<string | null>(attempts[0]?.id ?? null);
  if (attempts.length === 0) return <div style={styles.emptyState}>No reading attempts synced yet.</div>;
  return (
    <div style={styles.list}>
      {attempts.map((a) => (
        <div key={a.id} style={styles.attemptCard}>
          <button style={styles.attemptHead} onClick={() => setOpen(open === a.id ? null : a.id)} aria-expanded={open === a.id}>
            <BookOpen size={16} color="var(--color-deep-forest)" />
            <span style={styles.attemptTitle}>{a.passageTitle}</span>
            <span className="badge badge-forest">{a.language}</span>
            <span className="badge badge-teal">{a.level}</span>
            <span style={styles.dateSub}>{formatDateTime(a.date)}</span>
            <span style={styles.headMetric}>
              {fmt(a.accuracy)}% · {fmt(a.wpm)} WPM
            </span>
          </button>
          {open === a.id && <ReadingDetail a={a} />}
        </div>
      ))}
    </div>
  );
};

const ReadingDetail: React.FC<{ a: ReadingAssessment }> = ({ a }) => {
  const [audio, setAudio] = useState<string | null>(null);
  const [audioErr, setAudioErr] = useState<string | null>(null);
  const loadAudio = () =>
    getAudioUrl(a.id)
      .then((r) => setAudio(r.url))
      .catch((e: unknown) => setAudioErr(e instanceof Error ? e.message : 'Recording unavailable'));

  return (
    <div style={styles.detail}>
      <div style={styles.statRow}>
        <Stat label="Accuracy" value={`${fmt(a.accuracy)}%`} />
        <Stat label="Words / min" value={fmt(a.wpm)} />
        <Stat label="Correct / min" value={fmt(a.wcpm)} />
        <Stat label="Pace" value={a.pace || '—'} />
        <Stat label="Substitutions" value={a.substitutions} />
        <Stat label="Omissions" value={a.omissions} />
        <Stat label="Insertions" value={a.insertions} />
        <Stat label="Duration" value={`${Math.round(a.durationSeconds)}s`} />
      </div>
      {a.metricsVerified === false && (
        <div style={styles.warn}>
          <AlertTriangle size={14} /> The server's re-calculation from the transcript does not match the metrics the phone reported. Treat this attempt with caution.
        </div>
      )}

      <h5 style={styles.sectionLabel}>Passage with reading errors</h5>
      <p style={styles.passage} lang={a.language === 'Kannada' ? 'kn' : 'en'}>
        {a.words.length === 0
          ? a.referenceText
          : a.words.map((w, i) => (
              <span
                key={i}
                style={{ ...styles.word, ...WORD_STYLE[w.status] }}
                title={w.status === 'substitution' ? `Heard "${w.hyp}"` : w.status === 'insertion' ? 'Extra word' : w.status === 'omission' ? 'Skipped' : undefined}
              >
                {w.status === 'insertion' ? `+${w.hyp}` : w.ref}
                {w.status === 'substitution' && <sup style={styles.sup}>{w.hyp}</sup>}
              </span>
            ))}
      </p>
      <div style={styles.legend}>
        <span style={{ ...styles.word, ...WORD_STYLE.substitution }}>substituted</span>
        <span style={{ ...styles.word, ...WORD_STYLE.omission }}>skipped</span>
        <span style={{ ...styles.word, ...WORD_STYLE.insertion }}>+extra</span>
      </div>

      <h5 style={styles.sectionLabel}>Speech recognition transcript</h5>
      <p style={styles.mono} lang={a.language === 'Kannada' ? 'kn' : 'en'}>
        {a.transcript || <em>(nothing recognised)</em>}
      </p>
      <p style={styles.meta}>
        ASR model {a.asrModelVersion || 'unknown'}
        {a.asrConfidence != null && ` · mean confidence ${fmt(a.asrConfidence * 100)}%`}
      </p>

      <div style={styles.audioRow}>
        {a.hasAudio ? (
          audio ? (
            <audio controls src={audio} style={{ width: '100%' }} />
          ) : (
            <button style={styles.secondaryBtn} onClick={loadAudio}>
              <Volume2 size={14} /> Load recording
            </button>
          )
        ) : (
          <span style={styles.meta}>No recording on the server (not consented or not yet synced).</span>
        )}
        {audioErr && <span style={styles.errorText}>{audioErr}</span>}
      </div>

      <Feedback fb={a.aiFeedback} status={a.aiStatus} model={a.aiModelVersion} prompt={a.aiPromptVersion} />
    </div>
  );
};

// ---------- Writing ----------

const WritingTab: React.FC<{ attempts: WritingAssessment[] }> = ({ attempts }) => {
  const [open, setOpen] = useState<string | null>(attempts[0]?.id ?? null);
  if (attempts.length === 0) return <div style={styles.emptyState}>No writing synced yet.</div>;
  return (
    <div style={styles.list}>
      {attempts.map((w) => (
        <div key={w.id} style={styles.attemptCard}>
          <button style={styles.attemptHead} onClick={() => setOpen(open === w.id ? null : w.id)} aria-expanded={open === w.id}>
            <PenTool size={16} color="var(--color-deep-forest)" />
            <span style={styles.attemptTitle}>{w.promptTitle}</span>
            <span className="badge badge-forest">{w.language}</span>
            <span className="badge badge-teal">{w.inputMethod === 'typed' ? 'Typed' : 'Handwritten'}</span>
            <span style={styles.dateSub}>{formatDateTime(w.date)}</span>
            <span style={styles.headMetric}>{w.score != null ? `${fmt(w.score)}/10` : 'Not assessed'}</span>
          </button>
          {open === w.id && <WritingDetail w={w} />}
        </div>
      ))}
    </div>
  );
};

export const WritingDetail: React.FC<{ w: WritingAssessment }> = ({ w }) => {
  const [img, setImg] = useState<string | null>(null);
  const [imgErr, setImgErr] = useState<string | null>(null);
  const lang = w.language === 'Kannada' ? 'kn' : 'en';
  return (
    <div style={styles.detail}>
      <div style={styles.statRow}>
        <Stat label="Words" value={w.wordCount} />
        <Stat label="Sentences" value={w.sentenceCount} />
        <Stat label="Grammar" value={w.grammarScore ?? '—'} />
        <Stat label="Vocabulary" value={w.vocabularyScore ?? '—'} />
        <Stat label="Spelling" value={w.spellingScore ?? '—'} />
        <Stat label="Overall" value={w.score != null ? `${fmt(w.score)}/10` : '—'} />
      </div>
      {w.inputMethod !== 'typed' && (
        <>
          <div style={styles.grid2}>
            <div>
              <h5 style={styles.sectionLabel}>Original OCR output</h5>
              <p style={styles.mono} lang={lang}>
                {w.rawOcrText ?? <em>(none)</em>}
              </p>
              <p style={styles.meta}>
                {w.ocrEngineVersion ?? 'engine unknown'}
                {w.ocrConfidence != null && ` · confidence ${fmt(w.ocrConfidence * 100)}%`}
                {w.ocrMatchesServer === true && (
                  <>
                    {' '}
                    · <CheckCircle2 size={12} /> matches server OCR record
                  </>
                )}
                {w.ocrMatchesServer === false && <span style={styles.errorText}> · differs from the server's OCR record</span>}
              </p>
            </div>
            <div>
              <h5 style={styles.sectionLabel}>Student-corrected text (assessed)</h5>
              <p style={styles.mono} lang={lang}>
                {w.studentCorrectedText}
              </p>
            </div>
          </div>
          <div style={styles.audioRow}>
            {w.hasImage ? (
              img ? (
                <img src={img} alt="Student's handwritten answer" style={styles.image} />
              ) : (
                <button
                  style={styles.secondaryBtn}
                  onClick={() =>
                    getImageUrl(w.id)
                      .then((r) => setImg(r.url))
                      .catch((e: unknown) => setImgErr(e instanceof Error ? e.message : 'Image unavailable'))
                  }
                >
                  <ImageIcon size={14} /> Show handwriting photo
                </button>
              )
            ) : (
              <span style={styles.meta}>No photo on the server (not consented or not yet synced).</span>
            )}
            {imgErr && <span style={styles.errorText}>{imgErr}</span>}
          </div>
        </>
      )}
      {w.inputMethod === 'typed' && (
        <>
          <h5 style={styles.sectionLabel}>Typed answer</h5>
          <p style={styles.mono} lang={lang}>
            {w.studentCorrectedText}
          </p>
        </>
      )}
      {w.aiFeedback?.misspelled && w.aiFeedback.misspelled.length > 0 && (
        <>
          <h5 style={styles.sectionLabel}>Misspelled</h5>
          <div style={styles.chips}>
            {w.aiFeedback.misspelled.map((m) => (
              <span key={m} style={{ ...styles.chip, background: '#FEF3C7' }}>
                {m}
              </span>
            ))}
          </div>
        </>
      )}
      {w.aiFeedback?.correctedText && (
        <>
          <h5 style={styles.sectionLabel}>AI minimal correction (for reference, not the student's text)</h5>
          <p style={styles.mono} lang={lang}>
            {w.aiFeedback.correctedText}
          </p>
        </>
      )}
      <Feedback fb={w.aiFeedback} status={w.aiStatus} model={w.aiModelVersion} prompt={w.aiPromptVersion} />
    </div>
  );
};

const Feedback: React.FC<{ fb: AiFeedback | null; status: string; model: string | null; prompt: string | null }> = ({ fb, status, model, prompt }) => (
  <div style={styles.aiBox}>
    <div style={styles.aiHead}>
      <Sparkles size={14} /> AI feedback shown to the student
    </div>
    {!fb || status !== 'completed' ? (
      <p style={styles.meta}>{status === 'failed' ? 'Generation failed; the app will retry when online.' : 'Pending (generated when the phone is online).'}</p>
    ) : (
      <>
        {fb.summary && <p style={styles.aiText}>{fb.summary}</p>}
        <FeedbackList title="Working well" items={fb.strengths} />
        <FeedbackList title="To improve" items={fb.improvements} />
        <FeedbackList title="Suggestions" items={fb.suggestions} />
        <p style={styles.meta}>
          {model ?? fb.modelVersion} · prompt {prompt ?? fb.promptVersion}
        </p>
      </>
    )}
  </div>
);

const FeedbackList: React.FC<{ title: string; items?: string[] }> = ({ title, items }) =>
  items && items.length > 0 ? (
    <div style={{ marginTop: '0.4rem' }}>
      <strong style={{ fontSize: '0.8rem' }}>{title}</strong>
      <ul style={styles.ul}>
        {items.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ul>
    </div>
  ) : null;

// ---------- Notes ----------

const CATEGORIES: CommentCategory[] = ['Intervention', 'Praise', 'Parent Note', 'General'];

const NotesTab: React.FC<{ student: Student; comments: TeacherComment[]; onCommentAdded: (c: TeacherComment) => void }> = ({ student, comments, onCommentAdded }) => {
  const [text, setText] = useState('');
  const [category, setCategory] = useState<CommentCategory>('Intervention');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    setErr(null);
    try {
      onCommentAdded(await addComment({ studentId: student.studentId, text: text.trim(), category }));
      setText('');
    } catch (e2: unknown) {
      setErr(e2 instanceof Error ? e2.message : 'Note not saved');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div style={styles.list}>
      <form onSubmit={submit} style={styles.noteForm}>
        <label style={styles.sectionLabel} htmlFor="note-text">
          Add a note
        </label>
        <textarea id="note-text" value={text} onChange={(e) => setText(e.target.value)} rows={3} style={styles.textarea} placeholder="Observation, intervention or message for the guardian" />
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <select value={category} onChange={(e) => setCategory(e.target.value as CommentCategory)} style={styles.select} aria-label="Category">
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <button type="submit" style={styles.primaryBtn} disabled={busy || !text.trim()}>
            <Send size={14} /> {busy ? 'Saving…' : 'Save note'}
          </button>
          {err && <span style={styles.errorText}>{err}</span>}
        </div>
      </form>
      {comments.length === 0 ? (
        <div style={styles.emptySmall}>No notes yet.</div>
      ) : (
        comments.map((c) => (
          <div key={c.id} style={styles.noteCard}>
            <div style={styles.noteHead}>
              <span className="badge badge-forest">{c.category}</span>
              <span style={styles.meta}>
                {c.author} · {formatDateTime(c.timestamp)}
              </span>
            </div>
            <p style={styles.aiText}>{c.text}</p>
          </div>
        ))
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '2rem 1rem', overflowY: 'auto', zIndex: 50 },
  modal: { background: 'var(--color-surface-white)', borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: 1100, boxShadow: 'var(--shadow-lg)', overflow: 'hidden' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '1.5rem 1.75rem', borderBottom: '1px solid var(--color-slate-200)', gap: '1rem' },
  headerLeft: { display: 'flex', gap: '1rem', alignItems: 'center', minWidth: 0 },
  avatarBig: { width: 52, height: 52, borderRadius: 'var(--radius-full)', background: 'var(--color-light-green)', color: 'var(--color-deep-forest)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 },
  nameRow: { display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' },
  name: { fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-slate-900)', fontFamily: 'var(--font-heading)' },
  subMeta: { display: 'flex', gap: '0.4rem', flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--color-slate-500)', marginTop: '0.3rem' },
  code: { background: 'var(--color-slate-100)', padding: '0.05rem 0.35rem', borderRadius: 4, fontSize: '0.78rem' },
  closeButton: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-slate-500)', padding: 4 },
  tabsRow: { display: 'flex', gap: '0.25rem', padding: '0 1.75rem', borderBottom: '1px solid var(--color-slate-200)', overflowX: 'auto' },
  tabBtn: { background: 'none', border: 'none', borderBottom: '3px solid transparent', padding: '0.85rem 0.9rem', fontSize: '0.88rem', fontWeight: 600, color: 'var(--color-slate-500)', cursor: 'pointer', whiteSpace: 'nowrap' },
  tabBtnActive: { color: 'var(--color-deep-forest)', borderBottomColor: 'var(--color-deep-forest)' },
  tabContent: { padding: '1.5rem 1.75rem 2rem', maxHeight: '70vh', overflowY: 'auto' },
  grid2: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' },
  card: { border: '1px solid var(--color-slate-200)', borderRadius: 'var(--radius-lg)', padding: '1rem 1.1rem' },
  cardTitle: { fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-slate-900)' },
  cardSub: { fontSize: '0.76rem', color: 'var(--color-slate-500)', marginBottom: '0.5rem' },
  emptyState: { padding: '2rem', textAlign: 'center', color: 'var(--color-slate-500)', fontSize: '0.9rem' },
  emptySmall: { padding: '1rem 0', color: 'var(--color-slate-400)', fontSize: '0.85rem' },
  statRow: { display: 'flex', flexWrap: 'wrap', gap: '0.6rem' },
  stat: { background: 'var(--color-slate-100)', borderRadius: 'var(--radius-md)', padding: '0.5rem 0.75rem', minWidth: 86 },
  statVal: { fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-slate-900)' },
  statLabel: { fontSize: '0.7rem', color: 'var(--color-slate-500)' },
  chips: { display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.4rem' },
  chip: { background: 'var(--color-light-green)', borderRadius: 'var(--radius-full)', padding: '0.2rem 0.6rem', fontSize: '0.85rem', color: 'var(--color-deep-forest)' },
  list: { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  attemptCard: { border: '1px solid var(--color-slate-200)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' },
  attemptHead: { width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', padding: '0.8rem 1rem', background: 'var(--color-soft-cream-alt)', border: 'none', cursor: 'pointer', textAlign: 'left' },
  attemptTitle: { fontWeight: 700, fontSize: '0.92rem', color: 'var(--color-slate-900)' },
  dateSub: { fontSize: '0.76rem', color: 'var(--color-slate-500)' },
  headMetric: { marginLeft: 'auto', fontWeight: 700, fontSize: '0.85rem', color: 'var(--color-deep-forest)' },
  detail: { padding: '1rem 1.1rem 1.2rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' },
  sectionLabel: { fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-slate-500)', marginTop: '0.4rem' },
  passage: { lineHeight: 2.1, fontSize: '1rem', fontFamily: "'Noto Sans Kannada', var(--font-body)" },
  word: { padding: '0.05rem 0.2rem', borderRadius: 4, marginRight: '0.25rem', display: 'inline-block', position: 'relative' },
  sup: { fontSize: '0.65rem', marginLeft: 2, color: '#92400E' },
  legend: { display: 'flex', gap: '0.5rem', fontSize: '0.75rem' },
  mono: { background: 'var(--color-slate-100)', borderRadius: 'var(--radius-md)', padding: '0.7rem 0.85rem', whiteSpace: 'pre-wrap', fontSize: '0.92rem', lineHeight: 1.6, fontFamily: "'Noto Sans Kannada', var(--font-body)" },
  meta: { fontSize: '0.74rem', color: 'var(--color-slate-500)' },
  audioRow: { display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' },
  image: { maxWidth: '100%', maxHeight: 420, borderRadius: 'var(--radius-md)', border: '1px solid var(--color-slate-200)' },
  secondaryBtn: { display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.8rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-leaf-tint)', background: 'var(--color-light-green)', color: 'var(--color-deep-forest)', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' },
  primaryBtn: { display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.5rem 0.9rem', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--color-deep-forest)', color: '#fff', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' },
  aiBox: { background: '#F0FDFA', border: '1px solid #CCFBF1', borderRadius: 'var(--radius-md)', padding: '0.8rem 0.95rem', marginTop: '0.4rem' },
  aiHead: { display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 700, fontSize: '0.8rem', color: '#0F766E' },
  aiText: { fontSize: '0.9rem', color: 'var(--color-slate-700)', marginTop: '0.3rem', lineHeight: 1.5 },
  ul: { margin: '0.2rem 0 0 1.1rem', fontSize: '0.86rem', color: 'var(--color-slate-700)', lineHeight: 1.5 },
  warn: { display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#FEF3C7', color: '#78350F', borderRadius: 'var(--radius-md)', padding: '0.5rem 0.75rem', fontSize: '0.8rem', marginBottom: '0.5rem' },
  errorText: { color: 'var(--color-risk-red)', fontSize: '0.8rem' },
  noteForm: { display: 'flex', flexDirection: 'column', gap: '0.5rem', border: '1px solid var(--color-slate-200)', borderRadius: 'var(--radius-lg)', padding: '1rem' },
  textarea: { width: '100%', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-slate-200)', padding: '0.6rem', fontFamily: 'inherit', fontSize: '0.9rem', boxSizing: 'border-box' },
  select: { padding: '0.45rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-slate-200)', fontSize: '0.85rem' },
  noteCard: { border: '1px solid var(--color-slate-200)', borderRadius: 'var(--radius-md)', padding: '0.75rem 0.9rem' },
  noteHead: { display: 'flex', alignItems: 'center', gap: '0.5rem' },
};
