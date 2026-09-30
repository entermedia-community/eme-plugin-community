
self.addEventListener('push', function (event) {

    let notificationData = {
        title: 'Default Title',
        body: 'Default Body Message',
        icon: '/favicon.ico'
    };

    if (event.data) {
        // Log the raw text to inspect what Java sent over the wire
        const rawText = event.data.text();

        try {
            const json = event.data.json();

            // Extract fields (fallbacks handle varied JSON key names)
            notificationData.title = json.title || json.name || json.topic || notificationData.title;
            notificationData.body = json.body || json.message || json.text || notificationData.body;
            if (json.icon) notificationData.icon = json.icon;
        } catch (e) {
            console.warn('[SW] Could not parse payload as JSON, using raw text');
            notificationData.body = rawText;
        }
    }

    const promiseChain = self.registration.showNotification(
        notificationData.title, 
        {
            body: notificationData.body,
            icon: notificationData.icon,
            badge: '/embadge.png',
            data: event.data ? event.data.text() : null
        }
    );

    event.waitUntil(promiseChain);
});

self.addEventListener('install', (event) => {
    // Skip waiting phase and activate immediately
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    // Take control of all uncontrolled clients immediately
    event.waitUntil(self.clients.claim());
});
