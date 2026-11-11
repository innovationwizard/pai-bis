export const VISTA_SECTIONS = [
  "ventas-totales",
  "objetivos-de-ventas",
  "status-de-ventas",
  "ventas-por-canales",
  "analisis-de-inventario",
  "inventario-general",
  "valor-del-proyecto",
  "tasa-de-conversion",
  "desistimientos",
  "descuentos",
  "subidas-de-precios",
  "ff-y-casos-especiales",
  "promociones",
  "control-referidos",
] as const;

export type VistaSection = (typeof VISTA_SECTIONS)[number];

export function isVistaSection(slug: string): slug is VistaSection {
  return (VISTA_SECTIONS as readonly string[]).includes(slug);
}

export const VENTA_DEFINITION =
  "Venta neta = recibo publicado (Odoo) + Recepción de Promesa Firmada (Pipedrive). Fecha = la más reciente de ambas.";

export const VENTA_RULES: readonly { label: string; text: string }[] = [
  {
    label: "Reservas",
    text: "Actividades de Pipedrive de tipo Reserva, finalizadas, dentro del periodo. Respetan los filtros de proyecto, asesor y torre.",
  },
  {
    label: "Promesas firmadas",
    text: "La última actividad de Pipedrive cuyo asunto es exactamente «Recepción de Promesa Firmada».",
  },
  {
    label: "Recibos publicados",
    text: "El primer recibo de entrada publicado en Odoo que coincide con la unidad: proyecto, torre, unidad y modelo.",
  },
  {
    label: "Venta neta",
    text: "El trato tiene las dos puertas. La fecha es la más reciente de las dos, en hora de Guatemala. Al periodo se le restan los desistimientos.",
  },
  {
    label: "Desistimientos",
    text: "Ventas que ya se habían contado y se cancelaron en el periodo.",
  },
];

export type Choice = { id: string; label: string };

export type StageDeal = {
  key: string;
  unit: string;
  deal: string;
  project: string;
  asesor: string;
  day: string | null;
  gtq: number | null;
};

export type FunnelStage = {
  id: "reservas" | "promesas" | "recibos" | "netas";
  label: string;
  source: string;
  grain: string;
  count: number;
  gtq: number | null;
  priorCount: number | null;
  priorGtq: number | null;
  priorByProject: { id: string; count: number }[] | null;
  conversion: number | null;
  deals: StageDeal[];
  dropped: StageDeal[];
  entered: StageDeal[];
  droppedTitle: string;
  enteredTitle: string;
  footnote: string | null;
  listTotal: number;
  droppedTotal: number;
  enteredTotal: number;
};

export type BlockerRow = {
  id: string;
  unit: string;
  deal: string;
  project: string;
  asesor: string;
  stage: string;
  missing: string;
  severity: "alta" | "media";
  days: number | null;
  gtq: number | null;
};

export type Freshness = {
  label: string;
  stale: boolean;
  note: string | null;
};

export type SaleLine = {
  dealId: string;
  kind: "venta" | "desistimiento";
  day: string;
  projectId: string;
  project: string;
  asesorId: string;
  asesor: string;
  fuenteId: string;
  fuente: string;
  torre: string;
  gtq: number | null;
};

export type TargetCell = {
  asesorId: string;
  projectId: string;
  month: string;
  units: number | null;
  gtq: number | null;
};

export type TargetEditor = {
  tableReady: boolean;
  months: { month: string; label: string }[];
  projects: Choice[];
  asesores: Choice[];
  cells: TargetCell[];
  history: {
    asesor: string;
    project: string;
    month: string;
    units: number | null;
    gtq: number | null;
    enteredAt: string;
  }[];
};

type VistaBase = {
  question: string;
  periodLabel: string;
  rangeLabel: string;
  caption: string;
  notice: string | null;
  projects: Choice[];
  choices: {
    asesor: Choice[];
    torre: Choice[];
    fuente: Choice[];
    modelo: Choice[];
    habitaciones: Choice[];
    motivo: Choice[];
    descuento: Choice[];
    promocion: Choice[];
    caso: Choice[];
    estadoUnidad: Choice[];
  };
  lines: SaleLine[];
  listShown: number;
  listTotal: number;
};

export type DailyPoint = {
  label: string;
  dia: number;
  neto: number;
  netoGtq: number;
  anterior: number | null;
  anteriorGtq: number | null;
  anio: number | null;
  anioGtq: number | null;
  meta: number | null;
  metaGtq: number | null;
};

export type TotalesVista = VistaBase & {
  section: "ventas-totales";
  definition: string;
  freshness: Freshness;
  grossUnits: number;
  grossGtq: number | null;
  lossUnits: number;
  lossGtq: number | null;
  lossPriorUnits: number | null;
  netUnits: number;
  netGtq: number | null;
  sinMonto: number;
  priorLabel: string | null;
  priorNetUnits: number | null;
  priorNetGtq: number | null;
  compareLabel: string | null;
  yearLabel: string | null;
  yearNetUnits: number | null;
  targetUnits: number | null;
  targetGtq: number | null;
  targetNote: string | null;
  expectedUnits: number | null;
  promedio: number | null;
  promedioPrior: number | null;
  paceInsight: string;
  daily: DailyPoint[];
  byProject: { id: string; label: string; units: number; gtq: number | null }[];
  funnel: FunnelStage[];
  blockers: BlockerRow[];
  blockerTotal: number;
};

export type MeasureRow = {
  id: string;
  label: string;
  units: number;
  targetUnits: number | null;
  gtq: number | null;
  targetGtq: number | null;
  gapUnits: number | null;
  gapGtq: number | null;
};

export type ObjetivosVista = VistaBase & {
  section: "objetivos-de-ventas";
  units: number;
  targetUnits: number | null;
  gtq: number | null;
  targetGtq: number | null;
  ratio: number | null;
  gapUnits: number | null;
  byProject: MeasureRow[];
  byAsesor: MeasureRow[];
  rosterAsesorIds: string[];
  nonSalesReps: string[];
  editor: TargetEditor;
};

export type RhythmPoint = { label: string; real: number | null; ritmo: number | null };

export type StatusRow = {
  id: string;
  label: string;
  units: number;
  paceUnits: number | null;
  targetUnits: number | null;
  gapUnits: number | null;
  gtq: number | null;
  paceGtq: number | null;
  targetGtq: number | null;
  gapGtq: number | null;
};

export type StatusVista = VistaBase & {
  section: "status-de-ventas";
  tone: "deficit" | "excedente" | "en-linea" | "sin-meta";
  units: number;
  paceUnits: number | null;
  targetUnits: number | null;
  gapUnits: number | null;
  gtq: number | null;
  paceGtq: number | null;
  targetGtq: number | null;
  gapGtq: number | null;
  closeOn: string;
  dayLabel: string;
  rhythm: RhythmPoint[];
  byProject: StatusRow[];
  byAsesor: StatusRow[];
  editor: TargetEditor;
};

export type CanalesVista = VistaBase & {
  section: "ventas-por-canales";
  units: number;
  gtq: number | null;
  leader: string | null;
  leaderShare: number | null;
  channels: { id: string; label: string; units: number; gtq: number | null; share: number }[];
  months: string[];
  series: { id: string; label: string; units: number[] }[];
};

export type ModelRow = {
  id: string;
  label: string;
  sold: number;
  available: number;
  listGtq: number | null;
  listUsd: number | null;
  share: number;
};

export type AnalisisVista = VistaBase & {
  section: "analisis-de-inventario";
  leader: string | null;
  leaderShare: number | null;
  sold: number;
  available: number;
  models: ModelRow[];
  byTower: { modelId: string; tower: string; sold: number; available: number }[];
};

export type StockProject = {
  id: string;
  label: string;
  vendido: number;
  congelado: number;
  disponible: number;
  disponibleGtq: number | null;
  disponibleUsd: number | null;
};

export type InventarioVista = VistaBase & {
  section: "inventario-general";
  asOf: string;
  vendido: number;
  congelado: number;
  disponible: number;
  vendidoGtq: number | null;
  vendidoUsd: number | null;
  congeladoGtq: number | null;
  congeladoUsd: number | null;
  disponibleGtq: number | null;
  disponibleUsd: number | null;
  otros: number;
  byProject: StockProject[];
  byTower: { projectId: string; tower: string; vendido: number; congelado: number; disponible: number }[];
};

export type ValorVista = VistaBase & {
  section: "valor-del-proyecto";
  listGtq: number | null;
  listUsd: number | null;
  lossUnits: number;
  lossGtq: number | null;
  months: { label: string; ventas: number; desistido: number }[];
  byProject: { id: string; label: string; disponibleGtq: number | null; disponibleUsd: number | null; desistidoGtq: number | null }[];
  traces: { unit: string; project: string; tower: string; saleOn: string | null; lostOn: string; gtq: number | null; status: string }[];
};

export type RateRow = {
  id: string;
  label: string;
  leads: number;
  visits: number;
  sales: number;
  pcv: number;
  saleRate: number | null;
};

export type ConversionVista = VistaBase & {
  section: "tasa-de-conversion";
  leads: number;
  visits: number;
  sales: number;
  pcv: number;
  saleRate: number | null;
  pcvRate: number | null;
  funnel: { label: string; units: number }[];
  months: { label: string; leads: number; sales: number; rate: number | null }[];
  byFuente: RateRow[];
  byAsesor: RateRow[];
};

export type NamedBar = { id: string; label: string; units: number; gtq: number | null };

export type DesistenciaVista = VistaBase & {
  section: "desistimientos";
  units: number;
  gtq: number | null;
  motivos: NamedBar[];
  byProject: NamedBar[];
  byAsesor: NamedBar[];
  traces: { unit: string; project: string; asesor: string; motivo: string; lostOn: string; gtq: number | null }[];
};

export type DescuentoVista = VistaBase & {
  section: "descuentos";
  units: number;
  gtq: number | null;
  share: number | null;
  saleGtq: number | null;
  tipos: NamedBar[];
  byAsesor: NamedBar[];
  traces: { asesor: string; tipo: string; gtq: number; rate: number | null }[];
};

export type PrecioVista = VistaBase & {
  section: "subidas-de-precios";
  units: number;
  gtq: number | null;
  usd: number | null;
  byProject: { id: string; label: string; gtq: number | null; usd: number | null; units: number }[];
  months: { label: string; gtq: number; usd: number }[];
  traces: { unit: string; tower: string; previous: number; next: number; difference: number; currency: string }[];
};

export type CasoVista = VistaBase & {
  section: "ff-y-casos-especiales";
  marked: number | null;
  ff: number | null;
  especial: number | null;
  sales: number;
  share: number | null;
  tipos: NamedBar[];
  byProject: { id: string; label: string; marked: number; sales: number; share: number | null }[];
  traces: { unit: string; project: string; asesor: string; tipo: string; gtq: number | null }[];
};

export type PromoVista = VistaBase & {
  section: "promociones";
  units: number;
  promoted: number;
  gtq: number | null;
  leader: string | null;
  leaderShare: number | null;
  tipos: NamedBar[];
  months: string[];
  series: { id: string; label: string; units: number[] }[];
  byAsesor: { asesor: string; promocion: string; units: number; gtq: number | null }[];
};

export type ReferidosVista = VistaBase & {
  section: "control-referidos";
  scopedDeals: number;
  si: number | null;
  sinTipo: number | null;
  byTipo: NamedBar[];
  nombres: string[];
  nombresTotal: number | null;
};

export type VentasVista =
  | TotalesVista
  | ObjetivosVista
  | StatusVista
  | CanalesVista
  | AnalisisVista
  | InventarioVista
  | ValorVista
  | ConversionVista
  | DesistenciaVista
  | DescuentoVista
  | PrecioVista
  | CasoVista
  | PromoVista
  | ReferidosVista;
