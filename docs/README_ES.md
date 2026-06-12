<div align="center">

# Better Plugins Manager

**Un gestor de plugins más completo para Obsidian.**

Mantén manejables los vaults de Obsidian con muchos plugins mediante inicio diferido, controles por lotes, grupos y etiquetas, instalación desde GitHub y diagnóstico guiado de conflictos.

<p>
  <a href="../README.md">English</a>
  ·
  <a href="README_CN.md">简体中文</a>
  ·
  <a href="README_JA.md">日本語</a>
  ·
  <a href="README_KO.md">한국어</a>
  ·
  <a href="README_FR.md">Français</a>
  ·
  <a href="README_RU.md">Русский</a>
  ·
  <a href="https://github.com/zenozero-dev/obsidian-manager/releases">Releases</a>
  ·
  <a href="https://ifdian.net/a/eondr">Support</a>
</p>

<p>
  <a href="https://github.com/zenozero-dev/obsidian-manager/releases">
    <img alt="Latest Release" src="https://img.shields.io/github/v/release/zenozero-dev/obsidian-manager?style=flat-square&label=release">
  </a>
  <img alt="GitHub Downloads" src="https://img.shields.io/github/downloads/zenozero-dev/obsidian-manager/total?style=flat-square&label=downloads">
  <img alt="Last Commit" src="https://img.shields.io/github/last-commit/zenozero-dev/obsidian-manager?style=flat-square&label=last%20commit">
  <img alt="Issues" src="https://img.shields.io/github/issues/zenozero-dev/obsidian-manager?style=flat-square&label=issues">
  <img alt="Stars" src="https://img.shields.io/github/stars/zenozero-dev/obsidian-manager?style=flat-square&label=stars">
  <img alt="License" src="https://img.shields.io/github/license/zenozero-dev/obsidian-manager?style=flat-square&label=license">
</p>

<p>
  <img alt="Obsidian Plugin" src="https://img.shields.io/badge/Obsidian-plugin-7C3AED?style=flat-square&logo=obsidian&logoColor=white">
  <img alt="Minimum Obsidian Version" src="https://img.shields.io/badge/Obsidian-%E2%89%A5%201.5.8-7C3AED?style=flat-square">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-ready-3178C6?style=flat-square&logo=typescript&logoColor=white">
  <img alt="Platform" src="https://img.shields.io/badge/platform-desktop%20%7C%20mobile-4B5563?style=flat-square">
  <img alt="i18n" src="https://img.shields.io/badge/i18n-7%20languages-0F766E?style=flat-square">
  <img alt="GitHub Source Tracking" src="https://img.shields.io/badge/GitHub-source%20tracking-181717?style=flat-square&logo=github&logoColor=white">
  <a href="https://ifdian.net/a/eondr">
    <img alt="Sponsor on Afdian" src="https://img.shields.io/badge/Afdian-sponsor-946ce6?style=flat-square">
  </a>
</p>

</div>

![Screenshot](img/index.png)

---

## 🎯 ¿Qué es BPM?

**Better Plugins Manager (BPM)** es un centro de control para los plugins comunitarios de Obsidian, diseñado para vaults que dependen de muchos plugins y necesitan más que simples interruptores de activar/desactivar.

Ayuda a mantener el inicio ágil, organizar plugins por flujo de trabajo, instalar desde GitHub Releases y aislar conflictos cuando algo falla.

| 🚀 Inicio | 📦 Gestión | 🏷️ Organización | 📥 Instalación | 🔍 Diagnóstico |
|----------|------------|------------------|----------------|----------------|
| Inicio diferido y autocomprobaciones | Activación/desactivación por lotes, búsqueda rápida y filtros de estado | Grupos, etiquetas, notas, descripciones y nombres personalizados | Instalación desde repositorios y versiones de GitHub | Diagnóstico guiado de conflictos con informes |

---

## ✨ Funciones principales

BPM se organiza en cinco pestañas enfocadas. Cada pestaña cubre un flujo de trabajo para que los controles relacionados permanezcan juntos y el gestor sea fácil de revisar en escritorio y móvil.

| Pestaña | Flujo de trabajo |
|---------|------------------|
| 🧩 Plugin View | Gestionar plugins instalados, metadatos, filtros, comportamiento de inicio y acciones por plugin |
| 📥 Install Hub | Instalar plugins o temas desde GitHub y gestionar fuentes rastreadas |
| 📦 Transfer Pack | Exportar, importar y restaurar paquetes de plugins/temas entre vaults |
| 🎛️ Ribbon Order | Controlar el orden y la visibilidad de iconos del ribbon de Obsidian |
| 🔍 Conflict Diagnosis | Localizar problemas de plugins y generar informes de diagnóstico |

### 🧩 Plugin View

La pestaña principal para la gestión diaria de plugins.

![Plugin View](img/PluginView.png)

| Área | Qué hace |
|------|----------|
| **Lista de plugins** | Muestra los plugins comunitarios instalados en una vista compacta y buscable |
| **Acciones por lotes** | Activa o desactiva plugins en masa, incluidos flujos por grupos |
| **Filtros** | Filtra por estado, grupo, etiqueta, configuración de retraso o palabra clave |
| **Organización** | Añade nombres personalizados, descripciones, notas, grupos y etiquetas |
| **Control de inicio** | Asigna perfiles de inicio diferido y muestra su estado en la lista |
| **Acciones de plugin** | Buscar actualizaciones, descargar actualizaciones, reiniciar, iniciar temporalmente, abrir ajustes, abrir carpetas, copiar IDs, abrir repositorios, limpiar configuración, ocultar o eliminar |
| **Etiquetas BPM** | Marca automáticamente los plugins instalados con BPM como `bpm-install` y admite exclusión con `bpm-ignore` |

### 📥 Install Hub

Install Hub gestiona la instalación desde GitHub y las fuentes que BPM puede rastrear después.

![Install Hub](img/installHub.png)

| Área | Qué hace |
|------|----------|
| **Tipo de instalación** | Cambia entre instalación de plugin y tema |
| **Entrada de repositorio** | Acepta `user/repo` o URLs completas de GitHub |
| **Selección de release** | Obtiene releases de GitHub e instala la última versión o una versión elegida |
| **Notas de release** | Muestra información de la release antes de instalar cuando está disponible |
| **Instalaciones recientes** | Guarda repositorios usados recientemente para repetir instalaciones con rapidez |
| **Seguimiento de fuentes** | Puede rastrear repositorios instalados para comprobaciones, actualizaciones y reinstalaciones posteriores |
| **Gestión de fuentes** | Revisa fuentes rastreadas de plugins/temas, objetivos de actualización, reinstalaciones y metadatos |

### 📦 Transfer Pack

Transfer Pack mueve configuraciones de plugins entre vaults sin convertirlo en una lista manual de pasos.

![Transfer Pack](img/transferPack.png)

| Área | Qué hace |
|------|----------|
| **Lista de exportación** | Selecciona plugins y temas locales para incluirlos en un paquete JSON |
| **Configs de plugins** | Exporta archivos de configuración seleccionados cuando sea necesario |
| **Taxonomía** | Exporta grupos, etiquetas y perfiles de retraso de BPM |
| **Datos de diseño** | Exporta orden del gestor, elementos ocultos y layout del ribbon |
| **Fuentes** | Exporta mapas de repositorios GitHub, suscripciones de fuentes e historial de instalación |
| **Preferencias** | Exporta estilo, modo de retraso, visualización de etiquetas y preferencias de comprobación al inicio |
| **Vista previa** | Carga un paquete y revisa plugins, temas, fuentes, configs y layout antes de aplicar |
| **Opciones de restauración** | Instala plugins/temas faltantes, fusiona configs, restaura estado activado, aplica layout, fusiona fuentes e importa temas |

### 🎛️ Ribbon Order

Ribbon Order mantiene predecible el ribbon izquierdo de Obsidian, especialmente cuando plugins con inicio diferido registran iconos después del arranque.

![Ribbon Order](img/ribbonOrder.png)

| Área | Qué hace |
|------|----------|
| **Orden de iconos** | Arrastra elementos del ribbon a un orden estable |
| **Visibilidad** | Muestra u oculta iconos individuales |
| **Native sync mode** | Guarda el layout del ribbon en datos de BPM, sin depender de la configuración workspace de Obsidian |
| **Restablecer** | Muestra todos los elementos y los ordena por nombre |
| **Aviso de recarga** | Indica cuándo Obsidian debe recargarse para mostrar iconos ocultos al inicio |

### 🔍 Conflict Diagnosis

Conflict Diagnosis guía pruebas de conflicto paso a paso y mantiene el estado y el resultado en un solo lugar.

![Conflict Diagnosis](img/conflictScan.png)

| Área | Qué hace |
|------|----------|
| **Precomprobación** | Confirma si el problema persiste al desactivar otros plugins |
| **Reducción binaria** | Usa pruebas divididas para reducir el conjunto sospechoso |
| **Búsqueda de pares** | Ayuda a encontrar conflictos entre dos plugins, incluso entre grupos |
| **Retroalimentación manual** | Te pide comprobar cada paso e indicar si el problema continúa |
| **Controles de estado** | Deshacer el paso anterior, reiniciar Obsidian, salir, restaurar estado original o conservar el actual |
| **Informe** | Genera un informe Markdown con los plugins detectados y acciones sugeridas |

---

## 📦 Instalación

### Community Plugins

Recomendado para la mayoría de usuarios.

1. Abre **Obsidian Settings → Community Plugins**.
2. Busca **Better Plugins Manager**.
3. Instala y activa el plugin.

### Instalación manual

Úsala para instalar directamente una release de GitHub.

1. Descarga la [latest release](https://github.com/zenozero-dev/obsidian-manager/releases).
2. Copia `main.js`, `manifest.json` y `styles.css` en `.obsidian/plugins/better-plugins-manager/`.
3. Reinicia Obsidian.
4. Activa **Better Plugins Manager** desde **Settings → Community Plugins**.

---

## 🚦 Inicio rápido

### Abrir BPM

Después de activar el plugin, abre BPM de una de estas formas:

- Haz clic en el icono de BPM en el ribbon izquierdo.
- Ejecuta **Open the plugin manager** desde la paleta de comandos.

### Primeros pasos

1. Empieza en **Plugin View** para revisar plugins instalados, filtros, grupos, etiquetas y retrasos.
2. Usa **Install Hub** para instalar plugins o temas desde GitHub.
3. Usa **Transfer Pack** para mover una configuración entre vaults.
4. Usa **Conflict Diagnosis** cuando necesites aislar un problema de plugins.

### Consejos de interacción

- **Clic izquierdo** en controles principales para alternar, editar, instalar, importar o ejecutar acciones.
- **Clic derecho** en un plugin para abrir su menú contextual.
- **Pasa el cursor** sobre botones de la barra para ver tooltips; en dispositivos táctiles usa pulsación larga cuando esté disponible.

---

## 🔍 Tutorial de Conflict Diagnosis

Usa **Conflict Diagnosis** cuando aparece un problema tras activar plugins comunitarios y necesitas reducir la causa de forma estructurada.

### Flujo

1. Abre la pestaña **Conflict Diagnosis** o ejecuta **Troubleshoot plugin conflicts** desde la paleta de comandos.
2. Inicia una sesión. BPM registra el estado actual de los plugins antes de cambiar nada.
3. Prueba tu vault después de cada paso y elige **Problem Still Exists** o **Problem Gone**.
4. Continúa las pruebas guiadas hasta que BPM reduzca el resultado a un plugin o par de plugins.
5. Revisa el resultado, restaura el estado original o conserva el actual, y genera un informe Markdown si lo necesitas.

### Notas

- El diagnóstico depende de tu respuesta en cada paso; usa siempre la misma acción de prueba.
- Errores intermitentes, problemas de orden de carga, bugs dependientes de configuración o conflictos de tres o más plugins pueden requerir verificación manual.
- Puedes deshacer el paso anterior, reiniciar Obsidian durante la prueba, salir, restaurar el estado original o conservar el estado actual.

---

## 🛡️ Toma de control al inicio

Cuando **Delayed Startup** está activado, BPM revisa `.obsidian/community-plugins.json` para evitar que Obsidian y BPM controlen los mismos plugins al inicio.

| Caso | Comportamiento de BPM |
|------|-----------------------|
| Sin plugins no gestionados | Inicio normal |
| Plugins no gestionados detectados | Muestra un aviso de toma de control |
| Auto Takeover activado | Mueve automáticamente los plugins detectados a la gestión de BPM |
| Plugin marcado `bpm-ignore` | Lo deja en la lista de inicio nativa de Obsidian |

La toma de control mantiene coherentes el inicio diferido, el estado activado y los registros de BPM. Tras una toma exitosa, reinicia Obsidian para aplicar limpiamente la lista de inicio.

---

## 📦 Transfer y exportación legacy

En versiones actuales, usa **Transfer Pack** para mover configuraciones entre vaults. Exporta e importa listas de plugins, temas, configs seleccionadas, grupos, etiquetas, perfiles de retraso, layout, orden del ribbon, fuentes, historial de instalación y preferencias del workspace.

La exportación antigua Markdown/frontmatter para Obsidian Base se conserva solo por compatibilidad con datos legacy. Las configuraciones nuevas deberían usar **Transfer Pack** en lugar de una carpeta de exportación Base.

---

## ⚙️ Ajustes

Los ajustes de BPM se dividen en páginas enfocadas:

| Página | Qué puedes configurar |
|--------|-----------------------|
| **Basic** | Idioma, persistencia de filtros, inicio diferido, auto takeover, comprobaciones al inicio, comprobaciones de fuentes, auto-update de fuentes, visibilidad de etiquetas BPM, orden del ribbon, comandos, modo debug y token de GitHub |
| **Main Page Actions** | Qué acciones aparecen directamente en las tarjetas y cuáles quedan en el menú contextual |
| **Style** | Layout de la lista, estilo de elementos, estilos de grupos/etiquetas y atenuación de plugins desactivados |
| **Groups** | Crear, renombrar, recolorear y eliminar grupos |
| **Tags** | Crear, renombrar, recolorear y eliminar etiquetas |
| **Delay** | Crear y mantener perfiles de inicio diferido; solo aparece cuando está activado |

---

## ⌨️ Comandos

| Comando | Disponibilidad | Descripción |
|---------|----------------|-------------|
| **Open the plugin manager** | Siempre disponible | Abre la interfaz principal de BPM |
| **Troubleshoot plugin conflicts** | Siempre disponible | Inicia el flujo de diagnóstico de conflictos |
| **Enable/Disable [Plugin Name]** | Ajuste opcional | Registra un comando por plugin para alternarlo directamente |
| **One-click Enable/Disable [Group Name]** | Ajuste opcional | Registra comandos por grupo para alternar en lote |

---

## 📱 Compatibilidad

| Plataforma | Soporte |
|------------|---------|
| Windows / macOS / Linux | ✅ |
| Android | ✅ |
| iOS / iPadOS | ✅ |

El plugin cambia automáticamente entre layouts de escritorio y móvil según la plataforma.

---

## 🤝 Contribuir

Los issues y PRs son bienvenidos.

- **Reportes de bugs**: incluye logs y pasos de reproducción.
- **Solicitudes de funciones**: considera abrir primero una discussion o issue.

## 🙏 Agradecimientos

- La función de orden del ribbon está inspirada en [Obsidian-ribbon-sort](https://github.com/yunrr/Obsidian-app-ribbon-sorting).

---

## 📄 License

[MIT](../LICENSE)
