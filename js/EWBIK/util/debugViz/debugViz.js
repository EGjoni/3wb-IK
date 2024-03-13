import { any_Vec3 } from "../vecs.js";
import { TargetState } from "../../solver/SkeletonState.js";
import {
    Object3D,
    Line, Float32BufferAttribute,
    BufferGeometry,
    LineBasicMaterial,
    Color
} from "three";

export class MovementLine extends Line {
    constructor(previousPosition, newPosition, newColor, oldColor) {

        oldColor = oldColor ?? { r: newColor.r / 2, g: newColor.g / 2, b: newColor.b / 2 }
        const positions = [
            previousPosition.x, previousPosition.y, previousPosition.z,
            newPosition.x, newPosition.y, newPosition.z,
        ];
        const colors = [
            oldColor.r, oldColor.g, oldColor.b, // Darker version of the new color for the previous position
            newColor.r, newColor.g, newColor.b,
        ];

        const geometry = new BufferGeometry();
        geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));

        const material = new LineBasicMaterial({ vertexColors: true });

        super(geometry, material);
        this.headColor = newColor;
        this.tailColor = oldColor;
    }

    modify(newPosition, newColor, oldColor = { r: this.headColor.r / 2, g: this.headColor.g / 2, b: this.headColor.b / 2 }) {
        this.headColor = newColor ?? this.headColor;
        const positionAttribute = this.geometry.getAttribute('position');
        const positions = positionAttribute.array;

        positions[0] = positions[3];
        positions[1] = positions[4];
        positions[2] = positions[5];
        positions[3] = newPosition.x;
        positions[4] = newPosition.y;
        positions[5] = newPosition.z;
        positionAttribute.needsUpdate = true;

        const colorAttribute = this.geometry.getAttribute('color');
        const colors = colorAttribute.array;
        colors[0] = oldColor.r;
        colors[1] = oldColor.g;
        colors[2] = oldColor.b;
        colors[3] = this.headColor.r;
        colors[4] = this.headColor.g;
        colors[5] = this.headColor.b;
        colorAttribute.needsUpdate = true;

        this.currentPosition = newPosition;
    }
}

export class RayDrawer {
    constructor(source, scene, acquirefunc, updatefunc) {
        this.raysgeo = [];
        this.source = source;
        this.acquirefunc = acquirefunc;
        this.updatefunc = updatefunc;
        this.scene = scene;
    }
    makeLine(startPoint, endPoint, color) {
        const geometry = new BufferGeometry().setFromPoints([startPoint, endPoint]);
        const material = new LineBasicMaterial({ color: color });
        const line = new Line(geometry, material);
        this.scene.add(line);
        line.layers.set(boneLayer);
        return line;
    }
    die() {
        for (let rg of this.raysgeo) {
            rg.visible = false;
            //rg.geometry.dispose();
            //rg.material.dispose();
        }
        //this.raysgeo = [];
    }
    draw(...colors) {

        let results = this.acquirefunc(this);
        for (let i = this.raysgeo.length - 1; i >= results.length; i--) {
            this.scene.remove(this.raysgeo[i]);
            this.raysgeo[i].geometry.dispose();
            this.raysgeo[i].material.dispose();
            this.raysgeo.pop();
        }
        let i = 0;
        while (i < results.length) {
            let color = colors[i % (colors.length - 1)];
            let rg = this.makeLine(any_Vec3(), results[i], color);
            rg.correspondsTo = results[i];
            this.raysgeo.push(rg);
            i++;
        }
        i = 0;
        console.log('----');
        for (let rg of this.raysgeo) {
            rg.visible = true;
            let newpoints = this.updatefunc(rg, this);
            let newStartPoint = newpoints[0];
            let newEndPoint = newpoints[1];
            console.log(`drawingY[${i}]: ${newStartPoint.y.toFixed(3)} -> ${newEndPoint.y.toFixed(3)}`);
            const positions = rg.geometry.attributes.position;
            positions.array[0] = newStartPoint.x;
            positions.array[1] = newStartPoint.y;
            positions.array[2] = newStartPoint.z;

            positions.array[3] = newEndPoint.x;
            positions.array[4] = newEndPoint.y;
            positions.array[5] = newEndPoint.z;

            positions.needsUpdate = true;
            i++;
        }
    }
}

/**
 * all rotlines in a chain
 */
export class ChainRots extends Object3D {
    static activeChainRot = null;
    chain = null;
    wbMap = new Map(); //maps working bones to rots
    constructor(forChain) {
        super();
        this.chain = forChain;
        this.chain.rottrack = this;
        for (let wb of this.chain.solvableStrandBones) {
            wb.rotDraw = new BoneRots(wb);
            this.wbMap[wb] = wb.rotDraw;
            this.add(wb.rotDraw);
        };
    }

    /**adds this chain to the given Object3d, and removes any other chain in the scene*/
    makeVisible(newPar) {
        if (ChainRots.activeChainRot != this && ChainRots.activeChainRot != null) {
            ChainRots.activeChainRot.parent.remove(ChainRots.activeChainRot);
        } else if (ChainRots.activeChainRot == null) {
            newPar.add(this);
        }
        if (ChainRots.activeChainRot == this) {
            this.visible = true;
        }
    }
}


export class BoneRots extends Object3D {
    static activeBoneRot = null;
    static OrigCol = new Color('white');
    static XPlusCol = new Color(1, 0, 0);//red
    static YPlusCol = new Color(0, 1, 0);//green
    static ZPlusCol = new Color(0.2, 0.2, 1);//blue

    static XNegCol = new Color(1, 0, 1);//magenta
    static YNegCol = new Color(0.8, 0.8, 0);//yellow
    static ZNegCol = new Color(0, 0.8, 0.8);//cyan
    wb = null;
    rotLines = [];
    constructor(workingbone) {
        super();
        this.wb = workingbone;
        this.chain = this.wb.chain;
        this.wb.rotDraw = this;
        let hdx = 0;
        this.ensure(this.chain.pinnedBones.length);
        
        for (let rl of this.rotLines) {
            this.add(rl);
            rl.layers.set(window.boneLayer);
        }
    }

    ensure(vecs) {
        let hdx = 0;
        let hdx_ = this.rotLines.length;
        for (let j = this.rotLines.length - 1; j >= vecs.length; j--) {
            this.remove(this.rotLines[j]);
            this.rotLines[j].geometry.dispose();
            this.rotLines[j].material.dispose();
            this.rotLines.pop();
            hdx_ = j;
        }
        let i = 0;
        while (hdx < vecs.length) {
            const sb = this.chain.pinnedBones[i];
            this.rotLines.push(new MovementLine(any_Vec3(), any_Vec3(), BoneRots.OrigCol));
            const modeCode = sb.targetState.getModeCode();
            hdx++;
            if ((modeCode & TargetState.XDir) != 0) {
                if(hdx > hdx_) {
                    this.rotLines.push(new MovementLine(any_Vec3(), any_Vec3(), BoneRots.XPlusCol));
                    this.rotLines.push(new MovementLine(any_Vec3(), any_Vec3(), BoneRots.XNegCol));
                }
                hdx += 2;
            }
            if ((modeCode & TargetState.YDir) != 0) {
                if(hdx > hdx_) {
                    this.rotLines.push(new MovementLine(any_Vec3(), any_Vec3(), BoneRots.YPlusCol));
                    this.rotLines.push(new MovementLine(any_Vec3(), any_Vec3(), BoneRots.YNegCol));
                }
                hdx += 2;
            }
            if ((modeCode & TargetState.ZDir) != 0) {
                if(hdx > hdx_) {
                    this.rotLines.push(new MovementLine(any_Vec3(), any_Vec3(), BoneRots.ZPlusCol));
                    this.rotLines.push(new MovementLine(any_Vec3(), any_Vec3(), BoneRots.ZNegCol));
                }
                hdx += 2;
            }
            i++;
        }
    }

    makeVisible() {
        if (BoneRots.activeBoneRot != this && BoneRots.activeBoneRot != null) {
            BoneRots.activeBoneRot.visible = false;
        }
        this.wb.chain.rottrack.makeVisible(this.wb.forBone.directRef.parentArmature.armatureObj3d)
        BoneRots.activeBoneRot = this;
        this.visible = true;
    }

    set visible(val) {
        if(this.rotLines) {
            for(let rl of this?.rotLines) {
                rl.visible = val;
            }
        }
    }

    update(updatefunc = (v) => { return v }) {
        this.ensure(this.chain.boneCenteredTipHeadings);
        let headings = this.chain.boneCenteredTipHeadings;
        for (let i = 0; i < headings.length; i++) {
            this.rotLines[i].modify(updatefunc(headings[i], this.wb));
        }
    }
}