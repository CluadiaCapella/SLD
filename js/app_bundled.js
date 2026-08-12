/**
 * Main Application Module Entry Point
 */
(function () {
  'use strict';

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (typeof initApp === 'function') initApp();
    });
  } else {
    if (typeof initApp === 'function') initApp();
  }
})();
