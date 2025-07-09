browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[background] Получено сообщение:', message, 'sender:', sender);
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
          console.log('[background] Получено окно по windowId:', currentWindow);
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
          container: containerMap[tab.cookieStoreId] || 'Без контейнера',
          favIconUrl: tab.favIconUrl || ''
        }));
        // Формируем дату в формате dd.mm.yy HH:MM
        const now = new Date();
        const pad = n => n.toString().padStart(2, '0');
        const dateStr = `${pad(now.getDate())}.${pad(now.getMonth()+1)}.${now.getFullYear().toString().slice(-2)} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
        const snapshot = {
          id: Date.now(),
          date: dateStr,
          tabs: snapshotTabs,
          name: message.name && message.name.trim() ? message.name : 'NoName'
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
    console.log('[background] Получен запрос getSnapshots');
    browser.storage.local.get('snapshots').then(data => {
      console.log('[background] Отправляю snapshots:', data.snapshots);
      sendResponse({ snapshots: Array.isArray(data.snapshots) ? data.snapshots : [] });
    });
    return true;
  }
  if (message.action === 'restoreTabs') {
    (async () => {
      try {
        const { snapshot } = message;
        console.log('[background] Восстановление вкладок из snapshot:', snapshot);
        if (!snapshot || !Array.isArray(snapshot.tabs)) throw new Error('Нет данных для восстановления');
        // Создаём новое окно
        let newWin = null;
        try {
          newWin = await browser.windows.create({
            titlePreface: "TabSave",
            focused: true,
            url: "https://google.com",
            incognito: false,
          });
          console.log('[background] Создано новое окно:', newWin);
        } catch (winErr) {
          console.error('[background] Ошибка при создании окна:', winErr);
          sendResponse({ success: false, error: 'Ошибка при создании окна: ' + winErr.message });
          return;
        }
        const windowId = newWin.id;
        const firstTabId = newWin.tabs && newWin.tabs.length ? newWin.tabs[0].id : null;
        // Сначала закреплённые, потом обычные
        const pinnedTabs = snapshot.tabs.filter(tab => !!tab.pinned);
        const unpinnedTabs = snapshot.tabs.filter(tab => !tab.pinned);
        for (const tab of [...pinnedTabs, ...unpinnedTabs]) {
          let createProps = {
            windowId: windowId,
            url: tab.url,
            pinned: !!tab.pinned
          };
          console.log('[background] Готовлюсь создать вкладку:', createProps, 'контейнер:', tab.container);
          // Найти id контейнера по имени, если есть
          if (tab.container && tab.container !== 'Без контейнера' && browser.contextualIdentities) {
            const containers = await browser.contextualIdentities.query({});
            const found = containers.find(c => c.name === tab.container);
            if (found) {
              createProps.cookieStoreId = found.cookieStoreId;
              console.log('[background] Добавлен cookieStoreId:', found.cookieStoreId);
            } else {
              console.warn('[background] Контейнер не найден:', tab.container);
            }
          }
          try {
            await browser.tabs.create(createProps);
            console.log('[background] Вкладка создана:', createProps);
          } catch (tabErr) {
            console.error('[background] Ошибка при создании вкладки:', createProps, tabErr);
          }
        }
        // Закрываем первую вкладку, если она есть
        if (firstTabId) {
          try {
            await browser.tabs.remove(firstTabId);
            console.log('[background] Первая вкладка нового окна закрыта:', firstTabId);
          } catch (closeErr) {
            console.error('[background] Ошибка при закрытии первой вкладки:', closeErr);
          }
        }
        console.log('[background] Восстановление вкладок завершено успешно');
        sendResponse({ success: true });
      } catch (e) {
        console.error('[background] Ошибка восстановления:', e);
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }
}); 