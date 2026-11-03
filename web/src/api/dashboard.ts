import type { MissedWord, Student, Teacher, TeacherComment } from '../types';
import {
  CURRENT_TEACHER,
  INITIAL_COMMENTS,
  INITIAL_MISSED_WORDS,
  INITIAL_STUDENTS,
} from '../data/mockData';

/** Backend base URL. Empty means "no server yet": the dashboard runs on bundled demo data. */
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');
const TOKEN_KEY = 'vgyan.teacher.token';

export const isDemoMode = API_BASE_URL === '';

export interface DashboardData {
  teacher: Teacher;
  students: Student[];
  missedWords: MissedWord[];
  comments: TeacherComment[];
}

export type NewComment = Pick<TeacherComment, 'studentId' | 'text' | 'category'>;

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let token: string | null = null;
  try {
    token = localStorage.getItem(TOKEN_KEY);
  } catch {
    // Storage blocked (private mode); continue unauthenticated.
  }
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 200);
    throw new Error(`HTTP ${res.status}${detail ? `: ${detail}` : ''}`);
  }
  return (await res.json()) as T;
}

/**
 * Everything the dashboard shows for the signed-in teacher.
 * Endpoints are a proposal for the FastAPI backend; responses use the shapes in ../types.
 */
export async function loadDashboard(): Promise<DashboardData> {
  if (isDemoMode) {
    return {
      teacher: CURRENT_TEACHER,
      students: INITIAL_STUDENTS,
      missedWords: INITIAL_MISSED_WORDS,
      comments: INITIAL_COMMENTS,
    };
  }
  const [teacher, students, missedWords, comments] = await Promise.all([
    request<Teacher>('/teacher/me'),
    request<Student[]>('/teacher/students'),
    request<MissedWord[]>('/teacher/missed-words'),
    request<TeacherComment[]>('/teacher/comments'),
  ]);
  return { teacher, students, missedWords, comments };
}

/** Saves a teacher note. In demo mode the note is built locally and not persisted. */
export async function addComment(c: NewComment, author: string, studentName: string): Promise<TeacherComment> {
  if (isDemoMode) {
    return {
      id: `cmt_${Date.now()}`,
      studentId: c.studentId,
      studentName,
      author,
      text: c.text,
      category: c.category,
      timestamp: new Date().toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
  }
  return request<TeacherComment>('/teacher/comments', { method: 'POST', body: JSON.stringify(c) });
}
