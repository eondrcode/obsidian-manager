/**
 * BPM Translator - 集成 i18n plus 框架
 * 
 * 改造后的翻译器支持：
 * 1. 内置词典（现有功能）
 * 2. 通过 i18n plus 动态加载外部词典
 */

import Manager from "main";
import zh_cn from './locale/zh_cn';
import en from "./locale/en";
import ru from "./locale/ru";
import ja from "./locale/ja";
import ko from "./locale/ko";
import fr from "./locale/fr";
import es from "./locale/es";

// i18n plus 框架类型定义（内联以避免依赖）
interface I18nPlusAPI {
    version: string;
    register(pluginId: string, translator: I18nPlusTranslatorInterface): void;
    unregister(pluginId: string): void;
    loadDictionary(pluginId: string, locale: string, dict: Record<string, unknown>): { valid: boolean };
    getRegisteredPlugins(): string[];
}

interface I18nPlusTranslatorInterface {
    pluginId: string;
    baseLocale: string;
    currentLocale: string;
    t(key: string, params?: Record<string, string | number>): string;
    loadDictionary(locale: string, dict: Record<string, unknown>): { valid: boolean };
    unloadDictionary(locale: string): void;
    setLocale(locale: string): void;
    getLocale(): string;
    getLoadedLocales(): string[];
    validateDictionary(dict: unknown): { valid: boolean };
}

declare global {
    interface Window {
        i18nPlus?: I18nPlusAPI;
    }
}

/** 基准词典类型 */
type BaseDictionary = typeof zh_cn;

export class Translator implements I18nPlusTranslatorInterface {
    private manager: Manager;

    // i18n plus 接口属性
    readonly pluginId = 'better-plugins-manager';
    readonly baseLocale = 'en';

    /**
     * 语言选择器显示的语言（仅限有内置翻译的）
     */
    public readonly language: Record<string, string> = {
        'zh': '简体中文',
        'zh-tw': '繁體中文',
        'en': 'English',
        'ru': 'Русский',
        'ja': '日本語',
        'ko': '한국어',
        'fr': 'français',
        'es': 'Español',
    };

    /**
     * Obsidian 官方支持的所有语言（用于识别外部词典）
     * 来源：https://github.com/obsidianmd/obsidian-translations
     */
    private readonly allLocales: Record<string, string> = {
        'en': 'English', 'af': 'Afrikaans', 'am': 'አማርኛ', 'ar': 'العربية',
        'az': 'Azərbaycan', 'be': 'Беларуская мова', 'bg': 'български език', 'bn': 'বাংলা',
        'ca': 'català', 'cs': 'čeština', 'da': 'Dansk', 'de': 'Deutsch',
        'dv': 'ދިވެހި', 'el': 'Ελληνικά', 'en-gb': 'English (GB)', 'eo': 'Esperanto',
        'es': 'Español', 'eu': 'Euskara', 'fa': 'فارسی', 'fi': 'suomi',
        'fr': 'français', 'ga': 'Gaeilge', 'gl': 'Galego', 'he': 'עברית',
        'hi': 'हिन्दी', 'hr': 'Hrvatski', 'hu': 'Magyar', 'id': 'Bahasa Indonesia',
        'it': 'Italiano', 'ja': '日本語', 'ka': 'ქართული', 'kh': 'ខេមរភាសា',
        'kn': 'ಕನ್ನಡ', 'ko': '한국어', 'ky': 'Кыргызча', 'la': 'Latina',
        'lt': 'Lietuvių', 'lv': 'Latviešu', 'ml': 'മലയാളം', 'ms': 'Bahasa Melayu',
        'nan-tw': '閩南語', 'ne': 'नेपाली', 'nl': 'Nederlands', 'nn': 'Nynorsk',
        'no': 'Norsk', 'oc': 'Occitan', 'or': 'ଓଡ଼ିଆ', 'pl': 'język polski',
        'pt': 'Português', 'pt-br': 'Português do Brasil', 'ro': 'Română', 'ru': 'Русский',
        'sa': 'संस्कृतम्', 'si': 'සිංහල', 'sk': 'Slovenčina', 'sl': 'Slovenščina',
        'sq': 'Shqip', 'sr': 'српски језик', 'sv': 'Svenska', 'sw': 'Kiswahili',
        'ta': 'தமிழ்', 'te': 'తెలుగు', 'th': 'ไทย', 'tl': 'Tagalog',
        'tr': 'Türkçe', 'tt': 'Татарча', 'uk': 'Українська', 'ur': 'اردو',
        'uz': 'oʻzbekcha', 'vi': 'Tiếng Việt', 'zh': '简体中文', 'zh-tw': '繁體中文',
    };

    /** 内置词典映射 */
    private readonly builtinLocaleMap: { [k: string]: Partial<BaseDictionary> } = {
        'zh': zh_cn,      // 简体中文
        'zh-tw': zh_cn,   // 繁体中文（回退到简体）
        'en': en,
        'ru': ru,
        'ja': ja,
        'ko': ko,
        'fr': fr,
        'es': es,
    };

    /** 动态加载的外部词典 */
    private externalDictionaries: Map<string, Partial<BaseDictionary>> = new Map();

    /** 当前语言 */
    private _currentLocale: string;

    constructor(manager: Manager) {
        this.manager = manager;
        this._currentLocale = this.normalizeLang(manager.settings.LANGUAGE || 'en');

        // 尝试注册到 i18n plus
        this.registerToI18nPlus();

        // 监听 i18n-plus 重新加载事件，自动重新注册
        window.addEventListener('i18n-plus:ready', () => {
            console.info('[BPM] Detected i18n-plus reload, re-registering...');
            this.registerToI18nPlus();
        });
    }

    get currentLocale(): string {
        return this._currentLocale;
    }

    set currentLocale(locale: string) {
        this._currentLocale = this.normalizeLang(locale);
    }

    /**
     * 注册到 i18n plus 框架
     * 使用轮询机制确保可靠注册
     */
    private registerToI18nPlus(): void {
        let attempts = 0;
        const maxAttempts = 10;
        const interval = 500; // 每 500ms 检测一次

        const tryRegister = () => {
            attempts++;
            if (window.i18nPlus) {
                window.i18nPlus.register(this.pluginId, this);
                console.info(`[BPM] Registered with i18n-plus (v${window.i18nPlus.version}) after ${attempts} attempt(s)`);
            } else if (attempts < maxAttempts) {
                setTimeout(tryRegister, interval);
            } else {
                console.debug('[BPM] i18n-plus not available after 10 attempts, using built-in translations only');
            }
        };

        // 首次尝试延迟 500ms，给 i18n-plus 加载时间
        setTimeout(tryRegister, interval);
    }

    /**
     * 从 i18n plus 注销
     */
    public unregisterFromI18nPlus(): void {
        if (window.i18nPlus) {
            window.i18nPlus.unregister(this.pluginId);
            console.info('[BPM] Unregistered from i18n-plus');
        }
    }

    /**
     * 翻译函数
     * 优先级：外部词典(原始locale) > 外部词典(规范化locale) > 内置词典 > 基准词典(en) > 兜底词典(zh_cn)
     */
    public t(str: keyof BaseDictionary, params?: Record<string, string | number>): string {
        const rawLanguage = (this.manager.settings.LANGUAGE || 'en').toLowerCase().replace('_', '-');
        const normalizedLanguage = this.normalizeLang(rawLanguage);

        let value: string | undefined;

        // 1. 尝试从外部词典获取（使用原始 locale，支持任意新语言）
        const externalDictRaw = this.externalDictionaries.get(rawLanguage);
        value = externalDictRaw?.[str];

        // 2. 如果原始 locale 没找到，尝试规范化后的 locale
        if (value === undefined && rawLanguage !== normalizedLanguage) {
            const externalDictNorm = this.externalDictionaries.get(normalizedLanguage);
            value = externalDictNorm?.[str];
        }

        // 3. 尝试从内置词典获取
        if (value === undefined) {
            const builtinDict = this.builtinLocaleMap[normalizedLanguage];
            value = builtinDict?.[str];
        }

        // 4. 回退到基准语言（英文）
        if (value === undefined) {
            value = (en as BaseDictionary)[str];
        }

        // 5. 最终兜底（中文）
        if (value === undefined) {
            value = zh_cn[str];
        }

        // 6. 如果仍然没有，返回 key
        if (value === undefined) {
            console.warn(`[BPM] Missing translation: ${str}`);
            return str;
        }

        // 6. 参数插值
        if (params) {
            return this.interpolate(value, params);
        }

        return value;
    }

    /**
     * 参数插值，支持 {key} 格式
     */
    private interpolate(text: string, params: Record<string, string | number>): string {
        return text.replace(/\{(\w+)\}/g, (match, key) => {
            const val = params[key];
            return val !== undefined ? String(val) : match;
        });
    }

    /**
     * 规范化语言代码
     * 将常见变体映射到 Obsidian 标准代码
     */
    private normalizeLang(lang: string): string {
        const lower = (lang || '').toLowerCase().replace('_', '-');

        // 语言别名映射
        const aliases: Record<string, string> = {
            'zh-cn': 'zh',
            'zh-hans': 'zh',
            'zh-hant': 'zh-tw',
            'pt-pt': 'pt',
        };

        // 检查是否是别名
        if (aliases[lower]) {
            return aliases[lower];
        }

        // 检查是否是有效的 Obsidian 语言代码（使用完整语言表）
        if (this.allLocales[lower]) {
            return lower;
        }

        // 尝试基础语言代码（去掉地区后缀）
        const base = lower.split('-')[0];
        if (this.allLocales[base]) {
            return base;
        }

        // 默认回退到英文
        return 'en';
    }

    // ========== i18n plus 接口实现 ==========

    /**
     * 加载外部词典
     * 注意：使用原始 locale（仅小写化），不进行 normalize，以支持任意新语言
     */
    loadDictionary(locale: string, dict: Record<string, unknown>): { valid: boolean; errors?: Array<{ key: string; message: string }> } {
        const result = this.validateDictionary(dict);

        if (!result.valid) {
            console.error(`[BPM] Invalid dictionary for ${locale}:`, result.errors);
            return result;
        }

        // 使用原始 locale（仅小写化和规范化分隔符），不做语言映射
        const rawLocale = locale.toLowerCase().replace('_', '-');
        this.externalDictionaries.set(rawLocale, dict as Partial<BaseDictionary>);
        console.info(`[BPM] Loaded external dictionary: ${rawLocale}`);

        return { valid: true };
    }

    /**
     * 卸载外部词典
     */
    unloadDictionary(locale: string): void {
        const normalizedLocale = this.normalizeLang(locale);
        if (this.externalDictionaries.has(normalizedLocale)) {
            this.externalDictionaries.delete(normalizedLocale);
            console.info(`[BPM] Unloaded external dictionary: ${normalizedLocale}`);
        }
    }

    /**
     * 设置当前语言
     */
    setLocale(locale: string): void {
        this._currentLocale = this.normalizeLang(locale);
        this.manager.settings.LANGUAGE = locale;
    }

    /**
     * 获取当前语言
     */
    getLocale(): string {
        return this._currentLocale;
    }

    /**
     * 获取已加载的语言列表（内置 + 外部）
     */
    getLoadedLocales(): string[] {
        const builtin = Object.keys(this.builtinLocaleMap);
        const external = Array.from(this.externalDictionaries.keys());
        return [...new Set([...builtin, ...external])];
    }

    /**
     * 获取内置语言列表（插件自带的翻译）
     */
    getBuiltinLocales(): string[] {
        return Object.keys(this.builtinLocaleMap);
    }

    /**
     * 获取外部导入的语言列表
     */
    getExternalLocales(): string[] {
        return Array.from(this.externalDictionaries.keys());
    }

    /**
     * 校验词典格式
     */
    validateDictionary(dict: unknown): { valid: boolean; errors?: Array<{ key: string; message: string }> } {
        const errors: Array<{ key: string; message: string }> = [];

        if (!dict || typeof dict !== 'object') {
            errors.push({ key: '$root', message: 'Dictionary must be an object' });
            return { valid: false, errors };
        }

        const d = dict as Record<string, unknown>;

        // 检查条目类型
        for (const [key, value] of Object.entries(d)) {
            if (key === '$meta') continue;
            if (typeof value !== 'string') {
                errors.push({ key, message: `Value must be string, got ${typeof value}` });
            }
        }

        return {
            valid: errors.length === 0,
            errors: errors.length > 0 ? errors : undefined,
        };
    }

    /**
     * 检查是否已连接 i18n plus
     */
    isConnectedToI18nPlus(): boolean {
        return window.i18nPlus?.getRegisteredPlugins().includes(this.pluginId) ?? false;
    }

    /**
     * 获取外部词典数量
     */
    getExternalDictionaryCount(): number {
        return this.externalDictionaries.size;
    }
}
