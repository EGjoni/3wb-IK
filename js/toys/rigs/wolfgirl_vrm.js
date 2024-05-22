import { IKPin } from "../../EWBIK/betterbones/IKpin.js";
import { Rot } from "../../EWBIK/util/Rot.js";
import { Rest, Twist, Kusudama } from "../../EWBIK/betterbones/Constraints/ConstraintStack.js";

export function initWolfGirlConstraints(armature, withRootRest = false) {

    if (withRootRest) {
        //maybeAddRest(armature.c_hips.parent);
        //maybeAddRest(armature.c_hips);
    }



    new Rest(armature.bonetags["Root"],
        "RestConstraint-20_on_bone_Root_on_bone_Root_on_bone_Root", armature.stablePool).setPainfulness(0.9)
        .setStockholmRate(0.9)
        .boneFrameRest.setLocalOrientationTo(
            new Rot(1, 0, 0, 0));

    new Rest(armature.bonetags["J_Bip_C_Hips"],
        "RestConstraint-21_on_bone_J_Bip_C_Hips_on_bone_J_Bip_C_Hips_on_bone_J_Bip_C_Hips", armature.stablePool).setPainfulness(0.9)
        .setStockholmRate(0.9)
        .boneFrameRest.setLocalOrientationTo(
            new Rot(1, 0, 0, 0));

    new Kusudama(armature.bonetags["J_Bip_C_Spine"], "Kusudama for J_Bip_C_Spine", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0, 0.9871905049027117, -0.15954594018629684), 0.41355);

    new Twist(armature.bonetags["J_Bip_C_Spine"], 0.62953, undefined,
        armature.stablePool.any_Vec3(-1.8374118504407591e-16, 0.9996360572455436, -0.026976898535312797),
        0,
        "Twist for J_Bip_C_Spine",
        armature.stablePool).setPainfulness(0.45488).setStockholmRate(0.45281);

    new Rest(armature.bonetags["J_Bip_C_Spine"],
        "RestConstraint-22_on_bone_J_Bip_C_Spine_on_bone_J_Bip_C_Spine_on_bone_J_Bip_C_Spine", armature.stablePool).setPainfulness(0.1)
        .setStockholmRate(0.4)
        .boneFrameRest.setLocalOrientationTo(
            new Rot(1, 0, 0, 0));

    new Kusudama(armature.bonetags["J_Bip_C_Chest"], "Kusudama for J_Bip_C_Chest", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0, 0.9821077424398444, -0.1883198933721875), 0.54056);

    new Twist(armature.bonetags["J_Bip_C_Chest"], 0.88355, undefined,
        armature.stablePool.any_Vec3(2.7599758061079187e-16, 0.990869672460897, 0.1348231886480764),
        0,
        "Twist for J_Bip_C_Chest",
        armature.stablePool).setPainfulness(0.49217).setStockholmRate(0.49839);

    new Rest(armature.bonetags["J_Bip_C_Chest"],
        "RestConstraint-23_on_bone_J_Bip_C_Chest_on_bone_J_Bip_C_Chest_on_bone_J_Bip_C_Chest", armature.stablePool).setPainfulness(0.1)
        .setStockholmRate(0.4)
        .boneFrameRest.setLocalOrientationTo(
            new Rot(1, 0, 0, 0));

    new Kusudama(armature.bonetags["J_Bip_C_UpperChest"], "Kusudama for J_Bip_C_UpperChest", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0, 0.9818358120917213, -0.1897325435822493), 0.47);

    new Twist(armature.bonetags["J_Bip_C_UpperChest"], 1.25046, undefined,
        armature.stablePool.any_Vec3(8.575184161921516e-17, 0.9983219856621792, -0.05790693346676151),
        0,
        "Twist for J_Bip_C_UpperChest",
        armature.stablePool).setPainfulness(0.43831).setStockholmRate(0.45074);

    new Rest(armature.bonetags["J_Bip_C_UpperChest"],
        "RestConstraint-24_on_bone_J_Bip_C_UpperChest_on_bone_J_Bip_C_UpperChest_on_bone_J_Bip_C_UpperChest", armature.stablePool).setPainfulness(0.1)
        .setStockholmRate(0.4)
        .boneFrameRest.setLocalOrientationTo(
            new Rot(1, 0, 0, 0));

    new Kusudama(armature.bonetags["J_Bip_C_Neck"], "Kusudama for J_Bip_C_Neck", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0, 0.9608546364469918, 0.2770530050700032), 0.29679).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0, 0.9201209604131404, -0.39163429141023903), 0.29679);

    new Twist(armature.bonetags["J_Bip_C_Neck"], 1.17924, undefined,
        armature.stablePool.any_Vec3(-3.6617059943902577e-9, 0.9917943192012539, -0.12784376558957108),
        0,
        "Twist for J_Bip_C_Neck",
        armature.stablePool).setPainfulness(0.49838).setStockholmRate(0.49424);

    new Rest(armature.bonetags["J_Bip_C_Neck"],
        "Rest-0_on_bone_J_Bip_C_Neck", armature.stablePool).setPainfulness(0.1)
        .setStockholmRate(0.4)
        .boneFrameRest.setLocalOrientationTo(
            new Rot(1, 0, 0, 0));
    new Kusudama(armature.bonetags["J_Bip_C_Head"], "Kusudama for J_Bip_C_Head", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(-0.018392802028835187, 0.9641547540193116, 0.2647023141861232), 0.42043).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0, 0.6875803622534374, -0.7261082876840285), 0.45947);

    new Twist(armature.bonetags["J_Bip_C_Head"], 1.10115, undefined,
        armature.stablePool.any_Vec3(0.007645192954748522, 0.9822417165366233, -0.18746402673545787),
        0.00010349085919183357,
        "Twist for J_Bip_C_Head",
        armature.stablePool).setPainfulness(0.49631).setStockholmRate(0.5046);

    new Rest(armature.bonetags["J_Bip_C_Head"],
        "Rest-0_on_bone_J_Bip_C_Head", armature.stablePool).setPainfulness(0.1)
        .setStockholmRate(0.4)
        .boneFrameRest.setLocalOrientationTo(
            new Rot(1, 0, 0, 0));



    new Rest(armature.bonetags["J_Adj_L_FaceEye"],
        "RestConstraint-34_on_bone_J_Adj_L_FaceEye_on_bone_J_Adj_L_FaceEye", armature.stablePool).setPainfulness(0.1)
        .setStockholmRate(0.4)
        .boneFrameRest.setLocalOrientationTo(
            new Rot(1, 0, 0, 0));

    new Rest(armature.bonetags["J_Adj_R_FaceEye"],
        "RestConstraint-35_on_bone_J_Adj_R_FaceEye_on_bone_J_Adj_R_FaceEye", armature.stablePool).setPainfulness(0.1)
        .setStockholmRate(0.4)
        .boneFrameRest.setLocalOrientationTo(
            new Rot(1, 0, 0, 0));




    new Kusudama(armature.bonetags["J_Bip_L_Shoulder"], "Kusudama for J_Bip_L_Shoulder", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(-0.9887169584774933, 0.14950459401107696, 0.009335544365375602), 0.15363);

    new Twist(armature.bonetags["J_Bip_L_Shoulder"], 0.45043, undefined,
        armature.stablePool.any_Vec3(-0.9891449243957722, -0.14694324939268918, 0),
        0.22664,
        "Twist for J_Bip_L_Shoulder",
        armature.stablePool).setPainfulness(0.51702).setStockholmRate(0.81944);

    new Rest(armature.bonetags["J_Bip_L_Shoulder"],
        "Rest for J_Bip_L_Shoulder_on_bone_J_Bip_L_Shoulder_on_bone_J_Bip_L_Shoulder_on_bone_J_Bip_L_Shoulder_on_bone_J_Bip_L_Shoulder_on_bone_J_Bip_L_Shoulder_on_bone_J_Bip_L_Shoulder_on_bone_J_Bip_L_Shoulder", armature.stablePool).setPainfulness(0.1)
        .setStockholmRate(0.4)
        .boneFrameRest.setLocalOrientationTo(
            new Rot(1, 0, 0, 0));

    new Rest(armature.bonetags["J_Bip_L_Shoulder"],
        "Rest for J_Bip_L_Shoulder_on_bone_J_Bip_L_Shoulder_on_bone_J_Bip_L_Shoulder_on_bone_J_Bip_L_Shoulder_on_bone_J_Bip_L_Shoulder_on_bone_J_Bip_L_Shoulder", armature.stablePool).setPainfulness(0.28711)
        .setStockholmRate(0.67859)
        .boneFrameRest.setLocalOrientationTo(
            new Rot(0.9873585018598956, -0.1177795313196127, 0.057993903285121336, 0.08881372635393113));

    new Kusudama(armature.bonetags["J_Bip_L_UpperArm"], "Kusudama for J_Bip_L_UpperArm", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(-0.8818903087900336, -0.46920755734992337, -0.045975552067786085), 0.71977).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(-0.633000068026495, -0.4616463756763912, -0.6214447181393572), 0.72627);

    new Twist(armature.bonetags["J_Bip_L_UpperArm"], 1.5327, undefined,
        armature.stablePool.any_Vec3(-0.9563317980984719, -0.26527536604056023, 0.12271296638004671),
        6.72741,
        "Twist for J_Bip_L_UpperArm",
        armature.stablePool).setPainfulness(0.5).setStockholmRate(0.50252);

    new Rest(armature.bonetags["J_Bip_L_UpperArm"],
        "Rest for J_Bip_L_UpperArm_on_bone_J_Bip_L_UpperArm_on_bone_J_Bip_L_UpperArm_on_bone_J_Bip_L_UpperArm_on_bone_J_Bip_L_UpperArm_on_bone_J_Bip_L_UpperArm_on_bone_J_Bip_L_UpperArm_on_bone_J_Bip_L_UpperArm", armature.stablePool).setPainfulness(0.45903)
        .setStockholmRate(0.71587)
        .boneFrameRest.setLocalOrientationTo(
            new Rot(0.8702136624445326, 0.09546997586629778, -0.1862771066532519, -0.4459983239204546));

    new Kusudama(armature.bonetags["J_Bip_L_LowerArm"], "Kusudama for J_Bip_L_LowerArm", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0.9257816911140081, -0.014427358105869148, -0.3777831543837976), 0.05602).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(-0.9902320916692672, 0.09729680563184018, -0.09986859487420553), 0.01698);

    new Twist(armature.bonetags["J_Bip_L_LowerArm"], 3.24855, undefined,
        armature.stablePool.any_Vec3(-0.07741133240954882, 0.12128719168409094, -0.9895943122047364),
        0.87086,
        "Twist for J_Bip_L_LowerArm",
        armature.stablePool).setPainfulness(0.5046).setStockholmRate(0.64959);

    new Rest(armature.bonetags["J_Bip_L_LowerArm"],
        "RestConstraint-98_on_bone_J_Bip_L_LowerArm_on_bone_J_Bip_L_LowerArm_on_bone_J_Bip_L_LowerArm", armature.stablePool).setPainfulness(0.62059)
        .setStockholmRate(0.4901)
        .boneFrameRest.setLocalOrientationTo(
            new Rot(0.7161995335107301, -0.051754852885883745, 0.6939209936547838, 0.05341645782837727));

    new Kusudama(armature.bonetags["J_Bip_L_Hand"], "Kusudama for J_Bip_L_Hand", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(-0.5742044866868236, 0.8186183370537373, -0.012378437223462383), 0.92159).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(-0.9114921689234482, -0.4108478087334832, -0.019649530531882186), 0.92159);

    new Twist(armature.bonetags["J_Bip_L_Hand"], 0.15, undefined,
        armature.stablePool.any_Vec3(-0.9967892166712119, 0.07747109648849682, 0.020235778632455986),
        0,
        "Twist for J_Bip_L_Hand",
        armature.stablePool).setPainfulness(0).setStockholmRate(0);

    new Kusudama(armature.bonetags["J_Bip_R_Shoulder"], "Kusudama for J_Bip_R_Shoulder", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0.9887169584774933, 0.14950459401107696, 0.009335544365375602), 0.14713);

    new Twist(armature.bonetags["J_Bip_R_Shoulder"], 0.5155, undefined,
        armature.stablePool.any_Vec3(0.9891449243957722, -0.14694324939268918, 0),
        6.164445307179586,
        "Twist for J_Bip_R_Shoulder",
        armature.stablePool).setPainfulness(0.33889).setStockholmRate(0.49424);

    new Rest(armature.bonetags["J_Bip_R_Shoulder"],
        "Rest for J_Bip_R_Shoulder_on_bone_J_Bip_R_Shoulder_on_bone_J_Bip_R_Shoulder_on_bone_J_Bip_R_Shoulder_on_bone_J_Bip_R_Shoulder_on_bone_J_Bip_R_Shoulder_on_bone_J_Bip_R_Shoulder_on_bone_J_Bip_R_Shoulder", armature.stablePool).setPainfulness(0.38032)
        .setStockholmRate(0.4)
        .boneFrameRest.setLocalOrientationTo(
            new Rot(1, 0, 0, 0));

    new Kusudama(armature.bonetags["J_Bip_R_UpperArm"], "Kusudama for J_Bip_R_UpperArm", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0.8818903087900336, -0.46920755734992337, -0.045975552067786085), 0.71326).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0.633000068026495, -0.4616463756763912, -0.6214447181393572), 0.72627);

    new Twist(armature.bonetags["J_Bip_R_UpperArm"], 1.5327, undefined,
        armature.stablePool.any_Vec3(0.9563317980984719, -0.26527536604056023, 0.12271296638004671),
        5.71227,
        "Twist for J_Bip_R_UpperArm",
        armature.stablePool).setPainfulness(0.5046).setStockholmRate(0.50252);

    new Rest(armature.bonetags["J_Bip_R_UpperArm"],
        "Rest for J_Bip_R_UpperArm_on_bone_J_Bip_R_UpperArm_on_bone_J_Bip_R_UpperArm_on_bone_J_Bip_R_UpperArm_on_bone_J_Bip_R_UpperArm_on_bone_J_Bip_R_UpperArm_on_bone_J_Bip_R_UpperArm_on_bone_J_Bip_R_UpperArm_on_bone_J_Bip_R_UpperArm", armature.stablePool).setPainfulness(0.38552)
        .setStockholmRate(0.95612)
        .boneFrameRest.setLocalOrientationTo(
            new Rot(0.887140244059648, 0.045135881683963604, 0.08886162776621863, 0.4506090885292232));

    new Kusudama(armature.bonetags["J_Bip_R_LowerArm"], "Kusudama for J_Bip_R_LowerArm", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(-0.9049854569666724, -0.027879610563159678, -0.42452803204696576), 0.0537).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0.9754563253153163, 0.1360869016860864, -0.17310491787300947), 0.0537);

    new Twist(armature.bonetags["J_Bip_R_LowerArm"], 3.14444, undefined,
        armature.stablePool.any_Vec3(-0.21921163611638084, 0.1516335665446693, -0.963822348821671),
        4.38479,
        "Twist for J_Bip_R_LowerArm",
        armature.stablePool).setPainfulness(0).setStockholmRate(0);

    new Rest(armature.bonetags["J_Bip_R_LowerArm"],
        "RestConstraint-115_on_bone_J_Bip_R_LowerArm_on_bone_J_Bip_R_LowerArm_on_bone_J_Bip_R_LowerArm", armature.stablePool).setPainfulness(0.1)
        .setStockholmRate(0.4)
        .boneFrameRest.setLocalOrientationTo(
            new Rot(0.7533184597705757, -0.04373356270548531, -0.6542653000886227, -0.05035464985398665));

    new Kusudama(armature.bonetags["J_Bip_R_Hand"], "Kusudama for J_Bip_R_Hand", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0.5742044866868236, 0.8186183370537373, -0.012378437223462383), 0.92159).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0.9114921689234482, -0.4108478087334832, -0.019649530531882186), 0.92159);


    new Twist(armature.bonetags["J_Bip_R_Hand"], 0.19013, undefined,
        armature.stablePool.any_Vec3(0.990692584285218, 0.13023499039046693, -0.039585991465049444),
        0.27713533983499006,
        "Twist for J_Bip_R_Hand",
        armature.stablePool).setPainfulness(0).setStockholmRate(0);

    new Kusudama(armature.bonetags["J_Bip_L_UpperLeg"], "Kusudama for J_Bip_L_UpperLeg", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(-0.08782953172187863, 0.06163977439690974, -0.9942265896513801), 0.52645).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(-0.3082401189281993, -0.8923245487407538, -0.32976495993015986), 0.90103).parentKusudama
        .addLimitConeAtIndex(2, armature.stablePool.any_Vec3(0, -0.9578262852211515, 0.28734788556634544), 0.74518);

    new Twist(armature.bonetags["J_Bip_L_UpperLeg"], 2.15533, undefined,
        armature.stablePool.any_Vec3(1.9041464198591196e-8, -0.7006945602476732, -0.713461374735395),
        0.0000015108337230249496,
        "Twist for J_Bip_L_UpperLeg",
        armature.stablePool).setPainfulness(0.20425).setStockholmRate(0.19597);

    new Rest(armature.bonetags["J_Bip_L_UpperLeg"],
        "RestConstraint-130_on_bone_J_Bip_L_UpperLeg_on_bone_J_Bip_L_UpperLeg_on_bone_J_Bip_L_UpperLeg", armature.stablePool).setPainfulness(0.3886)
        .setStockholmRate(0.73244)
        .boneFrameRest.setLocalOrientationTo(
            new Rot(0.9228065363014623, -0.36550576337738744, -0.10198190681271031, 0.0665832124491985));

    new Kusudama(armature.bonetags["J_Bip_L_LowerLeg"], "Kusudama for J_Bip_L_LowerLeg", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0, -0.9830241022983888, 0.1834764679746342), 0.1).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0, 0.7518876717414535, 0.6592912323724746), 0.1);

    new Twist(armature.bonetags["J_Bip_L_LowerLeg"], 0.09903, undefined,
        armature.stablePool.any_Vec3(-0.06861806855632575, -0.004293236290407355, 0.9976337648605096),
        0.0143758711844968,
        "Twist for J_Bip_L_LowerLeg",
        armature.stablePool).setPainfulness(0).setStockholmRate(0);

    new Rest(armature.bonetags["J_Bip_L_LowerLeg"],
        "RestConstraint-131_on_bone_J_Bip_L_LowerLeg_on_bone_J_Bip_L_LowerLeg_on_bone_J_Bip_L_LowerLeg", armature.stablePool).setPainfulness(0.50045)
        .setStockholmRate(0.50667)
        .boneFrameRest.setLocalOrientationTo(
            new Rot(0.7267094173664026, 0.6855448860593183, 0.04366668502639754, 0.0038538977289755195));




    new Kusudama(armature.bonetags["J_Bip_L_Foot"], "Kusudama for J_Bip_L_Foot", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0, -0.5256465905493974, -0.8507030397522946), 0.75224);

    new Twist(armature.bonetags["J_Bip_L_Foot"], 1.78672, undefined,
        armature.stablePool.any_Vec3(0, -0.5256465905493974, -0.8507030397522946),
        6.283185277377264,
        "Twist for J_Bip_L_Foot",
        armature.stablePool).setPainfulness(0).setStockholmRate(0);

    new Rest(armature.bonetags["J_Bip_L_Foot"],
        "RestConstraint-153_on_bone_J_Bip_L_Foot_on_bone_J_Bip_L_Foot_on_bone_J_Bip_L_Foot", armature.stablePool).setPainfulness(0.1)
        .setStockholmRate(0.4)
        .boneFrameRest.setLocalOrientationTo(
            new Rot(1, 0, 0, 0));

    new Rest(armature.bonetags["J_Bip_L_ToeBase"],
        "RestConstraint-154_on_bone_J_Bip_L_ToeBase_on_bone_J_Bip_L_ToeBase_on_bone_J_Bip_L_ToeBase", armature.stablePool).setPainfulness(0.1)
        .setStockholmRate(0.4)
        .boneFrameRest.setLocalOrientationTo(
            new Rot(1, 0, 0, 0));

    new Kusudama(armature.bonetags["J_Bip_R_UpperLeg"], "Kusudama for J_Bip_R_UpperLeg", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0.21718263542875807, 0.1711649908859214, -0.9610068931923651), 0.52645).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0.525868809809942, -0.5481112749061199, -0.6504121963723181), 0.90197).parentKusudama
        .addLimitConeAtIndex(2, armature.stablePool.any_Vec3(0, -0.9578262852211515, 0.28734788556634544), 0.74518);

    new Twist(armature.bonetags["J_Bip_R_UpperLeg"], 2.15363, undefined,
        armature.stablePool.any_Vec3(-0.030976654688457717, -0.6471980105473724, -0.7616923145259085),
        0.1169493948046149,
        "Twist for J_Bip_R_UpperLeg",
        armature.stablePool).setPainfulness(1).setStockholmRate(0.99964);

    new Rest(armature.bonetags["J_Bip_R_UpperLeg"],
        "RestConstraint-155_on_bone_J_Bip_R_UpperLeg_on_bone_J_Bip_R_UpperLeg_on_bone_J_Bip_R_UpperLeg", armature.stablePool).setPainfulness(0.28918)
        .setStockholmRate(0.7283)
        .boneFrameRest.setLocalOrientationTo(
            new Rot(0.8106665777175807, -0.5825531361610446, -0.05415434038813138, -0.022778295320843887));

    new Kusudama(armature.bonetags["J_Bip_R_LowerLeg"], "Kusudama for J_Bip_R_LowerLeg", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0, -0.9830241022983888, 0.1834764679746342), 0.1).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0, 0.7518876717414535, 0.6592912323724746), 0.1);

    new Twist(armature.bonetags["J_Bip_R_LowerLeg"], 0.04697, undefined,
        armature.stablePool.any_Vec3(-0.02321969771820345, -0.029932569453454214, 0.9992821858333059),
        0.1931219600387302,
        "Twist for J_Bip_R_LowerLeg",
        armature.stablePool).setPainfulness(0.6268).setStockholmRate(0.90229);

    new Rest(armature.bonetags["J_Bip_R_LowerLeg"],
        "RestConstraint-156_on_bone_J_Bip_R_LowerLeg_on_bone_J_Bip_R_LowerLeg_on_bone_J_Bip_R_LowerLeg", armature.stablePool).setPainfulness(0.40724)
        .setStockholmRate(0.4)
        .boneFrameRest.setLocalOrientationTo(
            new Rot(0.7347597543524271, 0.672945469770224, -0.050679092236806764, 0.06858664381457265));

    new Kusudama(armature.bonetags["J_Bip_R_Foot"], "Kusudama for J_Bip_R_Foot", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0, -0.5256465905493974, -0.8507030397522946), 0.75224);

    new Twist(armature.bonetags["J_Bip_R_Foot"], 1.78672, undefined,
        armature.stablePool.any_Vec3(0, -0.5256465905493974, -0.8507030397522946),
        6.283185277377264,
        "Twist for J_Bip_R_Foot",
        armature.stablePool).setPainfulness(0).setStockholmRate(0);

    new Rest(armature.bonetags["J_Bip_R_Foot"],
        "RestConstraint-178_on_bone_J_Bip_R_Foot_on_bone_J_Bip_R_Foot_on_bone_J_Bip_R_Foot", armature.stablePool).setPainfulness(0.1)
        .setStockholmRate(0.4)
        .boneFrameRest.setLocalOrientationTo(
            new Rot(1, 0, 0, 0));

    new Rest(armature.bonetags["J_Bip_R_ToeBase"],
        "RestConstraint-179_on_bone_J_Bip_R_ToeBase_on_bone_J_Bip_R_ToeBase_on_bone_J_Bip_R_ToeBase", armature.stablePool).setPainfulness(0.1)
        .setStockholmRate(0.4)
        .boneFrameRest.setLocalOrientationTo(
            new Rot(1, 0, 0, 0));







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
                if (!cstack?.getTyped('twist')) {
                    let twistconst = new Twist(b);
                    twistconst.setPainfulness(0.15);
                    twistconst.setStockholmRate(0.5);
                    twistconst.setCurrentAsReference();
                    twistconst.setRange(Math.PI);
                    twistconst.autoGen = true; //to avoid printout;
                }
            } else {
                if (!cstack?.getTyped('rest')) {
                    let restconst = new Rest(b);
                    restconst.setPainfulness(0.15);
                    restconst.setStockholmRate(0.5);
                    restconst.autoGen = true; //to avoid printout;
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
        rootrest.autoGen = true;
    }
}

/**Warning: not to be used in conjunction with initWolfGirlConstraints */
export function initWolfGirlRestConstraints(armature, withRootRest) {
    if (withRootRest) {
        maybeAddRest(armature.c_hips.parent);
        maybeAddRest(armature.c_hips);
    }
    /*armature.l_arm_upp.rotateX(1.2);
    armature.l_arm_upp.rotateY(1.2);

    armature.r_arm_upp.rotateX(1.2);
    armature.r_arm_upp.rotateY(-1.2);

    armature.l_arm_lower.rotateY(-1.8);
    armature.l_arm_lower.rotateZ(.9);
    armature.l_arm_lower.rotateX(-.6);

    armature.r_arm_lower.rotateY(1.8);
    armature.r_arm_lower.rotateZ(-.9);
    armature.r_arm_lower.rotateX(-.6);
    armature.l_arm_lower.rotateX(-1.2);
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
            if (!(b?.getConstraint()?.getTyped('Rest'))) {
                new Rest(b);
            }

            /*if (b.name == "J_Bip_L_Shoulder" || b.name == "J_Bip_R_Shoulder") {
                rest = new Rest(b);
                rest.setPainfulness(0.8);
                rest.setStockholmRate(0.8);
                b.getConstraint().setLimitState(false);
            }*/
            /*if (b.name == "J_Bip_L_UpperArm" || b.name == "J_Bip_R_UpperArm") {
                rest = new Rest(b);
                rest.setPainfulness(0.5);
                rest.setStockholmRate(0.4);
                b.getConstraint().setLimitState(false);
                rest.boneFrameRest.setLocalOrientationTo(new Rot(0.8728142708915317, -0.1757863522710011, 0.006954392086624176, 0.45524283993715364));

            }
            if (b.name == "J_Bip_L_LowerArm" || b.name == "J_Bip_R_LowerArm") {
                rest = new Rest(b);
                rest.setPainfulness(0.5);
                rest.setStockholmRate(0.4);
                b.getConstraint().setLimitState(false);
                rest.boneFrameRest.setLocalOrientationTo(new Rot(0.8728142708915317, -0.1757863522710011, -0.006954392086624176, -0.45524283993715364));
            }*/

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


    //override the autoinferred orientation for the legs because this rig has weird tassles that throw it off
    armature.setInternalOrientationFor(armature.r_leg_lower, armature.r_foot.position);
    armature.setInternalOrientationFor(armature.l_leg_lower, armature.l_foot.position);
}

export function initWolfgirlInteractivePins(armature) {
    /*armature.hip_pin = new IKPin(armature.bonetags["J_Bip_C_Hips"]);
    armature.hip_pin.setInfluenceOpacity(0);
    armature.hip_pin.setPinWeight(0.4);*/

    armature.head_pin = new IKPin(armature.c_head);
    //armature.c_uuperchest_pin = new IKPin(armature.upper_chest);
    armature.r_hand_pin = new IKPin(armature.bonetags["J_Bip_R_Hand"]).setPSTPriorities(1, 0.15, 0.15).setPinWeight(0.67);
    armature.l_hand_pin = new IKPin(armature.bonetags["J_Bip_L_Hand"]).setPSTPriorities(1, 0.15, 0.15).setPinWeight(0.67);
    armature.r_foot_pin = new IKPin(armature.bonetags["J_Bip_R_Foot"]).setPSTPriorities(1, 0.15, 0.15).setPinWeight(1);
    armature.l_foot_pin = new IKPin(armature.bonetags["J_Bip_L_Foot"]).setPSTPriorities(1, 0.15, 0.15).setPinWeight(1);
}


export function initWolfGirlCosmeticPins(armature) {


    let J_Sec_Hair2_03_pin = new IKPin(armature.bonetags["J_Sec_Hair2_03"]);
    J_Sec_Hair2_03_pin.setPinWeight(0.3979);
    J_Sec_Hair2_03_pin.setPSTPriorities(1.0000, 1.0000, 1.0000);
    J_Sec_Hair2_03_pin.setInfluenceOpacity(0.1710);
    J_Sec_Hair2_03_pin.position.set(0.04582132650256773, 0.23167301798401546, 0.18208256649496254);
    J_Sec_Hair2_03_pin.quaternion.set(0.8715965994902453, -0.0663396655762996, -0.48051353693606924, 0.07088834424258306);
    J_Sec_Hair2_03_pin.scale.set(1.0000000000000004, 1.0000000000000087, 1.0000000000000078);
    armature.bonetags['J_Bip_C_Chest'].add(J_Sec_Hair2_03_pin.target_threejs);
    J_Sec_Hair2_03_pin.ensure()

    let J_Sec_Hair3_03_pin = new IKPin(armature.bonetags["J_Sec_Hair3_03"]);
    J_Sec_Hair3_03_pin.setPinWeight(0.3400);
    J_Sec_Hair3_03_pin.setPSTPriorities(1.0000, 1.0000, 1.0000);
    J_Sec_Hair3_03_pin.setInfluenceOpacity(0.4790);
    J_Sec_Hair3_03_pin.position.set(0.011333378118900237, -0.008143988254005051, 0.2238438344209951);
    J_Sec_Hair3_03_pin.quaternion.set(0.7171434906225326, -0.10473975737696223, 0.6881082073662151, -0.03524048861180448);
    J_Sec_Hair3_03_pin.scale.set(0.9999999999999997, 0.9999999999999994, 0.9999999999999996);
    armature.bonetags['J_Bip_C_UpperChest'].add(J_Sec_Hair3_03_pin.target_threejs);
    J_Sec_Hair3_03_pin.ensure()

    let J_Sec_Hair3_04_pin = new IKPin(armature.bonetags["J_Sec_Hair3_04"]);
    J_Sec_Hair3_04_pin.setPinWeight(0.7500);
    J_Sec_Hair3_04_pin.setPSTPriorities(1.0000, 1.0000, 1.0000);
    J_Sec_Hair3_04_pin.setInfluenceOpacity(0.0000);
    J_Sec_Hair3_04_pin.position.set(-0.05061988122500289, -0.10579727558158247, 0.16654487757744554);
    J_Sec_Hair3_04_pin.quaternion.set(0.5098188589949929, 1.6730700181368558e-17, 0.8294803957618506, 0.2281381249589977);
    J_Sec_Hair3_04_pin.scale.set(1.0000000000000004, 1, 1.0000000000000002);
    armature.bonetags['J_Bip_L_Shoulder'].add(J_Sec_Hair3_04_pin.target_threejs);
    J_Sec_Hair3_04_pin.ensure()

    let J_Sec_Hair5_04_pin = new IKPin(armature.bonetags["J_Sec_Hair5_04"]);
    J_Sec_Hair5_04_pin.setPinWeight(1.0000);
    J_Sec_Hair5_04_pin.setPSTPriorities(1.0000, 0.0000, 0.0000);
    J_Sec_Hair5_04_pin.setInfluenceOpacity(1.0000);
    J_Sec_Hair5_04_pin.position.set(-0.09372188124988248, -0.1184443830241613, 0.1429591402);
    J_Sec_Hair5_04_pin.scale.set(1, 1, 1);
    armature.bonetags['J_Bip_C_Chest'].add(J_Sec_Hair5_04_pin.target_threejs);
    J_Sec_Hair5_04_pin.ensure()

    let J_Sec_Hair3_05_pin = new IKPin(armature.bonetags["J_Sec_Hair3_05"]);
    J_Sec_Hair3_05_pin.setPinWeight(0.7500);
    J_Sec_Hair3_05_pin.setPSTPriorities(1.0000, 1.0000, 1.0000);
    J_Sec_Hair3_05_pin.setInfluenceOpacity(0.0000);
    J_Sec_Hair3_05_pin.position.set(0.0902216022388886, -0.07244313991342091, 0.1709931403706243);
    J_Sec_Hair3_05_pin.quaternion.set(-0.41249630861295455, -0.053265075365442255, 0.9007811256347787, -0.12491193228487416);
    J_Sec_Hair3_05_pin.scale.set(1.0000000000000007, 1.0000000000000002, 1.0000000000000002);
    armature.bonetags['J_Bip_R_Shoulder'].add(J_Sec_Hair3_05_pin.target_threejs);
    J_Sec_Hair3_05_pin.ensure()

    let J_Sec_Hair5_05_pin = new IKPin(armature.bonetags["J_Sec_Hair5_05"]);
    J_Sec_Hair5_05_pin.setPinWeight(0.8148);
    J_Sec_Hair5_05_pin.setPSTPriorities(1.0000, 0.0000, 0.0000);
    J_Sec_Hair5_05_pin.setInfluenceOpacity(1.0000);
    J_Sec_Hair5_05_pin.position.set(0.08765133843022893, -0.07433289595344014, 0.13826111746279957);
    J_Sec_Hair5_05_pin.scale.set(1, 1, 1);
    armature.bonetags['J_Bip_C_Chest'].add(J_Sec_Hair5_05_pin.target_threejs);
    J_Sec_Hair5_05_pin.ensure()

    let J_Sec_Hair3_09_pin = new IKPin(armature.bonetags["J_Sec_Hair3_09"]);
    J_Sec_Hair3_09_pin.setPinWeight(0.7500);
    J_Sec_Hair3_09_pin.setPSTPriorities(0.8664, 1.0000, 1.0000);
    J_Sec_Hair3_09_pin.setInfluenceOpacity(0.0000);
    J_Sec_Hair3_09_pin.position.set(0.10887319420350808, -0.06408734906015631, 0.09789194237326947);
    J_Sec_Hair3_09_pin.quaternion.set(0.9787168616055553, -6.203563465697996e-17, 0.14086523521795716, 0.14923233669671612);
    J_Sec_Hair3_09_pin.scale.set(0.9999999999999999, 0.9999999999999942, 0.9999999999999942);
    armature.bonetags['J_Bip_R_Shoulder'].add(J_Sec_Hair3_09_pin.target_threejs);
    J_Sec_Hair3_09_pin.ensure()

    let J_Sec_Hair6_09_pin = new IKPin(armature.bonetags["J_Sec_Hair6_09"]);
    J_Sec_Hair6_09_pin.setPinWeight(1.0000);
    J_Sec_Hair6_09_pin.setPSTPriorities(0.5730, 0.0000, 0.0000);
    J_Sec_Hair6_09_pin.setInfluenceOpacity(1.0000);
    J_Sec_Hair6_09_pin.position.set(0.14297153032610146, -0.1179177958443115, 0.11456163119053168);
    J_Sec_Hair6_09_pin.scale.set(1, 1, 1);
    armature.bonetags['J_Bip_C_Chest'].add(J_Sec_Hair6_09_pin.target_threejs);
    J_Sec_Hair6_09_pin.ensure()

    let J_Sec_Hair3_10_pin = new IKPin(armature.bonetags["J_Sec_Hair3_10"]);
    J_Sec_Hair3_10_pin.setPinWeight(0.7500);
    J_Sec_Hair3_10_pin.setPSTPriorities(0.4362, 1.0000, 1.0000);
    J_Sec_Hair3_10_pin.setInfluenceOpacity(0.0000);
    J_Sec_Hair3_10_pin.position.set(-0.08279265095045013, -0.04509992290833744, 0.10597769756841624);
    J_Sec_Hair3_10_pin.quaternion.set(0.9800133813504017, 7.080407304587855e-18, -0.13343892840140245, 0.1475392312615103);
    J_Sec_Hair3_10_pin.scale.set(1, 0.9999999999999996, 0.9999999999999992);
    armature.bonetags['J_Bip_L_Shoulder'].add(J_Sec_Hair3_10_pin.target_threejs);
    J_Sec_Hair3_10_pin.ensure()

    let J_Sec_Hair6_10_pin = new IKPin(armature.bonetags["J_Sec_Hair6_10"]);
    J_Sec_Hair6_10_pin.setPinWeight(1.0000);
    J_Sec_Hair6_10_pin.setPSTPriorities(0.2561, 0.0000, 0.0000);
    J_Sec_Hair6_10_pin.setInfluenceOpacity(1.0000);
    J_Sec_Hair6_10_pin.position.set(-0.12901493524861032, -0.18109367026739012, 0.12260629998988315);
    J_Sec_Hair6_10_pin.scale.set(1, 1, 1);
    armature.bonetags['J_Bip_C_Chest'].add(J_Sec_Hair6_10_pin.target_threejs);
    J_Sec_Hair6_10_pin.ensure()

    let J_Sec_Hair2_19_pin = new IKPin(armature.bonetags["J_Sec_Hair2_19"]);
    J_Sec_Hair2_19_pin.setPinWeight(0.6140);
    J_Sec_Hair2_19_pin.setPSTPriorities(0.2399, 1.0000, 1.0000);
    J_Sec_Hair2_19_pin.setInfluenceOpacity(0.0770);
    J_Sec_Hair2_19_pin.position.set(0.09277752242610135, 0.04208064, -0.0337802468);
    J_Sec_Hair2_19_pin.quaternion.set(0.9451864176622712, 0, -0.17532242867313974, -0.27547174423325993);
    J_Sec_Hair2_19_pin.scale.set(0.9999999999999997, 0.9999999999999996, 0.9999999999999999);
    armature.bonetags['J_Bip_C_Neck'].add(J_Sec_Hair2_19_pin.target_threejs);
    J_Sec_Hair2_19_pin.ensure()

    let J_Sec_Hair3_19_pin = new IKPin(armature.bonetags["J_Sec_Hair3_19"]);
    J_Sec_Hair3_19_pin.setPinWeight(0.7840);
    J_Sec_Hair3_19_pin.setPSTPriorities(0.0000, 1.0000, 1.0000);
    J_Sec_Hair3_19_pin.setInfluenceOpacity(0.1680);
    J_Sec_Hair3_19_pin.position.set(0.08755368942610135, -0.003792525099999944, -0.0619426219);
    J_Sec_Hair3_19_pin.quaternion.set(0.813021196536502, -3.413880933715949e-17, -0.401481630712433, -0.4216740852635365);
    J_Sec_Hair3_19_pin.scale.set(0.9999999999999998, 0.9999999999999999, 0.9999999999999999);
    armature.bonetags['J_Bip_C_Neck'].add(J_Sec_Hair3_19_pin.target_threejs);
    J_Sec_Hair3_19_pin.ensure()

    let J_Sec_Hair4_19_pin = new IKPin(armature.bonetags["J_Sec_Hair4_19"]);
    J_Sec_Hair4_19_pin.setPinWeight(1.0000);
    J_Sec_Hair4_19_pin.setPSTPriorities(1.0000, 0.0000, 0.0000);
    J_Sec_Hair4_19_pin.setInfluenceOpacity(1.0000);
    J_Sec_Hair4_19_pin.position.set(0.06942750712610143, 0.09232747490000004, -0.060777444400000005);
    J_Sec_Hair4_19_pin.scale.set(1, 1, 1);
    armature.bonetags['J_Bip_C_UpperChest'].add(J_Sec_Hair4_19_pin.target_threejs);
    J_Sec_Hair4_19_pin.ensure()

    let J_Sec_Hair2_20_pin = new IKPin(armature.bonetags["J_Sec_Hair2_20"]);
    J_Sec_Hair2_20_pin.setPinWeight(0.6140);
    J_Sec_Hair2_20_pin.setPSTPriorities(1.0000, 1.0000, 1.0000);
    J_Sec_Hair2_20_pin.setInfluenceOpacity(0.0770);
    J_Sec_Hair2_20_pin.position.set(-0.11270834959325678, 0.06722326885023992, -0.04179823225999365);
    J_Sec_Hair2_20_pin.quaternion.set(0.8981666768078611, 0.023462900394066573, 0.17154972057394322, -0.4041247410738712);
    J_Sec_Hair2_20_pin.scale.set(1, 1.0000000000000004, 1);
    armature.bonetags['J_Bip_C_Neck'].add(J_Sec_Hair2_20_pin.target_threejs);
    J_Sec_Hair2_20_pin.ensure()

    let J_Sec_Hair3_20_pin = new IKPin(armature.bonetags["J_Sec_Hair3_20"]);
    J_Sec_Hair3_20_pin.setPinWeight(0.7840);
    J_Sec_Hair3_20_pin.setPSTPriorities(0.2177, 1.0000, 1.0000);
    J_Sec_Hair3_20_pin.setInfluenceOpacity(0.1680);
    J_Sec_Hair3_20_pin.position.set(-0.08140443345648418, -0.004089394848615821, -0.08761853626479799);
    J_Sec_Hair3_20_pin.quaternion.set(0.8076958500129603, 3.4363895289524574e-17, 0.40961593816151826, -0.4240780554047815);
    J_Sec_Hair3_20_pin.scale.set(0.9999999999999999, 0.9999999999999996, 0.9999999999999998);
    armature.bonetags['J_Bip_C_Neck'].add(J_Sec_Hair3_20_pin.target_threejs);
    J_Sec_Hair3_20_pin.ensure()

    let J_Sec_Hair4_20_pin = new IKPin(armature.bonetags["J_Sec_Hair4_20"]);
    J_Sec_Hair4_20_pin.setPinWeight(1.0000);
    J_Sec_Hair4_20_pin.setPSTPriorities(1.0000, 0.0000, 0.0000);
    J_Sec_Hair4_20_pin.setInfluenceOpacity(1.0000);
    J_Sec_Hair4_20_pin.position.set(-0.06919060667389858, 0.09232735619999999, -0.060777325100000015);
    J_Sec_Hair4_20_pin.scale.set(1, 1, 1);
    armature.bonetags['J_Bip_C_UpperChest'].add(J_Sec_Hair4_20_pin.target_threejs);
    J_Sec_Hair4_20_pin.ensure()

    let J_Sec_Hair5_03_pin = new IKPin(armature.bonetags["J_Sec_Hair5_03"]);
    J_Sec_Hair5_03_pin.setPinWeight(1.0000);
    J_Sec_Hair5_03_pin.setPSTPriorities(1.0000, 0.0000, 0.0000);
    J_Sec_Hair5_03_pin.setInfluenceOpacity(1.0000);
    J_Sec_Hair5_03_pin.position.set(0.0858988723949464, 0.9970577709704906, 0.18851467513119458);
    J_Sec_Hair5_03_pin.quaternion.set(0.09305861401743593, -0.10222604445366827, -0.04764734788856796, 0.9892520712294195);
    J_Sec_Hair5_03_pin.scale.set(1, 1, 1);

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
    J_Bip_L_LowerArm_pin.setInfluenceOpacity(0.0000);
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
    J_Bip_R_LowerArm_pin.setInfluenceOpacity(0.0000);
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
    if (useLimiting) {
        initWolfGirlConstraints(armature, withRootRest && !useRest);
    }
    if (useRest) {
        initWolfGirlRestConstraints(armature, withRootRest);
    }

    initWolfGirlCosmeticPins(armature);
}



export function initSneakPinPose(armature) {


    let J_Bip_C_Head_pin = armature.bonetags["J_Bip_C_Head"].getIKPin();
    J_Bip_C_Head_pin.position.set(0.10867011254862542, 1.2847438278897239, -0.1453701241461245);
    J_Bip_C_Head_pin.quaternion.set(-0.10730163429360107, 0.03198860037722595, -0.007301132585387898, 0.993684951172553);
    J_Bip_C_Head_pin.scale.set(1, 1, 1);


    let J_Bip_L_Hand_pin = armature.bonetags["J_Bip_L_Hand"].getIKPin();
    J_Bip_L_Hand_pin.position.set(-0.16217961482391952, 1.078478229570421, -0.24847863797379025);
    J_Bip_L_Hand_pin.quaternion.set(0.5952263136193989, 0.201912062217785, -0.5627431337166124, -0.5368960049775277);
    J_Bip_L_Hand_pin.scale.set(1, 1, 1);


    let J_Bip_R_Hand_pin = armature.bonetags["J_Bip_R_Hand"].getIKPin();
    J_Bip_R_Hand_pin.position.set(0.44509478774323014, 1.1067012702318006, -0.19655362848000674);
    J_Bip_R_Hand_pin.quaternion.set(-0.3360307706238472, 0.39872656509392707, -0.7399335462492526, 0.42496916901976184);
    J_Bip_R_Hand_pin.scale.set(1, 1, 1);


    let J_Bip_L_Foot_pin = armature.bonetags["J_Bip_L_Foot"].getIKPin();
    J_Bip_L_Foot_pin.position.set(-0.08857216111741731, 0.14474156281077044, 0.2707403325696259);
    J_Bip_L_Foot_pin.quaternion.set(0.8733975585463349, 0, 0, -0.487007910331343);
    J_Bip_L_Foot_pin.scale.set(1, 0.9999999999999997, 0.9999999999999997);


    let J_Bip_R_Foot_pin = armature.bonetags["J_Bip_R_Foot"].getIKPin();
    J_Bip_R_Foot_pin.position.set(0.3112734788240505, 0.14583543445943664, -0.2215502858468573);
    J_Bip_R_Foot_pin.quaternion.set(0.8733975585463349, 0, 0, -0.487007910331343);
    J_Bip_R_Foot_pin.scale.set(1, 0.9999999999999997, 0.9999999999999997);

}

window.initWolfGirlConstraints = initWolfGirlConstraints;