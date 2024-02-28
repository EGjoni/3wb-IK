Work In Progress three.js port of the Everything Will Be IK, with improvements for armature agnosticism. Java library.


Completed list: 
- Multiple end-effectors.
- Async solving / solve request queing.
- Decoupling of Bone transformation from physical Bone direction.
- Naive integration of QScene for hierarchal lazy transform updates.
  -- API-like integration between QScene representation and three.js representation (not sure if I should keep it this way. Or make a three.js version of QScene for easier efficient scenegraph management)
- EWBIK wrapper for three.js bones
  - Modification of the Bone prototype to support the required properties for Bone constraints.

TODO List:
- Kusudamas.
- Resource pooling and runtime optimizations.
