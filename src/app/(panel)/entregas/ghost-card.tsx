export default function GhostCard({ missing }: { missing: string }) {
  return (
    <div className="ventas-tile" role="status">
      <p className="ventas-caption">No conectado: {missing}</p>
    </div>
  );
}
