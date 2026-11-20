// invoice.config.js
var FIELDS = [
  {
    key: "supplier",
    label: "Supplier",
    type: "text",
    ask: "the business that issued the invoice, the seller, as printed in its header or logo. Never the customer it is billed or shipped to."
  },
  {
    key: "invoice_no",
    label: "Invoice no.",
    type: "text",
    ask: "the invoice number exactly as printed, without the words Invoice or No."
  },
  {
    key: "date",
    label: "Invoice date",
    type: "date",
    ask: "the date the invoice was issued, as YYYY-MM-DD. Not the due date, not the delivery date."
  },
  {
    key: "due",
    label: "Due date",
    type: "date",
    ask: "the date payment is due, as YYYY-MM-DD, only if it is printed. For terms like Net 30 without a date, leave it empty."
  },
  {
    key: "total",
    label: "Total",
    type: "money",
    ask: "the grand total of the invoice including tax, as digits with one dot for cents and no symbol or thousands separator, e.g. 1356.40. Not a subtotal, not an amount already paid, not a balance of 0."
  },
  {
    key: "tax",
    label: "Tax",
    type: "money",
    ask: "the total tax charged (GST, HST, PST, QST, VAT or sales tax added together), as digits with one dot, e.g. 64.59. Empty if no tax is shown."
  },
  {
    key: "currency",
    label: "Currency",
    type: "currency",
    ask: "the three-letter currency code of the total, e.g. CAD, USD, EUR. If only $ is printed, use the supplier's country."
  },
  {
    key: "category",
    label: "Category",
    type: "choice",
    options: [
      "Produce",
      "Meat & seafood",
      "Dairy & eggs",
      "Bakery",
      "Dry goods",
      "Beverages",
      "Alcohol",
      "Packaging",
      "Cleaning & paper",
      "Equipment & repairs",
      "Rent & utilities",
      "Services",
      "Other"
    ],
    ask: "which one of the allowed categories most of this invoice's money went on."
  }
];
var OWN_NAMES = ["Bready", "Bready Cafe", "Bready Caf\xE9", "Bready Bakery", "breadycafe.com"];
var AREA = "invoices";

// core/invoice.js
var CURRENCIES = /* @__PURE__ */ new Set([
  "CAD",
  "USD",
  "EUR",
  "GBP",
  "AUD",
  "NZD",
  "CHF",
  "SEK",
  "NOK",
  "DKK",
  "PLN",
  "JPY",
  "CNY",
  "INR",
  "AED",
  "TRY",
  "MXN",
  "BRL",
  "ZAR",
  "SGD",
  "HKD"
]);
var MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
var pad = (n) => String(n).padStart(2, "0");
var monthNum = (w) => {
  const k = String(w || "").toLowerCase();
  return MONTHS[k.slice(0, 4)] || MONTHS[k.slice(0, 3)] || 0;
};
var real = (y, m, d) => {
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? `${y}-${pad(m)}-${pad(d)}` : "";
};
function cleanDate(v) {
  const s = String(v == null ? "" : v).trim();
  if (!s) return "";
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return real(+m[1], +m[2], +m[3]);
  m = s.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/);
  if (m && monthNum(m[1])) return real(+m[3], monthNum(m[1]), +m[2]);
  m = s.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})$/);
  if (m && monthNum(m[2])) return real(+m[3], monthNum(m[2]), +m[1]);
  m = s.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})$/);
  if (m) {
    const a = +m[1], b = +m[2];
    return a > 12 ? real(+m[3], b, a) : real(+m[3], a, b);
  }
  return "";
}
function cleanMoney(v) {
  let s = String(v == null ? "" : v).trim().replace(/[^\d.,\s-]/g, "").trim();
  if (!s) return "";
  const neg = s.startsWith("-");
  s = s.replace(/[\s-]/g, "");
  const lastComma = s.lastIndexOf(","), lastDot = s.lastIndexOf(".");
  if (lastComma > lastDot && /,\d{2}$/.test(s)) {
    s = s.replace(/\./g, "");
    const at = s.lastIndexOf(",");
    s = s.slice(0, at).replace(/,/g, "") + "." + s.slice(at + 1);
  } else s = s.replace(/,/g, "");
  if (!/^\d+(\.\d+)?$/.test(s)) return "";
  const n = Number(s);
  if (!isFinite(n)) return "";
  return (neg ? -n : n).toFixed(2);
}
var cleanCurrency = (v) => {
  const c = String(v == null ? "" : v).trim().toUpperCase();
  return CURRENCIES.has(c) ? c : "";
};
function cleanValue(field, v) {
  if (v == null) return "";
  switch (field.type) {
    case "date":
      return cleanDate(v);
    case "money":
      return cleanMoney(v);
    case "currency":
      return cleanCurrency(v);
    case "choice": {
      const want = String(v).trim().toLowerCase();
      return (field.options || []).find((o) => o.toLowerCase() === want) || "";
    }
    default:
      return String(v).replace(/\s+/g, " ").trim().slice(0, 200);
  }
}
function cleanReading(raw, fields, own = []) {
  const out = { fields: {}, paid: false };
  const src = raw && typeof raw === "object" ? raw.fields && typeof raw.fields === "object" ? raw.fields : raw : {};
  for (const f of fields) {
    const v = cleanValue(f, src[f.key]);
    if (v) out.fields[f.key] = v;
  }
  const sup = String(out.fields.supplier || "").toLowerCase();
  if (sup && own.some((o) => o && sup.includes(String(o).toLowerCase()))) delete out.fields.supplier;
  out.paid = raw && (raw.paid === true || raw.paid === "true") || false;
  return out;
}

// server/read-api.js
var json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
var TYPES = /* @__PURE__ */ new Set(["application/pdf", "image/jpeg", "image/png", "image/webp", "image/gif"]);
var MAX_B64 = 14 * 1024 * 1024;
var RUNGS = ["none", "view", "edit", "delete", "full"];
var SYSTEM = "You read purchase invoices and receipts for a business and return the requested fields as JSON. You copy what the document shows. You never invent a value: when the document does not show something, the answer is an empty string.";
function instructions() {
  const lines = FIELDS.map((f) => `- ${f.key}: ${f.ask}${f.type === "choice" ? ` Allowed answers: ${f.options.join(" | ")}.` : ""}`);
  return [
    "Read this invoice and fill in every field.",
    ...lines,
    "- paid: true only if the document itself says it is paid, by a PAID stamp or a balance due of zero; otherwise false.",
    OWN_NAMES.length ? `The invoice is addressed to us (${OWN_NAMES.join(", ")}): that name is never the supplier.` : "",
    'Use "" for any field the document does not show.'
  ].filter(Boolean).join("\n");
}
function schema(enums) {
  const properties = {};
  for (const f of FIELDS) {
    properties[f.key] = { type: "string", description: f.ask };
    if (enums && f.type === "choice") properties[f.key].enum = [...f.options, ""];
  }
  properties.paid = { type: "boolean", description: "true only if the document says it is paid" };
  return { type: "object", properties, required: [...FIELDS.map((f) => f.key), "paid"], additionalProperties: false };
}
function geminiSchema() {
  const properties = {};
  for (const f of FIELDS) properties[f.key] = { type: "STRING", description: f.ask + (f.type === "choice" ? ` One of: ${f.options.join(" | ")}, or "".` : "") };
  properties.paid = { type: "BOOLEAN" };
  return { type: "OBJECT", properties, required: [...FIELDS.map((f) => f.key), "paid"] };
}
async function askClaude(env, fetchFn, { file, mediaType }) {
  const model = env.ANTHROPIC_MODEL || "claude-haiku-5-5";
  const block = mediaType === "application/pdf" ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: file } } : { type: "image", source: { type: "base64", media_type: mediaType, data: file } };
  const r = await fetchFn("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system: SYSTEM,
      messages: [{ role: "user", content: [block, { type: "text", text: instructions() }] }],
      output_config: { format: { type: "json_schema", schema: schema(true) } }
    })
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Claude answered ${r.status}: ${data.error && data.error.message || "no reason given"}`);
  if (data.stop_reason === "refusal") throw new Error("Claude declined to read this document.");
  if (data.stop_reason === "max_tokens") throw new Error("The reading was cut short. Try again.");
  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  return { raw: JSON.parse(text), provider: "anthropic", model };
}
async function askGemini(env, fetchFn, { file, mediaType }) {
  const models = [
    env.GEMINI_MODEL || "gemini-3.6-flash",
    ...String(env.GEMINI_MODEL_FALLBACK || "gemini-3.5-flash-lite,gemini-2.5-flash").split(",")
  ].map((m) => m.trim()).filter((m, i, a) => m && a.indexOf(m) === i);
  let last = "";
  for (const model of models) {
    const r = await fetchFn(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: "user", parts: [{ inline_data: { mime_type: mediaType, data: file } }, { text: instructions() }] }],
        generationConfig: { responseMimeType: "application/json", responseSchema: geminiSchema(), maxOutputTokens: 1024, temperature: 0 }
      })
    });
    const data = await r.json().catch(() => ({}));
    if (r.status === 404 || r.status === 429 || r.status === 503) {
      last = `${model}: ${r.status}`;
      continue;
    }
    if (!r.ok) throw new Error(`Gemini answered ${r.status}: ${data.error && data.error.message || "no reason given"}`);
    const parts = (((data.candidates || [])[0] || {}).content || {}).parts || [];
    const text = parts.map((p) => p.text || "").join("");
    if (!text) throw new Error("Gemini gave no answer for this document.");
    return { raw: JSON.parse(text), provider: "gemini", model };
  }
  throw new Error(`No Gemini model was available (${last}). Set GEMINI_MODEL to a current one.`);
}
async function handleRead(request, env) {
  const fetchFn = env.fetch || fetch;
  if (request.method !== "POST") return json({ error: "Send a POST with JSON." }, 405);
  const base = String(env.SUPABASE_URL || "").replace(/\/+$/, "");
  const anon = String(env.SUPABASE_ANON_KEY || "");
  if (!base || !anon) return json({ error: "The reader is not set up: it needs SUPABASE_URL and SUPABASE_ANON_KEY." }, 503);
  const provider = env.AI_PROVIDER === "gemini" && env.GEMINI_API_KEY ? "gemini" : env.AI_PROVIDER === "anthropic" && env.ANTHROPIC_API_KEY ? "anthropic" : env.ANTHROPIC_API_KEY ? "anthropic" : env.GEMINI_API_KEY ? "gemini" : "";
  if (!provider) return json({ error: "The AI reader has no key: set ANTHROPIC_API_KEY or GEMINI_API_KEY on the server." }, 503);
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
  if (String(env.TEAM_ACCESS || "").toLowerCase() === "on") {
    const rung = ((me.app_metadata || {}).perms || {})[AREA];
    if (RUNGS.indexOf(rung) < RUNGS.indexOf("edit"))
      return json({ error: "This account cannot add invoices: it needs Can edit on the invoices." }, 403);
  }
  let body;
  try {
    body = await request.json();
  } catch (_) {
    return json({ error: "Send the request as JSON." }, 400);
  }
  const file = String(body && body.file || "");
  const mediaType = String(body && body.mediaType || "").toLowerCase();
  if (!file) return json({ error: "No file was sent." }, 400);
  if (!TYPES.has(mediaType)) return json({ error: "Send a PDF or a photo (JPEG, PNG, WebP)." }, 415);
  if (file.length > MAX_B64) return json({ error: "That file is over 10 MB. Send a smaller scan or photo." }, 413);
  if (!/^[A-Za-z0-9+/=\s]+$/.test(file.slice(0, 4096))) return json({ error: "The file must be sent as base64." }, 400);
  try {
    const got = provider === "anthropic" ? await askClaude(env, fetchFn, { file, mediaType }) : await askGemini(env, fetchFn, { file, mediaType });
    const clean = cleanReading(got.raw, FIELDS, OWN_NAMES);
    return json({ fields: clean.fields, paid: clean.paid, provider: got.provider, model: got.model });
  } catch (e) {
    return json({ error: String(e && e.message || e).slice(0, 300) }, 502);
  }
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
    return new Response(JSON.stringify({ error: `This address is not allowed to call the reader: ${origin}. Add it to ALLOWED_ORIGINS.` }), {
      status: 403,
      headers: { "content-type": "application/json", ...cors }
    });
  const res = await handler();
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(cors)) out.headers.set(k, v);
  return out;
}

// fn-entry.ts
Deno.serve((request) => {
  const env = Deno.env.toObject();
  return withCors(request, env, () => handleRead(request, env));
});
