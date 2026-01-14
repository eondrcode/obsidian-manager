export interface ManagerPlugin {
	id: string;
	name: string;
	desc: string;
	group: string;
	tags: string[];
	enabled: boolean;
	delay: string;
	note:string;
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