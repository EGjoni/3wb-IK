
/**untyped vec3, use for any frequent instantiatons, as its faster to create than floatbuffer*/

export class Vec3 {
    baseIdx = 0;
    dataBuffer = [0, 0, 0];
    dims = 3;
    constructor(x=0, y=0, z=0) {
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

    /**takes this this.cross input and returns the result as a new vector*/
    crossCopy(input) {
        let newVec = this.copy();
        newVec.setComponents(
            this.y * input.z - this.z * input.y,
            this.z * input.x - this.x * input.z,
            this.x * input.y - this.y * input.x
        );
        return newVec;
    }

    copy() {
        return new_Vec3(this.x, this.y, this.z);
    }

    toString() {
        return '('+this.x.toFixed(4)+', '+this.y.toFixed(4)+', '+this.z.toFixed(4)+', )';
    }
    toConsole() {
        console.log(this.toString());
    }

    getOrthogonal() {
        const { x, y, z } = this;
        let result = this.copy();
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
        return this.setComponents(vec.x, vec.y, vec.z);
    }

    setComponents(...components) {
        if (components.length == this.dims) {
            for (let i = 0; i < components.length; i++) {
                this.dataBuffer[this.baseIdx+i] = components[i];
            }
        }
        return this;
    }

    /** writes thes components of this vector into the given array. If no aray is given, one will be created and returned**/
    intoArray(into = new Array(this.dims)) {
        for (let i = 0; i < this.dims; i++) {
            into[i] = this.dataBuffer[this.baseIdx+i];
        }
        return into;
    }

    static extractInputComponents(vec) {
        if (vec instanceof Vec3) return vec.components;
        else if (Array.isArray(vec)) return vec;
        else throw Error('Unsupported vector format');
    }

    mag() {
        let sumSq = 0;
        for (let i = 0; i < this.dims; i++) {
            let diff = this.dataBuffer[this.baseIdx+i];
            sumSq += diff * diff;
        }
        return Math.sqrt(sumSq);
    }

    magSq() {
        let sumSq = 0;
        for (let i = 0; i < this.dims; i++) {
            let diff = this.dataBuffer[this.baseIdx+i];
            sumSq += diff * diff;
        }
        return sumSq;
    }


    mulAdd(vec, scalar) {
        for (let i = 0; i < vec.dims; i++) {
            this.dataBuffer[this.baseIdx+i] += vec.dataBuffer[vec.baseIdx+i] * scalar;
        }
    }

    limit(limit) {
        const magnitude = this.mag();
        if (magnitude > limit) {
            this.mult(limit / magnitude);
        }
        return this;
    }

    limitSq(limitSq) {
        const magnitudeSq = this.magSq();
        if (magnitudeSq > limitSq) {
            this.mult(Math.sqrt(limitSq / magnitudeSq));
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
            this.mult(Math.sqrt(lengthSq / magnitudeSq));
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
        const maxLength = Math.max(this.dims, v.dims);
        let sum = 0;
        for (let i = 0; i < maxLength; i++) {
            sum += this.dataBuffer[this.baseIdx+i] * v.dataBuffer[v.baseIdx+i];
        }
        return sum;
    }

    div(n) {
        for (let i = 0; i < this.dims; i++) {
            this.dataBuffer[this.baseIdx+i] /= n;
        }
        return this;
    }

    divCopy(scalar) {
        let result = this.copy();
        result.div(scalar);
        return result;
    }

    mult(scalar) {
        for (let i = 0; i < this.dims; i++) {
            this.dataBuffer[this.baseIdx+i] *= scalar;
        }
        return this;
    }

    multCopy(scalar) {
        let result = this.copy();
        result.mult(scalar);
        return result;
    }

    dist(v) {
        let sumSq = 0;
        for (let i = 0; i < this.dims; i++) {
            let diff = this.dataBuffer[this.baseIdx+i] - v.dataBuffer[v.baseIdx+i];
            sumSq += diff * diff;
        }
        return Math.sqrt(sumSq);
    }

    distSq(v) {
        let sumSq = 0;
        for (let i = 0; i < this.dims; i++) {
            let diff = this.dataBuffer[this.baseIdx+i] - v.dataBuffer[v.baseIdx+i];
            sumSq += diff * diff;
        }
        return sumSq;
    }

    lerp(target, alpha) {
        for (let i = 0; i < this.dims; i++) {
            this.dataBuffer[this.baseIdx+i] += (target.dataBuffer[target.baseIdx+i] - this.dataBuffer[this.baseIdx+i]) * alpha;
        }
        return this;
    }


    add(v) {
        this.x += v.x;
        this.y += v.y;
        this.z += v.z;
        return this;
    }

    addCopy(v) {
        let result = this.copy();
        result.add(v);
        return result;
    }

    sub(v) {
        this.x -= v.x;
        this.y -= v.y;
        this.z -= v.z;
        return this;
    }

    subCopy(v) {
        let result = this.copy();
        result.sub(v);
        return result;
    }

    normalize() {
        const magnitude = this.mag();
        if (magnitude !== 0) {
            this.div(magnitude);
        }
        return this;
    }

    extractInputComponents(vec) {
        if (vec instanceof Vec3) return vec.components;
        else if (Array.isArray(vec)) return vec;
        else throw Error('Unsupported vector format');
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


export class Vec3Pool {
    static persistentPool = [];
    static reclaimedPool = []; //stores vecs that were previously
    static inProgressPool = [];
    static persistentBuffer;
    static tempSize = 10000;
    static tempPool = null;// new Array(this.tempSize);
    static tempBuffer; //= new Float64Array(tempSize * 3);
    static isFinalized = false;
    static lru = -1;

    static reclaim() {
        Vec3Pool.isFinalized = false;  
        Vec3Pool.lru = -1;
        if(Vec3Pool.persistentPool?.length > 0) {
            Vec3Pool.reclaimedPool.push(...Vec3Pool.persistentPool);
            Vec3Pool.inProgressPool = [];
            Vec3Pool.persistentPool = [];
        }
        Vec3Pool.releaseAll();
        console.log("RECLAIMED: " + Vec3Pool.reclaimedPool.length);
    }

    static init() {
        Vec3Pool.setTempPoolSize(Vec3Pool.tempSize);
    }
    static acquire(x = 0, y = 0, z = 0) {
        if(Vec3Pool.tempPool == null) Vec3Pool.init();
        if (Vec3Pool.isFinalized) {
            let isFree = false;
            let vec;
            //let attempts =0;
            //while(!isFree && attempts < Vec3Pool.tempPool.length) {
                /*if(Vec3Pool.lru >= Vec3Pool.length) { 
                    if(Vec3Pool.assumeFree) {
                        Vec3Pool.assumeFree = false;
                        //attempts = 0;
                    } else if(attempts >= Vec3Pool.tempPool.length) {
                        console.warn(`
                        ran out of vectors after ${attempts} attempts! Make sure you release any you're not using! You should either
                        1. call releaseAll when you're at a point in your logic where you're sure any vectors you didn't call .finalize() for are free, or o
                        2. increase the tempPool size or
                        3. manually call .release() on more vectors after you finish using them
                        `)
                    }
                }*/
                Vec3Pool.lru = (Vec3Pool.lru + 1) % Vec3Pool.tempPool.length;
                vec = Vec3Pool.tempPool[Vec3Pool.lru];
                //isFree = vec.amFree || Vec3Pool.assumeFree
                //vec.amFree = false;
                //attempts++;
            /*}
            if(attempts > 10) {
                console.log("attempted : "+attempts+" before finding " +Vec3Pool.lru);
            }*/
            vec.x = x; vec.y =y; vec.z = z;
            //console.log("temp: "+Vec3Pool.lru);
            return vec;
        } else {
            let newV;
            if(Vec3Pool.reclaimedPool.length > 0) {
                newV = Vec3Pool.reclaimedPool.pop();
                newV.x = x; newV.y =y; newV.z = z;
                Vec3Pool.inProgressPool.push(newV);
            } else {
                newV = new Vec3(x, y, z);
                Vec3Pool.inProgressPool.push(newV);
            }
            return newV;
        }
    }


    static temp_acquire(x=0, y=0, z=0) {
        if(Vec3Pool.tempPool == null) Vec3Pool.init();
            //let isFree = false;
            //let vec = null;
            //let attempts = 0;
            /*while(!isFree && attempts < 10) {//Vec3Pool.tempPool.length) {
                if(Vec3Pool.lru >= Vec3Pool.tempPool.length) { 
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
                Vec3Pool.lru = (Vec3Pool.lru + 1) % Vec3Pool.tempPool.length;
                const vec = Vec3Pool.tempPool[Vec3Pool.lru];
                //isFree = vec.amFree;
                //attempts++
            //}
            /*if(attempts > 10) {
                console.log("attempted : "+attempts+"TEMP before finding " +Vec3Pool.lru);
            }
            vec.amFree = true; // since the user indicated that they will be discarding this anyway*/
            vec.x = x; vec.y =y; vec.z = z;
            return vec;
    }

    static setTempPoolSize(newSize) {
        Vec3Pool.tempSize = newSize
        Vec3Pool.tempBuffer = new Float64Array(newSize*3);
        Vec3Pool.tempPool = [];
        for(let i=0; i<Vec3Pool.tempSize; i++) {
            const vec = new Vec3();
            vec.amFree = true;
            vec.dataBuffer = Vec3Pool.tempBuffer;
            vec.baseIdx = i*3;
            Vec3Pool.tempPool.push(vec.release());
        }
    }

    static finalize() {
        if(Vec3Pool.reclaimedPool.length > 0) {
            Vec3Pool.persistentPool = Vec3Pool.inProgressPool;
            Vec3Pool.inProgressPool = [];   
            Vec3Pool.isFinalized = true;         
            return;
        }
        const prevBuffer = Vec3Pool.persistentBuffer;
        Vec3Pool.persistentBuffer = new Float64Array(Vec3Pool.inProgressPool.length * 3);
        const persistentBuffer = Vec3Pool.persistentBuffer;
        for (let i = 0; i < Vec3Pool.inProgressPool.length; i++) {
            const baseIdx = i*3;
            const vec = Vec3Pool.inProgressPool[i];
            const vx = vec.x, vy = vec.y, vz = vec.z;
            persistentBuffer[baseIdx] = vx;
            persistentBuffer[baseIdx+1] = vy;
            persistentBuffer[baseIdx+2] = vz;
            vec.dataBuffer = persistentBuffer;
            vec.baseIdx = baseIdx;
        }

        Vec3Pool.persistentPool = Vec3Pool.inProgressPool;
        Vec3Pool.inProgressPool = [];
        console.log("REMAINING: " +Vec3Pool.reclaimedPool);
        Vec3Pool.isFinalized = true;
        Vec3Pool.lru = -1;
    }

    /**
     * Let the VectorPool know that you're done with all of the temporary vectors you've been using so it doesn't need to yell at you.
     */
    static releaseAll() {
        Vec3Pool.lru = -1;
        Vec3Pool.assumeFree = true;
    }

}


/**
 * create a pooled Vec3 object. Any calls to this function prior to calling Vec3Pool.finalize() will instantiate a new Vec3. Any calls to it after
 * will recycle an existing Vec3 from the temporary Vec3 pool (which is distinct from the finalized pool).
 * @param {Number} x 
 * @param {Number} y 
 * @param {Number} z 
 * @returns {Vec3} a potentially pool.
 */
export function new_Vec3(x=0, y=0, z=0) {
    return Vec3Pool.acquire(x, y, z);
}


/**
 * claim a pooled temporary Vec3 object. Will always recycle from the temp pool.
 * @param {Number} x 
 * @param {Number} y 
 * @param {Number} z 
 * @returns {Vec3} a potentially pool.
 */
export function any_Vec3(x=0, y=0, z=0) {
    return Vec3Pool.temp_acquire(x, y, z);
}
