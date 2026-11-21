"""Small specialist policies; no downloaded executable agents or external actions."""

import re
import unicodedata

AGENTS = {
    "general": (
        "Asistente personal",
        "Conversación y ayuda cotidiana; distingue hechos de suposiciones.",
    ),
    "sales": (
        "Ventas",
        "Ayuda con descubrimiento, propuestas, objeciones y seguimiento. "
        "Usa solo datos de empresa proporcionados; no inventes clientes, "
        "precios ni resultados.",
    ),
    "meta_ads": (
        "Meta Ads",
        "Analiza campañas y métricas aportadas, audiencias y creatividades. "
        "No afirmes acceso a Meta ni datos actuales. No publiques anuncios, "
        "cambies presupuestos ni gastes dinero.",
    ),
    "coding": (
        "Programación",
        "Diagnostica código aportado, propone cambios pequeños y pruebas. "
        "No afirmes modificar repositorios o desplegar; no tienes ejecutor "
        "de archivos.",
    ),
    "research": (
        "Investigación",
        "Investiga el material aportado y separa hipótesis de fuentes "
        "verificadas. Sin navegador no inventes búsquedas, enlaces o "
        "actualidad.",
    ),
    "documents": (
        "Documentos",
        "Explica y resume exclusivamente documentos presentes. Identifica "
        "material faltante y límites de contexto.",
    ),
    "organization": (
        "Organización",
        "Convierte objetivos en próximos pasos y borradores. No afirmes "
        "crear recordatorios o enviar mensajes.",
    ),
    "analysis": (
        "Análisis",
        "Compara opciones con supuestos claros y calcula sobre datos "
        "aportados. No inventes métricas ni precisión.",
    ),
}


def select_agent(text: str, requested: str = "auto") -> tuple[str, str]:
    if requested in AGENTS:
        return requested, "Especialista seleccionado por el propietario."
    normalized = "".join(
        c for c in unicodedata.normalize("NFD", text.lower()) if unicodedata.category(c) != "Mn"
    )
    for key, pattern in [
        ("meta_ads", r"meta ads|facebook ads|instagram ads|campana|roas|anuncios"),
        ("coding", r"codigo|programa|depura|python|javascript|error|aplicacion"),
        ("sales", r"venta|vender|vende|cliente|objecion|cotiza|propuesta comercial"),
        ("documents", r"documento|resume|resumen"),
        ("organization", r"organiza|agenda|tarea|dia a dia"),
        ("research", r"investiga|fuentes"),
    ]:
        if re.search(pattern, normalized):
            return key, "Selección por tema; ejecución únicamente con Gemini autorizado."
    return "general", "Conversación general; no se necesitan herramientas externas."
