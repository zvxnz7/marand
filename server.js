const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const fs = require("fs");
const { nanoid } = require("nanoid");
const { execFile } = require("child_process");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 2115;

/* =========================
   UPDATE / RESTART (NO TOKEN)
   ========================= */
function runBat(batPath) {
  return new Promise((resolve, reject) => {
    execFile(
      "cmd.exe",
      ["/c", batPath],
      { cwd: path.dirname(batPath) },
      (err, stdout, stderr) => {
        if (err) {
          const msg = (stderr || stdout || err.message || "Unknown error")
            .toString()
            .trim();
          return reject(new Error(msg));
        }
        resolve((stdout || "").toString().trim());
      }
    );
  });
}

// ⚠️ OPEN ENDPOINT (NO AUTH)
app.post("/admin/update", async (req, res) => {
  try {
    const bat = path.join(__dirname, "update_only.bat");
    if (!fs.existsSync(bat)) {
      return res.status(500).json({ ok: false, error: "update_only.bat not found" });
    }

    const output = await runBat(bat);
    res.json({ ok: true, output });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

/* =========================
   DATA
   ========================= */
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
const ARCHIVE_AFTER_MS = 24 * 60 * 60 * 1000;
const TRASH_ARCHIVED_AFTER_MS = 14 * 24 * 60 * 60 * 1000;

function normalizeItems(pozycje) {
  const arr = Array.isArray(pozycje) ? pozycje : [];
  return (arr.length ? arr : [{ dzianina:"", kolor:"", ilosc:"", wydano:"", covered:false }]).map(it => ({
    dzianina: it?.dzianina ?? "",
    kolor: it?.kolor ?? "",
    ilosc: it?.ilosc ?? "",
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

  if (note.createdAt === undefined || note.createdAt === null)
    note.createdAt = Date.now();
  else note.createdAt = toMs(note.createdAt) ?? Date.now();

  note.due = sanitizeDue(note.due);
  note.pozycje = normalizeItems(note.pozycje);
  if (note.faktura === undefined) note.faktura = !!note.blue;

  if (!note.done) note.doneAt = null;
  if (note.done && !note.doneAt) note.doneAt = Date.now();

  if (!note.archived) note.archivedAt = null;
  if (note.archived && !note.archivedAt) note.archivedAt = Date.now();

  return note;
}

function runSweeps() {
  const now = Date.now();
  let changed = false;

  for (const n of notes) {
    normalizeNote(n);

    if (!n.trashed && n.done && !n.archived && n.doneAt && now - n.doneAt >= ARCHIVE_AFTER_MS) {
      n.archived = true;
      n.archivedAt = now;
      changed = true;
      io.emit("note:upsert", n);
    }

    if (!n.trashed && n.archived && n.archivedAt && now - n.archivedAt >= TRASH_ARCHIVED_AFTER_MS) {
      n.trashed = true;
      n.trashedAt = now;
      changed = true;
      io.emit("note:upsert", n);
    }
  }

  if (changed) saveNotes(notes);
}

notes.forEach(normalizeNote);
saveNotes(notes);
setInterval(runSweeps, 60 * 1000);
runSweeps();

/* =========================
   SOCKET.IO
   ========================= */
io.on("connection", (socket) => {
  runSweeps();
  socket.emit("notes:init", notes);

  socket.on("note:create", (payload) => {
    const now = Date.now();
    const note = normalizeNote({
      id: nanoid(),
      ...payload,
      doneAt: payload.done ? now : null,
      archived: false,
      trashed: false,
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
    const next = { ...prev, ...payload };

    normalizeNote(next);
    next.updatedAt = Date.now();

    notes[idx] = next;
    saveNotes(notes);
    io.emit("note:upsert", next);

    runSweeps();
  });

  socket.on("note:delete", ({ id }) => {
    notes = notes.filter((n) => n.id !== id);
    saveNotes(notes);
    io.emit("note:delete", { id });
  });

  socket.on("trash:empty", () => {
    const removed = notes.filter(n => n.trashed).map(n => n.id);
    notes = notes.filter(n => !n.trashed);
    saveNotes(notes);
    removed.forEach(id => io.emit("note:delete", { id }));
  });

  socket.on("chat:join", () => socket.emit("chat:init", chat));
  socket.on("chat:send", (m) => {
    if (!m?.text) return;
    chat.push({ text: String(m.text).slice(0, 1000), ts: Date.now() });
    if (chat.length > 500) chat = chat.slice(-500);
    saveChat();
    io.emit("chat:new", chat.at(-1));
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`LAN Sticky running on http://0.0.0.0:${PORT}`);
});
