<div align="center">

# compta-perso-desktop

[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=000&labelColor=333&style=flat)](https://developer.mozilla.org/docs/Web/JavaScript)
[![Release](https://img.shields.io/github/v/release/goddivor/compta-perso-desktop?logo=github&logoColor=fff&label=Release&labelColor=333&color=2BB24C&style=flat)](https://github.com/goddivor/compta-perso-desktop/releases/latest)
[![License](https://img.shields.io/badge/License-MIT-2BB24C?logo=github&logoColor=fff&labelColor=333&style=flat)](./LICENSE)
[![Downloads](https://img.shields.io/github/downloads/goddivor/compta-perso-desktop/total?logo=github&logoColor=fff&label=Downloads&labelColor=333&color=1F6FEB&style=flat)](https://github.com/goddivor/compta-perso-desktop/releases)

[![Electron](https://img.shields.io/npm/v/electron?logo=electron&logoColor=fff&label=Electron&labelColor=333&color=47848F&style=flat)](https://www.npmjs.com/package/electron)
[![React](https://img.shields.io/npm/v/react?logo=react&logoColor=fff&label=React&labelColor=333&color=61DAFB&style=flat)](https://www.npmjs.com/package/react)
[![better-sqlite3](https://img.shields.io/npm/v/better-sqlite3?logo=sqlite&logoColor=fff&label=better-sqlite3&labelColor=333&color=003B57&style=flat)](https://www.npmjs.com/package/better-sqlite3)
[![React Flow](https://img.shields.io/npm/v/@xyflow/react?logo=npm&logoColor=fff&label=React%20Flow&labelColor=333&color=FF0072&style=flat)](https://www.npmjs.com/package/@xyflow/react)
[![Tailwind CSS](https://img.shields.io/npm/v/tailwindcss?logo=tailwindcss&logoColor=fff&label=Tailwind%20CSS&labelColor=333&color=06B6D4&style=flat)](https://www.npmjs.com/package/tailwindcss)
[![electron-updater](https://img.shields.io/npm/v/electron-updater?logo=npm&logoColor=fff&label=electron-updater&labelColor=333&color=CB3837&style=flat)](https://www.npmjs.com/package/electron-updater)

[![Stars](https://img.shields.io/github/stars/goddivor/compta-perso-desktop?logo=github&logoColor=fff&label=Stars&labelColor=333&color=E3B341&style=flat)](https://github.com/goddivor/compta-perso-desktop/stargazers)
[![Forks](https://img.shields.io/github/forks/goddivor/compta-perso-desktop?logo=github&logoColor=fff&label=Forks&labelColor=333&color=8957E5&style=flat)](https://github.com/goddivor/compta-perso-desktop/network/members)
[![Watchers](https://img.shields.io/github/watchers/goddivor/compta-perso-desktop?logo=github&logoColor=fff&label=Watchers&labelColor=333&color=1F6FEB&style=flat)](https://github.com/goddivor/compta-perso-desktop/watchers)
[![Contributors](https://img.shields.io/github/contributors/goddivor/compta-perso-desktop?logo=github&logoColor=fff&label=Contributors&labelColor=333&color=DB61A2&style=flat)](https://github.com/goddivor/compta-perso-desktop/graphs/contributors)
[![Open issues](https://img.shields.io/github/issues/goddivor/compta-perso-desktop?logo=github&logoColor=fff&label=Issues&labelColor=333&color=3FB950&style=flat)](https://github.com/goddivor/compta-perso-desktop/issues)

Track **personal accounts** on your own machine, without an account and without a
server. Balances, transactions, transfers between accounts, fees, forecasts and reports live in a
single **local SQLite** file.

The desktop half of Compta Perso: it shares its schema and its cloud sync with the
[mobile app](https://github.com/goddivor/compta-perso-mobile), through the
[sync API](https://github.com/goddivor/compta-perso-server).

<img src="screenshots/graph-view.png" alt="Graph view: one chronological column per account" width="900">

</div>

## 🎖️ Features

- **Accounts side by side** — every account with its live balance in the top bar, reorderable by long press
- **Transactions table** — filter by account, type, category or period, edit and delete in place
- **Transfers between accounts** — one action writes both entries, keeps them paired, and splits the fees
- **Fee rules per account** — set a rate once, then apply it to any transaction with a single checkbox
- **Interactive graph** — one chronological column per account, transfers drawn across columns, pinch, scroll and zoom powered by React Flow
- **Daily report** — money in, money out and net balance for every day of the period
- **Forecast sessions** — simulate transactions, see the projected balance, validate to make them real
- **Cloud sync** — pull the configuration in one click, then push or pull a full snapshot
- **Automatic updates** — new releases are detected at launch, downloaded and installed from the app
- **Bilingual interface** — French and English, following the system language by default

## 📋 Requirements

- Linux x64 for the published builds (AppImage and `.deb`)
- Node.js >= 20 to build from source
- Nothing else: no account, no network, no external database

## 📦 Installation

Download the latest build from the [releases page](https://github.com/goddivor/compta-perso-desktop/releases/latest).

```bash
# AppImage: make it executable and run it
chmod +x "Compta-Perso-*.AppImage"
./Compta-Perso-*.AppImage

# Debian and Ubuntu
sudo dpkg -i compta-perso_*_amd64.deb
```

From a clone:

```bash
npm install
npm run dev
```

## ⚙️ Usage

```bash
# Development window with hot reload
npm run dev

# Compile main, preload and renderer
npm run build

# Build the AppImage and the .deb into dist/
npm run dist
```

### 📊 Graph controls

| Gesture | Action |
|---|---|
| Scroll | Move through the timeline |
| Ctrl + scroll, pinch | Zoom in and out |
| Drag, touch | Pan the canvas |
| Double click | Zoom to that point |
| Hover a node | Full details: label, amount, running balance |

### ☁️ Cloud sync

Sync is optional; the app is fully usable offline. Open the cloud icon in the top bar, press
**Fetch configuration** once, then use **Send to cloud** and **Fetch from cloud** to move a full
snapshot between machines. The API URL and token are never shown or typed by hand.

### 🗄️ Where the data lives

The database is a single SQLite file, kept out of the repository:

```bash
~/.config/compta-perso/data/compta.db
```

Copy that file to back it up, restore it, or move it to another machine.

## 🤝 Contributing

Contributions of all kinds are welcome: bug reports, feature ideas and pull requests. Open an
[issue](https://github.com/goddivor/compta-perso-desktop/issues) first for anything substantial,
and make sure `npm run build` passes before every commit.

## 📜 License

Licensed under MIT License and copyrights reserved.
