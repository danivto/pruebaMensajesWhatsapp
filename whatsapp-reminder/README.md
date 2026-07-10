# WhatsApp Reminder (Baileys)

Sistema sencillo en **Node.js** para enviar recordatorios de citas médicas por
WhatsApp usando la biblioteca [Baileys](https://github.com/WhiskeySockets/Baileys).
La sesión se autentica escaneando un **código QR** una sola vez.

> ⚠️ No usa la API oficial de Meta. Baileys se conecta como un WhatsApp Web no
> oficial: úsalo con responsabilidad y con volúmenes moderados para evitar
> bloqueos de tu número.

---

## 📁 Estructura del proyecto

```
whatsapp-reminder/
│
├── index.js          # Conexión con WhatsApp (QR + sesión) y orquestación
├── sender.js         # Armado del mensaje y lógica de envío
├── pacientes.json    # Lista de pacientes a notificar (datos de entrada)
├── auth/             # Sesión guardada por Baileys (se crea sola tras el QR)
├── package.json      # Dependencias y scripts
├── .env              # Configuración (pausa entre envíos, carpeta de sesión)
└── README.md
```

### Qué hace cada archivo

| Archivo          | Responsabilidad                                                                 |
|------------------|----------------------------------------------------------------------------------|
| `index.js`       | Se conecta a WhatsApp, muestra el QR, guarda la sesión y recorre los pacientes.  |
| `sender.js`      | Construye el texto del recordatorio y lo envía a un número (lógica reutilizable).|
| `pacientes.json` | Arreglo con los datos de cada paciente. Aquí editas a quién se le envía.          |
| `.env`           | Ajustes: `ESPERA_MS` (pausa entre mensajes) y `AUTH_FOLDER` (carpeta de sesión). |
| `auth/`          | Credenciales de la sesión. Se genera automáticamente; **no la subas a git**.     |

---

## 🚀 Instalación

Necesitas **Node.js 18 o superior**.

```bash
cd whatsapp-reminder
npm install
```

---

## ⚙️ Configuración

### 1. Editar los pacientes (`pacientes.json`)

Cada paciente es un objeto dentro del arreglo:

```json
[
  {
    "hospital": "HOSP III YANAHUARA",
    "paciente": "ROCHA BERRIOS MAURO",
    "especialidad": "DERMATOLOGIA",
    "consultorio": "CONSULTA MEDICA - DERMATOLOGIA 2",
    "lugar": "HOSP III YANAHUARA",
    "fecha": "Martes 07/07/2026",
    "hora": "9:24 am",
    "telefono": "51987654321"
  }
]
```

> El campo `telefono` debe ir en **formato internacional sin el `+`**
> (ej. Perú: `51987654321`). Para varios pacientes, agrega más objetos separados
> por comas.

### 2. Ajustar la configuración (`.env`)

```env
ESPERA_MS=5000     # milisegundos de pausa entre cada envío
AUTH_FOLDER=auth   # carpeta donde se guarda la sesión
```

---

## 🖥️ Interfaz web (recomendada)

Además del modo por consola, hay una **interfaz web** que muestra el QR en el
navegador, permite subir un CSV de pacientes, ver una vista previa y enviar con
progreso en tiempo real.

```bash
npm run web
```

Luego abre en el navegador **http://localhost:3210** (el puerto se configura con
`PORT` en `.env`).

Pasos en la interfaz:

1. **Conectar WhatsApp:** escanea el QR que aparece en pantalla (solo la primera vez).
2. **Cargar pacientes:** arrastra un `.csv` o haz clic para elegirlo. Puedes
   descargar una plantilla de ejemplo desde la misma página.
3. **Vista previa:** revisa la tabla y, si quieres, el mensaje exacto que se enviará.
4. **Enviar:** pulsa *Enviar recordatorios* y observa el progreso en vivo (✅ / ❌)
   con un resumen final.

El CSV debe tener esta cabecera:

```
hospital,paciente,especialidad,consultorio,lugar,fecha,hora,telefono
```

> Los celulares peruanos de 9 dígitos (que empiezan en 9) reciben automáticamente
> el prefijo `51`. Para otros países, escribe el número internacional completo.

---

## ▶️ Ejecución por consola

```bash
node index.js
```

La primera vez:

1. Se muestra un **código QR** en la terminal.
2. Ábrelo desde tu celular: **WhatsApp → Dispositivos vinculados → Vincular dispositivo**.
3. La sesión queda guardada en `auth/` (las siguientes veces ya no pide QR).
4. Se recorre la lista, se genera el mensaje de cada paciente y se envía.
5. Al final se muestra un **resumen** de cuántos se enviaron y cuántos fallaron.

---

## 💬 Mensaje generado

A partir de los datos del paciente se arma automáticamente:

```
ESSALUD  -  HOSP III YANAHUARA

Paciente ROCHA BERRIOS MAURO
le recordamos su cita de  DERMATOLOGIA (CONSULTA MEDICA - DERMATOLOGIA 2) del día Martes 07/07/2026 a las 9:24 am.
acuda a su cita oportunamente

Gracias
de ti depende mejorar, No pierdas tu cita

CONSULTAS/INQUIETUDES: 380400

ESSALUD EN LINEA - Citas, Reprogramaciones o Anulaciones:
226969 381430 383910 383915 383930

Se le hace presente que este medio es solo para recordarle su cita, agradecemos de antemano su asistencia.
```

---

## ❓ Problemas comunes

- **Sale de nuevo el QR / dice `loggedOut`:** borra la carpeta `auth/` y vuelve a escanear.
- **Un número falla:** revisa que tenga WhatsApp y esté en formato internacional sin `+`.
- **Se bloquea por muchos envíos:** sube `ESPERA_MS` (por ejemplo a `10000`).
