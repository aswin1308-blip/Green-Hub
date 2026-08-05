/* ==========================================
        GREEN HUB - HOME.JS
        Hero slider + category carousel
========================================== */

const GH_SLIDESHOW_DELAY = 4500;

/* ---------- hero slideshow ---------- */

function ghBuildHeroSlides() {
  const hero = document.getElementById("gh-hero");
  if (!hero) return;

  const slidesEl = document.getElementById("gh-slides");
  const dotsEl = document.getElementById("gh-hero-dots");
  if (!slidesEl || !dotsEl) return;

  const sources = ["../images/hero-banner.jpg"];

  ghFetchJSON(GH_API_BASE + "/api/categories")
    .then((data) => {
      const categories = data.categories || [];
      const images = categories
        .map((c) => ghAssetUrl(c.image))
        .filter(Boolean);
      images.slice(0, 3).forEach((src) => {
        if (!sources.includes(src)) sources.push(src);
      });
      if (sources.length === 1) {
        sources.push("../images/plant1.jpg", "../images/plant2.jpg");
      }
    })
    .catch(() => {
      sources.push("../images/plant1.jpg", "../images/plant2.jpg");
    })
    .finally(() => ghRenderHeroSlides(sources, slidesEl, dotsEl));
}

function ghRenderHeroSlides(sources, slidesEl, dotsEl) {
  slidesEl.innerHTML = "";
  dotsEl.innerHTML = "";

  sources.forEach((src, index) => {
    const slide = document.createElement("div");
    slide.className = "gh-slide" + (index === 0 ? " active" : "");

    const img = document.createElement("img");
    img.src = src;
    img.alt = "Green Hub";
    img.setAttribute("data-nozoom", "");
    ghHandleImageError(img);
    slide.appendChild(img);

    slidesEl.appendChild(slide);

    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "gh-hero-dot" + (index === 0 ? " active" : "");
    dot.setAttribute("aria-label", "Slide " + (index + 1));
    dot.addEventListener("click", () => ghGoToSlide(index));
    dotsEl.appendChild(dot);
  });

  ghShowSlide(0);
}

let ghCurrentSlide = 0;
let ghSlideCount = 0;
let ghAutoplayTimer = null;

function ghGoToSlide(index) {
  const slides = document.querySelectorAll("#gh-hero .gh-slide");
  const dots = document.querySelectorAll("#gh-hero .gh-hero-dot");
  if (slides.length === 0) return;

  ghSlideCount = slides.length;
  ghCurrentSlide = (index + ghSlideCount) % ghSlideCount;

  slides.forEach((s, i) =>
    s.classList.toggle("active", i === ghCurrentSlide)
  );
  dots.forEach((d, i) => d.classList.toggle("active", i === ghCurrentSlide));
  ghRestartAutoplay();
}

function ghShowSlide(index) {
  ghGoToSlide(index);
}

function ghRestartAutoplay() {
  const hero = document.getElementById("gh-hero");
  if (!hero) return;
  clearInterval(ghAutoplayTimer);
  ghAutoplayTimer = setInterval(() => ghGoToSlide(ghCurrentSlide + 1), GH_SLIDESHOW_DELAY);
}

function ghInitHero() {
  const hero = document.getElementById("gh-hero");
  if (!hero) return;

  ghBuildHeroSlides();

  const prev = hero.querySelector(".gh-hero-arrow.prev");
  const next = hero.querySelector(".gh-hero-arrow.next");
  if (prev) prev.addEventListener("click", () => ghGoToSlide(ghCurrentSlide - 1));
  if (next) next.addEventListener("click", () => ghGoToSlide(ghCurrentSlide + 1));

  hero.addEventListener("mouseenter", () => clearInterval(ghAutoplayTimer));
  hero.addEventListener("mouseleave", ghRestartAutoplay);
}

/* ---------- category carousel arrows ---------- */

function ghInitCategoryCarousel() {
  const carousel = document.getElementById("shop-categories");
  if (!carousel) return;

  const prev = document.querySelector(".gh-carrow.prev");
  const next = document.querySelector(".gh-carrow.next");
  if (!prev || !next) return;

  const step = () => {
    const card = carousel.querySelector(".card");
    return card ? card.getBoundingClientRect().width + 22 : 240;
  };

  prev.addEventListener("click", () =>
    carousel.scrollBy({ left: -step(), behavior: "smooth" })
  );
  next.addEventListener("click", () =>
    carousel.scrollBy({ left: step(), behavior: "smooth" })
  );
}

/* ---------- init ---------- */

ghInitHero();
ghInitCategoryCarousel();
