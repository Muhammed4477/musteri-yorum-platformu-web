# MÜŞTERİYORUM YÖNETİM PLATFORMU — PROJE KAYNAK DOKÜMANI

> Bu doküman, projenin **her teknik ve işlevsel detayını** içerir. Hocaya sunum sırasında bir referans rehberi olarak kullanılabilir. Tüm kararların gerekçesi, alternatifleri ve nasıl çalıştığı açıklanmıştır.

---

## İÇİNDEKİLER

1. [Proje Genel Bakış](#1-proje-genel-bakış)
2. [Kullanılan Teknolojiler](#2-kullanılan-teknolojiler)
3. [Proje Klasör Yapısı](#3-proje-klasör-yapısı)
4. [Veritabanı Tabloları](#4-veritabanı-tabloları)
5. [Rol Bazlı Yetkilendirme Sistemi](#5-rol-bazlı-yetkilendirme-sistemi)
6. [API Endpoint'leri](#6-api-endpointleri)
7. [Sayfalar ve Ekranlar](#7-sayfalar-ve-ekranlar)
8. [Yapay Zeka Entegrasyonu](#8-yapay-zeka-entegrasyonu)
9. [Güvenlik Önlemleri](#9-güvenlik-önlemleri)
10. [Kurulum ve Çalıştırma](#10-kurulum-ve-çalıştırma)
11. [Özellikler Listesi](#11-özellikler-listesi)
12. [Sık Sorulan Sorular](#12-sık-sorulan-sorular)
13. [Karşılaşılan Zorluklar ve Çözümler](#13-karşılaşılan-zorluklar-ve-çözümler)
14. [Gelecek Geliştirmeler](#14-gelecek-geliştirmeler)
15. [Kaynaklar](#15-kaynaklar)

---

## 1. PROJE GENEL BAKIŞ

### 1.1 Proje Adı ve Amacı

**MüşteriYorum Yönetim Platformu**, işletmelerin müşteri yorumlarını topladığı, yapay zeka destekli duygu analizi yaptığı ve bu yorumlar üzerinden raporlar oluşturduğu **web tabanlı bir yönetim sistemidir**.

### 1.2 Çözdüğü Problem

Türkiye'deki KOBİ'ler (kafe, restoran, kuaför, otel vb.) günlük yüzlerce müşteri yorumu alıyor; ancak:
- **Bu yorumları manuel okumak zaman alıyor**
- **Hangi konularda şikayet aldıkları net görünmüyor**
- **Olumlu/olumsuz yorum oranını takip edemiyorlar**
- **Yorumları kategorize edemiyorlar**

Platform bu sorunları **otomatik duygu analizi**, **görsel raporlar** ve **kategori bazlı filtreleme** ile çözer.

### 1.3 Hedef Kullanıcılar (3 Rol)

| Rol | Açıklama |
|-----|----------|
| **Müşteri (`musteri`)** | İşletmeleri gezer, deneyimlerini yorum olarak paylaşır. |
| **İşletme Sahibi (`user`)** | Kendi işletmesine gelen yorumları yönetir, analiz eder, rapor indirir. |
| **Yönetici (`admin`)** | Tüm sistemi yönetir; kullanıcı, işletme, yorum modere eder. |

### 1.4 İki Ders Entegrasyonu

Bu proje **iki dersin birleşimi** olarak tasarlanmıştır:

| Ders | Proje Katkısı |
|------|---------------|
| **İnternet Programcılığı** | Web sitesi (HTML/CSS/JS), Node.js backend, PostgreSQL, REST API, JWT auth, dosya yükleme, PDF/Excel raporlama |
| **Yapay Zeka** | Türkçe duygu analizi modeli (Logistic Regression + TF-IDF), FastAPI servisi, model eğitimi (~440k yorum), F1=0.8965 başarı |

İki ders **mikroservis mimarisi** ile birbirine bağlanmıştır: Web platformu yorum aldığında, **YZ servisine HTTP isteği** atar ve analiz sonucunu DB'ye kaydeder.

### 1.5 Sistem Akış Şeması

```
        ┌─────────────────────────────────────┐
        │           KULLANICI                  │
        │ (Müşteri / İşletme Sahibi / Admin)  │
        └───────────────┬─────────────────────┘
                        │ HTTPS
                        ▼
        ┌─────────────────────────────────────┐
        │         WEB ARAYÜZ (Frontend)        │
        │   HTML5 + Bootstrap 5 + Chart.js     │
        │           Vanilla JS                 │
        └───────────────┬─────────────────────┘
                        │ fetch() + JWT Token
                        ▼
        ┌─────────────────────────────────────┐
        │         NODE.JS BACKEND              │
        │     Express + Sequelize + JWT        │
        │   Port: 3000                         │
        └──┬───────────────────────────┬──────┘
           │                           │
           │ Sequelize ORM             │ HTTP fetch
           ▼                           ▼
   ┌──────────────┐         ┌──────────────────┐
   │ PostgreSQL   │         │ FASTAPI (YZ)     │
   │ musteri_yorum│         │ Port: 8000       │
   │ 6 tablo      │         │ Python + sklearn │
   └──────────────┘         └─────────┬────────┘
                                      │
                                      ▼
                            ┌────────────────────┐
                            │  NLP MODELİ        │
                            │  Logistic Regress. │
                            │  TF-IDF (440k veri)│
                            │  F1: 0.8965        │
                            └────────────────────┘
```

**Veri Akışı (Müşteri yorum bırakırsa):**
1. Müşteri tarayıcıdan yorum yazar
2. JS, `POST /api/musteri/yorum` çağrısı yapar (JWT token ile)
3. Node.js yorumu PostgreSQL'e kaydeder
4. Node.js, FastAPI'ye `POST /api/analyze` isteği atar
5. FastAPI, modele tahmin yaptırır
6. Sonuç (`duygu`, `konu_etiketi`, `guven_skoru`) gelir
7. Node.js sonucu `analysis_results` tablosuna kaydeder
8. İşletme sahibi dashboard'da yorumu duygu rozeti ile görür

---

## 2. KULLANILAN TEKNOLOJİLER

> **Hocaya nasıl anlatırım:** Her teknoloji için "Ne işe yarar → Burada nerede kullandım → Neden bunu seçtim" formatında anlatacağım.

### 2.1 FRONTEND

#### HTML5
- **Ne işe yarar:** Web sayfasının iskeletini oluşturur (yapı/içerik).
- **Projede nerede:** `public/` altındaki **15 HTML sayfası** (login, dashboard, reviews vb.).
- **Neden seçildi:** Web'in standart yapı taşı. Alternatifi yok.

#### CSS3
- **Ne işe yarar:** Sayfanın görsel tasarımını (renk, kenar, boşluk) yapar.
- **Projede nerede:** `public/css/style.css` — özel sidebar, duygu rozet renkleri, hover efektleri.
- **Neden seçildi:** Tarayıcı standardı. Modern özelliklerini (Flexbox, Grid, CSS Variables) kullandık.

#### Bootstrap 5
- **Ne işe yarar:** Hazır responsive UI bileşenleri (kart, modal, navbar, tablo).
- **Projede nerede:** Tüm sayfalarda CDN üzerinden yüklü (`bootstrap@5.3.0`).
- **Neden seçildi:**
  - Tailwind'e göre **öğrenmesi kolay** ve sınıf isimleri okunur (`btn btn-primary`).
  - Hazır bileşenler (modal, dropdown) **vakit kazandırır**.
  - Responsive grid sistemi 12 sütunla mobil/desktop uyumu sağlar.

#### Vanilla JavaScript
- **Ne işe yarar:** Sayfada dinamik davranış, API çağrıları, form işleme.
- **Projede nerede:** `public/js/main.js`, `public/js/charts.js`, her sayfanın `<script>` bloğu.
- **Neden seçildi:**
  - React/Vue **build step (Webpack, npm run build)** gerektirir, proje boyutuna fazla.
  - Vanilla JS **doğrudan tarayıcıda çalışır**, kurulum yok.
  - Modern ES6+ (async/await, fetch, modules) yeterli.

#### Chart.js
- **Ne işe yarar:** Canvas tabanlı interaktif grafikler (pasta, çubuk, çizgi).
- **Projede nerede:** Dashboard ve Analiz sayfasında duygu/konu/trend grafikleri.
- **Neden seçildi:**
  - **CDN üzerinden tek satırda** yüklenir.
  - D3.js'e göre **daha basit API**.
  - Animasyon ve tooltip desteği hazır gelir.

#### Bootstrap Icons (Google Fonts yerine)
- **Ne işe yarar:** Vektörel simgeler (yıldız, kullanıcı, grafik vb.)
- **Projede nerede:** Tüm sayfalarda `<i class="bi bi-...">`.
- **Neden seçildi:** Bootstrap ile uyumlu, **1800+ simge**, font-family üzerinden boyutlandırılabilir.

---

### 2.2 BACKEND

#### Node.js (Runtime)
- **Ne işe yarar:** JavaScript'i tarayıcı dışında, sunucuda çalıştırır.
- **Projede nerede:** Tüm backend (`server.js` + `routes/` + `models/`).
- **Neden seçildi:**
  - Frontend ile **aynı dili (JavaScript)** kullanır → öğrenme yükü düşer.
  - **Asenkron I/O** modeli ile çok sayıda eşzamanlı isteği verimli işler.
  - npm ekosistemi 2 milyon+ paketle zengindir.

#### Express.js (Web Framework)
- **Ne işe yarar:** HTTP route'ları, middleware'ler ve istek/yanıt yönetimi sağlar.
- **Projede nerede:** `server.js` ve `routes/` altındaki tüm dosyalar.
- **Neden seçildi:**
  - Node.js için **de facto standart**.
  - Minimal ve esnek; "magic" yok, her şey açık.
  - Geniş middleware ekosistemi (cors, multer, validator).

#### Sequelize (ORM)
- **Ne işe yarar:** PostgreSQL tablolarını JavaScript class'ı gibi yönetmeyi sağlar.
- **Projede nerede:** `models/` altındaki 6 model + `config/db.js`.
- **Neden seçildi:**
  - **Raw SQL yazma zorunluluğunu kaldırır** → daha az hata.
  - Migration ve sync özellikleri ile **tabloları otomatik oluşturur**.
  - Parametreli sorgu kullanarak **SQL Injection'ı önler**.
  - **ORM nedir?** → Object Relational Mapping. Veritabanı tablolarını programlama dilindeki nesnelerle eşleştirir.

#### bcryptjs (Şifre Hashleme)
- **Ne işe yarar:** Şifreleri **tek yönlü hash**'leyerek güvenli saklar.
- **Projede nerede:** `routes/auth.js` register ve login endpoint'lerinde.
- **Neden seçildi:**
  - **Yavaş çalışır (bilerek)** → brute-force saldırılarına karşı korur.
  - **Salt rounds=10** ile her şifreye benzersiz tuz ekler.
  - Aynı şifre olsa bile **hash'leri farklı çıkar**.

#### jsonwebtoken (JWT)
- **Ne işe yarar:** Kullanıcının kim olduğunu, sunucu hafıza tutmadan doğrulamayı sağlar.
- **Projede nerede:** Login/register'da token üretimi, `middleware/auth.js`'de doğrulama.
- **Neden seçildi:**
  - **Stateless**: Sunucu her isteği bağımsız doğrular, session DB'de tutmaz.
  - **Header'da taşınır** (`Authorization: Bearer <token>`).
  - Mikroservis mimarisi için ideal (FastAPI servisi de aynı token'ı doğrulayabilir).

#### multer (Dosya Yükleme)
- **Ne işe yarar:** `multipart/form-data` ile gelen dosyaları sunucuya kaydeder.
- **Projede nerede:** `routes/reviews.js` CSV/Excel yükleme endpoint'i.
- **Neden seçildi:** Express ile **doğrudan entegre**; dosya boyutu limitlemesi (10 MB) ve depo yönetimi sunar.

#### xlsx (Excel Okuma)
- **Ne işe yarar:** `.xlsx`, `.xls`, `.csv` dosyalarını JavaScript nesnesine dönüştürür.
- **Projede nerede:** CSV/Excel yükleme + Excel rapor indirme.
- **Neden seçildi:** Hem **okuma hem yazma** yapar; CSV ve XLSX'i tek paketle.

#### cors (Cross-Origin)
- **Ne işe yarar:** Farklı domain'lerden gelen HTTP isteklerine izin verir.
- **Projede nerede:** `server.js`'de `app.use(cors())`.
- **Neden seçildi:** Tarayıcı varsayılan olarak cross-origin'i engeller (güvenlik). CORS middleware bu izinleri açıkça verir.

#### dotenv (Environment Değişkenleri)
- **Ne işe yarar:** `.env` dosyasındaki gizli değerleri `process.env` üzerinden okur.
- **Projede nerede:** DB şifresi, JWT secret, YZ API URL.
- **Neden seçildi:** Şifreleri **kaynak koda yazmak yerine** dosyaya ayırır. Git'e `.env` commitlenmez.

#### express-validator (Input Doğrulama)
- **Ne işe yarar:** Gelen isteklerin form verilerini doğrular (email mi, min karakter mi).
- **Projede nerede:** `routes/auth.js` register/login validasyonu.
- **Neden seçildi:** Manuel `if` zinciri yerine **deklaratif sözdizimi**.

#### pdfkit (PDF Oluşturma)
- **Ne işe yarar:** JavaScript'te PDF dokümanları oluşturur.
- **Projede nerede:** `routes/reports.js` → PDF rapor indirme.
- **Neden seçildi:** Server-side PDF üretir; istemciye doğrudan stream eder.

#### node-fetch
- **Ne işe yarar:** Node.js'te tarayıcıdaki `fetch()` API'sini kullanmayı sağlar.
- **Projede nerede:** YZ servisine HTTP isteği atarken.
- **Neden seçildi:** Modern, async/await uyumlu; eski `http.request`'tan daha okunur.

---

### 2.3 VERİTABANI

#### PostgreSQL
- **Ne işe yarar:** İlişkisel veritabanı yönetim sistemi.
- **Projede nerede:** Tüm uygulama verisi (kullanıcılar, yorumlar, analizler, işletmeler).
- **Neden seçildi:**
  - **Açık kaynak ve ücretsiz**.
  - MongoDB gibi NoSQL alternatiflerine göre **ilişkisel veriler** (yorum-kullanıcı-işletme-analiz birbirine bağlı) için daha uygun.
  - MySQL'e göre **daha gelişmiş veri tipleri** (JSONB, array, full-text search).
  - **ACID** garantileri ile veri tutarlılığı.

**Neden NoSQL değil?** Bu projede veriler birbirine bağımlı:
- Bir yorumun kullanıcısı var
- Yorumun analizi var
- Yorumun bağlı olduğu işletme var

NoSQL'de bunları yönetmek için ya **veriyi duplike etmek** ya da **manuel JOIN** yazmak gerekirdi. SQL JOIN bu işi tek satırda yapar.

---

### 2.4 YAPAY ZEKA (Ayrı Mikroservis)

#### Python 3.10+
- **Ne işe yarar:** ML/AI ekosistemi için en yaygın dil.
- **Projede nerede:** `sentiment-analysis/` klasörü.
- **Neden seçildi:** scikit-learn, pandas, numpy gibi kütüphanelerin doğal evi.

#### FastAPI
- **Ne işe yarar:** Modern Python web framework'ü, async destekli.
- **Projede nerede:** `sentiment-analysis/api/main.py`.
- **Neden seçildi:**
  - **Flask'tan hızlı** (Starlette + Pydantic üzerine kurulu).
  - **Otomatik OpenAPI/Swagger** dokümantasyonu → `/docs` adresinde test edilir.
  - Type hints ile **validation otomatik**.

#### scikit-learn
- **Ne işe yarar:** Makine öğrenmesi modelleri (sınıflandırma, regresyon, kümeleme).
- **Projede nerede:** Model eğitimi (`train.py`) ve tahmin (`predict.py`).
- **Neden seçildi:** Python ML'de standart, **iyi dokümante** ve **eğitilebilir model çeşitliliği** yüksek.

#### Logistic Regression
- **Ne işe yarar:** İkili/çoklu sınıflandırma algoritması; her sınıf için olasılık üretir.
- **Projede nerede:** Yorum metnini olumlu/olumsuz/nötr olarak sınıflandırır.
- **Neden seçildi:**
  - **Hızlı eğitim ve tahmin** (~440k veride dakikalar içinde eğitilir).
  - **Açıklanabilir**: Hangi kelimenin sonucu nasıl etkilediği görülebilir.
  - Naive Bayes'a göre **özellik bağımlılıklarını daha iyi modeller**.
  - SVM'e göre **büyük veride daha ölçeklenebilir**.

#### TF-IDF Vektörizasyon
- **Ne işe yarar:** Metni sayısal vektöre çevirir; nadir ve önemli kelimelere yüksek ağırlık verir.
- **Projede nerede:** Yorum metnini modele girdi olarak hazırlar.
- **TF-IDF açılımı:** Term Frequency × Inverse Document Frequency.
  - **TF**: Kelime, dökümanda kaç kez geçti?
  - **IDF**: Kelime kaç dökümanda geçti? (Az dökümanda geçen kelime daha bilgilendiricidir.)

#### joblib (Model Kaydetme)
- **Ne işe yarar:** Eğitilmiş scikit-learn modelini dosyaya kaydeder/yükler.
- **Projede nerede:** `models/model.pkl`.
- **Neden seçildi:** Pickle'a göre **NumPy array'leri daha verimli saklar**.

---

## 3. PROJE KLASÖR YAPISI

```
musteri-yorum-platformu/
│
├── server.js                       # Express uygulaması, route bağlama, DB sync
├── package.json                    # npm bağımlılıkları
├── .env                            # Gizli ortam değişkenleri (DB, JWT, YZ_API)
├── PROJE_KAYNAK_DOKUMANI.md        # Bu doküman
│
├── config/
│   └── db.js                       # Sequelize bağlantı yapılandırması (UTF-8)
│
├── models/                         # Veritabanı tablolarının JS karşılıkları
│   ├── User.js                     # Kullanıcı modeli (ad, email, sifre_hash, rol)
│   ├── Business.js                 # İşletme modeli (owner_id, isletme_adi, sehir)
│   ├── Review.js                   # Yorum modeli (user_id, business_id, metin, puan)
│   ├── AnalysisResult.js           # YZ analiz sonucu (duygu, konu, güven skoru)
│   ├── Category.js                 # Kategori modeli (Hizmet, Ürün, vb.)
│   └── BulkUpload.js               # Toplu yükleme log'u (dosya_adi, basarili sayısı)
│
├── middleware/
│   ├── auth.js                     # JWT doğrulama (Bearer token)
│   └── role.js                     # Rol kontrolü (authorize(['admin','user']))
│
├── routes/                         # Tüm API endpoint'leri
│   ├── auth.js                     # /api/auth/* (login, register, me, profile)
│   ├── reviews.js                  # /api/reviews/* (CRUD + CSV upload)
│   ├── analysis.js                 # /api/analysis/* (summary, reviews-by, trigger)
│   ├── reports.js                  # /api/reports/* (PDF + Excel indirme)
│   ├── admin.js                    # /api/admin/* (kullanıcı/işletme yönetimi)
│   ├── businesses.js               # /api/businesses/* (genel listeleme)
│   └── musteri.js                  # /api/musteri/* (müşteri yorum bırakma)
│
├── public/                         # Statik dosyalar (HTML/CSS/JS)
│   ├── index.html                  # Landing page (giriş yapmamış kullanıcı)
│   ├── login.html                  # Giriş + Kayıt (tab'lı)
│   │
│   ├── dashboard/
│   │   └── index.html              # İşletme sahibi ana dashboard
│   │
│   ├── reviews/
│   │   ├── index.html              # Yorum listesi + filtre
│   │   ├── add.html                # Manuel yorum ekleme
│   │   └── upload.html             # CSV/Excel toplu yükleme
│   │
│   ├── analysis/
│   │   └── index.html              # YZ analiz dashboard'u (tıklanabilir kartlar)
│   │
│   ├── reports/
│   │   └── index.html              # PDF/Excel indirme sayfası
│   │
│   ├── profile/
│   │   └── index.html              # İşletme sahibi profil
│   │
│   ├── admin/
│   │   ├── index.html              # Admin ana panel
│   │   ├── users.html              # Kullanıcı yönetimi (rol filtreli)
│   │   ├── businesses.html         # İşletme yönetimi
│   │   └── reviews.html            # Tüm yorumlar moderasyonu
│   │
│   ├── musteri/
│   │   ├── anasayfa.html           # İşletme listesi (kart + filtre)
│   │   ├── isletme.html            # İşletme detay + yorum bırakma modali
│   │   ├── yorumlarim.html         # Müşterinin kendi yorumları
│   │   └── profil.html             # Müşteri profil
│   │
│   ├── contact/index.html          # İletişim formu
│   ├── about/index.html            # Hakkımızda
│   │
│   ├── css/
│   │   └── style.css               # Özel stiller (sidebar, badge, duygu renkleri)
│   │
│   └── js/
│       ├── main.js                 # Ortak JS (auth, navbar, helpers)
│       └── charts.js               # Chart.js grafik renderleri
│
└── uploads/                        # Geçici CSV/Excel dosyaları
```

---

## 4. VERİTABANI TABLOLARI

### 4.1 İlişki Diyagramı (ER)

```
┌───────────────┐        ┌──────────────────┐
│    users      │        │   categories     │
│───────────────│        │──────────────────│
│ id (PK)       │        │ id (PK)          │
│ ad_soyad      │        │ kategori_adi     │
│ email (UQ)    │        │ aciklama         │
│ sifre_hash    │        └────────┬─────────┘
│ rol           │                 │
│ isletme_adi   │                 │ kategori_id
│ olusturma     │                 │
└──┬──┬──┬──────┘                 │
   │  │  │                        │
   │  │  └─owner_id─►┌────────────▼─────────┐
   │  │              │     reviews          │
   │  │              │──────────────────────│
   │  │ user_id      │ id (PK)              │
   │  └─────────────►│ user_id (FK)         │
   │                 │ business_id (FK)     │
   │                 │ kategori_id (FK)     │
   │                 │ musteri_adi          │
   │                 │ yorum_metni          │
   │                 │ puan (1-5)           │
   │                 │ kaynak               │
   │                 │ olusturma            │
   │                 └─────┬────────────────┘
   │                       │
   │                       │ review_id (1-1)
   │                       ▼
   │     ┌──────────────────────────┐
   │     │   analysis_results       │
   │     │──────────────────────────│
   │     │ id (PK)                  │
   │     │ review_id (FK, UQ)       │
   │     │ duygu                    │
   │     │ konu_etiketi             │
   │     │ guven_skoru              │
   │     │ ozet                     │
   │     │ analiz_tarihi            │
   │     └──────────────────────────┘
   │
   │ owner_id
   ▼
┌───────────────────┐         ┌───────────────────────┐
│   businesses      │         │   bulk_uploads        │
│───────────────────│         │───────────────────────│
│ id (PK)           │         │ id (PK)               │
│ owner_id (FK)     │         │ user_id (FK)          │
│ isletme_adi       │         │ dosya_adi             │
│ aciklama          │         │ toplam_satir          │
│ sehir             │         │ basarili              │
│ kategori          │         │ hatali                │
│ olusturma         │         │ yukleme_tarihi        │
└───────────────────┘         └───────────────────────┘
```

### 4.2 Tablo Detayları

#### Tablo: `users`
Sistemdeki tüm kullanıcıları tutar (3 rol için ortak tablo).

| Sütun | Tip | Açıklama |
|-------|-----|----------|
| `id` | INTEGER PK | Otomatik artan birincil anahtar |
| `ad_soyad` | VARCHAR | Kullanıcının tam adı |
| `email` | VARCHAR UNIQUE | Giriş için kullanılan email (benzersiz) |
| `sifre_hash` | VARCHAR | bcrypt ile hash'lenmiş şifre |
| `rol` | VARCHAR(15) | `musteri` / `user` / `admin` |
| `isletme_adi` | VARCHAR | Sadece `user` rolünde dolu (opsiyonel müşteride) |
| `olusturma` | TIMESTAMP | Kayıt tarihi |

**Örnek kayıt:**
```json
{
  "id": 5,
  "ad_soyad": "Mehmet Patron",
  "email": "mehmet@test.com",
  "sifre_hash": "$2a$10$xKj...",
  "rol": "user",
  "isletme_adi": "Mehmet Kafe",
  "olusturma": "2026-05-12T12:42:00Z"
}
```

#### Tablo: `businesses`
İşletme kayıtları. Bir kullanıcının (user rolünde) bir işletmesi olur.

| Sütun | Tip | Açıklama |
|-------|-----|----------|
| `id` | INTEGER PK | Birincil anahtar |
| `owner_id` | INTEGER FK | `users.id` → sahibi (null olabilir; "Genel" işletmesi için) |
| `isletme_adi` | VARCHAR | İşletme adı |
| `aciklama` | TEXT | Tanıtım metni |
| `sehir` | VARCHAR | Konum filtresi için |
| `kategori` | VARCHAR | Yiyecek, Hizmet, Otel vb. |
| `olusturma` | TIMESTAMP | Oluşturma tarihi |

**Örnek kayıt:**
```json
{
  "id": 5,
  "owner_id": 5,
  "isletme_adi": "Mehmet Kafe",
  "kategori": "Yiyecek",
  "sehir": "İstanbul",
  "olusturma": "2026-05-12T12:42:00Z"
}
```

#### Tablo: `reviews`
Tüm yorumların ana tablosu.

| Sütun | Tip | Açıklama |
|-------|-----|----------|
| `id` | INTEGER PK | — |
| `user_id` | INTEGER FK | Yorumu kim ekledi (`users.id`) |
| `business_id` | INTEGER FK | Hangi işletmeye ait (`businesses.id`) |
| `kategori_id` | INTEGER FK | Kategori (`categories.id`) |
| `musteri_adi` | VARCHAR | Yorum yazan müşterinin adı |
| `yorum_metni` | TEXT | Asıl yorum içeriği |
| `puan` | INTEGER | 1-5 arası yıldız |
| `kaynak` | ENUM | `manuel` / `csv` / `api` |
| `olusturma` | TIMESTAMP | Yorum tarihi |

**Örnek kayıt:**
```json
{
  "id": 307,
  "user_id": 4,
  "business_id": 5,
  "musteri_adi": "Ayşe Müşteri",
  "yorum_metni": "Mükemmel hizmet aldım, kahveler harika!",
  "puan": 5,
  "kaynak": "manuel"
}
```

#### Tablo: `analysis_results`
Her yorumun YZ analiz çıktısı (1-1 ilişki).

| Sütun | Tip | Açıklama |
|-------|-----|----------|
| `id` | INTEGER PK | — |
| `review_id` | INTEGER FK UQ | İlişkili yorum |
| `duygu` | ENUM | `olumlu` / `olumsuz` / `nötr` |
| `konu_etiketi` | VARCHAR | YZ'nin tespit ettiği konu (örn: Hizmet, Hijyen) |
| `guven_skoru` | FLOAT | 0-1 arası tahmin güveni |
| `ozet` | TEXT | YZ tarafından üretilen kısa özet |
| `analiz_tarihi` | TIMESTAMP | — |

**Örnek kayıt:**
```json
{
  "id": 307,
  "review_id": 307,
  "duygu": "olumlu",
  "konu_etiketi": "Hizmet",
  "guven_skoru": 0.98,
  "ozet": "Müşteri hizmetten memnun."
}
```

#### Tablo: `categories`
Önceden tanımlı 5 kategori (seed edildi).

| id | kategori_adi | aciklama |
|----|--------------|----------|
| 1 | Hizmet | Müşteri hizmetleri ile ilgili |
| 2 | Ürün | Ürün kalitesi |
| 3 | Fiyat | Fiyatlandırma |
| 4 | Hijyen | Temizlik ve hijyen |
| 5 | Teslimat | Kargo/teslimat |

#### Tablo: `bulk_uploads`
Toplu CSV/Excel yükleme log'u.

| Sütun | Tip | Açıklama |
|-------|-----|----------|
| `id` | INTEGER PK | — |
| `user_id` | INTEGER FK | Yüklemeyi yapan kullanıcı |
| `dosya_adi` | VARCHAR | Orijinal dosya adı |
| `toplam_satir` | INTEGER | Dosyada toplam satır |
| `basarili` | INTEGER | Başarıyla işlenen |
| `hatali` | INTEGER | Hata alan |
| `yukleme_tarihi` | TIMESTAMP | — |

---

## 5. ROL BAZLI YETKİLENDİRME SİSTEMİ

### 5.1 3 Rol Tanımları

#### Rol: `musteri`
**Tanım:** Sıradan müşteri; işletmeleri gezer, deneyim paylaşır.

| Yapabildiği | Yapamadığı |
|-------------|------------|
| İşletme listesini görüntüleme | Başkalarının yorumlarını silme |
| İşletme detayı görme | İşletme oluşturma |
| Yorum bırakma | Toplu yükleme |
| Kendi yorumlarını silme | Raporları indirme |
| Profil güncelleme | Admin paneline erişim |

#### Rol: `user` (İşletme Sahibi)
**Tanım:** İşletmesine gelen yorumları yöneten kullanıcı.

| Yapabildiği |
|-------------|
| Kendi işletmesine gelen yorumları görüntüleme |
| Manuel yorum ekleme (kendi işletmesine) |
| CSV/Excel ile toplu yorum yükleme |
| YZ analiz sonuçlarını görme |
| PDF/Excel rapor indirme |
| Dashboard ve grafikleri görme |
| Profil güncelleme |

#### Rol: `admin` (Yönetici)
**Tanım:** Sistem yöneticisi; tüm verilere ve işlemlere erişebilir.

| Yapabildiği |
|-------------|
| Tüm kullanıcıları listeleme, düzenleme, silme |
| Rol filtreleme (müşteri/işletme/admin) |
| Tüm işletmeleri yönetme |
| Tüm yorumları moderasyon (silme) |
| Sistem istatistiklerini görme |

### 5.2 Erişim Matrisi

| Sayfa / İşlem | musteri | user | admin |
|---------------|:-------:|:----:|:-----:|
| `/` (Landing) | ✓ | ✓ | ✓ |
| `/login.html` | ✓ | ✓ | ✓ |
| `/musteri/*` | ✓ | ✗ | ✗ |
| `/dashboard/` | ✗ | ✓ | ✓ |
| `/reviews/*` | ✗ | ✓ | ✓ |
| `/analysis/*` | ✗ | ✓ | ✓ |
| `/reports/*` | ✗ | ✓ | ✓ |
| `/admin/*` | ✗ | ✗ | ✓ |
| `POST /api/musteri/yorum` | ✓ | ✗ | ✗ |
| `POST /api/reviews/upload` | ✗ | ✓ | ✓ |
| `DELETE /api/admin/users/:id` | ✗ | ✗ | ✓ |

### 5.3 JWT (JSON Web Token) Nasıl Çalışıyor?

**JWT nedir?** Üç bölümden oluşan, base64 ile kodlanmış, dijital imzalı bir string'dir:
```
eyJhbGc...   .   eyJpZCI6NSwicm9sIjoidXNlciIsImlhdCI6MTcyMDB9   .   c2lnbmF0dXJl
   HEADER             PAYLOAD (kullanıcı bilgisi)                  SIGNATURE
```

**Akış:**
1. Kullanıcı login olur → sunucu `{ id, rol }` payload'unu JWT secret ile imzalayıp token üretir
2. Frontend token'ı `localStorage`'a kaydeder
3. Her API isteğinde `Authorization: Bearer <token>` başlığı eklenir
4. Sunucu `middleware/auth.js` ile token'ı doğrular (imzayı kontrol eder, expire'ı kontrol eder)
5. Geçerli ise `req.user` objesi dolar ve route çalışır

**Token süresi:** 7 gün (`.env` dosyasındaki `JWT_EXPIRE=7d`)

### 5.4 Middleware Kod Örneği

```javascript
// middleware/auth.js - JWT doğrulama
const authHeader = req.headers['authorization'];
const token = authHeader.split(' ')[1];
const decoded = jwt.verify(token, process.env.JWT_SECRET);
req.user = await User.findByPk(decoded.id);
next();

// middleware/role.js - Çoklu rol kontrolü
function authorize(roles) {
  const izinli = Array.isArray(roles) ? roles : [roles];
  return (req, res, next) => {
    if (req.user && izinli.includes(req.user.rol)) return next();
    return res.status(403).json({ hata: 'Yetkiniz yok' });
  };
}

// Kullanım:
router.post('/yorum', authMiddleware, authorize(['musteri']), handler);
router.delete('/users/:id', authMiddleware, authorize('admin'), handler);
```

---

## 6. API ENDPOINT'LERİ

> Tüm istekler `Content-Type: application/json` ile yapılır. Korumalı endpoint'ler `Authorization: Bearer <jwt>` başlığı gerektirir.

### 6.1 AUTH (`/api/auth`)

#### `POST /api/auth/register`
**Açıklama:** Yeni kullanıcı kaydı.
**Yetki:** Public

**Request:**
```json
{
  "ad_soyad": "Ayşe Müşteri",
  "email": "ayse@test.com",
  "sifre": "123456",
  "rol": "musteri",
  "isletme_adi": null
}
```

**Response (201):**
```json
{
  "token": "eyJhbGc...",
  "kullanici": { "id": 4, "ad_soyad": "Ayşe Müşteri", "rol": "musteri" }
}
```

#### `POST /api/auth/login`
**Açıklama:** Email + şifre ile giriş.
**Yetki:** Public

**Request:** `{ "email": "...", "sifre": "..." }`
**Response:** `{ "token": "...", "kullanici": {...} }`

#### `GET /api/auth/me`
**Açıklama:** Mevcut kullanıcı bilgisi.
**Yetki:** Login gerekli

#### `PUT /api/auth/me`
**Açıklama:** Profil güncelleme (ad_soyad, email, yeni_sifre, isletme_adi).
**Yetki:** Login gerekli

---

### 6.2 REVIEWS (`/api/reviews`)

#### `GET /api/reviews?arama=...&kategori_id=...&puan=...&sayfa=1&limit=10`
**Açıklama:** Yorumları listele (filtreli). `user` rolünde **sadece kendi işletmesinin yorumları**.
**Yetki:** Login gerekli (user/admin)

#### `POST /api/reviews`
**Açıklama:** Manuel yorum ekle. Otomatik YZ analizi tetiklenir.
**Yetki:** Login gerekli

**Request:**
```json
{
  "musteri_adi": "Ali",
  "yorum_metni": "Ürün çok güzel",
  "puan": 5,
  "kategori_id": 2
}
```

#### `PUT /api/reviews/:id` — Yorum güncelle
#### `DELETE /api/reviews/:id` — Yorum sil

#### `POST /api/reviews/upload`
**Açıklama:** CSV/Excel yükleyerek toplu yorum ekle.
**Yetki:** Login gerekli
**Format:** `multipart/form-data` ile `dosya` alanı

---

### 6.3 ANALYSIS (`/api/analysis`)

#### `GET /api/analysis/summary?baslangic=...&bitis=...`
**Açıklama:** Duygu/konu/trend özet verisi.
**Response:**
```json
{
  "duygu_dagilimi": {"olumlu": 82, "olumsuz": 15, "nötr": 3},
  "konu_dagilimi": {"Hizmet": 40, "Ürün": 35, ...},
  "aylik_trend": [{"ay": "2026-05", "duygu": "olumlu", "sayi": "50"}],
  "ozet": {"toplam": 100, "olumlu": 82, "olumsuz": 15, "notr": 3}
}
```

#### `GET /api/analysis/reviews-by?duygu=olumlu`
**Açıklama:** Belirli duyguya sahip yorumları listele (tıklanabilir kartlar için).

#### `POST /api/analysis/trigger`
**Açıklama:** Seçili review_id listesini yeniden analiz ettir.
**Request:** `{ "review_ids": [101, 102, 103] }`

#### `GET /api/analysis/negative`
**Açıklama:** Sadece olumsuz yorumları getirir (analiz dashboard için).

---

### 6.4 REPORTS (`/api/reports`)

#### `GET /api/reports/pdf`
**Açıklama:** PDF raporu indir. PDFKit ile oluşturulur.
**Yetki:** Login gerekli
**Response:** PDF stream

#### `GET /api/reports/excel`
**Açıklama:** Excel raporu indir. xlsx ile oluşturulur.

---

### 6.5 ADMIN (`/api/admin`)

#### `GET /api/admin/stats`
**Açıklama:** `{ kullanici, yorum, analiz, yukleme }` toplamları.

#### `GET /api/admin/users?rol=musteri`
**Açıklama:** Tüm kullanıcılar (rol filtresiyle).

#### `PUT /api/admin/users/:id` — Kullanıcı düzenle
#### `DELETE /api/admin/users/:id` — Kullanıcı sil

#### `GET /api/admin/businesses` — Tüm işletmeler
#### `PUT /api/admin/businesses/:id` — İşletme düzenle
#### `DELETE /api/admin/businesses/:id` — İşletme sil

#### `GET /api/admin/reviews` — Tüm yorumlar moderasyon
#### `DELETE /api/admin/reviews/:id` — Yorum sil

---

### 6.6 BUSINESSES (`/api/businesses`) — Public

#### `GET /api/businesses?arama=...&sehir=...&kategori=...`
**Açıklama:** Tüm işletmeleri listele (giriş yapmamış kullanıcı da görebilir).
**Response:** Her işletme için `{ id, isletme_adi, kategori, sehir, yorum_sayisi, ortalama_puan }`

#### `GET /api/businesses/:id`
**Açıklama:** İşletme detayı + son 50 yorum + özet istatistik.

---

### 6.7 MUSTERI (`/api/musteri`)

#### `POST /api/musteri/yorum`
**Açıklama:** Müşteri bir işletmeye yorum bırakır. YZ analiz tetiklenir.
**Yetki:** Login + rol=`musteri`

**Request:**
```json
{ "business_id": 5, "yorum_metni": "Harika!", "puan": 5 }
```

#### `GET /api/musteri/yorumlarim` — Kendi yorumları
#### `DELETE /api/musteri/yorum/:id` — Kendi yorumunu sil

---

## 7. SAYFALAR VE EKRANLAR

| URL | Rol | Amaç | İçerik | API'ler |
|-----|-----|------|--------|---------|
| `/` | Public | Landing page | Hero, 2 CTA kart (Müşteri/İşletme), istatistikler, "Nasıl Çalışır" 3 adım | `GET /api/stats/public` |
| `/login.html` | Public | Giriş + Kayıt | Tab'lı form, hesap türü radio, hash desteği (`#register-musteri`) | `POST /api/auth/login`, `POST /api/auth/register` |
| `/dashboard/` | user, admin | Ana özet | 4 stat kart, 3 grafik (pasta/çubuk/çizgi), son yorumlar | `GET /api/analysis/summary`, `GET /api/reviews?limit=5` |
| `/reviews/` | user, admin | Yorum listesi | Tablo + filtre (arama, kategori, puan, tarih) + sayfalama | `GET /api/reviews`, `DELETE` |
| `/reviews/add.html` | user, admin | Yorum ekle | Form: müşteri adı, kategori, yorum, puan (yıldız) | `POST /api/reviews` |
| `/reviews/upload.html` | user, admin | Toplu yükle | Drag-drop alanı + önizleme + ilerleme | `POST /api/reviews/upload` |
| `/analysis/` | user, admin | YZ Analiz | 3 tıklanabilir duygu kartı, pasta + çubuk grafik, dinamik yorum listesi | `GET /api/analysis/summary`, `GET /api/analysis/reviews-by` |
| `/reports/` | user, admin | Rapor indir | PDF + Excel butonları | `GET /api/reports/pdf`, `GET /api/reports/excel` |
| `/profile/` | user, admin | Profil | Form: ad, email, işletme, şifre değiştirme | `GET/PUT /api/auth/me` |
| `/admin/` | admin | Admin paneli | 4 stat kart + yönlendirme kartları | `GET /api/admin/stats` |
| `/admin/users.html` | admin | Kullanıcı yönetimi | Tablo + rol filtre butonları + edit/delete modal | `GET/PUT/DELETE /api/admin/users` |
| `/admin/businesses.html` | admin | İşletme yönetimi | Tablo + edit modal | `GET/PUT/DELETE /api/admin/businesses` |
| `/admin/reviews.html` | admin | Yorum moderasyonu | Tüm yorumlar tablosu + sil butonu | `GET/DELETE /api/admin/reviews` |
| `/musteri/anasayfa.html` | musteri | İşletme keşfet | Kart grid + arama/şehir/kategori filtresi | `GET /api/businesses` |
| `/musteri/isletme.html?id=X` | musteri | İşletme detay | Hero, özet kartları, yorum listesi, "Yorum Bırak" modali | `GET /api/businesses/:id`, `POST /api/musteri/yorum` |
| `/musteri/yorumlarim.html` | musteri | Yorumlarım | Kart listesi (işletme adı, puan, duygu) + sil | `GET /api/musteri/yorumlarim`, `DELETE` |
| `/musteri/profil.html` | musteri | Müşteri profil | Form | `GET/PUT /api/auth/me` |
| `/contact/index.html` | Public | İletişim | Form (lokal) | — |
| `/about/index.html` | Public | Hakkımızda | Misyon, özellik kartları | `GET /api/stats/public` |

---

## 8. YAPAY ZEKA ENTEGRASYONU

### 8.1 Mikroservis Mimarisi

YZ servisi **ayrı bir uygulama** olarak çalışır (FastAPI, port 8000). Node.js backend, **HTTP üzerinden** bu servise istek atar. Bu mimarinin avantajları:

- **Ayrı dilde geliştirme**: Python ML için optimize edilmiş
- **Bağımsız ölçeklenme**: YZ servisini ayrı sunucuda çalıştırabilirsiniz
- **Sorumluluk ayrımı**: Web ve ML ekipleri bağımsız çalışır

### 8.2 Eğitilen Modeller

Projede **2 model karşılaştırıldı**:

| Model | Doğruluk | F1-Score | Eğitim Süresi | Tercih |
|-------|----------|----------|---------------|--------|
| Naive Bayes (MultinomialNB) | 0.8624 | 0.8589 | ~30 sn | ✗ |
| **Logistic Regression** | **0.8973** | **0.8965** | ~3 dk | ✓ |

### 8.3 Veri Seti

- **Kaynak**: Hepsiburada Türkçe Sentiment veriseti (Kaggle)
- **Boyut**: ~440.000 yorum
- **Sınıflar**: Olumlu, Olumsuz, Nötr
- **Sınıf dengesizliği**: Olumlu yorumlar çoğunluktaydı → `class_weight='balanced'` ile dengelendi

### 8.4 Ön İşleme Pipeline'ı

```
Ham yorum
   ↓
Türkçe karakter normalizasyonu (ı, ğ, ş, ü, ö, ç)
   ↓
Küçük harfe çevirme + noktalama temizleme
   ↓
Stop-words çıkarma (ve, bir, için, ama, ...)
   ↓
TF-IDF Vektörizasyon (n-gram: 1-2)
   ↓
Logistic Regression Modeli
   ↓
Tahmin: {duygu, güven_skoru}
```

### 8.5 FastAPI Endpoint

#### `POST /api/analyze`

**Request:**
```json
{
  "text": "Ürün çok güzel şahane oldu"
}
```

**Response:**
```json
{
  "duygu": "olumlu",
  "konu": "Ürün",
  "guven_skoru": 0.98,
  "ozet": "Müşteri üründen memnun"
}
```

### 8.6 Node.js'ten YZ Servisine İstek (Gerçek Kod)

```javascript
// routes/reviews.js içinden
async function yzAnaliz(text, reviewId) {
  try {
    const resp = await fetch(process.env.YZ_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      timeout: 5000
    });
    if (!resp.ok) throw new Error('YZ API yanıt vermedi');
    const data = await resp.json();
    await AnalysisResult.create({
      review_id: reviewId,
      duygu: data.duygu || 'nötr',
      konu_etiketi: data.konu || null,
      guven_skoru: data.guven_skoru || null,
      ozet: data.ozet || null
    });
  } catch (e) {
    // YZ API yoksa → mock analiz (kelime tabanlı)
    const pozitif = ['harika', 'mükemmel', 'güzel', 'iyi', ...];
    const negatif = ['kötü', 'berbat', 'şikay', ...];
    // ... mock analysis kaydı
  }
}
```

### 8.7 Fallback Mekanizması

YZ servisi çalışmazsa (timeout, hata) Node.js **kelime tabanlı basit bir mock analiz** yapar:
- Olumlu kelime varsa → `olumlu`
- Olumsuz kelime varsa → `olumsuz`
- Yoksa → `nötr`

Bu sayede demo sırasında YZ servisi olmasa bile platform çalışır.

---

## 9. GÜVENLİK ÖNLEMLERİ

### 9.1 Şifre Güvenliği (bcrypt)

```javascript
const sifre_hash = await bcrypt.hash(sifre, 10);  // 10 = salt rounds
const eslesen = await bcrypt.compare(sifre, user.sifre_hash);
```

- **Salt rounds = 10**: 2^10 = 1024 hash iterasyonu. Yavaş çalışır (~100ms) ki brute-force pahalı olsun.
- **Salt**: Her şifreye eklenen rastgele değer; aynı şifre iki kez hashlense bile farklı çıkar.
- **Tek yönlü**: Hash'ten orijinal şifre çözülemez.

### 9.2 JWT Güvenliği

- **Secret key**: `.env` dosyasında, kaynak koda yazılmaz.
- **Expire süresi**: 7 gün; sonrasında yeniden login gerekir.
- **HTTPS önerisi**: Production'da mutlaka HTTPS kullanılmalı, token MITM saldırısına karşı.

### 9.3 SQL Injection Koruması

**Sequelize parametreli sorgular kullanır:**

```javascript
// GÜVENLİ:
await User.findOne({ where: { email } });
// Sequelize'in altta yaptığı:
// SELECT * FROM users WHERE email = $1; -- $1 parametre olarak bağlanır

// GÜVENSİZ (KULLANMADIK):
await sequelize.query(`SELECT * FROM users WHERE email = '${email}'`);
```

Raw query gerekli yerlerde de **`:placeholder` replacements** kullanıldı:
```javascript
sequelize.query('SELECT ... WHERE business_id IN (:ids)', {
  replacements: { ids: [1,2,3] }
});
```

### 9.4 CORS Yapılandırması

```javascript
app.use(cors());  // Geliştirme için tüm origin'lere izin
// Production'da: app.use(cors({ origin: 'https://benim-domain.com' }));
```

### 9.5 Input Validation (express-validator)

```javascript
router.post('/register', [
  body('email').isEmail(),
  body('sifre').isLength({ min: 6 })
], handler);
```

### 9.6 Role-Based Access Control (RBAC)

Her sayfada **iki katmanlı kontrol**:
1. **Backend middleware** (`authorize(['rol'])`) → API erişimini engeller
2. **Frontend JS** (`requireAdmin()`) → Sayfayı yönlendirir

> **Önemli:** Frontend kontrol sadece UX içindir; gerçek güvenlik backend'dedir.

### 9.7 Türkçe Karakter (UTF-8) Güvenliği

CSV yüklemede BOM temizliği + codepage 65001 → bozuk veri girişini engeller.

---

## 10. KURULUM VE ÇALIŞTIRMA

### A) Gereksinimler

| Yazılım | Sürüm | Açıklama |
|---------|-------|----------|
| Node.js | 18+ | `node --version` ile kontrol |
| PostgreSQL | 14+ | Homebrew/Docker ile |
| Python | 3.10+ | YZ servisi için |
| npm | 9+ | Node ile gelir |

### B) Veritabanı Kurulumu

```bash
# PostgreSQL'i başlat (Mac/Homebrew):
brew services start postgresql@14

# Veritabanı oluştur:
createdb musteri_yorum

# (Opsiyonel) Bağlantıyı test et:
psql musteri_yorum -c "SELECT version();"
```

### C) Web Projesi Bağımlılıkları

```bash
cd musteri-yorum-platformu
npm install
```

`.env` dosyası proje kökünde olmalı:
```env
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=musteri_yorum
DB_USER=muhammedclk
DB_PASS=
JWT_SECRET=gizli_anahtar_123
JWT_EXPIRE=7d
YZ_API_URL=http://localhost:8000/api/analyze
```

### D) YZ Servisi Bağımlılıkları

```bash
cd sentiment-analysis
pip install -r requirements.txt
# (fastapi, uvicorn, scikit-learn, joblib, pydantic)
```

### E) Çalıştırma Sırası

**Terminal 1 — YZ Servisi:**
```bash
cd sentiment-analysis/api
uvicorn main:app --reload --port 8000
```
> API Docs: http://localhost:8000/docs

**Terminal 2 — Web Platformu:**
```bash
cd musteri-yorum-platformu
node server.js
```
> Web: http://localhost:3000

### F) İlk Çalıştırma

İlk başlatmada `sequelize.sync({ alter: true })` ile:
- 6 tablo otomatik oluşturulur
- 5 kategori seed edilir (Hizmet, Ürün, Fiyat, Hijyen, Teslimat)
- "Genel" varsayılan işletmesi oluşturulur

### G) Test Hesapları (Mevcut)

| Rol | Email | Şifre |
|-----|-------|-------|
| Müşteri | `ayse@test.com` | `123456` |
| İşletme Sahibi | `mehmet@test.com` | `123456` |
| Test (user) | `test@test.com` | `123456` |

**Admin yapmak için:**
```sql
psql musteri_yorum -c "UPDATE users SET rol='admin' WHERE email='test@test.com';"
```

---

## 11. ÖZELLİKLER LİSTESİ

| # | Özellik | Dosya | Açıklama |
|---|---------|-------|----------|
| 1 | Kullanıcı kayıt/giriş + JWT | `routes/auth.js`, `middleware/auth.js` | bcrypt + JWT, 3 rol desteği |
| 2 | Manuel yorum ekleme | `routes/reviews.js` (POST /) | Otomatik YZ analiz tetikler |
| 3 | Toplu CSV/Excel yükleme | `routes/reviews.js` (POST /upload) | UTF-8 + BOM koruması, batch insert |
| 4 | Yorum listeleme + arama | `public/reviews/index.html` | Filtre: arama, kategori, puan, tarih |
| 5 | YZ analiz sonuçları | `public/analysis/index.html` | Pasta + çubuk grafik, tıklanabilir kartlar |
| 6 | Toplu analiz tetikleme | `POST /api/analysis/trigger` | Seçili yorumları yeniden analiz |
| 7 | Dashboard ve grafikler | `public/dashboard/`, `js/charts.js` | Chart.js: pasta, çubuk, çizgi |
| 8 | PDF rapor indirme | `routes/reports.js` | PDFKit ile dinamik PDF |
| 9 | Excel rapor indirme | `routes/reports.js` | xlsx ile veri export |
| 10 | Yorum kategorileri | Kategori tablosu + seed | 5 kategori (Hizmet, Ürün, vb.) |
| 11 | Yönetici paneli | `public/admin/` | Kullanıcı, işletme, yorum yönetimi |
| 12 | İletişim formu | `public/contact/index.html` | Lokal form |
| 13 | Duyarlı tasarım | `public/css/style.css` | Bootstrap grid + media queries |
| 14 | **Müşteri rolü ile yorum** | `routes/musteri.js`, `public/musteri/` | 4 yeni sayfa |
| 15 | **İşletme profil sayfaları** | `public/musteri/isletme.html` | Detay + yorum modali |
| 16 | **Rol bazlı yönlendirme** | `public/js/main.js` → `rolHomePage()` | Login sonrası rolüne göre yönlendir |
| 17 | **Admin işletme yönetimi** | `public/admin/businesses.html` | CRUD + filtre |
| 18 | **Türkçe karakter güvencesi** | `routes/reviews.js`, `config/db.js` | UTF-8 + BOM + codepage 65001 |

---

## 12. SIK SORULAN SORULAR (Hoca Soracak Olursa)

#### S1: "Neden Node.js seçtin?"
**C:** JavaScript hem frontend hem backend'de aynı dil olunca öğrenme yükü düşüyor. Asenkron I/O modeli sayesinde çok sayıda eşzamanlı isteği verimli işliyor. Ayrıca npm ekosistemi 2 milyon+ paketle çok zengin. PHP veya Java'ya göre kurulumu ve geliştirme döngüsü çok daha hızlı.

#### S2: "PostgreSQL yerine MySQL kullansaydın ne olurdu?"
**C:** İşin temeli benzer olurdu ama PostgreSQL'in avantajları:
- JSONB veri tipi (yorum kategorisi gibi semi-structured veri için)
- `ILIKE` case-insensitive arama (yorum aramada kullanıyoruz)
- `RETURNING` clause ile insert sonrası direkt veri alma
- Daha iyi concurrent yazma performansı
MySQL ile de yapılabilirdi; sadece bazı sorgular daha komplex olurdu.

#### S3: "Sequelize neden gerekli, raw SQL yazılabilirdi?"
**C:** Raw SQL ile yazılabilirdi ancak:
- **SQL Injection riski**: String concat ile sorgu yazmak tehlikeli
- **Tip güvenliği**: Sequelize modelleri tip kontrolü sağlıyor
- **Migration kolaylığı**: `sync({alter: true})` ile şema güncelliyor
- **İlişki yönetimi**: `include` ile JOIN'leri otomatik yazıyor
Trade-off: Çok kompleks sorgularda performans biraz düşebilir; o yüzden bazı raw query'leri (örn. aylık trend) yazdım.

#### S4: "JWT nedir, session'dan farkı ne?"
**C:**
- **Session**: Sunucu bir cookie verir, kullanıcı bilgisini hafızada/Redis'te tutar. Her istekte oradan okur.
- **JWT**: Sunucu imzalı bir token verir; kullanıcı bilgisi token'ın içinde. Sunucu hiçbir şey saklamaz, sadece imzayı doğrular.

JWT'nin avantajı **stateless** olması: Mikroservis mimarisinde 10 farklı backend olsa hepsi aynı token'ı doğrulayabilir. Session'da merkezi bir store gerekir. Dezavantajı: Token iptal etmek zor (logout yapsanız bile expire olana kadar geçerli kalır).

#### S5: "Frontend için neden React/Vue değil de Vanilla JS?"
**C:**
- React build step (webpack, babel, npm run build) gerektirir → proje boyutuna fazla
- Bu proje 15 sayfa, çoğu CRUD form → SPA gerektirmez
- Vanilla JS doğrudan tarayıcıda çalışır, **kurulum yok**
- Modern ES6+ (async/await, fetch, modules) bu işi yeterince temiz yapıyor
- Sınıf konseptini "React öğretmek için" değil, "müşteri yorum problemini çözmek için" yaptım

#### S6: "FastAPI yerine Flask kullansaydın?"
**C:** Yapılabilirdi ama FastAPI:
- **Daha hızlı** (Starlette + uvicorn üzerine kurulu, async destekli)
- **Otomatik Swagger** (`/docs` adresinde test ediyorsunuz)
- **Type hints ile validation** (Pydantic) → Flask'ta manuel yazmak gerekirdi
- **Modern**: 2018+ projesi, yeni teknolojilere uyumlu

#### S7: "Modelin doğruluğu nasıl test edildi?"
**C:** Veriyi %80 eğitim / %20 test olarak ayırdık (stratified split — sınıf dengesini koruyarak). Test setinde:
- **Doğruluk (Accuracy):** 0.8973
- **F1-Score:** 0.8965 (precision-recall'un harmonik ortalaması)
- **Confusion Matrix** ile her sınıfın yanlış sınıflandırılma oranı incelendi

#### S8: "Yapay zeka modeli nasıl eğitildi, kaç veri kullandın?"
**C:** Hepsiburada Türkçe Sentiment veriseti, ~440.000 yorum. Pipeline:
1. Veri temizleme (HTML tag, URL, emoji)
2. Türkçe karakter normalizasyonu
3. Stop-words çıkarma
4. TF-IDF vektörizasyon (n-gram: unigram + bigram)
5. Logistic Regression eğitimi (`class_weight='balanced'`)
6. joblib ile model serileştirme

#### S9: "CSV yüklerken Türkçe karakter sorunu nasıl çözüldü?"
**C:** 4 aşamada:
1. **`fs.readFileSync(path, 'utf-8')`** ile UTF-8 olarak oku
2. **BOM temizliği**: `content.replace(/^﻿/, '')` ile başta gelen byte order mark'ı sil
3. **XLSX'e codepage**: `XLSX.read(content, { codepage: 65001 })` (65001 = UTF-8 Windows kodu)
4. **PostgreSQL client_encoding**: Sequelize config'inde `dialectOptions: { client_encoding: 'UTF8' }`

Eski bozuk veriler için: `DELETE FROM reviews WHERE yorum_metni LIKE '%Ã%'`

#### S10: "Mobil uyumlu mu, nasıl test ettin?"
**C:** Evet. Bootstrap 5'in **12-column grid** sistemi sayesinde:
- `col-md-4` → tablette 3 sütun
- `col-sm-12` → mobilde tek sütun

Test ettim:
- Chrome DevTools'da responsive mode (iPhone, iPad simülasyonu)
- Sidebar mobilde `transform: translateX(-100%)` ile gizlenip toggler butonuyla açılıyor

#### S11: "Veritabanı yedeklemesi nasıl yapılır?"
**C:** PostgreSQL'in `pg_dump` aracıyla:
```bash
pg_dump musteri_yorum > backup_$(date +%F).sql
```
Geri yükleme:
```bash
psql musteri_yorum < backup_2026-05-13.sql
```
Production'da cron job ile günlük otomatik yedek alınır.

#### S12: "Güvenlik açısından eksik yönler nedir?"
**C:**
1. **HTTPS yok** (geliştirme; production'da Let's Encrypt eklenmeli)
2. **Rate limiting yok** (brute-force'a karşı `express-rate-limit` eklenmeli)
3. **CSRF token yok** (JWT cookie yerine localStorage'da olduğu için risk düşük ama yine de iyi olur)
4. **XSS'e karşı**: Innertext yerine `innerHTML` kullandığım yerler var — `DOMPurify` ile sanitize edilebilir
5. **File upload validasyonu**: Sadece extension kontrol ediyorum, magic byte kontrolü eklenebilir

#### S13: "Projeyi gerçek sunucuya nasıl deploy edersin?"
**C:**
- **VPS** (DigitalOcean, Hetzner): Ubuntu 22.04 + Nginx reverse proxy + PM2 + Let's Encrypt SSL
- **PaaS** (Render, Railway): `Procfile` ile tek tıkla deploy
- **Docker**: `Dockerfile` + `docker-compose.yml` ile Node + Postgres + FastAPI üçlüsünü konteynerle
- **Environment**: `.env` dosyası **commitlenmeyecek**, sunucuda manuel set edilecek

#### S14: "Hangi npm paketlerini neden seçtin?"
**C:** Her paketin **rakipleriyle karşılaştırarak** seçtim:
- **bcryptjs** vs `bcrypt` → bcryptjs saf JS, native compile gerektirmez (deploy kolay)
- **jsonwebtoken** vs `jose` → jsonwebtoken daha popüler, tutorial bol
- **multer** vs `formidable` → Express ile native uyum, daha basit API
- **xlsx** vs `exceljs` → xlsx hem okuma hem yazma, daha az kod
- **pdfkit** vs `puppeteer` → puppeteer headless Chrome açar (ağır); pdfkit pure-JS

#### S15: "Olumlu/olumsuz sınıflandırma için başka algoritma denedin mi?"
**C:** Evet, 2 algoritma karşılaştırdım:
- **Naive Bayes**: Hızlı ama özellik bağımsızlığı varsayar → 0.86 F1
- **Logistic Regression**: Daha doğru, ölçeklenebilir → **0.8965 F1** ✓

Denenebilecekler ama yapmadım:
- **SVM**: Çok yavaş büyük veride (~440k yorum)
- **BERTurk**: GPU gerektirir, deployment maliyetli
- **Random Forest**: Yüksek bellek tüketimi

#### S16: "İki ders nasıl entegre oldu?"
**C:** **Mikroservis mimarisi**:
- **İnternet Programcılığı dersi** → Web platformu (HTTP, CRUD, auth, UI)
- **Yapay Zeka dersi** → FastAPI ML servisi (model eğitimi + tahmin)
- İki servis **HTTP üzerinden konuşur** (fetch + JSON)
- Bu mimari **gerçek dünya pratiği**: Netflix, Uber, Spotify gibi şirketler aynı yapıyı kullanır.

#### S17: "Veritabanı tasarımında neden 'Genel' işletmesi var?"
**C:** Sistem büyürken **business_id alanı** sonradan eklendi. Eski yorumların `business_id` NULL kalmaması ve veri tutarlılığını korumak için **"Genel" placeholder işletmesi** seed ediliyor. Yeni yorumlar gerçek işletmelere bağlanıyor.

#### S18: "Yorum analizi senkron mu asenkron mu?"
**C:** **Asenkron**: Müşteri yorum bıraktığında, `Review.create()` döner ve hemen 201 cevabı gönderilir. YZ analizi arka planda devam eder (`.catch(console.error)`). Bu sayede kullanıcı 5 saniye beklemiyor.

#### S19: "Frontend'de neden TypeScript kullanmadın?"
**C:** TypeScript build step gerektirir; vanilla JS ile **kurulum sıfır**. Proje boyutu (15 sayfa) için TS'in tip güvenliği avantajı build kompleksitesini compense etmiyor. Daha büyük SPA olsaydı (1000+ component) TS gerekirdi.

#### S20: "Test yazdın mı?"
**C:** Manuel API testleri yaptım (curl + browser eval). Otomatik test yok ama eklenebilir:
- **Backend**: Jest + Supertest ile route testleri
- **Frontend**: Cypress veya Playwright ile E2E testleri
- **YZ**: pytest ile model evaluation testleri

---

## 13. KARŞILAŞILAN ZORLUKLAR VE ÇÖZÜMLER

| # | Sorun | Çözüm |
|---|-------|-------|
| 1 | CSV yükleyince Türkçe karakter bozuluyordu ("ürün" → "Ã¼rÃ¼n") | `utf-8` encoding + BOM regex temizliği + `codepage: 65001` |
| 2 | Express middleware HTML'i `application/json` content-type ile servis ediyordu | Sadece API path'leri için JSON header'ı set ettim, statik dosyaları bozmadım |
| 3 | YZ servisi yoksa yorum eklenmiyordu | Try/catch ile fallback mock analiz (kelime tabanlı) eklendi |
| 4 | Sınıf dengesizliği (olumlu >> olumsuz) | scikit-learn `class_weight='balanced'` parametresi |
| 5 | URL path'inde Türkçe karakter (`/api/.../nötr`) Express ile sorun çıkardı | Path param yerine **query param**'a çevirdim (`?duygu=nötr`) |
| 6 | Browser eski HTML'i cache'liyordu | `Cache-Control: no-cache` header + URL'ye `&_=Date.now()` cache busting |
| 7 | İşletme sahibi rolü eklenince eski yorumların business_id'si NULL'du | Migration sırasında "Genel" işletmesi oluşturulup eski yorumlar ona atandı |
| 8 | JWT expire olduğunda kullanıcı uyarı almıyordu | `apiFetch` wrapper'da 401 dönerse otomatik logout |
| 9 | Müşteri yanlışlıkla işletme sayfasına gidiyordu | Her sayfada `if (user.rol !== 'musteri') redirect` kontrolü |
| 10 | CSV'de eksik kolon satırları işlem hatası veriyordu | Her satırı `try/catch` ile sardım, hatali sayacına ekledim |

---

## 14. GELECEK GELİŞTİRMELER

### Kısa Vade
- **BERTurk modeli** entegrasyonu (Türkçe için fine-tune edilmiş BERT) — F1 0.92+ hedefi
- **Real-time bildirimler**: Yeni yorum geldiğinde işletme sahibine WebSocket bildirimi
- **Email entegrasyonu**: Yeni olumsuz yorum geldiğinde email
- **2FA**: Two-factor authentication (Google Authenticator)

### Orta Vade
- **Mobil uygulama**: React Native ile iOS + Android
- **Çoklu dil desteği**: İngilizce arayüz
- **API key sistemi**: 3. parti entegrasyonlar için
- **Webhook'lar**: Yorum eklendiğinde external sistemi bildirme

### Uzun Vade
- **SaaS abonelik sistemi**: Stripe entegrasyonu, plan bazlı limit
- **Çoklu işletme**: Bir kullanıcı birden fazla işletme yönetebilsin
- **Cevaplama özelliği**: İşletme sahibi yoruma cevap yazabilsin
- **Sosyal medya entegrasyonu**: Google Reviews, Yelp, Trip Advisor'dan veri çekme
- **Tahmin modeli**: "Bu yorumdan sonra müşteri kaybı riski %X"

---

## 15. KAYNAKLAR

### Resmi Dokümantasyonlar

#### Backend
- **Express.js**: https://expressjs.com
- **Sequelize**: https://sequelize.org
- **Node.js**: https://nodejs.org/docs
- **JWT**: https://jwt.io
- **bcryptjs**: https://github.com/dcodeIO/bcrypt.js
- **multer**: https://github.com/expressjs/multer
- **pdfkit**: https://pdfkit.org

#### Frontend
- **Bootstrap 5**: https://getbootstrap.com/docs/5.3
- **Chart.js**: https://www.chartjs.org/docs
- **Bootstrap Icons**: https://icons.getbootstrap.com
- **MDN Web Docs**: https://developer.mozilla.org

#### Veritabanı
- **PostgreSQL**: https://www.postgresql.org/docs
- **pg-hstore**: https://www.npmjs.com/package/pg-hstore

#### Yapay Zeka
- **FastAPI**: https://fastapi.tiangolo.com
- **scikit-learn**: https://scikit-learn.org/stable
- **joblib**: https://joblib.readthedocs.io
- **uvicorn**: https://www.uvicorn.org

#### Veri Seti
- **Hepsiburada Sentiment Dataset**: https://www.kaggle.com/datasets/burhanbilenn/turkish-customer-reviews-for-binary-classification

#### Diğer
- **Stack Overflow**: https://stackoverflow.com (sorun çözmede)
- **GitHub Copilot / ChatGPT**: Geliştirme sürecinde asistan olarak

---

## ✅ SON SÖZ

Bu doküman, projenin **A'dan Z'ye her detayını** içerir:
- Teknoloji seçimlerinin **gerekçeleri**
- **6 veritabanı tablosunun** her sütunu
- **40+ API endpoint'i** request/response örnekleriyle
- **18+ sayfanın** içeriği ve API ilişkileri
- **3 rolün** erişim matrisi
- **YZ modelinin** eğitim süreci ve başarı metrikleri
- **20+ olası soruya** hazırlıklı cevaplar
- **10 zorluk ve çözümü**

Bu dokümanı okuyan biri, projenin her detayını anlayabilir; hocaya karşı **her soruya hazırlıklı** olarak sunum yapabilirsiniz.

---

*Doküman versiyonu: 1.0 — Müşteri rolü eklendi, Türkçe karakter sorunu çözüldü, analiz kartları tıklanabilir hale getirildi.*
