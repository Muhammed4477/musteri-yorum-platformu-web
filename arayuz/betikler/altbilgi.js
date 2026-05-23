/* =====================================================
   MüşteriYorum — Reusable Premium Footer
   Kullanım: <script src="/js/footer.js" defer></script>
   Sayfa yüklendiğinde <body> sonuna otomatik enjekte eder.
   ===================================================== */
(function () {
  function buildFooter() {
    const year = new Date().getFullYear();
    return `
<footer class="site-footer">
  <div class="container">
    <div class="row g-4">
      <div class="col-lg-5 col-md-6">
        <div class="footer-brand">
          <i class="bi bi-chat-square-text-fill"></i> MüşteriYorum
        </div>
        <p class="footer-desc">
          Yapay zeka destekli müşteri yorum analizi platformu.
          Geri bildirimlerinizi içgörüye, içgörüleri büyümeye dönüştürün.
        </p>
        <div class="d-flex gap-2 mt-3">
          <a href="#" class="footer-link" style="padding:8px;border:1px solid rgba(255,255,255,.08);border-radius:10px;width:38px;text-align:center" aria-label="Twitter">
            <i class="bi bi-twitter-x"></i>
          </a>
          <a href="#" class="footer-link" style="padding:8px;border:1px solid rgba(255,255,255,.08);border-radius:10px;width:38px;text-align:center" aria-label="LinkedIn">
            <i class="bi bi-linkedin"></i>
          </a>
          <a href="https://github.com/Muhammed4477" target="_blank" rel="noopener" class="footer-link" style="padding:8px;border:1px solid rgba(255,255,255,.08);border-radius:10px;width:38px;text-align:center" aria-label="GitHub">
            <i class="bi bi-github"></i>
          </a>
          <a href="mailto:c.muhammed4477@gmail.com" class="footer-link" style="padding:8px;border:1px solid rgba(255,255,255,.08);border-radius:10px;width:38px;text-align:center" aria-label="E-posta">
            <i class="bi bi-envelope"></i>
          </a>
        </div>
      </div>

      <div class="col-lg-2 col-md-6 col-6">
        <div class="footer-heading">Platform</div>
        <a href="/" class="footer-link">Ana Sayfa</a>
        <a href="/about/" class="footer-link">Hakkımızda</a>
        <a href="/gelistirici/" class="footer-link">Geliştirici</a>
        <a href="/contact/" class="footer-link">İletişim</a>
      </div>

      <div class="col-lg-2 col-md-6 col-6">
        <div class="footer-heading">Hesap</div>
        <a href="/giris.html" class="footer-link">Giriş Yap</a>
        <a href="/login.html#register" class="footer-link">Kayıt Ol</a>
        <a href="/panel/" class="footer-link">Dashboard</a>
      </div>

      <div class="col-lg-3 col-md-6">
        <div class="footer-heading">Yasal</div>
        <a href="#" class="footer-link">KVKK Aydınlatma Metni</a>
        <a href="#" class="footer-link">Gizlilik Politikası</a>
        <a href="#" class="footer-link">Kullanım Koşulları</a>
        <a href="#" class="footer-link">Çerez Politikası</a>
      </div>
    </div>

    <div class="footer-bottom">
      <div class="copyright">
        &copy; ${year} MüşteriYorum. Tüm hakları saklıdır.
      </div>
      <a href="/gelistirici/" class="clksoft-signature" title="Muhammed Çelik tarafından geliştirildi">
        <span class="clk-dot"></span>
        <span class="d-flex flex-column" style="line-height:1.1">
          <span class="clk-text">ClkSoft</span>
          <span class="clk-sub">crafted with care</span>
        </span>
      </a>
    </div>
  </div>
</footer>`.trim();
  }

  function inject() {
    if (document.querySelector('footer.site-footer')) return;
    const wrap = document.createElement('div');
    wrap.innerHTML = buildFooter();
    document.body.appendChild(wrap.firstChild);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
