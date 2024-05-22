import {  Vec3, any_Vec3} from "../../vecs.js";
import { Ray, Rayd, Rayf } from "../../Ray.js";
import { IKNode } from "../IKNodes.js";
const THREE = await import('three');
import { Quaternion, Vector3, Object3D, Matrix4 } from "three";
import { Rot } from "../../Rot.js";
import { Saveable } from "../../loader/saveable.js";

export class IKTransform extends Saveable {
    static totalTransforms = 0;
    static LEFT = -1;
    static RIGHT = 1;
    static NONE = -1;
    static X = 0;
    static Y = 1;
    static Z = 2;
    static xBase = new Vec3(1,0,0);
    static yBase = new Vec3(0,1,0);
    static zBase = new Vec3(0,0,1);
    static normal_ref = new Vec3(1,1,1);
    static zeroMat = new Matrix4().set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);

    static compositionsDirty =          0b000001;
    static inverseCompositionsDirty =   0b000010;
    static precompInverseDirty =        0b000100;
    static headingsDirty =              0b001000;
    static orthonHeadingsDirty =        0b010000;
    static raysDirty =                  0b100000;
    static allDirty =                   0b111111;
    state = 0b0;

    xNormDir = 1; yNormDir = 1; zNormDir = 1; //used for orthonormal heading direction

    /**@type {Vec3}*/
    xScaled_only = null;
    /**@type {Vec3}*/
    yScaled_only = null;
    /**@type {Vec3}*/
    zScaled_only = null;
    /**@type {Vec3}*/
    _xSkewed = null;
    /**@type {Vec3}*/
    _ySkewed = null;
    /**@type {Vec3}*/
    _zSkewed = null;

    /**@type {Vec3} full xheading after rotation, scale, and skew (no translation)*/
    _xHeading = null;
    /**@type {Vec3} full yheading after rotation, scale, and skew (no translation)*/
    _yHeading = null;
    /**@type {Vec3} full zheading after rotation, scale, and skew (no translation)*/
    _zHeading = null;

    /**@type {Vec3} full xheading after rotation (no scale skew or translation), though negation is preserved*/
    _orthon_xHeading = null;
    /**@type {Vec3} full yheading after rotation (no scale skew or translation), though negation is preserved*/
    _orthon_yHeading = null;
    /**@type {Vec3} full zheading after rotation (no scale skew or translation), though negation is preserved*/
    __orthon_zHeading = null;

    id = IKTransform.totalTransforms;
    forceOrthonormality = false;
    forceUniformity = false;
    forceOrthogonality = false;
    isUniform = true;
    wasOrthogonal = false;
    isOrthogonal = true;
    isOrthoUniform = true;
    isOrthoNormal = true;

    chirality = IKTransform.RIGHT;
    /**
     * @type {Rot}
     * @defaultValue `Rot.IDENTITY.clone()`
     */
    rotation = Rot.IDENTITY.clone();
    scale = null; //vector containing scale on each axis
    mag = null; //vector containing magnitude of each axis
    /**@type {Rot} */
    _inverseRotation = Rot.IDENTITY.conjugated();
    /** the skew matrix, as represented by taking the literal additive difference from each basis of the scale matrix. This just gets added back in upon recomposition.
     * I guess part of me had always just passively assumed that skew interacted with scale, but I guess it doesn't. So there's your anticlimactic fact for the day.
    */
    skewMatrix = new THREE.Matrix4().copy(IKTransform.zeroMat); 
    skewMatrix_e = this.skewMatrix.elements;
    scaleMatrix = new THREE.Matrix4(); //the transformation matrix without any skew, rotation, or translation
    scaleMatrix_e = this.scaleMatrix.elements;
    composedMatrix = new THREE.Matrix4(); //the transformation matrix in all of its cold, austere glory.
    composedMatrix_e = this.composedMatrix.elements;
    inverseComposedMatrix = new THREE.Matrix4(); //It's about balance.
    inverseComposedMatrix_e = this.inverseComposedMatrix.elements;
    secretMatrix = new THREE.Matrix4().copy(IKTransform.zeroMat); //doesn't exist. Don't tell anyone.
    secretMatrix_e = this.secretMatrix.elements;
    tempQuat = new THREE.Quaternion();
    tempTransVector3 = new THREE.Vector3();
    tempScaleVector3 = new THREE.Vector3();
    tempWhateverVector3 = new THREE.Vector3();
    

    toJSON() {
        let result = super.toJSON();
        let r = result;
        r.translate = this.translate.toJSON();
        r.scale = this.scale.toJSON();
        r.skewMatrix = this.skewMatrix_e;
        r.rotation = this.rotation.toJSON();
        r.forceOrthonormality = this.forceOrthonormality;
        return r;
    }
    getRequiredRefs(){
        return {};
    }

    static fromJSON(json, loader, pool, scene) {
        let result = new IKTransform(undefined,undefined,undefined,undefined,json.ikd, pool);
        result.rotation = Rot.fromJSON(json.rotation);
        result.scale = Vec3.fromJSON(json.scale, pool, scene);
        result.skewMatrix.elements = json.skewMatrix;
        result.instanceNumber = json.instanceNumber;
        result.state = IKTransform.allDirty;
        return result;
    }

    /**
     * 
     * @param {instanceof IKTransform or Vec3 or Ray} origin if IKTransform, other arguments are ignored and a copy is made of the input IKTransform, otherwise the origin Vec3 is treated as the origin of the newly created basis.
     * @param {Ray or Vec3} x x direction heading or ray
     * @param {Ray or Vec3} y y direction heading or ray
     * @param {Ray or Vec3} z z direction heading or ray
     */
    constructor(origin=null, x = null, y = null, z = null, ikd = 'IKTransform-'+(IKTransform.totalTransforms++), pool= globalVecPool) {
        super(ikd, 'IKTransform', IKTransform.totalTransforms, pool);
        this.translate = this.pool.new_Vec3(0,0,0);
        this.scale = this.pool.new_Vec3(1,1,1);
        this.mag = this.pool.new_Vec3(1,1,1);
        this.xScaled_only = this.pool.new_Vec3fv(IKTransform.xBase);
        this.yScaled_only = this.pool.new_Vec3fv(IKTransform.yBase);
        this.zScaled_only = this.pool.new_Vec3fv(IKTransform.zBase);
        this._xHeading = this.pool.new_Vec3();
        this._yHeading = this.pool.new_Vec3();
        this._zHeading = this.pool.new_Vec3();
        this._orthon_xHeading = this.pool.new_Vec3();
        this._orthon_yHeading = this.pool.new_Vec3();
        this._orthon_zHeading = this.pool.new_Vec3();
               
        if (origin instanceof IKTransform) {
            this.initializeBasisAtOrigin(origin);
        } else if (origin instanceof Ray && x instanceof Ray && y instanceof Ray) {
            this.initializeBasisFromRays(origin, x, y, z);
        } else if (origin != null) {            
            this.initializeBasisFromDirections(origin, x, y, z);
        } else {
            this.scaleMatrix.makeScale(this.scale.x, this.scale.y, this.scale.z);
            this.initializeRays(this.translate);
        }
        this.lazyRefresh();
    }


    static newPooled(pool) {
        return new IKTransform(undefined, undefined, undefined, undefined, undefined, pool);
    }

    initializeBasisAtOrigin(origin) {
        this.translate.set(origin);
        this.setBaseVectors();
        this.initializeRays(translate);
        this.lazyRefresh();
    }

    /**
     * 
     * @param {Ray} x 
     * @param {Ray} y 
     * @param {Ray} z 
     */
    initializeBasisFromRays(x, y, z) {
        this.secretMatrix.identity();
        x.p1.writeInto(this.secretMatrix_e, 12);
        x.setToHeadingArr(this.secretMatrix_e, 0);
        y.setToHeadingArr(this.secretMatrix_e, 4);
        z.setToHeadingArr(this.secretMatrix_e, 8);
        this.setFromMatrix4(this.secretMatrix_e);
    }

    /**
     * updates storeIn to contain the globalspace heading of the provided input vector
      */
    getHeading(invec, storeIn = this.pool.any_Vec3(0,0,0)) {
        this.setVecToGlobalOf(invec, storeIn);
        storeIn.sub(this.translate);
        storeIn.normalize();
        return storeIn;
    }

    /**extracts skew by default */
    setFromMatrix4(mat4, extractSkew = true) {
        const pos = this.tempTransVector3;
        const quat = this.tempQuat;
        const scale = this.tempScaleVector3;
        this.isOrthoNormal = this.forceOrthonormality;
        this.wasOrthogonal = this.isOrthogonal;
        this.isOrthogonal = this.forceOrthogonality;
        this.isUniform = this.forceUniformity;
        mat4.decompose(pos, quat, scale);
        this.translate.setComponents(pos.x, pos.y, pos.z);
        this.rotation.setComponents(quat.w, -quat.x, -quat.y, -quat.z);
        this.scale.setComponents(scale.x, scale.y, scale.z);
        this._updateNorms();
        this.rotation.normalize();
        let avgMag = this.mag.sum()/3;
        //this.scaleMatrix.makeScale(scale.x, scale.y, scale.z);

        this.state |= IKTransform.allDirty;
        

        if(!extractSkew) {
            this._updateOrthoDefaults(avgMag);
        } else {
            /** 
            * this only touches the rotational components, and writes directly into the skewmatrix values,
            * so we end up with a matrix representing the difference between the orthogonal matrix and the actual matrix,
            * which we just add back up upon recomposition
            */
            this.rotation.setToInversion(this._inverseRotation);
            this.inverseRotation.applyBeforeMatrix4_rot(mat4.elements, this.skewMatrix_e);
            this._updateOrthoDefaults(avgMag);
            this._calcSkewMat(mat4.elements);
            this._updateOrthoNormalHint(avgMag);
        }
        if(this.isOrthogonal)
            this.skewMatrix.copy(IKTransform.zeroMat);        
    }

    _updateAllStructureHInts(){
        this._updateNorms();
        let avgMag = this.mag.sum()/3
        this._updateOrthoNormalHint(avgMag);
        this._updateOrthoDefaults(avgMag); 
    }

    _updateNorms() {
        this.mag.set(this.scale).absComponents();
        this.avgMag = this.mag.sum()/3;
        const scaledb = this.scale.dataBuffer; 
        const scalebx = this.scale.baseIdx;
        this.xNormDir = scaledb[scalebx] < 0 ? -1 : 1;
        this.yNormDir = scaledb[scalebx+1] < 0 ? -1 : 1;
        this.zNormDir = scaledb[scalebx+2] < 0 ? -1 : 1;
    }


    /**Warning: presumes the skew has already been calculated */
    _updateOrthoNormalHint() {
        const avgMag = this.avgMag;
        let v = this.pool.any_Vec3();
        let deltaScale = v.setComponents(avgMag, avgMag, avgMag).sub(this.mag).magnhattan()/3;
        this.isUniform = this.forceUniformity || deltaScale < 1e-6;
        this.isOrthogonal = true;
        this.forceOrthogonality = this.forceOrthogonality || this.forceOrthonormality; 
        if(!this.forceOrthogonality) {
            if(v.readFrom(this.skewMatrix_e, 0).magnhattan() > 1e-6)  this.isOrthogonal = false;
            if(v.readFrom(this.skewMatrix_e, 4).magnhattan() > 1e-6)  this.isOrthogonal = false;
            if(v.readFrom(this.skewMatrix_e, 8).magnhattan() > 1e-6)  this.isOrthogonal = false;
            if(!this.isOrthogonal) this.isUniform = false;
        } else {
            this.isOrthogonal = this.forceOrthogonality;            
        }
        this.isOrthoUniform = this.isOrthogonal && this.isUniform;
        this.isOrthoNormal = (this.forceOrthonormality || this.isOrthoUniform) && avgMag == 1;
    }

    _updateOrthoDefaults(avgMag = this.mag.sum()/3) { 
        const scaledb = this.scale.dataBuffer; 
        const scalebx = this.scale.baseIdx;           
        
        if(this.isOrthoNormal) {
            this.scale.setComponents(this.xNormDir, this.yNormDir, this.zNormDir);
            this.mag.setComponents(1,1,1);
        } else if(this.isUniform) {                       
            scaledb[scalebx]  = scaledb[scalebx]   < 0 ? -avgMag : avgMag;
            scaledb[scalebx+1] = scaledb[scalebx+1] < 0 ? -avgMag : avgMag;
            scaledb[scalebx+2] = scaledb[scalebx+2] < 0 ? -avgMag : avgMag;
        }
        if(this.isOrthogonal != this.wasOrthogonal) {
            this.skewMatrix.copy(IKTransform.zeroMat);
        } 
        this.scaleMatrix.makeScale(scaledb[scalebx], scaledb[scalebx+1], scaledb[scalebx+2]);
        this.isOrthoNormal = this.isUniform && this.isOrthogonal && Math.abs(avgMag-1) < 1e-6 ;      
    }

    _calcSkewMat(mat4_e) {
        this.rotation.setToInversion(this._inverseRotation);
        this.inverseRotation.applyBeforeMatrix4_rot(mat4_e, this.skewMatrix_e);
        IKTransform.matrixSub(this.scaleMatrix_e, this.skewMatrix_e);
        this.state &= ~IKTransform.precompInverseDirty;
    }

    /**Note, extracts skew by default*/
    setFromGlobalizedObj3d(object3d, extractSkew = true) {
        this.tempTransVector3.copy(IKNode.originthreevec)
        this.tempQuat.copy(IKNode.identitythreequat);
        this.tempScaleVector3.copy(IKNode.unitthreescale);
        object3d.updateWorldMatrix();
        this.setFromMatrix4(object3d.matrixWorld, extractSkew);
    }


    /*createPrioritzedRotation(xHeading, yHeading, zHeading) {		
        let tempV = zHeading.clone(); 
        tempV.setComponents(0,0,0);
        let toYZ = new Rot(yScaled_only, zScaled_only, yHeading, zHeading); 
        toYZ.applyAfter(yScaled_only, tempV);
        let toY = Rot.fromVecs(tempV, yHeading);
        return toY.applyAfter(toYZ);
    }*/

    initializeBasisFromDirections(origin, x, y, z) {
        this.translate.set(origin);
        this.translate.writeInto(this.secretMatrix_e, 12);
        x.writeInto(this.secretMatrix_e, 0);
        y.writeInto(this.secretMatrix_e, 4);
        z.writeInto(this.secretMatrix_e, 8);
        this.setFromMatrix4(this.secretMatrix);
    }


    initializeRays(origin = this.pool.any_Vec3()) {
        let v = this.pool.any_Vec3();
        this._xRay = new Ray(origin, v.readFrom(this.scaleMatrix_e, 0), this.pool);
        this._yRay = new Ray(origin, v.readFrom(this.scaleMatrix_e, 4), this.pool);
        this._zRay = new Ray(origin, v.readFrom(this.scaleMatrix_e, 8), this.pool);
    }


    /**like adoptValues, but presumes orthogonality*/
    approxAdoptValues(input) {
        this.isOrthogonal = true;
        this.translate.set(input.translate);
        this.scale.set(input.scale);
        this.rotation.setFromRot(input.rotation);
        this.lazyRefresh();
        return this;
    }

    /**
     * sets the values of this transform to mimix the values of the input transform
     * @param {IKTransform} input 
     * @returns this transform for chaining
     */
    adoptValues(input) {
        this.translate.set(input.translate);
        this.scale.set(input.scale);
        this.rotation.setFromRot(input.rotation);
        this.isOrthogonal = input.isOrthogonal;
        this.isOrthoNormal = input.isOrthoNormal;
        this.isUniform = input.isUniform;
        this.isOrthoUniform = input.isOrthoUniform;
        if(!input.isOrthogonal) {
            input.recompose();
            this.skewMatrix.copy(input.skewMatrix);
            this.scaleMatrix.copy(input.scaleMatrix);
            this.composedMatrix.copy(input.composedMatrix);
            this.state = input.state;
        } else {
            this.skewMatrix.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);
            this.scaleMatrix.makeScale(this.scale.x, this.scale.y, this.scale.z);
            this.lazyRefresh();
        }
        return this;
    }

    adoptValuesFromTransformState(input) {
        this.setFromArrays(input.translation, input.rotation, input.scale);
        this.lazyRefresh();
        return this;
    }

    setToIdentity(){
        //return this.setFromArrays([0,0,0], [0,0,0,1], [1,1,1], false); // jpl
        return this.setFromArrays([0,0,0], [1,0,0,0], [1,1,1], false); // hamilton
    }

    setFromArrays(translation, rotation, scale, normalize = true) {
        this.translate.readFrom(translation, 0);
        this.scale.readFrom(scale, 0);
        this.scaleMatrix.makeScale(this.scale.x, this.scale.y, this.scale.z);
        this.skewMatrix.copy(IKTransform.zeroMat);
        this.rotation.setComponents(rotation[0], rotation[1], rotation[2], rotation[3], normalize);
        this.isUniform = this.forceUniformity || Math.abs(1-(scale.x/scale.y/scale.z)) < 1e-6;
        this._updateOrthoNormalHint();
        this.lazyRefresh();
        return this;
    }

    /**lazily checks if the composed matrix needs updating, and updates it if so*/
    recompose() {
        if(this.state & IKTransform.compositionsDirty) {
            IKTransform.matrixAddOutTo(this.scaleMatrix_e, this.skewMatrix_e, this.secretMatrix_e);
            this.rotation.applyBeforeMatrix4_rot(this.secretMatrix_e, this.composedMatrix_e);
            this.translate.writeInto(this.composedMatrix_e, 12);
            //mark everything but the compositions and inverseRotation dirty, leaving inverseRotation however it was
            this.state = ~(this.state & IKTransform.precompInverseDirty) & (IKTransform.allDirty & ~IKTransform.compositionsDirty);
            //if v8 doesn't inline those bit operations imma be so grumpy.
        }
    }

    /**addition of the first 3 rows (corresponding columnwise to each basis vector, and finally translation)
     *  of the first matrix, storing the results in the first 3 rows of the second matrix 
     * @param {Matrix4} mat1 the matrix to take values from
     * @param {Matrix4} addTo the matrix to add values into (as in, addition, not replacement or concatenation)
     * @return the matrix that was added into
    */
    static matrixAdd(mat1, addTo) {
        addTo[0] += mat1[0]; addTo[4] += mat1[4]; addTo[8] += mat1[8];  addTo[12] += mat1[12];
        addTo[1] += mat1[1]; addTo[5] += mat1[5]; addTo[9] += mat1[9];  addTo[13] += mat1[13];
        addTo[2] += mat1[2]; addTo[6] += mat1[6]; addTo[10] += mat1[10];addTo[14] += mat1[14];
        return addTo;
    }

    /**
     * like matrixAdd, but stores the result into a third matrix instead 
     * @param {Matrix4} mat1 
     * @param {Matrix4} mat2
     * @param {Matrix4} storeIn matrix to store results in
     * @return the matrix that was added into
    */
    static matrixAddOutTo(mat1, mat2, storeIn) {
        storeIn[0] = mat2[0]+mat1[0]; storeIn[4] = mat2[4]+mat1[4]; storeIn[8] = mat2[8]+mat1[8];   storeIn[12] = mat2[12]+mat1[12];
        storeIn[1] = mat2[1]+mat1[1]; storeIn[5] = mat2[5]+mat1[5]; storeIn[9] = mat2[9]+mat1[9];   storeIn[13] = mat2[13]+mat1[13];
        storeIn[2] = mat2[2]+mat1[2]; storeIn[6] = mat2[6]+mat1[6]; storeIn[10] = mat2[10]+mat1[10]; storeIn[14] = mat2[14]+mat1[14];
        return storeIn;
    }


    /**
     * subtraction of the first 3 rows (corresponding columnwise to each basis vector, and finally translation)
     * of the first matrix from first 3 rows of the second matrix, storing the results in the second matrix.     * 
     * @param {Matrix4} mat1 the matrix to take values from
     * @param {Matrix4} subFrom the matrix to subtract values from
     * @return the matrix that was subtractedFrom
    */
    static matrixSub(mat1, subFrom) {
        subFrom[0] -= mat1[0]; subFrom[4] -= mat1[4]; subFrom[8] -= mat1[8];   subFrom[12] -= mat1[12];
        subFrom[1] -= mat1[1]; subFrom[5] -= mat1[5]; subFrom[9] -= mat1[9];   subFrom[13] -= mat1[13];
        subFrom[2] -= mat1[2]; subFrom[6] -= mat1[6]; subFrom[10] -= mat1[10]; subFrom[14] -= mat1[14];
        return subFrom;
    }

     /**
     * subtraction of the first 3 rows (corresponding columnwise to each basis vector, and finally translation)
     * of the first matrix from first 3 rows of the second matrix, storing the results in the second matrix.     * 
     * @param {Matrix4} mat1 the matrix to take values from
     * @param {Matrix4} subFrom the matrix to subtract values from
     * @param {Matrix4} storeIn matrix to store results in
     * @return the matrix that was subtractedFrom
    */
     static matrixSubOutTo(mat1, subFrom, storeIn) {
        storeIn[0] = subFrom[0]-mat1[0]; storeIn[4] = subFrom[4]-mat1[4]; storeIn[8] = subFrom[8]-mat1[8];  storeIn[12] = subFrom[12]-mat1[12];
        storeIn[1] = subFrom[1]-mat1[1]; storeIn[5] = subFrom[5]-mat1[5]; storeIn[9] = subFrom[9]-mat1[9];  storeIn[13] = subFrom[13]-mat1[13];
        storeIn[2] = subFrom[2]-mat1[2]; storeIn[6] = subFrom[6]-mat1[6]; storeIn[10] = subFrom[10]-mat1[10];  storeIn[14] = subFrom[14]-mat1[14];
        return storeIn;
    }

    updateComposedInverse() {
        if(this.state & IKTransform.inverseCompositionsDirty) {
            if(this.state & IKTransform.compositionsDirty) {
                this.recompose();
            }
			this.inverseComposedMatrix.copy(this.composedMatrix);
            this.inverseComposedMatrix.invert();
            this.state &= ~IKTransform.inverseCompositionsDirty;
        }
    }

    updateHeadings() {
        if(this.state & IKTransform.compositionsDirty) this.recompose();
        this._xHeading.readFrom(this.composedMatrix_e, 0);
        this._yHeading.readFrom(this.composedMatrix_e, 4);
        this._zHeading.readFrom(this.composedMatrix_e, 8);
        
        this.state &= ~IKTransform.headingsDirty;
    }

    updateOrthonHeadings() {
        if(!this.state & IKTransform.orthonHeadingsDirty) return;
        this.rotation.applyToVec(IKTransform.xBase, this._orthon_xHeading).mult(this.xNormDir);
        this.rotation.applyToVec(IKTransform.yBase, this._orthon_yHeading).mult(this.yNormDir);
        this.rotation.applyToVec(IKTransform.zBase, this._orthon_zHeading).mult(this.zNormDir);
        this.state &= ~IKTransform.orthonHeadingsDirty;
    }

    setToOrthonHeading(invec, outvec) {
        return this.rotation.applyToVec(invec, outvec);
    }
   
    get xHeading() {
        if(this.state & IKTransform.headingsDirty) this.updateHeadings();
        return this._xHeading;
    }
    get yHeading() {
        if(this.state & IKTransform.headingsDirty) this.updateHeadings();
        return this._yHeading;
    }
    get zHeading() {
        if(this.state & IKTransform.headingsDirty) this.updateHeadings();
        return this._zHeading;
    }

    get orthon_xHeading() {
        if(this.state & IKTransform.orthonHeadingsDirty) this.updateOrthonHeadings();
        return this._orthon_xHeading;
    }
    get orthon_yHeading() {
        if(this.state & IKTransform.orthonHeadingsDirty) this.updateOrthonHeadings();
        return this._orthon_yHeading;
    }
    get orthon_zHeading() {
        if(this.state & IKTransform.orthonHeadingsDirty) this.updateOrthonHeadings();
        return this._orthon_zHeading;
    }

    setToOrthon_XHeading(vec) {
        if(this.state & IKTransform.orthonHeadingsDirty) this.updateOrthonHeadings();
        return vec.set(this._orthon_xHeading);
    }

    setToOrthon_YHeading(vec) {
        if(this.state & IKTransform.orthonHeadingsDirty) this.updateOrthonHeadings();
        return vec.set(this._orthon_yHeading);
    }

    setToOrthon_ZHeading(vec) {
        if(this.state & IKTransform.orthonHeadingsDirty) this.updateOrthonHeadings();
        return vec.set(this._orthon_zHeading);
    } 

    setToXHeading(vec) {
        if(this.state & IKTransform.headingsDirty) this.updateHeadings();
        return vec.set(this._xHeading);
    }

    setToYHeading(vec) {
        if(this.state & IKTransform.headingsDirty) this.updateHeadings();
        return vec.set(this._yHeading);
    }

    setToZHeading(vec) {
        if(this.state & IKTransform.headingsDirty) this.updateHeadings();
        return vec.set(this._zHeading);
    }    

    setFromObj3d(object3d) {        
        if(this.forceOrthogonality || this.forceOrthonormality) {
            this.translate.readFromTHREE(object3d.position);
            this.scale.readFromTHREE(object3d.scale);
            if(isNaN(object3d.quaternion.w)) {
                //TODO: avoid having this
                console.warn("attempt to write NaN rotation ignored, replaced with identity");
                this.rotation.toIdentity();
            } else {
                this.rotation.setComponents(object3d.quaternion.w, -object3d.quaternion.x, -object3d.quaternion.y, -object3d.quaternion.z);
            }
            this._updateNorms();
        } else {
            object3d.updateMatrix();
            this.setFromMatrix4(object3d.matrix);
        }
        this.lazyRefresh();
        
    }

    /**
     * 
     * @param {IKTransform} globalinput 
     * @param {IKTransform} localoutput 
     * @returns 
     */
    setTransformToLocalOf(globalinput, localoutput) {
        localoutput.wasOrthogonal = localoutput.isOrthogonal;
        if(this.isOrthogonal) { //I will go to amazing lengths to avoid a matrix inverse            
            localoutput.translate.set(globalinput.translate);
            localoutput.translate.sub(this.translate); 
            this.inverseRotation.applyToVec(localoutput.translate, localoutput.translate);
            localoutput.translate.compDiv(this.scale);
            this.inverseRotation.applyAfter(globalinput.rotation, localoutput.rotation); //hamilton
            localoutput.rotation.normalize();
            //we can get away with this block by the grace of orthonouniformity, but we don't even need it under orthonormality
            if(!this.isOrthoNormal) {           
                const sRecip = 1/this.scale.x;            
                localoutput.translate.mult(sRecip);
                localoutput.scale.set(globalinput.scale).mult(sRecip);
                localoutput.scaleMatrix.copy(globalinput.scaleMatrix).multiplyScalar(sRecip);
                localoutput.skewMatrix.copy(globalinput.skewMatrix).multiplyScalar(sRecip);
            }
            localoutput._updateAllStructureHInts();
        } else {
            this.updateComposedInverse();
            globalinput.recompose();
            localoutput.composedMatrix.copy(globalinput.composedMatrix).premultiply(this.inverseComposedMatrix);
            localoutput.setFromMatrix4(localoutput.composedMatrix);
        }
        localoutput.lazyRefresh();
        if(isNaN(localoutput.rotation.w)) {
            throw new Error("oh oh");
        }
        return localoutput;
    }

    setVecToLocalOf(globalInput, localOutput) {
        if(this.isOrthogonal) {
            localOutput.set(globalInput);
            localOutput.sub(this.translate); 
            this.inverseRotation.applyToVec(localOutput, localOutput);
            localOutput.compDiv(this.scale);
        } else {
            this.updateComposedInverse();
            localOutput.readFromTHREE(
               globalInput.writeToTHREE(this.tempWhateverVector3).applyMatrix4(this.inverseComposedMatrix)
            );
        }       
        return localOutput;
    }

    setTransformToGlobalOf(localInput, globalOutput) {
        globalOutput.wasOrthogonal = globalOutput.isOrthogonal;
        if(this.isOrthoNormal) {
            globalOutput.translate.set(localInput.translate).compMult(this.scale);
            this.rotation.applyAfter(localInput.rotation, globalOutput.rotation);
            this.rotation.applyToVec(globalOutput.translate, globalOutput.translate);
            globalOutput.translate.add(this.translate);
            globalOutput._updateNorms();
            globalOutput.lazyRefresh();
        }
        else if(this.isOrthoUniform) {
            globalOutput.translate.set(localInput.translate).compMult(this.scale);
            globalOutput.scale.set(localInput.scale).compMult(this.scale); //only works if orthoUniform, which we are. We checked. It's fine. Relax.
		    this.rotation.applyAfter(localInput.rotation, globalOutput.rotation);
            this.rotation.applyToVec(globalOutput.translate, globalOutput.translate);
            globalOutput.translate.add(this.translate);
            globalOutput.rotation.normalize();
            globalOutput.scaleMatrix.makeScale(globalOutput.scale.x, globalOutput.scale.y, globalOutput.scale.z);
            globalOutput._updateAllStructureHInts();
		    globalOutput.lazyRefresh();
        } else {
            this.recompose();
            localInput.recompose();
            globalOutput.setFromMatrix4(this.secretMatrix.multiplyMatrices(this.composedMatrix, localInput.composedMatrix));
        }
        if(isNaN(globalOutput.rotation.w)) {
            throw new Error("oh oh");
        }
        return globalOutput;
 	}

    setVecToGlobalOf(localInput, globalOutput) {
        if(this.isOrthogonal) {
            globalOutput.set(localInput).compMult(this.scale);
            this.rotation.applyToVec(globalOutput, globalOutput);
            globalOutput.add(this.translate);
        } else {
            this.recompose();
            globalOutput.readFromTHREE(
                localInput.writeToTHREE(this.tempWhateverVector3).applyMatrix4(this.composedMatrix)
            );
        }
        return globalOutput;
    }

    writeToTHREE(obj3d) {
        if(isNaN(this.translate.x) || isNaN(this.rotation.x) || isNaN(this.scale.x)) {
            alert("NaN detected, check the debugger")
            throw new Error("Projecting NaNs is bad.");
        }
        this.translate.writeToTHREE(obj3d.position);
        this.scale.writeToTHREE(obj3d.scale);
        this.rotation.writeToTHREE(obj3d.quaternion);
        obj3d.updateMatrix();
    }


    rotateTo(newRotation) {				
		this.rotation.setFromRot(newRotation); 
        this.rotation.normalize();
		this.lazyRefresh();
        return this;
	}

	rotateBy(addRotation) {		
		addRotation.applyAfter(this.rotation, this.rotation);
        this.rotation.normalize();
		this.lazyRefresh();
        return this;
	}

    getLocalOfVec(inVec, outVec = this.pool.any_Vec3()) {
        this.setVecToLocalOf(inVec, outVec);
        return outVec;  
    }


    /**
     * Same as getLocalOfRotation, but throws caution to the wind and doesn't normalize a thing.
    */
    getRawLocalOfRotation(inRot, outRot) {		
        let resultNew = this.inverseRotation.applyAfter(inRot, outRot).applyAfter(this.rotation, outRot);
        return resultNew;		
    }

    /**
     * 
     * @param {Rot} inRot in worldspace
     * @param {Rot} outRot in localspace
     * @returns a reference to outRot
     */
    getLocalOfRotation(inRot, outRot) {		
        let resultNew = this.inverseRotation.applyAfter(inRot, outRot).applyAfter(this.rotation, outRot);
        outRot.normalize();
        return resultNew;		
    }

    translateBy(vec) {
        this.translate.add(vec);
        this.lazyRefresh();
        return this;
    }

    translateTo(vec) {
        this.translate.set(vec);
        this.lazyRefresh();
        return this;
    }

    /**doesn't actually refresh, just indicates a need to.
     * updates are always lazy.
    */
    lazyRefresh() {
        this.state = IKTransform.allDirty;
        //this.rotation.setToReversion(this._inverseRotation);
        //this.updateRays();
    }

    release() {
        this._xRay.release();
        this._yRay.release();
        this._zRay.release();
        this.translate.release();
        this.rotation.release();
        this._inverseRotation.release();
        this.scale.release();
        this.xScaled_only.release();
        this.yScaled_only.release();
        this.zScaled_only.release();
    }

    get inverseRotation() {
        if(this.state & IKTransform.precompInverseDirty) {
            this.rotation.invertInto(this._inverseRotation);
            //this.inverseSkewMatrix.copy(this.skewMatrix);
            this.state &= ~IKTransform.precompInverseDirty;
        }
        return this._inverseRotation;
    }

    get xRay() {
        if(this.state & IKTransform.raysDirty) this.updateRays();
        return this._xRay;
    }
    get yRay() {
        if(this.state & IKTransform.raysDirty) this.updateRays();
        return this._yRay;
    }
    get zRay() {
        if(this.state & IKTransform.raysDirty) this.updateRays();
        return this._zRay;
    }

    isAxisFlipped(axis) {
        return false;
    }


    getXHeading() {
        return this.xHeading;
    }
    getYHeading() {
        return this.yHeading;
    }
    getZHeading() {
        return this.zHeading;
    }

    getOrthon_XHeading() {
        return this.orthon_xHeading;
    }
    getOrthon_YHeading() {
        return this.orthon_yHeading;
    }
    getOrthon_ZHeading() {
        return this.orthon_zHeading;
    }

    updateRays() {
        if(this.state & IKTransform.compositionsDirty) this.recompose();
        if(this.state & IKTransform.raysDirty) {                        
            this._xRay.p1.set(this.translate);
            this._yRay.p1.set(this.translate);
            this._zRay.p1.set(this.translate);
            //god I really hope this is how cache locality works
            this._xHeading.readFrom(this.composedMatrix_e, 0);
            this._xRay.p2.readFrom(this.composedMatrix_e, 0).add(this.translate); 
            this._yHeading.readFrom(this.composedMatrix_e, 4);           
            this._xRay.p2.readFrom(this.composedMatrix_e, 4).add(this.translate);
            this._zHeading.readFrom(this.composedMatrix_e, 8);
            this._zRay.p2.readFrom(this.composedMatrix_e, 8).add(this.translate);
        }
        this.state &= ~(IKTransform.raysDirty | IKTransform.headingsDirty);
    }

    /**
     * 
     * @returns a pooled vector with the values of this.translate. Optionally just recycles a vector you provide
     */
    origin(storeIn = this.pool.any_Vec3()) {
        return storeIn.set(this.translate);
    }

    toString(headings = true) {
        let xh = this.getXHeading();
        let yh = this.getYHeading();
        let zh = this.getZHeading();
        let xMag = xh.mag();
        let yMag = yh.mag();
        let zMag = zh.mag();
        let rotax = this.rotation.getAxis();
        let chiralityStr = this.chirality === IKTransform.LEFT ? "LEFT" : "RIGHT";
        let headingstr = headings? `xHead: ${xh.toString()}, mag: ${xMag.toString()}
yHead: ${yh.toString()}, mag: ${yMag.toString()}
zHead: ${zh.toString()}, mag: ${zMag.toString()}` : '';
        return `origin: ${this.translate.toString()}
${this.rotation.toString(true, true)}
${headingstr}`
    }

    toHTMLString() {
        
    }

    /**prints color and glyph representations of two transforms */
    static compareWith(trans1, trans2) {
        let built = IKTransform._getCompareStyles(trans1, trans2);
        console.log(built.string, ...built.styles);
    }

    /**
     * compares this transform with the one provided.
     * @param {IKTransform} transform 
     */
    compare(transform) {
        IKTransform.compareWith(this, transform);
    }

    toConsole() {

    }


    static _getCompareStyles(trans1, trans2 = IKTransform.IDENTITY) {
        let xh_1 = trans1.xRay.heading();
        let yh_1 = trans1.yRay.heading();
        let zh_1 = trans1.zRay.heading();
        let xMag_1 = xh_1.mag();
        let yMag_1 = yh_1.mag();
        let zMag_1 = zh_1.mag();
        let rotax_1 = trans1.rotation.getAxis();
        let pos1 = trans1.translate;
        let chiralityStr_1 = trans1.chirality === IKTransform.LEFT ? "LEFT" : "RIGHT";

        let xh_2 = trans2.xRay.heading();
        let yh_2 = trans2.yRay.heading();
        let zh_2 = trans2.zRay.heading();
        let xMag_2 = xh_2.mag();
        let yMag_2 = yh_2.mag();
        let zMag_2 = zh_2.mag();
        let pos2 = trans2.translate; 
        let rotax_2 = trans2.rotation.getAxis();
        let chiralityStr_2 = trans2.chirality === IKTransform.LEFT ? "LEFT" : "RIGHT";

        let posMax = Math.max(pos1.mag(), pos2.mag());
        let pos1Cons = pos1.asConsoleString(posMax);
        let pos2Cons = pos2.asConsoleString(posMax);
        let posStyles = [pos1Cons.style, pos2Cons.style];
        let posString = `Position: %c▇%c▇`;

        let rotAngleDelta = trans1.rotation.getAngle() - trans2.rotation.getAngle();
        let rotStyles = ['', rotax_1.asConsoleString(1).style, rotax_2.asConsoleString(1).style, ''];
        let rotString = `%cRotation: %c${trans1.rotation.getAngleGlyph()} %c${trans2.rotation.getAngleGlyph()} %c (${rotAngleDelta.toFixed(5)}) delta`;

        let built = {string: posString+'\n'+rotString, styles: [...posStyles, ...rotStyles]};

        let magMax = Math.max(xMag_1, xMag_2, yMag_1, yMag_2, zMag_1, zMag_2);
        let xMax = Math.max(xMag_1, xMag_2); 
        let xHeadStyles = [`${xh_1.asConsoleString(xMax).style}; font-size: ${xMag_1/magMax}em`, `${xh_2.asConsoleString(xMax).style}; font-size: ${xMag_2/magMax}em`];
        built.string += '\n'+'%cScale   :%cX%cX';
        built.styles.push('',...xHeadStyles);

        let yMax = Math.max(yMag_1, yMag_2); 
        let yHeadStyles = [`${yh_1.asConsoleString(yMax).style}; font-size: ${yMag_1/magMax}em`, `${yh_2.asConsoleString(yMax).style}; font-size: ${yMag_2/magMax}em`];
        built.string += ' %cY%cY';
        built.styles.push(...yHeadStyles);

        
        let zMax = Math.max(zMag_1, zMag_2); 
        let zHeadStyles = [`${zh_1.asConsoleString(zMax).style}; font-size: ${zMag_1/magMax}em`, `${zh_2.asConsoleString(zMax).style}; font-size: ${zMag_2/magMax}em`];
        built.string += ' %cZ%cZ';
        built.styles.push(...zHeadStyles);
        return built;
    }

    clone() {
		return  IKTransform.newPooled(this.pool).adoptValues(this); 
	}

    static IDENTITY = Object.freeze(new IKTransform());
}
