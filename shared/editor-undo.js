(function (global) {
  function cloneState(state) {
    if (typeof structuredClone === 'function') {
      return structuredClone(state);
    }
    return JSON.parse(JSON.stringify(state));
  }

  function createStack({ limit = 200 } = {}) {
    const undoStack = [];
    const redoStack = [];
    let applying = false;

    function push(getState) {
      if (applying) return;
      undoStack.push(cloneState(getState()));
      if (undoStack.length > limit) undoStack.shift();
      redoStack.length = 0;
    }

    function undo(getState, setState) {
      if (!undoStack.length) return false;
      applying = true;
      redoStack.push(cloneState(getState()));
      setState(undoStack.pop());
      applying = false;
      return true;
    }

    function redo(getState, setState) {
      if (!redoStack.length) return false;
      applying = true;
      undoStack.push(cloneState(getState()));
      setState(redoStack.pop());
      applying = false;
      return true;
    }

    function reset() {
      undoStack.length = 0;
      redoStack.length = 0;
    }

    return {
      push,
      undo,
      redo,
      reset,
      get applying() {
        return applying;
      },
    };
  }

  function isUndoKey(e) {
    return (e.metaKey || e.ctrlKey) && !e.altKey && (e.key === 'z' || e.key === 'Z') && !e.shiftKey;
  }

  function isRedoKey(e) {
    if (!(e.metaKey || e.ctrlKey) || e.altKey) return false;
    if ((e.key === 'z' || e.key === 'Z') && e.shiftKey) return true;
    if ((e.key === 'y' || e.key === 'Y') && !e.shiftKey) return true;
    return false;
  }

  function tryHandleKey(e, stack, getState, setState) {
    if (e.isComposing) return false;
    if (isUndoKey(e)) {
      if (stack.undo(getState, setState)) {
        e.preventDefault();
        return true;
      }
      return false;
    }
    if (isRedoKey(e)) {
      if (stack.redo(getState, setState)) {
        e.preventDefault();
        return true;
      }
      return false;
    }
    return false;
  }

  global.TadekuEditorUndo = {
    createStack,
    isUndoKey,
    isRedoKey,
    tryHandleKey,
  };
})(typeof window !== 'undefined' ? window : globalThis);
