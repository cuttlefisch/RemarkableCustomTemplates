# Quickstart

This guide walks through the full workflow from a fresh clone to deploying custom templates on your reMarkable device and rolling back if needed.

## Prerequisites

- Node.js 20+ and [pnpm](https://pnpm.io/installation)
- A reMarkable device on the same network as your machine
- Git

---

## 1. Clone and install

```bash
git clone <repo-url>
cd remarkable_templates
pnpm install
```

## 2. Run the web app

```bash
pnpm dev
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

## 5. Add custom templates in the web app

In the browser:

1. Click **New template** in the sidebar to create a blank template, or select an existing one and click **Fork** to start from a copy.
2. Edit the JSON in the Monaco editor. The canvas updates live as you apply changes.
3. Toggle between **reMarkable 1/2** and **Paper Pro** previews using the device selector.
4. Click **Apply** to validate and render. Any undefined constant references are reported before the canvas renders.

Custom templates are saved to `public/templates/custom/` and registered in `public/templates/custom/custom-registry.json`. These files are git-ignored by default — add them to version control if you want to track your templates.

---

## 6. Deploy to the device

```bash
make deploy
```

This runs four steps in order:

1. **Backup** — remounts `/` read-write on the device, creates a timestamped `.tar.gz` in `/home/root/template-backups/`, validates the archive, then remounts read-only. Aborts if validation fails.
2. **Merge** — runs `scripts/merge-templates.mjs` to combine `remarkable_official_templates/` and `public/templates/custom/` into `dist-deploy/` with a unified `templates.json`.
3. **rsync** — remounts rw, pushes `dist-deploy/` to `/usr/share/remarkable/templates/` with `--delete`, remounts ro.
4. **Restart** — restarts `xochitl` (the device UI). New templates appear in the picker within a few seconds.

---

## 7. Rollback

If something goes wrong (blank picker, malformed template, etc.):

```bash
make rollback
```

This SSHes into the device, finds the most recent backup in `/home/root/template-backups/`, extracts it back to `/usr/share/remarkable/templates/`, and restarts `xochitl`.

To see all available backups:

```bash
make list-backups
```

To roll back to a specific snapshot:

```bash
ssh remarkable-wlan "mount -o remount,rw / && \
  tar xzf /home/root/template-backups/templates_<timestamp>.tar.gz -C /usr/share/remarkable && \
  mount -o remount,ro / && \
  systemctl restart xochitl"
```

> **Note:** Firmware updates wipe the device's template directory and may also clear `/home/root/`. After an update, run `make pull` to refresh your local copy of the new official templates, then `make deploy` to re-apply your custom ones.

---

## Summary

```bash
git clone <repo-url> && cd remarkable_templates
pnpm install
pnpm dev                  # open http://localhost:5173
make pull                 # pull official templates from device
# create/edit templates in the web app
make deploy               # backup → merge → rsync → restart
make rollback             # revert device to last backup if needed
```

For full SSH setup details and caveats, see [device-sync.md](device-sync.md).
