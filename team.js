(() => {
  var __defProp = Object.defineProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // core/access.js
  var RUNGS = ["none", "view", "edit", "delete", "full"];
  var RUNG_LABELS = {
    none: "No access",
    view: "Can view",
    edit: "Can edit",
    delete: "Can delete",
    full: "Full"
  };
  var RUNG_MEANS = {
    none: "The area is not offered at all.",
    view: "Opens it and reads it, and can share what is already there.",
    edit: "Adds and changes. Nothing that already exists is destroyed.",
    delete: "Also removes things. Gone, and known to be gone.",
    full: "Everything, including what quietly changes something already sent out."
  };
  var height = (word) => Math.max(0, RUNGS.indexOf(word));
  function can(perms, area, need = "view") {
    const want = RUNGS.indexOf(need);
    if (want < 1) return false;
    return height(perms && perms[area]) >= want;
  }
  var labelOf = (areas, key) => (areas.find((a) => a.key === key) || { label: key }).label;
  function meaningOf(areas, key, rung) {
    const a = areas.find((x) => x.key === key);
    return a && a.means && a.means[rung] || RUNG_MEANS[rung] || "";
  }
  function cleanPerms(perms, areas) {
    const out = {};
    for (const a of areas) {
      const v = perms && typeof perms === "object" ? perms[a.key] : void 0;
      out[a.key] = RUNGS.includes(v) ? v : "none";
    }
    return out;
  }
  function templatePerms(template, areas) {
    const p = template && template.perms || {};
    const rest = RUNGS.includes(p["*"]) ? p["*"] : "none";
    const out = {};
    for (const a of areas) out[a.key] = RUNGS.includes(p[a.key]) ? p[a.key] : rest;
    return out;
  }
  function matchTemplate(perms, templates, areas) {
    const mine = cleanPerms(perms, areas);
    const hit = templates.find((t) => {
      const tp = templatePerms(t, areas);
      return areas.every((a) => tp[a.key] === mine[a.key]);
    });
    return hit ? hit.name : null;
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
  function ceilingFor({ mine, before, area, adminArea }) {
    if (height(mine[adminArea]) >= height("full")) return "full";
    return RUNGS[Math.max(height(mine[area]), height(before[area]))];
  }

  // ui/team-page.js
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
  var when = (iso) => {
    const d = iso ? new Date(iso) : null;
    return d && !isNaN(d) ? d.toLocaleDateString(void 0, { year: "numeric", month: "short", day: "numeric" }) : "";
  };
  var uid = 0;
  function mountTeamPage(root, { api, config }) {
    const { AREAS: AREAS2, TEMPLATES: TEMPLATES2, ADMIN_AREA: ADMIN_AREA2 } = config;
    const keys = AREAS2.map((a) => a.key);
    const groups = [...new Set(AREAS2.map((a) => a.group || ""))];
    let data = null;
    let failure = "";
    let pick = TEMPLATES2.length ? TEMPLATES2[TEMPLATES2.length - 1].name : "";
    root.classList.add("ta");
    const load = async () => {
      failure = "";
      if (!data) draw();
      try {
        data = await api({ action: "list" });
      } catch (e) {
        failure = e && e.message || "Could not read the team.";
      }
      draw();
    };
    function draw() {
      root.replaceChildren();
      root.append(
        h(
          "header",
          { class: "ta-head" },
          h(
            "div",
            null,
            h("h1", null, "Team & access"),
            h("p", null, "Invite the people who work here and decide what each of them can reach. The database enforces these settings, not just the menu.")
          ),
          h("button", { class: "ta-btn", type: "button", onclick: () => load() }, "Reload")
        )
      );
      if (failure) {
        root.append(h("div", { class: "ta-error", role: "alert" }, failure));
        return;
      }
      if (!data) {
        root.append(h("p", { class: "ta-quiet" }, "Reading the team\u2026"));
        return;
      }
      const mine = cleanPerms(data.me && data.me.perms, AREAS2);
      const theirs = Array.isArray(data.areas) ? data.areas : keys;
      const odd = keys.filter((k) => !theirs.includes(k)).concat(theirs.filter((k) => !keys.includes(k)));
      if (odd.length)
        root.append(h(
          "div",
          { class: "ta-error", role: "alert" },
          `This page and the team service know different areas (${odd.join(", ")}). Deploy the same access.config.js to both; until then a change to those areas is not saved.`
        ));
      if (can(mine, ADMIN_AREA2, "edit")) root.append(inviteBox(mine));
      root.append(ladder());
      const people = (data.users || []).slice().sort((a, b) => (b.id === data.me.id) - (a.id === data.me.id) || String(a.email).localeCompare(String(b.email)));
      root.append(h(
        "section",
        { class: "ta-people", "aria-label": "People" },
        h("h2", null, `People on the team (${people.length})`),
        people.map((u) => personRow(u, mine))
      ));
    }
    function inviteBox(mine) {
      const none = cleanPerms({}, AREAS2);
      const say = h("p", { class: "ta-say", role: "status", "aria-live": "polite" });
      const blurb = h("p", { class: "ta-blurb" });
      const chips = h("div", { class: "ta-chips", role: "radiogroup", "aria-label": "Start them on" });
      const showBlurb = () => {
        const t = TEMPLATES2.find((x) => x.name === pick);
        blurb.replaceChildren(...t ? [h("b", null, t.what + ". "), t.blurb || ""] : []);
      };
      for (const t of TEMPLATES2) {
        const problems = changeProblems({ mine, before: none, next: templatePerms(t, AREAS2), areas: AREAS2, adminArea: ADMIN_AREA2 });
        const chip = h("button", {
          type: "button",
          class: "ta-chip",
          role: "radio",
          "aria-checked": String(t.name === pick),
          disabled: problems.length > 0,
          title: problems[0] || t.what,
          onclick: () => {
            pick = t.name;
            chips.querySelectorAll(".ta-chip").forEach((c) => c.setAttribute("aria-checked", String(c.textContent === pick)));
            showBlurb();
          }
        }, t.name);
        chips.append(chip);
      }
      const email = h("input", { type: "email", required: true, autocomplete: "off", placeholder: "name@company.com", "aria-label": "Their email address" });
      const send = h("button", { type: "submit", class: "ta-btn ta-primary" }, "Send the invitation");
      const form = h("form", {
        class: "ta-inviteform",
        onsubmit: async (ev) => {
          ev.preventDefault();
          const t = TEMPLATES2.find((x) => x.name === pick);
          if (!t) {
            say.textContent = "Pick a template first.";
            return;
          }
          send.disabled = true;
          say.className = "ta-say";
          say.textContent = "Sending\u2026";
          try {
            await api({ action: "invite", email: email.value.trim(), perms: templatePerms(t, AREAS2) });
            say.textContent = `Invitation sent to ${email.value.trim()}. They get an email, set their own password and start as ${t.name}.`;
            email.value = "";
            data = await api({ action: "list" });
            const keep = say.textContent;
            draw();
            const again = root.querySelector(".ta-invite .ta-say");
            if (again) again.textContent = keep;
          } catch (e) {
            say.className = "ta-say bad";
            say.textContent = e && e.message || "The invitation was not sent.";
          } finally {
            send.disabled = false;
          }
        }
      }, email, send);
      showBlurb();
      return h(
        "section",
        { class: "ta-invite" },
        h("h2", null, "Invite someone"),
        h("p", { class: "ta-quiet" }, "They get an email and set their own password; you never handle it. Start them on the template that matches the job; you can change any area afterwards."),
        chips,
        blurb,
        form,
        say
      );
    }
    function ladder() {
      return h(
        "section",
        { class: "ta-ladder", "aria-label": "The five rungs" },
        h("h2", null, "Five rungs, each carrying the ones below it"),
        h("dl", null, RUNGS.map((r) => [h("dt", null, h("span", { class: `ta-rung r-${r}` }, RUNG_LABELS[r])), h("dd", null, RUNG_MEANS[r])]))
      );
    }
    function personRow(u, mine) {
      const self = u.id === data.me.id;
      let before = cleanPerms(u.perms, AREAS2);
      let draft = { ...before };
      const iAmFull = height(mine[ADMIN_AREA2]) >= height("full");
      const mayEdit = can(mine, ADMIN_AREA2, "edit");
      const shielded = !iAmFull && !self && height(before[ADMIN_AREA2]) >= height("full");
      const locked = !mayEdit || shielded;
      const status = self ? "You" : !u.lastSeen && u.invited ? `Invited ${when(u.invited)}, has not signed in yet` : !u.lastSeen ? "Has never signed in" : `Last signed in ${when(u.lastSeen)}`;
      const badge = h("span", { class: "ta-badge" });
      const showBadge = () => {
        badge.textContent = matchTemplate(draft, TEMPLATES2, AREAS2) || "Custom mix";
      };
      const say = h("p", { class: "ta-say", role: "status", "aria-live": "polite" });
      const selects = {};
      const grid = h("div", { class: "ta-grid" });
      for (const g of groups) {
        if (g) grid.append(h("h3", { class: "ta-group" }, g));
        for (const a of AREAS2.filter((x) => (x.group || "") === g)) {
          const id = `ta-${++uid}`;
          const means = h("small", { class: "ta-means" });
          const ceiling = ceilingFor({ mine, before, area: a.key, adminArea: ADMIN_AREA2 });
          const ownAdmin = self && a.key === ADMIN_AREA2;
          const sel = h("select", {
            id,
            disabled: locked || ownAdmin,
            title: ownAdmin ? "Your own rung here is changed by another admin." : shielded ? "Only someone with Full on " + labelOf(AREAS2, ADMIN_AREA2) + " can change this person." : null
          });
          for (const r of RUNGS) {
            const above = height(r) > height(ceiling);
            sel.append(h("option", { value: r, disabled: above, title: above ? "Above your own rung" : null }, RUNG_LABELS[r]));
          }
          sel.value = draft[a.key];
          sel.addEventListener("change", () => {
            draft[a.key] = sel.value;
            changed();
          });
          selects[a.key] = { sel, means };
          grid.append(h(
            "div",
            { class: "ta-area", "data-area": a.key },
            h("label", { for: id }, a.label),
            sel,
            means
          ));
        }
      }
      const saveBtn = h("button", { type: "button", class: "ta-btn ta-primary", disabled: true, onclick: () => save() }, "Save changes");
      const undoBtn = h("button", { type: "button", class: "ta-btn", disabled: true, onclick: () => {
        draft = { ...before };
        sync();
      } }, "Undo");
      const tplChips = h("div", { class: "ta-chips small", "aria-label": "Apply a template" });
      for (const t of TEMPLATES2) {
        const tp = templatePerms(t, AREAS2);
        const problems = locked ? ["This person cannot be changed from this account."] : changeProblems({ mine, before, next: self ? { ...tp, [ADMIN_AREA2]: before[ADMIN_AREA2] } : tp, areas: AREAS2, adminArea: ADMIN_AREA2, self });
        tplChips.append(h("button", {
          type: "button",
          class: "ta-chip",
          disabled: problems.length > 0,
          title: problems[0] || `${t.what}: set every area as ${t.name}`,
          onclick: () => {
            draft = self ? { ...tp, [ADMIN_AREA2]: before[ADMIN_AREA2] } : { ...tp };
            sync();
          }
        }, t.name));
      }
      const extra = [];
      if (mayEdit && !self && !u.lastSeen)
        extra.push(h("button", { type: "button", class: "ta-btn", onclick: async (ev) => {
          const btn = ev.currentTarget;
          btn.disabled = true;
          try {
            await api({ action: "resend", id: u.id });
            tell(`Invitation sent to ${u.email} again.`);
          } catch (e) {
            tell(e.message, true);
          } finally {
            btn.disabled = false;
          }
        } }, "Send the invitation again"));
      const removal = removeProblems({ mine, target: before, areas: AREAS2, adminArea: ADMIN_AREA2, self });
      if (can(mine, ADMIN_AREA2, "delete") && !self) {
        const removeBtn = h("button", { type: "button", class: "ta-btn ta-danger", disabled: removal.length > 0, title: removal[0] || null }, "Remove from the team");
        let armed = false;
        removeBtn.addEventListener("click", async () => {
          if (!armed) {
            armed = true;
            removeBtn.textContent = `Yes, remove ${u.email}`;
            tell("Press it again to remove them: their account is deleted and every session of theirs ends. This cannot be undone.");
            setTimeout(() => {
              if (armed) {
                armed = false;
                removeBtn.textContent = "Remove from the team";
              }
            }, 8e3);
            return;
          }
          removeBtn.disabled = true;
          try {
            await api({ action: "remove", id: u.id });
            data = await api({ action: "list" });
            draw();
          } catch (e) {
            tell(e.message, true);
            removeBtn.disabled = false;
          }
        });
        extra.push(removeBtn);
      }
      function tell(text, bad = false) {
        say.className = bad ? "ta-say bad" : "ta-say";
        say.textContent = text || "";
      }
      function sync() {
        for (const k of keys) selects[k].sel.value = draft[k];
        changed();
      }
      function changed() {
        for (const k of keys) selects[k].means.textContent = meaningOf(AREAS2, k, draft[k]);
        const dirty = keys.some((k) => draft[k] !== before[k]);
        saveBtn.disabled = !dirty;
        undoBtn.disabled = !dirty;
        showBadge();
        if (dirty) tell("Not saved yet.");
        else if (say.textContent === "Not saved yet.") tell("");
      }
      async function save() {
        const problems = changeProblems({ mine, before, next: draft, areas: AREAS2, adminArea: ADMIN_AREA2, self });
        if (problems.length) {
          tell(problems[0], true);
          return;
        }
        saveBtn.disabled = true;
        tell("Saving\u2026");
        try {
          const res = await api({ action: "perms", id: u.id, perms: draft });
          before = cleanPerms(res && res.user && res.user.perms || draft, AREAS2);
          draft = { ...before };
          u.perms = before;
          sync();
          tell(self ? "Saved." : `Saved. It applies to ${u.email} at once; their menu catches up the next time their page refreshes its sign-in.`);
        } catch (e) {
          tell(e.message, true);
          saveBtn.disabled = false;
        }
      }
      const row = h(
        "details",
        { class: "ta-person" + (self ? " me" : ""), "data-email": u.email },
        h(
          "summary",
          null,
          h("span", { class: "ta-email" }, u.email),
          h("span", { class: "ta-status" }, status),
          badge
        ),
        shielded ? h("p", { class: "ta-quiet" }, `${u.email} has Full on ${labelOf(AREAS2, ADMIN_AREA2)}. Only someone who has it too can change them.`) : null,
        grid,
        h(
          "div",
          { class: "ta-actions" },
          locked ? null : h("span", { class: "ta-quiet" }, "Apply a template:"),
          locked ? null : tplChips,
          h("span", { class: "ta-grow" }),
          ...extra,
          locked ? null : undoBtn,
          locked ? null : saveBtn
        ),
        say
      );
      changed();
      return row;
    }
    load();
    return { reload: load };
  }

  // access.config.js
  var access_config_exports = {};
  __export(access_config_exports, {
    ADMIN_AREA: () => ADMIN_AREA,
    AREAS: () => AREAS,
    TEMPLATES: () => TEMPLATES
  });
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
  var TEMPLATES = [
    { name: "Admin", what: "Her \u015Fey", blurb: "B\xFCt\xFCn b\xF6l\xFCmler tam yetki, ekip y\xF6netimi dahil.", perms: { "*": "full" } },
    {
      name: "Manager",
      what: "Mutfa\u011F\u0131 y\xF6netir",
      blurb: "Sat\u0131\u015F girer ve siler; re\xE7ete, fiyat, plan ve \xF6zel g\xFCnleri de\u011Fi\u015Ftirir. Ekibi g\xF6r\xFCr ama yetki veremez.",
      perms: { sales: "delete", usage: "view", plan: "edit", recipes: "edit", ingredients: "edit", calendar: "edit", team: "view" }
    },
    {
      name: "Supervisor",
      what: "Sat\u0131\u015F girer",
      blurb: "Sat\u0131\u015F girer ve y\xFCkler; geri kalan her \u015Feyi g\xF6r\xFCr.",
      perms: { sales: "edit", usage: "view", plan: "view", recipes: "view", ingredients: "view", calendar: "view" }
    },
    {
      name: "Staff",
      what: "Sadece g\xF6r\xFCr",
      blurb: "Sat\u0131\u015F, kullan\u0131m, plan, re\xE7ete ve fiyatlar\u0131 g\xF6r\xFCr. Hi\xE7bir \u015Fey giremez.",
      perms: { sales: "view", usage: "view", plan: "view", recipes: "view", ingredients: "view", calendar: "view" }
    }
  ];

  // entry.js
  window.TeamKit = { mountTeamPage, config: access_config_exports };
})();
