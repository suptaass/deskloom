# Phase 10-3 — Weather API Key UI

## เป้าหมาย
- ให้ user กรอก OpenWeatherMap API key ใน Settings
- เก็บ key ลง disk ผ่าน appStore + storage.ts (pattern เดิม)
- UI: input type password + Show/Hide toggle ใน section "Integrations"

---

## ทำไม
Weather widget ต้องการ API key จาก OpenWeatherMap ซึ่งเป็นของแต่ละ user
ถ้า hardcode key ไว้ในโค้ดคือ security risk และ quota จะหมดเร็ว
pattern ที่เลือก: เก็บใน appStore เหมือน field อื่น (theme, fontSize) → persist ผ่าน storage.ts อัตโนมัติ ไม่ต้องสร้าง storage layer ใหม่

---

## สิ่งที่ทำ

### 1. `src/types/widget.ts`
เพิ่ม `weatherApiKey: string` ใน `AppState` interface

### 2. `src/store/appStore.ts`
- เพิ่ม `setWeatherApiKey: (key: string) => void` ใน interface `AppStore`
- เพิ่ม `weatherApiKey: ""` ใน default state
- เพิ่ม implementation: `setWeatherApiKey: (weatherApiKey) => set({ weatherApiKey })`

### 3. `src/utils/storage.ts`
เพิ่ม migration guard ใน `parseAppState`:
```typescript
const weatherApiKey: string =
  typeof parsed.weatherApiKey === "string" ? parsed.weatherApiKey : "";
```
เพิ่ม field ใน return value

### 4. `src/components/SettingsPanel.tsx`
- เพิ่ม props: `weatherApiKey: string` และ `onWeatherApiKeyChange: (key: string) => void`
- เพิ่ม local state: `const [showApiKey, setShowApiKey] = useState(false)`
- เพิ่ม section "Integrations" ระหว่าง "Start with Windows" และ "Add Widgets"
- UI: `<input type={showApiKey ? "text" : "password"}>` + ปุ่ม Show/Hide

### 5. `src/App.tsx`
- ดึง `weatherApiKey` และ `setWeatherApiKey` จาก `useAppStore`
- เพิ่ม `weatherApiKey` ใน `saveState(...)` และ dependency array ของ auto-save
- เพิ่ม `weatherApiKey` ใน `writeLayoutFile(...)` และ `handleExportLayout`
- ส่ง `weatherApiKey={weatherApiKey}` และ `onWeatherApiKeyChange={setWeatherApiKey}` ลง `<SettingsPanel>`

---

## อธิบายโค้ดสำคัญ

| จุด | ทำไมสำคัญ |
|---|---|
| `weatherApiKey: string` ใน `AppState` | TypeScript บังคับทุกที่ที่ construct AppState ต้องใส่ field นี้ — ถ้าลืมจะ error ทันที |
| migration guard `typeof ... === "string" ? ... : ""` | state.json เก่าไม่มี field นี้ → ถ้าไม่ guard จะได้ `undefined` แทน `""` → runtime พัง |
| `saveState({ ..., weatherApiKey })` | ต้องรวม field ใหม่เข้า object ที่เขียนลง disk ทุกครั้งที่ save |
| `type={showApiKey ? "text" : "password"}` | browser mask ด้วย `•` อัตโนมัติ, toggle ใช้ local state ไม่กระทบ store |
| SettingsPanel รับผ่าน props เท่านั้น | pattern "dumb component" — ทดสอบง่าย ไม่มี hidden dependency |

---

## ผลลัพธ์
เปิด Settings → เลื่อนลง → เห็น section "Integrations" → ช่อง API key (masked) + ปุ่ม Show/Hide → กรอก key → ปิด Settings → key ถูก persist ลง `state.json` อัตโนมัติ (ผ่าน auto-save 500ms)

---

## Verification
```
npx tsc --noEmit   → ผ่าน (0 errors)
```
- เปิด app → Settings → Integrations section ปรากฏ
- กรอก key → Show → เห็น plain text → Hide → masked อีกครั้ง
- ปิด/เปิด app → key ยังอยู่
