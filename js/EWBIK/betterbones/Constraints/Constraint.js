const THREE = await import('three')
import { Bone } from 'three';
import { IKNode } from '../../util/IKNodes.js';


export class Constraint {
    static totalConstraints = 0;
    /**
    * @type {Bone}*/
    forBone = null;
    painfulness = 0.5;
    constructor(forBone, ikd = 'Constraint-'(Constraint.totalConstraints+1)) {
        this.forBone = forBone;
        this.ikd = ikd;
        if(forBone != null) {
            this.swingAxes = new IKNode(); //forBone
            this.swingAxes.adoptLocalValuesFromObject3D(this.forBone);
        }
    }
    

    setPainfulness(val) {
        this.painfulness = val;
        if (this.forBone && this.forBone.parentArmature) {
            this.forBone.parentArmature.updateShadowSkelRateInfo(); 
        }
    }
    getPainfulness() {
        return this.painfulness;
    }

    twistOrientationAxes() {
        return null;
    }

    swingOrientationAxes() {
        return this.forBone.parent;
    }

    attachedTo() {
        return this.forBone;
    }
}