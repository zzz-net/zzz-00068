import { useState, useMemo } from 'react';
import {
  CalendarDays,
  UserCheck,
  Search,
  Plus,
  Filter,
  ChevronDown,
  XCircle,
  CheckCircle2,
  Clock,
  ArrowRight,
  ArrowLeft,
  RefreshCcw,
  AlertCircle,
  FileText,
  Phone,
  User,
  Home,
  X,
} from 'lucide-react';
import { useAppStore } from '@/store';
import { useToastStore } from '@/store/toast';
import { RoleGate } from '@/components/RoleGate';
import { ConfirmModal } from '@/components/ConfirmModal';
import type { LeaveRequest, LeaveStatus } from '@/types';

const STATUS_LABELS: Record<LeaveStatus, { label: string; color: string; icon: any }> = {
  pending: { label: '待审批', color: 'text-amber-700 bg-amber-50 border-amber-200', icon: Clock },
  approved: { label: '已批准', color: 'text-emerald-700 bg-emerald-50 border-emerald-200', icon: CheckCircle2 },
  rejected: { label: '已驳回', color: 'text-rose-700 bg-rose-50 border-rose-200', icon: XCircle },
  departed: { label: '已离院', color: 'text-orange-700 bg-orange-50 border-orange-200', icon: ArrowRight },
  returned: { label: '已返院', color: 'text-green-700 bg-green-50 border-green-200', icon: ArrowLeft },
  withdrawn: { label: '已撤回', color: 'text-gray-600 bg-gray-50 border-gray-200', icon: RefreshCcw },
  overdue_return: { label: '逾期返院', color: 'text-red-700 bg-red-50 border-red-200', icon: AlertCircle },
};

function formatDateTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toInputValue(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function LeaveManagement() {
  const currentNurse = useAppStore((s) => s.currentNurse);
  const nurses = useAppStore((s) => s.nurses);
  const patients = useAppStore((s) => s.patients);
  const beds = useAppStore((s) => s.beds);
  const admissions = useAppStore((s) => s.admissions);
  const leaveRequests = useAppStore((s) => s.leaveRequests);
  const wardLeaveConfigs = useAppStore((s) => s.wardLeaveConfigs);
  const createLeaveRequest = useAppStore((s) => s.createLeaveRequest);
  const approveLeaveRequest = useAppStore((s) => s.approveLeaveRequest);
  const rejectLeaveRequest = useAppStore((s) => s.rejectLeaveRequest);
  const withdrawLeaveRequest = useAppStore((s) => s.withdrawLeaveRequest);
  const confirmLeaveDepart = useAppStore((s) => s.confirmLeaveDepart);
  const confirmLeaveReturn = useAppStore((s) => s.confirmLeaveReturn);
  const getWardLeaveConfig = useAppStore((s) => s.getWardLeaveConfig);
  const getLeaveAuditLogs = useAppStore((s) => s.getLeaveAuditLogs);
  const showToast = useToastStore((s) => s.showToast);

  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState<LeaveRequest | null>(null);
  const [filterStatus, setFilterStatus] = useState<LeaveStatus | 'all'>('all');
  const [filterZone, setFilterZone] = useState<string>('all');
  const [searchText, setSearchText] = useState('');

  const [rejectModal, setRejectModal] = useState<{ open: boolean; leaveId: string; reason: string }>({ open: false, leaveId: '', reason: '' });
  const [withdrawModal, setWithdrawModal] = useState<{ open: boolean; leaveId: string; reason: string }>({ open: false, leaveId: '', reason: '' });

  const [formData, setFormData] = useState({
    admissionId: '',
    departTime: toInputValue(Date.now() + 30 * 60 * 1000),
    expectedReturnTime: toInputValue(Date.now() + 3 * 60 * 60 * 1000),
    companionName: '',
    companionPhone: '',
    reason: '',
  });

  const activeAdmissions = useMemo(() => {
    return admissions
      .filter((a) => a.status === 'in_bed')
      .map((a) => {
        const patient = patients.find((p) => p.id === a.patientId);
        const bed = beds.find((b) => b.id === a.bedId);
        return { admission: a, patient, bed };
      })
      .filter((x) => x.patient && x.bed);
  }, [admissions, patients, beds]);

  const filteredRequests = useMemo(() => {
    return leaveRequests.filter((lr) => {
      if (filterStatus !== 'all' && lr.status !== filterStatus) return false;
      if (filterZone !== 'all' && lr.zone !== filterZone) return false;
      if (searchText.trim()) {
        const patient = patients.find((p) => p.id === lr.patientId);
        const bed = beds.find((b) => b.id === lr.bedId);
        const text = searchText.trim().toLowerCase();
        const match =
          patient?.name.toLowerCase().includes(text) ||
          bed?.bedNumber.toLowerCase().includes(text) ||
          lr.companionName.toLowerCase().includes(text) ||
          lr.companionPhone.includes(text) ||
          lr.reason.toLowerCase().includes(text);
        if (!match) return false;
      }
      return true;
    }).sort((a, b) => b.createdAt - a.createdAt);
  }, [leaveRequests, filterStatus, filterZone, searchText, patients, beds]);

  const zones = useMemo(() => {
    const set = new Set<string>();
    beds.forEach((b) => set.add(b.zone));
    return Array.from(set);
  }, [beds]);

  const selectedConfig = useMemo(() => {
    if (!formData.admissionId) return null;
    const adm = admissions.find((a) => a.id === formData.admissionId);
    if (!adm) return null;
    const bed = beds.find((b) => b.id === adm.bedId);
    return bed ? getWardLeaveConfig(bed.zone) : null;
  }, [formData.admissionId, admissions, beds, getWardLeaveConfig]);

  function handleCreate() {
    if (!currentNurse) return;
    if (!formData.admissionId) {
      showToast('请选择住院患者', 'error');
      return;
    }
    const result = createLeaveRequest({
      admissionId: formData.admissionId,
      departTime: new Date(formData.departTime).getTime(),
      expectedReturnTime: new Date(formData.expectedReturnTime).getTime(),
      companionName: formData.companionName,
      companionPhone: formData.companionPhone,
      reason: formData.reason,
      submittedBy: currentNurse.id,
    });
    if (result.success) {
      showToast('请假申请提交成功，等待医生审批', 'success');
      setShowNewModal(false);
      setFormData({
        admissionId: '',
        departTime: toInputValue(Date.now() + 30 * 60 * 1000),
        expectedReturnTime: toInputValue(Date.now() + 3 * 60 * 60 * 1000),
        companionName: '',
        companionPhone: '',
        reason: '',
      });
    } else {
      showToast(result.error ?? '提交失败', 'error');
    }
  }

  function handleApprove(leaveId: string) {
    if (!currentNurse) return;
    const result = approveLeaveRequest(leaveId, currentNurse.id);
    showToast(result.success ? '已批准请假申请' : result.error ?? '操作失败', result.success ? 'success' : 'error');
    if (result.success && selectedLeave?.id === leaveId) {
      setSelectedLeave({ ...selectedLeave, status: 'approved', approvedBy: currentNurse.id, approvedAt: Date.now() });
    }
  }

  function handleRejectConfirm() {
    if (!currentNurse) return;
    const result = rejectLeaveRequest(rejectModal.leaveId, currentNurse.id, rejectModal.reason);
    showToast(result.success ? '已驳回请假申请' : result.error ?? '操作失败', result.success ? 'success' : 'error');
    setRejectModal({ open: false, leaveId: '', reason: '' });
    if (result.success && selectedLeave?.id === rejectModal.leaveId) {
      setSelectedLeave({ ...selectedLeave, status: 'rejected', rejectedBy: currentNurse.id, rejectedAt: Date.now(), rejectReason: rejectModal.reason });
    }
  }

  function handleWithdrawConfirm() {
    if (!currentNurse) return;
    const result = withdrawLeaveRequest(withdrawModal.leaveId, currentNurse.id, withdrawModal.reason);
    showToast(result.success ? '已撤回请假批准' : result.error ?? '操作失败', result.success ? 'success' : 'error');
    setWithdrawModal({ open: false, leaveId: '', reason: '' });
    if (result.success && selectedLeave?.id === withdrawModal.leaveId) {
      setSelectedLeave({ ...selectedLeave, status: 'withdrawn', withdrawnBy: currentNurse.id, withdrawnAt: Date.now(), withdrawReason: withdrawModal.reason });
    }
  }

  function handleDepart(leaveId: string) {
    if (!currentNurse) return;
    const result = confirmLeaveDepart(leaveId, currentNurse.id);
    showToast(result.success ? '已确认患者离院' : result.error ?? '操作失败', result.success ? 'success' : 'error');
    if (result.success && selectedLeave?.id === leaveId) {
      setSelectedLeave({ ...selectedLeave, status: 'departed', actualDepartTime: Date.now(), departedBy: currentNurse.id });
    }
  }

  function handleReturn(leaveId: string) {
    if (!currentNurse) return;
    const result = confirmLeaveReturn(leaveId, currentNurse.id);
    showToast(result.success ? '已确认患者返院' : result.error ?? '操作失败', result.success ? 'success' : 'error');
    if (result.success && selectedLeave?.id === leaveId) {
      const now = Date.now();
      const isOverdue = now > selectedLeave.expectedReturnTime;
      setSelectedLeave({
        ...selectedLeave,
        status: isOverdue ? 'overdue_return' : 'returned',
        actualReturnTime: now,
        returnedBy: currentNurse.id,
        overdue: isOverdue,
      });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <CalendarDays className="w-7 h-7 text-sky-600" />
            住院请假管理
          </h2>
          <p className="text-sm text-slate-500 mt-1">申请 → 审批 → 离院 → 返院 全流程管理</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="搜索患者/床位/原因..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="pl-9 pr-4 py-2 w-64 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            />
          </div>
          <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 bg-white">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={filterZone}
              onChange={(e) => setFilterZone(e.target.value)}
              className="text-sm border-none bg-transparent focus:outline-none"
            >
              <option value="all">全部病区</option>
              {zones.map((z) => (
                <option key={z} value={z}>{z} 病区</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 bg-white">
            <ChevronDown className="w-4 h-4 text-slate-400" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as LeaveStatus | 'all')}
              className="text-sm border-none bg-transparent focus:outline-none"
            >
              <option value="all">全部状态</option>
              {(Object.keys(STATUS_LABELS) as LeaveStatus[]).map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s].label}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            新建请假申请
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-600">患者/床位</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">病区</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">离院时间</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">预计返院</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">陪同人</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">状态</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">提交时间</th>
                <th className="px-4 py-3 text-right font-medium text-slate-600">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRequests.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                    <FileText className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    暂无请假记录
                  </td>
                </tr>
              )}
              {filteredRequests.map((lr) => {
                const patient = patients.find((p) => p.id === lr.patientId);
                const bed = beds.find((b) => b.id === lr.bedId);
                const submitter = nurses.find((n) => n.id === lr.submittedBy);
                const statusCfg = STATUS_LABELS[lr.status];
                const StatusIcon = statusCfg.icon;
                return (
                  <tr key={lr.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{patient?.name ?? '-'}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{bed?.bedNumber ?? '-'}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{lr.zone} 病区</td>
                    <td className="px-4 py-3 text-slate-700 font-mono text-xs">{formatDateTime(lr.departTime)}</td>
                    <td className="px-4 py-3 text-slate-700 font-mono text-xs">{formatDateTime(lr.expectedReturnTime)}</td>
                    <td className="px-4 py-3">
                      <div className="text-slate-700">{lr.companionName}</div>
                      <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3" />
                        {lr.companionPhone}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-medium ${statusCfg.color}`}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {statusCfg.label}
                        {lr.overdue && <AlertCircle className="w-3.5 h-3.5 ml-1" />}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-slate-600 font-mono">{formatDateTime(lr.submittedAt)}</div>
                      <div className="text-xs text-slate-400">{submitter?.name ?? '-'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            const latest = leaveRequests.find((l) => l.id === lr.id);
                            setSelectedLeave(latest ?? lr);
                          }}
                          className="p-1.5 text-slate-500 hover:text-sky-600 hover:bg-sky-50 rounded-md transition-colors"
                          title="查看详情"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                        <RoleGate allowed={['admin', 'senior']}>
                          {lr.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleApprove(lr.id)}
                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"
                                title="批准"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setRejectModal({ open: true, leaveId: lr.id, reason: '' })}
                                className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                                title="驳回"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          {lr.status === 'approved' && (
                            <button
                              onClick={() => setWithdrawModal({ open: true, leaveId: lr.id, reason: '' })}
                              className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-md transition-colors"
                              title="撤回批准"
                            >
                              <RefreshCcw className="w-4 h-4" />
                            </button>
                          )}
                        </RoleGate>
                        {lr.status === 'approved' && (
                          <button
                            onClick={() => handleDepart(lr.id)}
                            className="p-1.5 text-orange-600 hover:bg-orange-50 rounded-md transition-colors"
                            title="确认离院"
                          >
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        )}
                        {(lr.status === 'departed' || lr.status === 'overdue_return') && (
                          <button
                            onClick={() => handleReturn(lr.id)}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded-md transition-colors"
                            title="确认返院"
                          >
                            <ArrowLeft className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Plus className="w-5 h-5 text-sky-600" />
                新建请假申请
              </h3>
              <button
                onClick={() => setShowNewModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  <User className="w-4 h-4 inline mr-1 -mt-0.5" />
                  住院患者 <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formData.admissionId}
                  onChange={(e) => setFormData({ ...formData, admissionId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                >
                  <option value="">请选择在院患者...</option>
                  {activeAdmissions.map(({ admission, patient, bed }) => (
                    <option key={admission.id} value={admission.id}>
                      {patient?.name} - {bed?.bedNumber}（{bed?.zone}病区 / {patient?.diagnosis ?? ''}）
                    </option>
                  ))}
                </select>
              </div>
              {selectedConfig && (
                <div className="p-3 bg-sky-50 border border-sky-200 rounded-lg text-xs text-sky-800 space-y-1">
                  <div className="font-medium flex items-center gap-1">
                    <Home className="w-3.5 h-3.5" />
                    {selectedConfig.zone} 病区请假规则
                  </div>
                  <div>• 单次最长请假：{selectedConfig.maxLeaveHours} 小时</div>
                  <div>• 夜间禁出时段：{selectedConfig.nightExitStartTime} - {selectedConfig.nightExitEndTime}</div>
                  <div>• {selectedConfig.requireCompletedOrders ? '需完成所有未执行医嘱' : '无需校验未完成医嘱'}</div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    <CalendarDays className="w-4 h-4 inline mr-1 -mt-0.5" />
                    计划离院时间 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.departTime}
                    onChange={(e) => setFormData({ ...formData, departTime: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    <CalendarDays className="w-4 h-4 inline mr-1 -mt-0.5" />
                    预计返院时间 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.expectedReturnTime}
                    onChange={(e) => setFormData({ ...formData, expectedReturnTime: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    <UserCheck className="w-4 h-4 inline mr-1 -mt-0.5" />
                    陪同人姓名 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.companionName}
                    onChange={(e) => setFormData({ ...formData, companionName: e.target.value })}
                    placeholder="请输入陪同人姓名"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    <Phone className="w-4 h-4 inline mr-1 -mt-0.5" />
                    联系方式 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={formData.companionPhone}
                    onChange={(e) => setFormData({ ...formData, companionPhone: e.target.value })}
                    placeholder="请输入手机号码"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  <FileText className="w-4 h-4 inline mr-1 -mt-0.5" />
                  请假原因 <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  rows={3}
                  placeholder="请详细说明请假事由，如：回家探望、复诊、取药等"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 resize-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-200 bg-slate-50">
              <button
                onClick={() => setShowNewModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                className="px-4 py-2 text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors"
              >
                提交申请
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedLeave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-sky-600" />
                请假详情
              </h3>
              <button
                onClick={() => setSelectedLeave(null)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {(() => {
                const patient = patients.find((p) => p.id === selectedLeave.patientId);
                const bed = beds.find((b) => b.id === selectedLeave.bedId);
                const submitter = nurses.find((n) => n.id === selectedLeave.submittedBy);
                const approver = selectedLeave.approvedBy ? nurses.find((n) => n.id === selectedLeave.approvedBy) : null;
                const rejector = selectedLeave.rejectedBy ? nurses.find((n) => n.id === selectedLeave.rejectedBy) : null;
                const withdrawer = selectedLeave.withdrawnBy ? nurses.find((n) => n.id === selectedLeave.withdrawnBy) : null;
                const departer = selectedLeave.departedBy ? nurses.find((n) => n.id === selectedLeave.departedBy) : null;
                const returner = selectedLeave.returnedBy ? nurses.find((n) => n.id === selectedLeave.returnedBy) : null;
                const statusCfg = STATUS_LABELS[selectedLeave.status];
                const StatusIcon = statusCfg.icon;
                const auditLogs = getLeaveAuditLogs(selectedLeave.id);
                return (
                  <>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <div>
                          <div className="text-xs text-slate-500 mb-0.5">患者信息</div>
                          <div className="p-3 bg-slate-50 rounded-lg space-y-1">
                            <div className="font-medium text-slate-900">{patient?.name ?? '-'} <span className="text-xs text-slate-500 ml-1">{patient?.gender === 'male' ? '男' : '女'} / {patient?.age}岁</span></div>
                            <div className="text-xs text-slate-600">床位：{bed?.bedNumber ?? '-'}（{selectedLeave.zone}病区）</div>
                            <div className="text-xs text-slate-600">诊断：{patient?.diagnosis ?? '-'}</div>
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500 mb-0.5">请假状态</div>
                          <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium ${statusCfg.color}`}>
                            <StatusIcon className="w-4 h-4" />
                            {statusCfg.label}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500 mb-0.5">请假原因</div>
                          <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg text-sm text-amber-900">
                            {selectedLeave.reason}
                          </div>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <div className="text-xs text-slate-500 mb-0.5">时间信息</div>
                          <div className="p-3 bg-slate-50 rounded-lg space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-slate-500">计划离院</span>
                              <span className="font-mono text-slate-800">{formatDateTime(selectedLeave.departTime)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">预计返院</span>
                              <span className="font-mono text-slate-800">{formatDateTime(selectedLeave.expectedReturnTime)}</span>
                            </div>
                            {selectedLeave.actualDepartTime && (
                              <div className="flex justify-between text-orange-700">
                                <span>实际离院</span>
                                <span className="font-mono">{formatDateTime(selectedLeave.actualDepartTime)}</span>
                              </div>
                            )}
                            {selectedLeave.actualReturnTime && (
                              <div className={`flex justify-between ${selectedLeave.overdue ? 'text-red-700' : 'text-green-700'}`}>
                                <span>实际返院{selectedLeave.overdue ? '（超时）' : ''}</span>
                                <span className="font-mono">{formatDateTime(selectedLeave.actualReturnTime)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500 mb-0.5">陪同人信息</div>
                          <div className="p-3 bg-slate-50 rounded-lg space-y-1 text-sm">
                            <div className="flex items-center gap-2 text-slate-700">
                              <UserCheck className="w-4 h-4 text-slate-400" />
                              {selectedLeave.companionName}
                            </div>
                            <div className="flex items-center gap-2 text-slate-700">
                              <Phone className="w-4 h-4 text-slate-400" />
                              {selectedLeave.companionPhone}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    {(selectedLeave.rejectReason || selectedLeave.withdrawReason) && (
                      <div className={`p-4 rounded-lg text-sm ${selectedLeave.rejectReason ? 'bg-rose-50 border border-rose-200 text-rose-900' : 'bg-amber-50 border border-amber-200 text-amber-900'}`}>
                        <div className="font-medium mb-1">{selectedLeave.rejectReason ? `驳回（${rejector?.name}）` : `撤回（${withdrawer?.name}）`}</div>
                        <div>{selectedLeave.rejectReason ?? selectedLeave.withdrawReason}</div>
                      </div>
                    )}
                    <div>
                      <div className="text-xs text-slate-500 mb-2">处理流程记录</div>
                      <div className="space-y-0">
                        {auditLogs.length === 0 && <div className="text-sm text-slate-400">暂无流程记录</div>}
                        {auditLogs.map((log, idx) => (
                          <div key={log.id} className="flex gap-3">
                            <div className="flex flex-col items-center">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${idx === auditLogs.length - 1 ? 'bg-sky-100 border-sky-300' : 'bg-white border-slate-200'}`}>
                                {log.action === 'submit' && <FileText className="w-4 h-4 text-slate-500" />}
                                {log.action === 'approve' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                                {log.action === 'reject' && <XCircle className="w-4 h-4 text-rose-500" />}
                                {log.action === 'withdraw' && <RefreshCcw className="w-4 h-4 text-amber-500" />}
                                {log.action === 'confirm_depart' && <ArrowRight className="w-4 h-4 text-orange-500" />}
                                {log.action === 'confirm_return' && <ArrowLeft className="w-4 h-4 text-green-500" />}
                              </div>
                              {idx < auditLogs.length - 1 && <div className="w-px flex-1 bg-slate-200 my-1" />}
                            </div>
                            <div className="pb-4 flex-1">
                              <div className="flex items-center justify-between">
                                <div className="text-sm font-medium text-slate-800">
                                  {log.action === 'submit' && '提交申请'}
                                  {log.action === 'approve' && '医生批准'}
                                  {log.action === 'reject' && '医生驳回'}
                                  {log.action === 'withdraw' && '撤回批准'}
                                  {log.action === 'confirm_depart' && '护士确认离院'}
                                  {log.action === 'confirm_return' && '护士确认返院'}
                                </div>
                                <div className="text-xs font-mono text-slate-400">{formatDateTime(log.timestamp)}</div>
                              </div>
                              <div className="text-xs text-slate-500 mt-0.5">操作人：{log.operatorName}</div>
                              {log.reason && <div className="text-xs text-slate-600 mt-1">备注：{log.reason}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-200 bg-slate-50">
              <button
                onClick={() => setSelectedLeave(null)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={rejectModal.open}
        title="驳回请假申请"
        description="请填写驳回原因："
        confirmText="确认驳回"
        cancelText="取消"
        onConfirm={handleRejectConfirm}
        onCancel={() => setRejectModal({ open: false, leaveId: '', reason: '' })}
        danger
      >
        <input
          type="text"
          value={rejectModal.reason}
          onChange={(e) => setRejectModal({ ...rejectModal, reason: e.target.value })}
          placeholder="请输入驳回原因（必填）"
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
        />
      </ConfirmModal>
      <ConfirmModal
        open={withdrawModal.open}
        title="撤回请假批准"
        description="请填写撤回原因："
        confirmText="确认撤回"
        cancelText="取消"
        onConfirm={handleWithdrawConfirm}
        onCancel={() => setWithdrawModal({ open: false, leaveId: '', reason: '' })}
      >
        <input
          type="text"
          value={withdrawModal.reason}
          onChange={(e) => setWithdrawModal({ ...withdrawModal, reason: e.target.value })}
          placeholder="请输入撤回原因（必填）"
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
        />
      </ConfirmModal>
    </div>
  );
}
