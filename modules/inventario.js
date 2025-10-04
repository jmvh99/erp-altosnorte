// modules/inventario.js — versión autocontenida (estructura + render + fixes)

// ---------- Utilidades de estado (shared o localStorage) ----------
function getState(shared) {
  const s = shared?.state;
  if (s) return s;

  // fallback localStorage
  const obj = {
    productos: JSON.parse(localStorage.getItem('productos') || '[]'),
    inventario: JSON.parse(localStorage.getItem('inventario') || '[]'),
    priceTiers: [
      "Distribuidor","Centro de Consumo","Nuevo Distribuidor","Nuevo Centro de Consumo"
    ],
    warehouses: [
      "Bodega en medio","Bodega chica","Bodega externa","Bodega casa","Espacio AN","Oficina"
    ],
    stages: ["Embotellado","Degollado","Producto terminado"],
  };
  return obj;
}

function setState(shared, patch) {
  if (shared?.state) {
    shared.set(patch);
  } else {
    // fallback localStorage
    const cur = {
      productos: JSON.parse(localStorage.getItem('productos') || '[]'),
      inventario: JSON.parse(localStorage.getItem('inventario') || '[]'),
    };
    const next = { ...cur, ...patch };
    if ('productos' in patch) {
      localStorage.setItem('productos', JSON.stringify(next.productos));
    }
    if ('inventario' in patch) {
      localStorage.setItem('inventario', JSON.stringify(next.inventario));
    }
  }
}

const money = (n) => new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(Number(n||0));
const uid = () => crypto.randomUUID?.() || Math.random().toString(36).slice(2,9);

// ---------- CSS embebido (catálogo sin corte; scroll en resumen/matriz) ----------
(function injectInventoryFixCSS(){
  if (document.getElementById('inv-fix-css')) return;
  const style = document.createElement('style');
  style.id = 'inv-fix-css';
  style.textContent = `
    .panel{position:relative}
    .panel+.panel{margin-top:16px}
    .inv-grid{display:grid;gap:16px}
    .table{width:100%;border-collapse:collapse}
    .table th,.table td{padding:8px 10px;border-bottom:1px solid var(--border,#333);vertical-align:middle;white-space:nowrap}
    .table th{position:sticky;top:0;background:#11161f;z-index:1}
    .table-wrap.catalogo{
      background:var(--panel,#11161f);
      border:1px solid var(--border,#333);
      border-radius:12px;
      padding:12px;
      max-height:none;       /* no se corta */
      overflow:visible;
    }
    .table-wrap.tall{max-height:70vh;overflow:auto}  /* Resumen */
    .table-wrap-x{overflow:auto}                      /* Matriz */
    .muted{color:#9aa4b2}
    .inline{display:flex;gap:8px;align-items:center}
    .right{text-align:right}
    .chip{display:inline-flex;gap:6px;align-items:center;margin:4px 6px 4px 0}
    input[type="number"]{background:#0f141c;color:#fff;border:1px solid #2b3340;border-radius:8px;padding:6px 8px}
    input,select,button{font:inherit}
    button{border:1px solid #2b3340;background:#1a2230;color:#fff;border-radius:8px;padding:6px 10px;cursor:pointer}
    button.sm{padding:4px 8px;border-radius:6px}
    button.danger{background:#3a1a1a;border-color:#5a2a2a}
    h3{margin:6px 0 10px}
    .grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .field{display:flex;flex-direction:column;gap:6px}
    .field input,.field select{background:#0f141c;color:#fff;border:1px solid #2b3340;border-radius:8px;padding:8px}
  `;
  document.head.appendChild(style);
})();

function wrapTable(table, cls) {
  if (!table) return;
  if (table.parentElement && (table.parentElement.classList.contains('table-wrap') || table.parentElement.classList.contains('table-wrap-x'))) return;
  const wrap = document.createElement('div');
  wrap.className = cls;
  table.parentNode.insertBefore(wrap, table);
  wrap.appendChild(table);
}

// ---------- Montaje principal ----------
export function mount(root, shared){

  // Estructura HTML completa (con IDs que usan los renders)
  const el = document.createElement('div');
  el.className = 'inv-grid';
  el.innerHTML = `
    <!-- ===== Catálogo ===== -->
    <section class="panel">
      <h3>Catálogo de Productos</h3>
      <div class="grid2" style="margin-bottom:10px">
        <div class="field">
          <label class="muted">Nombre del producto</label>
          <input id="pNombre" placeholder="Ej. Cabernet 750ml">
        </div>
        <div class="field">
          <label class="muted">SKU</label>
          <input id="pSKU" placeholder="Ej. CAB-750">
        </div>
      </div>
      <div class="grid2" style="margin-bottom:10px">
        <div class="field">
          <label class="muted">Distribuidor</label>
          <input id="tDistribuidor" type="number" step="0.01" value="0">
        </div>
        <div class="field">
          <label class="muted">Centro de Consumo</label>
          <input id="tConsumo" type="number" step="0.01" value="0">
        </div>
        <div class="field">
          <label class="muted">Nuevo Distribuidor</label>
          <input id="tNuevoDist" type="number" step="0.01" value="0">
        </div>
        <div class="field">
          <label class="muted">Nuevo Centro de Consumo</label>
          <input id="tNuevoCons" type="number" step="0.01" value="0">
        </div>
      </div>
      <div class="inline" style="margin-bottom:10px">
        <button id="addProducto">Agregar producto</button>
      </div>

      <div class="table-wrap catalogo">
        <table class="table" id="catalogoTable">
          <thead>
            <tr>
              <th>Producto</th>
              <th>SKU</th>
              <th>(por tier)</th>
              <th class="right">Acciones</th>
            </tr>
          </thead>
          <tbody id="catalogoBody"></tbody>
        </table>
      </div>
    </section>

    <!-- ===== Resumen por bodega y etapa ===== -->
    <section class="panel">
      <h3>Resumen por bodega y etapa</h3>
      <div class="table-wrap tall">
        <table class="table" id="resumenTable">
          <thead>
            <tr>
              <th>Producto</th>
              <th>SKU</th>
              <th>Bodega</th>
              <th>Etapa</th>
              <th>Lote</th>
              <th class="right">Cantidad</th>
              <th class="right">Acciones</th>
            </tr>
          </thead>
          <tbody id="resumenBody"></tbody>
        </table>
      </div>
    </section>

    <!-- ===== Matriz consolidada ===== -->
    <section class="panel">
      <h3>Matriz por bodega y producto (consolidado)</h3>
      <div class="table-wrap-x">
        <table class="table" id="matrixTable">
          <thead id="matrixHead"></thead>
          <tbody id="matrixBody"></tbody>
        </table>
      </div>
    </section>
  `;
  root.innerHTML = '';
  root.appendChild(el);

  // Accesos rápidos
  const $ = (sel) => el.querySelector(sel);
  const state = () => getState(shared);

  // ---------- Catálogo (render/editar) ----------
  const TIERS = ["Distribuidor","Centro de Consumo","Nuevo Distribuidor","Nuevo Centro de Consumo"];

  function renderCatalogo(){
    const tbody = $('#catalogoBody');
    if (!tbody) return; // defensa
    const prods = state().productos || [];
    tbody.innerHTML = prods.map(p => {
      const prices = p.prices || p.precios || {}; // compat
      const chips = TIERS.map(t => {
        const val = Number(prices[t] ?? 0).toFixed(2);
        return `
          <label class="chip">
            <span class="muted">${t}:</span>
            <input type="number" step="0.01" min="0" value="${val}"
              data-price-tier="${t}" data-prod="${p.id}">
          </label>
        `;
      }).join('');
      return `
        <tr>
          <td>${p.name || p.nombre || ''}</td>
          <td>${p.sku || ''}</td>
          <td>${chips}</td>
          <td class="right">
            <button class="danger sm" data-del-prod="${p.id}">Eliminar</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Guardar cambios de precio inline
  $('#catalogoTable')?.addEventListener('change', (e)=>{
    const inp = e.target.closest('input[data-price-tier][data-prod]');
    if(!inp) return;
    const tier = inp.getAttribute('data-price-tier');
    const pid  = inp.getAttribute('data-prod');
    const val  = Number(inp.value || 0);

    const prods = (state().productos || []).map(r => ({...r}));
    const p = prods.find(x => x.id === pid);
    if(!p) return;
    p.prices = { ...(p.prices || p.precios || {}) };
    p.prices[tier] = val;
    // normaliza nombres de campos
    p.name = p.name || p.nombre || '';
    delete p.precios; delete p.nombre;

    setState(shared, { productos: prods });
    renderCatalogo();
  });

  // Eliminar producto
  $('#catalogoTable')?.addEventListener('click', (e)=>{
    const del = e.target.closest('[data-del-prod]');
    if(!del) return;
    const pid = del.getAttribute('data-del-prod');
    const prods = (state().productos || []).filter(p => p.id !== pid);
    setState(shared, { productos: prods });
    renderCatalogo();
  });

  // Agregar producto
  $('#addProducto')?.addEventListener('click', ()=>{
    const nombre = $('#pNombre')?.value?.trim();
    const sku    = $('#pSKU')?.value?.trim();
    if(!nombre || !sku) { alert('Nombre y SKU son obligatorios'); return; }
    const prices = {
      "Distribuidor": Number($('#tDistribuidor').value||0),
      "Centro de Consumo": Number($('#tConsumo').value||0),
      "Nuevo Distribuidor": Number($('#tNuevoDist').value||0),
      "Nuevo Centro de Consumo": Number($('#tNuevoCons').value||0),
    };
    const prods = (state().productos || []).slice();
    prods.push({ id: uid(), name: nombre, sku, prices });
    setState(shared, { productos: prods });
    $('#pNombre').value=''; $('#pSKU').value='';
    $('#tDistribuidor').value='0'; $('#tConsumo').value='0'; $('#tNuevoDist').value='0'; $('#tNuevoCons').value='0';
    renderCatalogo();
  });

  // ---------- Resumen por bodega y etapa ----------
  function renderResumen(){
    const tbody = $('#resumenBody'); if(!tbody) return;
    const rows = (state().inventario || []).slice();

    // Orden seguro (evita localeCompare en undefined)
    const key = (x)=> String(x?.productName ?? x?.nombre ?? x?.sku ?? '').toLowerCase();
    rows.sort((a,b)=> key(a).localeCompare(key(b),'es',{numeric:true,sensitivity:'base'}));

    tbody.innerHTML = rows.map(r=>`
      <tr>
        <td>${r.productName || r.nombre || ''}</td>
        <td>${r.sku || ''}</td>
        <td>${r.warehouse || r.bodega || ''}</td>
        <td>${r.stage || r.etapa || ''}</td>
        <td>${r.lot || r.lote || ''}</td>
        <td class="right">${Number(r.qty ?? r.cantidad ?? 0)}</td>
        <td class="right">
          <button class="sm" data-ajustar="${r.id}">Ajustar</button>
          <button class="sm" data-dividir="${r.id}">Dividir</button>
        </td>
      </tr>
    `).join('');
  }

  function commitInventario(next){
    const clean = next.filter(r => (Number(r.qty ?? r.cantidad) || 0) > 0).map(r=>{
      // normaliza campos
      return {
        id: r.id || uid(),
        productId: r.productId,
        productName: r.productName || r.nombre || '',
        sku: r.sku,
        warehouse: r.warehouse || r.bodega,
        stage: r.stage || r.etapa,
        lot: r.lot || r.lote,
        qty: Number(r.qty ?? r.cantidad) || 0
      };
    });
    setState(shared, { inventario: clean });
  }

  $('#resumenTable')?.addEventListener('click',(e)=>{
    const a = e.target.closest('[data-ajustar]');
    const d = e.target.closest('[data-dividir]');
    const inv = (state().inventario || []).map(x=>({...x}));

    if(a){
      const id = a.getAttribute('data-ajustar');
      const row = inv.find(r=>r.id===id);
      if(!row) return;
      const nueva = prompt(`Nueva cantidad para ${row.productName || row.nombre} (${row.sku})`, row.qty ?? row.cantidad ?? 0);
      if(nueva==null) return;
      row.qty = Number(nueva)||0;
      commitInventario(inv);
      renderResumen(); renderMatriz();
    }
    if(d){
      const id = d.getAttribute('data-dividir');
      const row = inv.find(r=>r.id===id);
      if(!row) return;
      const cant = prompt(`¿Cuánto deseas mover a una nueva fila?`, '');
      const n = Number(cant)||0; if(n<=0) return;
      const cur = Number(row.qty ?? row.cantidad)||0;
      if(n>cur){ alert('No puedes mover más de lo que hay'); return; }
      row.qty = cur - n;
      const nuevo = { ...row, id: uid(), qty: n };
      inv.push(nuevo);
      commitInventario(inv);
      renderResumen(); renderMatriz();
    }
  });

  // ---------- Matriz consolidada ----------
  function renderMatriz(){
    const head = $('#matrixHead'), body = $('#matrixBody');
    if(!head || !body) return;

    const inv = (state().inventario || []).map(r=>({
      bodega: r.warehouse || r.bodega,
      sku: r.sku,
      qty: Number(r.qty ?? r.cantidad)||0
    }));

    const skus = [...new Set(inv.map(i=>i.sku))];
    const bodegas = [...new Set(inv.map(i=>i.bodega))];

    head.innerHTML = `<tr><th>Bodega</th>${skus.map(s=>`<th>${s}</th>`).join('')}</tr>`;
    body.innerHTML = bodegas.map(b=>{
      const tds = skus.map(s=>{
        const total = inv.filter(i=>i.bodega===b && i.sku===s).reduce((a,c)=>a+c.qty,0);
        return `<td class="right">${total}</td>`;
      }).join('');
      return `<tr><td>${b}</td>${tds}</tr>`;
    }).join('');
  }

  // ---------- Primer render ----------
  renderCatalogo();
  renderResumen();
  renderMatriz();

  // ---------- Devolver API opcional ----------
  return {
    unmount(){ /* nada */ }
  };
}
