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

// 2. 通知がクリックされたときの処理
self.addEventListener('notificationclick', event => {
    event.notification.close(); // 通知を閉じる

    const targetUrl = event.notification.data.url;

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
            // すでにアプリが開いていればフォーカス、なければ新しく開く
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