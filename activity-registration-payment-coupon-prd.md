# PRD Change: Activity Registration, Payment & Coupon Flow

## 1. Overview

Update the existing Activity Join flow to introduce a **payment verification step** and allow users to **claim coupons when joining an activity**.

### Current Flow

```text
User Login
    ↓
Click Activity
    ↓
Click Join
    ↓
Admin Approves
    ↓
Member Joined Activity
```

### New Flow

```text
User Login
    ↓
Click Activity
    ↓
Click Join Activity
    ↓
(Optional) Claim Coupon
    ↓
Admin Approves Registration
    ↓
Status = Waiting Payment
    ↓
Activity Slot is Reserved
    ↓
User Uploads Payment Proof
    ↓
Admin Reviews Payment
    ↓
Admin Approves Payment
    ↓
Member Joined Activity
```

If the admin rejects the payment:

```text
Payment Rejected
    ↓
Registration returns to Waiting Payment
    ↓
User can upload new payment proof
```

---

## 2. Goals

The new flow should:

1. Add payment verification before a member officially joins an activity.
2. Reserve/reduce the activity slot while the user is waiting for payment verification.
3. Prevent the reserved slot from being taken by another user.
4. Allow users to upload payment proof.
5. Allow admins to approve or reject payment proof.
6. Only mark the user as a joined member after payment approval.
7. Allow users to claim an eligible coupon when joining an activity.
8. Apply the coupon to the activity payment when applicable.
9. Clearly communicate registration and payment status to the user.

---

## 3. Registration Status

Introduce explicit registration statuses.

| Status | Description |
|---|---|
| `Pending Approval` | User has requested to join and is waiting for admin approval |
| `Waiting Payment` | Admin approved registration; user needs to make payment |
| `Payment Submitted` | User has uploaded payment proof and is waiting for admin verification |
| `Payment Rejected` | Admin rejected the payment proof |
| `Joined` | Payment has been approved and user officially joined |
| `Rejected` | Admin rejected the user's activity registration |
| `Cancelled` | User cancelled the registration, if cancellation is supported |
| `Expired` | Payment deadline expired and the reserved slot was released |

### Status Flow

```text
Pending Approval
       │
       ├── Admin Reject ──→ Rejected
       │
       ↓
Waiting Payment
       │
       ├── User Upload Payment Proof
       ↓
Payment Submitted
       │
       ├── Admin Reject ──→ Waiting Payment
       │
       └── Admin Approve
              ↓
           Joined
```

---

## 4. Activity Slot Management

Activity capacity must account for users who are waiting for payment.

### Important Rule

Once an admin approves a registration and changes the status to `Waiting Payment`, the user's slot becomes **reserved**.

The slot remains reserved while:

- Status = `Waiting Payment`
- Status = `Payment Submitted`

The slot must not be available to another user during these states.

### Example

Activity capacity:

```text
Total Slots: 20
```

Current state:

```text
Joined: 15
Waiting Payment: 3
Payment Submitted: 1
Available: 1
```

Therefore:

```text
Available Slots = 20 - 15 - 3 - 1
                = 1
```

### Slot Release

The reserved slot must be released when:

- Admin rejects the registration.
- Payment deadline expires.
- User cancels the registration, if cancellation is supported.

If payment is rejected, the recommended behavior is to return the registration to `Waiting Payment`, keeping the slot reserved so the user can upload a corrected payment proof.

---

## 5. Join Activity

When the user clicks **Join Activity**:

### Step 1 — Validate Activity

System checks:

- User is logged in.
- Activity is still open for registration.
- Activity has an available slot.
- User has not already joined.
- User does not already have an active registration for the activity.

### Step 2 — Coupon Selection

The user can optionally claim an eligible coupon.

Example:

```text
Activity Price
Rp100,000

Available Coupons
☐ Rp20,000 OFF
☐ 10% OFF

[Don't use coupon]

Final Price
Rp80,000
```

The user should be able to continue without claiming a coupon.

### Step 3 — Create Registration

Create the registration with:

```text
status = Pending Approval
coupon = selected coupon, if any
```

The registration then waits for admin approval.

---

## 6. Coupon Claiming

Users can claim an eligible coupon during the Join Activity process.

### Coupon Eligibility

The system should validate:

- Coupon is active.
- Coupon has not expired.
- Coupon is available to the user.
- Coupon usage limit has not been reached.
- Coupon is applicable to the selected activity.
- Minimum transaction amount is satisfied, if configured.
- User has not already used the coupon where usage is restricted.

### Coupon Reservation

A coupon should not be permanently consumed merely because the user selects it.

Recommended behavior:

```text
User selects coupon
        ↓
Coupon reserved for registration
        ↓
Admin approves registration
        ↓
Payment process
        ↓
Payment approved
        ↓
Coupon marked as USED
```

If registration/payment is rejected, cancelled, or expired:

```text
Coupon reservation released
        ↓
Coupon becomes available again
```

---

## 7. Admin Registration Approval

Admin sees registrations that are waiting for approval.

Example:

```text
Activity: Badminton Friday

User: John Doe
Coupon: Rp20,000 OFF
Original Price: Rp100,000
Final Price: Rp80,000

Status: Pending Approval

[Approve] [Reject]
```

### Admin Approves

System changes:

```text
Pending Approval
        ↓
Waiting Payment
```

The activity slot is immediately reserved.

The user receives notification:

> Your activity registration has been approved. Please complete your payment and upload the payment proof.

---

## 8. Waiting Payment

When registration status becomes `Waiting Payment`, display a payment page.

Example:

```text
Registration Approved

Activity
Badminton Friday

Original Price
Rp100,000

Coupon
Rp20,000 OFF

Amount to Pay
Rp80,000

Payment Account
Bank BCA
123456789
Activity Organizer

[Upload Payment Proof]
```

The activity slot remains reserved.

---

## 9. Upload Payment Proof

User can upload payment proof from the Waiting Payment page.

Supported formats should be configurable, for example:

- JPG
- JPEG
- PNG
- PDF

The user should also see the maximum file size.

After upload:

```text
Waiting Payment
        ↓
Payment Submitted
```

Display:

```text
Payment proof submitted.

Your payment is being reviewed by the administrator.
```

The user should not be able to submit multiple payment proofs simultaneously unless the admin rejects the previous submission.

---

## 10. Admin Payment Verification

Admin can access registrations with:

```text
Payment Submitted
```

Admin review screen:

```text
Activity: Badminton Friday

User: John Doe

Original Price: Rp100,000
Coupon: Rp20,000 OFF
Final Amount: Rp80,000

Payment Proof:
[View Image/PDF]

[Approve Payment]
[Reject Payment]
```

---

## 11. Payment Approval

When admin approves the payment:

```text
Payment Submitted
        ↓
Joined
```

The system should:

1. Mark payment as approved.
2. Mark registration as `Joined`.
3. Mark the coupon as `Used`, if a coupon was claimed.
4. Keep the activity slot occupied as a joined member.
5. Create/update the activity membership record.
6. Record payment verification information.
7. Notify the user.

User sees:

```text
Payment Approved ✓

Congratulations!
You have successfully joined Badminton Friday.

Registration Status
Joined
```

---

## 12. Payment Rejection

When admin rejects the payment:

```text
Payment Submitted
        ↓
Waiting Payment
```

Admin should provide a rejection reason.

Example:

```text
Payment Rejected

Reason:
The payment amount does not match the required amount.

[Upload New Payment Proof]
```

### Slot Behavior

The reserved slot remains reserved after payment rejection because the user can correct the payment and upload a new proof.

If the payment deadline expires:

```text
Waiting Payment
        ↓
Expired
        ↓
Slot Released
```

---

## 13. Payment Deadline

Add an optional payment deadline configuration to activities.

Example:

```text
Payment must be completed within:
24 hours after registration approval
```

or:

```text
Payment Deadline:
September 15, 2026 23:59
```

If the deadline expires while the registration is:

- `Waiting Payment`
- `Payment Rejected`

the system should automatically:

1. Change status to `Expired`.
2. Release the reserved activity slot.
3. Release the claimed coupon.
4. Notify the user.

---

## 14. User Activity Detail

The Activity Detail page should display registration status.

### Before Joining

```text
Activity
Badminton Friday

Available Slots: 5

[Join Activity]
```

### Waiting for Admin

```text
Registration Status

Pending Approval

Your registration is waiting for administrator approval.
```

### Waiting Payment

```text
Registration Status

Waiting Payment

Your registration has been approved.

Amount to Pay:
Rp80,000

Payment Deadline:
24 hours

[Upload Payment Proof]
```

### Payment Submitted

```text
Registration Status

Payment Submitted

Your payment proof is being reviewed.
```

### Joined

```text
Registration Status

Joined ✓

Your payment has been approved.
You are officially registered for this activity.
```

---

## 15. Activity Capacity UI

Activity capacity should reflect reserved slots.

Instead of only showing:

```text
15 / 20 joined
```

show:

```text
15 / 20 slots occupied
```

or:

```text
5 slots remaining
```

The calculation must include:

```text
Joined
+
Waiting Payment
+
Payment Submitted
```

Example:

```text
20 Total Slots

15 Joined
2 Waiting Payment
1 Payment Submitted

2 Slots Remaining
```

---

## 16. Admin Activity Dashboard

Admin should be able to see registration counts by status.

Example:

```text
Activity: Badminton Friday

Total Capacity: 20

Joined             15
Pending Approval    2
Waiting Payment     1
Payment Submitted   1
Available           1
```

Admin should be able to filter registrations by:

- Pending Approval
- Waiting Payment
- Payment Submitted
- Joined
- Rejected
- Expired
- Cancelled

---

## 17. Payment Data

Recommended payment fields:

```text
Payment
- id
- registrationId
- originalAmount
- discountAmount
- finalAmount
- paymentProofUrl
- status
- submittedAt
- reviewedAt
- reviewedBy
- rejectionReason
```

Payment status:

```text
Pending
Submitted
Approved
Rejected
Expired
```

---

## 18. Registration Data

Recommended fields:

```text
ActivityRegistration
- id
- activityId
- userId
- status
- couponId
- couponDiscount
- originalAmount
- finalAmount
- createdAt
- approvedAt
- joinedAt
- expiredAt
```

---

## 19. Coupon Data

Recommended coupon state:

```text
Available
Reserved
Used
Expired
Released
```

Relationship:

```text
User
  ↓
Activity Registration
  ↓
Coupon
  ↓
Payment
```

---

## 20. Business Rules

### Rule 1 — Slot Reservation

A slot is considered occupied when registration status is:

```text
Waiting Payment
Payment Submitted
Joined
```

### Rule 2 — Pending Approval

`Pending Approval` should not consume the final activity slot.

This prevents abandoned or pending registrations from blocking activity capacity before admin approval.

### Rule 3 — Payment Approval

A user becomes an official member only after:

```text
Payment status = Approved
```

### Rule 4 — Coupon

A coupon is only permanently consumed when:

```text
Registration = Joined
AND
Payment = Approved
```

### Rule 5 — Duplicate Registration

A user cannot create another active registration for the same activity while they have one of:

```text
Pending Approval
Waiting Payment
Payment Submitted
Joined
```

### Rule 6 — Full Activity

If:

```text
Joined + Waiting Payment + Payment Submitted >= Capacity
```

the activity should be considered full.

---

## 21. Notifications

Notify users when:

### Registration Submitted

> Your request to join the activity has been submitted and is waiting for approval.

### Registration Approved

> Your registration has been approved. Please complete your payment.

### Payment Proof Submitted

> Your payment proof has been submitted and is waiting for verification.

### Payment Approved

> Your payment has been approved. You have successfully joined the activity.

### Payment Rejected

> Your payment could not be verified. Please review the reason and upload a new payment proof.

### Payment Expired

> Your payment deadline has expired and your activity slot has been released.

---

## 22. Acceptance Criteria

### Join Activity

- User can click `Join Activity`.
- System validates activity availability.
- User can select an eligible coupon.
- Registration is created with `Pending Approval`.
- Duplicate active registrations are prevented.

### Admin Approval

- Admin can approve/reject registrations.
- Approving changes status to `Waiting Payment`.
- The activity slot becomes reserved.
- User can see the payment information.

### Payment

- User can upload payment proof.
- Upload changes status to `Payment Submitted`.
- Admin can view payment proof.
- Admin can approve or reject payment.
- Approved payment changes registration to `Joined`.
- Rejected payment returns registration to `Waiting Payment` and requires a rejection reason.

### Activity Capacity

- `Joined`, `Waiting Payment`, and `Payment Submitted` registrations consume slots.
- Rejected/cancelled/expired registrations release their slots.
- Users cannot join when all slots are occupied.

### Coupon

- User can claim an eligible coupon during registration.
- Coupon discount is reflected in the final payment amount.
- Coupon is reserved during the payment process.
- Coupon becomes `Used` only after successful payment approval.
- Coupon is released when the registration expires/cancels.

---

## 23. End-to-End Example

Activity:

```text
Badminton Friday
Capacity: 20
Price: Rp100,000
```

User clicks:

```text
Join Activity
```

User claims:

```text
Rp20,000 coupon
```

System calculates:

```text
Original Price = Rp100,000
Coupon         = -Rp20,000
Final Price    = Rp80,000
```

Registration:

```text
Pending Approval
```

Admin approves:

```text
Waiting Payment
```

Activity capacity:

```text
Joined: 15
Waiting Payment: 1
Available: 4
```

User uploads payment proof:

```text
Payment Submitted
```

Activity capacity remains:

```text
Joined: 15
Payment Submitted: 1
Available: 4
```

Admin approves payment:

```text
Joined
```

Coupon:

```text
Reserved → Used
```

Final activity state:

```text
Joined: 16
Available: 4
```

The user is now officially a member of the activity.

---

## 24. Updated Overall Flow

```text
                    ┌──────────────────┐
                    │    User Login    │
                    └────────┬─────────┘
                             ↓
                    ┌──────────────────┐
                    │  Select Activity │
                    └────────┬─────────┘
                             ↓
                    ┌──────────────────┐
                    │  Join Activity   │
                    └────────┬─────────┘
                             ↓
                    ┌──────────────────┐
                    │  Claim Coupon?   │
                    └────────┬─────────┘
                             ↓
                    ┌──────────────────┐
                    │ Pending Approval │
                    └────────┬─────────┘
                             ↓
                       Admin Review
                       /                               Reject         Approve
                      ↓               ↓
                  Rejected      Waiting Payment
                                      │
                                      │ Slot Reserved
                                      ↓
                              Upload Payment Proof
                                      ↓
                              Payment Submitted
                                      ↓
                               Admin Review
                              /                                      Reject          Approve
                            ↓                ↓
                     Waiting Payment       Joined
                            │                │
                            │                ↓
                            │         Coupon = Used
                            │
                            └── Upload Again
```

## 25. Priority

### P0 — Required

- New registration statuses
- Admin registration approval
- Waiting Payment state
- Payment proof upload
- Admin payment approval/rejection
- Activity slot reservation
- Slot release
- Final `Joined` state
- Coupon selection during join

### P1 — Recommended

- Payment deadline
- Automatic expiration
- Payment rejection reason
- Coupon reservation/release
- Notifications
- Admin registration dashboard/filter

### P2 — Optional

- Payment reminders
- Automatic payment verification
- Multiple payment methods
- Payment history
- Coupon usage analytics
