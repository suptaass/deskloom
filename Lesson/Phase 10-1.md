# Phase 10-1 — Tauri Bundle / Installer Configuration

> **Tech Stack:** Tauri v2 + React + TypeScript
> **Working directory:** `e:\Project\deskloom`

---

## เป้าหมาย

- แปลง DeskLoom จาก dev app → Windows installer ที่ผู้ใช้ดาวน์โหลดแล้วติดตั้งได้เลย
- เข้าใจ bundle config ใน `tauri.conf.json`
- ได้ไฟล์ `.msi` และ `.exe` พร้อม distribute

---

## ทำไม

`pnpm tauri build` อ่าน `tauri.conf.json` → compile Rust → bundle React → สร้าง installer
บน Windows Tauri สร้างได้ 2 format:
- **NSIS** (`.exe`) — installer เล็ก ดาวน์โหลด WebView2 ณ เวลา install
- **MSI** (`.msi`) — Windows Installer format มักใช้ใน enterprise

**WebView2 คืออะไร?**
Tauri render UI ด้วย WebView2 (Chromium engine ของ Microsoft)
Windows 11 และ Windows 10 รุ่นใหม่มีให้อยู่แล้ว
ถ้าเครื่องเก่าไม่มี → `downloadBootstrapper` จัดการให้อัตโนมัติ

---

## สิ่งที่ทำ

ไฟล์: `src-tauri/tauri.conf.json` — เพิ่ม metadata + webview install mode ใน `bundle` section

```json
"bundle": {
  "active": true,
  "targets": "all",
  "icon": [
    "icons/32x32.png",
    "icons/128x128.png",
    "icons/128x128@2x.png",
    "icons/icon.icns",
    "icons/icon.ico"
  ],
  "category": "Utility",
  "shortDescription": "Desktop widget system for Windows",
  "longDescription": "DeskLoom is a desktop widget app for Windows. Place clocks, notes, habits, weather, and more anywhere on your desktop.",
  "windows": {
    "webviewInstallMode": {
      "type": "downloadBootstrapper"
    }
  }
}
```

---

## อธิบาย field สำคัญ

- **`"active": true`** — สั่งให้ Tauri สร้าง installer ทุกครั้งที่ build
- **`"targets": "all"`** — build ทุก format ที่ platform รองรับ (Windows = NSIS + MSI)
- **`"category": "Utility"`** — บอก Windows ว่าแอปนี้อยู่หมวดไหน ใช้ใน Add/Remove Programs
- **`"shortDescription"`** — แสดงใน installer และ Windows Apps list
- **`"webviewInstallMode": "downloadBootstrapper"`** — ถ้าเครื่องไม่มี WebView2 installer จะดาวน์โหลดให้อัตโนมัติ

---

## ผลลัพธ์

```
src-tauri/target/release/bundle/
├── msi/   DeskLoom_0.5.0_x64_en-US.msi
└── nsis/  DeskLoom_0.5.0_x64-setup.exe
```

---

## Verification

```bash
pnpm tauri build
```

ต้องได้ผลลัพธ์:
```
Finished 2 bundles at:
  .../bundle/msi/DeskLoom_0.5.0_x64_en-US.msi
  .../bundle/nsis/DeskLoom_0.5.0_x64-setup.exe
```

ดับเบิลคลิก `.exe` → ติดตั้งได้ → แอปปรากฏใน Start Menu และ Add/Remove Programs
