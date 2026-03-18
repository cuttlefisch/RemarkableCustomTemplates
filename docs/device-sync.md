# Device Sync

Most users can do everything from the **Device & Sync** page in the browser — SSH setup, pulling templates, deploying, rolling back, and backups all have browser-based equivalents. See the [quickstart](quickstart.md) for that workflow.

This doc covers CLI workflows, manual SSH setup, troubleshooting, and format internals for power users and developers.

## Prerequisites

> **Browser-based setup (recommended):** The **Device & Sync** page (`/device`) handles SSH key generation, connection testing, and device configuration in-browser — replacing steps 1–4 below. The manual steps here are for CLI-only workflows.

### 1. Generate an SSH key (if you don't have one)

```bash
ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_rsa_remarkable
```

### 2. Copy it to the device

```bash
ssh-copy-id -i ~/.ssh/id_rsa_remarkable.pub root@<device-ip>
```

You can find the device IP under **Settings → Help → Copyrights and Licenses → GPLv3 Compliance** (same screen that shows the SSH password).

### 3. Add a `~/.ssh/config` block

```
Host remarkable-wlan
    HostName <device-ip>
    User root
    IdentityFile ~/.ssh/id_rsa_remarkable
    ServerAliveInterval 30
```

Replace `<device-ip>` with your device's current IP. After this you can use `remarkable-wlan` everywhere instead of `root@<ip>`.

### 4. Test the connection

```bash
ssh remarkable-wlan "echo connected"
```

## One-time device setup

### Enable SSH over WLAN (required for both browser and CLI workflows)

On the device, run from a terminal (or via existing SSH):

```bash
rm-ssh-over-wlan on
```

> **Developer mode note:** Paper Pro and Move require developer mode to be enabled before SSH access works. Enabling developer mode triggers a factory reset — do this before you put any notes on the device.

### Finding credentials

Go to **Settings → Help → Copyrights and Licenses → GPLv3 Compliance**. The root password and current IP are shown there.

> **Warning:** The SSH password resets on every firmware update. After an update, re-run `ssh-copy-id` with the new password to restore key-based auth.

---

## Recommended workflow: rm_methods deploy

The rm_methods workflow drops files into xochitl's user content directory using the same format as official reMarkable methods templates. This means xochitl treats them as native content and **syncs them across paired devices** via the reMarkable cloud.

> **Browser-based alternative:** The **Device & Sync** page provides browser-based equivalents for pull, deploy, and rollback operations. The CLI targets below are for developer/scripting workflows.

### Happy path

```bash
pnpm dev                        # 1. dev server must be running
make build-rm-methods-dist      # 2. export ZIP → rm-methods-dist/
make deploy-rm-methods          # 3. back up, deploy, restart xochitl
```

Templates appear in the device picker within a few seconds.

### What `make deploy-rm-methods` does

1. **Backup** (`make backup-rm-methods`) — on first deploy, captures pristine device state as `rm-methods-backups/.original/` with an empty manifest. On subsequent deploys, pulls currently-deployed template files from the device into a timestamped backup directory using the deployed manifest.
2. **Orphan cleanup** — compares the previous deploy manifest against the new build manifest. Any UUIDs present in the old manifest but missing from the new one are deleted from the device (removes the `.template`, `.metadata`, and `.content` files).
3. **rsync** — pushes all files from `rm-methods-dist/` to the device's xochitl directory. The `.manifest` file is excluded from the transfer.
4. **Update manifest** — copies the build manifest to `rm-methods-backups/.deployed-manifest` to track the current device state.
5. **Restart** — restarts `xochitl` on the device.

### File format

Each template produces three files:

| File | Contents |
|------|----------|
| `<uuid>.template` | Template JSON enriched with `iconData` and `labels` |
| `<uuid>.metadata` | `visibleName`, `source: "com.remarkable.methods"`, timestamps |
| `<uuid>.content` | Empty `{}` |

UUIDs are generated on first export and persisted in the registry (`custom-registry.json` / `debug-registry.json`) so they remain stable across subsequent exports.

### Manifest tracking

`make build-rm-methods-dist` generates `rm-methods-dist/.manifest` — a JSON file with `exportedAt`, and a `templates` object keyed by UUID containing `name`, `templateVersion`, `contentHash`, and `createdTime` per template. After deploy, a copy is saved at `rm-methods-backups/.deployed-manifest` to track what's currently on the device.

This enables:
- **Orphan cleanup** — templates removed from the registry are automatically deleted from the device on the next deploy
- **Accurate backups** — only the files that were actually deployed are pulled back during backup
- **Clean rollbacks** — templates added after a backup point are removed during rollback

### Backup structure

```
rm-methods-backups/
├── .deployed-manifest              ← tracks current device state
├── .original/                      ← first-ever backup (pristine), never overwritten
│   └── .manifest                   ← empty (no custom templates existed)
├── rm-methods_20260317_120000/     ← backup before 2nd deploy
│   └── .manifest
└── rm-methods_20260317_140000/     ← backup before 3rd deploy
    └── .manifest
```

### Rollback

**Revert to the most recent backup** (previous deploy state):

```bash
make rollback-rm-methods
```

This removes any templates added since the backup, restores the backed-up files, and updates the deployed manifest.

**Revert to pristine device state** (remove all custom templates):

```bash
make rollback-rm-methods-original
```

This removes every UUID listed in the deployed manifest from the device. The `.original/` backup is captured automatically on first deploy.

**List available backups:**

```bash
make list-backups-rm-methods
```

### First deploy note

On the very first `make deploy-rm-methods`, the backup step captures `rm-methods-backups/.original/` with an empty manifest (representing zero custom templates). This baseline is never overwritten and serves as the target for `make rollback-rm-methods-original`.

---

## How rm_methods sync works

The rm_methods format enables cloud sync by mimicking the exact file structure and metadata that official reMarkable methods templates use. Four format choices make this work:

1. **UUID filenames** — xochitl identifies content items by UUID. The three-file triplet (`<uuid>.template`, `.metadata`, `.content`) is how xochitl stores all user content (notebooks, PDFs, templates). Without UUID naming, xochitl ignores the files entirely.

2. **`source: "com.remarkable.methods"`** — the `source` field in `.metadata` tells xochitl which app owns the content. Official methods templates use this exact value. By matching it, custom templates are indistinguishable from official methods content to the sync engine. A different source value (e.g. a custom app identifier) would likely be ignored by sync or cause the content to be treated as a different type.

3. **No `supportedScreens`** — official rm_methods templates omit this field from the template body. Including it risks xochitl filtering the template out on devices whose screen isn't listed, which would break cross-device sync.

4. **`iconData` and `labels` in template body** — the template picker reads these directly from the `.template` file. Without `iconData`, the template appears with a blank thumbnail. Without `labels`, it's uncategorized in the picker.

> **Caveat:** This is reverse-engineered behavior based on examining official rm_methods template files on the device. reMarkable could change the format in firmware updates. The sync behavior with custom content using `"com.remarkable.methods"` as the source is undocumented — it works as of firmware 3.x but there are no guarantees.

---

## Alternative: Classic deploy (no sync)

The classic workflow pushes templates directly to `/usr/share/remarkable/templates/`. This is simpler but templates deployed this way **do not sync** across devices — they only exist on the device you push to.

**When to use it:** Single-device setups where you want system-level templates that persist across xochitl restarts without cloud involvement.

### Workflow

```bash
make pull         # fetch current templates from device
# edit templates in the web app
make deploy       # backup → merge → rsync --delete → restart xochitl
```

### What `make deploy` does

1. **Backup** (`make backup`) — SSHes in, remounts `/` read-write, creates a timestamped `.tar.gz` in `/home/root/template-backups/`, validates the archive with `tar -tzf`, then remounts read-only. If validation fails, make aborts here.
2. **Merge** (`make build-deploy`) — runs `scripts/merge-templates.mjs` to combine `remarkable_official_templates/`, `public/templates/debug/`, and `public/templates/custom/` into `dist-deploy/` with a merged `templates.json`.
3. **Remount rw** — SSHes in and runs `mount -o remount,rw /` (the root filesystem is read-only by default).
4. **rsync** — pushes `dist-deploy/` to `/usr/share/remarkable/templates/` with `--delete` (removes stale entries).
5. **Remount ro + restart** — SSHes back in, remounts read-only, and restarts `xochitl`.

### Rollback

```bash
make rollback         # restore most recent backup
make list-backups     # see available backups
```

To roll back to a specific backup:

```bash
ssh remarkable-wlan "mount -o remount,rw / && \
  tar xzf /home/root/template-backups/templates_<timestamp>.tar.gz -C /usr/share/remarkable && \
  mount -o remount,ro / && \
  systemctl restart xochitl"
```

---

## Manual reference

```bash
# Remount filesystem read-write
ssh remarkable-wlan "mount -o remount,rw /"

# Remount read-only
ssh remarkable-wlan "mount -o remount,ro /"

# Copy a single template file
scp dist-deploy/"P My Template" remarkable-wlan:/usr/share/remarkable/templates/

# Restart the UI
ssh remarkable-wlan "systemctl restart xochitl"
```

## Pulling rm_methods templates from the device

You can pull rm_methods templates (both official and custom) from the device to browse and fork them in the web UI:

```bash
make pull-rm-methods
```

This does the following:
1. SSHes into the device and scans for `TemplateType` metadata files in the xochitl directory
2. Pulls each `.template` + `.metadata` pair to a temp directory
3. Runs `server/lib/buildMethodsRegistry.ts` to build `public/templates/methods/methods-registry.json` and copy template files
4. Tags each template's origin: UUIDs found in `rm-methods-dist/.manifest` or `rm-methods-backups/.deployed-manifest` are tagged `custom-methods`; all others are `official-methods`

Pulled templates appear in the sidebar as read-only entries. Click **Save as New Template** to fork one into a custom template (applies `mapForegroundColors()` + `injectColorConstants()` for color invertibility).

The `origin` field helps distinguish templates in the UI:
- `official-methods` — shipped by reMarkable (e.g. "Engineering paper")
- `custom-methods` — your own templates previously deployed via `make deploy-rm-methods`

---

## Backing up and restoring templates

### Backup

Click **↓ Backup** on the **Device & Sync** page (or `GET /api/backup` programmatically) to download a ZIP containing all custom and debug templates plus their registries:

```
remarkable-backup-2026-03-17_143022.zip
├── backup-manifest.json
├── custom/
│   ├── custom-registry.json
│   └── *.template
└── debug/
    ├── debug-registry.json
    └── *.template
```

Methods templates are excluded — they're pulled from the device, not user-authored.

### Restore

Click **↑ Restore** on the **Device & Sync** page to upload a backup ZIP. The default mode is **merge**: templates already present (matched by `rmMethodsId` first, then `filename`) are skipped; new ones are added. The page reloads automatically if any templates were added.

For programmatic use: `POST /api/restore?mode=merge` (or `mode=replace` to overwrite).

---

## Caveats

- **Firmware updates wipe system templates.** After a firmware update, the device restores its default `/usr/share/remarkable/templates/` directory. For classic deploys, run `make pull` + `make deploy` again. rm_methods templates in the user content directory are unaffected.
- **A malformed `templates.json` breaks the classic template picker.** If the picker shows nothing after a classic deploy, `make rollback` to restore the last known-good state. This doesn't apply to rm_methods (no `templates.json` involved).
- **Always backup before manual pushes.** `make deploy` and `make deploy-rm-methods` do this automatically, but if you push files by hand, back up first.
- **`rsync --delete` in classic deploy removes device-side templates not in `dist-deploy/`.** This is intentional — it keeps the device in sync with your repo. If you want to keep device-only templates, `make pull` first so they're included in the merge.
- **rm_methods sync is reverse-engineered.** The format mimics official reMarkable methods templates. It works as of firmware 3.x but could break in future updates. See [How rm_methods sync works](#how-rm_methods-sync-works) for details.
- **The xochitl user content directory contains all user data.** The rm_methods deploy uses `rsync` without `--delete` to avoid touching notebooks, PDFs, or other content. Orphan cleanup is handled via manifest diffing instead.
