/** Well-known template category names, plus any custom string. */
export type TemplateCategory = 'Creative' | 'Lines' | 'Grids' | 'Planners' | 'Dark' | string

/** Entry in templates.json — describes a single template available on the device. */
export interface TemplateRegistryEntry {
  name: string
  filename: string
  iconCode: string
  landscape?: boolean
  categories: TemplateCategory[]
  isCustom?: boolean
  /** UUID used as xochitl filename for rm_methods deployment; persisted on first export. */
  rmMethodsId?: string
  /** Origin tag for methods templates pulled from the device. */
  origin?: 'official-methods' | 'custom-methods' | string
  /** Base64-encoded SVG thumbnail for sidebar display. */
  iconData?: string
}

/** The full templates.json structure — an array of registry entries. */
export interface TemplateRegistry {
  templates: TemplateRegistryEntry[]
}
