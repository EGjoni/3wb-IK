

export class StateMachine {
    currentState = null;
    constructor(startState) {
        this.currentState = startState;
    }

    evaluate() {
        this.currentState = this.currentState.transition(this);
        this.currentState.entered(this);
    }
}


export class State {
    /**Map with callbacks as keys and states as values. 
     * Each callback is expected to return true or
     * false. If a callback returns true when evaluated, the corresponding state will be returned on a first come first serve basis.
     * The callback will be provided a reference to the statemachine that invoked this state, and a reference to this state
    */
    transitionFunctions = new Map();

    /**
     * @param {Function} onEnter;
     * @param {String} stateName;
     */
    constructor(onEnter, stateName = "Unnamed State") { 
        this._onEnter = onEnter;       
        this.stateName = stateName;
    }

    /**a callback to fire whenever a statemachine has en */
    setOnEnter(callback) {
        this._onEnter = callback;
    }

    _onEnter() {
        return;
    }
    entered(machine) {this._onEnter(machine, this)} 

    addTransitionFunction(callback, resultState) {
        this.transitionFunctions.set(callback, resultState);
    }

    transition(machine) {
        for(let [k, v] of Object.entries(this.transitionFunctions)) {
            let result = k(machine, this);
            if(result) return v;
        }
    }

    
}