import Manager from "main";
import zh_cn from './locale/zh_cn';
import en from "./locale/en";
import ru from "./locale/ru";
import ja from "./locale/ja";
import ko from "./locale/ko";
import fr from "./locale/fr";
import es from "./locale/es";

export class Translator {
	private manager: Manager;
	public language = {
		'zh-cn': '简体中文',
		'en': 'English',
		'ru': 'Русский язык',
		'ja': '日本語',
		'ko': '한국어',
		'fr': 'Français',
		'es': 'Español',
	};

	private localeMap: { [k: string]: Partial<typeof zh_cn> } = {
		'zh-cn': zh_cn,
		'en': en,
		'ru': ru,
		'ja': ja,
		'ko': ko,
		'fr': fr,
		'es': es,
	};

	constructor(manager: Manager) {
		this.manager = manager;
	}

	// 方法用于获取翻译后的字符串
	public t(str: keyof typeof zh_cn): string {
		// 基准语言使用英文：缺失翻译时优先回退到英文，再回退到中文兜底
		const language = this.normalizeLang(this.manager.settings.LANGUAGE || 'en');
		const locale = this.localeMap[language] || en;
		const base: any = en;
		const fallback: any = zh_cn;
		return (locale as any)[str] || base[str] || fallback[str];
	}

	private normalizeLang(lang: string): string {
		const lower = (lang || '').toLowerCase().replace('_', '-');
		const map: Record<string, string> = {
			// Official mappings we support
			'en': 'en',
			'en-gb': 'en',
			'zh': 'zh-cn',
			'zh-cn': 'zh-cn',
			'zh-tw': 'zh-cn',
			'ru': 'ru',
			'ja': 'ja',
			'ko': 'ko',
			'fr': 'fr',
			'es': 'es',
		};
		return map[lower] || map[lower.split('-')[0]] || 'en';
	}
}

// import { moment } from "obsidian";
// import zh_cn from './locale/zh_cn';
// import en from "./locale/en";
// import ja_jp from "./locale/ja_jp";
// import ko_kr from "./locale/ko_kr";
// import ru_ru from "./locale/ru_ru";

// export const LANGUAGE = {
// 	'zh-cn': '简体中文',
// 	'en': '永不展开'
// }

// const localeMap: { [k: string]: Partial<typeof zh_cn> } = {
// 	'zh-cn': zh_cn,
// 	'en-us': en,
// 	'ja-jp': ja_jp,
// 	'ko-kr': ko_kr,
// 	'ru-ru': ru_ru
// };

// // const locales = moment.locales();
// // console.log(locales);
// // console.log(moment.locale())
// const locale = localeMap[moment.locale()];

// export function t(str: keyof typeof zh_cn): string {
// 	return (locale && locale[str]) || zh_cn[str];
// }
