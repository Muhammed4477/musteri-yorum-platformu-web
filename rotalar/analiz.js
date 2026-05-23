const express = require('express');
const router = express.Router();
const { Op, fn, col, literal } = require('sequelize');
const sequelize = require('../ayarlar/veritabani');
const fetch = require('node-fetch');

const authMiddleware = require('../ara_yazilim/kimlik');
const Review = require('../modeller/Yorum');
const AnalysisResult = require('../modeller/AnalizSonucu');
const Business = require('../modeller/Isletme');

async function getReviewWhere(user, ek = {}) {
  if (user.rol === 'user') {
    const businesses = await Business.findAll({ where: { owner_id: user.id }, attributes: ['id'] });
    const ids = businesses.map(b => b.id);
    return { business_id: { [Op.in]: ids.length ? ids : [-1] }, ...ek };
  }
  return { user_id: user.id, ...ek };
}

router.get('/summary', authMiddleware, async (req, res) => {
  try {
    const { baslangic, bitis } = req.query;
    const reviewWhere = await getReviewWhere(req.user);
    if (baslangic && bitis) {
      reviewWhere.olusturma = { [Op.between]: [new Date(baslangic), new Date(bitis)] };
    }

    const userReviews = await Review.findAll({ where: reviewWhere, attributes: ['id'] });
    const reviewIds = userReviews.map(r => r.id);

    if (reviewIds.length === 0) {
      return res.json({ duygu_dagilimi: {}, konu_dagilimi: {}, aylik_trend: [], ozet: { toplam: 0, olumlu: 0, olumsuz: 0, notr: 0 } });
    }

    const duyguGrubu = await AnalysisResult.findAll({
      where: { review_id: { [Op.in]: reviewIds } },
      attributes: ['duygu', [fn('COUNT', col('duygu')), 'sayi']],
      group: ['duygu']
    });

    const konuGrubu = await AnalysisResult.findAll({
      where: { review_id: { [Op.in]: reviewIds }, konu_etiketi: { [Op.ne]: null } },
      attributes: ['konu_etiketi', [fn('COUNT', col('konu_etiketi')), 'sayi']],
      group: ['konu_etiketi'],
      order: [[literal('sayi'), 'DESC']],
      limit: 10
    });

    let trendFilter, trendReplacements;
    if (req.user.rol === 'user') {
      const businesses = await Business.findAll({ where: { owner_id: req.user.id }, attributes: ['id'] });
      const bids = businesses.map(b => b.id);
      trendFilter = 'r.business_id IN (:ids)';
      trendReplacements = { ids: bids.length ? bids : [-1] };
    } else {
      trendFilter = 'r.user_id = :userId';
      trendReplacements = { userId: req.user.id };
    }
    const aylikTrend = await sequelize.query(`
      SELECT
        TO_CHAR(r.olusturma, 'YYYY-MM') as ay,
        ar.duygu,
        COUNT(*) as sayi
      FROM reviews r
      JOIN analysis_results ar ON ar.review_id = r.id
      WHERE ${trendFilter}
      GROUP BY ay, ar.duygu
      ORDER BY ay
    `, { replacements: trendReplacements, type: sequelize.QueryTypes.SELECT });

    const duygu_dagilimi = {};
    duyguGrubu.forEach(d => { duygu_dagilimi[d.duygu] = parseInt(d.dataValues.sayi); });

    const konu_dagilimi = {};
    konuGrubu.forEach(k => { konu_dagilimi[k.konu_etiketi] = parseInt(k.dataValues.sayi); });

    const toplam = Object.values(duygu_dagilimi).reduce((a, b) => a + b, 0);

    res.json({
      duygu_dagilimi,
      konu_dagilimi,
      aylik_trend: aylikTrend,
      ozet: {
        toplam,
        olumlu: duygu_dagilimi['olumlu'] || 0,
        olumsuz: duygu_dagilimi['olumsuz'] || 0,
        notr: duygu_dagilimi['nötr'] || 0
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ hata: 'Sunucu hatası' });
  }
});

// YZ içgörü aksiyon kartları
router.get('/aksiyonlar', authMiddleware, async (req, res) => {
  try {
    if (req.user.rol !== 'user') return res.status(403).json({ hata: 'Sadece işletme sahipleri erişebilir' });
    const businesses = await Business.findAll({ where: { owner_id: req.user.id }, attributes: ['id'] });
    const bids = businesses.map(b => b.id);
    if (!bids.length) return res.json({ kartlar: [] });

    const reviewIds = (await Review.findAll({
      where: { business_id: { [Op.in]: bids } },
      attributes: ['id']
    })).map(r => r.id);

    if (!reviewIds.length) return res.json({ kartlar: [] });

    // 1. En çok şikayet edilen konu (tüm zamanlar, olumsuz)
    const enCokSikayet = await AnalysisResult.findAll({
      where: { review_id: { [Op.in]: reviewIds }, duygu: 'olumsuz', konu_etiketi: { [Op.ne]: null } },
      attributes: ['konu_etiketi', [fn('COUNT', col('konu_etiketi')), 'sayi']],
      group: ['konu_etiketi'],
      order: [[literal('sayi'), 'DESC']],
      limit: 1,
      raw: true
    });

    // 2. Son 30 günün en olumlu konusu
    const otuzGunOnce = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sonOtuzGunIds = (await Review.findAll({
      where: { business_id: { [Op.in]: bids }, olusturma: { [Op.gte]: otuzGunOnce } },
      attributes: ['id']
    })).map(r => r.id);

    let enOlumluKonu = null;
    if (sonOtuzGunIds.length) {
      const sonuc = await AnalysisResult.findAll({
        where: { review_id: { [Op.in]: sonOtuzGunIds }, duygu: 'olumlu', konu_etiketi: { [Op.ne]: null } },
        attributes: ['konu_etiketi', [fn('COUNT', col('konu_etiketi')), 'sayi']],
        group: ['konu_etiketi'],
        order: [[literal('sayi'), 'DESC']],
        limit: 1,
        raw: true
      });
      enOlumluKonu = sonuc[0] || null;
    }

    // 3. Yanıt bekleyen yorum sayısı
    const yanıtBekleyen = await Review.count({
      where: { business_id: { [Op.in]: bids }, isletme_yaniti: null }
    });

    // 4. Duygu trendi: son 14 gün vs önceki 14 gün
    const ikiHaftaOnce = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const dortHaftaOnce = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);

    const sonIkiHaftaIds = (await Review.findAll({
      where: { business_id: { [Op.in]: bids }, olusturma: { [Op.gte]: ikiHaftaOnce } },
      attributes: ['id']
    })).map(r => r.id);

    const oncekiIkiHaftaIds = (await Review.findAll({
      where: { business_id: { [Op.in]: bids }, olusturma: { [Op.between]: [dortHaftaOnce, ikiHaftaOnce] } },
      attributes: ['id']
    })).map(r => r.id);

    const trendSayisi = async (ids, duygu) => {
      if (!ids.length) return 0;
      return AnalysisResult.count({ where: { review_id: { [Op.in]: ids }, duygu } });
    };

    const [sonOlumlu, sonOlumsuz, oncekiOlumlu, oncekiOlumsuz] = await Promise.all([
      trendSayisi(sonIkiHaftaIds, 'olumlu'),
      trendSayisi(sonIkiHaftaIds, 'olumsuz'),
      trendSayisi(oncekiIkiHaftaIds, 'olumlu'),
      trendSayisi(oncekiIkiHaftaIds, 'olumsuz')
    ]);

    const trendYonu = sonOlumsuz > oncekiOlumsuz + 2 ? 'kotu' : sonOlumlu > oncekiOlumlu + 2 ? 'iyi' : 'sabit';

    const kartlar = [];

    if (enCokSikayet[0]) {
      kartlar.push({
        tip: 'uyari',
        ikon: 'bi-exclamation-triangle-fill',
        renk: 'danger',
        baslik: 'En Çok Şikayet Edilen Konu',
        metin: `"${enCokSikayet[0].konu_etiketi}" konusunda ${enCokSikayet[0].sayi} olumsuz yorum birikti.`,
        aksiyon: 'Müşteri hizmetleri süreçlerinizi gözden geçirin.'
      });
    }

    if (enOlumluKonu) {
      kartlar.push({
        tip: 'basari',
        ikon: 'bi-hand-thumbs-up-fill',
        renk: 'success',
        baslik: 'Son 30 Günün Öne Çıkan Detayı',
        metin: `"${enOlumluKonu.konu_etiketi}" konusunda ${enOlumluKonu.sayi} olumlu yorum alındı.`,
        aksiyon: 'Bu güçlü yönünüzü pazarlama materyallerinizde öne çıkarın.'
      });
    }

    if (yanıtBekleyen > 0) {
      kartlar.push({
        tip: 'bilgi',
        ikon: 'bi-chat-dots-fill',
        renk: 'warning',
        baslik: 'Yanıt Bekleyen Yorumlar',
        metin: `${yanıtBekleyen} adet müşteri yorumu henüz yanıtlanmadı.`,
        aksiyon: 'Yanıt vermek müşteri memnuniyetini %30 artırır.'
      });
    }

    const trendMetinleri = {
      kotu:  { metin: 'Son 2 haftada olumsuz yorumlar artış gösteriyor.', aksiyon: 'Ani müşteri memnuniyeti anketi yapın.', renk: 'danger', ikon: 'bi-graph-down-arrow' },
      iyi:   { metin: 'Son 2 haftada olumlu yorumlar yükselişte!', aksiyon: 'Bu momentum\'u koruyun ve müşterileri daha fazla yorum bırakmaya teşvik edin.', renk: 'success', ikon: 'bi-graph-up-arrow' },
      sabit: { metin: 'Son 2 haftada yorum trendi stabil seyrediyor.', aksiyon: 'Yeni özellikler/hizmetler ile müşteri deneyimini yükseltebilirsiniz.', renk: 'info', ikon: 'bi-bar-chart-line-fill' }
    };
    kartlar.push({ tip: 'trend', baslik: 'Duygu Trendi (14 Gün)', ...trendMetinleri[trendYonu] });

    // 5. Müşteri talep/öneri analizi — istek bildiren yorumlar
    const talepKelimeler = ['istiyorum', 'keşke', 'olsaydı', 'bekliyorum', 'eklense', 'neden yok', 'olabilir mi', 'yapılabilir', 'talep', 'istedim', 'rica', 'öneri', 'önerim'];
    const talepKosullari = talepKelimeler.map(k => ({ yorum_metni: { [Op.iLike]: `%${k}%` } }));

    const talepReviews = await Review.findAll({
      where: { business_id: { [Op.in]: bids }, [Op.or]: talepKosullari },
      attributes: ['id']
    });
    const talepIds = talepReviews.map(r => r.id);

    if (talepIds.length > 0) {
      const beklentiSonuc = await AnalysisResult.findAll({
        where: { review_id: { [Op.in]: talepIds }, konu_etiketi: { [Op.ne]: null } },
        attributes: ['konu_etiketi', [fn('COUNT', col('konu_etiketi')), 'sayi']],
        group: ['konu_etiketi'],
        order: [[literal('sayi'), 'DESC']],
        limit: 1,
        raw: true
      });
      const topKonu = beklentiSonuc[0];
      const konuMetni = topKonu ? `"${topKonu.konu_etiketi}" konusunda` : 'çeşitli konularda';
      const aksiyonMetni = topKonu
        ? `"${topKonu.konu_etiketi}" alanında somut bir geliştirme yapılması müşteri sadakatini doğrudan artırır.`
        : 'Müşteri taleplerini ürün/hizmet yol haritanıza ekleyin.';
      kartlar.push({
        tip: 'beklenti',
        ikon: 'bi-stars',
        renk: 'primary',
        baslik: 'Müşterilerin En Çok Beklediği İstek',
        metin: `Son yorum analizlerine göre müşteriler ${konuMetni} ${talepIds.length} adet yeni öneri/talep iletti.`,
        aksiyon: aksiyonMetni
      });
    }

    res.json({ kartlar });
  } catch (err) {
    console.error(err);
    res.status(500).json({ hata: 'Sunucu hatası' });
  }
});

router.post('/trigger', authMiddleware, async (req, res) => {
  const { review_ids } = req.body;
  if (!review_ids || !Array.isArray(review_ids)) return res.status(400).json({ hata: 'review_ids array gerekli' });

  try {
    const reviews = await Review.findAll({
      where: { id: { [Op.in]: review_ids }, ...(await getReviewWhere(req.user)) }
    });

    let basarili = 0;
    for (const review of reviews) {
      try {
        let duygu = 'nötr', konu_etiketi = 'Genel', guven_skoru = 0.75, ozet = review.yorum_metni.substring(0, 100);
        try {
          const body = { metin: review.yorum_metni };
          if (review.puan != null) body.yildiz = Number(review.puan);
          const resp = await fetch(process.env.YZ_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(5000)
          });
          if (resp.ok) {
            const data = await resp.json();
            duygu = data.duygu || duygu;
            konu_etiketi = data.konu || konu_etiketi;
            guven_skoru = data.guven_skoru || guven_skoru;
            ozet = data.ozet || ozet;
          }
        } catch {}

        await AnalysisResult.destroy({ where: { review_id: review.id } });
        await AnalysisResult.create({ review_id: review.id, duygu, konu_etiketi, guven_skoru, ozet });
        basarili++;
      } catch {}
    }
    res.json({ mesaj: `${basarili} yorum analiz edildi` });
  } catch (err) {
    res.status(500).json({ hata: 'Sunucu hatası' });
  }
});

router.get('/reviews-by', authMiddleware, async (req, res) => {
  try {
    const { duygu, konu } = req.query;

    if (!duygu && !konu) {
      return res.status(400).json({ hata: 'duygu veya konu parametresi gerekli' });
    }
    if (duygu && !['olumlu', 'olumsuz', 'nötr'].includes(duygu)) {
      return res.status(400).json({ hata: 'Geçersiz duygu: ' + duygu });
    }

    const reviewWhere = await getReviewWhere(req.user);
    const reviews = await Review.findAll({ where: reviewWhere, attributes: ['id'] });
    const ids = reviews.map(r => r.id);
    if (ids.length === 0) return res.json([]);

    const analizWhere = { review_id: { [Op.in]: ids } };
    if (duygu) analizWhere.duygu = duygu;
    if (konu) analizWhere.konu_etiketi = konu;

    const sonuclar = await AnalysisResult.findAll({
      where: analizWhere,
      include: [{
        model: Review,
        as: 'review',
        attributes: ['musteri_adi', 'yorum_metni', 'puan', 'olusturma', 'isletme_yaniti']
      }],
      order: [['analiz_tarihi', 'DESC']],
      limit: 150
    });
    res.json(sonuclar);
  } catch (err) {
    console.error('reviews-by hata:', err);
    res.status(500).json({ hata: 'Sunucu hatası: ' + err.message });
  }
});

router.get('/negative', authMiddleware, async (req, res) => {
  try {
    const reviews = await Review.findAll({ where: await getReviewWhere(req.user), attributes: ['id'] });
    const ids = reviews.map(r => r.id);
    const negative = await AnalysisResult.findAll({
      where: { review_id: { [Op.in]: ids }, duygu: 'olumsuz' },
      include: [{ model: Review, as: 'review', attributes: ['musteri_adi', 'yorum_metni', 'puan', 'olusturma'] }],
      order: [['analiz_tarihi', 'DESC']],
      limit: 20
    });
    res.json(negative);
  } catch (err) {
    res.status(500).json({ hata: 'Sunucu hatası' });
  }
});

module.exports = router;
