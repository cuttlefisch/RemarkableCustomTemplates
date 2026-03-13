DEVICE        := remarkable-wlan
TEMPLATES_PATH := /usr/share/remarkable/templates
BACKUP_DIR    := /home/root/template-backups
DIST_DIR      := dist-deploy

.PHONY: help pull backup build-deploy deploy rollback list-backups

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
