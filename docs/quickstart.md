# Quickstart

This guide walks through the full workflow from a fresh clone to deploying custom templates on your reMarkable device and rolling back if needed.

## Prerequisites

- A reMarkable device on the same network as your machine
- Git
- (Optional) Node.js 20+ and [pnpm](https://pnpm.io/installation) — `make setup` installs both if missing

---

## 1. Clone and install

```bash
git clone https://github.com/cuttlefisch/RemarkableCustomTemplates
cd remarkable_templates
make setup    # installs Node.js (via nvm) + pnpm + project dependencies
```

If you already have Node.js and pnpm, `make install` (or `pnpm install`) is enough.

## 2. Run the web app

```bash
make dev      # or: pnpm dev
```

Open `http://localhost:5173` in your browser. The template browser loads on the left; the SVG canvas preview is on the right.

---

## 3. Set up device SSH access

You need passwordless SSH to the device before any `make` targets will work. Do this once.

### 3a. Enable SSH over WLAN on the device

From a terminal on the device (or via USB SSH):

```bash
rm-ssh-over-wlan on
```

> **Paper Pro / Move users:** Developer mode must be enabled first. Enabling it triggers a factory reset — do this before putting notes on the device.

### 3b. Find your credentials

Go to **Settings → Help → Copyrights and Licenses → GPLv3 Compliance**. The root password and current device IP are shown there.

### 3c. Generate an SSH key and copy it to the device

```bash
ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_rsa_remarkable
ssh-copy-id -i ~/.ssh/id_rsa_remarkable.pub root@<device-ip>
```

### 3d. Add a `~/.ssh/config` block

```
Host remarkable-wlan
    HostName <device-ip>
    User root
    IdentityFile ~/.ssh/id_rsa_remarkable
    ServerAliveInterval 30
```

Replace `<device-ip>` with your device's current IP. After this, all `make` targets use `remarkable-wlan` as the host.

### 3e. Test the connection

```bash
ssh remarkable-wlan "echo connected"
```

> **After firmware updates:** The device SSH password resets. Re-run `ssh-copy-id` with the new password to restore key-based auth.

---

## 4. Pull official templates from the device

```bash
make pull
```

This rsyncs the device's `/usr/share/remarkable/templates/` into `remarkable_official_templates/` locally. These files are git-ignored (originals only — do not edit them).

---

## 5. Pull rm_methods templates (optional)

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

```bash
pnpm dev                        # dev server must be running
make build-rm-methods-dist      # export ZIP → rm-methods-dist/
make deploy-rm-methods          # back up, deploy, restart xochitl
```

On first deploy, a pristine baseline is captured automatically. Each subsequent deploy creates a timestamped backup of the previous state and cleans up any templates you've removed from the registry.

---

## 8. Back up your templates

Click **↓ Backup** in the sidebar to download a ZIP of all your custom and debug templates. This preserves `rmMethodsId` UUIDs — critical for device sync continuity.

To restore: click **↑ Restore** and select the backup ZIP. Templates already present are skipped; new ones are merged in.

---

## 9. Rollback

If something goes wrong (blank picker, malformed template, etc.):

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

```bash
git clone https://github.com/cuttlefisch/RemarkableCustomTemplates && cd remarkable_templates
make setup                        # install toolchain + dependencies
make dev                          # open http://localhost:5173
make pull                         # pull official templates from device
make pull-rm-methods              # pull rm_methods templates to browse/fork
# create/edit templates in the web app
# click ↓ Backup in the sidebar to save a backup ZIP
make build-rm-methods-dist        # export for cloud-sync deploy
make deploy-rm-methods            # backup → deploy → restart
make rollback-rm-methods          # revert to previous deploy if needed
```

For full SSH setup details and caveats, see [device-sync.md](device-sync.md).
