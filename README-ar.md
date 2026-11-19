# موقع المسابقات — دليل التركيب

الموقع: HTML + Firebase (قاعدة البيانات) + Cloudflare Worker (تسجيل الدخول بكيك).
الأدمن فقط حسابات كيك الموجودة بـ `ADMIN_KICK_NAMES` (إنت والستريمر).

## 1) Firebase
1. أنشئ مشروع، وفعّل **Realtime Database** (منطقة قريبة).
2. من تبويب Rules الصق محتوى `database.rules.json` واضغط Publish.
3. Project settings > Your apps > Web: خذ إعدادات الـ config وحطها بـ `js/config.js`.
4. Project settings > Service accounts > **Generate new private key**. من الملف بتحتاج `client_email` و`private_key` (للـ Worker فقط، لا ترفع الملف لأي مكان عام).

## 2) تطبيق كيك
- سجّل تطبيق على Kick Developer، وخذ Client ID و Client Secret.
- Redirect URI = `https://<اسم-الـworker>.<حسابك>.workers.dev/callback`
- الصلاحية المطلوبة: `user:read`.

## 3) Cloudflare Worker
```
cd worker
npx wrangler login
# عدّل wrangler.toml (SITE_URL, KICK_CLIENT_ID, ADMIN_KICK_NAMES, FIREBASE_CLIENT_EMAIL)
npx wrangler secret put KICK_CLIENT_SECRET
npx wrangler secret put FIREBASE_PRIVATE_KEY
npx wrangler deploy
```
بعد النشر، حط رابط الـ Worker بـ `workerUrl` داخل `js/config.js`.

## 4) رفع الموقع
ارفع كل شي ما عدا مجلد `worker` على GitHub Pages (أو أي استضافة ثابتة).

## 5) ربط شات كيك (مرة وحدة)
1. افتح بالمتصفح: `https://kick.com/api/v2/channels/peakz9` وابحث عن `"chatroom":{"id":...` وانسخ الرقم.
2. من `admin.html` الصقه بخانة Chatroom ID واضغط "حفظ وتشغيل الربط".
3. اترك صفحة الأدمن مفتوحة خلال البث. كل من يكتب كلمة المسابقة بالشات بينضاف للسحب.

## طريقة الاستخدام خلال البث
1. من `admin.html` أنشئ مسابقة (العنوان، الجائزة، الكلمة، المدة، عدد الفائزين).
2. المشاركون يدخلون من الموقع أو بكتابة الكلمة بالشات (نفس الحساب، ما بينعد مرتين).
3. بعد ما ينتهي الوقت اضغط "سحب" وشارك الشاشة بالبث. الاختيار عشوائي آمن، والفائزون بينحفظوا ويظهروا بالموقع.

## ملاحظات
- الاستماع للشات يعتمد على قناة Pusher العامة لكيك (غير موثّقة رسمياً)، فممكن تتغير. البديل الرسمي هو Webhooks وبنقدر نضيفه لاحقاً على الـ Worker.
- نقاط الـ API لكيك (`id.kick.com`, `api.kick.com/public/v1/users`) اتبعت فيها التوثيق المعروف، فتأكد منها لو في خطأ بتسجيل الدخول.
- المرحلة الثانية: البطولات والبونص هانت (الصفحات حالياً "قريباً").
