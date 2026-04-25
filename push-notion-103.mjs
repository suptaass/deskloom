// push-notion-103.mjs — push Phase 10-3 lesson to Notion Phase 10 page

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

const h2   = (t) => ({ object:"block", type:"heading_2",          heading_2:          { rich_text:[{type:"text",text:{content:t}}] } });
const h3   = (t) => ({ object:"block", type:"heading_3",          heading_3:          { rich_text:[{type:"text",text:{content:t}}] } });
const p    = (t) => ({ object:"block", type:"paragraph",          paragraph:          { rich_text:[{type:"text",text:{content:t}}] } });
const code = (t, lang="typescript") => ({ object:"block", type:"code", code: { rich_text:[{type:"text",text:{content:t}}], language:lang } });
const bull = (t) => ({ object:"block", type:"bulleted_list_item", bulleted_list_item: { rich_text:[{type:"text",text:{content:t}}] } });
const div  = ()  => ({ object:"block", type:"divider",            divider:{} });

async function pushLesson103() {
  console.log("Creating Phase 10-3 page...");
  const id = await createChildPage(PAGE_ID, "Phase 10-3 — Weather API Key UI");

  await appendBlocks(id, [
    h2("เป้าหมาย"),
    bull("ให้ user กรอก OpenWeatherMap API key ใน Settings"),
    bull("เก็บ key ลง disk ผ่าน appStore + storage.ts (pattern เดิม)"),
    bull("UI: input type password + Show/Hide toggle ใน section Integrations"),
    div(),
    h2("ทำไม"),
    p("Weather widget ต้องการ API key จาก OpenWeatherMap ซึ่งเป็นของแต่ละ user\nถ้า hardcode key ไว้ในโค้ดคือ security risk และ quota จะหมดเร็ว\nPattern ที่เลือก: เก็บใน appStore เหมือน field อื่น (theme, fontSize)\n→ persist ผ่าน storage.ts อัตโนมัติ ไม่ต้องสร้าง storage layer ใหม่"),
    div(),
    h2("สิ่งที่ทำ"),
    h3("1. src/types/widget.ts"),
    p("เพิ่ม weatherApiKey: string ใน AppState interface"),
    h3("2. src/store/appStore.ts"),
    code(`// interface AppStore
setWeatherApiKey: (key: string) => void;

// create() — default state
weatherApiKey: "",

// implementation
setWeatherApiKey: (weatherApiKey) => set({ weatherApiKey }),`),
    h3("3. src/utils/storage.ts — migration guard"),
    code(`const weatherApiKey: string =
  typeof parsed.weatherApiKey === "string" ? parsed.weatherApiKey : "";

return { version, widgets, theme, accentColor, fontSize, autostart, alwaysOnTop, weatherApiKey };`),
    h3("4. src/components/SettingsPanel.tsx — props + UI"),
    code(`// ใน interface SettingsPanelProps
weatherApiKey: string;
onWeatherApiKeyChange: (key: string) => void;

// local state
const [showApiKey, setShowApiKey] = useState(false);

// UI — section Integrations
<input
  type={showApiKey ? "text" : "password"}
  value={weatherApiKey}
  onChange={(e) => onWeatherApiKeyChange(e.target.value)}
  placeholder="Paste your API key here"
/>
<button onClick={() => setShowApiKey((v) => !v)}>
  {showApiKey ? "Hide" : "Show"}
</button>`),
    h3("5. src/App.tsx"),
    code(`// ดึงจาก store
const weatherApiKey    = useAppStore((state) => state.weatherApiKey);
const setWeatherApiKey = useAppStore((state) => state.setWeatherApiKey);

// เพิ่มใน saveState + writeLayoutFile
await saveState({ ..., weatherApiKey });

// ส่งลง SettingsPanel
<SettingsPanel
  weatherApiKey={weatherApiKey}
  onWeatherApiKeyChange={setWeatherApiKey}
/>`),
    div(),
    h2("อธิบายโค้ดสำคัญ"),
    bull("weatherApiKey ใน AppState — TypeScript บังคับทุกที่ที่ construct AppState ต้องใส่ field นี้ ลืมแล้ว error ทันที"),
    bull("migration guard typeof ... === 'string' — state.json เก่าไม่มี field นี้ → undefined → guard เปลี่ยนเป็น '' แทน"),
    bull("saveState({ ..., weatherApiKey }) — ต้องรวม field ใหม่เข้า object ที่เขียนลง disk ทุกครั้ง"),
    bull("type={showApiKey ? 'text' : 'password'} — browser mask อัตโนมัติ toggle ใช้ local state ไม่กระทบ store"),
    bull("SettingsPanel รับผ่าน props เท่านั้น — dumb component pattern ทดสอบง่าย ไม่มี hidden dependency"),
    div(),
    h2("ผลลัพธ์"),
    p("เปิด Settings → เลื่อนลง → เห็น section Integrations\n→ ช่อง API key (masked) + ปุ่ม Show/Hide\n→ กรอก key → ปิด Settings → key ถูก persist ลง state.json อัตโนมัติ (500ms)"),
    div(),
    h2("Verification"),
    code("npx tsc --noEmit   → ผ่าน (0 errors)", "bash"),
    bull("เปิด app → Settings → Integrations section ปรากฏ"),
    bull("กรอก key → Show → เห็น plain text → Hide → masked อีกครั้ง"),
    bull("ปิด/เปิด app → key ยังอยู่"),
  ]);

  console.log(`Phase 10-3 done: https://www.notion.so/${id.replace(/-/g,"")}`);
}

(async () => {
  await pushLesson103();
  console.log("\nAll done!");
})().catch((e) => { console.error(e.message); process.exit(1); });
