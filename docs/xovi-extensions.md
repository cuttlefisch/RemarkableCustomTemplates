# xovi Extensions

Enhance your reMarkable experience with curated xovi extensions, deployed directly from the **Device & Sync** page.

## What are xovi extensions?

[xovi](https://github.com/asivery/xovi) is a community framework that lets you tweak the reMarkable UI without permanently modifying system files. It works by intercepting the Qt resource system at startup and applying small patch files (`.qmd`) that modify UI behavior.

This app deploys a curated set of extensions that enhance the template experience — unlocking Methods templates without a subscription, normalizing page dimensions across devices, and improving quicksheet behavior.

> If the [Vellum package manager](https://remarkable.guide/guide/software/vellum.html) is installed on your device, you can install xovi directly from this app. Otherwise, install Vellum first, then use the Install button.

## Prerequisites

1. **[Vellum](https://remarkable.guide/guide/software/vellum.html)** installed on your device (see the install guide for bootstrap instructions)
2. **xovi** — install it one of two ways:
   - **From this app:** Click **Check xovi Status**, then click **Install xovi** (requires Vellum on the device)
   - **Via SSH:** `vellum add qt-resource-rebuilder` (pulls in xovi + xovi-extensions as dependencies)
3. A configured device connection in this app (see [quickstart](quickstart.md))

## Important: warranty & risks

- Modifying your device's software behavior **may void your warranty**
- Extensions are community-maintained and **not endorsed by reMarkable**
- All changes are **fully reversible** — remove the extensions and restart to restore stock behavior
- You accept responsibility for modifications to your device
- Extensions may need to be re-deployed after firmware updates

## Available extensions

### Unlock Methods Content (Essential)

Bypasses the subscription check for using on-device Methods templates and documents. Without this extension, Methods templates (including any custom templates you deploy via rm_methods format) require an active Connect subscription.

- **Works on:** reMarkable 1, reMarkable 2, Paper Pro, Paper Pro Move
- **Why you need it:** If you deploy custom templates via this app and don't have a Connect subscription, this extension ensures you can actually use them

### Page Size Normalization (Essential — pick one)

The three reMarkable device families have different screen dimensions:

| Device | Resolution |
|--------|-----------|
| reMarkable 1 & 2 | 1404 x 1872 |
| Paper Pro | 1620 x 2160 |
| Paper Pro Move | 954 x 1696 |

When you create a new page on one device, it's stamped with that device's dimensions. If you sync that page to a different device, it may appear zoomed in, zoomed out, or cropped.

These extensions force new pages to use a consistent size regardless of which device you're on:

| Your primary device | Install this | Why |
|---|---|---|
| reMarkable 1/2 | **Paper Pro Size** | Pages you create will render correctly on Paper Pro |
| Paper Pro | **RM2 Size** | Pages you create will render correctly on RM1/RM2 |
| Paper Pro Move | **Paper Pro Size** | Pages you create will render correctly on Paper Pro (most common sync target) |

**Important:** These extensions only affect **new pages** you create after installation. They do not retroactively change existing pages or synced content. You can only install one of the two — they are mutually exclusive.

### Prevent Notebook Zoom Out (Essential for Move)

Forces all notebook pages to start at 1x zoom, preventing the default zoom-out behavior. This is especially important on the Paper Pro Move, where pages created on larger devices would otherwise display zoomed out.

- **Best paired with** a page size extension for full cross-device consistency
- **Works on:** All devices, but designed primarily for Paper Pro Move

### Quicksheet Use Template (Recommended)

When you add a quicksheet page (quick-add at the bottom of a notebook), it normally uses the default blank template. This extension makes quicksheet pages inherit the template from the previous page — so if you're writing on a dot grid, your new page will also be a dot grid.

## How to deploy

1. Navigate to the **Device & Sync** page
2. Scroll to the **xovi Extensions** card
3. Click **Check xovi Status** to verify xovi is detected on your device
4. Select the extensions you want:
   - Check/uncheck individual extensions
   - Choose a page size option (RM2 Size, Paper Pro Size, or None)
5. Click **Deploy Selected**
6. Wait for the progress indicator to complete — the device UI will restart automatically

## How to remove

1. On the **xovi Extensions** card, click **Check xovi Status**
2. To remove a single extension, click the **x** button next to it
3. To remove all extensions deployed by this app, click **Remove Our Extensions** — user-installed extensions are preserved
4. Confirm the removal
5. The device UI restarts with stock behavior restored

If the app has no tracking data (e.g. extensions were deployed before tracking was added), a **Remove All Installed** fallback button appears instead, which removes all known installed extensions.

## After a firmware update

When your reMarkable receives a firmware update:

1. Extensions may stop working because the UI code they patch has changed
2. Open the app and click **Check xovi Status** to see the current state
3. If the new firmware version is supported, click **Deploy Selected** to re-deploy
4. If the new firmware version is not yet supported, you'll see a message — new versions are typically supported within a few days by the community

## Deploy state tracking

When extensions are first deployed to a device, the app captures a "pristine snapshot" of any QMD files already present in the extension directory. This enables distinguishing between:

- **Our extensions** — deployed by this app, tracked in `.xovi-deployed`
- **User-installed extensions** — present before our first deploy or installed manually, shown as "User-installed" in the UI (display only, never auto-removed)

The tracking file (`.xovi-deployed`) is stored per-device at `rm-methods-backups/{deviceId}/` and contains `pristineFiles`, `deployedExtensionIds`, and timestamps. It is only written after a fully successful deploy (files pushed + hashtable rebuilt). If a deploy fails partway, no tracking is recorded.

The "Remove Our Extensions" button only removes extensions tracked as deployed by this app. Uninstalling xovi via Vellum clears the tracking file entirely.

## Troubleshooting

### "xovi not installed"

xovi and qt-resource-rebuilder must be installed on your device before this app can deploy extensions. If Vellum is on your device, click **Install xovi** in the app. Otherwise, install via SSH:

```bash
# On your device (via SSH):
vellum add qt-resource-rebuilder
```

### "Vellum needs to be re-enabled"

After a firmware update, Vellum needs to re-apply its system modifications. The app will show a warning when this is detected. SSH into your device and run:

```bash
vellum reenable
```

Then check xovi status again in the app. Until reenable completes, package install/remove operations will fail.

### "Extensions not available for firmware X.XX"

Extension patch files are specific to each firmware version. If you've updated to a very new firmware version, the community may not have released compatible patches yet. Check the [xovi-qmd-extensions repository](https://github.com/rmitchellscott/xovi-qmd-extensions) for updates.

### "rebuild_hashtable failed"

Try restarting xochitl manually via SSH:

```bash
ssh root@<device-ip> "systemctl restart xochitl"
```

If the problem persists, try running the rebuild manually:

```bash
ssh root@<device-ip> "cd /home/root && ./xovi/rebuild_hashtable"
```

### Extensions deployed but no visible effect

- Ensure xovi is running: `ssh root@<device-ip> "test -f /home/root/xovi/xovi.so && echo ok"`
- Clear the QML cache and restart: `ssh root@<device-ip> "rm -rf ~/.cache/remarkable/xochitl/qmlcache && systemctl restart xochitl"`

## Technical details

### How it works

Extensions are `.qmd` (QML Diff) files — declarative patches that modify specific properties in the reMarkable UI at startup. The xovi framework's `qt-resource-rebuilder` component intercepts Qt's resource loading and applies these patches before the UI renders.

### Device paths

- Extension files: `/home/root/xovi/exthome/qt-resource-rebuilder/`
- After deploying extensions, the app runs `/home/root/xovi/rebuild_hashtable` and restarts xochitl

### Source and integrity

Extension files are sourced from the [xovi-qmd-extensions](https://github.com/rmitchellscott/xovi-qmd-extensions) repository by Mitchell Scott, licensed under MIT. SHA-512 checksums are verified at build time to ensure file integrity.

### Manual deployment (via SSH)

If you prefer to deploy extensions manually:

```bash
# Copy the QMD file to the device
scp unlockMethodsContent.qmd root@<device-ip>:/home/root/xovi/exthome/qt-resource-rebuilder/

# Rebuild the hashtable and restart
ssh root@<device-ip> "cd /home/root && ./xovi/rebuild_hashtable && systemctl restart xochitl"
```
