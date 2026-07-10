
// Credenciales
const TOKEN = process.env.WHATSAPP_TOKEN || "";
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_ID || "";
const API_VERSION = "v21.0";

// Recibe los 4 datos y devuelve el texto del recordatorio.
function construirMensaje({ hospital, paciente, lugar, fecha }) {
  return `${hospital}

Paciente ${paciente}
le recordamos su cita de ${lugar} del día ${fecha}.
acuda a su cita oportunamente

Gracias
de ti depende mejorar, No pierdas tu cita

CONSULTAS/INQUIETUDES: 380400

ESSALUD EN LINEA - Citas, Reprogramaciones o Anulaciones:
226969 381430 383910 383915 383930

Se le hace presente que este medio es solo para recordarle su cita, agradecemos de antemano su asistencia.`;
}

// numero: en formato internacional sin usar el '+', ejemplo: "51987654321"
async function enviarWhatsApp(numero, datos) {
  const mensaje = construirMensaje(datos);

  const url = `https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/messages`;

  const respuesta = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: numero,
      type: "text",
      text: { body: mensaje },
    }),
  });

  const data = await respuesta.json();

  if (!respuesta.ok) {
    console.error("Error al enviar:", JSON.stringify(data, null, 2));
    return;
  }
  console.log(`Mensaje enviado a ${numero}. ID:`, data.messages?.[0]?.id);
}

// Numero destino con el mismo formato internacional
enviarWhatsApp("51987654321", cita);
