// sender.js
// -----------------------------------------------------------------------------
// Lógica de ENVÍO y de armado del mensaje.
// Este archivo NO sabe nada de la conexión: recibe un socket ya conectado
// (creado en index.js) y se encarga solo de formatear y enviar el texto.
// -----------------------------------------------------------------------------

/**
 * Construye el texto del recordatorio reemplazando los datos del paciente
 * dentro de la plantilla de ESSALUD.
 *
 * @param {object} p - Datos del paciente (ver estructura en pacientes.json).
 * @returns {string} Mensaje ya listo para enviar.
 */
function construirMensaje(p) {
  return (
    `ESSALUD  -  ${p.hospital}\n\n` +
    `Paciente ${p.paciente}\n` +
    `le recordamos su cita de  ${p.especialidad} (${p.consultorio}) ` +
    `del día ${p.fecha} a las ${p.hora}.\n` +
    `acuda a su cita oportunamente\n\n` +
    `Gracias\n` +
    `de ti depende mejorar, No pierdas tu cita\n\n` +
    `CONSULTAS/INQUIETUDES: 380400\n\n` +
    `ESSALUD EN LINEA - Citas, Reprogramaciones o Anulaciones:\n` +
    `226969 381430 383910 383915 383930\n\n` +
    `Se le hace presente que este medio es solo para recordarle su cita, ` +
    `agradecemos de antemano su asistencia.`
  );
}

/**
 * Convierte un número de teléfono a un JID de WhatsApp.
 * El número debe estar en formato internacional SIN '+' (ej: "51987654321").
 * Se limpian espacios, guiones o cualquier caracter que no sea dígito.
 *
 * @param {string} telefono
 * @returns {string} JID válido, ej: "51987654321@s.whatsapp.net"
 */
function numeroAJid(telefono) {
  let d = String(telefono).replace(/\D/g, "");
  // Celular peruano de 9 dígitos (empieza en 9) → se le antepone el código de país 51.
  if (d.length === 9 && d.startsWith("9")) {
    d = "51" + d;
  }
  return `${d}@s.whatsapp.net`;
}

/**
 * Envía el recordatorio a un paciente usando el socket ya conectado.
 * Lanza una excepción si el envío falla (index.js la captura).
 *
 * @param {object} sock     - Socket de Baileys ya conectado.
 * @param {object} paciente - Datos del paciente.
 */
async function enviarMensaje(sock, paciente) {
  const jid = numeroAJid(paciente.telefono);
  const texto = construirMensaje(paciente);
  await sock.sendMessage(jid, { text: texto });
}

module.exports = { construirMensaje, numeroAJid, enviarMensaje };
