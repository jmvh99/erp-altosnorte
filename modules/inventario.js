// modules/inventario.js — REEMPLAZO COMPLETO

// ============================
// Helpers de estado (shared / local)
// ============================
function _getState(shared){
  if (shared?.state) return shared.state;
  // fallback local
  return {
    productos:  JSON.parse(localStorage.getItem('productos')  || '[]'),
    inventario: JSON.parse(localStorage.getItem('inventario') || '[]'),
    movimientos:JSON.parse(localStorage.getItem('movimientos')|| '[]'),
    priceTiers: [
      "Distribuidor","Centro de Consumo","Nuevo Distribuidor","Nuevo Centro de Consumo"
    ],
    warehouses: [
      "Bodega en medio","Bodega chica","Bodega externa","Bodega casa","Espacio AN","Oficina"
    ],
    stages: ["Embotellado","Degollado","Producto terminado"]
  };
}
function _setState(shared, patch){
  if (shared?.set) { shared.set(patch); return; }
  // fallback local
  const cur = _getState();
  const next = { ...cur, ...patch };
  if ('productos'   in patch) localStorage.setItem('productos',   JSON.stringify(next.productos));
  if ('inventario'  in patch) localStorage.setItem('inventario',  JSON.stringify(next.inventario));
  if ('movimientos' in patch) localStorage.setItem('movimientos', JSON.stringify(next.movimientos));
}

const uid   = ()=> crypto.randomUUID?.() || Math.random().toString(36).slice(2,9);
const money = (n)=> new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(Number(n||0));

// ============================
// CSS embebido (layout robusto)
// ============================
(function injectCSS(){
  if (document.getElementById('inv-css')) return;
  const s=document.createElement('style');
  s.id='inv-css';
  s.textContent = `
    .panel{position:relative}
    .panel + .panel{margin-top:16px}
    .inv-grid{display:grid;gap:16px}
    .grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .field{display:flex;flex-direction:column;gap:6px}
    .field input,.field select{background:#0f141c;color:#fff;border:1px solid #2b3340;border-radius:8px;padding:8px}
    .inline{display:flex;gap:8px;align-items:center}
    .right{text-align:right}
    .muted{color:#9aa4b2}
    .chip{display:inline-flex;gap:6px;align-items:center;margin:4px 6px 4px 0}
    input[type="number"]{background:#0f141c;color:#fff;border:1px solid #2b3340;border-radius:8px;padding:6px 8px}
    button{border:1px solid #2b3340;background:#1a2230;color:#fff;border-radius:8px;padding:6px 10px;cursor:pointer}
    button.sm{padding:4px 8px;border-radius:6px}
    button.danger{background:#3a1a1a;border-color:#5a2a2a}
    h3{margin:6px 0 10px}

    .table{width:100%;border-collapse:collapse}
    .table th,.table td{padding:8px 10px;border-bottom:1px solid var(--border,#2b3340);vertical-align:middle;white-space:nowrap}
    .table th{position:sticky;top:0;background:#11161f;z-index:1}

    /* Catálogo SIN límite de alto ni recortes */
    .catalogo-wrap{
      background:var(--panel,#11161f);
      border:1px solid var(--border,#333);
      border-radius:12px;
      padding:12px;
      overflow:visible;
    }

    /* Scroll propio sólo para bloques largos */
    .table-wrap.tall{max-height:70vh;overflow:auto}
    .table-wrap-x{overflow:auto}
  `;
  document.head.appendChild(s);
})();

// ============================
// Módulo principal
// ============================
export function mount(root, shared){

  // ---------- UI base ----------
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

      <div class="catalogo-wrap">
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

    <!-- ===== Historial de movimientos ===== -->
    <section class="panel">
      <h3>Historial</h3>
      <div class="table-wrap tall">
        <table class="table" id="historyTable">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Producto</th>
              <th>Desde</th>
              <th>Hacia</th>
              <th>Etapa</th>
              <th class="right">Cantidad</th>
              <th>Notas</th>
            </tr>
          </thead>
          <tbody id="historyBody"></tbody>
        </table>
      </div>
    </section>
  `;
  root.innerHTML = '';
  root.appendChild(el);

  const $ = (sel) => el.querySelector(sel);
  const state = () => _getState(shared);

  // ============================
  // Catálogo
  // ============================
  const TIERS = ["Distribuidor","Centro de Consumo","Nuevo Distribuidor","Nuevo Centro de Consumo"];

  function renderCatalogo(){
    const tbody = $('#catalogoBody'); if(!tbody) return;
    const prods = state().productos || [];
    tbody.innerHTML = prods.map(p=>{
      const prices = p.prices || p.precios || {};
      const chips = TIERS.map(t=>{
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

  // Guardado inline de precio por tier
  $('#catalogoTable')?.addEventListener('change', (e)=>{
    const inp = e.target.closest('input[data-price-tier][data-prod]');
    if(!inp) return;
    const tier = inp.getAttribute('data-price-tier');
    const pid  = inp.getAttribute('data-prod');
    const val  = Number(inp.value || 0);

    const prods = (state().productos || []).map(r=>({...r}));
    const p = prods.find(x=>x.id===pid);
    if(!p) return;
    p.prices = {...(p.prices || p.precios || {})};
    p.prices[tier] = val;
    // normaliza campos
    p.name = p.name || p.nombre || '';
    delete p.precios; delete p.nombre;

    _setState(shared, { productos: prods });
    renderCatalogo();
  });

  // Eliminar producto
  $('#catalogoTable')?.addEventListener('click', (e)=>{
    const del = e.target.closest('[data-del-prod]');
    if(!del) return;
    const id = del.getAttribute('data-del-prod');
    const prods = (state().productos || []).filter(p=>p.id!==id);
    _setState(shared, { productos: prods });
    renderCatalogo();
  });

  // Alta rápida producto
  $('#addProducto')?.addEventListener('click', ()=>{
    const nombre = $('#pNombre')?.value?.trim();
    const sku    = $('#pSKU')?.value?.trim();
    if(!nombre || !sku){ alert('Nombre y SKU son obligatorios'); return; }
    const prices = {
      "Distribuidor": Number($('#tDistribuidor').value || 0),
      "Centro de Consumo": Number($('#tConsumo').value || 0),
      "Nuevo Distribuidor": Number($('#tNuevoDist').value || 0),
      "Nuevo Centro de Consumo": Number($('#tNuevoCons').value || 0),
    };
    const prods = (state().productos || []).slice();
    prods.push({ id: uid(), name: nombre, sku, prices });
    _setState(shared, { productos: prods });
    $('#pNombre').value=''; $('#pSKU').value='';
    $('#tDistribuidor').value='0'; $('#tConsumo').value='0'; $('#tNuevoDist').value='0'; $('#tNuevoCons').value='0';
    renderCatalogo();
  });

  // ============================
  // Resumen por bodega y etapa
  // ============================
  function normalizeInvRow(r){
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
  }
  function commitInventario(next){
    const clean = next.map(normalizeInvRow).filter(r=>r.qty>0);
    _setState(shared, { inventario: clean });
  }

  function renderResumen(){
    const tbody = $('#resumenBody'); if(!tbody) return;
    const rows = (state().inventario || []).map(normalizeInvRow);

    // Orden seguro por nombre/sku (evita localeCompare sobre undefined)
    const key = (x)=> String(x?.productName ?? x?.sku ?? '').toLowerCase();
    rows.sort((a,b)=> key(a).localeCompare(key(b), 'es', { numeric:true, sensitivity:'base' }));

    tbody.innerHTML = rows.map(r=>`
      <tr>
        <td>${r.productName}</td>
        <td>${r.sku}</td>
        <td>${r.warehouse}</td>
        <td>${r.stage}</td>
        <td>${r.lot || ''}</td>
        <td class="right">${r.qty}</td>
        <td class="right">
          <button class="sm" data-ajustar="${r.id}">Ajustar</button>
          <button class="sm" data-dividir="${r.id}">Dividir</button>
        </td>
      </tr>
    `).join('');
  }

  $('#resumenTable')?.addEventListener('click',(e)=>{
    const btnA = e.target.closest('[data-ajustar]');
    const btnD = e.target.closest('[data-dividir]');
    if(!btnA && !btnD) return;

    const inv = (state().inventario || []).map(r=>({...r}));
    const id = (btnA||btnD).getAttribute(btnA?'data-ajustar':'data-dividir');
    const row = inv.find(r=>r.id===id);
    if(!row) return;

    if(btnA){
      const nueva = prompt(`Nueva cantidad para ${row.productName} (${row.sku})`, row.qty ?? row.cantidad ?? 0);
      if(nueva==null) return;
      row.qty = Number(nueva)||0;
      commitInventario(inv);
      pushMovimiento({
        ts: new Date().toISOString(),
        productId: row.productId,
        productName: row.productName,
        from: row.warehouse,
        to: '(ajuste)',
        stage: row.stage,
        qty: row.qty - (Number(row.cantidadPrev)||0),
        notes: 'Ajuste manual'
      });
      renderResumen(); renderMatriz(); renderHistory();
    }
    if(btnD){
      const cant = prompt('¿Cuánto mover a una nueva fila?', '');
      const n = Number(cant)||0; if(n<=0) return;
      const cur = Number(row.qty ?? row.cantidad)||0;
      if(n>cur){ alert('No puedes mover más de lo que hay'); return; }
      row.qty = cur - n;
      const nuevo = { ...row, id: uid(), qty: n };
      inv.push(nuevo);
      commitInventario(inv);
      pushMovimiento({
        ts: new Date().toISOString(),
        productId: row.productId,
        productName: row.productName,
        from: row.warehouse,
        to: row.warehouse,
        stage: row.stage,
        qty: n,
        notes: 'División de lote'
      });
      renderResumen(); renderMatriz(); renderHistory();
    }
  });

  // ============================
  // Matriz consolidada
  // ============================
  function renderMatriz(){
    const head = $('#matrixHead'), body = $('#matrixBody');
    if(!head || !body) return;

    const inv = (state().inventario || []).map(normalizeInvRow);
    const skus = [...new Set(inv.map(i=>i.sku))];
    const bodegas = [...new Set(inv.map(i=>i.warehouse))];

    head.innerHTML = `<tr><th>Bodega</th>${skus.map(s=>`<th>${s}</th>`).join('')}</tr>`;
    body.innerHTML = bodegas.map(b=>{
      const tds = skus.map(s=>{
        const total = inv.filter(i=>i.warehouse===b && i.sku===s)
                         .reduce((a,c)=>a+c.qty,0);
        return `<td class="right">${total}</td>`;
      }).join('');
      return `<tr><td>${b}</td>${tds}</tr>`;
    }).join('');
  }

  // ============================
  // Historial de movimientos
  // ============================
  function pushMovimiento(mv){
    const arr = Array.isArray(state().movimientos) ? state().movimientos.slice() : [];
    arr.push(mv);
    _setState(shared, { movimientos: arr });
  }

  // Sanea movimientos sin ts (evita errores al ordenar)
  (function normalizeMissingTs(){
    const movs = state().movimientos || [];
    if(!movs.length) return;
    let changed=false;
    const fixed = movs.map((m,i)=>{
      if(!m?.ts){
        changed=true;
        return { ...m, ts: new Date(Date.now() - (movs.length-i)*1000).toISOString() };
      }
      return m;
    });
    if(changed) _setState(shared, { movimientos: fixed });
  })();

  function renderHistory(){
    const tbody = $('#historyBody'); if(!tbody) return;

    const rows = (state().movimientos || [])
      .slice()
      .sort((a,b)=>{
        // ordenar por fecha real si es válida; si no, por string seguro
        const da = a?.ts ? Date.parse(a.ts) : NaN;
        const db = b?.ts ? Date.parse(b.ts) : NaN;
        if(!Number.isNaN(da) && !Number.isNaN(db)) return db - da; // DESC
        const A = String(a?.ts ?? ''), B = String(b?.ts ?? '');
        return B.localeCompare(A,'es',{numeric:true,sensitivity:'base'});
      });

    tbody.innerHTML = rows.map(m=>`
      <tr>
        <td>${m.ts ? new Date(m.ts).toLocaleString('es-MX') : ''}</td>
        <td>${m.productName || ''}</td>
        <td>${m.from || ''}</td>
        <td>${m.to || ''}</td>
        <td>${m.stage || ''}</td>
        <td class="right">${m.qty ?? ''}</td>
        <td>${m.notes || ''}</td>
      </tr>
    `).join('');
  }

  // ============================
  // Primer render
  // ============================
  renderCatalogo();
  renderResumen();
  renderMatriz();
  renderHistory();

  // ============================
  // API opcional
  // ============================
  return { unmount(){} };
}
