import * as THREE from 'three';
import { EWBIK, IKPin } from '../../EWBIK/EWBIK.js';
import { Rest, Kusudama, Twist } from "../../EWBIK/betterbones/Constraints/ConstraintStack.js";

export function initSenua(armature) {
    //armature.declareDefaultOrientation(EWBIK.ZDIR);
    initSenuaShortcuts(armature);
    armature.setInternalOrientationFor(armature.l_eyelid_upper, EWBIK.ZDIR);
    armature.setInternalOrientationFor(armature.l_eyelid_lower, EWBIK.ZDIR);
    let unconstrained_left_eye = armature.l_eyeball_unconstrained = armature.l_eyeball.clone(false);
    let unconstrained_right_eye = armature.r_eyeball_unconstrained = armature.r_eyeball.clone(false);
    armature.setInternalOrientationFor(armature.l_eyeball_unconstrained, EWBIK.ZDIR);
    armature.setInternalOrientationFor(armature.r_eyeball_unconstrained, EWBIK.ZDIR);
    armature.inferOrientations(armature.rootBone, 'statistical', false, -1);

    let signal_killer = armature.face_signal_killer = armature.face_bone.clone(false);
    signal_killer.name = 'face_signal_killer';
    armature.face_bone.parent.add(signal_killer);
    signal_killer.setStiffness(1);
    unconstrained_left_eye.name = 'l_eye_unconstrained';
    unconstrained_right_eye.name = 'r_eye_unconstrained';
    armature.face_signal_killer.add(unconstrained_left_eye);
    armature.face_signal_killer.add(unconstrained_right_eye);
    armature.l_pupil = new Bone(); armature.l_pupil.name = 'l_pupil_unconstrained';
    armature.l_pupil.position.z = 2;
    armature.l_pupil.setStiffness(1);
    unconstrained_left_eye.add(armature.l_pupil);
    /**
     * //TODO: consider a more robust solve order system that prioritizes sibling chain solve order
     * based on makimum targetNode depth
     */
    signal_killer.add(armature.l_eyelid_lower);
    signal_killer.add(armature.l_eyelid_upper);

    initSenuaPins(armature);
    initSenuaConstraints(armature);
}

export function initSenuaShortcuts(armature) {
    for (let b of armature.bones) {
        if (b.name.indexOf('eyelash') != -1
            || b.name.indexOf('eyeBrow') != -1
            || b.name.indexOf('duct') != -1
            || b.name.indexOf('toggle') != -1
            //|| b.name.indexOf('weapon') != -1
        ) {
            b.removeFromParent();
        }
    }

    armature.l_eyeball = armature.bonetags['FACIAL_L_Eyeball_084'];
    armature.r_eyeball = armature.bonetags['FACIAL_R_Eyeball_086'];
    armature.l_eyelid_upper = armature.bonetags["FACIAL_L_EyelidUpper_082"];
    armature.l_eyelid_lower = armature.bonetags["FACIAL_L_EyelidLower_088"];
    armature.sternum = armature.bonetags['sternum_040'];

    armature.face_bone = armature.bonetags["FACIAL_C_FacialRoot_081"];
    armature.face_bone.setStiffness(1);
    /*let unpinned_face = armature.face_unpinned = new Bone();
    armature.face_pinned.parent.add(unpinned_face);
    unpinned_face.name = 'unpinned_face';
    unpinned_face.copy(armature.face_pinned);
    unpinned_face.setStiffness(1.0);*/

    // = armature.bonetags["FACIAL_C_FacialRoot_081"];

    //add tips to the irises so we can have them always try to solve toward our effectors.
    /*armature.l_iris = new THREE.Bone();
    armature.l_iris.name = 'l_iris';
    armature.l_iris.position.z = 3;
    armature.l_eyeball.add(armature.l_iris);
    armature.r_iris = new THREE.Bone();
    armature.r_iris.name = 'r_iris';
    armature.r_iris.position.z = 3;
    armature.r_eyeball.add(armature.r_iris);*/

}


function hasUsedDesc(b) {
    for (let cb of b.childBones()) {
        if (cb.name.indexOf('unused') == -1) {
            return true;
        } else {
            if (hasUsedDesc(cb)) {
                return true;
            }
        }
    }
    return false;
}

export function initSenuaPins(armature) {

    let root_04_pin = new IKPin(armature.bonetags["root_04"]);
    root_04_pin.setPinWeight(0.5000);
    root_04_pin.setPSTPriorities(1, 0.2500, 0.2500);
    root_04_pin.setInfluenceOpacity(1 - 0.0000);

    let head_046_pin = new IKPin(armature.bonetags["head_046"]);
    head_046_pin.setPinWeight(1);
    head_046_pin.setPSTPriorities(0.25, 0.12100, 0.06100);
    head_046_pin.setInfluenceOpacity(1 - 1);

    let signal_killer_pin = new IKPin(armature.face_signal_killer);
    signal_killer_pin.setPinWeight(0.0000);
    signal_killer_pin.setPSTPriorities(0, 0, 0);
    signal_killer_pin.setInfluenceOpacity(0);

    let l_pupil_pin = new IKPin(armature.l_pupil);
    l_pupil_pin.setPinWeight(0.064);
    l_pupil_pin.setPSTPriorities(0.026, 0, 0);
    l_pupil_pin.setInfluenceOpacity(0);
    armature.l_pupil_pin = l_pupil_pin;

    let sternumPin = new IKPin(armature.sternum);


    let constrained_l_eyball_pin = new IKPin(armature.bonetags["FACIAL_L_Eyeball_084"]);
    armature.l_eyeball_unconstrained.getIKBoneOrientation().attach(constrained_l_eyball_pin.target_threejs);
    constrained_l_eyball_pin.ensure();


    let FACIAL_L_EyelidUpper_082_pin = new IKPin(armature.bonetags["FACIAL_L_EyelidUpper_082"]);
    FACIAL_L_EyelidUpper_082_pin.setPinWeight(0.5000);
    FACIAL_L_EyelidUpper_082_pin.setPSTPriorities(0, 0.015, 0.15);
    FACIAL_L_EyelidUpper_082_pin.setInfluenceOpacity(0);
    armature.bonetags["FACIAL_L_Eyeball_084"].add(FACIAL_L_EyelidUpper_082_pin.target_threejs);
    FACIAL_L_EyelidUpper_082_pin.ensure();
    FACIAL_L_EyelidUpper_082_pin.target_threejs.position.set(0, 0, 0);
    FACIAL_L_EyelidUpper_082_pin.target_threejs.quaternion.set(0.5948227289971563, 0, 0, 0.8038569033530626).normalize();
    FACIAL_L_EyelidUpper_082_pin.targetNode.mimic();


    let FACIAL_L_EyelidLower_088_pin = new IKPin(armature.bonetags["FACIAL_L_EyelidLower_088"]);
    FACIAL_L_EyelidLower_088_pin.setPinWeight(0.5000);
    FACIAL_L_EyelidLower_088_pin.setPSTPriorities(1, 0.15, 0.15);
    FACIAL_L_EyelidLower_088_pin.setInfluenceOpacity(1 - 0.0000);
    armature.bonetags["FACIAL_L_Eyeball_084"].add(FACIAL_L_EyelidLower_088_pin.target_threejs);
    FACIAL_L_EyelidLower_088_pin.ensure();
    FACIAL_L_EyelidLower_088_pin.target_threejs.position.set(0, 0, 0);
    FACIAL_L_EyelidLower_088_pin.target_threejs.quaternion.set(0.878817116970432, 0, 0, 0.47715875232439936).normalize();
    FACIAL_L_EyelidLower_088_pin.targetNode.mimic();



}


export function initSenuaConstraints(armature) {


    new Kusudama(armature.bonetags["FACIAL_L_EyelidUpper_082"], "Kusudama for FACIAL_L_EyelidUpper_082", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0.1173600261159984, 0.19748232892523684, 0.973256057793794), 0.38533).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(3.5655970579988005e-8, -0.19784471846309992, 0.9802333739351337), 0.13131);
    new Twist(armature.bonetags["FACIAL_L_EyelidUpper_082"], 0.14972, undefined,
        armature.stablePool.any_Vec3(-0.016198615180458842, 0.32755647216526457, 0.9446927343898025),
        0.11611034442839976,
        "Twist for FACIAL_L_EyelidUpper_082", armature.stablePool);

    new Kusudama(armature.bonetags["FACIAL_L_Eyeball_084"], "Kusudama for FACIAL_L_Eyeball_084", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(-0.09953910233467297, 0.008230869641997311, 0.9949996079855229), 0.38533).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0.530079320699, -0.04569788217107864, 0.8467157830892046), 0.2936);
    new Twist(armature.bonetags["FACIAL_L_Eyeball_084"], 0.44607, undefined,
        armature.stablePool.any_Vec3(-0.08119778620202542, 0.013898668363445221, 0.9966008579102092),
        0.10689414415000374,
        "Twist for FACIAL_L_Eyeball_084", armature.stablePool);

    new Rest(armature.bonetags["FACIAL_L_Eyeball_084"], "Rest constraint for l_eyeball").setPainfulness(0.97).setStockholmRate(0.97);

    new Kusudama(armature.bonetags["FACIAL_L_EyelidLower_088"], "Kusudama for FACIAL_L_EyelidLower_088", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(-2.408208543480737e-9, -0.36524870224706324, 0.9309099771228344), 0.1172).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0.03387750964695864, -0.5717875369717635, 0.8197019744418605), 0.22304);
    new Twist(armature.bonetags["FACIAL_L_EyelidLower_088"], 0.4743, undefined,
        armature.stablePool.any_Vec3(0.20622239476207488, -0.4640560263545766, 0.8614663825725271),
        5.62245,
        "Twist for FACIAL_L_EyelidLower_088", armature.stablePool)
        .setPainfulness(0.725).setStockholmRate(0.6325);





    new Twist(armature.bonetags["neck_01_044"], 0.97101, undefined,
        armature.stablePool.any_Vec3(0.021758649256062874, 0.924797009577693, 0.3798384014346557),
        0.15068814068258687,
        "Twist for neck_01_044",
        armature.stablePool).setPainfulness(0.19597).setStockholmRate(0.39689);

    new Kusudama(armature.bonetags["neck_01_044"],  "Kusudama for neck_01_044", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0.014773372813533987, 0.9641709428278473, 0.26487004447874496), 0.29029);

    new Twist(armature.bonetags["neck_02_045"], 0.84086, undefined,
        armature.stablePool.any_Vec3(0.02969376893178523, 0.9994745801325016, 0.012989401306488712),
        0.0041320139027573475,
        "Twist for neck_02_045",
        armature.stablePool).setPainfulness(0.21461).setStockholmRate(0.42796);

    new Kusudama(armature.bonetags["neck_02_045"], "Kusudama for neck_02_045", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0.029693770701671868, 0.9994746397058318, 0.0129894020807174), 0.16014);



    new Kusudama(armature.bonetags["head_046"], "Kusudama for head_046", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0.064255827892154, 0.8039208812661618, -0.5912549409908822), 0.32933);

    new Twist(armature.bonetags["head_046"], 0.89292, undefined,
        armature.stablePool.any_Vec3(0.06425583044545122, 0.8039209132111078, -0.5912549644852427),
        0.0018115931185819741,
        "Twist for head_046",
        armature.stablePool);

    new Rest(armature.bonetags["head_046"],
        "Rest for head_046_on_bone_head_046", armature.stablePool).setPainfulness(0.72209)
        .setStockholmRate(0.68687)
        .boneFrameRest.setLocalOrientationTo(
            new Rot(0.9943207558569429, 0.10080368670850445, 0.006461833934662164, 0.03351262329708636));


    for (let b of armature.bones) {
        let returnfulls = b.getConstraint()?.getReturnfulledArray() ?? [];
        let addRest = true;
        for (let r of returnfulls) {
            if (!(r instanceof Rest)) {
                addRest = false;
            }
        }
        if (addRest) {
            let restconst = new Rest(b);
        }
    }

    for (let b of armature.bones) {
        if (b.parent instanceof THREE.Bone) {
            if (b.getConstraint() != null) {
                b.getConstraint().layers?.set(1);
                continue;
            }
        }
    }
}