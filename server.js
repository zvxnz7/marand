const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const fs = require("fs");
const { nanoid } = require("nanoid");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 2115;

const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "notes.json");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const CHAT_FILE = path.join(DATA_DIR, "chat.json");
let chat = [];

/* =========================
   DATE HELPERS
   ========================= */
function toMs(ts) {
  if (typeof ts === "number" && Number.isFinite(ts)) return ts;
  if (typeof ts === "string" && ts.trim()) {
    const t = Date.parse(ts);
    if (Number.isFinite(t)) return t;
  }
  return null;
}

function sanitizeDue(v) {
  if (v === null || v === undefined) return "";
  const s = String(v).trim();
  if (!s) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  const t = Date.parse(s + "T00:00:00Z");
  if (!Number.isFinite(t)) return "";
  return s;
}

function loadChat() {
  try {
    chat = JSON.parse(fs.readFileSync(CHAT_FILE, "utf-8"));
    if (!Array.isArray(chat)) chat = [];
  } catch {
    chat = [];
  }
}
function saveChat() {
  try { fs.writeFileSync(CHAT_FILE, JSON.stringify(chat, null, 2), "utf-8"); } catch {}
}
loadChat();

function loadNotes() {
  try {
    if (!fs.existsSync(DATA_FILE)) return [];
    const arr = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    console.error("Failed to load notes:", e);
    return [];
  }
}

function saveNotes(notesArr) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(notesArr, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to save notes:", e);
  }
}

let notes = loadNotes();

app.use(express.static(path.join(__dirname, "public"), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith(".webmanifest")) {
      res.setHeader("Content-Type", "application/manifest+json");
    }
  }
}));

app.get("/health", (_, res) => {
  res.json({ ok: true, notes: notes.length, chat: chat.length });
});

/* =========================
   AUTO RULES
   ========================= */
const ARCHIVE_AFTER_MS = 24 * 60 * 60 * 1000;     // 24h after doneAt
const TRASH_ARCHIVED_AFTER_MS = 14 * 24 * 60 * 60 * 1000; // 14 days archived

function normalizeItems(pozycje) {
  const arr = Array.isArray(pozycje) ? pozycje : [];
  return (arr.length ? arr : [{ dzianina:"", kolor:"", ilosc:"", wydano:"", covered:false }]).map(it => ({
    dzianina: it?.dzianina ?? "",
    kolor: it?.kolor ?? "",
    ilosc: it?.ilosc ?? "",
    // ✅ backwards-compat: old key "iloscPosiadana"
    wydano: (it?.wydano ?? it?.iloscPosiadana ?? ""),
    covered: !!it?.covered,
  }));
}

function normalizeNote(note) {
  if (note.archived === undefined) note.archived = false;
  if (note.archivedAt === undefined) note.archivedAt = null;

  if (note.doneAt === undefined) note.doneAt = null;

  if (note.trashed === undefined) note.trashed = false;
  if (note.trashedAt === undefined) note.trashedAt = null;

  if (note.z === undefined) note.z = 0;

  // createdAt
  if (note.createdAt === undefined || note.createdAt === null) note.createdAt = Date.now();
  else note.createdAt = toMs(note.createdAt) ?? Date.now();

  // due
  if (note.due === undefined || note.due === null) note.due = "";
  note.due = sanitizeDue(note.due);

  // items
  note.pozycje = normalizeItems(note.pozycje);

  // faktura (new) + backwards compat "blue"
  if (note.faktura === undefined) note.faktura = !!note.blue;

  // doneAt rules
  if (!note.done) note.doneAt = null;
  if (note.done && !note.doneAt) note.doneAt = Date.now();

  // archivedAt rules
  if (!note.archived) note.archivedAt = null;
  if (note.archived && !note.archivedAt) note.archivedAt = Date.now();

  return note;
}

function runSweeps() {
  const now = Date.now();
  let changed = false;

  for (const n of notes) {
    normalizeNote(n);

    // never touch permanently deleted obviously; trash is separate
    // 1) auto-archive done after 24h
    if (!n.trashed && n.done && !n.archived && n.doneAt && (now - n.doneAt >= ARCHIVE_AFTER_MS)) {
      n.archived = true;
      n.archivedAt = now;
      n.updatedAt = now;
      changed = true;
      io.emit("note:upsert", n);
    }

    // 2) archived -> trash after 14 days
    if (!n.trashed && n.archived && n.archivedAt && (now - n.archivedAt >= TRASH_ARCHIVED_AFTER_MS)) {
      n.trashed = true;
      n.trashedAt = now;
      n.updatedAt = now;
      changed = true;
      io.emit("note:upsert", n);
    }
  }

  if (changed) saveNotes(notes);
}

// normalize on boot
notes.forEach(normalizeNote);
saveNotes(notes);

// sweep every minute + on startup
setInterval(runSweeps, 60 * 1000);
runSweeps();

io.on("connection", (socket) => {
  runSweeps();
  socket.emit("notes:init", notes);

  socket.on("note:create", (payload) => {
    const now = Date.now();

    const note = normalizeNote({
      id: nanoid(),
      klient: payload.klient ?? "",
      przedplata: !!payload.przedplata,
      pozycje: normalizeItems(payload.pozycje),
      kurier: payload.kurier ?? "",
      waga: payload.waga ?? "",
      info: payload.info ?? "",

      due: sanitizeDue(payload.due),

      done: !!payload.done,
      doneAt: payload.done ? now : null,

      archived: false,
      archivedAt: null,

      trashed: false,
      trashedAt: null,

      faktura: !!payload.faktura,

      z: Number.isFinite(payload.z) ? payload.z : 0,
      x: Number.isFinite(payload.x) ? payload.x : 80,
      y: Number.isFinite(payload.y) ? payload.y : 80,

      createdAt: toMs(payload.createdAt) ?? now,
      updatedAt: now,
    });

    notes.push(note);
    saveNotes(notes);
    io.emit("note:upsert", note);
  });

  socket.on("note:update", (payload) => {
    const idx = notes.findIndex((n) => n.id === payload.id);
    if (idx === -1) return;

    const prev = normalizeNote(notes[idx]);
    const next = { ...prev };

    for (const [k, v] of Object.entries(payload)) {
      if (v !== undefined) next[k] = v;
    }

    // normalize types
    if (payload.przedplata !== undefined) next.przedplata = !!payload.przedplata;
    if (payload.done !== undefined) next.done = !!payload.done;
    if (payload.archived !== undefined) next.archived = !!payload.archived;
    if (payload.trashed !== undefined) next.trashed = !!payload.trashed;

    if (payload.x !== undefined) next.x = Number(payload.x);
    if (payload.y !== undefined) next.y = Number(payload.y);
    if (payload.z !== undefined) next.z = Number(payload.z);

    if (payload.pozycje !== undefined) next.pozycje = normalizeItems(payload.pozycje);

    if (payload.due !== undefined) next.due = sanitizeDue(payload.due);

    if (payload.faktura !== undefined) next.faktura = !!payload.faktura;
    // backwards compat if some client still sends blue
    if (payload.blue !== undefined) next.faktura = !!payload.blue;

    // DONE rules
    if (payload.done !== undefined) {
      const newDone = !!payload.done;
      const wasDone = !!prev.done;
      if (newDone && !wasDone) next.doneAt = Date.now();
      if (!newDone) next.doneAt = null;
    }

    // ARCHIVE rules
    if (payload.archived !== undefined) {
      const wasArchived = !!prev.archived;
      const nowArchived = !!next.archived;

      if (!wasArchived && nowArchived) next.archivedAt = Date.now();
      if (wasArchived && !nowArchived) next.archivedAt = null;
    }

    // TRASH rules
    if (payload.trashed !== undefined) {
      if (next.trashed) next.trashedAt = Date.now();
      else next.trashedAt = null;
    }

    normalizeNote(next);
    next.updatedAt = Date.now();

    notes[idx] = next;
    saveNotes(notes);
    io.emit("note:upsert", next);

    runSweeps();
  });

  socket.on("note:delete", ({ id }) => {
    const before = notes.length;
    notes = notes.filter((n) => n.id !== id);
    if (notes.length === before) return;

    saveNotes(notes);
    io.emit("note:delete", { id });
  });

  socket.on("trash:empty", () => {
    const before = notes.length;
    const removed = notes.filter(n => n.trashed).map(n => n.id);
    notes = notes.filter(n => !n.trashed);

    if (notes.length !== before) {
      saveNotes(notes);
      removed.forEach(id => io.emit("note:delete", { id }));
    }
  });

  socket.on("board:clear", () => {
    notes = [];
    saveNotes(notes);
    io.emit("notes:init", notes);
  });

  // chat
  socket.on("chat:join", () => {
    socket.emit("chat:init", chat);
  });

  socket.on("chat:send", (m) => {
    const msg = {
      name: (m && m.name ? String(m.name).slice(0, 40) : "").trim(),
      text: (m && m.text ? String(m.text).slice(0, 1000) : "").trim(),
      ts: Date.now(),
    };
    if (!msg.text) return;

    chat.push(msg);
    if (chat.length > 500) chat = chat.slice(-500);

    saveChat();
    io.emit("chat:new", msg);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`LAN Sticky running on http://0.0.0.0:${PORT}`);
  console.log(`Notes file: ${DATA_FILE}`);
  console.log(`Chat file: ${CHAT_FILE}`);
});
