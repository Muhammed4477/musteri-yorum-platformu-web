const { DataTypes } = require('sequelize');
const sequelize = require('../ayarlar/veritabani');

const Business = sequelize.define('Business', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  owner_id: { type: DataTypes.INTEGER, allowNull: true },
  isletme_adi: { type: DataTypes.STRING, allowNull: false },
  aciklama: { type: DataTypes.TEXT },
  sehir: { type: DataTypes.STRING },
  ilce: { type: DataTypes.STRING },
  kategori: { type: DataTypes.STRING },
  olusturma: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  tableName: 'businesses',
  timestamps: false
});

module.exports = Business;
