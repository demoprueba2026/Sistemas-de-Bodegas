(function (app) {
  "use strict";

  if (!window.MercadoAuth || !window.MercadoAuth.isAuthenticated()) {
    window.location.replace("login.html");
    return;
  }

  var pageNames = {
    dashboard: "Resumen",
    pos: "Punto de venta",
    inventory: "Inventario",
    reports: "Reportes"
  };

  app.setPage = function (page) {
    if (!pageNames[page]) return;
    app.page = page;
    app.searchTerm = "";
    document.querySelectorAll(".nav button").forEach(function (button) {
      button.classList.toggle("active", button.dataset.page === page);
    });
    document.getElementById("sidebar").classList.remove("open");
    app.render();
  };

  app.render = function () {
    var breadcrumb = '<button type="button" class="breadcrumb-link" data-go="dashboard">Tienda</button>';
    if (app.page === "inventory") {
      breadcrumb += '<span class="breadcrumb-separator" aria-hidden="true">›</span>' +
        '<button type="button" class="breadcrumb-link" data-page="inventory">Inventario</button>' +
        '<span class="breadcrumb-separator" aria-hidden="true">›</span>' +
        '<span class="breadcrumb-current" aria-current="page">' +
        (app.inventorySection === "ingredient" ? "Insumos para comidas" : "Productos para vender") + '</span>';
    } else {
      breadcrumb += '<span class="breadcrumb-separator" aria-hidden="true">›</span>' +
        '<span class="breadcrumb-current" aria-current="page">' + pageNames[app.page] + '</span>';
    }
    document.getElementById("breadcrumb-nav").innerHTML = breadcrumb;
    document.getElementById("nav-alert-count").textContent = app.stockAlerts().length;
    document.getElementById("today").textContent =
      new Intl.DateTimeFormat("es-VE", { weekday: "short", day: "numeric", month: "short" }).format(new Date());

    var content = document.getElementById("content");
    if (app.page === "dashboard") content.innerHTML = app.renderDashboard();
    else if (app.page === "inventory") content.innerHTML = app.renderInventory();
    else if (app.page === "pos") content.innerHTML = app.renderPos();
    else content.innerHTML = app.renderReports();

    if (app.page === "pos") app.updateChange();
  };

  document.addEventListener("click", function (event) {
    var navButton = event.target.closest("[data-page]");
    if (navButton) { app.setPage(navButton.dataset.page); return; }

    var goButton = event.target.closest("[data-go]");
    if (goButton) { app.setPage(goButton.dataset.go); return; }

    var periodButton = event.target.closest("[data-period]");
    if (periodButton) {
      app.reportPeriod = periodButton.dataset.period;
      app.render();
      return;
    }

    var inventoryTab = event.target.closest("[data-inventory-section]");
    if (inventoryTab) {
      app.inventorySection = inventoryTab.dataset.inventorySection === "ingredient" ? "ingredient" : "sale";
      app.searchTerm = "";
      app.render();
      return;
    }

    var actionButton = event.target.closest("[data-action]");
    if (!actionButton) return;
    var action = actionButton.dataset.action;

    if (action === "add-product") app.openProductModal();
    else if (action === "edit-product") app.openProductModal(actionButton.dataset.id);
    else if (action === "delete-product") app.deleteProduct(actionButton.dataset.id);
    else if (action === "stock") app.openStockModal(actionButton.dataset.id);
    else if (action === "inventory-selection") app.openInventorySelection();
    else if (action === "container-search") app.openContainerSearch();
    else if (action === "toggle-inventory-selection") {
      app.inventorySelectionIds = app.inventorySelectionIds || [];
      var selectedIndex = app.inventorySelectionIds.indexOf(actionButton.dataset.id);
      if (selectedIndex === -1) app.inventorySelectionIds.push(actionButton.dataset.id);
      else app.inventorySelectionIds.splice(selectedIndex, 1);
      app.openInventorySelection();
    } else if (action === "clear-inventory-selection") {
      app.inventorySelectionIds = [];
      app.openInventorySelection();
    } else if (action === "export-selection") app.exportInventorySelection();
    else if (action === "add-cart") app.addToCart(actionButton.dataset.id);
    else if (action === "qty") app.changeQuantity(actionButton.dataset.id, Number(actionButton.dataset.delta));
    else if (action === "clear-cart") {
      app.cart.length = 0;
      app.render();
    } else if (action === "close-modal") document.getElementById("modal-root").innerHTML = "";
    else if (action === "print-receipt") window.print();
    else if (action === "export") app.exportCsv();
  });

  document.addEventListener("input", function (event) {
    var inputId = event.target.id;
    if (event.target.matches("[data-currency-kind]")) {
      app.syncCurrencyInput(event.target);
      if (event.target.closest("#cash-field")) app.updateChange();
    } else if (inputId === "container-search") {
      var containerCursor = event.target.selectionStart;
      app.containerSearchTerm = event.target.value;
      app.renderContainerSearch();
      var containerReplacement = document.getElementById("container-search");
      if (containerReplacement) {
        containerReplacement.setSelectionRange(containerCursor, containerCursor);
      }
    } else if (inputId === "inventory-search" || inputId === "pos-search") {
      var cursor = event.target.selectionStart;
      app.searchTerm = event.target.value;
      app.render();
      var replacement = document.getElementById(inputId);
      if (replacement) {
        replacement.focus();
        replacement.setSelectionRange(cursor, cursor);
      }
    } else if (inputId === "cash-received") app.updateChange();
  });

  document.addEventListener("change", function (event) {
    if (event.target.id === "payment-method") app.updateChange();
    if (event.target.id === "report-date") {
      app.reportDate = event.target.value;
      app.render();
    }
  });

  document.addEventListener("submit", function (event) {
    if (event.target.id === "checkout-form") app.checkout(event);
    else if (event.target.id === "product-form") app.saveProduct(event);
    else if (event.target.id === "stock-form") app.saveStock(event);
  });

  document.getElementById("mobile-menu").addEventListener("click", function () {
    document.getElementById("sidebar").classList.toggle("open");
  });

  var sidebarToggle = document.getElementById("sidebar-toggle");
  var savedSidebarState = localStorage.getItem("mercado-sidebar-collapsed") === "true";
  document.querySelector(".app").classList.toggle("sidebar-collapsed", savedSidebarState);
  sidebarToggle.setAttribute("aria-label", savedSidebarState ? "Desplegar barra lateral" : "Plegar barra lateral");
  sidebarToggle.setAttribute("title", savedSidebarState ? "Desplegar barra lateral" : "Plegar barra lateral");
  sidebarToggle.addEventListener("click", function () {
    var collapsed = document.querySelector(".app").classList.toggle("sidebar-collapsed");
    localStorage.setItem("mercado-sidebar-collapsed", collapsed ? "true" : "false");
    sidebarToggle.setAttribute("aria-label", collapsed ? "Desplegar barra lateral" : "Plegar barra lateral");
    sidebarToggle.setAttribute("title", collapsed ? "Desplegar barra lateral" : "Plegar barra lateral");
  });

  document.getElementById("theme-toggle").addEventListener("click", function () {
    var nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    app.saveTheme(nextTheme);
  });

  document.getElementById("logout-button").addEventListener("click", function () {
    window.MercadoAuth.logout();
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") document.getElementById("modal-root").innerHTML = "";
    if (app.page === "pos" && event.key === "Enter" && event.target.id === "pos-search") {
      event.preventDefault();
      var barcode = event.target.value.trim();
      var exact = app.state.products.find(function (product) {
        return app.inventoryType(product) === "sale" && product.barcode === barcode && product.stock > 0;
      });
      var matches = app.state.products.filter(function (product) {
        var searchable = product.name + " " + product.barcode + " " + product.category;
        return app.inventoryType(product) === "sale" &&
          searchable.toLowerCase().indexOf(barcode.toLowerCase()) !== -1 && product.stock > 0;
      });

      if (exact || matches.length === 1) {
        app.addToCart(exact ? exact.id : matches[0].id);
        app.searchTerm = "";
        app.render();
        var scanner = document.getElementById("pos-search");
        if (scanner) scanner.focus();
      } else if (!matches.length) {
        app.notify("No se encontró el producto escaneado.");
      }
    }

    if (app.page === "pos" && event.key === "/" && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) {
      event.preventDefault();
      var search = document.getElementById("pos-search");
      if (search) search.focus();
    }
  });

  app.loadTheme();
  app.render();
  app.initializeExchangeRate();
})(window.MercadoApp);
