import * as THREE from 'three';

const { Constraint, LimitingReturnful } = await import("../../../betterbones/Constraints/ConstraintStack.js");
import { ConstraintStack } from '../../../betterbones/Constraints/Constraint.js';
import { ConstraintHelper } from '../ConstraintHelper.js';


export class StackHelper extends ConstraintHelper {
    /**@type {ConstraintStack} */
    forStack = null;
    forBone = null;
    constructor(forStack, visibilityCondition) {
        super(forStack, visibilityCondition);
        this.layers.onNewMask = (val, newMask) => {
            for (let c of this.forStack.allconstraints_array) {
                if(c.helper) {
                    c.helper.layers.mask = newMask;
                }
            }
        }
        this.forStack = forStack;
    }

    regenDisplay(constraint) {
        for (let subc of this.forStack.allconstraints_array) {
            subc?.helper?.regenDisplay(subc);
        }
    }
    updateDisplay(constraint) {
        if(!this.visible) return;
        for (let subc of this.forStack.allconstraints_array) {
            subc?.helper?.updateDisplay(subc);
        }
    }

    printInitializationString(doPrint = this.parentConstraint == null, parname = null) {
        let result = ``;
        let varname = `cstack_${this.forStack.instanceNumber}`;
        let hassubConstraintStack = false;
        for (let c of this.forStack.allconstraints_array) {
            if (c instanceof ConstraintStack) {
                hassubConstraintStack = true;
                break;
            }
        }
        if (parname == null && hassubConstraintStack) {
            let tag = "";
            for (let [t, b] of Object.entries(this.forBone.parentArmature.bonetags)) {
                if (b == this.forBone) {
                    tag = t; break;
                }
            }
            parname = `armature.bonetags["${tag}"]`;
        }

        if (hassubConstraintStack) {
            result += `let ${varname} = new ConstraintStack(${parname}, "${this.forStack.ikd}");
`
        } else varname = null;

        for (let c of this.forStack.allconstraints_array) {
            if (c.helper != null)
                result += `${c.helper.printInitializationString(false, varname)}
`;
        }
        result += `
`;
        if (doPrint) {
            console.log(result);
        } else return result;
    }
}