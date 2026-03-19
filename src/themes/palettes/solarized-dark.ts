import type { Theme } from '../themes'

export const solarizedDark: Theme = {
  id: 'solarized-dark',
  name: 'Solarized Dark',
  group: 'dark',
  tokens: {
    /* Surface / Background */
    '--color-page-bg': '#002b36',
    '--color-sidebar-bg': '#073642',
    '--color-sidebar-border': '#004052',
    '--color-sidebar-header-border': '#004052',
    '--color-sidebar-item-hover-bg': '#094858',
    '--color-sidebar-item-active-bg': '#094858',
    '--color-navbar-bg': '#073642',
    '--color-navbar-border': '#004052',
    '--color-card-bg': '#073642',
    '--color-card-title-bg': '#002b36',
    '--color-card-border': '#586e75',
    '--color-editor-bg': '#002b36',
    '--color-editor-toolbar-bg': '#073642',
    '--color-editor-border': '#586e75',
    '--color-preview-bg': '#002b36',
    '--color-preview-meta-bg': '#073642',
    '--color-preview-meta-border': '#586e75',

    /* Text */
    '--color-text-primary': '#839496',
    '--color-text-secondary': '#657b83',
    '--color-text-muted': '#586e75',
    '--color-text-hint': '#586e75',
    '--color-text-sidebar': '#839496',
    '--color-text-sidebar-title': '#586e75',
    '--color-text-sidebar-count-fg': '#657b83',
    '--color-text-sidebar-count-bg': '#094858',
    '--color-text-sidebar-hint': '#586e75',
    '--color-text-sidebar-group-label': '#586e75',
    '--color-text-editor': '#839496',
    '--color-text-navbar': '#657b83',
    '--color-text-navbar-hover': '#93a1a1',
    '--color-text-navbar-active': '#268bd2',
    '--color-text-template-btn': '#657b83',
    '--color-text-template-btn-hover': '#93a1a1',
    '--color-text-template-btn-selected': '#268bd2',

    /* Borders */
    '--color-border-dark': '#004052',
    '--color-border-separator': '#586e75',
    '--color-border-card': '#586e75',
    '--color-border-light': '#586e75',
    '--color-border-input': '#586e75',
    '--color-border-section': '#073642',

    /* Accent */
    '--color-accent': '#268bd2',
    '--color-accent-hover': '#1a6da0',
    '--color-accent-bg': 'rgba(38, 139, 210, 0.15)',
    '--color-accent-border': '#268bd2',
    '--color-accent-text': '#268bd2',
    '--color-accent-text-light': '#268bd2',

    /* Sidebar buttons */
    '--color-sidebar-btn-bg': '#094858',
    '--color-sidebar-btn-border': '#586e75',
    '--color-sidebar-btn-text': '#657b83',
    '--color-sidebar-btn-hover-bg': '#0b5a6e',
    '--color-sidebar-btn-hover-text': '#93a1a1',
    '--color-sidebar-btn-active-bg': 'rgba(38, 139, 210, 0.15)',
    '--color-sidebar-btn-active-border': '#268bd2',
    '--color-sidebar-btn-active-text': '#268bd2',

    /* Navbar link states */
    '--color-navbar-hover-bg': '#094858',
    '--color-navbar-active-bg': 'rgba(38, 139, 210, 0.15)',

    /* Buttons */
    '--color-btn-primary-bg': '#268bd2',
    '--color-btn-primary-text': '#002b36',
    '--color-btn-primary-hover': '#1a6da0',
    '--color-btn-secondary-bg': '#094858',
    '--color-btn-secondary-text': '#839496',
    '--color-btn-secondary-border': '#586e75',
    '--color-btn-secondary-hover': '#0b5a6e',
    '--color-btn-danger-bg': '#dc322f',
    '--color-btn-danger-text': '#fdf6e3',
    '--color-btn-danger-hover': '#b52826',

    /* Editor buttons */
    '--color-editor-apply-bg': 'rgba(38, 139, 210, 0.15)',
    '--color-editor-apply-border': '#268bd2',
    '--color-editor-apply-text': '#268bd2',
    '--color-editor-apply-hover': 'rgba(38, 139, 210, 0.25)',
    '--color-editor-close-bg': '#094858',
    '--color-editor-close-border': '#586e75',
    '--color-editor-close-text': '#586e75',
    '--color-editor-close-hover-bg': '#0b5a6e',
    '--color-editor-close-hover-text': '#93a1a1',

    /* Edit JSON button */
    '--color-edit-btn-bg': '#073642',
    '--color-edit-btn-border': '#586e75',
    '--color-edit-btn-text': '#657b83',
    '--color-edit-btn-hover-bg': 'rgba(38, 139, 210, 0.1)',
    '--color-edit-btn-hover-border': '#268bd2',
    '--color-edit-btn-hover-text': '#268bd2',
    '--color-edit-btn-active-bg': 'rgba(38, 139, 210, 0.15)',
    '--color-edit-btn-active-border': '#268bd2',
    '--color-edit-btn-active-text': '#268bd2',

    /* New template create button */
    '--color-create-btn-bg': 'rgba(38, 139, 210, 0.15)',
    '--color-create-btn-border': '#268bd2',
    '--color-create-btn-text': '#268bd2',
    '--color-create-btn-hover': 'rgba(38, 139, 210, 0.25)',

    /* Sidebar form inputs */
    '--color-sidebar-input-bg': '#073642',
    '--color-sidebar-input-border': '#586e75',
    '--color-sidebar-input-text': '#839496',
    '--color-sidebar-input-placeholder': '#586e75',

    /* Status */
    '--color-success-bg': 'rgba(133, 153, 0, 0.15)',
    '--color-success-border': 'rgba(133, 153, 0, 0.4)',
    '--color-success-text': '#859900',
    '--color-error-bg': 'rgba(220, 50, 47, 0.15)',
    '--color-error-border': 'rgba(220, 50, 47, 0.4)',
    '--color-error-text': '#dc322f',
    '--color-warning-text': '#b58900',
    '--color-error-hint-text': '#dc322f',
    '--color-connected-dot': '#4ade80',
    '--color-error-dot': '#dc322f',
    '--color-unknown-dot': '#586e75',

    /* Sidebar error */
    '--color-sidebar-error-bg': 'rgba(220, 50, 47, 0.15)',
    '--color-sidebar-error-text': '#dc322f',
    '--color-sidebar-error-border': 'rgba(220, 50, 47, 0.4)',

    /* Editor error */
    '--color-editor-error-bg': 'rgba(220, 50, 47, 0.15)',
    '--color-editor-error-text': '#dc322f',
    '--color-editor-error-border': 'rgba(220, 50, 47, 0.4)',

    /* Import prompt */
    '--color-import-prompt-bg': 'rgba(38, 139, 210, 0.1)',
    '--color-import-prompt-border': 'rgba(38, 139, 210, 0.3)',
    '--color-import-prompt-text': '#657b83',
    '--color-import-prompt-strong': '#93a1a1',
    '--color-import-prompt-code-bg': 'rgba(38, 139, 210, 0.15)',
    '--color-import-prompt-code-text': '#268bd2',

    /* Tags */
    '--color-tag-p-bg': 'rgba(38, 139, 210, 0.15)',
    '--color-tag-p-text': '#268bd2',
    '--color-tag-ls-bg': 'rgba(108, 113, 196, 0.15)',
    '--color-tag-ls-text': '#6c71c4',
    '--color-tag-cat-bg': '#094858',
    '--color-tag-cat-text': '#657b83',
    '--color-tag-file-bg': '#073642',
    '--color-tag-file-text': '#586e75',
    '--color-tag-custom-bg': 'rgba(203, 75, 22, 0.15)',
    '--color-tag-custom-text': '#cb4b16',
    '--color-tag-cat-hover-bg': '#0b5a6e',
    '--color-tag-cat-active-bg': 'rgba(38, 139, 210, 0.15)',
    '--color-tag-cat-active-text': '#268bd2',
    '--color-tag-p-hover-bg': 'rgba(38, 139, 210, 0.25)',
    '--color-tag-ls-hover-bg': 'rgba(108, 113, 196, 0.25)',
    '--color-tag-p-active-bg': 'rgba(38, 139, 210, 0.3)',
    '--color-tag-ls-active-bg': 'rgba(108, 113, 196, 0.3)',

    /* Orientation badges */
    '--color-orient-p-bg': 'rgba(38, 139, 210, 0.15)',
    '--color-orient-p-text': '#268bd2',
    '--color-orient-ls-bg': 'rgba(108, 113, 196, 0.15)',
    '--color-orient-ls-text': '#6c71c4',
    '--color-orient-custom-bg': 'rgba(203, 75, 22, 0.15)',
    '--color-orient-custom-text': '#cb4b16',

    /* Sync badges */
    '--color-sync-synced-bg': 'rgba(133, 153, 0, 0.15)',
    '--color-sync-synced-text': '#859900',
    '--color-sync-local-bg': 'rgba(38, 139, 210, 0.15)',
    '--color-sync-local-text': '#268bd2',
    '--color-sync-modified-bg': 'rgba(181, 137, 0, 0.15)',
    '--color-sync-modified-text': '#b58900',
    '--color-sync-device-bg': '#094858',
    '--color-sync-device-text': '#657b83',

    /* Forms */
    '--color-form-input-bg': '#073642',
    '--color-form-input-border': '#586e75',
    '--color-form-input-text': '#839496',
    '--color-form-label': '#839496',
    '--color-form-focus-ring': 'rgba(38, 139, 210, 0.2)',

    /* Help / callout */
    '--color-help-bg': 'rgba(38, 139, 210, 0.1)',
    '--color-help-border': 'rgba(38, 139, 210, 0.3)',
    '--color-help-text': '#657b83',
    '--color-help-code-bg': 'rgba(38, 139, 210, 0.15)',

    /* Remove-all preview */
    '--color-remove-preview-bg': 'rgba(220, 50, 47, 0.1)',
    '--color-remove-preview-border': 'rgba(220, 50, 47, 0.3)',
    '--color-remove-list-text': '#839496',

    /* SVG preview */
    '--color-svg-shadow': 'rgba(0, 0, 0, 0.4)',
    '--color-svg-border': '#586e75',

    /* Scrollbar */
    '--color-scrollbar-track': 'transparent',
    '--color-scrollbar-thumb': '#586e75',

    /* Stage */
    '--color-stage-hint': '#586e75',
    '--color-stage-error': '#dc322f',

    /* Filter clear */
    '--color-filter-clear': '#657b83',
    '--color-filter-clear-hover': '#dc322f',

    /* Progress */
    '--color-progress-bar-bg': '#094858',
    '--color-progress-fill': '#268bd2',
    '--color-progress-label': '#586e75',
    '--color-progress-tip': '#586e75',

    /* Connection badge */
    '--color-connection-badge-bg': '#094858',
    '--color-connection-badge-text': '#657b83',
    '--color-connection-detail': '#586e75',

    /* Card code */
    '--color-card-code-bg': '#002b36',
    '--color-card-code-text': '#839496',

    /* Device op */
    '--color-op-desc': '#657b83',
    '--color-op-result-success': '#859900',
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
    '--color-backup-entry-bg': '#073642',
    '--color-backup-entry-border': '#586e75',

    /* Sync status entry */
    '--color-sync-entry-bg': '#073642',
    '--color-sync-entry-hover-bg': '#094858',

    /* Subtitle */
    '--color-subtitle': '#657b83',

    /* Template btn selected border */
    '--color-template-btn-selected-border': '#268bd2',

    /* Tag download hover */
    '--color-tag-download-hover-text': '#268bd2',
    '--color-tag-download-hover-bg': 'rgba(38, 139, 210, 0.15)',
  },
  monacoTheme: {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'string.key.json', foreground: '268bd2' },
      { token: 'string.value.json', foreground: '2aa198' },
      { token: 'number.json', foreground: 'd33682' },
      { token: 'keyword.json', foreground: '859900' },
      { token: 'delimiter.bracket.json', foreground: '839496' },
      { token: 'delimiter.colon.json', foreground: '839496' },
      { token: 'delimiter.comma.json', foreground: '839496' },
    ],
    colors: {
      'editor.background': '#002b36',
      'editor.foreground': '#839496',
      'editor.lineHighlightBackground': '#073642',
      'editorLineNumber.foreground': '#586e75',
      'editorLineNumber.activeForeground': '#93a1a1',
      'editor.selectionBackground': '#094858',
      'editorCursor.foreground': '#268bd2',
      'editorBracketMatch.background': 'rgba(38, 139, 210, 0.15)',
      'editorBracketMatch.border': '#268bd2',
    },
  },
}
