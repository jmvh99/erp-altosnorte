// Shared state for all modules (simple reactive store with pub/sub)
const LS_KEY = 'erp_anv_modular_state_v1';

function clone(x){ return JSON.parse(JSON.stringify(x)); }

const initialState = {
  clientes: [],       // {id, empresa, razon, rfc, email, tel, tier, pago, dir}
  productos: [],      // {id, sku, name, um}
  inventario: [],     // {id, productId, warehouse, stage, qty, lot}
  ventas: [],         // {id, folio, fecha, clienteId, items[], impuestos{}, total}
};

function load(){
  try{ return {...initialState, ...(JSON.parse(localStorage.getItem(LS_KEY)||'{}'))}; }
  catch{ return clone(initialState); }
}

const state = load();
const listeners = new Set();

function notify(){ const snap = clone(state); listeners.forEach(fn => fn(snap)); }

export const store = {
  get state(){ return state; },
  set(patch){
    Object.assign(state, patch);
    localStorage.setItem(LS_KEY, JSON.stringify(state));
    notify();
  },
  on(fn){ listeners.add(fn); return () => listeners.delete(fn); },
  upsert(collection, record, matchKeys){
    const arr = state[collection]; if(!Array.isArray(arr)) throw new Error('Unknown collection '+collection);
    const idx = arr.findIndex(x => matchKeys.some(k => x[k] && record[k] && x[k]===record[k]));
    if(idx>=0) arr[idx] = {...arr[idx], ...record}; else arr.push(record);
    localStorage.setItem(LS_KEY, JSON.stringify(state)); notify();
  },
  push(collection, record){
    const arr = state[collection]; if(!Array.isArray(arr)) throw new Error('Unknown collection '+collection);
    arr.push(record); localStorage.setItem(LS_KEY, JSON.stringify(state)); notify();
  }
};

// Demo seed for first run
if(!state.clientes.length){
  state.clientes.push({id:crypto.randomUUID?.()||String(Date.now()), empresa:'Rest. La Vid', razon:'La Vid SA de CV', rfc:'VID010101AA1', email:'compras@lavid.mx', tel:'55 1111 1111', tier:'Centro de Consumo', pago:'Transferencia', dir:'CDMX'});
}
if(!state.productos.length){
  state.productos.push({id:'p1', sku:'CAB-750', name:'Cabernet 750ml', um:'Botella'});
  state.productos.push({id:'p2', sku:'MER-750', name:'Merlot 750ml',   um:'Botella'});
}
localStorage.setItem(LS_KEY, JSON.stringify(state));
