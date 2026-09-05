/* ==========================================================================
   AE DICREAT - Wedding Invitation Link Generator Engine
   ========================================================================== */

// Application State
let appState = {
  baseUrl: "https://aedicreat-wedding.com",
  generatedItems: [], // Array of { id, no, rawName, slug, fullUrl, copied: false }
  copiedCount: 0
};

// Sample Guest Names Preset
const SAMPLE_GUEST_NAMES = [
  "Budi Santoso",
  "Andi & Sinta",
  "Keluarga Bapak Ahmad",
  "Ibu Siti",
  "Rizky & Amanda",
  "Budi Santoso", // Intentional duplicate to demonstrate numbering
  "Dr. Hendra Wijaya, Sp.PD",
  "Keluarga Besar Oetomo",
  "Tante Maya & Om Roy",
  "Dewi Kusumawati"
];

// DOM Elements Initialization
document.addEventListener("DOMContentLoaded", () => {
  initEventListeners();
  loadSavedState();
});

function initEventListeners() {
  const guestTextarea = document.getElementById("guest-names");
  const baseUrlInput = document.getElementById("base-url");

  if (guestTextarea) {
    guestTextarea.addEventListener("input", updateGuestCounter);
  }

  if (baseUrlInput) {
    baseUrlInput.addEventListener("blur", sanitizeBaseUrlInput);
  }

  // Update initial counter
  updateGuestCounter();
}

/**
 * Clean & Format Base URL (Remove trailing slash)
 */
function sanitizeBaseUrlInput() {
  const input = document.getElementById("base-url");
  if (!input) return "";
  
  let val = input.value.trim();
  if (val.endsWith("/")) {
    val = val.slice(0, -1);
  }
  input.value = val;
  return val;
}

/**
 * Live guest name counter & limit validator (Max 1000)
 */
function updateGuestCounter() {
  const textarea = document.getElementById("guest-names");
  const badge = document.getElementById("name-count-badge");
  const errorMsg = document.getElementById("name-error-msg");
  const generateBtn = document.getElementById("btn-generate");

  if (!textarea || !badge) return;

  const names = parseGuestNamesText(textarea.value);
  const count = names.length;

  badge.textContent = `${count} / 1000 tamu`;

  if (count > 1000) {
    badge.classList.add("limit-exceeded");
    if (errorMsg) errorMsg.style.display = "inline-block";
    if (generateBtn) generateBtn.disabled = true;
  } else {
    badge.classList.remove("limit-exceeded");
    if (errorMsg) errorMsg.style.display = "none";
    if (generateBtn) generateBtn.disabled = false;
  }
}

/**
 * Helper to split textarea text into array of clean non-empty lines
 */
function parseGuestNamesText(text) {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0);
}

/**
 * Load Sample Preset Data
 */
function loadSampleData() {
  const textarea = document.getElementById("guest-names");
  if (textarea) {
    textarea.value = SAMPLE_GUEST_NAMES.join("\n");
    updateGuestCounter();
    showToast("Contoh nama tamu berhasil dimuat!", "success");
  }
}

/**
 * Generate URL-Friendly Slug
 * - Lowercase
 * - Spaces replaced with '-'
 * - Special characters cleaned, '&' converted cleanly to 'and' or removed safely
 * - Indonesian characters supported
 */
function createSlug(name) {
  if (!name) return "";
  
  let slug = name.toLowerCase().trim();
  
  // Replace '&' with space then clean
  slug = slug.replace(/&/g, " ");
  
  // Remove unwanted punctuation except letters, numbers, spaces, and hyphens
  // Keeps Indonesian characters intact
  slug = slug.replace(/[^\w\s-]/gi, "");
  
  // Replace multiple spaces or underscores with a single hyphen
  slug = slug.replace(/[\s_]+/g, "-");
  
  // Strip leading or trailing hyphens
  slug = slug.replace(/^-+|-+$/g, "");
  
  return slug || "tamu-undangan";
}

/**
 * MAIN GENERATE LINKS FUNCTION
 */
function generateLinks() {
  const baseUrlInput = document.getElementById("base-url");
  const textarea = document.getElementById("guest-names");
  const generateBtn = document.getElementById("btn-generate");

  // Validate Base URL
  let baseUrl = sanitizeBaseUrlInput();
  if (!baseUrl) {
    showToast("URL Dasar Undangan wajib diisi!", "error");
    baseUrlInput.focus();
    return;
  }

  try {
    new URL(baseUrl);
  } catch (e) {
    showToast("Format URL Dasar tidak valid! Harap masukkan URL lengkap (e.g. https://aedicreat-wedding.com)", "error");
    baseUrlInput.focus();
    return;
  }

  // Parse Names
  const rawNames = parseGuestNamesText(textarea.value);
  if (rawNames.length === 0) {
    showToast("Harap masukkan setidaknya satu nama tamu undangan!", "error");
    textarea.focus();
    return;
  }

  if (rawNames.length > 1000) {
    showToast("Maksimal 1000 nama tamu. Harap kurangi jumlah nama.", "error");
    return;
  }

  // Loading State
  generateBtn.disabled = true;
  generateBtn.innerHTML = `<div class="spinner"></div> Memproses ${rawNames.length} Links...`;

  setTimeout(() => {
    // Slug & URL Mapping with Duplicate Numbering Handling
    const slugMap = new Map(); // slug -> count
    const items = [];

    rawNames.forEach((rawName, index) => {
      let baseSlug = createSlug(rawName);
      let finalSlug = baseSlug;

      if (slugMap.has(baseSlug)) {
        const count = slugMap.get(baseSlug) + 1;
        slugMap.set(baseSlug, count);
        finalSlug = `${baseSlug}-${count}`;
      } else {
        slugMap.set(baseSlug, 1);
      }

      const fullUrl = `${baseUrl}?to=${finalSlug}`;

      items.push({
        id: `item-${Date.now()}-${index}`,
        no: index + 1,
        rawName: rawName,
        slug: finalSlug,
        fullUrl: fullUrl,
        copied: false
      });
    });

    appState.baseUrl = baseUrl;
    appState.generatedItems = items;
    appState.copiedCount = 0;

    // Save to LocalStorage
    saveStateToLocalStorage();

    // Render Table & UI
    renderResultsTable();
    updateStatsCounters();

    // Show Results Section
    const resultsSection = document.getElementById("results-section");
    if (resultsSection) {
      resultsSection.style.display = "block";
      resultsSection.scrollIntoView({ behavior: "smooth" });
    }

    // Reset Button
    generateBtn.disabled = false;
    generateBtn.innerHTML = `<i class="fa-solid fa-bolt"></i> Generate Links`;

    showToast(`Berhasil me-generate ${items.length} link undangan personal!`, "success");
  }, 300);
}

/**
 * Render Table Rows
 */
function renderResultsTable(filterQuery = "") {
  const tbody = document.getElementById("links-table-body");
  const noResults = document.getElementById("no-search-results");
  if (!tbody) return;

  tbody.innerHTML = "";

  const query = filterQuery.toLowerCase().trim();
  const filtered = appState.generatedItems.filter(item => {
    return item.rawName.toLowerCase().includes(query) || 
           item.fullUrl.toLowerCase().includes(query) ||
           item.slug.toLowerCase().includes(query);
  });

  if (filtered.length === 0) {
    if (noResults) noResults.style.display = "block";
    return;
  } else {
    if (noResults) noResults.style.display = "none";
  }

  filtered.forEach(item => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td class="col-no">${item.no}</td>
      <td class="col-name">${escapeHtml(item.rawName)}</td>
      <td class="col-link">
        <a href="${escapeHtml(item.fullUrl)}" target="_blank" class="link-url-text" title="${escapeHtml(item.fullUrl)}">
          ${escapeHtml(item.fullUrl)}
        </a>
      </td>
      <td class="col-action">
        <div class="action-group">
          <button 
            id="copy-btn-${item.id}"
            class="btn-copy-link ${item.copied ? 'copied' : ''}" 
            onclick="copySingleLink('${item.id}', '${escapeJsString(item.fullUrl)}')"
          >
            <i class="fa-regular ${item.copied ? 'fa-circle-check' : 'fa-copy'}"></i>
            ${item.copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

/**
 * Filter results via search box
 */
function filterResults() {
  const searchInput = document.getElementById("search-input");
  const query = searchInput ? searchInput.value : "";
  renderResultsTable(query);
}

/**
 * Copy Single Link to Clipboard
 */
function copySingleLink(itemId, url) {
  navigator.clipboard.writeText(url).then(() => {
    const btn = document.getElementById(`copy-btn-${itemId}`);
    const item = appState.generatedItems.find(i => i.id === itemId);

    if (item && !item.copied) {
      item.copied = true;
      appState.copiedCount += 1;
      updateStatsCounters();
      saveStateToLocalStorage();
    }

    if (btn) {
      btn.classList.add("copied");
      btn.innerHTML = `<i class="fa-solid fa-circle-check"></i> Copied!`;
    }

    showToast("Link undangan berhasil dicopy!", "success");

    setTimeout(() => {
      if (btn) {
        btn.classList.remove("copied");
        btn.innerHTML = `<i class="fa-regular fa-copy"></i> Copy`;
      }
    }, 2000);
  }).catch(err => {
    showToast("Gagal menyalin link ke clipboard.", "error");
  });
}

/**
 * Copy All Links to Clipboard
 */
function copyAllLinks() {
  if (appState.generatedItems.length === 0) {
    showToast("Tidak ada link untuk dicopy.", "error");
    return;
  }

  const allUrls = appState.generatedItems.map(item => item.fullUrl).join(" ");
  const copyAllBtn = document.getElementById("btn-copy-all");

  navigator.clipboard.writeText(allUrls).then(() => {
    appState.generatedItems.forEach(item => item.copied = true);
    appState.copiedCount = appState.generatedItems.length;

    updateStatsCounters();
    renderResultsTable();
    saveStateToLocalStorage();

    if (copyAllBtn) {
      copyAllBtn.classList.add("copied");
      copyAllBtn.style.borderColor = "var(--success)";
      copyAllBtn.style.color = "var(--success)";
      copyAllBtn.innerHTML = `<i class="fa-solid fa-circle-check"></i> All links copied!`;
    }

    showToast("All links copied!", "success");

    // Automatically revert feedback state after 2 seconds
    setTimeout(() => {
      if (copyAllBtn) {
        copyAllBtn.classList.remove("copied");
        copyAllBtn.style.borderColor = "";
        copyAllBtn.style.color = "";
        copyAllBtn.innerHTML = `<i class="fa-regular fa-copy"></i> Copy All`;
      }
      appState.generatedItems.forEach(item => item.copied = false);
      renderResultsTable();
    }, 2000);
  }).catch(err => {
    showToast("Gagal menyalin semua link.", "error");
  });
}

/**
 * Export TXT Functionality
 * Downloads Download.txt containing guest names and their personalized URLs
 */
function exportTXT() {
  if (appState.generatedItems.length === 0) {
    showToast("Tidak ada data untuk diexport.", "error");
    return;
  }

  let txtContent = "==================================================\n";
  txtContent += "AE DICREAT - DAFTAR LINK UNDANGAN PERNIKAHAN\n";
  txtContent += "==================================================\n\n";

  appState.generatedItems.forEach(item => {
    txtContent += `${item.no}. ${item.rawName}\n   ${item.fullUrl}\n\n`;
  });

  const blob = new Blob(["\uFEFF" + txtContent], { type: "text/plain;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", "Download.txt");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast("File Download.txt berhasil diunduh!", "success");
}

/**
 * Stats Counters Update
 */
function updateStatsCounters() {
  const statTotal = document.getElementById("stat-total");
  const statSuccess = document.getElementById("stat-success");
  const statCopied = document.getElementById("stat-copied");

  if (statTotal) statTotal.textContent = appState.generatedItems.length;
  if (statSuccess) statSuccess.textContent = appState.generatedItems.length;
  if (statCopied) statCopied.textContent = appState.copiedCount;
}

/**
 * Modal Handling for Clear / Reset Data
 */
function openResetModal() {
  const modal = document.getElementById("reset-modal");
  if (modal) modal.classList.add("active");
}

function closeResetModal() {
  const modal = document.getElementById("reset-modal");
  if (modal) modal.classList.remove("active");
}

function confirmResetData() {
  closeResetModal();

  appState.generatedItems = [];
  appState.copiedCount = 0;
  localStorage.removeItem("aedicreat_wedding_state");

  const tbody = document.getElementById("links-table-body");
  if (tbody) tbody.innerHTML = "";

  const resultsSection = document.getElementById("results-section");
  if (resultsSection) resultsSection.style.display = "none";

  const guestTextarea = document.getElementById("guest-names");
  if (guestTextarea) guestTextarea.value = "";

  updateGuestCounter();
  updateStatsCounters();

  showToast("Seluruh data berhasil dihapus.", "success");
}

/**
 * Toast Notification Popup System
 */
function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  
  const icon = type === "success" ? "fa-circle-check" : "fa-triangle-exclamation";
  toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${escapeHtml(message)}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(20px)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }, 3500);
}

/**
 * LocalStorage Persistence
 */
function saveStateToLocalStorage() {
  try {
    localStorage.setItem("aedicreat_wedding_state", JSON.stringify(appState));
  } catch (e) {
    console.error("Failed to save state to LocalStorage", e);
  }
}

function loadSavedState() {
  try {
    const saved = localStorage.getItem("aedicreat_wedding_state");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && Array.isArray(parsed.generatedItems) && parsed.generatedItems.length > 0) {
        appState = parsed;
        
        const baseUrlInput = document.getElementById("base-url");
        if (baseUrlInput && appState.baseUrl) baseUrlInput.value = appState.baseUrl;

        renderResultsTable();
        updateStatsCounters();

        const resultsSection = document.getElementById("results-section");
        if (resultsSection) resultsSection.style.display = "block";
      }
    }
  } catch (e) {
    console.error("Failed to load saved state", e);
  }
}

// Utility: Escape HTML
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Utility: Escape JS Strings in inline onclick attributes
function escapeJsString(str) {
  if (!str) return "";
  return String(str).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}
