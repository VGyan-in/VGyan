import React, { useState } from 'react';
import {
  X,
  BookOpen,
  PenTool,
  Clock,
  Play,
  Volume2,
  AlertCircle,
  FileCheck,
  Sparkles,
  Send,
  MessageSquare,
} from 'lucide-react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { Student } from '../types';

interface StudentDetailModalProps {
  student: Student;
  onClose: () => void;
  onAddComment: (studentId: string, studentName: string, text: string) => void;
}

export const StudentDetailModal: React.FC<StudentDetailModalProps> = ({
  student,
  onClose,
  onAddComment,
}) => {
  const [activeTab, setActiveTab] = useState<'skills' | 'reading' | 'writing' | 'notes'>('skills');
  const [newComment, setNewComment] = useState('');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  // Radar data format
  const radarData = [
    { subject: 'Fluency', score: student.radarSkills.fluency, fullMark: 100 },
    { subject: 'Pronunciation', score: student.radarSkills.pronunciation, fullMark: 100 },
    { subject: 'Vocabulary', score: student.radarSkills.vocabulary, fullMark: 100 },
    { subject: 'Sentence Struct.', score: student.radarSkills.sentenceStructure, fullMark: 100 },
    { subject: 'Consistency', score: student.radarSkills.consistency, fullMark: 100 },
  ];

  // Attempt History format for trend chart
  const historyData = [
    { session: 'Oct 08', accuracy: Math.max(50, student.overallReadingAccuracy - 8), wpm: student.averageWpm - 6 },
    { session: 'Oct 10', accuracy: Math.max(52, student.overallReadingAccuracy - 5), wpm: student.averageWpm - 4 },
    { session: 'Oct 12', accuracy: Math.max(55, student.overallReadingAccuracy - 2), wpm: student.averageWpm - 2 },
    { session: 'Oct 15', accuracy: student.overallReadingAccuracy, wpm: student.averageWpm },
  ];

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    onAddComment(student.studentId, student.name, newComment);
    setNewComment('');
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()} className="fade-in">
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <div style={styles.avatarBig}>{student.name.slice(0, 2).toUpperCase()}</div>
            <div>
              <div style={styles.nameRow}>
                <h3 style={styles.name}>{student.name}</h3>
                <span className={student.isAtRisk ? 'badge badge-risk' : 'badge badge-success'}>
                  {student.isAtRisk ? 'At Risk (<75%)' : 'On Track'}
                </span>
              </div>
              <div style={styles.subMeta}>
                <span>Student ID: <strong>{student.studentId}</strong></span>
                <span>•</span>
                <span>Participant: <code style={styles.code}>{student.participantId}</code></span>
                <span>•</span>
                <span>Native: <strong>{student.nativeLanguage}</strong></span>
                <span>•</span>
                <span>Class {student.grade}{student.section}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} style={styles.closeButton}>
            <X size={20} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div style={styles.tabsRow}>
          <button
            onClick={() => setActiveTab('skills')}
            style={{ ...styles.tabBtn, ...(activeTab === 'skills' ? styles.tabBtnActive : {}) }}
          >
            Radar & Fluency Trends
          </button>
          <button
            onClick={() => setActiveTab('reading')}
            style={{ ...styles.tabBtn, ...(activeTab === 'reading' ? styles.tabBtnActive : {}) }}
          >
            Reading Audio Attempts ({student.recentReadingAttempts.length})
          </button>
          <button
            onClick={() => setActiveTab('writing')}
            style={{ ...styles.tabBtn, ...(activeTab === 'writing' ? styles.tabBtnActive : {}) }}
          >
            Writing & OCR Submissions ({student.recentWritingAttempts.length})
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            style={{ ...styles.tabBtn, ...(activeTab === 'notes' ? styles.tabBtnActive : {}) }}
          >
            Teacher Interventions
          </button>
        </div>

        {/* Tab Content */}
        <div style={styles.tabContent}>
          {activeTab === 'skills' && (
            <div style={styles.skillsGrid}>
              {/* Radar Chart Card */}
              <div style={styles.card}>
                <h4 style={styles.cardTitle}>Student Competency Radar</h4>
                <p style={styles.cardSub}>Multidimensional phonetic & cognitive assessment</p>
                <div style={{ width: '100%', height: 260 }}>
                  <ResponsiveContainer>
                    <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                      <PolarGrid stroke="#E2ECE6" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: '#334155', fontSize: 11 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#64748B" />
                      <Radar
                        name={student.name}
                        dataKey="score"
                        stroke="var(--color-deep-forest)"
                        fill="var(--color-mint-teal)"
                        fillOpacity={0.5}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Progress Line Chart Card */}
              <div style={styles.card}>
                <h4 style={styles.cardTitle}>Historical Fluency & Accuracy</h4>
                <p style={styles.cardSub}>Progress across consecutive tablet reading attempts</p>
                <div style={{ width: '100%', height: 260 }}>
                  <ResponsiveContainer>
                    <LineChart data={historyData} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2ECE6" vertical={false} />
                      <XAxis dataKey="session" stroke="#64748B" fontSize={11} tickLine={false} />
                      <YAxis domain={[40, 100]} stroke="#64748B" fontSize={11} tickLine={false} />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="accuracy"
                        name="Accuracy %"
                        stroke="var(--color-deep-forest)"
                        strokeWidth={3}
                        dot={{ r: 4, fill: 'var(--color-deep-forest)' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="wpm"
                        name="WPM"
                        stroke="var(--color-mint-teal)"
                        strokeWidth={2}
                        strokeDasharray="4 4"
                        dot={{ r: 3, fill: 'var(--color-mint-teal)' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'reading' && (
            <div style={styles.listContainer}>
              {student.recentReadingAttempts.length === 0 ? (
                <div style={styles.emptyState}>No reading attempts recorded yet.</div>
              ) : (
                student.recentReadingAttempts.map((attempt) => (
                  <div key={attempt.id} style={styles.attemptCard}>
                    <div style={styles.attemptTop}>
                      <div>
                        <div style={styles.attemptTitleRow}>
                          <BookOpen size={16} color="var(--color-deep-forest)" />
                          <h4 style={styles.attemptTitle}>{attempt.passageTitle}</h4>
                          <span className="badge badge-forest">{attempt.language}</span>
                          <span className="badge badge-teal">{attempt.level}</span>
                        </div>
                        <span style={styles.dateSub}>Assessed on {attempt.date} • {attempt.durationSeconds}s duration</span>
                      </div>
                      <div style={styles.scoresWrap}>
                        <div style={styles.bigScore}>
                          <span style={styles.scoreVal}>{attempt.accuracy}%</span>
                          <span style={styles.scoreLbl}>Accuracy</span>
                        </div>
                        <div style={styles.bigScore}>
                          <span style={styles.scoreVal}>{attempt.wpm}</span>
                          <span style={styles.scoreLbl}>WPM</span>
                        </div>
                      </div>
                    </div>

                    {/* Audio Playback Simulation Banner */}
                    <div style={styles.audioPlayer}>
                      <button
                        onClick={() => setIsPlayingAudio(!isPlayingAudio)}
                        style={styles.playButton}
                      >
                        {isPlayingAudio ? <Volume2 size={16} /> : <Play size={16} />}
                        <span>{isPlayingAudio ? 'Pause Audio' : 'Play Student Audio'}</span>
                      </button>
                      <div style={styles.waveform}>
                        <div style={{ ...styles.waveformBar, height: '40%' }} />
                        <div style={{ ...styles.waveformBar, height: '80%' }} />
                        <div style={{ ...styles.waveformBar, height: '60%' }} />
                        <div style={{ ...styles.waveformBar, height: '90%' }} />
                        <div style={{ ...styles.waveformBar, height: '50%' }} />
                        <div style={{ ...styles.waveformBar, height: '70%' }} />
                        <div style={{ ...styles.waveformBar, height: '100%' }} />
                        <div style={{ ...styles.waveformBar, height: '45%' }} />
                      </div>
                      <span style={styles.audioDuration}>0:48 / 0:48 (16 kHz mono WAV)</span>
                    </div>

                    {/* Error Analysis Tags */}
                    {attempt.errors.length > 0 && (
                      <div style={styles.errorSection}>
                        <span style={styles.errorSectionTitle}>Detected Word Misalignments:</span>
                        <div style={styles.errorTags}>
                          {attempt.errors.map((err, i) => (
                            <span
                              key={i}
                              style={{
                                ...styles.errTag,
                                backgroundColor: err.type === 'omission' ? '#FEE2E2' : '#FEF3C7',
                                color: err.type === 'omission' ? '#991B1B' : '#92400E',
                                borderColor: err.type === 'omission' ? '#FCA5A5' : '#FDE68A',
                              }}
                            >
                              <strong>{err.word}</strong>: {err.type}
                              {err.spoken ? ` (said: "${err.spoken}")` : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* AI Feedback */}
                    <div style={styles.aiBox}>
                      <div style={styles.aiHeader}>
                        <Sparkles size={14} color="#059669" />
                        <span style={styles.aiLabel}>Pedagogical Feedback</span>
                      </div>
                      <p style={styles.aiText}>{attempt.aiQualitativeFeedback}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'writing' && (
            <div style={styles.listContainer}>
              {student.recentWritingAttempts.length === 0 ? (
                <div style={styles.emptyState}>No writing submissions recorded yet.</div>
              ) : (
                student.recentWritingAttempts.map((attempt) => (
                  <div key={attempt.id} style={styles.attemptCard}>
                    <div style={styles.attemptTop}>
                      <div>
                        <div style={styles.attemptTitleRow}>
                          <PenTool size={16} color="var(--color-deep-forest)" />
                          <h4 style={styles.attemptTitle}>{attempt.promptTitle}</h4>
                          <span className="badge badge-forest">{attempt.language}</span>
                          <span className="badge badge-teal">
                            {attempt.mode === 'handwritten_photo' ? 'Photo OCR' : 'Typed'}
                          </span>
                        </div>
                        <span style={styles.dateSub}>Submitted {attempt.date} • {attempt.wordCount} words</span>
                      </div>
                      <div style={styles.scoresWrap}>
                        <div style={styles.bigScore}>
                          <span style={styles.scoreVal}>{attempt.grammarScore}/100</span>
                          <span style={styles.scoreLbl}>Grammar</span>
                        </div>
                      </div>
                    </div>

                    {/* OCR Side-by-side comparison if handwritten */}
                    {attempt.mode === 'handwritten_photo' && attempt.rawOcrText && (
                      <div style={styles.ocrComparison}>
                        <div style={styles.ocrCol}>
                          <span style={styles.ocrHeader}>Raw OCR Digitized Text:</span>
                          <p style={styles.ocrContent}>{attempt.rawOcrText}</p>
                        </div>
                        <div style={styles.ocrCol}>
                          <span style={styles.ocrHeader}>Student Final Corrected Text:</span>
                          <p style={styles.ocrContent}>{attempt.studentCorrectedText}</p>
                        </div>
                      </div>
                    )}

                    {/* AI Feedback */}
                    <div style={styles.aiBox}>
                      <div style={styles.aiHeader}>
                        <Sparkles size={14} color="#059669" />
                        <span style={styles.aiLabel}>Writing & Structure Evaluation</span>
                      </div>
                      <p style={styles.aiText}>{attempt.aiFeedback}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'notes' && (
            <div style={styles.notesSection}>
              <form onSubmit={handlePostComment} style={styles.noteForm}>
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder={`Write intervention notes, praise or guidance for ${student.name}...`}
                  rows={3}
                  style={styles.noteInput}
                  required
                />
                <button type="submit" style={styles.postBtn}>
                  <Send size={15} />
                  <span>Log Teacher Note</span>
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(11, 61, 46, 0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    backdropFilter: 'blur(3px)',
  },
  modal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 'var(--radius-xl)',
    width: '92%',
    maxWidth: '820px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: 'var(--shadow-lg)',
    overflow: 'hidden',
  },
  header: {
    padding: '1.25rem 1.75rem',
    borderBottom: '1px solid var(--color-slate-200)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  avatarBig: {
    width: '46px',
    height: '46px',
    borderRadius: '50%',
    backgroundColor: 'var(--color-deep-forest)',
    color: '#FFFFFF',
    fontWeight: 800,
    fontSize: '1rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
  },
  name: {
    fontSize: '1.25rem',
    fontWeight: 800,
    color: 'var(--color-deep-forest)',
  },
  subMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    fontSize: '0.78rem',
    color: 'var(--color-slate-500)',
    marginTop: '0.2rem',
  },
  code: {
    backgroundColor: 'var(--color-soft-cream)',
    padding: '0.1rem 0.35rem',
    borderRadius: '4px',
    fontFamily: 'monospace',
    color: 'var(--color-deep-forest)',
  },
  closeButton: {
    color: 'var(--color-slate-400)',
    padding: '0.4rem',
    borderRadius: '50%',
  },
  tabsRow: {
    display: 'flex',
    borderBottom: '1px solid var(--color-slate-200)',
    padding: '0 1.75rem',
    backgroundColor: 'var(--color-soft-cream)',
    gap: '0.5rem',
  },
  tabBtn: {
    padding: '0.85rem 1rem',
    fontSize: '0.84rem',
    fontWeight: 600,
    color: 'var(--color-slate-500)',
    borderBottom: '3px solid transparent',
  },
  tabBtnActive: {
    color: 'var(--color-deep-forest)',
    borderBottom: '3px solid var(--color-deep-forest)',
    backgroundColor: '#FFFFFF',
  },
  tabContent: {
    padding: '1.5rem 1.75rem',
    overflowY: 'auto',
    flex: 1,
  },
  skillsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1.25rem',
  },
  card: {
    backgroundColor: 'var(--color-soft-cream)',
    borderRadius: 'var(--radius-lg)',
    padding: '1rem',
    border: '1px solid var(--color-leaf-tint)',
  },
  cardTitle: {
    fontSize: '0.98rem',
    fontWeight: 700,
    color: 'var(--color-deep-forest)',
  },
  cardSub: {
    fontSize: '0.76rem',
    color: 'var(--color-slate-500)',
    marginBottom: '0.5rem',
  },
  listContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  attemptCard: {
    backgroundColor: '#FFFFFF',
    border: '1px solid var(--color-slate-200)',
    borderRadius: 'var(--radius-lg)',
    padding: '1.25rem',
    boxShadow: 'var(--shadow-sm)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  attemptTop: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  attemptTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '0.2rem',
  },
  attemptTitle: {
    fontSize: '1rem',
    fontWeight: 700,
    color: 'var(--color-deep-forest)',
  },
  dateSub: {
    fontSize: '0.74rem',
    color: 'var(--color-slate-500)',
  },
  scoresWrap: {
    display: 'flex',
    gap: '0.75rem',
  },
  bigScore: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  scoreVal: {
    fontSize: '1.2rem',
    fontWeight: 800,
    color: 'var(--color-deep-forest)',
  },
  scoreLbl: {
    fontSize: '0.65rem',
    textTransform: 'uppercase',
    color: 'var(--color-slate-500)',
  },
  audioPlayer: {
    backgroundColor: 'var(--color-light-green)',
    borderRadius: 'var(--radius-md)',
    padding: '0.65rem 0.85rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.85rem',
  },
  playButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    backgroundColor: 'var(--color-deep-forest)',
    color: '#FFFFFF',
    borderRadius: 'var(--radius-sm)',
    padding: '0.4rem 0.75rem',
    fontSize: '0.76rem',
    fontWeight: 600,
  },
  waveform: {
    display: 'flex',
    alignItems: 'center',
    gap: '3px',
    height: '24px',
    flex: 1,
  },
  waveformBar: {
    width: '4px',
    backgroundColor: 'var(--color-mint-teal)',
    borderRadius: '2px',
  },
  audioDuration: {
    fontSize: '0.7rem',
    color: 'var(--color-deep-forest)',
    fontWeight: 600,
  },
  errorSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
  },
  errorSectionTitle: {
    fontSize: '0.74rem',
    fontWeight: 700,
    color: 'var(--color-slate-600)',
  },
  errorTags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.45rem',
  },
  errTag: {
    fontSize: '0.74rem',
    padding: '0.2rem 0.5rem',
    borderRadius: '4px',
    border: '1px solid',
  },
  aiBox: {
    backgroundColor: '#F0FDF4',
    border: '1px solid #BBF7D0',
    borderRadius: 'var(--radius-md)',
    padding: '0.75rem 0.85rem',
  },
  aiHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    marginBottom: '0.25rem',
  },
  aiLabel: {
    fontSize: '0.72rem',
    fontWeight: 700,
    color: '#166534',
    textTransform: 'uppercase',
  },
  aiText: {
    fontSize: '0.82rem',
    color: '#14532D',
    lineHeight: 1.4,
  },
  ocrComparison: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.75rem',
    backgroundColor: 'var(--color-soft-cream)',
    borderRadius: 'var(--radius-md)',
    padding: '0.75rem',
    border: '1px solid var(--color-leaf-tint)',
  },
  ocrCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  ocrHeader: {
    fontSize: '0.7rem',
    fontWeight: 700,
    color: 'var(--color-slate-500)',
    textTransform: 'uppercase',
  },
  ocrContent: {
    fontSize: '0.82rem',
    color: 'var(--color-slate-800)',
    lineHeight: 1.35,
  },
  notesSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  noteForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.65rem',
  },
  noteInput: {
    width: '100%',
    boxSizing: 'border-box',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-slate-200)',
    padding: '0.75rem',
  },
  postBtn: {
    alignSelf: 'flex-end',
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    backgroundColor: 'var(--color-deep-forest)',
    color: '#FFFFFF',
    padding: '0.55rem 1.15rem',
    borderRadius: 'var(--radius-md)',
    fontWeight: 700,
    fontSize: '0.84rem',
  },
  emptyState: {
    textAlign: 'center',
    padding: '2.5rem',
    color: 'var(--color-slate-400)',
    fontStyle: 'italic',
  },
};
