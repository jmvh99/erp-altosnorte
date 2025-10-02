# Inventario de Botellas — GitHub Pages

Este repositorio ya está listo para publicarse como **sitio estático**.

## 🧭 Pasos rápidos (GitHub Pages)
1. Crea un repositorio nuevo en GitHub (por ejemplo: `inventario-altosnorte`).
2. Sube **estos tres archivos** a la raíz del repo:
   - `index.html` (la app)
   - `.nojekyll` (archivo vacío para desactivar el procesamiento de Jekyll)
   - `README.md` (este archivo)
3. En GitHub, ve a **Settings → Pages**.
4. En **Source**, elige **Deploy from a branch**.
5. En **Branch**, elige **main** y carpeta **/ (root)** → **Save**.
6. GitHub te dará un URL del estilo: `https://<tu-usuario>.github.io/inventario-altosnorte/`.

> Tip: Si no ves la opción Pages, asegúrate de haber hecho al menos un commit en `main`.

## 🧪 Probar localmente
Abre `index.html` en tu navegador. Todo funciona 100% en cliente y guarda datos en **LocalStorage**.

## 🔒 Datos y privacidad
La información queda guardada **solo en tu navegador** del dispositivo donde uses la app. Si cambias de equipo, usa **Respaldar** y luego **Restaurar**.

## 🧩 Personalización
- Cambia el título/branding en la etiqueta `<title>` y encabezado.
- Las **bodegas** y **etapas** están definidas en el JS (constantes `WAREHOUSES` y `STAGES`).

## 📤 Respaldo / Exportación
- **CSV** de movimientos.
- **JSON** completo de la base para migrar entre equipos.

## 💡 Soporte
Si quieres un dominio personalizado (por ejemplo `inventario.altosnorte.mx`), agrega un archivo `CNAME` en la raíz con tu dominio y apunta un CNAME DNS a `username.github.io`.
