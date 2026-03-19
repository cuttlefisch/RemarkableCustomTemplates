import type { Theme } from '../themes'

export const gruvboxLight: Theme = {
  id: 'gruvbox-light',
  name: 'Gruvbox Light',
  group: 'light',
  tokens: {
    /* Surface / Background */
    '--color-page-bg': '#fbf1c7',
    '--color-sidebar-bg': '#ebdbb2',
    '--color-sidebar-border': '#d5c4a1',
    '--color-sidebar-header-border': '#d5c4a1',
    '--color-sidebar-item-hover-bg': '#d5c4a1',
    '--color-sidebar-item-active-bg': '#d5c4a1',
    '--color-navbar-bg': '#ebdbb2',
    '--color-navbar-border': '#d5c4a1',
    '--color-card-bg': '#ebdbb2',
    '--color-card-title-bg': '#d5c4a1',
    '--color-card-border': '#bdae93',
    '--color-editor-bg': '#fbf1c7',
    '--color-editor-toolbar-bg': '#ebdbb2',
    '--color-editor-border': '#d5c4a1',
    '--color-preview-bg': '#ebdbb2',
    '--color-preview-meta-bg': '#fbf1c7',
    '--color-preview-meta-border': '#d5c4a1',

    /* Text */
    '--color-text-primary': '#3c3836',
    '--color-text-secondary': '#504945',
    '--color-text-muted': '#7c6f64',
    '--color-text-hint': '#928374',
    '--color-text-sidebar': '#3c3836',
    '--color-text-sidebar-title': '#504945',
    '--color-text-sidebar-count-fg': '#665c54',
    '--color-text-sidebar-count-bg': '#d5c4a1',
    '--color-text-sidebar-hint': '#7c6f64',
    '--color-text-sidebar-group-label': '#665c54',
    '--color-text-editor': '#3c3836',
    '--color-text-navbar': '#504945',
    '--color-text-navbar-hover': '#3c3836',
    '--color-text-navbar-active': '#458588',
    '--color-text-template-btn': '#504945',
    '--color-text-template-btn-hover': '#3c3836',
    '--color-text-template-btn-selected': '#458588',

    /* Borders */
    '--color-border-dark': '#bdae93',
    '--color-border-separator': '#d5c4a1',
    '--color-border-card': '#bdae93',
    '--color-border-light': '#d5c4a1',
    '--color-border-input': '#bdae93',
    '--color-border-section': '#d5c4a1',

    /* Accent */
    '--color-accent': '#458588',
    '--color-accent-hover': '#076678',
    '--color-accent-bg': '#e0ded3',
    '--color-accent-border': '#458588',
    '--color-accent-text': '#458588',
    '--color-accent-text-light': '#689d6a',

    /* Sidebar buttons */
    '--color-sidebar-btn-bg': '#d5c4a1',
    '--color-sidebar-btn-border': '#bdae93',
    '--color-sidebar-btn-text': '#504945',
    '--color-sidebar-btn-hover-bg': '#bdae93',
    '--color-sidebar-btn-hover-text': '#3c3836',
    '--color-sidebar-btn-active-bg': '#458588',
    '--color-sidebar-btn-active-border': '#076678',
    '--color-sidebar-btn-active-text': '#fbf1c7',

    /* Navbar link states */
    '--color-navbar-hover-bg': '#d5c4a1',
    '--color-navbar-active-bg': '#d5c4a1',

    /* Buttons */
    '--color-btn-primary-bg': '#458588',
    '--color-btn-primary-text': '#fbf1c7',
    '--color-btn-primary-hover': '#076678',
    '--color-btn-secondary-bg': '#d5c4a1',
    '--color-btn-secondary-text': '#3c3836',
    '--color-btn-secondary-border': '#bdae93',
    '--color-btn-secondary-hover': '#bdae93',
    '--color-btn-danger-bg': '#cc241d',
    '--color-btn-danger-text': '#fbf1c7',
    '--color-btn-danger-hover': '#9d0006',

    /* Editor buttons */
    '--color-editor-apply-bg': '#ebdbb2',
    '--color-editor-apply-border': '#458588',
    '--color-editor-apply-text': '#458588',
    '--color-editor-apply-hover': '#d5c4a1',
    '--color-editor-close-bg': '#d5c4a1',
    '--color-editor-close-border': '#bdae93',
    '--color-editor-close-text': '#504945',
    '--color-editor-close-hover-bg': '#bdae93',
    '--color-editor-close-hover-text': '#3c3836',

    /* Edit JSON button */
    '--color-edit-btn-bg': '#ebdbb2',
    '--color-edit-btn-border': '#d5c4a1',
    '--color-edit-btn-text': '#504945',
    '--color-edit-btn-hover-bg': '#d5c4a1',
    '--color-edit-btn-hover-border': '#458588',
    '--color-edit-btn-hover-text': '#458588',
    '--color-edit-btn-active-bg': '#bdae93',
    '--color-edit-btn-active-border': '#458588',
    '--color-edit-btn-active-text': '#076678',

    /* New template create button */
    '--color-create-btn-bg': '#ebdbb2',
    '--color-create-btn-border': '#689d6a',
    '--color-create-btn-text': '#689d6a',
    '--color-create-btn-hover': '#d5c4a1',

    /* Sidebar form inputs */
    '--color-sidebar-input-bg': '#fbf1c7',
    '--color-sidebar-input-border': '#bdae93',
    '--color-sidebar-input-text': '#3c3836',
    '--color-sidebar-input-placeholder': '#928374',

    /* Status */
    '--color-success-bg': '#e8e5b5',
    '--color-success-border': '#98971a',
    '--color-success-text': '#79740e',
    '--color-error-bg': '#f9e0bc',
    '--color-error-border': '#cc241d',
    '--color-error-text': '#cc241d',
    '--color-warning-text': '#d79921',
    '--color-error-hint-text': '#9d0006',
    '--color-connected-dot': '#16a34a',
    '--color-error-dot': '#cc241d',
    '--color-unknown-dot': '#928374',

    /* Sidebar error */
    '--color-sidebar-error-bg': '#f9e0bc',
    '--color-sidebar-error-text': '#cc241d',
    '--color-sidebar-error-border': '#cc241d',

    /* Editor error */
    '--color-editor-error-bg': '#f9e0bc',
    '--color-editor-error-text': '#cc241d',
    '--color-editor-error-border': '#cc241d',

    /* Import prompt */
    '--color-import-prompt-bg': '#ebdbb2',
    '--color-import-prompt-border': '#458588',
    '--color-import-prompt-text': '#076678',
    '--color-import-prompt-strong': '#3c3836',
    '--color-import-prompt-code-bg': '#d5c4a1',
    '--color-import-prompt-code-text': '#076678',

    /* Tags */
    '--color-tag-p-bg': '#d5c4a1',
    '--color-tag-p-text': '#458588',
    '--color-tag-ls-bg': '#d5c4a1',
    '--color-tag-ls-text': '#b16286',
    '--color-tag-cat-bg': '#ebdbb2',
    '--color-tag-cat-text': '#504945',
    '--color-tag-file-bg': '#ebdbb2',
    '--color-tag-file-text': '#7c6f64',
    '--color-tag-custom-bg': '#504945',
    '--color-tag-custom-text': '#d65d0e',
    '--color-tag-cat-hover-bg': '#d5c4a1',
    '--color-tag-cat-active-bg': '#bdae93',
    '--color-tag-cat-active-text': '#3c3836',
    '--color-tag-p-hover-bg': '#bdae93',
    '--color-tag-ls-hover-bg': '#bdae93',
    '--color-tag-p-active-bg': '#a89984',
    '--color-tag-ls-active-bg': '#a89984',

    /* Orientation badges */
    '--color-orient-p-bg': '#d5c4a1',
    '--color-orient-p-text': '#458588',
    '--color-orient-ls-bg': '#d5c4a1',
    '--color-orient-ls-text': '#b16286',
    '--color-orient-custom-bg': '#504945',
    '--color-orient-custom-text': '#d65d0e',

    /* Sync badges */
    '--color-sync-synced-bg': '#e8e5b5',
    '--color-sync-synced-text': '#79740e',
    '--color-sync-local-bg': '#d5c4a1',
    '--color-sync-local-text': '#076678',
    '--color-sync-modified-bg': '#f2e5bc',
    '--color-sync-modified-text': '#b57614',
    '--color-sync-device-bg': '#ebdbb2',
    '--color-sync-device-text': '#504945',

    /* Forms */
    '--color-form-input-bg': '#fbf1c7',
    '--color-form-input-border': '#bdae93',
    '--color-form-input-text': '#3c3836',
    '--color-form-label': '#3c3836',
    '--color-form-focus-ring': 'rgba(69, 133, 136, 0.2)',

    /* Help / callout */
    '--color-help-bg': '#ebdbb2',
    '--color-help-border': '#458588',
    '--color-help-text': '#076678',
    '--color-help-code-bg': '#d5c4a1',

    /* Remove-all preview */
    '--color-remove-preview-bg': '#f9e0bc',
    '--color-remove-preview-border': '#cc241d',
    '--color-remove-list-text': '#3c3836',

    /* SVG preview */
    '--color-svg-shadow': 'rgba(60, 56, 54, 0.12)',
    '--color-svg-border': '#bdae93',

    /* Scrollbar */
    '--color-scrollbar-track': 'transparent',
    '--color-scrollbar-thumb': '#bdae93',

    /* Stage */
    '--color-stage-hint': '#928374',
    '--color-stage-error': '#cc241d',

    /* Filter clear */
    '--color-filter-clear': '#665c54',
    '--color-filter-clear-hover': '#cc241d',

    /* Progress */
    '--color-progress-bar-bg': '#d5c4a1',
    '--color-progress-fill': '#458588',
    '--color-progress-label': '#7c6f64',
    '--color-progress-tip': '#7c6f64',

    /* Connection badge */
    '--color-connection-badge-bg': '#ebdbb2',
    '--color-connection-badge-text': '#504945',
    '--color-connection-detail': '#7c6f64',

    /* Card code */
    '--color-card-code-bg': '#d5c4a1',
    '--color-card-code-text': '#3c3836',

    /* Device op */
    '--color-op-desc': '#504945',
    '--color-op-result-success': '#79740e',
    '--color-op-result-error': '#cc241d',

    /* Sync section toggle */
    '--color-sync-toggle': '#458588',
    '--color-sync-toggle-hover': '#076678',
    '--color-sync-subsection-title': '#504945',

    /* Danger zone */
    '--color-danger-title': '#cc241d',

    /* Link */
    '--color-link': '#458588',
    '--color-link-hover': '#076678',

    /* Backup entry */
    '--color-backup-entry-bg': '#ebdbb2',
    '--color-backup-entry-border': '#d5c4a1',

    /* Sync status entry */
    '--color-sync-entry-bg': '#ebdbb2',
    '--color-sync-entry-hover-bg': '#d5c4a1',

    /* Subtitle */
    '--color-subtitle': '#665c54',

    /* Template btn selected border */
    '--color-template-btn-selected-border': '#458588',

    /* Tag download hover */
    '--color-tag-download-hover-text': '#076678',
    '--color-tag-download-hover-bg': '#d5c4a1',
  },
  monacoTheme: {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'string.key.json', foreground: '458588' },
      { token: 'string.value.json', foreground: '98971a' },
      { token: 'number.json', foreground: 'b16286' },
      { token: 'keyword.json', foreground: 'cc241d' },
      { token: 'delimiter.bracket.json', foreground: '3c3836' },
      { token: 'delimiter.colon.json', foreground: '3c3836' },
      { token: 'delimiter.comma.json', foreground: '3c3836' },
    ],
    colors: {
      'editor.background': '#fbf1c7',
      'editor.foreground': '#3c3836',
      'editor.lineHighlightBackground': '#ebdbb2',
      'editorLineNumber.foreground': '#928374',
      'editorLineNumber.activeForeground': '#3c3836',
      'editor.selectionBackground': '#d5c4a1',
      'editorCursor.foreground': '#458588',
      'editorBracketMatch.background': '#d5c4a140',
      'editorBracketMatch.border': '#458588',
      'editorBracketHighlight.foreground1': '#458588',
      'editorBracketHighlight.foreground2': '#b16286',
      'editorBracketHighlight.foreground3': '#689d6a',
      'editorBracketHighlight.unexpectedBracket.foreground': '#928374',
    },
  },
}
