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

const CHAT_FILE = path.join(__dirname, "chat.json");
let chat = [];

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
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
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

function normalizeDoneArchiveState(note) {
  // Ensure fields exist
  if (note.archived === undefined) note.archived = false;
  if (note.doneAt === undefined) note.doneAt = null;

  // If note is done but doneAt missing, set it (covers old notes)
  if (note.done && !note.doneAt) note.doneAt = Date.now();

  // If not done, clear doneAt (but DO NOT force unarchive)
  if (!note.done) {
    note.doneAt = null;
  }

  return note;
}


function runAutoArchiveSweep() {
  const now = Date.now();
  let changed = false;

  for (let i = 0; i < notes.length; i++) {
    const n = notes[i];
    normalizeDoneArchiveState(n);

    if (n.done && !n.archived && n.doneAt && (now - n.doneAt >= ARCHIVE_AFTER_MS)) {
      n.archived = true;
      n.updatedAt = now;
      changed = true;
      io.emit("note:upsert", n);
    }
  }

  if (changed) saveNotes(notes);
}

// Sweep every minute
setInterval(runAutoArchiveSweep, 60 * 1000);
// Also run once on startup
runAutoArchiveSweep();

io.on("connection", (socket) => {
  // Before sending init, normalize + sweep (so client immediately gets correct archived flags)
  runAutoArchiveSweep();
  socket.emit("notes:init", notes);

  socket.on("note:create", (payload) => {
    const note = normalizeDoneArchiveState({
      id: nanoid(),
      klient: payload.klient ?? "",
      przedplata: !!payload.przedplata,
      pozycje: Array.isArray(payload.pozycje) ? payload.pozycje : [{ dzianina:"", kolor:"", ilosc:"" }],
      kurier: payload.kurier ?? "",
      waga: payload.waga ?? "",
      info: payload.info ?? "",
      done: !!payload.done,
      archived: false,
      doneAt: payload.done ? Date.now() : null,
      x: Number.isFinite(payload.x) ? payload.x : 80,
      y: Number.isFinite(payload.y) ? payload.y : 80,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    notes.push(note);
    saveNotes(notes);
    io.emit("note:upsert", note);
  });

  socket.on("note:update", (payload) => {
    const idx = notes.findIndex((n) => n.id === payload.id);
    if (idx === -1) return;

    const prev = notes[idx];
    const next = { ...prev };

    // Copy only keys that are present
    for (const [k, v] of Object.entries(payload)) {
      if (v !== undefined) next[k] = v;
    }

    // normalize types
    if (payload.przedplata !== undefined) next.przedplata = !!payload.przedplata;
    if (payload.archived !== undefined) next.archived = !!payload.archived;


    if (payload.x !== undefined) next.x = Number(payload.x);
    if (payload.y !== undefined) next.y = Number(payload.y);

    if (payload.pozycje !== undefined) {
      next.pozycje = Array.isArray(payload.pozycje) ? payload.pozycje : [];
    }

    // --- DONE / ARCHIVE rules ---
    if (payload.done !== undefined) {
      const newDone = !!payload.done;
      const wasDone = !!prev.done;

      next.done = newDone;

      if (newDone && !wasDone) {
        // just marked done -> start timer now
        next.doneAt = Date.now();
        next.archived = false;
      }

      if (!newDone) {
        // un-done -> unarchive and clear doneAt
        next.doneAt = null;
        next.archived = false;
      }
    }

    // If some old note is done but missing doneAt (e.g. edited other fields)
    normalizeDoneArchiveState(next);

    next.updatedAt = Date.now();

    notes[idx] = next;
    saveNotes(notes);
    io.emit("note:upsert", next);

    // In case this update makes it eligible (rare, but safe)
    runAutoArchiveSweep();
  });

  socket.on("note:delete", ({ id }) => {
    const before = notes.length;
    notes = notes.filter((n) => n.id !== id);
    if (notes.length === before) return;

    saveNotes(notes);
    io.emit("note:delete", { id });
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
