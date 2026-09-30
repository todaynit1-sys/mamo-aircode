'use strict';
window.MethodFigures=(()=>{
 let indexPromise=null,generation=0;
 const index=()=>indexPromise||(indexPromise=fetch('method-figures.json?v=24').then(r=>{if(!r.ok)throw Error('index');return r.json()}).catch(e=>{indexPromise=null;throw e}));
 function dispose(){generation++;document.getElementById('figure-dialog')?.close()}
 function zoom(item){
  let dialog=document.getElementById('figure-dialog');
  if(!dialog){dialog=document.createElement('dialog');dialog.id='figure-dialog';dialog.setAttribute('aria-labelledby','figure-dialog-title');document.body.append(dialog)}
  dialog.innerHTML=`<div class="figure-dialog-top"><h2 id="figure-dialog-title">${esc(item.caption)}</h2><button type="button" class="icon-button" data-figure-close aria-label="그림 확대 닫기">${icon('close')}</button></div><div class="figure-dialog-tools"><button type="button" data-figure-fit>화면에 맞춤</button><button type="button" data-figure-large>크게 보기</button><span>확대 후 좌우로 밀어 보세요</span></div><div class="figure-dialog-scroll" tabindex="0" aria-label="그림 확대 화면"><img src="${item.src}" alt="${esc(item.caption)}"></div>`;
  dialog.querySelector('[data-figure-close]').onclick=()=>dialog.close();
  const viewport=dialog.querySelector('.figure-dialog-scroll');
  dialog.querySelector('[data-figure-fit]').onclick=()=>viewport.classList.remove('large');
  dialog.querySelector('[data-figure-large]').onclick=()=>viewport.classList.add('large');
  dialog.showModal();
 }
 function gallery(section,items){
  if(section.dataset.loaded)return;section.dataset.loaded='true';
  section.innerHTML='<div class="inline-figure-heading"><strong>이 페이지의 그림</strong><span>누르면 확대</span></div>';
  items.forEach(item=>{
   const figure=document.createElement('figure');figure.className='inline-method-figure';
   figure.innerHTML=`<button type="button" class="inline-figure-button" aria-label="${esc(item.caption)} 확대"><img width="${item.width}" height="${item.height}" alt="${esc(item.caption)}" decoding="async"></button><figcaption>${esc(item.caption)}</figcaption><p class="figure-load-error" hidden>그림을 불러오지 못했습니다. <button type="button">다시 불러오기</button> 또는 아래 페이지 전체 보기를 이용하세요.</p>`;
   const img=figure.querySelector('img'),error=figure.querySelector('.figure-load-error');
   img.onload=()=>{error.hidden=true;img.hidden=false};img.onerror=()=>{error.hidden=false;img.hidden=true};
   figure.querySelector('.inline-figure-button').onclick=()=>zoom(item);
   error.querySelector('button').onclick=()=>{img.src=item.src+'?retry='+Date.now()};
   img.src=item.src;section.append(figure);
  });
 }
 async function mount(r){
  const token=++generation,host=document.getElementById('method-text');
  try{
   const all=await index();if(token!==generation||!host.isConnected||!document.getElementById('detail').open)return;
   const pages=all.documents[r.id]||{};
   const existing=host.querySelector('.method-figure-index');
   if(existing)existing.remove();
   const entries=Object.entries(pages);
   if(entries.length){
    const nav=document.createElement('details');nav.className='method-figure-index';
    nav.innerHTML=`<summary>그림 있는 페이지 <span>${entries.length}쪽</span></summary><div>${entries.map(([page,items])=>`<button type="button" data-inline-figure-page="${page}"><span>${esc(items.map(x=>x.caption).join(' · '))}</span><small>${page}쪽 →</small></button>`).join('')}</div>`;
    host.querySelector('.method-visual-section').prepend(nav);
   }
   host.querySelectorAll('.method-page').forEach(page=>{
    const items=pages[page.dataset.textPage];if(!items?.length)return;
    page.querySelector('summary').insertAdjacentHTML('beforeend',' <span class="inline-figure-badge">그림</span>');
    const section=document.createElement('section');section.className='page-inline-figures';section.setAttribute('aria-label',page.dataset.textPage+'쪽 그림');page.querySelector('pre').before(section);
    const load=()=>{if(page.open&&token===generation)gallery(section,items)};page.addEventListener('toggle',load);load();
   });
  }catch{
   if(token!==generation||!host.isConnected)return;
   const note=document.createElement('p');note.className='source-help';note.textContent='그림 목록을 불러오지 못했습니다. ';const retry=document.createElement('button');retry.className='button secondary';retry.textContent='그림 다시 불러오기';retry.onclick=()=>{note.remove();mount(r)};note.append(retry);host.prepend(note);
  }
 }
 document.addEventListener('click',e=>{const b=e.target.closest('[data-inline-figure-page]');if(!b)return;const page=document.querySelector(`.method-page[data-text-page="${b.dataset.inlineFigurePage}"]`);if(page){page.open=true;page.scrollIntoView({behavior:'smooth',block:'start'})}});
 document.addEventListener('DOMContentLoaded',()=>document.getElementById('detail').addEventListener('close',dispose));
 return {mount,dispose};
})();
