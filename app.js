import {
  addFolder,
  deleteBookmark,
  listBookmarks,
  listFolders,
  saveBookmark,
  updateBookmark
} from "./db.js";
import {
  canUseBiometric,
  enableBiometricUnlock,
  hasBiometricCredential,
  hasLock,
  isUnlocked,
  lock,
  setupPin,
  unlockWithBiometric,
  unlockWithPin
} from "./security.js";

const state = {
  bookmarks: [],
  folders: [],
  selectedFolder: "all",
  selectedIds: new Set(),
  query: "",
  toast: ""
};

const app = document.querySelector("#app");

function toast(message) {
  state.toast = message;
  render();
  setTimeout(() => {
    state.toast = "";
    render();
  }, 3200);
}

function getParamMessage() {
  const params = new URLSearchParams(location.search);
  if (params.get("saved")) {
    history.replaceState(null, "", "/index.html");
    return "共有されたブックマークを保存しました。";
  }
  if (params.get("error")) {
    history.replaceState(null, "", "/index.html");
    return "共有データからURLを見つけられませんでした。";
  }
  return "";
}

async function refreshData() {
  state.bookmarks = await listBookmarks();
  state.folders = await listFolders();
}

function filteredBookmarks() {
  const query = state.query.trim().toLowerCase();
  return state.bookmarks.filter((bookmark) => {
    const folderOk =
      state.selectedFolder === "all" ? true : bookmark.folderId === state.selectedFolder;
    const queryOk = query
      ? [bookmark.title, bookmark.url, bookmark.text, bookmark.sourceBrowser]
          .join(" ")
          .toLowerCase()
          .includes(query)
      : true;
    return folderOk && queryOk;
  });
}

function folderCounts() {
  const counts = new Map();
  for (const bookmark of state.bookmarks) {
    counts.set(bookmark.folderId || "inbox", (counts.get(bookmark.folderId || "inbox") || 0) + 1);
  }
  return counts;
}

function bulkHtml(bookmarks) {
  const selectedCount = state.selectedIds.size;
  if (selectedCount === 0) {
    return `
      <div class="bulk-bar">
        <span>${bookmarks.length}件表示</span>
        <button id="select-visible" class="secondary">表示中を全選択</button>
      </div>
    `;
  }

  return `
    <div class="bulk-bar active">
      <span>${selectedCount}件選択中</span>
      <select id="bulk-folder">
        ${state.folders
          .map((folder) => `<option value="${folder.id}">${folder.name}</option>`)
          .join("")}
      </select>
      <button id="bulk-move">選択を移動</button>
      <button id="clear-selection" class="secondary">解除</button>
    </div>
  `;
}

function bookmarksHtml(bookmarks) {
  return bookmarks
    .map(
      (bookmark) => `
        <article class="bookmark">
          <label class="select-row">
            <input type="checkbox" data-select="${bookmark.id}" ${state.selectedIds.has(bookmark.id) ? "checked" : ""} />
            <span>選択</span>
          </label>
          <a href="${bookmark.url}" target="_blank" rel="noreferrer">${bookmark.title}</a>
          <p class="url">${bookmark.url}</p>
          <p class="meta">${new Date(bookmark.createdAt).toLocaleString()} / ${bookmark.sourceBrowser} / ${bookmark.syncStatus}</p>
          ${bookmark.text ? `<p class="excerpt">${bookmark.text}</p>` : ""}
          <div class="card-actions">
            <select data-move="${bookmark.id}">
              ${state.folders
                .map(
                  (folder) =>
                    `<option value="${folder.id}" ${folder.id === bookmark.folderId ? "selected" : ""}>${folder.name}</option>`
                )
                .join("")}
            </select>
            <button class="danger" data-delete="${bookmark.id}">削除</button>
          </div>
        </article>
      `
    )
    .join("");
}

function renderResults() {
  const bookmarks = filteredBookmarks();
  const bulkArea = document.querySelector("#bulk-area");
  const list = document.querySelector("#bookmark-list");
  if (!bulkArea || !list) {
    return;
  }

  bulkArea.innerHTML = bulkHtml(bookmarks);
  list.innerHTML = bookmarksHtml(bookmarks);
  bindResultEvents();
}

function bindResultEvents() {
  document.querySelectorAll("[data-select]").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const id = Number(checkbox.dataset.select);
      if (checkbox.checked) {
        state.selectedIds.add(id);
      } else {
        state.selectedIds.delete(id);
      }
      renderResults();
    });
  });

  document.querySelector("#select-visible")?.addEventListener("click", () => {
    for (const bookmark of filteredBookmarks()) {
      state.selectedIds.add(bookmark.id);
    }
    renderResults();
  });

  document.querySelector("#clear-selection")?.addEventListener("click", () => {
    state.selectedIds.clear();
    renderResults();
  });

  document.querySelector("#bulk-move")?.addEventListener("click", async () => {
    const folderId = document.querySelector("#bulk-folder")?.value;
    if (!folderId || state.selectedIds.size === 0) {
      return;
    }
    await Promise.all(
      Array.from(state.selectedIds).map((id) => updateBookmark(id, { folderId }))
    );
    state.selectedIds.clear();
    await refreshData();
    render();
    toast("選択したブックマークを移動しました。");
  });

  document.querySelectorAll("[data-move]").forEach((select) => {
    select.addEventListener("change", async () => {
      await updateBookmark(Number(select.dataset.move), { folderId: select.value });
      await refreshData();
      render();
    });
  });

  document.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = Number(button.dataset.delete);
      await deleteBookmark(id);
      state.selectedIds.delete(id);
      await refreshData();
      render();
      toast("削除しました。");
    });
  });
}

function renderLockScreen() {
  const setup = !hasLock();
  app.innerHTML = `
    <main class="lock-screen">
      <section class="lock-card">
        <h1>Bookmark Vault</h1>
        <p>${setup ? "最初のPINを設定してください。" : "ロックを解除してください。"}</p>
        <form id="pin-form" class="stack">
          <input id="pin" type="password" inputmode="numeric" minlength="4" placeholder="PIN / パスコード" autocomplete="current-password" />
          <button>${setup ? "設定して開く" : "解除する"}</button>
        </form>
        ${
          !setup && hasBiometricCredential()
            ? '<button id="biometric-unlock" class="secondary full">指紋/顔認証で解除</button>'
            : ""
        }
      </section>
    </main>
  `;

  document.querySelector("#pin-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const pin = document.querySelector("#pin").value;
    if (pin.length < 4) {
      toast("PINは4文字以上にしてください。");
      return;
    }

    if (setup) {
      await setupPin(pin);
      await refreshData();
      render();
      return;
    }

    if (await unlockWithPin(pin)) {
      await refreshData();
      render();
    } else {
      toast("PINが違います。");
    }
  });

  const biometricButton = document.querySelector("#biometric-unlock");
  if (biometricButton) {
    biometricButton.addEventListener("click", async () => {
      try {
        if (await unlockWithBiometric()) {
          await refreshData();
          render();
        }
      } catch {
        toast("生体認証で解除できませんでした。");
      }
    });
  }
}

function renderApp() {
  const bookmarks = filteredBookmarks();
  const counts = folderCounts();
  app.innerHTML = `
    <main class="page">
      <header class="topbar">
        <div>
          <h1>Bookmark Vault</h1>
          <p>${state.bookmarks.length}件 / 同期はまだローカルのみ</p>
        </div>
        <button id="lock" class="secondary">ロック</button>
      </header>

      <section class="quick-save">
        <form id="manual-save" class="manual-form">
          <input id="manual-url" type="url" placeholder="URLを貼って保存" />
          <input id="manual-title" placeholder="タイトル 任意" />
          <button>保存</button>
        </form>
      </section>

      <div class="layout">
        <aside class="sidebar">
          <button class="${state.selectedFolder === "all" ? "folder active" : "folder"}" data-folder="all">
            <span>すべて</span><span>${state.bookmarks.length}</span>
          </button>
          ${state.folders
            .map(
              (folder) => `
                <button class="${state.selectedFolder === folder.id ? "folder active" : "folder"}" data-folder="${folder.id}">
                  <span>${folder.name}</span><span>${counts.get(folder.id) || 0}</span>
                </button>
              `
            )
            .join("")}
          <form id="folder-form" class="folder-form">
            <input id="folder-name" placeholder="新しいフォルダ" />
            <button>追加</button>
          </form>
        </aside>

        <section class="content">
          <div class="toolbar">
            <input id="search" value="${state.query}" placeholder="タイトル、URL、共有本文で検索" />
            <button id="enable-biometric" class="secondary">${hasBiometricCredential() ? "生体認証 有効" : "生体認証を有効化"}</button>
          </div>

          <div id="bulk-area">${bulkHtml(bookmarks)}</div>
          <section id="bookmark-list" class="list">${bookmarksHtml(bookmarks)}</section>
        </section>
      </div>
      ${state.toast ? `<div class="toast">${state.toast}</div>` : ""}
    </main>
  `;

  document.querySelector("#lock").addEventListener("click", () => {
    lock();
    render();
  });

  document.querySelector("#manual-save").addEventListener("submit", async (event) => {
    event.preventDefault();
    const url = document.querySelector("#manual-url").value.trim();
    const title = document.querySelector("#manual-title").value.trim();
    if (!url) {
      return;
    }
    const result = await saveBookmark({ url, title, text: "", sourceBrowser: "manual-mobile" });
    await refreshData();
    render();
    toast(result.status === "duplicate" ? "既存ブックマークを更新しました。" : "保存しました。");
  });

  document.querySelector("#folder-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = document.querySelector("#folder-name").value.trim();
    if (!name) {
      return;
    }
    await addFolder(name);
    await refreshData();
    render();
  });

  document.querySelector("#search").addEventListener("input", (event) => {
    state.query = event.target.value;
    renderResults();
  });

  document.querySelectorAll("[data-folder]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedFolder = button.dataset.folder;
      render();
    });
  });

  bindResultEvents();

  document.querySelector("#enable-biometric").addEventListener("click", async () => {
    if (hasBiometricCredential()) {
      toast("生体認証は有効化済みです。");
      return;
    }
    if (!canUseBiometric()) {
      toast("この環境では生体認証を使えません。");
      return;
    }
    try {
      await enableBiometricUnlock();
      render();
      toast("生体認証を有効化しました。");
    } catch {
      toast("生体認証の有効化に失敗しました。");
    }
  });
}

function render() {
  if (!isUnlocked()) {
    renderLockScreen();
    return;
  }
  renderApp();
}

async function main() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js");
  }

  const message = getParamMessage();
  if (isUnlocked()) {
    await refreshData();
  }
  render();
  if (message) {
    toast(message);
  }
}

main();
