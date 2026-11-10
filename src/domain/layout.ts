export type Vec3 = [number, number, number];
export const factoryLayout: Record<string, Vec3> = {
  "CNC-01": [-2.55, 0, -2.2],
  "CNC-02": [-2.55, 0, 2.2],
  "ARM-01": [0, 0, -2.2],
  "ARM-02": [0, 0, 2.2],
  "QC-01": [1.7, 0, 0],
  "ASRS-01": [6.3, 0, 0],
  "AGV-01": [4, 0, -3.7],
  "AGV-02": [4, 0, 3.7],
};
export const armLengths = {
  upper: 1.65,
  lower: 1.65,
  shoulderHeight: 0.9,
  wristOffset: 0.48,
};
export function cellAnchors(line: string) {
  const sign = line === "A" ? -1 : 1;
  const z = sign * 2.2;
  return {
    base: [0, 0, z] as Vec3,
    clear: [0.75, 1.65, z] as Vec3,
    raw: [0.25, 1.16, z + sign * 1.45] as Vec3,
    rawAbove: [0.25, 1.85, z + sign * 1.45] as Vec3,
    approach: [-0.95, 1.42, z] as Vec3,
    fixture: [-2.4, 1.16, z] as Vec3,
    fixtureFloor: 1.07,
    qc: [1.7, 1.14, 0] as Vec3,
    output: (kind: "good" | "reject", slot = 0): Vec3 => [
      kind === "good" ? 3.7 : 4.6,
      1.14,
      sign * (1.15 + slot * 0.58),
    ],
    agv: [...factoryLayout[`AGV-0${line === "A" ? 1 : 2}`]] as Vec3,
  };
}
export function shelfSlot(index: number): Vec3 {
  return [
    6.15 + (index % 2) * 0.85,
    0.62 + Math.floor((index % 12) / 2) * 0.53,
    -0.2,
  ];
}
