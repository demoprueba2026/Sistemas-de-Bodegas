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
  app.dataReady = false;
  app.dataError = "";
  app.ownerId = "";
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
      var key = app.ownerId ? STORE_KEY + ":" + app.ownerId : STORE_KEY;
      localStorage.setItem(key, JSON.stringify(app.state));
      return true;
    } catch (error) {
      console.error("No se pudo guardar la copia local de los datos:", error);
      return false;
    }
  };

  app.mapSupabaseProduct = function (row) {
    return {
      id: row.id,
      barcode: row.barcode,
      name: row.name,
      category: row.category || "Sin categoría",
      emoji: row.emoji || "📦",
      cost: Number(row.cost) || 0,
      price: Number(row.price) || 0,
      stock: Number(row.stock) || 0,
      min: Number(row.stock_min) || 0,
      inventoryType: row.inventory_type || "sale",
      supplier: row.supplier || "",
      container: row.container || "",
      location: row.location || "",
      unit: row.unit || "Unidad"
    };
  };

  function fetchAll(client, table, columns, orderColumn, ascending) {
    var pageSize = 1000;
    var rows = [];

    function fetchPage(start) {
      return client.from(table).select(columns)
        .order(orderColumn, { ascending: ascending })
        .range(start, start + pageSize - 1)
        .then(function (result) {
          if (result.error) throw result.error;
          rows = rows.concat(result.data || []);
          if (!result.data || result.data.length < pageSize) return rows;
          return fetchPage(start + pageSize);
        });
    }

    return fetchPage(0);
  }

  app.reloadCloudData = function () {
    var client;
    try {
      client = window.MercadoAuth.getSupabaseClient();
    } catch (error) {
      return Promise.reject(error);
    }

    return window.MercadoAuth.getCurrentUser().then(function (user) {
      app.ownerId = user.id;
      return Promise.all([
        fetchAll(client, "products", "*", "name", true),
        fetchAll(client, "sales", "*", "created_at", false),
        fetchAll(client, "sale_items", "sale_id,product_id,product_name,quantity,unit_price,unit_cost", "created_at", true),
        fetchAll(client, "inventory_movements", "*", "created_at", false)
      ]);
    }).then(function (results) {
      var products = results[0].map(app.mapSupabaseProduct);
      var itemsBySale = {};
      results[2].forEach(function (row) {
        itemsBySale[row.sale_id] = itemsBySale[row.sale_id] || [];
        itemsBySale[row.sale_id].push({
          productId: row.product_id,
          name: row.product_name,
          quantity: Number(row.quantity),
          price: Number(row.unit_price),
          cost: Number(row.unit_cost)
        });
      });

      var sales = results[1].map(function (row) {
        var items = itemsBySale[row.id];
        if (!items && Array.isArray(row.items)) {
          items = row.items.map(function (item) {
            return {
              productId: item.productId || item.product_id || "",
              name: item.name || item.product_name || "Producto",
              quantity: Number(item.quantity) || 0,
              price: Number(item.price || item.unit_price) || 0,
              cost: Number(item.cost || item.unit_cost) || 0
            };
          });
        }
        return {
          id: row.id,
          receipt: row.receipt,
          createdAt: row.created_at || row.sale_date,
          total: Number(row.total) || 0,
          profit: Number(row.profit) || 0,
          method: row.payment_method,
          cash: Number(row.cash_received) || 0,
          change: Number(row.change_given) || 0,
          voided: Boolean(row.voided),
          items: items || []
        };
      });

      var movements = results[3].map(function (row) {
        return {
          id: row.id,
          productId: row.product_id,
          productName: row.product_name,
          type: row.movement_type,
          quantity: Number(row.quantity),
          date: row.created_at
        };
      });
      var lastReceipt = sales.reduce(function (max, sale) {
        var receipt = Number(sale.receipt);
        return Number.isFinite(receipt) ? Math.max(max, receipt) : max;
      }, 1000);

      app.state = {
        products: products,
        sales: sales,
        movements: movements,
        nextReceipt: lastReceipt + 1
      };
      app.saveState();
      return app.state;
    });
  };

  app.initializeData = app.reloadCloudData;
})(window.MercadoApp = window.MercadoApp || {});
