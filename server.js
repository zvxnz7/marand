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
   ✅ DATE HELPERS (NEW)
   ========================= */
function toMs(ts) {
  // Accept:
  // - number ms
  // - ISO string
  // - anything else -> null
  if (typeof ts === "number" && Number.isFinite(ts)) return ts;
  if (typeof ts === "string" && ts.trim()) {
    const t = Date.parse(ts);
    if (Number.isFinite(t)) return t;
  }
  return null;
}

function sanitizeDue(v) {
  // due is stored as "YYYY-MM-DD" or "".
  if (v === null || v === undefined) return "";
  const s = String(v).trim();
  if (!s) return "";
  // strict format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  // basic calendar validity
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
  try {
    fs.writeFileSync(CHAT_FILE, JSON.stringify(chat, null, 2), "utf-8");
  } catch {}
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

// ---- AUTO-ARCHIVE LOGIC ----
const ARCHIVE_AFTER_MS = 24 * 60 * 60 * 1000; // 24h

function normalizeNote(note) {
  // fields for new features
  if (note.archived === undefined) note.archived = false;
  if (note.doneAt === undefined) note.doneAt = null;

  if (note.trashed === undefined) note.trashed = false;
  if (note.trashedAt === undefined) note.trashedAt = null;

  if (note.z === undefined) note.z = 0;

  // ✅ NEW: dates
  if (note.createdAt === undefined || note.createdAt === null) note.createdAt = Date.now();
  else {
    const ms = toMs(note.createdAt);
    note.createdAt = ms ?? Date.now();
  }

  if (note.due === undefined || note.due === null) note.due = "";
  note.due = sanitizeDue(note.due);

  // If trashed, we don't force anything else. (Trash is separate state.)
  // If not done, clear doneAt (but do NOT touch "archived" unless you want strict rule)
  if (!note.done) {
    note.doneAt = null;
    // keep archived as-is (so manual archive stays)
  }

  // If done and missing doneAt, set it (covers old notes)
  if (note.done && !note.doneAt) note.doneAt = Date.now();

  return note;
}

function runAutoArchiveSweep() {
  const now = Date.now();
  let changed = false;

  for (let i = 0; i < notes.length; i++) {
    const n = notes[i];
    normalizeNote(n);

    // Never auto-archive trashed notes (doesn't matter anyway)
    if (n.trashed) continue;

    if (n.done && !n.archived && n.doneAt && (now - n.doneAt >= ARCHIVE_AFTER_MS)) {
      n.archived = true;
      n.updatedAt = now;
      changed = true;
      io.emit("note:upsert", n);
    }
  }

  if (changed) saveNotes(notes);
}

// Normalize on startup
notes.forEach(normalizeNote);
saveNotes(notes);

// Sweep every minute + once on startup
setInterval(runAutoArchiveSweep, 60 * 1000);
runAutoArchiveSweep();

io.on("connection", (socket) => {
  runAutoArchiveSweep();
  socket.emit("notes:init", notes);

  socket.on("note:create", (payload) => {
    const now = Date.now();

    const note = normalizeNote({
      id: nanoid(),
      klient: payload.klient ?? "",
      przedplata: !!payload.przedplata,
      pozycje: Array.isArray(payload.pozycje) ? payload.pozycje : [{ dzianina:"", kolor:"", ilosc:"" }],
      kurier: payload.kurier ?? "",
      waga: payload.waga ?? "",
      info: payload.info ?? "",

      // ✅ NEW
      due: sanitizeDue(payload.due),

      done: !!payload.done,

      archived: false,
      doneAt: payload.done ? now : null,

      trashed: false,
      trashedAt: null,

      z: Number.isFinite(payload.z) ? payload.z : 0,

      x: Number.isFinite(payload.x) ? payload.x : 80,
      y: Number.isFinite(payload.y) ? payload.y : 80,

      // createdAt can come from client (ISO) or be set now
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

    // Copy only keys that are present
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

    if (payload.pozycje !== undefined) {
      next.pozycje = Array.isArray(payload.pozycje) ? payload.pozycje : [];
    }

    // ✅ NEW: due updates
    if (payload.due !== undefined) {
      next.due = sanitizeDue(payload.due);
    }

    // DONE rules: manage doneAt
    if (payload.done !== undefined) {
      const newDone = !!payload.done;
      const wasDone = !!prev.done;

      if (newDone && !wasDone) {
        next.doneAt = Date.now();
      }
      if (!newDone) {
        next.doneAt = null;
      }
    }

    // TRASH rules
    if (payload.trashed !== undefined) {
      if (next.trashed) {
        next.trashedAt = Date.now();
      } else {
        next.trashedAt = null;
      }
    }

    normalizeNote(next);
    next.updatedAt = Date.now();

    notes[idx] = next;
    saveNotes(notes);
    io.emit("note:upsert", next);

    runAutoArchiveSweep();
  });

  // Permanent delete (used only from Trash UI)
  socket.on("note:delete", ({ id }) => {
    const before = notes.length;
    notes = notes.filter((n) => n.id !== id);
    if (notes.length === before) return;

    saveNotes(notes);
    io.emit("note:delete", { id });
  });

  // Empty trash: permanently deletes all trashed notes
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

  // ---- CHAT ----
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
