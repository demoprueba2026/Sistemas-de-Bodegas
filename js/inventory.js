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
      '<div class="field"><label for="prod-supplier">Proveedor</label><input id="prod-supplier" name="supplier" maxlength="80" placeholder="Ej. Distribuidora Central" value="' +
      app.esc(product ? product.supplier || "" : "") + '"></div>' +
      '<div class="field"><label for="prod-container">N.º de contenedor</label><input id="prod-container" name="container" maxlength="40" placeholder="Ej. T345" value="' +
      app.esc(product ? product.container || "" : "") + '"></div>' +
      '<div class="field"><label for="prod-unit">Unidad</label><input id="prod-unit" name="unit" maxlength="30" placeholder="Unidad, caja, kg..." value="' +
      app.esc(product ? product.unit || "Unidad" : "Unidad") + '"></div>' +
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
      '<p class="currency-rate-note">Tasa oficial BCV: 1 USD = ' + app.exchangeRate() + ' Bs.</p></div>' +
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

  app.saveProduct = async function (event) {
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
      supplier: String(data.get("supplier") || "").trim(),
      container: String(data.get("container") || "").trim(),
      location: existingProduct ? existingProduct.location || "" : "",
      unit: String(data.get("unit") || "").trim() || "Unidad",
      cost: cost,
      price: price,
      stock: stock,
      min: min
    };

    var submitButton = event.target.querySelector('[type="submit"]');
    if (submitButton) submitButton.disabled = true;
    try {
      var result = await window.MercadoAuth.getSupabaseClient().rpc("save_product", {
        p_product_id: existingProduct ? existingProduct.id : null,
        p_barcode: updatedValues.barcode,
        p_name: updatedValues.name,
        p_category: updatedValues.category,
        p_emoji: existingProduct ? existingProduct.emoji || "📦" : "📦",
        p_cost: updatedValues.cost,
        p_price: updatedValues.price,
        p_stock: updatedValues.stock,
        p_stock_min: updatedValues.min,
        p_supplier: updatedValues.supplier,
        p_container: updatedValues.container,
        p_location: updatedValues.location,
        p_unit: updatedValues.unit
      });
      if (result.error) throw result.error;
      var row = Array.isArray(result.data) ? result.data[0] : result.data;
      if (!row) throw new Error("Supabase no devolvió el producto guardado.");

      var savedProduct = app.mapSupabaseProduct(row);
      var productIndex = app.state.products.findIndex(function (item) { return item.id === savedProduct.id; });
      if (productIndex === -1) app.state.products.push(savedProduct);
      else app.state.products[productIndex] = savedProduct;
      app.saveState();

      var refreshFailed = false;
      try {
        await app.reloadCloudData();
      } catch (refreshError) {
        refreshFailed = true;
        console.error("El producto se guardó, pero no se pudo actualizar la vista:", refreshError);
        app.notify("Producto guardado en Supabase; no se pudo actualizar la vista.");
      }
      document.getElementById("modal-root").innerHTML = "";
      app.render();
      if (!refreshFailed) app.notify(existingProduct ? "Cambios guardados correctamente." : "Producto agregado al inventario.");
    } catch (error) {
      console.error("No se pudo guardar el producto en Supabase:", error);
      app.notify("No se pudo guardar el producto: " + (error.message || "Error de Supabase."));
      if (submitButton) submitButton.disabled = false;
    }
  };

  app.saveStock = async function (event) {
    event.preventDefault();
    var id = event.target.dataset.id;
    var quantity = Number(new FormData(event.target).get("quantity"));
    var product = app.state.products.find(function (item) { return item.id === id; });
    if (!product || !Number.isInteger(quantity) || quantity <= 0) {
      app.notify("Ingresa una cantidad válida.");
      return;
    }
    var submitButton = event.target.querySelector('[type="submit"]');
    if (submitButton) submitButton.disabled = true;
    try {
      var result = await window.MercadoAuth.getSupabaseClient().rpc("receive_stock", {
        p_product_id: id,
        p_quantity: quantity
      });
      if (result.error) throw result.error;

      var refreshFailed = false;
      try {
        await app.reloadCloudData();
      } catch (refreshError) {
        refreshFailed = true;
        console.error("La entrada se guardó, pero no se pudo actualizar la vista:", refreshError);
        product.stock = Number(result.data);
        app.state.movements.unshift({
          id: "pending-refresh-" + Date.now(),
          productId: id,
          productName: product.name,
          type: "Entrada de mercancía",
          quantity: quantity,
          date: new Date().toISOString()
        });
        app.saveState();
        app.notify("Entrada guardada en Supabase; no se pudo actualizar la vista.");
      }
      document.getElementById("modal-root").innerHTML = "";
      app.render();
      if (!refreshFailed) app.notify("Entrada registrada: +" + quantity + " unidades.");
    } catch (error) {
      console.error("No se pudo registrar la entrada en Supabase:", error);
      app.notify("No se pudo registrar la entrada: " + (error.message || "Error de Supabase."));
      if (submitButton) submitButton.disabled = false;
    }
  };

  app.deleteProduct = async function (id) {
    var product = app.state.products.find(function (item) { return item.id === id; });
    if (!product) return;
    if (!window.confirm('¿Eliminar "' + product.name + '" del inventario? Las ventas anteriores se conservarán.')) return;

    try {
      var result = await window.MercadoAuth.getSupabaseClient()
        .from("products").delete().eq("id", id).eq("owner_id", app.ownerId);
      if (result.error) throw result.error;
    } catch (error) {
      console.error("No se pudo eliminar el producto de Supabase:", error);
      app.notify("No se pudo eliminar el producto: " + (error.message || "Error de Supabase."));
      return;
    }

    app.state.products = app.state.products.filter(function (item) { return item.id !== id; });
    app.cart = app.cart.filter(function (item) { return item.id !== id; });
    app.inventorySelectionIds = (app.inventorySelectionIds || []).filter(function (itemId) { return itemId !== id; });
    app.saveState();
    var refreshFailed = false;
    try {
      await app.reloadCloudData();
    } catch (refreshError) {
      refreshFailed = true;
      console.error("El producto se eliminó, pero no se pudo actualizar la vista:", refreshError);
      app.notify("Producto eliminado en Supabase; no se pudo actualizar la vista.");
    }
    app.render();
    if (!refreshFailed) app.notify("Producto eliminado del inventario.");
  };

  app.exportExcel = function () {
    var rows = [["N.º", "Descripción", "Proveedor", "Categoría", "N.º de contenedor", "Unidad",
      "Existencia", "Stock mínimo", "Costo (Bs.S)", "Costo (USD)", "Precio (Bs.S)", "Precio (USD)"]];
    var products = app.state.products.filter(function (product) {
      return app.inventoryType(product) === "sale";
    });

    products.forEach(function (product, index) {
      rows.push([
        index + 1,
        product.name,
        product.supplier || "",
        product.category || "Sin categoría",
        product.container || "",
        product.unit || "Unidad",
        Number(product.stock) || 0,
        Number(product.min) || 0,
        Number(product.cost) || 0,
        (Number(product.cost) / app.exchangeRate() || 0).toFixed(2),
        Number(product.price) || 0,
        (Number(product.price) / app.exchangeRate() || 0).toFixed(2)
      ]);
    });

    var csv = "\uFEFF" + rows.map(function (row) {
      return row.map(function (cell) {
        var value = String(cell == null ? "" : cell);
        if (typeof cell === "string" && /^[\s]*[=+\-@]/.test(value)) value = "'" + value;
        return '"' + value.replace(/"/g, '""') + '"';
      }).join(",");
    }).join("\r\n");
    var link = document.createElement("a");
    var fileUrl = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.href = fileUrl;
    link.download = "inventario-mercado.csv";
    link.click();
    window.setTimeout(function () { URL.revokeObjectURL(fileUrl); }, 0);
  };

  app.openInventorySelection = function () {
    var previousTable = document.querySelector(".inventory-modal-table");
    var previousScrollTop = previousTable ? previousTable.scrollTop : 0;
    app.inventorySelectionIds = app.inventorySelectionIds || [];
    var products = app.state.products.filter(function (product) {
      return app.inventoryType(product) === "sale";
    });
    var selected = products.filter(function (product) {
      return app.inventorySelectionIds.indexOf(product.id) !== -1;
    }).length;
    var rows = products.length ? products.map(function (product) {
      var isSelected = app.inventorySelectionIds.indexOf(product.id) !== -1;
      return '<tr><td><input type="checkbox" data-action="toggle-inventory-selection" data-id="' + app.esc(product.id) +
        '" aria-label="Seleccionar ' + app.esc(product.name) + '"' + (isSelected ? " checked" : "") + '></td><td>' +
        app.esc(product.name) + '</td><td>' + app.esc(product.container || "—") +
        '</td><td>' + app.esc(product.location || "—") + '</td><td>' + app.esc(product.unit || "Unidad") +
        '</td><td>' + product.stock + '</td></tr>';
    }).join("") : '<tr><td colspan="6" class="empty">No hay productos en esta sección.</td></tr>';
    document.getElementById("modal-root").innerHTML =
      '<div class="modal-backdrop" id="inventory-selection-backdrop"><section class="modal inventory-modal">' +
      '<div class="modal-head"><div><h2>Lista de selección de inventario</h2><p class="subtitle">Marca los artículos que necesitas incluir en la selección.</p></div>' +
      '<button type="button" class="close-button" data-action="close-modal" aria-label="Cerrar">×</button></div>' +
      '<div class="table-wrap inventory-modal-table"><table><thead><tr><th></th><th>Descripción</th><th>Contenedor</th><th>Ubicación</th><th>Unidad</th><th>Cant.</th></tr></thead><tbody>' +
      rows + '</tbody></table></div><div class="modal-actions"><span class="muted inventory-selection-count">' + selected +
      ' artículos seleccionados</span><button type="button" class="button" data-action="clear-inventory-selection">Limpiar</button>' +
      '<button type="button" class="button primary" data-action="export-selection"' + (selected ? "" : " disabled") +
      '>Exportar selección</button></div></section></div>';
    var table = document.querySelector(".inventory-modal-table");
    if (table) table.scrollTop = previousScrollTop;
  };

  app.openContainerSearch = function () {
    app.containerSearchTerm = "";
    app.renderContainerSearch();
  };

  app.renderContainerSearch = function () {
    var query = app.normalizeSearch(app.containerSearchTerm);
    var products = app.state.products.filter(function (product) {
      return app.inventoryType(product) === "sale" &&
        (!query || app.normalizeSearch(String(product.container || "") + " " +
          String(product.location || "") + " " + product.name).indexOf(query) !== -1);
    });
    var rows = products.length ? products.map(function (product) {
      return '<tr><td>' + app.esc(product.container || "—") + '</td><td>' + app.esc(product.location || "—") +
        '</td><td>' + app.esc(product.name) + '</td><td>' +
        product.stock + ' ' + app.esc(product.unit || "Unidad") + '</td></tr>';
    }).join("") : '<tr><td colspan="4" class="empty">No hay resultados para esa búsqueda.</td></tr>';
    document.getElementById("modal-root").innerHTML =
      '<div class="modal-backdrop" id="container-search-backdrop"><section class="modal inventory-modal">' +
      '<div class="modal-head"><div><h2>Búsqueda de contenedores</h2><p class="subtitle">Busca por contenedor, ubicación o nombre del producto.</p></div>' +
      '<button type="button" class="close-button" data-action="close-modal" aria-label="Cerrar">×</button></div>' +
      '<input class="search container-search" id="container-search" placeholder="Buscar contenedor o producto..." value="' +
      app.esc(app.containerSearchTerm || "") + '" aria-label="Buscar contenedor o producto">' +
      '<div class="table-wrap inventory-modal-table"><table><thead><tr><th>N.º de contenedor</th><th>Ubicación</th><th>Descripción</th><th>Cantidad</th></tr></thead><tbody>' +
      rows + '</tbody></table></div></section></div>';
    var search = document.getElementById("container-search");
    if (search) search.focus();
  };

  app.exportInventorySelection = function () {
    app.inventorySelectionIds = app.inventorySelectionIds || [];
    var selected = app.state.products.filter(function (product) {
      return app.inventoryType(product) === "sale" &&
        app.inventorySelectionIds.indexOf(product.id) !== -1;
    });
    if (!selected.length) {
      app.notify("Selecciona al menos un artículo para exportar.");
      return;
    }

    var rows = [["Descripción", "N.º de contenedor", "Ubicación", "Unidad", "Cantidad"]];
    selected.forEach(function (product) {
      rows.push([product.name, product.container || "", product.location || "",
        product.unit || "Unidad", product.stock]);
    });
    var csv = "\uFEFF" + rows.map(function (row) {
      return row.map(function (cell) { return '"' + String(cell).replace(/"/g, '""') + '"'; }).join(",");
    }).join("\r\n");
    var link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = "seleccion-inventario.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  };
})(window.MercadoApp = window.MercadoApp || {});
