const byId = id => document.getElementById(id);
const root = document.documentElement;
const header = document.querySelector(".site-header");
const main = byId("main");
const reduce = matchMedia("(prefers-reduced-motion: reduce)");
const gu = root.lang === "gu";

/* Both archives share standard tab semantics and a single keyboard model. */
function archiveTabs(selector) {
  const list = document.querySelector(selector);
  const tabs = [...list.querySelectorAll('[role="tab"]')];
  function select(tab, focus=false) {
    tabs.forEach(item => {
      const selected=item===tab;
      item.setAttribute("aria-selected",String(selected));
      item.tabIndex=selected?0:-1;
      const panel=byId(item.getAttribute("aria-controls"));
      panel.hidden=!selected;
    });
    if (focus) tab.focus({preventScroll:true});
    window.dispatchEvent(new Event("salus:layout"));
  }
  tabs.forEach((tab,i)=>{
    tab.addEventListener("click",()=>select(tab));
    tab.addEventListener("keydown",event=>{
      let index;
      if (event.key==="ArrowRight") index=(i+1)%tabs.length;
      else if (event.key==="ArrowLeft") index=(i-1+tabs.length)%tabs.length;
      else if (event.key==="Home") index=0;
      else if (event.key==="End") index=tabs.length-1;
      else return;
      event.preventDefault();select(tabs[index],true);
    });
  });
  return { current:()=>tabs.find(t=>t.getAttribute("aria-selected")==="true").id,
    restore:id=>{ const found=tabs.find(t=>t.id===id); if(found) select(found); } };
}
const honours=archiveTabs(".award-index");
document.querySelectorAll(".inspect-honour").forEach(button=>button.addEventListener("click",()=>button.closest("article").querySelector(".vault-window").click()));
document.querySelector(".tour-open").addEventListener("click",()=>{
  document.querySelector(".gallery-grid > :not([hidden]) a")?.click();
});
const mobileSelect=byId("specialty-select");
const careTabs=[...document.querySelectorAll("[data-care]")];
mobileSelect.addEventListener("change",()=>careTabs.find(tab=>tab.dataset.care===mobileSelect.value)?.click());
new MutationObserver(()=>{
  const active=careTabs.find(tab=>tab.getAttribute("aria-selected")==="true");
  if (active) mobileSelect.value=active.dataset.care;
}).observe(document.querySelector(".care-choices"),{subtree:true,attributes:true,attributeFilter:["aria-selected"]});

const headerLinks=[...document.querySelectorAll("[data-nav-section]")];
const chapterFor={welcome:"always-here",milestones:"always-here","always-here":"always-here",care:"care",doctors:"doctors",purpose:"doctors",facilities:"always-here",technology:"care",inside:"always-here",quality:"always-here",stories:"stories",reviews:"stories",recognition:"recognition",press:"recognition",community:"recognition",insurance:"visit",emergency:"visit",enquire:"visit",faq:"visit",visit:"visit"};
const chapters=[...main.querySelectorAll("section[id]")].filter(s=>chapterFor[s.id]);
const readingLine=header.querySelector(".reading-line i");
let positions=[], length=1, scrollTick=0, measureTick=0, lastChapter="";
function showPosition() {
  scrollTick=0;
  const line=scrollY+header.offsetHeight+Math.min(innerHeight*.22,165);
  const here=positions.filter(p=>p.top<=line).at(-1);
  const current=chapterFor[here?.id||"welcome"];
  if (lastChapter!==current) {
    headerLinks.forEach(a=>{
      if(a.dataset.navSection===current) a.setAttribute("aria-current","location");
      else a.removeAttribute("aria-current");
    });lastChapter=current;
  }
  readingLine.style.transform="scaleX("+Math.min(1,Math.max(0,scrollY/length))+")";
}
function measure() {
  measureTick=0;
  root.style.setProperty("--nav-height",header.offsetHeight+"px");
  positions=chapters.map(el=>({id:el.id,top:el.getBoundingClientRect().top+scrollY}));
  length=Math.max(1,document.documentElement.scrollHeight-innerHeight);
  showPosition();
}
function queueMeasure(){if(!measureTick) measureTick=requestAnimationFrame(measure);}
new ResizeObserver(queueMeasure).observe(main);
new ResizeObserver(queueMeasure).observe(header);
addEventListener("salus:layout",queueMeasure);
addEventListener("scroll",()=>{if(!scrollTick) scrollTick=requestAnimationFrame(showPosition);},{passive:true});
document.fonts.ready.then(queueMeasure);
measure();

function navigate(target, animate, focus) {
  const top=["main","welcome"].includes(target.id) ? 0 : Math.max(0,target.getBoundingClientRect().top+scrollY-header.offsetHeight-8);
  if (focus) {
    if (!target.hasAttribute("tabindex")) target.tabIndex=-1;
    target.focus({preventScroll:true});
  }
  // Long jumps should land promptly during a pitch. Short approaches retain a gentle glide.
  if (animate && !reduce.matches && Math.abs(top-scrollY)>innerHeight*2) {
    const approach=Math.sign(top-scrollY)*Math.min(140,innerHeight*.16);
    scrollTo({top:Math.max(0,top-approach),behavior:"instant"});
  }
  scrollTo({top,behavior:animate&&!reduce.matches?"smooth":"instant"});
}
document.addEventListener("click",event=>{
  const link=event.target.closest("a[href^='#']");
  if (!link || event.defaultPrevented || event.button!==0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
  const target=byId(link.hash.slice(1));
  if (!target) return;
  event.preventDefault();
  if (location.hash!==link.hash) history.pushState(null,"",link.hash);
  navigate(target,true,true);
});
const langLink=document.querySelector(".language-switch");
const languageKey="salus-page-position";
function readSection() {
  if(scrollY<15) return {id:"welcome",fraction:0};
  const start=header.offsetHeight;
  const probe=start+(innerHeight-start)*.42;
  const current=chapters.filter(el=>el.getBoundingClientRect().top<=probe).at(-1) || chapters[0];
  if(scrollY+innerHeight>=document.documentElement.scrollHeight-10) return {id:"salus-footer",fraction:0};
  const rect=current.getBoundingClientRect();
  return {id:current.id,fraction:Math.min(.99,Math.max(0,(start+8-rect.top)/Math.max(rect.height,1)))};
}
langLink.addEventListener("click",()=>{
  const position=readSection();
  langLink.hash=position.id;
  try {
    sessionStorage.setItem(languageKey,JSON.stringify({...position,honour:honours.current(),path:langLink.pathname,time:Date.now()}));
  } catch {}
});
let savedPosition;
try {
  const raw=sessionStorage.getItem(languageKey);
  sessionStorage.removeItem(languageKey);
  if(raw) {
    const saved=JSON.parse(raw);
    if(saved.path===location.pathname && Date.now()-saved.time<120000 && byId(saved.id)) {
      honours.restore(saved.honour);savedPosition=saved;
    }
  }
} catch {}
const initialHash=location.hash;
function arrive() {
  if(!initialHash || initialHash!==location.hash) return;
  if(!savedPosition && performance.getEntriesByType("navigation")[0]?.type==="back_forward") return;
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    if(location.hash!==initialHash) return;
    const target=byId(savedPosition?.id || initialHash.slice(1));
    if(!target) return;
    if(savedPosition && target.id!=="welcome"){
      const rect=target.getBoundingClientRect();
      scrollTo({top:Math.max(0,scrollY+rect.top+rect.height*savedPosition.fraction-header.offsetHeight-8),behavior:"instant"});
    } else navigate(target,false,false);
    if(savedPosition) root.dataset.languageRestored="true";
  }));
}
if(root.dataset.salusReady) arrive();
else document.addEventListener("salus:ready",arrive,{once:true});
const menu=byId("menu-toggle");
new MutationObserver(()=>{menu.setAttribute("aria-label",menu.getAttribute("aria-expanded")==="true" ? (gu?"મેનુ બંધ કરો":"Close navigation") : (gu?"મેનુ ખોલો":"Open navigation"));}).observe(menu,{attributes:true,attributeFilter:["aria-expanded"]});
header.addEventListener("keydown",event=>{if(event.key==="Escape" && menu.getAttribute("aria-expanded")==="true") menu.focus({preventScroll:true});});
const year=new Date().getFullYear()-2017;
const years=document.querySelector(".salus-years");
if(years && year>0) years.firstChild.nodeValue=String(year);

const mapButton=document.querySelector(".map-start");
mapButton.addEventListener("click",()=>{
  const frame=mapButton.parentElement.querySelector("iframe");
  frame.src=frame.dataset.src;frame.hidden=false;mapButton.hidden=true;
  frame.parentElement.classList.add("map-loaded");
  frame.focus({preventScroll:true});
});
const art=document.querySelector(".salus-hero-art");
if(matchMedia("(hover:hover) and (pointer:fine)").matches && !reduce.matches) {
  let move=0;
  art.addEventListener("pointermove",event=>{
    cancelAnimationFrame(move);
    move=requestAnimationFrame(()=>{
      const rect=art.getBoundingClientRect();
      art.style.setProperty("--hero-x",((event.clientX-rect.left)/rect.width-.5)*10+"deg");
      art.style.setProperty("--hero-y",((event.clientY-rect.top)/rect.height-.5)*-8+"deg");
    });
  });
  art.addEventListener("pointerleave",()=>{cancelAnimationFrame(move);art.style.setProperty("--hero-x","0deg");art.style.setProperty("--hero-y","0deg");});
}
const players=[...document.querySelectorAll(".patient-film video")];
const filmVisibility=new IntersectionObserver(entries=>entries.forEach(entry=>{
  if(!entry.isIntersecting && !entry.target.paused && !document.fullscreenElement && document.pictureInPictureElement!==entry.target) entry.target.pause();
}),{threshold:0});
players.forEach(player=>filmVisibility.observe(player));

/* An enquiry may be opened from several places during one visit. Keep written notes and update only the doctor supplied by a profile. */
const form=byId("enquiry-form");
const service=byId("visit-service");
const note=byId("visit-note");
const doctorPrefix=gu?"મારે પરામર્શ વિશે પૂછપરછ કરવી છે: ":"I would like to enquire about a consultation with ";
let previousDoctor=note.value.startsWith(doctorPrefix)?note.value:"";
let previousService=service.value;
function invalidateDraft(){byId("enquiry-result").hidden=true;byId("form-error").textContent="";}
function setDoctor(name){
  let written=note.value;
  if(previousDoctor && written.startsWith(previousDoctor)) written=written.slice(previousDoctor.length).trimStart();
  previousDoctor=name?doctorPrefix+name:"";
  note.value=[previousDoctor,written].filter(Boolean).join("\n");
}
document.querySelectorAll("[data-enquire-service]").forEach(link=>link.addEventListener("click",()=>{
  setDoctor(link.dataset.enquireDoctor || "");
  service.value=link.dataset.enquireService;
  previousService=service.value;
  service.removeAttribute("aria-invalid");
  invalidateDraft();
  document.querySelectorAll("dialog[open]").forEach(dialog=>dialog.close());
}));
service.addEventListener("change",()=>{
  if(previousService!==service.value && previousDoctor) setDoctor("");
  previousService=service.value;
});
form.addEventListener("input",invalidateDraft);
form.addEventListener("change",invalidateDraft);
if(!navigator.connection?.saveData){
  document.querySelectorAll(".award-index [role=tab]").forEach(tab=>{
    const warm=()=>{byId(tab.getAttribute("aria-controls")).querySelector(".honour-object").loading="eager";};
    tab.addEventListener("pointerenter",warm,{once:true});
    tab.addEventListener("focus",warm,{once:true});
  });
}
