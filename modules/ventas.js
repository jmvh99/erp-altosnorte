// modules/ventas.js — descuenta inventario al guardar remisión (desde bodega seleccionada) + muestra precio por tier
import { store } from './store.js';

function money(n){ return new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(n||0); }
function uid(){ return crypto.randomUUID?.() || Math.random().toString(36).slice(2,9); }
function esc(s){
  return String(s ?? '')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'", '&#39;');
}

export function mount(root, shared){
  if(!Array.isArray(shared.state.clientes)) shared.set({ clientes: [] });
  if(!Array.isArray(shared.state.ventas))   shared.set({ ventas: [] });
  if(!Array.isArray(shared.state.productos))shared.set({ productos: [] });
  if(!Array.isArray(shared.state.priceTiers)) shared.set({ priceTiers: ["Distribuidor","Centro de Consumo","Nuevo Distribuidor","Nuevo Centro de Consumo"] });

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

      <div class="inline" style="margin-top:8px">
        <div style="width:160px">
          <label>Folio</label>
          <input id="vFolio" placeholder="R-0001">
        </div>
        <div style="width:180px">
          <label>Fecha</label>
          <input id="vFecha" type="date">
        </div>
        <div style="width:220px">
          <label>Bodega de salida</label>
          <select id="vBodega"></select>
        </div>
      </div>

      <div class="inline" style="margin:8px 0">
        <button id="addLinea" class="secondary">Agregar línea</button>
      </div>

      <div class="scroll" style="max-height:320px; overflow:auto; border:1px solid var(--border); border-radius:10px">
        <table id="ventaTable" style="width:100%">
          <thead>
            <tr><th>SKU</th><th>Descripción</th><th>U.M.</th><th class="right">Cant.</th><th class="right">Precio</th><th class="right">Subtotal</th><th class="right">Acciones</th></tr>
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

  function precioPorTier(sku, tier){
    const p = shared.state.productos.find(pp=>pp.sku===sku);
    if(!p) return null;
    const map = p.prices || {};
    if(map[tier]!=null) return Number(map[tier]);
    const first = Object.values(map)[0];
    return first!=null ? Number(first) : null;
  }
  function productBySku(sku){ return shared.state.productos.find(pp=>pp.sku===sku); }
  function tierClienteActual(){
    const id=$('#vCliente').value; const c=shared.state.clientes.find(x=>x.id===id);
    return c?.tier || 'Distribuidor';
  }

  function restarInventario(productId, warehouse, qty, notes){
    if(!warehouse) return;
    let remaining = qty;
    const inv = shared.state.inventario.slice();
    const order = (st)=> (shared.state.stages||[]).indexOf(st);
    const rows = inv.filter(r=> r.productId===productId && r.warehouse===warehouse && r.qty>0)
                    .sort((a,b)=> order(a.stage)-order(b.stage));
    for(const row of rows){
      if(remaining<=0) break;
      const take = Math.min(row.qty, remaining);
      row.qty -= take; remaining -= take;
      store.push('movimientos',{ ts:new Date().toISOString(), productId, from: warehouse, to: '(venta)', stage: row.stage, qty: take, notes: notes||'Salida por remisión' });
    }
    if(remaining>0){
      store.push('movimientos',{ ts:new Date().toISOString(), productId, from: warehouse, to: '(venta)', stage: '(ajuste)', qty: remaining, notes: 'Venta con faltante: ajuste' });
    }
    const left = inv.filter(r=> r.qty>0);
    shared.set({ inventario: left });
  }

  function nuevaLinea(){
    return { id: uid(), sku: '', desc: '', um: 'Botella', cant: 1, precio: 0, subtotal: 0 };
  }
  let ventaLineas = [ nuevaLinea() ];

  function refreshVentaClients(){
    const sel=$('#vCliente'); sel.innerHTML='<option value=\"\">— Selecciona —</option>';
    for(const c of shared.state.clientes){
      const o=document.createElement('option'); o.value=c.id; o.textContent=(c.empresa||c.razon||c.rfc||'(sin nombre)') + (c.tier?` — ${c.tier}`:''); sel.appendChild(o);
    }
    if(shared.state.selectedClienteId){ sel.value = shared.state.selectedClienteId; }
  }
  function refreshBodegas(){
    const sel=$('#vBodega'); sel.innerHTML='<option value=\"\">— Selecciona bodega —</option>';
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
        <td><input data-k="um" data-id="${ln.id}" value="${esc(ln.um)}"></td>
        <td class="right"><input data-k="cant" data-id="${ln.id}" type="number" min="1" step="1" value="${ln.cant}" style="width:90px"></td>
        <td class="right"><input data-k="precio" data-id="${ln.id}" type="number" min="0" step="0.01" value="${ln.precio}" style="width:110px"></td>
        <td class="right" data-sub="${ln.id}">${money(ln.subtotal)}</td>
        <td class="right"><button class="sm danger" data-del-linea="${ln.id}">Quitar</button></td>
      `;
      tbody.appendChild(tr);
    }
    const dl = div.querySelector('#skuList') || document.createElement('datalist');
    dl.id = 'skuList'; dl.innerHTML=''; 
    for(const p of shared.state.productos){ const o=document.createElement('option'); o.value=p.sku; o.label=p.name; dl.appendChild(o); }
    div.appendChild(dl);

    tbody.oninput = onLineaInput;
    tbody.onclick = (e)=>{ const id=e.target.getAttribute('data-del-linea'); if(id){ ventaLineas=ventaLineas.filter(x=>x.id!==id); if(!ventaLineas.length) ventaLineas.push(nuevaLinea()); renderVentaTable(); calcVenta(); } };
  }

  function onLineaInput(e){
    const id=e.target.getAttribute('data-id'); const k=e.target.getAttribute('data-k'); if(!id||!k) return;
    let ln=ventaLineas.find(x=>x.id===id); if(!ln) return;
    let v=e.target.value; if(k==='cant'||k==='precio'){ v=Number(v); if(!(v>=0)) v=0; }
    if(k==='sku'){
      const p = productBySku(e.target.value.trim());
      if(p){
        ln.desc=p.name||''; ln.um=p.um||'Botella';
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
    }
    ln[k]= (k==='sku') ? e.target.value.trim() : v;
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

  function buildRemisionHTML(v){
    const c=shared.state.clientes.find(x=>x.id===v.clienteId)||{};
    const rows=v.items.map(i=>`<tr><td>${esc(i.sku)}</td><td>${esc(i.desc)}</td><td style="text-align:center">${esc(i.um)}</td><td style="text-align:right">${i.cant}</td><td style="text-align:right">${money(i.precio)}</td><td style="text-align:right">${money(i.subtotal)}</td></tr>`).join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Remisión ${esc(v.folio)}</title>
      <style>body{font-family:Arial,sans-serif;padding:24px;color:#000} h1{font-size:18px;margin:0 0 8px} table{width:100%;border-collapse:collapse} th,td{border:1px solid #999;padding:6px 8px;font-size:12px} .right{text-align:right} .muted{color:#666}</style>
      </head><body onload="window.print()">
      <h1>Remisión: ${esc(v.folio)}</h1>
      <div class="muted">Fecha: ${esc(v.fecha)}</div>
      <h3>Cliente</h3>
      <div>${esc(c.empresa||c.razon||'')}</div>
      <div>RFC: ${esc(c.rfc||'')}</div>
      <div>Correo: ${esc(c.email||'')} • Tel: ${esc(c.tel||'')}</div>
      <div>Dirección: ${esc(c.dir||'')}</div><br/>
      <table><thead><tr><th>SKU</th><th>Descripción</th><th>U.M.</th><th>Cant.</th><th>Precio</th><th>Subtotal</th></tr></thead><tbody>${rows}</tbody></table><br/>
      <table style="width:320px; margin-left:auto"><tr><td>Subtotal</td><td class="right">${money(v.subtotal)}</td></tr><tr><td>IEPS (26.5%)</td><td class="right">${money(v.ieps)}</td></tr><tr><td>IVA (16%)</td><td class="right">${money(v.iva)}</td></tr><tr><th>Total</th><th class="right">${money(v.total)}</th></tr></table>
      <p><strong>Observaciones:</strong> ${esc(v.obs||'')}</p>
      </body></html>`;
    return html;
  }
  function generarPDF(v){
    const w=window.open('','_blank'); if(!w){ alert('Permite las ventanas emergentes para descargar el PDF'); return; }
    w.document.write(buildRemisionHTML(v)); w.document.close();
  }

  $('#guardarVenta').addEventListener('click', ()=>{
    const clienteId=$('#vCliente').value; if(!clienteId){ alert('Selecciona cliente'); return; }
    const warehouse=$('#vBodega').value; if(!warehouse){ alert('Selecciona la bodega de salida'); return; }
    const lineasValidas = ventaLineas.filter(ln => ln.sku && (Number(ln.cant)||0) > 0);
    if(lineasValidas.length===0){ alert('Agrega al menos 1 producto'); return; }
    const folio=$('#vFolio').value.trim()||('R-'+Date.now()); const fecha=$('#vFecha').value||new Date().toISOString().slice(0,10); const obs=$('#vObs').value.trim();

    let subtotal=0;
    for(const ln of lineasValidas){ subtotal += (Number(ln.cant)||0) * (Number(ln.precio)||0); }
    const ieps=subtotal*0.265; const base=subtotal+ieps; const iva=base*0.16; const total=subtotal+ieps+iva;

    for(const ln of lineasValidas){
      const prod = productBySku(ln.sku);
      if(prod) restarInventario(prod.id, warehouse, Number(ln.cant)||0, `Remisión ${folio}`);
    }

    const items=lineasValidas.map(ln=>({ sku:ln.sku, desc:ln.desc, um:ln.um, cant:Number(ln.cant)||0, precio:Number(ln.precio)||0, subtotal:(Number(ln.cant)||0)*(Number(ln.precio)||0) }));
    const venta={ id:uid(), folio, fecha, clienteId, warehouse, items, subtotal, ieps, iva, total, obs, ts:new Date().toISOString() };
    const ventas = shared.state.ventas.slice(); ventas.push(venta); shared.set({ ventas });
    renderVentasHist(); generarPDF(venta);
    ventaLineas = [nuevaLinea()]; renderVentaTable(); calcVenta();
  });

  $('#btnNuevoCliente').addEventListener('click', ()=>{
    const empresa = prompt('Nombre del cliente / empresa:'); if(!empresa) return;
    const tier = prompt('Tier (Distribuidor, Centro de Consumo, etc):') || 'Distribuidor';
    const rec = {id:uid(), empresa, razon:'', idCliente:'', rfc:'', tel:'', email:'', tier, pago:'Transferencia', dir:''};
    shared.set({ clientes: [...shared.state.clientes, rec] });
    refreshVentaClients(); $('#vCliente').value = rec.id;
    repriceAllByTier();
  });

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
