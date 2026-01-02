#### ZVNOTES


## 🚀 Quick Start (Fresh Computer)

This guide assumes the computer has **nothing installed yet**.

---

## 1️⃣ Install Node.js (required)

1. Open this website:
   👉 [https://nodejs.org](https://nodejs.org)
2. Download **LTS** version (green button).
3. Install using **default options** (click *Next* → *Next* → *Install*).
4. Restart the computer after installation.

✅ Done once per computer.

---

## 2️⃣ Download the project

### Option A (recommended – easiest)

1. Open this page:
   👉 [https://github.com/zvxnz7/marand](https://github.com/zvxnz7/marand)
2. Click **Code** → **Download ZIP**
3. Unzip the file anywhere (e.g. `Desktop`).

### Option B (for developers)

```bash
git clone https://github.com/zvxnz7/marand.git
```

---

## 3️⃣ Start the server (Windows)

1. Open the project folder.
2. Go into the **`server`** folder.
3. Hold **Shift** → Right-click → **“Open PowerShell window here”**
4. Run:

```powershell
npm install
npm start
```

⏳ First run may take 1–2 minutes.

When you see something like:

```
LAN Sticky running on http://0.0.0.0:2115
```

the server is ready.

---

## 4️⃣ Open the board in browser

### On the same computer

Open a browser and go to:

```
http://localhost:2115
```

### On other devices in the same network (LAN)

1. On the server computer, run:

   ```powershell
   ipconfig
   ```
2. Find **IPv4 Address** (example: `192.168.0.50`)
3. On other computers/phones open:

   ```
   http://192.168.0.50:2115
   ```

📱 Works on phones, tablets, PCs.

---

## 5️⃣ Firewall permission (Windows – first time only)

When Windows asks:

> “Allow Node.js to communicate on private networks?”

✔ Click **Allow access**

(Private networks only — do NOT enable Public.)

---

## 🗂 Data storage

* Notes are saved automatically.
* Data files:

  ```
  server/data/notes.json
  server/chat.json
  ```
* Closing the terminal **stops the server**.
* Data remains saved.

---

## ▶ Starting again later

Every next time:

1. Open `server` folder
2. Open PowerShell
3. Run:

   ```powershell
   npm start
   ```

(No need to run `npm install` again.)

---

## ❓ Troubleshooting

### “npm is not recognized”

➡ Node.js is not installed or PC wasn’t restarted.

### Page doesn’t load on other computers

➡ Check:

* same Wi-Fi / LAN
* Windows Firewall allowed Node.js
* correct IP address

---

## 🧠 Notes

* No internet required after setup
* No accounts or login
* Designed for local office network (LAN)

---
