"use client";

import { Canvas } from "@react-three/fiber";
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
  autoFrame?: boolean;
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
      camera={{ position: [0, 1.45, 3.3], fov: 18, near: 0.1, far: 50 }}
      onCreated={({ camera }) => camera.lookAt(0, 1.45, 0)}
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
            autoFrame={props.autoFrame}
          />
        ) : (
          <ProvisionalAvatar />
        )}
      </Suspense>
    </Canvas>
  );
}
