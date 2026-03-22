import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { TemplateEditor } from '../components/TemplateEditor'
import { CanvasErrorBoundary } from '../components/CanvasErrorBoundary'
import { DrawingToolbar } from '../components/DrawingToolbar'
import { TemplateThumbnail } from '../components/TemplateThumbnail'
import { DrawingOverlay } from '../components/DrawingOverlay'
import type { IndexedPathItem } from '../components/DrawingOverlay'
import { TemplateViewport } from '../components/TemplateViewport'
import { parseTemplate } from '../lib/parser'
import { removeEntry } from '../lib/registry'
import { buildCustomEntry, buildDefaultTemplate, mergeCategories, validateCustomName, injectColorConstants, mapForegroundColors, getCollegeIconCode, upsertColorConstant } from '../lib/customTemplates'
import { DEVICES, deviceBuiltins, type DeviceId } from '../lib/renderer'
import { resolveConstants } from '../lib/expression'
import { buildScaleConstants, reorderItem, rotatePathDataResolved, translatePathItemResolved, scalePathDataResolved, computePathBounds as computePathBoundsFromShapes, resolvePathDataNumeric } from '../lib/drawingShapes'
import { extractColorConstants } from '../lib/color'
import type { PathItem, PathData, ConstantEntry } from '../types/template'
import type { ScalingMode } from '../lib/drawingShapes'
import type { TemplateRegistryEntry } from '../types/registry'
import type { RemarkableTemplate } from '../types/template'
import { useRegistryContext } from '../hooks/useRegistry'
import { useDrawingEditor } from '../hooks/useDrawingEditor'
import { useUndoRedo } from '../hooks/useUndoRedo'

function DeviceIcon({ width, height }: { width: number; height: number }) {
  const maxH = 18
  const iconH = maxH
  const iconW = maxH * (width / height)
  return (
    <svg width={iconW} height={iconH} viewBox={`0 0 ${iconW} ${iconH}`}>
      <rect x={0.5} y={0.5} width={iconW - 1} height={iconH - 1}
            rx={1.5} ry={1.5} fill="none" stroke="currentColor" strokeWidth={1} />
    </svg>
  )
}

interface DeviceGroup {
  label: string
  devices: typeof DEVICES[string][]
}

interface TemplatesPageProps {
  deviceId: DeviceId
  setDeviceId: (id: DeviceId) => void
}

export function TemplatesPage({ deviceId, setDeviceId }: TemplatesPageProps) {
  const { registry, setCustomRegistry, loadingRegistry, officialTemplatesAvailable, mergedRegistry, existingCustomNames, refreshRegistry } = useRegistryContext()

  const [selected, setSelected] = useState<TemplateRegistryEntry | null>(null)
  const [template, setTemplate] = useState<RemarkableTemplate | null>(null)
  const [loadingTemplate, setLoadingTemplate] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Editor state
  const [editorOpen, setEditorOpen] = useState(false)
  const { value: editorJson, setValue: setEditorJson, undo: editorUndo, redo: editorRedo, canUndo: editorCanUndo, canRedo: editorCanRedo } = useUndoRedo('')
  const [pendingName, setPendingName] = useState('')
  const [editorError, setEditorError] = useState<string | null>(null)

  // New-template inline form
  const [newFormVisible, setNewFormVisible] = useState(false)
  const [newTemplateName, setNewTemplateName] = useState('')
  const [newTemplateLandscape, setNewTemplateLandscape] = useState(false)
  const [sidebarError, setSidebarError] = useState<string | null>(null)

  // Sidebar filter/sort state
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState<string | null>(null)
  const [filterOrientation, setFilterOrientation] = useState<'all' | 'portrait' | 'landscape'>('all')
  const [filterSource, setFilterSource] = useState<'methods' | 'official' | 'samples' | null>(null)

  // Sidebar view mode
  type ViewMode = 'list' | 'cards'
  type CardColumns = 1 | 2 | 3
  const VIEW_MODE_KEY = 'remarkable-templates-view-mode'
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      const s = JSON.parse(localStorage.getItem(VIEW_MODE_KEY) ?? '{}')
      return s.mode === 'cards' ? 'cards' : 'list'
    } catch { return 'list' }
  })
  const [cardColumns, setCardColumns] = useState<CardColumns>(() => {
    try {
      const s = JSON.parse(localStorage.getItem(VIEW_MODE_KEY) ?? '{}')
      return [1, 2, 3].includes(s.columns) ? s.columns : 2
    } catch { return 2 }
  })
  useEffect(() => {
    localStorage.setItem(VIEW_MODE_KEY, JSON.stringify({ mode: viewMode, columns: cardColumns }))
  }, [viewMode, cardColumns])

  // Collapsible sidebar
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem('sidebarCollapsed') === 'true'
  )
  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', String(sidebarCollapsed))
  }, [sidebarCollapsed])

  const importInputRef = useRef<HTMLInputElement>(null)

  // Drawing editor state
  const [drawingMode, setDrawingMode] = useState(false)

  const handleDrawingCommit = useCallback((newItem: PathItem, scalingMode: ScalingMode) => {
    try {
      const parsed = JSON.parse(editorJson) as Record<string, unknown>

      // Ensure "Drawn" category
      const categories = parsed.categories as string[] ?? []
      if (!categories.includes('Drawn')) {
        parsed.categories = [...categories, 'Drawn']
      }

      // Inject scale constants if proportional and not already present.
      // If constants exist with a different base (device switch), remap
      // the new item's expression coordinates so they stay consistent.
      if (scalingMode.type === 'proportional') {
        const constants = (parsed.constants ?? []) as Record<string, unknown>[]
        const existingX = constants.find(c => 'drawnScaleX' in c)
        if (!existingX) {
          parsed.constants = [
            ...buildScaleConstants(scalingMode.baseWidth, scalingMode.baseHeight),
            ...constants,
          ]
        } else {
          // Extract existing base and remap if device changed
          const exprX = String((existingX as Record<string, string>).drawnScaleX)
          const matchX = exprX.match(/templateWidth\s*\/\s*([\d.]+)/)
          const existingY = constants.find(c => 'drawnScaleY' in c)
          const exprY = existingY ? String((existingY as Record<string, string>).drawnScaleY) : ''
          const matchY = exprY.match(/templateHeight\s*\/\s*([\d.]+)/)

          if (matchX && matchY) {
            const existBaseW = parseFloat(matchX[1])
            const existBaseH = parseFloat(matchY[1])
            const ratioX = existBaseW / scalingMode.baseWidth
            const ratioY = existBaseH / scalingMode.baseHeight

            if (Math.abs(ratioX - 1) > 0.001 || Math.abs(ratioY - 1) > 0.001) {
              newItem = {
                ...newItem,
                data: newItem.data.map(token => {
                  if (typeof token !== 'string') return token
                  const mX = token.match(/^drawnScaleX\s*\*\s*([\d.]+)$/)
                  if (mX) {
                    return `drawnScaleX * ${parseFloat((parseFloat(mX[1]) * ratioX).toFixed(4))}`
                  }
                  const mY = token.match(/^drawnScaleY\s*\*\s*([\d.]+)$/)
                  if (mY) {
                    return `drawnScaleY * ${parseFloat((parseFloat(mY[1]) * ratioY).toFixed(4))}`
                  }
                  return token
                }),
              }
            }
          }
        }
      }

      const items = (parsed.items ?? []) as unknown[]
      parsed.items = [...items, newItem]

      const newJson = JSON.stringify(parsed, null, 2)
      setEditorJson(newJson)
      setTemplate(parseTemplate(JSON.parse(newJson)))
    } catch (err) {
      console.warn('[drawing-commit] Failed to commit shape:', err instanceof Error ? err.message : String(err))
    }
  }, [editorJson, setEditorJson])

  const handleDrawingDelete = useCallback((index: number) => {
    try {
      const parsed = JSON.parse(editorJson) as Record<string, unknown>
      const items = (parsed.items ?? []) as unknown[]
      parsed.items = items.filter((_, i) => i !== index)
      const newJson = JSON.stringify(parsed, null, 2)
      setEditorJson(newJson)
      setTemplate(parseTemplate(JSON.parse(newJson)))
    } catch (err) {
      console.warn('[drawing-delete] Failed to delete item:', err instanceof Error ? err.message : String(err))
    }
  }, [editorJson, setEditorJson])

  const handlePathEdit = useCallback((itemIndex: number, newData: PathData) => {
    try {
      const parsed = JSON.parse(editorJson) as Record<string, unknown>
      const items = (parsed.items ?? []) as unknown[]
      items[itemIndex] = { ...(items[itemIndex] as Record<string, unknown>), data: newData }
      parsed.items = items
      const newJson = JSON.stringify(parsed, null, 2)
      setEditorJson(newJson)
    } catch (err) {
      console.warn('[drawing-path-edit] Failed to edit path:', err instanceof Error ? err.message : String(err))
    }
  }, [editorJson, setEditorJson])

  const { state: drawingState, dispatch: drawingDispatch } = useDrawingEditor({
    onCommit: handleDrawingCommit,
    onDelete: handleDrawingDelete,
    onPathEdit: handlePathEdit,
  })

  // Sync drawing scaling mode with active device
  useEffect(() => {
    if (!drawingMode) return
    const device = DEVICES[deviceId]
    drawingDispatch({
      type: 'SET_SCALING_MODE',
      mode: { type: 'proportional', baseWidth: device.portraitWidth, baseHeight: device.portraitHeight },
    })
  }, [drawingMode, deviceId, drawingDispatch])

  const handleDrawingMove = useCallback((fromIndex: number, direction: 'up' | 'down' | 'top' | 'bottom') => {
    try {
      const parsed = JSON.parse(editorJson) as Record<string, unknown>
      const items = (parsed.items ?? []) as unknown[]
      const newItems = reorderItem(items, fromIndex, direction)
      if (newItems === items) return
      parsed.items = newItems
      const newJson = JSON.stringify(parsed, null, 2)
      setEditorJson(newJson)
      setTemplate(parseTemplate(JSON.parse(newJson)))
      let newIndex = fromIndex
      if (direction === 'up' && fromIndex < items.length - 1) newIndex = fromIndex + 1
      else if (direction === 'down' && fromIndex > 0) newIndex = fromIndex - 1
      else if (direction === 'top') newIndex = items.length - 1
      else if (direction === 'bottom') newIndex = 0
      drawingDispatch({ type: 'SELECT_ITEM', index: newIndex })
    } catch (err) {
      console.warn('[drawing-move] Failed to move item:', err instanceof Error ? err.message : String(err))
    }
  }, [editorJson, setEditorJson, drawingDispatch])

  const handleDrawingRotate = useCallback((index: number, angleDeg: number) => {
    try {
      const parsed = JSON.parse(editorJson) as Record<string, unknown>
      const items = (parsed.items ?? []) as unknown[]
      const item = items[index] as PathItem | undefined
      if (!item || item.type !== 'path') return
      const tpl = parseTemplate(parsed)
      const builtins = deviceBuiltins(tpl.orientation, deviceId)
      const resolved = resolveConstants(tpl.constants, builtins)
      const rotated = rotatePathDataResolved(item.data, angleDeg, resolved)
      if (!rotated) return
      const newItem = { ...item, data: rotated }
      parsed.items = items.map((it, i) => i === index ? newItem : it)
      const newJson = JSON.stringify(parsed, null, 2)
      setEditorJson(newJson)
      setTemplate(parseTemplate(JSON.parse(newJson)))
    } catch (err) {
      console.warn('[drawing-rotate] Failed to rotate item:', err instanceof Error ? err.message : String(err))
    }
  }, [editorJson, setEditorJson, deviceId])

  const handleScale = useCallback((index: number, scaleX: number, scaleY: number, origin: { x: number; y: number }) => {
    try {
      const parsed = JSON.parse(editorJson) as Record<string, unknown>
      const items = (parsed.items ?? []) as unknown[]
      const item = items[index] as PathItem | undefined
      if (!item || item.type !== 'path') return
      const tpl = parseTemplate(parsed)
      const builtins = deviceBuiltins(tpl.orientation, deviceId)
      const resolved = resolveConstants(tpl.constants, builtins)
      const scaled = scalePathDataResolved(item.data, scaleX, scaleY, origin, resolved)
      if (!scaled) return
      const newItem = { ...item, data: scaled }
      parsed.items = items.map((it, i) => i === index ? newItem : it)
      const newJson = JSON.stringify(parsed, null, 2)
      setEditorJson(newJson)
      setTemplate(parseTemplate(JSON.parse(newJson)))
    } catch (err) {
      console.warn('[drawing-scale] Failed to scale item:', err instanceof Error ? err.message : String(err))
    }
  }, [editorJson, setEditorJson, deviceId])

  const handleFlip = useCallback((index: number, axis: 'horizontal' | 'vertical') => {
    try {
      const parsed = JSON.parse(editorJson) as Record<string, unknown>
      const items = (parsed.items ?? []) as unknown[]
      const item = items[index] as PathItem | undefined
      if (!item || item.type !== 'path') return
      const tpl = parseTemplate(parsed)
      const builtins = deviceBuiltins(tpl.orientation, deviceId)
      const resolved = resolveConstants(tpl.constants, builtins)
      // Compute bounds center for flip origin
      let bounds = computePathBoundsFromShapes(item.data)
      if (!bounds) {
        const resolvedData = resolvePathDataNumeric(item.data, resolved)
        if (resolvedData) bounds = computePathBoundsFromShapes(resolvedData)
      }
      if (!bounds) return
      const center = { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 }
      const sx = axis === 'horizontal' ? -1 : 1
      const sy = axis === 'vertical' ? -1 : 1
      const scaled = scalePathDataResolved(item.data, sx, sy, center, resolved)
      if (!scaled) return
      const newItem = { ...item, data: scaled }
      parsed.items = items.map((it, i) => i === index ? newItem : it)
      const newJson = JSON.stringify(parsed, null, 2)
      setEditorJson(newJson)
      setTemplate(parseTemplate(JSON.parse(newJson)))
    } catch (err) {
      console.warn('[drawing-flip] Failed to flip item:', err instanceof Error ? err.message : String(err))
    }
  }, [editorJson, setEditorJson, deviceId])

  const handleBackgroundColorChange = useCallback((color: string) => {
    try {
      const parsed = JSON.parse(editorJson) as Record<string, unknown>
      const constants = (parsed.constants ?? []) as ConstantEntry[]
      parsed.constants = upsertColorConstant(constants, 'background', color)
      const newJson = JSON.stringify(parsed, null, 2)
      setEditorJson(newJson)
      setTemplate(parseTemplate(JSON.parse(newJson)))
    } catch (err) {
      console.warn('[drawing-bg-color] Failed to change background color:', err instanceof Error ? err.message : String(err))
    }
  }, [editorJson, setEditorJson])

  const handleForegroundColorChange = useCallback((color: string) => {
    try {
      const parsed = JSON.parse(editorJson) as Record<string, unknown>
      const constants = (parsed.constants ?? []) as ConstantEntry[]
      parsed.constants = upsertColorConstant(constants, 'foreground', color)
      const newJson = JSON.stringify(parsed, null, 2)
      setEditorJson(newJson)
      setTemplate(parseTemplate(JSON.parse(newJson)))
    } catch (err) {
      console.warn('[drawing-fg-color] Failed:', err instanceof Error ? err.message : String(err))
    }
  }, [editorJson, setEditorJson])

  // Handle move/rotate intents from reducer
  useEffect(() => {
    if (drawingState.moveItemIntent) {
      handleDrawingMove(drawingState.moveItemIntent.index, drawingState.moveItemIntent.direction)
      drawingDispatch({ type: 'CLEAR_MOVE_INTENT' })
    }
  }, [drawingState.moveItemIntent, handleDrawingMove, drawingDispatch])

  useEffect(() => {
    if (drawingState.rotateIntent) {
      handleDrawingRotate(drawingState.rotateIntent.index, drawingState.rotateIntent.angle)
      drawingDispatch({ type: 'CLEAR_ROTATE_INTENT' })
    }
  }, [drawingState.rotateIntent, handleDrawingRotate, drawingDispatch])

  // Handle nudge intents (from keyboard nudge or drag-to-move)
  const handleNudge = useCallback((index: number, dx: number, dy: number) => {
    try {
      const parsed = JSON.parse(editorJson) as Record<string, unknown>
      const items = (parsed.items ?? []) as unknown[]
      const item = items[index] as PathItem | undefined
      if (!item || item.type !== 'path') return
      const tpl = parseTemplate(parsed)
      const builtins = deviceBuiltins(tpl.orientation, deviceId)
      const resolved = resolveConstants(tpl.constants, builtins)
      const translated = translatePathItemResolved(item, dx, dy, resolved)
      if (!translated) return
      items[index] = translated
      parsed.items = items
      const newJson = JSON.stringify(parsed, null, 2)
      setEditorJson(newJson)
      setTemplate(parseTemplate(JSON.parse(newJson)))
    } catch (err) {
      console.warn('[drawing-nudge] Failed:', err instanceof Error ? err.message : String(err))
    }
  }, [editorJson, setEditorJson, deviceId])

  useEffect(() => {
    if (drawingState.nudgeIntent) {
      handleNudge(drawingState.nudgeIntent.index, drawingState.nudgeIntent.dx, drawingState.nudgeIntent.dy)
      drawingDispatch({ type: 'CLEAR_NUDGE_INTENT' })
    }
  }, [drawingState.nudgeIntent, handleNudge, drawingDispatch])

  useEffect(() => {
    if (drawingState.scaleIntent) {
      handleScale(drawingState.scaleIntent.index, drawingState.scaleIntent.scaleX, drawingState.scaleIntent.scaleY, drawingState.scaleIntent.origin)
      drawingDispatch({ type: 'CLEAR_SCALE_INTENT' })
    }
  }, [drawingState.scaleIntent, handleScale, drawingDispatch])

  // Fix 1: Re-parse template when editorJson changes in drawing mode
  // Catches all sources: undo, redo, commit, delete, rotate, move, etc.
  useEffect(() => {
    if (!drawingMode || !editorJson) return
    try {
      setTemplate(parseTemplate(JSON.parse(editorJson)))
    } catch {
      // Ignore malformed JSON
    }
  }, [editorJson, drawingMode])

  // Consolidated keydown handler for drawing mode
  useEffect(() => {
    if (!drawingMode) return
    function handleKeyDown(e: KeyboardEvent) {
      // Skip when focus is in an input/textarea/select
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      // Undo/Redo (Ctrl+Z / Ctrl+Shift+Z)
      if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        if (e.shiftKey) editorRedo()
        else editorUndo()
        return
      }

      // Tool shortcuts (single keys, no modifiers)
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const toolMap: Record<string, Parameters<typeof drawingDispatch>[0]> = {
          v: { type: 'SET_TOOL', tool: 'select' },
          m: { type: 'SET_TOOL', tool: 'point' },
          l: { type: 'SET_TOOL', tool: 'line' },
          p: { type: 'SET_TOOL', tool: 'polygon' },
          r: { type: 'SET_TOOL', tool: 'regularPolygon' },
          c: { type: 'SET_TOOL', tool: 'circle' },
          b: { type: 'SET_TOOL', tool: 'bezier' },
          f: { type: 'SET_FILL_ENABLED', enabled: !drawingState.fillEnabled },
        }

        const action = toolMap[e.key.toLowerCase()]
        if (action) {
          e.preventDefault()
          drawingDispatch(action)
          return
        }

        // Flip shortcuts
        if (e.key.toLowerCase() === 'h' && drawingState.selectedItemIndex !== null) {
          e.preventDefault()
          handleFlip(drawingState.selectedItemIndex, 'horizontal')
          return
        }
        if (e.key.toLowerCase() === 'j' && drawingState.selectedItemIndex !== null) {
          e.preventDefault()
          handleFlip(drawingState.selectedItemIndex, 'vertical')
          return
        }

        // Delete / Backspace
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault()
          drawingDispatch({ type: 'DELETE_SELECTED' })
          return
        }

        // Escape — cancel drawing or deselect
        if (e.key === 'Escape') {
          e.preventDefault()
          if (drawingState.inProgress) {
            drawingDispatch({ type: 'CANCEL' })
          } else {
            drawingDispatch({ type: 'SELECT_ITEM', index: null })
          }
          return
        }

        // Enter — finish bezier
        if (e.key === 'Enter') {
          if (drawingState.inProgress?.tool === 'bezier' && drawingState.inProgress.vertices.length >= 2) {
            e.preventDefault()
            drawingDispatch({ type: 'FINISH_BEZIER' })
          }
          return
        }

        // Arrow keys — nudge
        if (e.key.startsWith('Arrow') && drawingState.selectedItemIndex !== null) {
          e.preventDefault()
          const step = e.shiftKey ? 10 : 1
          const nudge = {
            ArrowUp: { dx: 0, dy: -step },
            ArrowDown: { dx: 0, dy: step },
            ArrowLeft: { dx: -step, dy: 0 },
            ArrowRight: { dx: step, dy: 0 },
          }[e.key]
          if (nudge) drawingDispatch({ type: 'NUDGE_SELECTED', ...nudge })
          return
        }

        // Layer controls: [ ] and Shift+[ Shift+]
        if (e.key === '[' && drawingState.selectedItemIndex !== null) {
          e.preventDefault()
          drawingDispatch({ type: 'MOVE_ITEM', index: drawingState.selectedItemIndex, direction: e.shiftKey ? 'bottom' : 'down' })
          return
        }
        if (e.key === ']' && drawingState.selectedItemIndex !== null) {
          e.preventDefault()
          drawingDispatch({ type: 'MOVE_ITEM', index: drawingState.selectedItemIndex, direction: e.shiftKey ? 'top' : 'up' })
          return
        }

        // Zoom
        if (e.key === '+' || e.key === '=') {
          e.preventDefault()
          const newZoom = Math.min(10, drawingState.zoom + 0.25)
          drawingDispatch({ type: 'ZOOM', zoom: newZoom, pan: drawingState.panOffset })
          return
        }
        if (e.key === '-') {
          e.preventDefault()
          const newZoom = Math.max(0.1, drawingState.zoom - 0.25)
          drawingDispatch({ type: 'ZOOM', zoom: newZoom, pan: drawingState.panOffset })
          return
        }
        if (e.key === '0') {
          e.preventDefault()
          drawingDispatch({ type: 'ZOOM_TO_FIT' })
          return
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [drawingMode, editorUndo, editorRedo, drawingDispatch, drawingState.fillEnabled, drawingState.inProgress, drawingState.selectedItemIndex, drawingState.zoom, drawingState.panOffset, handleFlip])

  // Fix 4: Auto-save drawing edits with debounce
  // Note: we use a ref for selected.filename to avoid re-triggering on selected changes
  const autoSaveFilenameRef = useRef(selected?.filename)
  useEffect(() => { autoSaveFilenameRef.current = selected?.filename }, [selected?.filename])

  useEffect(() => {
    if (!drawingMode || !selected?.isCustom || !editorJson) return
    const slug = selected.filename.replace('custom/', '')
    const filename = selected.filename
    const timer = setTimeout(() => {
      fetch(`/api/custom-templates/${encodeURIComponent(slug)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editorJson }),
      })
        .then(r => r.json())
        .then((data: { ok: boolean; iconData?: string }) => {
          if (data.iconData) {
            // Only update registry (not selected) to avoid triggering the fetch effect loop
            setCustomRegistry(prev => ({
              templates: prev.templates.map(e =>
                e.filename === filename ? { ...e, iconData: data.iconData } : e,
              ),
            }))
          }
        })
        .catch((err) => {
          console.warn('[drawing-autosave] Auto-save failed:', err instanceof Error ? err.message : String(err))
        })
    }, 500)
    return () => clearTimeout(timer)
  }, [editorJson, drawingMode, selected?.isCustom, selected?.filename, setCustomRegistry])

  const deviceGroups = useMemo<DeviceGroup[]>(() => {
    const groups = new Map<string, typeof DEVICES[string][]>()
    for (const spec of Object.values(DEVICES)) {
      const key = `${spec.portraitWidth} × ${spec.portraitHeight}`
      const arr = groups.get(key) ?? []
      arr.push(spec)
      groups.set(key, arr)
    }
    return [...groups.entries()].map(([label, devices]) => ({ label, devices }))
  }, [])

  // Fetch and parse the selected template file
  useEffect(() => {
    if (!selected) return
    const controller = new AbortController()
    setLoadingTemplate(true)
    setError(null)
    setTemplate(null)

    const fetchPath = selected.filename
      .split('/')
      .map(seg => encodeURIComponent(seg))
      .join('/')

    fetch(`/templates/${fetchPath}.template`, { signal: controller.signal })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(data => {
        const parsed = parseTemplate(data)
        setTemplate(parsed)
        const isCustom = selected.filename.startsWith('custom/')
        setEditorJson(JSON.stringify(data, null, 2))
        setPendingName(isCustom ? selected.name : `Custom ${data.name as string ?? selected.name}`)
        setLoadingTemplate(false)
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setError(`No template file found for "${selected.filename}"`)
        setLoadingTemplate(false)
      })
    return () => controller.abort()
  }, [selected, setEditorJson])

  // Derived: all unique categories from merged registry
  const allCategories = useMemo(() =>
    mergedRegistry
      ? [...new Set(mergedRegistry.templates.flatMap(t => t.categories))].sort()
      : [],
    [mergedRegistry],
  )

  // Derived: filtered + sorted template list
  const filteredTemplates = useMemo(() =>
    (mergedRegistry?.templates ?? [])
      .filter(t => {
        if (searchQuery && !t.name.toLowerCase().includes(searchQuery.toLowerCase())) return false
        if (filterCategory && !t.categories.includes(filterCategory)) return false
        if (filterOrientation === 'portrait' && t.landscape === true) return false
        if (filterOrientation === 'landscape' && t.landscape !== true) return false
        if (filterSource === 'methods' && !t.origin) return false
        if (filterSource === 'samples' && !t.categories.includes('Samples')) return false
        if (filterSource === 'official' && (t.isCustom || t.origin === 'custom-methods' || t.categories.includes('Debug') || t.categories.includes('Samples'))) return false
        return true
      })
      .sort((a, b) => {
        if (a.landscape !== b.landscape) return a.landscape ? 1 : -1
        return a.name.localeCompare(b.name)
      }),
    [mergedRegistry, searchQuery, filterCategory, filterOrientation, filterSource],
  )

  async function handleApply(json: string, name: string) {
    setEditorError(null)
    if (!selected) return

    try {
      const parsed = JSON.parse(json) as Record<string, unknown>
      const tpl = parseTemplate(parsed)
      const newLandscape = tpl.orientation === 'landscape'

      if (selected.filename.startsWith('custom/')) {
        const oldSlug = selected.filename.replace('custom/', '')
        const isRename = name !== selected.name
        const orientationChanged = newLandscape !== (selected.landscape ?? false)

        if (isRename || orientationChanged) {
          if (isRename) {
            const otherNames = existingCustomNames.filter(n => n !== selected.name)
            const nameErr = validateCustomName(name, otherNames)
            if (nameErr) { setEditorError(nameErr); return }
          }

          const renamedEntry = buildCustomEntry(name, newLandscape, mergeCategories(tpl.categories), getCollegeIconCode(registry, newLandscape))
          const newSlug = renamedEntry.filename.replace('custom/', '')
          const updatedContent = JSON.stringify(
            { ...parsed, name, categories: mergeCategories(tpl.categories) }, null, 2,
          )
          const res = await fetch(`/api/custom-templates/${encodeURIComponent(oldSlug)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newSlug, newName: name, content: updatedContent }),
          })
          if (!res.ok) throw new Error(`Server error: ${res.status}`)
          const data = await res.json() as { ok: boolean; iconData?: string }
          const entryWithIcon = { ...renamedEntry, ...(data.iconData ? { iconData: data.iconData } : {}) }
          setCustomRegistry(prev => ({
            templates: prev.templates.map(e =>
              e.filename === selected.filename ? entryWithIcon : e,
            ),
          }))
          setSelected(entryWithIcon)
          setEditorJson(updatedContent)
          setTemplate(tpl)
        } else {
          const updatedEntry = buildCustomEntry(name, newLandscape, mergeCategories(tpl.categories), getCollegeIconCode(registry, newLandscape))
          const updatedContent = JSON.stringify(
            { ...parsed, name, categories: mergeCategories(tpl.categories) }, null, 2,
          )
          const res = await fetch(`/api/custom-templates/${encodeURIComponent(oldSlug)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: updatedContent, entry: updatedEntry }),
          })
          if (!res.ok) throw new Error(`Server error: ${res.status}`)
          const data = await res.json() as { ok: boolean; iconData?: string }
          const entryWithIcon = { ...updatedEntry, ...(data.iconData ? { iconData: data.iconData } : {}) }
          setCustomRegistry(prev => ({
            templates: prev.templates.map(e =>
              e.filename === selected.filename ? entryWithIcon : e,
            ),
          }))
          setSelected(entryWithIcon)
          setEditorJson(updatedContent)
          setTemplate(tpl)
        }
      } else {
        const entry = buildCustomEntry(name, newLandscape, mergeCategories(tpl.categories), getCollegeIconCode(registry, newLandscape))
        const slug = entry.filename.replace('custom/', '')
        const updatedContent = injectColorConstants(
          mapForegroundColors(
            JSON.stringify({ ...parsed, name, categories: mergeCategories(tpl.categories) }, null, 2),
          ),
        )
        const res = await fetch('/api/custom-templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: slug, content: updatedContent, entry }),
        })
        if (!res.ok) throw new Error(`Server error: ${res.status}`)
        const data = await res.json() as { ok: boolean; iconData?: string }
        const entryWithIcon = { ...entry, ...(data.iconData ? { iconData: data.iconData } : {}) }
        setCustomRegistry(prev => ({ templates: [entryWithIcon, ...prev.templates] }))
        setSelected(entryWithIcon)
      }
    } catch (e) {
      setEditorError(`Failed to save: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  async function handleDelete() {
    if (!selected?.isCustom) return
    const slug = selected.filename.replace(/^custom\//, '')
    try {
      const res = await fetch(`/api/custom-templates/${encodeURIComponent(slug)}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`Server error: ${res.status}`)
      setCustomRegistry(prev => removeEntry(prev, selected.filename))
      refreshRegistry()
      setSelected(null)
      setTemplate(null)
      setEditorOpen(false)
    } catch (e) {
      setError(`Failed to delete: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  async function handleCreateNew() {
    setSidebarError(null)
    const nameErr = validateCustomName(newTemplateName.trim(), existingCustomNames)
    if (nameErr) { setSidebarError(nameErr); return }

    try {
      const name = newTemplateName.trim()
      const entry = buildCustomEntry(name, newTemplateLandscape, ['Custom'], getCollegeIconCode(registry, newTemplateLandscape))
      const slug = entry.filename.replace('custom/', '')
      const content = buildDefaultTemplate(name, newTemplateLandscape)
      const res = await fetch('/api/custom-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: slug, content, entry }),
      })
      if (!res.ok) throw new Error(`Server error: ${res.status}`)
      setCustomRegistry(prev => ({ templates: [entry, ...prev.templates] }))
      setSelected(entry)
      setNewFormVisible(false)
      setNewTemplateName('')
      setEditorOpen(true)
    } catch (e) {
      setSidebarError(`Failed to create: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    setSidebarError(null)
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    let raw: unknown
    try {
      raw = JSON.parse(await file.text())
    } catch {
      setSidebarError('File is not valid JSON')
      return
    }

    let tpl: RemarkableTemplate
    try {
      tpl = parseTemplate(raw)
    } catch (e) {
      setSidebarError(`Invalid template: ${e instanceof Error ? e.message : String(e)}`)
      return
    }

    const name = tpl.name
    const landscape = tpl.orientation === 'landscape'
    const nameErr = validateCustomName(name, existingCustomNames)
    if (nameErr) { setSidebarError(nameErr); return }

    try {
      const entry = buildCustomEntry(name, landscape, mergeCategories(tpl.categories), getCollegeIconCode(registry, landscape))
      const slug = entry.filename.replace('custom/', '')
      const rawObj = raw as Record<string, unknown>
      const updatedContent = JSON.stringify(
        { ...rawObj, categories: mergeCategories(tpl.categories) }, null, 2,
      )
      const res = await fetch('/api/custom-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: slug, content: updatedContent, entry }),
      })
      if (!res.ok) throw new Error(`Server error: ${res.status}`)
      setCustomRegistry(prev => ({ templates: [entry, ...prev.templates] }))
      setSelected(entry)
    } catch (e) {
      setSidebarError(`Failed to import: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  async function handleHideSample(filename: string) {
    try {
      const res = await fetch('/api/sample-templates/hide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename }),
      })
      if (!res.ok) throw new Error(`Server error: ${res.status}`)
      refreshRegistry()
      if (selected?.filename === filename) {
        setSelected(null)
        setTemplate(null)
      }
    } catch (e) {
      setSidebarError(`Failed to hide: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const anyFilterActive = !!(searchQuery || filterCategory || filterOrientation !== 'all' || filterSource)

  return (
    <div className={`app-content${editorOpen ? ' editing' : ''}`}>

      {/* ── Sidebar ────────────────────────────────────────────── */}
      <aside className={`sidebar${sidebarCollapsed ? ' collapsed' : ''}`}>
        <div className="sidebar-header">
          <span className="sidebar-title">Templates</span>
          <span className="sidebar-count">
            {mergedRegistry ? filteredTemplates.length : '...'}
          </span>
          <button
            className="sidebar-collapse-btn"
            onClick={() => setSidebarCollapsed(c => !c)}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? '\u25B6' : '\u25C0'}
          </button>
        </div>

        <div className="device-selector">
          {deviceGroups.map(group => (
            <div key={group.label} className="device-group">
              <span className="device-group-label">{group.label}</span>
              <div className="device-group-buttons">
                {group.devices.map(spec => (
                  <button
                    key={spec.id}
                    className={`device-btn${deviceId === spec.id ? ' active' : ''}`}
                    onClick={() => setDeviceId(spec.id as DeviceId)}
                    title={spec.name}
                  >
                    <DeviceIcon width={spec.portraitWidth} height={spec.portraitHeight} />
                    <span className="device-btn-label">{spec.shortName}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="sidebar-actions">
          <button
            className={`sidebar-action-btn${newFormVisible ? ' active' : ''}`}
            onClick={() => { setNewFormVisible(v => !v); setSidebarError(null) }}
          >
            + New
          </button>
          <button className="sidebar-action-btn" onClick={() => importInputRef.current?.click()}>
            ↑ Import
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".template"
            style={{ display: 'none' }}
            onChange={handleImportFile}
          />
        </div>

        {newFormVisible && (
          <div className="new-template-form">
            <input
              className="new-template-name"
              type="text"
              value={newTemplateName}
              onChange={e => setNewTemplateName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateNew()}
              placeholder="Template name..."
              autoFocus
            />
            <div className="orient-toggle">
              <button
                className={`orient-btn${!newTemplateLandscape ? ' active' : ''}`}
                onClick={() => setNewTemplateLandscape(false)}
              >P</button>
              <button
                className={`orient-btn${newTemplateLandscape ? ' active' : ''}`}
                onClick={() => setNewTemplateLandscape(true)}
              >LS</button>
            </div>
            <button className="new-template-create-btn" onClick={handleCreateNew}>
              Create
            </button>
          </div>
        )}

        {sidebarError && (
          <div className="sidebar-error">{sidebarError}</div>
        )}

        {/* ── Sidebar filters ── */}
        <div className="sidebar-filters">
          <input
            className="sidebar-search"
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Filter by name..."
          />
          <div className="sidebar-filter-row">
            <div className="orient-toggle">
              <button
                className={`orient-btn${filterOrientation === 'all' ? ' active' : ''}`}
                onClick={() => setFilterOrientation('all')}
              >All</button>
              <button
                className={`orient-btn${filterOrientation === 'portrait' ? ' active' : ''}`}
                onClick={() => setFilterOrientation('portrait')}
              >P</button>
              <button
                className={`orient-btn${filterOrientation === 'landscape' ? ' active' : ''}`}
                onClick={() => setFilterOrientation('landscape')}
              >LS</button>
            </div>
          </div>
          <div className="cat-chips">
            <button
              className={`cat-chip source-chip${filterSource === 'official' ? ' active' : ''}`}
              onClick={() => setFilterSource(filterSource === 'official' ? null : 'official')}
            >Classic</button>
            <button
              className={`cat-chip source-chip${filterSource === 'methods' ? ' active' : ''}`}
              onClick={() => setFilterSource(filterSource === 'methods' ? null : 'methods')}
            >Methods</button>
            <button
              className={`cat-chip source-chip${filterSource === 'samples' ? ' active' : ''}`}
              onClick={() => setFilterSource(filterSource === 'samples' ? null : 'samples')}
            >Samples</button>
          </div>
          {allCategories.length > 0 && (
            <div className="cat-chips">
              {allCategories.map(cat => (
                <button
                  key={cat}
                  className={`cat-chip${filterCategory === cat ? ' active' : ''}`}
                  onClick={() => setFilterCategory(filterCategory === cat ? null : cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
          {anyFilterActive && (
            <button
              className="filter-clear"
              onClick={() => { setSearchQuery(''); setFilterCategory(null); setFilterOrientation('all'); setFilterSource(null) }}
            >× Clear filters</button>
          )}
        </div>

        <div className="sidebar-view-controls">
          <div className="view-mode-toggle">
            <button
              className={`view-mode-btn${viewMode === 'list' ? ' active' : ''}`}
              onClick={() => setViewMode('list')}
              title="List view"
            >☰</button>
            <button
              className={`view-mode-btn${viewMode === 'cards' ? ' active' : ''}`}
              onClick={() => setViewMode('cards')}
              title="Card view"
            >▦</button>
          </div>
          {viewMode === 'cards' && (
            <div className="card-columns-toggle">
              {([1, 2, 3] as const).map(n => (
                <button
                  key={n}
                  className={`card-col-btn${cardColumns === n ? ' active' : ''}`}
                  onClick={() => setCardColumns(n)}
                  title={`${n} column${n > 1 ? 's' : ''}`}
                >{n}</button>
              ))}
            </div>
          )}
        </div>

        <div className={`sidebar-list${viewMode === 'cards' ? ` card-view cols-${cardColumns}` : ''}`}>
          {loadingRegistry && <p className="sidebar-hint">Loading...</p>}
          {officialTemplatesAvailable === false && (
            <div className="sidebar-import-prompt">
              <p>No official templates loaded.</p>
              <p>Go to <strong>Device &amp; Sync</strong> to import official templates from your device.</p>
            </div>
          )}
          {viewMode === 'list' ? (
            filteredTemplates.map(entry => (
              <div
                key={`${entry.filename}::${entry.landscape ?? false}`}
                className={`template-btn${selected?.filename === entry.filename && selected?.landscape === entry.landscape ? ' selected' : ''}`}
                onClick={() => setSelected(entry)}
                role="button"
                tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setSelected(entry) }}
              >
                <TemplateThumbnail iconData={entry.iconData} landscape={entry.landscape} />
                <span className="template-btn-name">{entry.name}</span>
                <span className="template-btn-right">
                  {entry.categories.includes('Samples') && !entry.isCustom && (
                    <button
                      className="sample-hide-btn"
                      title="Hide this sample"
                      onClick={e => { e.stopPropagation(); handleHideSample(entry.filename) }}
                    >
                      ×
                    </button>
                  )}
                  <span
                    className={`orient-badge ${entry.isCustom ? 'custom' : (entry.landscape ? 'ls' : 'p')}`}
                    title={`${entry.landscape ? 'Landscape' : 'Portrait'}${entry.isCustom ? ' (Custom)' : entry.origin === 'official-methods' ? ' (Methods)' : entry.origin === 'custom-methods' ? ' (Methods — custom)' : entry.categories.includes('Samples') ? ' (Sample)' : ' (Classic)'}`}
                  >
                    {entry.landscape ? 'LS' : 'P'}
                  </span>
                </span>
              </div>
            ))
          ) : (
            <div className="card-grid">
              {filteredTemplates.map(entry => {
                const isSelected = selected?.filename === entry.filename && selected?.landscape === entry.landscape
                const sourceLabel = entry.isCustom ? 'Custom'
                  : entry.origin === 'official-methods' ? 'Methods'
                  : entry.origin === 'custom-methods' ? 'Methods'
                  : entry.categories.includes('Samples') ? 'Sample'
                  : 'Classic'
                const tooltipText = `${entry.name} — ${entry.landscape ? 'Landscape' : 'Portrait'} (${sourceLabel})`
                return (
                  <div
                    key={`${entry.filename}::${entry.landscape ?? false}`}
                    className={`template-card${isSelected ? ' selected' : ''}`}
                    onClick={() => setSelected(entry)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setSelected(entry) }}
                    title={cardColumns >= 2 ? tooltipText : undefined}
                  >
                    <div className="card-thumb-wrapper">
                      <TemplateThumbnail iconData={entry.iconData} landscape={entry.landscape} className="card-thumb" />
                      {cardColumns <= 2 && (
                        <div className="card-badges">
                          <span className={`orient-badge ${entry.isCustom ? 'custom' : (entry.landscape ? 'ls' : 'p')}`}>
                            {entry.landscape ? 'LS' : 'P'}
                          </span>
                          {cardColumns === 1 && (
                            <span className="card-source-badge">{sourceLabel}</span>
                          )}
                        </div>
                      )}
                    </div>
                    {cardColumns === 1 && (
                      <span className="card-name">{entry.name}</span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </aside>

      {/* ── Editor panel (only when open) ───────────────────────── */}
      {editorOpen && selected && (
        <div className="editor-panel">
          <TemplateEditor
            key={selected.filename}
            json={editorJson}
            isCustom={selected.isCustom ?? false}
            pendingName={pendingName}
            onPendingNameChange={setPendingName}
            onApply={handleApply}
            onClose={() => setEditorOpen(false)}
            onDelete={handleDelete}
            existingNames={existingCustomNames}
          />
          {editorError && (
            <div className="editor-panel-error">{editorError}</div>
          )}
        </div>
      )}

      {/* ── Preview ────────────────────────────────────────────── */}
      <main className="preview">
        {selected ? (
          <>
            <div className="preview-meta">
              <div className="preview-meta-top">
                <h1 className="preview-meta-name">{selected.name}</h1>
                <div className="preview-meta-actions">
                  {selected?.isCustom && (
                    <button
                      className={`edit-json-btn${drawingMode ? ' active' : ''}`}
                      onClick={() => setDrawingMode(d => !d)}
                      disabled={!template}
                    >
                      {drawingMode ? 'Close Draw' : 'Draw'}
                    </button>
                  )}
                  <button
                    className={`edit-json-btn${editorOpen ? ' active' : ''}`}
                    onClick={() => setEditorOpen(o => !o)}
                    disabled={!template}
                  >
                    {editorOpen ? 'Close Editor' : 'Edit JSON'}
                  </button>
                </div>
              </div>
              <div className="preview-meta-tags">
                <button
                  className={`tag ${selected.landscape ? 'tag-ls' : 'tag-p'}${filterOrientation === (selected.landscape ? 'landscape' : 'portrait') ? ' tag-active' : ''}`}
                  onClick={() => {
                    const thisOrient = selected.landscape ? 'landscape' : 'portrait'
                    setFilterOrientation(filterOrientation === thisOrient ? 'all' : thisOrient)
                  }}
                >
                  {selected.landscape ? 'Landscape' : 'Portrait'}
                </button>
                {selected.isCustom && <span className="tag tag-custom">Custom</span>}
                {selected.categories.includes('Samples') && <span className="tag tag-methods">Sample</span>}
                {selected.origin === 'official-methods' && <span className="tag tag-methods">Methods</span>}
                {selected.origin === 'custom-methods' && <span className="tag tag-methods">Methods (custom)</span>}
                {(template?.categories ?? selected.categories)
                  .filter(cat => !(selected.isCustom && cat === 'Custom'))
                  .map(cat => (
                  <button
                    key={cat}
                    className={`tag tag-cat${filterCategory === cat ? ' tag-active' : ''}`}
                    onClick={() => setFilterCategory(filterCategory === cat ? null : cat)}
                  >
                    {cat}
                  </button>
                ))}
                {selected.isCustom ? (() => {
                  const slug = selected.filename.replace('custom/', '')
                  const encodedPath = selected.filename
                    .split('/')
                    .map(seg => encodeURIComponent(seg))
                    .join('/')
                  return (
                    <a
                      className="tag tag-file tag-download"
                      href={`/templates/${encodedPath}.template`}
                      download={`${slug}.template`}
                    >
                      {selected.filename}.template ↓
                    </a>
                  )
                })() : (
                  <span className="tag tag-file">{selected.filename}</span>
                )}
              </div>
            </div>

            {drawingMode && template && (() => {
              const colorConsts = extractColorConstants(template.constants)
              const bgColor = colorConsts['background'] ?? '#ffffff'
              const fgColor = colorConsts['foreground'] ?? '#000000'
              return (
                <DrawingToolbar
                  state={drawingState}
                  dispatch={drawingDispatch}
                  deviceId={deviceId}
                  backgroundColor={bgColor}
                  onBackgroundColorChange={handleBackgroundColorChange}
                  foregroundColor={fgColor}
                  onForegroundColorChange={handleForegroundColorChange}
                  onMove={handleDrawingMove}
                  onRotate={handleDrawingRotate}
                  onFlip={handleFlip}
                  canUndo={editorCanUndo}
                  canRedo={editorCanRedo}
                  onUndo={editorUndo}
                  onRedo={editorRedo}
                />
              )
            })()}
            {loadingTemplate && (
              <div className="preview-stage">
                <p className="stage-hint">Loading...</p>
              </div>
            )}
            {error && (
              <div className="preview-stage">
                <p className="stage-hint stage-error">{error}</p>
              </div>
            )}
            {template && (
              <CanvasErrorBoundary resetKey={editorJson}>
                {(() => {
                  const builtins = deviceBuiltins(template.orientation, deviceId)
                  const resolved = resolveConstants(template.constants, builtins)
                  const indexedItems: IndexedPathItem[] = template.items
                    .map((item, i) => ({ item, originalIndex: i }))
                    .filter((entry): entry is IndexedPathItem => entry.item.type === 'path') as IndexedPathItem[]
                  return (
                    <TemplateViewport
                      key={selected.filename}
                      template={template}
                      deviceId={deviceId}
                      className={drawingMode ? 'drawing-mode' : ''}
                      zoom={drawingMode ? drawingState.zoom : undefined}
                      pan={drawingMode ? drawingState.panOffset : undefined}
                      onViewportChange={drawingMode
                        ? (z, p) => drawingDispatch({ type: 'ZOOM', zoom: z, pan: p })
                        : undefined}
                      panButton={drawingMode ? 'middle' : 'left'}
                      snapToDefault={!drawingMode}
                    >
                      {drawingMode && (
                        <DrawingOverlay
                          state={drawingState}
                          dispatch={drawingDispatch}
                          templateWidth={builtins.templateWidth}
                          templateHeight={builtins.templateHeight}
                          items={indexedItems}
                          resolvedConstants={resolved}
                        />
                      )}
                    </TemplateViewport>
                  )
                })()}
              </CanvasErrorBoundary>
            )}
          </>
        ) : (
          <div className="preview-stage">
            <p className="stage-hint">← Select a template to preview</p>
          </div>
        )}
      </main>

    </div>
  )
}
