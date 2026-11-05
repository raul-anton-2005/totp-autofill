// TOTP (RFC 6238) + parsing de URIs otpauth:// y otpauth-migration:// (exportación de Google Authenticator)

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Decode(str) {
  const clean = String(str).toUpperCase().replace(/[\s=-]/g, "");
  if (!clean) throw new Error("Secreto vacío");
  let bits = 0, value = 0;
  const out = [];
  for (const ch of clean) {
    const i = B32.indexOf(ch);
    if (i < 0) throw new Error(`Carácter no válido en el secreto Base32: "${ch}"`);
    value = ((value << 5) | i) & 0xffff;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

export function base32Encode(bytes) {
  let bits = 0, value = 0, out = "";
  for (const b of bytes) {
    value = ((value << 8) | b) & 0xffff;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function normalizeSecret(secret) {
  const s = String(secret).toUpperCase().replace(/[\s=-]/g, "");
  base32Decode(s); // valida
  return s;
}

const HASHES = { SHA1: "SHA-1", SHA256: "SHA-256", SHA512: "SHA-512" };

export async function generateTOTP(account, now = Date.now()) {
  const { secret, algorithm = "SHA1", digits = 6, period = 30 } = account;
  const hash = HASHES[algorithm];
  if (!hash) throw new Error(`Algoritmo no soportado: ${algorithm}`);
  const counter = Math.floor(now / 1000 / period);
  const msg = new ArrayBuffer(8);
  const view = new DataView(msg);
  view.setUint32(0, Math.floor(counter / 2 ** 32));
  view.setUint32(4, counter >>> 0);
  const key = await crypto.subtle.importKey(
    "raw", base32Decode(secret), { name: "HMAC", hash: { name: hash } }, false, ["sign"]
  );
  const h = new Uint8Array(await crypto.subtle.sign("HMAC", key, msg));
  const o = h[h.length - 1] & 0x0f;
  const bin = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(bin % 10 ** digits).padStart(digits, "0");
}

export function secondsRemaining(period = 30, now = Date.now()) {
  return period - (Math.floor(now / 1000) % period);
}

// otpauth://totp/Issuer:cuenta?secret=XXX&issuer=Issuer&algorithm=SHA1&digits=6&period=30
export function parseOtpauthURI(uri) {
  const url = new URL(uri.trim());
  if (url.protocol !== "otpauth:") throw new Error("No es una URI otpauth://");
  const type = (url.hostname || url.host).toLowerCase();
  if (type !== "totp") throw new Error(`Tipo "${type}" no soportado (solo TOTP)`);
  const label = decodeURIComponent(url.pathname.replace(/^\//, ""));
  let issuer = "", name = label;
  const idx = label.indexOf(":");
  if (idx >= 0) {
    issuer = label.slice(0, idx).trim();
    name = label.slice(idx + 1).trim();
  }
  const p = url.searchParams;
  if (p.get("issuer")) issuer = p.get("issuer");
  const secret = p.get("secret");
  if (!secret) throw new Error("La URI no contiene secret");
  const algorithm = (p.get("algorithm") || "SHA1").toUpperCase().replace("-", "");
  if (!HASHES[algorithm]) throw new Error(`Algoritmo no soportado: ${algorithm}`);
  return {
    issuer,
    label: name,
    secret: normalizeSecret(secret),
    algorithm,
    digits: parseInt(p.get("digits") || "6", 10),
    period: parseInt(p.get("period") || "30", 10),
  };
}

// --- Exportación de Google Authenticator: otpauth-migration://offline?data=<base64 protobuf>

function readVarint(buf, pos) {
  let result = 0, shift = 0, b;
  do {
    if (pos >= buf.length) throw new Error("Protobuf truncado");
    b = buf[pos++];
    result += (b & 0x7f) * 2 ** shift;
    shift += 7;
  } while (b & 0x80);
  return [result, pos];
}

function parseProto(buf) {
  const fields = [];
  let pos = 0;
  while (pos < buf.length) {
    let key;
    [key, pos] = readVarint(buf, pos);
    const field = Math.floor(key / 8), wt = key % 8;
    if (wt === 0) {
      let v;
      [v, pos] = readVarint(buf, pos);
      fields.push({ field, value: v });
    } else if (wt === 2) {
      let len;
      [len, pos] = readVarint(buf, pos);
      fields.push({ field, value: buf.subarray(pos, pos + len) });
      pos += len;
    } else if (wt === 1) pos += 8;
    else if (wt === 5) pos += 4;
    else throw new Error(`Tipo protobuf no soportado: ${wt}`);
  }
  return fields;
}

const utf8 = new TextDecoder();
const MIG_ALGO = { 0: "SHA1", 1: "SHA1", 2: "SHA256", 3: "SHA512" };
const MIG_DIGITS = { 0: 6, 1: 6, 2: 8 };

export function parseMigrationURI(uri) {
  const m = uri.trim().match(/[?&]data=([^&]+)/);
  if (!m) throw new Error("La URI de migración no contiene data");
  const b64 = decodeURIComponent(m[1]).replace(/ /g, "+").replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const buf = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  const accounts = [], skipped = [];
  for (const f of parseProto(buf)) {
    if (f.field !== 1) continue;
    const p = { secret: null, name: "", issuer: "", algorithm: 0, digits: 0, type: 0 };
    for (const g of parseProto(f.value)) {
      if (g.field === 1) p.secret = g.value;
      else if (g.field === 2) p.name = utf8.decode(g.value);
      else if (g.field === 3) p.issuer = utf8.decode(g.value);
      else if (g.field === 4) p.algorithm = g.value;
      else if (g.field === 5) p.digits = g.value;
      else if (g.field === 6) p.type = g.value;
    }
    let label = p.name, issuer = p.issuer;
    const idx = label.indexOf(":");
    if (idx >= 0) {
      if (!issuer) issuer = label.slice(0, idx).trim();
      label = label.slice(idx + 1).trim();
    }
    const display = issuer ? `${issuer} (${label})` : label;
    if (p.type === 1) { skipped.push(`${display}: HOTP no soportado`); continue; }
    if (!MIG_ALGO[p.algorithm]) { skipped.push(`${display}: algoritmo no soportado`); continue; }
    if (!p.secret || !p.secret.length) { skipped.push(`${display}: sin secreto`); continue; }
    accounts.push({
      issuer, label,
      secret: base32Encode(p.secret),
      algorithm: MIG_ALGO[p.algorithm],
      digits: MIG_DIGITS[p.digits] || 6,
      period: 30,
    });
  }
  return { accounts, skipped };
}

// Acepta varias líneas mezclando otpauth:// y otpauth-migration://
export function parseImportText(text) {
  const accounts = [], errors = [];
  for (const line of text.split(/\s+/).map((l) => l.trim()).filter(Boolean)) {
    try {
      if (line.startsWith("otpauth-migration://")) {
        const r = parseMigrationURI(line);
        accounts.push(...r.accounts);
        errors.push(...r.skipped);
      } else if (line.startsWith("otpauth://")) {
        accounts.push(parseOtpauthURI(line));
      } else {
        errors.push(`Ignorado (no es otpauth): ${line.slice(0, 30)}…`);
      }
    } catch (e) {
      errors.push(e.message);
    }
  }
  return { accounts, errors };
}
