// Puntuación de coincidencia entre una cuenta y el hostname de la pestaña actual.
// 3 = dominio configurado coincide; 1 = el emisor aparece en el hostname; 0 = nada.
export function matchScore(account, hostname) {
  if (!hostname) return 0;
  const host = hostname.toLowerCase().replace(/^www\./, "");
  if (account.domain) {
    const d = account.domain.toLowerCase().trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
    if (d && (host === d || host.endsWith("." + d))) return 3;
  }
  const iss = (account.issuer || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (iss.length >= 3 && host.replace(/[^a-z0-9]/g, "").includes(iss)) return 1;
  return 0;
}

export function bestMatches(accounts, hostname) {
  const scored = accounts.map((a) => ({ a, s: matchScore(a, hostname) })).filter((x) => x.s > 0);
  if (!scored.length) return [];
  const top = Math.max(...scored.map((x) => x.s));
  return scored.filter((x) => x.s === top).map((x) => x.a);
}
