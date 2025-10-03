// modules/clientes.js — creación de clientes con selección de Tier
import { store } from './store.js';

export function mount(root, shared){
  // Asegurar estructuras
  if(!Array.isArray(shared.state.clientes)) shared.set({ clientes: [] });
  if(!Array.isArray(shared.state.priceTiers)) shared.set({ priceTiers: ["Distribuidor","Centro de Consumo"] });

  const div = document.createElement('div');
  div.className = 'panel active';
  div.innerHTML = `
    <h2>Clientes</h2>
    <div class="inline" style="flex-wrap:wrap; gap:12px">
      <div style="flex:1;min-width:220px">
        <label>Empresa</label>
        <input id="cEmpresa" placeholder="Nombre comercial" />
      </div>
      <div style="flex:1;min-width:220px">
        <label>Razón social</label>
        <input id="cRazon" placeholder="Razón social (opcional)" />
      </div>
      <div style="width:180px">
        <label>RFC</label>
        <input id="cRFC" placeholder="XAXX010101000" />
      </div>
      <div style="width:220px">
        <label>Email</label>
        <input id="cEmail" placeholder="correo@dominio.com" />
      </div>
      <div style="width:160px">
        <label>Teléfono</label>
        <input id="cTel" placeholder="55 0000 0000" />
      </div>
      <div style="width:220px">
        <label>Dirección</label>
        <input id="cDir" placeholder="Calle, colonia, ciudad" />
      </div>
      <div style="width:220px">
        <label>Tier</label>
        <select id="cTier"></select>
      </div>
      <div style="width:200px">
        <label>Método de pago</label>
        <select id="cPago">
          <option>Transferencia</option>
          <option>Tarjeta</option>
          <option>Efectivo</option>
          <option>Crédito</option>
        </select>
      </div>
      <div style="align-self:end">
        <button id="btnAdd" class="secondary">Guardar</button>
      </div>
    </div>

    <div style="margin-top:14px" class="inline">
      <input id="q" placeholder="Buscar por nombre / RFC / correo…" style="flex:1" />
      <span class="chip" id="countChip">0</span>
      <button id="btnExport" class="secondary">Exportar</button>
      <label class="secondary" style="cursor:pointer">Importar<input id="fileImport" type="file" accept="application/json" style="display:none"></label>
    </div>

    <div style="margin-top:10px">
      <table>
        <thead><tr><th>Empresa</th><th>Tier</th><th>RFC</th><th>Email</th><th class="right">Acciones</th></tr></thead>
        <tbody id="rows"></tbody>
      </table>
    </div>
    <div class="note" id="count"></div>
  `;
  root.appendChild(div);

  const $ = (s) => div.querySelector(s);

  // Rellenar tiers
  function fillTiers(){
    const sel = $('#cTier');
    sel.innerHTML = '';
    for(const t of shared.state.priceTiers){
      const o = document.createElement('option');
      o.textContent = t; o.value = t; sel.appendChild(o);
    }
  }
  fillTiers();

  // Listado
  const rows = div.querySelector('#rows');
  const q = div.querySelector('#q');

  function render(list){
    rows.innerHTML = '';
    const term = (q.value||'').trim().toLowerCase();
    let count = 0;
    for(const c of list){
      const blob = [c.empresa,c.razon,c.email,c.rfc,c.tier].join(' ').toLowerCase();
      if(term && !blob.includes(term)) continue;
      count++;
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${c.empresa||c.razon||'(sin nombre)'}</td>
        <td class="muted">${c.tier||'—'}</td>
        <td class="muted">${c.rfc||''}</td>
        <td class="muted">${c.email||''}</td>
        <td class="right">
          <button data-id="${c.id}" class="secondary" data-act="use">Usar en Ventas</button>
          <button data-id="${c.id}" class="secondary" data-act="del">Eliminar</button>
        </td>`;
      rows.appendChild(tr);
    }
    $('#count').textContent = `${count} cliente${count!==1?'s':''}`;
    $('#countChip').textContent = count;
  }

  // Eventos listado
  rows.addEventListener('click', (e)=>{
    const id = e.target?.getAttribute?.('data-id'); if(!id) return;
    const act = e.target?.getAttribute?.('data-act');
    if(act==='use'){
      // Escribir hint para el módulo Ventas
      shared.set({ selectedClienteId: id });
      alert('Cliente seleccionado para Ventas');
    }else if(act==='del'){
      if(confirm('¿Eliminar cliente?')){
        const next = shared.state.clientes.filter(x=>x.id!==id);
        shared.set({ clientes: next });
        render(shared.state.clientes);
      }
    }
  });

  // Guardar nuevo cliente (con tier)
  $('#btnAdd').addEventListener('click', () => {
    const rec = {
      id: crypto.randomUUID?.()||String(Date.now()),
      empresa: $('#cEmpresa').value.trim(),
      razon: $('#cRazon').value.trim(),
      rfc: $('#cRFC').value.trim(),
      email: $('#cEmail').value.trim(),
      tel: $('#cTel').value.trim(),
      dir: $('#cDir').value.trim(),
      tier: $('#cTier').value,
      pago: $('#cPago').value
    };
    if(!rec.empresa && !rec.razon){ alert('Indica empresa o razón social'); return; }
    store.push('clientes', rec);
    // limpiar
    $('#cEmpresa').value = '';
    $('#cRazon').value = '';
    $('#cRFC').value = '';
    $('#cEmail').value = '';
    $('#cTel').value = '';
    $('#cDir').value = '';
    $('#cTier').value = shared.state.priceTiers[0] || 'Distribuidor';
  });

  // Buscar
  q.addEventListener('input', ()=>render(shared.state.clientes));

  // Exportar/Importar
  $('#btnExport').addEventListener('click', ()=>{
    const blob = new Blob([JSON.stringify(shared.state.clientes, null, 2)], {type:'application/json'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'clientes_erp_anv.json'; a.click(); URL.revokeObjectURL(a.href);
  });
  $('#fileImport').addEventListener('change', async (e)=>{
    const file = e.target.files?.[0]; if(!file) return;
    try{
      const text = await file.text(); const arr = JSON.parse(text);
      if(!Array.isArray(arr)) throw new Error('Formato inválido');
      const current = shared.state.clientes.slice();
      for(const r of arr){
        const rec = { id: r.id || crypto.randomUUID?.()||String(Date.now()), empresa:r.empresa||'', razon:r.razon||'', rfc:r.rfc||'', email:r.email||'', tel:r.tel||'', dir:r.dir||'', tier:r.tier||'Distribuidor', pago:r.pago||'Transferencia' };
        const idx = current.findIndex(x => (x.rfc && rec.rfc && x.rfc===rec.rfc) || (x.email && rec.email && x.email===rec.email));
        if(idx>=0) current[idx] = {...current[idx], ...rec}; else current.push(rec);
      }
      shared.set({ clientes: current }); render(shared.state.clientes); alert('Clientes importados');
    }catch(err){ alert('Error al importar'); }
    e.target.value='';
  });

  // Render inicial y suscripción
  const off = shared.on(snap => render(snap.clientes));
  render(shared.state.clientes);
  $('#cTier').value = shared.state.priceTiers[0] || 'Distribuidor';

  return { unmount(){ off(); } };
}
