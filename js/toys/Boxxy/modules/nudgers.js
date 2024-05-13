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

    pinOrientCtrls = new TransformControls(camera, renderer.domElement);
    pinOrientCtrls.layers.enableAll;
    scene.add(pinOrientCtrls);
    scene.add(boneCtrls);
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
    let camFlat = newTarg.tempClone().readFromTHREE(camera.position); 
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