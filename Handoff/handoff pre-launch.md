คุณคือ Programming Tutor ระดับมืออาชีพ และเป็น Technical Instructor ที่เข้มงวดมาก
หน้าที่ของคุณ: สอนสร้างโปรเจกต์ต่อจาก session ก่อน

กฎสำคัญ (ห้ามฝ่าฝืน):
1. ห้าม redesign architecture
2. ต้องบอกเสมอ: เปิดไฟล์ไหน / เพิ่ม-แก้ตรงไหน
3. ห้ามพูดกว้าง เช่น "เพิ่มโค้ดเข้าไป"
4. โค้ดต้องเป็นภาษาอังกฤษเท่านั้น
5. อธิบายเป็นภาษาไทยเท่านั้น
6. อธิบาย "ทำไม" ก่อน "ทำอย่างไร"
7. ถ้าไม่แน่ใจ ให้บอกว่าไม่แน่ใจ ห้ามเดา
8. ถ้าบทเรียนใดต้องแก้ไฟล์ที่ยังไม่ได้รับ → ห้ามเดาโค้ด → แจ้งชื่อไฟล์ที่ต้องการก่อน
9. รูปแบบคำตอบ: แนวคิด → สิ่งที่จะทำ → ขั้นตอน → โค้ด → อธิบายโค้ดสำคัญ → ผลลัพธ์
10. หากเพิ่ม/แก้โค้ดเสร็จทุกครั้ง ให้ตรวจ TypeScript error ด้วย `npx tsc --noEmit`
11. ประหยัด context — ไม่ spawn agent โดยไม่จำเป็น ใช้ Grep/Read ตรงเมื่อรู้ path แล้ว
12. ใช้ token อย่างประหยัด — บอกแค่ชื่อไฟล์ + ตำแหน่ง ไม่ต้องแปะโค้ดเต็มหากไม่จำเป็น
13. ⚠️ หลังจบทุก Lesson ต้อง: สร้าง Lesson file → push ขึ้น Notion → อัพเดท Handoff → commit ทันที ห้ามรอสะสม

---

## 🔴 MANDATORY CHECKLIST — ทำทุกครั้งหลังจบแต่ละ Lesson

### หลังจบแต่ละ Lesson:
1. `npx tsc --noEmit` — ต้องผ่านก่อนเสมอ
2. สร้าง `Lesson/Phase X-Y.md`
3. Push Lesson ขึ้น Notion (ใช้ push-notion-103.mjs เป็น template, PAGE_ID เดิม)
4. อัพเดท Handoff file
5. `git add <เฉพาะไฟล์ที่เปลี่ยน>` → `git commit` → `git push`

---

# 🧠 HANDOFF — DeskLoom Pre-Launch Polish

## โปรเจกต์
DeskLoom — Desktop Widget App (Windows)  
Tech Stack: Tauri v2 + React + TypeScript + Zustand + Tauri FS API  
Working directory: e:\Project\deskloom  
Current version: v0.6.0 (git tag: v0.6.0)

---

## ✅ สถานะปัจจุบัน

- Phase 10 ครบทุก Lesson แล้ว
- GitHub Release v0.6.0 พร้อม (installer: `DeskLoom_0.6.0_x64-setup.exe`)
- README อัพเดทแล้ว มีปุ่ม Download

---

## 🔍 ANALYSIS — วิเคราะห์ก่อน Launch

### ✅ จุดเด่น

| จุด | รายละเอียด |
|---|---|
| **Lightweight** | Tauri ไม่ใช่ Electron — RAM ต่ำกว่า ~10x, ขนาด installer เล็กกว่ามาก |
| **Per-widget OS window** | แต่ละ widget เป็น window ของ OS จริง — resize, move, z-order เป็นธรรมชาติ |
| **ไม่ต้อง account** | ข้อมูลเก็บ local ทั้งหมด ไม่มี cloud dependency |
| **Weather ใช้งานได้ฟรี** | WeatherWidget ใช้ Open-Meteo API — ไม่ต้องการ API key เลย |
| **Feature ครบ** | Stack, Schedule, Shortcut, Multi-monitor, Click-through, Export/Import |
| **License system พร้อม** | Gumroad + LicenseModal + Premium lock ทำครบแล้ว |
| **Onboarding** | First-run UX ดี — แสดง window อัตโนมัติ + hints ชัดเจน |
| **Atomic save** | เขียน state ผ่าน temp file → rename ไม่มีโอกาส corrupt |

---

### ⚠️ จุดอ่อน / Bug ที่ต้องแก้ก่อน Launch

#### 🔴 Critical (แก้ก่อนให้คนใช้)

**1. weatherApiKey ใน Settings ผิดความจริง**
- `SettingsPanel` แสดง "OpenWeatherMap API Key"
- แต่ `WeatherWidget.tsx` ใช้ **Open-Meteo** (ฟรี ไม่ต้องการ key เลย)
- ผล: user กรอก key ไป แต่ widget ไม่ได้ใช้ → สร้างความสับสน
- ไฟล์: `src/components/SettingsPanel.tsx`, `src/components/widgets/WeatherWidget.tsx`
- **ตัวเลือก A:** ลบ weatherApiKey section ออกจาก Settings (เพราะไม่ได้ใช้)
- **ตัวเลือก B:** เปลี่ยน WeatherWidget ให้ใช้ OpenWeatherMap จริง (ซับซ้อนกว่า)
- **แนะนำ: ตัวเลือก A** — ลบ UI ออก เก็บ field ไว้ใน store ก่อน ไม่กระทบ architecture

**2. README บอก Premium ผิด**
- README ระบุว่า Weather, Quick Links เป็น Premium
- แต่ `widgetRegistry.ts` กำหนด `isPremium: false` ทั้งคู่
- ผล: user เห็น README แล้วคาดหวังผิด → ซื้อ Premium แล้วผิดหวัง
- ไฟล์: `README.md`

**3. ไม่มี screenshot จริงใน docs/**
- README อ้างถึง `docs/screenshot-dark.png`, `docs/screenshot-light.png`, `docs/screenshot-main.png`
- ไฟล์เหล่านี้ไม่มีอยู่จริง → README แสดง broken image
- ต้องถ่าย screenshot จากแอปจริง แล้วใส่ใน `docs/`

---

#### 🟡 ควรแก้ (ก่อน launch กว้าง)

**4. SmartScreen Warning**
- installer ไม่ได้ sign → Windows แสดง "Windows protected your PC"
- user ต้อง click "More info → Run anyway" ซึ่งน่ากลัวสำหรับ non-technical user
- แก้: ซื้อ Code Signing Certificate (~$70-200/ปี) หรือบอก user ล่วงหน้าใน README

**5. ไม่มีระบบ Auto-update**
- user ที่ติดตั้งแล้วไม่รู้ว่ามี version ใหม่
- แก้ Phase ถัดไป: Tauri มี `tauri-plugin-updater` built-in

**6. API key เก็บ plain text**
- `weatherApiKey` และ license key อยู่ใน `state.json` ที่ AppData
- ไม่ encrypt — ถ้า user share state.json ไป key หลุดได้
- สำหรับ v0.6.x: acceptable, แต่ควรแจ้ง user ใน README

**7. Gumroad link ใน README ยังเป็น placeholder**
- `https://suptaass.gumroad.com` — ยังไม่มี product จริง
- ต้องสร้าง Gumroad product ก่อน publish link

---

#### 🟢 Nice to Have (ทำทีหลังได้)

- Error reporting (Sentry หรือ simple log file)
- Re-open onboarding ได้จาก Settings
- Dark/Light screenshot ใน README สวยงาม
- App icon ที่เป็น branding จริง (ตอนนี้ใช้ default Tauri icon)

---

## 🗺️ แผน Pre-Launch (ลำดับ)

### Phase 11-1: แก้ Bug Critical (1 session)
ทำก่อน launch ทุกอย่าง

**สิ่งที่ต้องทำ:**

1. **`src/components/SettingsPanel.tsx`**
   - ลบ section "Integrations" ออก (weatherApiKey input)
   - เหตุผล: Weather ใช้ Open-Meteo ไม่ต้องการ key

2. **`README.md`**
   - แก้ Features table: Weather ไม่ใช่ Premium, Quick Links ไม่ใช่ Premium
   - เพิ่ม note เรื่อง SmartScreen ใน Installation section
   - แก้ Gumroad link หรือลบออกจนกว่าจะมี product จริง

3. **ถ่าย screenshot** (user ทำเอง)
   - เปิดแอป → จัด widget → Print Screen → บันทึกเป็น:
     - `docs/screenshot-dark.png`
     - `docs/screenshot-light.png`
     - `docs/screenshot-main.png`

---

### Phase 11-2: SmartScreen Fix (optional, ถ้าอยากขาย)

**ตัวเลือกราคาถูก:**
- ซื้อ Code Signing Certificate จาก Certum (~$70/ปี) หรือ SSL.com
- บอก user ใน README ว่า "Click More info → Run anyway" ก็ได้ชั่วคราว

---

### Phase 11-3: Auto-Update (ทำหลังได้ feedback)

ใช้ `tauri-plugin-updater` + GitHub Releases เป็น update server
- user จะเห็น popup "New version available" เมื่อมี release ใหม่

---

### Launch Checklist (user ทำเอง)

```
□ ถ่าย screenshot ใส่ docs/
□ สร้าง Gumroad product (ถ้าจะขาย)
□ โพสต์ r/desktops หรือ r/Windows
□ แจ้งเพื่อน/กลุ่มที่สนใจ
```

---

## NOTION
- Phase 10 page ID: `34d9dbe9a74980cf8650f957f61f29b2`
- Integration token: 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
- Script template: `push-notion-103.mjs`

---

## 🚀 คำสั่งสำหรับ session ถัดไป

อ่านไฟล์นี้ให้ครบ จากนั้น:
1. อ่าน `README.md` เพื่อเข้าใจสถานะ app
2. อ่าน `src/components/widgets/WeatherWidget.tsx` บรรทัด 44–66 เพื่อยืนยัน Open-Meteo
3. อ่าน `src/registry/widgetRegistry.ts` เพื่อดู isPremium ของแต่ละ widget
4. เริ่ม Phase 11-1: แก้ bug critical ทั้ง 3 ข้อก่อน จากนั้นค่อยทำ Phase ถัดไป
