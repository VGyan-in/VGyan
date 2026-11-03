import React, { useEffect, useState } from 'react';
import { Sidebar, NavTab } from './components/Sidebar';
import { Header } from './components/Header';
import { ClassOverview } from './components/ClassOverview';
import { AtRiskWatchlist } from './components/AtRiskWatchlist';
import { StudentDirectory } from './components/StudentDirectory';
import { StudentDetailModal } from './components/StudentDetailModal';
import { MissedWordsView } from './components/MissedWordsView';
import { WritingSubmissionsView } from './components/WritingSubmissionsView';
import { TeacherNotesView } from './components/TeacherNotesView';
import { ResearchExportModal } from './components/ResearchExportModal';
import { addComment, isDemoMode, loadDashboard, type DashboardData } from './api/dashboard';
import { Student, ClassGroup, TeacherComment } from './types';
import { BookOpen } from 'lucide-react';

export default function App() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadDashboard()
      .then((d) => !cancelled && setData(d))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : 'Could not load data'));
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  if (error) {
    return (
      <div style={styles.statusScreen}>
        <p style={styles.bannerHeading}>Couldn't load the dashboard</p>
        <p style={styles.bannerText}>{error}</p>
        <button
          style={styles.retryButton}
          onClick={() => {
            setError(null);
            setReloadKey((k) => k + 1);
          }}
        >
          Try again
        </button>
      </div>
    );
  }
  if (!data) {
    return (
      <div style={styles.statusScreen}>
        <p style={styles.bannerText}>Loading class data…</p>
      </div>
    );
  }
  if (data.teacher.assignedClasses.length === 0) {
    return (
      <div style={styles.statusScreen}>
        <p style={styles.bannerHeading}>No classes assigned</p>
        <p style={styles.bannerText}>Ask your school administrator to assign a class to your account.</p>
      </div>
    );
  }
  return <Dashboard data={data} />;
}

function Dashboard({ data }: { data: DashboardData }) {
  const { teacher, students, missedWords } = data;
  const [selectedClass, setSelectedClass] = useState<ClassGroup>(teacher.assignedClasses[0]);
  const [currentTab, setCurrentTab] = useState<NavTab>('overview');
  const [comments, setComments] = useState<TeacherComment[]>(data.comments);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [lang, setLang] = useState<'en' | 'kn'>('en');

  // Filter students for the active class
  const classStudents = students.filter((s) => s.classId === selectedClass.id);
  const atRiskCount = classStudents.filter((s) => s.isAtRisk || s.overallReadingAccuracy < 75).length;

  const handleAddComment = (
    studentId: string,
    studentName: string,
    text: string,
    category: 'Intervention' | 'Praise' | 'Parent Note' | 'General' = 'Intervention'
  ) => {
    addComment({ studentId, text, category }, teacher.name, studentName)
      .then((saved) => setComments((prev) => [saved, ...prev]))
      .catch((e: unknown) => {
        window.alert(`Note not saved: ${e instanceof Error ? e.message : 'unknown error'}`);
      });
  };

  const getTabTitle = () => {
    switch (currentTab) {
      case 'overview':
        return {
          title: lang === 'en' ? 'Class Performance Overview' : 'ತರಗತಿ ಪ್ರಗತಿ ಅವಲೋಕನ',
          sub: 'Holistic bilingual analytics across oral reading fluency and written language comprehension',
        };
      case 'at-risk':
        return {
          title: lang === 'en' ? 'At-Risk Early Intervention Watchlist' : 'ವಿಶೇಷ ಗಮನ ಬೇಕಾದ ವಿದ್ಯಾರ್ಥಿಗಳು',
          sub: 'Identified students scoring under 75% accuracy requiring targeted phonetic remediation',
        };
      case 'students':
        return {
          title: lang === 'en' ? 'Class Student Directory' : 'ವಿದ್ಯಾರ್ಥಿ ಪಟ್ಟಿ',
          sub: 'Student roster, anonymous research participant mapping, and diagnostic competency profiles',
        };
      case 'reading':
        return {
          title: lang === 'en' ? 'Reading Fluency Assessments' : 'ಓದುವಿಕೆಯ ಮೌಲ್ಯಮಾಪನಗಳು',
          sub: 'Vosk offline speech recognition alignments, substitution logs and audio records',
        };
      case 'writing':
        return {
          title: lang === 'en' ? 'Writing Submissions & OCR' : 'ಬರವಣಿಗೆ ಮತ್ತು OCR ತಪಾಸಣೆ',
          sub: 'Handwritten photos, OCR Space digitization outputs, and Gemini AI feedback',
        };
      case 'missed-words':
        return {
          title: lang === 'en' ? 'Frequently Missed Words' : 'ಪದೇ ಪದೇ ತಪ್ಪಾಗುವ ಪದಗಳು',
          sub: 'Common phonemic mispronunciations, Kannada conjuncts (ottakshara), and omissions',
        };
      case 'comments':
        return {
          title: lang === 'en' ? 'Teacher Observation Logs' : 'ಶಿಕ್ಷಕರ ಟಿಪ್ಪಣಿಗಳು',
          sub: 'Recorded pedagogical interventions, praise, and guardian communications',
        };
    }
  };

  const { title, sub } = getTabTitle();

  return (
    <div style={styles.appLayout}>
      {/* Fixed Left Navigation Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        teacher={teacher}
        selectedClass={selectedClass}
        onSelectClass={setSelectedClass}
        atRiskCount={atRiskCount}
        onOpenExport={() => setShowExportModal(true)}
      />

      {/* Main Content Area */}
      <div style={styles.mainWrapper}>
        <Header
          title={title}
          subtitle={sub}
          activeClass={selectedClass}
          lang={lang}
          onToggleLang={() => setLang(lang === 'en' ? 'kn' : 'en')}
        />

        {isDemoMode && (
          <div style={styles.demoBanner} role="note">
            Demo mode: all students, teachers and scores shown here are sample data, not real records.
          </div>
        )}

        <main style={styles.pageBody}>
          {currentTab === 'overview' && (
            <ClassOverview
              students={classStudents}
              onNavigateTab={setCurrentTab}
              onSelectStudent={setSelectedStudent}
            />
          )}

          {currentTab === 'at-risk' && (
            <AtRiskWatchlist
              students={classStudents}
              onSelectStudent={setSelectedStudent}
              onAddComment={handleAddComment}
            />
          )}

          {currentTab === 'students' && (
            <StudentDirectory
              students={classStudents}
              onSelectStudent={setSelectedStudent}
            />
          )}

          {currentTab === 'reading' && (
            <div style={styles.readingTabContainer} className="fade-in">
              <div style={styles.tabBanner}>
                <BookOpen size={24} color="var(--color-deep-forest)" />
                <div>
                  <h4 style={styles.bannerHeading}>Offline Vosk ASR Reading Pipeline</h4>
                  <p style={styles.bannerText}>
                    Students read passages aloud into their tablets. Audio is recorded at 16 kHz mono WAV, transcribed offline on-device, and synchronized with this dashboard within one sync cycle.
                  </p>
                </div>
              </div>
              <StudentDirectory
                students={classStudents}
                onSelectStudent={setSelectedStudent}
              />
            </div>
          )}

          {currentTab === 'writing' && (
            <WritingSubmissionsView students={classStudents} />
          )}

          {currentTab === 'missed-words' && (
            <MissedWordsView missedWords={missedWords} />
          )}

          {currentTab === 'comments' && (
            <TeacherNotesView
              comments={comments}
              students={classStudents}
              onAddComment={handleAddComment}
            />
          )}
        </main>
      </div>

      {/* Student In-Depth Modal / Drawer */}
      {selectedStudent && (
        <StudentDetailModal
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
          onAddComment={handleAddComment}
        />
      )}

      {/* Research Anonymized CSV Export Modal */}
      {showExportModal && (
        <ResearchExportModal
          students={classStudents}
          onClose={() => setShowExportModal(false)}
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
  demoBanner: {
    padding: '0.5rem 1rem',
    backgroundColor: '#FEF3C7',
    borderBottom: '1px solid #FCD34D',
    color: '#78350F',
    fontSize: '0.85rem',
    fontWeight: 600,
    textAlign: 'center',
  },
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
  appLayout: {
    display: 'flex',
    minHeight: '100vh',
    backgroundColor: 'var(--color-soft-cream)',
  },
  mainWrapper: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    overflowX: 'hidden',
  },
  pageBody: {
    padding: '1.75rem 2rem 3rem 2rem',
    maxWidth: '1440px',
    width: '100%',
    margin: '0 auto',
    boxSizing: 'border-box',
  },
  readingTabContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  tabBanner: {
    backgroundColor: 'var(--color-light-green)',
    border: '1px solid var(--color-leaf-tint)',
    borderRadius: 'var(--radius-lg)',
    padding: '1.25rem 1.5rem',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  bannerHeading: {
    fontSize: '1rem',
    fontWeight: 700,
    color: 'var(--color-deep-forest)',
  },
  bannerText: {
    fontSize: '0.82rem',
    color: 'var(--color-slate-700)',
    marginTop: '0.2rem',
    lineHeight: 1.4,
  },
};
