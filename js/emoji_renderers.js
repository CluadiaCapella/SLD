/**
 * Emoji Badges & Count Display Renderers
 */

function renderSubjectEmojiCounts(count) {
  if (!count || count <= 0) return '';
  if (count === 1) return '💦';
  if (count === 2) return '💦💦';
  return '💦💦<span style="opacity:0.5;" title="2.5 Max Faded Count">💦</span>';
}

window.renderSubjectEmojiCounts = renderSubjectEmojiCounts;
