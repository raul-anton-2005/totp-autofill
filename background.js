import * as vault from "./lib/vault.js";
import { generateTOTP } from "./lib/totp.js";
import { bestMatches } from "./lib/match.js";
import { fillOtpInPage } from "./lib/fill.js";

function badge(tabId, text, color) {
  chrome.action.setBadgeBackgroundColor({ tabId, color });
  chrome.action.setBadgeText({ tabId, text });
  setTimeout(() => chrome.action.setBadgeText({ tabId, text: "" }), 2500);
}

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== "fill-totp" || !tab?.id) return;
  try {
    const key = await vault.getKey();
    if (!key) return badge(tab.id, "LOCK", "#b45309"); // bloqueado: abre el popup y desbloquea
    const accounts = await vault.loadAccounts();
    let host = "";
    try { host = new URL(tab.url).hostname; } catch {}
    const matches = bestMatches(accounts, host);
    if (matches.length !== 1) return badge(tab.id, matches.length ? "2+" : "?", "#b91c1c");
    const code = await generateTOTP(matches[0]);
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: fillOtpInPage,
      args: [code],
    });
    const ok = results.some((r) => r.result?.filled);
    badge(tab.id, ok ? "OK" : "NO", ok ? "#15803d" : "#b91c1c");
  } catch (e) {
    console.error(e);
    badge(tab.id, "ERR", "#b91c1c");
  }
});
