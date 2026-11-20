/* Bready Forecast — alanlar ve şablonlar. Anahtarlar veritabanı kurallarıyla aynı, değiştirilmez. */
export const AREAS = [
  { key: "sales", label: "Satış", group: "Mutfak",
    means: { view: "Satışları görür", edit: "Satış girer, PDF/CSV yükler, eşleştirme yapar", delete: "Satış siler", full: "Her şey" } },
  { key: "usage", label: "Kullanım", group: "Mutfak",
    means: { view: "Kullanılan malzemeleri görür" } },
  { key: "plan", label: "Plan (prep + sipariş)", group: "Mutfak",
    means: { view: "Tahmin, prep ve sipariş listesini görür", edit: "Tarih, buffer ve stok değiştirir", delete: "Plan ayarlarını siler" } },
  { key: "recipes", label: "Reçeteler", group: "Ayarlar",
    means: { view: "Reçeteleri görür", edit: "Reçete ekler ve değiştirir", delete: "Reçete siler" } },
  { key: "ingredients", label: "Malzemeler ve fiyatlar", group: "Ayarlar",
    means: { view: "Malzemeleri ve fiyatları görür", edit: "Fiyat, paket ve tedarikçi değiştirir", delete: "Malzeme siler" } },
  { key: "calendar", label: "Özel günler", group: "Ayarlar",
    means: { view: "Özel günleri görür", edit: "Özel gün ekler ve değiştirir", delete: "Özel gün siler" } },
  { key: "invoices", label: "Faturalar", group: "Satın alma",
    means: { view: "Faturaları ve dosyalarını görür, dışa aktarır", edit: "Fatura yükler ve düzeltir", delete: "Fatura siler", full: "Ödenmiş faturayı da değiştirir ve siler" } },
  { key: "team", label: "Ekip ve erişim", group: "Yönetim",
    means: {
      none: "Ekip sayfası görünmez",
      view: "Ekipte kim var, kim neye erişiyor görür",
      edit: "Kişi davet eder, kendi seviyesine kadar yetki verir",
      delete: "Kişiyi ekipten çıkarır",
      full: "Herkese her yetkiyi verir",
    } },
];

export const ADMIN_AREA = "team";

export const TEMPLATES = [
  { name: "Admin", what: "Her şey", blurb: "Bütün bölümler tam yetki, ekip yönetimi dahil.", perms: { "*": "full" } },
  { name: "Manager", what: "Mutfağı yönetir", blurb: "Satış girer ve siler; reçete, fiyat, plan ve özel günleri değiştirir; fatura yükler ve siler. Ekibi görür ama yetki veremez.",
    perms: { sales: "delete", usage: "view", plan: "edit", recipes: "edit", ingredients: "edit", calendar: "edit", invoices: "delete", team: "view" } },
  { name: "Supervisor", what: "Satış girer", blurb: "Satış girer ve yükler; geri kalan her şeyi görür.",
    perms: { sales: "edit", usage: "view", plan: "view", recipes: "view", ingredients: "view", calendar: "view" } },
  { name: "Staff", what: "Sadece görür", blurb: "Satış, kullanım, plan, reçete ve fiyatları görür. Hiçbir şey giremez.",
    perms: { sales: "view", usage: "view", plan: "view", recipes: "view", ingredients: "view", calendar: "view" } },
];
