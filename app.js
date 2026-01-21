// ==================== API BASE URL ====================
const API_BASE = window.location.origin;

// ==================== USER & AUTH SYSTEM ====================
const employeeMap = {
  "EMP001": { name: "Shubham", avatar: "S", color: "#3b82f6" },
  "EMP002": { name: "Ravi", avatar: "R", color: "#10b981" },
  "EMP003": { name: "Chirag", avatar: "C", color: "#f59e0b" }
};

let currentUser = null;
let importedData = [];
let claims = [];

// ==================== DOM ELEMENTS (initialized after DOM loads) ====================
let tbody, modal, historyModal, addClaimModal, importModal, assignModal, shareModal, detailModal;
let remarksInput, statusInput, followUpDaysInput, saveBtn, claimSummary;
let historyClaimSummary, historyTimeline, toast, toastMessage, loginScreen, appContainer;

let activeClaimId = null;
let assignClaimId = null;
let shareClaimId = null;
let detailClaimId = null;
let currentFilter = "all";
let agentQueue = "my"; // 'my', 'shared', 'all'
let selectedClaims = new Set(); // Track selected claim IDs for bulk actions
let currentPage = 1;
const claimsPerPage = 10;

// Initialize DOM elements after page loads
function initDOMElements() {
  tbody = document.getElementById("claimsBody");
  modal = document.getElementById("modal");
  historyModal = document.getElementById("historyModal");
  addClaimModal = document.getElementById("addClaimModal");
  importModal = document.getElementById("importModal");
  assignModal = document.getElementById("assignModal");
  shareModal = document.getElementById("shareModal");
  detailModal = document.getElementById("detailModal");
  remarksInput = document.getElementById("remarksInput");
  statusInput = document.getElementById("statusInput");
  followUpDaysInput = document.getElementById("followUpDays");
  saveBtn = document.getElementById("saveBtn");
  claimSummary = document.getElementById("claimSummary");
  historyClaimSummary = document.getElementById("historyClaimSummary");
  historyTimeline = document.getElementById("historyTimeline");
  toast = document.getElementById("toast");
  toastMessage = document.getElementById("toastMessage");
  loginScreen = document.getElementById("loginScreen");
  appContainer = document.getElementById("appContainer");
  
  // Setup save button click handler
  if (saveBtn) {
    saveBtn.onclick = saveWork;
  }
  
  // Setup file upload drag and drop
  const fileUploadArea = document.getElementById("fileUploadArea");
  if (fileUploadArea) {
    fileUploadArea.addEventListener("dragover", (e) => {
      e.preventDefault();
      fileUploadArea.classList.add("dragover");
    });
    fileUploadArea.addEventListener("dragleave", () => {
      fileUploadArea.classList.remove("dragover");
    });
    fileUploadArea.addEventListener("drop", (e) => {
      e.preventDefault();
      fileUploadArea.classList.remove("dragover");
      const file = e.dataTransfer.files[0];
      if (file) processExcelFile(file);
    });
  }
}

// ==================== API FUNCTIONS ====================
async function apiCall(endpoint, method = 'GET', data = null) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (data) options.body = JSON.stringify(data);
  
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, options);
    
    // Check if response has content
    const text = await response.text();
    if (!text) {
      throw new Error('Server returned empty response. Database may be connecting...');
    }
    
    // Try to parse JSON
    let jsonData;
    try {
      jsonData = JSON.parse(text);
    } catch (e) {
      throw new Error('Server error. Please try again.');
    }
    
    if (!response.ok) {
      throw new Error(jsonData.error || 'API Error');
    }
    
    return jsonData;
  } catch (error) {
    if (error.message.includes('fetch')) {
      throw new Error('Cannot connect to server');
    }
    throw error;
  }
}

async function loadClaims() {
  try {
    claims = await apiCall('/api/claims');
    render();
    updateEmployeeStats();
  } catch (error) {
    showToast('Failed to load claims: ' + error.message, 'error');
  }
}

// Load users for admin
let allUsers = [];
async function loadUsers() {
  try {
    allUsers = await apiCall('/api/users');
    updateEmployeeMap();
    populateAgentDropdowns();
    renderEmployeeCards();
  } catch (error) {
    console.error('Failed to load users:', error);
  }
}

// Update employeeMap dynamically from database
function updateEmployeeMap() {
  // Clear and rebuild employeeMap from loaded users
  allUsers.forEach((user, index) => {
    const empId = `EMP00${index + 1}`;
    employeeMap[empId] = {
      name: user.name,
      avatar: user.avatar,
      color: user.color,
      odoo_id: user.odoo_id,
      email: user.email
    };
  });
}

// ==================== AUTHENTICATION ====================
window.handleLogin = async function() {
  const loginId = document.getElementById("loginId").value.toLowerCase().trim();
  const password = document.getElementById("loginPassword").value;
  const loginError = document.getElementById("loginError");
  const loginBtn = document.getElementById("loginBtn");
  
  if (!loginId || !password) {
    loginError.style.display = "flex";
    document.getElementById("loginErrorText").textContent = "Please enter both username and password";
    return;
  }
  
  // Show loading state
  const originalBtnText = loginBtn.innerHTML;
  loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';
  loginBtn.disabled = true;
  loginError.style.display = "none";
  
  try {
    const user = await apiCall('/api/login', 'POST', { username: loginId, password });
    
    currentUser = user;
    
    // Load users first to get proper mapping
    await loadUsers();
    
    // Map user id dynamically based on role
    if (currentUser.role === 'admin') {
      currentUser.id = 'ADMIN001';
    } else {
      const userIndex = allUsers.findIndex(u => u.odoo_id === currentUser.odoo_id);
      currentUser.id = userIndex >= 0 ? `EMP00${userIndex + 1}` : `EMP001`;
    }
    
    localStorage.setItem("mnyc_currentUser", JSON.stringify(currentUser));
    loginError.style.display = "none";
    loginBtn.innerHTML = originalBtnText;
    loginBtn.disabled = false;
    showApp();
  } catch (error) {
    console.error('Login error:', error);
    loginError.style.display = "flex";
    document.getElementById("loginErrorText").textContent = error.message || "Invalid credentials";
    loginBtn.innerHTML = originalBtnText;
    loginBtn.disabled = false;
  }
};

function logout() {
  currentUser = null;
  localStorage.removeItem("mnyc_currentUser");
  appContainer.style.display = "none";
  loginScreen.style.display = "flex";
  document.getElementById("loginId").value = "";
  document.getElementById("loginPassword").value = "";
}

function showApp() {
  loginScreen.style.display = "none";
  appContainer.style.display = "block";
  
  // Update user info in header
  document.getElementById("userName").textContent = currentUser.name;
  document.getElementById("userRole").textContent = currentUser.role === "admin" ? "Administrator" : "Agent";
  document.getElementById("userAvatar").textContent = currentUser.avatar;
  document.getElementById("userAvatar").style.background = currentUser.color;
  
  // Show/hide admin controls
  const adminControls = document.getElementById("adminControls");
  const agentHeader = document.getElementById("agentHeader");
  const agentFilter = document.getElementById("agentFilter");
  const checkboxHeader = document.getElementById("checkboxHeader");
  const adminOnlyCols = document.querySelectorAll(".admin-only-col");
  
  if (currentUser.role === "admin") {
    adminControls.style.display = "block";
    agentHeader.style.display = "none";
    agentFilter.style.display = "block";
    document.getElementById("totalLabel").textContent = "All Claims";
    // Show checkbox column for bulk selection
    if (checkboxHeader) checkboxHeader.style.display = "table-cell";
    // Show admin-only columns (Age, Age Bucket)
    adminOnlyCols.forEach(col => col.style.display = "table-cell");
    // Hide profile button for admin
    document.getElementById("profileBtn").style.display = "none";
  } else {
    adminControls.style.display = "none";
    agentHeader.style.display = "flex";
    agentFilter.style.display = "none";
    document.getElementById("totalLabel").textContent = "My Claims";
    // Hide checkbox column for agents
    if (checkboxHeader) checkboxHeader.style.display = "none";
    // Hide admin-only columns (Age, Age Bucket)
    adminOnlyCols.forEach(col => col.style.display = "none");
    // Show profile button for agents
    document.getElementById("profileBtn").style.display = "inline-flex";
  }
  
  // Clear any previous selection
  selectedClaims.clear();
  updateBulkActionBar();
  
  // Load users if not already loaded (for dynamic employee mapping), then load claims
  if (allUsers.length === 0) {
    loadUsers().then(() => loadClaims());
  } else {
    loadClaims();
  }
}

// Check for existing session
function checkSession() {
  const savedUser = localStorage.getItem("mnyc_currentUser");
  if (savedUser) {
    currentUser = JSON.parse(savedUser);
    // Load users first for proper mapping
    loadUsers().then(() => showApp());
  } else {
    // No session - show login screen
    loginScreen.style.display = "flex";
  }
}

function showToast(message, type = "success") {
  toastMessage.textContent = message;
  toast.style.background = type === "success" ? "var(--success)" : "var(--danger)";
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3000);
}

function calculateNextFollowUp(dateWorked, days) {
  const d = new Date(dateWorked);
  d.setDate(d.getDate() + days);
  return d;
}

function getDueClass(nextDate, status) {
  if (!nextDate || status === "PAID") return "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const next = new Date(nextDate);
  next.setHours(0, 0, 0, 0);
  const diff = Math.floor((today - next) / 86400000);
  if (diff === 0) return "due-today";
  if (diff >= 1 && diff < 3) return "due-warning";
  if (diff >= 3) return "due-danger";
  return "";
}

function getStatusBadge(status) {
  if (!status) return `<span class="status-badge status-pending">— Pending</span>`;
  
  // Color coding based on status type
  let statusClass = "status-default";
  if (status === "PAID" || status === "PAID_TO_OTHER_PROV") {
    statusClass = "status-paid";
  } else if (status === "REJECTED" || status === "INEL") {
    statusClass = "status-denied";
  } else if (status === "INPRCS" || status === "PENDING") {
    statusClass = "status-in-review";
  }
  
  return `<span class="status-badge ${statusClass}">${status}</span>`;
}

function getPriorityBadge(priority) {
  if (!priority) return `<span class="priority-badge priority-none">—</span>`;
  
  let priorityClass = "priority-default";
  if (priority === "P-1") {
    priorityClass = "priority-p1";
  } else if (priority === "P-2") {
    priorityClass = "priority-p2";
  } else if (priority === "CHERRY") {
    priorityClass = "priority-cherry";
  }
  
  return `<span class="priority-badge ${priorityClass}">${priority}</span>`;
}

function getActionBadge(action) {
  if (!action) return "";
  return `<span class="action-badge">${action.replace(/_/g, ' ')}</span>`;
}

function getAssignedBadge(assignedTo) {
  if (!assignedTo || !employeeMap[assignedTo]) {
    return `<span class="unassigned-badge">Unassigned</span>`;
  }
  const emp = employeeMap[assignedTo];
  return `<span class="assigned-badge">
    <span class="assigned-avatar" style="background: ${emp.color}">${emp.avatar}</span>
    ${emp.name}
  </span>`;
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

// ==================== STATS FUNCTIONS ====================
function updateStats() {
  let relevantClaims = claims;
  
  // If agent, only show their claims
  if (currentUser && currentUser.role === "agent") {
    relevantClaims = claims.filter(c => c.assignedTo === currentUser.id);
  }
  
  const total = relevantClaims.length;
  const pending = relevantClaims.filter(c => c.status === "INPRCS" || !c.status).length;
  const paid = relevantClaims.filter(c => c.status === "PAID" || c.status === "PAID_TO_OTHER_PROV").length;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdue = relevantClaims.filter(c => {
    if (!c.nextFollowUp) return false;
    const next = new Date(c.nextFollowUp);
    next.setHours(0, 0, 0, 0);
    return next < today && c.status !== "PAID" && c.status !== "PAID_TO_OTHER_PROV";
  }).length;

  document.getElementById("totalClaims").textContent = total;
  document.getElementById("pendingClaims").textContent = pending;
  document.getElementById("paidClaims").textContent = paid;
  document.getElementById("overdueClaims").textContent = overdue;
}

let employeeCarouselPage = 0;
const employeesPerPage = 4;

function renderEmployeeCards() {
  if (!currentUser || currentUser.role !== "admin") return;
  
  const container = document.getElementById('employeeCardsContainer');
  if (!container) return;
  
  const empIds = Object.keys(employeeMap);
  const totalPages = Math.ceil(empIds.length / employeesPerPage);
  
  // Ensure current page is valid
  if (employeeCarouselPage >= totalPages) employeeCarouselPage = 0;
  if (employeeCarouselPage < 0) employeeCarouselPage = totalPages - 1;
  
  const startIdx = employeeCarouselPage * employeesPerPage;
  const visibleEmps = empIds.slice(startIdx, startIdx + employeesPerPage);
  
  let html = '';
  visibleEmps.forEach(empId => {
    const emp = employeeMap[empId];
    html += `
      <div class="employee-card" id="empCard_${empId}">
        <div class="employee-avatar" style="background: ${emp.color};">${emp.avatar}</div>
        <div class="employee-info">
          <h4>${emp.name}</h4>
          <span class="employee-id">${empId}</span>
        </div>
        <div class="employee-stats">
          <div class="emp-stat">
            <span class="emp-stat-value" id="empTotal_${empId}">0</span>
            <span class="emp-stat-label">Total</span>
          </div>
          <div class="emp-stat">
            <span class="emp-stat-value emp-stat-danger" id="empOverdue_${empId}">0</span>
            <span class="emp-stat-label">Overdue</span>
          </div>
        </div>
        <span class="online-status" id="status_${empId}"></span>
      </div>
    `;
  });
  
  container.innerHTML = html;
  
  // Update navigation arrows visibility
  const prevBtn = document.getElementById('empCarouselPrev');
  const nextBtn = document.getElementById('empCarouselNext');
  if (prevBtn) prevBtn.style.visibility = totalPages > 1 ? 'visible' : 'hidden';
  if (nextBtn) nextBtn.style.visibility = totalPages > 1 ? 'visible' : 'hidden';
  
  // Update dots
  renderCarouselDots(totalPages);
  
  // Update stats for visible cards
  updateEmployeeStats();
}

function renderCarouselDots(totalPages) {
  const dotsContainer = document.getElementById('carouselDots');
  if (!dotsContainer || totalPages <= 1) {
    if (dotsContainer) dotsContainer.innerHTML = '';
    return;
  }
  
  let dotsHtml = '';
  for (let i = 0; i < totalPages; i++) {
    dotsHtml += `<span class="carousel-dot ${i === employeeCarouselPage ? 'active' : ''}" onclick="goToEmployeePage(${i})"></span>`;
  }
  dotsContainer.innerHTML = dotsHtml;
}

window.scrollEmployeeCards = function(direction) {
  const empIds = Object.keys(employeeMap);
  const totalPages = Math.ceil(empIds.length / employeesPerPage);
  
  employeeCarouselPage += direction;
  if (employeeCarouselPage >= totalPages) employeeCarouselPage = 0;
  if (employeeCarouselPage < 0) employeeCarouselPage = totalPages - 1;
  
  renderEmployeeCards();
};

window.goToEmployeePage = function(page) {
  employeeCarouselPage = page;
  renderEmployeeCards();
};

function populateAgentDropdowns() {
  const empIds = Object.keys(employeeMap);
  
  // Agent filter dropdown
  const agentFilter = document.getElementById('agentFilter');
  if (agentFilter) {
    // Keep first option (All Agents) and last option (Unassigned)
    const firstOption = agentFilter.querySelector('option[value="all"]');
    const lastOption = agentFilter.querySelector('option[value="unassigned"]');
    agentFilter.innerHTML = '';
    if (firstOption) agentFilter.appendChild(firstOption);
    
    empIds.forEach(empId => {
      const emp = employeeMap[empId];
      const option = document.createElement('option');
      option.value = empId;
      option.textContent = emp.name;
      agentFilter.appendChild(option);
    });
    
    if (lastOption) agentFilter.appendChild(lastOption);
  }
  
  // Assign agent dropdown
  const assignAgentSelect = document.getElementById('assignAgentSelect');
  if (assignAgentSelect) {
    assignAgentSelect.innerHTML = '<option value="">-- Select Agent --</option>';
    empIds.forEach(empId => {
      const emp = employeeMap[empId];
      const option = document.createElement('option');
      option.value = empId;
      option.textContent = `${emp.name} (${empId})`;
      assignAgentSelect.appendChild(option);
    });
  }
  
  // Bulk assign agent dropdown
  const bulkAssignAgentSelect = document.getElementById('bulkAssignAgentSelect');
  if (bulkAssignAgentSelect) {
    bulkAssignAgentSelect.innerHTML = '<option value="">-- Select Agent --</option>';
    empIds.forEach(empId => {
      const emp = employeeMap[empId];
      const option = document.createElement('option');
      option.value = empId;
      option.textContent = `${emp.name} (${empId})`;
      bulkAssignAgentSelect.appendChild(option);
    });
  }
  
  // Agent queue filter (for agents viewing all)
  const agentQueueFilter = document.getElementById('agentQueueFilter');
  if (agentQueueFilter) {
    agentQueueFilter.innerHTML = '<option value="all">All Agents</option>';
    empIds.forEach(empId => {
      const emp = employeeMap[empId];
      const option = document.createElement('option');
      option.value = empId;
      option.textContent = emp.name;
      agentQueueFilter.appendChild(option);
    });
  }
}

function updateEmployeeStats() {
  if (!currentUser || currentUser.role !== "admin") return;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  Object.keys(employeeMap).forEach(empId => {
    const empClaims = claims.filter(c => c.assignedTo === empId);
    const total = empClaims.length;
    const overdue = empClaims.filter(c => {
      if (!c.nextFollowUp || c.status === "PAID" || c.status === "PAID_TO_OTHER_PROV") return false;
      const next = new Date(c.nextFollowUp);
      next.setHours(0, 0, 0, 0);
      return next < today;
    }).length;
    
    const totalEl = document.getElementById(`empTotal_${empId}`);
    const overdueEl = document.getElementById(`empOverdue_${empId}`);
    const statusEl = document.getElementById(`status_${empId}`);
    
    if (totalEl) totalEl.textContent = total;
    if (overdueEl) overdueEl.textContent = overdue;
    
    // Check if employee is online (has worked in last hour - simulated)
    if (statusEl) {
      const isOnline = empClaims.some(c => {
        if (!c.dateWorked) return false;
        const worked = new Date(c.dateWorked);
        return (today - worked) < 3600000; // 1 hour
      });
      statusEl.className = `online-status ${isOnline ? 'online' : 'offline'}`;
      statusEl.textContent = isOnline ? 'Online' : 'Offline';
    }
  });
}

// ==================== FILTER FUNCTIONS ====================
function filterClaims() {
  currentPage = 1; // Reset to first page when searching
  render();
}

window.setFilter = function(filter) {
  currentFilter = filter;
  currentPage = 1; // Reset to first page
  document.querySelectorAll(".filter-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.filter === filter);
  });
  render();
};

// Agent queue filter
window.setAgentQueue = function(queue) {
  agentQueue = queue;
  currentPage = 1; // Reset to first page
  document.querySelectorAll(".queue-tab").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.queue === queue);
  });
  
  // Show/hide the agent filter dropdown when "all" is selected
  const agentQueueFilter = document.getElementById("agentQueueFilter");
  if (agentQueueFilter) {
    agentQueueFilter.style.display = queue === "all" ? "block" : "none";
    if (queue !== "all") {
      agentQueueFilter.value = "all";
    }
  }
  
  render();
};

function getFilteredClaims() {
  const searchTerm = document.getElementById("searchInput").value.toLowerCase();
  const agentFilter = document.getElementById("agentFilter")?.value || "all";
  const agentQueueFilter = document.getElementById("agentQueueFilter")?.value || "all";
  
  return claims.filter((c, i) => {
    // Search filter
    const matchesSearch = !searchTerm || 
      c.claimNo.toLowerCase().includes(searchTerm) ||
      c.patient.toLowerCase().includes(searchTerm);
    
    // Priority filter (changed from status filter)
    const matchesPriority = currentFilter === "all" || c.priority === currentFilter;
    
    // Agent filter (for admin) or queue filter (for agents)
    let matchesAgent = true;
    if (currentUser.role === "admin") {
      if (agentFilter === "unassigned") {
        matchesAgent = !c.assignedTo;
      } else if (agentFilter !== "all") {
        matchesAgent = c.assignedTo === agentFilter;
      }
    } else {
      // Agent queue logic
      const isOwner = c.assignedTo === currentUser.id;
      const isSharedWithMe = c.sharedWith && c.sharedWith.includes(currentUser.id);
      
      if (agentQueue === "my") {
        matchesAgent = isOwner;
      } else if (agentQueue === "shared") {
        matchesAgent = isSharedWithMe && !isOwner;
      } else if (agentQueue === "all") {
        // When viewing all, can filter by specific agent
        if (agentQueueFilter !== "all") {
          matchesAgent = c.assignedTo === agentQueueFilter;
        }
      }
    }
    
    return matchesSearch && matchesPriority && matchesAgent;
  });
}

// ==================== RENDER FUNCTION ====================
function render() {
  const filteredClaims = getFilteredClaims();
  
  tbody.innerHTML = "";
  
  if (filteredClaims.length === 0) {
    document.getElementById("emptyState").style.display = "block";
    document.querySelector(".table-wrapper").style.display = "none";
    document.getElementById("paginationContainer").style.display = "none";
  } else {
    document.getElementById("emptyState").style.display = "none";
    document.querySelector(".table-wrapper").style.display = "block";
    document.getElementById("paginationContainer").style.display = "flex";
  }
  
  // Pagination logic
  const totalPages = Math.ceil(filteredClaims.length / claimsPerPage);
  if (currentPage > totalPages) currentPage = totalPages || 1;
  const startIndex = (currentPage - 1) * claimsPerPage;
  const endIndex = startIndex + claimsPerPage;
  const paginatedClaims = filteredClaims.slice(startIndex, endIndex);
  
  paginatedClaims.forEach((c) => {
    const claimId = c._id;
    const historyCount = c.history ? c.history.length : 0;
    const isOwnClaim = c.assignedTo === currentUser.id;
    const isSharedWithMe = c.sharedWith && c.sharedWith.includes(currentUser.id);
    const canWork = currentUser.role === "admin" || isOwnClaim || isSharedWithMe;
    const isPaid = c.status === "PAID" || c.status === "PAID_TO_OTHER_PROV";
    
    // Get shared indicator
    let sharedIndicator = '';
    if (c.sharedWith && c.sharedWith.length > 0) {
      const sharedNames = c.sharedWith.map(id => employeeMap[id]?.name || id).join(", ");
      sharedIndicator = `<span class="shared-indicator" title="Shared with: ${sharedNames}"><i class="fas fa-share-alt"></i> ${c.sharedWith.length}</span>`;
    }
    
    const tr = document.createElement("tr");
    tr.className = isPaid ? "claim-paid" : getDueClass(c.nextFollowUp, c.status);
    tr.dataset.claimId = claimId;
    
    // Add selected class if this claim is selected
    if (selectedClaims.has(claimId)) {
      tr.classList.add("selected");
    }
    
    if (isOwnClaim && currentUser.role === "agent") {
      tr.style.borderLeft = `4px solid ${currentUser.color}`;
    } else if (isSharedWithMe && currentUser.role === "agent") {
      tr.style.borderLeft = `4px solid #8b5cf6`;
    }
    
    // Add checkbox column for admin
    const checkboxCell = currentUser.role === "admin" ? `
      <td class="checkbox-col">
        <input type="checkbox" class="claim-checkbox" 
               data-claim-id="${claimId}" 
               ${selectedClaims.has(claimId) ? 'checked' : ''}
               onchange="toggleClaimSelection('${claimId}', this.checked)" />
      </td>
    ` : '';
    
    // Admin-only columns for Age and Age Bucket
    const adminOnlyCols = currentUser.role === "admin" ? `
      <td class="admin-only-col">${c.age || '-'}</td>
      <td class="admin-only-col">${c.ageBucket || '-'}</td>
    ` : '';
    
    tr.innerHTML = `
      ${checkboxCell}
      <td><a href="#" class="claim-link" onclick="openDetailModal('${claimId}'); return false;"><strong>${c.claimNo}</strong></a></td>
      <td><a href="#" class="claim-link" onclick="openDetailModal('${claimId}'); return false;">${c.patient}</a></td>
      <td><span class="balance-amount ${c.balance > 500 ? 'balance-high' : ''}">${formatCurrency(c.balance)}</span></td>
      <td>${getPriorityBadge(c.priority)}</td>
      ${adminOnlyCols}
      <td>${getAssignedBadge(c.assignedTo)}${sharedIndicator}</td>
      <td>${getStatusBadge(c.status)}</td>
      <td>${c.dateWorked ? new Date(c.dateWorked).toLocaleString() : "-"}</td>
      <td>${c.nextFollowUp ? new Date(c.nextFollowUp).toLocaleDateString() : "-"}</td>
      <td>
        <span class="history-count" onclick="openHistoryModal('${claimId}')" title="View history">
          <i class="fas fa-history"></i> ${historyCount}
        </span>
      </td>
      <td>
        <div class="action-buttons">
          ${!isPaid && canWork ? `
            <button class="btn-icon btn-icon-primary" onclick="openModal('${claimId}')" title="Work on claim">
              <i class="fas fa-edit"></i>
            </button>
          ` : ''}
          ${currentUser.role === "admin" ? `
            <button class="btn-icon btn-icon-warning" onclick="openAssignModal('${claimId}')" title="Assign claim">
              <i class="fas fa-user-plus"></i>
            </button>
            <div class="action-dropdown">
              <button class="btn-icon btn-icon-secondary" onclick="toggleActionDropdown('${claimId}')" title="More actions">
                <i class="fas fa-ellipsis-v"></i>
              </button>
              <div class="action-dropdown-menu" id="dropdown-${claimId}">
                ${!isPaid ? `
                  <button onclick="openShareModal('${claimId}'); closeAllDropdowns();">
                    <i class="fas fa-share-alt"></i> Share
                  </button>
                ` : ''}
                <button onclick="deleteClaim('${claimId}'); closeAllDropdowns();" class="danger">
                  <i class="fas fa-trash"></i> Delete
                </button>
              </div>
            </div>
          ` : ''}
          ${!isPaid && isOwnClaim && currentUser.role === "agent" ? `
            <button class="btn-icon btn-icon-share" onclick="openShareModal('${claimId}')" title="Share claim">
              <i class="fas fa-share-alt"></i>
            </button>
          ` : ''}
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
  
  document.getElementById("claimCount").textContent = `${filteredClaims.length} claim${filteredClaims.length !== 1 ? 's' : ''}`;
  updateStats();
  updateEmployeeStats();
  updateBulkActionBar();
  updateSelectAllCheckbox();
  renderPagination(filteredClaims.length, totalPages);
}

// ==================== PAGINATION ====================
function renderPagination(totalClaims, totalPages) {
  const paginationContainer = document.getElementById("paginationContainer");
  if (!paginationContainer || totalPages <= 1) {
    if (paginationContainer) paginationContainer.style.display = "none";
    return;
  }
  
  const startItem = (currentPage - 1) * claimsPerPage + 1;
  const endItem = Math.min(currentPage * claimsPerPage, totalClaims);
  
  let paginationHTML = `
    <div class="pagination-info">
      Showing ${startItem}-${endItem} of ${totalClaims} claims
    </div>
    <div class="pagination-controls">
      <button class="pagination-btn" onclick="goToPage(1)" ${currentPage === 1 ? 'disabled' : ''} title="First page">
        <i class="fas fa-angle-double-left"></i>
      </button>
      <button class="pagination-btn" onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''} title="Previous page">
        <i class="fas fa-angle-left"></i>
      </button>
      <span class="pagination-pages">`;
  
  // Show page numbers
  const maxVisiblePages = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
  
  if (endPage - startPage + 1 < maxVisiblePages) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }
  
  if (startPage > 1) {
    paginationHTML += `<button class="pagination-page" onclick="goToPage(1)">1</button>`;
    if (startPage > 2) paginationHTML += `<span class="pagination-ellipsis">...</span>`;
  }
  
  for (let i = startPage; i <= endPage; i++) {
    paginationHTML += `<button class="pagination-page ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
  }
  
  if (endPage < totalPages) {
    if (endPage < totalPages - 1) paginationHTML += `<span class="pagination-ellipsis">...</span>`;
    paginationHTML += `<button class="pagination-page" onclick="goToPage(${totalPages})">${totalPages}</button>`;
  }
  
  paginationHTML += `</span>
      <button class="pagination-btn" onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''} title="Next page">
        <i class="fas fa-angle-right"></i>
      </button>
      <button class="pagination-btn" onclick="goToPage(${totalPages})" ${currentPage === totalPages ? 'disabled' : ''} title="Last page">
        <i class="fas fa-angle-double-right"></i>
      </button>
    </div>
  `;
  
  paginationContainer.innerHTML = paginationHTML;
}

window.goToPage = function(page) {
  currentPage = page;
  render();
  // Scroll to top of table
  document.querySelector('.table-wrapper')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

// Helper function to find claim by ID
function findClaimById(id) {
  return claims.find(c => c._id === id);
}

// ==================== MODAL FUNCTIONS ====================
window.openModal = function(claimId) {
  activeClaimId = claimId;
  const claim = findClaimById(claimId);
  if (!claim) return;
  
  claimSummary.innerHTML = `
    <div class="claim-summary-item">
      <span class="claim-summary-label">Claim #</span>
      <span class="claim-summary-value">${claim.claimNo}</span>
    </div>
    <div class="claim-summary-item">
      <span class="claim-summary-label">Patient</span>
      <span class="claim-summary-value">${claim.patient}</span>
    </div>
    <div class="claim-summary-item">
      <span class="claim-summary-label">Balance</span>
      <span class="claim-summary-value">${formatCurrency(claim.balance)}</span>
    </div>
    <div class="claim-summary-item">
      <span class="claim-summary-label">Assigned To</span>
      <span class="claim-summary-value">${employeeMap[claim.assignedTo]?.name || 'Unassigned'}</span>
    </div>
  `;
  
  remarksInput.value = "";
  statusInput.value = "";  // Reset to require selection
  document.getElementById("actionTakenInput").value = "";  // Reset action taken
  followUpDaysInput.value = claim.balance > 500 ? 14 : 21;
  modal.style.display = "flex";
};

window.closeModal = function() {
  modal.style.display = "none";
};

window.openHistoryModal = function(claimId) {
  const claim = findClaimById(claimId);
  if (!claim) return;
  
  historyClaimSummary.innerHTML = `
    <div class="claim-summary-item">
      <span class="claim-summary-label">Claim #</span>
      <span class="claim-summary-value">${claim.claimNo}</span>
    </div>
    <div class="claim-summary-item">
      <span class="claim-summary-label">Patient</span>
      <span class="claim-summary-value">${claim.patient}</span>
    </div>
    <div class="claim-summary-item">
      <span class="claim-summary-label">Balance</span>
      <span class="claim-summary-value">${formatCurrency(claim.balance)}</span>
    </div>
    <div class="claim-summary-item">
      <span class="claim-summary-label">Assigned To</span>
      <span class="claim-summary-value">${employeeMap[claim.assignedTo]?.name || 'Unassigned'}</span>
    </div>
  `;
  
  const history = claim.history || [];
  
  if (history.length === 0) {
    historyTimeline.innerHTML = `
      <div class="history-empty">
        <i class="fas fa-inbox"></i>
        <p>No follow-up history yet</p>
      </div>
    `;
  } else {
    historyTimeline.innerHTML = history.map((h, i) => `
      <div class="history-item">
        <div class="history-date">
          <i class="fas fa-calendar"></i> ${new Date(h.dateWorked).toLocaleString()}
        </div>
        <div class="history-content">
          <div class="history-badges">
            ${getStatusBadge(h.status)}
            ${h.actionTaken ? `<span class="action-badge"><i class="fas fa-tasks"></i> ${h.actionTaken.replace(/_/g, ' ')}</span>` : ''}
          </div>
          <p class="history-remarks">${h.remarks}</p>
          <div class="history-meta">
            <span><i class="fas fa-calendar-check"></i> Follow-up: ${h.nextFollowUp ? new Date(h.nextFollowUp).toLocaleDateString() : 'N/A'}</span>
            <span class="history-worker"><i class="fas fa-user"></i> By: ${h.workedBy || 'Unknown'}</span>
          </div>
        </div>
      </div>
    `).reverse().join('');
  }
  
  historyModal.style.display = "flex";
};

window.closeHistoryModal = function() {
  historyModal.style.display = "none";
};

// ==================== DETAIL MODAL FUNCTIONS ====================
function formatDate(date) {
  if (!date) return '-';
  const d = new Date(date);
  return d.toLocaleDateString('en-GB'); // DD/MM/YYYY format
}

window.openDetailModal = function(claimId) {
  detailClaimId = claimId;
  const claim = findClaimById(claimId);
  if (!claim) return;
  
  const isOwnClaim = claim.assignedTo === currentUser.id;
  const isSharedWithMe = claim.sharedWith && claim.sharedWith.includes(currentUser.id);
  const canWork = currentUser.role === "admin" || isOwnClaim || isSharedWithMe;
  const isPaid = claim.status === "PAID" || claim.status === "PAID_TO_OTHER_PROV";
  
  document.getElementById("detailContent").innerHTML = `
    <div class="detail-grid">
      <div class="detail-item">
        <label>Claim #</label>
        <div class="value">${claim.claimNo}</div>
      </div>
      <div class="detail-item">
        <label>Account #</label>
        <div class="value">${claim.acctNo || '-'}</div>
      </div>
      <div class="detail-item full-width">
        <label>Patient Name</label>
        <div class="value">${claim.patient}</div>
      </div>
      <div class="detail-item">
        <label>Date of Service (D.O.S)</label>
        <div class="value">${formatDate(claim.dos)}</div>
      </div>
      <div class="detail-item">
        <label>Visit Type</label>
        <div class="value">${claim.visitType || '-'}</div>
      </div>
      <div class="detail-item">
        <label>Primary Payer</label>
        <div class="value">${claim.primaryPayer || '-'}</div>
      </div>
      <div class="detail-item">
        <label>Billed Charges</label>
        <div class="value billed">${formatCurrency(claim.billedCharges || 0)}</div>
      </div>
      <div class="detail-item">
        <label>Balance</label>
        <div class="value balance">${formatCurrency(claim.balance)}</div>
      </div>
      <div class="detail-item">
        <label>Status</label>
        <div class="value">${getStatusBadge(claim.status)}</div>
      </div>
    </div>
    
    <div class="detail-section">
      <h4><i class="fas fa-user-tie"></i> Assignment</h4>
      <div class="detail-grid">
        <div class="detail-item">
          <label>Assigned To</label>
          <div class="value">${employeeMap[claim.assignedTo]?.name || 'Unassigned'}</div>
        </div>
        <div class="detail-item">
          <label>Shared With</label>
          <div class="value">${claim.sharedWith?.length ? claim.sharedWith.map(id => employeeMap[id]?.name).join(', ') : 'None'}</div>
        </div>
      </div>
    </div>
    
    <div class="detail-section">
      <h4><i class="fas fa-clock"></i> Work Status</h4>
      <div class="detail-grid">
        <div class="detail-item">
          <label>Last Worked</label>
          <div class="value">${claim.dateWorked ? new Date(claim.dateWorked).toLocaleString() : '-'}</div>
        </div>
        <div class="detail-item">
          <label>Next Follow-up</label>
          <div class="value">${claim.nextFollowUp ? new Date(claim.nextFollowUp).toLocaleDateString() : '-'}</div>
        </div>
        <div class="detail-item full-width">
          <label>Work History</label>
          <div class="value">${claim.history?.length || 0} entries</div>
        </div>
      </div>
    </div>
  `;
  
  // Show/hide work button
  const workBtn = document.getElementById("detailWorkBtn");
  if (canWork && !isPaid) {
    workBtn.style.display = "inline-flex";
  } else {
    workBtn.style.display = "none";
  }
  
  detailModal.style.display = "flex";
};

window.closeDetailModal = function() {
  detailModal.style.display = "none";
};

window.workFromDetail = function() {
  closeDetailModal();
  openModal(detailClaimId);
};

// ==================== ADD CLAIM FUNCTIONS ====================
window.addNewClaim = function() {
  document.getElementById("newClaimNo").value = "";
  document.getElementById("newPatient").value = "";
  document.getElementById("newBalance").value = "";
  document.getElementById("newAssignee").value = "";
  addClaimModal.style.display = "flex";
};

window.closeAddClaimModal = function() {
  addClaimModal.style.display = "none";
};

window.saveNewClaim = async function() {
  const claimNo = document.getElementById("newClaimNo").value.trim();
  const patient = document.getElementById("newPatient").value.trim();
  const balance = parseFloat(document.getElementById("newBalance").value);
  const assignee = document.getElementById("newAssignee").value;
  
  if (!claimNo || !patient || isNaN(balance)) {
    showToast("Please fill in all required fields", "error");
    return;
  }
  
  try {
    await apiCall('/api/claims', 'POST', {
      claimNo,
      patient,
      balance,
      assignedTo: assignee || null,
      sharedWith: [],
      status: null,
      dateWorked: null,
      nextFollowUp: null,
      history: []
    });
    
    closeAddClaimModal();
    loadClaims();
    showToast("New claim added successfully!");
  } catch (error) {
    showToast(error.message, "error");
  }
};

// ==================== ASSIGN FUNCTIONS ====================
window.openAssignModal = function(claimId) {
  assignClaimId = claimId;
  const claim = findClaimById(claimId);
  if (!claim) return;
  
  document.getElementById("assignClaimSummary").innerHTML = `
    <div class="claim-summary-item">
      <span class="claim-summary-label">Claim #</span>
      <span class="claim-summary-value">${claim.claimNo}</span>
    </div>
    <div class="claim-summary-item">
      <span class="claim-summary-label">Patient</span>
      <span class="claim-summary-value">${claim.patient}</span>
    </div>
    <div class="claim-summary-item">
      <span class="claim-summary-label">Current Assignment</span>
      <span class="claim-summary-value">${employeeMap[claim.assignedTo]?.name || 'Unassigned'}</span>
    </div>
  `;
  
  document.getElementById("assignAgentSelect").value = claim.assignedTo || "";
  assignModal.style.display = "flex";
};

window.closeAssignModal = function() {
  assignModal.style.display = "none";
};

window.saveAssignment = async function() {
  const newAssignee = document.getElementById("assignAgentSelect").value;
  
  try {
    await apiCall(`/api/claims/${assignClaimId}`, 'PUT', {
      assignedTo: newAssignee || null,
      sharedWith: []
    });
    
    closeAssignModal();
    loadClaims();
    showToast(`Claim assigned to ${employeeMap[newAssignee]?.name || 'Unassigned'}`);
  } catch (error) {
    showToast(error.message, "error");
  }
};

// ==================== ACTION DROPDOWN FUNCTIONS ====================
window.toggleActionDropdown = function(claimId) {
  closeAllDropdowns();
  const dropdown = document.getElementById(`dropdown-${claimId}`);
  if (dropdown) {
    dropdown.classList.toggle('show');
  }
};

window.closeAllDropdowns = function() {
  const dropdowns = document.querySelectorAll('.action-dropdown-menu');
  dropdowns.forEach(d => d.classList.remove('show'));
};

// Close dropdowns when clicking outside
document.addEventListener('click', function(e) {
  if (!e.target.closest('.action-dropdown')) {
    closeAllDropdowns();
  }
});

// ==================== SHARE FUNCTIONS ====================
window.openShareModal = function(claimId) {
  shareClaimId = claimId;
  const claim = findClaimById(claimId);
  if (!claim) return;
  
  document.getElementById("shareClaimSummary").innerHTML = `
    <div class="claim-summary-item">
      <span class="claim-summary-label">Claim #</span>
      <span class="claim-summary-value">${claim.claimNo}</span>
    </div>
    <div class="claim-summary-item">
      <span class="claim-summary-label">Patient</span>
      <span class="claim-summary-value">${claim.patient}</span>
    </div>
    <div class="claim-summary-item">
      <span class="claim-summary-label">Owner</span>
      <span class="claim-summary-value">${employeeMap[claim.assignedTo]?.name || 'Unassigned'}</span>
    </div>
  `;
  
  // Build checkboxes for other agents (exclude current owner)
  const shareCheckboxes = document.getElementById("shareCheckboxes");
  const currentShares = claim.sharedWith || [];
  
  let checkboxHTML = '';
  Object.keys(employeeMap).forEach(empId => {
    if (empId !== claim.assignedTo) { // Don't show owner in share list
      const emp = employeeMap[empId];
      const isChecked = currentShares.includes(empId);
      checkboxHTML += `
        <label class="share-checkbox-item">
          <input type="checkbox" value="${empId}" ${isChecked ? 'checked' : ''} />
          <span class="agent-avatar-small" style="background: ${emp.color}">${emp.avatar}</span>
          <span class="agent-name">${emp.name}</span>
          <span class="agent-id">${empId}</span>
        </label>
      `;
    }
  });
  shareCheckboxes.innerHTML = checkboxHTML;
  
  // Show current shares
  const currentSharesDiv = document.getElementById("currentShares");
  const currentSharesList = document.getElementById("currentSharesList");
  
  if (currentShares.length > 0) {
    currentSharesDiv.style.display = "block";
    currentSharesList.innerHTML = currentShares.map(empId => {
      const emp = employeeMap[empId];
      return `<span class="shared-agent-tag">
        <span class="mini-avatar" style="background: ${emp?.color || '#666'}">${emp?.avatar || '?'}</span>
        ${emp?.name || empId}
      </span>`;
    }).join('');
  } else {
    currentSharesDiv.style.display = "none";
  }
  
  shareModal.style.display = "flex";
};

window.closeShareModal = function() {
  shareModal.style.display = "none";
};

window.saveShare = async function() {
  const checkboxes = document.querySelectorAll("#shareCheckboxes input[type='checkbox']");
  const selectedAgents = [];
  
  checkboxes.forEach(cb => {
    if (cb.checked) {
      selectedAgents.push(cb.value);
    }
  });
  
  try {
    await apiCall(`/api/claims/${shareClaimId}`, 'PUT', {
      sharedWith: selectedAgents
    });
    
    closeShareModal();
    loadClaims();
    
    if (selectedAgents.length > 0) {
      const names = selectedAgents.map(id => employeeMap[id]?.name).join(", ");
      showToast(`Claim shared with: ${names}`);
    } else {
      showToast("Claim sharing removed");
    }
  } catch (error) {
    showToast(error.message, "error");
  }
};

// ==================== DELETE FUNCTION ====================
window.deleteClaim = async function(claimId) {
  if (confirm("Are you sure you want to delete this claim?")) {
    try {
      await apiCall(`/api/claims/${claimId}`, 'DELETE');
      selectedClaims.delete(claimId); // Remove from selection if selected
      loadClaims();
      showToast("Claim deleted successfully!");
    } catch (error) {
      showToast(error.message, "error");
    }
  }
};

// ==================== BULK SELECTION FUNCTIONS ====================
window.toggleClaimSelection = function(claimId, isChecked) {
  if (isChecked) {
    selectedClaims.add(claimId);
  } else {
    selectedClaims.delete(claimId);
  }
  
  // Update row highlight
  const row = document.querySelector(`tr[data-claim-id="${claimId}"]`);
  if (row) {
    row.classList.toggle("selected", isChecked);
  }
  
  updateBulkActionBar();
  updateSelectAllCheckbox();
};

window.toggleSelectAll = function() {
  const selectAllHeader = document.getElementById("selectAllHeader");
  const selectAllClaims = document.getElementById("selectAllClaims");
  const isChecked = selectAllHeader?.checked || selectAllClaims?.checked;
  
  const filteredClaims = getFilteredClaims();
  const checkboxes = document.querySelectorAll(".claim-checkbox");
  
  checkboxes.forEach(cb => {
    cb.checked = isChecked;
  });
  
  if (isChecked) {
    filteredClaims.forEach(c => selectedClaims.add(c._id));
  } else {
    filteredClaims.forEach(c => selectedClaims.delete(c._id));
  }
  
  // Sync both checkboxes
  if (selectAllHeader) selectAllHeader.checked = isChecked;
  if (selectAllClaims) selectAllClaims.checked = isChecked;
  
  // Update row highlights
  document.querySelectorAll("tr[data-claim-id]").forEach(row => {
    row.classList.toggle("selected", isChecked);
  });
  
  updateBulkActionBar();
};

function updateSelectAllCheckbox() {
  const filteredClaims = getFilteredClaims();
  const selectAllHeader = document.getElementById("selectAllHeader");
  const selectAllClaims = document.getElementById("selectAllClaims");
  
  if (filteredClaims.length === 0) {
    if (selectAllHeader) selectAllHeader.checked = false;
    if (selectAllClaims) selectAllClaims.checked = false;
    return;
  }
  
  const allSelected = filteredClaims.every(c => selectedClaims.has(c._id));
  const someSelected = filteredClaims.some(c => selectedClaims.has(c._id));
  
  if (selectAllHeader) {
    selectAllHeader.checked = allSelected;
    selectAllHeader.indeterminate = someSelected && !allSelected;
  }
  if (selectAllClaims) {
    selectAllClaims.checked = allSelected;
    selectAllClaims.indeterminate = someSelected && !allSelected;
  }
}

function updateBulkActionBar() {
  const bulkActionBar = document.getElementById("bulkActionBar");
  const selectedCount = document.getElementById("selectedCount");
  
  if (!bulkActionBar) return;
  
  if (currentUser?.role === "admin" && selectedClaims.size > 0) {
    bulkActionBar.style.display = "flex";
    if (selectedCount) selectedCount.textContent = selectedClaims.size;
  } else {
    bulkActionBar.style.display = "none";
  }
}

window.clearSelection = function() {
  selectedClaims.clear();
  
  // Uncheck all checkboxes
  document.querySelectorAll(".claim-checkbox").forEach(cb => {
    cb.checked = false;
  });
  
  // Remove selected class from all rows
  document.querySelectorAll("tr.selected").forEach(row => {
    row.classList.remove("selected");
  });
  
  updateBulkActionBar();
  updateSelectAllCheckbox();
};

// ==================== BULK ASSIGN FUNCTIONS ====================
window.openBulkAssignModal = function() {
  if (selectedClaims.size === 0) {
    showToast("Please select at least one claim", "error");
    return;
  }
  
  document.getElementById("bulkAssignCount").textContent = selectedClaims.size;
  document.getElementById("bulkAssignAgentSelect").value = "";
  document.getElementById("bulkAssignModal").style.display = "flex";
};

window.closeBulkAssignModal = function() {
  document.getElementById("bulkAssignModal").style.display = "none";
};

window.saveBulkAssignment = async function() {
  const agentId = document.getElementById("bulkAssignAgentSelect").value;
  
  if (!agentId) {
    showToast("Please select an agent", "error");
    return;
  }
  
  try {
    // Update all selected claims
    const promises = Array.from(selectedClaims).map(claimId => 
      apiCall(`/api/claims/${claimId}`, 'PUT', {
        assignedTo: agentId,
        sharedWith: []
      })
    );
    
    await Promise.all(promises);
    
    closeBulkAssignModal();
    clearSelection();
    loadClaims();
    showToast(`${selectedClaims.size} claims assigned to ${employeeMap[agentId]?.name || agentId}`);
  } catch (error) {
    showToast("Error assigning claims: " + error.message, "error");
  }
};

// ==================== BULK DELETE FUNCTION ====================
window.bulkDelete = async function() {
  if (selectedClaims.size === 0) {
    showToast("Please select at least one claim", "error");
    return;
  }
  
  const count = selectedClaims.size;
  if (!confirm(`Are you sure you want to delete ${count} claim${count !== 1 ? 's' : ''}? This action cannot be undone.`)) {
    return;
  }
  
  try {
    // Delete all selected claims
    const promises = Array.from(selectedClaims).map(claimId => 
      apiCall(`/api/claims/${claimId}`, 'DELETE')
    );
    
    await Promise.all(promises);
    
    selectedClaims.clear();
    loadClaims();
    showToast(`${count} claim${count !== 1 ? 's' : ''} deleted successfully!`);
  } catch (error) {
    showToast("Error deleting claims: " + error.message, "error");
  }
};

// ==================== EXPORT FUNCTION ====================
window.exportData = function() {
  let dataToExport = claims;
  
  if (currentUser.role === "agent") {
    dataToExport = claims.filter(c => c.assignedTo === currentUser.id);
  }
  
  const dataStr = JSON.stringify(dataToExport, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `mnyc_claims_${currentUser.name}_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("Data exported successfully!");
};

// ==================== IMPORT FUNCTIONS ====================
window.openImportModal = function() {
  importedData = [];
  document.getElementById("importPreview").style.display = "none";
  document.getElementById("importBtn").disabled = true;
  document.getElementById("excelFileInput").value = "";
  importModal.style.display = "flex";
};

window.closeImportModal = function() {
  importModal.style.display = "none";
};

window.handleFileSelect = function(event) {
  const file = event.target.files[0];
  if (file) processExcelFile(file);
};

function processExcelFile(file) {
  const reader = new FileReader();
  
  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet);
      
      if (jsonData.length === 0) {
        showToast("No data found in the file", "error");
        return;
      }
      
      // Process and validate data - map all fields from Excel
      importedData = jsonData.map(row => {
        // Parse DOS (Date of Service) - handles various formats
        let dos = null;
        const dosValue = row.DOS || row["D.O.S"] || row.dos || row["Date of Service"] || row.DateOfService;
        if (dosValue) {
          // Handle Excel serial date numbers
          if (typeof dosValue === 'number') {
            dos = new Date((dosValue - 25569) * 86400 * 1000);
          } else {
            // Try parsing as string (DD/MM/YY or other formats)
            const parts = String(dosValue).split(/[\/\-]/);
            if (parts.length === 3) {
              let day = parseInt(parts[0]);
              let month = parseInt(parts[1]) - 1;
              let year = parseInt(parts[2]);
              if (year < 100) year += 2000;
              dos = new Date(year, month, day);
            } else {
              dos = new Date(dosValue);
            }
          }
        }
        
        return {
          claimNo: row.ClaimNo || row.claimNo || row["Claim No"] || row["Claim #"] || row["Claim#"] || "",
          patient: row.Patient || row.patient || row.PatientName || row["Patient Name"] || "",
          balance: parseFloat(row.Balance || row.balance || 0) || 0,
          dos: dos,
          visitType: row.VisitType || row["Visit Type"] || row.visitType || null,
          acctNo: row.AcctNo || row["Acct #"] || row["Acct#"] || row.AccountNo || row["Account #"] || row.acctNo || null,
          primaryPayer: row.PrimaryPayer || row["Primary Payer"] || row.Payer || row.primaryPayer || null,
          billedCharges: parseFloat(row.BilledCharges || row["Billed Charges"] || row.billedCharges || 0) || 0,
          priority: row.Priority || row.priority || row["Priority"] || null,
          age: parseInt(row.Age || row.age || 0) || null,
          ageBucket: row.AgeBucket || row["Age Bucket"] || row.ageBucket || row["AgeBucket"] || null,
          assignedTo: row.AssignTo || row.assignTo || row.AssignedTo || row["Assign To"] || null
        };
      }).filter(row => row.claimNo && row.patient);
      
      // Show preview
      showImportPreview();
      
    } catch (error) {
      showToast("Error reading file: " + error.message, "error");
    }
  };
  
  reader.readAsArrayBuffer(file);
}

function showImportPreview() {
  const previewBody = document.getElementById("previewBody");
  const previewCount = document.getElementById("previewCount");
  
  previewCount.textContent = importedData.length;
  
  previewBody.innerHTML = importedData.slice(0, 10).map(row => `
    <tr>
      <td>${row.claimNo}</td>
      <td>${row.patient}</td>
      <td>${formatCurrency(row.balance)}</td>
      <td>${row.primaryPayer || '-'}</td>
    </tr>
  `).join('');
  
  if (importedData.length > 10) {
    previewBody.innerHTML += `<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">... and ${importedData.length - 10} more</td></tr>`;
  }
  
  document.getElementById("importPreview").style.display = "block";
  document.getElementById("importBtn").disabled = false;
}

window.importClaims = async function() {
  const newClaims = importedData.map(row => ({
    claimNo: row.claimNo,
    patient: row.patient,
    balance: row.balance,
    dos: row.dos,
    visitType: row.visitType,
    acctNo: row.acctNo,
    primaryPayer: row.primaryPayer,
    billedCharges: row.billedCharges,
    priority: row.priority,
    age: row.age,
    ageBucket: row.ageBucket,
    assignedTo: row.assignedTo || null,
    sharedWith: [],
    status: null,
    dateWorked: null,
    nextFollowUp: null,
    history: []
  }));
  
  try {
    const result = await apiCall('/api/claims/bulk', 'POST', newClaims);
    closeImportModal();
    loadClaims();
    showToast(`${result.imported || newClaims.length} claims imported successfully!`);
  } catch (error) {
    showToast(error.message, "error");
  }
};

// ==================== SAVE WORK ====================
async function saveWork() {
  const actionTaken = document.getElementById("actionTakenInput").value;
  
  // Validate all required fields
  if (!remarksInput.value.trim()) {
    showToast("Remarks are required", "error");
    return;
  }
  
  if (!statusInput.value) {
    showToast("Please select a Status", "error");
    return;
  }
  
  if (!actionTaken) {
    showToast("Please select an Action Taken", "error");
    return;
  }
  
  const now = new Date();
  const followUpDays = parseInt(followUpDaysInput.value) || 14;
  const claim = findClaimById(activeClaimId);
  
  if (!claim) {
    showToast("Claim not found", "error");
    return;
  }
  
  const history = claim.history || [];
  
  // Add the new follow-up entry to history
  history.push({
    remarks: remarksInput.value,
    status: statusInput.value,
    actionTaken: actionTaken,
    dateWorked: now,
    nextFollowUp: statusInput.value === "PAID" ? null : calculateNextFollowUp(now, followUpDays),
    workedBy: currentUser.name
  });
  
  try {
    await apiCall(`/api/claims/${activeClaimId}`, 'PUT', {
      history: history,
      status: statusInput.value,
      actionTaken: actionTaken,
      dateWorked: now,
      nextFollowUp: statusInput.value === "PAID" ? null : calculateNextFollowUp(now, followUpDays),
      lastWorkedBy: currentUser.id
    });
    
    modal.style.display = "none";
    loadClaims();
    showToast("Claim updated successfully!");
  } catch (error) {
    showToast(error.message, "error");
  }
}

// ==================== REFRESH DATA ====================
window.refreshData = function() {
  loadUsers().then(() => loadClaims());
  showToast('Data refreshed successfully!');
};

// ==================== USER MANAGEMENT FUNCTIONS (ADMIN) ====================
let userWasCreated = false; // Track if a user was created during this modal session

window.openCreateUserModal = function() {
  userWasCreated = false;
  document.getElementById("createUserModal").style.display = "flex";
  document.getElementById("createUserForm").style.display = "block";
  document.getElementById("userCreatedSuccess").style.display = "none";
  document.getElementById("createUserForm").reset();
};

window.closeCreateUserModal = function() {
  document.getElementById("createUserModal").style.display = "none";
};

window.closeCreateUserModalAndRefresh = function() {
  document.getElementById("createUserModal").style.display = "none";
  if (userWasCreated) {
    refreshPortalAfterUserChange();
  }
};

window.finishCreateUser = function() {
  document.getElementById("createUserModal").style.display = "none";
  refreshPortalAfterUserChange();
};

window.resetCreateUserForm = function() {
  document.getElementById("createUserForm").style.display = "block";
  document.getElementById("userCreatedSuccess").style.display = "none";
  document.getElementById("createUserForm").reset();
};

function refreshPortalAfterUserChange() {
  // Refresh employee cards, dropdowns, and stats
  renderEmployeeCards();
  populateAgentDropdowns();
  updateEmployeeStats();
  showToast("Portal updated with new user!");
}

window.openManageUsersModal = function() {
  document.getElementById("manageUsersModal").style.display = "flex";
  renderUserList();
};

window.closeManageUsersModal = function() {
  document.getElementById("manageUsersModal").style.display = "none";
};

function renderUserList() {
  const userList = document.getElementById("userList");
  const userCount = document.getElementById("userCount");
  
  if (userCount) {
    userCount.textContent = `${allUsers.length} user${allUsers.length !== 1 ? 's' : ''}`;
  }
  
  if (allUsers.length === 0) {
    userList.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--text-muted);">
        <i class="fas fa-users" style="font-size: 3rem; margin-bottom: 15px; display: block;"></i>
        <p>No agents found</p>
        <p style="font-size: 0.85rem;">Create your first user to get started</p>
      </div>
    `;
    return;
  }
  
  userList.innerHTML = allUsers.map((user, index) => `
    <div class="user-list-item">
      <div class="user-list-avatar" style="background: ${user.color}">${user.avatar}</div>
      <div class="user-list-info">
        <span class="user-list-name">${user.name}</span>
        <span class="user-list-details">@${user.odoo_id} · ${user.email || 'No email'}</span>
      </div>
      ${user.isDefaultPassword ? '<span class="user-default-badge">Default Password</span>' : ''}
      <div class="user-list-actions">
        <button class="btn-icon btn-icon-danger" onclick="deleteUser('${user.odoo_id}')" title="Delete user">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </div>
  `).join('');
}

window.createNewUser = async function(event) {
  event.preventDefault();
  
  const username = document.getElementById("newUsername").value.trim().toLowerCase();
  const name = document.getElementById("newUserName").value.trim();
  const email = document.getElementById("newUserEmail").value.trim();
  const password = document.getElementById("newUserPassword").value;
  
  if (!username || !name || !password) {
    showToast("Please fill in all required fields", "error");
    return;
  }
  
  try {
    await apiCall('/api/users', 'POST', { username, name, email, password });
    
    // Mark that a user was created
    userWasCreated = true;
    
    // Show success message in modal
    document.getElementById("createUserForm").style.display = "none";
    document.getElementById("userCreatedSuccess").style.display = "block";
    document.getElementById("createdUserName").textContent = `"${name}" has been added as an agent.`;
    
    showToast(`User "${name}" created successfully!`);
    await loadUsers();
    
    // Auto-update the portal in background
    renderEmployeeCards();
    populateAgentDropdowns();
  } catch (error) {
    showToast(error.message, "error");
  }
};

window.deleteUser = async function(userId) {
  if (!confirm(`Are you sure you want to delete user "${userId}"? This action cannot be undone.`)) {
    return;
  }
  
  try {
    await apiCall(`/api/users/${userId}`, 'DELETE');
    showToast("User deleted successfully!");
    await loadUsers();
    renderUserList();
  } catch (error) {
    showToast(error.message, "error");
  }
};

// ==================== PROFILE FUNCTIONS (AGENTS) ====================
window.openProfileModal = function() {
  if (!currentUser) return;
  
  // Only agents can edit profile
  if (currentUser.role !== 'agent') {
    showToast("Admin profile editing not available", "error");
    return;
  }
  
  document.getElementById("profileAvatar").textContent = currentUser.avatar;
  document.getElementById("profileAvatar").style.background = currentUser.color;
  document.getElementById("profileRole").textContent = currentUser.role === 'admin' ? 'Administrator' : 'Agent';
  document.getElementById("profileUsername").value = currentUser.odoo_id;
  document.getElementById("profileName").value = currentUser.name;
  document.getElementById("profileEmail").value = currentUser.email || '';
  
  // Clear password fields
  document.getElementById("currentPassword").value = "";
  document.getElementById("newPassword").value = "";
  document.getElementById("confirmPassword").value = "";
  
  document.getElementById("profileModal").style.display = "flex";
};

window.closeProfileModal = function() {
  document.getElementById("profileModal").style.display = "none";
};

window.saveProfile = async function(event) {
  event.preventDefault();
  
  const name = document.getElementById("profileName").value.trim();
  const email = document.getElementById("profileEmail").value.trim();
  const currentPassword = document.getElementById("currentPassword").value;
  const newPassword = document.getElementById("newPassword").value;
  const confirmPassword = document.getElementById("confirmPassword").value;
  
  if (!name) {
    showToast("Name is required", "error");
    return;
  }
  
  // Validate password change
  if (newPassword || currentPassword) {
    if (!currentPassword) {
      showToast("Current password is required to change password", "error");
      return;
    }
    if (!newPassword) {
      showToast("New password is required", "error");
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast("New passwords do not match", "error");
      return;
    }
    if (newPassword.length < 4) {
      showToast("New password must be at least 4 characters", "error");
      return;
    }
  }
  
  try {
    const updateData = { name, email };
    if (newPassword) {
      updateData.currentPassword = currentPassword;
      updateData.newPassword = newPassword;
    }
    
    const result = await apiCall(`/api/users/${currentUser.odoo_id}`, 'PUT', updateData);
    
    // Update current user data
    currentUser.name = result.user.name;
    currentUser.email = result.user.email;
    currentUser.avatar = result.user.avatar;
    localStorage.setItem("mnyc_currentUser", JSON.stringify(currentUser));
    
    // Update header
    document.getElementById("userName").textContent = currentUser.name;
    document.getElementById("userAvatar").textContent = currentUser.avatar;
    
    closeProfileModal();
    showToast("Profile updated successfully!");
    
    if (newPassword) {
      showToast("Password changed! Please use your new password next time.", "success");
    }
  } catch (error) {
    showToast(error.message, "error");
  }
};

// ==================== INITIALIZATION ====================
// Wait for DOM to be ready before initializing
document.addEventListener('DOMContentLoaded', function() {
  // Initialize all DOM element references
  initDOMElements();
  
  // Check for existing session on page load
  checkSession();
  
  // Hide loading screen after initialization
  setTimeout(() => {
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
      loadingScreen.classList.add('fade-out');
      setTimeout(() => {
        loadingScreen.style.display = 'none';
      }, 500);
    }
  }, 800); // Small delay to ensure smooth transition
  
  // Auto-refresh every 30 seconds when app is visible
  setInterval(() => {
    if (currentUser && document.visibilityState === 'visible') {
      loadClaims();
    }
  }, 30000);
});
