self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data = {};
  try {
    data = event.data.json();
  } catch {
    data = { title: "GRCC Dashboard", body: event.data.text() };
  }

  const options = {
    body: data.body || "",
    icon: "/logo.svg",
    badge: "/logo.svg",
    tag: data.tag || "grcc-notif",
    data: { url: data.url || "/dashboard" },
    requireInteraction: false,
  };

  event.waitUntil(
    self.registration.showNotification(data.title || "GRCC Dashboard", options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/dashboard", self.location.origin).href;
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.startsWith(self.location.origin) && "focus" in client) {
            if ("navigate" in client) {
              return client.navigate(url).then(c => c?.focus());
            }
            return client.focus();
          }
        }
        return clients.openWindow(url);
      })
  );
});
