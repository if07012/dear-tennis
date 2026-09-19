# PRD – Tennis Player Level & Badge System

## 1. Overview

Menambahkan fitur **Badge & Player Level** pada komunitas tenis untuk membantu pemain mengetahui:

- Level mereka saat ini.
- Badge yang sudah diperoleh.
- Badge yang harus diperoleh untuk naik ke level berikutnya.
- Progress perkembangan kemampuan tenis.
- Achievement yang telah dicapai pemain.
- Admin dapat memberikan badge setelah pemain mengikuti coaching, evaluation, atau memenuhi achievement tertentu.

---

## 2. Player Level

Level merepresentasikan kemampuan tenis pemain secara keseluruhan.

Contoh struktur level:

| Order | Level | Required Skill Badges |
|---|---|---|
| 1 | Newbie | None |
| 2 | Lower Beginner | Basic Forehand, Basic Backhand |
| 3 | Beginner | Basic Serve, Basic Volley |
| 4 | Intermediate | TBD |
| 5 | Upper Intermediate | TBD |
| 6 | Advanced | TBD |

### Level Progression

**Newbie → Lower Beginner**
- Basic Forehand
- Basic Backhand

**Lower Beginner → Beginner**
- Basic Serve
- Basic Volley

Level berikutnya dapat ditambahkan dan dikonfigurasi oleh Admin.

> Player otomatis dianggap memenuhi syarat level apabila seluruh Skill Badge yang diperlukan untuk level tersebut sudah diperoleh.

---

## 3. Badge Types

Badge dibagi menjadi dua tipe utama:

### 3.1 Skill Badge

Skill Badge merepresentasikan kemampuan tenis tertentu dan digunakan sebagai requirement untuk Level.

Contoh:

| Badge | Type | Category |
|---|---|---|
| Basic Forehand | Skill | Groundstroke |
| Basic Backhand | Skill | Groundstroke |
| Basic Serve | Skill | Serve |
| Basic Volley | Skill | Net Play |

Skill Badge biasanya diberikan setelah pemain mengikuti coaching atau evaluation.

Flow:

```text
Player mengikuti Coaching
        ↓
Coach/Admin melakukan Evaluation
        ↓
Admin memberikan Skill Badge
        ↓
System melakukan Level Calculation
```

### 3.2 Achievement Badge

Achievement Badge merupakan penghargaan atas pencapaian pemain dan **tidak memengaruhi Level**.

Contoh:

| Badge | Type | Category |
|---|---|---|
| First Coaching | Achievement | Coaching |
| First Match | Achievement | Match |
| Community Player | Achievement | Community |
| Tournament Participant | Achievement | Tournament |
| Tournament Winner | Achievement | Tournament |
| 10 Matches Played | Achievement | Milestone |

Contoh:

```text
Player

Level:
Beginner

Skill Badges:
✓ Basic Forehand
✓ Basic Backhand
✓ Basic Serve
✓ Basic Volley

Achievement Badges:
🏆 First Match
🏆 Tournament Participant
🏆 10 Matches Played
```

Walaupun player memiliki banyak Achievement Badge, badge tersebut tidak menyebabkan perubahan Level.

---

## 4. Badge Configuration

Setiap badge memiliki:

- Badge Name
- Description
- Icon/Image
- Type: Skill / Achievement
- Category
- Earning Criteria
- Status: Active / Inactive

Contoh Skill Badge:

### Basic Forehand

**Type:** Skill  
**Category:** Groundstroke

**Description:**  
Pemain mampu melakukan teknik dasar forehand dengan gerakan dan posisi yang benar.

**Earning Criteria:**  
Player mengikuti Basic Forehand Coaching dan dinyatakan memenuhi standar oleh Coach/Admin.

Contoh Achievement Badge:

### First Match

**Type:** Achievement  
**Category:** Match

**Description:**  
Pemain telah menyelesaikan pertandingan tenis pertamanya.

**Earning Criteria:**  
Player telah menyelesaikan minimal satu match yang tercatat di komunitas.

---

## 5. Badge vs Level Relationship

Hanya **Skill Badge** yang dapat digunakan sebagai requirement Level.

```text
BADGE
├── Skill Badge
│     ↓
│   Tennis Skill
│     ↓
│   Level Progression
│
└── Achievement Badge
      ↓
    Player Achievement
      ↓
    Tidak memengaruhi Level
```

Contoh:

```text
Level: Lower Beginner

Required Skill Badges
├── Basic Forehand
└── Basic Backhand
```

```text
Level: Beginner

Required Skill Badges
├── Basic Serve
└── Basic Volley
```

Achievement Badge tidak dapat dipilih sebagai Level requirement.

---

## 6. Level Configuration

Setiap Level memiliki:

- Level Name
- Order / Sequence
- Description
- Required Skill Badges
- Status: Active / Inactive

Contoh:

```text
Edit Level

Level Name
[ Lower Beginner ]

Description
[ Player understands basic tennis strokes ]

Required Skill Badges

☑ Basic Forehand
☑ Basic Backhand
☐ Basic Serve
☐ Basic Volley

[ Cancel ] [ Save ]
```

---

## 7. Level Progression Rules

Level memiliki urutan berdasarkan field `order`.

```text
Newbie
   ↓
Lower Beginner
   ↓
Beginner
   ↓
Intermediate
   ↓
Upper Intermediate
   ↓
Advanced
```

### Highest Eligible Level

System menentukan level pemain berdasarkan:

> **Highest level where all required Skill Badges have been earned.**

Contoh:

```text
Player Badges:

✓ Basic Forehand
✓ Basic Backhand
✓ Basic Serve
✗ Basic Volley
```

Result:

```text
Current Level: Lower Beginner

Next Level: Beginner

Progress:
3 / 4 required badges

Missing:
• Basic Volley
```

Setelah Basic Volley diperoleh:

```text
✓ Basic Forehand
✓ Basic Backhand
✓ Basic Serve
✓ Basic Volley
```

Result:

```text
Current Level: Beginner
```

### Multiple Level Progression

Jika player memenuhi requirement untuk beberapa level sekaligus, system menetapkan **highest eligible level**.

Contoh:

```text
Newbie
   ↓
Lower Beginner
   ↓
Beginner
   ↓
Intermediate
```

Jika semua requirement sampai Intermediate sudah terpenuhi, player langsung memiliki:

```text
Current Level: Intermediate
```

---

## 8. Level Fallback Rules

Jika Skill Badge yang menjadi requirement dicabut/revoked, system melakukan recalculation.

Flow:

```text
Badge Revoked
      ↓
Recalculate Level
      ↓
Find highest level where
all required Skill Badges are earned
      ↓
Update Player Level
```

Contoh:

```text
Current Level: Beginner

✓ Basic Forehand
✓ Basic Backhand
✓ Basic Serve
✓ Basic Volley
```

Jika Basic Volley dicabut:

```text
Beginner
  ✗ Basic Volley
       ↓
Lower Beginner
```

Player menjadi:

```text
Current Level: Lower Beginner
```

### Fallback to Newbie

Jika player tidak lagi memenuhi requirement untuk Lower Beginner:

```text
Lower Beginner
  ✗ Basic Backhand
       ↓
Newbie
```

**Newbie adalah fallback level paling rendah.**

---

## 9. Badge Revocation & History

Badge yang dicabut tidak boleh menghapus history.

PlayerBadge memiliki status:

```text
Active
Revoked
```

Contoh:

```text
Badge History

Basic Volley
Status: Revoked
Awarded: 10 Sep 2026
Revoked: 18 Sep 2026
Revoked By: Admin
Reason: Failed reassessment
```

Jika player kembali memenuhi requirement, Admin dapat memberikan badge tersebut kembali.

---

## 10. Achievement Badge Rules

Achievement Badge memiliki lifecycle yang terpisah dari Level.

### Achievement Badge diberikan ketika:

- Player memenuhi achievement criteria.
- Admin memberikan badge secara manual.
- System dapat memberikan badge otomatis jika achievement dapat diverifikasi dari data aktivitas.

Contoh:

```text
Player completes first match
        ↓
System detects achievement
        ↓
First Match Badge
        ↓
Achievement Badge earned
```

Achievement Badge tidak menyebabkan:

- Player naik level.
- Player turun level.
- Perubahan progress level.

---

## 11. Player Dashboard

Dashboard menampilkan dua section utama.

### My Tennis Level

```text
┌─────────────────────────────────────┐
│ 🎾 My Tennis Level                  │
│                                     │
│ Beginner                            │
│                                     │
│ Next Level: Intermediate            │
│                                     │
│ Required Skills                     │
│ ✓ Basic Forehand                    │
│ ✓ Basic Backhand                    │
│ ✓ Basic Serve                       │
│ ✓ Basic Volley                     │
│ 🔒 Intermediate Skill A             │
│ 🔒 Intermediate Skill B             │
└─────────────────────────────────────┘
```

### My Achievements

```text
┌─────────────────────────────────────┐
│ 🏆 My Achievements                  │
│                                     │
│ 🏅 First Coaching                   │
│ 🏅 First Match                      │
│ 🏅 Community Player                 │
│ 🔒 Tournament Participant            │
│ 🔒 10 Matches Played                │
└─────────────────────────────────────┘
```

Player dapat melihat:

- Current Level
- Next Level
- Level Progress
- Required Skill Badges
- Earned Skill Badges
- Locked Skill Badges
- Achievement Badges
- Achievement yang belum diperoleh

---

## 12. Badge Detail

### Earned Skill Badge

```text
🏅 Basic Forehand

Type: Skill
Category: Groundstroke

Status: Earned

You earned this badge on:
15 September 2026

Awarded by:
Coach / Admin
```

### Locked Skill Badge

```text
🔒 Basic Serve

Type: Skill

Required to reach:
Beginner

How to earn:
Attend Basic Serve Coaching
and pass the coaching evaluation.
```

### Achievement Badge

```text
🏆 First Match

Type: Achievement
Category: Match

Status: Earned

You earned this badge on:
15 September 2026

Description:
Completed your first tennis match.
```

---

## 13. Admin Dashboard

Tambahkan menu:

**Community → Badges**

### Badge Management

Admin dapat:

- View badges
- Create badge
- Edit badge
- Disable badge
- Set badge type
- Set badge category
- Set earning criteria
- Set badge icon/image

### Level Management

Admin dapat:

- View levels
- Create level
- Edit level
- Change level order
- Configure required Skill Badges
- Activate/deactivate level

---

## 14. Award Badge

Admin dapat memberikan badge kepada player.

```text
Award Badge

Player
[ John Doe ]

Badge
[ Basic Serve ▼ ]

Type:
Skill

Reason / Note
[ Completed Basic Serve Coaching ]

[ Cancel ] [ Award Badge ]
```

Untuk Achievement:

```text
Award Badge

Player
[ John Doe ]

Badge
[ Tournament Participant ▼ ]

Type:
Achievement

Reason / Note
[ Participated in Community Tournament ]

[ Cancel ] [ Award Badge ]
```

Setelah badge diberikan:

### Skill Badge

```text
Award Skill Badge
        ↓
Recalculate Player Level
```

### Achievement Badge

```text
Award Achievement Badge
        ↓
No Level Calculation
```

---

## 15. Automatic Level Calculation

Level tidak diberikan secara manual oleh Admin.

System menentukan level berdasarkan Skill Badge.

Formula:

```text
Player Level =
Highest Active Level
where all required Skill Badges are earned
```

Important rule:

> **Admin awards badges; the system determines the player's level.**

---

## 16. Notifications

### Badge Earned

> 🎉 Congratulations!  
> You earned the **Basic Serve** badge.

### Level Up

> 🎉 Congratulations!  
> You have reached **Beginner Level**!

### Achievement Earned

> 🏆 Achievement Unlocked!  
> You earned the **First Match** badge.

### Level Down

Jika badge dicabut dan menyebabkan level turun:

> Your tennis level has been updated to **Lower Beginner** because a required skill badge is no longer active.

---

## 17. Data Model

### Level

```text
Level
- id
- name
- description
- order
- isActive
```

### Badge

```text
Badge
- id
- name
- description
- iconUrl
- type              // Skill | Achievement
- category
- earningCriteria
- isActive
```

### LevelBadge

Relasi antara Level dan Skill Badge.

```text
LevelBadge
- id
- levelId
- badgeId
```

### PlayerBadge

```text
PlayerBadge
- id
- playerId
- badgeId
- status            // Active | Revoked
- awardedBy
- awardedAt
- revokedBy
- revokedAt
- note
```

---

## 18. Business Rules

1. Setiap badge harus memiliki type: `Skill` atau `Achievement`.
2. Hanya Skill Badge yang dapat digunakan sebagai Level requirement.
3. Achievement Badge tidak memengaruhi Level.
4. Admin dapat memberikan kedua tipe badge.
5. Skill Badge dapat diberikan berdasarkan coaching/evaluation.
6. Achievement Badge diberikan berdasarkan achievement criteria.
7. Level dihitung otomatis berdasarkan Skill Badge.
8. Player selalu berada pada highest eligible active level.
9. Jika Skill Badge dicabut, system melakukan level recalculation.
10. Jika Achievement Badge dicabut, level player tidak berubah.
11. Badge history tetap disimpan walaupun badge dicabut.
12. Badge dapat diperoleh kembali setelah sebelumnya dicabut.
13. Perubahan Level requirement dapat menyebabkan recalculation player level.
14. Admin tidak perlu mengubah Level player secara manual.
15. Achievement Badge tidak dapat digunakan sebagai shortcut untuk naik level.

---

## 19. Recommended Admin Configuration

### Level Management

```text
Levels

1. Newbie
   Required Badges: None

2. Lower Beginner
   Required: 2 Skill Badges
   • Basic Forehand
   • Basic Backhand

3. Beginner
   Required: 2 Skill Badges
   • Basic Serve
   • Basic Volley

4. Intermediate
   Required: TBD

[ + Add Level ]
```

### Badge Management

```text
Badges

Skill
├── Basic Forehand
├── Basic Backhand
├── Basic Serve
└── Basic Volley

Achievement
├── First Coaching
├── First Match
├── Community Player
├── Tournament Participant
├── Tournament Winner
└── 10 Matches Played

[ + Add Badge ]
```

---

## 20. Final Concept

```text
                         TENNIS BADGES
                              │
                 ┌────────────┴────────────┐
                 │                         │
             SKILL BADGE             ACHIEVEMENT
                 │                         │
                 │                         │
          Tennis Ability              Community
                 │                    Achievement
                 │                         │
                 ↓                         ↓
          LEVEL PROGRESSION          PLAYER PROFILE
                 │                         │
                 ↓                         ↓
       Newbie → Beginner →         🏆 First Match
       Intermediate → ...          🏆 Tournament Winner
                                    🏆 10 Matches
```

### Core Principle

> **Skill Badges menentukan "seberapa tinggi level tenis pemain", sedangkan Achievement Badges menunjukkan "apa saja pencapaian yang sudah dilakukan pemain".**
