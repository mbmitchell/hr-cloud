export const LEAVE_TYPES = ["PTO", "SICK", "COMP", "BEREAVEMENT"] as const;

export type LeaveType = (typeof LEAVE_TYPES)[number];

export function isLeaveType(value: string): value is LeaveType {
  return (LEAVE_TYPES as readonly string[]).includes(value);
}

export function isCompLeaveType(leaveType: string) {
  return leaveType === "COMP";
}

export function isPtoBucketLeaveType(leaveType: string) {
  return leaveType === "PTO" || leaveType === "SICK";
}

export function isWorkflowOnlyLeaveType(leaveType: string) {
  return leaveType === "BEREAVEMENT";
}

export function isBalanceTrackedLeaveType(leaveType: string) {
  return isPtoBucketLeaveType(leaveType) || isCompLeaveType(leaveType);
}

export function getLedgerBucketForLeaveType(leaveType: string): "PTO" | "COMP" {
  if (isCompLeaveType(leaveType)) {
    return "COMP";
  }

  if (isPtoBucketLeaveType(leaveType)) {
    return "PTO";
  }

  throw new Error(`Leave type ${leaveType} does not map to a PTO ledger bucket.`);
}
