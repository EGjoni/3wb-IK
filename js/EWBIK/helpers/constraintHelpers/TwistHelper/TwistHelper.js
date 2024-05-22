import * as THREE from 'three';

const { Constraint, Twist, LimitingReturnful} = await import("../../../betterbones/Constraints/ConstraintStack.js");
import { ConstraintHelper } from '../ConstraintHelper.js';

export class TwistHelper extends ConstraintHelper {

    
    constructor(forTwist, visibilityCondition) {
        super(forTwist, visibilityCondition);
        this.forTwist = forTwist;
        this.forBone = forTwist.forBone;
        this.display = new TwistConstraintDisplay(this.forTwist.range, 1, this.forTwist);
        this.zhintgeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,1)]);
        this.zhintmat_safe = new THREE.LineBasicMaterial({ color: new THREE.Color(0,0,1), linewidth: 3});
        this.zhintmat_ouch = new THREE.LineBasicMaterial({ color: new THREE.Color(0.9,0,0.3), linewidth: 3});
        this.zhint = new THREE.Line(this.zhintgeo, this.zhintmat_safe);
        this.zhintgeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,1)]);
        this.zhintmat_safe = new THREE.LineBasicMaterial({ color: new THREE.Color(0,0,1), linewidth: 3});
        this.zhintmat_ouch = new THREE.LineBasicMaterial({ color: new THREE.Color(0.9,0,0.3), linewidth: 3});
        this.zhint = new THREE.Line(this.zhintgeo, this.zhintmat_safe);
        this.tempDrawRot1 = new Rot(1,0,0,0);
        this.tempDrawRot2 = new Rot(1,0,0,0);
        this.add(this.zhint);
        this.add(this.display);      
        this.updateZHint();  
    }

    regenDisplay(twist) {
        if(super.regenDisplay(twist) == null) return null;
        this.forTwist.frameCanonical.localMBasis.writeToTHREE(this);
        this.display.updateGeo(this.forTwist.range, 1);//this.forBone.height*this.tempTHREEVec.y);
        this.scale.set(1,1,1);
        this.scale.multiplyScalar(this.forBone.height / this.worldScale);
        return this;
    }

    async updateDisplay(twist) {
        this.updateZHint();
    }

    updateZHint() {
        if(!this.visible) return;
        //sheer paranoia
        this.forTwist.__bone_internal.emancipate();
        this.forTwist.__bone_internal.reset();
        this.forTwist.__bone_internal.localMBasis.lazyRefresh();
        this.forTwist.__frame_internal.emancipate();
        this.forTwist.__frame_internal.reset();
        this.forTwist.__frame_internal.localMBasis.lazyRefresh();
        this.forTwist.__frame_internal.markDirty()
        this.forTwist.__bone_internal.setRelativeToParent(this.forTwist.__frame_internal);
        this.forTwist.__bone_internal.adoptLocalValuesFromObject3D(this.forBone.getIKBoneOrientation());
        

        this.forTwist.__frame_internal.adoptLocalValuesFromObject3D(this.forBone);        

        //now that we're sure the lineage is properly set up, let's destroy it entirely.
        //set the internal bone relative to the canonical frame / basis axes in global space so we can y-axis align in local space
        this.forTwist.__bone_internal.setParent(this.forTwist.frameCanonical);
        let yAlignRot = this.tempDrawRot1.setFromVecs(this.forTwist.__bone_internal.localMBasis.getYHeading(), this.forTwist.pool.any_Vec3(0,1,0));
        this.forTwist.__bone_internal.rotateByLocal(yAlignRot);        
        let newZ = this.forTwist.__bone_internal.localMBasis.getZHeading();
        newZ.normalize();
        newZ.mult(this.display.displayRadius);
        
        //we're already in the same space the visualization is defined in, so we just draw the z-heading from here.
        const positions = this.zhint.geometry.attributes.position;
        positions.array[3] = newZ.x;
        positions.array[4] = newZ.y;
        positions.array[5] = newZ.z;
        positions.needsUpdate = true;

        if(this.forTwist.__bone_internal.localMBasis.rotation.shorten().getAngle() > this.forTwist.range/2) {
            this.zhint.material = this.zhintmat_ouch;
        } else {
            this.zhint.material = this.zhintmat_safe;
        }

        //put everything back the way we found it.
        this.forTwist.__bone_internal.setRelativeToParent(this.forTwist.__frame_internal);
        this.forTwist.__bone_internal.adoptLocalValuesFromIKNode(this.forTwist.boneCanonical);
        this.forTwist.__frame_internal.adoptLocalValuesFromIKNode(this.forTwist.frameCanonical);
    }

    printInitializationString(doPrint=true, parname) {
        let tag = '';
        for(let [t, b] of Object.entries(this.forBone.parentArmature.bonetags)) {
            if(b == this.forBone) {
                tag = t; break;
            }
        }
        parname = parname == null ? `armature.bonetags["${tag}"]` : parname;
        let postPar = parname==null ? '' : `.forBone`;
        let ta = this.forTwist.twistAxis;
        let result = `new Twist(${parname}, ${this.forTwist.range}, undefined, 
                armature.stablePool.any_Vec3(${ta.x}, ${ta.y}, ${ta.z}), 
                ${this.forTwist.baseZ},
                "${this.forTwist.ikd}", 
                armature.stablePool)`;
        result += `.setPainfulness(${this.forTwist.getPainfulness()})`;
        result += `.setStockholmRate(${this.forTwist.getStockholmRate()})`;
        if(this.forTwist.enabled == false) 
            result += '.disable()';
        
        result+=';\n';
        if(this.forTwist.autoGen) result = '';
        if(doPrint) 
            console.log(result);
        else return result;
    }
}


class TwistConstraintDisplay extends THREE.Mesh {
    forTwist = null;
    mesh = null;
    static material = new THREE.MeshBasicMaterial({ color: 0xaa9922, side: THREE.DoubleSide, transparent: true, opacity: 0.8});
    constructor(range = Math.PI*2-0.0001, displayRadius = 1, forTwist = null) {
        let geo = new THREE.CircleGeometry(displayRadius, 100, (Math.PI / 2) - (range/2), range);
        super(geo, TwistConstraintDisplay.material);
        this.displayRadius = displayRadius;
        this.rotation.x = Math.PI/2;
        this.forTwist = forTwist;
    }

    updateGeo(range = this?.forTwist?.range ?? null, radius = this.displayRadius) {        
        if(range == null) 
            throw new Error("needs a range");
        this.displayRadius = radius;
        this.geometry.dispose();
        this.geometry = new THREE.CircleGeometry(radius, 100, (Math.PI / 2) - (range/2), range);
        this.rotation.x = Math.PI/2;
    }

   

    dispose() {
        this.geometry.dispose();
        this.remove();
    }
}