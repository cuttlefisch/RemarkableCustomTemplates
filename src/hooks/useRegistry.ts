import { useState, useEffect, createContext, useContext } from 'react'
import { parseRegistry } from '../lib/registry'
import { parseTemplate } from '../lib/parser'
import { mergeCategories, mergeRegistries } from '../lib/customTemplates'
import type { TemplateRegistry } from '../types/registry'

export interface RegistryState {
  registry: TemplateRegistry | null
  setRegistry: React.Dispatch<React.SetStateAction<TemplateRegistry | null>>
  customRegistry: TemplateRegistry
  setCustomRegistry: React.Dispatch<React.SetStateAction<TemplateRegistry>>
  loadingRegistry: boolean
  officialTemplatesAvailable: boolean | null
  mergedRegistry: TemplateRegistry | null
  existingCustomNames: string[]
}

export const RegistryContext = createContext<RegistryState | null>(null)

export function useRegistryContext(): RegistryState {
  const ctx = useContext(RegistryContext)
  if (!ctx) throw new Error('useRegistryContext must be used within RegistryContext.Provider')
  return ctx
}

export function useRegistry(): RegistryState {
  const [registry, setRegistry] = useState<TemplateRegistry | null>(null)
  const [customRegistry, setCustomRegistry] = useState<TemplateRegistry>({ templates: [] })
  const [loadingRegistry, setLoadingRegistry] = useState(true)
  const [officialTemplatesAvailable, setOfficialTemplatesAvailable] = useState<boolean | null>(null)

  useEffect(() => {
    const mainFetch = fetch('/templates/templates.json')
      .then(r => {
        if (r.status === 404) { setOfficialTemplatesAvailable(false); return null }
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(data => {
        if (data === null) return { templates: [] }
        setOfficialTemplatesAvailable(true)
        return parseRegistry(data)
      })

    const customFetch = fetch('/templates/custom/custom-registry.json')
      .then(r => { if (!r.ok) return { templates: [] }; return r.json() })
      .then(data => {
        try { return parseRegistry(data) } catch { return { templates: [] } }
      })

    Promise.all([mainFetch, customFetch])
      .then(([main, custom]) => {
        setRegistry(main)
        return Promise.all(
          custom.templates.map(async entry => {
            try {
              const slug = entry.filename.split('/').map(s => encodeURIComponent(s)).join('/')
              const r = await fetch(`/templates/${slug}.template`)
              if (!r.ok) return entry
              const data = await r.json()
              const tpl = parseTemplate(data)
              const synced = mergeCategories(tpl.categories)
              return { ...entry, categories: synced }
            } catch {
              return entry
            }
          }),
        ).then(syncedTemplates => {
          setCustomRegistry({ templates: syncedTemplates })
          setLoadingRegistry(false)
        })
      })
      .catch(e => {
        console.error(`Failed to load registry: ${String(e)}`)
        setLoadingRegistry(false)
      })
  }, [])

  const mergedRegistry = registry ? mergeRegistries(registry, customRegistry) : null
  const existingCustomNames = customRegistry.templates.map(t => t.name)

  return {
    registry,
    setRegistry,
    customRegistry,
    setCustomRegistry,
    loadingRegistry,
    officialTemplatesAvailable,
    mergedRegistry,
    existingCustomNames,
  }
}
