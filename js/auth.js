(function (window) {
  "use strict";

  var SESSION_KEY = "mercado-auth-user";
  var USERNAME = "admin";
  var PASSWORD = "admin123";

  var auth = {
    isAuthenticated: function () {
      try {
        return window.sessionStorage.getItem(SESSION_KEY) === USERNAME;
      } catch (error) {
        console.error("No se pudo consultar la sesión:", error);
        return false;
      }
    },
    login: function (username, password) {
      if (username !== USERNAME || password !== PASSWORD) return false;
      window.sessionStorage.setItem(SESSION_KEY, USERNAME);
      return true;
    },
    logout: function () {
      window.sessionStorage.removeItem(SESSION_KEY);
      window.location.replace("login.html");
    }
  };

  window.MercadoAuth = auth;

  var script = document.currentScript;
  if (script && script.dataset.guard === "protected" && !auth.isAuthenticated()) {
    window.location.replace("login.html");
  }
})(window);
