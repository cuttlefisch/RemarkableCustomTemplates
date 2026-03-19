import type { Theme } from '../themes'

export const oneLight: Theme = {
  id: 'one-light',
  name: 'One Light',
  group: 'light',
  tokens: {
    /* Surface / Background */
    '--color-page-bg': '#fafafa',
    '--color-sidebar-bg': '#f0f0f0',
    '--color-sidebar-border': '#d4d4d4',
    '--color-sidebar-header-border': '#d4d4d4',
    '--color-sidebar-item-hover-bg': '#e5e5e6',
    '--color-sidebar-item-active-bg': '#d7e5f8',
    '--color-navbar-bg': '#f0f0f0',
    '--color-navbar-border': '#d4d4d4',
    '--color-card-bg': '#ffffff',
    '--color-card-title-bg': '#f5f5f5',
    '--color-card-border': '#d4d4d4',
    '--color-editor-bg': '#fafafa',
    '--color-editor-toolbar-bg': '#eaeaeb',
    '--color-editor-border': '#d4d4d4',
    '--color-preview-bg': '#fafafa',
    '--color-preview-meta-bg': '#ffffff',
    '--color-preview-meta-border': '#d4d4d4',

    /* Text */
    '--color-text-primary': '#383a42',
    '--color-text-secondary': '#696c77',
    '--color-text-muted': '#a0a1a7',
    '--color-text-hint': '#b0b1b6',
    '--color-text-sidebar': '#383a42',
    '--color-text-sidebar-title': '#a0a1a7',
    '--color-text-sidebar-count-fg': '#696c77',
    '--color-text-sidebar-count-bg': '#e5e5e6',
    '--color-text-sidebar-hint': '#696c77',
    '--color-text-sidebar-group-label': '#696c77',
    '--color-text-editor': '#383a42',
    '--color-text-navbar': '#696c77',
    '--color-text-navbar-hover': '#383a42',
    '--color-text-navbar-active': '#4078f2',
    '--color-text-template-btn': '#696c77',
    '--color-text-template-btn-hover': '#383a42',
    '--color-text-template-btn-selected': '#4078f2',

    /* Borders */
    '--color-border-dark': '#d4d4d4',
    '--color-border-separator': '#d4d4d4',
    '--color-border-card': '#d4d4d4',
    '--color-border-light': '#e0e0e0',
    '--color-border-input': '#d4d4d4',
    '--color-border-section': '#ebebec',

    /* Accent */
    '--color-accent': '#4078f2',
    '--color-accent-hover': '#3568d8',
    '--color-accent-bg': '#d7e5f8',
    '--color-accent-border': '#4078f2',
    '--color-accent-text': '#4078f2',
    '--color-accent-text-light': '#4078f2',

    /* Sidebar buttons */
    '--color-sidebar-btn-bg': '#e5e5e6',
    '--color-sidebar-btn-border': '#d4d4d4',
    '--color-sidebar-btn-text': '#696c77',
    '--color-sidebar-btn-hover-bg': '#dadada',
    '--color-sidebar-btn-hover-text': '#383a42',
    '--color-sidebar-btn-active-bg': '#d7e5f8',
    '--color-sidebar-btn-active-border': '#4078f2',
    '--color-sidebar-btn-active-text': '#4078f2',

    /* Navbar link states */
    '--color-navbar-hover-bg': '#e5e5e6',
    '--color-navbar-active-bg': '#d7e5f8',

    /* Buttons */
    '--color-btn-primary-bg': '#4078f2',
    '--color-btn-primary-text': '#ffffff',
    '--color-btn-primary-hover': '#3568d8',
    '--color-btn-secondary-bg': '#f0f0f0',
    '--color-btn-secondary-text': '#383a42',
    '--color-btn-secondary-border': '#d4d4d4',
    '--color-btn-secondary-hover': '#e5e5e6',
    '--color-btn-danger-bg': '#e45649',
    '--color-btn-danger-text': '#ffffff',
    '--color-btn-danger-hover': '#ca4a3e',

    /* Editor buttons */
    '--color-editor-apply-bg': '#d7e5f8',
    '--color-editor-apply-border': '#4078f2',
    '--color-editor-apply-text': '#3568d8',
    '--color-editor-apply-hover': '#c4d8f4',
    '--color-editor-close-bg': '#e5e5e6',
    '--color-editor-close-border': '#d4d4d4',
    '--color-editor-close-text': '#a0a1a7',
    '--color-editor-close-hover-bg': '#dadada',
    '--color-editor-close-hover-text': '#383a42',

    /* Edit JSON button */
    '--color-edit-btn-bg': '#f0f0f0',
    '--color-edit-btn-border': '#d4d4d4',
    '--color-edit-btn-text': '#696c77',
    '--color-edit-btn-hover-bg': '#dce6fa',
    '--color-edit-btn-hover-border': '#8da8ee',
    '--color-edit-btn-hover-text': '#3568d8',
    '--color-edit-btn-active-bg': '#d7e5f8',
    '--color-edit-btn-active-border': '#4078f2',
    '--color-edit-btn-active-text': '#3568d8',

    /* New template create button */
    '--color-create-btn-bg': '#d7e5f8',
    '--color-create-btn-border': '#4078f2',
    '--color-create-btn-text': '#4078f2',
    '--color-create-btn-hover': '#c4d8f4',

    /* Sidebar form inputs */
    '--color-sidebar-input-bg': '#ffffff',
    '--color-sidebar-input-border': '#d4d4d4',
    '--color-sidebar-input-text': '#383a42',
    '--color-sidebar-input-placeholder': '#a0a1a7',

    /* Status */
    '--color-success-bg': '#e8f5e9',
    '--color-success-border': '#a5d6a7',
    '--color-success-text': '#2e7d32',
    '--color-error-bg': '#fce4ec',
    '--color-error-border': '#ef9a9a',
    '--color-error-text': '#c62828',
    '--color-warning-text': '#986801',
    '--color-error-hint-text': '#8b3a3a',
    '--color-connected-dot': '#50a14f',
    '--color-error-dot': '#e45649',
    '--color-unknown-dot': '#a0a1a7',

    /* Sidebar error */
    '--color-sidebar-error-bg': '#fce4ec',
    '--color-sidebar-error-text': '#c62828',
    '--color-sidebar-error-border': '#ef9a9a',

    /* Editor error */
    '--color-editor-error-bg': '#fce4ec',
    '--color-editor-error-text': '#e45649',
    '--color-editor-error-border': '#ef9a9a',

    /* Import prompt */
    '--color-import-prompt-bg': '#edf2fc',
    '--color-import-prompt-border': '#c4d5f2',
    '--color-import-prompt-text': '#4a5568',
    '--color-import-prompt-strong': '#383a42',
    '--color-import-prompt-code-bg': '#d7e5f8',
    '--color-import-prompt-code-text': '#4078f2',

    /* Tags */
    '--color-tag-p-bg': '#d7e5f8',
    '--color-tag-p-text': '#3568d8',
    '--color-tag-ls-bg': '#f0e0f8',
    '--color-tag-ls-text': '#a626a4',
    '--color-tag-cat-bg': '#ebebec',
    '--color-tag-cat-text': '#696c77',
    '--color-tag-file-bg': '#f0f0f0',
    '--color-tag-file-text': '#a0a1a7',
    '--color-tag-custom-bg': '#f5ecd8',
    '--color-tag-custom-text': '#986801',
    '--color-tag-cat-hover-bg': '#dadada',
    '--color-tag-cat-active-bg': '#d7e5f8',
    '--color-tag-cat-active-text': '#3568d8',
    '--color-tag-p-hover-bg': '#c4d8f4',
    '--color-tag-ls-hover-bg': '#e4ccf0',
    '--color-tag-p-active-bg': '#a8c4ee',
    '--color-tag-ls-active-bg': '#d0b0e4',

    /* Orientation badges */
    '--color-orient-p-bg': '#d7e5f8',
    '--color-orient-p-text': '#4078f2',
    '--color-orient-ls-bg': '#f0e0f8',
    '--color-orient-ls-text': '#a626a4',
    '--color-orient-custom-bg': '#f5ecd8',
    '--color-orient-custom-text': '#986801',

    /* Sync badges */
    '--color-sync-synced-bg': '#e8f5e9',
    '--color-sync-synced-text': '#2e7d32',
    '--color-sync-local-bg': '#e3f2fd',
    '--color-sync-local-text': '#1565c0',
    '--color-sync-modified-bg': '#fff3e0',
    '--color-sync-modified-text': '#e65100',
    '--color-sync-device-bg': '#f0f0f0',
    '--color-sync-device-text': '#696c77',

    /* Forms */
    '--color-form-input-bg': '#ffffff',
    '--color-form-input-border': '#d4d4d4',
    '--color-form-input-text': '#383a42',
    '--color-form-label': '#383a42',
    '--color-form-focus-ring': 'rgba(64, 120, 242, 0.15)',

    /* Help / callout */
    '--color-help-bg': '#edf2fc',
    '--color-help-border': '#c4d5f2',
    '--color-help-text': '#4a5568',
    '--color-help-code-bg': '#d7e5f8',

    /* Remove-all preview */
    '--color-remove-preview-bg': '#fef2f2',
    '--color-remove-preview-border': '#fecaca',
    '--color-remove-list-text': '#383a42',

    /* SVG preview */
    '--color-svg-shadow': 'rgba(0, 0, 0, 0.08)',
    '--color-svg-border': '#d4d4d4',

    /* Scrollbar */
    '--color-scrollbar-track': 'transparent',
    '--color-scrollbar-thumb': '#c8c8ca',

    /* Stage */
    '--color-stage-hint': '#a0a1a7',
    '--color-stage-error': '#e45649',

    /* Filter clear */
    '--color-filter-clear': '#696c77',
    '--color-filter-clear-hover': '#e45649',

    /* Progress */
    '--color-progress-bar-bg': '#e0e0e0',
    '--color-progress-fill': '#4078f2',
    '--color-progress-label': '#a0a1a7',
    '--color-progress-tip': '#b0b1b6',

    /* Connection badge */
    '--color-connection-badge-bg': '#f0f0f0',
    '--color-connection-badge-text': '#696c77',
    '--color-connection-detail': '#a0a1a7',

    /* Card code */
    '--color-card-code-bg': '#f0f0f0',
    '--color-card-code-text': '#383a42',

    /* Device op */
    '--color-op-desc': '#696c77',
    '--color-op-result-success': '#2e7d32',
    '--color-op-result-error': '#c62828',

    /* Sync section toggle */
    '--color-sync-toggle': '#4078f2',
    '--color-sync-toggle-hover': '#3568d8',
    '--color-sync-subsection-title': '#696c77',

    /* Danger zone */
    '--color-danger-title': '#e45649',

    /* Link */
    '--color-link': '#4078f2',
    '--color-link-hover': '#3568d8',

    /* Backup entry */
    '--color-backup-entry-bg': '#f5f5f5',
    '--color-backup-entry-border': '#ebebec',

    /* Sync status entry */
    '--color-sync-entry-bg': '#f5f5f5',
    '--color-sync-entry-hover-bg': '#ebebec',

    /* Subtitle */
    '--color-subtitle': '#696c77',

    /* Template btn selected border */
    '--color-template-btn-selected-border': '#4078f2',

    /* Tag download hover */
    '--color-tag-download-hover-text': '#3568d8',
    '--color-tag-download-hover-bg': '#d7e5f8',
  },
  monacoTheme: {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'string.key.json', foreground: '4078f2' },
      { token: 'string.value.json', foreground: '50a14f' },
      { token: 'number.json', foreground: '986801' },
      { token: 'keyword.json', foreground: 'a626a4' },
      { token: 'delimiter.bracket.json', foreground: '383a42' },
      { token: 'delimiter.colon.json', foreground: '383a42' },
      { token: 'delimiter.comma.json', foreground: '383a42' },
    ],
    colors: {
      'editor.background': '#fafafa',
      'editor.foreground': '#383a42',
      'editor.lineHighlightBackground': '#f0f0f0',
      'editorLineNumber.foreground': '#a0a1a7',
      'editorLineNumber.activeForeground': '#383a42',
      'editor.selectionBackground': '#d7e5f8',
      'editorCursor.foreground': '#4078f2',
      'editorBracketMatch.background': '#d7e5f8',
      'editorBracketMatch.border': '#4078f2',
    },
  },
}
