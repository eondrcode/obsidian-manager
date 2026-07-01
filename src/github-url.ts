import type Manager from "main";

export const DEFAULT_GITHUB_PROXY = "";

const GITHUB_HOSTS = new Set([
	"github.com",
	"api.github.com",
	"raw.githubusercontent.com",
	"objects.githubusercontent.com",
	"release-assets.githubusercontent.com",
	"codeload.github.com",
]);

export const normalizeGithubProxy = (value?: string | null): string => {
	const proxy = (value || "").trim();
	if (!proxy || /^official$/i.test(proxy) || /^github$/i.test(proxy)) return "";
	return proxy;
};

export const isGithubUrl = (url: string): boolean => {
	try {
		return GITHUB_HOSTS.has(new URL(url).hostname.toLowerCase());
	} catch {
		return false;
	}
};

export const rewriteGithubUrl = (url: string, proxy?: string | null): string => {
	const normalizedProxy = normalizeGithubProxy(proxy);
	if (!normalizedProxy || !isGithubUrl(url)) return url;

	const encodedUrl = encodeURIComponent(url);
	if (normalizedProxy.includes("{encodedUrl}")) return normalizedProxy.replace(/\{encodedUrl\}/g, encodedUrl);
	if (normalizedProxy.includes("{url}")) return normalizedProxy.replace(/\{url\}/g, url);

	const prefix = normalizedProxy.replace(/\/+$/g, "");
	return `${prefix}/${url}`;
};

export const getGithubProxy = (manager: Manager): string =>
	normalizeGithubProxy(manager.settings.GITHUB_PROXY);

export const githubProxyEnabled = (manager: Manager): boolean =>
	Boolean(getGithubProxy(manager));

export const resolveGithubUrl = (manager: Manager, url: string): string =>
	rewriteGithubUrl(url, getGithubProxy(manager));
