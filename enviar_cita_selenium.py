
# Requisitos:
#   pip install selenium
#   Chrome + chromedriver (Selenium 4 lo descarga solo con Selenium Manager).
#
# La primera vez pide escanear el QR de WhatsApp Web. La sesión queda guardada
# en la carpeta "chrome_perfil" para no volver a escanear en los siguientes envíos.

import time
import urllib.parse

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC


# ── 1. Plantilla del mensaje ──────────────────────────────────────────────────
def construir_mensaje(hospital, paciente, lugar, fecha):
    return (
        f"{hospital}\n\n"
        f"Paciente {paciente}\n"
        f"le recordamos su cita de {lugar} del día {fecha}.\n"
        f"acuda a su cita oportunamente\n\n"
        f"Gracias\n"
        f"de ti depende mejorar, No pierdas tu cita\n\n"
        f"CONSULTAS/INQUIETUDES: 380400\n\n"
        f"ESSALUD EN LINEA - Citas, Reprogramaciones o Anulaciones:\n"
        f"226969 381430 383910 383915 383930\n\n"
        f"Se le hace presente que este medio es solo para recordarle su cita, "
        f"agradecemos de antemano su asistencia."
    )


# ── 2. Arranque del navegador con sesión persistente ──────────────────────────
def iniciar_navegador():
    opciones = Options()
    # Guarda la sesión de WhatsApp para no re-escanear el QR cada vez.
    opciones.add_argument("--user-data-dir=chrome_perfil")
    opciones.add_argument("--start-maximized")
    driver = webdriver.Chrome(options=opciones)
    return driver


def esperar_login(driver):
    driver.get("https://web.whatsapp.com")
    print("Si es la primera vez, escanea el QR con tu WhatsApp...")
    # Espera hasta 120 s a que cargue la lista de chats (login completo).
    WebDriverWait(driver, 120).until(
        EC.presence_of_element_located((By.ID, "side"))
    )
    print("Sesión iniciada.")


# ── 3. Envío del mensaje ───────────────────────────────────────────────────────
# numero: formato internacional SIN '+', ej. Perú: "51987654321"
def enviar_whatsapp(driver, numero, mensaje):
    texto = urllib.parse.quote(mensaje)
    driver.get(f"https://web.whatsapp.com/send?phone={numero}&text={texto}")

    try:
        # Espera el cuadro de escritura del chat (aparece cuando el número es válido).
        caja = WebDriverWait(driver, 30).until(
            EC.presence_of_element_located(
                (By.XPATH, '//div[@aria-label="Escribe un mensaje" or @title="Escribe un mensaje"]')
            )
        )
        time.sleep(1)
        caja.send_keys(Keys.ENTER)
        print(f"Mensaje enviado a {numero}")
        time.sleep(2)
    except Exception as e:
        print(f"No se pudo enviar a {numero}: {e}")


# ── 4. Uso ─────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    # Lista de pacientes a notificar. Agrega los que necesites.
    citas = [
        {
            "numero": "51987654321",
            "hospital": "ESSALUD  -  HOSP III YANAHUARA",
            "paciente": "ROCHA BERRIOS MAURO",
            "lugar": "DERMATOLOGIA (CONSULTA MEDICA - DERMATOLOGIA 2)",
            "fecha": "Martes 07/07/2026 a las 9:24 am",
        },
    ]

    driver = iniciar_navegador()
    try:
        esperar_login(driver)
        for c in citas:
            mensaje = construir_mensaje(c["hospital"], c["paciente"], c["lugar"], c["fecha"])
            enviar_whatsapp(driver, c["numero"], mensaje)
    finally:
        input("Presiona ENTER para cerrar el navegador...")
        driver.quit()
