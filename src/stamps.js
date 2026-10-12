// Метки изменений для синхронизации между устройствами.
// Для каждой записи (книга в библиотеке, закладка, заметка, книга в списках) помним отпечаток
// содержимого и время последнего изменения; удалённая запись остаётся «надгробием», чтобы
// удаление дошло до других устройств. Код, который меняет данные, ничего об этом не знает:
// после сохранения app.js отдаёт сюда текущее состояние, а изменения находятся сравнением.
(function (global) {
  'use strict';

  const KEY = 'lampa.stamps';
  let state = load();

  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      return s && typeof s === 'object' ? s : {};
    } catch {
      return {};
    }
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      // переполнение хранилища — метки пересчитаются при следующем сохранении
    }
  }

  // Отпечаток содержимого записи — заметить, что она изменилась.
  function fingerprint(rec) {
    const s = JSON.stringify(rec);
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return (h >>> 0).toString(36) + '.' + s.length.toString(36);
  }

  // records: { id: запись }. Новые и изменённые записи получают время now, пропавшие — надгробие.
  function stamp(kind, records, now = Date.now()) {
    const table = state[kind] || (state[kind] = {});
    let changed = false;
    for (const id of Object.keys(records)) {
      const h = fingerprint(records[id]);
      const s = table[id];
      if (!s || s.h !== h || s.del) {
        table[id] = { h, t: now };
        changed = true;
      }
    }
    for (const id of Object.keys(table)) {
      if (!(id in records) && !table[id].del) {
        table[id] = { h: '', t: now, del: true };
        changed = true;
      }
    }
    if (changed) save();
    return changed;
  }

  // Запись пришла с другого устройства: запоминаем её время, чтобы не отправить её обратно как новую.
  function accept(kind, id, rec, t, del) {
    const table = state[kind] || (state[kind] = {});
    table[id] = del ? { h: '', t, del: true } : { h: fingerprint(rec), t };
    save();
  }

  const get = (kind, id) => (state[kind] && state[kind][id]) || null;
  const table = (kind) => state[kind] || {};

  // Изменения после момента since — что отправить в облако.
  function changedSince(kind, since) {
    return Object.entries(table(kind))
      .filter(([, s]) => s.t > since)
      .map(([id, s]) => ({ id, t: s.t, del: !!s.del }));
  }

  // Постоянный идентификатор этого устройства: видно, откуда пришло изменение.
  function deviceId() {
    let id = localStorage.getItem('lampa.device');
    if (!id) {
      id = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
      try {
        localStorage.setItem('lampa.device', id);
      } catch {}
    }
    return id;
  }

  global.Stamps = { stamp, accept, get, table, changedSince, deviceId, fingerprint };
})(window);
