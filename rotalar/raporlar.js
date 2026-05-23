const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const XLSX = require('xlsx');
const path = require('path');
const { Op } = require('sequelize');

const authMiddleware = require('../ara_yazilim/kimlik');
const Review = require('../modeller/Yorum');
const AnalysisResult = require('../modeller/AnalizSonucu');
const Category = require('../modeller/Kategori');
const Business = require('../modeller/Isletme');

// Font yolları (Türkçe karakter desteği için TTF)
const FONT_DIR     = path.join(__dirname, '../varliklar/fonts');
const FONT_REGULAR = path.join(FONT_DIR, 'Arial.ttf');
const FONT_BOLD    = path.join(FONT_DIR, 'ArialBold.ttf');

// ── Renk paleti ──────────────────────────────────────────────
const C = {
  navy:    '#0f172a',
  navyMid: '#1e293b',
  brand:   '#6366f1',
  green:   '#10b981',
  red:     '#ef4444',
  amber:   '#f59e0b',
  slate:   '#64748b',
  light:   '#f1f5f9',
  white:   '#ffffff',
  border:  '#e2e8f0',
  rowAlt:  '#f8fafc',
};

// ── Yardımcılar ───────────────────────────────────────────────
function trDate(d) {
  return new Date(d).toLocaleDateString('tr-TR', { day:'2-digit', month:'long', year:'numeric' });
}

/** Tek stat kutusu çizer (x,y,w,h, renkler, başlık, değer) */
function drawStatBox(doc, x, y, w, h, bg, label, value, sub) {
  doc.roundedRect(x, y, w, h, 8).fill(bg);
  doc.fillColor(C.white).font(FONT_BOLD).fontSize(22)
     .text(String(value), x, y + 14, { width: w, align: 'center' });
  doc.fillColor(C.white).font(FONT_REGULAR).fontSize(9)
     .text(label, x, y + h - 26, { width: w, align: 'center' });
  if (sub !== undefined) {
    doc.fillColor('rgba(255,255,255,0.75)').font(FONT_REGULAR).fontSize(8)
       .text(sub, x, y + h - 14, { width: w, align: 'center' });
  }
}

/** Yatay dolgu barı çizer */
function drawBar(doc, x, y, totalW, h, segments) {
  // Arka plan
  doc.roundedRect(x, y, totalW, h, h/2).fill(C.border);
  let cx = x;
  segments.forEach(seg => {
    const sw = Math.round(totalW * seg.pct);
    if (sw < 2) return;
    doc.roundedRect(cx, y, sw, h, h/2).fill(seg.color);
    cx += sw;
  });
}

/** Kesik çizgi çizer */
function drawDivider(doc, y, margin) {
  doc.moveTo(margin, y).lineTo(doc.page.width - margin, y)
     .strokeColor(C.border).lineWidth(0.5).stroke();
}

/** Bölüm başlığı */
function sectionTitle(doc, text, y, margin) {
  doc.font(FONT_BOLD).fontSize(12).fillColor(C.navy)
     .text(text, margin, y);
  doc.moveTo(margin, y + 17)
     .lineTo(margin + doc.widthOfString(text, { fontSize: 12 }) + 8, y + 17)
     .strokeColor(C.brand).lineWidth(2).stroke();
}

/** Tablo satırı çizer */
function tableRow(doc, y, cols, rowBg, isHeader) {
  const pageW = doc.page.width;
  const margin = doc.page.margins.left;
  const tableW = pageW - margin * 2;

  // Satır arka planı
  doc.rect(margin, y, tableW, isHeader ? 20 : 18).fill(rowBg);

  let cx = margin;
  cols.forEach(col => {
    doc.font(isHeader ? FONT_BOLD : FONT_REGULAR)
       .fontSize(isHeader ? 8 : 8.5)
       .fillColor(isHeader ? C.white : C.navy)
       .text(col.text, cx + 4, y + (isHeader ? 6 : 5), {
         width: col.w - 8,
         height: isHeader ? 14 : 13,
         ellipsis: true,
         lineBreak: false
       });
    cx += col.w;
  });
}

/** Yeni sayfa gerekip gerekmediğini kontrol et */
function checkNewPage(doc, y, needed, margin) {
  const pageH = doc.page.height - doc.page.margins.bottom;
  if (y + needed > pageH) {
    doc.addPage();
    return doc.page.margins.top;
  }
  return y;
}

// İşletme sahibinin business_id'lerini döndürür
async function getUserBusinessIds(userId) {
  const businesses = await Business.findAll({ where: { owner_id: userId }, attributes: ['id'] });
  return businesses.map(b => b.id);
}

// Role göre review where koşulunu oluşturur
async function buildReviewWhere(user) {
  if (user.rol === 'user') {
    const ids = await getUserBusinessIds(user.id);
    return { business_id: { [Op.in]: ids.length ? ids : [-1] } };
  }
  return { user_id: user.id };
}

router.get('/pdf', authMiddleware, async (req, res) => {
  try {
    const where = await buildReviewWhere(req.user);
    const reviews = await Review.findAll({
      where,
      include: [
        { model: AnalysisResult, as: 'analiz', attributes: ['duygu', 'konu_etiketi', 'ozet'] },
        { model: Category, as: 'category', attributes: ['kategori_adi'] }
      ],
      order: [['olusturma', 'DESC']],
      limit: 200
    });

    // ── İstatistikler ────────────────────────────────────────
    const toplam  = reviews.length;
    const olumlu  = reviews.filter(r => r.analiz?.duygu === 'olumlu').length;
    const olumsuz = reviews.filter(r => r.analiz?.duygu === 'olumsuz').length;
    const notr    = reviews.filter(r => r.analiz?.duygu === 'nötr').length;
    const puanlilar = reviews.filter(r => r.puan);
    const ortPuan  = puanlilar.length
      ? (puanlilar.reduce((s, r) => s + r.puan, 0) / puanlilar.length).toFixed(1)
      : '-';
    const yanitsiz = reviews.filter(r => !r.isletme_yaniti).length;

    const pctOf = n => toplam ? Math.round(n / toplam * 100) : 0;

    // Konu dağılımı
    const konuMap = {};
    reviews.forEach(r => {
      const k = r.analiz?.konu_etiketi;
      if (k) konuMap[k] = (konuMap[k] || 0) + 1;
    });
    const topKonular = Object.entries(konuMap).sort((a, b) => b[1] - a[1]).slice(0, 8);

    // İşletme konum
    let isletmeAdi = req.user.isletme_adi || req.user.ad_soyad;
    let konumStr = '';
    if (req.user.rol === 'user') {
      const isletme = await Business.findOne({ where: { owner_id: req.user.id } });
      if (isletme) {
        if (isletme.isletme_adi) isletmeAdi = isletme.isletme_adi;
        konumStr = [isletme.ilce, isletme.sehir].filter(Boolean).join(' / ');
      }
    }

    // ── PDF Belge ────────────────────────────────────────────
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 0, bottom: 36, left: 42, right: 42 },
      bufferPages: true,
      info: { Title: 'Müşteri Yorum Analiz Raporu', Author: isletmeAdi }
    });

    // Font kayıt
    doc.registerFont('Regular', FONT_REGULAR);
    doc.registerFont('Bold',    FONT_BOLD);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="rapor-${Date.now()}.pdf"`);
    doc.pipe(res);

    const pageW  = doc.page.width;
    const margin = doc.page.margins.left;
    const inner  = pageW - margin * 2;

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // HEADER BANNER
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const bannerH = 88;
    doc.rect(0, 0, pageW, bannerH).fill(C.navy);
    // Dekoratif daire
    doc.circle(pageW - 60, -20, 80).fill(C.navyMid);
    doc.circle(pageW - 10, 70, 40).fill(C.brand).opacity(0.3).fill(C.brand);
    doc.opacity(1);

    // Logo ikonu (daire + harf)
    doc.circle(margin + 20, 44, 18).fill(C.brand);
    doc.font('Bold').fontSize(16).fillColor(C.white)
       .text('MY', margin + 8, 37);

    // Başlık
    doc.font('Bold').fontSize(18).fillColor(C.white)
       .text('Müşteri Yorum Analiz Raporu', margin + 50, 28);
    doc.font('Regular').fontSize(9).fillColor('rgba(255,255,255,0.65)')
       .text('YZ Destekli Duygu & Konu Analizi  •  MüşteriYorum Platform', margin + 50, 50);

    // Sağ: tarih
    const tarihStr = trDate(new Date());
    doc.font('Regular').fontSize(9).fillColor('rgba(255,255,255,0.75)')
       .text(tarihStr, pageW - margin - 110, 37, { width: 110, align: 'right' });

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // İŞLETME BİLGİ SATIRI
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const infoY = bannerH + 14;
    doc.rect(margin, infoY, inner, 36).fill(C.light).roundedRect(margin, infoY, inner, 36, 6).fill(C.light);

    doc.font('Bold').fontSize(10).fillColor(C.navy)
       .text(isletmeAdi, margin + 12, infoY + 7, { continued: false });
    if (konumStr) {
      doc.font('Regular').fontSize(9).fillColor(C.slate)
         .text('  '+ konumStr, margin + 12, infoY + 20);
    }
    // Sağda kullanıcı etiketi
    doc.roundedRect(pageW - margin - 90, infoY + 8, 82, 20, 10).fill(C.brand);
    doc.font('Bold').fontSize(8).fillColor(C.white)
       .text(req.user.ad_soyad, pageW - margin - 86, infoY + 13, { width: 74, align: 'center' });

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // İSTATİSTİK KUTULARI  (4 kutu yan yana)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const boxY  = infoY + 50;
    const boxH  = 72;
    const gap   = 8;
    const boxW  = (inner - gap * 3) / 4;

    const boxes = [
      { bg: C.brand,  label: 'Toplam Yorum',    value: toplam,             sub: `Ort. Puan: ${ortPuan}`        },
      { bg: C.green,  label: 'Olumlu',          value: `${pctOf(olumlu)}%`, sub: `${olumlu} yorum`             },
      { bg: C.red,    label: 'Olumsuz',         value: `${pctOf(olumsuz)}%`, sub: `${olumsuz} yorum`           },
      { bg: C.amber,  label: 'Nötr',            value: `${pctOf(notr)}%`,   sub: `${notr} yorum`               },
    ];
    boxes.forEach((b, i) => {
      drawStatBox(doc, margin + i * (boxW + gap), boxY, boxW, boxH, b.bg, b.label, b.value, b.sub);
    });

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // DUYGU DAĞILIM BARISI
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const barY = boxY + boxH + 20;
    sectionTitle(doc, 'Duygu Dağılımı', barY, margin);

    const barTop = barY + 26;
    drawBar(doc, margin, barTop, inner, 14, [
      { pct: olumlu  / (toplam || 1), color: C.green },
      { pct: notr    / (toplam || 1), color: C.amber },
      { pct: olumsuz / (toplam || 1), color: C.red   },
    ]);
    // Etiketler
    const legendY = barTop + 20;
    const legendItems = [
      { color: C.green, label: `Olumlu %${pctOf(olumlu)}` },
      { color: C.amber, label: `Nötr %${pctOf(notr)}`     },
      { color: C.red,   label: `Olumsuz %${pctOf(olumsuz)}`},
    ];
    let lx = margin;
    legendItems.forEach(li => {
      doc.roundedRect(lx, legendY, 10, 10, 2).fill(li.color);
      doc.font('Regular').fontSize(8).fillColor(C.slate)
         .text(li.label, lx + 13, legendY + 1);
      lx += 90;
    });

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // KONU DAĞILIMI
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    let curY = legendY + 22;
    drawDivider(doc, curY, margin);
    curY += 10;

    sectionTitle(doc, 'Konu Dağılımı (İlk 8)', curY, margin);
    curY += 26;

    if (topKonular.length) {
      const colW = (inner - 8) / 2;
      topKonular.forEach(([ konu, sayi ], i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const kx  = margin + col * (colW + 8);
        const ky  = curY + row * 22;

        const barMax = topKonular[0][1];
        const barLen = Math.round((sayi / barMax) * (colW * 0.45));

        doc.font('Regular').fontSize(9).fillColor(C.navy)
           .text(konu, kx, ky + 2, { width: colW * 0.45 - 4, lineBreak: false, ellipsis: true });
        // mini bar
        doc.roundedRect(kx + colW * 0.48, ky + 3, colW * 0.45, 9, 4).fill(C.border);
        doc.roundedRect(kx + colW * 0.48, ky + 3, barLen || 2, 9, 4).fill(C.brand);
        // sayı
        doc.font('Bold').fontSize(8).fillColor(C.brand)
           .text(String(sayi), kx + colW * 0.94, ky + 3);
      });
      const topicRows = Math.ceil(topKonular.length / 2);
      curY += topicRows * 22 + 8;
    } else {
      doc.font('Regular').fontSize(9).fillColor(C.slate).text('Konu verisi bulunamadı.', margin, curY);
      curY += 20;
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ÖZET BİLGİLER (ek metrik satırı)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    drawDivider(doc, curY, margin);
    curY += 10;

    const metrikler = [
      { icon: '★', label: 'Ort. Puan',          val: ortPuan,                    color: C.amber  },
      { icon: '↩', label: 'Yanıt Bekleyen',      val: yanitsiz,                  color: C.red    },
      { icon: '✓', label: 'Yanıtlanan',          val: toplam - yanitsiz,          color: C.green  },
      { icon: '≡', label: 'Raporlanan Yorum',    val: Math.min(toplam, 200),      color: C.brand  },
    ];
    const mW = (inner - gap * 3) / 4;
    metrikler.forEach((m, i) => {
      const mx = margin + i * (mW + gap);
      doc.roundedRect(mx, curY, mW, 34, 6).fill(C.light);
      doc.font('Bold').fontSize(14).fillColor(m.color)
         .text(String(m.val), mx, curY + 4, { width: mW, align: 'center' });
      doc.font('Regular').fontSize(7.5).fillColor(C.slate)
         .text(m.label, mx, curY + 22, { width: mW, align: 'center' });
    });
    curY += 44;

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // YORUM TABLOSU
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    drawDivider(doc, curY, margin);
    curY += 10;

    // Sütun genişlikleri
    const COLS = [
      { key: 'no',      label: '#',          w: 22  },
      { key: 'musteri', label: 'Müşteri',     w: 80  },
      { key: 'yorum',   label: 'Yorum',       w: 210 },
      { key: 'puan',    label: 'Puan',        w: 36  },
      { key: 'duygu',   label: 'Duygu',       w: 54  },
      { key: 'konu',    label: 'Konu',        w: inner - 22 - 80 - 210 - 36 - 54 },
    ];

    // Tablo başlığı
    curY = checkNewPage(doc, curY, 24, margin);
    doc.rect(margin, curY, inner, 20).fill(C.navy);
    let hx = margin;
    COLS.forEach(col => {
      doc.font('Bold').fontSize(8).fillColor(C.white)
         .text(col.label, hx + 4, curY + 6, { width: col.w - 8, lineBreak: false });
      hx += col.w;
    });
    curY += 20;

    // Veri satırları (ilk 50 yorum)
    const reviewList = reviews.slice(0, 50);
    reviewList.forEach((r, idx) => {
      const rowH = 18;
      curY = checkNewPage(doc, curY, rowH + 4, margin);

      // Yeni sayfada tablo başlığını yeniden çiz
      if (doc.y === doc.page.margins.top && idx > 0) {
        doc.rect(margin, curY, inner, 20).fill(C.navy);
        let rhx = margin;
        COLS.forEach(col => {
          doc.font('Bold').fontSize(8).fillColor(C.white)
             .text(col.label, rhx + 4, curY + 6, { width: col.w - 8, lineBreak: false });
          rhx += col.w;
        });
        curY += 20;
      }

      const rowBg = idx % 2 === 0 ? C.white : C.rowAlt;
      const duygu = r.analiz?.duygu || '';
      const duyguColor = duygu === 'olumlu' ? C.green : duygu === 'olumsuz' ? C.red : C.amber;

      // Satır bg
      doc.rect(margin, curY, inner, rowH).fill(rowBg);

      // Sol kenar rengi (duygu göstergesi)
      doc.rect(margin, curY, 3, rowH).fill(duyguColor);

      const rowData = [
        { text: String(idx + 1) },
        { text: r.musteri_adi || 'Anonim' },
        { text: r.yorum_metni },
        { text: r.puan ? '★'.repeat(r.puan) : '-' },
        { text: duygu },
        { text: r.analiz?.konu_etiketi || '-' }
      ];

      let rx = margin;
      rowData.forEach((cell, ci) => {
        const col = COLS[ci];
        // Duygu sütununa renk uygula
        const fColor = ci === 4 ? duyguColor : C.navy;
        doc.font(ci === 4 ? 'Bold' : 'Regular')
           .fontSize(ci === 2 ? 7.5 : 8.5)
           .fillColor(fColor)
           .text(cell.text, rx + 5, curY + 5, {
             width: col.w - 9,
             height: rowH - 6,
             ellipsis: true,
             lineBreak: false
           });
        rx += col.w;
      });

      // Satır alt çizgisi
      doc.moveTo(margin, curY + rowH).lineTo(margin + inner, curY + rowH)
         .strokeColor(C.border).lineWidth(0.3).stroke();

      curY += rowH;
    });

    if (toplam > 50) {
      curY += 6;
      doc.font('Regular').fontSize(8).fillColor(C.slate)
         .text(`... ve ${toplam - 50} yorum daha. Tüm verileri Excel raporundan indirin.`,
               margin, curY, { align: 'center', width: inner });
      curY += 16;
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // FOOTER (her sayfaya)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const pageCount = doc.bufferedPageRange ? doc.bufferedPageRange().count : 1;
    const range = doc.bufferedPageRange();
    for (let i = 0; i < (range ? range.count : 1); i++) {
      doc.switchToPage(i);
      const footerY = doc.page.height - 28;
      doc.rect(0, footerY, pageW, 28).fill(C.navy);
      doc.font('Regular').fontSize(7.5).fillColor('rgba(255,255,255,0.6)')
         .text('MüşteriYorum Platform  •  YZ Destekli Müşteri Yorum Yönetimi',
               margin, footerY + 8, { width: inner * 0.6 });
      doc.font('Regular').fontSize(7.5).fillColor('rgba(255,255,255,0.6)')
         .text(`Sayfa ${i + 1} / ${range ? range.count : 1}   •   ${tarihStr}`,
               margin, footerY + 8, { width: inner, align: 'right' });
    }

    doc.end();
  } catch (err) {
    console.error('PDF hatası:', err);
    res.status(500).json({ hata: 'PDF oluşturma hatası: ' + err.message });
  }
});

router.get('/excel', authMiddleware, async (req, res) => {
  try {
    const where = await buildReviewWhere(req.user);
    const reviews = await Review.findAll({
      where,
      include: [
        { model: AnalysisResult, as: 'analiz', attributes: ['duygu', 'konu_etiketi', 'guven_skoru', 'ozet'] },
        { model: Category, as: 'category', attributes: ['kategori_adi'] },
        { model: Business, as: 'business', attributes: ['isletme_adi', 'sehir', 'ilce'], required: false }
      ],
      order: [['olusturma', 'DESC']]
    });

    const data = reviews.map(r => ({
      'ID': r.id,
      'Müşteri': r.musteri_adi || 'Anonim',
      'Yorum': r.yorum_metni,
      'Puan': r.puan || '',
      'Kategori': r.category ? r.category.kategori_adi : '',
      'Kaynak': r.kaynak,
      'İl': r.business ? r.business.sehir || '' : '',
      'İlçe': r.business ? r.business.ilce || '' : '',
      'Duygu': r.analiz ? r.analiz.duygu : '',
      'Konu': r.analiz ? r.analiz.konu_etiketi : '',
      'Güven Skoru': r.analiz ? r.analiz.guven_skoru : '',
      'Özet': r.analiz ? r.analiz.ozet : '',
      'Tarih': new Date(r.olusturma).toLocaleDateString('tr-TR')
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Yorumlar');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=yorumlar.xlsx');
    res.send(buf);
  } catch (err) {
    console.error(err);
    res.status(500).json({ hata: 'Excel oluşturma hatası' });
  }
});

module.exports = router;
