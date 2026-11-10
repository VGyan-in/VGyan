// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from '../App';
import type { Student, Teacher } from '../types';


const reading = {
  id: 'r1',
  participantId: 'VG-1',
  studentId: 's1',
  studentName: 'Asha K',
  date: '2026-11-02T10:00:00Z',
  passageId: 'P-EN-E1',
  passageTitle: 'My Pet Cat',
  language: 'English',
  level: 'Easy',
  accuracy: 62.5,
  wpm: 48,
  wcpm: 30,
  pace: 'Slow',
  durationSeconds: 40,
  substitutions: 1,
  omissions: 2,
  insertions: 0,
  referenceText: 'The boy went to school',
  transcript: 'the boy go',
  words: [
    { status: 'correct', ref: 'The', hyp: 'the' },
    { status: 'correct', ref: 'boy', hyp: 'boy' },
    { status: 'substitution', ref: 'went', hyp: 'go' },
    { status: 'omission', ref: 'to' },
    { status: 'omission', ref: 'school' },
  ],
  practiceWords: ['went', 'school'],
  fluency: null,
  asrModelVersion: 'vosk-model-small-en-in-0.4',
  asrConfidence: 0.8,
  metricsVerified: false,
  hasAudio: true,
  aiStatus: 'completed',
  aiFeedback: { summary: 'Keep practising!', strengths: ['Clear voice'], improvements: [], modelVersion: 'gemini-x', promptVersion: 'reading-feedback-v1.0' },
  aiModelVersion: 'gemini-x',
  aiPromptVersion: 'reading-feedback-v1.0',
};

const student: Student = {
  studentId: 's1',
  participantId: 'VG-1',
  name: 'Asha K',
  classId: 'c1',
  className: 'Grade 4A',
  profile: { nativeLanguage: 'Kannada' },
  consentStatus: 'active',
  consentVersion: '1.0',
  consentCurrent: true,
  lastAssessmentDate: '2026-11-02T10:00:00Z',
  readingCount: 1,
  writingCount: 0,
  overallReadingAccuracy: 62.5,
  averageWpm: 48,
  writingScore: null,
  isAtRisk: true,
  atRiskReason: 'Average accuracy 62.5% over the last 1 readings is below 75%',
  recentReadingAttempts: [reading as Student['recentReadingAttempts'][number]],
  recentWritingAttempts: [],
};

const teacher: Teacher = {
  id: 't1',
  name: 'Teacher One',
  email: 't@x.org',
  role: 'teacher',
  school: 'GHPS',
  assignedClasses: [{ id: 'c1', name: 'Grade 4A', grade: 4, section: 'A', joinCode: 'ABC234', school: 'GHPS', studentCount: 1 }],
};

type Handler = (url: URL, init: RequestInit) => Response | Promise<Response>;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function mockFetch(routes: Record<string, Handler>) {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = new URL(String(input));
      const key = `${init.method ?? 'GET'} ${url.pathname}`;
      calls.push(key);
      const h = routes[key];
      if (!h) return json({ error: { message: `no route ${key}` } }, 404);
      return h(url, init);
    }),
  );
  return calls;
}

const teacherRoutes = (t: Teacher = teacher): Record<string, Handler> => ({
  'GET /teacher/me': () => json(t),
  'GET /teacher/students': () => json([student]),
  'GET /teacher/missed-words': () => json([{ word: 'went', language: 'English', frequency: 3, primaryError: 'substitution', commonSubstitutions: ['go'], affectedStudentsCount: 1 }]),
  'GET /teacher/comments': () => json([]),
  'GET /teacher/analytics': () =>
    json({
      students: 1,
      weekly: [{ week: '2026-W45', readingCount: 1, writingCount: 0, avgAccuracy: 62.5, avgWpm: 48, avgWritingScore: null }],
      byLanguageLevel: [{ language: 'English', level: 'Easy', attempts: 1, avgAccuracy: 62.5, avgWpm: 48, avgSubstitutions: 1, avgOmissions: 2, avgInsertions: 0 }],
      completion: { readingAny: 1, writingAny: 0, both: 0, englishReading: 1, kannadaReading: 0, none: 0 },
      unverifiedMetrics: 1,
    }),
  'GET /teacher/students/s1': () => json(student),
});

beforeEach(() => sessionStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('authentication', () => {
  it('signs in, stores the token for the tab only, and loads the class', async () => {
    const calls = mockFetch({
      'POST /auth/staff/login': async (_u, init) => {
        expect(JSON.parse(String(init.body))).toEqual({ email: 't@x.org', password: 'pw-123456789' });
        return json({ access_token: 'tok', role: 'teacher' });
      },
      ...teacherRoutes(),
    });
    render(<App />);
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 't@x.org' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'pw-123456789' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText('Class overview')).toBeTruthy();
    expect(sessionStorage.getItem('vgyan.staff.token')).toBe('tok');
    expect(localStorage.getItem('vgyan.staff.token')).toBeNull();
    expect(calls).toContain('GET /teacher/students');
  });

  it('shows the server message on wrong credentials', async () => {
    mockFetch({ 'POST /auth/staff/login': () => json({ error: { code: 'invalid_credentials', message: 'Incorrect e-mail or password' } }, 401) });
    render(<App />);
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 't@x.org' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'bad' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText('Incorrect e-mail or password')).toBeTruthy();
    expect(sessionStorage.getItem('vgyan.staff.token')).toBeNull();
  });

  it('returns to the login screen when the session expires', async () => {
    sessionStorage.setItem('vgyan.staff.token', 'old');
    mockFetch({ 'GET /teacher/me': () => json({ error: { message: 'Session expired' } }, 401) });
    render(<App />);
    expect(await screen.findByRole('button', { name: /sign in/i })).toBeTruthy();
    expect(sessionStorage.getItem('vgyan.staff.token')).toBeNull();
  });
});

describe('teacher views use real records', () => {
  beforeEach(() => sessionStorage.setItem('vgyan.staff.token', 'tok'));

  it('overview shows metrics computed from synced data', async () => {
    mockFetch(teacherRoutes());
    render(<App />);
    expect((await screen.findAllByText('62.5%')).length).toBeGreaterThan(0);
    expect(screen.getByText('Need reading support')).toBeTruthy();
    expect(await screen.findByText('Metrics not verified')).toBeTruthy();
    expect(screen.queryByText(/from last week/)).toBeNull(); // no invented trend claims
  });

  it('student detail shows word-level errors, transcript, AI versions and loads audio on demand', async () => {
    const calls = mockFetch({ ...teacherRoutes(), 'GET /teacher/reading/r1/audio': () => json({ url: 'https://files.test/a.wav', expiresIn: 300 }) });
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: /Student Directory/ }));
    fireEvent.click(await screen.findByText('Details'));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('tab', { name: /Reading/ }));
    expect(within(dialog).getByText('the boy go')).toBeTruthy();
    expect(within(dialog).getByTitle('Heard "go"')).toBeTruthy();
    expect(within(dialog).getByText(/does not match the metrics the phone reported/)).toBeTruthy();
    expect(within(dialog).getByText(/reading-feedback-v1.0/)).toBeTruthy();
    expect(calls).not.toContain('GET /teacher/reading/r1/audio');
    fireEvent.click(within(dialog).getByRole('button', { name: /Load recording/ }));
    await waitFor(() => expect(dialog.querySelector('audio')?.getAttribute('src')).toBe('https://files.test/a.wav'));
  });

  it('teacher with no class sees guidance, not other classes', async () => {
    mockFetch({ ...teacherRoutes({ ...teacher, assignedClasses: [] }), 'GET /teacher/students': () => json([]) });
    render(<App />);
    expect(await screen.findByText('No classes assigned')).toBeTruthy();
    expect(screen.queryByText('Research Export')).toBeNull();
  });

  it('adds a note through the API', async () => {
    mockFetch({
      ...teacherRoutes(),
      'POST /teacher/comments': async (_u, init) => {
        const b = JSON.parse(String(init.body));
        return json({ id: 'n1', studentId: b.studentId, studentName: 'Asha K', author: 'Teacher One', text: b.text, category: b.category, timestamp: '2026-11-03T10:00:00Z' }, 201);
      },
    });
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: /Student Directory/ }));
    fireEvent.click(await screen.findByText('Details'));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('tab', { name: /Notes/ }));
    fireEvent.change(within(dialog).getByLabelText('Add a note'), { target: { value: 'Practise went' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /Save note/ }));
    expect(await within(dialog).findByText('Practise went')).toBeTruthy();
  });
});

describe('researcher role', () => {
  beforeEach(() => sessionStorage.setItem('vgyan.staff.token', 'tok'));

  it('sees only de-identified exports and never requests named student records', async () => {
    const calls = mockFetch({
      'GET /teacher/me': () => json({ ...teacher, role: 'researcher', assignedClasses: [] }),
      'GET /research/summary': () =>
        json({
          consentedParticipants: 3,
          readingAttempts: 10,
          writingAttempts: 4,
          readingWithAudio: 9,
          readingMetricsUnverified: 0,
          writingFromImage: 2,
          byLanguage: { English: { reading: 6, writing: 2 }, Kannada: { reading: 4, writing: 2 } },
        }),
      'GET /research/export': (u) => {
        expect(u.searchParams.get('dataset')).toBe('reading');
        return new Response('﻿participant_id\nVG-1\n', { headers: { 'Content-Disposition': 'attachment; filename="vgyan-reading.csv"', 'X-Content-SHA256': 'abcdef0123456789abcdef' } });
      },
    });
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    render(<App />);
    expect(await screen.findByText('Consented participants')).toBeTruthy();
    expect(calls).not.toContain('GET /teacher/students');
    expect(screen.queryByText('Student Directory')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Reading dataset/ }));
    expect(await screen.findByText(/SHA-256 abcdef0123456789/)).toBeTruthy();
  });
});
