import { Notice, Platform } from 'obsidian';
import Manager from 'main';

/**
 * 打开文件或文件夹的操作系统命令。
 * @param i18n - 国际化对象，用于显示操作结果的通知。
 * @param dir - 要打开的文件夹路径。
 * @description 根据操作系统执行相应的命令来打开文件夹。在Windows上使用'start'命令，在Mac上使用'open'命令。
 * 如果操作成功，显示成功通知；如果失败，显示错误通知。
 */
export const managerOpen = (dir: string, manager: Manager) => {
	if (Platform.isMobileApp) {
		new Notice(manager.translator.t("通用_移动端不支持打开文件夹_提示"));
		return;
	}
	try {
		// 延迟加载避免移动端加载 Node 模块
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const { exec } = require('child_process');
		if (Platform.isDesktop || Platform.isWin) {
			exec(`start "" "${dir}"`, (error: any) => {
				if (error) { new Notice(manager.translator.t('通用_失败_文本')); } else { new Notice(manager.translator.t('通用_成功_文本')); }
			});
			return;
		}
		if (Platform.isMacOS) {
			exec(`open ${dir}`, (error: any) => {
				if (error) { new Notice(manager.translator.t('通用_失败_文本')); } else { new Notice(manager.translator.t('通用_成功_文本')); }
			});
		}
	} catch (e) {
		console.error("打开目录失败", e);
		new Notice(manager.translator.t('通用_失败_文本'));
	}
}
