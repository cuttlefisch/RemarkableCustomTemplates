/** Entry in templates.json — describes a template available on the device */
export type TemplateCategory = 'Creative' | 'Lines' | 'Grids' | 'Planners' | 'Dark' | string

export interface TemplateRegistryEntry {
  name: string
  filename: string
  iconCode: string
  landscape?: boolean
  categories: TemplateCategory[]
  isCustom?: boolean
  /** UUID used as xochitl filename for rm_methods deployment; persisted on first export. */
  rmMethodsId?: string
}

export interface TemplateRegistry {
  templates: TemplateRegistryEntry[]
}
