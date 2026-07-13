"use client";
import { useState } from "react";

interface DescriptionCharacter {
  personality?: string | null;
  ideals?: string | null;
  bonds?: string | null;
  flaws?: string | null;
  backstory?: string | null;
  notes?: string | null;
}

const FIELDS: { key: keyof DescriptionCharacter; label: string; rows: number }[] = [
  { key: "personality", label: "Personality Traits", rows: 3 },
  { key: "ideals", label: "Ideals", rows: 2 },
  { key: "bonds", label: "Bonds", rows: 2 },
  { key: "flaws", label: "Flaws", rows: 2 },
  { key: "backstory", label: "Backstory", rows: 5 },
  { key: "notes", label: "Notes", rows: 3 },
];

export function DescriptionTab({
  character,
  canEdit,
  onSave,
}: {
  character: DescriptionCharacter;
  canEdit: boolean;
  onSave: (field: string, value: string) => void;
}) {
  return (
    <div className="card">
      <h3 className="mb-2 font-display text-gold">Description &amp; Notes</h3>
      <div className="space-y-3">
        {FIELDS.map((f) => (
          <DescriptionField
            key={f.key}
            field={f.key}
            label={f.label}
            rows={f.rows}
            value={character[f.key] ?? ""}
            canEdit={canEdit}
            onSave={onSave}
          />
        ))}
      </div>
    </div>
  );
}

function DescriptionField({
  field,
  label,
  rows,
  value,
  canEdit,
  onSave,
}: {
  field: string;
  label: string;
  rows: number;
  value: string;
  canEdit: boolean;
  onSave: (field: string, value: string) => void;
}) {
  const [local, setLocal] = useState(value);

  if (!canEdit) {
    return (
      <div>
        <div className="label">{label}</div>
        {value ? (
          <p className="whitespace-pre-wrap text-sm">{value}</p>
        ) : (
          <p className="muted text-sm">—</p>
        )}
      </div>
    );
  }

  return (
    <div>
      <label className="label">{label}</label>
      <textarea
        className="input"
        rows={rows}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => { if (local !== value) onSave(field, local); }}
      />
    </div>
  );
}
