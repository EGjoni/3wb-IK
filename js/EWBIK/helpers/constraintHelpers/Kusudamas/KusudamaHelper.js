import * as THREE from 'three';

const { Constraint, Kusudama, LimitingReturnful } = await import("../../../betterbones/Constraints/ConstraintStack.js");
import { kusudamaFragShader, kusudamaVertShader } from './shaders.js';
import { ConstraintHelper } from '../ConstraintHelper.js';


export class KusudamaHelper extends ConstraintHelper {

    static vertShade = kusudamaVertShader;
    static fragShade = kusudamaFragShader;
    static baseShellColor = new THREE.Vector4(0.4, 0, 0.4, 1.0);
    static violationColor = new THREE.Vector4(1, 0, 0, 1);
    static desireGeo = new THREE.BoxGeometry(0.15, 0.15, 0.15);
    static desiredMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('blue') });

    /**@type {Kusudama} */
    forKusudama = null;
    forBone = null;
    coneSeq = [];
    constructor(forKusudama, visibilityCondition) {
        super(forKusudama, visibilityCondition);
        this.forKusudama = forKusudama;
        this.forBone = forKusudama.forBone;
        this.geometry = new THREE.SphereGeometry(.75, 32, 32);
        this.desiredTracer = new THREE.Mesh(KusudamaHelper.desireGeo, KusudamaHelper.desiredMat);
        this.desiredTracer.visible = true;
        this.desiredTracer.scale.set(this.forBone.height / 8, this.forBone.height / 8, this.forBone.height / 8);

        for (let i = 0; i < 120; i++) { this.coneSeq.push(new THREE.Vector4()); }

        this.coneSeqMaterial = new THREE.ShaderMaterial({
            vertexShader: KusudamaHelper.vertShade,
            fragmentShader: KusudamaHelper.fragShade, // Your fragment shader code here
            transparent: false,
            blending: THREE.NormalBlending,
            side: THREE.DoubleSide,
            uniforms: {
                shellColor: { value: KusudamaHelper.baseShellColor },
                vertLightDir: { value: new THREE.Vector3(0, 0, 1) },
                coneSequence: { value: this.coneSeq },
                coneCount: { value: 1 },
                multiPass: { value: true },
                frame: { value: 0 },
                screensize: { value: new THREE.Vector2(1920, 1080) }
            },
        });
        this.coneSeqMaterial.oldOnBFR = this.coneSeqMaterial.onBeforeRender;
        this.coneSeqMaterial.onBeforeRender = function (renderer, scene, camera, geometry, mesh, ...others) {
            this.uniforms.frame.value = renderer.info.render.frame;
            this.uniforms.screensize.value.x = renderer.domElement.width;
            this.uniforms.screensize.value.y = renderer.domElement.height;
            if (this.oldOnBFR != null)
                this.oldOnBFR(renderer, scene, camera, geometry, mesh, ...others);
        }
        this.shell = new THREE.Mesh(this.geometry, this.coneSeqMaterial);
        this.add(this.shell);
        this.shell.add(this.desiredTracer);
    }


    inBoundsDisplay = [1.0];

    regenDisplay(constraint) {
        if(super.regenDisplay(constraint) == null) return null;
        this.shell.quaternion.set(0, 0, 0, 1);
        //this.shell.position.set(this.forBone.position.x, this.forBone.position.y, this.forBone.position.z);
        let i = 0;
        for (let lc of this.forKusudama.limitCones) {
            let cp = lc.controlPoint.normalize();
            let tc1 = lc.tangentCircleCenterNext1.normalize();
            let tc2 = lc.tangentCircleCenterNext2.normalize();
            this.shell.material.uniforms.coneSequence.value[i].set(cp.x, cp.y, cp.z, lc.radius);
            this.shell.material.uniforms.coneSequence.value[i + 1].set(tc1.x, tc1.y, tc1.z, lc.tangentCircleRadiusNext);
            this.shell.material.uniforms.coneSequence.value[i + 2].set(tc2.x, tc2.y, tc2.z, lc.tangentCircleRadiusNext);
            i += 3;
        }
        this.shell.material.uniforms.coneCount.value = this.forKusudama.limitCones.length;
        this.scale.set(1, 1, 1);
        this.scale.multiplyScalar(this.forBone.height / this.worldScale);
        this.position.set(this.forBone.position.x, this.forBone.position.y, this.forBone.position.z);
        return this;
    }

    async updateDisplay(constraint) {
        if(!this.visible) return;
        this.updateViolationHint();
    }

    updateViolationHint() {
        if (this.forKusudama.getViolationStatus())
            this.shell.material.uniforms.shellColor.value = KusudamaHelper.violationColor;
        else
            this.shell.material.uniforms.shellColor.value = KusudamaHelper.baseShellColor;
    }


    /**quick and dirty way to easily regenerate this constraint without bothering with saving and loading parameters*/
    printInitializationString(doPrint = true, parname) {
        let tag = "";
        for (let [t, b] of Object.entries(this.forBone.parentArmature.bonetags)) {
            if (b == this.forBone) {
                tag = t; break;
            }
        }
        parname = parname == null ? `armature.bonetags["${tag}"]` : parname;
        let ta = this.forKusudama.twistAxis;
        let postPar = parname == null ? '' : `.forBone`;
        let result = `new Kusudama(${parname}, "${this.forKusudama.ikd}", armature.stablePool)`
        for (let i = 0; i < this.forKusudama.limitCones.length; i++) {
            let l = this.forKusudama.limitCones[i];
            let cd = l.getControlPoint();
            let cr = l.getRadius();
            result += `
            .addLimitConeAtIndex(${i}, armature.stablePool.any_Vec3(${cd.x}, ${cd.y}, ${cd.z}), ${cr})`;
            if (i < this.forKusudama.limitCones.length - 1 || this.forKusudama.enabled == false)
                result += `.parentKusudama`
        }
        if (!this.forKusudama.enabled) result += '.disable()';
        result += ';\n';
        if(this.forKusudama.autoGen) result = '';
        if (doPrint)
            console.log(result);
        else return result;
    }


}