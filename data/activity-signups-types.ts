// ============================================
// ACTIVITY SIGNUPS TYPES
// ============================================
// A signup is a member's request to join an activity. Members create a
// request from the home page; an admin approves or rejects it from
// /admin/activity-signups.
//
// Sheet schema (created on first save):
//   activity_signups: id, activityId, userEmail, userName, status, message,
//                     requestedAt, decidedAt, decidedBy
//
// `status` is one of: 'pending' | 'approved' | 'rejected'.

export type SignupStatus = 'pending' | 'approved' | 'rejected';

export type ActivitySignup = {
  id: string;
  activityId: string;
  userEmail: string;
  userName: string;
  status: SignupStatus;
  message?: string;
  requestedAt: string;
  decidedAt?: string;
  decidedBy?: string;
};

export const SIGNUP_STATUSES: SignupStatus[] = ['pending', 'approved', 'rejected'];

export const SIGNUP_HEADERS = [
  'id',
  'activityId',
  'userEmail',
  'userName',
  'status',
  'message',
  'requestedAt',
  'decidedAt',
  'decidedBy',
] as const;

export function isSignupStatus(value: string): value is SignupStatus {
  return (SIGNUP_STATUSES as string[]).includes(value);
}
