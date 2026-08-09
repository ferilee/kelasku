# Deployment WebKelas di Proxmox

Dokumen ini menyiapkan WebKelas di VM tanpa memindahkan database lama. Volume SQLite baru akan dibuat di `/srv/data/webkelas/sqlite` saat aplikasi pertama kali berjalan.

## 1. Siapkan VM

Pastikan Docker dan Docker Compose plugin telah tersedia, lalu clone repository ke lokasi aplikasi:

```bash
sudo mkdir -p /srv/apps
sudo chown -R "$USER":"$USER" /srv/apps
git clone git@github.com:ferilee/kelasku.git /srv/apps/webkelas
cd /srv/apps/webkelas
bash deploy/proxmox/bootstrap.sh
cp .env.example .env
```

Jangan menyalin `.env` lama bila ingin memulai data baru. Periksa kembali `.env` sebelum deploy.

## 2. Jalankan aplikasi

```bash
cd /srv/apps/webkelas
docker compose -f docker-compose.production.yml pull
docker compose -f docker-compose.production.yml up -d
docker compose -f docker-compose.production.yml ps
curl http://127.0.0.1:3300/api/health
```

WebKelas hanya diekspos ke network Docker `ferileenet`; port `3300` tidak dipublikasikan ke internet oleh Compose.

## 3. Atur Nginx Proxy Manager

Pastikan container Nginx Proxy Manager juga tergabung ke network `ferileenet`, lalu buat Proxy Host:

| Pengaturan | Nilai |
| --- | --- |
| Domain Names | `kelas.smkpasirian-lmj.sch.id` |
| Scheme | `http` |
| Forward Hostname / IP | `kelasku` |
| Forward Port | `3300` |
| SSL | Sertifikat Let's Encrypt dan Force SSL |

Uji dari container NPM bila diperlukan:

```bash
docker exec nginx-proxy-manager sh -lc 'wget -qO- http://kelasku:3300/api/health'
```

Respons yang benar adalah `{"status":"ok"}`.

## 4. Cutover DNS dan rollback

1. Uji login, siswa, nilai, laporan PDF, dan galeri menggunakan VM terlebih dahulu.
2. Ubah record DNS domain ke IP VM Proxmox setelah pengujian berhasil.
3. Pertahankan VPS lama selama 1–3 hari sebagai rollback.
4. Jika ada masalah, kembalikan record DNS ke VPS lama; data baru di VM tidak akan ikut kembali.

## 5. Backup

Skrip backup tersedia di `scripts/backup/webkelas-sqlite.sh`. Ia menghentikan WebKelas sebentar agar salinan SQLite konsisten, kemudian menyalakan kembali container secara otomatis.

```bash
sudo /srv/apps/webkelas/scripts/backup/webkelas-sqlite.sh
```

Contoh cron harian pukul 02:15:

```cron
15 2 * * * /srv/apps/webkelas/scripts/backup/webkelas-sqlite.sh >> /var/log/webkelas-backup.log 2>&1
```

Simpan salinan folder `/srv/backups/webkelas` ke media atau server lain secara berkala.
