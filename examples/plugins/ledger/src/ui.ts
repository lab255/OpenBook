/** Public host CSS classes: this local map also works in a zip-installed plugin. */
export const ui = {
  frame: 'obe-ui-frame', title: 'obe-ui-title', header: 'obe-ui-header', muted: 'obe-ui-muted', eyebrow: 'obe-ui-eyebrow',
  labelled: 'obe-ui-labelled', field: 'obe-ui-field', btn: 'obe-ui-btn', check: 'obe-ui-check', fieldset: 'obe-ui-fieldset', file: 'obe-ui-file',
  chip: 'obe-ui-chip', notice: 'obe-ui-notice', noticeDetail: 'obe-ui-notice-detail', tableWrap: 'obe-ui-table-wrap', table: 'obe-ui-table',
  num: 'obe-ui-num', total: 'obe-ui-total', section: 'obe-ui-section', pinStart: 'obe-ui-pin-start', pinEnd: 'obe-ui-pin-end',
  list: 'obe-ui-list', srOnly: 'obe-ui-sr-only', row: 'obe-ui-row', stack: 'obe-ui-stack',
} as const;
export type NoticeTone = 'alarm' | 'info' | 'quiet';
