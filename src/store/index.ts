import { create, type StateCreator } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Nurse,
  Bed,
  IsolationRule,
  TimeSlot,
  Patient,
  Appointment,
  Admission,
  CareNote,
  OperationLog,
  AbnormalRecord,
  CreateAppointmentPayload,
  ValidationResult,
  OperationType,
  OperationTargetType,
  AbnormalType,
  BedStatus,
  NurseRole,
  BedType,
  BackupFile,
  BackupData,
  RestorePreview,
  AutoBackupSnapshot,
  RestoreResult,
  RollbackResult,
  RestoreDiff,
  EntityDiff,
  ValidationIssue,
  BackupRestoreEntity,
} from '../types';
import { sampleData } from '../data/sampleData';
import { parseLocalTime } from '../lib/utils';

const STORE_KEY = 'dayward-board:v1';

const genId = (): string =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

type PersistedState = {
  currentUserId: string | null;
  beds: Bed[];
  nurses: Nurse[];
  isolationRules: IsolationRule[];
  timeSlots: TimeSlot[];
  patients: Patient[];
  appointments: Appointment[];
  admissions: Admission[];
  careNotes: CareNote[];
  operationLogs: OperationLog[];
  abnormalRecords: AbnormalRecord[];
  autoBackupSnapshots: AutoBackupSnapshot[];
};

type AppState = PersistedState & {
  currentUser: Nurse | null;
  currentNurse: Nurse | null;
  login: (nurseId: string, password: string) => boolean;
  logout: () => void;

  addBed: (bed: Omit<Bed, 'id' | 'createdAt'>) => void;
  updateBed: (id: string, patch: Partial<Bed>) => void;
  deleteBed: (id: string) => void;

  addNurse: (n: Omit<Nurse, 'id' | 'createdAt'>) => void;
  updateNurse: (id: string, patch: Partial<Nurse>) => void;
  updateNurseRole: (id: string, role: NurseRole) => void;
  deleteNurse: (id: string) => void;

  addIsolationRule: (r: Omit<IsolationRule, 'id' | 'createdAt'>) => void;
  updateIsolationRule: (id: string, patch: Partial<IsolationRule>) => void;
  deleteIsolationRule: (id: string) => void;

  addTimeSlot: (s: Omit<TimeSlot, 'id'>) => void;
  updateTimeSlot: (id: string, patch: Partial<TimeSlot>) => void;
  deleteTimeSlot: (id: string) => void;

  upsertPatient: (p: Omit<Patient, 'id' | 'createdAt'>) => Patient;

  createAppointment: (
    payload: CreateAppointmentPayload,
  ) => { success: boolean; error?: string; data?: Appointment };
  cancelAppointment: (
    appointmentId: string,
  ) => { success: boolean; error?: string };

  confirmAdmission: (
    appointmentId: string,
    nurseId: string,
  ) => { success: boolean; error?: string };
  dischargeBed: (
    admissionId: string,
    nurseId: string,
    force?: boolean,
  ) => { success: boolean; error?: string };
  markBedCleaned: (bedId: string) => void;

  addCareNote: (note: Omit<CareNote, 'id' | 'createdAt'>) => void;

  handleAbnormal: (abnormalId: string, nurseId: string) => void;

  importSampleData: () => void;
  exportDailyReport: (dateStr: string) => string;
  resetAllData: () => void;

  exportBackup: () => BackupFile;
  previewRestore: (backupFile: BackupFile) => RestorePreview;
  executeRestore: (backupFile: BackupFile) => RestoreResult;
  rollbackRestore: (snapshotId: string) => RollbackResult;
  createAutoSnapshot: (reason: string) => AutoBackupSnapshot;
  getLatestSnapshot: () => AutoBackupSnapshot | null;
  deleteSnapshot: (snapshotId: string) => void;
  clearOldSnapshots: (maxCount?: number) => void;
};

type StoreGet = () => AppState;
type StoreSet = (
  partial: Partial<AppState> | ((state: AppState) => Partial<AppState>),
) => void;

const initialPersisted: PersistedState = {
  currentUserId: null,
  beds: [],
  nurses: [],
  isolationRules: [],
  timeSlots: [],
  patients: [],
  appointments: [],
  admissions: [],
  careNotes: [],
  operationLogs: [],
  abnormalRecords: [],
  autoBackupSnapshots: [],
};

function deriveCurrentUser(state: PersistedState): Nurse | null {
  if (!state.currentUserId) return null;
  return state.nurses.find((n) => n.id === state.currentUserId) || null;
}

function addOperationLog(
  set: StoreSet,
  get: StoreGet,
  params: {
    type: OperationType;
    operator: Nurse | null;
    targetType: OperationTargetType;
    targetId?: string;
    targetName?: string;
    detail: string;
    isAbnormal?: boolean;
    abnormalReason?: string;
    approvedBy?: string;
  },
): string {
  const id = genId();
  const state = get();
  const operatorId = params.operator?.id ?? 'system';
  const operatorName = params.operator?.name ?? '系统';
  const log: OperationLog = {
    id,
    type: params.type,
    operatorId,
    operatorName,
    targetType: params.targetType,
    targetId: params.targetId,
    targetName: params.targetName,
    detail: params.detail,
    timestamp: Date.now(),
    approvedBy: params.approvedBy,
    isAbnormal: params.isAbnormal ?? false,
    abnormalReason: params.abnormalReason,
  };
  set({ operationLogs: [log, ...state.operationLogs] });
  return id;
}

function addAbnormalRecord(
  set: StoreSet,
  get: StoreGet,
  params: {
    type: AbnormalType;
    opLogId: string;
    desc: string;
    bedId?: string;
    appointmentId?: string;
  },
): string {
  const id = genId();
  const state = get();
  const record: AbnormalRecord = {
    id,
    type: params.type,
    operationLogId: params.opLogId,
    description: params.desc,
    bedId: params.bedId,
    appointmentId: params.appointmentId,
    handled: false,
    createdAt: Date.now(),
  };
  set({ abnormalRecords: [record, ...state.abnormalRecords] });
  return id;
}

function validateAppointmentOverlap(
  state: AppState,
  bedId: string,
  startTs: number,
  endTs: number,
  excludeAppointmentId?: string,
): ValidationResult {
  const conflicts = state.appointments.filter(
    (a) =>
      a.bedId === bedId &&
      a.id !== excludeAppointmentId &&
      a.status !== 'cancelled' &&
      startTs < a.endTime &&
      endTs > a.startTime,
  );
  if (conflicts.length > 0) {
    return { success: false, error: '该时段与已有预约重叠' };
  }
  return { success: true };
}

function validateIsolationCompliance(
  state: AppState,
  bedId: string,
  isolationRuleId?: string,
): ValidationResult {
  if (!isolationRuleId) return { success: true };
  const bed = state.beds.find((b) => b.id === bedId);
  const rule = state.isolationRules.find((r) => r.id === isolationRuleId);
  if (!bed || !rule) return { success: true };
  if (bed.type !== rule.requiredBedType) {
    const typeMap: Record<BedType, string> = {
      normal: '普通',
      negative: '负压',
      wheelchair: '轮椅位',
    };
    return {
      success: false,
      error: `该传染病需使用${typeMap[rule.requiredBedType]}类型床位`,
    };
  }
  return { success: true };
}

const buildStore = (set: StoreSet, get: StoreGet): AppState => {
  const helpers = {
    opLog: (
      type: OperationType,
      targetType: OperationTargetType,
      detail: string,
      opts?: {
        targetId?: string;
        targetName?: string;
        isAbnormal?: boolean;
        abnormalReason?: string;
        approvedBy?: string;
      },
    ) =>
      addOperationLog(set, get, {
        type,
        operator: get().currentUser,
        targetType,
        detail,
        targetId: opts?.targetId,
        targetName: opts?.targetName,
        isAbnormal: opts?.isAbnormal,
        abnormalReason: opts?.abnormalReason,
        approvedBy: opts?.approvedBy,
      }),
    abnRec: (
      type: AbnormalType,
      opLogId: string,
      desc: string,
      opts?: { bedId?: string; appointmentId?: string },
    ) =>
      addAbnormalRecord(set, get, {
        type,
        opLogId,
        desc,
        bedId: opts?.bedId,
        appointmentId: opts?.appointmentId,
      }),
  };

  return {
    ...initialPersisted,
    currentUser: null,
    currentNurse: null,

    login: (nurseId, password): boolean => {
      const state = get();
      const nurse = state.nurses.find((n) => n.id === nurseId);
      if (!nurse || nurse.password !== password) return false;
      set({ currentUserId: nurse.id, currentUser: nurse, currentNurse: nurse });
      helpers.opLog(
        'role_config_change',
        'nurse',
        `${nurse.name} 登录系统`,
        { targetId: nurse.id, targetName: nurse.name },
      );
      return true;
    },

    logout: () => {
      const user = get().currentUser;
      if (user) {
        helpers.opLog(
          'role_config_change',
          'nurse',
          `${user.name} 退出系统`,
          { targetId: user.id, targetName: user.name },
        );
      }
      set({ currentUserId: null, currentUser: null, currentNurse: null });
    },

    addBed: (bed) => {
      const id = genId();
      const newBed: Bed = { ...bed, id, createdAt: Date.now() };
      set({ beds: [...get().beds, newBed] });
      helpers.opLog(
        'bed_config_change',
        'bed',
        `新增床位 ${bed.bedNumber}（${bed.zone}）`,
        { targetId: id, targetName: bed.bedNumber },
      );
    },

    updateBed: (id, patch) => {
      const state = get();
      const target = state.beds.find((b) => b.id === id);
      set({
        beds: state.beds.map((b) => (b.id === id ? { ...b, ...patch } : b)),
      });
      if (target) {
        helpers.opLog(
          'bed_config_change',
          'bed',
          `修改床位 ${target.bedNumber}`,
          {
            targetId: id,
            targetName: patch.bedNumber ?? target.bedNumber,
          },
        );
      }
    },

    deleteBed: (id) => {
      const state = get();
      const target = state.beds.find((b) => b.id === id);
      set({ beds: state.beds.filter((b) => b.id !== id) });
      if (target) {
        helpers.opLog(
          'bed_config_change',
          'bed',
          `删除床位 ${target.bedNumber}`,
          { targetId: id, targetName: target.bedNumber },
        );
      }
    },

    addNurse: (n) => {
      const id = genId();
      const newNurse: Nurse = { ...n, id, createdAt: Date.now() };
      set({ nurses: [...get().nurses, newNurse] });
      const roleLabel =
        n.role === 'admin'
          ? '管理员'
          : n.role === 'senior'
            ? '高级护士'
            : '普通护士';
      helpers.opLog(
        'role_config_change',
        'nurse',
        `新增护士 ${n.name}（${roleLabel}）`,
        { targetId: id, targetName: n.name },
      );
    },

    updateNurse: (id, patch) => {
      const state = get();
      const target = state.nurses.find((n) => n.id === id);
      if (!target) return;
      const updated: Nurse = { ...target, ...patch };
      set({
        nurses: state.nurses.map((n) => (n.id === id ? updated : n)),
      });
      if (state.currentUserId === id) {
        set({ currentUser: updated, currentNurse: updated });
      }
      helpers.opLog(
        'role_config_change',
        'nurse',
        `修改护士 ${target.name}`,
        { targetId: id, targetName: patch.name ?? target.name },
      );
    },

    updateNurseRole: (id, role) => {
      get().updateNurse(id, { role });
    },

    deleteNurse: (id) => {
      const state = get();
      const target = state.nurses.find((n) => n.id === id);
      set({ nurses: state.nurses.filter((n) => n.id !== id) });
      if (state.currentUserId === id) {
        set({ currentUserId: null, currentUser: null, currentNurse: null });
      }
      if (target) {
        helpers.opLog(
          'role_config_change',
          'nurse',
          `删除护士 ${target.name}`,
          { targetId: id, targetName: target.name },
        );
      }
    },

    addIsolationRule: (r) => {
      const id = genId();
      const newRule: IsolationRule = { ...r, id, createdAt: Date.now() };
      set({ isolationRules: [...get().isolationRules, newRule] });
      helpers.opLog(
        'bed_config_change',
        'isolation_rule',
        `新增隔离规则：${r.disease}`,
        { targetId: id, targetName: r.disease },
      );
    },

    updateIsolationRule: (id, patch) => {
      const state = get();
      const target = state.isolationRules.find((r) => r.id === id);
      set({
        isolationRules: state.isolationRules.map((r) =>
          r.id === id ? { ...r, ...patch } : r,
        ),
      });
      if (target) {
        helpers.opLog(
          'bed_config_change',
          'isolation_rule',
          `修改隔离规则：${target.disease}`,
          {
            targetId: id,
            targetName: patch.disease ?? target.disease,
          },
        );
      }
    },

    deleteIsolationRule: (id) => {
      const state = get();
      const target = state.isolationRules.find((r) => r.id === id);
      set({
        isolationRules: state.isolationRules.filter((r) => r.id !== id),
      });
      if (target) {
        helpers.opLog(
          'bed_config_change',
          'isolation_rule',
          `删除隔离规则：${target.disease}`,
          { targetId: id, targetName: target.disease },
        );
      }
    },

    addTimeSlot: (s) => {
      const id = genId();
      const newSlot: TimeSlot = { ...s, id };
      set({ timeSlots: [...get().timeSlots, newSlot] });
      helpers.opLog(
        'bed_config_change',
        'time_slot',
        `新增时段：${s.label} ${s.startTime}-${s.endTime}`,
        { targetId: id, targetName: s.label },
      );
    },

    updateTimeSlot: (id, patch) => {
      const state = get();
      const target = state.timeSlots.find((t) => t.id === id);
      set({
        timeSlots: state.timeSlots.map((t) =>
          t.id === id ? { ...t, ...patch } : t,
        ),
      });
      if (target) {
        helpers.opLog(
          'bed_config_change',
          'time_slot',
          `修改时段：${target.label}`,
          { targetId: id, targetName: patch.label ?? target.label },
        );
      }
    },

    deleteTimeSlot: (id) => {
      const state = get();
      const target = state.timeSlots.find((t) => t.id === id);
      set({ timeSlots: state.timeSlots.filter((t) => t.id !== id) });
      if (target) {
        helpers.opLog(
          'bed_config_change',
          'time_slot',
          `删除时段：${target.label}`,
          { targetId: id, targetName: target.label },
        );
      }
    },

    upsertPatient: (p) => {
      const state = get();
      let patient: Patient;
      const existing = state.patients.find(
        (x) =>
          (p.phone && x.phone === p.phone) ||
          (x.name === p.name && (!p.phone || !x.phone)),
      );
      if (existing) {
        patient = { ...existing, ...p };
        set({
          patients: state.patients.map((x) =>
            x.id === existing.id ? patient : x,
          ),
        });
        helpers.opLog(
          'bed_config_change',
          'patient',
          `更新患者信息：${patient.name}`,
          { targetId: patient.id, targetName: patient.name },
        );
      } else {
        const id = genId();
        patient = { ...p, id, createdAt: Date.now() };
        set({ patients: [...state.patients, patient] });
        helpers.opLog(
          'bed_config_change',
          'patient',
          `新增患者：${p.name}`,
          { targetId: id, targetName: p.name },
        );
      }
      return patient;
    },

    createAppointment: (payload) => {
      const currentUser = get().currentUser;

      let patientId = payload.patientId;
      if (!patientId && payload.patientInfo) {
        const patient = get().upsertPatient(payload.patientInfo);
        patientId = patient.id;
      }
      if (!patientId) {
        return { success: false, error: '患者信息缺失' };
      }

      const bedNum = get().beds.find((b) => b.id === payload.bedId)
        ?.bedNumber;

      if (payload.endTime <= payload.startTime) {
        const opLogId = helpers.opLog(
          'appointment_create',
          'appointment',
          '结束时间必须晚于开始时间',
          {
            targetName: bedNum,
            isAbnormal: true,
            abnormalReason: 'data_conflict',
          },
        );
        helpers.abnRec(
          'data_conflict',
          opLogId,
          '结束时间必须晚于开始时间',
          { bedId: payload.bedId },
        );
        return { success: false, error: '结束时间必须晚于开始时间' };
      }

      const overlapCheck = validateAppointmentOverlap(
        get(),
        payload.bedId,
        payload.startTime,
        payload.endTime,
      );
      if (!overlapCheck.success) {
        const opLogId = helpers.opLog(
          'appointment_create',
          'appointment',
          overlapCheck.error ?? '',
          {
            targetName: bedNum,
            isAbnormal: true,
            abnormalReason: 'time_overlap',
          },
        );
        helpers.abnRec('time_overlap', opLogId, overlapCheck.error ?? '预约时段重叠', {
          bedId: payload.bedId,
        });
        return { success: false, error: overlapCheck.error };
      }

      const isoCheck = validateIsolationCompliance(
        get(),
        payload.bedId,
        payload.isolationRuleId,
      );
      if (!isoCheck.success) {
        const opLogId = helpers.opLog(
          'appointment_create',
          'appointment',
          isoCheck.error ?? '',
          {
            targetName: bedNum,
            isAbnormal: true,
            abnormalReason: 'isolation_violation',
          },
        );
        helpers.abnRec(
          'isolation_violation',
          opLogId,
          isoCheck.error ?? '隔离规则不合规',
          { bedId: payload.bedId },
        );
        return { success: false, error: isoCheck.error };
      }

      const id = genId();
      const patient = get().patients.find((p) => p.id === patientId);
      const appointment: Appointment = {
        id,
        patientId: patientId,
        bedId: payload.bedId,
        slotId: payload.slotId,
        appointmentDate: payload.appointmentDate,
        startTime: payload.startTime,
        endTime: payload.endTime,
        isolationRuleId: payload.isolationRuleId,
        status: 'pending',
        createdBy: payload.createdBy,
        createdAt: Date.now(),
      };
      set({ appointments: [...get().appointments, appointment] });
      helpers.opLog(
        'appointment_create',
        'appointment',
        `创建预约：${patient?.name ?? ''} → ${bedNum ?? ''}`,
        {
          targetId: id,
          targetName: `${bedNum ?? ''} ${patient?.name ?? ''}`,
        },
      );
      return { success: true, data: appointment };
    },

    cancelAppointment: (appointmentId) => {
      const state = get();
      const apt = state.appointments.find((a) => a.id === appointmentId);
      if (!apt) return { success: false, error: '预约不存在' };
      set({
        appointments: state.appointments.map((a) =>
          a.id === appointmentId ? { ...a, status: 'cancelled' } : a,
        ),
      });
      const patient = state.patients.find((p) => p.id === apt.patientId);
      const bed = state.beds.find((b) => b.id === apt.bedId);
      helpers.opLog(
        'appointment_cancel',
        'appointment',
        `取消预约：${patient?.name ?? ''} → ${bed?.bedNumber ?? ''}`,
        {
          targetId: appointmentId,
          targetName: `${bed?.bedNumber ?? ''} ${patient?.name ?? ''}`,
        },
      );
      return { success: true };
    },

    confirmAdmission: (appointmentId, nurseId) => {
      const state = get();
      const apt = state.appointments.find((a) => a.id === appointmentId);
      if (!apt) return { success: false, error: '预约不存在' };
      if (apt.status !== 'pending') {
        return { success: false, error: '预约状态不正确' };
      }
      const nurse = state.nurses.find((n) => n.id === nurseId);
      if (!nurse) return { success: false, error: '护士不存在' };

      const bed = state.beds.find((b) => b.id === apt.bedId);
      const patient = state.patients.find((p) => p.id === apt.patientId);

      if (bed && (bed.status === 'occupied' || bed.status === 'isolated')) {
        const opLogId = helpers.opLog(
          'admission_confirm',
          'admission',
          `床位 ${bed.bedNumber} 当前已被占用，不可重复入床`,
          {
            targetId: appointmentId,
            targetName: bed.bedNumber,
            isAbnormal: true,
            abnormalReason: 'time_overlap',
          },
        );
        helpers.abnRec(
          'time_overlap',
          opLogId,
          `床位 ${bed.bedNumber} 已被占用，入床失败`,
          { bedId: apt.bedId },
        );
        return {
          success: false,
          error: `该床位当前已被占用（${bed.status === 'isolated' ? '隔离中' : '使用中'}），请先处理现有患者`,
        };
      }

      const conflictingAdmission = state.admissions.find(
        (a) => a.bedId === apt.bedId && a.status === 'in_bed',
      );
      if (conflictingAdmission) {
        const opLogId = helpers.opLog(
          'admission_confirm',
          'admission',
          `该床位存在未完成的在床记录，不可重复入床`,
          {
            targetId: appointmentId,
            targetName: bed?.bedNumber,
            isAbnormal: true,
            abnormalReason: 'time_overlap',
          },
        );
        helpers.abnRec(
          'time_overlap',
          opLogId,
          '该床位存在未完成的在床记录',
          { bedId: apt.bedId },
        );
        return {
          success: false,
          error: '该床位存在未完成的在床记录，不可重复入床',
        };
      }

      const id = genId();
      const admission: Admission = {
        id,
        appointmentId: apt.id,
        patientId: apt.patientId,
        bedId: apt.bedId,
        admittedAt: Date.now(),
        status: 'in_bed',
        admittedBy: nurseId,
        createdAt: Date.now(),
      };
      const newBedStatus: BedStatus = apt.isolationRuleId
        ? 'isolated'
        : 'occupied';
      set({
        appointments: state.appointments.map((a) =>
          a.id === appointmentId ? { ...a, status: 'admitted' } : a,
        ),
        admissions: [...state.admissions, admission],
        beds: state.beds.map((b) =>
          b.id === apt.bedId
            ? {
                ...b,
                status: newBedStatus,
                currentPatientId: apt.patientId,
                currentAdmissionId: id,
              }
            : b,
        ),
      });
      helpers.opLog(
        'admission_confirm',
        'admission',
        `确认入床：${patient?.name ?? ''} → ${bed?.bedNumber ?? ''}`,
        {
          targetId: id,
          targetName: `${bed?.bedNumber ?? ''} ${patient?.name ?? ''}`,
        },
      );
      return { success: true };
    },

    dischargeBed: (admissionId, nurseId, force = false) => {
      const state = get();
      const admission = state.admissions.find((a) => a.id === admissionId);
      if (!admission) return { success: false, error: '入床记录不存在' };
      if (admission.status !== 'in_bed') {
        return { success: false, error: '当前状态不可出床' };
      }
      const nurse = state.nurses.find((n) => n.id === nurseId);
      if (!nurse) return { success: false, error: '护士不存在' };
      const bed = state.beds.find((b) => b.id === admission.bedId);
      const patient = state.patients.find((p) => p.id === admission.patientId);

      if (force && nurse.role === 'normal') {
        const opLogId = helpers.opLog(
          'discharge_force',
          'admission',
          '普通护士无权强制释放占用床位',
          {
            targetId: admissionId,
            targetName: bed?.bedNumber,
            isAbnormal: true,
            abnormalReason: 'force_release_denied',
          },
        );
        helpers.abnRec(
          'force_release_denied',
          opLogId,
          '普通护士无权强制释放占用床位',
          { bedId: admission.bedId },
        );
        return {
          success: false,
          error: '普通护士无权强制释放占用床位',
        };
      }

      const dischargedAt = Date.now();
      if (!force && dischargedAt < admission.admittedAt) {
        const opLogId = helpers.opLog(
          'discharge_normal',
          'admission',
          '出床时间不能早于入床时间',
          {
            targetId: admissionId,
            targetName: bed?.bedNumber,
            isAbnormal: true,
            abnormalReason: 'discharge_before_admit',
          },
        );
        helpers.abnRec(
          'discharge_before_admit',
          opLogId,
          '出床时间不能早于入床时间',
          { bedId: admission.bedId },
        );
        return {
          success: false,
          error: '出床时间不能早于入床时间',
        };
      }

      const newStatus = force ? 'force_released' : 'discharged';
      const logType = force ? 'discharge_force' : 'discharge_normal';
      set({
        admissions: state.admissions.map((a) =>
          a.id === admissionId
            ? {
                ...a,
                status: newStatus,
                dischargedAt,
                dischargedBy: nurseId,
                approvedBy: force ? nurseId : undefined,
                forceReleased: force,
              }
            : a,
        ),
        appointments: state.appointments.map((apt) =>
          apt.id === admission.appointmentId
            ? { ...apt, status: 'completed' }
            : apt,
        ),
        beds: state.beds.map((b) =>
          b.id === admission.bedId
            ? {
                ...b,
                status: 'cleaning',
                currentPatientId: undefined,
                currentAdmissionId: undefined,
              }
            : b,
        ),
      });
      helpers.opLog(
        logType,
        'admission',
        force
          ? `强制释放：${patient?.name ?? ''} 出床 ${bed?.bedNumber ?? ''}`
          : `正常出床：${patient?.name ?? ''} → ${bed?.bedNumber ?? ''}`,
        {
          targetId: admissionId,
          targetName: `${bed?.bedNumber ?? ''} ${patient?.name ?? ''}`,
          approvedBy: force ? nurseId : undefined,
        },
      );
      return { success: true };
    },

    markBedCleaned: (bedId) => {
      const state = get();
      const bed = state.beds.find((b) => b.id === bedId);
      set({
        beds: state.beds.map((b) =>
          b.id === bedId ? { ...b, status: 'idle' } : b,
        ),
      });
      if (bed) {
        helpers.opLog(
          'bed_config_change',
          'bed',
          `床位 ${bed.bedNumber} 清理完成，状态变为空闲`,
          { targetId: bedId, targetName: bed.bedNumber },
        );
      }
    },

    addCareNote: (note) => {
      const id = genId();
      const state = get();
      const careNote: CareNote = { ...note, id, createdAt: Date.now() };
      set({ careNotes: [...state.careNotes, careNote] });
      const admission = state.admissions.find(
        (a) => a.id === note.admissionId,
      );
      const bed = admission
        ? state.beds.find((b) => b.id === admission.bedId)
        : undefined;
      const patient = admission
        ? state.patients.find((p) => p.id === admission.patientId)
        : undefined;
      const nurse = state.nurses.find((n) => n.id === note.nurseId);
      helpers.opLog(
        'care_note_add',
        'care_note',
        `添加护理备注：${note.content.slice(0, 50)}`,
        {
          targetId: id,
          targetName: `${bed?.bedNumber ?? ''} ${patient?.name ?? ''}`,
        },
      );
      void nurse;
    },

    handleAbnormal: (abnormalId, nurseId) => {
      const state = get();
      const nurse = state.nurses.find((n) => n.id === nurseId);
      const record = state.abnormalRecords.find(
        (r) => r.id === abnormalId,
      );
      set({
        abnormalRecords: state.abnormalRecords.map((r) =>
          r.id === abnormalId
            ? {
                ...r,
                handled: true,
                handledBy: nurseId,
                handledAt: Date.now(),
              }
            : r,
        ),
      });
      if (record) {
        helpers.opLog(
          'role_config_change',
          'system',
          `处理异常记录：${record.description}`,
          {
            targetId: abnormalId,
            targetName: record.type,
          },
        );
      }
      void nurse;
    },

    importSampleData: () => {
      const importLog: OperationLog = {
        id: genId(),
        type: 'data_import',
        operatorId: 'system',
        operatorName: '系统',
        targetType: 'system',
        detail: '导入样例数据',
        timestamp: Date.now(),
        isAbnormal: false,
      };
      set({
        beds: [...sampleData.beds],
        nurses: [...sampleData.nurses],
        isolationRules: [...sampleData.isolationRules],
        timeSlots: [...sampleData.timeSlots],
        patients: [...sampleData.patients],
        appointments: [...sampleData.appointments],
        admissions: [...sampleData.admissions],
        careNotes: [...sampleData.careNotes],
        operationLogs: [importLog, ...sampleData.operationLogs],
        abnormalRecords: [...sampleData.abnormalRecords],
        currentUserId: null,
        currentUser: null,
        currentNurse: null,
      });
    },

    exportDailyReport: (dateStr) => {
      const state = get();
      const dayStart = parseLocalTime(dateStr, '00:00');
      const dayEnd = dayStart + 24 * 60 * 60 * 1000;

      const rows: string[][] = [];
      const header = [
        '床位号',
        '区域',
        '患者姓名',
        '性别',
        '年龄',
        '诊断',
        '入床时间',
        '出床时间',
        '总时长(小时)',
        '护理次数',
        '护士',
        '是否隔离',
        '异常标记',
      ];
      rows.push(header);

      const targetAdmissions = state.admissions.filter(
        (a) => a.admittedAt >= dayStart && a.admittedAt < dayEnd,
      );

      for (const adm of targetAdmissions) {
        const bed = state.beds.find((b) => b.id === adm.bedId);
        const patient = state.patients.find(
          (p) => p.id === adm.patientId,
        );
        const nurse = state.nurses.find((n) => n.id === adm.admittedBy);
        const apt = adm.appointmentId
          ? state.appointments.find((a) => a.id === adm.appointmentId)
          : undefined;
        const isIsolation = apt?.isolationRuleId ? '是' : '否';
        const careCount = state.careNotes.filter(
          (n) => n.admissionId === adm.id,
        ).length;
        let hours: number;
        if (adm.dischargedAt) {
          hours = (adm.dischargedAt - adm.admittedAt) / (1000 * 60 * 60);
        } else {
          const now = Date.now();
          hours = now > adm.admittedAt ? (now - adm.admittedAt) / (1000 * 60 * 60) : 0;
        }
        const hasAbnormal = state.abnormalRecords.some(
          (r) => r.bedId === adm.bedId,
        )
          ? '有'
          : '';
        rows.push([
          bed?.bedNumber ?? '',
          bed?.zone ?? '',
          patient?.name ?? '',
          patient?.gender === 'male' ? '男' : '女',
          String(patient?.age ?? ''),
          patient?.diagnosis ?? '',
          new Date(adm.admittedAt).toLocaleString('zh-CN', {
            hour12: false,
          }),
          adm.dischargedAt
            ? new Date(adm.dischargedAt).toLocaleString('zh-CN', {
                hour12: false,
              })
            : '',
          hours.toFixed(2),
          String(careCount),
          nurse?.name ?? '',
          isIsolation,
          hasAbnormal,
        ]);
      }

      const csv =
        '\ufeff' +
        rows
          .map((r) =>
            r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','),
          )
          .join('\r\n');
      helpers.opLog(
        'data_export',
        'system',
        `导出 ${dateStr} 日周转表`,
      );
      return csv;
    },

    resetAllData: () => {
      set({
        ...initialPersisted,
        currentUser: null,
        currentNurse: null,
      });
    },

    exportBackup: (): BackupFile => {
      const state = get();
      const backupData: BackupData = {
        beds: JSON.parse(JSON.stringify(state.beds)),
        nurses: JSON.parse(JSON.stringify(state.nurses)),
        isolationRules: JSON.parse(JSON.stringify(state.isolationRules)),
        timeSlots: JSON.parse(JSON.stringify(state.timeSlots)),
        patients: JSON.parse(JSON.stringify(state.patients)),
        appointments: JSON.parse(JSON.stringify(state.appointments)),
        admissions: JSON.parse(JSON.stringify(state.admissions)),
        careNotes: JSON.parse(JSON.stringify(state.careNotes)),
        operationLogs: JSON.parse(JSON.stringify(state.operationLogs)),
        abnormalRecords: JSON.parse(JSON.stringify(state.abnormalRecords)),
      };
      const backupFile: BackupFile = {
        version: 'v1',
        exportedAt: new Date().toISOString(),
        data: backupData,
      };
      helpers.opLog('backup_export', 'system', '导出备份文件');
      return backupFile;
    },

    previewRestore: (backupFile: BackupFile): RestorePreview => {
      const state = get();
      const currentUser = state.currentUser;

      const issues: ValidationIssue[] = [];

      if (!currentUser || currentUser.role !== 'admin') {
        issues.push({
          type: 'backup_permission_denied',
          severity: 'error',
          message: '只有管理员可以执行数据恢复操作',
        });
      }

      if (!backupFile.version || !['v1'].includes(backupFile.version)) {
        issues.push({
          type: 'backup_version_unknown',
          severity: 'error',
          message: `无法识别的备份版本: ${backupFile.version || '未知'}，仅支持 v1 版本`,
        });
      }

      if (!backupFile.exportedAt) {
        issues.push({
          type: 'backup_missing_required_field',
          severity: 'error',
          message: '备份文件缺少导出时间字段',
        });
      }

      const data = backupFile.data;
      if (!data) {
        issues.push({
          type: 'backup_missing_required_field',
          severity: 'error',
          message: '备份文件缺少数据字段',
        });
      } else {
        const requiredFields: (keyof BackupData)[] = ['beds', 'nurses', 'patients', 'appointments', 'admissions'];
        for (const field of requiredFields) {
          if (!Array.isArray(data[field])) {
            issues.push({
              type: 'backup_missing_required_field',
              severity: 'error',
              message: `备份文件缺少必需字段: ${field}`,
            });
          }
        }

        if (Array.isArray(data.beds)) {
          const bedNumberSet = new Set<string>();
          const duplicateBeds: string[] = [];
          for (const bed of data.beds) {
            if (!bed.bedNumber) {
              issues.push({
                type: 'backup_missing_required_field',
                severity: 'error',
                message: `床位 ${bed.id || '未知'} 缺少床位编号`,
              });
            } else if (bedNumberSet.has(bed.bedNumber)) {
              duplicateBeds.push(bed.bedNumber);
            } else {
              bedNumberSet.add(bed.bedNumber);
            }
          }
          if (duplicateBeds.length > 0) {
            issues.push({
              type: 'backup_bed_number_conflict',
              severity: 'error',
              message: `备份文件中存在重复的床位编号`,
              details: duplicateBeds,
            });
          }
        }

        if (Array.isArray(data.admissions)) {
          const inBedPatients = new Map<string, string[]>();
          for (const adm of data.admissions) {
            if (adm.status === 'in_bed') {
              if (!inBedPatients.has(adm.patientId)) {
                inBedPatients.set(adm.patientId, []);
              }
              inBedPatients.get(adm.patientId)!.push(adm.bedId);
            }
          }
          const duplicateAdmissions: string[] = [];
          for (const [patientId, bedIds] of inBedPatients) {
            if (bedIds.length > 1) {
              const patient = data.patients?.find((p) => p.id === patientId);
              duplicateAdmissions.push(
                `患者 ${patient?.name || patientId} 同时在 ${bedIds.length} 个床位`,
              );
            }
          }
          if (duplicateAdmissions.length > 0) {
            issues.push({
              type: 'backup_patient_duplicate_admission',
              severity: 'error',
              message: `备份文件中存在同一患者同时在多个床位的情况`,
              details: duplicateAdmissions,
            });
          }
        }
      }

      const dataOverview: Record<BackupRestoreEntity, number> = {
        beds: data?.beds?.length ?? 0,
        nurses: data?.nurses?.length ?? 0,
        isolationRules: data?.isolationRules?.length ?? 0,
        timeSlots: data?.timeSlots?.length ?? 0,
        patients: data?.patients?.length ?? 0,
        appointments: data?.appointments?.length ?? 0,
        admissions: data?.admissions?.length ?? 0,
        careNotes: data?.careNotes?.length ?? 0,
        operationLogs: data?.operationLogs?.length ?? 0,
        abnormalRecords: data?.abnormalRecords?.length ?? 0,
      };

      const entityKeys: BackupRestoreEntity[] = [
        'beds', 'nurses', 'isolationRules', 'timeSlots', 'patients',
        'appointments', 'admissions', 'careNotes', 'operationLogs', 'abnormalRecords',
      ];

      const diff: RestoreDiff = {} as RestoreDiff;
      for (const key of entityKeys) {
        const current = state[key] as any[];
        const backup = (data?.[key] as any[]) ?? [];
        const currentIds = new Set(current.map((item) => item.id));
        const backupIds = new Set(backup.map((item) => item.id));

        let added = 0, updated = 0, deleted = 0;
        for (const item of backup) {
          if (!currentIds.has(item.id)) {
            added++;
          } else {
            const currentItem = current.find((c) => c.id === item.id);
            if (JSON.stringify(currentItem) !== JSON.stringify(item)) {
              updated++;
            }
          }
        }
        for (const id of currentIds) {
          if (!backupIds.has(id)) {
            deleted++;
          }
        }
        diff[key] = { added, updated, deleted };
      }

      const canRestore = issues.filter((i) => i.severity === 'error').length === 0;

      helpers.opLog(
        'backup_restore_preview',
        'system',
        `预检备份文件: ${backupFile.version}, 导出时间: ${backupFile.exportedAt}`,
        { isAbnormal: !canRestore },
      );

      return {
        version: backupFile.version,
        exportedAt: backupFile.exportedAt,
        dataOverview,
        diff,
        issues,
        canRestore,
      };
    },

    executeRestore: (backupFile: BackupFile): RestoreResult => {
      const state = get();
      const currentUser = state.currentUser;

      if (!currentUser || currentUser.role !== 'admin') {
        return {
          success: false,
          message: '只有管理员可以执行数据恢复操作',
          error: 'permission_denied',
        };
      }

      const preview = state.previewRestore(backupFile);
      if (!preview.canRestore) {
        const errors = preview.issues.filter((i) => i.severity === 'error').map((i) => i.message);
        return {
          success: false,
          message: `备份文件校验失败: ${errors.join('; ')}`,
          error: 'validation_failed',
        };
      }

      const snapshot = state.createAutoSnapshot('恢复前自动备份');

      const data = backupFile.data;
      const newNurses = JSON.parse(JSON.stringify(data.nurses ?? []));
      const adminStillExists = newNurses.find(
        (n: Nurse) => n.id === currentUser.id && n.role === 'admin',
      );

      set({
        beds: JSON.parse(JSON.stringify(data.beds ?? [])),
        nurses: newNurses,
        isolationRules: JSON.parse(JSON.stringify(data.isolationRules ?? [])),
        timeSlots: JSON.parse(JSON.stringify(data.timeSlots ?? [])),
        patients: JSON.parse(JSON.stringify(data.patients ?? [])),
        appointments: JSON.parse(JSON.stringify(data.appointments ?? [])),
        admissions: JSON.parse(JSON.stringify(data.admissions ?? [])),
        careNotes: JSON.parse(JSON.stringify(data.careNotes ?? [])),
        abnormalRecords: JSON.parse(JSON.stringify(data.abnormalRecords ?? [])),
        currentUserId: adminStillExists ? currentUser.id : null,
        currentUser: adminStillExists ? adminStillExists : null,
        currentNurse: adminStillExists ? adminStillExists : null,
      });

      const newState = get();
      const restoreLog: OperationLog = {
        id: genId(),
        type: 'backup_restore',
        operatorId: currentUser.id,
        operatorName: currentUser.name,
        targetType: 'system',
        detail: `数据恢复成功，备份版本: ${backupFile.version}，导出时间: ${backupFile.exportedAt}，自动快照ID: ${snapshot.id}`,
        timestamp: Date.now(),
        isAbnormal: false,
      };
      set({
        operationLogs: [restoreLog, ...newState.operationLogs],
      });

      state.clearOldSnapshots(10);

      return {
        success: true,
        message: '数据恢复成功',
        snapshotId: snapshot.id,
        adminSessionPreserved: !!adminStillExists,
      };
    },

    rollbackRestore: (snapshotId: string): RollbackResult => {
      const state = get();
      const currentUser = state.currentUser;

      if (!currentUser || currentUser.role !== 'admin') {
        return {
          success: false,
          message: '只有管理员可以执行回滚操作',
          error: 'permission_denied',
        };
      }

      const snapshot = state.autoBackupSnapshots.find((s) => s.id === snapshotId);
      if (!snapshot) {
        return {
          success: false,
          message: `未找到快照: ${snapshotId}`,
          error: 'snapshot_not_found',
        };
      }

      const beforeRollbackSnapshot = state.createAutoSnapshot('回滚前自动备份');

      const data = snapshot.data;
      const newNurses = JSON.parse(JSON.stringify(data.nurses ?? []));
      const adminStillExists = newNurses.find(
        (n: Nurse) => n.id === currentUser.id && n.role === 'admin',
      );

      set({
        beds: JSON.parse(JSON.stringify(data.beds ?? [])),
        nurses: newNurses,
        isolationRules: JSON.parse(JSON.stringify(data.isolationRules ?? [])),
        timeSlots: JSON.parse(JSON.stringify(data.timeSlots ?? [])),
        patients: JSON.parse(JSON.stringify(data.patients ?? [])),
        appointments: JSON.parse(JSON.stringify(data.appointments ?? [])),
        admissions: JSON.parse(JSON.stringify(data.admissions ?? [])),
        careNotes: JSON.parse(JSON.stringify(data.careNotes ?? [])),
        abnormalRecords: JSON.parse(JSON.stringify(data.abnormalRecords ?? [])),
        currentUserId: adminStillExists ? currentUser.id : null,
        currentUser: adminStillExists ? adminStillExists : null,
        currentNurse: adminStillExists ? adminStillExists : null,
      });

      const newState = get();
      const rollbackLog: OperationLog = {
        id: genId(),
        type: 'backup_restore_rollback',
        operatorId: currentUser.id,
        operatorName: currentUser.name,
        targetType: 'system',
        detail: `数据回滚成功，快照ID: ${snapshotId}，快照名称: ${snapshot.name}，回滚前快照ID: ${beforeRollbackSnapshot.id}`,
        timestamp: Date.now(),
        isAbnormal: false,
      };
      set({
        operationLogs: [rollbackLog, ...newState.operationLogs],
      });

      return {
        success: true,
        message: '数据回滚成功',
        adminSessionPreserved: !!adminStillExists,
      };
    },

    createAutoSnapshot: (reason: string): AutoBackupSnapshot => {
      const state = get();
      const snapshot: AutoBackupSnapshot = {
        id: genId(),
        createdAt: Date.now(),
        name: `${reason} - ${new Date().toLocaleString('zh-CN', { hour12: false })}`,
        data: {
          beds: JSON.parse(JSON.stringify(state.beds)),
          nurses: JSON.parse(JSON.stringify(state.nurses)),
          isolationRules: JSON.parse(JSON.stringify(state.isolationRules)),
          timeSlots: JSON.parse(JSON.stringify(state.timeSlots)),
          patients: JSON.parse(JSON.stringify(state.patients)),
          appointments: JSON.parse(JSON.stringify(state.appointments)),
          admissions: JSON.parse(JSON.stringify(state.admissions)),
          careNotes: JSON.parse(JSON.stringify(state.careNotes)),
          operationLogs: JSON.parse(JSON.stringify(state.operationLogs)),
          abnormalRecords: JSON.parse(JSON.stringify(state.abnormalRecords)),
        },
      };

      const snapshotLog: OperationLog = {
        id: genId(),
        type: 'backup_auto_snapshot',
        operatorId: state.currentUser?.id ?? 'system',
        operatorName: state.currentUser?.name ?? '系统',
        targetType: 'system',
        detail: `创建自动快照: ${snapshot.name}，快照ID: ${snapshot.id}`,
        timestamp: Date.now(),
        isAbnormal: false,
      };

      set({
        autoBackupSnapshots: [snapshot, ...state.autoBackupSnapshots],
        operationLogs: [snapshotLog, ...state.operationLogs],
      });

      return snapshot;
    },

    getLatestSnapshot: (): AutoBackupSnapshot | null => {
      const state = get();
      return state.autoBackupSnapshots[0] ?? null;
    },

    deleteSnapshot: (snapshotId: string): void => {
      const state = get();
      set({
        autoBackupSnapshots: state.autoBackupSnapshots.filter((s) => s.id !== snapshotId),
      });
    },

    clearOldSnapshots: (maxCount: number = 10): void => {
      const state = get();
      if (state.autoBackupSnapshots.length > maxCount) {
        set({
          autoBackupSnapshots: state.autoBackupSnapshots.slice(0, maxCount),
        });
      }
    },
  };
};

const persistedKeys: (keyof PersistedState)[] = [
  'beds',
  'nurses',
  'isolationRules',
  'timeSlots',
  'patients',
  'appointments',
  'admissions',
  'careNotes',
  'operationLogs',
  'abnormalRecords',
  'autoBackupSnapshots',
  'currentUserId',
];

function deriveFromPartial(state: Partial<AppState>): Nurse | null {
  if (!state.currentUserId) return null;
  return (state.nurses ?? []).find((n) => n.id === state.currentUserId) || null;
}

type Persist = [['zustand/persist', PersistedState]];

export const useAppStore = create<AppState>()(
  persist(buildStore as unknown as StateCreator<AppState, [], Persist, AppState>, {
    name: STORE_KEY,
    partialize: (state): PersistedState =>
      Object.fromEntries(
        persistedKeys.map((k) => [k, state[k]]),
      ) as PersistedState,
    onRehydrateStorage: () => (state) => {
      if (state) {
        const s = state as AppState;
        const user = deriveFromPartial(state);
        s.currentUser = user;
        s.currentNurse = user;
      }
    },
  }),
);

export { buildStore, STORE_KEY };
