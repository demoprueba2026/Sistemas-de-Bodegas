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
      return '<div class="alert-row"><span class="product-thumb">' + app.esc(product.emoji || "📦") + '</span><div><div class="alert-name">' + app.esc(product.name) + '</div><div class="alert-category">' + app.esc(product.category) + '</div></div><span class="stock-pill">' + product.stock + ' / mín. ' + product.min + '</span></div>';
    }).join("") : '<div class="empty">Todo en orden. No hay productos bajo el mínimo.</div>';

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
      '<div class="panel"><div class="panel-heading"><div><div class="panel-title">Por reabastecer</div><div class="panel-subtitle">' + alerts.length + ' productos necesitan atención</div></div></div><div class="alert-list">' + alertRows + '</div><div class="panel-footer"><button class="text-link" data-go="inventory">Ver inventario y sugerencias →</button></div></div></section>' +
      '<section class="lower-grid"><div class="panel"><div class="panel-heading"><div><div class="panel-title">Ventas recientes</div><div class="panel-subtitle">Últimas transacciones de la tienda</div></div><button class="text-link" data-go="reports">Ver reportes →</button></div><div class="table-wrap"><table><thead><tr><th>Ticket</th><th>Hora</th><th>Artículos</th><th>Pago</th><th>Total</th></tr></thead><tbody>' + recentRows + '</tbody></table></div></div>' +
      '<div class="panel"><div class="panel-heading"><div><div class="panel-title">Acceso rápido</div><div class="panel-subtitle">Tareas frecuentes</div></div></div><div class="alert-list"><div class="alert-row"><span class="product-thumb">▣</span><div><div class="alert-name">Registrar una venta</div><div class="alert-category">Cobrar y emitir ticket</div></div><button class="text-link" data-go="pos">Abrir →</button></div><div class="alert-row"><span class="product-thumb">＋</span><div><div class="alert-name">Agregar producto</div><div class="alert-category">Ampliar el catálogo</div></div><button class="text-link" data-action="add-product">Agregar →</button></div></div></div></section>';
  };

  app.renderInventory = function () {
    var state = app.state;
    var query = app.searchTerm.toLowerCase();
    var inventorySection = app.inventorySection === "ingredient" ? "ingredient" : "sale";
    var products = state.products.filter(function (product) {
      return app.inventoryType(product) === inventorySection &&
        (product.name + " " + product.barcode + " " + product.category).toLowerCase().indexOf(query) !== -1;
    });
    var rows = products.length ? products.map(function (product) {
      return '<tr><td>' + app.productCell(product) + '</td><td>' + app.esc(product.category) +
        '</td><td class="price">' + app.moneyPair(product.cost) + '</td><td class="price">' +
        app.moneyPair(product.price) + '</td><td>' + product.stock + ' <span class="muted">/ mín. ' +
        product.min + '</span></td><td>' + app.stateTag(product) +
        '</td><td><button class="button small" data-action="stock" data-id="' + app.esc(product.id) + '">＋ Entrada</button></td></tr>';
    }).join("") : '<tr><td colspan="7" class="empty">No se encontraron productos.</td></tr>';

    var saleCount = state.products.filter(function (product) { return app.inventoryType(product) === "sale"; }).length;
    var ingredientCount = state.products.length - saleCount;
    var alerts = app.stockAlerts().filter(function (product) {
      return app.inventoryType(product) === inventorySection;
    });
    var alertContent = alerts.length ? alerts.map(function (product) {
      var suggested = Math.max(product.min * 2 - product.stock, 0);
      return '<div class="alert-row"><span class="product-thumb">' + app.esc(product.emoji || "📦") +
        '</span><div><div class="alert-name">' + app.esc(product.name) + '</div><div class="alert-category">Actual: ' +
        product.stock + ' · Mínimo: ' + product.min + ' · Sugerido: ' + suggested +
        ' uds.</div></div><button class="button small" data-action="stock" data-id="' + app.esc(product.id) + '">Reponer</button></div>';
    }).join("") : '<div class="empty">No hay productos por reabastecer.</div>';

    return app.pageHeading("Inventario", "Controla por separado los productos listos para vender y los insumos de preparación.", '<button class="button primary" data-action="add-product">＋ Nuevo producto</button>') +
      '<div class="period-tabs inventory-section-tabs" role="tablist" aria-label="Secciones del inventario"><button type="button" role="tab" aria-selected="' +
      (inventorySection === "sale" ? "true" : "false") + '" data-inventory-section="sale" class="' + (inventorySection === "sale" ? "active" : "") +
      '">Productos para vender (' + saleCount + ')</button><button type="button" role="tab" aria-selected="' +
      (inventorySection === "ingredient" ? "true" : "false") + '" data-inventory-section="ingredient" class="' + (inventorySection === "ingredient" ? "active" : "") +
      '">Insumos para comidas (' + ingredientCount + ')</button></div><p class="subtitle inventory-help">Las comidas ya preparadas, como empanadas, van en “Productos para vender”. Los ingredientes y materiales van en “Insumos para comidas”.</p>' +
      '<div class="page-grid"><section class="panel"><div class="panel-heading"><div><div class="panel-title">' +
      (inventorySection === "sale" ? "Productos para vender" : "Insumos para comidas") + '</div><div class="panel-subtitle">' +
      products.length + ' registros en esta sección</div></div><div class="toolbar"><input class="search" id="inventory-search" placeholder="⌕  Buscar nombre, categoría o código..." value="' +
      app.esc(app.searchTerm) + '" aria-label="Buscar productos"><button class="button small" data-action="export">Exportar CSV</button></div></div>' +
      '<div class="table-wrap"><table class="inventory-table"><thead><tr><th>Producto</th><th>Categoría</th><th>Costo (Bs.S / USD)</th><th>Precio (Bs.S / USD)</th><th>Existencia</th><th>Estado</th><th>Acción</th></tr></thead><tbody>' +
      rows + '</tbody></table></div></section><section class="panel"><div class="panel-heading"><div><div class="panel-title">Sugerencias de reabastecimiento</div><div class="panel-subtitle">Estimación para llevar cada producto al doble del mínimo</div></div><span class="status low">' +
      alerts.length + ' alertas</span></div><div class="alert-list">' + alertContent + '</div></section></div>';
  };

  app.renderPos = function () {
    var state = app.state;
    var query = app.searchTerm.toLowerCase();
    var products = state.products.filter(function (product) {
      return app.inventoryType(product) === "sale" &&
        (product.name + " " + product.barcode + " " + product.category).toLowerCase().indexOf(query) !== -1;
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

    return app.pageHeading("Punto de venta", "Escanea el código de barras o busca el producto para agregarlo.", "") +
      '<div class="pos-layout"><section class="panel"><div class="panel-heading"><div><div class="panel-title">Productos</div><div class="panel-subtitle">Selecciona un producto para agregarlo a la venta</div></div></div>' +
      '<input class="search pos-search" id="pos-search" placeholder="⌕  Buscar o escanear código de barras..." value="' +
      app.esc(app.searchTerm) + '" aria-label="Buscar o escanear producto"><div class="pos-products">' +
      (cards || '<div class="empty">No se encontraron productos.</div>') +
      '</div></section><section class="panel cart-panel"><div class="panel-heading"><div><div class="panel-title">Venta actual</div><div class="panel-subtitle">' +
      quantity + ' artículos</div></div><button class="text-link" data-action="clear-cart">Vaciar</button></div><div class="cart-items">' +
      cartRows + '</div><div class="cart-summary"><div class="summary-line"><span>Subtotal</span><span>' +
      app.moneyPair(total) + '</span></div><div class="summary-line"><span>Descuento</span><span>' +
      app.moneyPair(0) + '</span></div><div class="summary-line total"><span>Total a pagar</span><span>' +
      app.moneyPair(total) + '</span></div></div><form class="payment-form" id="checkout-form">' +
      '<div class="field"><label for="payment-method">Método de pago</label><select id="payment-method" name="method"><option>Efectivo</option><option>Tarjeta de crédito/débito</option><option>Transferencia</option><option>Billetera digital / Pago móvil</option></select></div>' +
      '<div class="currency-input-group cash-currency-group" id="cash-field" data-currency-group><div class="field"><label for="cash-received">Efectivo recibido (Bs.S)</label><input id="cash-received" name="cash" data-currency-kind="bs" type="number" step="0.01" min="0" placeholder="' +
      Number(total).toFixed(2) + '" value="' + (total ? Number(total).toFixed(2) : "") +
      '"></div><div class="field"><label for="cash-received-usd">Equivalente (USD)</label><input id="cash-received-usd" data-currency-kind="usd" type="number" step="0.01" min="0" value="' +
      (total ? app.formatUsdInput(total) : "") + '"></div><p class="currency-rate-note">Tasa: 1 USD = ' + app.exchangeRate() +
      ' Bs.</p></div><div class="change" id="change-due"></div><button class="button primary" type="submit" ' +
      (!app.cart.length ? "disabled" : "") + '>Cobrar ' + app.esc(app.money(total)) +
      ' <small class="button-usd">(' + app.esc(app.moneyUsd(total)) + ')</small> →</button></form></section></div>';
  };

  app.filteredSales = function (period) {
    var start = new Date();
    start.setHours(0, 0, 0, 0);
    if (period === "Semana") start.setDate(start.getDate() - 6);
    if (period === "Mes") start.setDate(1);
    return app.state.sales.filter(function (sale) { return !sale.voided && new Date(sale.createdAt) >= start; });
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

    return app.pageHeading("Reportes", "Consulta ventas, costos y ganancias de tu negocio.", "") +
      '<div class="period-tabs report-period-tabs"><button data-period="Hoy" class="' +
      (app.reportPeriod === "Hoy" ? "active" : "") + '">Hoy</button><button data-period="Semana" class="' +
      (app.reportPeriod === "Semana" ? "active" : "") + '">7 días</button><button data-period="Mes" class="' +
      (app.reportPeriod === "Mes" ? "active" : "") + '">Este mes</button></div><section class="report-cards">' +
      app.statCard("Ingresos", app.moneyPair(revenue), sales.length + " ventas completadas", "↗", "blue", false) +
      app.statCard("Costo de mercancía", app.moneyPair(revenue - profit), "Costo histórico de los productos vendidos", "◈", "gold", false) +
      app.statCard("Ganancia bruta", app.moneyPair(profit), "Ingresos menos costo de mercancía", "✦", "", true) +
      '</section><section class="lower-grid reports-detail"><div class="panel"><div class="panel-heading"><div><div class="panel-title">Detalle de ventas</div><div class="panel-subtitle">Transacciones del periodo seleccionado</div></div></div><div class="table-wrap"><table><thead><tr><th>Ticket</th><th>Fecha</th><th>Pago</th><th>Artículos</th><th>Venta</th><th>Ganancia</th></tr></thead><tbody>' +
      (transactionRows || '<tr><td colspan="6" class="empty">No hay ventas en este periodo.</td></tr>') +
      '</tbody></table></div></div><div class="panel"><div class="panel-heading"><div><div class="panel-title">Productos más vendidos</div><div class="panel-subtitle">Ordenados por unidades vendidas</div></div></div><div class="table-wrap"><table><thead><tr><th>Producto</th><th>Unidades</th><th>Ingresos</th></tr></thead><tbody>' +
      rows + '</tbody></table></div><div class="panel-footer"><span class="muted helper-note">Los productos sin ventas en el periodo no aparecen en este ranking.</span></div></div></section>';
  };
})(window.MercadoApp = window.MercadoApp || {});
