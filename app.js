
    (function () {
      "use strict";
      var STORE_KEY = "mercado-admin-v1";
      var page = "dashboard";
      var searchTerm = "";
      var cart = [];
      var reportPeriod = "Hoy";
      var toastTimer;
      var THEME_KEY = "mercado-theme";
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
      var state = loadState();

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

      function saveState() {
        try {
          localStorage.setItem(STORE_KEY, JSON.stringify(state));
        } catch (error) {
          console.error("No se pudieron guardar los datos locales:", error);
          notify("No se pudieron guardar los cambios en este navegador.");
        }
      }

      function esc(value) {
        return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
          return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
        });
      }
      function money(value) {
        return new Intl.NumberFormat("es-VE", { style: "currency", currency: "VES" }).format(Number(value) || 0);
      }
      function applyTheme(theme) {
        var activeTheme = theme === "dark" ? "dark" : "light";
        document.documentElement.dataset.theme = activeTheme;
        var button = document.getElementById("theme-toggle");
        button.textContent = activeTheme === "dark" ? "☀" : "☾";
        button.setAttribute("aria-label", activeTheme === "dark" ? "Activar modo claro" : "Activar modo oscuro");
        button.setAttribute("aria-pressed", activeTheme === "dark" ? "true" : "false");
        button.title = activeTheme === "dark" ? "Activar modo claro" : "Activar modo oscuro";
        document.querySelector('meta[name="theme-color"]').setAttribute("content", activeTheme === "dark" ? "#111915" : "#f5f7f5");
      }
      function loadTheme() {
        var savedTheme = "light";
        try {
          var storedTheme = localStorage.getItem(THEME_KEY);
          if (storedTheme === "dark" || storedTheme === "light") savedTheme = storedTheme;
        } catch (error) {
          console.error("No se pudo leer la preferencia del tema:", error);
        }
        applyTheme(savedTheme);
      }
      function dateLabel(date) {
        return new Intl.DateTimeFormat("es-VE", { day: "2-digit", month: "short" }).format(new Date(date));
      }
      function todayStart() {
        var date = new Date();
        date.setHours(0, 0, 0, 0);
        return date.getTime();
      }
      function todaySales() {
        return state.sales.filter(function (sale) { return !sale.voided && new Date(sale.createdAt).getTime() >= todayStart(); });
      }
      function sumSales(sales) {
        return sales.reduce(function (sum, sale) { return sum + sale.total; }, 0);
      }
      function stockAlerts() {
        return state.products.filter(function (product) { return product.stock <= product.min; });
      }
      function notify(message) {
        var toast = document.getElementById("toast");
        toast.textContent = message;
        toast.classList.add("show");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { toast.classList.remove("show"); }, 2600);
      }
      function setPage(nextPage) {
        page = nextPage;
        searchTerm = "";
        document.querySelectorAll(".nav button").forEach(function (button) {
          button.classList.toggle("active", button.dataset.page === page);
        });
        document.getElementById("sidebar").classList.remove("open");
        render();
      }
      function pageHeading(title, subtitle, action) {
        return '<div class="page-heading"><div><h1>' + title + '</h1><p class="subtitle">' + subtitle + '</p></div>' + (action || "") + '</div>';
      }
      function statCard(label, value, note, icon, iconClass, positive) {
        return '<div class="stat-card"><div class="stat-top"><span>' + label + '</span><span class="stat-icon ' + (iconClass || "") + '">' + icon + '</span></div><div class="stat-value">' + value + '</div><div class="stat-note ' + (positive ? "positive" : "") + '">' + note + '</div></div>';
      }
      function stateTag(product) {
        if (product.stock <= 0) return '<span class="status out">Agotado</span>';
        if (product.stock <= product.min) return '<span class="status low">Stock bajo</span>';
        return '<span class="status">Disponible</span>';
      }
      function productCell(product) {
        return '<div class="table-product"><span class="product-thumb small">' + esc(product.emoji || "📦") + '</span><div><div class="table-product-name">' + esc(product.name) + '</div><div class="table-product-meta">' + esc(product.barcode) + '</div></div></div>';
      }
      function renderDashboard() {
        var sales = todaySales();
        var revenue = sumSales(sales);
        var profit = sales.reduce(function (sum, sale) { return sum + sale.profit; }, 0);
        var alerts = stockAlerts();
        var sold = state.products.reduce(function (sum, product) { return sum + product.stock; }, 0);
        var chartDays = [];
        for (var i = 6; i >= 0; i--) {
          var day = new Date(); day.setDate(day.getDate() - i); day.setHours(0,0,0,0);
          var end = day.getTime() + 86400000;
          var amount = state.sales.filter(function (sale) { var time = new Date(sale.createdAt).getTime(); return !sale.voided && time >= day.getTime() && time < end; }).reduce(function (sum, sale) { return sum + sale.total; }, 0);
          chartDays.push({ date: day, amount: amount });
        }
        var max = Math.max.apply(null, chartDays.map(function (item) { return item.amount; }).concat([1]));
        var bars = chartDays.map(function (item, index) {
          var height = item.amount > 0 ? Math.max(4, item.amount / max * 92) : 3;
          var dayName = new Intl.DateTimeFormat("es-VE", { weekday: "short" }).format(item.date).replace(".", "");
          return '<div class="bar-group"><div class="bar ' + (index === 6 ? "current" : "") + '" style="height:' + height + '%" title="' + esc(money(item.amount)) + '"></div><span class="bar-label">' + esc(dayName) + '</span></div>';
        }).join("");
        var alertRows = alerts.length ? alerts.slice(0, 5).map(function (product) {
          return '<div class="alert-row"><span class="product-thumb">' + esc(product.emoji || "📦") + '</span><div><div class="alert-name">' + esc(product.name) + '</div><div class="alert-category">' + esc(product.category) + '</div></div><span class="stock-pill">' + product.stock + ' / mín. ' + product.min + '</span></div>';
        }).join("") : '<div class="empty">Todo en orden. No hay productos bajo el mínimo.</div>';
        var recent = state.sales.filter(function (sale) { return !sale.voided; }).slice().sort(function (a,b) { return new Date(b.createdAt) - new Date(a.createdAt); }).slice(0, 5);
        var recentRows = recent.length ? recent.map(function (sale) {
          return '<tr><td>#' + esc(sale.receipt) + '</td><td>' + esc(new Intl.DateTimeFormat("es-VE", { hour: "2-digit", minute: "2-digit" }).format(new Date(sale.createdAt))) + '</td><td>' + esc(sale.items.reduce(function (n, item) { return n + item.quantity; }, 0)) + ' artículos</td><td>' + esc(sale.method) + '</td><td class="price">' + esc(money(sale.total)) + '</td></tr>';
        }).join("") : '<tr><td colspan="5" class="empty">Todavía no hay ventas. Registra la primera desde el punto de venta.</td></tr>';
        return pageHeading("Buenos días 👋", "Aquí tienes el resumen de tu tienda.", '<button class="button primary" data-go="pos">＋ Nueva venta</button>') +
          '<section class="stats">' +
            statCard("Ventas de hoy", money(revenue), sales.length + " transacciones", "↗", "", true) +
            statCard("Ganancia bruta", money(profit), "Según costo registrado al vender", "◈", "gold", true) +
            statCard("Productos en catálogo", state.products.length, "Unidades en inventario: " + sold, "▤", "blue", false) +
            statCard("Alertas de inventario", alerts.length, alerts.length ? "Requieren atención" : "Sin alertas pendientes", "⚑", "red", false) +
          '</section>' +
          '<section class="dashboard-grid"><div class="panel"><div class="panel-heading"><div><div class="panel-title">Ventas de la semana</div><div class="panel-subtitle">Ingresos registrados en los últimos 7 días</div></div><span class="status">Últimos 7 días</span></div><div class="chart-wrap"><div class="chart-y"><span>' + esc(money(max)) + '</span><span>' + esc(money(max / 2)) + '</span><span>' + esc(money(0)) + '</span></div><div class="chart-bars">' + bars + '</div></div><div class="chart-legend"><span><i class="legend-dot dark"></i>Hoy</span><span><i class="legend-dot"></i>Días anteriores</span></div></div>' +
          '<div class="panel"><div class="panel-heading"><div><div class="panel-title">Por reabastecer</div><div class="panel-subtitle">' + alerts.length + ' productos necesitan atención</div></div></div><div class="alert-list">' + alertRows + '</div><div class="panel-footer"><button class="text-link" data-go="inventory">Ver inventario y sugerencias →</button></div></div></section>' +
          '<section class="lower-grid"><div class="panel"><div class="panel-heading"><div><div class="panel-title">Ventas recientes</div><div class="panel-subtitle">Últimas transacciones de la tienda</div></div><button class="text-link" data-go="reports">Ver reportes →</button></div><div class="table-wrap"><table><thead><tr><th>Ticket</th><th>Hora</th><th>Artículos</th><th>Pago</th><th>Total</th></tr></thead><tbody>' + recentRows + '</tbody></table></div></div>' +
          '<div class="panel"><div class="panel-heading"><div><div class="panel-title">Acceso rápido</div><div class="panel-subtitle">Tareas frecuentes</div></div></div><div class="alert-list"><div class="alert-row"><span class="product-thumb">▣</span><div><div class="alert-name">Registrar una venta</div><div class="alert-category">Cobrar y emitir ticket</div></div><button class="text-link" data-go="pos">Abrir →</button></div><div class="alert-row"><span class="product-thumb">＋</span><div><div class="alert-name">Agregar producto</div><div class="alert-category">Ampliar el catálogo</div></div><button class="text-link" data-action="add-product">Agregar →</button></div></div></div></section>';
      }
      function renderInventory() {
        var query = searchTerm.toLowerCase();
        var products = state.products.filter(function (product) {
          return (product.name + " " + product.barcode + " " + product.category).toLowerCase().indexOf(query) !== -1;
        });
        var rows = products.length ? products.map(function (product) {
          return '<tr><td>' + productCell(product) + '</td><td>' + esc(product.category) + '</td><td class="price">' + esc(money(product.cost)) + '</td><td class="price">' + esc(money(product.price)) + '</td><td>' + product.stock + ' <span class="muted">/ mín. ' + product.min + '</span></td><td>' + stateTag(product) + '</td><td><button class="button small" data-action="stock" data-id="' + esc(product.id) + '">＋ Entrada</button></td></tr>';
        }).join("") : '<tr><td colspan="7" class="empty">No se encontraron productos.</td></tr>';
        var alerts = stockAlerts();
        var alertContent = alerts.length ? alerts.map(function (product) {
          var suggested = Math.max(product.min * 2 - product.stock, 0);
          return '<div class="alert-row"><span class="product-thumb">' + esc(product.emoji || "📦") + '</span><div><div class="alert-name">' + esc(product.name) + '</div><div class="alert-category">Actual: ' + product.stock + ' · Mínimo: ' + product.min + ' · Sugerido: ' + suggested + ' uds.</div></div><button class="button small" data-action="stock" data-id="' + esc(product.id) + '">Reponer</button></div>';
        }).join("") : '<div class="empty">No hay productos por reabastecer.</div>';
        return pageHeading("Inventario", "Controla existencias, costos y niveles de reabastecimiento.", '<button class="button primary" data-action="add-product">＋ Nuevo producto</button>') +
          '<div class="page-grid"><section class="panel"><div class="panel-heading"><div><div class="panel-title">Productos</div><div class="panel-subtitle">' + state.products.length + ' productos registrados</div></div><div class="toolbar"><input class="search" id="inventory-search" placeholder="⌕  Buscar nombre, categoría o código..." value="' + esc(searchTerm) + '" aria-label="Buscar productos"><button class="button small" data-action="export">Exportar CSV</button></div></div><div class="table-wrap"><table class="inventory-table"><thead><tr><th>Producto</th><th>Categoría</th><th>Costo (Bs.S)</th><th>Precio (Bs.S)</th><th>Existencia</th><th>Estado</th><th>Acción</th></tr></thead><tbody>' + rows + '</tbody></table></div></section>' +
          '<section class="panel"><div class="panel-heading"><div><div class="panel-title">Sugerencias de reabastecimiento</div><div class="panel-subtitle">Estimación para llevar cada producto al doble del mínimo</div></div><span class="status low">' + alerts.length + ' alertas</span></div><div class="alert-list">' + alertContent + '</div></section></div>';
      }
      function renderPos() {
        var query = searchTerm.toLowerCase();
        var products = state.products.filter(function (product) {
          return (product.name + " " + product.barcode + " " + product.category).toLowerCase().indexOf(query) !== -1;
        });
        var cards = products.map(function (product) {
          return '<button class="pos-product" data-action="add-cart" data-id="' + esc(product.id) + '" ' + (product.stock <= 0 ? "disabled" : "") + '><div class="pos-emoji">' + esc(product.emoji || "📦") + '</div><span class="pos-product-name">' + esc(product.name) + '</span><span class="pos-product-price">' + esc(money(product.price)) + '</span><span class="pos-product-stock">' + (product.stock > 0 ? product.stock + " disponibles" : "Agotado") + '</span></button>';
        }).join("");
        var cartRows = cart.length ? cart.map(function (item) {
          var product = state.products.find(function (p) { return p.id === item.id; });
          if (!product) return "";
          return '<div class="cart-row"><span class="product-thumb small">' + esc(product.emoji || "📦") + '</span><div class="cart-info"><div class="cart-name">' + esc(product.name) + '</div><div class="cart-price">' + esc(money(product.price)) + ' c/u</div></div><div class="qty-control"><button data-action="qty" data-id="' + esc(product.id) + '" data-delta="-1" aria-label="Quitar una unidad">−</button><span>' + item.quantity + '</span><button data-action="qty" data-id="' + esc(product.id) + '" data-delta="1" aria-label="Agregar una unidad">+</button></div></div>';
        }).join("") : '<div class="empty">Escanea un código o selecciona un producto para iniciar.</div>';
        var quantity = cart.reduce(function (sum, item) { return sum + item.quantity; }, 0);
        var total = cart.reduce(function (sum, item) { var product = state.products.find(function (p) { return p.id === item.id; }); return sum + (product ? product.price * item.quantity : 0); }, 0);
        return pageHeading("Punto de venta", "Escanea el código de barras o busca el producto para agregarlo.", "") +
          '<div class="pos-layout"><section class="panel"><div class="panel-heading"><div><div class="panel-title">Productos</div><div class="panel-subtitle">Selecciona un producto para agregarlo a la venta</div></div></div><input class="search pos-search" id="pos-search" placeholder="⌕  Buscar o escanear código de barras..." value="' + esc(searchTerm) + '" aria-label="Buscar o escanear producto"><div class="pos-products">' + (cards || '<div class="empty">No se encontraron productos.</div>') + '</div></section>' +
          '<section class="panel cart-panel"><div class="panel-heading"><div><div class="panel-title">Venta actual</div><div class="panel-subtitle">' + quantity + ' artículos</div></div><button class="text-link" data-action="clear-cart">Vaciar</button></div><div class="cart-items">' + cartRows + '</div><div class="cart-summary"><div class="summary-line"><span>Subtotal</span><span>' + esc(money(total)) + '</span></div><div class="summary-line"><span>Descuento</span><span>' + esc(money(0)) + '</span></div><div class="summary-line total"><span>Total a pagar</span><span>' + esc(money(total)) + '</span></div></div>' +
          '<form class="payment-form" id="checkout-form"><div class="field"><label for="payment-method">Método de pago</label><select id="payment-method" name="method"><option>Efectivo</option><option>Tarjeta de crédito/débito</option><option>Transferencia</option><option>Billetera digital / Pago móvil</option></select></div><div class="field" id="cash-field"><label for="cash-received">Efectivo recibido</label><input id="cash-received" name="cash" type="number" step="0.01" min="0" placeholder="' + Number(total).toFixed(2) + '" value="' + (total ? Number(total).toFixed(2) : "") + '"></div><div class="change" id="change-due"></div><button class="button primary" type="submit" ' + (!cart.length ? "disabled" : "") + '>Cobrar ' + esc(money(total)) + ' →</button></form></section></div>';
      }
      function filteredSales(period) {
        var now = new Date();
        var start = new Date(now); start.setHours(0,0,0,0);
        if (period === "Semana") start.setDate(start.getDate() - 6);
        if (period === "Mes") start.setDate(1);
        return state.sales.filter(function (sale) { return !sale.voided && new Date(sale.createdAt) >= start; });
      }
      function renderReports() {
        var sales = filteredSales(reportPeriod);
        var revenue = sumSales(sales);
        var profit = sales.reduce(function (sum, sale) { return sum + sale.profit; }, 0);
        var units = {};
        sales.forEach(function (sale) {
          sale.items.forEach(function (item) {
            if (!units[item.name]) units[item.name] = { quantity: 0, revenue: 0 };
            units[item.name].quantity += item.quantity;
            units[item.name].revenue += item.quantity * item.price;
          });
        });
        var products = Object.keys(units).sort(function (a,b) { return units[b].quantity - units[a].quantity; });
        var rows = products.length ? products.slice(0, 8).map(function (name) {
          return '<tr><td>' + esc(name) + '</td><td>' + units[name].quantity + ' uds.</td><td class="price">' + esc(money(units[name].revenue)) + '</td></tr>';
        }).join("") : '<tr><td colspan="3" class="empty">Aún no hay ventas en este periodo.</td></tr>';
        var transactionRows = sales.slice().sort(function (a,b) { return new Date(b.createdAt) - new Date(a.createdAt); }).slice(0, 10).map(function (sale) {
          return '<tr><td>#' + esc(sale.receipt) + '</td><td>' + esc(dateLabel(sale.createdAt)) + '</td><td>' + esc(sale.method) + '</td><td>' + sale.items.reduce(function (n, item) { return n + item.quantity; }, 0) + '</td><td class="price">' + esc(money(sale.total)) + '</td><td class="price">' + esc(money(sale.profit)) + '</td></tr>';
        }).join("");
        return pageHeading("Reportes", "Consulta ventas, costos y ganancias de tu negocio.", "") +
          '<div class="period-tabs report-period-tabs"><button data-period="Hoy" class="' + (reportPeriod === "Hoy" ? "active" : "") + '">Hoy</button><button data-period="Semana" class="' + (reportPeriod === "Semana" ? "active" : "") + '">7 días</button><button data-period="Mes" class="' + (reportPeriod === "Mes" ? "active" : "") + '">Este mes</button></div>' +
          '<section class="report-cards">' + statCard("Ingresos", money(revenue), sales.length + " ventas completadas", "↗", "blue", false) + statCard("Costo de mercancía", money(revenue - profit), "Costo histórico de los productos vendidos", "◈", "gold", false) + statCard("Ganancia bruta", money(profit), "Ingresos menos costo de mercancía", "✦", "", true) + '</section>' +
          '<section class="lower-grid reports-detail"><div class="panel"><div class="panel-heading"><div><div class="panel-title">Detalle de ventas</div><div class="panel-subtitle">Transacciones del periodo seleccionado</div></div></div><div class="table-wrap"><table><thead><tr><th>Ticket</th><th>Fecha</th><th>Pago</th><th>Artículos</th><th>Venta</th><th>Ganancia</th></tr></thead><tbody>' + (transactionRows || '<tr><td colspan="6" class="empty">No hay ventas en este periodo.</td></tr>') + '</tbody></table></div></div>' +
          '<div class="panel"><div class="panel-heading"><div><div class="panel-title">Productos más vendidos</div><div class="panel-subtitle">Ordenados por unidades vendidas</div></div></div><div class="table-wrap"><table><thead><tr><th>Producto</th><th>Unidades</th><th>Ingresos</th></tr></thead><tbody>' + rows + '</tbody></table></div><div class="panel-footer"><span class="muted helper-note">Los productos sin ventas en el periodo no aparecen en este ranking.</span></div></div></section>';
      }
      function render() {
        var names = { dashboard: "Resumen", pos: "Punto de venta", inventory: "Inventario", reports: "Reportes" };
        document.getElementById("breadcrumb").textContent = names[page];
        document.getElementById("nav-alert-count").textContent = stockAlerts().length;
        document.getElementById("today").textContent = new Intl.DateTimeFormat("es-VE", { weekday: "short", day: "numeric", month: "short" }).format(new Date());
        var content = document.getElementById("content");
        if (page === "dashboard") content.innerHTML = renderDashboard();
        else if (page === "inventory") content.innerHTML = renderInventory();
        else if (page === "pos") content.innerHTML = renderPos();
        else content.innerHTML = renderReports();
        if (page === "pos") updateChange();
      }
      function addToCart(id) {
        var product = state.products.find(function (item) { return item.id === id; });
        if (!product || product.stock <= 0) { notify("Este producto no tiene existencias."); return; }
        var item = cart.find(function (row) { return row.id === id; });
        if (item && item.quantity >= product.stock) { notify("No hay más unidades disponibles."); return; }
        if (item) item.quantity++;
        else cart.push({ id: id, quantity: 1 });
        render();
      }
      function changeQuantity(id, delta) {
        var product = state.products.find(function (item) { return item.id === id; });
        var item = cart.find(function (row) { return row.id === id; });
        if (!item || !product) return;
        if (delta > 0 && item.quantity >= product.stock) { notify("No hay más unidades disponibles."); return; }
        item.quantity += delta;
        if (item.quantity <= 0) cart = cart.filter(function (row) { return row.id !== id; });
        render();
      }
      function updateChange() {
        var form = document.getElementById("checkout-form");
        if (!form) return;
        var method = document.getElementById("payment-method").value;
        var cashField = document.getElementById("cash-field");
        cashField.style.display = method === "Efectivo" ? "grid" : "none";
        var total = cart.reduce(function (sum, item) { var product = state.products.find(function (p) { return p.id === item.id; }); return sum + (product ? product.price * item.quantity : 0); }, 0);
        var received = Number(document.getElementById("cash-received").value);
        var due = document.getElementById("change-due");
        if (method === "Efectivo" && received >= total && total > 0) due.textContent = "Cambio: " + money(received - total);
        else if (method === "Efectivo" && received > 0 && received < total) due.textContent = "Faltan: " + money(total - received);
        else due.textContent = "";
      }
      function checkout(event) {
        event.preventDefault();
        if (!cart.length) return;
        var method = document.getElementById("payment-method").value;
        var total = 0;
        var profit = 0;
        var items = [];
        for (var i = 0; i < cart.length; i++) {
          var product = state.products.find(function (p) { return p.id === cart[i].id; });
          if (!product || product.stock < cart[i].quantity) { notify("El inventario cambió. Revisa la venta antes de cobrar."); render(); return; }
          total += product.price * cart[i].quantity;
          profit += (product.price - product.cost) * cart[i].quantity;
          items.push({ productId: product.id, name: product.name, quantity: cart[i].quantity, price: product.price, cost: product.cost });
        }
        var cash = method === "Efectivo" ? Number(document.getElementById("cash-received").value) : total;
        if (!Number.isFinite(cash) || cash < total) { notify("El efectivo recibido no cubre el total."); return; }
        items.forEach(function (item) {
          var product = state.products.find(function (p) { return p.id === item.productId; });
          product.stock -= item.quantity;
          state.movements.unshift({ id: "m" + Date.now() + Math.random().toString(16).slice(2), productId: product.id, productName: product.name, type: "Salida por venta", quantity: -item.quantity, date: new Date().toISOString() });
        });
        var sale = { receipt: state.nextReceipt++, createdAt: new Date().toISOString(), total: total, profit: profit, method: method, cash: cash, change: cash - total, items: items };
        state.sales.push(sale);
        saveState();
        cart = [];
        render();
        showReceipt(sale);
      }
      function showReceipt(sale) {
        var itemRows = sale.items.map(function (item) {
          return '<div class="receipt-line"><span>' + esc(item.quantity + " × " + item.name) + '</span><span>' + esc(money(item.quantity * item.price)) + '</span></div>';
        }).join("");
        document.getElementById("modal-root").innerHTML = '<div class="modal-backdrop" id="receipt-backdrop"><div class="modal"><div class="modal-head"><h2>Venta completada</h2><button class="close-button" data-action="close-modal" aria-label="Cerrar">×</button></div><div class="receipt"><h3>MI MERCADO</h3><div class="receipt-center">Gracias por tu compra</div><hr><div>Ticket: #' + esc(sale.receipt) + '</div><div>' + esc(new Intl.DateTimeFormat("es-VE", { dateStyle: "short", timeStyle: "short" }).format(new Date(sale.createdAt))) + '</div><hr>' + itemRows + '<hr><div class="receipt-line"><strong>TOTAL</strong><strong>' + esc(money(sale.total)) + '</strong></div><div>Método de pago: ' + esc(sale.method) + '</div>' + (sale.method === "Efectivo" ? '<div>Efectivo: ' + esc(money(sale.cash)) + '</div><div>Cambio: ' + esc(money(sale.change)) + '</div>' : '') + '<hr><div class="receipt-center">¡Vuelve pronto!</div></div><div class="modal-actions"><button class="button" data-action="close-modal">Cerrar</button><button class="button primary" data-action="print-receipt">Imprimir ticket</button></div></div></div>';
      }
      function openProductModal() {
        document.getElementById("modal-root").innerHTML = '<div class="modal-backdrop" id="product-backdrop"><form class="modal" id="product-form"><div class="modal-head"><h2>Nuevo producto</h2><button type="button" class="close-button" data-action="close-modal" aria-label="Cerrar">×</button></div><div class="form-grid"><div class="field wide"><label for="prod-name">Nombre del producto *</label><input id="prod-name" name="name" required maxlength="80" placeholder="Ej. Leche entera 1 L"></div><div class="field"><label for="prod-barcode">Código de barras</label><input id="prod-barcode" name="barcode" maxlength="40" placeholder="Escanea o escribe"></div><div class="field"><label for="prod-category">Categoría</label><input id="prod-category" name="category" maxlength="40" placeholder="Abarrotes"></div><div class="field"><label for="prod-cost">Precio de compra (Bs.S) *</label><input id="prod-cost" name="cost" required type="number" min="0" step="0.01" value="0"></div><div class="field"><label for="prod-price">Precio de venta (Bs.S) *</label><input id="prod-price" name="price" required type="number" min="0" step="0.01" value="0"></div><div class="field"><label for="prod-stock">Existencia inicial</label><input id="prod-stock" name="stock" type="number" min="0" step="1" value="0"></div><div class="field"><label for="prod-min">Stock mínimo</label><input id="prod-min" name="min" type="number" min="0" step="1" value="5"></div></div><div class="modal-actions"><button type="button" class="button" data-action="close-modal">Cancelar</button><button type="submit" class="button primary">Guardar producto</button></div></form></div>';
        document.getElementById("prod-name").focus();
      }
      function openStockModal(id) {
        var product = state.products.find(function (p) { return p.id === id; });
        if (!product) return;
        document.getElementById("modal-root").innerHTML = '<div class="modal-backdrop"><form class="modal" id="stock-form" data-id="' + esc(id) + '"><div class="modal-head"><h2>Entrada de inventario</h2><button type="button" class="close-button" data-action="close-modal" aria-label="Cerrar">×</button></div><p class="subtitle modal-description">' + esc(product.name) + ' · Existencia actual: ' + product.stock + '</p><div class="field"><label for="stock-quantity">Cantidad recibida *</label><input id="stock-quantity" name="quantity" type="number" min="1" step="1" required placeholder="0"></div><div class="modal-actions"><button type="button" class="button" data-action="close-modal">Cancelar</button><button class="button primary" type="submit">Registrar entrada</button></div></form></div>';
        document.getElementById("stock-quantity").focus();
      }
      function saveProduct(event) {
        event.preventDefault();
        var form = event.target;
        var data = new FormData(form);
        var barcode = String(data.get("barcode") || "").trim();
        if (barcode && state.products.some(function (product) { return product.barcode === barcode; })) {
          notify("Ya existe un producto con ese código de barras.");
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
          notify("Revisa el nombre y los precios del producto.");
          return;
        }
        state.products.push(product);
        if (product.stock > 0) state.movements.unshift({ id: "m" + Date.now(), productId: product.id, productName: product.name, type: "Inventario inicial", quantity: product.stock, date: new Date().toISOString() });
        saveState();
        document.getElementById("modal-root").innerHTML = "";
        render();
        notify("Producto agregado al inventario.");
      }
      function saveStock(event) {
        event.preventDefault();
        var id = event.target.dataset.id;
        var quantity = Number(new FormData(event.target).get("quantity"));
        var product = state.products.find(function (p) { return p.id === id; });
        if (!product || !Number.isInteger(quantity) || quantity <= 0) { notify("Ingresa una cantidad válida."); return; }
        product.stock += quantity;
        state.movements.unshift({ id: "m" + Date.now(), productId: id, productName: product.name, type: "Entrada de mercancía", quantity: quantity, date: new Date().toISOString() });
        saveState();
        document.getElementById("modal-root").innerHTML = "";
        render();
        notify("Entrada registrada: +" + quantity + " unidades.");
      }
      function exportCsv() {
        var rows = [["Código", "Producto", "Categoría", "Costo (Bs.S)", "Precio (Bs.S)", "Existencia", "Mínimo"]];
        state.products.forEach(function (p) { rows.push([p.barcode, p.name, p.category, p.cost, p.price, p.stock, p.min]); });
        var csv = "\uFEFF" + rows.map(function (row) { return row.map(function (cell) { return '"' + String(cell).replace(/"/g, '""') + '"'; }).join(","); }).join("\r\n");
        var link = document.createElement("a");
        link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
        link.download = "inventario-mercado.csv";
        link.click();
        URL.revokeObjectURL(link.href);
      }

      document.addEventListener("click", function (event) {
        var navButton = event.target.closest("[data-page]");
        if (navButton) { setPage(navButton.dataset.page); return; }
        var goButton = event.target.closest("[data-go]");
        if (goButton) { setPage(goButton.dataset.go); return; }
        var periodButton = event.target.closest("[data-period]");
        if (periodButton) { reportPeriod = periodButton.dataset.period; render(); return; }
        var actionButton = event.target.closest("[data-action]");
        if (!actionButton) return;
        var action = actionButton.dataset.action;
        if (action === "add-product") openProductModal();
        else if (action === "stock") openStockModal(actionButton.dataset.id);
        else if (action === "add-cart") addToCart(actionButton.dataset.id);
        else if (action === "qty") changeQuantity(actionButton.dataset.id, Number(actionButton.dataset.delta));
        else if (action === "clear-cart") { cart = []; render(); }
        else if (action === "close-modal") document.getElementById("modal-root").innerHTML = "";
        else if (action === "print-receipt") window.print();
        else if (action === "export") exportCsv();
      });
      document.addEventListener("input", function (event) {
        if (event.target.id === "inventory-search" || event.target.id === "pos-search") {
          var cursor = event.target.selectionStart;
          searchTerm = event.target.value;
          render();
          var replacement = document.getElementById(event.target.id);
          if (replacement) { replacement.focus(); replacement.setSelectionRange(cursor, cursor); }
        } else if (event.target.id === "cash-received") updateChange();
      });
      document.addEventListener("change", function (event) {
        if (event.target.id === "payment-method") updateChange();
      });
      document.addEventListener("submit", function (event) {
        if (event.target.id === "checkout-form") checkout(event);
        else if (event.target.id === "product-form") saveProduct(event);
        else if (event.target.id === "stock-form") saveStock(event);
      });
      document.getElementById("mobile-menu").addEventListener("click", function () {
        document.getElementById("sidebar").classList.toggle("open");
      });
      document.getElementById("theme-toggle").addEventListener("click", function () {
        var nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
        applyTheme(nextTheme);
        try {
          localStorage.setItem(THEME_KEY, nextTheme);
        } catch (error) {
          console.error("No se pudo guardar la preferencia del tema:", error);
          notify("El tema cambiará, pero no se pudo guardar la preferencia.");
        }
      });
      document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") document.getElementById("modal-root").innerHTML = "";
        if (page === "pos" && event.key === "Enter" && event.target.id === "pos-search") {
          event.preventDefault();
          var barcode = event.target.value.trim();
          var exact = state.products.find(function (product) { return product.barcode === barcode && product.stock > 0; });
          var matches = state.products.filter(function (product) {
            return (product.name + " " + product.barcode + " " + product.category).toLowerCase().indexOf(barcode.toLowerCase()) !== -1 && product.stock > 0;
          });
          if (exact) {
            addToCart(exact.id);
            searchTerm = "";
            loadTheme();
            render();
            var scanner = document.getElementById("pos-search");
            if (scanner) scanner.focus();
          } else if (matches.length === 1) {
            addToCart(matches[0].id);
            searchTerm = "";
            render();
            var searchAgain = document.getElementById("pos-search");
            if (searchAgain) searchAgain.focus();
          } else if (!matches.length) notify("No se encontró el producto escaneado.");
        }
        if (page === "pos" && event.key === "/" && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) {
          event.preventDefault();
          var search = document.getElementById("pos-search");
          if (search) search.focus();
        }
      });
      render();
    })();
  