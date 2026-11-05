import { generateTOTP, secondsRemaining, parseImportText, normalizeSecret } from "./lib/totp.js";
import * as vault from "./lib/vault.js";
import { matchScore } from "./lib/match.js";
import { fillOtpInPage } from "./lib/fill.js";

const $ = (s) => document.querySelector(s);
let accounts = [];
let tab = null;
let host = "";
let ticker = null;
const rows = new Map(); // id -> { li, codeEl, secsEl, counter, code }

// ---------- utilidades UI ----------
function show(id) {
  for (const v of document.querySelectorAll(".view")) v.hidden = v.id !== id;
}
function status(msg, kind = "info") {
  const el = $("#status");
  el.textContent = msg;
  el.className = `status ${kind}`;
  el.hidden = !msg;
  clearTimeout(status.t);
  if (msg) status.t = setTimeout(() => (el.hidden = true), 4000);
}
async function copy(text) {
  await navigator.clipboard.writeText(text);
}
const uid = () => crypto.randomUUID();

// ---------- arranque ----------
async function init() {
  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try { host = new URL(tab.url).hostname; } catch { host = ""; }

  if (!(await vault.exists())) { show("setup"); $("#setup-pass").focus(); return; }
  if (!(await vault.getKey())) { show("unlock"); $("#unlock-pass").focus(); return; }
  await openMain();
}

async function openMain() {
  try {
    accounts = await vault.loadAccounts();
  } catch {
    show("unlock");
    return;
  }
  show("main");
  render();
  $("#search").focus();
  clearInterval(ticker);
  tick();
  ticker = setInterval(tick, 1000);
}

// ---------- lista ----------
function sorted() {
  const q = $("#search").value.trim().toLowerCase();
  return accounts
    .filter((a) => !q || `${a.issuer} ${a.label} ${a.domain || ""}`.toLowerCase().includes(q))
    .map((a) => ({ a, s: matchScore(a, host) }))
    .sort((x, y) => y.s - x.s || (x.a.issuer || "").localeCompare(y.a.issuer || ""))
    .map((x) => ({ ...x.a, _score: x.s }));
}

function render() {
  const list = $("#list");
  list.replaceChildren();
  rows.clear();
  const items = sorted();
  $("#empty").hidden = accounts.length > 0;
  const tpl = $("#item-tpl");
  for (const a of items) {
    const li = tpl.content.firstElementChild.cloneNode(true);
    if (a._score > 0) li.classList.add("match");
    li.querySelector(".issuer").textContent = a.issuer || "(sin servicio)";
    li.querySelector(".label").textContent = a.label || "";
    const codeEl = li.querySelector(".code");
    const secsEl = li.querySelector(".secs");
    const details = li.querySelector(".details");
    const domainEl = li.querySelector(".domain");
    domainEl.value = a.domain || "";

    codeEl.addEventListener("click", async () => {
      const r = rows.get(a.id);
      if (r?.code) { await copy(r.code); status("Código copiado", "ok"); }
    });
    li.querySelector(".fill").addEventListener("click", () => fill(a));
    li.querySelector(".more").addEventListener("click", () => {
      details.hidden = !details.hidden;
      if (!details.hidden && !domainEl.value && host) domainEl.placeholder = `p. ej. ${host.replace(/^www\./, "")}`;
    });
    li.querySelector(".save").addEventListener("click", async () => {
      const acc = accounts.find((x) => x.id === a.id);
      acc.domain = domainEl.value.trim();
      await vault.saveAccounts(accounts);
      status("Guardado", "ok");
      render();
      tick();
    });
    const del = li.querySelector(".del");
    del.addEventListener("click", async () => {
      if (!del.dataset.confirm) {
        del.dataset.confirm = "1";
        del.textContent = "¿Seguro? Pulsa otra vez";
        setTimeout(() => { delete del.dataset.confirm; del.textContent = "Eliminar"; }, 3000);
        return;
      }
      accounts = accounts.filter((x) => x.id !== a.id);
      await vault.saveAccounts(accounts);
      status("Cuenta eliminada", "ok");
      render();
      tick();
    });

    list.append(li);
    rows.set(a.id, { li, codeEl, secsEl, counter: -1, code: "" });
  }
}

async function tick() {
  const now = Date.now();
  const rem30 = secondsRemaining(30, now);
  const fillBar = $("#timer-fill");
  fillBar.style.width = `${(rem30 / 30) * 100}%`;
  fillBar.classList.toggle("low", rem30 <= 5);
  for (const a of accounts) {
    const r = rows.get(a.id);
    if (!r) continue;
    const period = a.period || 30;
    const counter = Math.floor(now / 1000 / period);
    if (counter !== r.counter) {
      r.counter = counter;
      try {
        r.code = await generateTOTP(a, now);
        const half = Math.ceil(r.code.length / 2);
        r.codeEl.textContent = `${r.code.slice(0, half)} ${r.code.slice(half)}`;
      } catch (e) {
        r.code = "";
        r.codeEl.textContent = "error";
        r.codeEl.title = e.message;
      }
    }
    const rem = secondsRemaining(period, now);
    r.secsEl.textContent = `${rem}s`;
    r.secsEl.classList.toggle("low", rem <= 5);
  }
}

async function fill(a) {
  // Si quedan ≤3 s, usa el siguiente código para que no caduque al enviarlo
  const now = Date.now();
  const period = a.period || 30;
  const t = secondsRemaining(period, now) <= 3 ? now + 4000 : now;
  const code = await generateTOTP(a, t);
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: fillOtpInPage,
      args: [code],
    });
    if (results.some((r) => r.result?.filled)) {
      window.close();
      return;
    }
    await copy(code);
    status("No encontré el campo del código. Lo he copiado al portapapeles.", "error");
  } catch (e) {
    await copy(code);
    status("No puedo acceder a esta página. Código copiado.", "error");
  }
}

// ---------- añadir ----------
function addAccounts(list) {
  const known = new Set(accounts.map((a) => a.secret));
  let added = 0, dup = 0;
  for (const a of list) {
    if (known.has(a.secret)) { dup++; continue; }
    known.add(a.secret);
    accounts.push({ id: uid(), domain: "", ...a });
    added++;
  }
  return { added, dup };
}

function log(lines) {
  const ul = $("#import-log");
  ul.replaceChildren();
  for (const [text, err] of lines) {
    const li = document.createElement("li");
    li.textContent = text;
    if (err) li.className = "err";
    ul.append(li);
  }
}

async function importText(text) {
  const { accounts: parsed, errors } = parseImportText(text);
  const { added, dup } = addAccounts(parsed);
  if (added) await vault.saveAccounts(accounts);
  log([
    [`Añadidas: ${added}${dup ? ` · Duplicadas omitidas: ${dup}` : ""}`, false],
    ...errors.map((e) => [e, true]),
  ]);
  if (added) status(`${added} cuenta(s) importada(s)`, "ok");
  else if (!errors.length) status("Nada nuevo que importar", "info");
}

// ---------- eventos ----------
$("#setup-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const p1 = $("#setup-pass").value, p2 = $("#setup-pass2").value;
  if (p1 !== p2) return status("Las contraseñas no coinciden", "error");
  status("Creando almacén…");
  await vault.create(p1);
  status("Almacén creado", "ok");
  await openMain();
});

$("#unlock-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    status("Desbloqueando…");
    await vault.unlock($("#unlock-pass").value);
    status("");
    await openMain();
  } catch (err) {
    status(err.message, "error");
    $("#unlock-pass").select();
  }
});

$("#search").addEventListener("input", () => { render(); rows.forEach((r) => (r.counter = -1)); tick(); });
$("#search").addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const first = sorted()[0];
  if (first) fill(accounts.find((a) => a.id === first.id));
});

$("#btn-lock").addEventListener("click", async () => {
  clearInterval(ticker);
  await vault.lock();
  accounts = [];
  show("unlock");
  $("#unlock-pass").value = "";
  $("#unlock-pass").focus();
});
$("#btn-add").addEventListener("click", () => {
  show("add");
  $("#import-log").replaceChildren();
  if (host) $("#m-domain").value = host.replace(/^www\./, "");
  $("#import-text").focus();
});
$("#btn-settings").addEventListener("click", () => show("settings"));
for (const b of document.querySelectorAll("[data-back]")) {
  b.addEventListener("click", async () => {
    $("#export-text").hidden = true;
    $("#export-text").value = "";
    await openMain();
  });
}

$("#btn-import").addEventListener("click", async () => {
  const text = $("#import-text").value.trim();
  if (!text) return;
  await importText(text);
  $("#import-text").value = "";
});

$("#qr-file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  if (!("BarcodeDetector" in self)) {
    return status("Tu navegador no soporta leer QR aquí. Escanéalo con el móvil y pega la URI.", "error");
  }
  try {
    const det = new BarcodeDetector({ formats: ["qr_code"] });
    const codes = await det.detect(await createImageBitmap(file));
    if (!codes.length) return status("No he encontrado ningún QR en la imagen", "error");
    await importText(codes.map((c) => c.rawValue).join("\n"));
  } catch (err) {
    status(`Error leyendo el QR: ${err.message}`, "error");
  }
});

$("#manual-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  let secret;
  try { secret = normalizeSecret($("#m-secret").value); }
  catch (err) { return status(err.message, "error"); }
  const { added, dup } = addAccounts([{
    issuer: $("#m-issuer").value.trim(),
    label: $("#m-label").value.trim(),
    secret,
    domain: $("#m-domain").value.trim(),
    digits: parseInt($("#m-digits").value, 10),
    algorithm: $("#m-algo").value,
    period: parseInt($("#m-period").value, 10) || 30,
  }]);
  if (dup) return status("Esa cuenta ya existe", "error");
  if (added) {
    await vault.saveAccounts(accounts);
    e.target.reset();
    status("Cuenta añadida", "ok");
  }
});

$("#pass-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const n1 = $("#p-new").value, n2 = $("#p-new2").value;
  if (n1 !== n2) return status("Las contraseñas nuevas no coinciden", "error");
  try {
    status("Cambiando…");
    await vault.changePassword($("#p-old").value, n1);
    e.target.reset();
    status("Contraseña cambiada", "ok");
  } catch (err) {
    status(err.message, "error");
  }
});

$("#btn-export").addEventListener("click", () => {
  const ta = $("#export-text");
  ta.value = accounts.map((a) => {
    const label = encodeURIComponent(a.issuer ? `${a.issuer}:${a.label || ""}` : a.label || "cuenta");
    const p = new URLSearchParams({ secret: a.secret, algorithm: a.algorithm || "SHA1", digits: a.digits || 6, period: a.period || 30 });
    if (a.issuer) p.set("issuer", a.issuer);
    return `otpauth://totp/${label}?${p}`;
  }).join("\n");
  ta.hidden = false;
  ta.select();
});

init();
