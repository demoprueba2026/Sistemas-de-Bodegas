(function (app) {
  "use strict";

  app.openProductModal = function () {
    document.getElementById("modal-root").innerHTML =
      '<div class="modal-backdrop" id="product-backdrop"><form class="modal" id="product-form">' +
      '<div class="modal-head"><h2>Nuevo producto</h2><button type="button" class="close-button" data-action="close-modal" aria-label="Cerrar">×</button></div>' +
      '<div class="form-grid"><div class="field wide"><label for="prod-name">Nombre del producto *</label><input id="prod-name" name="name" required maxlength="80" placeholder="Ej. Leche entera 1 L"></div>' +
      '<div class="field"><label for="prod-barcode">Código de barras</label><input id="prod-barcode" name="barcode" maxlength="40" placeholder="Escanea o escribe"></div>' +
      '<div class="field"><label for="prod-category">Categoría</label><input id="prod-category" name="category" maxlength="40" placeholder="Abarrotes"></div>' +
      '<div class="currency-input-group" data-currency-group><div class="field"><label for="prod-cost-bs">Costo de compra (Bs.S) *</label><input id="prod-cost-bs" name="cost" data-currency-kind="bs" required type="number" min="0" step="0.01" value="0"></div><div class="field"><label for="prod-cost-usd">Equivalente (USD)</label><input id="prod-cost-usd" data-currency-kind="usd" type="number" min="0" step="0.01" value="0"></div></div>' +
      '<div class="currency-input-group" data-currency-group><div class="field"><label for="prod-price-bs">Precio de venta (Bs.S) *</label><input id="prod-price-bs" name="price" data-currency-kind="bs" required type="number" min="0" step="0.01" value="0"></div><div class="field"><label for="prod-price-usd">Equivalente (USD)</label><input id="prod-price-usd" data-currency-kind="usd" type="number" min="0" step="0.01" value="0"></div></div>' +
      '<div class="field"><label for="prod-stock">Existencia inicial</label><input id="prod-stock" name="stock" type="number" min="0" step="1" value="0"></div>' +
      '<div class="field"><label for="prod-min">Stock mínimo</label><input id="prod-min" name="min" type="number" min="0" step="1" value="5"></div>' +
      '<p class="currency-rate-note">Conversión fija de referencia: 1 USD = ' + app.exchangeRate() + ' Bs.</p></div>' +
      '<div class="modal-actions"><button type="button" class="button" data-action="close-modal">Cancelar</button>' +
      '<button type="submit" class="button primary">Guardar producto</button></div></form></div>';
    document.getElementById("prod-name").focus();
  };

  app.openStockModal = function (id) {
    var product = app.state.products.find(function (item) { return item.id === id; });
    if (!product) return;
    document.getElementById("modal-root").innerHTML =
      '<div class="modal-backdrop"><form class="modal" id="stock-form" data-id="' + app.esc(id) + '">' +
      '<div class="modal-head"><h2>Entrada de inventario</h2><button type="button" class="close-button" data-action="close-modal" aria-label="Cerrar">×</button></div>' +
      '<p class="subtitle modal-description">' + app.esc(product.name) + ' · Existencia actual: ' + product.stock + '</p>' +
      '<div class="field"><label for="stock-quantity">Cantidad recibida *</label><input id="stock-quantity" name="quantity" type="number" min="1" step="1" required placeholder="0"></div>' +
      '<div class="modal-actions"><button type="button" class="button" data-action="close-modal">Cancelar</button>' +
      '<button class="button primary" type="submit">Registrar entrada</button></div></form></div>';
    document.getElementById("stock-quantity").focus();
  };

  app.saveProduct = function (event) {
    event.preventDefault();
    var data = new FormData(event.target);
    var barcode = String(data.get("barcode") || "").trim();
    if (barcode && app.state.products.some(function (product) { return product.barcode === barcode; })) {
      app.notify("Ya existe un producto con ese código de barras.");
      return;
    }

    var product = {
      id: "p" + Date.now(),
      barcode: barcode || "SIN-COD-" + Date.now(),
      name: String(data.get("name")).trim(),
      category: String(data.get("category") || "").trim() || "Sin categoría",
      emoji: "📦",
      cost: Number(data.get("cost")),
      price: Number(data.get("price")),
      stock: Math.max(0, Number(data.get("stock")) || 0),
      min: Math.max(0, Number(data.get("min")) || 0)
    };

    if (!product.name || !Number.isFinite(product.cost) || !Number.isFinite(product.price) || product.cost < 0 || product.price < 0) {
      app.notify("Revisa el nombre y los precios del producto.");
      return;
    }

    app.state.products.push(product);
    if (product.stock > 0) {
      app.state.movements.unshift({
        id: "m" + Date.now(),
        productId: product.id,
        productName: product.name,
        type: "Inventario inicial",
        quantity: product.stock,
        date: new Date().toISOString()
      });
    }
    app.saveState();
    document.getElementById("modal-root").innerHTML = "";
    app.render();
    app.notify("Producto agregado al inventario.");
  };

  app.saveStock = function (event) {
    event.preventDefault();
    var id = event.target.dataset.id;
    var quantity = Number(new FormData(event.target).get("quantity"));
    var product = app.state.products.find(function (item) { return item.id === id; });
    if (!product || !Number.isInteger(quantity) || quantity <= 0) {
      app.notify("Ingresa una cantidad válida.");
      return;
    }

    product.stock += quantity;
    app.state.movements.unshift({
      id: "m" + Date.now(),
      productId: id,
      productName: product.name,
      type: "Entrada de mercancía",
      quantity: quantity,
      date: new Date().toISOString()
    });
    app.saveState();
    document.getElementById("modal-root").innerHTML = "";
    app.render();
    app.notify("Entrada registrada: +" + quantity + " unidades.");
  };

  app.exportCsv = function () {
    var rows = [["Código", "Producto", "Categoría", "Costo (Bs.S)", "Costo (USD)", "Precio (Bs.S)", "Precio (USD)", "Existencia", "Mínimo"]];
    app.state.products.forEach(function (product) {
      rows.push([
        product.barcode,
        product.name,
        product.category,
        product.cost,
        (product.cost / app.exchangeRate()).toFixed(2),
        product.price,
        (product.price / app.exchangeRate()).toFixed(2),
        product.stock,
        product.min
      ]);
    });
    var csv = "\uFEFF" + rows.map(function (row) {
      return row.map(function (cell) { return '"' + String(cell).replace(/"/g, '""') + '"'; }).join(",");
    }).join("\r\n");
    var link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = "inventario-mercado.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  };
})(window.MercadoApp = window.MercadoApp || {});
