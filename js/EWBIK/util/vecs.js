
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
        return new Vec3(this.x, this.y, this.z);
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

    /**swap the values of these variables */
    static swap(v1, v2) {        
        v1.components[v1.baseIdx] = v1.components[v1.baseIdx] ^ v2.components[v2.baseIdx];
        v2.components[v2.baseIdx] = v1.components[v1.baseIdx] ^ v2.components[v2.baseIdx];
        v1.components[v1.baseIdx] = v1.components[v1.baseIdx] ^ v2.components[v2.baseIdx];

        v1.components[v1.baseIdx+1] = v1.components[v1.baseIdx+1] ^ v2.components[v2.baseIdx+1];
        v2.components[v2.baseIdx+1] = v1.components[v1.baseIdx+1] ^ v2.components[v2.baseIdx+1];
        v1.components[v1.baseIdx+1] = v1.components[v1.baseIdx+1] ^ v2.components[v2.baseIdx+1];

        v1.components[v1.baseIdx+2] = v1.components[v1.baseIdx+2] ^ v2.components[v2.baseIdx+2];
        v2.components[v2.baseIdx+2] = v1.components[v1.baseIdx+2] ^ v2.components[v2.baseIdx+2];
        v1.components[v1.baseIdx+2] = v1.components[v1.baseIdx+2] ^ v2.components[v2.baseIdx+2];
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

    
    acquire(x = 0, y = 0, z = 0) {
        if(this.tempPool == null) 
            this.setTempPoolSize(this.tempSize);
        if (this.isFinalized) {
            let isFree = false;
            let vec;
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
                vec = this.tempPool[this.lru];
                //isFree = vec.amFree || this.assumeFree
                //vec.amFree = false;
                //attempts++;
            /*}
            if(attempts > 10) {
                console.log("attempted : "+attempts+" before finding " +this.lru);
            }*/
            vec.x = x; vec.y =y; vec.z = z;
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
        let vec = this.tempPool[this.lru];
                //isFree = vec.amFree;
                //attempts++
            //}
            /*if(attempts > 10) {
                console.log("attempted : "+attempts+"TEMP before finding " +this.lru);
            }
            vec.amFree = true; // since the user indicated that they will be discarding this anyway*/
        vec.x = x; vec.y =y; vec.z = z;
        return vec;
    }

    setTempPoolSize(newSize) {
        this.tempSize = newSize
        this.tempBuffer = new Float64Array(newSize*3);
        this.tempPool = [];
        for(let i=0; i<this.tempSize; i++) {
            const vec = new Vec3();
            vec.amFree = true;
            vec.dataBuffer = this.tempBuffer;
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
}

window.globalVecPool = new Vec3Pool(1000);

export function any_Vec3(x=0, y=0, z=0) {
    return globalVecPool.temp_acquire(x, y, z);
}

export class NoPool {
    new_Vec3(x=0, y=0, z=0) {
        return new Vec3(x, y, z);
    }
    any_Vec3(x=0, y=0, z=0) {
        return new Vec3(x, y, z); 
    }
    releaseAll() {
        
    }
}


window.noPool = new NoPool();