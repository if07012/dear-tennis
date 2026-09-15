// Self-check: ADMIN_APPROVAL_SECRET=test npx tsx lib/approval-token.selfcheck.ts
import { signApprovalToken, verifyApprovalToken, approvalLink } from './approval-token';

const t = signApprovalToken('abc-123', 'approve');
console.assert(t !== null, 'sign returns token');
const v = verifyApprovalToken(t ?? '');
console.assert(v !== null && v.signupId === 'abc-123' && v.kind === 'approve', 'roundtrip ok');
console.assert(verifyApprovalToken((t ?? '').replace(/.$/, 'X')) === null, 'tamper rejected');
console.assert(verifyApprovalToken('nope') === null, 'garbage rejected');
console.assert(verifyApprovalToken('a.b.c.d') === null, 'shape rejected');
console.assert((approvalLink('x', 'reject') ?? '').includes('/approval/'), 'link built');
console.log('approval-token self-check passed');
