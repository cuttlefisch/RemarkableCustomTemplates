# Template Format

reMarkable templates are JSON files that describe page layouts using a tree of groups, paths, and text items. Values throughout the tree can be numeric literals or arithmetic expression strings that reference named constants — the device evaluates these at render time.

## Example

A minimal template with a background fill and repeating horizontal lines:

```json
{
  "name": "My Template",
  "author": "Custom",
  "orientation": "portrait",
  "constants": [
    { "foreground": "#000000" },
    { "background": "#ffffff" },
    { "mobileMaxWidth": 1000 },
    { "offsetY": 100 }
  ],
  "items": [
    {
      "id": "bg",
      "type": "group",
      "boundingBox": { "x": 0, "y": 0, "width": "templateWidth", "height": "templateHeight" },
      "repeat": { "rows": "infinite", "columns": "infinite" },
      "children": [
        {
          "type": "path",
          "strokeColor": "background",
          "fillColor": "background",
          "antialiasing": false,
          "data": ["M", 0, 0, "L", "parentWidth", 0, "L", "parentWidth", "parentHeight", "L", 0, "parentHeight", "Z"]
        }
      ]
    },
    {
      "type": "group",
      "boundingBox": { "x": 0, "y": "offsetY", "width": "templateWidth", "height": 50 },
      "repeat": { "rows": "down" },
      "children": [
        {
          "type": "path",
          "data": ["M", 0, 0, "L", "templateWidth", 0],
          "strokeColor": "foreground",
          "strokeWidth": 1
        }
      ]
    }
  ]
}
```

## Root fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Display name in the template picker |
| `author` | string | Author attribution |
| `orientation` | `"portrait"` \| `"landscape"` | Page orientation |
| `constants` | `{key: value}[]` | Named constants, evaluated in order |
| `items` | `TemplateItem[]` | Tree of groups, paths, and text items |

## Item types

Templates use three item types, forming a tree via groups:

- **Group** — a bounding box with repeat rules and children. Groups tile their children across the page.
- **Path** — SVG-like drawing commands (`M`, `L`, `C`, `Z`, etc.) with stroke/fill properties.
- **Text** — positioned text with font size, alignment, and color.

## Constants and expressions

Constants are a `{key: value}[]` array evaluated in declaration order — later entries may reference earlier ones. Device builtins are injected before user constants:

- `templateWidth`, `templateHeight` — page dimensions in pixels
- `paperOriginX`, `paperOriginY` — coordinate offsets

Expressions support arithmetic (`+`, `-`, `*`, `/`), comparisons (`>`, `<`, `>=`, `<=`, `==`, `!=`), logical operators (`&&`, `||`), and ternary (`a > b ? x : y`). Evaluation uses `Function()` after identifier substitution.

## Device constants

| Device | Portrait W×H | Landscape W×H | `paperOriginX` (portrait) |
|--------|-------------|---------------|--------------------------|
| rm (RM 1 & 2) | 1404×1872 | 1872×1404 | −234 |
| rmPP (Paper Pro) | 1620×2160 | 2160×1620 | −270 |
| rmPPM (Paper Pro Move) | 954×1696 | 1696×954 | −371 |

`paperOriginX = templateWidth/2 − templateHeight/2`

Templates that need to adapt layout across devices can use either approach:
- **Ternary branching** — `"templateWidth > mobileMaxWidth ? bigValue : smallValue"` (common in official templates)
- **Scale factors** — `{ "scaleX": "templateWidth / 1404" }`, then `{ "margin": "scaleX * 60" }` etc. (proportional scaling, fits all devices without branching)

## Repeat values

Groups use `repeat` to tile their children across the page:

| Value | Behaviour |
|-------|-----------|
| `0` | Render once at tile origin (no repeat) |
| `N` | Render exactly N tiles |
| `"down"` | Fill downward from tile origin to viewport bottom |
| `"up"` | Fill upward from tile origin to viewport top |
| `"right"` | Fill rightward from tile origin to viewport right edge |
| `"infinite"` | Fill in both directions to cover the full viewport |
| `"expr"` | Any constant expression resolving to a number (e.g. `"columns"`) |

## Color constants and inversion

The `foreground` and `background` constants are sentinel values recognized by the editor:

| Constant | Default | Role |
|----------|---------|------|
| `foreground` | `#000000` | Default stroke color; referenced by path items to stay invertible |
| `background` | `#ffffff` | Canvas fill color; referenced by the `bg` item |

The **Invert** button swaps their values, letting you preview any color scheme. The `bg` item (full-page filled rectangle referencing `background`) renders the canvas background color on the device. Omit both if your template is always light-on-white with no color customization needed.

## Custom template conventions

When you create or fork a template in the web app, the editor automatically:

1. Replaces any path `strokeColor: "#000000"` with the `foreground` sentinel
2. Injects `strokeColor: "foreground"` on paths with no `strokeColor` defined (the device renders undefined stroke as black)
3. Replaces any path `fillColor: "#000000"` with `foreground` (paths with no `fillColor` are left alone — undefined fill = transparent)
4. Appends `foreground`/`background` constants if absent, and prepends the `bg` item if absent

The result is a fully invertible template: hitting **Invert** swaps `foreground` ↔ `background` throughout.

## Adding templates manually

The easiest way is through the web UI: click **New template** to create one from scratch, or select any template and click **Save as New Template** to fork it. The server handles file writes and registry updates automatically.

To add a template by hand (advanced):
1. Place the `.template` JSON file in `public/templates/custom/`
2. Add an entry to `public/templates/custom/custom-registry.json` with `"isCustom": true` and a `"custom/"` filename prefix
3. Restart the dev server to pick up the new file
