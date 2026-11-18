(function (app) {
  "use strict";

  app.openProductModal = function (id) {
    var product = id ? app.state.products.find(function (item) { return item.id === id; }) : null;
    if (id && !product) return;
    var editing = Boolean(product);
    document.getElementById("modal-root").innerHTML =
      '<div class="modal-backdrop" id="product-backdrop"><form class="modal" id="product-form"' +
      (editing ? ' data-id="' + app.esc(product.id) + '"' : "") + '>' +
      '<div class="modal-head"><h2>' + (editing ? "Editar producto" : "Nuevo producto") + '</h2><button type="button" class="close-button" data-action="close-modal" aria-label="Cerrar">×</button></div>' +
      '<div class="form-grid"><div class="field wide"><label for="prod-name">Nombre del producto *</label><input id="prod-name" name="name" required maxlength="80" placeholder="Ej. Leche entera 1 L" value="' +
      app.esc(product ? product.name : "") + '"></div>' +
      '<div class="field"><label for="prod-barcode">Código de barras</label><input id="prod-barcode" name="barcode" maxlength="40" placeholder="Escanea o escribe" value="' +
      app.esc(product ? product.barcode : "") + '"></div>' +
      '<div class="field"><label for="prod-category">Categoría</label><input id="prod-category" name="category" maxlength="40" placeholder="Abarrotes" value="' +
      app.esc(product ? product.category : "") + '"></div>' +
      '<div class="field wide"><label for="prod-type">Sección del inventario</label><select id="prod-type" name="inventoryType"><option value="sale"' +
      (app.inventoryType(product || { inventoryType: app.inventorySection }) === "sale" ? " selected" : "") + '>Producto para vender (incluye comidas ya preparadas)</option><option value="ingredient"' +
      (app.inventoryType(product || { inventoryType: app.inventorySection }) === "ingredient" ? " selected" : "") + '>Insumo para preparar comidas</option></select></div>' +
      '<div class="currency-input-group" data-currency-group><div class="field"><label for="prod-cost-bs">Costo de compra (Bs.S) *</label><input id="prod-cost-bs" name="cost" data-currency-kind="bs" required type="number" min="0" step="0.01" value="' +
      app.formatBsInput(product ? product.cost : 0) + '"></div><div class="field"><label for="prod-cost-usd">Equivalente (USD)</label><input id="prod-cost-usd" data-currency-kind="usd" type="number" min="0" step="0.01" value="' +
      app.formatUsdInput(product ? product.cost : 0) + '"></div></div>' +
      '<div class="currency-input-group" data-currency-group><div class="field"><label for="prod-price-bs">Precio de venta (Bs.S) *</label><input id="prod-price-bs" name="price" data-currency-kind="bs" required type="number" min="0" step="0.01" value="' +
      app.formatBsInput(product ? product.price : 0) + '"></div><div class="field"><label for="prod-price-usd">Equivalente (USD)</label><input id="prod-price-usd" data-currency-kind="usd" type="number" min="0" step="0.01" value="' +
      app.formatUsdInput(product ? product.price : 0) + '"></div></div>' +
      '<div class="field"><label for="prod-stock">Existencia</label><input id="prod-stock" name="stock" type="number" min="0" step="1" value="' +
      (product ? product.stock : 0) + '"></div>' +
      '<div class="field"><label for="prod-min">Stock mínimo</label><input id="prod-min" name="min" type="number" min="0" step="1" value="' +
      (product ? product.min : 5) + '"></div>' +
      '<p class="currency-rate-note">Conversión fija de referencia: 1 USD = ' + app.exchangeRate() + ' Bs.</p></div>' +
      '<div class="modal-actions"><button type="button" class="button" data-action="close-modal">Cancelar</button>' +
      '<button type="submit" class="button primary">' + (editing ? "Guardar cambios" : "Guardar producto") + '</button></div></form></div>';
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
    var id = event.target.dataset.id || "";
    var existingProduct = id ? app.state.products.find(function (item) { return item.id === id; }) : null;
    if (id && !existingProduct) {
      app.notify("No se encontró el producto que intentas editar.");
      return;
    }
    var barcode = String(data.get("barcode") || "").trim();
    if (barcode && app.state.products.some(function (product) {
      return product.id !== id && product.barcode === barcode;
    })) {
      app.notify("Ya existe un producto con ese código de barras.");
      return;
    }

    var name = String(data.get("name") || "").trim();
    var cost = Number(data.get("cost"));
    var price = Number(data.get("price"));
    var stock = Number(data.get("stock"));
    var min = Number(data.get("min"));
    if (!name || !Number.isFinite(cost) || !Number.isFinite(price) || cost < 0 || price < 0 ||
      !Number.isInteger(stock) || stock < 0 || !Number.isInteger(min) || min < 0) {
      app.notify("Revisa el nombre, los precios y las existencias del producto.");
      return;
    }

    var updatedValues = {
      barcode: barcode || (existingProduct ? existingProduct.barcode : "SIN-COD-" + Date.now()),
      name: name,
      category: String(data.get("category") || "").trim() || "Sin categoría",
      inventoryType: data.get("inventoryType") === "ingredient" ? "ingredient" : "sale",
      cost: cost,
      price: price,
      stock: stock,
      min: min
    };

    if (existingProduct) {
      var stockChange = updatedValues.stock - existingProduct.stock;
      Object.keys(updatedValues).forEach(function (key) {
        existingProduct[key] = updatedValues[key];
      });
      if (updatedValues.inventoryType === "ingredient") {
        app.cart = app.cart.filter(function (item) { return item.id !== id; });
      }
      if (stockChange !== 0) {
        app.state.movements.unshift({
          id: "m" + Date.now(),
          productId: existingProduct.id,
          productName: existingProduct.name,
          type: "Ajuste manual de inventario",
          quantity: stockChange,
          date: new Date().toISOString()
        });
      }
      app.saveState();
      document.getElementById("modal-root").innerHTML = "";
      app.render();
      app.notify("Cambios guardados correctamente.");
      return;
    }

    var product = {
      id: "p" + Date.now(),
      barcode: updatedValues.barcode,
      emoji: "📦",
      name: updatedValues.name,
      category: updatedValues.category,
      inventoryType: updatedValues.inventoryType,
      cost: updatedValues.cost,
      price: updatedValues.price,
      stock: updatedValues.stock,
      min: updatedValues.min
    };

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

  app.deleteProduct = function (id) {
    var product = app.state.products.find(function (item) { return item.id === id; });
    if (!product) return;
    if (!window.confirm('¿Eliminar "' + product.name + '" del inventario? Las ventas anteriores se conservarán.')) return;

    app.state.products = app.state.products.filter(function (item) { return item.id !== id; });
    app.cart = app.cart.filter(function (item) { return item.id !== id; });
    app.saveState();
    app.render();
    app.notify("Producto eliminado del inventario.");
  };

  app.exportCsv = function () {
    var rows = [["Código", "Producto", "Tipo de inventario", "Categoría", "Costo (Bs.S)", "Costo (USD)", "Precio (Bs.S)", "Precio (USD)", "Existencia", "Mínimo"]];
    app.state.products.forEach(function (product) {
      rows.push([
        product.barcode,
        product.name,
        app.inventoryTypeLabel(product),
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
