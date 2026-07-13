import type { Proficiencies } from "@/lib/character-view";

export function ProficienciesPanel({
  proficiencies,
  saveProfs,
  skillProfs,
  languages,
}: {
  proficiencies: Proficiencies;
  saveProfs: string[];
  skillProfs: string[];
  languages?: string[];
}) {
  const sections: { label: string; items: string[] }[] = [
    { label: "Languages", items: languages ?? proficiencies.languages },
    { label: "Armor", items: proficiencies.armor },
    { label: "Weapons", items: proficiencies.weapons },
    { label: "Tools", items: proficiencies.tools },
    { label: "Saving Throws", items: saveProfs },
    { label: "Skills", items: skillProfs },
  ];
  const nonEmpty = sections.filter((s) => s.items.length > 0);

  return (
    <div className="card">
      <h3 className="mb-2 font-display text-gold">Proficiencies &amp; Languages</h3>
      {nonEmpty.length === 0 ? (
        <p className="muted text-sm">None recorded. Add proficiencies via Edit mode.</p>
      ) : (
        <div className="space-y-3">
          {nonEmpty.map((s) => (
            <div key={s.label}>
              <div className="mb-1 text-xs uppercase tracking-wide text-[#a9977c]">{s.label}</div>
              <div className="flex flex-wrap gap-1">
                {s.items.map((it, i) => (
                  <span key={`${it}-${i}`} className="chip">{it}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
