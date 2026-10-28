import { App, Modal, Setting, setIcon, ButtonComponent, TextComponent } from "obsidian";
import Manager from "main";
import { RibbonItem } from "../data/types";
import { confirmWithModal } from "../utils";

export class RibbonModal extends Modal {
    manager: Manager;
    private renderRootEl?: HTMLElement;
    private renderToolbarInRoot = true;

    // 过滤和搜索
    private currentFilter: "all" | "visible" | "hidden" = "all";
    private searchQuery = "";

    // 拖拽相关变量
    draggedItemEl: HTMLElement | null = null;
    draggedItem: RibbonItem | null = null;
    ghostEl: HTMLElement | null = null;
    placeholderEl: HTMLElement | null = null;
    dragStartIndex = -1;
    dragOffsetX = 0;
    dragOffsetY = 0;
    activePointerId: number | null = null;
    private handleDragEndEvent = (e: PointerEvent) => { void this.handleDragEnd(e); };

    constructor(app: App, manager: Manager) {
        super(app);
        this.manager = manager;
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

    // 同步 Ribbon 项：登记尚未见过的新图标并把配置应用到原生状态
    // 面板打开时调用一次，保证列表列全（显隐与顺序由 Obsidian 原生状态承载）
    async syncRibbonItems() {
        if (!this.manager.isRibbonManagerEnabled()) return;

        this.manager.applyRibbonSettings();
    }

    private getRibbonFallbackIcon(item: RibbonItem): string {
        const source = `${item.bpmUniqueId} ${item.name} ${item.icon || ""}`.toLowerCase();
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
        const t = (k: string) => this.manager.translator.t(k);
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
            if (!(await confirmWithModal(this.app, this.manager, t("Ribbon_重置_确认")))) return;
            await this.resetRibbonLayout();
        });
    }

    renderDraggableList(containerEl: HTMLElement) {
        const t = (k: string) => this.manager.translator.t(k);
        const allItems = this.manager.settings.RIBBON_SETTINGS;

        // 统计数量
        const visibleCount = allItems.filter(item => item.visible).length;
        const hiddenCount = allItems.filter(item => !item.visible).length;

        // 过滤按钮组和搜索框
        const filterBar = containerEl.createDiv("ribbon-manager-filter-bar");

        // 左侧：过滤按钮组
        const filterGroup = filterBar.createDiv("ribbon-manager-filter-group");

        const filters = [
            { key: "all" as const, label: t("通用_全部_文本"), count: allItems.length, icon: "menu" },
            { key: "visible" as const, label: t("Ribbon_显示"), count: visibleCount, icon: "eye" },
            { key: "hidden" as const, label: t("Ribbon_隐藏"), count: hiddenCount, icon: "eye-off" }
        ];

        filters.forEach((filter) => {
            const btn = new ButtonComponent(filterGroup);
            btn.buttonEl.addClass("ribbon-filter-btn");
            if (this.currentFilter === filter.key) {
                btn.buttonEl.addClass("is-active");
            }

            // 自定义按钮内容：图标 + 文本 + 数量
            btn.buttonEl.empty();
            const iconEl = btn.buttonEl.createSpan({ cls: "ribbon-filter-btn-icon" });
            setIcon(iconEl, filter.icon);
            btn.buttonEl.createSpan({ text: `${filter.label} ${filter.count}`, cls: "ribbon-filter-btn-text" });

            btn.onClick(() => {
                this.currentFilter = filter.key;
                this.displayWithoutSearch();
            });
        });

        // 右侧：搜索框
        const searchContainer = filterBar.createDiv("ribbon-manager-search-container");
        const searchWrapper = searchContainer.createDiv("ribbon-search-wrapper");
        const searchIconEl = searchWrapper.createDiv("ribbon-search-icon");
        setIcon(searchIconEl, "search");

        const searchInput = new TextComponent(searchWrapper);
        searchInput.setPlaceholder(t("Ribbon_搜索_占位"));
        searchInput.inputEl.addClass("ribbon-search-input");

        if (this.searchQuery) {
            searchInput.setValue(this.searchQuery);
        }

        searchInput.onChange((value) => {
            this.searchQuery = value;
            this.renderFilteredList(containerEl, listContainer);
        });

        const listContainer = containerEl.createDiv("draggable-list-container");
        this.renderFilteredList(containerEl, listContainer);
    }

    displayWithoutSearch(targetEl?: HTMLElement, showToolbar = this.renderToolbarInRoot) {
        const contentEl = targetEl || this.renderRootEl || this.contentEl;
        this.renderRootEl = contentEl;
        this.renderToolbarInRoot = showToolbar;
        contentEl.empty();
        if (!this.manager.isRibbonManagerEnabled()) return;

        if (showToolbar) this.renderToolbar(contentEl);
        this.renderDraggableList(contentEl);
    }

    renderFilteredList(containerEl: HTMLElement, listContainer: HTMLElement) {
        listContainer.empty();
        const allItems = this.manager.settings.RIBBON_SETTINGS;

        // 根据过滤器筛选项目
        let items = allItems;
        if (this.currentFilter === "visible") {
            items = allItems.filter(item => item.visible);
        } else if (this.currentFilter === "hidden") {
            items = allItems.filter(item => !item.visible);
        }

        // 根据搜索词过滤
        if (this.searchQuery && this.searchQuery.trim()) {
            const query = this.searchQuery.toLowerCase().trim();
            items = items.filter(item => {
                const name = (item.name || "").toLowerCase();
                const id = (item.bpmUniqueId || "").toLowerCase();
                return name.includes(query) || id.includes(query);
            });
        }

        if (items.length === 0) {
            listContainer.createEl("p", { text: this.manager.translator.t("Ribbon_无项目") });
            return;
        }

        const t = (k: string) => this.manager.translator.t(k);

        items.forEach((item, displayIndex) => {
            // 使用实际配置的 order 作为序号，而不是过滤后的索引
            const actualOrder = item.order ?? displayIndex;
            const setting = new Setting(listContainer);
            const itemEl = setting.settingEl;
            itemEl.addClass("draggable-item");
            itemEl.setAttr("data-index", displayIndex.toString());
            itemEl.setAttr("data-item-id", item.bpmUniqueId);
            itemEl.toggleClass("is-hidden", !item.visible);
            setting.nameEl.addClass("ribbon-manager-item-name-root");
            setting.controlEl.addClass("ribbon-manager-item-control-root");

            // 自定义内容布局
            const itemContent = setting.nameEl.createDiv({ cls: "draggable-item-content" });

            const orderEl = itemContent.createDiv({ cls: "ribbon-manager-item-order" });
            orderEl.setText(`${actualOrder + 1}`.padStart(2, "0"));

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
                    this.displayWithoutSearch();
                });

            // 拖拽手柄
            const handle = controlBar.createDiv({
                cls: "ribbon-manager-control-drag",
                attr: { role: "button", "aria-label": t("管理器_布局_拖动排序") }
            });
            setIcon(handle, "grip-vertical");
            handle.setAttr("draggable", "true");
            handle.addEventListener("pointerdown", (e) => this.startDrag(itemEl, displayIndex, item, e));
            // 阻止原生拖拽，使用 pointer events 模拟
            handle.addEventListener("dragstart", (e) => e.preventDefault());
        });
    }

    startDrag(itemEl: HTMLElement, displayIndex: number, draggedItem: RibbonItem, e: PointerEvent) {
        if (e.target && (e.target as Element).setPointerCapture) {
            (e.target as Element).setPointerCapture(e.pointerId);
        }

        this.draggedItemEl = itemEl;
        this.dragStartIndex = displayIndex;
        this.draggedItem = draggedItem;

        const rect = itemEl.getBoundingClientRect();

        this.dragOffsetX = e.clientX - rect.left;
        this.dragOffsetY = e.clientY - rect.top;
        this.activePointerId = e.pointerId;

        // 创建幽灵元素
        this.ghostEl = itemEl.cloneNode(true) as HTMLElement;
        this.ghostEl.addClass("drag-ghost");
        activeDocument.body.appendChild(this.ghostEl);
        this.ghostEl.setCssStyles({
            width: `${rect.width}px`,
            height: `${rect.height}px`,
        });

        this.updateGhostPosition(e);

        // 创建占位符
        this.placeholderEl = activeDocument.createElement("div");
        this.placeholderEl.className = "drag-gap-placeholder";
        this.placeholderEl.setCssStyles({
            height: `${rect.height}px`,
            marginBottom: "0",
        });

        itemEl.parentNode!.insertBefore(this.placeholderEl, itemEl);
        itemEl.addClass("dragging");

        activeDocument.addEventListener("pointermove", this.handleDragMove, { passive: false });
        activeDocument.addEventListener("pointerup", this.handleDragEndEvent, { once: true });
        activeDocument.addEventListener("pointercancel", this.handleDragEndEvent, { once: true });
    }

    private handleDragMove = (e: PointerEvent) => {
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
        this.ghostEl.setCssStyles({
            left: `${e.clientX - this.dragOffsetX}px`,
            top: `${e.clientY - this.dragOffsetY}px`,
        });
    }

    private handleDragEnd = async (e: PointerEvent) => {
        if (!this.draggedItemEl || !this.placeholderEl || !this.draggedItem) return;

        const listContainer = this.placeholderEl.parentNode!;

        // 找到 placeholder 之前的元素
        let targetElement: Element | null = null;
        const children = Array.from(listContainer.children);
        for (let i = 0; i < children.length; i++) {
            if (children[i] === this.placeholderEl) {
                // 找到 placeholder 前一个非拖拽元素
                for (let j = i - 1; j >= 0; j--) {
                    if (children[j].matches(".draggable-item:not(.dragging)")) {
                        targetElement = children[j];
                        break;
                    }
                }
                break;
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
        activeDocument.removeEventListener("pointermove", this.handleDragMove);

        // 读取目标元素的 item-id 并更新实际的 order
        if (targetElement) {
            const targetItemId = targetElement.getAttribute("data-item-id");
            const allItems = this.manager.settings.RIBBON_SETTINGS;
            const targetItem = allItems.find(item => item.bpmUniqueId === targetItemId);

            if (targetItem && this.draggedItem) {
                // 获取目标项的 order，拖拽项插入到其后
                const targetOrder = targetItem.order ?? 0;
                const draggedOrder = this.draggedItem.order ?? 0;

                // 更新所有项的 order
                allItems.forEach(item => {
                    if (item === this.draggedItem) {
                        item.order = targetOrder + 1;
                    } else if (draggedOrder < targetOrder) {
                        // 向下拖拽
                        if ((item.order ?? 0) > draggedOrder && (item.order ?? 0) <= targetOrder) {
                            item.order = (item.order ?? 0) - 1;
                        }
                    } else {
                        // 向上拖拽
                        if ((item.order ?? 0) >= targetOrder + 1 && (item.order ?? 0) < draggedOrder) {
                            item.order = (item.order ?? 0) + 1;
                        }
                    }
                });

                // 重新排序
                allItems.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
                allItems.forEach((item, index) => {
                    item.order = index;
                });

                await this.manager.saveSettings();

                // 顺序已写入设置，推入 Obsidian 原生状态
                this.manager.applyRibbonSettings();
            }
        }

        this.draggedItemEl = null;
        this.dragStartIndex = -1;
        this.draggedItem = null;
        this.activePointerId = null;

        this.displayWithoutSearch();
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

        // 显隐与顺序推入 Obsidian 原生状态
        this.manager.applyRibbonSettings();
    }

    async resetRibbonLayout() {
        if (!this.manager.isRibbonManagerEnabled()) return;

        const items = this.manager.settings.RIBBON_SETTINGS;
        items.sort((a, b) => (a.name || a.bpmUniqueId).localeCompare(b.name || b.bpmUniqueId));
        items.forEach((item, idx) => {
            item.visible = true;
            item.order = idx;
        });
        await this.persistRibbonConfig();
        this.displayWithoutSearch();
    }

    onClose() {
        this.manager.ribbonModal = null;
    }
}
