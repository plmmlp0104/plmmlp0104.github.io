/* ===========================================================
   JH Portfolio — interactions
   Stack: GSAP + ScrollTrigger + SplitText + Lenis
   =========================================================== */

gsap.registerPlugin(ScrollTrigger, SplitText);

// always start at the top on (re)load — don't restore previous scroll position
if ("scrollRestoration" in history) history.scrollRestoration = "manual";
window.scrollTo(0, 0);
window.addEventListener("pageshow", () => {
  window.scrollTo(0, 0);
  if (lenis) lenis.scrollTo(0, { immediate: true });
});

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* -----------------------------------------------------------
   1) Smooth scroll (Lenis) wired into GSAP ticker
----------------------------------------------------------- */
let lenis;
if (!reduceMotion) {
  lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}

/* Anchor links use Lenis for smooth jumps */
document.querySelectorAll("[data-scroll]").forEach((a) => {
  a.addEventListener("click", (e) => {
    const id = a.getAttribute("href");
    if (!id || !id.startsWith("#")) return;
    const target = document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    lenis ? lenis.scrollTo(target, { offset: 0 }) : target.scrollIntoView({ behavior: "smooth" });
  });
});

/* -----------------------------------------------------------
   2) Loader → then play hero intro
----------------------------------------------------------- */
function playHero() {
  const tl = gsap.timeline({ defaults: { ease: "power4.out" } });

  // headline lines rise up
  tl.from(".hero__title .line__inner", {
    yPercent: 110,
    duration: 1.1,
    stagger: 0.09,
  });

  // eyebrow + desc + scroll hint fade up
  tl.to(
    ".hero .reveal-up",
    { opacity: 1, y: 0, duration: 0.9, stagger: 0.12 },
    "-=0.7"
  );
}

// set initial state for reveal-up elements
gsap.set(".reveal-up", { y: 24 });

function runLoader() {
  // ensure we begin at the very top (refresh / back-forward)
  window.scrollTo(0, 0);
  if (lenis) lenis.scrollTo(0, { immediate: true });

  const el = document.getElementById("loaderCount");
  const loader = document.getElementById("loader");
  const counter = { v: 0 };

  if (reduceMotion) {
    loader.style.display = "none";
    gsap.set(".reveal-up", { opacity: 1, y: 0 });
    gsap.set(".hero__title .line__inner", { yPercent: 0 });
    initScrollAnimations();
    return;
  }

  const tl = gsap.timeline();
  tl.to(counter, {
    v: 100,
    duration: 1.4,
    ease: "power2.inOut",
    onUpdate: () => (el.textContent = Math.round(counter.v)),
  })
    .to("#loader", {
      yPercent: -100,
      duration: 0.9,
      ease: "power4.inOut",
    })
    .add(playHero, "-=0.4")
    .add(initScrollAnimations, "<");
}

/* -----------------------------------------------------------
   3) Scroll-triggered animations
----------------------------------------------------------- */
function initScrollAnimations() {
  /* 3a. Word-by-word reveal for [data-split] text */
  document.querySelectorAll("[data-split]").forEach((el) => {
    const split = new SplitText(el, { type: "words" });
    split.words.forEach((w) => w.classList.add("word"));
    gsap.from(split.words, {
      opacity: 0.12,
      duration: 1,
      ease: "power2.out",
      stagger: 0.04,
      scrollTrigger: {
        trigger: el,
        start: "top 80%",
        end: "top 35%",
        scrub: true,
      },
    });
  });

  /* 3b. Big marquee rows — single seamless loop (rebuilt once fonts load) + scroll speed-up */
  const marqueeRefs = [];
  document.querySelectorAll("[data-marquee]").forEach((row) => {
    const dir = parseFloat(row.dataset.dir) || 1;
    const ref = { loop: null };
    if (!row.dataset.phrase) row.dataset.phrase = row.children[0].textContent;
    const build = () => {
      if (ref.loop) ref.loop.kill();
      const phrase = row.dataset.phrase;
      // measure one phrase, then repeat it enough that ONE block is wider than the viewport
      row.innerHTML = `<span>${phrase}</span>`;
      const w = row.children[0].getBoundingClientRect().width || 1;
      const copies = Math.max(2, Math.ceil(window.innerWidth / w) + 1);
      const block = phrase.repeat(copies);
      row.innerHTML = `<span>${block}</span><span>${block}</span>`;
      gsap.set(row, { x: 0 });
      const half = row.scrollWidth / 2 || 1; // one block (≥ viewport → never any gap)
      ref.loop = gsap.to(row, {
        x: dir < 0 ? half : -half,
        duration: 24 * copies, // keep per-word speed constant regardless of copy count
        ease: "none",
        repeat: -1,
        // keep the offset within (-half, 0] for BOTH directions so the viewport is always covered
        modifiers: {
          x: (x) => {
            let v = parseFloat(x) % half;
            if (v > 0) v -= half;
            return v + "px";
          },
        },
      });
    };
    build();
    // recompute after the display font (Anton) loads so the wrap is seamless, and on resize
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(build);
    let rt;
    window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(build, 200); });
    marqueeRefs.push(ref);
  });
  // scrolling briefly speeds the rows up via timeScale (no competing x tween → no stutter)
  if (lenis && marqueeRefs.length) {
    lenis.on("scroll", ({ velocity }) => {
      const ts = 1 + Math.min(Math.abs(velocity) * 0.5, 5);
      marqueeRefs.forEach((r) => r.loop && r.loop.timeScale(ts));
    });
    gsap.ticker.add(() => {
      marqueeRefs.forEach((r) => {
        if (!r.loop) return;
        const ts = r.loop.timeScale();
        if (ts > 1) r.loop.timeScale(Math.max(1, ts - 0.06));
      });
    });
  }

  /* 3a-1. About label reveal */
  if (document.querySelector(".intro__label")) {
    gsap.to(".intro__label", {
      opacity: 1,
      y: 0,
      duration: 0.8,
      ease: "power3.out",
      scrollTrigger: { trigger: ".intro", start: "top 78%" },
    });
  }

  /* 3a-2. About body paragraphs fade up (stagger) */
  if (document.querySelector(".intro__body")) {
    gsap.from(".intro__body p", {
      opacity: 0,
      y: 24,
      duration: 0.9,
      ease: "power3.out",
      stagger: 0.15,
      scrollTrigger: { trigger: ".intro__body", start: "top 82%" },
    });
  }

  /* 3b-2. Skill bars fill on scroll */
  gsap.utils.toArray("[data-skill]").forEach((skill) => {
    const bar = skill.querySelector(".skill__bar i");
    const level = skill.dataset.level || 100;
    if (reduceMotion) {
      gsap.set(bar, { width: level + "%" });
      return;
    }
    gsap.to(bar, {
      width: level + "%",
      duration: 1.2,
      ease: "power3.out",
      scrollTrigger: { trigger: skill, start: "top 88%" },
    });
  });

  /* 3b-3. Education reveal */
  if (document.querySelector(".edu")) {
    gsap.from(".edu__profile, .edu__grid > *, .edu__curri", {
      opacity: 0,
      y: 36,
      duration: 0.9,
      ease: "power3.out",
      stagger: 0.15,
      scrollTrigger: { trigger: ".edu", start: "top 75%" },
    });
  }

  /* 3b-4 + 3c. Work pinned stage (scatter → sharpen+grid → vertical card scroll) */
  setupWork();

  /* 3e. CTA headline reveal */
  gsap.from(".cta__title .line__inner", {
    yPercent: 110,
    duration: 1,
    ease: "power4.out",
    stagger: 0.1,
    scrollTrigger: { trigger: ".cta", start: "top 65%" },
  });
  gsap.to(".cta .reveal-up", {
    opacity: 1,
    y: 0,
    duration: 0.8,
    scrollTrigger: { trigger: ".cta", start: "top 55%" },
  });

  ScrollTrigger.refresh();
}

/* -----------------------------------------------------------
   4) Nav hide/show on scroll direction
----------------------------------------------------------- */
let lastY = 0;
const nav = document.getElementById("nav");
function navOnScroll(y) {
  if (y > lastY && y > 200) {
    gsap.to(nav, { yPercent: -100, duration: 0.4, ease: "power2.out" });
  } else {
    gsap.to(nav, { yPercent: 0, duration: 0.4, ease: "power2.out" });
  }
  lastY = y;
}
if (lenis) lenis.on("scroll", ({ scroll }) => navOnScroll(scroll));
else window.addEventListener("scroll", () => navOnScroll(window.scrollY));

/* -----------------------------------------------------------
   5) Project detail modal
----------------------------------------------------------- */
const PROJECTS = {
  phonecase: {
    title: "한국 in 그래피티",
    cat: "Phone Case Design",
    img: "assets/work/phonecase.jpg",
    meta: ["동서울대 공모전 · 금상", "Illustrator", "Photoshop"],
    desc: [
      "2학년 2학기, 시각디자인 수행평가를 겸해 동서울대학교 폰케이스 디자인 공모전에 참여한 작품입니다.",
      "평소 그래피티에 관심이 많아 부산·서울·제주 등 한국 각 지역의 특색을 그래피티 스타일로 풀어냈습니다. 러프 스케치와 썸네일 스케치를 거쳐 여러 시행착오 끝에 완성했고, 폰케이스부터 키링·그립톡, 목업까지 하나의 시리즈로 전개했습니다.",
      "작업 기간이 가장 길었던 만큼 애착이 큰 작품이며, 공모전에서 금상을 수상했습니다.",
    ],
  },
  character: {
    title: "마법 레시피",
    cat: "Character Design",
    img: "assets/work/character.jpg",
    meta: ["디저트 요정 캐릭터", "Illustrator", "Photoshop"],
    desc: [
      "‘디저트 요정’을 모티프로 한 캐릭터 디자인 프로젝트입니다.",
      "두 요정 캐릭터 ‘레니’와 ‘리노’의 세계관과 성격을 설정하고, 시놉시스를 바탕으로 비주얼을 구체화했습니다.",
      "완성한 캐릭터는 머그컵, 폰케이스, 그립톡 등 다양한 굿즈로 확장해 어플리케이션까지 제안했습니다.",
    ],
  },
  emoticon: {
    title: "점댕이",
    cat: "Character · Emoticon",
    img: "assets/work/emoticon.jpg",
    meta: ["이모티콘 세트", "Illustrator", "Photoshop"],
    desc: [
      "강아지 캐릭터 ‘점댕이’를 활용한 이모티콘 디자인입니다.",
      "1학기에는 시장 조사와 캐릭터 컨셉, 색감 설정을 준비했고, 2학기에 다양한 감정 표현을 담은 최종 이모티콘 세트를 완성했습니다.",
      "여러 차례의 수정과 피드백을 거치며 캐릭터에 대한 애정과 완성도를 함께 키운 작업입니다.",
    ],
  },
  poster: {
    title: "포스터 디자인",
    cat: "Poster · 경진대회",
    img: "assets/work/poster.jpg",
    meta: ["경기도 상업 경진대회 · 2등", "Illustrator", "Photoshop"],
    desc: [
      "3학년 1학기, 경기도 상업 경진대회에 학교 대표로 컴퓨터 그래픽 분야에 참가하며 준비한 포스터 작업입니다.",
      "가야문화축제 등 다양한 주제의 포스터를 제작했습니다. 처음에는 막막했지만 선생님의 지도와 꾸준한 연습으로 완성도를 높였습니다.",
      "약 2개월의 준비 끝에 대회에서 2등을 수상했습니다.",
    ],
  },
  editorial: {
    title: "1팀 1기업",
    cat: "Editorial · Poster",
    img: "assets/work/editorial.jpg",
    meta: ["방학 특강 프로젝트", "Illustrator", "Photoshop"],
    desc: [
      "방학 특강 ‘1팀 1기업’ 프로그램에서 매주 하나씩 디자인 프로젝트를 수행하고 피드백을 받으며 진행한 편집 디자인 모음입니다.",
      "카드뉴스, 책 표지, 포스터 등 다양한 매체의 디자인을 경험했습니다. (예: 분당아람고 독후감 대회 포스터, INFJ 카드뉴스 등)",
      "매주 다른 주제를 빠르게 기획하고 완성하며 실무 감각과 디자인 속도를 함께 길렀습니다.",
    ],
  },
};

// placeholder shapes per project (work photos go here later)
const SHAPES = {
  phonecase: { sc: 1, glyph: "sc-circle" },
  character: { sc: 2, glyph: "sc-tri" },
  emoticon: { sc: 3, glyph: "sc-square" },
  poster: { sc: 4, glyph: "sc-diamond" },
  editorial: { sc: 5, glyph: "sc-blob" },
};

const modal = document.getElementById("modal");
const modalBg = document.getElementById("modalBg");
const modalBgGlyph = document.getElementById("modalBgGlyph");
const modalHeroShape = document.getElementById("modalHeroShape");
const modalBoardShape = document.getElementById("modalBoardShape");
const modalGlyph = document.getElementById("modalGlyph");
const modalGlyph2 = document.getElementById("modalGlyph2");
const modalCat = document.getElementById("modalCat");
const modalTitle = document.getElementById("modalTitle");
const modalMeta = document.getElementById("modalMeta");
const modalDesc = document.getElementById("modalDesc");
const detailScroll = document.getElementById("detailScroll");
const revealEls = modal ? modal.querySelectorAll(".reveal-d") : [];
let modalOpen = false;
let revealObs = null;

function startReveal() {
  // AOS-like: reveal each block as it enters the detail scroll viewport
  revealEls.forEach((el) => el.classList.remove("in"));
  if (reduceMotion) {
    revealEls.forEach((el) => el.classList.add("in"));
    return;
  }
  if (revealObs) revealObs.disconnect();
  revealObs = new IntersectionObserver(
    (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add("in"); }),
    { root: detailScroll, threshold: 0.12 }
  );
  revealEls.forEach((el) => revealObs.observe(el));
}

function openModal(id) {
  const p = PROJECTS[id];
  if (!p || modalOpen) return;
  modalOpen = true;

  const sh = SHAPES[id] || { sc: 1, glyph: "sc-circle" };
  modalHeroShape.className = "detail__shape sc--" + sh.sc;
  modalGlyph.className = "sc-glyph " + sh.glyph;
  modalBoardShape.className = "detail__shape detail__shape--board sc--" + sh.sc;
  modalGlyph2.className = "sc-glyph " + sh.glyph;
  if (modalBg) modalBg.className = "detail__bg sc--" + sh.sc;
  if (modalBgGlyph) modalBgGlyph.className = "sc-glyph " + sh.glyph;
  modalCat.textContent = p.cat;
  modalTitle.textContent = p.title;
  modalMeta.innerHTML = p.meta.map((m) => `<li>${m}</li>`).join("");
  modalDesc.innerHTML = p.desc.map((d) => `<p>${d}</p>`).join("");

  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  if (lenis) lenis.stop();
  document.body.style.overflow = "hidden";
  if (detailScroll) detailScroll.scrollTop = 0;

  if (reduceMotion) {
    gsap.set(modal, { yPercent: 0 });
    startReveal();
    return;
  }
  gsap.timeline({ onComplete: startReveal })
    .set(modal, { yPercent: 100 })
    .to(modal, { yPercent: 0, duration: 0.6, ease: "power3.out" });
}

function closeModal() {
  if (!modalOpen) return;
  modalOpen = false;

  const finish = () => {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    if (lenis) lenis.start();
    document.body.style.overflow = "";
    gsap.set(modal, { clearProps: "transform" });
    if (revealObs) revealObs.disconnect();
    revealEls.forEach((el) => el.classList.remove("in"));
  };

  if (reduceMotion) {
    finish();
    return;
  }
  gsap.to(modal, { yPercent: 100, duration: 0.45, ease: "power3.in", onComplete: finish });
}

document.querySelectorAll("[data-project]").forEach((card) => {
  card.addEventListener("click", () => openModal(card.dataset.project));
});
modal.querySelectorAll("[data-close]").forEach((el) => el.addEventListener("click", closeModal));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});

/* -----------------------------------------------------------
   6) Work pinned stage — scatter → sharpen+grid → vertical card scroll
----------------------------------------------------------- */
function setupWork() {
  const stage = document.getElementById("workstage");
  const cardsWrap = document.getElementById("wsCards");
  const cards = gsap.utils.toArray(".ws__card");
  const scCat = document.getElementById("scCat");
  const scName = document.getElementById("scName");
  const scArrow = document.getElementById("scArrow");
  if (!stage || !cards.length) return;

  const ORDER = cards.map((c) => c.dataset.project);
  let activeId = null;
  const setCaption = (id) => {
    const p = PROJECTS[id];
    if (!p || id === activeId) return;
    activeId = id;
    scCat.textContent = p.cat;
    scName.textContent = p.title;
  };
  setCaption(ORDER[0]);
  if (scArrow) scArrow.addEventListener("click", () => openModal(activeId));

  // ---- Mobile / reduced-motion: simple 2-col grid of cards (no pin) ----
  if (window.innerWidth < 1024 || reduceMotion) {
    stage.classList.add("is-static");
    // cards rise & fade in as they scroll into view (light, mobile-friendly)
    if (!reduceMotion && window.ScrollTrigger) {
      gsap.set(cards, { opacity: 0, y: 42 });
      ScrollTrigger.batch(cards, {
        start: "top 90%",
        onEnter: (els) =>
          gsap.to(els, { opacity: 1, y: 0, duration: 0.6, stagger: 0.1, ease: "power3.out", overwrite: true }),
      });
      ScrollTrigger.refresh();
    }
    return;
  }

  const N = cards.length; // 9
  // big tight 3x3 grid that overflows the viewport (vstory-style — cards fill the screen)
  const cols = [-6.5, 32.5, 71.5]; // vw (left), card 37vw wide, bleeds off edges
  const rows = [-5, 33, 71]; // vh (top), card 36vh tall
  const grid = cards.map((_, i) => ({
    left: cols[i % 3] + "vw",
    top: rows[Math.floor(i / 3)] + "vh",
    width: "37vw",
    height: "36vh",
  }));
  // surrounding cards blur away first (top → sides → corners), keeping center(4) + below(7)
  const FADE_ORDER = [1, 3, 5, 0, 2, 6, 8];
  // then ALL cards flow through a centered vertical stack — center, below, then the rest
  const COL_ORDER = [4, 7, 0, 1, 2, 3, 5, 6, 8];
  const GAP = 80; // vh between stacked cards
  const column = COL_ORDER.map((_, slot) => ({
    left: "47vw", width: "49vw", height: "60vh", top: slot * GAP + 19 + "vh",
  }));
  const endY = -((N - 1) * GAP);
  // initial: 3x3 grid, dim; whole grid tilted in 3D
  cards.forEach((c, i) => gsap.set(c, { ...grid[i], filter: "brightness(0.45)", opacity: 1, rotation: 0, rotationY: 0 }));
  gsap.set(cardsWrap, { rotateX: 16, rotateZ: -6, scale: 1.04, transformOrigin: "50% 50%" });

  const V_START = 0.3; // progress where the centered vertical scroll begins

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: stage,
      start: "top top",
      end: "+=700%",
      pin: true,
      scrub: 1.2,
      onUpdate: (self) => {
        const p = self.progress;
        if (p <= V_START) {
          // grid phase — keep cards flat rectangles (fixes leftover morph when scrolling back up)
          cards.forEach((c) => gsap.set(c, { clipPath: "none", y: 0, rotateX: 0, rotateZ: 0, rotation: 0, rotationY: 0, scale: 1, borderRadius: "24px" }));
          return;
        }
        const vp = (p - V_START) / (1 - V_START);
        const center = vp * (N - 1); // fractional centered slot
        setCaption(ORDER[COL_ORDER[Math.min(N - 1, Math.max(0, Math.round(center)))]]);
        COL_ORDER.forEach((cardIdx, slot) => {
          const d = Math.abs(slot - center);
          const t = Math.min(d, 1);
          // no tilt / morph — centered card just zooms in (enlarge); the ones above & below blur out
          gsap.set(cards[cardIdx], {
            clipPath: "none",
            y: 0, rotateX: 0, rotateZ: 0, rotation: 0, rotationY: 0,
            scale: 1.1 - t * 0.22, // centered card enlarges (~1.1); neighbours shrink (~0.88)
            borderRadius: "24px",
            filter: `blur(${Math.min(d, 1.6) * 10}px)`,
            opacity: Math.max(0, 1 - d * 0.6),
            zIndex: 60 - Math.round(t * 20),
          });
        });
      },
    },
  });

  // phase 1 — grid straightens + cards become vivid + title out
  tl.to(cardsWrap, { rotateX: 0, rotateZ: 0, scale: 1, duration: 0.8, ease: "power2.out" }, 0);
  tl.to(cards, { filter: "brightness(1)", duration: 0.7, ease: "power2.out" }, 0.1);
  tl.to("#wsTitle", { opacity: 0, scale: 0.85, duration: 0.5, ease: "power2.in" }, 0);
  // phase 2 — surrounding cards blur away ONE BY ONE (top → sides → corners), in place
  FADE_ORDER.forEach((idx, k) =>
    tl.to(cards[idx], { filter: "brightness(0.6) blur(16px)", opacity: 0, duration: 0.5, ease: "power2.in" }, 0.9 + k * 0.13)
  );
  // phase 3 — flow into a centered vertical stack (center+below move in; faded ones snap in hidden)
  COL_ORDER.forEach((cardIdx, slot) => {
    if (cardIdx === 4 || cardIdx === 7) {
      tl.to(cards[cardIdx], { ...column[slot], duration: 0.8, ease: "power3.inOut" }, 2.0);
    } else {
      tl.set(cards[cardIdx], { ...column[slot] }, 1.85);
    }
  });
  tl.to("#wsCaption", { opacity: 1, duration: 0.4 }, 2.5);
  // phase 4 — scroll the whole stack: centered card with shaved corners; faded ones reappear below
  tl.to(cardsWrap, { yPercent: endY, duration: 7.0, ease: "none" }, 2.8); // total ≈ 9.8 → V_START ≈ 0.286

  // ---- Snap: one scroll auto-plays the intro to the first card; then it's card-by-card ----
  if (lenis) {
    const st = tl.scrollTrigger;
    // per-card snap points (V_START = first card … 1 = last)
    const SNAPS = Array.from({ length: N }, (_, i) => V_START + (i / (N - 1)) * (1 - V_START));
    let snapTimer = null;
    let snapping = false;
    let lastDir = 1; // 1 = scrolling down, -1 = up
    lenis.on("scroll", ({ velocity }) => {
      if (Math.abs(velocity) > 0.05) lastDir = velocity > 0 ? 1 : -1;
      if (!st || snapping) return;
      clearTimeout(snapTimer);
      snapTimer = setTimeout(() => {
        if (!st.isActive || Math.abs(velocity) > 0.04) return;
        const p = st.progress;
        let near, dur = 0.7;
        if (p < V_START - 0.02) {
          // intro region — commit: down → auto-play through to the first card; up → back to the top
          if (p < 0.012) return;
          near = lastDir >= 0 ? V_START : 0;
          dur = 1.1; // let the grid intro play out gracefully
        } else {
          near = SNAPS[0];
          for (const s of SNAPS) if (Math.abs(s - p) < Math.abs(near - p)) near = s;
        }
        if (Math.abs(near - p) < 0.004) return;
        const target = st.start + near * (st.end - st.start);
        snapping = true;
        lenis.scrollTo(target, {
          duration: dur,
          easing: (t) => 1 - Math.pow(1 - t, 3),
          onComplete: () => { snapping = false; },
        });
      }, 140);
    });
  }
}

/* -----------------------------------------------------------
   7) Slide-out menu (hamburger → sweeps in from the left)
----------------------------------------------------------- */
(function setupMenu() {
  const menu = document.getElementById("menu");
  const burger = document.getElementById("navBurger");
  const closeBtn = document.getElementById("menuClose");
  if (!menu || !burger) return;
  let open = false;

  function openMenu() {
    if (open) return;
    open = true;
    menu.classList.add("is-open");
    menu.setAttribute("aria-hidden", "false");
    if (lenis) lenis.stop();
    document.body.style.overflow = "hidden";
  }

  function closeMenu() {
    if (!open) return;
    open = false;
    menu.classList.remove("is-open");
    menu.setAttribute("aria-hidden", "true");
    if (lenis) lenis.start();
    document.body.style.overflow = "";
  }

  burger.addEventListener("click", openMenu);
  closeBtn.addEventListener("click", closeMenu);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && open) closeMenu();
  });

  document.querySelectorAll("[data-menu-link]").forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const target = document.querySelector(a.getAttribute("href"));
      closeMenu();
      if (!target) return;
      if (lenis) lenis.scrollTo(target, { offset: 0 });
      else target.scrollIntoView({ behavior: "smooth" });
    });
  });
})();

/* -----------------------------------------------------------
   Boot
----------------------------------------------------------- */
window.addEventListener("load", runLoader);
