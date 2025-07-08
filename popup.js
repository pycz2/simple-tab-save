async function fetchSnapshots() {
  const { snapshots } = await browser.runtime.sendMessage({ action: 'getSnapshots' });
  return snapshots || [];
}

function renderSnapshotsList(snapshots) {
  const list = document.getElementById('snapshots-list');
  list.innerHTML = '';
  if (!snapshots.length) {
    list.innerHTML = '<li>Нет сохранённых снимков</li>';
    return;
  }
  snapshots.forEach((snap, idx) => {
    const li = document.createElement('li');
    li.textContent = `${snap.date} (${snap.tabs.length} вкладок)`;
    li.addEventListener('click', () => showSnapshotDetail(snap));
    list.appendChild(li);
  });
}

function showSnapshotsView() {
  document.getElementById('snapshots-view').classList.remove('hidden');
  document.getElementById('snapshot-detail').classList.add('hidden');
}

let currentSnapshot = null;
function showSnapshotDetail(snapshot) {
  currentSnapshot = snapshot;
  document.getElementById('snapshots-view').classList.add('hidden');
  document.getElementById('snapshot-detail').classList.remove('hidden');
  document.getElementById('detail-title').textContent = `Снимок от ${snapshot.date}`;
  const tabsList = document.getElementById('tabs-list');
  tabsList.innerHTML = '';
  snapshot.tabs.forEach(tab => {
    let li = document.createElement('li');
    let iconHtml = tab.favIconUrl ? `<img src="${tab.favIconUrl}" alt="icon" style="width:20px;height:20px;vertical-align:middle;margin-right:8px;border-radius:3px;box-shadow:0 1px 2px #aaa;">` : '';
    li.innerHTML = `${iconHtml}<b>${tab.title}</b><br>URL: <a href="${tab.url}" target="_blank">${tab.url}</a><br>Контейнер: ${tab.container}<br>Тип: ${tab.pinned ? 'Закреплена' : 'Обычная'}`;
    tabsList.appendChild(li);
  });
}

document.getElementById('restore-tabs').addEventListener('click', async () => {
  if (!currentSnapshot) return;
  if (!confirm('Восстановить все вкладки из этого снимка в текущем окне?')) return;
  try {
    const win = await browser.windows.getCurrent();
    await browser.runtime.sendMessage({ action: 'restoreTabs', snapshot: currentSnapshot, windowId: win.id });
  } catch (e) {
    alert('Ошибка при восстановлении: ' + e.message);
  }
});

document.getElementById('fetch-tabs').addEventListener('click', async () => {
  document.getElementById('fetch-tabs').disabled = true;
  document.getElementById('fetch-tabs').textContent = 'Сохраняю...';
  try {
    // Получаем windowId текущего окна popup
    const win = await browser.windows.getCurrent();
    const res = await browser.runtime.sendMessage({ action: 'getTabsInfo', windowId: win.id });
    if (res && res.success) {
      const snapshots = await fetchSnapshots();
      renderSnapshotsList(snapshots);
    } else {
      alert('Ошибка при сохранении: ' + (res && res.error ? res.error : 'Неизвестно'));
    }
  } catch (e) {
    alert('Ошибка: ' + e.message);
  }
  document.getElementById('fetch-tabs').disabled = false;
  document.getElementById('fetch-tabs').textContent = 'Сохранить текущие вкладки';
});

document.getElementById('back-btn').addEventListener('click', showSnapshotsView);

document.getElementById('clear-snapshots').addEventListener('click', async () => {
  if (!confirm('Удалить все сохранённые снимки?')) return;
  await browser.storage.local.set({ snapshots: [] });
  renderSnapshotsList([]);
});

// Инициализация
fetchSnapshots().then(renderSnapshotsList); 