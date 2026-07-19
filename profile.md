# Product Requirement Document (PRD)

# Tennis Training Progress Dashboard

**Version:** 1.0

---

# 1. Objective

Menyediakan dashboard yang menampilkan perkembangan kemampuan tenis berdasarkan hasil latihan, sehingga pemain dan pelatih dapat:

- Melihat perkembangan dari waktu ke waktu.
- Mengetahui kekuatan dan kelemahan.
- Melihat statistik latihan secara keseluruhan.
- Menentukan fokus latihan berikutnya.
- Mengukur pencapaian target latihan.

---

# 2. Goals

## Business Goals

- Meningkatkan engagement pengguna.
- Memberikan insight yang mudah dipahami.
- Membantu coach mengevaluasi pemain.
- Menjadi "rapor digital" perkembangan pemain.

## User Goals

- Mengetahui progress latihan.
- Mengetahui skill terbaik.
- Mengetahui skill yang perlu diperbaiki.
- Melihat histori latihan.
- Mendapat rekomendasi latihan.

---

# 3. User Persona

## Player

- Ingin mengetahui perkembangan latihan.
- Ingin mengetahui peningkatan kemampuan.
- Ingin melihat histori latihan.

## Coach

- Memantau perkembangan pemain.
- Memberikan evaluasi.
- Memberikan target latihan.

## Parent (Opsional)

- Memantau perkembangan anak.

---

# 4. Dashboard Overview

Saat halaman dibuka, pengguna langsung melihat ringkasan perkembangan.

## Hero Card

- Overall Tennis Score
- Player Rank
- Perubahan dibanding periode sebelumnya

Contoh:

```
Overall Tennis Score

74 / 100

Advanced Player

↑ +6 dari bulan lalu
```

---

# 5. Overall Score

## Deskripsi

Merupakan nilai keseluruhan dari seluruh kemampuan pemain.

## Informasi

- Current Score
- Previous Score
- Improvement
- Rank

---

# 6. Skill Summary

Menampilkan nilai setiap skill.

| Skill | Score |
|--------|------:|
| Forehand | 82 |
| Backhand | 68 |
| Serve | 77 |
| Volley | 71 |
| Footwork | 73 |
| Consistency | 69 |

---

# 7. Overall Progress Chart

## Tujuan

Melihat perkembangan overall score dari waktu ke waktu.

## Visualisasi

- Line Chart

## Filter

- Mingguan
- Bulanan
- Tahunan

Data:

- Score
- Average Score

---

# 8. Skill Radar Chart

## Tujuan

Menampilkan keseimbangan kemampuan pemain.

Skill yang ditampilkan:

- Forehand
- Backhand
- Serve
- Volley
- Footwork
- Consistency

Rentang nilai:

0 - 100

---

# 9. Skill Detail

Setiap skill memiliki halaman detail.

Contoh informasi:

- Current Score
- Best Score
- Average Score
- Trend
- Last Practice
- Improvement

Chart:

- Line Chart perkembangan skill.

---

# 10. Training Statistics

## Informasi

- Total Training Session
- Total Hours
- Total Ball Hit
- Total Serve
- Total Rally
- Average Rally
- Longest Rally

Contoh:

| Statistik | Nilai |
|------------|-------|
| Training Session | 58 |
| Total Hours | 94 Jam |
| Ball Hit | 18.420 |
| Serve | 4.280 |
| Rally | 2.340 |
| Average Rally | 17 |
| Longest Rally | 96 |

---

# 11. Fault Analysis

## Tujuan

Menampilkan distribusi kesalahan pemain.

Kategori:

- Serve Fault
- Double Fault
- Forehand Net
- Forehand Out
- Backhand Net
- Backhand Out
- Volley Net
- Volley Out

Visualisasi:

- Pie Chart
- Bar Chart

---

# 12. Improvement Trend

Menampilkan peningkatan setiap skill.

Contoh:

| Skill | Improvement |
|---------|------------|
| Forehand | +12% |
| Serve | +7% |
| Volley | +2% |
| Footwork | +5% |
| Backhand | -3% |

Visualisasi:

- Horizontal Bar Chart

---

# 13. Weakest Skills

Menampilkan skill dengan nilai terendah.

| Skill | Score | Recommendation |
|---------|------:|----------------|
| Backhand | 61 | Cross Court Drill |
| Footwork | 65 | Ladder Drill |
| Volley | 67 | Reflex Volley |

---

# 14. Achievement

Gamification untuk meningkatkan motivasi pemain.

Contoh Achievement:

- First 100 Serve
- Rally Master
- 30 Days Training
- No Double Fault
- 1000 Forehand
- Iron Footwork

Informasi:

- Nama Achievement
- Tanggal diperoleh
- Progress Achievement

---

# 15. Training Calendar

Menampilkan histori latihan dalam bentuk kalender.

Status:

- Training
- Rest Day
- Match
- Cancelled

---

# 16. Goal Tracking

Pengguna dapat membuat target latihan.

Contoh:

Target:

- Serve = 80

Current:

- 77

Progress:

96%

Informasi:

- Target Score
- Current Score
- Remaining Score
- Deadline

---

# 17. Coach Notes

Coach dapat memberikan evaluasi.

Contoh:

```
Backhand sudah jauh lebih baik.

Masih terlambat melakukan split step.

Fokus latihan minggu depan:

- Footwork
- Cross Court Backhand
```

---

# 18. Export

Mendukung export ke:

- PDF
- PNG
- JPG
- Share Link

---

# 19. Responsive Layout

## Desktop

```
---------------------------------------

Overall Score

Radar Chart

Progress Chart

Skill Summary

Training Statistics

Fault Analysis

Achievements

Coach Notes

---------------------------------------
```

## Mobile

```
Overall Score

Progress Chart

Radar Chart

Skill Summary

Statistics

Fault Analysis

Achievements

Coach Notes
```

---

# 20. Score Classification

## Berdasarkan Nilai

| Score | Rank | Warna |
|-------:|------|--------|
| 0 - 20 | Rookie | Merah |
| 21 - 40 | Beginner | Oranye |
| 41 - 60 | Challenger | Kuning |
| 61 - 75 | Competitor | Hijau Muda |
| 76 - 90 | Advanced | Hijau |
| 91 - 100 | Elite | Hijau Tua |

---

# 21. Dashboard Components

## Cards

- Overall Score
- Player Rank
- Total Training
- Total Hours
- Current Streak

## Charts

- Overall Progress
- Radar Skill
- Skill Progress
- Fault Distribution
- Improvement Trend

## Tables

- Skill Summary
- Weakest Skill
- Achievement
- Training History

---

# 22. Future Enhancements

- AI Coach Recommendation
- Video Analysis
- Swing Analysis
- Serve Speed Analysis
- Match Performance Dashboard
- Heatmap Posisi Pemain
- Shot Placement Analysis
- AI Prediction Score
- Personal Training Plan

---

# 23. AI Coach Summary (Future Feature)

## Tujuan

Memberikan analisis otomatis berdasarkan histori latihan pemain.

Contoh Insight:

> Forehand Anda meningkat 6 poin dalam dua minggu terakhir.
>
> Backhand masih menjadi area dengan tingkat error tertinggi.
>
> Serve menunjukkan peningkatan konsistensi sebesar 12%.
>
> Disarankan fokus pada latihan Cross Court Backhand dan Footwork selama 2–3 sesi berikutnya.

---

# 24. Open Questions

Beberapa hal yang masih perlu diputuskan sebelum implementasi:

## 1. Struktur Penilaian

- Apakah setiap skill menggunakan rentang nilai **0–100**?
- Atau menggunakan skala lain (misalnya 1–10)?

---

## 2. Daftar Skill

Skill apa saja yang akan dinilai?

Contoh:

- Forehand
- Backhand
- Serve
- Volley
- Smash
- Lob
- Footwork
- Consistency
- Accuracy
- Reaction
- Stamina
- Mental
- Positioning

---

## 3. Sumber Data

Bagaimana nilai diperoleh?

- Input manual oleh coach.
- Self assessment oleh pemain.
- Perhitungan otomatis dari drill.
- Integrasi dengan alat tracking.

---

## 4. Jenis Latihan

Apakah latihan dibedakan menjadi:

- Serve Drill
- Forehand Drill
- Backhand Drill
- Volley Drill
- Rally
- Match Play
- Footwork
- Physical Training

---

## 5. Histori Data

Apakah setiap sesi latihan disimpan sehingga dapat dilihat:

- Harian
- Mingguan
- Bulanan
- Tahunan

---

## 6. Sistem Ranking

Pilih salah satu:

- Beginner → Elite
- Level + XP
- Bronze → Silver → Gold → Platinum
- NTRP Style

---

## 7. Goal Management

Apakah target dibuat oleh:

- Player
- Coach
- Sistem secara otomatis

---

## 8. AI Insight

Apakah dashboard memberikan insight otomatis seperti:

- Skill yang meningkat.
- Skill yang menurun.
- Penyebab fault terbanyak.
- Fokus latihan minggu depan.

---

## 9. Multi User

Apakah aplikasi mendukung:

- Satu pemain.
- Banyak pemain.
- Banyak coach.
- Komunitas tenis.

---

## 10. Raw Performance Metrics

Apakah data mentah berikut juga akan disimpan?

- First Serve In (%)
- Second Serve In (%)
- Double Fault
- Unforced Error
- Winner
- Forced Error
- Rally Count
- Longest Rally
- Ball Speed
- Serve Speed
- Accuracy (%)
- Target Hit (%)

---