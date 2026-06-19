import type { ReactNode } from 'react';
import type { NurseRole } from '@/types';
import { useAppStore } from '@/store';

interface RoleGateProps {
  allowed: NurseRole[];
  children: ReactNode;
  fallback?: ReactNode;
}

export function RoleGate({
  allowed,
  children,
  fallback = <div className="p-8 text-center text-slate-400">权限不足</div>,
}: RoleGateProps) {
  const currentUser = useAppStore((s) => s.currentUser);

  if (!currentUser) return fallback;
  if (!allowed.includes(currentUser.role)) return fallback;

  return <>{children}</>;
}

export default RoleGate;
