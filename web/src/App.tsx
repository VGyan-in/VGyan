import React, { useCallback, useEffect, useState } from 'react';
import { Sidebar, type NavTab } from './components/Sidebar';
import { Header } from './components/Header';
import { ClassOverview } from './components/ClassOverview';
import { AtRiskWatchlist } from './components/AtRiskWatchlist';
import { StudentDirectory } from './components/StudentDirectory';
import { StudentDetailModal } from './components/StudentDetailModal';
import { MissedWordsView } from './components/MissedWordsView';
import { WritingSubmissionsView } from './components/WritingSubmissionsView';
import { TeacherNotesView } from './components/TeacherNotesView';
import { ReadingAttemptsView } from './components/ReadingAttemptsView';
import { PassagesView } from './components/PassagesView';
import { ResearchView } from './components/ResearchView';
import { AdminView } from './components/AdminView';
import { LoginScreen } from './components/LoginScreen';
import { addComment, getMe, getToken, loadDashboard, logout, setUnauthorizedHandler, type DashboardData } from './api/dashboard';
import type { ClassGroup, CommentCategory, Student, TeacherComment } from './types';

export default function App() {
  const [signedIn, setSignedIn] = useState(() => !!getToken());
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setSignedIn(false);
      setData(null);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    getMe()
      .then(loadDashboard)
      .then((d) => {
        if (cancelled) return;
        setError(null);
        setData(d);
        setLoadedAt(new Date());
      })
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : 'Could not load data'));
    return () => {
      cancelled = true;
    };
  }, [signedIn, reloadKey]);

  const signOut = useCallback(() => {
    logout();
    setSignedIn(false);
    setData(null);
  }, []);

  if (!signedIn) return <LoginScreen onSignedIn={() => setSignedIn(true)} />;
  if (error && !data) {
    return (
      <div style={styles.statusScreen}>
        <p style={styles.heading}>Could not load the dashboard</p>
        <p style={styles.text}>{error}</p>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button style={styles.retryButton} onClick={() => setReloadKey((k) => k + 1)}>
            Try again
          </button>
          <button style={styles.retryButton} onClick={signOut}>
            Sign out
          </button>
        </div>
      </div>
    );
  }
  if (!data) {
    return (
      <div style={styles.statusScreen}>
        <p style={styles.text}>Loading…</p>
      </div>
    );
  }
  return (
    <Dashboard
      data={data}
      loadedAt={loadedAt}
      onReload={() => setReloadKey((k) => k + 1)}
      onSignOut={signOut}
      onCommentsChange={(comments) => setData({ ...data, comments })}
    />
  );
}

const TITLES: Record<NavTab, [string, string, string]> = {
  overview: ['Class overview', 'ತರಗತಿ ಅವಲೋಕನ', 'Reading and writing progress from synced assessments'],
  'at-risk': ['Reading support list', 'ಓದಿನಲ್ಲಿ ಸಹಾಯ ಬೇಕಾದವರು', 'Students whose recent reading accuracy is low'],
  students: ['Students', 'ವಿದ್ಯಾರ್ಥಿಗಳು', 'Roster, consent status and recent results'],
  reading: ['Reading assessments', 'ಓದುವಿಕೆ ಮೌಲ್ಯಮಾಪನ', 'Offline speech recognition, word alignment and fluency metrics'],
  writing: ['Writing submissions', 'ಬರವಣಿಗೆ', 'Typed and handwritten answers, OCR output and AI feedback'],
  'missed-words': ['Frequently missed words', 'ಪದೇ ಪದೇ ತಪ್ಪಾಗುವ ಪದಗಳು', 'Substitutions and omissions across readings'],
  comments: ['Teacher notes', 'ಶಿಕ್ಷಕರ ಟಿಪ್ಪಣಿಗಳು', 'Interventions, praise and guardian communication'],
  passages: ['Passages & assignments', 'ಪಠ್ಯಗಳು', 'Reading passages and writing prompts available offline to students'],
  research: ['Research export', 'ಸಂಶೋಧನಾ ದತ್ತಾಂಶ', 'De-identified, consent-filtered datasets'],
  admin: ['Administration', 'ಆಡಳಿತ', 'Schools, classes, staff accounts and deletion requests'],
};

interface DashboardProps {
  data: DashboardData;
  loadedAt: Date | null;
  onReload: () => void;
  onSignOut: () => void;
  onCommentsChange: (c: TeacherComment[]) => void;
}

function Dashboard({ data, loadedAt, onReload, onSignOut, onCommentsChange }: DashboardProps) {
  const { teacher, students, missedWords, comments } = data;
  const [selectedClassId, setSelectedClassId] = useState<string | null>(teacher.assignedClasses[0]?.id ?? null);
  const selectedClass: ClassGroup | null = teacher.assignedClasses.find((c) => c.id === selectedClassId) ?? teacher.assignedClasses[0] ?? null;
  const initialTab: NavTab = teacher.role === 'researcher' ? 'research' : selectedClass ? 'overview' : teacher.role === 'admin' ? 'admin' : 'overview';
  const [tab, setTab] = useState<NavTab>(initialTab);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [lang, setLang] = useState<'en' | 'kn'>('en');
  const [noteErr, setNoteErr] = useState<string | null>(null);

  const classStudents = selectedClass ? students.filter((s) => s.classId === selectedClass.id) : [];
  const classIds = new Set(classStudents.map((s) => s.studentId));
  const classComments = comments.filter((c) => classIds.has(c.studentId));
  const atRiskCount = classStudents.filter((s) => s.isAtRisk).length;
  const [en, kn, sub] = TITLES[tab];

  const addNote = (studentId: string, text: string, category: CommentCategory) => {
    setNoteErr(null);
    addComment({ studentId, text, category })
      .then((saved) => onCommentsChange([saved, ...comments]))
      .catch((e: unknown) => setNoteErr(`Note not saved: ${e instanceof Error ? e.message : 'unknown error'}`));
  };

  const needsClass = tab !== 'research' && tab !== 'admin';
  return (
    <div style={styles.appLayout}>
      <Sidebar
        currentTab={tab}
        onSelectTab={setTab}
        teacher={teacher}
        selectedClass={selectedClass}
        onSelectClass={(c) => setSelectedClassId(c.id)}
        atRiskCount={atRiskCount}
        onLogout={onSignOut}
      />
      <div style={styles.mainWrapper}>
        <Header
          title={lang === 'en' ? en : kn}
          subtitle={sub}
          activeClass={needsClass ? selectedClass : null}
          lang={lang}
          onToggleLang={() => setLang(lang === 'en' ? 'kn' : 'en')}
          loadedAt={loadedAt}
          onRefresh={onReload}
        />
        <main style={styles.pageBody}>
          {noteErr && <div style={styles.error}>{noteErr}</div>}
          {needsClass && !selectedClass ? (
            <div style={styles.statusScreenInline}>
              <p style={styles.heading}>No classes assigned</p>
              <p style={styles.text}>Ask your administrator to assign a class to your account.</p>
            </div>
          ) : (
            <>
              {tab === 'overview' && selectedClass && (
                <ClassOverview students={classStudents} classId={selectedClass.id} onNavigateTab={setTab} onSelectStudent={setSelectedStudent} />
              )}
              {tab === 'at-risk' && <AtRiskWatchlist students={classStudents} onSelectStudent={setSelectedStudent} />}
              {tab === 'students' && <StudentDirectory students={classStudents} onSelectStudent={setSelectedStudent} />}
              {tab === 'reading' && <ReadingAttemptsView students={classStudents} onSelectStudent={setSelectedStudent} />}
              {tab === 'writing' && <WritingSubmissionsView students={classStudents} />}
              {tab === 'missed-words' && <MissedWordsView missedWords={missedWords} />}
              {tab === 'comments' && <TeacherNotesView comments={classComments} students={classStudents} onAddComment={addNote} />}
              {tab === 'passages' && selectedClass && <PassagesView classes={teacher.assignedClasses} selectedClass={selectedClass} />}
              {tab === 'research' && <ResearchView />}
              {tab === 'admin' && <AdminView onChanged={onReload} />}
            </>
          )}
        </main>
      </div>
      {selectedStudent && (
        <StudentDetailModal
          student={selectedStudent}
          comments={comments}
          onClose={() => setSelectedStudent(null)}
          onCommentAdded={(c) => onCommentsChange([c, ...comments])}
        />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  statusScreen: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    padding: '1rem',
    textAlign: 'center',
    backgroundColor: 'var(--color-soft-cream)',
  },
  statusScreenInline: { padding: '3rem 1rem', textAlign: 'center' },
  retryButton: {
    marginTop: '0.75rem',
    padding: '0.5rem 1rem',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--color-leaf-tint)',
    backgroundColor: 'var(--color-light-green)',
    color: 'var(--color-deep-forest)',
    fontWeight: 600,
    cursor: 'pointer',
  },
  appLayout: { display: 'flex', minHeight: '100vh', backgroundColor: 'var(--color-soft-cream)' },
  mainWrapper: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflowX: 'hidden' },
  pageBody: { padding: '1.75rem 2rem 3rem 2rem', maxWidth: '1440px', width: '100%', margin: '0 auto', boxSizing: 'border-box' },
  heading: { fontSize: '1rem', fontWeight: 700, color: 'var(--color-deep-forest)' },
  text: { fontSize: '0.85rem', color: 'var(--color-slate-700)' },
  error: { background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', borderRadius: 10, padding: '0.6rem 0.8rem', fontSize: '0.85rem', marginBottom: '1rem' },
};
