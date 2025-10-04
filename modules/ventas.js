// modules/ventas.js — Módulo completo

// ===== Configuración de identidad para el PDF =====
const COMPANY = {
  name:   "ALTOS NORTE VINÍCOLA",
  rfc:    "VSJ200424PH8",
  phone:  "449-890-9949",
  email:  "contacto@altosnortevinicola.mx",
  address:"Porfirio Díaz 43 PA Col. Del Valle C.P. 03100 Benito Juárez, CDMX",
  website:"www.altosnortevinicola.mx",
  origin: "Jalisco - México",
  logo:   "assets/logo-anv.jpg"            // ⚠️ coloca este archivo en esa ruta
};

// ===== Helpers =====
const money = (n)=> new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(Number(n||0));
const uid   = ()=> crypto.randomUUID?.() || Math.random().toString(36).slice(2,9);
const esc   = (s)=> String(s ?? '')
  .replaceAll('&','&amp;').replaceAll('<','&lt;')
  .replaceAll('>','&gt;').replaceAll('"','&quot;')
  .replaceAll("'",'&#39;');

// ===== Componente principal =====
export function mount(root, shared){

  // ---- Estado base requerido ----
  const ensure = (key, def)=> { if(!Array.isArray(shared.state[key])) shared.set({ [key]: def }); };
  ensure('clientes',   []);
  ensure('ventas',     []);
  ensure('productos',  []);
  ensure('inventario', []);
  if(!Array.isArray(shared.state.priceTiers)){
    shared.set({ priceTiers: ["Distribuidor","Centro de Consumo","Nuevo Distribuidor","Nuevo Centro de Consumo"] });
  }
  if(!Array.isArray(shared.state.warehouses)){
    shared.set({ warehouses: ["Bodega en medio","Bodega chica","Bodega externa","Bodega casa","Espacio AN","Oficina"] });
  }
  if(!Array.isArray(shared.state.stages)){
    shared.set({ stages: ["Embotellado","Degollado","Producto terminado"] });
  }

  const push = (key, obj)=> shared.set({ [key]: [...(shared.state[key]||[]), obj] });

  // ---- UI principal ----
  const div = document.createElement('div');
  div.className = 'panel active';
  div.innerHTML = `
    <h2>Ventas</h2>

    <section class="panel">
      <div class="inline">
        <div style="flex:2">
          <label>Cliente</label>
          <select id="vCliente"></select>
        </div>
        <div class="inline right" style="gap:8px">
          <button class="secondary sm" id="btnNuevoCliente">Nuevo cliente</button>
        </div>
      </div>

      <div class="inline" style="margin-top:8px; gap:12px">
        <div style="width:170px">
          <label>Folio</label>
          <input id="vFolio" placeholder="R-0001">
        </div>
        <div style="width:180px">
          <label>Fecha</label>
          <input id="vFecha" type="date">
        </div>
        <div style="width:280px">
          <label>Bodega de salida</label>
          <select id="vBodega"></select>
        </div>
      </div>

      <div class="inline" style="margin:10px 0">
        <button id="addLinea" class="secondary">Agregar línea</button>
      </div>

      <div class="scroll" style="max-height:360px; overflow:auto; border:1px solid var(--border); border-radius:10px">
        <table id="ventaTable" style="width:100%">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Descripción</th>
              <th>U.M.</th>
              <th class="right">Cant.</th>
              <th class="right">Precio</th>
              <th class="right">Subtotal</th>
              <th class="right">Acciones</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>

      <div class="right" style="margin-top:10px">
        <div class="inline"><span class="muted">Subtotal</span><strong id="vSubtotal">$0.00</strong></div>
        <div class="inline"><span class="muted">IEPS (26.5%)</span><strong id="vIEPS">$0.00</strong></div>
        <div class="inline"><span class="muted">IVA (16%)</span><strong id="vIVA">$0.00</strong></div>
        <div class="inline"><span>Total</span><strong id="vTotal">$0.00</strong></div>
      </div>

      <label class="muted" style="margin-top:10px">Observaciones</label>
      <input id="vObs" placeholder="Notas de entrega, referencias, etc.">

      <div class="inline" style="margin-top:10px">
        <button id="guardarVenta">Guardar / Descargar PDF</button>
      </div>
    </section>

    <section class="panel">
      <h3>Histórico de remisiones</h3>
      <div class="scroll" style="max-height:320px">
        <table id="ventasHistTable">
          <thead><tr><th>Folio</th><th>Fecha</th><th>Cliente</th><th class="right">Total</th><th class="right">Acciones</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
    </section>
  `;
  root.appendChild(div);

  const $ = (sel) => div.querySelector(sel);

  // ===== Lógica de precios por tier =====
  function productBySku(sku){ return shared.state.productos.find(pp=>pp.sku===sku); }
  function precioPorTier(sku, tier){
    const p = productBySku(sku);
    if(!p) return null;
    const map = p.prices || {};
    if(map[tier]!=null) return Number(map[tier]);
    const first = Object.values(map)[0];
    return first!=null ? Number(first) : null;
  }
  function tierClienteActual(){
    const id=$('#vCliente').value; const c=shared.state.clientes.find(x=>x.id===id);
    return c?.tier || 'Distribuidor';
  }

  // ===== Inventario: descuento FIFO por etapa =====
  function restarInventario(productId, warehouse, qty, notes){
    if(!warehouse || !(qty>0)) return;
    let remaining = qty;

    // orden por etapas como están en shared.state.stages
    const order = (st)=> (shared.state.stages||[]).indexOf(st);

    // Clonar inventario, consumir y filtrar en cero
    const inv = (shared.state.inventario||[]).map(r=>({...r}));
    const rows = inv
      .filter(r=> r.productId===productId && r.warehouse===warehouse && r.qty>0)
      .sort((a,b)=> order(a.stage)-order(b.stage));

    for(const row of rows){
      if(remaining<=0) break;
      const take = Math.min(row.qty, remaining);
      row.qty -= take;
      remaining -= take;
      // registrar movimiento de salida
      push('movimientos', { ts:new Date().toISOString(), productId, from: warehouse, to: '(venta)', stage: row.stage, qty: take, notes: notes||'Salida por remisión' });
    }

    if(remaining>0){
      // permite negativos lógicos: registra ajuste (opcional)
      push('movimientos', { ts:new Date().toISOString(), productId, from: warehouse, to: '(venta)', stage: '(ajuste)', qty: remaining, notes: 'Venta con faltante: ajuste' });
    }

    // Persistir inventario sin filas 0
    const left = inv.filter(r=> r.qty>0);
    shared.set({ inventario: left });
  }

  // ===== Tabla de venta =====
  const nuevaLinea = ()=> ({ id: uid(), sku: '', desc: '', um: 'Botella', cant: 1, precio: 0, subtotal: 0 });
  let ventaLineas = [ nuevaLinea() ];

  function refreshVentaClients(){
    const sel=$('#vCliente'); sel.innerHTML='<option value="">— Selecciona —</option>';
    for(const c of shared.state.clientes){
      const o=document.createElement('option');
      o.value=c.id;
      o.textContent=(c.empresa||c.razon||c.rfc||'(sin nombre)') + (c.tier?` — ${c.tier}`:'');
      sel.appendChild(o);
    }
    if(shared.state.selectedClienteId){ sel.value = shared.state.selectedClienteId; }
  }
  function refreshBodegas(){
    const sel=$('#vBodega'); sel.innerHTML='<option value="">— Selecciona bodega —</option>';
    for(const w of (shared.state.warehouses||[])){
      const o=document.createElement('option'); o.value=w; o.textContent=w; sel.appendChild(o);
    }
  }

  function renderVentaTable(){
    const tbody=$('#ventaTable tbody'); tbody.innerHTML='';
    for(const ln of ventaLineas){
      const tr=document.createElement('tr');
      tr.innerHTML = `
        <td><input data-k="sku" data-id="${ln.id}" value="${esc(ln.sku)}" list="skuList" placeholder="SKU"></td>
        <td><input data-k="desc" data-id="${ln.id}" value="${esc(ln.desc)}" placeholder="Descripción"></td>
        <td><input data-k="um"  data-id="${ln.id}" value="${esc(ln.um)}"></td>
        <td class="right"><input data-k="cant" data-id="${ln.id}" type="number" min="1" step="1" value="${ln.cant}" style="width:90px"></td>
        <td class="right"><input data-k="precio" data-id="${ln.id}" type="number" min="0" step="0.01" value="${ln.precio}" style="width:110px"></td>
        <td class="right" data-sub="${ln.id}">${money(ln.subtotal)}</td>
        <td class="right"><button class="sm danger" data-del-linea="${ln.id}">Quitar</button></td>
      `;
      tbody.appendChild(tr);
    }
    // datalist para SKUs
    const dl = div.querySelector('#skuList') || document.createElement('datalist');
    dl.id = 'skuList'; dl.innerHTML='';
    for(const p of shared.state.productos){ const o=document.createElement('option'); o.value=p.sku; o.label=p.name; dl.appendChild(o); }
    div.appendChild(dl);

    tbody.oninput = onLineaInput;
    tbody.onclick = (e)=>{
      const id=e.target.getAttribute('data-del-linea');
      if(id){
        ventaLineas=ventaLineas.filter(x=>x.id!==id);
        if(!ventaLineas.length) ventaLineas.push(nuevaLinea());
        renderVentaTable(); calcVenta();
      }
    };
  }

  function onLineaInput(e){
    const id=e.target.getAttribute('data-id'); const k=e.target.getAttribute('data-k'); if(!id||!k) return;
    let ln=ventaLineas.find(x=>x.id===id); if(!ln) return;
    let v=e.target.value; if(k==='cant'||k==='precio'){ v=Number(v); if(!(v>=0)) v=0; }

    if(k==='sku'){
      const p = productBySku(e.target.value.trim());
      if(p){
        ln.desc = p.name || '';
        ln.um   = p.um || 'Botella';
        const pr = precioPorTier(p.sku, tierClienteActual());
        ln.precio = pr!=null ? pr : 0;

        const priceInput = div.querySelector(`input[data-k="precio"][data-id="${ln.id}"]`);
        const descInput  = div.querySelector(`input[data-k="desc"][data-id="${ln.id}"]`);
        const umInput    = div.querySelector(`input[data-k="um"][data-id="${ln.id}"]`);
        if(priceInput) priceInput.value = ln.precio;
        if(descInput)  descInput.value  = ln.desc;
        if(umInput)    umInput.value    = ln.um;
      }else{
        ln.desc=''; ln.precio=0;
      }
      ln.sku = e.target.value.trim();
    }else{
      ln[k] = v;
    }

    ln.subtotal=(Number(ln.cant)||0)*(Number(ln.precio)||0);
    const cell=div.querySelector(`[data-sub="${ln.id}"]`); if(cell) cell.textContent=money(ln.subtotal);
    calcVenta();
  }

  function repriceAllByTier(){
    const tier = tierClienteActual();
    for(const ln of ventaLineas){
      if(!ln.sku) continue;
      const pr = precioPorTier(ln.sku, tier);
      if(pr!=null){
        ln.precio = pr;
        ln.subtotal = (Number(ln.cant)||0) * pr;
        const input = div.querySelector(`input[data-k="precio"][data-id="${ln.id}"]`);
        if(input) input.value = ln.precio;
        const cell = div.querySelector(`[data-sub="${ln.id}"]`);
        if(cell) cell.textContent = money(ln.subtotal);
      }
    }
    calcVenta();
  }

  function calcVenta(){
    let subtotal=0; for(const ln of ventaLineas){ ln.subtotal=(Number(ln.cant)||0)*(Number(ln.precio)||0); subtotal+=ln.subtotal; }
    const ieps=subtotal*0.265; const base=subtotal+ieps; const iva=base*0.16; const total=subtotal+ieps+iva;
    $('#vSubtotal').textContent=money(subtotal); $('#vIEPS').textContent=money(ieps); $('#vIVA').textContent=money(iva); $('#vTotal').textContent=money(total);
    return {subtotal,ieps,iva,total};
  }

  function renderVentasHist(){
    const tbody=$('#ventasHistTable tbody'); tbody.innerHTML='';
    const clientesMap = new Map(shared.state.clientes.map(c=>[c.id,c]));
    const ventas = shared.state.ventas.slice().sort((a,b)=> b.ts.localeCompare(a.ts));
    for(const v of ventas){
      const c=clientesMap.get(v.clienteId);
      const tr=document.createElement('tr');
      tr.innerHTML = `<td>${esc(v.folio)}</td><td>${v.fecha}</td><td>${esc(c?.empresa||c?.razon||'—')}</td><td class="right">${money(v.total)}</td>
        <td class="right">
          <button class="sm" data-pdf="${v.id}">PDF</button>
          <button class="sm danger" data-del="${v.id}">Eliminar</button>
        </td>`;
      tbody.appendChild(tr);
    }
    tbody.onclick=(e)=>{
      const id=e.target.getAttribute('data-del')||e.target.getAttribute('data-pdf'); if(!id) return;
      const act=e.target.getAttribute('data-del')?'del':'pdf';
      const venta = shared.state.ventas.find(x=>x.id===id); if(!venta) return;
      if(act==='del'){
        if(confirm('¿Eliminar remisión?')){
          shared.set({ ventas: shared.state.ventas.filter(x=>x.id!==id) });
          renderVentasHist();
        }
      }else if(act==='pdf'){ generarPDF(venta); }
    };
  }

  // ===== PDF =====
  function buildRemisionHTML(v){
    const c = (shared?.state?.clientes || []).find(x => x.id === v.clienteId) || {};
    const clienteNombre   = c.empresa || c.razon || c.nombre || "";
    const clienteRFC      = c.rfc || "";
    const clientePago     = c.pago || "TRANSFERENCIA ELECTRÓNICA";
    const clienteEmail    = c.email || "";
    const clienteId       = c.idCliente || c.id || "";

    const rows = v.items.map(i => `
      <tr>
        <td>${(i.sku||"").toUpperCase()}</td>
        <td>${(i.desc||"")}</td>
        <td class="cen">${(i.um||"PZS")}</td>
        <td class="der">${(i.cant||0)}</td>
        <td class="der">${money(i.precio||0)}</td>
        <td class="der">${money(i.subtotal||0)}</td>
      </tr>
    `).join("");

    return `<!doctype html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <title>Remisión ${v.folio||""}</title>
      <style>
        body{ font-family:Arial,Helvetica,sans-serif; color:#000; margin:0; padding:24px; }
        .hdr{ display:grid; grid-template-columns: 70px 1fr 220px; gap:14px; align-items:center; }
        .logo{ width:70px; height:70px; object-fit:contain; border-radius:4px; }
        .brand .t1{ font-size:18px; font-weight:700; letter-spacing:2px; }
        .brand .t2{ font-size:11px; letter-spacing:2px; margin-top:2px; }
        .box{ border:1px solid #999; padding:8px 10px; border-radius:6px; font-size:11px; }
        .kv{ display:grid; grid-template-columns: 110px 1fr; gap:4px 6px; font-size:12px; }
        table{ width:100%; border-collapse:collapse; margin-top:16px; }
        thead th{ background:#f3f3f3; border:1px solid #bbb; font-size:12px; padding:6px 8px; text-align:left; }
        tbody td{ border:1px solid #ccc; font-size:12px; padding:6px 8px; }
        td.cen{ text-align:center; } td.der{ text-align:right; }
        .totals{ width:300px; margin-left:auto; margin-top:8px; }
        .totals td{ border:1px solid #bbb; padding:6px 8px; font-size:12px; }
        .obs{ min-height:50px; border:1px dashed #999; padding:6px; margin-top:12px; font-size:12px; }
        .foot{ margin-top:16px; font-size:11px; display:flex; justify-content:space-between; }
        @media print{ body{ padding:0 14mm 14mm 14mm; } }
      </style>
    </head>
    <body onload="window.print()">
      <div class="hdr">
        <img class="logo" src="${COMPANY.logo}" alt="logo">
        <div class="brand">
          <div class="t1">${COMPANY.name}</div>
          <div class="t2">VINÍCOLA</div>
        </div>
        <div class="box">
          <div><b>RFC:</b> ${COMPANY.rfc}</div>
          <div><b>Tel:</b> ${COMPANY.phone}</div>
          <div><b>Email:</b> ${COMPANY.email}</div>
          <div><b>Folio:</b> ${v.folio||""}</div>
          <div><b>Fecha:</b> ${v.fecha||""}</div>
          <div><b>ID Cliente:</b> ${clienteId}</div>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:1.2fr 1fr; gap:12px; margin-top:12px;">
        <section class="box">
          <h3>CLIENTE</h3>
          <div class="kv">
            <div>Nombre:</div><div>${clienteNombre}</div>
            <div>RFC:</div><div>${clienteRFC}</div>
            <div>Pago:</div><div>${clientePago}</div>
            <div>Email:</div><div>${clienteEmail}</div>
            <div>Dirección:</div><div>${c.dir||""}</div>
          </div>
        </section>
        <section class="box">
          <h3>EMPRESA</h3>
          <div class="kv">
            <div>Dirección:</div><div>${COMPANY.address}</div>
            <div>Sitio web:</div><div>${COMPANY.website}</div>
            <div>Origen:</div><div>${COMPANY.origin}</div>
          </div>
        </section>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width:90px;">CÓDIGO</th>
            <th>DESCRIPCIÓN</th>
            <th style="width:60px;">U.M.</th>
            <th style="width:80px;" class="der">CANT.</th>
            <th style="width:100px;" class="der">PRECIO</th>
            <th style="width:100px;" class="der">TOTAL</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="6" class="cen">Sin productos</td></tr>'}</tbody>
      </table>

      <table class="totals">
        <tr><td>Subtotal</td><td class="der">${money(v.subtotal||0)}</td></tr>
        <tr><td>I.E.P.S (26.5%)</td><td class="der">${money(v.ieps||0)}</td></tr>
        <tr><td>I.V.A. (16%)</td><td class="der">${money(v.iva||0)}</td></tr>
        <tr><td><b>Total</b></td><td class="der"><b>${money(v.total||0)}</b></td></tr>
      </table>

      <div class="obs"><b>Observaciones:</b><br>${(v.obs||"").replace(/\\n/g,"<br>")}</div>

      <div class="foot">
        <div>${COMPANY.origin}</div>
        <div>${COMPANY.website}</div>
      </div>
    </body>
    </html>`;
  }

  function generarPDF(v){
    const w=window.open('','_blank');
    if(!w){ alert('Permite las ventanas emergentes para descargar el PDF'); return; }
    w.document.write(buildRemisionHTML(v));
    w.document.close();
  }

  // ===== Guardar venta =====
  $('#guardarVenta').addEventListener('click', ()=>{
    const clienteId=$('#vCliente').value; if(!clienteId){ alert('Selecciona cliente'); return; }
    const warehouse=$('#vBodega').value; if(!warehouse){ alert('Selecciona la bodega de salida'); return; }
    const lineasValidas = ventaLineas.filter(ln => ln.sku && (Number(ln.cant)||0) > 0);
    if(lineasValidas.length===0){ alert('Agrega al menos 1 producto'); return; }

    const folio=$('#vFolio').value.trim()||('R-'+Date.now());
    const fecha=$('#vFecha').value||new Date().toISOString().slice(0,10);
    const obs=$('#vObs').value.trim();

    let subtotal=0;
    for(const ln of lineasValidas){ subtotal += (Number(ln.cant)||0) * (Number(ln.precio)||0); }
    const ieps=subtotal*0.265; const base=subtotal+ieps; const iva=base*0.16; const total=subtotal+ieps+iva;

    // Descontar inventario
    for(const ln of lineasValidas){
      const prod = productBySku(ln.sku);
      if(prod) restarInventario(prod.id, warehouse, Number(ln.cant)||0, `Remisión ${folio}`);
    }

    const items=lineasValidas.map(ln=>({
      sku: ln.sku,
      desc: ln.desc,
      um: ln.um,
      cant: Number(ln.cant)||0,
      precio: Number(ln.precio)||0,
      subtotal: (Number(ln.cant)||0)*(Number(ln.precio)||0)
    }));

    const venta={ id:uid(), folio, fecha, clienteId, warehouse, items, subtotal, ieps, iva, total, obs, ts:new Date().toISOString() };
    push('ventas', venta);

    renderVentasHist();
    generarPDF(venta);

    ventaLineas = [nuevaLinea()];
    renderVentaTable();
    calcVenta();
  });

  // ===== Nuevo cliente rápido =====
  $('#btnNuevoCliente').addEventListener('click', ()=>{
    const empresa = prompt('Nombre del cliente / empresa:'); if(!empresa) return;
    const tier = prompt('Tier (Distribuidor, Centro de Consumo, Nuevo Distribuidor, Nuevo Centro de Consumo):') || 'Distribuidor';
    const rec = {id:uid(), empresa, razon:'', idCliente:'', rfc:'', tel:'', email:'', tier, pago:'Transferencia', dir:''};
    push('clientes', rec);
    refreshVentaClients(); $('#vCliente').value = rec.id;
    repriceAllByTier();
  });

  // ===== Arranque =====
  function setup(){
    refreshVentaClients();
    refreshBodegas();
    renderVentaTable();
    calcVenta();
    renderVentasHist();
  }
  setup();

  const off = shared.on((_snap)=>{
    refreshVentaClients();
    repriceAllByTier();
  });
  $('#vCliente').addEventListener('change', ()=> repriceAllByTier());
  $('#addLinea').addEventListener('click', ()=>{ ventaLineas.push(nuevaLinea()); renderVentaTable(); });

  return { unmount(){ off(); } };
}
