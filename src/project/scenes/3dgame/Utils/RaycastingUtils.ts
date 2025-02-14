// RaycastingUtils.ts

export interface Ray {
	origin: { x: number; y: number; z: number };
	direction: { x: number; y: number; z: number };
}

/**
 * Calcula la intersección de un rayo con un plano.
 * @param ray El rayo (origen y dirección).
 * @param planePoint Un punto en el plano.
 * @param planeNormal La normal del plano (se asume normalizada).
 * @returns La posición de intersección (si existe, y si t >= 0) o null.
 */
export function rayPlaneIntersection(
	ray: Ray,
	planePoint: { x: number; y: number; z: number },
	planeNormal: { x: number; y: number; z: number }
): { x: number; y: number; z: number } | null {
	const denom = planeNormal.x * ray.direction.x + planeNormal.y * ray.direction.y + planeNormal.z * ray.direction.z;
	if (Math.abs(denom) < 1e-6) {
		// El rayo es casi paralelo al plano.
		return null;
	}
	const diff = {
		x: planePoint.x - ray.origin.x,
		y: planePoint.y - ray.origin.y,
		z: planePoint.z - ray.origin.z,
	};
	const t = (diff.x * planeNormal.x + diff.y * planeNormal.y + diff.z * planeNormal.z) / denom;
	if (t < 0) {
		// La intersección está detrás del origen del rayo.
		return null;
	}
	return {
		x: ray.origin.x + ray.direction.x * t,
		y: ray.origin.y + ray.direction.y * t,
		z: ray.origin.z + ray.direction.z * t,
	};
}

/**
 * Rota un vector v por el quaternion q.
 */
export function rotateVectorByQuaternion(v: { x: number; y: number; z: number }, q: { x: number; y: number; z: number; w: number }): { x: number; y: number; z: number } {
	// Fórmula: v' = q * v * q⁻¹.
	// Para simplificar, usaremos una aproximación basada en las componentes:
	const { x, y, z, w } = q;
	// Calcular los términos intermedios:
	const ix = w * v.x + y * v.z - z * v.y;
	const iy = w * v.y + z * v.x - x * v.z;
	const iz = w * v.z + x * v.y - y * v.x;
	const iw = -x * v.x - y * v.y - z * v.z;
	return {
		x: ix * w + iw * -x + iy * -z - iz * -y,
		y: iy * w + iw * -y + iz * -x - ix * -z,
		z: iz * w + iw * -z + ix * -y - iy * -x,
	};
}
