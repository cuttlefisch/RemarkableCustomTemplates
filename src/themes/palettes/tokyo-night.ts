import type { Theme } from '../themes'

export const tokyoNight: Theme = {
  id: 'tokyo-night',
  name: 'Tokyo Night',
  group: 'dark',
  tokens: {
    /* Surface / Background */
    '--color-page-bg': '#1a1b26',
    '--color-sidebar-bg': '#16161e',
    '--color-sidebar-border': '#101014',
    '--color-sidebar-header-border': '#101014',
    '--color-sidebar-item-hover-bg': '#292e42',
    '--color-sidebar-item-active-bg': '#292e42',
    '--color-navbar-bg': '#16161e',
    '--color-navbar-border': '#101014',
    '--color-card-bg': '#292e42',
    '--color-card-title-bg': '#1a1b26',
    '--color-card-border': '#414868',
    '--color-editor-bg': '#1a1b26',
    '--color-editor-toolbar-bg': '#16161e',
    '--color-editor-border': '#414868',
    '--color-preview-bg': '#1a1b26',
    '--color-preview-meta-bg': '#292e42',
    '--color-preview-meta-border': '#414868',

    /* Text */
    '--color-text-primary': '#a9b1d6',
    '--color-text-secondary': '#565f89',
    '--color-text-muted': '#565f89',
    '--color-text-hint': '#414868',
    '--color-text-sidebar': '#a9b1d6',
    '--color-text-sidebar-title': '#565f89',
    '--color-text-sidebar-count-fg': '#565f89',
    '--color-text-sidebar-count-bg': '#414868',
    '--color-text-sidebar-hint': '#565f89',
    '--color-text-sidebar-group-label': '#565f89',
    '--color-text-editor': '#a9b1d6',
    '--color-text-navbar': '#565f89',
    '--color-text-navbar-hover': '#a9b1d6',
    '--color-text-navbar-active': '#7aa2f7',
    '--color-text-template-btn': '#565f89',
    '--color-text-template-btn-hover': '#a9b1d6',
    '--color-text-template-btn-selected': '#7aa2f7',

    /* Borders */
    '--color-border-dark': '#101014',
    '--color-border-separator': '#414868',
    '--color-border-card': '#414868',
    '--color-border-light': '#414868',
    '--color-border-input': '#414868',
    '--color-border-section': '#292e42',

    /* Accent */
    '--color-accent': '#7aa2f7',
    '--color-accent-hover': '#6690e0',
    '--color-accent-bg': 'rgba(122, 162, 247, 0.15)',
    '--color-accent-border': '#7aa2f7',
    '--color-accent-text': '#7aa2f7',
    '--color-accent-text-light': '#7aa2f7',

    /* Sidebar buttons */
    '--color-sidebar-btn-bg': '#414868',
    '--color-sidebar-btn-border': '#565f89',
    '--color-sidebar-btn-text': '#565f89',
    '--color-sidebar-btn-hover-bg': '#565f89',
    '--color-sidebar-btn-hover-text': '#a9b1d6',
    '--color-sidebar-btn-active-bg': 'rgba(122, 162, 247, 0.15)',
    '--color-sidebar-btn-active-border': '#7aa2f7',
    '--color-sidebar-btn-active-text': '#7aa2f7',

    /* Navbar link states */
    '--color-navbar-hover-bg': '#292e42',
    '--color-navbar-active-bg': 'rgba(122, 162, 247, 0.15)',

    /* Buttons */
    '--color-btn-primary-bg': '#7aa2f7',
    '--color-btn-primary-text': '#1a1b26',
    '--color-btn-primary-hover': '#6690e0',
    '--color-btn-secondary-bg': '#414868',
    '--color-btn-secondary-text': '#a9b1d6',
    '--color-btn-secondary-border': '#565f89',
    '--color-btn-secondary-hover': '#565f89',
    '--color-btn-danger-bg': '#f7768e',
    '--color-btn-danger-text': '#1a1b26',
    '--color-btn-danger-hover': '#e0606e',

    /* Editor buttons */
    '--color-editor-apply-bg': 'rgba(122, 162, 247, 0.15)',
    '--color-editor-apply-border': '#7aa2f7',
    '--color-editor-apply-text': '#7aa2f7',
    '--color-editor-apply-hover': 'rgba(122, 162, 247, 0.25)',
    '--color-editor-close-bg': '#414868',
    '--color-editor-close-border': '#565f89',
    '--color-editor-close-text': '#565f89',
    '--color-editor-close-hover-bg': '#565f89',
    '--color-editor-close-hover-text': '#a9b1d6',

    /* Edit JSON button */
    '--color-edit-btn-bg': '#292e42',
    '--color-edit-btn-border': '#414868',
    '--color-edit-btn-text': '#565f89',
    '--color-edit-btn-hover-bg': 'rgba(122, 162, 247, 0.1)',
    '--color-edit-btn-hover-border': '#7aa2f7',
    '--color-edit-btn-hover-text': '#7aa2f7',
    '--color-edit-btn-active-bg': 'rgba(122, 162, 247, 0.15)',
    '--color-edit-btn-active-border': '#7aa2f7',
    '--color-edit-btn-active-text': '#7aa2f7',

    /* New template create button */
    '--color-create-btn-bg': 'rgba(122, 162, 247, 0.15)',
    '--color-create-btn-border': '#7aa2f7',
    '--color-create-btn-text': '#7aa2f7',
    '--color-create-btn-hover': 'rgba(122, 162, 247, 0.25)',

    /* Sidebar form inputs */
    '--color-sidebar-input-bg': '#292e42',
    '--color-sidebar-input-border': '#414868',
    '--color-sidebar-input-text': '#a9b1d6',
    '--color-sidebar-input-placeholder': '#414868',

    /* Status */
    '--color-success-bg': 'rgba(158, 206, 106, 0.15)',
    '--color-success-border': 'rgba(158, 206, 106, 0.4)',
    '--color-success-text': '#9ece6a',
    '--color-error-bg': 'rgba(247, 118, 142, 0.15)',
    '--color-error-border': 'rgba(247, 118, 142, 0.4)',
    '--color-error-text': '#f7768e',
    '--color-warning-text': '#e0af68',
    '--color-error-hint-text': '#f7768e',
    '--color-connected-dot': '#9ece6a',
    '--color-error-dot': '#f7768e',
    '--color-unknown-dot': '#565f89',

    /* Sidebar error */
    '--color-sidebar-error-bg': 'rgba(247, 118, 142, 0.15)',
    '--color-sidebar-error-text': '#f7768e',
    '--color-sidebar-error-border': 'rgba(247, 118, 142, 0.4)',

    /* Editor error */
    '--color-editor-error-bg': 'rgba(247, 118, 142, 0.15)',
    '--color-editor-error-text': '#f7768e',
    '--color-editor-error-border': 'rgba(247, 118, 142, 0.4)',

    /* Import prompt */
    '--color-import-prompt-bg': 'rgba(122, 162, 247, 0.1)',
    '--color-import-prompt-border': 'rgba(122, 162, 247, 0.3)',
    '--color-import-prompt-text': '#565f89',
    '--color-import-prompt-strong': '#a9b1d6',
    '--color-import-prompt-code-bg': 'rgba(122, 162, 247, 0.15)',
    '--color-import-prompt-code-text': '#7aa2f7',

    /* Tags */
    '--color-tag-p-bg': 'rgba(122, 162, 247, 0.15)',
    '--color-tag-p-text': '#7aa2f7',
    '--color-tag-ls-bg': 'rgba(187, 154, 247, 0.15)',
    '--color-tag-ls-text': '#bb9af7',
    '--color-tag-cat-bg': '#414868',
    '--color-tag-cat-text': '#565f89',
    '--color-tag-file-bg': '#292e42',
    '--color-tag-file-text': '#565f89',
    '--color-tag-custom-bg': 'rgba(255, 158, 100, 0.15)',
    '--color-tag-custom-text': '#ff9e64',
    '--color-tag-cat-hover-bg': '#565f89',
    '--color-tag-cat-active-bg': 'rgba(122, 162, 247, 0.15)',
    '--color-tag-cat-active-text': '#7aa2f7',
    '--color-tag-p-hover-bg': 'rgba(122, 162, 247, 0.25)',
    '--color-tag-ls-hover-bg': 'rgba(187, 154, 247, 0.25)',
    '--color-tag-p-active-bg': 'rgba(122, 162, 247, 0.3)',
    '--color-tag-ls-active-bg': 'rgba(187, 154, 247, 0.3)',

    /* Orientation badges */
    '--color-orient-p-bg': 'rgba(122, 162, 247, 0.15)',
    '--color-orient-p-text': '#7aa2f7',
    '--color-orient-ls-bg': 'rgba(187, 154, 247, 0.15)',
    '--color-orient-ls-text': '#bb9af7',
    '--color-orient-custom-bg': 'rgba(255, 158, 100, 0.15)',
    '--color-orient-custom-text': '#ff9e64',

    /* Sync badges */
    '--color-sync-synced-bg': 'rgba(158, 206, 106, 0.15)',
    '--color-sync-synced-text': '#9ece6a',
    '--color-sync-local-bg': 'rgba(122, 162, 247, 0.15)',
    '--color-sync-local-text': '#7aa2f7',
    '--color-sync-modified-bg': 'rgba(224, 175, 104, 0.15)',
    '--color-sync-modified-text': '#e0af68',
    '--color-sync-device-bg': '#414868',
    '--color-sync-device-text': '#565f89',

    /* Forms */
    '--color-form-input-bg': '#292e42',
    '--color-form-input-border': '#414868',
    '--color-form-input-text': '#a9b1d6',
    '--color-form-label': '#a9b1d6',
    '--color-form-focus-ring': 'rgba(122, 162, 247, 0.2)',

    /* Help / callout */
    '--color-help-bg': 'rgba(122, 162, 247, 0.1)',
    '--color-help-border': 'rgba(122, 162, 247, 0.3)',
    '--color-help-text': '#565f89',
    '--color-help-code-bg': 'rgba(122, 162, 247, 0.15)',

    /* Remove-all preview */
    '--color-remove-preview-bg': 'rgba(247, 118, 142, 0.1)',
    '--color-remove-preview-border': 'rgba(247, 118, 142, 0.3)',
    '--color-remove-list-text': '#a9b1d6',

    /* SVG preview */
    '--color-svg-shadow': 'rgba(0, 0, 0, 0.4)',
    '--color-svg-border': '#414868',

    /* Scrollbar */
    '--color-scrollbar-track': 'transparent',
    '--color-scrollbar-thumb': '#414868',

    /* Stage */
    '--color-stage-hint': '#565f89',
    '--color-stage-error': '#f7768e',

    /* Filter clear */
    '--color-filter-clear': '#565f89',
    '--color-filter-clear-hover': '#f7768e',

    /* Progress */
    '--color-progress-bar-bg': '#414868',
    '--color-progress-fill': '#7aa2f7',
    '--color-progress-label': '#565f89',
    '--color-progress-tip': '#414868',

    /* Connection badge */
    '--color-connection-badge-bg': '#414868',
    '--color-connection-badge-text': '#565f89',
    '--color-connection-detail': '#565f89',

    /* Card code */
    '--color-card-code-bg': '#1a1b26',
    '--color-card-code-text': '#a9b1d6',

    /* Device op */
    '--color-op-desc': '#565f89',
    '--color-op-result-success': '#9ece6a',
    '--color-op-result-error': '#f7768e',

    /* Sync section toggle */
    '--color-sync-toggle': '#7aa2f7',
    '--color-sync-toggle-hover': '#6690e0',
    '--color-sync-subsection-title': '#565f89',

    /* Danger zone */
    '--color-danger-title': '#f7768e',

    /* Link */
    '--color-link': '#7aa2f7',
    '--color-link-hover': '#6690e0',

    /* Backup entry */
    '--color-backup-entry-bg': '#292e42',
    '--color-backup-entry-border': '#414868',

    /* Sync status entry */
    '--color-sync-entry-bg': '#292e42',
    '--color-sync-entry-hover-bg': '#414868',

    /* Subtitle */
    '--color-subtitle': '#565f89',

    /* Template btn selected border */
    '--color-template-btn-selected-border': '#7aa2f7',

    /* Tag download hover */
    '--color-tag-download-hover-text': '#7aa2f7',
    '--color-tag-download-hover-bg': 'rgba(122, 162, 247, 0.15)',
  },
  monacoTheme: {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'string.key.json', foreground: '7aa2f7' },
      { token: 'string.value.json', foreground: '9ece6a' },
      { token: 'number.json', foreground: 'bb9af7' },
      { token: 'keyword.json', foreground: 'f7768e' },
      { token: 'delimiter.bracket.json', foreground: 'a9b1d6' },
      { token: 'delimiter.colon.json', foreground: 'a9b1d6' },
      { token: 'delimiter.comma.json', foreground: 'a9b1d6' },
    ],
    colors: {
      'editor.background': '#1a1b26',
      'editor.foreground': '#a9b1d6',
      'editor.lineHighlightBackground': '#292e42',
      'editorLineNumber.foreground': '#565f89',
      'editorLineNumber.activeForeground': '#a9b1d6',
      'editor.selectionBackground': '#414868',
      'editorCursor.foreground': '#7aa2f7',
      'editorBracketMatch.background': 'rgba(122, 162, 247, 0.15)',
      'editorBracketMatch.border': '#7aa2f7',
    },
  },
}
