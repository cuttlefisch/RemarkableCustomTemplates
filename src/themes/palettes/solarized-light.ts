import type { Theme } from '../themes'

export const solarizedLight: Theme = {
  id: 'solarized-light',
  name: 'Solarized Light',
  group: 'light',
  tokens: {
    /* Surface / Background */
    '--color-page-bg': '#fdf6e3',
    '--color-sidebar-bg': '#eee8d5',
    '--color-sidebar-border': '#d3cbb7',
    '--color-sidebar-header-border': '#d3cbb7',
    '--color-sidebar-item-hover-bg': '#e6dfca',
    '--color-sidebar-item-active-bg': '#d5eaf7',
    '--color-navbar-bg': '#eee8d5',
    '--color-navbar-border': '#d3cbb7',
    '--color-card-bg': '#fdf6e3',
    '--color-card-title-bg': '#eee8d5',
    '--color-card-border': '#d3cbb7',
    '--color-editor-bg': '#fdf6e3',
    '--color-editor-toolbar-bg': '#eee8d5',
    '--color-editor-border': '#d3cbb7',
    '--color-preview-bg': '#eee8d5',
    '--color-preview-meta-bg': '#fdf6e3',
    '--color-preview-meta-border': '#d3cbb7',

    /* Text */
    '--color-text-primary': '#586e75',
    '--color-text-secondary': '#657b83',
    '--color-text-muted': '#93a1a1',
    '--color-text-hint': '#93a1a1',
    '--color-text-sidebar': '#586e75',
    '--color-text-sidebar-title': '#657b83',
    '--color-text-sidebar-count-fg': '#657b83',
    '--color-text-sidebar-count-bg': '#e6dfca',
    '--color-text-sidebar-hint': '#93a1a1',
    '--color-text-sidebar-group-label': '#657b83',
    '--color-text-editor': '#586e75',
    '--color-text-navbar': '#657b83',
    '--color-text-navbar-hover': '#586e75',
    '--color-text-navbar-active': '#268bd2',
    '--color-text-template-btn': '#657b83',
    '--color-text-template-btn-hover': '#586e75',
    '--color-text-template-btn-selected': '#268bd2',

    /* Borders */
    '--color-border-dark': '#d3cbb7',
    '--color-border-separator': '#d3cbb7',
    '--color-border-card': '#d3cbb7',
    '--color-border-light': '#e6dfca',
    '--color-border-input': '#d3cbb7',
    '--color-border-section': '#eee8d5',

    /* Accent */
    '--color-accent': '#268bd2',
    '--color-accent-hover': '#1a6da0',
    '--color-accent-bg': '#d5eaf7',
    '--color-accent-border': '#268bd2',
    '--color-accent-text': '#268bd2',
    '--color-accent-text-light': '#268bd2',

    /* Sidebar buttons */
    '--color-sidebar-btn-bg': '#e6dfca',
    '--color-sidebar-btn-border': '#d3cbb7',
    '--color-sidebar-btn-text': '#657b83',
    '--color-sidebar-btn-hover-bg': '#ddd5bf',
    '--color-sidebar-btn-hover-text': '#586e75',
    '--color-sidebar-btn-active-bg': '#d5eaf7',
    '--color-sidebar-btn-active-border': '#268bd2',
    '--color-sidebar-btn-active-text': '#268bd2',

    /* Navbar link states */
    '--color-navbar-hover-bg': '#e6dfca',
    '--color-navbar-active-bg': '#d5eaf7',

    /* Buttons */
    '--color-btn-primary-bg': '#268bd2',
    '--color-btn-primary-text': '#fdf6e3',
    '--color-btn-primary-hover': '#1a6da0',
    '--color-btn-secondary-bg': '#eee8d5',
    '--color-btn-secondary-text': '#586e75',
    '--color-btn-secondary-border': '#d3cbb7',
    '--color-btn-secondary-hover': '#e6dfca',
    '--color-btn-danger-bg': '#dc322f',
    '--color-btn-danger-text': '#fdf6e3',
    '--color-btn-danger-hover': '#b5282a',

    /* Editor buttons */
    '--color-editor-apply-bg': '#d5eaf7',
    '--color-editor-apply-border': '#268bd2',
    '--color-editor-apply-text': '#1a6da0',
    '--color-editor-apply-hover': '#b5daf0',
    '--color-editor-close-bg': '#eee8d5',
    '--color-editor-close-border': '#d3cbb7',
    '--color-editor-close-text': '#657b83',
    '--color-editor-close-hover-bg': '#e6dfca',
    '--color-editor-close-hover-text': '#586e75',

    /* Edit JSON button */
    '--color-edit-btn-bg': '#eee8d5',
    '--color-edit-btn-border': '#d3cbb7',
    '--color-edit-btn-text': '#657b83',
    '--color-edit-btn-hover-bg': '#d5eaf7',
    '--color-edit-btn-hover-border': '#268bd2',
    '--color-edit-btn-hover-text': '#1a6da0',
    '--color-edit-btn-active-bg': '#b5daf0',
    '--color-edit-btn-active-border': '#268bd2',
    '--color-edit-btn-active-text': '#1a6da0',

    /* New template create button */
    '--color-create-btn-bg': '#d5eaf7',
    '--color-create-btn-border': '#268bd2',
    '--color-create-btn-text': '#268bd2',
    '--color-create-btn-hover': '#b5daf0',

    /* Sidebar form inputs */
    '--color-sidebar-input-bg': '#fdf6e3',
    '--color-sidebar-input-border': '#d3cbb7',
    '--color-sidebar-input-text': '#586e75',
    '--color-sidebar-input-placeholder': '#93a1a1',

    /* Status */
    '--color-success-bg': '#e6f2d9',
    '--color-success-border': '#859900',
    '--color-success-text': '#586e00',
    '--color-error-bg': '#fde8e8',
    '--color-error-border': '#dc322f',
    '--color-error-text': '#dc322f',
    '--color-warning-text': '#b58900',
    '--color-error-hint-text': '#b5282a',
    '--color-connected-dot': '#16a34a',
    '--color-error-dot': '#dc322f',
    '--color-unknown-dot': '#93a1a1',

    /* Sidebar error */
    '--color-sidebar-error-bg': '#fde8e8',
    '--color-sidebar-error-text': '#dc322f',
    '--color-sidebar-error-border': '#dc322f',

    /* Editor error */
    '--color-editor-error-bg': '#fde8e8',
    '--color-editor-error-text': '#dc322f',
    '--color-editor-error-border': '#dc322f',

    /* Import prompt */
    '--color-import-prompt-bg': '#d5eaf7',
    '--color-import-prompt-border': '#268bd2',
    '--color-import-prompt-text': '#1a6da0',
    '--color-import-prompt-strong': '#586e75',
    '--color-import-prompt-code-bg': '#b5daf0',
    '--color-import-prompt-code-text': '#1a6da0',

    /* Tags */
    '--color-tag-p-bg': '#d5eaf7',
    '--color-tag-p-text': '#268bd2',
    '--color-tag-ls-bg': '#eddff5',
    '--color-tag-ls-text': '#6c71c4',
    '--color-tag-cat-bg': '#eee8d5',
    '--color-tag-cat-text': '#657b83',
    '--color-tag-file-bg': '#eee8d5',
    '--color-tag-file-text': '#93a1a1',
    '--color-tag-custom-bg': '#4a3600',
    '--color-tag-custom-text': '#b58900',
    '--color-tag-cat-hover-bg': '#e6dfca',
    '--color-tag-cat-active-bg': '#d5eaf7',
    '--color-tag-cat-active-text': '#268bd2',
    '--color-tag-p-hover-bg': '#b5daf0',
    '--color-tag-ls-hover-bg': '#deccee',
    '--color-tag-p-active-bg': '#93cbe8',
    '--color-tag-ls-active-bg': '#ccb8e4',

    /* Orientation badges */
    '--color-orient-p-bg': '#d5eaf7',
    '--color-orient-p-text': '#268bd2',
    '--color-orient-ls-bg': '#eddff5',
    '--color-orient-ls-text': '#6c71c4',
    '--color-orient-custom-bg': '#4a3600',
    '--color-orient-custom-text': '#b58900',

    /* Sync badges */
    '--color-sync-synced-bg': '#e6f2d9',
    '--color-sync-synced-text': '#586e00',
    '--color-sync-local-bg': '#d5eaf7',
    '--color-sync-local-text': '#1a6da0',
    '--color-sync-modified-bg': '#fbf0c8',
    '--color-sync-modified-text': '#b58900',
    '--color-sync-device-bg': '#eee8d5',
    '--color-sync-device-text': '#657b83',

    /* Forms */
    '--color-form-input-bg': '#fdf6e3',
    '--color-form-input-border': '#d3cbb7',
    '--color-form-input-text': '#586e75',
    '--color-form-label': '#586e75',
    '--color-form-focus-ring': 'rgba(38, 139, 210, 0.2)',

    /* Help / callout */
    '--color-help-bg': '#d5eaf7',
    '--color-help-border': '#268bd2',
    '--color-help-text': '#1a6da0',
    '--color-help-code-bg': '#b5daf0',

    /* Remove-all preview */
    '--color-remove-preview-bg': '#fde8e8',
    '--color-remove-preview-border': '#f0b4b4',
    '--color-remove-list-text': '#586e75',

    /* SVG preview */
    '--color-svg-shadow': 'rgba(88, 110, 117, 0.12)',
    '--color-svg-border': '#d3cbb7',

    /* Scrollbar */
    '--color-scrollbar-track': 'transparent',
    '--color-scrollbar-thumb': '#d3cbb7',

    /* Stage */
    '--color-stage-hint': '#93a1a1',
    '--color-stage-error': '#dc322f',

    /* Filter clear */
    '--color-filter-clear': '#657b83',
    '--color-filter-clear-hover': '#dc322f',

    /* Progress */
    '--color-progress-bar-bg': '#e6dfca',
    '--color-progress-fill': '#268bd2',
    '--color-progress-label': '#93a1a1',
    '--color-progress-tip': '#93a1a1',

    /* Connection badge */
    '--color-connection-badge-bg': '#eee8d5',
    '--color-connection-badge-text': '#657b83',
    '--color-connection-detail': '#93a1a1',

    /* Card code */
    '--color-card-code-bg': '#eee8d5',
    '--color-card-code-text': '#586e75',

    /* Device op */
    '--color-op-desc': '#657b83',
    '--color-op-result-success': '#586e00',
    '--color-op-result-error': '#dc322f',

    /* Sync section toggle */
    '--color-sync-toggle': '#268bd2',
    '--color-sync-toggle-hover': '#1a6da0',
    '--color-sync-subsection-title': '#657b83',

    /* Danger zone */
    '--color-danger-title': '#dc322f',

    /* Link */
    '--color-link': '#268bd2',
    '--color-link-hover': '#1a6da0',

    /* Backup entry */
    '--color-backup-entry-bg': '#eee8d5',
    '--color-backup-entry-border': '#e6dfca',

    /* Sync status entry */
    '--color-sync-entry-bg': '#eee8d5',
    '--color-sync-entry-hover-bg': '#e6dfca',

    /* Subtitle */
    '--color-subtitle': '#657b83',

    /* Template btn selected border */
    '--color-template-btn-selected-border': '#268bd2',

    /* Tag download hover */
    '--color-tag-download-hover-text': '#1a6da0',
    '--color-tag-download-hover-bg': '#d5eaf7',
  },
  monacoTheme: {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'string.key.json', foreground: '268bd2' },
      { token: 'string.value.json', foreground: '2aa198' },
      { token: 'number.json', foreground: 'd33682' },
      { token: 'keyword.json', foreground: '859900' },
      { token: 'delimiter.bracket.json', foreground: '586e75' },
      { token: 'delimiter.colon.json', foreground: '586e75' },
      { token: 'delimiter.comma.json', foreground: '586e75' },
    ],
    colors: {
      'editor.background': '#fdf6e3',
      'editor.foreground': '#657b83',
      'editor.lineHighlightBackground': '#eee8d5',
      'editorLineNumber.foreground': '#93a1a1',
      'editorLineNumber.activeForeground': '#586e75',
      'editor.selectionBackground': '#d5eaf7',
      'editorCursor.foreground': '#268bd2',
      'editorBracketMatch.background': '#d5eaf740',
      'editorBracketMatch.border': '#268bd2',
    },
  },
}
