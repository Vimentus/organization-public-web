/* =========================================================
   Vimentus — interactions
   - Navbar (scroll state, mega menus, mobile menu)
   - Parallax scrolling (data-parallax="speed")
   - Section reveal animations (data-reveal / data-split)
   - Counters, scroll progress
   ========================================================= */
(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Phones / touch tablets: the "lite" engine ----------
     Same effects, drawn only with things a phone's graphics chip moves for free: solid
     shapes and ready-made layers, changed by transform / opacity. No cropping, no full-screen
     redrawing. CSS: "LITE" (last block). */
  const root = document.documentElement;
  const liteQuery = window.matchMedia("(max-width: 900px), (hover: none) and (pointer: coarse)");
  const stackQuery = window.matchMedia("(max-width: 900px)"); // the one-column layouts
  const lite = liteQuery.matches && !reduceMotion;
  const stacked = lite && stackQuery.matches;
  root.classList.toggle("is-lite", lite);
  let reloadTimer = 0;
  for (const q of [liteQuery, stackQuery]) q.addEventListener("change", () => { // e.g. a tablet turned on its side
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => { if (!reduceMotion && (liteQuery.matches !== lite || (lite && stackQuery.matches !== stacked))) location.reload(); }, 400);
  });

  // only touch the DOM when a value really changes
  function setVar(el, name, v) {
    const c = el._vars || (el._vars = {});
    v = String(v);
    if (c[name] !== v) { c[name] = v; el.style.setProperty(name, v); }
  }
  function setStyle(el, prop, v) {
    const c = el._styles || (el._styles = {});
    if (c[prop] !== v) { c[prop] = v; el.style[prop] = v; }
  }

  // The height of 100vh. NOT window.innerHeight: on phones that changes every time the
  // address bar slides in or out, which made every scroll effect jump.
  const vhProbe = document.createElement("div");
  vhProbe.style.cssText = "position:absolute;left:0;top:0;width:0;height:100vh;visibility:hidden;pointer-events:none";
  document.body.appendChild(vhProbe);
  let VH = vhProbe.offsetHeight || window.innerHeight;

  // where the sections are on the page: measured once, not on every frame
  const geo = new Map();
  let pageY = window.scrollY;
  function remeasure() { geo.clear(); VH = vhProbe.offsetHeight || window.innerHeight; }
  function rectOf(el) {
    let g = geo.get(el);
    if (!g) { const r = el.getBoundingClientRect(); g = { top: r.top + window.scrollY, height: r.height }; geo.set(el, g); }
    const top = g.top - pageY;
    return { top, height: g.height, bottom: top + g.height };
  }
  function cached(key, measure) { // any other measurement that only changes with the screen size
    let g = geo.get(key);
    if (!g) { g = measure(); geo.set(key, g); }
    return g;
  }
  window.addEventListener("resize", remeasure);
  window.addEventListener("load", remeasure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(remeasure);
  if ("ResizeObserver" in window) new ResizeObserver(remeasure).observe(document.body);
  const isDesktop = () => window.matchMedia("(min-width: 1081px)").matches;

  /* ---------- Navbar ---------- */
  const nav = document.getElementById("nav");
  const toggle = document.getElementById("navToggle");
  const megaItems = document.querySelectorAll(".has-mega");

  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("is-menu-open");
    toggle.setAttribute("aria-expanded", open);
    document.body.style.overflow = open ? "hidden" : "";
  });

  megaItems.forEach((item) => {
    const btn = item.querySelector(".nav__link");
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const willOpen = !item.classList.contains("is-open");
      megaItems.forEach((i) => {
        i.classList.remove("is-open");
        i.querySelector(".nav__link").setAttribute("aria-expanded", "false");
      });
      if (willOpen) {
        item.classList.add("is-open");
        btn.setAttribute("aria-expanded", "true");
      }
    });
  });

  const closeMenus = () => megaItems.forEach((i) => i.classList.remove("is-open"));
  document.addEventListener("click", (e) => { if (isDesktop() && !nav.contains(e.target)) closeMenus(); });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    closeMenus();
    nav.classList.remove("is-menu-open");
    document.body.style.overflow = "";
  });
  // Close mobile menu after following a link
  nav.querySelectorAll(".nav__menu a").forEach((a) =>
    a.addEventListener("click", () => {
      nav.classList.remove("is-menu-open");
      document.body.style.overflow = "";
    })
  );

  /* ---------- Split headlines into animated words ---------- */
  document.querySelectorAll("[data-split]").forEach((el) => {
    let i = 0;
    const frag = document.createDocumentFragment();
    const wrap = (node) => {
      const word = document.createElement("span");
      word.className = "word";
      const inner = document.createElement("span");
      setVar(inner, "--i", i++);
      inner.appendChild(node);
      word.appendChild(inner);
      return word;
    };
    [...el.childNodes].forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        node.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) frag.appendChild(document.createTextNode(" "));
          else frag.appendChild(wrap(document.createTextNode(part)));
        });
      } else {
        frag.appendChild(wrap(node.cloneNode(true)));
      }
    });
    el.innerHTML = "";
    el.appendChild(frag);
  });

  /* ---------- Reveal on scroll ---------- */
  document.querySelectorAll("[data-delay]").forEach((el) =>
    setVar(el, "--delay", `${el.dataset.delay}ms`)
  );

  // Clip reveals start fully clipped, which some browsers treat as "never intersecting",
  // so those are checked by position in the animation loop instead (see scrollEffects).
  const clipReveals = [...document.querySelectorAll('[data-reveal^="clip"]')];
  const revealTargets = [...document.querySelectorAll("[data-reveal], [data-split], [data-reveal-group]")]
    .filter((el) => !clipReveals.includes(el));
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        el.classList.add("is-visible");
        // Remove delay after the entrance so hover effects feel instant
        setTimeout(() => setVar(el, "--delay", "0ms"), 1200 + (+el.dataset.delay || 0));
        if (el.querySelector("[data-count]") || el.hasAttribute("data-count")) runCounters(el);
        revealObserver.unobserve(el);
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -60px 0px" }
  );
  revealTargets.forEach((el) => revealObserver.observe(el));

  /* ---------- Counters ---------- */
  function runCounters(scope) {
    const items = scope.hasAttribute("data-count") ? [scope] : scope.querySelectorAll("[data-count]");
    items.forEach((el) => {
      const target = +el.dataset.count;
      const suffix = el.dataset.suffix || "";
      if (reduceMotion) { el.textContent = target + suffix; return; }
      const duration = 1800;
      const start = performance.now();
      const tick = (now) => {
        const p = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 4);
        el.textContent = Math.round(target * eased) + suffix;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  /* ---------- Parallax + scroll progress ---------- */
  const progress = document.querySelector(".scroll-progress");
  const hero = document.querySelector(".hero");
  const parallaxEls = [...document.querySelectorAll("[data-parallax]")];
  let mouseX = 0, mouseY = 0, curX = 0, curY = 0;

  // The frame loop only runs while something can change (scrolling, resizing, the mouse
  // over the hero), then stops after ~1s of quiet. Saves a lot of battery on phones.
  let running = false;
  let quietFrames = 0;
  function wake() {
    quietFrames = 0;
    if (!running) { running = true; requestAnimationFrame(frame); }
  }
  window.addEventListener("scroll", wake, { passive: true });
  window.addEventListener("resize", wake);
  window.addEventListener("load", wake);

  if (hero && !reduceMotion) { // project pages have no .hero
    hero.addEventListener("mousemove", (e) => {
      mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
      wake();
    });
    hero.addEventListener("mouseleave", () => { mouseX = 0; mouseY = 0; wake(); });
  }

  function frame() {
    const vh = VH;
    const scrollY = (pageY = window.scrollY);

    nav.classList.toggle("is-scrolled", scrollY > 20);

    const max = cached("page", () => ({ h: root.scrollHeight })).h - window.innerHeight;
    progress.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`;

    if (!reduceMotion) {
      // Smooth mouse easing for hero depth effect
      curX += (mouseX - curX) * 0.06;
      curY += (mouseY - curY) * 0.06;

      parallaxEls.forEach((el) => {
        if (lite && el.closest(".orbit")) return; // the two small cards: not worth measuring on every frame
        const speed = parseFloat(el.dataset.parallax) || 0;
        // Measure the parent (untransformed) so the effect doesn't feed back on itself
        const r = el.parentElement.getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) return;
        const offset = (r.top + r.height / 2 - vh / 2) * -speed;
        const inHero = !!hero && hero.contains(el);
        const mx = inHero ? curX * speed * 40 : 0;
        const my = inHero ? curY * speed * 40 : 0;
        el.style.transform = `translate3d(${mx}px, ${offset + my}px, 0)`;
      });
    }
    scrollEffects(vh);
    // keep going ~60 frames after the last scroll / mouse move so easing can settle
    if (++quietFrames < 60) requestAnimationFrame(frame);
    else running = false;
  }
  wake();

  /* ---------- Scroll-driven extras (statement, horizontal scroll) ---------- */

  // Statement: wrap every word in <span class="sw">; chips count as one "word"
  const scrubTexts = [...document.querySelectorAll("[data-scrub]")].map((el) => {
    const wrapWords = (node) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(" ")); return; }
            const w = document.createElement("span");
            w.className = "sw";
            w.textContent = part;
            frag.appendChild(w);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === Node.ELEMENT_NODE && !child.classList.contains("statement__chip")) {
          wrapWords(child);
        }
      });
    };
    wrapWords(el);
    el.setAttribute("data-scrub-ready", "");
    const units = [...el.querySelectorAll(".sw, .statement__chip")];
    if (reduceMotion) units.forEach((u) => u.classList.add("is-lit"));
    return { el, units: reduceMotion ? [] : units };
  });

  // Pinned tracks ([data-pin-track], project pages' "The challenge"): tall section whose
  // stage sticks to the screen while its statement fills in. Off with reduced motion.
  const pinTracks = [...document.querySelectorAll("[data-pin-track]")];
  if (!reduceMotion) pinTracks.forEach((t) => t.classList.add("is-animated"));

  /* ---------- Hexagons (the logo's shape: regular, point up). CSS: "HEXAGON" ---------- */
  const COS30 = Math.sqrt(3) / 2; // half the width of a hexagon whose centre-to-point radius is 1
  // smallest radius whose hexagon still contains a point dx, dy away from its centre
  const hexReach = (dx, dy) => Math.max(dx / COS30, dy + dx / (2 * COS30));
  // radius that covers a whole w x h box from the centre x, y (plus 3%, so the edge is well outside)
  const hexCover = (x, y, w, h) => 1.03 * hexReach(Math.max(x, w - x), Math.max(y, h - y));
  // sets the hexagon of some .hex-clip / .hex-rim elements (or of a parent of them)
  function setHex(els, x, y, r) {
    for (const el of els) {
      setVar(el, "--hx", `${x.toFixed(1)}px`);
      setVar(el, "--hy", `${y.toFixed(1)}px`);
      setVar(el, "--hr", r.toFixed(1));
    }
  }

  // Lite shapes. A hexagon is three solid rectangles turned by 60 degrees; a hexagonal HOLE is
  // six solid half-planes around it. Solid boxes cost nothing to move or scale, and stay crisp.
  function hexFill(parent, color, rim) {
    const el = document.createElement("div");
    el.className = "hexfill";
    el.setAttribute("aria-hidden", "true");
    const bars = [];
    for (let k = 0; k < (rim ? 6 : 3); k++) {
      const b = document.createElement("i");
      b.style.background = rim && k < 3 ? rim : color;
      el.appendChild(b);
      bars.push(b);
    }
    parent.appendChild(el);
    return {
      el,
      hide() { setStyle(el, "visibility", "hidden"); },
      set(x, y, r, rimOpacity = 1) { // r = centre to point, px (the rectangles are drawn for 200)
        setStyle(el, "visibility", r > 0.5 ? "visible" : "hidden");
        bars.forEach((b, k) => {
          const isRim = rim && k < 3;
          b.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotate(${(k % 3) * 60}deg) scale(${((isRim ? r + 3 : r) / 200).toFixed(4)})`;
          if (isRim) setStyle(b, "opacity", rimOpacity.toFixed(2));
        });
      },
    };
  }
  function hexHole(parent, color, rim) {
    const el = document.createElement("div");
    el.className = "hexhole";
    el.setAttribute("aria-hidden", "true");
    const bars = [];
    for (let k = 0; k < 12; k++) {
      const b = document.createElement("i");
      b.style.background = k < 6 ? rim : color;
      el.appendChild(b);
      bars.push(b);
    }
    parent.appendChild(el);
    return {
      el,
      hide() { setStyle(el, "visibility", "hidden"); },
      set(x, y, r) {
        setStyle(el, "visibility", "visible");
        bars.forEach((b, k) => {
          b.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotate(${(k % 6) * 60}deg) translateX(${(r * COS30 - (k < 6 ? 3 : 0)).toFixed(1)}px)`;
        });
      },
    };
  }
  const NAVY = "#0a0e17", CYAN = "#22d3ee";

  /* ---------- Iris: pinned statement, words light up, then the hexagon closes ---------- */
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const iris = document.querySelector("[data-iris]");
  if (iris && !reduceMotion) iris.classList.add("is-animated");

  const irisStage = iris && iris.querySelector(".statement__stage");
  // The hand-off starts this far (px) BEFORE the statement unpins, while everything is
  // still standing still: the full-screen navy hexagon is already in place when the page
  // starts moving, so no white can show through for even a frame.
  const handOffLead = () => 0.12 * VH;

  // All distances in px of scrolling; y = how far the section's top has passed the top of the screen
  const irisContent = iris && iris.querySelector(".statement__content"), irisBack = iris && iris.querySelector(".statement__iris");
  function irisTimeline(vh) {
    const r = rectOf(iris);
    const y = -r.top;
    // how long the stage stays pinned (its real height, which on phones isn't innerHeight)
    const pinLength = Math.max(1, r.height - cached("irisStage", () => ({ h: irisStage.offsetHeight })).h);
    // The hexagon is already fully open: it burst out at the end of "What we do".
    // The text rises in while the section is still scrolling into place (y < 0)...
    const enter = clamp01((y + 0.7 * vh) / (0.6 * vh));
    // ...and (with the grid / rings) fades out just before the hand-off starts
    const fade = clamp01((y - (pinLength - handOffLead() - 0.3 * vh)) / (0.3 * vh));
    const words = clamp01((y - 0.1 * vh) / (pinLength - 0.65 * vh));   // lights up once pinned, done before it fades
    return { r, enter, fade, words };
  }

  /* ---------- Iris hand-off: the open hexagon shrinks onto the logo core ---------- */
  const transfer = document.querySelector(".iris-transfer");
  const transferRim = document.querySelector(".iris-transfer__rim");
  const orbit = document.querySelector(".orbit");
  const orbitCore = document.querySelector(".orbit__core");
  const about = document.getElementById("about");
  const easeInOut = (q) => (q < 0.5 ? 4 * q * q * q : 1 - Math.pow(-2 * q + 2, 3) / 2);
  const handOffOn = !!(transfer && orbitCore && iris && about && !reduceMotion);
  if (handOffOn) about.classList.add("about--handoff");
  const transferHex = lite && handOffOn ? hexFill(document.body, NAVY, CYAN) : null;
  if (transferHex) transferHex.el.classList.add("hexfill--fixed");

  function irisHandOff(vh) {
    if (!handOffOn) return;
    // px scrolled since the statement unpinned = since Why Vimentus got stuck to the screen
    // (negative before that). Measured on the section itself, so phones' bars don't matter.
    const a = -rectOf(about).top;
    const q = clamp01(a / (0.8 * vh));                   // hexagon lands after 80% of a screen of scrolling
    const started = a > -handOffLead();                  // starts a little before the unpin (see handOffLead)
    const active = started && q < 1;
    about.classList.toggle("is-shown", started);
    transfer.classList.toggle("is-on", active);
    transferRim.classList.toggle("is-on", active);
    orbit.classList.toggle("is-landing", active);
    if (!active) { if (transferHex) transferHex.hide(); return; }

    const cr = orbitCore.getBoundingClientRect();        // fixed on screen while pinned
    const cx = cr.left + cr.width / 2;
    const cy = cr.top + cr.height / 2;
    const e = easeInOut(q);
    const vw = document.documentElement.clientWidth;
    const coreR = cr.width / 2;
    const fullR = hexCover(cx, cy, vw, vh);
    const radius = coreR + (fullR - coreR) * (1 - e);
    if (transferHex) { transferHex.set(cx, cy, radius, Math.min(1, (1 - e) * 4)); return; }
    setHex([transfer, transferRim], cx, cy, radius);
    // glowing rim: fades in once it's shrinking, fades out as it lands on the core
    transferRim.style.opacity = (Math.min(1, e * 4) * Math.min(1, (1 - e) * 4)).toFixed(3);
  }


  /* ---------- FLOW: Why Vimentus turns into How we work, in the same pinned stage ----------
     a = px scrolled since Why Vimentus pinned (the iris lands over the first 0.8 screens).
     Then:  morph  m 0 → 1 over 1.0 → 1.9 screens: text slides away, the logo grows out of the
                   core as an outline, the planets fly onto the line and become the markers
            steps  s 0 → 3 over 2.3 → 4.1 screens: one step opens at a time. Its facets fill in on
                   the way to it, so they're in place when it's reached (step 4 = whole logo)
            glow   4.25 → 4.8 screens, then a short rest before Our work (4.95)
     CSS ("FLOW") reads the variables and the .is-lit / .is-current / .is-open classes. */
  const flow = handOffOn ? about.querySelector(".flow") : null;
  const flowSteps = flow ? [...flow.querySelectorAll("[data-flow-step]")] : [];
  const flowNodes = flowSteps.map((st) => st.querySelector(".flow__node"));
  const flowLine = flow && flow.querySelector(".flow__line");
  const flowTrack = flow && flow.querySelector(".flow__track");
  const orbitPlanets = orbit ? [...orbit.querySelectorAll(".orbit__planet")] : [];
  const aboutStage = about && about.querySelector(".about__stage");
  const flowFig = flow && flow.querySelector(".flow__fig");
  const flowFacets = flow ? [...flow.querySelectorAll("[data-piece]")] : [];
  const flowFacetsG = flow && flow.querySelector(".flow__facets");
  const flowCount = flow ? [...flow.querySelectorAll(".flow__count text")] : [];
  // screens of scrolling (after the pin): step 1 is reached at FLOW_START, then one every FLOW_EACH;
  // FLOW_FILL = share of a step's scroll, just before it's reached, in which its facets fill in
  const FLOW_START = 2.3, FLOW_EACH = 0.6, FLOW_FILL = 0.62, FLOW_GLOW = 4.25, FLOW_GLOW_LEN = 0.55;
  // click a step: scroll to where it's open
  flowSteps.forEach((st, i) => st.addEventListener("click", () => {
    const top = about.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top + (FLOW_START + FLOW_EACH * (i + 0.15)) * VH, behavior: "smooth" });
  }));
  let flowing = false;
  let flowOpen = -1, flowOpened = 0; // which step is open, and since when (its height is animated)
  const flowHex = lite && flow ? hexFill(flow, NAVY, CYAN) : null;
  const flowBloom = flow && flow.querySelector(".flow__bloom");
  const flowVars = lite ? flowFig : flow; // the logo's variables: on as small a part of the page as possible
  const morphEls = lite && flow ? {
    text: about.querySelector(".about__text"), head: flow.querySelector(".flow__head"), bodies: [...flow.querySelectorAll(".flow__body")],
  } : null;

  // position of an element's centre (or top-left) in the stage, ignoring transforms
  function inStage(el, centre) {
    let x = centre ? el.offsetWidth / 2 : 0;
    let y = centre ? el.offsetHeight / 2 : 0;
    while (el && el !== aboutStage) { x += el.offsetLeft; y += el.offsetTop; el = el.offsetParent; }
    return { x, y };
  }

  function flowFrame(vh) {
    if (!flow || !flowNodes.length) return;
    const ar = rectOf(about);
    if (ar.top > vh * 1.5 || ar.bottom < vh * 0.9) return; // not on screen yet / already covered by Our work: nothing to draw
    const a = -ar.top;
    const m = clamp01((a - 1.0 * vh) / (0.9 * vh));
    const N = flowSteps.length;
    const reach = (a / vh - FLOW_START) / FLOW_EACH;      // i = step i + 1 is reached; below 0 = on the way to the first
    const s = Math.min(N - 1, Math.max(0, reach));
    if (!lite) setVar(about, "--m", m.toFixed(4));
    else {
      setStyle(morphEls.text, "opacity", clamp01(1 - m * 2.5).toFixed(3));
      setStyle(orbit, "opacity", clamp01(1 - m * 2).toFixed(3));
      setStyle(orbit, "transform", m > 0 ? `scale(${(1 - m * 0.35).toFixed(4)})` : "");
      const h = clamp01((m - 0.45) * 2.5), b = clamp01((m - 0.65) * 3.2).toFixed(3);
      setStyle(morphEls.head, "opacity", h.toFixed(3));
      setStyle(morphEls.head, "transform", h < 1 ? `translate3d(0, ${((1 - h) * 30).toFixed(1)}px, 0)` : "none");
      morphEls.bodies.forEach((el) => setStyle(el, "opacity", b));
    }
    const on = m > 0;
    if (on !== flowing) {
      flowing = on;
      about.classList.toggle("is-flowing", on);
      if (!on && flowHex) { flowHex.hide(); setStyle(flowBloom, "opacity", "0"); }
      if (!on) flowNodes.forEach((n) => { setStyle(n, "transform", ""); setVar(n, "--t", "1"); });
    }
    if (!on) return;

    // 0. the bloom: the navy logo core grows until the whole stage is dark
    // (lite: measured once per screen size; the steps' places again only while one is opening)
    const keep = lite ? cached : (_, f) => f();
    const sr = keep("flowStage", () => { const q = aboutStage.getBoundingClientRect(); return { left: q.left, top: 0, width: q.width, height: q.height }; });
    if (!lite) sr.top = aboutStage.getBoundingClientRect().top;
    const core = keep("flowCore", () => ({ ...inStage(orbitCore, true), w: orbitCore.offsetWidth, h: orbitCore.offsetHeight }));
    const coreR = (core.w / 2) * (1 - m * 0.35); // the orbit shrinks a little meanwhile
    const fullR = hexCover(core.x, core.y, sr.width, sr.height);
    const bl = easeInOut(clamp01(m / 0.45));
    const br = coreR + (fullR - coreR) * bl;
    if (lite) {
      if (bl < 1) flowHex.set(core.x, core.y, br, clamp01((1 - bl) * 4)); else flowHex.hide();
      setStyle(flowBloom, "opacity", clamp01((bl - 0.8) / 0.2).toFixed(3));
    } else {
      setVar(flow, "--bl", bl.toFixed(4));
      setHex([flow], core.x, core.y, br);
    }

    // the logo: its outline grows from the core to its place; the steps fill it in
    const fc = keep("flowFig", () => ({ ...inStage(flowFig, true), h: flowFig.offsetHeight }));
    const grow = easeInOut(clamp01(m / 0.7));
    const placed = easeInOut(clamp01((m - 0.25) / 0.5));
    const small = (core.h * 0.64) / (fc.h * 0.7975); // the logo: 64% of the core, 79.75% of the figure
    const scale = small + (1 - small) * grow;
    flowFig.style.transform = `translate(${((core.x - fc.x) * (1 - grow)).toFixed(1)}px, ${((core.y - fc.y) * (1 - grow)).toFixed(1)}px) scale(${scale.toFixed(4)})`;
    if (!lite || m < 0.75 || !flowFig._gw) { flowFig._gw = m >= 0.7; setVar(flowVars, "--gw", ((1.6 * 2440) / fc.h / scale).toFixed(lite ? 0 : 2)); } // the outline stays 1.6px thick
    const fill = (i) => easeInOut(clamp01((reach - i) / FLOW_FILL + 1)); // done exactly when step i is reached
    flowFacets.forEach((f) => setVar(f, "--p", fill(Number(f.dataset.piece)).toFixed(3)));
    setVar(flowVars, "--fg", placed.toFixed(3));
    setVar(flowVars, "--prog", (flowSteps.reduce((sum, _, i) => sum + fill(i), 0) / N).toFixed(4));
    // whole logo: it lights up
    const gl = clamp01((a / vh - FLOW_GLOW) / FLOW_GLOW_LEN);
    setVar(flowVars, "--glow", easeInOut(clamp01(gl / 0.7)).toFixed(3));
    setVar(flowVars, "--flash", Math.sin(Math.PI * gl).toFixed(3));
    setVar(flowVars, "--wave", clamp01((gl - 0.2) / 0.8).toFixed(3));

    // 1. nodes fly from their planet (live, still orbiting) to their place on the line
    const fly = easeInOut(clamp01((m - 0.25) / 0.7));
    if (lite && performance.now() - flowOpened > 900 && !geo.has("flowSettled")) { geo.delete("flowCentres"); geo.delete("flowTrack"); geo.set("flowSettled", true); }
    const live = lite && performance.now() - flowOpened <= 900;
    if (live) { geo.delete("flowCentres"); geo.delete("flowTrack"); geo.delete("flowSettled"); }
    const centres = keep("flowCentres", () => flowNodes.map((n) => inStage(n, true)));
    const planetRects = fly < 1 ? orbitPlanets.map((p) => p.getBoundingClientRect()) : []; // all reads before any write
    flowNodes.forEach((n, i) => {
      const planet = orbitPlanets[Number(n.dataset.from)] || orbitPlanets[i];
      if (!planet) return;
      if (fly >= 1) { // landed: nothing to measure any more
        setStyle(n, "transform", "translate(0px, 0px)");
        setVar(n, "--t", "1");
        return;
      }
      const pr = planetRects[orbitPlanets.indexOf(planet)];
      const dx = (pr.left + pr.width / 2 - sr.left - centres[i].x) * (1 - fly);
      const dy = (pr.top + pr.height / 2 - sr.top - centres[i].y) * (1 - fly);
      setStyle(n, "transform", `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`);
      setVar(n, "--t", clamp01((fly - 0.35) / 0.4).toFixed(3)); // planet icon → step icon mid-flight
    });

    // 2. the line from the first to the last node
    const first = centres[0], last = centres[N - 1];
    const t0 = keep("flowTrack", () => inStage(flowTrack, false));
    const len = Math.max(1, last.y - first.y);
    setStyle(flowLine, "left", `${first.x - t0.x - 1}px`); setStyle(flowLine, "top", `${first.y - t0.y}px`);
    setStyle(flowLine, "width", "2px"); setStyle(flowLine, "height", `${len}px`);
    setVar(flowLine, "--draw", clamp01((m - 0.55) / 0.45).toFixed(3));

    // 3. the beam runs node to node; each step lights and opens as it's reached
    const frac = centres.map((c) => (c.y - first.y) / len);
    const lit = reach >= 0 ? Math.min(N, Math.floor(s) + 1) : 0;
    const k = Math.min(N - 1, Math.floor(s));
    const beam = lit ? frac[k] + (frac[Math.min(k + 1, N - 1)] - frac[k]) * (s - k) : 0;
    setVar(flowLine, "--beam", clamp01(beam).toFixed(4));
    const open = Math.max(0, lit - 1); // the first step is already open while everything flies in
    if (open !== flowOpen) { flowOpen = open; flowOpened = performance.now(); }
    flowCount.forEach((t, i) => t.classList.toggle("is-on", i === open));
    flowSteps.forEach((st, i) => {
      st.classList.toggle("is-lit", i < lit);
      st.classList.toggle("is-current", i === lit - 1);
      st.classList.toggle("is-open", i === open);
    });
  }

  /* ---------- Opening: the hero closes into a hexagon that lands on What we do's tiles ---------- */
  const open = document.querySelector("[data-open]");
  const openScene = open && open.querySelector(".open__scene");
  const openRim = open && open.querySelector(".open__rim");
  const openFades = open ? [...open.querySelectorAll(".vhero__inner, .trust")] : [];
  const openOn = !!(open && document.querySelector("[data-svc]") && !reduceMotion);
  if (openOn) open.classList.add("is-animated");
  const openStage = open && open.querySelector(".open__stage");
  const openHole = lite && openOn ? hexHole(openStage, "#fff", CYAN) : null;
  let heroPaused = false;

  function openFrame(vh) {
    if (!openOn) return;
    const y = -rectOf(open).top;
    const gone = y >= vh;
    open.classList.toggle("is-gone", gone);
    if (gone) { if (lite) { openHole.hide(); setStyle(openStage, "opacity", "0"); } return; }
    const q = clamp01((y - 0.06 * vh) / (0.86 * vh));         // the crop, over 0.06 → 0.92 screens
    if (!lite) open.classList.toggle("is-cropping", q > 0);
    else if (heroPaused !== q > 0.12) { // the video needn't play while it's being closed
      heroPaused = q > 0.12;
      window.dispatchEvent(new CustomEvent(heroPaused ? "hero:pause" : "hero:play"));
    }
    const fade = (1 - clamp01(q / 0.4)).toFixed(3);           // the text goes first
    openFades.forEach((el) => { setStyle(el, "opacity", fade); setStyle(el, "pointerEvents", q > 0.3 ? "none" : ""); });
    // dissolves into the stacked tiles once they're underneath (from 0.8, see svcFrame)
    if (lite) {
      if (q <= 0) { openHole.hide(); setStyle(openStage, "opacity", "1"); return; }
    } else {
      openScene.style.opacity = openRim.style.opacity = "";
      if (q <= 0) { openRim.style.opacity = "0"; return; }
    }
    const { W, H } = cached("openScene", () => ({ W: openScene.clientWidth, H: openScene.offsetHeight }));
    const t = svcTile(vh);
    const e = easeInOut(q);
    const cx = W / 2 + (t.x - W / 2) * e, cy = H / 2 + (t.y - H / 2) * e;
    const full = hexCover(W / 2, H / 2, W, H);
    const out = 1 - clamp01((y / vh - 0.88) / 0.12);
    if (lite) {
      openHole.set(cx, cy, full + (t.r - full) * e);
      setStyle(openStage, "opacity", out.toFixed(3));
      return;
    }
    setHex([openScene, openRim], cx, cy, full + (t.r - full) * e);
    openScene.style.opacity = out.toFixed(3);
    openRim.style.opacity = (Math.min(1, e * 5) * out).toFixed(3);
  }

  function scrollEffects(vh) {
    openFrame(vh);
    irisHandOff(vh);
    flowFrame(vh);

    // Clip reveals: show once the element's top is inside the viewport
    for (let i = clipReveals.length - 1; i >= 0; i--) {
      const el = clipReveals[i];
      if (el.getBoundingClientRect().top < vh * 0.9) {
        el.classList.add("is-visible");
        setTimeout(() => setVar(el, "--delay", "0ms"), 1400 + (+el.dataset.delay || 0));
        clipReveals.splice(i, 1);
      }
    }

    // Iris: content visibility
    let irisWords = null;
    if (iris && !reduceMotion) {
      const t = irisTimeline(vh);
      if (t.r.bottom > -vh && t.r.top < vh * 2) {
        if (lite) {
          setStyle(irisContent, "opacity", (t.enter * (1 - t.fade)).toFixed(3));
          setStyle(irisBack, "opacity", Math.min(t.enter, 1 - t.fade).toFixed(3));
        } else {
        setVar(iris, "--c", (t.enter * (1 - t.fade)).toFixed(3));
        setVar(iris, "--deco", Math.min(t.enter, 1 - t.fade).toFixed(3)); // grid + rings come and go with the text
        }
      }
      irisWords = t.words;
    }

    // Statement: light up words in reading order
    scrubTexts.forEach(({ el, units }) => {
      const r = el.getBoundingClientRect();
      if (r.bottom < -vh || r.top > vh * 2) return;
      let p;
      const track = el.closest("[data-pin-track]");
      if (irisWords !== null && iris.contains(el)) {
        p = irisWords; // inside the pinned iris: follows its timeline
      } else if (track && track.classList.contains("is-animated")) {
        // pinned track: fills while the stage is stuck, done at 85% so the full text rests a moment
        const tr = track.getBoundingClientRect();
        p = clamp01(-tr.top / (Math.max(1, tr.height - vh) * 0.85));
        setVar(track, "--fill", p.toFixed(3));
      } else {
        p = clamp01((vh * 0.85 - r.top) / (r.height + vh * 0.4)); // while it scrolls past
      }
      const lit = Math.round(p * units.length);
      units.forEach((u, i) => u.classList.toggle("is-lit", i < lit));
    });

    worksFrame(vh);
    svcFrame(vh);
    sheetsFrame(vh);
  }

  /* ---------- Services panels ("What we do"): pinned, one photo panel opens at a time ----------
     P = screens scrolled into the section; each panel gets an equal share of the pinned
     stretch. CSS ("WHAT WE DO") does the opening, zoom and content stagger. */
  const svc = document.querySelector("[data-svc]");
  const svcPanels = svc ? [...svc.querySelectorAll("[data-svc-panel]")] : [];
  const svcOn = !!(svc && svcPanels.length && !reduceMotion);
  let svcActive = -1;
  const SVC_EXIT = 1.3; // screens of scrolling for the exit into the iris (matches the 130vh in styles.css)
  const SVC_ENTER = openOn && svcOn ? 1.1 : 0; // ...and for the entrance out of the hero's hexagon (110vh)
  if (SVC_ENTER) svc.classList.add("svc--opens");
  if (svcOn) {
    svc.classList.add("is-animated");
    // click (or focus) a closed panel: scroll to the point where it opens
    const goTo = (i) => {
      const top = svc.getBoundingClientRect().top + window.scrollY;
      const share = (svc.offsetHeight - VH * (1 + SVC_EXIT + SVC_ENTER)) / svcPanels.length;
      window.scrollTo({ top: top + SVC_ENTER * VH + share * (i + 0.15), behavior: "smooth" });
    };
    svcPanels.forEach((panel, i) => {
      panel.addEventListener("click", (e) => {
        if (!panel.classList.contains("is-active")) { e.preventDefault(); goTo(i); }
      });
    });
  }

  const svcList = svc && svc.querySelector(".svc__panels");
  const svcIris = svc && svc.querySelector(".svc__iris");
  const svcRim = svc && svc.querySelector(".svc__rim");
  let svcExiting = false;

  // where the stacked tiles sit (stage coordinates = screen while pinned) and their hexagon radius
  function svcTile() {
    return cached("svcTile", () => ({
      x: svcList.offsetLeft + svcList.offsetWidth / 2, y: svcList.offsetTop + svcList.offsetHeight / 2,
      r: Math.min(64, window.innerWidth * 0.14), h: svcList.offsetHeight,
    }));
  }

  /* Lite: on one-column layouts the four cards are a stack. Each slides up over the one before
     it, following the finger (no resizing). The entrance / exit use four small photo hexagons. */
  const svcHead = svc && svc.querySelector(".svc__head");
  const svcBars = svcPanels.map((p) => p.querySelector(".svc__progress i"));
  const svcTiles = [];
  let svcHex = null;
  if (lite && svcOn) {
    const stage = svc.querySelector(".svc__stage");
    const { r: R } = svcTile();
    svcPanels.forEach((p) => {
      const t = document.createElement("div");
      t.className = "svc__tile";
      t.setAttribute("aria-hidden", "true");
      t.style.cssText = `width:${(2 * R * COS30).toFixed(1)}px;height:${2 * R}px;margin:${-R}px 0 0 ${(-R * COS30).toFixed(1)}px;background-image:url("${p.querySelector("img").getAttribute("src")}")`;
      stage.appendChild(t);
      svcTiles.push(t);
    });
    svcHex = hexFill(stage, NAVY, CYAN);
  }
  function svcLite(vh) {
    const r = rectOf(svc);
    if (r.bottom < -vh || r.top > vh * 1.5) return;
    if (SVC_ENTER) svc.classList.toggle("is-in", r.top <= 1);
    const n = svcPanels.length;
    const enterLen = SVC_ENTER * vh, exitLen = SVC_EXIT * vh;
    const share = Math.max(1, r.height - vh - exitLen - enterLen) / n;
    const y = -r.top - enterLen;
    const t = y / share;                                                   // which card, and how far through it
    const Xe = SVC_ENTER ? clamp01((-r.top / vh - 0.2) / (SVC_ENTER - 0.2)) : 1;
    const X = clamp01((y - share * n) / exitLen);
    const entering = Xe < 1;
    const { x: cx, y: cy, r: R, h: LH } = svcTile();

    // the cards
    let active = 0;
    const SVC_BAR = LH < 330 ? 0 : 50; // px of a covered card that stays visible (its name); none on sideways phones
    setVar(svcList, "--bar", `${SVC_BAR}px`);
    const openH = LH - (n - 1) * SVC_BAR;
    svcPanels.forEach((p, i) => {
      const q = i ? easeInOut(clamp01((t - (i - 0.42)) / 0.42)) : 1;       // how far it has come up over the last one
      if (q > 0.5) active = i;
      if (stacked) {
        const from = openH + (i - 1) * SVC_BAR, to = i * SVC_BAR;
        setStyle(p, "transform", `translate3d(0, ${(i ? from + (to - from) * q : 0).toFixed(1)}px, 0)`);
      }
      setStyle(svcBars[i], "transform", `scaleX(${clamp01(t - i).toFixed(3)})`);
    });
    if (!stacked) active = Math.min(n - 1, Math.max(0, Math.floor(t)));
    if (active !== svcActive) {
      svcActive = active;
      svcPanels.forEach((p, i) => p.classList.toggle("is-active", i === active));
    }

    // heading + cards come and go
    const show = entering ? easeInOut(clamp01((Xe - 0.4) / 0.55)) : 1 - clamp01(X / 0.2);
    setStyle(svcList, "opacity", show.toFixed(3));
    setStyle(svcList, "transform", entering ? `translate3d(0, ${((1 - show) * 46).toFixed(1)}px, 0)` : "translate3d(0, 0, 0)");
    setStyle(svcList, "pointerEvents", show > 0.6 ? "" : "none");
    setStyle(svcHead, "opacity", (entering ? clamp01((Xe - 0.5) / 0.4) : 1 - clamp01(X / 0.16)).toFixed(3));

    // photo hexagons: out of one, and back into one
    const spread = entering ? easeInOut(clamp01(Xe / 0.5)) : 1 - easeInOut(clamp01((X - 0.2) / 0.34));
    const seen = entering ? 1 - clamp01((Xe - 0.46) / 0.24) : clamp01((X - 0.05) / 0.14) * (X > 0.97 ? 0 : 1);
    const gap = Math.min(R * 2.12, LH / 4.1);
    svcTiles.forEach((el, i) => {
      setStyle(el, "visibility", seen > 0.004 ? "visible" : "hidden");
      if (seen <= 0.004) return;
      setStyle(el, "opacity", seen.toFixed(3));
      setStyle(el, "transform", `translate3d(${cx.toFixed(1)}px, ${(cy + (i - 1.5) * gap * spread).toFixed(1)}px, 0) scale(${(entering ? 1 + (1 - seen) * 0.2 : 1).toFixed(3)})`);
    });
    const xd = easeInOut(clamp01((X - 0.52) / 0.4));
    if (xd > 0) svcHex.set(cx, cy, xd * 1.27 * Math.max(window.innerWidth, vh), clamp01((1 - xd) * 4)); else svcHex.hide();
  }

  function svcFrame(vh) {
    if (!svcOn) return;
    if (lite) { svcLite(vh); return; }
    const r = rectOf(svc);
    if (r.bottom < -vh || r.top > vh * 1.5) return;
    if (SVC_ENTER) svc.classList.toggle("is-in", r.top <= 1);
    // entrance: after a short hold under the hero's hexagon, the tiles slide apart, then open into the panels
    const Xe = SVC_ENTER ? clamp01((-r.top / vh - 0.2) / (SVC_ENTER - 0.2)) : 1;
    const entering = Xe < 1;
    const exitLen = SVC_EXIT * vh;                                         // the exit's share of the scroll
    const enterLen = SVC_ENTER * vh;
    const share = Math.max(1, r.height - vh - exitLen - enterLen) / svcPanels.length; // px of scrolling per panel
    const y = -r.top - enterLen;
    const active = Math.min(svcPanels.length - 1, Math.max(0, Math.floor(y / share)));
    if (active !== svcActive) {
      svcActive = active;
      svcPanels.forEach((p, i) => p.classList.toggle("is-active", i === active));
    }
    svcPanels.forEach((p, i) => setVar(p, "--f", clamp01((y - i * share) / share).toFixed(3)));

    // ---- Exit into "Our mission": hexagon tiles → slide straight together into one → iris opens out of it
    const X = clamp01((y - share * svcPanels.length) / exitLen);
    // (the entrance plays the first two backwards)
    const xa = entering ? 1 - clamp01((Xe - 0.45) / 0.55) : clamp01(X / 0.27);                  // heading fades, panels crop to hexagons
    const xb = entering ? 1 - easeInOut(clamp01(Xe / 0.65)) : easeInOut(clamp01((X - 0.2) / 0.36)); // tiles slide straight to the centre and join into one
    const xd = easeInOut(clamp01((X - 0.52) / 0.4));     // the iris opens out of the joined tile
    setVar(svc, "--xa", xa.toFixed(3));
    const exiting = X > 0 || entering;
    if (exiting !== svcExiting) {
      svcExiting = exiting;
      svc.classList.toggle("is-exiting", exiting);
      if (!exiting) svcPanels.forEach((p) => { p.style.transform = ""; p.style.clipPath = ""; });
    }
    if (!exiting) return;

    // centre of the panel area, in the stage's coordinates (offsets ignore transforms)
    const { x: cx, y: cy, r: orbR } = svcTile();
    const vw = window.innerWidth;
    svcPanels.forEach((p) => {
      const w = p.offsetWidth, h = p.offsetHeight;
      const pcx = p.offsetLeft + w / 2;
      const pcy = p.offsetTop + h / 2;
      const tx = (cx - pcx) * xb;
      const ty = (cy - pcy) * xb;
      const big = hexReach(w / 2, h / 2);
      const r0 = Math.min(orbR, (w / 2 - 1) / COS30, h / 2 - 1); // always fits inside its panel: never cut flat
      const rad = big + (r0 - big) * xa;
      p.style.transform = `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px)`;
      const hw = (rad * COS30).toFixed(1), hh = (rad / 2).toFixed(1), hr = rad.toFixed(1);
      p.style.clipPath = `polygon(50% calc(50% - ${hr}px), calc(50% + ${hw}px) calc(50% - ${hh}px), calc(50% + ${hw}px) calc(50% + ${hh}px), 50% calc(50% + ${hr}px), calc(50% - ${hw}px) calc(50% + ${hh}px), calc(50% - ${hw}px) calc(50% - ${hh}px))`;
    });
    setVar(svcRim, "--d", xd.toFixed(4));
    // 1.27 x the longer side covers the screen well before the end, wherever the centre is
    setHex([svcIris, svcRim], cx, cy, xd * 1.27 * Math.max(vw, vh));
  }

  /* ---------- Sheets (service pages): the white sheet rolls up over the photo,
     narrow with rounded top corners at first, full width when it reaches the top ---------- */
  const sheets = reduceMotion ? [] : [...document.querySelectorAll("[data-sheet]")];
  function sheetsFrame(vh) {
    if (!sheets.length || lite) return;
    const small = window.innerWidth <= 760;
    const maxInset = small ? 14 : Math.min(160, window.innerWidth * 0.12);
    const maxR = small ? 20 : 32;
    sheets.forEach((el) => {
      const p = clamp01(1 - el.getBoundingClientRect().top / vh); // 0 at the bottom of the screen, 1 at the top
      const open = clamp01(p / 0.85);
      setVar(el, "--inset", `${((1 - open) * maxInset).toFixed(1)}px`);
      setVar(el, "--r", `${((1 - open) * maxR).toFixed(1)}px`);
    });
  }

  /* ---------- Works: Our work → Testimonials → CTA, one pinned scene ----------
     P = screens scrolled into the section:
       0    – 1.1   the flight through How we work's finished logo
       1.1  – 5.05  the heading, then the projects: each comes closer, rests, passes by
       5.05 – 5.95  the light at the end grows (testimonials)
       6.0  – 8.2   quotes (0.55 each)       8.3  – 9.2   their cyan hexagon grows (CTA)
     CSS ("OUR WORK" / "END SCENE"). While scrolling only transforms and opacity change. */
  const works = document.querySelector("[data-works]");
  const wprojs = works ? [...works.querySelectorAll("[data-wproj]")] : [];
  const worksOn = !!(works && wprojs.length && !reduceMotion);
  const wq = (sel) => works && works.querySelector(sel);
  const worksStage = wq(".works__stage"), worksPlanes = wq(".works__planes"), worksIntro = wq(".works__intro");
  const worksBg = wq(".works__bg"), worksFly = wq(".works__fly"), flyG = wq(".works__fly g");
  const tunnelG = wq(".works__tunnel g"), tunnelRings = works ? [...works.querySelectorAll(".works__tunnel polygon")] : [];
  const worksTabs = wq(".works__tabs"), wtabs = works ? [...works.querySelectorAll(".works__tab")] : [];
  const worksLight = wq(".works__light"), worksGlow = wq(".works__glow");
  const endLayer = wq(".end"), endInner = wq(".end__inner"), endFig = wq(".end__fig");
  const endRing = wq(".end__fig .flow__ring--on"), endFace = wq(".end__face");
  const endCta = wq(".end__cta"), ctaRim = wq(".works__rim--cta"), ctaContent = wq(".end__cta-content");
  const tcards = works ? [...works.querySelectorAll("[data-tcard]")] : [];
  const tpeople = works ? [...works.querySelectorAll(".end__person")] : [];
  const tfaces = works ? [...works.querySelectorAll(".end__face text")] : [];
  const wplanes = works ? [worksIntro, ...wprojs].map((el) => ({ el, text: el.querySelector(".wplane__text"), state: "" })) : [];
  const W_FLY = 1.1, W_EACH = 0.85, W_REST = 0.55;  // W_REST = share of each stop spent standing still
  const W_LIGHT = 5.05, W_QUOTES = 6.0, W_QUOTE = 0.55, W_CTA = 8.3, W_GROW = 0.9;
  let wCur = -2, tCur = -1, wEnd = true, wShown = false;
  if (worksOn) {
    works.classList.add("is-animated");
    document.body.classList.add("works-end"); // footer follows with no gap
    const goTo = (P) => window.scrollTo({ top: works.getBoundingClientRect().top + window.scrollY + P * VH, behavior: "smooth" });
    wtabs.forEach((b, i) => b.addEventListener("click", () => goTo(W_FLY + W_EACH * (i + 1 + W_REST / 2))));
    tpeople.forEach((b, i) => b.addEventListener("click", () => goTo(W_QUOTES + W_QUOTE * (i + 0.5))));
    // the logo to fly through: a copy of How we work's facets
    if (flow) flow.querySelectorAll(".flow__facets polygon").forEach((p) => {
      const c = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
      c.setAttribute("points", p.getAttribute("points"));
      c.setAttribute("fill", p.getAttribute("fill"));
      flyG.appendChild(c);
    });
  }

  // lite: the logo is one ready-made layer, the tunnel five, the CTA's hexagon solid boxes
  const FLY_W = 800, FLY_UNIT = FLY_W / 1686; // the logo's drawing is 1686 x 1946 units
  const liteRings = [];
  let ctaHex = null;
  if (lite && worksOn) {
    worksFly.setAttribute("viewBox", "-843 -973 1686 1946");
    worksFly.style.width = `${FLY_W}px`;
    worksFly.style.height = `${(FLY_W * 1946) / 1686}px`;
    for (let i = 0; i < 5; i++) {
      const d = document.createElement("div");
      d.className = "works__liteRing";
      d.innerHTML = '<svg viewBox="-102 -102 204 204" aria-hidden="true"><polygon points="0,-100 86.6,-50 86.6,50 0,100 -86.6,50 -86.6,-50"/></svg>';
      worksBg.after(d);
      liteRings.push(d);
    }
    ctaHex = hexFill(worksStage, CYAN);
    ctaHex.el.classList.add("hexfill--cta");
  }
  const endMain = wq(".end__main");
  const worksSize = () => cached("worksStage", () => ({ W: worksStage.clientWidth, H: worksStage.clientHeight }));

  function worksFrame(vh) {
    if (!worksOn) return;
    const r = rectOf(works);
    const P = -r.top / vh;
    works.classList.toggle("is-shown", P > 0);
    if (P <= 0 && wShown) flightFrame(0, vh, 0); // once, to put the logo / projects away when scrolling back up
    wShown = P > 0;
    if (r.bottom < -vh || r.top > vh * 1.5) return;
    const L = clamp01((P - W_LIGHT) / W_GROW);
    if (P > 0 && L < 1) flightFrame(P, vh, L);
    worksPlanes.classList.toggle("is-past", L >= 1);
    if (P > W_LIGHT - 0.5) endFrame(P, vh, L);
    else if (wEnd) endFrame(W_LIGHT - 0.5, vh, 0); // once, to put it all away when scrolling back up
    wEnd = P > W_LIGHT - 0.5;
  }

  function flightFrame(P, vh, L) {
    const { W, H } = worksSize();
    const N = wprojs.length;

    // 1. through the logo: it glides to the middle while the camera goes into its opening
    const O = clamp01(P / W_FLY);
    if (!lite || worksBg._o !== O) { worksBg._o = O; worksBg.style.opacity = clamp01(O / 0.3).toFixed(3); } // How we work's text goes, its logo stays (the copy)
    const flying = O > 0 && O < 1 && flow && handOffOn;
    // the real logo gives way while the copy still covers it exactly (else it shows as a ghost behind it)
    if (flowFacetsG) setStyle(flowFacetsG, "opacity", (1 - clamp01(O / 0.07)).toFixed(3));
    worksFly.classList.toggle("is-on", !!flying);
    if (flying) {
      const fr = flowFig.getBoundingClientRect();
      const u0 = fr.height / 2440;                       // px per unit of the logo's drawing
      const u1 = (Math.hypot(W, H) / 2) / 230;           // big enough for the opening to clear the whole screen
      const e = easeInOut(clamp01((O - 0.06) / 0.94));
      const u = u0 * Math.pow(u1 / u0, e);               // steady camera speed
      const g = easeInOut(clamp01((O - 0.06) / 0.56));   // sideways glide to the middle
      const oy = -150 * e;                               // aim at the opening, a bit above the logo's centre
      const x = fr.left + fr.width / 2 + (W / 2 - fr.left - fr.width / 2) * g;
      const y = fr.top + fr.height / 2 + (H / 2 - fr.top - fr.height / 2) * g;
      if (lite) {
        const k = u / FLY_UNIT;
        worksFly.style.transform = `translate3d(${(x - (FLY_W / 2) * k).toFixed(1)}px, ${(y - oy * u - ((FLY_W * 1946) / 1686 / 2) * k).toFixed(1)}px, 0) scale(${k.toFixed(4)})`;
      } else
      flyG.setAttribute("transform", `translate(${x.toFixed(1)} ${(y - oy * u).toFixed(1)}) scale(${u.toFixed(4)})`);
      worksFly.style.opacity = (1 - clamp01((O - 0.86) / 0.14)).toFixed(3);
    }

    // 2. where the camera is: s = 0 heading, 1..N projects; it rests at each, then moves on
    const p = (P - W_FLY) / W_EACH;
    let s;
    if (p < 0) s = -1.15 * (1 - easeInOut(clamp01((O - 0.35) / 0.65)));  // the heading comes in through the opening
    else if (p < N) { const k = Math.floor(p); s = k + easeInOut(clamp01((p - k - W_REST) / (1 - W_REST))); }
    else s = N + easeInOut(L) * 0.75;                                     // the last project passes as the light comes
    const cur = Math.round(s) - 1;                                        // -1 = heading

    wplanes.forEach((pl, i) => {
      const d = i - s;                                   // > 0 ahead of the camera, < 0 passed
      let o = d >= 0 ? 1 - clamp01((d - 0.12) / 0.62) : 1 - clamp01(-d / 0.48);
      const seen = (o = i === N && L > 0 ? o * (1 - clamp01(L / 0.42)) : o) > 0.004; // the last one clears the way for the light
      const state = seen ? d.toFixed(3) : "";
      if (state === pl.state) return;
      pl.state = state;
      pl.el.classList.toggle("is-seen", seen);
      if (!seen) { pl.el.classList.remove("is-moving"); return; }
      const rest = Math.abs(d) < 0.001;
      pl.el.classList.toggle("is-moving", !rest);
      pl.el.style.zIndex = String(10 - i);               // nearer planes in front
      pl.el.style.opacity = o.toFixed(3);
      pl.el.style.transform = rest ? "" : `scale(${Math.exp(-1.25 * d).toFixed(4)})`;
      // the caption floats nearer to the camera than the window
      if (pl.text && !lite) pl.text.style.transform = rest ? "" : `translateY(${(-d * 46).toFixed(1)}px) scale(${Math.exp(-0.3 * d).toFixed(4)})`;
    });
    if (cur !== wCur) {
      wCur = cur;
      wprojs.forEach((el, i) => el.classList.toggle("is-current", i === cur));
      wtabs.forEach((b, i) => { b.classList.toggle("is-on", i === cur); b.classList.toggle("is-past", i < cur); });
    }
    const tabs = clamp01((s - 0.45) / 0.4) * (1 - clamp01(L / 0.25));
    setStyle(worksTabs, "opacity", tabs.toFixed(3));
    worksTabs.classList.toggle("is-on", tabs > 0.02);

    // 3. the tunnel: hexagons rush by as fast as the camera moves (and drift while it rests)
    const far = 0.16, near = Math.hypot(W, H) / 100;     // hexagon scale (drawn at radius 100) far away / at the edge of the screen
    const vis = clamp01((O - 0.3) / 0.4) * (1 - clamp01((L - 0.5) / 0.3));
    const travel = s * 0.62 + P * 0.1 + L * 0.5;
    if (lite) {
      liteRings.forEach((ring, i) => {
        const f = (((i / liteRings.length + travel) % 1) + 1) % 1;
        const o = Math.sin(Math.PI * Math.min(1, f * 1.05)) * 0.3 * vis;
        setStyle(ring, "visibility", o > 0.004 ? "visible" : "hidden");
        if (o <= 0.004) return;
        setStyle(ring, "opacity", o.toFixed(3));
        setStyle(ring, "transform", `translate3d(${(W / 2).toFixed(1)}px, ${(H / 2).toFixed(1)}px, 0) scale(${((far * Math.pow(near / far, f)) / 1.5).toFixed(4)})`); // drawn at radius 150
      });
      return;
    }
    tunnelG.setAttribute("transform", `translate(${(W / 2).toFixed(1)} ${(H / 2).toFixed(1)})`);
    tunnelRings.forEach((ring, i) => {
      const f = (((i / tunnelRings.length + travel) % 1) + 1) % 1; // 0 = far, 1 = passing the camera
      ring.setAttribute("transform", `scale(${(far * Math.pow(near / far, f)).toFixed(4)})`);
      ring.style.opacity = (Math.sin(Math.PI * Math.min(1, f * 1.05)) * 0.24 * vis).toFixed(3);
    });
  }

  // position of an element's top-left in the works stage, ignoring transforms
  function inWorksStage(el) {
    let x = 0, y = 0;
    while (el && el !== worksStage) { x += el.offsetLeft; y += el.offsetTop; el = el.offsetParent; }
    return { x, y };
  }

  function endFrame(P, vh, L) {
    const { W, H } = worksSize();

    // the light at the end of the tunnel: a soft glow grows from the vanishing point, then it's the page
    worksGlow.classList.toggle("is-on", L > 0 && L < 1);
    worksLight.classList.toggle("is-on", L > 0.4);
    if (L > 0) {
      worksGlow.style.transform = `scale(${(0.15 + easeInOut(clamp01(L / 0.9)) * 4).toFixed(4)})`;
      worksGlow.style.opacity = clamp01(L / 0.15).toFixed(3);
      worksLight.style.opacity = clamp01((L - 0.5) / 0.35).toFixed(3);
    }

    // testimonials
    const th = clamp01((P - (W_LIGHT + 0.6)) / 0.35);
    const G = clamp01((P - W_CTA) / W_GROW);
    endLayer.classList.toggle("is-shown", th > 0 && G < 1);
    endLayer.classList.toggle("is-on", th > 0.6 && G < 0.1);
    if (th > 0 && G < 1) {
      if (lite) {
        setStyle(endInner, "opacity", th.toFixed(3));
        setStyle(endMain, "transform", th < 1 ? `translate3d(0, ${((1 - th) * 30).toFixed(1)}px, 0)` : "none");
      } else setVar(endInner, "--th", th.toFixed(3));
      const q = Math.max(0, (P - W_QUOTES) / W_QUOTE);
      const t = Math.min(tcards.length - 1, Math.floor(q));
      if (t !== tCur) {
        tCur = t;
        tcards.forEach((c, i) => { c.classList.toggle("is-active", i === t); c.classList.toggle("is-past", i < t); });
        tpeople.forEach((b, i) => { b.classList.toggle("is-on", i === t); b.classList.toggle("is-past", i < t); });
        tfaces.forEach((f, i) => f.classList.toggle("is-on", i === t));
      }
      setVar(endRing, "--prog", clamp01(q / tcards.length).toFixed(4));
      setVar(endFace, "--face", (1 - clamp01((P - (W_CTA - 0.12)) / 0.12)).toFixed(3));
    } else if (tCur !== -1) { // off screen: no quote stays open
      tCur = -1;
      setVar(endInner, "--th", "0");
      tcards.forEach((c) => c.classList.remove("is-active"));
    }

    // CTA: seen through the figure's hexagon, which then grows until it's the whole stage
    endCta.classList.toggle("is-on", th > 0);
    endCta.classList.toggle("is-growing", G > 0);
    ctaRim.classList.toggle("is-on", G > 0 && G < 1);
    if (th <= 0) { if (ctaHex) ctaHex.hide(); return; }
    const { x, y, core } = cached("endFig", () => {
      const f = inWorksStage(endFig);
      return { x: f.x + endFig.offsetWidth / 2, y: f.y + endFig.offsetHeight / 2, core: (endFig.offsetHeight / 2440) * 930 }; // core = the hexagon's radius in the figure
    });
    const g = easeInOut(G);
    if (lite) { // a plain cyan hexagon grows, then the picture and the text fade in on it
      if (G > 0 && G < 1) ctaHex.set(x, y, core + (hexCover(x, y, W, H) - core) * g); else ctaHex.hide();
      setStyle(endCta, "visibility", g > 0.7 ? "visible" : "hidden");
      setStyle(endCta, "opacity", clamp01((g - 0.7) / 0.28).toFixed(3));
      setVar(ctaContent, "--ci", clamp01((g - 0.75) * 4).toFixed(3));
      return;
    }
    endCta.style.opacity = th.toFixed(3);
    setHex([endCta, ctaRim], x, y, core + (hexCover(x, y, W, H) - core) * g);
    ctaRim.style.opacity = Math.min(1, G * 6, (1 - G) * 4).toFixed(3);
    setVar(ctaContent, "--ci", clamp01((g - 0.5) * 2.2).toFixed(3));
  }

  /* ---------- Misc ---------- */
  document.getElementById("year").textContent = new Date().getFullYear();
})();

/* ==========================================================================
   Hero videos ([data-hero-videos] in index.html)
   Real stock clips behind the hero text, crossfading one into the next:
     city at night → storage hardware → code typed in the dark → circuit board work
   Each clip stays on screen for SHOW ms, or its own data-show="…" if it has one.
   Only the first clip loads with the page; each next clip gets its src a few
   seconds before it is needed (data-src → src), so the page doesn't download
   every clip up front. Only the clip on screen plays; the rest are paused.
   Everything pauses while the hero is off screen or the tab is hidden.
   Reduced motion: no switching, the first clip is shown paused.
   ========================================================================== */
(function () {
  "use strict";

  const root = document.querySelector("[data-hero-videos]");
  if (!root) return;
  const clips = Array.from(root.querySelectorAll("video"));
  if (!clips.length) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

  const SHOW = 4000;    // ms a clip stays on screen (default; a clip's data-show overrides it)
  const PRELOAD = 2500; // ms before the switch when the next clip starts loading
  let current = 0, visible = true, timer = 0, preloadTimer = 0;

  const ensureSrc = (v) => {
    if (!v.getAttribute("src") && v.dataset.src) {
      v.src = v.dataset.src;
      v.load();
    }
  };
  const play = (v) => { const p = v.play(); if (p && p.catch) p.catch(() => {}); };

  function schedule() {
    clearTimeout(timer); clearTimeout(preloadTimer);
    if (reduce.matches || !visible || clips.length < 2) return;
    const show = Number(clips[current].dataset.show) || SHOW;
    preloadTimer = setTimeout(() => ensureSrc(clips[(current + 1) % clips.length]), Math.max(0, show - PRELOAD));
    timer = setTimeout(next, show);
  }

  function next() {
    const from = clips[current];
    const to = clips[(current + 1) % clips.length];
    ensureSrc(to);
    const go = () => {
      to.currentTime = 0;
      play(to);
      to.classList.add("is-active");
      from.classList.remove("is-active");
      setTimeout(() => from.pause(), 900); // after the crossfade
      current = clips.indexOf(to);
      schedule();
    };
    // switch as soon as the next clip can play (don't fade into a black frame)
    if (to.readyState >= 3) go();
    else to.addEventListener("canplay", go, { once: true });
  }

  function start() {
    const v = clips[current];
    ensureSrc(v);
    if (reduce.matches) { v.pause(); return; }
    play(v);
    schedule();
  }
  function stop() {
    clearTimeout(timer); clearTimeout(preloadTimer);
    clips.forEach((v) => v.pause());
  }

  start();
  reduce.addEventListener("change", () => (reduce.matches ? stop() : start()));
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : visible && start()));
  window.addEventListener("hero:pause", stop); // lite: while the scroll effect closes the hero
  window.addEventListener("hero:play", () => visible && !document.hidden && start());
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      visible ? start() : stop();
    }).observe(root);
  }
})();
