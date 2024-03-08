import { IKTransform } from "../../../util/IKTransform.js";
const THREE = await import('three')
import { Bone } from 'three';
import { Rot } from "../../../util/Rot.js";
import { Vec3, any_Vec3 } from "../../../util/vecs.js";
import { Ray } from "../../../util/Ray.js";
import { IKNode } from "../../../util/IKNodes.js";
import { generateUUID } from "../../../util/uuid.js";
import { Constraint } from "../Constraint.js";


export class Twist extends LimitingReturnful {
    static TAU = Math.PI * 2;
    static PI = Math.PI;
    static totalTwists = 0;

    constructor(forBone, minAngle=0.0001, range=TAU-0.0001, basis = new IKNode(null,null,undefined,pool), ikd = 'Twist-'(Twist.totalTwists+1), pool=noPool) {
        super(forBone, basis, ikd, pool);
    }
}