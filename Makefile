DEVICE        := remarkable-wlan
TEMPLATES_PATH := /usr/share/remarkable/templates
BACKUP_DIR    := /home/root/template-backups
DIST_DIR      := dist-deploy
RM_METHODS_PATH := /home/root/.local/share/remarkable/xochitl
RM_METHODS_DIR  := rm-methods-dist
RM_METHODS_BACKUP_DIR := rm-methods-backups
RM_METHODS_ZIP        := remarkable-rm-methods.zip
DEV_SERVER_URL        := http://localhost:5173

.PHONY: help pull backup build-deploy deploy rollback list-backups build-rm-methods-dist deploy-rm-methods backup-rm-methods rollback-rm-methods list-backups-rm-methods

help: ## Show this help message
	@awk 'BEGIN {FS = ":.*##"; printf "Usage: make \033[36m<target>\033[0m\n\nTargets:\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

pull: ## Pull templates from the device into remarkable_official_templates/
	rsync -avz --progress $(DEVICE):$(TEMPLATES_PATH)/ remarkable_official_templates/

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
	@echo "$(RM_METHODS_DIR)/ ready."

backup-rm-methods: ## Pull deployed rm_methods files from device into a local timestamped backup
	@if ! test -d $(RM_METHODS_DIR); then \
	  echo "Warning: $(RM_METHODS_DIR)/ not found; skipping backup."; \
	else \
	  mkdir -p $(RM_METHODS_BACKUP_DIR); \
	  ts=$$(date +%Y%m%d_%H%M%S); \
	  dir=$(RM_METHODS_BACKUP_DIR)/rm-methods_$${ts}; \
	  echo "Backing up to $$dir/"; \
	  ls $(RM_METHODS_DIR) | rsync -avz --ignore-missing-args --files-from=- $(DEVICE):$(RM_METHODS_PATH)/ $$dir/ && \
	  echo "Backup complete: $$dir/"; \
	fi

rollback-rm-methods: ## Restore the most recent local rm_methods backup to the device
	@latest=$$(ls -dt $(RM_METHODS_BACKUP_DIR)/rm-methods_*/ 2>/dev/null | head -n 1); \
	if [ -z "$$latest" ]; then echo "No backups found in $(RM_METHODS_BACKUP_DIR)/"; exit 1; fi; \
	echo "Rolling back from $$latest"; \
	rsync -avz --progress $$latest $(DEVICE):$(RM_METHODS_PATH)/ && \
	ssh $(DEVICE) "systemctl restart xochitl" && \
	echo "Rollback complete."

list-backups-rm-methods: ## List local rm_methods backups
	@ls -lhd $(RM_METHODS_BACKUP_DIR)/rm-methods_*/ 2>/dev/null || echo "No backups found in $(RM_METHODS_BACKUP_DIR)/"

# Run 'make build-rm-methods-dist' (requires pnpm dev) to populate rm-methods-dist/ first.
# No remount needed — the xochitl user directory is already writable.
deploy-rm-methods: backup-rm-methods ## Back up then deploy rm_methods templates to xochitl
	@test -d $(RM_METHODS_DIR) || { echo "Error: $(RM_METHODS_DIR)/ not found. Extract the ZIP first."; exit 1; }
	rsync -avz --progress $(RM_METHODS_DIR)/ $(DEVICE):$(RM_METHODS_PATH)/
	ssh $(DEVICE) "systemctl restart xochitl"
