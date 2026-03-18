# Quickstart

This guide walks through the full workflow from a fresh clone to deploying custom templates on your reMarkable device and rolling back if needed.

## Prerequisites

- A reMarkable device on the same network as your machine
- Git
- **Option A (Docker):** [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- **Option B (Native):** Node.js 20+ and [pnpm](https://pnpm.io/installation) — `make setup` installs both if missing

---

## Option A: Docker (simplest)

```bash
git clone https://github.com/cuttlefisch/RemarkableCustomTemplates
cd remarkable_templates
docker compose up --build -d
```

Open `http://localhost:3000` in your browser. Navigate to the **Device & Sync** page (`/device`) — the setup wizard handles SSH key generation, connection testing, and device configuration in-browser.

Stop with `docker compose down`.

Skip to [Step 5: Pull rm_methods templates](#5-pull-rm_methods-templates-optional) (use the Device & Sync page instead of CLI commands).

---

## Option B: Native development

### 1. Clone and install

```bash
git clone https://github.com/cuttlefisch/RemarkableCustomTemplates
cd remarkable_templates
make setup    # installs Node.js (via nvm) + pnpm + project dependencies
```

If you already have Node.js and pnpm, `make install` (or `pnpm install`) is enough.

### 2. Run the web app

```bash
make dev      # or: pnpm dev
```

Open `http://localhost:5173` in your browser. The template browser loads on the left; the SVG canvas preview is on the right.

### 3. Set up device SSH access

Navigate to the **Device & Sync** page (`/device`). The setup wizard handles SSH key generation, connection testing, and device configuration.

> **CLI alternative:** For manual SSH setup, see [device-sync.md](device-sync.md).

### 4. Pull official templates from the device

Use the **Device & Sync** page to pull official templates, or via CLI:

```bash
make pull
```

This rsyncs the device's `/usr/share/remarkable/templates/` into `remarkable_official_templates/` locally. These files are git-ignored (originals only — do not edit them).

---

## 5. Pull rm_methods templates (optional)

Use the **Device & Sync** page, or via CLI:

```bash
make pull-rm-methods
```

This pulls official and custom rm_methods templates from the device into `public/templates/methods/`. They appear as read-only entries in the sidebar — select one and click **Save as New Template** to fork it into a custom template.

---

## 6. Add custom templates in the web app

In the browser:

1. Click **New template** in the sidebar to create a blank template, or select an existing one and click **Save as New Template** to start from a copy.
2. Edit the JSON in the Monaco editor. The canvas updates live as you apply changes.
3. Toggle between **RM 1 & 2**, **Paper Pro**, and **Move** previews using the device selector.
4. Click **Apply** to validate and render. Any undefined constant references are reported before the canvas renders.

Custom templates are saved to `public/templates/custom/` and registered in `public/templates/custom/custom-registry.json`. These files are git-ignored by default — add them to version control if you want to track your templates.

---

## 7. Deploy to the device (rm_methods — recommended)

The rm_methods workflow deploys templates in a format that **syncs across paired devices** via the reMarkable cloud.

Use the **Device & Sync** page for browser-based deploy, or via CLI:

```bash
pnpm dev                        # dev server must be running
make build-rm-methods-dist      # export ZIP → rm-methods-dist/
make deploy-rm-methods          # back up, deploy, restart xochitl
```

On first deploy, a pristine baseline is captured automatically. Each subsequent deploy creates a timestamped backup of the previous state and cleans up any templates you've removed from the registry.

---

## 8. Back up your templates

Click **↓ Backup** on the **Device & Sync** page to download a ZIP of all your custom and debug templates. This preserves `rmMethodsId` UUIDs — critical for device sync continuity.

To restore: click **↑ Restore** on the same page and select the backup ZIP. Templates already present are skipped; new ones are merged in.

---

## 9. Rollback

If something goes wrong (blank picker, malformed template, etc.):

Use the **Device & Sync** page, or via CLI:

```bash
make rollback-rm-methods            # revert to previous deploy
make rollback-rm-methods-original   # remove all custom templates (pristine state)
```

To see all available backups:

```bash
make list-backups-rm-methods
```

---

## 10. Alternative: Classic deploy (no sync)

The classic workflow pushes templates directly to `/usr/share/remarkable/templates/`. Templates deployed this way only exist on the device you push to — they do not sync.

```bash
make deploy       # backup → merge → rsync --delete → restart xochitl
make rollback     # revert device to last backup if needed
make list-backups # see available backups
```

See [device-sync.md](device-sync.md) for full details on both workflows.

---

## Summary

**Shortest path (Docker):**
```bash
git clone https://github.com/cuttlefisch/RemarkableCustomTemplates && cd remarkable_templates
docker compose up --build -d      # open http://localhost:3000
# use Device & Sync page for SSH setup, pull, deploy, and rollback
```

**Native development:**
```bash
git clone https://github.com/cuttlefisch/RemarkableCustomTemplates && cd remarkable_templates
make setup                        # install toolchain + dependencies
make dev                          # open http://localhost:5173
# use Device & Sync page or CLI make targets for device operations
```

For full SSH setup details and caveats, see [device-sync.md](device-sync.md).
