// ============================================
// INVITE TYPES
// ============================================
// Schema for the admin "Invite Members" page. Stores pending invitations in
// a single Google Sheet.
//
// Sheet schema (created on first save):
//   invites: id,email,name,message,status,invitedAt,createdBy,token
//
// `token` is a public random string used in the accept-invitation URL. It is
// separate from `id` so admins can rotate it without changing the row id.
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
  /** Public random token used in the accept-invitation URL. */
  token?: string;
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
  'token',
] as const;

export const INVITE_STATUSES: InviteStatus[] = [
  'pending',
  'sent',
  'accepted',
  'cancelled',
];