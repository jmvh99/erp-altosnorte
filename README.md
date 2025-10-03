# ERP ANV — Modular Skeleton (GitHub Pages)

## Estructura
- index.html — menú e inyección dinámica de módulos vía ES Modules
- styles.css — estilos base
- app.js — router simple + loader dinámico
- modules/store.js — estado compartido con pub/sub (localStorage)
- modules/clientes.js — CRUD básico de clientes (escribe en store)
- modules/inventario.js — añade movimientos a inventario (usa store)
- modules/ventas.js — crea ventas, lee clientes/productos de store

## Despliegue en GitHub Pages
1. Crea un repo y sube estos archivos en la raíz.
2. En Settings → Pages → Source: elige `main` (o la rama que uses) y carpeta `/root`.
3. Abre `https://<tu-usuario>.github.io/<tu-repo>/`

> Nota: Los ES Modules y rutas relativas funcionan directo en Pages sin bundler.

## Comunicación entre módulos
- Todos importan `store` desde `modules/store.js`:
  - `store.state` — snapshot del estado compartido
  - `store.set({...})` — actualiza y notifica a todos
  - `store.on(fn)` — suscripción (retorna `off()`)
  - `store.push(collection, record)` — agrega y notifica
  - `store.upsert(collection, record, ['rfc','id'])` — inserta o actualiza por claves

Ejemplo: Selecciona un cliente en **Clientes** y se autoselecciona en **Ventas** (usa `selectedClienteId` en el store).

¡Listo para extender con tus módulos reales!
