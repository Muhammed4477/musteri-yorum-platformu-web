const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../modeller/Kullanici');
const Business = require('../modeller/Isletme');
const authMiddleware = require('../ara_yazilim/kimlik');

router.post('/register', [
  body('ad_soyad').notEmpty().withMessage('Ad soyad gerekli'),
  body('email').isEmail().withMessage('Geçerli email girin'),
  body('sifre').isLength({ min: 6 }).withMessage('Şifre en az 6 karakter olmalı')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ hatalar: errors.array() });

  const { ad_soyad, email, sifre, isletme_adi, rol, sehir, ilce, kategori } = req.body;
  try {
    const mevcut = await User.findOne({ where: { email } });
    if (mevcut) return res.status(400).json({ hata: 'Bu email zaten kayıtlı' });

    // Rol kontrolü: kayıt sırasında sadece 'musteri' veya 'user' seçilebilir, admin değil
    const secilenRol = (rol === 'musteri' || rol === 'user') ? rol : 'user';

    // İşletme sahibi olarak kayıt için işletme adı zorunlu
    if (secilenRol === 'user' && !isletme_adi) {
      return res.status(400).json({ hata: 'İşletme sahibi kaydı için işletme adı zorunludur' });
    }

    const sifre_hash = await bcrypt.hash(sifre, 10);
    const user = await User.create({ ad_soyad, email, sifre_hash, isletme_adi, rol: secilenRol });

    // İşletme sahibiyse otomatik bir businesses kaydı oluştur
    if (secilenRol === 'user') {
      await Business.create({
        owner_id: user.id,
        isletme_adi: isletme_adi,
        sehir: sehir || null,
        ilce: ilce || null,
        kategori: kategori || 'Genel'
      });
    }

    const token = jwt.sign({ id: user.id, rol: user.rol }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE });
    res.status(201).json({ token, kullanici: { id: user.id, ad_soyad: user.ad_soyad, email: user.email, rol: user.rol, isletme_adi: user.isletme_adi } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ hata: 'Sunucu hatası' });
  }
});

router.post('/login', [
  body('email').isEmail(),
  body('sifre').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ hatalar: errors.array() });

  const { email, sifre } = req.body;
  try {
    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(400).json({ hata: 'Email veya şifre hatalı' });

    const eslesen = await bcrypt.compare(sifre, user.sifre_hash);
    if (!eslesen) return res.status(400).json({ hata: 'Email veya şifre hatalı' });

    const token = jwt.sign({ id: user.id, rol: user.rol }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE });
    res.json({ token, kullanici: { id: user.id, ad_soyad: user.ad_soyad, email: user.email, rol: user.rol, isletme_adi: user.isletme_adi } });
  } catch (err) {
    res.status(500).json({ hata: 'Sunucu hatası' });
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  res.json({
    id: req.user.id,
    ad_soyad: req.user.ad_soyad,
    email: req.user.email,
    rol: req.user.rol,
    isletme_adi: req.user.isletme_adi,
    olusturma: req.user.olusturma
  });
});

router.put('/me', authMiddleware, async (req, res) => {
  const { ad_soyad, isletme_adi, email, yeni_sifre } = req.body;
  try {
    const update = {};
    if (ad_soyad) update.ad_soyad = ad_soyad;
    if (isletme_adi) update.isletme_adi = isletme_adi;
    if (email) update.email = email;
    if (yeni_sifre) update.sifre_hash = await bcrypt.hash(yeni_sifre, 10);
    await req.user.update(update);
    res.json({ mesaj: 'Profil güncellendi' });
  } catch (err) {
    res.status(500).json({ hata: 'Sunucu hatası' });
  }
});

router.delete('/me', authMiddleware, async (req, res) => {
  try {
    await req.user.destroy();
    res.json({ mesaj: 'Hesap silindi' });
  } catch (err) {
    res.status(500).json({ hata: 'Sunucu hatası' });
  }
});

module.exports = router;
