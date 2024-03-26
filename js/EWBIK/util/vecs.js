
/**untyped vec3, use for any frequent instantiatons, as its faster to create than floatbuffer*/


export class Vec3 {
    baseIdx = 0;
    dataBuffer = null;
    dims = 3;
    constructor(x=0, y=0, z=0, dataBuffer = [0, 0, 0]) {
        this.dataBuffer = dataBuffer
        this.x = x, this.y=y, this.z=z;
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

    /**returns the cross product of this vector and the input vector.**/
    cross(input, storeIn) {        
        storeIn.setComponents(
            this.y * input.z - this.z * input.y,
            this.z * input.x - this.x * input.z,
            this.x * input.y - this.y * input.x
        );
        return storeIn;
    }

    clone() {
        return new Vec3(this.x, this.y, this.z);
    }


    /**returns true if any components are NaN */
    hasNaN() {
        return isNaN(this.x) || isNaN(this.y) || isNaN(this.z);
    }
   
    getOrthogonal() {
        const { x, y, z } = this;
        let result = this.clone();
        result.setComponents(0, 0, 0);
        let threshold = this.mag() * 0.6;
        if (threshold > 0) {
            if (Math.abs(x) <= threshold) {
                let inverse = 1 / Math.sqrt(y * y + z * z);
                return result.setComponents(0, inverse * z, -inverse * y);
            } else if (Math.abs(y) <= threshold) {
                let inverse = 1 / Math.sqrt(x * x + z * z);
                return result.set(-inverse * z, 0, inverse * x);
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
        const baseIdx = this.baseIdx, vidx = vec.baseIdx;
        this.dataBuffer[baseIdx] = vec.dataBuffer[vidx];
        this.dataBuffer[baseIdx+1] = vec.dataBuffer[vidx+1];
        this.dataBuffer[baseIdx+2] = vec.dataBuffer[vidx+2];
        return this;
    }

    /**
     * @param {Vector3} vec 
     * @return this vector for chaining
     */
    readFromTHREE(vec) {
        const baseIdx = this.baseIdx;
        this.dataBuffer[baseIdx] = vec.x;
        this.dataBuffer[baseIdx+1] = vec.y;
        this.dataBuffer[baseIdx+2] = vec.z;
        return this;
    }

    /**
     * 
     * @param {Vector3} vec the vector to wite into
     * @returns the THREE.Vector3 that was written into.
     */
    writeToTHREE(vec) {
        const baseIdx = this.baseIdx;
        vec.set(this.dataBuffer[baseIdx], this.dataBuffer[baseIdx+1], this.dataBuffer[baseIdx+2]);
        return vec;
    }

    setComponents(x, y, z) {
        const baseX = this.baseIdx;
        this.dataBuffer[baseX] = x;
        this.dataBuffer[baseX+1] = y;
        this.dataBuffer[baseX+2] = z;
        return this;
    }

    /** writes thes components of this vector into the given array. If no aray is given, one will be created and returned**/
    toArray(into = new Array(this.dims)) {
        for (let i = 0; i < this.dims; i++) {
            into[i] = this.dataBuffer[this.baseIdx+i];
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
        const v1y = v1.baseIdx+1, v2y = v2.baseIdx+1; 
        const v1z = v1.baseIdx+2, v2z = v2.baseIdx+2; 
        v1.dataBuffer[v1x] = v1.dataBuffer[v1x] ^ v2.dataBuffer[v2x];
        v2.dataBuffer[v2x] = v1.dataBuffer[v1x] ^ v2.dataBuffer[v2x];
        v1.dataBuffer[v1x] = v1.dataBuffer[v1x] ^ v2.dataBuffer[v2x];

        v1.dataBuffer[v1y] = v1.dataBuffer[v1y] ^ v2.dataBuffer[v2y];
        v2.dataBuffer[v2y] = v1.dataBuffer[v1y] ^ v2.dataBuffer[v2y];
        v1.dataBuffer[v1y] = v1.dataBuffer[v1y] ^ v2.dataBuffer[v2y];

        v1.dataBuffer[v1z] = v1.dataBuffer[v1z] ^ v2.dataBuffer[v2z];
        v2.dataBuffer[v2z] = v1.dataBuffer[v1z] ^ v2.dataBuffer[v2z];
        v1.dataBuffer[v1z] = v1.dataBuffer[v1z] ^ v2.dataBuffer[v2z];
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
        arr[baseX+1] = this.dataBuffer[thisX+1];
        arr[baseX+2] = this.dataBuffer[thisX+2];
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
        this.dataBuffer[thisX] = arr[baseX];
        this.dataBuffer[thisX+1] = arr[baseX+1];
        this.dataBuffer[thisX+2] = arr[baseX+2];
        return this;
    }

    mag() {
        const thisX = this.baseIdx;
        const x = this.dataBuffer[thisX], y=this.dataBuffer[thisX+1], z = this.dataBuffer[thisX+2];
        return Math.sqrt(x*x + y*y + z*z);
    }

    magSq() {
        const thisX = this.baseIdx;
        const x = this.dataBuffer[thisX], y=this.dataBuffer[thisX+1], z = this.dataBuffer[thisX+2];
        return x*x + y*y + z*z;
    }

    /**manhattan distance of this vec from the origin */
    magnhattan() {
        return Math.abs(this.x+this.y+this.z);
    }


    /**multiplies the given vector by the given scalar, and adds the result to this vector, returning this vector */
    mulAdd(v, scalar) {
        const vbaseX = v.baseIdx;
        const baseX = this.baseIdx;
        
        this.dataBuffer[baseX] += v.dataBuffer[vbaseX] * scalar;
        this.dataBuffer[baseX+1] += v.dataBuffer[vbaseX+1] * scalar;
        this.dataBuffer[baseX+2] += v.dataBuffer[vbaseX+2] * scalar;
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

    dot(v) {
        const vbaseX = v.baseIdx;
        const baseX = this.baseIdx;        
        return this.dataBuffer[baseX] * v.dataBuffer[vbaseX] + 
        this.dataBuffer[baseX+1] * v.dataBuffer[vbaseX+1] +
        this.dataBuffer[baseX+2] * v.dataBuffer[vbaseX+2];
    }

    /**component wise divide this vec3 by the given vec3 
     * @param {Vec3} v vec3 to divide by
     * @return {Vec3} this vec3 for chaining
    */
    compDiv(v) {
        const vbaseX = v.baseIdx;
        const baseX = this.baseIdx;
        this.dataBuffer[baseX] /= v.dataBuffer[vbaseX];
        this.dataBuffer[baseX+1] /= v.dataBuffer[vbaseX+1];
        this.dataBuffer[baseX+2] /= v.dataBuffer[vbaseX+2];
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
        this.dataBuffer[baseX+1] *= v.dataBuffer[vbaseX+1];
        this.dataBuffer[baseX+2] *= v.dataBuffer[vbaseX+2];
        return this;
    }

    div(n) {
        const baseX = this.baseIdx;
        this.dataBuffer[baseX] /= n;
        this.dataBuffer[baseX+1] /= n;
        this.dataBuffer[baseX+2] /= n;
        return this;
    }

    divClone(scalar) {
        let result = this.clone();
        result.div(scalar);
        return result;
    }

    mult(scalar) {
        const baseX = this.baseIdx;
        this.dataBuffer[baseX] *= scalar;
        this.dataBuffer[baseX+1] *= scalar;
        this.dataBuffer[baseX+2] *= scalar;
        return this;
    }

    multClone(scalar) {
        let result = this.clone();
        result.mult(scalar);
        return result;
    }

    dist(v) {
        const vbaseX = v.baseIdx;
        const baseX = this.baseIdx;
        const   deltX = this.dataBuffer[baseX] - v.dataBuffer[vbaseX],
                deltY = this.dataBuffer[baseX+1] - v.dataBuffer[vbaseX+1],
                deltZ = this.dataBuffer[baseX+2] - v.dataBuffer[vbaseX+2];
        
        return Math.sqrt(deltX*deltX + deltY*deltY + deltZ*deltZ);
    }

    distSq(v) {
        const vbaseX = v.baseIdx;
        const baseX = this.baseIdx;
        const   deltX = this.dataBuffer[baseX] - v.dataBuffer[vbaseX],
                deltY = this.dataBuffer[baseX+1] - v.dataBuffer[vbaseX+1],
                deltZ = this.dataBuffer[baseX+2] - v.dataBuffer[vbaseX+2];
        
        return deltX*deltX + deltY*deltY + deltZ*deltZ;
    }

    lerp(target, alpha) {
        const vbaseX = target.baseIdx;
        const baseX = this.baseIdx;
        this.dataBuffer[baseX] += (target.dataBuffer[vbaseX] - this.dataBuffer[baseX]) * alpha;
        this.dataBuffer[baseX+1] += (target.dataBuffer[vbaseX+1] - this.dataBuffer[baseX+1]) * alpha;
        this.dataBuffer[baseX+2] += (target.dataBuffer[vbaseX+2] - this.dataBuffer[baseX+2]) * alpha;
        return this;
    }

    square() {
        const baseX = this.baseIdx;
        this.dataBuffer[baseX] *= this.dataBuffer[baseX] ;
        this.dataBuffer[baseX+1] *= this.dataBuffer[baseX+1];
        this.dataBuffer[baseX+2] *= this.dataBuffer[baseX+2];
        return this;
    }

    add(v) {
        const vbaseX = v.baseIdx;
        const baseX = this.baseIdx;
        this.dataBuffer[baseX] += v.dataBuffer[vbaseX];
        this.dataBuffer[baseX+1] += v.dataBuffer[vbaseX+1];
        this.dataBuffer[baseX+2] += v.dataBuffer[vbaseX+2];
        return this;
    }

    addClone(v) {
        let result = this.clone();
        result.add(v);
        return result;
    }

    sub(v) {
        const vbaseX = v.baseIdx;
        const baseX = this.baseIdx;
        this.dataBuffer[baseX] -= v.dataBuffer[vbaseX];
        this.dataBuffer[baseX+1] -= v.dataBuffer[vbaseX+1];
        this.dataBuffer[baseX+2] -= v.dataBuffer[vbaseX+2];
        return this;
    }

    subClone(v) {
        let result = this.clone();
        result.sub(v);
        return result;
    }

    normalize() {
        const baseX = this.baseIdx;
        const x = this.dataBuffer[baseX], y = this.dataBuffer[baseX+1], z = this.dataBuffer[baseX+2];
        const invmag = 1/Math.sqrt(x*x + y*y + z*z);
        this.dataBuffer[baseX] *= invmag;
        this.dataBuffer[baseX+1] *= invmag;
        this.dataBuffer[baseX+2] *= invmag;
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
        return {r: toColorValue(rgamma), g: toColorValue(ggamma), b:toColorValue(bgamma), 
            gamma_norm:{r: rgamma, g:ggamma, b:bgamma},
            raw_norm: {r: r, g:g, b:b},
        }; 
    }

    static vecAsConsoleString(x, y, z, range) {
        const baseString = Vec3.vecAsString(x, y, z);
        const colString = Vec3.vecAsColor(x, y, z, range);
        
        return {stringContent: baseString, consoleContent: `%c ${baseString}`, style:`color: rgb(${colString.r}, ${colString.g}, ${colString.b})`}
    }

    static vecAsString(x, y, z) {
        return '('+x.toFixed(3)+', '+y.toFixed(3)+', '+z.toFixed(3)+')';
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
    tempSize = 30000;
    tempPool = null;// new Array(this.tempSize);
    tempBuffer; //= new Float64Array(tempSize * 3);
    isFinalized = false;
    lru = -1;

    constructor(tempSize = 10000) {
        this.setTempPoolSize(tempSize);
    }

    reclaim() {
        this.isFinalized = false;  
        this.lru = -1;
        if(this.persistentPool?.length > 0) {
            this.reclaimedPool.push(...this.persistentPool);
            this.inProgressPool = [];
            this.persistentPool = [];
        }
        this.releaseAll();
        console.log("RECLAIMED: " + this.reclaimedPool.length);
    }

    
    acquire(x=0, y=0, z=0) {
        if(this.tempPool == null) 
            this.setTempPoolSize(this.tempSize);
        if (this.isFinalized) {
            //let vec;
            //let attempts =0;
            //while(!isFree && attempts < this.tempPool.length) {
                /*if(this.lru >= this.length) { 
                    if(this.assumeFree) {
                        this.assumeFree = false;
                        //attempts = 0;
                    } else if(attempts >= this.tempPool.length) {
                        console.warn(`
                        ran out of vectors after ${attempts} attempts! Make sure you release any you're not using! You should either
                        1. call releaseAll when you're at a point in your logic where you're sure any vectors you didn't call .finalize() for are free, or o
                        2. increase the tempPool size or
                        3. manually call .release() on more vectors after you finish using them
                        `)
                    }
                }*/
                this.lru = (this.lru + 1) % this.tempPool.length;
                const vec = this.tempPool[this.lru];        
                const odb = this.tempBuffer; 
                const obase = vec.baseIdx;
                odb[obase] = x;
                odb[obase+1] = y; 
                odb[obase+2] = y;
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
            let newV;
            if(this.reclaimedPool.length > 0) {
                newV = this.reclaimedPool.pop();
                newV.x = x; newV.y =y; newV.z = z;
                this.inProgressPool.push(newV);
            } else {
                newV = new Vec3(x, y, z);
                this.inProgressPool.push(newV);
            }
            return newV;
        }
    }

    acquirefv(iv) {
        if(this.tempPool == null) 
            this.setTempPoolSize(this.tempSize);

        const idb = iv.dataBuffer;
        const ibase = iv.baseIdx;
        const x = idb[ibase], y= idb[ibase+1], z= idb[ibase+2];
        if (this.isFinalized) {
            this.lru = (this.lru + 1) % this.tempPool.length;
            const vec = this.tempPool[this.lru];     
            const odb = this.tempBuffer; 
            const obase = vec.baseIdx;
            odb[obase] = x; 
            odb[obase+1] = y; 
            odb[obase+2] = z; 
            return vec;
        } else {
            let newV;
            if(this.reclaimedPool.length > 0) {
                newV = this.reclaimedPool.pop();
                newV.x = x; newV.y = y; newV.z = z;
                this.inProgressPool.push(newV);
            } else {
                newV = new Vec3(x, y, z);
                this.inProgressPool.push(newV);
            }
            return newV;
        }
    }



    temp_acquire(x=0, y=0, z=0) {
        if(this.tempPool == null) 
            this.setTempPoolSize(this.tempSize);
            //let isFree = false;
            //let vec = null;
            //let attempts = 0;
            /*while(!isFree && attempts < 10) {//this.tempPool.length) {
                if(this.lru >= this.tempPool.length) { 
                    if(assumeFree) {
                        assumeFree = false;
                    } else {
                        console.warn(`
                        ran out of vectors! Make sure you release any you're not using! You should either
                        1. call releaseAll when you're at a point in your logic where you're sure any vectors you didn't call .finalize() for are free, or o
                        2. increase the tempPool size or
                        3. manually call .release() on more vectors after you finish using them
                        `)
                    }
                }*/
        this.lru = (this.lru + 1) % this.tempPool.length;
        const vec = this.tempPool[this.lru];
                //isFree = vec.amFree;
                //attempts++
            //}
            /*if(attempts > 10) {
                console.log("attempted : "+attempts+"TEMP before finding " +this.lru);
            }
            vec.amFree = true; // since the user indicated that they will be discarding this anyway*/
        const odb = this.tempBuffer; 
        const obase = vec.baseIdx;
        odb[obase] = x; 
        odb[obase+1] = y; 
        odb[obase+2] = z; 
        return vec;
    }

    temp_acquirefv(iv) {
        if(this.tempPool == null) 
            this.setTempPoolSize(this.tempSize);
        this.lru = (this.lru + 1) % this.tempPool.length;

        const vec = this.tempPool[this.lru];
        const ibase = iv.baseIdx;
        const idb = iv.dataBuffer;         
        const odb = this.tempBuffer; 
        const obase = vec.baseIdx;
        odb[obase] = idb[ibase]; 
        odb[obase+1] = idb[ibase+1]; 
        odb[obase+2] = idb[ibase+2]; 
        return vec;
    }

    setTempPoolSize(newSize) {
        this.tempSize = newSize
        this.tempBuffer = new Float64Array(newSize*3);
        this.tempPool = [];
        for(let i=0; i<this.tempSize; i++) {
            const vec = new Vec3(0,0,0, this.tempBuffer);
            vec.amFree = true;
            vec.baseIdx = i*3;
            this.tempPool.push(vec.release());
        }
    }

    finalize() {
        if(this.reclaimedPool.length > 0) {
            this.persistentPool = this.inProgressPool;
            this.inProgressPool = [];   
            this.isFinalized = true;         
            return;
        }
        const prevBuffer = this.persistentBuffer;
        this.persistentBuffer = new Float64Array(this.inProgressPool.length * 3);
        const persistentBuffer = this.persistentBuffer;
        for (let i = 0; i < this.inProgressPool.length; i++) {
            const baseIdx = i*3;
            const vec = this.inProgressPool[i];
            const vx = vec.x, vy = vec.y, vz = vec.z;
            persistentBuffer[baseIdx] = vx;
            persistentBuffer[baseIdx+1] = vy;
            persistentBuffer[baseIdx+2] = vz;
            vec.dataBuffer = persistentBuffer;
            vec.baseIdx = baseIdx;
        }

        this.persistentPool = this.inProgressPool;
        this.inProgressPool = [];
        console.log("REMAINING: " +this.reclaimedPool);
        this.isFinalized = true;
        this.lru = -1;
    }

    /**
     * Let the VectorPool know that you're done with all of the temporary vectors you've been using so it doesn't need to yell at you.
     */
    releaseAll() {
        this.lru = -1;
        this.assumeFree = true;
    }

    new_Vec3(x=0, y=0, z=0) {
        return this.acquire(x, y, z);
    }

    any_Vec3(x=0, y=0, z=0) {
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
}

window.globalVecPool = new Vec3Pool(1000);

/**
 * ephemeral vector from components
 * @param {Number} x,
 * @param {Number} y,
 * @param {Number} z,
 * @returns {Vec3} an ephemeral vector from the default pool, or creates a new one if there is no pool
 */
export function any_Vec3(x=0, y=0, z=0) {
    return globalVecPool.temp_acquire(x, y, z);
}

/**
 * ephemeral vector from another vector
 * @param {Vec3} x
 * @returns {Vec3} an ephemeral vector from the default pool, or creates a new one if there is no pool
 */
export function any_Vec3fv(v) {
    return globalVecPool.temp_acquirefv(v);
}

export class NoPool {
    
    new_Vec3(x=0, y=0, z=0) {
        return new Vec3(x, y, z);
    }
    any_Vec3(x=0, y=0, z=0) {
        return new Vec3(x, y, z); 
    }

    new_Vec3fv(v) {
        return new Vec3(v.x, v.y, v.z); 
    }

    any_Vec3fv(v) {
        return new Vec3(v.x, v.y, v.z); 
    }
    releaseAll() {
        
    }
}


window.noPool = new NoPool();