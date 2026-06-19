import { useState, useMemo } from 'react';
import { useAppStore } from '@/store';
import { useToastStore } from '@/store/toast';
import { RoleGate } from '@/components/RoleGate';
import { ConfirmModal } from '@/components/ConfirmModal';
import type { CheckIn, CheckInStatus, NurseRole } from '@/types';
import {
  UserCheck,
  ClipboardCheck,
  Search,
  Phone,
  CalendarClock,
  ShieldAlert,
  BedDouble,
  CheckCircle2,
  XCircle,
  RefreshCw,
  AlertTriangle,
  Clock,
  Edit3,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const checkInStatusLabel: Record<CheckInStatus, string> = {
  checked_in: '已签到',
  triaging: '分诊中',
  triage_confirmed: '已入床',
  triage_rejected: '已退回',
};

const checkInStatusColor: Record<CheckInStatus, string> = {
  checked_in: 'bg-indigo-100 text-indigo-700',
  triaging: 'bg-amber-100 text-amber-700',
  triage_confirmed: 'bg-emerald-100 text-emerald-700',
  triage_rejected: 'bg-rose-100 text-rose-600',
};

const arrivalFlagLabel: Record<string, string> = {
  on_time: '准时',
  early: '提前到院',
  late: '迟到',
};

const arrivalFlagColor: Record<string, string> = {
  on_time: 'bg-emerald-50 text-emerald-600',
  early: 'bg-amber-50 text-amber-600',
  late: 'bg-rose-50 text-rose-600',
};

export default function TriageQueue() {
  const {
    checkIns,
    appointments,
    patients,
    beds,
    timeSlots,
    isolationRules,
    nurses,
    currentUser,
    checkInByPhone,
    checkInByAppointment,
    confirmTriage,
    rejectTriage,
    modifyTriage,
  } = useAppStore();
  const { showToast } = useToastStore();

  const [phoneInput, setPhoneInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | CheckInStatus>('all');

  const [confirmTarget, setConfirmTarget] = useState<CheckIn | null>(null);
  const [rejectTarget, setRejectTarget] = useState<CheckIn | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [modifyTarget, setModifyTarget] = useState<CheckIn | null>(null);
  const [modifyNote, setModifyNote] = useState('');
  const [overrideBedId, setOverrideBedId] = useState<string>('');

  const triageQueue = useMemo(() => {
    return checkIns
      .filter((c) => {
        if (statusFilter !== 'all' && c.status !== statusFilter) return false;
        if (searchQuery) {
          const patient = patients.find((p) => p.id === c.patientId);
          const apt = appointments.find((a) => a.id === c.appointmentId);
          const bed = apt ? beds.find((b) => b.id === apt.bedId) : null;
          const q = searchQuery.toLowerCase();
          const matchName = patient?.name.toLowerCase().includes(q);
          const matchPhone = c.phone?.includes(q);
          const matchBed = bed?.bedNumber.toLowerCase().includes(q);
          if (!matchName && !matchPhone && !matchBed) return false;
        }
        return true;
      })
      .sort((a, b) => b.checkInTime - a.checkInTime);
  }, [checkIns, statusFilter, searchQuery, patients, appointments, beds]);

  const pendingCount = useMemo(
    () => checkIns.filter((c) => c.status === 'checked_in' || c.status === 'triaging').length,
    [checkIns],
  );

  const handleCheckInByPhone = () => {
    if (!phoneInput.trim()) {
      showToast('请输入手机号', 'error');
      return;
    }
    const res = checkInByPhone(phoneInput.trim());
    if (res.success) {
      showToast('签到成功，已加入待分诊队列', 'success');
      setPhoneInput('');
    } else {
      showToast(res.error ?? '签到失败', 'error');
    }
  };

  const handleCheckInByAppointment = (appointmentId: string) => {
    const res = checkInByAppointment(appointmentId);
    if (res.success) {
      showToast('签到成功，已加入待分诊队列', 'success');
    } else {
      showToast(res.error ?? '签到失败', 'error');
    }
  };

  const handleConfirmTriage = (checkIn: CheckIn) => {
    if (!currentUser) return;
    const res = confirmTriage(checkIn.id, currentUser.id, overrideBedId || undefined);
    if (res.success) {
      showToast('分诊确认成功，已入床', 'success');
      setConfirmTarget(null);
      setOverrideBedId('');
    } else {
      showToast(res.error ?? '分诊确认失败', 'error');
    }
  };

  const handleRejectTriage = (checkIn: CheckIn) => {
    if (!currentUser) return;
    if (!rejectReason.trim()) {
      showToast('请填写退回原因', 'error');
      return;
    }
    const res = rejectTriage(checkIn.id, currentUser.id, rejectReason.trim());
    if (res.success) {
      showToast('已退回处理', 'success');
      setRejectTarget(null);
      setRejectReason('');
    } else {
      showToast(res.error ?? '退回失败', 'error');
    }
  };

  const handleModifyTriage = (checkIn: CheckIn) => {
    if (!currentUser) return;
    const patch: Partial<Pick<CheckIn, 'triageNote'>> = {};
    if (modifyNote.trim()) patch.triageNote = modifyNote.trim();
    const res = modifyTriage(checkIn.id, currentUser.id, patch);
    if (res.success) {
      showToast('分诊信息已修改', 'success');
      setModifyTarget(null);
      setModifyNote('');
    } else {
      showToast(res.error ?? '修改失败', 'error');
    }
  };

  const pendingAppointments = useMemo(() => {
    return appointments.filter(
      (a) =>
        a.status === 'pending' &&
        a.appointmentDate === new Date().toISOString().slice(0, 10),
    );
  }, [appointments]);

  const getAvailableBeds = (checkIn: CheckIn) => {
    const apt = appointments.find((a) => a.id === checkIn.appointmentId);
    const ruleId = apt?.isolationRuleId;
    const rule = ruleId ? isolationRules.find((r) => r.id === ruleId) : undefined;
    return beds.filter((b) => {
      if (b.status !== 'idle') return false;
      if (rule && b.type !== rule.requiredBedType) return false;
      return true;
    });
  };

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

  const getPatient = (patientId: string) => patients.find((p) => p.id === patientId);
  const getApt = (appointmentId: string) => appointments.find((a) => a.id === appointmentId);
  const getBed = (bedId: string) => beds.find((b) => b.id === bedId);
  const getSlot = (slotId: string) => timeSlots.find((s) => s.id === slotId);
  const getNurse = (nurseId: string) => nurses.find((n) => n.id === nurseId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">签到与分诊</h1>
          <p className="text-sm text-slate-500 mt-1">患者到院签到 → 待分诊队列 → 确认入床或退回</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium">
            待分诊 {pendingCount} 人
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-indigo-500" />
              患者签到
            </h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">手机号签到</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="tel"
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value)}
                      placeholder="输入患者手机号"
                      className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      onKeyDown={(e) => e.key === 'Enter' && handleCheckInByPhone()}
                    />
                  </div>
                  <button
                    onClick={handleCheckInByPhone}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors whitespace-nowrap"
                  >
                    签到
                  </button>
                </div>
              </div>
              {pendingAppointments.length > 0 && (
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">按预约签到</label>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {pendingAppointments.map((apt) => {
                      const patient = getPatient(apt.patientId);
                      const bed = getBed(apt.bedId);
                      return (
                        <button
                          key={apt.id}
                          onClick={() => handleCheckInByAppointment(apt.id)}
                          className="w-full text-left px-3 py-2 rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-colors"
                        >
                          <div className="text-sm font-medium text-slate-700">
                            {patient?.name ?? '未知'}
                          </div>
                          <div className="text-xs text-slate-500">
                            {bed?.bedNumber ?? '-'} · {apt.appointmentDate}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex flex-wrap items-center gap-3 p-4 border-b border-slate-100">
              <div className="relative flex-1 min-w-[200px] max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索姓名/手机/床号..."
                  className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as 'all' | CheckInStatus)}
                  className="appearance-none pl-3 pr-9 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="all">全部状态</option>
                  <option value="checked_in">已签到</option>
                  <option value="triaging">分诊中</option>
                  <option value="triage_confirmed">已入床</option>
                  <option value="triage_rejected">已退回</option>
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {triageQueue.length === 0 ? (
              <div className="py-16 text-center">
                <ClipboardCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">暂无签到记录</p>
                <p className="text-sm text-slate-400 mt-1">患者签到后将在此显示</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {triageQueue.map((checkIn) => {
                  const patient = getPatient(checkIn.patientId);
                  const apt = getApt(checkIn.appointmentId);
                  const bed = apt ? getBed(apt.bedId) : null;
                  const slot = apt ? getSlot(apt.slotId) : null;
                  const rule = apt?.isolationRuleId
                    ? isolationRules.find((r) => r.id === apt.isolationRuleId)
                    : null;
                  const handler = checkIn.handledBy
                    ? getNurse(checkIn.handledBy)
                    : null;
                  const availableBeds = getAvailableBeds(checkIn);
                  const isActionable =
                    checkIn.status === 'checked_in' || checkIn.status === 'triaging';

                  return (
                    <div
                      key={checkIn.id}
                      className={cn(
                        'p-4 hover:bg-slate-50/50 transition-colors',
                        checkIn.status === 'triage_rejected' && 'opacity-60',
                      )}
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                          {patient?.name.charAt(0) ?? '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-slate-800">
                              {patient?.name ?? '未知'}
                            </span>
                            <span
                              className={cn(
                                'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                                checkInStatusColor[checkIn.status],
                              )}
                            >
                              {checkInStatusLabel[checkIn.status]}
                            </span>
                            {checkIn.arrivalFlag && checkIn.arrivalFlag !== 'on_time' && (
                              <span
                                className={cn(
                                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                                  arrivalFlagColor[checkIn.arrivalFlag],
                                )}
                              >
                                {checkIn.arrivalFlag === 'early' ? (
                                  <Clock className="w-3 h-3" />
                                ) : (
                                  <AlertTriangle className="w-3 h-3" />
                                )}
                                {arrivalFlagLabel[checkIn.arrivalFlag]}
                              </span>
                            )}
                            {rule && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
                                <ShieldAlert className="w-3 h-3" />
                                {rule.disease}
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {patient?.phone ?? '-'}
                            </span>
                            <span className="flex items-center gap-1">
                              <BedDouble className="w-3 h-3" />
                              预约 {bed?.bedNumber ?? '-'}
                            </span>
                            <span className="flex items-center gap-1">
                              <CalendarClock className="w-3 h-3" />
                              {slot?.label ?? '-'} {apt ? `${formatTime(apt.startTime)}-${formatTime(apt.endTime)}` : ''}
                            </span>
                            <span>签到 {formatTime(checkIn.checkInTime)}</span>
                            {handler && <span>处理人 {handler.name}</span>}
                          </div>
                          {checkIn.conflictReason && (
                            <div className="mt-2 text-xs text-rose-600 bg-rose-50 rounded-lg px-3 py-1.5">
                              冲突原因：{checkIn.conflictReason}
                            </div>
                          )}
                          {checkIn.triageNote && (
                            <div className="mt-1 text-xs text-slate-500">
                              备注：{checkIn.triageNote}
                            </div>
                          )}
                          {isActionable && availableBeds.length > 0 && (
                            <div className="mt-2 text-xs text-slate-500">
                              可用床位：{availableBeds.map((b) => b.bedNumber).join('、')}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {isActionable && (
                            <>
                              <button
                                onClick={() => {
                                  setConfirmTarget(checkIn);
                                  setOverrideBedId('');
                                }}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition-colors"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                确认入床
                              </button>
                              <button
                                onClick={() => {
                                  setRejectTarget(checkIn);
                                  setRejectReason('');
                                }}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-lg text-xs font-medium hover:bg-rose-100 transition-colors"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                退回
                              </button>
                            </>
                          )}
                          {checkIn.status === 'triage_confirmed' && (
                            <RoleGate allowed={['admin', 'senior']} fallback={null}>
                              <button
                                onClick={() => {
                                  setModifyTarget(checkIn);
                                  setModifyNote(checkIn.triageNote ?? '');
                                }}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-200 transition-colors"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                修改
                              </button>
                            </RoleGate>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
        open={!!confirmTarget}
        title="确认分诊入床"
        description={
          confirmTarget
            ? `将 ${getPatient(confirmTarget.patientId)?.name ?? ''} 入床至 ${(() => {
                const apt = getApt(confirmTarget.appointmentId);
                return apt ? getBed(apt.bedId)?.bedNumber ?? '' : '';
              })()}`
            : ''
        }
        confirmText="确认入床"
        onConfirm={() => confirmTarget && handleConfirmTriage(confirmTarget)}
        onCancel={() => {
          setConfirmTarget(null);
          setOverrideBedId('');
        }}
      >
        {confirmTarget && (() => {
          const apt = getApt(confirmTarget.appointmentId);
          const rule = apt?.isolationRuleId
            ? isolationRules.find((r) => r.id === apt.isolationRuleId)
            : null;
          const currentBed = apt ? getBed(apt.bedId) : null;
          const availableBeds = getAvailableBeds(checkIns.find((c) => c.id === confirmTarget.id)!);

          return (
            <div className="space-y-3 mt-2">
              <div className="bg-slate-50 rounded-lg p-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">患者</span>
                  <span className="font-medium">{getPatient(confirmTarget.patientId)?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">诊断</span>
                  <span className="font-medium">{getPatient(confirmTarget.patientId)?.diagnosis ?? '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">预约床位</span>
                  <span className="font-medium">{currentBed?.bedNumber ?? '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">床位状态</span>
                  <span className={cn(
                    'font-medium',
                    currentBed?.status === 'idle' ? 'text-emerald-600' : 'text-rose-600',
                  )}>
                    {currentBed?.status === 'idle' ? '空闲' : currentBed?.status === 'occupied' ? '占用' : currentBed?.status === 'isolated' ? '隔离' : currentBed?.status === 'cleaning' ? '清洁中' : '-'}
                  </span>
                </div>
                {rule && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">传染病标记</span>
                    <span className="font-medium text-amber-600">{rule.disease}</span>
                  </div>
                )}
                {apt && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">预约时段</span>
                    <span className="font-medium">
                      {getSlot(apt.slotId)?.label} {formatTime(apt.startTime)}-{formatTime(apt.endTime)}
                    </span>
                  </div>
                )}
              </div>
              {availableBeds.length > 0 && (
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">
                    更换床位（可选，默认使用预约床位）
                  </label>
                  <select
                    value={overrideBedId}
                    onChange={(e) => setOverrideBedId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="">使用预约床位</option>
                    {availableBeds.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.bedNumber}（{b.zone}区 · {b.type === 'normal' ? '普通' : b.type === 'negative' ? '负压' : '轮椅位'}）
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          );
        })()}
      </ConfirmModal>

      <ConfirmModal
        open={!!rejectTarget}
        title="退回分诊"
        description="退回后预约将恢复为待入床状态，患者可重新签到"
        confirmText="确认退回"
        danger
        onConfirm={() => rejectTarget && handleRejectTriage(rejectTarget)}
        onCancel={() => {
          setRejectTarget(null);
          setRejectReason('');
        }}
      >
        <div className="mt-2">
          <label className="text-xs text-slate-500 mb-1 block">退回原因</label>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="请填写退回原因..."
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none"
            rows={3}
          />
        </div>
      </ConfirmModal>

      <ConfirmModal
        open={!!modifyTarget}
        title="修改分诊信息"
        description="管理员和高级护士可修改分诊结果"
        confirmText="保存修改"
        onConfirm={() => modifyTarget && handleModifyTriage(modifyTarget)}
        onCancel={() => {
          setModifyTarget(null);
          setModifyNote('');
        }}
      >
        <div className="mt-2">
          <label className="text-xs text-slate-500 mb-1 block">分诊备注</label>
          <textarea
            value={modifyNote}
            onChange={(e) => setModifyNote(e.target.value)}
            placeholder="填写备注..."
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            rows={3}
          />
        </div>
      </ConfirmModal>
    </div>
  );
}
