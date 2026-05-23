const express = require('express');
const router = express.Router();
const authMiddleware = require('../ara_yazilim/kimlik');
const roleMiddleware = require('../ara_yazilim/rol');
const User = require('../modeller/Kullanici');
const Review = require('../modeller/Yorum');
const AnalysisResult = require('../modeller/AnalizSonucu');
const BulkUpload = require('../modeller/TopluYukleme');
const Business = require('../modeller/Isletme');

router.use(authMiddleware, roleMiddleware);

router.get('/stats', async (req, res) => {
  try {
    const [kullanici, yorum, analiz, yukleme] = await Promise.all([
      User.count(),
      Review.count(),
      AnalysisResult.count(),
      BulkUpload.count()
    ]);
    res.json({ kullanici, yorum, analiz, yukleme });
  } catch (err) {
    res.status(500).json({ hata: 'Sunucu hatası' });
  }
});

router.get('/users', async (req, res) => {
  try {
    const where = {};
    if (req.query.rol) where.rol = req.query.rol;
    const users = await User.findAll({
      where,
      attributes: { exclude: ['sifre_hash'] },
      order: [['olusturma', 'DESC']]
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ hata: 'Sunucu hatası' });
  }
});

router.get('/businesses', async (req, res) => {
  try {
    const businesses = await Business.findAll({
      include: [{ model: User, as: 'owner', attributes: ['ad_soyad', 'email'] }],
      order: [['olusturma', 'DESC']]
    });
    res.json(businesses);
  } catch (err) {
    res.status(500).json({ hata: 'Sunucu hatası' });
  }
});

router.put('/businesses/:id', async (req, res) => {
  try {
    const b = await Business.findByPk(req.params.id);
    if (!b) return res.status(404).json({ hata: 'İşletme bulunamadı' });
    const { isletme_adi, aciklama, sehir, kategori } = req.body;
    await b.update({ isletme_adi, aciklama, sehir, kategori });
    res.json({ mesaj: 'İşletme güncellendi' });
  } catch (err) {
    res.status(500).json({ hata: 'Sunucu hatası' });
  }
});

router.delete('/businesses/:id', async (req, res) => {
  try {
    const b = await Business.findByPk(req.params.id);
    if (!b) return res.status(404).json({ hata: 'İşletme bulunamadı' });
    await b.destroy();
    res.json({ mesaj: 'İşletme silindi' });
  } catch (err) {
    res.status(500).json({ hata: 'Sunucu hatası' });
  }
});

router.get('/users/:id', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, { attributes: { exclude: ['sifre_hash'] } });
    if (!user) return res.status(404).json({ hata: 'Kullanıcı bulunamadı' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ hata: 'Sunucu hatası' });
  }
});

router.put('/users/:id', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ hata: 'Kullanıcı bulunamadı' });
    const { ad_soyad, email, rol, isletme_adi } = req.body;
    await user.update({ ad_soyad, email, rol, isletme_adi });
    res.json({ mesaj: 'Kullanıcı güncellendi' });
  } catch (err) {
    res.status(500).json({ hata: 'Sunucu hatası' });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ hata: 'Kullanıcı bulunamadı' });
    await user.destroy();
    res.json({ mesaj: 'Kullanıcı silindi' });
  } catch (err) {
    res.status(500).json({ hata: 'Sunucu hatası' });
  }
});

router.get('/reviews', async (req, res) => {
  try {
    const reviews = await Review.findAll({
      include: [
        { model: User, as: 'user', attributes: ['ad_soyad', 'email'] },
        { model: AnalysisResult, as: 'analiz', attributes: ['duygu'] }
      ],
      order: [['olusturma', 'DESC']],
      limit: 200
    });
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ hata: 'Sunucu hatası' });
  }
});

router.delete('/reviews/:id', async (req, res) => {
  try {
    const review = await Review.findByPk(req.params.id);
    if (!review) return res.status(404).json({ hata: 'Yorum bulunamadı' });
    await AnalysisResult.destroy({ where: { review_id: review.id } });
    await review.destroy();
    res.json({ mesaj: 'Yorum silindi' });
  } catch (err) {
    res.status(500).json({ hata: 'Sunucu hatası' });
  }
});

module.exports = router;
