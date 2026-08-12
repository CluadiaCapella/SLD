/**
 * DOMContentLoaded App Bootstrap Coordinator
 */

async function startAppBootstrap() {
  if (typeof loadHtmlComponents === 'function') {
    await loadHtmlComponents();
  }
  if (typeof initApp === 'function') {
    initApp();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startAppBootstrap);
} else {
  startAppBootstrap();
}
