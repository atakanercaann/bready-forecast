// access.config.js
var AREAS = [
  {
    key: "sales",
    label: "Sat\u0131\u015F",
    group: "Mutfak",
    means: { view: "Sat\u0131\u015Flar\u0131 g\xF6r\xFCr", edit: "Sat\u0131\u015F girer, PDF/CSV y\xFCkler, e\u015Fle\u015Ftirme yapar", delete: "Sat\u0131\u015F siler", full: "Her \u015Fey" }
  },
  {
    key: "usage",
    label: "Kullan\u0131m",
    group: "Mutfak",
    means: { view: "Kullan\u0131lan malzemeleri g\xF6r\xFCr" }
  },
  {
    key: "plan",
    label: "Plan (prep + sipari\u015F)",
    group: "Mutfak",
    means: { view: "Tahmin, prep ve sipari\u015F listesini g\xF6r\xFCr", edit: "Tarih, buffer ve stok de\u011Fi\u015Ftirir", delete: "Plan ayarlar\u0131n\u0131 siler" }
  },
  {
    key: "recipes",
    label: "Re\xE7eteler",
    group: "Ayarlar",
    means: { view: "Re\xE7eteleri g\xF6r\xFCr", edit: "Re\xE7ete ekler ve de\u011Fi\u015Ftirir", delete: "Re\xE7ete siler" }
  },
  {
    key: "ingredients",
    label: "Malzemeler ve fiyatlar",
    group: "Ayarlar",
    means: { view: "Malzemeleri ve fiyatlar\u0131 g\xF6r\xFCr", edit: "Fiyat, paket ve tedarik\xE7i de\u011Fi\u015Ftirir", delete: "Malzeme siler" }
  },
  {
    key: "calendar",
    label: "\xD6zel g\xFCnler",
    group: "Ayarlar",
    means: { view: "\xD6zel g\xFCnleri g\xF6r\xFCr", edit: "\xD6zel g\xFCn ekler ve de\u011Fi\u015Ftirir", delete: "\xD6zel g\xFCn siler" }
  },
  {
    key: "invoices",
    label: "Faturalar",
    group: "Sat\u0131n alma",
    means: { view: "Faturalar\u0131 ve dosyalar\u0131n\u0131 g\xF6r\xFCr, d\u0131\u015Fa aktar\u0131r", edit: "Fatura y\xFCkler ve d\xFCzeltir", delete: "Fatura siler", full: "\xD6denmi\u015F faturay\u0131 da de\u011Fi\u015Ftirir ve siler" }
  },
  {
    key: "team",
    label: "Ekip ve eri\u015Fim",
    group: "Y\xF6netim",
    means: {
      none: "Ekip sayfas\u0131 g\xF6r\xFCnmez",
      view: "Ekipte kim var, kim neye eri\u015Fiyor g\xF6r\xFCr",
      edit: "Ki\u015Fi davet eder, kendi seviyesine kadar yetki verir",
      delete: "Ki\u015Fiyi ekipten \xE7\u0131kar\u0131r",
      full: "Herkese her yetkiyi verir"
    }
  }
];
var ADMIN_AREA = "team";

// core/access.js
var RUNGS = ["none", "view", "edit", "delete", "full"];
var RUNG_LABELS = {
  none: "No access",
  view: "Can view",
  edit: "Can edit",
  delete: "Can delete",
  full: "Full"
};
var height = (word) => Math.max(0, RUNGS.indexOf(word));
function can(perms, area, need = "view") {
  const want = RUNGS.indexOf(need);
  if (want < 1) return false;
  return height(perms && perms[area]) >= want;
}
var labelOf = (areas, key) => (areas.find((a) => a.key === key) || { label: key }).label;
function cleanPerms(perms, areas) {
  const out = {};
  for (const a of areas) {
    const v = perms && typeof perms === "object" ? perms[a.key] : void 0;
    out[a.key] = RUNGS.includes(v) ? v : "none";
  }
  return out;
}
function changeProblems({ mine, before, next, areas, adminArea, self = false }) {
  const out = [];
  const iAmFull = height(mine[adminArea]) >= height("full");
  if (self && next[adminArea] !== before[adminArea])
    out.push(`You cannot change your own rung on ${labelOf(areas, adminArea)}. Ask another admin.`);
  if (!iAmFull && !self && height(before[adminArea]) >= height("full"))
    out.push(`Only someone with Full on ${labelOf(areas, adminArea)} can change a person who has it.`);
  if (!iAmFull) {
    for (const a of areas) {
      const k = a.key;
      if (height(next[k]) > height(before[k]) && height(next[k]) > height(mine[k]))
        out.push(`${a.label}: you can give up to your own rung, ${RUNG_LABELS[RUNGS[height(mine[k])]]}.`);
    }
  }
  return out;
}
function removeProblems({ mine, target, areas, adminArea, self = false }) {
  if (self) return ["You cannot remove yourself. Ask another admin."];
  if (height(mine[adminArea]) < height("full") && height(target[adminArea]) >= height("full"))
    return [`Only someone with Full on ${labelOf(areas, adminArea)} can remove a person who has it.`];
  return [];
}

// server/team-api.js
var json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});
var NEEDS = { list: "view", invite: "edit", resend: "edit", perms: "edit", remove: "delete" };
var NONE = cleanPerms({}, AREAS);
var isFull = (perms) => height(perms[ADMIN_AREA]) >= height("full");
async function handleTeam(request, env) {
  const fetchFn = env.fetch || fetch;
  const base = String(env.SUPABASE_URL || "").replace(/\/+$/, "");
  const anon = String(env.SUPABASE_ANON_KEY || "");
  const secret = String(env.SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || "");
  if (!base || !anon || !secret)
    return json({ error: "The team service is not set up: it needs SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_KEY." }, 503);
  if (request.method !== "POST") return json({ error: "Send a POST with JSON." }, 405);
  const keyHeaders = (key) => key.startsWith("eyJ") ? { apikey: key, authorization: `Bearer ${key}` } : { apikey: key };
  const auth = (path, init = {}) => fetchFn(`${base}/auth/v1${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...keyHeaders(secret), ...init.headers || {} }
  });
  const why = async (r) => {
    let detail = "";
    try {
      const t = await r.text();
      try {
        const j = JSON.parse(t);
        detail = j.msg || j.message || j.error_description || j.error || t;
      } catch (_) {
        detail = t;
      }
    } catch (_) {
    }
    detail = String(detail).slice(0, 200).trim();
    const hint = r.status === 401 || r.status === 403 ? " Check SUPABASE_SERVICE_KEY: it must be this project's secret or service_role key." : r.status === 429 ? " Supabase's own mail service sends only a few emails an hour; set up SMTP under Authentication > Emails to lift it." : "";
    return `Supabase said ${r.status}${detail ? ": " + detail : ""}.${hint}`;
  };
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "Sign in first." }, 401);
  let me;
  try {
    const r = await fetchFn(`${base}/auth/v1/user`, { headers: { apikey: anon, authorization: `Bearer ${token}` } });
    if (!r.ok) return json({ error: "Your session has ended. Sign in again." }, 401);
    me = await r.json();
  } catch (_) {
    return json({ error: "Could not reach Supabase." }, 502);
  }
  if (!me || !me.id) return json({ error: "Your session has ended. Sign in again." }, 401);
  const mine = cleanPerms(me.app_metadata && me.app_metadata.perms, AREAS);
  let body;
  try {
    body = await request.json();
  } catch (_) {
    return json({ error: "Send the request as JSON." }, 400);
  }
  const action = String(body && body.action || "");
  const need = NEEDS[action];
  if (!need) return json({ error: "Unknown action." }, 400);
  if (!can(mine, ADMIN_AREA, need))
    return json({ error: `This account cannot do that. It needs ${need === "view" ? "Can view" : need === "edit" ? "Can edit" : "Can delete"} on ${labelOf(AREAS, ADMIN_AREA)}.` }, 403);
  const shape = (u) => ({
    id: u.id,
    email: u.email,
    perms: cleanPerms(u.app_metadata && u.app_metadata.perms, AREAS),
    /* invited_at is set only by an invitation. An account without it came in
       another way: a sign-up, or made by hand in the Supabase dashboard. */
    invited: u.invited_at || null,
    created: u.created_at || null,
    lastSeen: u.last_sign_in_at || null,
    confirmed: !!(u.email_confirmed_at || u.confirmed_at)
  });
  const everybody = async () => {
    const users = [];
    for (let page = 1; page <= 50; page++) {
      const r = await auth(`/admin/users?page=${page}&per_page=200`);
      if (!r.ok) throw new Error(await why(r));
      const d = await r.json();
      const batch = d && d.users || [];
      users.push(...batch);
      if (batch.length < 200) break;
    }
    return users;
  };
  const getUser = async (id) => {
    const r = await auth(`/admin/users/${encodeURIComponent(id)}`);
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(await why(r));
    return r.json();
  };
  const otherFull = async (exceptId) => (await everybody()).filter((u) => u.id !== exceptId && isFull(cleanPerms(u.app_metadata && u.app_metadata.perms, AREAS))).length;
  try {
    if (action === "list") {
      const users = await everybody();
      return json({
        users: users.map(shape),
        me: { id: me.id, email: me.email, perms: mine },
        /* so the page can tell when it and this server were deployed with
           different configs, instead of offering an area nobody can save */
        areas: AREAS.map((a) => a.key),
        rungs: RUNGS
      });
    }
    if (action === "invite") {
      const email = String(body.email || "").trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
        return json({ error: "That does not look like an email address." }, 400);
      const next = cleanPerms(body.perms, AREAS);
      const problems = changeProblems({ mine, before: NONE, next, areas: AREAS, adminArea: ADMIN_AREA });
      if (problems.length) return json({ error: problems[0], problems }, 403);
      const redirect = env.APP_URL ? `?redirect_to=${encodeURIComponent(env.APP_URL)}` : "";
      const r = await auth(`/invite${redirect}`, { method: "POST", body: JSON.stringify({ email }) });
      if (!r.ok) return json({ error: await why(r) }, 502);
      const u = await r.json();
      const p = await auth(`/admin/users/${encodeURIComponent(u.id)}`, {
        method: "PUT",
        body: JSON.stringify({ app_metadata: { perms: next } })
      });
      if (!p.ok)
        return json({ error: `${email} was invited, but their access could not be set. Open them in the list and save their access again. ${await why(p)}` }, 502);
      return json({ ok: true, user: shape({ ...u, app_metadata: { ...u.app_metadata || {}, perms: next } }) });
    }
    if (action === "resend") {
      const u = body.id && await getUser(body.id);
      if (!u) return json({ error: "That person is no longer on the team." }, 404);
      if (u.last_sign_in_at) return json({ error: `${u.email} has already signed in. They can reset their password from the sign-in page.` }, 400);
      const redirect = env.APP_URL ? `?redirect_to=${encodeURIComponent(env.APP_URL)}` : "";
      const r = await auth(`/invite${redirect}`, { method: "POST", body: JSON.stringify({ email: u.email }) });
      if (!r.ok) return json({ error: await why(r) }, 502);
      return json({ ok: true });
    }
    if (action === "perms") {
      const u = body.id && await getUser(body.id);
      if (!u) return json({ error: "That person is no longer on the team." }, 404);
      const before = cleanPerms(u.app_metadata && u.app_metadata.perms, AREAS);
      const next = cleanPerms(body.perms, AREAS);
      const problems = changeProblems({ mine, before, next, areas: AREAS, adminArea: ADMIN_AREA, self: u.id === me.id });
      if (problems.length) return json({ error: problems[0], problems }, 403);
      if (isFull(before) && !isFull(next) && await otherFull(u.id) === 0)
        return json({ error: `${u.email} is the last person with Full on ${labelOf(AREAS, ADMIN_AREA)}. Give it to somebody else first.` }, 400);
      const r = await auth(`/admin/users/${encodeURIComponent(u.id)}`, {
        method: "PUT",
        body: JSON.stringify({ app_metadata: { perms: next } })
      });
      if (!r.ok) return json({ error: await why(r) }, 502);
      return json({ ok: true, user: shape(await r.json()) });
    }
    if (action === "remove") {
      const u = body.id && await getUser(body.id);
      if (!u) return json({ ok: true, gone: true });
      const target = cleanPerms(u.app_metadata && u.app_metadata.perms, AREAS);
      const problems = removeProblems({ mine, target, areas: AREAS, adminArea: ADMIN_AREA, self: u.id === me.id });
      if (problems.length) return json({ error: problems[0], problems }, 403);
      if (isFull(target) && await otherFull(u.id) === 0)
        return json({ error: `${u.email} is the last person with Full on ${labelOf(AREAS, ADMIN_AREA)}. Give it to somebody else first.` }, 400);
      const r = await auth(`/admin/users/${encodeURIComponent(u.id)}`, { method: "DELETE" });
      if (!r.ok) return json({ error: await why(r) }, 502);
      return json({ ok: true });
    }
  } catch (e) {
    return json({ error: String(e && e.message || "Could not reach Supabase.").slice(0, 300) }, 502);
  }
  return json({ error: "Unknown action." }, 400);
}

// server/cors.js
async function withCors(request, env, handler) {
  const allowed = String(env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const origin = request.headers.get("origin") || "";
  const ok = allowed.includes(origin);
  const cors = ok ? {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
    "access-control-max-age": "600",
    vary: "origin"
  } : { vary: "origin" };
  if (request.method === "OPTIONS") return new Response(null, { status: ok ? 204 : 403, headers: cors });
  if (origin && !ok)
    return new Response(JSON.stringify({ error: `This address is not allowed to call the team service: ${origin}. Add it to ALLOWED_ORIGINS.` }), {
      status: 403,
      headers: { "content-type": "application/json", ...cors }
    });
  const res = await handler();
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(cors)) out.headers.set(k, v);
  return out;
}

// entry.ts
Deno.serve((request) => {
  const env = Deno.env.toObject();
  return withCors(request, env, () => handleTeam(request, env));
});
