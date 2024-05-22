export class LayerGroup {
    constructor(forG, onNewMask) {
        this.forG = forG;
        this._layers = this.forG.layers;
        this.onNewMask = onNewMask;
    }

    get mask() {
        return this?._layers?.mask;
    }

    set mask(val) {
        this._layers.mask = val;
        this.onNewMask(val, this.mask);
    }

    set(val) {
       this._layers.set(val);
       this.mask = this._layers.mask;
    }

    test(layers) {
        return this?._layers.test(layers);
    }

    isEnabled(channel) {
        return this?._layers.isEnabled(channel);
    }

    enable(channel) {
        this._layers.enable(channel);
        this.mask = this._layers.mask;
    }

	enableAll() {
        this._layers.enableAll();
		this.mask = this._layers.mask;
	}

	toggle(channel) {
        this._layers.toggle(channel);
		this.mask = this._layers.mask;
	}

	disable(channel) {
        this._layers.disable(channel);
		this.mask = this._layers.mask;
	}

	disableAll() {
        this._layers.disableAll();
		this.mask = this._layers.mask;
	}
}