# ZVNOTES

Local LAN notes / board app running on a Node.js server.

---

## 🚀 Quick Start (Fresh Computer)

This guide assumes the computer has **nothing installed yet**.

---

## 1️⃣ Install required software (once per computer)

### 1. Node.js

1. Open:
   👉 [https://nodejs.org](https://nodejs.org)
2. Download **LTS** version (green button).
3. Install using **default options**.
4. Restart the computer.

---

### 2. Git

1. Open:
   👉 [https://git-scm.com](https://git-scm.com)
2. Download Git for Windows.
3. Install using **default options**.
4. Restart the computer.

✅ Node.js and Git are required.

---

## 2️⃣ Download the project (Git required)

ZIP downloads are **not supported**.

1. Open CMD.
2. Choose a location (e.g. Desktop).
3. Run:

```powershell
git clone https://github.com/zvxnz7/marand.git
```

---

## 3️⃣ Start the server (Windows)

### First run

1. Open the **`server`** folder.
2. Double‑click:

```
run-windows.bat
```

⏳ First run may take **1–2 minutes** (dependencies install automatically).

When you see something like:

```
LAN Sticky running on http://0.0.0.0:2115
```

✅ Server is running.

---

## 4️⃣ Open the board in browser

### Same computer

```
http://localhost:2115
```

---

### Other devices in the same network (LAN)

1. On the server computer, open PowerShell and run:

```powershell
ipconfig
```

2. Find **IPv4 Address** (example: `192.168.0.50`).
3. On other devices open:

```
http://192.168.0.50:2115
```

📱 Works on phones, tablets, and PCs.

---

## 5️⃣ Windows Firewall (first launch only)

When Windows asks:

> “Allow Node.js to communicate on private networks?”

✔ Click **Allow access**

❗ Enable **Private networks only**.

---

## 🗂 Data storage

* Notes are saved automatically
* Files are stored in:

```
server/data/notes.json
server/chat.json
```

* Closing the console **stops the server**
* Data remains saved

---

## ▶ Starting again later

Every next time:

1. Open the **`server`** folder
2. Double‑click:

```
run-windows.bat
```

(No setup needed again.)

---

## ❓ Troubleshooting

### `git` or `npm` not recognized

➡ Git or Node.js is not installed or the PC was not restarted.

---

### Page does not load on other devices

Check:

* devices are on the same Wi‑Fi / LAN
* Windows Firewall allowed Node.js
* correct IP address is used

---

## 🧠 Notes

* Internet required **only** for updates
* No accounts or login
* Designed for local LAN use

---

## 👤 Author

GitHub: [https://github.com/zvxnz7](https://github.com/zvxnz7)
