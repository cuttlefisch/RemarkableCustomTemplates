import type { Theme } from '../themes'

export const nord: Theme = {
  id: 'nord',
  name: 'Nord',
  group: 'dark',
  tokens: {
    /* Surface / Background */
    '--color-page-bg': '#2e3440',
    '--color-sidebar-bg': '#2e3440',
    '--color-sidebar-border': '#3b4252',
    '--color-sidebar-header-border': '#3b4252',
    '--color-sidebar-item-hover-bg': '#3b4252',
    '--color-sidebar-item-active-bg': '#434c5e',
    '--color-navbar-bg': '#2e3440',
    '--color-navbar-border': '#3b4252',
    '--color-card-bg': '#3b4252',
    '--color-card-title-bg': '#2e3440',
    '--color-card-border': '#434c5e',
    '--color-editor-bg': '#2e3440',
    '--color-editor-toolbar-bg': '#3b4252',
    '--color-editor-border': '#434c5e',
    '--color-preview-bg': '#2e3440',
    '--color-preview-meta-bg': '#3b4252',
    '--color-preview-meta-border': '#434c5e',

    /* Text */
    '--color-text-primary': '#d8dee9',
    '--color-text-secondary': '#b4bfcc',
    '--color-text-muted': '#7b88a1',
    '--color-text-hint': '#616e88',
    '--color-text-sidebar': '#d8dee9',
    '--color-text-sidebar-title': '#7b88a1',
    '--color-text-sidebar-count-fg': '#b4bfcc',
    '--color-text-sidebar-count-bg': '#434c5e',
    '--color-text-sidebar-hint': '#7b88a1',
    '--color-text-sidebar-group-label': '#7b88a1',
    '--color-text-editor': '#d8dee9',
    '--color-text-navbar': '#b4bfcc',
    '--color-text-navbar-hover': '#d8dee9',
    '--color-text-navbar-active': '#88c0d0',
    '--color-text-template-btn': '#b4bfcc',
    '--color-text-template-btn-hover': '#d8dee9',
    '--color-text-template-btn-selected': '#88c0d0',

    /* Borders */
    '--color-border-dark': '#2e3440',
    '--color-border-separator': '#434c5e',
    '--color-border-card': '#434c5e',
    '--color-border-light': '#4c566a',
    '--color-border-input': '#434c5e',
    '--color-border-section': '#3b4252',

    /* Accent */
    '--color-accent': '#88c0d0',
    '--color-accent-hover': '#8fbcbb',
    '--color-accent-bg': 'rgba(136, 192, 208, 0.15)',
    '--color-accent-border': '#88c0d0',
    '--color-accent-text': '#88c0d0',
    '--color-accent-text-light': '#88c0d0',

    /* Sidebar buttons */
    '--color-sidebar-btn-bg': '#434c5e',
    '--color-sidebar-btn-border': '#4c566a',
    '--color-sidebar-btn-text': '#b4bfcc',
    '--color-sidebar-btn-hover-bg': '#4c566a',
    '--color-sidebar-btn-hover-text': '#d8dee9',
    '--color-sidebar-btn-active-bg': 'rgba(136, 192, 208, 0.15)',
    '--color-sidebar-btn-active-border': '#88c0d0',
    '--color-sidebar-btn-active-text': '#88c0d0',

    /* Navbar link states */
    '--color-navbar-hover-bg': '#3b4252',
    '--color-navbar-active-bg': 'rgba(136, 192, 208, 0.15)',

    /* Buttons */
    '--color-btn-primary-bg': '#88c0d0',
    '--color-btn-primary-text': '#2e3440',
    '--color-btn-primary-hover': '#8fbcbb',
    '--color-btn-secondary-bg': '#434c5e',
    '--color-btn-secondary-text': '#d8dee9',
    '--color-btn-secondary-border': '#4c566a',
    '--color-btn-secondary-hover': '#4c566a',
    '--color-btn-danger-bg': '#bf616a',
    '--color-btn-danger-text': '#2e3440',
    '--color-btn-danger-hover': '#a9545c',

    /* Editor buttons */
    '--color-editor-apply-bg': 'rgba(136, 192, 208, 0.15)',
    '--color-editor-apply-border': '#88c0d0',
    '--color-editor-apply-text': '#88c0d0',
    '--color-editor-apply-hover': 'rgba(136, 192, 208, 0.25)',
    '--color-editor-close-bg': '#434c5e',
    '--color-editor-close-border': '#4c566a',
    '--color-editor-close-text': '#7b88a1',
    '--color-editor-close-hover-bg': '#4c566a',
    '--color-editor-close-hover-text': '#d8dee9',

    /* Edit JSON button */
    '--color-edit-btn-bg': '#3b4252',
    '--color-edit-btn-border': '#434c5e',
    '--color-edit-btn-text': '#b4bfcc',
    '--color-edit-btn-hover-bg': 'rgba(136, 192, 208, 0.1)',
    '--color-edit-btn-hover-border': '#88c0d0',
    '--color-edit-btn-hover-text': '#88c0d0',
    '--color-edit-btn-active-bg': 'rgba(136, 192, 208, 0.15)',
    '--color-edit-btn-active-border': '#88c0d0',
    '--color-edit-btn-active-text': '#88c0d0',

    /* New template create button */
    '--color-create-btn-bg': 'rgba(136, 192, 208, 0.15)',
    '--color-create-btn-border': '#88c0d0',
    '--color-create-btn-text': '#88c0d0',
    '--color-create-btn-hover': 'rgba(136, 192, 208, 0.25)',

    /* Sidebar form inputs */
    '--color-sidebar-input-bg': '#3b4252',
    '--color-sidebar-input-border': '#434c5e',
    '--color-sidebar-input-text': '#d8dee9',
    '--color-sidebar-input-placeholder': '#616e88',

    /* Status */
    '--color-success-bg': 'rgba(163, 190, 140, 0.15)',
    '--color-success-border': 'rgba(163, 190, 140, 0.4)',
    '--color-success-text': '#a3be8c',
    '--color-error-bg': 'rgba(191, 97, 106, 0.15)',
    '--color-error-border': 'rgba(191, 97, 106, 0.4)',
    '--color-error-text': '#bf616a',
    '--color-warning-text': '#ebcb8b',
    '--color-error-hint-text': '#bf616a',
    '--color-connected-dot': '#4ade80',
    '--color-error-dot': '#bf616a',
    '--color-unknown-dot': '#7b88a1',

    /* Sidebar error */
    '--color-sidebar-error-bg': 'rgba(191, 97, 106, 0.15)',
    '--color-sidebar-error-text': '#bf616a',
    '--color-sidebar-error-border': 'rgba(191, 97, 106, 0.4)',

    /* Editor error */
    '--color-editor-error-bg': 'rgba(191, 97, 106, 0.15)',
    '--color-editor-error-text': '#bf616a',
    '--color-editor-error-border': 'rgba(191, 97, 106, 0.4)',

    /* Import prompt */
    '--color-import-prompt-bg': 'rgba(136, 192, 208, 0.1)',
    '--color-import-prompt-border': 'rgba(136, 192, 208, 0.3)',
    '--color-import-prompt-text': '#b4bfcc',
    '--color-import-prompt-strong': '#d8dee9',
    '--color-import-prompt-code-bg': 'rgba(136, 192, 208, 0.15)',
    '--color-import-prompt-code-text': '#88c0d0',

    /* Tags */
    '--color-tag-p-bg': 'rgba(136, 192, 208, 0.15)',
    '--color-tag-p-text': '#88c0d0',
    '--color-tag-ls-bg': 'rgba(180, 142, 173, 0.15)',
    '--color-tag-ls-text': '#b48ead',
    '--color-tag-cat-bg': '#434c5e',
    '--color-tag-cat-text': '#b4bfcc',
    '--color-tag-file-bg': '#3b4252',
    '--color-tag-file-text': '#7b88a1',
    '--color-tag-custom-bg': 'rgba(208, 135, 112, 0.15)',
    '--color-tag-custom-text': '#d08770',
    '--color-tag-cat-hover-bg': '#4c566a',
    '--color-tag-cat-active-bg': 'rgba(136, 192, 208, 0.15)',
    '--color-tag-cat-active-text': '#88c0d0',
    '--color-tag-p-hover-bg': 'rgba(136, 192, 208, 0.25)',
    '--color-tag-ls-hover-bg': 'rgba(180, 142, 173, 0.25)',
    '--color-tag-p-active-bg': 'rgba(136, 192, 208, 0.3)',
    '--color-tag-ls-active-bg': 'rgba(180, 142, 173, 0.3)',

    /* Orientation badges */
    '--color-orient-p-bg': 'rgba(136, 192, 208, 0.15)',
    '--color-orient-p-text': '#88c0d0',
    '--color-orient-ls-bg': 'rgba(180, 142, 173, 0.15)',
    '--color-orient-ls-text': '#b48ead',
    '--color-orient-custom-bg': 'rgba(208, 135, 112, 0.15)',
    '--color-orient-custom-text': '#d08770',

    /* Sync badges */
    '--color-sync-synced-bg': 'rgba(163, 190, 140, 0.15)',
    '--color-sync-synced-text': '#a3be8c',
    '--color-sync-local-bg': 'rgba(136, 192, 208, 0.15)',
    '--color-sync-local-text': '#88c0d0',
    '--color-sync-modified-bg': 'rgba(235, 203, 139, 0.15)',
    '--color-sync-modified-text': '#ebcb8b',
    '--color-sync-device-bg': '#434c5e',
    '--color-sync-device-text': '#b4bfcc',

    /* Forms */
    '--color-form-input-bg': '#3b4252',
    '--color-form-input-border': '#434c5e',
    '--color-form-input-text': '#d8dee9',
    '--color-form-label': '#d8dee9',
    '--color-form-focus-ring': 'rgba(136, 192, 208, 0.2)',

    /* Help / callout */
    '--color-help-bg': 'rgba(136, 192, 208, 0.1)',
    '--color-help-border': 'rgba(136, 192, 208, 0.3)',
    '--color-help-text': '#b4bfcc',
    '--color-help-code-bg': 'rgba(136, 192, 208, 0.15)',

    /* Remove-all preview */
    '--color-remove-preview-bg': 'rgba(191, 97, 106, 0.1)',
    '--color-remove-preview-border': 'rgba(191, 97, 106, 0.3)',
    '--color-remove-list-text': '#d8dee9',

    /* SVG preview */
    '--color-svg-shadow': 'rgba(0, 0, 0, 0.3)',
    '--color-svg-border': '#434c5e',

    /* Scrollbar */
    '--color-scrollbar-track': 'transparent',
    '--color-scrollbar-thumb': '#434c5e',

    /* Stage */
    '--color-stage-hint': '#7b88a1',
    '--color-stage-error': '#bf616a',

    /* Filter clear */
    '--color-filter-clear': '#b4bfcc',
    '--color-filter-clear-hover': '#bf616a',

    /* Progress */
    '--color-progress-bar-bg': '#434c5e',
    '--color-progress-fill': '#88c0d0',
    '--color-progress-label': '#7b88a1',
    '--color-progress-tip': '#616e88',

    /* Connection badge */
    '--color-connection-badge-bg': '#434c5e',
    '--color-connection-badge-text': '#b4bfcc',
    '--color-connection-detail': '#7b88a1',

    /* Card code */
    '--color-card-code-bg': '#2e3440',
    '--color-card-code-text': '#d8dee9',

    /* Device op */
    '--color-op-desc': '#b4bfcc',
    '--color-op-result-success': '#a3be8c',
    '--color-op-result-error': '#bf616a',

    /* Sync section toggle */
    '--color-sync-toggle': '#88c0d0',
    '--color-sync-toggle-hover': '#8fbcbb',
    '--color-sync-subsection-title': '#b4bfcc',

    /* Danger zone */
    '--color-danger-title': '#bf616a',

    /* Link */
    '--color-link': '#88c0d0',
    '--color-link-hover': '#8fbcbb',

    /* Backup entry */
    '--color-backup-entry-bg': '#3b4252',
    '--color-backup-entry-border': '#434c5e',

    /* Sync status entry */
    '--color-sync-entry-bg': '#3b4252',
    '--color-sync-entry-hover-bg': '#434c5e',

    /* Subtitle */
    '--color-subtitle': '#b4bfcc',

    /* Template btn selected border */
    '--color-template-btn-selected-border': '#88c0d0',

    /* Tag download hover */
    '--color-tag-download-hover-text': '#88c0d0',
    '--color-tag-download-hover-bg': 'rgba(136, 192, 208, 0.15)',
  },
  monacoTheme: {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'string.key.json', foreground: '88c0d0' },
      { token: 'string.value.json', foreground: 'a3be8c' },
      { token: 'number.json', foreground: 'b48ead' },
      { token: 'keyword.json', foreground: '81a1c1' },
      { token: 'delimiter.bracket.json', foreground: 'd8dee9' },
      { token: 'delimiter.colon.json', foreground: 'd8dee9' },
      { token: 'delimiter.comma.json', foreground: 'd8dee9' },
    ],
    colors: {
      'editor.background': '#2e3440',
      'editor.foreground': '#d8dee9',
      'editor.lineHighlightBackground': '#3b4252',
      'editorLineNumber.foreground': '#616e88',
      'editorLineNumber.activeForeground': '#d8dee9',
      'editor.selectionBackground': '#434c5e',
      'editorCursor.foreground': '#88c0d0',
      'editorBracketMatch.background': '#88c0d026',
      'editorBracketMatch.border': '#88c0d0',
      'editorBracketHighlight.foreground1': '#88c0d0',
      'editorBracketHighlight.foreground2': '#b48ead',
      'editorBracketHighlight.foreground3': '#81a1c1',
      'editorBracketHighlight.unexpectedBracket.foreground': '#4c566a',
    },
  },
}
