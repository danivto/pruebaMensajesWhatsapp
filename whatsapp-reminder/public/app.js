// app.js — lógica de la interfaz (navegador)
// -----------------------------------------------------------------------------

const socket = io();

// Iconos SVG (estilo línea, profesionales) usados en el log de envío.
const IC_OK =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#16a34a" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
const IC_FAIL =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#dc2626" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
const IC_DONE =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#0f766e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/></svg>';

// Estado en memoria
let pacientes = [];        // pacientes cargados del CSV
let whatsappListo = false; // ¿WhatsApp conectado?

// ── Referencias del DOM ───────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const statusBadge = $("statusBadge");
const statusText = $("statusText");
const qrImg = $("qrImg");
const qrPlaceholder = $("qrPlaceholder");
const qrHelp = $("qrHelp");
const conectadoBox = $("conectadoBox");
const dropZone = $("dropZone");
const fileInput = $("fileInput");
const statsRow = $("statsRow");
const previewWrap = $("previewWrap");
const tbody = document.querySelector("#tablaPacientes tbody");
const btnEnviar = $("btnEnviar");
const hintEnvio = $("hintEnvio");
const cardLog = $("cardLog");
const logBox = $("log");
const progressBar = $("progressBar");
const progressPct = $("progressPct");

// ── 1. Estado de conexión de WhatsApp (vía WebSocket) ─────────────────────────
socket.on("estado", ({ estado, qr }) => {
  if (estado === "conectado") {
    whatsappListo = true;
    statusBadge.className = "badge badge--ok";
    statusText.textContent = "WhatsApp conectado";
    qrImg.classList.add("hidden");
    qrPlaceholder.classList.add("hidden");
    qrHelp.classList.add("hidden");
    conectadoBox.classList.remove("hidden");
  } else if (estado === "qr" && qr) {
    whatsappListo = false;
    statusBadge.className = "badge badge--wait";
    statusText.textContent = "Escanea el código QR";
    qrImg.src = qr;
    qrImg.classList.remove("hidden");
    qrPlaceholder.classList.add("hidden");
    qrHelp.classList.remove("hidden");
    conectadoBox.classList.add("hidden");
  } else {
    whatsappListo = false;
    statusBadge.className = "badge badge--wait";
    statusText.textContent = estado === "cerrado" ? "Reconectando…" : "Conectando…";
    qrPlaceholder.classList.remove("hidden");
    qrImg.classList.add("hidden");
  }
  actualizarBotonEnviar();
});

// ── 2. Carga de CSV ───────────────────────────────────────────────────────────
dropZone.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", (e) => {
  if (e.target.files.length) leerArchivo(e.target.files[0]);
});
["dragover", "dragenter"].forEach((ev) =>
  dropZone.addEventListener(ev, (e) => { e.preventDefault(); dropZone.classList.add("drag"); })
);
["dragleave", "drop"].forEach((ev) =>
  dropZone.addEventListener(ev, (e) => { e.preventDefault(); dropZone.classList.remove("drag"); })
);
dropZone.addEventListener("drop", (e) => {
  const f = e.dataTransfer.files[0];
  if (f) leerArchivo(f);
});

function leerArchivo(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      pacientes = parsearCSV(reader.result);
      if (pacientes.length === 0) {
        alert("El CSV no contiene filas válidas.");
        return;
      }
      renderTabla();
    } catch (err) {
      alert("No se pudo leer el CSV: " + err.message);
    }
  };
  reader.readAsText(file, "UTF-8");
}

// Parser CSV que soporta comas dentro de comillas y detecta cabecera.
function parsearCSV(texto) {
  const filas = dividirFilas(texto).filter((f) => f.trim() !== "");
  if (filas.length < 2) return [];

  const cabeceras = partirLinea(filas[0]).map((h) =>
    h.trim().toLowerCase().replace(/^"|"$/g, "")
  );

  const resultado = [];
  for (let i = 1; i < filas.length; i++) {
    const celdas = partirLinea(filas[i]);
    if (celdas.every((c) => c.trim() === "")) continue;
    const obj = {};
    cabeceras.forEach((h, idx) => {
      obj[h] = (celdas[idx] || "").trim().replace(/^"|"$/g, "");
    });
    resultado.push(obj);
  }
  return resultado;
}

// Divide el texto en filas respetando comillas (una celda puede tener saltos).
function dividirFilas(texto) {
  const filas = [];
  let actual = "";
  let dentroComillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (c === '"') dentroComillas = !dentroComillas;
    if ((c === "\n" || c === "\r") && !dentroComillas) {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      filas.push(actual);
      actual = "";
    } else {
      actual += c;
    }
  }
  if (actual !== "") filas.push(actual);
  return filas;
}

// Divide una línea en celdas respetando comillas.
function partirLinea(linea) {
  const celdas = [];
  let actual = "";
  let dentroComillas = false;
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (c === '"') {
      dentroComillas = !dentroComillas;
    } else if (c === "," && !dentroComillas) {
      celdas.push(actual);
      actual = "";
    } else {
      actual += c;
    }
  }
  celdas.push(actual);
  return celdas;
}

// ── 3. Render de la tabla de vista previa ─────────────────────────────────────
function renderTabla() {
  tbody.innerHTML = "";
  pacientes.forEach((p, i) => {
    const tr = document.createElement("tr");
    tr.id = "fila-" + i;
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${escapar(p.paciente)}</td>
      <td>${escapar(p.especialidad)}</td>
      <td>${escapar(p.fecha)}</td>
      <td>${escapar(p.hora)}</td>
      <td>${escapar(p.telefono)}</td>`;
    tbody.appendChild(tr);
  });

  previewWrap.classList.remove("hidden");
  statsRow.classList.remove("hidden");
  $("statTotal").textContent = pacientes.length;
  $("statOk").textContent = "0";
  $("statFail").textContent = "0";
  actualizarBotonEnviar();
}

function escapar(t) {
  return String(t ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}

// ── 4. Habilitar / deshabilitar el botón de envío ─────────────────────────────
function actualizarBotonEnviar() {
  const listo = whatsappListo && pacientes.length > 0;
  btnEnviar.disabled = !listo;
  if (!whatsappListo) hintEnvio.textContent = "Conecta WhatsApp escaneando el QR.";
  else if (pacientes.length === 0) hintEnvio.textContent = "Carga un archivo CSV con los pacientes.";
  else hintEnvio.textContent = `Listo para enviar ${pacientes.length} recordatorio(s).`;
}

// ── 5. Envío ──────────────────────────────────────────────────────────────────
btnEnviar.addEventListener("click", async () => {
  if (!confirm(`¿Enviar ${pacientes.length} recordatorio(s) por WhatsApp?`)) return;

  btnEnviar.disabled = true;
  btnEnviar.textContent = "Enviando…";
  cardLog.classList.remove("hidden");
  logBox.innerHTML = "";
  progressBar.style.width = "0%";
  progressPct.textContent = "0%";
  cardLog.scrollIntoView({ behavior: "smooth" });

  try {
    const r = await fetch("/enviar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pacientes }),
    });
    const data = await r.json();
    if (!r.ok) {
      alert(data.error || "Error al iniciar el envío.");
      btnEnviar.disabled = false;
      btnEnviar.textContent = "Enviar recordatorios";
    }
  } catch (err) {
    alert("No se pudo conectar con el servidor: " + err.message);
    btnEnviar.disabled = false;
    btnEnviar.textContent = "Enviar recordatorios";
  }
});

// Progreso en tiempo real
socket.on("progreso", (d) => {
  const item = document.createElement("div");
  item.className = "log-item " + (d.ok ? "ok" : "fail");
  item.innerHTML = `
    <span class="log-ic">${d.ok ? IC_OK : IC_FAIL}</span>
    <span><strong>${escapar(d.paciente || "—")}</strong> · ${escapar(d.telefono)}
      ${d.ok ? "" : `<br><small style="color:#dc2626">${escapar(d.error || "")}</small>`}
    </span>
    <small>#${d.index + 1}</small>`;
  logBox.appendChild(item);
  logBox.scrollTop = logBox.scrollHeight;

  const fila = $("fila-" + d.index);
  if (fila) fila.classList.add(d.ok ? "row-ok" : "row-fail");

  const done = logBox.children.length;
  const pct = Math.round((done / pacientes.length) * 100);
  progressBar.style.width = pct + "%";
  progressPct.textContent = pct + "%";

  const ok = +$("statOk").textContent + (d.ok ? 1 : 0);
  const fail = +$("statFail").textContent + (d.ok ? 0 : 1);
  $("statOk").textContent = ok;
  $("statFail").textContent = fail;
});

socket.on("resumen", (r) => {
  btnEnviar.textContent = "Enviar recordatorios";
  actualizarBotonEnviar();
  const item = document.createElement("div");
  item.className = "log-item";
  item.innerHTML = `<span class="log-ic">${IC_DONE}</span><span><strong>Finalizado.</strong>
    ${r.enviados} enviados, ${r.fallidos} fallidos de ${r.total}.</span>`;
  logBox.appendChild(item);
  logBox.scrollTop = logBox.scrollHeight;
});

// ── 6. Vista previa del mensaje (primer paciente) ─────────────────────────────
$("btnVerMensaje").addEventListener("click", async () => {
  if (pacientes.length === 0) return;
  const r = await fetch("/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paciente: pacientes[0] }),
  });
  const { mensaje } = await r.json();
  $("modalMsg").textContent = mensaje;
  $("modal").classList.remove("hidden");
});
$("cerrarModal").addEventListener("click", () => $("modal").classList.add("hidden"));
$("modal").addEventListener("click", (e) => {
  if (e.target.id === "modal") $("modal").classList.add("hidden");
});

// ── 7. Descargar plantilla CSV de ejemplo ─────────────────────────────────────
$("descargarPlantilla").addEventListener("click", (e) => {
  e.preventDefault();
  const csv =
    "hospital,paciente,especialidad,consultorio,lugar,fecha,hora,telefono\n" +
    'HOSP III YANAHUARA,ROCHA BERRIOS MAURO,DERMATOLOGIA,"CONSULTA MEDICA - DERMATOLOGIA 2",HOSP III YANAHUARA,Martes 07/07/2026,9:24 am,51996001030\n';
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "plantilla_pacientes.csv";
  a.click();
});
