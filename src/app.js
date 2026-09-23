
    const defaultShortcuts = {
      speakSentence: "`",
      toggleSource: "1",
      toggleTranslation: "2",
      nextSentence: "Right",
      previousSentence: "Left",
      speakCurrentWord: "Alt+`",
      peekCurrentWord: "Alt+1",
      stopSpeech: "Alt+X",
      resetSentence: "Alt+R",
      finishSentence: "Ctrl+Enter",
      holdSpeaking: "Space"
    };

    const speakingShortcuts = {
      previousSentence: "Alt+B",
      nextSentence: "Alt+N",
      speakModel: "Alt+P",
      togglePractice: "Alt+R"
    };

    const palettes = ["default", "github", "reddit", "twitter", "anki"];

    const englishFontPresets = {
      default: '"Segoe UI", Arial, sans-serif',
      georgia: 'Georgia, "Times New Roman", serif',
      times: '"Times New Roman", Times, serif',
      segoe: '"Segoe UI", Arial, sans-serif',
      arial: 'Arial, sans-serif'
    };

    const chineseFontPresets = {
      yahei: '"Microsoft YaHei", "PingFang SC", sans-serif',
      simsun: 'SimSun, "宋体", serif',
      simhei: 'SimHei, "黑体", sans-serif',
      kaiti: 'KaiTi, "楷体", serif'
    };

    function fontDefaults() {
      return { english: "default", chinese: "yahei" };
    }

    function loadStoredFontSettings() {
      try {
        return { ...fontDefaults(), ...JSON.parse(localStorage.getItem("langLSRWFontSettings") || "{}") };
      } catch {
        return fontDefaults();
      }
    }

    function grammarColorDefaults() {
      return {
        subject: "#ef4444",
        predicate: "#f97316",
        object: "#eab308",
        predicative: "#b58ba0",
        complement: "#22c55e",
        attribute: "#14b8a6",
        adverbial: "#06b6d4",
        appositive: "#3b82f6",
        head: "#a855f7",
        other: "#94a3b8"
      };
    }

    function normalizeGrammarColors(colors) {
      const defaults = grammarColorDefaults();
      return Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => {
        const value = String(colors?.[key] || "").trim();
        return [key, /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : fallback];
      }));
    }

    function loadStoredGrammarColors() {
      try {
        return normalizeGrammarColors(JSON.parse(localStorage.getItem("langLSRWGrammarColors") || "{}"));
      } catch {
        return grammarColorDefaults();
      }
    }

    const shortcutActions = [
      { id: "speakSentence", label: "朗读当前句" },
      { id: "toggleSource", label: "显示/隐藏原文" },
      { id: "toggleTranslation", label: "显示/隐藏翻译" },
      { id: "nextSentence", label: "下一句" },
      { id: "previousSentence", label: "上一句" },
      { id: "speakCurrentWord", label: "朗读当前词" },
      { id: "peekCurrentWord", label: "按住显示当前词" },
      { id: "stopSpeech", label: "停止朗读" },
      { id: "resetSentence", label: "重写当前句" },
      { id: "finishSentence", label: "完成本句" },
      { id: "holdSpeaking", label: "按住说话" }
    ];

    function loadShortcutSettings() {
      const saved = JSON.parse(localStorage.getItem("langLSRWShortcuts") || "null") || {};
      if (saved.peekCurrentWord === "[" && saved.speakCurrentWord === "]") {
        saved.peekCurrentWord = "]";
        saved.speakCurrentWord = "[";
        localStorage.setItem("langLSRWShortcuts", JSON.stringify(saved));
      }
      if (saved.peekCurrentWord === "]" && saved.speakCurrentWord === "[") {
        saved.peekCurrentWord = "Alt+1";
        saved.speakCurrentWord = "Alt+`";
        localStorage.setItem("langLSRWShortcuts", JSON.stringify(saved));
      }
      return { ...defaultShortcuts, ...saved };
    }

    function loadActiveLearningPage() {
      const savedPage = localStorage.getItem("activeLearningPage");
      const migrated = localStorage.getItem("learningPageMigratedToListen");
      if (savedPage === "speakPage") {
        localStorage.setItem("activeLearningPage", "listenPage");
        return "listenPage";
      }
      if ((!savedPage || savedPage === "writePage") && !migrated) {
        localStorage.setItem("activeLearningPage", "listenPage");
        localStorage.setItem("learningPageMigratedToListen", "1");
        return "listenPage";
      }
      return savedPage || "listenPage";
    }

    const state = {
      sentences: [],
      index: 0,
      events: [],
      startedAt: 0,
      finished: false,
      currentUser: localStorage.getItem("langLSRWCurrentUser") || "",
      history: [],
      voices: [],
      lastSpokenWordKey: "",
      replaySlowStep: 0,
      shortcuts: loadShortcutSettings(),
      speechSettings: JSON.parse(localStorage.getItem("langLSRWSpeechSettings") || "{}"),
      aiSettings: JSON.parse(localStorage.getItem("langLSRWAISettings") || "{}"),
      fontSettings: loadStoredFontSettings(),
      grammarColors: loadStoredGrammarColors(),
      activePage: loadActiveLearningPage(),
      grammarLoading: false,
      grammarVisible: false,
      grammarExpansionMode: "main",
      grammarExpandedNodeIds: new Set(),
      libraries: [],
      activeLibraryId: "",
      progress: null,
      library: {
        selectedId: "",
        items: [],
        filteredItems: [],
        query: "",
        page: 0,
        pageSize: 50,
        loading: false
      },
      speaking: {
        isRecognizing: false,
        isRecording: false,
        isStarting: false,
        holdActive: false,
        stopAfterStart: false,
        stopTimer: null,
        permissionLock: false,
        micReady: false,
        recognition: null,
        mediaRecorder: null,
        mediaStream: null,
        audioContext: null,
        volumeAnalyser: null,
        volumeFrame: 0,
        volumeLevel: 0,
        volumeTotal: 0,
        volumeSamples: 0,
        audioChunks: [],
        spokenText: "",
        statusMessage: "",
        recordedAudioUrl: "",
        metrics: null
      }
    };

    const $ = (id) => document.getElementById(id);
    const targetEl = $("target");
    const typingBox = $("typingBox");
    const typedPreviewEl = $("typedPreview");
    const counterEl = $("counter");
    const errorsEl = $("errors");
    const historyEl = $("history");

    const googleDrive = window.langLSRWGoogleDrive;
    const cloudSync = window.langLSRWCloudSync;
    const googleUserPrefix = "google:";

    function isGoogleUser(name = state.currentUser) {
      return String(name || "").startsWith(googleUserPrefix);
    }

    function updateUserBadge() {
      const profile = isGoogleUser() ? googleDrive.getProfile() : null;
      $("userBadge").textContent = profile
        ? `☁ ${profile.name}`
        : state.currentUser ? `用户：${state.currentUser}` : "未登录";
      $("cloudSyncPanel").hidden = !profile;
      $("localUserActions").hidden = Boolean(profile);
      if (profile) {
        $("cloudName").textContent = profile.name;
        $("cloudEmail").textContent = profile.email;
        $("cloudAvatar").hidden = !profile.picture;
        if (profile.picture) $("cloudAvatar").src = profile.picture;
      }
    }

    function normalizeUsername(name) {
      return name.trim().replace(/\s+/g, " ").slice(0, 24);
    }

    function userStorageKey(name = state.currentUser) {
      return `langLSRWHistory:${name}`;
    }

    function getKnownUsers() {
      return JSON.parse(localStorage.getItem("langLSRWKnownUsers") || "[]");
    }

    function saveKnownUser(name) {
      const users = getKnownUsers().filter((user) => user !== name);
      users.unshift(name);
      localStorage.setItem("langLSRWKnownUsers", JSON.stringify(users.slice(0, 8)));
    }

    function loadUserHistory() {
      if (!state.currentUser) {
        state.history = [];
        return;
      }
      state.history = JSON.parse(localStorage.getItem(userStorageKey()) || "[]");
    }

    function saveUserHistory() {
      if (!state.currentUser) return;
      localStorage.setItem(userStorageKey(), JSON.stringify(state.history));
    }

    function normalizeSentenceItem(item) {
      if (item && typeof item === "object") {
        return {
          id: String(item.id || "").trim(),
          libraryId: String(item.libraryId || "").trim(),
          text: String(item.text || item.sentence || item.english || "").trim(),
          translation: String(item.translation || item.zh || item.cn || "").trim(),
          grammar: String(item.grammar || item.grammarAnalysis || "").trim(),
          grammarRaw: String(item.grammarRaw || item.aiGrammarResponse || item.grammar || item.grammarAnalysis || "").trim()
        };
      }
      return { id: "", libraryId: "", text: String(item || "").trim(), translation: "", grammar: "", grammarRaw: "" };
    }

    function sentenceText(item) {
      return normalizeSentenceItem(item).text;
    }

    function sentenceTranslation(item) {
      return normalizeSentenceItem(item).translation;
    }

    function sentenceGrammar(item) {
      return normalizeSentenceItem(item).grammar;
    }

    function sentenceGrammarRaw(item) {
      return normalizeSentenceItem(item).grammarRaw;
    }

    const grammarCacheStorageKey = "langLSRWGrammarCache";

    function loadGrammarCache() {
      try {
        const cached = JSON.parse(localStorage.getItem(grammarCacheStorageKey) || "[]");
        return Array.isArray(cached) ? cached : [];
      } catch {
        return [];
      }
    }

    function grammarCacheSentenceKey(sentence) {
      return String(sentence || "")
        .normalize("NFKC")
        .replace(/\s+/g, " ")
        .trim();
    }

    function grammarFrameworkFromContent(grammar) {
      try {
        const parsed = JSON.parse(String(grammar || "").trim());
        return String(parsed?.convention || "").startsWith("traditional-school/") ? "traditional" : "sieg2-cgel";
      } catch {
        return "sieg2-cgel";
      }
    }

    function findCachedGrammar(sentence) {
      const key = grammarCacheSentenceKey(sentence);
      const record = loadGrammarCache().find((item) => (
        item
        && grammarCacheSentenceKey(item.key || item.sentence) === key
        && (item.framework || grammarFrameworkFromContent(item.grammar)) === "traditional"
      ));
      if (!record || !String(record.grammar || "").trim()) return null;
      return {
        grammar: String(record.grammar).trim(),
        grammarRaw: String(record.grammarRaw || record.grammar).trim()
      };
    }

    function saveGrammarCache(sentence, grammar, grammarRaw = grammar) {
      const key = grammarCacheSentenceKey(sentence);
      const records = loadGrammarCache().filter((item) => (
        item && !(
          grammarCacheSentenceKey(item.key || item.sentence) === key
          && (item.framework || grammarFrameworkFromContent(item.grammar)) === "traditional"
        )
      ));
      records.unshift({
        key,
        sentence,
        framework: "traditional",
        grammar,
        grammarRaw,
        savedAt: new Date().toISOString()
      });
      storeGrammarCache(records);
      scheduleCloudSync();
    }

    function storeGrammarCache(records) {
      let retained = records.slice(0, 500);
      while (retained.length) {
        try {
          localStorage.setItem(grammarCacheStorageKey, JSON.stringify(retained));
          return;
        } catch {
          retained = retained.slice(0, Math.floor(retained.length / 2));
        }
      }
    }

    function sentenceWithCachedGrammar(item) {
      const normalized = normalizeSentenceItem(item);
      if (normalized.grammar && grammarFrameworkFromContent(normalized.grammar) === "traditional") {
        if (!findCachedGrammar(normalized.text)) {
          saveGrammarCache(normalized.text, normalized.grammar, normalized.grammarRaw || normalized.grammar);
        }
        return normalized;
      }
      const cached = findCachedGrammar(normalized.text);
      if (!cached) {
        normalized.grammar = "";
        normalized.grammarRaw = "";
        return normalized;
      }
      normalized.grammar = cached.grammar;
      normalized.grammarRaw = cached.grammarRaw;
      return normalized;
    }

    function normalizeSentenceList(items) {
      return (items || [])
        .map(normalizeSentenceItem)
        .filter((item) => item.text);
    }

    function collectBackupData() {
      const users = getKnownUsers();
      const histories = {};
      users.forEach((user) => {
        histories[user] = JSON.parse(localStorage.getItem(userStorageKey(user)) || "[]");
      });
      if (state.currentUser && !users.includes(state.currentUser)) {
        histories[state.currentUser] = state.history;
      }

      return {
        app: "langLSRW",
        version: 1,
        exportedAt: new Date().toISOString(),
        currentUser: state.currentUser,
        knownUsers: state.currentUser && !users.includes(state.currentUser)
          ? [state.currentUser, ...users]
          : users,
        currentIndex: state.index,
        sentences: normalizeSentenceList(state.sentences).map(sentenceWithCachedGrammar),
        histories
      };
    }

    function downloadJson(filename, data) {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    }

    async function exportData() {
      const date = new Date().toISOString().slice(0, 10);
      const username = isGoogleUser() ? (googleDrive.getProfile()?.email || "google") : (state.currentUser || "guest");
      const safeName = username.replace(/[^a-z0-9_-]+/gi, "_");
      const libraries = (await libraryStore.list(state.currentUser))
        .map(({ user, driveFileId, ...library }) => library);
      downloadJson(`langlsrw-${safeName}-${date}.json`, { ...collectBackupData(), libraries, progress: state.progress });
    }

    function restoreBackupData(data) {
      if (!data || !Array.isArray(data.sentences) || !data.histories || typeof data.histories !== "object") {
        alert("这个 JSON 文件不是有效的练习备份。");
        return;
      }

      const users = Array.isArray(data.knownUsers)
        ? data.knownUsers.map(normalizeUsername).filter(Boolean)
        : Object.keys(data.histories).map(normalizeUsername).filter(Boolean);
      const uniqueUsers = [...new Set(users)].slice(0, 8);
      const currentUser = normalizeUsername(data.currentUser || uniqueUsers[0] || state.currentUser);

      uniqueUsers.forEach((user) => {
        const history = Array.isArray(data.histories[user]) ? data.histories[user] : [];
        localStorage.setItem(userStorageKey(user), JSON.stringify(history.slice(0, 500)));
      });

      localStorage.setItem("langLSRWKnownUsers", JSON.stringify(uniqueUsers));
      if (currentUser) {
        state.currentUser = currentUser;
        localStorage.setItem("langLSRWCurrentUser", currentUser);
      }

      normalizeSentenceList(data.sentences).forEach((item) => {
        if (item.grammar) saveGrammarCache(item.text, item.grammar, item.grammarRaw || item.grammar);
      });
      restoreBackupLibraries(data).then(() => {
        updateUserBadge();
        hideLogin();
        return loadUserData();
      }).then(() => alert("数据已导入。"));
    }

    // Backups carry libraries (new format) or just the sentence list in use
    // (old format, imported as one library). Existing ids are overwritten.
    async function restoreBackupLibraries(data) {
      if (!state.currentUser) return;
      const now = new Date().toISOString();
      const libraries = Array.isArray(data.libraries) ? data.libraries : [];
      for (const library of libraries) {
        if (!library?.id || !Array.isArray(library.items)) continue;
        await libraryStore.put(state.currentUser, { ...library, updatedAt: now });
      }
      const legacy = normalizeSentenceList(data.sentences);
      if (!libraries.length && legacy.length) {
        await libraryStore.put(state.currentUser, {
          id: libraryStore.newId(),
          name: "备份导入",
          source: "JSON 备份",
          createdAt: now,
          updatedAt: now,
          items: legacy.map((item, index) => ({ id: String(index + 1), text: item.text, translation: item.translation }))
        });
      }
      if (data.progress && typeof data.progress === "object") {
        storeProgress({ ...data.progress, updatedAt: now });
      }
    }

    function renderLoginUsers() {
      const users = getKnownUsers();
      const loginUsers = $("loginUsers");
      if (!users.length) {
        loginUsers.innerHTML = '<span class="empty">还没有用户。</span>';
        return;
      }
      loginUsers.innerHTML = users.map((user) => (
        `<button class="user-chip" type="button" data-user="${escapeHtml(user)}">${escapeHtml(user)}</button>`
      )).join("");
    }

    function showLogin() {
      $("loginScreen").classList.add("active");
      renderGoogleLogin();
      $("usernameInput").value = state.currentUser || "";
      renderLoginUsers();
      setTimeout(() => $("usernameInput").focus(), 0);
    }

    function hideLogin() {
      $("loginScreen").classList.remove("active");
    }

    function loginAs(name) {
      const username = normalizeUsername(name);
      if (!username) return;
      const isNewUser = !getKnownUsers().includes(username);
      if (isNewUser) resetSettingsToDefault();
      state.currentUser = username;
      localStorage.setItem("langLSRWCurrentUser", username);
      saveKnownUser(username);
      updateUserBadge();
      hideLogin();
      loadUserData();
    }

    // ---- Google sign-in + Drive sync -------------------------------------
    // A Google account is a user named "google:<sub>". Its history is cached
    // in localStorage like a local user's and mirrored to one JSON file in the
    // account's Drive appDataFolder (see src/google-drive.js, src/cloud-sync.js).
    const settingsMetaKey = "langLSRWSettingsMeta";
    const cloud = { running: null, timer: 0, again: false };

    function settingsValues(source) {
      const values = {};
      cloudSync.SETTINGS_KEYS.forEach((key) => {
        values[key] = source[key] ?? null;
      });
      return values;
    }

    // Settings carry one "last changed" time; detect local edits by hashing.
    function localSettingsSnapshot() {
      const values = {};
      cloudSync.SETTINGS_KEYS.forEach((key) => {
        values[key] = localStorage.getItem(key);
      });
      const hash = JSON.stringify(values);
      let meta = null;
      try {
        meta = JSON.parse(localStorage.getItem(settingsMetaKey) || "null");
      } catch {}
      if (!meta) meta = { hash, updatedAt: new Date(0).toISOString() };
      else if (meta.hash !== hash) meta = { hash, updatedAt: new Date().toISOString() };
      localStorage.setItem(settingsMetaKey, JSON.stringify(meta));
      return { values, updatedAt: meta.updatedAt };
    }

    function applySyncedSettings(settings) {
      const values = settingsValues(settings.values || {});
      Object.entries(values).forEach(([key, value]) => {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      });
      localStorage.setItem(settingsMetaKey, JSON.stringify({ hash: JSON.stringify(values), updatedAt: settings.updatedAt }));
      state.shortcuts = loadShortcutSettings();
      state.speechSettings = JSON.parse(localStorage.getItem("langLSRWSpeechSettings") || "{}");
      loadSpeechSettings();
      populateVoices();
      renderShortcutSettings();
      applyFontSettings(loadStoredFontSettings(), { persist: false });
      applyGrammarColors(loadStoredGrammarColors(), { persist: false });
    }

    function setCloudStatus(kind, message) {
      const el = $("cloudStatus");
      el.dataset.status = kind;
      el.textContent = message;
    }

    async function syncWithCloud({ interactive = false } = {}) {
      if (!isGoogleUser()) return;
      if (cloud.running) {
        // Something changed mid-sync: run once more when this one finishes.
        cloud.again = true;
        return cloud.running;
      }
      clearTimeout(cloud.timer);
      const run = async () => {
        try {
          // GIS needs a user gesture to open its popup, so only a click reconnects.
          if (!googleDrive.hasToken()) {
            if (!interactive) {
              setCloudStatus("offline", "未连接：点「立即同步」连接 Google Drive");
              return;
            }
            await googleDrive.reconnect();
          }
          setCloudStatus("syncing", "正在同步…");
          const user = state.currentUser;
          const libraryChanges = await syncLibraries(user);
          if (user !== state.currentUser) return;

          const remote = await googleDrive.pull();
          const local = {
            history: state.history,
            grammarCache: loadGrammarCache(),
            settings: localSettingsSnapshot(),
            progress: state.progress || loadProgress()
          };
          const merged = cloudSync.merge(local, remote);
          if (user !== state.currentUser) return;

          state.history = merged.history;
          saveUserHistory();
          renderHistory();
          storeGrammarCache(merged.grammarCache);
          if (merged.settings !== local.settings) applySyncedSettings(merged.settings);
          if (merged.progress) storeProgress(merged.progress);

          await reloadLibraries();
          // Only move the practice view when something it shows changed.
          if (merged.progress !== local.progress || libraryChanges.has(state.activeLibraryId)
            || !state.libraries.some((item) => item.id === state.activeLibraryId)) {
            applyProgressToPractice();
          }

          if (!cloudSync.sameContent(merged, remote)) {
            await googleDrive.push({ ...merged, updatedAt: new Date().toISOString() });
          }
          const time = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
          setCloudStatus("synced", `已同步 · ${time}`);
        } catch (error) {
          if (error.code === "token_expired") {
            setCloudStatus("offline", "连接已过期：点「立即同步」重新连接");
          } else {
            setCloudStatus("error", `同步失败：${error.message}`);
          }
        }
      };
      // Clear the lock via .finally(): it always runs after this assignment,
      // even when run() returns without awaiting anything.
      cloud.running = run().finally(() => {
        cloud.running = null;
        if (cloud.again) {
          cloud.again = false;
          scheduleCloudSync(0);
        }
      });
      return cloud.running;
    }

    // Returns the ids of local libraries whose content or existence changed.
    async function syncLibraries(user) {
      const local = await libraryStore.list(user);
      const tombstones = loadTombstones();
      const plan = cloudSync.planLibrarySync({ local, remote: await googleDrive.listLibraries(), tombstones });
      const localById = new Map(local.map((library) => [library.id, library]));
      const changed = new Set();

      for (const fileId of plan.trashRemote) await googleDrive.trashFile(fileId);
      for (const id of plan.deleteLocal) {
        await libraryStore.remove(user, id);
        changed.add(id);
      }
      for (const { id, name, fileId } of plan.rename) {
        await libraryStore.put(user, { ...localById.get(id), name, driveFileId: fileId });
      }
      for (const file of plan.download) {
        const existing = localById.get(file.libraryId);
        await libraryStore.put(user, {
          id: file.libraryId,
          name: file.name,
          source: existing?.source || "Google Drive",
          language: file.language || existing?.language || "en",
          createdAt: existing?.createdAt || file.updatedAt,
          updatedAt: file.updatedAt,
          items: parseTsvLibrary(await googleDrive.downloadLibrary(file.fileId), { hasIdColumn: true }),
          driveFileId: file.fileId
        });
        changed.add(file.libraryId);
      }
      for (const { library, fileId } of plan.upload) {
        const { user: _owner, ...record } = library;
        const driveFileId = await googleDrive.uploadLibrary(fileId, record, cloudSync.libraryToTsv(record.items));
        // Re-read: the user may have edited this library while it uploaded.
        const latest = await libraryStore.get(user, library.id);
        if (latest) await libraryStore.put(user, { ...latest, driveFileId });
      }
      const remaining = loadTombstones().filter((id) => !tombstones.includes(id));
      localStorage.setItem(tombstoneKey(user), JSON.stringify(remaining));
      return changed;
    }

    function scheduleCloudSync(delay = 4000) {
      if (!isGoogleUser() || !googleDrive.hasToken()) return;
      clearTimeout(cloud.timer);
      cloud.timer = setTimeout(() => syncWithCloud(), delay);
    }

    async function loginWithGoogle() {
      const button = $("googleLoginBtn");
      button.disabled = true;
      try {
        const profile = await googleDrive.signIn({ selectAccount: true });
        const previousUser = state.currentUser;
        const googleUser = `${googleUserPrefix}${profile.sub}`;
        let guestHistory = [];
        let guestLibraries = [];
        if (previousUser && !isGoogleUser(previousUser)) {
          const history = JSON.parse(localStorage.getItem(userStorageKey(previousUser)) || "[]");
          const libraries = await libraryStore.list(previousUser).catch(() => []);
          const parts = [
            libraries.length ? `${libraries.length} 个句库` : "",
            history.length ? `${history.length} 条练习记录` : ""
          ].filter(Boolean).join("和");
          if (parts && confirm(`把本机用户「${previousUser}」的${parts}导入 Google 账号（${profile.email}）吗？\n句库会上传到你的 Google Drive；本机用户本身会保留。`)) {
            guestHistory = history;
            guestLibraries = libraries;
          }
        }
        state.currentUser = googleUser;
        localStorage.setItem("langLSRWCurrentUser", googleUser);
        for (const { user, driveFileId, ...library } of guestLibraries) {
          await libraryStore.put(googleUser, { ...library, updatedAt: new Date().toISOString() });
        }
        if (guestLibraries.length) {
          // Carry the guest's place too; stamped now so it wins the first sync.
          const guestProgress = localStorage.getItem(progressKey(previousUser));
          if (guestProgress) {
            localStorage.setItem(progressKey(googleUser), JSON.stringify({ ...JSON.parse(guestProgress), updatedAt: new Date().toISOString() }));
          }
        }
        loadUserHistory();
        if (guestHistory.length) {
          state.history = cloudSync.mergeHistory(state.history, guestHistory);
          saveUserHistory();
        }
        updateUserBadge();
        hideLogin();
        await loadUserData();
        await syncWithCloud();
      } catch (error) {
        alert(error.message || "Google 登录失败。");
      } finally {
        button.disabled = !googleDrive.isConfigured();
      }
    }

    function renderGoogleLogin() {
      const configured = googleDrive.isConfigured();
      $("googleLoginBtn").disabled = !configured;
      $("googleLoginNote").textContent = configured
        ? "练习记录、设置和 AI 语法缓存会同步到你自己的 Google Drive（隐藏的应用数据目录），换设备登录即可继续。"
        : "Google 登录尚未配置（需要在 index.html 填写 OAuth Client ID，见 deploy/README.md）。";
    }

    function clearCurrentUser() {
      const username = state.currentUser;
      if (!username) {
        showLogin();
        return;
      }
      const confirmed = confirm(isGoogleUser(username)
        ? "确定退出 Google 登录并清除本机缓存吗？Google Drive 里的云端数据不受影响。"
        : `确定清除用户「${username}」吗？这个用户的本机练习记录会被删除。`);
      if (!confirmed) return;

      localStorage.removeItem(userStorageKey(username));
      localStorage.removeItem(progressKey(username));
      localStorage.removeItem(tombstoneKey(username));
      libraryStore.removeAll(username).catch(() => {});
      state.libraries = [];
      showActiveLibrary(null);
      const users = getKnownUsers().filter((user) => user !== username);
      localStorage.setItem("langLSRWKnownUsers", JSON.stringify(users));
      localStorage.removeItem("langLSRWCurrentUser");
      state.currentUser = "";
      state.history = [];
      if (isGoogleUser(username)) googleDrive.signOut();
      resetSettingsToDefault();
      updateUserBadge();
      renderHistory();
      closeTopMenus();
      showLogin();
    }

    function cleanSentenceLine(line) {
      return line
        .replace(/^\s*\d+[\).]\s*/, "")
        .trim();
    }

    function cleanLrcLine(line) {
      const trimmed = line.trim();
      if (!trimmed) return "";
      if (/^\[(ti|ar|al|by|offset|length|re):/i.test(trimmed)) return "";
      return trimmed
        .replace(/(?:\[\d{1,2}:\d{2}(?:[.:]\d{1,3})?\])+/g, "")
        .replace(/^\s*[-–—]\s*/, "")
        .trim();
    }

    function hasCjk(text) {
      return /[\u3400-\u9fff]/.test(text || "");
    }

    function splitInlineTranslation(line) {
      const patterns = [
        /^(.+?)\s*(?:\|\||\t|=>|->|：|:)\s*([\u3400-\u9fff].*)$/,
        /^(.+?)\s{2,}([\u3400-\u9fff].*)$/
      ];
      for (const pattern of patterns) {
        const match = line.match(pattern);
        if (match && match[1].trim() && match[2].trim()) {
          return { text: match[1].trim(), translation: match[2].trim() };
        }
      }
      return null;
    }

    // Tab-separated libraries. Two shapes are accepted:
    //   id<TAB>sentence<TAB>translation   our Drive format and the old built-in library
    //   sentence<TAB>translation[<TAB>…]  Anki / manythings.org / Tatoeba exports
    // hasIdColumn: true for our own Drive files (never guessed, so a download
    // round-trips exactly); undefined for user imports, where it is detected.
    function parseTsvLibrary(text, { hasIdColumn } = {}) {
      const rows = String(text || "")
        .replace(/^\uFEFF/, "")
        .split(/\r?\n/)
        .map((line) => line.split("\t").map((column) => column.trim()))
        .filter((columns) => columns.length >= 2 && columns.some(Boolean));
      const withId = hasIdColumn ?? detectIdColumn(rows);
      const byText = new Map();
      rows.forEach((columns) => {
        const [id, sentence, translation] = withId ? columns : ["", columns[0], columns[1]];
        if (!sentence) return;
        const existing = byText.get(sentence);
        if (!existing) {
          byText.set(sentence, { id: id || "", text: sentence, translation: translation || "" });
        } else if (translation && !existing.translation.split(" / ").includes(translation)) {
          // Same sentence listed with several translations (common in Anki decks).
          existing.translation = existing.translation ? `${existing.translation} / ${translation}` : translation;
        }
      });
      return [...byText.values()];
    }

    function detectIdColumn(rows) {
      const sample = rows.slice(0, 200);
      const numericFirst = sample.filter((columns) => columns.length >= 3 && /^\d+$/.test(columns[0])).length;
      return sample.length > 0 && numericFirst >= sample.length * 0.8;
    }

    function looksLikeTsvLibrary(text) {
      const lines = String(text || "").split(/\r?\n/).filter((line) => line.trim()).slice(0, 200);
      return lines.length > 0 && lines.filter((line) => line.includes("\t")).length >= lines.length * 0.8;
    }

    function parseLibraryText(text, filename = "") {
      return looksLikeTsvLibrary(text) ? parseTsvLibrary(text) : parseSentences(text, filename);
    }

    function parseSentences(text, filename = "") {
      const looksLikeLrc = /\.lrc$/i.test(filename) || /\[\d{1,2}:\d{2}(?:[.:]\d{1,3})?\]/.test(text);
      const lines = text
        .split(/\r?\n/)
        .map((line) => looksLikeLrc ? cleanLrcLine(line) : cleanSentenceLine(line))
        .filter(Boolean);

      const items = [];
      lines.forEach((line) => {
        const inlinePair = splitInlineTranslation(line);
        if (inlinePair) {
          items.push(inlinePair);
          return;
        }

        if (hasCjk(line)) {
          const previous = items[items.length - 1];
          if (previous && !previous.translation) previous.translation = line;
          return;
        }

        items.push({ text: line, translation: "" });
      });

      const seen = new Set();
      return items.filter((item) => {
        const key = item.text.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    function closeLibraryModal() {
      $("libraryModal").hidden = true;
    }

    function libraryFilteredItems() {
      const query = state.library.query.toLocaleLowerCase();
      if (!query) return state.library.items;
      return state.library.items.filter((item) => (
        item.id.toLocaleLowerCase().includes(query)
        || item.text.toLocaleLowerCase().includes(query)
        || item.translation.toLocaleLowerCase().includes(query)
      ));
    }

    function renderLibraryPage() {
      const library = state.library;
      const items = library.filteredItems;
      const pageCount = items.length ? Math.ceil(items.length / library.pageSize) : 0;
      library.page = pageCount ? Math.min(library.page, pageCount - 1) : 0;
      const start = library.page * library.pageSize;
      const visibleItems = items.slice(start, start + library.pageSize);

      $("librarySentenceList").innerHTML = visibleItems.length
        ? visibleItems.map((item) => `
          <div class="library-sentence-row">
            <span class="library-sentence-id">${escapeHtml(item.id)}</span>
            <span class="library-sentence-english">${escapeHtml(item.text)}</span>
            <span class="library-sentence-translation">${escapeHtml(item.translation)}</span>
          </div>
        `).join("")
        : '<div class="empty">没有找到匹配的句子。</div>';
      $("libraryStatus").textContent = library.query
        ? `找到 ${items.length.toLocaleString()} 条，显示第 ${items.length ? start + 1 : 0}-${Math.min(start + library.pageSize, items.length)} 条`
        : `共 ${items.length.toLocaleString()} 条，显示第 ${items.length ? start + 1 : 0}-${Math.min(start + library.pageSize, items.length)} 条`;
      $("libraryPageInput").value = pageCount ? library.page + 1 : 0;
      $("libraryPageInput").max = Math.max(1, pageCount);
      $("libraryPageInput").disabled = !pageCount;
      $("libraryPageCount").textContent = `/ ${pageCount} 页`;
      $("libraryFirstPageBtn").disabled = library.page <= 0;
      $("libraryPreviousPageBtn").disabled = library.page <= 0;
      $("libraryNextPageBtn").disabled = !pageCount || library.page >= pageCount - 1;
      $("libraryLastPageBtn").disabled = !pageCount || library.page >= pageCount - 1;
    }

    function goToLibraryPage(pageIndex) {
      const pageCount = Math.ceil(state.library.filteredItems.length / state.library.pageSize);
      if (!pageCount) return;
      state.library.page = Math.max(0, Math.min(Number(pageIndex) || 0, pageCount - 1));
      renderLibraryPage();
      $("librarySentenceList").scrollTop = 0;
    }

    function goToEnteredLibraryPage() {
      const enteredPage = Number.parseInt($("libraryPageInput").value, 10);
      goToLibraryPage(Number.isFinite(enteredPage) ? enteredPage - 1 : state.library.page);
    }

    function filterLibrary() {
      state.library.query = $("librarySearchInput").value.trim();
      state.library.page = 0;
      state.library.filteredItems = libraryFilteredItems();
      renderLibraryPage();
    }

    // ---- Learning languages ------------------------------------------------
    // Each library has the language of its practice sentences; read-aloud,
    // voices and speech recognition follow it. Translations are free-form.
    const learningLanguages = {
      en: { label: "英语", accents: [["en-GB", "英音"], ["en-US", "美音"]], words: ["the", "is", "you", "i", "to", "a", "and", "it", "of", "that", "what", "this", "are", "do"] },
      es: { label: "西班牙语", accents: [["es-ES", "西班牙"], ["es-MX", "墨西哥"]], words: ["el", "la", "que", "de", "es", "no", "y", "en", "un", "una", "lo", "los", "por", "qué", "está"] },
      fr: { label: "法语", accents: [["fr-FR", "法国"], ["fr-CA", "加拿大"]], words: ["le", "la", "les", "est", "je", "vous", "pas", "de", "et", "un", "une", "que", "il", "ce"] },
      de: { label: "德语", accents: [["de-DE", "德国"]], words: ["der", "die", "das", "ist", "ich", "nicht", "und", "sie", "ein", "zu", "du", "es", "wir"] },
      it: { label: "意大利语", accents: [["it-IT", "意大利"]], words: ["il", "è", "che", "di", "non", "un", "la", "sono", "ho", "per", "mi", "ti", "lo"] },
      pt: { label: "葡萄牙语", accents: [["pt-BR", "巴西"], ["pt-PT", "葡萄牙"]], words: ["o", "a", "que", "não", "de", "é", "um", "eu", "você", "em", "se", "uma", "os"] }
    };

    function languageOf(library) {
      return learningLanguages[library?.language] ? library.language : "en";
    }

    function activeLanguage() {
      return languageOf(state.libraries.find((item) => item.id === state.activeLibraryId));
    }

    // Guess from function words in a sample; ties and unknowns fall back to English.
    function detectLanguage(items) {
      const scores = Object.fromEntries(Object.keys(learningLanguages).map((code) => [code, 0]));
      const sets = Object.entries(learningLanguages).map(([code, info]) => [code, new Set(info.words)]);
      items.slice(0, 400).forEach((item) => {
        (String(item.text).toLowerCase().match(wordPattern()) || []).forEach((word) => {
          sets.forEach(([code, words]) => {
            if (words.has(word)) scores[code] += 1;
          });
        });
      });
      const [best, score] = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
      return score > scores.en ? best : "en";
    }

    // Accent choices depend on the active library's language; the chosen accent
    // is remembered per language.
    function renderAccentOptions() {
      const language = activeLanguage();
      const { accents } = learningLanguages[language];
      const remembered = state.speechSettings.accents?.[language]
        || (accents.some(([value]) => value === state.speechSettings.accent) ? state.speechSettings.accent : "");
      const select = $("accentSelect");
      select.innerHTML = accents.map(([value, label]) => `<option value="${value}">${label}</option>`).join("");
      select.value = accents.some(([value]) => value === remembered) ? remembered : accents[0][0];
      select.title = `朗读与识别：${learningLanguages[language].label}`;
    }

    // ---- Sentence libraries + training progress ---------------------------
    // Libraries live in IndexedDB per user (src/library-store.js). For a Google
    // user they mirror langLSRW/libraries/*.tsv in Drive; progress (active
    // library, position per library, mode) rides in the main sync document.
    const libraryStore = window.langLSRWLibraryStore;

    function progressKey(user = state.currentUser) {
      return `langLSRWProgress:${user}`;
    }

    function tombstoneKey(user = state.currentUser) {
      return `langLSRWLibraryTombstones:${user}`;
    }

    function loadProgress() {
      try {
        const saved = JSON.parse(localStorage.getItem(progressKey()) || "null");
        if (saved && typeof saved === "object") return { positions: {}, ...saved };
      } catch {}
      return { activeLibraryId: "", positions: {}, mode: "ordered", updatedAt: new Date(0).toISOString() };
    }

    function storeProgress(progress) {
      state.progress = progress;
      if (state.currentUser) localStorage.setItem(progressKey(), JSON.stringify(progress));
    }

    function saveProgress() {
      if (!state.currentUser) return;
      const positions = { ...(state.progress?.positions || {}) };
      if (state.activeLibraryId) positions[state.activeLibraryId] = state.index;
      storeProgress({
        activeLibraryId: state.activeLibraryId,
        positions,
        mode: $("modeSelect").value,
        updatedAt: new Date().toISOString()
      });
      scheduleCloudSync();
    }

    function loadTombstones() {
      try {
        return JSON.parse(localStorage.getItem(tombstoneKey()) || "[]");
      } catch {
        return [];
      }
    }

    function libraryMeta(library) {
      const translated = library.items.filter((item) => item.translation).length;
      return `${library.items.length.toLocaleString()} 句 · ${translated.toLocaleString()} 句有翻译`;
    }

    async function reloadLibraries() {
      state.libraries = await libraryStore.list(state.currentUser);
      if (!$("libraryModal").hidden) renderLibraryModal();
    }

    function showActiveLibrary(library, index = 0) {
      state.activeLibraryId = library ? library.id : "";
      state.sentences = library ? normalizeSentenceList(library.items) : [];
      state.index = state.sentences.length ? Math.min(Math.max(0, Number(index) || 0), state.sentences.length - 1) : 0;
      $("sourceStatus").textContent = library
        ? `当前句库：${library.name}（${learningLanguages[languageOf(library)].label} · ${libraryMeta(library)}）`
        : "还没有句库：打开「句库」导入。";
      renderAccentOptions();
      populateVoices();
    }

    // Put the practice view where the progress says (after login, reload or sync).
    function applyProgressToPractice() {
      const progress = state.progress || loadProgress();
      if (["ordered", "random", "mistakes"].includes(progress.mode)) $("modeSelect").value = progress.mode;
      const library = state.libraries.find((item) => item.id === progress.activeLibraryId) || state.libraries[0] || null;
      showActiveLibrary(library, library ? progress.positions?.[library.id] : 0);
      resetCurrent();
    }

    async function loadUserData() {
      loadUserHistory();
      state.progress = loadProgress();
      try {
        await reloadLibraries();
      } catch (error) {
        state.libraries = [];
        $("sourceStatus").textContent = `读取本机句库失败：${error.message || error}`;
      }
      applyProgressToPractice();
    }

    function useLibrary(id) {
      const library = state.libraries.find((item) => item.id === id);
      if (!library) return;
      if (state.activeLibraryId) saveProgress();
      showActiveLibrary(library, state.progress?.positions?.[id]);
      saveProgress();
      closeLibraryModal();
      resetCurrent(true);
    }

    async function createLibrary({ name, source, items }) {
      if (!state.currentUser) {
        alert("请先登录或选择本机用户，再导入句库。");
        return null;
      }
      const now = new Date().toISOString();
      const library = await libraryStore.put(state.currentUser, {
        id: libraryStore.newId(),
        name: String(name || "未命名句库").trim().slice(0, 80) || "未命名句库",
        source: source || "",
        language: detectLanguage(items),
        createdAt: now,
        updatedAt: now,
        items: items.map((item, index) => ({
          id: String(item.id || index + 1),
          text: item.text,
          translation: item.translation || ""
        }))
      });
      await reloadLibraries();
      useLibrary(library.id);
      scheduleCloudSync(500);
      return library;
    }

    async function renameLibrary(id) {
      const library = state.libraries.find((item) => item.id === id);
      if (!library) return;
      const name = prompt("句库名称", library.name)?.trim();
      if (!name || name === library.name) return;
      await libraryStore.put(state.currentUser, { ...library, name: name.slice(0, 80), updatedAt: new Date().toISOString() });
      await reloadLibraries();
      if (state.activeLibraryId === id) showActiveLibrary(state.libraries.find((item) => item.id === id), state.index);
      scheduleCloudSync(500);
    }

    async function setLibraryLanguage(id, language) {
      const library = state.libraries.find((item) => item.id === id);
      if (!library || !learningLanguages[language] || languageOf(library) === language) return;
      await libraryStore.put(state.currentUser, { ...library, language, updatedAt: new Date().toISOString() });
      await reloadLibraries();
      if (state.activeLibraryId === id) {
        showActiveLibrary(state.libraries.find((item) => item.id === id), state.index);
        resetCurrent();
      }
      scheduleCloudSync(500);
    }

    async function deleteLibrary(id) {
      const library = state.libraries.find((item) => item.id === id);
      if (!library) return;
      const where = isGoogleUser() ? "本机和 Google Drive 里的" : "本机的";
      if (!confirm(`确定删除句库「${library.name}」吗？${where}这个句库都会删除（Drive 里的文件会移到回收站）。`)) return;
      await libraryStore.remove(state.currentUser, id);
      if (library.driveFileId) {
        localStorage.setItem(tombstoneKey(), JSON.stringify([...new Set([...loadTombstones(), id])]));
      }
      const positions = { ...(state.progress?.positions || {}) };
      delete positions[id];
      state.progress = { ...state.progress, positions };
      await reloadLibraries();
      if (state.activeLibraryId === id) {
        showActiveLibrary(state.libraries[0] || null, state.libraries[0] ? positions[state.libraries[0].id] : 0);
        resetCurrent();
      }
      saveProgress();
      scheduleCloudSync(500);
    }

    // Keep an edit to the current sentence (e.g. a translation) in its library.
    async function persistCurrentSentence() {
      const library = state.libraries.find((item) => item.id === state.activeLibraryId);
      const item = normalizeSentenceItem(state.sentences[state.index]);
      if (!library || !library.items[state.index]) return;
      const items = library.items.slice();
      items[state.index] = { ...items[state.index], translation: item.translation };
      await libraryStore.put(state.currentUser, { ...library, items, updatedAt: new Date().toISOString() });
      await reloadLibraries();
      scheduleCloudSync();
    }

    function selectLibraryInModal(id) {
      const library = state.libraries.find((item) => item.id === id) || null;
      state.library.selectedId = library ? library.id : "";
      state.library.items = library ? normalizeSentenceList(library.items) : [];
      state.library.query = "";
      state.library.page = 0;
      $("librarySearchInput").value = "";
      state.library.filteredItems = state.library.items;
      renderLibraryModal();
    }

    function renderLibraryModal() {
      $("libraryStorageNote").textContent = isGoogleUser()
        ? "保存在你的 Google Drive「langLSRW/libraries」文件夹，可以在 Drive 里改名、下载或删除。"
        : "游客模式：句库只保存在这台设备的浏览器里。登录 Google 后可以导入 Drive。";
      const selected = state.libraries.find((item) => item.id === state.library.selectedId) || null;
      $("libraryList").innerHTML = state.libraries.length
        ? state.libraries.map((library) => `
          <button class="library-type-button ${library.id === state.library.selectedId ? "is-active" : ""}" type="button" data-library-id="${escapeHtml(library.id)}">
            <span>${escapeHtml(library.name)}</span>
            <small>${library.items.length.toLocaleString()} 句${library.id === state.activeLibraryId ? " · 练习中" : ""}</small>
          </button>`).join("")
        : '<div class="small-note">还没有句库。</div>';
      $("libraryEmpty").hidden = Boolean(selected);
      $("libraryDetail").hidden = !selected;
      if (!selected) return;
      $("libraryName").textContent = selected.name;
      const cloud = isGoogleUser() ? (selected.driveFileId ? " · 已存到 Google Drive" : " · 等待同步到 Google Drive") : " · 仅保存在本机";
      $("libraryMeta").textContent = `${libraryMeta(selected)}${selected.source ? ` · 来源 ${selected.source}` : ""}${cloud}`;
      $("useLibraryBtn").textContent = selected.id === state.activeLibraryId ? "继续练习" : "使用此句库";
      $("libraryLanguageSelect").value = languageOf(selected);
      renderLibraryPage();
    }

    async function openLibraryModal() {
      closeTopMenus();
      clearPeekedWord();
      if (state.speaking.holdActive) scheduleStopSpeakingPractice();
      $("libraryModal").hidden = false;
      await reloadLibraries();
      selectLibraryInModal(state.library.selectedId && state.libraries.some((item) => item.id === state.library.selectedId)
        ? state.library.selectedId
        : state.activeLibraryId || state.libraries[0]?.id || "");
      if (state.libraries.length) $("librarySearchInput").focus();
    }

    async function importSentenceFile(file) {
      if (!file) return false;
      if (!/\.(txt|lrc|tsv)$/i.test(file.name) && !/^text\//i.test(file.type || "")) {
        alert("请导入 .txt、.lrc 或 .tsv 文件。");
        return false;
      }
      const sentences = parseLibraryText(await file.text(), file.name);
      if (!sentences.length) {
        alert("没有识别到可练习的句子。");
        return false;
      }
      closeTopMenus();
      const library = await createLibrary({
        name: file.name.replace(/\.(txt|lrc|tsv)$/i, ""),
        source: file.name,
        items: sentences
      });
      return Boolean(library);
    }

    function currentSentence() {
      return sentenceText(state.sentences[state.index]);
    }

    function currentTranslation() {
      return sentenceTranslation(state.sentences[state.index]);
    }

    function saveCurrentTranslation() {
      const item = normalizeSentenceItem(state.sentences[state.index]);
      item.translation = $("translationInput").value.trim();
      state.sentences[state.index] = item;
      renderTarget();
      persistCurrentSentence();
      $("sourceStatus").textContent = "当前句翻译已保存到句库。";
    }

    function currentGrammar() {
      const item = sentenceWithCachedGrammar(state.sentences[state.index]);
      state.sentences[state.index] = item;
      return item.grammar;
    }

    function currentGrammarRaw() {
      currentGrammar();
      return sentenceGrammarRaw(state.sentences[state.index]);
    }

    function openAiTextModal(title, text) {
      $("aiTextModalTitle").textContent = title;
      $("aiTextModalBody").value = text;
      $("aiTextModal").hidden = false;
      setTimeout(() => {
        $("aiTextModalBody").focus();
        $("aiTextModalBody").select();
      }, 0);
    }

    function closeAiTextModal() {
      $("aiTextModal").hidden = true;
    }

    async function copyAiText() {
      const text = $("aiTextModalBody").value;
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        $("copyAiTextBtn").textContent = "已复制";
        setTimeout(() => {
          $("copyAiTextBtn").textContent = "复制";
        }, 1200);
      } catch {
        $("aiTextModalBody").focus();
        $("aiTextModalBody").select();
      }
    }

    function formatAiResponseForDisplay(text) {
      const raw = String(text || "").trim();
      if (!raw) return "";
      const jsonText = raw
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, "")
        .trim();
      try {
        return JSON.stringify(JSON.parse(jsonText), null, 2);
      } catch {
        return raw;
      }
    }

    function showCurrentAiResponse() {
      const raw = currentGrammarRaw();
      if (!raw) {
        alert("当前句还没有 Ai 语法分析回复。");
        return;
      }
      openAiTextModal("Ai回复", formatAiResponseForDisplay(raw));
    }

    function showCurrentAiPrompt() {
      const sentence = currentSentence();
      if (!sentence) {
        alert("当前没有可分析的句子。");
        return;
      }
      openAiTextModal("Ai询问", buildGrammarPrompt(sentence, currentTranslation()));
    }

    let aiTextContextKind = "";

    function closeAiTextContextMenu() {
      $("aiTextContextMenu").hidden = true;
      aiTextContextKind = "";
    }

    function openAiTextContextMenu(event, kind) {
      event.preventDefault();
      closeGrammarContextMenu();
      closeTopMenus();
      aiTextContextKind = kind;
      const menu = $("aiTextContextMenu");
      const buttonRect = event.currentTarget.getBoundingClientRect();
      menu.hidden = false;
      const menuRect = menu.getBoundingClientRect();
      const requestedX = event.clientX || buttonRect.left;
      const requestedY = event.clientY || buttonRect.bottom;
      menu.style.left = `${Math.max(8, Math.min(requestedX, window.innerWidth - menuRect.width - 8))}px`;
      menu.style.top = `${Math.max(8, Math.min(requestedY, window.innerHeight - menuRect.height - 8))}px`;
      $("copyAiContextBtn").focus();
    }

    async function copyAiContextText() {
      const kind = aiTextContextKind;
      closeAiTextContextMenu();
      const sentence = currentSentence();
      const raw = kind === "prompt"
        ? (sentence ? buildGrammarPrompt(sentence, currentTranslation()) : "")
        : currentGrammarRaw();
      if (!raw) {
        alert(kind === "prompt" ? "当前没有可复制的 Ai 询问。" : "当前句还没有 Ai 语法分析回复。");
        return;
      }
      const text = kind === "response" ? formatAiResponseForDisplay(raw) : raw;
      try {
        await navigator.clipboard.writeText(text);
        $("sourceStatus").textContent = kind === "prompt" ? "已复制 Ai 询问。" : "已复制 Ai 回复。";
      } catch {
        openAiTextModal(kind === "prompt" ? "Ai询问" : "Ai回复", text);
      }
    }

    function renderGrammarAnalysis() {
      if (state.grammarLoading) {
        return '<div class="grammar-panel is-loading">正在分析语法...</div>';
      }
      if (!state.grammarVisible) return "";
      const grammar = currentGrammar();
      if (!grammar) return '<div class="grammar-panel grammar-visual"><div class="grammar-toolbar"><div class="grammar-pattern"><span>句子成分</span></div></div><div class="grammar-empty">当前体系暂无分析</div></div>';
      const parsed = parseGrammarAnalysis(grammar);
      if (!parsed) return `<div class="grammar-panel">${escapeHtml(grammar).replace(/\n/g, "<br>")}</div>`;
      const nodes = Array.isArray(parsed.nodes) ? parsed.nodes : [];
      const nodeHtml = renderGrammarNodes(nodes);
      const explanation = Array.isArray(parsed.explanation) ? parsed.explanation : [];
      const explanationHtml = explanation.length
        ? `<ul class="grammar-points">${explanation.map((item) => `<li>${escapeHtml(String(item))}</li>`).join("")}</ul>`
        : "";
      const pattern = String(parsed.pattern || "")
        .trim()
        .replace(/（/g, "(")
        .replace(/）/g, ")")
        .replace(/\s*\+\s*/g, " + ");
      const provenance = grammarAnalysisProvenance(parsed);
      const analysisLabel = `句子成分${provenance.legacy ? " · 旧版" : ""}${parsed.status === "partial" ? " · 部分分析" : ""}`;
      const patternHtml = pattern
        ? `<div class="grammar-pattern"><span title="${escapeHtml(provenance.label)}">${analysisLabel}</span><span aria-hidden="true">·</span><strong>${escapeHtml(pattern)}</strong></div>`
        : `<div class="grammar-pattern"><span title="${escapeHtml(provenance.label)}">${analysisLabel}</span></div>`;
      const levels = [["main", "主干"], ["level1", "一级"], ["all", "全部"]];
      const levelControls = levels.map(([value, label]) => `
        <button type="button" class="grammar-level-btn ${state.grammarExpansionMode === value ? "is-active" : ""}"
          data-grammar-level="${value}" aria-pressed="${state.grammarExpansionMode === value}">${label}</button>
      `).join("");
      return `
        <div class="grammar-panel grammar-visual">
          <div class="grammar-toolbar">
            ${patternHtml}
            <div class="grammar-levels" role="group" aria-label="语法节点展开层级">${levelControls}</div>
          </div>
          <div class="grammar-nodes">${nodeHtml}</div>
          ${explanationHtml}
        </div>
      `;
    }

    function normalizeGrammarNodes(nodes) {
      if (!Array.isArray(nodes)) return [];
      return nodes
        .map((node, index) => ({
          id: Number(node.id),
          parent: Number(node.parent || 0),
          role: String(node.role || "其他").trim() || "其他",
          type: typeof node.type === "string" ? node.type.trim() : "",
          text: String(node.text || "").trim(),
          note: String(node.note || "").trim(),
          order: index
        }))
        .filter((node) => Number.isFinite(node.id) && node.id > 0 && node.text);
    }

    function renderGrammarNodes(nodes) {
      const normalized = normalizeGrammarNodes(nodes);
      if (!normalized.length) return "";
      const byParent = new Map();
      normalized.forEach((node) => {
        const parent = normalized.some((item) => item.id === node.parent) ? node.parent : 0;
        if (!byParent.has(parent)) byParent.set(parent, []);
        byParent.get(parent).push(node);
      });
      byParent.forEach((items) => items.sort((a, b) => a.order - b.order));
      const renderNode = (node, depth = 0) => {
        const roleType = grammarRoleType(node.role);
        const label = [node.role, node.type].filter(Boolean).join(" · ");
        const children = byParent.get(node.id) || [];
        const isExpanded = children.length && state.grammarExpandedNodeIds.has(node.id);
        const details = [node.note].filter(Boolean);
        const content = `
          <span class="grammar-role">${escapeHtml(label)}</span>
          <span class="grammar-text">${escapeHtml(node.text)}</span>
        `;
        return `
          <div class="grammar-node grammar-${roleType} ${children.length ? "has-children" : ""} ${isExpanded ? "is-expanded" : ""}" data-grammar-node-id="${node.id}" data-depth="${depth}">
            <div class="grammar-node-heading">
              ${children.length
                ? `<button type="button" class="grammar-node-content" data-grammar-toggle="${node.id}" aria-expanded="${Boolean(isExpanded)}" aria-label="${isExpanded ? "收起" : "展开"}${escapeHtml(node.text)}">${content}</button>`
                : `<div class="grammar-node-content">${content}</div>`}
            </div>
            ${details.length
              ? `<div class="grammar-node-details">${node.note ? `<span>${escapeHtml(node.note)}</span>` : ""}</div>`
              : ""}
            ${isExpanded ? `<div class="grammar-node-children">${children.map((child) => renderNode(child, depth + 1)).join("")}</div>` : ""}
          </div>
        `;
      };
      return (byParent.get(0) || normalized.filter((node) => node.parent === 0)).map(renderNode).join("");
    }

    function setGrammarExpansion(mode) {
      const parsed = parseGrammarAnalysis(currentGrammar());
      const nodes = normalizeGrammarNodes(parsed?.nodes);
      const parentIds = new Set(nodes.map((node) => node.parent).filter((id) => id > 0));
      const next = new Set();
      if (mode === "level1") {
        nodes.filter((node) => node.parent === 0 && parentIds.has(node.id)).forEach((node) => next.add(node.id));
      } else if (mode === "all") {
        parentIds.forEach((id) => next.add(id));
      }
      state.grammarExpansionMode = mode;
      state.grammarExpandedNodeIds = next;
      renderTarget();
    }

    function resetGrammarInteraction() {
      state.grammarExpansionMode = "main";
      state.grammarExpandedNodeIds = new Set();
    }

    function parseGrammarAnalysis(text) {
      const raw = String(text || "").trim();
      if (!raw) return null;
      const cleaned = raw
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      const start = cleaned.indexOf("{");
      const end = cleaned.lastIndexOf("}");
      if (start < 0 || end <= start) return null;
      try {
        const parsed = JSON.parse(cleaned.slice(start, end + 1));
        if (!parsed) return null;
        if (Array.isArray(parsed.nodes)) return parsed;
        if (Array.isArray(parsed.chunks)) {
          return {
            pattern: parsed.pattern || "",
            nodes: parsed.chunks.map((chunk, index) => ({
              id: index + 1,
              text: chunk.text,
              role: chunk.role,
              parent: 0,
              note: chunk.note
            })),
            explanation: parsed.explanation || []
          };
        }
        return null;
      } catch {
        return null;
      }
    }

    function grammarAnalysisProvenance(parsed) {
      const convention = typeof parsed?.convention === "string" ? parsed.convention : "";
      const schemaVersion = Number.isInteger(parsed?.schemaVersion) ? parsed.schemaVersion : null;
      if (!convention || !schemaVersion) return { legacy: true, label: "旧版分析：未记录分析规范或数据版本" };
      return { legacy: false, label: `分析规范：${convention}；数据版本：${schemaVersion}` };
    }

    function grammarRoleType(role) {
      const text = String(role || "");
      const traditionalRoles = {
        "主语": "subject", "谓语": "predicate", "宾语": "object",
        "表语": "predicative", "补语": "complement", "定语": "attribute",
        "状语": "adverbial", "同位语": "appositive", "中心语": "head", "其他": "other"
      };
      if (Object.prototype.hasOwnProperty.call(traditionalRoles, text)) return traditionalRoles[text];
      const conventionRoles = {
        "述语补足语": "predicative", "补足语": "complement",
        "修饰语": "attribute", "附加语": "adverbial",
        "限定语": "attribute",
        "标记语": "connector", "并列项": "clause", "补充语": "appositive", "未定": "other"
      };
      if (Object.prototype.hasOwnProperty.call(conventionRoles, text)) return conventionRoles[text];
      if (text.includes("主语")) return "subject";
      if (text.includes("谓语")) return "predicate";
      if (text.includes("宾语")) return "object";
      if (text.includes("表语")) return "predicative";
      if (text.includes("补语")) return "complement";
      if (text.includes("定语")) return "attribute";
      if (text.includes("状语")) return "adverbial";
      if (text.includes("同位语")) return "appositive";
      if (text.includes("介词")) return "prep";
      if (text.includes("从句")) return "clause";
      if (text.includes("连接")) return "connector";
      return "other";
    }

    function chatCompletionContent(data) {
      return data?.choices?.[0]?.message?.content
        || data?.choices?.[0]?.text
        || data?.output_text
        || "";
    }

    async function analyzeCurrentGrammar({ force = false } = {}) {
      if (state.grammarLoading) return;
      const sentence = currentSentence();
      if (!sentence) return;
      const cachedGrammar = currentGrammar();
      if (cachedGrammar && !force) {
        state.grammarVisible = true;
        renderTarget();
        $("sourceStatus").textContent = "当前句已有 Ai 语法分析，已使用缓存。";
        return;
      }
      const settings = mergedAiSettings();
      if (!settings.apiKey) {
        alert("请先在“源文件”里填写并保存 API Key。");
        return;
      }
      state.grammarLoading = true;
      state.grammarVisible = true;
      renderTarget();
      $("analyzeGrammarBtn").disabled = true;
      $("analyzeGrammarBtn").textContent = "分析中";
      try {
        const baseUrl = settings.baseUrl.replace(/\/+$/, "");
        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${settings.apiKey}`
          },
          body: JSON.stringify({
            model: settings.model,
            messages: [
              { role: "system", content: "你是专业、严谨、简洁的英语语法老师。" },
              { role: "user", content: buildGrammarPrompt(sentence, currentTranslation()) }
            ]
          })
        });
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || `HTTP ${response.status}`);
        }
        const data = await response.json();
        const content = chatCompletionContent(data).trim();
        if (!content) throw new Error("AI 没有返回语法分析内容。");
        const item = normalizeSentenceItem(state.sentences[state.index]);
        item.grammar = content;
        item.grammarRaw = content;
        state.sentences[state.index] = item;
        saveGrammarCache(sentence, content, content);
        $("sourceStatus").textContent = force
          ? "当前句已重新分析并更新缓存。"
          : "当前句语法分析已保存。";
      } catch (error) {
        state.grammarVisible = Boolean(cachedGrammar);
        alert(`语法分析失败：${error.message || error}`);
      } finally {
        state.grammarLoading = false;
        $("analyzeGrammarBtn").disabled = false;
        $("analyzeGrammarBtn").textContent = "Ai语法分析";
        renderTarget();
      }
    }

    function closeGrammarContextMenu() {
      const menu = $("grammarContextMenu");
      menu.hidden = true;
    }

    function openGrammarContextMenu(event) {
      event.preventDefault();
      if (state.grammarLoading || !currentSentence()) return;
      closeAiTextContextMenu();
      closeTopMenus();
      const menu = $("grammarContextMenu");
      const buttonRect = $("analyzeGrammarBtn").getBoundingClientRect();
      menu.hidden = false;
      const menuRect = menu.getBoundingClientRect();
      const requestedX = event.clientX || buttonRect.left;
      const requestedY = event.clientY || buttonRect.bottom;
      menu.style.left = `${Math.max(8, Math.min(requestedX, window.innerWidth - menuRect.width - 8))}px`;
      menu.style.top = `${Math.max(8, Math.min(requestedY, window.innerHeight - menuRect.height - 8))}px`;
      $("reanalyzeGrammarBtn").focus();
    }

    function saveSpeechSettings() {
      const settings = {
        accent: $("accentSelect").value,
        accents: { ...(state.speechSettings.accents || {}), [activeLanguage()]: $("accentSelect").value },
        ignoreAccents: $("ignoreAccentsToggle").checked,
        voiceURI: $("voiceSelect").value,
        autoSpeak: $("autoSpeakToggle").checked,
        speakWord: $("speakWordToggle").checked,
        showSource: $("showSourceToggle").checked,
        showTranslation: $("showTranslationToggle").checked
      };
      state.speechSettings = settings;
      localStorage.setItem("langLSRWSpeechSettings", JSON.stringify(settings));
    }

    function saveShortcuts() {
      localStorage.setItem("langLSRWShortcuts", JSON.stringify(state.shortcuts));
    }

    function aiDefaults() {
      return {
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-5.6-luna",
        apiKey: ""
      };
    }

    function mergedAiSettings() {
      return { ...aiDefaults(), ...state.aiSettings };
    }

    function loadAiSettings() {
      const settings = mergedAiSettings();
      $("aiBaseUrlInput").value = settings.baseUrl;
      $("aiModelInput").value = settings.model;
      $("aiApiKeyInput").value = settings.apiKey;
    }

    function saveAiSettings() {
      const settings = {
        baseUrl: $("aiBaseUrlInput").value.trim() || aiDefaults().baseUrl,
        model: $("aiModelInput").value.trim() || aiDefaults().model,
        apiKey: $("aiApiKeyInput").value.trim()
      };
      state.aiSettings = settings;
      localStorage.setItem("langLSRWAISettings", JSON.stringify(settings));
      $("sourceStatus").textContent = "AI 设置已保存。";
    }

    // Theme model mirrors nav.mltz.tech. The initial light/dark value is set by
    // the inline script in index.html (stored choice, else the OS setting);
    // only an explicit click persists it, so an unset choice keeps following the OS.
    function systemColorMode() {
      return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }

    function currentColorMode() {
      return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    }

    function applyColorMode(mode, { persist = false } = {}) {
      const next = mode === "dark" ? "dark" : "light";
      document.documentElement.dataset.theme = next;
      if (persist) localStorage.setItem("langLSRWColorMode", next);
      $("themeToggleBtn").textContent = next === "dark" ? "浅色" : "深色";
      $("themeToggleBtn").title = next === "dark" ? "切换到浅色" : "切换到深色";
    }

    function toggleTheme() {
      applyColorMode(currentColorMode() === "dark" ? "light" : "dark", { persist: true });
    }

    function applyPalette(name) {
      const next = palettes.includes(name) ? name : "default";
      document.documentElement.dataset.palette = next;
      localStorage.setItem("langLSRWPalette", next);
      if ($("paletteSelect").value !== next) $("paletteSelect").value = next;
    }

    function applyFontSettings(settings, { persist = true } = {}) {
      const defaults = fontDefaults();
      const english = Object.prototype.hasOwnProperty.call(englishFontPresets, settings?.english)
        ? settings.english
        : defaults.english;
      const chinese = Object.prototype.hasOwnProperty.call(chineseFontPresets, settings?.chinese)
        ? settings.chinese
        : defaults.chinese;
      state.fontSettings = { english, chinese };
      document.documentElement.style.setProperty("--font-english-content", englishFontPresets[english]);
      document.documentElement.style.setProperty("--font-translation", chineseFontPresets[chinese]);
      $("englishFontSelect").value = english;
      $("chineseFontSelect").value = chinese;
      if (persist) localStorage.setItem("langLSRWFontSettings", JSON.stringify(state.fontSettings));
    }

    function saveFontSettings() {
      applyFontSettings({
        english: $("englishFontSelect").value,
        chinese: $("chineseFontSelect").value
      });
    }

    function resetFontSettings() {
      localStorage.removeItem("langLSRWFontSettings");
      applyFontSettings(fontDefaults(), { persist: false });
    }

    const grammarColorLabels = {
      subject: "主语",
      predicate: "谓语",
      object: "宾语",
      predicative: "表语",
      complement: "补语",
      attribute: "定语",
      adverbial: "状语",
      appositive: "同位语",
      head: "中心语",
      other: "其他"
    };
    let activeGrammarColorRole = "subject";

    function setActiveGrammarColorRole(role) {
      if (!grammarColorLabels[role]) return;
      activeGrammarColorRole = role;
      document.querySelectorAll("[data-grammar-color-row]").forEach((row) => {
        row.classList.toggle("is-active", row.dataset.grammarColorRow === role);
      });
      $("grammarColorActiveLabel").textContent = grammarColorLabels[role];
    }

    function normalizeHexInput(value) {
      const compact = String(value || "").trim();
      const prefixed = compact.startsWith("#") ? compact : `#${compact}`;
      return /^#[0-9a-f]{6}$/i.test(prefixed) ? prefixed.toLowerCase() : "";
    }

    function updateGrammarColor(role, value) {
      const normalized = normalizeHexInput(value);
      if (!normalized || !grammarColorLabels[role]) return false;
      setActiveGrammarColorRole(role);
      applyGrammarColors({ ...state.grammarColors, [role]: normalized });
      return true;
    }

    function applyGrammarColors(colors, { persist = true } = {}) {
      state.grammarColors = normalizeGrammarColors(colors);
      Object.entries(state.grammarColors).forEach(([key, value]) => {
        document.documentElement.style.setProperty(`--grammar-${key}-color`, value);
        const input = document.querySelector(`[data-grammar-color="${key}"]`);
        if (input) input.value = value;
        const hexInput = document.querySelector(`[data-grammar-hex="${key}"]`);
        if (hexInput) {
          hexInput.value = value.toUpperCase();
          hexInput.classList.remove("is-invalid");
        }
      });
      if (persist) localStorage.setItem("langLSRWGrammarColors", JSON.stringify(state.grammarColors));
    }

    function resetGrammarColors() {
      localStorage.removeItem("langLSRWGrammarColors");
      applyGrammarColors(grammarColorDefaults(), { persist: false });
    }

    function resetSettingsToDefault() {
      localStorage.removeItem("langLSRWTheme");
      localStorage.removeItem("langLSRWColorMode");
      localStorage.removeItem("langLSRWShortcuts");
      localStorage.removeItem("langLSRWSpeechSettings");
      localStorage.removeItem("langLSRWFontSettings");
      localStorage.removeItem("langLSRWGrammarColors");
      state.shortcuts = { ...defaultShortcuts };
      state.speechSettings = {};
      applyColorMode(systemColorMode());
      applyPalette("default");
      applyFontSettings(fontDefaults(), { persist: false });
      applyGrammarColors(grammarColorDefaults(), { persist: false });
      loadSpeechSettings();
      populateVoices();
      renderShortcutSettings();
      updateSpeechRateIndicator();
    }

    function resetGlobalSettings() {
      const confirmed = confirm("确定恢复默认设置吗？主题、字体、句子成分颜色、快捷键、朗读设置会重置，用户记录和句库不会删除。");
      if (!confirmed) return;

      resetSettingsToDefault();
      closeTopMenus();
    }

    function setActivePage(pageId) {
      const page = document.getElementById(pageId);
      if (!page) return;
      state.activePage = pageId;
      document.body.dataset.activePage = pageId;
      localStorage.setItem("activeLearningPage", pageId);
      if (pageId !== "listenPage") {
        closeTopMenus();
        dragDepth = 0;
        $("dropOverlay").classList.remove("active");
      }
      if (pageId !== "listenPage" && (state.speaking.isRecognizing || state.speaking.isRecording)) stopSpeakingPractice();
      document.querySelectorAll(".learning-page").forEach((item) => {
        item.classList.toggle("active", item.id === pageId);
      });
      document.querySelectorAll(".page-tab").forEach((tab) => {
        const isActive = tab.dataset.pageTarget === pageId;
        tab.classList.toggle("active", isActive);
        tab.setAttribute("aria-current", isActive ? "page" : "false");
      });
      if (pageId === "listenPage") renderSpeakingPage();
    }

    function normalizeShortcutEvent(event) {
      const modifierKeys = ["Control", "Alt", "Shift", "Meta"];
      if (modifierKeys.includes(event.key)) return "";
      const keyMap = {
        " ": "Space",
        "ArrowLeft": "Left",
        "ArrowRight": "Right",
        "ArrowUp": "Up",
        "ArrowDown": "Down",
        "Escape": "Esc"
      };
      const key = keyMap[event.key] || (event.key.length === 1 ? event.key.toUpperCase() : event.key);
      const parts = [];
      if (event.ctrlKey) parts.push("Ctrl");
      if (event.altKey) parts.push("Alt");
      if (event.shiftKey) parts.push("Shift");
      if (event.metaKey) parts.push("Meta");
      parts.push(key);
      return parts.join("+");
    }

    function renderShortcutSettings() {
      $("shortcutList").innerHTML = shortcutActions.map((action) => `
        <label class="shortcut-row">
          <span>${escapeHtml(action.label)}</span>
          <input class="shortcut-input" type="text" readonly data-shortcut="${escapeHtml(action.id)}" value="${escapeHtml(state.shortcuts[action.id] || "")}" placeholder="未设置">
        </label>
      `).join("");
    }

    function runShortcutAction(actionId) {
      const actions = {
        toggleSource: toggleSourceVisibility,
        toggleTranslation: toggleTranslationVisibility,
        nextSentence: goNextSentence,
        previousSentence: goPreviousSentence,
        resetSentence: () => resetCurrent(false),
        speakSentence: speakCurrentSentence,
        stopSpeech,
        peekCurrentWord: peekCurrentWord,
        speakCurrentWord: speakCurrentWord,
        finishSentence: finishCurrent
      };
      if (actions[actionId]) actions[actionId]();
    }

    function runSpeakingShortcut(actionId) {
      const actions = {
        previousSentence: () => switchSpeakingSentence(pickSentenceIndex(-1)),
        nextSentence: () => switchSpeakingSentence(pickSentenceIndex(1)),
        speakModel: () => speakText(currentSentence()),
        togglePractice: () => {
          if (state.speaking.isRecognizing || state.speaking.isRecording) {
            stopSpeakingPractice();
          } else {
            startSpeakingPractice();
          }
        }
      };
      if (actions[actionId]) actions[actionId]();
    }

    function handleSpeakingShortcut(event) {
      const shortcut = normalizeShortcutEvent(event);
      if (!shortcut) return false;
      const match = Object.entries(speakingShortcuts).find(([, value]) => value === shortcut);
      if (!match) return false;
      event.preventDefault();
      event.stopPropagation();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
      if (event.repeat && match[0] === "togglePractice") return true;
      runSpeakingShortcut(match[0]);
      return true;
    }

    function isTopMenuOpen() {
      return Boolean(
        document.querySelector(".source-menu[open], .shortcut-menu[open], .font-menu[open], .user-menu[open]")
        || !$("libraryModal").hidden
      );
    }

    function handleGlobalShortcut(event) {
      if (event.isComposing) return;
      if (event.target && event.target.closest && event.target.closest("[data-shortcut]")) return;
      if (isTopMenuOpen()) return;
      if (state.activePage !== "listenPage") return;
      const target = event.target;
      const isTypingFocused = document.activeElement === typingBox || target === typingBox || Boolean(target && target.closest && target.closest("#typingBox"));
      const isInteractiveTarget = target && target.closest && target.closest("input, textarea, select, button, summary, a, [contenteditable='true']");

      if (!event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey && event.key === "Escape" && isTypingFocused) {
        event.preventDefault();
        event.stopPropagation();
        if (event.stopImmediatePropagation) event.stopImmediatePropagation();
        typingBox.blur();
        return;
      }

      if (!event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey && event.key === "Enter" && !isTypingFocused && !isInteractiveTarget) {
        event.preventDefault();
        event.stopPropagation();
        if (event.stopImmediatePropagation) event.stopImmediatePropagation();
        typingBox.focus();
        return;
      }

      const shortcut = normalizeShortcutEvent(event);
      if (shortcut && state.shortcuts.holdSpeaking === shortcut) {
        if (isTypingFocused) return;
        event.preventDefault();
        event.stopPropagation();
        if (event.stopImmediatePropagation) event.stopImmediatePropagation();
        if (!event.repeat && !state.speaking.holdActive && !state.speaking.isStarting && !state.speaking.isRecognizing && !state.speaking.isRecording) {
          state.speaking.holdActive = true;
          startSpeakingPractice();
        }
        return;
      }

      if (shortcut) {
        const match = shortcutActions.find((action) => state.shortcuts[action.id] === shortcut);
        if (match && match.id !== "holdSpeaking") {
          event.preventDefault();
          event.stopPropagation();
          if (event.stopImmediatePropagation) event.stopImmediatePropagation();
          if (match.id === "peekCurrentWord") {
            peekCurrentWord();
            return;
          }
          if (event.repeat && match.id === "speakCurrentWord") return;
          runShortcutAction(match.id);
          return;
        }
      }

      if (!event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey && event.key === "-") {
        event.preventDefault();
        event.stopPropagation();
        if (event.stopImmediatePropagation) event.stopImmediatePropagation();
        replaySlower();
        return;
      }
      if (!event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey && event.key === "=") {
        event.preventDefault();
        event.stopPropagation();
        if (event.stopImmediatePropagation) event.stopImmediatePropagation();
        replayCurrentSpeed();
        return;
      }
      if (!event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey && (event.key === "`" || event.code === "Backquote")) {
        event.preventDefault();
        event.stopPropagation();
        if (event.stopImmediatePropagation) event.stopImmediatePropagation();
        replayNormalSpeed();
        return;
      }
    }

    function handleGlobalShortcutKeyup(event) {
      if (event.isComposing) return;
      if (event.target && event.target.closest && event.target.closest("[data-shortcut]")) return;
      if (isTopMenuOpen()) {
        if (state.speaking.holdActive) scheduleStopSpeakingPractice();
        clearPeekedWord();
        return;
      }
      if (state.activePage !== "listenPage") return;
      const target = event.target;
      const isTypingFocused = document.activeElement === typingBox || target === typingBox || Boolean(target && target.closest && target.closest("#typingBox"));
      const shortcut = normalizeShortcutEvent(event);
      if (!isTypingFocused && shortcut && state.shortcuts.holdSpeaking === shortcut) {
        event.preventDefault();
        event.stopPropagation();
        if (event.stopImmediatePropagation) event.stopImmediatePropagation();
        scheduleStopSpeakingPractice();
        return;
      }
      if (!shortcut || state.shortcuts.peekCurrentWord !== shortcut) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
      clearPeekedWord();
    }

    function loadSpeechSettings() {
      renderAccentOptions();
      $("ignoreAccentsToggle").checked = state.speechSettings.ignoreAccents !== false;
      $("autoSpeakToggle").checked = state.speechSettings.autoSpeak !== false;
      $("speakWordToggle").checked = state.speechSettings.speakWord !== false;
      $("showSourceToggle").checked = state.speechSettings.showSource !== false;
      $("showTranslationToggle").checked = state.speechSettings.showTranslation !== false;
    }

    function populateVoices() {
      if (!("speechSynthesis" in window)) return;
      state.voices = window.speechSynthesis.getVoices();
      const accent = $("accentSelect").value;
      const matchingVoices = state.voices.filter((voice) => voice.lang && voice.lang.toLowerCase().startsWith(accent.toLowerCase()));
      const languagePrefix = new RegExp(`^${activeLanguage()}(-|_|$)`, "i");
      const voices = matchingVoices.length ? matchingVoices : state.voices.filter((voice) => languagePrefix.test(voice.lang || ""));
      $("voiceSelect").innerHTML = '<option value="">自动选择</option>' + voices.map((voice) => (
        `<option value="${escapeHtml(voice.voiceURI)}">${escapeHtml(voice.name)} (${escapeHtml(voice.lang)})</option>`
      )).join("");
      if (state.speechSettings.voiceURI && voices.some((voice) => voice.voiceURI === state.speechSettings.voiceURI)) {
        $("voiceSelect").value = state.speechSettings.voiceURI;
      }
    }

    function getSpeechText() {
      return currentSentence();
    }

    function chooseVoice() {
      const voiceURI = $("voiceSelect").value;
      const accent = $("accentSelect").value;
      if (voiceURI) return state.voices.find((voice) => voice.voiceURI === voiceURI) || null;
      return state.voices.find((voice) => voice.lang === accent)
        || state.voices.find((voice) => voice.lang && voice.lang.toLowerCase().startsWith(accent.toLowerCase()))
        || state.voices.find((voice) => new RegExp(`^${activeLanguage()}(-|_|$)`, "i").test(voice.lang || ""))
        || null;
    }

    // Read-aloud and recognition are browser features (Web Speech API), not
    // server ones. Brave strips Google's online voices and recognition service,
    // and Linux browsers other than Google Chrome usually have no voices at all.
    const isBrave = Boolean(navigator.brave);
    const browserAdvice = "请用 Google Chrome 或 Microsoft Edge 打开本网站";
    const noticesShown = new Set();

    function showNotice(message, key = message) {
      if (noticesShown.has(key)) return;
      noticesShown.add(key);
      const notice = $("appNotice");
      notice.textContent = message;
      notice.hidden = false;
      clearTimeout(showNotice.timer);
      showNotice.timer = setTimeout(() => {
        notice.hidden = true;
      }, 9000);
    }

    function warnIfNoVoice() {
      const voices = window.speechSynthesis.getVoices();
      if (!voices.length) {
        showNotice(`当前浏览器没有可用的朗读语音${isBrave ? "（Brave 不带 Google 在线语音）" : ""}，所以听不到声音。${browserAdvice}。`, "no-voices");
        return;
      }
      const language = activeLanguage();
      if (!voices.some((voice) => new RegExp(`^${language}(-|_|$)`, "i").test(voice.lang || ""))) {
        showNotice(`当前浏览器没有${learningLanguages[language].label}语音，朗读可能听不懂。${browserAdvice}。`, `no-voice-${language}`);
      }
    }

    function speakText(text, options = {}) {
      if (!("speechSynthesis" in window)) {
        showNotice(`当前浏览器不支持朗读功能。${browserAdvice}。`, "no-tts");
        return;
      }
      if (!text) return;
      warnIfNoVoice();
      if (options.interrupt !== false) window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = $("accentSelect").value;
      utterance.rate = options.rate || 1;
      utterance.pitch = 1;
      const voice = chooseVoice();
      if (voice) utterance.voice = voice;
      window.speechSynthesis.speak(utterance);
    }

    function speakCurrentSentence() {
      speakText(getSpeechText());
    }

    function currentReplayRate() {
      return state.replaySlowStep
        ? Math.max(0.45, 1 - state.replaySlowStep * 0.12)
        : 1;
    }

    function updateSpeechRateIndicator() {
      const rate = currentReplayRate();
      const label = state.replaySlowStep ? `慢速 ${state.replaySlowStep} 档` : "原速";
      $("speechRateIndicator").innerHTML = `<strong>${rate.toFixed(2)}x</strong><span>${label}</span>`;
    }

    function replaySlower() {
      state.replaySlowStep = Math.min(state.replaySlowStep + 1, 5);
      updateSpeechRateIndicator();
      speakText(getSpeechText(), { rate: currentReplayRate() });
    }

    function replayNormalSpeed() {
      state.replaySlowStep = 0;
      updateSpeechRateIndicator();
      speakText(getSpeechText(), { rate: currentReplayRate() });
    }

    function replayCurrentSpeed() {
      updateSpeechRateIndicator();
      speakText(getSpeechText(), { rate: currentReplayRate() });
    }

    function autoSpeakCurrentSentence() {
      if ($("autoSpeakToggle").checked) {
        setTimeout(speakCurrentSentence, 120);
      }
    }

    function targetWordFromEvent(event) {
      return event.target && event.target.closest ? event.target.closest(".target-word") : null;
    }

    function speakTargetWord(wordEl) {
      if (!wordEl) return;
      speakText(wordEl.dataset.word || wordEl.textContent.trim(), { rate: currentReplayRate() });
    }

    function clearPeekedWord() {
      targetEl.querySelectorAll(".peek-word").forEach((word) => word.classList.remove("peek-word"));
      document.body.classList.remove("hide-cursor");
    }

    function getActiveTargetWordEl() {
      const words = [...targetEl.querySelectorAll(".target-word")];
      if (!words.length) return null;

      if (targetEl.classList.contains("hidden-source")) {
        return targetEl.querySelector(".covered-word") || words[words.length - 1];
      }

      return targetEl.querySelector(".wrong, .pending") || words[words.length - 1];
    }

    function peekCurrentWord() {
      if (!targetEl.classList.contains("hidden-source")) return;
      const wordEl = getActiveTargetWordEl();
      if (!wordEl) return;
      clearPeekedWord();
      wordEl.classList.add("peek-word");
      document.body.classList.add("hide-cursor");
    }

    function speakCurrentWord() {
      speakTargetWord(getActiveTargetWordEl());
    }

    function getTargetWordEndingAt(position) {
      const target = currentSentence();
      const pattern = wordPattern();
      let match;
      while ((match = pattern.exec(target)) !== null) {
        const word = match[0];
        const end = match.index + word.length;
        if (end === position) {
          return { word, key: `${word.toLowerCase()}@${end}` };
        }
      }
      return null;
    }

    function maybeSpeakCompletedWord(inputType) {
      if (!$("speakWordToggle").checked) return;
      if (inputType && inputType.startsWith("delete")) return;
      const completed = getTargetWordEndingAt(typingBox.value.length);
      if (!completed || completed.key === state.lastSpokenWordKey) return;
      state.lastSpokenWordKey = completed.key;
      speakText(completed.word, { rate: 0.86 });
    }

    function escapeHtml(value) {
      return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }

    function charLabel(char) {
      if (char === " ") return "空格";
      if (char === "\n") return "换行";
      if (!char) return "空";
      return char;
    }

    // Words are letters/digits of any language (é, ñ, ü…), not just ASCII.
    const wordPatternSource = "[\\p{L}\\p{N}]+(?:['’.-][\\p{L}\\p{N}]+)*";

    function wordPattern() {
      return new RegExp(wordPatternSource, "gu");
    }

    function isCheckChar(char) {
      return /[\p{L}\p{N}]/u.test(char || "");
    }

    // With "ignore accents" on (default), á→a, ñ→n, ü→u when comparing.
    function foldChar(char) {
      const lower = char.toLowerCase();
      return state.speechSettings.ignoreAccents === false
        ? lower
        : lower.normalize("NFD").replace(/\p{M}+/gu, "");
    }

    function getCheckChars(text) {
      const chars = [];
      for (let i = 0; i < text.length; i += 1) {
        const char = text[i];
        if (isCheckChar(char)) {
          chars.push({ char, normalized: foldChar(char), pos: i + 1 });
        }
      }
      return chars;
    }

    function normalizeCheckText(text) {
      return getCheckChars(text).map((item) => item.normalized).join("");
    }

    function getWordMatches(text) {
      const words = [];
      const pattern = wordPattern();
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const value = match[0];
        words.push({
          text: value,
          normalized: normalizeCheckText(value),
          start: match.index,
          end: match.index + value.length
        });
      }
      return words;
    }

    function alignInputWords(input, target) {
      const inputWords = getWordMatches(input);
      const targetWords = getWordMatches(target);
      const pairs = [];
      let targetIndex = 0;
      const trailingWord = /[\p{L}\p{N}'’.-]$/u.test(input);

      inputWords.forEach((inputWord, inputIndex) => {
        let foundIndex = -1;
        for (let i = targetIndex; i < targetWords.length; i += 1) {
          if (targetWords[i].normalized === inputWord.normalized) {
            foundIndex = i;
            break;
          }
        }

        if (foundIndex >= 0) {
          pairs.push({ inputIndex, targetIndex: foundIndex, status: "correct" });
          targetIndex = foundIndex + 1;
          return;
        }

        const targetWord = targetWords[targetIndex];
        const isLastInputWord = inputIndex === inputWords.length - 1;
        if (
          trailingWord &&
          isLastInputWord &&
          targetWord &&
          targetWord.normalized.startsWith(inputWord.normalized)
        ) {
          pairs.push({ inputIndex, targetIndex, status: "partial" });
          return;
        }

        pairs.push({ inputIndex, targetIndex, status: "wrong" });
        if (targetIndex < targetWords.length) targetIndex += 1;
      });

      return { inputWords, targetWords, pairs };
    }

    function getTargetWordPieces(target) {
      const pieces = [];
      const pattern = wordPattern();
      let lastIndex = 0;
      let match;
      while ((match = pattern.exec(target)) !== null) {
        if (match.index > lastIndex) {
          pieces.push({ type: "text", text: target.slice(lastIndex, match.index) });
        }
        const word = match[0];
        pieces.push({
          type: "word",
          text: word,
          normalized: normalizeCheckText(word)
        });
        lastIndex = match.index + word.length;
      }
      if (lastIndex < target.length) {
        pieces.push({ type: "text", text: target.slice(lastIndex) });
      }
      return pieces;
    }

    function getRevealedWordCount(input, target) {
      const typed = normalizeCheckText(input);
      const words = getTargetWordPieces(target).filter((piece) => piece.type === "word");
      let offset = 0;
      let revealed = 0;
      for (const word of words) {
        const nextOffset = offset + word.normalized.length;
        if (typed.length < nextOffset) break;
        if (typed.slice(offset, nextOffset) !== word.normalized) break;
        revealed += 1;
        offset = nextOffset;
      }
      return revealed;
    }

    function compareText(input, target) {
      const alignment = alignInputWords(input, target);
      const errors = [];
      let correct = 0;

      alignment.pairs.forEach((pair) => {
        const inputWord = alignment.inputWords[pair.inputIndex];
        const targetWord = alignment.targetWords[pair.targetIndex];
        if (pair.status === "correct") {
          correct += inputWord.normalized.length;
        } else if (pair.status === "wrong") {
          errors.push({
            pos: targetWord ? targetWord.start + 1 : inputWord.start + 1,
            expected: targetWord ? targetWord.text : "",
            actual: inputWord.text
          });
        }
      });

      return {
        correct,
        errors,
        inputLength: normalizeCheckText(input).length,
        targetLength: normalizeCheckText(target).length
      };
    }

    function compareSpeakingText(target, spoken) {
      const alignment = alignInputWords(spoken, target);
      const targetWords = alignment.targetWords;
      const spokenWords = alignment.inputWords;
      const matchedTarget = new Set();
      const compareByTarget = new Map();
      const extraItems = [];
      let correct = 0;
      let wrong = 0;
      let extra = 0;

      alignment.pairs.forEach((pair) => {
        const inputWord = spokenWords[pair.inputIndex];
        const targetWord = targetWords[pair.targetIndex];
        if (pair.status === "correct" && targetWord) {
          matchedTarget.add(pair.targetIndex);
          correct += 1;
          compareByTarget.set(pair.targetIndex, { type: "correct", text: targetWord.text });
          return;
        }
        if (targetWord) {
          matchedTarget.add(pair.targetIndex);
          wrong += 1;
          compareByTarget.set(pair.targetIndex, { type: "wrong", text: targetWord.text, actual: inputWord.text });
          return;
        }
        extra += 1;
        extraItems.push({ type: "extra", text: inputWord.text });
      });

      const compareItems = [];
      targetWords.forEach((word, index) => {
        compareItems.push(compareByTarget.get(index) || { type: "missing", text: word.text });
      });
      compareItems.push(...extraItems);

      const missing = targetWords.length - matchedTarget.size;
      const denominator = Math.max(targetWords.length, spokenWords.length, 1);
      const score = Math.max(0, Math.round((correct / denominator) * 100));
      return { score, correct, wrong, extra, missing, compareItems };
    }

    function speechRecognitionCtor() {
      return window.SpeechRecognition || window.webkitSpeechRecognition || null;
    }

    function speakingCapabilityText() {
      const notes = [];
      if (!speechRecognitionCtor()) notes.push(`当前浏览器不支持自动识别，可先使用录音回放练习（${browserAdvice}）。`);
      else if (isBrave) notes.push(`Brave 不提供语音识别服务，只能用录音回放（${browserAdvice}）。`);
      if (!navigator.mediaDevices || !window.MediaRecorder) notes.push("当前浏览器不支持录音回放。");
      return notes.join(" ");
    }

    // The message sticks until the next attempt; re-renders must not wipe an
    // error the user has not seen yet.
    function setSpeakingStatus(message = state.speaking.statusMessage) {
      state.speaking.statusMessage = message || "";
      const capability = speakingCapabilityText();
      $("speakingStatus").innerHTML = [state.speaking.statusMessage, capability].filter(Boolean).join(" ");
    }

    function renderSpeakingPage() {
      if (!$("speakingCompare")) return;
      const target = currentSentence();
      const metrics = state.speaking.spokenText
        ? (state.speaking.metrics || compareSpeakingText(target, state.speaking.spokenText))
        : { score: 0, wrong: 0, extra: 0, missing: 0, compareItems: [] };
      $("speakingScore").textContent = `${metrics.score}%`;
      $("speakingVolume").textContent = Math.round(state.speaking.volumeSamples ? state.speaking.volumeTotal / state.speaking.volumeSamples : state.speaking.volumeLevel);
      $("speakingMissing").textContent = metrics.missing;
      $("speakingWrong").textContent = metrics.wrong;
      $("speakingExtra").textContent = metrics.extra;
      $("speakingCompare").innerHTML = metrics.compareItems.length
        ? metrics.compareItems.map((item) => renderSpeakingCompareItem(item)).join(" ")
        : '<span class="empty">请说话 ...</span>';
      const holdButton = $("startSpeakingBtn");
      const isListening = state.speaking.holdActive || state.speaking.permissionLock || state.speaking.isStarting || state.speaking.isRecognizing || state.speaking.isRecording;
      holdButton.textContent = isListening ? "正在聆听" : "按住说话";
      holdButton.classList.toggle("is-listening", isListening);
      $("speakingAudio").src = state.speaking.recordedAudioUrl || "";
      $("recordingStatus").textContent = state.speaking.recordedAudioUrl
        ? "已生成本次录音，可直接回放。"
        : "录音完成后会出现在这里。";
      setSpeakingStatus();
      renderVolumeMeter();
    }

    function renderVolumeMeter() {
      const meter = $("speakingVolumeMeter");
      if (!meter) return;
      const level = Math.max(0, Math.min(100, state.speaking.volumeLevel || 0));
      const barCount = 12;
      const activeCount = Math.round((level / 100) * barCount);
      meter.classList.toggle("is-active", state.speaking.isRecording || state.speaking.isRecognizing || state.speaking.isStarting);
      meter.innerHTML = Array.from({ length: barCount }, (_, index) => (
        `<span class="${index < activeCount ? "active" : ""}"></span>`
      )).join("");
    }

    function renderSpeakingCompareItem(item) {
      if (item.type === "wrong") {
        return `<span class="speech-word wrong">${escapeHtml(item.text)} <span class="expected">(<span class="actual">${escapeHtml(item.actual)}</span>)</span></span>`;
      }
      if (item.type === "missing") {
        return `<span class="speech-word missing">${escapeHtml(item.text)} <span class="expected">(<span class="actual">X</span>)</span></span>`;
      }
      return `<span class="speech-word ${item.type}">${escapeHtml(item.text)}</span>`;
    }

    function resetSpeakingResult() {
      state.speaking.statusMessage = "";
      state.speaking.spokenText = "";
      state.speaking.metrics = null;
      state.speaking.volumeLevel = 0;
      state.speaking.volumeTotal = 0;
      state.speaking.volumeSamples = 0;
      if (state.speaking.recordedAudioUrl) URL.revokeObjectURL(state.speaking.recordedAudioUrl);
      state.speaking.recordedAudioUrl = "";
      state.speaking.audioChunks = [];
      renderSpeakingPage();
    }

    function stopVolumeMeter() {
      if (state.speaking.volumeFrame) {
        cancelAnimationFrame(state.speaking.volumeFrame);
        state.speaking.volumeFrame = 0;
      }
      if (state.speaking.audioContext) {
        state.speaking.audioContext.close().catch(() => {});
        state.speaking.audioContext = null;
      }
      state.speaking.volumeAnalyser = null;
    }

    function startVolumeMeter(stream) {
      stopVolumeMeter();
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextCtor) return;
      const audioContext = new AudioContextCtor();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      audioContext.createMediaStreamSource(stream).connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);
      state.speaking.audioContext = audioContext;
      state.speaking.volumeAnalyser = analyser;

      const tick = () => {
        if (!state.speaking.volumeAnalyser) return;
        state.speaking.volumeAnalyser.getByteTimeDomainData(samples);
        let sum = 0;
        for (const sample of samples) {
          const centered = (sample - 128) / 128;
          sum += centered * centered;
        }
        const rms = Math.sqrt(sum / samples.length);
        const level = Math.max(0, Math.min(100, Math.round(rms * 240)));
        state.speaking.volumeLevel = level;
        state.speaking.volumeTotal += level;
        state.speaking.volumeSamples += 1;
        if ($("speakingVolume")) $("speakingVolume").textContent = Math.round(state.speaking.volumeTotal / state.speaking.volumeSamples);
        renderVolumeMeter();
        state.speaking.volumeFrame = requestAnimationFrame(tick);
      };
      tick();
    }

    function startSpeechRecognition() {
      const Recognition = speechRecognitionCtor();
      if (!Recognition) return false;
      const recognition = new Recognition();
      state.speaking.recognition = recognition;
      recognition.lang = $("accentSelect").value || "en-GB";
      recognition.interimResults = true;
      recognition.continuous = false;

      recognition.onstart = () => {
        state.speaking.permissionLock = false;
        state.speaking.isRecognizing = true;
        renderSpeakingPage();
      };
      recognition.onresult = (event) => {
        const text = Array.from(event.results)
          .map((result) => result[0] ? result[0].transcript : "")
          .join(" ")
          .trim();
        state.speaking.spokenText = text;
        state.speaking.metrics = compareSpeakingText(currentSentence(), text);
        renderSpeakingPage();
      };
      recognition.onerror = (event) => {
        state.speaking.permissionLock = false;
        const reasons = {
          network: `语音识别服务连不上。Brave、Chromium、Firefox 都不提供这个服务，${browserAdvice}；用 Chrome 时请检查网络`,
          "not-allowed": "麦克风权限被拒绝，请点地址栏左侧的图标允许使用麦克风",
          "service-not-allowed": `浏览器不允许使用语音识别服务，${browserAdvice}`,
          "audio-capture": "找不到麦克风，请检查系统的输入设备",
          "no-speech": "没有听到声音，请靠近麦克风再试",
          "language-not-supported": `浏览器不支持${learningLanguages[activeLanguage()].label}识别`,
          aborted: ""
        };
        const reason = reasons[event.error] ?? `未知错误（${event.error || "无代码"}）`;
        if (reason) setSpeakingStatus(`识别失败：${escapeHtml(reason)}。`);
      };
      recognition.onend = () => {
        state.speaking.permissionLock = false;
        state.speaking.isRecognizing = false;
        state.speaking.recognition = null;
        state.speaking.metrics = compareSpeakingText(currentSentence(), state.speaking.spokenText);
        renderSpeakingPage();
      };
      state.speaking.permissionLock = true;
      renderSpeakingPage();
      recognition.start();
      return true;
    }

    async function startRecording() {
      if (!navigator.mediaDevices || !window.MediaRecorder) return false;
      state.speaking.permissionLock = true;
      renderSpeakingPage();
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } finally {
        state.speaking.permissionLock = false;
      }
      const recorder = new MediaRecorder(stream);
      state.speaking.mediaStream = stream;
      state.speaking.mediaRecorder = recorder;
      state.speaking.audioChunks = [];
      startVolumeMeter(stream);
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size) state.speaking.audioChunks.push(event.data);
      };
      recorder.onstop = () => {
        stopVolumeMeter();
        if (state.speaking.recordedAudioUrl) URL.revokeObjectURL(state.speaking.recordedAudioUrl);
        const blob = new Blob(state.speaking.audioChunks, { type: recorder.mimeType || "audio/webm" });
        state.speaking.recordedAudioUrl = URL.createObjectURL(blob);
        state.speaking.isRecording = false;
        state.speaking.mediaRecorder = null;
        if (state.speaking.mediaStream) {
          state.speaking.mediaStream.getTracks().forEach((track) => track.stop());
          state.speaking.mediaStream = null;
        }
        renderSpeakingPage();
      };
      recorder.start();
      state.speaking.isRecording = true;
      renderSpeakingPage();
      return true;
    }

    async function startSpeakingPractice() {
      clearScheduledSpeakingStop();
      if (!state.sentences.length) return;
      if (state.speaking.isStarting || state.speaking.isRecognizing || state.speaking.isRecording) return;
      state.speaking.isStarting = true;
      state.speaking.stopAfterStart = false;
      resetSpeakingResult();
      let startedRecognition = false;
      let startedRecording = false;
      try {
        startedRecognition = startSpeechRecognition();
      } catch (error) {
        setSpeakingStatus(`无法启动识别：${error.message || error}`);
      }
      try {
        startedRecording = await startRecording();
      } catch (error) {
        setSpeakingStatus(`无法启动录音：${error.message || "请检查麦克风权限"}`);
      }
      if (!startedRecognition && !startedRecording) {
        setSpeakingStatus("当前浏览器无法启动识别或录音。");
      }
      state.speaking.isStarting = false;
      renderSpeakingPage();
      if (state.speaking.stopAfterStart) stopSpeakingPractice();
    }

    function clearScheduledSpeakingStop() {
      if (!state.speaking.stopTimer) return;
      clearTimeout(state.speaking.stopTimer);
      state.speaking.stopTimer = null;
    }

    function scheduleStopSpeakingPractice(delay = 300) {
      clearScheduledSpeakingStop();
      state.speaking.holdActive = false;
      state.speaking.stopTimer = setTimeout(() => {
        state.speaking.stopTimer = null;
        stopSpeakingPractice();
      }, delay);
      renderSpeakingPage();
    }

    function stopRecording() {
      if (state.speaking.mediaRecorder && state.speaking.mediaRecorder.state !== "inactive") {
        state.speaking.mediaRecorder.stop();
        return;
      }
      if (state.speaking.mediaStream) {
        state.speaking.mediaStream.getTracks().forEach((track) => track.stop());
        state.speaking.mediaStream = null;
      }
      stopVolumeMeter();
      state.speaking.isRecording = false;
    }

    function stopSpeakingPractice() {
      clearScheduledSpeakingStop();
      if (state.speaking.permissionLock) {
        state.speaking.holdActive = true;
        state.speaking.stopAfterStart = false;
        renderSpeakingPage();
        return;
      }
      if (state.speaking.isStarting) {
        state.speaking.holdActive = false;
        state.speaking.stopAfterStart = true;
        renderSpeakingPage();
        return;
      }
      state.speaking.holdActive = false;
      state.speaking.stopAfterStart = false;
      state.speaking.isStarting = false;
      if (state.speaking.recognition) {
        try { state.speaking.recognition.stop(); } catch {}
      }
      stopRecording();
      state.speaking.isRecognizing = false;
      state.speaking.metrics = compareSpeakingText(currentSentence(), state.speaking.spokenText);
      renderSpeakingPage();
    }

    function getTypingIntervals() {
      const inputEvents = state.events.filter((event) => event.type === "input");
      const intervals = [];
      for (let i = 1; i < inputEvents.length; i += 1) {
        intervals.push(inputEvents[i].time - inputEvents[i - 1].time);
      }
      return intervals;
    }

    function calculateMetrics() {
      const target = currentSentence();
      const input = typingBox.value;
      const elapsedMs = state.startedAt ? Math.max(1, performance.now() - state.startedAt) : 0;
      const minutes = elapsedMs / 60000;
      const typedChars = input.length;
      const words = input.trim() ? input.trim().split(/\s+/).length : 0;
      const { correct, errors, inputLength, targetLength } = compareText(input, target);
      const accuracyBase = Math.max(inputLength, targetLength, 1);
      const accuracy = Math.max(0, Math.round((correct / accuracyBase) * 100));
      const intervals = getTypingIntervals();
      const avgInterval = intervals.length ? intervals.reduce((sum, item) => sum + item, 0) / intervals.length : 0;
      const pauseCount = intervals.filter((item) => item > 1200).length;
      const cpm = minutes ? Math.round(typedChars / minutes) : 0;
      const wpm = minutes ? Math.round(words / minutes) : 0;
      const variance = intervals.length
        ? intervals.reduce((sum, item) => sum + Math.pow(item - avgInterval, 2), 0) / intervals.length
        : 0;
      const stabilityPenalty = Math.min(28, Math.sqrt(variance) / 35);
      const pausePenalty = Math.min(30, pauseCount * 7);
      const errorPenalty = Math.min(35, errors.length * 8);
      const speedBonus = Math.min(14, cpm / 25);
      const fluency = Math.max(0, Math.min(100, Math.round(78 + speedBonus - stabilityPenalty - pausePenalty - errorPenalty)));

      return { accuracy, cpm, wpm, pauseCount, fluency, errors, typedChars, targetLength: target.length, avgInterval };
    }

    function renderEmptyTarget() {
      targetEl.className = "target";
      targetEl.innerHTML = `
        <div class="empty-library">
          <strong>还没有句库</strong>
          <span>${isGoogleUser()
            ? "导入 txt / lrc / tsv 句库，它会保存到你的 Google Drive「langLSRW」文件夹，换设备登录即可继续。"
            : "导入 txt / lrc / tsv 句库开始练习。游客模式下句库只保存在这台设备的浏览器里。"}</span>
          <button class="primary" type="button" data-open-library>打开句库</button>
        </div>`;
      counterEl.textContent = "0 / 0";
    }

    function renderTarget() {
      if (!state.sentences.length) {
        renderEmptyTarget();
        return;
      }
      const target = currentSentence();
      const translation = currentTranslation();
      const hasGrammarCache = Boolean(currentGrammar());
      const grammarSupported = activeLanguage() === "en";
      $("analyzeGrammarBtn").disabled = !grammarSupported;
      $("analyzeGrammarBtn").classList.toggle("has-cache", hasGrammarCache);
      $("analyzeGrammarBtn").title = !grammarSupported
        ? "AI 语法分析目前只支持英语句子"
        : hasGrammarCache
          ? "当前句已有缓存：左键查看，右键重新分析"
          : "左键分析当前句，右键重新分析";
      const showTranslation = $("showTranslationToggle").checked;
      const translationText = translation ? escapeHtml(translation) : "暂无翻译";
      const translationHtml = `<div class="translation-prompt ${showTranslation ? "" : "is-hidden"}">${showTranslation ? translationText : "&nbsp;"}</div>`;
      const grammarHtml = renderGrammarAnalysis();
      const input = typingBox.value;
      const inputChars = getCheckChars(input);
      let checkIndex = 0;
      let html = "";

      if (!$("showSourceToggle").checked) {
        targetEl.className = "target hidden-source";
        const revealedCount = getRevealedWordCount(input, target);
        let wordIndex = 0;
        html = getTargetWordPieces(target).map((piece) => {
          if (piece.type === "text") return escapeHtml(piece.text);
          const isRevealed = wordIndex < revealedCount;
          const currentWordIndex = wordIndex;
          wordIndex += 1;
          if (isRevealed) {
            return `<span class="target-word revealed-word" data-word="${escapeHtml(piece.text)}" data-word-index="${currentWordIndex}">${escapeHtml(piece.text)}</span>`;
          }
          return `<span class="target-word covered-word" data-word="${escapeHtml(piece.text)}" data-word-index="${currentWordIndex}">${escapeHtml(piece.text)}</span>`;
        }).join("");
        targetEl.innerHTML = `<span class="target-english">${html || "&nbsp;"}</span>${translationHtml}${grammarHtml}`;
        counterEl.textContent = `${state.index + 1} / ${state.sentences.length}`;
        $("translationInput").value = translation;
        return;
      }

      targetEl.className = "target";
      const alignment = alignInputWords(input, target);
      const correctTargetWords = new Set(
        alignment.pairs
          .filter((pair) => pair.status === "correct")
          .map((pair) => pair.targetIndex)
      );
      const wrongTargetWords = new Set(
        alignment.pairs
          .filter((pair) => pair.status === "wrong" && pair.targetIndex < alignment.targetWords.length)
          .map((pair) => pair.targetIndex)
      );
      let targetWordIndex = 0;

      html = getTargetWordPieces(target).map((piece) => {
        if (piece.type === "text") return escapeHtml(piece.text);
        const isWrong = wrongTargetWords.has(targetWordIndex);
        const isDone = correctTargetWords.has(targetWordIndex);
        const currentWordIndex = targetWordIndex;
        targetWordIndex += 1;
        const className = isWrong ? "wrong" : (isDone ? "done" : "pending");
        return `<span class="target-word ${className}" data-word="${escapeHtml(piece.text)}" data-word-index="${currentWordIndex}">${escapeHtml(piece.text)}</span>`;
      }).join("");

      targetEl.innerHTML = `<span class="target-english">${html || "&nbsp;"}</span>${translationHtml}${grammarHtml}`;
      counterEl.textContent = `${state.index + 1} / ${state.sentences.length}`;
      $("translationInput").value = translation;
    }

    function renderTypedPreview() {
      const input = typingBox.value;
      if (!input) {
        typedPreviewEl.innerHTML = "";
        return;
      }

      const alignment = alignInputWords(input, currentSentence());
      const inputStatus = new Map(alignment.pairs.map((pair) => [pair.inputIndex, pair.status]));
      let html = "";
      let cursor = 0;

      alignment.inputWords.forEach((word, index) => {
        if (word.start > cursor) html += escapeHtml(input.slice(cursor, word.start));
        const pairStatus = inputStatus.get(index);
        const status = pairStatus === "wrong" ? "typed-error" : "typed-ok";
        html += `<span class="${status}">${escapeHtml(input.slice(word.start, word.end))}</span>`;
        cursor = word.end;
      });

      if (cursor < input.length) html += escapeHtml(input.slice(cursor));

      typedPreviewEl.innerHTML = html;
    }

    function renderErrors(metrics = calculateMetrics()) {
      if (!errorsEl) return;
      if (!metrics.errors.length) {
        errorsEl.innerHTML = '<div class="empty">目前没有发现拼写错误。</div>';
        return;
      }

      errorsEl.innerHTML = metrics.errors.map((error) => `
        <div class="error-item">
          <span class="error-pos">#${error.pos}</span>
          <span class="error-text">
            应为 <span class="kbd">${escapeHtml(charLabel(error.expected))}</span>
            ，输入 <span class="kbd">${escapeHtml(charLabel(error.actual))}</span>
          </span>
        </div>
      `).join("");
    }

    function renderMetrics(metrics = calculateMetrics()) {
      $("accuracy").textContent = `${metrics.accuracy}%`;
      $("wpm").textContent = metrics.wpm;
      $("cpm").textContent = metrics.cpm;
      $("pauseCount").textContent = metrics.pauseCount;
      $("fluencyText").textContent = metrics.fluency;
      $("errorCount").textContent = metrics.errors.length;
      renderErrors(metrics);
    }

    function renderHistory() {
      if (!state.history.length) {
        historyEl.innerHTML = '<div class="empty">完成一句后会出现在这里。</div>';
        return;
      }

      historyEl.innerHTML = state.history.slice(0, 8).map((item) => `
        <div class="history-item">
          <strong>${escapeHtml(item.sentence)}</strong>
          <span>${item.accuracy}% · 流畅 ${item.fluency} · 错 ${item.errorCount} · ${item.wpm} WPM</span>
        </div>
      `).join("");
    }

    function render() {
      typingBox.disabled = !state.sentences.length;
      renderTarget();
      renderTypedPreview();
      renderErrors();
      renderHistory();
      renderSpeakingPage();
    }

    function switchSpeakingSentence(nextIndex, shouldSpeak = false) {
      stopSpeakingPractice();
      if (!state.sentences.length) return;
      state.index = (nextIndex + state.sentences.length) % state.sentences.length;
      saveProgress();
      state.grammarVisible = false;
      resetGrammarInteraction();
      typingBox.value = "";
      state.events = [];
      state.startedAt = 0;
      state.finished = false;
      state.lastSpokenWordKey = "";
      state.replaySlowStep = 0;
      updateSpeechRateIndicator();
      resetSpeakingResult();
      render();
      if (shouldSpeak) autoSpeakCurrentSentence();
    }

    function resetCurrent(shouldSpeak = false) {
      state.grammarVisible = false;
      resetGrammarInteraction();
      typingBox.value = "";
      state.events = [];
      state.startedAt = 0;
      state.finished = false;
      state.lastSpokenWordKey = "";
      state.replaySlowStep = 0;
      updateSpeechRateIndicator();
      render();
      if (shouldSpeak) autoSpeakCurrentSentence();
    }

    function mistakeSentenceIndices() {
      const mistakenSentences = new Set(state.history
        .filter((item) => item.errorCount > 0)
        .map((item) => item.sentence));
      return state.sentences
        .map((item, index) => mistakenSentences.has(sentenceText(item)) ? index : -1)
        .filter((index) => index >= 0);
    }

    function pickSentenceIndex(direction = 1) {
      if (!state.sentences.length) return 0;
      const mode = $("modeSelect").value;
      if (mode === "random") {
        if (state.sentences.length <= 1) return 0;
        let next = state.index;
        while (next === state.index) {
          next = Math.floor(Math.random() * state.sentences.length);
        }
        return next;
      }

      if (mode === "mistakes") {
        const indices = mistakeSentenceIndices();
        if (indices.length) {
          const currentPosition = indices.indexOf(state.index);
          if (currentPosition < 0) return direction < 0 ? indices[indices.length - 1] : indices[0];
          return indices[(currentPosition + direction + indices.length) % indices.length];
        }
      }

      return (state.index + direction + state.sentences.length) % state.sentences.length;
    }

    function pickNextIndex() {
      return pickSentenceIndex(1);
    }

    function toggleSourceVisibility() {
      $("showSourceToggle").checked = !$("showSourceToggle").checked;
      saveSpeechSettings();
      renderTarget();
    }

    function toggleTranslationVisibility() {
      $("showTranslationToggle").checked = !$("showTranslationToggle").checked;
      saveSpeechSettings();
      renderTarget();
    }

    function goNextSentence() {
      if (!state.sentences.length) return;
      state.index = pickNextIndex();
      saveProgress();
      resetCurrent(true);
    }

    function goPreviousSentence() {
      if (!state.sentences.length) return;
      state.index = pickSentenceIndex(-1);
      saveProgress();
      resetCurrent(true);
    }

    function stopSpeech() {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    }

    function closeTopMenus(exceptMenu = null) {
      document.querySelectorAll(".source-menu, .shortcut-menu, .font-menu, .user-menu").forEach((menu) => {
        if (menu !== exceptMenu) menu.removeAttribute("open");
      });
    }

    function finishCurrent() {
      if (!state.sentences.length) return;
      if (!typingBox.value.trim() && !state.startedAt) return;
      state.finished = true;
      const metrics = calculateMetrics();
      renderMetrics(metrics);
      const record = {
        sentence: currentSentence(),
        accuracy: metrics.accuracy,
        fluency: metrics.fluency,
        errorCount: metrics.errors.length,
        wpm: metrics.wpm,
        at: new Date().toISOString()
      };
      state.history.unshift(record);
      state.history = state.history.slice(0, 80);
      saveUserHistory();
      state.index = pickNextIndex();
      saveProgress();
      resetCurrent(true);
    }

    typingBox.addEventListener("keydown", (event) => {
      if (!event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey && event.key === "Escape") {
        event.preventDefault();
        typingBox.blur();
        return;
      }
      if (!event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey && event.key === "-") {
        event.preventDefault();
        replaySlower();
        return;
      }
      if (!event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey && event.key === "=") {
        event.preventDefault();
        replayCurrentSpeed();
        return;
      }
      if (!event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey && (event.key === "`" || event.code === "Backquote")) {
        event.preventDefault();
        replayNormalSpeed();
        return;
      }
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        finishCurrent();
        return;
      }
      if (event.ctrlKey && event.key === "Backspace") {
        event.preventDefault();
        resetCurrent();
      }
    });

    typingBox.addEventListener("input", (event) => {
      if (!state.startedAt) state.startedAt = performance.now();
      const inputType = event.inputType || "";
      state.events.push({
        type: inputType.startsWith("delete") ? "delete" : "input",
        value: typingBox.value,
        time: performance.now()
      });
      state.finished = false;
      maybeSpeakCompletedWord(inputType);
      render();
    });

    typingBox.addEventListener("scroll", () => {
      typedPreviewEl.scrollTop = typingBox.scrollTop;
      typedPreviewEl.scrollLeft = typingBox.scrollLeft;
    });

    $("fileInput").addEventListener("change", async (event) => {
      const [file] = event.target.files;
      await importSentenceFile(file);
      event.target.value = "";
    });

    $("useTextBtn").addEventListener("click", async () => {
      const sentences = parseLibraryText($("sentenceInput").value);
      if (!sentences.length) return;
      const stamp = new Date().toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
      if (await createLibrary({ name: `粘贴内容 ${stamp}`, source: "粘贴", items: sentences })) {
        $("sentenceInput").value = "";
        closeTopMenus();
      }
    });

    $("saveTranslationBtn").addEventListener("click", saveCurrentTranslation);
    $("saveAiSettingsBtn").addEventListener("click", saveAiSettings);
    $("openLibraryBtn").addEventListener("click", openLibraryModal);
    $("appNotice").addEventListener("click", () => {
      $("appNotice").hidden = true;
    });
    targetEl.addEventListener("click", (event) => {
      if (event.target.closest("[data-open-library]")) openLibraryModal();
    });
    $("closeLibraryBtn").addEventListener("click", closeLibraryModal);
    $("libraryModal").addEventListener("pointerdown", (event) => {
      if (event.target === $("libraryModal")) closeLibraryModal();
    });
    $("librarySearchInput").addEventListener("input", filterLibrary);
    $("libraryFirstPageBtn").addEventListener("click", () => goToLibraryPage(0));
    $("libraryPreviousPageBtn").addEventListener("click", () => goToLibraryPage(state.library.page - 1));
    $("libraryNextPageBtn").addEventListener("click", () => goToLibraryPage(state.library.page + 1));
    $("libraryLastPageBtn").addEventListener("click", () => goToLibraryPage(Number.MAX_SAFE_INTEGER));
    $("libraryPageInput").addEventListener("change", goToEnteredLibraryPage);
    $("libraryPageInput").addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      goToEnteredLibraryPage();
      $("libraryPageInput").select();
    });
    $("useLibraryBtn").addEventListener("click", () => useLibrary(state.library.selectedId));
    $("renameLibraryBtn").addEventListener("click", () => renameLibrary(state.library.selectedId));
    $("deleteLibraryBtn").addEventListener("click", () => deleteLibrary(state.library.selectedId));
    $("libraryList").addEventListener("click", (event) => {
      const button = event.target.closest("[data-library-id]");
      if (button) selectLibraryInModal(button.dataset.libraryId);
    });
    $("libraryImportBtn").addEventListener("click", () => $("libraryFileInput").click());
    $("libraryFileInput").addEventListener("change", async (event) => {
      const [file] = event.target.files;
      event.target.value = "";
      await importSentenceFile(file);
    });
    $("modeSelect").addEventListener("change", saveProgress);
    $("libraryLanguageSelect").addEventListener("change", (event) => setLibraryLanguage(state.library.selectedId, event.target.value));
    $("ignoreAccentsToggle").addEventListener("change", () => {
      saveSpeechSettings();
      render();
    });
    $("analyzeGrammarBtn").addEventListener("click", () => analyzeCurrentGrammar());
    $("analyzeGrammarBtn").addEventListener("contextmenu", openGrammarContextMenu);
    $("reanalyzeGrammarBtn").addEventListener("click", () => {
      closeGrammarContextMenu();
      analyzeCurrentGrammar({ force: true });
    });
    $("showAiPromptBtn").addEventListener("click", showCurrentAiPrompt);
    $("showAiResponseBtn").addEventListener("click", showCurrentAiResponse);
    $("showAiPromptBtn").addEventListener("contextmenu", (event) => openAiTextContextMenu(event, "prompt"));
    $("showAiResponseBtn").addEventListener("contextmenu", (event) => openAiTextContextMenu(event, "response"));
    $("copyAiContextBtn").addEventListener("click", copyAiContextText);
    $("copyAiTextBtn").addEventListener("click", copyAiText);
    $("closeAiTextModalBtn").addEventListener("click", closeAiTextModal);
    $("aiTextModal").addEventListener("pointerdown", (event) => {
      if (event.target === $("aiTextModal")) closeAiTextModal();
    });

    $("speakBtn").addEventListener("click", () => {
      saveSpeechSettings();
      speakCurrentSentence();
    });

    const holdSpeakBtn = $("startSpeakingBtn");
    holdSpeakBtn.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      if (state.speaking.holdActive || state.speaking.isStarting || state.speaking.isRecognizing || state.speaking.isRecording) return;
      state.speaking.holdActive = true;
      if (holdSpeakBtn.setPointerCapture) holdSpeakBtn.setPointerCapture(event.pointerId);
      startSpeakingPractice();
    });
    const releaseHoldSpeak = (event) => {
      if (event) event.preventDefault();
      scheduleStopSpeakingPractice();
    };
    holdSpeakBtn.addEventListener("pointerup", releaseHoldSpeak);
    holdSpeakBtn.addEventListener("pointercancel", releaseHoldSpeak);
    holdSpeakBtn.addEventListener("lostpointercapture", () => {
      scheduleStopSpeakingPractice();
    });
    holdSpeakBtn.addEventListener("click", (event) => event.preventDefault());
    $("previousUnifiedBtn").addEventListener("click", () => {
      switchSpeakingSentence(pickSentenceIndex(-1), true);
    });
    $("nextUnifiedBtn").addEventListener("click", () => {
      switchSpeakingSentence(pickSentenceIndex(1), true);
    });

    targetEl.addEventListener("mousedown", (event) => {
      const wordEl = targetWordFromEvent(event);
      if (!wordEl) return;

      if (event.button === 1) {
        event.preventDefault();
        speakTargetWord(wordEl);
        return;
      }

      if (event.button === 0 && targetEl.classList.contains("hidden-source")) {
        clearPeekedWord();
        wordEl.classList.add("peek-word");
        document.body.classList.add("hide-cursor");
      }
    });

    targetEl.addEventListener("click", (event) => {
      const levelButton = event.target.closest("[data-grammar-level]");
      if (levelButton) {
        setGrammarExpansion(levelButton.dataset.grammarLevel);
        return;
      }

      const toggleButton = event.target.closest("[data-grammar-toggle]");
      if (toggleButton) {
        const nodeId = Number(toggleButton.dataset.grammarToggle);
        if (state.grammarExpandedNodeIds.has(nodeId)) state.grammarExpandedNodeIds.delete(nodeId);
        else state.grammarExpandedNodeIds.add(nodeId);
        state.grammarExpansionMode = "custom";
        renderTarget();
        return;
      }

    });

    targetEl.addEventListener("auxclick", (event) => {
      const wordEl = targetWordFromEvent(event);
      if (!wordEl || event.button !== 1) return;
      event.preventDefault();
    });

    window.addEventListener("mouseup", clearPeekedWord);
    targetEl.addEventListener("mouseleave", clearPeekedWord);

    $("accentSelect").addEventListener("change", () => {
      state.speechSettings.voiceURI = "";
      populateVoices();
      saveSpeechSettings();
    });

    $("voiceSelect").addEventListener("change", saveSpeechSettings);
    $("autoSpeakToggle").addEventListener("change", saveSpeechSettings);
    $("speakWordToggle").addEventListener("change", saveSpeechSettings);
    $("showSourceToggle").addEventListener("change", () => {
      saveSpeechSettings();
      renderTarget();
    });
    $("showTranslationToggle").addEventListener("change", () => {
      saveSpeechSettings();
      renderTarget();
    });

    $("shortcutList").addEventListener("keydown", (event) => {
      const input = event.target.closest("[data-shortcut]");
      if (!input) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();

      if (event.key === "Escape") {
        input.blur();
        return;
      }

      if (event.key === "Backspace" || event.key === "Delete") {
        state.shortcuts[input.dataset.shortcut] = "";
        input.value = "";
        saveShortcuts();
        return;
      }

      const shortcut = normalizeShortcutEvent(event);
      if (!shortcut) return;
      shortcutActions.forEach((action) => {
        if (action.id !== input.dataset.shortcut && state.shortcuts[action.id] === shortcut) {
          state.shortcuts[action.id] = "";
        }
      });
      state.shortcuts[input.dataset.shortcut] = shortcut;
      saveShortcuts();
      renderShortcutSettings();
    }, true);

    $("shortcutList").addEventListener("keyup", (event) => {
      const input = event.target.closest("[data-shortcut]");
      if (!input) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
    }, true);

    $("resetShortcutsBtn").addEventListener("click", () => {
      state.shortcuts = { ...defaultShortcuts };
      saveShortcuts();
      renderShortcutSettings();
    });

    $("clearShortcutFocusBtn").addEventListener("click", () => {
      const active = document.activeElement;
      if (active && active.blur) active.blur();
    });

    $("themeToggleBtn").addEventListener("click", toggleTheme);
    $("paletteSelect").addEventListener("change", (event) => applyPalette(event.target.value));
    $("englishFontSelect").addEventListener("change", saveFontSettings);
    $("chineseFontSelect").addEventListener("change", saveFontSettings);
    $("resetFontSettingsBtn").addEventListener("click", resetFontSettings);
    $("grammarColorGrid").addEventListener("pointerdown", (event) => {
      const row = event.target.closest("[data-grammar-color-row]");
      if (row) setActiveGrammarColorRole(row.dataset.grammarColorRow);
    });
    $("grammarColorGrid").addEventListener("input", (event) => {
      const colorInput = event.target.closest("[data-grammar-color]");
      if (colorInput) {
        updateGrammarColor(colorInput.dataset.grammarColor, colorInput.value);
        return;
      }
      const hexInput = event.target.closest("[data-grammar-hex]");
      if (!hexInput) return;
      const normalized = normalizeHexInput(hexInput.value);
      hexInput.classList.toggle("is-invalid", hexInput.value.length >= 7 && !normalized);
      if (normalized) updateGrammarColor(hexInput.dataset.grammarHex, normalized);
    });
    $("grammarColorGrid").addEventListener("change", (event) => {
      const input = event.target.closest("[data-grammar-hex]");
      if (!input) return;
      if (!updateGrammarColor(input.dataset.grammarHex, input.value)) {
        input.value = state.grammarColors[input.dataset.grammarHex].toUpperCase();
        input.classList.remove("is-invalid");
      }
    });
    $("grammarCommonPalette").addEventListener("click", (event) => {
      const button = event.target.closest("[data-grammar-preset]");
      if (button) updateGrammarColor(activeGrammarColorRole, button.dataset.grammarPreset);
    });
    $("resetGrammarColorsBtn").addEventListener("click", resetGrammarColors);

    document.querySelectorAll(".page-tab").forEach((tab) => {
      tab.addEventListener("click", () => setActivePage(tab.dataset.pageTarget));
    });

    $("exportDataBtn").addEventListener("click", exportData);

    $("importDataBtn").addEventListener("click", () => {
      $("dataImportInput").click();
    });

    $("loginImportDataBtn").addEventListener("click", () => {
      $("dataImportInput").click();
    });

    $("resetSettingsBtn").addEventListener("click", resetGlobalSettings);

    $("clearUserBtn").addEventListener("click", clearCurrentUser);

    $("dataImportInput").addEventListener("change", async (event) => {
      const [file] = event.target.files;
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        restoreBackupData(data);
      } catch {
        alert("导入失败，请确认选择的是导出的 JSON 文件。");
      } finally {
        event.target.value = "";
      }
    });

    $("loginForm").addEventListener("submit", (event) => {
      event.preventDefault();
      loginAs($("usernameInput").value);
    });

    $("loginUsers").addEventListener("click", (event) => {
      const button = event.target.closest("[data-user]");
      if (!button) return;
      loginAs(button.dataset.user);
    });

    $("switchUserBtn").addEventListener("click", () => {
      showLogin();
    });

    $("googleLoginBtn").addEventListener("click", loginWithGoogle);
    $("cloudSyncBtn").addEventListener("click", () => syncWithCloud({ interactive: true }));
    $("cloudSwitchUserBtn").addEventListener("click", () => showLogin());
    $("googleLogoutBtn").addEventListener("click", clearCurrentUser);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden" && cloud.timer) syncWithCloud();
    });
    setInterval(() => scheduleCloudSync(0), 5 * 60 * 1000);

    document.querySelectorAll(".source-menu, .shortcut-menu, .font-menu, .user-menu").forEach((menu) => {
      menu.addEventListener("toggle", () => {
        if (menu.open) {
          closeTopMenus(menu);
          if (state.speaking.holdActive) scheduleStopSpeakingPractice();
          clearPeekedWord();
        }
      });
    });

    document.addEventListener("pointerdown", (event) => {
      if (!event.target.closest(".source-menu, .shortcut-menu, .font-menu, .user-menu")) {
        closeTopMenus();
      }
      if (!event.target.closest(".grammar-context-menu, #analyzeGrammarBtn")) {
        closeGrammarContextMenu();
      }
      if (!event.target.closest("#aiTextContextMenu, #showAiPromptBtn, #showAiResponseBtn")) {
        closeAiTextContextMenu();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeLibraryModal();
        closeAiTextModal();
        closeTopMenus();
        closeGrammarContextMenu();
        closeAiTextContextMenu();
      }
    });

    window.addEventListener("resize", closeGrammarContextMenu);
    window.addEventListener("scroll", closeGrammarContextMenu, true);
    window.addEventListener("resize", closeAiTextContextMenu);
    window.addEventListener("scroll", closeAiTextContextMenu, true);

    let dragDepth = 0;

    window.addEventListener("dragenter", (event) => {
      if (state.activePage !== "listenPage") return;
      event.preventDefault();
      dragDepth += 1;
      $("dropOverlay").classList.add("active");
    });

    window.addEventListener("dragover", (event) => {
      if (state.activePage !== "listenPage") return;
      event.preventDefault();
    });

    window.addEventListener("dragleave", (event) => {
      if (state.activePage !== "listenPage") return;
      event.preventDefault();
      dragDepth = Math.max(0, dragDepth - 1);
      if (!dragDepth) $("dropOverlay").classList.remove("active");
    });

    window.addEventListener("drop", async (event) => {
      if (state.activePage !== "listenPage") return;
      event.preventDefault();
      dragDepth = 0;
      $("dropOverlay").classList.remove("active");
      const [file] = event.dataTransfer ? Array.from(event.dataTransfer.files) : [];
      await importSentenceFile(file);
    });

    window.addEventListener("keydown", handleGlobalShortcut, { capture: true });
    window.addEventListener("keyup", handleGlobalShortcutKeyup, { capture: true });

    localStorage.removeItem("langLSRWTheme");
    applyColorMode(currentColorMode());
    applyPalette(document.documentElement.dataset.palette);
    applyFontSettings(state.fontSettings, { persist: false });
    applyGrammarColors(state.grammarColors, { persist: false });
    setActivePage(state.activePage);
    loadSpeechSettings();
    loadAiSettings();
    renderShortcutSettings();
    updateSpeechRateIndicator();
    populateVoices();
    if ("speechSynthesis" in window) {
      window.speechSynthesis.onvoiceschanged = populateVoices;
    }

    if (isGoogleUser() && !googleDrive.getProfile()) {
      state.currentUser = "";
      localStorage.removeItem("langLSRWCurrentUser");
    }
    updateUserBadge();
    render();
    if (state.currentUser) {
      $("loginScreen").classList.remove("active");
      loadUserData().then(() => syncWithCloud());
    } else {
      showLogin();
    }


