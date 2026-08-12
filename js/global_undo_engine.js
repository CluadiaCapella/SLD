/**
 * Global Undo History Subsystem
 */

const undoStack = [];

async function triggerGlobalUndo() {
  if (undoStack.length === 0) {
    alert('Nothing to undo.');
    return;
  }
  const lastAction = undoStack.pop();
  if (lastAction && lastAction.undoFn) {
    await lastAction.undoFn();
    await loadAppState();
    renderCurrentView();
  }
}

window.undoStack = undoStack;
window.triggerGlobalUndo = triggerGlobalUndo;
