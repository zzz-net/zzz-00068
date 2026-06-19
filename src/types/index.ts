export type NurseRole = 'admin' | 'senior' | 'normal';

export interface Nurse {
  id: string;
  name: string;
  role: NurseRole;
  password: string;
  createdAt: number;
}

export type BedType = 'normal' | 'negative' | 'wheelchair';
export type BedStatus = 'idle' | 'occupied' | 'isolated' | 'cleaning';

export interface Bed {
  id: string;
  bedNumber: string;
  zone: string;
  type: BedType;
  status: BedStatus;
  currentPatientId?: string;
  currentAdmissionId?: string;
  notes?: string;
  createdAt: number;
}

export interface IsolationRule {
  id: string;
  disease: string;
  requiredBedType: BedType;
  minDurationHours: number;
  crossZoneForbidden: boolean;
  createdAt: number;
}

export interface TimeSlot {
  id: string;
  label: string;
  startTime: string;
  endTime: string;
  defaultDurationMin: number;
  active: boolean;
}

export interface Patient {
  id: string;
  name: string;
  gender: 'male' | 'female';
  age: number;
  phone?: string;
  idCard?: string;
  diagnosis?: string;
  diseaseType?: string;
  createdAt: number;
}

export type AppointmentStatus = 'pending' | 'admitted' | 'completed' | 'cancelled';

export interface Appointment {
  id: string;
  patientId: string;
  bedId: string;
  slotId: string;
  appointmentDate: string;
  startTime: number;
  endTime: number;
  isolationRuleId?: string;
  status: AppointmentStatus;
  createdBy: string;
  createdAt: number;
}

export interface CreateAppointmentPayload {
  patientId?: string;
  patientInfo?: Omit<Patient, 'id' | 'createdAt'>;
  bedId: string;
  slotId: string;
  appointmentDate: string;
  startTime: number;
  endTime: number;
  isolationRuleId?: string;
  createdBy: string;
}

export type AdmissionStatus = 'in_bed' | 'discharged' | 'force_released';

export interface Admission {
  id: string;
  appointmentId?: string;
  patientId: string;
  bedId: string;
  admittedAt: number;
  dischargedAt?: number;
  status: AdmissionStatus;
  admittedBy: string;
  dischargedBy?: string;
  approvedBy?: string;
  forceReleased?: boolean;
  dischargeReason?: string;
  createdAt: number;
}

export type CareNoteType = 'observation' | 'medication' | 'treatment' | 'abnormal';

export interface CareNote {
  id: string;
  admissionId: string;
  nurseId: string;
  content: string;
  timestamp: number;
  type: CareNoteType;
  createdAt: number;
}

export type OperationType =
  | 'appointment_create'
  | 'appointment_cancel'
  | 'admission_confirm'
  | 'discharge_normal'
  | 'discharge_force'
  | 'care_note_add'
  | 'bed_config_change'
  | 'role_config_change'
  | 'data_import'
  | 'data_export'
  | 'backup_export'
  | 'backup_restore_preview'
  | 'backup_restore'
  | 'backup_restore_rollback'
  | 'backup_auto_snapshot';

export type OperationTargetType =
  | 'appointment'
  | 'admission'
  | 'bed'
  | 'nurse'
  | 'system'
  | 'isolation_rule'
  | 'time_slot'
  | 'patient'
  | 'care_note';

export interface OperationLog {
  id: string;
  type: OperationType;
  operatorId: string;
  operatorName: string;
  targetType: OperationTargetType;
  targetId?: string;
  targetName?: string;
  detail: string;
  timestamp: number;
  approvedBy?: string;
  isAbnormal: boolean;
  abnormalReason?: string;
}

export type AbnormalType =
  | 'time_overlap'
  | 'discharge_before_admit'
  | 'force_release_denied'
  | 'isolation_violation'
  | 'data_conflict'
  | 'backup_version_unknown'
  | 'backup_bed_number_conflict'
  | 'backup_patient_duplicate_admission'
  | 'backup_missing_required_field'
  | 'backup_permission_denied';

export interface AbnormalRecord {
  id: string;
  type: AbnormalType;
  operationLogId: string;
  description: string;
  bedId?: string;
  appointmentId?: string;
  handled: boolean;
  handledBy?: string;
  handledAt?: number;
  createdAt: number;
}

export interface ValidationResult {
  success: boolean;
  error?: string;
}

export type BackupRestoreEntity =
  | 'beds'
  | 'nurses'
  | 'isolationRules'
  | 'timeSlots'
  | 'patients'
  | 'appointments'
  | 'admissions'
  | 'careNotes'
  | 'operationLogs'
  | 'abnormalRecords';

export interface BackupData {
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
}

export interface BackupFile {
  version: string;
  exportedAt: string;
  data: BackupData;
}

export interface EntityDiff {
  added: number;
  updated: number;
  deleted: number;
}

export interface RestoreDiff {
  beds: EntityDiff;
  nurses: EntityDiff;
  isolationRules: EntityDiff;
  timeSlots: EntityDiff;
  patients: EntityDiff;
  appointments: EntityDiff;
  admissions: EntityDiff;
  careNotes: EntityDiff;
  operationLogs: EntityDiff;
  abnormalRecords: EntityDiff;
}

export interface ValidationIssue {
  type: AbnormalType;
  severity: 'error' | 'warning';
  message: string;
  details?: string[];
}

export interface RestorePreview {
  version: string;
  exportedAt: string;
  dataOverview: Record<BackupRestoreEntity, number>;
  diff: RestoreDiff;
  issues: ValidationIssue[];
  canRestore: boolean;
}

export interface AutoBackupSnapshot {
  id: string;
  createdAt: number;
  data: BackupData;
  name: string;
}

export interface RestoreResult {
  success: boolean;
  message: string;
  snapshotId?: string;
  error?: string;
  adminSessionPreserved?: boolean;
}

export interface RollbackResult {
  success: boolean;
  message: string;
  error?: string;
  adminSessionPreserved?: boolean;
}

export type RestoreOperationType = 'restore' | 'rollback';

export type RestoreOperationStatus = 'success' | 'failed';

export interface EntityChangeItem {
  id: string;
  name: string;
  changeType: 'added' | 'updated' | 'deleted';
  before?: any;
  after?: any;
  diffFields?: Array<{ field: string; before: any; after: any }>;
}

export interface EntityChanges {
  added: EntityChangeItem[];
  updated: EntityChangeItem[];
  deleted: EntityChangeItem[];
}

export interface RestoreDetailedDiff {
  beds: EntityChanges;
  nurses: EntityChanges;
  isolationRules: EntityChanges;
  timeSlots: EntityChanges;
  patients: EntityChanges;
  appointments: EntityChanges;
  admissions: EntityChanges;
  careNotes: EntityChanges;
  operationLogs: EntityChanges;
  abnormalRecords: EntityChanges;
}

export interface RestoreHistoryRecord {
  id: string;
  operationType: RestoreOperationType;
  status: RestoreOperationStatus;
  operatorId: string;
  operatorName: string;
  timestamp: number;
  backupVersion?: string;
  backupExportedAt?: string;
  snapshotId?: string;
  snapshotName?: string;
  rollbackSnapshotId?: string;
  rollbackSnapshotName?: string;
  message: string;
  error?: string;
  dataOverview: Record<BackupRestoreEntity, number>;
  diff: RestoreDiff;
  detailedDiff: RestoreDetailedDiff;
}
