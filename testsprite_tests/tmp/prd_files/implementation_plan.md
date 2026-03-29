# 🗂️ MyFiles AI Organizer — منظم الملفات الذكي بالذكاء الاصطناعي

**الهدف:** بناء تطبيق سطح مكتب احترافي يقوم بتحليل الملفات والمجلدات على الجهاز تلقائياً، ويقترح أو ينفذ تنظيماً ذكياً باستخدام الذكاء الاصطناعي.

---

## 🧠 فكرة التطبيق الكاملة

التطبيق يعمل على **3 مراحل ذكية**:
1. **المسح (Scan)** — يقرأ محتويات المجلدات المختارة
2. **التحليل (Analyze)** — يصنف الملفات بالذكاء الاصطناعي حسب النوع، المحتوى، التاريخ، والاستخدام
3. **التنظيم (Organize)** — يقترح هيكل مجلدات جديد أو ينفذ التنظيم مباشرة

---

## 🛠️ Stack التقني

| الطبقة | التقنية | السبب |
|--------|---------|-------|
| **الواجهة (Frontend)** | React + Vite | سريع، حديث، مرن |
| **الإطار (Desktop Shell)** | Electron | تطبيق سطح مكتب حقيقي يصل للملفات |
| **الذكاء الاصطناعي** | Google Gemini API (gemini-1.5-flash) | تصنيف ذكي، مجاني/رخيص، سريع |
| **قاعدة البيانات** | SQLite (better-sqlite3) | حفظ إعدادات القواعد والسجل محلياً |
| **التصميم** | Vanilla CSS + CSS Variables | glassmorphism، dark mode |
| **التشغيل في الخلفية** | Node.js (Electron Main Process) | الوصول لنظام الملفات |

---

## ✨ الميزات الرئيسية

### المرحلة الأولى — Core Features
- **📂 اختيار المجلد**: اختر أي مجلد على جهازك
- **🔍 مسح ذكي**: يعرض قائمة كاملة بالملفات مع الحجم والنوع والتاريخ
- **🤖 تحليل AI**: يرسل البيانات لـ Gemini لتصنيف كل ملف في فئة مناسبة
- **📋 عرض الخطة**: يعرض الهيكل الجديد المقترح قبل أي تنفيذ (Preview Mode)
- **✅ التنفيذ**: ينقل/ينظم الملفات بنقرة واحدة بعد الموافقة
- **↩️ التراجع (Undo)**: استعادة آخر عملية تنظيم

### المرحلة الثانية — Advanced Features
- **📏 قواعد مخصصة**: المستخدم يضيف قواعده (مثل: كل PDF → مجلد الوثائق)
- **⏰ تنظيم تلقائي مجدول**: يعمل في الخلفية يومياً/أسبوعياً
- **📊 لوحة إحصائيات**: مخططات بيانية لتوزيع الملفات
- **🏷️ Tags ذكية**: إضافة تصنيفات بالألوان للملفات

---

## 📁 هيكل المشروع

```
c:\MyfilesAIOrgnizer\
├── electron/
│   ├── main.js              # نقطة دخول Electron
│   ├── preload.js           # جسر آمن بين Electron و React
│   └── fileSystem.js        # عمليات الملفات (قراءة، نقل، إعادة تسمية)
├── src/
│   ├── components/
│   │   ├── FolderPicker/    # اختيار المجلد
│   │   ├── FilesScanner/    # عرض نتائج المسح
│   │   ├── AIAnalyzer/      # واجهة التحليل بالـ AI
│   │   ├── OrganizePlan/    # عرض الخطة قبل التنفيذ
│   │   ├── Dashboard/       # لوحة الإحصائيات
│   │   └── Settings/        # الإعدادات والقواعد المخصصة
│   ├── services/
│   │   ├── geminiService.js # التواصل مع Gemini API
│   │   └── dbService.js     # SQLite للإعدادات والسجل
│   ├── App.jsx
│   └── main.jsx
├── package.json
└── vite.config.js
```

---

## 🎨 التصميم البصري

| العنصر | التفاصيل |
|--------|---------|
| **الثيم** | Dark Mode أساسي، خيار Light Mode |
| **الألوان** | بنفسجي غامق (#7C3AED) + سماوي (#06B6D4) + رمادي دافئ |
| **النمط** | Glassmorphism بشفافية ناعمة |
| **الخطوط** | Inter أو Outfit من Google Fonts |
| **الرسوم** | Framer Motion لانتقالات سلسة |
| **الأيقونات** | Lucide React |

---

## 🔄 سير العمل (User Flow)

```
[بدء التطبيق]
     ↓
[اختيار مجلد] → [مسح الملفات]
     ↓
[إرسال لـ Gemini AI] → [تصنيف كل ملف]
     ↓
[عرض خطة التنظيم] ← المستخدم يراجع ويعدل
     ↓
[الموافقة] → [تنفيذ النقل/إعادة التسمية]
     ↓
[سجل العمليات] + [خيار التراجع]
```

---

## 📦 المراحل والجدول الزمني

### المرحلة 1 — الأساس (الآن)
- [ ] إعداد مشروع Electron + React + Vite
- [ ] واجهة مستخدم رئيسية (Dark mode, glassmorphism)
- [ ] اختيار المجلد وعرض محتوياته
- [ ] مسح وقراءة بيانات الملفات
- [ ] تكامل Gemini API للتصنيف
- [ ] عرض خطة التنظيم (Preview)
- [ ] تنفيذ التنظيم الفعلي
- [ ] وظيفة Undo

### المرحلة 2 — تحسينات (لاحقاً)
- [ ] قواعد مخصصة بواجهة drag & drop
- [ ] جدولة التنظيم التلقائي
- [ ] لوحة إحصائيات متفاعلة

---

## ❓ أسئلة مفتوحة للمراجعة

> [!IMPORTANT]
> **هل تريد Electron (تطبيق سطح مكتب حقيقي) أم تطبيق ويب محلي؟**
> - Electron: تطبيق `.exe` يمكن تثبيته، يصل لكل ملفات الجهاز
> - تطبيق ويب: يعمل في المتصفح فقط، محدود الوصول للملفات

> [!IMPORTANT]
> **مفتاح Gemini API**
> هل لديك مفتاح Gemini API جاهز؟ أم تريدني أن أشرح لك كيفية الحصول عليه مجاناً؟

> [!NOTE]
> **اللغة في الواجهة**
> هل تريد واجهة التطبيق بالعربية أم الإنجليزية أم ثنائية اللغة؟

> [!TIP]
> **نقطة البداية**
> سنبدء بالمرحلة الأولى فقط ونطلق تطبيقاً يعمل بالكامل، ثم نضيف الميزات تدريجياً.

---

## ✅ خطة التحقق

بعد البناء، سنتحقق من:
1. 🖥️ تشغيل التطبيق على Windows بدون أخطاء
2. 📂 اختيار مجلد حقيقي ومعالجة ملفاته
3. 🤖 استدعاء Gemini وعرض نتائج التصنيف
4. ✅ تنفيذ التنظيم الفعلي والتحقق من النقل
5. ↩️ اختبار وظيفة التراجع


# 📦 Feature Spec — Backup & Restore (Updated)
**App:** MyFiles AI Organizer (Electron + React + Vite)
**Spec Version:** 2.0 · 2026-03-29

---

## Change from v1.0

> **User feedback:** Backup should cover not just app state, but **actual user files, folders, and drives** too.

The spec is now split into two independent backup subsystems:

| Subsystem | Backs up | Status |
|---|---|---|
| **App State Backup** | Settings + history JSON | ✅ Phase 0 — DONE |
| **File/Folder/Drive Backup** | Any user-selected folders or drives | 🔴 Phase 1 — THIS SPEC |

---

## 1. File/Folder/Drive Backup — Overview

Users can select **any set of folders or entire drives** to back up into a single encrypted, compressed `.mfab` archive. The archive can be saved to any location (external drive, NAS, cloud-synced folder) and restored later to any destination on any machine.

### Key constraints
- Files can be terabytes — **streaming encryption** is mandatory (no loading whole archive into memory)
- Progress must be visible in real-time
- The main Electron process handles all I/O; the renderer only shows progress

---

## 2. What Gets Backed Up

| ✅ Included | ❌ Not included |
|---|---|
| Any folder the user picks | App binary / node_modules |
| Entire drive root (e.g. D:\\) | Temp/OS system files (optional filter) |
| Nested subfolders (recursive) | Files the user explicitly excludes |
| Hidden files (optional toggle) | |

---

## 3. User Stories

| ID | Story | Priority |
|---|---|---|
| F-1 | As a user, I can pick one or more source folders (or a full drive) to back up. | 🔴 Must |
| F-2 | As a user, I choose where to save the backup file. | 🔴 Must |
| F-3 | As a user, I set a password; the backup is encrypted. | 🔴 Must |
| F-4 | As a user, I see a live progress bar (files processed, % done, current file name). | 🔴 Must |
| F-5 | As a user, I can cancel an in-progress backup. | 🟡 Should |
| F-6 | As a user, I can restore a backup to any destination folder. | 🔴 Must |
| F-7 | As a user, I see estimated file count & size before confirming the backup. | 🟡 Should |
| F-8 | As a user, I can exclude certain sub-folders or file extensions. | 🟢 Nice (Phase 2) |

---

## 4. Technical Architecture

### 4.1 Encryption — Streaming AES-256-CBC + HMAC

AES-GCM requires the full plaintext to produce its auth tag, making it unsuitable for streaming.  
Instead we use **Encrypt-then-MAC** with CBC:

```
password ──(scrypt)──► 64-byte key material
                           │
                    split  ├─► 32-byte enc key  (AES-256-CBC)
                           └─► 32-byte mac key  (HMAC-SHA256)

source folders
     │
     ▼
 archiver (ZIP stream)
     │
     ▼
 AES-256-CBC cipher stream
     │
     ▼
  file write stream  ──► backup.mfab
     │
     ▼ (after stream ends)
 HMAC-SHA256 over ciphertext  ──► append 32 bytes to file
```

**scrypt params:** N=65536, r=8, p=1, keylen=64

### 4.2 File Format — `.mfab` v2

```
[ HEADER — 256 bytes  ] ← plain JSON: magic, version, algo, kdf, saltHex, ivHex
[ CIPHERTEXT STREAM   ] ← AES-256-CBC of ZIP stream (variable length)
[ HMAC-SHA256 — 32 B  ] ← integrity tag over ciphertext only
```

### 4.3 ZIP Archive Layout

```
backup/
  manifest.json       ← source paths, file count, total size, date, app version
  files/
    < original folder structure preserved relative to each source root >
```

### 4.4 Progress Events (Main → Renderer)

```
ipcMain → webContents.send('filebkp:progress', {
  phase:          'scanning' | 'archiving' | 'done' | 'error',
  totalFiles:     number,
  processedFiles: number,
  totalBytes:     number,
  processedBytes: number,
  currentFile:    string,   // basename of file being added
  percent:        number,   // 0-100
})
```

---

## 5. New IPC Channels

| Channel | Direction | Args | Returns |
|---|---|---|---|
| `filebkp:selectSources` | invoke | — | `string[]` — array of picked folder paths |
| `filebkp:selectDest` | invoke | — | `string \| null` — save path |
| `filebkp:selectRestoreDest` | invoke | — | `string \| null` — restore root folder |
| `filebkp:selectFile` | invoke | — | `string \| null` — .mfab file path |
| `filebkp:create` | invoke | `{ password, sourcePaths[], destPath }` | `{ success, manifest?, error? }` |
| `filebkp:restore` | invoke | `{ password, filePath, destPath }` | `{ success, manifest?, error? }` |
| `filebkp:cancel` | send | — | — (cancels in-progress backup) |
| `filebkp:progress` | event (main→renderer) | progress object | — |

---

## 6. New Files

```
electron/
  fileBackup.cjs      ← streaming backup/restore logic

src/components/
  FileBackupPanel.jsx ← dedicated full-page UI
```

Modified:
```
electron/main.js      ← new IPC handlers
electron/preload.cjs  ← new bridge methods
src/components/Sidebar.jsx  ← new "Backup" nav item
src/App.jsx           ← render FileBackupPanel on 'backup' page
```

---

## 7. UI Design

### 7.1 Navigation
New sidebar item: **🛡️ Backup** (between History and Settings)

### 7.2 Page Layout

```
┌─────────────────────────────────────────────────────┐
│  🛡️  File Backup & Restore                           │
│  ───────────────────────────────────────────────     │
│  [ Create Backup ]  [ Restore Backup ]               │
│                                                       │
│  ── CREATE BACKUP ──────────────────────────────     │
│                                                       │
│  Source Folders                  [ + Add Folder ]    │
│  ┌──────────────────────────────────────────────┐   │
│  │ 📁 C:\Users\Docs                        [✕] │   │
│  │ 📁 D:\Projects                          [✕] │   │
│  └──────────────────────────────────────────────┘   │
│  ~ 14,320 files · 8.4 GB estimated                   │
│                                                       │
│  Save To    [D:\Backups\backup-2026-03-29.mfab] [📁] │
│  Password   [_______________________] [👁]            │
│  Confirm    [_______________________]                 │
│  Strength   ████████████  Very Strong                 │
│                                                       │
│  [ 🛡️ Start Encrypted Backup ]                       │
│                                                       │
│  ── PROGRESS ─────────────────────────────────────   │
│  Archiving: invoice_march.pdf                         │
│  ████████████████░░░░░░░░  64%  9,165 / 14,320 files │
│  4.2 GB / 8.4 GB                         [ Cancel ]  │
└─────────────────────────────────────────────────────┘
```

### 7.3 States

| State | UI behavior |
|---|---|
| Idle | Show source list + password fields + Start button |
| Scanning | "Counting files…" spinner before backup starts |
| Archiving | Progress bar, file counter, bytes counter, cancel button |
| Done | Green success, file path, size |
| Error | Red inline error + log console |
| Restore: verify | Decrypt header, show manifest info |
| Restore: progress | Progress bar for decompression |

---

## 8. Implementation Phases

### ✅ Phase 0 — App State Backup (DONE)
- Settings + history JSON backup/restore
- AES-256-GCM in-memory encryption
- In the Settings page

### 🔴 Phase 1 — File/Folder/Drive Backup *(Current — Seeking Approval)*
- [ ] `electron/fileBackup.cjs` — streaming zip + CBC + HMAC
- [ ] 8 new IPC channels in main.js + preload.cjs
- [ ] `FileBackupPanel.jsx` with source list, progress bar, restore tab
- [ ] "Backup" nav item in Sidebar + page in App.jsx
- [ ] Manual QA: backup a folder → verify file → restore to new location

### 🟢 Phase 2 — Scheduled Auto-Backup
- Cron/setInterval scheduler
- Configure on the Backup page
- Runs silently, toasts on completion

### 🟢 Phase 3 — Backup History Viewer
- List all .mfab files in a configured folder
- Show date, size, source info from manifest
- One-click restore
