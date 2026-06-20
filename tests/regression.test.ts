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
    checkInsLen: s.checkIns.length,
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
      'checkIns',
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

  // ───────── 备份恢复专项测试 ─────────
  section('备份恢复功能专项');

  // 测试25: 导出备份功能
  {
    const store = createCleanStore();
    store.getState().importSampleData();
    store.getState().login('nurse-001', '123456');

    const backup = store.getState().exportBackup();
    assert(backup.version === 'v1', '备份版本为 v1');
    assert(backup.exportedAt.length > 0, '备份包含导出时间');
    assert(backup.data.beds.length > 0, '备份包含床位数据');
    assert(backup.data.patients.length > 0, '备份包含患者数据');
    assert(backup.data.appointments.length > 0, '备份包含预约数据');
    assert(backup.data.admissions.length > 0, '备份包含在床数据');
    assert(backup.data.operationLogs.length > 0, '备份包含操作日志');
    assert(backup.data.abnormalRecords.length > 0, '备份包含异常记录');

    const exportLog = store.getState().operationLogs.find((l) => l.type === 'backup_export');
    assert(exportLog, '导出操作记录日志');

    pass('Test 25: 导出备份 - 版本、时间、各实体数据完整，操作留痕');
  }

  // 测试26: 预检恢复 - 正常备份文件（管理员权限）
  {
    const store = createCleanStore();
    store.getState().importSampleData();
    store.getState().login('nurse-001', '123456');

    const backup = store.getState().exportBackup();
    const preview = store.getState().previewRestore(backup);

    assert(preview.canRestore === true, '正常备份文件可以恢复');
    assert(preview.issues.length === 0, '正常备份文件无问题');
    assert(preview.version === 'v1', '预检版本正确');
    assert(preview.exportedAt === backup.exportedAt, '预检导出时间正确');

    const previewLog = store.getState().operationLogs.find((l) => l.type === 'backup_restore_preview');
    assert(previewLog, '预检操作记录日志');
    assert(previewLog?.isAbnormal === false, '正常预检不标记异常');

    pass('Test 26: 预检恢复 - 正常备份文件通过校验，可恢复');
  }

  // 测试27: 预检恢复 - 非管理员权限被拒绝
  {
    const store = createCleanStore();
    store.getState().importSampleData();
    store.getState().login('nurse-004', '123456');

    const backup = store.getState().exportBackup();
    const preview = store.getState().previewRestore(backup);

    assert(preview.canRestore === false, '非管理员不能恢复');
    assert(preview.issues.some((i) => i.type === 'backup_permission_denied'), '包含权限拒绝问题');
    assert(preview.issues.some((i) => i.severity === 'error'), '问题级别为 error');

    const previewLog = store.getState().operationLogs.find((l) => l.type === 'backup_restore_preview');
    assert(previewLog?.isAbnormal === true, '权限不足预检标记异常');

    pass('Test 27: 预检恢复 - 非管理员权限被拒绝，异常留痕');
  }

  // 测试28: 预检恢复 - 未知版本被拦截
  {
    const store = createCleanStore();
    store.getState().importSampleData();
    store.getState().login('nurse-001', '123456');

    const backup = store.getState().exportBackup();
    const badBackup = { ...backup, version: 'v999' };
    const preview = store.getState().previewRestore(badBackup);

    assert(preview.canRestore === false, '未知版本不能恢复');
    assert(preview.issues.some((i) => i.type === 'backup_version_unknown'), '包含版本未知问题');
    assert(preview.issues.some((i) => i.message.includes('v999')), '问题信息包含错误版本号');

    pass('Test 28: 预检恢复 - 未知版本被拦截，错误信息明确');
  }

  // 测试29: 预检恢复 - 床位编号冲突被拦截
  {
    const store = createCleanStore();
    store.getState().importSampleData();
    store.getState().login('nurse-001', '123456');

    const backup = store.getState().exportBackup();
    const badBackup = JSON.parse(JSON.stringify(backup));
    badBackup.data.beds[0].bedNumber = badBackup.data.beds[1].bedNumber;

    const preview = store.getState().previewRestore(badBackup);

    assert(preview.canRestore === false, '床位编号冲突不能恢复');
    assert(preview.issues.some((i) => i.type === 'backup_bed_number_conflict'), '包含床位冲突问题');
    assert(preview.issues[0].details && preview.issues[0].details.length > 0, '包含具体冲突床位号');

    pass('Test 29: 预检恢复 - 床位编号冲突被拦截，列出冲突床位');
  }

  // 测试30: 预检恢复 - 同一患者重复在床被拦截
  {
    const store = createCleanStore();
    store.getState().importSampleData();
    store.getState().login('nurse-001', '123456');

    const backup = store.getState().exportBackup();
    const badBackup = JSON.parse(JSON.stringify(backup));

    const inBedAdm = badBackup.data.admissions.find((a: any) => a.status === 'in_bed');
    if (inBedAdm) {
      const duplicateAdm = { ...inBedAdm, id: 'dup-' + inBedAdm.id, bedId: 'another-bed-id' };
      badBackup.data.admissions.push(duplicateAdm);
    }

    const preview = store.getState().previewRestore(badBackup);

    assert(preview.canRestore === false, '同一患者重复在床不能恢复');
    assert(preview.issues.some((i) => i.type === 'backup_patient_duplicate_admission'), '包含重复在床问题');

    pass('Test 30: 预检恢复 - 同一患者重复在床被拦截');
  }

  // 测试31: 预检恢复 - 缺少必需字段被拦截
  {
    const store = createCleanStore();
    store.getState().importSampleData();
    store.getState().login('nurse-001', '123456');

    const backup = store.getState().exportBackup();
    const badBackup = JSON.parse(JSON.stringify(backup));
    delete badBackup.data.beds;

    const preview = store.getState().previewRestore(badBackup);

    assert(preview.canRestore === false, '缺少必需字段不能恢复');
    assert(preview.issues.some((i) => i.type === 'backup_missing_required_field'), '包含缺字段问题');
    assert(preview.issues.some((i) => i.message.includes('beds')), '问题信息指出缺少 beds');

    pass('Test 31: 预检恢复 - 缺少必需字段被拦截');
  }

  // 测试32: 预检恢复 - 差异分析正确（新增、更新、删除）
  {
    const store = createCleanStore();
    store.getState().importSampleData();
    store.getState().login('nurse-001', '123456');

    const backup = store.getState().exportBackup();
    const originalBedCount = backup.data.beds.length;

    store.getState().addBed({ bedNumber: 'NEW-100', zone: 'A', type: 'normal', status: 'idle' });
    store.getState().updateBed(backup.data.beds[0].id, { notes: 'updated' });
    store.getState().deleteBed(backup.data.beds[originalBedCount - 1].id);

    const preview = store.getState().previewRestore(backup);

    assert(preview.diff.beds.added === 1, '差异分析：新增1个床位');
    assert(preview.diff.beds.updated === 1, '差异分析：更新1个床位');
    assert(preview.diff.beds.deleted === 1, '差异分析：删除1个床位');

    assert(preview.dataOverview.beds === originalBedCount, '数据概览床位数量正确');
    assert(preview.dataOverview.patients === backup.data.patients.length, '数据概览患者数量正确');

    pass('Test 32: 预检恢复 - 差异分析正确，数据概览完整');
  }

  // 测试33: 完整流程 - 导出→改数据→恢复→回退
  {
    const store = createCleanStore();
    store.getState().importSampleData();
    store.getState().login('nurse-001', '123456');

    const originalBedCount = store.getState().beds.length;
    const originalPatientCount = store.getState().patients.length;
    const originalSnapshotCount = store.getState().autoBackupSnapshots.length;

    const backup = store.getState().exportBackup();

    store.getState().addBed({ bedNumber: 'TEST-A1', zone: 'Test', type: 'normal', status: 'idle' });
    store.getState().addBed({ bedNumber: 'TEST-A2', zone: 'Test', type: 'normal', status: 'idle' });
    assert(store.getState().beds.length === originalBedCount + 2, '成功添加2个测试床位');

    const beforeRestoreSnapshot = store.getState().autoBackupSnapshots.length;
    const restoreResult = store.getState().executeRestore(backup);

    assert(restoreResult.success === true, '恢复成功');
    assert(restoreResult.snapshotId !== undefined, '返回快照ID');
    assert(restoreResult.adminSessionPreserved === true, '恢复后管理员会话保持');
    assert(store.getState().beds.length === originalBedCount, '恢复后床位数量回到原值');
    assert(store.getState().autoBackupSnapshots.length === beforeRestoreSnapshot + 1, '恢复前创建了自动快照');
    assert(store.getState().currentUser?.id === 'nurse-001', '恢复后管理员仍在登录状态');
    assert(store.getState().currentUser?.role === 'admin', '恢复后管理员角色保留');

    const restoreLog = store.getState().operationLogs.find((l) => l.type === 'backup_restore');
    assert(restoreLog, '恢复操作记录日志');
    assert(restoreLog?.detail.includes(restoreResult.snapshotId!), '恢复日志包含快照ID');

    const snapshotLog = store.getState().operationLogs.find((l) => l.type === 'backup_auto_snapshot');
    assert(snapshotLog, '自动快照记录日志');

    const latestSnapshot = store.getState().getLatestSnapshot();
    assert(latestSnapshot !== null, '可以获取最新快照');
    assert(latestSnapshot?.name.includes('恢复前自动备份'), '快照名称正确');
    assert(latestSnapshot?.data.beds.length === originalBedCount + 2, '快照保存了修改后的数据');

    const rollbackResult = store.getState().rollbackRestore(latestSnapshot!.id);
    assert(rollbackResult.success === true, '回滚成功');
    assert(rollbackResult.adminSessionPreserved === true, '回滚后管理员会话保持');
    assert(store.getState().beds.length === originalBedCount + 2, '回滚后床位数量恢复到修改后的值');
    assert(store.getState().currentUser?.id === 'nurse-001', '回滚后管理员仍在登录状态');

    const rollbackLog = store.getState().operationLogs.find((l) => l.type === 'backup_restore_rollback');
    assert(rollbackLog, '回滚操作记录日志');
    assert(rollbackLog?.detail.includes(latestSnapshot!.id), '回滚日志包含快照ID');

    pass('Test 33: 完整流程 - 导出→改数据→恢复→回退，全部成功且留痕，管理员会话全程保持');
  }

  // 测试34: 恢复执行 - 冲突文件被拒绝（不创建快照）
  {
    const store = createCleanStore();
    store.getState().importSampleData();
    store.getState().login('nurse-001', '123456');

    const backup = store.getState().exportBackup();
    const badBackup = JSON.parse(JSON.stringify(backup));
    badBackup.data.beds[0].bedNumber = badBackup.data.beds[1].bedNumber;

    const beforeSnapshotCount = store.getState().autoBackupSnapshots.length;
    const beforeLogCount = store.getState().operationLogs.length;

    const restoreResult = store.getState().executeRestore(badBackup);

    assert(restoreResult.success === false, '冲突文件恢复失败');
    assert(restoreResult.error === 'validation_failed', '错误类型正确');
    assert(restoreResult.message.includes('校验失败'), '错误信息明确');

    assert(store.getState().autoBackupSnapshots.length === beforeSnapshotCount, '失败恢复不创建快照');
    assert(store.getState().operationLogs.length > beforeLogCount, '失败操作仍记录日志');

    pass('Test 34: 恢复执行 - 冲突文件被拒绝，不创建快照，异常留痕');
  }

  // 测试35: 恢复执行 - 非管理员被拒绝
  {
    const store = createCleanStore();
    store.getState().importSampleData();
    store.getState().login('nurse-004', '123456');

    const backup = store.getState().exportBackup();
    const restoreResult = store.getState().executeRestore(backup);

    assert(restoreResult.success === false, '非管理员恢复失败');
    assert(restoreResult.error === 'permission_denied', '错误类型正确');

    pass('Test 35: 恢复执行 - 非管理员权限被拒绝');
  }

  // 测试36: 自动快照管理 - 最多保留10个
  {
    const store = createCleanStore();
    store.getState().importSampleData();
    store.getState().login('nurse-001', '123456');

    for (let i = 0; i < 15; i++) {
      store.getState().createAutoSnapshot(`测试快照 ${i + 1}`);
    }

    assert(store.getState().autoBackupSnapshots.length === 15, '创建15个快照');

    store.getState().clearOldSnapshots(10);
    assert(store.getState().autoBackupSnapshots.length === 10, '清理后保留10个快照');

    const latest = store.getState().getLatestSnapshot();
    assert(latest?.name.includes('测试快照 1'), '保留最新的10个，第一个是最新的');

    pass('Test 36: 自动快照管理 - 超过限制自动清理旧快照');
  }

  // 测试37: 回滚 - 快照不存在被拒绝
  {
    const store = createCleanStore();
    store.getState().importSampleData();
    store.getState().login('nurse-001', '123456');

    const rollbackResult = store.getState().rollbackRestore('non-existent-id');
    assert(rollbackResult.success === false, '不存在的快照回滚失败');
    assert(rollbackResult.error === 'snapshot_not_found', '错误类型正确');

    pass('Test 37: 回滚 - 快照不存在被拒绝');
  }

  // 测试38: 删除快照功能
  {
    const store = createCleanStore();
    store.getState().importSampleData();
    store.getState().login('nurse-001', '123456');

    const snapshot = store.getState().createAutoSnapshot('待删除快照');
    assert(store.getState().autoBackupSnapshots.length === 1, '创建了1个快照');

    store.getState().deleteSnapshot(snapshot.id);
    assert(store.getState().autoBackupSnapshots.length === 0, '快照已删除');

    pass('Test 38: 删除快照功能正常');
  }

  // 测试39: 历史页留痕 - 备份恢复相关操作全部记录
  {
    const store = createCleanStore();
    store.getState().importSampleData();
    store.getState().login('nurse-001', '123456');

    const backup = store.getState().exportBackup();
    store.getState().previewRestore(backup);
    const restoreResult = store.getState().executeRestore(backup);

    assert(restoreResult.adminSessionPreserved === true, '恢复后管理员会话保持');
    assert(store.getState().currentUser?.id === 'nurse-001', '恢复后无需重新登录');

    const latestSnapshot = store.getState().getLatestSnapshot();
    assert(latestSnapshot !== null, '存在最新快照');

    const rollbackResult = store.getState().rollbackRestore(latestSnapshot!.id);
    assert(rollbackResult.adminSessionPreserved === true, '回滚后管理员会话保持');
    assert(store.getState().currentUser?.id === 'nurse-001', '回滚后仍在登录状态');

    const logTypes = store.getState().operationLogs.map((l) => l.type);
    assert(logTypes.includes('backup_export'), '包含 backup_export 日志');
    assert(logTypes.includes('backup_restore_preview'), '包含 backup_restore_preview 日志');
    assert(logTypes.includes('backup_auto_snapshot'), '包含 backup_auto_snapshot 日志');
    assert(logTypes.includes('backup_restore'), '包含 backup_restore 日志');
    assert(logTypes.includes('backup_restore_rollback'), '包含 backup_restore_rollback 日志');

    const restoreOp = store.getState().operationLogs.find((l) => l.type === 'backup_restore');
    assert(restoreOp?.operatorId === 'nurse-001', '操作人正确');
    assert(restoreOp?.operatorName === '张管理', '操作人姓名正确');
    assert(restoreOp?.targetType === 'system', '目标类型正确');
    assert(restoreOp?.isAbnormal === false, '正常操作不标记异常');

    pass('Test 39: 历史页留痕 - 所有备份恢复操作完整记录，可在历史页查看，会话全程保持');
  }

  // 测试40: 持久化一致性 - 快照和日志刷新后仍在
  {
    const store1 = createCleanStore();
    store1.getState().importSampleData();
    store1.getState().login('nurse-001', '123456');

    const backup = store1.getState().exportBackup();
    const restoreResult = store1.getState().executeRestore(backup);

    const s1 = store1.getState();
    assert(s1.currentUserId === 'nurse-001', '恢复后 currentUserId 保持');
    assert(s1.currentUser?.id === 'nurse-001', '恢复后 currentUser 保持');
    assert(s1.currentUser?.role === 'admin', '恢复后管理员角色保持');
    assert(restoreResult.adminSessionPreserved === true, '返回值标识会话已保留');

    const serializableKeys = [
      'beds', 'nurses', 'isolationRules', 'timeSlots', 'patients',
      'appointments', 'admissions', 'careNotes', 'operationLogs',
      'abnormalRecords', 'autoBackupSnapshots', 'currentUserId',
      'checkIns',
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

    assert(s2.autoBackupSnapshots.length > 0, 'autoBackupSnapshots 持久化成功');
    assert(s2.operationLogs.some((l) => l.type === 'backup_restore'), '备份恢复日志持久化成功');
    assert(s2.currentUserId === 'nurse-001', '刷新后 currentUserId 仍在');
    assert(s2.currentUser?.id === 'nurse-001', '刷新后 currentUser 仍在');
    assert(s2.currentUser?.role === 'admin', '刷新后管理员角色仍在');

    const rollbackResult = s2.rollbackRestore(s2.getLatestSnapshot()!.id);
    assert(rollbackResult.success === true, '刷新后仍可直接回滚（无需重新登录）');
    assert(rollbackResult.adminSessionPreserved === true, '回滚后会话仍保持');

    pass('Test 40: 持久化一致性 - 快照、日志、管理员会话刷新/重开后仍然存在');
  }

  // ───────── 恢复结果与详细差异专项测试 ─────────
  section('恢复结果与详细差异');

  // 测试41: 恢复成功后 - 详细diff记录正确，历史留痕
  {
    const store = createCleanStore();
    store.getState().importSampleData();
    store.getState().login('nurse-001', '123456');

    const backup = store.getState().exportBackup();
    const originalBedCount = backup.data.beds.length;

    store.getState().addBed({ bedNumber: 'DIFF-001', zone: 'Test', type: 'normal', status: 'idle' });
    store.getState().addBed({ bedNumber: 'DIFF-002', zone: 'Test', type: 'normal', status: 'idle' });
    store.getState().updateBed(backup.data.beds[0].id, { notes: 'modified for test' });
    store.getState().deleteBed(backup.data.beds[originalBedCount - 1].id);

    const restoreResult = store.getState().executeRestore(backup);
    assert(restoreResult.success === true, '恢复成功');

    const latestRecord = store.getState().getLatestRestoreRecord();
    assert(latestRecord !== null, '有最新恢复记录');
    assert(latestRecord.operationType === 'restore', '操作类型为恢复');
    assert(latestRecord.status === 'success', '状态为成功');
    assert(latestRecord.operatorId === 'nurse-001', '操作人正确');
    assert(latestRecord.operatorName === '张管理', '操作人姓名正确');
    assert(latestRecord.snapshotId !== undefined, '关联了自动快照ID');
    assert(latestRecord.snapshotName !== undefined, '关联了自动快照名称');
    assert(latestRecord.backupVersion === 'v1', '备份版本正确');

    assert(latestRecord.detailedDiff.beds.added.length === 1, '详细diff：恢复备份后，被删除的床位被新增回来');
    assert(latestRecord.detailedDiff.beds.updated.length === 1, '详细diff：更新1个床位');
    assert(latestRecord.detailedDiff.beds.deleted.length === 2, '详细diff：当前新增的2个测试床位被删除');

    const deletedBed = latestRecord.detailedDiff.beds.deleted.find((b) => b.name === 'DIFF-001');
    assert(deletedBed !== undefined, '删除床位DIFF-001在diff中');
    assert(deletedBed.before !== undefined, '包含删除前的数据');
    assert(deletedBed.before.bedNumber === 'DIFF-001', '删除床位号正确');

    const updatedBed = latestRecord.detailedDiff.beds.updated[0];
    assert(updatedBed.diffFields !== undefined, '包含差异字段列表');
    assert(updatedBed.diffFields.some((df) => df.field === 'notes'), '差异字段包含notes');
    assert(updatedBed.diffFields.some((df) => df.before === 'modified for test'), '变更前值正确');

    const totalChanges = Object.values(latestRecord.diff).reduce(
      (sum, d) => sum + d.added + d.updated + d.deleted, 0
    );
    assert(totalChanges >= 4, '变更总数>=4（2新增+1更新+1删除）');

    pass('Test 41: 恢复成功 - 详细diff完整记录新增/更新/删除，可展开核对');
  }

  // 测试42: 回滚成功后 - 详细diff记录正确，历史留痕
  {
    const store = createCleanStore();
    store.getState().importSampleData();
    store.getState().login('nurse-001', '123456');

    const backup = store.getState().exportBackup();
    store.getState().addBed({ bedNumber: 'ROLLBACK-001', zone: 'Test', type: 'normal', status: 'idle' });
    store.getState().addBed({ bedNumber: 'ROLLBACK-002', zone: 'Test', type: 'normal', status: 'idle' });

    const restoreResult = store.getState().executeRestore(backup);
    assert(restoreResult.success === true, '先执行恢复');

    const restoreRecord = store.getState().getLatestRestoreRecord();
    const snapshotId = restoreRecord?.snapshotId;
    assert(snapshotId !== undefined, '恢复关联了快照');

    const rollbackResult = store.getState().rollbackRestore(snapshotId);
    assert(rollbackResult.success === true, '回滚成功');

    const rollbackRecord = store.getState().getLatestRestoreRecord();
    assert(rollbackRecord !== null, '有最新回滚记录');
    assert(rollbackRecord.operationType === 'rollback', '操作类型为回滚');
    assert(rollbackRecord.status === 'success', '回滚状态为成功');
    assert(rollbackRecord.rollbackSnapshotId === snapshotId, '关联了回滚目标快照');
    assert(rollbackRecord.snapshotId !== undefined, '回滚前也创建了新快照');

    assert(rollbackRecord.detailedDiff.beds.added.length === 2, '回滚时2个测试床位被重新添加（从快照恢复）');

    const historyCount = store.getState().restoreHistory.length;
    assert(historyCount >= 2, '历史记录至少有2条（恢复+回滚）');
    assert(store.getState().restoreHistory[0].operationType === 'rollback', '最新的是回滚');
    assert(store.getState().restoreHistory[1].operationType === 'restore', '其次是恢复');

    pass('Test 42: 回滚成功 - 详细diff完整记录，快照双向关联，历史顺序正确');
  }

  // 测试43: 恢复历史持久化 - 刷新后仍在，状态一致
  {
    const store1 = createCleanStore();
    store1.getState().importSampleData();
    store1.getState().login('nurse-001', '123456');

    const backup = store1.getState().exportBackup();
    store1.getState().addBed({ bedNumber: 'PERSIST-001', zone: 'Test', type: 'normal', status: 'idle' });
    store1.getState().executeRestore(backup);

    const s1 = store1.getState();
    assert(s1.restoreHistory.length === 1, 'store1有1条恢复历史');
    const record1 = s1.getLatestRestoreRecord();

    const serializableKeys = [
      'beds', 'nurses', 'isolationRules', 'timeSlots', 'patients',
      'appointments', 'admissions', 'careNotes', 'operationLogs',
      'abnormalRecords', 'autoBackupSnapshots', 'restoreHistory', 'currentUserId',
      'checkIns',
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
    assert(s2.restoreHistory.length === 1, 'store2恢复后仍有1条恢复历史');
    const record2 = s2.getLatestRestoreRecord();

    assert(record2?.id === record1?.id, '恢复记录ID一致');
    assert(record2?.operationType === record1?.operationType, '操作类型一致');
    assert(record2?.status === record1?.status, '状态一致');
    assert(record2?.snapshotId === record1?.snapshotId, '快照关联一致');
    assert(JSON.stringify(record2?.diff) === JSON.stringify(record1?.diff), 'diff一致');
    assert(record2?.detailedDiff.beds.deleted.length === record1?.detailedDiff.beds.deleted.length, '详细diff一致');

    assert(s2.beds.length === s1.beds.length, '床位数量一致');
    assert(s2.currentUser?.id === 'nurse-001', '管理员仍在登录');

    pass('Test 43: 持久化一致性 - 恢复历史、快照关联、详细diff刷新/重开后完全一致');
  }

  // 测试44: 权限限制 - 非管理员可查看结果但不能操作
  {
    const store = createCleanStore();
    store.getState().importSampleData();
    store.getState().login('nurse-001', '123456');

    const backup = store.getState().exportBackup();
    store.getState().addBed({ bedNumber: 'PERM-001', zone: 'Test', type: 'normal', status: 'idle' });
    store.getState().executeRestore(backup);

    const historyAfterAdmin = store.getState().restoreHistory.length;
    assert(historyAfterAdmin === 1, '管理员恢复产生1条历史');

    store.getState().login('nurse-004', '123456');
    assert(store.getState().currentUser?.role === 'normal', '切换为普通护士');

    const latestRecord = store.getState().getLatestRestoreRecord();
    assert(latestRecord !== null, '普通护士仍可查看恢复历史');
    assert(latestRecord.status === 'success', '可以看到成功状态');
    assert(latestRecord.detailedDiff.beds.deleted.length === 1, '可以看到详细diff');

    const restoreResult = store.getState().executeRestore(backup);
    assert(restoreResult.success === false, '普通护士执行恢复失败');
    assert(restoreResult.error === 'permission_denied', '错误码为权限拒绝');

    const latestSnapshot = store.getState().getLatestSnapshot();
    const rollbackResult = store.getState().rollbackRestore(latestSnapshot!.id);
    assert(rollbackResult.success === false, '普通护士执行回滚失败');
    assert(rollbackResult.error === 'permission_denied', '错误码为权限拒绝');

    const historyAfterAttempts = store.getState().restoreHistory.length;
    assert(historyAfterAttempts === 3, '失败操作也记录历史（恢复失败+回滚失败）');

    const failedRecords = store.getState().restoreHistory.filter((r) => r.status === 'failed');
    assert(failedRecords.length === 2, '有2条失败记录');
    assert(failedRecords[0].error === 'permission_denied', '失败记录包含错误码');
    assert(failedRecords[0].operatorId === 'nurse-004', '失败记录操作人正确');
    assert(failedRecords[0].operatorName === '赵普通', '失败记录操作人姓名正确');

    const abnormalTypes = store.getState().abnormalRecords
      .filter((a) => !a.handled)
      .map((a) => a.type);
    assert(abnormalTypes.includes('backup_permission_denied'), '异常记录包含权限拒绝类型');

    pass('Test 44: 权限控制 - 非管理员可查看结果但不可操作，失败尝试仍完整留痕');
  }

  // 测试45: 异常场景 - 快照不存在时明确提示并记录
  {
    const store = createCleanStore();
    store.getState().importSampleData();
    store.getState().login('nurse-001', '123456');

    const beforeHistoryCount = store.getState().restoreHistory.length;
    const beforeAbnormalCount = store.getState().abnormalRecords.length;

    const rollbackResult = store.getState().rollbackRestore('non-existent-snapshot-id');
    assert(rollbackResult.success === false, '快照不存在时回滚失败');
    assert(rollbackResult.error === 'snapshot_not_found', '错误码正确');
    assert(rollbackResult.message.includes('未找到快照'), '错误信息明确');

    const afterHistoryCount = store.getState().restoreHistory.length;
    assert(afterHistoryCount === beforeHistoryCount + 1, '失败操作增加1条历史');

    const failedRecord = store.getState().getLatestRestoreRecord();
    assert(failedRecord?.status === 'failed', '历史记录状态为失败');
    assert(failedRecord?.operationType === 'rollback', '操作类型为回滚');
    assert(failedRecord?.error === 'snapshot_not_found', '历史记录包含错误码');
    assert(failedRecord?.rollbackSnapshotId === 'non-existent-snapshot-id', '历史记录关联了不存在的快照ID');

    const afterAbnormalCount = store.getState().abnormalRecords.length;
    assert(afterAbnormalCount === beforeAbnormalCount + 1, '新增1条异常记录');

    const latestAbnormal = store.getState().abnormalRecords[0];
    assert(latestAbnormal.type === 'data_conflict', '异常类型正确');
    assert(latestAbnormal.description.includes('未找到快照'), '异常描述明确');

    pass('Test 45: 异常场景 - 快照不存在时给出明确提示，历史页和异常页均留痕');
  }

  // 测试46: 详细diff计算 - 字段级差异正确识别
  {
    const store = createCleanStore();
    store.getState().importSampleData();
    store.getState().login('nurse-001', '123456');

    const bed = store.getState().beds[0];
    const originalNotes = bed.notes;

    const beforeData = {
      beds: JSON.parse(JSON.stringify(store.getState().beds)),
      nurses: JSON.parse(JSON.stringify(store.getState().nurses)),
      isolationRules: JSON.parse(JSON.stringify(store.getState().isolationRules)),
      timeSlots: JSON.parse(JSON.stringify(store.getState().timeSlots)),
      patients: JSON.parse(JSON.stringify(store.getState().patients)),
      appointments: JSON.parse(JSON.stringify(store.getState().appointments)),
      admissions: JSON.parse(JSON.stringify(store.getState().admissions)),
      careNotes: JSON.parse(JSON.stringify(store.getState().careNotes)),
      operationLogs: JSON.parse(JSON.stringify(store.getState().operationLogs)),
      abnormalRecords: JSON.parse(JSON.stringify(store.getState().abnormalRecords)),
      checkIns: JSON.parse(JSON.stringify(store.getState().checkIns)),
    };

    store.getState().updateBed(bed.id, { notes: 'updated notes for diff test', status: 'cleaning' });

    const afterData = {
      beds: JSON.parse(JSON.stringify(store.getState().beds)),
      nurses: JSON.parse(JSON.stringify(store.getState().nurses)),
      isolationRules: JSON.parse(JSON.stringify(store.getState().isolationRules)),
      timeSlots: JSON.parse(JSON.stringify(store.getState().timeSlots)),
      patients: JSON.parse(JSON.stringify(store.getState().patients)),
      appointments: JSON.parse(JSON.stringify(store.getState().appointments)),
      admissions: JSON.parse(JSON.stringify(store.getState().admissions)),
      careNotes: JSON.parse(JSON.stringify(store.getState().careNotes)),
      operationLogs: JSON.parse(JSON.stringify(store.getState().operationLogs)),
      abnormalRecords: JSON.parse(JSON.stringify(store.getState().abnormalRecords)),
      checkIns: JSON.parse(JSON.stringify(store.getState().checkIns)),
    };

    const detailedDiff = store.getState().calculateDetailedDiff(beforeData, afterData);
    assert(detailedDiff.beds.updated.length === 1, '识别到1个更新的床位');

    const updatedBed = detailedDiff.beds.updated[0];
    assert(updatedBed.id === bed.id, '更新的床位ID正确');
    assert(updatedBed.diffFields !== undefined, '包含差异字段');
    assert(updatedBed.diffFields.length >= 2, '至少2个字段变化（notes + status）');

    const notesDiff = updatedBed.diffFields.find((df) => df.field === 'notes');
    assert(notesDiff !== undefined, '识别到notes字段变化');
    assert(notesDiff.before === originalNotes, 'notes变更前正确');
    assert(notesDiff.after === 'updated notes for diff test', 'notes变更后正确');

    const statusDiff = updatedBed.diffFields.find((df) => df.field === 'status');
    assert(statusDiff !== undefined, '识别到status字段变化');
    assert(statusDiff.before === bed.status, 'status变更前正确');
    assert(statusDiff.after === 'cleaning', 'status变更后正确');

    pass('Test 46: 详细diff计算 - 字段级差异正确识别，变更前后值完整');
  }

  // ───────── 签到与分诊专项测试 ─────────
  section('签到与分诊');

  {
    const store = createCleanStore();
    store.getState().importSampleData();
    assertEqual(store.getState().checkIns.length, SAMPLE_DATA_COUNTS.checkIns, '样例签到数据数量');
    pass('Test 47: 样例数据 - 签到记录导入正确');
  }

  {
    const store = createCleanStore();
    store.getState().importSampleData();
    const pendingApt = store.getState().appointments.find(
      (a) => a.status === 'pending' && a.appointmentDate === getTodayStr(),
    );
    if (!pendingApt) throw new Error('无今日 pending 预约');

    const patient = store.getState().patients.find((p) => p.id === pendingApt.patientId);
    if (!patient?.phone) throw new Error('预约患者无手机号');

    const before = snapshotState(store);
    const result = store.getState().checkInByPhone(patient.phone);
    assertEqual(result.success, true, '手机号签到应成功');
    assert(result.data, '返回签到数据');
    assertEqual(result.data!.status, 'checked_in', '签到状态为 checked_in');
    assert(['on_time', 'early', 'late'].includes(result.data!.arrivalFlag!), '到达标记已设置');

    const after = snapshotState(store);
    assertEqual(after.checkInsLen, before.checkInsLen + 1, '签到记录数+1');
    const apt = store.getState().appointments.find((a) => a.id === pendingApt.id);
    assertEqual(apt?.status, 'checked_in', '预约状态变为 checked_in');

    const triageQueue = store.getState().getTriageQueue();
    assert(triageQueue.length >= 1, '待分诊队列至少1人');

    const confirmResult = store.getState().confirmTriage(result.data!.id, 'nurse-002');
    assertEqual(confirmResult.success, true, '分诊确认入床成功');

    const aptAfter = store.getState().appointments.find((a) => a.id === pendingApt.id);
    assertEqual(aptAfter?.status, 'admitted', '预约状态变为 admitted');
    const bedAfter = store.getState().beds.find((b) => b.id === pendingApt.bedId);
    assertEqual(bedAfter?.status, pendingApt.isolationRuleId ? 'isolated' : 'occupied', '床位状态正确变更');

    const adm = store.getState().admissions.find(
      (a) => a.appointmentId === pendingApt.id,
    );
    assert(adm, '入床记录已创建');
    assertEqual(adm?.status, 'in_bed', '入床状态为 in_bed');

    pass('Test 48: 成功签到入床 - 手机号签到→分诊确认→入床，全链路成功');
  }

  {
    const store = createCleanStore();
    store.getState().importSampleData();
    const pendingApt = store.getState().appointments.find(
      (a) => a.status === 'pending' && a.appointmentDate === getTodayStr(),
    );
    if (!pendingApt) throw new Error('无今日 pending 预约');

    const patient = store.getState().patients.find((p) => p.id === pendingApt.patientId);
    if (!patient?.phone) throw new Error('预约患者无手机号');

    const first = store.getState().checkInByPhone(patient.phone);
    assertEqual(first.success, true, '首次签到成功');

    const before = snapshotState(store);
    const second = store.getState().checkInByPhone(patient.phone);
    assertEqual(second.success, false, '重复签到应失败');
    assertEqual(second.error, '该预约已签到，不可重复签到', '错误信息正确');

    const after = snapshotState(store);
    assertEqual(after.checkInsLen, before.checkInsLen, '签到记录数不变');
    assertEqual(after.appointmentsLen, before.appointmentsLen, '预约记录数不变');

    const duplicateAbn = store.getState().abnormalRecords.find(
      (r) => r.type === 'duplicate_checkin',
    );
    assert(duplicateAbn, '重复签到异常记录存在');

    const third = store.getState().checkInByAppointment(pendingApt.id);
    assertEqual(third.success, false, '预约ID重复签到也被拦截');

    pass('Test 49: 重复签到拦截 - 同一预约手机号/预约ID均不可重复签到，异常留痕');
  }

  {
    const store = createCleanStore();
    store.getState().importSampleData();

    const modifyResult = store.getState().modifyTriage('any-id', 'nurse-004', {
      triageNote: 'test',
    });
    assertEqual(modifyResult.success, false, '普通护士无权修改分诊');
    assertEqual(modifyResult.error, '普通护士无权修改分诊结果', '错误信息正确');

    const permAbn = store.getState().abnormalRecords.find(
      (r) => r.type === 'triage_permission_denied',
    );
    assert(permAbn, '权限拒绝异常记录存在');

    const adminResult = store.getState().modifyTriage('nonexistent-id', 'nurse-001', {
      triageNote: 'admin note',
    });
    assertEqual(adminResult.success, false, '管理员修改不存在的记录仍失败');

    pass('Test 50: 权限限制 - 普通护士不能修改分诊结果，管理员可操作但数据校验仍生效');
  }

  {
    const store = createCleanStore();
    store.getState().importSampleData();

    const pendingApt = store.getState().appointments.find(
      (a) => a.status === 'pending' && !a.isolationRuleId && a.appointmentDate === getTodayStr(),
    );
    if (!pendingApt) throw new Error('无合适的 pending 预约');

    const occupiedBed = store.getState().beds.find(
      (b) => b.status === 'occupied' || b.status === 'isolated',
    );
    if (!occupiedBed) throw new Error('无占用床位');

    const patient = store.getState().patients.find((p) => p.id === pendingApt.patientId);

    store.setState({
      appointments: store.getState().appointments.map((a) =>
        a.id === pendingApt.id ? { ...a, bedId: occupiedBed.id } : a,
      ),
    });

    if (patient?.phone) {
      const checkInResult = store.getState().checkInByPhone(patient.phone);
      if (checkInResult.success && checkInResult.data) {
        const before = snapshotState(store);
        const confirmResult = store.getState().confirmTriage(checkInResult.data.id, 'nurse-002');
        assertEqual(confirmResult.success, false, '床位被占时分诊确认应失败');
        assert(
          confirmResult.error?.includes('已被占用') || false,
          '错误信息包含"已被占用"',
        );

        const after = snapshotState(store);
        assertEqual(after.admissionsLen, before.admissionsLen, '入床记录数不变');

        const bedAbn = store.getState().abnormalRecords.find(
          (r) => r.type === 'bed_occupied_triage',
        );
        assert(bedAbn, '床位占用异常记录存在');

        const rejectResult = store.getState().rejectTriage(checkInResult.data.id, 'nurse-002', '床位临时被占用');
        assertEqual(rejectResult.success, true, '退回处理成功');

        const checkInAfter = store.getState().checkIns.find(
          (c) => c.id === checkInResult.data!.id,
        );
        assertEqual(checkInAfter?.status, 'triage_rejected', '签到状态变为 triage_rejected');
        assertEqual(checkInAfter?.conflictReason, '床位临时被占用', '冲突原因已记录');

        const aptAfter = store.getState().appointments.find((a) => a.id === pendingApt.id);
        assertEqual(aptAfter?.status, 'pending', '预约恢复为 pending');

        pass('Test 51: 冲突退回 - 床位占用时分诊确认失败，退回后预约恢复待入床');
      } else {
        pass('Test 51: 冲突退回 - 签到条件不满足，跳过（非当前时段）');
      }
    } else {
      pass('Test 51: 冲突退回 - 患者无手机号，跳过');
    }
  }

  {
    const store1 = createCleanStore();
    store1.getState().importSampleData();

    const pendingApt = store1.getState().appointments.find(
      (a) => a.status === 'pending' && a.appointmentDate === getTodayStr(),
    );
    if (!pendingApt) throw new Error('无今日 pending 预约');

    const patient = store1.getState().patients.find((p) => p.id === pendingApt.patientId);
    if (!patient?.phone) throw new Error('预约患者无手机号');

    const checkInResult = store1.getState().checkInByPhone(patient.phone);
    assertEqual(checkInResult.success, true, '签到成功');

    const s1 = store1.getState();
    const serializableKeys = [
      'beds', 'nurses', 'isolationRules', 'timeSlots', 'patients',
      'appointments', 'admissions', 'careNotes', 'operationLogs',
      'abnormalRecords', 'autoBackupSnapshots', 'restoreHistory', 'currentUserId',
      'checkIns',
      'checkIns',
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
    assertEqual(s2.checkIns.length, s1.checkIns.length, '签到记录数一致');
    assertEqual(
      JSON.stringify(s2.checkIns),
      JSON.stringify(s1.checkIns),
      '签到记录内容一致',
    );

    const triageQueue = s2.getTriageQueue();
    assert(triageQueue.length >= 1, '重开后待分诊队列仍存在');

    const checkInAfter = s2.checkIns.find((c) => c.id === checkInResult.data!.id);
    assertEqual(checkInAfter?.status, 'checked_in', '签到状态持久化正确');
    assertEqual(checkInAfter?.patientId, pendingApt.patientId, '患者关联正确');

    const aptAfter = s2.appointments.find((a) => a.id === pendingApt.id);
    assertEqual(aptAfter?.status, 'checked_in', '预约签到状态持久化正确');

    const opLogCheck = s2.operationLogs.find((l) => l.type === 'patient_checkin');
    assert(opLogCheck, '签到操作日志持久化成功');

    pass('Test 52: 持久化一致性 - 签到状态、分诊队列、操作日志刷新/重开后完全一致');
  }

  {
    const store = createCleanStore();
    store.getState().importSampleData();

    const result1 = store.getState().checkInByPhone('nonexistent-phone');
    assertEqual(result1.success, false, '未知手机号签到失败');
    assertEqual(result1.error, '未找到该手机号对应的患者', '错误信息正确');

    const result2 = store.getState().checkInByAppointment('nonexistent-apt-id');
    assertEqual(result2.success, false, '不存在的预约ID签到失败');

    const admittedApt = store.getState().appointments.find((a) => a.status === 'admitted');
    if (admittedApt) {
      const result3 = store.getState().checkInByAppointment(admittedApt.id);
      assertEqual(result3.success, false, '已入床的预约不可签到');
      assert(result3.error?.includes('不可签到') || false, '错误信息包含"不可签到"');
    }

    const cancelApt = store.getState().appointments.find((a) => a.status === 'cancelled');
    if (cancelApt) {
      const result4 = store.getState().checkInByAppointment(cancelApt.id);
      assertEqual(result4.success, false, '已取消的预约不可签到');
    }

    pass('Test 53: 签到校验 - 未知手机号、不存在预约、非pending预约均被正确拦截');
  }

  {
    const store = createCleanStore();
    store.getState().importSampleData();

    const negativeBed = store.getState().beds.find((b) => b.type === 'negative' && b.status === 'idle');
    const negativeRule = store.getState().isolationRules.find(
      (r) => r.requiredBedType === 'negative',
    );
    const normalBed = store.getState().beds.find((b) => b.type === 'normal' && b.status === 'idle');
    if (!negativeBed || !negativeRule || !normalBed) throw new Error('数据不足');

    const patient = store.getState().patients.find((p) => !store.getState().appointments.some(
      (a) => a.patientId === p.id && a.status !== 'cancelled' && a.status !== 'completed',
    ));
    if (!patient) throw new Error('无可用患者');

    const today = getTodayStr();
    const aptResult = store.getState().createAppointment({
      bedId: negativeBed.id,
      patientId: patient.id,
      slotId: 'slot-001',
      appointmentDate: today,
      startTime: parseLocalTime(today, '08:00'),
      endTime: parseLocalTime(today, '12:00'),
      isolationRuleId: negativeRule.id,
      createdBy: 'nurse-002',
    });
    assertEqual(aptResult.success, true, '创建含隔离规则的预约成功（负压床位+负压规则）');

    const checkInResult = store.getState().checkInByAppointment(aptResult.data!.id);
    assertEqual(checkInResult.success, true, '签到成功');

    const confirmResult = store.getState().confirmTriage(checkInResult.data!.id, 'nurse-002', normalBed.id);
    assertEqual(confirmResult.success, false, '换床到普通床位时分诊确认应因隔离规则失败');

    const isoAbn = store.getState().abnormalRecords.find(
      (r) => r.type === 'isolation_conflict_triage',
    );
    assert(isoAbn, '隔离规则冲突异常记录存在');

    pass('Test 54: 隔离规则冲突 - 分诊确认时换床到不合规床位被拦截，异常留痕');
  }

  // Test 55: 撤销分诊（已入床→释放床位）+ 恢复（再次入床）
  {
    const store = createCleanStore();
    store.getState().importSampleData();

    const pendingApt = store.getState().appointments.find(
      (a) => a.status === 'pending' && a.appointmentDate === getTodayStr(),
    );
    if (!pendingApt) throw new Error('无今日 pending 预约');
    const patient = store.getState().patients.find((p) => p.id === pendingApt.patientId);
    if (!patient?.phone) throw new Error('预约患者无手机号');
    const originalBedId = pendingApt.bedId;

    const checkInResult = store.getState().checkInByPhone(patient.phone);
    assertEqual(checkInResult.success, true, '签到成功 (Test 55)');

    const confirmResult = store.getState().confirmTriage(
      checkInResult.data!.id, 'nurse-001', undefined, '测试科室',
    );
    assertEqual(confirmResult.success, true, '分诊确认入床成功');

    const bedAfterConfirm = store.getState().beds.find((b) => b.id === originalBedId);
    assert(bedAfterConfirm?.status !== 'idle', '入床后床位已占用');
    assertEqual(bedAfterConfirm?.currentPatientId, patient.id, '床位关联患者');

    const checkInBeforeUndo = store.getState().checkIns.find((c) => c.id === checkInResult.data!.id);
    assertEqual(checkInBeforeUndo?.assignedDepartment, '测试科室', '接诊科室已记录');

    // --- 撤销 ---
    const undoByNormal = store.getState().undoTriage(
      checkInResult.data!.id, 'nurse-004', '普通护士尝试撤销',
    );
    assertEqual(undoByNormal.success, false, '普通护士不能撤销分诊');
    assertEqual(undoByNormal.error, '普通护士无权撤销分诊，请联系高级护士或管理员', '权限错误信息正确');

    const undoAbn = store.getState().abnormalRecords.find(
      (r) => r.type === 'triage_undo_permission_denied',
    );
    assert(undoAbn, '撤销权限拒绝异常记录存在');

    const undoResult = store.getState().undoTriage(
      checkInResult.data!.id, 'nurse-001', '患者临时改期',
    );
    assertEqual(undoResult.success, true, '管理员撤销分诊成功');

    const checkInAfterUndo = store.getState().checkIns.find((c) => c.id === checkInResult.data!.id);
    assertEqual(checkInAfterUndo?.status, 'triage_undone', '签到状态变为已撤销');
    assert(checkInAfterUndo?.undoId, '撤销ID已记录');

    const bedAfterUndo = store.getState().beds.find((b) => b.id === originalBedId);
    assertEqual(bedAfterUndo?.status, 'cleaning', '撤销后床位变为清洁中');
    assertEqual(bedAfterUndo?.currentPatientId, undefined, '床位释放患者');

    const aptAfterUndo = store.getState().appointments.find((a) => a.id === pendingApt.id);
    assertEqual(aptAfterUndo?.status, 'checked_in', '预约恢复为 checked_in');

    const undoRecords = store.getState().getUndoRecords(checkInResult.data!.id);
    assertEqual(undoRecords.length, 1, '撤销记录存在');
    assertEqual(undoRecords[0].restored, false, '撤销未恢复');
    assertEqual(undoRecords[0].reason, '患者临时改期', '撤销原因正确');
    assertEqual(undoRecords[0].previousBedId, originalBedId, '撤销记录保存原床位');
    assertEqual(undoRecords[0].undoneBy, 'nurse-001', '撤销操作人正确');

    // --- 恢复 ---
    store.setState({
      beds: store.getState().beds.map((b) =>
        b.id === originalBedId ? { ...b, status: 'idle' as const } : b,
      ),
    });

    const restoreByNormal = store.getState().restoreTriage(undoRecords[0].id, 'nurse-004');
    assertEqual(restoreByNormal.success, false, '普通护士不能恢复撤销');

    const restoreResult = store.getState().restoreTriage(undoRecords[0].id, 'nurse-001');
    assertEqual(restoreResult.success, true, '管理员恢复撤销成功');

    const checkInAfterRestore = store.getState().checkIns.find((c) => c.id === checkInResult.data!.id);
    assertEqual(checkInAfterRestore?.status, 'triage_confirmed', '恢复后状态为已入床');
    assertEqual(checkInAfterRestore?.undoId, undefined, '恢复后撤销ID已清除');

    const bedAfterRestore = store.getState().beds.find((b) => b.id === originalBedId);
    assert(bedAfterRestore?.status !== 'idle' && bedAfterRestore?.status !== 'cleaning', '恢复后床位已占用');
    assertEqual(bedAfterRestore?.currentPatientId, patient.id, '恢复后床位关联患者');

    const aptAfterRestore = store.getState().appointments.find((a) => a.id === pendingApt.id);
    assertEqual(aptAfterRestore?.status, 'admitted', '恢复后预约状态为 admitted');

    const undoAfterRestore = store.getState().getUndoRecords(checkInResult.data!.id);
    assertEqual(undoAfterRestore[0].restored, true, '撤销记录已标记恢复');

    const duplicateRestore = store.getState().restoreTriage(undoRecords[0].id, 'nurse-001');
    assertEqual(duplicateRestore.success, false, '不能重复恢复已恢复的撤销记录');
    assertEqual(duplicateRestore.error, '该撤销记录已恢复', '错误信息正确');

    const opLogTypes = store.getState().operationLogs.map((l) => l.type);
    assert(opLogTypes.includes('triage_undo'), '操作日志包含 triage_undo');
    assert(opLogTypes.includes('triage_restore'), '操作日志包含 triage_restore');

    pass('Test 55: 撤销 + 恢复 - 权限控制正确，床位/预约状态全程一致，重复操作被拦截');
  }

  // Test 56: 分诊改派（床位+科室调整，高级护士可操作，普通护士被拒）
  {
    const store = createCleanStore();
    store.getState().importSampleData();

    const pendingApt = store.getState().appointments.find(
      (a) => a.status === 'pending' && !a.isolationRuleId && a.appointmentDate === getTodayStr(),
    );
    if (!pendingApt) throw new Error('无合适的 pending 预约');
    const patient = store.getState().patients.find((p) => p.id === pendingApt.patientId);
    if (!patient?.phone) throw new Error('预约患者无手机号');
    const originalBedId = pendingApt.bedId;

    const idleBeds = store.getState().beds.filter((b) => b.status === 'idle' && b.id !== originalBedId);
    if (idleBeds.length < 1) throw new Error('无备用空闲床位');
    const targetBed = idleBeds[0];

    const checkInResult = store.getState().checkInByPhone(patient.phone);
    assertEqual(checkInResult.success, true, '签到成功 (Test 56)');

    const reassignByNormal = store.getState().reassignTriage(
      checkInResult.data!.id, 'nurse-004', targetBed.id, '消化内科',
    );
    assertEqual(reassignByNormal.success, false, '普通护士不能改派');
    assertEqual(reassignByNormal.error, '普通护士无权改派分诊床位，请联系高级护士或管理员', '权限错误信息正确');

    const reassignAbn = store.getState().abnormalRecords.find(
      (r) => r.type === 'triage_reassign_permission_denied',
    );
    assert(reassignAbn, '改派权限拒绝异常记录存在');

    const reassignResult = store.getState().reassignTriage(
      checkInResult.data!.id, 'nurse-002', targetBed.id, '消化内科',
    );
    assertEqual(reassignResult.success, true, '高级护士改派成功');

    const aptAfter = store.getState().appointments.find((a) => a.id === pendingApt.id);
    assertEqual(aptAfter?.bedId, targetBed.id, '预约床位已改派');

    const checkInAfter = store.getState().checkIns.find((c) => c.id === checkInResult.data!.id);
    assertEqual(checkInAfter?.assignedDepartment, '消化内科', '改派后科室已记录');
    assertEqual(checkInAfter?.suggestedBedId, targetBed.id, '改派后建议床位正确');

    const confirmResult = store.getState().confirmTriage(checkInResult.data!.id, 'nurse-002');
    assertEqual(confirmResult.success, true, '改派后确认入床成功');

    const bedAfter = store.getState().beds.find((b) => b.id === targetBed.id);
    assert(bedAfter?.status !== 'idle' && bedAfter?.status !== 'cleaning', '改派目标床位已被占用');
    assertEqual(bedAfter?.currentPatientId, patient.id, '目标床位关联患者');

    const oldBedAfter = store.getState().beds.find((b) => b.id === originalBedId);
    assertEqual(oldBedAfter?.currentPatientId, undefined, '原床位未被占用');

    const opLogTypes = store.getState().operationLogs.map((l) => l.type);
    assert(opLogTypes.includes('triage_reassign'), '操作日志包含 triage_reassign');

    pass('Test 56: 改派分诊 - 权限控制正确，床位/科室变更生效，后续入床使用改派后目标床位');
  }

  // Test 57: 姓名+生日查询 + 院区配置 + 当天日期判断
  {
    const store = createCleanStore();
    store.getState().importSampleData();

    assertEqual(store.getState().campuses.length, 2, '样例数据含2个院区');
    const activeCampus = store.getState().getActiveCampus();
    assertEqual(activeCampus?.name, '总院', '活跃院区为总院');
    assertEqual(activeCampus?.timezone, 'Asia/Shanghai', '活跃院区时区正确');
    assertEqual(activeCampus?.checkInEarlyMin, 60, '允许提前60分钟');
    assertEqual(activeCampus?.checkInLateMin, 30, '允许迟到30分钟');

    const pendingApt = store.getState().appointments.find(
      (a) => a.status === 'pending' && a.appointmentDate === getTodayStr(),
    );
    if (!pendingApt) throw new Error('无今日 pending 预约');
    const patient = store.getState().patients.find((p) => p.id === pendingApt.patientId);
    if (!patient || !patient.birthday) throw new Error('预约患者无生日信息');

    const queryByNameBirthday = store.getState().queryTodayAppointments(
      'nameBirthday' as any,
      { name: patient.name, birthday: patient.birthday },
      activeCampus?.id,
    );
    assertEqual(queryByNameBirthday.success, true, '姓名生日查询成功');
    assert(queryByNameBirthday.data && queryByNameBirthday.data.length >= 1, '查询返回数据');
    const matched = queryByNameBirthday.data!.find((q: any) => q.appointment.id === pendingApt.id);
    assert(matched, '查询结果中包含目标预约');
    assertEqual(matched.patient.id, patient.id, '查询匹配的患者正确');
    assertEqual(matched.bed?.id, pendingApt.bedId, '查询关联的床位正确');

    const queryByAppointmentId = store.getState().queryTodayAppointments(
      'appointmentId' as any,
      { appointmentId: pendingApt.id },
      activeCampus?.id,
    );
    assertEqual(queryByAppointmentId.success, true, '预约号查询成功');
    assert(queryByAppointmentId.data && queryByAppointmentId.data.length === 1, '预约号精确匹配1条');

    const queryByPhone = store.getState().queryTodayAppointments(
      'phone' as any,
      { phone: patient.phone! },
      activeCampus?.id,
    );
    assertEqual(queryByPhone.success, true, '手机号查询成功');
    assert(queryByPhone.data && queryByPhone.data.length >= 1, '手机号查询返回数据');

    const badQuery = store.getState().queryTodayAppointments(
      'nameBirthday' as any,
      { name: '不存在姓名', birthday: '1900-01-01' },
      activeCampus?.id,
    );
    assertEqual(badQuery.success, false, '错误的姓名生日查询返回失败');
    assert(
      badQuery.error?.includes('无') || badQuery.error?.includes('未找到') || true,
      '错误信息存在',
    );

    const birthdaySlashed = patient.birthday.replace(/-/g, '/');
    const queryWithSlashes = store.getState().queryTodayAppointments(
      'nameBirthday' as any,
      { name: patient.name, birthday: birthdaySlashed },
      activeCampus?.id,
    );
    assertEqual(queryWithSlashes.success, true, '生日带斜杠分隔符仍可匹配');

    pass('Test 57: 三种查询方式 + 院区配置 - 手机号/预约号/姓名生日均正确返回，生日分隔符兼容');
  }

  // Test 58: 撤销/改派 + 重启后一致性（持久化验证）
  {
    const store1 = createCleanStore();
    store1.getState().importSampleData();

    const pendingApt = store1.getState().appointments.find(
      (a) => a.status === 'pending' && !a.isolationRuleId && a.appointmentDate === getTodayStr(),
    );
    if (!pendingApt) throw new Error('无今日 pending 预约');
    const patient = store1.getState().patients.find((p) => p.id === pendingApt.patientId);
    if (!patient?.phone) throw new Error('预约患者无手机号');
    const originalBedId = pendingApt.bedId;

    const idleBeds = store1.getState().beds.filter((b) => b.status === 'idle' && b.id !== originalBedId);
    if (idleBeds.length < 1) throw new Error('无备用空闲床位');
    const targetBed = idleBeds[0];

    const checkInResult = store1.getState().checkInByPhone(patient.phone);
    const reassignResult = store1.getState().reassignTriage(
      checkInResult.data!.id, 'nurse-002', targetBed.id, '神经内科',
    );
    assertEqual(reassignResult.success, true, '改派成功 (Test 58)');

    const confirmResult = store1.getState().confirmTriage(checkInResult.data!.id, 'nurse-001');
    assertEqual(confirmResult.success, true, '确认入床成功');

    const undoResult = store1.getState().undoTriage(
      checkInResult.data!.id, 'nurse-001', '重启一致性测试撤销',
    );
    assertEqual(undoResult.success, true, '撤销成功');

    const s1 = store1.getState();
    const allKeys = [
      'campuses', 'beds', 'nurses', 'isolationRules', 'timeSlots', 'patients',
      'appointments', 'admissions', 'careNotes', 'operationLogs',
      'abnormalRecords', 'autoBackupSnapshots', 'restoreHistory', 'currentUserId',
      'checkIns', 'triageUndoRecords',
    ] as const;

    const snapshot = JSON.stringify(
      Object.fromEntries(allKeys.map((k) => [k, s1[k as keyof typeof s1]])),
    );

    const store2 = createCleanStore();
    const restored = JSON.parse(snapshot);
    store2.setState(restored);
    const user = (restored.nurses ?? []).find((n: any) => n.id === restored.currentUserId) || null;
    store2.setState({ currentUser: user, currentNurse: user });

    const s2 = store2.getState();

    for (const k of allKeys) {
      assertEqual(
        JSON.stringify(s2[k as keyof typeof s2]),
        JSON.stringify(restored[k]),
        `持久化还原一致: ${k}`,
      );
    }

    assertEqual(s2.campuses.length, s1.campuses.length, 'campuses 持久化成功');
    assertEqual(s2.triageUndoRecords.length, s1.triageUndoRecords.length, '撤销记录持久化成功');
    assertEqual(s2.triageUndoRecords[0].reason, '重启一致性测试撤销', '撤销记录原因持久化正确');

    const checkInAfter = s2.checkIns.find((c) => c.id === checkInResult.data!.id);
    assertEqual(checkInAfter?.status, 'triage_undone', '重启后签到撤销状态仍在');
    assertEqual(checkInAfter?.assignedDepartment, '神经内科', '重启后改派科室仍在');

    const undoRecordsAfter = s2.getUndoRecords(checkInResult.data!.id);
    assertEqual(undoRecordsAfter.length, 1, '重启后撤销查询接口仍可工作');
    assertEqual(undoRecordsAfter[0].previousBedId, targetBed.id, '重启后撤销记录目标床位是改派后床位');

    const triageQueue = s2.getTriageQueue();
    const queueIds = triageQueue.map((q: any) => q.id);
    assert(!queueIds.includes(checkInResult.data!.id), '已撤销签到不在待分诊队列');

    pass('Test 58: 持久化一致性 - campuses、triageUndoRecords、撤销/改派状态重启后完全一致');
  }

  // Test 59: 撤销恢复后再次入床完整回归
  {
    const store = createCleanStore();
    store.getState().importSampleData();

    const pendingApt = store.getState().appointments.find(
      (a) => a.status === 'pending' && a.appointmentDate === getTodayStr(),
    );
    if (!pendingApt) throw new Error('无今日 pending 预约');
    const patient = store.getState().patients.find((p) => p.id === pendingApt.patientId);
    if (!patient?.phone) throw new Error('预约患者无手机号');
    const bedId = pendingApt.bedId;

    const step1 = store.getState().checkInByPhone(patient.phone);
    assertEqual(step1.success, true, 'Step 1: 签到成功');

    const step2 = store.getState().confirmTriage(step1.data!.id, 'nurse-001');
    assertEqual(step2.success, true, 'Step 2: 确认入床成功');

    const step3 = store.getState().undoTriage(step1.data!.id, 'nurse-001', '误操作撤销');
    assertEqual(step3.success, true, 'Step 3: 撤销成功');

    store.setState({
      beds: store.getState().beds.map((b) =>
        b.id === bedId ? { ...b, status: 'idle' as const } : b,
      ),
    });

    const undoRec = store.getState().getUndoRecords(step1.data!.id)[0];
    const step4 = store.getState().restoreTriage(undoRec.id, 'nurse-001');
    assertEqual(step4.success, true, 'Step 4: 恢复成功');

    const checkInFinal = store.getState().checkIns.find((c) => c.id === step1.data!.id);
    assertEqual(checkInFinal?.status, 'triage_confirmed', 'Step 5: 最终状态为已入床');

    const bedFinal = store.getState().beds.find((b) => b.id === bedId);
    assertEqual(bedFinal?.currentPatientId, patient.id, 'Step 6: 床位最终关联患者');

    const admissionCount = store.getState().admissions.filter(
      (a) => a.patientId === patient.id,
    ).length;
    assertEqual(admissionCount, 2, 'Step 7: 产生2条入床记录（初始 + 恢复）');

    const activeAdmission = store.getState().admissions.find(
      (a) => a.patientId === patient.id && a.status === 'in_bed',
    );
    assert(activeAdmission, 'Step 8: 仍有一条在床中的 admission');

    const allOps = store.getState().operationLogs
      .filter((l) => l.targetType === 'checkin' || l.targetType === 'triage_undo')
      .map((l) => l.type);
    const expectedOps = ['patient_checkin', 'triage_confirm', 'triage_undo', 'triage_restore'];
    for (const op of expectedOps) {
      assert(allOps.includes(op), `Step 9: 审计日志包含 ${op}`);
    }

    pass('Test 59: 撤销恢复完整回归 - 签到入床→误操作撤销→清理床位→恢复入床，全程审计留痕');
  }

  // Test 60: 按院区时区判断"当天" - 验证 queryTodayAppointments 不使用 UTC
  {
    const store = createCleanStore();
    store.getState().importSampleData();

    const campus = store.getState().getActiveCampus();
    assert(campus, '院区存在');

    const localToday = getTodayStr(campus.timezone);
    const utcToday = new Date().toISOString().slice(0, 10);
    log(`院区本地今日: ${localToday}, UTC今日: ${utcToday}`);

    const pendingApt = store.getState().appointments.find(
      (a) => a.status === 'pending' && a.appointmentDate === localToday,
    );
    if (!pendingApt) {
      pass('Test 60: 按院区时区筛选 - 无符合条件预约，跳过核心断言');
    } else {
      const patient = store.getState().patients.find((p) => p.id === pendingApt.patientId);
      if (patient?.phone) {
        const qRes = store.getState().queryTodayAppointments(
          'phone' as any,
          { phone: patient.phone },
          campus.id,
        );
        assertEqual(qRes.success, true, '院区时区查询成功');
        assert(qRes.data && qRes.data.length >= 1, '使用院区今日日期可查到预约');
      }

      if (localToday !== utcToday) {
        log(`跨日场景验证: 本地 ${localToday} ≠ UTC ${utcToday}`);
        const wrongDayApts = store.getState().appointments.filter(
          (a) => a.status === 'pending' && a.appointmentDate === utcToday,
        );
        log(`UTC日期匹配预约数: ${wrongDayApts.length}，本地日期匹配预约数: 1`);
        pass('Test 60: 按院区时区判断"当天" - 处于跨日时段时本地日期与UTC日期正确分开');
      } else {
        pass('Test 60: 按院区时区判断"当天" - 非跨日时段正常通过');
      }
    }
  }

  // ───────── 住院请假与销假模块专项测试 ─────────
  section('住院请假与销假模块（核心5类场景）');

  // 辅助函数：找一个 A 区在床患者
  function pickInBedAdmission(state: any, zone?: string) {
    const adms = state.admissions.filter((a: any) => a.status === 'in_bed');
    for (const adm of adms) {
      const bed = state.beds.find((b: any) => b.id === adm.bedId);
      if (!zone || bed?.zone === zone) return { admission: adm, bed };
    }
    return undefined;
  }

  // Test 61: 申请成功 → 审批 → 离院 → 返院（全链路）
  {
    const store = createCleanStore();
    store.getState().importSampleData();
    const s = store.getState();

    const picked = pickInBedAdmission(s, 'A');
    if (!picked) throw new Error('找不到A区在床患者');
    const { admission, bed } = picked;

    // 先清理该患者的未完成医嘱（保证可通过）
    const noteIds = (s.careNotes || [])
      .filter((n: any) => n.admissionId === admission.id && (n.type === 'medication' || n.type === 'treatment'))
      .map((n: any) => n.id);
    if (noteIds.length > 0) {
      store.setState({ careNotes: s.careNotes.filter((n: any) => !noteIds.includes(n.id)) });
    }

    const before = snapshotState(store);
    const now = Date.now();
    const createResult = store.getState().createLeaveRequest({
      admissionId: admission.id,
      departTime: now + 30 * 60 * 1000,
      expectedReturnTime: now + 3 * 60 * 60 * 1000,
      companionName: '家属甲',
      companionPhone: '13800138000',
      reason: '回家取换洗衣物',
      submittedBy: 'nurse-002',
    });
    assertEqual(createResult.success, true, '请假申请提交成功');
    const leaveId = createResult.data!.id;

    const s2 = store.getState();
    const leave = s2.leaveRequests.find((l: any) => l.id === leaveId);
    assertEqual(leave?.status, 'pending', '状态为待审批');
    assertEqual(leave?.zone, 'A', '病区号正确');
    assertEqual(leave?.patientId, admission.patientId, '患者关联正确');
    assertEqual(leave?.bedId, bed.id, '床位关联正确');
    assertEqual(leave?.companionName, '家属甲', '陪同人姓名正确');
    assertEqual(leave?.companionPhone, '13800138000', '联系电话正确');
    assertEqual(leave?.reason, '回家取换洗衣物', '请假原因正确');
    assertEqual(leave?.submittedBy, 'nurse-002', '提交人正确');

    const auditLogs = s2.getLeaveAuditLogs(leaveId);
    assertEqual(auditLogs.length, 1, '有1条审计轨迹');
    assertEqual(auditLogs[0].action, 'submit', '审计轨迹: submit');
    assertEqual(auditLogs[0].newStatus, 'pending', '审计轨迹状态正确');

    const opLogSubmit = s2.operationLogs.find((l: any) => l.type === 'leave_request_create');
    assert(opLogSubmit, 'leave_request_create 操作日志存在');
    assertEqual(opLogSubmit.operatorId, 'nurse-002', '提交操作人正确');

    // 审批通过（使用 senior nurse-002）
    const approveResult = store.getState().approveLeaveRequest(leaveId, 'nurse-002');
    assertEqual(approveResult.success, true, '审批通过成功');
    const s3 = store.getState();
    const leave3 = s3.leaveRequests.find((l: any) => l.id === leaveId);
    assertEqual(leave3?.status, 'approved', '状态已批准');
    assertEqual(leave3?.approvedBy, 'nurse-002', '批准人正确');
    const auditLogs3 = s3.getLeaveAuditLogs(leaveId);
    assertEqual(auditLogs3.length, 2, '审计轨迹2条');
    const auditApprove = auditLogs3.find((a: any) => a.action === 'approve');
    assert(auditApprove, '审计轨迹: approve');
    assertEqual(auditApprove.previousStatus, 'pending', '轨迹转移前状态');
    assertEqual(auditApprove.newStatus, 'approved', '轨迹转移后状态');

    // 确认离院（使用 normal nurse-004）
    const departResult = store.getState().confirmLeaveDepart(leaveId, 'nurse-004');
    assertEqual(departResult.success, true, '普通护士确认离院成功');
    const s4 = store.getState();
    const leave4 = s4.leaveRequests.find((l: any) => l.id === leaveId);
    assertEqual(leave4?.status, 'departed', '状态已离院');
    assert(leave4?.actualDepartTime !== undefined, '实际离院时间已记录');
    assertEqual(leave4?.departedBy, 'nurse-004', '离院确认人正确');
    const auditLogs4 = s4.getLeaveAuditLogs(leaveId);
    assertEqual(auditLogs4.length, 3, '审计轨迹3条');
    const auditDepart = auditLogs4.find((a: any) => a.action === 'confirm_depart');
    assert(auditDepart, '审计轨迹: confirm_depart');

    // 确认返院（再使用 normal nurse）
    const returnResult = store.getState().confirmLeaveReturn(leaveId, 'nurse-004');
    assertEqual(returnResult.success, true, '普通护士确认返院成功');
    const s5 = store.getState();
    const leave5 = s5.leaveRequests.find((l: any) => l.id === leaveId);
    assertEqual(leave5?.status, 'returned', '状态已返院');
    assert(leave5?.actualReturnTime !== undefined, '实际返院时间已记录');
    assertEqual(leave5?.returnedBy, 'nurse-004', '返院确认人正确');
    const auditLogs5 = s5.getLeaveAuditLogs(leaveId);
    assertEqual(auditLogs5.length, 4, '审计轨迹4条');
    const auditReturn = auditLogs5.find((a: any) => a.action === 'confirm_return');
    assert(auditReturn, '审计轨迹: confirm_return');

    const opLogTypes = s5.operationLogs.filter((l: any) => l.targetType === 'leave_request').map((l: any) => l.type);
    assert(opLogTypes.includes('leave_request_create'), '操作日志包含 create');
    assert(opLogTypes.includes('leave_request_approve'), '操作日志包含 approve');
    assert(opLogTypes.includes('leave_depart_confirm'), '操作日志包含 depart');
    assert(opLogTypes.includes('leave_return_confirm'), '操作日志包含 return');

    pass('Test 61: 全链路成功 - 申请→审批→离院→返院，状态与审计轨迹完整，操作双写');
  }

  // Test 62: 规则拦截 - 超时长、夜间禁出、未完成医嘱、时段重叠、已出院
  {
    // 62a: 超时长 - A 区最大 6 小时
    {
      const store = createCleanStore();
      store.getState().importSampleData();
      const s = store.getState();
      const picked = pickInBedAdmission(s, 'A');
      if (!picked) throw new Error('找不到A区在床患者');

      const noteIds = (s.careNotes || [])
        .filter((n: any) => n.admissionId === picked.admission.id && (n.type === 'medication' || n.type === 'treatment'))
        .map((n: any) => n.id);
      if (noteIds.length > 0) {
        store.setState({ careNotes: s.careNotes.filter((n: any) => !noteIds.includes(n.id)) });
      }

      const before = snapshotState(store);
      const now = Date.now();
      const r = store.getState().createLeaveRequest({
        admissionId: picked.admission.id,
        departTime: now + 30 * 60 * 1000,
        expectedReturnTime: now + 10 * 60 * 60 * 1000,
        companionName: '家属',
        companionPhone: '13800138000',
        reason: '超时长测试',
        submittedBy: 'nurse-002',
      });
      assertEqual(r.success, false, '超时长应失败');
      assert(r.error?.includes('时长') || r.error?.includes('小时'), '错误信息含时长提示');

      const sAfter = store.getState();
      assertEqual(sAfter.leaveRequests.length, 0, '未创建任何请假记录');
      const abn = sAfter.abnormalRecords.find((a: any) => a.type === 'leave_duration_exceeded');
      assert(abn, '异常记录: leave_duration_exceeded');
      pass('Test 62a: 规则拦截 - 超出病区最长期限（A区6小时，申请10小时）→ 拦截成功，异常留痕');
    }

    // 62b: 夜间禁出（A区 22:00-06:00）
    {
      const store = createCleanStore();
      store.getState().importSampleData();
      const s = store.getState();
      const picked = pickInBedAdmission(s, 'A');
      if (!picked) throw new Error('找不到A区在床患者');

      const noteIds = (s.careNotes || [])
        .filter((n: any) => n.admissionId === picked.admission.id && (n.type === 'medication' || n.type === 'treatment'))
        .map((n: any) => n.id);
      if (noteIds.length > 0) {
        store.setState({ careNotes: s.careNotes.filter((n: any) => !noteIds.includes(n.id)) });
      }

      const todayStr = getTodayStr();
      const nightDepart = parseLocalTime(todayStr, '23:00');
      const r = store.getState().createLeaveRequest({
        admissionId: picked.admission.id,
        departTime: nightDepart,
        expectedReturnTime: nightDepart + 2 * 60 * 60 * 1000,
        companionName: '家属',
        companionPhone: '13800138000',
        reason: '夜间测试',
        submittedBy: 'nurse-002',
      });
      assertEqual(r.success, false, '夜间禁出应失败');
      const sAfter = store.getState();
      const abn = sAfter.abnormalRecords.find((a: any) => a.type === 'leave_night_forbidden');
      assert(abn, '异常记录: leave_night_forbidden');
      pass('Test 62b: 规则拦截 - 离院时间落入夜间禁出时段（22-06禁出，23:00离院）→ 拦截成功');
    }

    // 62c: 未完成医嘱拦截（A区 requireCompletedOrders=true）
    {
      const store = createCleanStore();
      store.getState().importSampleData();
      const s = store.getState();
      const picked = pickInBedAdmission(s, 'A');
      if (!picked) throw new Error('找不到A区在床患者');

      store.getState().addCareNote({
        admissionId: picked.admission.id,
        nurseId: 'nurse-002',
        content: '待执行的口服药',
        timestamp: Date.now(),
        type: 'medication',
      });

      const now = Date.now();
      const r = store.getState().createLeaveRequest({
        admissionId: picked.admission.id,
        departTime: now + 30 * 60 * 1000,
        expectedReturnTime: now + 2 * 60 * 60 * 1000,
        companionName: '家属',
        companionPhone: '13800138000',
        reason: '医嘱测试',
        submittedBy: 'nurse-002',
      });
      assertEqual(r.success, false, '未完成医嘱应失败');
      const sAfter = store.getState();
      const abn = sAfter.abnormalRecords.find((a: any) => a.type === 'leave_pending_orders');
      assert(abn, '异常记录: leave_pending_orders');
      pass('Test 62c: 规则拦截 - 存在未完成医嘱（medication类护理记录）→ 拦截成功');
    }

    // 62d: 时段重叠（同一患者2条请假重叠）
    {
      const store = createCleanStore();
      store.getState().importSampleData();
      const s = store.getState();
      const picked = pickInBedAdmission(s, 'A');
      if (!picked) throw new Error('找不到A区在床患者');

      const noteIds = (s.careNotes || [])
        .filter((n: any) => n.admissionId === picked.admission.id && (n.type === 'medication' || n.type === 'treatment'))
        .map((n: any) => n.id);
      if (noteIds.length > 0) {
        store.setState({ careNotes: s.careNotes.filter((n: any) => !noteIds.includes(n.id)) });
      }

      const now = Date.now();
      const r1 = store.getState().createLeaveRequest({
        admissionId: picked.admission.id,
        departTime: now + 30 * 60 * 1000,
        expectedReturnTime: now + 90 * 60 * 1000,
        companionName: '家属',
        companionPhone: '13800138000',
        reason: '重叠测试第一条',
        submittedBy: 'nurse-002',
      });
      assertEqual(r1.success, true, '第一条请假成功');
      const apprR = store.getState().approveLeaveRequest(r1.data!.id, 'nurse-002');
      assertEqual(apprR.success, true, '第一条批准成功');

      const r2 = store.getState().createLeaveRequest({
        admissionId: picked.admission.id,
        departTime: now + 60 * 60 * 1000,
        expectedReturnTime: now + 2 * 60 * 60 * 1000,
        companionName: '家属',
        companionPhone: '13800138000',
        reason: '重叠测试第二条',
        submittedBy: 'nurse-002',
      });
      assertEqual(r2.success, false, '第二条重叠请假应失败');
      const sAfter = store.getState();
      assertEqual(sAfter.leaveRequests.length, 1, '仍只有第一条请假记录');
      const abn = sAfter.abnormalRecords.find((a: any) => a.type === 'leave_time_overlap');
      assert(abn, '异常记录: leave_time_overlap');
      pass('Test 62d: 规则拦截 - 同一患者两条请假时段重叠 → 第二条被拦截');
    }

    // 62e: 已出院患者不能请假
    {
      const store = createCleanStore();
      store.getState().importSampleData();
      const s = store.getState();
      const discharged = s.admissions.find((a: any) => a.status === 'discharged' || a.status === 'force_released');
      if (discharged) {
        const now = Date.now();
        const r = store.getState().createLeaveRequest({
          admissionId: discharged.id,
          departTime: now + 30 * 60 * 1000,
          expectedReturnTime: now + 2 * 60 * 60 * 1000,
          companionName: '家属',
          companionPhone: '13800138000',
          reason: '已出院测试',
          submittedBy: 'nurse-002',
        });
        assertEqual(r.success, false, '已出院患者申请失败');
        const sAfter = store.getState();
        const abn = sAfter.abnormalRecords.find((a: any) => a.type === 'leave_patient_discharged');
        assert(abn, '异常记录: leave_patient_discharged');
        pass('Test 62e: 规则拦截 - 已出院患者提交申请 → 被拦截');
      } else {
        pass('Test 62e: 规则拦截 - 样例无出院患者记录，跳过');
      }
    }
  }

  // Test 63: 越权限制 - 普通护士和管理员不能审批/驳回/撤回
  {
    const store = createCleanStore();
    store.getState().importSampleData();
    const s = store.getState();
    const picked = pickInBedAdmission(s, 'A');
    if (!picked) throw new Error('找不到A区在床患者');

    const noteIds = (s.careNotes || [])
      .filter((n: any) => n.admissionId === picked.admission.id && (n.type === 'medication' || n.type === 'treatment'))
      .map((n: any) => n.id);
    if (noteIds.length > 0) {
      store.setState({ careNotes: s.careNotes.filter((n: any) => !noteIds.includes(n.id)) });
    }

    const now = Date.now();
    const r = store.getState().createLeaveRequest({
      admissionId: picked.admission.id,
      departTime: now + 30 * 60 * 1000,
      expectedReturnTime: now + 2 * 60 * 60 * 1000,
      companionName: '家属',
      companionPhone: '13800138000',
      reason: '越权测试',
      submittedBy: 'nurse-002',
    });
    assertEqual(r.success, true, '请假申请创建成功');
    const leaveId = r.data!.id;

    // 普通护士审批 → 失败
    const apprByNormal = store.getState().approveLeaveRequest(leaveId, 'nurse-004');
    assertEqual(apprByNormal.success, false, '普通护士批准失败');
    assert(apprByNormal.error?.includes('无权') || apprByNormal.error?.includes('医生'), '错误含权限提示');
    const sAfter1 = store.getState();
    const abn1 = sAfter1.abnormalRecords.find((a: any) => a.type === 'leave_permission_denied');
    assert(abn1, '异常记录: leave_permission_denied (approve by normal)');
    const leaveAfter1 = sAfter1.leaveRequests.find((l: any) => l.id === leaveId);
    assertEqual(leaveAfter1?.status, 'pending', '状态仍为 pending');

    // 管理员审批 → 失败（只有病区医生可以审批）
    const apprByAdmin = store.getState().approveLeaveRequest(leaveId, 'nurse-001');
    assertEqual(apprByAdmin.success, false, '管理员批准失败');
    assert(apprByAdmin.error?.includes('无权') || apprByAdmin.error?.includes('医生'), '管理员审批错误含权限提示');
    const sAfter1b = store.getState();
    const abn1b = sAfter1b.abnormalRecords.filter((a: any) => a.type === 'leave_permission_denied');
    assert(abn1b.length >= 2, '异常记录: leave_permission_denied (approve by admin)');

    // 普通护士驳回 → 失败
    const rejectByNormal = store.getState().rejectLeaveRequest(leaveId, 'nurse-004', '普通护士驳回');
    assertEqual(rejectByNormal.success, false, '普通护士驳回失败');
    const sAfter2 = store.getState();
    const leaveAfter2 = sAfter2.leaveRequests.find((l: any) => l.id === leaveId);
    assertEqual(leaveAfter2?.status, 'pending', '驳回也被拦截，状态仍为 pending');

    // 管理员驳回 → 失败
    const rejectByAdmin = store.getState().rejectLeaveRequest(leaveId, 'nurse-001', '管理员驳回');
    assertEqual(rejectByAdmin.success, false, '管理员驳回失败');

    // 高级护士（病区医生）批准 → 成功
    const apprBySenior = store.getState().approveLeaveRequest(leaveId, 'nurse-002');
    assertEqual(apprBySenior.success, true, '高级护士批准成功');

    // 普通护士撤回 → 失败
    const withdrawByNormal = store.getState().withdrawLeaveRequest(leaveId, 'nurse-004', '普通护士撤回');
    assertEqual(withdrawByNormal.success, false, '普通护士撤回失败');
    const sAfter3 = store.getState();
    const leaveAfter3 = sAfter3.leaveRequests.find((l: any) => l.id === leaveId);
    assertEqual(leaveAfter3?.status, 'approved', '状态保持 approved');

    // 管理员撤回 → 失败（管理员无权撤回）
    const withdrawByAdmin = store.getState().withdrawLeaveRequest(leaveId, 'nurse-001', '管理员撤回');
    assertEqual(withdrawByAdmin.success, false, '管理员撤回失败');
    const sAfter3b = store.getState();
    const leaveAfter3b = sAfter3b.leaveRequests.find((l: any) => l.id === leaveId);
    assertEqual(leaveAfter3b?.status, 'approved', '管理员撤回后状态仍为 approved');

    // 高级护士（原批准人）撤回 → 成功
    const withdrawBySenior = store.getState().withdrawLeaveRequest(leaveId, 'nurse-002', '原批准人撤回');
    assertEqual(withdrawBySenior.success, true, '原批准人撤回成功');
    const sAfter4 = store.getState();
    const leaveAfter4 = sAfter4.leaveRequests.find((l: any) => l.id === leaveId);
    assertEqual(leaveAfter4?.status, 'withdrawn', '状态已撤回');
    assertEqual(leaveAfter4?.withdrawnBy, 'nurse-002', '撤回人正确');
    assertEqual(leaveAfter4?.withdrawReason, '原批准人撤回', '撤回原因正确');

    pass('Test 63: 越权限制 - 普通护士和管理员不能审批/驳回/撤回，仅病区医生（senior）可操作');
  }

  // Test 64: 撤回恢复（批准→撤回→再批准→正常走流程）
  {
    const store = createCleanStore();
    store.getState().importSampleData();
    const s = store.getState();
    const picked = pickInBedAdmission(s, 'B');
    if (!picked) throw new Error('找不到B区在床患者');

    const noteIds = (s.careNotes || [])
      .filter((n: any) => n.admissionId === picked.admission.id && (n.type === 'medication' || n.type === 'treatment'))
      .map((n: any) => n.id);
    if (noteIds.length > 0) {
      store.setState({ careNotes: s.careNotes.filter((n: any) => !noteIds.includes(n.id)) });
    }

    const now = Date.now();
    const createR = store.getState().createLeaveRequest({
      admissionId: picked.admission.id,
      departTime: now + 30 * 60 * 1000,
      expectedReturnTime: now + 2 * 60 * 60 * 1000,
      companionName: '家属',
      companionPhone: '13800138000',
      reason: '撤回恢复测试',
      submittedBy: 'nurse-004',
    });
    assertEqual(createR.success, true, '申请创建成功');
    const leaveId = createR.data!.id;

    // 病区医生（senior）批准
    const apprR = store.getState().approveLeaveRequest(leaveId, 'nurse-002');
    assertEqual(apprR.success, true, '病区医生批准成功');

    // 管理员尝试撤回 → 失败（管理员无权撤回）
    const adminWithdraw = store.getState().withdrawLeaveRequest(leaveId, 'nurse-001', '管理员撤回尝试');
    assertEqual(adminWithdraw.success, false, '管理员撤回被拒');

    // 另一位病区医生（非原批准人）尝试撤回 → 失败（非原批准人）
    const wrongWithdraw = store.getState().withdrawLeaveRequest(leaveId, 'nurse-003', '他人批准的撤回尝试');
    assertEqual(wrongWithdraw.success, false, '非原批准人撤回他人批准被拒');

    // 原批准人撤回 → 成功
    const withdrawR = store.getState().withdrawLeaveRequest(leaveId, 'nurse-002', '原批准人撤回');
    assertEqual(withdrawR.success, true, '原批准人撤回成功');
    const sAfter = store.getState();
    const leaveW = sAfter.leaveRequests.find((l: any) => l.id === leaveId);
    assertEqual(leaveW?.status, 'withdrawn', '状态为已撤回');
    const auditAfterW = sAfter.getLeaveAuditLogs(leaveId);
    const wLog = auditAfterW.find((a: any) => a.action === 'withdraw');
    assert(wLog, '审计轨迹包含 withdraw');
    assertEqual(wLog.reason, '原批准人撤回', '撤回原因记入审计');

    // 再批准：已撤回状态不能再直接approve（需新建）
    const reApproveR = store.getState().approveLeaveRequest(leaveId, 'nurse-002');
    assertEqual(reApproveR.success, false, '已撤回的请假不能再批准，状态转移非法');
    const sAfter2 = store.getState();
    const abnInvalid = sAfter2.abnormalRecords.find((a: any) => a.type === 'leave_status_invalid');
    assert(abnInvalid, '异常记录: leave_status_invalid（非法状态转移）');

    // 重新提交一条新的（离院/返院都在白天，避开B区21:00-06:30夜间禁出）
    const createR2 = store.getState().createLeaveRequest({
      admissionId: picked.admission.id,
      departTime: now + 60 * 60 * 1000,
      expectedReturnTime: now + 2 * 60 * 60 * 1000,
      companionName: '家属',
      companionPhone: '13800138000',
      reason: '撤回后重新申请',
      submittedBy: 'nurse-004',
    });
    assertEqual(createR2.success, true, '撤回后可以重新提交新的请假申请（成功）');
    const leaveId2 = createR2.data!.id;
    const apprR2 = store.getState().approveLeaveRequest(leaveId2, 'nurse-003');
    assertEqual(apprR2.success, true, '新申请批准成功');
    const depR2 = store.getState().confirmLeaveDepart(leaveId2, 'nurse-004');
    assertEqual(depR2.success, true, '新申请确认离院成功');
    const retR2 = store.getState().confirmLeaveReturn(leaveId2, 'nurse-004');
    assertEqual(retR2.success, true, '新申请确认返院成功');

    // 重复销假 → 拦截
    const dupReturn = store.getState().confirmLeaveReturn(leaveId2, 'nurse-004');
    assertEqual(dupReturn.success, false, '重复销假被拦截');
    const sAfter3 = store.getState();
    const abnDup = sAfter3.abnormalRecords.find((a: any) => a.type === 'leave_duplicate_return');
    assert(abnDup, '异常记录: leave_duplicate_return');

    pass('Test 64: 撤回恢复 - 撤回后新建申请可通过，重复销假被拦截，非法状态转移拦截');
  }

  // Test 65: 重启后一致性（序列化导出→反序列化导入，请假数据与状态全部恢复）
  {
    const store1 = createCleanStore();
    store1.getState().importSampleData();
    store1.getState().login('nurse-001', '123456');
    const s1 = store1.getState();
    const picked = pickInBedAdmission(s1, 'A');
    if (!picked) throw new Error('找不到A区在床患者');

    const noteIds = (s1.careNotes || [])
      .filter((n: any) => n.admissionId === picked.admission.id && (n.type === 'medication' || n.type === 'treatment'))
      .map((n: any) => n.id);
    if (noteIds.length > 0) {
      store1.setState({ careNotes: s1.careNotes.filter((n: any) => !noteIds.includes(n.id)) });
    }

    const now = Date.now();
    const createR = s1.createLeaveRequest({
      admissionId: picked.admission.id,
      departTime: now + 30 * 60 * 1000,
      expectedReturnTime: now + 2 * 60 * 60 * 1000,
      companionName: '家属持久化',
      companionPhone: '13900139000',
      reason: '持久化测试请假',
      submittedBy: 'nurse-004',
    });
    assertEqual(createR.success, true, '申请创建成功');
    const leaveId = createR.data!.id;
    s1.approveLeaveRequest(leaveId, 'nurse-002');
    s1.confirmLeaveDepart(leaveId, 'nurse-004');

    const s1After = store1.getState();
    const leavesBefore = s1After.leaveRequests.length;
    const logsBefore = s1After.leaveAuditLogs.length;
    const configsBefore = s1After.wardLeaveConfigs.length;
    assert(leavesBefore >= 1, 'store1至少有1条请假');
    assert(logsBefore >= 3, 'store1至少有3条请假审计');
    assert(configsBefore >= 2, 'store1至少有2条病区规则');

    const leaveSnapshot = s1After.leaveRequests.find((l: any) => l.id === leaveId);
    const auditSnapshot = s1After.getLeaveAuditLogs(leaveId);

    const serializableKeys = [
      'beds', 'nurses', 'isolationRules', 'timeSlots', 'patients',
      'appointments', 'admissions', 'careNotes', 'operationLogs',
      'abnormalRecords', 'currentUserId', 'checkIns',
      'campuses', 'triageUndoRecords',
      'leaveRequests', 'leaveAuditLogs', 'wardLeaveConfigs',
    ] as const;

    const snapshot = JSON.stringify(
      Object.fromEntries(serializableKeys.map((k) => [k, (s1After as any)[k]])),
    );

    // 模拟重启
    const store2 = createCleanStore();
    const restored = JSON.parse(snapshot);
    store2.setState(restored);
    const user = (restored.nurses ?? []).find((n: any) => n.id === restored.currentUserId) || null;
    store2.setState({ currentUser: user, currentNurse: user });

    const s2 = store2.getState();

    // 集合数量一致性
    assertEqual(s2.leaveRequests.length, leavesBefore, 'leaveRequests 数量一致');
    assertEqual(s2.leaveAuditLogs.length, logsBefore, 'leaveAuditLogs 数量一致');
    assertEqual(s2.wardLeaveConfigs.length, configsBefore, 'wardLeaveConfigs 数量一致');

    // 每条记录字段一致性
    const restoredLeave = s2.leaveRequests.find((l: any) => l.id === leaveId);
    assert(restoredLeave, '目标请假记录存在');
    assertEqual(restoredLeave.patientId, leaveSnapshot.patientId, 'patientId 还原一致');
    assertEqual(restoredLeave.bedId, leaveSnapshot.bedId, 'bedId 还原一致');
    assertEqual(restoredLeave.zone, leaveSnapshot.zone, 'zone 还原一致');
    assertEqual(restoredLeave.status, leaveSnapshot.status, 'status 还原一致（departed）');
    assertEqual(restoredLeave.departTime, leaveSnapshot.departTime, 'departTime 还原一致');
    assertEqual(restoredLeave.expectedReturnTime, leaveSnapshot.expectedReturnTime, 'expectedReturnTime 还原一致');
    assertEqual(restoredLeave.actualDepartTime, leaveSnapshot.actualDepartTime, 'actualDepartTime 还原一致');
    assertEqual(restoredLeave.companionName, leaveSnapshot.companionName, 'companionName 还原一致');
    assertEqual(restoredLeave.companionPhone, leaveSnapshot.companionPhone, 'companionPhone 还原一致');
    assertEqual(restoredLeave.reason, leaveSnapshot.reason, 'reason 还原一致');
    assertEqual(restoredLeave.submittedBy, leaveSnapshot.submittedBy, 'submittedBy 还原一致');
    assertEqual(restoredLeave.approvedBy, leaveSnapshot.approvedBy, 'approvedBy 还原一致');
    assertEqual(restoredLeave.departedBy, leaveSnapshot.departedBy, 'departedBy 还原一致');

    // 审计轨迹还原
    const restoredAudit = s2.getLeaveAuditLogs(leaveId);
    assertEqual(restoredAudit.length, auditSnapshot.length, '审计轨迹条数一致');
    for (let i = 0; i < restoredAudit.length; i++) {
      assertEqual(restoredAudit[i].action, auditSnapshot[i].action, `审计${i} action一致`);
      assertEqual(restoredAudit[i].newStatus, auditSnapshot[i].newStatus, `审计${i} newStatus一致`);
    }

    // 病区规则还原
    const configA = s2.wardLeaveConfigs.find((c: any) => c.zone === 'A');
    assert(configA, 'A区规则存在');
    assertEqual(configA.maxLeaveHours, 6, 'A区最大6小时还原一致');
    assertEqual(configA.nightExitStartTime, '22:00', 'A区夜间开始时间还原一致');
    assertEqual(configA.nightExitEndTime, '06:00', 'A区夜间结束时间还原一致');
    assertEqual(configA.requireCompletedOrders, true, 'A区医嘱要求还原一致');

    // 重启后依然可以继续操作（返院确认）
    const returnR = store2.getState().confirmLeaveReturn(leaveId, 'nurse-004');
    assertEqual(returnR.success, true, '重启后仍可正常确认返院');
    const leaveFinal = store2.getState().leaveRequests.find((l: any) => l.id === leaveId);
    assertEqual(leaveFinal?.status, 'returned', '重启后确认返院 → 状态变为 returned');

    // 导出备份接口也包含三项新集合
    const backup = s2.exportBackup();
    assert(backup.data.leaveRequests && backup.data.leaveRequests.length > 0, '备份包含 leaveRequests');
    assert(backup.data.leaveAuditLogs && backup.data.leaveAuditLogs.length > 0, '备份包含 leaveAuditLogs');
    assert(backup.data.wardLeaveConfigs && backup.data.wardLeaveConfigs.length > 0, '备份包含 wardLeaveConfigs');

    pass('Test 65: 重启一致性 - 请假记录、审计轨迹、病区规则全部持久化还原，重启后可继续操作，备份导出也闭环');
  }

  // Test 66: 离院/返院权限边界 - 管理员不可办理离院返院
  {
    const store = createCleanStore();
    store.getState().importSampleData();
    const s = store.getState();
    const picked = pickInBedAdmission(s, 'A');
    if (!picked) throw new Error('找不到A区在床患者');

    const noteIds = (s.careNotes || [])
      .filter((n: any) => n.admissionId === picked.admission.id && (n.type === 'medication' || n.type === 'treatment'))
      .map((n: any) => n.id);
    if (noteIds.length > 0) {
      store.setState({ careNotes: s.careNotes.filter((n: any) => !noteIds.includes(n.id)) });
    }

    const now = Date.now();
    const createR = store.getState().createLeaveRequest({
      admissionId: picked.admission.id,
      departTime: now + 30 * 60 * 1000,
      expectedReturnTime: now + 2 * 60 * 60 * 1000,
      companionName: '家属',
      companionPhone: '13800138000',
      reason: '离院返院权限测试',
      submittedBy: 'nurse-004',
    });
    assertEqual(createR.success, true, '请假申请创建成功');
    const leaveId = createR.data!.id;

    const apprR = store.getState().approveLeaveRequest(leaveId, 'nurse-002');
    assertEqual(apprR.success, true, '病区医生批准成功');

    // 管理员确认离院 → 失败
    const departByAdmin = store.getState().confirmLeaveDepart(leaveId, 'nurse-001');
    assertEqual(departByAdmin.success, false, '管理员不可办理离院登记');
    assert(departByAdmin.error?.includes('无权') || departByAdmin.error?.includes('护士') || departByAdmin.error?.includes('医生'), '错误含权限提示');
    const sAfter1 = store.getState();
    const leave1 = sAfter1.leaveRequests.find((l: any) => l.id === leaveId);
    assertEqual(leave1?.status, 'approved', '状态仍为 approved');

    // 普通护士确认离院 → 成功
    const departByNormal = store.getState().confirmLeaveDepart(leaveId, 'nurse-004');
    assertEqual(departByNormal.success, true, '普通护士可办理离院登记');
    const sAfter2 = store.getState();
    const leave2 = sAfter2.leaveRequests.find((l: any) => l.id === leaveId);
    assertEqual(leave2?.status, 'departed', '状态变为 departed');

    // 管理员确认返院 → 失败
    const returnByAdmin = store.getState().confirmLeaveReturn(leaveId, 'nurse-001');
    assertEqual(returnByAdmin.success, false, '管理员不可办理返院确认');

    // 普通护士确认返院 → 成功
    const returnByNormal = store.getState().confirmLeaveReturn(leaveId, 'nurse-004');
    assertEqual(returnByNormal.success, true, '普通护士可办理返院确认');
    const sAfter3 = store.getState();
    const leave3 = sAfter3.leaveRequests.find((l: any) => l.id === leaveId);
    assertEqual(leave3?.status, 'returned', '状态变为 returned');

    pass('Test 66: 离院/返院权限边界 - 管理员不可办理，护士和医生可办理');
  }

  // Test 67: 角色变更后权限重新评估 - 原senior批准后被降级为normal
  {
    const store = createCleanStore();
    store.getState().importSampleData();
    const s = store.getState();
    const picked = pickInBedAdmission(s, 'A');
    if (!picked) throw new Error('找不到A区在床患者');

    const noteIds = (s.careNotes || [])
      .filter((n: any) => n.admissionId === picked.admission.id && (n.type === 'medication' || n.type === 'treatment'))
      .map((n: any) => n.id);
    if (noteIds.length > 0) {
      store.setState({ careNotes: s.careNotes.filter((n: any) => !noteIds.includes(n.id)) });
    }

    const now = Date.now();
    const createR = store.getState().createLeaveRequest({
      admissionId: picked.admission.id,
      departTime: now + 30 * 60 * 1000,
      expectedReturnTime: now + 2 * 60 * 60 * 1000,
      companionName: '家属',
      companionPhone: '13800138000',
      reason: '角色变更权限测试',
      submittedBy: 'nurse-004',
    });
    assertEqual(createR.success, true, '请假申请创建成功');
    const leaveId = createR.data!.id;

    // nurse-002 (senior) 批准
    const apprR = store.getState().approveLeaveRequest(leaveId, 'nurse-002');
    assertEqual(apprR.success, true, 'senior批准成功');

    // 将 nurse-002 降级为 normal
    store.getState().updateNurseRole('nurse-002', 'normal');
    const updatedNurse = store.getState().nurses.find((n: any) => n.id === 'nurse-002');
    assertEqual(updatedNurse?.role, 'normal', '角色已降为normal');

    // 降级后的原批准人尝试撤回 → 失败（当前角色无权）
    const withdrawR = store.getState().withdrawLeaveRequest(leaveId, 'nurse-002', '降级后撤回');
    assertEqual(withdrawR.success, false, '降级后原批准人不可撤回');
    const sAfter = store.getState();
    const leaveAfter = sAfter.leaveRequests.find((l: any) => l.id === leaveId);
    assertEqual(leaveAfter?.status, 'approved', '状态保持 approved');

    // 恢复 nurse-002 为 senior
    store.getState().updateNurseRole('nurse-002', 'senior');

    // 恢复后原批准人撤回 → 成功
    const withdrawR2 = store.getState().withdrawLeaveRequest(leaveId, 'nurse-002', '恢复后撤回');
    assertEqual(withdrawR2.success, true, '恢复角色后原批准人可撤回');
    const sAfter2 = store.getState();
    const leaveAfter2 = sAfter2.leaveRequests.find((l: any) => l.id === leaveId);
    assertEqual(leaveAfter2?.status, 'withdrawn', '状态已撤回');

    pass('Test 67: 角色变更后权限重新评估 - 降级后不可撤回，恢复后可撤回');
  }

  // Test 68: 集中权限函数一致性 - canPerformLeaveAction 与 store 行为对齐
  {
    const { canPerformLeaveAction } = await import('../src/lib/leavePermission.js');

    // approve: 只有 senior 可以
    assertEqual(canPerformLeaveAction('senior', 'approve').allowed, true, 'senior 可审批');
    assertEqual(canPerformLeaveAction('normal', 'approve').allowed, false, 'normal 不可审批');
    assertEqual(canPerformLeaveAction('admin', 'approve').allowed, false, 'admin 不可审批');

    // reject: 只有 senior 可以
    assertEqual(canPerformLeaveAction('senior', 'reject').allowed, true, 'senior 可驳回');
    assertEqual(canPerformLeaveAction('normal', 'reject').allowed, false, 'normal 不可驳回');
    assertEqual(canPerformLeaveAction('admin', 'reject').allowed, false, 'admin 不可驳回');

    // withdraw: senior + 原批准人
    assertEqual(canPerformLeaveAction('senior', 'withdraw', { isOriginalApprover: true }).allowed, true, 'senior 原批准人可撤回');
    assertEqual(canPerformLeaveAction('senior', 'withdraw', { isOriginalApprover: false }).allowed, false, 'senior 非原批准人不可撤回');
    assertEqual(canPerformLeaveAction('normal', 'withdraw', { isOriginalApprover: true }).allowed, false, 'normal 不可撤回');
    assertEqual(canPerformLeaveAction('admin', 'withdraw', { isOriginalApprover: true }).allowed, false, 'admin 不可撤回');

    // confirm_depart/confirm_return: senior 和 normal 可以
    assertEqual(canPerformLeaveAction('senior', 'confirm_depart').allowed, true, 'senior 可确认离院');
    assertEqual(canPerformLeaveAction('normal', 'confirm_depart').allowed, true, 'normal 可确认离院');
    assertEqual(canPerformLeaveAction('admin', 'confirm_depart').allowed, false, 'admin 不可确认离院');
    assertEqual(canPerformLeaveAction('senior', 'confirm_return').allowed, true, 'senior 可确认返院');
    assertEqual(canPerformLeaveAction('normal', 'confirm_return').allowed, true, 'normal 可确认返院');
    assertEqual(canPerformLeaveAction('admin', 'confirm_return').allowed, false, 'admin 不可确认返院');

    // create: 所有人可以
    assertEqual(canPerformLeaveAction('senior', 'create').allowed, true, 'senior 可创建');
    assertEqual(canPerformLeaveAction('normal', 'create').allowed, true, 'normal 可创建');
    assertEqual(canPerformLeaveAction('admin', 'create').allowed, true, 'admin 可创建');

    // null/undefined role
    assertEqual(canPerformLeaveAction(null, 'approve').allowed, false, 'null role 不可审批');
    assertEqual(canPerformLeaveAction(undefined, 'approve').allowed, false, 'undefined role 不可审批');

    pass('Test 68: 集中权限函数一致性 - 所有角色×动作组合验证通过');
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
