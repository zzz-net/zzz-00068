import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarClock,
  ClipboardCheck,
  History,
  Settings,
  ChevronLeft,
  ChevronRight,
  Download,
  LogOut,
  Menu,
} from 'lucide-react';
import type { NurseRole } from '@/types';
import { useAppStore } from '@/store';
import { RoleGate } from '@/components/RoleGate';
import { showToast } from '@/components/Toast';
import { getTodayStr, addDaysStr } from '@/lib/utils';

interface LayoutProps {
  children: ReactNode;
}

interface NavItem {
  label: string;
  path: string;
  icon: JSX.Element;
  allowed?: NurseRole[];
}

const roleLabels: Record<NurseRole, string> = {
  admin: '管理员',
  senior: '高级护士',
  normal: '普通护士',
};

const roleColors: Record<NurseRole, string> = {
  admin: 'bg-rose-500/20 text-rose-300',
  senior: 'bg-amber-500/20 text-amber-300',
  normal: 'bg-blue-500/20 text-blue-300',
};

const routeTitleMap: Record<string, string> = {
  '/dashboard': '看板',
  '/appointments': '预约管理',
  '/triage': '签到与分诊',
  '/history': '历史记录',
  '/config': '系统配置',
};

function formatDate(d: Date): string {
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
}

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dateStrToDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = useAppStore((s) => s.currentUser);
  const logout = useAppStore((s) => s.logout);
  const exportDailyReport = useAppStore((s) => s.exportDailyReport);

  const [viewDateStr, setViewDateStr] = useState<string>(getTodayStr());
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!currentUser) {
      navigate('/login', { replace: true });
    }
  }, [currentUser, navigate]);

  useEffect(() => {
    if (!userMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [userMenuOpen]);

  const navItems: NavItem[] = useMemo(
    () => [
      {
        label: '看板',
        path: '/dashboard',
        icon: <LayoutDashboard className="w-5 h-5" />,
      },
      {
        label: '预约',
        path: '/appointments',
        icon: <CalendarClock className="w-5 h-5" />,
      },
      {
        label: '分诊',
        path: '/triage',
        icon: <ClipboardCheck className="w-5 h-5" />,
      },
      {
        label: '历史',
        path: '/history',
        icon: <History className="w-5 h-5" />,
        allowed: ['admin', 'senior'],
      },
      {
        label: '配置',
        path: '/config',
        icon: <Settings className="w-5 h-5" />,
        allowed: ['admin'],
      },
    ],
    [],
  );

  const pageTitle = useMemo(() => {
    return routeTitleMap[location.pathname] ?? '日间病房周转板';
  }, [location.pathname]);

  const handlePrevDay = () => {
    setViewDateStr(addDaysStr(viewDateStr, -1));
  };

  const handleNextDay = () => {
    setViewDateStr(addDaysStr(viewDateStr, 1));
  };

  const handleToday = () => {
    setViewDateStr(getTodayStr());
  };

  const handleExport = () => {
    try {
      const dateStr = viewDateStr;
      const csv = exportDailyReport(dateStr);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `daily-report-${dateStr}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('success', `已导出 daily-report-${dateStr}.csv`);
    } catch (e) {
      showToast('error', '导出失败');
    }
  };

  const handleLogout = () => {
    setUserMenuOpen(false);
    logout();
    navigate('/login', { replace: true });
  };

  if (!currentUser) return null;

  const isToday = viewDateStr === getTodayStr();
  const viewDate = dateStrToDate(viewDateStr);

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed left-0 top-0 z-40 w-60 h-screen bg-slate-900 text-slate-200 flex flex-col">
        <div className="mt-6 mb-8 px-4 text-center">
          <div className="text-white text-lg font-bold tracking-wide">
            🏥 日间病房周转板
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {navItems.map((item) => (
            <RoleGate
              key={item.path}
              allowed={item.allowed ?? ['admin', 'senior', 'normal']}
              fallback={null}
            >
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-white/10 text-white shadow-inner'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`
                }
              >
                {item.icon}
                {item.label}
              </NavLink>
            </RoleGate>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              {currentUser.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                {currentUser.name}
              </p>
              <span
                className={`inline-block mt-0.5 text-[11px] px-2 py-0.5 rounded-full font-medium ${roleColors[currentUser.role]}`}
              >
                {roleLabels[currentUser.role]}
              </span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 border border-slate-700/50 transition-all"
          >
            <LogOut className="w-4 h-4" />
            退出登录
          </button>
        </div>
      </aside>

      <header className="fixed left-60 top-0 z-30 h-16 w-[calc(100%-15rem)] bg-white border-b border-slate-200 flex items-center px-6 gap-4">
        <button className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-slate-100 text-slate-500">
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm text-slate-400">当前页面</span>
          <span className="text-slate-600">/</span>
          <span className="font-semibold text-slate-800 truncate">{pageTitle}</span>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-1 bg-slate-50 rounded-lg p-1 border border-slate-200">
          <button
            onClick={handlePrevDay}
            className="p-1.5 rounded-md text-slate-500 hover:bg-white hover:text-slate-700 hover:shadow-sm transition-all"
            title="前一天"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={handleToday}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
              isToday
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 hover:bg-white/60'
            }`}
          >
            今日
          </button>
          <button
            onClick={handleNextDay}
            className="p-1.5 rounded-md text-slate-500 hover:bg-white hover:text-slate-700 hover:shadow-sm transition-all"
            title="后一天"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <div className="w-px h-5 bg-slate-200 mx-1" />
          <span className="px-3 py-1.5 text-sm text-slate-700 whitespace-nowrap">
            {formatDate(viewDate)}
          </span>
        </div>

        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors"
        >
          <Download className="w-4 h-4" />
          导出
        </button>

        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setUserMenuOpen((v) => !v)}
            className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
              {currentUser.name.charAt(0)}
            </div>
            <span className="text-sm font-medium text-slate-700 hidden md:inline">
              {currentUser.name}
            </span>
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 overflow-hidden z-50 animate-[fadeIn_0.12s_ease-out]">
              <div className="px-4 py-2.5 border-b border-slate-100">
                <p className="text-sm font-semibold text-slate-800 truncate">
                  {currentUser.name}
                </p>
                <span
                  className={`inline-block mt-1 text-[11px] px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-600`}
                >
                  {roleLabels[currentUser.role]}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <LogOut className="w-4 h-4 text-slate-500" />
                退出登录
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="ml-60 mt-16 p-6 min-h-screen bg-slate-50">
        <div className="max-w-screen-2xl mx-auto">
          {children && typeof children === 'object' && 'type' in children
            ? {
                ...children,
                props: { ...children.props, viewDateStr },
              }
            : children}
        </div>
      </main>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

export default Layout;
