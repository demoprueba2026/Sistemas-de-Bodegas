(function (app) {
  "use strict";

  app.renderDashboard = function () {
    var state = app.state;
    var sales = app.todaySales();
    var revenue = app.sumSales(sales);
    var profit = sales.reduce(function (sum, sale) { return sum + sale.profit; }, 0);
    var alerts = app.stockAlerts();
    var sold = state.products.reduce(function (sum, product) { return sum + product.stock; }, 0);
    var chartDays = [];

    for (var i = 6; i >= 0; i--) {
      var day = new Date();
      day.setDate(day.getDate() - i);
      day.setHours(0, 0, 0, 0);
      var end = day.getTime() + 86400000;
      var amount = state.sales.filter(function (sale) {
        var time = new Date(sale.createdAt).getTime();
        return !sale.voided && time >= day.getTime() && time < end;
      }).reduce(function (sum, sale) { return sum + sale.total; }, 0);
      chartDays.push({ date: day, amount: amount });
    }

    var max = Math.max.apply(null, chartDays.map(function (item) { return item.amount; }).concat([1]));
    var bars = chartDays.map(function (item, index) {
      var height = item.amount > 0 ? Math.max(4, item.amount / max * 92) : 3;
      var dayName = new Intl.DateTimeFormat("es-VE", { weekday: "short" }).format(item.date).replace(".", "");
      return '<div class="bar-group"><div class="bar ' + (index === 6 ? "current" : "") + '" style="height:' + height + '%" title="' + app.esc(app.money(item.amount)) + '"></div><span class="bar-label">' + app.esc(dayName) + '</span></div>';
    }).join("");

    var alertRows = alerts.length ? alerts.slice(0, 5).map(function (product) {
      var stock = Math.max(0, Number(product.stock) || 0);
      var label = stock === 0 ? "Agotado" : "Existencia baja";
      return '<div class="alert-row"><span class="product-thumb">' + app.esc(product.emoji || "📦") + '</span><div><div class="alert-name">' + app.esc(product.name) + '</div><div class="alert-category">' + app.esc(product.category) + '</div></div><span class="stock-pill">' + label + ' · ' + stock + ' ' + (stock === 1 ? "unidad" : "unidades") + '</span></div>';
    }).join("") : '<div class="empty">Todo en orden. No hay productos con existencia baja.</div>';

    var recent = state.sales.filter(function (sale) { return !sale.voided; })
      .slice().sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); }).slice(0, 5);
    var recentRows = recent.length ? recent.map(function (sale) {
      return '<tr><td>#' + app.esc(sale.receipt) + '</td><td>' +
        app.esc(new Intl.DateTimeFormat("es-VE", { hour: "2-digit", minute: "2-digit" }).format(new Date(sale.createdAt))) +
        '</td><td>' + app.esc(sale.items.reduce(function (n, item) { return n + item.quantity; }, 0)) +
        ' artículos</td><td>' + app.esc(sale.method) + '</td><td class="price">' +
        app.moneyPair(sale.total) + '</td></tr>';
    }).join("") : '<tr><td colspan="5" class="empty">Todavía no hay ventas. Registra la primera desde el punto de venta.</td></tr>';

    return app.pageHeading("Buenos días 👋", "Aquí tienes el resumen de tu tienda.", '<button class="button primary" data-go="pos">＋ Nueva venta</button>') +
      '<section class="stats">' +
        app.statCard("Ventas de hoy", app.moneyPair(revenue), sales.length + " transacciones", "↗", "", true) +
        app.statCard("Ganancia bruta", app.moneyPair(profit), "Según costo registrado al vender", "◈", "gold", true) +
        app.statCard("Productos en catálogo", state.products.length, "Unidades en inventario: " + sold, "▤", "blue", false) +
        app.statCard("Alertas de inventario", alerts.length, alerts.length ? "Requieren atención" : "Sin alertas pendientes", "⚑", "red", false) +
      '</section>' +
      '<section class="dashboard-grid"><div class="panel"><div class="panel-heading"><div><div class="panel-title">Ventas de la semana</div><div class="panel-subtitle">Ingresos registrados en los últimos 7 días</div></div><span class="status">Últimos 7 días</span></div><div class="chart-wrap"><div class="chart-y"><span>' + app.esc(app.money(max)) + '</span><span>' + app.esc(app.money(max / 2)) + '</span><span>' + app.esc(app.money(0)) + '</span></div><div class="chart-bars">' + bars + '</div></div><div class="chart-legend"><span><i class="legend-dot dark"></i>Hoy</span><span><i class="legend-dot"></i>Días anteriores</span></div></div>' +
      '<div class="panel"><div class="panel-heading"><div><div class="panel-title">Productos con existencia baja</div><div class="panel-subtitle">' + alerts.length + ' productos requieren atención</div></div></div><div class="alert-list">' + alertRows + '</div><div class="panel-footer"><button class="text-link" data-go="inventory">Ver inventario →</button></div></div></section>' +
      '<section class="lower-grid"><div class="panel"><div class="panel-heading"><div><div class="panel-title">Ventas recientes</div><div class="panel-subtitle">Últimas transacciones de la tienda</div></div><button class="text-link" data-go="reports">Ver reportes →</button></div><div class="table-wrap"><table><thead><tr><th>Ticket</th><th>Hora</th><th>Artículos</th><th>Pago</th><th>Total</th></tr></thead><tbody>' + recentRows + '</tbody></table></div></div>' +
      '<div class="panel"><div class="panel-heading"><div><div class="panel-title">Acceso rápido</div><div class="panel-subtitle">Tareas frecuentes</div></div></div><div class="alert-list"><div class="alert-row"><span class="product-thumb">▣</span><div><div class="alert-name">Registrar una venta</div><div class="alert-category">Cobrar y emitir ticket</div></div><button class="text-link" data-go="pos">Abrir →</button></div><div class="alert-row"><span class="product-thumb">＋</span><div><div class="alert-name">Agregar producto</div><div class="alert-category">Ampliar el catálogo</div></div><button class="text-link" data-action="add-product">Agregar →</button></div></div></div></section>';
  };

  app.renderInventory = function () {
    var state = app.state;
    var query = app.normalizeSearch(app.searchTerm);
    var products = state.products.filter(function (product) {
      return app.inventoryType(product) === "sale" &&
        app.normalizeSearch(product.name).indexOf(query) !== -1;
    });
    var rows = products.length ? products.map(function (product) {
      var stockRisk = app.stockRisk(product);
      var unit = product.unit || "Unidad";
      var unitLabel = unit.trim().toLocaleLowerCase() === "unidad" ? "" : "Unidad";
      return '<tr><td data-label="Descripción"><div class="inventory-description">' +
        app.esc(product.name) + '</div><div class="table-product-meta">' + app.esc(product.category) +
        '</div></td><td data-label="Riesgo de agotarse"><div class="stock-risk ' + stockRisk.tone +
        '" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + stockRisk.percent +
        '" aria-valuetext="' + stockRisk.percent + '% de riesgo; ' + stockRisk.label + '">' +
        '<span class="stock-risk-track" aria-hidden="true"><span style="width:' + stockRisk.percent + '%"></span></span>' +
        '<strong>' + stockRisk.percent + '%</strong><small>' + stockRisk.label + '</small></div></td>' +
        '<td data-label="N.º de contenedor">' + app.esc(product.container || "—") + '</td><td data-label="' + unitLabel + '">' + app.esc(unit) +
        '</td><td data-label="Cantidad"><div class="inventory-quantity">' + product.stock +
        '</div></td><td data-label="Costo y precio"><div class="inventory-finances"><div><span>Costo</span>' +
        app.moneyPair(product.cost) + '</div><div><span>Venta</span>' + app.moneyPair(product.price) +
        '</div></div></td><td data-label="Acciones"><div class="inventory-actions"><button class="button small" data-action="stock" data-id="' + app.esc(product.id) +
        '">＋ Entrada</button><button class="button small danger" data-action="delete-product" data-id="' +
        app.esc(product.id) + '" aria-label="Eliminar ' + app.esc(product.name) + '">Eliminar</button></div></td></tr>';
    }).join("") : '<tr><td colspan="7" class="empty">' +
      (query ? "No encontramos productos con ese nombre. Prueba otra búsqueda." :
        "Todavía no hay productos en el inventario.") + '</td></tr>';

    var sectionProducts = state.products.filter(function (product) {
      return app.inventoryType(product) === "sale";
    });
    var containerIds = {};
    sectionProducts.forEach(function (product) {
      var container = String(product.container || "").trim();
      if (container) containerIds[container.toLowerCase()] = true;
    });
    var inventoryValue = sectionProducts.reduce(function (sum, product) {
      return sum + (Number(product.cost) || 0) * (Number(product.stock) || 0);
    }, 0);
    return '<div class="page-heading inventory-heading"><div><h1>Lista de inventario de almacén</h1><p class="subtitle">Consulta el estado y las cantidades disponibles de tus productos.</p></div><div class="inventory-tools"><button class="button" data-action="inventory-selection">☷ Lista de selección de inventario</button><button class="button" data-action="container-search">⌕ Búsqueda de contenedores</button><button class="button primary" data-action="add-product">＋ Nuevo producto</button></div></div>' +
      '<section class="inventory-overview" aria-label="Resumen del inventario"><div class="inventory-total"><span>Valor total del inventario</span><strong>' +
      app.moneyPair(inventoryValue) + '</strong></div><div><span>Artículos del inventario</span><strong>' + sectionProducts.length +
      '</strong></div><div><span>Número de contenedores</span><strong>' + Object.keys(containerIds).length + '</strong></div></section>' +
      '<div class="page-grid"><section class="panel inventory-board"><div class="panel-heading"><div><div class="panel-title">' +
      'Productos para vender</div><div class="panel-subtitle">' +
      products.length + ' de ' + sectionProducts.length + ' artículos</div></div><div class="toolbar"><input class="search" id="inventory-search" placeholder="⌕  Buscar por nombre del producto..." value="' +
      app.esc(app.searchTerm) + '" aria-label="Buscar por nombre del producto"><button class="button small" data-action="export">Exportar CSV</button></div></div>' +
      '<div class="table-wrap inventory-table-wrap"><table class="inventory-table"><colgroup><col class="inventory-col-description"><col class="inventory-col-risk"><col class="inventory-col-container"><col class="inventory-col-unit"><col class="inventory-col-quantity"><col class="inventory-col-finance"><col class="inventory-col-actions"></colgroup><thead><tr><th>Descripción</th><th>Riesgo de agotarse</th><th>N.º de contenedor</th><th>Unidad</th><th>Cantidad</th><th>Costo / precio</th><th>Acciones</th></tr></thead><tbody>' +
      rows + '</tbody></table></div></section></div>';
  };

  app.renderPos = function () {
    var state = app.state;
    var query = app.normalizeSearch(app.searchTerm);
    var products = state.products.filter(function (product) {
      return app.inventoryType(product) === "sale" &&
        app.normalizeSearch(product.name + " " + product.barcode + " " + product.category).indexOf(query) !== -1;
    });
    var cards = products.map(function (product) {
      return '<button class="pos-product" data-action="add-cart" data-id="' + app.esc(product.id) + '" ' +
        (product.stock <= 0 ? "disabled" : "") + '><div class="pos-emoji">' + app.esc(product.emoji || "📦") +
        '</div><span class="pos-product-name">' + app.esc(product.name) + '</span><span class="pos-product-price">' +
        app.moneyPair(product.price) + '</span><span class="pos-product-stock">' +
        (product.stock > 0 ? product.stock + " disponibles" : "Agotado") + '</span></button>';
    }).join("");
    var cartRows = app.cart.length ? app.cart.map(function (item) {
      var product = state.products.find(function (p) { return p.id === item.id; });
      if (!product) return "";
      return '<div class="cart-row"><span class="product-thumb small">' + app.esc(product.emoji || "📦") +
        '</span><div class="cart-info"><div class="cart-name">' + app.esc(product.name) +
        '</div><div class="cart-price">' + app.moneyPair(product.price) +
        ' c/u</div></div><div class="qty-control"><button data-action="qty" data-id="' + app.esc(product.id) +
        '" data-delta="-1" aria-label="Quitar una unidad">−</button><span>' + item.quantity +
        '</span><button data-action="qty" data-id="' + app.esc(product.id) +
        '" data-delta="1" aria-label="Agregar una unidad">+</button></div></div>';
    }).join("") : '<div class="empty">Escanea un código o selecciona un producto para iniciar.</div>';

    var quantity = app.cart.reduce(function (sum, item) { return sum + item.quantity; }, 0);
    var total = app.cart.reduce(function (sum, item) {
      var product = state.products.find(function (p) { return p.id === item.id; });
      return sum + (product ? product.price * item.quantity : 0);
    }, 0);
    var paymentMethod = app.paymentMethod || "Efectivo";
    var cashReceived = app.cashReceived !== "" ? app.cashReceived : (total ? Number(total).toFixed(2) : "");
    var cashReceivedUsd = cashReceived !== "" ? app.formatUsdInput(Number(cashReceived)) : "";

    return app.pageHeading("Punto de venta", "Escanea el código de barras o busca el producto para agregarlo.", "") +
      '<div class="pos-layout"><section class="panel"><div class="panel-heading"><div><div class="panel-title">Productos</div><div class="panel-subtitle">Selecciona un producto para agregarlo a la venta</div></div></div>' +
      '<input class="search pos-search" id="pos-search" placeholder="⌕  Buscar o escanear código de barras..." value="' +
      app.esc(app.searchTerm) + '" aria-label="Buscar o escanear producto"><div class="pos-products">' +
      (cards || (query
        ? '<div class="empty">No encontramos productos con ese nombre o código. Revisa la búsqueda.</div>'
        : '<div class="empty">Todavía no hay productos para vender. <button class="text-link" data-page="inventory">Abrir inventario →</button></div>')) +
      '</div></section><section class="panel cart-panel"><div class="panel-heading"><div><div class="panel-title">Venta actual</div><div class="panel-subtitle">' +
      quantity + ' artículos</div></div><button class="text-link" data-action="clear-cart">Vaciar</button></div><div class="cart-items">' +
      cartRows + '</div><div class="cart-summary"><div class="summary-line"><span>Subtotal</span><span>' +
      app.moneyPair(total) + '</span></div><div class="summary-line"><span>Descuento</span><span>' +
      app.moneyPair(0) + '</span></div><div class="summary-line total"><span>Total a pagar</span><span>' +
      app.moneyPair(total) + '</span></div></div><form class="payment-form" id="checkout-form">' +
      '<div class="field"><label for="payment-method">Método de pago</label><select id="payment-method" name="method"><option' +
      (paymentMethod === "Efectivo" ? " selected" : "") + '>Efectivo</option><option' +
      (paymentMethod === "Tarjeta de crédito/débito" ? " selected" : "") + '>Tarjeta de crédito/débito</option><option' +
      (paymentMethod === "Transferencia" ? " selected" : "") + '>Transferencia</option><option' +
      (paymentMethod === "Billetera digital / Pago móvil" ? " selected" : "") + '>Billetera digital / Pago móvil</option></select></div>' +
      '<div class="currency-input-group cash-currency-group" id="cash-field" data-currency-group><div class="field"><label for="cash-received">Efectivo recibido (Bs.S)</label><input id="cash-received" name="cash" data-currency-kind="bs" type="number" step="0.01" min="0" placeholder="' +
      Number(total).toFixed(2) + '" value="' + app.esc(cashReceived) +
      '"></div><div class="field"><label for="cash-received-usd">Equivalente (USD)</label><input id="cash-received-usd" data-currency-kind="usd" type="number" step="0.01" min="0" value="' +
      app.esc(cashReceivedUsd) + '"></div><p class="currency-rate-note">Tasa: 1 USD = ' + app.exchangeRate() +
      ' Bs.</p></div><div class="change" id="change-due"></div><button class="button primary" type="submit" ' +
      (!app.cart.length ? "disabled" : "") + '>Cobrar ' + app.esc(app.money(total)) +
      ' <small class="button-usd" data-bs-value="' + total + '">(' + app.esc(app.moneyUsd(total)) + ')</small> →</button></form></section></div>';
  };

  app.filteredSales = function (period) {
    var dateParts = (app.reportDate || "").split("-").map(Number);
    var base = dateParts.length === 3 && dateParts.every(Number.isInteger)
      ? new Date(dateParts[0], dateParts[1] - 1, dateParts[2])
      : new Date();
    if (dateParts.length !== 3 || !dateParts.every(Number.isInteger) ||
      base.getFullYear() !== dateParts[0] || base.getMonth() !== dateParts[1] - 1 ||
      base.getDate() !== dateParts[2]) base = new Date();
    base.setHours(0, 0, 0, 0);

    var start = new Date(base);
    var end = new Date(base);
    end.setHours(23, 59, 59, 999);

    if (period === "Semana") start.setDate(start.getDate() - 6);
    if (period === "Mes") start = new Date(base.getFullYear(), base.getMonth(), 1);
    if (period === "Mes") end = new Date(base.getFullYear(), base.getMonth() + 1, 0, 23, 59, 59, 999);
    if (period === "Hoy") start = new Date(base);

    return app.state.sales.filter(function (sale) {
      var saleDate = new Date(sale.createdAt);
      return !sale.voided && saleDate >= start && saleDate <= end;
    });
  };

  app.renderReports = function () {
    var sales = app.filteredSales(app.reportPeriod);
    var revenue = app.sumSales(sales);
    var profit = sales.reduce(function (sum, sale) { return sum + sale.profit; }, 0);
    var units = {};

    sales.forEach(function (sale) {
      sale.items.forEach(function (item) {
        if (!units[item.name]) units[item.name] = { quantity: 0, revenue: 0 };
        units[item.name].quantity += item.quantity;
        units[item.name].revenue += item.quantity * item.price;
      });
    });

    var products = Object.keys(units).sort(function (a, b) { return units[b].quantity - units[a].quantity; });
    var rows = products.length ? products.slice(0, 8).map(function (name) {
      return '<tr><td>' + app.esc(name) + '</td><td>' + units[name].quantity +
        ' uds.</td><td class="price">' + app.moneyPair(units[name].revenue) + '</td></tr>';
    }).join("") : '<tr><td colspan="3" class="empty">Aún no hay ventas en este periodo.</td></tr>';
    var transactionRows = sales.slice().sort(function (a, b) {
      return new Date(b.createdAt) - new Date(a.createdAt);
    }).slice(0, 10).map(function (sale) {
      return '<tr><td>#' + app.esc(sale.receipt) + '</td><td>' + app.esc(app.dateLabel(sale.createdAt)) +
        '</td><td>' + app.esc(sale.method) + '</td><td>' +
        sale.items.reduce(function (n, item) { return n + item.quantity; }, 0) +
        '</td><td class="price">' + app.moneyPair(sale.total) +
        '</td><td class="price">' + app.moneyPair(sale.profit) + '</td></tr>';
    }).join("");

    var dateInputValue = app.reportDate || "";
    return app.pageHeading("Reportes", "Consulta ventas, costos y ganancias de tu negocio.", "") +
      '<div class="report-filter-row"><div class="period-tabs report-period-tabs"><button data-period="Hoy" class="' +
      (app.reportPeriod === "Hoy" ? "active" : "") + '">Hoy</button><button data-period="Semana" class="' +
      (app.reportPeriod === "Semana" ? "active" : "") + '">7 días</button><button data-period="Mes" class="' +
      (app.reportPeriod === "Mes" ? "active" : "") + '">Este mes</button></div>' +
      '<label class="report-date-filter"><span>Fecha</span><input id="report-date" type="date" required value="' + app.esc(dateInputValue) + '" aria-label="Seleccionar fecha"></label></div><section class="report-cards">' +
      app.statCard("Ingresos", app.moneyPair(revenue), sales.length + " ventas completadas", "↗", "blue", false) +
      app.statCard("Costo de mercancía", app.moneyPair(revenue - profit), "Costo histórico de los productos vendidos", "◈", "gold", false) +
      app.statCard("Ganancia bruta", app.moneyPair(profit), "Ingresos menos costo de mercancía", "✦", "", true) +
      '</section><section class="lower-grid reports-detail"><div class="panel"><div class="panel-heading"><div><div class="panel-title">Detalle de ventas</div><div class="panel-subtitle">Transacciones del periodo seleccionado</div></div></div><div class="table-wrap"><table><thead><tr><th>Ticket</th><th>Fecha</th><th>Pago</th><th>Artículos</th><th>Venta</th><th>Ganancia</th></tr></thead><tbody>' +
      (transactionRows || '<tr><td colspan="6" class="empty">No hay ventas en este periodo.</td></tr>') +
      '</tbody></table></div></div><div class="panel"><div class="panel-heading"><div><div class="panel-title">Productos más vendidos</div><div class="panel-subtitle">Ordenados por unidades vendidas</div></div></div><div class="table-wrap"><table><thead><tr><th>Producto</th><th>Unidades</th><th>Ingresos</th></tr></thead><tbody>' +
      rows + '</tbody></table></div><div class="panel-footer"><span class="muted helper-note">Los productos sin ventas en el periodo no aparecen en este ranking.</span></div></div></section>';
  };
})(window.MercadoApp = window.MercadoApp || {});
