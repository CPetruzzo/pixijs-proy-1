import type { Achievement } from "../../../../engine/achievement/AchievementsManager";
import { AchievementsManager } from "../../../../engine/achievement/AchievementsManager";

// 1. Definimos la interfaz del estado
export interface RunFallGameState {
	coinsCurrent: number;
	coinsTotal: number;
	enemiesHit: number;
	obstaclesHit: number;
	potions: number;
	playerDied: boolean;
}

// 2. Definiciones (Incluyendo los Meteor que busca tu escena)
// eslint-disable-next-line @typescript-eslint/naming-convention
const RunFallDefinitions: Achievement<RunFallGameState>[] = [
	{
		id: "bounty_hunter_1",
		title: "Bounty Hunter",
		description: "Recoge 10 monedas en una partida.",
		icon: "achievement_coin_bronze", // Asegúrate que esta textura exista o usa una genérica
		unlocked: false,
		condition: (state) => state.coinsCurrent >= 10,
	},
	{
		id: "meteor_crasher_1",
		title: "Meteor Rookie",
		description: "Choca contra 1 enemigo.",
		icon: "achievement_meteor_bronze",
		unlocked: false,
		condition: (state) => state.enemiesHit >= 1,
	},
	{
		id: "meteor_crasher_2",
		title: "Meteor Pro",
		description: "Choca contra 2 enemigos.",
		icon: "achievement_meteor_silver",
		unlocked: false,
		condition: (state) => state.enemiesHit >= 2,
	},
	{
		id: "meteor_crasher_3",
		title: "Meteor Party!",
		description: "Choca contra 3 enemigos.",
		icon: "achievement_meteor_gold",
		unlocked: false,
		condition: (state) => state.enemiesHit >= 3,
	},
	{
		id: "immortal",
		title: "Survivor",
		description: "100 monedas acumuladas sin morir.",
		icon: "achievement_shield",
		unlocked: false,
		condition: (state) => state.coinsTotal >= 100 && !state.playerDied,
	},
];

// 3. Helper de inicialización (llamar en tu LoaderScene o Main)
export function initRunFallAchievements(): AchievementsManager<RunFallGameState> {
	const manager = AchievementsManager.getInstance<RunFallGameState>();
	manager.setup("runfall_achievements_v1", RunFallDefinitions);
	return manager;
}
