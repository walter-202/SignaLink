"use client";

/* eslint-disable react-hooks/immutability -- AnimationAction is a Three.js imperative handle configured in effects. */

import { useAnimations, useGLTF } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  Box3,
  LoopOnce,
  LoopRepeat,
  MathUtils,
  PerspectiveCamera,
  type AnimationAction,
  type AnimationClip,
  type Group,
  Vector3,
} from "three";
import { clone } from "three/addons/utils/SkeletonUtils.js";

interface GltfAvatarProps {
  modelUrl: string;
  animationName: string;
  isPlaying: boolean;
  isLooping: boolean;
  speed: number;
  restartToken?: number;
  onAnimationsLoaded: (animations: AnimationClip[]) => void;
  onClipDurations?: (durations: Record<string, number>) => void;
  onPlaybackEnded: () => void;
  autoFrame?: boolean;
}

function setActionPaused(
  action: AnimationAction | null | undefined,
  paused: boolean,
) {
  if (!action) return;
  action.paused = paused;
}

export default function GltfAvatar({
  modelUrl,
  animationName,
  isPlaying,
  isLooping,
  speed,
  restartToken,
  onAnimationsLoaded,
  onClipDurations,
  onPlaybackEnded,
  autoFrame = false,
}: GltfAvatarProps) {
  const root = useRef<Group>(null);
  const gltf = useGLTF(modelUrl);
  const instance = useMemo(() => clone(gltf.scene), [gltf.scene]);
  const bounds = useMemo(() => new Box3().setFromObject(instance), [instance]);
  const { actions, mixer } = useAnimations(gltf.animations, root);
  const { camera, size } = useThree();
  const action = animationName ? actions[animationName] : undefined;
  const isPlayingRef = useRef(isPlaying);

  useLayoutEffect(() => {
    if (!autoFrame || !(camera instanceof PerspectiveCamera) || size.width <= 0 || size.height <= 0 || bounds.isEmpty()) return;
    const center = bounds.getCenter(new Vector3());
    const dimensions = bounds.getSize(new Vector3());
    camera.fov = 32;
    const halfFovTangent = Math.tan(MathUtils.degToRad(camera.fov / 2));
    const aspect = size.width / size.height;
    const fill = 0.78;
    const verticalDistance = dimensions.y / (2 * halfFovTangent * fill);
    const horizontalDistance = dimensions.x / (2 * halfFovTangent * aspect * fill);
    const distance = Math.max(verticalDistance, horizontalDistance) + dimensions.z / 2;
    camera.position.set(center.x, center.y, center.z + distance);
    camera.lookAt(center);
    camera.updateProjectionMatrix();
  }, [autoFrame, bounds, camera, size.height, size.width]);

  useEffect(() => {
    onAnimationsLoaded(gltf.animations);
    onClipDurations?.(
      Object.fromEntries(
        gltf.animations.map((animation) => [
          animation.name,
          animation.duration,
        ]),
      ),
    );
  }, [gltf.animations, onAnimationsLoaded, onClipDurations]);

  useEffect(() => {
    if (!action) return;
    action.clampWhenFinished = !isLooping;
    action.setLoop(isLooping ? LoopRepeat : LoopOnce, isLooping ? Infinity : 1);
  }, [action, isLooping]);

  useEffect(() => {
    if (!action) return;
    action.reset();
    action.play();
    setActionPaused(action, !isPlayingRef.current);
    return () => {
      action.stop();
    };
  }, [action, restartToken]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
    setActionPaused(action, !isPlaying);
  }, [action, isPlaying]);

  useEffect(() => {
    if (action) action.setEffectiveTimeScale(speed);
  }, [action, speed]);

  useEffect(() => {
    if (!action) return;
    const handleFinished = (event: { action: NonNullable<typeof action> }) => {
      if (event.action === action && !isLooping) onPlaybackEnded();
    };
    mixer.addEventListener("finished", handleFinished);
    return () => mixer.removeEventListener("finished", handleFinished);
  }, [action, isLooping, mixer, onPlaybackEnded]);

  return <primitive ref={root} object={instance} position={[0, 0, 0]} />;
}
