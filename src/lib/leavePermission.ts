import type { NurseRole } from '../types';

export type LeaveAction =
  | 'create'
  | 'approve'
  | 'reject'
  | 'withdraw'
  | 'confirm_depart'
  | 'confirm_return';

export interface LeavePermissionResult {
  allowed: boolean;
  reason?: string;
}

export interface LeaveActionContext {
  isOriginalApprover?: boolean;
}

const APPROVAL_DENIED = '只有病区医生可以审批请假申请';
const REJECTION_DENIED = '只有病区医生可以驳回请假申请';
const WITHDRAW_DENIED_ROLE = '只有病区医生可以撤回请假批准';
const WITHDRAW_DENIED_NOT_APPROVER = '只有原批准医生可以撤回该请假申请';
const DEPART_DENIED = '只有护士和病区医生可以办理离院登记';
const RETURN_DENIED = '只有护士和病区医生可以办理返院确认';

export function canPerformLeaveAction(
  role: NurseRole | null | undefined,
  action: LeaveAction,
  context?: LeaveActionContext,
): LeavePermissionResult {
  if (!role) {
    return { allowed: false, reason: '未登录' };
  }

  switch (action) {
    case 'create':
      return { allowed: true };

    case 'approve':
      if (role !== 'senior') {
        return { allowed: false, reason: APPROVAL_DENIED };
      }
      return { allowed: true };

    case 'reject':
      if (role !== 'senior') {
        return { allowed: false, reason: REJECTION_DENIED };
      }
      return { allowed: true };

    case 'withdraw':
      if (role !== 'senior') {
        return { allowed: false, reason: WITHDRAW_DENIED_ROLE };
      }
      if (!context?.isOriginalApprover) {
        return { allowed: false, reason: WITHDRAW_DENIED_NOT_APPROVER };
      }
      return { allowed: true };

    case 'confirm_depart':
      if (role !== 'senior' && role !== 'normal') {
        return { allowed: false, reason: DEPART_DENIED };
      }
      return { allowed: true };

    case 'confirm_return':
      if (role !== 'senior' && role !== 'normal') {
        return { allowed: false, reason: RETURN_DENIED };
      }
      return { allowed: true };

    default:
      return { allowed: false, reason: '未知操作' };
  }
}

export function canApproveLeave(role: NurseRole | null | undefined): boolean {
  return canPerformLeaveAction(role, 'approve').allowed;
}

export function canRejectLeave(role: NurseRole | null | undefined): boolean {
  return canPerformLeaveAction(role, 'reject').allowed;
}

export function canWithdrawLeave(
  role: NurseRole | null | undefined,
  isOriginalApprover: boolean,
): boolean {
  return canPerformLeaveAction(role, 'withdraw', { isOriginalApprover }).allowed;
}

export function canConfirmDepart(role: NurseRole | null | undefined): boolean {
  return canPerformLeaveAction(role, 'confirm_depart').allowed;
}

export function canConfirmReturn(role: NurseRole | null | undefined): boolean {
  return canPerformLeaveAction(role, 'confirm_return').allowed;
}
