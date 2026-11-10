import React, { useCallback, useEffect, useState } from 'react';
import {
  adminCreateClass,
  adminCreateSchool,
  adminCreateStaff,
  adminDeactivateStaff,
  adminListClasses,
  adminListDeletions,
  adminListSchools,
  adminListStaff,
  adminProcessDeletion,
  adminSetStaffClasses,
  type AdminClass,
  type AdminStaff,
  type DeletionRequestRow,
} from '../api/dashboard';
import type { Role } from '../types';
import { formatDateTime } from '../utils/format';
import { Card, Empty, ErrorNote, ui } from './ui';

export const AdminView: React.FC<{ onChanged: () => void }> = ({ onChanged }) => {
  const [schools, setSchools] = useState<{ id: string; name: string }[]>([]);
  const [classes, setClasses] = useState<AdminClass[]>([]);
  const [staff, setStaff] = useState<AdminStaff[]>([]);
  const [deletions, setDeletions] = useState<DeletionRequestRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const reload = useCallback(() => {
    Promise.all([adminListSchools(), adminListClasses(), adminListStaff(), adminListDeletions()])
      .then(([s, c, st, d]) => {
        setSchools(s);
        setClasses(c);
        setStaff(st);
        setDeletions(d);
      })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : 'Could not load admin data'));
  }, []);
  useEffect(reload, [reload]);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setErr(null);
    setMsg(null);
    try {
      await fn();
      setMsg(ok);
      reload();
      onChanged();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Action failed');
    }
  };

  const [schoolName, setSchoolName] = useState('');
  const [cls, setCls] = useState({ schoolId: '', grade: 4, section: 'A' });
  const [nu, setNu] = useState({ email: '', fullName: '', password: '', role: 'teacher' as Role, classIds: [] as string[] });
  const classLabel = (id: string) => {
    const c = classes.find((x) => x.id === id);
    return c ? `${c.school} · Grade ${c.grade}${c.section}` : id;
  };

  return (
    <div style={ui.page} className="fade-in">
      {err && <ErrorNote>{err}</ErrorNote>}
      {msg && <div style={{ ...ui.muted, color: '#065F46' }}>{msg}</div>}

      <div style={ui.grid2}>
        <Card title="Schools">
          <div style={ui.filters}>
            <input style={ui.input} placeholder="School name" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} />
            <button style={ui.primaryBtn} disabled={schoolName.trim().length < 2} onClick={() => act(() => adminCreateSchool(schoolName.trim()).then(() => setSchoolName('')), 'School added')}>
              Add school
            </button>
          </div>
          <ul style={styles.ul}>
            {schools.map((s) => (
              <li key={s.id}>{s.name}</li>
            ))}
          </ul>
        </Card>

        <Card title="Classes" sub="Give students the join code; they enter it once in the app to appear in their teacher's dashboard.">
          <div style={ui.filters}>
            <select style={ui.input} value={cls.schoolId} onChange={(e) => setCls({ ...cls, schoolId: e.target.value })} aria-label="School">
              <option value="">School…</option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <input style={{ ...ui.input, width: 80 }} type="number" min={1} max={12} value={cls.grade} onChange={(e) => setCls({ ...cls, grade: Number(e.target.value) })} aria-label="Grade" />
            <input style={{ ...ui.input, width: 70 }} value={cls.section} onChange={(e) => setCls({ ...cls, section: e.target.value })} aria-label="Section" />
            <button style={ui.primaryBtn} disabled={!cls.schoolId} onClick={() => act(() => adminCreateClass(cls.schoolId, cls.grade, cls.section), 'Class added')}>
              Add class
            </button>
          </div>
          <table style={{ ...ui.table, marginTop: '0.6rem' }}>
            <thead>
              <tr>
                <th style={ui.th}>Class</th>
                <th style={ui.th}>Join code</th>
              </tr>
            </thead>
            <tbody>
              {classes.map((c) => (
                <tr key={c.id}>
                  <td style={ui.td}>{classLabel(c.id)}</td>
                  <td style={ui.td}>
                    <code style={{ ...ui.code, fontSize: '0.95rem', letterSpacing: '0.1em' }}>{c.joinCode}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <Card title="Staff accounts" sub="Teachers see only the classes assigned to them. Researchers see de-identified exports only.">
        <div style={ui.filters}>
          <input style={ui.input} placeholder="E-mail" value={nu.email} onChange={(e) => setNu({ ...nu, email: e.target.value })} />
          <input style={ui.input} placeholder="Full name" value={nu.fullName} onChange={(e) => setNu({ ...nu, fullName: e.target.value })} />
          <input style={ui.input} type="password" placeholder="Initial password (10+ chars)" value={nu.password} onChange={(e) => setNu({ ...nu, password: e.target.value })} autoComplete="new-password" />
          <select style={ui.input} value={nu.role} onChange={(e) => setNu({ ...nu, role: e.target.value as Role })} aria-label="Role">
            <option value="teacher">Teacher</option>
            <option value="researcher">Researcher</option>
            <option value="admin">Admin</option>
          </select>
          <select
            style={{ ...ui.input, minWidth: 200 }}
            multiple
            value={nu.classIds}
            onChange={(e) => setNu({ ...nu, classIds: Array.from(e.target.selectedOptions).map((o) => o.value) })}
            aria-label="Classes"
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {classLabel(c.id)}
              </option>
            ))}
          </select>
          <button
            style={ui.primaryBtn}
            disabled={!nu.email || !nu.fullName || nu.password.length < 10}
            onClick={() => act(() => adminCreateStaff(nu).then(() => setNu({ email: '', fullName: '', password: '', role: 'teacher', classIds: [] })), 'Account created')}
          >
            Create
          </button>
        </div>
        <div style={ui.tableWrap}>
          <table style={{ ...ui.table, marginTop: '0.8rem' }}>
            <thead>
              <tr>
                {['Name', 'E-mail', 'Role', 'Classes', 'Last sign-in', ''].map((h) => (
                  <th key={h} style={ui.th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staff.map((u) => (
                <tr key={u.id} style={{ opacity: u.isActive ? 1 : 0.5 }}>
                  <td style={ui.td}>{u.fullName}</td>
                  <td style={ui.td}>{u.email}</td>
                  <td style={ui.td}>{u.role}</td>
                  <td style={ui.td}>
                    {u.role === 'teacher' ? (
                      <select
                        multiple
                        style={{ ...ui.input, minWidth: 200 }}
                        value={u.classIds}
                        aria-label={`Classes for ${u.fullName}`}
                        onChange={(e) =>
                          act(
                            () => adminSetStaffClasses(u.id, Array.from(e.target.selectedOptions).map((o) => o.value)),
                            'Classes updated',
                          )
                        }
                      >
                        {classes.map((c) => (
                          <option key={c.id} value={c.id}>
                            {classLabel(c.id)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td style={ui.td}>{formatDateTime(u.lastLoginAt)}</td>
                  <td style={ui.td}>
                    {u.isActive && (
                      <button style={ui.dangerBtn} onClick={() => window.confirm(`Deactivate ${u.email}?`) && act(() => adminDeactivateStaff(u.id), 'Account deactivated')}>
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card
        title="Data deletion requests"
        sub="Completing a request permanently deletes the participant's attempts, recordings and images, and anonymises the account. Consent records are kept with the guardian name removed, as evidence. Follow the approved research protocol before completing."
      >
        {deletions.length === 0 ? (
          <Empty>No requests.</Empty>
        ) : (
          <table style={ui.table}>
            <thead>
              <tr>
                {['Participant', 'Requested', 'Reason', 'Status', ''].map((h) => (
                  <th key={h} style={ui.th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {deletions.map((d) => (
                <tr key={d.id}>
                  <td style={ui.td}>
                    <code style={ui.code}>{d.participantId}</code>
                  </td>
                  <td style={ui.td}>{formatDateTime(d.requestedAt)}</td>
                  <td style={ui.td}>{d.reason || '—'}</td>
                  <td style={ui.td}>
                    {d.status}
                    {d.processedAt && <div style={ui.muted}>{formatDateTime(d.processedAt)}</div>}
                  </td>
                  <td style={ui.td}>
                    {d.status === 'pending' && (
                      <div style={ui.filters}>
                        <button
                          style={ui.dangerBtn}
                          onClick={() =>
                            window.confirm(`Permanently delete all research data for ${d.participantId}? This cannot be undone.`) &&
                            act(() => adminProcessDeletion(d.id, 'complete', ''), 'Data deleted')
                          }
                        >
                          Delete data
                        </button>
                        <button
                          style={ui.secondaryBtn}
                          onClick={() => {
                            const note = window.prompt('Reason for rejecting (recorded):') ?? '';
                            if (note) void act(() => adminProcessDeletion(d.id, 'reject', note), 'Request rejected');
                          }}
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  ul: { margin: '0.7rem 0 0 1.1rem', fontSize: '0.9rem', color: 'var(--color-slate-700)', lineHeight: 1.7 },
};
