// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PassagesView } from '../components/PassagesView';
import { AdminView } from '../components/AdminView';
import type { ClassGroup } from '../types';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function mockFetch(routes: Record<string, () => Response>) {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const key = `${init.method ?? 'GET'} ${new URL(String(input), 'http://localhost').pathname}`;
      calls.push(key);
      return routes[key]?.() ?? json({ error: { message: `no route ${key}` } }, 404);
    }),
  );
  return calls;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const cls = { id: 'c1', name: 'Grade 4A', grade: 4, section: 'A', joinCode: 'ABC234', school: 'GHPS', studentCount: 1 } as ClassGroup;
const passage = (id: string, canEdit: boolean) => ({
  id,
  kind: 'reading',
  language: 'English',
  level: 'Easy',
  title: `Title ${id}`,
  kannadaTitle: '',
  text: 'Text',
  kannadaText: '',
  minWords: null,
  hint: '',
  kannadaHint: '',
  version: 1,
  isActive: true,
  updatedAt: '2026-11-01T00:00:00Z',
  canEdit,
});

describe('passages', () => {
  it('offers Edit only for passages the teacher may change', async () => {
    mockFetch({
      'GET /passages': () => json([passage('P-SEEDED', false), passage('MINE-1', true)]),
      'GET /assignments': () => json([]),
    });
    render(<PassagesView classes={[cls]} selectedClass={cls} />);
    await screen.findByText('Title MINE-1');
    expect(screen.getAllByRole('button', { name: 'Edit' })).toHaveLength(1);
    expect(screen.getByText('Shared')).toBeTruthy();
  });
});

describe('admin storage deletions', () => {
  it('warns about files a deletion could not remove and retries on request', async () => {
    let pending = 2;
    const calls = mockFetch({
      'GET /admin/schools': () => json([]),
      'GET /admin/classes': () => json([]),
      'GET /admin/staff': () => json([]),
      'GET /admin/deletion-requests': () => json([]),
      'GET /admin/storage-deletions': () =>
        json({ pending, items: pending ? [{ attempts: 1, lastError: 'OSError: bucket down', requestedAt: '2026-11-01T00:00:00Z' }] : [] }),
      'POST /admin/storage-deletions/retry': () => {
        pending = 0;
        return json({ deleted: 2, failed: 0, pending: 0 });
      },
    });
    render(<AdminView onChanged={() => {}} />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('2 stored file(s)');
    expect(alert.textContent).toContain('bucket down');
    fireEvent.click(screen.getByRole('button', { name: 'Retry now' }));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(calls).toContain('POST /admin/storage-deletions/retry');
  });
});
