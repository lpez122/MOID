const state = {
  catalog: null,
  category: "All",
  query: "",
  shown: 12,
  explorerOpen: false,
  animating: false,
  closedPillRect: null,
  taxonomy: null,
  taxonomyFrequency: null,
  taxonomyRoot: null,
  taxonomyFocus: null,
  taxonomySelected: null,
  taxonomyThreshold: 10,
  taxonomySearchNodes: [],
  taxonomySearchMatches: [],
  taxonomySearchIndex: -1
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
  dialog: document.querySelector("#image-dialog"),
  taxonomyChart: document.querySelector("#taxonomy-chart"),
  taxonomyTooltip: document.querySelector("#taxonomy-tooltip"),
  taxonomyDetail: document.querySelector("#taxonomy-detail"),
  taxonomyFocus: document.querySelector("#taxonomy-focus"),
  taxonomyThreshold: document.querySelector("#taxonomy-threshold"),
  taxonomyThresholdValue: document.querySelector("#taxonomy-threshold-value"),
  taxonomyOnlyLacking: document.querySelector("#taxonomy-only-lacking"),
  taxonomyImageCount: document.querySelector("#taxonomy-image-count"),
  taxonomyCoveredCount: document.querySelector("#taxonomy-covered-count"),
  taxonomyLackingCount: document.querySelector("#taxonomy-lacking-count"),
  taxonomyLackingLabel: document.querySelector("#taxonomy-lacking-label"),
  taxonomySparseLegend: document.querySelector("#taxonomy-sparse-legend"),
  taxonomyPresentLegend: document.querySelector("#taxonomy-present-legend"),
  taxonomySearch: document.querySelector("#taxonomy-search"),
  taxonomySearchResults: document.querySelector("#taxonomy-search-results"),
  taxonomySearchTotal: document.querySelector("#taxonomy-search-total")
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
  const green = getComputedStyle(document.documentElement).getPropertyValue("--green").trim();
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
      background: green,
      borderColor: "#151713",
      borderRadius: sliceRadius,
      borderWidth: sliceBorder,
      color: "#fffef9",
      height: `${sliceHeight}px`,
      left: `${sliceLeft}px`,
      top: `${sliceTop}px`,
      width: `${sliceWidth}px`
    };
    const kickFrame = {
      background: green,
      borderColor: "#151713",
      borderRadius: "6px",
      borderWidth: "1px",
      color: "#fffef9",
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

const taxonomyNamespace = "http://www.w3.org/2000/svg";
const taxonomyColors = [
  "--taxonomy-1",
  "--taxonomy-2",
  "--taxonomy-3",
  "--taxonomy-4",
  "--taxonomy-5",
  "--taxonomy-6"
];
const taxonomyShortLabels = {
  animals: "Animals",
  arts_music_and_media: "Arts, Music & Media",
  body_clothing_and_accessories: "Clothing & Accessories",
  electronics_and_appliances: "Electronics",
  food_and_drink: "Food & Drink",
  furniture_and_home_goods: "Furniture & Home",
  health_and_medical: "Health & Medical",
  natural_objects_and_materials: "Nature & Materials",
  plants_and_organisms: "Plants & Organisms",
  sports_toys_and_recreation: "Sports & Recreation",
  tools_and_hardware: "Tools & Hardware",
  travel_and_transit: "Travel & Transit",
  vehicles_and_transport: "Vehicles & Transport"
};

function prepareTaxonomyNode(node, parent = null) {
  node.parent = parent;
  node.path = parent && parent.depth > 0 ? `${parent.path} / ${node.label}` : node.label;
  if (node.children.length === 0) {
    node.leafCount = 1;
    node.total = node.count;
    node.covered = node.count > 0 ? 1 : 0;
    return;
  }
  node.children.forEach((child) => prepareTaxonomyNode(child, node));
  node.leafCount = node.children.reduce((total, child) => total + child.leafCount, 0);
  node.total = node.children.reduce((total, child) => total + child.total, 0);
  node.covered = node.children.reduce((total, child) => total + child.covered, 0);
}

function buildTaxonomyTree() {
  const counts = state.taxonomyFrequency.counts;
  const root = {
    slug: "all",
    label: "All categories",
    depth: 0,
    colorIndex: 0,
    children: state.taxonomy.categories.map((category, categoryIndex) => ({
      slug: category.slug,
      label: category.label,
      depth: 1,
      colorIndex: categoryIndex % taxonomyColors.length,
      children: category.groups.map((group) => ({
        slug: group.slug,
        label: group.label,
        depth: 2,
        colorIndex: categoryIndex % taxonomyColors.length,
        children: group.concepts.map((concept) => ({
          slug: concept.slug,
          label: concept.label,
          count: counts[concept.id] ?? 0,
          depth: 3,
          colorIndex: categoryIndex % taxonomyColors.length,
          children: []
        }))
      }))
    }))
  };
  prepareTaxonomyNode(root);
  return root;
}

function makeTaxonomySvgElement(tag, attributes = {}) {
  const element = document.createElementNS(taxonomyNamespace, tag);
  Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
  return element;
}

function taxonomyPolar(radius, angle) {
  return [
    360 + radius * Math.cos(angle - Math.PI / 2),
    360 + radius * Math.sin(angle - Math.PI / 2)
  ];
}

function taxonomyArcPath(start, end, inner, outer) {
  const gap = Math.min(.0025, Math.max(0, (end - start) * .08));
  const startAngle = start + gap;
  const endAngle = end - gap;
  const span = Math.max(.0001, endAngle - startAngle);
  const outerStart = taxonomyPolar(outer, startAngle);
  const outerEnd = taxonomyPolar(outer, endAngle);
  const innerEnd = taxonomyPolar(inner, endAngle);
  const innerStart = taxonomyPolar(inner, startAngle);
  const largeArc = span > Math.PI ? 1 : 0;
  return [
    `M${outerStart[0]},${outerStart[1]}`,
    `A${outer},${outer} 0 ${largeArc} 1 ${outerEnd[0]},${outerEnd[1]}`,
    `L${innerEnd[0]},${innerEnd[1]}`,
    `A${inner},${inner} 0 ${largeArc} 0 ${innerStart[0]},${innerStart[1]} Z`
  ].join(" ");
}

function layoutTaxonomy(node, start, end, output) {
  let cursor = start;
  node.children.forEach((child) => {
    const width = (end - start) * child.leafCount / node.leafCount;
    child.x0 = cursor;
    child.x1 = cursor + width;
    output.push(child);
    layoutTaxonomy(child, child.x0, child.x1, output);
    cursor += width;
  });
}

function taxonomyNodeStatus(node) {
  if (node.depth < 3) {
    return `${format(node.covered)} of ${format(node.leafCount)} level-3 labels covered`;
  }
  if (node.count === 0) return "absent";
  if (node.count <= state.taxonomyThreshold) return "lacking";
  return "represented";
}

function taxonomyNodeOpacity(node) {
  if (node.depth < 3) return node.depth === 1 ? .84 : .5;
  if (node.count === 0) return .15;
  if (node.count <= state.taxonomyThreshold) return .32;
  return Math.min(.96, .48 + Math.log10(node.count + 1) / 5);
}

function setTaxonomyDetail(node) {
  state.taxonomySelected = node;
  const imageLabel = `${format(node.total)} image${node.total === 1 ? "" : "s"}`;
  elements.taxonomyDetail.innerHTML =
    `<strong>${node.path}</strong>&nbsp;&nbsp;·&nbsp;&nbsp;${imageLabel}` +
    `&nbsp;&nbsp;·&nbsp;&nbsp;${taxonomyNodeStatus(node)}`;
}

function showTaxonomyTooltip(event, node) {
  const bounds = elements.taxonomyChart.parentElement.getBoundingClientRect();
  const left = Math.min(event.clientX - bounds.left, bounds.width - 295);
  elements.taxonomyTooltip.innerHTML =
    `<b>${node.path}</b>${format(node.total)} image${node.total === 1 ? "" : "s"}` +
    `<br />${taxonomyNodeStatus(node)}`;
  elements.taxonomyTooltip.style.left = `${Math.max(0, left)}px`;
  elements.taxonomyTooltip.style.top = `${Math.max(0, event.clientY - bounds.top)}px`;
  elements.taxonomyTooltip.style.opacity = "1";
}

function hideTaxonomyTooltip() {
  elements.taxonomyTooltip.style.opacity = "0";
}

function drawTaxonomyLabel(group, node, relativeDepth, inner, outer) {
  const angle = node.x1 - node.x0;
  const radius = (inner + outer) / 2;
  if (angle * radius < 48 || (relativeDepth === 3 && angle * radius < 74)) return;
  const midpoint = (node.x0 + node.x1) / 2;
  const degrees = midpoint * 180 / Math.PI - 90;
  const flipped = degrees > 90 && degrees < 270;
  const label = makeTaxonomySvgElement("text", {
    class: "taxonomy-arc-label",
    dy: ".32em",
    "text-anchor": flipped ? "end" : "start",
    transform: `rotate(${degrees} 360 360) translate(${radius + 4} 360) rotate(${flipped ? 180 : 0})`
  });
  const displayLabel = node.depth === 1
    ? taxonomyShortLabels[node.slug] ?? node.label
    : node.label;
  label.textContent =
    displayLabel.length > 25 ? `${displayLabel.slice(0, 23)}…` : displayLabel;
  group.append(label);
}

function zoomTaxonomy(node) {
  state.taxonomyFocus = node.children.length ? node : node.parent;
  const levelOne = state.taxonomyFocus.depth === 1
    ? state.taxonomyFocus
    : state.taxonomyFocus.depth > 1 ? state.taxonomyFocus.parent : null;
  elements.taxonomyFocus.value = levelOne ? levelOne.slug : "all";
  setTaxonomyDetail(state.taxonomyFocus);
  renderTaxonomy();
}

function taxonomyNodeType(node) {
  if (node.depth === 1) return "Category";
  if (node.depth === 2) return "Group";
  return "Object label";
}

function normalizeTaxonomySearch(value) {
  return value
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function closeTaxonomySearchResults() {
  state.taxonomySearchIndex = -1;
  elements.taxonomySearchResults.hidden = true;
  elements.taxonomySearch.setAttribute("aria-expanded", "false");
  elements.taxonomySearch.removeAttribute("aria-activedescendant");
}

function updateTaxonomySearchActiveResult() {
  const buttons = elements.taxonomySearchResults.querySelectorAll(".taxonomy-search-result");
  buttons.forEach((button, index) => {
    const active = index === state.taxonomySearchIndex;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
    if (active) {
      elements.taxonomySearch.setAttribute("aria-activedescendant", button.id);
      button.scrollIntoView({ block: "nearest" });
    }
  });
}

function selectTaxonomySearchNode(node) {
  state.taxonomySelected = node;
  state.taxonomyFocus = node.children.length ? node : node.parent;
  const levelOne = node.depth === 1
    ? node
    : node.depth > 1 ? (node.depth === 2 ? node.parent : node.parent.parent) : null;
  elements.taxonomyFocus.value = levelOne ? levelOne.slug : "all";
  elements.taxonomySearch.value = node.label;
  closeTaxonomySearchResults();
  renderTaxonomy();
  setTaxonomyDetail(node);
}

function renderTaxonomySearchResults() {
  const query = normalizeTaxonomySearch(elements.taxonomySearch.value);
  if (!query) {
    state.taxonomySearchMatches = [];
    closeTaxonomySearchResults();
    return;
  }

  state.taxonomySearchMatches = state.taxonomySearchNodes
    .map((node) => {
      const label = normalizeTaxonomySearch(node.label);
      const path = normalizeTaxonomySearch(node.path);
      let rank = 5;
      if (label === query) rank = 0;
      else if (label.startsWith(query)) rank = 1;
      else if (label.includes(query)) rank = 2;
      else if (path.includes(query)) rank = 3;
      return { node, rank };
    })
    .filter((match) => match.rank < 5)
    .sort((a, b) =>
      a.rank - b.rank ||
      b.node.total - a.node.total ||
      a.node.label.localeCompare(b.node.label)
    )
    .slice(0, 10)
    .map((match) => match.node);

  state.taxonomySearchIndex = -1;
  elements.taxonomySearchResults.replaceChildren();
  if (state.taxonomySearchMatches.length === 0) {
    const empty = document.createElement("p");
    empty.className = "taxonomy-search-empty";
    empty.textContent = "No taxonomy labels match that search.";
    elements.taxonomySearchResults.append(empty);
  } else {
    state.taxonomySearchMatches.forEach((node, index) => {
      const button = document.createElement("button");
      button.className = "taxonomy-search-result";
      button.id = `taxonomy-search-option-${index}`;
      button.type = "button";
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", "false");

      const label = document.createElement("strong");
      label.textContent = node.label;
      const path = document.createElement("small");
      path.textContent = `${taxonomyNodeType(node)} · ${node.path}`;
      const count = document.createElement("b");
      count.textContent = `${format(node.total)} image${node.total === 1 ? "" : "s"}`;
      button.append(label, path, count);
      button.addEventListener("pointerdown", (event) => event.preventDefault());
      button.addEventListener("click", () => selectTaxonomySearchNode(node));
      elements.taxonomySearchResults.append(button);
    });
  }

  elements.taxonomySearchResults.hidden = false;
  elements.taxonomySearch.setAttribute("aria-expanded", "true");
}

function renderTaxonomy() {
  const focus = state.taxonomyFocus;
  const nodes = [];
  layoutTaxonomy(focus, 0, Math.PI * 2, nodes);
  const maxRelativeDepth = Math.max(1, 3 - focus.depth);
  const innerRadius = 86;
  const outerRadius = 334;
  const ringWidth = (outerRadius - innerRadius) / maxRelativeDepth;
  const arcs = makeTaxonomySvgElement("g");
  const labels = makeTaxonomySvgElement("g");

  elements.taxonomyChart.replaceChildren();
  nodes.forEach((node) => {
    const relativeDepth = node.depth - focus.depth;
    if (relativeDepth < 1 || relativeDepth > maxRelativeDepth) return;
    const inner = innerRadius + (relativeDepth - 1) * ringWidth + 2;
    const outer = innerRadius + relativeDepth * ringWidth - 2;
    const path = makeTaxonomySvgElement("path", {
      class: "taxonomy-arc",
      d: taxonomyArcPath(node.x0, node.x1, inner, outer),
      fill: node.depth === 3 && node.count === 0
        ? "var(--line)"
        : `var(${taxonomyColors[node.colorIndex]})`,
      "fill-opacity": taxonomyNodeOpacity(node),
      stroke: node.depth === 3 && node.count <= state.taxonomyThreshold
        ? "var(--orange)"
        : "var(--paper)",
      "stroke-opacity": node.depth === 3 && node.count <= state.taxonomyThreshold ? ".7" : ".95",
      "stroke-width": node.depth === 3 && node.count <= state.taxonomyThreshold ? ".8" : "1",
      tabindex: "0",
      role: "button",
      "aria-label": `${node.path}, ${format(node.total)} images`
    });
    if (
      elements.taxonomyOnlyLacking.checked &&
      node.depth === 3 &&
      node.count > state.taxonomyThreshold
    ) {
      path.classList.add("is-muted");
    }
    if (node === state.taxonomySelected) path.classList.add("is-selected");
    path.addEventListener("pointermove", (event) => showTaxonomyTooltip(event, node));
    path.addEventListener("pointerleave", hideTaxonomyTooltip);
    path.addEventListener("focus", () => setTaxonomyDetail(node));
    path.addEventListener("click", () => zoomTaxonomy(node));
    path.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        zoomTaxonomy(node);
      }
    });
    arcs.append(path);
    drawTaxonomyLabel(labels, node, relativeDepth, inner, outer);
  });
  elements.taxonomyChart.append(arcs, labels);

  const center = makeTaxonomySvgElement("g", {
    class: "taxonomy-center",
    tabindex: "0",
    role: "button",
    "aria-label": focus.parent ? `Back to ${focus.parent.label}` : "All categories"
  });
  center.append(makeTaxonomySvgElement("circle", { cx: 360, cy: 360, r: 72 }));
  const title = makeTaxonomySvgElement("text", {
    class: "taxonomy-center-title",
    x: 360,
    y: 349
  });
  title.textContent = focus.label.length > 20 ? `${focus.label.slice(0, 18)}…` : focus.label;
  const images = makeTaxonomySvgElement("text", {
    class: "taxonomy-center-sub",
    x: 360,
    y: 369
  });
  images.textContent = `${format(focus.total)} images`;
  const labelsCovered = makeTaxonomySvgElement("text", {
    class: "taxonomy-center-sub",
    x: 360,
    y: 385
  });
  labelsCovered.textContent = `${format(focus.covered)} / ${format(focus.leafCount)} labels`;
  center.append(title, images, labelsCovered);
  const goBack = () => {
    if (focus.parent) zoomTaxonomy(focus.parent);
  };
  center.addEventListener("click", goBack);
  center.addEventListener("keydown", (event) => {
    if ((event.key === "Enter" || event.key === " ") && focus.parent) {
      event.preventDefault();
      goBack();
    }
  });
  elements.taxonomyChart.append(center);
}

function updateTaxonomyThreshold() {
  state.taxonomyThreshold = Number(elements.taxonomyThreshold.value);
  const leaves = state.taxonomyRoot.children.flatMap((category) =>
    category.children.flatMap((group) => group.children)
  );
  const lacking = leaves.filter((leaf) => leaf.count <= state.taxonomyThreshold).length;
  elements.taxonomyThresholdValue.textContent = format(state.taxonomyThreshold);
  elements.taxonomyLackingCount.textContent = format(lacking);
  elements.taxonomyLackingLabel.textContent =
    `Labels with ${format(state.taxonomyThreshold)} or fewer`;
  elements.taxonomySparseLegend.textContent = state.taxonomyThreshold === 0
    ? "No sparse band"
    : `1–${format(state.taxonomyThreshold)} images`;
  elements.taxonomyPresentLegend.textContent = `More than ${format(state.taxonomyThreshold)}`;
  setTaxonomyDetail(state.taxonomySelected ?? state.taxonomyFocus);
  renderTaxonomy();
}

function initializeTaxonomyChart() {
  state.taxonomyRoot = buildTaxonomyTree();
  state.taxonomyFocus = state.taxonomyRoot;
  state.taxonomySearchNodes = state.taxonomyRoot.children.flatMap((category) => [
    category,
    ...category.children.flatMap((group) => [group, ...group.children])
  ]);
  elements.taxonomyFocus.replaceChildren(new Option("All categories", "all"));
  state.taxonomyRoot.children.forEach((category) => {
    elements.taxonomyFocus.append(new Option(category.label, category.slug));
  });
  elements.taxonomyImageCount.textContent = format(state.taxonomyFrequency.stats.images);
  elements.taxonomyCoveredCount.textContent =
    `${format(state.taxonomyFrequency.stats.coveredConcepts)} / ${format(state.taxonomyFrequency.stats.concepts)}`;
  elements.taxonomySearchTotal.textContent =
    `${format(state.taxonomyFrequency.stats.concepts)} labels`;
  setTaxonomyDetail(state.taxonomyRoot);
  updateTaxonomyThreshold();
}

async function init() {
  try {
    const [catalogResponse, taxonomyResponse, taxonomyFrequencyResponse] = await Promise.all([
      fetch("./catalog.json"),
      fetch("./taxonomy.json?v=20260718-taxonomy"),
      fetch("./taxonomy-frequency.json?v=20260725-frequency")
    ]);
    if (!catalogResponse.ok) throw new Error("Catalog unavailable");
    if (!taxonomyResponse.ok) throw new Error("Taxonomy unavailable");
    if (!taxonomyFrequencyResponse.ok) throw new Error("Taxonomy frequencies unavailable");
    [state.catalog, state.taxonomy, state.taxonomyFrequency] = await Promise.all([
      catalogResponse.json(),
      taxonomyResponse.json(),
      taxonomyFrequencyResponse.json()
    ]);
    document.querySelector("#image-count").textContent = format(state.catalog.stats.totalImages ?? 24592);
    document.querySelector("#concept-count").textContent = format(state.taxonomy.stats.concepts);
    document.querySelector("#category-count").textContent = format(state.taxonomy.stats.categories);
    renderMarquee();
    renderFilters();
    initializeTaxonomyChart();
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
elements.taxonomyFocus.addEventListener("change", () => {
  const node = elements.taxonomyFocus.value === "all"
    ? state.taxonomyRoot
    : state.taxonomyRoot.children.find(
      (category) => category.slug === elements.taxonomyFocus.value
    );
  zoomTaxonomy(node);
});
elements.taxonomySearch.addEventListener("input", renderTaxonomySearchResults);
elements.taxonomySearch.addEventListener("focus", renderTaxonomySearchResults);
elements.taxonomySearch.addEventListener("keydown", (event) => {
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    if (state.taxonomySearchMatches.length === 0) return;
    event.preventDefault();
    const direction = event.key === "ArrowDown" ? 1 : -1;
    state.taxonomySearchIndex =
      (state.taxonomySearchIndex + direction + state.taxonomySearchMatches.length) %
      state.taxonomySearchMatches.length;
    updateTaxonomySearchActiveResult();
  }
  if (event.key === "Enter" && state.taxonomySearchMatches.length > 0) {
    event.preventDefault();
    const index = state.taxonomySearchIndex < 0 ? 0 : state.taxonomySearchIndex;
    selectTaxonomySearchNode(state.taxonomySearchMatches[index]);
  }
  if (event.key === "Escape") closeTaxonomySearchResults();
});
document.addEventListener("pointerdown", (event) => {
  if (!event.target.closest(".taxonomy-search")) closeTaxonomySearchResults();
});
elements.taxonomyThreshold.addEventListener("input", updateTaxonomyThreshold);
elements.taxonomyOnlyLacking.addEventListener("change", renderTaxonomy);
elements.loadMore.addEventListener("click", () => { state.shown += 12; renderGallery(); });
elements.explorerToggle.addEventListener("click", () => setExplorerOpen(!state.explorerOpen));
elements.dialog.querySelector(".dialog-close").addEventListener("click", () => elements.dialog.close());
elements.dialog.addEventListener("click", (event) => { if (event.target === elements.dialog) elements.dialog.close(); });
document.addEventListener("keydown", (event) => {
  const activeElement = document.activeElement;
  const isTyping = activeElement.matches("input, textarea, select, [contenteditable='true']");
  if (event.key === "/" && !isTyping) {
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
