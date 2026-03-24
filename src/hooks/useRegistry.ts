import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { parseRegistry } from '../lib/registry'
import { parseTemplate } from '../lib/parser'
import { mergeCategories, mergeRegistries } from '../lib/customTemplates'
import type { TemplateRegistry } from '../types/registry'

/** State shape for the template registry context — official, custom, and merged registries. */
export interface RegistryState {
  registry: TemplateRegistry | null
  setRegistry: React.Dispatch<React.SetStateAction<TemplateRegistry | null>>
  customRegistry: TemplateRegistry
  setCustomRegistry: React.Dispatch<React.SetStateAction<TemplateRegistry>>
  loadingRegistry: boolean
  officialTemplatesAvailable: boolean | null
  mergedRegistry: TemplateRegistry | null
  existingCustomNames: string[]
  refreshRegistry: () => void
}

/** React context for template registry state. Provide via `useRegistry()` at the app root. */
export const RegistryContext = createContext<RegistryState | null>(null)

/**
 * Consume the template registry from `RegistryContext`. Must be within a provider.
 * @returns The full registry state including official, custom, and merged registries.
 */
export function useRegistryContext(): RegistryState {
  const ctx = useContext(RegistryContext)
  if (!ctx) throw new Error('useRegistryContext must be used within RegistryContext.Provider')
  return ctx
}

/**
 * Fetches and manages the official + custom template registries.
 * Loads `templates.json` and `custom-registry.json` on mount, syncs categories
 * from template files, and provides a merged view for the UI.
 *
 * @returns Registry state with official, custom, and merged registries plus a refresh trigger.
 */
export function useRegistry(): RegistryState {
  const [registry, setRegistry] = useState<TemplateRegistry | null>(null)
  const [customRegistry, setCustomRegistry] = useState<TemplateRegistry>({ templates: [] })
  const [loadingRegistry, setLoadingRegistry] = useState(true)
  const [officialTemplatesAvailable, setOfficialTemplatesAvailable] = useState<boolean | null>(null)
  const [fetchKey, setFetchKey] = useState(0)

  const refreshRegistry = useCallback(() => {
    setFetchKey(k => k + 1)
  }, [])

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
      .catch(() => ({ templates: [] } as TemplateRegistry))

    Promise.all([mainFetch, customFetch])
      .then(([main, custom]) => {
        setRegistry(main)
        return Promise.all(
          custom.templates.map(async entry => {
            try {
              const slug = entry.filename.split('/').map(s => encodeURIComponent(s)).join('/')
              const r = await fetch(`/templates/${slug}.template`)
              if (!r.ok) return null // Drop entries whose template file is missing
              const data = await r.json()
              const tpl = parseTemplate(data)
              const synced = mergeCategories(tpl.categories)
              return { ...entry, categories: synced }
            } catch {
              return null // Drop entries that fail to parse
            }
          }),
        ).then(results => {
          const syncedTemplates = results.filter((e): e is NonNullable<typeof e> => e !== null)
          setCustomRegistry({ templates: syncedTemplates })
          setLoadingRegistry(false)
        })
      })
      .catch(e => {
        console.error(`[registry] Failed to load: ${String(e)}`)
        setLoadingRegistry(false)
      })
  }, [fetchKey])

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
    refreshRegistry,
  }
}
