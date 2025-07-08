browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[background] Получено сообщение:', message);
  if (message.action === 'getTabsInfo') {
    (async () => {
      try {
        let windowId = undefined;
        if (message.windowId !== undefined) {
          windowId = message.windowId;
          console.log('[background] Использую windowId из message:', windowId);
        }
        let currentWindow = null;
        if (windowId !== undefined) {
          currentWindow = await browser.windows.get(windowId);
        } else {
          const windows = await browser.windows.getAll({windowTypes: ['normal'], populate: false});
          console.log('[background] Окна:', windows);
          currentWindow = windows[0];
        }
        if (!currentWindow) {
          console.log('[background] Нет активного окна');
          sendResponse(['Нет активного окна']);
          return;
        }
        const tabs = await browser.tabs.query({ windowId: currentWindow.id });
        console.log('[background] Вкладки:', tabs);
        let containers = [];
        if (browser.contextualIdentities) {
          containers = await browser.contextualIdentities.query({});
          console.log('[background] Контейнеры:', containers);
        }
        const containerMap = {};
        for (const c of containers) {
          containerMap[c.cookieStoreId] = c.name;
        }
        // Формируем снимок для сохранения
        const snapshotTabs = tabs.map(tab => ({
          title: tab.title,
          url: tab.url,
          pinned: !!tab.pinned,
          container: containerMap[tab.cookieStoreId] || 'Без контейнера'
        }));
        const snapshot = {
          id: Date.now(),
          date: new Date().toLocaleString(),
          tabs: snapshotTabs
        };
        // Сохраняем снимок в storage.local
        const prev = await browser.storage.local.get('snapshots');
        const snapshots = Array.isArray(prev.snapshots) ? prev.snapshots : [];
        snapshots.push(snapshot);
        await browser.storage.local.set({ snapshots });
        console.log('[background] Снимок сохранён:', snapshot);
        sendResponse({ success: true });
      } catch (e) {
        console.error('[background] Ошибка:', e);
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }
  if (message.action === 'getSnapshots') {
    browser.storage.local.get('snapshots').then(data => {
      sendResponse({ snapshots: Array.isArray(data.snapshots) ? data.snapshots : [] });
    });
    return true;
  }
}); 