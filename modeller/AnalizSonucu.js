const { DataTypes } = require('sequelize');
const sequelize = require('../ayarlar/veritabani');

const AnalysisResult = sequelize.define('AnalysisResult', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  review_id: { type: DataTypes.INTEGER, allowNull: false },
  duygu: { type: DataTypes.ENUM('olumlu', 'olumsuz', 'nötr'), allowNull: false },
  konu_etiketi: { type: DataTypes.STRING },
  guven_skoru: { type: DataTypes.FLOAT },
  ozet: { type: DataTypes.TEXT },
  analiz_tarihi: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  tableName: 'analysis_results',
  timestamps: false
});

module.exports = AnalysisResult;
