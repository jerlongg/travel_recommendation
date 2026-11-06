/* ============================================================
   Wanderly — Travel Recommendation Web Application
   ------------------------------------------------------------
   • Loads destination data with fetch() from the JSON file
   • Shows results only after the Search button is clicked
   • Accepts keyword variations (beach / beaches / Beach / BEACH)
   • Renders recommendations in a CSS grid with images + descriptions
   • Reset button clears the search and the results
   • Country results show the current local time (optional task)
   ============================================================ */

"use strict";

const DATA_URL = "travel_recommendation_api.json";
const FALLBACK_DATA_URL = "travel_recommendation.json";

/* Keyword groups — stems are used so plurals and related words match. */
const KEYWORD_GROUPS = {
  beach: ["beach", "beaches", "beachfront", "seaside", "coast", "coastal", "island"],
  temple: ["temple", "temples", "shrine", "shrines", "pagoda", "pagodas"],
  country: ["country", "countries", "nation", "nations"]
};

/* Application state */
let travelData = null;
let dataPromise = null;
let clockTimer = null;

/* ------------------------------------------------------------
   Boot
   ------------------------------------------------------------ */
document.addEventListener("DOMContentLoaded", () => {
  setupNavigation();
  setupSearch();
  setupContactForm();
  setupQuickSearch();
  setFooterYear();

  dataPromise = loadTravelData();
});

/* ------------------------------------------------------------
   Task 6 — Fetch the JSON data
   ------------------------------------------------------------ */
async function loadTravelData() {
  const sources = [DATA_URL, FALLBACK_DATA_URL];
  let lastError = null;

  for (const source of sources) {
    try {
      const response = await fetch(source);

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const data = await response.json();

      // Task 6: log the data so we can confirm the fetch worked.
      console.log(`Travel recommendation data loaded from ${source}:`, data);
      console.log(
        `Found ${data.countries.length} countries, ${data.temples.length} temples and ${data.beaches.length} beaches.`
      );

      travelData = data;
      return data;
    } catch (error) {
      lastError = error;
      console.warn(`Could not load ${source}:`, error.message);
    }
  }

  console.error("Could not load the travel recommendation data:", lastError);
  travelData = null;
  return null;
}

/* Ensure data has been loaded before searching. */
async function ensureData() {
  if (travelData) return travelData;
  if (!dataPromise) dataPromise = loadTravelData();
  return dataPromise;
}

/* ------------------------------------------------------------
   Task 2 & 4 — Navigation + hash routing
   ------------------------------------------------------------ */
function setupNavigation() {
  const navToggle = document.getElementById("nav-toggle");
  const navMenu = document.getElementById("nav-menu");
  const header = document.getElementById("site-header");
  const navLinks = document.querySelectorAll(".nav-link");

  // Mobile menu
  navToggle.addEventListener("click", () => {
    const isOpen = navMenu.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });

  // Close the mobile menu after choosing a page
  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      closeMobileMenu();
      const targetPage = link.dataset.nav;
      if (currentPage() === targetPage) {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  });

  // Close the mobile menu when clicking outside of it
  document.addEventListener("click", (event) => {
    if (!navMenu.contains(event.target) && !navToggle.contains(event.target)) {
      closeMobileMenu();
    }
  });

  // Header background after scrolling
  const onScroll = () => {
    header.classList.toggle("is-scrolled", window.scrollY > 30);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Route from the URL hash (Home / About / Contact). Other hashes
  // (for example #results used by in-page anchors) are ignored.
  window.addEventListener("hashchange", () => {
    const page = window.location.hash.replace("#", "").toLowerCase();
    if (["home", "about", "contact"].includes(page)) {
      showPage(page);
    }
  });

  showPage(currentPage());
}

function currentPage() {
  const page = window.location.hash.replace("#", "").toLowerCase();
  return ["home", "about", "contact"].includes(page) ? page : "home";
}

function showPage(page) {
  // Show the requested section and hide the others
  document.querySelectorAll("[data-page-section]").forEach((section) => {
    section.hidden = section.dataset.pageSection !== page;
  });

  // The navbar keeps only Home / About Us / Contact Us on About & Contact
  // (Task 4). The search bar is part of the Home page experience.
  document.body.dataset.page = page;

  const searchForm = document.getElementById("search-form");
  if (searchForm) searchForm.hidden = page !== "home";

  // Highlight the active link
  document.querySelectorAll(".nav-link").forEach((link) => {
    const isActive = link.dataset.nav === page;
    link.classList.toggle("is-active", isActive);
    if (isActive) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });

  // Page titles
  const titles = {
    home: "Wanderly | Travel Recommendations",
    about: "About Us | Wanderly",
    contact: "Contact Us | Wanderly"
  };
  document.title = titles[page] || titles.home;

  // Clocks only run while country results are on screen
  if (page === "home" && !document.getElementById("results").hidden) {
    startClocks();
  } else {
    stopClocks();
  }

  closeMobileMenu();
  window.scrollTo({ top: 0, behavior: "auto" });
}

function closeMobileMenu() {
  const navMenu = document.getElementById("nav-menu");
  const navToggle = document.getElementById("nav-toggle");
  if (!navMenu || !navToggle) return;
  navMenu.classList.remove("is-open");
  navToggle.setAttribute("aria-expanded", "false");
}

/* ------------------------------------------------------------
   Search form (Tasks 2, 7, 8 & 9)
   ------------------------------------------------------------ */
function setupSearch() {
  const form = document.getElementById("search-form");
  const input = document.getElementById("search-input");
  const resultsSection = document.getElementById("results");

  if (!form || !input) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault(); // results appear only after the Search button is used
    closeMobileMenu();

    const query = input.value.trim();

    if (!query) {
      showResultsMessage("Type a keyword first — try “beach”, “temple” or “country”.");
      input.focus();
      return;
    }

    const button = document.getElementById("search-btn");
    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = "Searching…";

    const data = await ensureData();
    button.disabled = false;
    button.textContent = originalLabel;

    if (!data) {
      resultsSection.hidden = false;
      document.getElementById("results-title").textContent = "Recommendations";
      document.getElementById("results-count").textContent = "";
      document.getElementById("results-grid").innerHTML = "";
      document.getElementById("no-results").hidden = true;
      showResultsMessage(
        "We couldn’t load the travel data. Please run the site through a local web server (for example, VS Code Live Server) and try again.",
        true
      );
      return;
    }

    runSearch(query);
  });

  // Reset / Clear button
  form.addEventListener("reset", (event) => {
    event.preventDefault();
    closeMobileMenu();
    clearResults();
  });
}

/* Quick-search links: hero buttons and the “no results” suggestions */
function setupQuickSearch() {
  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-quick-search]");
    if (!trigger) return;

    event.preventDefault();
    const query = trigger.dataset.quickSearch;
    const input = document.getElementById("search-input");
    input.value = query;

    runSearch(query);
  });
}

/* ------------------------------------------------------------
   Task 7 — Normalise keywords and match variations
   ------------------------------------------------------------ */
function normalise(value) {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents (São → sao)
    .replace(/[^a-z0-9\s]/g, " ")    // punctuation → space
    .replace(/\s+/g, " ")
    .trim();
}

function matchesGroup(query, group) {
  return KEYWORD_GROUPS[group].some((keyword) => query.includes(keyword));
}

/* Flatten the JSON into a consistent list of recommendation objects. */
function allCountries(data) {
  const items = [];
  data.countries.forEach((country) => {
    country.cities.forEach((city) => {
      items.push({
        name: city.name,
        imageUrl: city.imageUrl,
        description: city.description,
        category: "country",
        badge: country.name,
        timeZone: country.timeZone,
        timeZoneLabel: country.timeZoneLabel || country.name
      });
    });
  });
  return items;
}

function allBeaches(data) {
  return data.beaches.map((beach) => ({
    name: beach.name,
    imageUrl: beach.imageUrl,
    description: beach.description,
    category: "beach",
    badge: "Beach"
  }));
}

function allTemples(data) {
  return data.temples.map((temple) => ({
    name: temple.name,
    imageUrl: temple.imageUrl,
    description: temple.description,
    category: "temple",
    badge: "Temple"
  }));
}

/* Look up a specific country, city, beach or temple by name. */
function findDestinations(data, query) {
  const found = [];
  const seen = new Set();

  const push = (item) => {
    if (!seen.has(item.name)) {
      seen.add(item.name);
      found.push(item);
    }
  };

  data.countries.forEach((country) => {
    const countryMatches = query.includes(normalise(country.name));
    const matchingCities = country.cities.filter((city) => {
      const shortName = normalise(city.name.split(",")[0]);
      const fullName = normalise(city.name);
      return query.includes(shortName) || query.includes(fullName);
    });

    if (countryMatches) {
      country.cities.forEach((city) => {
        push({
          name: city.name,
          imageUrl: city.imageUrl,
          description: city.description,
          category: "country",
          badge: country.name,
          timeZone: country.timeZone,
          timeZoneLabel: country.timeZoneLabel || country.name
        });
      });
    } else {
      matchingCities.forEach((city) => {
        push({
          name: city.name,
          imageUrl: city.imageUrl,
          description: city.description,
          category: "country",
          badge: country.name,
          timeZone: country.timeZone,
          timeZoneLabel: country.timeZoneLabel || country.name
        });
      });
    }
  });

  allTemples(data).forEach((temple) => {
    const shortName = normalise(temple.name.split(",")[0]);
    if (query.includes(shortName)) push(temple);
  });

  allBeaches(data).forEach((beach) => {
    const shortName = normalise(beach.name.split(",")[0]);
    if (query.includes(shortName)) push(beach);
  });

  return found;
}

/* Build the result set for a query. */
function findRecommendations(data, rawQuery) {
  const query = normalise(rawQuery);
  const isBeach = matchesGroup(query, "beach");
  const isTemple = matchesGroup(query, "temple");
  const isCountry = matchesGroup(query, "country");

  // Category keywords take priority: beach → beaches, temple → temples,
  // country → every country's cities.
  if (isBeach || isTemple || isCountry) {
    const items = [];
    let label = "";

    if (isBeach) {
      items.push(...allBeaches(data));
      label = "beach";
    }
    if (isTemple) {
      items.push(...allTemples(data));
      label = label ? `${label} & temple` : "temple";
    }
    if (isCountry) {
      items.push(...allCountries(data));
      label = label ? `${label} & country` : "country";
    }

    return { items, label };
  }

  // Otherwise try to match a country, city, beach or temple by name.
  const named = findDestinations(data, query);
  if (named.length) {
    return { items: named, label: rawQuery.trim() };
  }

  return { items: [], label: rawQuery.trim() };
}

/* ------------------------------------------------------------
   Task 8 — Render recommendations in a grid
   ------------------------------------------------------------ */
async function runSearch(rawQuery) {
  const data = await ensureData();
  if (!data) return;

  const query = String(rawQuery).trim();
  if (!query) return;

  const { items, label } = findRecommendations(data, query);

  const section = document.getElementById("results");
  const grid = document.getElementById("results-grid");
  const title = document.getElementById("results-title");
  const count = document.getElementById("results-count");
  const noResults = document.getElementById("no-results");
  const noResultsText = document.getElementById("no-results-text");

  grid.innerHTML = "";
  section.hidden = false;

  title.textContent = `Recommendations for “${label}”`;

  if (!items.length) {
    count.textContent = "";
    noResultsText.textContent = "No matches found.";
    noResults.style.borderColor = "";
    noResults.hidden = false;
    stopClocks();
  } else {
    noResults.hidden = true;
    count.innerHTML = "";
    const strong = document.createElement("strong");
    strong.textContent = String(items.length);
    count.append(strong, document.createTextNode(items.length === 1 ? " place to explore" : " places to explore"));

    items.forEach((item, index) => {
      grid.appendChild(createCard(item, index));
    });

    startClocks();
  }

  // Move the user to the results (after the layout is ready)
  requestAnimationFrame(() => {
    section.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function createCard(item, index) {
  const article = document.createElement("article");
  article.className = "result-card";
  article.style.animationDelay = `${Math.min(index, 8) * 60}ms`;

  const media = document.createElement("div");
  media.className = "result-media";

  const image = document.createElement("img");
  image.src = item.imageUrl;
  image.alt = item.name;
  image.loading = index < 3 ? "eager" : "lazy";
  image.addEventListener("error", () => {
    image.classList.add("image-error");
    image.alt = `Image unavailable for ${item.name}`;
  });
  media.appendChild(image);

  if (item.badge) {
    const badge = document.createElement("span");
    badge.className = "result-badge" + (item.category === "temple" ? " badge-temple" : "");
    badge.textContent = item.badge;
    media.appendChild(badge);
  }

  const body = document.createElement("div");
  body.className = "result-body";

  const heading = document.createElement("h3");
  heading.textContent = item.name;

  const description = document.createElement("p");
  description.textContent = item.description;

  body.append(heading, description);

  // Task 10 (optional): current local time for country recommendations
  if (item.timeZone) {
    const timeRow = document.createElement("p");
    timeRow.className = "result-time";

    const label = document.createElement("span");
    label.textContent = `Local time in ${item.timeZoneLabel}:`;

    const clock = document.createElement("span");
    clock.className = "clock";
    clock.dataset.timezone = item.timeZone;
    clock.textContent = formatTime(item.timeZone);

    timeRow.append(label, clock);
    body.appendChild(timeRow);
  }

  article.append(media, body);
  return article;
}

/* ------------------------------------------------------------
   Task 9 — Clear / Reset results
   ------------------------------------------------------------ */
function clearResults() {
  const input = document.getElementById("search-input");
  const section = document.getElementById("results");
  const grid = document.getElementById("results-grid");
  const noResults = document.getElementById("no-results");
  const count = document.getElementById("results-count");
  const title = document.getElementById("results-title");

  if (input) {
    input.value = "";
    input.focus();
  }

  if (grid) grid.innerHTML = "";
  if (noResults) noResults.hidden = true;
  if (count) count.textContent = "";
  if (title) title.textContent = "Recommendations";
  if (section) section.hidden = true;

  stopClocks();

  const home = document.getElementById("home");
  if (home && !home.hidden) {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function showResultsMessage(message, isError = false) {
  const section = document.getElementById("results");
  const grid = document.getElementById("results-grid");
  const noResults = document.getElementById("no-results");
  const noResultsText = document.getElementById("no-results-text");

  if (!section || !noResults || !noResultsText) return;

  section.hidden = false;
  grid.innerHTML = "";
  noResults.hidden = false;
  noResultsText.textContent = message;
  noResults.style.borderColor = isError ? "#d94f3d" : "";

  document.getElementById("results-title").textContent = "Recommendations";
  document.getElementById("results-count").textContent = "";
  stopClocks();

  requestAnimationFrame(() => {
    section.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

/* ------------------------------------------------------------
   Task 10 (optional) — Local time in recommended countries
   ------------------------------------------------------------ */
function formatTime(timeZone) {
  try {
    return new Date().toLocaleTimeString("en-US", {
      timeZone,
      hour12: true,
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit"
    });
  } catch (error) {
    return "—";
  }
}

function updateClocks() {
  document.querySelectorAll(".clock[data-timezone]").forEach((clock) => {
    clock.textContent = formatTime(clock.dataset.timezone);
  });
}

function startClocks() {
  stopClocks();
  if (!document.querySelector(".clock[data-timezone]")) return;
  updateClocks();
  clockTimer = setInterval(updateClocks, 1000);
}

function stopClocks() {
  if (clockTimer) {
    clearInterval(clockTimer);
    clockTimer = null;
  }
}

/* ------------------------------------------------------------
   Task 5 — Contact form validation
   ------------------------------------------------------------ */
function setupContactForm() {
  const form = document.getElementById("contact-form");
  if (!form) return;

  const success = document.getElementById("form-success");

  const fields = {
    name: {
      input: document.getElementById("name"),
      error: document.getElementById("name-error"),
      validate: (value) => (value.trim().length >= 2 ? "" : "Please enter your full name (at least 2 characters).")
    },
    email: {
      input: document.getElementById("email"),
      error: document.getElementById("email-error"),
      validate: (value) =>
        /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim()) ? "" : "Please enter a valid email address."
    },
    message: {
      input: document.getElementById("message"),
      error: document.getElementById("message-error"),
      validate: (value) => (value.trim().length >= 10 ? "" : "Please write a message of at least 10 characters.")
    }
  };

  const validateField = (field) => {
    const message = field.validate(field.input.value);
    field.error.textContent = message;
    field.input.setAttribute("aria-invalid", message ? "true" : "false");
    field.input.closest(".field").classList.toggle("has-error", Boolean(message));
    return !message;
  };

  Object.values(fields).forEach((field) => {
    field.input.addEventListener("input", () => {
      if (field.input.closest(".field").classList.contains("has-error")) {
        validateField(field);
      }
      success.hidden = true;
    });
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const results = Object.values(fields).map(validateField);
    const isValid = results.every(Boolean);

    if (!isValid) {
      const firstInvalid = Object.values(fields).find((field) => !field.validate(field.input.value));
      if (firstInvalid) firstInvalid.input.focus();
      success.hidden = true;
      return;
    }

    console.log("Contact form submitted:", {
      name: fields.name.input.value.trim(),
      email: fields.email.input.value.trim(),
      message: fields.message.input.value.trim()
    });

    form.reset();
    Object.values(fields).forEach((field) => {
      field.error.textContent = "";
      field.input.removeAttribute("aria-invalid");
      field.input.closest(".field").classList.remove("has-error");
    });

    success.hidden = false;
    success.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

/* ------------------------------------------------------------
   Small utilities
   ------------------------------------------------------------ */
function setFooterYear() {
  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());
}
