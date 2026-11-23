"use client";

import type { CasoVista, DescuentoVista, DesistenciaVista, PrecioVista, PromoVista, VentasVista } from "@/lib/ventas/vista-types";
import { ControlCasos } from "./casos";
import { ControlDescuentos } from "./descuentos";
import { ControlPromociones } from "./promociones";
import { ControlSubidas } from "./subidas";
import { Desistimientos } from "./desistimientos";

export function isControlVista(vista: VentasVista): vista is DesistenciaVista | DescuentoVista | PrecioVista | CasoVista | PromoVista {
  return vista.section === "desistimientos" || vista.section === "descuentos" || vista.section === "subidas-de-precios" || vista.section === "ff-y-casos-especiales" || vista.section === "promociones";
}

export function ControlScreens({ vista }: { vista: DesistenciaVista | DescuentoVista | PrecioVista | CasoVista | PromoVista }) {
  if (vista.section === "desistimientos") return <Desistimientos vista={vista} pending={null} />;
  if (vista.section === "descuentos") return <ControlDescuentos vista={vista} pending={null} />;
  if (vista.section === "subidas-de-precios") return <ControlSubidas vista={vista} pending={null} />;
  if (vista.section === "ff-y-casos-especiales") return <ControlCasos vista={vista} pending={null} />;
  return <ControlPromociones vista={vista} pending={null} />;
}
