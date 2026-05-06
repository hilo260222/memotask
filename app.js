"use strict";

const STORAGE_KEY = "memotask.v1";
const SYNC_CONFIG_KEY = "memotask.sync.v1";
const SUPABASE_MODULE_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
const SYNC_TABLE = "memotask_documents";
const DEFAULT_SUPABASE_URL = "https://jiqeeyvliscsecurpcze.supabase.co";
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_kDEXqe52bErulc0v_G8W0w_zJm6bcHD";
const REQUIRE_LOGIN = true;
const todayIso = () => new Date().toISOString().slice(0, 10);
const priorityRank = { high: 3, normal: 2, low: 1 };
const priorityLabels = { high: "高", normal: "中", low: "低" };
const uid = () =>
  globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const colors = [
  { name: "白", value: "#ffffff" },
  { name: "レモン", value: "#fef9c3" },
  { name: "ミント", value: "#dcfce7" },
  { name: "空", value: "#dbeafe" },
  { name: "桜", value: "#ffe4e6" },
  { name: "藤", value: "#ede9fe" },
];

const fallbackState = {
  activeView: "all",
  taskSort: "due",
  updatedAt: new Date().toISOString(),
  labels: [
    { id: "work", name: "仕事", color: "#dbeafe", hidden: false },
    { id: "shopping", name: "買い物", color: "#dcfce7", hidden: false },
    { id: "idea", name: "アイデア", color: "#ede9fe", hidden: false },
    { id: "home", name: "家", color: "#fef9c3", hidden: false },
    { id: "read-later", name: "あとで読む", color: "#ffe4e6", hidden: false },
  ],
  notes: [
    {
      id: "sample-1",
      title: "今日やること",
      content: "請求書を確認したら、山田さんに返信する。\n買い物は帰り道で済ませる。",
      color: "#ffffff",
      pinned: true,
      archived: false,
      trashed: false,
      labelIds: ["work", "shopping"],
      tasks: [
        { id: "task-1", text: "請求書を確認", completed: false, dueAt: `${todayIso()}T10:00`, priority: "high", sortOrder: 0 },
        { id: "task-2", text: "山田さんに返信", completed: false, dueAt: `${todayIso()}T15:00`, priority: "normal", sortOrder: 1 },
        { id: "task-3", text: "牛乳を買う", completed: false, dueAt: "", priority: "low", sortOrder: 2 },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "sample-2",
      title: "YouTube企画案",
      content:
        "短いTipsを3本まとめる。メモアプリの使い方、タスク整理、朝のルーティン。長いメモでもカードでは読みやすい量に省略される。",
      color: "#ede9fe",
      pinned: false,
      archived: false,
      trashed: false,
      labelIds: ["idea"],
      tasks: [{ id: "task-4", text: "企画案を3つ考える", completed: false, dueAt: "", priority: "normal", sortOrder: 0 }],
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 86400000).toISOString(),
    },
  ],
};

let state = loadState();
let currentNoteId = null;
let supabaseClient = null;

const $ = (selector) => document.querySelector(selector);

const els = {
  appShell: $(".app-shell"),
  authGate: $("#authGate"),
  authGateStatus: $("#authGateStatus"),
  gateEmail: $("#gateEmail"),
  gateMagicLinkBtn: $("#gateMagicLinkBtn"),
  desktopNav: $("#desktopNav"),
  mobileNav: $("#mobileNav"),
  notesGrid: $("#notesGrid"),
  taskView: $("#taskView"),
  emptyState: $("#emptyState"),
  viewKicker: $("#viewKicker"),
  viewTitle: $("#viewTitle"),
  viewMeta: $("#viewMeta"),
  searchInput: $("#searchInput"),
  quickTitle: $("#quickTitle"),
  quickContent: $("#quickContent"),
  quickTaskBtn: $("#quickTaskBtn"),
  quickSaveBtn: $("#quickSaveBtn"),
  newNoteBtn: $("#newNoteBtn"),
  syncBtn: $("#syncBtn"),
  signOutBtn: $("#signOutBtn"),
  syncDialog: $("#syncDialog"),
  syncForm: $("#syncForm"),
  syncUrl: $("#syncUrl"),
  syncAnonKey: $("#syncAnonKey"),
  syncEmail: $("#syncEmail"),
  syncStatus: $("#syncStatus"),
  saveSyncConfigBtn: $("#saveSyncConfigBtn"),
  sendMagicLinkBtn: $("#sendMagicLinkBtn"),
  pullSyncBtn: $("#pullSyncBtn"),
  pushSyncBtn: $("#pushSyncBtn"),
  syncNowBtn: $("#syncNowBtn"),
  openDrawerBtn: $("#openDrawerBtn"),
  closeDrawerBtn: $("#closeDrawerBtn"),
  drawerBackdrop: $("#drawerBackdrop"),
  mobileDrawer: $("#mobileDrawer"),
  noteDialog: $("#noteDialog"),
  noteForm: $("#noteForm"),
  editorTitle: $("#editorTitle"),
  editorContent: $("#editorContent"),
  taskEditorList: $("#taskEditorList"),
  labelPicker: $("#labelPicker"),
  colorPicker: $("#colorPicker"),
  addTaskBtn: $("#addTaskBtn"),
  createLabelBtn: $("#createLabelBtn"),
  pinBtn: $("#pinBtn"),
  archiveBtn: $("#archiveBtn"),
  trashBtn: $("#trashBtn"),
};

function loadState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return structuredClone(fallbackState);
    const parsed = JSON.parse(stored);
    return {
      activeView: parsed.activeView || "all",
      taskSort: parsed.taskSort || "due",
      updatedAt: parsed.updatedAt || new Date().toISOString(),
      labels: Array.isArray(parsed.labels) ? parsed.labels : fallbackState.labels,
      notes: normalizeNotes(Array.isArray(parsed.notes) ? parsed.notes : []),
    };
  } catch {
    return structuredClone(fallbackState);
  }
}

function saveState({ touch = true } = {}) {
  if (touch) state.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  updateSyncStatus();
}

function normalizeNotes(notes) {
  return notes.map((note) => ({
    ...note,
    tasks: Array.isArray(note.tasks)
      ? note.tasks.map((task, index) => ({
          ...task,
          dueAt: task.dueAt || (task.dueDate ? `${task.dueDate}T09:00` : ""),
          priority: ["high", "normal", "low"].includes(task.priority) ? task.priority : "normal",
          sortOrder: Number.isFinite(task.sortOrder) ? task.sortOrder : index,
        }))
      : [],
  }));
}

function updateNote(noteId, patch) {
  state.notes = state.notes.map((note) =>
    note.id === noteId ? { ...note, ...patch, updatedAt: new Date().toISOString() } : note,
  );
  saveState();
  render();
}

function getVisibleLabels() {
  return state.labels.filter((label) => !label.hidden);
}

function getViewInfo() {
  const active = state.activeView;
  if (active === "all") return { title: "メモ", kicker: "すべてのメモ" };
  if (active === "tasks") return { title: "今日のタスク", kicker: "タスク" };
  if (active === "pinned") return { title: "ピン留め", kicker: "固定したメモ" };
  if (active === "archive") return { title: "アーカイブ", kicker: "保管したメモ" };
  if (active === "trash") return { title: "ゴミ箱", kicker: "消さずに退避したメモ" };
  if (active.startsWith("label:")) {
    const label = state.labels.find((item) => item.id === active.slice(6));
    return { title: label ? `#${label.name}` : "ラベル", kicker: "ラベル別メモ" };
  }
  return { title: "メモ", kicker: "すべてのメモ" };
}

function filterNotes() {
  const query = els.searchInput.value.trim().toLowerCase();
  let notes = [...state.notes];

  if (state.activeView === "all") notes = notes.filter((note) => !note.archived && !note.trashed);
  if (state.activeView === "pinned")
    notes = notes.filter((note) => note.pinned && !note.archived && !note.trashed);
  if (state.activeView === "archive") notes = notes.filter((note) => note.archived && !note.trashed);
  if (state.activeView === "trash") notes = notes.filter((note) => note.trashed);
  if (state.activeView.startsWith("label:")) {
    const labelId = state.activeView.slice(6);
    notes = notes.filter((note) => note.labelIds.includes(labelId) && !note.archived && !note.trashed);
  }

  if (query) {
    notes = notes.filter((note) => {
      const labelNames = note.labelIds
        .map((id) => state.labels.find((label) => label.id === id)?.name || "")
        .join(" ");
      const taskText = note.tasks.map((task) => task.text).join(" ");
      return `${note.title} ${note.content} ${labelNames} ${taskText}`.toLowerCase().includes(query);
    });
  }

  return notes.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt));
}

function getVisibleTasks(note) {
  return note.tasks.filter((task) => !task.hidden && task.text.trim());
}

function renderNav(target) {
  const visibleNotes = state.notes.filter((note) => !note.archived && !note.trashed);
  const navItems = [
    ["all", "メモ", "すべてのメモ", visibleNotes.length],
    ["tasks", "□", "今日のタスク", countTodayTasks()],
    ["pinned", "⌃", "ピン留め", visibleNotes.filter((note) => note.pinned).length],
    ["archive", "□", "アーカイブ", state.notes.filter((note) => note.archived && !note.trashed).length],
    ["trash", "◇", "ゴミ箱", state.notes.filter((note) => note.trashed).length],
  ];

  const labelItems = getVisibleLabels()
    .map((label) => {
      const count = visibleNotes.filter((note) => note.labelIds.includes(label.id)).length;
      return navButton(`label:${label.id}`, "#", `#${label.name}`, count);
    })
    .join("");

  target.innerHTML = `
    ${navItems.map(([view, icon, label, count]) => navButton(view, icon, label, count)).join("")}
    <div class="nav-divider">ラベル</div>
    ${labelItems}
    <button class="nav-item" type="button" data-action="add-label">
      <span class="nav-main"><span>＋</span><span class="nav-label">ラベルを追加</span></span>
    </button>
  `;
}

function navButton(view, icon, label, count) {
  const active = state.activeView === view ? " active" : "";
  return `
    <button class="nav-item${active}" type="button" data-view="${view}">
      <span class="nav-main"><span>${icon}</span><span class="nav-label">${escapeHtml(label)}</span></span>
      <span class="nav-count">${count}</span>
    </button>
  `;
}

function renderNotes() {
  const notes = filterNotes();
  els.notesGrid.innerHTML = notes.map(renderNoteCard).join("");
  els.emptyState.hidden = notes.length > 0 || state.activeView === "tasks";
  els.notesGrid.hidden = state.activeView === "tasks";
}

function renderNoteCard(note) {
  const visibleTaskLimit = window.innerWidth <= 760 ? 3 : 5;
  const visibleTasks = getVisibleTasks(note);
  const taskPreview = visibleTasks.slice(0, visibleTaskLimit);
  const remainingTasks = visibleTasks.length - taskPreview.length;
  const labels = note.labelIds
    .map((id) => state.labels.find((label) => label.id === id))
    .filter(Boolean)
    .filter((label) => !label.hidden);

  return `
    <article class="note-card" style="--card-bg: ${note.color || "#ffffff"}">
      <button class="note-card-button" type="button" data-open-note="${note.id}">
        ${note.title ? `<h2>${escapeHtml(note.title)}</h2>` : ""}
        ${note.content ? `<div class="note-content-preview">${escapeHtml(note.content)}</div>` : ""}
        ${
          taskPreview.length
        ? `<div class="card-tasks">${taskPreview
            .map(
              (task) => `
                <label class="task-line ${task.completed ? "completed" : ""}" data-stop-card>
                  <input type="checkbox" ${task.completed ? "checked" : ""} data-toggle-task="${note.id}:${task.id}" />
                  <span>${escapeHtml(task.text)}${renderTaskMeta(task)}</span>
                </label>
              `,
            )
                .join("")}${remainingTasks > 0 ? `<div class="more-line">他${remainingTasks}件</div>` : ""}</div>`
            : ""
        }
        ${
          labels.length
            ? `<div class="label-row">${labels
                .map((label) => `<span class="label-chip">#${escapeHtml(label.name)}</span>`)
                .join("")}</div>`
            : ""
        }
      </button>
      <div class="card-footer">
        <button type="button" data-pin-note="${note.id}">${note.pinned ? "固定中" : "ピン"}</button>
        <button type="button" data-archive-note="${note.id}">${note.archived ? "戻す" : "保管"}</button>
        <button type="button" data-trash-note="${note.id}">${note.trashed ? "戻す" : "ゴミ箱"}</button>
      </div>
    </article>
  `;
}

function renderTasks() {
  const taskGroups = getTaskGroups();
  els.taskView.hidden = state.activeView !== "tasks";
  if (state.activeView !== "tasks") {
    els.taskView.innerHTML = "";
    return;
  }

  els.taskView.innerHTML = Object.entries(taskGroups)
    .map(([title, tasks], index) => {
      const controls =
        index === 0
          ? `<div class="task-sortbar" aria-label="タスクの並び替え">
              ${sortButton("due", "日時順")}
              ${sortButton("priority", "優先度順")}
              ${sortButton("manual", "メモ内順")}
            </div>`
          : "";
      return [title, tasks, controls];
    })
    .map(([title, tasks, controls]) => {
      const body = tasks.length
        ? tasks
            .map(
              ({ note, task }) => `
                <div class="task-row">
                  <input type="checkbox" ${task.completed ? "checked" : ""} data-toggle-task="${note.id}:${task.id}" />
                  <div>
                    <div class="${task.completed ? "task-line completed" : ""}"><span>${escapeHtml(task.text)}</span></div>
                    <div class="task-meta-row">
                      <span class="priority-chip ${task.priority || "normal"}">優先度 ${priorityLabels[task.priority] || "中"}</span>
                      ${task.dueAt ? `<span class="due-chip">${formatDateTime(task.dueAt)}</span>` : ""}
                    </div>
                  </div>
                  <button class="task-note-link" type="button" data-open-note="${note.id}">元メモ</button>
                </div>
              `,
            )
            .join("")
        : `<p class="more-line">該当するタスクはありません。</p>`;
      return `<section class="task-section">${controls}<h2>${title}</h2>${body}</section>`;
    })
    .join("");
}

function sortButton(sort, label) {
  return `<button class="sort-button ${state.taskSort === sort ? "active" : ""}" type="button" data-task-sort="${sort}">${label}</button>`;
}

function getTaskGroups() {
  const today = todayIso();
  const soonLimit = new Date();
  soonLimit.setDate(soonLimit.getDate() + 7);
  const soonIso = soonLimit.toISOString().slice(0, 10);
  const rows = state.notes
    .filter((note) => !note.trashed && !note.archived)
    .flatMap((note) => getVisibleTasks(note).map((task) => ({ note, task })));

  return {
    今日: sortTasks(rows.filter(({ task }) => !task.completed && taskDate(task.dueAt) === today)),
    近日中: sortTasks(
      rows.filter(({ task }) => {
        const dueDate = taskDate(task.dueAt);
        return !task.completed && dueDate > today && dueDate <= soonIso;
      }),
    ),
    期限なし: sortTasks(rows.filter(({ task }) => !task.completed && !task.dueAt)),
    完了済み: sortTasks(rows.filter(({ task }) => task.completed)),
  };
}

function sortTasks(rows) {
  return [...rows].sort((a, b) => {
    if (state.taskSort === "priority") {
      return (
        (priorityRank[b.task.priority] || 0) - (priorityRank[a.task.priority] || 0) ||
        compareDueAt(a.task, b.task) ||
        a.task.sortOrder - b.task.sortOrder
      );
    }
    if (state.taskSort === "manual") {
      return a.note.updatedAt.localeCompare(b.note.updatedAt) || a.task.sortOrder - b.task.sortOrder;
    }
    return compareDueAt(a.task, b.task) || (priorityRank[b.task.priority] || 0) - (priorityRank[a.task.priority] || 0);
  });
}

function compareDueAt(a, b) {
  const aDue = a.dueAt || "9999-12-31T23:59";
  const bDue = b.dueAt || "9999-12-31T23:59";
  return aDue.localeCompare(bDue);
}

function taskDate(dueAt) {
  return dueAt ? dueAt.slice(0, 10) : "";
}

function countTodayTasks() {
  return getTaskGroups().今日.length;
}

function renderEditor() {
  const note = state.notes.find((item) => item.id === currentNoteId);
  if (!note) return;

  els.editorTitle.value = note.title;
  els.editorContent.value = note.content;
  els.pinBtn.textContent = note.pinned ? "ピン解除" : "ピン留め";
  els.archiveBtn.textContent = note.archived ? "アーカイブ解除" : "アーカイブ";
  els.trashBtn.textContent = note.trashed ? "ゴミ箱から戻す" : "ゴミ箱へ";

  els.taskEditorList.innerHTML = note.tasks
    .filter((task) => !task.hidden)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(
      (task) => `
        <div class="task-editor-row" data-task-row="${task.id}">
          <input type="checkbox" ${task.completed ? "checked" : ""} data-editor-task-completed="${task.id}" />
          <input type="text" value="${escapeAttr(task.text)}" placeholder="タスク" data-editor-task-text="${task.id}" />
          <input type="datetime-local" value="${escapeAttr(task.dueAt || "")}" data-editor-task-due="${task.id}" />
          <select data-editor-task-priority="${task.id}" aria-label="優先度">
            <option value="high" ${task.priority === "high" ? "selected" : ""}>高</option>
            <option value="normal" ${task.priority === "normal" ? "selected" : ""}>中</option>
            <option value="low" ${task.priority === "low" ? "selected" : ""}>低</option>
          </select>
          <div class="task-move-actions">
            <button class="mini-button" type="button" data-move-task="${task.id}:up">↑</button>
            <button class="mini-button" type="button" data-move-task="${task.id}:down">↓</button>
          </div>
          <button class="ghost-button" type="button" data-hide-task="${task.id}">外す</button>
        </div>
      `,
    )
    .join("");

  els.labelPicker.innerHTML = getVisibleLabels()
    .map(
      (label) => `
        <div class="label-control">
          <button class="label-toggle ${note.labelIds.includes(label.id) ? "active" : ""}" type="button" data-toggle-label="${label.id}">
            #${escapeHtml(label.name)}
          </button>
          <button class="mini-button" type="button" data-rename-label="${label.id}">名前</button>
          <button class="mini-button" type="button" data-hide-label="${label.id}">非表示</button>
        </div>
      `,
    )
    .join("");

  els.colorPicker.innerHTML = colors
    .map(
      (color) => `
        <button class="swatch ${note.color === color.value ? "active" : ""}" style="--swatch: ${color.value}" type="button" data-color="${color.value}" aria-label="${color.name}"></button>
      `,
    )
    .join("");
}

function render() {
  const info = getViewInfo();
  els.viewKicker.textContent = info.kicker;
  els.viewTitle.textContent = info.title;
  renderNav(els.desktopNav);
  renderNav(els.mobileNav);
  renderNotes();
  renderTasks();
  const visibleCount = state.activeView === "tasks" ? countTodayTasks() : filterNotes().length;
  els.viewMeta.textContent = `${visibleCount}件`;
}

function createNote({ title = "", content = "", tasks = [] } = {}) {
  const now = new Date().toISOString();
  const note = {
    id: uid(),
    title: title.trim(),
    content: content.trim(),
    color: "#ffffff",
    pinned: false,
    archived: false,
    trashed: false,
    labelIds: [],
    tasks,
    createdAt: now,
    updatedAt: now,
  };
  state.notes.unshift(note);
  state.activeView = "all";
  saveState();
  render();
  return note;
}

function saveQuickNote() {
  const title = els.quickTitle.value;
  const content = els.quickContent.value;
  if (!title.trim() && !content.trim()) return;
  const parsed = parseTasksFromContent(content);
  createNote({ title, content: parsed.content, tasks: parsed.tasks });
  els.quickTitle.value = "";
  els.quickContent.value = "";
}

function parseTasksFromContent(content) {
  const tasks = [];
  const lines = content.split("\n");
  const cleanLines = lines.map((line) => {
    const match = line.match(/^\s*(?:□|\[ \]|- \[ \])\s+(.+)$/);
    const doneMatch = line.match(/^\s*(?:☑|\[x\]|- \[x\])\s+(.+)$/i);
    if (match || doneMatch) {
      const text = (match || doneMatch)[1].trim();
      tasks.push({
        id: uid(),
        text,
        completed: Boolean(doneMatch),
        dueAt: "",
        priority: "normal",
        sortOrder: tasks.length,
      });
      return "";
    }
    return line;
  });
  return { content: cleanLines.filter(Boolean).join("\n").trim(), tasks };
}

function openNote(noteId) {
  currentNoteId = noteId;
  renderEditor();
  els.noteDialog.showModal();
}

function closeNote() {
  currentNoteId = null;
  els.noteDialog.close();
}

function toggleTask(noteId, taskId, completed) {
  const note = state.notes.find((item) => item.id === noteId);
  if (!note) return;
  updateNote(noteId, {
    tasks: note.tasks.map((task) => (task.id === taskId ? { ...task, completed } : task)),
  });
  if (currentNoteId === noteId && els.noteDialog.open) renderEditor();
}

function moveTask(noteId, taskId, direction) {
  const note = state.notes.find((item) => item.id === noteId);
  if (!note) return;
  const visibleTasks = note.tasks
    .filter((task) => !task.hidden)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const index = visibleTasks.findIndex((task) => task.id === taskId);
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || targetIndex < 0 || targetIndex >= visibleTasks.length) return;
  const current = visibleTasks[index];
  const target = visibleTasks[targetIndex];
  updateNote(noteId, {
    tasks: note.tasks.map((task) => {
      if (task.id === current.id) return { ...task, sortOrder: target.sortOrder };
      if (task.id === target.id) return { ...task, sortOrder: current.sortOrder };
      return task;
    }),
  });
}

function addLabel() {
  const name = prompt("ラベル名を入力してください");
  if (!name || !name.trim()) return;
  const label = { id: uid(), name: name.trim().replace(/^#/, ""), color: "#dbeafe", hidden: false };
  state.labels.push(label);
  saveState();
  render();
}

function loadSyncConfig() {
  try {
    const config = JSON.parse(localStorage.getItem(SYNC_CONFIG_KEY) || "{}");
    return {
      url: typeof config.url === "string" && config.url ? config.url : DEFAULT_SUPABASE_URL,
      anonKey:
        typeof config.anonKey === "string" && config.anonKey ? config.anonKey : DEFAULT_SUPABASE_PUBLISHABLE_KEY,
      email: typeof config.email === "string" ? config.email : "",
      lastSyncedAt: typeof config.lastSyncedAt === "string" ? config.lastSyncedAt : "",
    };
  } catch {
    return { url: DEFAULT_SUPABASE_URL, anonKey: DEFAULT_SUPABASE_PUBLISHABLE_KEY, email: "", lastSyncedAt: "" };
  }
}

function saveSyncConfig(patch) {
  const config = { ...loadSyncConfig(), ...patch };
  localStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify(config));
  updateSyncStatus();
  supabaseClient = null;
  return config;
}

function openSyncDialog() {
  const config = loadSyncConfig();
  els.syncUrl.value = config.url;
  els.syncAnonKey.value = config.anonKey;
  els.syncEmail.value = config.email;
  updateSyncStatus();
  els.syncDialog.showModal();
}

function updateSyncStatus(message = "") {
  if (!els.syncStatus || !els.syncBtn) return;
  const config = loadSyncConfig();
  const label = config.lastSyncedAt ? `最終同期 ${formatDateTime(config.lastSyncedAt.slice(0, 16))}` : "未同期";
  els.syncBtn.textContent = config.url ? "同期" : "同期設定";
  els.syncStatus.textContent = message || (config.url ? label : "Supabase設定を入力してください");
}

function readSyncForm() {
  const url = els.syncUrl.value.trim();
  const anonKey = els.syncAnonKey.value.trim();
  const email = els.syncEmail.value.trim();
  if (!url.startsWith("https://")) throw new Error("Supabase URL は https:// で始まる必要があります。");
  if (!anonKey) throw new Error("anon key を入力してください。");
  if (email && !email.includes("@")) throw new Error("メールアドレスの形式を確認してください。");
  return { url, anonKey, email };
}

async function getSupabaseClient() {
  const config = loadSyncConfig();
  if (supabaseClient) return supabaseClient;
  const { createClient } = await import(SUPABASE_MODULE_URL);
  supabaseClient = createClient(config.url, config.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return supabaseClient;
}

async function completeAuthRedirect(client) {
  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");
  if (!code) return;
  const { error } = await client.auth.exchangeCodeForSession(code);
  if (error) throw error;
  url.searchParams.delete("code");
  window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
}

async function sendMagicLink() {
  try {
    const config = saveSyncConfig(readSyncForm());
    if (!config.email) throw new Error("ログイン用メールを入力してください。");
    const client = await getSupabaseClient();
    const { error } = await client.auth.signInWithOtp({
      email: config.email,
      options: { emailRedirectTo: window.location.href },
    });
    if (error) throw error;
    updateSyncStatus("ログインリンクを送信しました。メールを確認してください。");
  } catch (error) {
    updateSyncStatus(error.message || "ログインリンク送信に失敗しました。");
  }
}

async function sendGateMagicLink() {
  try {
    const email = els.gateEmail.value.trim();
    if (!email || !email.includes("@")) throw new Error("メールアドレスを入力してください。");
    saveSyncConfig({ email });
    const client = await getSupabaseClient();
    const { error } = await client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.href },
    });
    if (error) throw error;
    els.authGateStatus.textContent = "ログインリンクを送信しました。メールを確認してください。";
  } catch (error) {
    els.authGateStatus.textContent = error.message || "ログインリンク送信に失敗しました。";
  }
}

async function refreshAuthGate() {
  if (!REQUIRE_LOGIN) return;
  try {
    const client = await getSupabaseClient();
    await completeAuthRedirect(client);
    const { data } = await client.auth.getUser();
    const signedIn = Boolean(data.user);
    els.authGate.hidden = signedIn;
    els.appShell.hidden = !signedIn;
    els.signOutBtn.hidden = !signedIn;
    if (signedIn) {
      els.authGateStatus.textContent = "ログイン済みです。";
      await pullSync({ askBeforeOverwrite: false });
    } else {
      const config = loadSyncConfig();
      els.gateEmail.value = config.email;
      els.authGateStatus.textContent = "個人用のメモはSupabaseログイン後に表示されます。";
    }
  } catch (error) {
    els.authGate.hidden = false;
    els.appShell.hidden = true;
    els.authGateStatus.textContent = error.message || "ログイン状態を確認できませんでした。";
  }
}

async function signOut() {
  try {
    const client = await getSupabaseClient();
    await client.auth.signOut();
    await refreshAuthGate();
  } catch (error) {
    updateSyncStatus(error.message || "ログアウトに失敗しました。");
  }
}

async function getSessionUser(client) {
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("先にメールリンクでログインしてください。");
  return data.user;
}

function syncPayload() {
  return {
    activeView: state.activeView,
    taskSort: state.taskSort,
    updatedAt: state.updatedAt,
    labels: state.labels,
    notes: state.notes,
  };
}

function applyRemotePayload(payload) {
  state = {
    activeView: payload.activeView || "all",
    taskSort: payload.taskSort || "due",
    updatedAt: payload.updatedAt || new Date().toISOString(),
    labels: Array.isArray(payload.labels) ? payload.labels : fallbackState.labels,
    notes: normalizeNotes(Array.isArray(payload.notes) ? payload.notes : []),
  };
  saveState({ touch: false });
  render();
}

async function fetchRemoteDocument(client, userId) {
  const { data, error } = await client
    .from(SYNC_TABLE)
    .select("payload, client_updated_at")
    .eq("user_id", userId)
    .eq("doc_id", "default")
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function pushSync() {
  try {
    const client = await getSupabaseClient();
    const user = await getSessionUser(client);
    const payload = syncPayload();
    const { error } = await client.from(SYNC_TABLE).upsert(
      {
        user_id: user.id,
        doc_id: "default",
        payload,
        client_updated_at: payload.updatedAt,
      },
      { onConflict: "user_id,doc_id" },
    );
    if (error) throw error;
    saveSyncConfig({ lastSyncedAt: new Date().toISOString() });
    updateSyncStatus("クラウドへ保存しました。");
  } catch (error) {
    updateSyncStatus(error.message || "クラウド保存に失敗しました。");
  }
}

async function pullSync({ askBeforeOverwrite = true } = {}) {
  try {
    const client = await getSupabaseClient();
    const user = await getSessionUser(client);
    const remote = await fetchRemoteDocument(client, user.id);
    if (!remote?.payload) {
      updateSyncStatus("クラウド側にデータがないため、先に保存してください。");
      return false;
    }
    if (askBeforeOverwrite) {
      const ok = confirm("クラウドのデータで、この端末の表示内容を置き換えます。続けますか？");
      if (!ok) return false;
    }
    applyRemotePayload(remote.payload);
    saveSyncConfig({ lastSyncedAt: new Date().toISOString() });
    updateSyncStatus("クラウドから取得しました。");
    return true;
  } catch (error) {
    updateSyncStatus(error.message || "クラウド取得に失敗しました。");
    return false;
  }
}

async function syncNow() {
  try {
    const client = await getSupabaseClient();
    const user = await getSessionUser(client);
    const remote = await fetchRemoteDocument(client, user.id);
    if (!remote?.payload) {
      await pushSync();
      return;
    }
    const remoteUpdated = remote.payload.updatedAt || remote.client_updated_at || "";
    if (remoteUpdated > state.updatedAt) {
      const ok = confirm("クラウド側のほうが新しいです。この端末へ取り込みますか？");
      if (ok) applyRemotePayload(remote.payload);
    } else if (remoteUpdated < state.updatedAt) {
      await pushSync();
      return;
    }
    saveSyncConfig({ lastSyncedAt: new Date().toISOString() });
    updateSyncStatus("同期しました。");
  } catch (error) {
    updateSyncStatus(error.message || "同期に失敗しました。");
  }
}

function toggleDrawer(open) {
  els.mobileDrawer.classList.toggle("open", open);
  els.mobileDrawer.setAttribute("aria-hidden", String(!open));
  els.drawerBackdrop.hidden = !open;
}

function formatDate(value) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return `${year}/${month}/${day}`;
}

function formatDateTime(value) {
  if (!value) return "";
  const [date, time = ""] = value.split("T");
  const [year, month, day] = date.split("-");
  return `${year}/${month}/${day}${time ? ` ${time.slice(0, 5)}` : ""}`;
}

function renderTaskMeta(task) {
  const parts = [`<small class="priority-chip ${task.priority || "normal"}">優先度 ${priorityLabels[task.priority] || "中"}</small>`];
  if (task.dueAt) parts.push(`<small class="due-chip">${formatDateTime(task.dueAt)}</small>`);
  return `<span class="inline-task-meta">${parts.join("")}</span>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("\n", " ");
}

document.addEventListener("click", (event) => {
  const sortButton = event.target.closest("[data-task-sort]");
  if (sortButton) {
    state.taskSort = sortButton.dataset.taskSort;
    saveState();
    render();
    return;
  }

  const viewButton = event.target.closest("[data-view]");
  if (viewButton) {
    state.activeView = viewButton.dataset.view;
    saveState();
    toggleDrawer(false);
    render();
    return;
  }

  if (event.target.closest("[data-action='add-label']")) {
    addLabel();
    return;
  }

  const openButton = event.target.closest("[data-open-note]");
  if (openButton && !event.target.closest("[data-stop-card]")) {
    openNote(openButton.dataset.openNote);
    return;
  }

  const pinButton = event.target.closest("[data-pin-note]");
  if (pinButton) {
    const note = state.notes.find((item) => item.id === pinButton.dataset.pinNote);
    updateNote(note.id, { pinned: !note.pinned });
    return;
  }

  const archiveButton = event.target.closest("[data-archive-note]");
  if (archiveButton) {
    const note = state.notes.find((item) => item.id === archiveButton.dataset.archiveNote);
    updateNote(note.id, { archived: !note.archived, trashed: false });
    return;
  }

  const trashButton = event.target.closest("[data-trash-note]");
  if (trashButton) {
    const note = state.notes.find((item) => item.id === trashButton.dataset.trashNote);
    updateNote(note.id, { trashed: !note.trashed, archived: false });
    return;
  }

  const labelButton = event.target.closest("[data-toggle-label]");
  if (labelButton && currentNoteId) {
    const note = state.notes.find((item) => item.id === currentNoteId);
    const labelId = labelButton.dataset.toggleLabel;
    const labelIds = note.labelIds.includes(labelId)
      ? note.labelIds.filter((id) => id !== labelId)
      : [...note.labelIds, labelId];
    updateNote(currentNoteId, { labelIds });
    renderEditor();
    return;
  }

  const colorButton = event.target.closest("[data-color]");
  if (colorButton && currentNoteId) {
    updateNote(currentNoteId, { color: colorButton.dataset.color });
    renderEditor();
    return;
  }

  const hideTaskButton = event.target.closest("[data-hide-task]");
  if (hideTaskButton && currentNoteId) {
    const note = state.notes.find((item) => item.id === currentNoteId);
    updateNote(currentNoteId, {
      tasks: note.tasks.map((task) =>
        task.id === hideTaskButton.dataset.hideTask ? { ...task, text: "", hidden: true } : task,
      ),
    });
    renderEditor();
    return;
  }

  const moveTaskButton = event.target.closest("[data-move-task]");
  if (moveTaskButton && currentNoteId) {
    const [taskId, direction] = moveTaskButton.dataset.moveTask.split(":");
    moveTask(currentNoteId, taskId, direction);
    renderEditor();
    return;
  }

  const renameLabelButton = event.target.closest("[data-rename-label]");
  if (renameLabelButton) {
    const label = state.labels.find((item) => item.id === renameLabelButton.dataset.renameLabel);
    if (!label) return;
    const name = prompt("新しいラベル名を入力してください", label.name);
    if (!name || !name.trim()) return;
    state.labels = state.labels.map((item) =>
      item.id === label.id ? { ...item, name: name.trim().replace(/^#/, "") } : item,
    );
    saveState();
    render();
    if (currentNoteId && els.noteDialog.open) renderEditor();
    return;
  }

  const hideLabelButton = event.target.closest("[data-hide-label]");
  if (hideLabelButton) {
    const label = state.labels.find((item) => item.id === hideLabelButton.dataset.hideLabel);
    if (!label) return;
    const ok = confirm(`ラベル「${label.name}」を非表示にします。メモのデータは消えません。`);
    if (!ok) return;
    state.labels = state.labels.map((item) => (item.id === label.id ? { ...item, hidden: true } : item));
    saveState();
    if (state.activeView === `label:${label.id}`) state.activeView = "all";
    render();
    if (currentNoteId && els.noteDialog.open) renderEditor();
  }
});

document.addEventListener("change", (event) => {
  const toggle = event.target.closest("[data-toggle-task]");
  if (toggle) {
    const [noteId, taskId] = toggle.dataset.toggleTask.split(":");
    toggleTask(noteId, taskId, toggle.checked);
    return;
  }

  if (!currentNoteId) return;
  const note = state.notes.find((item) => item.id === currentNoteId);

  const completed = event.target.closest("[data-editor-task-completed]");
  if (completed) {
    const taskId = completed.dataset.editorTaskCompleted;
    updateNote(currentNoteId, {
      tasks: note.tasks.map((task) => (task.id === taskId ? { ...task, completed: completed.checked } : task)),
    });
    renderEditor();
    return;
  }

  const due = event.target.closest("[data-editor-task-due]");
  if (due) {
    const taskId = due.dataset.editorTaskDue;
    updateNote(currentNoteId, {
      tasks: note.tasks.map((task) => (task.id === taskId ? { ...task, dueAt: due.value } : task)),
    });
    renderEditor();
    return;
  }

  const priority = event.target.closest("[data-editor-task-priority]");
  if (priority) {
    const taskId = priority.dataset.editorTaskPriority;
    updateNote(currentNoteId, {
      tasks: note.tasks.map((task) => (task.id === taskId ? { ...task, priority: priority.value } : task)),
    });
    renderEditor();
  }
});

document.addEventListener("input", (event) => {
  if (event.target === els.searchInput) {
    render();
    return;
  }

  if (!currentNoteId) return;
  const note = state.notes.find((item) => item.id === currentNoteId);

  if (event.target === els.editorTitle) {
    updateNote(currentNoteId, { title: els.editorTitle.value });
    return;
  }

  if (event.target === els.editorContent) {
    updateNote(currentNoteId, { content: els.editorContent.value });
    return;
  }

  const textInput = event.target.closest("[data-editor-task-text]");
  if (textInput) {
    const taskId = textInput.dataset.editorTaskText;
    updateNote(currentNoteId, {
      tasks: note.tasks.map((task) => (task.id === taskId ? { ...task, text: textInput.value, hidden: false } : task)),
    });
  }
});

els.quickSaveBtn.addEventListener("click", saveQuickNote);
els.quickTaskBtn.addEventListener("click", () => {
  const prefix = els.quickContent.value && !els.quickContent.value.endsWith("\n") ? "\n" : "";
  els.quickContent.value += `${prefix}□ `;
  els.quickContent.focus();
});
els.newNoteBtn.addEventListener("click", () => openNote(createNote().id));
els.gateMagicLinkBtn.addEventListener("click", sendGateMagicLink);
els.syncBtn.addEventListener("click", openSyncDialog);
els.signOutBtn.addEventListener("click", signOut);
els.syncForm.addEventListener("submit", (event) => {
  event.preventDefault();
  els.syncDialog.close();
});
els.saveSyncConfigBtn.addEventListener("click", () => {
  try {
    saveSyncConfig(readSyncForm());
    updateSyncStatus("同期設定を保存しました。");
  } catch (error) {
    updateSyncStatus(error.message || "設定保存に失敗しました。");
  }
});
els.sendMagicLinkBtn.addEventListener("click", sendMagicLink);
els.pullSyncBtn.addEventListener("click", () => pullSync());
els.pushSyncBtn.addEventListener("click", pushSync);
els.syncNowBtn.addEventListener("click", syncNow);
els.openDrawerBtn.addEventListener("click", () => toggleDrawer(true));
els.closeDrawerBtn.addEventListener("click", () => toggleDrawer(false));
els.drawerBackdrop.addEventListener("click", () => toggleDrawer(false));
els.noteForm.addEventListener("submit", (event) => {
  event.preventDefault();
  closeNote();
});
els.addTaskBtn.addEventListener("click", () => {
  if (!currentNoteId) return;
  const note = state.notes.find((item) => item.id === currentNoteId);
  updateNote(currentNoteId, {
    tasks: [
      ...note.tasks,
      {
        id: uid(),
        text: "",
        completed: false,
        dueAt: "",
        priority: "normal",
        sortOrder: note.tasks.length,
        hidden: false,
      },
    ],
  });
  renderEditor();
});
els.createLabelBtn.addEventListener("click", addLabel);
els.pinBtn.addEventListener("click", () => {
  const note = state.notes.find((item) => item.id === currentNoteId);
  updateNote(currentNoteId, { pinned: !note.pinned });
  renderEditor();
});
els.archiveBtn.addEventListener("click", () => {
  const note = state.notes.find((item) => item.id === currentNoteId);
  updateNote(currentNoteId, { archived: !note.archived, trashed: false });
  renderEditor();
});
els.trashBtn.addEventListener("click", () => {
  const note = state.notes.find((item) => item.id === currentNoteId);
  updateNote(currentNoteId, { trashed: !note.trashed, archived: false });
  renderEditor();
});

render();
updateSyncStatus();
refreshAuthGate();
