// index.js
// -----------------------------------------------------------------------------
// Punto de entrada del proyecto.
// Se encarga de la CONEXIÓN con WhatsApp (QR + sesión) y de orquestar el
// recorrido de la lista de pacientes. El armado y envío del mensaje vive
// en sender.js (lógica separada).
// -----------------------------------------------------------------------------

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const pino = require("pino");
const qrcode = require("qrcode-terminal");

// Baileys es ESM-only: se importa de forma dinámica dentro de iniciar().
const { enviarMensaje } = require("./sender");

// ── Configuración (desde .env, con valores por defecto) ──────────────────────
const ESPERA_MS = parseInt(process.env.ESPERA_MS || "5000", 10); // pausa entre envíos
const CARPETA_AUTH = process.env.AUTH_FOLDER || "auth"; // dónde se guarda la sesión

// Evita que el proceso se reconecte una vez que ya terminó de enviar todo.
let procesoTerminado = false;

// ── Utilidades ────────────────────────────────────────────────────────────────

/** Pausa la ejecución durante `ms` milisegundos. */
function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Lee la lista de pacientes desde el archivo local pacientes.json. */
function cargarPacientes() {
  const ruta = path.join(__dirname, "pacientes.json");
  const contenido = fs.readFileSync(ruta, "utf-8");
  return JSON.parse(contenido);
}

// ── Envío masivo ────────────────────────────────────────────────────────────

/**
 * Recorre todos los pacientes y les envía el recordatorio uno por uno.
 * Un error con un paciente NO detiene el envío a los demás.
 *
 * @param {object} sock - Socket de Baileys ya conectado.
 */
async function enviarRecordatorios(sock) {
  const pacientes = cargarPacientes();
  let enviados = 0;
  let fallidos = 0;

  console.log(`\nSe enviarán ${pacientes.length} recordatorio(s).\n`);

  for (const paciente of pacientes) {
    try {
      console.log(`➡️  Enviando a ${paciente.paciente} (${paciente.telefono})...`);
      await enviarMensaje(sock, paciente);
      console.log(`✅ Enviado correctamente a ${paciente.telefono}`);
      enviados++;
    } catch (error) {
      console.error(`❌ Error al enviar a ${paciente.telefono}: ${error.message}`);
      fallidos++;
    }

    // Pausa entre mensajes para evitar envíos continuos (anti-bloqueo).
    await esperar(ESPERA_MS);
  }

  console.log("\n──────────── RESUMEN ────────────");
  console.log(`✅ Enviados correctamente: ${enviados}`);
  console.log(`❌ Fallidos:              ${fallidos}`);
  console.log("─────────────────────────────────\n");
}

// ── Conexión con WhatsApp ─────────────────────────────────────────────────────

/**
 * Inicia la conexión con WhatsApp usando Baileys.
 * - Muestra el QR si no hay sesión guardada.
 * - Guarda la sesión automáticamente para no volver a escanear.
 * - Al conectar, dispara el envío de recordatorios.
 */
async function iniciar() {
  // Import dinámico porque Baileys se publica como módulo ESM.
  const {
    default: makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    DisconnectReason,
  } = await import("@whiskeysockets/baileys");

  // Carga (o crea) las credenciales guardadas en la carpeta de sesión.
  const { state, saveCreds } = await useMultiFileAuthState(CARPETA_AUTH);

  // Usa siempre la última versión del protocolo de WhatsApp Web.
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    // Logger silencioso para no llenar la consola de ruido interno.
    logger: pino({ level: "silent" }),
  });

  // Guarda las credenciales cada vez que cambian (mantiene viva la sesión).
  sock.ev.on("creds.update", saveCreds);

  // Reacciona a los cambios de estado de la conexión.
  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    // 1) Se generó un QR nuevo → mostrarlo en consola.
    if (qr) {
      console.log("\n📲 Escanea este código QR con WhatsApp:\n");
      qrcode.generate(qr, { small: true });
    }

    // 2) Conexión abierta → enviar y terminar.
    if (connection === "open") {
      console.log("✅ Conexión exitosa con WhatsApp.");
      await enviarRecordatorios(sock);

      procesoTerminado = true;
      console.log("Proceso finalizado. Cerrando...");
      await sock.end();
      process.exit(0);
    }

    // 3) Conexión cerrada → decidir si reconectar.
    if (connection === "close") {
      if (procesoTerminado) return; // cierre normal tras terminar: no reconectar.

      const codigo = lastDisconnect?.error?.output?.statusCode;
      const debeReconectar = codigo !== DisconnectReason.loggedOut;

      if (debeReconectar) {
        console.log("⚠️  Conexión cerrada. Reintentando...");
        iniciar();
      } else {
        console.log("🔒 Sesión cerrada (loggedOut). Borra la carpeta de sesión y vuelve a escanear el QR.");
      }
    }
  });
}

// Arranca todo.
iniciar();
