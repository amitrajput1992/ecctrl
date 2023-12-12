import React, {type RefObject, useMemo, useRef} from "react";
import {CapsuleCollider, RapierRigidBody, RigidBody} from "@react-three/rapier";
import type {EcctrlProps} from "./types";
import * as THREE from "three";
import {useFrame} from "@react-three/fiber";
import {useKeyboardControls} from "@react-three/drei";
import {useFollowCam} from "../../src/hooks/useFollowCam";

// Retrieve current moving direction of the character
const getMovingDirection = (
  forward: boolean,
  backward: boolean,
  leftward: boolean,
  rightward: boolean,
  pivot: THREE.Object3D)
  : number | null => {
  if (!forward && !backward && !leftward && !rightward) return null;
  if (forward && leftward) return pivot.rotation.y + Math.PI / 4;
  if (forward && rightward) return pivot.rotation.y - Math.PI / 4;
  if (backward && leftward) return pivot.rotation.y - Math.PI / 4 + Math.PI;
  if (backward && rightward) return pivot.rotation.y + Math.PI / 4 + Math.PI;
  if (backward) return pivot.rotation.y + Math.PI;
  if (leftward) return pivot.rotation.y + Math.PI / 2;
  if (rightward) return pivot.rotation.y - Math.PI / 2;
  if (forward) return pivot.rotation.y;
};

const Controller = React.forwardRef((p: EcctrlProps, ref) => {
  const {
    children,
    debug = false,
    capsuleHalfHeight = 0.35,
    capsuleRadius = 0.3,
    floatHeight = 0.3,
    characterInitDir = 0, // in rad
    followLight = false,
    // Follow camera setups
    camInitDis = -5,
    camMaxDis = -7,
    camMinDis = -0.7,
    camInitDir = { x: 0, y: 0, z: 0 }, // in rad
    camTargetPos = { x: 0, y: 0, z: 0 },
    camMoveSpeed = 1,
    camZoomSpeed = 1,
    camCollision = true,
    camCollisionOffset = 0.7,
    // Follow light setups
    followLightPos = { x: 20, y: 30, z: 10 },
    // Base control setups
    maxVelLimit = 2.5,
    turnVelMultiplier = 0.2,
    turnSpeed = 15,
    sprintMult = 2,
    jumpVel = 4,
    jumpForceToGroundMult = 5,
    slopJumpMult = 0.25,
    sprintJumpMult = 1.2,
    airDragMultiplier = 0.2,
    dragDampingC = 0.15,
    accDeltaTime = 8,
    rejectVelMult = 4,
    moveImpulsePointY = 0.5,
    camFollowMult = 11,
    fallingGravityScale = 2.5,
    fallingMaxVel = -20,
    wakeUpDelay = 200,
    // Floating Ray setups
    rayOriginOffest = { x: 0, y: -capsuleHalfHeight, z: 0 },
    rayHitForgiveness = 0.1,
    rayLength = capsuleRadius + 2,
    rayDir = { x: 0, y: -1, z: 0 },
    floatingDis = capsuleRadius + floatHeight,
    springK = 1.2,
    dampingC = 0.08,
    // Slope Ray setups
    showSlopeRayOrigin = false,
    slopeMaxAngle = 1, // in rad
    slopeRayOriginOffest = capsuleRadius - 0.03,
    slopeRayLength = capsuleRadius + 3,
    slopeRayDir = { x: 0, y: -1, z: 0 },
    slopeUpExtraForce = 0.1,
    slopeDownExtraForce = 0.2,
    // AutoBalance Force setups
    autoBalance = true,
    autoBalanceSpringK = 0.3,
    autoBalanceDampingC = 0.03,
    autoBalanceSpringOnY = 0.3,
    autoBalanceDampingOnY = 0.02,
    // Animation temporary setups
    animated = false,
    // Other rigibody props from parent
    ...props
  } = p;
  const characterRef = ref as RefObject<RapierRigidBody> || useRef<RapierRigidBody>()
  const characterModelRef = useRef<THREE.Group>();
  const slopeRayOriginRef = useRef<THREE.Mesh>();
  const [subscribeKeys, getKeys] = useKeyboardControls();

  const currentPos = useMemo(() => new THREE.Vector3(), []);
  const pivotPosition = useMemo(() => new THREE.Vector3(), []);
  const modelEuler = useMemo(() => new THREE.Euler(), []);
  const modelQuat = useMemo(() => new THREE.Quaternion(), []);

  /**
   * Follow camera initial setups from props
   */
  const cameraSetups = {
    camInitDis,
    camMaxDis,
    camMinDis,
    camMoveSpeed,
    camZoomSpeed,
    camCollisionOffset
  };

  /**
   * Load camera pivot and character move preset
   */
  const { pivot, cameraCollisionDetect } =
    useFollowCam(cameraSetups);

  useFrame((state, delta) => {

    if(!characterRef.current) {
      return;
    }

    currentPos.copy(characterRef.current.translation() as THREE.Vector3);

    /**
     * Getting all the useful keys from useKeyboardControls
     */
    const keys = getKeys();
    const { forward, backward, leftward, rightward, jump, run } = keys;

    modelEuler.y = ((movingDirection) => movingDirection === null ? modelEuler.y : movingDirection)
    (getMovingDirection(forward, backward, leftward, rightward, pivot))

    const speed = 150;
    const linvelY = characterRef.current.linvel().y;

    const nbOfKeysPressed = Object.values(keys).filter((key) => key).length;

    // Reduce speed value if it's diagonal movement to always keep the same speed
    const normalizedSpeed =
      nbOfKeysPressed == 1 ? speed * delta : Math.sqrt(2) * (speed / 2) * delta;

    const runSpeed = run? normalizedSpeed * sprintMult: 1;

    const impulse = {
      x: leftward ? -runSpeed : rightward ? runSpeed : 0,
      y: jump? (run? sprintJumpMult * jumpVel: jumpVel): linvelY,
      z: forward ? -runSpeed : backward ? runSpeed : 0
    };

    // Set model currennt linear velocity
    characterRef.current?.setLinvel(impulse, true);

    /**
     * Camera collision detect
     */
    camCollision && cameraCollisionDetect(delta);

    // Rotate character model
    modelQuat.setFromEuler(modelEuler);
    characterModelRef.current.quaternion.rotateTowards(
      modelQuat,
      delta * turnSpeed
    );

    /**
     *  Camera movement
     */
    pivotPosition.set(
      currentPos.x + camTargetPos.x,
      currentPos.y + (camTargetPos.y || (capsuleHalfHeight + capsuleRadius / 2)),
      currentPos.z + camTargetPos.z
    );
    pivot.position.lerp(pivotPosition, 1 - Math.exp(-camFollowMult * delta));
    state.camera.lookAt(pivot.position);

  });

  return (
    <RigidBody
      colliders={false}
      ref={characterRef}
      position={props.position || [0, 5, 0]}
      friction={props.friction || -0.5}
      lockRotations={true}
      {...props}

    >
      <CapsuleCollider
        name="character-capsule-collider"
        args={[capsuleHalfHeight, capsuleRadius]}
      />
      <group ref={characterModelRef} userData={{ camExcludeCollision: true }}>
        {/* This mesh is used for positioning the slope ray origin */}
        <mesh
          position={[
            rayOriginOffest.x,
            rayOriginOffest.y,
            rayOriginOffest.z + slopeRayOriginOffest,
          ]}
          ref={slopeRayOriginRef}
          visible={showSlopeRayOrigin}
          userData={{ camExcludeCollision: true }} // this won't be collide by camera ray
        >
          <boxGeometry args={[0.15, 0.15, 0.15]} />
        </mesh>
        {/* Character model */}
        {children}
      </group>
    </RigidBody>
  );
});

export default Controller;