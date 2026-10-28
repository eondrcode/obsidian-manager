import { setIcon } from 'obsidian';
import type Manager from '../main';
import { DEVICE_TYPES, DeviceScope, ScopePage, scopeKey } from './device-presets';

/**
 * 三栏共用的预设选择器：按设备类型分组列出命名预设，复用管理器筛选栏的自定义下拉。
 * Shared preset selector grouped by device type, built from the manager's own dropdown.
 */
export class DeviceScopeBar {
    private closeMenu: (() => void) | null = null;

    constructor(private readonly manager: Manager, private readonly onChange: () => void) {}

    render(container: HTMLElement, page: ScopePage, inline = false): void {
        this.closeMenu?.();
        this.closeMenu = null;
        const devices = this.manager.devices;
        const t = (key: string, vars?: Record<string, string | number>) => this.manager.translator.t(key, vars);
        const enabled = Boolean(this.manager.settings.DEVICE_MANAGEMENT?.enabled);
        const scope = devices.selectedScope(page);
        const description = enabled
            ? (devices.isLiveScope(scope) ? t('设备_作用域本机说明', { scope: devices.scopeLabel(scope) }) : t('设备_作用域其他说明', { scope: devices.scopeLabel(scope) }))
            : t('设备_作用域未启用');

        // 插件页把选择器直接放进搜索行；其他栏目沿用独立一行。
        const host = inline ? container : container.createDiv('manager-device-scope');
        if (inline) {
            container.empty();
            container.addClass('manager-device-scope');
            container.addClass('manager-device-scope--inline');
        }
        const field = inline
            ? host.createDiv('manager-filter-field manager-filter-field--select')
            : (host.createDiv('manager-search-line')).createDiv('manager-filter-field manager-filter-field--select manager-filter-field--sort');
        field.setAttribute('title', description);
        field.setAttribute('aria-label', description);
        const label = field.createDiv('manager-filter-field__label');
        const iconEl = label.createSpan('manager-filter-field__icon');
        setIcon(iconEl, 'monitor-smartphone');
        label.createSpan({ cls: 'manager-filter-field__text', text: t('设备_作用域短') });
        const control = field.createDiv('manager-filter-field__control');
        const group = control.createDiv('manager-filter-select-group');

        const root = group.createDiv('manager-multiselect-filter');
        const trigger = root.createEl('button', { cls: 'manager-multiselect-filter__trigger' });
        trigger.type = 'button';
        trigger.setAttribute('aria-haspopup', 'listbox');
        trigger.setAttribute('aria-expanded', 'false');
        trigger.setAttribute('aria-label', `${t('设备_作用域短')}: ${devices.scopeLabel(scope)}`);
        trigger.createSpan({ cls: 'manager-multiselect-filter__summary', text: devices.scopeLabel(scope) });
        if (enabled) {
            // 一眼区分“本机正在使用”与“只保存到其他预设”。
            trigger.createSpan({
                cls: 'manager-multiselect-filter__count',
                text: devices.isLiveScope(scope) ? t('设备_本机') : t('设备_仅保存'),
            });
        } else {
            trigger.createSpan({ cls: 'manager-multiselect-filter__count', text: t('设备_未启用_短') });
        }
        setIcon(trigger.createSpan('manager-multiselect-filter__chevron'), 'chevron-down');
        trigger.disabled = !enabled;

        const menu = root.createDiv('manager-multiselect-filter__menu');
        menu.setAttribute('role', 'listbox');
        const sectionEl = root.closest('.manager-section--filters');
        const containerEl = root.closest('.manager-container');
        let open = false;

        const close = () => {
            if (!open) return;
            open = false;
            root.removeClass('is-open');
            menu.removeClass('is-fixed');
            menu.setCssStyles({ top: '', bottom: '', left: '', minWidth: '' });
            field.removeClass('is-filter-menu-open');
            sectionEl?.removeClass('is-filter-menu-open');
            containerEl?.removeClass('has-open-filter-menu');
            trigger.setAttribute('aria-expanded', 'false');
            activeDocument.removeEventListener('click', onDocumentClick);
            activeDocument.removeEventListener('scroll', onScroll, true);
            window.removeEventListener('resize', close);
        };
        const onDocumentClick = () => { close(); };
        // 菜单自身滚动不应触发关闭；祖先容器滚动才关闭。
        const onScroll = (event: Event) => {
            if (event.target instanceof Node && menu.contains(event.target)) return;
            close();
        };
        this.closeMenu = close;

        const toggle = () => {
            if (open) { close(); return; }
            open = true;
            // 菜单挂在滚动容器里会被裁剪，打开时改为固定定位到触发按钮下方。
            const rect = trigger.getBoundingClientRect();
            // 下方空间不足时向上展开，避免菜单超出视口。
            const openUp = window.innerHeight - rect.bottom < 220 && rect.top > 220;
            menu.addClass('is-fixed');
            menu.setCssStyles({
                top: openUp ? '' : `${rect.bottom + 4}px`,
                bottom: openUp ? `${window.innerHeight - rect.top + 4}px` : '',
                left: `${rect.left}px`,
                minWidth: `${Math.max(220, rect.width)}px`,
            });
            root.addClass('is-open');
            field.addClass('is-filter-menu-open');
            sectionEl?.addClass('is-filter-menu-open');
            containerEl?.addClass('has-open-filter-menu');
            trigger.setAttribute('aria-expanded', 'true');
            window.setTimeout(() => activeDocument.addEventListener('click', onDocumentClick), 0);
            activeDocument.addEventListener('scroll', onScroll, true);
            window.addEventListener('resize', close);
        };
        trigger.addEventListener('click', (event) => { event.stopPropagation(); toggle(); });
        root.addEventListener('click', (event) => event.stopPropagation());
        root.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') { event.preventDefault(); close(); }
        });

        const addOption = (entry: DeviceScope, name: string) => {
            const selected = entry.presetId === scope.presetId;
            const option = menu.createEl('button', { cls: 'manager-multiselect-filter__option' });
            option.type = 'button';
            option.setAttribute('role', 'option');
            option.setAttribute('aria-selected', `${selected}`);
            option.toggleClass('is-selected', selected);
            setIcon(option.createSpan('manager-multiselect-filter__check'), selected ? 'check' : 'circle');
            option.createSpan({ cls: 'manager-multiselect-filter__option-label', text: name });
            if (!enabled) option.disabled = true;
            option.addEventListener('click', () => {
                close();
                if (selected) return;
                void devices.selectScope(page, scopeKey(entry.presetId)).then(() => this.onChange()).catch(error => devices.report(error));
            });
        };

        for (const type of DEVICE_TYPES) {
            const presets = devices.presetsFor(type);
            const row = menu.createDiv('manager-filter-field__text');
            row.setText(devices.label(type));
            row.addClass('manager-device-scope__group');
            for (const preset of presets) {
                addOption({ key: scopeKey(preset.id), type, presetId: preset.id },
                    `${preset.name}${preset.id === devices.boundPresetId ? ` (${t('设备_本机')})` : ''}`);
            }
        }
    }
}

export type DeviceScopePage = ScopePage;
export type { DeviceScope };
