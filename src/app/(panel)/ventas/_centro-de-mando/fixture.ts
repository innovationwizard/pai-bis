/**
 * Captura SSOT del 2026-11-06, leída de Pipedrive Insights.
 * Fuente: docs/redesign/reference/ssot-1-general.png y ssot-2-proyectos.png.
 * Periodo Mes pasado (octubre 2026). Métrica: Cantidad de actividades.
 * Tipo de actividad: Reserva. Estado: Finalizada.
 * No es una consulta en vivo. No mezclar con ventas.v_sale.
 */

export type Advisor = {
  id: string;
  name: string;
  reservas: number;
};

export type Project = {
  id: string;
  label: string;
  ssotLabel: string;
  reservas: number;
  change: number;
  changeLabel: string;
  advisors: readonly Advisor[];
  /** Orden del filtro de asesores en el panel del proyecto. */
  advisorFilter: readonly string[];
  /** Nombres del filtro sin barra. La captura no trae su cantidad. */
  filterWithoutBar: readonly string[];
  pipelines: readonly string[];
};

export type Fixture = {
  badge: string;
  periodChip: string;
  period: string;
  month: string;
  activity: string;
  status: string;
  metric: string;
  pipelines: readonly string[];
  total: {
    reservas: number;
    change: number;
    changeLabel: string;
  };
  projects: readonly Project[];
};

export const FIXTURE: Fixture = {
  badge: "Captura SSOT · 6 nov 2026",
  periodChip: "Mes pasado · oct 2026",
  period: "Mes pasado",
  month: "octubre 2026",
  activity: "Reserva",
  status: "Finalizada",
  metric: "Cantidad de actividades",
  pipelines: [
    "Benestare",
    "Bosque Las Tapias",
    "Boulevard5",
    "Créditos BLT",
    "Créditos BLV5",
    "Créditos Benestare",
  ],
  total: {
    reservas: 27,
    change: 11,
    changeLabel: "+11 (68.75%)",
  },
  projects: [
    {
      id: "benestare",
      label: "Benestare",
      ssotLabel: "Benestare",
      reservas: 15,
      change: 8,
      changeLabel: "+8 (114.29%)",
      advisors: [
        { id: "rony-ramirez", name: "Rony Ramirez", reservas: 10 },
        { id: "ivan-castillo", name: "Ivan Castillo", reservas: 5 },
      ],
      advisorFilter: ["Daniel Veliz", "Javier Soto", "Efren Sánchez", "Rony Ramirez", "Ivan Castillo"],
      filterWithoutBar: ["Daniel Veliz", "Javier Soto", "Efren Sánchez"],
      pipelines: ["Benestare", "Créditos Benestare", "Eventos Benestare"],
    },
    {
      id: "boulevard-5",
      label: "Boulevard 5",
      ssotLabel: "BLV5",
      reservas: 7,
      change: 3,
      changeLabel: "+3 (75%)",
      advisors: [
        { id: "erwin-cardona", name: "Erwin Cardona", reservas: 4 },
        { id: "brenda-perez", name: "Brenda Pérez", reservas: 3 },
      ],
      advisorFilter: ["Erwin Cardona", "Jose Gutierrez", "Brenda Pérez"],
      filterWithoutBar: ["Jose Gutierrez"],
      pipelines: ["Boulevard5", "Créditos BLV5"],
    },
    {
      id: "bosque-las-tapias",
      label: "Bosque Las Tapias",
      ssotLabel: "BLT",
      reservas: 5,
      change: 0,
      changeLabel: "0 (0%)",
      advisors: [
        { id: "paula-hernandez", name: "Paula Hernandez", reservas: 4 },
        { id: "javier-soto", name: "Javier Soto", reservas: 1 },
      ],
      advisorFilter: ["Jose Gutierrez", "Paula Hernandez", "Javier Soto", "Anahi Cisneros"],
      filterWithoutBar: ["Jose Gutierrez", "Anahi Cisneros"],
      pipelines: ["Bosque Las Tapias", "Créditos BLT"],
    },
  ],
};
