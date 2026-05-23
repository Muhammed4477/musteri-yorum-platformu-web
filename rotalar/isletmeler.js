const express = require('express');
const router = express.Router();
const { Op, fn, col } = require('sequelize');
const Business = require('../modeller/Isletme');
const Review = require('../modeller/Yorum');
const AnalysisResult = require('../modeller/AnalizSonucu');
const User = require('../modeller/Kullanici');

// Genel işletme listesi (herkes görebilir)
router.get('/', async (req, res) => {
  try {
    const { arama, sehir, kategori } = req.query;
    const where = {};
    if (arama) where.isletme_adi = { [Op.iLike]: `%${arama}%` };
    if (sehir) where.sehir = sehir;
    if (kategori) where.kategori = kategori;

    const businesses = await Business.findAll({
      where,
      order: [['olusturma', 'DESC']]
    });

    // Her işletme için yorum sayısı ve ortalama puan
    const ids = businesses.map(b => b.id);
    const stats = ids.length ? await Review.findAll({
      where: { business_id: { [Op.in]: ids } },
      attributes: [
        'business_id',
        [fn('COUNT', col('id')), 'yorum_sayisi'],
        [fn('AVG', col('puan')), 'ortalama_puan']
      ],
      group: ['business_id'],
      raw: true
    }) : [];

    const statsMap = {};
    stats.forEach(s => { statsMap[s.business_id] = s; });

    const result = businesses.map(b => ({
      ...b.toJSON(),
      yorum_sayisi: parseInt(statsMap[b.id]?.yorum_sayisi || 0),
      ortalama_puan: parseFloat(statsMap[b.id]?.ortalama_puan || 0).toFixed(1)
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ hata: 'Sunucu hatası' });
  }
});

// İşletme detayı + son yorumlar
router.get('/:id', async (req, res) => {
  try {
    const business = await Business.findByPk(req.params.id, {
      include: [{ model: User, as: 'owner', attributes: ['ad_soyad'] }]
    });
    if (!business) return res.status(404).json({ hata: 'İşletme bulunamadı' });

    const reviews = await Review.findAll({
      where: { business_id: business.id },
      include: [
        { model: AnalysisResult, as: 'analiz', attributes: ['duygu', 'konu_etiketi'] },
        { model: User, as: 'user', attributes: ['ad_soyad'] }
      ],
      order: [['olusturma', 'DESC']],
      limit: 50
    });

    const toplam = reviews.length;
    const olumlu = reviews.filter(r => r.analiz && r.analiz.duygu === 'olumlu').length;
    const olumsuz = reviews.filter(r => r.analiz && r.analiz.duygu === 'olumsuz').length;
    const ortalama = toplam ? reviews.reduce((a, r) => a + (r.puan || 0), 0) / toplam : 0;

    res.json({
      isletme: business,
      ozet: { toplam, olumlu, olumsuz, ortalama: ortalama.toFixed(1) },
      yorumlar: reviews
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ hata: 'Sunucu hatası' });
  }
});

module.exports = router;
