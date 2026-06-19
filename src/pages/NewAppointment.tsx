import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store';
import { useToastStore } from '@/store/toast';
import StatusBadge from '@/components/StatusBadge';
import type { BedType, NurseRole } from '@/types';
import {
  ArrowLeft,
  Send,
  X,
  User,
  Stethoscope,
  Phone,
  CreditCard,
  AlertTriangle,
  Calendar as CalendarIcon,
  Clock,
  Bed,
  ShieldAlert,
  ChevronDown,
  LayoutGrid,
  ClipboardList,
  Settings,
  History,
  LogOut,
} from 'lucide-react';
import { cn, getTodayStr, parseLocalTime } from '@/lib/utils';

export default function NewAppointment() {
  const navigate = useNavigate();
  const {
    currentUser,
    logout,
    beds,
    timeSlots,
    isolationRules,
    appointments,
    createAppointment,
  } = useAppStore();
  const { showToast } = useToastStore();

  const today = getTodayStr();

  const [patientName, setPatientName] = useState('');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [age, setAge] = useState('');
  const [phone, setPhone] = useState('');
  const [idCard, setIdCard] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [diseaseType, setDiseaseType] = useState('');
  const [isolationRuleId, setIsolationRuleId] = useState('');

  const [bedId, setBedId] = useState('');
  const [slotId, setSlotId] = useState('');
  const [appointmentDate, setAppointmentDate] = useState(today);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('12:00');
  const [notes, setNotes] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const roleLabel: Record<NurseRole, string> = {
    admin: '管理员',
    senior: '高级护士',
    normal: '普通护士',
  };

  const getInitial = (name: string) => name?.charAt?.(0) ?? '?';

  const selectedRule = isolationRules.find((r) => r.id === isolationRuleId);
  const requiredBedType = selectedRule?.requiredBedType;

  const bedTypeLabels: Record<BedType, string> = {
    normal: '普通',
    negative: '负压',
    wheelchair: '轮椅位',
  };

  const isBedDisabled = (bed: { id: string; type: BedType; status: string }) => {
    if (requiredBedType && bed.type !== requiredBedType) return true;
    if (bed.status !== 'idle') return true;
    return false;
  };

  const getBedDisabledReason = (bed: { id: string; type: BedType; status: string }) => {
    if (requiredBedType && bed.type !== requiredBedType) {
      return `需要${bedTypeLabels[requiredBedType]}类型床位，当前为${bedTypeLabels[bed.type]}床`;
    }
    if (bed.status !== 'idle') {
      return '床位当前非空闲状态';
    }
    return '';
  };

  const parseTimeToTs = (dateStr: string, hhmm: string) => {
    return parseLocalTime(dateStr, hhmm);
  };

  const overlapCheck = useMemo(() => {
    if (!bedId || !appointmentDate || !startTime || !endTime) return null;
    const startTs = parseTimeToTs(appointmentDate, startTime);
    const endTs = parseTimeToTs(appointmentDate, endTime);
    if (endTs <= startTs) return null;

    const conflicts = appointments.filter(
      (a) =>
        a.bedId === bedId &&
        a.appointmentDate === appointmentDate &&
        a.status !== 'cancelled' &&
        startTs < a.endTime &&
        endTs > a.startTime
    );
    return conflicts.length > 0 ? conflicts : null;
  }, [bedId, appointmentDate, startTime, endTime, appointments]);

  useEffect(() => {
    if (slotId) {
      const slot = timeSlots.find((s) => s.id === slotId);
      if (slot) {
        setStartTime(slot.startTime);
        setEndTime(slot.endTime);
      }
    }
  }, [slotId, timeSlots]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!patientName.trim()) newErrors.patientName = '请输入患者姓名';
    if (!age || Number(age) <= 0 || Number(age) > 150) newErrors.age = '请输入有效年龄';
    if (phone && !/^1[3-9]\d{9}$/.test(phone)) newErrors.phone = '手机号格式不正确';
    if (idCard && idCard.length !== 18) newErrors.idCard = '身份证号应为18位';

    if (!bedId) newErrors.bedId = '请选择床位';
    if (!slotId) newErrors.slotId = '请选择时段';
    if (!appointmentDate) newErrors.appointmentDate = '请选择日期';
    if (!startTime) newErrors.startTime = '请输入开始时间';
    if (!endTime) newErrors.endTime = '请输入结束时间';

    if (startTime && endTime) {
      const startTs = parseTimeToTs(appointmentDate, startTime);
      const endTs = parseTimeToTs(appointmentDate, endTime);
      if (endTs <= startTs) {
        newErrors.endTime = '结束时间必须晚于开始时间';
      }
    }

    if (requiredBedType) {
      const bed = beds.find((b) => b.id === bedId);
      if (bed && bed.type !== requiredBedType) {
        newErrors.bedId = `该传染病需使用${bedTypeLabels[requiredBedType]}类型床位`;
      }
    }

    if (overlapCheck) {
      newErrors.bedId = '该时段与已有预约重叠';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!currentUser) {
      showToast('请先登录', 'error');
      return;
    }
    if (!validate()) {
      showToast('请检查表单填写是否正确', 'error');
      return;
    }

    setSubmitting(true);
    const result = createAppointment({
      patientInfo: {
        name: patientName,
        gender,
        age: Number(age),
        phone: phone || undefined,
        idCard: idCard || undefined,
        diagnosis: diagnosis || undefined,
        diseaseType: diseaseType || undefined,
      },
      bedId,
      slotId,
      appointmentDate,
      startTime: parseTimeToTs(appointmentDate, startTime),
      endTime: parseTimeToTs(appointmentDate, endTime),
      isolationRuleId: isolationRuleId || undefined,
      createdBy: currentUser.id,
    });

    setSubmitting(false);

    if (result.success) {
      showToast('预约创建成功', 'success');
      setTimeout(() => navigate(-1), 600);
    } else {
      showToast(result.error ?? '创建失败', 'error');
    }
  };

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });

  const inputClass = (field: string) =>
    cn(
      'w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 transition-all',
      errors[field]
        ? 'border-red-300 focus:ring-red-200 bg-red-50'
        : 'border-gray-200 focus:ring-blue-200 focus:border-blue-400'
    );

  const labelClass = 'block text-sm font-medium text-gray-700 mb-1.5';

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

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-gray-600 hover:text-gray-800 text-sm font-medium mb-5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          返回预约列表
        </button>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-blue-500" />
              新建预约
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              填写患者信息和预约详情，系统将自动校验冲突和隔离规则
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
            <div className="space-y-5">
              <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-500" />
                  患者信息
                </h3>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>
                        姓名 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={patientName}
                        onChange={(e) => setPatientName(e.target.value)}
                        placeholder="请输入患者姓名"
                        className={inputClass('patientName')}
                      />
                      {errors.patientName && (
                        <p className="text-xs text-red-500 mt-1">{errors.patientName}</p>
                      )}
                    </div>
                    <div>
                      <label className={labelClass}>性别</label>
                      <div className="flex gap-2">
                        {(['male', 'female'] as const).map((g) => (
                          <button
                            key={g}
                            onClick={() => setGender(g)}
                            className={cn(
                              'flex-1 py-2.5 rounded-lg text-sm font-medium border transition-all',
                              gender === g
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                            )}
                          >
                            {g === 'male' ? '男' : '女'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>
                      年龄 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      placeholder="请输入年龄"
                      min={0}
                      max={150}
                      className={inputClass('age')}
                    />
                    {errors.age && (
                      <p className="text-xs text-red-500 mt-1">{errors.age}</p>
                    )}
                  </div>

                  <div>
                    <label className={labelClass}>
                      <Phone className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
                      手机号
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="请输入手机号"
                      className={inputClass('phone')}
                    />
                    {errors.phone && (
                      <p className="text-xs text-red-500 mt-1">{errors.phone}</p>
                    )}
                  </div>

                  <div>
                    <label className={labelClass}>
                      <CreditCard className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
                      身份证号
                    </label>
                    <input
                      type="text"
                      value={idCard}
                      onChange={(e) => setIdCard(e.target.value)}
                      placeholder="请输入18位身份证号"
                      className={inputClass('idCard')}
                    />
                    {errors.idCard && (
                      <p className="text-xs text-red-500 mt-1">{errors.idCard}</p>
                    )}
                  </div>

                  <div>
                    <label className={labelClass}>
                      <Stethoscope className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
                      诊断
                    </label>
                    <input
                      type="text"
                      value={diagnosis}
                      onChange={(e) => setDiagnosis(e.target.value)}
                      placeholder="如：慢性支气管炎急性加重"
                      className={inputClass('diagnosis')}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>疾病类型</label>
                      <input
                        type="text"
                        value={diseaseType}
                        onChange={(e) => setDiseaseType(e.target.value)}
                        placeholder="如：呼吸系统"
                        className={inputClass('diseaseType')}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>
                        <ShieldAlert className="w-3.5 h-3.5 inline mr-1 -mt-0.5 text-amber-500" />
                        传染病类型
                      </label>
                      <div className="relative">
                        <select
                          value={isolationRuleId}
                          onChange={(e) => setIsolationRuleId(e.target.value)}
                          className={cn(
                            'w-full appearance-none pl-3 pr-9 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2',
                            isolationRuleId
                              ? 'border-amber-300 bg-amber-50 focus:ring-amber-200'
                              : 'border-gray-200 focus:ring-blue-200 focus:border-blue-400'
                          )}
                        >
                          <option value="">无（普通患者）</option>
                          {isolationRules.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.disease}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      </div>
                      {selectedRule && (
                        <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          需要{bedTypeLabels[selectedRule.requiredBedType]}床位
                          {selectedRule.crossZoneForbidden && '，禁止跨区'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <div
                className={cn(
                  'rounded-xl p-5 border',
                  overlapCheck
                    ? 'bg-red-50 border-red-200'
                    : 'bg-gray-50 border-gray-100'
                )}
              >
                <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-indigo-500" />
                  预约信息
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className={labelClass}>
                      <Bed className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
                      选择床位 <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {beds
                        .filter((b) => b.status === 'idle' || !requiredBedType || b.type === requiredBedType)
                        .map((bed) => {
                          const disabled = isBedDisabled(bed);
                          const reason = getBedDisabledReason(bed);
                          return (
                            <div key={bed.id} className="relative group">
                              <button
                                type="button"
                                disabled={disabled}
                                onClick={() => setBedId(bed.id)}
                                className={cn(
                                  'w-full text-left p-3 rounded-lg border-2 transition-all text-sm',
                                  bedId === bed.id
                                    ? 'border-blue-500 bg-blue-50 shadow-sm'
                                    : disabled
                                    ? 'border-gray-100 bg-gray-100 cursor-not-allowed opacity-50'
                                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                                )}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold text-gray-800">
                                    {bed.bedNumber}
                                  </span>
                                  <StatusBadge type="bedType" status={bed.type} />
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  {bed.zone}区
                                  {bed.status !== 'idle' && (
                                    <span className="ml-1">
                                      · {bed.status === 'occupied' ? '占用' : bed.status === 'isolated' ? '隔离' : '待清'}
                                    </span>
                                  )}
                                </div>
                              </button>
                              {disabled && reason && (
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-800 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                  {reason}
                                  <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-0.5 border-4 border-transparent border-t-gray-800" />
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                    {errors.bedId && (
                      <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {errors.bedId}
                      </p>
                    )}
                  </div>

                  {overlapCheck && (
                    <div className="bg-red-100 border border-red-300 rounded-lg p-4 space-y-2">
                      <div className="flex items-start gap-2 text-red-800">
                        <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-semibold text-sm">时段冲突警告</p>
                          <p className="text-xs mt-1">该床位以下时段已有预约：</p>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        {overlapCheck.map((c) => (
                          <div
                            key={c.id}
                            className="flex items-center justify-between bg-white/70 rounded px-3 py-2 text-xs"
                          >
                            <span className="font-medium">
                              {formatTime(c.startTime)} - {formatTime(c.endTime)}
                            </span>
                            <StatusBadge type="appointment" status={c.status} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>
                        <Clock className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
                        时段 <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <select
                          value={slotId}
                          onChange={(e) => setSlotId(e.target.value)}
                          className={cn(
                            'w-full appearance-none pl-3 pr-9 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2',
                            errors.slotId
                              ? 'border-red-300 focus:ring-red-200 bg-red-50'
                              : 'border-gray-200 focus:ring-blue-200 focus:border-blue-400'
                          )}
                        >
                          <option value="">请选择时段</option>
                          {timeSlots
                            .filter((s) => s.active)
                            .map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.label} ({s.startTime}-{s.endTime})
                              </option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      </div>
                      {errors.slotId && (
                        <p className="text-xs text-red-500 mt-1">{errors.slotId}</p>
                      )}
                    </div>

                    <div>
                      <label className={labelClass}>
                        <CalendarIcon className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
                        日期 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={appointmentDate}
                        onChange={(e) => setAppointmentDate(e.target.value)}
                        min={today}
                        className={inputClass('appointmentDate')}
                      />
                      {errors.appointmentDate && (
                        <p className="text-xs text-red-500 mt-1">{errors.appointmentDate}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>开始时间</label>
                      <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className={inputClass('startTime')}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>结束时间</label>
                      <input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className={inputClass('endTime')}
                      />
                      {errors.endTime && (
                        <p className="text-xs text-red-500 mt-1">{errors.endTime}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>备注</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="请输入备注信息（可选）"
                      rows={3}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 resize-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-lg font-medium text-sm hover:bg-gray-50 transition-colors"
            >
              <X className="w-4 h-4" />
              取消
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className={cn(
                'inline-flex items-center gap-1.5 px-6 py-2.5 rounded-lg font-medium text-sm shadow-sm transition-all',
                submitting
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 hover:shadow-md'
              )}
            >
              <Send className="w-4 h-4" />
              {submitting ? '提交中...' : '提交预约'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
