import { App, Modal, Setting, setIcon, ButtonComponent, Platform, Notice } from "obsidian";
import Manager from "main";
import { RibbonItem } from "../data/types";

export class RibbonModal extends Modal {
    manager: Manager;

    // 拖拽相关变量
    draggedItemEl: HTMLElement | null = null;
    ghostEl: HTMLElement | null = null;
    placeholderEl: HTMLElement | null = null;
    dragStartIndex = -1;
    dragOffsetX = 0;
    dragOffsetY = 0;
    activePointerId: number | null = null;

    constructor(app: App, manager: Manager) {
        super(app);
        this.manager = manager;
        this.handleDragMove = this.handleDragMove.bind(this);
        this.handleDragEnd = this.handleDragEnd.bind(this);
    }

    onOpen() {
        this.modalEl.addClass("ribbon-manager-modal");
        this.titleEl.setText(this.manager.translator.t("Ribbon_标题"));
        this.syncRibbonItems();
        this.display();
    }

    onClose() {
        this.contentEl.empty();
    }

    // 同步 Ribbon 项：读取当前工作区的 Ribbon，合并到设置中
    syncRibbonItems() {
        // @ts-ignore - leftRibbon internal API
        const ribbonItems = this.app.workspace.leftRibbon?.items;
        if (!ribbonItems) return;

        const currentSettings = this.manager.settings.RIBBON_SETTINGS || [];
        const settingsMap = new Map(currentSettings.map(c => [c.id, c]));
        const newSettings: RibbonItem[] = [];
        let changed = false;

        for (const item of ribbonItems) {
            const id = item.id;
            const name = item.title; // aria-label as name
            const icon = item.icon;
            if (!id) continue;

            const existing = settingsMap.get(id);
            if (existing) {
                // 更新名称和图标，以防变更
                if (existing.name !== name || existing.icon !== icon) {
                    existing.name = name;
                    existing.icon = icon;
                    changed = true;
                }
                newSettings.push(existing);
            } else {
                newSettings.push({
                    id,
                    name: name || this.manager.translator.t("Ribbon_未命名"),
                    icon,
                    visible: true,
                    order: newSettings.length
                });
                changed = true;
            }
        }

        // 检查是否有由于插件禁用等原因不再存在的 Ribbon，暂时保留在配置中还是移除？
        // 参考 mobile-ribbon-order，它是重建列表。如果想保留以前的配置（比如插件暂时禁用），
        // 可以考虑合并。但这里简单起见，且为了清理无用项，先按当前存在的重建。
        // 不过为了保留被禁用插件的顺序，我们可以把没被扫描到的项加在后面或者保留。
        // 为了防止列表无限膨胀，这里仅保留当前可见的 Ribbon 对应的配置，
        // 但这样会导致如果插件被禁用，下次启用顺序可能丢失。
        // 改进：保留所有已有配置，但标记是否 active。
        // 这里暂时跟随 reference implementation 的逻辑：仅处理存在的。

        // 保持顺序
        newSettings.sort((a, b) => a.order - b.order);

        // 重新分配 order 确保连续
        newSettings.forEach((item, index) => {
            if (item.order !== index) {
                item.order = index;
                changed = true;
            }
        });

        if (currentSettings.length !== newSettings.length) changed = true;

        if (changed) {
            this.manager.settings.RIBBON_SETTINGS = newSettings;
            this.manager.saveSettings();
            // @ts-ignore
            this.manager.updateRibbonStyles?.();
        }
    }

    display() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl("p", {
            text: this.manager.translator.t("Ribbon_说明"),
            cls: "ribbon-manager-description"
        });

        this.renderDraggableList(contentEl);
    }

    renderDraggableList(containerEl: HTMLElement) {
        const listContainer = containerEl.createDiv("draggable-list-container");
        const items = this.manager.settings.RIBBON_SETTINGS;

        if (items.length === 0) {
            listContainer.createEl("p", { text: this.manager.translator.t("Ribbon_无项目") });
            return;
        }

        items.forEach((item, index) => {
            const setting = new Setting(listContainer);
            const itemEl = setting.settingEl;
            itemEl.addClass("draggable-item");
            itemEl.setAttr("data-index", index);

            // 自定义内容布局
            const itemContent = setting.nameEl.createDiv({ cls: "draggable-item-content" });

            // 图标
            const iconEl = itemContent.createDiv({ cls: "setting-item-icon" });
            if (item.icon) setIcon(iconEl, item.icon);

            // 名称
            itemContent.createEl("div", {
                text: item.name || this.manager.translator.t("Ribbon_未命名"),
                cls: "setting-item-name"
            });

            const controlBar = setting.controlEl.createDiv({ cls: "ribbon-manager-control-bar" });

            // 可见性按钮
            const visibilityDiv = controlBar.createDiv({ cls: "ribbon-manager-control-visibility" });
            new ButtonComponent(visibilityDiv)
                .setIcon(item.visible ? "eye" : "eye-off")
                .setTooltip(item.visible ? this.manager.translator.t("Ribbon_隐藏") : this.manager.translator.t("Ribbon_显示"))
                .onClick(async () => {
                    item.visible = !item.visible;
                    await this.manager.saveSettings();
                    // @ts-ignore
                    this.manager.updateRibbonStyles?.();
                    this.display();
                });

            // 拖拽手柄
            const handle = controlBar.createDiv({
                cls: "ribbon-manager-control-drag",
                attr: { role: "button", "aria-label": "Drag" }
            });
            setIcon(handle, "grip-vertical");
            handle.setAttr("draggable", "true");
            handle.addEventListener("pointerdown", (e) => this.startDrag(itemEl, index, e));
            // 阻止原生拖拽，使用 pointer events 模拟
            handle.addEventListener("dragstart", (e) => e.preventDefault());
        });
    }

    startDrag(itemEl: HTMLElement, index: number, e: PointerEvent) {
        if (e.target && (e.target as Element).setPointerCapture) {
            (e.target as Element).setPointerCapture(e.pointerId);
        }

        this.draggedItemEl = itemEl;
        this.dragStartIndex = index;

        const rect = itemEl.getBoundingClientRect();
        // const containerRect = itemEl.parentElement!.getBoundingClientRect();

        this.dragOffsetX = e.clientX - rect.left;
        this.dragOffsetY = e.clientY - rect.top;
        this.activePointerId = e.pointerId;

        // 创建幽灵元素
        this.ghostEl = itemEl.cloneNode(true) as HTMLElement;
        this.ghostEl.addClass("drag-ghost");
        document.body.appendChild(this.ghostEl);
        this.ghostEl.style.width = `${rect.width}px`;
        this.ghostEl.style.height = `${rect.height}px`;

        this.updateGhostPosition(e);

        // 创建占位符
        this.placeholderEl = document.createElement("div");
        this.placeholderEl.className = "drag-gap-placeholder";
        this.placeholderEl.style.height = `${rect.height}px`;
        this.placeholderEl.style.marginBottom = "8px"; // 对应 .draggable-item 的 margin-bottom

        itemEl.parentNode!.insertBefore(this.placeholderEl, itemEl);
        itemEl.addClass("dragging");

        document.addEventListener("pointermove", this.handleDragMove, { passive: false });
        document.addEventListener("pointerup", this.handleDragEnd, { once: true });
        document.addEventListener("pointercancel", this.handleDragEnd, { once: true });
    }

    handleDragMove(e: PointerEvent) {
        if (!this.ghostEl || !this.placeholderEl || !this.draggedItemEl) return;
        if (e.pointerId !== this.activePointerId) return;

        e.preventDefault();
        this.updateGhostPosition(e);

        const listContainer = this.placeholderEl.parentNode!;
        const items = Array.from(listContainer.children).filter(
            (el) => el !== this.placeholderEl && !el.classList.contains("dragging") && !el.classList.contains("drag-ghost")
        );

        let dropTarget: Element | null = null;
        for (const item of items) {
            const rect = item.getBoundingClientRect();
            // 当鼠标超过元素中点时视为拖动到该元素之后/位置
            if (e.clientY < rect.top + rect.height / 2) {
                dropTarget = item;
                break;
            }
        }

        if (dropTarget) {
            listContainer.insertBefore(this.placeholderEl, dropTarget);
        } else {
            listContainer.appendChild(this.placeholderEl);
        }
    }

    updateGhostPosition(e: PointerEvent) {
        if (!this.ghostEl) return;
        this.ghostEl.style.left = `${e.clientX - this.dragOffsetX}px`;
        this.ghostEl.style.top = `${e.clientY - this.dragOffsetY}px`;
    }

    async handleDragEnd(e: PointerEvent) {
        if (!this.draggedItemEl || !this.placeholderEl) return;

        const listContainer = this.placeholderEl.parentNode!;

        // 计算新索引
        let newIndex = 0;
        const children = Array.from(listContainer.children);
        for (const child of children) {
            if (child === this.placeholderEl) break;
            if (child.matches(".draggable-item:not(.dragging)")) {
                newIndex++;
            }
        }

        // 清理
        this.placeholderEl.remove();
        this.placeholderEl = null;
        if (this.ghostEl) {
            this.ghostEl.remove();
            this.ghostEl = null;
        }

        this.draggedItemEl.removeClass("dragging");
        const oldIndex = this.dragStartIndex;

        document.removeEventListener("pointermove", this.handleDragMove);
        this.draggedItemEl = null;
        this.dragStartIndex = -1;
        this.activePointerId = null;

        if (newIndex !== oldIndex) {
            await this.moveItem(oldIndex, newIndex);
        }
    }

    async moveItem(oldIndex: number, newIndex: number) {
        const items = this.manager.settings.RIBBON_SETTINGS;
        if (oldIndex < 0 || oldIndex >= items.length || newIndex < 0 || newIndex > items.length) {
            this.display();
            return;
        }

        const [movedItem] = items.splice(oldIndex, 1);
        items.splice(newIndex, 0, movedItem);

        // 更新 order
        items.forEach((item, idx) => item.order = idx);

        await this.manager.saveSettings();
        // @ts-ignore
        this.manager.updateRibbonStyles?.();
        this.display();
    }
}
