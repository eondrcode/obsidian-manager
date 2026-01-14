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
export const BPM_TAG_ID = "bpm-managed"; // BPM 管理标识
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