(function (app) {
  "use strict";

  var STORE_KEY = "mercado-admin-v1";
  var seed = {
    products: [
      { id: "p1", barcode: "7501000110012", name: "Leche entera 1 L", category: "Lácteos", emoji: "🥛", cost: 18.5, price: 25, stock: 6, min: 8 },
      { id: "p2", barcode: "7501000110029", name: "Pan de caja", category: "Panadería", emoji: "🍞", cost: 28, price: 39, stock: 14, min: 5 },
      { id: "p3", barcode: "7501000110036", name: "Café molido 250 g", category: "Abarrotes", emoji: "☕", cost: 54, price: 74, stock: 22, min: 6 },
      { id: "p4", barcode: "7501000110043", name: "Agua natural 1.5 L", category: "Bebidas", emoji: "💧", cost: 9, price: 15, stock: 4, min: 10 },
      { id: "p5", barcode: "7501000110050", name: "Arroz 1 kg", category: "Abarrotes", emoji: "🍚", cost: 22, price: 31, stock: 32, min: 8 },
      { id: "p6", barcode: "7501000110067", name: "Detergente 1 kg", category: "Limpieza", emoji: "🧼", cost: 39, price: 55, stock: 12, min: 4 },
      { id: "p7", barcode: "7501000110074", name: "Yogur natural", category: "Lácteos", emoji: "🥣", cost: 12, price: 18, stock: 3, min: 6 },
      { id: "p8", barcode: "7501000110081", name: "Manzana roja (kg)", category: "Frutas", emoji: "🍎", cost: 28, price: 42, stock: 18, min: 5 }
    ],
    movements: [],
    sales: [],
    nextReceipt: 1001
  };

  function loadState() {
    try {
      var saved = localStorage.getItem(STORE_KEY);
      if (!saved) return JSON.parse(JSON.stringify(seed));
      var parsed = JSON.parse(saved);
      if (!parsed || !Array.isArray(parsed.products) || !Array.isArray(parsed.sales) || !Array.isArray(parsed.movements)) {
        throw new Error("Los datos guardados no tienen el formato esperado.");
      }
      return parsed;
    } catch (error) {
      console.error("No se pudieron cargar los datos locales:", error);
      return JSON.parse(JSON.stringify(seed));
    }
  }

  app.state = loadState();
  app.cart = [];
  app.page = "dashboard";
  app.searchTerm = "";
  app.reportPeriod = "Hoy";

  app.saveState = function () {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(app.state));
    } catch (error) {
      console.error("No se pudieron guardar los datos locales:", error);
      app.notify("No se pudieron guardar los cambios en este navegador.");
    }
  };
})(window.MercadoApp = window.MercadoApp || {});
