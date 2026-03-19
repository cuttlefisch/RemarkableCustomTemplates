import type { Theme } from '../themes'

export const gruvboxDark: Theme = {
  id: 'gruvbox-dark',
  name: 'Gruvbox Dark',
  group: 'dark',
  tokens: {
    /* Surface / Background */
    '--color-page-bg': '#282828',
    '--color-sidebar-bg': '#1d2021',
    '--color-sidebar-border': '#3c3836',
    '--color-sidebar-header-border': '#3c3836',
    '--color-sidebar-item-hover-bg': '#3c3836',
    '--color-sidebar-item-active-bg': '#3c3836',
    '--color-navbar-bg': '#1d2021',
    '--color-navbar-border': '#3c3836',
    '--color-card-bg': '#3c3836',
    '--color-card-title-bg': '#282828',
    '--color-card-border': '#504945',
    '--color-editor-bg': '#282828',
    '--color-editor-toolbar-bg': '#1d2021',
    '--color-editor-border': '#504945',
    '--color-preview-bg': '#282828',
    '--color-preview-meta-bg': '#3c3836',
    '--color-preview-meta-border': '#504945',

    /* Text */
    '--color-text-primary': '#ebdbb2',
    '--color-text-secondary': '#bdae93',
    '--color-text-muted': '#a89984',
    '--color-text-hint': '#928374',
    '--color-text-sidebar': '#ebdbb2',
    '--color-text-sidebar-title': '#a89984',
    '--color-text-sidebar-count-fg': '#bdae93',
    '--color-text-sidebar-count-bg': '#504945',
    '--color-text-sidebar-hint': '#a89984',
    '--color-text-sidebar-group-label': '#a89984',
    '--color-text-editor': '#ebdbb2',
    '--color-text-navbar': '#bdae93',
    '--color-text-navbar-hover': '#ebdbb2',
    '--color-text-navbar-active': '#83a598',
    '--color-text-template-btn': '#bdae93',
    '--color-text-template-btn-hover': '#ebdbb2',
    '--color-text-template-btn-selected': '#83a598',

    /* Borders */
    '--color-border-dark': '#1d2021',
    '--color-border-separator': '#504945',
    '--color-border-card': '#504945',
    '--color-border-light': '#504945',
    '--color-border-input': '#504945',
    '--color-border-section': '#3c3836',

    /* Accent */
    '--color-accent': '#83a598',
    '--color-accent-hover': '#6d8e81',
    '--color-accent-bg': 'rgba(131, 165, 152, 0.15)',
    '--color-accent-border': '#83a598',
    '--color-accent-text': '#83a598',
    '--color-accent-text-light': '#83a598',

    /* Sidebar buttons */
    '--color-sidebar-btn-bg': '#504945',
    '--color-sidebar-btn-border': '#665c54',
    '--color-sidebar-btn-text': '#bdae93',
    '--color-sidebar-btn-hover-bg': '#665c54',
    '--color-sidebar-btn-hover-text': '#ebdbb2',
    '--color-sidebar-btn-active-bg': 'rgba(131, 165, 152, 0.15)',
    '--color-sidebar-btn-active-border': '#83a598',
    '--color-sidebar-btn-active-text': '#83a598',

    /* Navbar link states */
    '--color-navbar-hover-bg': '#3c3836',
    '--color-navbar-active-bg': 'rgba(131, 165, 152, 0.15)',

    /* Buttons */
    '--color-btn-primary-bg': '#83a598',
    '--color-btn-primary-text': '#282828',
    '--color-btn-primary-hover': '#6d8e81',
    '--color-btn-secondary-bg': '#504945',
    '--color-btn-secondary-text': '#ebdbb2',
    '--color-btn-secondary-border': '#665c54',
    '--color-btn-secondary-hover': '#665c54',
    '--color-btn-danger-bg': '#fb4934',
    '--color-btn-danger-text': '#282828',
    '--color-btn-danger-hover': '#cc241d',

    /* Editor buttons */
    '--color-editor-apply-bg': 'rgba(131, 165, 152, 0.15)',
    '--color-editor-apply-border': '#83a598',
    '--color-editor-apply-text': '#83a598',
    '--color-editor-apply-hover': 'rgba(131, 165, 152, 0.25)',
    '--color-editor-close-bg': '#504945',
    '--color-editor-close-border': '#665c54',
    '--color-editor-close-text': '#a89984',
    '--color-editor-close-hover-bg': '#665c54',
    '--color-editor-close-hover-text': '#ebdbb2',

    /* Edit JSON button */
    '--color-edit-btn-bg': '#3c3836',
    '--color-edit-btn-border': '#504945',
    '--color-edit-btn-text': '#bdae93',
    '--color-edit-btn-hover-bg': 'rgba(131, 165, 152, 0.1)',
    '--color-edit-btn-hover-border': '#83a598',
    '--color-edit-btn-hover-text': '#83a598',
    '--color-edit-btn-active-bg': 'rgba(131, 165, 152, 0.15)',
    '--color-edit-btn-active-border': '#83a598',
    '--color-edit-btn-active-text': '#83a598',

    /* New template create button */
    '--color-create-btn-bg': 'rgba(131, 165, 152, 0.15)',
    '--color-create-btn-border': '#83a598',
    '--color-create-btn-text': '#83a598',
    '--color-create-btn-hover': 'rgba(131, 165, 152, 0.25)',

    /* Sidebar form inputs */
    '--color-sidebar-input-bg': '#3c3836',
    '--color-sidebar-input-border': '#504945',
    '--color-sidebar-input-text': '#ebdbb2',
    '--color-sidebar-input-placeholder': '#928374',

    /* Status */
    '--color-success-bg': 'rgba(184, 187, 38, 0.15)',
    '--color-success-border': 'rgba(184, 187, 38, 0.4)',
    '--color-success-text': '#b8bb26',
    '--color-error-bg': 'rgba(251, 73, 52, 0.15)',
    '--color-error-border': 'rgba(251, 73, 52, 0.4)',
    '--color-error-text': '#fb4934',
    '--color-warning-text': '#fabd2f',
    '--color-error-hint-text': '#fb4934',
    '--color-connected-dot': '#b8bb26',
    '--color-error-dot': '#fb4934',
    '--color-unknown-dot': '#a89984',

    /* Sidebar error */
    '--color-sidebar-error-bg': 'rgba(251, 73, 52, 0.15)',
    '--color-sidebar-error-text': '#fb4934',
    '--color-sidebar-error-border': 'rgba(251, 73, 52, 0.4)',

    /* Editor error */
    '--color-editor-error-bg': 'rgba(251, 73, 52, 0.15)',
    '--color-editor-error-text': '#fb4934',
    '--color-editor-error-border': 'rgba(251, 73, 52, 0.4)',

    /* Import prompt */
    '--color-import-prompt-bg': 'rgba(131, 165, 152, 0.1)',
    '--color-import-prompt-border': 'rgba(131, 165, 152, 0.3)',
    '--color-import-prompt-text': '#bdae93',
    '--color-import-prompt-strong': '#ebdbb2',
    '--color-import-prompt-code-bg': 'rgba(131, 165, 152, 0.15)',
    '--color-import-prompt-code-text': '#83a598',

    /* Tags */
    '--color-tag-p-bg': 'rgba(131, 165, 152, 0.15)',
    '--color-tag-p-text': '#83a598',
    '--color-tag-ls-bg': 'rgba(211, 134, 155, 0.15)',
    '--color-tag-ls-text': '#d3869b',
    '--color-tag-cat-bg': '#504945',
    '--color-tag-cat-text': '#bdae93',
    '--color-tag-file-bg': '#3c3836',
    '--color-tag-file-text': '#a89984',
    '--color-tag-custom-bg': 'rgba(254, 128, 25, 0.15)',
    '--color-tag-custom-text': '#fe8019',
    '--color-tag-cat-hover-bg': '#665c54',
    '--color-tag-cat-active-bg': 'rgba(131, 165, 152, 0.15)',
    '--color-tag-cat-active-text': '#83a598',
    '--color-tag-p-hover-bg': 'rgba(131, 165, 152, 0.25)',
    '--color-tag-ls-hover-bg': 'rgba(211, 134, 155, 0.25)',
    '--color-tag-p-active-bg': 'rgba(131, 165, 152, 0.3)',
    '--color-tag-ls-active-bg': 'rgba(211, 134, 155, 0.3)',

    /* Orientation badges */
    '--color-orient-p-bg': 'rgba(131, 165, 152, 0.15)',
    '--color-orient-p-text': '#83a598',
    '--color-orient-ls-bg': 'rgba(211, 134, 155, 0.15)',
    '--color-orient-ls-text': '#d3869b',
    '--color-orient-custom-bg': 'rgba(254, 128, 25, 0.15)',
    '--color-orient-custom-text': '#fe8019',

    /* Sync badges */
    '--color-sync-synced-bg': 'rgba(184, 187, 38, 0.15)',
    '--color-sync-synced-text': '#b8bb26',
    '--color-sync-local-bg': 'rgba(131, 165, 152, 0.15)',
    '--color-sync-local-text': '#83a598',
    '--color-sync-modified-bg': 'rgba(250, 189, 47, 0.15)',
    '--color-sync-modified-text': '#fabd2f',
    '--color-sync-device-bg': '#504945',
    '--color-sync-device-text': '#bdae93',

    /* Forms */
    '--color-form-input-bg': '#3c3836',
    '--color-form-input-border': '#504945',
    '--color-form-input-text': '#ebdbb2',
    '--color-form-label': '#ebdbb2',
    '--color-form-focus-ring': 'rgba(131, 165, 152, 0.2)',

    /* Help / callout */
    '--color-help-bg': 'rgba(131, 165, 152, 0.1)',
    '--color-help-border': 'rgba(131, 165, 152, 0.3)',
    '--color-help-text': '#bdae93',
    '--color-help-code-bg': 'rgba(131, 165, 152, 0.15)',

    /* Remove-all preview */
    '--color-remove-preview-bg': 'rgba(251, 73, 52, 0.1)',
    '--color-remove-preview-border': 'rgba(251, 73, 52, 0.3)',
    '--color-remove-list-text': '#ebdbb2',

    /* SVG preview */
    '--color-svg-shadow': 'rgba(0, 0, 0, 0.3)',
    '--color-svg-border': '#504945',

    /* Scrollbar */
    '--color-scrollbar-track': 'transparent',
    '--color-scrollbar-thumb': '#504945',

    /* Stage */
    '--color-stage-hint': '#a89984',
    '--color-stage-error': '#fb4934',

    /* Filter clear */
    '--color-filter-clear': '#bdae93',
    '--color-filter-clear-hover': '#fb4934',

    /* Progress */
    '--color-progress-bar-bg': '#504945',
    '--color-progress-fill': '#83a598',
    '--color-progress-label': '#a89984',
    '--color-progress-tip': '#928374',

    /* Connection badge */
    '--color-connection-badge-bg': '#504945',
    '--color-connection-badge-text': '#bdae93',
    '--color-connection-detail': '#a89984',

    /* Card code */
    '--color-card-code-bg': '#282828',
    '--color-card-code-text': '#ebdbb2',

    /* Device op */
    '--color-op-desc': '#bdae93',
    '--color-op-result-success': '#b8bb26',
    '--color-op-result-error': '#fb4934',

    /* Sync section toggle */
    '--color-sync-toggle': '#83a598',
    '--color-sync-toggle-hover': '#6d8e81',
    '--color-sync-subsection-title': '#bdae93',

    /* Danger zone */
    '--color-danger-title': '#fb4934',

    /* Link */
    '--color-link': '#83a598',
    '--color-link-hover': '#6d8e81',

    /* Backup entry */
    '--color-backup-entry-bg': '#3c3836',
    '--color-backup-entry-border': '#504945',

    /* Sync status entry */
    '--color-sync-entry-bg': '#3c3836',
    '--color-sync-entry-hover-bg': '#504945',

    /* Subtitle */
    '--color-subtitle': '#bdae93',

    /* Template btn selected border */
    '--color-template-btn-selected-border': '#83a598',

    /* Tag download hover */
    '--color-tag-download-hover-text': '#83a598',
    '--color-tag-download-hover-bg': 'rgba(131, 165, 152, 0.15)',
  },
  monacoTheme: {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'string.key.json', foreground: '83a598' },
      { token: 'string.value.json', foreground: 'b8bb26' },
      { token: 'number.json', foreground: 'd3869b' },
      { token: 'keyword.json', foreground: 'fb4934' },
      { token: 'delimiter.bracket.json', foreground: 'ebdbb2' },
      { token: 'delimiter.colon.json', foreground: 'ebdbb2' },
      { token: 'delimiter.comma.json', foreground: 'ebdbb2' },
    ],
    colors: {
      'editor.background': '#282828',
      'editor.foreground': '#ebdbb2',
      'editor.lineHighlightBackground': '#3c3836',
      'editorLineNumber.foreground': '#a89984',
      'editorLineNumber.activeForeground': '#ebdbb2',
      'editor.selectionBackground': '#504945',
      'editorCursor.foreground': '#83a598',
      'editorBracketMatch.background': 'rgba(131, 165, 152, 0.15)',
      'editorBracketMatch.border': '#83a598',
    },
  },
}
