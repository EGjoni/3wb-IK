
/**untyped vec3, use for any frequent instantiatons, as its faster to create than floatbuffer*/

export class NoPool {
    constructor() { }
    new_Vec3(x = 0, y = 0, z = 0) {
        return new Vec3(x, y, z);
    }
    any_Vec3(x = 0, y = 0, z = 0) {
        return __tempVecPool.any_Vec3(x, y, z);
    }

    new_Vec3fv(v) {
        return new Vec3(v.x, v.y, v.z);
    }
    any_Vec3fv(v) {
        return __tempVecPool.any_Vec3fv(v);
    }

    releaseTemp() {

    }
    unfinalize() { }
    finalize() { }
}
const nullPool = new NoPool();
window.noPool = nullPool;

export class Vec3 {
    static failedNormalizeCount = 0;
    static failLoudly = true;
    baseIdx = 0;
    dataBuffer = null;
    dims = 3;
    inPool = nullPool;
    constructor(x = 0, y = 0, z = 0, dataBuffer = [0, 0, 0]) {
        this.dataBuffer = dataBuffer
        this.x = x, this.y = y, this.z = z;
    }

    get x() { return this.dataBuffer[this.baseIdx]; }
    set x(value) { this.dataBuffer[this.baseIdx] = value; }

    get y() { return this.dataBuffer[this.baseIdx + 1]; }
    set y(value) { this.dataBuffer[this.baseIdx + 1] = value; }

    get z() { return this.dataBuffer[this.baseIdx + 2]; }
    set z(value) { this.dataBuffer[this.baseIdx + 2] = value; }


    /** Sets the components from the given spherical coordinate
     * @param azimuthalAngle The angle between x-axis in radians [0, 2pi]
     * @param polarAngle The angle between z-axis in radians [0, pi]
     * @return This vector for chaining */
    setFromSpherical(azimuthalAngle, polarAngle) {
        let cosPolar = Math.cos(polarAngle);
        let sinPolar = Math.sin(polarAngle);

        let cosAzim = Math.cos(azimuthalAngle);
        let sinAzim = Math.sin(azimuthalAngle);

        return this.setComponents(cosAzim * sinPolar, sinAzim * sinPolar, cosPolar);
    }

    /**returns the cross product of this vector and the input vector. (returned vector is ephemeral)**/
    cross(input, storeIn =this.inPool.any_Vec3()) {
        const sdb = storeIn.dataBuffer;
        const sbx = storeIn.baseIdx;
        const db = this.dataBuffer;
        const bx = this.baseIdx;
        const idb = input.dataBuffer;
        const ibx = input.baseIdx;
        
        sdb[sbx] = db[bx+1] * idb[ibx+2] - db[bx+2] * idb[ibx+1];
        sdb[sbx+1] = db[bx+2] * idb[ibx] - db[bx] * idb[ibx+2];
        sdb[sbx+2] = db[bx] * idb[ibx+1] - db[bx+1] * idb[ibx];
        
        return storeIn;
    }

    /**returns a non-epehemeral clone of this vector */
    clone() {
        return new Vec3(this.x, this.y, this.z);
    }

    /**returns an ephemeral clone of this vector from whichever pool it resides in */
    tempClone() {
        return this.inPool.any_Vec3fv(this);
    }


    /**returns true if any components are NaN */
    hasNaN() {
        return isNaN(this.x) || isNaN(this.y) || isNaN(this.z);
    }

    /**
     * return a vector orthogonal to this one. the output is epehemeral unless you provide an input vector to store the result in.
    */
    getOrthogonal_temp(result = this.inPool.any_Vec3()) {
        const { x, y, z } = this;
        result.setComponents(0, 0, 0);
        let threshold = this.mag() * 0.6;
        if (threshold > 0) {
            if (Math.abs(x) <= threshold) {
                let inverse = 1 / Math.sqrt(y * y + z * z);
                return result.setComponents(0, inverse * z, -inverse * y);
            } else if (Math.abs(y) <= threshold) {
                let inverse = 1 / Math.sqrt(x * x + z * z);
                return result.setComponents(-inverse * z, 0, inverse * x);
            }
            let inverse = 1 / Math.sqrt(x * x + y * y);
            return result.setComponents(inverse * y, -inverse * x, 0);
        }

        return result;
    }

    /**
         * @param {Instanceof _VecN or Array} vec 
         * @return this vector for chaining
         */
    set(vec) {
        const baseIdx = this.baseIdx, db = this.dataBuffer, vidx = vec.baseIdx, vdb = vec.dataBuffer;
        db[baseIdx] = vdb[vidx];
        db[baseIdx + 1] = vdb[vidx + 1];
        db[baseIdx + 2] = vdb[vidx + 2];
        return this;
    }

    /**
     * @param {Vector3} vec 
     * @return this vector for chaining
     */
    readFromTHREE(vec) {
        const baseIdx = this.baseIdx;
        this.dataBuffer[baseIdx] = vec.x;
        this.dataBuffer[baseIdx + 1] = vec.y;
        this.dataBuffer[baseIdx + 2] = vec.z;
        return this;
    }

    /**
     * 
     * @param {Vector3} vec the vector to wite into
     * @returns the THREE.Vector3 that was written into.
     */
    writeToTHREE(vec) {
        const baseIdx = this.baseIdx;
        vec.set(this.dataBuffer[baseIdx], this.dataBuffer[baseIdx + 1], this.dataBuffer[baseIdx + 2]);
        return vec;
    }

    setComponents(x, y, z) {
        const baseX = this.baseIdx;
        this.dataBuffer[baseX] = x;
        this.dataBuffer[baseX + 1] = y;
        this.dataBuffer[baseX + 2] = z;
        return this;
    }

    /** writes thes components of this vector into the given array. If no aray is given, one will be created and returned**/
    toArray(into = new Array(this.dims)) {
        for (let i = 0; i < this.dims; i++) {
            into[i] = this.dataBuffer[this.baseIdx + i];
        }
        return into;
    }

    static extractInputComponents(vec) {
        if (vec instanceof Vec3) return vec.dataBuffer;
        else if (Array.isArray(vec)) return vec;
        else throw Error('Unsupported vector format');
    }

    /**swap the values of these vectors */
    static swap(v1, v2) {
        const v1x = v1.baseIdx, v2x = v2.baseIdx;
        const v1y = v1.baseIdx + 1, v2y = v2.baseIdx + 1;
        const v1z = v1.baseIdx + 2, v2z = v2.baseIdx + 2;
        const v1db = v1.dataBuffer; 
        const v2db = v2.dataBuffer;

        v1db[v1x] = v1db[v1x] ^ v2db[v2x];
        v2db[v2x] = v1db[v1x] ^ v2db[v2x];
        v1db[v1x] = v1db[v1x] ^ v2db[v2x];

        v1db[v1y] = v1db[v1y] ^ v2db[v2y];
        v2db[v2y] = v1db[v1y] ^ v2db[v2y];
        v1db[v1y] = v1db[v1y] ^ v2db[v2y];

        v1db[v1z] = v1db[v1z] ^ v2db[v2z];
        v2db[v2z] = v1db[v1z] ^ v2db[v2z];
        v1db[v1z] = v1db[v1z] ^ v2db[v2z];
    }

    /**
     * writes the values of this vector into the provided array starting at the provided index
     * @param {Array} arr the array to write into
     * @param {Number} baseX the index to start writing into.
     * @returns the array written into
     */
    writeInto(arr, baseX) {
        const thisX = this.baseIdx;
        arr[baseX] = this.dataBuffer[thisX];
        arr[baseX + 1] = this.dataBuffer[thisX + 1];
        arr[baseX + 2] = this.dataBuffer[thisX + 2];
        return this;
    }

    /**
     * reads the values of the provided array into this vector starting from the provided index.
     * @param {Array} arr the array to read from
     * @param {Number} baseX the index to start reading from;
     * @returns this vector from chainging
     */
    readFrom(arr, baseX) {
        const thisX = this.baseIdx;
        const db = this.dataBuffer;
        db[thisX] = arr[baseX];
        db[thisX + 1] = arr[baseX + 1];
        db[thisX + 2] = arr[baseX + 2];
        return this;
    }

    mag() {
        const thisX = this.baseIdx;
        const x = this.dataBuffer[thisX], y = this.dataBuffer[thisX + 1], z = this.dataBuffer[thisX + 2];
        return Math.sqrt(x * x + y * y + z * z);
    }

    magSq() {
        const thisX = this.baseIdx;
        const x = this.dataBuffer[thisX], y = this.dataBuffer[thisX + 1], z = this.dataBuffer[thisX + 2];
        return x * x + y * y + z * z;
    }

    /**manhattan distance of this vec from the origin */
    magnhattan() {
        const baseX = this.baseIdx;
        const db = this.dataBuffer;
        return Math.abs(db[baseX]) +
            Math.abs(db[baseX + 1]) +
            Math.abs(db[baseX + 2]);
    }


    /**sets all of the components of this vector their absolute values*/
    absComponents() {
        const baseX = this.baseIdx;
        const db = this.dataBuffer;
        db[baseX] = Math.abs(db[baseX]);
        db[baseX + 1] = Math.abs(db[baseX+1]); 
        db[baseX + 2] = Math.abs(db[baseX+2]); 
        return this;    
    }

    /**sum of components of this vector */
    sum() {
        const baseX = this.baseIdx;
        const db = this.dataBuffer;
        return db[baseX] + db[baseX + 1] + db[baseX + 2];
    }


    /**multiplies the given vector by the given scalar, and adds the result to this vector, returning this vector */
    mulAdd(v, scalar) {
        const vbaseX = v.baseIdx;
        const vdb = v.dataBuffer;
        const baseX = this.baseIdx;
        const db = this.dataBuffer;

        db[baseX] += vdb[vbaseX] * scalar;
        db[baseX + 1] += vdb[vbaseX + 1] * scalar;
        db[baseX + 2] += vdb[vbaseX + 2] * scalar;
        return this;
    }

    limit(limit) {
        const magnitude = this.mag();
        if (magnitude !== 0 && magnitude > limit) {
            this.mult(limit / magnitude);
        }
        return this;
    }

    limitSq(limitSq) {
        const magnitudeSq = this.magSq();
        if (magnitudeSq !== 0 && magnitudeSq > limitSq) {
            this.mult(limitSq / magnitudeSq);
        }
        return this;
    }

    setMag(length) {
        const magnitude = this.mag();
        if (magnitude !== 0) {
            this.mult(length / magnitude);
        }
        return this;
    }

    setMagSq(lengthSq) {
        const magnitudeSq = this.magSq();
        if (magnitudeSq !== 0) {
            this.mult(lengthSq / magnitudeSq);
        }
        return this;
    }

    clamp(min, max) {
        const magnitude = this.mag();
        if (magnitude < min) {
            this.setMag(min);
        } else if (magnitude > max) {
            this.setMag(max);
        }
        return this;
    }
    /**
     * Do not confuse with "bound"
     * forces all of the components to be >= to the min val and <= to the max val.
     * 
     * @param {Number} min 
     * @param {Number} max 
     */
    clampComponents(min, max) {
        this.x = Math.max(Math.min(max, this.x), min);
        this.y = Math.max(Math.min(max, this.y), min);
        this.z = Math.max(Math.min(max, this.z), min);
        return this;
    }

    /**
     * Do not confuse with "clamp"
     * creates a bounding box from the provided vectors. If the vector is outside of the box, forces it onto the boundary of the box
     * @param {Vec3 | Vector3} v1 
     * @param {Vec3 | Vector3} v2 
     * @param {Boolean} invertBuund if provided with a truthy value, will clamp bound the vector to be OUTSIDE of the box.
     */
    bound(v1, v2, invertBound = false) {
        var maxval = Math.max(v1.x, v2.x);
        var minval = Math.min(v1.x, v2.x);
        function maybeInvert() {
            if (!invertBound) return;
            let t = maxval;
            maxval = minval;
            minval = t;
        }
        maybeInvert();
        this.x = Math.max(Math.min(maxval, this.x), minval);
        maxval = Math.max(v1.y, v2.y); minval = Math.min(v2.y, v1.y); maybeInvert();
        this.y = Math.max(Math.min(maxval, this.y), minval);
        maxval = Math.max(v1.z, v2.z); minval = Math.min(v2.z, v1.z); maybeInvert();
        this.z = Math.max(Math.min(maxval, this.z), minval);
        return this;
    }
    /* creates a bounding box from the provided vectors. returns true if this vector is in the box, false otherwise */
    isInBounds(v1, v2) {
        let maxval = Math.max(v1.x, v2.x);
        let minval = Math.min(v1.x, v2.x);
        if (this.x < minval || this.x > maxval) return false;
        maxval = Math.max(v1.y, v2.y); minval = Math.min(v2.y, v1.y);
        if (this.y < minval || this.y > maxval) return false;
        maxval = Math.max(v1.z, v2.z); minval = Math.min(v2.z, v1.z);
        if (this.z < minval || this.z > maxval) return false;
        return true;
    }

    dot(v) {
        const vbaseX = v.baseIdx;
        const vdb = v.dataBuffer;
        const baseX = this.baseIdx;
        const db = this.dataBuffer;
        
        return (db[baseX] * vdb[vbaseX] +
        db[baseX + 1] * vdb[vbaseX + 1] +
        db[baseX + 2] * vdb[vbaseX + 2]);
    }

    /**returns the projection of this vector onto the input vector*/
    projectedOn(v, storeIn) {
        let vmag = v.mag();
        let dot = this.dot(v);
        return storeIn.set(v).div(vmag).mult(dot / vmag);
    }

    /**component wise divide this vec3 by the given vec3 
     * @param {Vec3} v vec3 to divide by
     * @return {Vec3} this vec3 for chaining
    */
    compDiv(v) {
        const vbaseX = v.baseIdx;
        const baseX = this.baseIdx;
        this.dataBuffer[baseX] /= v.dataBuffer[vbaseX];
        this.dataBuffer[baseX + 1] /= v.dataBuffer[vbaseX + 1];
        this.dataBuffer[baseX + 2] /= v.dataBuffer[vbaseX + 2];
        return this;
    }

    /**
     * component wise multiply this vec3 by the given vec3
     * @param {Vec3} v vec3 to multiply by
     * @return {Vec3} this vec3 for chaining
    */
    compMult(v) {
        const vbaseX = v.baseIdx;
        const baseX = this.baseIdx;
        this.dataBuffer[baseX] *= v.dataBuffer[vbaseX];
        this.dataBuffer[baseX + 1] *= v.dataBuffer[vbaseX + 1];
        this.dataBuffer[baseX + 2] *= v.dataBuffer[vbaseX + 2];
        return this;
    }
    /**
     * like compMult, but stores the result in the provided Vec3 instead of into this vector
     * @param {*} v 
     * @param {*} storeIn 
     * @returns 
     */
    compMultInto(v, storeIn) {
        const vbaseX = v.baseIdx;
        const vdb = v.dataBuffer;
        const baseX = this.baseIdx;
        const sbaseX = storeIn.baseIdx;
        const sdb = storeIn.dataBuffer;
        const db = this.dataBuffer;
        sdb[sbaseX] = vdb[vbaseX] * db[baseX];
        sdb[sbaseX + 1] = vdb[vbaseX + 1] * db[baseX+1];
        sdb[sbaseX + 2] = vdb[vbaseX + 2] * db[baseX+2];
        return this;
    }

    div(n) {
        const baseX = this.baseIdx;
        this.dataBuffer[baseX] /= n;
        this.dataBuffer[baseX + 1] /= n;
        this.dataBuffer[baseX + 2] /= n;
        return this;
    }

    divClone(scalar, result = this.clone()) {
        result.set(this);
        result.div(scalar);
        return result;
    }


    mult(scalar) {
        const baseX = this.baseIdx;
        this.dataBuffer[baseX] *= scalar;
        this.dataBuffer[baseX + 1] *= scalar;
        this.dataBuffer[baseX + 2] *= scalar;
        return this;
    }


    multInto(scalar, result) {
        const resBuf = result.dataBuffer;
        const baseX = this.baseIdx;
        const resBaseX = result.baseIdx;
        resBuf[resBaseX] = this.dataBuffer[baseX] * scalar;
        resBuf[resBaseX + 1] = this.dataBuffer[baseX + 1] * scalar;
        resBuf[resBaseX + 2] = this.dataBuffer[baseX + 2] * scalar;
        return result;
    }

    /**
     * multiplies the instance by a scalar and stores the result in the provided vector
     * @param {Vec3} scalar 
     * @param {Vec3} result 
     * @returns 
     */
    multClone(scalar, result = this.clone()) {
        result.set(this);
        result.mult(scalar);
        return result;
    }

    dist(v) {
        const vbaseX = v.baseIdx;
        const baseX = this.baseIdx;
        const deltX = this.dataBuffer[baseX] - v.dataBuffer[vbaseX],
            deltY = this.dataBuffer[baseX + 1] - v.dataBuffer[vbaseX + 1],
            deltZ = this.dataBuffer[baseX + 2] - v.dataBuffer[vbaseX + 2];

        return Math.sqrt(deltX * deltX + deltY * deltY + deltZ * deltZ);
    }

    distSq(v) {
        const vbaseX = v.baseIdx;
        const baseX = this.baseIdx;
        const deltX = this.dataBuffer[baseX] - v.dataBuffer[vbaseX],
            deltY = this.dataBuffer[baseX + 1] - v.dataBuffer[vbaseX + 1],
            deltZ = this.dataBuffer[baseX + 2] - v.dataBuffer[vbaseX + 2];

        return deltX * deltX + deltY * deltY + deltZ * deltZ;
    }

    lerp(target, alpha) {
        const vbaseX = target.baseIdx;
        const baseX = this.baseIdx;
        this.dataBuffer[baseX] += (target.dataBuffer[vbaseX] - this.dataBuffer[baseX]) * alpha;
        this.dataBuffer[baseX + 1] += (target.dataBuffer[vbaseX + 1] - this.dataBuffer[baseX + 1]) * alpha;
        this.dataBuffer[baseX + 2] += (target.dataBuffer[vbaseX + 2] - this.dataBuffer[baseX + 2]) * alpha;
        return this;
    }

    square() {
        const baseX = this.baseIdx;
        this.dataBuffer[baseX] *= this.dataBuffer[baseX];
        this.dataBuffer[baseX + 1] *= this.dataBuffer[baseX + 1];
        this.dataBuffer[baseX + 2] *= this.dataBuffer[baseX + 2];
        return this;
    }

    add(v) {
        const vbaseX = v.baseIdx;
        const baseX = this.baseIdx;
        this.dataBuffer[baseX] += v.dataBuffer[vbaseX];
        this.dataBuffer[baseX + 1] += v.dataBuffer[vbaseX + 1];
        this.dataBuffer[baseX + 2] += v.dataBuffer[vbaseX + 2];
        return this;
    }

    addClone(v, result = this.clone()) {
        result.set(this);
        result.add(v);
        return result;
    }

    sub(v) {
        const vbaseX = v.baseIdx;
        const baseX = this.baseIdx;
        this.dataBuffer[baseX] -= v.dataBuffer[vbaseX];
        this.dataBuffer[baseX + 1] -= v.dataBuffer[vbaseX + 1];
        this.dataBuffer[baseX + 2] -= v.dataBuffer[vbaseX + 2];
        return this;
    }

    subClone(v, result = this.clone()) {
        result.set(this);
        result.sub(v);
        return result;
    }

    /**subtract the provided value from all components */
    allSub(amount) {
        const db = this.dataBuffer;
        const baseX = this.baseX;
        db[baseX] -= amount;
        db[baseX + 1] -= amount;
        db[baseX + 2] -= amount;
        return this;
    }


    /**normalizes the vector, or sets it to (0,1,0) if it has 0 length and errorOnZeroMag is false.
     * @param {Boolean} errorOnZeroMag default determined by Vec3.failLoudly. Change that static variable or provide an argument of 'true' to throw an error instead of setting to (0,1,0) on zero magnitude case.
    */
    normalize(errorOnZeroMag = Vec3.failLoudly) {
        const baseX = this.baseIdx;
        const x = this.dataBuffer[baseX], y = this.dataBuffer[baseX + 1], z = this.dataBuffer[baseX + 2];
        const magsq = x * x + y * y + z * z
        if (magsq == 0) {
            Vec3.failedNormalizeCount++;
            if (errorOnZeroMag) {
                throw new Error("Tried to normalize a vector with zero magnitude");
            }
            this.dataBuffer[baseX + 1] = 1;
            return this;
        }
        const invmag = 1 / Math.sqrt(magsq);
        this.dataBuffer[baseX] *= invmag;
        this.dataBuffer[baseX + 1] *= invmag;
        this.dataBuffer[baseX + 2] *= invmag;
        return this;
    }

    /**returns this vector as color components in the specified magnitude range
     * x = red, y= green, z= blue. 
     * The range defines the half the width of a cube. origin maps to gray. 
     * black maps to (-range, -range, -range) 
    */
    asColor(range) {
        return Vec3.vecAsColor(this.x, this.y, this.z, range);
    }

    /**
     * returns a css color string for this vector.
     *  x = red, y= green, z= blue. 
     * The range defines the half the width of a cube. origin maps to gray. 
     * black maps to (-range, -range, -range) 
     * **/
    asConsoleString(range) {
        return Vec3.vecAsConsoleString(this.x, this.y, this.z, range);
    }

    static vecAsColor(x, y, z, range) {
        const inverseLerp = (min, max, value) => {
            return Math.min(Math.max((value - min) / (max - min), 0), 1);
        };
        const toColorValue = (normalized) => {
            return Math.round(normalized * 255);
        }
        const togamma = (normalized) => {
            return Math.pow(normalized, 2.2); //because dark-mode. always.
        }
        const r = inverseLerp(-range, range, x);
        const g = inverseLerp(-range, range, y);
        const b = inverseLerp(-range, range, z);
        const rgamma = togamma(r);
        const ggamma = togamma(g);
        const bgamma = togamma(b);
        return {
            r: toColorValue(rgamma), g: toColorValue(ggamma), b: toColorValue(bgamma),
            gamma_norm: { r: rgamma, g: ggamma, b: bgamma },
            raw_norm: { r: r, g: g, b: b },
        };
    }

    static vecAsConsoleString(x, y, z, range) {
        const baseString = Vec3.vecAsString(x, y, z);
        const colString = Vec3.vecAsColor(x, y, z, range);

        return { stringContent: baseString, consoleContent: `%c ${baseString}`, style: `color: rgb(${colString.r}, ${colString.g}, ${colString.b})` }
    }

    static vecAsString(x, y, z) {
        return '(' + x.toFixed(3) + ', ' + y.toFixed(3) + ', ' + z.toFixed(3) + ')';
    }

    toString() {
        return Vec3.vecAsString(this.x, this.y, this.z);
    }
    toConsole(range = 1) {
        let consoleString = this.asConsoleString(range);
        console.log(`${consoleString.stringContent} %c▇`, `${consoleString.style}`);
    }

    get components() {
        return [this.x, this.y, this.z];
    }


    release() {
        this.amFree = true;
        return this;
    }

    toJSON() {
        return [this.x, this.y, this.z];
    }

    static fromJSON(arr, pool) {
        return pool.new_Vec3(arr[0], arr[1], arr[2]);
    }

    /** 
     * *components() {
        for(let i = 0; i<this.dims; i++) {
            yield this.dataBuffer[this.baseIdx+i];
        }
    }*/
}


/**a pool for 3vectors backed by an array.
 * 
 * repetetive as hell because I don't trust JIT compilers
 */
export class Vec3Pool {
    persistentPool = [];
    reclaimedPool = []; //stores vecs that were previously
    inProgressPool = [];
    persistentBuffer;
    tempPool = null;// new Array(this.tempSize);
    tempBuffer; //= new Float64Array(tempSize * 3);
    isFinalized = false;
    isUnfinalized = false;
    pendingFirstReInsert = false;
    lru = -1;
    newVecsCreated = 0;
    newVecsCreatedSinceOwnerUnfinalized = 0;
    lastUnfinalizedBy = null;
    owner = null;
    limitScale = 10;
    isLocked = false;

    /**
     * 
     * @param {Number} tempSize number of vectors to make a pool for. This will create two buffers of the same size. One for scratchpad vectors that gets reused in an LRU cycl,
     * and one for persistent vectors that don't get touch after finalize is called. 
     * @param {Object} owner the entity instantiating this vector pool. anyone can call unfinalize to add new persistent vectors, but only the owner can finalize it, and the number of new entries is limited when unfinalized by anyone but the owner
     * @param {Number} limitScale some number to throw an error if too many vectors are added without the owner's knowledge. "too many" == tempSize*limitScale. You can disable this error by giving a value of -1
     */
    constructor(tempSize = 1000, owner, limitScale = 10, poolName = 'pool') {
        this.owner = owner;
        this.limitScale = limitScale;
        this.poolName = poolName;
        this.setTempPoolSize(tempSize);
    }


    /**takes control of the pool */
    sieze(newOwner) {
        this.owner = newOwner;
    }

    unfinalize(calledBy) {
        if (this.isLocked && calledBy != this.owner) return;
        else this.isLocked = false;

        if (calledBy == this.owner) {
            //console.group(this.poolName+' '+calledBy.ikd);     
            this.newVecsCreatedSinceOwnerUnfinalized = 0;
            this.lastUnfinalizedBy = calledBy;
        }
        if (this.lastUnfinalizedBy != this.owner || this.lastUnfinalizedBy == null)
            this.lastUnfinalizedBy = calledBy ?? this.lastUnfinalizedBy;

        if (this.isFinalized) {
            this.pendingFirstReInsert = true;
            this.newVecsCreated = 0;

        } else if (this.limitScale > 0) {
            if (this.newVecsCreatedSinceOwnerUnfinalized > this.tempSize * this.limitScale
                && this.lastUnfinalizedBy != this.owner && this.lastUnfinalizedBy != null) {
                throw new Error("Buffer uncontrolled buffer insertion limit exceeded. You can not insert more new vectors than the pool was initialized with unless the pool was unlocked by the owner");
            }
        }
        this.isFinalized = false;
        this.isUnfinalized = true;
    }

    reclaim() {
        this.isFinalized = false;
        this.lastUnfinalizedBy = null;
        this.pendingFirstReInsert = false;
        this.isUnfinalized = false;
        this.lru = -1;
        this.newVecsCreated = 0;
        if (this.persistentPool?.length > 0) {
            this.reclaimedPool = this.persistentPool;//.push(...this.persistentPool);
            this.inProgressPool = [];
            this.persistentPool = [];
        }
        this.releaseTemp();
        console.log(this.poolName + " RECLAIMED: " + this.reclaimedPool.length);
    }


    acquire(x = 0, y = 0, z = 0) {
        if (this.tempPool == null)
            this.setTempPoolSize(this.tempSize);
        if (this.isFinalized) {
            //let vec;
            //let attempts =0;
            //while(!isFree && attempts < this.tempPool.length) {

            this.lru++;
            if (this.lru >= this.tempPool.length) {
                console.warn(`
                        ran out of temporary vectors and had to begin resuing. Make sure you release any you're not using! You should either
                        1. call releaseAll() on this pool when you're at a point in your logic where you're sure any vectors you didn't call .finalize() for are free, or
                        2. increase the tempPool size or
                        3. manually call .release() on more vectors after you finish using them
                        `)
                this.lru = 0;
            }
            const vec = this.tempPool[this.lru];
            const odb = this.tempBuffer;
            const obase = vec.baseIdx;
            odb[obase] = x;
            odb[obase + 1] = y;
            odb[obase + 2] = y;
            //isFree = vec.amFree || this.assumeFree
            //vec.amFree = false;
            //attempts++;
            /*}
            if(attempts > 10) {
                console.log("attempted : "+attempts+" before finding " +this.lru);
            }*/
            //vec.x = x; vec.y =y; vec.z = z;
            //console.log("temp: "+this.lru);
            return vec;
        } else {
            if (this.isUnfinalized && this.pendingFirstReInsert) {
                this.pendingFirstReInsert = false;
                this.inProgressPool = [...this.persistentPool];
            }
            let newV;
            if (this.reclaimedPool.length > 0) {
                newV = this.reclaimedPool.pop();
                newV.x = x; newV.y = y; newV.z = z;
                this.inProgressPool.push(newV);
            } else {
                newV = new Vec3(x, y, z);
                newV.inPool = this;
                this.newVecsCreated++;
                if (this.lastUnfinalizedBy != this.owner)
                    this.newVecsCreatedSinceOwnerUnfinalized++;
                this.inProgressPool.push(newV);
            }
            return newV;
        }
    }

    acquirefv(iv) {
        if (this.tempPool == null)
            this.setTempPoolSize(this.tempSize);

        const idb = iv.dataBuffer;
        const ibase = iv.baseIdx;
        const x = idb[ibase], y = idb[ibase + 1], z = idb[ibase + 2];
        if (this.isFinalized) {
            this.lru = (this.lru + 1) % this.tempPool.length;
            const vec = this.tempPool[this.lru];
            const odb = this.tempBuffer;
            const obase = vec.baseIdx;
            odb[obase] = x;
            odb[obase + 1] = y;
            odb[obase + 2] = z;
            return vec;
        } else {
            if (this.isUnfinalized && this.pendingFirstReInsert) {
                this.pendingFirstReInsert = false;
                this.inProgressPool = [...this.persistentPool];
            }
            let newV;
            if (this.reclaimedPool.length > 0) {
                newV = this.reclaimedPool.pop();
                newV.x = x; newV.y = y; newV.z = z;
                this.inProgressPool.push(newV);
            } else {
                newV = new Vec3(x, y, z);
                newV.inPool = this;
                this.newVecsCreated++;
                if (this.lastUnfinalizedBy != this.owner)
                    this.newVecsCreatedSinceOwnerUnfinalized++;
                this.inProgressPool.push(newV);
            }
            return newV;
        }
    }

    temp_acquire(x = 0, y = 0, z = 0) {
        if (this.tempPool == null)
            this.setTempPoolSize(this.tempSize);

        this.lru = (this.lru + 1) % this.tempPool.length;
        const vec = this.tempPool[this.lru];
        const odb = this.tempBuffer;
        const obase = vec.baseIdx;
        odb[obase] = x;
        odb[obase + 1] = y;
        odb[obase + 2] = z;
        return vec;
    }

    temp_acquirefv(iv) {
        if (this.tempPool == null)
            this.setTempPoolSize(this.tempSize);
        this.lru = (this.lru + 1) % this.tempPool.length;

        const vec = this.tempPool[this.lru];
        const ibase = iv.baseIdx;
        const idb = iv.dataBuffer;
        const odb = this.tempBuffer;
        const obase = vec.baseIdx;
        odb[obase] = idb[ibase];
        odb[obase + 1] = idb[ibase + 1];
        odb[obase + 2] = idb[ibase + 2];
        return vec;
    }

    setTempPoolSize(newSize) {
        this.tempSize = newSize
        this.tempBuffer = new Float64Array(newSize * 3);
        this.tempPool = [];
        for (let i = 0; i < this.tempSize; i++) {
            const vec = new Vec3(0, 0, 0, this.tempBuffer);
            vec.inPool = this;
            vec.amFree = true;
            vec.baseIdx = i * 3;
            this.tempPool.push(vec.release());
        }
    }

    /**makes it so only the owner can unfinalize the pool */
    lock() {
        this.isLocked = true;
    }

    finalize() {
        if (this.isFinalized) return;
        let endgroup = true;
        this.lastUnfinalizedBy = null;
        if (this.pendingFirstReInsert) {
            this.pendingFirstReInsert = false;
        } else {
            if (this.newVecsCreated > 0) {
                //console.log(this.poolName+' size has grown by ' + this.newVecsCreated+'. New pool size is '+ this.inProgressPool.length); 
            }
            if (this.reclaimedPool.length > 0 || this.newVecsCreated == 0 && this.inProgressPool.length > 0) {
                this.persistentPool = this.inProgressPool;
                this.inProgressPool = [];
                this.isFinalized = true;
                this.isUnfinalized = false;
                this.pendingFirstReInsert = false;
                if (this.reclaimedPool.length > 0) {
                    //   console.log(this.poolName+" UNCLAIMED Vectors: " +this.reclaimedPool.length +'. New pool size is '+ this.inProgressPool.length+'\nCall trim() if you wish to free them from memory');
                }
                this.newVecsCreated = 0;
                this.newVecsCreatedSinceOwnerUnfinalized = 0;
                //if(endgroup) console.groupEnd(this.poolName+' '+ this.owner);
                return;
            }
            //if(endgroup) console.groupEnd(this.poolName+' '+ this.owner);

            const newBuffer = new Float64Array(this.inProgressPool.length * 3);
            const oldBuffer = this.persistentBuffer;
            for (let i = 0; i < this.inProgressPool.length; i++) {
                const baseIdx = i * 3;
                const vec = this.inProgressPool[i];
                const vx = vec.x, vy = vec.y, vz = vec.z;
                newBuffer[baseIdx] = vx;
                newBuffer[baseIdx + 1] = vy;
                newBuffer[baseIdx + 2] = vz;
                vec.dataBuffer = newBuffer;
                vec.baseIdx = baseIdx;
            }
            this.persistentBuffer = newBuffer;

            this.persistentPool = this.inProgressPool;
        }
        this.inProgressPool = [];
        this.isFinalized = true;
        this.isUnfinalized = false;
        this.pendingFirstReInsert = false;
        this.lru = -1;
        this.newVecsCreated = 0;
        this.newVecsCreatedSinceOwnerUnfinalized = 0;
        return this;
    }
    /**
     * trims excess from the persistemt buffer
     * @param {Number} shrinkTemp 0-1, if provided, will shrink the temp buffer to persistentBuffer * resizeTemp elements, cycling the lru as necessary. will not grow the temp buffer unless a value greater than 1 is used
     * @returns this pool for chaining
     */
    trim(shrinkTemp = false) {
        if (!this.isFinalized) {
            throw new Error("Can only trim finalized pools");
        }

        if (this.reclaimedPool.length > 0 || this.persistentPool.length * 3 < this.persistentBuffer.length) {
            const newBuffer = new Float64Array(this.persistentPool.length * 3);
            const oldBuffer = this.persistentBuffer;
            for (let i = 0; i < this.persistentPool.length; i++) {
                const baseIdx = i * 3;
                const vec = this.persistentPool[i];
                const vx = vec.x, vy = vec.y, vz = vec.z;
                newBuffer[baseIdx] = vx;
                newBuffer[baseIdx + 1] = vy;
                newBuffer[baseIdx + 2] = vz;
                vec.dataBuffer = newBuffer;
                vec.baseIdx = baseIdx;
            }
            let v = this.reclaimedPool.pop();
            while (v != null) {
                v.dataBuffer = null;
                v = this.reclaimedPool.pop();
            }
            this.persistentBuffer = newBuffer;
            console.log('Trimmed ' + ((oldBuffer.length - newBuffer.length) / 3) + 'entries');
        }


        if (shrinkTemp != false) {

            if (shrinkTemp * this.persistentPool.length < this.tempSize * shrinkTemp) {
                let newLRU = this.lru % this.tempPool.length;
                let newTempPool = [];
                while (newTempPool.length < this.tempPool.length && newTempPool.length < this.tempSize * shrinkTemp) {
                    newTempPool.push(this.tempPool[newLRU]);
                    newLRU = (newLRU + (this.tempPool.length - 1)) % this.tempPool.length;
                }

                let newLength = Math.max(newTempPool.length, this.tempSize * shrinkTemp);

                let newTempBuff = new Float64Array(newLength * 3);
                for (let i = 0; i < newTempPool.length; i++) {
                    const baseIdx = i * 3;
                    const vec = newTempPool[i];
                    const vx = vec.x, vy = vec.y, vz = vec.z;
                    newTempBuff[baseIdx] = vx;
                    newTempBuff[baseIdx + 1] = vy;
                    newTempBuff[baseIdx + 2] = vz;
                    vec.dataBuffer = newTempBuff;
                    vec.baseIdx = baseIdx;
                }
                while (newTempPool.length < this.tempSize * shrinkTemp) {
                    let vec = new Vec3(0, 0, 0, newTempBuff);
                    vec.inPool = this;
                    newTempPool.push(vec);
                    vec.amFree = true;
                    vec.baseIdx = (newTempPool.length - 1) * 3;
                }
                this.tempBuffer = newTempBuff;
                this.tempPool = newTempPool;
                this.lru = newLRU % newTempPool.length;
            }
        }
        return this;
    }

    /**
     * Let the VectorPool know that you're done with all of the temporary vectors you've been using so it doesn't need to yell at you.
     */
    releaseTemp() {
        this.lru = -1;
        this.assumeFree = true;
    }

    new_Vec3(x = 0, y = 0, z = 0) {
        return this.acquire(x, y, z);
    }

    any_Vec3(x = 0, y = 0, z = 0) {
        return this.temp_acquire(x, y, z);
    }

    /**
     * new pooled vec3 from vec
     * @param {*} x 
     * @param {*} y 
     * @param {*} z 
     * @returns 
     */
    new_Vec3fv(v) {
        return this.acquirefv(v);
    }

    any_Vec3fv(v) {
        return this.temp_acquirefv(v);
    }

    /**kills this pool and any vecs pointing to it*/
    dispose() {
        for (let v of this.tempPool) v.dataBuffer = null;
        for (let v of this.inProgressPool) v.dataBuffer = null;
        for (let v of this.persistentPool) v.dataBuffer = null;
        for (let v of this.reclaimedPool) v.dataBuffer = null;
        delete this.persistentBuffer;
        delete this.tempBuffer;
        delete this.tempPool;
        delete this.persistentPool;
        delete this.reclaimedPool;
    }
}


/**
 * ephemeral vector from components
 * @param {Number} x,
 * @param {Number} y,
 * @param {Number} z,
 * @returns {Vec3} an ephemeral vector from the default pool, or creates a new one if there is no pool
 */
export function any_Vec3(x = 0, y = 0, z = 0) {
    return __tempVecPool.temp_acquire(x, y, z);
}

/**
 * ephemeral vector from another vector
 * @param {Vec3} x
 * @returns {Vec3} an ephemeral vector from the default pool, or creates a new one if there is no pool
 */
export function any_Vec3fv(v) {
    return __tempVecPool.temp_acquirefv(v);
}



//I feel like anyone can spare 60kb for this convenience. 
const __tempVecPool = new Vec3Pool(2500, window, 10);
__tempVecPool.finalize().lock();
window.globalVecPool = __tempVecPool;