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
} from '../types';

const now = Date.now();
const dayMs = 24 * 60 * 60 * 1000;
const today = new Date();
const todayStr = today.toISOString().slice(0, 10);

function parseTodayTime(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(today);
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

const nurses: Nurse[] = [
  { id: 'nurse-001', name: '张管理', role: 'admin', password: '123456', createdAt: now - 30 * dayMs },
  { id: 'nurse-002', name: '李高级', role: 'senior', password: '123456', createdAt: now - 25 * dayMs },
  { id: 'nurse-003', name: '王高级', role: 'senior', password: '123456', createdAt: now - 20 * dayMs },
  { id: 'nurse-004', name: '赵普通', role: 'normal', password: '123456', createdAt: now - 15 * dayMs },
  { id: 'nurse-005', name: '钱普通', role: 'normal', password: '123456', createdAt: now - 10 * dayMs },
];

const beds: Bed[] = [
  { id: 'bed-001', bedNumber: 'A-1', zone: 'A', type: 'normal', status: 'occupied', currentPatientId: 'patient-001', currentAdmissionId: 'admission-001', createdAt: now - 60 * dayMs },
  { id: 'bed-002', bedNumber: 'A-2', zone: 'A', type: 'normal', status: 'occupied', currentPatientId: 'patient-002', currentAdmissionId: 'admission-002', createdAt: now - 58 * dayMs },
  { id: 'bed-003', bedNumber: 'A-3', zone: 'A', type: 'normal', status: 'idle', createdAt: now - 55 * dayMs },
  { id: 'bed-004', bedNumber: 'A-4', zone: 'A', type: 'normal', status: 'cleaning', notes: '终末消毒中', createdAt: now - 50 * dayMs },
  { id: 'bed-005', bedNumber: 'A-5', zone: 'A', type: 'negative', status: 'isolated', currentPatientId: 'patient-003', currentAdmissionId: 'admission-003', notes: '新冠隔离中', createdAt: now - 45 * dayMs },
  { id: 'bed-006', bedNumber: 'A-6', zone: 'A', type: 'wheelchair', status: 'idle', createdAt: now - 40 * dayMs },
  { id: 'bed-007', bedNumber: 'B-7', zone: 'B', type: 'normal', status: 'idle', createdAt: now - 35 * dayMs },
  { id: 'bed-008', bedNumber: 'B-8', zone: 'B', type: 'normal', status: 'idle', createdAt: now - 30 * dayMs },
  { id: 'bed-009', bedNumber: 'B-9', zone: 'B', type: 'normal', status: 'idle', createdAt: now - 25 * dayMs },
  { id: 'bed-010', bedNumber: 'B-10', zone: 'B', type: 'normal', status: 'idle', createdAt: now - 20 * dayMs },
  { id: 'bed-011', bedNumber: 'B-11', zone: 'B', type: 'negative', status: 'idle', createdAt: now - 15 * dayMs },
  { id: 'bed-012', bedNumber: 'B-12', zone: 'B', type: 'wheelchair', status: 'idle', createdAt: now - 10 * dayMs },
];

const isolationRules: IsolationRule[] = [
  { id: 'rule-001', disease: '新型冠状病毒感染', requiredBedType: 'negative', minDurationHours: 0, crossZoneForbidden: true, createdAt: now - 90 * dayMs },
  { id: 'rule-002', disease: '流行性感冒', requiredBedType: 'normal', minDurationHours: 4, crossZoneForbidden: false, createdAt: now - 80 * dayMs },
  { id: 'rule-003', disease: '多重耐药菌感染', requiredBedType: 'negative', minDurationHours: 6, crossZoneForbidden: true, createdAt: now - 70 * dayMs },
];

const timeSlots: TimeSlot[] = [
  { id: 'slot-001', label: '上午', startTime: '08:00', endTime: '12:00', defaultDurationMin: 240, active: true },
  { id: 'slot-002', label: '下午', startTime: '13:00', endTime: '17:00', defaultDurationMin: 240, active: true },
  { id: 'slot-003', label: '晚间', startTime: '17:30', endTime: '20:30', defaultDurationMin: 180, active: true },
];

const patients: Patient[] = [
  { id: 'patient-001', name: '陈大伟', gender: 'male', age: 65, phone: '13800138001', idCard: '110101196001011234', diagnosis: '慢性支气管炎急性加重', diseaseType: '呼吸系统', createdAt: now - 15 * dayMs },
  { id: 'patient-002', name: '刘美丽', gender: 'female', age: 58, phone: '13800138002', idCard: '110101196702022345', diagnosis: '高血压3级', diseaseType: '心血管系统', createdAt: now - 12 * dayMs },
  { id: 'patient-003', name: '王建国', gender: 'male', age: 72, phone: '13800138003', idCard: '110101195303033456', diagnosis: '新型冠状病毒感染', diseaseType: '传染性疾病', createdAt: now - 5 * dayMs },
  { id: 'patient-004', name: '赵秀兰', gender: 'female', age: 80, phone: '13800138004', idCard: '110101194504044567', diagnosis: '糖尿病足', diseaseType: '内分泌系统', createdAt: now - 10 * dayMs },
  { id: 'patient-005', name: '孙志强', gender: 'male', age: 45, phone: '13800138005', idCard: '110101198005055678', diagnosis: '流行性感冒', diseaseType: '传染性疾病', createdAt: now - 3 * dayMs },
  { id: 'patient-006', name: '周婷婷', gender: 'female', age: 32, phone: '13800138006', idCard: '110101199306066789', diagnosis: '急性胃肠炎', diseaseType: '消化系统', createdAt: now - 2 * dayMs },
  { id: 'patient-007', name: '吴明辉', gender: 'male', age: 55, phone: '13800138007', idCard: '110101197007077890', diagnosis: '脑梗死后遗症', diseaseType: '神经系统', createdAt: now - 20 * dayMs },
  { id: 'patient-008', name: '郑丽华', gender: 'female', age: 68, phone: '13800138008', idCard: '110101195708088901', diagnosis: '髋关节置换术后', diseaseType: '骨科术后', createdAt: now - 7 * dayMs },
];

const appointments: Appointment[] = [
  { id: 'appointment-001', patientId: 'patient-005', bedId: 'bed-003', slotId: 'slot-001', appointmentDate: todayStr, startTime: parseTodayTime('08:00'), endTime: parseTodayTime('12:00'), isolationRuleId: 'rule-002', status: 'pending', createdBy: 'nurse-004', createdAt: now - 2 * 60 * 60 * 1000 },
  { id: 'appointment-002', patientId: 'patient-006', bedId: 'bed-007', slotId: 'slot-002', appointmentDate: todayStr, startTime: parseTodayTime('13:00'), endTime: parseTodayTime('17:00'), status: 'admitted', createdBy: 'nurse-005', createdAt: now - 5 * 60 * 60 * 1000 },
  { id: 'appointment-003', patientId: 'patient-008', bedId: 'bed-006', slotId: 'slot-001', appointmentDate: todayStr, startTime: parseTodayTime('08:30'), endTime: parseTodayTime('12:00'), status: 'completed', createdBy: 'nurse-002', createdAt: now - 8 * 60 * 60 * 1000 },
  { id: 'appointment-004', patientId: 'patient-007', bedId: 'bed-008', slotId: 'slot-003', appointmentDate: todayStr, startTime: parseTodayTime('17:30'), endTime: parseTodayTime('20:30'), status: 'pending', createdBy: 'nurse-003', createdAt: now - 1 * 60 * 60 * 1000 },
  { id: 'appointment-005', patientId: 'patient-004', bedId: 'bed-009', slotId: 'slot-002', appointmentDate: todayStr, startTime: parseTodayTime('14:00'), endTime: parseTodayTime('17:00'), status: 'cancelled', createdBy: 'nurse-004', createdAt: now - 12 * 60 * 60 * 1000 },
];

const admissions: Admission[] = [
  { id: 'admission-001', appointmentId: 'appointment-001', patientId: 'patient-001', bedId: 'bed-001', admittedAt: now - 3 * dayMs, status: 'in_bed', admittedBy: 'nurse-002', createdAt: now - 3 * dayMs },
  { id: 'admission-002', appointmentId: 'appointment-002', patientId: 'patient-002', bedId: 'bed-002', admittedAt: now - 2 * dayMs, status: 'in_bed', admittedBy: 'nurse-003', createdAt: now - 2 * dayMs },
  { id: 'admission-003', appointmentId: 'appointment-003', patientId: 'patient-003', bedId: 'bed-005', admittedAt: now - 1 * dayMs, status: 'discharged', dischargedAt: now - 6 * 60 * 60 * 1000, admittedBy: 'nurse-002', dischargedBy: 'nurse-001', dischargeReason: '病情好转，准予出院', createdAt: now - 1 * dayMs },
];

const careNotes: CareNote[] = [
  { id: 'care-note-001', admissionId: 'admission-001', nurseId: 'nurse-004', content: '患者主诉咳嗽咳痰，遵医嘱予雾化吸入治疗，症状较前缓解。生命体征平稳。', timestamp: now - 2 * dayMs, type: 'treatment', createdAt: now - 2 * dayMs },
  { id: 'care-note-002', admissionId: 'admission-001', nurseId: 'nurse-005', content: '血压135/85mmHg，心率82次/分，呼吸18次/分，体温36.8℃。神志清楚，精神尚可。', timestamp: now - 20 * 60 * 60 * 1000, type: 'observation', createdAt: now - 20 * 60 * 60 * 1000 },
  { id: 'care-note-003', admissionId: 'admission-002', nurseId: 'nurse-004', content: '遵医嘱予硝苯地平缓释片30mg口服qd，监测血压波动情况。', timestamp: now - 1 * dayMs, type: 'medication', createdAt: now - 1 * dayMs },
  { id: 'care-note-004', admissionId: 'admission-002', nurseId: 'nurse-002', content: '患者诉头晕，测血压158/95mmHg，报告值班医师，遵医嘱加服降压药，30分钟后复测142/88mmHg。', timestamp: now - 10 * 60 * 60 * 1000, type: 'abnormal', createdAt: now - 10 * 60 * 60 * 1000 },
  { id: 'care-note-005', admissionId: 'admission-003', nurseId: 'nurse-003', content: '患者入院时体温38.5℃，伴干咳，予抗病毒治疗及对症处理。', timestamp: now - 1 * dayMs, type: 'treatment', createdAt: now - 1 * dayMs },
  { id: 'care-note-006', admissionId: 'admission-003', nurseId: 'nurse-005', content: '患者体温恢复正常，呼吸道症状明显改善，核酸检测阴性，符合出院标准。', timestamp: now - 8 * 60 * 60 * 1000, type: 'observation', createdAt: now - 8 * 60 * 60 * 1000 },
];

const operationLogs: OperationLog[] = [
  { id: 'op-log-001', type: 'bed_config_change', operatorId: 'nurse-004', operatorName: '赵普通', targetType: 'patient', targetId: 'patient-001', targetName: '陈大伟', detail: '创建患者档案：陈大伟，男，65岁，诊断慢性支气管炎急性加重', timestamp: now - 15 * dayMs, isAbnormal: false },
  { id: 'op-log-002', type: 'appointment_create', operatorId: 'nurse-002', operatorName: '李高级', targetType: 'appointment', targetId: 'appointment-001', targetName: '陈大伟-A-1床预约', detail: '创建预约：患者陈大伟预约A-1床，上午时段', timestamp: now - 4 * dayMs, isAbnormal: false },
  { id: 'op-log-003', type: 'admission_confirm', operatorId: 'nurse-002', operatorName: '李高级', targetType: 'admission', targetId: 'admission-001', targetName: '陈大伟住院', detail: '确认入院：患者陈大伟入住A-1床', timestamp: now - 3 * dayMs, isAbnormal: false, approvedBy: 'nurse-001' },
  { id: 'op-log-004', type: 'care_note_add', operatorId: 'nurse-004', operatorName: '赵普通', targetType: 'care_note', targetId: 'care-note-001', targetName: '护理记录', detail: '添加护理记录：admission-001雾化吸入治疗', timestamp: now - 2 * dayMs, isAbnormal: false },
  { id: 'op-log-005', type: 'discharge_normal', operatorId: 'nurse-001', operatorName: '张管理', targetType: 'admission', targetId: 'admission-003', targetName: '王建国出院', detail: '办理出院：患者王建国病情好转准予出院，A-5床释放', timestamp: now - 6 * 60 * 60 * 1000, isAbnormal: false, approvedBy: 'nurse-001' },
  { id: 'op-log-006', type: 'bed_config_change', operatorId: 'nurse-005', operatorName: '钱普通', targetType: 'bed', targetId: 'bed-004', targetName: 'A-4床', detail: '更新床位状态：A-4床设置为cleaning，进行终末消毒', timestamp: now - 4 * 60 * 60 * 1000, isAbnormal: false },
  { id: 'op-log-007', type: 'appointment_cancel', operatorId: 'nurse-004', operatorName: '赵普通', targetType: 'appointment', targetId: 'appointment-005', targetName: '赵秀兰-B-9床预约取消', detail: '取消预约：患者赵秀兰个人原因取消B-9床下午预约', timestamp: now - 3 * 60 * 60 * 1000, isAbnormal: false },
  { id: 'op-log-008', type: 'discharge_force', operatorId: 'nurse-001', operatorName: '张管理', targetType: 'bed', targetId: 'bed-010', targetName: 'B-10床', detail: '强制释放床位：跨区违规操作，超常规释放B-10床', timestamp: now - 2 * 60 * 60 * 1000, isAbnormal: true, abnormalReason: '跨区操作+isolation_violation规则冲突', approvedBy: 'nurse-001' },
];

const abnormalRecords: AbnormalRecord[] = [
  { id: 'abnormal-001', type: 'isolation_violation', operationLogId: 'op-log-008', description: '操作涉及跨区床位调动，但耐药菌感染隔离规则禁止跨区，已触发异常告警，需要管理员审核确认。', bedId: 'bed-010', handled: false, createdAt: now - 2 * 60 * 60 * 1000 },
  { id: 'abnormal-002', type: 'force_release_denied', operationLogId: 'op-log-008', description: '强制释放B-10床操作，已由管理员张管理审批通过，但记录异常留痕备查。', bedId: 'bed-010', handled: true, handledBy: 'nurse-001', handledAt: now - 1 * 60 * 60 * 1000, createdAt: now - 2 * 60 * 60 * 1000 },
];

export interface SampleData {
  nurses: Nurse[];
  beds: Bed[];
  isolationRules: IsolationRule[];
  timeSlots: TimeSlot[];
  patients: Patient[];
  appointments: Appointment[];
  admissions: Admission[];
  careNotes: CareNote[];
  operationLogs: OperationLog[];
  abnormalRecords: AbnormalRecord[];
}

export const sampleData: SampleData = {
  nurses,
  beds,
  isolationRules,
  timeSlots,
  patients,
  appointments,
  admissions,
  careNotes,
  operationLogs,
  abnormalRecords,
};
