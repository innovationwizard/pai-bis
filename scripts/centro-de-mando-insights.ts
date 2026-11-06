import { FIXTURE } from "../src/app/(panel)/ventas/_centro-de-mando/fixture";
import { previousOf } from "../src/app/(panel)/ventas/_centro-de-mando/format";
import { insightLines } from "../src/app/(panel)/ventas/_centro-de-mando/insights";
import { sunburstArcs } from "../src/app/(panel)/ventas/_centro-de-mando/model";

const lines = insightLines(FIXTURE);
const required = [
  "Benestare aporta 8 de las 11 reservas adicionales (72.7%).",
  "Rony Ramirez concentra 10 de 27 reservas (37.0%).",
  "Bosque Las Tapias no cambió frente al mes anterior (0).",
  "Rony Ramirez lidera Benestare con 10 de 15 reservas (66.7%).",
  "Erwin Cardona lidera Boulevard 5 con 4 de 7 reservas (57.1%).",
  "Paula Hernandez lidera Bosque Las Tapias con 4 de 5 reservas (80.0%).",
];

for (const line of required) {
  if (!lines.includes(line)) {
    throw new Error(`Falta el renglón: ${line}\n${lines.join("\n")}`);
  }
}

if (previousOf(FIXTURE.total.reservas, FIXTURE.total.change) !== 16) {
  throw new Error("mes anterior del total");
}

const previousByProject = FIXTURE.projects.map((project) => previousOf(project.reservas, project.change));
if (previousByProject.join(",") !== "7,4,5") {
  throw new Error(`mes anterior por proyecto: ${previousByProject.join(",")}`);
}

const arcs = sunburstArcs();
const advisors = arcs.filter((arc) => arc.kind === "advisor");
const sum = advisors.reduce((total, arc) => total + arc.reservas, 0);
if (arcs.length !== 9 || sum !== 27) {
  throw new Error(`arcos ${arcs.length}, suma ${sum}`);
}
