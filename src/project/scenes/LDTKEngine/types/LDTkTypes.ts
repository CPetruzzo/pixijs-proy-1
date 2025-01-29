export interface LDTkLevel {
	layers: LDTkLayer[];
}

export interface LDTkLayer {
	identifier: string;
	type: "Tiles" | "Entities";
	gridTiles?: LDTkGridTile[];
	entityInstances?: LDTkEntity[];
}

export interface LDTkGridTile {
	px: [number, number];
	src: [number, number];
}

export interface LDTkEntity {
	x: number;
	y: number;
	width: number;
	height: number;
	identifier: string;
}
