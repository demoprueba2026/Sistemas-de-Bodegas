(function () {
  "use strict";

  try {
    var theme = localStorage.getItem("mercado-theme");
    if (theme === "light" || theme === "dark") {
      document.documentElement.dataset.theme = theme;
      document.querySelector('meta[name="theme-color"]').setAttribute(
        "content",
        theme === "dark" ? "#101914" : "#f3f7f3"
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
  var loginForm = document.getElementById("login-form");
  var recoveryForm = document.getElementById("recovery-form");
  var resetForm = document.getElementById("reset-form");
  var recoveryMessage = document.getElementById("recovery-message");
  var resetMessage = document.getElementById("reset-message");

  function showForm(formToShow) {
    loginForm.hidden = formToShow !== loginForm;
    recoveryForm.hidden = formToShow !== recoveryForm;
    resetForm.hidden = formToShow !== resetForm;
  }

  if (window.MercadoAuth.isPasswordRecovery()) {
    showForm(resetForm);
  }

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
    var submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    window.MercadoAuth.login(username, password.value).then(function (loggedIn) {
      if (loggedIn) {
        window.location.replace("index.html");
        return;
      }
      errorMessage.textContent = "Usuario o contraseña incorrectos.";
    }).catch(function (error) {
      console.error("No se pudo iniciar la sesión:", error);
      errorMessage.textContent = "No se pudo iniciar la sesión.";
    }).finally(function () {
      submitButton.disabled = false;
    });
  });

  document.getElementById("forgot-password").addEventListener("click", function () {
    showForm(recoveryForm);
    document.getElementById("recovery-email").focus();
  });

  document.getElementById("back-to-login").addEventListener("click", function () {
    showForm(loginForm);
  });

  recoveryForm.addEventListener("submit", function (event) {
    event.preventDefault();
    recoveryMessage.textContent = "";
    var email = document.getElementById("recovery-email").value.trim();
    var submitButton = recoveryForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    window.MercadoAuth.requestPasswordReset(email).then(function (result) {
      if (result.error) throw result.error;
      recoveryMessage.style.color = "var(--green)";
      recoveryMessage.textContent = "Revisa tu correo. Te enviamos un enlace seguro para cambiar la contraseña.";
    }).catch(function (error) {
      console.error("No se pudo solicitar la recuperación:", error);
      recoveryMessage.style.color = "";
      recoveryMessage.textContent = "No se pudo enviar el enlace. Verifica el correo e inténtalo de nuevo.";
    }).finally(function () {
      submitButton.disabled = false;
    });
  });

  resetForm.addEventListener("submit", function (event) {
    event.preventDefault();
    resetMessage.textContent = "";
    var newPassword = document.getElementById("new-password").value;
    var confirmPassword = document.getElementById("confirm-password").value;

    if (newPassword !== confirmPassword) {
      resetMessage.style.color = "";
      resetMessage.textContent = "Las contraseñas no coinciden.";
      return;
    }

    var submitButton = resetForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    window.MercadoAuth.updatePassword(newPassword).then(function (result) {
      if (result.error) throw result.error;
      resetMessage.style.color = "var(--green)";
      resetMessage.textContent = "Contraseña cambiada correctamente.";
      window.history.replaceState({}, document.title, window.location.pathname);
      setTimeout(function () {
        showForm(loginForm);
        resetMessage.textContent = "";
        resetMessage.style.color = "";
        document.getElementById("password").value = "";
      }, 1400);
    }).catch(function (error) {
      console.error("No se pudo cambiar la contraseña:", error);
      resetMessage.style.color = "";
      resetMessage.textContent = "El enlace expiró o no es válido. Solicita uno nuevo.";
    }).finally(function () {
      submitButton.disabled = false;
    });
  });
})();
