# R4hasiakuu

Ruang percakapan dengan balasan tanpa nama. HTML/CSS/JavaScript dan API Cloudflare Worker dengan database D1.

Jalankan `npm start` dengan Node.js 24, lalu buka http://localhost:3000. Preview otomatis dimuat ulang setiap kali perubahan tampilan atau API disimpan. Data lokal tersimpan di local.sqlite.

Verifikasi alur penyimpanan dan balasan: `node test.mjs`.

### Publikasi di Netlify Free

Impor repositori GitHub ini ke tim Netlify dengan paket Free berbasis kredit. Gunakan root repositori sebagai base directory. Netlify membaca perintah build, folder publik, dan lokasi fungsi dari `netlify.toml`. Dependensi `@netlify/database` meminta Netlify menyediakan PostgreSQL, dan migrasi di `netlify/database/migrations` membuat tabel sebelum publikasi. Database online dimulai kosong. SQLite laptop tidak ikut diunggah.

Setelah deploy, buka URL HTTPS Netlify di dua browser. Buat cerita di browser pertama lalu gunakan tautan cerita di browser kedua untuk membalas. Pemakaian hosting dan database mengikuti kuota paket Free. Lihat [dokumentasi Netlify Database](https://docs.netlify.com/build/data-and-storage/netlify-database/).

### Akun email

Fungsi Netlify melayani pendaftaran, login, dan logout melalui `/api/account/`. Migrasi `0002_accounts.sql` membuat tabel akun dan sesi di PostgreSQL Netlify. Deploy dengan database dan migrasi aktif, lalu coba daftar, muat ulang halaman, keluar, dan masuk kembali. Akun baru langsung aktif. Versi ini belum menyediakan verifikasi alamat email atau pemulihan kata sandi melalui email.

Preview lokal memakai SQLite dengan akun uji `demo@example.test` dan kata sandi `Cerita123`. Di situs publik, pengguna mendaftar sendiri.

### Google AdSense

1. Tambahkan alamat publik website ke menu Sites di AdSense. Di pengaturan build Netlify, isi `ADSENSE_CLIENT` dengan ID penerbit milikmu (format `ca-pub-` dan 16 digit). Deploy ulang. Build menerbitkan meta verifikasi dan `/ads.txt` untuk akun tersebut.
2. Ajukan peninjauan situs melalui AdSense. Pastikan pemberitahuan privasi mencerminkan pengelolaan situsmu dan atur pesan persetujuan yang diperlukan di Privacy & messaging sebelum menyalakan iklan. Untuk pengunjung EEA, Inggris dan Swiss, periksa [persyaratan CMP Google](https://support.google.com/adsense/answer/13554116).
3. Setelah situs disetujui, buat unit Display responsif, isi `ADSENSE_SLOT` dengan ID unit 10 digit, lalu deploy ulang. Unit manual hanya dimuat di `/panduan/`. Biarkan Auto ads nonaktif agar percakapan tetap bebas iklan. Kosongkan slot dan deploy ulang untuk mematikan unit.

Balasan tidak menyertakan nama, akun, atau profil. Percakapan dapat dibaca semua pengunjung yang memiliki akses website. Layanan hosting dan jaringan tetap dapat memproses metadata permintaan. Versi ini belum memiliki moderasi atau pembatasan spam untuk akses publik luas.
