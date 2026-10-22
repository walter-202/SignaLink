"use client";

import { useEffect, useRef } from "react";
import type { LandmarkFrame, LandmarkPoint } from "../../domain/landmarks";

const HAND_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

const POSE_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24],
];

interface LandmarkOverlayProps {
  video: HTMLVideoElement | null;
  frame: LandmarkFrame | null;
}

function drawConnections(
  context: CanvasRenderingContext2D,
  points: LandmarkPoint[],
  connections: ReadonlyArray<readonly [number, number]>,
  toCanvas: (point: LandmarkPoint) => { x: number; y: number },
  color: string,
  lineWidth: number,
): void {
  context.strokeStyle = color;
  context.lineWidth = lineWidth;
  context.beginPath();
  for (const [fromIndex, toIndex] of connections) {
    const from = points[fromIndex];
    const to = points[toIndex];
    if (!from || !to) continue;
    const start = toCanvas(from);
    const end = toCanvas(to);
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
  }
  context.stroke();
}

function drawPoints(
  context: CanvasRenderingContext2D,
  points: LandmarkPoint[],
  toCanvas: (point: LandmarkPoint) => { x: number; y: number },
  color: string,
  radius: number,
  filterByVisibility = true,
): void {
  context.fillStyle = color;
  for (const point of points) {
    if (filterByVisibility && point.visibility !== undefined && point.visibility < 0.35) continue;
    const position = toCanvas(point);
    context.beginPath();
    context.arc(position.x, position.y, radius, 0, Math.PI * 2);
    context.fill();
  }
}

export function LandmarkOverlay({ video, frame }: LandmarkOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);

    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, width, height);

    if (!video || !frame || video.videoWidth === 0 || video.videoHeight === 0) {
      return;
    }

    const scale = Math.max(width / video.videoWidth, height / video.videoHeight);
    const drawWidth = video.videoWidth * scale;
    const drawHeight = video.videoHeight * scale;
    const offsetX = (width - drawWidth) / 2;
    const offsetY = (height - drawHeight) / 2;

    const toCanvas = (point: LandmarkPoint) => ({
      x: offsetX + (1 - point.x) * drawWidth,
      y: offsetY + point.y * drawHeight,
    });

    if (frame.pose) {
      drawConnections(context, frame.pose, POSE_CONNECTIONS, toCanvas, "rgba(45, 212, 191, 0.58)", 2);
      drawPoints(context, frame.pose, toCanvas, "rgba(153, 246, 228, 0.9)", 2.6);
    }

    if (frame.leftHand) {
      drawConnections(context, frame.leftHand, HAND_CONNECTIONS, toCanvas, "rgba(56, 189, 248, 0.78)", 2);
      drawPoints(context, frame.leftHand, toCanvas, "rgba(186, 230, 253, 0.95)", 2.2, false);
    }

    if (frame.rightHand) {
      drawConnections(context, frame.rightHand, HAND_CONNECTIONS, toCanvas, "rgba(251, 191, 36, 0.8)", 2);
      drawPoints(context, frame.rightHand, toCanvas, "rgba(254, 243, 199, 0.95)", 2.2, false);
    }
  }, [frame, video]);

  return <canvas ref={canvasRef} className="camera-landmark-overlay" aria-hidden="true" />;
}
