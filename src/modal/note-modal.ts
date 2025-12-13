import {
    App,
    ExtraButtonComponent,
    Modal,
    Setting,
    TextAreaComponent,
} from "obsidian";
import { ManagerSettings } from "../settings/data";
import Manager from "main";
import { ManagerPlugin } from "src/data/types";
import { ManagerModal } from "./manager-modal";

export class NoteModal extends Modal {
    settings: ManagerSettings;
    manager: Manager;
    managerPlugin: ManagerPlugin;
    managerModal: ManagerModal;

    constructor(app: App, manager: Manager, managerPlugin: ManagerPlugin, managerModal: ManagerModal) {
        super(app);
        this.settings = manager.settings;
        this.manager = manager;
        this.managerPlugin = managerPlugin;
        this.managerModal = managerModal;
    }

    private async showHead() {
        //@ts-ignore
        const modalEl: HTMLElement = this.contentEl.parentElement;
        modalEl.addClass("manager-note__container");
        modalEl.removeChild(modalEl.getElementsByClassName("modal-close-button")[0]);
        this.titleEl.parentElement?.addClass("manager-container__header");
        this.contentEl.addClass("manager-item-container");
        // [标题行]
        const titleBar = new Setting(this.titleEl).setClass("manager-bar__title").setName(`${this.managerPlugin.name}`);
        // [标题行] 关闭按钮
        const closeButton = new ExtraButtonComponent(titleBar.controlEl);
        closeButton.setIcon("circle-x");
        closeButton.onClick(() => this.close());
    }

    private async showData() {
        const textArea = new TextAreaComponent(this.contentEl);
        textArea.setValue(this.managerPlugin.note);
        textArea.onChange(async (newValue) => {
            this.managerPlugin.note = newValue;
            await this.manager.savePluginAndExport(this.managerPlugin.id);
            this.managerModal.reloadShowData();
        });
    }

    private async reloadShowData() {
        let scrollTop = 0;
        const modalElement: HTMLElement = this.contentEl;
        scrollTop = modalElement.scrollTop;
        modalElement.empty();
        await this.showData();
        modalElement.scrollTo(0, scrollTop);
    }

    async onOpen() {
        await this.showHead();
        await this.showData();
    }

    async onClose() {
        this.contentEl.empty();
    }
}
