import { Vec3, any_Vec3 } from "./vecs.js";
import { Ray } from "./Ray.js";


/**intended as a mutable base for Rot. But this was poorly considered. */
export class MRotation {
    static IDENTITY = new MRotation(1.0, 0.0, 0.0, 0.0, false);

    constructor(q0 = 1.0, q1 = 0.0, q2 = 0.0, q3 = 0.0, needsNormalization = false) {
        if (!(Number.isFinite(q0))) {
            throw new Error("constructor only supports quaternion component inputs");
        }
        this.w = q0;
        this.x = q1;
        this.y = q2;
        this.z = q3;

        if (needsNormalization) {
            this.normalize();
        }
    }


    clone() {
        return new MRotation(this.w, this.x, this.y, this.z);
    }



    static _maybeUnflattenMatrix(arr) {
        if (arr.length == 9) {
            return [
                [arr[0], arr[3], arr[6]],
                [arr[1], arr[4], arr[7]],
                [arr[2], arr[5], arr[8]]
            ];
        }
        return arr;
    }


    /**
     *   SPICE Quaternion Multiplication Formula
     ---------------------------------------
  
     Given a SPICE quaternion
        Q = ( q0, q1, q2, q3 )
     corresponding to rotation axis A and angle theta as above, we can
     represent Q using "scalar + vector" notation as follows:
        s =   q0           = cos(theta/2)
        v = ( q1, q2, q3 ) = sin(theta/2) * A
        Q = s + v
     Let Q1 and Q2 be SPICE quaternions with respective scalar
     and vector parts s1, s2 and v1, v2:
        Q1 = s1 + v1
        Q2 = s2 + v2
     We represent the dot product of v1 and v2 by
        <v1, v2>
     and the cross product of v1 and v2 by
        v1 x v2
     Then the SPICE quaternion product is
  
        Q1*Q2 = s1*s2 - <v1,v2>  + s1*v2 + s2*v1 + (v1 x v2)
      */



    /**
     *  Get an array representing the 4X4 matrix corresponding to this rotation instance. 
     * Indices are in column major order. In other words 
     *<br/> 
     * 0,  4,  8,  12 <br/>  
     * 1,  5,  9,  13 <br/> 
     * 2,  6, 10, 14 <br/>
       * 3,  7, 11, 15 <br/>
     * */
    toMatrix4Val() {
        result = new Array(16);
        return toMatrix4Val(result, false);
    }

    toMatrix4Val(storeIn, zeroOut = true) {
        let twtw = this.w * this.w;
        let twtx = this.w * this.x;
        let twty = this.w * this.y;
        let twtz = this.w * this.z;
        let txtx = this.x * this.x;
        let txty = this.x * this.y;
        let txtz = this.x * this.z;
        let tyty = this.y * this.y;
        let tytz = this.y * this.z;
        let tztz = this.z * this.z;

        storeIn[0] = 2.0 * (twtw + txtx) - 1.0;
        storeIn[1] = 2.0 * (txty - twtz);
        storeIn[2] = 2.0 * (txtz + twty);
        storeIn[4] = 2.0 * (txty + twtz);
        storeIn[5] = 2.0 * (twtw + tyty) - 1.0;
        storeIn[6] = 2.0 * (tytz - twtx);
        storeIn[8] = 2.0 * (txtz - twty);
        storeIn[9] = 2.0 * (tytz + twtx);
        storeIn[10] = 2.0 * (twtw + tztz) - 1.0;
        storeIn[15] = 1.0;

        if (zeroOut) {
            storeIn[3] = 0.0;
            storeIn[7] = 0.0;
            storeIn[11] = 0.0;
            storeIn[12] = 0.0;
            storeIn[13] = 0.0;
            storeIn[14] = 0.0;
        }

        return storeIn;
    }


    mat2quat(ort) {
        let quat = [0, 0, 0, 0];
        let s = ort[0][0] + ort[1][1] + ort[2][2];
        if (s > -0.19) {
            quat[0] = 0.5 * Math.sqrt(s + 1.0);
            let inv = 0.25 / quat[0];
            quat[1] = inv * (ort[1][2] - ort[2][1]);
            quat[2] = inv * (ort[2][0] - ort[0][2]);
            quat[3] = inv * (ort[0][1] - ort[1][0]);
        } else {
            s = ort[0][0] - ort[1][1] - ort[2][2];
            if (s > -0.19) {
                quat[1] = 0.5 * Math.sqrt(s + 1.0);
                let inv = 0.25 / quat[1];
                quat[0] = inv * (ort[1][2] - ort[2][1]);
                quat[2] = inv * (ort[0][1] + ort[1][0]);
                quat[3] = inv * (ort[0][2] + ort[2][0]);
            } else {
                s = ort[1][1] - ort[0][0] - ort[2][2];
                if (s > -0.19) {
                    quat[2] = 0.5 * Math.sqrt(s + 1.0);
                    let inv = 0.25 / quat[2];
                    quat[0] = inv * (ort[2][0] - ort[0][2]);
                    quat[1] = inv * (ort[0][1] + ort[1][0]);
                    quat[3] = inv * (ort[2][1] + ort[1][2]);
                } else {
                    s = ort[2][2] - ort[0][0] - ort[1][1];
                    quat[3] = 0.5 * Math.sqrt(s + 1.0);
                    let inv = 0.25 / quat[3];
                    quat[0] = inv * (ort[0][1] - ort[1][0]);
                    quat[1] = inv * (ort[0][2] + ort[2][0]);
                    quat[2] = inv * (ort[2][1] + ort[1][2]);
                }
            }
        }
        return quat;
    }

}

// Helper function to convert radians to degrees, as JavaScript's Math object works in radians
Math.toDegrees = function (radians) {
    return radians * (180 / Math.PI);
};


export class Rot {
    workingInput = new Vec3();
    workingOutput = new Vec3();
    constructor(w, x, y, z, needsNormalization = false) {
        if ((x == 1 && w == 0) || isNaN(w) || isNaN(x) || !(y instanceof Number || Number.isFinite(y))) {
            throw new Error("I call bullshit");
        }
        this.w = w;
        this.x = x;
        this.y = y;
        this.z = z;
        if (needsNormalization) this.normalize();
    };

    static fromVecs(v1, v2) {
        let result = new Rot(1, 0, 0, 0)
        result.setFromVecs(v1, v2);
        return result;
    }

    static fromRot(r) {
        return new Rot(r.w, r.x, r.y, r.z);
    }

    static fromAxisAngle(axis, angle) {
        return new Rot(1, 0, 0, 0).setFromAxisAngle(axis, angle);
    }

    static fromMatrix3Val(storeIn = new Rot(1, 0, 0, 0)) {
        const { tw, tx, ty, tz } = this;

        const twtw = tw * tw;
        const twtx = tw * tx;
        const twty = tw * ty;
        const twtz = tw * tz;
        const txtx = tx * tx;
        const txty = tx * ty;
        const txtz = tx * tz;
        const tyty = ty * ty;
        const tytz = ty * tz;
        const tztz = tz * tz;

        storeIn[0] = 2.0 * (twtw + txtx) - 1.0;
        storeIn[1] = 2.0 * (txty - twtz);
        storeIn[2] = 2.0 * (txtz + twty);

        storeIn[3] = 2.0 * (txty + twtz);
        storeIn[4] = 2.0 * (twtw + tyty) - 1.0;
        storeIn[5] = 2.0 * (tytz - twtx);

        storeIn[6] = 2.0 * (txtz - twty);
        storeIn[7] = 2.0 * (tytz + twtx);
        storeIn[8] = 2.0 * (twtw + tztz) - 1.0;
        return storeIn;
    }

    toJSON() {
        return {w: this.w, x: this.x, y: this.y, z: this.z};
    }

    static fromJSON(obj) {
        return new Rot(obj.w, obj.x, obj.y, obj.z);
    }


    /**
     * returns a new Rotation that is the Hamilton quaternion multiplication of the input Rotations
     * @param {Rot} a 
     * @param {Rot} b 
     * @returns 
     */

    static multiply(a, b, out = new Rot()) {
        const aw = a.w, ax = a.x, ay = a.y, az = a.z;
        const bw = b.w, bx = b.x, by = b.y, bz = b.z;
        out.w = aw * bw - ax * bx - ay * by - az * bz;
        out.x = aw * bx + ax * bw + ay * bz - az * by;
        out.y = aw * by - ax * bz + ay * bw + az * bx;
        out.z = aw * bz + ax * by - ay * bx + az * bw;
        return out;
    }

    static pre_multiply(a, b) {
        this.multiply(b, a);
    }


    /**
     * @return the rotation which, if applied to something, would give the same result
     * as first applying the input rotation @param {Rot} r to that thing and then applying
     * this rotation to that thing afterward.*/
    applyAfter(r, storeIn = new Rot(1, 0, 0, 0)) {
        const aw = this.w, ax = this.x, ay = this.y, az = this.z;
        const bw = r.w, bx = r.x, by = r.y, bz = r.z;
        return storeIn.setComponents( //equivalent to pre_multiply
            aw * bw - (bx * ax + by * ay + bz * az),
            aw * bx + bw * ax + (by * az - bz * ay),
            aw * by + bw * ay + (bz * ax - bx * az),
            aw * bz + bw * az + (bx * ay - by * ax),
            false);
    }


    /**writes the raw contents of this rot object out to THREE.js quaternion */
    raw_writeToTHREE(quat) {
        quat.set(this.x, this.y, this.z, this.w)
    }


    /**writes the THREE.js quivalent quaternion value of this rot object out to THREE.js quaternion */
    writeToTHREE(quat) {
        quat.set(-this.x, -this.y, -this.z, this.w);
    }


    /**reads in a raw THREE quaternion and adopts the conjugate of its values
    */
    readFromTHREE(quat) {
        this.w = quat.w;
        this.x = -quat.x;
        this.y = -quat.y;
        this.z = -quat.z;
    }


    /**reads in a raw THREE quaternion and adopts the its raw values without converting to Hamilton representation
    */
    raw_readFromTHREE(quat) {
        this.w = quat.w;
        this.x = quat.x;
        this.y = quat.y;
        this.z = quat.z;
    }



    /**
     * rotates the 3x3 matrix of the input column-major matrix by this rotation.
     * 
     * @param {(Matrix3|Matrix4)} inMat, the matrix to rotate
     * @param {(Matrix3|Matrix4)} outMat, the matrix to write the values into
     * @return {(Matrix3|Matrix4)} the input matrix, with the 3x3 elements representing its bases rotated by the amount
     * specified by this rotation.
     */
    applyBeforeMatrix3(inMat, outMat) {
        this.applyToVecArr(inMat, 0, outMat, 0);
        this.applyToVecArr(inMat, 3, outMat, 3);
        this.applyToVecArr(inMat, 6, outMat, 6);
        return outMat;
    }
    /**
     * rotates just the 3x3 portion of the input column-major matrix by this rotation.
     * 
     * @param {(Matrix4)} inMat, the matrix to rotate
     * @param {(Matrix4)} outMat, the matrix to write the values into
     * @return {(Matrix4)} the input matrix, with the 3x3 elements representing its bases rotated by the amount
     * specified by this rotation.
     */
    applyBeforeMatrix4_rot(inMat, outMat) {
        this.applyToVecArr(inMat, 0, outMat, 0);
        this.applyToVecArr(inMat, 4, outMat, 4);
        this.applyToVecArr(inMat, 8, outMat, 8);
        return outMat;
    }

    /**
     * rotates the entire 4x4 input column-major matrix by this rotation.
     * 
     * @param {(Matrix4)} inMat, the matrix to rotate
     * @param {(Matrix4)} outMat, the matrix to write the values into
     * @return {(Matrix4)} the input matrix, with the elements representing its bases and translation rotated by the amount
     * specified by this rotation.
     */
    applyBeforeMatrix4(inMat, outMat) {
        this.applyToVecArr(inMat, 0, outMat, 0);
        this.applyToVecArr(inMat, 4, outMat, 4);
        this.applyToVecArr(inMat, 8, outMat, 8);
        this.applyToVecArr(inMat, 12, outMat, 12);
        return outMat;
    }

    /**
     * @return the rotation which, if applied to something, would give the same result
     * as first applying this rotation to that thing and then applying the input
     * @param {Rot} r rotation to that thing afterward.*/
    applyBefore(r, storeIn = new Rot(1, 0, 0, 0)) {
        const aw = r.w, bx = r.x, by = r.y, bz = r.z;
        const bw = this.w, ax = this.x, ay = this.y, az = this.z;
        return storeIn.setComponents( //equivalent to pre_multiply
            aw * bw - (bx * ax + by * ay + bz * az),
            aw * bx + bw * ax + (by * az - bz * ay),
            aw * by + bw * ay + (bz * ax - bx * az),
            aw * bz + bw * az + (bx * ay - by * ax),
            false);
    }



    applyInverseToRot(r, storeIn = new Rot(1, 0, 0, 0)) {
        const { w, x, y, z } = this;
        let nmsr = -1 / (w * w + x * x + y * y + z * z);
        const tw = -w * nmsr, tx = x * nmsr, ty = y * nmsr, tz = z * nmsr;
        const rw = r.w, rx = r.x, ry = r.y, rz = r.z;

        return storeIn.setComponents(
            rw * tw - (rx * tx + ry * ty + rz * tz),
            rx * tw + rw * tx + (ry * tz - rz * ty),
            ry * tw + rw * ty + (rz * tx - rx * tz),
            rz * tw + rw * tz + (rx * ty - ry * tx),
            false
        );
    }

    /**applies the conjugate of this rotation to the input rotation.
     * faster than applyInverseToRot, but presumes normalization */
    applyConjugateToRot(r, storeIn = new Rot(1, 0, 0, 0)) {
        const tw = this.w, tx = -this.x, ty = -this.y, tz = -this.z;
        const rw = r.w, rx = r.x, ry = r.y, rz = r.z;
        return storeIn.setComponents(
            rw * tw - (rx * tx + ry * ty + rz * tz),
            rx * tw + rw * tx + (ry * tz - rz * ty),
            ry * tw + rw * ty + (rz * tx - rx * tz),
            rz * tw + rw * tz + (rx * ty - ry * tx),
            false
        );
    }

    /**applies this rotation to the conjugate of the input rotation.
     * presumes normalization */
    applyToConjugateOfRot(r, storeIn = new Rot(1, 0, 0, 0)) {
        const tw = this.w, tx = this.x, ty = this.y, tz = this.z;
        const rw = r.w, rx = -r.x, ry = -r.y, rz = -r.z;
        return storeIn.setComponents(
            rw * tw - (rx * tx + ry * ty + rz * tz),
            rx * tw + rw * tx + (ry * tz - rz * ty),
            ry * tw + rw * ty + (rz * tx - rx * tz),
            rz * tw + rw * tz + (rx * ty - ry * tx),
            false
        );
    }

    /**
     * returns the rotation which, if applied to this orientation, would bring this orientation to the target
     * orientation by the shortest path.
     * 
     * in other words this.rotationTo(target).applyAfter(this) == target
    */
    getRotationTo(target, storeIn = Rot.IDENTITY.clone()) {
        const qaw = this.w, qax = -this.x, qay = -this.y, qaz = -this.z // conjugate of this quaternion
        const qbw = target.w, qbx = target.x, qby = target.y, qbz = target.z;


        storeIn.w = qaw * qbw - qax * qbx - qay * qby - qaz * qbz;
        storeIn.x = qax * qbw + qaw * qbx + qay * qbz - qaz * qby;
        storeIn.y = qay * qbw + qaw * qby + qaz * qbx - qax * qbz;
        storeIn.z = qaz * qbw + qaw * qbz + qax * qby - qay * qbx;
        storeIn.shorten();
        //inlined the math to avoid the object instantiation required by target.multiply(this.conjugate())
        return storeIn;
    }

    /**
     * worldToLocal for rotations. Put in a rotation in worldspace, get back the
     * rotation in localspace of r.
     * 
     * 
     * In other words, if you consider this rotation as being applied in world space,
     * then this function returns the rotation which, if appliedAfter 
     * r, would yield this rotation. 
     *      
     * @param {Rot} r parent rotation 
     * @param {Rot} storeIn an optional Rot instance to store the result in
     * @returns 
     */
    applyWithin(r, storeIn = new Rot(1, 0, 0, 0)) {
        return this.applyToConjugateOfRot(r, storeIn);
    }


    setFromVecs(u, v) {
        let normProduct = u.mag() * v.mag();

        if (normProduct == 0) {
            this.w = 1;
            this.x = 0;
            this.y = 0;
            this.z = 0;
            return this;
        }

        let dot = u.dot(v);

        if (dot < ((2.0e-15 - 1.0) * normProduct)) {
            // special case u = -v: we select a PI angle rotation around
            // an arbitrary vector orthogonal to u
            let w = u.getOrthogonal_temp(this.workingInput);
            this.w = 0.0;
            this.x = -w.x;
            this.y = -w.y;
            this.z = -w.z;
        } else {
            // general case: (u, v) defines a plane, we select
            // the shortest possible rotation: axis orthogonal to this plane
            this.w = Math.sqrt(0.5 * (1.0 + dot / normProduct));
            let coeff = 1.0 / (2.0 * this.w * normProduct);
            let q = v.cross(u, this.workingInput);
            this.x = coeff * q.x;
            this.y = coeff * q.y;
            this.z = coeff * q.z;
        }
        return this;
    }

    /**
     * @param updates container to have values representing this rotation as an array of 4 numbers corresponding to the W (aka scalar), X, Y, and Z values in that order.
     */
    setFromArray(container) {
        this.setComponents(container[0], container[1], container[2], container[3], container[4]);
    }

    clone(normalize = false) {
        return new Rot(this.w, this.x, this.y, this.z, normalize);
    }

    setComponents(w, x, y, z, normalize = false) {
        this.w = w;
        this.x = x;
        this.y = y;
        this.z = z;
        if (normalize) {
            const invmag = 1 / Math.sqrt(w * w + x * x + y * y + z * z);
            this.w *= invmag;
            this.x *= invmag;
            this.y *= invmag;
            this.z *= invmag;
        }
        return this;
    }

    setFromRot(inR) {
        this.w = inR.w;
        this.x = inR.x;
        this.y = inR.y;
        this.z = inR.z;
        return this;
    }


    setFromAxisAngle(axis, angle) {
        const norm = Math.sqrt(axis.x * axis.x + axis.y * axis.y + axis.z * axis.z);
        if (norm === 0) throw new Error("Zero Norm for Rotation defining vector");

        const halfAngle = 0.5 * angle;
        const coeff = Math.sin(halfAngle) / norm;

        this.w = Math.cos(halfAngle);
        this.x = coeff * axis.x;
        this.y = coeff * axis.y;
        this.z = coeff * axis.z;
        return this;
    }

    /**
     * same as setFromAxisAngle, but assumes cached input of cos(-angle/2), sin(-angle/2)
     * @param {Vec3} axis must be unit length
     * @param {Number} cosNegHalfAngle cos(angle/2)
     * @param {Number} sinNegHalfAngle sin(-angle/2)
     */
    setFromAxisTrigHalfAngles(axis, cosNegHalfAngle, sinNegHalfAngle) {        
        let coeff =  sinNegHalfAngle/axis.mag();
        this.w = cosNegHalfAngle;
        this.x = coeff * axis.x;
        this.y = coeff * axis.y;
        this.z = coeff * axis.z;
        return this;

    }

    /**clamps as efficiently as I could come up with contingent on user 
     * having cached the cosine half value. 
     * 
     * Also, presumes the quaternion is normalized.
     * 
     * One does wonder how many other opportunities for optimization might be afforded by
     * representing quaternions primarily in terms of their most frequently used intermediate calculations.
     * One does wonder, but then one considers that the answer might require math, and one does not wonder so much.
     * 
     * @return {Rot} this rotation for chaining
    */
    clampToCosHalfAngle(cosHalfAngle) {
        
        this.shorten();
        let prevCoeff = (1 - (this.w * this.w));
        if (cosHalfAngle <= this.w || prevCoeff == 0) {
            return this;
        }
        else {
            let compositeCoeff = Math.sqrt((1 - (cosHalfAngle * cosHalfAngle)) / prevCoeff)
            this.w = cosHalfAngle;
            this.x *= compositeCoeff;
            this.y *= compositeCoeff;
            this.z *= compositeCoeff;
        }
        return this;
    }

    clampToAngle(angle) {
        let cosHalfAngle = Math.cos(0.5 * angle);
        this.clampToCosHalfAngle(cosHalfAngle);
    }



    /**returns a clone of the conjugate (as distinguished from inverse in that this presumes unitarity) of this rotation
     * @param storein an optional Rot to hold the result
     * @return a clone of this rotation representing its inverse / conjugate
     */
    conjugated(storein = new Rot(1, 0, 0, 0)) {
        storein.w = this.w;
        storein.x = -this.x;
        storein.y = -this.y;
        storein.z = -this.z;
        return storein;
    }

    /**
     * in-place conjugate (as distinguished from inverse in that this presumes unitarity) of this rotation. If you want a clone instead, use the past tense "conjugated".
     * @return this rotation object for chaining
     */
    conjugate() {
        this.x *= -1;
        this.y *= -1;
        this.z *= -1;
        return this;
    }

    /**
     * sets the values of the given Rot to the true inverse of this rot (as distinguished from the conjugate, which assumes unit quaternion)
     * @param {Rot} storeIn the Rot to store the inverse in
     * @return the provides Rot, with the values set to the inverse of this Rot.
     */
    invertInto(storeIn = new Rot(1, 0, 0, 0)) {
        const { w, x, y, z } = this;
        let negMagSqrecip = -1 / (w * w + x * x + y * y + z * z);
        storeIn.w = w * -negMagSqrecip; //note, this is only negated to undeo the previous negation of the reciprocal, not to take advantage of double-cover
        storeIn.x = x * negMagSqrecip;
        storeIn.y = y * negMagSqrecip;
        storeIn.z = z * negMagSqrecip;
        return storeIn;
    }
    /**
     * Returns a clone representing the inverse of this Rot.
     * @return returns a new Rot which is the inverse of this Rot. 
     */
    inverted() {
        return this.invertInto(new Rot(1, 0, 0, 0));
    }

    /**
     * in-place inverts (as distinguished from conjugates by being magnitude agnostic) this rotation, 
     * @return this rotation for chaining.
     */
    invert() {
        const { w, x, y, z } = this;
        let negMagSqrecip = -1 / (w * w + x * x + y * y + z * z);
        this.w *= -negMagSqrecip; //note, this is only negated to undeo the previous negation of the reciprocal, not to take advantage of double-cover
        this.x *= negMagSqrecip;
        this.y *= negMagSqrecip;
        this.z *= negMagSqrecip;
        return this;
    }

    /**
     * in place negates all components of this quaternion;
     * @return this rotation for chaining;
     */
    flip() {
        this.w *= -1;
        this.x *= -1;
        this.y *= -1;
        this.z *= -1;
        return this;
    }

    /**
     * in-place modifies this rotation to ensure it is along the shortest of the two double-cover paths
     * (Where shortest is defined as whicheve of this rotation or its conjugate have a positive dot product with the identity quaternion)
     */
    shorten() {
        if (this.w < 0) {
            return this.flip();
        } else return this;
    }


    /**returns the dot product of this rotation's quaternion against the input rotation's quaternion */
    dot(r) {
        return this.w * r.w + this.x * r.x + this.y * r.y + this.z * r.z;
    }

    /** 
     * sets the values of the given rotation equal to the inverse of this rotation
     * @param r the rotation object the reversion will be stored into
     * @return r
     */
    setToInversion(r) {
        this.invertInto(r);
        return r;
    }


    /**return the squared magnitude for a quick normality check*/
    magSq() {
        return this.w * this.w + this.x * this.x + this.y * this.y + this.z * this.z;
    }

    applyTo(v, output) {
        console.warn("Deprecated overloadable function. Use applyToVec, applyToRay, applyAfter instead")
        if (output == null) {
            output = copy;
        }
        if (v instanceof Vec3) {
            return this.applyToVec(v, output);
        } else if (v instanceof Ray) {
            return this.applytoRay()
        }
        return output;
    }

    applyToVec(v, output = any_Vec3()) {
        this.applyToVecArr(v.dataBuffer, v.baseIdx, output.dataBuffer, output.baseIdx);
        return output;
    }

    /**applies this rotation to an input array presumed to represent a 3d vector with contiguous components
     * @param {Array} inputVec the vector array input 
     * @param {Number} idx the index to start reading from, where the input index represents the x component, the next index represents the y component, and the one after that represents the z component.
     * @param {Array} outVec the output vector to write into
     * @param {Number} outidx the index to start writing from
     */
    applyToVecArr(inVec, idx, outVec, outidx) {
        const x = inVec[idx], y = inVec[idx + 1], z = inVec[idx + 2];
        const q0 = this.w, q1 = this.x, q2 = this.y, q3 = this.z;
        const s = q1 * x + q2 * y + q3 * z;

        outVec[outidx] = 2 * (q0 * (x * q0 - (q2 * z - q3 * y)) + s * q1) - x;
        outVec[outidx + 1] = 2 * (q0 * (y * q0 - (q3 * x - q1 * z)) + s * q2) - y,
        outVec[outidx + 2] = 2 * (q0 * (z * q0 - (q1 * y - q2 * x)) + s * q3) - z
        return outVec;
    }

    /**
     * applies this rotation to a copy of the input vector.the returned copy is an ephemenral one if you do not manually provide the outvec argument.
     * @param v
     * @return
     */

    applyToVecClone(inVec, outVec = any_Vec3()) {
        const x = inVec.x, y = inVec.y, z = inVec.z;
        const q0 = this.w, q1 = this.x, q2 = this.y, q3 = this.z;
        const s = q1 * x + q2 * y + q3 * z;

        outVec.x = 2 * (q0 * (x * q0 - (q2 * z - q3 * y)) + s * q1) - x;
        outVec.y = 2 * (q0 * (y * q0 - (q3 * x - q1 * z)) + s * q2) - y,
        outVec.z = 2 * (q0 * (z * q0 - (q1 * y - q2 * x)) + s * q3) - z
        return outVec;
    }

    /**
     * applies the inverse of this rotation to a copy of the input vector.the returned copy is an ephemenral one if you do not manually provide the outvec argument.
     * @param {(Vec3|Vector3)} u
     * @param {(Vec3|Vector3)} output vector to store the result of rotaating you
     * @return
     */

    applyInverseToVecClone(u, output = any_Vec3()) {
        const x = u.x, y = u.y, z = u.z;
        const m0 = this.w, q1 = -this.x, q2 = -this.y, q3 = -this.z;
        const s = q1 * x + q2 * y + q3 * z;

        output.setComponents(
            2 * (m0 * (x * m0 - (q2 * z - q3 * y)) + s * q1) - x,
            2 * (m0 * (y * m0 - (q3 * x - q1 * z)) + s * q2) - y,
            2 * (m0 * (z * m0 - (q1 * y - q2 * x)) + s * q3) - z);
        return output;
    }



    static getNormalized(r) {
        return new Rot(r.w, r.x, r.y, r.z, true);
    }

    applyToRay(rIn, rOut = rIn.clone()) {
        this.workingInput.x = rIn.p2.x - rIn.p1.x;
        this.workingInput.y = rIn.p2.y - rIn.p1.y;
        this.workingInput.z = rIn.p2.z - rIn.p1.z;

        this.applyToVec(this.workingInput, this.workingOutput);
        rOut.setP1(rIn.p1);
        rOut.setHeading(this.workingOutput);
        return rOut;
    }

    applyInverseToRay(rIn, rOut = rIn.clone()) {
        this.workingInput.x = rIn.p2.x - rIn.p1.x;
        this.workingInput.y = rIn.p2.y - rIn.p1.y;
        this.workingInput.z = rIn.p2.z - rIn.p1.z;

        this.applyInverseToVector(this.workingInput, this.workingOutput);
        rOut.setP1(rIn.p1);
        rOut.setHeading(this.workingOutput);
        return rOut;
    }

    toArray(into = [1, 0, 0, 0]) {
        into[0] = this.w;
        into[1] = this.x;
        into[2] = this.y;
        into[3] = this.z;
        return into;
    }

    /**same as toArray. creates an array to return if not provided one to write into*/
    intoArray(into = [1, 0, 0, 0]) {
        into[0] = this.w;
        into[1] = this.x;
        into[2] = this.y;
        into[3] = this.z;
        return into;
    }

    toIdentity() {
        this.w = 1;
        this.x = 0; 
        this.y = 0;
        this.z = 0;
        return this;
    }


    get q0() {
        return this.w;
    }
    get q1() {
        return this.x;
    }
    get q2() {
        return this.y;
    }
    get q3() {
        return this.z;
    }

    set q3(val) {
        this.z = val;
    }

    set q2(val) {
        this.y = val;
    }

    set q1(val) {
        this.x = val;
    }

    set q0(val) {
        this.w = val
    }

    getAngle() {
        return 2 * Math.acos(Math.max(Math.min(this.w, 1), -1));
    }

    getAxis(into = any_Vec3()) {
        //this.normalize(); 
        const squaredSine = 1 - (this.w * this.w);
        if (squaredSine == 0)
            return into.setComponents(1, 0, 0);

        const recip = 1 / Math.sqrt(squaredSine);
        into.setComponents(this.x * recip, this.y * recip, this.z * recip);
        return into;
    }

    normalizedClone() {
        return new Rot(this.w, this.x, this.y, this.z, true);
    }

    /**normalizes the quaternion representing this rotation and returns it.*/
    normalize() {
        const norm = 1 / Math.sqrt(this.w * this.w + this.x * this.x + this.y * this.y + this.z * this.z);
        if (norm < 1e-15) {
            throw new Error("Zero Norm");
        }
        this.w *= norm;
        this.x *= norm;
        this.y *= norm;
        this.z *= norm;
        return this;
    }



    /*
     * interpolate between two rotations (SLERP)
     * 
     */
    static fromSlerp(value1, value2, amount, storeIn = new Rot(1,0,0,0)) {

        if (isNaN(amount)) {
            return storeIn.setComponents(value1.w, value1.x, value1.y, value1.z);
        }
        if (amount < 0.0)
            return value1;
        else if (amount > 1.0)
            return value2;

        let dot = value1.dot(value2);

        let x2 = value2.x;
        let y2 = value2.y;
        let z2 = value2.z;
        let w2 = value2.w;

        let t1, t2;

        let EPSILON = 0.0001;
        if ((1.0 - dot) > EPSILON) {
            let angle = Math.acos(dot);
            let sinAngle = Math.sin(angle);
            t1 = Math.sin((1.0 - amount) * angle) / sinAngle;
            t2 = Math.sin(amount * angle) / sinAngle;
        }
        else // just lerp
        {
            t1 = 1.0 - amount;
            t2 = amount;
        }

        return storeIn.setComponents(
            (value1.w * t1) + (w2 * t2),
            (value1.x * t1) + (x2 * t2),
            (value1.y * t1) + (y2 * t2),
            (value1.z * t1) + (z2 * t2));
    }

    /** Get the swing rotation and twist rotation for the specified axis. The twist rotation represents the rotation around the
     * specified axis. The swing rotation represents the rotation of the specified axis itself, which is the rotation around an
     * axis perpendicular to the specified axis. The swing and twist rotation can be used to reconstruct the original
     * quaternion: this = swing * twist
     * 
     * @param axisX the X component of the normalized axis for which to get the swing and twist rotation
     * @param axisY the Y component of the normalized axis for which to get the swing and twist rotation
     * @param axisZ the Z component of the normalized axis for which to get the swing and twist rotation
     * @return an Array of Rot objects. With the first element representing the swing, and the second representing the twist
     * @see <a href="http://www.euclideanspace.com/maths/geometry/rotations/for/decomposition">calculation</a> */
    getSwingTwist(axis, swingOut = new Rot(), twistOut = new Rot()) {
        this.workingInput.setComponents(this.x, this.y, this.z);
        let d = this.workingInput.dot(axis);
        twistOut.setComponents(this.w, axis.x * d, axis.y * d, axis.z * d, true);
        //if (d < 0) twistOut.flip();

        swingOut.setFromRot(twistOut);
        swingOut.conjugate();
        swingOut = Rot.multiply(swingOut, this, swingOut);
    }

    static nlerp(r1, r2, t) {
        return new Rot(
            ((r1.w - r2.w) * t) + r2.w,
            ((r1.x - r2.x) * t) + r2.x,
            ((r1.y - r2.y) * t) + r2.y,
            ((r1.z - r2.z) * t) + r2.z,
            true
        )
    }

    static orthogonalizeMatrix(m, threshold) {
        const m0 = m[0], m1 = m[1], m2 = m[2], x00 = m0[0], x01 = m0[1], x02 = m0[2], x10 = m1[0], x11 = m1[1], x12 = m1[2], x20 = m2[0], x21 = m2[1], x22 = m2[2];
        let fn = 0;
        let fn1;

        let o = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
        let o0 = o[0];
        let o1 = o[1];
        let o2 = o[2];

        // iterative correction: Xn+1 = Xn - 0.5 * (Xn.Mt.Xn - M)
        let i = 0;
        let mx00, mx10, mx20, mx01, mx11, mx21, mx02, mx12, mx22, corr00, corr01, corr02, corr10, corr11, corr12, corr20, corr21, corr22;
        while (++i < 11) {

            // Mt.Xn
            mx00 = m0[0] * x00 + m1[0] * x10 + m2[0] * x20;
            mx10 = m0[1] * x00 + m1[1] * x10 + m2[1] * x20;
            mx20 = m0[2] * x00 + m1[2] * x10 + m2[2] * x20;
            mx01 = m0[0] * x01 + m1[0] * x11 + m2[0] * x21;
            mx11 = m0[1] * x01 + m1[1] * x11 + m2[1] * x21;
            mx21 = m0[2] * x01 + m1[2] * x11 + m2[2] * x21;
            mx02 = m0[0] * x02 + m1[0] * x12 + m2[0] * x22;
            mx12 = m0[1] * x02 + m1[1] * x12 + m2[1] * x22;
            mx22 = m0[2] * x02 + m1[2] * x12 + m2[2] * x22;

            // Xn+1
            o0[0] = x00 - 0.5 * (x00 * mx00 + x01 * mx10 + x02 * mx20 - m0[0]);
            o0[1] = x01 - 0.5 * (x00 * mx01 + x01 * mx11 + x02 * mx21 - m0[1]);
            o0[2] = x02 - 0.5 * (x00 * mx02 + x01 * mx12 + x02 * mx22 - m0[2]);
            o1[0] = x10 - 0.5 * (x10 * mx00 + x11 * mx10 + x12 * mx20 - m1[0]);
            o1[1] = x11 - 0.5 * (x10 * mx01 + x11 * mx11 + x12 * mx21 - m1[1]);
            o1[2] = x12 - 0.5 * (x10 * mx02 + x11 * mx12 + x12 * mx22 - m1[2]);
            o2[0] = x20 - 0.5 * (x20 * mx00 + x21 * mx10 + x22 * mx20 - m2[0]);
            o2[1] = x21 - 0.5 * (x20 * mx01 + x21 * mx11 + x22 * mx21 - m2[1]);
            o2[2] = x22 - 0.5 * (x20 * mx02 + x21 * mx12 + x22 * mx22 - m2[2]);

            // correction on each elements
            corr00 = o0[0] - m0[0];
            corr01 = o0[1] - m0[1];
            corr02 = o0[2] - m0[2];
            corr10 = o1[0] - m1[0];
            corr11 = o1[1] - m1[1];
            corr12 = o1[2] - m1[2];
            corr20 = o2[0] - m2[0];
            corr21 = o2[1] - m2[1];
            corr22 = o2[2] - m2[2];

            // Frobenius norm of the correction
            fn1 = corr00 * corr00 + corr01 * corr01 + corr02 * corr02 +
                corr10 * corr10 + corr11 * corr11 + corr12 * corr12 +
                corr20 * corr20 + corr21 * corr21 + corr22 * corr22;

            // convergence test
            if (Math.abs(fn1 - fn) <= threshold) {
                return o;
            }

            // prepare next iteration
            x00 = o0[0];
            x01 = o0[1];
            x02 = o0[2];
            x10 = o1[0];
            x11 = o1[1];
            x12 = o1[2];
            x20 = o2[0];
            x21 = o2[1];
            x22 = o2[2];
            fn = fn1;
        }
        throw new Exception("Failed to converge on orthogonal matrix after 10 iterations");
    }

    toString(asQ = Rot.showQ, showAxAng = Rot.showAxAng) {
        const axis = this.getAxis();
        const angleDegrees = Math.toDegrees(this.getAngle());
        let strAA = `Axis: (${axis.toString()}), AngleDeg: ${angleDegrees.toFixed(2)}`;
        let stQQ = `wxyz : {${this.w.toFixed(4)}, ${this.x.toFixed(4)}, ${this.y.toFixed(4)}, ${this.z.toFixed(4)}}`;
        let combined = showAxAng ? (strAA + (asQ ? `
        ${stQQ}` : '')) : stQQ;
        return combined;
    }

    toStr(asQ = Rot.showQ, showAxAng = Rot.showAxAng) {
        return this.toString(asQ, showAxAng);//"\n axis: "+ this.getAxis().toVec3f() +", \n angle: "+((float)Math.toDegrees(this.getAngle()));
    }

    getAngleGlyph() {
        let angle = Math.toDegrees(this.getAngle());
        if (angle < 0) angle += 360;

        const glyphs = [
            { threshold: 22.5, symbol: '↑' }, // 0 degrees
            { threshold: 67.5, symbol: '↗' }, // 45 degrees
            { threshold: 112.5, symbol: '→' }, // 90 degrees
            { threshold: 157.5, symbol: '↘' }, // 135 degrees
            { threshold: 202.5, symbol: '↓' }, // 180 degrees
            { threshold: 247.5, symbol: '↙' }, // 225 degrees
            { threshold: 292.5, symbol: '←' }, // 270 degrees
            { threshold: 337.5, symbol: '↖' }, // 315 degrees
            { threshold: 360, symbol: '↑' }  // Back to 0 degrees
        ];
        let gf = glyphs.find(g => angle <= g.threshold);
        return gf.symbol;
    }

    toConsole(asQ = Rot.showQ, showAxAng = Rot.showAxAng) {
        if (asQ)
            console.log(this.toString(true, false));
        if (showAxAng) {
            const glyph = this.getAngleGlyph();
            let angle = this.getAngle();

            console.log(`%c● %c ${glyph} %c${this.toString(false, true)}`, `${this.getAxis().asConsoleString(1).style}; font-size: 2em`, `font-size: 2em; margin-left: -14px;`, `font-size: 1em;`);
        }
    }

    toCons() {
        console.log(this.toString(true, true));
    }

    static distance(r1, r2) {
        return r1.applyInverseToRot(r2, Rot.GLOBAL_TEMP).shorten().getAngle();
    }

    equalTo(m) {
        return this.applyConjugateToRot(m).getAngle() < 1e-7;
    }
}




class RotIdentity extends Rot {
    static final = false;
    constructor() { super(1, 0, 0, 0); RotIdentity.final = true; }

    clone() { return new Rot(1, 0, 0, 0); }
    toJSON() {
        return {w: 1, x: 0, y: 0, z:0};
    }
    get w() { return 1; }
    get x() { return 0; }
    get y() { return 0; }
    get z() { return 0; }
    get _w() { return 1; }
    get _x() { return 0; }
    get _y() { return 0; }
    get _z() { return 0; }
    /**
     * @param {number} val
     */
    set x(val) { if (RotIdentity.final) throw new Error("Don't touch me."); };
    /**
     * @param {number} val
     */
    set y(val) { if (RotIdentity.final) throw new Error("Don't touch me."); };
    /**
     * @param {number} val
     */
    set z(val) { if (RotIdentity.final) throw new Error("Don't touch me."); };
    /**
     * @param {number} val
     */
    set w(val) { if (RotIdentity.final) throw new Error("Don't touch me."); };
    /**
     * @param {number} val
     */
    set _x(val) { if (RotIdentity.final) throw new Error("I said don't fn touch me!"); };
    /**
     * @param {number} val
     */
    set _y(val) { if (RotIdentity.final) throw new Error("I said don't fn touch me!"); };
    /**
     * @param {number} val
     */
    set _z(val) { if (RotIdentity.final) throw new Error("I said don't fn touch me!"); };
    /**
     * @param {number} val
     */
    set _w(val) { if (RotIdentity.final) throw new Error("I said don't fn touch me!"); };
}
Rot.IDENTITY = new RotIdentity(1, 0, 0, 0);
Rot.IDENTITY.final = true;
Rot.GLOBAL_TEMP = new Rot(1,0,0,0);



/** 
 * This code has its roots in the APACHE Math Commons (but has diverged significantly). 
 * 
 * The explainer below is from unrelated NASA code, but should help explain why you see
 * surprising conventions in multiplication order or conjugation. 
 * 
 * I think JPL Quaternions have gained undue popularity largely for the sex factor of 
 * having Jet Propulsion code in your project. I have mixed feelings on renaming Hamilton
 * Quaternions to "SPICE" quaternions, but one of those feelings is that a sexier name might 
 * help put things right.
 * 
 Quaternion Styles
   -----------------

   There are different "styles" of quaternions used in
   science and engineering applications. Quaternion styles
   are characterized by

   -  The order of quaternion elements

   -  The quaternion multiplication formula

   -  The convention for associating quaternions
      with rotation matrices

   Two of the commonly used styles are

      - "SPICE"

         > Invented by Sir William Rowan Hamilton
         > Frequently used in mathematics and physics textbooks

      - "Engineering"

         > Widely used in aerospace engineering applications


   CSPICE function interfaces ALWAYS use SPICE quaternions.
   Quaternions of any other style must be converted to SPICE
   quaternions before they are passed to CSPICE functions.


   Relationship between SPICE and Engineering Quaternions
   ------------------------------------------------------

   Let M be a rotation matrix such that for any vector V,

      M*V

   is the result of rotating V by theta radians in the
   counterclockwise direction about unit rotation axis vector A.
   Then the SPICE quaternions representing M are

      (+/-) (  cos(theta/2),
               sin(theta/2) A(1),
               sin(theta/2) A(2),
               sin(theta/2) A(3)  )

   while the engineering quaternions representing M are

      (+/-) ( -sin(theta/2) A(1),
              -sin(theta/2) A(2),
              -sin(theta/2) A(3),
               cos(theta/2)       )

   For both styles of quaternions, if a quaternion q represents
   a rotation matrix M, then -q represents M as well.

   Given an engineering quaternion

      QENG   = ( q0,  q1,  q2,  q3 )

   the equivalent SPICE quaternion is

      QSPICE = ( q3, -q0, -q1, -q2 )


   Associating SPICE Quaternions with Rotation Matrices
   ----------------------------------------------------

   Let FROM and TO be two right-handed reference frames, for
   example, an inertial frame and a spacecraft-fixed frame. Let the
   symbols

      V    ,   V
       FROM     TO

   denote, respectively, an arbitrary vector expressed relative to
   the FROM and TO frames. Let M denote the transformation matrix
   that transforms vectors from frame FROM to frame TO; then

      V   =  M * V
       TO         FROM

   where the expression on the right hand side represents left
   multiplication of the vector by the matrix.

   Then if the unit-length SPICE quaternion q represents M, where

      q = (q0, q1, q2, q3)

   the elements of M are derived from the elements of q as follows:

        +-                                                         -+
        |           2    2                                          |
        | 1 - 2*( q2 + q3 )   2*(q1*q2 - q0*q3)   2*(q1*q3 + q0*q2) |
        |                                                           |
        |                                                           |
        |                               2    2                      |
    M = | 2*(q1*q2 + q0*q3)   1 - 2*( q1 + q3 )   2*(q2*q3 - q0*q1) |
        |                                                           |
        |                                                           |
        |                                                   2    2  |
        | 2*(q1*q3 - q0*q2)   2*(q2*q3 + q0*q1)   1 - 2*( q1 + q2 ) |
        |                                                           |
        +-                                                         -+

   Note that substituting the elements of -q for those of q in the
   right hand side leaves each element of M unchanged; this shows
   that if a quaternion q represents a matrix M, then so does the
   quaternion -q.

   To map the rotation matrix M to a unit quaternion, we start by
   decomposing the rotation matrix as a sum of symmetric
   and skew-symmetric parts:

                                      2
      M = [ I  +  (1-cos(theta)) OMEGA  ] + [ sin(theta) OMEGA ]

                   symmetric                   skew-symmetric


   OMEGA is a skew-symmetric matrix of the form

                 +-             -+
                 |  0   -n3   n2 |
                 |               |
       OMEGA  =  |  n3   0   -n1 |
                 |               |
                 | -n2   n1   0  |
                 +-             -+

   The vector N of matrix entries (n1, n2, n3) is the rotation axis
   of M and theta is M's rotation angle. Note that N and theta
   are not unique.

   Let

      C = cos(theta/2)
      S = sin(theta/2)

   Then the unit quaternions Q corresponding to M are

      Q = +/- ( C, S*n1, S*n2, S*n3 )

   The mappings between quaternions and the corresponding rotations
   are carried out by the CSPICE routines

      q2m_c {quaternion to matrix}
      m2q_c {matrix to quaternion}

   m2q_c always returns a quaternion with scalar part greater than
   or equal to zero.


   SPICE Quaternion Multiplication Formula
   ---------------------------------------

   Given a SPICE quaternion

      Q = ( q0, q1, q2, q3 )

   corresponding to rotation axis A and angle theta as above, we can
   represent Q using "scalar + vector" notation as follows:

      s =   q0           = cos(theta/2)

      v = ( q1, q2, q3 ) = sin(theta/2) * A

      Q = s + v

   Let Q1 and Q2 be SPICE quaternions with respective scalar
   and vector parts s1, s2 and v1, v2:

      Q1 = s1 + v1
      Q2 = s2 + v2

   We represent the dot product of v1 and v2 by

      <v1, v2>

   and the cross product of v1 and v2 by

      v1 x v2

   Then the SPICE quaternion product is

      Q1*Q2 = s1*s2 - <v1,v2>  + s1*v2 + s2*v1 + (v1 x v2)

   If Q1 and Q2 represent the rotation matrices M1 and M2
   respectively, then the quaternion product

      Q1*Q2

   represents the matrix product

      M1*M2
Examples
   1)  A case amenable to checking by hand calculation:

          To convert the rotation matrix

                   +-              -+
                   |  0     1    0  |
                   |                |
             r  =  | -1     0    0  |
                   |                |
                   |  0     0    1  |
                   +-              -+

          also represented as

             [ pi/2 ]
                     3

          to a quaternion, we can use the code fragment

             rotate_c (  halfpi_c(),  3,  r );
             m2q_c    (  r,               q );

          m2q_c will return `q' as

             ( sqrt(2)/2, 0, 0, -sqrt(2)/2 )

          Why?  Well, `r' is a reference frame transformation that
          rotates vectors by -pi/2 radians about the axis vector

              a = ( 0, 0, 1 )

          Equivalently, `r' rotates vectors by pi/2 radians in
          the counterclockwise sense about the axis vector

             -a = ( 0, 0, -1 )

          so our definition of `q',

             h = theta/2

             q = ( cos(h), sin(h)a , sin(h)a , sin(h)a  )
                                  1         2         3

          implies that in this case,

             q =  ( cos(pi/4),  0,  0,  -sin(pi/4) )

               =  ( sqrt(2)/2,  0,  0,  -sqrt(2)/2 )


   2)  Finding a set of Euler angles that represent a rotation
       specified by a quaternion:

          Suppose our rotation `r' is represented by the quaternion
          `q'. To find angles `tau', `alpha', `delta' such that


             r  =  [ tau ]  [ pi/2 - delta ]  [ alpha ]
                          3                 2          3

          we can use the code fragment
**/
