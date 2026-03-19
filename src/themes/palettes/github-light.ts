import type { Theme } from '../themes'

export const githubLight: Theme = {
  id: 'github-light',
  name: 'GitHub Light',
  group: 'light',
  tokens: {
    /* Surface / Background */
    '--color-page-bg': '#f6f8fa',
    '--color-sidebar-bg': '#ffffff',
    '--color-sidebar-border': '#d0d7de',
    '--color-sidebar-header-border': '#d0d7de',
    '--color-sidebar-item-hover-bg': '#f3f4f6',
    '--color-sidebar-item-active-bg': '#ddf4ff',
    '--color-navbar-bg': '#ffffff',
    '--color-navbar-border': '#d0d7de',
    '--color-card-bg': '#ffffff',
    '--color-card-title-bg': '#f6f8fa',
    '--color-card-border': '#d0d7de',
    '--color-editor-bg': '#ffffff',
    '--color-editor-toolbar-bg': '#f6f8fa',
    '--color-editor-border': '#d0d7de',
    '--color-preview-bg': '#f6f8fa',
    '--color-preview-meta-bg': '#ffffff',
    '--color-preview-meta-border': '#d0d7de',

    /* Text */
    '--color-text-primary': '#1f2328',
    '--color-text-secondary': '#656d76',
    '--color-text-muted': '#8b949e',
    '--color-text-hint': '#8b949e',
    '--color-text-sidebar': '#1f2328',
    '--color-text-sidebar-title': '#656d76',
    '--color-text-sidebar-count-fg': '#656d76',
    '--color-text-sidebar-count-bg': '#eff1f3',
    '--color-text-sidebar-hint': '#656d76',
    '--color-text-sidebar-group-label': '#656d76',
    '--color-text-editor': '#1f2328',
    '--color-text-navbar': '#656d76',
    '--color-text-navbar-hover': '#1f2328',
    '--color-text-navbar-active': '#0969da',
    '--color-text-template-btn': '#656d76',
    '--color-text-template-btn-hover': '#1f2328',
    '--color-text-template-btn-selected': '#0969da',

    /* Borders */
    '--color-border-dark': '#d0d7de',
    '--color-border-separator': '#d0d7de',
    '--color-border-card': '#d0d7de',
    '--color-border-light': '#d8dee4',
    '--color-border-input': '#d0d7de',
    '--color-border-section': '#eff1f3',

    /* Accent */
    '--color-accent': '#0969da',
    '--color-accent-hover': '#0550ae',
    '--color-accent-bg': '#ddf4ff',
    '--color-accent-border': '#0969da',
    '--color-accent-text': '#0969da',
    '--color-accent-text-light': '#0969da',

    /* Sidebar buttons */
    '--color-sidebar-btn-bg': '#f3f4f6',
    '--color-sidebar-btn-border': '#d0d7de',
    '--color-sidebar-btn-text': '#656d76',
    '--color-sidebar-btn-hover-bg': '#eaeef2',
    '--color-sidebar-btn-hover-text': '#1f2328',
    '--color-sidebar-btn-active-bg': '#ddf4ff',
    '--color-sidebar-btn-active-border': '#0969da',
    '--color-sidebar-btn-active-text': '#0969da',

    /* Navbar link states */
    '--color-navbar-hover-bg': '#f3f4f6',
    '--color-navbar-active-bg': '#ddf4ff',

    /* Buttons */
    '--color-btn-primary-bg': '#0969da',
    '--color-btn-primary-text': '#ffffff',
    '--color-btn-primary-hover': '#0550ae',
    '--color-btn-secondary-bg': '#f3f4f6',
    '--color-btn-secondary-text': '#1f2328',
    '--color-btn-secondary-border': '#d0d7de',
    '--color-btn-secondary-hover': '#eaeef2',
    '--color-btn-danger-bg': '#cf222e',
    '--color-btn-danger-text': '#ffffff',
    '--color-btn-danger-hover': '#a40e26',

    /* Editor buttons */
    '--color-editor-apply-bg': '#ddf4ff',
    '--color-editor-apply-border': '#0969da',
    '--color-editor-apply-text': '#0550ae',
    '--color-editor-apply-hover': '#b6e3ff',
    '--color-editor-close-bg': '#f3f4f6',
    '--color-editor-close-border': '#d0d7de',
    '--color-editor-close-text': '#656d76',
    '--color-editor-close-hover-bg': '#eaeef2',
    '--color-editor-close-hover-text': '#1f2328',

    /* Edit JSON button */
    '--color-edit-btn-bg': '#f3f4f6',
    '--color-edit-btn-border': '#d0d7de',
    '--color-edit-btn-text': '#656d76',
    '--color-edit-btn-hover-bg': '#ddf4ff',
    '--color-edit-btn-hover-border': '#54aeff',
    '--color-edit-btn-hover-text': '#0550ae',
    '--color-edit-btn-active-bg': '#b6e3ff',
    '--color-edit-btn-active-border': '#0969da',
    '--color-edit-btn-active-text': '#0550ae',

    /* New template create button */
    '--color-create-btn-bg': '#ddf4ff',
    '--color-create-btn-border': '#0969da',
    '--color-create-btn-text': '#0969da',
    '--color-create-btn-hover': '#b6e3ff',

    /* Sidebar form inputs */
    '--color-sidebar-input-bg': '#ffffff',
    '--color-sidebar-input-border': '#d0d7de',
    '--color-sidebar-input-text': '#1f2328',
    '--color-sidebar-input-placeholder': '#8b949e',

    /* Status */
    '--color-success-bg': '#dafbe1',
    '--color-success-border': '#82e596',
    '--color-success-text': '#116329',
    '--color-error-bg': '#ffebe9',
    '--color-error-border': '#ff8182',
    '--color-error-text': '#cf222e',
    '--color-warning-text': '#9a6700',
    '--color-error-hint-text': '#82071e',
    '--color-connected-dot': '#16a34a',
    '--color-error-dot': '#cf222e',
    '--color-unknown-dot': '#8b949e',

    /* Sidebar error */
    '--color-sidebar-error-bg': '#ffebe9',
    '--color-sidebar-error-text': '#cf222e',
    '--color-sidebar-error-border': '#ff8182',

    /* Editor error */
    '--color-editor-error-bg': '#ffebe9',
    '--color-editor-error-text': '#cf222e',
    '--color-editor-error-border': '#ff8182',

    /* Import prompt */
    '--color-import-prompt-bg': '#ddf4ff',
    '--color-import-prompt-border': '#54aeff',
    '--color-import-prompt-text': '#0550ae',
    '--color-import-prompt-strong': '#1f2328',
    '--color-import-prompt-code-bg': '#b6e3ff',
    '--color-import-prompt-code-text': '#0550ae',

    /* Tags */
    '--color-tag-p-bg': '#ddf4ff',
    '--color-tag-p-text': '#0550ae',
    '--color-tag-ls-bg': '#fbefff',
    '--color-tag-ls-text': '#8250df',
    '--color-tag-cat-bg': '#f3f4f6',
    '--color-tag-cat-text': '#656d76',
    '--color-tag-file-bg': '#f3f4f6',
    '--color-tag-file-text': '#8b949e',
    '--color-tag-custom-bg': '#3d2a00',
    '--color-tag-custom-text': '#ffb340',
    '--color-tag-cat-hover-bg': '#eaeef2',
    '--color-tag-cat-active-bg': '#ddf4ff',
    '--color-tag-cat-active-text': '#0550ae',
    '--color-tag-p-hover-bg': '#b6e3ff',
    '--color-tag-ls-hover-bg': '#f0d6ff',
    '--color-tag-p-active-bg': '#80ccff',
    '--color-tag-ls-active-bg': '#e2b0ff',

    /* Orientation badges */
    '--color-orient-p-bg': '#ddf4ff',
    '--color-orient-p-text': '#0969da',
    '--color-orient-ls-bg': '#fbefff',
    '--color-orient-ls-text': '#8250df',
    '--color-orient-custom-bg': '#3d2a00',
    '--color-orient-custom-text': '#ffb340',

    /* Sync badges */
    '--color-sync-synced-bg': '#dafbe1',
    '--color-sync-synced-text': '#116329',
    '--color-sync-local-bg': '#ddf4ff',
    '--color-sync-local-text': '#0550ae',
    '--color-sync-modified-bg': '#fff8c5',
    '--color-sync-modified-text': '#9a6700',
    '--color-sync-device-bg': '#f3f4f6',
    '--color-sync-device-text': '#656d76',

    /* Forms */
    '--color-form-input-bg': '#ffffff',
    '--color-form-input-border': '#d0d7de',
    '--color-form-input-text': '#1f2328',
    '--color-form-label': '#1f2328',
    '--color-form-focus-ring': 'rgba(9, 105, 218, 0.15)',

    /* Help / callout */
    '--color-help-bg': '#ddf4ff',
    '--color-help-border': '#54aeff',
    '--color-help-text': '#0550ae',
    '--color-help-code-bg': '#b6e3ff',

    /* Remove-all preview */
    '--color-remove-preview-bg': '#ffebe9',
    '--color-remove-preview-border': '#ffcecb',
    '--color-remove-list-text': '#1f2328',

    /* SVG preview */
    '--color-svg-shadow': 'rgba(31, 35, 40, 0.12)',
    '--color-svg-border': '#d0d7de',

    /* Scrollbar */
    '--color-scrollbar-track': 'transparent',
    '--color-scrollbar-thumb': '#d0d7de',

    /* Stage */
    '--color-stage-hint': '#8b949e',
    '--color-stage-error': '#cf222e',

    /* Filter clear */
    '--color-filter-clear': '#656d76',
    '--color-filter-clear-hover': '#cf222e',

    /* Progress */
    '--color-progress-bar-bg': '#d8dee4',
    '--color-progress-fill': '#0969da',
    '--color-progress-label': '#8b949e',
    '--color-progress-tip': '#8b949e',

    /* Connection badge */
    '--color-connection-badge-bg': '#f3f4f6',
    '--color-connection-badge-text': '#656d76',
    '--color-connection-detail': '#8b949e',

    /* Card code */
    '--color-card-code-bg': '#f6f8fa',
    '--color-card-code-text': '#1f2328',

    /* Device op */
    '--color-op-desc': '#656d76',
    '--color-op-result-success': '#116329',
    '--color-op-result-error': '#cf222e',

    /* Sync section toggle */
    '--color-sync-toggle': '#0969da',
    '--color-sync-toggle-hover': '#0550ae',
    '--color-sync-subsection-title': '#656d76',

    /* Danger zone */
    '--color-danger-title': '#cf222e',

    /* Link */
    '--color-link': '#0969da',
    '--color-link-hover': '#0550ae',

    /* Backup entry */
    '--color-backup-entry-bg': '#f6f8fa',
    '--color-backup-entry-border': '#eff1f3',

    /* Sync status entry */
    '--color-sync-entry-bg': '#f6f8fa',
    '--color-sync-entry-hover-bg': '#f3f4f6',

    /* Subtitle */
    '--color-subtitle': '#656d76',

    /* Template btn selected border */
    '--color-template-btn-selected-border': '#0969da',

    /* Tag download hover */
    '--color-tag-download-hover-text': '#0550ae',
    '--color-tag-download-hover-bg': '#ddf4ff',
  },
  monacoTheme: {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'string.key.json', foreground: '0550ae' },
      { token: 'string.value.json', foreground: '0a3069' },
      { token: 'number.json', foreground: '0550ae' },
      { token: 'keyword.json', foreground: 'cf222e' },
      { token: 'delimiter.bracket.json', foreground: '1f2328' },
      { token: 'delimiter.colon.json', foreground: '1f2328' },
      { token: 'delimiter.comma.json', foreground: '1f2328' },
    ],
    colors: {
      'editor.background': '#ffffff',
      'editor.foreground': '#1f2328',
      'editor.lineHighlightBackground': '#f6f8fa',
      'editorLineNumber.foreground': '#8b949e',
      'editorLineNumber.activeForeground': '#1f2328',
      'editor.selectionBackground': '#b6e3ff',
      'editorCursor.foreground': '#0969da',
      'editorBracketMatch.background': '#b6e3ff40',
      'editorBracketMatch.border': '#0969da',
      'editorBracketHighlight.foreground1': '#0969da',
      'editorBracketHighlight.foreground2': '#8250df',
      'editorBracketHighlight.foreground3': '#0550ae',
      'editorBracketHighlight.unexpectedBracket.foreground': '#656d76',
    },
  },
}
