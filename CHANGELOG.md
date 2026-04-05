# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-04-05

### Added

- **Template browser and renderer** — SVG viewer for reMarkable `.template` files with multi-device support (RM1/RM2, Paper Pro, Paper Pro Move), expression evaluation engine, and tiled group rendering
- **Custom template editor** — JSON editor with Monaco integration, visual drawing editor with 7 tools (select, point, line, polygon, regular polygon, circle, bezier/Hobby spline), adaptive scaling mode, and resizable panels
- **Notebook builder** — multipage notebook composer with per-page template assignment, cPages v2 CRDT format generation, per-device `.rm` file strategy, built-in sample/debug notebooks, fork-on-edit, and bulk editing
- **Device sync** — multi-device SSH management with rm_methods deploy (cloud-synced templates), classic deploy, selective sync, rollback support, pull official/methods templates, and remove-all with backup
- **xovi extension management** — deploy/remove QMD extensions (custom screensavers, fonts, etc.) via the xovi framework, deploy state tracking, Vellum integration, firmware version mapping
- **Electron desktop app** — cross-platform packaging (macOS universal, Windows x64/arm64, Linux x64/arm64 AppImage/deb/rpm) with embedded Fastify server
- **E2E test suite** — Playwright tests covering template browsing, editing, notebook workflows, and device operations
- **10 editor themes** — GitHub Light, One Light, One Dark, Dracula, Gruvbox Light/Dark, Nord, Solarized Light/Dark, Tokyo Night
- **Backup and restore** — ZIP export/import of custom templates, notebook drafts, and registries with merge support
- **Docker deployment** — single-container setup with Fastify serving both API and frontend on port 3000
