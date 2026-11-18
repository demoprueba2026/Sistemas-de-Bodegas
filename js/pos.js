(function (app) {
  "use strict";

  app.addToCart = function (id) {
    var product = app.state.products.find(function (item) { return item.id === id; });
    if (!product || product.stock <= 0) { app.notify("Este producto no tiene existencias."); return; }
    var item = app.cart.find(function (row) { return row.id === id; });
    if (item && item.quantity >= product.stock) { app.notify("No hay más unidades disponibles."); return; }
    if (item) item.quantity++;
    else app.cart.push({ id: id, quantity: 1 });
    app.render();
  };

  app.changeQuantity = function (id, delta) {
    var product = app.state.products.find(function (item) { return item.id === id; });
    var item = app.cart.find(function (row) { return row.id === id; });
    if (!item || !product) return;
    if (delta > 0 && item.quantity >= product.stock) { app.notify("No hay más unidades disponibles."); return; }
    item.quantity += delta;
    if (item.quantity <= 0) {
      app.cart = app.cart.filter(function (row) { return row.id !== id; });
    }
    app.render();
  };

  app.updateChange = function () {
    var form = document.getElementById("checkout-form");
    if (!form) return;
    var method = document.getElementById("payment-method").value;
    document.getElementById("cash-field").style.display = method === "Efectivo" ? "grid" : "none";
    var total = app.cart.reduce(function (sum, item) {
      var product = app.state.products.find(function (p) { return p.id === item.id; });
      return sum + (product ? product.price * item.quantity : 0);
    }, 0);
    var received = Number(document.getElementById("cash-received").value);
    var due = document.getElementById("change-due");
    if (method === "Efectivo" && received >= total && total > 0) {
      due.innerHTML = "Cambio: " + app.moneyPair(received - total);
    } else if (method === "Efectivo" && received > 0 && received < total) {
      due.innerHTML = "Faltan: " + app.moneyPair(total - received);
    } else {
      due.textContent = "";
    }
  };

  app.checkout = function (event) {
    event.preventDefault();
    if (!app.cart.length) return;
    var method = document.getElementById("payment-method").value;
    var total = 0;
    var profit = 0;
    var items = [];

    for (var i = 0; i < app.cart.length; i++) {
      var product = app.state.products.find(function (p) { return p.id === app.cart[i].id; });
      if (!product || product.stock < app.cart[i].quantity) {
        app.notify("El inventario cambió. Revisa la venta antes de cobrar.");
        app.render();
        return;
      }
      total += product.price * app.cart[i].quantity;
      profit += (product.price - product.cost) * app.cart[i].quantity;
      items.push({
        productId: product.id,
        name: product.name,
        quantity: app.cart[i].quantity,
        price: product.price,
        cost: product.cost
      });
    }

    var cash = method === "Efectivo" ? Number(document.getElementById("cash-received").value) : total;
    if (!Number.isFinite(cash) || cash < total) { app.notify("El efectivo recibido no cubre el total."); return; }

    items.forEach(function (item) {
      var product = app.state.products.find(function (p) { return p.id === item.productId; });
      product.stock -= item.quantity;
      app.state.movements.unshift({
        id: "m" + Date.now() + Math.random().toString(16).slice(2),
        productId: product.id,
        productName: product.name,
        type: "Salida por venta",
        quantity: -item.quantity,
        date: new Date().toISOString()
      });
    });

    var sale = {
      receipt: app.state.nextReceipt++,
      createdAt: new Date().toISOString(),
      total: total,
      profit: profit,
      method: method,
      cash: cash,
      change: cash - total,
      items: items
    };
    app.state.sales.push(sale);
    app.saveState();
    app.cart.length = 0;
    app.render();
    app.showReceipt(sale);
  };

  app.showReceipt = function (sale) {
    var itemRows = sale.items.map(function (item) {
      return '<div class="receipt-line"><span>' + app.esc(item.quantity + " × " + item.name) +
        '</span><span>' + app.moneyPair(item.quantity * item.price) + '</span></div>';
    }).join("");

    document.getElementById("modal-root").innerHTML =
      '<div class="modal-backdrop" id="receipt-backdrop"><div class="modal"><div class="modal-head"><h2>Venta completada</h2>' +
      '<button class="close-button" data-action="close-modal" aria-label="Cerrar">×</button></div><div class="receipt"><h3>MI MERCADO</h3>' +
      '<div class="receipt-center">Gracias por tu compra</div><hr><div>Ticket: #' + app.esc(sale.receipt) +
      '</div><div>' + app.esc(new Intl.DateTimeFormat("es-VE", { dateStyle: "short", timeStyle: "short" }).format(new Date(sale.createdAt))) +
      '</div><hr>' + itemRows + '<hr><div class="receipt-line"><strong>TOTAL</strong><strong>' +
      app.moneyPair(sale.total) + '</strong></div><div>Método de pago: ' + app.esc(sale.method) +
      '</div>' + (sale.method === "Efectivo" ? '<div class="receipt-payment">Efectivo: ' + app.moneyPair(sale.cash) +
      '</div><div class="receipt-payment">Cambio: ' + app.moneyPair(sale.change) + '</div>' : '') +
      '<hr><div class="receipt-center">¡Vuelve pronto!</div></div><div class="modal-actions">' +
      '<button class="button" data-action="close-modal">Cerrar</button>' +
      '<button class="button primary" data-action="print-receipt">Imprimir ticket</button></div></div></div>';
  };
})(window.MercadoApp = window.MercadoApp || {});
