import { Menu, getIconIds, setIcon } from 'obsidian';
import type Manager from '../main';
import type { RibbonGroup } from '../data/types';
import type { LeftRibbonLike, RibbonNativeItem } from '../obsidian-internals';
import { normalizeRibbonGroups } from '../devices/device-presets';

/** Native Ribbon group lifecycle / 原生 Ribbon 分组图标的生命周期。 */
export class RibbonGroups {
    private buttons = new Map<string, HTMLElement>();
    constructor(private readonly manager: Manager) {}

    sync(ribbon: LeftRibbonLike): void {
        const groups = normalizeRibbonGroups(this.manager.settings.RIBBON_GROUPS);
        const active = new Set(groups.filter(group => group.members.length).map(group => group.id));
        for (const [id, button] of this.buttons) {
            if (active.has(id)) continue;
            const index = ribbon.items?.findIndex(item => item?.buttonEl === button) ?? -1;
            if (index >= 0) ribbon.items?.splice(index, 1);
            button.remove();
            this.buttons.delete(id);
        }
        const icons = new Set(getIconIds());
        for (const group of groups) {
            if (!active.has(group.id)) continue;
            const icon = icons.has(group.icon) ? group.icon : 'folder';
            const existing = this.buttons.get(group.id);
            if (existing) {
                setIcon(existing, icon);
                existing.setAttr('aria-label', group.name);
                continue;
            }
            const button = this.manager.addRibbonIcon(icon, group.name, event => this.open(group.id, event));
            this.buttons.set(group.id, button);
        }
    }

    isGroupItem(item: RibbonNativeItem): boolean {
        return [...this.buttons.values()].some(button => item.buttonEl === button);
    }

    groupOf(uniqueId: string): RibbonGroup | undefined {
        return this.manager.settings.RIBBON_GROUPS.find(group => group.members.includes(uniqueId));
    }

    private open(id: string, event: MouseEvent): void {
        const group = this.manager.settings.RIBBON_GROUPS.find(entry => entry.id === id);
        const ribbon = (this.manager.app.workspace as typeof this.manager.app.workspace & { leftRibbon?: LeftRibbonLike }).leftRibbon;
        if (!group || !ribbon?.items) return;
        const menu = new Menu();
        for (const member of group.members) {
            const setting = this.manager.settings.RIBBON_SETTINGS.find(item => item.bpmUniqueId === member);
            if (!setting?.visible) continue;
            const native = ribbon.items.find(item => item && !this.isGroupItem(item)
                && (Object.values(setting.ribbonIdMap ?? {}).includes(item.id ?? '')
                    || item.id === setting.bpmUniqueId));
            if (!native?.callback) continue;
            menu.addItem(item => item.setTitle(setting.name).setIcon(setting.icon || 'circle')
                .onClick(() => { native.callback?.(event); }));
        }
        menu.showAtMouseEvent(event);
    }
}
