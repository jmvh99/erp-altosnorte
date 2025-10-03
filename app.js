// SPA loader: dynamically import modules and share a central store
import { store } from './modules/store.js';

const mountEl = document.getElementById('mount');
const homeEl  = document.getElementById('home');
const tabButtons = document.querySelectorAll('[data-view]');
const btnHome = document.getElementById('btnHome');

let current = null; // current module {unmount()}

const routes = {
  ventas: () => import('./modules/ventas.js'),
  inventario: () => import('./modules/inventario.js'),
  clientes: () => import('./modules/clientes.js'),
};

function setActive(view){
  tabButtons.forEach(b => b.disabled = (b.dataset.view === view));
}

async function navigate(view){
  // show loader
  setActive(view);
  homeEl.classList.remove('active');
  mountEl.innerHTML = '<div class="note">Cargando módulo…</div>';

  // unmount current
  if(current && typeof current.unmount === 'function'){
    try{ current.unmount(); }catch{}
  }

  const mod = await routes[view]();
  mountEl.innerHTML = ''; // clean
  const api = mod.mount(mountEl, store); // render
  current = api || null;
  window.scrollTo({top:0,behavior:'smooth'});
}

tabButtons.forEach(btn => btn.addEventListener('click', () => navigate(btn.dataset.view)));
btnHome.addEventListener('click', () => {
  if(current && typeof current.unmount === 'function'){ try{ current.unmount(); }catch{} }
  current = null;
  setActive(null);
  mountEl.innerHTML = '';
  homeEl.classList.add('active');
});

// Deep-link support: /?view=ventas
const url = new URL(window.location.href);
const initial = url.searchParams.get('view');
if(initial && routes[initial]) navigate(initial);
else homeEl.classList.add('active');

// Expose store for debugging in console
window.__ERP_STORE__ = store;
