const DB_NAME = "bookmark-vault-mobile";
const DB_VERSION = 1;

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      const bookmarks = db.createObjectStore("bookmarks", {
        keyPath: "id",
        autoIncrement: true
      });
      bookmarks.createIndex("normalizedUrl", "normalizedUrl", { unique: true });
      bookmarks.createIndex("createdAt", "createdAt");
      bookmarks.createIndex("folderId", "folderId");

      const folders = db.createObjectStore("folders", { keyPath: "id" });
      folders.createIndex("createdAt", "createdAt");
    };

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function transaction(storeName, mode, callback) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        const result = callback(store);
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error);
      })
  );
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

export function normalizeUrl(rawUrl) {
  const url = new URL(rawUrl);
  const tracking = new Set([
    "fbclid",
    "gclid",
    "igshid",
    "mc_cid",
    "mc_eid",
    "ref",
    "utm_campaign",
    "utm_content",
    "utm_medium",
    "utm_source",
    "utm_term"
  ]);

  url.hash = "";
  for (const key of Array.from(url.searchParams.keys())) {
    if (tracking.has(key.toLowerCase())) {
      url.searchParams.delete(key);
    }
  }
  url.hostname = url.hostname.toLowerCase();
  if (url.pathname.length > 1) {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }
  return url.toString();
}

export async function ensureDefaultFolder() {
  const existing = await getFolder("inbox");
  if (existing) {
    return existing;
  }

  const folder = {
    id: "inbox",
    name: "未整理",
    createdAt: Date.now()
  };
  await putFolder(folder);
  return folder;
}

export function getFolder(id) {
  return transaction("folders", "readonly", (store) => requestToPromise(store.get(id)));
}

export function putFolder(folder) {
  return transaction("folders", "readwrite", (store) => requestToPromise(store.put(folder)));
}

export async function listFolders() {
  await ensureDefaultFolder();
  const folders = await transaction("folders", "readonly", (store) =>
    requestToPromise(store.getAll())
  );
  return folders.sort((a, b) => a.createdAt - b.createdAt);
}

export async function addFolder(name) {
  const folder = {
    id: crypto.randomUUID(),
    name,
    createdAt: Date.now()
  };
  await putFolder(folder);
  return folder;
}

export async function saveBookmark(input) {
  const folder = await ensureDefaultFolder();
  const normalizedUrl = normalizeUrl(input.url);
  const existing = await transaction("bookmarks", "readonly", (store) =>
    requestToPromise(store.index("normalizedUrl").get(normalizedUrl))
  );

  if (existing) {
    const updated = {
      ...existing,
      title: input.title || existing.title,
      text: input.text || existing.text,
      sourceBrowser: input.sourceBrowser || existing.sourceBrowser,
      updatedAt: Date.now()
    };
    await transaction("bookmarks", "readwrite", (store) => requestToPromise(store.put(updated)));
    return { status: "duplicate", bookmark: updated };
  }

  const bookmark = {
    title: input.title || input.url,
    url: input.url,
    normalizedUrl,
    text: input.text || "",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    folderId: folder.id,
    source: "mobile-share",
    sourceBrowser: input.sourceBrowser || "unknown-mobile",
    syncStatus: "local-only"
  };

  const id = await transaction("bookmarks", "readwrite", (store) =>
    requestToPromise(store.add(bookmark))
  );
  return { status: "saved", bookmark: { ...bookmark, id } };
}

export async function listBookmarks() {
  const bookmarks = await transaction("bookmarks", "readonly", (store) =>
    requestToPromise(store.getAll())
  );
  return bookmarks.sort((a, b) => b.createdAt - a.createdAt);
}

export function updateBookmark(id, patch) {
  return transaction("bookmarks", "readwrite", async (store) => {
    const bookmark = await requestToPromise(store.get(id));
    return requestToPromise(store.put({ ...bookmark, ...patch, updatedAt: Date.now() }));
  });
}

export function deleteBookmark(id) {
  return transaction("bookmarks", "readwrite", (store) => requestToPromise(store.delete(id)));
}
