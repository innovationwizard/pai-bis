export function ProjectPillRow({
  options,
  selectedIds,
  onToggle,
  onSelectAll,
}: {
  options: readonly { id: string; label: string }[];
  selectedIds: readonly string[] | null;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
}) {
  return (
    <div className="op-project-pills" role="group" aria-label="Proyecto">
      <button type="button" aria-pressed={selectedIds === null} onClick={onSelectAll}>
        TODOS
      </button>
      {options.map((option) => {
        const ready = option.id !== "";
        const pressed = ready && (selectedIds === null || selectedIds.includes(option.id));
        return (
          <button
            key={`${option.id}:${option.label}`}
            type="button"
            aria-pressed={pressed}
            disabled={!ready}
            onClick={() => {
              if (ready) onToggle(option.id);
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
