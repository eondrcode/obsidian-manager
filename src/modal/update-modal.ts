import { App, DropdownComponent, Modal, Notice, Setting } from "obsidian";
import Manager from "main";
import { ReleaseVersion } from "src/github-install";

export class UpdateModal extends Modal {
    private manager: Manager;
    private pluginId: string;
    private versions: ReleaseVersion[];
    private defaultVersion?: string | null;

    constructor(app: App, manager: Manager, pluginId: string, versions: ReleaseVersion[], defaultVersion?: string | null) {
        super(app);
        this.manager = manager;
        this.pluginId = pluginId;
        this.versions = versions;
        this.defaultVersion = defaultVersion;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        const title = contentEl.createEl("h3", { text: "选择版本" });
        title.style.marginBottom = "8px";

        let selected = this.defaultVersion || (this.versions[0]?.version ?? "");
        if (this.versions.length > 0) {
            new Setting(contentEl)
                .setName("版本")
                .addDropdown((dd: DropdownComponent) => {
                    this.versions.forEach(v => {
                        dd.addOption(v.version, `${v.version}${v.prerelease ? " (pre)" : ""}`);
                    });
                    dd.setValue(selected);
                    dd.onChange((v) => { selected = v; });
                });
        } else {
            const info = contentEl.createDiv();
            info.setText("未获取到版本列表，将尝试使用检测到的版本或最新版。");
        }

        new Setting(contentEl)
            .addButton((btn) => {
                btn.setButtonText("下载更新");
                btn.setCta();
                btn.onClick(async () => {
                    btn.setDisabled(true);
                    try {
                        const ok = await this.manager.downloadUpdate(this.pluginId, selected);
                        if (ok) {
                            new Notice("已下载并更新插件");
                            this.close();
                        }
                    } finally {
                        btn.setDisabled(false);
                    }
                });
            })
            .addButton((btn) => {
                btn.setButtonText("取消");
                btn.onClick(() => this.close());
            });
    }
}
