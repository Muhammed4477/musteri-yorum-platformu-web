# MüşteriYorum Platformu

Müşteri yorumlarını toplayan, yapay zeka ile duygu analizi yapan ve işletme sahiplerine detaylı raporlar sunan web tabanlı bir platform.

---

## Özellikler

- **Müşteri Paneli** — İşletme arama/filtreleme, yorum bırakma, yorum geçmişi
- **İşletme Sahibi Paneli** — Yorum yönetimi, toplu CSV yükleme, duygu analizi raporları
- **Yapay Zeka Analizi** — TF-IDF + Lojistik Regresyon ile Türkçe duygu sınıflandırma (olumlu / olumsuz / nötr)
- **JWT Kimlik Doğrulama** — Rol tabanlı erişim (musteri / isletme_sahibi / admin)
- **Geliştirici API** — Swagger UI üzerinden erişilebilen REST API dokümantasyonu

---

## Teknoloji Yığını

| Katman | Teknoloji |
|--------|-----------|
| Backend | Node.js, Express.js |
| Veritabanı | PostgreSQL + Sequelize ORM |
| Kimlik Doğrulama | JWT + bcryptjs |
| Yapay Zeka | Python FastAPI (ayrı servis) |
| Frontend | HTML5, Bootstrap 5, Vanilla JS |

---

## Kurulum

### 1. Depoyu klonla

```bash
git clone https://github.com/kullanici/musteri-yorum-platformu.git
cd musteri-yorum-platformu
```

### 2. Bağımlılıkları yükle

```bash
npm install
```

### 3. Ortam değişkenlerini ayarla

```bash
cp .env.example .env
```

`.env` dosyasını açıp kendi veritabanı bilgilerini ve JWT anahtarını gir.

### 4. PostgreSQL veritabanını oluştur

```sql
CREATE DATABASE musteri_yorum;
```

Sequelize modelleri ilk çalıştırmada tabloları otomatik oluşturur (`sync({ alter: true })`).

### 5. Uploads klasörünü oluştur

```bash
mkdir -p uploads
```

### 6. Sunucuyu başlat

```bash
# Geliştirme (nodemon ile)
npm run dev

# Üretim
npm start
```

Sunucu varsayılan olarak `http://localhost:3000` adresinde çalışır.

---

## Yapay Zeka Servisi (Opsiyonel)

Duygu analizi için ayrı bir Python FastAPI servisi gereklidir. Servis kurulmadan platform çalışır; yorum analizleri beklemede kalır.

```bash
# Python bağımlılıklarını yükle
pip install fastapi uvicorn scikit-learn pandas

# Servisi başlat
uvicorn main:app --host 0.0.0.0 --port 8000
```

---

## Proje Yapısı

```
musteri-yorum-platformu/
├── sunucu.js              # Ana Express sunucusu
├── package.json
├── .env.example           # Örnek ortam değişkenleri
├── ayarlar/
│   └── veritabani.js      # Sequelize bağlantısı
├── modeller/              # Sequelize modelleri
├── rotalar/               # API rotaları
│   ├── kimlik.js          # /api/auth
│   ├── isletmeler.js      # /api/businesses
│   ├── yorumlar.js        # /api/musteri & /api/isletme
│   └── ...
├── ara_yazilim/           # JWT auth middleware
├── arayuz/                # Frontend HTML/CSS/JS
│   ├── musteri/           # Müşteri paneli
│   ├── panel/             # İşletme sahibi paneli
│   ├── gelistirici/       # API dokümantasyonu
│   ├── betikler/          # Ortak JS (ana.js, altbilgi.js)
│   └── stiller/           # Ortak CSS
└── uploads/               # Yüklenen dosyalar (git'e dahil değil)
```

---

## API Uç Noktaları

| Yöntem | Uç Nokta | Açıklama |
|--------|----------|----------|
| POST | `/api/auth/kayit` | Kayıt |
| POST | `/api/auth/giris` | Giriş |
| GET | `/api/auth/me` | Profil bilgisi |
| PUT | `/api/auth/me` | Profil güncelle |
| DELETE | `/api/auth/me` | Hesap sil |
| GET | `/api/businesses` | Tüm işletmeler |
| GET | `/api/businesses/:id` | İşletme detayı + yorumlar |
| POST | `/api/musteri/yorum` | Yorum bırak |
| GET | `/api/musteri/yorumlarim` | Kendi yorumlarım |
| DELETE | `/api/musteri/yorum/:id` | Yorum sil |

Tam API dokümantasyonu için `/gelistirici/` sayfasını ziyaret et.

---

## Lisans

Bu proje İnternet Programcılığı dersi kapsamında geliştirilmiştir.
