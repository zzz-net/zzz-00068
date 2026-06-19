import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store';
import { useToastStore } from '@/store/toast';
import StatusBadge from '@/components/StatusBadge';
import type { AppointmentStatus, NurseRole } from '@/types';
import {
  Search,
  Plus,
  CalendarDays,
  Filter,
  ArrowRight,
  Eye,
  XCircle,
  CheckCircle2,
  ClipboardList,
  LayoutGrid,
  Settings,
  History,
  LogOut,
  User,
  ChevronDown,
} from 'lucide-react';
import { cn, getTodayStr, addDaysStr } from '@/lib/utils';

type StatusFilter = 'all' | AppointmentStatus;

export default function Appointments() {
  const navigate = useNavigate();
  const {
    appointments,
    patients,
    beds,
    timeSlots,
    currentUser,
    logout,
    confirmAdmission,
    cancelAppointment,
  } = useAppStore();
  const { showToast } = useToastStore();

  const today = getTodayStr();
  const weekAgo = addDaysStr(today, -7);

  const [startDate, setStartDate] = useState(weekAgo);
  const [endDate, setEndDate] = useState(today);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null);

  const roleLabel: Record<NurseRole, string> = {
    admin: '管理员',
    senior: '高级护士',
    normal: '普通护士',
  };

  const getInitial = (name: string) => name?.charAt?.(0) ?? '?';

  const avatarColors = [
    'from-blue-400 to-blue-600',
    'from-emerald-400 to-emerald-600',
    'from-purple-400 to-purple-600',
    'from-pink-400 to-pink-600',
    'from-amber-400 to-amber-600',
  ];

  const filteredAppointments = useMemo(() => {
    return appointments
      .filter((a) => {
        if (startDate && a.appointmentDate < startDate) return false;
        if (endDate && a.appointmentDate > endDate) return false;
        if (statusFilter !== 'all' && a.status !== statusFilter) return false;
        if (searchQuery) {
          const patient = patients.find((p) => p.id === a.patientId);
          const bed = beds.find((b) => b.id === a.bedId);
          const query = searchQuery.toLowerCase();
          const matchName = patient?.name.toLowerCase().includes(query);
          const matchBed = bed?.bedNumber.toLowerCase().includes(query);
          if (!matchName && !matchBed) return false;
        }
        return true;
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [appointments, startDate, endDate, statusFilter, searchQuery, patients, beds]);

  const handleConfirmAdmission = (aptId: string) => {
    if (!currentUser) return;
    const res = confirmAdmission(aptId, currentUser.id);
    if (res.success) {
      showToast('入床确认成功', 'success');
    } else {
      showToast(res.error ?? '入床失败', 'error');
    }
  };

  const handleCancel = (aptId: string) => {
    const res = cancelAppointment(aptId);
    if (res.success) {
      showToast('预约已取消', 'success');
      setCancelConfirmId(null);
    } else {
      showToast(res.error ?? '取消失败', 'error');
    }
  };

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });

  const stats = useMemo(() => {
    return {
      pending: appointments.filter((a) => a.status === 'pending').length,
      admitted: appointments.filter((a) => a.status === 'admitted').length,
      completed: appointments.filter((a) => a.status === 'completed').length,
      cancelled: appointments.filter((a) => a.status === 'cancelled').length,
    };
  }, [appointments]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-30 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="text-2xl">🏥</div>
              <div>
                <h1 className="text-lg font-bold text-gray-800">日间病房周转板</h1>
                <p className="text-xs text-gray-500 hidden sm:block">智能床位管理系统</p>
              </div>
            </div>

            <nav className="hidden md:flex items-center gap-1">
              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-100 font-medium text-sm transition-colors"
              >
                <LayoutGrid className="w-4 h-4" />
                床位看板
              </button>
              <button
                onClick={() => navigate('/appointments')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-50 text-blue-600 font-medium text-sm"
              >
                <ClipboardList className="w-4 h-4" />
                预约管理
              </button>
              {(currentUser?.role === 'admin' || currentUser?.role === 'senior') && (
                <button
                  onClick={() => navigate('/history')}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-100 font-medium text-sm transition-colors"
                >
                  <History className="w-4 h-4" />
                  历史记录
                </button>
              )}
              {currentUser?.role === 'admin' && (
                <button
                  onClick={() => navigate('/config')}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-100 font-medium text-sm transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  系统配置
                </button>
              )}
            </nav>

            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-bold">
                  {getInitial(currentUser?.name ?? '')}
                </div>
                <div className="hidden sm:block">
                  <div className="text-xs font-medium text-gray-800">
                    {currentUser?.name}
                  </div>
                  <div className="text-[10px] text-gray-500">
                    {roleLabel[currentUser?.role ?? 'normal']}
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <MiniStatCard label="待入床" value={stats.pending} color="yellow" />
          <MiniStatCard label="已入床" value={stats.admitted} color="blue" />
          <MiniStatCard label="已完成" value={stats.completed} color="green" />
          <MiniStatCard label="已取消" value={stats.cancelled} color="gray" />
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 p-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-gray-400">至</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="appearance-none pl-3 pr-9 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="all">全部状态</option>
                <option value="pending">待入床</option>
                <option value="admitted">已入床</option>
                <option value="completed">已完成</option>
                <option value="cancelled">已取消</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>

            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索患者姓名/床号..."
                className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex-1" />

            <button
              onClick={() => navigate('/appointments/new')}
              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-medium text-sm hover:from-blue-700 hover:to-indigo-700 transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" />
              新建预约
            </button>
          </div>

          <div className="overflow-x-auto">
            {filteredAppointments.length === 0 ? (
              <div className="py-16 text-center">
                <Filter className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">暂无预约记录</p>
                <p className="text-sm text-gray-400 mt-1">点击右上角新建预约</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      预约ID
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      患者信息
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      床位
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      时段
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      日期
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      状态
                    </th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredAppointments.map((apt, idx) => {
                    const patient = patients.find((p) => p.id === apt.patientId);
                    const bed = beds.find((b) => b.id === apt.bedId);
                    const slot = timeSlots.find((s) => s.id === apt.slotId);
                    return (
                      <tr
                        key={apt.id}
                        className="hover:bg-gray-50/50 transition-colors"
                      >
                        <td className="px-5 py-4">
                          <span className="font-mono text-xs text-gray-500">
                            #{apt.id.slice(0, 8)}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                'w-9 h-9 rounded-full bg-gradient-to-br flex items-center justify-center text-white text-sm font-bold flex-shrink-0',
                                avatarColors[idx % avatarColors.length]
                              )}
                            >
                              {getInitial(patient?.name ?? '')}
                            </div>
                            <div>
                              <div className="font-medium text-gray-800">
                                {patient?.name ?? '未知'}
                              </div>
                              <div className="text-xs text-gray-500">
                                {patient?.gender === 'male' ? '男' : '女'} · {patient?.age}岁
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium">
                            {bed?.bedNumber ?? '-'}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="text-sm text-gray-700">
                            {slot?.label ?? '-'}
                          </div>
                          <div className="text-xs text-gray-500">
                            {formatTime(apt.startTime)} - {formatTime(apt.endTime)}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="text-sm text-gray-700">
                            {apt.appointmentDate}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <StatusBadge type="appointment" status={apt.status} />
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-end gap-2">
                            {apt.status === 'pending' && (
                              <button
                                onClick={() => handleConfirmAdmission(apt.id)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                确认入床
                              </button>
                            )}
                            {apt.status === 'admitted' && (
                              <button
                                onClick={() => navigate('/dashboard')}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-medium hover:bg-emerald-600 transition-colors"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                查看床位
                              </button>
                            )}
                            {apt.status === 'completed' && (
                              <button
                                onClick={() => {
                                  showToast('详情功能开发中', 'info');
                                }}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                详情
                              </button>
                            )}
                            {apt.status !== 'cancelled' && apt.status !== 'completed' && (
                              <>
                                {cancelConfirmId === apt.id ? (
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => handleCancel(apt.id)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 transition-colors"
                                    >
                                      确认取消
                                    </button>
                                    <button
                                      onClick={() => setCancelConfirmId(null)}
                                      className="inline-flex items-center px-2.5 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors"
                                    >
                                      不
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setCancelConfirmId(apt.id)}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-medium hover:bg-red-100 transition-colors"
                                  >
                                    <XCircle className="w-3.5 h-3.5" />
                                    取消预约
                                  </button>
                                )}
                              </>
                            )}
                            {apt.status === 'completed' && (
                              <ArrowRight className="w-4 h-4 text-gray-300" />
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

interface MiniStatCardProps {
  label: string;
  value: number;
  color: 'yellow' | 'blue' | 'green' | 'gray';
}

function MiniStatCard({ label, value, color }: MiniStatCardProps) {
  const classes = {
    yellow: 'bg-yellow-50 border-yellow-100 text-yellow-700',
    blue: 'bg-blue-50 border-blue-100 text-blue-700',
    green: 'bg-green-50 border-green-100 text-green-700',
    gray: 'bg-gray-50 border-gray-100 text-gray-600',
  };
  return (
    <div
      className={cn(
        'rounded-xl border p-4 transition-all hover:shadow-sm',
        classes[color]
      )}
    >
      <div className="text-xs font-medium opacity-75">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}
