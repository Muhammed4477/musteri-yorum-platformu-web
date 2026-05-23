# 🛍️ MüşteriYorum Platformu
## Türkçe Müşteri Yorumlarını Yapay Zeka ile Analiz Eden Çok Rollü Web Platformu

> **Muhammed Çelik** — İnternet Programcılığı Dersi Dönem Projesi  
> Stack: `Node.js` · `Express` · `PostgreSQL` · `Sequelize` · `Python FastAPI` · `Bootstrap 5`

---

## 🎯 Proje Hakkında

MüşteriYorum; müşterilerin işletmelere yorum bırakabildiği, işletme sahiplerinin bu yorumları yönetip analiz edebildiği ve yöneticilerin sistemi denetleyebildiği **üç katmanlı** bir web uygulamasıdır.

Her yorum sisteme eklendiğinde arka planda **Python FastAPI** servisi devreye girer: yorum metni **TF-IDF + Lojistik Regresyon** modelinden geçer ve otomatik olarak `olumlu / olumsuz / nötr` etiketiyle birlikte konu etiketiyle kaydedilir. İşletme sahibi panelinde bu etiketler grafik raporlara dönüşür.

---

## ✨ Özellikler

### 👤 Müşteri
- İşletmeleri ada, şehre ve kategoriye göre arama / filtreleme
- Yıldız puanı + metin ile yorum bırakma
- Geçmiş yorumları görüntüleme ve silme
- Profil güncelleme · Hesap silme

### 🏪 İşletme Sahibi
- Gelen yorumları duygu renk kodlamasıyla listeleme *(yeşil / kırmızı / sarı)*
- Yorumlara resmi yanıt yazma
- **CSV ile toplu yorum yükleme** — tek seferde yüzlerce yorum
- Grafik tabanlı duygu dağılımı raporu
- Profil güncelleme · Hesap silme

### 🔐 Yönetici
- Tüm kullanıcıları, işletmeleri ve yorumları yönetme
- Sistem geneli istatistikleri görüntüleme

### 🤖 Yapay Zeka
- TF-IDF + Lojistik Regresyon ile Türkçe duygu sınıflandırma
- Konu etiketleme: **hizmet · fiyat · ürün · hijyen · teslimat**
- SMOTE ile sınıf dengesi — olumsuz yorumlar gözden kaçmaz

### 🔌 API
- JWT + rol tabanlı kimlik doğrulama *(müşteri / isletme_sahibi / admin)*
- **Swagger UI** entegreli geliştirici dokümantasyon sayfası

---

## 🗂️ Teknoloji Yığını

| Katman | Teknoloji |
|---|---|
| 🖥️ Sunucu | Node.js · Express.js |
| 🗄️ Veritabanı | PostgreSQL · Sequelize ORM |
| 🔑 Kimlik Doğrulama | JWT · bcryptjs |
| 📁 Dosya Yükleme | Multer |
| 🤖 Yapay Zeka | Python · FastAPI · scikit-learn |
| 🎨 Arayüz | HTML5 · Bootstrap 5 · Vanilla JS |

---

## 🚀 Kurulum

### Gereksinimler

| Araç | Minimum Sürüm |
|---|---|
| Node.js | ≥ 18 |
| PostgreSQL | ≥ 14 |
| Python *(opsiyonel)* | ≥ 3.10 |

---

### 1 — Depoyu klonla

```bash
git clone https://github.com/KULLANICI_ADIN/musteri-yorum-platformu.git
cd musteri-yorum-platformu
```

### 2 — Node bağımlılıklarını yükle

```bash
npm install
```

### 3 — Ortam değişkenlerini ayarla

```bash
cp .env.example .env
```

`.env` dosyasını açıp kendi bilgilerini gir:

```env
PORT=3000

DB_HOST=localhost
DB_PORT=5432
DB_NAME=musteri_yorum
DB_USER=kullanici_adiniz
DB_PASS=sifreniz

JWT_SECRET=guclu_rastgele_bir_anahtar_buraya
JWT_EXPIRE=7d

YZ_API_URL=http://localhost:8000/api/analyze
```

### 4 — Veritabanını oluştur

```sql
CREATE DATABASE musteri_yorum;
```

> Tablolar ilk çalıştırmada Sequelize tarafından **otomatik oluşturulur** — elle migration gerekmez.

### 5 — Sunucuyu başlat

```bash
npm run dev    # geliştirme — nodemon ile otomatik yeniden başlatma
npm start      # üretim
```

Uygulama `http://localhost:3000` adresinde çalışır.

---

### 🤖 Yapay Zeka Servisi *(Opsiyonel)*

> Servis olmadan platform çalışmaya devam eder. Servis yokken yorum analizleri **beklemede** kalır; panel geri kalanı sorunsuz çalışır.

```bash
# Bağımlılıkları yükle
pip install fastapi uvicorn scikit-learn pandas

# Servisi başlat
uvicorn main:app --host 0.0.0.0 --port 8000
```

---

## 📁 Proje Yapısı

```
musteri-yorum-platformu/
│
├── sunucu.js                  # Express giriş noktası
├── package.json
├── .env.example               # Şablon — kopyalayıp .env yap
│
├── ayarlar/
│   └── veritabani.js          # Sequelize bağlantı ayarları
│
├── modeller/                  # Sequelize (ORM) modelleri
│   ├── Kullanici.js
│   ├── Isletme.js
│   ├── Yorum.js
│   ├── AnalizSonucu.js
│   ├── TopluYukleme.js
│   └── Kategori.js
│
├── rotalar/                   # API uç noktaları
│   ├── kimlik.js              # /api/auth  →  kayıt · giriş · profil · sil
│   ├── isletmeler.js          # /api/businesses
│   ├── musteri.js             # /api/musteri
│   ├── yorumlar.js            # /api/isletme  →  yorum yönetimi
│   ├── analiz.js              # /api/analiz
│   ├── raporlar.js            # /api/raporlar
│   └── yonetici.js            # /api/yonetici
│
├── ara_yazilim/
│   ├── kimlik.js              # JWT doğrulama middleware
│   └── rol.js                 # Rol kontrol middleware
│
├── arayuz/                    # Statik frontend
│   ├── index.html             # Açılış sayfası
│   ├── giris.html             # Giriş / Kayıt
│   ├── musteri/               # Müşteri paneli (sidebar layout)
│   ├── panel/                 # İşletme sahibi paneli
│   ├── yonetici/              # Yönetici paneli
│   ├── gelistirici/           # Swagger UI — canlı API testi
│   ├── betikler/              # Ortak JS  →  ana.js · altbilgi.js
│   └── stiller/               # Ortak CSS  →  stil.css
│
└── uploads/                   # Yüklenen CSV'ler  (git'e dahil değil)
```

---

## 🔌 API Uç Noktaları

### Kimlik Doğrulama — `/api/auth`

| Yöntem | Uç Nokta | Açıklama | Auth |
|---|---|---|---|
| `POST` | `/api/auth/kayit` | Yeni hesap oluştur | — |
| `POST` | `/api/auth/giris` | Giriş yap · JWT al | — |
| `GET` | `/api/auth/me` | Oturum bilgisi | ✅ |
| `PUT` | `/api/auth/me` | Profil güncelle | ✅ |
| `DELETE` | `/api/auth/me` | Hesabı kalıcı sil | ✅ |

### İşletmeler — `/api/businesses`

| Yöntem | Uç Nokta | Açıklama | Auth |
|---|---|---|---|
| `GET` | `/api/businesses` | Tüm işletmeleri listele | — |
| `GET` | `/api/businesses/:id` | İşletme detayı + yorumlar | — |

### Müşteri — `/api/musteri`

| Yöntem | Uç Nokta | Açıklama | Auth |
|---|---|---|---|
| `POST` | `/api/musteri/yorum` | Yorum bırak | ✅ müşteri |
| `GET` | `/api/musteri/yorumlarim` | Kendi yorumlarım | ✅ müşteri |
| `DELETE` | `/api/musteri/yorum/:id` | Yorumu sil | ✅ müşteri |

### İşletme Sahibi — `/api/isletme`

| Yöntem | Uç Nokta | Açıklama | Auth |
|---|---|---|---|
| `GET` | `/api/isletme/yorumlar` | Gelen yorumlar | ✅ isletme |
| `POST` | `/api/isletme/yanit/:id` | Yoruma yanıt yaz | ✅ isletme |
| `POST` | `/api/isletme/toplu-yukle` | CSV ile toplu yükleme | ✅ isletme |
| `GET` | `/api/raporlar/duygu` | Duygu dağılımı raporu | ✅ isletme |

> 📖 Tam dokümantasyon ve **canlı API testi** için `http://localhost:3000/gelistirici/` adresini ziyaret et.

---

## 🚦 Hızlı Başlangıç Kontrol Listesi

| # | Adım | Komut |
|---|---|---|
| ☐ | Repoyu klonla | `git clone ...` |
| ☐ | Bağımlılıkları yükle | `npm install` |
| ☐ | `.env` dosyasını oluştur | `cp .env.example .env` |
| ☐ | Veritabanını oluştur | `CREATE DATABASE musteri_yorum;` |
| ☐ | Sunucuyu başlat | `npm run dev` |
| ☐ | *(Opsiyonel)* YZ servisini başlat | `uvicorn main:app --port 8000` |
| ☐ | Tarayıcıda aç | `http://localhost:3000` |

---

## 📄 Lisans

Bu proje **İnternet Programcılığı** dersi kapsamında akademik amaçla geliştirilmiştir.
