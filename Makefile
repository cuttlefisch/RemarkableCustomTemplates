SHELL := /bin/bash

DEVICE        := remarkable-wlan
TEMPLATES_PATH := /usr/share/remarkable/templates
BACKUP_DIR    := /home/root/template-backups
DIST_DIR      := dist-deploy
RM_METHODS_PATH := /home/root/.local/share/remarkable/xochitl
RM_METHODS_DIR  := rm-methods-dist
RM_METHODS_BACKUP_DIR := rm-methods-backups
RM_METHODS_ZIP        := remarkable-rm-methods.zip
DEV_SERVER_URL        := http://localhost:3001
RM_METHODS_DEPLOYED_MANIFEST := rm-methods-backups/.deployed-manifest
RM_METHODS_ORIGINAL_BACKUP   := rm-methods-backups/.original
METHODS_DIR := public/templates/methods

MANIFEST_UUIDS := npx tsx server/lib/manifestUuids.ts
BUILD_METHODS_REGISTRY := npx tsx server/lib/buildMethodsRegistry.ts

.PHONY: help setup configure install dev test lint build clean docker-up docker-down docker-logs docker-clean pull pull-rm-methods backup build-deploy deploy rollback list-backups build-rm-methods-dist deploy-rm-methods backup-rm-methods rollback-rm-methods rollback-rm-methods-original list-backups-rm-methods

help: ## Show this help message
	@awk 'BEGIN {FS = ":.*##"; printf "Usage: make \033[36m<target>\033[0m\n\nTargets:\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

# ── Dev setup ────────────────────────────────────────────────────────────────

setup: ## Install Node.js (via nvm) and pnpm, then install project dependencies
	@if command -v node >/dev/null 2>&1; then \
	  echo "Node.js $$(node -v) found"; \
	else \
	  echo "Node.js not found — installing via nvm..."; \
	  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash; \
	  export NVM_DIR="$$HOME/.nvm"; \
	  [ -s "$$NVM_DIR/nvm.sh" ] && . "$$NVM_DIR/nvm.sh"; \
	  nvm install 20; \
	fi
	@if command -v pnpm >/dev/null 2>&1; then \
	  echo "pnpm $$(pnpm -v) found"; \
	else \
	  echo "Installing pnpm..."; \
	  corepack enable && corepack prepare pnpm@latest --activate 2>/dev/null \
	    || npm install -g pnpm; \
	fi
	pnpm install
	@echo ""
	@echo "Setup complete. Run 'make dev' or 'pnpm dev' to start the dev server."
	@echo "Alternatively, run 'docker compose up --build -d' to start via Docker."

configure: setup ## Alias for setup (install toolchain + dependencies)

install: ## Install project dependencies (assumes Node.js and pnpm are present)
	pnpm install

dev: ## Start the Fastify API server + Vite dev server
	pnpm dev

test: ## Run all tests once
	pnpm test

lint: ## Run ESLint
	pnpm lint

build: ## Type-check and build for production
	pnpm build

clean: ## Remove build artifacts and caches
	rm -rf dist dist-server dist-deploy rm-methods-dist node_modules/.vite

# ── Docker ───────────────────────────────────────────────────────────────────

docker-up: ## Build and start the app via Docker Compose
	docker compose up --build -d

docker-down: ## Stop the Docker containers
	docker compose down

docker-logs: ## Follow Docker container logs
	docker compose logs -f

docker-clean: ## Stop containers and remove volumes
	docker compose down -v

# ── CLI device sync ──────────────────────────────────────────────────────────

pull: ## Pull templates from the device into remarkable_official_templates/
	rsync -avz --progress $(DEVICE):$(TEMPLATES_PATH)/ remarkable_official_templates/

pull-rm-methods: ## Pull rm_methods templates from the device into public/templates/methods/
	@tmpdir=$$(mktemp -d) && \
	echo "Scanning device for TemplateType metadata files..." && \
	metadata_files=$$(ssh $(DEVICE) "grep -rl '\"type\": *\"TemplateType\"' $(RM_METHODS_PATH)/*.metadata 2>/dev/null" || true) && \
	if [ -z "$$metadata_files" ]; then \
	  echo "No rm_methods templates found on device."; \
	  rm -rf "$$tmpdir"; \
	  exit 0; \
	fi && \
	echo "Found $$(echo "$$metadata_files" | wc -l) TemplateType files. Pulling..." && \
	for meta in $$metadata_files; do \
	  uuid=$$(basename "$$meta" .metadata); \
	  scp -q "$(DEVICE):$$meta" "$$tmpdir/$$uuid.metadata" 2>/dev/null; \
	  scp -q "$(DEVICE):$(RM_METHODS_PATH)/$$uuid.template" "$$tmpdir/$$uuid.template" 2>/dev/null || true; \
	done && \
	manifest_flag="" && \
	if [ -f $(RM_METHODS_DIR)/.manifest ]; then \
	  manifest_flag="--manifest $(RM_METHODS_DIR)/.manifest"; \
	fi && \
	deployed_flag="" && \
	if [ -f $(RM_METHODS_DEPLOYED_MANIFEST) ]; then \
	  deployed_flag="--deployed-manifest $(RM_METHODS_DEPLOYED_MANIFEST)"; \
	fi && \
	$(BUILD_METHODS_REGISTRY) "$$tmpdir" $(METHODS_DIR) $$manifest_flag $$deployed_flag && \
	rm -rf "$$tmpdir" && \
	echo "Methods templates ready in $(METHODS_DIR)/"

backup: ## Create a timestamped backup of device templates (validates archive before returning)
	ssh $(DEVICE) "mount -o remount,rw / && \
		mkdir -p $(BACKUP_DIR) && \
		timestamp=\$$(date +%Y%m%d_%H%M%S) && \
		tar czf $(BACKUP_DIR)/templates_\$${timestamp}.tar.gz -C /usr/share/remarkable templates && \
		tar -tzf $(BACKUP_DIR)/templates_\$${timestamp}.tar.gz > /dev/null && \
		echo \"Backup validated: $(BACKUP_DIR)/templates_\$${timestamp}.tar.gz\" && \
		mount -o remount,ro /"

build-deploy: ## Merge official + custom templates into dist-deploy/
	node scripts/merge-templates.mjs

deploy: backup build-deploy ## Backup, merge, and deploy templates to the device
	ssh $(DEVICE) "mount -o remount,rw /"
	rsync -avz --progress --delete $(DIST_DIR)/ $(DEVICE):$(TEMPLATES_PATH)/
	ssh $(DEVICE) "mount -o remount,ro / && systemctl restart xochitl"

rollback: ## Rollback to the most recent backup on the device
	ssh $(DEVICE) "latest=\$$(ls -t $(BACKUP_DIR)/templates_*.tar.gz 2>/dev/null | head -n 1); \
		if [ -z \"\$$latest\" ]; then echo 'No backups found.'; exit 1; fi; \
		echo \"Rolling back to \$$latest\"; \
		mount -o remount,rw / && \
		tar xzf \"\$$latest\" -C /usr/share/remarkable && \
		mount -o remount,ro / && \
		systemctl restart xochitl && \
		echo 'Rollback complete.'"

list-backups: ## List all backups on the device
	ssh $(DEVICE) "ls -lh $(BACKUP_DIR)/templates_*.tar.gz 2>/dev/null || echo 'No backups found.'"

build-rm-methods-dist: ## Export rm-methods ZIP from dev server and extract to rm-methods-dist/ (requires pnpm dev)
	@curl -sf -o $(RM_METHODS_ZIP) $(DEV_SERVER_URL)/api/export-rm-methods || \
	  { echo "Error: could not reach dev server at $(DEV_SERVER_URL). Run 'pnpm dev' first."; exit 1; }
	rm -rf $(RM_METHODS_DIR)
	unzip -q $(RM_METHODS_ZIP) -d $(RM_METHODS_DIR)
	@rm $(RM_METHODS_ZIP)
	@test -f $(RM_METHODS_DIR)/.manifest || { echo "Error: ZIP did not contain .manifest"; exit 1; }
	@echo "$(RM_METHODS_DIR)/ ready ($$($(MANIFEST_UUIDS) --count $(RM_METHODS_DIR)/.manifest) templates)."

backup-rm-methods: ## Back up current device state before deploying rm_methods templates
	@test -d $(RM_METHODS_DIR) || { echo "Error: $(RM_METHODS_DIR)/ not found. Run 'make build-rm-methods-dist'."; exit 1; }
	@test -f $(RM_METHODS_DIR)/.manifest || { echo "Error: No manifest. Run 'make build-rm-methods-dist'."; exit 1; }
	@mkdir -p $(RM_METHODS_BACKUP_DIR)
	@if ! test -d $(RM_METHODS_ORIGINAL_BACKUP); then \
	  echo "First deploy — capturing pristine device state to $(RM_METHODS_ORIGINAL_BACKUP)/"; \
	  mkdir -p $(RM_METHODS_ORIGINAL_BACKUP) && \
	  echo '{"exportedAt":"0","templates":{}}' > $(RM_METHODS_ORIGINAL_BACKUP)/.manifest; \
	  echo "Original backup saved."; \
	fi
	@if [ -f $(RM_METHODS_DEPLOYED_MANIFEST) ]; then \
	  ts=$$(date +%Y%m%d_%H%M%S); \
	  dir=$(RM_METHODS_BACKUP_DIR)/rm-methods_$${ts}; \
	  echo "Backing up current deploy to $$dir/"; \
	  filelist=$$($(MANIFEST_UUIDS) $(RM_METHODS_DEPLOYED_MANIFEST) | awk '{printf "%s.template\n%s.metadata\n%s.content\n", $$1, $$1, $$1}'); \
	  mkdir -p $$dir && \
	  echo "$$filelist" | rsync -avz --ignore-missing-args --files-from=- $(DEVICE):$(RM_METHODS_PATH)/ $$dir/ && \
	  cp $(RM_METHODS_DEPLOYED_MANIFEST) $$dir/.manifest && \
	  echo "Backup complete: $$dir/"; \
	fi

# No remount needed — the xochitl user directory is already writable.
deploy-rm-methods: build-rm-methods-dist backup-rm-methods ## Build, back up, then deploy rm_methods templates to xochitl
	@test -d $(RM_METHODS_DIR) || { echo "Error: $(RM_METHODS_DIR)/ not found."; exit 1; }
	@test -f $(RM_METHODS_DIR)/.manifest || { echo "Error: No manifest. Run 'make build-rm-methods-dist'."; exit 1; }
	@# Remove templates that were in the previous deploy but not in this one
	@if [ -f $(RM_METHODS_DEPLOYED_MANIFEST) ]; then \
	  removed=$$($(MANIFEST_UUIDS) --diff $(RM_METHODS_DEPLOYED_MANIFEST) $(RM_METHODS_DIR)/.manifest); \
	  if [ -n "$$removed" ]; then \
	    echo "Removing $$(echo "$$removed" | wc -l) orphaned templates from device:"; \
	    for uuid in $$removed; do \
	      echo "  $$uuid"; \
	      ssh $(DEVICE) "rm -f $(RM_METHODS_PATH)/$$uuid.template $(RM_METHODS_PATH)/$$uuid.metadata $(RM_METHODS_PATH)/$$uuid.content"; \
	    done; \
	  fi; \
	fi
	rsync -avz --progress --exclude='.manifest' $(RM_METHODS_DIR)/ $(DEVICE):$(RM_METHODS_PATH)/
	@cp $(RM_METHODS_DIR)/.manifest $(RM_METHODS_DEPLOYED_MANIFEST)
	ssh $(DEVICE) "systemctl restart xochitl"

rollback-rm-methods: ## Revert to the most recent timestamped rm_methods backup
	@latest=$$(ls -dt $(RM_METHODS_BACKUP_DIR)/rm-methods_*/ 2>/dev/null | head -n 1); \
	if [ -z "$$latest" ]; then echo "No timestamped backups found. Use 'make rollback-rm-methods-original' to revert to pristine state."; exit 1; fi; \
	if ! test -f "$$latest/.manifest"; then echo "Error: backup $$latest has no manifest."; exit 1; fi; \
	echo "Rolling back to $$latest"; \
	removed=$$($(MANIFEST_UUIDS) --diff $(RM_METHODS_DEPLOYED_MANIFEST) "$$latest/.manifest" 2>/dev/null || true); \
	if [ -n "$$removed" ]; then \
	  echo "Removing $$(echo "$$removed" | wc -w) templates added since backup:"; \
	  for uuid in $$removed; do \
	    echo "  $$uuid"; \
	    ssh $(DEVICE) "rm -f $(RM_METHODS_PATH)/$$uuid.template $(RM_METHODS_PATH)/$$uuid.metadata $(RM_METHODS_PATH)/$$uuid.content"; \
	  done; \
	fi; \
	rsync -avz --progress "$$latest/" --exclude='.manifest' $(DEVICE):$(RM_METHODS_PATH)/ && \
	cp "$$latest/.manifest" $(RM_METHODS_DEPLOYED_MANIFEST) && \
	ssh $(DEVICE) "systemctl restart xochitl" && \
	echo "Rollback complete."

rollback-rm-methods-original: ## Revert to pristine device state (remove all custom templates)
	@if ! test -d $(RM_METHODS_ORIGINAL_BACKUP); then echo "No original backup found. Deploy at least once first."; exit 1; fi; \
	echo "Rolling back to original pristine state..."; \
	current=$$($(MANIFEST_UUIDS) $(RM_METHODS_DEPLOYED_MANIFEST) 2>/dev/null || true); \
	if [ -n "$$current" ]; then \
	  echo "Removing all $$(echo "$$current" | wc -w) deployed templates:"; \
	  for uuid in $$current; do \
	    echo "  $$uuid"; \
	    ssh $(DEVICE) "rm -f $(RM_METHODS_PATH)/$$uuid.template $(RM_METHODS_PATH)/$$uuid.metadata $(RM_METHODS_PATH)/$$uuid.content"; \
	  done; \
	fi; \
	cp $(RM_METHODS_ORIGINAL_BACKUP)/.manifest $(RM_METHODS_DEPLOYED_MANIFEST) && \
	ssh $(DEVICE) "systemctl restart xochitl" && \
	echo "Rollback to original state complete. All custom templates removed."

list-backups-rm-methods: ## List local rm_methods backups
	@ls -lhd $(RM_METHODS_BACKUP_DIR)/rm-methods_*/ 2>/dev/null || echo "No backups found in $(RM_METHODS_BACKUP_DIR)/"
