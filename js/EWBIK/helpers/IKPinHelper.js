import * as THREE from "three";
import { IKPin} from "../betterbones/IKpin.js";
import { BufferGeometry } from "../../three/three.module.js";
import { LayerGroup } from "./LayerGroup.js";


/**
 * A helper for visualizing ewbIK targets and effectors.
 * The visualization mode can be one
 * 1. 'BoneGeo' Makes a copy of the bone geometry and uses it as a visual hint as to the target location
 * 2. 'BoxGeo' Creates a box with dimensions appropriate to the bone 
 * 3. Custom Just uses whatever geometry you specify. 
 * 
 * For both BoneGeo and BoxGeo, the visualization automatically switches to a sphere if the target has no orientation components
 * The helper will automatically be made a child of the IKPin it's meant for.
 */
export class IKPinHelper extends THREE.Object3D {
    forPin = null;
    vizType = 'BoneGeo';
    pinColor = new THREE.Color('red');
    frozenColor = new THREE.Color('gray');
    _nonInteractive = false; //hint for any selection handlers as to whether or not this pin is intended to be interacted with
    /**
    * @param {IKPin} forPin 
    * @param {String | BufferGeometry} vizType can be one of 
    *   1. 'BoneGeo' Makes a copy of the bone geometry and uses it as a visual hint as to the target location
    *   2. 'BoxGeo' Creates a box with dimensions appropriate to the bone 
    *   3. Custom Just uses whatever geometry object you provide. 
    * @param {Function} visibilityCondition optional callback to determine when this helper should be visible. 
    * If one isn't provided, the helper will always be visible when the armature is visible.
    */
    constructor(forPin, vizType =  'BoneGeo', visibilityCondition) {
        super();
        this.forPin = forPin;
        this.layers = new LayerGroup(this, (val, mask) => {
            let me = this;
            me.traverse(o => {
                if(me == o) return;
                if(o instanceof THREE.Object3D) {
                    o.layers.mask = mask;
                }
            })
        });
        this.vizType = vizType;
        this.forPin.target_threejs.add(this);
        this.forPin.helper = this;
        this.setVisibilityCondition(visibilityCondition);
        this.forPin.registerModListener((forPin) => {this.updateHintMesh(forPin)});
        this.regeneratePinMeshHint(this.vizType);
    }

    get nonInteractive() {return this._nonInteractive;}

    set nonInteractive(val) {
        this._nonInteractive = val;
        if (this._nonInteractive) {
            targMesh.material.color.set(this.frozenColor);
            posTargMesh.material.color.set(this.frozenColor);
        } else {
            targMesh.material.color.set(this.pinColor);
            posTargMesh.material.color.set(this.pinColor);
        } 
    }

    

   regeneratePinMeshHint(vizType) {
        this.vizType = vizType;
        let ikpin = this.forPin;
        let affectorOffset = ikpin.forBone.getAffectoredOffset();
        let addTo = this;

        /**
         * Our goal is to get the mesh in the space of the affectored offset and rebase it in the equivalent space of target_threejs
         */

        const targHint = ikpin.forBone.bonegeo != null ? ikpin.forBone.bonegeo : ikpin.forBone.getIKBoneOrientation();
        targHint.updateWorldMatrix();
        const globalTrans = targHint.matrixWorld;
        const localTrans = targHint.matrix;
        let geometry = this.vizType instanceof THREE.BufferGeometry ? this.vizType : ikpin.forBone?.bonegeo?.geometry;     
        geometry = this.vizType == 'BoxGeo' || geometry == null ? new THREE.BoxGeometry(baseSize * pinSize / 2, ikpin.forBone.height, baseSize * pinSize) 
                                                                : geometry; 
        let useColor = this.nonInteractive ? this.frozenColor : this.pinColor;
        const material = new THREE.MeshBasicMaterial({ color: useColor, wireframe: false }); 
        material.transparent = true; material.opacity = 0.5;
        const targMesh = new THREE.Mesh(geometry, material);
    
        const posOnlyGeo = new THREE.SphereGeometry(ikpin.forBone.height / 3);
        const posOnlyMat = new THREE.MeshBasicMaterial({ color: useColor, wireframe: false });
        posOnlyMat.transparent = true; posOnlyMat.opacity = 0.5;
        const posTargMesh = new THREE.Mesh(posOnlyGeo, posOnlyMat)

        targMesh.matrix.copy(globalTrans);
        targMesh.matrix.decompose(targMesh.position, targMesh.quaternion, targMesh.scale);
        posTargMesh.position.copy(targMesh.position);
        posTargMesh.quaternion.copy(targMesh.quaternion);
        posTargMesh.scale.copy(targMesh.scale);

        let affectorWorld = affectorOffset.clone();
        this.parent.attach(affectorWorld);
        affectorWorld.attach(targMesh);
        affectorWorld.attach(posTargMesh);
        affectorWorld.position.set(0,0,0);
        affectorWorld.quaternion.set(0,0,0,1);
        
        addTo.attach(targMesh);
        addTo.attach(posTargMesh);
        targMesh.position.set(0,0,0);
        targMesh.quaternion.set(0,0,0,1);
        posTargMesh.position.set(0,0,0);
        posTargMesh.quaternion.set(0,0,0,1);
        affectorWorld.parent.remove(affectorWorld);
        
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
        
        this.orientTargMesh = targMesh;
        this.posOnlyMesh = posTargMesh;
        this.hintMesh = targMesh;
        this.updateHintMesh();
        return targMesh;
    }


    /**changes the displayed hintmesh based on whether the target has an orientation */
    updateHintMesh() {
        if(this.hintMesh != null && this.posOnlyMesh != null && this.orientTargMesh != null) {
            this.posOnlyMesh.forPin = this.forPin;
            this.orientTargMesh.forPin = this.forPin;
            this.hintMesh.visible = false;
            this.posOnlyMesh.visible = false;
            this.orientTargMesh.visible = false;
            if(!this.forPin.hasOrientation()) {
                this.hintMesh = this.posOnlyMesh;
            } else {
                this.hintMesh = this.orientTargMesh;
            }
            this.hintMesh.visible = true;
        }
    }
       

    /**a callback function to determine whether to display this ikpin */
    setVisibilityCondition(visibleCallback) {
        if (visibleCallback ==null) 
            this._visibilityCondition = (forPin, forBone) => true;
        else { 
            this._visibilityCondition = visibleCallback;
        }
    }
    _visibilityCondition(forPin, forBone) {
        return false;
    }

    set visible(val) {
        this._visible = val; 
    }
    get visible() {
        return this._visible && this._visibilityCondition(this.forPin, this.forPin.forBone);
    }

}