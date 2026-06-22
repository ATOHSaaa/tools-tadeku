(function (global) {
  function createLibrarySession(editorId, getContent, options) {
    const P = global.TadekuEditorPrefs;
    const debounceMs = options?.debounceMs ?? 400;
    let sessionDocId = null;
    let lastSavedTitle = '';
    let saveTimer = null;
    let saving = false;
    let pending = false;

    function hasContent({ title, body }) {
      return Boolean((title && title.length) || (body && body.length));
    }

    // 衝突でリネームされた場合のみ通知。入力中（タイトル欄にフォーカス）は
    // カーソルを乱さないよう書き戻さず、フォーカスが外れたときに反映する。
    function notifyRename(userTitle, resolvedTitle) {
      if (!options?.onTitleResolved) return;
      if (!userTitle) return;
      if (resolvedTitle === userTitle) return;
      options.onTitleResolved(resolvedTitle);
    }

    async function persist() {
      if (!P) return;
      if (saving) {
        pending = true;
        return;
      }
      saving = true;
      pending = false;

      try {
        const { title, body } = getContent() || {};
        if (!hasContent({ title, body })) return;

        const userTitle = (title || '').trim();

        if (!sessionDocId) {
          let storedTitle = '';
          if (userTitle) {
            storedTitle = await P.resolveUniqueTitle(title, null);
          }
          const doc = await P.saveDocument({ editorId, title: storedTitle, body });
          sessionDocId = doc.id;
          lastSavedTitle = storedTitle;
          notifyRename(userTitle, storedTitle);
        } else {
          let storedTitle = '';
          if (userTitle) {
            storedTitle = await P.resolveUniqueTitle(title, sessionDocId);
          }
          await P.updateDocument(sessionDocId, { editorId, title: storedTitle, body });
          notifyRename(userTitle, storedTitle);
          lastSavedTitle = storedTitle;
        }

        P.syncDraftMeta(editorId, {
          charCount: (body || '').length,
          title: lastSavedTitle,
        });
        options?.onSaved?.();
      } catch (err) {
        console.error('Library auto-save failed:', err);
        options?.onError?.(err);
      } finally {
        saving = false;
        if (pending) persist();
      }
    }

    function scheduleSave() {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        persist();
      }, debounceMs);
    }

    function resetSession() {
      sessionDocId = null;
      lastSavedTitle = '';
      clearTimeout(saveTimer);
    }

    async function openDocument(docId) {
      if (!P || !docId) return false;
      const doc = await P.getDocument(docId);
      if (!doc) return false;
      sessionDocId = doc.id;
      lastSavedTitle = doc.title || '';
      options?.onLoad?.({
        title: doc.title || '',
        body: doc.body || '',
      });
      return true;
    }

    return {
      scheduleSave,
      resetSession,
      flush: persist,
      openDocument,
    };
  }

  global.TadekuEditorLibrary = {
    createLibrarySession,
  };
})(typeof window !== 'undefined' ? window : globalThis);
