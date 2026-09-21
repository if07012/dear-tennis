# PRD — Responsive Admin UI

## 1. Overview

### Objective

Improve the Admin interface so that all pages are fully responsive across **desktop, tablet, and mobile devices**.

The main focus is:

- Make existing admin tables responsive.
- Convert tables to card/list layouts on smaller screens when appropriate.
- Prevent horizontal scrolling where it can be avoided.
- Make modal/pop-up dialogs usable on mobile devices.
- Maintain the existing desktop UI and functionality.

---

## 2. Problem

The current Admin UI is primarily designed for desktop screens.

On smaller screens:

- Tables may overflow horizontally.
- Table columns become difficult to read.
- Action buttons may be too small or crowded.
- Long text can break the layout.
- Modal dialogs may exceed the screen height or width.
- Forms inside modals can become difficult to use.
- Multiple action buttons may not fit on mobile.
- Important information may require excessive horizontal scrolling.

---

## 3. Goals

### Primary Goals

1. All Admin pages must be usable on mobile.
2. Existing functionality must remain unchanged.
3. Tables should adapt based on screen size and content.
4. Tables that cannot be effectively compressed should transform into card/list layouts.
5. Modals should fit within the mobile viewport.
6. Forms inside modals should be easy to complete using touch input.
7. Actions should remain clearly accessible on all screen sizes.

### Non-Goals

- Redesign the entire Admin UI.
- Change business logic.
- Change API behavior.
- Change database structure.
- Remove existing functionality.
- Change desktop layouts unless required for responsive behavior.

---

# 4. Responsive Strategy

The responsive behavior should follow these general rules:

| Screen | Behavior |
|---|---|
| Desktop ≥ 1024px | Keep table-based layout where currently used |
| Tablet 768–1023px | Optimize table columns and actions |
| Mobile < 768px | Use responsive table or card/list layout |
| Small Mobile < 480px | Prioritize essential information and actions |

The exact breakpoint can follow the existing project's design system if one already exists.

---

# 5. Admin Tables

## 5.1 Responsive Table

Tables should remain tables on smaller screens when they contain a manageable number of important columns.

Examples:

- ID
- Name
- Status
- Date
- One or two actions

### Requirements

- Reduce unnecessary column spacing.
- Allow text wrapping for long content.
- Keep important columns visible.
- Move secondary information into expandable content if necessary.
- Keep action buttons accessible.
- Avoid fixed widths that cause unnecessary overflow.
- Use horizontal scrolling only when the table cannot reasonably be converted.

---

## 5.2 Card/List Layout

Tables should be converted into cards on mobile when they contain too many columns or complex information.

Example desktop:

```text
| Name | Email | Role | Status | Created | Actions |
```

Mobile:

```text
┌──────────────────────────────┐
│ John Doe                     │
│ john@example.com             │
│                              │
│ Role       Admin             │
│ Status     Active            │
│ Created    Sep 20, 2026      │
│                              │
│ [View] [Edit] [More]         │
└──────────────────────────────┘
```

### Card Requirements

Each card should:

- Show the primary identifier at the top.
- Show important metadata below it.
- Clearly display status.
- Keep primary actions visible.
- Move secondary actions into a menu when necessary.
- Support long text without breaking the layout.
- Maintain consistent spacing between cards.

---

# 6. Table Column Priority

Each table should define column priority.

### Priority 1 — Essential

Always visible on mobile.

Examples:

- Name
- Title
- Status
- Main identifier

### Priority 2 — Important

Visible when screen width allows.

Examples:

- Date
- Category
- Role
- Type

### Priority 3 — Secondary

Can be moved into:

- Card details
- Expandable section
- More menu
- Detail page

Examples:

- Created By
- Updated By
- Internal ID
- Additional metadata

---

# 7. Table Actions

Desktop actions may look like:

```text
[View] [Edit] [Delete]
```

On mobile, actions should avoid consuming excessive horizontal space.

Preferred approach:

```text
[View] [Edit] [•••]
```

The `•••` menu can contain secondary actions such as:

- Delete
- Duplicate
- Archive
- Reset
- Other administrative actions

Destructive actions such as Delete should remain clearly identifiable and require the existing confirmation flow.

---

# 8. Search, Filter, and Toolbar

Admin tables commonly contain:

- Search
- Filters
- Sort
- Add button
- Export button
- Other actions

These controls must also be responsive.

### Desktop

```text
[Search................] [Status ▼] [Date ▼] [Add User]
```

### Mobile

```text
[Search................]

[Filter] [Sort] [Add]
```

Filters can open a dedicated mobile filter panel or modal.

Toolbar requirements:

- Controls must not overlap.
- Buttons should remain touch-friendly.
- Search should use the available width.
- Secondary controls can move into a menu.
- Filter state should remain visible to the user.

---

# 9. Pagination

Pagination must work on mobile.

Desktop:

```text
< Previous   1  2  3  4  5   Next >
```

Mobile can use:

```text
< Previous     2 / 10     Next >
```

or another compact pagination pattern supported by the existing design system.

Requirements:

- Current page must be clear.
- Previous/Next buttons must be easy to tap.
- Page size controls should remain usable.
- Pagination must not cause horizontal overflow.

---

# 10. Modal / Popup Responsiveness

All Admin modals must be reviewed and adjusted for mobile.

## Desktop

```text
┌──────────────────────────────────────┐
│ Edit User                         X  │
├──────────────────────────────────────┤
│                                      │
│ Name                                 │
│ [John Doe.........................]  │
│                                      │
│ Email                                │
│ [john@example.com.................]  │
│                                      │
│              [Cancel] [Save]         │
└──────────────────────────────────────┘
```

## Mobile

```text
┌─────────────────────────────┐
│ Edit User                X  │
├─────────────────────────────┤
│                             │
│ Name                        │
│ [John Doe.................] │
│                             │
│ Email                       │
│ [john@example.com.........] │
│                             │
│ [Cancel]       [Save]       │
└─────────────────────────────┘
```

### Mobile Modal Requirements

- Modal width should fit the viewport.
- Maintain safe spacing from screen edges.
- Modal content must be scrollable.
- Header should remain accessible.
- Close button must be easy to tap.
- Footer actions must remain accessible.
- Long forms must not exceed the viewport.
- Keyboard interaction must not hide important fields or buttons.
- Avoid nested scrolling where possible.

---

# 11. Full-Screen Modal

For complex forms, mobile should use a near/full-screen modal.

Use this approach when a modal contains:

- More than 5–6 form fields.
- Multiple sections.
- Long descriptions.
- File uploads.
- Complex configuration.
- Large data previews.

Example:

```text
┌─────────────────────────────┐
│ ← Edit Activity             │
├─────────────────────────────┤
│                             │
│ Activity Name               │
│ [.........................] │
│                             │
│ Description                 │
│ [.........................] │
│ [.........................] │
│                             │
│ Payment                     │
│ [.........................] │
│                             │
├─────────────────────────────┤
│ [Cancel]          [Save]    │
└─────────────────────────────┘
```

---

# 12. Form Responsiveness

Forms inside Admin pages and modals must adapt to screen size.

### Desktop

Two-column layout can be used:

```text
Name              Email
[........]        [........]

Role              Status
[........]        [........]
```

### Mobile

Fields should become one column:

```text
Name
[................]

Email
[................]

Role
[................]

Status
[................]
```

Requirements:

- Inputs should use available width.
- Labels should remain visible.
- Avoid very small input controls.
- Select/dropdown controls must be touch-friendly.
- Error messages must not break the layout.
- Required-field indicators must remain visible.

---

# 13. Confirmation Dialogs

Confirmation dialogs such as Delete should also be responsive.

Desktop:

```text
Delete User?

Are you sure you want to delete this user?

[Cancel] [Delete]
```

Mobile:

```text
┌───────────────────────────┐
│ Delete User?              │
│                           │
│ Are you sure you want     │
│ to delete this user?      │
│                           │
│ [Cancel]       [Delete]   │
└───────────────────────────┘
```

Requirements:

- Text must wrap naturally.
- Buttons must remain visible.
- Destructive action must remain clearly distinguishable.
- Dialog must not exceed the viewport.

---

# 14. Empty, Loading, and Error States

Responsive behavior must also be applied to:

### Empty State

```text
No users found.

[Add User]
```

### Loading State

Skeletons should match the responsive layout:

- Table skeleton on desktop.
- Card skeleton on mobile if the table becomes cards.

### Error State

Error messages must:

- Wrap correctly.
- Not overflow horizontally.
- Provide accessible actions.

---

# 15. Admin Pages to Review

Audit **all Admin pages containing tables or modal dialogs**, including but not limited to:

- User Management
- Member Management
- Activity Management
- Registration Management
- Payment Management
- Coupon Management
- Category Management
- Content Management
- Reports
- Logs
- Settings
- Any other Admin page containing a table/list
- Any modal or popup used by Admin pages

The implementation should not assume that only currently identified tables require changes. A reusable responsive approach should be applied consistently across the Admin area.

---

# 16. Reusable Components

Where possible, create or improve reusable components instead of implementing responsive behavior independently on every page.

Potential components:

```text
ResponsiveTable
ResponsiveCardList
AdminTableToolbar
ResponsiveModal
MobileActionMenu
ResponsiveForm
ResponsivePagination
FilterPanel
```

The exact component names should follow the existing project's conventions.

Benefits:

- Consistent behavior.
- Less duplicated code.
- Easier future maintenance.
- New Admin pages automatically inherit responsive behavior.

---

# 17. Accessibility

Responsive changes must maintain accessibility.

Requirements:

- Buttons must have accessible labels.
- Modal focus behavior must remain functional.
- Keyboard navigation must continue working on desktop.
- Touch targets should be sufficiently large.
- Color should not be the only indicator of status.
- Form errors must be associated with their inputs.
- Modal close buttons must be accessible.

---

# 20. Definition of Done

The responsive Admin UI is considered complete when:

1. All Admin tables have an intentional responsive layout.
2. Complex tables use card/list layouts on mobile where appropriate.
3. All Admin modals are mobile-friendly.
4. Complex forms are usable on small screens.
5. No critical Admin functionality is inaccessible on mobile.
6. Responsive behavior is consistent across the Admin application.
7. QA has verified desktop, tablet, and mobile layouts.
8. No major regression is introduced to the existing desktop UI.
