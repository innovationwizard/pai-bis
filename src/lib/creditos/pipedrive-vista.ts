import { createAdminClient } from "@/lib/supabase/admin";
import { guatemalaToday, monthName, resolveRange, type PeriodPreset } from "@/lib/ventas/period";

export const CREDITO_SECTIONS = [
  "resumen",
  "expediente-inicial",
  "scanners",
  "pcvs",
  "armado",
  "contado",
  "envio-analisis",
  "suspendidos",
  "reanalisis",
  "aprobacion",
  "expediente-tecnico",
  "aprobacion-final",
  "expedientes-por-fase",
] as const;

export type CreditoSection = (typeof CREDITO_SECTIONS)[number];

const PROJECTS = [
  { slug: "benestare", name: "Benestare" },
  { slug: "bosque-las-tapias", name: "Bosque Las Tapias" },
  { slug: "boulevard-5", name: "Boulevard 5" },
  { slug: "santa-elena", name: "Santa Elena" },
  { slug: "casa-elisa", name: "Casa Elisa" },
  { slug: "torre-coban", name: "Torre Cobán" },
] as const;

const DEFAULT_PROJECT_SLUGS = new Set<string>([
  "boulevard-5",
  "benestare",
  "bosque-las-tapias",
  "santa-elena",
]);

function leftOutOfDefault(slug: string, name: string): boolean {
  return slug === "casa-elisa" || /^casa elisa$/i.test(name) || /cob[aá]n/i.test(name);
}

function inDefaultProject(slug: string, name: string): boolean {
  return DEFAULT_PROJECT_SLUGS.has(slug) && !leftOutOfDefault(slug, name);
}

function scopeProjects(projectSlug: string | null): readonly (typeof PROJECTS)[number][] {
  if (projectSlug) return PROJECTS.filter((item) => item.slug === projectSlug);
  return PROJECTS.filter((item) => inDefaultProject(item.slug, item.name));
}

function rowInScope(slug: string, name: string, selectedSlug: string | null): boolean {
  if (selectedSlug) return slug === selectedSlug;
  return inDefaultProject(slug, name);
}

const BUCKET: Record<string, string> = {
  sin_dato: "Sin dato",
  fha: "FHA",
  credito_directo: "Crédito directo",
  contado: "Contado",
  fha_y_directo: "FHA y crédito directo",
  fha_y_contado: "FHA y contado",
  directo_y_contado: "Crédito directo y contado",
  conflicto: "Tipos en conflicto",
};

const STATUS: Record<string, string> = {
  open: "Abierto",
  lost: "Perdido",
  won: "Ganado",
};

const SCOPE: Record<string, string> = {
  seis_embudos: "En los seis embudos",
  sin_blv5: "Boulevard 5 no tiene esta etapa",
  solo_blv5: "Solo Boulevard 5. El nombre no dice el tipo de crédito",
};

export type Kpi = { label: string; value: string; detail: string };
export type ChartPoint = { label: string; key: string; [series: string]: string | number };
export type Chart = {
  title: string;
  note: string;
  empty: string;
  series: string[];
  points: ChartPoint[];
};
export type MatrixRow = { lane: string; scope: string; cells: { project: string; text: string }[] };
export type CoverageRow = { measure: string; cells: { project: string; text: string }[] };
export type QueueRow = {
  project: string;
  stage: string;
  open: number;
  lost: number;
  won: number;
  median: string;
};
export type DealRow = {
  id: number;
  title: string;
  project: string;
  stage: string;
  status: string;
  tipo: string;
  days: string;
  entered: string;
  extra: string;
  keys: string[];
};
export type CreditosVista = {
  section: CreditoSection;
  question: string;
  limitation: string;
  periodLabel: string;
  asOf: string;
  loadedAt: string | null;
  loaded: boolean;
  emptyMessage: string | null;
  kpis: Kpi[];
  charts: Chart[];
  matrix: MatrixRow[] | null;
  matrixNote: string | null;
  coverage: CoverageRow[] | null;
  coverageNote: string | null;
  queue: QueueRow[] | null;
  deals: DealRow[];
  dealNote: string;
};

type Deal = {
  id: number;
  title: string;
  project: string;
  projectSlug: string;
  stage: string;
  lane: string;
  status: string;
  bucket: string;
  tipoA: string | null;
  tipoB: string | null;
  banco: string | null;
  coordinadora: string | null;
  caso: string | null;
  apartamento: string | null;
  days: number | null;
  entered: string | null;
  value: number | null;
  valueCurrency: string | null;
  prestamo: number | null;
  prestamoCurrency: string | null;
  enganche: number | null;
  engancheCurrency: string | null;
  lostReason: string | null;
  armado: string | null;
  armadoOn: string | null;
  ingreso: string | null;
  ingresoOn: string | null;
  suspFha: string | null;
  suspBanco: string | null;
  lift: string | null;
  aprobFha: string | null;
  aprobFhaOn: string | null;
  aprobBanco: string | null;
  aprobBancoOn: string | null;
  tecnicaOn: string | null;
  pcvOn: string | null;
  signals: string[];
  fileScanner: boolean;
  fileStrict: boolean;
  filePcv: boolean;
  fileNumbered: boolean;
  fileDeclaracion: boolean;
  papeleria: string | null;
  keys: string[];
};

type Stage = {
  projectSlug: string;
  project: string;
  sort: number;
  stage: string;
  lane: string;
  laneLabel: string;
  laneOrder: number;
  stageOrder: number;
  scope: string;
  open: number;
  lost: number;
  won: number;
  median: number | null;
  openWithoutEntry: number;
};

type EventRow = {
  source: string;
  signal: string;
  projectSlug: string;
  eventOn: string | null;
  dealId: number;
  bucket: string;
};

type Bundle = { deals: Deal[]; stages: Stage[]; events: EventRow[]; loadedAt: string | null };
type Window = { from: string; to: string };

const CACHE_MS = 30_000;
let cache: { at: number; bundle: Bundle } | null = null;

const moneyFormat = new Intl.NumberFormat("es-GT", {
  style: "currency",
  currency: "GTQ",
  maximumFractionDigits: 0,
});
const countFormat = new Intl.NumberFormat("es-GT");

export function isCreditoSection(value: string): value is CreditoSection {
  return (CREDITO_SECTIONS as readonly string[]).includes(value);
}

export async function buildCreditosVista(
  section: CreditoSection,
  preset: PeriodPreset,
  customFrom: string | null,
  customTo: string | null,
  projectSlug: string | null,
): Promise<CreditosVista> {
  const today = guatemalaToday();
  const range = resolveRange(preset, customFrom, customTo, today);
  const bundle = await loadBundle();
  const project = PROJECTS.find((item) => item.slug === projectSlug) ?? null;
  const selectedSlug = project?.slug ?? null;
  const deals = bundle.deals.filter((deal) => rowInScope(deal.projectSlug, deal.project, selectedSlug));
  const stages = bundle.stages.filter((stage) => rowInScope(stage.projectSlug, stage.project, selectedSlug));
  const dealIds = new Set(deals.map((deal) => deal.id));
  const events = bundle.events.filter((event) =>
    selectedSlug ? event.projectSlug === selectedSlug : dealIds.has(event.dealId),
  );
  const copy = COPY[section];
  const built = copy.build({
    deals,
    stages,
    events,
    range,
    projectSlug: project?.slug ?? null,
  });
  const visible = deals.filter(built.deal);
  return {
    section,
    question: copy.question,
    limitation: copy.limitation,
    periodLabel: range.label,
    asOf: today,
    loadedAt: bundle.loadedAt,
    loaded: bundle.deals.length > 0,
    emptyMessage:
      bundle.deals.length === 0
        ? "Todavía no hay tratos de crédito cargados. Falta correr scripts/creditos/load.py después de la migración."
        : project && deals.length === 0
          ? `${project.name} no tiene tratos en el extracto.`
          : null,
    kpis: built.kpis,
    charts: built.charts,
    matrix: built.matrix,
    matrixNote: built.matrix
      ? "0 es una etapa que existe y hoy no tiene tratos abiertos. — es una etapa que ese embudo no tiene."
      : null,
    coverage: built.coverage,
    coverageNote: built.coverage
      ? "Sin registro: el proyecto tiene tratos y ninguno trae este dato. Sin tratos: el embudo está vacío. Un número es un conteo, no un porcentaje de expediente completo."
      : null,
    queue: built.queue,
    deals: visible.slice(0, 400).map((deal) => toRow(deal, built.extra)),
    dealNote:
      visible.length === 0
        ? "No hay tratos para esta lista."
        : visible.length > 400
          ? `Se muestran 400 de ${countFormat.format(visible.length)} tratos. La lista es de tratos: una actividad repetida es un solo trato.`
          : `${countFormat.format(visible.length)} tratos. Una actividad repetida sigue siendo un solo trato.`,
  };
}

const PERIOD_NOTE =
  "La cola abierta es la de hoy. El periodo solo recorta los hechos que tienen fecha. No hay historial de etapas: los días son el tiempo en la etapa actual.";

const TWO_FIELDS =
  "Hay dos campos llamados Tipo de Crédito. El de ventas y el del embudo de crédito no se sustituyen. La columna Tipo es la lectura de los dos juntos. El nombre de la etapa no entra en esa lectura.";

const COPY: Record<
  CreditoSection,
  {
    question: string;
    limitation: string;
    build: (ctx: Ctx) => Built;
  }
> = {
  resumen: {
    question: "¿Dónde está hoy el libro de crédito, y de qué tamaño?",
    limitation: `${PERIOD_NOTE} ${TWO_FIELDS} Ganado en Pipedrive no es desembolso ni liquidación. Torre Cobán tiene el embudo y, si sigue vacío, no tiene tratos.`,
    build: resumen,
  },
  "expediente-inicial": {
    question: "¿Qué ingreso de expediente y qué checklist quedaron anotados?",
    limitation:
      "No hay etapa ni checklist de documentos. El ingreso es la actividad Ingreso de Expediente. Checklist y cheque es otra actividad, casi toda de Boulevard 5, y las de Casa Elisa son de 2022. Papelería vencida no es ese checklist. Los nombres de archivo que empiezan con número no son un expediente completo.",
    build: expedienteInicial,
  },
  scanners: {
    question: "¿En qué tratos el nombre del archivo o una nota menciona un escáner?",
    limitation:
      "No hay campo ni actividad de scanners. Es una búsqueda en el nombre del archivo y en el texto de la nota. La fecha es la de la carga, no el cierre de un control. Un nombre puede coincidir por accidente.",
    build: scanners,
  },
  pcvs: {
    question: "¿Qué tratos tienen fecha de PCV y cuáles tienen la recepción de la promesa firmada?",
    limitation:
      "La recepción Recepción de Promesa Firmada es la misma actividad que usa Ventas, y aquí está pegada al trato de crédito. La fecha de PCV y esa actividad no cubren a los mismos tratos. Estar en la etapa Promesa no prueba una promesa firmada. No hay conteo de copias físicas ni de scanner.",
    build: pcvs,
  },
  armado: {
    question: "¿Quién está en Armado, y quién tiene el flag de armado aunque ya se haya ido?",
    limitation:
      "La etapa y el flag no son la misma población. El flag y la fecha son de Boulevard 5. Casa Elisa tiene tratos en la etapa, incluidos ganados, sin el flag. 4.1 a 4.4 son asuntos de actividades, no campos. La cita de firma de escritura no es la firma de los formularios.",
    build: armado,
  },
  contado: {
    question: "¿Qué tratos están marcados como contado, y en qué etapa están hoy?",
    limitation:
      "No hay etapa ni fecha de autorización. Contado es una etiqueta de financiamiento. Contado y contado banco son la misma familia. Un trato que además dice FHA se muestra aparte y no entra en el conteo de contado. La etapa Resguardo FHA también tiene tratos de contado: el nombre de la etapa no es el tipo.",
    build: contado,
  },
  "envio-analisis": {
    question: "¿Quién está en Análisis, y quién ya tiene fecha de ingreso?",
    limitation:
      "El ingreso a análisis es un solo flag y una sola fecha para FHA y para crédito directo. No existe un envío a FHA distinto de un envío a banco. El banco seleccionado no significa que el envío haya sido por la vía del banco. 6.1 y 6.2 se leen sobre ese mismo hecho, partidos por el tipo del trato.",
    build: envio,
  },
  suspendidos: {
    question: "¿Quién está suspendido hoy, y quién tiene fecha de suspensión aunque ya salió?",
    limitation:
      "La etapa, las fechas y las actividades son tres conteos distintos. Suspendido FHA y Suspendido Banco son fechas, no el tipo de crédito: un trato FHA puede traer la fecha de banco. La fecha de levante es una sola. El motivo de perdido no registra la suspensión. El texto del rechazo, cuando existe, está en la nota de la actividad.",
    build: suspendidos,
  },
  reanalisis: {
    question: "¿Quién está en Re-análisis, y cuántas veces se anotó la actividad?",
    limitation:
      "No hay campo ni fecha de re-análisis. La actividad no dice FHA ni banco. 8.1 y 8.2 son el mismo hecho leído con el tipo del trato. La fecha de levante de la suspensión no es la fecha de re-análisis.",
    build: reanalisis,
  },
  aprobacion: {
    question: "¿Quién está en la etapa Aprobación, y quién tiene aprobación FHA o de banco?",
    limitation:
      "La etapa y los flags no son el mismo conjunto. La aprobación FHA queda marcada en tratos que ya se movieron. La aprobación de banco es frecuente en tratos FHA y no significa que el trato sea la vía del banco. No hay monto aprobado ni un No registrado. Casa Elisa tiene tratos en la etapa sin estos campos.",
    build: aprobacion,
  },
  "expediente-tecnico": {
    question: "¿Quién está en las etapas técnicas, y quién tiene fecha de aprobación técnica?",
    limitation:
      "Boulevard 5 partió el paso en varias etapas. Las de los otros embudos, llamadas Expediente Técnico, están vacías en el inventario y no son la misma etapa. Aprobación técnica es una fecha, no un sí o un no. No hay avalúo de banco aparte. El CD del nombre de la etapa no es el tipo de los tratos que están ahí. Las dos redacciones de la actividad son variantes, no una división FHA y banco.",
    build: tecnico,
  },
  "aprobacion-final": {
    question: "¿Quién está en resguardo y en resolución, y de qué tipo es?",
    limitation:
      "No hay campo de resguardo ni de resolución. Las actividades son hechos históricos y no la cola de hoy. Resguardo FHA no está lleno de tratos FHA. Resolución Bancaria también tiene contado y FHA. El nombre no es el tipo. Los otros embudos tienen Resguardo / Resolución y no han tenido tratos.",
    build: final,
  },
  "expedientes-por-fase": {
    question: "¿En qué fase está la cola, y quién tiene PCV?",
    limitation: `${PERIOD_NOTE} ${TWO_FIELDS} Esta vista junta la cola abierta con la fecha de PCV y la recepción de promesa. No es un expediente completo ni un porcentaje de papelería.`,
    build: directivo,
  },
};

type Ctx = {
  deals: Deal[];
  stages: Stage[];
  events: EventRow[];
  range: Window;
  projectSlug: string | null;
};

type Built = {
  kpis: Kpi[];
  charts: Chart[];
  matrix: MatrixRow[] | null;
  coverage: CoverageRow[] | null;
  queue: QueueRow[] | null;
  deal: (deal: Deal) => boolean;
  extra: (deal: Deal) => string;
};

function resumen(ctx: Ctx): Built {
  const open = ctx.deals.filter((deal) => deal.status === "open");
  const lost = ctx.deals.filter((deal) => deal.status === "lost");
  const won = ctx.deals.filter((deal) => deal.status === "won");
  const value = sumGtq(ctx.deals, (deal) => ({ amount: deal.value, currency: deal.valueCurrency }));
  const prestamo = sumGtq(ctx.deals, (deal) => ({ amount: deal.prestamo, currency: deal.prestamoCurrency }));
  const enganche = sumGtq(ctx.deals, (deal) => ({ amount: deal.enganche, currency: deal.engancheCurrency }));
  return {
    kpis: [
      kpi("Abiertos", count(open.length), "cola de hoy"),
      kpi("Perdidos", count(lost.length), "el motivo es comercial, no la suspensión"),
      kpi("Ganados", count(won.length), "no es desembolso ni liquidación"),
      kpi("Valor del trato", money(value.total), value.detail),
      kpi("Monto de préstamo", money(prestamo.total), prestamo.detail),
      kpi("Enganche pactado", money(enganche.total), enganche.detail),
    ],
    charts: [
      bars("Tipo de crédito de los abiertos", TWO_FIELDS, "No hay tratos abiertos.", countBy(open, (deal) => deal.bucket, "bucket")),
      agingChart(open),
      bars(
        "Banco seleccionado",
        blankNote(ctx.deals, (deal) => deal.banco, "Sin banco"),
        "No hay banco seleccionado.",
        countBy(
          ctx.deals.filter((deal) => deal.banco),
          (deal) => deal.banco || "",
          "banco",
        ),
      ),
      bars(
        "Coordinadora",
        "Ninguna es una opción elegida. Sin dato es el campo vacío. En el inventario el campo está lleno en Boulevard 5.",
        "No hay coordinadora registrada.",
        countBy(ctx.deals, (deal) => deal.coordinadora || "Sin dato", "coord"),
      ),
      bars(
        "Motivo de perdido",
        "Estos motivos son de desistimiento comercial. No hay un motivo llamado Suspendido ni rechazo bancario.",
        "No hay tratos perdidos.",
        countBy(lost, (deal) => deal.lostReason || "Sin motivo", "motivo"),
      ),
    ],
    matrix: matrix(ctx.stages, null),
    coverage: null,
    queue: queueRows(ctx.stages, null, true),
    deal: (deal) => deal.status === "open",
    extra: (deal) => [tipoDetail(deal), deal.banco, deal.coordinadora, deal.apartamento].filter(Boolean).join(" · "),
  };
}

function expedienteInicial(ctx: Ctx): Built {
  const ingreso = signalEvents(ctx.events, "ingreso_expediente");
  const checklist = signalEvents(ctx.events, "checklist");
  return {
    kpis: [
      kpi("Ingreso de expediente", count(ingreso.length), dealBit(ingreso)),
      kpi("Checklist y cheque", count(checklist.length), dealBit(checklist)),
      kpi("Papelería vencida = Sí", count(ctx.deals.filter((deal) => deal.papeleria === "Si").length), "no es el checklist"),
      kpi("Archivos numerados", count(signalEvents(ctx.events, "archivo_numerado").length), "el nombre empieza con un número"),
    ],
    charts: [
      monthChart("Ingresos en el periodo", "Actividad Ingreso de Expediente, por fecha de vencimiento de la actividad.", ingreso, ctx.range, "signal:ingreso_expediente"),
      monthChart("Checklist en el periodo", "Asunto Checklist y cheque. Texto libre, no un formulario.", checklist, ctx.range, "signal:checklist"),
      projectSignal(ctx, "Ingreso por proyecto", "ingreso_expediente"),
    ],
    matrix: null,
    coverage: coverage(ctx, [
      ["Ingreso de expediente", (deal) => deal.signals.includes("ingreso_expediente")],
      ["Checklist y cheque", (deal) => deal.signals.includes("checklist")],
      ["Papelería vencida", (deal) => deal.papeleria != null],
      ["Archivo numerado", (deal) => deal.fileNumbered],
    ]),
    queue: null,
    deal: (deal) =>
      deal.signals.includes("ingreso_expediente") ||
      deal.signals.includes("checklist") ||
      deal.papeleria === "Si" ||
      deal.fileNumbered,
    extra: (deal) =>
      [
        deal.signals.includes("ingreso_expediente") ? "ingreso" : null,
        deal.signals.includes("checklist") ? "checklist" : null,
        deal.papeleria ? `papelería vencida ${deal.papeleria}` : null,
        deal.fileNumbered ? "archivo numerado" : null,
      ]
        .filter(Boolean)
        .join(" · "),
  };
}

function scanners(ctx: Ctx): Built {
  const loose = signalEvents(ctx.events, "archivo_escaner");
  const strict = signalEvents(ctx.events, "archivo_escaner_estricto");
  const notes = signalEvents(ctx.events, "nota_escaner");
  const files = signalEvents(ctx.events, "archivo");
  return {
    kpis: [
      kpi("Archivos con la palabra", count(loose.length), dealBit(loose)),
      kpi("CamScanner o escaneada", count(strict.length), dealBit(strict)),
      kpi("Notas con la palabra", count(notes.length), dealBit(notes)),
      kpi("Archivos del extracto", count(files.length), "el denominador, no un aprobado"),
    ],
    charts: [
      monthChart("Cargas con la palabra, en el periodo", "Fecha en que se subió el archivo.", loose, ctx.range, "file:scanner"),
      projectFlag(ctx, "Tratos con un archivo que menciona escáner", (deal) => deal.fileScanner),
    ],
    matrix: null,
    coverage: coverage(ctx, [
      ["Nombre con escáner", (deal) => deal.fileScanner],
      ["CamScanner o escaneada", (deal) => deal.fileStrict],
    ]),
    queue: null,
    deal: (deal) => deal.fileScanner || deal.keys.includes("file:note"),
    extra: (deal) =>
      [deal.fileScanner ? "nombre de archivo" : null, deal.fileStrict ? "CamScanner o escaneada" : null, deal.keys.includes("file:note") ? "nota" : null]
        .filter(Boolean)
        .join(" · "),
  };
}

function pcvs(ctx: Ctx): Built {
  const fecha = ctx.deals.filter((deal) => deal.pcvOn);
  const recepcion = ctx.deals.filter((deal) => deal.signals.includes("promesa_recepcion"));
  const both = fecha.filter((deal) => deal.signals.includes("promesa_recepcion"));
  const promesaOpen = ctx.deals.filter((deal) => deal.status === "open" && deal.lane === "promesa");
  return {
    kpis: [
      kpi("Con fecha de PCV", count(fecha.length), "el campo, no la actividad"),
      kpi("Con recepción firmada", count(recepcion.length), "la misma actividad que usa Ventas"),
      kpi("Con las dos", count(both.length), "no son el mismo conjunto"),
      kpi("Abiertos en Promesa", count(promesaOpen.length), "la etapa no prueba la firma"),
    ],
    charts: [
      monthChart("Fechas de PCV en el periodo", "Fecha de PCV- Dcto.", signalEvents(ctx.events, "fecha_pcv"), ctx.range, "date:pcv"),
      monthChart(
        "Recepciones en el periodo",
        "Asunto Recepción de Promesa Firmada. La fecha es la de la actividad.",
        signalEvents(ctx.events, "promesa_recepcion"),
        ctx.range,
        "signal:promesa_recepcion",
      ),
      projectFlag(ctx, "Fecha de PCV por proyecto", (deal) => deal.pcvOn != null),
      projectSignal(ctx, "Recepción de promesa por proyecto", "promesa_recepcion"),
    ],
    matrix: matrix(ctx.stages, ["promesa"]),
    coverage: coverage(ctx, [
      ["Fecha de PCV", (deal) => deal.pcvOn != null],
      ["Recepción firmada", (deal) => deal.signals.includes("promesa_recepcion")],
      ["Envío de documentación PCV", (deal) => deal.signals.includes("envio_pcv")],
    ]),
    queue: queueRows(ctx.stages, ["promesa"], false),
    deal: (deal) => deal.pcvOn != null || deal.signals.includes("promesa_recepcion") || deal.signals.includes("envio_pcv") || deal.lane === "promesa",
    extra: (deal) =>
      [
        deal.pcvOn ? `PCV ${deal.pcvOn}` : null,
        deal.signals.includes("promesa_recepcion") ? "recepción" : null,
        deal.signals.includes("envio_pcv") ? "envío" : null,
        deal.lane === "promesa" ? "hoy en Promesa" : null,
      ]
        .filter(Boolean)
        .join(" · "),
  };
}

function armado(ctx: Ctx): Built {
  const open = ctx.deals.filter((deal) => deal.status === "open" && deal.lane === "armado");
  const flag = ctx.deals.filter((deal) => deal.armado === "Si");
  const flagHere = flag.filter((deal) => deal.lane === "armado");
  return {
    kpis: [
      kpi("Abiertos en la etapa", count(open.length), "incluye Casa Elisa"),
      kpi("Flag de armado", count(flag.length), "sigue puesto después de salir"),
      kpi("Flag y todavía en la etapa", count(flagHere.length), "la intersección, no la etapa"),
      kpi("4.1 Solicitud", count(signalEvents(ctx.events, "solicitud_papeleria").length), "actividad, solo el texto"),
      kpi("4.2 Recolección", count(signalEvents(ctx.events, "recoleccion").length), "asuntos sueltos"),
      kpi("4.3 Llenado", count(signalEvents(ctx.events, "llenado").length), "asuntos sueltos"),
      kpi("4.4 Firma de documentos", count(signalEvents(ctx.events, "firma_documentos").length), "no es la cita de escritura"),
      kpi("Cita de escritura", count(signalEvents(ctx.events, "cita_escritura").length), "es la firma de la escritura, no 4.4"),
    ],
    charts: [
      monthChart("Fecha de armado en el periodo", "El campo Fecha de Armado de Expediente. No es la entrada a la etapa.", signalEvents(ctx.events, "armado_fecha"), ctx.range, "date:armado"),
      projectFlag(ctx, "Flag de armado por proyecto", (deal) => deal.armado === "Si"),
      agingChart(open),
    ],
    matrix: matrix(ctx.stages, ["armado"]),
    coverage: coverage(ctx, [
      ["Flag de armado", (deal) => deal.armado != null],
      ["Fecha de armado", (deal) => deal.armadoOn != null],
      ["4.1 Solicitud", (deal) => deal.signals.includes("solicitud_papeleria")],
      ["4.2 Recolección", (deal) => deal.signals.includes("recoleccion")],
      ["4.3 Llenado", (deal) => deal.signals.includes("llenado")],
      ["4.4 Firma", (deal) => deal.signals.includes("firma_documentos")],
    ]),
    queue: queueRows(ctx.stages, ["armado"], false),
    deal: (deal) => deal.lane === "armado" || deal.armado === "Si" || deal.signals.includes("armado"),
    extra: (deal) =>
      [deal.armado ? `flag ${deal.armado}` : "sin flag", deal.armadoOn ? `fecha ${deal.armadoOn}` : null, STATUS[deal.status]]
        .filter(Boolean)
        .join(" · "),
  };
}

function contado(ctx: Ctx): Built {
  const family = ctx.deals.filter((deal) => deal.bucket === "contado");
  const mixed = ctx.deals.filter((deal) => deal.bucket === "fha_y_contado");
  const open = family.filter((deal) => deal.status === "open");
  return {
    kpis: [
      kpi("Contado", count(family.length), "sin los que también dicen FHA"),
      kpi("FHA y contado", count(mixed.length), "quedan aparte"),
      kpi("Contado abiertos", count(open.length), "repartidos en varias etapas"),
      kpi("Actividades de aprobación de contado", count(signalEvents(ctx.events, "aprobacion_contado").length), "dos asuntos, no un control"),
    ],
    charts: [
      bars(
        "Etapa actual de los contado abiertos",
        "Incluye etapas cuyo nombre dice FHA. El nombre no se usó para clasificarlos.",
        "No hay tratos de contado abiertos.",
        countBy(open, (deal) => deal.stage, "stage"),
      ),
      bars("Lectura de los dos campos", TWO_FIELDS, "No hay tratos en este filtro.", countBy(ctx.deals, (deal) => deal.bucket, "bucket")),
    ],
    matrix: null,
    coverage: coverage(ctx, [
      ["Contado, sin FHA", (deal) => deal.bucket === "contado"],
      ["FHA y contado", (deal) => deal.bucket === "fha_y_contado"],
    ]),
    queue: null,
    deal: (deal) => deal.bucket === "contado" || deal.bucket === "fha_y_contado",
    extra: (deal) => [tipoDetail(deal), deal.stage, deal.banco].filter(Boolean).join(" · "),
  };
}

function envio(ctx: Ctx): Built {
  const open = ctx.deals.filter((deal) => deal.status === "open" && deal.lane === "analisis");
  const flag = ctx.deals.filter((deal) => deal.ingreso === "Si");
  return {
    kpis: [
      kpi("Abiertos en Análisis", count(open.length), mix(open)),
      kpi("Ingreso a análisis = Sí", count(flag.length), "un solo flag para las dos vías"),
      kpi("Con fecha de ingreso", count(ctx.deals.filter((deal) => deal.ingresoOn).length), "la misma fecha para FHA y crédito directo"),
      kpi("Actividades Análisis", count(signalEvents(ctx.events, "analisis").length), dealBit(signalEvents(ctx.events, "analisis"))),
      kpi("6.1 Abiertos FHA", count(open.filter((deal) => deal.bucket === "fha" || deal.bucket === "fha_y_directo" || deal.bucket === "fha_y_contado").length), "tipo del trato, no un envío distinto"),
      kpi("6.2 Abiertos crédito directo", count(open.filter((deal) => deal.bucket === "credito_directo").length), "no hay un envío llamado Banco"),
    ],
    charts: [
      bars("Tipo de los abiertos en Análisis", "Partir 6.1 y 6.2 más fino que esto no está en el extracto.", "No hay tratos abiertos en Análisis.", countBy(open, (deal) => deal.bucket, "bucket")),
      monthChart("Fecha de ingreso en el periodo", "Una fecha compartida. No es la entrada a la etapa.", signalEvents(ctx.events, "ingreso_analisis_fecha"), ctx.range, "date:ingreso"),
      agingChart(open),
    ],
    matrix: matrix(ctx.stages, ["analisis"]),
    coverage: coverage(ctx, [
      ["Ingreso a análisis", (deal) => deal.ingreso === "Si"],
      ["Fecha de ingreso", (deal) => deal.ingresoOn != null],
      ["Actividad Análisis", (deal) => deal.signals.includes("analisis")],
    ]),
    queue: queueRows(ctx.stages, ["analisis"], false),
    deal: (deal) => deal.lane === "analisis" || deal.ingreso === "Si" || deal.signals.includes("analisis"),
    extra: (deal) => [tipoDetail(deal), deal.ingresoOn ? `ingreso ${deal.ingresoOn}` : "sin fecha de ingreso", deal.caso ? `caso ${deal.caso}` : null].filter(Boolean).join(" · "),
  };
}

function suspendidos(ctx: Ctx): Built {
  const open = ctx.deals.filter((deal) => deal.status === "open" && deal.lane === "suspendido");
  const fha = ctx.deals.filter((deal) => deal.suspFha);
  const banco = ctx.deals.filter((deal) => deal.suspBanco);
  const both = fha.filter((deal) => deal.suspBanco);
  const openBare = open.filter((deal) => !deal.suspFha && !deal.suspBanco);
  return {
    kpis: [
      kpi("Abiertos en Suspendido", count(open.length), mix(open)),
      kpi("Fecha Suspendido FHA", count(fha.length), "histórico: la mayoría ya salió"),
      kpi("Fecha Suspendido Banco", count(banco.length), "no es lo mismo que crédito directo"),
      kpi("Con las dos fechas", count(both.length), "pueden ser las dos"),
      kpi("Levante", count(ctx.deals.filter((deal) => deal.lift).length), "una sola fecha"),
      kpi("Abiertos sin ninguna fecha", count(openBare.length), "la etapa tampoco es la fecha"),
    ],
    charts: [
      monthChart("Suspendido FHA en el periodo", "Fecha del campo. No es la actividad.", signalEvents(ctx.events, "suspendido_fha_fecha"), ctx.range, "date:susp-fha"),
      monthChart("Suspendido Banco en el periodo", "Doce fechas en el inventario. El tipo del trato suele ser FHA.", signalEvents(ctx.events, "suspendido_banco_fecha"), ctx.range, "date:susp-banco"),
      bars("Tipo de los abiertos en la etapa", "El tipo no se lee del nombre de la etapa.", "No hay tratos abiertos en Suspendido.", countBy(open, (deal) => deal.bucket, "bucket")),
      agingChart(open),
    ],
    matrix: matrix(ctx.stages, ["suspendido"]),
    coverage: coverage(ctx, [
      ["Suspendido FHA", (deal) => deal.suspFha != null],
      ["Suspendido Banco", (deal) => deal.suspBanco != null],
      ["Levante", (deal) => deal.lift != null],
      ["Actividad Suspensión", (deal) => deal.signals.includes("suspension") || deal.signals.includes("suspension_fha_texto") || deal.signals.includes("suspension_rechazado")],
    ]),
    queue: queueRows(ctx.stages, ["suspendido"], false),
    deal: (deal) => deal.lane === "suspendido" || deal.suspFha != null || deal.suspBanco != null || deal.signals.some((signal) => signal.startsWith("suspension")),
    extra: (deal) =>
      [
        tipoDetail(deal),
        deal.suspFha ? `FHA ${deal.suspFha}` : null,
        deal.suspBanco ? `banco ${deal.suspBanco}` : null,
        deal.lift ? `levante ${deal.lift}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
  };
}

function reanalisis(ctx: Ctx): Built {
  const open = ctx.deals.filter((deal) => deal.status === "open" && deal.lane === "reanalisis");
  const events = signalEvents(ctx.events, "re_analisis");
  const onlyDirecto = open.filter((deal) => deal.bucket === "credito_directo");
  return {
    kpis: [
      kpi("Abiertos en Re-análisis", count(open.length), mix(open)),
      kpi("Actividades Re-análisis", count(events.length), dealBit(events)),
      kpi("8.1 Abiertos FHA", count(open.filter((deal) => deal.bucket === "fha" || deal.bucket.startsWith("fha_")).length), "el tipo del trato"),
      kpi("8.2 Solo crédito directo", count(onlyDirecto.length), onlyDirecto.length === 0 ? "no hay uno abierto con solo ese tipo" : "tipo del trato, la actividad no lo dice"),
    ],
    charts: [
      monthChart("Re-análisis en el periodo", "Fecha de la actividad. No hay campo de re-análisis.", events, ctx.range, "signal:re_analisis"),
      bars("Tipo de los abiertos", "8.2 no tiene una serie propia en el extracto.", "No hay tratos abiertos en Re-análisis.", countBy(open, (deal) => deal.bucket, "bucket")),
      agingChart(open),
    ],
    matrix: matrix(ctx.stages, ["reanalisis"]),
    coverage: coverage(ctx, [["Actividad Re-análisis", (deal) => deal.signals.includes("re_analisis")]]),
    queue: queueRows(ctx.stages, ["reanalisis"], false),
    deal: (deal) => deal.lane === "reanalisis" || deal.signals.includes("re_analisis"),
    extra: (deal) => [tipoDetail(deal), deal.lift ? `levante ${deal.lift}` : null, deal.caso ? `caso ${deal.caso}` : null].filter(Boolean).join(" · "),
  };
}

function aprobacion(ctx: Ctx): Built {
  const open = ctx.deals.filter((deal) => deal.status === "open" && deal.lane === "aprobacion");
  const fha = ctx.deals.filter((deal) => deal.aprobFha === "Si");
  const banco = ctx.deals.filter((deal) => deal.aprobBanco === "Si");
  return {
    kpis: [
      kpi("Abiertos en Aprobación", count(open.length), mix(open)),
      kpi("Aprobación FHA = Sí", count(fha.length), "casi ninguno sigue en la etapa"),
      kpi("Aprobación banco = Sí", count(banco.length), "incluye tratos FHA"),
      kpi("Con los dos sí", count(fha.filter((deal) => deal.aprobBanco === "Si").length), "las dos marcas pueden convivir"),
      kpi("Fecha FHA sin el sí", count(ctx.deals.filter((deal) => deal.aprobFhaOn && deal.aprobFha !== "Si").length), "la fecha y el flag no calzan siempre"),
    ],
    charts: [
      bars("Tipo de los abiertos en la etapa", "La etapa no es la aprobación FHA.", "No hay tratos abiertos en Aprobación.", countBy(open, (deal) => deal.bucket, "bucket")),
      monthChart("Fecha de aprobación FHA en el periodo", "Campo Fecha Aprobación FHA.", signalEvents(ctx.events, "aprobacion_fha_fecha"), ctx.range, "date:aprob-fha"),
      monthChart("Fecha de aprobación de banco en el periodo", "No es la vía del banco. FHA también la trae.", signalEvents(ctx.events, "aprobacion_banco_fecha"), ctx.range, "date:aprob-banco"),
      agingChart(open),
    ],
    matrix: matrix(ctx.stages, ["aprobacion"]),
    coverage: coverage(ctx, [
      ["Aprobación FHA", (deal) => deal.aprobFha === "Si" || deal.aprobFhaOn != null],
      ["Aprobación banco", (deal) => deal.aprobBanco === "Si" || deal.aprobBancoOn != null],
    ]),
    queue: queueRows(ctx.stages, ["aprobacion"], false),
    deal: (deal) => deal.lane === "aprobacion" || deal.aprobFha === "Si" || deal.aprobBanco === "Si" || deal.signals.includes("aprobacion"),
    extra: (deal) =>
      [
        tipoDetail(deal),
        deal.aprobFhaOn ? `FHA ${deal.aprobFhaOn}` : null,
        deal.aprobBancoOn ? `banco ${deal.aprobBancoOn}` : null,
        deal.caso ? `caso ${deal.caso}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
  };
}

function tecnico(ctx: Ctx): Built {
  const lanes = ["ingreso_tecnico", "aprobacion_tecnico", "visita_tercera", "certificacion_avaluo", "expediente_tecnico"];
  const open = ctx.deals.filter((deal) => deal.status === "open" && lanes.includes(deal.lane));
  const ingreso = signalEvents(ctx.events, "ingreso_tecnico_actividad");
  const otra = signalEvents(ctx.events, "expediente_tecnico_actividad");
  const aval = signalEvents(ctx.events, "aprobacion_tecnica_actividad");
  return {
    kpis: [
      kpi("Abiertos en ingreso técnico", count(open.filter((deal) => deal.lane === "ingreso_tecnico").length), mix(open.filter((deal) => deal.lane === "ingreso_tecnico"))),
      kpi("Abiertos en certificación de avalúo", count(open.filter((deal) => deal.lane === "certificacion_avaluo").length), "el CD del nombre no es el tipo"),
      kpi("Aprobación técnica vacía", count(open.filter((deal) => deal.lane === "aprobacion_tecnico").length), "la etapa existe"),
      kpi("Visita tercera vacía", count(open.filter((deal) => deal.lane === "visita_tercera").length), "la etapa existe"),
      kpi("Fecha de aprobación técnica", count(ctx.deals.filter((deal) => deal.tecnicaOn).length), "es una fecha, no un sí"),
      kpi("Actividades de ingreso", count(ingreso.length + otra.length), "dos redacciones, no FHA contra banco"),
      kpi("Actividades de aprobación técnica", count(aval.length), dealBit(aval)),
    ],
    charts: [
      bars("Cola técnica abierta por etapa", "Solo se dibujan etapas con tratos abiertos. La matriz muestra los ceros.", "No hay tratos abiertos en las etapas técnicas.", countBy(open, (deal) => deal.stage, "stage")),
      bars("Tipo de esa cola", "Se lee el campo, no la palabra FHA o CD de la etapa.", "No hay tratos abiertos en las etapas técnicas.", countBy(open, (deal) => deal.bucket, "bucket")),
      monthChart("Aprobación técnica en el periodo", "Campo de fecha.", signalEvents(ctx.events, "aprobacion_tecnica_fecha"), ctx.range, "date:tecnica"),
      agingChart(open),
    ],
    matrix: matrix(ctx.stages, lanes),
    coverage: coverage(ctx, [
      ["Ingreso técnico, actividad", (deal) => deal.signals.includes("ingreso_tecnico_actividad") || deal.signals.includes("expediente_tecnico_actividad")],
      ["Aprobación técnica, actividad", (deal) => deal.signals.includes("aprobacion_tecnica_actividad")],
      ["Fecha de aprobación técnica", (deal) => deal.tecnicaOn != null],
    ]),
    queue: queueRows(ctx.stages, lanes, false),
    deal: (deal) =>
      lanes.includes(deal.lane) ||
      deal.tecnicaOn != null ||
      deal.signals.includes("ingreso_tecnico_actividad") ||
      deal.signals.includes("expediente_tecnico_actividad") ||
      deal.signals.includes("aprobacion_tecnica_actividad"),
    extra: (deal) => [tipoDetail(deal), deal.tecnicaOn ? `técnica ${deal.tecnicaOn}` : "sin fecha técnica", deal.caso ? `caso ${deal.caso}` : null].filter(Boolean).join(" · "),
  };
}

function final(ctx: Ctx): Built {
  const lanes = ["resguardo_fha", "resolucion_bancaria", "resguardo_resolucion", "programacion_firmas"];
  const resguardo = ctx.deals.filter((deal) => deal.status === "open" && deal.lane === "resguardo_fha");
  const resolucion = ctx.deals.filter((deal) => deal.status === "open" && deal.lane === "resolucion_bancaria");
  const firmas = ctx.deals.filter((deal) => deal.status === "open" && deal.lane === "programacion_firmas");
  return {
    kpis: [
      kpi("Abiertos en Resguardo FHA", count(resguardo.length), mix(resguardo)),
      kpi("Abiertos en Resolución Bancaria", count(resolucion.length), mix(resolucion)),
      kpi("Actividades Resguardo", count(signalEvents(ctx.events, "resguardo").length), "hechos, no la cola"),
      kpi("Actividades Resolución", count(signalEvents(ctx.events, "resolucion").length), "el asunto dice Resolución, no bancaria"),
      kpi("Programación de firmas", count(firmas.length), "etapa siguiente, no es 11.1 ni 11.2"),
    ],
    charts: [
      bars("Tipo dentro de Resguardo FHA", "La mayoría puede ser contado. El nombre de la etapa no se usó.", "No hay tratos abiertos en Resguardo FHA.", countBy(resguardo, (deal) => deal.bucket, "bucket")),
      bars("Tipo dentro de Resolución Bancaria", "Entran FHA, contado y crédito directo.", "No hay tratos abiertos en Resolución Bancaria.", countBy(resolucion, (deal) => deal.bucket, "bucket")),
      monthChart("Resguardo en el periodo", "Fecha de la actividad.", signalEvents(ctx.events, "resguardo"), ctx.range, "signal:resguardo"),
      monthChart("Resolución en el periodo", "Fecha de la actividad.", signalEvents(ctx.events, "resolucion"), ctx.range, "signal:resolucion"),
      agingChart([...resguardo, ...resolucion, ...firmas]),
    ],
    matrix: matrix(ctx.stages, lanes),
    coverage: coverage(ctx, [
      ["Actividad Resguardo", (deal) => deal.signals.includes("resguardo")],
      ["Actividad Resolución", (deal) => deal.signals.includes("resolucion")],
    ]),
    queue: queueRows(ctx.stages, lanes, false),
    deal: (deal) => lanes.includes(deal.lane) || deal.signals.includes("resguardo") || deal.signals.includes("resolucion"),
    extra: (deal) => [tipoDetail(deal), deal.banco, deal.caso ? `caso ${deal.caso}` : null].filter(Boolean).join(" · "),
  };
}

function directivo(ctx: Ctx): Built {
  const open = ctx.deals.filter((deal) => deal.status === "open");
  return {
    kpis: [
      kpi("Abiertos", count(open.length), "cola de hoy"),
      kpi("Con fecha de PCV", count(ctx.deals.filter((deal) => deal.pcvOn).length), "campo"),
      kpi("Con recepción firmada", count(ctx.deals.filter((deal) => deal.signals.includes("promesa_recepcion")).length), "actividad de Ventas, en el trato de crédito"),
      kpi("Con las dos", count(ctx.deals.filter((deal) => deal.pcvOn && deal.signals.includes("promesa_recepcion")).length), "la intersección"),
    ],
    charts: [
      bars("Tipo de los abiertos", TWO_FIELDS, "No hay tratos abiertos.", countBy(open, (deal) => deal.bucket, "bucket")),
      projectFlag(ctx, "Fecha de PCV", (deal) => deal.pcvOn != null),
      projectSignal(ctx, "Recepción de promesa firmada", "promesa_recepcion"),
    ],
    matrix: matrix(ctx.stages, null),
    coverage: coverage(ctx, [
      ["Fecha de PCV", (deal) => deal.pcvOn != null],
      ["Recepción firmada", (deal) => deal.signals.includes("promesa_recepcion")],
      ["Las dos", (deal) => deal.pcvOn != null && deal.signals.includes("promesa_recepcion")],
      ["Ninguna de las dos", (deal) => deal.pcvOn == null && !deal.signals.includes("promesa_recepcion")],
    ]),
    queue: queueRows(ctx.stages, null, true),
    deal: () => true,
    extra: (deal) => [tipoDetail(deal), deal.pcvOn ? `PCV ${deal.pcvOn}` : "sin fecha de PCV", deal.signals.includes("promesa_recepcion") ? "recepción" : "sin recepción"].join(" · "),
  };
}

function kpi(label: string, value: string, detail: string): Kpi {
  return { label, value, detail };
}

function count(value: number): string {
  return countFormat.format(value);
}

function money(value: number | null): string {
  if (value == null) return "—";
  return moneyFormat.format(value);
}

function mix(deals: Deal[]): string {
  if (deals.length === 0) return "sin tratos abiertos";
  const counts = new Map<string, number>();
  for (const deal of deals) counts.set(deal.bucket, (counts.get(deal.bucket) ?? 0) + 1);
  return [...counts.entries()].map(([bucket, total]) => `${BUCKET[bucket] ?? bucket} ${total}`).join(", ");
}

function dealBit(events: EventRow[]): string {
  return `${count(new Set(events.map((event) => event.dealId)).size)} tratos`;
}

function tipoDetail(deal: Deal): string {
  const parts: string[] = [];
  if (deal.tipoA) parts.push(`Campo ventas: ${deal.tipoA}`);
  if (deal.tipoB) parts.push(`Campo crédito: ${deal.tipoB}`);
  if (parts.length === 0) return "Sin tipo";
  return parts.join(" · ");
}

function signalEvents(events: EventRow[], signal: string): EventRow[] {
  return events.filter((event) => event.signal === signal);
}

function inRange(event: EventRow, range: Window): boolean {
  return event.eventOn != null && event.eventOn >= range.from && event.eventOn <= range.to;
}

function monthChart(title: string, note: string, events: EventRow[], range: Window, key: string): Chart {
  const dated = events.filter((event) => inRange(event, range));
  const undated = events.filter((event) => event.eventOn == null).length;
  const byMonth = new Map<string, number>();
  for (const event of dated) {
    const month = event.eventOn!.slice(0, 7);
    byMonth.set(month, (byMonth.get(month) ?? 0) + 1);
  }
  const points = [...byMonth.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, value]) => ({ label: monthName(`${month}-01`), key, value }));
  return {
    title,
    note: undated > 0 ? `${note} ${undated} sin fecha quedan fuera del gráfico.` : note,
    empty: "No hay hechos de este tipo en el periodo.",
    series: ["value"],
    points,
  };
}

function bars(title: string, note: string, empty: string, points: ChartPoint[]): Chart {
  return { title, note, empty, series: ["value"], points };
}

function countBy(deals: Deal[], labelOf: (deal: Deal) => string, prefix: string): ChartPoint[] {
  const counts = new Map<string, number>();
  for (const deal of deals) {
    const label = BUCKET[labelOf(deal)] ?? labelOf(deal);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, key: `${prefix}:${keyOf(labelOfLength(deals, labelOf, label))}`, value }));
}

function labelOfLength(deals: Deal[], labelOf: (deal: Deal) => string, shown: string): string {
  for (const deal of deals) {
    const raw = labelOf(deal);
    if ((BUCKET[raw] ?? raw) === shown) return raw;
  }
  return shown;
}

function keyOf(value: string): string {
  return value;
}

function agingChart(deals: Deal[]): Chart {
  const order = ["sin fecha", "reloj invertido", "0 a 7 días", "8 a 30 días", "31 a 90 días", "más de 90 días"];
  const counts = new Map<string, number>();
  for (const deal of deals) {
    const band = ageBand(deal.days);
    counts.set(band, (counts.get(band) ?? 0) + 1);
  }
  return {
    title: "Días en la etapa actual",
    note: "Desde que el trato entró a la etapa donde está hoy. No es el tiempo entre etapas.",
    empty: "No hay tratos en esta cola.",
    series: ["value"],
    points: order
      .filter((label) => (counts.get(label) ?? 0) > 0)
      .map((label) => ({ label, key: `age:${label}`, value: counts.get(label) ?? 0 })),
  };
}

function ageBand(days: number | null): string {
  if (days == null) return "sin fecha";
  if (days < 0) return "reloj invertido";
  if (days <= 7) return "0 a 7 días";
  if (days <= 30) return "8 a 30 días";
  if (days <= 90) return "31 a 90 días";
  return "más de 90 días";
}

function projectSignal(ctx: Ctx, title: string, signal: string): Chart {
  return projectFlag(ctx, title, (deal) => deal.signals.includes(signal));
}

function projectFlag(ctx: Ctx, title: string, present: (deal: Deal) => boolean): Chart {
  const points: ChartPoint[] = [];
  const silent: string[] = [];
  const projects = scopeProjects(ctx.projectSlug);
  for (const project of projects) {
    const rows = ctx.deals.filter((deal) => deal.projectSlug === project.slug);
    if (rows.length === 0) {
      silent.push(`${project.name} sin tratos`);
      continue;
    }
    const value = rows.filter(present).length;
    if (value === 0) silent.push(`${project.name} sin registro`);
    else points.push({ label: project.name, key: `project:${project.slug}`, value });
  }
  return {
    title,
    note: silent.length > 0 ? silent.join(". ") + "." : "Proyectos con al menos un registro.",
    empty: "No hay registro de este dato en el extracto.",
    series: ["value"],
    points,
  };
}

function blankNote(deals: Deal[], value: (deal: Deal) => string | null, emptyLabel: string): string {
  const missing = deals.filter((deal) => !value(deal)).length;
  return `${emptyLabel}: ${count(missing)}. Esos tratos no entran en las barras.`;
}

function matrix(stages: Stage[], lanes: string[] | null): MatrixRow[] {
  const meta = new Map<string, { label: string; order: number; scope: string }>();
  for (const stage of stages) {
    if (lanes && !lanes.includes(stage.lane)) continue;
    if (!meta.has(stage.lane)) meta.set(stage.lane, { label: stage.laneLabel, order: stage.laneOrder, scope: stage.scope });
  }
  const projects = PROJECTS.filter((project) => stages.some((stage) => stage.projectSlug === project.slug));
  return [...meta.entries()]
    .sort((a, b) => a[1].order - b[1].order)
    .map(([lane, row]) => ({
      lane: row.label,
      scope: SCOPE[row.scope] ?? row.scope,
      cells: projects.map((project) => {
        const found = stages.find((stage) => stage.lane === lane && stage.projectSlug === project.slug);
        return { project: project.name, text: found ? String(found.open) : "—" };
      }),
    }));
}

function queueRows(stages: Stage[], lanes: string[] | null, onlyOccupied: boolean): QueueRow[] {
  return stages
    .filter((stage) => (lanes ? lanes.includes(stage.lane) : true))
    .filter((stage) => (onlyOccupied ? stage.open + stage.lost + stage.won > 0 : true))
    .sort((a, b) => a.sort - b.sort || a.stageOrder - b.stageOrder)
    .map((stage) => ({
      project: stage.project,
      stage: stage.stage,
      open: stage.open,
      lost: stage.lost,
      won: stage.won,
      median: stage.median == null ? "—" : count(Math.round(stage.median)),
    }));
}

function coverage(ctx: Ctx, measures: [string, (deal: Deal) => boolean][]): CoverageRow[] {
  const projects = scopeProjects(ctx.projectSlug);
  return measures.map(([measure, present]) => ({
    measure,
    cells: projects.map((project) => {
      const rows = ctx.deals.filter((deal) => deal.projectSlug === project.slug);
      if (rows.length === 0) return { project: project.name, text: "sin tratos" };
      const total = rows.filter(present).length;
      return { project: project.name, text: total === 0 ? "sin registro" : count(total) };
    }),
  }));
}

function sumGtq(
  deals: Deal[],
  pick: (deal: Deal) => { amount: number | null; currency: string | null },
): { total: number | null; detail: string } {
  let total = 0;
  let withAmount = 0;
  let zeros = 0;
  let missing = 0;
  const other = new Map<string, number>();
  for (const deal of deals) {
    const { amount, currency } = pick(deal);
    if (amount == null) {
      missing += 1;
      continue;
    }
    const code = (currency ?? "").toUpperCase();
    if (code !== "GTQ") {
      if (code) other.set(code, (other.get(code) ?? 0) + 1);
      else missing += 1;
      continue;
    }
    total += amount;
    withAmount += 1;
    if (amount === 0) zeros += 1;
  }
  const extra = [...other.entries()].map(([code, totalOther]) => `${totalOther} en ${code} no se suman`).join(". ");
  return {
    total: withAmount > 0 ? total : null,
    detail: `${count(withAmount)} con monto en quetzales, ${count(zeros)} en cero, ${count(missing)} sin monto${extra ? `. ${extra}` : ""}`,
  };
}

function toRow(deal: Deal, extra: (deal: Deal) => string): DealRow {
  return {
    id: deal.id,
    title: deal.title || `Trato ${deal.id}`,
    project: deal.project,
    stage: deal.stage,
    status: STATUS[deal.status] ?? deal.status,
    tipo: BUCKET[deal.bucket] ?? deal.bucket,
    days: deal.days == null ? "sin fecha" : count(deal.days),
    entered: deal.entered ?? "sin fecha",
    extra: extra(deal),
    keys: deal.keys,
  };
}

async function loadBundle(): Promise<Bundle> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.bundle;
  const db = createAdminClient().schema("creditos");
  const [dealRows, stageRows, eventRows, loadedAt] = await Promise.all([
    fetchAll<Record<string, unknown>>(db, "v_deal", DEAL_COLUMNS, "pipedrive_deal_id"),
    fetchAll<Record<string, unknown>>(db, "v_open_stage", STAGE_COLUMNS, "project_sort,stage_order"),
    fetchAll<Record<string, unknown>>(db, "v_event", EVENT_COLUMNS, "source,signal,ref_id"),
    latestFactLoadedAt(db),
  ]);
  const deals = dealRows.map(mapDeal);
  const noteDeals = new Set(eventRows.filter((row) => row.signal === "nota_escaner").map((row) => Number(row.pipedrive_deal_id)));
  for (const deal of deals) {
    if (noteDeals.has(deal.id)) deal.keys.push("file:note");
  }
  const bundle = { deals, stages: stageRows.map(mapStage), events: eventRows.map(mapEvent), loadedAt };
  cache = { at: Date.now(), bundle };
  return bundle;
}

const DEAL_COLUMNS = [
  "pipedrive_deal_id",
  "title",
  "project_slug",
  "project_name",
  "stage_name",
  "lane_key",
  "status",
  "currency",
  "value_amount",
  "monto_prestamo",
  "monto_prestamo_currency",
  "enganche_pactado",
  "enganche_currency",
  "tipo_a_label",
  "tipo_b_label",
  "tipo_bucket",
  "banco_label",
  "coordinadora_label",
  "caso_fha_text",
  "apartamento",
  "days_in_stage",
  "entered_on",
  "lost_reason",
  "armado_label",
  "armado_on",
  "ingreso_analisis_label",
  "ingreso_analisis_on",
  "suspendido_fha_on",
  "suspendido_banco_on",
  "suspension_levantada_on",
  "aprobacion_fha_label",
  "aprobacion_fha_on",
  "aprobacion_banco_label",
  "aprobacion_banco_on",
  "aprobacion_tecnica_on",
  "fecha_pcv_on",
  "signals",
  "file_scanner",
  "file_scanner_strict",
  "file_pcv",
  "file_numbered",
  "file_declaracion",
  "papeleria_vencida",
].join(",");

const STAGE_COLUMNS = [
  "project_slug",
  "project_name",
  "project_sort",
  "stage_name",
  "lane_key",
  "lane_label",
  "lane_order",
  "stage_order",
  "stage_scope",
  "open_n",
  "lost_n",
  "won_n",
  "median_days",
  "open_without_entry",
].join(",");

const EVENT_COLUMNS = "source,signal,project_slug,event_on,pipedrive_deal_id,tipo_bucket,ref_id";

async function latestFactLoadedAt(
  db: ReturnType<ReturnType<typeof createAdminClient>["schema"]>,
): Promise<string | null> {
  const { data, error } = await db
    .from("fact_deal")
    .select("loaded_at")
    .order("loaded_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw explain(error);
  if (data == null || typeof data !== "object") return null;
  const raw = "loaded_at" in data ? data.loaded_at : null;
  return isoLoadedAt(raw);
}

function isoLoadedAt(value: unknown): string | null {
  if (value == null) return null;
  const raw = value instanceof Date ? value.toISOString() : text(value);
  if (raw == null) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

async function fetchAll<T>(
  db: ReturnType<ReturnType<typeof createAdminClient>["schema"]>,
  table: string,
  columns: string,
  order: string,
): Promise<T[]> {
  const rows: T[] = [];
  for (let start = 0; ; start += 1000) {
    let query = db.from(table).select(columns);
    for (const column of order.split(",")) query = query.order(column);
    const { data, error } = await query.range(start, start + 999);
    if (error) throw explain(error);
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < 1000) break;
  }
  return rows;
}

function explain(error: { message: string; code?: string }): Error {
  const message = error.message || "No se pudo leer Créditos";
  if (error.code === "PGRST106" || /Invalid schema|schema must be/i.test(message)) {
    return new Error("El esquema creditos no está expuesto en la API. Hay que correr la migración 082 y agregarlo en Exposed schemas.");
  }
  if (/does not exist|Could not find the table|schema cache/i.test(message)) {
    return new Error("Falta el esquema creditos. Hay que correr la migración 082 en el editor SQL de Supabase.");
  }
  return new Error(message);
}

function mapDeal(row: Record<string, unknown>): Deal {
  const id = Number(row.pipedrive_deal_id);
  const bucket = String(row.tipo_bucket ?? "sin_dato");
  const signals = asList(row.signals);
  const days = num(row.days_in_stage);
  const entered = text(row.entered_on);
  const banco = text(row.banco_label);
  const coordinadora = text(row.coordinadora_label);
  const lane = String(row.lane_key ?? "");
  const stage = String(row.stage_name ?? "");
  const keys = [
    `lane:${lane}`,
    `status:${row.status ?? ""}`,
    `bucket:${bucket}`,
    `stage:${stage}`,
    `project:${row.project_slug ?? ""}`,
    `age:${ageBand(days)}`,
    ...signals.map((signal) => `signal:${signal}`),
  ];
  if (text(row.armado_on)) keys.push("date:armado");
  if (text(row.ingreso_analisis_on)) keys.push("date:ingreso");
  if (text(row.suspendido_fha_on)) keys.push("date:susp-fha");
  if (text(row.suspendido_banco_on)) keys.push("date:susp-banco");
  if (text(row.aprobacion_fha_on)) keys.push("date:aprob-fha");
  if (text(row.aprobacion_banco_on)) keys.push("date:aprob-banco");
  if (text(row.aprobacion_tecnica_on)) keys.push("date:tecnica");
  if (text(row.fecha_pcv_on)) keys.push("date:pcv");
  if (row.file_scanner === true) keys.push("file:scanner");
  if (row.file_scanner_strict === true) keys.push("file:strict");
  if (row.file_pcv === true) keys.push("file:pcv");
  if (row.file_numbered === true) keys.push("file:numbered");
  if (banco) keys.push(`banco:${banco}`);
  if (coordinadora) keys.push(`coord:${coordinadora}`);
  else keys.push("coord:Sin dato");
  keys.push(`motivo:${text(row.lost_reason) || "Sin motivo"}`);
  return {
    id,
    title: text(row.title) ?? "",
    project: String(row.project_name ?? ""),
    projectSlug: String(row.project_slug ?? ""),
    stage,
    lane,
    status: String(row.status ?? ""),
    bucket,
    tipoA: text(row.tipo_a_label),
    tipoB: text(row.tipo_b_label),
    banco,
    coordinadora,
    caso: text(row.caso_fha_text),
    apartamento: text(row.apartamento),
    days,
    entered,
    value: num(row.value_amount),
    valueCurrency: text(row.currency),
    prestamo: num(row.monto_prestamo),
    prestamoCurrency: text(row.monto_prestamo_currency),
    enganche: num(row.enganche_pactado),
    engancheCurrency: text(row.enganche_currency),
    lostReason: text(row.lost_reason),
    armado: text(row.armado_label),
    armadoOn: text(row.armado_on),
    ingreso: text(row.ingreso_analisis_label),
    ingresoOn: text(row.ingreso_analisis_on),
    suspFha: text(row.suspendido_fha_on),
    suspBanco: text(row.suspendido_banco_on),
    lift: text(row.suspension_levantada_on),
    aprobFha: text(row.aprobacion_fha_label),
    aprobFhaOn: text(row.aprobacion_fha_on),
    aprobBanco: text(row.aprobacion_banco_label),
    aprobBancoOn: text(row.aprobacion_banco_on),
    tecnicaOn: text(row.aprobacion_tecnica_on),
    pcvOn: text(row.fecha_pcv_on),
    signals,
    fileScanner: row.file_scanner === true,
    fileStrict: row.file_scanner_strict === true,
    filePcv: row.file_pcv === true,
    fileNumbered: row.file_numbered === true,
    fileDeclaracion: row.file_declaracion === true,
    papeleria: text(row.papeleria_vencida),
    keys,
  } as Deal;
}

function mapStage(row: Record<string, unknown>): Stage {
  return {
    projectSlug: String(row.project_slug ?? ""),
    project: String(row.project_name ?? ""),
    sort: Number(row.project_sort ?? 0),
    stage: String(row.stage_name ?? ""),
    lane: String(row.lane_key ?? ""),
    laneLabel: String(row.lane_label ?? ""),
    laneOrder: Number(row.lane_order ?? 0),
    stageOrder: Number(row.stage_order ?? 0),
    scope: String(row.stage_scope ?? ""),
    open: Number(row.open_n ?? 0),
    lost: Number(row.lost_n ?? 0),
    won: Number(row.won_n ?? 0),
    median: num(row.median_days),
    openWithoutEntry: Number(row.open_without_entry ?? 0),
  };
}

function mapEvent(row: Record<string, unknown>): EventRow {
  return {
    source: String(row.source ?? ""),
    signal: String(row.signal ?? ""),
    projectSlug: String(row.project_slug ?? ""),
    eventOn: text(row.event_on),
    dealId: Number(row.pipedrive_deal_id),
    bucket: String(row.tipo_bucket ?? ""),
  };
}

function asList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string" && value.startsWith("{") && value.endsWith("}")) {
    return value
      .slice(1, -1)
      .split(",")
      .map((item) => item.replace(/^"|"$/g, "").trim())
      .filter(Boolean);
  }
  return [];
}

function num(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function text(value: unknown): string | null {
  if (value == null) return null;
  const parsed = String(value).trim();
  return parsed === "" ? null : parsed;
}
