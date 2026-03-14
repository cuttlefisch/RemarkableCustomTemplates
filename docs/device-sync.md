# Device Sync

This doc covers SSH setup and the workflow for pulling templates from your reMarkable and pushing custom ones back.

## Prerequisites

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

### Enable SSH over WLAN

On the device, run from a terminal (or via existing SSH):

```bash
rm-ssh-over-wlan on
```

> **Developer mode note:** Paper Pro and Move require developer mode to be enabled before SSH access works. Enabling developer mode triggers a factory reset — do this before you put any notes on the device.

### Finding credentials

Go to **Settings → Help → Copyrights and Licenses → GPLv3 Compliance**. The root password and current IP are shown there.

> **Warning:** The SSH password resets on every firmware update. After an update, re-run `ssh-copy-id` with the new password to restore key-based auth.

## Workflow (happy path)

```bash
make pull         # 1. Fetch current templates from device
# Edit templates in the web app (pnpm dev)
make deploy       # 2. Backup, merge, and push to device
```

That's it. The device restarts `xochitl` (the UI) automatically, so new templates appear in the picker within a few seconds.

## What `make deploy` does

1. **Backup** (`make backup`) — SSHes in, remounts `/` read-write, creates a timestamped `.tar.gz` in `/home/root/template-backups/`, validates the archive with `tar -tzf`, then remounts read-only. If validation fails, make aborts here.
2. **Merge** (`make build-deploy`) — runs `scripts/merge-templates.mjs` to combine `remarkable_official_templates/`, `public/templates/debug/`, and `public/templates/custom/` into `dist-deploy/` with a merged `templates.json`.
3. **Remount rw** — SSHes in and runs `mount -o remount,rw /` (the root filesystem is read-only by default).
4. **rsync** — pushes `dist-deploy/` to `/usr/share/remarkable/templates/` with `--delete` (removes stale entries).
5. **Remount ro + restart** — SSHes back in, remounts read-only, and restarts `xochitl`.

## Rollback

### Roll back to the latest backup

```bash
make rollback
```

### See available backups

```bash
make list-backups
```

### Roll back to a specific backup

```bash
ssh remarkable-wlan "mount -o remount,rw / && \
  tar xzf /home/root/template-backups/templates_<timestamp>.tar.gz -C /usr/share/remarkable && \
  mount -o remount,ro / && \
  systemctl restart xochitl"
```

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

## Caveats

- **Firmware updates wipe templates.** After a firmware update, the device restores its own default `templates/` directory. Run `make pull` + `make deploy` again to re-apply your customizations.
- **A malformed `templates.json` breaks the template picker.** If the picker shows nothing after a deploy, `make rollback` to restore the last known-good state.
- **Always backup before manual pushes.** `make deploy` does this automatically, but if you push files by hand, run `make backup` first.
- **`rsync --delete` removes device-side templates not in `dist-deploy/`.** This is intentional — it keeps the device in sync with your repo. If you want to keep device-only templates, `make pull` first so they're included in the merge.
