import { App, Modal, Setting, setIcon, ButtonComponent } from "obsidian";
import Manager from "main";
import { RibbonItem } from "../data/types";

export class RibbonModal extends Modal {
    manager: Manager;
    private renderRootEl?: HTMLElement;
    private renderToolbarInRoot = true;

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

    async onOpen() {
        if (!this.manager.isRibbonManagerEnabled()) {
            this.close();
            return;
        }

        this.manager.ribbonModal = this;
        this.modalEl.addClass("ribbon-manager-modal");
        this.titleEl.setText(this.manager.translator.t("Ribbon_标题"));
        await this.syncRibbonItems();
        this.display();
    }

    // 同步 Ribbon 项：读取当前工作区的 Ribbon，合并到设置中
    async syncRibbonItems() {
        if (!this.manager.isRibbonManagerEnabled()) return;

        // 以 BPM 自己的 data.json 为源头，只从运行时内存补齐新出现的 Ribbon 项。
        const savedItems = [...(this.manager.settings.RIBBON_SETTINGS || [])]
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        const orderedIds = savedItems.map((item) => item.id);
        const hiddenStatus: Record<string, boolean> = {};
        savedItems.forEach((item) => hiddenStatus[item.id] = !item.visible);
        await this.manager.syncRibbonConfig(orderedIds, hiddenStatus);
    }

    private getRibbonFallbackIcon(item: RibbonItem): string {
        const source = `${item.id} ${item.name} ${item.icon || ""}`.toLowerCase();
        if (
            source.includes("refresh") ||
            source.includes("reload") ||
            source.includes("sync") ||
            source.includes("刷新") ||
            source.includes("重载") ||
            source.includes("同步")
        ) {
            return "refresh-cw";
        }
        return "help-circle";
    }

    private renderRibbonItemIcon(iconEl: HTMLElement, item: RibbonItem) {
        iconEl.empty();
        const icon = item.icon?.trim();
        try {
            if (icon) setIcon(iconEl, icon);
        } catch {
            // Plugin-provided icons can be unavailable when this panel renders.
        }
        if (!iconEl.querySelector("svg")) {
            iconEl.empty();
            setIcon(iconEl, this.getRibbonFallbackIcon(item));
        }
    }

    display(targetEl?: HTMLElement, showToolbar = this.renderToolbarInRoot) {
        const contentEl = targetEl || this.renderRootEl || this.contentEl;
        this.renderRootEl = contentEl;
        this.renderToolbarInRoot = showToolbar;
        contentEl.empty();
        if (!this.manager.isRibbonManagerEnabled()) return;

        if (showToolbar) this.renderToolbar(contentEl);
        this.renderDraggableList(contentEl);
    }

    private renderToolbar(containerEl: HTMLElement) {
        const t = (k: any) => this.manager.translator.t(k);
        const toolbar = containerEl.createDiv("manager-hidden-toolbar ribbon-manager-toolbar");
        const toolbarText = toolbar.createDiv("manager-hidden-toolbar__text");
        toolbarText.createDiv({ cls: "manager-hidden-toolbar__title", text: t("Ribbon_功能编排_标题") });
        toolbarText.createDiv({
            cls: "manager-hidden-toolbar__desc",
            text: t("Ribbon_功能编排_说明")
        });
        const toolbarActions = toolbar.createDiv("manager-hidden-toolbar__actions");
        const resetBtn = new ButtonComponent(toolbarActions);
        resetBtn.setIcon("rotate-ccw");
        resetBtn.setButtonText(t("通用_重置_文本"));
        resetBtn.setTooltip(t("Ribbon_重置_提示"));
        resetBtn.onClick(async () => {
            if (!window.confirm(t("Ribbon_重置_确认"))) return;
            await this.resetRibbonLayout();
        });
    }

    renderDraggableList(containerEl: HTMLElement) {
        const t = (k: any) => this.manager.translator.t(k);
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
            itemEl.toggleClass("is-hidden", !item.visible);
            setting.nameEl.addClass("ribbon-manager-item-name-root");
            setting.controlEl.addClass("ribbon-manager-item-control-root");

            // 自定义内容布局
            const itemContent = setting.nameEl.createDiv({ cls: "draggable-item-content" });

            const orderEl = itemContent.createDiv({ cls: "ribbon-manager-item-order" });
            orderEl.setText(`${index + 1}`.padStart(2, "0"));

            // 图标
            const iconEl = itemContent.createDiv({ cls: "setting-item-icon" });
            this.renderRibbonItemIcon(iconEl, item);

            const textWrap = itemContent.createDiv({ cls: "ribbon-manager-item-text" });
            const titleLine = textWrap.createDiv({ cls: "ribbon-manager-item-title-line" });
            titleLine.createEl("div", {
                text: item.name || this.manager.translator.t("Ribbon_未命名"),
                cls: "setting-item-name"
            });
            titleLine.createSpan({
                text: item.visible ? t("管理器_状态_显示中") : t("管理器_状态_已隐藏"),
                cls: `ribbon-manager-item-state ${item.visible ? "is-visible" : "is-hidden"}`
            });
            textWrap.createDiv({
                text: item.id,
                cls: "ribbon-manager-item-id"
            });

            const controlBar = setting.controlEl.createDiv({ cls: "ribbon-manager-control-bar" });

            // 可见性按钮
            const visibilityDiv = controlBar.createDiv({ cls: "ribbon-manager-control-visibility" });
            new ButtonComponent(visibilityDiv)
                .setIcon(item.visible ? "eye" : "eye-off")
                .setTooltip(item.visible ? this.manager.translator.t("Ribbon_隐藏") : this.manager.translator.t("Ribbon_显示"))
                .onClick(async () => {
                    const newValue = !item.visible;
                    item.visible = newValue;

                    await this.persistRibbonConfig();
                    this.display();
                });

            // 拖拽手柄
            const handle = controlBar.createDiv({
                cls: "ribbon-manager-control-drag",
                attr: { role: "button", "aria-label": t("管理器_布局_拖动排序") }
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
        this.placeholderEl.style.marginBottom = "0";

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
        if (!this.manager.isRibbonManagerEnabled()) return;

        const items = this.manager.settings.RIBBON_SETTINGS;
        if (oldIndex < 0 || oldIndex >= items.length || newIndex < 0 || newIndex > items.length) {
            this.display();
            return;
        }

        const [movedItem] = items.splice(oldIndex, 1);
        items.splice(newIndex, 0, movedItem);

        await this.persistRibbonConfig();
        this.display();
    }

    private async persistRibbonConfig() {
        if (!this.manager.isRibbonManagerEnabled()) return;

        const items = this.manager.settings.RIBBON_SETTINGS;
        items.forEach((item, idx) => item.order = idx);
        await this.manager.saveSettings();

        const orderedIds = items.map(i => i.id);
        const hiddenStatus: Record<string, boolean> = {};
        items.forEach(i => hiddenStatus[i.id] = !i.visible);
        this.manager.applyRibbonConfigToMemory(orderedIds, hiddenStatus);

        // @ts-ignore
        this.manager.updateRibbonStyles?.();
    }

    async resetRibbonLayout() {
        if (!this.manager.isRibbonManagerEnabled()) return;

        const items = this.manager.settings.RIBBON_SETTINGS;
        items.sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));
        items.forEach((item, idx) => {
            item.visible = true;
            item.order = idx;
        });
        await this.persistRibbonConfig();
        this.display();
    }

    onClose() {
        this.manager.ribbonModal = null;
    }
}
