const { DataTypes } = require('sequelize');
const sequelize = require('../ayarlar/veritabani');

const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  ad_soyad: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  sifre_hash: { type: DataTypes.STRING, allowNull: false },
  rol: { type: DataTypes.STRING(15), defaultValue: 'user' },
  isletme_adi: { type: DataTypes.STRING },
  olusturma: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  tableName: 'users',
  timestamps: false
});

module.exports = User;
