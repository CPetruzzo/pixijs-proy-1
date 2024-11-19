export const GameConfig = {
	// Tamaño de la celda de la grilla
	tileSize: 64, // Tamaño de cada celda en píxeles

	// Intervalo de tiempo entre cada aparición de enemigo
	spawnInterval: 1500, // Tiempo en milisegundos

	// Posiciones iniciales de las torres en el mapa
	towerPositions: [
		{ x: 1, y: 1 },
		{ x: 3, y: 1 },
		{ x: 5, y: 1 },
		{ x: 7, y: 7 },
	],

	// Tamaño del mapa
	gridWidth: 10, // Número de columnas
	gridHeight: 10, // Número de filas

	// Configuración para las torres (puedes personalizar la potencia, rango, etc.)
	towerConfig: {
		range: 3, // Rango de la torre en píxeles
		damage: 10, // Daño de la torre
		fireRate: 100, // Tasa de disparo (disparos por segundo)
	},

	// Enemigos y sus características (velocidad, salud, etc.)
	enemyConfig: {
		speed: 2, // Velocidad de los enemigos
		health: 100, // Salud base de los enemigos
	},

	// Colores para diferentes elementos del juego
	colors: {
		grid: 0x00ff00, // Color de la grilla
		tower: 0x00ff00, // Color de las torres
		enemy: 0xffffff, // Color de los enemigos
		bullet: 0x0000ff, // Color de las balas
	},
	initialPoints: 100, // Puntos iniciales del jugador
	towerCost: 50, // Costo de una torre
	pointsPerKill: 10, // Puntos ganados por matar un enemigo
};
