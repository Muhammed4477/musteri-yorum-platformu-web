const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const authMiddleware = require('../ara_yazilim/kimlik');
const { authorize } = require('../ara_yazilim/rol');
const Review = require('../modeller/Yorum');
const AnalysisResult = require('../modeller/AnalizSonucu');
const Business = require('../modeller/Isletme');
const User = require('../modeller/Kullanici');

// YZ analiz fonksiyonu (reviews.js ile aynı mantık)
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

// Müşterinin işletmeye yorum bırakması
router.post('/yorum', authMiddleware, authorize(['musteri']), async (req, res) => {
  try {
    const { business_id, yorum_metni, puan } = req.body;
    if (!yorum_metni) return res.status(400).json({ hata: 'Yorum metni zorunlu' });
    if (!business_id) return res.status(400).json({ hata: 'İşletme seçimi zorunlu' });

    const business = await Business.findByPk(business_id);
    if (!business) return res.status(404).json({ hata: 'İşletme bulunamadı' });

    const review = await Review.create({
      user_id: req.user.id,
      business_id,
      musteri_adi: req.user.ad_soyad,
      yorum_metni,
      puan,
      kaynak: 'manuel'
    });

    // YZ analiz tetikle
    yzAnaliz(yorum_metni, puan, review.id).catch(console.error);
    res.status(201).json({ mesaj: 'Yorumunuz alındı, analiz başlatıldı', review });
  } catch (err) {
    console.error(err);
    res.status(500).json({ hata: 'Sunucu hatası' });
  }
});

// Müşterinin kendi yorumları
router.get('/yorumlarim', authMiddleware, authorize(['musteri']), async (req, res) => {
  try {
    const yorumlar = await Review.findAll({
      where: { user_id: req.user.id },
      include: [
        { model: Business, as: 'business', attributes: ['id', 'isletme_adi', 'sehir'] },
        { model: AnalysisResult, as: 'analiz', attributes: ['duygu', 'konu_etiketi'] }
      ],
      order: [['olusturma', 'DESC']]
    });
    res.json(yorumlar);
  } catch (err) {
    console.error(err);
    res.status(500).json({ hata: 'Sunucu hatası' });
  }
});

// Müşterinin yorumunu silmesi
router.delete('/yorum/:id', authMiddleware, authorize(['musteri']), async (req, res) => {
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

module.exports = router;
