// import type { GameObject } from "../Objects/GameObject";

// class ObjectPool {
// 	private pool: GameObject[] = [];

// 	public get(type: string): GameObject {
// 		const obj = this.pool.find((o) => !o.active && o.type === type);
// 		if (obj) {
// 			obj.active = true;
// 			return obj;
// 		}
// 		return this.createNew(type);
// 	}

// 	public return(obj: GameObject): void {
// 		obj.active = false;
// 		obj.reset();
// 	}
// }
