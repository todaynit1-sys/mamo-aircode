'use strict';
// Annex 8's supplied PDF uses 595 × 841 pt pages. Record bounds are in PDF points.
function sourceExcerptMarkup(r){
  if(!Array.isArray(r.bbox)||r.bbox.length!==4)return '';
  return `<section class="source-excerpt" aria-labelledby="excerpt-title"><div class="excerpt-heading"><h3 id="excerpt-title">기준표 바로 보기 <small>별표 8 · ${r.page}쪽</small></h3><button type="button" id="excerpt-zoom" aria-pressed="false" hidden>확대</button></div><p class="excerpt-context">선택한 행을 원문에서 발췌했습니다. 상위 시설 구분과 적용 조건은 위 내용을 함께 확인하세요.</p><div id="excerpt-scroll" tabindex="0" role="region" aria-label="선택한 기준표 행, 확대하면 좌우로 이동할 수 있습니다"><p id="excerpt-status" role="status">기준표를 불러오는 중…</p></div></section>`;
}
function mountSourceExcerpt(r){
  const host=document.querySelector('#excerpt-scroll');if(!host)return;
  const sourceImage=new Image();
  sourceImage.onload=()=>{
    if(!host.isConnected)return;
    const [left,top,right,bottom]=r.bbox;
    const x=Math.max(0,left-3),y=Math.max(0,top-2),w=Math.min(595,right+3)-x,h=Math.min(841,bottom+2)-y;
    const sx=sourceImage.naturalWidth/595,sy=sourceImage.naturalHeight/841;
    const canvas=document.createElement('canvas');canvas.width=Math.ceil(w*sx);canvas.height=Math.ceil(h*sy);
    canvas.getContext('2d').drawImage(sourceImage,x*sx,y*sy,w*sx,h*sy,0,0,canvas.width,canvas.height);
    const image=document.createElement('img');image.src=canvas.toDataURL('image/png');image.width=canvas.width;image.height=canvas.height;
    image.alt=`${r.pollutant} 기준표 해당 행: ${r.conditions.at(-1)||r.facility}, ${r.rawValue} (${r.unit}). 전체 적용 조건은 위 상세 내용을 확인하세요.`;
    host.replaceChildren(image);const zoom=document.querySelector('#excerpt-zoom');zoom.hidden=false;
    zoom.onclick=()=>{const large=host.classList.toggle('enlarged');zoom.setAttribute('aria-pressed',String(large));zoom.textContent=large?'화면에 맞춤':'확대';host.setAttribute('aria-label',large?'확대한 기준표 행. 좌우로 밀어서 확인하세요.':'선택한 기준표 행');};
  };
  sourceImage.onerror=()=>{if(host.isConnected)host.querySelector('#excerpt-status').textContent='기준표 이미지를 불러오지 못했습니다. 아래 근거 원문의 PDF를 이용하세요.';};
  sourceImage.src=r.image;
}
