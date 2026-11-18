(function (app) {
  "use strict";

  var toastTimer;
  var THEME_KEY = "mercado-theme";

  app.esc = function (value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  };

  app.money = function (value) {
    return new Intl.NumberFormat("es-VE", { style: "currency", currency: "VES" }).format(Number(value) || 0);
  };

  app.dateLabel = function (date) {
    return new Intl.DateTimeFormat("es-VE", { day: "2-digit", month: "short" }).format(new Date(date));
  };

  app.todaySales = function () {
    var start = new Date();
    start.setHours(0, 0, 0, 0);
    return app.state.sales.filter(function (sale) {
      return !sale.voided && new Date(sale.createdAt).getTime() >= start.getTime();
    });
  };

  app.sumSales = function (sales) {
    return sales.reduce(function (sum, sale) { return sum + sale.total; }, 0);
  };

  app.stockAlerts = function () {
    return app.state.products.filter(function (product) { return product.stock <= product.min; });
  };

  app.notify = function (message) {
    var toast = document.getElementById("toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove("show"); }, 2600);
  };

  app.applyTheme = function (theme) {
    var activeTheme = theme === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = activeTheme;
    var button = document.getElementById("theme-toggle");
    button.textContent = activeTheme === "dark" ? "☀" : "☾";
    button.setAttribute("aria-label", activeTheme === "dark" ? "Activar modo claro" : "Activar modo oscuro");
    button.setAttribute("aria-pressed", activeTheme === "dark" ? "true" : "false");
    button.title = activeTheme === "dark" ? "Activar modo claro" : "Activar modo oscuro";
    document.querySelector('meta[name="theme-color"]').setAttribute("content", activeTheme === "dark" ? "#111915" : "#f5f7f5");
  };

  app.loadTheme = function () {
    var savedTheme = "light";
    try {
      var storedTheme = localStorage.getItem(THEME_KEY);
      if (storedTheme === "dark" || storedTheme === "light") savedTheme = storedTheme;
    } catch (error) {
      console.error("No se pudo leer la preferencia del tema:", error);
    }
    app.applyTheme(savedTheme);
  };

  app.saveTheme = function (theme) {
    app.applyTheme(theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (error) {
      console.error("No se pudo guardar la preferencia del tema:", error);
      app.notify("El tema cambiará, pero no se pudo guardar la preferencia.");
    }
  };

  app.pageHeading = function (title, subtitle, action) {
    return '<div class="page-heading"><div><h1>' + title + '</h1><p class="subtitle">' + subtitle + '</p></div>' + (action || "") + '</div>';
  };

  app.statCard = function (label, value, note, icon, iconClass, positive) {
    return '<div class="stat-card"><div class="stat-top"><span>' + label + '</span><span class="stat-icon ' + (iconClass || "") + '">' + icon + '</span></div><div class="stat-value">' + value + '</div><div class="stat-note ' + (positive ? "positive" : "") + '">' + note + '</div></div>';
  };

  app.stateTag = function (product) {
    if (product.stock <= 0) return '<span class="status out">Agotado</span>';
    if (product.stock <= product.min) return '<span class="status low">Stock bajo</span>';
    return '<span class="status">Disponible</span>';
  };

  app.productCell = function (product) {
    return '<div class="table-product"><span class="product-thumb small">' + app.esc(product.emoji || "📦") + '</span><div><div class="table-product-name">' + app.esc(product.name) + '</div><div class="table-product-meta">' + app.esc(product.barcode) + '</div></div></div>';
  };
})(window.MercadoApp = window.MercadoApp || {});
