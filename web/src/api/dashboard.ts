import type {
  Analytics,
  Assignment,
  CommentCategory,
  MissedWord,
  Passage,
  ResearchSummary,
  Role,
  Student,
  Teacher,
  TeacherComment,
} from '../types';

/** Backend base URL, baked in at build time (VITE_API_BASE_URL). */
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');
export const isApiConfigured = API_BASE_URL !== '';

// Tab-scoped storage: the token disappears when the browser tab closes, which suits shared school PCs.
const TOKEN_KEY = 'vgyan.staff.token';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

export function getToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function setToken(token: string | null) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage blocked; the session lasts until reload.
  }
}

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError('Cannot reach the server. Check your internet connection.', 0, 'network');
  }
  if (!res.ok) {
    let message = `Request failed (HTTP ${res.status})`;
    let code: string | undefined;
    try {
      const body = await res.json();
      message = body?.error?.message ?? body?.detail ?? message;
      code = body?.error?.code;
    } catch {
      // non-JSON error body
    }
    if (res.status === 401 && path !== '/auth/staff/login') {
      setToken(null);
      onUnauthorized?.();
    }
    throw new ApiError(message, res.status, code);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function login(email: string, password: string): Promise<Role> {
  const r = await request<{ access_token: string; role: Role }>('/auth/staff/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setToken(r.access_token);
  return r.role;
}

export function logout() {
  setToken(null);
}

export const getMe = () => request<Teacher>('/teacher/me');

export interface DashboardData {
  teacher: Teacher;
  students: Student[];
  missedWords: MissedWord[];
  comments: TeacherComment[];
}

/** Everything the class views need for the signed-in teacher. Researchers get no named records. */
export async function loadDashboard(teacher: Teacher): Promise<DashboardData> {
  if (teacher.role === 'researcher') return { teacher, students: [], missedWords: [], comments: [] };
  const [students, missedWords, comments] = await Promise.all([
    request<Student[]>('/teacher/students'),
    request<MissedWord[]>('/teacher/missed-words'),
    request<TeacherComment[]>('/teacher/comments'),
  ]);
  return { teacher, students, missedWords, comments };
}

export const getStudent = (id: string) => request<Student>(`/teacher/students/${id}`);

export const getAnalytics = (classId?: string) =>
  request<Analytics>(`/teacher/analytics${classId ? `?classId=${encodeURIComponent(classId)}` : ''}`);

export const getMissedWords = (language?: string) =>
  request<MissedWord[]>(`/teacher/missed-words${language ? `?language=${encodeURIComponent(language)}` : ''}`);

export function addComment(c: { studentId: string; text: string; category: CommentCategory }) {
  return request<TeacherComment>('/teacher/comments', { method: 'POST', body: JSON.stringify(c) });
}

/** Short-lived signed URL for a recording or handwriting image (access is audited server-side). */
export const getAudioUrl = (attemptId: string) =>
  request<{ url: string; expiresIn: number }>(`/teacher/reading/${attemptId}/audio`);
export const getImageUrl = (attemptId: string) =>
  request<{ url: string; expiresIn: number }>(`/teacher/writing/${attemptId}/image`);

export const listPassages = () => request<Passage[]>('/passages');
export const createPassage = (p: Partial<Passage>) =>
  request<Passage>('/passages', { method: 'POST', body: JSON.stringify(p) });
export const updatePassage = (p: Partial<Passage> & { id: string }) =>
  request<Passage>(`/passages/${encodeURIComponent(p.id)}`, { method: 'PUT', body: JSON.stringify(p) });

export const listAssignments = () => request<Assignment[]>('/assignments');
export const assignPassage = (passageId: string, classId: string, dueAt: string | null) =>
  request<Assignment>('/assignments', { method: 'POST', body: JSON.stringify({ passageId, classId, dueAt }) });
export const unassign = (id: string) => request<void>(`/assignments/${id}`, { method: 'DELETE' });

export const getResearchSummary = () => request<ResearchSummary>('/research/summary');

/** Downloads the de-identified, consent-filtered CSV produced by the server. */
export async function downloadResearchExport(dataset: 'reading' | 'writing' | 'participants', language?: string) {
  const params = new URLSearchParams({ dataset });
  if (language) params.set('language', language);
  const res = await fetch(`${API_BASE_URL}/research/export?${params}`, {
    headers: { Authorization: `Bearer ${getToken() ?? ''}` },
  });
  if (!res.ok) {
    let msg = `Export failed (HTTP ${res.status})`;
    try {
      msg = (await res.json())?.error?.message ?? msg;
    } catch {
      // ignore
    }
    throw new ApiError(msg, res.status);
  }
  const blob = await res.blob();
  const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? `vgyan-${dataset}.csv`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return { sha256: res.headers.get('X-Content-SHA256') ?? '' };
}

// ---- admin ----
export interface AdminClass {
  id: string;
  schoolId: string;
  school: string;
  grade: number;
  section: string;
  joinCode: string;
}
export interface AdminStaff {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  isActive: boolean;
  classIds: string[];
  lastLoginAt: string | null;
}
export interface DeletionRequestRow {
  id: string;
  participantId: string;
  reason: string;
  status: 'pending' | 'completed' | 'rejected';
  requestedAt: string;
  processedAt: string | null;
  note: string;
}
export const adminListSchools = () => request<{ id: string; name: string; district: string | null }[]>('/admin/schools');
export const adminCreateSchool = (name: string, district?: string) =>
  request<{ id: string; name: string }>('/admin/schools', { method: 'POST', body: JSON.stringify({ name, district }) });
export const adminListClasses = () => request<AdminClass[]>('/admin/classes');
export const adminCreateClass = (schoolId: string, grade: number, section: string) =>
  request<AdminClass>('/admin/classes', { method: 'POST', body: JSON.stringify({ schoolId, grade, section }) });
export const adminListStaff = () => request<AdminStaff[]>('/admin/staff');
export const adminCreateStaff = (s: { email: string; fullName: string; password: string; role: Role; classIds: string[] }) =>
  request<AdminStaff>('/admin/staff', { method: 'POST', body: JSON.stringify(s) });
export const adminSetStaffClasses = (id: string, classIds: string[]) =>
  request<{ id: string }>(`/admin/staff/${id}/classes`, { method: 'PUT', body: JSON.stringify(classIds) });
export const adminDeactivateStaff = (id: string) => request<void>(`/admin/staff/${id}/deactivate`, { method: 'POST' });
export const adminListDeletions = () => request<DeletionRequestRow[]>('/admin/deletion-requests');
export const adminProcessDeletion = (id: string, action: 'complete' | 'reject', note: string) =>
  request<{ status: string }>(`/admin/deletion-requests/${id}`, { method: 'POST', body: JSON.stringify({ action, note }) });
