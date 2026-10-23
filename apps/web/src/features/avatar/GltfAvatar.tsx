"use client";

/* eslint-disable react-hooks/immutability -- AnimationAction is a Three.js imperative handle configured in effects. */

import { useAnimations, useGLTF } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import {
  LoopOnce,
  LoopRepeat,
  type AnimationAction,
  type AnimationClip,
  type Group,
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
}: GltfAvatarProps) {
  const root = useRef<Group>(null);
  const gltf = useGLTF(modelUrl);
  const instance = useMemo(() => clone(gltf.scene), [gltf.scene]);
  const { actions, mixer } = useAnimations(gltf.animations, root);
  const action = animationName ? actions[animationName] : undefined;
  const isPlayingRef = useRef(isPlaying);

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
