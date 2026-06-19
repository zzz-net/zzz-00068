import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store';
import { useToastStore } from '@/store/toast';
import RoleGate from '@/components/RoleGate';
import StatusBadge from '@/components/StatusBadge';
import type { BedType, NurseRole, BedStatus } from '@/types';
import {
  LayoutGrid,
  ClipboardList,
  Settings,
  History,
  LogOut,
  User,
  Plus,
  Pencil,
  Trash2,
  ShieldAlert,
  Clock,
  Users,
  Database,
  Download,
  Upload,
  RotateCcw,
  AlertTriangle,
  Check,
  X,
  Save,
  ChevronDown,
  KeyRound,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type ConfigTab = 'beds' | 'isolation' | 'timeslots' | 'nurses' | 'data';

export default function Config() {
  return (
    <RoleGate allowed={['admin']}>
      <ConfigContent />
    </RoleGate>
  );
}

function ConfigContent() {
  const navigate = useNavigate();
  const { currentUser, logout } = useAppStore();
  const [tab, setTab] = useState<ConfigTab>('beds');

  const roleLabel: Record<NurseRole, string> = {
    admin: '管理员',
    senior: '高级护士',
    normal: '普通护士',
  };

  const getInitial = (name: string) => name?.charAt?.(0) ?? '?';

  const tabs: { id: ConfigTab; label: string; icon: typeof LayoutGrid }[] = [
    { id: 'beds', label: '床位管理', icon: LayoutGrid },
    { id: 'isolation', label: '隔离规则', icon: ShieldAlert },
    { id: 'timeslots', label: '时段配置', icon: Clock },
    { id: 'nurses', label: '护士角色', icon: Users },
    { id: 'data', label: '数据管理', icon: Database },
  ];

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
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-100 font-medium text-sm transition-colors"
              >
                <ClipboardList className="w-4 h-4" />
                预约管理
              </button>
              <button
                onClick={() => navigate('/history')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-100 font-medium text-sm transition-colors"
              >
                <History className="w-4 h-4" />
                历史记录
              </button>
              <button
                onClick={() => navigate('/config')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-50 text-blue-600 font-medium text-sm"
              >
                <Settings className="w-4 h-4" />
                系统配置
              </button>
            </nav>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-bold">
                  {getInitial(currentUser?.name ?? '')}
                </div>
                <div className="hidden sm:block">
                  <div className="text-xs font-medium text-gray-800">{currentUser?.name}</div>
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
        <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit overflow-x-auto">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all',
                  tab === t.id
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                )}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === 'beds' && <BedsTab />}
        {tab === 'isolation' && <IsolationTab />}
        {tab === 'timeslots' && <TimeSlotsTab />}
        {tab === 'nurses' && <NursesTab />}
        {tab === 'data' && <DataTab />}
      </main>
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-800">{title}</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function ModalFooter({
  onCancel,
  onSave,
}: {
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div className="flex items-center justify-end gap-3 mt-6 pt-5 border-t border-gray-100">
      <button
        onClick={onCancel}
        className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-lg font-medium text-sm hover:bg-gray-50 transition-colors"
      >
        <X className="w-4 h-4" />
        取消
      </button>
      <button
        onClick={onSave}
        className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-medium text-sm shadow-sm hover:from-blue-700 hover:to-indigo-700 transition-all"
      >
        <Save className="w-4 h-4" />
        保存
      </button>
    </div>
  );
}

function BedsTab() {
  const { beds, addBed, updateBed, deleteBed } = useAppStore();
  const { showToast } = useToastStore();

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [bedNumber, setBedNumber] = useState('');
  const [zone, setZone] = useState('A');
  const [type, setType] = useState<BedType>('normal');
  const [status, setStatus] = useState<BedStatus>('idle');
  const [notes, setNotes] = useState('');

  const openAdd = () => {
    setEditingId(null);
    setBedNumber('');
    setZone('A');
    setType('normal');
    setStatus('idle');
    setNotes('');
    setShowModal(true);
  };

  const openEdit = (bed: (typeof beds)[number]) => {
    setEditingId(bed.id);
    setBedNumber(bed.bedNumber);
    setZone(bed.zone);
    setType(bed.type);
    setStatus(bed.status);
    setNotes(bed.notes ?? '');
    setShowModal(true);
  };

  const handleSave = () => {
    if (!bedNumber.trim()) {
      showToast('请输入床位编号', 'warning');
      return;
    }
    if (editingId) {
      updateBed(editingId, { bedNumber, zone, type, status, notes: notes || undefined });
      showToast('床位更新成功', 'success');
    } else {
      addBed({ bedNumber, zone, type, status, notes: notes || undefined });
      showToast('床位新增成功', 'success');
    }
    setShowModal(false);
  };

  const handleDelete = (id: string) => {
    deleteBed(id);
    showToast('床位已删除', 'success');
    setDeleteConfirmId(null);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between p-5 border-b border-gray-100">
        <div>
          <h2 className="text-lg font-bold text-gray-800">床位管理</h2>
          <p className="text-sm text-gray-500">配置日间病房的床位信息</p>
        </div>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-medium text-sm hover:from-blue-700 hover:to-indigo-700 transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" />
          新增床位
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">床位编号</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">区域</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">类型</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">状态</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">备注</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {beds.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-gray-400">
                  暂无床位数据，请点击右上角新增
                </td>
              </tr>
            ) : (
              beds.map((bed) => (
                <tr key={bed.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-4">
                    <span className="font-semibold text-gray-800">{bed.bedNumber}</span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium">
                      {bed.zone}区
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge type="bedType" status={bed.type} />
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge type="bed" status={bed.status} />
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-500 max-w-xs truncate">
                    {bed.notes ?? '-'}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(bed)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        编辑
                      </button>
                      {deleteConfirmId === bed.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(bed.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 transition-colors"
                          >
                            确认删除
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="inline-flex items-center px-2.5 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors"
                          >
                            取消
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmId(bed.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          删除
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal title={editingId ? '编辑床位' : '新增床位'} onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  床位编号 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={bedNumber}
                  onChange={(e) => setBedNumber(e.target.value)}
                  placeholder="如 A-1"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">区域</label>
                <div className="relative">
                  <select
                    value={zone}
                    onChange={(e) => setZone(e.target.value)}
                    className="w-full appearance-none pl-3 pr-9 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 bg-white"
                  >
                    <option value="A">A区</option>
                    <option value="B">B区</option>
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">床位类型</label>
                <div className="relative">
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as BedType)}
                    className="w-full appearance-none pl-3 pr-9 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 bg-white"
                  >
                    <option value="normal">普通</option>
                    <option value="negative">负压</option>
                    <option value="wheelchair">轮椅位</option>
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">初始状态</label>
                <div className="relative">
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as BedStatus)}
                    className="w-full appearance-none pl-3 pr-9 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 bg-white"
                  >
                    <option value="idle">空闲</option>
                    <option value="occupied">占用</option>
                    <option value="isolated">隔离</option>
                    <option value="cleaning">待清理</option>
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">备注</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="备注信息（可选）"
                rows={2}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 resize-none"
              />
            </div>
          </div>
          <ModalFooter onCancel={() => setShowModal(false)} onSave={handleSave} />
        </Modal>
      )}
    </div>
  );
}

function IsolationTab() {
  const { isolationRules, addIsolationRule, updateIsolationRule, deleteIsolationRule } = useAppStore();
  const { showToast } = useToastStore();

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [disease, setDisease] = useState('');
  const [requiredBedType, setRequiredBedType] = useState<BedType>('negative');
  const [minDurationHours, setMinDurationHours] = useState('0');
  const [crossZoneForbidden, setCrossZoneForbidden] = useState(true);

  const openAdd = () => {
    setEditingId(null);
    setDisease('');
    setRequiredBedType('negative');
    setMinDurationHours('0');
    setCrossZoneForbidden(true);
    setShowModal(true);
  };

  const openEdit = (rule: (typeof isolationRules)[number]) => {
    setEditingId(rule.id);
    setDisease(rule.disease);
    setRequiredBedType(rule.requiredBedType);
    setMinDurationHours(String(rule.minDurationHours));
    setCrossZoneForbidden(rule.crossZoneForbidden);
    setShowModal(true);
  };

  const handleSave = () => {
    if (!disease.trim()) {
      showToast('请输入疾病名称', 'warning');
      return;
    }
    const hours = Number(minDurationHours) || 0;
    if (editingId) {
      updateIsolationRule(editingId, { disease, requiredBedType, minDurationHours: hours, crossZoneForbidden });
      showToast('隔离规则更新成功', 'success');
    } else {
      addIsolationRule({ disease, requiredBedType, minDurationHours: hours, crossZoneForbidden });
      showToast('隔离规则新增成功', 'success');
    }
    setShowModal(false);
  };

  const handleDelete = (id: string) => {
    deleteIsolationRule(id);
    showToast('隔离规则已删除', 'success');
    setDeleteConfirmId(null);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between p-5 border-b border-gray-100">
        <div>
          <h2 className="text-lg font-bold text-gray-800">隔离规则</h2>
          <p className="text-sm text-gray-500">配置传染病对应的床位隔离要求</p>
        </div>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-medium text-sm hover:from-blue-700 hover:to-indigo-700 transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" />
          新增规则
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">疾病名称</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">所需床位类型</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">最小时长(小时)</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">跨区禁止</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isolationRules.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-gray-400">暂无隔离规则</td>
              </tr>
            ) : (
              isolationRules.map((rule) => (
                <tr key={rule.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-amber-500" />
                      <span className="font-medium text-gray-800">{rule.disease}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge type="bedType" status={rule.requiredBedType} />
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-700">{rule.minDurationHours}h</td>
                  <td className="px-5 py-4">
                    {rule.crossZoneForbidden ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-red-50 text-red-600 text-xs font-medium">
                        <X className="w-3 h-3" />禁止
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-green-50 text-green-600 text-xs font-medium">
                        <Check className="w-3 h-3" />允许
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openEdit(rule)} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100 transition-colors">
                        <Pencil className="w-3.5 h-3.5" />编辑
                      </button>
                      {deleteConfirmId === rule.id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleDelete(rule.id)} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 transition-colors">确认删除</button>
                          <button onClick={() => setDeleteConfirmId(null)} className="inline-flex items-center px-2.5 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors">取消</button>
                        </div>
                      ) : (
                        <button onClick={() => setDeleteConfirmId(rule.id)} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />删除
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal title={editingId ? '编辑隔离规则' : '新增隔离规则'} onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">疾病名称 <span className="text-red-500">*</span></label>
              <input type="text" value={disease} onChange={(e) => setDisease(e.target.value)} placeholder="如：新型冠状病毒感染" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">所需床位类型</label>
                <div className="relative">
                  <select value={requiredBedType} onChange={(e) => setRequiredBedType(e.target.value as BedType)} className="w-full appearance-none pl-3 pr-9 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 bg-white">
                    <option value="normal">普通</option>
                    <option value="negative">负压</option>
                    <option value="wheelchair">轮椅位</option>
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">最小时长(小时)</label>
                <input type="number" value={minDurationHours} onChange={(e) => setMinDurationHours(e.target.value)} min={0} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400" />
              </div>
            </div>
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div className={cn('relative w-11 h-6 rounded-full transition-colors', crossZoneForbidden ? 'bg-blue-600' : 'bg-gray-200')} onClick={() => setCrossZoneForbidden(!crossZoneForbidden)}>
                <div className={cn('absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform', crossZoneForbidden ? 'translate-x-5' : 'translate-x-0.5')} />
              </div>
              <div>
                <span className="text-sm font-medium text-gray-700">禁止跨区调动</span>
                <p className="text-xs text-gray-500">开启后此类患者不允许跨区分配床位</p>
              </div>
            </label>
          </div>
          <ModalFooter onCancel={() => setShowModal(false)} onSave={handleSave} />
        </Modal>
      )}
    </div>
  );
}

function TimeSlotsTab() {
  const { timeSlots, addTimeSlot, updateTimeSlot, deleteTimeSlot } = useAppStore();
  const { showToast } = useToastStore();
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('12:00');
  const [defaultDurationMin, setDefaultDurationMin] = useState('240');
  const [active, setActive] = useState(true);

  const openAdd = () => {
    setEditingId(null);
    setLabel('');
    setStartTime('08:00');
    setEndTime('12:00');
    setDefaultDurationMin('240');
    setActive(true);
    setShowModal(true);
  };

  const openEdit = (slot: (typeof timeSlots)[number]) => {
    setEditingId(slot.id);
    setLabel(slot.label);
    setStartTime(slot.startTime);
    setEndTime(slot.endTime);
    setDefaultDurationMin(String(slot.defaultDurationMin));
    setActive(slot.active);
    setShowModal(true);
  };

  const handleSave = () => {
    if (!label.trim()) {
      showToast('请输入时段名称', 'warning');
      return;
    }
    const duration = Number(defaultDurationMin) || 0;
    if (editingId) {
      updateTimeSlot(editingId, { label, startTime, endTime, defaultDurationMin: duration, active });
      showToast('时段更新成功', 'success');
    } else {
      addTimeSlot({ label, startTime, endTime, defaultDurationMin: duration, active });
      showToast('时段新增成功', 'success');
    }
    setShowModal(false);
  };

  const handleDelete = (id: string) => {
    deleteTimeSlot(id);
    showToast('时段已删除', 'success');
    setDeleteConfirmId(null);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between p-5 border-b border-gray-100">
        <div>
          <h2 className="text-lg font-bold text-gray-800">时段配置</h2>
          <p className="text-sm text-gray-500">配置日间病房的预约时段</p>
        </div>
        <button onClick={openAdd} className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-medium text-sm hover:from-blue-700 hover:to-indigo-700 transition-all shadow-sm">
          <Plus className="w-4 h-4" />新增时段
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">时段名称</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">开始时间</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">结束时间</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">默认时长(分钟)</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">启用状态</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {timeSlots.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-12 text-center text-gray-400">暂无时段配置</td></tr>
            ) : (
              timeSlots.map((slot) => (
                <tr key={slot.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-500" />
                      <span className="font-medium text-gray-800">{slot.label}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-700">{slot.startTime}</td>
                  <td className="px-5 py-4 text-sm text-gray-700">{slot.endTime}</td>
                  <td className="px-5 py-4 text-sm text-gray-700">{slot.defaultDurationMin}分钟</td>
                  <td className="px-5 py-4">
                    {slot.active ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-green-50 text-green-600 text-xs font-medium"><Check className="w-3 h-3" />启用</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-500 text-xs font-medium"><X className="w-3 h-3" />停用</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openEdit(slot)} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100 transition-colors">
                        <Pencil className="w-3.5 h-3.5" />编辑
                      </button>
                      {deleteConfirmId === slot.id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleDelete(slot.id)} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 transition-colors">确认删除</button>
                          <button onClick={() => setDeleteConfirmId(null)} className="inline-flex items-center px-2.5 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors">取消</button>
                        </div>
                      ) : (
                        <button onClick={() => setDeleteConfirmId(slot.id)} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />删除
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal title={editingId ? '编辑时段' : '新增时段'} onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">时段名称 <span className="text-red-500">*</span></label>
              <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="如：上午" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">开始时间</label>
                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">结束时间</label>
                <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">默认时长(分)</label>
                <input type="number" value={defaultDurationMin} onChange={(e) => setDefaultDurationMin(e.target.value)} min={0} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400" />
              </div>
            </div>
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div className={cn('relative w-11 h-6 rounded-full transition-colors', active ? 'bg-blue-600' : 'bg-gray-200')} onClick={() => setActive(!active)}>
                <div className={cn('absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform', active ? 'translate-x-5' : 'translate-x-0.5')} />
              </div>
              <div>
                <span className="text-sm font-medium text-gray-700">启用此时段</span>
                <p className="text-xs text-gray-500">停用后该时段不会出现在预约选项中</p>
              </div>
            </label>
          </div>
          <ModalFooter onCancel={() => setShowModal(false)} onSave={handleSave} />
        </Modal>
      )}
    </div>
  );
}

function NursesTab() {
  const { nurses, addNurse, updateNurseRole, updateNurse, deleteNurse } = useAppStore();
  const { showToast } = useToastStore();
  const [showModal, setShowModal] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [role, setRole] = useState<NurseRole>('normal');
  const [password, setPassword] = useState('123456');

  const openAdd = () => {
    setName('');
    setRole('normal');
    setPassword('123456');
    setShowModal(true);
  };

  const handleSave = () => {
    if (!name.trim()) {
      showToast('请输入护士姓名', 'warning');
      return;
    }
    if (!password.trim()) {
      showToast('请输入初始密码', 'warning');
      return;
    }
    addNurse({ name, role, password });
    showToast('护士新增成功', 'success');
    setShowModal(false);
  };

  const handleRoleChange = (id: string, newRole: NurseRole) => {
    updateNurseRole(id, newRole);
    showToast('角色已更新', 'success');
  };

  const handleResetPassword = (id: string, nurseName: string) => {
    updateNurse(id, { password: '123456' });
    showToast(`${nurseName} 的密码已重置为 123456`, 'success');
  };

  const handleDelete = (id: string) => {
    deleteNurse(id);
    showToast('护士已删除', 'success');
    setDeleteConfirmId(null);
  };

  const getInitial = (n: string) => n?.charAt?.(0) ?? '?';
  const avatarColors = [
    'from-blue-400 to-blue-600', 'from-emerald-400 to-emerald-600', 'from-purple-400 to-purple-600',
    'from-pink-400 to-pink-600', 'from-amber-400 to-amber-600',
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between p-5 border-b border-gray-100">
        <div>
          <h2 className="text-lg font-bold text-gray-800">护士角色</h2>
          <p className="text-sm text-gray-500">管理护士账号和权限角色</p>
        </div>
        <button onClick={openAdd} className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-medium text-sm hover:from-blue-700 hover:to-indigo-700 transition-all shadow-sm">
          <Plus className="w-4 h-4" />新增护士
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">护士信息</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">角色</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">创建时间</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {nurses.length === 0 ? (
              <tr><td colSpan={4} className="px-5 py-12 text-center text-gray-400">暂无护士数据</td></tr>
            ) : (
              nurses.map((nurse, idx) => (
                <tr key={nurse.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className={cn('w-9 h-9 rounded-full bg-gradient-to-br flex items-center justify-center text-white text-sm font-bold', avatarColors[idx % avatarColors.length])}>
                        {getInitial(nurse.name)}
                      </div>
                      <div>
                        <div className="font-medium text-gray-800">{nurse.name}</div>
                        <div className="text-xs text-gray-500 font-mono">ID: {nurse.id.slice(0, 12)}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <select
                      value={nurse.role}
                      onChange={(e) => handleRoleChange(nurse.id, e.target.value as NurseRole)}
                      className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
                    >
                      <option value="admin">管理员</option>
                      <option value="senior">高级护士</option>
                      <option value="normal">普通护士</option>
                    </select>
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-500">{new Date(nurse.createdAt).toLocaleDateString('zh-CN')}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => handleResetPassword(nurse.id, nurse.name)} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 text-amber-600 rounded-lg text-xs font-medium hover:bg-amber-100 transition-colors" title="重置密码为123456">
                        <KeyRound className="w-3.5 h-3.5" />重置密码
                      </button>
                      {deleteConfirmId === nurse.id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleDelete(nurse.id)} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 transition-colors">确认删除</button>
                          <button onClick={() => setDeleteConfirmId(null)} className="inline-flex items-center px-2.5 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors">取消</button>
                        </div>
                      ) : (
                        <button onClick={() => setDeleteConfirmId(nurse.id)} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />删除
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal title="新增护士" onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">姓名 <span className="text-red-500">*</span></label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="请输入护士姓名" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">角色</label>
                <div className="relative">
                  <select value={role} onChange={(e) => setRole(e.target.value as NurseRole)} className="w-full appearance-none pl-3 pr-9 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 bg-white">
                    <option value="admin">管理员</option>
                    <option value="senior">高级护士</option>
                    <option value="normal">普通护士</option>
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">初始密码 <span className="text-red-500">*</span></label>
                <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="默认123456" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400" />
              </div>
            </div>
          </div>
          <ModalFooter onCancel={() => setShowModal(false)} onSave={handleSave} />
        </Modal>
      )}
    </div>
  );
}

function DataTab() {
  const {
    importSampleData, resetAllData,
    beds, nurses, isolationRules, timeSlots, patients, appointments,
    admissions, careNotes, operationLogs, abnormalRecords,
  } = useAppStore();
  const { showToast } = useToastStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [confirmImport, setConfirmImport] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetStep, setResetStep] = useState(0);

  const totalCounts = {
    beds: beds.length, nurses: nurses.length, isolationRules: isolationRules.length,
    timeSlots: timeSlots.length, patients: patients.length, appointments: appointments.length,
    admissions: admissions.length, careNotes: careNotes.length,
    operationLogs: operationLogs.length, abnormalRecords: abnormalRecords.length,
  };

  const handleImportSample = () => {
    importSampleData();
    showToast('样例数据导入成功', 'success');
    setConfirmImport(false);
  };

  const handleExport = () => {
    const backupData = {
      version: 'v1', exportedAt: new Date().toISOString(),
      data: { beds, nurses, isolationRules, timeSlots, patients, appointments, admissions, careNotes, operationLogs, abnormalRecords },
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const today = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `backup-${today}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('备份导出成功', 'success');
  };

  const handleRestoreClick = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const content = ev.target?.result as string;
        const parsed = JSON.parse(content);
        if (!parsed.data) {
          showToast('备份文件格式无效', 'error');
          return;
        }
        const d = parsed.data;
        localStorage.setItem('dayward-board:v1', JSON.stringify({
          beds: d.beds ?? [], nurses: d.nurses ?? [], isolationRules: d.isolationRules ?? [],
          timeSlots: d.timeSlots ?? [], patients: d.patients ?? [], appointments: d.appointments ?? [],
          admissions: d.admissions ?? [], careNotes: d.careNotes ?? [],
          operationLogs: d.operationLogs ?? [], abnormalRecords: d.abnormalRecords ?? [],
          currentUserId: null,
        }));
        showToast('数据恢复成功，即将刷新页面', 'success');
        setTimeout(() => window.location.reload(), 1000);
      } catch {
        showToast('文件解析失败，请检查备份文件', 'error');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleReset = () => {
    if (resetStep === 0) {
      setResetStep(1);
      return;
    }
    resetAllData();
    showToast('所有数据已清空', 'success');
    setConfirmReset(false);
    setResetStep(0);
  };

  const dataItems = [
    { key: 'beds', label: '床位', value: totalCounts.beds, color: 'blue' },
    { key: 'nurses', label: '护士', value: totalCounts.nurses, color: 'purple' },
    { key: 'isolationRules', label: '隔离规则', value: totalCounts.isolationRules, color: 'amber' },
    { key: 'timeSlots', label: '时段配置', value: totalCounts.timeSlots, color: 'cyan' },
    { key: 'patients', label: '患者', value: totalCounts.patients, color: 'green' },
    { key: 'appointments', label: '预约', value: totalCounts.appointments, color: 'indigo' },
    { key: 'admissions', label: '入床记录', value: totalCounts.admissions, color: 'emerald' },
    { key: 'careNotes', label: '护理记录', value: totalCounts.careNotes, color: 'teal' },
    { key: 'operationLogs', label: '操作日志', value: totalCounts.operationLogs, color: 'gray' },
    { key: 'abnormalRecords', label: '异常记录', value: totalCounts.abnormalRecords, color: 'red' },
  ];

  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    purple: 'bg-purple-50 text-purple-700 border-purple-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    cyan: 'bg-cyan-50 text-cyan-700 border-cyan-100',
    green: 'bg-green-50 text-green-700 border-green-100',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    teal: 'bg-teal-50 text-teal-700 border-teal-100',
    gray: 'bg-gray-50 text-gray-700 border-gray-100',
    red: 'bg-red-50 text-red-700 border-red-100',
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Database className="w-5 h-5 text-blue-500" />当前数据统计
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {dataItems.map((item) => (
            <div key={item.key} className={cn('rounded-xl border p-3', colorClasses[item.color])}>
              <div className="text-xs opacity-75">{item.label}</div>
              <div className="text-2xl font-bold mt-1">{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center"><Database className="w-5 h-5 text-emerald-600" /></div>
            <div><h3 className="font-bold text-gray-800">导入样例数据</h3><p className="text-xs text-gray-500">快速填充演示数据</p></div>
          </div>
          {!confirmImport ? (
            <button onClick={() => setConfirmImport(true)} className="w-full py-2.5 bg-emerald-500 text-white rounded-lg font-medium text-sm hover:bg-emerald-600 transition-colors">导入样例数据</button>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
              <div className="flex items-start gap-2 text-amber-800">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div><p className="font-semibold text-sm">确认导入样例数据？</p><p className="text-xs mt-0.5">此操作将覆盖现有全部数据</p></div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setConfirmImport(false)} className="flex-1 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50">取消</button>
                <button onClick={handleImportSample} className="flex-1 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">确认导入</button>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center"><Download className="w-5 h-5 text-blue-600" /></div>
            <div><h3 className="font-bold text-gray-800">完整备份导出</h3><p className="text-xs text-gray-500">导出为 JSON 文件</p></div>
          </div>
          <button onClick={handleExport} className="w-full py-2.5 bg-blue-500 text-white rounded-lg font-medium text-sm hover:bg-blue-600 transition-colors flex items-center justify-center gap-2">
            <Download className="w-4 h-4" />导出备份 JSON
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center"><Upload className="w-5 h-5 text-purple-600" /></div>
            <div><h3 className="font-bold text-gray-800">恢复备份</h3><p className="text-xs text-gray-500">从 JSON 文件恢复</p></div>
          </div>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileChange} className="hidden" />
          <button onClick={handleRestoreClick} className="w-full py-2.5 bg-purple-500 text-white rounded-lg font-medium text-sm hover:bg-purple-600 transition-colors flex items-center justify-center gap-2">
            <Upload className="w-4 h-4" />选择备份文件
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center"><RotateCcw className="w-5 h-5 text-red-600" /></div>
            <div><h3 className="font-bold text-gray-800">清空全部数据</h3><p className="text-xs text-gray-500">不可恢复操作</p></div>
          </div>
          {!confirmReset ? (
            <button onClick={() => setConfirmReset(true)} className="w-full py-2.5 bg-red-500 text-white rounded-lg font-medium text-sm hover:bg-red-600 transition-colors flex items-center justify-center gap-2">
              <RotateCcw className="w-4 h-4" />清空全部数据
            </button>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
              <div className="flex items-start gap-2 text-red-800">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-sm">{resetStep === 0 ? '确认清空所有数据？' : '⚠️ 最后确认：真的清空？'}</p>
                  <p className="text-xs mt-0.5">所有床位、患者、预约、日志将全部删除</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setConfirmReset(false); setResetStep(0); }}
                  className="flex-1 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50"
                >
                  取消
                </button>
                <button onClick={handleReset} className={cn('flex-1 py-2 text-white rounded-lg text-sm font-medium transition-colors', resetStep === 0 ? 'bg-red-500 hover:bg-red-600' : 'bg-red-700 hover:bg-red-800')}>
                  {resetStep === 0 ? '确认清空' : '最终确认清空'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
