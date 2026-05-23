const { DataTypes } = require('sequelize');
const sequelize = require('../ayarlar/veritabani');

const BulkUpload = sequelize.define('BulkUpload', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  dosya_adi: { type: DataTypes.STRING },
  toplam_satir: { type: DataTypes.INTEGER, defaultValue: 0 },
  basarili: { type: DataTypes.INTEGER, defaultValue: 0 },
  hatali: { type: DataTypes.INTEGER, defaultValue: 0 },
  yukleme_tarihi: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  tableName: 'bulk_uploads',
  timestamps: false
});

module.exports = BulkUpload;
