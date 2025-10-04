// =====================
// Inventario.js
// =====================

// Estado local
let productos = JSON.parse(localStorage.getItem('productos') || '[]');
let inventario = JSON.parse(localStorage.getItem('inventario') || '[]');

// Guardar
function saveProductos() {
  localStorage.setItem('productos', JSON.stringify(productos));
}
function saveInventario() {
  localStorage.setItem('inventario', JSON.stringify(inventario));
}

// =====================
// Render Catálogo
// =====================
function renderCatalogo(root) {
  const table = root.querySelector('#catalogoTable tbody');
  table.innerHTML = '';

  productos.forEach((p, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${p.nombre}</td>
      <td>${p.sku}</td>
      <td>
        Distribuidor: $${p.precios?.distribuidor ?? 0}<br>
        Centro de Consumo: $${p.precios?.consumo ?? 0}<br>
        Nuevo Distribuidor: $${p.precios?.nuevoDistribuidor ?? 0}<br>
        Nuevo Centro de Consumo: $${p.precios?.nuevoConsumo ?? 0}
      </td>
      <td><button data-i="${i}" class="eliminar">Eliminar</button></td>
    `;
    table.appendChild(tr);
  });

  // Eliminar producto
  table.querySelectorAll('.eliminar').forEach(btn => {
    btn.addEventListener('click', () => {
      productos.splice(btn.dataset.i, 1);
      saveProductos();
      renderCatalogo(root);
    });
  });
}

// =====================
// Render Resumen
// =====================
function renderResumen(root) {
  const table = root.querySelector('#resumenTable tbody');
  table.innerHTML = '';

  inventario.forEach((r, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.nombre}</td>
      <td>${r.sku}</td>
      <td>${r.bodega}</td>
      <td>${r.etapa}</td>
      <td>${r.lote}</td>
      <td>${r.cantidad}</td>
      <td><button data-i="${i}" class="ajustar">Ajustar / dividir</button></td>
    `;
    table.appendChild(tr);
  });

  // Acciones
  table.querySelectorAll('.ajustar').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = btn.dataset.i;
      const nuevo = prompt('Nueva cantidad para ' + inventario[idx].nombre, inventario[idx].cantidad);
      if (nuevo !== null) {
        inventario[idx].cantidad = parseInt(nuevo) || inventario[idx].cantidad;
        saveInventario();
        renderResumen(root);
      }
    });
  });
}

// =====================
// Render Matriz Consolidada
// =====================
function renderMatriz(root) {
  const table = root.querySelector('#matrixTable');
  table.innerHTML = '';

  // Obtener productos únicos
  const skus = [...new Set(inventario.map(i => i.sku))];
  const bodegas = [...new Set(inventario.map(i => i.bodega))];

  // Encabezado
  let thead = `<thead><tr><th>Bodega</th>`;
  skus.forEach(sku => { thead += `<th>${sku}</th>`; });
  thead += `</tr></thead>`;

  // Filas
  let tbody = '<tbody>';
  bodegas.forEach(b => {
    tbody += `<tr><td>${b}</td>`;
    skus.forEach(sku => {
      const items = inventario.filter(i => i.bodega === b && i.sku === sku);
      const total = items.reduce((acc, cur) => acc + cur.cantidad, 0);
      tbody += `<td>${total}</td>`;
    });
    tbody += '</tr>';
  });
  tbody += '</tbody>';

  table.innerHTML = thead + tbody;
}

// =====================
// Inicializar módulo
// =====================
export function mount(root) {
  // Catálogo
  renderCatalogo(root);
  // Resumen
  renderResumen(root);
  // Matriz
  renderMatriz(root);

  // Botón Agregar Producto
  root.querySelector('#addProducto').addEventListener('click', () => {
    const nombre = root.querySelector('#nombreProducto').value;
    const sku = root.querySelector('#skuProducto').value;
    const precios = {
      distribuidor: parseFloat(root.querySelector('#precioDistribuidor').value) || 0,
      consumo: parseFloat(root.querySelector('#precioConsumo').value) || 0,
      nuevoDistribuidor: parseFloat(root.querySelector('#precioNuevoDistribuidor').value) || 0,
      nuevoConsumo: parseFloat(root.querySelector('#precioNuevoConsumo').value) || 0
    };

    if (!nombre || !sku) return;

    productos.push({ nombre, sku, precios });
    saveProductos();
    renderCatalogo(root);
  });

  // ========== CSS FIX Layout ==========
  (function injectInventoryFixCSS(){
    if (document.getElementById('inv-fix-css')) return;
    const style = document.createElement('style');
    style.id = 'inv-fix-css';
    style.textContent = `
      .panel { position: relative; }
      .panel + .panel { margin-top: 16px; }
      .inv-grid { display: grid; gap: 16px; }

      /* Catálogo sin límite */
      .table-wrap.catalogo {
        background: var(--panel, #11161f);
        border: 1px solid var(--border, #333);
        border-radius: 12px;
        padding: 12px;
        max-height: none;
        overflow: visible;
      }

      .table { width: 100%; border-collapse: collapse; }
      .table th, .table td {
        padding: 8px 10px;
        border-bottom: 1px solid var(--border, #333);
        vertical-align: middle;
        white-space: nowrap;
      }
      .table th { position: sticky; top: 0; background: #11161f; z-index: 1; }

      /* Scroll sólo en Resumen y Matriz */
      .table-wrap.tall { max-height: 70vh; overflow: auto; }
      .table-wrap-x { overflow-x: auto; }
    `;
    document.head.appendChild(style);
  })();

  // ========== wrapTable aplicado ==========
  wrapTable(root.querySelector('#catalogoTable'), 'table-wrap catalogo');
  wrapTable(root.querySelector('#resumenTable'), 'table-wrap tall');
  wrapTable(root.querySelector('#matrixTable'), 'table-wrap-x');
}

// Función para envolver tabla
function wrapTable(table, cls) {
  if (!table) return;
  const wrap = document.createElement('div');
  wrap.className = cls;
  table.parentNode.insertBefore(wrap, table);
  wrap.appendChild(table);
}
