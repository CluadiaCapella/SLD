/**
 * Runtime Window Error & Promise Rejection Handlers
 */

window.addEventListener('error', (event) => {
  if (event.message === 'Script error.' && !event.filename && !event.lineno) return;
  if (typeof logSystemError === 'function') {
    logSystemError('JS Error', event.message, event.filename, event.lineno, event.colno, event.error?.stack);
  }
});

window.addEventListener('unhandledrejection', (event) => {
  const msg = event.reason?.message || String(event.reason || 'Unhandled Promise Rejection');
  const stack = event.reason?.stack || '';
  if (typeof logSystemError === 'function') {
    logSystemError('Unhandled Promise Rejection', msg, '', 0, 0, stack);
  }
});
