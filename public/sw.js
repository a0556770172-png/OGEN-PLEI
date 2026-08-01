// Service Worker מינימלי שתפקידו היחיד הוא לקבל אירועי Push מהשרת ולהציג אותם כהתראת
// דפדפן אמיתית - גם כשהאתר עצמו סגור/לא פתוח בשום טאב. זה מה שמאפשר להתראות "לצאת" מהדפדפן.
self.addEventListener("push", function (event) {
  let data = { title: "עוגן פליי", body: "יש עדכון חדש באתר" };
  try {
    if (event.data) data = event.data.json();
  } catch (e) {}

  const title = data.title || "עוגן פליי";
  const options = {
    body: data.body || "",
    icon: "/logo-512.png",
    badge: "/logo-512.png",
    dir: "rtl",
    lang: "he",
    data: { url: data.url || "/" }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clientList) {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
