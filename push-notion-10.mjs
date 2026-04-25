// push-notion-10.mjs — push Phase 10-1 and 10-2 lessons to Notion Phase 10 page

const PAGE_ID = "34d9dbe9a74980cf8650f957f61f29b2";
const TOKEN   = "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";

const headers = {
  "Authorization": `Bearer ${TOKEN}`,
  "Content-Type": "application/json",
  "Notion-Version": "2022-06-28",
};

async function createChildPage(parentId, title) {
  const res = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers,
    body: JSON.stringify({
      parent: { page_id: parentId },
      properties: { title: { title: [{ type: "text", text: { content: title } }] } },
    }),
  });
  if (!res.ok) throw new Error(`Create page error ${res.status}: ${await res.text()}`);
  return (await res.json()).id;
}

async function appendBlocks(pageId, blocks) {
  const res = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ children: blocks }),
  });
  if (!res.ok) throw new Error(`Append error ${res.status}: ${await res.text()}`);
}

const h2    = (t) => ({ object:"block", type:"heading_2",          heading_2:          { rich_text:[{type:"text",text:{content:t}}] } });
const h3    = (t) => ({ object:"block", type:"heading_3",          heading_3:          { rich_text:[{type:"text",text:{content:t}}] } });
const p     = (t) => ({ object:"block", type:"paragraph",          paragraph:          { rich_text:[{type:"text",text:{content:t}}] } });
const code  = (t, lang="typescript") => ({ object:"block", type:"code", code: { rich_text:[{type:"text",text:{content:t}}], language:lang } });
const bull  = (t) => ({ object:"block", type:"bulleted_list_item", bulleted_list_item: { rich_text:[{type:"text",text:{content:t}}] } });
const div   = ()  => ({ object:"block", type:"divider",            divider:{} });

async function pushLesson101() {
  console.log("Creating Phase 10-1 page...");
  const id = await createChildPage(PAGE_ID, "Phase 10-1 — Tauri Bundle / Installer Configuration");

  await appendBlocks(id, [
    h2("เป้าหมาย"),
    bull("แปลง DeskLoom จาก dev app → Windows installer ที่ผู้ใช้ดาวน์โหลดแล้วติดตั้งได้เลย"),
    bull("เข้าใจ bundle config ใน tauri.conf.json"),
    bull("ได้ไฟล์ .msi และ .exe พร้อม distribute"),
    div(),
    h2("ทำไม"),
    p("pnpm tauri build อ่าน tauri.conf.json → compile Rust → bundle React → สร้าง installer\nบน Windows Tauri สร้างได้ 2 format:\n- NSIS (.exe) — installer เล็ก ดาวน์โหลด WebView2 ณ เวลา install\n- MSI (.msi) — Windows Installer format มักใช้ใน enterprise\n\nWebView2 คือ Chromium engine ของ Microsoft ที่ Tauri ใช้ render UI — Windows 11 / Win10 รุ่นใหม่มีให้อยู่แล้ว"),
    div(),
    h2("สิ่งที่เพิ่มใน bundle section"),
    code(`"bundle": {
  "active": true,
  "targets": "all",
  "icon": ["icons/32x32.png", "icons/128x128.png", "icons/128x128@2x.png", "icons/icon.icns", "icons/icon.ico"],
  "category": "Utility",
  "shortDescription": "Desktop widget system for Windows",
  "longDescription": "DeskLoom is a desktop widget app for Windows...",
  "windows": {
    "webviewInstallMode": { "type": "downloadBootstrapper" }
  }
}`, "json"),
    h3("อธิบาย field สำคัญ"),
    bull('"active": true — สั่งให้ Tauri สร้าง installer ทุกครั้งที่ build'),
    bull('"targets": "all" — build ทุก format ที่ platform รองรับ (Windows = NSIS + MSI)'),
    bull('"category": "Utility" — บอก Windows ว่าแอปอยู่หมวดไหน ใช้ใน Add/Remove Programs'),
    bull('"webviewInstallMode": "downloadBootstrapper" — จัดการ WebView2 ให้อัตโนมัติถ้าเครื่องไม่มี'),
    div(),
    h2("ผลลัพธ์"),
    code(`src-tauri/target/release/bundle/
├── msi/   DeskLoom_0.5.0_x64_en-US.msi
└── nsis/  DeskLoom_0.5.0_x64-setup.exe`, "bash"),
  ]);

  console.log(`Phase 10-1 done: https://www.notion.so/${id.replace(/-/g,"")}`);
}

async function pushLesson102() {
  console.log("Creating Phase 10-2 page...");
  const id = await createChildPage(PAGE_ID, "Phase 10-2 — Onboarding Flow: Tray Icon Guidance");

  await appendBlocks(id, [
    h2("เป้าหมาย"),
    bull("แก้ปัญหา first-run UX: user ติดตั้งแล้วไม่รู้ว่าแอปอยู่ที่ไหน (main window ซ่อน)"),
    bull("แสดง onboarding overlay อัตโนมัติเมื่อ first run"),
    bull("อัพเดท hints ให้ตรงกับ Phase 9 architecture (tray-controlled)"),
    div(),
    h2("ทำไม"),
    p("Phase 9-6 เปลี่ยน main window เป็น visible: false ถาวร\nผล: user ที่เพิ่งติดตั้ง → เปิดแอป → ไม่เห็นอะไร → งงว่าแอปทำงานหรือเปล่า\n\nHINTS เดิมยังบอก 'Press Ctrl+,' ซึ่งเป็นวิธีเดิมก่อน Phase 9-6 ต้องอัพเดทให้ตรงความจริง"),
    div(),
    h2("สิ่งที่ทำ"),
    h3("App.tsx — เพิ่ม show() ตอน first run"),
    code(`if (saved === null) {
  setIsFirstRun(true);
  setShowOnboarding(true);
  try { await getCurrentWindow().show(); } catch { /* ignore */ }
}`),
    h3("App.tsx — handleDismissOnboarding"),
    code(`const handleDismissOnboarding = useCallback(async () => {
  setShowOnboarding(false);
  if (!isSettingsOpen) {
    try { await getCurrentWindow().hide(); } catch { /* ignore */ }
  }
}, [isSettingsOpen]);`),
    h3("OnboardingOverlay.tsx — HINTS ใหม่"),
    code(`const HINTS: Hint[] = [
  {
    icon:  "🖥️",
    title: "DeskLoom lives in your tray",
    desc:  "Look for the DeskLoom icon in the system tray (bottom-right corner). Click it to open Settings anytime.",
  },
  {
    icon:  "✋",
    title: "Drag widgets freely",
    desc:  "Click and drag any widget to reposition it anywhere on your screen.",
  },
  {
    icon:  "🔲",
    title: "Resize & customize",
    desc:  "Drag widget edges to resize. In Settings you can lock, hide, or adjust each widget individually.",
  },
];`),
    div(),
    h2("อธิบายโค้ดสำคัญ"),
    bull("getCurrentWindow().show() เรียกเฉพาะ saved === null (first run) — run ปกติ window ยังซ่อน"),
    bull("if (!isSettingsOpen) ก่อน hide — ถ้า settings เปิดอยู่ด้วย dismiss แล้วไม่ควร close window"),
    bull("Hint แรก = tray icon — user รู้ทันทีว่าต้องหาอะไร"),
    bull("ลบ Ctrl+, ออกจาก hints — ยังทำงานได้แต่ไม่ใช่ primary method อีกต่อไป"),
    div(),
    h2("ผลลัพธ์ตามสถานการณ์"),
    bull("First run: Window โผล่อัตโนมัติ → onboarding แสดง → dismiss → window ซ่อน"),
    bull("Run ปกติ: Window ซ่อนตลอด จนกว่าจะคลิก tray"),
    bull("คลิก tray แล้ว dismiss onboarding: Window ยังเปิดอยู่ (settings ใช้งานได้ต่อ)"),
  ]);

  console.log(`Phase 10-2 done: https://www.notion.so/${id.replace(/-/g,"")}`);
}

(async () => {
  await pushLesson101();
  await pushLesson102();
  console.log("\nAll done!");
})().catch((e) => { console.error(e.message); process.exit(1); });
