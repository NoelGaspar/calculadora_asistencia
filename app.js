(() => {
  const $ = (id) => document.getElementById(id);
  const els = {
    absences: $("absences"), attPct: $("attPct"),
    today: $("today"), endDate: $("endDate"), minPct: $("minPct"),
    includeToday: $("includeToday"), holidays: $("holidays"),
    derived: $("derived"), remainingInfo: $("remainingInfo"),
    result: $("result"), calendarCard: $("calendarCard"), days: $("days"),
  };

  // Días de clases transcurridos que se asumen cuando hay 0 inasistencias y 100% de asistencia.
  // 184 = días hábiles del 02-03-2026 al 23-11-2026 descontando feriados nacionales de Chile
  // (no descuenta vacaciones de invierno). Reemplazar por el dato real del colegio.
  const DEFAULT_ELAPSED = 174;

  // ---------- Fechas (siempre en hora local, sin desfase UTC) ----------
  const pad = (n) => String(n).padStart(2, "0");
  const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseISO = (s) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((s || "").trim());
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  };
  const fmtLong = new Intl.DateTimeFormat("es-CL", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const fmtShort = new Intl.DateTimeFormat("es-CL", { weekday: "short", day: "numeric", month: "short" });

  function schoolDaysBetween(from, to, holidaySet) {
    const days = [];
    const d = new Date(from);
    while (d <= to) {
      const wd = d.getDay();
      if (wd !== 0 && wd !== 6 && !holidaySet.has(toISO(d))) days.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    return days;
  }

  // ---------- Lectura de entradas ----------
  const num = (el) => {
    const v = el.value.trim().replace(",", ".");
    if (v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : NaN;
  };

  function readCurrent() {
    const A = num(els.absences), att = num(els.attPct);
    if ([A, att].some(Number.isNaN)) return { error: "Revisa los valores: deben ser números positivos." };
    if (A === null || att === null) return { incomplete: true };
    if (!Number.isInteger(A)) return { error: "Las inasistencias deben ser un número entero de días." };
    if (att > 100) return { error: "El porcentaje de asistencia no puede superar 100%." };

    const P = 100 - att; // % de inasistencia
    if (A === 0) {
      if (P > 0) return { error: "Con 0 inasistencias la asistencia debería ser 100%. Revisa los datos." };
      // Sin faltas no se pueden deducir los días transcurridos: se usa un valor por defecto.
      return { E: DEFAULT_ELAPSED, A: 0, note: `Sin inasistencias: se asumen ${DEFAULT_ELAPSED} días de clases transcurridos (valor estimado).` };
    }
    if (P === 0) return { error: "Si tiene inasistencias, la asistencia no puede ser 100%. Revisa los datos." };

    const E = Math.round(A / (P / 100)); // días de clases transcurridos
    if (A > E) return { error: "Los datos no son consistentes. Revisa las inasistencias y el porcentaje." };
    return { E, A, note: `Días de clases transcurridos estimados: ${E}.` };
  }

  // ---------- Cálculo principal ----------
  function render() {
    const cur = readCurrent();
    els.derived.textContent = cur.note || "";

    const today = parseISO(els.today.value);
    const end = parseISO(els.endDate.value);
    const minPct = num(els.minPct);
    const holidaySet = new Set(
      els.holidays.value.split(/\s+/).map((s) => s.trim()).filter((s) => parseISO(s))
    );

    if (!today || !end) return showMessage("Indica la fecha de hoy y el último día de clases.");
    const start = new Date(today);
    if (!els.includeToday.checked) start.setDate(start.getDate() + 1);
    const remaining = start <= end ? schoolDaysBetween(start, end, holidaySet) : [];
    const R = remaining.length;
    els.remainingInfo.textContent = `Quedan ${R} día(s) hábil(es) de clases desde ${start <= end ? fmtShort.format(start) : "—"} hasta ${fmtShort.format(end)}.`;

    if (cur.error) return showMessage(cur.error, "bad");
    if (cur.incomplete) return showMessage("Completa al menos dos campos de tu situación actual.");
    if (!minPct || minPct > 100) return showMessage("Indica un porcentaje mínimo válido.", "bad");

    const { E, A } = cur;
    const T = E + R;                                   // total de días del año
    const maxAbs = Math.floor(T * (1 - minPct / 100) + 1e-9); // faltas máximas permitidas
    const slack = maxAbs - A;                          // faltas que aún puede tener
    const bestPct = T ? ((T - A) / T) * 100 : 100;     // si asiste a todo lo que queda
    const currentPct = E ? ((E - A) / E) * 100 : 100;

    const stats = (extra = "") => `
      <div class="stats">
        <div class="stat"><b>${currentPct.toFixed(1)}%</b><span>Asistencia actual</span></div>
        <div class="stat"><b>${R}</b><span>Días hábiles restantes</span></div>
        <div class="stat"><b>${T}</b><span>Total días del año</span></div>
        <div class="stat"><b>${maxAbs}</b><span>Faltas máximas permitidas (${(100 - minPct).toFixed(1)}%)</span></div>
        ${extra}
      </div>`;

    if (slack < 0) {
      const pctNoFalta = bestPct.toFixed(1);
      els.result.className = "card result bad";
      els.result.innerHTML = `
        <p class="big">No es posible llegar al ${minPct}%</p>
        <p>Aunque asista a <strong>todos</strong> los ${R} días restantes, la asistencia final sería de <strong>${pctNoFalta}%</strong>.
        Tiene ${A} inasistencias y el máximo permitido es ${maxAbs} (sobran ${-slack}).
        Conviene revisar con el establecimiento si hay justificaciones médicas u otras alternativas.</p>
        ${stats(`<div class="stat"><b>${pctNoFalta}%</b><span>Máximo alcanzable</span></div>`)}`;
      return renderDays(remaining, R);
    }

    const mustAttend = Math.max(0, R - slack);
    if (mustAttend === 0) {
      els.result.className = "card result ok";
      els.result.innerHTML = `
        <p class="big">Ya tiene la asistencia asegurada 🎉</p>
        <p>Incluso faltando a los ${R} días restantes, terminaría con
        <strong>${(((E - A) / T) * 100).toFixed(1)}%</strong> de asistencia.</p>
        ${stats(`<div class="stat"><b>${slack}</b><span>Faltas de margen</span></div>`)}`;
      return renderDays(remaining, 0);
    }

    const lastDay = remaining[mustAttend - 1];
    const finalPct = (((T - A - (R - mustAttend)) / T) * 100).toFixed(1);
    const tight = slack <= 2;
    els.result.className = `card result ${tight ? "warn" : "ok"}`;
    els.result.innerHTML = `
      <p>Debe asistir todos los días, sin faltar, hasta el</p>
      <p class="big"><span class="date">${fmtLong.format(lastDay)}</span></p>
      <p>Son <strong>${mustAttend} día(s)</strong> de asistencia obligatoria de los ${R} restantes.
      ${slack > 0
        ? `Le quedan <strong>${slack} falta(s) de margen</strong> en total; si falta antes de esa fecha, la fecha se corre un día hábil por cada falta.`
        : `<strong>No le queda ningún margen</strong>: debe asistir a todos los días restantes.`}
      Con esto terminaría con <strong>${finalPct}%</strong> de asistencia.</p>
      ${stats(`<div class="stat"><b>${slack}</b><span>Faltas de margen</span></div>`)}`;
    renderDays(remaining, mustAttend);
  }

  function renderDays(days, mustAttend) {
    els.calendarCard.hidden = days.length === 0;
    els.days.innerHTML = days.map((d, i) => {
      const cls = i < mustAttend ? (i === mustAttend - 1 ? "last" : "") : "free";
      return `<li class="${cls}">${fmtShort.format(d)}</li>`;
    }).join("");
  }

  function showMessage(msg, kind = "") {
    els.result.className = `card result ${kind}`;
    els.result.innerHTML = `<p class="${kind ? "" : "muted"}">${msg}</p>`;
    els.calendarCard.hidden = true;
  }

  // ---------- Inicialización ----------
  els.today.value = toISO(new Date());
  document.querySelectorAll("input, textarea").forEach((el) => el.addEventListener("input", render));
  render();
})();
