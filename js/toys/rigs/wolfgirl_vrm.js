import { IKPin } from "../../EWBIK/betterbones/IKpin.js";
import {Rot} from "../../EWBIK/util/Rot.js";
import { Rest, Twist, Kusudama } from "../../EWBIK/betterbones/Constraints/ConstraintStack.js";

export function initWolfGirlConstraints(armature, withRootRest = false) {

    //override the autoinferred orientation for the legs because this rig has weird tassles that throw it off
    armature.setInternalOrientationFor(armature.r_leg_lower, armature.r_foot.position);
    armature.setInternalOrientationFor(armature.l_leg_lower, armature.l_foot.position);

    if (withRootRest) {
        maybeAddRest(armature.c_hips.parent);
        maybeAddRest(armature.c_hips);
    }

    new Kusudama(armature.bonetags["J_Bip_C_Spine"], (t, b) => b == window.contextBone, "Kusudama for J_Bip_C_Spine", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0, 0.9871905049027117, -0.15954594018629684), 0.41355);
    new Twist(armature.bonetags["J_Bip_C_Spine"], 0.62953, undefined,
        armature.stablePool.any_Vec3(-1.8374118504407587e-16, 0.9996360572455434, -0.02697689853531279),
        0, (cnstrt, bone) => bone == window.contextBone,
        "Twist for J_Bip_C_Spine", armature.stablePool);
    new Kusudama(armature.bonetags["J_Bip_C_Chest"], (t, b) => b == window.contextBone, "Kusudama for J_Bip_C_Chest", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0, 0.9821077424398447, -0.18831989337218755), 0.54056);
    new Twist(armature.bonetags["J_Bip_C_Chest"], 0.88355, undefined,
        armature.stablePool.any_Vec3(2.759975806107918e-16, 0.9908696724608967, 0.13482318864807638),
        0, (cnstrt, bone) => bone == window.contextBone,
        "Twist for J_Bip_C_Chest", armature.stablePool);
    new Kusudama(armature.bonetags["J_Bip_C_UpperChest"], (t, b) => b == window.contextBone, "Kusudama for J_Bip_C_UpperChest", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0, 0.9818358120917213, -0.1897325435822493), 0.47);
    new Twist(armature.bonetags["J_Bip_C_UpperChest"], 1.25046, undefined,
        armature.stablePool.any_Vec3(8.575184161921518e-17, 0.9983219856621794, -0.057906933466761526),
        0, (cnstrt, bone) => bone == window.contextBone,
        "Twist for J_Bip_C_UpperChest", armature.stablePool);
    new Kusudama(armature.bonetags["J_Bip_C_Neck"], (t, b) => b == window.contextBone, "Kusudama for J_Bip_C_Neck", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(-3.661705994390258e-9, 0.9917943192012539, -0.12784376558957108), 0.49117);
    new Twist(armature.bonetags["J_Bip_C_Neck"], 1.21177, undefined,
        armature.stablePool.any_Vec3(-3.6617059943902597e-9, 0.9917943192012544, -0.12784376558957114),
        0, (cnstrt, bone) => bone == window.contextBone,
        "Twist for J_Bip_C_Neck", armature.stablePool);
    new Kusudama(armature.bonetags["J_Bip_C_Head"], (t, b) => b == window.contextBone, "Kusudama for J_Bip_C_Head", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0.007645192954748523, 0.9768661054817858, -0.21371514449269452), 0.8);
    new Twist(armature.bonetags["J_Bip_C_Head"], 1.3, undefined,
        armature.stablePool.any_Vec3(0.007645192954748521, 0.9768661054817855, -0.21371514449269446),
        0, (cnstrt, bone) => bone == window.contextBone,
        "Twist for J_Bip_C_Head", armature.stablePool);


    new Kusudama(armature.bonetags["J_Bip_L_Shoulder"], (t, b) => b == window.contextBone, "Kusudama for J_Bip_L_Shoulder", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(-0.9887169584774933, 0.14950459401107696, 0.009335544365375602), 0.4);
    new Twist(armature.bonetags["J_Bip_L_Shoulder"], 0.57308, undefined,
        armature.stablePool.any_Vec3(-0.9891449243957722, -0.14694324939268918, 0),
        0.11874, (cnstrt, bone) => bone == window.contextBone,
        "Twist for J_Bip_L_Shoulder", armature.stablePool).setPainfulness(0.06).setStockholmRate(0.55);;
    new Kusudama(armature.bonetags["J_Bip_L_UpperArm"], (t, b) => b == window.contextBone, "Kusudama for J_Bip_L_UpperArm", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(-0.9916964094100271, -0.11207984022434514, -0.06305823481945402), 0.92).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(-0.8036982717311892, -0.011728159802487127, -0.5949214555585861), 0.82986);
    new Twist(armature.bonetags["J_Bip_L_UpperArm"], 1.5327, undefined,
        armature.stablePool.any_Vec3(-0.9563317980984724, -0.26527536604056035, 0.12271296638004676),
        5.866313039378566, (cnstrt, bone) => bone == window.contextBone,
        "Twist for J_Bip_L_UpperArm", armature.stablePool).setPainfulness(0.16).setStockholmRate(0.55);;
    new Rest(armature.bonetags["J_Bip_L_UpperArm"]).setPainfulness(0.99).setStockholmRate(0.98).boneFrameRest.localMBasis.rotateTo(new Rot(0.8728142708915317, -0.1757863522710011, -0.006954392086624176, -0.45524283993715364));
    new Kusudama(armature.bonetags["J_Bip_L_LowerArm"], (t, b) => b == window.contextBone, "Kusudama for J_Bip_L_LowerArm", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0.9600705258759669, 0.1644617183058307, -0.22631157406579597), 0.05).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(-0.9291499514145903, 0.10022203406467751, -0.35585939874366557), 0.05);
    new Twist(armature.bonetags["J_Bip_L_LowerArm"], 3, undefined,
        armature.stablePool.any_Vec3(-0.9460350361574907, 0.08962361698482435, -0.31142465804918673),
        0.3897261449874404, (cnstrt, bone) => bone == window.contextBone,
        "Twist for J_Bip_L_LowerArm", armature.stablePool).setPainfulness(0.33).setStockholmRate(0.44);
    new Kusudama(armature.bonetags["J_Bip_L_Hand"], (t, b) => b == window.contextBone, "Kusudama for J_Bip_L_Hand", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(-0.5742044866868236, 0.8186183370537373, -0.012378437223462383), 0.92159).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(-0.9114921689234482, -0.4108478087334832, -0.019649530531882186), 0.92159);
    new Twist(armature.bonetags["J_Bip_L_Hand"], 0.15, undefined,
        armature.stablePool.any_Vec3(-0.9967892166712119, 0.07747109648849682, 0.020235778632455986),
        0, (cnstrt, bone) => bone == window.contextBone,
        "Twist for J_Bip_L_Hand", armature.stablePool);



    new Kusudama(armature.bonetags["J_Bip_R_Shoulder"], (t, b) => b == window.contextBone, "Kusudama for J_Bip_R_Shoulder", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0.9887169584774933, 0.14950459401107696, 0.009335544365375602), 0.4);
    new Twist(armature.bonetags["J_Bip_R_Shoulder"], 0.57308, undefined,
        armature.stablePool.any_Vec3(0.9891449243957722, -0.14694324939268918, 0),
        (2*Math.PI)-0.11874, (cnstrt, bone) => bone == window.contextBone,
        "Twist for J_Bip_R_Shoulder", armature.stablePool).setPainfulness(0.06).setStockholmRate(0.55);
    new Kusudama(armature.bonetags["J_Bip_R_UpperArm"], (t, b) => b == window.contextBone, "Kusudama for J_Bip_R_UpperArm", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0.9916964094100271, -0.11207984022434514, -0.06305823481945402), 0.92).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0.8036982717311892, -0.011728159802487127, -0.5949214555585861), 0.82986);
    new Twist(armature.bonetags["J_Bip_R_UpperArm"], 1.5327, undefined,
        armature.stablePool.any_Vec3(0.9563317980984724, -0.26527536604056035, 0.12271296638004676),
        (2*Math.PI)-5.866313039378566, (cnstrt, bone) => bone == window.contextBone,
        "Twist for J_Bip_R_UpperArm", armature.stablePool).setPainfulness(0.16).setStockholmRate(0.55);;
    new Rest(armature.bonetags["J_Bip_R_UpperArm"], undefined, "RestConstraint-3", armature.stablePool).boneFrameRest.localMBasis.rotateTo(new Rot(0.8728142708915317, -0.1757863522710011, 0.006954392086624176, 0.45524283993715364));
    new Kusudama(armature.bonetags["J_Bip_R_LowerArm"], (t, b) => b == window.contextBone, "Kusudama for J_Bip_R_LowerArm", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(-0.9600705258759669, 0.1644617183058307, -0.22631157406579597), 0.05).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0.9291499514145903, 0.10022203406467751, -0.35585939874366557), 0.05);
    new Twist(armature.bonetags["J_Bip_R_LowerArm"], 3, undefined,
        armature.stablePool.any_Vec3(0.9460350361574907, 0.08962361698482435, -0.31142465804918673),
        (2*Math.PI)-0.3897261449874404, (cnstrt, bone) => bone == window.contextBone,
        "Twist for J_Bip_R_LowerArm", armature.stablePool).setPainfulness(0.33).setStockholmRate(0.44);
    new Kusudama(armature.bonetags["J_Bip_R_Hand"], (t, b) => b == window.contextBone, "Kusudama for J_Bip_R_Hand", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0.5742044866868236, 0.8186183370537373, -0.012378437223462383), 0.92159).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0.9114921689234482, -0.4108478087334832, -0.019649530531882186), 0.92159);
    new Twist(armature.bonetags["J_Bip_R_Hand"], 0.15, undefined,
        armature.stablePool.any_Vec3(0.9967892166712119, 0.07747109648849682, 0.020235778632455986),
        0, (cnstrt, bone) => bone == window.contextBone,
        "Twist for J_Bip_R_Hand", armature.stablePool);



    new Kusudama(armature.bonetags["J_Bip_L_UpperLeg"], (cnstrt, bone) => bone == window.contextBone, "Kusudama for J_Bip_L_UpperLeg", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(-0.4966389167483273, 0.1621394148178797, -0.8526784836816064), 0.52645).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(-0.30824011892819925, -0.8923245487407536, -0.3297649599301598), 0.74518).parentKusudama
        .addLimitConeAtIndex(2, armature.stablePool.any_Vec3(0, -0.9578262852211515, 0.28734788556634544), 0.74518);
    new Twist(armature.bonetags["J_Bip_L_UpperLeg"], 2.15363, undefined, 
        armature.stablePool.any_Vec3(-0.3931142721750217, -0.7516174779057245, -0.5296530335219012), 
        5.11442, (cnstrt, bone) => bone == window.contextBone,
        "Twist for J_Bip_L_UpperLeg", armature.stablePool);

    new Kusudama(armature.bonetags["J_Bip_L_LowerLeg"], (t, b) => b == window.contextBone, "Kusudama for J_Bip_L_LowerLeg", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0, -0.9830241022983888, 0.1834764679746342), 0.1).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0, 0.7518876717414535, 0.6592912323724746), 0.1);
    new Twist(armature.bonetags["J_Bip_L_LowerLeg"], 0.34729, undefined,
        armature.stablePool.any_Vec3(0, -0.9984406832782645, 0.055822952043333464),
        0, (cnstrt, bone) => bone == window.contextBone,
        "Twist for J_Bip_L_LowerLeg", armature.stablePool);
    new Kusudama(armature.bonetags["J_Bip_L_Foot"], (t, b) => b == window.contextBone, "Kusudama for J_Bip_L_Foot", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0, -0.5256465905493974, -0.8507030397522946), 0.75224);
    new Twist(armature.bonetags["J_Bip_L_Foot"], 1.78672, undefined,
        armature.stablePool.any_Vec3(0, -0.5256465905493974, -0.8507030397522946),
        6.283185277377264, (cnstrt, bone) => bone == window.contextBone,
        "Twist for J_Bip_L_Foot", armature.stablePool);
    new Kusudama(armature.bonetags["J_Bip_R_UpperLeg"], (cnstrt, bone) => bone == window.contextBone, "Kusudama for J_Bip_R_UpperLeg", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0.4966389167483273, 0.1621394148178797, -0.8526784836816064), 0.52645).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0.30824011892819925, -0.8923245487407536, -0.3297649599301598), 0.74518).parentKusudama
        .addLimitConeAtIndex(2, armature.stablePool.any_Vec3(0, -0.9578262852211515, 0.28734788556634544), 0.74518);
    new Twist(armature.bonetags["J_Bip_R_UpperLeg"], 2.15363, undefined,
        armature.stablePool.any_Vec3(0.3931142721750217, -0.7516174779057245, -0.5296530335219012),
        6.283185307179586 - 5.11422, (cnstrt, bone) => bone == window.contextBone,
        "Twist for J_Bip_R_UpperLeg", armature.stablePool);
    new Kusudama(armature.bonetags["J_Bip_R_LowerLeg"], (t, b) => b == window.contextBone, "Kusudama for J_Bip_R_LowerLeg", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0, -0.9830241022983888, 0.1834764679746342), 0.1).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0, 0.7518876717414535, 0.6592912323724746), 0.1);
    new Twist(armature.bonetags["J_Bip_R_LowerLeg"], 0.34729, undefined,
        armature.stablePool.any_Vec3(0, -0.9984406832782645, 0.055822952043333464),
        0, (cnstrt, bone) => bone == window.contextBone,
        "Twist for J_Bip_R_LowerLeg", armature.stablePool);
    new Kusudama(armature.bonetags["J_Bip_R_Foot"], (t, b) => b == window.contextBone, "Kusudama for J_Bip_R_Foot", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0, -0.5256465905493974, -0.8507030397522946), 0.75224);
    new Twist(armature.bonetags["J_Bip_R_Foot"], 1.78672, undefined,
        armature.stablePool.any_Vec3(0, -0.5256465905493974, -0.8507030397522946),
        6.283185277377264, (cnstrt, bone) => bone == window.contextBone,
        "Twist for J_Bip_R_Foot", armature.stablePool);
    /*for (let b of armature.bones) {
        if(b.getConstraint() != null) {
            b.getConstraint().layers?.set(1);
        }
        if(b == armature.rootBone) continue;

        if (b.getConstraint() == null || b.name.indexOf("J_Bip_C") != -1) {
            let restconst = new Rest(b);
            if (b == armature.bonetags["J_Bip_C_Head"]) {
                restconst.setPainfulness(0.1);
                restconst.setStockholmRate(0.6);
            }
            if (b == armature.bonetags["J_Bip_C_Hips"]) {
                //restconst.setPainfulness(0.8);
                //restconst.setStockholmRate(0.85);
            }
            if (b == armature.bonetags["J_Bip_C_Neck"]) {
                restconst.setPainfulness(0.8);
                restconst.setStockholmRate(0.8);
            }
            if (b == armature.bonetags['J_Bip_C_Chest']) {
                restconst.setPainfulness(0.8);
                restconst.setStockholmRate(0.8);
            }
            if (b == armature.bonetags['J_Bip_C_UpperChest']) {
                restconst.setPainfulness(0.8);
                restconst.setStockholmRate(0.8);
            }
            if (b.name.indexOf("J_Sec") != -1) {
                restconst.setPainfulness(0.15);
                restconst.setStockholmRate(0.5);
            }
        }
    }*/
    for (let b of armature.bones) {
        if (b.name.indexOf("J_Sec") != -1) {
            let cstack = b.getConstraint();
            if (b.parent != armature.c_head) {
                if(!cstack?.getTyped('twist')) { 
                    let twistconst = new Twist(b);
                    twistconst.setPainfulness(0.15);
                    twistconst.setStockholmRate(0.5);
                    twistconst.setCurrentAsReference();
                    twistconst.setRange(Math.PI);
                }
            } else {
                if(!cstack?.getTyped('rest')) { 
                    let restconst = new Rest(b);
                    restconst.setPainfulness(0.15);
                    restconst.setStockholmRate(0.5);
                }
            }
            b.setStiffness(-5);
        }
    }
}


function maybeAddRest(bone) {
    let existingConstraints = bone.getConstraint()?.getReturnfulledArray();
    existingConstraints = existingConstraints == null ? [] : existingConstraints;
    let do_it = true;
    for (let r of existingConstraints) {
        if (r instanceof Rest) {
            do_it = false;
            break;
        }
    }
    if (do_it) {
        let rootrest = new Rest(bone);
        rootrest.setPainfulness(0.9);
        rootrest.setStockholmRate(0.9);
    }
}

/**Warning: not to be used in conjunction with initWolfGirlConstraints */
export function initWolfGirlRestConstraints(armature, withRootRest) {
    if (withRootRest) {
        maybeAddRest(armature.c_hips.parent);
        maybeAddRest(armature.c_hips);
    }
    armature.l_arm_upp.rotateX(1.2);
    armature.l_arm_upp.rotateY(1.2);

    armature.r_arm_upp.rotateX(1.2);
    armature.r_arm_upp.rotateY(-1.2);

    armature.l_arm_lower.rotateY(-1.8);
    armature.l_arm_lower.rotateZ(.9);
    armature.l_arm_lower.rotateX(-.6);

    armature.r_arm_lower.rotateY(1.8);
    armature.r_arm_lower.rotateZ(-.9);
    armature.r_arm_lower.rotateX(-.6);
    /*armature.l_arm_lower.rotateX(-1.2);
    armature.r_arm_lower.rotateX(-1.2);
    armature.l_arm_lower.rotateY(-1.5);
    armature.r_arm_lower.rotateY(1.5);

    
    

    

    armature.r_leg_upp.rotateX(1);
    armature.l_leg_upp.rotateX(1);

    armature.r_leg_lower.rotateX(-1.75);
    armature.l_leg_lower.rotateX(-1.75);*/

    for (let b of armature.bones) {
        let rest = null;
        if (b.parent instanceof THREE.Bone) {

            /*if (b.name == "J_Bip_L_Shoulder" || b.name == "J_Bip_R_Shoulder") {
                rest = new Rest(b);
                rest.setPainfulness(0.8);
                rest.setStockholmRate(0.8);
                b.getConstraint().setLimitState(false);
            }*/
            if (b.name == "J_Bip_L_UpperArm" || b.name == "J_Bip_R_UpperArm") {
                rest = new Rest(b);
                rest.setPainfulness(0.5);
                rest.setStockholmRate(0.5);
                b.getConstraint().setLimitState(false);
            }
            if (b.name == "J_Bip_L_LowerArm" || b.name == "J_Bip_R_LowerArm") {
                rest = new Rest(b);
                rest.setPainfulness(0.5);
                rest.setStockholmRate(0.4);
                b.getConstraint().setLimitState(false);
            }

        }
    }
    //window.larm_rest = new Rest(l_arm_upp);
    //window.rarm_rest = new Rest(r_arm_upp);
    /*armature.r_leg_lower.rotateX(1.75);
    armature.l_leg_lower.rotateX(1.75);

    armature.r_leg_upp.rotateX(-1);
    armature.l_leg_upp.rotateX(-1);

    armature.l_arm_upp.rotateZ(-1.2);
    armature.r_arm_upp.rotateZ(1.2);

    armature.l_arm_lower.rotateY(1.5);
    armature.r_arm_lower.rotateY(-1.5);*/

}

export function initWolfGirlShortcuts(armature) {
    armature.l_arm_upp = armature.bonetags["J_Bip_L_UpperArm"];
    armature.r_arm_upp = armature.bonetags["J_Bip_R_UpperArm"];
    armature.l_arm_lower = armature.bonetags["J_Bip_L_LowerArm"];
    armature.r_arm_lower = armature.bonetags["J_Bip_R_LowerArm"];
    armature.l_leg_upp = armature.bonetags["J_Bip_L_UpperLeg"];
    armature.r_leg_upp = armature.bonetags["J_Bip_R_UpperLeg"];
    armature.l_leg_lower = armature.bonetags["J_Bip_L_LowerLeg"];
    armature.r_leg_lower = armature.bonetags["J_Bip_R_LowerLeg"];
    armature.c_head = armature.bonetags["J_Bip_C_Head"];
    armature.c_hips = armature.bonetags["J_Bip_C_Hips"];
    armature.c_chest = armature.bonetags["J_Bip_C_Chest"];
    armature.r_foot = armature.bonetags["J_Bip_R_Foot"];
    armature.l_foot = armature.bonetags["J_Bip_L_Foot"];
    armature.upper_chest = armature.bonetags["J_Bip_C_UpperChest"];
    armature.inferOrientations(armature.rootBone);
    //snip the root bone (make it shorter).
    armature.c_hips.parent.position.y = armature.c_hips.position.y - 0.01;
    armature.c_hips.position.y = 0.01;
    armature.makeBoneMesh(armature.c_hips.parent, armature.c_hips.parent.boneRadius);
}

export function initWolfgirlInteractivePins(armature) {
    armature.hip_pin = new IKPin(armature.bonetags["J_Bip_C_Hips"]);
    armature.hip_pin.setInfluenceOpacity(0);
    armature.hip_pin.setPinWeight(0.8);

    armature.head_pin = new IKPin(armature.c_head);
    //armature.c_uuperchest_pin = new IKPin(armature.upper_chest);
    armature.r_hand_pin = new IKPin(armature.bonetags["J_Bip_R_Hand"]).setPSTPriorities(1, 0.16, 0.04).setPinWeight(1);
    armature.l_hand_pin = new IKPin(armature.bonetags["J_Bip_L_Hand"]).setPSTPriorities(1, 0.16, 0.04).setPinWeight(1);
    armature.r_foot_pin = new IKPin(armature.bonetags["J_Bip_R_Foot"]).setPSTPriorities(1, 0.16, 0.04).setPinWeight(1);
    armature.l_foot_pin = new IKPin(armature.bonetags["J_Bip_L_Foot"]).setPSTPriorities(1, 0.16, 0.04).setPinWeight(1);
}


export function initWolfGirlCosmeticPins(armature) {

    let J_Sec_Hair2_03_pin = new IKPin(armature.bonetags["J_Sec_Hair2_03"]);
    J_Sec_Hair2_03_pin.setPinWeight(0.171);
    J_Sec_Hair2_03_pin.setInfluenceOpacity(1 - 0.829);
    armature.c_chest.attach(J_Sec_Hair2_03_pin.target_threejs);
    J_Sec_Hair2_03_pin.ensure();

    let J_Sec_Hair3_03_pin = new IKPin(armature.bonetags["J_Sec_Hair3_03"]);
    J_Sec_Hair3_03_pin.setPinWeight(0.340);
    J_Sec_Hair3_03_pin.setInfluenceOpacity(1 - 0.521);
    armature.upper_chest.attach(J_Sec_Hair3_03_pin.target_threejs);
    J_Sec_Hair3_03_pin.ensure();

    let J_Sec_Hair3_04_pin = new IKPin(armature.bonetags["J_Sec_Hair3_04"]);
    J_Sec_Hair3_04_pin.setPinWeight(0.7500);
    J_Sec_Hair3_04_pin.setInfluenceOpacity(1 - 1);
    armature.bonetags["J_Bip_L_Shoulder"].attach(J_Sec_Hair3_04_pin.target_threejs);
    J_Sec_Hair3_04_pin.ensure();

    let J_Sec_Hair3_05_pin = new IKPin(armature.bonetags["J_Sec_Hair3_05"]);
    J_Sec_Hair3_05_pin.setPinWeight(0.75);
    J_Sec_Hair3_05_pin.setInfluenceOpacity(1 - 1);
    armature.bonetags["J_Bip_R_Shoulder"].attach(J_Sec_Hair3_05_pin.target_threejs);
    J_Sec_Hair3_05_pin.ensure();

    let J_Sec_Hair3_09_pin = new IKPin(armature.bonetags["J_Sec_Hair3_09"]);
    J_Sec_Hair3_09_pin.setPinWeight(0.75);
    J_Sec_Hair3_09_pin.setInfluenceOpacity(1 - 1);
    armature.bonetags["J_Bip_R_Shoulder"].attach(J_Sec_Hair3_09_pin.target_threejs);
    J_Sec_Hair3_09_pin.ensure();

    let J_Sec_Hair3_10_pin = new IKPin(armature.bonetags["J_Sec_Hair3_10"]);
    J_Sec_Hair3_10_pin.setPinWeight(0.75);
    J_Sec_Hair3_10_pin.setInfluenceOpacity(1 - 1);
    armature.bonetags["J_Bip_L_Shoulder"].attach(J_Sec_Hair3_10_pin.target_threejs);
    J_Sec_Hair3_10_pin.ensure();

    let J_Sec_Hair2_19_pin = new IKPin(armature.bonetags["J_Sec_Hair2_19"]);
    J_Sec_Hair2_19_pin.setPinWeight(0.614);
    J_Sec_Hair2_19_pin.setInfluenceOpacity(1 - 0.923);
    armature.bonetags["J_Bip_C_Neck"].attach(J_Sec_Hair2_19_pin.target_threejs);
    J_Sec_Hair2_19_pin.ensure();

    let J_Sec_Hair3_19_pin = new IKPin(armature.bonetags["J_Sec_Hair3_19"]);
    J_Sec_Hair3_19_pin.setPinWeight(0.784);
    J_Sec_Hair3_19_pin.setInfluenceOpacity(1 - 0.832);
    armature.bonetags["J_Bip_C_Neck"].attach(J_Sec_Hair3_19_pin.target_threejs);
    J_Sec_Hair3_19_pin.ensure();

    let J_Sec_Hair4_19_pin = new IKPin(armature.bonetags["J_Sec_Hair4_19"]);
    J_Sec_Hair4_19_pin.setPSTPriorities(1,0,0);
    armature.bonetags["J_Bip_C_UpperChest"].attach(J_Sec_Hair4_19_pin.target_threejs);
    J_Sec_Hair4_19_pin.ensure();

    let J_Sec_Hair2_20_pin = new IKPin(armature.bonetags["J_Sec_Hair2_20"]);
    J_Sec_Hair2_20_pin.setPinWeight(0.614);
    J_Sec_Hair2_20_pin.setInfluenceOpacity(1 - 0.923);
    armature.bonetags["J_Bip_C_Neck"].attach(J_Sec_Hair2_20_pin.target_threejs);
    J_Sec_Hair2_20_pin.ensure();

    let J_Sec_Hair3_20_pin = new IKPin(armature.bonetags["J_Sec_Hair3_20"]);
    J_Sec_Hair3_20_pin.setPinWeight(0.784);
    J_Sec_Hair3_20_pin.setInfluenceOpacity(1 - 0.832);
    armature.bonetags["J_Bip_C_Neck"].attach(J_Sec_Hair3_20_pin.target_threejs);
    J_Sec_Hair3_20_pin.ensure();

    let J_Sec_Hair4_20_pin = new IKPin(armature.bonetags["J_Sec_Hair4_20"]);
    J_Sec_Hair4_20_pin.setPSTPriorities(1,0,0);
    armature.bonetags["J_Bip_C_UpperChest"].attach(J_Sec_Hair4_20_pin.target_threejs);
    J_Sec_Hair4_20_pin.ensure();

    let J_Sec_Hair5_04_pin = new IKPin(armature.bonetags["J_Sec_Hair5_04"]);
    J_Sec_Hair5_04_pin.setPSTPriorities(1,0,0);
    armature.c_chest.attach(J_Sec_Hair5_04_pin.target_threejs);
    J_Sec_Hair5_04_pin.ensure();

    let J_Sec_Hair6_10_pin = new IKPin(armature.bonetags["J_Sec_Hair6_10"]);
    J_Sec_Hair6_10_pin.setPSTPriorities(1,0,0);
    armature.c_chest.attach(J_Sec_Hair6_10_pin.target_threejs);
    J_Sec_Hair6_10_pin.ensure();

    let J_Sec_Hair6_09_pin = new IKPin(armature.bonetags["J_Sec_Hair6_09"]);
    J_Sec_Hair6_09_pin.setPSTPriorities(1,0,0);
    armature.c_chest.attach(J_Sec_Hair6_09_pin.target_threejs);
    J_Sec_Hair6_09_pin.ensure();

    let J_Sec_Hair5_05_pin = new IKPin(armature.bonetags["J_Sec_Hair5_05"]);
    J_Sec_Hair5_05_pin.setPSTPriorities(1,0,0);
    armature.c_chest.attach(J_Sec_Hair5_05_pin.target_threejs);
    J_Sec_Hair5_05_pin.ensure();

    for (let b of armature.bones) {
        if (b.name.indexOf("J_Sec") != -1) {
            b.setIKKickIn(0.8);
            b.setStiffness(-0.5);
        }
    }
    armature.regenerateShadowSkeleton(true);

}

export function addElbowSuggestions(armature) {
    let J_Bip_L_LowerArm_pin = new IKPin(armature.bonetags["J_Bip_L_LowerArm"]);
    J_Bip_L_LowerArm_pin.setPinWeight(0.0131);
    J_Bip_L_LowerArm_pin.setPSTPriorities(1, 0.0000, 0.0305);
    J_Bip_L_LowerArm_pin.setInfluenceOpacity(1 - 1.0000);
    J_Bip_L_LowerArm_pin.alignToBone();

    J_Bip_L_LowerArm_pin.target_threejs.updateMatrix();
    armature.bonetags['J_Bip_C_Spine'].add(J_Bip_L_LowerArm_pin.target_threejs);
    J_Bip_L_LowerArm_pin.target_threejs.position.set(-0.52270832661406373, -0.1282534469002838, 0.06779664647059912);
    J_Bip_L_LowerArm_pin.target_threejs.quaternion.set(0.697580754957137, 0.25904645982379604, -0.6365929026040323, -0.2025475211409958);
    J_Bip_L_LowerArm_pin.target_threejs.scale.set(1, 1, 1);
    J_Bip_L_LowerArm_pin.targetNode.ensure().mimic();

    let J_Bip_R_LowerArm_pin = new IKPin(armature.bonetags["J_Bip_R_LowerArm"]);
    J_Bip_R_LowerArm_pin.setPinWeight(0.0131);
    J_Bip_R_LowerArm_pin.setPSTPriorities(1, 0.0000, 0.0305);
    J_Bip_R_LowerArm_pin.setInfluenceOpacity(1 - 1.0000);
    J_Bip_R_LowerArm_pin.alignToBone();

    J_Bip_R_LowerArm_pin.target_threejs.updateMatrix();
    armature.bonetags['J_Bip_C_Spine'].add(J_Bip_R_LowerArm_pin.target_threejs);
    J_Bip_R_LowerArm_pin.target_threejs.position.set(0.52270832661406373, -0.1282534469002838, 0.06779664647059912);
    J_Bip_R_LowerArm_pin.target_threejs.quaternion.set(0.697580754957137, 0.25904645982379604, -0.6365929026040323, -0.2025475211409958);
    J_Bip_R_LowerArm_pin.target_threejs.scale.set(1, 1, 1);
    J_Bip_R_LowerArm_pin.targetNode.ensure().mimic();
}


export function initWolfGirl(armature, useLimiting = true, useRest = false, withRootRest = false) {
    initWolfGirlShortcuts(armature);
    initWolfgirlInteractivePins(armature);
    if (useRest) {
        initWolfGirlRestConstraints(armature, withRootRest);
    }
    if (useLimiting) {
        initWolfGirlConstraints(armature, withRootRest && !useRest);
    }
    initWolfGirlCosmeticPins(armature);
}

window.initWolfGirlConstraints = initWolfGirlConstraints;