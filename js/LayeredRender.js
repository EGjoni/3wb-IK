const THREE = await import('three');

export class LayeredRender {
    constructor(renderer, width, height, ...callbacks) {
        this.renderer = renderer;
        this.callbacks = [...callbacks];
        this.renderTargets = [];
        this.needClear = new Array(callbacks.length).fill(false);
        this.layerEnabled = new Array(callbacks.length).fill(true);
        this.compositeMaterial = this.createCompositeMaterial(callbacks.length);
        this.compositeScene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        this.initRenderTargets(width, height);
        this.initCompositeScene();
    }

    initRenderTargets(width, height) {
        for (let i = 0; i < this.callbacks.length; i++) {
            const renderTarget = new THREE.WebGLRenderTarget(width, height);
            this.renderTargets.push(renderTarget);
        }
    }

    initCompositeScene() {
        const geometry = new THREE.PlaneGeometry(2, 2);
        const plane = new THREE.Mesh(geometry, this.compositeMaterial);
        this.compositeScene.add(plane);
    }

    layerState(idx, state) {
        if(state) this.show(idx);
        else this.hide(idx); 
    }

    toggle(index) {
        this.needClear[index] = !this.needClear[index];
    }

    show(index) {
        if (index >= 0 && index < this.layerEnabled.length) {
          this.layerEnabled[index] = true;
        }
      }
    
    hide(index) {
        if (index >= 0 && index < this.layerEnabled.length && this.layerEnabled[index]) {
            this.layerEnabled[index] = false;
            this.needClear[index] = true; // Mark this layer's target for clearing
          }
    }
    clearRenderTarget(index) {
        const target = this.renderTargets[index];
        this.renderer.setRenderTarget(target);
        this.renderer.clear(true, true, true);
        this.renderer.setRenderTarget(null); // Reset to render to the screen
      }
    render() {
        this.renderTargets.forEach((target, index) => {
            if (this.layerEnabled[index]) {
                this.renderer.setClearColor(0x000000, 0);
                this.renderer.setRenderTarget(target);
                this.callbacks[index](this.renderer, target);
                this.needClear[index] = false; 
              } else if (this.needClear[index]) {
                this.clearRenderTarget(index);
                this.needClear[index] = false; 
              }
        });
        this.compositeMaterial.uniforms.textures.value = this.renderTargets.map(rt => rt.texture);
        this.renderer.setRenderTarget(null); // Ensure we're rendering to the screen
        this.renderer.render(this.compositeScene, this.camera);
    }


    createCompositeMaterial(numTextures) {
        let fragmentShaderPart1 = `
            uniform sampler2D textures[${numTextures}];
            varying vec2 vUv;

            void main() {
                vec4 color = texture2D(textures[0], vUv); // Start with the first texture as the base
                vec4 srcColor = vec4(color.rgb, 1.0);
        `;

        let dynamicShaderPart = ``;
        for (let i = 1; i < numTextures; i++) { // Start loop at 1 since the base color is already texture 0
            dynamicShaderPart += `
                srcColor = texture2D(textures[${i}], vUv);
                color.rgb = (srcColor.rgb * srcColor.a) + (color.rgb * (1.0 - srcColor.a));
                color.a = srcColor.a + color.a * (1.0 - srcColor.a); // An example of handling alpha
            `;
        }

        let fragmentShaderPart2 = `
                gl_FragColor = vec4(color.rgb, 1.0); // Assuming final output is fully opaque
            }
        `;

        const completeFragmentShader = fragmentShaderPart1 + dynamicShaderPart + fragmentShaderPart2;

        return new THREE.ShaderMaterial({
            uniforms: {
                textures: { value: new Array(numTextures).fill(null) }, // Initialize with nulls or actual textures
            },
            vertexShader: `
                varying vec2 vUv;
    
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: completeFragmentShader,
            depthWrite: false,
            depthTest: false,
        });
    }
}