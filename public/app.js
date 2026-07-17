const state = { catalog: null, category: "All", query: "", shown: 24 };

const elements = {
  gallery: document.querySelector("#gallery"),
  filters: document.querySelector("#filters"),
  search: document.querySelector("#search"),
  resultCount: document.querySelector("#result-count"),
  loadMore: document.querySelector("#load-more"),
  empty: document.querySelector("#empty"),
  dialog: document.querySelector("#image-dialog")
};

const format = (number) => new Intl.NumberFormat("en-US").format(number);

function filteredImages() {
  const query = state.query.trim().toLowerCase();
  return state.catalog.images.filter((image) => {
    const inCategory = state.category === "All" || image.category === state.category;
    const searchable = `${image.name} ${image.category} ${image.collection}`.toLowerCase();
    return inCategory && (!query || searchable.includes(query));
  });
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
  const matches = filteredImages();
  const visible = matches.slice(0, state.shown);
  elements.gallery.replaceChildren(...visible.map((image) => {
    const card = document.createElement("button");
    card.className = "image-card";
    card.type = "button";
    card.setAttribute("aria-label", `View ${image.name}`);
    card.innerHTML = `
      <figure><img src="${image.image}" alt="${image.name}" loading="lazy" decoding="async" /></figure>
      <span class="image-meta"><strong>${image.name}</strong><span>${image.category}</span></span>`;
    card.addEventListener("click", () => openImage(image));
    return card;
  }));

  elements.resultCount.textContent = `${format(matches.length)} image${matches.length === 1 ? "" : "s"}`;
  elements.loadMore.hidden = state.shown >= matches.length || matches.length === 0;
  elements.empty.hidden = matches.length !== 0;
}

function renderFilters() {
  const categories = ["All", ...state.catalog.categories];
  elements.filters.replaceChildren(...categories.map((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `filter${category === state.category ? " active" : ""}`;
    button.textContent = category;
    button.addEventListener("click", () => {
      state.category = category;
      state.shown = 24;
      renderFilters();
      renderGallery();
    });
    return button;
  }));
}

function renderMarquee() {
  const used = new Set();
  const samples = state.catalog.images.filter((image) => {
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
    document.querySelector("#image-count").textContent = format(state.catalog.stats.images);
    document.querySelector("#concept-count").textContent = format(state.catalog.stats.concepts);
    document.querySelector("#category-count").textContent = format(state.catalog.stats.categories);
    renderMarquee();
    renderFilters();
    renderGallery();
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
    state.shown = 24;
    renderGallery();
  }, 120);
});
elements.loadMore.addEventListener("click", () => { state.shown += 24; renderGallery(); });
elements.dialog.querySelector(".dialog-close").addEventListener("click", () => elements.dialog.close());
elements.dialog.addEventListener("click", (event) => { if (event.target === elements.dialog) elements.dialog.close(); });
document.addEventListener("keydown", (event) => {
  if (event.key === "/" && document.activeElement !== elements.search) {
    event.preventDefault();
    elements.search.focus();
  }
});
document.querySelector("#year").textContent = new Date().getFullYear();

init();
