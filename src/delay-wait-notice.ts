import { Notice } from 'obsidian';

type Translate = (key: string, vars?: Record<string, string | number>) => string;

/**
 * 延迟启动倒计时提示：仿 AstroScope 的 WaitMessage.js。
 * 调用方只提供剩余秒数与信息文本；信息里可用 {seconds} 占位符。
 *
 * Countdown notice modelled on AstroScope's WaitMessage.js. The caller supplies the
 * remaining seconds and an info string; `{seconds}` is substituted into the template.
 */
export class DelayWaitNotice {
    private notice: Notice | null = null;
    private timer: number | null = null;
    private hideTimer: number | null = null;
    private seconds = 0;
    private info = '';
    private template = '';
    private finished = false;

    constructor(private readonly t: Translate) {}

    get running(): boolean { return this.notice !== null; }

    /**
     * 秒数是象征性变量：template 提供时按它渲染，否则使用默认「信息 + 剩余秒数」模板。
     * The caller supplies seconds and either an info string or a full `{seconds}` template.
     */
    start(seconds: number, info: string, template = ''): void {
        this.stop();
        if (seconds <= 0) return;
        this.seconds = Math.ceil(seconds);
        this.info = info.trim();
        this.template = template.trim();
        this.finished = false;
        this.notice = new Notice(this.format(this.seconds), 0);
        this.timer = window.setInterval(() => this.tick(), 1000);
    }

    /** 提前结束（插件都已启动或功能被关闭）。 */
    finish(): void {
        if (!this.notice || this.finished) return;
        this.finished = true;
        this.clearTimer();
        const stripped = this.template ? this.template.replace(/\{seconds\}/g, '').trim() : this.info;
        const info = stripped || this.t('延迟_等待_名称');
        this.notice.setMessage(this.t('延迟_等待_完成', { info }));
        this.hideTimer = window.setTimeout(() => this.stop(), 1200);
    }

    stop(): void {
        this.clearTimer();
        if (this.hideTimer !== null) {
            window.clearTimeout(this.hideTimer);
            this.hideTimer = null;
        }
        this.notice?.hide();
        this.notice = null;
        this.finished = false;
    }

    private tick(): void {
        this.seconds -= 1;
        if (!this.notice) return;
        // 用户手动关闭通知后停止计时，避免继续写入已移除的元素。
        const el = (this.notice as unknown as { noticeEl?: HTMLElement }).noticeEl;
        if (el && !el.isConnected) { this.stop(); return; }
        if (this.seconds > 0) {
            this.notice.setMessage(this.format(this.seconds));
            return;
        }
        this.finish();
    }

    private format(seconds: number): string {
        // 自定义模板完全接管文案；否则使用「信息 · 剩余秒数」。
        if (this.template) return this.template.replace(/\{seconds\}/g, `${seconds}`);
        return this.t('延迟_等待_信息', { info: this.info, seconds });
    }

    private clearTimer(): void {
        if (this.timer !== null) {
            window.clearInterval(this.timer);
            this.timer = null;
        }
    }
}
