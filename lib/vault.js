// Almacén cifrado: AES-GCM 256 con clave derivada de la contraseña maestra (PBKDF2-SHA256).
// - Cifrado en chrome.storage.local (disco).
// - La clave desbloqueada vive solo en chrome.storage.session (memoria; se borra al cerrar el navegador
//   y no es accesible desde content scripts).

const ITERATIONS = 600000;
const AUTO_LOCK_MS = 15 * 60 * 1000;
const enc = new TextEncoder();
const dec = new TextDecoder();

const b64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function deriveKey(password, salt, iterations) {
  const base = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

async function encryptAccounts(key, accounts) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(accounts)));
  return { iv: b64(iv), ct: b64(ct) };
}

async function storeSessionKey(key) {
  const raw = await crypto.subtle.exportKey("raw", key);
  await chrome.storage.session.set({ vaultKey: b64(raw), lastUsed: Date.now() });
}

export async function exists() {
  const { vault } = await chrome.storage.local.get("vault");
  return !!vault;
}

export async function create(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(password, salt, ITERATIONS);
  const { iv, ct } = await encryptAccounts(key, []);
  await chrome.storage.local.set({ vault: { v: 1, salt: b64(salt), iterations: ITERATIONS, iv, ct } });
  await storeSessionKey(key);
}

export async function unlock(password) {
  const { vault } = await chrome.storage.local.get("vault");
  if (!vault) throw new Error("No hay almacén creado");
  const key = await deriveKey(password, unb64(vault.salt), vault.iterations);
  try {
    await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(vault.iv) }, key, unb64(vault.ct));
  } catch {
    throw new Error("Contraseña incorrecta");
  }
  await storeSessionKey(key);
}

export async function lock() {
  await chrome.storage.session.remove(["vaultKey", "lastUsed"]);
}

// Devuelve la CryptoKey si está desbloqueado y no ha caducado; si no, null.
export async function getKey() {
  const { vaultKey, lastUsed } = await chrome.storage.session.get(["vaultKey", "lastUsed"]);
  if (!vaultKey) return null;
  if (!lastUsed || Date.now() - lastUsed > AUTO_LOCK_MS) {
    await lock();
    return null;
  }
  await chrome.storage.session.set({ lastUsed: Date.now() });
  return crypto.subtle.importKey("raw", unb64(vaultKey), { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function loadAccounts() {
  const key = await getKey();
  if (!key) throw new Error("Bloqueado");
  const { vault } = await chrome.storage.local.get("vault");
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(vault.iv) }, key, unb64(vault.ct));
  return JSON.parse(dec.decode(pt));
}

export async function saveAccounts(accounts) {
  const key = await getKey();
  if (!key) throw new Error("Bloqueado");
  const { vault } = await chrome.storage.local.get("vault");
  const { iv, ct } = await encryptAccounts(key, accounts);
  await chrome.storage.local.set({ vault: { ...vault, iv, ct } });
}

export async function changePassword(oldPassword, newPassword) {
  await unlock(oldPassword);
  const accounts = await loadAccounts();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(newPassword, salt, ITERATIONS);
  const { iv, ct } = await encryptAccounts(key, accounts);
  await chrome.storage.local.set({ vault: { v: 1, salt: b64(salt), iterations: ITERATIONS, iv, ct } });
  await storeSessionKey(key);
}
