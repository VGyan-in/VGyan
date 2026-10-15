import React, { useState } from 'react';
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
import {
  CURRENT_TEACHER,
  INITIAL_STUDENTS,
  INITIAL_MISSED_WORDS,
  INITIAL_COMMENTS,
} from './data/mockData';
import { Student, ClassGroup, TeacherComment } from './types';
import { BookOpen, AlertCircle } from 'lucide-react';

export default function App() {
  const [teacher] = useState(CURRENT_TEACHER);
  const [selectedClass, setSelectedClass] = useState<ClassGroup>(teacher.assignedClasses[0]);
  const [currentTab, setCurrentTab] = useState<NavTab>('overview');
  const [students, setStudents] = useState<Student[]>(INITIAL_STUDENTS);
  const [missedWords] = useState(INITIAL_MISSED_WORDS);
  const [comments, setComments] = useState<TeacherComment[]>(INITIAL_COMMENTS);
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
    const newCmt: TeacherComment = {
      id: `cmt_${Date.now()}`,
      studentId,
      studentName,
      author: teacher.name,
      text,
      category,
      timestamp: new Date().toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
    setComments([newCmt, ...comments]);
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
