/** Entry in templates.json — describes a template available on the device */
export type TemplateCategory = 'Creative' | 'Lines' | 'Grids' | 'Planners' | 'Dark' | string

export interface TemplateRegistryEntry {
  name: string
  filename: string
  iconCode: string
  landscape?: boolean
  categories: TemplateCategory[]
}

export interface TemplateRegistry {
  templates: TemplateRegistryEntry[]
}
