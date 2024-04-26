import { IKPin } from "../../EWBIK/betterbones/IKpin.js";
import { Rest, Twist, Kusudama } from "../../EWBIK/betterbones/Constraints/ConstraintStack.js";

export function initWolfGirlConstraints(armature, withRootRest = false) {

    //override the autoinferred orientation for the legs because this rig has weird tassles that throw it off
    armature.setInternalOrientationFor(armature.r_leg_lower, armature.r_foot.position);
    armature.setInternalOrientationFor(armature.l_leg_lower, armature.l_foot.position);

    if (withRootRest) {
        maybeAddRest(armature.c_hips.parent);
        maybeAddRest(armature.c_hips);
    }

    /*new Kusudama(armature.bonetags["J_Bip_L_UpperLeg"], (cnstrt, bone) => bone == window.contextBone, "Kusudama for J_Bip_L_UpperLeg", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(-0.2505336783387944, -0.2645716928861982, -0.9312543666159987), 0.48411).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(-0.3143631992559614, -0.7667395103803937, -0.5597198425776874), 0.69579).parentKusudama
        .addLimitConeAtIndex(2, armature.stablePool.any_Vec3(0, -0.9578262852211515, 0.28734788556634544), 0.45589);
    new Twist(armature.bonetags["J_Bip_L_UpperLeg"], 0.70009, undefined,
        armature.stablePool.any_Vec3(1.9041464198590058e-8, -0.9996624984362763, 0.025978630066681115),
        0, (cnstrt, bone) => bone == window.contextBone,
        "Twist for J_Bip_L_UpperLeg", armature.stablePool);


    new Kusudama(armature.bonetags["J_Bip_L_LowerLeg"], (t, b) => b == window.contextBone, "Kusudama for J_Bip_L_LowerLeg", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0, -0.8984406832782645, 0.055822952043333464), 0.1).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0, 0.7518876717414535, 0.6592912323724746), 0.1);
    new Twist(armature.bonetags["J_Bip_L_LowerLeg"], 0.34729, undefined,
        armature.stablePool.any_Vec3(0, -0.9987182064357158, 0.050615651075934326),
        0, (cnstrt, bone) => bone == window.contextBone,
        "Twist for J_Bip_L_LowerLeg", armature.stablePool);

    new Kusudama(armature.bonetags["J_Bip_L_Foot"], (t, b) => b == window.contextBone, "Kusudama for J_Bip_L_Foot", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0, -0.5256465905493974, -0.8507030397522946), 0.75224);
    new Twist(armature.bonetags["J_Bip_L_Foot"], 1.78672, undefined,
        armature.stablePool.any_Vec3(0, -0.5256465905493974, -0.8507030397522946),
        6.19399, (cnstrt, bone) => bone == window.contextBone,
        "Twist for J_Bip_L_Foot", armature.stablePool);

    new Kusudama(armature.bonetags["J_Bip_R_UpperLeg"], (cnstrt, bone) => bone == window.contextBone, "Kusudama for J_Bip_R_UpperLeg", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0.2505336783387944, -0.2645716928861982, -0.9312543666159987), 0.48411).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0.3143631992559614, -0.7667395103803937, -0.5597198425776874), 0.69579).parentKusudama
        .addLimitConeAtIndex(2, armature.stablePool.any_Vec3(0, -0.9578262852211515, 0.28734788556634544), 0.45589);
    new Twist(armature.bonetags["J_Bip_R_UpperLeg"], 0.70009, undefined,
        armature.stablePool.any_Vec3(-1.9041464198590058e-8, -0.9996624984362763, 0.025978630066681115),
        0, (cnstrt, bone) => bone == window.contextBone,
        "Twist for J_Bip_R_UpperLeg", armature.stablePool);


    new Kusudama(armature.bonetags["J_Bip_R_LowerLeg"], (t, b) => b == window.contextBone, "Kusudama for J_Bip_R_LowerLeg", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0, -0.8984406832782645, 0.055822952043333464), 0.1).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0, 0.7518876717414535, 0.6592912323724746), 0.1);
    new Twist(armature.bonetags["J_Bip_R_LowerLeg"], 0.34729, undefined,
        armature.stablePool.any_Vec3(0, -0.9987182064357158, 0.050615651075934326),
        0, (cnstrt, bone) => bone == window.contextBone,
        "Twist for J_Bip_R_LowerLeg", armature.stablePool);

    new Kusudama(armature.bonetags["J_Bip_R_Foot"], (t, b) => b == window.contextBone, "Kusudama for J_Bip_R_Foot", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0, -0.5256465905493974, -0.8507030397522946), 0.75224);
    new Twist(armature.bonetags["J_Bip_R_Foot"], 1.78672, undefined,
        armature.stablePool.any_Vec3(0, -0.5256465905493974, -0.8507030397522946),
        6.19399, (cnstrt, bone) => bone == window.contextBone,
        "Twist for J_Bip_R_Foot", armature.stablePool);*/

    new Kusudama(armature.bonetags["J_Bip_R_Shoulder"], (t, b) => b == window.contextBone, "Kusudama for J_Bip_R_Shoulder", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0.9887169584774933, 0.14950459401107696, 0.009335544365375602), 0.4);
    new Twist(armature.bonetags["J_Bip_R_Shoulder"], 0.29084, undefined,
        armature.stablePool.any_Vec3(0.9891449243957722, -0.14694324939268918, 0),
        0, (cnstrt, bone) => bone == window.contextBone,
        "Kusudama for J_Bip_R_Shoulder", armature.stablePool);

    new Kusudama(armature.bonetags["J_Bip_R_LowerArm"], (t, b) => b == window.contextBone, "Kusudama for J_Bip_R_LowerArm", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(-0.9600705258759669, 0.1644617183058307, -0.22631157406579597), 0.05).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0.9291499514145903, 0.10022203406467751, -0.35585939874366557), 0.05);
    new Twist(armature.bonetags["J_Bip_R_LowerArm"], 3, undefined,
        armature.stablePool.any_Vec3(0.5218281678275412, 0.3762160660809324, -0.7656088001612293),
        1.28, (cnstrt, bone) => bone == window.contextBone,
        "Kusudama for J_Bip_R_LowerArm", armature.stablePool);

    new Kusudama(armature.bonetags["J_Bip_R_UpperArm"], (t, b) => b == window.contextBone, "Kusudama for J_Bip_R_UpperArm", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0.9916964094100271, -0.11207984022434514, -0.06305823481945402), 0.92).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0.8036982717311892, -0.011728159802487127, -0.5949214555585861), 0.82986);
    new Twist(armature.bonetags["J_Bip_R_UpperArm"], 1.43, undefined,
        armature.stablePool.any_Vec3(0.9936739704965505, -0.11230334081233606, -3.443753094947278e-8),
        (2 * Math.PI) - 5.9, (cnstrt, bone) => bone == window.contextBone,
        "Kusudama for J_Bip_R_UpperArm", armature.stablePool);

    new Kusudama(armature.bonetags["J_Bip_R_Hand"], (t, b) => b == window.contextBone, "Kusudama for J_Bip_R_Hand", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0.5742044866868236, 0.8186183370537373, -0.012378437223462383), 0.92159).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0.9114921689234482, -0.4108478087334832, -0.019649530531882186), 0.92159);
    new Twist(armature.bonetags["J_Bip_R_Hand"], 0.40374, undefined,
        armature.stablePool.any_Vec3(0.9911502251594227, -0.013045098600207283, 0.13210244724809925),
        6.168005471576302, (cnstrt, bone) => bone == window.contextBone,
        "Kusudama for J_Bip_R_Hand", armature.stablePool);

    new Kusudama(armature.bonetags["J_Bip_L_Shoulder"], (t, b) => b == window.contextBone, "Kusudama for J_Bip_L_Shoulder", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(-0.9887169584774933, 0.14950459401107696, 0.009335544365375602), 0.4);
    new Twist(armature.bonetags["J_Bip_L_Shoulder"], 0.29084, undefined,
        armature.stablePool.any_Vec3(-0.9891449243957722, -0.14694324939268918, 0),
        0, (cnstrt, bone) => bone == window.contextBone,
        "Kusudama for J_Bip_L_Shoulder", armature.stablePool);

    new Kusudama(armature.bonetags["J_Bip_L_LowerArm"], (t, b) => b == window.contextBone, "Kusudama for J_Bip_L_LowerArm", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0.9600705258759669, 0.1644617183058307, -0.22631157406579597), 0.05).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(-0.9291499514145903, 0.10022203406467751, -0.35585939874366557), 0.05);
        /* .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0.9600705258759669, 0.1644617183058307, -0.22631157406579597), 0.05).parentKusudama
            .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(-0.3616076970101984, 0.4690285947008103, -0.8057617829209597), 0.05).parentKusudama
            .addLimitConeAtIndex(2, armature.stablePool.any_Vec3(-0.9349187578396995, 0.1704254837133108, -0.31125884845343377), 0.05);*/

    new Twist(armature.bonetags["J_Bip_L_LowerArm"], 3, undefined,
        armature.stablePool.any_Vec3(-0.5218281678275412, 0.3762160660809324, -0.7656088001612293),
        4.94507, (cnstrt, bone) => bone == window.contextBone,
        "Kusudama for J_Bip_L_LowerArm", armature.stablePool);

    new Kusudama(armature.bonetags["J_Bip_L_UpperArm"], (t, b) => b == window.contextBone, "Kusudama for J_Bip_L_UpperArm", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(-0.9916964094100271, -0.11207984022434514, -0.06305823481945402), 0.92).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(-0.8036982717311892, -0.011728159802487127, -0.5949214555585861), 0.82986);
    new Twist(armature.bonetags["J_Bip_L_UpperArm"], 1.43, undefined,
        armature.stablePool.any_Vec3(-0.9936739704965505, -0.11230334081233606, -3.443753094947278e-8),
        5.9, (cnstrt, bone) => bone == window.contextBone,
        "Kusudama for J_Bip_L_UpperArm", armature.stablePool);

    new Kusudama(armature.bonetags["J_Bip_L_Hand"], (t, b) => b == window.contextBone, "Kusudama for J_Bip_L_Hand", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(-0.5742044866868236, 0.8186183370537373, -0.012378437223462383), 0.92159).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(-0.9114921689234482, -0.4108478087334832, -0.019649530531882186), 0.92159);
    new Twist(armature.bonetags["J_Bip_L_Hand"], 0.40374, undefined,
        armature.stablePool.any_Vec3(-0.9911502251594227, -0.013045098600207283, 0.13210244724809925),
        6.583, (cnstrt, bone) => bone == window.contextBone,
        "Kusudama for J_Bip_L_Hand", armature.stablePool);

    new Kusudama(armature.bonetags["J_Bip_C_Spine"], (t, b) => b == window.contextBone, "Kusudama for J_Bip_C_Spine", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0, 0.99, -0.16), 0.41355);
    new Twist(armature.bonetags["J_Bip_C_Spine"], 0.62953, undefined,
        armature.stablePool.any_Vec3(-1.8374118504407587e-16, 0.9996360572455434, -0.02697689853531279),
        0, (cnstrt, bone) => bone == window.contextBone,
        "Kusudama for J_Bip_C_Spine", armature.stablePool);

    new Kusudama(armature.bonetags["J_Bip_C_Chest"], (t, b) => b == window.contextBone, "Kusudama for J_Bip_C_Chest", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0, 0.990869672460897, -0.19), 0.54056);
    new Twist(armature.bonetags["J_Bip_C_Chest"], 0.88355, undefined,
        armature.stablePool.any_Vec3(2.759975806107918e-16, 0.9908696724608967, 0.13482318864807638),
        0, (cnstrt, bone) => bone == window.contextBone,
        "Kusudama for J_Bip_C_Chest", armature.stablePool);

    new Kusudama(armature.bonetags["J_Bip_C_UpperChest"], (t, b) => b == window.contextBone, "Kusudama for J_Bip_C_UpperChest", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0, 0.983219856621792, -0.19), 0.47);
    new Twist(armature.bonetags["J_Bip_C_UpperChest"], 1.25046, undefined,
        armature.stablePool.any_Vec3(8.575184161921518e-17, 0.9983219856621794, -0.057906933466761526),
        0, (cnstrt, bone) => bone == window.contextBone,
        "Kusudama for J_Bip_C_UpperChest", armature.stablePool);

    new Kusudama(armature.bonetags["J_Bip_C_Neck"], (t, b) => b == window.contextBone, "Kusudama for J_Bip_C_Neck", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(-3.661705994390258e-9, 0.9917943192012539, -0.12784376558957108), 0.49117);
    new Twist(armature.bonetags["J_Bip_C_Neck"], 1.21177, undefined,
        armature.stablePool.any_Vec3(-3.6617059943902597e-9, 0.9917943192012544, -0.12784376558957114),
        0, (cnstrt, bone) => bone == window.contextBone,
        "Kusudama for J_Bip_C_Neck", armature.stablePool);


    new Kusudama(armature.bonetags["J_Bip_C_Head"], (t, b) => b == window.contextBone, "Kusudama for J_Bip_C_Head", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0.007645192954748523, 0.9768661054817858, -0.21371514449269452), 0.8);
    new Twist(armature.bonetags["J_Bip_C_Head"], 1.3, undefined,
        armature.stablePool.any_Vec3(0.007645192954748521, 0.9768661054817855, -0.21371514449269446),
        0, (cnstrt, bone) => bone == window.contextBone,
        "Kusudama for J_Bip_C_Head", armature.stablePool);


    new Kusudama(armature.bonetags["J_Bip_L_UpperLeg"], (cnstrt, bone) => bone == window.contextBone, "Kusudama for J_Bip_L_UpperLeg", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(-0.2505336783387944, -0.2645716928861982, -0.9312543666159987), 0.48411).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(-0.3143631992559614, -0.7667395103803937, -0.5597198425776874), 0.69579).parentKusudama
        .addLimitConeAtIndex(2, armature.stablePool.any_Vec3(0, -0.9578262852211515, 0.28734788556634544), 0.45589);
    new Twist(armature.bonetags["J_Bip_L_UpperLeg"], 0.70009, undefined,
        armature.stablePool.any_Vec3(1.9041464198590058e-8, -0.9996624984362763, 0.025978630066681115),
        0, (cnstrt, bone) => bone == window.contextBone,
        "Twist for J_Bip_L_UpperLeg", armature.stablePool);


    new Kusudama(armature.bonetags["J_Bip_L_LowerLeg"], (t, b) => b == window.contextBone, "Kusudama for J_Bip_L_LowerLeg", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0, -0.8884406832782645, 0.165822952043333464), 0.1).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0, 0.7518876717414535, 0.6592912323724746), 0.1);
    new Twist(armature.bonetags["J_Bip_L_LowerLeg"], 0.34729, undefined,
        armature.stablePool.any_Vec3(0, -0.9987182064357158, 0.050615651075934326),
        0, (cnstrt, bone) => bone == window.contextBone,
        "Twist for J_Bip_L_LowerLeg", armature.stablePool);

    new Kusudama(armature.bonetags["J_Bip_L_Foot"], (t, b) => b == window.contextBone, "Kusudama for J_Bip_L_Foot", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0, -0.5256465905493974, -0.8507030397522946), 0.75224);
    new Twist(armature.bonetags["J_Bip_L_Foot"], 1.78672, undefined,
        armature.stablePool.any_Vec3(0, -0.5256465905493974, -0.8507030397522946),
        6.19399, (cnstrt, bone) => bone == window.contextBone,
        "Twist for J_Bip_L_Foot", armature.stablePool);

    new Kusudama(armature.bonetags["J_Bip_R_UpperLeg"], (cnstrt, bone) => bone == window.contextBone, "Kusudama for J_Bip_R_UpperLeg", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0.2505336783387944, -0.2645716928861982, -0.9312543666159987), 0.48411).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0.3143631992559614, -0.7667395103803937, -0.5597198425776874), 0.69579).parentKusudama
        .addLimitConeAtIndex(2, armature.stablePool.any_Vec3(0, -0.9578262852211515, 0.28734788556634544), 0.45589);
    new Twist(armature.bonetags["J_Bip_R_UpperLeg"], 0.70009, undefined,
        armature.stablePool.any_Vec3(-1.9041464198590058e-8, -0.9996624984362763, 0.025978630066681115),
        0, (cnstrt, bone) => bone == window.contextBone,
        "Twist for J_Bip_R_UpperLeg", armature.stablePool);


    new Kusudama(armature.bonetags["J_Bip_R_LowerLeg"], (t, b) => b == window.contextBone, "Kusudama for J_Bip_R_LowerLeg", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0, -0.8884406832782645, 0.165822952043333464), 0.1).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0, 0.7518876717414535, 0.6592912323724746), 0.1);
    new Twist(armature.bonetags["J_Bip_R_LowerLeg"], 0.34729, undefined,
        armature.stablePool.any_Vec3(0, -0.9987182064357158, 0.050615651075934326),
        0, (cnstrt, bone) => bone == window.contextBone,
        "Twist for J_Bip_R_LowerLeg", armature.stablePool);

    new Kusudama(armature.bonetags["J_Bip_R_Foot"], (t, b) => b == window.contextBone, "Kusudama for J_Bip_R_Foot", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0, -0.5256465905493974, -0.8507030397522946), 0.75224);
    new Twist(armature.bonetags["J_Bip_R_Foot"], 1.78672, undefined,
        armature.stablePool.any_Vec3(0, -0.5256465905493974, -0.8507030397522946),
        6.19399, (cnstrt, bone) => bone == window.contextBone,
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
        if (b.name.indexOf("J_Sec") != -1) {let twistconst = new Twist(b);
            if(b.parent != armature.c_head) {
                let twistconst = new Twist(b);
                twistconst.setPainfulness(0.15);
                twistconst.setStockholmRate(0.5);
                twistconst.setCurrentAsReference();
                twistconst.setRange(Math.PI);
            } else {
                let restconst = new Rest(b);
                restconst.setPainfulness(0.15);
                restconst.setStockholmRate(0.5);
            }
            b.setStiffness(-5);
        }
    }
}


function maybeAddRest(bone) {
    let existingConstraints = bone.getConstraint()?.getReturnfulledArray();
    existingConstraints = existingConstraints == null ? [] : existingConstraints;
    let do_it = true;
    for(let r of existingConstraints) {
        if(r instanceof Rest) {
            do_it = false;
            break;
        }
    }
    if(do_it) {
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
    armature.hip_pin.setDepthFalloff(0.8);
    armature.hip_pin.setPinWeight(0.2);
    armature.head_pin = new IKPin(armature.c_head);
    //armature.c_uuperchest_pin = new IKPin(armature.upper_chest);
    armature.r_hand_pin = new IKPin(armature.bonetags["J_Bip_R_Hand"]).setTargetPriorities(0.16, 0, 0);
    armature.l_hand_pin = new IKPin(armature.bonetags["J_Bip_L_Hand"]).setTargetPriorities(0.16, 0, 0);
    armature.r_foot_pin = new IKPin(armature.bonetags["J_Bip_R_Foot"]);
    armature.l_foot_pin = new IKPin(armature.bonetags["J_Bip_L_Foot"]);
}

export function initWolfGirlCosmeticPins(armature) {

    let J_Sec_Hair2_03_pin = new IKPin(armature.bonetags["J_Sec_Hair2_03"]);
    J_Sec_Hair2_03_pin.setPinWeight(0.171);
    J_Sec_Hair2_03_pin.setXPriority(0.300);
    J_Sec_Hair2_03_pin.setYPriority(0.553);
    J_Sec_Hair2_03_pin.setZPriority(0.000);
    J_Sec_Hair2_03_pin.setDepthFalloff(0.829);
    armature.c_chest.attach(J_Sec_Hair2_03_pin.target_threejs);
    J_Sec_Hair2_03_pin.ensure();

    let J_Sec_Hair3_03_pin = new IKPin(armature.bonetags["J_Sec_Hair3_03"]);
    J_Sec_Hair3_03_pin.setPinWeight(0.340);
    J_Sec_Hair3_03_pin.setXPriority(0.107);
    J_Sec_Hair3_03_pin.setYPriority(0.433);
    J_Sec_Hair3_03_pin.setZPriority(0.000);
    J_Sec_Hair3_03_pin.setDepthFalloff(0.521);
    armature.upper_chest.attach(J_Sec_Hair3_03_pin.target_threejs);
    J_Sec_Hair3_03_pin.ensure();

    let J_Sec_Hair3_04_pin = new IKPin(armature.bonetags["J_Sec_Hair3_04"]);
    J_Sec_Hair3_04_pin.setPinWeight(0.7500);
    J_Sec_Hair3_04_pin.setXPriority(0.5);
    J_Sec_Hair3_04_pin.setYPriority(0.505);
    J_Sec_Hair3_04_pin.setZPriority(0.000);
    J_Sec_Hair3_04_pin.setDepthFalloff(1);
    armature.bonetags["J_Bip_L_Shoulder"].attach(J_Sec_Hair3_04_pin.target_threejs);
    J_Sec_Hair3_04_pin.ensure();

    let J_Sec_Hair3_05_pin = new IKPin(armature.bonetags["J_Sec_Hair3_05"]);
    J_Sec_Hair3_05_pin.setPinWeight(0.75);
    J_Sec_Hair3_05_pin.setXPriority(0.5);
    J_Sec_Hair3_05_pin.setYPriority(0.5);
    J_Sec_Hair3_05_pin.setZPriority(0.0);
    J_Sec_Hair3_05_pin.setDepthFalloff(1);
    armature.bonetags["J_Bip_R_Shoulder"].attach(J_Sec_Hair3_05_pin.target_threejs);
    J_Sec_Hair3_05_pin.ensure();

    let J_Sec_Hair3_09_pin = new IKPin(armature.bonetags["J_Sec_Hair3_09"]);
    J_Sec_Hair3_09_pin.setPinWeight(0.75);
    J_Sec_Hair3_09_pin.setXPriority(0.03);
    J_Sec_Hair3_09_pin.setYPriority(0.5);
    J_Sec_Hair3_09_pin.setZPriority(0.0);
    J_Sec_Hair3_09_pin.setDepthFalloff(1);
    armature.bonetags["J_Bip_R_Shoulder"].attach(J_Sec_Hair3_09_pin.target_threejs);
    J_Sec_Hair3_09_pin.ensure();

    let J_Sec_Hair3_10_pin = new IKPin(armature.bonetags["J_Sec_Hair3_10"]);
    J_Sec_Hair3_10_pin.setPinWeight(0.75);
    J_Sec_Hair3_10_pin.setXPriority(0.030);
    J_Sec_Hair3_10_pin.setYPriority(0.5);
    J_Sec_Hair3_10_pin.setZPriority(0.000);
    J_Sec_Hair3_10_pin.setDepthFalloff(1);
    armature.bonetags["J_Bip_L_Shoulder"].attach(J_Sec_Hair3_10_pin.target_threejs);
    J_Sec_Hair3_10_pin.ensure();

    let J_Sec_Hair2_19_pin = new IKPin(armature.bonetags["J_Sec_Hair2_19"]);
    J_Sec_Hair2_19_pin.setPinWeight(0.614);
    J_Sec_Hair2_19_pin.setXPriority(0.0);
    J_Sec_Hair2_19_pin.setYPriority(0.0);
    J_Sec_Hair2_19_pin.setZPriority(0.000);
    J_Sec_Hair2_19_pin.setDepthFalloff(0.923);
    armature.bonetags["J_Bip_C_Neck"].attach(J_Sec_Hair2_19_pin.target_threejs);
    J_Sec_Hair2_19_pin.ensure();

    let J_Sec_Hair3_19_pin = new IKPin(armature.bonetags["J_Sec_Hair3_19"]);
    J_Sec_Hair3_19_pin.setPinWeight(0.784);
    J_Sec_Hair3_19_pin.setXPriority(0.0);
    J_Sec_Hair3_19_pin.setYPriority(0.0);
    J_Sec_Hair3_19_pin.setZPriority(0.000);
    J_Sec_Hair3_19_pin.setDepthFalloff(0.832);
    armature.bonetags["J_Bip_C_Neck"].attach(J_Sec_Hair3_19_pin.target_threejs);
    J_Sec_Hair3_19_pin.ensure();

    let J_Sec_Hair4_19_pin = new IKPin(armature.bonetags["J_Sec_Hair4_19"]);
    J_Sec_Hair4_19_pin.setPinWeight(0.490);
    J_Sec_Hair4_19_pin.setXPriority(0.210);
    J_Sec_Hair4_19_pin.setYPriority(0.000);
    J_Sec_Hair4_19_pin.setZPriority(0.000);
    J_Sec_Hair4_19_pin.setDepthFalloff(0.000);
    armature.bonetags["J_Bip_C_UpperChest"].attach(J_Sec_Hair4_19_pin.target_threejs);
    J_Sec_Hair4_19_pin.ensure();

    let J_Sec_Hair2_20_pin = new IKPin(armature.bonetags["J_Sec_Hair2_20"]);
    J_Sec_Hair2_20_pin.setPinWeight(0.614);
    J_Sec_Hair2_20_pin.setXPriority(0.0);
    J_Sec_Hair2_20_pin.setYPriority(0.0);
    J_Sec_Hair2_20_pin.setZPriority(0.000);
    J_Sec_Hair2_20_pin.setDepthFalloff(0.923);
    armature.bonetags["J_Bip_C_Neck"].attach(J_Sec_Hair2_20_pin.target_threejs);
    J_Sec_Hair2_20_pin.ensure();

    let J_Sec_Hair3_20_pin = new IKPin(armature.bonetags["J_Sec_Hair3_20"]);
    J_Sec_Hair3_20_pin.setPinWeight(0.784);
    J_Sec_Hair3_20_pin.setXPriority(0.00);
    J_Sec_Hair3_20_pin.setYPriority(0.0);
    J_Sec_Hair3_20_pin.setZPriority(0.000);
    J_Sec_Hair3_20_pin.setDepthFalloff(0.832);
    armature.bonetags["J_Bip_C_Neck"].attach(J_Sec_Hair3_20_pin.target_threejs);
    J_Sec_Hair3_20_pin.ensure();

    let J_Sec_Hair4_20_pin = new IKPin(armature.bonetags["J_Sec_Hair4_20"]);
    J_Sec_Hair4_20_pin.setPinWeight(0.490);
    J_Sec_Hair4_20_pin.setXPriority(0.2101);
    J_Sec_Hair4_20_pin.setYPriority(0.000);
    J_Sec_Hair4_20_pin.setZPriority(0.000);
    J_Sec_Hair4_20_pin.setDepthFalloff(0.000);
    armature.bonetags["J_Bip_C_UpperChest"].attach(J_Sec_Hair4_20_pin.target_threejs);
    J_Sec_Hair4_20_pin.ensure();

    let J_Sec_Hair5_04_pin = new IKPin(armature.bonetags["J_Sec_Hair5_04"]);
    J_Sec_Hair5_04_pin.setPinWeight(0.500);
    J_Sec_Hair5_04_pin.setTargetPriorities(0.03, 0.5, 0);
    J_Sec_Hair5_04_pin.setDepthFalloff(0.000);
    armature.c_chest.attach(J_Sec_Hair5_04_pin.target_threejs);
    J_Sec_Hair5_04_pin.ensure();

    let J_Sec_Hair6_10_pin = new IKPin(armature.bonetags["J_Sec_Hair6_10"]);
    J_Sec_Hair6_10_pin.setPinWeight(0.500);
    J_Sec_Hair6_10_pin.setTargetPriorities(0.03, 0.5, 0);
    J_Sec_Hair6_10_pin.setDepthFalloff(0.000);
    armature.c_chest.attach(J_Sec_Hair6_10_pin.target_threejs);
    J_Sec_Hair6_10_pin.ensure();

    let J_Sec_Hair6_09_pin = new IKPin(armature.bonetags["J_Sec_Hair6_09"]);
    J_Sec_Hair6_09_pin.setPinWeight(0.500);
    J_Sec_Hair6_09_pin.setTargetPriorities(0.03, 0.5, 0);
    J_Sec_Hair6_09_pin.setDepthFalloff(0.000);
    armature.c_chest.attach(J_Sec_Hair6_09_pin.target_threejs);
    J_Sec_Hair6_09_pin.ensure();

    let J_Sec_Hair5_05_pin = new IKPin(armature.bonetags["J_Sec_Hair5_05"]);
    J_Sec_Hair5_05_pin.setPinWeight(0.500);
    J_Sec_Hair5_05_pin.setTargetPriorities(0.03, 0.5, 0);
    J_Sec_Hair5_05_pin.setDepthFalloff(0.000);
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