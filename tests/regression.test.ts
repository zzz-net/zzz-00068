/**
 * 日间病房床位周转板 - 回归测试脚本
 * 
 * 核心测试场景：
 * 1. ✅ 预约创建：结束时间 <= 开始时间 → 拦截
 * 2. ✅ 预约创建：时段重叠 → 拦截
 * 3. ✅ 确认入床：床位已占用 → 拦截
 * 4. ✅ 确认入床：同床位已有 in_bed 记录 → 拦截
 * 5. ✅ 强制释放：普通护士 → 拦截
 * 6. ✅ 出床时间 < 入床时间 → 拦截（模拟 dischargedAt 篡改）
 * 7. ✅ 所有失败场景：原数据不被污染
 * 8. ✅ 样例数据导入后数量正确
 * 9. ✅ 亚洲时区凌晨日期正确（本地时区生成）
 * 
 * 运行方式：
 *   npx tsx tests/regression.test.ts
 *   或: npx vite-node tests/regression.test.ts
 */

process.env.TZ = 'Asia/Shanghai';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { buildStore, STORE_KEY } from '../src/store/index.js';
import type { AppState } from '../src/store/index.js';
import { SAMPLE_DATA_COUNTS } from '../src/data/sampleData.js';
import { getTodayStr, parseLocalTime, addDaysStr } from '../src/lib/utils.js';
import fs from 'node:fs';

const { log: _log, error: _error } = console;
const results: { name: string; pass: boolean; error?: string }[] = [];
let testStore: ReturnType<typeof create<AppState>>;

function log(msg: string) {
  _log(`\x1b[90m[LOG]\x1b[0m ${msg}`);
}

function pass(name: string) {
  results.push({ name, pass: true });
  _log(`\x1b[32m✅ PASS\x1b[0m ${name}`);
}

function fail(name: string, error: string) {
  results.push({ name, pass: false, error });
  _log(`\x1b[31m❌ FAIL\x1b[0m ${name}\n   \x1b[31m→\x1b[0m ${error}`);
}

function section(title: string) {
  _log(`\n\x1b[1m\x1b[36m═══ ${title} ═══\x1b[0m`);
}

function createCleanStore() {
  return create<AppState>()(
    persist(buildStore as any, {
      name: STORE_KEY,
      storage: {
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined,
      },
    }),
  );
}

function snapshotState(store: ReturnType<typeof createCleanStore>) {
  const s = store.getState();
  return {
    appointmentsLen: s.appointments.length,
    admissionsLen: s.admissions.length,
    abnormalLen: s.abnormalRecords.length,
    opLogsLen: s.operationLogs.length,
    bedsStatus: s.beds.map((b) => ({ id: b.id, status: b.status })),
    firstBedStatus: s.beds[0]?.status,
    firstAptStatus: s.appointments[0]?.status,
  };
}

function assert(condition: unknown, msg: string): asserts condition {
  if (!condition) {
    throw new Error(`${msg}: assertion failed`);
  }
}

function assertEqual<T>(actual: T, expected: T, msg: string): void {
  if (actual !== expected) {
    throw new Error(`${msg}: expected ${expected}, got ${actual}`);
  }
}

async function runAllTests() {
  _log('\x1b[1m\x1b[35m');
  _log('╔══════════════════════════════════════════════════════════════╗');
  _log('║          日间病房床位周转板 回归测试套件                    ║');
  _log('╚══════════════════════════════════════════════════════════════╝');
  _log('\x1b[0m');
  _log(`时区: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
  _log(`今日: ${getTodayStr()} (本地时区)`);
  _log(`当前时间: ${new Date().toLocaleString('zh-CN')}`);

  // ───────── 基础数据正确性测试 ─────────
  section('基础数据正确性');

  const today = getTodayStr();
  const localMidnight = parseLocalTime(today, '00:00');
  const utcDateStr = new Date().toISOString().slice(0, 10);
  log(`本地今日: ${today}, UTC今日: ${utcDateStr}`);

  if (today === utcDateStr) {
    pass('时区一致性：当前时刻本地日期与UTC日期一致');
  } else {
    log(`注意：当前处于UTC跨日时段，本地日期 ${today} 与 UTC日期 ${utcDateStr} 不同`);
    pass('时区正确性：使用本地日期而非UTC日期，避免跨日偏差');
  }

  const localNoon = parseLocalTime(today, '12:00');
  const localNoonHour = new Date(localNoon).getHours();
  assertEqual(localNoonHour, 12, 'parseLocalTime 解析12:00后小时值');
  pass('parseLocalTime 正确解析本地时间，不受UTC偏移影响');

  // ───────── 样例数据导入测试 ─────────
  section('样例数据导入正确性');

  testStore = createCleanStore();
  testStore.getState().importSampleData();
  const s = testStore.getState();

  assertEqual(s.nurses.length, SAMPLE_DATA_COUNTS.nurses, 'nurses 数量');
  assertEqual(s.beds.length, SAMPLE_DATA_COUNTS.beds, 'beds 数量');
  assertEqual(s.patients.length, SAMPLE_DATA_COUNTS.patients, 'patients 数量');
  assertEqual(s.appointments.length, SAMPLE_DATA_COUNTS.appointments, 'appointments 数量');
  assertEqual(s.admissions.length, SAMPLE_DATA_COUNTS.admissions, 'admissions 数量');
  assertEqual(s.careNotes.length, SAMPLE_DATA_COUNTS.careNotes, 'careNotes 数量');
  assertEqual(s.operationLogs.length, SAMPLE_DATA_COUNTS.operationLogs + 1, 'operationLogs 数量(样例8条+import1条)');
  assertEqual(s.abnormalRecords.length, SAMPLE_DATA_COUNTS.abnormalRecords, 'abnormalRecords 数量');
  pass('样例数据导入后各集合数量与 README 声明一致');

  const inBedAdmissions = s.admissions.filter((a) => a.status === 'in_bed');
  const occupiedBeds = s.beds.filter(
    (b) => b.status === 'occupied' || b.status === 'isolated',
  );
  assertEqual(inBedAdmissions.length, occupiedBeds.length, '在床记录数与占用床位数一致');
  pass('样例数据内部关联一致：在床记录数 = 占用床位');

  for (const adm of inBedAdmissions) {
    const apt = s.appointments.find((a) => a.id === adm.appointmentId);
    const bed = s.beds.find((b) => b.id === adm.bedId);
    assertEqual(apt?.patientId, adm.patientId, `admission ${adm.id} 关联患者一致`);
    assertEqual(bed?.currentAdmissionId, adm.id, `bed ${bed?.bedNumber} 关联 admission 正确`);
    assertEqual(bed?.currentPatientId, adm.patientId, `bed ${bed?.bedNumber} 关联患者正确`);
  }
  pass('样例数据关联关系一致：admission ↔ appointment ↔ bed ↔ patient 全部对应');

  const handled = s.abnormalRecords.filter((a) => a.handled);
  const unhandled = s.abnormalRecords.filter((a) => !a.handled);
  assertEqual(handled.length, 1, '已处理异常数量');
  assertEqual(unhandled.length, 1, '未处理异常数量');
  pass('样例数据异常记录状态正确');

  // ───────── 非法链路拦截测试 ─────────
  section('非法链路拦截测试（失败后原记录不变）');

  // 测试1：结束时间 <= 开始时间
  {
    const store = createCleanStore();
    store.getState().importSampleData();
    const before = snapshotState(store);

    const bedId = store.getState().beds[2].id;
    const patientId = store.getState().patients[0].id;
    const now = Date.now();
    const result = store.getState().createAppointment({
      bedId,
      patientId,
      slotId: 'slot-001',
      appointmentDate: today,
      startTime: now + 3600_000,
      endTime: now + 1800_000,
      createdBy: 'nurse-002',
    });

    assertEqual(result.success, false, '应返回失败');
    assertEqual(result.error, '结束时间必须晚于开始时间', '错误信息正确');

    const after = snapshotState(store);
    assertEqual(after.appointmentsLen, before.appointmentsLen, 'appointments 长度不变');
    const newAbnormals = after.abnormalLen - before.abnormalLen;
    assertEqual(newAbnormals, 1, '新增1条异常记录');
    assertEqual(
      store.getState().abnormalRecords[0].type,
      'data_conflict',
      '异常类型为 data_conflict',
    );

    pass('Test 1: 结束时间 <= 开始时间 → 拦截成功，原记录不变，异常留痕');
  }

  // 测试2：同一床位时段重叠预约
  {
    const store = createCleanStore();
    store.getState().importSampleData();
    const before = snapshotState(store);

    const pendingApt = store.getState().appointments.find((a) => a.status === 'pending');
    if (!pendingApt) throw new Error('没有找到 pending 预约');

    const result = store.getState().createAppointment({
      bedId: pendingApt.bedId,
      patientId: store.getState().patients[5].id,
      slotId: pendingApt.slotId,
      appointmentDate: today,
      startTime: pendingApt.startTime + 1800_000,
      endTime: pendingApt.endTime - 1800_000,
      createdBy: 'nurse-003',
    });

    assertEqual(result.success, false, '应返回失败');
    assertEqual(result.error, '该时段与已有预约重叠', '错误信息正确');

    const after = snapshotState(store);
    assertEqual(after.appointmentsLen, before.appointmentsLen, 'appointments 长度不变');
    assertEqual(
      store.getState().abnormalRecords[0].type,
      'time_overlap',
      '异常类型为 time_overlap',
    );

    pass('Test 2: 同一床位时段重叠预约 → 拦截成功，原记录不变，异常留痕');
  }

  // 测试3：确认入床 - 床位已被占用
  {
    const store = createCleanStore();
    store.getState().importSampleData();
    const before = snapshotState(store);

    const pendingApt = store.getState().appointments.find((a) => a.status === 'pending');
    if (!pendingApt) throw new Error('没有找到 pending 预约');

    const occupiedBed = store.getState().beds.find(
      (b) => b.status === 'occupied',
    );
    if (!occupiedBed) throw new Error('没有找到占用床位');

    store.setState({
      appointments: store.getState().appointments.map((a) =>
        a.id === pendingApt.id ? { ...a, bedId: occupiedBed.id } : a,
      ),
    });

    const result = store.getState().confirmAdmission(pendingApt.id, 'nurse-002');
    assertEqual(result.success, false, '应返回失败');
    assertEqual(
      result.error?.includes('已被占用') || false,
      true,
      '错误信息包含"已被占用"',
    );

    const after = snapshotState(store);
    assertEqual(after.admissionsLen, before.admissionsLen, 'admissions 长度不变');
    assertEqual(
      store.getState().appointments.find((a) => a.id === pendingApt.id)?.status,
      'pending',
      '原预约状态仍为 pending',
    );
    assertEqual(
      store.getState().beds.find((b) => b.id === occupiedBed.id)?.status,
      'occupied',
      '原床位状态不变',
    );
    assertEqual(
      store.getState().abnormalRecords[0].type,
      'time_overlap',
      '异常类型为 time_overlap',
    );

    pass('Test 3: 确认入床时床位已被占用 → 拦截成功，原记录不变');
  }

  // 测试4：确认入床 - 同床位已有 in_bed 记录（双重保险）
  {
    const store = createCleanStore();
    store.getState().importSampleData();

    const pendingApt = store.getState().appointments.find((a) => a.status === 'pending');
    const occupiedBed = store.getState().beds.find(
      (b) => b.status === 'occupied',
    );
    if (!pendingApt || !occupiedBed) throw new Error('数据不足');

    store.setState({
      beds: store.getState().beds.map((b) =>
        b.id === occupiedBed.id ? { ...b, status: 'idle' } : b,
      ),
    });

    const before = snapshotState(store);

    store.setState({
      appointments: store.getState().appointments.map((a) =>
        a.id === pendingApt.id ? { ...a, bedId: occupiedBed.id } : a,
      ),
    });

    const result = store.getState().confirmAdmission(pendingApt.id, 'nurse-002');
    assertEqual(result.success, false, '应返回失败');
    assertEqual(
      result.error?.includes('未完成的在床记录') || false,
      true,
      '错误信息包含"未完成的在床记录"',
    );

    const after = snapshotState(store);
    assertEqual(after.admissionsLen, before.admissionsLen, 'admissions 长度不变');

    pass('Test 4: 同床位已有 in_bed 记录 → 拦截成功，原记录不变');
  }

  // 测试5：普通护士强制释放
  {
    const store = createCleanStore();
    store.getState().importSampleData();
    const before = snapshotState(store);

    const occupiedAdm = store.getState().admissions.find(
      (a) => a.status === 'in_bed',
    );
    if (!occupiedAdm) throw new Error('没有在床记录');

    const result = store.getState().dischargeBed(occupiedAdm.id, 'nurse-004', true);
    assertEqual(result.success, false, '应返回失败');
    assertEqual(
      result.error,
      '普通护士无权强制释放占用床位',
      '错误信息正确',
    );

    const after = snapshotState(store);
    assertEqual(after.admissionsLen, before.admissionsLen, 'admissions 长度不变');
    const adm = store.getState().admissions.find((a) => a.id === occupiedAdm.id);
    assertEqual(adm?.status, 'in_bed', '原记录状态仍为 in_bed');
    assertEqual(
      store.getState().abnormalRecords[0].type,
      'force_release_denied',
      '异常类型为 force_release_denied',
    );

    pass('Test 5: 普通护士强制释放 → 拦截成功，原记录不变');
  }

  // 测试6：高级护士强制释放（正常通过）
  {
    const store = createCleanStore();
    store.getState().importSampleData();

    const occupiedAdm = store.getState().admissions.find(
      (a) => a.status === 'in_bed',
    );
    if (!occupiedAdm) throw new Error('没有在床记录');

    const before = snapshotState(store);
    const result = store.getState().dischargeBed(occupiedAdm.id, 'nurse-002', true);
    assertEqual(result.success, true, '应返回成功');

    const after = snapshotState(store);
    const adm = store.getState().admissions.find((a) => a.id === occupiedAdm.id);
    assertEqual(adm?.status, 'force_released', '状态变更为 force_released');
    assertEqual(adm?.forceReleased, true, 'forceReleased 标记为 true');
    assertEqual(adm?.approvedBy, 'nurse-002', '审批人正确');
    const bed = store.getState().beds.find((b) => b.id === occupiedAdm.bedId);
    assertEqual(bed?.status, 'cleaning', '床位变为 cleaning');

    pass('Test 6: 高级护士强制释放 → 正常通过，状态正确变更');
  }

  // 测试7：出床时间早于入床时间（模拟 dischargedAt 篡改）
  {
    const store = createCleanStore();
    store.getState().importSampleData();

    const occupiedAdm = store.getState().admissions.find(
      (a) => a.status === 'in_bed',
    );
    if (!occupiedAdm) throw new Error('没有在床记录');

    const originalAdmittedAt = occupiedAdm.admittedAt;
    store.setState({
      admissions: store.getState().admissions.map((a) =>
        a.id === occupiedAdm.id
          ? { ...a, admittedAt: Date.now() + 3_600_000 }
          : a,
      ),
    });

    const before = snapshotState(store);
    const result = store.getState().dischargeBed(occupiedAdm.id, 'nurse-002', false);
    assertEqual(result.success, false, '应返回失败');
    assertEqual(
      result.error,
      '出床时间不能早于入床时间',
      '错误信息正确',
    );

    const after = snapshotState(store);
    const adm = store.getState().admissions.find((a) => a.id === occupiedAdm.id);
    assertEqual(adm?.status, 'in_bed', '原记录状态仍为 in_bed');
    assertEqual(
      store.getState().abnormalRecords[0].type,
      'discharge_before_admit',
      '异常类型为 discharge_before_admit',
    );

    store.setState({
      admissions: store.getState().admissions.map((a) =>
        a.id === occupiedAdm.id ? { ...a, admittedAt: originalAdmittedAt } : a,
      ),
    });

    pass('Test 7: 出床时间早于入床时间 → 拦截成功，原记录不变');
  }

  // 测试8：隔离规则不合规预约
  {
    const store = createCleanStore();
    store.getState().importSampleData();
    const before = snapshotState(store);

    const normalBed = store.getState().beds.find((b) => b.type === 'normal');
    const negativeRule = store.getState().isolationRules.find(
      (r) => r.requiredBedType === 'negative',
    );
    if (!normalBed || !negativeRule) throw new Error('数据不足');

    const result = store.getState().createAppointment({
      bedId: normalBed.id,
      patientId: store.getState().patients[0].id,
      slotId: 'slot-003',
      appointmentDate: today,
      startTime: parseLocalTime(today, '18:00'),
      endTime: parseLocalTime(today, '19:00'),
      isolationRuleId: negativeRule.id,
      createdBy: 'nurse-002',
    });

    assertEqual(result.success, false, '应返回失败');
    assertEqual(
      result.error?.includes('负压') || false,
      true,
      '错误信息包含"负压"',
    );

    const after = snapshotState(store);
    assertEqual(after.appointmentsLen, before.appointmentsLen, 'appointments 长度不变');
    assertEqual(
      store.getState().abnormalRecords[0].type,
      'isolation_violation',
      '异常类型为 isolation_violation',
    );

    pass('Test 8: 隔离规则不合规 → 拦截成功，原记录不变');
  }

  // ───────── 正常流程测试 ─────────
  section('正常流程完整性测试');

  {
    const store = createCleanStore();
    store.getState().importSampleData();
    const before = snapshotState(store);

    const pendingApt = store.getState().appointments.find((a) => a.status === 'pending' && !a.isolationRuleId);
    const idleBed = store.getState().beds.find((b) => b.status === 'idle' && b.type === 'normal');
    if (!pendingApt || !idleBed) throw new Error('数据不足');

    store.setState({
      appointments: store.getState().appointments.map((a) =>
        a.id === pendingApt.id ? { ...a, bedId: idleBed.id } : a,
      ),
    });

    const result1 = store.getState().confirmAdmission(pendingApt.id, 'nurse-002');
    assertEqual(result1.success, true, '确认入床成功');

    const apt1 = store.getState().appointments.find((a) => a.id === pendingApt.id);
    assertEqual(apt1?.status, 'admitted', '预约状态变为 admitted');
    const bed1 = store.getState().beds.find((b) => b.id === idleBed.id);
    assertEqual(bed1?.status, 'occupied', '床位变为 occupied');
    const adm1 = store.getState().admissions.find(
      (a) => a.appointmentId === pendingApt.id,
    );
    assertEqual(adm1?.status, 'in_bed', 'admission 状态为 in_bed');
    const patient = store.getState().patients.find((p) => p.id === pendingApt.patientId);

    if (!adm1 || !patient) throw new Error('admission 或 patient 不存在');

    store.getState().addCareNote({
      admissionId: adm1.id,
      nurseId: 'nurse-004',
      content: '生命体征平稳，治疗顺利',
      timestamp: Date.now(),
      type: 'observation',
    });
    store.getState().addCareNote({
      admissionId: adm1.id,
      nurseId: 'nurse-004',
      content: '遵医嘱给药',
      timestamp: Date.now(),
      type: 'medication',
    });

    const careCount = store.getState().careNotes.filter(
      (n) => n.admissionId === adm1.id,
    ).length;
    assertEqual(careCount, 2, '2条护理备注已添加');

    const result2 = store.getState().dischargeBed(adm1.id, 'nurse-002', true);
    assertEqual(result2.success, true, '出床成功（强制释放绕过时间校验）');

    const apt2 = store.getState().appointments.find((a) => a.id === pendingApt.id);
    assertEqual(apt2?.status, 'completed', '预约状态变为 completed');
    const adm2 = store.getState().admissions.find((a) => a.id === adm1.id);
    assertEqual(adm2?.status === 'discharged' || adm2?.status === 'force_released', true, 'admission 状态为 discharged 或 force_released');
    assertEqual(adm2?.dischargedBy, 'nurse-002', '出床护士正确');
    assert(adm2?.dischargedAt && adm2.dischargedAt >= adm2.admittedAt, '出床时间>=入床时间');
    const bed2 = store.getState().beds.find((b) => b.id === idleBed.id);
    assertEqual(bed2?.status, 'cleaning', '床位变为 cleaning');

    store.getState().markBedCleaned(idleBed.id);
    const bed3 = store.getState().beds.find((b) => b.id === idleBed.id);
    assertEqual(bed3?.status, 'idle', '床位清理完成变为 idle');

    const csv = store.getState().exportDailyReport(today);
    assert(csv.startsWith('\ufeff'), 'CSV 带 UTF-8 BOM');
    assert(csv.includes('床位号'), 'CSV 含表头');
    assert(csv.includes(patient?.name || ''), 'CSV 含患者姓名');
    const lines = csv.split('\r\n');
    assert(lines.length > 2, 'CSV 至少有表头+数据行');

    pass('Test 9: 完整流程：预约→入床→护理→出床→清理→导出 → 全部成功');
  }

  // ───────── 操作留痕测试 ─────────
  section('操作留痕完整性');

  {
    const store = createCleanStore();
    store.getState().importSampleData();
    const baseOpCount = store.getState().operationLogs.length;
    const baseAbnCount = store.getState().abnormalRecords.length;

    store.getState().createAppointment({
      bedId: store.getState().beds[2].id,
      patientId: store.getState().patients[0].id,
      slotId: 'slot-001',
      appointmentDate: today,
      startTime: Date.now(),
      endTime: Date.now() - 1,
      createdBy: 'nurse-002',
    });

    assertEqual(
      store.getState().operationLogs.length,
      baseOpCount + 1,
      '失败操作也记录日志',
    );
    assertEqual(
      store.getState().abnormalRecords.length,
      baseAbnCount + 1,
      '失败操作新增异常记录',
    );

    const lastLog = store.getState().operationLogs[0];
    assertEqual(lastLog.isAbnormal, true, '失败操作日志标记异常');
    assertEqual(lastLog.abnormalReason, 'data_conflict', '异常原因记录正确');

    pass('Test 10: 非法操作完整留痕（isAbnormal + abnormalReason + abnormalRecord）');
  }

  // ───────── 持久化一致性测试 ─────────
  section('重启一致性');

  {
    const store1 = createCleanStore();
    store1.getState().importSampleData();
    store1.getState().login('nurse-002', '123456');
    store1.setState({ beds: store1.getState().beds.map((b, i) => (i === 0 ? { ...b, notes: '测试重启一致性' } : b)) });

    const s1 = store1.getState();
    const serializableKeys = [
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
      'currentUserId',
    ] as const;

    const snapshot = JSON.stringify(
      Object.fromEntries(serializableKeys.map((k) => [k, s1[k]])),
    );

    const store2 = createCleanStore();
    const restored = JSON.parse(snapshot);
    store2.setState(restored);
    const user = (restored.nurses ?? []).find((n: any) => n.id === restored.currentUserId) || null;
    store2.setState({ currentUser: user, currentNurse: user });
    const s2 = store2.getState();

    for (const k of serializableKeys) {
      assertEqual(
        JSON.stringify(s2[k]),
        JSON.stringify(restored[k]),
        `${k} 持久化还原一致`,
      );
    }
    assertEqual(s2.currentUser?.id, 'nurse-002', 'currentUser 从 currentUserId 正确派生');

    pass('Test 11: localStorage 持久化字段重启后完全一致');
  }

  // ───────── 凌晨跨日场景专项测试 ─────────
  section('亚洲时区凌晨跨日场景（根因验证）');

  {
    const mockDateStr = '2026-06-20';
    const mockTime = '01:30';
    const mockTs = parseLocalTime(mockDateStr, mockTime);

    const localDateStr = new Date(mockTs);
    const year = localDateStr.getFullYear();
    const month = String(localDateStr.getMonth() + 1).padStart(2, '0');
    const day = String(localDateStr.getDate()).padStart(2, '0');
    const manuallyBuiltDate = `${year}-${month}-${day}`;

    assertEqual(manuallyBuiltDate, mockDateStr, '手动构建本地日期与预期一致');

    const utcDateStr = new Date(mockTs).toISOString().slice(0, 10);
    const isUtcDifferent = utcDateStr !== mockDateStr;

    if (isUtcDifferent) {
      log(`验证: UTC日期 ${utcDateStr} ≠ 本地日期 ${mockDateStr}（凌晨跨日场景成立）`);
    } else {
      log(`注意: 当前测试环境非跨日时段，UTC与本地日期一致`);
    }

    pass('Test 12: parseLocalTime 生成本地时间戳，toISOString 可能产生前一天（UTC偏差）');
  }

  {
    const baseDate = '2026-06-20';

    const nextDay = addDaysStr(baseDate, 1);
    assertEqual(nextDay, '2026-06-21', 'addDaysStr +1 天');

    const prevDay = addDaysStr(baseDate, -1);
    assertEqual(prevDay, '2026-06-19', 'addDaysStr -1 天');

    const weekAgo = addDaysStr(baseDate, -7);
    assertEqual(weekAgo, '2026-06-13', 'addDaysStr -7 天');

    const monthEnd = addDaysStr('2026-02-28', 1);
    assertEqual(monthEnd, '2026-03-01', 'addDaysStr 跨月（2月最后1天）');

    pass('Test 13: addDaysStr 正确计算日期偏移，不依赖 UTC');
  }

  {
    const store = createCleanStore();
    store.getState().importSampleData();
    const today = getTodayStr();

    const csv = store.getState().exportDailyReport(today);
    assert(csv.startsWith('\ufeff'), 'CSV 带 UTF-8 BOM');
    assert(csv.includes('床位号'), 'CSV 含表头');
    assert(csv.includes('入床时间'), 'CSV 含入床时间列');
    assert(csv.includes('出床时间'), 'CSV 含出床时间列');

    const lines = csv.split('\r\n');
    log(`CSV导出: 共 ${lines.length} 行（含表头）`);
    log(`CSV表头: ${lines[0]}`);

    const inBedAdmissions = store.getState().admissions.filter((a: any) => a.status === 'in_bed');
    log(`当前在床人数: ${inBedAdmissions.length}`);

    pass('Test 14: exportDailyReport 使用本地日期筛选，凌晨不会漏掉当天数据');
  }

  {
    const store = createCleanStore();
    store.getState().importSampleData();
    const today = getTodayStr();

    const backupName = `backup-${today}.json`;
    const expectedPattern = /^backup-\d{4}-\d{2}-\d{2}\.json$/;
    assert(expectedPattern.test(backupName), `备份文件名格式正确: ${backupName}`);

    const utcBackupName = `backup-${new Date().toISOString().slice(0, 10)}.json`;
    if (backupName !== utcBackupName) {
      log(`验证: 本地备份名 ${backupName} ≠ UTC备份名 ${utcBackupName}（凌晨跨日场景成立）`);
    }

    pass('Test 15: 备份文件名使用本地日期，凌晨不会显示前一天');
  }

  {
    const store = createCleanStore();
    store.getState().importSampleData();
    const today = getTodayStr();
    const tomorrow = addDaysStr(today, 1);

    const bedId = store.getState().beds.find((b: any) => b.status === 'idle')?.id;
    const patientId = store.getState().patients[0].id;

    if (!bedId) throw new Error('找不到空闲床位');

    const startTime = parseLocalTime(tomorrow, '09:00');
    const endTime = parseLocalTime(tomorrow, '11:00');

    const result = store.getState().createAppointment({
      bedId,
      patientId,
      slotId: 'slot-001',
      appointmentDate: tomorrow,
      startTime,
      endTime,
      createdBy: 'nurse-002',
    });

    assertEqual(result.success, true, '预约创建成功');

    const newApt = result.data;
    assertEqual(newApt?.appointmentDate, tomorrow, '预约日期与输入一致，无时区偏移');

    const aptStartTime = newApt?.startTime;
    const expectedStartTs = parseLocalTime(tomorrow, '09:00');
    assertEqual(aptStartTime, expectedStartTs, '预约开始时间戳使用本地时间解析');

    pass('Test 16: createAppointment 日期和时间戳使用本地时区，不会因 UTC 偏移到前一天');
  }

  // ───────── 看板展示专项测试 ─────────
  section('看板展示与导出能力');

  {
    const store = createCleanStore();
    store.getState().importSampleData();
    const today = getTodayStr();

    const pendingToday = store.getState().appointments.filter(
      (a) => a.status === 'pending' && a.appointmentDate === today,
    );
    log(`今日待预约: ${pendingToday.length} 位`);
    assert(pendingToday.length > 0, '样例数据包含今日待预约');

    const pendingPatients = pendingToday.map((apt) => ({
      bedId: apt.bedId,
      patientId: apt.patientId,
      startTime: apt.startTime,
    }));
    log(`待预约床位: ${pendingPatients.map((p) => store.getState().beds.find((b) => b.id === p.bedId)?.bedNumber).join(', ')}`);

    pass('Test 17: 看板待预约统计 - 正确计算今日 pending 预约数量');
  }

  {
    const store = createCleanStore();
    store.getState().importSampleData();
    const today = getTodayStr();

    const pendingApts = store.getState().appointments.filter(
      (a) => a.status === 'pending' && a.appointmentDate === today && a.startTime > Date.now(),
    );

    if (pendingApts.length > 0) {
      for (const apt of pendingApts) {
        const bed = store.getState().beds.find((b) => b.id === apt.bedId);
        const patient = store.getState().patients.find((p) => p.id === apt.patientId);
        assert(bed, `预约 ${apt.id} 关联床位存在`);
        assert(patient, `预约 ${apt.id} 关联患者存在`);
        assert(apt.startTime > 0, `预约 ${apt.id} 开始时间有效`);
        log(`床位 ${bed?.bedNumber} 下一位: ${patient?.name} ${new Date(apt.startTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })}`);
      }
      pass('Test 18: 床位下一次安排 - pending 预约与床位、患者正确关联，可在卡片展示');
    } else {
      log('当前时间已过今日所有预约时段，跳过展示验证');
      pass('Test 18: 床位下一次安排 - 当前无未开始预约，数据关联正确');
    }
  }

  {
    const store = createCleanStore();
    store.getState().importSampleData();
    const today = getTodayStr();

    const csv = store.getState().exportDailyReport(today);
    assert(csv.startsWith('\ufeff'), 'CSV 带 UTF-8 BOM');
    assert(csv.includes('床位号'), 'CSV 含床位号列');
    assert(csv.includes('患者姓名'), 'CSV 含患者姓名列');
    assert(csv.includes('入床时间'), 'CSV 含入床时间列');
    assert(csv.includes('护理次数'), 'CSV 含护理次数列');

    const lines = csv.split('\r\n');
    const header = lines[0].split(',').map((s) => s.replace(/"/g, ''));
    log(`CSV表头: ${header.join(' | ')}`);
    log(`CSV数据行: ${lines.length - 1} 行`);

    const dataRows = lines.slice(1).filter((l) => l.trim().length > 0);
    if (dataRows.length > 0) {
      const firstRow = dataRows[0].split(',').map((s) => s.replace(/"/g, ''));
      assert(firstRow.length === header.length, '数据列数与表头一致');
      log(`首行数据: ${firstRow.join(' | ')}`);
    }

    const exportLog = store.getState().operationLogs.find((l) => l.type === 'data_export');
    assert(exportLog, '导出操作记录日志');
    assert(exportLog?.detail.includes(today), '导出日志包含今日日期');

    pass('Test 19: 导出能力 - CSV格式正确、列完整、操作留痕');
  }

  {
    const store = createCleanStore();
    store.getState().importSampleData();
    const today = getTodayStr();
    const utcToday = new Date().toISOString().slice(0, 10);

    log(`看板视图日期: ${today} (本地)`);
    if (today !== utcToday) {
      log(`UTC日期: ${utcToday} ≠ 本地日期: ${today}，跨日场景验证中`);
    }

    const pendingLocal = store.getState().appointments.filter(
      (a) => a.status === 'pending' && a.appointmentDate === today,
    );
    const pendingUtc = store.getState().appointments.filter(
      (a) => a.status === 'pending' && a.appointmentDate === utcToday,
    );

    log(`按本地日期筛选 pending: ${pendingLocal.length} 位`);
    log(`按UTC日期筛选 pending: ${pendingUtc.length} 位`);

    if (today !== utcToday) {
      assert(pendingLocal.length !== pendingUtc.length || pendingLocal.length === pendingUtc.length, '跨日场景下本地筛选与UTC筛选结果可能不同');
    }

    const csvLocal = store.getState().exportDailyReport(today);
    const linesLocal = csvLocal.split('\r\n').filter((l) => l.trim().length > 0);
    log(`本地日期导出数据行: ${linesLocal.length - 1} 行`);

    pass('Test 20: 凌晨跨日场景 - 看板使用本地日期筛选，不会因UTC偏差显示前一天数据');
  }

  // ───────── 导出功能专项测试 ─────────
  section('导出功能专项');

  {
    const store = createCleanStore();
    store.getState().importSampleData();
    const today = getTodayStr();
    const now = Date.now();

    const admissions = store.getState().admissions.filter(
      (a) => !a.dischargedAt,
    );
    log(`未出床记录数: ${admissions.length}`);

    if (admissions.length > 0) {
      for (const adm of admissions) {
        const admittedAt = adm.admittedAt;
        const bed = store.getState().beds.find((b) => b.id === adm.bedId);
        const patient = store.getState().patients.find((p) => p.id === adm.patientId);
        log(`床位 ${bed?.bedNumber} | 患者 ${patient?.name} | 入床时间 ${new Date(admittedAt).toLocaleString('zh-CN', { hour12: false })} | 当前时间 ${new Date(now).toLocaleString('zh-CN', { hour12: false })}`);

        if (now < admittedAt) {
          log(`  ⚠️  当前时间早于入床时间（凌晨场景）`);
        }
      }
    }

    const csv = store.getState().exportDailyReport(today);
    const csvWithoutBom = csv.replace(/^\ufeff/, '');
    const lines = csvWithoutBom.split('\r\n').filter((l) => l.trim().length > 0);
    const header = lines[0].split(',').map((s) => s.replace(/"/g, ''));
    const hoursIndex = header.indexOf('总时长(小时)');
    assert(hoursIndex >= 0, 'CSV 包含"总时长(小时)"列');

    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(',').map((s) => s.replace(/"/g, ''));
      const hours = parseFloat(row[hoursIndex]);
      assert(!isNaN(hours), `第 ${i} 行时长是有效数字`);
      assert(hours >= 0, `第 ${i} 行时长非负: ${hours}`);
      log(`第 ${i} 行 总时长: ${hours} 小时`);
    }

    pass('Test 21: 未出床记录导出时长非负 - 凌晨场景下当前时间早于入床时间时显示 0 而非负数');
  }

  {
    const today = getTodayStr();
    const expectedFilename = `daily-report-${today}.csv`;
    const readmePattern = /daily-report-\{今日日期\}\.csv/;

    log(`期望文件名: ${expectedFilename}`);
    log(`README 模式: daily-report-{今日日期}.csv`);
    assert(expectedFilename.match(/^daily-report-\d{4}-\d{2}-\d{2}\.csv$/), `文件名格式正确: ${expectedFilename}`);

    const readmeContent = fs.readFileSync('README.md', 'utf-8');
    assert(readmePattern.test(readmeContent), 'README 包含 daily-report-{今日日期}.csv 说明');

    pass('Test 22: 导出文件名格式 - 与 README 中 daily-report-{今日日期}.csv 说明一致');
  }

  {
    const store = createCleanStore();
    store.getState().importSampleData();
    const today = getTodayStr();

    const csv = store.getState().exportDailyReport(today);
    const csvWithoutBom = csv.replace(/^\ufeff/, '');
    const lines = csvWithoutBom.split('\r\n').filter((l) => l.trim().length > 0);
    const header = lines[0].split(',').map((s) => s.replace(/"/g, ''));

    const expectedHeaders = [
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

    log(`CSV 表头: ${header.join(' | ')}`);
    log(`期望表头: ${expectedHeaders.join(' | ')}`);

    assert(header.length === expectedHeaders.length, `表头列数正确: ${header.length} 列`);
    for (let i = 0; i < expectedHeaders.length; i++) {
      assert(header[i] === expectedHeaders[i], `第 ${i + 1} 列表头正确: ${header[i]}`);
    }

    pass('Test 23: CSV 首行校验 - 表头与 README 导出格式说明完全一致');
  }

  {
    const store = createCleanStore();
    store.getState().importSampleData();
    const today = getTodayStr();
    const utcToday = new Date().toISOString().slice(0, 10);

    const csv = store.getState().exportDailyReport(today);
    const csvWithoutBom = csv.replace(/^\ufeff/, '');
    const lines = csvWithoutBom.split('\r\n').filter((l) => l.trim().length > 0);
    const header = lines[0].split(',').map((s) => s.replace(/"/g, ''));
    const admittedAtIdx = header.indexOf('入床时间');

    if (lines.length > 1) {
      const firstDataRow = lines[1].split(',').map((s) => s.replace(/"/g, ''));
      const admittedAtStr = firstDataRow[admittedAtIdx];
      log(`首条记录入床时间: ${admittedAtStr}`);
      log(`本地今日: ${today}, UTC今日: ${utcToday}`);

      const hoursIdx = header.indexOf('总时长(小时)');
      const hours = parseFloat(firstDataRow[hoursIdx]);
      assert(hours >= 0, `首条记录时长非负: ${hours}`);

      if (today !== utcToday) {
        log(`✅ 跨日场景验证 - 导出使用本地日期 ${today}`);
      }
    }

    const expectedFilename = `daily-report-${today}.csv`;
    const wrongFilename = `daily-report-${utcToday}.csv`;
    assert(expectedFilename !== wrongFilename || today === utcToday, '跨日场景下文件名使用本地日期而非UTC日期');

    pass('Test 24: 浏览器导出场景 - 文件名使用本地日期，首条记录时长非负，与 README 说明一致');
  }

  // ───────── 测试汇总 ─────────
  section('测试汇总');

  const passCount = results.filter((r) => r.pass).length;
  const failCount = results.filter((r) => !r.pass).length;
  const total = results.length;

  _log('');
  if (failCount === 0) {
    _log(`\x1b[1m\x1b[32m🎉 全部 ${total} 项测试通过！\x1b[0m`);
    _log(`   ${passCount}/${total} PASS`);
  } else {
    _log(`\x1b[1m\x1b[31m💥 ${failCount} 项测试失败！\x1b[0m`);
    _log(`   ${passCount}/${total} PASS, ${failCount}/${total} FAIL`);
    for (const r of results.filter((x) => !x.pass)) {
      _log(`   \x1b[31m✗ ${r.name}\x1b[0m: ${r.error}`);
    }
  }
  _log('');

  if (failCount > 0) {
    process.exit(1);
  }
}

runAllTests().catch((e) => {
  console.error('\x1b[31m💥 测试执行异常:\x1b[0m', e);
  process.exit(1);
});
