// ============================================
// INVITE TYPES
// ============================================
// Schema for the admin "Invite Members" page. Stores pending invitations in
// a single Google Sheet.
//
// Sheet schema (created on first save):
//   invites: id,email,name,message,status,invitedAt,createdBy
//
// `status` is one of: 'pending' | 'sent' | 'accepted' | 'cancelled'.

export type InviteStatus = 'pending' | 'sent' | 'accepted' | 'cancelled';

export type Invite = {
  id: string;
  email: string;
  name?: string;
  message?: string;
  status: InviteStatus;
  invitedAt: string;
  createdBy: string; // admin email who created the invite
};

export type InviteContent = {
  items: Invite[];
};

export const INVITE_ITEM_HEADERS = [
  'id',
  'email',
  'name',
  'message',
  'status',
  'invitedAt',
  'createdBy',
] as const;

export const INVITE_STATUSES: InviteStatus[] = [
  'pending',
  'sent',
  'accepted',
  'cancelled',
];