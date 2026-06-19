import type { HTMLAttributes, ReactNode } from 'react';
import type { BedStatus, AppointmentStatus, AdmissionStatus, NurseRole, BedType, CheckInStatus } from '@/types';

export type StatusBadgeStatus =
  | BedStatus
  | AppointmentStatus
  | AdmissionStatus
  | NurseRole
  | BedType
  | CheckInStatus
  | 'pending_admit'
  | 'handled'
  | 'unhandled';

interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  status: StatusBadgeStatus;
  type?: 'bed' | 'appointment' | 'role' | 'bedType' | string;
  children?: ReactNode;
}

const statusConfig: Record<StatusBadgeStatus, { bg: string; text: string; label: string }> = {
  idle: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: '空闲' },
  occupied: { bg: 'bg-blue-100', text: 'text-blue-700', label: '占用' },
  isolated: { bg: 'bg-amber-100', text: 'text-amber-700', label: '隔离' },
  cleaning: { bg: 'bg-slate-100', text: 'text-slate-600', label: '清洁中' },

  pending: { bg: 'bg-indigo-100', text: 'text-indigo-700', label: '待入床' },
  checked_in: { bg: 'bg-cyan-100', text: 'text-cyan-700', label: '已签到' },
  admitted: { bg: 'bg-blue-100', text: 'text-blue-700', label: '已入床' },
  completed: { bg: 'bg-slate-100', text: 'text-slate-600', label: '已完成' },
  cancelled: { bg: 'bg-rose-100', text: 'text-rose-600', label: '已取消' },

  triaging: { bg: 'bg-amber-100', text: 'text-amber-700', label: '分诊中' },
  triage_confirmed: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: '已入床' },
  triage_rejected: { bg: 'bg-rose-100', text: 'text-rose-600', label: '已退回' },
  triage_undone: { bg: 'bg-orange-100', text: 'text-orange-700', label: '已撤销' },

  in_bed: { bg: 'bg-blue-100', text: 'text-blue-700', label: '在床' },
  discharged: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: '已出床' },
  force_released: { bg: 'bg-rose-100', text: 'text-rose-600', label: '强制释放' },

  pending_admit: { bg: 'bg-indigo-100', text: 'text-indigo-700', label: '待入床' },
  handled: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: '已处理' },
  unhandled: { bg: 'bg-rose-100', text: 'text-rose-600', label: '未处理' },

  admin: { bg: 'bg-rose-100', text: 'text-rose-700', label: '管理员' },
  senior: { bg: 'bg-amber-100', text: 'text-amber-700', label: '高级护士' },
  normal: { bg: 'bg-blue-100', text: 'text-blue-700', label: '普通护士' },

  negative: { bg: 'bg-violet-100', text: 'text-violet-700', label: '负压床' },
  wheelchair: { bg: 'bg-cyan-100', text: 'text-cyan-700', label: '轮椅位' },
};

export function StatusBadge({ status, type, children, className, ...rest }: StatusBadgeProps) {
  const cfg = statusConfig[status] ?? {
    bg: 'bg-slate-100',
    text: 'text-slate-600',
    label: String(status),
  };

  return (
    <span
      {...rest}
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text} ${className ?? ''}`}
    >
      {children ?? cfg.label}
    </span>
  );
}

export default StatusBadge;
