// CollisionUtils.ts

export interface AABB {
	min: { x: number; y: number; z: number };
	max: { x: number; y: number; z: number };
}

export interface ITransform3D {
	position: { x: number; y: number; z: number };
	scale: { x: number; y: number; z: number };
	rotationQuaternion: { x: number; y: number; z: number; w: number };
}

/**
 * Retorna true si los dos AABB se intersectan.
 */
export function intersect(a: AABB, b: AABB): boolean {
	return a.min.x <= b.max.x && a.max.x >= b.min.x && a.min.y <= b.max.y && a.max.y >= b.min.y && a.min.z <= b.max.z && a.max.z >= b.min.z;
}

/**
 * Convierte un ITransform3D (que representa un OBB) en un AABB envolvente.
 * Se asume que la posición es el centro del objeto y que la escala es el tamaño total.
 * (En tu caso, la escala se usa completa, sin dividir.)
 */
export function getAABB(transform: ITransform3D): AABB {
	const { position, scale, rotationQuaternion } = transform;
	// Usamos la escala completa (sin dividir) según lo que dijiste que funciona para colisiones con paredes.
	const halfExtents = {
		x: scale.x,
		y: scale.y,
		z: scale.z,
	};

	// Extraer el quaternion
	const { x, y, z, w } = rotationQuaternion;

	// Calcular la matriz de rotación (3x3)
	const m00 = 1 - 2 * (y * y + z * z);
	const m01 = 2 * (x * y - z * w);
	const m02 = 2 * (x * z + y * w);

	const m10 = 2 * (x * y + z * w);
	const m11 = 1 - 2 * (x * x + z * z);
	const m12 = 2 * (y * z - x * w);

	const m20 = 2 * (x * z - y * w);
	const m21 = 2 * (y * z + x * w);
	const m22 = 1 - 2 * (x * x + y * y);

	const absExtentX = Math.abs(m00) * halfExtents.x + Math.abs(m01) * halfExtents.y + Math.abs(m02) * halfExtents.z;
	const absExtentY = Math.abs(m10) * halfExtents.x + Math.abs(m11) * halfExtents.y + Math.abs(m12) * halfExtents.z;
	const absExtentZ = Math.abs(m20) * halfExtents.x + Math.abs(m21) * halfExtents.y + Math.abs(m22) * halfExtents.z;

	return {
		min: {
			x: position.x - absExtentX,
			y: position.y - absExtentY,
			z: position.z - absExtentZ,
		},
		max: {
			x: position.x + absExtentX,
			y: position.y + absExtentY,
			z: position.z + absExtentZ,
		},
	};
}

/**
 * Rota un vector v por el quaternion q.
 * Usamos la fórmula: v' = v + 2 * cross(q.xyz, cross(q.xyz, v) + q.w * v)
 */
export function rotateVectorByQuaternion(v: { x: number; y: number; z: number }, q: { x: number; y: number; z: number; w: number }): { x: number; y: number; z: number } {
	const qVec = { x: q.x, y: q.y, z: q.z };

	const cross1 = {
		x: qVec.y * v.z - qVec.z * v.y,
		y: qVec.z * v.x - qVec.x * v.z,
		z: qVec.x * v.y - qVec.y * v.x,
	};

	const add = {
		x: cross1.x + q.w * v.x,
		y: cross1.y + q.w * v.y,
		z: cross1.z + q.w * v.z,
	};

	const cross2 = {
		x: qVec.y * add.z - qVec.z * add.y,
		y: qVec.z * add.x - qVec.x * add.z,
		z: qVec.x * add.y - qVec.y * add.x,
	};

	return {
		x: v.x + 2 * cross2.x,
		y: v.y + 2 * cross2.y,
		z: v.z + 2 * cross2.z,
	};
}
