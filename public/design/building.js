/* The original 96-frame Salus sequence, drawn only while the visitor explores it. */
export function initBuilding() {
  const wrap = document.getElementById("always-here");
  if (!wrap) return;
  const scene = document.getElementById("day-night");
  const canvas = document.getElementById("building-canvas");
  const sectionImage = scene.querySelector(".building-poster");
  const controls = scene.querySelector(".scene-static-controls");
  const buttons = [...controls.querySelectorAll("button")];
  const progressBar = scene.querySelector(".scene-progress i");
  const clock = document.getElementById("scene-time");
  const period = document.getElementById("scene-period");
  const gu = document.documentElement.lang === "gu";
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const phone = matchMedia("(max-width:720px)");
  const lowData = navigator.connection?.saveData || /(^|-)2g$/.test(navigator.connection?.effectiveType || "");
  const ctx = canvas.getContext("2d");
  const directory = "/media/building-sequence/";
  let active = false;
  let manual = false;
  let tick = 0;
  let frame = -1;
  let waiting = false;
  let rendered = -1;
  let epoch = 0;
  let lastClock = -1;
  const bitmaps = new Map();

  function setTime(progress) {
    const minute = Math.round((360 + progress * 1080) / 5) * 5;
    if (minute !== lastClock) {
      const hours = Math.floor(minute / 60) % 24;
      const hhmm = String(hours % 12 || 12).padStart(2,"0") + ":" + String(minute % 60).padStart(2,"0");
      clock.firstChild.nodeValue = hhmm;
      clock.querySelector("small").textContent = hours < 12 ? "AM" : "PM";
      const labels = gu ? ["સવાર","બપોર","સાંજ","રાત"] : ["MORNING","AFTERNOON","EVENING","NIGHT"];
      period.textContent = labels[progress < .31 ? 0 : progress < .63 ? 1 : progress < .84 ? 2 : 3];
      lastClock = minute;
    }
    const night = Math.max(0,Math.min(1,(progress-.47)/.43));
    scene.style.setProperty("--night",night.toFixed(3));
    scene.classList.toggle("is-night",night>.56);
    buttons.forEach((button,i)=>button.setAttribute("aria-pressed",String(i ? progress>.70 : progress<.26)));
    progressBar.style.transform = "scaleX("+progress+")";
  }

  function showBitmap(index) {
    const bitmap = bitmaps.get(index);
    if (!bitmap || index === rendered) return;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
    rendered=index;
    canvas.classList.add("ready");
    canvas.parentElement.classList.add("has-frames");
    bitmaps.delete(index);
    bitmaps.set(index,bitmap);
  }

  async function paintLatest() {
    if (manual || !active || frame < 0) return;
    if (bitmaps.has(frame)) { showBitmap(frame); return; }
    if (waiting) return;
    waiting=true;
    const requestEpoch=epoch;
    const next=frame;
    try {
      const asset=directory+(phone.matches ? "mobile/" : "desktop/")+"frame-"+String(next).padStart(3,"0")+".webp";
      const response=await fetch(asset,{priority:"low"});
      if (!response.ok) throw new Error("Frame unavailable");
      const bitmap=await createImageBitmap(await response.blob());
      if (requestEpoch!==epoch || manual) { bitmap.close(); return; }
      bitmaps.set(next,bitmap);
      if (active) showBitmap(next);
      while (bitmaps.size>7) {
        const oldest=bitmaps.keys().next().value;
        bitmaps.get(oldest).close();
        bitmaps.delete(oldest);
      }
    } catch {
      if (requestEpoch===epoch) configure(true);
    } finally {
      waiting=false;
      if (frame!==next && !manual && active) paintLatest();
    }
  }

  function update() {
    tick=0;
    if (manual || !active) return;
    const offset=parseFloat(getComputedStyle(scene).top)||0;
    const distance=wrap.offsetHeight-scene.offsetHeight;
    const progress=Math.min(1,Math.max(0,(offset-wrap.getBoundingClientRect().top)/Math.max(1,distance)));
    setTime(progress);
    frame=Math.round(progress*95);
    paintLatest();
  }
  function requestUpdate() {
    if (active && !manual && !tick) tick=requestAnimationFrame(update);
  }
  function configure(forceManual=false) {
    epoch++;
    bitmaps.forEach(bitmap=>bitmap.close());
    bitmaps.clear(); frame=-1; rendered=-1;
    manual=forceManual || motion.matches || lowData || !ctx || typeof createImageBitmap!=="function";
    wrap.classList.toggle("is-scroll-scene",!manual);
    canvas.classList.remove("ready");canvas.parentElement.classList.remove("has-frames");
    canvas.width=phone.matches ? 480 : 800;canvas.height=phone.matches ? 657 : 1094;
    controls.hidden=false;
    scene.querySelector(".scene-bottom").hidden=manual;
    sectionImage.src=directory+"poster.webp";
    setTime(0);
    requestUpdate();
  }
  buttons.forEach(button => button.addEventListener("click",()=>{
    const night=button.dataset.day==="night";
    if (manual) {
      sectionImage.src=directory+(night ? "night.webp":"poster.webp");
      setTime(night ? 1 : 0);
    } else {
      const top=scrollY+wrap.getBoundingClientRect().top-(parseFloat(getComputedStyle(scene).top)||0);
      window.scrollTo({top:top+(night ? wrap.offsetHeight-scene.offsetHeight : 0),behavior:"instant"});
      requestUpdate();
    }
  }));
  new IntersectionObserver(entries=>{
    active=entries[0].isIntersecting;
    if (active) requestUpdate();
  },{rootMargin:"160px 0px"}).observe(wrap);
  window.addEventListener("scroll",requestUpdate,{passive:true});
  window.addEventListener("resize",requestUpdate,{passive:true});
  phone.addEventListener("change",()=>configure());
  motion.addEventListener("change",()=>configure());
  configure();
}
