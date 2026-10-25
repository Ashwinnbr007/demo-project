// Chat UI for the MinIO + Qdrant RAG API. Served by FastAPI from the same origin.
const STORAGE_KEY = "bucket-chat:v1";

const $ = (sel) => document.querySelector(sel);
const els = {
  app: $("#app"),
  thread: $("#thread"),
  history: $("#history"),
  composer: $("#composer"),
  input: $("#input"),
  send: $("#send"),
  limit: $("#limit"),
  prefix: $("#prefix"),
  ingestBtn: $("#ingest-btn"),
  ingestResult: $("#ingest-result"),
  status: $("#status"),
  emptyTpl: $("#empty-tpl"),
};

let state = loadState();
let mode = state.mode || "ask";
let inflight = null; // AbortController for the current request

// ---------- Persistence ----------
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { conversations: [], activeId: null, mode: "ask" };
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, mode }));
  } catch {}
}

function activeConversation() {
  return state.conversations.find((c) => c.id === state.activeId) || null;
}

function newConversation() {
  const convo = { id: crypto.randomUUID(), title: "New chat", messages: [], createdAt: Date.now() };
  state.conversations.unshift(convo);
  state.activeId = convo.id;
  saveState();
  return convo;
}

// ---------- Rendering helpers ----------
function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

function inline(text) {
  return text
    // Local models sometimes wrap complexity in LaTeX ($O(n)$); show it as plain text.
    .replace(/\$([^$\n]*[()^_\\][^$\n]*)\$/g, "$1")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>")
    .replace(/\[(\d+(?:\s*,\s*\d+)*)\]/g, (_, nums) =>
      nums.split(",").map((n) => `<button class="cite" data-n="${n.trim()}">${n.trim()}</button>`).join("")
    );
}

// Small markdown renderer: paragraphs, lists, headings, code blocks, inline styles, [n] citations.
function renderMarkdown(src) {
  const lines = escapeHtml(src).split("\n");
  let html = "";
  let list = null;
  let para = [];
  let code = null;

  const flushPara = () => {
    if (para.length) html += `<p>${inline(para.join("<br>"))}</p>`;
    para = [];
  };
  const closeList = () => {
    if (list) html += `</${list}>`;
    list = null;
  };

  const isTableRow = (line) => /^\s*\|.*\|\s*$/.test(line);
  const cells = (line) => line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (code !== null) {
      if (line.trim().startsWith("```")) {
        html += `<pre><code>${code.join("\n")}</code></pre>`;
        code = null;
      } else code.push(line);
      continue;
    }
    if (line.trim().startsWith("```")) { flushPara(); closeList(); code = []; continue; }

    // Table: a header row followed by a |---|---| separator row.
    if (isTableRow(line) && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1] || "")) {
      flushPara(); closeList();
      html += `<div class="table-wrap"><table><thead><tr>${cells(line).map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>`;
      i += 2;
      while (i < lines.length && isTableRow(lines[i])) {
        html += `<tr>${cells(lines[i]).map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`;
        i++;
      }
      html += "</tbody></table></div>";
      i--;
      continue;
    }

    const heading = line.match(/^#{1,4}\s+(.*)/);
    const bullet = line.match(/^\s*[-*•]\s+(.*)/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)/);

    if (/^\s*([-*_])\s*\1\s*\1[\s\1]*$/.test(line)) { flushPara(); closeList(); html += "<hr>"; }
    else if (heading) { flushPara(); closeList(); html += `<h4>${inline(heading[1])}</h4>`; }
    else if (bullet || numbered) {
      flushPara();
      const tag = bullet ? "ul" : "ol";
      if (list !== tag) { closeList(); html += `<${tag}>`; list = tag; }
      html += `<li>${inline((bullet || numbered)[1])}</li>`;
    } else if (!line.trim()) { flushPara(); closeList(); }
    else { closeList(); para.push(line); }
  }
  if (code !== null) html += `<pre><code>${code.join("\n")}</code></pre>`;
  flushPara();
  closeList();
  return html;
}

const ICONS = {
  chevron: '<svg viewBox="0 0 24 24" width="12" height="12"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  copy: '<svg viewBox="0 0 24 24" width="13" height="13"><rect x="8" y="8" width="12" height="12" rx="2" stroke="currentColor" stroke-width="1.8" fill="none"/><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2" stroke="currentColor" stroke-width="1.8" fill="none"/></svg>',
  retry: '<svg viewBox="0 0 24 24" width="13" height="13"><path d="M4 12a8 8 0 0114-5.3M20 12a8 8 0 01-14 5.3M18 3v4h-4M6 21v-4h4" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  trash: '<svg viewBox="0 0 24 24" width="14" height="14"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

function sourceLabel(meta) {
  return meta.page ? `${meta.source} · p.${meta.page}` : meta.source;
}

function renderSources(sources, open) {
  const items = sources.map((s, i) => {
    const pct = Math.max(0, Math.min(1, s.score)) * 100;
    return `
      <div class="source" data-n="${i + 1}">
        <div class="source-head">
          <span class="n">[${i + 1}]</span>
          <span class="name" title="${escapeHtml(sourceLabel(s.metadata))}">${escapeHtml(sourceLabel(s.metadata))}</span>
          <span class="score"><span class="score-bar"><i style="width:${pct.toFixed(0)}%"></i></span>${s.score.toFixed(3)}</span>
        </div>
        <div class="source-text">${escapeHtml(s.text)}</div>
        ${s.text.length > 320 ? '<button class="source-more">Show more</button>' : ""}
      </div>`;
  }).join("");
  return `
    <div class="sources${open ? " open" : ""}">
      <button class="sources-toggle">${ICONS.chevron}${sources.length} source${sources.length === 1 ? "" : "s"}</button>
      <div class="source-list">${items}</div>
    </div>`;
}

function messageHtml(msg, index) {
  if (msg.role === "user") {
    return `<div class="msg user"><div class="bubble">${escapeHtml(msg.content)}</div></div>`;
  }
  let body;
  if (msg.pending) {
    body = `<div class="thinking"><span class="dots"><i></i><i></i><i></i></span>
      <span>${msg.mode === "ask" ? "Searching documents and writing an answer" : "Searching documents"}</span>
      <span class="elapsed" data-started="${msg.startedAt}">0s</span></div>`;
  } else if (msg.error) {
    body = `<div class="error-box">${escapeHtml(msg.error)}</div>`;
  } else if (msg.mode === "retrieve") {
    body = msg.sources.length
      ? `<div class="content"><p>Top ${msg.sources.length} matching chunks from your bucket:</p></div>${renderSources(msg.sources, true)}`
      : `<div class="content"><p>No matching chunks. Try ingesting documents first.</p></div>`;
  } else {
    body = `<div class="content">${renderMarkdown(msg.content)}</div>${msg.sources?.length ? renderSources(msg.sources, false) : ""}`;
  }
  const actions = msg.pending ? "" : `
    <div class="msg-actions">
      ${msg.content ? `<button data-action="copy" data-index="${index}">${ICONS.copy}Copy</button>` : ""}
      <button data-action="retry" data-index="${index}">${ICONS.retry}Retry</button>
    </div>`;
  return `<div class="msg assistant" data-index="${index}"><div class="avatar">B</div><div class="body">${body}${actions}</div></div>`;
}

function renderThread() {
  const convo = activeConversation();
  if (!convo || !convo.messages.length) {
    els.thread.innerHTML = "";
    els.thread.appendChild(els.emptyTpl.content.cloneNode(true));
    return;
  }
  els.thread.innerHTML = convo.messages.map(messageHtml).join("");
  els.thread.scrollTop = els.thread.scrollHeight;
}

function renderHistory() {
  if (!state.conversations.length) { els.history.innerHTML = ""; return; }
  els.history.innerHTML = '<div class="history-label">Recent</div>' + state.conversations.map((c) => `
    <div class="history-item${c.id === state.activeId ? " active" : ""}" data-id="${c.id}" role="button" tabindex="0">
      <span class="title">${escapeHtml(c.title)}</span>
      <button class="delete" data-delete="${c.id}" aria-label="Delete chat">${ICONS.trash}</button>
    </div>`).join("");
}

function render() {
  renderHistory();
  renderThread();
  updateComposer();
}

function updateComposer() {
  const busy = Boolean(inflight);
  els.send.classList.toggle("busy", busy);
  els.send.disabled = !busy && !els.input.value.trim();
  els.send.setAttribute("aria-label", busy ? "Stop" : "Send");
}

// ---------- API ----------
async function postJson(path, body, signal) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail ? (typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail)) : `Request failed (${res.status})`);
  return data;
}

async function sendQuestion(question, { replaceIndex } = {}) {
  let convo = activeConversation() || newConversation();
  const limit = Number(els.limit.value);

  let assistantIndex;
  if (replaceIndex === undefined) {
    convo.messages.push({ role: "user", content: question });
    if (convo.title === "New chat") convo.title = question.length > 48 ? question.slice(0, 48) + "…" : question;
    convo.messages.push({ role: "assistant", pending: true, mode, startedAt: Date.now() });
    assistantIndex = convo.messages.length - 1;
  } else {
    assistantIndex = replaceIndex;
    convo.messages[assistantIndex] = { role: "assistant", pending: true, mode, startedAt: Date.now() };
  }
  saveState();
  render();

  inflight = new AbortController();
  updateComposer();
  const requestMode = mode;
  try {
    const data = await postJson(requestMode === "ask" ? "/ask" : "/retrieve", { query: question, limit }, inflight.signal);
    convo.messages[assistantIndex] = requestMode === "ask"
      ? { role: "assistant", mode: "ask", content: data.answer, sources: data.sources || [] }
      : { role: "assistant", mode: "retrieve", content: "", sources: data.results || [] };
  } catch (err) {
    const message = err.name === "AbortError" ? "Stopped." : err.message || "Something went wrong.";
    convo.messages[assistantIndex] = { role: "assistant", mode: requestMode, error: message };
  } finally {
    inflight = null;
    saveState();
    render();
  }
}

async function runIngest() {
  els.ingestBtn.disabled = true;
  els.ingestBtn.classList.add("loading");
  els.ingestBtn.querySelector("span").textContent = "Ingesting…";
  els.ingestResult.hidden = false;
  els.ingestResult.innerHTML = '<span>Reading the bucket, chunking and embedding…</span>';
  try {
    const data = await postJson("/ingest", { prefix: els.prefix.value.trim() });
    const chunks = data.ingested.reduce((sum, item) => sum + item.chunks_indexed, 0);
    const rows = [
      ...data.ingested.map((i) => `<div class="row"><span>${escapeHtml(i.object)}</span><span>${i.chunks_indexed}</span></div>`),
      ...data.skipped.map((s) => `<div class="row skip"><span>${escapeHtml(s)}</span><span>skipped</span></div>`),
      ...data.failed.map((f) => `<div class="row bad" title="${escapeHtml(f.error)}"><span>${escapeHtml(f.object)}</span><span>failed</span></div>`),
    ];
    els.ingestResult.innerHTML = `<span class="summary">${data.ingested.length} file${data.ingested.length === 1 ? "" : "s"} · ${chunks} chunks indexed</span>${rows.join("")}`;
  } catch (err) {
    els.ingestResult.innerHTML = `<span class="bad">${escapeHtml(err.message)}</span>`;
  } finally {
    els.ingestBtn.disabled = false;
    els.ingestBtn.classList.remove("loading");
    els.ingestBtn.querySelector("span").textContent = "Ingest from MinIO";
  }
}

async function checkHealth() {
  const text = els.status.querySelector(".status-text");
  try {
    const res = await fetch("/health");
    const data = await res.json();
    els.status.className = "status ok";
    text.textContent = `${data.model} · ${data.bucket}`;
  } catch {
    els.status.className = "status down";
    text.textContent = "API unreachable";
  }
}

// ---------- Events ----------
function setMode(next) {
  mode = next;
  document.querySelectorAll(".mode").forEach((btn) => {
    const active = btn.dataset.mode === mode;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-selected", String(active));
  });
  els.input.placeholder = mode === "ask" ? "Ask anything about your documents…" : "Search your documents…";
  saveState();
}

function autosize() {
  els.input.style.height = "auto";
  els.input.style.height = Math.min(els.input.scrollHeight, 200) + "px";
}

function submit() {
  if (inflight) { inflight.abort(); return; }
  const question = els.input.value.trim();
  if (!question) return;
  els.input.value = "";
  autosize();
  sendQuestion(question);
}

function closeSidebar() { els.app.classList.remove("sidebar-open"); }

els.composer.addEventListener("submit", (e) => { e.preventDefault(); submit(); });
els.input.addEventListener("input", () => { autosize(); updateComposer(); });
els.input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); submit(); }
});

document.querySelectorAll(".mode").forEach((btn) => btn.addEventListener("click", () => setMode(btn.dataset.mode)));

$("#new-chat").addEventListener("click", () => {
  const current = activeConversation();
  if (!current || current.messages.length) newConversation();
  render();
  closeSidebar();
  els.input.focus();
});

els.history.addEventListener("click", (e) => {
  const del = e.target.closest("[data-delete]");
  if (del) {
    state.conversations = state.conversations.filter((c) => c.id !== del.dataset.delete);
    if (state.activeId === del.dataset.delete) state.activeId = state.conversations[0]?.id || null;
    saveState();
    render();
    return;
  }
  const item = e.target.closest(".history-item");
  if (item && !inflight) {
    state.activeId = item.dataset.id;
    saveState();
    render();
    closeSidebar();
  }
});

els.thread.addEventListener("click", (e) => {
  const suggestion = e.target.closest(".suggestion");
  if (suggestion) { sendQuestion(suggestion.textContent); return; }

  const toggle = e.target.closest(".sources-toggle");
  if (toggle) { toggle.parentElement.classList.toggle("open"); return; }

  const more = e.target.closest(".source-more");
  if (more) {
    const card = more.closest(".source");
    card.classList.toggle("expanded");
    more.textContent = card.classList.contains("expanded") ? "Show less" : "Show more";
    return;
  }

  const cite = e.target.closest(".cite");
  if (cite) {
    const sources = cite.closest(".body").querySelector(".sources");
    if (!sources) return;
    sources.classList.add("open");
    const card = sources.querySelector(`.source[data-n="${cite.dataset.n}"]`);
    if (!card) return;
    card.scrollIntoView({ behavior: "smooth", block: "nearest" });
    card.classList.add("flash");
    setTimeout(() => card.classList.remove("flash"), 1200);
    return;
  }

  const action = e.target.closest("[data-action]");
  if (action) {
    const convo = activeConversation();
    const index = Number(action.dataset.index);
    if (action.dataset.action === "copy") {
      navigator.clipboard?.writeText(convo.messages[index].content || "");
      action.lastChild.textContent = "Copied";
      setTimeout(() => (action.lastChild.textContent = "Copy"), 1200);
    } else if (action.dataset.action === "retry" && !inflight) {
      const question = convo.messages[index - 1]?.content;
      if (question) sendQuestion(question, { replaceIndex: index });
    }
  }
});

els.ingestBtn.addEventListener("click", runIngest);
$("#open-sidebar").addEventListener("click", () => els.app.classList.add("sidebar-open"));
$("#close-sidebar").addEventListener("click", closeSidebar);
$("#scrim").addEventListener("click", closeSidebar);

// Tick the elapsed timer on the pending message (local LLM answers can take a while).
setInterval(() => {
  document.querySelectorAll(".elapsed[data-started]").forEach((el) => {
    el.textContent = `${Math.floor((Date.now() - Number(el.dataset.started)) / 1000)}s`;
  });
}, 500);

// Pending messages can't survive a reload; turn them into errors so Retry is available.
state.conversations.forEach((c) => c.messages.forEach((m, i) => {
  if (m.pending) c.messages[i] = { role: "assistant", mode: m.mode, error: "Interrupted. Press Retry to ask again." };
}));

setMode(mode);
render();
checkHealth();
els.input.focus();
