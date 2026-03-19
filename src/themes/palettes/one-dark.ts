import type { Theme } from '../themes'

export const oneDark: Theme = {
  id: 'one-dark',
  name: 'One Dark',
  group: 'dark',
  tokens: {
    /* Surface / Background */
    '--color-page-bg': '#282c34',
    '--color-sidebar-bg': '#21252b',
    '--color-sidebar-border': '#181a1f',
    '--color-sidebar-header-border': '#181a1f',
    '--color-sidebar-item-hover-bg': '#2c313a',
    '--color-sidebar-item-active-bg': '#2c313a',
    '--color-navbar-bg': '#21252b',
    '--color-navbar-border': '#181a1f',
    '--color-card-bg': '#2c313a',
    '--color-card-title-bg': '#282c34',
    '--color-card-border': '#3e4451',
    '--color-editor-bg': '#282c34',
    '--color-editor-toolbar-bg': '#21252b',
    '--color-editor-border': '#3e4451',
    '--color-preview-bg': '#282c34',
    '--color-preview-meta-bg': '#2c313a',
    '--color-preview-meta-border': '#3e4451',

    /* Text */
    '--color-text-primary': '#abb2bf',
    '--color-text-secondary': '#828997',
    '--color-text-muted': '#636d83',
    '--color-text-hint': '#5c6370',
    '--color-text-sidebar': '#abb2bf',
    '--color-text-sidebar-title': '#636d83',
    '--color-text-sidebar-count-fg': '#828997',
    '--color-text-sidebar-count-bg': '#3e4451',
    '--color-text-sidebar-hint': '#636d83',
    '--color-text-sidebar-group-label': '#636d83',
    '--color-text-editor': '#abb2bf',
    '--color-text-navbar': '#828997',
    '--color-text-navbar-hover': '#abb2bf',
    '--color-text-navbar-active': '#61afef',
    '--color-text-template-btn': '#828997',
    '--color-text-template-btn-hover': '#abb2bf',
    '--color-text-template-btn-selected': '#61afef',

    /* Borders */
    '--color-border-dark': '#181a1f',
    '--color-border-separator': '#3e4451',
    '--color-border-card': '#3e4451',
    '--color-border-light': '#3e4451',
    '--color-border-input': '#3e4451',
    '--color-border-section': '#2c313a',

    /* Accent */
    '--color-accent': '#61afef',
    '--color-accent-hover': '#528bcc',
    '--color-accent-bg': 'rgba(97, 175, 239, 0.15)',
    '--color-accent-border': '#61afef',
    '--color-accent-text': '#61afef',
    '--color-accent-text-light': '#61afef',

    /* Sidebar buttons */
    '--color-sidebar-btn-bg': '#3e4451',
    '--color-sidebar-btn-border': '#4b5363',
    '--color-sidebar-btn-text': '#828997',
    '--color-sidebar-btn-hover-bg': '#4b5363',
    '--color-sidebar-btn-hover-text': '#abb2bf',
    '--color-sidebar-btn-active-bg': 'rgba(97, 175, 239, 0.15)',
    '--color-sidebar-btn-active-border': '#61afef',
    '--color-sidebar-btn-active-text': '#61afef',

    /* Navbar link states */
    '--color-navbar-hover-bg': '#2c313a',
    '--color-navbar-active-bg': 'rgba(97, 175, 239, 0.15)',

    /* Buttons */
    '--color-btn-primary-bg': '#61afef',
    '--color-btn-primary-text': '#282c34',
    '--color-btn-primary-hover': '#528bcc',
    '--color-btn-secondary-bg': '#3e4451',
    '--color-btn-secondary-text': '#abb2bf',
    '--color-btn-secondary-border': '#4b5363',
    '--color-btn-secondary-hover': '#4b5363',
    '--color-btn-danger-bg': '#e06c75',
    '--color-btn-danger-text': '#282c34',
    '--color-btn-danger-hover': '#c85a63',

    /* Editor buttons */
    '--color-editor-apply-bg': 'rgba(97, 175, 239, 0.15)',
    '--color-editor-apply-border': '#61afef',
    '--color-editor-apply-text': '#61afef',
    '--color-editor-apply-hover': 'rgba(97, 175, 239, 0.25)',
    '--color-editor-close-bg': '#3e4451',
    '--color-editor-close-border': '#4b5363',
    '--color-editor-close-text': '#636d83',
    '--color-editor-close-hover-bg': '#4b5363',
    '--color-editor-close-hover-text': '#abb2bf',

    /* Edit JSON button */
    '--color-edit-btn-bg': '#2c313a',
    '--color-edit-btn-border': '#3e4451',
    '--color-edit-btn-text': '#828997',
    '--color-edit-btn-hover-bg': 'rgba(97, 175, 239, 0.1)',
    '--color-edit-btn-hover-border': '#61afef',
    '--color-edit-btn-hover-text': '#61afef',
    '--color-edit-btn-active-bg': 'rgba(97, 175, 239, 0.15)',
    '--color-edit-btn-active-border': '#61afef',
    '--color-edit-btn-active-text': '#61afef',

    /* New template create button */
    '--color-create-btn-bg': 'rgba(97, 175, 239, 0.15)',
    '--color-create-btn-border': '#61afef',
    '--color-create-btn-text': '#61afef',
    '--color-create-btn-hover': 'rgba(97, 175, 239, 0.25)',

    /* Sidebar form inputs */
    '--color-sidebar-input-bg': '#2c313a',
    '--color-sidebar-input-border': '#3e4451',
    '--color-sidebar-input-text': '#abb2bf',
    '--color-sidebar-input-placeholder': '#5c6370',

    /* Status */
    '--color-success-bg': 'rgba(152, 195, 121, 0.15)',
    '--color-success-border': 'rgba(152, 195, 121, 0.4)',
    '--color-success-text': '#98c379',
    '--color-error-bg': 'rgba(224, 108, 117, 0.15)',
    '--color-error-border': 'rgba(224, 108, 117, 0.4)',
    '--color-error-text': '#e06c75',
    '--color-warning-text': '#e5c07b',
    '--color-error-hint-text': '#e06c75',
    '--color-connected-dot': '#98c379',
    '--color-error-dot': '#e06c75',
    '--color-unknown-dot': '#636d83',

    /* Sidebar error */
    '--color-sidebar-error-bg': 'rgba(224, 108, 117, 0.15)',
    '--color-sidebar-error-text': '#e06c75',
    '--color-sidebar-error-border': 'rgba(224, 108, 117, 0.4)',

    /* Editor error */
    '--color-editor-error-bg': 'rgba(224, 108, 117, 0.15)',
    '--color-editor-error-text': '#e06c75',
    '--color-editor-error-border': 'rgba(224, 108, 117, 0.4)',

    /* Import prompt */
    '--color-import-prompt-bg': 'rgba(97, 175, 239, 0.1)',
    '--color-import-prompt-border': 'rgba(97, 175, 239, 0.3)',
    '--color-import-prompt-text': '#828997',
    '--color-import-prompt-strong': '#abb2bf',
    '--color-import-prompt-code-bg': 'rgba(97, 175, 239, 0.15)',
    '--color-import-prompt-code-text': '#61afef',

    /* Tags */
    '--color-tag-p-bg': 'rgba(97, 175, 239, 0.15)',
    '--color-tag-p-text': '#61afef',
    '--color-tag-ls-bg': 'rgba(198, 120, 221, 0.15)',
    '--color-tag-ls-text': '#c678dd',
    '--color-tag-cat-bg': '#3e4451',
    '--color-tag-cat-text': '#828997',
    '--color-tag-file-bg': '#2c313a',
    '--color-tag-file-text': '#636d83',
    '--color-tag-custom-bg': 'rgba(209, 154, 102, 0.15)',
    '--color-tag-custom-text': '#d19a66',
    '--color-tag-cat-hover-bg': '#4b5363',
    '--color-tag-cat-active-bg': 'rgba(97, 175, 239, 0.15)',
    '--color-tag-cat-active-text': '#61afef',
    '--color-tag-p-hover-bg': 'rgba(97, 175, 239, 0.25)',
    '--color-tag-ls-hover-bg': 'rgba(198, 120, 221, 0.25)',
    '--color-tag-p-active-bg': 'rgba(97, 175, 239, 0.3)',
    '--color-tag-ls-active-bg': 'rgba(198, 120, 221, 0.3)',

    /* Orientation badges */
    '--color-orient-p-bg': 'rgba(97, 175, 239, 0.15)',
    '--color-orient-p-text': '#61afef',
    '--color-orient-ls-bg': 'rgba(198, 120, 221, 0.15)',
    '--color-orient-ls-text': '#c678dd',
    '--color-orient-custom-bg': 'rgba(209, 154, 102, 0.15)',
    '--color-orient-custom-text': '#d19a66',

    /* Sync badges */
    '--color-sync-synced-bg': 'rgba(152, 195, 121, 0.15)',
    '--color-sync-synced-text': '#98c379',
    '--color-sync-local-bg': 'rgba(97, 175, 239, 0.15)',
    '--color-sync-local-text': '#61afef',
    '--color-sync-modified-bg': 'rgba(229, 192, 123, 0.15)',
    '--color-sync-modified-text': '#e5c07b',
    '--color-sync-device-bg': '#3e4451',
    '--color-sync-device-text': '#828997',

    /* Forms */
    '--color-form-input-bg': '#2c313a',
    '--color-form-input-border': '#3e4451',
    '--color-form-input-text': '#abb2bf',
    '--color-form-label': '#abb2bf',
    '--color-form-focus-ring': 'rgba(97, 175, 239, 0.2)',

    /* Help / callout */
    '--color-help-bg': 'rgba(97, 175, 239, 0.1)',
    '--color-help-border': 'rgba(97, 175, 239, 0.3)',
    '--color-help-text': '#828997',
    '--color-help-code-bg': 'rgba(97, 175, 239, 0.15)',

    /* Remove-all preview */
    '--color-remove-preview-bg': 'rgba(224, 108, 117, 0.1)',
    '--color-remove-preview-border': 'rgba(224, 108, 117, 0.3)',
    '--color-remove-list-text': '#abb2bf',

    /* SVG preview */
    '--color-svg-shadow': 'rgba(0, 0, 0, 0.3)',
    '--color-svg-border': '#3e4451',

    /* Scrollbar */
    '--color-scrollbar-track': 'transparent',
    '--color-scrollbar-thumb': '#3e4451',

    /* Stage */
    '--color-stage-hint': '#636d83',
    '--color-stage-error': '#e06c75',

    /* Filter clear */
    '--color-filter-clear': '#828997',
    '--color-filter-clear-hover': '#e06c75',

    /* Progress */
    '--color-progress-bar-bg': '#3e4451',
    '--color-progress-fill': '#61afef',
    '--color-progress-label': '#636d83',
    '--color-progress-tip': '#5c6370',

    /* Connection badge */
    '--color-connection-badge-bg': '#3e4451',
    '--color-connection-badge-text': '#828997',
    '--color-connection-detail': '#636d83',

    /* Card code */
    '--color-card-code-bg': '#282c34',
    '--color-card-code-text': '#abb2bf',

    /* Device op */
    '--color-op-desc': '#828997',
    '--color-op-result-success': '#98c379',
    '--color-op-result-error': '#e06c75',

    /* Sync section toggle */
    '--color-sync-toggle': '#61afef',
    '--color-sync-toggle-hover': '#528bcc',
    '--color-sync-subsection-title': '#828997',

    /* Danger zone */
    '--color-danger-title': '#e06c75',

    /* Link */
    '--color-link': '#61afef',
    '--color-link-hover': '#528bcc',

    /* Backup entry */
    '--color-backup-entry-bg': '#2c313a',
    '--color-backup-entry-border': '#3e4451',

    /* Sync status entry */
    '--color-sync-entry-bg': '#2c313a',
    '--color-sync-entry-hover-bg': '#3e4451',

    /* Subtitle */
    '--color-subtitle': '#828997',

    /* Template btn selected border */
    '--color-template-btn-selected-border': '#61afef',

    /* Tag download hover */
    '--color-tag-download-hover-text': '#61afef',
    '--color-tag-download-hover-bg': 'rgba(97, 175, 239, 0.15)',
  },
  monacoTheme: {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'string.key.json', foreground: 'e06c75' },
      { token: 'string.value.json', foreground: '98c379' },
      { token: 'number.json', foreground: 'd19a66' },
      { token: 'keyword.json', foreground: 'c678dd' },
      { token: 'delimiter.bracket.json', foreground: 'abb2bf' },
      { token: 'delimiter.colon.json', foreground: 'abb2bf' },
      { token: 'delimiter.comma.json', foreground: 'abb2bf' },
    ],
    colors: {
      'editor.background': '#282c34',
      'editor.foreground': '#abb2bf',
      'editor.lineHighlightBackground': '#2c313a',
      'editorLineNumber.foreground': '#636d83',
      'editorLineNumber.activeForeground': '#abb2bf',
      'editor.selectionBackground': '#3e4451',
      'editorCursor.foreground': '#61afef',
      'editorBracketMatch.background': 'rgba(97, 175, 239, 0.15)',
      'editorBracketMatch.border': '#61afef',
    },
  },
}
