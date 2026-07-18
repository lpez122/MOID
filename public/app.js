const state = { catalog: null, category: "All", query: "", shown: 12, explorerOpen: false, animating: false };

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

async function animateFilterPieces(sourceRect) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const targets = [...elements.filters.querySelectorAll(".filter")];
  const columns = Math.ceil(targets.length / 2);
  const inset = 8;
  const gap = 2;
  const brickWidth = Math.max(12, (sourceRect.width - (inset * 2) - (gap * (columns - 1))) / columns);
  const brickHeight = (sourceRect.height - (inset * 2) - gap) / 2;

  const animations = targets.map((target, index) => {
    const targetRect = target.getBoundingClientRect();
    const column = index % columns;
    const row = Math.floor(index / columns);
    const startLeft = sourceRect.left + inset + (column * (brickWidth + gap));
    const startTop = sourceRect.top + inset + (row * (brickHeight + gap));
    const piece = document.createElement("div");
    piece.className = "category-piece";
    if (target.classList.contains("active")) piece.classList.add("active");
    piece.innerHTML = `<span>${target.textContent}</span>`;
    piece.style.left = `${startLeft}px`;
    piece.style.top = `${startTop}px`;
    piece.style.width = `${brickWidth}px`;
    piece.style.height = `${brickHeight}px`;
    document.body.append(piece);

    const xKick = (column - ((columns - 1) / 2)) * 5;
    const yKick = row === 0 ? -22 : 22;
    const animation = piece.animate([
      {
        background: "#d9ff57",
        borderRadius: "4px",
        height: `${brickHeight}px`,
        left: `${startLeft}px`,
        top: `${startTop}px`,
        width: `${brickWidth}px`
      },
      {
        background: "#d9ff57",
        borderRadius: "7px",
        height: `${brickHeight}px`,
        left: `${startLeft + xKick}px`,
        offset: 0.34,
        top: `${startTop + yKick}px`,
        width: `${brickWidth}px`
      },
      {
        background: target.classList.contains("active") ? "#151713" : "#fffef9",
        borderRadius: "999px",
        height: `${targetRect.height}px`,
        left: `${targetRect.left}px`,
        top: `${targetRect.top}px`,
        width: `${targetRect.width}px`
      }
    ], {
      delay: index * 24,
      duration: 660,
      easing: "cubic-bezier(.2,.8,.2,1)",
      fill: "forwards"
    });

    piece.querySelector("span").animate([
      { opacity: 0, transform: "scale(.75)" },
      { opacity: 0, transform: "scale(.75)", offset: 0.45 },
      { opacity: 1, transform: "scale(1)" }
    ], {
      delay: index * 24,
      duration: 660,
      easing: "ease-out",
      fill: "forwards"
    });

    return animation.finished.finally(() => piece.remove());
  });

  await Promise.all(animations);
}

async function setExplorerOpen(open) {
  if (state.animating || state.explorerOpen === open) return;
  state.animating = true;
  state.explorerOpen = open;
  elements.explorerToggle.setAttribute("aria-expanded", String(open));

  if (open) {
    elements.explorerPanel.hidden = false;
    renderGallery();
    elements.explorer.classList.add("is-building");
    await nextPaint();
    const sourceRect = elements.explorerToggle.getBoundingClientRect();
    elements.explorerToggleLabel.textContent = "Close explorer";
    elements.explorer.classList.add("is-open");
    elements.explorerPanel.setAttribute("aria-hidden", "false");
    await animateFilterPieces(sourceRect);
    elements.explorer.classList.remove("is-building");
    state.animating = false;
    return;
  }

  elements.explorerToggleLabel.textContent = "Explore the collection";
  elements.explorer.classList.remove("is-open");
  elements.explorerPanel.setAttribute("aria-hidden", "true");
  setTimeout(() => {
    if (!state.explorerOpen) {
      elements.explorerPanel.hidden = true;
      state.animating = false;
    }
  }, 420);
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
