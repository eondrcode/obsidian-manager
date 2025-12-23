import { App, DropdownComponent, Modal, Notice, Setting } from "obsidian";
import Manager from "main";
import { ReleaseVersion, fetchReleaseVersions } from "src/github-install";

export class UpdateModal extends Modal {
    private manager: Manager;
    private pluginId: string;
    private versions: ReleaseVersion[];
    private defaultVersion?: string | null;
    private repo?: string;

    constructor(app: App, manager: Manager, pluginId: string, versions: ReleaseVersion[], defaultVersion?: string | null, repo?: string) {
        super(app);
        this.manager = manager;
        this.pluginId = pluginId;
        this.versions = versions;
        this.defaultVersion = defaultVersion;
        this.repo = repo;
    }

    async onOpen() {
        const { contentEl } = this;
        const t = (k: any) => this.manager.translator.t(k);
        contentEl.empty();

        const title = contentEl.createEl("h3", { text: t("管理器_选择版本_标题") });
        title.style.marginBottom = "8px";

        let versionList = [...this.versions];
        if (versionList.length === 0 && this.repo) {
            const loading = contentEl.createDiv();
            loading.setText(t("管理器_选择版本_获取中"));
            try {
                versionList = await fetchReleaseVersions(this.manager, this.repo);
            } catch (e) {
                console.error("fetch versions in modal failed", e);
                new Notice(t("管理器_选择版本_获取失败提示"), 4000);
            } finally {
                loading.remove();
            }
            this.versions = versionList;
        }

        let selected = this.defaultVersion || (versionList[0]?.version ?? "");
        if (versionList.length > 0) {
            new Setting(contentEl)
                .setName(t("管理器_选择版本_版本_标题"))
                .addDropdown((dd: DropdownComponent) => {
                    versionList.forEach(v => {
                        dd.addOption(v.version, `${v.version}${v.prerelease ? " (pre)" : ""}`);
                    });
                    dd.setValue(selected);
                    dd.onChange((v) => { selected = v; });
                });
        } else {
            const info = contentEl.createDiv();
            info.setText(t("管理器_选择版本_无版本提示"));
        }

        new Setting(contentEl)
            .addButton((btn) => {
                btn.setButtonText(t("管理器_选择版本_下载按钮"));
                btn.setCta();
                btn.onClick(async () => {
                    btn.setDisabled(true);
                    try {
                        const ok = await this.manager.downloadUpdate(this.pluginId, selected);
                        if (ok) {
                            new Notice(t("管理器_选择版本_成功提示"), 3000);
                            this.close();
                        }
                    } finally {
                        btn.setDisabled(false);
                    }
                });
            })
            .addButton((btn) => {
                btn.setButtonText(t("通用_取消_文本"));
                btn.onClick(() => this.close());
            });
    }
}

