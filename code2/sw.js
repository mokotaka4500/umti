// ===================================================
// sw.js (新規ファイルとして index.html と同じ場所に保存)
// ===================================================

// 1. サーバーからプッシュメッセージを受信したときの処理
self.addEventListener('push', event => {
    let data = { title: 'ライフ・オーガナイザー', body: '新しい通知があります。' };

    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            data = { title: 'ライフ・オーガナイザー', body: event.data.text() };
        }
    }

    const options = {
        body: data.body,
        icon: 'icons/icon-192x192.png',
        badge: 'icons/icon-192x192.png',
        data: {
            url: data.url || './'
        }
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// ===================================================
// sw.js
// ===================================================

// バックグラウンドでスケジュールされた通知を受け取るイベント
self.addEventListener('publish', event => {
    // 従来のプッシュサーバーからの受信ロジック（既存）
});

// 通知クリック時の動作（既存）
self.addEventListener('notificationclick', event => {
    event.notification.close();
    const targetUrl = event.notification.data.url;
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];
                if (client.url.includes(targetUrl) && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});