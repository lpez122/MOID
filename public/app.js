const state = {
  catalog: null,
  category: "All",
  query: "",
  shown: 12,
  explorerOpen: false,
  animating: false,
  closedPillRect: null
};

const elements = {
  explorer: document.querySelector("#explore"),
  explorerToggle: document.querySelector("#explore-toggle"),
  explorerToggleLabel: document.querySelector(".explore-toggle-label"),
  explorerPanel: document.querySelector("#explorer-panel"),
  gallery: document.querySelector("#gallery"),
  filters: document.querySelector("#filters"),
  search: document.querySelector("#search"),
  resultCount: document.querySelector("#result-count"),
  loadMore: document.querySelector("#load-more"),
  empty: document.querySelector("#empty"),
  dialog: document.querySelector("#image-dialog")
};

const format = (number) => new Intl.NumberFormat("en-US").format(number);
const featureRank = (image) => image.slug === "hedgehog" ? 0 : 1;

function filteredImages() {
  const query = state.query.trim().toLowerCase();
  return state.catalog.images.filter((image) => {
    const inCategory = state.category === "All" || image.category === state.category;
    const searchable = `${image.name} ${image.category} ${image.collection}`.toLowerCase();
    return inCategory && (!query || searchable.includes(query));
  }).sort((a, b) => featureRank(a) - featureRank(b));
}

function filteredGroups() {
  const groups = new Map();
  for (const image of filteredImages()) {
    const key = `${image.categorySlug}/${image.slug}`;
    if (!groups.has(key)) {
      groups.set(key, {
        name: image.name,
        category: image.category,
        collection: image.collection,
        images: []
      });
    }
    if (groups.get(key).images.length < 8) groups.get(key).images.push(image);
  }
  return [...groups.values()];
}

function openImage(image) {
  const dialog = elements.dialog;
  const dialogImage = dialog.querySelector("img");
  dialogImage.src = image.image;
  dialogImage.alt = image.name;
  dialog.querySelector("h3").textContent = image.name;
  dialog.querySelector(".dialog-category").textContent = image.category;
  dialog.querySelector(".dialog-collection").textContent = image.collection;
  dialog.showModal();
}

function renderGallery() {
  const matches = filteredGroups();
  const visible = matches.slice(0, state.shown);
  elements.gallery.replaceChildren(...visible.map((group) => {
    const row = document.createElement("section");
    row.className = "object-row";

    const label = document.createElement("div");
    label.className = "object-row-label";
    label.innerHTML = `<h3>${group.name}</h3><p>${group.collection}<br />${group.category}</p>`;

    const strip = document.createElement("div");
    strip.className = "object-row-strip";
    const images = document.createElement("div");
    images.className = "object-row-images";
    images.replaceChildren(...group.images.map((image, index) => {
      const card = document.createElement("button");
      card.className = "image-card";
      card.type = "button";
      card.setAttribute("aria-label", `View ${image.name}, image ${index + 1}`);
      card.innerHTML = `<figure><img src="${image.image}" alt="${image.name}" loading="lazy" decoding="async" /></figure>`;
      card.addEventListener("click", () => openImage(image));
      return card;
    }));
    strip.append(images);
    row.append(label, strip);
    return row;
  }));

  const imageCount = matches.reduce((total, group) => total + group.images.length, 0);
  elements.resultCount.textContent = `${format(matches.length)} label${matches.length === 1 ? "" : "s"} · ${format(imageCount)} images`;
  elements.loadMore.hidden = state.shown >= matches.length || matches.length === 0;
  elements.empty.hidden = matches.length !== 0;
}

function renderFilters() {
  const categories = ["All", ...state.catalog.categories];
  elements.filters.replaceChildren(...categories.map((category, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `filter${category === state.category ? " active" : ""}`;
    button.textContent = category;
    button.style.setProperty("--chip-index", index);
    button.addEventListener("click", () => {
      state.category = category;
      state.shown = 12;
      renderFilters();
      renderGallery();
    });
    return button;
  }));
}

const nextPaint = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

function getClosedPillRect() {
  const headingRect = document.querySelector(".explorer-heading").getBoundingClientRect();
  const currentRect = elements.explorerToggle.getBoundingClientRect();
  return {
    left: headingRect.left,
    top: currentRect.top,
    width: window.innerWidth <= 800
      ? headingRect.width
      : (state.closedPillRect?.width ?? 250),
    height: state.closedPillRect?.height ?? currentRect.height
  };
}

async function animateFilterPieces(direction, pillRect) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const targets = [...elements.filters.querySelectorAll(".filter")];
  const duration = 720;
  const maximumDelay = direction === "open"
    ? (targets.length - 1) * 18
    : (targets.length - 1) * 14;
  const sliceWidth = pillRect.width / targets.length;
  const sliceHeight = pillRect.height;

  const animations = targets.map((target, index) => {
    const targetRect = target.getBoundingClientRect();
    const targetStyle = getComputedStyle(target);
    const sliceLeft = pillRect.left + (index * sliceWidth);
    const sliceTop = pillRect.top;
    const isFirst = index === 0;
    const isLast = index === targets.length - 1;
    const sliceRadius = isFirst
      ? "999px 0 0 999px"
      : (isLast ? "0 999px 999px 0" : "0");
    const sliceBorder = isFirst
      ? "1px 0 1px 1px"
      : (isLast ? "1px 1px 1px 0" : "1px 0");
    const piece = document.createElement("div");
    piece.className = "category-piece";
    if (target.classList.contains("active")) piece.classList.add("active");
    piece.innerHTML = `<span>${target.textContent}</span>`;
    const startsAtPill = direction === "open";
    piece.style.left = `${startsAtPill ? sliceLeft : targetRect.left}px`;
    piece.style.top = `${startsAtPill ? sliceTop : targetRect.top}px`;
    piece.style.width = `${startsAtPill ? sliceWidth : targetRect.width}px`;
    piece.style.height = `${startsAtPill ? sliceHeight : targetRect.height}px`;
    piece.style.borderRadius = startsAtPill ? sliceRadius : "999px";
    piece.style.borderWidth = startsAtPill ? sliceBorder : "1px";
    piece.style.fontFamily = targetStyle.fontFamily;
    piece.style.fontSize = targetStyle.fontSize;
    piece.style.fontWeight = targetStyle.fontWeight;
    piece.style.letterSpacing = targetStyle.letterSpacing;
    piece.style.lineHeight = targetStyle.lineHeight;
    document.body.append(piece);

    const xKick = (index - ((targets.length - 1) / 2)) * 2.5;
    const yKick = index % 2 === 0 ? -14 : 14;
    const pillFrame = {
      background: "#d9ff57",
      borderColor: "#151713",
      borderRadius: sliceRadius,
      borderWidth: sliceBorder,
      color: "#151713",
      height: `${sliceHeight}px`,
      left: `${sliceLeft}px`,
      top: `${sliceTop}px`,
      width: `${sliceWidth}px`
    };
    const kickFrame = {
      background: "#d9ff57",
      borderColor: "#151713",
      borderRadius: "6px",
      borderWidth: "1px",
      color: "#151713",
      height: `${sliceHeight}px`,
      left: `${sliceLeft + xKick}px`,
      top: `${sliceTop + yKick}px`,
      width: `${sliceWidth}px`
    };
    const targetFrame = {
      background: targetStyle.backgroundColor,
      borderColor: targetStyle.borderColor,
      borderRadius: "999px",
      borderWidth: "1px",
      color: targetStyle.color,
      height: `${targetRect.height}px`,
      left: `${targetRect.left}px`,
      top: `${targetRect.top}px`,
      width: `${targetRect.width}px`
    };
    const openingFrames = [
      { ...pillFrame, opacity: 1 },
      { ...kickFrame, offset: 0.3, opacity: 1 },
      { ...targetFrame, offset: 0.82, opacity: 1 },
      { ...targetFrame, opacity: 0 }
    ];
    const closingFrames = [
      { ...targetFrame, opacity: 1 },
      { ...targetFrame, offset: 0.18, opacity: 1 },
      { ...kickFrame, offset: 0.7, opacity: 1 },
      { ...pillFrame, offset: 0.9, opacity: 1 },
      { ...pillFrame, opacity: 0 }
    ];
    const delay = direction === "open" ? index * 18 : (targets.length - index - 1) * 14;
    const pieceDuration = duration + maximumDelay - delay;
    const animation = piece.animate(direction === "open" ? openingFrames : closingFrames, {
      delay,
      duration: pieceDuration,
      easing: "cubic-bezier(.2,.8,.2,1)",
      fill: "both"
    });

    const openingLabelFrames = [
      { opacity: 0, transform: "scale(.8)" },
      { opacity: 0, transform: "scale(.8)", offset: 0.48 },
      { opacity: 1, transform: "scale(1)", offset: 0.82 },
      { opacity: 0, transform: "scale(1)" }
    ];
    const closingLabelFrames = [
      { opacity: 1, transform: "scale(1)" },
      { opacity: 1, transform: "scale(1)", offset: 0.2 },
      { opacity: 0, transform: "scale(.8)", offset: 0.55 },
      { opacity: 0, transform: "scale(.8)" }
    ];
    piece.querySelector("span").animate(
      direction === "open" ? openingLabelFrames : closingLabelFrames,
      {
        delay,
        duration: pieceDuration,
        easing: "ease-out",
        fill: "both"
      }
    );

    return animation.finished.finally(() => piece.remove());
  });

  const settleTimer = setTimeout(() => {
    elements.explorer.classList.add("is-settling");
  }, maximumDelay + duration - 240);

  await Promise.all(animations);
  clearTimeout(settleTimer);
}

async function setExplorerOpen(open) {
  if (state.animating || state.explorerOpen === open) return;
  state.animating = true;
  state.explorerOpen = open;
  elements.explorerToggle.setAttribute("aria-expanded", String(open));

  if (open) {
    elements.explorerPanel.hidden = false;
    renderGallery();
    elements.explorer.classList.add("is-preparing");
    await nextPaint();
    const pillRect = elements.explorerToggle.getBoundingClientRect();
    state.closedPillRect = {
      width: pillRect.width,
      height: pillRect.height
    };
    const openingAnimation = animateFilterPieces("open", pillRect);
    elements.explorerToggleLabel.textContent = "Close explorer";
    elements.explorer.classList.add("is-building", "is-open");
    elements.explorer.classList.remove("is-preparing");
    elements.explorerPanel.setAttribute("aria-hidden", "false");
    await openingAnimation;
    elements.explorer.classList.remove("is-building", "is-settling");
    state.animating = false;
    return;
  }

  const pillRect = getClosedPillRect();
  const reverseAnimation = animateFilterPieces("close", pillRect);
  elements.explorer.classList.add("is-collapsing");
  elements.explorer.classList.remove("is-open");
  elements.explorerPanel.setAttribute("aria-hidden", "true");
  setTimeout(() => {
    if (!state.explorerOpen) elements.explorerToggleLabel.textContent = "Explore the collection";
  }, 220);
  await reverseAnimation;
  elements.explorerPanel.hidden = true;
  elements.explorer.classList.remove("is-collapsing", "is-settling");
  state.animating = false;
}

function renderMarquee() {
  const used = new Set();
  const samples = [...state.catalog.images]
    .sort((a, b) => featureRank(a) - featureRank(b))
    .filter((image) => {
    if (used.has(image.category)) return false;
    used.add(image.category);
    return true;
  }).slice(0, 10);
  const loop = [...samples, ...samples];
  document.querySelector("#marquee").replaceChildren(...loop.map((image) => {
    const card = document.createElement("div");
    card.className = "marquee-card";
    card.innerHTML = `<img src="${image.image}" alt="" loading="eager" />`;
    return card;
  }));
}

async function init() {
  try {
    const response = await fetch("./catalog.json");
    if (!response.ok) throw new Error("Catalog unavailable");
    state.catalog = await response.json();
    document.querySelector("#image-count").textContent = format(state.catalog.stats.totalImages ?? 24592);
    document.querySelector("#concept-count").textContent = format(state.catalog.stats.concepts);
    document.querySelector("#category-count").textContent = format(state.catalog.stats.categories);
    renderMarquee();
    renderFilters();
    elements.resultCount.textContent = `${format(state.catalog.stats.concepts)} object labels available to preview`;
  } catch (error) {
    elements.resultCount.textContent = "Could not load the image catalog.";
    console.error(error);
  }
}

let searchTimer;
elements.search.addEventListener("input", (event) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.query = event.target.value;
    state.shown = 12;
    renderGallery();
  }, 120);
});
elements.loadMore.addEventListener("click", () => { state.shown += 12; renderGallery(); });
elements.explorerToggle.addEventListener("click", () => setExplorerOpen(!state.explorerOpen));
elements.dialog.querySelector(".dialog-close").addEventListener("click", () => elements.dialog.close());
elements.dialog.addEventListener("click", (event) => { if (event.target === elements.dialog) elements.dialog.close(); });
document.addEventListener("keydown", (event) => {
  if (event.key === "/" && document.activeElement !== elements.search) {
    event.preventDefault();
    if (!state.explorerOpen) setExplorerOpen(true);
    setTimeout(() => elements.search.focus(), state.explorerOpen ? 0 : 360);
  }
  if (event.key === "Escape" && state.explorerOpen && !elements.dialog.open) {
    setExplorerOpen(false);
    elements.explorerToggle.focus();
  }
});
document.querySelector("#year").textContent = new Date().getFullYear();

init();
