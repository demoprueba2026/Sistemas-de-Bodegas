(function (app) {
  "use strict";

  var STORE_KEY = "mercado-admin-v1";
  var seed = {
    products: [
      { id: "p1", barcode: "7501000110012", name: "Leche entera 1 L", category: "Lácteos", emoji: "🥛", cost: 17020, price: 23000, stock: 6, min: 8, inventoryType: "sale" },
      { id: "p2", barcode: "7501000110029", name: "Pan de caja", category: "Panadería", emoji: "🍞", cost: 25760, price: 35880, stock: 14, min: 5, inventoryType: "sale" },
      { id: "p3", barcode: "7501000110036", name: "Café molido 250 g", category: "Abarrotes", emoji: "☕", cost: 49680, price: 68080, stock: 22, min: 6, inventoryType: "sale" },
      { id: "p4", barcode: "7501000110043", name: "Agua natural 1.5 L", category: "Bebidas", emoji: "💧", cost: 8280, price: 13800, stock: 4, min: 10, inventoryType: "sale" },
      { id: "p5", barcode: "7501000110050", name: "Arroz 1 kg", category: "Abarrotes", emoji: "🍚", cost: 20240, price: 28520, stock: 32, min: 8, inventoryType: "sale" },
      { id: "p6", barcode: "7501000110067", name: "Detergente 1 kg", category: "Limpieza", emoji: "🧼", cost: 35880, price: 50600, stock: 12, min: 4, inventoryType: "sale" },
      { id: "p7", barcode: "7501000110074", name: "Yogur natural", category: "Lácteos", emoji: "🥣", cost: 11040, price: 16560, stock: 3, min: 6, inventoryType: "sale" },
      { id: "p8", barcode: "7501000110081", name: "Manzana roja (kg)", category: "Frutas", emoji: "🍎", cost: 25760, price: 38640, stock: 18, min: 5, inventoryType: "sale" }
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
  var today = new Date();
  app.reportDate = today.getFullYear() + "-" +
    String(today.getMonth() + 1).padStart(2, "0") + "-" +
    String(today.getDate()).padStart(2, "0");
  app.paymentMethod = "Efectivo";
  app.cashReceived = "";
  app.inventorySection = "sale";

  app.saveState = function () {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(app.state));
      return true;
    } catch (error) {
      console.error("No se pudieron guardar los datos locales:", error);
      app.notify("No se pudieron guardar los cambios en este navegador.");
      return false;
    }
  };
})(window.MercadoApp = window.MercadoApp || {});
