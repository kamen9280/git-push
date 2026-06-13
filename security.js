const LOCK_KEY = "bookmark-mobile-lock";
const BIOMETRIC_KEY = "bookmark-mobile-biometric";
const UNLOCK_KEY = "bookmark-mobile-unlocked-until";
const UNLOCK_DURATION_MS = 60 * 60 * 1000;

function bytesToBase64Url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function base64UrlToBytes(value) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function derivePinHash(pin, salt) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: 210000,
      hash: "SHA-256"
    },
    keyMaterial,
    256
  );
  return bytesToBase64Url(bits);
}

export function hasLock() {
  return Boolean(localStorage.getItem(LOCK_KEY));
}

export function isUnlocked() {
  const until = Number(sessionStorage.getItem(UNLOCK_KEY) || 0);
  if (!until || Date.now() > until) {
    sessionStorage.removeItem(UNLOCK_KEY);
    return false;
  }
  return true;
}

function markUnlocked() {
  sessionStorage.setItem(UNLOCK_KEY, String(Date.now() + UNLOCK_DURATION_MS));
}

export function lock() {
  sessionStorage.removeItem(UNLOCK_KEY);
}

export async function setupPin(pin) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePinHash(pin, salt);
  localStorage.setItem(
    LOCK_KEY,
    JSON.stringify({
      salt: bytesToBase64Url(salt),
      hash
    })
  );
  markUnlocked();
}

export async function unlockWithPin(pin) {
  const record = JSON.parse(localStorage.getItem(LOCK_KEY) || "null");
  if (!record) {
    return false;
  }

  const hash = await derivePinHash(pin, base64UrlToBytes(record.salt));
  const ok = hash === record.hash;
  if (ok) {
    markUnlocked();
  }
  return ok;
}

export function canUseBiometric() {
  return Boolean(window.PublicKeyCredential && navigator.credentials);
}

export function hasBiometricCredential() {
  return Boolean(localStorage.getItem(BIOMETRIC_KEY));
}

export async function enableBiometricUnlock() {
  if (!canUseBiometric()) {
    throw new Error("この環境ではPasskey/生体認証が使えません。");
  }

  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userId = crypto.getRandomValues(new Uint8Array(16));
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: {
        name: "Bookmark Vault Mobile"
      },
      user: {
        id: userId,
        name: "local-user",
        displayName: "Local user"
      },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        residentKey: "preferred",
        userVerification: "required"
      },
      timeout: 60000,
      attestation: "none"
    }
  });

  localStorage.setItem(
    BIOMETRIC_KEY,
    JSON.stringify({
      id: credential.id,
      rawId: bytesToBase64Url(credential.rawId)
    })
  );
  return true;
}

export async function unlockWithBiometric() {
  const record = JSON.parse(localStorage.getItem(BIOMETRIC_KEY) || "null");
  if (!record) {
    return false;
  }

  const credential = await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials: [
        {
          type: "public-key",
          id: base64UrlToBytes(record.rawId)
        }
      ],
      userVerification: "required",
      timeout: 60000
    }
  });

  if (credential) {
    markUnlocked();
    return true;
  }
  return false;
}
