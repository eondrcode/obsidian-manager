export interface ManagerPlugin {
	id: string;
	name: string;
	desc: string;
	group: string;
	tags: string[];
	enabled: boolean;
	delay: string;
	note: string;
}

export interface Type {
	id: string;
	name: string;
	color: string;
}

export interface Tag {
	id: string;
	name: string;
	color: string;
}

// 已知的特殊 Tag
export const BPM_TAG_ID = "bpm-install"; // BPM 安装标识
export const BPM_IGNORE_TAG = "bpm-ignore"; // BPM 忽略标识

export interface Delay {

	id: string;
	name: string;
	time: number;
}

export interface RibbonItem {
	id: string;
	name: string;
	icon: string;
	visible: boolean;
	order: number;
}

export interface PluginLayoutItem {
	id: string;
	type: "plugin" | "separator";
	title?: string;
}

export interface BetaSource {
	id: string;
	repo: string;
	type: "plugin" | "theme";
	mode: "latest" | "frozen";
	frozenVersion?: string;
	autoUpdate: boolean;
	enabled: boolean;
	localVersion?: string;
	latestVersion?: string;
	lastChecked?: number;
	error?: string;
}

export interface InstallHistoryItem {
	repo: string;
	type: "plugin" | "theme";
	version?: string;
	trackSource?: boolean;
	usedAt?: number;
}

export interface SharedVaultEntry {
	id: string;
	name: string;
	path: string;
	pluginsLinked?: boolean;
	themesLinked?: boolean;
	createdAt: number;
	lastSeenAt?: number;
}
