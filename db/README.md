# Database (PostgreSQL)

Struktur database dikelola lewat **migrasi** di `db/migrations/`. Setiap file
dijalankan **satu kali** per database, berurutan, dan dicatat di tabel
`schema_migrations`. Jangan menjalankan file SQL secara manual lagi.

## Perintah

```bash
npm run migrate:status   # lihat migrasi yang sudah / belum diterapkan (exit 1 kalau ada yang belum)
npm run migrate          # terapkan semua migrasi yang belum diterapkan
```

Koneksi memakai `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` dari
environment, atau dari `.env.local` / `.env`.

**Otomatis:** setiap kali aplikasi start (`pm2 restart`, `next start`, `npm run dev`)
migrasi yang belum diterapkan langsung dijalankan sebelum melayani request
(`instrumentation.ts`). Kalau gagal, aplikasi tetap jalan dan error-nya tertulis
di log (`pm2 logs isms-jai`). Matikan dengan env `AUTO_MIGRATE=false`.

## Update server: cukup `git pull`

Sekali saja per server, aktifkan update otomatis:

```bash
npm run setup:server
```

Setelah itu, setiap `git pull` di server otomatis (`.githooks/post-merge`):

1. mengembalikan file `storage/` / backup yang tidak lagi dilacak git kalau pull menghapusnya dari disk,
2. `npm install` — hanya kalau `package.json` berubah,
3. `npm run build`,
4. `pm2 restart isms-jai` → database diperbarui otomatis saat start.

Nama proses pm2 lain? set env `PM2_APP`. Mesin developer tidak perlu `setup:server`.

**Pertama kali** (server yang belum punya `.githooks`, termasuk pull yang berisi
commit "Stop tracking DB backup and uploaded files"), pasang hook-nya dulu lalu pull:

```bash
git fetch origin
git show origin/main:.githooks/post-merge > .git/hooks/post-merge
git pull                 # file storage/ dikembalikan otomatis, lalu build + restart
npm run setup:server     # selanjutnya pakai hook dari repo
```

Update manual (tanpa hook) tetap bisa: `git pull && npm install && npm run build && pm2 restart isms-jai`.

## Menambah perubahan database

1. Buat file baru dengan nomor berikutnya, mis. `db/migrations/0002_tambah_kolom_x.sql`.
2. Tulis SQL-nya. Usahakan aman diulang (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`).
3. Jalankan `npm run migrate` di lokal, uji, lalu commit file migrasinya bersama kodenya.

**Jangan pernah mengubah file migrasi yang sudah diterapkan** — buat file baru.
Runner akan memperingatkan kalau isi file yang sudah diterapkan berubah.

## `0001_baseline.sql`

Berisi seluruh skema per 1 Oktober 2026 dan **aman dijalankan di database mana
pun**: database kosong, atau database lama yang dulu dibuat manual dari file SQL
lama / backup. Tabel dan kolom yang belum ada dibuat; constraint dan index hanya
ditambahkan kalau belum ada yang setara; tidak ada yang dihapus. Kalau data
lama melanggar suatu constraint, constraint itu dilewati dengan `WARNING`
(migrasi tetap berhasil) — periksa pesan tersebut.

Database baru tidak berisi akun admin. Buat akun ISM Admin pertama secara
manual (hash password bcrypt) atau pulihkan dari backup.

## `db/legacy/`

File SQL lama (sebelum ada migrasi), disimpan sebagai arsip/riwayat saja.
Isinya sudah tercakup di `0001_baseline.sql` — **jangan dijalankan**.
