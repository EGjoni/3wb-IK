
import { Vec3, any_Vec3} from "./vecs.js";

export class Ray {
    
    constructor(p1, p2, pool = noPool) {
        this.pool = pool;
        this.workingVector = this.pool.new_Vec3();
        this.p1 = this.pool.new_Vec3();
        this.p2 = this.pool.new_Vec3();
        this.setP1(p1);
        this.setP2(p2);
    }

    static asFloat(p1, p2) {
        return new Rayf(p1, p2); 
    }

    static asDouble(p1, p2) {
        return new Rayd(p1, p2);
    }

    static get X() {
        return 0;
    }
    static get Y() {
        return 1;
    }
    static get Z() {
        return 2;
    }
    
    alignTo(target) {
        this.p1.set(target.p1);
        this.p2.set(target.p2);
    }

    heading() {
        return this.setToHeading(this.workingVector);
    }

    setHeading(setTo) {
        if (!this.p2) {
            if (!this.p1) this.p1 = this.pool.new_Vec3();
            this.p2 = this.p1.clone();
        }
        this.workingVector.set(setTo);
        this.workingVector.add(this.p1);
        this.p2.set(this.workingVector);
        return this;
    }

    /**sets the provided vector to have the same magnitude and direction as this ray 
     * @param {Vec3} storeIn
     * @return {Vec3} the input vector after updating its values
    */
    setToHeading(storeIn = this.workingVector) {
        storeIn.set(this.p2);
        storeIn.sub(this.p1);
        return storeIn;
    }

    /**sets the provided array (starting at the provided index to the components of a vector with the same magnitude and direction 
     * as the heading of this ray
     * @param {Array} storeIn
     * @param {Number} baseX the index to start iterating through the array from
     * @return {Array} the input array after updating its values
    */
    setToHeadingArr(storeIn, baseX) {
        const baseY = baseX+1;
        const baseZ = baseX+2;
        storeIn[baseX] = this.p2.x - this.p1.x;
        storeIn[baseY] = this.p2.y - this.p1.y;
        storeIn[baseZ] = this.p2.z - this.p1.z;
        return storeIn;
    }
    origin() {
        return this.p1.clone();
    }
    mag() {
        return this.heading().mag();
    }
    mag(newMag) {
        let dir = this.heading();
        dir.setMag(newMag);
        this.setHeading(dir);
    }
    scaledProjection(input) {
        this.workingVector.set(input);
        let heading = this.heading();
        let headingMag = heading.mag();
        let workingVectorMag = this.workingVector.mag();

        if (workingVectorMag === 0 || headingMag === 0) return 0;

        return (this.workingVector.dot(heading) / (headingMag * workingVectorMag)) * (workingVectorMag / headingMag);
    }
    div(divisor) {
        this.p2.sub(this.p1);
        this.p2.div(divisor);
        this.p2.add(this.p1);
    }
    mult(scalar) {
        this.p2.sub(this.p1);
        this.p2.mult(scalar);
        this.p2.add(this.p1);
    }
    getMultipledBy(scalar) {
        let result = this.heading();
        result.mult(scalar);
        result.add(this.p1);
        return result;
    }
    getDivideddBy(divisor) {
        let result = this.heading().clone();
        result.mult(divisor);
        result.add(this.p1);
        return result;
    }
    getScaledTo(scale) {
        let result = this.heading().clone();
        result.normalize();
        result.mult(scale);
        result.add(this.p1);
        return result;
    }
    elongate(amt) {
        this.workingVector.set(this.p2);
        this.p1.lerp(this.p2, -0.5*amt);
        this.p2.lerp(this.workingVector, -0.5*amt);
        /*let midPoint = this.p1.add(this.p2).mult(0.5);
        let p1Heading = this.p1.sub(midPoint);
        let p2Heading = this.p2.sub(midPoint);
        let p1Add = p1Heading.clone().normalize().mult(amt);
        let p2Add = p2Heading.clone().normalize().mult(amt);
        this.p1.set(p1Heading.add(p1Add).add(midPoint));
        this.p2.set(p2Heading.add(p2Add).add(midPoint));*/
    }
    
    reverse() {
        let temp = this.p1;
        this.p1 = this.p2;
        this.p2 = temp;
    }
    
    pointWith(r) {
        if (this.heading().dot(r.heading()) < 0) this.reverse();
    }
    pointWith(heading) {
        if (this.heading().dot(heading) < 0) this.reverse();
    }
    getRayScaledBy(scalar) {
        return new Ray(this.p1, this.getMultipledBy(scalar));
    }
    /**sets the provided value to what p2 of this ray would be if the ray's heading were scaled by the given amount
     * @param {Number} scaleBy 
     * @param {Array} storeIn
     */
    setToScaledP2(scaleBy, storeIn) {
        let {x, y, z} = this.p2;
        const x1 = this.p1.x, y1 = this.p1.y, z1 = this.p1.z; 
        x-=x1; y-=y1; z-=z1;
        x*=scaleBy; y*=scaleBy; z*=scaleBy;
        x+=x1; y+=y1; z+=z1;
        storeIn.x = x; storeIn.y=y; storeIn.z=z;
        return storeIn;
    }

    scaleBy(scaleBy) {
        let {x, y, z} = this.p2;
        const x1 = this.p1.x, y1 = this.p1.y, z1 = this.p1.z; 
        x-=x1; y-=y1; z-=z1;
        x*=scaleBy; y*=scaleBy; z*=scaleBy;
        x+=x1; y+=y1; z+=z1;
        this.p2.setComponents(x,y,z);
    }

    setToInvertedTip(vec) {
        const p1x = this.p1.x, p1y = this.p1.y, p1z = this.p1.z;
        const p2x = this.p2.x, p2y = this.p2.y, p2z = this.p2.z;
        vec.x = (p1x - p2x) + p1x;
        vec.y = (p1y - p2y) + p1y;
        vec.z = (p1z - p2z) + p1z;
        return vec;
    }
    contractTo(percent) {
        let halfPercent = 1 - ((1 - percent) / 2);
        this.p1.lerp(this.p2, halfPercent);
        this.p2.lerp(this.p1, halfPercent);
    }
    translateTo(newLocation) {
        this.workingVector.set(this.p2);
        this.workingVector.sub(this.p1);
        this.workingVector.add(newLocation);
        this.p2.set(this.workingVector);
        this.p1.set(newLocation);
    }
    translateTipTo(newLocation) {
        this.workingVector.set(newLocation);
        let transBy = this.workingVector.sub(this.p2);
        this.translateBy(transBy);
    }
    translateBy(toAdd) {
        this.p1.add(toAdd);
        this.p2.add(toAdd);
    }
    normalize() {
        this.mag(1);
    }
    set(r) {
        this.p1.set(r.p1);
        this.p2.set(r.p2);
    }

    setP2(p2) {
        this.p2.x = p2.x;
        this.p2.y = p2.y;
        this.p2.z = p2.z;
        this.p2.type = p2.type;
    }
    
    setP1(p1) {
        this.p1.x = p1.x;
        this.p1.y = p1.y;
        this.p1.z = p1.z;
        this.p1.type = p1.type;
    }

    /**stores the backing vectors of this ray into the provided VectorNArray */
    virtualize(vectorNArray) {
        this.p1 = vectorNArray.push1(this.p1);
        this.p2 = vectorNArray.push1(this.p2);
    }

    clone() {
        return new Ray(this.p1, this.p2);
    }

    release() {
        this.p1.release();
        this.p2.release();
        this.workingVector.release();
    }
}

export class Rayd extends Ray { 
   
    constructor(p1, p2) {
        this.workingVector = new Vec3d(p1 != null ? [p1.x, p1.y, p1.z] : [0,0,0]);
        this.p1 = new Vec3d(p1 != null ? [p1.x, p1.y, p1.z] : [0,0,0]);
        this.p2 = new Vec3d(p2 != null ?[p2.x, p2.y, p2.z] : [this.p1.x, this.p1.y, this.p1.z]);
    }
    
    getReversed() {
        return new Rayd(this.p2, this.p1);
    }
    getRayScaledTo(scale) {
        return new Rayd(this.p1, this.getScaledTo(scale));
    }
    clone() {
        return new Rayd(this.p1, this.p2);
    }
}

export class Rayf extends Ray { 
    constructor(p1, p2) {
        this.workingVector = new Vec3f(p1 != null ? [p1.x, p1.y, p1.z] : [0,0,0]);
        this.p1 = new Vec3f(p1 != null ? [p1.x, p1.y, p1.z] : [0,0,0]);
        this.p2 = new Vec3f(p2 != null ?[p2.x, p2.y, p2.z] : [this.p1.x, this.p1.y, this.p1.z]);
    }
    getReversed() {
        return new Rayf(this.p2, this.p1);
    }
    getRayScaledTo(scale) {
        return new Rayf(this.p1, this.getScaledTo(scale));
    }
    clone() {
        return new Rayf(this.p1, this.p2);
    }
}
