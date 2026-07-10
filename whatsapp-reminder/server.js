// server.js
// -----------------------------------------------------------------------------
// Servidor web con interfaz para:
//   1) Mostrar el código QR en el navegador y conectar WhatsApp.
//   2) Subir un CSV de pacientes y ver una vista previa.
//   3) Enviar los recordatorios mostrando el progreso en tiempo real.
//
// Ejecutar con:  node server.js   (o  npm run web)
// -----------------------------------------------------------------------------

require("dotenv").config();

const path = require("path");
const http = require("http");
const express = require("express");
const { Server } = require("socket.io");
const QRCode = require("qrcode");
const pino = require("pino");

const { enviarMensaje, construirMensaje } = require("./sender");

// ── Configuración ─────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || "3000", 10);
const ESPERA_MS = parseInt(process.env.ESPERA_MS || "5000", 10);
const CARPETA_AUTH = process.env.AUTH_FOLDER || "auth";

// ── Servidor HTTP + WebSocket ────────────────────────────────────────────────
const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

const server = http.createServer(app);
const io = new Server(server);

// ── Estado global de la conexión de WhatsApp ─────────────────────────────────
let sock = null;
let estado = "conectando"; // conectando | qr | conectado | cerrado
let ultimoQR = null; // data URL del último QR generado
let enviando = false; // evita envíos simultáneos

/** Envía a TODOS los navegadores conectados el estado actual de WhatsApp. */
function emitirEstado() {
  io.emit("estado", { estado, qr: ultimoQR });
}

// ── Conexión con WhatsApp (Baileys) ──────────────────────────────────────────
async function iniciarWhatsApp() {
  // Baileys es ESM-only → import dinámico.
  const {
    default: makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    DisconnectReason,
  } = await import("@whiskeysockets/baileys");

  const { state, saveCreds } = await useMultiFileAuthState(CARPETA_AUTH);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: "silent" }),
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    // Nuevo QR → convertir a imagen (data URL) y mandarlo al navegador.
    if (qr) {
      estado = "qr";
      ultimoQR = await QRCode.toDataURL(qr, { margin: 1, width: 320 });
      emitirEstado();
    }

    if (connection === "open") {
      estado = "conectado";
      ultimoQR = null;
      console.log("✅ WhatsApp conectado.");
      emitirEstado();
    }

    if (connection === "close") {
      const codigo = lastDisconnect?.error?.output?.statusCode;
      const reconectar = codigo !== DisconnectReason.loggedOut;
      estado = "cerrado";
      emitirEstado();
      console.log(
        reconectar
          ? "⚠️  Conexión cerrada. Reintentando..."
          : "🔒 Sesión cerrada (loggedOut)."
      );
      if (reconectar) iniciarWhatsApp();
    }
  });
}

// ── Eventos de los navegadores ────────────────────────────────────────────────
io.on("connection", (client) => {
  // Al abrir la página, enviarle el estado actual (QR o "conectado").
  client.emit("estado", { estado, qr: ultimoQR });
});

// ── Endpoint: vista previa del mensaje ya armado ─────────────────────────────
app.post("/preview", (req, res) => {
  const p = req.body.paciente || {};
  res.json({ mensaje: construirMensaje(p) });
});

// ── Endpoint: enviar recordatorios ────────────────────────────────────────────
app.post("/enviar", async (req, res) => {
  if (estado !== "conectado" || !sock) {
    return res
      .status(400)
      .json({ error: "WhatsApp no está conectado. Escanea el QR primero." });
  }
  if (enviando) {
    return res.status(409).json({ error: "Ya hay un envío en curso." });
  }

  const pacientes = Array.isArray(req.body.pacientes) ? req.body.pacientes : [];
  if (pacientes.length === 0) {
    return res.status(400).json({ error: "No hay pacientes para enviar." });
  }

  // Respondemos de inmediato; el progreso viaja por WebSocket.
  res.json({ ok: true, total: pacientes.length });

  enviando = true;
  let enviados = 0;
  let fallidos = 0;

  for (let i = 0; i < pacientes.length; i++) {
    const p = pacientes[i];
    try {
      await enviarMensaje(sock, p);
      enviados++;
      io.emit("progreso", {
        index: i,
        paciente: p.paciente,
        telefono: p.telefono,
        ok: true,
      });
    } catch (error) {
      fallidos++;
      io.emit("progreso", {
        index: i,
        paciente: p.paciente,
        telefono: p.telefono,
        ok: false,
        error: error.message,
      });
    }

    // Pausa entre envíos (menos en el último) para evitar bloqueos.
    if (i < pacientes.length - 1) {
      await new Promise((r) => setTimeout(r, ESPERA_MS));
    }
  }

  enviando = false;
  io.emit("resumen", { enviados, fallidos, total: pacientes.length });
});

// ── Arranque ──────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`\n🌐 Interfaz disponible en: http://localhost:${PORT}\n`);
  iniciarWhatsApp();
});
