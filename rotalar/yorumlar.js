const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');
const { Op } = require('sequelize');

const authMiddleware = require('../ara_yazilim/kimlik');
const Review = require('../modeller/Yorum');
const Category = require('../modeller/Kategori');
const AnalysisResult = require('../modeller/AnalizSonucu');
const BulkUpload = require('../modeller/TopluYukleme');
const Business = require('../modeller/Isletme');

// İşletme sahibinin kendi business_id'sini getirir
async function getUserBusinessIds(userId) {
  const businesses = await Business.findAll({ where: { owner_id: userId }, attributes: ['id'] });
  return businesses.map(b => b.id);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

async function yzAnaliz(text, puan, reviewId) {
  try {
    const body = { metin: text };
    if (puan != null) body.yildiz = Number(puan);
    const resp = await fetch(process.env.YZ_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000)
    });
    if (!resp.ok) throw new Error('YZ API yanıt vermedi');
    const data = await resp.json();
    const konu = data.konu || null;
    await AnalysisResult.create({
      review_id: reviewId,
      duygu: data.duygu || 'nötr',
      konu_etiketi: konu,
      guven_skoru: data.guven_skoru || null,
      ozet: data.ozet || null
    });
    if (konu) await Review.update({ konu_etiketi: konu }, { where: { id: reviewId } });
  } catch (e) {
    // YZ API yoksa fallback: yıldız puanı birincil sinyal, metin ikincil
    const pozitif = ['harika', 'mükemmel', 'güzel', 'iyi', 'teşekkür', 'başarılı', 'süper', 'sevdim', 'tavsiye'];
    const negatif = ['kötü', 'berbat', 'rezalet', 'şikay', 'sorun', 'problem', 'hata', 'yavaş', 'gelmedi', 'beğenmed', 'kalitesiz', 'hayal kırıklığı'];
    const mockKonular = { hizmet: 'Hizmet Hızı', ürün: 'Ürün Kalitesi', fiyat: 'Fiyat', temizlik: 'Hijyen', teslimat: 'Teslimat', paket: 'Paketleme', kahve: 'Kahve Lezzeti', yemek: 'Yemek Kalitesi' };
    const lower = text.toLowerCase();
    const konu = Object.entries(mockKonular).find(([k]) => lower.includes(k))?.[1] || 'Genel';

    let duygu, guven_skoru;
    const p = puan != null ? Number(puan) : null;

    // Yıldız puanı kesin geçersiz kılma: 1-2 olumsuz, 4-5 olumlu
    if (p !== null && p >= 4) {
      duygu = 'olumlu';
      guven_skoru = p === 5 ? 0.95 : 0.85;
    } else if (p !== null && p <= 2) {
      duygu = 'olumsuz';
      guven_skoru = p === 1 ? 0.95 : 0.85;
    } else {
      // Puan 3 ya da yok: metin sinyaline bak
      const posHit = pozitif.some(k => lower.includes(k));
      const negHit = negatif.some(k => lower.includes(k));
      if (posHit && !negHit) { duygu = 'olumlu'; guven_skoru = 0.70; }
      else if (negHit && !posHit) { duygu = 'olumsuz'; guven_skoru = 0.70; }
      else { duygu = 'nötr'; guven_skoru = p === 3 ? 0.65 : 0.55; }
    }

    await AnalysisResult.create({
      review_id: reviewId,
      duygu,
      konu_etiketi: konu,
      guven_skoru,
      ozet: text.substring(0, 100)
    });
    await Review.update({ konu_etiketi: konu }, { where: { id: reviewId } });
  }
}

// Konum (il/ilçe) bazlı istatistik
router.get('/konum-istatistik', authMiddleware, async (req, res) => {
  try {
    let businessWhere = {};
    if (req.user.rol === 'user') {
      const businessIds = await getUserBusinessIds(req.user.id);
      businessWhere.id = { [Op.in]: businessIds.length ? businessIds : [-1] };
    }

    const businesses = await Business.findAll({
      where: businessWhere,
      attributes: ['id', 'sehir', 'ilce', 'isletme_adi']
    });

    const ids = businesses.map(b => b.id);
    const businessMap = {};
    businesses.forEach(b => { businessMap[b.id] = b; });

    const reviews = ids.length ? await Review.findAll({
      where: { business_id: { [Op.in]: ids } },
      attributes: ['business_id'],
      raw: true
    }) : [];

    // İl bazında gruplama
    const ilSayac = {};
    reviews.forEach(r => {
      const b = businessMap[r.business_id];
      if (b && b.sehir) {
        const key = b.sehir;
        if (!ilSayac[key]) ilSayac[key] = { sehir: b.sehir, ilceler: {}, toplam: 0 };
        ilSayac[key].toplam++;
        if (b.ilce) {
          const ilceKey = b.ilce;
          ilSayac[key].ilceler[ilceKey] = (ilSayac[key].ilceler[ilceKey] || 0) + 1;
        }
      }
    });

    const sonuc = Object.values(ilSayac)
      .map(item => ({
        sehir: item.sehir,
        toplam: item.toplam,
        ilceler: Object.entries(item.ilceler)
          .map(([ilce, sayi]) => ({ ilce, sayi }))
          .sort((a, b) => b.sayi - a.sayi)
      }))
      .sort((a, b) => b.toplam - a.toplam);

    res.json(sonuc);
  } catch (err) {
    console.error(err);
    res.status(500).json({ hata: 'Sunucu hatası' });
  }
});

router.get('/', authMiddleware, async (req, res) => {
  try {
    const { arama, kategori_id, puan, baslangic, bitis, sehir, ilce, sayfa = 1, limit = 10 } = req.query;
    // İşletme sahibi (user) → kendi business_id'lerine gelen yorumlar
    // Müşteri/diğer → kendi yazdığı yorumlar
    let where = {};
    if (req.user.rol === 'user') {
      const businessIds = await getUserBusinessIds(req.user.id);
      where.business_id = { [Op.in]: businessIds.length ? businessIds : [-1] };
    } else {
      where.user_id = req.user.id;
    }
    if (arama) where.yorum_metni = { [Op.iLike]: `%${arama}%` };
    if (kategori_id) where.kategori_id = kategori_id;
    if (puan) where.puan = puan;
    if (baslangic && bitis) where.olusturma = { [Op.between]: [new Date(baslangic), new Date(bitis)] };

    // İşletme konumu filtresi
    const businessWhere = {};
    if (sehir) businessWhere.sehir = sehir;
    if (ilce) businessWhere.ilce = ilce;
    const businessFilter = Object.keys(businessWhere).length > 0;

    const offset = (parseInt(sayfa) - 1) * parseInt(limit);
    const { count, rows } = await Review.findAndCountAll({
      where,
      include: [
        { model: Category, as: 'category', attributes: ['kategori_adi'] },
        { model: AnalysisResult, as: 'analiz', attributes: ['duygu', 'konu_etiketi', 'guven_skoru'] },
        {
          model: Business,
          as: 'business',
          attributes: ['isletme_adi', 'sehir', 'ilce'],
          where: businessFilter ? businessWhere : undefined,
          required: businessFilter
        }
      ],
      order: [['olusturma', 'DESC']],
      limit: parseInt(limit),
      offset
    });
    res.json({ toplam: count, sayfa: parseInt(sayfa), limit: parseInt(limit), yorumlar: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ hata: 'Sunucu hatası' });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  if (req.user.rol === 'user') {
    return res.status(403).json({ hata: 'İşletme sahipleri tekil yorum ekleyemez. Toplu yükleme için /yorumlar/yukleme.html kullanın.' });
  }
  try {
    const { musteri_adi, yorum_metni, puan, kategori_id, kaynak } = req.body;
    if (!yorum_metni) return res.status(400).json({ hata: 'Yorum metni gerekli' });

    // İşletme sahibinin kendi business_id'sini bul
    let business_id = null;
    if (req.user.rol === 'user') {
      const ids = await getUserBusinessIds(req.user.id);
      business_id = ids[0] || null;
    }

    const review = await Review.create({
      user_id: req.user.id,
      business_id,
      musteri_adi,
      yorum_metni,
      puan,
      kategori_id,
      kaynak: kaynak || 'manuel'
    });

    yzAnaliz(yorum_metni, puan, review.id).catch(console.error);
    res.status(201).json(review);
  } catch (err) {
    console.error(err);
    res.status(500).json({ hata: 'Sunucu hatası' });
  }
});

// İşletme sahibinin yoruma yanıt vermesi
router.put('/:id/yanit', authMiddleware, async (req, res) => {
  try {
    if (req.user.rol !== 'user') return res.status(403).json({ hata: 'Sadece işletme sahipleri yanıt verebilir' });
    const businessIds = await getUserBusinessIds(req.user.id);
    const review = await Review.findOne({ where: { id: req.params.id, business_id: { [Op.in]: businessIds.length ? businessIds : [-1] } } });
    if (!review) return res.status(404).json({ hata: 'Yorum bulunamadı veya yetkiniz yok' });
    const { isletme_yaniti } = req.body;
    if (typeof isletme_yaniti !== 'string') return res.status(400).json({ hata: 'Yanıt metni gerekli' });
    await review.update({ isletme_yaniti: isletme_yaniti.trim() || null });
    res.json({ mesaj: 'Yanıt kaydedildi', isletme_yaniti: review.isletme_yaniti });
  } catch (err) {
    console.error(err);
    res.status(500).json({ hata: 'Sunucu hatası' });
  }
});

router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const review = await Review.findOne({ where: { id: req.params.id, user_id: req.user.id } });
    if (!review) return res.status(404).json({ hata: 'Yorum bulunamadı' });
    await review.update(req.body);
    res.json(review);
  } catch (err) {
    res.status(500).json({ hata: 'Sunucu hatası' });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const review = await Review.findOne({ where: { id: req.params.id, user_id: req.user.id } });
    if (!review) return res.status(404).json({ hata: 'Yorum bulunamadı' });
    await AnalysisResult.destroy({ where: { review_id: review.id } });
    await review.destroy();
    res.json({ mesaj: 'Yorum silindi' });
  } catch (err) {
    res.status(500).json({ hata: 'Sunucu hatası' });
  }
});

router.post('/upload', authMiddleware, upload.single('dosya'), async (req, res) => {
  if (!req.file) return res.status(400).json({ hata: 'Dosya gerekli' });
  try {
    const ext = path.extname(req.file.originalname).toLowerCase();
    let workbook;

    if (ext === '.csv') {
      // CSV: UTF-8 oku, BOM'u regex ile temizle
      let content = fs.readFileSync(req.file.path, { encoding: 'utf-8' });
      content = content.replace(/^﻿/, '');
      workbook = XLSX.read(content, { type: 'string', raw: false, codepage: 65001 });
    } else {
      // Excel: buffer üzerinden UTF-8 codepage ile oku
      const buffer = fs.readFileSync(req.file.path);
      workbook = XLSX.read(buffer, { type: 'buffer', codepage: 65001 });
    }

    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet);

    // İşletme sahibinin business_id'si
    let business_id = null;
    if (req.user.rol === 'user') {
      const ids = await getUserBusinessIds(req.user.id);
      business_id = ids[0] || null;
    }

    let basarili = 0, hatali = 0;
    for (const row of rows) {
      try {
        const yorum_metni = row['yorum_metni'] || row['yorum'] || row['Yorum'] || row['comment'];
        if (!yorum_metni) { hatali++; continue; }
        const review = await Review.create({
          user_id: req.user.id,
          business_id,
          musteri_adi: row['musteri_adi'] || row['musteri'] || null,
          yorum_metni,
          puan: row['puan'] || null,
          kaynak: 'csv'
        });
        yzAnaliz(yorum_metni, row['puan'] || null, review.id).catch(console.error);
        basarili++;
      } catch { hatali++; }
    }

    await BulkUpload.create({
      user_id: req.user.id,
      dosya_adi: req.file.originalname,
      toplam_satir: rows.length,
      basarili,
      hatali
    });

    fs.unlinkSync(req.file.path);
    res.json({ mesaj: 'Yükleme tamamlandı', toplam: rows.length, basarili, hatali });
  } catch (err) {
    console.error(err);
    res.status(500).json({ hata: 'Dosya işleme hatası' });
  }
});

module.exports = router;
