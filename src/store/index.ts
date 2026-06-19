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
  RestoreDetailedDiff,
  EntityChanges,
  EntityChangeItem,
  RestoreHistoryRecord,
  CheckIn,
  CheckInStatus,
  Campus,
  TriageUndoRecord,
  AppointmentQueryType,
  AppointmentQueryResult,
} from '../types';
import { sampleData } from '../data/sampleData';
import {
  parseLocalTime,
  getTodayStr,
  birthdayMatches,
} from '../lib/utils';

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
  restoreHistory: RestoreHistoryRecord[];
  checkIns: CheckIn[];
  campuses: Campus[];
  triageUndoRecords: TriageUndoRecord[];
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

  addCampus: (c: Omit<Campus, 'id' | 'createdAt'>) => void;
  updateCampus: (id: string, patch: Partial<Campus>) => void;
  deleteCampus: (id: string) => void;
  getActiveCampus: () => Campus | null;

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

  queryTodayAppointments: (
    queryType: AppointmentQueryType,
    params: { phone?: string; appointmentId?: string; name?: string; birthday?: string },
    campusId?: string,
  ) => { success: boolean; error?: string; data?: AppointmentQueryResult[] };
  checkInByPhone: (phone: string, campusId?: string) => { success: boolean; error?: string; data?: CheckIn };
  checkInByAppointment: (appointmentId: string, campusId?: string) => { success: boolean; error?: string; data?: CheckIn };
  checkInByNameBirthday: (name: string, birthday: string, campusId?: string) => { success: boolean; error?: string; data?: CheckIn };
  getTriageQueue: (campusId?: string) => CheckIn[];
  confirmTriage: (checkInId: string, nurseId: string, overrideBedId?: string, department?: string) => { success: boolean; error?: string };
  rejectTriage: (checkInId: string, nurseId: string, reason: string) => { success: boolean; error?: string };
  reassignTriage: (checkInId: string, nurseId: string, newBedId: string, department?: string) => { success: boolean; error?: string };
  undoTriage: (checkInId: string, nurseId: string, reason: string) => { success: boolean; error?: string };
  restoreTriage: (undoId: string, nurseId: string) => { success: boolean; error?: string };
  modifyTriage: (checkInId: string, nurseId: string, patch: Partial<Pick<CheckIn, 'status' | 'conflictReason' | 'triageNote' | 'suggestedBedId' | 'assignedDepartment'>>) => { success: boolean; error?: string };
  getUndoRecords: (checkInId?: string) => TriageUndoRecord[];

  importSampleData: () => void;
  exportDailyReport: (dateStr: string, timezone?: string) => string;
  resetAllData: () => void;

  exportBackup: () => BackupFile;
  previewRestore: (backupFile: BackupFile) => RestorePreview;
  executeRestore: (backupFile: BackupFile) => RestoreResult;
  rollbackRestore: (snapshotId: string) => RollbackResult;
  createAutoSnapshot: (reason: string) => AutoBackupSnapshot;
  getLatestSnapshot: () => AutoBackupSnapshot | null;
  deleteSnapshot: (snapshotId: string) => void;
  clearOldSnapshots: (maxCount?: number) => void;
  calculateDetailedDiff: (beforeData: BackupData, afterData: BackupData) => RestoreDetailedDiff;
  addRestoreHistory: (record: Omit<RestoreHistoryRecord, 'id' | 'timestamp'>) => RestoreHistoryRecord;
  getLatestRestoreRecord: () => RestoreHistoryRecord | null;
  clearRestoreHistory: () => void;
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
  restoreHistory: [],
  checkIns: [],
  campuses: [],
  triageUndoRecords: [],
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

function _doCheckIn(
    aptIdx: number,
    state: AppState,
    set: StoreSet,
    get: StoreGet,
    _campusId?: string,
  ): { success: boolean; error?: string; data?: CheckIn } {
    if (aptIdx < 0) return { success: false, error: '预约不存在' };
    const apt = state.appointments[aptIdx];
    const patient = state.patients.find((p) => p.id === apt.patientId);
    if (!patient) return { success: false, error: '患者信息缺失' };

    const existing = state.checkIns.find(
      (c) => c.appointmentId === apt.id && c.status !== 'triage_rejected',
    );
    if (existing) {
      const opLogId = addOperationLog(set, get, {
        type: 'patient_checkin',
        operator: state.currentUser,
        targetType: 'checkin',
        targetId: apt.id,
        targetName: patient.name,
        detail: `重复签到拦截：患者 ${patient.name} 预约 ${apt.id} 已签到`,
        isAbnormal: true,
        abnormalReason: 'duplicate_checkin',
      });
      addAbnormalRecord(set, get, {
        type: 'duplicate_checkin',
        opLogId,
        desc: `患者 ${patient.name} 对预约 ${apt.id} 重复签到`,
        appointmentId: apt.id,
      });
      return { success: false, error: '该预约已签到，不可重复签到' };
    }
    if (apt.status !== 'pending') {
      return { success: false, error: '该预约状态不可签到' };
    }
    const now = Date.now();
    let arrivalFlag: CheckIn['arrivalFlag'] = 'on_time';
    if (now < apt.startTime - 30 * 60 * 1000) {
      arrivalFlag = 'early';
      addOperationLog(set, get, {
        type: 'patient_checkin',
        operator: state.currentUser,
        targetType: 'checkin',
        targetId: apt.id,
        targetName: patient.name,
        detail: `患者 ${patient.name} 提前到院签到`,
        isAbnormal: true,
        abnormalReason: 'early_arrival',
      });
    } else if (now > apt.endTime) {
      arrivalFlag = 'late';
      addOperationLog(set, get, {
        type: 'patient_checkin',
        operator: state.currentUser,
        targetType: 'checkin',
        targetId: apt.id,
        targetName: patient.name,
        detail: `患者 ${patient.name} 迟到签到`,
        isAbnormal: true,
        abnormalReason: 'late_arrival',
      });
    }
    const id = genId();
    const checkIn: CheckIn = {
      id,
      appointmentId: apt.id,
      patientId: patient.id,
      phone: patient.phone,
      checkInTime: now,
      status: 'checked_in',
      arrivalFlag,
      createdAt: now,
    };
    const newAppointments = [...state.appointments];
    newAppointments[aptIdx] = { ...apt, status: 'checked_in' as const };
    set({
      checkIns: [...state.checkIns, checkIn],
      appointments: newAppointments,
    });
    addOperationLog(set, get, {
      type: 'patient_checkin',
      operator: state.currentUser,
      targetType: 'checkin',
      targetId: id,
      targetName: patient.name,
      detail: `患者 ${patient.name} 签到成功（${arrivalFlag === 'early' ? '提前到院' : arrivalFlag === 'late' ? '迟到' : '准时'}）`,
    });
    return { success: true, data: checkIn };
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

    addCampus: (c) => {
      const id = genId();
      const campus: Campus = { ...c, id, createdAt: Date.now() };
      set({ campuses: [...get().campuses, campus] });
      helpers.opLog(
        'campus_config_change',
        'campus',
        `新增院区：${c.name}（时区: ${c.timezone}）`,
        { targetId: id, targetName: c.name },
      );
    },
    updateCampus: (id, patch) => {
      const state = get();
      const target = state.campuses.find((c) => c.id === id);
      set({
        campuses: state.campuses.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      });
      if (target) {
        helpers.opLog(
          'campus_config_change',
          'campus',
          `修改院区：${target.name}`,
          { targetId: id, targetName: patch.name ?? target.name },
        );
      }
    },
    deleteCampus: (id) => {
      const state = get();
      const target = state.campuses.find((c) => c.id === id);
      set({ campuses: state.campuses.filter((c) => c.id !== id) });
      if (target) {
        helpers.opLog(
          'campus_config_change',
          'campus',
          `删除院区：${target.name}`,
          { targetId: id, targetName: target.name },
        );
      }
    },
    getActiveCampus: () => {
      const state = get();
      if (state.currentUser?.campusId) {
        const c = state.campuses.find((x) => x.id === state.currentUser!.campusId);
        if (c && c.active) return c;
      }
      const active = state.campuses.find((c) => c.active);
      return active ?? state.campuses[0] ?? null;
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

    queryTodayAppointments: (queryType, params, campusId) => {
      const state = get();
      const campus = campusId
        ? state.campuses.find((c) => c.id === campusId)
        : state.getActiveCampus();
      const timezone = campus?.timezone;
      const today = getTodayStr(timezone);

      const matchCampus = (apt: Appointment) => {
        if (!campus) return true;
        const bed = state.beds.find((b) => b.id === apt.bedId);
        return !bed?.campusId || bed.campusId === campus.id;
      };

      let apts: Appointment[] = [];
      if (queryType === 'phone' && params.phone) {
        const patient = state.patients.find((p) => p.phone === params.phone);
        if (!patient) {
          const opLogId = helpers.opLog(
            'patient_checkin_query',
            'patient',
            `查询失败：手机号 ${params.phone} 未找到患者`,
            { isAbnormal: true, abnormalReason: 'patient_not_found' },
          );
          helpers.abnRec('patient_not_found', opLogId, `手机号 ${params.phone} 未找到患者`);
          return { success: false, error: '未找到该手机号对应的患者' };
        }
        apts = state.appointments.filter(
          (a) =>
            a.patientId === patient.id &&
            (a.status === 'pending' || a.status === 'checked_in' || a.status === 'admitted') &&
            a.appointmentDate === today &&
            matchCampus(a),
        );
      } else if (queryType === 'appointmentId' && params.appointmentId) {
        apts = state.appointments.filter(
          (a) =>
            a.id === params.appointmentId &&
            (a.status === 'pending' || a.status === 'checked_in' || a.status === 'admitted') &&
            a.appointmentDate === today &&
            matchCampus(a),
        );
      } else if (queryType === 'nameBirthday' && params.name && params.birthday) {
        const patients = state.patients.filter(
          (p) =>
            p.name.trim() === params.name!.trim() &&
            birthdayMatches(p.birthday, params.birthday),
        );
        if (patients.length === 0) {
          const opLogId = helpers.opLog(
            'patient_checkin_query',
            'patient',
            `查询失败：姓名 ${params.name} 生日 ${params.birthday} 未找到匹配患者`,
            { isAbnormal: true, abnormalReason: 'patient_not_found' },
          );
          helpers.abnRec('patient_not_found', opLogId, `姓名 ${params.name} 生日 ${params.birthday} 未找到匹配患者`);
          return { success: false, error: '未找到姓名与生日匹配的患者' };
        }
        apts = state.appointments.filter(
          (a) =>
            patients.some((p) => p.id === a.patientId) &&
            (a.status === 'pending' || a.status === 'checked_in' || a.status === 'admitted') &&
            a.appointmentDate === today &&
            matchCampus(a),
        );
      }

      if (apts.length === 0) {
        const opLogId = helpers.opLog(
          'patient_checkin_query',
          'appointment',
          `查询失败：该条件下院区今日无预约`,
          { isAbnormal: true, abnormalReason: 'no_appointment_today' },
        );
        helpers.abnRec('no_appointment_today', opLogId, `院区今日无符合条件的预约`);
        return { success: false, error: '院区今日无符合条件的预约' };
      }

      helpers.opLog(
        'patient_checkin_query',
        'appointment',
        `查询成功：找到 ${apts.length} 条院区当日预约`,
      );

      const data: AppointmentQueryResult[] = apts.map((apt) => ({
        appointment: apt,
        patient: state.patients.find((p) => p.id === apt.patientId)!,
        bed: state.beds.find((b) => b.id === apt.bedId),
        slot: state.timeSlots.find((s) => s.id === apt.slotId),
        isolationRule: apt.isolationRuleId
          ? state.isolationRules.find((r) => r.id === apt.isolationRuleId)
          : undefined,
      }));

      return { success: true, data };
    },

    checkInByPhone: (phone, campusId) => {
      const state = get();
      const query = state.queryTodayAppointments('phone', { phone }, campusId);
      if (!query.success || !query.data) {
        return { success: false, error: query.error ?? '查询失败' };
      }
      const pending = query.data.find((q) => q.appointment.status === 'pending');
      const result = pending ?? query.data[0];
      return _doCheckIn(state.appointments.findIndex(a => a.id === result.appointment.id), state, set, get, campusId);
    },

    checkInByAppointment: (appointmentId, campusId) => {
      const state = get();
      const query = state.queryTodayAppointments('appointmentId', { appointmentId }, campusId);
      if (!query.success || !query.data) {
        return { success: false, error: query.error ?? '查询失败' };
      }
      const pending = query.data.find((q) => q.appointment.status === 'pending');
      const result = pending ?? query.data[0];
      return _doCheckIn(state.appointments.findIndex(a => a.id === result.appointment.id), state, set, get, campusId);
    },

    checkInByNameBirthday: (name, birthday, campusId) => {
      const state = get();
      const query = state.queryTodayAppointments('nameBirthday', { name, birthday }, campusId);
      if (!query.success || !query.data) {
        return { success: false, error: query.error ?? '查询失败' };
      }
      const pending = query.data.find((q) => q.appointment.status === 'pending');
      const result = pending ?? query.data[0];
      return _doCheckIn(state.appointments.findIndex(a => a.id === result.appointment.id), state, set, get, campusId);
    },

    getTriageQueue: (campusId) => {
      const state = get();
      return state.checkIns.filter((c) => {
        if (c.status !== 'checked_in' && c.status !== 'triaging') return false;
        if (!campusId) return true;
        const apt = state.appointments.find((a) => a.id === c.appointmentId);
        if (!apt) return false;
        const bed = state.beds.find((b) => b.id === apt.bedId);
        return !bed?.campusId || bed.campusId === campusId;
      });
    },

    confirmTriage: (checkInId, nurseId, overrideBedId, department) => {
      const state = get();
      const nurse = state.nurses.find((n) => n.id === nurseId);
      if (!nurse) return { success: false, error: '护士不存在' };

      const checkIn = state.checkIns.find((c) => c.id === checkInId);
      if (!checkIn) return { success: false, error: '签到记录不存在' };
      if (checkIn.status !== 'checked_in' && checkIn.status !== 'triaging') {
        return { success: false, error: '该签到记录状态不可分诊确认' };
      }

      const apt = state.appointments.find((a) => a.id === checkIn.appointmentId);
      if (!apt) return { success: false, error: '关联预约不存在' };

      const targetBedId = overrideBedId ?? apt.bedId;
      const bed = state.beds.find((b) => b.id === targetBedId);

      if (bed && (bed.status === 'occupied' || bed.status === 'isolated')) {
        const opLogId = helpers.opLog(
          'triage_confirm',
          'checkin',
          `分诊确认失败：床位 ${bed.bedNumber} 已被占用`,
          {
            targetId: checkInId,
            targetName: bed.bedNumber,
            isAbnormal: true,
            abnormalReason: 'bed_occupied_triage',
          },
        );
        helpers.abnRec(
          'bed_occupied_triage',
          opLogId,
          `分诊时床位 ${bed.bedNumber} 已被占用`,
          { bedId: targetBedId, appointmentId: apt.id },
        );
        return { success: false, error: `床位 ${bed.bedNumber} 已被占用，无法确认入床` };
      }

      const conflictingAdmission = state.admissions.find(
        (a) => a.bedId === targetBedId && a.status === 'in_bed',
      );
      if (conflictingAdmission) {
        const opLogId = helpers.opLog(
          'triage_confirm',
          'checkin',
          `分诊确认失败：床位存在未完成的在床记录`,
          {
            targetId: checkInId,
            targetName: bed?.bedNumber,
            isAbnormal: true,
            abnormalReason: 'bed_occupied_triage',
          },
        );
        helpers.abnRec(
          'bed_occupied_triage',
          opLogId,
          '分诊时床位存在未完成的在床记录',
          { bedId: targetBedId },
        );
        return { success: false, error: '该床位存在未完成的在床记录，无法确认入床' };
      }

      const patient = state.patients.find((p) => p.id === apt.patientId);
      const isoCheck = validateIsolationCompliance(state, targetBedId, apt.isolationRuleId);
      if (!isoCheck.success) {
        const opLogId = helpers.opLog(
          'triage_confirm',
          'checkin',
          `分诊确认失败：${isoCheck.error}`,
          {
            targetId: checkInId,
            targetName: patient?.name ?? '',
            isAbnormal: true,
            abnormalReason: 'isolation_conflict_triage',
          },
        );
        helpers.abnRec(
          'isolation_conflict_triage',
          opLogId,
          isoCheck.error ?? '隔离规则冲突',
          { bedId: targetBedId, appointmentId: apt.id },
        );
        return { success: false, error: isoCheck.error };
      }

      const admissionId = genId();
      const newBedStatus: BedStatus = apt.isolationRuleId ? 'isolated' : 'occupied';
      set({
        checkIns: state.checkIns.map((c) =>
          c.id === checkInId
            ? {
                ...c,
                status: 'triage_confirmed' as CheckInStatus,
                handledBy: nurseId,
                suggestedBedId: targetBedId,
                assignedDepartment: department ?? c.assignedDepartment,
              }
            : c,
        ),
        appointments: state.appointments.map((a) =>
          a.id === apt.id ? { ...a, status: 'admitted' as const, bedId: targetBedId } : a,
        ),
        admissions: [
          ...state.admissions,
          {
            id: admissionId,
            appointmentId: apt.id,
            patientId: apt.patientId,
            bedId: targetBedId,
            admittedAt: Date.now(),
            status: 'in_bed',
            admittedBy: nurseId,
            createdAt: Date.now(),
          },
        ],
        beds: state.beds.map((b) =>
          b.id === targetBedId
            ? { ...b, status: newBedStatus, currentPatientId: apt.patientId, currentAdmissionId: admissionId }
            : b,
        ),
      });
      helpers.opLog(
        'triage_confirm',
        'checkin',
        `分诊确认入床：${patient?.name ?? ''} → ${bed?.bedNumber ?? ''}${department ? `（${department}）` : ''}`,
        { targetId: checkInId, targetName: `${bed?.bedNumber ?? ''} ${patient?.name ?? ''}` },
      );
      return { success: true };
    },

    rejectTriage: (checkInId, nurseId, reason) => {
      const state = get();
      const nurse = state.nurses.find((n) => n.id === nurseId);
      if (!nurse) return { success: false, error: '护士不存在' };

      const checkIn = state.checkIns.find((c) => c.id === checkInId);
      if (!checkIn) return { success: false, error: '签到记录不存在' };
      if (checkIn.status !== 'checked_in' && checkIn.status !== 'triaging') {
        return { success: false, error: '该签到记录状态不可退回' };
      }

      const apt = state.appointments.find((a) => a.id === checkIn.appointmentId);
      const patient = apt ? state.patients.find((p) => p.id === apt.patientId) : null;

      set({
        checkIns: state.checkIns.map((c) =>
          c.id === checkInId
            ? { ...c, status: 'triage_rejected' as CheckInStatus, handledBy: nurseId, conflictReason: reason }
            : c,
        ),
        appointments: state.appointments.map((a) =>
          a.id === checkIn.appointmentId ? { ...a, status: 'pending' as const } : a,
        ),
      });
      helpers.opLog(
        'triage_reject',
        'checkin',
        `分诊退回：${patient?.name ?? ''}，原因：${reason}`,
        { targetId: checkInId, targetName: patient?.name ?? '' },
      );
      return { success: true };
    },

    reassignTriage: (checkInId, nurseId, newBedId, department) => {
      const state = get();
      const nurse = state.nurses.find((n) => n.id === nurseId);
      if (!nurse) return { success: false, error: '护士不存在' };
      if (nurse.role === 'normal') {
        const opLogId = helpers.opLog(
          'triage_reassign',
          'checkin',
          '普通护士无权改派分诊床位',
          {
            targetId: checkInId,
            isAbnormal: true,
            abnormalReason: 'triage_reassign_permission_denied',
          },
        );
        helpers.abnRec(
          'triage_reassign_permission_denied',
          opLogId,
          '普通护士尝试改派分诊床位',
        );
        return { success: false, error: '普通护士无权改派分诊床位，请联系高级护士或管理员' };
      }

      const checkIn = state.checkIns.find((c) => c.id === checkInId);
      if (!checkIn) return { success: false, error: '签到记录不存在' };
      if (checkIn.status !== 'checked_in' && checkIn.status !== 'triaging') {
        return { success: false, error: '该签到记录状态不可分诊改派' };
      }

      const apt = state.appointments.find((a) => a.id === checkIn.appointmentId);
      if (!apt) return { success: false, error: '关联预约不存在' };

      const newBed = state.beds.find((b) => b.id === newBedId);
      if (!newBed) return { success: false, error: '目标床位不存在' };
      if (newBed.status === 'occupied' || newBed.status === 'isolated') {
        const opLogId = helpers.opLog(
          'triage_reassign',
          'checkin',
          `改派失败：目标床位 ${newBed.bedNumber} 已被占用`,
          { targetId: checkInId, isAbnormal: true, abnormalReason: 'bed_occupied_triage' },
        );
        helpers.abnRec('bed_occupied_triage', opLogId, `改派目标床位 ${newBed.bedNumber} 已被占用`, {
          bedId: newBedId,
          appointmentId: apt.id,
        });
        return { success: false, error: `床位 ${newBed.bedNumber} 已被占用` };
      }

      const conflictingAdmission = state.admissions.find(
        (a) => a.bedId === newBedId && a.status === 'in_bed',
      );
      if (conflictingAdmission) {
        const opLogId = helpers.opLog(
          'triage_reassign',
          'checkin',
          '改派失败：目标床位存在未完成在床记录',
          { targetId: checkInId, isAbnormal: true, abnormalReason: 'bed_occupied_triage' },
        );
        helpers.abnRec('bed_occupied_triage', opLogId, '改派目标床位存在未完成在床记录', { bedId: newBedId });
        return { success: false, error: '目标床位存在未完成的在床记录' };
      }

      const isoCheck = validateIsolationCompliance(state, newBedId, apt.isolationRuleId);
      if (!isoCheck.success) {
        const opLogId = helpers.opLog(
          'triage_reassign',
          'checkin',
          `改派失败：${isoCheck.error}`,
          { targetId: checkInId, isAbnormal: true, abnormalReason: 'isolation_conflict_triage' },
        );
        helpers.abnRec('isolation_conflict_triage', opLogId, isoCheck.error ?? '隔离规则冲突', {
          bedId: newBedId,
          appointmentId: apt.id,
        });
        return { success: false, error: isoCheck.error };
      }

      if (apt.isolationRuleId) {
        const rule = state.isolationRules.find((r) => r.id === apt.isolationRuleId);
        const oldBed = state.beds.find((b) => b.id === apt.bedId);
        if (rule?.crossZoneForbidden && oldBed && newBed.zone !== oldBed.zone) {
          const opLogId = helpers.opLog(
            'triage_reassign',
            'checkin',
            `改派失败：${rule.disease} 禁止跨区调度`,
            { targetId: checkInId, isAbnormal: true, abnormalReason: 'isolation_conflict_triage' },
          );
          helpers.abnRec('isolation_conflict_triage', opLogId, `${rule.disease} 禁止跨区调度`, {
            bedId: newBedId,
            appointmentId: apt.id,
          });
          return { success: false, error: `${rule.disease} 禁止跨区调度` };
        }
      }

      const patient = state.patients.find((p) => p.id === apt.patientId);

      set({
        checkIns: state.checkIns.map((c) =>
          c.id === checkInId
            ? { ...c, suggestedBedId: newBedId, assignedDepartment: department ?? c.assignedDepartment }
            : c,
        ),
        appointments: state.appointments.map((a) =>
          a.id === apt.id ? { ...a, bedId: newBedId } : a,
        ),
      });
      helpers.opLog(
        'triage_reassign',
        'checkin',
        `分诊改派：${patient?.name ?? ''} 床位调整为 ${newBed.bedNumber}${department ? `（${department}）` : ''}`,
        { targetId: checkInId, targetName: patient?.name ?? '' },
      );
      return { success: true };
    },

    undoTriage: (checkInId, nurseId, reason) => {
      const state = get();
      const nurse = state.nurses.find((n) => n.id === nurseId);
      if (!nurse) return { success: false, error: '护士不存在' };
      if (nurse.role === 'normal') {
        const opLogId = helpers.opLog(
          'triage_undo',
          'checkin',
          '普通护士无权撤销分诊确认',
          {
            targetId: checkInId,
            isAbnormal: true,
            abnormalReason: 'triage_undo_permission_denied',
          },
        );
        helpers.abnRec('triage_undo_permission_denied', opLogId, '普通护士尝试撤销分诊确认');
        return { success: false, error: '普通护士无权撤销分诊，请联系高级护士或管理员' };
      }

      const checkIn = state.checkIns.find((c) => c.id === checkInId);
      if (!checkIn) return { success: false, error: '签到记录不存在' };
      if (checkIn.status !== 'triage_confirmed') {
        return { success: false, error: '只有已入床的分诊可以撤销' };
      }

      const apt = state.appointments.find((a) => a.id === checkIn.appointmentId);
      if (!apt) return { success: false, error: '关联预约不存在' };

      const admission = state.admissions.find(
        (a) => a.appointmentId === apt.id && a.status === 'in_bed',
      );
      if (!admission) {
        return { success: false, error: '未找到关联的在床记录' };
      }

      const patient = state.patients.find((p) => p.id === apt.patientId);
      const undoId = genId();
      const targetBedId = checkIn.suggestedBedId ?? apt.bedId;

      const undoRecord: TriageUndoRecord = {
        id: undoId,
        checkInId,
        previousStatus: checkIn.status,
        previousBedId: targetBedId,
        previousAdmissionId: admission.id,
        undoneBy: nurseId,
        undoneAt: Date.now(),
        reason,
        restored: false,
      };

      set({
        triageUndoRecords: [undoRecord, ...state.triageUndoRecords],
        checkIns: state.checkIns.map((c) =>
          c.id === checkInId
            ? { ...c, status: 'triage_undone' as CheckInStatus, undoId }
            : c,
        ),
        appointments: state.appointments.map((a) =>
          a.id === apt.id ? { ...a, status: 'checked_in' as const } : a,
        ),
        admissions: state.admissions.map((a) =>
          a.id === admission.id
            ? {
                ...a,
                status: 'discharged',
                dischargedAt: Date.now(),
                dischargedBy: nurseId,
                dischargeReason: `分诊撤销：${reason}`,
              }
            : a,
        ),
        beds: state.beds.map((b) =>
          b.id === targetBedId
            ? {
                ...b,
                status: 'cleaning' as BedStatus,
                currentPatientId: undefined,
                currentAdmissionId: undefined,
              }
            : b,
        ),
      });
      helpers.opLog(
        'triage_undo',
        'triage_undo',
        `撤销分诊：${patient?.name ?? ''}，原因：${reason}`,
        { targetId: undoId, targetName: patient?.name ?? '' },
      );
      return { success: true };
    },

    restoreTriage: (undoId, nurseId) => {
      const state = get();
      const nurse = state.nurses.find((n) => n.id === nurseId);
      if (!nurse) return { success: false, error: '护士不存在' };
      if (nurse.role === 'normal') {
        const opLogId = helpers.opLog(
          'triage_restore',
          'triage_undo',
          '普通护士无权恢复撤销的分诊',
          {
            targetId: undoId,
            isAbnormal: true,
            abnormalReason: 'triage_undo_permission_denied',
          },
        );
        helpers.abnRec(
          'triage_undo_permission_denied',
          opLogId,
          '普通护士尝试恢复撤销的分诊',
        );
        return { success: false, error: '普通护士无权恢复分诊，请联系高级护士或管理员' };
      }

      const undo = state.triageUndoRecords.find((r) => r.id === undoId);
      if (!undo) return { success: false, error: '撤销记录不存在' };
      if (undo.restored) return { success: false, error: '该撤销记录已恢复' };

      const checkIn = state.checkIns.find((c) => c.id === undo.checkInId);
      if (!checkIn) return { success: false, error: '签到记录不存在' };
      const apt = state.appointments.find((a) => a.id === checkIn.appointmentId);
      if (!apt) return { success: false, error: '关联预约不存在' };
      if (!undo.previousBedId) return { success: false, error: '缺少原床位信息' };

      const bed = state.beds.find((b) => b.id === undo.previousBedId);
      if (!bed) return { success: false, error: '原床位不存在' };
      if (bed.status !== 'idle' && bed.status !== 'cleaning') {
        const opLogId = helpers.opLog(
          'triage_restore',
          'triage_undo',
          `恢复失败：床位 ${bed.bedNumber} 已被占用`,
          { targetId: undoId, isAbnormal: true, abnormalReason: 'bed_occupied_triage' },
        );
        helpers.abnRec('bed_occupied_triage', opLogId, `恢复时床位 ${bed.bedNumber} 已被占用`, {
          bedId: undo.previousBedId,
        });
        return { success: false, error: `原床位 ${bed.bedNumber} 已被占用，无法恢复` };
      }

      const isoCheck = validateIsolationCompliance(state, undo.previousBedId, apt.isolationRuleId);
      if (!isoCheck.success) {
        const opLogId = helpers.opLog(
          'triage_restore',
          'triage_undo',
          `恢复失败：${isoCheck.error}`,
          { targetId: undoId, isAbnormal: true, abnormalReason: 'isolation_conflict_triage' },
        );
        helpers.abnRec(
          'isolation_conflict_triage',
          opLogId,
          isoCheck.error ?? '隔离规则冲突',
          { bedId: undo.previousBedId, appointmentId: apt.id },
        );
        return { success: false, error: isoCheck.error };
      }

      const patient = state.patients.find((p) => p.id === apt.patientId);
      const admissionId = genId();
      const newBedStatus: BedStatus = apt.isolationRuleId ? 'isolated' : 'occupied';

      set({
        triageUndoRecords: state.triageUndoRecords.map((r) =>
          r.id === undoId
            ? { ...r, restored: true, restoredBy: nurseId, restoredAt: Date.now() }
            : r,
        ),
        checkIns: state.checkIns.map((c) =>
          c.id === undo.checkInId
            ? { ...c, status: 'triage_confirmed' as CheckInStatus, handledBy: nurseId, undoId: undefined }
            : c,
        ),
        appointments: state.appointments.map((a) =>
          a.id === apt.id ? { ...a, status: 'admitted' as const } : a,
        ),
        admissions: [
          ...state.admissions,
          {
            id: admissionId,
            appointmentId: apt.id,
            patientId: apt.patientId,
            bedId: undo.previousBedId,
            admittedAt: Date.now(),
            status: 'in_bed',
            admittedBy: nurseId,
            createdAt: Date.now(),
          },
        ],
        beds: state.beds.map((b) =>
          b.id === undo.previousBedId
            ? {
                ...b,
                status: newBedStatus,
                currentPatientId: apt.patientId,
                currentAdmissionId: admissionId,
              }
            : b,
        ),
      });
      helpers.opLog(
        'triage_restore',
        'triage_undo',
        `恢复分诊：${patient?.name ?? ''} → ${bed.bedNumber}`,
        { targetId: undoId, targetName: patient?.name ?? '' },
      );
      return { success: true };
    },

    getUndoRecords: (checkInId) => {
      const state = get();
      if (checkInId) return state.triageUndoRecords.filter((r) => r.checkInId === checkInId);
      return state.triageUndoRecords;
    },

    modifyTriage: (checkInId, nurseId, patch) => {
      const state = get();
      const nurse = state.nurses.find((n) => n.id === nurseId);
      if (!nurse) return { success: false, error: '护士不存在' };
      if (nurse.role === 'normal') {
        const opLogId = helpers.opLog(
          'triage_modify',
          'checkin',
          `普通护士无权修改分诊结果`,
          {
            targetId: checkInId,
            isAbnormal: true,
            abnormalReason: 'triage_permission_denied',
          },
        );
        helpers.abnRec(
          'triage_permission_denied',
          opLogId,
          '普通护士尝试修改分诊结果',
        );
        return { success: false, error: '普通护士无权修改分诊结果' };
      }

      const checkIn = state.checkIns.find((c) => c.id === checkInId);
      if (!checkIn) return { success: false, error: '签到记录不存在' };

      const patient = state.patients.find((p) => p.id === checkIn.patientId);

      set({
        checkIns: state.checkIns.map((c) =>
          c.id === checkInId ? { ...c, ...patch } : c,
        ),
      });
      helpers.opLog(
        'triage_modify',
        'checkin',
        `修改分诊：${patient?.name ?? ''}，变更：${Object.keys(patch).join(', ')}`,
        { targetId: checkInId, targetName: patient?.name ?? '' },
      );
      return { success: true };
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
        campuses: [...(sampleData as any).campuses ?? []],
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
        checkIns: [...sampleData.checkIns],
        triageUndoRecords: [...(sampleData as any).triageUndoRecords ?? []],
        currentUserId: null,
        currentUser: null,
        currentNurse: null,
      });
    },

    exportDailyReport: (dateStr, timezone) => {
      const state = get();
      const dayStart = parseLocalTime(dateStr, '00:00', timezone);
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
        campuses: JSON.parse(JSON.stringify(state.campuses)),
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
        checkIns: JSON.parse(JSON.stringify(state.checkIns)),
        triageUndoRecords: JSON.parse(JSON.stringify(state.triageUndoRecords)),
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
        campuses: data?.campuses?.length ?? 0,
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
        checkIns: data?.checkIns?.length ?? 0,
        triageUndoRecords: data?.triageUndoRecords?.length ?? 0,
      };

      const entityKeys: BackupRestoreEntity[] = [
        'campuses', 'beds', 'nurses', 'isolationRules', 'timeSlots', 'patients',
        'appointments', 'admissions', 'careNotes', 'operationLogs', 'abnormalRecords',
        'checkIns', 'triageUndoRecords',
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

      const beforeData: BackupData = {
        campuses: JSON.parse(JSON.stringify(state.campuses)),
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
        checkIns: JSON.parse(JSON.stringify(state.checkIns)),
        triageUndoRecords: JSON.parse(JSON.stringify(state.triageUndoRecords)),
      };

      const emptyOverview: Record<BackupRestoreEntity, number> = {
        campuses: 0, beds: 0, nurses: 0, isolationRules: 0, timeSlots: 0, patients: 0,
        appointments: 0, admissions: 0, careNotes: 0, operationLogs: 0, abnormalRecords: 0,
        checkIns: 0, triageUndoRecords: 0,
      };
      const emptyDiff: RestoreDiff = {
        campuses: { added: 0, updated: 0, deleted: 0 },
        beds: { added: 0, updated: 0, deleted: 0 },
        nurses: { added: 0, updated: 0, deleted: 0 },
        isolationRules: { added: 0, updated: 0, deleted: 0 },
        timeSlots: { added: 0, updated: 0, deleted: 0 },
        patients: { added: 0, updated: 0, deleted: 0 },
        appointments: { added: 0, updated: 0, deleted: 0 },
        admissions: { added: 0, updated: 0, deleted: 0 },
        careNotes: { added: 0, updated: 0, deleted: 0 },
        operationLogs: { added: 0, updated: 0, deleted: 0 },
        abnormalRecords: { added: 0, updated: 0, deleted: 0 },
        checkIns: { added: 0, updated: 0, deleted: 0 },
        triageUndoRecords: { added: 0, updated: 0, deleted: 0 },
      };
      const emptyDetailedDiff = state.calculateDetailedDiff(beforeData, beforeData);

      if (!currentUser || currentUser.role !== 'admin') {
        const opLogId = helpers.opLog(
          'backup_restore',
          'system',
          '数据恢复失败：只有管理员可以执行数据恢复操作',
          { isAbnormal: true, abnormalReason: 'backup_permission_denied' },
        );
        helpers.abnRec('backup_permission_denied', opLogId, '非管理员尝试执行数据恢复操作');
        state.addRestoreHistory({
          operationType: 'restore',
          status: 'failed',
          operatorId: currentUser?.id ?? 'unknown',
          operatorName: currentUser?.name ?? '未知用户',
          backupVersion: backupFile.version,
          backupExportedAt: backupFile.exportedAt,
          message: '只有管理员可以执行数据恢复操作',
          error: 'permission_denied',
          dataOverview: emptyOverview,
          diff: emptyDiff,
          detailedDiff: emptyDetailedDiff,
        });
        return {
          success: false,
          message: '只有管理员可以执行数据恢复操作',
          error: 'permission_denied',
        };
      }

      const preview = state.previewRestore(backupFile);
      if (!preview.canRestore) {
        const errors = preview.issues.filter((i) => i.severity === 'error').map((i) => i.message);
        const errMsg = `备份文件校验失败: ${errors.join('; ')}`;
        const opLogId = helpers.opLog(
          'backup_restore',
          'system',
          `数据恢复失败：${errMsg}`,
          { isAbnormal: true, abnormalReason: preview.issues[0]?.type ?? 'data_conflict' },
        );
        helpers.abnRec(
          (preview.issues[0]?.type as AbnormalType) ?? 'data_conflict',
          opLogId,
          errMsg,
        );
        state.addRestoreHistory({
          operationType: 'restore',
          status: 'failed',
          operatorId: currentUser.id,
          operatorName: currentUser.name,
          backupVersion: backupFile.version,
          backupExportedAt: backupFile.exportedAt,
          message: errMsg,
          error: 'validation_failed',
          dataOverview: preview.dataOverview,
          diff: preview.diff,
          detailedDiff: emptyDetailedDiff,
        });
        return {
          success: false,
          message: errMsg,
          error: 'validation_failed',
        };
      }

      const snapshot = state.createAutoSnapshot('恢复前自动备份');
      const afterData = backupFile.data;

      const newNurses = JSON.parse(JSON.stringify(afterData.nurses ?? []));
      const adminStillExists = newNurses.find(
        (n: Nurse) => n.id === currentUser.id && n.role === 'admin',
      );

      set({
        campuses: JSON.parse(JSON.stringify(afterData.campuses ?? [])),
        beds: JSON.parse(JSON.stringify(afterData.beds ?? [])),
        nurses: newNurses,
        isolationRules: JSON.parse(JSON.stringify(afterData.isolationRules ?? [])),
        timeSlots: JSON.parse(JSON.stringify(afterData.timeSlots ?? [])),
        patients: JSON.parse(JSON.stringify(afterData.patients ?? [])),
        appointments: JSON.parse(JSON.stringify(afterData.appointments ?? [])),
        admissions: JSON.parse(JSON.stringify(afterData.admissions ?? [])),
        careNotes: JSON.parse(JSON.stringify(afterData.careNotes ?? [])),
        abnormalRecords: JSON.parse(JSON.stringify(afterData.abnormalRecords ?? [])),
        checkIns: JSON.parse(JSON.stringify(afterData.checkIns ?? [])),
        triageUndoRecords: JSON.parse(JSON.stringify(afterData.triageUndoRecords ?? [])),
        currentUserId: adminStillExists ? currentUser.id : null,
        currentUser: adminStillExists ? adminStillExists : null,
        currentNurse: adminStillExists ? adminStillExists : null,
      });

      const detailedDiff = state.calculateDetailedDiff(beforeData, afterData);

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

      state.addRestoreHistory({
        operationType: 'restore',
        status: 'success',
        operatorId: currentUser.id,
        operatorName: currentUser.name,
        backupVersion: backupFile.version,
        backupExportedAt: backupFile.exportedAt,
        snapshotId: snapshot.id,
        snapshotName: snapshot.name,
        message: '数据恢复成功',
        dataOverview: preview.dataOverview,
        diff: preview.diff,
        detailedDiff,
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

      const beforeData: BackupData = {
        campuses: JSON.parse(JSON.stringify(state.campuses)),
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
        checkIns: JSON.parse(JSON.stringify(state.checkIns)),
        triageUndoRecords: JSON.parse(JSON.stringify(state.triageUndoRecords)),
      };

      const emptyOverview: Record<BackupRestoreEntity, number> = {
        campuses: 0, beds: 0, nurses: 0, isolationRules: 0, timeSlots: 0, patients: 0,
        appointments: 0, admissions: 0, careNotes: 0, operationLogs: 0, abnormalRecords: 0,
        checkIns: 0, triageUndoRecords: 0,
      };
      const emptyDiff: RestoreDiff = {
        campuses: { added: 0, updated: 0, deleted: 0 },
        beds: { added: 0, updated: 0, deleted: 0 },
        nurses: { added: 0, updated: 0, deleted: 0 },
        isolationRules: { added: 0, updated: 0, deleted: 0 },
        timeSlots: { added: 0, updated: 0, deleted: 0 },
        patients: { added: 0, updated: 0, deleted: 0 },
        appointments: { added: 0, updated: 0, deleted: 0 },
        admissions: { added: 0, updated: 0, deleted: 0 },
        careNotes: { added: 0, updated: 0, deleted: 0 },
        operationLogs: { added: 0, updated: 0, deleted: 0 },
        abnormalRecords: { added: 0, updated: 0, deleted: 0 },
        checkIns: { added: 0, updated: 0, deleted: 0 },
        triageUndoRecords: { added: 0, updated: 0, deleted: 0 },
      };
      const emptyDetailedDiff = state.calculateDetailedDiff(beforeData, beforeData);

      if (!currentUser || currentUser.role !== 'admin') {
        const opLogId = helpers.opLog(
          'backup_restore_rollback',
          'system',
          '数据回滚失败：只有管理员可以执行回滚操作',
          { isAbnormal: true, abnormalReason: 'backup_permission_denied' },
        );
        helpers.abnRec('backup_permission_denied', opLogId, '非管理员尝试执行数据回滚操作');
        state.addRestoreHistory({
          operationType: 'rollback',
          status: 'failed',
          operatorId: currentUser?.id ?? 'unknown',
          operatorName: currentUser?.name ?? '未知用户',
          rollbackSnapshotId: snapshotId,
          message: '只有管理员可以执行回滚操作',
          error: 'permission_denied',
          dataOverview: emptyOverview,
          diff: emptyDiff,
          detailedDiff: emptyDetailedDiff,
        });
        return {
          success: false,
          message: '只有管理员可以执行回滚操作',
          error: 'permission_denied',
        };
      }

      const snapshot = state.autoBackupSnapshots.find((s) => s.id === snapshotId);
      if (!snapshot) {
        const errMsg = `未找到快照: ${snapshotId}`;
        const opLogId = helpers.opLog(
          'backup_restore_rollback',
          'system',
          `数据回滚失败：${errMsg}`,
          { isAbnormal: true, abnormalReason: 'data_conflict' },
        );
        helpers.abnRec('data_conflict', opLogId, errMsg);
        state.addRestoreHistory({
          operationType: 'rollback',
          status: 'failed',
          operatorId: currentUser.id,
          operatorName: currentUser.name,
          rollbackSnapshotId: snapshotId,
          message: errMsg,
          error: 'snapshot_not_found',
          dataOverview: emptyOverview,
          diff: emptyDiff,
          detailedDiff: emptyDetailedDiff,
        });
        return {
          success: false,
          message: errMsg,
          error: 'snapshot_not_found',
        };
      }

      const beforeRollbackSnapshot = state.createAutoSnapshot('回滚前自动备份');
      const afterData = snapshot.data;

      const newNurses = JSON.parse(JSON.stringify(afterData.nurses ?? []));
      const adminStillExists = newNurses.find(
        (n: Nurse) => n.id === currentUser.id && n.role === 'admin',
      );

      set({
        campuses: JSON.parse(JSON.stringify(afterData.campuses ?? [])),
        beds: JSON.parse(JSON.stringify(afterData.beds ?? [])),
        nurses: newNurses,
        isolationRules: JSON.parse(JSON.stringify(afterData.isolationRules ?? [])),
        timeSlots: JSON.parse(JSON.stringify(afterData.timeSlots ?? [])),
        patients: JSON.parse(JSON.stringify(afterData.patients ?? [])),
        appointments: JSON.parse(JSON.stringify(afterData.appointments ?? [])),
        admissions: JSON.parse(JSON.stringify(afterData.admissions ?? [])),
        careNotes: JSON.parse(JSON.stringify(afterData.careNotes ?? [])),
        abnormalRecords: JSON.parse(JSON.stringify(afterData.abnormalRecords ?? [])),
        checkIns: JSON.parse(JSON.stringify(afterData.checkIns ?? [])),
        triageUndoRecords: JSON.parse(JSON.stringify(afterData.triageUndoRecords ?? [])),
        currentUserId: adminStillExists ? currentUser.id : null,
        currentUser: adminStillExists ? adminStillExists : null,
        currentNurse: adminStillExists ? adminStillExists : null,
      });

      const detailedDiff = state.calculateDetailedDiff(beforeData, afterData);

      const entityKeys: BackupRestoreEntity[] = [
        'campuses', 'beds', 'nurses', 'isolationRules', 'timeSlots', 'patients',
        'appointments', 'admissions', 'careNotes', 'operationLogs', 'abnormalRecords',
        'checkIns', 'triageUndoRecords',
      ];
      const dataOverview: Record<BackupRestoreEntity, number> = {} as Record<BackupRestoreEntity, number>;
      for (const key of entityKeys) {
        dataOverview[key] = (afterData[key] as any[])?.length ?? 0;
      }
      const rollbackDiff: RestoreDiff = {} as RestoreDiff;
      for (const key of entityKeys) {
        const changes = (detailedDiff as any)[key] as EntityChanges;
        rollbackDiff[key] = {
          added: changes.added.length,
          updated: changes.updated.length,
          deleted: changes.deleted.length,
        };
      }

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

      state.addRestoreHistory({
        operationType: 'rollback',
        status: 'success',
        operatorId: currentUser.id,
        operatorName: currentUser.name,
        snapshotId: beforeRollbackSnapshot.id,
        snapshotName: beforeRollbackSnapshot.name,
        rollbackSnapshotId: snapshot.id,
        rollbackSnapshotName: snapshot.name,
        message: '数据回滚成功',
        dataOverview,
        diff: rollbackDiff,
        detailedDiff,
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
          campuses: JSON.parse(JSON.stringify(state.campuses)),
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
          checkIns: JSON.parse(JSON.stringify(state.checkIns)),
          triageUndoRecords: JSON.parse(JSON.stringify(state.triageUndoRecords)),
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

    calculateDetailedDiff: (beforeData: BackupData, afterData: BackupData): RestoreDetailedDiff => {
      const entityKeys: BackupRestoreEntity[] = [
        'campuses', 'beds', 'nurses', 'isolationRules', 'timeSlots', 'patients',
        'appointments', 'admissions', 'careNotes', 'operationLogs', 'abnormalRecords',
        'checkIns', 'triageUndoRecords',
      ];

      const entityNameFields: Record<BackupRestoreEntity, string> = {
        campuses: 'name',
        beds: 'bedNumber',
        nurses: 'name',
        isolationRules: 'disease',
        timeSlots: 'label',
        patients: 'name',
        appointments: 'id',
        admissions: 'id',
        careNotes: 'id',
        operationLogs: 'id',
        abnormalRecords: 'id',
        checkIns: 'id',
        triageUndoRecords: 'id',
      };

      const result: RestoreDetailedDiff = {} as RestoreDetailedDiff;

      for (const key of entityKeys) {
        const before = (beforeData[key] as any[]) ?? [];
        const after = (afterData[key] as any[]) ?? [];
        const beforeMap = new Map(before.map((item) => [item.id, item]));
        const afterMap = new Map(after.map((item) => [item.id, item]));
        const nameField = entityNameFields[key];

        const added: EntityChangeItem[] = [];
        const updated: EntityChangeItem[] = [];
        const deleted: EntityChangeItem[] = [];

        for (const item of after) {
          if (!beforeMap.has(item.id)) {
            added.push({
              id: item.id,
              name: String(item[nameField] ?? item.id),
              changeType: 'added',
              after: item,
            });
          } else {
            const beforeItem = beforeMap.get(item.id)!;
            const diffFields: Array<{ field: string; before: any; after: any }> = [];
            const allKeys = new Set([...Object.keys(beforeItem), ...Object.keys(item)]);
            for (const f of allKeys) {
              const bVal = JSON.stringify(beforeItem[f]);
              const aVal = JSON.stringify(item[f]);
              if (bVal !== aVal) {
                diffFields.push({ field: f, before: beforeItem[f], after: item[f] });
              }
            }
            if (diffFields.length > 0) {
              updated.push({
                id: item.id,
                name: String(item[nameField] ?? item.id),
                changeType: 'updated',
                before: beforeItem,
                after: item,
                diffFields,
              });
            }
          }
        }

        for (const item of before) {
          if (!afterMap.has(item.id)) {
            deleted.push({
              id: item.id,
              name: String(item[nameField] ?? item.id),
              changeType: 'deleted',
              before: item,
            });
          }
        }

        (result as any)[key] = { added, updated, deleted };
      }

      return result;
    },

    addRestoreHistory: (record: Omit<RestoreHistoryRecord, 'id' | 'timestamp'>): RestoreHistoryRecord => {
      const state = get();
      const newRecord: RestoreHistoryRecord = {
        ...record,
        id: genId(),
        timestamp: Date.now(),
      };
      const newHistory = [newRecord, ...state.restoreHistory].slice(0, 50);
      set({ restoreHistory: newHistory });
      return newRecord;
    },

    getLatestRestoreRecord: (): RestoreHistoryRecord | null => {
      const state = get();
      return state.restoreHistory[0] ?? null;
    },

    clearRestoreHistory: (): void => {
      set({ restoreHistory: [] });
    },
  };
};

const persistedKeys: (keyof PersistedState)[] = [
  'campuses',
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
  'restoreHistory',
  'currentUserId',
  'checkIns',
  'triageUndoRecords',
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
