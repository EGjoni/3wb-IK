/*import { Constraint } from "./EWBIK/betterbones/Constraints/Constraint.js";
import { Kusudama } from "./EWBIK/betterbones/Constraints/Kusudama/Kusudama.js";
import { Rest } from "./EWBIK/betterbones/Constraints/Rest/Rest.js";
import { Twist } from "./EWBIK/betterbones/Constraints/Twist/Twist.js";*/

import { IKPin } from "./EWBIK/betterbones/IKpin.js";

window.armatures = [];
window.pin_transformActive = false;
window.bone_transformActive = false;
window.pin_transformDragging = false;
window.bone_transformDragging = false;
window.lastmousedown = Date.now();
window.selectedBoneIdx = -1;
window.selectedPinIdx = -1;
window.contextArmature = null;
window.contextBone = null;
window.contextConstraint = null;
window.contextPin = null;
window.selectedPin = null;
window.selectedBone = null;
window.contextBone = null;
window.orbitControls
window.boneCtrls
window.pinOrientCtrls
window.pinTranslateCtrls;
window.pinsList = [];
window.boneList = [];
window.interactionSolve = false;
window.autoSolve = true;
window.ikReady = false;
window.raycaster = null;//new THREE.Raycaster();
window.mouse = null;//new THREE.Vector2();
window.targetsMeshList = [];
window.boneMeshList = [];
const D = document;
window.D = document;
Element.prototype.qs = Element.prototype.querySelector;
Element.prototype.qsall = Element.prototype.querySelectorAll;
Document.prototype.byid = Document.prototype.getElementById;
const constraintStackHTML = `
<fieldset>
<legend>Constrain Stack:</legend>
<div class="subconstraints"> 
</div>
<div>
<select class="constraint-select">
    <option value = "null"> Add New </option>
    <option value = "kusudama"> Kusudama </option>
    <option value = "twist"> Twist Constraint </option>
    <option value = "rest"> Rest Orientation </option>
    <option value = "stack"> Subconstraints </option>
</select> <button class="add-constraint">Add</button>
</div>
</fieldset>
`;



window.makeUI = function () {
    let panelStyle = document.createElement('style');
    panelStyle.innerText = `
 body {
            margin: 0;
        }
        canvas {
            display: block;
        }
        .stretch-div {
            display: flex;
            flex-direction: row;
            justify-content: flex-end;
        }
        #info {
            position: absolute;
            bottom: 10px;
            left: 10px;
            color: white;
            background-color: rgba(0, 0, 0, 0.5);
            padding: 8px;
            user-select: none;
            pointer-events: none;
        }
        #control-panel {
            z-index: 10; /* Ensure it's above other scene elements */
            background: rgba(255, 255, 255, 0.8); /* Semi-transparent white background */
            padding: 10px;
            border-radius: 5px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            position: absolute;
        }
        #control-panel button,
        #control-panel label {
            display: inline;
            margin-bottom: 5px;
        } 
        .hidden {
            display: none;
        }
`
    document.querySelector("head").appendChild(panelStyle);


    let htmlcontrols = document.createElement('div');
    htmlcontrols.innerHTML = `
<div id="interstitial" class="hidden">Click a bone or target to attach to.</div>
<div id= "mod-panel">
<div>
    <fieldset>
        <legend>Armature Options:</legend>
        <div>Name: <span id="armature-name"></span></div>
        <div style="width: fit-content">
            <div class= "stretch-div">
                <label for="default-dampening">Default Dampening:</label>            
                <input type="range" id="default-dampening" name="default-dampening" min="0.00001" max="1.986" step="0.00001">
                <output id="un-exp-output">0.1</output>
            </div>
        </div>
        <div>
            <button id="solve-btn">Solve (s)</button>
            <button id="pullback-btn">Pullback (-)</button>
            <button id="solve-iteration-btn">1 Iteration (+)</button>
            <button id="solve-bone-btn">1 Bone (b)</button>
            <label for="iterations">Iterations:</label>
            <input type="number" id="iterations" value ="15" name="iterations" min="0" max="200" step="1">
        </div>
    </fieldset>
</div>
<div>
    <fieldset>
        <legend>Bone Options:</legend>
        <div>Name: <span id="bone-name"></span> (<span id="internal-bone-name"></span>)</div>
        <label for="stiffness">Stiffness:</label>
        <input type="range" id="stiffness" name="stiffness" min="0.001" max="6.289" step="0.001">
        <fieldset>
            <legend>Pin options:</legend>
            <label for="pin-enabled">Enabled</label>
            <input type="checkbox" id="pin-enabled" name="pin-enabled">
            <div id="pin-options" class="hidden">
                <div>
                    <label for="weight">Weight:</label>
                    <input type="range" id="weight" name="weight" min="0.001" max="1" step="0.001">
                </div>
                <div>
                    <label for="x-priority">X alignment priority:</label>
                    <input type="range" id="x-priority" name="x-priority" min="0" max="1" step="0.001">
                </div>
                <div>
                    <label for="y-priority">Y alignment priority:</label>
                    <input type="range" id="y-priority" name="y-priority" min="0" max="1" step="0.001">
                </div>
                <div>
                    <label for="z-priority">Z alignment priority:</label>
                    <input type="range" id="z-priority" name="z-priority" min="0" max="1" step="0.001">
                </div>
                <div id="pin-parent-select">
                    <span id="pin-parent-mode-hint">Current parent"</span><span id="current-pin-parent"></span>
                    <button id="change-pin-parent">Change</button>
                </div>
            </div>
        </fieldset>
        <fieldset>
            <legend>Constraints:</legend>
            <div id="constraints-div">
            </div>
        </fieldset>
    </fieldset>
</div>
<div>
    <fieldset>
        <legend> Update mode:</legend>
        <div>
            <input type="radio" id="auto-solve" name="solve-mode" value="auto">
            <label for="auto-solve">Auto Solve (A)</label>
        </div>
        <div>
            <input type="radio" id="interaction-solve" name="solve-mode" value="interaction">
            <label for="interaction-solve">Interaction Solve (I)</label>
        </div>
        <div>
            <input type="radio" id="no-solve" name="solve-mode" value="no-solve">
            <label for="no-solve">No solve(N)</label>
        </div>
    </fieldset>
</div>

<div>
    <fieldset>
        <legend>View Options</legend>
        <div>
            <input type="checkbox" id="rotate-widget" name="rotate-widget" checked>
            <label for="rotate-widget">Rotate Widget (r)</label>
            <input type="checkbox" id="translate-widget" name="translate-widget" checked>
            <label for="translate-widget">Translate Widget (t)</label>
        </div>
        <input type="checkbox" id="show-mesh" name="show-mesh" checked>
        <label for="show-mesh">Mesh</label>
        <input type="checkbox" id="show-ik-bones" name="show-ik-bones" checked>
        <label for="show-ik-bones">IK bones</label>
        <input type="checkbox" id="show-nonik-bones" name="show-nonik-bones" checked>
        <label for="show-nonik-bones">Irrelevant bones</label>
    </fieldset>
    <div> 
        <button id="save">Save IK setup</button>
        <button id="load">Load/Apply setup to rig</button>
    </div>
</div>
</div>
`;

htmlcontrols.id = 'control-panel';
document.querySelector("body").appendChild(htmlcontrols);








D.byid('solve-btn').addEventListener('click', () => {
    let prevstate = interactionSolve;
    interactionSolve = true;
    doSolve(contextBone);
    interactionSolve = prevstate
});

D.byid('pullback-btn').addEventListener('click', async () => {
    interactionSolve = false;
    autoSolve = false;
    for (let a of armatures) {
        if (a.ikReady) await a._doSinglePullbackStep(contextBone);
    }
});

D.byid('auto-solve').addEventListener('change', (e) => {
    if (e.target.checked) {
        autoSolve = true;
        interactionSolve = false; // Ensure exclusive selection
    }
});

D.byid('interaction-solve').addEventListener('change', (e) => {
    if (e.target.checked) {
        autoSolve = false;
        interactionSolve = true;
    }
});


D.byid('no-solve').addEventListener('change', (e) => {
    if (e.target.checked) {
        autoSolve = false;
        interactionSolve = false;
    }
});

D.byid('rotate-widget').addEventListener('change', (e) => {
    pinOrientCtrls.enabled = e.target.checked;
});

D.byid('translate-widget').addEventListener('change', (e) => {
    pinTranslateCtrls.enabled = e.target.checked;
});

// Initialize solve mode based on existing variables
D.byid(autoSolve ? 'auto-solve' : 'interaction-solve').checked = true;

D.byid('pin-enabled').addEventListener("input", (event) => {
    let state = event.target.checked;
    let diddisable = false;
    if(state) {
        if(contextPin != null) { 
            contextPin.disable();
            diddisable = true;
        } else if(contextBone != null) {
            let newPin = new IKPin(contextBone);
        }
        makePinsList(1, contextBone.parentArmature.armatureObj3d, contextBone.parentArmature);
        contextBone.parentArmature.showBones(0.1, true);
        updateGlobalPinLists();
        if(diddisable)
            select(contextPin.forBone);
    } else if(contextPin != null) {
        contextPin.disable();
        makePinsList(1, contextBone.parentArmature.armatureObj3d, contextBone.parentArmature);
        contextBone.parentArmature.showBones(0.1, true);
        updateGlobalPinLists();
        select(contextPin.forBone);
    }
})

D.byid("x-priority").addEventListener("input", (event) => {
    contextPin?.setXPriority(event.target.value);
    contextArmature?.solve(contextBone);
});
D.byid("y-priority").addEventListener("input", (event) => {
    contextPin?.setYPriority(event.target.value);
    contextArmature?.solve(contextBone);
});
D.byid("z-priority").addEventListener("input", (event) => {
    contextPin?.setZPriority(event.target.value);
    contextArmature?.solve(contextBone);
});


const defaultDampeningInput = D.byid('default-dampening');
const unexp = D.byid('un-exp-output');
const iterationsInput = D.byid('iterations');
const solveBtn = D.byid('solve-btn');
const pullbackBtn = D.byid('pullback-btn');

defaultDampeningInput.addEventListener('input', (event) => {
    contextBone?.parentArmature?.setDampening((Math.pow(Math.E, event.target.value)-1));
    unexp.value = (Math.pow(Math.E, event.target.value)-1).toFixed(3);
});

iterationsInput.addEventListener('input', (event) => {
    contextBone?.parentArmature?.setDefaultIterations(event.target.value);
});

solveBtn.addEventListener('click', (e) => {
    contextBone?.parentArmature?.solve(contextBone);
});

pullbackBtn.addEventListener('click', () => {
    contextBone?.parentArmature?.doSinglePullbackStep(contextBone)
});

async function doNothing() {
return false;
}
window.doNothing = doNothing;
window.awaitingSelect = doNothing;

window.toInterstitial = async function(intersticeMessage, onSelected) {
    D.byid("interstitial").classList.remove("hidden");
    D.byid("interstitial").innerText = intersticeMessage;
    D.byid("mod-panel").classList.add("hidden");
    window.awaitingSelect = async (selected) => {
        onSelected(selected);
        D.byid("interstitial").classList.add("hidden");
        D.byid("mod-panel").classList.remove("hidden");
        window.awaitingSelect = window.doNothing;
        return true; 
    }
}

window.cancelInterstice = async function() {
    D.byid("interstitial").classList.add("hidden");
    D.byid("mod-panel").classList.remove("hidden");
    window.awaitingSelect = window.doNothing;
}

D.byid("change-pin-parent").addEventListener('click', (e) => {
    if(contextPin != null) {
        window.toInterstitial( "Click a bone or target to attach to. Or hit Esc to cancel", 
        (selected)=>{
            if(selected != null) {
                let transform = selected?.targetNode ?? selected; 
                contextPin.targetNode.setParent(transform);
            }
        });
    }
})

D.byid('show-mesh').addEventListener('change', function (e) {
    window.rendlrs.layerState(window.meshLayer, e.target.checked);
});

D.byid('show-ik-bones').addEventListener('change', function (e) {
    for(let a of armatures) {
        if(a.ikReady) {
            for(let b of a.bones) {
                if(b.bonegeo != null && a.skelState.getBoneStateById(b.ikd) != null) {
                    if(e.target.checked) {
                        b.bonegeo.layers.enable(boneLayer);
                    } else {
                        b.bonegeo.layers.disable(boneLayer); 
                    }
                }
            }
        }
    }
    if(e.target.checked == false && D.byid('show-nonik-bones').checked == false) {
        rendlrs.hide(boneLayer);
    } else {
        rendlrs.show(boneLayer);
    }
});

D.byid('show-nonik-bones').addEventListener('change', function (e) {
    for(let a of armatures) {
        if(a.ikReady) {
            for(let b of a.bones) {
                if(b.bonegeo != null && a.skelState.getBoneStateById(b.ikd) == null) {
                    if(e.target.checked) {
                        b.bonegeo.layers.enable(boneLayer);
                    } else {
                        b.bonegeo.layers.disable(boneLayer); 
                    }
                }
            }
        }
    }
    if(e.target.checked == false && D.byid('show-ik-bones').checked == false) {
        rendlrs.hide(boneLayer);
    } else {
        rendlrs.show(boneLayer);
    }
});

D.byid('save').addEventListener('click', () => {
    serializeInstance(contextBone.parentArmature)
})

    
    let emptyConstraintNode = document.createElement("div");
    emptyConstraintNode.id = "default-stack";
    emptyConstraintNode.classList.add("constraint-stack");
    emptyConstraintNode.innerHTML = constraintStackHTML;

    emptyConstraintNode.qs(".add-constraint").addEventListener("click", (e) => {
        if (contextBone != null) {
            let addType = (e).target.parentNode.qs(".constraint-select").value;
            let stack = contextBone.getConstraint();
            if (contextBone.getConstraint() == null) {
                stack = new ConstraintStack(contextBone);
            }
            emptyConstraintNode.remove();
            let constController = getMakeConstraint_DOMElem(forBone.getConstraint());
            htmlcontrols.byid("constraints-div").appendChild(constController);
            let subcst = null;
            if (val == "kusudama") subcst = initKusudama(contextBone);
            if (val == "twist") subcst = initTwist(contextBone);
            if (val == "rest") subcst = initRest(contextBone);
            if (val == "stack") subcst = initStack(contextBone);
            constController.qs(".subconstraints").appendChild(subcst);
        }
    })

    window.genericConstraintRow = document.createElement("div");
    genericConstraintRow.classList.add("generic-constraint-row");
    genericConstraintRow.innerHTML = `
<label for='constraint-enabled'>
<input type='checkbox' name='constraint-enabled' class='constraint-enabled' checked>
<span class="subconstraint-controls"> </span><button class='remove-constraint'></button>
`

    window.restConstraintControls = document.createElement("div");
    restConstraintControls.classList.add("rest-constraint-controls");
    restConstraintControls.innerHTML = `
<button class="set-current-pose-as-rest">Use Current Pose</button>
<span class="current-discomfort"> </span>
`;

    window.constraintStackControls = document.createElement("div");
    constraintStackControls.classList.add("constraint-stack");
    constraintStackControls.innerHTML = constraintStackHTML;
}


window.updateInfoPanel  = function(item) {
    let armature = null; 
    let bone = null;
    let pin = null;
    let constraintStack = null;

    if (item instanceof THREE.Bone) {
        intersectsDisplay.innerText = `
        Bone: ${item.ikd}
        Stiffnes: ${item?.getStiffness()}
        Pain: ${item.parentArmature?.boneToStateMap?.get(item)?.readBonePain()?.toFixed(4)}
        Skeleton Total Pain: ${item.parentArmature?.shadowSkel?.lastTotalPain?.toFixed(4)}
        Skeleton Max Pain: ${item.parentArmature?.shadowSkel?.maxPain?.toFixed(4)}
        `;
        bone = item;
        pin = bone.getIKPin();
        if(bone.getConstraint() != null) constraintStack = bone.getConstraint();
        armature = bone.parentArmature;
    } else if (item instanceof IKPin) {
        intersectsDisplay.innerText = `
        Name: ${item.ikd}
        `;
        pin = item;
        bone = pin.forBone;
        if(bone.getConstraint() != null) constraintStack = bone.getConstraint();
        armature = bone.parentArmature; 
    } else {
        D.byid("armature-name").innerText = "None Selected";
        
        if(constraintStack != null) {
            let domConstraint = getMakeConstraint_DOMElem(constraintStack);
            D.byid("constraints-div").appendChild(domConstraint);
        } else {

        }
    }

    window.contextArmature = armature;
    window.contextConstraint = constraintStack;
    window.contextPin = pin;
    window.contextBone = bone;
    
    const armDomName = D.byid("armature-name")
    const armDom = armDomName.parentNode;

    if(contextArmature == null) {
        armDomName.innerText = "None Selected";
        D.byid("default-dampening").value = Math.pow(Math.E, 0.1);
        D.byid("un-exp-output").value = 0.1;
        D.byid("iterations").value = contextArmature.getDefaultIterations();
       
    } else {
        armDomName.innerText = contextArmature.ikd;
        D.byid("default-dampening").value = Math.log(contextArmature.getDampening()+1).toFixed(4);
        D.byid("un-exp-output").value = Math.log(contextArmature.getDampening()+1).toFixed(4);
        D.byid("iterations").value = contextArmature.getDefaultIterations();
    }

    if(contextBone == null) {
        D.byid("bone-name").innerText = "None Selected";
        D.byid("internal-bone-name").innerText = "None";       
        D.byid("stiffness").value = 0;
        constraintStackControls.remove();
    } else {
        D.byid("bone-name").innerText = contextBone.name;
        D.byid("internal-bone-name").innerText = contextBone.ikd;       
        D.byid("stiffness").value = contextBone.getStiffness();
        constraintStackControls.remove();
    }

    const pinDom = D.byid("pin-options")
    if(contextPin == null || contextPin.isEnabled() == false) {
        pinDom.classList.add("hidden");
        pinDom.parentNode.qs("#pin-enabled").checked = false; 
    }
    else {
        pinDom.classList.remove("hidden");
        pinDom.parentNode.qs("#pin-enabled").checked = true;
        pinDom.qs("#weight").value = contextPin.getPinWeight();
        pinDom.qs("#x-priority").value = contextPin.getXPriority();
        pinDom.qs("#y-priority").value = contextPin.getYPriority();
        pinDom.qs("#z-priority").value = contextPin.getZPriority();
        if(contextPin?.targetNode?.toTrack?.parent) {
            pinDom.qs("#pin-parent-mode-hint").innerText = "Current parent: ";
            let obj3dParentobj3d = contextPin.targetNode.toTrack.parent;
            let targetNodeParent = contextPin.targetNode.parent;
            let targetNodeParentobj3d = contextPin.targetNode.parent.toTrack;
            let name = obj3dParentobj3d.name;
            if(name.length == 0) name = obj3dParentobj3d.ikd;
            if(name == null) name = targetNodeParentobj3d?.name;
            if(name.length == 0) name = targetNodeParentobj3d?.ikd; 
            if(name == null) name = targetNodeParent.ikd;
            pinDom.qs("#current-pin-parent").innerHTML = name;
        } 
    }

    
}

/**
 * @param {(Constraint | ConstraintStack | Limiting | Returnful | LimitingReturnful)} c a constraint instance 
 * @return A DOM element appropriate for modifying the given constraint 
*/
window.getMakeConstraint_DOMElem = function (c) {
    if (c.domControls != null) {
        return c.domControls;
    }
    let result = genericConstraintRow.clone(true);
    if (c instanceof Rest) {
        let newRest = restConstraintControls.clone(true);
        result.qs(".subconstrainControls").appendChild(newRest);
        newRest.qs(".set-current-pose-as-rest").addEventListener("click", (e) => {
            c.setCurrentAsRest();
        });
    }
    if (c instanceof ConstraintStack) {
        let newStack = constraintStackControls.clone(true);
        result.qs(".subconstrainControls").appendChild(newStack);
        newRest.qs(".add-constraint").addEventListener("click", (e) => {
            let val = newStack.parent.qs("constraint-select");
            if (val == "kusudama") subcst = initKusudama(c);
            if (val == "twist") subcst = initTwist(c);
            if (val == "rest") subcst = initRest(c);
            if (val == "stack") subcst = initStack(c);
            newStack.qs(".subconstraints").appendChild(subcst);
        });
    }
    let enabled = result.qs(".constraint-enabled");
    enabled.addEventListener("change", (e) => {
        if (enabled.checked) c.enable();
        else c.disable();
    });

    let removeButton = result.qs(".remove-constraint");
    removeButton.addEventListener("click", (e) => {
        c.remove();
        result.remove();
    });
    result.forConstraint = c;
    c.domControls = result;
    return result;
}


function determineConstraintName(corb) {
    let bone = corb instanceof THREE.Bone ? corb : corb.forBone;
    let parconstr = corb instanceof Constraint ? corb : null;
    let ident = parconstr == null ? "Sub Kusudama of " + parconstr.ikd : "Kusudama for " + (bone.name.length > 0 ? bone.ikd : bone.name);
    return ident;
}

/**
 * @param {(ConstraintStack|Bone)} corb the constraintstack or bone to add the new constraint to
 * @return {Element}
 */
function initStack(corb) {
    let ident = determineConstraintName(corb)
    let newC = new ConstraintStack(corb, null, ident);
    resultConst = getMakeConstraint_DOMElem(newC);
    return resultConst;
}

/**
 * @param {(ConstraintStack|Bone)} corb the constraintstack or bone to add the new constraint to
 * @return {Element}
 */
 function initTwist(corb) {
    let ident = determineConstraintName(corb)
    let newC = new Twist(corb, null, ident);
    resultConst = getMakeConstraint_DOMElem(newC);
    return resultConst;
}

/**
 * @param {(ConstraintStack|Bone)} corb the constraintstack or bone to add the new constraint to
 * @return {Element}
 */
 function initKusudama(corb) {
    let ident = determineConstraintName(corb)
    let newC = new Kusudama(corb, null, ident);
    resultConst = getMakeConstraint_DOMElem(newC);
    return resultConst;
}

/**
 * @param {(ConstraintStack|Bone)} corb the constraintstack or bone to add the new constraint to
 * @return {Element}
 */
function initRest(corb) {
    let ident = determineConstraintName(corb)
    let newC = new Rest(corb, null, ident);
    resultConst = getMakeConstraint_DOMElem(newC);
    return resultConst;
}

makeUI();