(function (window) {
  "use strict";

  var SESSION_KEY = "mercado-auth-user";
  var USERNAME = "admin";
  var PASSWORD = "admin123";
  var SUPABASE_URL = "https://pdejtjasizzzdghwynyi.supabase.co";
  var SUPABASE_ANON_KEY = "sb_publishable_UKbFCTv_JRkyRMG4UH3k5g_GGMisfyG";
  var supabase = null;

  if (window.supabase && window.supabase.createClient) {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
  }

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
      if (username === USERNAME && password === PASSWORD) {
        window.sessionStorage.setItem(SESSION_KEY, USERNAME);
        return Promise.resolve(true);
      }
      if (!supabase || username.indexOf("@") === -1) return Promise.resolve(false);
      return supabase.auth.signInWithPassword({
        email: username,
        password: password
      }).then(function (result) {
        if (result.error) return false;
        window.sessionStorage.setItem(SESSION_KEY, USERNAME);
        return true;
      });
    },
    logout: function () {
      window.sessionStorage.removeItem(SESSION_KEY);
      window.location.replace("login.html");
    },
    requestPasswordReset: function (email) {
      if (!supabase) return Promise.reject(new Error("Supabase no está disponible."));
      return supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + window.location.pathname
      });
    },
    updatePassword: function (password) {
      if (!supabase) return Promise.reject(new Error("Supabase no está disponible."));
      return supabase.auth.updateUser({ password: password });
    },
    isPasswordRecovery: function () {
      var search = new URLSearchParams(window.location.search);
      if (search.has("code")) return true;
      if (!window.location.hash) return false;
      var hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      return hash.get("type") === "recovery";
    }
  };

  window.MercadoAuth = auth;

  var script = document.currentScript;
  if (script && script.dataset.guard === "protected" && !auth.isAuthenticated()) {
    window.location.replace("login.html");
  }
})(window);
