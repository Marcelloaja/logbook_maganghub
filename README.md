# 📋 Logbook Magang Digital - Kemendikdasmen Balai Bahasa Jawa Timur

Aplikasi web logbook digital resmi yang dirancang khusus untuk 33 peserta program **MagangHub** di lingkungan **Kementerian Pendidikan Dasar dan Menengah (Kemendikdasmen) - Balai Bahasa Provinsi Jawa Timur**.

Dilengkapi fitur export **PDF**, **Word (.docx)** dengan Kop Surat dan Logo resmi, tanda tangan digital, serta **Pusat Penyimpanan Berkas (Storage Hub)** multi-folder untuk 33 anak magang dengan tautan (*direct link*) yang siap dibagikan ke mentor atau pihak instansi.

---

## 🏛️ Informasi Instansi
- **Instansi**: Balai Bahasa Provinsi Jawa Timur (Kemendikdasmen)
- **Alamat**: Jl. Gebang Putih No.10, Keputih, Kec. Sukolilo, Surabaya, Jawa Timur 60117
- **Telepon**: 0851-8686-5972
- **Website Resmi**: [https://balaibahasajatim.kemendikdasmen.go.id/](https://balaibahasajatim.kemendikdasmen.go.id/)

---

## ✨ Fitur & Pembaruan Terkini

1. **Format Resmi Kemendikdasmen**:
   - Kop surat resmi lengkap dengan logo Kemendikdasmen Balai Bahasa Jawa Timur dan titi mangsa Surabaya.
   - Kolom identitas:
     - **Nama Peserta Magang**
     - **Nama Unit Kerja / Divisi** (contoh: Tim Kerja Literasi & Kebahasaan, Subbagian Umum, dll.)
     - **Hari & Tanggal Otomatis Realtime**: Otomatis mendeteksi hari dan tanggal hari ini saat dibuka.
     - **Nama Mentor dengan Fitur Kunci (Lock)**: Dilengkapi tombol gembok `[ 🔓 Kunci Nama ]` agar nama mentor tersimpan permanen di perangkat Anda dan tidak perlu diketik ulang setiap hari.

2. **Rincian Kegiatan (Waktu Mulai & Selesai + Justify + Foto Dokumentasi)**:
   - Input waktu kegiatan yang presisi: **Waktu Mulai** dan **Waktu Selesai** (contoh: `07:30 - 16:00`).
   - Format teks deskripsi rata kanan-kiri (*justify*) di preview, export PDF, dan export Word.
   - Setiap kegiatan memiliki kotak upload foto dokumentasi sendiri (maks. 5MB per foto).
   - Di dokumen hasil (PDF & Word), foto tersusun rapi terkelompok per kegiatan (*Kegiatan #1*, *Kegiatan #2*, dst.).

3. **Pusat Berkas & Storage Magang (Storage Hub untuk 33 Peserta)**:
   - Pengganti sistem drive lama: Setiap peserta dapat membuat dan mengelola folder masing-masing (misal `01. Ilham - Divisi TI`, `02. Sarah - Humas`, dll.).
   - Bilah pencarian realtime untuk menemukan folder peserta.
   - **Simpan 1-Klik**: Simpan logbook hari ini langsung ke folder terpilih dalam format PDF atau Word (.docx).
   - **Tautan Berbagi Siap Salin**: Menghasilkan tautan langsung dengan tombol `Salin Link` untuk segera ditempel ke portal MagangHub atau dikirim ke mentor.
   - **Backend Google Drive Bersama**: Cukup 1 akun Google Drive koordinator/admin untuk seluruh 33 peserta melalui Google Apps Script Webhook. Peserta tidak perlu login akun Google masing-masing.
   - Tetap bekerja offline / lokal jika belum menghubungkan webhook.

4. **Tanda Tangan Digital (Signature Pad)**:
   - Goreskan tanda tangan langsung di layar (desktop/smartphone) atau upload gambar tanda tangan untuk **Peserta Magang** dan **Mentor**.
   - Tanda tangan otomatis muncul di lembar pengesahan PDF & Word.

5. **Export Ganda (PDF & Word .docx)**:
   - **Export PDF**: Menggunakan format resolusi tinggi siap cetak atau dikirim via WhatsApp/Email.
   - **Export Word (.docx)**: Dokumen Word asli (*native*) lengkap dengan logo instansi, tabel kegiatan berwaktu, foto per kegiatan, dan tanda tangan tersemat.

6. **Desain Modern Full Width (Light & Dark Theme)**:
   - Tampilan default Light Theme yang segar, bersih, dan profesional.
   - Mendukung Dark Mode dengan 1-klik tombol ganti tema.
   - Layout *full width* adaptif di monitor desktop, tablet, maupun layar smartphone.

---

## 🚀 Panduan Deploy ke Vercel

### Deploy via GitHub
1. Repository GitHub: [https://github.com/Marcelloaja/logbook_maganghub](https://github.com/Marcelloaja/logbook_maganghub)
2. Buka [vercel.com](https://vercel.com/) dan login.
3. Klik **Add New Project** > **Import Git Repository**.
4. Pilih repository `Marcelloaja/logbook_maganghub`.
5. Klik **Deploy** (Pengaturan framework: *Other*, root directory: `./`).

---

*Dikembangkan untuk kemudahan dokumentasi mahasiswa/peserta magang MagangHub Kemendikdasmen RI di Balai Bahasa Provinsi Jawa Timur.*
