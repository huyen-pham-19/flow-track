const FlowTrackAuth = (() => {
  const TOKEN_KEY = "flowtrack-token";
  const USER_KEY = "flowtrack-current-user";
  const STORAGE_PREFIX = "flowtrack-v5";
  const API_BASE_URL = "http://localhost:3000/api";

  let hooks = {
    onLogin: null,
    onLogout: null
  };

  function init(options = {}) {
    hooks = {
      onLogin: typeof options.onLogin === "function" ? options.onLogin : null,
      onLogout: typeof options.onLogout === "function" ? options.onLogout : null
    };

    injectUI();
    bindEvents();

    restoreSession();
  }

  function injectUI() {
    if (document.getElementById("authScreen")) return;

    document.body.insertAdjacentHTML(
      "afterbegin",
      `
      <div id="authScreen" class="auth-screen hidden">
        <div class="auth-backdrop">
          <div class="auth-blob blob-left"></div>
          <div class="auth-blob blob-right"></div>
        </div>

        <div class="auth-card">
          <h2 class="auth-title" id="authTitle">Login</h2>

          <div class="auth-tabs">
            <button id="showLoginBtn" class="auth-tab active" type="button">Login</button>
            <button id="showRegisterBtn" class="auth-tab" type="button">Register</button>
          </div>

          <form id="loginForm" class="auth-form">
            <div class="auth-field">
              <label for="loginEmail">Email</label>
              <input id="loginEmail" type="email" placeholder="Enter your email" required />
            </div>

            <div class="auth-field">
              <label for="loginPassword">Password</label>
              <input id="loginPassword" type="password" placeholder="Enter your password" required />
            </div>

            <button class="auth-submit" type="submit">Login</button>
          </form>

          <form id="registerForm" class="auth-form hidden">
            <div class="auth-field">
              <label for="registerName">Full name</label>
              <input id="registerName" type="text" placeholder="Enter your full name" required />
            </div>

            <div class="auth-field">
              <label for="registerEmail">Email</label>
              <input id="registerEmail" type="email" placeholder="Enter your email" required />
            </div>

            <div class="auth-field">
              <label for="registerPassword">Password</label>
              <input id="registerPassword" type="password" placeholder="At least 6 characters" required />
            </div>

            <button class="auth-submit" type="submit">Create account</button>
          </form>
        </div>
      </div>
      `
    );
  }

  function bindEvents() {
    const loginForm = document.getElementById("loginForm");
    const registerForm = document.getElementById("registerForm");
    const showLoginBtn = document.getElementById("showLoginBtn");
    const showRegisterBtn = document.getElementById("showRegisterBtn");
    const authTitle = document.getElementById("authTitle");

    showLoginBtn?.addEventListener("click", () => toggle("login"));
    showRegisterBtn?.addEventListener("click", () => toggle("register"));

    loginForm?.addEventListener("submit", async (event) => {
      event.preventDefault();

      const email = document.getElementById("loginEmail").value.trim().toLowerCase();
      const password = document.getElementById("loginPassword").value;

      if (!email || !password) {
        showMessage("Vui lòng nhập email và mật khẩu.");
        return;
      }

      try {
        setAuthLoading(true);

        const response = await fetch(`${API_BASE_URL}/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
          showMessage(data.message || "Đăng nhập thất bại.");
          return;
        }

        saveSession(data.token, data.user);
        loginForm.reset();
        showApp();
        renderUserBar(data.user);
        hooks.onLogin?.(data.user);
        showMessage(`Chào mừng ${data.user.name}!`);
      } catch (error) {
        console.error("Login error:", error);
        showMessage("Không thể kết nối tới server.");
      } finally {
        setAuthLoading(false);
      }
    });

    registerForm?.addEventListener("submit", async (event) => {
      event.preventDefault();

      const name = document.getElementById("registerName").value.trim();
      const email = document.getElementById("registerEmail").value.trim().toLowerCase();
      const password = document.getElementById("registerPassword").value;

      if (!name) {
        showMessage("Vui lòng nhập họ tên.");
        return;
      }

      if (!email) {
        showMessage("Vui lòng nhập email.");
        return;
      }

      if (password.length < 6) {
        showMessage("Mật khẩu cần ít nhất 6 ký tự.");
        return;
      }

      try {
        setAuthLoading(true);

        const response = await fetch(`${API_BASE_URL}/register`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ name, email, password })
        });

        const data = await response.json();

        if (!response.ok) {
          showMessage(data.message || "Đăng ký thất bại.");
          return;
        }

        saveSession(data.token, data.user);
        registerForm.reset();
        showApp();
        renderUserBar(data.user);
        hooks.onLogin?.(data.user);
        showMessage("Tạo tài khoản thành công.");
      } catch (error) {
        console.error("Register error:", error);
        showMessage("Không thể kết nối tới server.");
      } finally {
        setAuthLoading(false);
      }
    });

    function toggle(mode) {
      const isLogin = mode === "login";

      loginForm.classList.toggle("hidden", !isLogin);
      registerForm.classList.toggle("hidden", isLogin);
      showLoginBtn.classList.toggle("active", isLogin);
      showRegisterBtn.classList.toggle("active", !isLogin);
      authTitle.textContent = isLogin ? "Login" : "Register";
    }
  }

  async function restoreSession() {
    const token = getToken();
    const cachedUser = getCachedUser();

    if (!token) {
      showAuth();
      return;
    }

    try {
      setAuthLoading(true);

      const response = await fetch(`${API_BASE_URL}/me`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        clearSession();
        showAuth();
        return;
      }

      saveSession(token, data.user);
      showApp();
      renderUserBar(data.user);
      hooks.onLogin?.(data.user);
    } catch (error) {
      console.error("Restore session error:", error);

      if (cachedUser) {
        showApp();
        renderUserBar(cachedUser);
        hooks.onLogin?.(cachedUser);
        return;
      }

      clearSession();
      showAuth();
    } finally {
      setAuthLoading(false);
    }
  }

  function showAuth() {
    document.getElementById("authScreen")?.classList.remove("hidden");
    document.querySelector(".app")?.classList.add("hidden");
  }

  function showApp() {
    document.getElementById("authScreen")?.classList.add("hidden");
    document.querySelector(".app")?.classList.remove("hidden");
  }

  function renderUserBar(user) {
    let bar = document.getElementById("userBar");

    if (!bar) {
      bar = document.createElement("div");
      bar.id = "userBar";
      bar.className = "auth-userbar";
      bar.innerHTML = `
        <button id="logoutBtn" type="button" class="ghost-btn auth-logout-btn">Logout</button>
      `;

      document.querySelector(".topbar-actions")?.appendChild(bar);
    }

    const userNameBtn = bar.querySelector("#userNameBtn");
    if (userNameBtn) {
      userNameBtn.textContent = user.name;
    }

    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.onclick = () => {
        clearSession();
        document.getElementById("loginForm")?.reset();
        document.getElementById("registerForm")?.reset();
        bar.remove();
        hooks.onLogout?.();
        showAuth();
        showMessage("Đã đăng xuất.");
      };
    }
  }

  function saveSession(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || "";
  }

  function getCachedUser() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY) || "null");
    } catch {
      return null;
    }
  }

  function getCurrentUser() {
    return getCachedUser();
  }

  function getUserStorageKey() {
    const user = getCurrentUser();
    return user ? `${STORAGE_PREFIX}:${user.id}` : `${STORAGE_PREFIX}:guest`;
  }

  function setAuthLoading(loading) {
    const submitButtons = document.querySelectorAll(".auth-submit");
    const tabButtons = document.querySelectorAll(".auth-tab");

    submitButtons.forEach((button) => {
      button.disabled = loading;
      button.style.opacity = loading ? "0.7" : "1";
      button.style.pointerEvents = loading ? "none" : "auto";
    });

    tabButtons.forEach((button) => {
      button.disabled = loading;
      button.style.opacity = loading ? "0.7" : "1";
      button.style.pointerEvents = loading ? "none" : "auto";
    });
  }

  function showMessage(message) {
    if (typeof window.showToast === "function") {
      window.showToast(message);
      return;
    }

    alert(message);
  }

  return {
    init,
    getCurrentUser,
    getUserStorageKey,
    getToken
  };
})();

window.FlowTrackAuth = FlowTrackAuth;