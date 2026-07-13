"use client";
// Speed & Defenses (SPEC-PLAYER §11) — stub, being implemented.
export interface DefensesData {
  resistances: string[];
  immunities: string[];
  vulnerabilities: string[];
  conditionImmunities: string[];
  speeds: { fly?: number; swim?: number; climb?: number; burrow?: number };
}

export function SpeedDefensesPanel(_props: {
  defenses: DefensesData;
  walkingSpeed: number;
  ac: number;
  acBreakdown?: string;
  canEdit: boolean;
  onSave: (d: DefensesData) => void;
}) {
  return null;
}
