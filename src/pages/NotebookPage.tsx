import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRegistryContext } from '../hooks/useRegistry'
import { useNotebookEditor, type NotebookEditorState } from '../hooks/useNotebookEditor'
import { useNotebookList, type NotebookDraft } from '../hooks/useNotebookList'
import { useDevices } from '../hooks/useDevices'
import { useBusy } from '../hooks/useBusy'
import { TemplateThumbnail } from '../components/TemplateThumbnail'
import { NotebookPageStrip } from '../components/NotebookPageStrip'
import { ProgressBar } from '../components/ProgressBar'
import { ErrorDetails } from '../components/device/ErrorDetails'
import { ResizeDivider } from '../components/ResizeDivider'
import { TemplateCanvas } from '../components/TemplateCanvas'
import { DeviceSelector } from '../components/DeviceSelector'
import { BackIcon, PlusIcon, NotebookIcon, ExportIcon, DeployIcon, TrashIcon, GripIcon, SearchIcon, ForkIcon, WarningIcon } from '../components/NotebookIcons'
import { resolveTemplateRef } from '../lib/notebookGenerator'
import { exportNotebook, deployNotebook, checkNotebook } from '../lib/notebookApi'
import { readNdjsonStream, type NdjsonProgress } from '../lib/ndjsonClient'
import { parseTemplate } from '../lib/parser'
import type { TemplateRegistryEntry } from '../types/registry'
import { DEVICES, getPreferredDeviceType, setPreferredDeviceType, type DeviceId } from '../lib/renderer'
import './NotebookPage.css'

export function NotebookPage() {
  const [activeNotebookId, setActiveNotebookId] = useState<string | null>(null)
  const { drafts, createDraft, updateDraft, removeDraft, getDraft, forkDraft } = useNotebookList()

  const handleNewNotebook = useCallback(() => {
    const draft = createDraft()
    setActiveNotebookId(draft.id)
  }, [createDraft])

  const handleSelectNotebook = useCallback((id: string) => {
    setActiveNotebookId(id)
  }, [])

  const handleBack = useCallback(() => {
    setActiveNotebookId(null)
  }, [])

  const handleDeleteDraft = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    removeDraft(id)
    if (activeNotebookId === id) setActiveNotebookId(null)
  }, [removeDraft, activeNotebookId])

  const handleForkDraft = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    const forked = forkDraft(id)
    if (forked) setActiveNotebookId(forked.id)
  }, [forkDraft])

  if (activeNotebookId) {
    const draft = getDraft(activeNotebookId)
    return (
      <NotebookEditor
        key={activeNotebookId}
        draft={draft}
        onBack={handleBack}
        onSave={updateDraft}
        onSwitchNotebook={setActiveNotebookId}
        onForkDraft={forkDraft}
      />
    )
  }

  // ── List View ──
  return (
    <div className="notebook-page">
      <div className="notebook-list-header">
        <h2>Notebooks</h2>
      </div>
      <div className="notebook-list-grid">
        <button className="notebook-list-card notebook-list-new" onClick={handleNewNotebook}>
          <PlusIcon />
          <span>New Notebook</span>
        </button>
        {drafts.map(draft => {
          const totalPages = draft.pageGroups.reduce((s, g) => s + g.count, 0)
          return (
            <button
              key={draft.id}
              className="notebook-list-card"
              onClick={() => handleSelectNotebook(draft.id)}
            >
              {draft.pageGroups.length > 0 ? (
                <NotebookPageStrip
                  pageGroups={draft.pageGroups}
                  orientation="horizontal"
                  maxPages={6}
                />
              ) : (
                <div className="notebook-list-card-icon"><NotebookIcon /></div>
              )}
              <div className="notebook-list-card-name">
                {draft.name || 'Untitled'}
              </div>
              <div className="notebook-list-card-meta">
                {draft.pageGroups.length} group{draft.pageGroups.length !== 1 ? 's' : ''}
                {' \u00b7 '}
                {totalPages} page{totalPages !== 1 ? 's' : ''}
              </div>
              <div className="notebook-list-card-date">
                {new Date(draft.lastModified).toLocaleDateString()}
              </div>
              <div className="notebook-list-card-actions">
                <span
                  className="notebook-list-card-action"
                  title="Duplicate notebook"
                  onClick={e => handleForkDraft(e, draft.id)}
                >
                  <ForkIcon />
                </span>
                <span
                  className="notebook-list-card-action notebook-list-card-delete"
                  title="Delete draft"
                  onClick={e => handleDeleteDraft(e, draft.id)}
                >
                  <TrashIcon />
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Deploy Confirmation Dialog ──

interface DeployConfirmDialogProps {
  notebookName: string
  existingPageCount: number
  pristine: boolean
  onOverwrite: () => void
  onCancel: () => void
  newName: string | null
  onNewNameChange: (name: string) => void
  onShowNewNameInput: () => void
  onDeployAsNew: () => void
}

function DeployConfirmDialog({
  notebookName, existingPageCount, pristine,
  onOverwrite, onCancel,
  newName, onNewNameChange, onShowNewNameInput, onDeployAsNew,
}: DeployConfirmDialogProps) {
  return (
    <div className="notebook-confirm-overlay" onClick={onCancel}>
      <div className="notebook-confirm-dialog" onClick={e => e.stopPropagation()}>
        <div className="notebook-confirm-icon"><WarningIcon /></div>
        <h3>Notebook already exists on device</h3>
        <p>
          A notebook named <strong>&ldquo;{notebookName}&rdquo;</strong> already exists on the device
          with {existingPageCount} page{existingPageCount !== 1 ? 's' : ''}.
        </p>
        {!pristine && (
          <p className="notebook-confirm-warning">
            This notebook has been modified on the device (pages contain handwritten data).
            Overwriting will permanently destroy those changes.
          </p>
        )}
        <div className="notebook-confirm-actions">
          <button className="notebook-confirm-btn danger" onClick={onOverwrite}>
            {pristine ? 'Update in place' : 'Overwrite (destroy data)'}
          </button>
          {newName === null ? (
            <button className="notebook-confirm-btn" onClick={onShowNewNameInput}>
              Deploy as New Notebook
            </button>
          ) : (
            <div className="notebook-confirm-new-name">
              <input
                className="notebook-confirm-name-input"
                type="text"
                value={newName}
                onChange={e => onNewNameChange(e.target.value)}
                autoFocus
                placeholder="New notebook name..."
                onKeyDown={e => e.key === 'Enter' && newName.trim() && onDeployAsNew()}
              />
              <button
                className="notebook-confirm-btn"
                onClick={onDeployAsNew}
                disabled={!newName.trim()}
              >
                Deploy
              </button>
            </div>
          )}
          <button className="notebook-confirm-btn secondary" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Editor View (three-panel layout) ──

interface NotebookEditorProps {
  draft?: NotebookDraft
  onBack: () => void
  onSave: (draft: NotebookDraft) => void
  onSwitchNotebook: (id: string) => void
  onForkDraft: (id: string, customName?: string) => NotebookDraft | null
}

function NotebookEditor({ draft, onBack, onSave, onSwitchNotebook, onForkDraft }: NotebookEditorProps) {
  const { mergedRegistry, customRegistry } = useRegistryContext()
  const devicesState = useDevices()
  const { setBusy } = useBusy()

  const handleAutoSave = useCallback((editorState: NotebookEditorState) => {
    onSave({
      id: editorState.id,
      name: editorState.name,
      pageGroups: editorState.pageGroups,
      deviceId: editorState.deviceId,
      orientation: editorState.orientation,
      deployedUuid: editorState.deployedUuid,
      lastModified: Date.now(),
    })
  }, [onSave])

  const { state, dispatch } = useNotebookEditor(handleAutoSave)

  // Load draft on mount
  useEffect(() => {
    if (draft) {
      dispatch({ type: 'LOAD', draft })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const [searchFilter, setSearchFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [pickerWidth, setPickerWidth] = useState(240)
  const [previewWidth, setPreviewWidth] = useState(300)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [deployError, setDeployError] = useState<{ error: string; hint?: string; rawError?: string } | null>(null)
  const [exporting, setExporting] = useState(false)
  const [deploying, setDeploying] = useState(false)
  const [deployProgress, setDeployProgress] = useState<NdjsonProgress | null>(null)

  // Block navigation during deploy
  useEffect(() => {
    setBusy(deploying)
    return () => setBusy(false)
  }, [deploying, setBusy])

  // Deploy confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    existingUuid: string
    existingPageCount: number
    pristine: boolean
  } | null>(null)
  const [deployNewName, setDeployNewName] = useState<string | null>(null)

  // Drag state for reordering
  const dragIndex = useRef<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  // Combine all registries for the template picker
  const allTemplates = useMemo(() => {
    const templates: TemplateRegistryEntry[] = []
    if (mergedRegistry) templates.push(...mergedRegistry.templates)
    if (customRegistry) {
      for (const t of customRegistry.templates) {
        if (!templates.some(e => e.name === t.name && e.filename === t.filename)) {
          templates.push(t)
        }
      }
    }
    return templates
  }, [mergedRegistry, customRegistry])

  const allCategories = useMemo(() => {
    const cats = new Set<string>()
    for (const t of allTemplates) {
      for (const c of t.categories) cats.add(c)
    }
    return [...cats].sort()
  }, [allTemplates])

  const filteredTemplates = useMemo(() => {
    return allTemplates.filter(t => {
      if (categoryFilter && !t.categories.includes(categoryFilter)) return false
      if (searchFilter.trim()) {
        const q = searchFilter.toLowerCase()
        if (!t.name.toLowerCase().includes(q) && !t.categories.some(c => c.toLowerCase().includes(q))) return false
      }
      return true
    })
  }, [allTemplates, searchFilter, categoryFilter])

  // Load and cache parsed template for preview (when a single group is selected)
  const [previewTemplate, setPreviewTemplate] = useState<ReturnType<typeof parseTemplate> | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const previewCacheRef = useRef<Map<string, ReturnType<typeof parseTemplate>>>(new Map())

  const selectedGroup = state.selectedGroupIndex !== null
    ? state.pageGroups[state.selectedGroupIndex]
    : null

  const selectedTemplateRef = selectedGroup?.templateRef ?? null

  // Load preview when selected group changes
  useEffect(() => {
    if (!selectedTemplateRef || !selectedGroup) {
      setPreviewTemplate(null)
      return
    }

    const entry = allTemplates.find(t =>
      resolveTemplateRef(t) === selectedTemplateRef || t.name === selectedGroup.templateName,
    )
    if (!entry) {
      setPreviewTemplate(null)
      return
    }

    const cacheKey = entry.filename
    if (previewCacheRef.current.has(cacheKey)) {
      setPreviewTemplate(previewCacheRef.current.get(cacheKey)!)
      return
    }

    let cancelled = false
    setPreviewLoading(true)

    const filename = entry.filename.replace(/^(custom|debug)\//, '')
    const paths = [
      `/templates/custom/${filename}.template`,
      `/templates/debug/${filename}.template`,
      `/templates/${filename}.template`,
    ]

    ;(async () => {
      let tpl = null
      for (const path of paths) {
        try {
          const res = await fetch(path)
          if (res.ok) {
            const data = await res.json()
            tpl = parseTemplate(data)
            break
          }
        } catch { /* try next */ }
      }
      if (cancelled) return
      if (tpl) {
        previewCacheRef.current.set(cacheKey, tpl)
        setPreviewTemplate(tpl)
      } else {
        setPreviewTemplate(null)
      }
      setPreviewLoading(false)
    })()

    return () => { cancelled = true }
  }, [selectedTemplateRef, selectedGroup?.templateName, allTemplates]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddTemplate = useCallback((entry: TemplateRegistryEntry) => {
    const ref = resolveTemplateRef(entry)
    dispatch({
      type: 'ADD_GROUP',
      group: {
        id: crypto.randomUUID(),
        templateRef: ref,
        templateName: entry.name,
        count: 1,
        iconData: entry.iconData,
      },
    })
  }, [dispatch])

  const totalPages = useMemo(
    () => state.pageGroups.reduce((sum, g) => sum + g.count, 0),
    [state.pageGroups],
  )

  const definition = useMemo(() => ({
    name: state.name,
    pageGroups: state.pageGroups,
    orientation: state.orientation,
    deviceId: state.deviceId || getPreferredDeviceType(),
  }), [state.name, state.pageGroups, state.orientation, state.deviceId])

  const canExport = state.name.trim().length > 0 && state.pageGroups.length > 0

  const handleExport = useCallback(async () => {
    if (!canExport) {
      setErrorMessage(!state.name.trim() ? 'Please enter a notebook name' : 'Add at least one template')
      return
    }
    setExporting(true)
    setErrorMessage(null)
    setStatusMessage('Exporting notebook...')
    try {
      const blob = await exportNotebook(definition)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${state.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.notebook.zip`
      a.click()
      URL.revokeObjectURL(url)
      setStatusMessage('Notebook exported successfully')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Export failed')
      setStatusMessage(null)
    } finally {
      setExporting(false)
    }
  }, [canExport, definition, state.name])

  /** Execute the actual deploy, optionally reusing an existing UUID or using a renamed name */
  const executeDeploy = useCallback(async (overrides?: { reuseUuid?: string; name?: string }) => {
    const activeId = devicesState.activeDeviceId
    if (!activeId) return

    const deployDef = {
      ...definition,
      ...(overrides?.name ? { name: overrides.name } : {}),
      ...(overrides?.reuseUuid ? { reuseUuid: overrides.reuseUuid } : {}),
    }

    setDeploying(true)
    setErrorMessage(null)
    setDeployError(null)
    setDeployProgress(null)

    try {
      // Step 1: Deploy any rm_methods templates referenced by the notebook
      const methodsUuids = new Set<string>()
      for (const group of state.pageGroups) {
        const colonIdx = group.templateRef.indexOf(':')
        if (colonIdx > 0) {
          methodsUuids.add(group.templateRef.slice(0, colonIdx))
        }
      }

      if (methodsUuids.size > 0) {
        setDeployProgress({ phase: `Deploying ${methodsUuids.size} referenced template${methodsUuids.size > 1 ? 's' : ''}...` })
        const deployTemplatesRes = await fetch(`/api/devices/${activeId}/deploy-methods`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ templateIds: [...methodsUuids] }),
        })

        const contentType = deployTemplatesRes.headers.get('content-type') ?? ''
        if (contentType.includes('application/x-ndjson')) {
          await readNdjsonStream(deployTemplatesRes, p => {
            setDeployProgress({ phase: `Templates: ${p.phase}`, current: p.current, total: p.total })
          })
        } else if (!deployTemplatesRes.ok) {
          const data = await deployTemplatesRes.json() as { error?: string; hint?: string; rawError?: string }
          throw { error: data.error || 'Failed to deploy referenced templates', hint: data.hint, rawError: data.rawError }
        }
      }

      // Step 2: Deploy the notebook itself
      setDeployProgress({ phase: 'Deploying notebook...' })
      const result = await deployNotebook(activeId, deployDef, msg => {
        setDeployProgress({ phase: msg })
      })

      // Track the deployed UUID for future update-in-place detection
      if (result.notebookUuid) {
        dispatch({ type: 'SET_DEPLOYED_UUID', deployedUuid: result.notebookUuid })
      }

      setDeployProgress(null)
      setStatusMessage(`Notebook deployed successfully (${result.steps.length} steps)`)
    } catch (err) {
      const e = err as { error?: string; hint?: string; rawError?: string; message?: string }
      setDeployError({
        error: e.error ?? e.message ?? String(err),
        hint: e.hint,
        rawError: e.rawError,
      })
      setStatusMessage(null)
      setDeployProgress(null)
    } finally {
      setDeploying(false)
    }
  }, [definition, state.pageGroups, devicesState.activeDeviceId, dispatch])

  const handleDeploy = useCallback(async () => {
    if (!canExport) {
      setErrorMessage(!state.name.trim() ? 'Please enter a notebook name' : 'Add at least one template')
      return
    }
    const activeId = devicesState.activeDeviceId
    if (!activeId) {
      setErrorMessage('No device configured. Go to Devices page to add one.')
      return
    }

    // If we have a previously deployed UUID, check if it still exists on device
    if (state.deployedUuid) {
      setDeployProgress({ phase: 'Checking for existing notebook on device...' })
      try {
        const check = await checkNotebook(activeId, state.deployedUuid)
        setDeployProgress(null)

        if (check.exists) {
          setConfirmDialog({
            existingUuid: check.uuid!,
            existingPageCount: check.pageCount ?? 0,
            pristine: check.pristine ?? true,
          })
          return
        }
        // Previously deployed notebook no longer on device — deploy fresh
      } catch {
        // If the check fails, proceed with deploy
        setDeployProgress(null)
      }
    }

    // No conflict — deploy directly
    await executeDeploy()
  }, [canExport, state.name, state.deployedUuid, devicesState.activeDeviceId, executeDeploy])

  const handleConfirmOverwrite = useCallback(() => {
    const uuid = confirmDialog?.existingUuid
    setConfirmDialog(null)
    executeDeploy({ reuseUuid: uuid })
  }, [confirmDialog, executeDeploy])

  const handleShowNewNameInput = useCallback(() => {
    setDeployNewName(`Copy of ${state.name.trim()}`)
  }, [state.name])

  const handleDeployAsNew = useCallback(async () => {
    const name = deployNewName?.trim()
    if (!name) return
    setConfirmDialog(null)
    setDeployNewName(null)

    // Fork the current draft as a new notebook
    const forked = onForkDraft(state.id, name)
    if (!forked) return

    // Deploy the new notebook (no reuseUuid — fresh deploy)
    await executeDeploy({ name })

    // Switch editor to the newly created notebook
    onSwitchNotebook(forked.id)
  }, [deployNewName, state.id, onForkDraft, executeDeploy, onSwitchNotebook])

  const handleConfirmCancel = useCallback(() => {
    setConfirmDialog(null)
    setDeployNewName(null)
  }, [])

  // Drag handlers for reordering
  const handleDragStart = useCallback((index: number) => {
    dragIndex.current = index
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault()
    setDragOverIndex(index)
  }, [])

  const handleDrop = useCallback((toIndex: number) => {
    const fromIndex = dragIndex.current
    if (fromIndex !== null && fromIndex !== toIndex) {
      dispatch({ type: 'REORDER_GROUP', fromIndex, toIndex })
    }
    dragIndex.current = null
    setDragOverIndex(null)
  }, [dispatch])

  const handleDragEnd = useCallback(() => {
    dragIndex.current = null
    setDragOverIndex(null)
  }, [])

  return (
    <div className="notebook-page">
      {/* Deploy confirmation dialog */}
      {confirmDialog && (
        <DeployConfirmDialog
          notebookName={state.name}
          existingPageCount={confirmDialog.existingPageCount}
          pristine={confirmDialog.pristine}
          onOverwrite={handleConfirmOverwrite}
          onCancel={handleConfirmCancel}
          newName={deployNewName}
          onNewNameChange={setDeployNewName}
          onShowNewNameInput={handleShowNewNameInput}
          onDeployAsNew={handleDeployAsNew}
        />
      )}

      {/* Toolbar */}
      <div className="notebook-toolbar">
        <button className="notebook-toolbar-back" onClick={onBack} title="Back to notebooks" disabled={deploying}>
          <BackIcon />
        </button>
        <input
          className="notebook-toolbar-name"
          type="text"
          placeholder="Notebook name..."
          value={state.name}
          onChange={e => dispatch({ type: 'SET_NAME', name: e.target.value })}
        />
        <select
          className="notebook-toolbar-device"
          value={state.deviceId}
          onChange={e => {
            const id = e.target.value as DeviceId
            dispatch({ type: 'SET_DEVICE_ID', deviceId: id })
            setPreferredDeviceType(id)
          }}
        >
          {Object.entries(DEVICES).map(([id, spec]) => (
            <option key={id} value={id}>
              {spec.name}{id === getPreferredDeviceType() ? ' \u2605' : ''}
            </option>
          ))}
        </select>
        <select
          className="notebook-toolbar-orientation"
          value={state.orientation}
          onChange={e => dispatch({ type: 'SET_ORIENTATION', orientation: e.target.value as 'portrait' | 'landscape' })}
        >
          <option value="portrait">Portrait</option>
          <option value="landscape">Landscape</option>
        </select>
        <button
          className="notebook-toolbar-btn primary"
          onClick={handleExport}
          disabled={exporting || deploying || !canExport}
          title="Export notebook as ZIP"
        >
          <ExportIcon />
          {exporting ? 'Exporting...' : 'Export ZIP'}
        </button>
        <DeviceSelector devicesState={devicesState} />
        <button
          className="notebook-toolbar-btn"
          onClick={handleDeploy}
          disabled={deploying || exporting || !canExport || !devicesState.activeDeviceId}
          title={devicesState.activeDeviceId ? `Deploy to ${devicesState.activeDevice?.nickname ?? 'device'}` : 'No device configured'}
        >
          <DeployIcon />
          {deploying ? 'Deploying...' : 'Deploy'} <span className="beta-badge">Beta</span>
        </button>
        <span className="notebook-toolbar-page-count">
          {totalPages} page{totalPages !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Progress bar for deploy operations */}
      {deployProgress && (
        <div style={{ padding: '0 16px' }}>
          <ProgressBar progress={deployProgress} showTip />
        </div>
      )}
      {statusMessage && !deployProgress && <div className="device-status">{statusMessage}</div>}
      {errorMessage && <div className="device-error">{errorMessage}</div>}
      {deployError && (
        <div style={{ padding: '0 16px' }}>
          <ErrorDetails
            error={deployError.error}
            hint={deployError.hint}
            rawError={deployError.rawError}
            deviceModel={devicesState.activeDevice?.deviceModel}
            className="device-error"
          />
        </div>
      )}

      {/* Three-panel layout */}
      <div className="notebook-panels">
        {/* Left: Template picker */}
        <div className="notebook-picker" style={{ width: pickerWidth }}>
          <div className="notebook-picker-header">Templates</div>
          <div className="notebook-picker-search-wrap">
            <SearchIcon />
            <input
              className="notebook-picker-search"
              type="text"
              placeholder="Search templates..."
              value={searchFilter}
              onChange={e => setSearchFilter(e.target.value)}
            />
          </div>
          {allCategories.length > 0 && (
            <div className="notebook-picker-categories">
              {allCategories.map(cat => (
                <button
                  key={cat}
                  className={`notebook-picker-cat-chip${categoryFilter === cat ? ' active' : ''}`}
                  onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
                >
                  {cat}
                </button>
              ))}
              {categoryFilter && (
                <button
                  className="notebook-picker-cat-chip clear"
                  onClick={() => setCategoryFilter(null)}
                >
                  Clear
                </button>
              )}
            </div>
          )}
          <div className="notebook-picker-list">
            {filteredTemplates.map(entry => (
              <button
                key={entry.filename}
                className="notebook-picker-item"
                onClick={() => handleAddTemplate(entry)}
                title={`Add "${entry.name}" to notebook`}
              >
                <TemplateThumbnail iconData={entry.iconData} landscape={entry.landscape} />
                <span className="notebook-picker-item-name">{entry.name}</span>
              </button>
            ))}
          </div>
        </div>

        <ResizeDivider onResize={delta => setPickerWidth(w => Math.max(180, Math.min(400, w + delta)))} />

        {/* Center: Page groups */}
        <div className="notebook-groups">
          <div className="notebook-groups-header">
            Page Groups ({state.pageGroups.length})
          </div>
          <div className="notebook-groups-list">
            {state.pageGroups.length === 0 ? (
              <div className="notebook-empty">
                <span>No pages yet</span>
                <span>Click a template on the left to add it</span>
              </div>
            ) : (
              state.pageGroups.map((group, index) => (
                <div
                  key={group.id}
                  className={`notebook-group-card${state.selectedGroupIndex === index ? ' selected' : ''}${dragOverIndex === index ? ' drag-over' : ''}`}
                  onClick={() => dispatch({ type: 'SELECT_GROUP', index })}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={e => handleDragOver(e, index)}
                  onDrop={() => handleDrop(index)}
                  onDragEnd={handleDragEnd}
                >
                  <span className="notebook-group-drag-handle" title="Drag to reorder"><GripIcon /></span>
                  <TemplateThumbnail iconData={group.iconData} />
                  <div className="notebook-group-info">
                    <div className="notebook-group-name">{group.templateName}</div>
                    <div className="notebook-group-ref">{group.templateRef}</div>
                  </div>
                  <div className="notebook-group-count">
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={group.count}
                      onClick={e => e.stopPropagation()}
                      onChange={e => dispatch({
                        type: 'SET_GROUP_COUNT',
                        index,
                        count: parseInt(e.target.value, 10) || 1,
                      })}
                    />
                    <span className="notebook-group-count-label">pages</span>
                  </div>
                  <button
                    className="notebook-group-delete"
                    title="Remove group"
                    onClick={e => {
                      e.stopPropagation()
                      dispatch({ type: 'REMOVE_GROUP', index })
                    }}
                  >
                    <TrashIcon />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <ResizeDivider onResize={delta => setPreviewWidth(w => Math.max(200, Math.min(500, w - delta)))} />

        {/* Right: Preview — scrollable page strip or single template preview */}
        <div className="notebook-preview" style={{ width: previewWidth }}>
          <div className="notebook-preview-header">
            Preview
            {state.pageGroups.length > 0 && (
              <span className="notebook-preview-count">{totalPages} pages</span>
            )}
          </div>
          <div className="notebook-preview-content">
            {state.pageGroups.length > 0 ? (
              <NotebookPageStrip
                pageGroups={state.pageGroups}
                orientation="vertical"
              />
            ) : (
              <div className="notebook-preview-empty">
                Add templates to preview notebook
              </div>
            )}
          </div>
          {/* Selected group detail preview */}
          {selectedGroup && previewTemplate && (
            <div className="notebook-preview-detail">
              <div className="notebook-preview-detail-header">
                {selectedGroup.templateName}
              </div>
              <div className="notebook-preview-canvas">
                {previewLoading ? (
                  <div className="notebook-preview-empty">Loading...</div>
                ) : (
                  <TemplateCanvas template={previewTemplate} deviceId={state.deviceId} />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
