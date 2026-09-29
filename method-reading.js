'use strict';
window.MethodReading=(()=>{
 const key='aircode.method-reading.v1';
 let rows=[];
 try{const value=JSON.parse(localStorage.getItem(key)||'[]');if(Array.isArray(value))rows=value.filter(r=>r&&typeof r.id==='string'&&Number.isInteger(r.page)&&r.page>0).slice(0,20)}catch{}
 const pageFor=r=>Math.min(r.pages,rows.find(x=>x.id===r.id)?.page||1);
 function remember(r,page){rows=[{id:r.id,page},...rows.filter(x=>x.id!==r.id)].slice(0,20);try{localStorage.setItem(key,JSON.stringify(rows))}catch{}}
 function recent(index){const found=rows.map(x=>index.find(r=>r.id===x.id)).filter(Boolean).slice(0,3);return found.length?`<details class="method-recent"><summary>최근 읽은 시험방법 <small>이 기기에 저장</small></summary><div>${found.map(r=>`<button class="button secondary" data-method="${esc(r.id)}">${esc(r.code)} · ${esc(r.title)} <b>${pageFor(r)}쪽</b></button>`).join('')}</div><button class="button secondary" data-clear-method-history>읽기 기록 지우기</button></details>`:''}
 function refresh(){const host=document.querySelector('#method-recent');if(host&&methodIndex)host.innerHTML=recent(methodIndex)}
 function mount(r){
  const host=document.querySelector('#method-text'),previous=pageFor(r);
  let current=1;
  const jump=page=>{const target=host.querySelector(`[data-text-page="${page}"]`);if(!target)return;target.open=true;current=page;remember(r,page);const input=host.querySelector('[data-jump-kind="text"] input');if(input)input.value=page;target.scrollIntoView({block:'start',behavior:'smooth'});target.querySelector('summary').focus({preventScroll:true})};
  if(previous>1){const button=document.createElement('button');button.className='button secondary method-resume';button.textContent=`읽던 ${previous}쪽 이어보기`;button.onclick=()=>jump(previous);host.querySelector('.text-jump-row').before(button)}
  for(const detail of host.querySelectorAll('.method-page')){let wasOpen=detail.open;detail.addEventListener('toggle',()=>{const opened=detail.open&&!wasOpen;wasOpen=detail.open;if(opened&&host.isConnected&&document.querySelector('#detail').open){current=Number(detail.dataset.textPage);remember(r,current);const input=host.querySelector('[data-jump-kind="text"] input');if(input)input.value=current}})}
  host.addEventListener('submit',e=>{const form=e.target.closest('[data-jump-kind="text"]');if(form&&form.checkValidity()){current=Number(form.querySelector('input').value);remember(r,current)}});
  host.addEventListener('click',e=>{const button=e.target.closest('[data-inline-figure-page]');if(button){current=Number(button.dataset.inlineFigurePage);remember(r,current)}});
  if(!rows.some(x=>x.id===r.id))remember(r,1);
  const copy=document.querySelector('#method-copy');copy.textContent='현재 페이지 링크 복사';copy.onclick=async()=>{const u=new URL('https://todaynit1-sys.github.io/mamo-aircode/');u.hash=`methods?method=${encodeURIComponent(r.id)}&page=${current}`;try{await navigator.clipboard.writeText(u.href);toast(`${current}쪽 링크를 복사했습니다`)}catch{toast('링크 복사를 지원하지 않는 브라우저입니다')}};
  const shared=Number(methodParams.get('page'));methodParams.delete('page');if(Number.isInteger(shared)&&shared>=1&&shared<=r.pages)jump(shared);
 }
 document.addEventListener('click',e=>{if(e.target.closest('[data-clear-method-history]')){rows=[];try{localStorage.removeItem(key)}catch{}refresh();toast('읽기 기록을 지웠습니다')}});
 document.addEventListener('DOMContentLoaded',()=>document.querySelector('#detail').addEventListener('close',refresh));
 return {mount,recent};
})();
