const { DataTypes } = require('sequelize');
const sequelize = require('../ayarlar/veritabani');

const Category = sequelize.define('Category', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  kategori_adi: { type: DataTypes.STRING, allowNull: false },
  aciklama: { type: DataTypes.TEXT }
}, {
  tableName: 'categories',
  timestamps: false
});

module.exports = Category;
