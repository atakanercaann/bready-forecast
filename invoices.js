(() => {
  var __defProp = Object.defineProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

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
  function mergeReadings(first, second) {
    if (!first) return second || null;
    if (!second) return first;
    return { fields: { ...second.fields, ...first.fields }, paid: !!(first.paid || second.paid), by: [first.by, second.by].filter(Boolean).join("+") };
  }
  function applyReading(row, reading, fields, { defaultStatus = "unpaid", paidStatus = "paid" } = {}) {
    const before = row && row.data || {};
    const was = new Set(row && row.filled || []);
    const data = {};
    const filled = [];
    for (const f of fields) {
      const mine = was.has(f.key);
      const current = String(before[f.key] == null ? "" : before[f.key]).trim();
      const got = reading && reading.fields ? reading.fields[f.key] : "";
      if (current && !mine) continue;
      if (got) {
        data[f.key] = got;
        filled.push(f.key);
      } else if (mine) data[f.key] = null;
    }
    const patch = { data, filled };
    if (reading && reading.paid && (!row || !row.status || row.status === defaultStatus)) patch.status = paidStatus;
    return patch;
  }
  var fieldEdited = (row, key) => (row && row.filled || []).filter((k) => k !== key);
  var baseName = (n) => String(n || "").replace(/\.[^.]+$/, "").replace(/[\s_]*\(\d+\)\s*$/, "").replace(/\s*[-\u2013\u2014_]\s*/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  var norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  function findDuplicates(rows) {
    const out = /* @__PURE__ */ new Map();
    const say = (r, why) => {
      if (!out.has(r.id)) out.set(r.id, why);
    };
    const label = (r) => r.data && (r.data.supplier || r.data.invoice_no) || "another invoice";
    const seen = { hash: /* @__PURE__ */ new Map(), no: /* @__PURE__ */ new Map(), name: /* @__PURE__ */ new Map(), money: /* @__PURE__ */ new Map() };
    const tests = [
      ["hash", (r) => (r.files || []).map((f) => f.hash).filter(Boolean), (o) => `the same file as ${label(o)}`],
      ["no", (r) => r.data && r.data.invoice_no ? [`${norm(r.data.supplier)}|${norm(r.data.invoice_no)}`] : [], (o) => `invoice ${o.data.invoice_no} is also on another row${o.data.date ? ", dated " + o.data.date : ""}`],
      ["name", (r) => (r.files || []).map((f) => baseName(f.name)).filter((n) => n.length > 2), (o) => `the same file name as ${label(o)}`],
      ["money", (r) => r.data && r.data.total && r.data.date && Number(r.data.total) !== 0 ? [`${norm(r.data.supplier)}|${r.data.total}|${r.data.currency || ""}|${r.data.date}`] : [], (o) => `the same total and date as ${label(o)}`]
    ];
    for (const [name, keys, why] of tests) {
      for (const r of rows) {
        for (const k of keys(r)) {
          const first = seen[name].get(k);
          if (first && first.id !== r.id) {
            say(r, why(first));
            say(first, why(r));
          } else if (!first) seen[name].set(k, r);
        }
      }
    }
    return out;
  }
  function totals(rows, { paidStatus = "paid" } = {}) {
    const all = {}, unpaid = {}, tax = {};
    let count = 0;
    for (const r of rows) {
      const d = r.data || {};
      const n = Number(d.total);
      if (!d.total || !isFinite(n)) continue;
      const c = d.currency || "?";
      all[c] = (all[c] || 0) + n;
      if (r.status !== paidStatus) unpaid[c] = (unpaid[c] || 0) + n;
      if (d.tax && isFinite(Number(d.tax))) tax[c] = (tax[c] || 0) + Number(d.tax);
      count++;
    }
    return { all, unpaid, tax, count };
  }
  var money = (n, cur) => {
    const v = Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return cur && cur !== "?" ? `${v} ${cur}` : v;
  };
  function toCsv(rows, fields, statuses) {
    const q = (v) => {
      const s = String(v == null ? "" : v);
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const statusLabel = (k) => (statuses.find((s) => s.key === k) || { label: k || "" }).label;
    const head = fields.map((f) => f.label).concat(["Status", "Note", "Files"]);
    const lines = rows.map((r) => fields.map((f) => (r.data || {})[f.key]).concat([statusLabel(r.status), r.note || "", (r.files || []).map((f) => f.name).join("; ")]).map(q).join(","));
    return "\uFEFF" + [head.map(q).join(",")].concat(lines).join("\r\n") + "\r\n";
  }
  var monthOf = (row) => {
    const d = row.data && row.data.date || String(row.created_at || "").slice(0, 10);
    return /^\d{4}-\d{2}/.test(d) ? d.slice(0, 7) : "";
  };

  // core/parse.js
  var SYM_CUR = { "$": "", "US$": "USD", "CA$": "CAD", "C$": "CAD", "\u20AC": "EUR", "\xA3": "GBP" };
  var CODES = /* @__PURE__ */ new Set([
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
  var code = (v) => CODES.has(String(v || "").toUpperCase()) ? String(v).toUpperCase() : "";
  var SYM = "US\\$|CA\\$|C\\$|\\$|\u20AC|\xA3";
  var NUM = "\\d{1,3}(?:[.,\\s]\\d{3})*(?:[.,]\\d{2})|\\d+[.,]\\d{2}";
  var DATE = "([A-Za-z]{3,9}\\.?\\s+\\d{1,2},?\\s+\\d{4}|\\d{1,2}\\s+[A-Za-z]{3,9}\\.?,?\\s+\\d{4}|\\d{4}-\\d{2}-\\d{2}|\\d{1,2}[\\/.]\\d{1,2}[\\/.]\\d{4})";
  function parseInvoiceText(text, { own = [] } = {}) {
    const t = String(text || "").replace(/ /g, " ");
    const grab = (res) => {
      for (const re of res) {
        const m = t.match(re);
        if (m) return (m[1] || "").trim();
      }
      return "";
    };
    const invoice_no = grab([
      /Invoice\s*(?:No|ID|number|nr|n°)\b\.?[#:.\s]*([A-Z0-9][A-Z0-9\-_/]*)/i,
      /Invoice\s*#\s*:?\s*([A-Z0-9][A-Z0-9\-_/]*)/i,
      /\b(?:Bill|Document|Receipt)\s*(?:No|#|number)\b\.?[#:.\s]*([A-Z0-9][A-Z0-9\-_/]{2,})/i
    ]);
    const LABELS = [
      "Grand\\s+total",
      "Invoice\\s+total",
      "Total\\s*\\([A-Z]{3}\\)",
      "Total\\s+amount",
      "\\bTotal\\b(?!\\s*(?:items|qty|quantity|due|tax|before|excl))",
      "Amount\\s+paid",
      "Amount\\s+due",
      "Total\\s+due",
      "Balance\\s+due"
    ];
    let total = "", currency = "";
    const asNum = (v) => cleanMoney(v);
    for (const label of LABELS) {
      const m = t.match(new RegExp(label + "[^\\n\\d]{0,30}?(?:([A-Z]{3})\\s*)?(" + SYM + ")\\s*(" + NUM + ")(?:\\s*([A-Z]{3}))?", "i"));
      if (m && Number(asNum(m[3])) !== 0) {
        total = asNum(m[3]);
        currency = code(m[1]) || code(m[4]) || SYM_CUR[(m[2] || "").trim()] || "";
        break;
      }
    }
    if (!total) {
      for (const label of LABELS) {
        const m = t.match(new RegExp(label + "[^\\n\\d]{0,30}?(?:([A-Z]{3})\\s*)?(" + NUM + ")(?:\\s*([A-Z]{3}))?", "i"));
        if (m && Number(asNum(m[2])) !== 0) {
          total = asNum(m[2]);
          currency = code(m[1]) || code(m[3]) || (((m[0] || "").match(/\(([A-Z]{3})\)/) || [])[1] || "");
          break;
        }
      }
    }
    if (!currency) {
      const any = t.match(/\b(CAD|USD|EUR|GBP|AUD)\b/);
      if (any) currency = any[1];
      else if (/CA\$|C\$/.test(t)) currency = "CAD";
      else if (/US\$/.test(t)) currency = "USD";
    }
    let tax = 0, taxSeen = false;
    for (const m of t.matchAll(new RegExp("^[^\\n]*\\b(GST|HST|PST|QST|TVQ|TPS|TVH|VAT|Sales\\s+tax|Tax)\\b[^\\n]*?(?:" + SYM + ")?\\s*(" + NUM + ")\\s*$", "gim"))) {
      const line = m[0];
      if (/total|incl|including|reg(?:istration)?\s*(?:no|#)|number|#\s*\d{5,}/i.test(line)) continue;
      tax += Number(asNum(m[2]));
      taxSeen = true;
    }
    const NAMED = "(?:Invoice\\s*date|Date\\s*of\\s*invoice|Date\\s*issued|Issue\\s*date|Issued(?:\\s*on)?|Billing\\s*date)";
    let date = grab([new RegExp(NAMED + "\\s*[:#]?\\s*" + DATE, "i")]);
    if (!date) {
      const re = new RegExp("(^|[^A-Za-z])(\\w*)\\s*Date\\s*[:#]?\\s*" + DATE, "gim");
      for (const m of t.matchAll(re)) {
        if (!/^(due|delivery|ship|shipped|order|payment)$/i.test(m[2] || "")) {
          date = (m[3] || "").trim();
          break;
        }
      }
    }
    const due = grab([new RegExp("(?:Due\\s*date|Payment\\s*due|Due\\s*on|Due)\\s*[:#]?\\s*" + DATE, "i")]);
    const ownHit = (s) => own.some((o) => o && String(s).toLowerCase().includes(String(o).toLowerCase()));
    const badName = (s) => !s || String(s).replace(/[^A-Za-zÀ-ÿ]/g, "").length < 4 || /^[\d\s.,:;#$€£%\/-]*$/.test(s) || /^(invoice|tax\s*invoice|receipt|statement|bill\s*to|billed\s*to|ship\s*to|sold\s*to|customer|balance|total|subtotal|amount|date|paid|due|terms|qty|price|item|description|page|ref|re|to|attn|phone|tel|fax|email)\b/i.test(s) || /@|https?:\/\/|www\./i.test(s) || /^\d/.test(s) || /\b[A-Z]\d[A-Z]\s?\d[A-Z]\d\b|\b\d{5}(?:-\d{4})?\b/.test(s) || /\b(street|st\.|road|rd\.?|avenue|ave\.?|blvd|boulevard|suite|unit|p\.?o\.? box|highway|hwy)\b/i.test(s) || ownHit(s);
    const lines = t.split("\n").map((l) => l.replace(/\s{2,}.*$/, "").trim()).filter(Boolean);
    const cands = [];
    for (const re of [
      /\bFrom\s*:?\s*\n?\s*([^\n]{3,60})/i,
      /\b(?:Bill(?:ed)?\s*from|Sold\s*by|Seller|Vendor|Supplier|Issued\s+by|Remit\s+to)\s*:?\s*\n?\s*([^\n]{3,60})/i
    ]) {
      const m = t.match(re);
      if (m) cands.push(m[1].replace(/\s{2,}.*$/, "").trim());
    }
    const head = lines.findIndex((l) => /^(?:tax\s+)?invoice\b/i.test(l));
    if (head >= 0 && head < 3) cands.push(lines[head + 1] || "", lines[head + 2] || "");
    cands.push(...lines.slice(0, 3));
    lines.forEach((l, i) => {
      if (/\b(?:(?:GST|HST|QST|PST|VAT|GST\/HST)\s*(?:No\.?|Number|#|Reg)|Tax\s*ID|Business\s*(?:No|Number)|BN\b|EIN\b|ABN\b)/i.test(l))
        cands.push(lines[i - 1] || "", lines[i - 2] || "");
    });
    let supplier = cands.find((c) => !badName(c)) || "";
    if (!supplier) {
      const hosts = [...t.matchAll(/(?:https?:\/\/|www\.|@)([a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,})/gi)].map((m) => m[1].toLowerCase().replace(/^www\./, "")).filter((h2) => !ownHit(h2) && !/paypal|stripe|square|gmail|icloud|outlook|hotmail|yahoo|interac/.test(h2));
      if (hosts.length) supplier = hosts.sort((a, b) => hosts.filter((x) => x === b).length - hosts.filter((x) => x === a).length)[0];
    }
    const settled = !!total && /(?:Balance\s+due|Amount\s+due|Total\s+due)[^\n\d]{0,30}?(?:US\$|CA\$|C\$|\$|€|£)?\s*0(?:[.,]00)?\b/i.test(t);
    const paid = (/\bPAID\b/.test(t) || settled) && !/\bUNPAID\b|\bPAST\s*DUE\b|\bOVERDUE\b/i.test(t);
    return {
      fields: { supplier, invoice_no, date, due, total, tax: taxSeen && tax > 0 ? tax.toFixed(2) : "", currency },
      paid,
      by: "parser"
    };
  }

  // core/read.js
  var PDFJS = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4/+esm";
  var PDFJS_WORKER = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4/build/pdf.worker.min.mjs";
  var pdfjs = null;
  async function pdfLib() {
    if (pdfjs) return pdfjs;
    const lib = await import(
      /* @vite-ignore */
      PDFJS
    );
    lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
    pdfjs = lib;
    return lib;
  }
  async function pdfText(file) {
    const lib = await pdfLib();
    const doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    let out = "";
    for (let p = 1; p <= Math.min(doc.numPages, 3); p++) {
      const tc = await (await doc.getPage(p)).getTextContent();
      let lastY = null;
      for (const it of tc.items) {
        const y = it.transform && it.transform[5];
        if (lastY !== null && Math.abs(y - lastY) > 2) out += "\n";
        else if (out && !out.endsWith("\n")) out += " ";
        out += it.str;
        lastY = y;
      }
      out += "\n";
    }
    return out;
  }
  async function sha256(file) {
    try {
      const d = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
      return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch (_) {
      return "";
    }
  }
  async function shrinkImage(file, max = 2e3) {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k);
    c.height = Math.round(bmp.height * k);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    return new Promise((res) => c.toBlob((b) => res(b || file), "image/jpeg", 0.85));
  }
  var toBase64 = (blob) => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1] || "");
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });
  async function readInvoice(file, { config, ai } = {}) {
    const fields = config.FIELDS;
    const own = config.OWN_NAMES || [];
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name || "");
    const order = (config.READ_ORDER || ["parser", "ai"]).filter((x) => x === "parser" || x === "ai" && ai);
    let got = null;
    const errors = [];
    for (const how of order) {
      try {
        let r = null;
        if (how === "parser") {
          if (!isPdf) continue;
          r = cleanReading(parseInvoiceText(await pdfText(file), { own }), fields, own);
        } else {
          const blob = isPdf ? file : await shrinkImage(file).catch(() => file);
          const raw = await ai({ file: await toBase64(blob), mediaType: isPdf ? "application/pdf" : blob.type || "image/jpeg", name: file.name || "" });
          r = cleanReading(raw, fields, own);
        }
        r.by = how;
        got = mergeReadings(got, r);
        if (fields.every((f) => got.fields[f.key])) break;
      } catch (e) {
        errors.push(`${how === "ai" ? "The AI reader" : "The PDF reader"}: ${e && e.message || e}`);
      }
    }
    if (!got || !Object.keys(got.fields).length) {
      if (errors.length) throw new Error(errors.join(" "));
      return { fields: {}, paid: false, by: order.join("+") || "none" };
    }
    return got;
  }

  // ui/invoices-page.js
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : String(v));
    }
    for (const kid of kids.flat(Infinity)) if (kid != null && kid !== false) el.append(kid);
    return el;
  }
  var ACCEPT = "application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif";
  var okType = (f) => /^(application\/pdf|image\/(jpeg|png|webp|heic|heif))$/.test(f.type) || /\.(pdf|jpe?g|png|webp|heic|heif)$/i.test(f.name || "");
  var safeName = (n) => String(n || "invoice").replace(/[^\w.\-]+/g, "_").slice(-80);
  var MONTH_NAMES = (ym) => (/* @__PURE__ */ new Date(`${ym}-01T12:00:00Z`)).toLocaleDateString(void 0, { month: "long", year: "numeric", timeZone: "UTC" });
  function mountInvoicesPage(root, { store, ai, config, can = { edit: true, delete: true, full: true } }) {
    const FIELDS2 = config.FIELDS;
    const STATUSES2 = config.STATUSES;
    const DEF_STATUS = config.DEFAULT_STATUS || STATUSES2[0].key;
    const PAID = STATUSES2.some((s) => s.key === "paid") ? "paid" : "";
    let rows = [];
    let failure = "";
    let loaded = false;
    const view = { month: "", status: "", q: "", dupOnly: false, sort: "added" };
    const state = /* @__PURE__ */ new Map();
    const cards = /* @__PURE__ */ new Map();
    let dups = /* @__PURE__ */ new Map();
    root.classList.add("iv");
    const setState = (id, s) => {
      state.set(id, { ...state.get(id) || {}, ...s });
      const c = cards.get(id);
      if (c) c.paintState();
    };
    const replace = (row) => {
      const i = rows.findIndex((r) => r.id === row.id);
      if (i >= 0) rows[i] = row;
      else rows.unshift(row);
    };
    const locked = (row) => PAID && row.status === PAID && !can.full;
    const fileIn = h("input", { type: "file", accept: ACCEPT, multiple: true, hidden: true });
    const camIn = h("input", { type: "file", accept: "image/*", capture: "environment", hidden: true });
    fileIn.addEventListener("change", () => {
      addFiles([...fileIn.files]);
      fileIn.value = "";
    });
    camIn.addEventListener("change", () => {
      addFiles([...camIn.files]);
      camIn.value = "";
    });
    const progress = h("p", { class: "iv-progress", role: "status", "aria-live": "polite" });
    const sum = h("div", { class: "iv-sum", "aria-live": "polite" });
    const list = h("div", { class: "iv-list" });
    const bar = h("div", { class: "iv-bar" });
    const drop = h("div", { class: "iv-drop", hidden: true }, "Drop the invoices to add them");
    root.replaceChildren(
      h(
        "header",
        { class: "iv-head" },
        h(
          "div",
          null,
          h("h1", null, "Invoices"),
          h("p", null, "Every purchase invoice in one place. Add a PDF or a photo and it is read for you: supplier, number, dates, amounts. Check what it read; anything you type is never overwritten.")
        ),
        h(
          "div",
          { class: "iv-headbtns" },
          can.edit ? h("button", { type: "button", class: "iv-btn iv-primary", onclick: () => fileIn.click() }, "Add invoices") : null,
          can.edit ? h("button", { type: "button", class: "iv-btn", onclick: () => camIn.click() }, "Take a photo") : null,
          h("button", { type: "button", class: "iv-btn", onclick: () => exportCsv() }, "Export to CSV")
        )
      ),
      fileIn,
      camIn,
      progress,
      bar,
      sum,
      list,
      drop
    );
    let depth = 0;
    root.addEventListener("dragenter", (e) => {
      if (can.edit && [...e.dataTransfer?.types || []].includes("Files")) {
        depth++;
        drop.hidden = false;
      }
    });
    root.addEventListener("dragleave", () => {
      if (--depth <= 0) {
        depth = 0;
        drop.hidden = true;
      }
    });
    root.addEventListener("dragover", (e) => {
      if (can.edit) e.preventDefault();
    });
    root.addEventListener("drop", (e) => {
      e.preventDefault();
      depth = 0;
      drop.hidden = true;
      if (can.edit) addFiles([...e.dataTransfer?.files || []]);
    });
    function shown() {
      const q = view.q.trim().toLowerCase();
      const out = rows.filter((r) => (!view.month || monthOf(r) === view.month) && (!view.status || r.status === view.status) && (!view.dupOnly || dups.has(r.id)) && (!q || FIELDS2.some((f) => String((r.data || {})[f.key] || "").toLowerCase().includes(q)) || String(r.note || "").toLowerCase().includes(q)));
      if (view.sort === "date") out.sort((a, b) => String((b.data || {}).date || "").localeCompare(String((a.data || {}).date || "")));
      return out;
    }
    function paintBar() {
      const months = [...new Set(rows.map(monthOf).filter(Boolean))].sort().reverse();
      const sel = (label, value, options, set) => {
        const s = h("select", { "aria-label": label }, options.map(([v, t]) => h("option", { value: v }, t)));
        s.value = value;
        s.addEventListener("change", () => {
          set(s.value);
          paintList();
        });
        return s;
      };
      const search = h("input", { type: "search", placeholder: "Search supplier, number, note", "aria-label": "Search", value: view.q });
      search.addEventListener("input", () => {
        view.q = search.value;
        paintList();
      });
      bar.replaceChildren(...[
        sel("Month", view.month, [["", "Every month"], ...months.map((m) => [m, MONTH_NAMES(m)])], (v) => view.month = v),
        sel("Status", view.status, [["", "Any status"], ...STATUSES2.map((s) => [s.key, s.label])], (v) => view.status = v),
        sel("Order", view.sort, [["added", "Newest added first"], ["date", "By invoice date"]], (v) => view.sort = v),
        search,
        dups.size ? h(
          "button",
          {
            type: "button",
            class: "iv-btn iv-warn" + (view.dupOnly ? " on" : ""),
            "aria-pressed": String(view.dupOnly),
            onclick: () => {
              view.dupOnly = !view.dupOnly;
              paintBar();
              paintList();
            }
          },
          view.dupOnly ? "Show all invoices" : `Possible duplicates (${dups.size})`
        ) : null
      ].filter(Boolean));
    }
    function paintSum(list2) {
      const t = totals(list2, { paidStatus: PAID });
      const line = (label, by) => {
        const parts = Object.entries(by).filter(([, v]) => v).map(([c, v]) => money(v, c));
        return parts.length ? h("div", { class: "iv-fig" }, h("span", null, label), h("b", null, parts.join(" + "))) : null;
      };
      sum.replaceChildren(...[
        h("div", { class: "iv-fig" }, h("span", null, "Invoices"), h("b", null, String(list2.length))),
        line("Total", t.all),
        PAID ? line("Unpaid", t.unpaid) : null,
        line("Tax", t.tax)
      ].filter(Boolean));
    }
    function paintList() {
      const now = shown();
      paintSum(now);
      const keep = new Set(now.map((r) => r.id));
      for (const [id, c] of cards) if (!keep.has(id)) {
        c.el.remove();
        cards.delete(id);
      }
      now.forEach((r) => {
        let c = cards.get(r.id);
        if (!c) {
          c = card(r);
          cards.set(r.id, c);
        } else c.update(r);
        list.append(c.el);
      });
      let empty = list.querySelector(".iv-empty");
      if (!now.length) {
        if (!empty) list.append(empty = h("p", { class: "iv-empty" }));
        empty.textContent = !loaded ? "Reading the invoices\u2026" : failure ? failure : rows.length ? "No invoice matches these filters." : can.edit ? "No invoices yet. Add a PDF or a photo, or drop them here." : "No invoices yet.";
      } else if (empty) empty.remove();
    }
    const paintAll = () => {
      dups = findDuplicates(rows);
      if (!dups.size) view.dupOnly = false;
      paintBar();
      paintList();
    };
    function card(row) {
      const el = h("article", { class: "iv-card", "data-id": row.id });
      const inputs = {};
      const title = h("b", { class: "iv-title" });
      const amount = h("span", { class: "iv-amount" });
      const dup = h("p", { class: "iv-dup", role: "note" });
      const msg = h("p", { class: "iv-msg", role: "status", "aria-live": "polite" });
      const busy = h("span", { class: "iv-busy" });
      const status = h("select", { class: "iv-status", "aria-label": "Status" }, STATUSES2.map((s) => h("option", { value: s.key }, s.label)));
      status.addEventListener("change", () => save({ status: status.value }, () => {
        status.value = row.status;
      }));
      const files = h("div", { class: "iv-files" });
      const note = h("textarea", { class: "iv-note", rows: 1, placeholder: "Note: what it covered, who agreed it, anything to remember", "aria-label": "Note" });
      note.addEventListener("change", () => save({ note: note.value }));
      const grid = h("div", { class: "iv-fields" });
      for (const f of FIELDS2) {
        const id = `iv-${row.id}-${f.key}`;
        let input;
        if (f.type === "choice" || f.type === "currency") {
          const opts = f.type === "currency" ? [.../* @__PURE__ */ new Set([config.DEFAULT_CURRENCY || "CAD", "CAD", "USD", "EUR", "GBP", ...CURRENCIES])] : f.options;
          input = h("select", { id }, h("option", { value: "" }, "Not set"), opts.map((o) => h("option", { value: o }, o)));
        } else {
          input = h("input", { id, type: f.type === "date" ? "date" : "text", inputmode: f.type === "money" ? "decimal" : null, autocomplete: "off" });
        }
        input.addEventListener("change", () => {
          const v = cleanValue(f, input.value);
          if (f.type === "money" && input.value && !v) {
            tell(`${f.label}: write a number, like 1356.40`, true);
            return;
          }
          input.value = v;
          save({ data: { [f.key]: v || null }, filled: fieldEdited(row, f.key) });
        });
        inputs[f.key] = input;
        grid.append(h("label", { class: "iv-field iv-" + f.type, for: id }, h("span", null, f.label), input));
      }
      const readBtn = h("button", { type: "button", class: "iv-btn iv-small", onclick: () => readAgain() }, "Read again");
      const addBtn = h("button", { type: "button", class: "iv-btn iv-small iv-dashed", onclick: () => more.click() }, "+ Another file");
      const more = h("input", { type: "file", accept: ACCEPT, hidden: true });
      more.addEventListener("change", () => {
        const f = more.files[0];
        more.value = "";
        if (f) attach(row.id, f, { read: false });
      });
      const delBtn = h("button", { type: "button", class: "iv-btn iv-small iv-danger" }, "Delete invoice");
      let armed = false;
      delBtn.addEventListener("click", async () => {
        if (!armed) {
          armed = true;
          delBtn.textContent = "Yes, delete it and its files";
          tell("Press again to delete this invoice and its files. It cannot be undone.");
          setTimeout(() => {
            if (armed) {
              armed = false;
              delBtn.textContent = "Delete invoice";
              tell("");
            }
          }, 8e3);
          return;
        }
        delBtn.disabled = true;
        try {
          for (const f of row.files || []) await store.removeObject(f.path).catch(() => {
          });
          await store.remove(row.id);
          rows = rows.filter((r) => r.id !== row.id);
          paintAll();
        } catch (e) {
          tell(`Not deleted: ${e.message}`, true);
          delBtn.disabled = false;
          armed = false;
          delBtn.textContent = "Delete invoice";
        }
      });
      el.append(
        h("div", { class: "iv-cardhead" }, title, amount, busy, status),
        dup,
        grid,
        h("div", { class: "iv-row" }, files, can.edit ? addBtn : null, can.edit ? readBtn : null, more),
        note,
        h("div", { class: "iv-row iv-end" }, msg, can.delete ? delBtn : null)
      );
      function tell(text, bad = false) {
        msg.textContent = text || "";
        msg.classList.toggle("bad", !!bad);
      }
      async function save(patch, undo) {
        try {
          const next = await store.patch(row.id, patch);
          if (!next) throw new Error("this account cannot change invoices");
          replace(next);
          paintAll();
          tell("");
        } catch (e) {
          if (undo) undo();
          tell(`Not saved: ${e.message}`, true);
          update(row);
        }
      }
      async function readAgain() {
        const f = (row.files || [])[0];
        if (!f) {
          tell("Add the invoice file first.", true);
          return;
        }
        setState(row.id, { busy: "Reading\u2026" });
        try {
          const blob = await (await fetch(await store.open(f.path))).blob();
          const file = new File([blob], f.name, { type: f.type || blob.type });
          await readInto(row.id, file);
        } catch (e) {
          tell(`Not read: ${e.message}`, true);
        }
        setState(row.id, { busy: "" });
      }
      function update(r) {
        row = r;
        const d = r.data || {};
        title.textContent = d.supplier || "New invoice";
        amount.textContent = [d.date, d.total ? money(d.total, d.currency) : ""].filter(Boolean).join(" \xB7 ");
        for (const f of FIELDS2) {
          const input = inputs[f.key];
          if (document.activeElement !== input) input.value = d[f.key] || "";
          input.disabled = !can.edit || locked(r);
          input.classList.toggle("iv-read", (r.filled || []).includes(f.key));
          input.title = locked(r) ? "Marked paid: only someone with Full on the invoices can change it." : (r.filled || []).includes(f.key) ? "Read from the invoice. Check it; typing over it makes it yours." : "";
        }
        if (document.activeElement !== status) status.value = r.status || DEF_STATUS;
        status.disabled = !can.edit || locked(r);
        if (document.activeElement !== note) note.value = r.note || "";
        note.disabled = !can.edit;
        el.classList.toggle("paid", PAID && r.status === PAID);
        const why = dups.get(r.id);
        dup.textContent = why ? `Possible duplicate: ${why}${/[.!?]$/.test(why) ? "" : "."} Check both, and delete whichever is the copy.` : "";
        dup.hidden = !why;
        files.replaceChildren(...(r.files || []).map((f) => h(
          "span",
          { class: "iv-file" },
          h("button", { type: "button", class: "iv-link", title: "Open the file", onclick: async () => {
            try {
              window.open(await store.open(f.path), "_blank", "noopener");
            } catch (e) {
              tell(`Could not open it: ${e.message}`, true);
            }
          } }, (f.type || "").startsWith("image/") ? "\u{1F5BC} " : "\u{1F4C4} ", f.name),
          can.edit ? h("button", { type: "button", class: "iv-x", "aria-label": `Remove ${f.name}`, title: "Remove this file", onclick: () => detach(r.id, f) }, "\xD7") : null
        )));
        readBtn.disabled = !(r.files || []).length || locked(r);
        paintState();
      }
      function paintState() {
        const s = state.get(row.id) || {};
        busy.textContent = s.busy || "";
        el.classList.toggle("busy", !!s.busy);
        if (s.msg !== void 0) {
          tell(s.msg, s.bad);
          s.msg = void 0;
        }
      }
      update(row);
      return { el, update, paintState };
    }
    async function readInto(id, file) {
      const row = rows.find((r) => r.id === id);
      const reading = await readInvoice(file, { config, ai });
      const patch = applyReading(row, reading, FIELDS2, { defaultStatus: DEF_STATUS, paidStatus: PAID || "paid" });
      const next = await store.patch(id, { ...patch, read_by: reading.by });
      if (next) replace(next);
      const found = Object.keys(reading.fields || {}).length;
      setState(id, { msg: found ? "" : "Nothing could be read from this file. Fill it in by hand.", bad: !found });
      paintAll();
    }
    async function attach(id, file, { read = true } = {}) {
      const ym = (/* @__PURE__ */ new Date()).toISOString().slice(0, 7).replace("-", "/");
      const path = `${ym}/${id}/${Date.now()}-${safeName(file.name)}`;
      setState(id, { busy: "Uploading\u2026" });
      try {
        const hash = await sha256(file);
        await store.upload(path, file);
        const next = await store.addFile(id, { path, name: file.name || "invoice", type: file.type || "", size: file.size || 0, hash, at: (/* @__PURE__ */ new Date()).toISOString() });
        if (next) replace(next);
        paintAll();
        if (read) {
          setState(id, { busy: "Reading\u2026" });
          await readInto(id, file);
        }
      } catch (e) {
        setState(id, { msg: `${file.name}: ${e.message}`, bad: true });
      }
      setState(id, { busy: "" });
    }
    async function detach(id, f) {
      try {
        await store.removeObject(f.path).catch(() => {
        });
        const next = await store.removeFile(id, f.path);
        if (next) replace(next);
        paintAll();
      } catch (e) {
        setState(id, { msg: `Not removed: ${e.message}`, bad: true });
      }
    }
    async function addFiles(files) {
      const good = files.filter(okType);
      const bad = files.length - good.length;
      if (bad) progress.textContent = `${bad} file${bad === 1 ? " was" : "s were"} skipped: only PDFs and photos (JPEG, PNG, WebP, HEIC).`;
      let n = 0;
      for (const file of good) {
        n++;
        if (good.length > 1) progress.textContent = `Adding ${n} of ${good.length}\u2026`;
        let row;
        try {
          row = await store.create();
        } catch (e) {
          progress.textContent = `Not added: ${e.message}`;
          return;
        }
        if (view.month || view.status || view.q || view.dupOnly) Object.assign(view, { month: "", status: "", q: "", dupOnly: false });
        rows.unshift(row);
        paintAll();
        await attach(row.id, file);
      }
      if (good.length > 1) progress.textContent = `${good.length} invoices added and read. Check the amounts before you rely on them.`;
      else if (!bad) progress.textContent = "";
    }
    function exportCsv() {
      const now = shown();
      if (!now.length) {
        progress.textContent = "Nothing to export with these filters.";
        return;
      }
      const blob = new Blob([toCsv(now, FIELDS2, STATUSES2)], { type: "text/csv;charset=utf-8" });
      const a = h("a", { href: URL.createObjectURL(blob), download: `invoices-${view.month || "all"}-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.csv` });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4e3);
      progress.textContent = `${now.length} invoice${now.length === 1 ? "" : "s"} exported.`;
    }
    async function load() {
      try {
        rows = await store.list();
        failure = "";
      } catch (e) {
        failure = `The invoices could not be read: ${e.message}`;
      }
      loaded = true;
      paintAll();
    }
    paintAll();
    load();
    return { reload: load, addFiles };
  }

  // example/supabase-store.js
  function supabaseStore(sb, { table = "invoices", bucket = "invoices" } = {}) {
    const must = ({ data, error }) => {
      if (error) throw new Error(error.message || String(error));
      return data;
    };
    return {
      async list() {
        return must(await sb.from(table).select("*").order("created_at", { ascending: false }).limit(5e3)) || [];
      },
      async create() {
        return must(await sb.from(table).insert({ note: "" }).select().single());
      },
      async patch(id, { data = null, status = null, note = null, filled = null, read_by = null } = {}) {
        return must(await sb.rpc("invoice_patch", {
          p_id: id,
          p_data: data,
          p_status: status,
          p_note: note,
          p_filled: filled,
          p_read_by: read_by
        }));
      },
      async addFile(id, file) {
        return must(await sb.rpc("invoice_add_file", { p_id: id, p_file: file }));
      },
      async removeFile(id, path) {
        return must(await sb.rpc("invoice_remove_file", { p_id: id, p_path: path }));
      },
      async remove(id) {
        must(await sb.from(table).delete().eq("id", id));
      },
      async upload(path, file) {
        must(await sb.storage.from(bucket).upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false }));
      },
      async removeObject(path) {
        must(await sb.storage.from(bucket).remove([path]));
      },
      /* a link that works for one minute, for someone allowed to read it */
      async open(path) {
        return must(await sb.storage.from(bucket).createSignedUrl(path, 60)).signedUrl;
      }
    };
  }

  // invoice.config.js
  var invoice_config_exports = {};
  __export(invoice_config_exports, {
    AREA: () => AREA,
    DEFAULT_CURRENCY: () => DEFAULT_CURRENCY,
    DEFAULT_STATUS: () => DEFAULT_STATUS,
    FIELDS: () => FIELDS,
    OWN_NAMES: () => OWN_NAMES,
    READ_ORDER: () => READ_ORDER,
    STATUSES: () => STATUSES
  });
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
  var STATUSES = [
    { key: "unpaid", label: "Unpaid" },
    { key: "paid", label: "Paid" },
    { key: "disputed", label: "Disputed" }
  ];
  var DEFAULT_STATUS = "unpaid";
  var DEFAULT_CURRENCY = "CAD";
  var OWN_NAMES = ["Bready", "Bready Cafe", "Bready Caf\xE9", "Bready Bakery", "breadycafe.com"];
  var READ_ORDER = ["parser", "ai"];
  var AREA = "invoices";

  // browser-entry.js
  window.InvoiceKit = { mountInvoicesPage, supabaseStore, config: invoice_config_exports };
})();
