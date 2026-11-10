import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Save, X } from 'lucide-react';
import { assignPassage, createPassage, listAssignments, listPassages, unassign, updatePassage } from '../api/dashboard';
import type { Assignment, ClassGroup, Passage } from '../types';
import { formatDate } from '../utils/format';
import { Card, Empty, ErrorNote, ui } from './ui';

const BLANK: Partial<Passage> = { kind: 'reading', language: 'English', level: 'Easy', title: '', kannadaTitle: '', text: '', kannadaText: '', hint: '', kannadaHint: '', minWords: null, isActive: true };

/** Reading passages and writing prompts, and which classes they are assigned to. */
export const PassagesView: React.FC<{ classes: ClassGroup[]; selectedClass: ClassGroup }> = ({ classes, selectedClass }) => {
  const [passages, setPassages] = useState<Passage[] | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [editing, setEditing] = useState<Partial<Passage> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(() => {
    Promise.all([listPassages(), listAssignments()])
      .then(([p, a]) => {
        setPassages(p);
        setAssignments(a);
      })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : 'Could not load passages'));
  }, []);
  useEffect(reload, [reload]);

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    setErr(null);
    try {
      const body = { ...editing, level: editing.kind === 'writing' ? null : editing.level };
      if (isNew) await createPassage(body);
      else await updatePassage(body as Passage);
      setEditing(null);
      reload();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const assignedHere = (pid: string) => assignments.find((a) => a.passageId === pid && a.classId === selectedClass.id);
  const toggleAssign = async (p: Passage) => {
    setErr(null);
    try {
      const existing = assignedHere(p.id);
      if (existing) await unassign(existing.id);
      else await assignPassage(p.id, selectedClass.id, null);
      reload();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Could not change assignment');
    }
  };

  return (
    <div style={ui.page} className="fade-in">
      {err && <ErrorNote>{err}</ErrorNote>}
      <Card
        title="Passages and writing prompts"
        sub={`Students download active items for offline use. "Assigned" marks items for ${selectedClass.name}. Editing text creates a new version; past attempts keep the text they were assessed on.`}
        right={
          <button
            style={ui.primaryBtn}
            onClick={() => {
              setEditing({ ...BLANK, id: '' });
              setIsNew(true);
            }}
          >
            <Plus size={14} /> New
          </button>
        }
      >
        {!passages ? (
          <Empty>Loading…</Empty>
        ) : passages.length === 0 ? (
          <Empty>No passages yet.</Empty>
        ) : (
          <div style={ui.tableWrap}>
            <table style={ui.table}>
              <thead>
                <tr>
                  {['ID', 'Type', 'Language', 'Level', 'Title', 'Words', 'Version', 'Status', `Assigned to ${selectedClass.name}`, ''].map((h) => (
                    <th key={h} style={ui.th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {passages.map((p) => (
                  <tr key={p.id}>
                    <td style={ui.td}>
                      <code style={ui.code}>{p.id}</code>
                    </td>
                    <td style={ui.td}>{p.kind}</td>
                    <td style={ui.td}>{p.language}</td>
                    <td style={ui.td}>{p.level ?? '—'}</td>
                    <td style={{ ...ui.td, ...ui.kn }}>{p.title}</td>
                    <td style={ui.td}>{p.kind === 'reading' ? p.text.split(/\s+/).filter(Boolean).length : `min ${p.minWords ?? '—'}`}</td>
                    <td style={ui.td}>
                      v{p.version} <span style={ui.muted}>{formatDate(p.updatedAt)}</span>
                    </td>
                    <td style={ui.td}>{p.isActive ? 'Active' : 'Hidden'}</td>
                    <td style={ui.td}>
                      <label style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center', cursor: 'pointer' }}>
                        <input type="checkbox" checked={!!assignedHere(p.id)} onChange={() => toggleAssign(p)} />
                        {assignedHere(p.id) ? 'Assigned' : 'Not assigned'}
                      </label>
                    </td>
                    <td style={ui.td}>
                      <button
                        style={ui.secondaryBtn}
                        onClick={() => {
                          setEditing(p);
                          setIsNew(false);
                        }}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editing && (
        <Card title={isNew ? 'New passage or prompt' : `Edit ${editing.id}`} right={<button style={ui.secondaryBtn} onClick={() => setEditing(null)}><X size={14} /> Cancel</button>}>
          <div style={styles.form}>
            <Field label="ID (letters, digits, - and _)">
              <input style={ui.input} value={editing.id ?? ''} disabled={!isNew} onChange={(e) => setEditing({ ...editing, id: e.target.value.toUpperCase() })} placeholder="P-EN-E2" />
            </Field>
            <Field label="Type">
              <select style={ui.input} value={editing.kind} onChange={(e) => setEditing({ ...editing, kind: e.target.value as Passage['kind'] })}>
                <option value="reading">Reading passage</option>
                <option value="writing">Writing prompt</option>
              </select>
            </Field>
            <Field label="Language">
              <select style={ui.input} value={editing.language} onChange={(e) => setEditing({ ...editing, language: e.target.value as Passage['language'] })}>
                <option>English</option>
                <option>Kannada</option>
              </select>
            </Field>
            {editing.kind === 'reading' ? (
              <Field label="Level">
                <select style={ui.input} value={editing.level ?? 'Easy'} onChange={(e) => setEditing({ ...editing, level: e.target.value as Passage['level'] })}>
                  <option>Easy</option>
                  <option>Medium</option>
                  <option>Advanced</option>
                </select>
              </Field>
            ) : (
              <Field label="Minimum words">
                <input style={ui.input} type="number" min={0} value={editing.minWords ?? ''} onChange={(e) => setEditing({ ...editing, minWords: e.target.value === '' ? null : Number(e.target.value) })} />
              </Field>
            )}
            <Field label="Title (English)">
              <input style={ui.input} value={editing.title ?? ''} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
            </Field>
            <Field label="Title (Kannada)">
              <input style={{ ...ui.input, ...ui.kn }} lang="kn" value={editing.kannadaTitle ?? ''} onChange={(e) => setEditing({ ...editing, kannadaTitle: e.target.value })} />
            </Field>
          </div>
          <Field label={editing.kind === 'reading' ? 'Passage text (exactly what the student reads)' : 'Prompt (English)'}>
            <textarea style={ui.textarea} rows={6} lang={editing.language === 'Kannada' ? 'kn' : 'en'} value={editing.text ?? ''} onChange={(e) => setEditing({ ...editing, text: e.target.value })} />
          </Field>
          {editing.kind === 'writing' && (
            <>
              <Field label="Prompt (Kannada)">
                <textarea style={ui.textarea} rows={2} lang="kn" value={editing.kannadaText ?? ''} onChange={(e) => setEditing({ ...editing, kannadaText: e.target.value })} />
              </Field>
              <div style={styles.form}>
                <Field label="Hint (English)">
                  <input style={ui.input} value={editing.hint ?? ''} onChange={(e) => setEditing({ ...editing, hint: e.target.value })} />
                </Field>
                <Field label="Hint (Kannada)">
                  <input style={{ ...ui.input, ...ui.kn }} lang="kn" value={editing.kannadaHint ?? ''} onChange={(e) => setEditing({ ...editing, kannadaHint: e.target.value })} />
                </Field>
              </div>
            </>
          )}
          <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', margin: '0.6rem 0', fontSize: '0.88rem' }}>
            <input type="checkbox" checked={editing.isActive ?? true} onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })} /> Active (available to students)
          </label>
          <button style={ui.primaryBtn} onClick={save} disabled={busy || !editing.id || !editing.title || !editing.text}>
            <Save size={14} /> {busy ? 'Saving…' : 'Save'}
          </button>
        </Card>
      )}
      <p style={ui.muted}>Classes you can assign to: {classes.map((c) => c.name).join(', ')}</p>
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ marginBottom: '0.6rem', minWidth: 0 }}>
    <label style={ui.label}>{label}</label>
    {children}
  </div>
);

const styles: Record<string, React.CSSProperties> = {
  form: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0 1rem' },
};
