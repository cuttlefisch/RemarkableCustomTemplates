# Data Architecture

Reference document for contributors and maintainers covering persistent storage, data stores, data flow, environment configuration, and API routes.

---

## Storage Map

All persistent data is rooted at `DATA_DIR`, which resolves differently per environment:

| Environment | DATA_DIR |
|---|---|
| Dev (native) | `process.cwd()` (project root) |
| Docker | `/data` (persistent volume) |
| Electron | `app.getPath('userData')` |

```
DATA_DIR/
├── public/templates/
│   ├── custom/                          # User-created templates
│   │   ├── custom-registry.json         # Registry of custom template entries
│   │   ├── hidden-samples.json          # IDs of sample templates hidden by user
│   │   ├── hidden-notebooks.json        # IDs of built-in notebooks hidden by user
│   │   └── *.template                   # Custom template JSON files
│   ├── debug/                           # Debug/test templates
│   │   ├── debug-registry.json          # Registry of debug template entries
│   │   └── *.template                   # Debug template JSON files
│   ├── methods/                         # rm_methods templates pulled from device
│   │   ├── methods-registry.json        # Registry of pulled methods templates
│   │   └── *.template                   # Methods template JSON files
│   └── samples/                         # Built-in sample templates (bundled)
│       ├── samples-registry.json        # Registry of sample template entries
│       └── *.template                   # Sample template JSON files
├── data/
│   ├── device-config.json               # Multi-device store (versioned, v2)
│   ├── notebooks.json                   # Notebook drafts store (versioned, v1)
│   ├── ssh/                             # Per-device SSH keys
│   │   └── {deviceId}/
│   │       ├── id_remarkable            # RSA private key (4096-bit)
│   │       └── id_remarkable.pub        # OpenSSH public key
│   └── backups/                         # Server-side backup ZIPs
│       └── remarkable-backup-*.zip
├── rm-methods-dist/                     # Built methods distribution files
│   ├── .manifest                        # JSON manifest (name, version, hash, createdTime per UUID)
│   └── {uuid}.{template,metadata,content}  # UUID-named file triplets
├── rm-methods-backups/                  # Deploy state and rollback snapshots
│   ├── .deployed-manifest               # Legacy global deployed manifest
│   ├── .original                        # Legacy global original backup
│   └── {deviceId}/                      # Per-device deploy state
│       ├── .deployed-manifest           # What is currently deployed on this device
│       ├── .original                    # Original device state before first deploy
│       ├── .xovi-deployed               # xovi extension deploy state (pristine + tracked IDs)
│       └── rm-methods_YYYYMMDD_HHMMSS/  # Timestamped rollback snapshots
├── notebook-dist/                       # Generated notebook files (staging, cleaned after deploy)
│   └── {uuid}/
│       ├── {uuid}.content               # cPages v2 CRDT content
│       ├── {uuid}.metadata              # Notebook metadata (visibleName, type, etc.)
│       ├── {uuid}.local                 # Local state
│       └── {uuid}/                      # Page directory
│           └── {pageId}.rm              # Empty .rm stubs (PPM only, 423 bytes)
├── dist-deploy/                         # Classic deploy distribution (legacy format)
└── remarkable_official_templates/       # Unmodified originals pulled from device (git-ignored)
```

---

## Data Stores

| Store | File | Format | CRUD Pattern | Backup Included |
|---|---|---|---|---|
| Device Config | `data/device-config.json` | Versioned JSON (v2) | `readDeviceStore`/`writeDeviceStore` full-rewrite | No |
| Notebook Drafts | `data/notebooks.json` | Versioned JSON (v1) | `readNotebookStore`/`writeNotebookStore` full-rewrite | Yes |
| Custom Templates | `custom/*.template` + `custom-registry.json` | JSON registry + template files | Read registry, CRUD entries, write registry + files | Yes |
| Debug Templates | `debug/*.template` + `debug-registry.json` | Same as custom | Same as custom | Yes |
| Methods Templates | `methods/*.template` + `methods-registry.json` | Pulled from device via SFTP | Read-only (pulled via device pull) | No |
| Sample Templates | `samples/*.template` + `samples-registry.json` | Bundled with app | Read-only; user hides via `hidden-samples.json` | No |
| Built-in Notebooks | Virtual (generated from registries) | N/A | Generated on demand; hidden via `hidden-notebooks.json` | No |
| Deploy State | `rm-methods-backups/{deviceId}/.deployed-manifest` | JSON manifest | Read/write on deploy/rollback | Yes |
| xovi Deploy State | `rm-methods-backups/{deviceId}/.xovi-deployed` | JSON | `readXoviDeployedState`/`writeXoviDeployedState` | No |
| App Backups | `data/backups/*.zip` | ZIP archive | Created on backup, listed, downloaded, deleted | N/A |

### Store versioning

Both JSON stores use an envelope with a `version` field. On read, old formats are auto-migrated:

- **Device Config**: v1 (flat `DeviceConfig` object, no version field) migrates to v2 `{ version: 2, devices: [...], activeDeviceId }`. SSH keys are moved from a shared location to `data/ssh/{deviceId}/` during migration.
- **Notebook Drafts**: v1 is the only version: `{ version: 1, drafts: [...] }`.

Both stores use a full-rewrite pattern: read the entire JSON, mutate in memory, write the entire file back. Parent directories are created automatically via `mkdirSync({ recursive: true })`.

---

## Data Flow Diagrams

### Template lifecycle

```
Create (JSON editor or Drawing editor)
  │
  ▼
Save to custom dir
  ├── Write *.template file to public/templates/custom/
  └── Update custom-registry.json (add/update entry)
  │
  ▼
Build methods distribution
  ├── Resolve string constants in template
  ├── Generate UUID-named triplet: {uuid}.template, .metadata, .content
  └── Write .manifest to rm-methods-dist/
  │
  ▼
Deploy via SFTP (rm_methods format)
  ├── Connect to device via SSH
  ├── Push UUID triplets to /home/root/.local/share/remarkable/xochitl/
  ├── Update per-device .deployed-manifest
  ├── Clean up orphaned UUIDs from previous deploys
  └── Restart xochitl
  │
  ▼
Backup
  ├── Collect custom + debug templates, registries, notebook drafts, deploy manifest
  ├── Package into timestamped ZIP
  └── Store server-side copy in data/backups/
```

### Notebook lifecycle

```
Create notebook draft (UI)
  │
  ▼
Edit (auto-save with 500ms debounce)
  ├── Client sends PUT /api/notebook-drafts/:id
  └── Server writes full notebook store to data/notebooks.json
  │
  ├──────────────────────┐
  ▼                      ▼
Export as ZIP            Deploy via SFTP
  │                      │
  ├── Generate files:    ├── Generate files to notebook-dist/{uuid}/
  │   .content           ├── Push .content, .metadata, .local via SFTP
  │   .metadata          ├── Push .rm stubs (PPM only, 423 bytes)
  │   .local             ├── Restart xochitl
  │   .rm (PPM only)     └── Clean up staging dir
  └── Download ZIP
```

### Backup and restore

```
Backup (GET /api/backup):
  ├── Read custom-registry.json + all custom/*.template files
  ├── Read debug-registry.json + all debug/*.template files
  ├── Read notebooks.json (if drafts exist)
  ├── Read .deployed-manifest (if exists)
  ├── Read all rm-methods-dist/ files (UUID triplets + .manifest)
  ├── Build backup-manifest.json with counts and timestamp
  ├── Package into ZIP: remarkable-backup-YYYY-MM-DD_HHMMSS.zip
  └── Save server-side copy to data/backups/

Restore (POST /api/restore?mode=merge|replace):
  ├── Validate ZIP contents (manifest, registries, template files)
  │
  ├── mode=merge:
  │   ├── Compare incoming vs existing entries (match by rmMethodsId, then filename)
  │   ├── Add new entries (skip duplicates)
  │   └── Merge notebook drafts by ID (skip existing)
  │
  ├── mode=replace:
  │   ├── Overwrite registries entirely
  │   ├── Remove local .template files not in backup
  │   ├── Replace notebook drafts store
  │   └── Report removed entries
  │
  ├── Restore .deployed-manifest to rm-methods-backups/
  ├── Restore rm-methods-dist/ files (UUID triplets + manifest)
  └── Restore notebook drafts (merge or replace depending on mode)
```

---

## Environment Matrix

| | Dev | Docker | Electron |
|---|---|---|---|
| DATA_DIR | `process.cwd()` | `/data` (volume) | `app.getPath('userData')` |
| Port | 3001 (API), 5173 (Vite) | 3000 | Random (OS picks) |
| Frontend serving | Vite dev server proxies `/api/*` and `/templates/*` to Fastify | Fastify serves both API and static build | Fastify serves both API and static build |
| Host binding | `0.0.0.0` | `0.0.0.0` | `127.0.0.1` only |
| Preload script | N/A | N/A | CJS format (Electron sandbox) |
| Asset paths | `public/` (Vite serves directly) | Built into image | `process.resourcesPath` |
| Samples pristine dir | Same as `samplesDir` | `../app/samples-pristine` relative to DATA_DIR | Passed via override |

---

## API Route Map

### Templates (read-only serving)

| Method | Route | Description |
|---|---|---|
| GET | `/templates/templates.json` | Merged registry (debug + methods + official + samples) |
| GET | `/templates/*.template` | Serve individual template files |

### Custom Templates

| Method | Route | Description |
|---|---|---|
| POST | `/api/custom-templates` | Create new custom template |
| PUT | `/api/custom-templates` | Update existing custom template |
| PATCH | `/api/custom-templates` | Partial update (rename, change category) |
| DELETE | `/api/custom-templates` | Delete custom template by filename |
| POST | `/api/custom-templates/:name/copy` | Duplicate a template |

### Official Templates

| Method | Route | Description |
|---|---|---|
| POST | `/api/save-official-templates` | Save pulled official templates |

### Sample Templates

| Method | Route | Description |
|---|---|---|
| GET | `/api/sample-templates/hidden` | List hidden sample filenames |
| POST | `/api/sample-templates/hide` | Hide a sample template |
| POST | `/api/sample-templates/unhide` | Unhide a sample template |

### Notebook Drafts

| Method | Route | Description |
|---|---|---|
| GET | `/api/notebook-drafts` | List all drafts |
| POST | `/api/notebook-drafts` | Create draft or batch-import `{ drafts: [...] }` |
| PUT | `/api/notebook-drafts/:id` | Update an existing draft |
| DELETE | `/api/notebook-drafts/:id` | Delete a draft |
| POST | `/api/notebook-drafts/:id/fork` | Duplicate a draft with new UUIDs |

### Built-in Notebooks

| Method | Route | Description |
|---|---|---|
| GET | `/api/builtin-notebooks` | List non-hidden built-in notebooks (virtual, from registries) |
| GET | `/api/builtin-notebooks/hidden` | List hidden notebook IDs |
| POST | `/api/builtin-notebooks/hide` | Hide a built-in notebook by ID |
| POST | `/api/builtin-notebooks/restore-all` | Restore all hidden notebooks |

### Notebook Export and Deploy

| Method | Route | Description |
|---|---|---|
| POST | `/api/notebooks/export` | Generate and download notebook as ZIP |
| POST | `/api/devices/:id/deploy-notebook` | Deploy notebook to device via SFTP (NDJSON stream) |
| POST | `/api/devices/:id/check-notebook` | Check if notebook UUID exists on device |

### Export

| Method | Route | Description |
|---|---|---|
| GET | `/api/export-templates` | ZIP of official + custom + debug templates |
| GET | `/api/export-rm-methods` | ZIP in rm_methods UUID format |
| GET | `/api/export-template/:uuid` | Export single template by rmMethodsId |
| GET | `/api/export-template-by-name/:slug` | Export single template by filename slug |

### Backup and Restore

| Method | Route | Description |
|---|---|---|
| GET | `/api/backup` | Export backup ZIP (also saves server-side copy) |
| POST | `/api/restore` | Import backup ZIP (`?mode=merge` or `?mode=replace`) |
| POST | `/api/restore/preview` | Dry-run: preview merge/replace actions |
| POST | `/api/restore/cleanup` | Delete specific local templates after restore |
| GET | `/api/backups` | List server-side backup ZIPs |
| GET | `/api/backups/:filename/download` | Download a server-side backup |
| POST | `/api/restore-from-backup/:filename` | Restore from a server-side backup |
| DELETE | `/api/backups/:filename` | Delete a server-side backup |

### Devices

| Method | Route | Description |
|---|---|---|
| GET | `/api/devices` | List all devices (passwords redacted) |
| POST | `/api/devices` | Add a new device |
| PUT | `/api/devices/:id` | Update a device |
| DELETE | `/api/devices/:id` | Remove a device + cleanup per-device data |
| GET | `/api/devices/active` | Get active device ID and config |
| POST | `/api/devices/active` | Set active device by ID |
| POST | `/api/devices/:id/test-connection` | Test SSH connectivity, detect model and firmware |
| POST | `/api/devices/:id/setup-keys` | Generate RSA keypair and install on device |

### Device Sync

| Method | Route | Description |
|---|---|---|
| POST | `/api/devices/:id/sync-status` | Compare local vs device templates |
| POST | `/api/devices/:id/deploy-methods` | Deploy templates via rm_methods (NDJSON stream) |
| POST | `/api/devices/:id/deploy-classic` | Deploy templates via classic format (NDJSON stream) |

### Device Pull

| Method | Route | Description |
|---|---|---|
| POST | `/api/devices/:id/pull-official` | Pull official templates from device |
| POST | `/api/devices/:id/pull-methods` | Pull rm_methods templates from device |

### Device Rollback

| Method | Route | Description |
|---|---|---|
| POST | `/api/devices/:id/rollback-methods` | Rollback rm_methods deploy |
| POST | `/api/devices/:id/rollback-original` | Restore original device state |
| POST | `/api/devices/:id/rollback-classic` | Rollback classic deploy |

### Device Backups and Remove All

| Method | Route | Description |
|---|---|---|
| GET | `/api/devices/:id/backups` | List per-device rollback snapshots |
| POST | `/api/devices/:id/remove-all-preview` | Preview what remove-all would delete |
| POST | `/api/devices/:id/remove-all-execute` | Remove all deployed templates from device |

### xovi Extensions

| Method | Route | Description |
|---|---|---|
| POST | `/api/devices/:id/xovi-status` | Check xovi + extension status on device |
| POST | `/api/devices/:id/xovi-deploy` | Deploy QMD extension files (NDJSON stream) |
| POST | `/api/devices/:id/xovi-remove` | Remove QMD extension files (NDJSON stream) |
| POST | `/api/devices/:id/vellum-install-xovi` | Install xovi via Vellum (NDJSON stream) |
| POST | `/api/devices/:id/vellum-remove-xovi` | Remove xovi via Vellum (NDJSON stream) |

---

## Backup ZIP Structure

```
remarkable-backup-YYYY-MM-DD_HHMMSS.zip
├── backup-manifest.json                    # { version: 1, createdAt, templateCount, notebookCount }
├── custom/
│   ├── custom-registry.json                # Custom template registry
│   └── *.template                          # Custom template files
├── debug/
│   ├── debug-registry.json                 # Debug template registry
│   └── *.template                          # Debug template files
├── notebooks/
│   └── notebooks.json                      # { version: 1, drafts: [...] }
├── manifests/
│   └── .deployed-manifest                  # Deploy state for rollback tracking
└── rm-methods-dist/
    ├── .manifest                           # Build manifest with UUIDs, hashes, versions
    └── {uuid}.{template,metadata,content}  # Built distribution files
```

Backup files are validated on restore: registries are parsed with `parseRegistry()`, template files are parsed with `parseTemplate()`. Broken files are reported as warnings but do not block the restore.

Methods templates (pulled from device) and sample templates (bundled) are excluded from backups since they can be re-pulled or are already bundled.

---

## Per-Device Data

Each device gets an auto-generated UUID when added. This ID is used to namespace all per-device data.

### Directory structure per device

```
data/ssh/{deviceId}/
├── id_remarkable              # RSA 4096-bit private key
└── id_remarkable.pub          # OpenSSH public key

rm-methods-backups/{deviceId}/
├── .deployed-manifest         # JSON manifest of what is currently on this device
├── .original                  # Snapshot of device state before first deploy
├── .xovi-deployed             # xovi extension deploy state (pristine + tracked IDs)
└── rm-methods_YYYYMMDD_HHMMSS/  # Timestamped rollback snapshots (one per deploy)
```

### Path resolution

Per-device paths are resolved via `resolveDevicePaths(config, deviceId)` in `server/config.ts`:

```typescript
interface DevicePaths {
  backupDir: string           // rm-methods-backups/{deviceId}/
  deployedManifest: string    // rm-methods-backups/{deviceId}/.deployed-manifest
  originalBackup: string      // rm-methods-backups/{deviceId}/.original
  sshDir: string              // data/ssh/{deviceId}/
  xoviDeployedState: string   // rm-methods-backups/{deviceId}/.xovi-deployed
}
```

### Device removal cleanup

When a device is deleted via `DELETE /api/devices/:id`:

1. The device entry is removed from `device-config.json`.
2. If the deleted device was the active device, the first remaining device becomes active (or `null` if none remain).
3. Per-device directories are deleted (best-effort, errors are swallowed):
   - `rm-methods-backups/{deviceId}/` -- deployed manifest, original backup, rollback snapshots
   - `data/ssh/{deviceId}/` -- SSH keypair
4. Templates that were deployed to the removed device remain on the device itself (no remote cleanup).

### v1 to v2 migration

When the device store detects a v1 config (flat object, no `version` field), it:

1. Wraps the single device in a v2 envelope with a new UUID.
2. Moves any existing SSH key from its old path to `data/ssh/{newDeviceId}/id_remarkable`.
3. Writes the migrated v2 store back to disk immediately.
