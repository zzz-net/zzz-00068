import { useEffect, useMemo, useState } from 'react';
import { X, Plus, Clock, FileText, History, User, Stethoscope, Pill, Activity, AlertCircle, LogOut, ShieldAlert } from 'lucide-react';
import type { CareNoteType, Bed } from '@/types';
import { useAppStore } from '@/store';
import { StatusBadge } from '@/components/StatusBadge';
import { ConfirmModal } from '@/components/ConfirmModal';
import { showToast } from '@/components/Toast';

interface BedDetailDrawerProps {
  open: boolean;
  bedId?: string | null;
  bed?: Bed | null;
  onClose: () => void;
  dateStr?: string;
}

type TabKey = 'current' | 'notes' | 'history';

const typeEmojiMap: Record<string, string> = {
  normal: '🛏️ 普通床',
  negative: '☣️ 负压床',
  wheelchair: '♿ 轮椅位',
};

const careNoteTypeConfig: Record<CareNoteType, { label: string; icon: JSX.Element; color: string }> = {
  observation: { label: '观察', icon: <Eye className="w-3.5 h-3.5" />, color: 'bg-blue-100 text-blue-700' },
  medication: { label: '给药', icon: <Pill className="w-3.5 h-3.5" />, color: 'bg-purple-100 text-purple-700' },
  treatment: { label: '治疗', icon: <Stethoscope className="w-3.5 h-3.5" />, color: 'bg-emerald-100 text-emerald-700' },
  abnormal: { label: '异常', icon: <AlertCircle className="w-3.5 h-3.5" />, color: 'bg-rose-100 text-rose-700' },
};

function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function Eye({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function BedDetailDrawer({ open, bedId, bed: bedProp, onClose, dateStr }: BedDetailDrawerProps) {
  const [tab, setTab] = useState<TabKey>('current');
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [noteType, setNoteType] = useState<CareNoteType>('observation');
  const [showDischargeConfirm, setShowDischargeConfirm] = useState(false);
  const [showForceConfirm, setShowForceConfirm] = useState(false);

  const storeBeds = useAppStore((s) => s.beds);
  const patients = useAppStore((s) => s.patients);
  const admissions = useAppStore((s) => s.admissions);
  const careNotes = useAppStore((s) => s.careNotes);
  const nurses = useAppStore((s) => s.nurses);
  const appointments = useAppStore((s) => s.appointments);
  const currentUser = useAppStore((s) => s.currentUser);
  const addCareNote = useAppStore((s) => s.addCareNote);
  const dischargeBed = useAppStore((s) => s.dischargeBed);

  const resolvedBedId = bedProp?.id ?? bedId ?? null;

  const bed = useMemo(() => {
    if (bedProp) return bedProp;
    return storeBeds.find((b) => b.id === resolvedBedId) ?? null;
  }, [bedProp, storeBeds, resolvedBedId]);

  void dateStr;

  useEffect(() => {
    if (open) {
      setTab('current');
      setShowNoteModal(false);
      setNoteContent('');
      setNoteType('observation');
      setShowDischargeConfirm(false);
      setShowForceConfirm(false);
    }
  }, [open, resolvedBedId]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  const currentAdmission = useMemo(() => {
    if (!bed?.currentAdmissionId) return null;
    return admissions.find((a) => a.id === bed.currentAdmissionId) ?? null;
  }, [bed, admissions]);

  const currentPatient = useMemo(() => {
    if (!bed?.currentPatientId) return null;
    return patients.find((p) => p.id === bed.currentPatientId) ?? null;
  }, [bed, patients]);

  const currentCareNotes = useMemo(() => {
    if (!currentAdmission) return [];
    return careNotes
      .filter((n) => n.admissionId === currentAdmission.id)
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [currentAdmission, careNotes]);

  const allBedAdmissions = useMemo(() => {
    if (!resolvedBedId) return [];
    return admissions
      .filter((a) => a.bedId === resolvedBedId)
      .sort((a, b) => b.admittedAt - a.admittedAt);
  }, [resolvedBedId, admissions]);

  const getNurseName = (nurseId?: string) => {
    if (!nurseId) return '-';
    return nurses.find((n) => n.id === nurseId)?.name ?? nurseId;
  };

  const handleAddNote = () => {
    if (!currentAdmission || !currentUser) return;
    if (!noteContent.trim()) {
      showToast('warning', '请输入备注内容');
      return;
    }
    addCareNote({
      admissionId: currentAdmission.id,
      nurseId: currentUser.id,
      content: noteContent.trim(),
      timestamp: Date.now(),
      type: noteType,
    });
    showToast('success', '护理备注已添加');
    setNoteContent('');
    setNoteType('observation');
    setShowNoteModal(false);
  };

  const handleDischarge = (force: boolean) => {
    if (!currentAdmission || !currentUser) return;
    const result = dischargeBed(currentAdmission.id, currentUser.id, force);
    if (result.success) {
      showToast('success', force ? '已强制释放床位' : '已正常出床');
      setShowDischargeConfirm(false);
      setShowForceConfirm(false);
    } else {
      showToast('error', result.error ?? '操作失败');
    }
  };

  if (!bed) return null;

  const isAdminOrSenior = currentUser?.role === 'admin' || currentUser?.role === 'senior';

  return (
    <>
      <div
        className={`fixed inset-0 z-[9990] transition-opacity duration-300 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          onClick={onClose}
        />
        <aside
          className={`absolute right-0 top-0 h-screen w-[480px] max-w-[100vw] bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-out ${
            open ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <header className="px-6 pt-5 pb-4 border-b border-slate-200">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-2xl font-bold text-slate-900">{bed.bedNumber}</h2>
                  <StatusBadge status={bed.status} />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-medium">
                    {bed.zone}
                  </span>
                  <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-medium">
                    {typeEmojiMap[bed.type]}
                  </span>
                </div>
              </div>
              <button
                onClick={onClose}
                className="flex-shrink-0 p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex gap-1 mt-5 p-1 bg-slate-100 rounded-lg">
              {([
                { key: 'current', label: '当前状态', icon: <Clock className="w-4 h-4" /> },
                { key: 'notes', label: '护理备注', icon: <FileText className="w-4 h-4" /> },
                { key: 'history', label: '历史记录', icon: <History className="w-4 h-4" /> },
              ] as { key: TabKey; label: string; icon: JSX.Element }[]).map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                    tab === t.key
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>
          </header>

          <main className="flex-1 overflow-y-auto">
            {tab === 'current' && (
              <div className="p-6 space-y-6">
                <section>
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
                    患者信息
                  </h3>
                  {currentPatient ? (
                    <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                          {currentPatient.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-lg font-semibold text-slate-900">
                            {currentPatient.name}
                          </p>
                          <p className="text-sm text-slate-500">
                            {currentPatient.gender === 'male' ? '男' : '女'} ·{' '}
                            {currentPatient.age}岁
                          </p>
                        </div>
                      </div>
                      {currentPatient.diagnosis && (
                        <div className="pt-2 border-t border-slate-200/70 mt-2">
                          <p className="text-xs text-slate-400 mb-1">诊断</p>
                          <p className="text-sm text-slate-700">{currentPatient.diagnosis}</p>
                        </div>
                      )}
                      {currentAdmission && (
                        <div className="pt-2 border-t border-slate-200/70 mt-2">
                          <p className="text-xs text-slate-400 mb-1">入床时间</p>
                          <p className="text-sm text-slate-700">
                            {formatDateTime(currentAdmission.admittedAt)}
                          </p>
                          <p className="text-xs text-slate-400 mt-2 mb-1">负责护士</p>
                          <p className="text-sm text-slate-700">
                            {getNurseName(currentAdmission.admittedBy)}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-slate-50 rounded-xl p-6 text-center">
                      <User className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                      <p className="text-slate-400">暂无患者</p>
                    </div>
                  )}
                </section>

                <section>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
                      本次护理备注
                    </h3>
                    {currentAdmission && (
                      <button
                        onClick={() => setShowNoteModal(true)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        添加
                      </button>
                    )}
                  </div>
                  {currentCareNotes.length > 0 ? (
                    <ol className="relative border-l-2 border-slate-200 ml-3 space-y-4">
                      {currentCareNotes.map((note) => {
                        const cfg = careNoteTypeConfig[note.type];
                        return (
                          <li key={note.id} className="pl-5 relative">
                            <span
                              className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 border-white ${cfg.color} flex items-center justify-center`}
                            >
                              <div className="invisible">{cfg.icon}</div>
                            </span>
                            <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm">
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}
                                >
                                  {cfg.icon}
                                  {cfg.label}
                                </span>
                                <span className="text-xs text-slate-400">
                                  {formatDateTime(note.timestamp)}
                                </span>
                              </div>
                              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                                {note.content}
                              </p>
                              <p className="text-xs text-slate-400 mt-2">
                                — {getNurseName(note.nurseId)}
                              </p>
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  ) : currentAdmission ? (
                    <div className="bg-slate-50 rounded-xl p-6 text-center">
                      <FileText className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                      <p className="text-slate-400 text-sm">暂无护理备注</p>
                    </div>
                  ) : (
                    <div className="bg-slate-50 rounded-xl p-4 text-center">
                      <p className="text-slate-400 text-sm">床位空闲中</p>
                    </div>
                  )}
                </section>

                {currentAdmission && (
                  <section className="space-y-2 pt-2">
                    <button
                      onClick={() => setShowDischargeConfirm(true)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors"
                    >
                      <LogOut className="w-5 h-5" />
                      正常出床
                    </button>
                    {isAdminOrSenior && (
                      <button
                        onClick={() => setShowForceConfirm(true)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-rose-600 text-white font-medium hover:bg-rose-700 transition-colors"
                      >
                        <ShieldAlert className="w-5 h-5" />
                        强制释放
                      </button>
                    )}
                  </section>
                )}
              </div>
            )}

            {tab === 'notes' && (
              <div className="p-6">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
                  全部护理备注
                </h3>
                {(() => {
                  const relatedAdmissionIds = allBedAdmissions.map((a) => a.id);
                  const notes = careNotes
                    .filter((n) => relatedAdmissionIds.includes(n.admissionId))
                    .sort((a, b) => b.timestamp - a.timestamp);
                  if (notes.length === 0) {
                    return (
                      <div className="bg-slate-50 rounded-xl p-8 text-center">
                        <FileText className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                        <p className="text-slate-400">暂无任何护理备注</p>
                      </div>
                    );
                  }
                  return (
                    <div className="space-y-3">
                      {notes.map((note) => {
                        const cfg = careNoteTypeConfig[note.type];
                        const adm = admissions.find((a) => a.id === note.admissionId);
                        const pat = adm
                          ? patients.find((p) => p.id === adm.patientId)
                          : null;
                        return (
                          <div
                            key={note.id}
                            className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm"
                          >
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}
                                >
                                  {cfg.icon}
                                  {cfg.label}
                                </span>
                                {pat && (
                                  <span className="text-xs text-slate-500">
                                    患者：{pat.name}
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-slate-400 flex-shrink-0">
                                {formatDateTime(note.timestamp)}
                              </span>
                            </div>
                            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                              {note.content}
                            </p>
                            <p className="text-xs text-slate-400 mt-2">
                              — {getNurseName(note.nurseId)}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}

            {tab === 'history' && (
              <div className="p-6">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
                  床位历史记录
                </h3>
                {allBedAdmissions.length === 0 ? (
                  <div className="bg-slate-50 rounded-xl p-8 text-center">
                    <History className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                    <p className="text-slate-400">暂无历史记录</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {allBedAdmissions.map((adm) => {
                      const pat = patients.find((p) => p.id === adm.patientId);
                      const apt = adm.appointmentId
                        ? appointments.find((a) => a.id === adm.appointmentId)
                        : null;
                      return (
                        <div
                          key={adm.id}
                          className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-sm flex-shrink-0">
                                {pat?.name.charAt(0) ?? '?'}
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-900 truncate">
                                  {pat?.name ?? '未知患者'}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {pat ? `${pat.gender === 'male' ? '男' : '女'} · ${pat.age}岁` : ''}
                                </p>
                              </div>
                            </div>
                            <StatusBadge status={adm.status} />
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="text-xs text-slate-400 mb-0.5">入床时间</p>
                              <p className="text-slate-700">{formatDateTime(adm.admittedAt)}</p>
                              <p className="text-xs text-slate-400 mt-1 mb-0.5">护士</p>
                              <p className="text-slate-700">{getNurseName(adm.admittedBy)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-400 mb-0.5">出床时间</p>
                              <p className="text-slate-700">
                                {adm.dischargedAt ? formatDateTime(adm.dischargedAt) : '-'}
                              </p>
                              {adm.dischargedBy && (
                                <>
                                  <p className="text-xs text-slate-400 mt-1 mb-0.5">出床护士</p>
                                  <p className="text-slate-700">{getNurseName(adm.dischargedBy)}</p>
                                </>
                              )}
                            </div>
                          </div>
                          {adm.dischargeReason && (
                            <div className="mt-3 pt-3 border-t border-slate-100">
                              <p className="text-xs text-slate-400 mb-0.5">出床原因</p>
                              <p className="text-sm text-slate-700">{adm.dischargeReason}</p>
                            </div>
                          )}
                          {apt?.isolationRuleId && (
                            <div className="mt-2">
                              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                                隔离治疗
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </main>
        </aside>
      </div>

      <ConfirmModal
        open={showDischargeConfirm}
        title="确认正常出床"
        description={`确认将 ${currentPatient?.name ?? '患者'} 正常出床？出床后床位将进入清洁状态。`}
        confirmText="确认出床"
        onConfirm={() => handleDischarge(false)}
        onCancel={() => setShowDischargeConfirm(false)}
      />

      <ConfirmModal
        open={showForceConfirm}
        title="确认强制释放"
        description={`强制释放 ${currentPatient?.name ?? '患者'} 的床位占用？此操作会记录异常，请谨慎操作。`}
        confirmText="强制释放"
        danger
        onConfirm={() => handleDischarge(true)}
        onCancel={() => setShowForceConfirm(false)}
      />

      <ConfirmModal
        open={showNoteModal}
        title="添加护理备注"
        description={undefined}
        confirmText="提交"
        onConfirm={handleAddNote}
        onCancel={() => setShowNoteModal(false)}
      >
        {showNoteModal && (
          <div className="mb-4 -mt-2">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              备注类型
            </label>
            <div className="flex flex-wrap gap-2 mb-4">
              {(Object.keys(careNoteTypeConfig) as CareNoteType[]).map((key) => {
                const cfg = careNoteTypeConfig[key];
                const active = noteType === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setNoteType(key)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                      active
                        ? `${cfg.color} border-transparent ring-2 ring-offset-1 ring-slate-300`
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {cfg.icon}
                    {cfg.label}
                  </button>
                );
              })}
            </div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              备注内容
            </label>
            <textarea
              autoFocus
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              rows={4}
              placeholder="请输入护理备注内容..."
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>
        )}
      </ConfirmModal>
    </>
  );
}

export default BedDetailDrawer;
