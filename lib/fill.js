// Se inyecta en la página con chrome.scripting.executeScript. Debe ser autocontenida (sin cierres externos).
export function fillOtpInPage(code) {
  const visible = (el) => {
    if (el.disabled || el.readOnly) return false;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && s.opacity !== "0";
  };
  // Setter nativo: necesario para que React/Vue/Angular detecten el cambio.
  const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  const setVal = (el, v) => {
    el.focus();
    nativeSetter.call(el, v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const textOf = (el) => {
    const parts = [el.name, el.id, el.placeholder, el.getAttribute("aria-label"), el.autocomplete, el.className];
    if (el.id) {
      const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (lbl) parts.push(lbl.textContent);
    }
    const wrap = el.closest("label");
    if (wrap) parts.push(wrap.textContent);
    return parts.filter(Boolean).join(" ").toLowerCase();
  };

  const OTP_RE = /(one.?time|otp|totp|2fa|mfa|two.?factor|2.?step|verif|authenticat|auth.?code|security.?code|passcode|token|c[oó]digo|code)/i;
  const EXCLUDE_RE = /(search|buscar|captcha|zip|postal|phone|tel[eé]fono|coupon|cup[oó]n|promo|email|user)/i;
  const types = ["", "text", "tel", "number", "password"];

  const inputs = [...document.querySelectorAll("input")].filter(
    (el) => types.includes((el.getAttribute("type") || "").toLowerCase()) && visible(el)
  );
  if (!inputs.length) return { filled: false, reason: "no-inputs" };

  // 1) Estándar HTML
  const std = inputs.find((el) => (el.autocomplete || "").toLowerCase() === "one-time-code" && el.maxLength !== 1);
  if (std) { setVal(std, code); return { filled: true, mode: "autocomplete" }; }

  // 2) Cajas de un dígito (6 inputs maxlength=1)
  const singles = inputs.filter((el) => el.maxLength === 1);
  if (singles.length >= code.length) {
    // Busca el primer grupo de N casillas que compartan un ancestro cercano
    for (let i = 0; i + code.length <= singles.length; i++) {
      const group = singles.slice(i, i + code.length);
      const anc = group[0].parentElement?.parentElement?.parentElement;
      if (anc && group.every((el) => anc.contains(el))) {
        group.forEach((el, k) => {
          setVal(el, code[k]);
          el.dispatchEvent(new KeyboardEvent("keyup", { key: code[k], bubbles: true }));
        });
        return { filled: true, mode: "split" };
      }
    }
  }

  // 3) Heurística por texto y atributos
  let best = null, bestScore = 0;
  for (const el of inputs) {
    if (el.maxLength === 1) continue;
    const t = textOf(el);
    let score = 0;
    if (OTP_RE.test(t)) score += 3;
    if (EXCLUDE_RE.test(t) && !/(otp|2fa|totp|mfa)/i.test(t)) score -= 4;
    if (el.inputMode === "numeric" || el.getAttribute("type") === "tel" || el.getAttribute("type") === "number") score += 1;
    if (el.maxLength >= 6 && el.maxLength <= 8) score += 2;
    if (el.pattern && /\\d|\[0-9\]/.test(el.pattern)) score += 1;
    if ((el.getAttribute("type") || "") === "password" && !OTP_RE.test(t)) score -= 5;
    if (document.activeElement === el) score += 1;
    if (score > bestScore) { best = el; bestScore = score; }
  }
  if (best && bestScore >= 3) { setVal(best, code); return { filled: true, mode: "heuristic" }; }

  // 4) Último recurso: el input enfocado, si está vacío y es texto/numérico
  const a = document.activeElement;
  if (a && a.tagName === "INPUT" && inputs.includes(a) && !a.value &&
      (a.getAttribute("type") || "") !== "password" && !EXCLUDE_RE.test(textOf(a))) {
    setVal(a, code);
    return { filled: true, mode: "focused" };
  }
  return { filled: false, reason: "no-match" };
}
