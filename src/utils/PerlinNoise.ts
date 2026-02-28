/* eslint-disable @typescript-eslint/explicit-function-return-type */
export class PerlinNoise {
	private permutation: number[] = [];

	constructor(seed: number = 12345) {
		const p: number[] = [];

		// Generamos tabla base 0-255
		for (let i = 0; i < 256; i++) {
			p[i] = i;
		}

		// Shuffle determinístico con seed
		const random = this.seededRandom(seed);
		for (let i = 255; i > 0; i--) {
			const j = Math.floor(random() * (i + 1));
			[p[i], p[j]] = [p[j], p[i]];
		}

		// Duplicamos tabla
		this.permutation = new Array(512);
		for (let i = 0; i < 512; i++) {
			this.permutation[i] = p[i % 256];
		}
	}

	private seededRandom(seed: number) {
		return function () {
			seed = (seed * 16807) % 2147483647;
			return (seed - 1) / 2147483646;
		};
	}

	private fade(t: number) {
		return t * t * t * (t * (t * 6 - 15) + 10);
	}

	private lerp(a: number, b: number, t: number) {
		return a + t * (b - a);
	}

	private grad(hash: number, x: number, y: number) {
		const h = hash & 3;
		const u = h < 2 ? x : y;
		const v = h < 2 ? y : x;
		return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
	}

	public noise2D(x: number, y: number): number {
		const X = Math.floor(x) & 255;
		const Y = Math.floor(y) & 255;

		x -= Math.floor(x);
		y -= Math.floor(y);

		const u = this.fade(x);
		const v = this.fade(y);

		const A = this.permutation[X] + Y;
		const B = this.permutation[X + 1] + Y;

		const AA = this.permutation[A];
		const AB = this.permutation[A + 1];
		const BA = this.permutation[B];
		const BB = this.permutation[B + 1];

		return this.lerp(this.lerp(this.grad(AA, x, y), this.grad(BA, x - 1, y), u), this.lerp(this.grad(AB, x, y - 1), this.grad(BB, x - 1, y - 1), u), v);
	}
}
