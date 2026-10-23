"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Suspense, useCallback } from "react";
import type { AnimationClip } from "three";
import GltfAvatar from "./GltfAvatar";
import ProvisionalAvatar from "./ProvisionalAvatar";

interface AvatarSceneProps {
  modelUrl: string | null;
  animationName: string;
  isPlaying: boolean;
  isLooping: boolean;
  speed: number;
  restartToken?: number;
  onAnimationsLoaded: (names: string[]) => void;
  onClipDurations?: (durations: Record<string, number>) => void;
  onPlaybackEnded: () => void;
}

function LoadingFigure() {
  return (
    <mesh position={[0, 1.4, 0]}>
      <icosahedronGeometry args={[0.22, 1]} />
      <meshStandardMaterial color="#5aa89b" wireframe />
    </mesh>
  );
}

export default function AvatarScene(props: AvatarSceneProps) {
  const { onAnimationsLoaded } = props;
  const handleAnimationsLoaded = useCallback(
    (animations: AnimationClip[]) => {
      onAnimationsLoaded(animations.map((animation) => animation.name));
    },
    [onAnimationsLoaded],
  );

  return (
    <Canvas
      className="avatar-canvas"
      dpr={[1, 1.5]}
      camera={{ position: [0, 1.55, 4.8], fov: 34, near: 0.1, far: 50 }}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      fallback={
        <p className="scene-state">
          Este dispositivo no puede abrir el visor 3D.
        </p>
      }
    >
      <color attach="background" args={["#edf5f3"]} />
      <ambientLight intensity={1.6} />
      <directionalLight position={[3, 5, 4]} intensity={2.1} />
      <directionalLight
        position={[-3, 2, -2]}
        intensity={0.8}
        color="#a7d6cc"
      />
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.025, 0]}
        receiveShadow
      >
        <circleGeometry args={[2.2, 64]} />
        <meshStandardMaterial color="#dcebe7" roughness={0.92} />
      </mesh>
      <Suspense fallback={<LoadingFigure />}>
        {props.modelUrl ? (
          <GltfAvatar
            key={props.modelUrl}
            modelUrl={props.modelUrl}
            animationName={props.animationName}
            isPlaying={props.isPlaying}
            isLooping={props.isLooping}
            speed={props.speed}
            restartToken={props.restartToken}
            onAnimationsLoaded={handleAnimationsLoaded}
            onClipDurations={props.onClipDurations}
            onPlaybackEnded={props.onPlaybackEnded}
          />
        ) : (
          <ProvisionalAvatar />
        )}
      </Suspense>
      <OrbitControls
        makeDefault
        target={[0, 1.25, 0]}
        minDistance={2.8}
        maxDistance={7}
        minPolarAngle={0.35}
        maxPolarAngle={Math.PI * 0.9}
        enablePan={false}
      />
    </Canvas>
  );
}
