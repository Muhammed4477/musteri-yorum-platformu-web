process.env.LANG = 'tr_TR.UTF-8';
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const sequelize = require('./ayarlar/veritabani');

const User = require('./modeller/Kullanici');
const Review = require('./modeller/Yorum');
const Category = require('./modeller/Kategori');
const AnalysisResult = require('./modeller/AnalizSonucu');
const BulkUpload = require('./modeller/TopluYukleme');
const Business = require('./modeller/Isletme');

// İlişkiler
User.hasMany(Review, { foreignKey: 'user_id', as: 'reviews' });
Review.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

Category.hasMany(Review, { foreignKey: 'kategori_id', as: 'reviews' });
Review.belongsTo(Category, { foreignKey: 'kategori_id', as: 'category' });

Review.hasOne(AnalysisResult, { foreignKey: 'review_id', as: 'analiz' });
AnalysisResult.belongsTo(Review, { foreignKey: 'review_id', as: 'review' });

User.hasMany(BulkUpload, { foreignKey: 'user_id', as: 'uploads' });
BulkUpload.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// İşletme ilişkileri
User.hasMany(Business, { foreignKey: 'owner_id', as: 'businesses' });
Business.belongsTo(User, { foreignKey: 'owner_id', as: 'owner' });

Business.hasMany(Review, { foreignKey: 'business_id', as: 'reviews' });
Review.belongsTo(Business, { foreignKey: 'business_id', as: 'business' });

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
// HTML cache'i kapat (sadece HTML için), JSON content-type'ı static dosyaları bozmasın
app.use((req, res, next) => {
  if (req.path.endsWith('.html') || req.path.endsWith('/')) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
  next();
});
app.use(express.static(path.join(__dirname, 'arayuz'), { etag: false, lastModified: false }));

// Routes
app.use('/api/auth', require('./rotalar/kimlik'));
app.use('/api/reviews', require('./rotalar/yorumlar'));
app.use('/api/analysis', require('./rotalar/analiz'));
app.use('/api/reports', require('./rotalar/raporlar'));
app.use('/api/admin', require('./rotalar/yonetici'));
app.use('/api/businesses', require('./rotalar/isletmeler'));
app.use('/api/musteri', require('./rotalar/musteri'));

// Kategoriler
app.get('/api/categories', async (req, res) => {
  try {
    const cats = await Category.findAll();
    res.json(cats);
  } catch (err) {
    res.status(500).json({ hata: 'Sunucu hatası' });
  }
});

// İstatistikler (anasayfa için)
app.get('/api/stats/public', async (req, res) => {
  try {
    const [kullanici, yorum, analiz] = await Promise.all([
      User.count(),
      Review.count(),
      AnalysisResult.count()
    ]);
    res.json({ kullanici, yorum, analiz });
  } catch {
    res.json({ kullanici: 0, yorum: 0, analiz: 0 });
  }
});

// SPA fallback - HTML sayfaları
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'arayuz', 'index.html'));
  } else {
    res.status(404).json({ hata: 'Endpoint bulunamadı' });
  }
});

const PORT = process.env.PORT || 3000;

const kategoriler = [
  { kategori_adi: 'Hizmet', aciklama: 'Müşteri hizmetleri ile ilgili yorumlar' },
  { kategori_adi: 'Ürün', aciklama: 'Ürün kalitesi ile ilgili yorumlar' },
  { kategori_adi: 'Fiyat', aciklama: 'Fiyatlandırma ile ilgili yorumlar' },
  { kategori_adi: 'Hijyen', aciklama: 'Temizlik ve hijyen ile ilgili yorumlar' },
  { kategori_adi: 'Teslimat', aciklama: 'Teslimat ve kargo ile ilgili yorumlar' }
];

sequelize.sync({ alter: true })
  .then(async () => {
    console.log('Veritabanı bağlantısı başarılı');
    for (const kat of kategoriler) {
      await Category.findOrCreate({ where: { kategori_adi: kat.kategori_adi }, defaults: kat });
    }
    console.log('Kategoriler hazır');

    // Varsayılan "Genel" işletmesi oluştur ve sahipsiz yorumları ona ata
    const [genel] = await Business.findOrCreate({
      where: { isletme_adi: 'Genel' },
      defaults: { isletme_adi: 'Genel', aciklama: 'Eski yorumlar için varsayılan işletme', kategori: 'Diğer' }
    });
    await Review.update({ business_id: genel.id }, { where: { business_id: null } });

    // İşletme sahibi (user) kullanıcılar için otomatik işletme oluştur
    const userlar = await User.findAll({ where: { rol: 'user' } });
    for (const u of userlar) {
      const mevcut = await Business.findOne({ where: { owner_id: u.id } });
      if (!mevcut) {
        await Business.create({
          owner_id: u.id,
          isletme_adi: u.isletme_adi || (u.ad_soyad + ' İşletmesi'),
          kategori: 'Genel'
        });
      }
    }
    console.log('İşletmeler hazır');

    app.listen(PORT, () => {
      console.log(`Sunucu http://localhost:${PORT} adresinde çalışıyor`);
    });
  })
  .catch(err => {
    console.error('Veritabanı bağlantı hatası:', err.message);
    process.exit(1);
  });
