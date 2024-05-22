
import * as THREE from 'three';

const { Constraint, Twist, Rest, LimitingReturnful} = await import("../../../betterbones/Constraints/ConstraintStack.js");
import { ConstraintHelper } from '../ConstraintHelper.js';

export class RestHelper extends ConstraintHelper {

    constructor(forRest, visibilityCondition) {
        super(forRest, visibilityCondition);
        this.forRest = forRest;
        this.forBone = this.forRest.forBone;
    }

    printInitializationString(doPrint=true, parname) {
        let tag = "";
        for(let [t, b] of Object.entries(this.forBone.parentArmature.bonetags)) {
            if(b == this.forBone) {
                tag = t; break;
            }
        }
        parname = parname == null ? `armature.bonetags["${tag}"]` : parname;
        let postPar = parname==null ? '' : `.forBone`;
        let r = this.forRest.boneFrameRest.localMBasis.rotation.toArray();
        let result = `new Rest(${parname}, 
                "Rest-${this.forRest.instanceNumber}_on_bone_${tag}", armature.stablePool).setPainfulness(${this.forRest.getPainfulness()})
                .setStockholmRate(${this.forRest.getStockholmRate()})
                .boneFrameRest.setLocalOrientationTo(
                    new Rot(${r[0]}, ${r[1]}, ${r[2]}, ${r[3]}))`;
        if(this.forRest.enabled == false) 
            result += '.disable()';
        result+=';\n';
        if(this.forRest.autoGen) result = '';
        if(doPrint) 
            console.log(result);
        else return result;
    }
}