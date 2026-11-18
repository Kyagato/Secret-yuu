# R4hasiakuu

Ruang percakapan dengan balasan tanpa nama. HTML/CSS/JavaScript dan API Cloudflare Worker dengan database D1.

Jalankan dengan Node.js 24: `node build.mjs`, lalu `node dev.mjs`. Buka http://localhost:3000. Data lokal tersimpan di local.sqlite.

Verifikasi alur penyimpanan dan balasan: `node test.mjs`.

### Publikasi di Netlify Free

Impor repositori GitHub ini ke tim Netlify dengan paket Free berbasis kredit. Gunakan root repositori sebagai base directory. Netlify membaca perintah build, folder publik, dan lokasi fungsi dari `netlify.toml`. Dependensi `@netlify/database` meminta Netlify menyediakan PostgreSQL, dan migrasi di `netlify/database/migrations` membuat tabel sebelum publikasi. Database online dimulai kosong. SQLite laptop tidak ikut diunggah.

Setelah deploy, buka URL HTTPS Netlify di dua browser. Buat cerita di browser pertama lalu gunakan tautan cerita di browser kedua untuk membalas. Pemakaian hosting dan database mengikuti kuota paket Free. Lihat [dokumentasi Netlify Database](https://docs.netlify.com/build/data-and-storage/netlify-database/).

### Akun email dan Google

Menu **Masuk / Daftar** menggunakan Supabase Auth. Akun bersifat opsional. Cerita dan komentar tidak menyimpan email atau ID pengguna. Sesi disimpan oleh SDK di browser dan dipulihkan setelah halaman dimuat ulang.

1. Buat proyek Supabase milikmu. Di **Authentication → Providers**, aktifkan Email dan **Confirm email**. Untuk pendaftaran publik, konfigurasikan SMTP agar email konfirmasi terkirim ke pengguna.
2. Untuk Google, buat kredensial OAuth jenis **Web application** di Google Cloud. Salin callback URL dari pengaturan provider Google di Supabase ke **Authorized redirect URIs** di Google Cloud. Isi Client ID dan Client Secret Google **hanya di pengaturan provider Supabase**.
3. Di Supabase **Authentication → URL Configuration**, atur Site URL ke domain website. Tambahkan URL kembali yang tepat untuk produksi serta `http://localhost:3000/` untuk pengujian. Buka tautan konfirmasi pada browser tempat mendaftar untuk menyelesaikan alur PKCE.
4. Untuk laptop, buat `.env.local` dalam folder proyek. Untuk Netlify, tambahkan dua variabel yang sama di pengaturan environment untuk **Builds**:

   ```dotenv
   SUPABASE_URL=https://PROJECT-REF.supabase.co
   SUPABASE_PUBLISHABLE_KEY=sb_publishable_GANTI_DENGAN_KEY_PUBLIK
   ```

5. Jalankan kembali `npm start` atau deploy ulang Netlify. Uji daftar, konfirmasi email, masuk, muat ulang halaman, keluar, dan masuk kembali dengan Google. Gunakan publishable key dari proyek Supabase yang sama. Build memasukkan kedua nilai publik ini ke halaman.

### Google AdSense

1. Tambahkan alamat publik website ke menu Sites di AdSense. Di pengaturan build Netlify, isi `ADSENSE_CLIENT` dengan ID penerbit milikmu (format `ca-pub-` dan 16 digit). Deploy ulang. Build menerbitkan meta verifikasi dan `/ads.txt` untuk akun tersebut.
2. Ajukan peninjauan situs melalui AdSense. Pastikan pemberitahuan privasi mencerminkan pengelolaan situsmu dan atur pesan persetujuan yang diperlukan di Privacy & messaging sebelum menyalakan iklan. Untuk pengunjung EEA, Inggris dan Swiss, periksa [persyaratan CMP Google](https://support.google.com/adsense/answer/13554116).
3. Setelah situs disetujui, buat unit Display responsif, isi `ADSENSE_SLOT` dengan ID unit 10 digit, lalu deploy ulang. Unit manual hanya dimuat di `/panduan/`. Biarkan Auto ads nonaktif agar percakapan tetap bebas iklan. Kosongkan slot dan deploy ulang untuk mematikan unit.

Balasan tidak menyertakan nama, akun, atau profil. Percakapan dapat dibaca semua pengunjung yang memiliki akses website. Layanan hosting dan jaringan tetap dapat memproses metadata permintaan. Versi ini belum memiliki moderasi atau pembatasan spam untuk akses publik luas.
