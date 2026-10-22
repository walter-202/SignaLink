"use client";

const SKIN = "#c98d70";
const CLOTHING = "#087f73";
const DARK = "#153238";

function Segment({
  position,
  length,
  radius,
  color,
}: {
  position: [number, number, number];
  length: number;
  radius: number;
  color: string;
}) {
  return (
    <mesh position={position} castShadow>
      <capsuleGeometry args={[radius, length, 5, 10]} />
      <meshStandardMaterial color={color} roughness={0.72} />
    </mesh>
  );
}

function Hand({ x }: { x: number }) {
  return (
    <group position={[x, -0.51, 0]}>
      <mesh castShadow>
        <sphereGeometry args={[0.095, 18, 18]} />
        <meshStandardMaterial color={SKIN} roughness={0.72} />
      </mesh>
      {[-0.075, -0.025, 0.025, 0.075].map((offset, index) => (
        <Segment
          key={index}
          position={[offset, -0.115, 0.018]}
          length={0.1}
          radius={0.018}
          color={SKIN}
        />
      ))}
    </group>
  );
}

export default function ProvisionalAvatar() {
  return (
    <group position={[0, -0.1, 0]}>
      <mesh position={[0, 2.35, 0]} castShadow>
        <sphereGeometry args={[0.31, 32, 32]} />
        <meshStandardMaterial color={SKIN} roughness={0.76} />
      </mesh>
      <mesh position={[-0.1, 2.39, 0.27]}>
        <sphereGeometry args={[0.025, 12, 12]} />
        <meshStandardMaterial color={DARK} roughness={0.45} />
      </mesh>
      <mesh position={[0.1, 2.39, 0.27]}>
        <sphereGeometry args={[0.025, 12, 12]} />
        <meshStandardMaterial color={DARK} roughness={0.45} />
      </mesh>
      <Segment position={[0, 1.98, 0]} length={0.16} radius={0.105} color={SKIN} />
      <mesh position={[0, 1.35, 0]} castShadow>
        <capsuleGeometry args={[0.34, 0.66, 8, 20]} />
        <meshStandardMaterial color={CLOTHING} roughness={0.82} />
      </mesh>
      <Segment position={[-0.17, 0.62, 0]} length={0.8} radius={0.16} color={DARK} />
      <Segment position={[0.17, 0.62, 0]} length={0.8} radius={0.16} color={DARK} />
      <group position={[-0.39, 1.64, 0]} rotation={[0, 0, -0.08]}>
        <Segment position={[0, -0.28, 0]} length={0.45} radius={0.11} color={CLOTHING} />
        <group position={[0, -0.55, 0]}>
          <Segment position={[0, -0.2, 0]} length={0.34} radius={0.09} color={SKIN} />
          <Hand x={0} />
        </group>
      </group>
      <group position={[0.39, 1.64, 0]} rotation={[0, 0, 0.08]}>
        <Segment position={[0, -0.28, 0]} length={0.45} radius={0.11} color={CLOTHING} />
        <group position={[0, -0.55, 0]}>
          <Segment position={[0, -0.2, 0]} length={0.34} radius={0.09} color={SKIN} />
          <Hand x={0} />
        </group>
      </group>
      <mesh position={[0, 0.08, 0.08]} castShadow>
        <boxGeometry args={[0.58, 0.16, 0.4]} />
        <meshStandardMaterial color={DARK} roughness={0.82} />
      </mesh>
    </group>
  );
}
