/* eslint-disable @typescript-eslint/naming-convention */

/** Enum con todas tus escenas */
export enum SceneKey {
	TopDownProtoScene,
	BromatoHeroScene,
	RAPIER_SideScrollerScene,
	// RUNFALL
	RUNFALL_MenuScene,
	RUNFALL_SelectorScene,
	RUNFALL_GameScene,

	// SOUL
	SOUL_IntroScene,
	SOUL_GameScene,
	SOUL_DruidScene,

	// HORROR
	HORROR_AHHomeScene,

	// AURORA
	AURORA_MapScene,

	// TOWER DEFENSE
	TOWER_DefenseScene,

	// BASQUETBALL
	BASQUET_MainScene,

	// JUBILPOSTOR
	JUBIL_HomeScene,

	// TETRIS
	TETRIS_Scene,
	PUZZLE_Scene,

	// 3D DEMO
	DEMO_3DScene,

	// COFFEE
	COFFEE_ShopScene,

	// ASTAR
	ASTAR_Scene,

	// CACHO WORLD
	CACHO_MultiplayerScene,

	// DAY AND NIGHT
	DAYANDNIGHT_Scene,

	// MUSIC
	MUSIC_PianoGameScene,
	MUSIC_GuitarGameScene,

	// CACHO MENU
	CACHO_MenuScene,

	// GAMBLING
	GAMBLING_GameScene,

	DIALOG_Scene,
	ALGORITHM_ASTARScene,
	ALGORITHM_WEIGHTEDScene,
	LEVELSELECT_Scene,
}

/**
 * Registry: cada entry es una función que devuelve una Promise.
 * Importante: devolvemos un objeto con una key que contenga "Scene"
 * para que SceneManager.extractSceneFromPromise lo encuentre.
 */
export const SceneRegistry: Record<SceneKey, () => Promise<any>> = {
	[SceneKey.RUNFALL_MenuScene]: () =>
		import("./project/scenes/RunFall/Scenes/MenuScene").then((m) => ({
			RunFall_MenuScene: m.MenuScene,
		})),
	[SceneKey.RUNFALL_GameScene]: () =>
		import("./project/scenes/RunFall/Scenes/DodgeScene").then((m) => ({
			RunFall_GameScene: m.DodgeScene,
		})),

	[SceneKey.RUNFALL_SelectorScene]: () =>
		import("./project/scenes/RunFall/Scenes/CharacterSelectorScene").then((m) => ({
			RunFall_GameScene: m.CharacterSelectorScene,
		})),

	[SceneKey.SOUL_IntroScene]: () =>
		import("./project/scenes/Soul/IntroScene").then((m) => ({
			Soul_IntroScene: m.IntroScene,
		})),
	[SceneKey.SOUL_GameScene]: () =>
		import("./project/scenes/Soul/SoulMountainScene").then((m) => ({
			Soul_MountainScene: m.SoulMountainScene,
		})),
	[SceneKey.SOUL_DruidScene]: () =>
		import("./project/scenes/Soul/DruidHouseScene").then((m) => ({
			Soul_DruidHouseScene: m.DruidHouseScene,
		})),

	[SceneKey.HORROR_AHHomeScene]: () =>
		import("./project/scenes/AbandonedShelter/AHHomeScene").then((m) => ({
			Horror_AHHomeScene: m.AHHomeScene,
		})),

	[SceneKey.AURORA_MapScene]: () =>
		import("./project/scenes/Aurora/Scenes/AuroraQuilmesMapScene").then((m) => ({
			Aurora_MapScene: m.AuroraQuilmesMapScene,
		})),

	[SceneKey.TOWER_DefenseScene]: () =>
		import("./project/scenes/TowerDefenseGame/scenes/TowerDefenseScene").then((m) => ({
			Tower_DefenseScene: m.TowerDefenseScene,
		})),

	[SceneKey.BASQUET_MainScene]: () =>
		import("./project/scenes/BasquetballGame/BasquetballMainScene").then((m) => ({
			Basquet_MainScene: m.BasquetballMainScene,
		})),

	[SceneKey.JUBIL_HomeScene]: () =>
		import("./project/scenes/Jubilpostor/JubilpostorHomeScene").then((m) => ({
			Jubil_HomeScene: m.JubilpostorHomeScene,
		})),

	[SceneKey.TETRIS_Scene]: () =>
		import("./project/scenes/Tetris/TetrisScene").then((m) => ({
			Tetris_Scene: m.TetrisScene,
		})),
	[SceneKey.PUZZLE_Scene]: () =>
		import("./project/scenes/Tetris/PuzzleBobbleScene").then((m) => ({
			Tetris_Scene: m.PuzzleBobbleScene,
		})),

	[SceneKey.DEMO_3DScene]: () =>
		import("./project/scenes/3dgame/Scene3D").then((m) => ({
			Demo_3DScene: m.Scene3D,
		})),

	[SceneKey.COFFEE_ShopScene]: () =>
		import("./project/scenes/CoffeeGame/CoffeeGameScene").then((m) => ({
			Coffee_ShopScene: m.CoffeeShopScene,
		})),

	[SceneKey.ASTAR_Scene]: () =>
		import("./project/scenes/AStarAlgorithm/AStarScene").then((m) => ({
			AStar_Scene: m.AStarScene,
		})),

	[SceneKey.CACHO_MultiplayerScene]: () =>
		import("./project/scenes/CachoWorld/Scenes/MultiplayerCachoWorldGameScene").then((m) => ({
			Cacho_MultiplayerScene: m.MultiplayerCachoWorldGameScene,
		})),

	[SceneKey.DAYANDNIGHT_Scene]: () =>
		import("./project/scenes/DayAndNight/DayAndNight").then((m) => ({
			DayAndNighScene: m.DayAndNight,
		})),

	[SceneKey.MUSIC_PianoGameScene]: () =>
		import("./project/scenes/PulseHeist/Piano").then((m) => ({
			MUSIC_PianoGameScene: m.PianoGameScene,
		})),
	[SceneKey.MUSIC_GuitarGameScene]: () =>
		import("./project/scenes/PulseHeist/GuitarHero").then((m) => ({
			MUSIC_GuitarGameScene: m.GuitarHeroScene,
		})),

	[SceneKey.CACHO_MenuScene]: () =>
		import("./project/scenes/CachoMenuScene").then((m) => ({
			CACHO_MenuScene: m.CachoMenuScene,
		})),

	[SceneKey.GAMBLING_GameScene]: () =>
		import("./project/scenes/GamblingGame/SlotMonster").then((m) => ({
			GAMBLING_GameScene: m.SlotMonster,
		})),

	[SceneKey.DIALOG_Scene]: () =>
		import("./project/scenes/DialogueScene").then((m) => ({
			GAMBLING_GameScene: m.DialogueScene,
		})),

	[SceneKey.ALGORITHM_ASTARScene]: () =>
		import("./project/scenes/AlgorithmAStar").then((m) => ({
			ALGORITHM_ASTARScene: m.AStarScene,
		})),

	[SceneKey.ALGORITHM_WEIGHTEDScene]: () =>
		import("./project/scenes/WorldMap/WorldMap").then((m) => ({
			ALGORITHM_ASTARScene: m.RandomWorldMap,
		})),

	[SceneKey.TopDownProtoScene]: () =>
		import("./project/scenes/TopDownProtoScene").then((m) => ({
			ALGORITHM_ASTARScene: m.TopDownProtoScene,
		})),

	[SceneKey.LEVELSELECT_Scene]: () =>
		import("./project/scenes/LevelSelectScene").then((m) => ({
			ALGORITHM_ASTARScene: m.LevelSelectScene,
		})),

	[SceneKey.BromatoHeroScene]: () =>
		import("./project/scenes/CoffeeGame/BromatoHeroScene").then((m) => ({
			BromatoHeroScene: m.BromatoHeroScene,
		})),

	[SceneKey.RAPIER_SideScrollerScene]: () =>
		import("./project/scenes/Rapier3D/SideScrollerScene").then((m) => ({
			SideScrollerScene: m.SideScrollerScene,
		})),
};
