//import {getMakeConstraint_DOMElem} from "./UIelements.js";
//import { EWBIK } from "./EWBIK/EWBIK.js";



const dbgContainer = document.createElement('div');
dbgContainer.id = "info";
document.querySelector("body").appendChild(dbgContainer);
const intersectsDisplay = document.createElement('div');
intersectsDisplay.innerHTML = `Intersected Coordinates:`
window.dbgContainer = dbgContainer;
window.intersectsDisplay = intersectsDisplay;
dbgContainer.appendChild(intersectsDisplay);
window.perfing = false;
let debugstyle = document.createElement('style');
debugstyle.innerHTML = `
.grid-container {
    display: grid;
    grid-template-columns: auto auto auto auto; /* Four columns of equal size */
    grid-template-rows: auto auto; /* Two rows */
    gap: 10px; /* Space between grid items */
    align-items: center; /* Align items vertically */
    justify-content: start; /* Align content to the start horizontally */
    padding: 10px; /* Padding around the grid */
  }
  
  .grid-item {
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    box-sizing: border-box;
  }
  
  .debug-color-thingy {
    width: 24px;
    height: 24px;
    border-radius: 6px; 
  }

  .bottom {
    border-width-bottom: 12px;
    grid-row: 2/3;
  }

  .top {
    border-width-top: 12px;
    grid-row: 1/2;
  }

  .left {
    border-width-left: 12px;
    grid-column: 3/4;
  }

  .right {
    border-width-right: 12px;
    grid-column: 2/3;
  }
  
  .name.left {
    grid-column: 1 / 2;
  }
  
  .name.right {
    grid-column: 4 / 5;
  }
`;
document.querySelector("head").appendChild(debugstyle);
window.debugTransl = document.createElement('div');
debugTransl.classList.add('debug-transl');
debugTransl.innerHTML = `
    <div class='maybe-tracking-node-debug'>
        <div class='name left'></div>
        <div class='debug-color-thingy top left'></div>
    </div>
    <div class='maybe-tracking-node-debug'>
        <div class='debug-color-thingy bottom left'></div>
        <div class='name right'></div>  
    </div>
`;
dbgContainer.appendChild(window.debugTransl);
//intersectsDisplay

async function select(item) {
    if (item != null) {
        let completedThing = await window.awaitingSelect(item);
        if (completedThing) return;
    }
    if (item instanceof THREE.Bone) {
        selectedPin = null;
        selectedPinIdx = -1;
        window.selectedBone = item;
        window.selectedBoneIdx = boneList.indexOf(item);
        pinOrientCtrls.detach();
        pinOrientCtrls.enabled = false;
        //pinTranslateCtrls.enabled = false;
        boneCtrls.enabled = true;
        boneCtrls.attach(selectedBone);
        window.contextBone = selectedBone;
        window.contextPin = selectedBone.getIKPin() ?? null;
        window.contextArmature = selectedBone.parentArmature;
        window.contextConstraint = selectedBone.getConstraint() ?? null;
        window.contextBone.add(boneAxesHelper);
        boneAxesHelper.layers.set(window.boneLayer);
        window?.contextPin?.targetNode?.toTrack.add(pinAxesHelper);
        pinAxesHelper.layers.set(window.boneLayer);
    }
    if (item instanceof IKPin) {
        window.selectedPin = item;
        window.selectedPinIdx = pinsList.indexOf(selectedPin);
        selectedBone = null;
        selectedBoneIdx = -1;
        pinOrientCtrls.attach(targetsMeshList[selectedPinIdx]);
        //pinTranslateCtrls.attach(targetsMeshList[selectedPinIdx]);
        boneCtrls.detach();
        boneCtrls.enabled = false;
        pinOrientCtrls.enabled = true;
        window.contextPin = selectedPin;
        window.contextBone = window.selectedPin.forBone;
        window.contextArmature = window.contextBone.parentArmature;
        window.contextConstraint = window.contextBone.getConstraint() ?? null;
        window.contextBone.add(boneAxesHelper);
        boneAxesHelper.layers.set(window.boneLayer);
        window.contextPin.targetNode.toTrack.add(pinAxesHelper);
        pinAxesHelper.layers.set(window.boneLayer);
    }
    if (contextBone != window.prevContextBone) {
        window.prevContextBone?.setTempIKOrientationLock(false);
        if (contextBone != null)
            window.prevContextBone = contextBone;
    }
    updateInfoPanel(item);
}


function addSceneArmature(armature) {
    //window.armatures.push(armature);    
    //armature.inferOrientations(armature.rootBone);
    //initHumanoidRestConstraints(armature);
    D.byid(window.autoSolve ? 'auto-solve' : 'interaction-solve').checked = true;
    initIK(armature);
    updateGlobalPinLists();
    updateGlobalBoneLists();
}

function setPinVisibility(makeVisible) {
    for (let pin of pinsList) {
        pin.targetNode.toTrack.visible = makeVisible;
    }
}

function updateGlobalPinLists() {
    pinsList.splice(0, pinsList.length);
    targetsMeshList.splice(0, targetsMeshList.length);
    for (let a of armatures) {
        pinsList.push(...a.pinsList);
        targetsMeshList.push(...a.targetsMeshList);
    }
}

function updateGlobalBoneLists() {
    boneList.splice(0, boneList.length);
    boneMeshList.splice(0, boneMeshList.length);
    for (let a of armatures) {
        boneMeshList.push(...a.meshList);
        boneList.push(...a.bones);
    }
}

function makePinsList(pinSize, into = scene, armature) {
    armature.pinsList = [];
    armature.targetsMeshList = [];
    let previouslySelected = selectedPin;
    let boneList = armature.bones;
    let i = 0;
    for (let b of boneList) {
        if (b.getIKPin() != null) {
            let ikpin = b.getIKPin();
            let baseSize = ikpin.forBone.height;
            if (ikpin.targetNode.toTrack == null) {
                //let boneHeight = b.height
                const geometry = ikpin.forBone?.bonegeo?.geometry ?? new THREE.BoxGeometry(baseSize * pinSize / 2, b.height, baseSize * pinSize);
                //const material = new THREE.MeshLambertMaterial({ color: 0xff0000, transparent: true, opacity: 0.6});
                const material = new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true });
                const targMesh = new THREE.Mesh(geometry, material);
                //targMesh.position.set(0, b.height/2, 0);
                const meshWrapper = new THREE.Object3D();
                meshWrapper.add(targMesh);
                into.add(meshWrapper);
                meshWrapper.name = ikpin.ikd;
                meshWrapper.ikd = ikpin.ikd;
                meshWrapper.meshHint = targMesh;
                meshWrapper.layers.set(boneLayer);
                targMesh.layers.set(boneLayer);
                ikpin.targetNode.toTrack = meshWrapper;
                ikpin.alignToBone();

            }
            armature.pinsList.push(ikpin);
            armature.targetsMeshList.push(ikpin.targetNode.toTrack);
        }
        i++;
    }
    updateGlobalPinLists();
}


/**figures out if the import is fucked, and makes a polite attempt to unfuck it */
function defuckify(obj) {
    obj.traverse((child) => {
        if (child.scale.x != 1) {
            console.log("detected fuckery");
            child.scale.set(1, 1, 1);
            return false;
        }

    });
}

async function doSolve(bone = null, interacted = false, preSolveCallback = null, inSolveCallback = null, solveCompleteCallback = null) {
    /**@type {[EWBIK]} */
    let armatures = window.armatures ?? null;
    if (bone != null) armatures = [bone.parentArmature];

    //we loop through all armatures in the scene because some of the demos have multiple armatures interacting with one another
    for (let a of armatures) {
        if (a.ikReady) {
            if (autoSolve) {
                /*null indicates we're solving the whole armature*/
                await a.solve(null, undefined, 0, null, window.frameCount);
            }
            else if (interacted && interactionSolve) {
                await a.solve(bone, undefined, 0, null, window.frameCount);// callbacks);
            } else if (interacted && !interactionSolve) {
                //this is just to display the amount of pain a bone is in when interacting without solving.
                await a.noOp(bone);
            }
        }
    }
    //} 
    if (bone != null) {
        updateInfoPanel(bone);
    }
}

/**fucks with the scene hard. Makes everything from the rootnode up orthonormal*/
async function orthonormalize(startnode) {
    if (startnode instanceof THREE.Mesh || startnode instanceof THREE.SkinnedMesh) {
        return;
    }
    if (startnode.position != null && startnode.quaternion != null && startnode.children != null) {
        let oldChildren = [...startnode.children];
        for (let c of oldChildren) {
            window.scene.attach(c);
            console.log(c.name + "  scene attach");
        }
        startnode.scale.set(1, 1, 1);
        for (let c of oldChildren) {
            startnode.attach(c);
            console.log(c.name + "  par attach");
        }
        for (let c of startnode.children) {
            orthonormalize(c);
        }
    } else if (startnode.scene != null) return orthonormalize(startnode.scene);
}


function initControls(THREE, renderer) {
    window.axesHelperSize = 1;
    window.boneAxesHelper = new THREE.AxesHelper(axesHelperSize);
    window.pinAxesHelper = new THREE.AxesHelper(axesHelperSize);
    D.byid(window.autoSolve ? 'auto-solve' : 'interaction-solve').checked = true;
    window.THREE = THREE;
    raycaster = new THREE.Raycaster();
    raycaster.layers.enable(window.boneLayer);
    mouse = new THREE.Vector2();
    orbitControls = new OrbitControls(camera, renderer.domElement);
    orbitControls.target.y = 1;
    orbitControls.update();
    window.orbitControls = orbitControls;

    //camera.rotateX(0.65);
    orbitControls.addEventListener('change', render);

    boneCtrls = new TransformControls(camera, renderer.domElement);
    boneCtrls.space = 'local';

    boneCtrls.addEventListener('dragging-changed', function (event) {
        bone_transformActive = event.value;
        orbitControls.enabled = !event.value;
        pinOrientCtrls.enabled = !event.value;
        //pinTranslateCtrls.enabled = !event.value;
        //pinOrientCtrls.visible = !event.value;
        //pinTranslateCtrls.visible = !event.value;

        //console.log("Bone Dragging-Change");
        if (selectedBone?.parentArmature.ikReady) {
            /*if (selectedBone.getConstraint() && selectedBone.wb) {
                selectedBone?.wb?.simLocalAxes.adoptLocalValuesFromObject3D(selectedBone);
                let resultRot = selectedBone?.getConstraint()?.getAcceptableRotation(
                    selectedBone?.wb?.simLocalAxes,
                    selectedBone?.wb?.simBoneAxes,
                    Rot.IDENTITY,
                    this);
                selectedBone?.wb?.simLocalAxes.rotateByLocal(resultRot);
                contextArmature.armatureNode.constructor.transferLocalToObj3d(selectedBone?.wb?.simLocalAxes.localMBasis, selectedBone);
                selectedBone.updateMatrix();
            }*/
            doSolve(selectedBone, true);//.parentArmature.solve();

        }
        if (selectedBone.getConstraint() != null)
            selectedBone.getConstraint().updateDisplay();

    });
    boneCtrls.addEventListener('objectChange', function (event) {
        bone_transformActive = event.value;
        pinOrientCtrls.enabled = !event.value;
        //pinTranslateCtrls.enabled = !event.value;
        select(boneList[selectedBoneIdx]);
        /*if (selectedBone.getConstraint() && selectedBone.wb) {
            selectedBone?.wb?.simLocalAxes.adoptLocalValuesFromObject3D(selectedBone);
            let resultRot = selectedBone?.getConstraint()?.getAcceptableRotation(
                selectedBone?.wb?.simLocalAxes,
                selectedBone?.wb?.simBoneAxes,
                Rot.IDENTITY,
                this);
            selectedBone?.wb?.simLocalAxes.rotateByLocal(resultRot);
            contextArmature.armatureNode.constructor.transferLocalToObj3d(selectedBone?.wb?.simLocalAxes.localMBasis, selectedBone);
            //selectedBone.updateMatrix();
        }*/
        //console.log("Bone objectChange");
        if ((interactionSolve || autoSolve))
            selectedBone.setTempIKOrientationLock(true);
        else
            selectedBone.setTempIKOrientationLock(false);

        if (selectedBone?.parentArmature.ikReady) {
            doSolve(selectedBone, true);//.parentArmature.solve();
        }
        if (selectedBone.getConstraint() != null)
            selectedBone.getConstraint().updateDisplay();
        bone_transformDragging = true;

    });
    boneCtrls.mode = 'rotate';



    pinOrientCtrls = new TransformControls(camera, renderer.domElement);
    pinOrientCtrls.addEventListener('change', render);
    pinOrientCtrls.addEventListener('dragging-changed', function (event) {
        pin_transformActive = event.value;
        orbitControls.enabled = !event.value;
        boneCtrls.enabled = !event.value;
        //pinTranslateCtrls.enabled = !event.value;
        boneCtrls.visible = !event.value;
        pinOrientCtrls.visible = !event.value;
        //pinTranslateCtrls.visible = !event.value;
    });
    pinOrientCtrls.addEventListener('objectChange', function (event) {
        boneCtrls.enabled = false;
        pinOrientCtrls.visible = !event.value;
        //pinTranslateCtrls.visible = !event.value;
        pin_transformActive = event.value;
        pin_transformDragging = true;
        const tracknode = pinsList[selectedPinIdx].targetNode;
        tracknode.adoptTrackedLocal();
        if (selectedPin?.forBone.parentArmature.ikReady) {
            doSolve(contextBone, true);//.parentArmature.solve();
        }
        if (contextBone.getConstraint() != null)
            contextBone.getConstraint().updateDisplay();
        pinOrientCtrls.visible = false;
        //pinTranslateCtrls.visible = false;
        //armature.solve();
    });
    //pinOrientCtrls.mode = 'rotate';

    /*pinTranslateCtrls = new TransformControls(camera, renderer.domElement);
    pinTranslateCtrls.addEventListener('changed', render);
    pinTranslateCtrls.addEventListener('dragging-changed', function (event) {
        orbitControls.enabled = !event.value;
        boneCtrls.enabled = false;
        pinOrientCtrls.enabled = !event.value;
        pin_transformActive = event.value;

        pinOrientCtrls.visible = !event.value;
        pinTranslateCtrls.visible = !event.value;
        //render();
    });
    pinTranslateCtrls.addEventListener('objectChange', function (event) {
        //orbitControls.enabled = false;
        //boneCtrls.enabled = !event.value;
        pin_transformActive = event.value;
        pin_transformDragging = true;
        const tracknode = pinsList[selectedPinIdx].targetNode;
        tracknode.adoptTrackedLocal();
        if (interactionSolve && pinsList[selectedPinIdx].forBone?.parentArmature.ikReady)
            pinsList[selectedPinIdx].notifyOfChange();

        //pinOrientCtrls.visible = false;
        //pinTranslateCtrls.visible = event.value;
        boneCtrls.enabled = false;
        //pinOrientCtrls.enabled = !event.value;
    });*/
    //pinTranslateCtrls.mode = 'translate';
    scene.add(pinOrientCtrls);
    scene.add(boneCtrls);
    setLayerrec(boneCtrls, window.boneLayer);
    setLayerrec(pinOrientCtrls, window.boneLayer);
    pinOrientCtrls.mode = 'combined';
    pinOrientCtrls.getRayCaster().layers.set(boneLayer);
    boneCtrls.getRayCaster().layers.set(boneLayer);
    pinOrientCtrls.size = 1.5;
    //pinOrientCtrls.size = 0.5;
    //pinTranslateCtrls.size = 1.2;
    //scene.add(pinTranslateCtrls);



    window.addEventListener('click', (event) => {
        let downdelta = Date.now() - lastmousedown;
        if (pin_transformActive || downdelta > 250 || bone_transformActive) {
            return;
        }
        if (event.target != renderer.domElement) return;

        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const intersectsPin = raycaster.intersectObjects(targetsMeshList, true).filter(elem => elem.object instanceof THREE.AxesHelper == false);
        selectedPinIdx = targetsMeshList.indexOf(intersectsPin[0]?.object.parent);
        const intersectsBone = raycaster.intersectObjects(boneMeshList, false).filter(elem => elem.object instanceof THREE.AxesHelper == false);
        selectedBoneIdx = boneList.indexOf(intersectsBone[0]?.object.forBone);
        if (selectedPinIdx == -1) {
            pinOrientCtrls.detach();
            //pinTranslateCtrls.detach();
            if (intersectsBone[0]?.object != null) {
                selectedBone = boneList[selectedBoneIdx];
                select(selectedBone);
            }
            selectedPin = null;
        } else {

            //pinTranslateCtrls.enabled = true;
            selectedPin = pinsList[selectedPinIdx];
            select(selectedPin);
        }
        if (selectedBoneIdx == -1) {
            boneCtrls.detach();
            if (selectedBone != null) {
                selectedBone.setTempIKOrientationLock(false);
                selectedBone = null;
            }
        }
        if (selectedPinIdx == -1 && selectedBoneIdx == -1) {
            select(null);
        }
    });

    boneCtrls.layers.set(window.boneLayer);
    pinOrientCtrls.layers.set(window.boneLayer);
    //pinTranslateCtrls.layers.enable(boneLayer);

    window.addEventListener('mousedown', (event) => {
        lastmousedown = Date.now();
        window.setDOMtoInternalState();
        //pinOrientCtrls.visible = false;//!((pin_transformDragging || selectedPinIdx >= 0) && pinOrientCtrls.enabled);
        //pinTranslateCtrls.visible = false;//!((pin_transformDragging || selectedPinIdx >= 0) && pinTranslateCtrls.enabled);
        //boneCtrls.visible = false;//!(bone_transformDragging || selectedBoneIdx >= 0);
    }, false);



    window.addEventListener('mouseup', (event) => {
        pinOrientCtrls.visible = (pin_transformDragging || selectedPinIdx >= 0) && pinOrientCtrls.enabled;
        //pinTranslateCtrls.visible = (pin_transformDragging || selectedPinIdx >= 0) && pinTranslateCtrls.enabled;
        boneCtrls.visible = bone_transformDragging || selectedBoneIdx >= 0;
        bone_transformDragging = false;
        pin_transformDragging = false;
        window.setDOMtoInternalState();
    }, false);

    boneCtrls.layers.set(window.boneLayer);
    //boneCtrls.getRayCaster().layers.set(window.boneLayer);

    document.addEventListener('keydown', function (event) {
        switchSelected(event.key);
    });
}

function setLayerrec(object, layerNumber) {
    object.traverse((child) => {
        child.layers.set(layerNumber);
    });
}


window.doTo = function (elem, callback, dirtyRates = true, regen = true) {
    let prevauto = autoSolve;
    if (Array.isArray(elem)) {
        for (let e of elem) {
            callback(e);
        }
    }
    else {
        callback(elem);
    }
    for (let a of armatures) {
        if (dirtyRates) a.updateShadowSkelRateInfo();
        if (regen) a.regenerateShadowSkeleton();
    }
    autoSolve = prevauto;
}

function findThing(startNode, name) {
    if (startNode, name == name)
        return [startNode];
    for (let c of startNode.children) {
        console.log(c.type);
        let result = [...findThing(c)];
        //if (result instanceof THREE.Bone) {
        return result;
        //}
    }
}

function findBone(startNode) {
    if (startNode instanceof THREE.Bone)
        return startNode;
    for (let c of startNode.children) {
        console.log(c.type + " " + c.name);
        let result = findBone(c);
        if (result instanceof THREE.Bone) {
            return result;
        }
    }
}


function printBoneNames(startNode, depth = 0) {
    if (startNode instanceof THREE.Bone) {
        console.log('-'.repeat(depth) + ': ' + startNode.name);
    }
    for (let c of startNode?.children) {
        //console.log(c.type);
        printBoneNames(c, depth + 1);
    }
}

function initPrettyBones(armature, mode, override, depth = 999) {
    armature._maybeInferOrientation(armature.rootBone, mode, override, depth - 1);
    armature.showBones(0.1, true);
}

function initIK(armature) {

    //armature.regenerateShadowSkeleton(true);

    armature.regenerateShadowSkeleton(false);
    armature.ikReady = true;
}

async function switchSelected(key) {
    switch (key) {
        case 'Escape':
            window.cancelInterstice()
            break;
        case '1':
            selectedBoneIdx = (selectedBoneIdx + 1) % boneList.length
            selectedBone = boneList[selectedBoneIdx];
            boneCtrls.attach(selectedBone);
            selectedBone.add(boneAxesHelper);
            select(selectedBone)
            break;
        case '2':
            selectedBoneIdx = (selectedBoneIdx + (boneList.length - 1)) % boneList.length
            selectedBone = boneList[selectedBoneIdx];
            boneCtrls.attach(selectedBone);
            selectedBone.add(boneAxesHelper);
            select(selectedBone)
            break;
        case 'p':
            selectedPinIdx = (selectedPinIdx + 1) % pinsList.length;
            pinOrientCtrls.attach(targetsMeshList[selectedPinIdx]);
            //pinTranslateCtrls.attach(targetsMeshList[selectedPinIdx]);
            select(pinsList[selectedPinIdx]);
            break;
        case 'n':
            interactionSolve = false;
            autoSolve = false;
            document.getElementById("no-solve").checked = true;
            break;
        case 's': //button, do a single solver step, should be disabled if autosolve is true
            armatureSolve()
            break;
        case '-': //button, do a single pullback iteration.
            pullbackDebug();
            break;
        case 'a': //radio select, always solve. 
            autoSolve = !autoSolve;
            break;
        case 'b':
            bonestepDebug();
            break
        case '+':
            armatureStepDebug();
            break;
        case 'i': //radio select, only solve when interacting with a pin.
            autoSolve = false;
            interactionSolve = !interactionSolve;
            document.getElementById("interaction-solve").checked = interactionSolve;
            //doSolve();
            break;
        case 'r': //checkbox toggle the rotate widget
            pinOrientCtrls.enabled != pinOrientCtrls.enabled;
            break;
        case 't': //checkbox, toggle the translate widget
            window.perfing = !window.perfing;
            //pinTranslateCtrls.enabled != pinTranslateCtrls.enabled;
            break;
    }
}



window.serializeInstance = function (instance, in_progress = {}) {
    const serialized = {};
    const className = instance.constructor.name;

    // Initialize the class type tracker in in_progress if not already present
    if (!in_progress[className]) {
        in_progress[className] = {};
    }

    for (const key of Object.keys(instance)) {
        const value = instance[key];
        const type = typeof value;

        if (type === 'string' || type === 'number' || type === 'boolean' || value === null) {
            serialized[key] = value;
        } else if (value instanceof Object) {
            if (value.constructor.name === 'Rot' || value.constructor.name === 'Vec3') {
                serialized[key] = value.constructor.name === 'Rot' ? [value.x, value.y, value.z, value.w] : [value.x, value.y, value.z];
            } else if ('ikd' in value) {
                // Check if this ikd has already been processed to avoid infinite loops
                if (in_progress[value.constructor.name] && in_progress[value.constructor.name][value.ikd]) {
                    serialized[key] = value.ikd; // Reference to already serialized object
                } else {
                    // Serialize this new object
                    serialized[key] = value.ikd;
                    if (!in_progress[value.constructor.name]) {
                        in_progress[value.constructor.name] = {};
                    }
                    in_progress[value.constructor.name][value.ikd] = serializeInstance(value, in_progress);
                }
            }
        }
    }

    // If the instance has an ikd, it should be stored in in_progress
    if ('ikd' in instance) {
        if (!in_progress[className][instance.ikd]) {
            in_progress[className][instance.ikd] = serialized;
        }
    } else {
        // For instances without ikd, we handle them as needed. Here it's returned directly.
    }

    return { serialized, in_progress };
}

window.getTranslationColor = (position, range) => {
    const inverseLerp = (a, b, value) => {
        return Maath.min(Math.max((value - a) / (b - a), 1), 0);
    };
    const r = inverseLerp(-range, range, position.x);
    const g = inverseLerp(-range, range, position.y);
    const b = inverseLerp(-range, range, position.z);
    return `rgb(${toColorValue(r)}, ${toColorValue(g)}, ${toColorValue(b)})`;
};

function toDebugColor(debugObj, groupedelem, range, vert = null, horiz = null) {


    let titlefield = element.querySelector("name");
    let element = groupedelem.querySelector("debug-color-thingy");

    if (vert != null) {
        titlefield.classList.remove("top", "bottom");
        element.classList.remove("top", "bottom");
        element.classList.add(vert);
    }
    if (horiz != null) {
        titlefield.classList.remove("left", "right");
        element.classList.remove("left", "right");
        element.classList.add(horiz);
    }

    element.style.backgroundColor = getTranslationColor(debugObj.localPosition, range);
    element.style.borderColor = getTranslationColor(debugObj.worldPosition, range);

    titlefield.innerText = debugObj.name;
    element.title = `${debugObj.name} translation. Range (${-range.toFixed(3)}, ${range.toFixed(3)}).\n
    X=red, Y=green, Z=blue.\n
    Border Color -> Wordlspace,\n 
    Innner Color -> Localspace,\n
    Local Position: (${debugObj.localPos.x.toFixed(3)}, ${debugObj.localPos.y.toFixed(3)}, ${debugObj.localPos.z.toFixed(3)})\n 
    World Position: (${debugObj.worldPos.x.toFixed(3)}, ${debugObj.worldPos.y.toFixed(3)}, ${debugObj.worldPos.z.toFixed(3)})`;
}

function addDebugFuncs(THREE) {
    THREE.Object3D.prototype.getDebug = function () {
        const worldPosition = new THREE.Vector3();
        this.getWorldPosition(worldPosition);
        const result = {
            localPos: this.position,
            worldPos: worldPosition,
            name: this.name ?? this.ikd
        }
        return result;
    }

    THREE.Object3D.prototype.toVis = function (groupedelem, range = 1, vert = null, horiz = null) {
        let debugObj = this.getDebug();
        window.toDebugColor(debugObj, groupedelem, range, vert, horiz);
        return groupedelem;
    };

    THREE.Object3D.prototype.toStr = function (showscale = false) {
        // Helper function to convert quaternion to axis-angle
        function quaternionToAxisAngle(quaternion) {
            if (quaternion.w > 1) quaternion.normalize(); // if w > 1 acos and sqrt will produce errors, this cant happen if quaternion is normalised
            const angle = 2 * Math.acos(quaternion.w);
            let x, y, z;
            const s = Math.sqrt(1 - quaternion.w * quaternion.w); // assuming quaternion normalised then w is less than 1, so term always positive.
            if (s < 0.001) { // test to avoid divide by zero, s is always positive due to sqrt
                // if s close to zero then direction of axis not important
                x = quaternion.x; // if it is important that axis is normalised then replace with x=1; y=z=0;
                y = quaternion.y;
                z = quaternion.z;
            } else {
                x = quaternion.x / s; // normalise axis
                y = quaternion.y / s;
                z = quaternion.z / s;
            }
            return { axis: new THREE.Vector3(x, y, z), angle: angle };
        }

        // Local space info
        const localPosition = this.position;
        const localQuaternion = this.quaternion;
        const localScale = this.scale;
        const localAxisAngle = quaternionToAxisAngle(localQuaternion);

        // World space info
        const worldPosition = new THREE.Vector3();
        const worldQuaternion = new THREE.Quaternion();
        const worldScale = new THREE.Vector3();
        this.getWorldPosition(worldPosition);
        this.getWorldQuaternion(worldQuaternion);
        this.getWorldScale(worldScale);
        const worldAxisAngle = quaternionToAxisAngle(worldQuaternion);
        let globscalestr = showscale ? `Scale: ${worldScale.x.toFixed(3)}, ${worldScale.y.toFixed(3)}, ${worldScale.z.toFixed(3)}` : '';
        let localScalestr = showscale ? `Scale: ${localScale.x.toFixed(3)}, ${localScale.y.toFixed(3)}, ${localScale.z.toFixed(3)}` : '';
        return `GLOBAL Space Info for object (${this.name}): 
Position: ${worldPosition.x.toFixed(3)}, ${worldPosition.y.toFixed(3)}, ${worldPosition.z.toFixed(3)}
Rotation: Axis(${worldAxisAngle.axis.x.toFixed(3)}, ${worldAxisAngle.axis.y.toFixed(3)}, ${worldAxisAngle.axis.z.toFixed(3)}), Angle(${THREE.MathUtils.radToDeg(worldAxisAngle.angle).toFixed(3)}°)
${globscalestr}
    ----
    LOCAL 
${localPosition.x.toFixed(3)}, ${localPosition.y.toFixed(3)}, ${localPosition.z.toFixed(3)}
Rotation : Axis(${localAxisAngle.axis.x.toFixed(3)}, ${localAxisAngle.axis.y.toFixed(3)}, ${localAxisAngle.axis.z.toFixed(3)}), Angle(${THREE.MathUtils.radToDeg(localAxisAngle.angle).toFixed(3)}°)
${localScalestr}`;
    };
    THREE.Object3D.prototype.toString = THREE.Object3D.prototype.toStr;
    THREE.Object3D.prototype.toConsole = function (showscale = false) { console.log(this.toStr(showscale)) }
}