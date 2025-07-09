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
  const template = document.getElementById('snapshot-item-template');
  snapshots.forEach((snap, idx) => {
    const li = template.content.firstElementChild.cloneNode(true);
    // Имя и количество вкладок на первой строке, дата — на второй
    let labelHtml = '';
    labelHtml += `<span class='snapshot-label-name'>${snap.name || 'NoName'}</span>`;
    labelHtml += ` <span class='snapshot-label-count'>(${snap.tabs.length})</span>`;
    labelHtml += `<br><span class='snapshot-label-date'>${snap.date}</span>`;
    li.querySelector('.snapshot-label').innerHTML = labelHtml;
    li.onclick = () => showSnapshotDetail(snap);
    // Кнопка удалить
    li.querySelector('.delete-snapshot-btn').onclick = async (e) => {
      e.stopPropagation();
      if (!confirm('Удалить это сохранение?')) return;
      const { snapshots: all } = await browser.runtime.sendMessage({ action: 'getSnapshots' });
      const filtered = all.filter(s => s.id !== snap.id);
      await browser.storage.local.set({ snapshots: filtered });
      renderSnapshotsList(filtered);
    };
    // Кнопка редактировать имя
    const editBtn = li.querySelector('.edit-name-btn');
    const saveBtn = li.querySelector('.save-name-btn');
    const input = li.querySelector('.edit-name-input');
    editBtn.onclick = (e) => {
      e.stopPropagation();
      input.value = snap.name || '';
      input.style.display = 'inline-block';
      saveBtn.style.display = 'inline-block';
      editBtn.style.display = 'none';
      li.querySelector('.snapshot-label').style.display = 'none';
      input.focus();
    };
    // Сохранить новое имя
    saveBtn.onclick = async (e) => {
      e.stopPropagation();
      const newName = input.value.trim();
      const { snapshots: all } = await browser.runtime.sendMessage({ action: 'getSnapshots' });
      const updated = all.map(s => s.id === snap.id ? { ...s, name: newName } : s);
      await browser.storage.local.set({ snapshots: updated });
      renderSnapshotsList(updated);
    };
    // Enter в input сохраняет
    input.onkeydown = (e) => {
      if (e.key === 'Enter') saveBtn.onclick(e);
      if (e.key === 'Escape') {
        input.style.display = 'none';
        saveBtn.style.display = 'none';
        editBtn.style.display = 'inline-block';
        li.querySelector('.snapshot-label').style.display = 'inline-block';
      }
    };
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
  document.getElementById('detail-title').textContent = snapshot.name ? `Сохранение: ${snapshot.name}` : `Снимок от ${snapshot.date}`;
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
    const win = await browser.windows.getCurrent();
    const name = document.getElementById('snapshot-name').value.trim();
    const res = await browser.runtime.sendMessage({ action: 'getTabsInfo', windowId: win.id, name });
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