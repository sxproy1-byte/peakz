# موقع PEAKZ — مسابقات، بونص هانت، بطولات

موقع ثابت على GitHub Pages + Firebase Realtime Database + Cloudflare Worker (`kick-login`).

## الأقسام
- **الرئيسية** `index.html`: حالة بث peakz9 (أونلاين/أوفلاين) من الـWorker (`/channel`).
- **المسابقات** `giveaways.html` + `admin.html`: دخول من الموقع أو بكلمة بالشات (يُقرأ عبر Kick Webhook على الـWorker)، سحب بتأثير الكيس CS، وOBS overlay في `overlay.html`.
- **التوثيق**: تسجيل دخول كيك، ثم ربط ديسكورد (رول التوثيق بالسيرفر) من `profile.html`. غير الموثّق ما يقدر يشارك. يوزر ستيك وعنوان USDT (BSC) وحساب الديسكورد ينقفلوا بعد أول حفظ، والأدمن بس يعدّلهم من جدول المستخدمين.
- **البونص هانت** `bonus.html` + `admin-bonus.html`: المستخدم يخمّن إجمالي الربح ويعدّل لين ينقفل التخمين. الأدمن يفتح/يقفل/يمدّد التخمين (بدقائق يحددها)، يضيف البونصات، يبدأ التفتيح ويكتب ربح كل بونص، ثم ينهي الهانت فيطلع أقرب 3 مع جائزة لكل مركز.
- **البطولات** `tournaments.html` + `admin-tournaments.html`: إقصاء مباشر (8/16/32). التسجيل مسابقة عادية بكلمة بالشات، بعدها سحب اللاعبين واحد واحد بتأثير الكيس (ترتيب السحب = مكانهم بالشجرة)، ثم الأدمن يكتب لعبة كل لاعب ويبدأ، ويدخل رهان وربح كل لاعب بكل مباراة والموقع يحسب الفائز بالـ x (الربح ÷ الرهان).

## النشر
1. **قواعد Firebase:** الصق `database.rules.json` بصفحة Rules واضغط Publish (كل تعديل عليه يحتاج نشر).
2. **الموقع:** ارفع الملفات لمستودع GitHub بنفس المجلدات (`js`, `css`, `img`).
3. **الـWorker:** من مجلد `worker`: `npx wrangler deploy`. الأسرار: `npx wrangler secret put NAME` لكل من `KICK_CLIENT_SECRET`, `FIREBASE_PRIVATE_KEY`, `DISCORD_CLIENT_SECRET`, `DISCORD_BOT_TOKEN`.
4. **ربط الشات:** الستريمر يفتح `https://kick-login.roy515.workers.dev/connect?r=admin.html` وهو داخل على كيك بحسابه.

## ملاحظات
- العدالة: الفائز يُختار قبل الحركة بـ`crypto.getRandomValues` (بدون انحياز)، والشريط بس يعرضه.
- لو حدا ربط ديسكورد غلط، الأدمن يفك الربط من جدول المستخدمين.
- بدّل مفتاح Firebase الخاص إذا انكشف: مفتاح جديد، احذف القديم، ثم `wrangler secret put FIREBASE_PRIVATE_KEY`.
