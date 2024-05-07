
/*const dbgContainer = document.createElement('div');
dbgContainer.id = "info";
document.querySelector("body").appendChild(dbgContainer);
const intersectsDisplay = document.createElement('div');
intersectsDisplay.innerHTML = `Intersected Coordinates:`
window.dbgContainer = dbgContainer;
window.intersectsDisplay = intersectsDisplay;
dbgContainer.appendChild(intersectsDisplay);*/
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
//document.querySelector("head").appendChild(debugstyle);
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
//dbgContainer.appendChild(window.debugTransl);
window.selectedPin = null;
window.pinsList = [];
window.targetsMeshList = [];
window.armatures = window.armatures ? window.armatures : [];
window.boneList = window.boneList ? window.boneList : [];
window.boneMeshList = window.boneMeshList ? window.boneMeshList : [];
//intersectsDisplay

async function select(item) {
    if (item != null) {
        if (window.awaitingSelect) {
            let completedThing = await window.awaitingSelect(item);
            if (completedThing) return;
        }
    }

    if (window.activeSelection == item && item instanceof THREE.Bone && item.getIKPin() != null)
        item = item.getIKPin();
    if (window.activeSelection == item && item instanceof IKPin && !window.pinsOnly)
        item = item.forBone;

    if (item instanceof IKPin) {
        window.selectedPin = item;
        window.selectedPinIdx = pinsList.indexOf(selectedPin);
        selectedBone = null;
        selectedBoneIdx = -1;
        if (!item.nonInteractive)
            pinOrientCtrls.attach(targetsMeshList[selectedPinIdx]);
        //pinTranslateCtrls.attach(targetsMeshList[selectedPinIdx]);
        boneCtrls.detach();
        boneCtrls.enabled = false;
        pinOrientCtrls.enabled = true;
        window.contextPin = selectedPin;
        window.contextBone = window.selectedPin.forBone;
        window.contextArmature = window.contextBone.parentArmature;
        window.contextConstraint = window.contextBone.getConstraint() ?? null;
        window.contextBone.getIKBoneOrientation().add(boneAxesHelper);
        boneAxesHelper.layers.enableAll();
        window.contextPin.targetNode.toTrack.add(pinAxesHelper);
        pinAxesHelper.layers.enableAll();
        window.activeSelection = contextPin;
        if (item?.parent instanceof THREE.Bone && window.pinsOnly != true)
            item.forBone.parent.previouslySelectedDescendant = item.forBone.parent.getChildBoneList().indexOf(item.forBone);
        if (item.nonInteractive && window.pinsOnly != true)
            item = item.forBone;

        if (contextPin != null) {
            if (!contextPin?.hasOrientation()) {
                pinOrientCtrls.mode = 'translate';
            }
            if (!contextPin?.hasTranslation()) {
                pinOrientCtrls.mode = 'rotate';
            }
            if (contextPin.hasOrientation() && contextPin.hasTranslation()) {
                pinOrientCtrls.mode = 'combined';
            }
        }

    }
    if (!window.pinsOnly) {
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
            window.contextBone.getIKBoneOrientation().add(boneAxesHelper);
            boneAxesHelper.layers.enableAll();
            window?.contextPin?.targetNode?.toTrack.add(pinAxesHelper);
            pinAxesHelper.layers.enableAll();
            window.activeSelection = contextBone;
            if (item?.parent instanceof THREE.Bone)
                item.parent.previouslySelectedDescendant = item.parent.getChildBoneList()?.indexOf(item) ?? 0;
        }

        if (contextBone != window.prevContextBone) {
            window.prevContextBone?.setTempIKOrientationLock(false);
            if (contextBone != null)
                window.prevContextBone = contextBone;
        }
    } else if (window.pinsOnly) {
        boneCtrls.enabled = false;
        boneCtrls.visible = false;
    }

    if (contextPin != null) {
        setOrbit(contextPin.targetNode.mimic());
    }

    if (contextBone != null && contextBone.trackedBy != null) {
        setOrbit(contextBone.trackedBy.mimic());
    }
    
    if (window.updateInfoPanel)
        updateInfoPanel(item);
}


/**@param {Object3D|IKNode} obj an object to set as the camera's orbit origin*/
function setOrbit(obj) {
    let newTarg = null;
    if(!(obj instanceof THREE.Object3D)) {
        newTarg = obj.origin();
    } else {
        newTarg = new window.Vec3()
        let worldPos = obj.position.clone();
        obj.getWorldPosition(worldPos);
        newTarg.readFromTHREE(worldPos);
    }
    let camVec = new window.Vec3();
    camVec.readFromTHREE(camera.position);
    let camTarg = new window.Vec3();
    camTarg.readFromTHREE(orbitControls.target);
    let lookDir = camTarg.subClone(camVec).normalize();
    
    newTarg.subClone(camVec).projectedOn(lookDir, newTarg).add(camVec);
    newTarg.writeToTHREE(orbitControls.target);
}

/**
 * forces the camera to immediately look at the given object. keeps it at least min orbit dist away as necessary
 * @param {Object3D|IKNode} obj 
 */
function snapToFocus(obj, minStartDist =0.1) {
    let newTarg = null;
    if(obj instanceof IKNode) {
        newTarg = obj.origin();
    } else {
        newTarg = new window.Vec3()
        let worldPos = obj.position.clone();
        obj.getWorldPosition(worldPos);
        newTarg.readFromTHREE(worldPos);
    }

    let minheight = 0;
    let camFlat = newTarg.clone().readFromTHREE(camera.position); 
    camFlat.sub(newTarg); camFlat.y = 0;
    if(camFlat.mag() < minStartDist) {
        camera.position.y = newTarg.y;
        camFlat.mult(minStartDist); 
        camera.position.x = camFlat.x;
        camera.position.z = camFlat.z;
        camera.updateMatrix();
    }
    newTarg.writeToTHREE(orbitControls.target); 
    orbitControls.update();
}


function addSceneArmature(armature, makePrettyBones = true, initPinList = true, prettyBoneMode = 'plate') {
    //window.armatures.push(armature);    
    //armature.inferOrientations(armature.rootBone);
    //initHumanoidRestConstraints(armature);
    if (makePrettyBones) {
        initPrettyBones(armature, prettyBoneMode, undefined, false, undefined);
    }
    if (initPinList) {
        makePinsList(1, armature.armatureObj3d, armature);
    }
    armature.regenerateShadowSkeleton(false);
    armature.ikReady = true;
    if (armatures.indexOf(armature) == -1) armatures.push(armature);
    updateGlobalPinLists();
    updateGlobalBoneLists();
}


function initIK(armature) {
    armature.regenerateShadowSkeleton(false);
    armature.ikReady = true;
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
        a.recolorPreviewSkel();
    }
}

function updateGlobalBoneLists() {
    boneList.splice(0, boneList.length);
    boneMeshList.splice(0, boneMeshList.length);
    for (let a of armatures) {
        boneMeshList.push(...a.meshList);
        boneList.push(...a.bones);
        a.recolorPreviewSkel();
    }
    for (let b of boneList) {
        if (b.getConstraint()) {
            b.getConstraint().layers.disable(window.meshLayer);
            b.getConstraint().layers.set(window.constraintLayer);
        }
        if (b?.parentArmature && b.bonegeo) {
            if (b.parentArmature?.shadowSkel?.isSolvable(b)) {
                b.bonegeo.layers.set(window.boneLayer);
            } else {
                b.bonegeo.layers.set(window.boneLayer + 1);
            }
        }
    }
}


function makePinMeshHint(ikpin, pinSize, into, alignMesh = false) {
    //let boneHeight = b.height
    let baseSize = ikpin.forBone.height;
    const targHint = ikpin.forBone.bonegeo != null ? ikpin.forBone.bonegeo : ikpin.forBone.getIKBoneOrientation();
    targHint.updateWorldMatrix();
    const globalTrans = targHint.matrixWorld;
    const geometry = ikpin.forBone?.bonegeo?.geometry ?? new THREE.BoxGeometry(baseSize * pinSize / 2, ikpin.forBone.height, baseSize * pinSize);

    //const material = new THREE.MeshLambertMaterial({ color: 0xff0000, transparent: true, opacity: 0.6});
    const material = new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: false }); 
    material.transparent = true; material.opacity = 0.5;
    const targMesh = new THREE.Mesh(geometry, material);


    const posOnlyGeo = new THREE.SphereGeometry(ikpin.forBone.height / 3);
    const posOnlyMat = new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: false });
    posOnlyMat.transparent = true; posOnlyMat.opacity = 0.5;
    const posTargMesh = new THREE.Mesh(posOnlyGeo, posOnlyMat)
    //targMesh.position.set(0, b.height/2, 0);

    let addTo = null;
    if (ikpin.target_threejs != null) {
        addTo = ikpin.target_threejs; //ikpin.targetNode.toTrack;
    }
    targMesh.matrix.copy(globalTrans);
    targMesh.matrix.decompose(targMesh.position, targMesh.quaternion, targMesh.scale);
    posTargMesh.matrix.decompose(posTargMesh.position, posTargMesh.quaternion, posTargMesh.scale);
    posTargMesh.updateMatrix();
    if (alignMesh) {
        addTo.attach(targMesh);
        targMesh.position.set(0, 0, 0);
        targMesh.quaternion.set(0, 0, 0, 1);
        targMesh.updateMatrix();

        addTo.attach(posTargMesh);
        posTargMesh.position.set(0, 0, 0);
        posTargMesh.quaternion.set(0, 0, 0, 1);
        posTargMesh.updateMatrix();
    } else {
        addTo.add(targMesh);
        addTo.add(posTargMesh);
    }
    targMesh.name = ikpin.ikd;
    targMesh.ikd = ikpin.ikd;
    targMesh.layers.disableAll();
    posTargMesh.layers.disableAll();
    targMesh.layers.enable(window.boneLayer);
    posTargMesh.layers.enable(window.boneLayer);
    targMesh.layers.enable(window.boneLayer+1);
    posTargMesh.layers.enable(window.boneLayer+1);
    targMesh.forPin = ikpin;
    posTargMesh.forPin = ikpin;
    ikpin.hintMesh = targMesh;
    if (ikpin.nonInteractive) {
        targMesh.material.color.set(new THREE.Color(0, 0, 0));
        posTargMesh.material.color.set(new THREE.Color(0, 0, 0));
    }
    ikpin.orientTargMesh = targMesh;
    ikpin.posOnlyMesh = posTargMesh;
    ikpin.updateHintMesh();
    return targMesh;
}

function makePinsList(pinSize, into = scene, armature, align = false, domakemesh = false) {
    armature.pinsList = [];
    armature.targetsMeshList = [];
    let previouslySelected = selectedPin;
    let boneList = armature.bones;
    let i = 0;


    for (let b of boneList) {
        if (b.getIKPin() != null) {
            let ikpin = b.getIKPin();
            if (align) {
                ikpin.alignToBone();
            }
            if (ikpin.targetNode.toTrack == null || (domakemesh && ikpin.hintMesh == null)) {
                ikpin.hintMesh = makePinMeshHint(ikpin, pinSize, undefined, true);
                if (ikpin.targetNode.toTrack == null) ikpin.targetNode.setTracked(ikpin.hintMesh);
            }
            ikpin.ensure();

            armature.pinsList.push(ikpin);
            armature.targetsMeshList.push(ikpin.target_threejs);
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
                await a.solve(null, undefined, 0, null, undefined, undefined, window.frameCount);
            }
            else if (interacted && interactionSolve) {
                await a.solve(bone, undefined, 0, null, undefined, undefined, window.frameCount);// callbacks);
            } else if (interacted && !interactionSolve) {
                //this is just to display the amount of pain a bone is in when interacting without solving.
                await a.noOp(bone);
            }
        }
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

function getMeshDescendants(object) {
    const meshes = [];
    object.traverse((child) => {
        if (child.isMesh) {
            meshes.push(child);
        }
    });
    return meshes;
}
window.frameCount = 0;
function setElemLayers() {

}

function initControls(THREE, renderer) {
    renderer.autoClear = false;
    setElemLayers();
    window.axesHelperSize = 1;
    window.boneAxesHelper = new THREE.AxesHelper(axesHelperSize);
    window.pinAxesHelper = new THREE.AxesHelper(axesHelperSize);
    window.THREE = THREE;
    raycaster = new THREE.Raycaster();
    raycaster.layers.enable(window.boneLayer);
    raycaster.layers.enable(window.boneLayer + 1);
    window.mouse = new THREE.Vector2();
    window.orbitControls = new OrbitControls(camera, renderer.domElement);
    orbitControls.startTarget = orbitControls.target.clone();
    orbitControls.targetOffset = new THREE.Vector3(0, 0, 0);
    orbitControls.target.y = 1;
    //orbitControls.update();
    window.orbitControls = orbitControls;

    //camera.rotateX(0.65);
    //orbitControls.addEventListener('change', render);

    boneCtrls = new TransformControls(camera, renderer.domElement);
    boneCtrls.space = 'local';
    boneCtrls.layers.disable(0);
    boneCtrls.layers.enable(boneLayer);
    boneCtrls.layers.enable(boneLayer + 1);

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
            hideControlPanel();
        }
        if (selectedBone.getConstraint() != null) {
            window.FKConstrain(selectedBone, selectedBone.getConstraint());
            selectedBone.getConstraint().updateDisplay();
        }

    });
    boneCtrls.addEventListener('objectChange', function (event) {
        bone_transformActive = event.value;
        pinOrientCtrls.enabled = !event.value;
        //pinTranslateCtrls.enabled = !event.value;
        if (contextBone !== boneList[selectedBoneIdx])
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
        if (selectedBone.getConstraint() != null) {
            window.FKConstrain(selectedBone, selectedBone.getConstraint());
            selectedBone.getConstraint().updateDisplay();
        }
        hideControlPanel();
        bone_transformDragging = true;

    });
    boneCtrls.mode = 'rotate';



    pinOrientCtrls = new TransformControls(camera, renderer.domElement);
    pinOrientCtrls.space = 'local'
    pinOrientCtrls.layers.enable(3);
    pinOrientCtrls.layers.enable(3);
    //pinOrientCtrls.addEventListener('change', render);
    pinOrientCtrls.addEventListener('dragging-changed', function (event) {
        pin_transformActive = event.value;
        orbitControls.enabled = !event.value;
        boneCtrls.enabled = !event.value;
        //pinTranslateCtrls.enabled = !event.value;
        boneCtrls.visible = !event.value;
        pinOrientCtrls.visible = !event.value;
        hideControlPanel();
        //pinTranslateCtrls.visible = !event.value;
    });
    pinOrientCtrls.addEventListener('objectChange', function (event) {
        boneCtrls.enabled = false;
        pinOrientCtrls.visible = !event.value;
        //pinTranslateCtrls.visible = !event.value;
        pin_transformActive = event.value;
        pin_transformDragging = true;
        const tracknode = pinsList[selectedPinIdx].targetNode;
        tracknode.mimic();
        if (selectedPin?.forBone.parentArmature.ikReady) {
            doSolve(contextBone, true);//.parentArmature.solve();
        }
        hideControlPanel();
        /*if (selectedBone.getConstraint() != null) {
            window.FKConstrain(selectedBone, selectedBone.getConstraint());
            selectedBone.getConstraint().updateDisplay();
        }*/
        pinOrientCtrls.visible = false;
        //pinTranslateCtrls.visible = false;
        //armature.solve();
    });

    scene.add(pinOrientCtrls);
    scene.add(boneCtrls);
    setLayerrec(boneCtrls, window.boneLayer);
    setLayerrec(pinOrientCtrls, 3);
    pinOrientCtrls.getRayCaster().layers.enable(3);
    pinOrientCtrls.getRayCaster().layers.enable(3);
    boneCtrls.getRayCaster().layers.enable(boneLayer);
    boneCtrls.getRayCaster().layers.enable(boneLayer + 1);
    pinOrientCtrls.size = 1;
    //pinOrientCtrls.size = 0.5;
    //pinTranslateCtrls.size = 1.2;
    //scene.add(pinTranslateCtrls);

    window.addEventListener('mousemove', (event) => {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }, false);



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
        /*selectedPinIdx = targetsMeshList.indexOf(intersectsPin[0]?.object.forPin.targetNode.toTrack);
        selectedPinIdx = selectedPinIdx < 0 ? selectedPinIdx : selectedPinIdx/2; */
        //selectedPinIdx = -1;
        let pendingPinSelect = intersectsPin[0]?.object?.forPin;
        const intersectsBone = raycaster.intersectObjects(boneMeshList, false).filter(elem => elem.object instanceof THREE.AxesHelper == false);
        selectedBoneIdx = boneList.indexOf(intersectsBone[0]?.object.forBone);
        if (pendingPinSelect == null) {
            pinOrientCtrls.detach();
            selectedPin = null;
            selectedPinIdx = -1;
            if (intersectsBone[0]?.object != null) {
                selectedBone = boneList[selectedBoneIdx];
                select(selectedBone);
            }

        } else {
            select(pendingPinSelect);
        }
        if (selectedBoneIdx == -1) {
            boneCtrls.detach();
            if (selectedBone != null) {
                selectedBone.setTempIKOrientationLock(false);
                selectedBone = null;
            }
        }
        if (pendingPinSelect == null && selectedBoneIdx == -1) {
            select(null);
        }
    });

    /*boneCtrls.layers.enable(boneLayer);
    boneCtrls.layers.enable(boneLayer+1);*/
    pinOrientCtrls.layers.enableAll();
    pin_transformActive = false;
    pin_transformDragging = false;
    selectedPinIdx = -1;
    selectedBoneIdx = -1;
    selectedPin = null;
    selectedBone = null;
    bone_transformActive = false;
    bone_transformDragging = false;
    selectedBoneIdx = -1;
    //pinTranslateCtrls.layers.enable(boneLayer);

    window.addEventListener('mousedown', (event) => {
        lastmousedown = Date.now();
        if (window.setDOMtoInternalState)
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
        if (window.setDOMtoInternalState)
            window.setDOMtoInternalState();
        showControlPanel();
    }, false);

    //boneCtrls.layers.enable(window.boneLayer); 
    //boneCtrls.layers.enable(window.boneLayer+1);
    //boneCtrls.getRayCaster().layers.set(window.boneLayer);

    document.addEventListener('keydown', function (event) {
        switchSelected(event.key);
    });
}


function hideControlPanel() {
   if(window.tempHideControls) window.tempHideControls();

}

function showControlPanel() {
if(window.unHideControls) window.unHideControls();

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

function findBone(startNode, multiple = false) {
    let result = [];
    if (startNode instanceof THREE.Bone) {
        if (!multiple) return startNode;
        return [startNode];
    }
    for (let c of startNode.children) {
        console.log(c.type + " " + c.name);
        let res = findBone(c, multiple);
        if (!multiple && res instanceof THREE.Bone) {
            return res;
        }
        result.push(...res);
    }
    return result;
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

function initPrettyBones(armature, prettyBoneMode = 'plate', boneRadius = 0.1, override, depth = 999) {
    armature._maybeInferOrientation(armature.rootBone, 'statistical', override, depth - 1);
    armature.generateBoneMeshes(boneRadius, true, prettyBoneMode);
}

async function switchSelected(key) {
    let active, activePar, candidateSiblings, toSelect;
    active = window.contextBone;
    activePar = active?.parent;
    if (activePar != null) {
        activePar.previouslySelectedDescendant = activePar.previouslySelectedDescendant ?? 0;
        candidateSiblings = activePar instanceof Bone ? activePar.getChildBoneList() : activePar.children;
    }
    switch (key) {
        case 'Escape':
            window.cancelInterstice()
            break;
        case '[': //previous bone
            selectedBoneIdx = (selectedBoneIdx + 1) % boneList.length
            selectedBone = boneList[selectedBoneIdx];
            boneCtrls.attach(selectedBone);
            selectedBone.getIKBoneOrientation().add(boneAxesHelper);
            select(selectedBone)
            break;
        case ']': //next bone
            selectedBoneIdx = (selectedBoneIdx + (boneList.length - 1)) % boneList.length
            selectedBone = boneList[selectedBoneIdx];
            boneCtrls.attach(selectedBone);
            selectedBone.getIKBoneOrientation().add(boneAxesHelper);
            select(selectedBone)
            break;
        case 'ArrowLeft': //previous sibling
            if (activePar == null) break;
            toSelect = candidateSiblings[(activePar.previouslySelectedDescendant + 1) % candidateSiblings.length];
            if (toSelect == null || toSelect == active) break;
            select(toSelect);
            break;
        case 'ArrowRight': //next sibling
            if (activePar == null) break;
            toSelect = candidateSiblings[(activePar.previouslySelectedDescendant + (candidateSiblings.length - 1)) % candidateSiblings.length];
            if (toSelect == null || toSelect == active) break;
            select(toSelect);
            break;
        case 'ArrowUp': //previously selected descendant if one was set, or first descendant otherwise
            if (active == null) break;
            let candidateChildren = active.getChildBoneList();
            if (candidateChildren.length == 0) break;
            active.previouslySelectedDescendant ??= 0;
            toSelect = candidateChildren[Math.max(0, active.previouslySelectedDescendant) % candidateSiblings.length];
            if (toSelect == null) break;
            select(toSelect);
            break;
        case 'ArrowDown': //ancestor
            if (activePar == null || !(activePar instanceof Bone)) break;
            select(activePar);
            break;
        case ' ': //select again (for contextual selection cycles on between, for example, a bone and its target)
            select(active);
            break;
        case 'p':
            selectedPinIdx = (selectedPinIdx + 1) % pinsList.length;
            if (!targetsMeshList[selectedPinIdx].nonInteractive) {
                pinOrientCtrls.attach(targetsMeshList[selectedPinIdx]);
            }
            //pinTranslateCtrls.attach(targetsMeshList[selectedPinIdx]);
            select(pinsList[selectedPinIdx]);
            break;
        case 'n':
            interactionSolve = false;
            autoSolve = false;
            if (document.getElementById('no-solve'))
                document.getElementById("no-solve").checked = true;
            break;
        //case 's': //button, do a single solver step, should be disabled if autosolve is true
        //    armatureSolve()
        //    break;
        case '-': //button, do a single pullback iteration.
            pullbackDebug();
            break;
        //case 'a': //radio select, always solve. 
        //    autoSolve = !autoSolve;
        //    break;
        case 'b':
            bonestepDebug();
            break
        case '+':
            armatureStepDebug();
            break;
        case 'i': //radio select, only solve when interacting with a pin.
            autoSolve = false;
            interactionSolve = !interactionSolve;
            if (document.getElementById("interaction-solve"))
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

window.addEventListener('resize', onWindowResize, false);
function onWindowResize() {
    if (window.camera == null) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    render();
}