// CollisionUtils.ts
export interface AABB {
	min: { x: number; y: number; z: number };
	max: { x: number; y: number; z: number };
}

export interface ITransform3D {
	position: { x: number; y: number; z: number };
	scale: { x: number; y: number; z: number };
}

export function intersect(a: AABB, b: AABB): boolean {
	return a.min.x <= b.max.x && a.max.x >= b.min.x && a.min.y <= b.max.y && a.max.y >= b.min.y && a.min.z <= b.max.z && a.max.z >= b.min.z;
}

/**
 * Convierte un ITransform3D en un AABB.
 * Asume que la posición es el centro del objeto.
 */
export function getAABB(transform: ITransform3D): AABB {
	return {
		min: {
			x: transform.position.x - transform.scale.x / 2,
			y: transform.position.y - transform.scale.y / 2,
			z: transform.position.z - transform.scale.z / 2,
		},
		max: {
			x: transform.position.x + transform.scale.x / 2,
			y: transform.position.y + transform.scale.y / 2,
			z: transform.position.z + transform.scale.z / 2,
		},
	};
}
