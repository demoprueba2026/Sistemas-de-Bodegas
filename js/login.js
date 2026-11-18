(function () {
  "use strict";

  try {
    var theme = localStorage.getItem("mercado-theme");
    if (theme === "light" || theme === "dark") {
      document.documentElement.dataset.theme = theme;
      document.querySelector('meta[name="theme-color"]').setAttribute(
        "content",
        theme === "dark" ? "#111915" : "#f5f7f5"
      );
    }
  } catch (error) {
    console.error("No se pudo leer la preferencia del tema:", error);
  }

  if (window.MercadoAuth.isAuthenticated()) {
    window.location.replace("index.html");
    return;
  }

  var form = document.getElementById("login-form");
  var password = document.getElementById("password");
  var errorMessage = document.getElementById("login-error");
  var togglePassword = document.getElementById("toggle-password");

  togglePassword.addEventListener("click", function () {
    var showing = password.type === "password";
    password.type = showing ? "text" : "password";
    togglePassword.textContent = showing ? "Ocultar" : "Mostrar";
    togglePassword.setAttribute("aria-label", showing ? "Ocultar contraseña" : "Mostrar contraseña");
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    errorMessage.textContent = "";
    var username = document.getElementById("username").value.trim();

    try {
      if (window.MercadoAuth.login(username, password.value)) {
        window.location.replace("index.html");
        return;
      }
      errorMessage.textContent = "Usuario o contraseña incorrectos.";
    } catch (error) {
      console.error("No se pudo iniciar la sesión:", error);
      errorMessage.textContent = "No se pudo guardar la sesión en este navegador.";
    }
  });
})();
