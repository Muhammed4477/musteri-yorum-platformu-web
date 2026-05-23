let duyguChart = null;
let konuChart = null;
let trendChart = null;

async function loadDashboardCharts() {
  try {
    const res = await apiFetch('/api/analysis/summary');
    if (!res || !res.ok) return;
    const data = await res.json();

    updateStatCards(data.ozet);
    renderDuyguChart(data.duygu_dagilimi);
    renderKonuChart(data.konu_dagilimi);
    renderTrendChart(data.aylik_trend);
  } catch (err) {
    console.error('Chart yükleme hatası:', err);
  }
}

function updateStatCards(ozet) {
  const els = {
    'stat-toplam': ozet.toplam,
    'stat-olumlu': ozet.olumlu,
    'stat-olumsuz': ozet.olumsuz,
    'stat-notr': ozet.notr
  };
  Object.entries(els).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = formatNumber(val);
  });
}

function renderDuyguChart(dagilim) {
  const ctx = document.getElementById('duyguChart');
  if (!ctx) return;
  if (duyguChart) duyguChart.destroy();
  duyguChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Olumlu', 'Olumsuz', 'Nötr'],
      datasets: [{
        data: [dagilim['olumlu'] || 0, dagilim['olumsuz'] || 0, dagilim['nötr'] || 0],
        backgroundColor: ['#28a745', '#dc3545', '#ffc107'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: ctx => {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pct = total ? Math.round(ctx.raw / total * 100) : 0;
              return ` ${ctx.label}: ${ctx.raw} (%${pct})`;
            }
          }
        }
      }
    }
  });
}

function renderKonuChart(dagilim) {
  const ctx = document.getElementById('konuChart');
  if (!ctx) return;
  if (konuChart) konuChart.destroy();
  const labels = Object.keys(dagilim);
  const values = Object.values(dagilim);
  konuChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Yorum Sayısı',
        data: values,
        backgroundColor: '#007bff',
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
    }
  });
}

function renderTrendChart(trend) {
  const ctx = document.getElementById('trendChart');
  if (!ctx) return;
  if (trendChart) trendChart.destroy();

  const aylar = [...new Set(trend.map(t => t.ay))].sort();
  const datasets = [
    { label: 'Olumlu', key: 'olumlu', color: '#28a745' },
    { label: 'Olumsuz', key: 'olumsuz', color: '#dc3545' },
    { label: 'Nötr', key: 'nötr', color: '#ffc107' }
  ].map(({ label, key, color }) => ({
    label,
    data: aylar.map(ay => {
      const item = trend.find(t => t.ay === ay && t.duygu === key);
      return item ? parseInt(item.sayi) : 0;
    }),
    borderColor: color,
    backgroundColor: color + '22',
    tension: 0.4,
    fill: true
  }));

  trendChart = new Chart(ctx, {
    type: 'line',
    data: { labels: aylar, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' } },
      scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
    }
  });
}

async function loadAksiyonKartlari() {
  const user = getUser();
  if (!user || user.rol !== 'user') return;

  const section = document.getElementById('aksiyon-section');
  const container = document.getElementById('aksiyon-kartlar');
  if (!section || !container) return;

  try {
    const res = await apiFetch('/api/analysis/aksiyonlar');
    if (!res || !res.ok) return;
    const { kartlar } = await res.json();
    if (!kartlar || !kartlar.length) return;

    section.style.display = '';

    const ikonRenkMap = {
      danger:  { bg: 'bg-danger-subtle',  border: 'border-danger',   text: 'text-danger'  },
      success: { bg: 'bg-success-subtle', border: 'border-success',  text: 'text-success' },
      warning: { bg: 'bg-warning-subtle', border: 'border-warning',  text: 'text-warning' },
      info:    { bg: 'bg-info-subtle',    border: 'border-info',     text: 'text-info'    },
      primary: { bg: 'bg-primary-subtle', border: 'border-primary',  text: 'text-primary' }
    };

    container.innerHTML = kartlar.map(k => {
      const stil = ikonRenkMap[k.renk] || ikonRenkMap.info;
      return `
        <div class="col-md-6 col-xl-3">
          <div class="card border-0 shadow-sm h-100 border-start border-4 ${stil.border}">
            <div class="card-body">
              <div class="d-flex align-items-center gap-2 mb-2">
                <span class="p-2 rounded-circle ${stil.bg}">
                  <i class="bi ${k.ikon} ${stil.text}"></i>
                </span>
                <span class="fw-semibold small">${k.baslik}</span>
              </div>
              <p class="mb-1 small">${k.metin}</p>
              <p class="mb-0 fst-italic text-muted" style="font-size:0.78rem">
                <i class="bi bi-lightbulb"></i> ${k.aksiyon}
              </p>
            </div>
          </div>
        </div>`;
    }).join('');
  } catch (err) {
    console.error('Aksiyon kartları yüklenemedi:', err);
  }
}

async function loadAnalysisCharts() {
  try {
    const res = await apiFetch('/api/analysis/summary');
    if (!res || !res.ok) return;
    const data = await res.json();
    const { ozet } = data;
    const toplam = ozet.toplam || 1;

    const setBadge = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = `%${Math.round(val / toplam * 100)} (${val})`;
    };
    setBadge('pct-olumlu', ozet.olumlu);
    setBadge('pct-olumsuz', ozet.olumsuz);
    setBadge('pct-notr', ozet.notr);

    renderDuyguChart(data.duygu_dagilimi);
    renderKonuChart(data.konu_dagilimi);
  } catch (err) {
    console.error(err);
  }
}
