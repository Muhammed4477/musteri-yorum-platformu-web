const API_BASE = '';

function getToken() { return localStorage.getItem('token'); }
function getUser() {
  const u = localStorage.getItem('user');
  return u ? JSON.parse(u) : null;
}
function setAuth(token, user) {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}
function clearAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}
function isLoggedIn() { return !!getToken(); }

// Rol bazlı varsayılan ana sayfa
function rolHomePage(rol) {
  if (rol === 'admin') return '/yonetici/';
  if (rol === 'musteri') return '/musteri/anasayfa.html';
  return '/panel/';
}
function redirectToHome() {
  const u = getUser();
  if (u) window.location.href = rolHomePage(u.rol);
  else window.location.href = '/giris.html';
}

async function apiFetch(url, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(API_BASE + url, { ...options, headers });
  if (res.status === 401) {
    clearAuth();
    window.location.href = '/giris.html';
    return;
  }
  return res;
}

function requireAuth() {
  if (!isLoggedIn()) {
    window.location.href = '/giris.html';
    return false;
  }
  return true;
}

function requireAdmin() {
  const user = getUser();
  if (!user || user.rol !== 'admin') {
    window.location.href = '/panel/';
    return false;
  }
  return true;
}

function updateNavbar() {
  const user = getUser();
  const navLogin = document.getElementById('nav-login');
  const navUser = document.getElementById('nav-user');
  const navUserName = document.getElementById('nav-user-name');
  const navAdmin = document.getElementById('nav-admin');

  if (user && isLoggedIn()) {
    if (navLogin) navLogin.style.display = 'none';
    if (navUser) navUser.style.display = 'flex';
    if (navUserName) navUserName.textContent = user.ad_soyad;
    if (navAdmin && user.rol === 'admin') navAdmin.style.display = 'block';
  } else {
    if (navLogin) navLogin.style.display = 'flex';
    if (navUser) navUser.style.display = 'none';
  }
}

function updateSidebar() {
  const user = getUser();
  const sidebarUser = document.getElementById('sidebar-user');
  const sidebarAdmin = document.getElementById('sidebar-admin-link');
  if (sidebarUser) sidebarUser.textContent = user ? user.ad_soyad : '';
  if (sidebarAdmin && user && user.rol === 'admin') sidebarAdmin.style.display = 'block';

  // (Yorum Ekle linki kaldırıldı — bu blok artık gerekli değil)

  // Active link
  const links = document.querySelectorAll('.sidebar .nav-link');
  links.forEach(link => {
    if (link.href && window.location.pathname.startsWith(new URL(link.href).pathname)) {
      link.classList.add('active');
    }
  });
}

/* =====================================================
   Sidebar Toggle (Açılır/Kapanır)
   - Masaüstü: mini-rail (ikon-only) için body.sidebar-collapsed
   - Mobil:    slide-in için body.sidebar-open + backdrop
   - Durumu localStorage'da saklar
   ===================================================== */
function setupSidebarToggle() {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar) return;

  // Tooltipler için data-label attribute (collapsed state için)
  sidebar.querySelectorAll('.nav-link').forEach(link => {
    if (!link.hasAttribute('data-label')) {
      const label = link.textContent.trim();
      if (label) link.setAttribute('data-label', label);
    }
  });

  // Toggle butonunu enjekte et
  if (!document.querySelector('.sidebar-toggle')) {
    const btn = document.createElement('button');
    btn.className = 'sidebar-toggle';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Menüyü aç/kapat');
    btn.innerHTML = '<i class="bi bi-list"></i>';
    document.body.appendChild(btn);

    // Backdrop (mobil için)
    const backdrop = document.createElement('div');
    backdrop.className = 'sidebar-backdrop';
    document.body.appendChild(backdrop);

    const isMobile = () => window.matchMedia('(max-width: 768px)').matches;

    btn.addEventListener('click', () => {
      if (isMobile()) {
        document.body.classList.toggle('sidebar-open');
      } else {
        document.body.classList.toggle('sidebar-collapsed');
        localStorage.setItem(
          'sidebarCollapsed',
          document.body.classList.contains('sidebar-collapsed') ? '1' : '0'
        );
      }
    });

    backdrop.addEventListener('click', () => {
      document.body.classList.remove('sidebar-open');
    });

    // Mobilde nav link'e tıklayınca otomatik kapansın
    sidebar.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        if (isMobile()) document.body.classList.remove('sidebar-open');
      });
    });

    // Resize'da çakışmayı temizle
    window.addEventListener('resize', () => {
      if (!isMobile()) document.body.classList.remove('sidebar-open');
    });
  }

  // localStorage'dan durumu geri yükle (sadece masaüstü)
  if (window.matchMedia('(min-width: 769px)').matches) {
    if (localStorage.getItem('sidebarCollapsed') === '1') {
      document.body.classList.add('sidebar-collapsed');
    }
  }
}

function logout() {
  clearAuth();
  window.location.href = '/giris.html';
}

function showAlert(message, type = 'danger', containerId = 'alert-container') {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = `
    <div class="alert alert-${type} alert-dismissible fade show" role="alert">
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    </div>`;
}

function starsHtml(puan) {
  if (!puan) return '<span class="text-muted">-</span>';
  let html = '';
  for (let i = 1; i <= 5; i++) {
    html += `<i class="bi bi-star${i <= puan ? '-fill' : ''} text-warning"></i>`;
  }
  return html;
}

function duyguBadge(duygu) {
  if (!duygu) return '<span class="badge bg-secondary">-</span>';
  const map = { olumlu: 'badge-olumlu', olumsuz: 'badge-olumsuz', 'nötr': 'badge-notr' };
  return `<span class="badge ${map[duygu] || 'bg-secondary'}">${duygu}</span>`;
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('tr-TR');
}

function formatNumber(n) {
  return n ? n.toLocaleString('tr-TR') : '0';
}

// Login form
async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const sifre = document.getElementById('login-sifre').value;
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, sifre })
    });
    const data = await res.json();
    if (!res.ok) { showAlert(data.hata || 'Giriş başarısız'); return; }
    setAuth(data.token, data.kullanici);
    window.location.href = rolHomePage(data.kullanici.rol);
  } catch {
    showAlert('Bağlantı hatası');
  }
}

// Register form
async function handleRegister(e) {
  e.preventDefault();
  const ad_soyad = document.getElementById('reg-adsoyad').value;
  const isletme_adi = document.getElementById('reg-isletme').value;
  const email = document.getElementById('reg-email').value;
  const sifre = document.getElementById('reg-sifre').value;
  const sifre2 = document.getElementById('reg-sifre2').value;
  // Rol radio'su (varsa); yoksa user
  const rolEl = document.querySelector('input[name="reg-rol"]:checked');
  const rol = rolEl ? rolEl.value : 'user';
  const sehirEl = document.getElementById('reg-sehir');
  const ilceEl = document.getElementById('reg-ilce');
  const sehir = sehirEl ? sehirEl.value : '';
  const ilce = ilceEl ? ilceEl.value : '';
  if (sifre !== sifre2) { showAlert('Şifreler eşleşmiyor'); return; }
  if (rol === 'user' && !isletme_adi) {
    showAlert('İşletme sahibi kaydı için işletme adı zorunludur'); return;
  }
  if (rol === 'user' && !sehir) {
    showAlert('İşletme sahibi kaydı için il seçimi zorunludur'); return;
  }
  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ad_soyad, email, sifre, isletme_adi, rol, sehir, ilce })
    });
    const data = await res.json();
    if (!res.ok) { showAlert(data.hata || 'Kayıt başarısız'); return; }
    setAuth(data.token, data.kullanici);
    window.location.href = rolHomePage(data.kullanici.rol);
  } catch {
    showAlert('Bağlantı hatası');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  updateNavbar();
  updateSidebar();
  setupSidebarToggle();

  const loginForm = document.getElementById('login-form');
  if (loginForm) loginForm.addEventListener('submit', handleLogin);

  const regForm = document.getElementById('register-form');
  if (regForm) regForm.addEventListener('submit', handleRegister);

  const logoutBtns = document.querySelectorAll('.logout-btn');
  logoutBtns.forEach(btn => btn.addEventListener('click', logout));
});
