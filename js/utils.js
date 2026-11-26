(function (app) {
  "use strict";

  var toastTimer;
  var THEME_KEY = "mercado-theme";
  var RATE_CACHE_KEY = "mercado-bcv-rate-v1";
  var RATE_API_URL = "https://ve.dolarapi.com/v1/dolares/oficial";
  var RATE_REFRESH_INTERVAL = 60 * 60 * 1000;
  var BCV_RATE = 920;
  var rateUpdatedAt = "";
  var rateRequestInProgress = false;
  var lastRateRequestAt = 0;

  function loadRateCache() {
    try {
      var cached = JSON.parse(localStorage.getItem(RATE_CACHE_KEY) || "null");
      if (cached && Number.isFinite(cached.rate) && cached.rate > 0) {
        BCV_RATE = cached.rate;
        rateUpdatedAt = typeof cached.updatedAt === "string" &&
          Number.isFinite(new Date(cached.updatedAt).getTime()) ? cached.updatedAt : "";
      }
    } catch (error) {
      console.error("No se pudo leer la tasa BCV guardada:", error);
    }
  }

  function formatRateDate(value) {
    if (!value) return "";
    var date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "";
    return new Intl.DateTimeFormat("es-VE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "America/Caracas"
    }).format(date);
  }

  loadRateCache();

  app.esc = function (value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  };

  app.normalizeSearch = function (value) {
    return String(value == null ? "" : value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  };

  app.money = function (value) {
    return new Intl.NumberFormat("es-VE", { style: "currency", currency: "VES" }).format(Number(value) || 0);
  };

  app.moneyUsd = function (bolivares) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })
      .format((Number(bolivares) || 0) / app.exchangeRate());
  };

  app.moneyPair = function (bolivares) {
    var amount = Number(bolivares) || 0;
    return '<span class="money-pair"><span>' + app.esc(app.money(bolivares)) +
      '</span><small class="money-secondary" data-bs-value="' + amount + '">' + app.esc(app.moneyUsd(amount)) + '</small></span>';
  };

  app.formatBsInput = function (value) {
    var amount = Number(value);
    return Number.isFinite(amount) ? amount.toFixed(2) : "";
  };

  app.formatUsdInput = function (value) {
    var amount = Number(value);
    return Number.isFinite(amount) ? (amount / app.exchangeRate()).toFixed(2) : "";
  };

  app.syncCurrencyInput = function (input) {
    var group = input.closest("[data-currency-group]");
    if (!group) return;
    var bolivaresInput = group.querySelector('[data-currency-kind="bs"]');
    var dollarsInput = group.querySelector('[data-currency-kind="usd"]');
    if (!bolivaresInput || !dollarsInput) return;

    if (input.value.trim() === "") {
      (input.dataset.currencyKind === "bs" ? dollarsInput : bolivaresInput).value = "";
      return;
    }

    var amount = Number(input.value);
    if (!Number.isFinite(amount) || amount < 0) return;
    if (input.dataset.currencyKind === "bs") {
      dollarsInput.value = app.formatUsdInput(amount);
    } else {
      bolivaresInput.value = app.formatBsInput(amount * app.exchangeRate());
    }
  };

  app.exchangeRate = function () {
    return BCV_RATE;
  };

  app.exchangeRateUpdatedAt = function () {
    return rateUpdatedAt;
  };

  app.updateExchangeRateDisplay = function () {
    var value = document.getElementById("exchange-rate-value");
    var date = document.getElementById("exchange-rate-date");
    var indicator = document.getElementById("exchange-rate");
    if (value) value.textContent = new Intl.NumberFormat("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(BCV_RATE);
    if (date) {
      date.textContent = formatRateDate(rateUpdatedAt) || "tasa de respaldo";
      date.title = rateUpdatedAt ? new Date(rateUpdatedAt).toLocaleString("es-VE") : "Tasa de referencia sin fecha";
    }
    if (indicator) {
      indicator.classList.toggle("stale", !rateUpdatedAt);
      indicator.title = rateUpdatedAt
        ? "Tasa oficial BCV publicada el " + formatRateDate(rateUpdatedAt)
        : "Sin tasa BCV descargada; se usa la última tasa guardada o la tasa de inicio.";
    }
  };

  app.refreshExchangeRate = function () {
    if (rateRequestInProgress) return Promise.resolve(false);
    rateRequestInProgress = true;
    lastRateRequestAt = Date.now();

    var controller = new AbortController();
    var requestTimeout = window.setTimeout(function () { controller.abort(); }, 15000);
    return fetch(RATE_API_URL, { cache: "no-store", signal: controller.signal })
      .then(function (response) {
        if (!response.ok) throw new Error("La API de tasa BCV respondió con " + response.status + ".");
        return response.json();
      })
      .then(function (data) {
        var rate = Number(data && data.promedio);
        var updatedAt = data && data.fechaActualizacion;
        if (!data || data.moneda !== "USD" || data.fuente !== "oficial" ||
          !Number.isFinite(rate) || rate <= 0 ||
          typeof updatedAt !== "string" || !Number.isFinite(new Date(updatedAt).getTime())) {
          throw new Error("La respuesta de la tasa BCV no tiene un formato válido.");
        }

        var changed = rate !== BCV_RATE || updatedAt !== rateUpdatedAt;
        BCV_RATE = rate;
        rateUpdatedAt = updatedAt;
        try {
          localStorage.setItem(RATE_CACHE_KEY, JSON.stringify({ rate: rate, updatedAt: updatedAt }));
        } catch (error) {
          console.error("No se pudo guardar la tasa BCV:", error);
        }

        app.updateExchangeRateDisplay();
        if (changed) {
          document.querySelectorAll(".money-secondary[data-bs-value]").forEach(function (element) {
            element.textContent = app.moneyUsd(Number(element.dataset.bsValue));
          });
          document.querySelectorAll(".button-usd[data-bs-value]").forEach(function (element) {
            element.textContent = "(" + app.moneyUsd(Number(element.dataset.bsValue)) + ")";
          });
          document.querySelectorAll(".currency-rate-note").forEach(function (element) {
            element.textContent = "Tasa oficial BCV: 1 USD = " + app.exchangeRate() + " Bs.";
          });
          document.querySelectorAll("[data-currency-group]").forEach(function (group) {
            var bsInput = group.querySelector('[data-currency-kind="bs"]');
            var usdInput = group.querySelector('[data-currency-kind="usd"]');
            if (bsInput && usdInput && document.activeElement !== usdInput) app.syncCurrencyInput(bsInput);
          });
        }
        return true;
      })
      .catch(function (error) {
        console.error("No se pudo actualizar la tasa BCV; se conserva la última disponible:", error);
        var indicator = document.getElementById("exchange-rate");
        if (indicator) {
          indicator.classList.add("stale");
          indicator.title = "No se pudo actualizar la tasa BCV. Se conserva la última disponible.";
        }
        return false;
      })
      .then(function (updated) {
        window.clearTimeout(requestTimeout);
        rateRequestInProgress = false;
        return updated;
      }, function (error) {
        window.clearTimeout(requestTimeout);
        rateRequestInProgress = false;
        throw error;
      });
  };

  app.initializeExchangeRate = function () {
    app.updateExchangeRateDisplay();
    app.refreshExchangeRate();
    window.setInterval(app.refreshExchangeRate, RATE_REFRESH_INTERVAL);
    window.addEventListener("focus", function () {
      if (Date.now() - lastRateRequestAt > 5 * 60 * 1000) app.refreshExchangeRate();
    });
  };

  app.inventoryType = function (product) {
    return product.inventoryType === "ingredient" ? "ingredient" : "sale";
  };

  app.inventoryTypeLabel = function (product) {
    return "Producto para vender";
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
    return app.state.products.filter(function (product) {
      return app.inventoryType(product) === "sale" &&
        app.stockRisk(product).tone !== "healthy";
    });
  };

  app.stockRisk = function (product) {
    var stock = Math.max(0, Number(product.stock) || 0);
    var minimum = Math.max(0, Number(product.min) || 0);
    var percent = minimum > 0
      ? Math.min(100, Math.round(stock / minimum * 100))
      : (stock > 0 ? 100 : 0);
    var tone;
    var label;

    if (stock === 0) {
      tone = "critical";
      label = "Agotado";
    } else if (minimum > 0 && stock <= minimum) {
      tone = "warning";
      label = "Stock bajo";
    } else {
      tone = "healthy";
      label = "Óptimo";
    }

    return { percent: percent, tone: tone, label: label, minimum: minimum };
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
    document.querySelector('meta[name="theme-color"]').setAttribute("content", activeTheme === "dark" ? "#101914" : "#f3f7f3");
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
    if (Number(product.stock) === 0) return '<span class="status out">Agotado</span>';
    return '<span class="status">Disponible</span>';
  };

  app.productCell = function (product) {
    return '<div class="table-product"><span class="product-thumb small">' + app.esc(product.emoji || "📦") + '</span><div><div class="table-product-name">' + app.esc(product.name) + '</div><div class="table-product-meta">' + app.esc(product.barcode) + '</div></div></div>';
  };
})(window.MercadoApp = window.MercadoApp || {});
