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

  // records: { id: запись }. Изменённые записи получают время now, пропавшие — надгробие.
  // Запись, которой здесь ещё не видели, получает своё настоящее время (since(запись): когда открыта,
  // создана, добавлена): иначе при первом включении синхронизации старые данные этого устройства
  // выглядели бы новее свежих изменений с другого.
  function stamp(kind, records, since, now = Date.now()) {
    const table = state[kind] || (state[kind] = {});
    let changed = false;
    for (const id of Object.keys(records)) {
      const h = fingerprint(records[id]);
      const s = table[id];
      if (!s || s.h !== h || s.del) {
        const t = s ? now : Math.min(now, (since && since(records[id])) || now);
        table[id] = { h, t };
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

  // Запись пришла с другого устройства: запоминаем её время и отпечаток в том виде, как она теперь
  // лежит здесь, — она не уйдёт обратно как новая, пока её не изменят на этом устройстве (r — «с сервера»).
  function accept(kind, id, rec, t, del) {
    const table = state[kind] || (state[kind] = {});
    table[id] = del ? { h: '', t, del: true, r: true } : { h: fingerprint(rec), t, r: true };
    save();
  }

  const get = (kind, id) => (state[kind] && state[kind][id]) || null;
  const table = (kind) => state[kind] || {};

  // Что ещё не отправлено в облако (пришедшее с сервера не отправляем).
  function pending(kind) {
    return Object.entries(table(kind))
      .filter(([, s]) => !s.p && !s.r)
      .map(([id, s]) => ({ id, t: s.t, del: !!s.del, h: s.h }));
  }

  // Отправлено. Если запись успела измениться, пока шла отправка, — она остаётся в очереди.
  function markPushed(kind, sent) {
    const tbl = table(kind);
    for (const x of sent) {
      const s = tbl[x.id];
      if (s && s.t === x.t && s.h === x.h) s.p = true;
    }
    save();
  }

  // Выход из аккаунта: всё снова считается неотправленным — для следующего входа.
  function resetPushed() {
    for (const tbl of Object.values(state)) for (const s of Object.values(tbl)) delete s.p;
    save();
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

  global.Stamps = { stamp, accept, get, table, pending, markPushed, resetPushed, deviceId, fingerprint };
})(window);
