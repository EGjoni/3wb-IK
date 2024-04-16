const { Object3D, Bone } = await import("three");

export class Saveable {
    static loadingList = [];
    constructor(ikd, type, instanceNumber, pool) {
        this.ikd = ikd;
        this.type = type;
        this.instanceNumber = instanceNumber;
        this.pool = pool;
        this.autoBind();
    }

autoBind() {
        this['toJSON'] = this['toJSON'].bind(this);
        this['ikSaveNotification'] = this['ikSaveNotification'].bind(this);
        this['postPop'] = this['postPop'].bind(this);
        this['getRequiredRefs'] = this['getRequiredRefs'].bind(this);
    }

    toJSON() {
        let result = {};
        result.ikd = this.ikd;
        result.type = this.type;
        result.instanceNumber = this.instanceNumber;
        result.requires = Saveable.refsToIkd(this.getRequiredRefs());
        return result;
    }

    ikSaveNotification(saveList) {
        if(saveList.has(this.toJSON)) 
            return;        
        else
            saveList.add(this.toJSON);
        let requiredRefs = this.getRequiredRefs();
        for(let [k, r] of Object.entries(requiredRefs)) {
            if(r == null)  continue;
            if(!isIterable(r)) {
                if(r?.ikSaveNotification == null) 
                    continue;
                r?.ikSaveNotification(saveList);
            } else {
                for(let e of r) {
                    e?.ikSaveNotification(saveList);
                }
            }
        }
    }
    async postPop(json, loader, pool) {
        this.ikd = json.ikd;
        this.type = json.type;
        this.instanceNumber = json.instanceNumber;
        this.pool = pool; 
    }
    getRequiredRefs() { return {}}

    static async prepop(requiresObj, loader, pool, scene) {
        let result = {};
        for(let [key, val] of Object.entries(requiresObj)) {
            if(Array.isArray(val)) {
                result[key] = [];
                for(let v of val) {
                    if(!v.isScenePathObj)
                        result[key].push(await loader.getInstance(v))
                    else
                        result[key].push(loader.findSceneObject(v, scene));
                }
            } else {
                if(val == null) continue;
                if(!val.isScenePathObj)
                    result[key] = await loader.getInstance(val);
                else
                    result[key] = loader.findSceneObject(val, scene);
            }
        }
        return result;
    }

    

    static refsToIkd(requiresObj) {
        let result = {};
        for(let [key, val] of Object.entries(requiresObj)) {
            if(val == null) continue;
            if(val instanceof Object3D) {
                result[key] = Saveable.getScenePathTo(val);
            } else if(!isIterable(val)) {
                result[key] = val.ikd;
            } else {
                result[key] = [];
                for(let v of val) {
                    if(v == null) continue;
                    if(v instanceof Object3D)
                        result[key].push(Saveable.getScenePathTo(v));
                    else 
                        result[key].push(v.ikd);
                }
            }
        }
        return result;
    }
    

    currentlySaving = new Set();
    static async initSave(startEntries) {
        Saveable.currentlySaving = new Set();        
        let aggregatedJSON = { 
            classes: {
                'Bone': [],
                'Constraint' : [],
                'ConstraintStack' : [],
                'Kusudama' : [],
                'LimitCone' : [],
                'Twist' : [],
                'Rest' : [],
                'EWBIK' : [],
                'IKNode' : [],
                'IKTransform' : [],
                'TrackingNode' : [],
                'IKPin' : [],
                'misc': []
            }
        };
        for(let e of startEntries) {
            e.ikSaveNotification(Saveable.currentlySaving);
        }
        for(let jsonCallback of Saveable.currentlySaving) {
            let resultJSON = jsonCallback();
            aggregatedJSON.classes[resultJSON.type].push(resultJSON);
        }
        Saveable.currentlySaving = new Set();
        const blob = new Blob([JSON.stringify(aggregatedJSON)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.download = 'everything_will_be_IK_state.json';
        a.href = url;
        a.classList.add("hidden");
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        
    }

    

    static get loadMode() {return Saveable.loadingList.length > 0;}
    static isLoading(loader) {
        if(Saveable.loadingList.indexOf(loader) == -1) Saveable.loadingList.push(loader);
    }
    static finishedLoading(loader) {
        let idx = Saveable.loadingList.indexOf(loader);
        if(idx != -1) {
            Saveable.loadingList.splice(idx, 1);
        }
    }

    static getScenePathTo(curr) {
        let pathObj = {isScenePathObj : true, path: []};
        while(curr != null) {
            let pathInfo = {
                index : curr?.parent?.children.indexOf(curr),
                name: curr.name, 
                ikd: curr.ikd,
                type: curr.constructor.name,
                id: curr.id};
            pathObj.path = [...pathObj.path, pathInfo];
            curr = curr.parent;
        }
        return pathObj;
    }

}

function isIterable(obj) {
    return obj != null && typeof obj[Symbol.iterator] == 'function';
}



export class Loader {
    initialized_byclass = {};
    initialized_by_id = {};
    loading = [];
    static prereqsImported = false;
    constructor() {
        
    }
    async fromFile(fileContent, scene, pool) {
        await Loader.loadPrereqs();
        let asJSON = await new Promise((resolve, reject) => {
            const reader = new FileReader(); 
            reader.onload = () => {
                resolve(reader.result);
            };
            reader.onerror = reject;
            reader.readAsText(fileContent);
        });
        const json = JSON.parse(await asJSON);
        let result = await this.loadObjects(json, pool, scene);
        let resultList = []; 
        for(let [k, v] of Object.entries(this.initialized_byclass["EWBIK"])) resultList.push(await v);
        return resultList;
    }

    async getInstance(ikd) {
        //initialized_by_id holds promises to instances that have begun but not necessarily finished loading. 
        //those promises resolve when they have finished loading at which point they can be returned as object instances
        return await this.initialized_by_id[ikd];
    }

    async loadObjects(json, pool, scene) {
        Saveable.isLoading(this);
        for(let [className, classRef] of Object.entries(Loader.loadableClasses)) {
            //jsonInst is is a jsonObj, fromJSON is an async function in each class which returns only when an object has finished initializing
            //basic idea is to have the complex hierarchy of object requiring each other take care of itself by just using async/await to pause loading of any object
            //until anything it depends on has loaded via getInstance()
            for(let jsonInst of json.classes[className]) {
                if (className == "TrackingNode") {
                    if(jsonInst.requires.toTrack.path[0].ikd.indexOf("IKPin-") == 0) {
                        continue; //no support for loading / saving pins yet. I got too fancy with the UI.
                    }
                }
                if(className == "Bone") {
                    // we don't actually save or load bones, we just save and load the things we do to / add on to them
                }  else {
                    let res = classRef.fromJSON(jsonInst, this, pool, scene);
                    if(this.initialized_byclass[className] == null) 
                        this.initialized_byclass[className] = {};
                    if(jsonInst.ikd == null) continue;
                    this.initialized_byclass[className][jsonInst.ikd] = res;
                    this.initialized_by_id[jsonInst.ikd] = res;
                    this.loading.push(res);
                }
            }
        }
        await Promise.all(this.loading); 
        Saveable.finishedLoading(this);
        let popping = [];
        for(let [className, classRef] of Object.entries(Loader.loadableClasses)) {
            for(let jsonInst of json.classes[className]) {
                if(jsonInst.ikd == null) continue;
                let inst = await this.initialized_by_id[jsonInst.ikd];
                if(jsonInst.type != "Bone" && inst != null) {
                     this.initialized_by_id[jsonInst.ikd] = inst.postPop(jsonInst, this, pool, scene);
                     popping.push(inst);
                }
            }
        }
        await Promise.all(popping);
        return true;
    }
    static findSceneObject(objPath, scene) {
        if(objPath.isScenePathObj) 
            objPath = objPath.path;
        let curr = scene;
        let idxtraveral = 'scene/';
        let ikdtraversal = 'scene/';
        let nametraversal = 'scene/';
        for(let i = objPath.length-1; i>=0; i--) {
            let o = objPath[i];
            if(o.index == null) continue;
            curr = curr.children[o.index];
            idxtraveral += `${o.index}/ `;
            ikdtraversal += `${o.ikd}/`;
            nametraversal += `${o.name}/`;
            
            //if(o.index > curr.children.length)
            //throw new Error(`Could not find scene object by path ${o.index}`);

            if(o.ikd != curr.ikd && curr.ikd != null) {
                throw new Error(`Could not find object in scene. scene ikd ${curr.ikd} and expected name ${o.ikd} do not match.
                ${idxtraveral}
                ${ikdtraversal}
                ${nametraversal}
                `);
            }
            if(curr.name != '' && o.name != null && o.name != curr.name) {
                throw new Error(`Could not find object in scene. scene name ${curr.name} and expected name ${o.name} do not match.
                ${idxtraveral}
                ${ikdtraversal}
                ${nametraversal}
                `);
            }
            if(curr.type != null && o.type != curr.type) {
                throw new Error(`Could not find object in scene. scene type ${curr.type} and expected type ${o.type} do not match.
                ${idxtraveral}
                ${ikdtraversal}
                ${nametraversal}
                `);
            }
        }
        return curr;
    }

    async fromUrl(url, pool) {
        try {
            const response = await fetch(url);
            if (!response.ok)
                throw new Error(`HTTP error! status: ${response.status}`);
            const json = await response.json();
            await this.loadObjects(json, pool);
        } catch (error) {
            console.error('Error loading from URL: '+url, error);
        }
    }
    static async loadPrereqs() {
        let result = false;
        if(!Loader.prereqsImported) {
            result = await loadImportions();
            this.prereqsImported = true;
            Loader.loadableClasses = result;
        }
        return result;
    }    

    static loadableClasses = {};
}


/*import { EWBIK } from "../../EWBIK.js";
import { Constraint, ConstraintStack, Kusudama, LimitCone, Rest, Twist } from "../../betterbones/Constraints/ConstraintStack.js";
import { IKPin } from "../../betterbones/IKpin.js";
import { IKNode, TrackingNode } from "../nodes/IKNodes.js";
import { IKTransform } from "../nodes/IKTransform.js";*/

async function loadImportions() {
    const {EWBIK} = await import("../../EWBIK.js");
    const { Constraint, ConstraintStack, Kusudama, LimitCone, Rest, Twist } = await import("../../betterbones/Constraints/ConstraintStack.js");
    const {IKPin} = await import("../../betterbones/IKpin.js");
    const { IKNode, TrackingNode } = await import("../nodes/IKNodes.js");
    const {IKTransform} = await import("../nodes/IKTransform.js");
    return {
        'EWBIK' : EWBIK,
        'IKTransform' : IKTransform,
        'IKNode' : IKNode,
        'TrackingNode' : TrackingNode,
        'Bone' : Bone,
        'Constraint' : Constraint,
        'ConstraintStack' : ConstraintStack,
        'Kusudama' : Kusudama,
        'LimitCone' : LimitCone,
        'Twist' : Twist,
        'Rest' : Rest,       
        'IKPin' : IKPin
    };
}