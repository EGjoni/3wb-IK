/*import { Constraint } from "./EWBIK/betterbones/Constraints/Constraint.js";
import { Kusudama } from "./EWBIK/betterbones/Constraints/Kusudama/Kusudama.js";
import { Rest } from "./EWBIK/betterbones/Constraints/Rest/Rest.js";
import { Twist } from "./EWBIK/betterbones/Constraints/Twist/Twist.js";*/

import { IKPin } from "./EWBIK/betterbones/IKpin.js";
import { CallbacksSequence } from "./EWBIK/CallbacksSequence.js"
import { Bone, Vector3 } from "three";
import { TransformState } from "./EWBIK/solver/SkeletonState.js";
import { Vec3, any_Vec3 } from "./EWBIK/util/vecs.js";
import { Rot } from "./EWBIK/util/Rot.js";
import { ConvexGeometry } from "convexGeo";
import { ChainRots, BoneRots, RayDrawer } from "./EWBIK/util/debugViz/debugViz.js";
import { ConstraintStack, Returnful, Rest, Twist} from "./EWBIK/betterbones/Constraints/ConstraintStack.js";

window.Vec3 = Vec3;
window.Rot = Rot;

window.armatures = [];
window.meshLayer = 0;
window.boneLayer = 1;
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
const stackInnards = `
<legend>Constraint Stack:</legend>
<div>
<select class="constraint-select">
    <option value = "null"> Add New </option>
    <option value = "kusudama"> Kusudama </option>
    <option value = "twist"> Twist Constraint </option>
    <option value = "rest"> Rest Orientation </option>
    <option value = "stack"> Subconstraints </option>
</select> <button class="add-constraint">Add</button>
</div>
<div class="subconstraints"> 
</div>`
const constraintStackHTML = `
<fieldset class="constraint-stack">
${stackInnards}
</fieldset>
`;
const defaultStack = `
<div id="default-stack" class="constraint-stack">
    <fieldset class="constraint-stack">
        ${stackInnards}
    </fieldset>
</div>
`



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
            background: rgba(255, 255, 255, 0.6); /* Semi-transparent white background */
            filter: invert(0.95);
            font-family: sans-serif;
            backdrop-filter: blur(2px) invert(1);
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
        #pin-options {
            display: inline-block;
        }
        .hidden {
            display: none !important;
        }
        .load-container {
            display: grid;
            grid-template-columns: 100%;
            grid-template-rows: 2em;
        }
        fieldset.constraint-stack {
            background: #fff4;
            overflow-y: auto;
            max-height: 18em;
            font-size: 0.9em;
        }
        
        .progress-text {
            grid-row: 1;
            text-align: center;
            grid-column: 1;
            color: white;
            position: relative;
            z-index: 3;
            align-self: center;
        }

        .toggle-button {
            display: inline-block;
          }
          
          .toggle-button input[type="checkbox"] {
            display: none;
          }
          
          .toggle-button label {
            color: black;
            background-color: #ccc;
            padding: 10px 10px;
            border-radius: 5px;
            cursor: pointer;
            margin-top: -27px;
            position: absolute;
            right: 45px;
            display: inline-block;
          }
          
          .toggle-button input[type="checkbox"]:checked + label {
            background-color: blue;
            color: white;
          }
        
        .progress {
            background: black;
            position: relative;
            border-radius: 5px;
            z-index: 0;
            height: 2em;
            box-sizing: border-box;
            box-shadow: 0px 0px 7px 4px #914848 inset;
            grid-row: 1;
            grid-column: 1;
        }
`
    document.querySelector("head").appendChild(panelStyle);
    window.loadingBar = document.createElement('div');
    window.loadingBar.classList.add("load-container");
    window.loadingBar.innerHTML = `
    <div class='progress-text'></div>
    <div class="progress"></div>
    `;

    let htmlcontrols = document.createElement('div');
    htmlcontrols.innerHTML = `
<div id="interstitial" class="hidden">Click a bone or target to attach to.</div>
<div id= "mod-panel">
<div>
    <fieldset>
        <legend>Armature Options:</legend>
        <div id="no-armature-opts-hint">Click on a bone or pin to see config options.</div>
        <div class="hidden">
            <div>Name: <span id="armature-name"></span></div>
            <div style="width: fit-content">
                <div class= "stretch-div">
                    <label for="default-dampening">Default Dampening:</label>            
                    <input type="range" id="default-dampening" name="default-dampening" min="0.00001" max="1.986" step="0.00001">
                    <output class="un-exp-output">0.1</output>
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
        </div>
        <div id="loader-hints" class="hidden"></div>
    </fieldset>
</div>
<div>
    <fieldset id ="bone-fields" class="hidden">
        <legend>Bone Options:</legend>
        <div>Name: <span id="bone-name"></span> (<span id="internal-bone-name"></span>)</div>
        <label for="stiffness">Stiffness:</label>
        <input type="range" id="stiffness" name="stiffness" min="0.001" max="1.986" step="0.001">
        <output class="un-exp-output">0.1</output>
        <fieldset>
            <legend>Pin options:</legend>
            <div class="toggle-button">
                <input type="checkbox" id="pin-enabled" name="pin-enabled">
                <label for="pin-enabled"><span>Pin Bone</span></label>
            </div>
            <div id="pin-options" class="hidden">
                <div>
                    <label for="weight">Weight:</label>
                    <input type="range" id="weight" name="weight" min="0.001" max="0.69" step="0.001" value="0.405">
                    <output class="un-exp-output">0.5</output>
                </div>
                <div>
                    <label for="x-priority">X alignment priority:</label>
                    <input type="range" id="x-priority" name="x-priority" min="0" max="0.69" step="0.001" value=0.69>
                    <output class="un-exp-output">1</output>
                </div>
                <div>
                    <label for="y-priority">Y alignment priority:</label>
                    <input type="range" id="y-priority" name="y-priority" min="0" max="0.69" step="0.001" value = 0.69>
                    <output class="un-exp-output">1</output>
                </div>
                <div>
                    <label for="z-priority">Z alignment priority:</label>
                    <input type="range" id="z-priority" name="z-priority" min="0" max="0.69" step="0.001" value = 0.69>
                    <output class="un-exp-output">1</output>
                </div>
                <div id="pin-parent-select">
                    <span id="pin-parent-mode-hint">Current parent"</span><span id="current-pin-parent"></span>
                    <button id="change-pin-parent">Change</button>
                </div>
            </div>                       
        </fieldset>
        ${defaultStack}            
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
            <input type="radio" id="interaction-solve" name="solve-mode" value="interaction" checked>
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

    window.armatureSolve = () => {
        autoSolve = false;
        let prevstate = interactionSolve;
        interactionSolve = true;
        window.contextBone?.parentArmature?.solve(window.contextBone);//doSolve(contextBone);
        interactionSolve = prevstate
        setDOMtoInternalState();
    }

    window.updateLoadStream = (xhr, loadId) => {
        let hints = D.byid("loader-hints");
        hints.classList.remove("hidden");
        let thisBar = hints.qs(`.load-container[data-id="${loadId}"`);
        if (thisBar == null) {
            thisBar = window.loadingBar.cloneNode(true);
            hints.appendChild(thisBar);
            thisBar.dataset.id = loadId;
        }
        thisBar.qs(".progress").style.width = (100 * xhr.loaded / xhr.total).toFixed(3) + '%';
        thisBar.qs(".progress-text").innerText = (100 * xhr.loaded / xhr.total).toFixed(3) + "% loaded";
        //console.log((100 * xhr.loaded / xhr.total).toFixed(3) + "% loaded");
        if (xhr.loaded == xhr.total) {
            thisBar.qs(".progress-text").innerText = "Instantiating Scene...";
            setDOMtoInternalState();
        }
    }

    window.updateParseStream = (parseText, loadId) => {
        let hints = D.byid("loader-hints");
        let thisBar = hints.qs(`.load-container[data-id="${loadId}"`);
        //thisBar.qs(".progress").style.width = (100*xhr.loaded/xhr.total).toFixed(3)+'%';
        thisBar.qs(".progress-text").innerText = parseText;
        if (parseText == null) {
            thisBar.remove();
            if (thisBar.children.length == 0) {
                thisBar.classList.add("hidden");
            }
        }
    }


    window.notifyStreamError = (error, loadId) => {
        let hints = D.byid("loader-hints");
        hints.classList.remove("hidden");
        let thisBar = hints.qs(`.load-container[data-id="${loadId}"`);
        if (thisBar == null) {
            thisBar = window.loadingBar.cloneNode(true);
            hints.appendChild(thisBar);
            thisBar.dataset.id = loadId;
        }
        thisBar.qs(".progress-text").innerText = error;
    }

    htmlcontrols.id = 'control-panel';
    document.querySelector("body").appendChild(htmlcontrols);




    D.byid('solve-btn').addEventListener('click', () => {
        armatureSolve();
    });

    D.byid('solve-iteration-btn').addEventListener('click', () => {
        autoSolve = false;
        let prevstate = interactionSolve;
        interactionSolve = true;
        window.armatureStepDebug();
        interactionSolve = prevstate
        setDOMtoInternalState();
    });

    window.getdbgstring = function (bone, ts, wb) {
        let solveString = `
PreSolve for ${bone.ikd}.\n
%%%%%% Initial WB condition:                                            
${wb.simLocalAxes.getLocalMBasis().toString()} 
${wb.simLocalAxes.getGlobalMBasis().toString()}

######Initial Bone condition:
${bone.toString()}
`;
        return solveString;
    }


    


    window.getArmatureGlobalized = (v, wb) => {
        let globalized = new THREE.Vector3(v.x, v.y, v.z);
        globalized = wb.forBone.directRef.parentArmature.armatureObj3d.localToWorld(globalized);
        return globalized;
    }

    let prevwb = null;
    function initLines(wb) {
        if (prevwb != wb && prevwb != null) {
            prevwb?.targetDrawer?.die();
            prevwb?.tipDrawer?.die();
        }
        prevwb = wb;

        let dirDraw = (rg, drawer) => {
            let bo = wb.simLocalAxes.origin();
            let p = rg.correspondsTo;            
            let po = getArmatureGlobalized(p, wb);
            let go = getArmatureGlobalized(bo, wb);
            //console.log(go.y.toFixed(3) + ': ' + wb.forBone.ikd + ' (target)');
            const dir = new THREE.Vector3(po.x + go.x, po.y + go.y, po.z + go.z);
            rg.lastDir = dir;
            //rg.correspondsTo.p2.subClone(boneOrig);
            return [go, dir];
        }


        let rotDrawer = (rg, drawer) => {
            let bo = wb.simLocalAxes.origin();
            let p = rg.correspondsTo;
            let po = getArmatureGlobalized(p, wb);
            let go = getArmatureGlobalized(bo, wb);
            //console.log(go.y.toFixed(3) + ': ' + wb.forBone.ikd + ' (target)');
            const dir = new THREE.Vector3(po.x + go.x, po.y + go.y, po.z + go.z);
            //rg.correspondsTo.p2.subClone(boneOrig);
            return [go, dir];
        }

        if (wb.targetDrawer == null) {
            wb.targetDrawer = new RayDrawer(wb, window.scene,
                (drawer) => { return drawer.source.chain.boneCenteredTargetHeadings; },
                dirDraw
            );            
        }
        if (wb.tipDrawer == null) {           
            wb.tipDrawer = new RayDrawer(wb, window.scene,
                (drawer) => { return drawer.source.chain.boneCenteredTipHeadings; },
                dirDraw
            );
            if(wb.chain.rottrack == null) 
                new ChainRots(wb.chain);
        }
    }


    window.armatureStepDebug = () => {
        interactionSolve = false;
        autoSolve = false;
        setDOMtoInternalState();

        let callbacks = new CallbacksSequence(
            {
                beforeIteration: (bone, ts, wb) => {
                    if (bone == window.contextBone) {
                        let solveString = getdbgstring(bone, ts, wb);
                        //console.log(solveString);
                        window.intersectsDisplay.innerText = solveString;
                    }
                },
                afterIteration: (bone, ts, wb) => {
                    if (bone == window.contextBone) {
                        let solveString = getdbgstring(bone, ts, wb);
                        //console.log(solveString);
                        window.intersectsDisplay.innerText = `${solveString}`;
                    }
                },
            });
        window.contextArmature?._debug_iteration(selectedBone, undefined, undefined);
    }


    window.bonestepcallbacks = new CallbacksSequence(
        {
            beforeIteration: (bone, ts, wb) => {
                //if (bone == window.contextBone) {
                initLines(wb);
                wb.targetDrawer.draw(new THREE.Color('grey'),
                    new THREE.Color(0.6, 0.2, 0.2 ),//red
                    new THREE.Color(0.6, 0.2, 0.6 ),//magenta
                    new THREE.Color(0.2, 0.6, 0.2 ),//green
                    new THREE.Color(0.5, 0.5, 0.1 ),//yellow
                    new THREE.Color(0.2, 0.2, 0.8 ),//blue
                    new THREE.Color(0.2, 0.6, 0.6 )//cyan
                );
                wb.tipDrawer.draw(new THREE.Color('white'),
                    new THREE.Color(0.6, 0, 0 ),//red
                    new THREE.Color(0.6, 0, 0.6 ),//magenta
                    new THREE.Color(0, 0.6, 0 ),//green
                    new THREE.Color(0.5, 0.5, 0 ),//yellow
                    new THREE.Color(0, 0, 0.8 ),//blue
                    new THREE.Color(0, 0.4, 0.6 )//cyan
                );
                wb.rotDraw.visible = false;
                wb.rotDraw.update((v, wb)=> {return wb.simLocalAxes.origin().clone().add(v)}); 
                //console.log("before: ");
                wb.rotDraw.visible = false;
                //let solveString = getdbgstring(bone, ts, wb);
                //console.log("pre");
                //wb.simLocalAxes.toCons(true);
                //window.intersectsDisplay.innerText = solveString;
                //}
            },
            afterIteration: (bone, ts, wb) => {
                //if (bone == window.contextBone) {
                wb.tipDrawer.draw(new THREE.Color('white'),
                    new THREE.Color(1, 0, 0 ),//red
                    new THREE.Color(1, 0, 1 ),//magenta
                    new THREE.Color(0, 1, 0 ),//green
                    new THREE.Color(1, 1, 0 ),//yellow
                    new THREE.Color(0, 0, 1 ),//blue
                    new THREE.Color(0, 1, 1 )//cyan
                );
                wb.rotDraw.update((v, wb)=> {return wb.simLocalAxes.origin().clone().add(v)});
                wb.rotDraw.makeVisible();// = true; 
                //}
            }
        });

    window.bonestepDebug = () => {
        interactionSolve = false;
        autoSolve = false;
        setDOMtoInternalState();
        const tempOrig = new THREE.Vector3(0, 0, 0);

        window.contextArmature?._debug_bone(selectedBone, undefined, bonestepcallbacks);
    }


    window.pullbackDebug = () => {
        interactionSolve = false;
        autoSolve = false;
        setDOMtoInternalState();

        let callbacks = new CallbacksSequence(
            {
                beforePullback: (bone, ts, wb) => {
                    if (bone == window.contextBone) {
                        initLines(wb);
                        //let solveString = getdbgstring(bone, ts, wb);
                        //console.log(wb.lastReturnfulResult.fullRotation.toString());
                        //window.intersectsDisplay.innerText = solveString;
                    }
                },
                afterPullback: (bone, ts, wb) => {
                    if (bone == window.contextBone) {
                        let solveString = getdbgstring(bone, ts, wb);
                        wb.lastReturnfulResult.fullRotation.toConsole();
                        wb.lastReturnfulResult.fullRotation.length();
                        window.intersectsDisplay.innerText = `${solveString}`;
                    }
                }
            });
        window.contextArmature?._doSinglePullbackStep(window.contextBone, undefined, 0, callbacks);
    }

    D.byid('pullback-btn').addEventListener('click', async () => {
        interactionSolve = false;
        autoSolve = false;
        setDOMtoInternalState();
        window.pullbackDebug(window.contextArmature);
    });

    D.byid('solve-bone-btn').addEventListener('click', async () => {
        bonestepDebug()

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

    D.byid('pin-enabled').addEventListener("input", async (event) => {
        let state = event.target.checked;
        let diddisable = false;
        
        if (state) {
            let newPin = null;
            if (window.contextPin != null) {
                window.contextPin.enable();
                diddisable = true;
            } else if (window.contextBone != null) {
                newPin = new IKPin(window.contextBone);
            }
            makePinsList(1, window.contextBone.parentArmature.armatureObj3d, window.contextBone.parentArmature);
            if (!autoSolve) {
                await newPin?.forBone.parentArmature.regenerateShadowSkeleton(true);
                render();
            }

            window.contextBone.parentArmature.showBones(0.1, true);
            updateGlobalPinLists();
            if (diddisable) {
                select(window.contextPin.forBone);
            } else {
                select(newPin);
            }
        } else if (window.contextPin != null) {
            window.contextPin.disable();
            makePinsList(1, window.contextBone.parentArmature.armatureObj3d, window.contextBone.parentArmature);
            window.contextBone.parentArmature.showBones(0.1, true);
            updateGlobalPinLists();
            select(window.contextPin.forBone);
        }
    })

    D.byid("weight").addEventListener("input", (event) => {
        const unexp = event.target.parentNode.qs('.un-exp-output');
        window.contextPin?.setPinWeight(Math.pow(Math.E, event.target.value) - 1);
        unexp.value = window.contextPin.getPinWeight().toFixed(4);
    })

    D.byid("x-priority").addEventListener("input", (event) => {
        const unexp = event.target.parentNode.qs('.un-exp-output');
        window.contextPin?.setXPriority(Math.pow(Math.E, event.target.value) - 1);;
        window.contextArmature?.solve(window.contextBone);
        unexp.value = window.contextPin.getXPriority().toFixed(4);
    });
    D.byid("y-priority").addEventListener("input", (event) => {
        const unexp = event.target.parentNode.qs('.un-exp-output');
        window.contextPin?.setYPriority(Math.pow(Math.E, event.target.value) - 1);;
        window.contextArmature?.solve(window.contextBone);
        unexp.value = window.contextPin.getYPriority().toFixed(4);
    });
    D.byid("z-priority").addEventListener("input", (event) => {
        const unexp = event.target.parentNode.parentNode.qs('.un-exp-output');
        window.contextPin?.setZPriority(Math.pow(Math.E, event.target.value) - 1);;
        window.contextArmature?.solve(window.contextBone);
        unexp.value = window.contextPin.getZPriority().toFixed(4);
    });


    const defaultDampeningInput = D.byid('default-dampening');
    const iterationsInput = D.byid('iterations');
    const solveBtn = D.byid('solve-btn');
    const pullbackBtn = D.byid('pullback-btn');

    defaultDampeningInput.addEventListener('input', (event) => {
        const unexp = event.target.parentNode.qs('.un-exp-output');
        window.contextBone?.parentArmature?.setDampening((Math.pow(Math.E, event.target.value) - 1));
        unexp.value = (Math.pow(Math.E, event.target.value) - 1).toFixed(3);
    });

    iterationsInput.addEventListener('input', (event) => {
        window.contextBone?.parentArmature?.setDefaultIterations(event.target.value);
    });

    /*solveBtn.addEventListener('click', (e) => {
        window.contextBone?.parentArmature?.solve(window.contextBone);
    });

    pullbackBtn.addEventListener('click', () => {
        window.contextBone?.parentArmature?.doSinglePullbackStep(window.contextBone)
    });*/

    async function doNothing() {
        return false;
    }
    window.doNothing = doNothing;
    window.awaitingSelect = doNothing;

    window.toInterstitial = async function (intersticeMessage, onSelected) {
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

    window.cancelInterstice = async function () {
        D.byid("interstitial").classList.add("hidden");
        D.byid("mod-panel").classList.remove("hidden");
        window.awaitingSelect = window.doNothing;
    }

    D.byid("change-pin-parent").addEventListener('click', (e) => {
        if (window.contextPin != null) {
            window.toInterstitial("Click a bone or target to attach to. Or hit Esc to cancel",
                (selected) => {
                    if (selected != null) {
                        let transform = selected?.toTrack ?? selected;
                        transform.attach(window.contextPin.toTrack);
                    }
                });
        }
    })

    D.byid('show-mesh').addEventListener('change', function (e) {
        if(rendlrs != null)
            window.rendlrs?.layerState(window.meshLayer, e.target.checked);
    });

    D.byid('show-ik-bones').addEventListener('change', function (e) {
        for (let a of armatures) {
            if (a.ikReady) {
                for (let b of a.bones) {
                    if (b.bonegeo != null && a.skelState?.getBoneStateById(b.ikd) != null) {
                        if (e.target.checked) {
                            b.bonegeo.layers.enable(boneLayer);
                        } else {
                            b.bonegeo.layers.disable(boneLayer);
                        }
                    }
                }
            }
        }
        if (e.target.checked == false && D.byid('show-nonik-bones').checked == false) {
            if(rendlrs != null)
                rendlrs?.hide(boneLayer);
        } else {
            if(rendlrs != null)
                rendlrs?.show(boneLayer);
        }
    });

    D.byid('show-nonik-bones').addEventListener('change', function (e) {
        for (let a of armatures) {
            if (a.ikReady) {
                for (let b of a.bones) {
                    if (b.bonegeo != null && a.skelState?.getBoneStateById(b.ikd) == null) {
                        if (e.target.checked) {
                            b.bonegeo.layers.enable(boneLayer);
                        } else {
                            b.bonegeo.layers.disable(boneLayer);
                        }
                    }
                }
            }
        }
        if (e.target.checked == false && D.byid('show-ik-bones').checked == false) {
            if(rendlrs != null)
                rendlrs?.hide(boneLayer);
        } else {
            if(rendlrs != null)
                rendlrs?.show(boneLayer);
        }
    });

    D.byid('save').addEventListener('click', () => {
        serializeInstance(window.contextBone.parentArmature)
    })


    window.emptyConstraintNode = D.byid("default-stack").qs('.constraint-stack');


    window.createConstraintStackDomElem = function(c) {
        let newStack = constraintStackControls.cloneNode(true);
        let toReturn = newStack; 
        /*if(c.parentConstraint != null) {
            toReturn = createGenericConstraintContainer(c);
            toReturn.qs(".subconstraint-controls").appendChild(newStack);
        }*/
        
        newStack.qs(".add-constraint").addEventListener("click", (e) => {
            let val = newStack.parent.qs("constraint-select");
            let subcst = null;
            if (val == "kusudama") subcst = initKusudama(c);
            if (val == "twist") subcst = initTwist(c);
            if (val == "rest") subcst = initRest(c);
            if (val == "stack") subcst = initStack(c);
            if(subcst != null)
                newStack.qs(".subconstraints").appendChild(subcst);
        });

        let allChildren = [...c.allconstraints];
        let subconstraintContainer = toReturn.qs(".subconstraints");
        for(let subc of allChildren) {
            let childDom = getMakeConstraint_DOMElem(subc);
            if(childDom.parentNode != subconstraintContainer) {
                subconstraintContainer.appendChild(childDom);
            }
        }
        return toReturn; 
    }

    emptyConstraintNode.qs(".add-constraint").addEventListener("click", (e) => {
        if (window.contextBone != null) {
            let addType = (e).target.parentNode.qs(".constraint-select").value;
            let stack = window.contextBone.getConstraint();
            if (window.contextBone.getConstraint() == null) {
                stack = new ConstraintStack(window.contextBone);
            }
            emptyConstraintNode.remove();
            let constController = getMakeConstraint_DOMElem(forBone.getConstraint());
            htmlcontrols.byid("default-stack").appendChild(constController);
            let subcst = null;
            if (val == "kusudama") subcst = initKusudama(window.contextBone);
            if (val == "twist") subcst = initTwist(window.contextBone);
            if (val == "rest") subcst = initRest(window.contextBone);
            if (val == "stack") subcst = initStack(window.contextBone);
            constController.qs(".subconstraints").appendChild(subcst);
        }
    })

    window.genericConstraintRow = document.createElement("fieldset");
    genericConstraintRow.classList.add("generic-constraint-row");
    genericConstraintRow.innerHTML = `
    <legend></legend>
<input type='checkbox' name='constraint-enabled' class='constraint-enabled' checked>
<label for="constraint-enabled" >enabled</label>
</span><button class='remove-constraint'>X</button>
`
    window.createGenericConstraintContainer = function (c) {
        let result = genericConstraintRow.cloneNode(true);
        let text = "";
        if(c instanceof Rest) text="Rest Constraint:";
        if(c instanceof Twist) text = "Twist Constraint:"; 
        if(c instanceof ConstraintStack) text= "Stack:";  
        result.qs("legend").innerText = text;
        let enabled = result.qs(".constraint-enabled");
        enabled.addEventListener("change", (e) => {
            if (e.checked) c.enable();
            else c.disable();
        });

        let removeButton = result.qs(".remove-constraint");
        removeButton.addEventListener("click", (e) => {
            c.remove();
            result.remove();
        });
        if(c instanceof Returnful) {
            result.appendChild(createGenericReturnfulConfig(c));
        }
        return result;
    }

    window.genericReturnfulControls = document.createElement("div");
    genericReturnfulControls.classList.add("returnful-controls");
    genericReturnfulControls.innerHTML = `
    <span class="current-discomfort"> </span>
    <fieldset class="returnful-fields"> 
        <form class="painfulness-form">
            <input name="painfulness" type="range" min="0.0" max="1" step="0.00001" value="0.1">
            <label for="painfulness">Painfulness: </label>
            <output name="painfulness-output" for="painfulness" class="painfulness-output">0.1</output>
        </form>
        <form class="stockholm-form">
            <input name="stockholm" type="range" min="0.0" max="1" step="0.00001" value="0.1">
            <label for="stockholm">Stockholm rate: </label>
            <output name="stockholm-output" for="stockholm" class="stockholm-output">0.1</output>
        </form>
    </fieldset>
    `;
    window.createGenericReturnfulConfig = function (c) {
        let result = genericReturnfulControls.cloneNode(true);
        let range = result.qs(".painfulness-form");
        range.addEventListener("input", (event) => {
            c.setPainfulness(event.target.value);
            result.value = event.target.value;
        })
        let base = result.qs(".stockholm-form");
        base.addEventListener("input", (event)=> {
            c.setStockholmRate(event.target.value);
            result.value = event.target.value;
        });
        return result; 
    }

    window.restConstraintControls = document.createElement("div");
    restConstraintControls.classList.add("rest-constraint-controls");
    restConstraintControls.innerHTML = `
<button class="set-current-pose-as-rest">Pose as Reference</button>
<span class="current-discomfort"> </span>
`;

    window.createRestDomElem = function(forRest) {
        let genericContainer = createGenericConstraintContainer(forRest);
        let newRest = restConstraintControls.cloneNode(true);
        newRest.qs(".set-current-pose-as-rest").addEventListener("click", (e) => {
            forRest.setCurrentAsRest();
        });
        genericContainer.appendChild(newRest);
        return genericContainer;
    }

    window.twistConstraintControls = document.createElement("div");
    twistConstraintControls.classList.add("twist-constraint-controls");
    twistConstraintControls.innerHTML = `
    <button class="set-current-pose-as-reference">Pose as Reference</button>
    <span class="current-discomfort"> </span>
    <fieldset class="twist-fields"> 
        <form class="range-form">
            <input name="range" type="range" min="0.0" max="6.28318" step="0.00001" value="0.1">
            <label for="range">Range: </label>
            <output name="range-result" for="range" class="range-output">0.1</output>
        </form>
        <form class="base-form">
            <input name="base" type="range" min="0.0" max="6.28318" step="0.00001" value="0">
            <label for="base">Base: </label>
            <output name="base-result" for="base" class="base-output">0.1</output>
        </form>
    </fieldset>
    `;

    window.createTwistDomElem = function(forTwist) {
        let wrapper = createGenericConstraintContainer(forTwist);
        let result = twistConstraintControls.cloneNode(true);
        wrapper.appendChild(result);
        let range = result.qs(".range-form");
        range.addEventListener("input", (event) => {
            forTwist.setRange(event.target.value);
            result.value = event.target.value;
        })
        let base = result.qs(".base-form");
        base.addEventListener("input", (event)=> {
            forTwist.setBase(event.target.value);
            result.value = event.target.value;
        });
        result.qs('.set-current-pose-as-reference').addEventListener('click', (e) => {
            forTwist.setCurrentAsReference();
        });
        return wrapper;
    }

    window.constraintStackControls = document.createElement("fieldset");
    constraintStackControls.classList.add("constraint-stack");
    constraintStackControls.innerHTML = stackInnards;
    setDOMtoInternalState();
}


window.updateInfoPanel = async function (item) {
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
        if (bone.getConstraint() != null) constraintStack = bone.getConstraint();
        armature = bone.parentArmature;
    } else if (item instanceof IKPin) {
        intersectsDisplay.innerText = `
        Name: ${item.ikd}
        `;
        pin = item;
        bone = pin.forBone;
        if (bone.getConstraint() != null) constraintStack = bone.getConstraint();
        armature = bone.parentArmature;
    } else {
        D.byid("armature-name").innerText = "None Selected";
        
    }

    if (constraintStack != null) {
        let domConstraint = getMakeConstraint_DOMElem(constraintStack);
        let children = D.byid("default-stack").children;
        for(let [key, node] of Object.entries(children)) {
            node.remove();
        }
        D.byid("default-stack").appendChild(domConstraint);
    } else {
        D.byid("default-stack").appendChild(emptyConstraintNode);
    }

    /**@type {EWBIK} */
    window.contextArmature = armature;
    /**@type {Constraint} */
    window.contextConstraint = constraintStack;
    /**@type {IKPin} */
    window.contextPin = pin;
    /**@type {Bone} */
    window.contextBone = bone;

    const armDomName = D.byid("armature-name")
    const armDom = armDomName.parentNode.parentNode;

    if (window.contextArmature == null) {
        armDom.classList.add("hidden");
        D.byid("no-armature-opts-hint").classList.add("hidden");
        armDomName.innerText = "None Selected";
        D.byid("default-dampening").value = Math.pow(Math.E, 0.1);
        D.byid("default-dampening").parentNode.qs(".un-exp-output").value = 0.1;

    } else {
        armDom.classList.remove("hidden");
        D.byid("no-armature-opts-hint").classList.remove("hidden");
        armDomName.innerText = window.contextArmature.ikd;
        D.byid("default-dampening").value = Math.log(window.contextArmature.getDampening() + 1);
        D.byid("default-dampening").parentNode.qs(".un-exp-output").value = window.contextArmature.getDampening().toFixed(4);
        D.byid("iterations").value = window.contextArmature.getDefaultIterations();
    }

    if (window.contextBone == null) {
        D.byid("bone-fields").classList.add("hidden");
        D.byid("bone-name").innerText = "None Selected";
        D.byid("internal-bone-name").innerText = "None";
        D.byid("stiffness").value = 0;
        constraintStackControls.remove();
    } else {
        D.byid("bone-fields").classList.remove("hidden");
        D.byid("bone-name").innerText = window.contextBone.name;
        D.byid("internal-bone-name").innerText = window.contextBone.ikd;
        D.byid("stiffness").value = window.contextBone.getStiffness();
        constraintStackControls.remove();
    }

    const pinDom = D.byid("pin-options")
    const pinToggle = pinDom.parentNode.qs("#pin-enabled")
    const label =  pinToggle.nextElementSibling;
    const labelSpan =  pinToggle.nextElementSibling.querySelector('span');
    if (window.contextPin == null) {
        pinDom.classList.add("hidden");
        pinToggle.checked = false;
        label.classList.add("pre-init");
        labelSpan.innerText = "Pin Bone";
    }
    else if(window.contextPin.isEnabled() == false) {
        pinDom.classList.add("hidden");
        pinToggle.checked = false;
        label.classList.remove("pre-init");
        labelSpan.innerText = "Enable Pin";
    }
    else {
        pinDom.classList.remove("hidden");
        label.classList.remove("pre-init");
        labelSpan.innerText = "Pinned";
        pinToggle.checked = true;
        pinDom.qs("#weight").value = Math.log(window.contextPin.getPinWeight()+1);
        pinDom.qs("#weight").parentNode.qs(".un-exp-output").value =  window.contextPin.getPinWeight().toFixed(4);
        pinDom.qs("#x-priority").value = Math.log(window.contextPin.getXPriority()+1);
        pinDom.qs("#x-priority").parentNode.qs(".un-exp-output").value =  window.contextPin.getXPriority().toFixed(4);
        pinDom.qs("#y-priority").value = Math.log(window.contextPin.getYPriority()+1);
        pinDom.qs("#y-priority").parentNode.qs(".un-exp-output").value =  window.contextPin.getYPriority().toFixed(4);
        pinDom.qs("#z-priority").value = Math.log(window.contextPin.getZPriority()+1);
        pinDom.qs("#z-priority").parentNode.qs(".un-exp-output").value =  window.contextPin.getZPriority().toFixed(4);
        if (window.contextPin?.targetNode?.toTrack?.parent) {
            pinDom.qs("#pin-parent-mode-hint").innerText = "Current parent: ";
            let obj3dParentobj3d = window.contextPin.targetNode.toTrack.parent;
            let targetNodeParent = window.contextPin.targetNode.parent;
            let targetNodeParentobj3d = window.contextPin.targetNode.parent.toTrack;
            let name = obj3dParentobj3d.name;
            if (name.length == 0) name = obj3dParentobj3d.ikd;
            if (name == null) name = targetNodeParentobj3d?.name;
            if (name.length == 0) name = targetNodeParentobj3d?.ikd;
            if (name == null) name = targetNodeParent.ikd;
            pinDom.qs("#current-pin-parent").innerHTML = name;
        }
    }


}

/**
 * @param {(Constraint | ConstraintStack | Limiting | Returnful | LimitingReturnful)} c a constraint instance 
 * @return A DOM element appropriate for modifying the given constraint 
*/
window.getMakeConstraint_DOMElem = function (c) {
    let toReturn = c.domControls;
    if(toReturn != null) return toReturn;
   
    if (c instanceof Rest) {
        toReturn = createRestDomElem(c);
    }
    else if(c instanceof Twist) {
        toReturn = createTwistDomElem(c);
    }
    else if (c instanceof ConstraintStack) {        
        toReturn = createConstraintStackDomElem(c);
    }
    
    toReturn.forConstraint = c;
    c.domControls = toReturn;
    return toReturn;
}







/**updates the solver mode to a viable value in the dom if it's in a weird state */
window.setInternalStatetoDOM = function () {
    // Initialize solve mode based on existing variables

    if (D.byid('auto-solve')?.checked) {
        window.autoSolve = true;
        window.interactionSolve = false;
    }
    if (D.byid('interaction-solve')?.checked) {
        window.interactionSolve = true;
        window.autoSolve = false;
    } else if (D.byid('no-solve').checked) {
        window.interactionSolve = false;
        window.autoSolve = false;
    }
}

/**updates the dom to match the internal interaction mode */
window.setDOMtoInternalState = function () {
    // Initialize solve mode based on existing variables
    if (window.autoSolve) {
        D.byid('auto-solve').checked = true;
        D.byid('no-solve').checked = false;
        D.byid('no-solve').checked = false;
    } else if (window.interactionSolve) {
        D.byid('auto-solve').checked = false;
        D.byid('interaction-solve').checked = true;
        D.byid('no-solve').checked = false;
    } else {
        D.byid('auto-solve').checked = false;
        D.byid('interaction-solve').checked = false;
        D.byid('no-solve').checked = true;
    }
    window.setInternalStatetoDOM();
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