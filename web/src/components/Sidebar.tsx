import React from 'react';
import {
  LayoutDashboard,
  AlertTriangle,
  Users,
  BookOpen,
  PenTool,
  FileText,
  MessageSquare,
  Download,
  School,
  ChevronRight,
  LogOut,
} from 'lucide-react';
import { Teacher, ClassGroup } from '../types';

export type NavTab =
  | 'overview'
  | 'at-risk'
  | 'students'
  | 'reading'
  | 'writing'
  | 'missed-words'
  | 'comments';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  teacher: Teacher;
  selectedClass: ClassGroup;
  onSelectClass: (c: ClassGroup) => void;
  atRiskCount: number;
  onOpenExport: () => void;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  teacher,
  selectedClass,
  onSelectClass,
  atRiskCount,
  onOpenExport,
}) => {
  const navItems = [
    { id: 'overview' as NavTab, label: 'Class Overview', icon: LayoutDashboard },
    {
      id: 'at-risk' as NavTab,
      label: 'At-Risk Watchlist',
      icon: AlertTriangle,
      badge: atRiskCount > 0 ? `${atRiskCount}` : undefined,
      badgeVariant: 'risk',
    },
    { id: 'students' as NavTab, label: 'Student Directory', icon: Users },
    { id: 'reading' as NavTab, label: 'Reading Assessments', icon: BookOpen },
    { id: 'writing' as NavTab, label: 'Writing Submissions', icon: PenTool },
    { id: 'missed-words' as NavTab, label: 'Missed Words & Phonetics', icon: FileText },
    { id: 'comments' as NavTab, label: 'Teacher Comments', icon: MessageSquare },
  ];

  return (
    <aside style={styles.sidebar}>
      {/* Brand Header */}
      <div style={styles.brandContainer}>
        <div style={styles.logoWrap}>
          <img src="/vgyan_logo.png" alt="VGyan Logo" style={styles.logoImg} />
        </div>
        <div>
          <h1 style={styles.brandTitle}>VGyan Portal</h1>
          <p style={styles.brandSubtitle}>Teacher & Class Analytics</p>
        </div>
      </div>

      {/* Class Switcher Dropdown Box */}
      <div style={styles.classSwitcherCard}>
        <div style={styles.classCardHeader}>
          <School size={15} color="var(--color-mint-teal)" />
          <span style={styles.classCardLabel}>Active Class</span>
        </div>
        <select
          value={selectedClass.id}
          onChange={(e) => {
            const found = teacher.assignedClasses.find((c) => c.id === e.target.value);
            if (found) onSelectClass(found);
          }}
          style={styles.classSelect}
          aria-label="Select Assigned Class"
        >
          {teacher.assignedClasses.map((cls) => (
            <option key={cls.id} value={cls.id}>
              {cls.name} ({cls.studentCount} Students)
            </option>
          ))}
        </select>
        <div style={styles.schoolTag}>{teacher.school}</div>
      </div>

      {/* Navigation List */}
      <nav style={styles.navList}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              style={{
                ...styles.navButton,
                ...(isActive ? styles.navButtonActive : {}),
              }}
            >
              <div style={styles.navButtonContent}>
                <Icon
                  size={18}
                  color={isActive ? 'var(--color-deep-forest)' : 'var(--color-slate-500)'}
                  style={styles.navIcon}
                />
                <span
                  style={{
                    ...styles.navLabel,
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? 'var(--color-deep-forest)' : 'var(--color-slate-700)',
                  }}
                >
                  {item.label}
                </span>
              </div>

              {item.badge && (
                <span
                  style={{
                    ...styles.navBadge,
                    backgroundColor:
                      item.badgeVariant === 'risk' ? '#DC2626' : 'var(--color-mint-teal)',
                  }}
                >
                  {item.badge}
                </span>
              )}

              {isActive && <div style={styles.activeIndicator} />}
            </button>
          );
        })}
      </nav>

      {/* Research Privacy & Export Action (SRS Page 7 & 9 compliant) */}
      <div style={styles.exportSection}>
        <button onClick={onOpenExport} style={styles.exportButton}>
          <Download size={16} color="var(--color-deep-forest)" />
          <span style={styles.exportLabel}>Anonymized Export</span>
        </button>
        <span style={styles.exportHelper}>Exports research data by Participant ID</span>
      </div>

      {/* Teacher Footer Info */}
      <div style={styles.footer}>
        <div style={styles.teacherAvatar}>
          {teacher.name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .slice(0, 2)}
        </div>
        <div style={styles.teacherDetails}>
          <div style={styles.teacherName}>{teacher.name}</div>
          <div style={styles.teacherEmail}>{teacher.email}</div>
        </div>
      </div>
    </aside>
  );
};

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    width: '280px',
    minWidth: '280px',
    backgroundColor: '#FFFFFF',
    borderRight: '1px solid var(--color-slate-200)',
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    position: 'sticky',
    top: 0,
    zIndex: 20,
    boxShadow: 'var(--shadow-sm)',
  },
  brandContainer: {
    padding: '1.25rem 1.5rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.85rem',
    borderBottom: '1px solid var(--color-slate-200)',
  },
  logoWrap: {
    width: '42px',
    height: '42px',
    borderRadius: '12px',
    backgroundColor: 'var(--color-light-green)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4px',
  },
  logoImg: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  brandTitle: {
    fontSize: '1.2rem',
    fontWeight: 800,
    color: 'var(--color-deep-forest)',
    lineHeight: 1.15,
  },
  brandSubtitle: {
    fontSize: '0.78rem',
    color: 'var(--color-slate-500)',
    fontWeight: 500,
  },
  classSwitcherCard: {
    margin: '1.2rem 1.2rem 0.5rem 1.2rem',
    padding: '0.85rem',
    backgroundColor: 'var(--color-soft-cream)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-leaf-tint)',
  },
  classCardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    marginBottom: '0.45rem',
  },
  classCardLabel: {
    fontSize: '0.72rem',
    fontWeight: 700,
    color: 'var(--color-deep-forest)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  classSelect: {
    width: '100%',
    fontWeight: 600,
    fontSize: '0.86rem',
    color: 'var(--color-deep-forest)',
    backgroundColor: '#FFFFFF',
    border: '1px solid var(--color-leaf-tint)',
    borderRadius: 'var(--radius-sm)',
    padding: '0.45rem 0.6rem',
    cursor: 'pointer',
  },
  schoolTag: {
    marginTop: '0.35rem',
    fontSize: '0.7rem',
    color: 'var(--color-slate-500)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  navList: {
    flex: 1,
    padding: '0.75rem 0.85rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
    overflowY: 'auto',
  },
  navButton: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: '0.7rem 0.85rem',
    borderRadius: 'var(--radius-md)',
    transition: 'all 0.15s ease',
    textAlign: 'left',
  },
  navButtonActive: {
    backgroundColor: 'var(--color-light-green)',
  },
  navButtonContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  navIcon: {
    flexShrink: 0,
  },
  navLabel: {
    fontSize: '0.88rem',
  },
  navBadge: {
    color: '#FFFFFF',
    fontSize: '0.72rem',
    fontWeight: 700,
    padding: '0.12rem 0.5rem',
    borderRadius: 'var(--radius-full)',
  },
  activeIndicator: {
    position: 'absolute',
    left: 0,
    top: '20%',
    bottom: '20%',
    width: '4px',
    backgroundColor: 'var(--color-deep-forest)',
    borderTopRightRadius: '4px',
    borderBottomRightRadius: '4px',
  },
  exportSection: {
    padding: '0.85rem 1.2rem',
    borderTop: '1px solid var(--color-slate-200)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
  },
  exportButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    backgroundColor: 'var(--color-leaf-tint)',
    color: 'var(--color-deep-forest)',
    padding: '0.6rem 0.85rem',
    borderRadius: 'var(--radius-md)',
    fontWeight: 600,
    fontSize: '0.84rem',
    border: '1px solid #C4D9BC',
  },
  exportLabel: {
    fontSize: '0.82rem',
  },
  exportHelper: {
    fontSize: '0.68rem',
    color: 'var(--color-slate-500)',
    textAlign: 'center',
  },
  footer: {
    padding: '1rem 1.2rem',
    borderTop: '1px solid var(--color-slate-200)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    backgroundColor: 'var(--color-soft-cream)',
  },
  teacherAvatar: {
    width: '38px',
    height: '38px',
    borderRadius: '50%',
    backgroundColor: 'var(--color-deep-forest)',
    color: '#FFFFFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: '0.85rem',
    flexShrink: 0,
  },
  teacherDetails: {
    overflow: 'hidden',
  },
  teacherName: {
    fontSize: '0.84rem',
    fontWeight: 700,
    color: 'var(--color-deep-forest)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  teacherEmail: {
    fontSize: '0.72rem',
    color: 'var(--color-slate-500)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
};
