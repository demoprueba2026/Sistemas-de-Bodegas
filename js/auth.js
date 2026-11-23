(function (window) {
  "use strict";

  var SESSION_KEY = "mercado-supabase-auth-user";
  var SESSION_VALUE = "authenticated";
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
        return window.sessionStorage.getItem(SESSION_KEY) === SESSION_VALUE;
      } catch (error) {
        console.error("No se pudo consultar la sesión:", error);
        return false;
      }
    },
    login: function (username, password) {
      if (!supabase || username.indexOf("@") === -1) return Promise.resolve(false);
      return supabase.auth.signInWithPassword({
        email: username,
        password: password
      }).then(function (result) {
        if (result.error) throw result.error;
        window.sessionStorage.setItem(SESSION_KEY, SESSION_VALUE);
        return true;
      });
    },
    logout: function () {
      window.sessionStorage.removeItem(SESSION_KEY);
      var signOut = supabase ? supabase.auth.signOut() : Promise.resolve();
      return signOut.then(function (result) {
        if (result && result.error) throw result.error;
      }).catch(function (error) {
        console.error("No se pudo cerrar completamente la sesión de Supabase:", error);
      }).then(function () {
        window.location.replace("login.html");
      });
    },
    getAccountInfo: function () {
      if (!supabase) return Promise.resolve({ name: "Administrador", email: "admin@mercado.local" });
      return supabase.auth.getUser().then(function (result) {
        var user = result.data && result.data.user;
        if (!user) return { name: "Administrador", email: "admin@mercado.local" };
        var name = user.user_metadata && user.user_metadata.full_name
          ? user.user_metadata.full_name
          : "Administrador";
        return { name: name, email: user.email || "Usuario autorizado" };
      }).catch(function () {
        return { name: "Administrador", email: "admin@mercado.local" };
      });
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
