// modules/inventario.js — FIX overlay + matriz consolidada por bodega/producto
import { store } from './store.js';

export function mount(root, shared){
  if(!Array.isArray(shared.state.inventario)) shared.set({ inventario: [] });
  if(!Array.isArray(shared.state.movimientos)) shared.set({ movimientos: [] });
  if(!Array.isArray(shared.state.productos))  shared.set({ productos: [] });
  if(!Array.isArray(shared.state.warehouses)) shared.set({ warehouses: ["Bodega en medio","Bodega chica","Bodega externa","Bodega casa","Espacio AN","Oficina"] });
  if(!Array.isArray(shared.state.stages))     shared.set({ stages: ["Embotellado","Degollado","Producto terminado"] });
  const REQUIRED_TIERS = ["Distribuidor","Centro de Consumo","Nuevo Distribuidor","Nuevo Centro de Consumo"];
  if(!Array.isArray(shared.state.priceTiers)){
    shared.set({ priceTiers: REQUIRED_TIERS.slice() });
  }else{
    const merged = Array.from(new Set([...(shared.state.priceTiers||[]), ...REQUIRED_TIERS]));
    if(merged.join('|') !== (shared.state.priceTiers||[]).join('|')) shared.set({ priceTiers: merged });
  }

  const WAREHOUSES = () => shared.state.warehouses;
  const STAGES = () => shared.state.stages;
  const TIERS = () => shared.state.priceTiers;

  const div = document.createElement('div');
  div.className = 'panel active';
  div.innerHTML = `
    <style>
      .panel + .panel { margin-top: 16px; }
      .scroll.fix-bg { background: var(--panel-bg, #13161c); position: relative; z-index: 1; border-radius: 10px; }
      .chips { display:flex; flex-wrap:wrap; gap:6px; }
      .chip2 { padding:2px 8px; border-radius:999px; border:1px solid var(--border,#2a2f3a); font-size:12px; opacity:.9 }
      .pricesCol { min-width: 260px; }
      .catalogo-wrap { position: relative; z-index: 2; }
    </style>
    <div class="inline" style="justify-content:space-between; align-items:center">
      <div><h2 style="margin:0">Inventario de Botellas</h2><div class="note">Flujo entre bodegas y etapas • Guarda en tu navegador</div></div>
      <div class="inline">
        <button id="btnExportCSV" class="secondary">Exportar CSV</button>
        <button id="btnBackup" class="secondary">Respaldar</button>
        <label class="secondary" style="cursor:pointer">Restaurar<input id="restoreFile" type="file" accept="application/json" style="display:none"></label>
      </div>
    </div>

    <div class="grid3" style="margin-top:14px; gap:16px">
      <section class="panel catalogo-wrap">
        <h3>Catálogo de Productos</h3>
        <div class="inline">
          <div style="flex:1">
            <label>Nombre del producto</label>
            <input id="pName" type="text" placeholder="Ej. Pet-Nat Rosado 2024" />
          </div>
          <div style="width:180px">
            <label>SKU / Código</label>
            <input id="pSKU" type="text" placeholder="Ej. AN-PN24" />
          </div>
        </div>

        <div id="tierPrices" style="margin-top:8px"></div>
        <div class="note">Precios por <strong>tier</strong>. Puedes editarlos exportando/importando el catálogo.</div>

        <div class="inline" style="margin-top:10px">
          <button id="addProduct">Agregar</button>
        </div>

        <div class="hr" style="height:1px;background:var(--border);margin:10px 0"></div>
        <div class="inline" style="align-items:center; gap:8px">
          <input id="productSearch" type="text" placeholder="Buscar…" style="flex:1" />
          <span class="chip" id="productCount">0 productos</span>
          <button id="exportCatalog" class="secondary">Exportar catálogo</button>
          <label class="secondary" style="cursor:pointer">Importar catálogo<input id="importCatalog" type="file" accept="application/json" style="display:none"></label>
        </div>
        <div class="scroll fix-bg" style="max-height:280px; margin-top:8px; padding:2px;">
          <table id="productTable" style="width:100%">
            <thead><tr><th style="width:35%">Producto</th><th style="width:12%">SKU</th><th class="pricesCol">(por tier)</th><th class="right" style="width:120px">Acciones</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
      </section>

      <section class="panel">
        <h3>Alta de Stock (lotes)</h3>
        <label>Producto</label>
        <select id="sProduct"></select>
        <div class="inline">
          <div style="flex:1">
            <label>Bodega</label>
            <select id="sWarehouse"></select>
          </div>
          <div style="flex:1">
            <label>Etapa</label>
            <select id="sStage"></select>
          </div>
        </div>
        <div class="inline">
          <div style="flex:1">
            <label>Cantidad (botellas)</label>
            <input id="sQty" type="number" min="1" step="1" placeholder="Ej. 120" />
          </div>
          <div style="flex:1">
            <label>Lote (opcional)</label>
            <input id="sLot" type="text" placeholder="Ej. L2407-R1" />
          </div>
        </div>
        <label>Notas (opcional)</label>
        <input id="sNotes" type="text" placeholder="Ej. Transferencia inicial / conteo físico" />
        <div class="inline" style="margin-top:6px">
          <button id="addStock">Agregar stock</button>
          <button id="recount" class="secondary">Recontar totales</button>
        </div>
      </section>

      <section class="panel">
        <h3>Movimiento</h3>
        <label>Producto</label>
        <select id="mProduct"></select>
        <div class="inline">
          <div style="flex:1">
            <label>Desde bodega</label>
            <select id="mFrom"></select>
          </div>
          <div style="flex:1">
            <label>Hacia bodega</label>
            <select id="mTo"></select>
          </div>
        </div>
        <div class="inline">
          <div style="flex:1">
            <label>Cambiar etapa (opcional)</label>
            <select id="mStage"><option value="">— Mantener —</option></select>
          </div>
          <div style="flex:1">
            <label>Cantidad</label>
            <input id="mQty" type="number" min="1" step="1" />
          </div>
        </div>
        <label>Notas (opcional)</label>
        <input id="mNotes" type="text" placeholder="Motivo / referencia" />
        <div class="inline" style="margin-top:6px">
          <button id="doMove">Mover</button>
          <span class="note">Los movimientos quedan en el historial.</span>
        </div>
      </section>
    </div>

    <section class="panel" style="margin-top:18px">
      <h3>Resumen por bodega y etapa</h3>
      <div class="inline" style="justify-content:space-between;align-items:center;margin-bottom:8px">
        <div class="inline" style="gap:8px">
          <span class="note">Filtrar</span>
          <select id="fWarehouse"></select>
          <select id="fStage"></select>
          <input id="fText" type="text" placeholder="Producto/SKU/Lote…" style="min-width:240px" />
        </div>
        <button id="btnClearFilters" class="secondary">Limpiar filtros</button>
      </div>
      <div class="scroll" style="max-height:360px">
        <table id="stockTable">
          <thead>
            <tr>
              <th>Producto</th><th>SKU</th><th>Bodega</th><th>Etapa</th><th>Lote</th><th class="right">Cantidad</th><th class="right">Acciones</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    </section>

    <section class="panel" style="margin-top:16px">
      <h3>Matriz por bodega y producto (consolidado)</h3>
      <div class="note">Totales por bodega (filas) y producto (columnas). Suma todas las etapas.</div>
      <div class="scroll" style="max-height:320px">
        <table id="matrixTable"></table>
      </div>
    </section>

    <section class="panel" style="margin-top:16px">
      <h3>Historial de movimientos</h3>
      <div class="inline" style="justify-content:space-between;align-items:center;margin-bottom:8px">
        <div class="inline">
          <span class="note">Rango</span>
          <input id="hFrom" type="date" />
          <input id="hTo" type="date" />
        </div>
        <button id="btnClearDates" class="secondary">Limpiar rango</button>
      </div>
      <div class="scroll" style="max-height:320px">
        <table id="histTable">
          <thead>
            <tr>
              <th>Fecha</th><th>Producto</th><th>Desde</th><th>Hacia</th><th>Etapa</th><th class="right">Cantidad</th><th>Notas</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    </section>
  `;
  root.appendChild(div);

  const $ = (sel) => div.querySelector(sel);
  const fmt = (n) => new Intl.NumberFormat('es-MX',{maximumFractionDigits:2}).format(n);

  function productById(id){ return shared.state.productos.find(p=>p.id===id); }
  function toast(msg){ alert(msg); }

  function renderTierInputs(){
    const container = $('#tierPrices');
    container.innerHTML = '';
    for(const t of TIERS()){
      const row = document.createElement('div');
      row.className = 'inline';
      row.innerHTML = `<div style="width:240px"><label>Precio — ${t}</label><input type="number" step="0.01" min="0" data-tier="${t}" placeholder="0.00"></div>`;
      container.appendChild(row);
    }
  }
  function pricesFromInputs(){
    const map = {};
    for(const t of TIERS()){
      const el = $('#tierPrices').querySelector(`[data-tier="${t}"]`);
      map[t] = Number(el?.value || 0);
    }
    return map;
  }
  function fillProductsSelect(sel, includeBlank=false){
    sel.innerHTML = includeBlank ? '<option value=\"\"></option>' : '';
    for(const p of shared.state.productos){
      const opt = document.createElement('option');
      opt.value = p.id; opt.textContent = p.name + (p.sku? (' — '+p.sku):'');
      sel.appendChild(opt);
    }
  }
  function fillSelectOptions(sel, arr, includeBlank=false){
    sel.innerHTML = includeBlank ? '<option value=\"\"></option>' : '';
    for(const v of arr){
      const opt = document.createElement('option');
      opt.value = v; opt.textContent = v;
      sel.appendChild(opt);
    }
  }
  function renderProducts(){
    const tbody = $('#productTable tbody');
    const q = ($('#productSearch').value||'').trim().toLowerCase();
    tbody.innerHTML = '';
    let count = 0;
    for(const p of shared.state.productos){
      const hit = [p.name,p.sku].join(' ').toLowerCase().includes(q);
      if(!hit) continue;
      count++;
      const prices = p.prices || {};
      const chips = TIERS().map(t => `<span class="chip2">${t}: $${(prices[t]||0).toFixed(2)}</span>`).join('');
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${p.name}</td><td class="muted">${p.sku||''}</td><td><div class="chips">${chips}</div></td><td class="right"><button class="secondary" data-act="del" data-id="${p.id}">Eliminar</button></td>`;
      tbody.appendChild(tr);
    }
    $('#productCount').textContent = `${count} producto${count!==1?'s':''}`;
    tbody.onclick = (e)=>{
      const btn = e.target.closest('button[data-act="del"]');
      if(!btn) return;
      const id = btn.getAttribute('data-id');
      if(confirm('¿Eliminar producto? Se mantendrán los registros históricos.')){
        shared.set({ productos: shared.state.productos.filter(p=>p.id!==id) });
        renderAll();
      }
    };
    fillProductsSelect($('#sProduct'));
    fillProductsSelect($('#mProduct'));
  }

  function addProduct(){
    const name = $('#pName').value.trim();
    if(!name) return toast('Nombre requerido');
    const sku  = $('#pSKU').value.trim();
    const prices = pricesFromInputs();
    const prod = {id: crypto.randomUUID?.()||String(Date.now()), name, sku, prices};
    shared.set({ productos: [...shared.state.productos, prod] });
    $('#pName').value=''; $('#pSKU').value='';
    renderTierInputs();
    renderAll(); toast('Producto agregado con precios por tier');
  }

  function renderStock(){
    const tbody = $('#stockTable tbody');
    const wh = $('#fWarehouse').value;
    const st = $('#fStage').value;
    const txt = ($('#fText').value||'').trim().toLowerCase();
    tbody.innerHTML = '';
    const rows = [];
    for(const s of shared.state.inventario){
      const p = productById(s.productId) || {name:'(eliminado)', sku:''};
      const key = [s.productId, s.warehouse||'', s.stage||'', s.lot||''].join('|');
      let row = rows.find(r=>r.key===key);
      if(!row){
        row = { key, productId:s.productId, product:p, warehouse:s.warehouse||'', stage:s.stage||'', lot:s.lot||'', qty:0 };
        rows.push(row);
      }
      row.qty += s.qty;
    }
    const filtered = rows.filter(r=>{
      if(wh && r.warehouse!==wh) return false;
      if(st && r.stage!==st) return false;
      const blob = [r.product.name, r.product.sku, r.lot].join(' ').toLowerCase();
      if(txt && !blob.includes(txt)) return false;
      return true;
    }).sort((a,b)=> a.product.name.localeCompare(b.product.name));

    for(const r of filtered){
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${r.product.name}</td><td class="muted">${r.product.sku||''}</td><td>${r.warehouse||'—'}</td><td>${r.stage||'—'}</td><td class="muted">${r.lot||''}</td><td class="right">${fmt(r.qty)}</td><td class="right"><button class="secondary" data-act="split" data-key="${r.key}">Ajustar / dividir</button></td>`;
      tbody.appendChild(tr);
    }
  }

  function renderMatrix(){
    const tbl = $('#matrixTable');
    const products = shared.state.productos.slice().sort((a,b)=> a.name.localeCompare(b.name));
    const warehouses = WAREHOUSES();
    let html = '<thead><tr><th>Bodega</th>';
    for(const p of products){ html += `<th class="right" title="${p.sku}">${p.name}</th>`; }
    html += '<th class="right">Total</th></tr></thead><tbody>';
    for(const w of warehouses){
      let rowTotal = 0;
      html += `<tr><td>${w}</td>`;
      for(const p of products){
        const qty = shared.state.inventario
          .filter(s=> s.warehouse===w && s.productId===p.id)
          .reduce((a,b)=> a + (b.qty||0), 0);
        rowTotal += qty;
        html += `<td class="right">${fmt(qty)}</td>`;
      }
      html += `<td class="right"><strong>${fmt(rowTotal)}</strong></td></tr>`;
    }
    html += '</tbody>';
    tbl.innerHTML = html;
  }

  function renderFilters(){
    fillSelectOptions($('#fWarehouse'), [''].concat(WAREHOUSES()));
    fillSelectOptions($('#fStage'), [''].concat(STAGES()));
  }
  function renderMoveSelectors(){
    fillSelectOptions($('#mFrom'), WAREHOUSES(), true);
    fillSelectOptions($('#mTo'), WAREHOUSES(), true);
    const mStage = $('#mStage'); mStage.innerHTML = '<option value=\"\">— Mantener —</option>';
    for(const s of STAGES()){ const o=document.createElement('option'); o.value=s; o.textContent=s; mStage.appendChild(o); }
  }
  function renderStockSelectors(){
    fillProductsSelect($('#sProduct'));
    fillSelectOptions($('#sWarehouse'), WAREHOUSES());
    fillSelectOptions($('#sStage'), STAGES());
  }

  function addStock(){
    const productId = $('#sProduct').value;
    const warehouse = $('#sWarehouse').value;
    const stage = $('#sStage').value;
    const qty  = parseInt($('#sQty').value,10);
    const lot  = $('#sLot').value.trim();
    const notes= $('#sNotes').value.trim();
    if(!productId) return toast('Selecciona un producto');
    if(!warehouse || !stage) return toast('Selecciona bodega y etapa');
    if(!(qty>0)) return toast('Cantidad inválida');
    store.push('inventario',{id: crypto.randomUUID?.()||String(Date.now()), productId, warehouse, stage, qty, lot, notes});
    store.push('movimientos',{ts:new Date().toISOString(), productId, from:'(alta)', to:warehouse, stage, qty, notes: notes||'Alta de stock'});
    $('#sQty').value=''; $('#sLot').value=''; $('#sNotes').value='';
    renderAll(); toast('Stock agregado');
  }

  function exportCSV(){
    const rows = [['fecha','productoId','desde','hacia','etapa','cantidad','notas']];
    for(const m of shared.state.movimientos){
      rows.push([m.ts, m.productId, m.from||'', m.to||'', m.stage||'', m.qty, (m.notes||'').replace(/[\r\n]+/g,' ')]);
    }
    const csv = rows.map(r=> r.map(v=> `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8'}));
    a.download = 'movimientos.csv'; a.click(); URL.revokeObjectURL(a.href);
  }
  function backupJSON(){
    const payload = {
      productos: shared.state.productos,
      inventario: shared.state.inventario,
      movimientos: shared.state.movimientos,
      warehouses: shared.state.warehouses,
      stages: shared.state.stages,
      priceTiers: shared.state.priceTiers
    };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], {type:'application/json;charset=utf-8'}));
    a.download = 'inventario_backup.json'; a.click(); URL.revokeObjectURL(a.href);
  }
  function restoreJSON(file){
    const reader = new FileReader();
    reader.onload = (e)=>{
      try{
        const obj = JSON.parse(e.target.result);
        const patch = {
          productos: obj.productos || shared.state.productos,
          inventario: obj.inventario || shared.state.inventario,
          movimientos: obj.movimientos || shared.state.movimientos,
          warehouses: obj.warehouses || shared.state.warehouses,
          stages: obj.stages || shared.state.stages,
          priceTiers: obj.priceTiers || shared.state.priceTiers
        };
        shared.set(patch);
        renderAll(); alert('Restaurado');
      }catch(err){ alert('Archivo inválido: '+err.message); }
    };
    reader.readAsText(file);
  }

  function renderHistory(){
    const tbody = $('#histTable tbody');
    const dFrom = $('#hFrom').value ? new Date($('#hFrom').value) : null;
    const dTo   = $('#hTo').value ? new Date($('#hTo').value) : null;
    tbody.innerHTML = '';
    const rows = shared.state.movimientos.slice().sort((a,b)=> b.ts.localeCompare(a.ts));
    for(const m of rows){
      const dt = new Date(m.ts);
      if(dFrom && dt < new Date(dFrom.getFullYear(), dFrom.getMonth(), dFrom.getDate())) continue;
      if(dTo && dt > new Date(dTo.getFullYear(), dTo.getMonth(), dTo.getDate(), 23,59,59)) continue;
      const p = productById(m.productId) || {name:'(eliminado)'};
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${dt.toLocaleString()}</td><td>${p.name}</td><td>${m.from||'—'}</td><td>${m.to||'—'}</td><td>${m.stage||'—'}</td><td class="right">${fmt(m.qty)}</td><td class="muted">${m.notes||''}</td>`;
      tbody.appendChild(tr);
    }
  }

  function renderAll(){
    renderTierInputs();
    renderProducts();
    renderStockSelectors();
    renderMoveSelectors();
    renderFilters();
    renderStock();
    renderMatrix();
    renderHistory();
  }

  // Bind events
  $('#addProduct').onclick = addProduct;
  $('#productSearch').oninput = renderProducts;
  $('#addStock').onclick = addStock;
  $('#recount').onclick = ()=>{ renderStock(); renderMatrix(); alert('Totales recalculados'); };
  $('#fWarehouse').onchange = ()=>{ renderStock(); };
  $('#fStage').onchange = ()=>{ renderStock(); };
  $('#fText').oninput = ()=>{ renderStock(); };
  $('#btnClearFilters').onclick = ()=>{ $('#fWarehouse').value=''; $('#fStage').value=''; $('#fText').value=''; renderStock(); };
  $('#btnClearDates').onclick = ()=>{ $('#hFrom').value=''; $('#hTo').value=''; renderHistory(); };
  $('#btnExportCSV').onclick = exportCSV;
  $('#btnBackup').onclick = backupJSON;
  $('#restoreFile').onchange = (e)=> e.target.files[0] && restoreJSON(e.target.files[0]);

  const off = shared.on((_snap)=>{ renderAll(); });

  if(!shared.state.productos.length){
    shared.set({ productos: [
      {id:'p1', name:'Pet-Nat Rosado 2024', sku:'AN-PN24', prices:{'Distribuidor':100,'Centro de Consumo':130,'Nuevo Distribuidor':95,'Nuevo Centro de Consumo':125}},
      {id:'p2', name:'Espumoso Tradicional 2023', sku:'AN-ET23', prices:{'Distribuidor':120,'Centro de Consumo':160,'Nuevo Distribuidor':118,'Nuevo Centro de Consumo':158}},
      {id:'p3', name:'Tinto Natural 2022', sku:'AN-TN22', prices:{'Distribuidor':90,'Centro de Consumo':120,'Nuevo Distribuidor':88,'Nuevo Centro de Consumo':118}},
    ]});
  }

  renderAll();
  return { unmount(){ off(); } };
}
