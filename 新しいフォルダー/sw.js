const CACHE_NAME = 'timematch-v5'; // 🆕 バージョンを更新して変更を検知させます[cite: 3]
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json',
    './img/icon.png'
];

// インストール時にファイルをキャッシュに保存[cite: 3]
self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
    self.skipWaiting(); // 🆕 新しいサービスワーカーを即座に有効化[cite: 3]
});

// オフライン時でもキャッシュからページを表示[cite: 3]
self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then((response) => {
            return response || fetch(e.request);
        })
    );
});

// ==========================================
// 🆕 バックグラウンド通知制御 (10分前)
// ==========================================

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SCHEDULE_NOTIFICATION') {
        const { id, title, triggerTime, body } = event.data.payload;

        // Notification Triggers (Show Trigger API) が対応しているブラウザの場合
        if ('showTrigger' in Notification.prototype) {
            self.registration.showNotification(title, {
                body: body,
                icon: './img/icon.png',
                tag: `event-${id}`,
                // OSレベルでバックグラウンド時間指定通知を予約
                showTrigger: new TimestampTrigger(triggerTime) 
            }).then(() => {
                console.log(`[SW] Notification Triggerで10分前通知を予約しました: ${title}`);
            }).catch(err => {
                console.error('[SW] Notification Trigger登録エラー:', err);
            });
        } else {
            // 未対応ブラウザ向けの擬似バックグラウンドフォールバック
            scheduleFallbackTimeout(id, title, triggerTime, body);
        }
    }
});

// 非対応環境用のメモリ内タイマー管理
const activeTimers = new Map();

function scheduleFallbackTimeout(id, title, triggerTime, body) {
    if (activeTimers.has(id)) {
        clearTimeout(activeTimers.get(id));
    }

    const delay = triggerTime - Date.now();
    if (delay <= 0) return;

    const timer = setTimeout(() => {
        self.registration.showNotification(title, {
            body: body,
            icon: './img/icon.png',
            vibrate: [200, 100, 200],
            tag: `event-${id}`
        });
        activeTimers.delete(id);
    }, delay);

    activeTimers.set(id, timer);
}