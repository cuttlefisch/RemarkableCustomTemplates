# reMarkable Device Filesystem Analysis

When the user invokes `/device-analysis`, follow this playbook to analyze a reMarkable device's filesystem via SSH. Ask the user which device to target if not specified. Run commands over SSH and report findings clearly.

## SSH Access

Connect to devices using SSH host aliases configured in `~/.ssh/config`. See `docs/device-sync.md` for setup instructions.

| Alias | Connection | Notes |
|-------|-----------|-------|
| `remarkable` | USB (10.11.99.1) | Standard reMarkable USB IP, most reliable |
| `<device-wifi-ip>` | WiFi | Configure in `~/.ssh/config` per device |

SSH example: `ssh remarkable 'cat /etc/version'`

## Key Device Paths

- `/home/root/.local/share/remarkable/xochitl/` — notebooks, templates, documents (the main data directory)
- `/usr/share/remarkable/templates/` — official classic templates (factory-installed)
- `/sys/devices/soc0/machine` — device model name
- `/etc/version` — firmware version

## Step 1: Device Identification

Always start by identifying the device:

```bash
ssh <host> 'cat /sys/devices/soc0/machine; echo "---"; cat /etc/version'
```

Device codenames from `/sys/devices/soc0/machine`:
- `reMarkable 1.0` — RM1
- `reMarkable 2.0` — RM2
- `reMarkable ferrari` — PP (Paper Pro)
- `reMarkable Chiappa` — PPM (Paper Pro Move)

## Step 2: Sync Files Locally for Analysis

**BusyBox on the device has very limited commands.** Grep is slow and many standard flags are missing. Always prefer rsyncing the xochitl directory to a local temp directory first:

```bash
DEVICE=remarkable
LOCALDIR=$(mktemp -d /tmp/rm-analysis-XXXX)
rsync -avz --progress root@${DEVICE}:/home/root/.local/share/remarkable/xochitl/ "$LOCALDIR/"
echo "Synced to: $LOCALDIR"
```

This makes all subsequent analysis fast and avoids hammering the device.

## Step 3: Notebook Analysis

### List all notebooks (DocumentType)

```bash
grep -rl '"type": "DocumentType"' "$LOCALDIR"/*.metadata | while read f; do
  uuid=$(basename "$f" .metadata)
  name=$(grep '"visibleName"' "$f" | head -1 | sed 's/.*: "//;s/".*//')
  echo "$uuid  $name"
done
```

### Inspect a notebook's .content file

```bash
UUID=<target-uuid>
cat "$LOCALDIR/$UUID.content" | python3 -m json.tool
```

Key fields: `cPages.pages` (page objects with UUIDs), `cPages.uuids` (replica IDs), `pageCount`, `customZoomPageWidth`/`customZoomPageHeight` (should always be 1404x1872).

### Check .rm files (stroke data)

```bash
UUID=<target-uuid>
ls -la "$LOCALDIR/$UUID/"*.rm 2>/dev/null
```

**Pristine page detection by .rm file size:**
- **408 bytes** — empty/pristine page on RM1/RM2
- **423 bytes** — empty/pristine page on PPM

```bash
# Find edited (non-pristine) pages
find "$LOCALDIR/$UUID" -name '*.rm' -size +423c
```

## Step 4: Template Analysis

### List methods templates (TemplateType)

```bash
grep -rl '"type": "TemplateType"' "$LOCALDIR"/*.metadata | while read f; do
  uuid=$(basename "$f" .metadata)
  name=$(grep '"visibleName"' "$f" | head -1 | sed 's/.*: "//;s/".*//')
  echo "$uuid  $name"
done
```

### Check the deployed manifest

```bash
cat "$LOCALDIR/.remarkable-templates-deployed" 2>/dev/null | python3 -m json.tool
```

### Inspect .template JSON files

```bash
UUID=<target-uuid>
cat "$LOCALDIR/$UUID.template" | python3 -m json.tool | head -50
```

## Step 5: Diagnostic Patterns

### Missing .rm files
- **RM1/RM2:** Device creates its own native 408-byte .rm file on first page access. Pages render correctly.
- **PPM:** Pages render with broken zoom/dimensions if .rm files are missing. Must deploy 423-byte PPM stubs.
- **PP (Paper Pro):** **UNTESTED.** Assumed like RM1 — needs community validation.

### Wrong dimensions / broken rendering
- Check if .rm files from wrong device type were deployed (PPM .rm on RM1 = broken rendering)
- Check `.content` for correct `customZoomPageWidth=1404, customZoomPageHeight=1872`

### Sync / cloud replication issues
- Check `cPages.uuids` for replica IDs used in cloud sync
- Look for the `"modifed"` (sic — firmware typo) timestamp field on device-created pages

### Template not appearing
- Verify UUID in `.remarkable-templates-deployed` manifest
- Check `.metadata`, `.content`, `.template` files all exist
- Confirm `"type": "TemplateType"` in `.metadata`

## Notes

- Always rsync locally before heavy analysis — device CPU and storage are limited
- BusyBox `head -N` doesn't work; use `head -n N` instead
- USB connection (`remarkable` / 10.11.99.1) is the most reliable fallback
- .rm binary files contain locale-dependent layer names ("Layer 1" in English, "Capa 1" in Spanish)
