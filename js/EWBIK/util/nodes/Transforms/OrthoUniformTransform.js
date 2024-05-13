import { IKTransform } from "./IKTransform.js";

/**Very fast, but limited to orthogonal transformations with beses of equal magnitude */
export class OrthoUniformTransform extends IKTransform {
    constructor(origin=null, x = null, y = null, z = null, ikd = 'IKTransform-'+(IKTransform.totalTransforms++), pool= globalVecPool) {
        super(origin, x, y, z, ikd, pool);
    }

    setFromMatrix4(mat4, extractSkew = true) {
        throw new Error("Lol. No.")
    }
}