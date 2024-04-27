import { Rest, Kusudama, Twist } from "../../EWBIK/betterbones/Constraints/ConstraintStack.js";

export function initMiu(armature) {
    initMiuShortcuts(armature);
    
    initMiuPins(armature);
    initMiuConstraints(armature);
}

export function initMiuShortcuts(armature) {
    for(let b of armature.bones) {
        if(b.name.indexOf('unused') !=-1) {
            let hasUsed = hasUsedDesc(b);
            if(!hasUsed) {
                console.log('removing '+b.name);
                b.parent.remove(b);
            }
            
        }
    }
}


function hasUsedDesc(b) {
    for(let cb of b.childBones()) {
        if(cb.name.indexOf('unused') ==-1) {
            return true;
        } else {
           if(hasUsedDesc(cb)) {
            return true;
           }
        }
    }
    return false;
}

export function initMiuPins(armature) {
    
}


export function initMiuConstraints(armature) {

    for (let b of armature.bones) {
        if(b.getConstraint() == null) {
            let restconst = new Rest(b);
        }
    }

    for (let b of armature.bones) {
        if (b.parent instanceof THREE.Bone) {
            if (b.getConstraint() != null) {
                b.getConstraint().layers?.set(1);
                continue;
            }
            let restconst = new Rest(b);
            
        }
    }
}