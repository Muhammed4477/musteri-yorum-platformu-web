const { DataTypes } = require('sequelize');
const sequelize = require('../ayarlar/veritabani');

const Review = sequelize.define('Review', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  business_id: { type: DataTypes.INTEGER, allowNull: true },
  musteri_adi: { type: DataTypes.STRING },
  yorum_metni: { type: DataTypes.TEXT, allowNull: false },
  puan: { type: DataTypes.INTEGER, validate: { min: 1, max: 5 } },
  kategori_id: { type: DataTypes.INTEGER },
  konu_etiketi: { type: DataTypes.STRING },
  isletme_yaniti: { type: DataTypes.TEXT, allowNull: true },
  kaynak: { type: DataTypes.ENUM('manuel', 'csv', 'api'), defaultValue: 'manuel' },
  olusturma: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  tableName: 'reviews',
  timestamps: false
});

module.exports = Review;
