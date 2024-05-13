const THREE = await import('three');

/** threejs vectors that will notify you of what's going on*/
export class notVector3 extends THREE.Vector3 {
    onchangeCallback = undefined;
    constructor(x = 0, y = 0, z = 0) {
        super(x,y,z);
        //this.onchangeCallback = () => {};
    }
    setOnChange(callback) {
        //if(callback == null) this.onchangeCallback = () => {};
        this.onchangeCallback = callback;
    }

    onChange() {
        if(this.onchangeCallback === undefined) return;
        this.onchangeCallback(this._x, this._y, this._z);
    }
    get x() {return this._x;}
    set x(val) {
        this._x = val;
        this.onChange();
    }
    get y() {return this._y;}
    set y(val) {
        this._y = val;
        this.onChange();
    }

    get z() {return this._z;}
    set z(val) {
        this._z = val;
        this.onChange();
    }
}