// ==================== USER & AUTH SYSTEM ====================
const users = {
  "yashpal": { id: "ADMIN001", name: "Yashpal", password: "admin123", role: "admin", avatar: "Y", color: "#7c3aed" },
  "shubham": { id: "EMP001", name: "Shubham", password: "pass123", role: "agent", avatar: "S", color: "#3b82f6" },
  "ravi": { id: "EMP002", name: "Ravi", password: "pass123", role: "agent", avatar: "R", color: "#10b981" },
  "chirag": { id: "EMP003", name: "Chirag", password: "pass123", role: "agent", avatar: "C", color: "#f59e0b" }
};

const employeeMap = {
  "EMP001": { name: "Shubham", avatar: "S", color: "#3b82f6" },
  "EMP002": { name: "Ravi", avatar: "R", color: "#10b981" },
  "EMP003": { name: "Chirag", avatar: "C", color: "#f59e0b" }
};

let currentUser = null;
let importedData = [];

// ==================== DOM ELEMENTS ====================
const tbody = document.getElementById("claimsBody");
const modal = document.getElementById("modal");
const historyModal = document.getElementById("historyModal");
const addClaimModal = document.getElementById("addClaimModal");
const importModal = document.getElementById("importModal");
const assignModal = document.getElementById("assignModal");
const shareModal = document.getElementById("shareModal");
const remarksInput = document.getElementById("remarksInput");
const statusInput = document.getElementById("statusInput");
const followUpDaysInput = document.getElementById("followUpDays");
const saveBtn = document.getElementById("saveBtn");
const claimSummary = document.getElementById("claimSummary");
const historyClaimSummary = document.getElementById("historyClaimSummary");
const historyTimeline = document.getElementById("historyTimeline");
const toast = document.getElementById("toast");
const toastMessage = document.getElementById("toastMessage");
const loginScreen = document.getElementById("loginScreen");
const appContainer = document.getElementById("appContainer");

let activeIndex = null;
let assignIndex = null;
let shareIndex = null;
let currentFilter = "all";
let agentQueue = "my"; // 'my', 'shared', 'all'
let claims = JSON.parse(localStorage.getItem("mnyc_claims")) || [];

// ==================== AUTHENTICATION ====================
function handleLogin(event) {
  event.preventDefault();
  const loginId = document.getElementById("loginId").value.toLowerCase().trim();
  const password = document.getElementById("loginPassword").value;
  const loginError = document.getElementById("loginError");
  
  if (users[loginId] && users[loginId].password === password) {
    currentUser = users[loginId];
    localStorage.setItem("mnyc_currentUser", JSON.stringify(currentUser));
    loginError.style.display = "none";
    showApp();
  } else {
    loginError.style.display = "flex";
    document.getElementById("loginErrorText").textContent = "Invalid Employee ID or Password";
  }
}

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
  
  if (currentUser.role === "admin") {
    adminControls.style.display = "block";
    agentHeader.style.display = "none";
    agentFilter.style.display = "block";
    document.getElementById("totalLabel").textContent = "All Claims";
  } else {
    adminControls.style.display = "none";
    agentHeader.style.display = "flex";
    agentFilter.style.display = "none";
    document.getElementById("totalLabel").textContent = "My Claims";
  }
  
  render();
  updateEmployeeStats();
}

// Check for existing session
function checkSession() {
  const savedUser = localStorage.getItem("mnyc_currentUser");
  if (savedUser) {
    currentUser = JSON.parse(savedUser);
    showApp();
  }
}

// ==================== DATA FUNCTIONS ====================
function saveData() {
  localStorage.setItem("mnyc_claims", JSON.stringify(claims));
  // Notify other tabs about the update
  localStorage.setItem('mnyc_lastUpdate', Date.now().toString());
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
  if (!nextDate || status === "paid") return "";
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
  const statusMap = {
    waiting: { class: "status-waiting", icon: "⏳", label: "Waiting" },
    unpaid: { class: "status-unpaid", icon: "💰", label: "Unpaid" },
    paid: { class: "status-paid", icon: "✅", label: "Paid" },
    denied: { class: "status-denied", icon: "❌", label: "Denied" },
    "in-review": { class: "status-in-review", icon: "🔍", label: "In Review" }
  };
  const s = statusMap[status] || { class: "status-waiting", icon: "⏳", label: status || "-" };
  return `<span class="status-badge ${s.class}">${s.icon} ${s.label}</span>`;
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
  const pending = relevantClaims.filter(c => c.status === "waiting" || c.status === "in-review" || !c.status).length;
  const paid = relevantClaims.filter(c => c.status === "paid").length;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdue = relevantClaims.filter(c => {
    if (!c.nextFollowUp) return false;
    const next = new Date(c.nextFollowUp);
    next.setHours(0, 0, 0, 0);
    return next < today && c.status !== "paid";
  }).length;

  document.getElementById("totalClaims").textContent = total;
  document.getElementById("pendingClaims").textContent = pending;
  document.getElementById("paidClaims").textContent = paid;
  document.getElementById("overdueClaims").textContent = overdue;
}

function updateEmployeeStats() {
  if (!currentUser || currentUser.role !== "admin") return;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  Object.keys(employeeMap).forEach(empId => {
    const empClaims = claims.filter(c => c.assignedTo === empId);
    const total = empClaims.length;
    const overdue = empClaims.filter(c => {
      if (!c.nextFollowUp || c.status === "paid") return false;
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
  render();
}

window.setFilter = function(filter) {
  currentFilter = filter;
  document.querySelectorAll(".filter-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.filter === filter);
  });
  render();
};

// Agent queue filter
window.setAgentQueue = function(queue) {
  agentQueue = queue;
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
    
    // Status filter
    const matchesFilter = currentFilter === "all" || c.status === currentFilter;
    
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
    
    return matchesSearch && matchesFilter && matchesAgent;
  }).map((c, i) => ({ ...c, originalIndex: claims.indexOf(c) }));
}

// ==================== RENDER FUNCTION ====================
function render() {
  const filteredClaims = getFilteredClaims();
  
  tbody.innerHTML = "";
  
  if (filteredClaims.length === 0) {
    document.getElementById("emptyState").style.display = "block";
    document.querySelector(".table-wrapper").style.display = "none";
  } else {
    document.getElementById("emptyState").style.display = "none";
    document.querySelector(".table-wrapper").style.display = "block";
  }
  
  filteredClaims.forEach((c) => {
    const historyCount = c.history ? c.history.length : 0;
    const isOwnClaim = c.assignedTo === currentUser.id;
    const isSharedWithMe = c.sharedWith && c.sharedWith.includes(currentUser.id);
    const canWork = currentUser.role === "admin" || isOwnClaim || isSharedWithMe;
    const isPaid = c.status === "paid";
    
    // Get shared indicator
    let sharedIndicator = '';
    if (c.sharedWith && c.sharedWith.length > 0) {
      const sharedNames = c.sharedWith.map(id => employeeMap[id]?.name || id).join(", ");
      sharedIndicator = `<span class="shared-indicator" title="Shared with: ${sharedNames}"><i class="fas fa-share-alt"></i> ${c.sharedWith.length}</span>`;
    }
    
    const tr = document.createElement("tr");
    tr.className = isPaid ? "claim-paid" : getDueClass(c.nextFollowUp, c.status);
    if (isOwnClaim && currentUser.role === "agent") {
      tr.style.borderLeft = `4px solid ${currentUser.color}`;
    } else if (isSharedWithMe && currentUser.role === "agent") {
      tr.style.borderLeft = `4px solid #8b5cf6`;
    }
    
    tr.innerHTML = `
      <td><strong>${c.claimNo}</strong></td>
      <td>${c.patient}</td>
      <td><span class="balance-amount ${c.balance > 500 ? 'balance-high' : ''}">${formatCurrency(c.balance)}</span></td>
      <td>${getAssignedBadge(c.assignedTo)}${sharedIndicator}</td>
      <td>${getStatusBadge(c.status)}</td>
      <td>${c.dateWorked ? new Date(c.dateWorked).toLocaleString() : "-"}</td>
      <td>${c.nextFollowUp ? new Date(c.nextFollowUp).toLocaleDateString() : "-"}</td>
      <td>
        <span class="history-count" onclick="openHistoryModal(${c.originalIndex})" title="View history">
          <i class="fas fa-history"></i> ${historyCount}
        </span>
      </td>
      <td>
        <div class="action-buttons">
          ${!isPaid && canWork ? `
            <button class="btn-icon btn-icon-primary" onclick="openModal(${c.originalIndex})" title="Work on claim">
              <i class="fas fa-edit"></i>
            </button>
          ` : ''}
          ${!isPaid && isOwnClaim && currentUser.role === "agent" ? `
            <button class="btn-icon btn-icon-share" onclick="openShareModal(${c.originalIndex})" title="Share claim">
              <i class="fas fa-share-alt"></i>
            </button>
          ` : ''}
          ${currentUser.role === "admin" ? `
            <button class="btn-icon btn-icon-warning" onclick="openAssignModal(${c.originalIndex})" title="Assign claim">
              <i class="fas fa-user-plus"></i>
            </button>
            <button class="btn-icon btn-icon-danger" onclick="deleteClaim(${c.originalIndex})" title="Delete claim">
              <i class="fas fa-trash"></i>
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
}

// ==================== MODAL FUNCTIONS ====================
window.openModal = function(index) {
  activeIndex = index;
  const claim = claims[index];
  
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
  statusInput.value = claim.status || "waiting";
  followUpDaysInput.value = claim.balance > 500 ? 14 : 21;
  modal.style.display = "flex";
};

window.closeModal = function() {
  modal.style.display = "none";
};

window.openHistoryModal = function(index) {
  const claim = claims[index];
  
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
          ${getStatusBadge(h.status)}
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

window.saveNewClaim = function() {
  const claimNo = document.getElementById("newClaimNo").value.trim();
  const patient = document.getElementById("newPatient").value.trim();
  const balance = parseFloat(document.getElementById("newBalance").value);
  const assignee = document.getElementById("newAssignee").value;
  
  if (!claimNo || !patient || isNaN(balance)) {
    showToast("Please fill in all required fields", "error");
    return;
  }
  
  claims.push({
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
  
  saveData();
  closeAddClaimModal();
  render();
  showToast("New claim added successfully!");
};

// ==================== ASSIGN FUNCTIONS ====================
window.openAssignModal = function(index) {
  assignIndex = index;
  const claim = claims[index];
  
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

window.saveAssignment = function() {
  const newAssignee = document.getElementById("assignAgentSelect").value;
  claims[assignIndex].assignedTo = newAssignee || null;
  // Clear shares when reassigning
  claims[assignIndex].sharedWith = [];
  saveData();
  closeAssignModal();
  render();
  showToast(`Claim assigned to ${employeeMap[newAssignee]?.name || 'Unassigned'}`);
};

// ==================== SHARE FUNCTIONS ====================
window.openShareModal = function(index) {
  shareIndex = index;
  const claim = claims[index];
  
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

window.saveShare = function() {
  const checkboxes = document.querySelectorAll("#shareCheckboxes input[type='checkbox']");
  const selectedAgents = [];
  
  checkboxes.forEach(cb => {
    if (cb.checked) {
      selectedAgents.push(cb.value);
    }
  });
  
  claims[shareIndex].sharedWith = selectedAgents;
  saveData();
  closeShareModal();
  render();
  
  if (selectedAgents.length > 0) {
    const names = selectedAgents.map(id => employeeMap[id]?.name).join(", ");
    showToast(`Claim shared with: ${names}`);
  } else {
    showToast("Claim sharing removed");
  }
};

// ==================== DELETE FUNCTION ====================
window.deleteClaim = function(index) {
  if (confirm("Are you sure you want to delete this claim?")) {
    claims.splice(index, 1);
    saveData();
    render();
    showToast("Claim deleted successfully!");
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

// Drag and drop handling
const fileUploadArea = document.getElementById("fileUploadArea");

fileUploadArea?.addEventListener("dragover", (e) => {
  e.preventDefault();
  fileUploadArea.classList.add("dragover");
});

fileUploadArea?.addEventListener("dragleave", () => {
  fileUploadArea.classList.remove("dragover");
});

fileUploadArea?.addEventListener("drop", (e) => {
  e.preventDefault();
  fileUploadArea.classList.remove("dragover");
  const file = e.dataTransfer.files[0];
  if (file) processExcelFile(file);
});

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
      
      // Process and validate data
      importedData = jsonData.map(row => ({
        claimNo: row.ClaimNo || row.claimNo || row["Claim No"] || row["Claim #"] || "",
        patient: row.Patient || row.patient || row.PatientName || row["Patient Name"] || "",
        balance: parseFloat(row.Balance || row.balance || 0),
        assignedTo: row.AssignTo || row.assignTo || row.AssignedTo || row["Assign To"] || null
      })).filter(row => row.claimNo && row.patient);
      
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
      <td>${employeeMap[row.assignedTo]?.name || row.assignedTo || 'Unassigned'}</td>
    </tr>
  `).join('');
  
  if (importedData.length > 10) {
    previewBody.innerHTML += `<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">... and ${importedData.length - 10} more</td></tr>`;
  }
  
  document.getElementById("importPreview").style.display = "block";
  document.getElementById("importBtn").disabled = false;
}

window.importClaims = function() {
  const newClaims = importedData.map(row => ({
    claimNo: row.claimNo,
    patient: row.patient,
    balance: row.balance,
    assignedTo: row.assignedTo || null,
    sharedWith: [],
    status: null,
    dateWorked: null,
    nextFollowUp: null,
    history: []
  }));
  
  claims = [...claims, ...newClaims];
  saveData();
  closeImportModal();
  render();
  showToast(`${newClaims.length} claims imported successfully!`);
};

// ==================== SAVE WORK ====================
saveBtn.onclick = () => {
  if (!remarksInput.value.trim()) {
    showToast("Remarks are required", "error");
    return;
  }
  
  const now = new Date();
  const followUpDays = parseInt(followUpDaysInput.value) || 14;
  const claim = claims[activeIndex];
  
  if (!claim.history) {
    claim.history = [];
  }
  
  // Add the new follow-up entry to history
  claim.history.push({
    remarks: remarksInput.value,
    status: statusInput.value,
    dateWorked: now,
    nextFollowUp: statusInput.value === "paid" ? null : calculateNextFollowUp(now, followUpDays),
    workedBy: currentUser.name
  });
  
  // Update current state
  claim.remarks = remarksInput.value;
  claim.status = statusInput.value;
  claim.dateWorked = now;
  claim.nextFollowUp = statusInput.value === "paid" ? null : calculateNextFollowUp(now, followUpDays);
  claim.lastWorkedBy = currentUser.id;
  
  saveData();
  modal.style.display = "none";
  render();
  showToast("Claim updated successfully!");
};

// ==================== INITIALIZATION ====================
// Initialize with sample data if empty
if (!claims.length) {
  claims = [
    { 
      claimNo: "CLM001", 
      patient: "John Doe", 
      balance: 750,
      assignedTo: "EMP001",
      sharedWith: ["EMP002"],
      status: "waiting",
      dateWorked: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      nextFollowUp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      history: [
        {
          remarks: "Initial follow-up call made. Patient aware of balance.",
          status: "waiting",
          dateWorked: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
          nextFollowUp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          workedBy: "Shubham"
        },
        {
          remarks: "Ravi followed up while Shubham was out. Patient requested more time.",
          status: "waiting",
          dateWorked: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          nextFollowUp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
          workedBy: "Ravi"
        }
      ]
    },
    { 
      claimNo: "CLM002", 
      patient: "Jane Smith", 
      balance: 300,
      assignedTo: "EMP002",
      sharedWith: [],
      status: "in-review",
      dateWorked: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      nextFollowUp: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      history: [
        {
          remarks: "Claim submitted to insurance for review.",
          status: "in-review",
          dateWorked: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
          nextFollowUp: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          workedBy: "Ravi"
        }
      ]
    },
    { 
      claimNo: "CLM003", 
      patient: "Robert Johnson", 
      balance: 1200,
      assignedTo: "EMP003",
      sharedWith: ["EMP001", "EMP002"],
      status: "unpaid",
      dateWorked: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      nextFollowUp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      history: []
    },
    { 
      claimNo: "CLM004", 
      patient: "Emily Davis", 
      balance: 450,
      assignedTo: "EMP001",
      sharedWith: [],
      status: "paid",
      dateWorked: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      nextFollowUp: null,
      history: [
        {
          remarks: "Payment received in full.",
          status: "paid",
          dateWorked: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
          nextFollowUp: null,
          workedBy: "Shubham"
        }
      ]
    },
    { 
      claimNo: "CLM005", 
      patient: "Michael Brown", 
      balance: 890,
      assignedTo: "EMP002",
      sharedWith: [],
      status: "waiting",
      dateWorked: null,
      nextFollowUp: null,
      history: []
    },
    { 
      claimNo: "CLM006", 
      patient: "Sarah Wilson", 
      balance: 560,
      assignedTo: null,
      sharedWith: [],
      status: null,
      dateWorked: null,
      nextFollowUp: null,
      history: []
    }
  ];
  saveData();
}

// Check for existing session on page load
checkSession();

// ==================== REAL-TIME SYNC ====================
// Listen for localStorage changes from other tabs
window.addEventListener('storage', function(e) {
  if (e.key === 'mnyc_claims') {
    claims = JSON.parse(e.newValue) || [];
    if (currentUser) {
      render();
      showToast('Data updated from another session', 'success');
    }
  }
});

// Refresh data function
window.refreshData = function() {
  claims = JSON.parse(localStorage.getItem("mnyc_claims")) || [];
  render();
  showToast('Data refreshed successfully!');
};

// Broadcast data changes to other tabs
function broadcastUpdate() {
  // Trigger storage event for other tabs by writing a timestamp
  localStorage.setItem('mnyc_lastUpdate', Date.now().toString());
}
