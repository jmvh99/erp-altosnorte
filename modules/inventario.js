// modules/inventario.js — Inventario con Catálogo (solo lectura),
// Alta de Stock, Movimiento, Resumen, Matriz, Historial
// + Botones: Exportar CSV, Respaldar, Restaurar

// ============================
// Helpers de estado (shared / local)
// ============================
function _getState(shared){
  if (shared?.state) return shared.state;
  // fallback local
  return {
    productos:   JSON.parse(localStorage.getItem('productos')   || '[]'),
    inventario:  JSON.parse(localStorage.getItem('inventario')  || '[]'),
    movimientos: JSON.parse(localStorage.getItem('movimientos') || '[]'),
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
// Utils export/backup
// ============================
function downloadBlob(name, blob){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 5000);
}
function toCSV(rows, headers){
  const esc = (v)=> `"${String(v ?? '').replace(/"/g,'""')}"`;
  const head = headers.map(h=>esc(h.label)).join(',');
  const body = rows.map(r => headers.map(h => esc(h.get(r))).join(',')).join('\n');
  return head + '\n' + body + '\n';
}

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
    .grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}
    .field{display:flex;flex-direction:column;gap:6px}
    .field input,.field select{background:#0f141c;color:#fff;border:1px solid #2b3340;border-radius:8px;padding:8px}
    .inline{display:flex;gap:8px;align-items:center}
    .right{text-align:right}
    .muted{color:#9aa4b2}
    .pill{display:inline-block;padding:.2rem .5rem;border:1px solid #2b3340;border-radius:999px;background:#121a26;margin:2px 6px 2px 0}
    input[type="number"]{background:#0f141c;color:#fff;border:1px solid #2b3340;border-radius:8px;padding:6px 8px}
    button{border:1px solid #2b3340;background:#1a2230;color:#fff;border-radius:8px;padding:6px 10px;cursor:pointer}
    button.sm{padding:4px 8px;border-radius:6px}
    button.ghost{background:#0f141c}
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

    /* Toolbar superior */
    .toolbar{display:flex;gap:8px;justify-content:flex-end}
    .toolbar input[type="file"]{display:none}
  `;
  document.head.appendChild(s);
})();

// ============================
// Normalizaciones
// ============================
function normalizeProduct(p){
  return {
    id: p.id || uid(),
    name: p.name || p.nombre || '',
    sku:  p.sku || '',
    prices: p.prices || p.precios || {
      "Distribuidor": 0,
      "Centro de Consumo": 0,
      "Nuevo Distribuidor": 0,
      "Nuevo Centro de Consumo": 0
    }
  };
}
function normalizeInvRow(r){
  return {
    id: r.id || uid(),
    productId: r.productId,
    productName: r.productName || r.nombre || '',
    sku: r.sku,
    warehouse: r.warehouse || r.bodega,
    stage: r.stage || r.etapa,
    lot: r.lot || r.lote || '',
    qty: Number(r.qty ?? r.cantidad) || 0
  };
}

// ============================
// Módulo principal
// ============================
export function mount(root, shared){

  // ---------- UI base ----------
  const el = document.createElement('div');
  el.className = 'inv-grid';
  el.innerHTML = `
    <!-- ===== Toolbar global ===== -->
    <section class="panel">
      <div class="toolbar">
        <button id="btnExportCsv">Exportar CSV</button>
        <button id="btnBackup">Respaldar</button>
        <label for="fileRestore" class="button"><button id="btnRestore">Restaurar</button></label>
        <input id="fileRestore" type="file" accept=".json,application/json">
      </div>
    </section>

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

    <!-- ===== Alta de Stock (lotes) ===== -->
    <section class="panel">
      <h3>Alta de Stock (lotes)</h3>
      <div class="grid3" style="margin-bottom:10px">
        <div class="field">
          <label class="muted">Producto</label>
          <select id="asProducto"></select>
        </div>
        <div class="field">
          <label class="muted">Bodega</label>
          <select id="asBodega"></select>
        </div>
        <div class="field">
          <label class="muted">Etapa</label>
          <select id="asEtapa"></select>
        </div>
      </div>
      <div class="grid3" style="margin-bottom:10px">
        <div class="field">
          <label class="muted">Cantidad (botellas)</label>
          <input id="asCantidad" type="number" step="1" min="0" placeholder="Ej. 120">
        </div>
        <div class="field">
          <label class="muted">Lote (opcional)</label>
          <input id="asLote" placeholder="Ej. L2407-R1">
        </div>
        <div class="field">
          <label class="muted">Notas (opcional)</label>
          <input id="asNotas" placeholder="Transferencia inicial / conteo físico">
        </div>
      </div>
      <div class="inline">
        <button id="asAgregar">Agregar stock</button>
      </div>
    </section>

    <!-- ===== Movimiento ===== -->
    <section class="panel">
      <h3>Movimiento</h3>
      <div class="grid3" style="margin-bottom:10px">
        <div class="field">
          <label class="muted">Producto</label>
          <select id="mvProducto"></select>
        </div>
        <div class="field">
          <label class="muted">Desde bodega</label>
          <select id="mvDesde"></select>
        </div>
        <div class="field">
          <label class="muted">Hacia bodega</label>
          <select id="mvHacia"></select>
        </div>
      </div>
      <div class="grid3" style="margin-bottom:10px">
        <div class="field">
          <label class="muted">Cambiar etapa (opcional)</label>
          <select id="mvEtapa">
            <option value="">— Mantener —</option>
          </select>
        </div>
        <div class="field">
          <label class="muted">Cantidad</label>
          <input id="mvCantidad" type="number" step="1" min="0">
        </div>
        <div class="field">
          <label class="muted">Notas (opcional)</label>
          <input id="mvNotas" placeholder="Motivo / referencia">
        </div>
      </div>
      <div class="inline">
        <button id="mvMover">Mover</button>
      </div>
    </section>

    <!-- ===== Resumen ===== -->
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

    <!-- ===== Historial ===== -->
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
  // Catálogo (solo lectura) + Alta de producto
  // ============================
  const TIERS = ["Distribuidor","Centro de Consumo","Nuevo Distribuidor","Nuevo Centro de Consumo"];

  function renderCatalogo(){
    const tbody = $('#catalogoBody'); if(!tbody) return;
    const prods = (state().productos || []).map(normalizeProduct);
    tbody.innerHTML = prods.map(p=>{
      const prices = p.prices || {};
      const chips = TIERS.map(t=>{
        const val = Number(prices[t] ?? 0);
        return `<span class="pill"><span class="muted">${t}:</span> ${money(val)}</span>`;
      }).join('');
      return `
        <tr>
          <td>${p.name}</td>
          <td>${p.sku}</td>
          <td>${chips}</td>
          <td class="right">
            <button class="danger sm" data-del-prod="${p.id}">Eliminar</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Eliminar producto
  $('#catalogoTable')?.addEventListener('click', (e)=>{
    const del = e.target.closest('[data-del-prod]');
    if(!del) return;
    const id = del.getAttribute('data-del-prod');
    const prods = (state().productos || []).filter(p=> (p.id||'') !== id);
    _setState(shared, { productos: prods });
    renderCatalogo(); refillSelects();
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
    renderCatalogo(); refillSelects();
  });

  // ============================
  // Alta de Stock (lotes)
  // ============================
  function upsertInvRow({product, warehouse, stage, lot, qty}){
    const inv = (state().inventario || []).map(normalizeInvRow);
    const idx = inv.findIndex(r =>
      r.productId===product.id &&
      r.warehouse===warehouse &&
      r.stage===stage &&
      String(r.lot||'')===String(lot||'')
    );
    if (idx >= 0){
      inv[idx].qty += qty;
    } else {
      inv.push({
        id: uid(),
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        warehouse, stage, lot: lot||'', qty
      });
    }
    _setState(shared, { inventario: inv });
  }

  $('#asAgregar')?.addEventListener('click', ()=>{
    const prods = (state().productos || []).map(normalizeProduct);
    const pid = $('#asProducto').value;
    const product = prods.find(p=>p.id===pid);
    const warehouse = $('#asBodega').value;
    const stage     = $('#asEtapa').value;
    const qty       = Number($('#asCantidad').value || 0);
    const lot       = $('#asLote').value.trim();
    const notes     = $('#asNotas').value.trim();
    if(!product || !warehouse || !stage || qty<=0){
      alert('Completa producto, bodega, etapa y cantidad.'); return;
    }
    upsertInvRow({product, warehouse, stage, lot, qty});
    pushMovimiento({
      ts: new Date().toISOString(),
      productId: product.id, productName: product.name,
      from: '(alta)', to: warehouse, stage, qty, notes
    });
    $('#asCantidad').value=''; $('#asLote').value=''; $('#asNotas').value='';
    renderResumen(); renderMatriz(); renderHistory();
  });

  // ============================
  // Movimiento entre bodegas (con cambio de etapa opcional)
  // ============================
  function moverFIFO({product, fromWh, toWh, qty, newStage, notes}){
    const inv = (state().inventario || []).map(normalizeInvRow);
    const origen = inv
      .filter(r => r.productId===product.id && r.warehouse===fromWh && r.qty>0)
      .sort((a,b)=> String(a.lot ?? '').localeCompare(String(b.lot ?? ''), 'es', {numeric:true, sensitivity:'base'}));

    let restante = qty;
    if(!origen.length){ alert('No hay stock en la bodega origen.'); return false; }

    for (const src of origen){
      if (restante<=0) break;
      const tomar = Math.min(src.qty, restante);
      src.qty -= tomar;
      restante -= tomar;

      const stageDst = newStage || src.stage;

      const idx = inv.findIndex(r =>
        r.productId===product.id &&
        r.warehouse===toWh &&
        r.stage===stageDst &&
        String(r.lot||'')===String(src.lot||'')
      );
      if (idx>=0) inv[idx].qty += tomar;
      else inv.push({
        id: uid(),
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        warehouse: toWh,
        stage: stageDst,
        lot: src.lot || '',
        qty: tomar
      });
    }

    if (restante>0){
      alert('Stock insuficiente para mover esa cantidad.');
      return false;
    }

    _setState(shared, { inventario: inv });
    pushMovimiento({
      ts: new Date().toISOString(),
      productId: product.id, productName: product.name,
      from: fromWh, to: toWh, stage: newStage || '(mismo)',
      qty, notes
    });
    return true;
  }

  $('#mvMover')?.addEventListener('click', ()=>{
    const prods = (state().productos || []).map(normalizeProduct);
    const pid = $('#mvProducto').value;
    const product = prods.find(p=>p.id===pid);
    const fromWh  = $('#mvDesde').value;
    const toWh    = $('#mvHacia').value;
    const qty     = Number($('#mvCantidad').value || 0);
    const newStage= $('#mvEtapa').value || '';
    const notes   = $('#mvNotas').value.trim();

    if(!product || !fromWh || !toWh || !qty){ alert('Completa producto, bodegas y cantidad.'); return; }
    if (fromWh===toWh){ alert('Elige bodegas distintas.'); return; }

    const ok = moverFIFO({product, fromWh, toWh, qty, newStage, notes});
    if (ok){
      $('#mvCantidad').value=''; $('#mvNotas').value='';
      renderResumen(); renderMatriz(); renderHistory();
    }
  });

  // ============================
  // Resumen por bodega y etapa
  // ============================
  function commitInventario(next){
    const clean = next.map(normalizeInvRow).filter(r=>r.qty>0);
    _setState(shared, { inventario: clean });
  }

  function renderResumen(){
    const tbody = $('#resumenBody'); if(!tbody) return;
    const rows = (state().inventario || []).map(normalizeInvRow);

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
          <button class="sm ghost" data-ajustar="${r.id}">Ajustar / dividir</button>
        </td>
      </tr>
    `).join('');
  }

  $('#resumenTable')?.addEventListener('click',(e)=>{
    const btn = e.target.closest('[data-ajustar]');
    if(!btn) return;
    const id = btn.getAttribute('data-ajustar');

    const inv = (state().inventario || []).map(r=>({...r}));
    const row = inv.find(r=>r.id===id); if(!row) return;

    const modo = (prompt('Escribe A = Ajustar cantidad\nD = Dividir lote','A')||'').trim().toUpperCase();
    if (modo==='A'){
      const nueva = prompt(`Nueva cantidad para ${row.productName} (${row.sku})`, row.qty ?? 0);
      if(nueva==null) return;
      row.qty = Number(nueva)||0;
      commitInventario(inv);
      pushMovimiento({
        ts: new Date().toISOString(),
        productId: row.productId, productName: row.productName,
        from: row.warehouse, to: '(ajuste)', stage: row.stage,
        qty: row.qty, notes: 'Ajuste manual'
      });
    } else if (modo==='D'){
      const cant = prompt('¿Cuánto mover a nueva fila?', '');
      const n = Number(cant)||0; if(n<=0) return;
      const cur = Number(row.qty)||0;
      if(n>cur){ alert('No puedes mover más de lo que hay'); return; }
      row.qty = cur - n;
      const nuevo = { ...row, id: uid(), qty: n };
      inv.push(nuevo);
      commitInventario(inv);
      pushMovimiento({
        ts: new Date().toISOString(),
        productId: row.productId, productName: row.productName,
        from: row.warehouse, to: row.warehouse, stage: row.stage,
        qty: n, notes: 'División de lote'
      });
    }
    renderResumen(); renderMatriz(); renderHistory();
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
  // Historial de movimientos (seguro si faltan ts)
  // ============================
  function pushMovimiento(mv){
    const arr = Array.isArray(state().movimientos) ? state().movimientos.slice() : [];
    arr.push(mv);
    _setState(shared, { movimientos: arr });
  }

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
  // Toolbar: Exportar / Respaldar / Restaurar
  // ============================
  $('#btnExportCsv')?.addEventListener('click', ()=>{
    const inv = (state().inventario || []).map(normalizeInvRow);
    const headers = [
      {label:'Producto',  get:r=>r.productName},
      {label:'SKU',       get:r=>r.sku},
      {label:'Bodega',    get:r=>r.warehouse},
      {label:'Etapa',     get:r=>r.stage},
      {label:'Lote',      get:r=>r.lot},
      {label:'Cantidad',  get:r=>r.qty},
    ];
    const csv = toCSV(inv, headers);
    downloadBlob(`inventario_${new Date().toISOString().slice(0,10)}.csv`, new Blob([csv],{type:'text/csv;charset=utf-8'}));
  });

  $('#btnBackup')?.addEventListener('click', ()=>{
    const dump = {
      version: 1,
      date: new Date().toISOString(),
      productos:   (state().productos   || []),
      inventario:  (state().inventario  || []),
      movimientos: (state().movimientos || []),
    };
    downloadBlob(`backup_inventario_${new Date().toISOString().replace(/[:.]/g,'-')}.json`,
      new Blob([JSON.stringify(dump,null,2)],{type:'application/json'}));
  });

  $('#fileRestore')?.addEventListener('change', (e)=>{
    const f = e.target.files?.[0];
    if(!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try{
        const parsed = JSON.parse(reader.result);
        const productos   = Array.isArray(parsed.productos)   ? parsed.productos   : [];
        const inventario  = Array.isArray(parsed.inventario)  ? parsed.inventario  : [];
        const movimientos = Array.isArray(parsed.movimientos) ? parsed.movimientos : [];
        _setState(shared, { productos, inventario, movimientos });
        // repintar
        renderCatalogo(); refillSelects(); renderResumen(); renderMatriz(); renderHistory();
        alert('Restaurado correctamente.');
      }catch(err){
        console.error(err);
        alert('Archivo inválido.');
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsText(f);
  });

  // ============================
  // Selects
  // ============================
  function refillSelects(){
    const prods = (state().productos || []).map(normalizeProduct);
    const w     = state().warehouses || [];
    const st    = state().stages || [];

    const selProdIds = ['asProducto','mvProducto'];
    selProdIds.forEach(id=>{
      const s = $('#'+id); if(!s) return;
      const cur = s.value;
      s.innerHTML = prods.map(p=>`<option value="${p.id}">${p.sku} — ${p.name}</option>`).join('');
      if (cur) s.value = cur;
    });

    const selBodegas = ['asBodega','mvDesde','mvHacia'];
    selBodegas.forEach(id=>{
      const s = $('#'+id); if(!s) return;
      const cur = s.value;
      s.innerHTML = w.map(x=>`<option value="${x}">${x}</option>`).join('');
      if (cur) s.value = cur;
    });

    const asEtapa = $('#asEtapa');
    if (asEtapa) {
      const cur = asEtapa.value;
      asEtapa.innerHTML = st.map(x=>`<option value="${x}">${x}</option>`).join('');
      if (cur) asEtapa.value = cur;
    }

    const mvEtapa = $('#mvEtapa');
    if (mvEtapa) {
      const cur = mvEtapa.value;
      mvEtapa.innerHTML = `<option value="">— Mantener —</option>` + st.map(x=>`<option value="${x}">${x}</option>`).join('');
      if (cur) mvEtapa.value = cur;
    }
  }

  // ============================
  // Primer render
  // ============================
  renderCatalogo();
  refillSelects();
  renderResumen();
  renderMatriz();
  renderHistory();

  // ============================
  // API opcional
  // ============================
  return { unmount(){} };
}
