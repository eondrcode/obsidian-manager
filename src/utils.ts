import { App, ButtonComponent, Modal, Notice, Platform, Setting } from "obsidian";
import { shell } from "electron";
import Manager from "main";

type ConfirmModalOptions = {
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
};

class ManagerConfirmModal extends Modal {
    private readonly manager: Manager;
    private readonly options: ConfirmModalOptions;
    private readonly resolve: (confirmed: boolean) => void;
    private resolved = false;

    constructor(app: App, manager: Manager, options: ConfirmModalOptions, resolve: (confirmed: boolean) => void) {
        super(app);
        this.manager = manager;
        this.options = options;
        this.resolve = resolve;
    }

    onOpen() {
        const { contentEl } = this;
        const t = (key: string) => this.manager.translator.t(key);
        const modalEl = contentEl.parentElement;
        modalEl?.addClass("manager-confirm-modal");
        modalEl?.querySelector(".modal-close-button")?.remove();
        this.titleEl.parentElement?.addClass("manager-container__header");
        this.titleEl.setText(this.options.title || t("通用_确认_文本"));

        contentEl.empty();
        contentEl.addClass("manager-item-container");
        contentEl.createDiv({ cls: "manager-confirm-modal__message", text: this.options.message });

        const actionBar = new Setting(contentEl).setClass("manager-delete__action");
        actionBar.nameEl.empty();
        actionBar.descEl.empty();
        actionBar.addButton((button) => {
            button
                .setButtonText(this.options.cancelText || t("通用_取消_文本"))
                .onClick(() => this.finish(false));
        });
        actionBar.addButton((button: ButtonComponent) => {
            button
                .setCta()
                .setButtonText(this.options.confirmText || "OK")
                .onClick(() => this.finish(true));
            button.buttonEl.focus();
        });
    }

    onClose() {
        this.contentEl.empty();
        this.finish(false);
    }

    private finish(confirmed: boolean) {
        if (this.resolved) return;
        this.resolved = true;
        this.resolve(confirmed);
        this.close();
    }
}

export const confirmWithModal = (app: App, manager: Manager, options: ConfirmModalOptions | string): Promise<boolean> => {
    const modalOptions = typeof options === "string" ? { message: options } : options;
    return new Promise((resolve) => {
        new ManagerConfirmModal(app, manager, modalOptions, resolve).open();
    });
};

export const managerOpen = (dir: string, manager: Manager) => {
    if (Platform.isMobileApp) {
        new Notice(manager.translator.t("通用_移动端不支持打开文件夹_提示"));
        return;
    }

    shell.openPath(dir)
        .then((error) => {
            new Notice(manager.translator.t(error ? "通用_失败_文本" : "通用_成功_文本"));
        })
        .catch((error) => {
            console.error("打开目录失败", error);
            new Notice(manager.translator.t("通用_失败_文本"));
        });
};
