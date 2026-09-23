// Google sign-in + one JSON document in the user's Drive appDataFolder.
// Pure browser code: Google Identity Services (token model) for OAuth, the
// Drive v3 REST API for storage. No backend; the client ID is public config
// read from <meta name="google-client-id">.
(function () {
  const GIS_SRC = "https://accounts.google.com/gsi/client";
  const SCOPES = [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/drive.appdata"
  ].join(" ");
  const FILE_NAME = "langlsrw-data.json";
  const PROFILE_KEY = "langLSRWGoogleProfile";

  let gisPromise = null;
  let tokenClient = null;
  let pendingToken = null;
  let accessToken = "";
  let tokenExpiresAt = 0;
  let fileId = "";

  function clientId() {
    return document.querySelector('meta[name="google-client-id"]')?.content.trim() || "";
  }

  function isConfigured() {
    return Boolean(clientId());
  }

  function loadGis() {
    if (window.google?.accounts?.oauth2) return Promise.resolve();
    if (gisPromise) return gisPromise;
    gisPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = GIS_SRC;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        gisPromise = null;
        reject(new Error("无法加载 Google 登录组件，请检查网络。"));
      };
      document.head.appendChild(script);
    });
    return gisPromise;
  }

  function ensureTokenClient() {
    if (tokenClient) return tokenClient;
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId(),
      scope: SCOPES,
      callback: (response) => {
        const pending = pendingToken;
        pendingToken = null;
        if (!pending) return;
        if (response.error) {
          pending.reject(new Error(response.error_description || response.error));
          return;
        }
        accessToken = response.access_token;
        // Renew a minute early so a request never races the expiry.
        tokenExpiresAt = Date.now() + (Number(response.expires_in) - 60) * 1000;
        pending.resolve(accessToken);
      },
      error_callback: (error) => {
        const pending = pendingToken;
        pendingToken = null;
        if (!pending) return;
        const messages = {
          popup_failed_to_open: "浏览器拦截了 Google 登录弹窗，请允许弹窗后重试。",
          popup_closed: "Google 登录窗口已关闭。"
        };
        pending.reject(new Error(messages[error?.type] || "Google 登录失败。"));
      }
    });
    return tokenClient;
  }

  // Must be called from a user gesture (click/keypress): GIS opens a popup.
  async function requestToken({ selectAccount = false } = {}) {
    if (!isConfigured()) throw new Error("尚未配置 Google Client ID。");
    await loadGis();
    const client = ensureTokenClient();
    const profile = getProfile();
    return new Promise((resolve, reject) => {
      pendingToken = { resolve, reject };
      client.requestAccessToken({
        prompt: selectAccount || !profile ? "select_account" : "",
        hint: profile?.email || undefined
      });
    });
  }

  function hasToken() {
    return Boolean(accessToken) && Date.now() < tokenExpiresAt;
  }

  function getProfile() {
    try {
      const profile = JSON.parse(localStorage.getItem(PROFILE_KEY) || "null");
      return profile?.sub ? profile : null;
    } catch {
      return null;
    }
  }

  async function api(url, options = {}) {
    if (!hasToken()) {
      const error = new Error("Google 连接已过期，请重新连接。");
      error.code = "token_expired";
      throw error;
    }
    const response = await fetch(url, {
      ...options,
      headers: { ...(options.headers || {}), Authorization: `Bearer ${accessToken}` }
    });
    if (response.status === 401) {
      accessToken = "";
      const error = new Error("Google 连接已过期，请重新连接。");
      error.code = "token_expired";
      throw error;
    }
    if (!response.ok) throw new Error(`Google 接口错误（${response.status}）`);
    return response;
  }

  async function signIn({ selectAccount = false } = {}) {
    await requestToken({ selectAccount });
    const info = await (await api("https://www.googleapis.com/oauth2/v3/userinfo")).json();
    const previous = getProfile();
    if (previous?.sub !== info.sub) fileId = "";
    const profile = {
      sub: info.sub,
      email: info.email || "",
      name: info.name || info.email || "Google 用户",
      picture: info.picture || ""
    };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    return profile;
  }

  // Forgets the session locally. Consent is not revoked, so signing in again
  // is one click; users can remove access at myaccount.google.com/permissions.
  function signOut() {
    accessToken = "";
    tokenExpiresAt = 0;
    fileId = "";
    localStorage.removeItem(PROFILE_KEY);
  }

  async function findFileId() {
    if (fileId) return fileId;
    const query = new URLSearchParams({
      spaces: "appDataFolder",
      q: `name='${FILE_NAME}' and trashed=false`,
      fields: "files(id,modifiedTime)",
      orderBy: "modifiedTime desc",
      pageSize: "1"
    });
    const { files } = await (await api(`https://www.googleapis.com/drive/v3/files?${query}`)).json();
    fileId = files?.[0]?.id || "";
    return fileId;
  }

  async function pull() {
    const id = await findFileId();
    if (!id) return null;
    const response = await api(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, { cache: "no-store" });
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  async function push(data) {
    const body = JSON.stringify(data);
    const id = await findFileId();
    if (id) {
      await api(`https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body
      });
      return;
    }
    const boundary = `langlsrw-${Math.random().toString(36).slice(2)}`;
    const metadata = { name: FILE_NAME, parents: ["appDataFolder"], mimeType: "application/json" };
    const multipart = [
      `--${boundary}`,
      "Content-Type: application/json; charset=UTF-8",
      "",
      JSON.stringify(metadata),
      `--${boundary}`,
      "Content-Type: application/json",
      "",
      body,
      `--${boundary}--`
    ].join("\r\n");
    const created = await (await api("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body: multipart
    })).json();
    fileId = created.id || "";
  }

  window.langLSRWGoogleDrive = {
    isConfigured,
    getProfile,
    hasToken,
    signIn,
    reconnect: () => requestToken(),
    signOut,
    pull,
    push
  };
})();
