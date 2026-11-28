import type { EmbudoFunnel } from "./embudo";

export const VISTA_SECTIONS = [
  "ventas-totales",
  "objetivos-de-ventas",
  "status-de-ventas",
  "ventas-por-canales",
  "analisis-de-inventario",
  "inventario-general",
  "valor-del-proyecto",
  "desistimientos",
  "tasa-de-conversion",
  "descuentos",
  "subidas-de-precios",
  "ff-y-casos-especiales",
  "control-referidos",
  "promociones",
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

export type ObjetivoAsesor = {
  id: string;
  label: string;
  units: number;
  targetUnits: number | null;
  gapUnits: number | null;
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
  asesoresByProject: { projectId: string; asesores: ObjetivoAsesor[] }[];
  rosterAsesorIds: string[];
  nonSalesReps: string[];
  editor: TargetEditor;
};

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

export type StatusPoint = {
  day: string;
  reservas: number | null;
  pcv: number | null;
  esperado: number;
  labelReservas: boolean;
  labelPcv: boolean;
  labelEsperado: boolean;
  axisLabel: string;
};

export type StatusSourceRow = {
  id: string;
  day: string;
  dealId: string;
};

export type StatusBand = {
  id: string;
  label: string;
  kind: "proyecto" | "torre";
  congelado: boolean;
  frozenDetail: string | null;
  units: number;
  reservas: number;
  pcv: number;
  esperado: number;
  gap: number;
  startOn: string;
  closeOn: string;
  points: StatusPoint[];
  reservaRows: StatusSourceRow[];
  pcvRows: StatusSourceRow[];
};

export type StatusVista = VistaBase & {
  section: "status-de-ventas";
  asOf: string;
  byProject: StatusBand[];
  byTower: StatusBand[];
};

export type CanalesVista = VistaBase & {
  section: "ventas-por-canales";
  units: number;
  gtq: number | null;
  leader: string | null;
  leaderShare: number | null;
  channels: { id: string; label: string; units: number; gtq: number | null; share: number }[];
  byFuente: { id: string; label: string; reservas: number }[];
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

export type SplitStatus = "disponible" | "reservado" | "congelado" | "vendido";

export type SplitUnit = {
  projectSlug: string;
  towerId: string;
  towerName: string;
  model: string;
  code: string;
  status: SplitStatus;
};

export type SplitMove = {
  kind: "reserva" | "pcv";
  projectSlug: string;
  towerId: string;
  towerName: string;
  model: string;
  unit: string;
  day: string;
  id: string;
};

export type ModeloSplit = {
  projects: { slug: string; label: string }[];
  units: SplitUnit[];
  moves: SplitMove[];
  scope: string;
  notice: string | null;
};

export type AnalisisVista = VistaBase & {
  section: "analisis-de-inventario";
  leader: string | null;
  leaderShare: number | null;
  sold: number;
  available: number;
  models: ModelRow[];
  byTower: { modelId: string; towerId: string; projectId: string; tower: string; sold: number; available: number }[];
  modelSales: { projectSlug: string; projectId: string; towerId: string; towerName: string; model: string; sold: number }[];
  split: ModeloSplit;
};

export type StockProject = {
  id: string;
  label: string;
  vendido: number;
  reservado: number;
  congelado: number;
  disponible: number;
  disponibleGtq: number | null;
  disponibleUsd: number | null;
};

export type InventoryStatusKey = "disponible" | "revision" | "reservado" | "congelado" | "vendido";

export type InventoryCounts = {
  disponible: number;
  revision: number;
  reservado: number;
  congelado: number;
  vendido: number;
  total: number;
};

export type InventoryUnitRef = {
  code: string;
  status: InventoryStatusKey;
};

export type InventoryTower = {
  label: string;
  counts: InventoryCounts;
  units: InventoryUnitRef[];
};

export type InventoryProject = {
  id: string;
  slug: string;
  label: string;
  counts: InventoryCounts;
  towers: InventoryTower[];
};

export type InventoryBoard = {
  counts: InventoryCounts;
  projects: InventoryProject[];
  scope: string;
};

export type InventarioVista = VistaBase & {
  section: "inventario-general";
  asOf: string;
  vendido: number;
  reservado: number;
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
  byTower: { projectId: string; tower: string; vendido: number; reservado: number; congelado: number; disponible: number }[];
  byModel: { projectId: string; projectSlug: string; model: string; vendido: number; reservado: number; congelado: number; disponible: number }[];
  board: InventoryBoard;
};

export type ValorUnitLine = {
  project: string;
  torre: string;
  code: string;
  amount: number | null;
  currency: string;
  discountGtq: number;
};

export type ValorTower = {
  label: string;
  listGtq: number;
  units: ValorUnitLine[];
  history: ValorPoint[];
  /** Earliest torre date, reserva, PCV, or single history date. Empty when the torre has several valuation steps. */
  bornOn: string;
};

export type ValorPoint = {
  id: string;
  date: string;
  label: string;
  gtq: number;
  field: "appreciation_total" | "increment_amount";
  appreciation: number | null;
  increment: number;
  notes: string;
};

export type ValorProject = {
  id: string;
  slug: string;
  label: string;
  currency: string;
  listGtq: number;
  discountGtq: number;
  listUsd: number;
  /** SUM(rv_units.aproximacion_fha). Null when every unit value is null. */
  openingFha: number | null;
  towers: ValorTower[];
  history: ValorPoint[];
  /** Earliest reserva, PCV, or single history date. Empty when the project has several valuation steps or no such date exists. */
  bornOn: string;
  units: ValorUnitLine[];
};

export type ValorBoard = {
  listGtq: number;
  discountGtq: number;
  projects: ValorProject[];
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
  board: ValorBoard;
};

export type { EmbudoBar, EmbudoDeal, EmbudoFunnel } from "./embudo";

export type ConversionVista = VistaBase & {
  section: "tasa-de-conversion";
  all: EmbudoFunnel;
  funnels: EmbudoFunnel[];
};

export type NamedBar = { id: string; label: string; units: number; gtq: number | null };

export type DesistenciaCase = {
  project: string;
  torre: string;
  unit: string;
  lostOn: string;
  gtq: number | null;
};

export type DesistenciaTower = {
  label: string;
  units: number;
  gtq: number;
  cases: DesistenciaCase[];
};

export type DesistenciaProject = {
  id: string;
  slug: string;
  label: string;
  units: number;
  gtq: number;
  towers: DesistenciaTower[];
  cases: DesistenciaCase[];
};

export type DesistenciaBoard = {
  units: number;
  gtq: number;
  projects: DesistenciaProject[];
};

export type DesistenciaVista = VistaBase & {
  section: "desistimientos";
  units: number;
  gtq: number | null;
  motivos: NamedBar[];
  byProject: NamedBar[];
  byAsesor: NamedBar[];
  traces: { unit: string; project: string; asesor: string; motivo: string; lostOn: string; gtq: number | null }[];
  board: DesistenciaBoard;
};

export type DescuentoLine = {
  project: string;
  torre: string;
  unit: string;
  saleOn: string;
  amountGtq: number | null;
};

export type DescuentoSale = {
  dealId: string;
  project: string;
  torre: string;
  unit: string;
  saleOn: string;
  gtq: number;
  lines: DescuentoLine[];
};

export type DescuentoTower = {
  label: string;
  units: number;
  gtq: number;
  sales: DescuentoSale[];
  lines: DescuentoLine[];
};

export type DescuentoProject = {
  id: string;
  slug: string;
  label: string;
  units: number;
  gtq: number;
  towers: DescuentoTower[];
  sales: DescuentoSale[];
  lines: DescuentoLine[];
};

export type DescuentoBoard = {
  units: number;
  gtq: number;
  projects: DescuentoProject[];
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
  board: DescuentoBoard;
};

export type SubidaEvent = {
  project: string;
  torre: string;
  unit: string;
  effectiveOn: string;
  difference: number | null;
  currency: string;
};

export type SubidaTower = {
  label: string;
  units: number;
  gtq: number;
  events: SubidaEvent[];
};

export type SubidaProject = {
  id: string;
  slug: string;
  label: string;
  units: number;
  gtq: number;
  towers: SubidaTower[];
  events: SubidaEvent[];
};

export type SubidaBoard = {
  units: number;
  gtq: number;
  projects: SubidaProject[];
};

export type PrecioVista = VistaBase & {
  section: "subidas-de-precios";
  units: number;
  gtq: number | null;
  usd: number | null;
  byProject: { id: string; label: string; gtq: number | null; usd: number | null; units: number }[];
  months: { label: string; gtq: number; usd: number }[];
  traces: { unit: string; tower: string; previous: number; next: number; difference: number; currency: string }[];
  board: SubidaBoard;
};

export type CasoMark = {
  project: string;
  torre: string;
  unit: string;
  saleOn: string;
  reason: string;
  gtq: number | null;
};

export type CasoTower = {
  label: string;
  units: number;
  marks: CasoMark[];
};

export type CasoProject = {
  id: string;
  slug: string;
  label: string;
  units: number;
  towers: CasoTower[];
  marks: CasoMark[];
};

export type CasoBoard = {
  units: number;
  projects: CasoProject[];
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
  board: CasoBoard;
};

export type PromoApplication = {
  dealId: string;
  project: string;
  torre: string;
  unit: string;
  saleOn: string;
  name: string;
  valeGtq: number | null;
};

export type PromoTower = {
  label: string;
  units: number;
  gtq: number;
  applications: PromoApplication[];
};

export type PromoProject = {
  id: string;
  slug: string;
  label: string;
  units: number;
  gtq: number;
  towers: PromoTower[];
  applications: PromoApplication[];
};

export type PromoBoard = {
  units: number;
  gtq: number;
  projects: PromoProject[];
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
  board: PromoBoard;
};

export const REFERIDO_TIPOS: readonly string[] = [
  "Referido Cartera",
  "Referido Corporación",
  "Referido Corredor",
  "Referido entre Proyectos",
].sort((a, b) => a.localeCompare(b, "es"));

export type ReferidoTipo = {
  id: string;
  label: string;
  units: number;
  nombres: string[];
};

export type ReferidoProject = {
  id: string;
  label: string;
  units: number;
  nombres: string[];
  tipos: ReferidoTipo[];
};

export type ReferidosVista = VistaBase & {
  section: "control-referidos";
  scopedDeals: number;
  si: number | null;
  sinTipo: number | null;
  byTipo: NamedBar[];
  nombres: string[];
  nombresTotal: number | null;
  referidores: string[];
  byProject: ReferidoProject[];
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
