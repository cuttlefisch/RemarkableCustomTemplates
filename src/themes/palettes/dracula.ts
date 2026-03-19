import type { Theme } from '../themes'

export const dracula: Theme = {
  id: 'dracula',
  name: 'Dracula',
  group: 'dark',
  tokens: {
    /* Surface / Background */
    '--color-page-bg': '#1e1f29',
    '--color-sidebar-bg': '#282a36',
    '--color-sidebar-border': '#44475a',
    '--color-sidebar-header-border': '#44475a',
    '--color-sidebar-item-hover-bg': '#44475a',
    '--color-sidebar-item-active-bg': '#3d3f50',
    '--color-navbar-bg': '#282a36',
    '--color-navbar-border': '#44475a',
    '--color-card-bg': '#282a36',
    '--color-card-title-bg': '#2d2f3d',
    '--color-card-border': '#44475a',
    '--color-editor-bg': '#282a36',
    '--color-editor-toolbar-bg': '#2d2f3d',
    '--color-editor-border': '#44475a',
    '--color-preview-bg': '#1e1f29',
    '--color-preview-meta-bg': '#282a36',
    '--color-preview-meta-border': '#44475a',

    /* Text */
    '--color-text-primary': '#f8f8f2',
    '--color-text-secondary': '#bfbfbf',
    '--color-text-muted': '#6272a4',
    '--color-text-hint': '#6272a4',
    '--color-text-sidebar': '#f8f8f2',
    '--color-text-sidebar-title': '#bfbfbf',
    '--color-text-sidebar-count-fg': '#bfbfbf',
    '--color-text-sidebar-count-bg': '#44475a',
    '--color-text-sidebar-hint': '#6272a4',
    '--color-text-sidebar-group-label': '#6272a4',
    '--color-text-editor': '#f8f8f2',
    '--color-text-navbar': '#bfbfbf',
    '--color-text-navbar-hover': '#f8f8f2',
    '--color-text-navbar-active': '#bd93f9',
    '--color-text-template-btn': '#bfbfbf',
    '--color-text-template-btn-hover': '#f8f8f2',
    '--color-text-template-btn-selected': '#bd93f9',

    /* Borders */
    '--color-border-dark': '#44475a',
    '--color-border-separator': '#44475a',
    '--color-border-card': '#44475a',
    '--color-border-light': '#3d3f50',
    '--color-border-input': '#44475a',
    '--color-border-section': '#3d3f50',

    /* Accent */
    '--color-accent': '#bd93f9',
    '--color-accent-hover': '#caa8fc',
    '--color-accent-bg': 'rgba(189, 147, 249, 0.15)',
    '--color-accent-border': '#bd93f9',
    '--color-accent-text': '#bd93f9',
    '--color-accent-text-light': '#caa8fc',

    /* Sidebar buttons */
    '--color-sidebar-btn-bg': '#44475a',
    '--color-sidebar-btn-border': '#555872',
    '--color-sidebar-btn-text': '#bfbfbf',
    '--color-sidebar-btn-hover-bg': '#555872',
    '--color-sidebar-btn-hover-text': '#f8f8f2',
    '--color-sidebar-btn-active-bg': 'rgba(189, 147, 249, 0.2)',
    '--color-sidebar-btn-active-border': '#bd93f9',
    '--color-sidebar-btn-active-text': '#bd93f9',

    /* Navbar link states */
    '--color-navbar-hover-bg': '#44475a',
    '--color-navbar-active-bg': 'rgba(189, 147, 249, 0.15)',

    /* Buttons */
    '--color-btn-primary-bg': '#bd93f9',
    '--color-btn-primary-text': '#282a36',
    '--color-btn-primary-hover': '#caa8fc',
    '--color-btn-secondary-bg': '#44475a',
    '--color-btn-secondary-text': '#f8f8f2',
    '--color-btn-secondary-border': '#555872',
    '--color-btn-secondary-hover': '#555872',
    '--color-btn-danger-bg': '#ff5555',
    '--color-btn-danger-text': '#282a36',
    '--color-btn-danger-hover': '#ff6e6e',

    /* Editor buttons */
    '--color-editor-apply-bg': 'rgba(189, 147, 249, 0.15)',
    '--color-editor-apply-border': '#bd93f9',
    '--color-editor-apply-text': '#bd93f9',
    '--color-editor-apply-hover': 'rgba(189, 147, 249, 0.25)',
    '--color-editor-close-bg': '#44475a',
    '--color-editor-close-border': '#555872',
    '--color-editor-close-text': '#bfbfbf',
    '--color-editor-close-hover-bg': '#555872',
    '--color-editor-close-hover-text': '#f8f8f2',

    /* Edit JSON button */
    '--color-edit-btn-bg': '#44475a',
    '--color-edit-btn-border': '#555872',
    '--color-edit-btn-text': '#bfbfbf',
    '--color-edit-btn-hover-bg': 'rgba(189, 147, 249, 0.15)',
    '--color-edit-btn-hover-border': '#bd93f9',
    '--color-edit-btn-hover-text': '#bd93f9',
    '--color-edit-btn-active-bg': 'rgba(189, 147, 249, 0.25)',
    '--color-edit-btn-active-border': '#bd93f9',
    '--color-edit-btn-active-text': '#bd93f9',

    /* New template create button */
    '--color-create-btn-bg': 'rgba(189, 147, 249, 0.15)',
    '--color-create-btn-border': '#bd93f9',
    '--color-create-btn-text': '#bd93f9',
    '--color-create-btn-hover': 'rgba(189, 147, 249, 0.25)',

    /* Sidebar form inputs */
    '--color-sidebar-input-bg': '#1e1f29',
    '--color-sidebar-input-border': '#44475a',
    '--color-sidebar-input-text': '#f8f8f2',
    '--color-sidebar-input-placeholder': '#6272a4',

    /* Status */
    '--color-success-bg': 'rgba(80, 250, 123, 0.15)',
    '--color-success-border': '#50fa7b',
    '--color-success-text': '#50fa7b',
    '--color-error-bg': 'rgba(255, 85, 85, 0.15)',
    '--color-error-border': '#ff5555',
    '--color-error-text': '#ff5555',
    '--color-warning-text': '#f1fa8c',
    '--color-error-hint-text': '#ff6e6e',
    '--color-connected-dot': '#50fa7b',
    '--color-error-dot': '#ff5555',
    '--color-unknown-dot': '#6272a4',

    /* Sidebar error */
    '--color-sidebar-error-bg': 'rgba(255, 85, 85, 0.15)',
    '--color-sidebar-error-text': '#ff5555',
    '--color-sidebar-error-border': '#ff5555',

    /* Editor error */
    '--color-editor-error-bg': 'rgba(255, 85, 85, 0.15)',
    '--color-editor-error-text': '#ff5555',
    '--color-editor-error-border': '#ff5555',

    /* Import prompt */
    '--color-import-prompt-bg': 'rgba(189, 147, 249, 0.15)',
    '--color-import-prompt-border': '#bd93f9',
    '--color-import-prompt-text': '#caa8fc',
    '--color-import-prompt-strong': '#f8f8f2',
    '--color-import-prompt-code-bg': 'rgba(189, 147, 249, 0.2)',
    '--color-import-prompt-code-text': '#bd93f9',

    /* Tags */
    '--color-tag-p-bg': 'rgba(139, 233, 253, 0.15)',
    '--color-tag-p-text': '#8be9fd',
    '--color-tag-ls-bg': 'rgba(255, 121, 198, 0.15)',
    '--color-tag-ls-text': '#ff79c6',
    '--color-tag-cat-bg': '#44475a',
    '--color-tag-cat-text': '#bfbfbf',
    '--color-tag-file-bg': '#44475a',
    '--color-tag-file-text': '#6272a4',
    '--color-tag-custom-bg': 'rgba(255, 184, 108, 0.15)',
    '--color-tag-custom-text': '#ffb86c',
    '--color-tag-cat-hover-bg': '#555872',
    '--color-tag-cat-active-bg': 'rgba(189, 147, 249, 0.15)',
    '--color-tag-cat-active-text': '#bd93f9',
    '--color-tag-p-hover-bg': 'rgba(139, 233, 253, 0.25)',
    '--color-tag-ls-hover-bg': 'rgba(255, 121, 198, 0.25)',
    '--color-tag-p-active-bg': 'rgba(139, 233, 253, 0.35)',
    '--color-tag-ls-active-bg': 'rgba(255, 121, 198, 0.35)',

    /* Orientation badges */
    '--color-orient-p-bg': 'rgba(139, 233, 253, 0.15)',
    '--color-orient-p-text': '#8be9fd',
    '--color-orient-ls-bg': 'rgba(255, 121, 198, 0.15)',
    '--color-orient-ls-text': '#ff79c6',
    '--color-orient-custom-bg': 'rgba(255, 184, 108, 0.15)',
    '--color-orient-custom-text': '#ffb86c',

    /* Sync badges */
    '--color-sync-synced-bg': 'rgba(80, 250, 123, 0.15)',
    '--color-sync-synced-text': '#50fa7b',
    '--color-sync-local-bg': 'rgba(139, 233, 253, 0.15)',
    '--color-sync-local-text': '#8be9fd',
    '--color-sync-modified-bg': 'rgba(241, 250, 140, 0.15)',
    '--color-sync-modified-text': '#f1fa8c',
    '--color-sync-device-bg': '#44475a',
    '--color-sync-device-text': '#bfbfbf',

    /* Forms */
    '--color-form-input-bg': '#1e1f29',
    '--color-form-input-border': '#44475a',
    '--color-form-input-text': '#f8f8f2',
    '--color-form-label': '#f8f8f2',
    '--color-form-focus-ring': 'rgba(189, 147, 249, 0.3)',

    /* Help / callout */
    '--color-help-bg': 'rgba(189, 147, 249, 0.1)',
    '--color-help-border': '#bd93f9',
    '--color-help-text': '#caa8fc',
    '--color-help-code-bg': 'rgba(189, 147, 249, 0.2)',

    /* Remove-all preview */
    '--color-remove-preview-bg': 'rgba(255, 85, 85, 0.1)',
    '--color-remove-preview-border': 'rgba(255, 85, 85, 0.3)',
    '--color-remove-list-text': '#f8f8f2',

    /* SVG preview */
    '--color-svg-shadow': 'rgba(0, 0, 0, 0.4)',
    '--color-svg-border': '#44475a',

    /* Scrollbar */
    '--color-scrollbar-track': 'transparent',
    '--color-scrollbar-thumb': '#44475a',

    /* Stage */
    '--color-stage-hint': '#6272a4',
    '--color-stage-error': '#ff5555',

    /* Filter clear */
    '--color-filter-clear': '#6272a4',
    '--color-filter-clear-hover': '#ff5555',

    /* Progress */
    '--color-progress-bar-bg': '#44475a',
    '--color-progress-fill': '#bd93f9',
    '--color-progress-label': '#6272a4',
    '--color-progress-tip': '#6272a4',

    /* Connection badge */
    '--color-connection-badge-bg': '#44475a',
    '--color-connection-badge-text': '#bfbfbf',
    '--color-connection-detail': '#6272a4',

    /* Card code */
    '--color-card-code-bg': '#1e1f29',
    '--color-card-code-text': '#f8f8f2',

    /* Device op */
    '--color-op-desc': '#6272a4',
    '--color-op-result-success': '#50fa7b',
    '--color-op-result-error': '#ff5555',

    /* Sync section toggle */
    '--color-sync-toggle': '#bd93f9',
    '--color-sync-toggle-hover': '#caa8fc',
    '--color-sync-subsection-title': '#6272a4',

    /* Danger zone */
    '--color-danger-title': '#ff5555',

    /* Link */
    '--color-link': '#8be9fd',
    '--color-link-hover': '#a4edfd',

    /* Backup entry */
    '--color-backup-entry-bg': '#2d2f3d',
    '--color-backup-entry-border': '#44475a',

    /* Sync status entry */
    '--color-sync-entry-bg': '#2d2f3d',
    '--color-sync-entry-hover-bg': '#44475a',

    /* Subtitle */
    '--color-subtitle': '#6272a4',

    /* Template btn selected border */
    '--color-template-btn-selected-border': '#bd93f9',

    /* Tag download hover */
    '--color-tag-download-hover-text': '#bd93f9',
    '--color-tag-download-hover-bg': 'rgba(189, 147, 249, 0.15)',
  },
  monacoTheme: {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'string.key.json', foreground: '8be9fd' },
      { token: 'string.value.json', foreground: 'f1fa8c' },
      { token: 'number.json', foreground: 'bd93f9' },
      { token: 'keyword.json', foreground: 'ff79c6' },
      { token: 'delimiter.bracket.json', foreground: 'f8f8f2' },
      { token: 'delimiter.colon.json', foreground: 'f8f8f2' },
      { token: 'delimiter.comma.json', foreground: 'f8f8f2' },
    ],
    colors: {
      'editor.background': '#282a36',
      'editor.foreground': '#f8f8f2',
      'editor.lineHighlightBackground': '#44475a',
      'editorLineNumber.foreground': '#6272a4',
      'editorLineNumber.activeForeground': '#f8f8f2',
      'editor.selectionBackground': '#44475a',
      'editorCursor.foreground': '#bd93f9',
      'editorBracketMatch.background': '#44475a80',
      'editorBracketMatch.border': '#bd93f9',
    },
  },
}
