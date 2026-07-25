# Logbook Pengembangan WebKelas

Dokumen ini mencatat seluruh riwayat aktivitas, implementasi fitur, dan pemecahan masalah (bug fixing) yang dilakukan pada aplikasi WebKelas.

---

## [23 Juli 2026] - Finalisasi Produksi, Laporan, dan Personalisasi Landing Page

### 1. Stabilitas Produksi & Database

* Menginvestigasi respons HTTP 500 pada produksi dan menemukan database SQLite belum memiliki tabel yang diperlukan.
* Mengganti inisialisasi skema produksi dari `drizzle-kit push` ke inisialisasi idempoten berbasis `bun:sqlite`, karena `drizzle-kit` memuat `better-sqlite3` yang belum didukung Bun.
* Memperbarui startup container agar aplikasi tidak gagal saat migrasi CLI dijalankan.
* Menyempurnakan konfigurasi Docker Compose produksi agar aplikasi memakai `expose: 3000` pada jaringan Docker internal, sehingga dapat diproksikan Nginx Proxy Manager tanpa konflik port host.

### 2. Data Siswa, Presensi, dan Laporan

* Mengubah aksi hapus siswa menjadi **Nonaktifkan siswa** untuk menjaga riwayat presensi, nilai, sikap, prestasi, serta jabatan pengurus kelas.
* Menyempurnakan laporan presensi PDF bulanan dan harian: hari sekolah Senin–Jumat, rekap status kehadiran, ringkasan jumlah hadir/tidak hadir, serta penyatuan status sholat.
* Menambahkan laporan PDF untuk buku nilai dan nilai sikap dalam menu Laporan terpusat.
* Mengganti statistik landing page yang sebelumnya data contoh menjadi perhitungan nyata:
  * Rata-rata hadir dihitung dari presensi harian siswa aktif.
  * Rata-rata nilai dihitung dari seluruh nilai siswa aktif.
  * Statistik menampilkan tanda `—` bila data belum tersedia.

### 3. UI Responsif dan Pengaturan Kelas

* Menyempurnakan tampilan mobile manajemen siswa, buku nilai, laporan presensi, dashboard guru, dan bottom navigation.
* Menambahkan CRUD mata pelajaran untuk buku nilai digital.
* Menambahkan manajemen pengurus kelas: menetapkan siswa aktif, mengganti pemegang jabatan, dan menghapus jabatan; perubahan tampil pada landing page.
* Menyembunyikan ikon notifikasi header yang belum memiliki fungsi agar tidak menimbulkan ekspektasi keliru.

### 4. Landing Page, PWA, dan Branding

* Menambahkan informasi kelas, struktur pengurus, card wali kelas, CTA WhatsApp, serta tautan website wali kelas pada landing page.
* Menambahkan pengaturan gambar hero landing page melalui URL gambar dan reset ke ilustrasi default.
* Menambahkan pengaturan foto wali kelas melalui URL gambar, pratinjau, reset placeholder, dan validasi URL di backend.
* Menambahkan PWA: manifest, service worker, ikon aplikasi, favicon, metadata Open Graph, dan metadata Twitter.

### 5. Verifikasi

* Melakukan pengujian API terkontrol untuk pengaturan gambar, foto wali kelas, pengurus kelas, status siswa, serta perhitungan statistik.
* Menjalankan `bun run build` setelah perubahan utama dengan hasil sukses.

---

## [21 Juli 2026] - Modul Sikap & Prestasi (Behavior & Achievements)

### 1. Deskripsi Tugas
Melakukan finalisasi dan penyempurnaan modul **Catatan Sikap & Prestasi (Behavior & Achievements)** baik dari sisi manajemen state global, integrasi API Hono backend, UI Dashboard Wali Kelas, hingga sinkronisasi data real-time di Dashboard Siswa.

### 2. Implementasi Teknis & Perubahan Kode

#### A. State Management & API Integration (`src/client/ClassContext.tsx`)
*   Menambahkan interface `BehaviorRecord` dan `Achievement`.
*   Memperluas state data kelas (`ClassData`) untuk mendukung data perilaku & prestasi siswa.
*   Mengimplementasikan fungsi CRUD asynchronous untuk berkomunikasi dengan backend:
    *   `addBehaviorRecord(record)`
    *   `removeBehaviorRecord(id)`
    *   `addAchievement(achievement)`
    *   `removeAchievement(id)`

#### B. Dashboard Wali Kelas (`src/client/Dashboard.tsx`)
*   Menambahkan menu navigasi utama **"Sikap & Prestasi"** pada sidebar dan bottom navigation mobile.
*   Mendesain tab split/2-panel yang responsif:
    *   **Sub-tab "Catatan Sikap":** Menampilkan skor sikap kumulatif siswa (basis awal 100 poin) dengan warna indikator dinamis. Terintegrasi dengan panel "Detail Log" di sisi kanan untuk menampilkan histori secara detail per siswa.
    *   **Sub-tab "Prestasi Siswa":** Menampilkan tabel raihan prestasi, lengkap dengan tingkat kompetensi dan peringkat.
*   Mengimplementasikan **Modal Add Behavior** dan **Modal Add Achievement** lengkap dengan form validasi kategori sikap positif/negatif, tanggal, poin default, dan deskripsi kejadian.

#### C. Dashboard Siswa (`src/client/StudentDashboard.tsx`)
*   Membaca dan memetakan data perilaku dan prestasi secara spesifik sesuai identitas siswa yang aktif (`dbStudentId`).
*   Menghitung **Skor Sikap** siswa secara dinamis (`100 + Poin Positif - Poin Negatif`) dan menampilkannya sebagai salah satu kartu statistik utama di halaman beranda dashboard siswa.
*   Menambahkan tab navigasi **"Sikap & Prestasi"** di dashboard siswa untuk memantau riwayat apresiasi/evaluasi harian serta melihat daftar piala/prestasi yang telah diraih secara mandiri.

#### D. Perbaikan Backend & Build (`src/index.ts`)
*   Memperbaiki bug sintaksis (missing closing brace `}`) pada blok seeding `existingQuotes` di backend Hono `src/index.ts` yang sempat menghambat proses inisialisasi server.
*   Memastikan port `3000` (Hono API) dan `5173` (Vite UI Dev Server) berjalan serentak dan terhubung tanpa hambatan proxy.
*   Memverifikasi keberhasilan build menggunakan `bun run build` dengan status **Exit Code: 0** (sukses total).

---
