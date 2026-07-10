import { App, ButtonComponent, ExtraButtonComponent, Modal, Setting, setIcon } from "obsidian";
import Manager from "main";
import { getExtraButtonElement } from "src/obsidian-internals";

export type BulkStatusConfirmOptions = {
    targetEnabled: boolean;
    selectedCount: number;
    actionableCount: number;
    skippedCount: number;
    pluginNames: string[];
};

class BulkStatusConfirmModal extends Modal {
    private resolved = false;
    private cancelButton?: ButtonComponent;
    private confirmButton?: ButtonComponent;

    constructor(
        app: App,
        private readonly manager: Manager,
        private readonly options: BulkStatusConfirmOptions,
        private readonly resolve: (confirmed: boolean) => void
    ) {
        super(app);
    }

    private t(key: string, vars?: Record<string, string | number | boolean | null | undefined>) {
        return this.manager.translator.t(key, vars);
    }

    private finish(confirmed: boolean) {
        if (this.resolved) return;
        this.resolved = true;
        this.resolve(confirmed);
        this.close();
    }

    private prepareCloseButton(button: ExtraButtonComponent) {
        const label = this.t("通用_取消_文本");
        button.setIcon("x");
        button.setTooltip(label);
        const buttonEl = getExtraButtonElement(button);
        buttonEl?.addClass("manager-bulk-status-confirm__close");
        buttonEl?.setAttribute("aria-label", label);
    }

    private renderHeader() {
        const targetEnabled = this.options.targetEnabled;
        const title = this.t(targetEnabled ? "批量编辑_启用确认" : "批量编辑_禁用确认", { count: this.options.actionableCount });
        const modalEl = this.contentEl.parentElement;
        modalEl?.addClass("manager-bulk-status-confirm");
        modalEl?.addClass(targetEnabled ? "is-enable" : "is-disable");
        modalEl?.querySelector(".modal-close-button")?.remove();
        this.titleEl.empty();
        this.titleEl.parentElement?.addClass("manager-container__header");

        const titleBar = new Setting(this.titleEl).setClass("manager-bulk-status-confirm__titlebar");
        titleBar.nameEl.empty();
        titleBar.descEl.empty();

        const titleWrap = titleBar.nameEl.createDiv("manager-bulk-status-confirm__title");
        const titleIcon = titleWrap.createSpan("manager-bulk-status-confirm__title-icon");
        setIcon(titleIcon, targetEnabled ? "power" : "power-off");
        const titleText = titleWrap.createDiv("manager-bulk-status-confirm__title-text");
        titleText.createDiv({ cls: "manager-bulk-status-confirm__eyebrow", text: this.t("批量编辑_标题") });
        titleText.createDiv({ cls: "manager-bulk-status-confirm__heading", text: title });
        titleBar.descEl.setText(this.t("批量编辑_启停_说明"));

        const closeButton = new ExtraButtonComponent(titleBar.controlEl);
        this.prepareCloseButton(closeButton);
        closeButton.onClick(() => this.finish(false));
    }

    private renderMetric(container: HTMLElement, value: number, label: string, cls = "") {
        const item = container.createDiv(`manager-bulk-status-confirm__metric ${cls}`.trim());
        item.createDiv({ cls: "manager-bulk-status-confirm__metric-value", text: `${value}` });
        item.createDiv({ cls: "manager-bulk-status-confirm__metric-label", text: label });
    }

    private renderBody() {
        this.contentEl.empty();
        this.contentEl.addClass("manager-item-container");
        this.contentEl.addClass("manager-bulk-status-confirm__body");

        const page = this.contentEl.createDiv("manager-bulk-status-confirm__page");

        const summary = page.createDiv("manager-bulk-status-confirm__summary");
        const summaryIcon = summary.createSpan("manager-bulk-status-confirm__summary-icon");
        setIcon(summaryIcon, this.options.targetEnabled ? "badge-check" : "badge-x");
        const summaryText = summary.createDiv("manager-bulk-status-confirm__summary-text");
        summaryText.createDiv({
            cls: "manager-bulk-status-confirm__summary-title",
            text: this.t(this.options.targetEnabled ? "通用_启用_文本" : "通用_禁用_文本"),
        });
        summaryText.createDiv({
            cls: "manager-bulk-status-confirm__summary-desc",
            text: this.t(this.options.targetEnabled ? "批量编辑_启用确认" : "批量编辑_禁用确认", { count: this.options.actionableCount }),
        });

        const metrics = page.createDiv("manager-bulk-status-confirm__metrics");
        this.renderMetric(metrics, this.options.actionableCount, this.t("批量编辑_启停_处理"));
        this.renderMetric(metrics, this.options.selectedCount, this.t("批量编辑_启停_已选择"));
        if (this.options.skippedCount > 0) {
            this.renderMetric(metrics, this.options.skippedCount, this.t("批量编辑_启停_已跳过"), "is-muted");
        }

        const preview = page.createDiv("manager-bulk-status-confirm__preview");
        preview.createDiv({ cls: "manager-bulk-status-confirm__preview-label", text: this.t("批量编辑_启停_对象预览") });
        const list = preview.createDiv("manager-bulk-status-confirm__plugin-list");
        const previewNames = this.options.pluginNames.slice(0, 5);
        previewNames.forEach((name) => {
            const item = list.createDiv("manager-bulk-status-confirm__plugin");
            const icon = item.createSpan("manager-bulk-status-confirm__plugin-icon");
            setIcon(icon, "blocks");
            item.createSpan({ cls: "manager-bulk-status-confirm__plugin-name", text: name });
        });
        const hiddenCount = Math.max(0, this.options.pluginNames.length - previewNames.length);
        if (hiddenCount > 0) {
            list.createDiv({
                cls: "manager-bulk-status-confirm__plugin-more",
                text: this.t("批量编辑_启停_更多对象", { count: hiddenCount }),
            });
        }

        const note = page.createDiv("manager-bulk-status-confirm__note");
        const noteIcon = note.createSpan("manager-bulk-status-confirm__note-icon");
        setIcon(noteIcon, "info");
        const noteText = note.createDiv("manager-bulk-status-confirm__note-text");
        noteText.createDiv({ text: this.t("批量编辑_启停_立即生效") });
        noteText.createDiv({ text: this.t("批量编辑_启停_跳过说明") });

        const actionBar = new Setting(page).setClass("manager-bulk-status-confirm__actions");
        actionBar.nameEl.empty();
        actionBar.descEl.empty();
        actionBar.addButton((button) => {
            this.cancelButton = button;
            button
                .setButtonText(this.t("通用_取消_文本"))
                .setTooltip(this.t("通用_取消_文本"))
                .setClass("manager-bulk-status-confirm__cancel")
                .onClick(() => this.finish(false));
            button.buttonEl.setAttribute("aria-label", this.t("通用_取消_文本"));
        });
        actionBar.addButton((button) => {
            this.confirmButton = button;
            const label = this.t(this.options.targetEnabled ? "通用_启用_文本" : "通用_禁用_文本");
            button
                .setIcon(this.options.targetEnabled ? "power" : "power-off")
                .setButtonText(label)
                .setTooltip(label)
                .setClass("manager-bulk-status-confirm__confirm")
                .onClick(() => this.finish(true));
            button.buttonEl.setAttribute("aria-label", label);
        });
    }

    onOpen() {
        this.renderHeader();
        this.renderBody();
        this.cancelButton?.buttonEl.focus();
    }

    onClose() {
        this.contentEl.empty();
        this.finish(false);
    }
}

export const confirmBulkStatusChange = (
    app: App,
    manager: Manager,
    options: BulkStatusConfirmOptions
): Promise<boolean> => new Promise((resolve) => {
    new BulkStatusConfirmModal(app, manager, options, resolve).open();
});
