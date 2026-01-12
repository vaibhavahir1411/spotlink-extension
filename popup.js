// ========== BROWSER COMPATIBILITY LAYER ==========
// Works with both Chrome and Firefox
const ext = typeof browser !== "undefined" ? browser : chrome;

// ========== CONSTANTS & API ==========
const API_BASE = "https://spotlink.cc/api";

// ========== VARIABLES: DOM - Shorten Panel ==========
const createBtn = document.getElementById("createBtn");
const status = document.getElementById("status");
const resultBox = document.querySelector(".result");
const shortUrlInput = document.getElementById("shortUrl");
const domainSelect = document.getElementById("domain");
const secureCheckbox = document.getElementById("secure");
const passwordGroup = document.getElementById("passwordGroup");
const collectionSelect = document.getElementById("collectionSelect");
const newCollectionBtn = document.getElementById("newCollectionBtn");
const newEditCollectionBtn = document.getElementById("newEditCollectionBtn");
const collectionInputGroup = collectionSelect.closest(".input-group");

// ========== VARIABLES: DOM - Tab Navigation ==========
const shortenTabBtn = document.getElementById("shortenTabBtn");
const myUrlsTabBtn = document.getElementById("myUrlsTabBtn");
const shortenPanel = document.getElementById("shortenPanel");
const myUrlsPanel = document.getElementById("myUrlsPanel");
const tabsContainer = document.querySelector(".tabs");

// ========== VARIABLES: DOM - Account Menu ==========
const accountBtn = document.getElementById("accountBtn");
const accountMenu = document.getElementById("accountMenu");
const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");
const logoutBtn = document.getElementById("logoutBtn");
const guestMenu = document.getElementById("guestMenu");
const userMenu = document.getElementById("userMenu");
const menuName = document.getElementById("menuName");
const menuEmail = document.getElementById("menuEmail");

// ========== VARIABLES: DOM - Login Modal ========== 
const loginModal = document.getElementById("loginModal");
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const loginStatus = document.getElementById("loginStatus");

// ========== VARIABLES: DOM - My URLs Panel ==========
const urlsList = document.getElementById("urlsList");
const urlsStatus = document.getElementById("urlsStatus");
const urlSearch = document.getElementById("urlSearch");

// ========== VARIABLES: DOM - URL Cards & Actions ==========
const collectionFilterBtn = document.getElementById("collectionFilterBtn");
const collectionDropdown = document.getElementById("collectionDropdown");
const collectionsList = document.getElementById("collectionsList");
const editCollectionSelect = document.getElementById("editCollectionSelect");

// ========== VARIABLES: State ==========
let editingUrlId = null;
let allUrls = [];
let allCollections = [];
let defaultCollectionId = null;

// ========== CONFIRMATION DIALOG FUNCTION ==========
function showConfirmDialog(title, message, onConfirm, onCancel = () => {}) {
  const dialog = document.createElement("div");
  dialog.className = "confirm-dialog";
  dialog.innerHTML = `
    <div class="confirm-dialog-box">
      <div class="confirm-dialog-title">${title}</div>
      <div class="confirm-dialog-message">${message}</div>
      <div class="confirm-dialog-actions">
        <button class="confirm-dialog-confirm">Yes, Delete</button>
        <button class="confirm-dialog-cancel">Cancel</button>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);

  const confirmBtn = dialog.querySelector(".confirm-dialog-confirm");
  const cancelBtn = dialog.querySelector(".confirm-dialog-cancel");

  confirmBtn.onclick = () => {
    dialog.remove();
    onConfirm();
  };

  cancelBtn.onclick = () => {
    dialog.remove();
    onCancel();
  };

  dialog.onclick = (e) => {
    if (e.target === dialog) {
      dialog.remove();
      onCancel();
    }
  };
}

// ========== COLLECTION INPUT DIALOG FUNCTION ==========
function showCollectionInputDialog(onConfirm, onCancel = () => {}) {
  const dialog = document.createElement("div");
  dialog.className = "collection-input-dialog";
  dialog.innerHTML = `
    <div class="collection-input-dialog-box">
      <div class="collection-input-dialog-title">Create New Collection</div>
      <input type="text" id="collectionNameInput" placeholder="Enter collection name" autofocus />
      <div class="collection-input-dialog-actions">
        <button class="collection-input-cancel">Cancel</button>
        <button class="collection-input-confirm">Create</button>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);

  const input = dialog.querySelector("#collectionNameInput");
  const confirmBtn = dialog.querySelector(".collection-input-confirm");
  const cancelBtn = dialog.querySelector(".collection-input-cancel");

  const handleConfirm = () => {
    const name = input.value.trim();
    if (!name) {
      input.focus();
      return;
    }
    dialog.remove();
    onConfirm(name);
  };

  const handleCancel = () => {
    dialog.remove();
    onCancel();
  };

  confirmBtn.onclick = handleConfirm;
  cancelBtn.onclick = handleCancel;

  input.onkeypress = (e) => {
    if (e.key === "Enter") {
      handleConfirm();
    }
  };

  dialog.onclick = (e) => {
    if (e.target === dialog) {
      handleCancel();
    }
  };

  input.focus();
}

// ========== INITIALIZATION ==========
document.addEventListener("DOMContentLoaded", async () => {
  const tabs = await ext.tabs.query({ active: true, currentWindow: true });
  if (tabs[0]?.url && !tabs[0].url.startsWith("chrome")) {
    document.getElementById("longUrl").value = tabs[0].url;
  }

  fetchDomains();
  
  // Hide collection field by default (for guest users)
  collectionInputGroup.classList.add("hidden");
  // Hide tabs container for guest (only Shorten visible)
  if (tabsContainer) {
    tabsContainer.classList.add("hidden");
  }

  const { user } = await ext.storage.local.get(["user"]);

  if (user) {
    setLoggedInUI(user);
    loadCollectionsForSelect();
  } else {
    await ext.storage.local.remove(["user", "token"]);
  }
});

// ========== SHORTEN PANEL: Domain & Security ==========
async function fetchDomains() {
  try {
    const res = await fetch(`${API_BASE}/domains`, {
      credentials: "include",
      headers: { "Accept": "application/json" }
    });

    const data = await res.json();

    if (!data.status) throw new Error();

    domainSelect.innerHTML = `<option value="">Select domain</option>`;
    data.data.forEach(d => {
      const opt = document.createElement("option");
      opt.value = d.id;
      opt.textContent = d.id;
      domainSelect.appendChild(opt);
    });

  } catch {
    domainSelect.innerHTML = `<option value="">Failed to load domains</option>`;
  }
}

secureCheckbox.addEventListener("change", () => {
  passwordGroup.classList.toggle("hidden", !secureCheckbox.checked);
});

// ========== SHORTEN PANEL: New Collection Button ==========
newCollectionBtn.addEventListener("click", async () => {
  showCollectionInputDialog(async (collectionName) => {
    const { token } = await ext.storage.local.get("token");
    if (!token) {
      showStatus("Please login first", true);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/collections`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({ name: collectionName })
      });

      const data = await res.json();

      if (!data.status) {
        showStatus(data.message || "Failed to create collection", true);
        return;
      }

      showStatus("Collection created successfully");
      await loadCollectionsForSelect();
      collectionSelect.value = data.data.id;

    } catch {
      showStatus("Failed to create collection", true);
    }
  });
});

newEditCollectionBtn.addEventListener("click", async () => {
  showCollectionInputDialog(async (collectionName) => {
    const { token } = await ext.storage.local.get("token");
    if (!token) {
      showStatus("Please login first", true);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/collections`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({ name: collectionName })
      });

      const data = await res.json();

      if (!data.status) {
        showStatus(data.message || "Failed to create collection", true);
        return;
      }

      showStatus("Collection created successfully");
      await loadCollectionsForSelect();
      editCollectionSelect.value = data.data.id;

    } catch {
      showStatus("Failed to create collection", true);
    }
  });
});

// ========== SHORTEN PANEL: Collection Select ==========
async function loadCollectionsForSelect() {
  const { token } = await ext.storage.local.get("token");

  if (!token) {
    collectionSelect.innerHTML = `<option value="">Login to use collections</option>`;
    editCollectionSelect.innerHTML = `<option value="">Login to use collections</option>`;
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/collections`, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json"
      }
    });

    const data = await res.json();

    collectionSelect.innerHTML = `<option value="">Select a collection (optional)</option>`;

    editCollectionSelect.innerHTML = `<option value="">Select a collection (optional)</option>`;

    if (data.status && data.data) {
      allCollections = data.data;
      // Find default collection
      const defaultCollection = data.data.find(c => c.is_default || c.name === "Default Collection");
      if (defaultCollection) {
        defaultCollectionId = defaultCollection.id;
      }
      data.data.forEach(collection => {
        const option = document.createElement("option");
        option.value = collection.id;
        option.textContent = collection.name;
        collectionSelect.appendChild(option);

        const editOption = document.createElement("option");
        editOption.value = collection.id;
        editOption.textContent = collection.name;
        editCollectionSelect.appendChild(editOption);
      });
    }
  } catch {
    collectionSelect.innerHTML = `<option value="">Failed to load collections</option>`;
    editCollectionSelect.innerHTML = `<option value="">Failed to load collections</option>`;
  }
}

collectionSelect.addEventListener("change", async (e) => {
  if (e.target.value === "__create_new__") {
    showCollectionInputDialog(async (collectionName) => {
      const { token } = await ext.storage.local.get("token");
      if (!token) {
        showStatus("Please login first", true);
        collectionSelect.value = "";
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/collections`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify({ name: collectionName })
        });

        const data = await res.json();

        if (!data.status) {
          showStatus(data.message || "Failed to create collection", true);
          collectionSelect.value = "";
          return;
        }

        showStatus("Collection created successfully");
        await loadCollectionsForSelect();
        collectionSelect.value = data.data.id;

      } catch {
        showStatus("Failed to create collection", true);
        collectionSelect.value = "";
      }
    }, () => {
      collectionSelect.value = "";
    });
  }
});

editCollectionSelect.addEventListener("change", async (e) => {
  if (e.target.value === "__create_new__") {
    showCollectionInputDialog(async (collectionName) => {
      const { token } = await ext.storage.local.get("token");
      if (!token) {
        showStatus("Please login first", true);
        editCollectionSelect.value = "";
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/collections`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify({ name: collectionName })
        });

        const data = await res.json();

        if (!data.status) {
          showStatus(data.message || "Failed to create collection", true);
          editCollectionSelect.value = "";
          return;
        }

        showStatus("Collection created successfully");
        await loadCollectionsForSelect();
        editCollectionSelect.value = data.data.id;

      } catch {
        showStatus("Failed to create collection", true);
        editCollectionSelect.value = "";
      }
    }, () => {
      editCollectionSelect.value = "";
    });
  }
});// ========== SHORTEN PANEL: Create Button ==========
createBtn.onclick = async () => {
  const { token } = await ext.storage.local.get("token");
  let destination = document.getElementById("longUrl").value.trim();
  const title = document.getElementById("title").value.trim() || "Short Link";
  const alias = document.getElementById("customAlias").value.trim();
  const domain = domainSelect.value;
  const secure = secureCheckbox.checked ? 1 : 0;
  const password = document.getElementById("password").value;
  const collectionId = collectionSelect.value;

  if (!destination) {
    showStatus("Please enter destination URL", true);
    return;
  }

  if (!domain) {
    showStatus("Please select a domain", true);
    return;
  }

  if (!alias) {
    showStatus("Please enter a custom alias", true);
    return;
  }

  if (secure && !password) {
    showStatus("Please enter password", true);
    return;
  }

  if (!/^https?:\/\//i.test(destination)) {
    destination = "https://" + destination;
  }

  const shortedUrl = `https://${domain}/${alias}`;

  createBtn.disabled = true;
  createBtn.textContent = "Creating...";
  resultBox.classList.add("hidden");

  const headers = {
    "Content-Type": "application/json",
    "Accept": "application/json"
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const requestBody = {
    title,
    domain_id: domain,
    key: alias,
    shorted_url: shortedUrl,
    destination,
    secure,
    password: secure ? password : "",
    active: true
  };

  // Add collection_id - use default collection if not selected
  const selectedCollectionId = collectionId || defaultCollectionId;
  if (selectedCollectionId && selectedCollectionId !== "__create_new__") {
    requestBody.collection_id = selectedCollectionId;
  }

  try {
    const res = await fetch(`${API_BASE}/short-urls`, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody)
    });

    const data = await res.json();

    if (!data.status) {
      throw new Error(data.message || "Server Error");
    }

    shortUrlInput.value = data.data.shorted_url;
    try {
      await navigator.clipboard.writeText(data.data.shorted_url);
      showStatus("Short URL created and copied");
    } catch {
      showStatus("Short URL created (copy failed)");
    }
    resultBox.classList.remove("hidden");
    resultBox.scrollIntoView({ behavior: "smooth", block: "center" });

  } catch (err) {
    showStatus(err.message || "Server Error", true);
  } finally {
    createBtn.disabled = false;
    createBtn.textContent = "Create Short URL";
  }
};

document.getElementById("copyBtn").onclick = () => {
  shortUrlInput.select();
  document.execCommand("copy");
  showStatus("Copied");
};

// ========== UTILITY: Status Message ==========
function showStatus(msg, error = false) {
  status.textContent = msg;
  status.style.color = error ? "#dc2626" : "#111827";
  status.classList.remove("hidden");
  status.style.background = error ? "#FEE2E2" : "#FEF3C7";
  status.style.border = error ? "1px solid #FECACA" : "1px solid #FDE68A";
  status.style.padding = "10px 12px";
  status.style.borderRadius = "10px";
  status.style.fontWeight = "600";
  setTimeout(() => {
    status.textContent = "";
    status.style.background = "transparent";
    status.style.border = "none";
    status.classList.add("hidden");
  }, 2500);
}

// ========== TAB SWITCHING ==========
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t =>
      t.classList.remove("active")
    );

    document.querySelectorAll(".tab-content").forEach(c =>
      c.classList.add("hidden")
    );

    tab.classList.add("active");

    const targetId = tab.dataset.tab;
    document.getElementById(targetId).classList.remove("hidden");
  });
});

shortenTabBtn.onclick = () => {
  shortenTabBtn.classList.add("active");
  myUrlsTabBtn.classList.remove("active");

  shortenPanel.classList.remove("hidden");
  myUrlsPanel.classList.add("hidden");
};

myUrlsTabBtn.onclick = () => {
  shortenTabBtn.classList.remove("active");
  myUrlsTabBtn.classList.add("active");

  shortenPanel.classList.add("hidden");
  myUrlsPanel.classList.remove("hidden");

  urlSearch.value = "";
  loadMyUrls();
};

// ========== ACCOUNT MENU ==========
accountBtn.onclick = () => {
  accountMenu.classList.toggle("hidden");
};

// Close account menu when clicking outside (on modal background)
accountMenu.onclick = (e) => {
  if (e.target === accountMenu) {
    accountMenu.classList.add("hidden");
  }
};

// ========== LOGIN & REGISTER ==========
registerBtn.onclick = () => {
  ext.tabs.create({ url: "https://etus.link/admin/register" });
};

loginBtn.onclick = () => {
  accountMenu.classList.add("hidden");
  loginEmail.value = "";
  loginPassword.value = "";
  loginStatus.textContent = "";
  loginModal.classList.remove("hidden");
};

document.getElementById("cancelLoginBtn").onclick = () => {
  loginModal.classList.add("hidden");
};

document.getElementById("confirmLoginBtn").onclick = async () => {
  const email = loginEmail.value.trim();
  const password = loginPassword.value.trim();

  if (!email || !password) {
    loginStatus.textContent = "Email and password required";
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (!data.status) {
      loginStatus.textContent = "Invalid email or password";
      return;
    }

    await ext.storage.local.set({
      token: data.data.access_token,
      user: data.data
    });

    setLoggedInUI(data.data);

    loginModal.classList.add("hidden");
    document.getElementById("editModal").classList.add("hidden");
    accountMenu.classList.add("hidden");

    showStatus("Logged in successfully");

    // Show collection field when logged in
    collectionInputGroup.classList.remove("hidden");
    loadCollectionsForSelect();

  } catch {
    loginStatus.textContent = "Login failed";
  }
};

// ========== LOGOUT ==========
logoutBtn.onclick = async () => {
  const { token } = await ext.storage.local.get("token");

  await fetch(`${API_BASE}/auth/logout`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/json"
    }
  });

  await ext.storage.local.clear();

  location.reload();
};

// ========== ACCOUNT UI UPDATE ==========
function setLoggedInUI(user) {
  guestMenu.classList.add("hidden");
  userMenu.classList.remove("hidden");

  const firstChar = user.name.charAt(0).toUpperCase();

  document.getElementById("avatar").textContent = firstChar;
  document.getElementById("avatarLarge").textContent = firstChar;

  menuName.textContent = user.name;
  menuEmail.textContent = user.email;

  document.getElementById("myUrlsTabBtn").classList.remove("hidden");

  // Show collection field when logged in
  collectionInputGroup.classList.remove("hidden");
  if (tabsContainer) {
    tabsContainer.classList.remove("hidden");
  }
}

// ========== MY URLS PANEL: Load & Render ==========
async function loadMyUrls() {
  urlsList.innerHTML = "";
  urlsStatus.textContent = "Loading your links...";

  const { token } = await ext.storage.local.get("token");

  if (!token) {
    urlsStatus.textContent = "Please login to see your links.";
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/short-urls`, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json"
      }
    });

    const data = await res.json();

    if (!data.status || !data.data.length) {
      urlsStatus.textContent = "No URLs created yet.";
      allUrls = [];
      return;
    }

    urlsStatus.textContent = "";
    allUrls = data.data;

    loadCollectionsUI();
    renderUrlCards(allUrls);

  } catch {
    urlsStatus.textContent = "Failed to load URLs.";
  }
}

async function renderUrlCards(urlsToRender) {
  urlsList.innerHTML = "";

  if (urlsToRender.length === 0) {
    urlsList.innerHTML = `<p class="no-results">No URLs found</p>`;
    return;
  }

  urlsToRender.forEach(url => {
    const card = document.createElement("div");
    card.className = "url-card";

    // Find collection name by collection_id
    let collectionName = "Default Collection";
    if (url.collection_id && allCollections.length > 0) {
      const collection = allCollections.find(c => c.id === url.collection_id);
      if (collection) {
        collectionName = collection.name;
      }
    } else if (url.collection_name) {
      collectionName = url.collection_name;
    }

    card.innerHTML = `
      <div class="url-card-top">
        <div class="url-title">${url.title || "Untitled Link"}</div>
        <i class="fa-solid ${url.secure ? "fa-lock" : "fa-unlock"} lock-icon"></i>
      </div>
      <div class="url-short">${url.shorted_url}</div>
      <div class="url-destination">${url.destination}</div>
      <div class="url-card-bottom">
        <div class="collection-info">
          <i class="fa-regular fa-folder"></i>
          <span>${collectionName}</span>
        </div>
        <div class="url-actions">
          <button class="icon-btn copy-btn" title="Copy">
            <i class="fa-regular fa-copy"></i>
          </button>
          <button class="icon-btn edit-btn" title="Edit">
            <i class="fa-regular fa-pen-to-square"></i>
          </button>
          <button class="icon-btn delete-btn" title="Delete">
            <i class="fa-regular fa-trash-can"></i>
          </button>
        </div>
      </div>
    `;

    card.querySelector(".copy-btn").onclick = () => {
      navigator.clipboard.writeText(url.shorted_url);
      showStatus("✓ Link copied to clipboard");
    };

    card.querySelector(".delete-btn").onclick = async () => {
      showConfirmDialog(
        "Delete URL",
        `Are you sure you want to delete "${url.title || url.shorted_url}"?`,
        async () => {
          try {
            const { token } = await ext.storage.local.get("token");
            const delRes = await fetch(
              `${API_BASE}/short-urls/${url.id}`,
              {
                method: "DELETE",
                headers: {
                  "Authorization": `Bearer ${token}`,
                  "Accept": "application/json"
                }
              }
            );

            const delData = await delRes.json();

            if (!delData.status) {
              showStatus(delData.message || "Delete failed", true);
              return;
            }

            card.remove();
            allUrls = allUrls.filter(u => u.id !== url.id);
            showStatus("URL deleted successfully");

          } catch {
            showStatus("Delete request failed", true);
          }
        }
      );
    };

    card.querySelector(".edit-btn").onclick = () => {
      editingUrlId = url.id;

      document.getElementById("editDestination").value = url.destination;
      document.getElementById("editTitle").value = url.title || "";
      document.getElementById("editSecure").checked = url.secure;
      document.getElementById("editPassword").value = "";
      editCollectionSelect.value = url.collection_id || "";

      // Populate disabled fields (domain and alias)
      const editDomain = document.getElementById("editDomain");
      const editAlias = document.getElementById("editAlias");
      
      // Extract domain from shorted_url (e.g., "spotlink.cc" from "https://spotlink.cc/abc")
      try {
        const urlObj = new URL(url.shorted_url);
        editDomain.innerHTML = `<option value="${urlObj.hostname}">${urlObj.hostname}</option>`;
        editDomain.value = urlObj.hostname;
        
        // Extract alias from path
        const alias = urlObj.pathname.substring(1); // Remove leading /
        editAlias.value = alias;
      } catch (e) {
        editDomain.innerHTML = `<option value="">-</option>`;
        editAlias.value = "";
      }

      document
        .getElementById("editPasswordGroup")
        .classList.toggle("hidden", !url.secure);

      document.getElementById("editModal").classList.remove("hidden");
    };

    urlsList.appendChild(card);
  });
}

// ========== SEARCH FUNCTIONALITY ==========
urlSearch.addEventListener("input", (e) => {
  const searchTerm = e.target.value.toLowerCase().trim();

  if (!searchTerm) {
    renderUrlCards(allUrls);
    return;
  }

  const filteredUrls = allUrls.filter(url => {
    const title = (url.title || "").toLowerCase();
    const shortUrl = (url.shorted_url || "").toLowerCase();

    return title.includes(searchTerm) || shortUrl.includes(searchTerm);
  });

  renderUrlCards(filteredUrls);
});

// ========== COLLECTION FILTER ==========
collectionFilterBtn.onclick = () => {
  collectionDropdown.classList.toggle("hidden");
  collectionFilterBtn.classList.toggle("active");
};

document.addEventListener("click", e => {
  if (
    !collectionFilterBtn.contains(e.target) &&
    !collectionDropdown.contains(e.target)
  ) {
    collectionDropdown.classList.add("hidden");
    collectionFilterBtn.classList.remove("active");
  }
});

async function loadCollectionsUI() {
  const { token } = await ext.storage.local.get("token");

  if (!token) {
    collectionsList.innerHTML = `<p class="loading-text">Please login to see collections</p>`;
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/collections`, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json"
      }
    });

    const data = await res.json();

    if (!data.status || !data.data) {
      collectionsList.innerHTML = `<p class="loading-text">No collections found</p>`;
      allCollections = [];
      return;
    }

    // Store collections globally for use in renderUrlCards
    allCollections = data.data;
    // Find default collection for filter UI
    const defaultCollection = data.data.find(c => c.is_default || c.name === "Default Collection");
    if (defaultCollection) {
      defaultCollectionId = defaultCollection.id;
    }

    collectionsList.innerHTML = "";

    // Add "All Collections" option
    const allItem = document.createElement("div");
    allItem.className = "collection-item active";
    allItem.innerHTML = `
      <i class="fa-solid fa-check"></i>
      <span>All Collections</span>
    `;

    allItem.onclick = () => {
      document.querySelectorAll(".collection-item").forEach(el => {
        el.classList.remove("active");
      });
      allItem.classList.add("active");
      renderUrlCards(allUrls);
      
      // Close dropdown after selection
      collectionDropdown.classList.add("hidden");
      collectionFilterBtn.classList.remove("active");
    };

    collectionsList.appendChild(allItem);

    // Add user collections
    data.data.forEach(collection => {
      const item = document.createElement("div");
      item.className = "collection-item";
      item.innerHTML = `
        <i class="fa-solid fa-check"></i>
        <span>${collection.name}</span>
      `;

      item.onclick = () => {
        document.querySelectorAll(".collection-item").forEach(el => {
          el.classList.remove("active");
        });
        item.classList.add("active");

        // Filter URLs by collection
        const filteredUrls = allUrls.filter(url => {
          // Check if URL belongs to this collection by ID or name
          return url.collection_id === collection.id || url.collection_name === collection.name;
        });
        renderUrlCards(filteredUrls);
        
        // Close dropdown after selection
        collectionDropdown.classList.add("hidden");
        collectionFilterBtn.classList.remove("active");
      };

      collectionsList.appendChild(item);
    });

  } catch (err) {
    collectionsList.innerHTML = `<p class="loading-text">Failed to load collections</p>`;
    allCollections = [];
  }
}

// ========== EDIT URL MODAL ==========
document.getElementById("editSecure").onchange = e => {
  document
    .getElementById("editPasswordGroup")
    .classList.toggle("hidden", !e.target.checked);
};

document.getElementById("cancelEditBtn").onclick = () => {
  document.getElementById("editModal").classList.add("hidden");
};

document.getElementById("saveEditBtn").onclick = async () => {
  const { token } = await ext.storage.local.get("token");
  const collectionId = editCollectionSelect.value;

  const requestBody = {
    title: document.getElementById("editTitle").value,
    destination: document.getElementById("editDestination").value,
    secure: document.getElementById("editSecure").checked ? 1 : 0,
    password: document.getElementById("editSecure").checked
      ? document.getElementById("editPassword").value
      : "",
    active: true
  };

  // Add collection_id - use default collection if not selected
  const selectedCollectionId = collectionId || defaultCollectionId;
  if (selectedCollectionId && selectedCollectionId !== "__create_new__") {
    requestBody.collection_id = selectedCollectionId;
  }

  try {
    const res = await fetch(
      `${API_BASE}/short-urls/${editingUrlId}`,
      {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(requestBody)
      }
    );

    const data = await res.json();

    if (!data.status) {
      showStatus(data.message || "Update failed", true);
      return;
    }

    document.getElementById("editModal").classList.add("hidden");
    showStatus("URL updated");

    loadMyUrls();
    urlSearch.value = "";

  } catch {
    showStatus("Failed to update URL", true);
  }
};
