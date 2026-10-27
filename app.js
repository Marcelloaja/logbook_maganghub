/* ============================================================
   APP.JS - Logbook Magang Kemendikdasmen Balai Bahasa Jawa Timur
   ============================================================ */

// Application State
let kegiatanCounter = 0;
let kegiatanDataStore = []; // Array of { id, waktu, nama, deskripsi, fotos: [] }
let logoDataUrl = '';
let logoArrayBuffer = null;
let isMentorLocked = false;

// Signatures state (data URLs)
let sigData = {
  peserta: '',
  mentor: ''
};

// Drive OAuth State
let gapiInited = false;
let tokenClient = null;
let accessToken = null;
let driveUserName = '';

// ============================================================
// INITIALIZATION
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  initRealtimeDate();
  initMentorLock();
  initSignaturePads();
  await preloadLogo();
  loadSavedDraft();
  initStorageHub();
  startDailyResetWatcher();
});

// ============================================================
// THEME SWITCHER (LIGHT THEME DEFAULT)
// ============================================================
function initTheme() {
  const saved = localStorage.getItem('maganghub_theme') || 'light';
  setTheme(saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  const target = current === 'dark' ? 'light' : 'dark';
  setTheme(target);
  showToast(target === 'dark' ? 'Mode Gelap diaktifkan 🌙' : 'Mode Terang diaktifkan ☀️');
}

function setTheme(theme) {
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  localStorage.setItem('maganghub_theme', theme);
  updateThemeButtonUI(theme);
}

function updateThemeButtonUI(theme) {
  const icon = document.getElementById('theme-icon');
  const label = document.getElementById('theme-label');
  const iconMobile = document.getElementById('theme-icon-mobile');
  if (theme === 'dark') {
    if (icon) icon.textContent = '☀️';
    if (label) label.textContent = 'Mode Terang';
    if (iconMobile) iconMobile.textContent = '☀️';
  } else {
    if (icon) icon.textContent = '🌙';
    if (label) label.textContent = 'Mode Gelap';
    if (iconMobile) iconMobile.textContent = '🌙';
  }
}

// Realtime Hari & Tanggal Hari Ini
function initRealtimeDate() {
  const now = new Date();
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const todayDay = days[now.getDay()];

  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const todayDate = `${yyyy}-${mm}-${dd}`;

  const hariInput = document.getElementById('hari');
  const dateInput = document.getElementById('tanggal');

  if (hariInput) hariInput.value = todayDay;
  if (dateInput) dateInput.value = todayDate;
}

// Mentor Lock Feature
function initMentorLock() {
  const locked = localStorage.getItem('maganghub_locked_mentor');
  if (locked) {
    isMentorLocked = true;
    const mentorInput = document.getElementById('mentor');
    if (mentorInput) mentorInput.value = locked;
  }
  updateMentorLockUI();
}

function toggleLockMentor() {
  const mentorInput = document.getElementById('mentor');
  const val = (mentorInput?.value || '').trim();

  if (!isMentorLocked) {
    if (!val) {
      showToast('Ketik nama mentor terlebih dahulu untuk mengunci!');
      if (mentorInput) mentorInput.focus();
      return;
    }
    isMentorLocked = true;
    localStorage.setItem('maganghub_locked_mentor', val);
    showToast('🔒 Nama mentor berhasil dikunci! Tidak akan terhapus saat ganti hari');
  } else {
    isMentorLocked = false;
    localStorage.removeItem('maganghub_locked_mentor');
    showToast('🔓 Kunci nama mentor dibuka');
  }
  updateMentorLockUI();
}

function updateMentorLockUI() {
  const btn = document.getElementById('btn-lock-mentor');
  const icon = document.getElementById('lock-icon');
  const label = document.getElementById('lock-label');
  const hint = document.getElementById('lock-hint');
  if (!btn) return;

  if (isMentorLocked) {
    btn.classList.add('locked');
    if (icon) icon.textContent = '🔒';
    if (label) label.textContent = 'Terkunci';
    if (hint) hint.textContent = '✓ Nama mentor tersimpan permanen dan otomatis terisi setiap hari.';
  } else {
    btn.classList.remove('locked');
    if (icon) icon.textContent = '🔓';
    if (label) label.textContent = 'Kunci Nama';
    if (hint) hint.textContent = 'Klik tombol gembok untuk mengunci nama mentor agar selalu tersimpan.';
  }
}

// Preload Logo into Base64 and ArrayBuffer for PDF and Word
async function preloadLogo() {
  if (window.LOGO_BASE64) {
    logoDataUrl = window.LOGO_BASE64;
    logoArrayBuffer = dataUrlToArrayBuffer(logoDataUrl);
    return;
  }
  try {
    const resp = await fetch('assets/logo.png');
    if (!resp.ok) throw new Error('Logo fetch failed');
    const blob = await resp.blob();
    logoArrayBuffer = await blob.arrayBuffer();

    await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        logoDataUrl = e.target.result;
        resolve();
      };
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn('Preload logo fetch skip:', err);
  }
}

function dataUrlToArrayBuffer(dataUrl) {
  if (!dataUrl) return null;
  try {
    const parts = dataUrl.split(',');
    const base64 = parts.length > 1 ? parts[1] : parts[0];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  } catch (e) {
    console.warn('dataUrlToArrayBuffer error:', e);
    return null;
  }
}

async function downloadBlob(blob, fileName, mimeType = 'application/octet-stream') {
  const ext = fileName.split('.').pop().toLowerCase();
  const typeMime = mimeType || (ext === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  const typedBlob = (blob.type === typeMime) ? blob : new Blob([blob], { type: typeMime });

  // 1. Native Windows Save File Picker (Dijamin mempertahankan nama file & ekstensi .pdf / .docx di Chrome & Edge)
  if (window.showSaveFilePicker) {
    try {
      const desc = ext === 'pdf' ? 'Dokumen PDF (*.pdf)' : 'Dokumen Word (*.docx)';
      const handle = await window.showSaveFilePicker({
        suggestedName: fileName,
        types: [{
          description: desc,
          accept: { [typeMime]: ['.' + ext] }
        }]
      });
      const writable = await handle.createWritable();
      await writable.write(typedBlob);
      await writable.close();
      return true;
    } catch (err) {
      if (err.name === 'AbortError') {
        // User menekan Cancel pada dialog simpan
        return false;
      }
      console.warn('showSaveFilePicker dialihkan ke fallback:', err);
    }
  }

  // 2. Data URL Fallback (Mengatasi bug Chrome pada file:/// yang mengubah blob URL menjadi GUID acak)
  if (typedBlob.size < 12 * 1024 * 1024) {
    try {
      const reader = new FileReader();
      const dataUrl = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(typedBlob);
      });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => document.body.removeChild(a), 400);
      return true;
    } catch (err) {
      console.warn('Data URL download fallback error:', err);
    }
  }

  // 3. Fallback FileSaver / ObjectURL
  try {
    if (typeof saveAs === 'function') {
      saveAs(typedBlob, fileName);
      return true;
    }
  } catch (e) {
    console.warn('saveAs error:', e);
  }

  const url = URL.createObjectURL(typedBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 500);
  return true;
}

// ============================================================
// NAVIGATION & SIDEBAR
// ============================================================
function switchTab(name, e) {
  if (e) e.preventDefault();
  if (name === 'drive') name = 'storage';
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

  const targetTab = document.getElementById('tab-' + name);
  const targetNav = document.getElementById('nav-' + name);
  if (targetTab) targetTab.classList.add('active');
  if (targetNav) targetNav.classList.add('active');

  if (name === 'preview') {
    renderPreview();
  } else if (name === 'storage') {
    updateStorageFormSummary();
    // Selalu sync ulang dari cloud setiap kali tab Penyimpanan Berkas dibuka
    syncStorageWithCloud(true);
  }
  document.getElementById('sidebar').classList.remove('open');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function goToPreview() {
  switchTab('preview', null);
}

function goToStorageWithActiveLogbook() {
  switchTab('storage', null);
  const activeName = (document.getElementById('nama')?.value || '').trim().toLowerCase();
  if (activeName) {
    const match = storageFolders.find(f => f.name.toLowerCase().includes(activeName));
    if (match) {
      openFolderView(match.id);
      return;
    }
  }
  if (storageFolders.length > 0 && !currentActiveFolderId) {
    showAllFoldersView();
  }
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// ============================================================
// KEGIATAN & PER-ACTIVITY FOTO DOKUMENTASI
// ============================================================
function formatWaktuKegiatan(k) {
  if (!k) return '-';
  const mulai = (k.waktuMulai || k.waktu || '').trim();
  const selesai = (k.waktuSelesai || '').trim();
  if (mulai && selesai) {
    return `${mulai} - ${selesai}`;
  } else if (mulai) {
    return mulai;
  } else if (selesai) {
    return `s.d. ${selesai}`;
  }
  return '-';
}

function addNewKegiatanUI(data = null) {
  kegiatanCounter++;
  const id = kegiatanCounter;

  let initialMulai = '';
  let initialSelesai = '';
  if (data) {
    if (data.waktuMulai) initialMulai = data.waktuMulai;
    if (data.waktuSelesai) initialSelesai = data.waktuSelesai;
    if (!initialMulai && data.waktu) {
      if (data.waktu.includes('-')) {
        const parts = data.waktu.split('-').map(s => s.trim());
        initialMulai = parts[0] || '';
        initialSelesai = parts[1] || '';
      } else {
        initialMulai = data.waktu.trim();
      }
    }
  }

  const itemData = {
    id: id,
    waktuMulai: initialMulai,
    waktuSelesai: initialSelesai,
    waktu: formatWaktuKegiatan({ waktuMulai: initialMulai, waktuSelesai: initialSelesai }),
    nama: data ? (data.nama || '') : '',
    deskripsi: data ? (data.deskripsi || '') : '',
    fotos: data && data.fotos ? [...data.fotos] : []
  };

  kegiatanDataStore.push(itemData);

  const container = document.getElementById('kegiatan-list');
  const div = document.createElement('div');
  div.className = 'kegiatan-row';
  div.id = 'kg-row-' + id;

  div.innerHTML = `
    <div class="kegiatan-num" id="kg-num-${id}">${kegiatanDataStore.length}</div>
    <div class="kegiatan-fields">
      <div class="kegiatan-top-grid">
        <div class="form-group kg-waktu-col">
          <label class="form-label">Waktu Mulai <span class="req">*</span></label>
          <input type="time" class="form-input kg-input-waktu-mulai" id="kg-waktu-mulai-${id}" value="${escapeAttr(itemData.waktuMulai)}" onchange="updateKegiatanField(${id}, 'waktuMulai', this.value)" />
        </div>
        <div class="form-group kg-waktu-col">
          <label class="form-label">Waktu Selesai <span class="req">*</span></label>
          <input type="time" class="form-input kg-input-waktu-selesai" id="kg-waktu-selesai-${id}" value="${escapeAttr(itemData.waktuSelesai)}" onchange="updateKegiatanField(${id}, 'waktuSelesai', this.value)" />
        </div>
        <div class="form-group kg-nama-field">
          <label class="form-label">Nama Kegiatan <span class="req">*</span></label>
          <input type="text" class="form-input kg-input-nama" id="kg-nama-${id}" placeholder="Contoh: Apel Pagi, Input Data, Riset Bahasa..." value="${escapeAttr(itemData.nama)}" oninput="updateKegiatanField(${id}, 'nama', this.value)" />
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Deskripsi Rinci Kegiatan <span class="req">*</span></label>
        <textarea class="form-input form-textarea kg-input-desc" id="kg-desc-${id}" placeholder="Jelaskan secara detail proses, tugas, atau hasil yang dikerjakan..." oninput="updateKegiatanField(${id}, 'deskripsi', this.value)">${escapeHtml(itemData.deskripsi)}</textarea>
      </div>

      <!-- Foto Dokumentasi Khusus Kegiatan Ini -->
      <div class="kg-photos-section">
        <div class="kg-photos-header">
          <div class="kg-photos-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:17px;height:17px;color:var(--primary-light)"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            <span>Foto Bukti Kegiatan</span>
            <span class="kg-photos-badge" id="kg-badge-${id}">0 foto</span>
          </div>
          <label class="btn-add-photo-kg" title="Unggah foto bukti untuk kegiatan ini">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="width:14px;height:14px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span>Unggah Foto</span>
            <input type="file" id="kg-file-input-${id}" multiple accept="image/*" style="display:none" onchange="handleKgPhotoUpload(event, ${id})" />
          </label>
        </div>

        <div id="kg-photos-container-${id}">
          <div class="kg-photos-grid" id="kg-photos-grid-${id}"></div>
        </div>
      </div>
    </div>

    <button type="button" class="kegiatan-del" onclick="removeKegiatan(${id})" title="Hapus baris kegiatan ini">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="3 6 5 6 21 6"/>
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
        <line x1="10" y1="11" x2="10" y2="17"/>
        <line x1="14" y1="11" x2="14" y2="17"/>
      </svg>
    </button>
  `;

  container.appendChild(div);
  renderKgPhotosGrid(id);
  updateKegiatanNumbers();
}

function updateKegiatanField(id, field, value) {
  const item = kegiatanDataStore.find(k => k.id === id);
  if (item) {
    item[field] = value;
    if (field === 'waktuMulai' || field === 'waktuSelesai') {
      item.waktu = formatWaktuKegiatan(item);
    }
    autoSaveDraft();
    if (field === 'nama') {
      renderKgPhotosGrid(id);
    }
  }
}

function removeKegiatan(id) {
  const el = document.getElementById('kg-row-' + id);
  if (el) {
    el.style.opacity = '0';
    el.style.transform = 'translateX(-15px)';
    el.style.transition = 'all 0.2s ease';
    setTimeout(() => {
      el.remove();
      kegiatanDataStore = kegiatanDataStore.filter(k => k.id !== id);
      updateKegiatanNumbers();
      autoSaveDraft();
    }, 200);
  }
}

function updateKegiatanNumbers() {
  kegiatanDataStore.forEach((item, idx) => {
    const numEl = document.getElementById('kg-num-' + item.id);
    if (numEl) numEl.textContent = idx + 1;
  });
}

// Upload Foto Khusus Kegiatan
function handleKgPhotoUpload(e, id) {
  const files = Array.from(e.target.files);
  if (!files.length) return;

  const item = kegiatanDataStore.find(k => k.id === id);
  if (!item) return;

  let loaded = 0;
  files.forEach(file => {
    if (file.size > 5 * 1024 * 1024) {
      showToast(`File ${file.name} melebihi batas 5MB!`);
      return;
    }

    const reader = new FileReader();
    reader.onload = ev => {
      compressImage(ev.target.result, 1200, 0.85, (compressed) => {
        const defaultCaption = item.nama ? `${item.nama} (${file.name.replace(/\.[^.]+$/, '')})` : file.name.replace(/\.[^.]+$/, '');
        item.fotos.push({
          dataUrl: compressed,
          caption: defaultCaption
        });
        loaded++;
        renderKgPhotosGrid(id);
        autoSaveDraft();
        if (loaded === files.length) {
          showToast(`Berhasil menambahkan foto untuk kegiatan ini!`);
        }
      });
    };
    reader.readAsDataURL(file);
  });

  e.target.value = '';
}

function renderKgPhotosGrid(id) {
  const item = kegiatanDataStore.find(k => k.id === id);
  const container = document.getElementById('kg-photos-container-' + id);
  const badge = document.getElementById('kg-badge-' + id);
  if (!item || !container) return;

  const count = item.fotos ? item.fotos.length : 0;
  if (badge) {
    badge.textContent = `${count} foto`;
    if (count > 0) {
      badge.classList.add('has-photos');
    } else {
      badge.classList.remove('has-photos');
    }
  }

  if (count === 0) {
    container.innerHTML = `
      <div class="kg-photos-empty-zone" onclick="document.getElementById('kg-file-input-${id}').click()" ondragover="event.preventDefault(); this.classList.add('dragover')" ondragleave="this.classList.remove('dragover')" ondrop="handleKgPhotoDrop(event, ${id})">
        <div class="kg-empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        </div>
        <div class="kg-empty-text"><strong>Klik untuk unggah foto</strong> atau seret file ke sini</div>
        <div class="kg-empty-sub">Bisa pilih beberapa foto sekaligus • Maksimal 5MB per foto</div>
      </div>
    `;
    return;
  }

  const kgIdx = kegiatanDataStore.findIndex(k => k.id === id) + 1;
  const kgNameShort = item.nama ? (item.nama.length > 20 ? item.nama.substring(0, 18) + '...' : item.nama) : `Kegiatan #${kgIdx}`;

  let cardsHtml = item.fotos.map((f, photoIdx) => `
    <div class="kg-photo-card">
      <div class="kg-photo-thumb">
        <img src="${f.dataUrl}" alt="Foto Kegiatan" />
        <span class="kg-photo-tag" title="${escapeAttr(item.nama || '')}">Keg #${kgIdx}: ${escapeHtml(kgNameShort)}</span>
        <button type="button" class="kg-photo-del" onclick="removeKgPhoto(${id}, ${photoIdx})" title="Hapus foto ini">✕</button>
      </div>
      <input type="text" class="kg-photo-caption" value="${escapeAttr(f.caption)}" placeholder="Keterangan singkat foto..." oninput="updateKgPhotoCaption(${id}, ${photoIdx}, this.value)" />
    </div>
  `).join('');

  cardsHtml += `
    <div class="kg-photo-add-card" onclick="document.getElementById('kg-file-input-${id}').click()" title="Tambah foto lain untuk kegiatan ini">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      <span>+ Tambah Foto</span>
    </div>
  `;

  container.innerHTML = `<div class="kg-photos-grid" id="kg-photos-grid-${id}">${cardsHtml}</div>`;
}

function handleKgPhotoDrop(e, id) {
  e.preventDefault();
  e.currentTarget.classList.remove('dragover');
  const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
  if (files.length) {
    const fakeEvent = { target: { files: files, value: '' } };
    handleKgPhotoUpload(fakeEvent, id);
  }
}

function updateKgPhotoCaption(kgId, photoIdx, val) {
  const item = kegiatanDataStore.find(k => k.id === kgId);
  if (item && item.fotos && item.fotos[photoIdx]) {
    item.fotos[photoIdx].caption = val;
    autoSaveDraft();
  }
}

function removeKgPhoto(kgId, photoIdx) {
  const item = kegiatanDataStore.find(k => k.id === kgId);
  if (item && item.fotos) {
    item.fotos.splice(photoIdx, 1);
    renderKgPhotosGrid(kgId);
    autoSaveDraft();
    showToast('Foto berhasil dihapus');
  }
}

function compressImage(src, maxWidth, quality, callback) {
  const img = new Image();
  img.onload = () => {
    let w = img.width;
    let h = img.height;
    if (w > maxWidth) {
      h = Math.round((h * maxWidth) / w);
      w = maxWidth;
    }
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    callback(canvas.toDataURL('image/jpeg', quality));
  };
  img.src = src;
}

// ============================================================
// DIGITAL SIGNATURE (CANVAS & IMAGE UPLOAD)
// ============================================================
function initSignaturePads() {
  ['peserta', 'mentor'].forEach(role => {
    const canvas = document.getElementById('sig-' + role);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let drawing = false;

    function resize() {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * 2;
      canvas.height = rect.height * 2;
      ctx.scale(2, 2);
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#1e3a8a';
      if (sigData[role]) {
        drawDataUrlToCanvas(canvas, sigData[role]);
      }
    }
    resize();
    window.addEventListener('resize', resize);

    function startDraw(e) {
      drawing = true;
      ctx.beginPath();
      const pos = getPos(e, canvas);
      ctx.moveTo(pos.x, pos.y);
    }
    function moveDraw(e) {
      if (!drawing) return;
      e.preventDefault();
      const pos = getPos(e, canvas);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    }
    function endDraw() {
      if (!drawing) return;
      drawing = false;
      sigData[role] = canvas.toDataURL('image/png');
      autoSaveDraft();
    }

    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', moveDraw);
    window.addEventListener('mouseup', endDraw);

    canvas.addEventListener('touchstart', startDraw, { passive: false });
    canvas.addEventListener('touchmove', moveDraw, { passive: false });
    window.addEventListener('touchend', endDraw);
  });
}

function getPos(e, canvas) {
  const rect = canvas.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  return {
    x: clientX - rect.left,
    y: clientY - rect.top
  };
}

function clearSignature(role) {
  const canvas = document.getElementById('sig-' + role);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  sigData[role] = '';
  autoSaveDraft();
  showToast('Tanda tangan ' + role + ' dibersihkan');
}

function uploadSignatureImage(e, role) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    sigData[role] = ev.target.result;
    const canvas = document.getElementById('sig-' + role);
    if (canvas) drawDataUrlToCanvas(canvas, ev.target.result);
    autoSaveDraft();
    showToast('Tanda tangan ' + role + ' berhasil diupload');
  };
  reader.readAsDataURL(file);
  e.target.value = '';
}

function drawDataUrlToCanvas(canvas, dataUrl) {
  const ctx = canvas.getContext('2d');
  const img = new Image();
  img.onload = () => {
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    const aspect = img.width / img.height;
    let w = rect.width * 0.8;
    let h = w / aspect;
    if (h > rect.height * 0.85) {
      h = rect.height * 0.85;
      w = h * aspect;
    }
    const x = (rect.width - w) / 2;
    const y = (rect.height - h) / 2;
    ctx.drawImage(img, x, y, w, h);
  };
  img.src = dataUrl;
}

// ============================================================
// AUTO-SAVE & RESTORE DRAFT (WITH 23:55 & DAILY AUTO-CLEAR)
// ============================================================
function getTodayDateString() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function isPastCutoffTime() {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  // Cutoff mulai pukul 23:55 (23:55:00 s.d. 23:59:59)
  return hour === 23 && minute >= 55;
}

function isDraftExpired(draft) {
  if (!draft) return false;
  // Jika draft belum memiliki field saveDate, langsung anggap kedaluwarsa (data kemarin)
  if (!draft.saveDate) return true;

  const today = getTodayDateString();
  // Jika tanggal draft bukan hari ini -> kedaluwarsa (sudah ganti hari)
  if (draft.saveDate !== today) return true;

  // Jika hari ini dan waktu sekarang sudah >= 23:55
  if (isPastCutoffTime()) return true;

  return false;
}

let saveTimer;
function autoSaveDraft() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    // Jika waktu sudah >= 23.55, jangan simpan rincian kegiatan ke cache
    if (isPastCutoffTime()) {
      return;
    }
    const payload = {
      saveDate: getTodayDateString(),
      saveTimestamp: Date.now(),
      nama: document.getElementById('nama')?.value || '',
      unit: document.getElementById('unit')?.value || '',
      mentor: document.getElementById('mentor')?.value || '',
      catatan: document.getElementById('catatan')?.value || '',
      kegiatanList: kegiatanDataStore,
      sigData: sigData
    };
    try {
      localStorage.setItem('maganghub_logbook_draft_v2', JSON.stringify(payload));
      const status = document.getElementById('sidebar-draft-status');
      if (status) {
        status.innerHTML = '<span class="draft-indicator"></span> Draft otomatis tersimpan';
      }
    } catch (e) {
      console.warn('Gagal menyimpan draft ke localStorage:', e);
    }
  }, 400);
}

function loadSavedDraft() {
  try {
    const raw = localStorage.getItem('maganghub_logbook_draft_v2');
    if (!raw) {
      addNewKegiatanUI();
      return;
    }
    const data = JSON.parse(raw);

    // Identitas peserta & unit tetap dipertahankan agar tidak perlu repot ketik ulang
    if (data.nama) document.getElementById('nama').value = data.nama;
    if (data.unit) document.getElementById('unit').value = data.unit;

    // Load mentor if not locked
    if (!isMentorLocked && data.mentor) {
      const mentorInput = document.getElementById('mentor');
      if (mentorInput) mentorInput.value = data.mentor;
    }

    const expired = isDraftExpired(data);

    if (expired) {
      // Hari baru atau sudah melewati 23:55 -> Kosongkan kegiatan, foto dokumentasi & catatan
      const list = document.getElementById('kegiatan-list');
      if (list) list.innerHTML = '';
      kegiatanCounter = 0;
      kegiatanDataStore = [];
      addNewKegiatanUI(); // Sediakan 1 baris kegiatan baru yang kosong

      const catEl = document.getElementById('catatan');
      if (catEl) catEl.value = '';

      clearSignature('peserta');
      clearSignature('mentor');
      initRealtimeDate();

      // Perbarui draft tersimpan dengan rincian kegiatan kosong
      const cleanPayload = {
        saveDate: getTodayDateString(),
        saveTimestamp: Date.now(),
        nama: document.getElementById('nama')?.value || '',
        unit: document.getElementById('unit')?.value || '',
        mentor: document.getElementById('mentor')?.value || '',
        catatan: '',
        kegiatanList: [],
        sigData: { peserta: '', mentor: '' }
      };
      localStorage.setItem('maganghub_logbook_draft_v2', JSON.stringify(cleanPayload));

      setTimeout(() => {
        showToast('Hari baru: Rincian kegiatan & foto telah dikosongkan otomatis ✨');
      }, 600);
      return;
    }

    // Jika masih di hari yang sama dan belum 23:55, muat data
    if (data.catatan) document.getElementById('catatan').value = data.catatan;

    const list = document.getElementById('kegiatan-list');
    list.innerHTML = '';
    kegiatanCounter = 0;
    kegiatanDataStore = [];

    if (data.kegiatanList && data.kegiatanList.length > 0) {
      data.kegiatanList.forEach(k => addNewKegiatanUI(k));
    } else {
      addNewKegiatanUI();
    }

    if (data.sigData) {
      sigData = data.sigData;
      ['peserta', 'mentor'].forEach(role => {
        if (sigData[role]) {
          const c = document.getElementById('sig-' + role);
          if (c) drawDataUrlToCanvas(c, sigData[role]);
        }
      });
    }
  } catch (e) {
    console.warn('Gagal memuat draft:', e);
    addNewKegiatanUI();
  }
}

// Watcher untuk mendeteksi pergantian hari atau lewat 23.55 saat tab browser dibiarkan terbuka
let lastCheckedDate = getTodayDateString();
function startDailyResetWatcher() {
  setInterval(() => {
    const today = getTodayDateString();
    const pastCutoff = isPastCutoffTime();

    if (today !== lastCheckedDate || pastCutoff) {
      const hasActivities = kegiatanDataStore.some(k => 
        (k.nama && k.nama.trim() !== '-' && k.nama.trim() !== '') || 
        (k.deskripsi && k.deskripsi.trim() !== '-' && k.deskripsi.trim() !== '') ||
        (k.fotos && k.fotos.length > 0)
      );

      if (hasActivities) {
        clearDailyActivitiesAuto();
      }
      lastCheckedDate = today;
    }
  }, 30000); // Cek tiap 30 detik
}

function clearDailyActivitiesAuto() {
  const list = document.getElementById('kegiatan-list');
  if (list) list.innerHTML = '';
  kegiatanCounter = 0;
  kegiatanDataStore = [];
  addNewKegiatanUI();

  const catatanEl = document.getElementById('catatan');
  if (catatanEl) catatanEl.value = '';

  clearSignature('peserta');
  clearSignature('mentor');
  initRealtimeDate();

  const cleanPayload = {
    saveDate: getTodayDateString(),
    saveTimestamp: Date.now(),
    nama: document.getElementById('nama')?.value || '',
    unit: document.getElementById('unit')?.value || '',
    mentor: document.getElementById('mentor')?.value || '',
    catatan: '',
    kegiatanList: [],
    sigData: { peserta: '', mentor: '' }
  };
  try {
    localStorage.setItem('maganghub_logbook_draft_v2', JSON.stringify(cleanPayload));
  } catch (e) {}

  showToast('⏰ Waktu melewati 23.55: Rincian kegiatan & foto telah dikosongkan otomatis untuk hari baru.');
}

async function resetForm() {
  const confirmed = await showCustomConfirmDialog({
    title: 'Reset Formulir Logbook?',
    message: 'Apakah Anda yakin ingin mengosongkan seluruh isian formulir logbook hari ini?',
    subtext: 'Data yang belum disimpan akan hilang dan formulir akan kembali bersih.',
    confirmText: 'Ya, Reset Form',
    cancelText: 'Batal',
    isDanger: false
  });
  if (!confirmed) return;

  const namaEl = document.getElementById('nama');
  const unitEl = document.getElementById('unit');
  const catEl = document.getElementById('catatan');

  if (namaEl) namaEl.value = '';
  if (unitEl) unitEl.value = '';
  if (catEl) catEl.value = '';

  // If mentor is NOT locked, clear mentor
  if (!isMentorLocked) {
    const mentorEl = document.getElementById('mentor');
    if (mentorEl) mentorEl.value = '';
  }

  // Refresh Realtime Day & Date
  initRealtimeDate();

  // Reset Activities
  document.getElementById('kegiatan-list').innerHTML = '';
  kegiatanCounter = 0;
  kegiatanDataStore = [];
  addNewKegiatanUI();

  // Reset signatures
  clearSignature('peserta');
  clearSignature('mentor');

  localStorage.removeItem('maganghub_logbook_draft_v2');
  showToast('Form berhasil direset' + (isMentorLocked ? ' (Nama mentor tetap tersimpan 🔒)' : ''));
}

// ============================================================
// COLLECT DATA HELPER
// ============================================================
function collectData() {
  const activeKegiatan = kegiatanDataStore.map(k => {
    const waktuMulaiEl = document.getElementById('kg-waktu-mulai-' + k.id);
    const waktuSelesaiEl = document.getElementById('kg-waktu-selesai-' + k.id);
    const namaEl = document.getElementById('kg-nama-' + k.id);
    const descEl = document.getElementById('kg-desc-' + k.id);

    const waktuMulai = waktuMulaiEl ? waktuMulaiEl.value : (k.waktuMulai || '');
    const waktuSelesai = waktuSelesaiEl ? waktuSelesaiEl.value : (k.waktuSelesai || '');
    const waktuFormatted = formatWaktuKegiatan({ waktuMulai, waktuSelesai });

    return {
      id: k.id,
      waktuMulai: waktuMulai,
      waktuSelesai: waktuSelesai,
      waktu: waktuFormatted,
      nama: namaEl ? (namaEl.value || '-') : (k.nama || '-'),
      deskripsi: descEl ? (descEl.value || '-') : (k.deskripsi || '-'),
      fotos: k.fotos || []
    };
  });

  return {
    nama: (document.getElementById('nama')?.value || '').trim() || 'Peserta Magang',
    unit: (document.getElementById('unit')?.value || '').trim() || 'Balai Bahasa Provinsi Jawa Timur',
    hari: document.getElementById('hari')?.value || 'Senin',
    tanggal: document.getElementById('tanggal')?.value || '',
    mentor: (document.getElementById('mentor')?.value || '').trim() || 'Mentor Pembimbing',
    catatan: (document.getElementById('catatan')?.value || '').trim(),
    kegiatan: activeKegiatan.length > 0 ? activeKegiatan : [
      { waktuMulai: '08:00', waktuSelesai: '16:00', waktu: '08:00 - 16:00', nama: 'Kegiatan Magang', deskripsi: 'Melaksanakan tugas magang', fotos: [] }
    ],
    sigPeserta: sigData.peserta,
    sigMentor: sigData.mentor
  };
}

function formatTanggalIndo(dateStr) {
  if (!dateStr) return '-';
  try {
    const [y, m, d] = dateStr.split('-');
    const months = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    return `${parseInt(d, 10)} ${months[parseInt(m, 10) - 1]} ${y}`;
  } catch {
    return dateStr;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttr(str) {
  if (!str) return '';
  return String(str).replace(/"/g, '&quot;');
}

// ============================================================
// RENDER DOCUMENT PREVIEW
// ============================================================
function renderPreview() {
  const data = collectData();
  const container = document.getElementById('preview-doc');
  if (!container) return;
  container.innerHTML = buildDocHTML(data);
}

function buildDocHTML(data) {
  const logoSrc = logoDataUrl || window.LOGO_BASE64 || 'assets/logo.png';

  // Table Kegiatan Rows
  const rowsHtml = data.kegiatan.map((k, idx) => {
    const descParas = escapeHtml(k.deskripsi || '')
      .split(/\n+/)
      .map(p => p.trim())
      .filter(p => p.length > 0)
      .map(p => `<p class="doc-desc-p">${p}</p>`)
      .join('') || '-';

    return `
    <tr>
      <td style="text-align:center">${idx + 1}</td>
      <td style="white-space:nowrap;font-weight:600;font-size:11px;color:#1e293b">${escapeHtml(k.waktu || formatWaktuKegiatan(k))}</td>
      <td><strong>${escapeHtml(k.nama)}</strong></td>
      <td class="kg-desc-cell">${descParas}</td>
    </tr>
  `;
  }).join('');

  // Per-Activity Photos Section
  const activitiesWithPhotos = data.kegiatan.filter(k => k.fotos && k.fotos.length > 0);

  const fotosHtml = activitiesWithPhotos.length > 0 ? `
    <div class="doc-foto-section">
      <div class="doc-section-heading">Dokumentasi Foto Per Kegiatan</div>
      ${activitiesWithPhotos.map((k, idx) => {
        const kgIdx = data.kegiatan.indexOf(k) + 1;
        return `
          <div class="doc-kg-foto-group">
            <div class="doc-kg-foto-title">
              <span class="doc-kg-foto-tag">Kegiatan #${kgIdx}</span>
              <strong>${escapeHtml(k.nama)}</strong>
              <span style="font-weight:normal;color:#666;font-size:10.5px">(${escapeHtml(k.waktu || formatWaktuKegiatan(k))})</span>
            </div>
            <div class="doc-foto-grid">
              ${k.fotos.map(f => `
                <div class="doc-foto-item">
                  <img src="${f.dataUrl}" alt="${escapeAttr(f.caption)}" />
                  <div class="doc-foto-caption">${escapeHtml(f.caption)}</div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  ` : '';

  const catatanHtml = data.catatan ? `
    <div style="margin-bottom: 20px;">
      <div class="doc-section-heading">Catatan / Evaluasi</div>
      <div class="doc-catatan-box">${escapeHtml(data.catatan).replace(/\n/g, '<br/>')}</div>
    </div>
  ` : '';

  const ttdPesertaHtml = data.sigPeserta
    ? `<img src="${data.sigPeserta}" alt="TTD Peserta" />`
    : `<div style="height: 40px;"></div>`;

  const ttdMentorHtml = data.sigMentor
    ? `<img src="${data.sigMentor}" alt="TTD Mentor" />`
    : `<div style="height: 40px;"></div>`;

  return `
    <!-- KOP SURAT RESMI KEMENDIKDASMEN -->
    <div class="doc-kop">
      <img src="${logoSrc}" alt="Logo Kemendikdasmen" class="doc-kop-logo" id="preview-kop-logo" />
      <div class="doc-kop-text">
        <div class="doc-kop-instansi">KEMENTERIAN PENDIDIKAN DASAR DAN MENENGAH</div>
        <div class="doc-kop-sub">BALAI BAHASA PROVINSI JAWA TIMUR</div>
        <div class="doc-kop-address">
          Jl. Gebang Putih No.10, Keputih, Kec. Sukolilo, Surabaya, Jawa Timur 60117<br/>
          Telepon: 0851-8686-5972 | Laman: https://balaibahasajatim.kemendikdasmen.go.id/
        </div>
      </div>
    </div>
    <div class="doc-kop-divider"></div>

    <!-- JUDUL LOGBOOK -->
    <div class="doc-title-bar">
      <div class="doc-main-title">LOGBOOK HARIAN PESERTA MAGANG</div>
      <div class="doc-sub-title">Program MagangHub Kemendikdasmen RI</div>
    </div>

    <!-- BODY CONTENT -->
    <div class="doc-body-inner">
      <!-- DATA PESERTA -->
      <table class="doc-table-info">
        <tr>
          <td>Nama Peserta Magang</td>
          <td>:</td>
          <td><strong>${escapeHtml(data.nama)}</strong></td>
        </tr>
        <tr>
          <td>Unit Kerja / Divisi</td>
          <td>:</td>
          <td>${escapeHtml(data.unit)}</td>
        </tr>
        <tr>
          <td>Hari / Tanggal</td>
          <td>:</td>
          <td><strong>${escapeHtml(data.hari)}</strong>, ${formatTanggalIndo(data.tanggal)}</td>
        </tr>
        <tr>
          <td>Nama Mentor</td>
          <td>:</td>
          <td>${escapeHtml(data.mentor)}</td>
        </tr>
      </table>

      <!-- RINCIAN KEGIATAN -->
      <div class="doc-section-heading">Rincian Kegiatan Harian</div>
      <table class="kegiatan-table">
        <thead>
          <tr>
            <th style="width:36px;text-align:center">No</th>
            <th style="width:115px;white-space:nowrap">Waktu Kegiatan</th>
            <th style="width:170px">Nama Kegiatan</th>
            <th>Deskripsi Rinci Pekerjaan</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <!-- FOTO DOKUMENTASI PER KEGIATAN & CATATAN -->
      ${fotosHtml}
      ${catatanHtml}

      <!-- TANDA TANGAN / PENGESAHAN -->
      <div class="doc-footer-sign">
        <div class="sign-col">
          <div class="sign-role">Peserta Magang,</div>
          <div class="sign-img-wrapper">${ttdPesertaHtml}</div>
          <div class="sign-line"></div>
          <div class="sign-name">${escapeHtml(data.nama)}</div>
          <div class="sign-id">Peserta Magang</div>
        </div>

        <div class="sign-col">
          <div class="sign-role">Surabaya, ${formatTanggalIndo(data.tanggal)}<br/>Mengetahui, Mentor</div>
          <div class="sign-img-wrapper">${ttdMentorHtml}</div>
          <div class="sign-line"></div>
          <div class="sign-name">${escapeHtml(data.mentor)}</div>
          <div class="sign-id">Mentor Pembimbing</div>
        </div>
      </div>
    </div>
  `;
}

// ============================================================
// UNIFIED PDF GENERATOR (ZERO SCROLL OFFSET & SAFE PAGE BREAKS)
// ============================================================
async function generatePDFBlob(data) {
  if (typeof html2pdf !== 'function') {
    throw new Error('Library html2pdf belum siap. Pastikan terhubung ke internet dan refresh browser.');
  }

  // 1. Render data into the actual preview DOM element
  renderPreview();

  const tabPreview = document.getElementById('tab-preview');
  const el = document.getElementById('preview-doc');
  if (!el || !tabPreview) {
    throw new Error('Elemen dokumen tidak ditemukan.');
  }

  const cleanNama = (data.nama || 'Peserta').replace(/[^a-zA-Z0-9]/g, '_');
  const cleanDate = (data.tanggal || new Date().toISOString().split('T')[0]);
  const fileName = `Logbook_${cleanNama}_${cleanDate}.pdf`;

  // 2. Check if tab-preview is hidden (e.g. user is on Storage tab or Form tab)
  const wasHidden = window.getComputedStyle(tabPreview).display === 'none';
  const prevScrollY = window.scrollY;

  // 3. If hidden, temporarily display tab-preview so html2canvas has real dimensions and styles
  if (wasHidden) {
    tabPreview.style.display = 'block';
    tabPreview.style.position = 'fixed';
    tabPreview.style.top = '0';
    tabPreview.style.left = '0';
    tabPreview.style.width = '100%';
    tabPreview.style.zIndex = '9999';
    tabPreview.style.background = '#ffffff';
    tabPreview.style.pointerEvents = 'none';
  }

  // 4. Ensure scroll is at 0 so html2canvas doesn't create empty space at top
  window.scrollTo(0, 0);

  // Allow reflow and images to finish layout
  await new Promise(r => setTimeout(r, 200));

  const opt = {
    margin: [10, 10, 10, 10],
    filename: fileName,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      scrollX: 0,
      scrollY: 0
    },
    pagebreak: { mode: ['css', 'legacy'] },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  try {
    const pdfBlob = await html2pdf().set(opt).from(el).outputPdf('blob');
    return { blob: pdfBlob, fileName };
  } finally {
    // 5. Cleanly restore tab-preview and previous scroll position
    if (wasHidden) {
      tabPreview.style.display = '';
      tabPreview.style.position = '';
      tabPreview.style.top = '';
      tabPreview.style.left = '';
      tabPreview.style.width = '';
      tabPreview.style.zIndex = '';
      tabPreview.style.background = '';
      tabPreview.style.pointerEvents = '';
    }
    window.scrollTo(0, prevScrollY);
  }
}

async function exportPDF() {
  const btn = document.getElementById('btn-pdf');
  const origText = btn.innerHTML;
  btn.disabled = true;
  btn.textContent = 'Membuat PDF...';

  try {
    const data = collectData();
    const { blob, fileName } = await generatePDFBlob(data);
    const success = await downloadBlob(blob, fileName, 'application/pdf');
    if (success !== false) {
      showToast('PDF berhasil diunduh: ' + fileName);
    }
  } catch (err) {
    console.error('Export PDF error:', err);
    showToast('Gagal export PDF: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = origText;
  }
}

// ============================================================
// EXPORT TO WORD (.DOCX) WITH LOGO & PER-ACTIVITY PHOTOS
// ============================================================
async function generateWordBlob(data) {
  const docxLib = window.docx;
  if (!docxLib) {
    throw new Error('Library docx belum selesai dimuat dari CDN. Silakan pastikan koneksi internet aktif lalu coba lagi.');
  }

  const {
    Document, Paragraph, Table, TableRow, TableCell, TextRun,
    AlignmentType, WidthType, BorderStyle, ShadingType, Packer, ImageRun
  } = docxLib;

  const hdrStyle = {
    shading: { type: ShadingType.CLEAR, fill: '0D47A1' },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: '0D47A1' },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: '0D47A1' },
      left: { style: BorderStyle.SINGLE, size: 1, color: '0D47A1' },
      right: { style: BorderStyle.SINGLE, size: 1, color: '0D47A1' }
    }
  };

  const kgHdrRow = new TableRow({
    children: ['No', 'Waktu', 'Nama Kegiatan', 'Deskripsi Rinci Pekerjaan'].map((h, idx) =>
      new TableCell({
        ...hdrStyle,
        children: [new Paragraph({
          children: [new TextRun({ text: h, bold: true, color: 'FFFFFF', size: 20 })],
          alignment: idx === 0 ? AlignmentType.CENTER : AlignmentType.LEFT
        })],
        width: { size: [6, 18, 28, 48][idx], type: WidthType.PERCENTAGE }
      })
    )
  });

  const kgDataRows = data.kegiatan.map((k, i) => new TableRow({
    children: [
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: String(i + 1), size: 19 })], alignment: AlignmentType.CENTER })],
        width: { size: 6, type: WidthType.PERCENTAGE }
      }),
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: k.waktu || formatWaktuKegiatan(k) || '-', bold: true, size: 19 })] })],
        width: { size: 18, type: WidthType.PERCENTAGE }
      }),
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: k.nama || '-', bold: true, size: 19 })] })],
        width: { size: 28, type: WidthType.PERCENTAGE }
      }),
      new TableCell({
        children: [new Paragraph({
          children: [new TextRun({ text: k.deskripsi || '-', size: 19 })],
          alignment: AlignmentType.JUSTIFIED
        })],
        width: { size: 48, type: WidthType.PERCENTAGE }
      })
    ]
  }));

  const infoRows = [
    ['Nama Peserta Magang', data.nama],
    ['Unit Kerja / Divisi', data.unit],
    ['Hari / Tanggal', `${data.hari}, ${formatTanggalIndo(data.tanggal)}`],
    ['Nama Mentor', data.mentor]
  ].map(([label, val]) => new TableRow({
    children: [
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 20 })] })],
        width: { size: 30, type: WidthType.PERCENTAGE },
        borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } }
      }),
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: ':', size: 20 })] })],
        width: { size: 3, type: WidthType.PERCENTAGE },
        borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } }
      }),
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: val, size: 20 })] })],
        width: { size: 67, type: WidthType.PERCENTAGE },
        borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } }
      })
    ]
  }));

  // Embed Logo Image in Word Header
  const kopParagraphs = [];
  if (logoArrayBuffer) {
    try {
      kopParagraphs.push(
        new Paragraph({
          children: [
            new ImageRun({
              data: logoArrayBuffer,
              transformation: { width: 340, height: 68 },
              type: 'png'
            })
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 }
        })
      );
    } catch (e) {
      console.warn('Word logo image skip:', e);
    }
  }

  kopParagraphs.push(
    new Paragraph({
      children: [new TextRun({ text: 'KEMENTERIAN PENDIDIKAN DASAR DAN MENENGAH', bold: true, size: 24, color: '0D47A1' })],
      alignment: AlignmentType.CENTER
    }),
    new Paragraph({
      children: [new TextRun({ text: 'BALAI BAHASA PROVINSI JAWA TIMUR', bold: true, size: 22, color: '1A237E' })],
      alignment: AlignmentType.CENTER
    }),
    new Paragraph({
      children: [new TextRun({ text: 'Jl. Gebang Putih No.10, Keputih, Kec. Sukolilo, Surabaya, Jawa Timur 60117 | Telp: 0851-8686-5972 | Laman: https://balaibahasajatim.kemendikdasmen.go.id/', size: 18, color: '666666' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 }
    })
  );

  // Per-Activity Photos
  const fotoParagraphs = [];
  const activitiesWithPhotos = data.kegiatan.filter(k => k.fotos && k.fotos.length > 0);

  if (activitiesWithPhotos.length > 0) {
    fotoParagraphs.push(
      new Paragraph({
        children: [new TextRun({ text: 'DOKUMENTASI FOTO PER RINCIAN KEGIATAN', bold: true, size: 22, color: '0D47A1' })],
        spacing: { before: 260, after: 120 }
      })
    );

    for (const k of activitiesWithPhotos) {
      const kgIdx = data.kegiatan.indexOf(k) + 1;
      fotoParagraphs.push(
        new Paragraph({
          children: [
            new TextRun({ text: `[ Kegiatan #${kgIdx} ] `, bold: true, size: 20, color: '0D47A1' }),
            new TextRun({ text: `${k.nama} (${k.waktu})`, bold: true, size: 20 })
          ],
          spacing: { before: 180, after: 80 }
        })
      );

      for (const f of k.fotos) {
        try {
          const buf = dataUrlToArrayBuffer(f.dataUrl);
          if (!buf) continue;
          fotoParagraphs.push(
            new Paragraph({
              children: [
                new ImageRun({
                  data: buf,
                  transformation: { width: 380, height: 260 },
                  type: 'jpeg'
                })
              ],
              alignment: AlignmentType.CENTER,
              spacing: { before: 80 }
            }),
            new Paragraph({
              children: [new TextRun({ text: f.caption, size: 17, italics: true, color: '555555' })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 160 }
            })
          );
        } catch (e) {
          console.warn('Word photo skip:', e);
        }
      }
    }
  }

  // Notes
  const catatanParagraphs = [];
  if (data.catatan) {
    catatanParagraphs.push(
      new Paragraph({
        children: [new TextRun({ text: 'CATATAN / EVALUASI', bold: true, size: 22, color: '0D47A1' })],
        spacing: { before: 240, after: 100 }
      }),
      new Paragraph({
        children: [new TextRun({ text: data.catatan, size: 20 })],
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 200 }
      })
    );
  }

  // Tanda Tangan in Word
  const pesertaChildren = [
    new Paragraph({ children: [new TextRun({ text: 'Peserta Magang,', size: 20 })], alignment: AlignmentType.CENTER })
  ];
  if (data.sigPeserta) {
    try {
      const buf = dataUrlToArrayBuffer(data.sigPeserta);
      if (buf) {
        pesertaChildren.push(
          new Paragraph({
            children: [new ImageRun({ data: buf, transformation: { width: 140, height: 60 }, type: 'png' })],
            alignment: AlignmentType.CENTER
          })
        );
      } else {
        pesertaChildren.push(new Paragraph({ spacing: { before: 600 } }));
      }
    } catch {
      pesertaChildren.push(new Paragraph({ spacing: { before: 600 } }));
    }
  } else {
    pesertaChildren.push(new Paragraph({ spacing: { before: 600 } }));
  }
  pesertaChildren.push(
    new Paragraph({ children: [new TextRun({ text: '( ' + data.nama + ' )', bold: true, size: 20 })], alignment: AlignmentType.CENTER }),
    new Paragraph({ children: [new TextRun({ text: 'Peserta Magang', size: 18 })], alignment: AlignmentType.CENTER })
  );

  const mentorChildren = [
    new Paragraph({ children: [new TextRun({ text: `Surabaya, ${formatTanggalIndo(data.tanggal)}`, size: 20 })], alignment: AlignmentType.CENTER }),
    new Paragraph({ children: [new TextRun({ text: 'Mengetahui, Mentor', size: 20 })], alignment: AlignmentType.CENTER })
  ];
  if (data.sigMentor) {
    try {
      const buf = dataUrlToArrayBuffer(data.sigMentor);
      if (buf) {
        mentorChildren.push(
          new Paragraph({
            children: [new ImageRun({ data: buf, transformation: { width: 140, height: 60 }, type: 'png' })],
            alignment: AlignmentType.CENTER
          })
        );
      } else {
        mentorChildren.push(new Paragraph({ spacing: { before: 600 } }));
      }
    } catch {
      mentorChildren.push(new Paragraph({ spacing: { before: 600 } }));
    }
  } else {
    mentorChildren.push(new Paragraph({ spacing: { before: 600 } }));
  }
  mentorChildren.push(
    new Paragraph({ children: [new TextRun({ text: '( ' + data.mentor + ' )', bold: true, size: 20 })], alignment: AlignmentType.CENTER }),
    new Paragraph({ children: [new TextRun({ text: 'Mentor Pembimbing', size: 18 })], alignment: AlignmentType.CENTER })
  );

  const signTable = new Table({
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: pesertaChildren,
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } }
          }),
          new TableCell({
            children: mentorChildren,
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } }
          })
        ]
      })
    ],
    width: { size: 100, type: WidthType.PERCENTAGE }
  });

  const doc = new Document({
    creator: 'MagangHub Kemendikdasmen',
    title: `Logbook Magang - ${data.nama}`,
    sections: [{
      properties: {
        page: {
          margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 }
        }
      },
      children: [
        ...kopParagraphs,
        new Paragraph({
          children: [new TextRun({ text: 'LOGBOOK HARIAN PESERTA MAGANG', bold: true, size: 26, color: 'FFFFFF' })],
          alignment: AlignmentType.CENTER,
          shading: { type: ShadingType.CLEAR, fill: '0D47A1' },
          spacing: { before: 120, after: 240 }
        }),
        new Paragraph({
          children: [new TextRun({ text: 'DATA PESERTA', bold: true, size: 22, color: '0D47A1' })],
          spacing: { after: 100 }
        }),
        new Table({ rows: infoRows, width: { size: 100, type: WidthType.PERCENTAGE } }),
        new Paragraph({
          children: [new TextRun({ text: 'RINCIAN KEGIATAN HARIAN', bold: true, size: 22, color: '0D47A1' })],
          spacing: { before: 240, after: 100 }
        }),
        new Table({ rows: [kgHdrRow, ...kgDataRows], width: { size: 100, type: WidthType.PERCENTAGE } }),
        ...fotoParagraphs,
        ...catatanParagraphs,
        new Paragraph({ spacing: { before: 300 } }),
        signTable
      ]
    }]
  });

  return await Packer.toBlob(doc);
}

async function exportWord() {
  const btn = document.getElementById('btn-word');
  const origText = btn.innerHTML;
  btn.disabled = true;
  btn.textContent = 'Membuat Word...';

  try {
    const data = collectData();
    const cleanNama = data.nama.replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `Logbook_${cleanNama}_${data.tanggal || 'tanggal'}.docx`;

    const blob = await generateWordBlob(data);
    const success = await downloadBlob(blob, fileName, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    if (success !== false) {
      showToast('Dokumen Word berhasil diunduh: ' + fileName);
    }
  } catch (err) {
    console.error('Export Word error:', err);
    showToast('Gagal export Word: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = origText;
  }
}

// ============================================================
// STORAGE HUB & MULTI-FOLDER MANAGER FOR 33 INTERNS
// ============================================================
let storageFolders = [];
let storageFiles = [];
let currentActiveFolderId = null;

// Official Default Google Apps Script URL for all 33 interns
const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbx305dI0GvWD682LGaj39_f0vd0rRHZXLL_4rDexzz0NeqHkqPGEO7VOvddkGvkPvei/exec';

// Real default folder for Marcello (no more dummy folders)
const DEFAULT_FOLDERS = [
  { id: 'f-marcello', name: 'Marcello Ilham - Tim Pelindungan', createdAt: '2026-10-26' }
];

function getGasWebhookUrl() {
  const inputEl = document.getElementById('gas-webhook-url');
  const fromInput = inputEl ? inputEl.value.trim() : '';
  const fromStorage = (localStorage.getItem('gas_webhook_url') || '').trim();
  // Jika URL di storage masih versi lama (AKfycbw3lng...), otomatis gantikan ke DEFAULT_GAS_URL baru
  if (fromStorage.includes('AKfycbw3lngPgPRjMGFCTQCaNcMxRKXp4iBEsnXBMVslLQmCH7aZhzOUG-1AcI5BGaElZPVl') || !fromStorage) {
    localStorage.setItem('gas_webhook_url', DEFAULT_GAS_URL);
    return DEFAULT_GAS_URL;
  }
  return fromInput || fromStorage || DEFAULT_GAS_URL;
}

let cloudSyncInterval = null;
let lastCloudSyncTime = 0;
const CLOUD_SYNC_INTERVAL_MS = 30000; // Sinkronisasi otomatis tiap 30 detik

function initStorageHub() {
  loadSavedDriveConfigs();
  loadStorageData();
  renderStorageFolders();
  // Sinkronisasi pertama saat halaman dimuat
  syncStorageWithCloud(true);
  // Mulai auto-sync periodik setiap 30 detik
  startCloudAutoSync();
}

function startCloudAutoSync() {
  if (cloudSyncInterval) clearInterval(cloudSyncInterval);
  cloudSyncInterval = setInterval(() => {
    const url = getGasWebhookUrl();
    if (url) {
      syncStorageWithCloud(true);
    }
  }, CLOUD_SYNC_INTERVAL_MS);
}

function updateSyncStatusUI(status, customMsg = '') {
  const indicator = document.getElementById('sync-live-indicator');
  const lastSyncEl = document.getElementById('sync-last-time');
  const statusText = document.getElementById('sync-status-text');
  if (indicator) {
    indicator.className = 'sync-dot ' + (status === 'ok' ? 'sync-dot-ok' : status === 'syncing' ? 'sync-dot-syncing' : 'sync-dot-error');
  }
  if (lastSyncEl) {
    if (status === 'ok') {
      const now = new Date();
      lastSyncEl.textContent = `Tersinkron: ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
      lastSyncEl.style.color = '#10b981';
      if (statusText) statusText.textContent = 'Sinkronisasi Cloud Realtime (Aktif)';
    } else if (status === 'error') {
      lastSyncEl.textContent = customMsg || '⚠️ Gagal sinkron • Skrip perlu update (Klik)';
      lastSyncEl.style.color = '#ef4444';
      if (statusText) statusText.textContent = 'Sinkronisasi Terkendala (Klik untuk panduan)';
    } else if (status === 'syncing') {
      lastSyncEl.textContent = 'Menghubungkan ke cloud...';
      lastSyncEl.style.color = '#64748b';
      if (statusText) statusText.textContent = 'Sedang sinkronisasi...';
    }
  }
}

function handleSyncBarClick() {
  const ind = document.getElementById('sync-live-indicator');
  if (ind && ind.classList.contains('sync-dot-error')) {
    showScriptUpdateRequiredPopup();
  } else {
    syncStorageWithCloud(false);
  }
}

function showScriptUpdateRequiredPopup() {
  showCustomConfirmDialog({
    title: '⚠️ Skrip Google Drive Perlu Diperbarui (1 Menit)',
    message: `
      Google Apps Script di <strong style="color:var(--primary);">script.google.com</strong> masih versi lama, sehingga laptop teman Anda belum bisa mengambil folder &amp; dokumen dari cloud.<br/><br/>
      <strong>Langkah Cepat (1 Menit):</strong><br/>
      1. Klik tombol <strong>Buka Panduan &amp; Salin Kode</strong> di bawah ini<br/>
      2. Buka project Anda di <strong>script.google.com</strong>, hapus kode lama dan tempel kode baru<br/>
      3. Klik <strong>Deploy &gt; Manage deployments &gt; Edit (Pensil) &gt; Version: New version &gt; Deploy</strong>!
    `,
    subtext: 'Setelah diperbarui, data folder dan logbook akan langsung sama persis di seluruh 33 laptop peserta!',
    confirmText: 'Buka Panduan & Salin Kode',
    cancelText: 'Tutup',
    isDanger: false
  }).then(ok => {
    if (ok) {
      openScriptModal();
    }
  });
}

function loadSavedDriveConfigs() {
  const currentUrl = getGasWebhookUrl();
  const el = document.getElementById('gas-webhook-url');
  if (el) el.value = currentUrl;
  const hint = document.getElementById('storage-sync-hint');
  if (hint) {
    hint.textContent = '✓ Google Apps Script terhubung otomatis untuk seluruh 33 peserta magang.';
  }
}

function saveScriptUrl() {
  const val = (document.getElementById('gas-webhook-url')?.value || '').trim() || DEFAULT_GAS_URL;
  localStorage.setItem('gas_webhook_url', val);
  const hint = document.getElementById('storage-sync-hint');
  if (val) {
    if (hint) hint.textContent = '✓ Google Apps Script terhubung! Berkas akan otomatis masuk ke folder Google Drive koordinator.';
    showToast('Koneksi Google Apps Script disimpan!');
    syncStorageWithCloud(false);
  } else {
    if (hint) hint.textContent = 'URL tersimpan di browser. Jika belum diisi, website otomatis menyimpan berkas di Storage Lokal Website.';
  }
}

async function testAppsScriptConnection() {
  const url = getGasWebhookUrl();
  if (!url) {
    showToast('Masukkan URL Google Apps Script terlebih dahulu!');
    return;
  }
  const btn = document.getElementById('btn-test-gas');
  const origText = btn ? btn.textContent : '';
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Mengetes...';
  }

  try {
    const resp = await fetch(url, {
      method: 'POST',
      mode: 'cors',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'getSyncData' })
    });
    const result = await resp.json();
    if (result && result.success) {
      showToast('✅ Berhasil terhubung ke Google Apps Script!');
      updateSyncStatusUI('ok');
    } else {
      throw new Error(result ? (result.error || 'Skrip masih versi lama') : 'Skrip masih versi lama');
    }
  } catch (err) {
    console.error('Test connection error:', err);
    showScriptUpdateRequiredPopup();
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = origText;
    }
  }
}

async function syncStorageWithCloud(silent = true) {
  const url = getGasWebhookUrl();
  if (!url) return;

  // Cegah race condition: jika sync sudah berjalan dalam 3 detik terakhir, skip
  const now = Date.now();
  if (silent && (now - lastCloudSyncTime) < 3000) return;
  lastCloudSyncTime = now;

  updateSyncStatusUI('syncing');

  const btn = document.getElementById('btn-sync-storage');
  const origHtml = btn ? btn.innerHTML : '';
  if (btn && !silent) {
    btn.disabled = true;
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 11-.57-8.38l5.67-5.67"/></svg>
      <span>Sinkronisasi...</span>
    `;
  }

  try {
    // Gunakan POST text/plain agar kompatibel penuh dengan Google Apps Script tanpa CORS preflight
    const resp = await fetch(url, {
      method: 'POST',
      mode: 'cors',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'getSyncData' })
    });
    const res = await resp.json();
    if (res && res.success) {
      let changed = false;

      // =====================================================================
      // FOLDER SYNC: Google Drive adalah Pusat Tunggal (Single Source of Truth)
      // Hanya tampilkan folder resmi yang ada di Google Drive koordinator
      // =====================================================================
      if (Array.isArray(res.folders)) {
        const cloudFolderMap = new Map();

        // Otomatis bersihkan jika ada folder 'Umum' di Google Drive
        const umumFolder = res.folders.find(f => f && f.name && f.name.toLowerCase().trim() === 'umum');
        if (umumFolder && url) {
          fetch(url, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'deleteFolder', folderId: umumFolder.id, folderName: umumFolder.name })
          }).catch(() => {});
        }

        res.folders.forEach(f => {
          if (f && f.name && !['f-1', 'f-2', 'f-3', 'f-4'].includes(f.id)) {
            const k = f.name.toLowerCase().trim();
            // Abaikan folder 'Umum' agar tidak pernah tampil di website
            if (k === 'umum') return;
            // Cegah duplikasi jika ada folder kembar di Drive
            if (!cloudFolderMap.has(k)) {
              cloudFolderMap.set(k, {
                id: f.id,
                name: f.name.trim(),
                createdAt: f.createdAt || 'Google Drive'
              });
            }
          }
        });

        // Pertahankan folder lokal HANYA jika baru dibuat dalam 15 detik terakhir (sedang proses dibuat ke Drive)
        const nowMs = Date.now();
        storageFolders.forEach(f => {
          if (f && f.id && String(f.id).startsWith('f-') && f.createdAtMs && (nowMs - f.createdAtMs < 15000)) {
            const k = f.name.toLowerCase().trim();
            if (!cloudFolderMap.has(k)) {
              cloudFolderMap.set(k, f);
            }
          }
        });

        const newFolders = Array.from(cloudFolderMap.values());
        newFolders.sort((a, b) => a.name.localeCompare(b.name));

        const oldKeys = storageFolders.map(f => (f.id || '') + '::' + (f.name || '')).sort().join('|');
        const newKeys = newFolders.map(f => (f.id || '') + '::' + (f.name || '')).sort().join('|');

        if (oldKeys !== newKeys) {
          changed = true;
          storageFolders = newFolders;
          saveStorageFolders();
        }
      }

      // =====================================================================
      // FILE SYNC: Google Drive adalah Pusat Tunggal (Single Source of Truth)
      // =====================================================================
      if (Array.isArray(res.files)) {
        const cloudFileMap = new Map();

        res.files.forEach(c => {
          if (!c || (!c.fileName && !c.name)) return;
          const fname = (c.fileName || c.name || '').trim();
          const ext = fname.toLowerCase().endsWith('.docx') ? 'docx' : 'pdf';
          const fileId = c.id || ('file-' + fname);

          cloudFileMap.set(fileId, {
            id: fileId,
            folderId: c.folderId,
            folderName: (c.folderName || '').trim(),
            fileName: fname,
            format: c.format || ext,
            uploadDate: c.uploadDate || c.date || '',
            url: c.url,
            size: c.size,
            isCloud: true
          });
        });

        // Pertahankan berkas lokal HANYA jika berkas offline murni (bukan cloud)
        storageFiles.forEach(lf => {
          if (lf && lf.url && lf.url.startsWith('data:') && !lf.isCloud) {
            cloudFileMap.set(lf.id, lf);
          }
        });

        const newFiles = Array.from(cloudFileMap.values());
        const oldFileKeys = storageFiles.map(f => f.id).sort().join('|');
        const newFileKeys = newFiles.map(f => f.id).sort().join('|');

        if (oldFileKeys !== newFileKeys) {
          changed = true;
          storageFiles = newFiles;
          saveStorageFiles();
        }
      }

      if (changed) {
        renderStorageFolders();
        if (currentActiveFolderId) {
          renderFolderFiles(currentActiveFolderId);
        }
      } else {
        // Selalu refresh tampilan folder aktif agar jumlah berkas update
        if (currentActiveFolderId) {
          renderFolderFiles(currentActiveFolderId);
        }
      }

      updateSyncStatusUI('ok');
      if (!silent) showToast('✅ Data folder dan berkas berhasil disinkronkan dari Google Drive!');
    } else {
      const errMsg = (res && res.error) ? String(res.error) : 'Respon cloud tidak sesuai';
      console.warn('Sync storage note:', errMsg);
      updateSyncStatusUI('error', '⚠️ Skrip Google Drive belum di-update (Klik)');
      if (!silent) {
        showScriptUpdateRequiredPopup();
      }
    }
  } catch (err) {
    console.warn('Sync storage note:', err);
    updateSyncStatusUI('error', 'Gagal terhubung ke cloud (Klik)');
    if (!silent) {
      showScriptUpdateRequiredPopup();
    }
  } finally {
    if (btn && !silent) {
      btn.disabled = false;
      btn.innerHTML = origHtml;
    }
  }
}

function toggleStorageAdminSettings() {
  const card = document.getElementById('storage-admin-card');
  if (!card) return;
  card.style.display = (card.style.display === 'none' || !card.style.display) ? 'block' : 'none';
}

function loadStorageData() {
  try {
    const savedFolders = localStorage.getItem('maganghub_storage_folders');
    if (savedFolders) {
      let parsed = JSON.parse(savedFolders);
      // Clean up legacy dummy folders (f-1, f-2, f-3, f-4) dan folder 'umum'
      parsed = parsed.filter(f => f && f.name && !['f-1', 'f-2', 'f-3', 'f-4'].includes(f.id) && f.name.toLowerCase().trim() !== 'umum');
      if (parsed.length === 0) {
        parsed = [...DEFAULT_FOLDERS];
      }
      storageFolders = parsed;
      saveStorageFolders();
    } else {
      storageFolders = [...DEFAULT_FOLDERS];
      saveStorageFolders();
    }
  } catch {
    storageFolders = [...DEFAULT_FOLDERS];
  }

  try {
    const savedFiles = localStorage.getItem('maganghub_storage_files');
    let parsedFiles = savedFiles ? JSON.parse(savedFiles) : [];
    // Hapus file rusak / sampah yang namanya kosong
    parsedFiles = parsedFiles.filter(f => f && (f.fileName || f.name) && (f.fileName || f.name).trim() !== '');
    parsedFiles.forEach(f => {
      if (!f.fileName && f.name) f.fileName = f.name;
      if (!f.uploadDate && f.date) f.uploadDate = f.date;
      const fn = f.fileName || '';
      if (!f.format) f.format = fn.toLowerCase().endsWith('.docx') ? 'docx' : 'pdf';
    });
    storageFiles = parsedFiles;
    saveStorageFiles();
  } catch {
    storageFiles = [];
  }
}

function saveStorageFolders() {
  localStorage.setItem('maganghub_storage_folders', JSON.stringify(storageFolders));
}

function saveStorageFiles() {
  localStorage.setItem('maganghub_storage_files', JSON.stringify(storageFiles));
}

function renderStorageFolders(query = '') {
  const grid = document.getElementById('folders-grid');
  const emptyState = document.getElementById('folders-empty-state');
  if (!grid) return;

  const q = (query || '').toLowerCase().trim();
  const filtered = storageFolders.filter(f => f && f.name && f.name.toLowerCase().trim() !== 'umum' && f.name.toLowerCase().includes(q));

  if (filtered.length === 0) {
    grid.innerHTML = '';
    if (emptyState) emptyState.style.display = 'block';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';

  grid.innerHTML = filtered.map(folder => {
    const fileCount = storageFiles.filter(f => f.folderId === folder.id || (f.folderName && folder.name && f.folderName.toLowerCase().trim() === folder.name.toLowerCase().trim())).length;
    return `
      <div class="folder-card" onclick="openFolderView('${folder.id}')">
        <div class="folder-card-top">
          <div class="folder-card-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
          </div>
          <div class="folder-card-body">
            <div class="folder-card-title" title="${escapeHtml(folder.name)}">${escapeHtml(folder.name)}</div>
            <div class="folder-card-meta">Dibuat: ${folder.createdAt || 'Hari ini'}</div>
          </div>
        </div>
        <div class="folder-card-bottom">
          <span class="folder-card-badge">${fileCount} Dokumen</span>
          <span>Klik untuk buka &rarr;</span>
        </div>
      </div>
    `;
  }).join('');
}

function handleStorageSearch(val) {
  renderStorageFolders(val);
}

// Modal Create Folder
function openCreateFolderModal() {
  const modal = document.getElementById('create-folder-modal');
  const input = document.getElementById('new-folder-name-input');
  if (input) {
    const activeName = (document.getElementById('nama')?.value || '').trim();
    const activeUnit = (document.getElementById('unit')?.value || '').trim();
    if (activeName && !input.value) {
      input.value = activeUnit ? `${activeName} - ${activeUnit}` : activeName;
    }
  }
  if (modal) modal.classList.add('open');
  if (input) setTimeout(() => input.focus(), 150);
}

function closeCreateFolderModal(e) {
  if (e && e.target !== e.currentTarget && !e.target.classList.contains('modal-close') && !e.target.classList.contains('btn-secondary')) return;
  const modal = document.getElementById('create-folder-modal');
  if (modal) modal.classList.remove('open');
}

function fillFolderSuggestion(txt) {
  const input = document.getElementById('new-folder-name-input');
  if (input) {
    input.value = txt;
    input.focus();
  }
}

function confirmCreateFolder() {
  const input = document.getElementById('new-folder-name-input');
  const name = (input?.value || '').trim();
  if (!name) {
    showToast('Masukkan nama folder peserta!');
    if (input) input.focus();
    return;
  }

  const exists = storageFolders.some(f => f.name.toLowerCase().trim() === name.toLowerCase().trim());
  if (exists) {
    showToast('Folder dengan nama ini sudah ada!');
    return;
  }

  const newFolder = {
    id: 'f-' + Date.now(),
    name: name,
    createdAt: new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' }),
    createdAtMs: Date.now()
  };

  storageFolders.unshift(newFolder);
  saveStorageFolders();
  closeCreateFolderModal();
  renderStorageFolders();
  showToast(`Folder "${name}" berhasil dibuat! 📁`);

  // Cloud sync to Google Drive & GAS properties
  const webhookUrl = getGasWebhookUrl();
  if (webhookUrl) {
    fetch(webhookUrl, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'createFolder', folderName: name })
    }).then(r => r.json()).then(res => {
      if (res.success && res.folder) {
        newFolder.id = res.folder.id || newFolder.id;
        saveStorageFolders();
        renderStorageFolders();
        setTimeout(() => syncStorageWithCloud(true), 1500);
      }
    }).catch(err => console.warn('Cloud folder create error:', err));
  }

  openFolderView(newFolder.id);
}

// Navigation between All Folders and Inside Folder
function showAllFoldersView() {
  currentActiveFolderId = null;
  const foldersView = document.getElementById('storage-folders-view');
  const contentView = document.getElementById('storage-folder-content-view');
  const breadcrumbHome = document.getElementById('breadcrumb-home');
  const breadcrumbSep = document.getElementById('breadcrumb-sep');
  const breadcrumbCur = document.getElementById('breadcrumb-current-folder');
  const resultBanner = document.getElementById('storage-result-banner');

  if (foldersView) foldersView.style.display = 'block';
  if (contentView) contentView.style.display = 'none';
  if (breadcrumbHome) breadcrumbHome.classList.add('active');
  if (breadcrumbSep) breadcrumbSep.style.display = 'none';
  if (breadcrumbCur) breadcrumbCur.style.display = 'none';
  if (resultBanner) resultBanner.style.display = 'none';

  renderStorageFolders();
}

function openFolderView(folderId) {
  const folder = storageFolders.find(f => f.id === folderId);
  if (!folder) return;

  currentActiveFolderId = folderId;
  const foldersView = document.getElementById('storage-folders-view');
  const contentView = document.getElementById('storage-folder-content-view');
  const breadcrumbHome = document.getElementById('breadcrumb-home');
  const breadcrumbSep = document.getElementById('breadcrumb-sep');
  const breadcrumbCur = document.getElementById('breadcrumb-current-folder');
  const breadcrumbName = document.getElementById('breadcrumb-folder-name');
  const titleEl = document.getElementById('active-folder-title');
  const resultBanner = document.getElementById('storage-result-banner');

  if (foldersView) foldersView.style.display = 'none';
  if (contentView) contentView.style.display = 'block';
  if (breadcrumbHome) breadcrumbHome.classList.remove('active');
  if (breadcrumbSep) breadcrumbSep.style.display = 'inline';
  if (breadcrumbCur) breadcrumbCur.style.display = 'inline-flex';
  if (breadcrumbName) breadcrumbName.textContent = folder.name;
  if (titleEl) titleEl.textContent = folder.name;
  if (resultBanner) resultBanner.style.display = 'none';

  updateStorageFormSummary();
  renderFolderFiles(folderId);
}

function updateStorageFormSummary() {
  const namaVal = (document.getElementById('nama')?.value || '').trim() || '(Nama belum diisi di Form)';
  const tglVal = (document.getElementById('tanggal')?.value || '').trim() || '(Tanggal hari ini)';
  const namaEl = document.getElementById('storage-active-nama');
  const tglEl = document.getElementById('storage-active-tanggal');
  if (namaEl) namaEl.textContent = namaVal;
  if (tglEl) tglEl.textContent = tglVal;
}

function renderFolderFiles(folderId) {
  const tbody = document.getElementById('folder-files-tbody');
  const emptyState = document.getElementById('files-empty-state');
  const metaEl = document.getElementById('active-folder-meta');
  if (!tbody) return;

  const currentFolder = storageFolders.find(f => f.id === folderId);
  const files = storageFiles.filter(f => f.folderId === folderId || (currentFolder && f.folderName && f.folderName.toLowerCase().trim() === currentFolder.name.toLowerCase().trim()));
  if (metaEl) metaEl.textContent = `${files.length} Berkas tersimpan`;

  if (files.length === 0) {
    tbody.innerHTML = '';
    if (emptyState) emptyState.style.display = 'block';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';

  tbody.innerHTML = files.map(file => {
    const fname = (file.fileName || file.name || 'Dokumen Logbook').trim();
    const isPdf = file.format === 'pdf' || fname.toLowerCase().endsWith('.pdf');
    const badgeHtml = isPdf ? '<span class="badge-pdf">PDF</span>' : '<span class="badge-word">Word</span>';
    const iconColor = isPdf ? '#dc2626' : '#2563eb';
    const uploadDateStr = file.uploadDate || file.date || '-';
    return `
      <tr>
        <td>
          <div class="file-name-cell">
            <svg viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <span title="${escapeHtml(fname)}">${escapeHtml(fname)}</span>
          </div>
        </td>
        <td>${badgeHtml}</td>
        <td>${escapeHtml(uploadDateStr)}</td>
        <td>
          <div class="file-actions-cell">
            <button type="button" class="btn btn-secondary btn-sm" onclick="copyFileLink('${escapeHtml(file.url)}')" title="Salin Link Berkas">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
              Salin Link
            </button>
            <button type="button" class="btn btn-secondary btn-sm" onclick="openStorageFile('${file.id}')" title="Buka Berkas">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              Buka
            </button>
            <button type="button" class="btn btn-danger-outline btn-sm" onclick="deleteStorageFile('${file.id}')" title="Hapus Berkas">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// 1-Click Save Logbook to Current Folder
async function saveActiveLogbookToCurrentFolder() {
  if (!currentActiveFolderId) {
    showToast('Pilih atau buka folder terlebih dahulu!');
    return;
  }

  const folder = storageFolders.find(f => f.id === currentActiveFolderId);
  if (!folder) return;

  const data = collectData();
  if (!data.nama.trim()) {
    showToast('Nama peserta di form masih kosong! Silakan isi terlebih dahulu di tab Input Logbook.');
    switchTab('form', null);
    const namaInput = document.getElementById('nama');
    if (namaInput) namaInput.focus();
    return;
  }

  const btn = document.getElementById('btn-save-to-folder');
  const origHtml = btn.innerHTML;
  btn.disabled = true;
  btn.textContent = 'Memproses dokumen...';
  showSaveLoadingOverlay('Menyimpan Dokumen Logbook...', 'Sedang memproses berkas dan mengunggah ke Google Drive...');

  try {
    const format = document.querySelector('input[name="folder-save-format"]:checked')?.value || 'pdf';
    const cleanNama = data.nama.replace(/[^a-zA-Z0-9]/g, '_');
    const cleanDate = (data.tanggal || new Date().toISOString().split('T')[0]);
    let fileName = '';
    let mimeType = '';
    let blob;

    if (format === 'pdf') {
      mimeType = 'application/pdf';
      const pdfRes = await generatePDFBlob(data);
      blob = pdfRes.blob;
      fileName = pdfRes.fileName;
    } else {
      fileName = `Logbook_${cleanNama}_${cleanDate}.docx`;
      mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      blob = await generateWordBlob(data);
    }

    const webhookUrl = getGasWebhookUrl();
    let finalUrl = '';
    let isCloud = false;
    let fileCloudId = '';

    if (webhookUrl) {
      btn.textContent = 'Mengunggah ke Google Drive Bersama...';
      const base64Data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const payload = {
        fileName: fileName,
        mimeType: mimeType,
        folderName: folder.name,
        base64: base64Data
      };

      try {
        const resp = await fetch(webhookUrl, {
          method: 'POST',
          mode: 'cors',
          redirect: 'follow',
          body: JSON.stringify(payload),
          headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        });

        const result = await resp.json();
        if (!result.success) {
          throw new Error(result.error || 'Gagal menyimpan ke Google Drive bersama');
        }
        finalUrl = result.url;
        isCloud = true;
        if (result.file && result.file.id) {
          fileCloudId = result.file.id;
        }
        setTimeout(() => syncStorageWithCloud(true), 1200);
      } catch (uploadErr) {
        console.warn('Cloud upload failed, falling back to local storage:', uploadErr);
        const dataUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
        finalUrl = dataUrl;
        isCloud = false;

        showCustomConfirmDialog({
          title: '⚠️ Google Drive Terkendala',
          message: `
            Dokumen Anda <strong>tetap tersimpan aman di Storage Website</strong>.<br/><br/>
            Untuk mengaktifkan sinkronisasi otomatis ke Google Drive bersama:<br/>
            1. Buka <strong>script.google.com</strong> &gt; <strong>Deploy &gt; Manage deployments</strong><br/>
            2. Klik Edit (Pensil) &gt; Version: <strong>"New version"</strong><br/>
            3. Who has access: WAJIB pilih <strong>"Anyone" (Siapa saja)</strong><br/>
            4. Klik <strong>Deploy</strong>!
          `,
          subtext: 'Setelah diperbaiki, seluruh peserta magang bisa menyimpan berkas langsung ke cloud.',
          confirmText: 'Buka Panduan',
          cancelText: 'Tutup',
          isDanger: false
        }).then(ok => {
          if (ok) openScriptModal();
        });
      }
    } else {
      // Local Hub Mode (Creates permanent data URL for instant sharing / preview)
      const dataUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
      finalUrl = dataUrl;
    }

    const newFile = {
      id: fileCloudId || ('file-' + Date.now()),
      folderId: folder.id,
      folderName: folder.name,
      fileName: fileName,
      format: format,
      uploadDate: new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      url: finalUrl,
      isCloud: isCloud
    };

    storageFiles.unshift(newFile);
    saveStorageFiles();

    displayStorageResult(finalUrl, fileName, isCloud, blob);
    renderFolderFiles(folder.id);

    if (isCloud) {
      showToast('🎉 Logbook berhasil tersimpan di Google Drive bersama!');
    } else {
      showToast('✓ Logbook berhasil disimpan ke Storage Website!');
    }
  } catch (err) {
    console.error('Save to folder error:', err);
    showToast('Gagal menyimpan: ' + err.message);
  } finally {
    hideSaveLoadingOverlay();
    btn.disabled = false;
    btn.innerHTML = origHtml;
  }
}

let currentSavedResultUrl = '';
let currentSavedResultBlob = null;
let currentSavedResultFileName = '';

function showSaveLoadingOverlay(title = 'Memproses Dokumen...', desc = 'Sedang menyiapkan dokumen logbook...') {
  const overlay = document.getElementById('app-save-loading-overlay');
  const titleEl = document.getElementById('loading-overlay-title');
  const descEl = document.getElementById('loading-overlay-desc');
  if (titleEl) titleEl.textContent = title;
  if (descEl) descEl.textContent = desc;
  if (overlay) overlay.style.display = 'flex';
}

function hideSaveLoadingOverlay() {
  const overlay = document.getElementById('app-save-loading-overlay');
  if (overlay) overlay.style.display = 'none';
}

function displayStorageResult(url, fileName, isCloud, blob = null) {
  const banner = document.getElementById('storage-result-banner');
  const input = document.getElementById('storage-result-link-input');
  if (!banner || !input) return;

  currentSavedResultUrl = url;
  currentSavedResultBlob = blob;
  currentSavedResultFileName = fileName || 'Dokumen_Logbook';

  banner.style.display = 'block';
  input.value = url;
  banner.scrollIntoView({ behavior: 'smooth' });
}

function openCurrentResultUrl() {
  if (!currentSavedResultUrl && !currentSavedResultBlob) {
    showToast('Belum ada berkas yang disimpan.');
    return;
  }

  // Jika berupa tautan Google Drive / Web Cloud
  if (currentSavedResultUrl && (currentSavedResultUrl.startsWith('http://') || currentSavedResultUrl.startsWith('https://'))) {
    window.open(currentSavedResultUrl, '_blank');
    return;
  }

  // Jika berupa Blob hasil generate
  if (currentSavedResultBlob) {
    const blobUrl = URL.createObjectURL(currentSavedResultBlob);
    window.open(blobUrl, '_blank');
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    return;
  }

  // Jika berupa data URL base64
  if (currentSavedResultUrl && currentSavedResultUrl.startsWith('data:')) {
    try {
      const arr = currentSavedResultUrl.split(',');
      const mime = arr[0].match(/:(.*?);/)[1] || 'application/pdf';
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const b = new Blob([u8arr], { type: mime });
      const bUrl = URL.createObjectURL(b);
      window.open(bUrl, '_blank');
      setTimeout(() => URL.revokeObjectURL(bUrl), 60000);
      return;
    } catch (e) {
      console.warn('Gagal membuka data URL:', e);
    }
  }

  if (currentSavedResultUrl) {
    window.open(currentSavedResultUrl, '_blank');
  }
}

function openStorageFile(fileId) {
  const file = storageFiles.find(f => f.id === fileId);
  if (!file || !file.url) {
    showToast('Berkas tidak ditemukan.');
    return;
  }
  const url = file.url;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    window.open(url, '_blank');
    return;
  }
  if (url.startsWith('data:')) {
    try {
      const arr = url.split(',');
      const mime = arr[0].match(/:(.*?);/)[1] || 'application/pdf';
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const b = new Blob([u8arr], { type: mime });
      const bUrl = URL.createObjectURL(b);
      window.open(bUrl, '_blank');
      setTimeout(() => URL.revokeObjectURL(bUrl), 60000);
      return;
    } catch (e) {
      console.warn('Gagal membuka data URL:', e);
    }
  }
  window.open(url, '_blank');
}

function copyStorageResultLink() {
  const input = document.getElementById('storage-result-link-input');
  if (!input || !input.value) return;
  copyFileLink(input.value);
}

function copyActiveFolderLink() {
  if (!currentActiveFolderId) return;
  const folder = storageFolders.find(f => f.id === currentActiveFolderId);
  if (!folder) return;
  const currentUrl = window.location.origin + window.location.pathname + '#folder=' + encodeURIComponent(folder.name);
  navigator.clipboard.writeText(currentUrl).then(() => {
    showToast(`Tautan folder "${folder.name}" berhasil disalin!`);
  }).catch(() => {
    showToast('Gagal menyalin tautan folder');
  });
}

function copyFileLink(url) {
  if (!url) return;
  navigator.clipboard.writeText(url).then(() => {
    showToast('Tautan berkas berhasil disalin! Siap dibagikan ke portal / mentor 📋');
  }).catch(() => {
    showToast('Gagal menyalin tautan');
  });
}

// ============================================================
// CUSTOM CONFIRM DIALOG (MODERN POPUP)
// ============================================================
function showCustomConfirmDialog({
  title = 'Konfirmasi Tindakan',
  message = 'Apakah Anda yakin?',
  subtext = '',
  confirmText = 'Ya, Lanjutkan',
  cancelText = 'Batal',
  isDanger = true
} = {}) {
  return new Promise((resolve) => {
    const modal = document.getElementById('custom-dialog-modal');
    if (!modal) {
      resolve(confirm(message.replace(/<[^>]+>/g, '')));
      return;
    }

    const titleEl = document.getElementById('custom-dialog-title');
    const msgEl = document.getElementById('custom-dialog-message');
    const subtextEl = document.getElementById('custom-dialog-subtext');
    const subtextTxt = document.getElementById('custom-dialog-subtext-txt');
    const confirmBtn = document.getElementById('custom-dialog-confirm-btn');
    const cancelBtn = document.getElementById('custom-dialog-cancel-btn');
    const closeBtn = document.getElementById('custom-dialog-close-btn');
    const iconEl = document.getElementById('custom-dialog-icon');

    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.innerHTML = message;

    if (subtextEl && subtextTxt) {
      if (subtext) {
        subtextTxt.textContent = subtext;
        subtextEl.style.display = 'flex';
      } else {
        subtextEl.style.display = 'none';
      }
    }

    if (iconEl) {
      iconEl.className = 'custom-dialog-icon ' + (isDanger ? 'danger' : 'warning');
      if (isDanger) {
        iconEl.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
            <line x1="10" y1="11" x2="10" y2="17"/>
            <line x1="14" y1="11" x2="14" y2="17"/>
          </svg>
        `;
      } else {
        iconEl.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        `;
      }
    }

    if (confirmBtn) {
      confirmBtn.textContent = confirmText;
      confirmBtn.className = isDanger ? 'btn btn-danger' : 'btn btn-primary';
    }

    if (cancelBtn) {
      if (cancelText) {
        cancelBtn.textContent = cancelText;
        cancelBtn.style.display = '';
      } else {
        cancelBtn.style.display = 'none';
      }
    }

    let closed = false;
    const cleanup = (val) => {
      if (closed) return;
      closed = true;
      modal.classList.remove('open');
      window.removeEventListener('keydown', keyHandler);
      resolve(val);
    };

    const keyHandler = (e) => {
      if (e.key === 'Escape') cleanup(false);
    };

    window.addEventListener('keydown', keyHandler);

    confirmBtn.onclick = () => cleanup(true);
    cancelBtn.onclick = () => cleanup(false);
    if (closeBtn) closeBtn.onclick = () => cleanup(false);
    modal.onclick = (e) => {
      if (e.target === modal) cleanup(false);
    };

    modal.classList.add('open');
    if (confirmBtn) setTimeout(() => confirmBtn.focus(), 80);
  });
}

async function deleteStorageFile(fileId) {
  const file = storageFiles.find(f => f.id === fileId);
  if (!file) return;

  const fileName = file.fileName || file.name || 'berkas ini';
  const confirmed = await showCustomConfirmDialog({
    title: 'Hapus Berkas?',
    message: `Apakah Anda yakin ingin menghapus berkas <strong style="color:var(--text);">${escapeHtml(fileName)}</strong>?`,
    subtext: 'Berkas ini juga akan otomatis dipindahkan ke Sampah (Trash) di Google Drive.',
    confirmText: 'Ya, Hapus Berkas',
    cancelText: 'Batal',
    isDanger: true
  });

  if (!confirmed) return;

  // Hapus dari state lokal
  storageFiles = storageFiles.filter(f => f.id !== fileId);
  saveStorageFiles();
  if (currentActiveFolderId) {
    renderFolderFiles(currentActiveFolderId);
  }
  showToast('Menghapus berkas dari Google Drive...');

  // Hapus dari Google Drive via Webhook
  const webhookUrl = getGasWebhookUrl();
  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'deleteFile',
          fileId: file.id,
          fileName: file.fileName || file.name,
          folderName: file.folderName
        })
      });
      showToast('✓ Berkas berhasil dihapus dari Google Drive');
    } catch (err) {
      console.warn('Delete cloud file error:', err);
      showToast('Berkas dihapus di tampilan lokal');
    }
  }
}

async function confirmDeleteCurrentFolder() {
  if (!currentActiveFolderId) return;
  const folder = storageFolders.find(f => f.id === currentActiveFolderId);
  if (!folder) return;

  const filesInFolder = storageFiles.filter(f => f.folderId === folder.id || (f.folderName && folder.name && f.folderName.toLowerCase().trim() === folder.name.toLowerCase().trim()));
  const msg = filesInFolder.length > 0 
    ? `Hapus folder <strong style="color:var(--text);">${escapeHtml(folder.name)}</strong> beserta <strong>${filesInFolder.length} berkas</strong> di dalamnya?` 
    : `Apakah Anda yakin ingin menghapus folder <strong style="color:var(--text);">${escapeHtml(folder.name)}</strong>?`;

  const confirmed = await showCustomConfirmDialog({
    title: 'Hapus Folder & Isinya?',
    message: msg,
    subtext: 'Folder dan seluruh berkas di dalamnya akan otomatis dipindahkan ke Sampah (Trash) di Google Drive.',
    confirmText: 'Ya, Hapus Folder',
    cancelText: 'Batal',
    isDanger: true
  });

  if (!confirmed) return;

  const folderIdToDelete = folder.id;
  const folderNameToDelete = folder.name;

  // Hapus dari state lokal
  storageFolders = storageFolders.filter(f => f.id !== folderIdToDelete);
  storageFiles = storageFiles.filter(f => f.folderId !== folderIdToDelete && (!f.folderName || f.folderName.toLowerCase().trim() !== folderNameToDelete.toLowerCase().trim()));
  saveStorageFolders();
  saveStorageFiles();

  showAllFoldersView();
  showToast(`Menghapus folder "${folderNameToDelete}" dari Google Drive...`);

  // Hapus dari Google Drive via Webhook
  const webhookUrl = getGasWebhookUrl();
  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'deleteFolder',
          folderId: folderIdToDelete,
          folderName: folderNameToDelete
        })
      });
      showToast(`✓ Folder "${folderNameToDelete}" berhasil dihapus dari Google Drive`);
      setTimeout(() => syncStorageWithCloud(true), 1200);
    } catch (err) {
      console.warn('Delete cloud folder error:', err);
    }
  }
}

// ============================================================
// MODAL SCRIPT GUIDE
// ============================================================
function openScriptModal() {
  document.getElementById('script-modal').classList.add('open');
}

function closeScriptModal(e) {
  if (e && e.target !== e.currentTarget && !e.target.classList.contains('modal-close')) return;
  document.getElementById('script-modal').classList.remove('open');
}

function copyAppsScriptCode() {
  const code = document.getElementById('gas-code-content').textContent;
  navigator.clipboard.writeText(code).then(() => {
    showToast('Kode Google Apps Script berhasil disalin!');
  }).catch(() => {
    showToast('Gagal menyalin kode');
  });
}

// ============================================================
// TOAST NOTIFICATION
// ============================================================
let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.classList.remove('show');
  }, 3200);
}
