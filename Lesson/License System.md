# License System — Gumroad + Zustand + Modal UI

> **Tech Stack:** Tauri v2 + React + TypeScript + Zustand + Gumroad API
> **Working directory:** `e:\Project\deskloom`

---

## เป้าหมาย

- ระบบ License แบบ "verify ออนไลน์ + cache บน disk" สำหรับ Premium features
- ใช้ Gumroad เป็น payment/license provider — ไม่ต้องสร้าง backend เอง
- Widget บางตัว (Pomodoro, Habit Tracker ฯลฯ) ถูก lock ไว้จนกว่า user จะ activate license
- UI: modal กลางหน้าจอสำหรับ activate / deactivate

---

## Lesson 1 — license.ts: Gumroad API + File I/O

### ทำไม

ต้องการ verify license key กับ Gumroad แต่ไม่อยากให้ user verify ทุกครั้งที่เปิดแอป
แนวทางที่ถูกต้อง: verify ครั้งแรก → save ลง disk → load จาก disk ในครั้งต่อๆ ไป

**ทำไมไม่ verify ทุกครั้ง?**
- Network call ทุกครั้งที่เปิดแอป = ช้า + ใช้ได้ไม่ offline
- Gumroad มี rate limit — call บ่อยเกินไปอาจโดน block

**ทำไม Gumroad?**
- เป็น payment platform ที่มี License Key API พร้อมใช้
- ไม่ต้องสร้าง backend เอง → `POST /v2/licenses/verify` ส่ง key กลับมา + purchase details

### สิ่งที่จะทำ

ไฟล์ใหม่: `src/utils/license.ts`

4 functions หลัก:
1. `loadLicense()` — อ่าน `license.json` จาก AppData
2. `saveLicense(data)` — เขียน `license.json`
3. `clearLicense()` — เขียน `{}` ทับ (deactivate)
4. `verifyLicense(key)` — POST ไปยัง Gumroad API

```typescript
const APP_DIR      = "com.deskloom.app";
const LICENSE_FILE = `${APP_DIR}/license.json`;
const GUMROAD_PRODUCT_PERMALINK = "deskloom";

export interface LicenseData {
  key:        string;
  email:      string;
  verifiedAt: number;
}

export async function loadLicense(): Promise<LicenseData | null> {
  const fileExists = await exists(LICENSE_FILE, { baseDir: BaseDirectory.AppData });
  if (!fileExists) return null;
  try {
    const raw  = await readTextFile(LICENSE_FILE, { baseDir: BaseDirectory.AppData });
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (typeof data.key !== "string" || typeof data.verifiedAt !== "number") return null;
    return { key: data.key, email: typeof data.email === "string" ? data.email : "", verifiedAt: data.verifiedAt };
  } catch { return null; }
}
```

```typescript
export async function verifyLicense(licenseKey: string): Promise<VerifyResult> {
  try {
    const res = await fetch("https://api.gumroad.com/v2/licenses/verify", {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    new URLSearchParams({
        product_permalink:    GUMROAD_PRODUCT_PERMALINK,
        license_key:          licenseKey.trim(),
        increment_uses_count: "false",
      }),
    });
    const data = (await res.json()) as GumroadResponse;
    if (!data.success || !data.purchase) {
      return { ok: false, error: data.message ?? "Invalid license key" };
    }
    const { refunded, chargebacked, disputed, email } = data.purchase;
    if (refunded || chargebacked || disputed) {
      return { ok: false, error: "This license has been refunded or disputed" };
    }
    return { ok: true, email };
  } catch {
    return { ok: false, error: "Could not connect to license server. Check your internet connection." };
  }
}
```

### อธิบายโค้ดสำคัญ

- `BaseDirectory.AppData` — เส้นทาง `%APPDATA%\com.deskloom.app\license.json` บน Windows  
  Tauri จัดการ path ให้อัตโนมัติ ไม่ต้อง hardcode path
- `increment_uses_count: "false"` — บอก Gumroad ว่าอย่านับจำนวนการ verify  
  ถ้าไม่ใส่ Gumroad จะนับทุกครั้ง → user verify บ่อยๆ อาจโดน "uses exceeded"
- Type guard `typeof data.key !== "string"` — ป้องกัน crash ถ้า file ถูก corrupt หรือถูกแก้ด้วย text editor
- `clearLicense` เขียน `{}` แทนการลบไฟล์ — ป้องกัน race condition กับ `loadLicense`

### ผลลัพธ์

license.json ถูกสร้างที่ `%APPDATA%\com.deskloom.app\license.json` หลัง activate สำเร็จ

---

## Lesson 2 — licenseStore.ts: Zustand Store

### ทำไม

License state ต้องใช้ร่วมกันหลาย component (SettingsPanel, WidgetContainer, LicenseModal)
Zustand store เหมาะสมเพราะ:
- ไม่ต้อง prop drill `isPremium` ทุกชั้น
- Component subscribe เฉพาะ field ที่ใช้ → ไม่ re-render ทั้งแอป
- Action `activateLicense` / `deactivate` อยู่ใกล้ state → ง่ายต่อการ test

**ทำไม licenseStore แยกจาก appStore?**
- appStore ใช้ version migration และ persist ลง disk ผ่าน `storage.ts`
- License มี lifecycle ต่างกัน (verify online → save ไฟล์แยก) → ควรแยก store

### สิ่งที่จะทำ

ไฟล์ใหม่: `src/store/licenseStore.ts`

```typescript
interface LicenseStore {
  isPremium:   boolean;
  licenseKey:  string | null;
  email:       string | null;
  isVerifying: boolean;
  errorMsg:    string | null;

  loadFromDisk:    () => Promise<void>;
  activateLicense: (key: string) => Promise<boolean>;
  deactivate:      () => Promise<void>;
  clearError:      () => void;
}
```

```typescript
activateLicense: async (key) => {
  set({ isVerifying: true, errorMsg: null });
  const result = await verifyLicense(key);
  if (result.ok) {
    const licenseData: LicenseData = { key, email: result.email, verifiedAt: Date.now() };
    await saveLicense(licenseData);
    set({ isPremium: true, licenseKey: key, email: result.email, isVerifying: false });
    return true;
  } else {
    set({ isVerifying: false, errorMsg: result.error });
    return false;
  }
},
```

### อธิบายโค้ดสำคัญ

- `isVerifying: true` ทันทีที่เริ่ม → UI แสดง "Verifying…" และ disable ปุ่ม
- `activateLicense` return `boolean` — caller (LicenseModal) ไม่ต้องดู store อีกรอบ แค่เช็ค return value
- `loadFromDisk` เรียกตอน App mount (ใน App.tsx useEffect) — โหลด license จาก disk ครั้งแรก
- ไม่มี `persist` middleware — license ถูก persist ผ่าน `saveLicense()` เอง ไม่ผ่าน Zustand

### ผลลัพธ์

หลัง `loadFromDisk()` ถ้า license.json ถูกต้อง → `isPremium: true` ทันที ไม่ต้องมี network call

---

## Lesson 3 — LicenseModal.tsx: Activation UI

### ทำไม

License modal ต้องแสดง 2 state: ยังไม่ activate (form) และ activate แล้ว (badge + deactivate)
แยกเป็น component ต่างหากเพราะ:
- SettingsPanel ใหญ่พออยู่แล้ว
- Modal มี lifecycle ของตัวเอง (focus input, keyboard handler)
- ใช้ซ้ำได้จากที่อื่นในอนาคต

**Pattern:** SettingsPanel ควบคุม `showLicenseModal` state และส่ง `onClose` ลงมา
LicenseModal ไม่ควบคุมการแสดง/ซ่อนตัวเอง — เป็น dumb component ในแง่นั้น

### สิ่งที่จะทำ

ไฟล์ใหม่: `src/components/LicenseModal.tsx`

โครงสร้าง:
1. `overlayStyle` — fixed overlay backdrop blur
2. `cardStyle` — card กลางหน้าจอ 340px
3. render แบบ conditional: `isPremium` → badge + deactivate / `!isPremium` → form + activate

```typescript
const inputRef = useRef<HTMLInputElement>(null);

useEffect(() => {
  if (!isPremium) inputRef.current?.focus();
  return () => clearError();
}, []);

const handleKeyDown = (e: React.KeyboardEvent) => {
  if (e.key === "Enter") handleActivate();
  if (e.key === "Escape") onClose();
};
```

```tsx
{!isPremium && (
  <>
    <input ref={inputRef} placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX"
      value={keyInput} onChange={(e) => { setKeyInput(e.target.value); clearError(); }}
      onKeyDown={handleKeyDown} />
    {errorMsg && <div style={errorStyle}>{errorMsg}</div>}
    <button onClick={handleActivate} disabled={isVerifying || !keyInput.trim()}>
      {isVerifying ? "Verifying…" : "Activate License"}
    </button>
  </>
)}
```

### อธิบายโค้ดสำคัญ

- `inputRef.current?.focus()` ใน useEffect — auto-focus input ทันทีที่ modal เปิด UX ที่ดีขึ้น
- `return () => clearError()` — cleanup: ลบ error message เมื่อ modal ปิด ป้องกัน error เก่าค้างอยู่
- `disabled={isVerifying || !keyInput.trim()}` — ปุ่มใช้งานไม่ได้ใน 2 กรณี: กำลัง verify / key ว่าง
- `if (e.target === e.currentTarget) onClose()` บน overlay — คลิก backdrop ปิด modal แต่คลิก card ไม่ปิด
- `licenseKey.slice(0, 8) + "••••"` — แสดง key บางส่วน ไม่โชว์ full key ด้วยเหตุผลความปลอดภัย

### ผลลัพธ์

กด "Upgrade to Premium" ใน Settings → modal เปิด → กรอก key → กด Enter หรือปุ่ม → verify กับ Gumroad → success badge

---

## Lesson 4 — SettingsPanel.tsx: Premium Lock + Upgrade Button

### ทำไม

SettingsPanel ต้องแสดง:
1. "Upgrade to Premium" button (ถ้า free) / "Premium Active" badge (ถ้า licensed)
2. Widget ที่เป็น Premium → locked ถ้า `isPremium: false` → คลิกเปิด modal แทนการเพิ่ม widget

**Pattern ที่ใช้:** WidgetRegistry เพิ่ม field `isPremium: boolean` บน entry
SettingsPanel เช็คค่านี้ก่อน allow add widget

### สิ่งที่จะทำ

ไฟล์: `src/components/SettingsPanel.tsx`

1. Import `useLicenseStore` + `LicenseModal`
2. เพิ่ม state: `const [showLicenseModal, setShowLicenseModal] = useState(false)`
3. Subscribe: `const isPremium = useLicenseStore((s) => s.isPremium)`
4. Render LicenseModal ด้านบน return (ก่อน main panel):

```tsx
{showLicenseModal && <LicenseModal onClose={() => setShowLicenseModal(false)} />}
```

5. Premium section ใน Settings (แสดงทั้ง 2 state):

```tsx
{isPremium ? (
  <div style={successBadgeStyle} onClick={() => setShowLicenseModal(true)}>
    <p>Premium Active</p>
  </div>
) : (
  <div style={upgradeBannerStyle} onClick={() => setShowLicenseModal(true)}>
    <p>Upgrade to Premium</p>
  </div>
)}
```

6. Widget lock logic ใน widget list:

```tsx
const locked = entry.isPremium && !isPremium;

<div onClick={() => {
  if (locked) { setShowLicenseModal(true); return; }
  onAddWidget(entry.type);
}} title={locked ? "Premium feature — click to upgrade" : undefined}>
  {locked && <LockIcon />}
  {entry.name}
</div>
```

### อธิบายโค้ดสำคัญ

- `entry.isPremium && !isPremium` — locked เฉพาะเมื่อ widget เป็น premium AND user ไม่มี license
- Early return `if (locked) { setShowLicenseModal(true); return; }` — ป้องกันการเพิ่ม premium widget โดยไม่ได้รับอนุญาต
- `setShowLicenseModal` state อยู่ใน SettingsPanel ไม่ใช่ App.tsx — modal นี้ใช้ใน context ของ Settings เท่านั้น

### ผลลัพธ์

Widget premium ใน list มี lock icon → คลิก → modal activation เปิดขึ้นแทน

---

## Verification

```bash
npx tsc --noEmit
```

ทดสอบ:
1. เปิด Settings → เห็น "Upgrade to Premium" banner
2. คลิก banner → LicenseModal เปิด focus ที่ input ทันที
3. กรอก key ผิด → error message แสดง
4. กรอก key ถูก → badge "Premium Active" ปรากฏ
5. ปิด modal เปิดใหม่ → badge ยังอยู่ (load จาก disk)
6. กด Deactivate → กลับเป็น free
7. Widget premium → lock icon → คลิก → modal เปิด
