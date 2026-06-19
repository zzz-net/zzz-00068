import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store';
import { useToastStore } from '@/store/toast';
import StatusBadge from '@/components/StatusBadge';
import { LogIn, UserPlus, Lock, User, Shield, Database } from 'lucide-react';
import { cn } from '@/lib/utils';

type LoginTab = 'nurse' | 'admin';

export default function Login() {
  const navigate = useNavigate();
  const { nurses, login, importSampleData } = useAppStore();
  const { showToast } = useToastStore();

  const [tab, setTab] = useState<LoginTab>('nurse');
  const [selectedNurseId, setSelectedNurseId] = useState<string | null>(null);
  const [nursePassword, setNursePassword] = useState('123456');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const getInitial = (name: string) => name?.charAt?.(0) ?? '?';

  const handleNurseLogin = () => {
    if (!selectedNurseId) {
      showToast('请先选择护士', 'warning');
      return;
    }
    if (!nursePassword) {
      showToast('请输入密码', 'warning');
      return;
    }
    setLoading(true);
    const success = login(selectedNurseId, nursePassword);
    setLoading(false);
    if (success) {
      showToast('登录成功，正在跳转...', 'success');
      setTimeout(() => navigate('/dashboard'), 500);
    } else {
      showToast('密码错误，请重试', 'error');
    }
  };

  const handleAdminLogin = () => {
    if (!adminUsername || !adminPassword) {
      showToast('请输入用户名和密码', 'warning');
      return;
    }
    const admin = nurses.find(
      (n) => n.role === 'admin' && (n.name === adminUsername || n.id === adminUsername)
    );
    if (!admin) {
      showToast('管理员不存在', 'error');
      return;
    }
    setLoading(true);
    const success = login(admin.id, adminPassword);
    setLoading(false);
    if (success) {
      showToast('管理员登录成功', 'success');
      setTimeout(() => navigate('/dashboard'), 500);
    } else {
      showToast('密码错误', 'error');
    }
  };

  const handleImportSample = () => {
    importSampleData();
    showToast('样例数据导入成功！现在可以选择护士登录了', 'success');
    setSelectedNurseId(null);
  };

  const sortedNurses = [...nurses].sort((a, b) => {
    const roleOrder = { admin: 0, senior: 1, normal: 2 };
    return roleOrder[a.role] - roleOrder[b.role];
  });

  const avatarColors = [
    'from-blue-400 to-blue-600',
    'from-emerald-400 to-emerald-600',
    'from-purple-400 to-purple-600',
    'from-pink-400 to-pink-600',
    'from-amber-400 to-amber-600',
    'from-cyan-400 to-cyan-600',
    'from-rose-400 to-rose-600',
    'from-indigo-400 to-indigo-600',
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-8 py-10 text-center text-white">
            <div className="text-6xl mb-4">🏥</div>
            <h1 className="text-3xl font-bold mb-2">日间病房周转板</h1>
            <p className="text-blue-100 text-sm">
              智能床位管理 · 高效周转调度 · 全流程可追溯
            </p>
          </div>

          <div className="px-8 py-8">
            <div className="flex gap-2 mb-8 bg-gray-100 p-1 rounded-xl">
              <button
                onClick={() => setTab('nurse')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-all',
                  tab === 'nurse'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                )}
              >
                <User className="w-4 h-4" />
                护士登录
              </button>
              <button
                onClick={() => setTab('admin')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-all',
                  tab === 'admin'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                )}
              >
                <Shield className="w-4 h-4" />
                管理员登录
              </button>
            </div>

            {tab === 'nurse' ? (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    选择护士
                  </label>
                  {sortedNurses.length === 0 ? (
                    <div className="bg-gray-50 rounded-xl p-8 text-center text-gray-500">
                      <UserPlus className="w-10 h-10 mx-auto mb-3 opacity-50" />
                      <p>暂无护士数据</p>
                      <p className="text-sm mt-1">请点击底部按钮导入样例数据</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {sortedNurses.map((nurse, idx) => (
                        <button
                          key={nurse.id}
                          onClick={() => setSelectedNurseId(nurse.id)}
                          className={cn(
                            'p-4 rounded-xl border-2 transition-all text-left',
                            selectedNurseId === nurse.id
                              ? 'border-blue-500 bg-blue-50 shadow-md scale-[1.02]'
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                'w-10 h-10 rounded-full bg-gradient-to-br flex items-center justify-center text-white font-bold text-sm flex-shrink-0',
                                avatarColors[idx % avatarColors.length]
                              )}
                            >
                              {getInitial(nurse.name)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-800 truncate">
                                {nurse.name}
                              </div>
                              <StatusBadge type="role" status={nurse.role} className="mt-1" />
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    登录密码
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="password"
                      value={nursePassword}
                      onChange={(e) => setNursePassword(e.target.value)}
                      placeholder="请输入密码（默认123456）"
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      onKeyDown={(e) => e.key === 'Enter' && handleNurseLogin()}
                    />
                  </div>
                </div>

                <button
                  onClick={handleNurseLogin}
                  disabled={loading || !selectedNurseId}
                  className={cn(
                    'w-full py-3.5 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2 shadow-lg',
                    loading || !selectedNurseId
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl'
                  )}
                >
                  <LogIn className="w-5 h-5" />
                  {loading ? '登录中...' : '登 录'}
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    管理员用户名
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={adminUsername}
                      onChange={(e) => setAdminUsername(e.target.value)}
                      placeholder="请输入管理员姓名或ID"
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    管理员密码
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="password"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="请输入密码"
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()}
                    />
                  </div>
                </div>

                <button
                  onClick={handleAdminLogin}
                  disabled={loading}
                  className={cn(
                    'w-full py-3.5 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2 shadow-lg',
                    loading
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 hover:shadow-xl'
                  )}
                >
                  <Shield className="w-5 h-5" />
                  {loading ? '登录中...' : '管理员登录'}
                </button>
              </div>
            )}

            <div className="mt-8 pt-6 border-t border-gray-100">
              <div className="flex items-center justify-center gap-3 text-sm">
                <span className="text-gray-500">首次使用？</span>
                <button
                  onClick={handleImportSample}
                  className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-lg font-medium hover:from-emerald-600 hover:to-teal-600 transition-all shadow-sm"
                >
                  <Database className="w-4 h-4" />
                  导入样例数据
                </button>
              </div>
              <p className="text-center text-xs text-gray-400 mt-3">
                导入后可使用默认密码 123456 登录任意账号
              </p>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          © 2024 日间病房智能周转管理系统
        </p>
      </div>
    </div>
  );
}
