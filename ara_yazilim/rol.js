// Tek rol veya rol listesi kontrolü
// Kullanım: authorize('admin') veya authorize(['admin','user'])
function authorize(roles) {
  const izinli = Array.isArray(roles) ? roles : [roles];
  return (req, res, next) => {
    if (req.user && izinli.includes(req.user.rol)) {
      return next();
    }
    return res.status(403).json({ hata: 'Bu işlem için yetkiniz yok' });
  };
}

// Geriye uyumluluk: default export admin kontrolü
module.exports = authorize('admin');
module.exports.authorize = authorize;
