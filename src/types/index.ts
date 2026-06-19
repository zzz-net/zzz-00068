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
  | 'data_export';

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
  | 'data_conflict';

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
