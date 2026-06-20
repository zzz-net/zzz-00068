import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock,
  AlertTriangle,
  FileText,
  Bug,
  Calendar,
  Search,
  Filter,
  User,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Home,
  Settings,
  CalendarDays,
  LogOut,
  ChevronDown,
  ShieldAlert,
  ArrowLeft,
  CheckSquare,
  Users,
  Activity,
  FileWarning,
  Download,
  Upload,
  RotateCcw,
  FileJson,
  Eye,
  RefreshCw,
  Database,
  Archive,
  UserCheck,
  ClipboardCheck,
} from 'lucide-react';
import { useAppStore } from '@/store';
import { useToastStore } from '@/store/toast';
import { RoleGate } from '@/components/RoleGate';
import type { OperationType, AbnormalType } from '@/types';

const OPERATION_LABELS: Record<OperationType, { label: string; icon: any; color: string }> = {
  appointment_create: { label: '预约创建', icon: CalendarDays, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  appointment_cancel: { label: '预约取消', icon: XCircle, color: 'text-gray-600 bg-gray-50 border-gray-200' },
  patient_checkin: { label: '患者签到', icon: UserCheck, color: 'text-cyan-600 bg-cyan-50 border-cyan-200' },
  patient_checkin_query: { label: '签到查询', icon: Search, color: 'text-sky-600 bg-sky-50 border-sky-200' },
  triage_confirm: { label: '分诊确认', icon: ClipboardCheck, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  triage_reject: { label: '分诊退回', icon: XCircle, color: 'text-rose-600 bg-rose-50 border-rose-200' },
  triage_modify: { label: '分诊修改', icon: ClipboardCheck, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  triage_reassign: { label: '分诊改派', icon: RefreshCw, color: 'text-orange-600 bg-orange-50 border-orange-200' },
  triage_undo: { label: '分诊撤销', icon: RotateCcw, color: 'text-orange-700 bg-orange-50 border-orange-200' },
  triage_restore: { label: '分诊恢复', icon: CheckCircle2, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  admission_confirm: { label: '入床确认', icon: CheckSquare, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  discharge_normal: { label: '正常出床', icon: CheckCircle2, color: 'text-green-600 bg-green-50 border-green-200' },
  discharge_force: { label: '强制释放', icon: AlertCircle, color: 'text-orange-600 bg-orange-50 border-orange-200' },
  care_note_add: { label: '护理记录', icon: FileText, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
  bed_config_change: { label: '床位配置', icon: Settings, color: 'text-purple-600 bg-purple-50 border-purple-200' },
  role_config_change: { label: '角色配置', icon: Users, color: 'text-pink-600 bg-pink-50 border-pink-200' },
  campus_config_change: { label: '院区配置', icon: Home, color: 'text-violet-600 bg-violet-50 border-violet-200' },
  data_import: { label: '数据导入', icon: ArrowLeft, color: 'text-teal-600 bg-teal-50 border-teal-200' },
  data_export: { label: '数据导出', icon: FileText, color: 'text-cyan-600 bg-cyan-50 border-cyan-200' },
  backup_export: { label: '备份导出', icon: Download, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  backup_restore_preview: { label: '备份预检', icon: Eye, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
  backup_restore: { label: '备份恢复', icon: Upload, color: 'text-purple-600 bg-purple-50 border-purple-200' },
  backup_restore_rollback: { label: '恢复回滚', icon: RotateCcw, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  backup_auto_snapshot: { label: '自动快照', icon: Archive, color: 'text-teal-600 bg-teal-50 border-teal-200' },
  leave_request_create: { label: '请假申请', icon: CalendarDays, color: 'text-sky-600 bg-sky-50 border-sky-200' },
  leave_request_approve: { label: '请假批准', icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  leave_request_reject: { label: '请假驳回', icon: XCircle, color: 'text-rose-600 bg-rose-50 border-rose-200' },
  leave_request_withdraw: { label: '请假撤回', icon: RotateCcw, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  leave_depart_confirm: { label: '离院确认', icon: ArrowLeft, color: 'text-orange-600 bg-orange-50 border-orange-200' },
  leave_return_confirm: { label: '返院确认', icon: UserCheck, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  leave_config_change: { label: '请假规则配置', icon: Settings, color: 'text-purple-600 bg-purple-50 border-purple-200' },
};

const ABNORMAL_LABELS: Record<AbnormalType, { label: string; icon: any; color: string }> = {
  time_overlap: { label: '时段重叠', icon: Clock, color: 'text-red-700 bg-red-50 border-red-200' },
  discharge_before_admit: { label: '出床早于入床', icon: AlertTriangle, color: 'text-orange-700 bg-orange-50 border-orange-200' },
  force_release_denied: { label: '强制释放被拒', icon: ShieldAlert, color: 'text-rose-700 bg-rose-50 border-rose-200' },
  isolation_violation: { label: '隔离违规', icon: Bug, color: 'text-purple-700 bg-purple-50 border-purple-200' },
  data_conflict: { label: '数据冲突', icon: FileWarning, color: 'text-amber-700 bg-amber-50 border-amber-200' },
  duplicate_checkin: { label: '重复签到', icon: UserCheck, color: 'text-cyan-700 bg-cyan-50 border-cyan-200' },
  early_arrival: { label: '提前到院', icon: Clock, color: 'text-amber-700 bg-amber-50 border-amber-200' },
  late_arrival: { label: '迟到', icon: Clock, color: 'text-orange-700 bg-orange-50 border-orange-200' },
  bed_occupied_triage: { label: '分诊床位占用', icon: AlertCircle, color: 'text-rose-700 bg-rose-50 border-rose-200' },
  isolation_conflict_triage: { label: '分诊隔离冲突', icon: Bug, color: 'text-purple-700 bg-purple-50 border-purple-200' },
  triage_permission_denied: { label: '分诊权限不足', icon: ShieldAlert, color: 'text-rose-700 bg-rose-50 border-rose-200' },
  triage_undo_permission_denied: { label: '撤销权限不足', icon: ShieldAlert, color: 'text-rose-700 bg-rose-50 border-rose-200' },
  triage_reassign_permission_denied: { label: '改派权限不足', icon: ShieldAlert, color: 'text-rose-700 bg-rose-50 border-rose-200' },
  appointment_not_found: { label: '预约不存在', icon: Search, color: 'text-slate-700 bg-slate-50 border-slate-200' },
  patient_not_found: { label: '患者不存在', icon: User, color: 'text-slate-700 bg-slate-50 border-slate-200' },
  no_appointment_today: { label: '今日无预约', icon: Calendar, color: 'text-slate-700 bg-slate-50 border-slate-200' },
  department_conflict: { label: '科室冲突', icon: Activity, color: 'text-rose-700 bg-rose-50 border-rose-200' },
  backup_version_unknown: { label: '备份版本未知', icon: FileJson, color: 'text-red-700 bg-red-50 border-red-200' },
  backup_bed_number_conflict: { label: '床位编号冲突', icon: Database, color: 'text-red-700 bg-red-50 border-red-200' },
  backup_patient_duplicate_admission: { label: '患者重复在床', icon: Users, color: 'text-red-700 bg-red-50 border-red-200' },
  backup_missing_required_field: { label: '缺少必需字段', icon: AlertCircle, color: 'text-red-700 bg-red-50 border-red-200' },
  backup_permission_denied: { label: '无操作权限', icon: ShieldAlert, color: 'text-red-700 bg-red-50 border-red-200' },
  leave_duration_exceeded: { label: '请假超时长', icon: Clock, color: 'text-red-700 bg-red-50 border-red-200' },
  leave_night_forbidden: { label: '夜间禁出时段', icon: Clock, color: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
  leave_pending_orders: { label: '未完成医嘱', icon: FileWarning, color: 'text-amber-700 bg-amber-50 border-amber-200' },
  leave_time_overlap: { label: '请假时段重叠', icon: Clock, color: 'text-red-700 bg-red-50 border-red-200' },
  leave_patient_discharged: { label: '患者已出院', icon: XCircle, color: 'text-rose-700 bg-rose-50 border-rose-200' },
  leave_duplicate_return: { label: '重复销假', icon: AlertCircle, color: 'text-red-700 bg-red-50 border-red-200' },
  leave_return_overdue: { label: '返院超时', icon: AlertTriangle, color: 'text-orange-700 bg-orange-50 border-orange-200' },
  leave_permission_denied: { label: '请假越权', icon: ShieldAlert, color: 'text-rose-700 bg-rose-50 border-rose-200' },
  leave_status_invalid: { label: '请假状态错误', icon: AlertTriangle, color: 'text-amber-700 bg-amber-50 border-amber-200' },
};

function formatDateTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function History() {
  const navigate = useNavigate();
  const currentNurse = useAppStore((s) => s.currentNurse);
  const logout = useAppStore((s) => s.logout);
  const logs = useAppStore((s) => s.operationLogs);
  const abnormals = useAppStore((s) => s.abnormalRecords);
  const beds = useAppStore((s) => s.beds);
  const appointments = useAppStore((s) => s.appointments);
  const nurses = useAppStore((s) => s.nurses);
  const handleAbnormal = useAppStore((s) => s.handleAbnormal);
  const showToast = useToastStore((s) => s.showToast);

  const [activeTab, setActiveTab] = useState<'logs' | 'abnormals'>('logs');
  const [filterOperator, setFilterOperator] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterDateStart, setFilterDateStart] = useState<string>('');
  const [filterDateEnd, setFilterDateEnd] = useState<string>('');
  const [searchText, setSearchText] = useState<string>('');
  const [filterOpen, setFilterOpen] = useState(false);

  const bedMap = useMemo(() => Object.fromEntries(beds.map((b) => [b.id, b.bedNumber])), [beds]);
  const apptMap = useMemo(() => Object.fromEntries(appointments.map((a) => [a.id, `#${a.id.slice(-6)}`])), [appointments]);

  const filteredLogs = useMemo(() => {
    let arr = [...logs].sort((a, b) => b.timestamp - a.timestamp);
    if (filterOperator !== 'all') arr = arr.filter((l) => l.operatorId === filterOperator);
    if (filterType !== 'all') arr = arr.filter((l) => l.type === filterType);
    if (filterDateStart) {
      const startTs = new Date(filterDateStart + ' 00:00:00').getTime();
      arr = arr.filter((l) => l.timestamp >= startTs);
    }
    if (filterDateEnd) {
      const endTs = new Date(filterDateEnd + ' 23:59:59').getTime();
      arr = arr.filter((l) => l.timestamp <= endTs);
    }
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      arr = arr.filter(
        (l) =>
          l.operatorName.toLowerCase().includes(q) ||
          l.detail.toLowerCase().includes(q) ||
          (l.targetName || '').toLowerCase().includes(q)
      );
    }
    return arr;
  }, [logs, filterOperator, filterType, filterDateStart, filterDateEnd, searchText]);

  const filteredAbnormals = useMemo(() => {
    let arr = [...abnormals].sort((a, b) => b.createdAt - a.createdAt);
    if (filterOperator !== 'all') {
      const relatedLogIds = logs.filter((l) => l.operatorId === filterOperator).map((l) => l.id);
      arr = arr.filter((a) => relatedLogIds.includes(a.operationLogId));
    }
    if (filterType !== 'all') arr = arr.filter((a) => a.type === filterType);
    if (filterDateStart) {
      const startTs = new Date(filterDateStart + ' 00:00:00').getTime();
      arr = arr.filter((a) => a.createdAt >= startTs);
    }
    if (filterDateEnd) {
      const endTs = new Date(filterDateEnd + ' 23:59:59').getTime();
      arr = arr.filter((a) => a.createdAt <= endTs);
    }
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      arr = arr.filter((a) => a.description.toLowerCase().includes(q));
    }
    return arr;
  }, [abnormals, filterOperator, filterType, filterDateStart, filterDateEnd, searchText, logs]);

  const handleHandleAbnormal = (id: string) => {
    if (!currentNurse) return;
    handleAbnormal(id, currentNurse.id);
    showToast('异常已标记为处理', 'success');
  };

  return (
    <RoleGate allowed={['admin', 'senior']}>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100">
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm">
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/dashboard')}
                className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 text-white flex items-center justify-center shadow-md hover:shadow-lg transition-shadow"
              >
                <Home className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-indigo-500" />
                  历史记录
                </h1>
                <p className="text-xs text-slate-500 hidden sm:block">操作日志 & 异常管理</p>
              </div>
            </div>
            <nav className="hidden md:flex items-center gap-1">
              <button onClick={() => navigate('/dashboard')} className="px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">床位看板</button>
              <button onClick={() => navigate('/appointments')} className="px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">预约管理</button>
              {(currentNurse?.role === 'admin') && (
                <button onClick={() => navigate('/config')} className="px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">系统配置</button>
              )}
              <button className="px-3 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg">历史记录</button>
            </nav>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-white flex items-center justify-center text-xs font-bold">
                  {currentNurse?.name.charAt(0) || '?'}
                </div>
                <div className="hidden sm:block">
                  <div className="text-xs font-semibold text-slate-700">{currentNurse?.name}</div>
                  <div className="text-[10px] text-slate-500">
                    {currentNurse?.role === 'admin' ? '管理员' : currentNurse?.role === 'senior' ? '高级护士' : '护士'}
                  </div>
                </div>
              </div>
              <button
                onClick={() => { logout(); navigate('/login'); }}
                className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="退出登录"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col lg:flex-row gap-4 lg:items-center justify-between mb-6">
            <div className="flex gap-2 p-1 bg-white rounded-xl border border-slate-200 shadow-sm w-fit">
              <button
                onClick={() => setActiveTab('logs')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                  activeTab === 'logs' ? 'bg-indigo-500 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <FileText className="w-4 h-4" />
                操作日志
                <span className={`text-xs px-2 py-0.5 rounded-full ${activeTab === 'logs' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  {filteredLogs.length}
                </span>
              </button>
              <button
                onClick={() => setActiveTab('abnormals')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                  activeTab === 'abnormals' ? 'bg-rose-500 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <AlertTriangle className="w-4 h-4" />
                异常记录
                <span className={`text-xs px-2 py-0.5 rounded-full ${activeTab === 'abnormals' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  {filteredAbnormals.length}
                </span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder={activeTab === 'logs' ? '搜索操作人/详情/目标...' : '搜索描述...'}
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow"
                />
              </div>
              <button
                onClick={() => setFilterOpen(!filterOpen)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors flex items-center gap-2 ${
                  filterOpen ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Filter className="w-4 h-4" />
                筛选
                <ChevronDown className={`w-3 h-3 transition-transform ${filterOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>

          {filterOpen && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">操作人</label>
                  <select
                    value={filterOperator}
                    onChange={(e) => setFilterOperator(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  >
                    <option value="all">全部操作人</option>
                    {nurses.map((n) => (
                      <option key={n.id} value={n.id}>{n.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    {activeTab === 'logs' ? '操作类型' : '异常类型'}
                  </label>
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  >
                    <option value="all">全部类型</option>
                    {activeTab === 'logs'
                      ? (Object.keys(OPERATION_LABELS) as OperationType[]).map((t) => (
                          <option key={t} value={t}>{OPERATION_LABELS[t].label}</option>
                        ))
                      : (Object.keys(ABNORMAL_LABELS) as AbnormalType[]).map((t) => (
                          <option key={t} value={t}>{ABNORMAL_LABELS[t].label}</option>
                        ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">开始日期</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="date"
                      value={filterDateStart}
                      onChange={(e) => setFilterDateStart(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">结束日期</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="date"
                      value={filterDateEnd}
                      onChange={(e) => setFilterDateEnd(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    />
                  </div>
                </div>
              </div>
              {(filterOperator !== 'all' || filterType !== 'all' || filterDateStart || filterDateEnd || searchText) && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <button
                    onClick={() => {
                      setFilterOperator('all');
                      setFilterType('all');
                      setFilterDateStart('');
                      setFilterDateEnd('');
                      setSearchText('');
                    }}
                    className="text-sm text-slate-600 hover:text-indigo-600 font-medium"
                  >
                    清除全部筛选条件
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'logs' ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              {filteredLogs.length === 0 ? (
                <div className="py-20 text-center">
                  <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <div className="text-slate-500 font-medium">暂无操作日志</div>
                  <div className="text-sm text-slate-400 mt-1">系统操作将自动记录在此</div>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredLogs.map((log) => {
                    const meta = OPERATION_LABELS[log.type];
                    const IconComp = meta.icon;
                    return (
                      <div key={log.id} className="relative px-5 py-4 hover:bg-slate-50/50 transition-colors">
                        <div className="flex gap-4">
                          <div className="flex flex-col items-center">
                            <div
                              className={`relative z-10 w-11 h-11 rounded-xl flex items-center justify-center border-2 shadow-sm ${
                                log.isAbnormal
                                  ? 'bg-red-50 border-red-300 text-red-600 ring-4 ring-red-100'
                                  : meta.color
                              }`}
                            >
                              <IconComp className="w-5 h-5" />
                            </div>
                            {log.isAbnormal && (
                              <div className="absolute top-0 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center border-2 border-white">
                                <AlertTriangle className="w-2.5 h-2.5 text-white" />
                              </div>
                            )}
                            <div className={`mt-1 w-0.5 flex-1 ${log.isAbnormal ? 'bg-red-200' : 'bg-slate-200'}`} />
                          </div>
                          <div className="flex-1 min-w-0 pb-2">
                            <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold border ${meta.color}`}>
                                  {meta.label}
                                </span>
                                {log.isAbnormal && (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-red-100 text-red-700 border border-red-200">
                                    <AlertTriangle className="w-3 h-3 mr-1" />异常
                                  </span>
                                )}
                                {log.targetName && (
                                  <span className="text-sm font-medium text-slate-700">
                                    <span className="text-slate-400 mr-1">·</span>
                                    {log.targetName}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 text-xs text-slate-500 flex-shrink-0">
                                <Clock className="w-3 h-3" />
                                {formatDateTime(log.timestamp)}
                              </div>
                            </div>
                            <p className="text-sm text-slate-600 leading-relaxed mb-2">{log.detail}</p>
                            {log.abnormalReason && (
                              <div className="inline-flex items-start gap-1.5 px-3 py-1.5 bg-red-50 border border-red-100 rounded-lg text-xs text-red-700 max-w-full">
                                <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                                <span>{log.abnormalReason}</span>
                              </div>
                            )}
                            <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                              <span className="inline-flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {log.operatorName}
                              </span>
                              {log.approvedBy && (
                                <span className="inline-flex items-center gap-1 text-emerald-600">
                                  <CheckCircle2 className="w-3 h-3" />
                                  审批人: {nurses.find((n) => n.id === log.approvedBy)?.name || log.approvedBy}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              {filteredAbnormals.length === 0 ? (
                <div className="py-20 text-center">
                  <CheckCircle2 className="w-16 h-16 text-emerald-300 mx-auto mb-4" />
                  <div className="text-slate-500 font-medium">暂无异常记录</div>
                  <div className="text-sm text-slate-400 mt-1">所有操作均正常执行 ✓</div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gradient-to-r from-slate-50 to-gray-50 border-b border-slate-200">
                      <tr>
                        <th className="text-left px-5 py-3.5 font-semibold text-slate-700">类型</th>
                        <th className="text-left px-5 py-3.5 font-semibold text-slate-700">描述</th>
                        <th className="text-left px-5 py-3.5 font-semibold text-slate-700">关联</th>
                        <th className="text-left px-5 py-3.5 font-semibold text-slate-700">时间</th>
                        <th className="text-left px-5 py-3.5 font-semibold text-slate-700">处理状态</th>
                        <th className="text-right px-5 py-3.5 font-semibold text-slate-700">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredAbnormals.map((ab) => {
                        const meta = ABNORMAL_LABELS[ab.type];
                        const IconComp = meta.icon;
                        const handlerNurse = ab.handledBy ? nurses.find((n) => n.id === ab.handledBy) : null;
                        return (
                          <tr key={ab.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-5 py-4">
                              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border ${meta.color}`}>
                                <IconComp className="w-3.5 h-3.5" />
                                {meta.label}
                              </span>
                            </td>
                            <td className="px-5 py-4 max-w-md">
                              <div className="text-slate-700 leading-relaxed">{ab.description}</div>
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex flex-wrap gap-1.5">
                                {ab.bedId && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-md text-xs font-medium">
                                    🛏️ {bedMap[ab.bedId] || ab.bedId}
                                  </span>
                                )}
                                {ab.appointmentId && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-md text-xs font-medium">
                                    📅 {apptMap[ab.appointmentId] || ab.appointmentId.slice(-8)}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-5 py-4 whitespace-nowrap text-slate-500 text-xs">
                              <div>{formatDate(ab.createdAt)}</div>
                              <div className="text-[11px] text-slate-400">{formatDateTime(ab.createdAt).split(' ')[1]}</div>
                            </td>
                            <td className="px-5 py-4">
                              {ab.handled ? (
                                <div className="flex flex-col">
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-xs font-semibold w-fit">
                                    <CheckCircle2 className="w-3 h-3" />
                                    已处理
                                  </span>
                                  {handlerNurse && ab.handledAt && (
                                    <span className="text-[11px] text-slate-400 mt-1">
                                      {handlerNurse.name} · {formatDate(ab.handledAt)}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-700 border border-red-200 rounded-md text-xs font-semibold">
                                  <AlertCircle className="w-3 h-3" />
                                  未处理
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-4 text-right">
                              {!ab.handled ? (
                                <button
                                  onClick={() => handleHandleAbnormal(ab.id)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm hover:shadow"
                                >
                                  <CheckSquare className="w-3.5 h-3.5" />
                                  标记已处理
                                </button>
                              ) : (
                                <span className="text-xs text-slate-400">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </RoleGate>
  );
}
