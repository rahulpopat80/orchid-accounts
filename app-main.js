// Orchid Heights - Double-Entry Accounting Software Logic

// ── Global State ──────────────────────────────────────────────────────────
let heads = [];
let transactions = [];
let memberDeposits = [];
let currentReportType = 'trial-balance';
let monthlyChartInstance = null;

// ── Firebase Sync State ───────────────────────────────────────────────────
let _firestoreSaveTimer = null;   // Debounce timer handle
let _firestoreIsSaving  = false;  // True while an async Firestore write is in-flight
let _firestoreListenerSet = false; // Ensure we only set onSnapshot once

// Translation Dictionary (English Only)
const translations = {
  en: {
    title_dashboard: "Dashboard - Overview",
    title_vouchers: "Voucher Transactions",
    title_ledger: "General Ledger Accounts",
    title_reports: "Financial Reports",
    title_deposits: "Member Maintenance Deposits",
    title_heads: "Chart of Account Heads",
    title_excel: "Excel Data Exchange",
    msg_tb_balanced: "Trial Balance is perfectly balanced! Total Debits equal Total Credits.",
    msg_tb_unbalanced: "Warning: Trial Balance is out of balance! Check entry adjustments.",
    lbl_net_profit: "Net Profit:",
    lbl_net_loss: "Net Loss:",
    msg_bs_balanced: "Balance Sheet matches perfectly! Assets = Liabilities + Capital.",
    msg_bs_unbalanced: "Warning: Balance Sheet is unbalanced! Check opening balances and entries.",
    payment_help: "Payment: Records cash/bank outgoings. Debits an Expense/Asset, Credits Cash/Bank.",
    receipt_help: "Receipt: Records cash/bank incomings. Debits Cash/Bank, Credits Income/Equity/Asset.",
    contra_help: "Contra: Records transfers between bank accounts or cash withdrawals/deposits. Debits Cash/Bank, Credits Cash/Bank.",
    journal_help: "Journal: Records adjustment/rectification entries between any two accounts."
  }
};

// Initialization on DOM Load
document.addEventListener("DOMContentLoaded", () => {
  initApp();
  
  // Set default dates for filters
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  
  document.getElementById("v-date").value = formatDateString(today);
  document.getElementById("ledger-from-date").value = formatDateString(firstDayOfMonth);
  document.getElementById("ledger-to-date").value = formatDateString(lastDayOfMonth);

  populateMonthSelector();

  // Setup drag and drop for Excel file
  setupDragAndDrop();

  // Run initial report
  runSelectedReport();
});

// App Initialization
function initApp() {
  loadFromLocalStorage();
  translateUI();
  adjustVoucherForm();
  renderDashboard();
  renderHeads();
  populateDropdowns();
  filterVouchers();
  populateMonthSelector();
}

// Format Date to YYYY-MM-DD
function formatDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Safely parse date strings of various formats (YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY) into a Date object
function parseDateSafely(dateStr) {
  if (!dateStr) return new Date();
  if (dateStr instanceof Date) return dateStr;
  
  const cleanStr = String(dateStr).trim();
  
  // Try parsing DD/MM/YYYY or DD-MM-YYYY
  const parts = cleanStr.split(/[-/]/);
  if (parts.length === 3) {
    if (parts[2].length === 4) {
      // DD-MM-YYYY or DD/MM/YYYY
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) return d;
    } else if (parts[0].length === 4) {
      // YYYY-MM-DD
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) return d;
    }
  }
  
  const d = new Date(cleanStr);
  if (!isNaN(d.getTime())) return d;
  
  return new Date();
}

// Local Storage Helper Functions
function saveToLocalStorage() {
  // 1. Always write to localStorage immediately (instant, works offline)
  localStorage.setItem("tally_heads", JSON.stringify(heads));
  localStorage.setItem("tally_transactions", JSON.stringify(transactions));
  localStorage.setItem("tally_member_deposits", JSON.stringify(memberDeposits));
  localStorage.setItem("tally_lang", 'en');

  // 2. Debounce Firestore write — batch rapid saves into one write every 2s
  setSyncStatus('syncing');
  if (_firestoreSaveTimer) clearTimeout(_firestoreSaveTimer);
  _firestoreSaveTimer = setTimeout(saveToFirestore, 2000);
}

function loadFromLocalStorage() {
  const storedHeads = localStorage.getItem("tally_heads");
  const storedTxns = localStorage.getItem("tally_transactions");
  const storedDeposits = localStorage.getItem("tally_member_deposits");

  if (storedHeads && storedTxns) {
    heads = JSON.parse(storedHeads);
    transactions = JSON.parse(storedTxns);
    memberDeposits = storedDeposits ? JSON.parse(storedDeposits) : [];
  } else {
    // Load from seed-data.js (which must be loaded in HTML before app-main.js)
    heads = [...defaultHeads];
    transactions = [...defaultTransactions];
    memberDeposits = [];
  }

  let migrated = false;

  // 1. Move all Maintenance Income (302) transaction entries to Member Maintenance Deposits (206)
  transactions.forEach(t => {
    if (t.debit_acc === '302') {
      t.debit_acc = '206';
      migrated = true;
    }
    if (t.credit_acc === '302') {
      t.credit_acc = '206';
      migrated = true;
    }
  });

  // Remove the Maintenance Income head from heads list if present
  const head302Index = heads.findIndex(h => h.id === '302');
  if (head302Index > -1) {
    heads.splice(head302Index, 1);
    migrated = true;
  }

  // ── Auto-Repair Corrupted Same-Account Entries (e.g. JCOM BANK -> JCOM BANK) ──
  transactions.forEach(t => {
    if (t.debit_acc && t.debit_acc === t.credit_acc && (t.debit_acc === '102' || t.debit_acc === '101')) {
      const isJcom = t.debit_acc === '102';
      const bankName = isJcom ? "JCOM Bank" : "CBI Bank";
      const targetHeadName = `${bankName} Interest`;
      
      // Look for the Interest head
      let interestHead = heads.find(h => h.name_en.toLowerCase() === targetHeadName.toLowerCase());
      if (!interestHead) {
        // Create the head if it got deleted/merged
        const newId = autoCreateHead(targetHeadName, 'Income', heads);
        interestHead = heads.find(h => h.id === newId);
      }

      if (t.voucher_type === 'Receipt') {
        // Receipt should Debit Bank (101/102) and Credit Income (Interest)
        t.credit_acc = interestHead.id;
        migrated = true;
      } else if (t.voucher_type === 'Payment') {
        // Payment should Debit Expense/Income and Credit Bank (101/102)
        t.debit_acc = interestHead.id;
        migrated = true;
      }
    }
  });

  // Strict matching helpers for main bank accounts to prevent corrupting other heads like "JCOM Bank Interest"
  const isJcomBank = (val) => {
    const clean = String(val || "").trim().toLowerCase().replace(/\s+/g, "");
    return clean === "102" || clean === "jcom" || clean === "jcombank" || clean === "bank:jcom" || clean === "bank:jcombank";
  };
  const isCbiBank = (val) => {
    const clean = String(val || "").trim().toLowerCase().replace(/\s+/g, "");
    return clean === "101" || clean === "cbi" || clean === "cbibank" || clean === "bank:cbi" || clean === "bank:cbibank";
  };

  // 2. Normalize Bank Head IDs and Transaction references to ensure 101/102 are used consistently
  heads.forEach(h => {
    if (isJcomBank(h.name_en) && h.id !== "102") {
      const oldId = h.id;
      transactions.forEach(t => {
        if (t.debit_acc === oldId) t.debit_acc = "102";
        if (t.credit_acc === oldId) t.credit_acc = "102";
      });
      h.id = "102";
      migrated = true;
    }
    if (isCbiBank(h.name_en) && h.id !== "101") {
      const oldId = h.id;
      transactions.forEach(t => {
        if (t.debit_acc === oldId) t.debit_acc = "101";
        if (t.credit_acc === oldId) t.credit_acc = "101";
      });
      h.id = "101";
      migrated = true;
    }
  });

  // Check if there are any duplicate bank heads and merge them
  const jcomHeads = heads.filter(h => h.id === "102");
  if (jcomHeads.length > 1) {
    heads = heads.filter(h => h.id !== "102");
    heads.push({ id: "102", name_en: "JCOM BANK", name_gu: "JCOM BANK", type: "Asset", group: "Bank Accounts", opening_balance: jcomHeads[0].opening_balance || 0, is_system: false });
    migrated = true;
  }
  const cbiHeads = heads.filter(h => h.id === "101");
  if (cbiHeads.length > 1) {
    heads = heads.filter(h => h.id !== "101");
    heads.push({ id: "101", name_en: "CBI BANK", name_gu: "CBI BANK", type: "Asset", group: "Bank Accounts", opening_balance: cbiHeads[0].opening_balance || 0, is_system: false });
    migrated = true;
  }

  // Ensure default Bank Account Heads exist with correct IDs
  if (!heads.some(h => h.id === "101")) {
    heads.push({ id: "101", name_en: "CBI BANK", name_gu: "CBI BANK", type: "Asset", group: "Bank Accounts", opening_balance: 0, is_system: false });
    migrated = true;
  }
  if (!heads.some(h => h.id === "102")) {
    heads.push({ id: "102", name_en: "JCOM BANK", name_gu: "JCOM BANK", type: "Asset", group: "Bank Accounts", opening_balance: 0, is_system: false });
    migrated = true;
  }

  // Ensure Member Maintenance Deposits (206) head exists
  if (!heads.some(h => h.id === "206")) {
    heads.push({ id: "206", name_en: "Member Maintenance Deposits", name_gu: "Member Maintenance Deposits", type: "Liability", group: "Current Liabilities", opening_balance: 0, is_system: true });
    migrated = true;
  }

  // Rename any heads having English/Alternative name matching "Bank: JCOM" or "Bank: CBI"
  heads.forEach(h => {
    if (isJcomBank(h.name_en) && h.name_en !== "JCOM BANK") {
      h.name_en = "JCOM BANK";
      h.name_gu = "JCOM BANK";
      migrated = true;
    }
    if (isCbiBank(h.name_en) && h.name_en !== "CBI BANK") {
      h.name_en = "CBI BANK";
      h.name_gu = "CBI BANK";
      migrated = true;
    }
  });

  // Clean up "Bank: JCOM" and "Bank: CBI" from transaction narrations and account codes
  transactions.forEach(t => {
    if (isJcomBank(t.debit_acc) && t.debit_acc !== "102") {
      t.debit_acc = "102";
      migrated = true;
    } else if (isCbiBank(t.debit_acc) && t.debit_acc !== "101") {
      t.debit_acc = "101";
      migrated = true;
    }
    
    if (isJcomBank(t.credit_acc) && t.credit_acc !== "102") {
      t.credit_acc = "102";
      migrated = true;
    } else if (isCbiBank(t.credit_acc) && t.credit_acc !== "101") {
      t.credit_acc = "101";
      migrated = true;
    }

    if (t.narration) {
      const orig = t.narration;
      t.narration = t.narration
        .replace(/\bBank:\s*JCOM\b/gi, "JCOM BANK")
        .replace(/\bBank:\s*CBI\b/gi, "CBI BANK");
      if (t.narration !== orig) migrated = true;
    }
  });

  // Clean up "Bank: JCOM" and "Bank: CBI" from member deposits bank details
  memberDeposits.forEach(d => {
    if (d.member_bank) {
      const orig = d.member_bank;
      d.member_bank = d.member_bank
        .replace(/\bBank:\s*JCOM\b/gi, "JCOM BANK")
        .replace(/\bBank:\s*CBI\b/gi, "CBI BANK");
      if (d.member_bank !== orig) migrated = true;
    }
    if (d.society_bank) {
      const orig = d.society_bank;
      if (isJcomBank(d.society_bank) && d.society_bank !== "102") {
        d.society_bank = "102";
        migrated = true;
      } else if (isCbiBank(d.society_bank) && d.society_bank !== "101") {
        d.society_bank = "101";
        migrated = true;
      }
    }
  });

  if (migrated) {
    saveToLocalStorage();
  }

  // Start real-time Firebase listener for cross-device sync
  setupRealtimeSync();
}

// Reset data to seed values (also clears Firestore)
function resetToSeedData() {
  const confirmMsg = "Are you sure you want to reset all data to default template? This will erase ALL data including from cloud sync.";
  if (confirm(confirmMsg)) {
    localStorage.removeItem("tally_heads");
    localStorage.removeItem("tally_transactions");
    localStorage.removeItem("tally_member_deposits");
    localStorage.removeItem("tally_last_sync");

    // Also clear Firestore so other devices get reset too
    if (typeof DATA_DOC !== 'undefined') {
      DATA_DOC.delete().catch(err => console.warn('[Firebase] Reset clear error:', err));
    }

    heads = [...defaultHeads];
    transactions = [...defaultTransactions];
    memberDeposits = [];
    saveToLocalStorage(); // This will also sync reset to Firestore after 2s
    initApp();
  }
}

// ============================================================
// FIREBASE SYNC FUNCTIONS
// ============================================================

// Async: write all data to Firestore as a single document
async function saveToFirestore() {
  if (typeof DATA_DOC === 'undefined') return;
  try {
    _firestoreIsSaving = true;
    setSyncStatus('syncing');
    await DATA_DOC.set({
      heads: heads,
      transactions: transactions,
      memberDeposits: memberDeposits,
      lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    });
    // Record local timestamp so we can compare with remote later
    localStorage.setItem('tally_last_sync', String(Date.now()));
    setSyncStatus('synced');
    console.log('[Firebase] ✅ Data synced to Firestore successfully.');
  } catch (err) {
    console.error('[Firebase] ❌ Save error:', err);
    setSyncStatus('offline');
  } finally {
    _firestoreIsSaving = false;
  }
}

// Set up a real-time Firestore listener — fires immediately with current data,
// then fires again whenever any other device saves.
function setupRealtimeSync() {
  if (_firestoreListenerSet || typeof DATA_DOC === 'undefined') return;
  _firestoreListenerSet = true;

  DATA_DOC.onSnapshot((doc) => {
    // Skip if WE are the ones who just saved (avoid feedback loop)
    if (_firestoreIsSaving) return;

    if (doc.exists) {
      const data = doc.data();
      if (data && data.heads && data.transactions) {
        const remoteMs  = data.lastUpdated ? data.lastUpdated.toMillis() : 0;
        const localMs   = parseInt(localStorage.getItem('tally_last_sync') || '0');

        if (remoteMs > localMs) {
          // Remote data is newer — cancel any pending local save and use remote data
          if (_firestoreSaveTimer) {
            clearTimeout(_firestoreSaveTimer);
            _firestoreSaveTimer = null;
          }

          heads          = data.heads;
          transactions   = data.transactions;
          memberDeposits = data.memberDeposits || [];

          // Update local cache
          localStorage.setItem('tally_heads',            JSON.stringify(heads));
          localStorage.setItem('tally_transactions',     JSON.stringify(transactions));
          localStorage.setItem('tally_member_deposits',  JSON.stringify(memberDeposits));
          localStorage.setItem('tally_last_sync',        String(remoteMs));

          // Re-render the entire UI with fresh data
          translateUI();
          adjustVoucherForm();
          renderDashboard();
          renderHeads();
          populateDropdowns();
          filterVouchers();
          if (typeof initDepositsTab === 'function') initDepositsTab();
          if (typeof runSelectedReport === 'function') runSelectedReport();

          setSyncStatus('synced');
          console.log('[Firebase] 🔄 Real-time update received from another device.');
        } else {
          // Remote data is same age or older — still mark as synced
          setSyncStatus('synced');
        }
      }
    } else {
      // Document doesn't exist yet in Firestore — push local data up
      setSyncStatus('syncing');
      saveToFirestore();
    }
  }, (err) => {
    console.error('[Firebase] Listener error:', err);
    setSyncStatus('offline');
  });
}

// Update the sync status badge in the header
function setSyncStatus(state) {
  const badge = document.getElementById('sync-status-badge');
  if (!badge) return;
  const icons = {
    synced:  '<i class="fa-solid fa-cloud-arrow-up"></i> Synced',
    syncing: '<i class="fa-solid fa-rotate fa-spin"></i> Syncing...',
    offline: '<i class="fa-solid fa-wifi"></i> Offline'
  };
  badge.innerHTML   = icons[state] || icons.offline;
  badge.className   = `sync-badge sync-${state} no-print`;
}

// Translation Engine
function translateUI() {
  const langObj = translations['en'];
  
  // 1. Text elements translations
  document.querySelectorAll("[data-key]").forEach(elem => {
    const key = elem.getAttribute("data-key");
    if (langObj[key]) {
      elem.textContent = langObj[key];
    }
  });

  // 2. Placeholder translations
  document.querySelectorAll("[data-key-placeholder]").forEach(elem => {
    const key = elem.getAttribute("data-key-placeholder");
    if (langObj[key]) {
      elem.setAttribute("placeholder", langObj[key]);
    }
  });
}

function getTranslation(key) {
  return translations['en'][key] || key;
}

// Get Head Name
function getHeadName(head) {
  if (!head) return "";
  return head.name_en;
}

// Navigation Tab Switching
function switchTab(tabId) {
  // Hide all panels
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(i => i.classList.remove("active"));
  
  // Show active panel
  document.getElementById(tabId).classList.add("active");
  
  // Update active sidebar nav
  const activeNav = document.querySelector(`.nav-item[href="#${tabId}"]`);
  if (activeNav) activeNav.classList.add("active");

  // Update header page title
  const titleKey = `title_${tabId}`;
  document.getElementById("current-page-title").textContent = getTranslation(titleKey);

  // Trigger tab-specific render
  if (tabId === 'dashboard') {
    renderDashboard();
  } else if (tabId === 'vouchers') {
    populateDropdowns();
    filterVouchers();
  } else if (tabId === 'ledger') {
    populateDropdowns();
    generateLedger();
  } else if (tabId === 'reports') {
    populateMonthSelector();
    runSelectedReport();
  } else if (tabId === 'heads') {
    renderHeads();
  } else if (tabId === 'deposits') {
    initDepositsTab();
  }
}

// Formatting Indian Rupees (currency standard formatting)
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2
  }).format(amount);
}

// ==========================================
// 1. DASHBOARD TAB LOGIC
// ==========================================
function renderDashboard() {
  // Calculate running balances for Cash & Bank
  let totalBank = 0;
  let totalCash = 0;

  heads.forEach(h => {
    const balInfo = calculateAccountBalance(h.id);
    if (h.type === 'Asset') {
      if (h.group === 'Bank Accounts' || h.group === 'Investments') {
        totalBank += balInfo.closing;
      } else if (h.group === 'Cash Account') {
        totalCash += balInfo.closing;
      }
    }
  });

  document.getElementById("kpi-bank-bal").textContent = formatCurrency(totalBank);
  document.getElementById("kpi-cash-bal").textContent = formatCurrency(totalCash);

  // Current month Income & Expenses
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth(); // 0-indexed

  let monthlyIncome = 0;
  let monthlyExpense = 0;

  transactions.forEach(t => {
    const tDate = new Date(t.date);
    if (tDate.getFullYear() === currentYear && tDate.getMonth() === currentMonth) {
      const debitHead = heads.find(h => h.id === t.debit_acc);
      const creditHead = heads.find(h => h.id === t.credit_acc);

      if (debitHead && debitHead.type === 'Expense') {
        monthlyExpense += t.amount;
      }
      if (creditHead && creditHead.type === 'Income') {
        monthlyIncome += t.amount;
      }
    }
  });

  document.getElementById("kpi-total-income").textContent = formatCurrency(monthlyIncome);
  document.getElementById("kpi-total-expense").textContent = formatCurrency(monthlyExpense);

  // Render recent transaction list
  const recentTbody = document.getElementById("recent-txns-tbody");
  recentTbody.innerHTML = "";

  // Get last 5 transactions sorted by date desc
  const sortedTxns = [...transactions]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  if (sortedTxns.length === 0) {
    recentTbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">No transactions recorded yet.</td></tr>`;
  } else {
    sortedTxns.forEach(t => {
      const drHead = heads.find(h => h.id === t.debit_acc);
      const crHead = heads.find(h => h.id === t.credit_acc);
      
      const tr = document.createElement("tr");
      tr.style.cursor = "pointer";
      tr.title = "Click to edit transaction";
      tr.onclick = () => {
        switchTab('vouchers');
        editVoucher(t.id);
      };
      tr.innerHTML = `
        <td>${t.date.split("-").reverse().join("/")}</td>
        <td><span class="badge badge-${t.voucher_type.toLowerCase()}">${t.voucher_type}</span></td>
        <td>
          <div class="text-danger"><i class="fa-solid fa-circle-down"></i> Dr: ${getHeadName(drHead)}</div>
          <div class="text-success"><i class="fa-solid fa-circle-up"></i> Cr: ${getHeadName(crHead)}</div>
        </td>
        <td class="text-right font-weight-bold">${formatCurrency(t.amount)}</td>
      `;
      recentTbody.appendChild(tr);
    });
  }

  // Draw chart
  renderMonthlyChart();
}

// Render line/bar chart for expenses vs income
function renderMonthlyChart() {
  const ctx = document.getElementById('monthlyChart').getContext('2d');
  
  if (monthlyChartInstance) {
    monthlyChartInstance.destroy();
  }

  // Calculate numbers for last 6 months
  const labels = [];
  const incomeData = [];
  const expenseData = [];
  
  const today = new Date();
  
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const mNum = d.getMonth();
    const yNum = d.getFullYear();
    
    const monthNamesEn = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const mLabel = `${monthNamesEn[mNum]} ${yNum}`;
    labels.push(mLabel);

    // Sum matching transactions
    let monthInc = 0;
    let monthExp = 0;
    
    transactions.forEach(t => {
      const tDate = new Date(t.date);
      if (tDate.getFullYear() === yNum && tDate.getMonth() === mNum) {
        const debitHead = heads.find(h => h.id === t.debit_acc);
        const creditHead = heads.find(h => h.id === t.credit_acc);

        if (debitHead && debitHead.type === 'Expense') {
          monthExp += t.amount;
        }
        if (creditHead && creditHead.type === 'Income') {
          monthInc += t.amount;
        }
      }
    });

    incomeData.push(monthInc);
    expenseData.push(monthExp);
  }

  monthlyChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Income',
          data: incomeData,
          backgroundColor: 'rgba(16, 185, 129, 0.65)',
          borderColor: '#10b981',
          borderWidth: 1,
          borderRadius: 4
        },
        {
          label: 'Expenses',
          data: expenseData,
          backgroundColor: 'rgba(239, 68, 68, 0.65)',
          borderColor: '#ef4444',
          borderWidth: 1,
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: '#94a3b8',
            font: { family: 'Inter' }
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#94a3b8', font: { family: 'Inter' } }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#94a3b8', font: { family: 'Inter' } }
        }
      }
    }
  });
}

// ==========================================
// 2. VOUCHER ENTRY TAB LOGIC
// ==========================================
function populateDropdowns() {
  const drSelect = document.getElementById("v-debit");
  const crSelect = document.getElementById("v-credit");
  const ledgerSelect = document.getElementById("ledger-head-select");
  
  if (!drSelect || !crSelect) return;

  const voucherType = document.getElementById("v-type").value;
  
  const prevDr = drSelect.value;
  const prevCr = crSelect.value;
  const prevLedger = ledgerSelect ? ledgerSelect.value : "";

  let drOptions = `<option value="" disabled selected>-- Select Debit Head --</option>`;
  let crOptions = `<option value="" disabled selected>-- Select Credit Head --</option>`;
  let ledgerOptions = "";

  const sortedHeads = [...heads].sort((a, b) => getHeadName(a).localeCompare(getHeadName(b)));

  sortedHeads.forEach(h => {
    const name = `${getHeadName(h)} (${h.type})`;
    
    ledgerOptions += `<option value="${h.id}">${name}</option>`;

    if (voucherType === 'Payment') {
      if (isCashOrBank(h)) {
        crOptions += `<option value="${h.id}">${name}</option>`;
      }
      if (!isCashOrBank(h) || h.type === 'Asset') {
        drOptions += `<option value="${h.id}">${name}</option>`;
      }
    } 
    else if (voucherType === 'Receipt') {
      if (isCashOrBank(h)) {
        drOptions += `<option value="${h.id}">${name}</option>`;
      }
      if (!isCashOrBank(h) || h.type === 'Income' || h.type === 'Equity' || h.type === 'Asset') {
        crOptions += `<option value="${h.id}">${name}</option>`;
      }
    } 
    else if (voucherType === 'Contra') {
      if (isCashOrBank(h)) {
        drOptions += `<option value="${h.id}">${name}</option>`;
        crOptions += `<option value="${h.id}">${name}</option>`;
      }
    } 
    else {
      drOptions += `<option value="${h.id}">${name}</option>`;
      crOptions += `<option value="${h.id}">${name}</option>`;
    }
  });

  drSelect.innerHTML = drOptions;
  crSelect.innerHTML = crOptions;
  
  if (ledgerSelect) {
    ledgerSelect.innerHTML = ledgerOptions;
    if (prevLedger && heads.some(h => h.id === prevLedger)) {
      ledgerSelect.value = prevLedger;
    }
  }

  if (prevDr && Array.from(drSelect.options).some(o => o.value === prevDr)) {
    drSelect.value = prevDr;
  }
  if (prevCr && Array.from(crSelect.options).some(o => o.value === prevCr)) {
    crSelect.value = prevCr;
  }
}

function isCashOrBank(head) {
  return head.type === 'Asset' && (head.group === 'Bank Accounts' || head.group === 'Cash Account' || head.group === 'Investments');
}

function populateMonthSelector() {
  const select = document.getElementById("reports-month-select");
  if (!select) return;

  // Preserve currently selected value if any
  const prevVal = select.value;

  select.innerHTML = "";

  const monthNames = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];

  // 1. Scan unique year-month strings from transactions
  const uniqueMonths = new Set();
  const now = new Date();

  transactions.forEach(t => {
    if (!t.date) return;
    const parsedDate = parseDateSafely(t.date);
    const y = parsedDate.getFullYear();
    const m = parsedDate.getMonth();
    const monthStr = String(m + 1).padStart(2, '0');
    uniqueMonths.add(`${y}-${monthStr}`);
  });

  // Fallback if no entries match
  if (uniqueMonths.size === 0) {
    const y = now.getFullYear();
    const mStr = String(now.getMonth() + 1).padStart(2, '0');
    uniqueMonths.add(`${y}-${mStr}`);
  }

  // Convert Set to array and sort chronologically
  const sortedMonths = Array.from(uniqueMonths).sort((a, b) => {
    return new Date(a + "-01") - new Date(b + "-01");
  });

  // Populate options
  let optionsHtml = "";
  sortedMonths.forEach((mStr, index) => {
    const parts = mStr.split("-");
    const y = parseInt(parts[0]);
    const m = parseInt(parts[1]) - 1;
    
    const label = `${monthNames[m]}-${y}`;
    
    // Default selection: if previous selection exists and matches, select it.
    // Otherwise, default select the last (latest) month in the chronological list.
    let isSelected = false;
    if (prevVal) {
      isSelected = prevVal === mStr;
    } else {
      isSelected = index === sortedMonths.length - 1;
    }

    optionsHtml += `<option value="${mStr}" ${isSelected ? 'selected' : ''}>${label}</option>`;
  });

  select.innerHTML = optionsHtml;
}

// Adjust Voucher Help Text when type changes
function adjustVoucherForm() {
  const vType = document.getElementById("v-type").value;
  const helpTextElem = document.getElementById("voucher-help-text");
  
  if (vType === 'Payment') {
    helpTextElem.textContent = getTranslation('payment_help');
  } else if (vType === 'Receipt') {
    helpTextElem.textContent = getTranslation('receipt_help');
  } else if (vType === 'Contra') {
    helpTextElem.textContent = getTranslation('contra_help');
  } else {
    helpTextElem.textContent = getTranslation('journal_help');
  }

  populateDropdowns();
}

function resetVoucherForm() {
  document.getElementById("voucher-id").value = "";
  document.getElementById("v-amount").value = "";
  document.getElementById("v-narration").value = "";
  document.getElementById("voucher-form-title").textContent = "Create Voucher Entry";
  document.getElementById("btn-save-voucher").querySelector("span").textContent = "Save Entry";
  
  document.getElementById("v-date").value = formatDateString(new Date());

  adjustVoucherForm();
}

// Save or Update Voucher
function saveVoucher(event) {
  event.preventDefault();

  const id = document.getElementById("voucher-id").value;
  const date = document.getElementById("v-date").value;
  const voucher_type = document.getElementById("v-type").value;
  const debit_acc = document.getElementById("v-debit").value;
  const credit_acc = document.getElementById("v-credit").value;
  const amount = parseFloat(document.getElementById("v-amount").value);
  const narration = document.getElementById("v-narration").value;

  if (!date || !voucher_type || !debit_acc || !credit_acc || isNaN(amount)) {
    alert("Please fill all required fields!");
    return;
  }

  if (debit_acc === credit_acc) {
    alert("Debit and Credit account cannot be the same! Double-entry requires two different accounts.");
    return;
  }

  if (id) {
    // Edit Mode
    const txnIndex = transactions.findIndex(t => t.id === id);
    if (txnIndex > -1) {
      transactions[txnIndex] = { id, date, voucher_type, debit_acc, credit_acc, amount, narration };
    }
  } else {
    // New Mode
    const newId = "TXN" + String(Date.now()).substring(7);
    transactions.push({ id: newId, date, voucher_type, debit_acc, credit_acc, amount, narration });
  }

  saveToLocalStorage();
  resetVoucherForm();
  filterVouchers();
  
  alert("Voucher entry saved successfully!");
}

// Filter and Render Transaction history list
function filterVouchers() {
  const searchVal = document.getElementById("voucher-search").value.toLowerCase();
  const typeFilter = document.getElementById("voucher-type-filter").value;
  
  const tbody = document.getElementById("vouchers-tbody");
  tbody.innerHTML = "";

  const filtered = transactions.filter(t => {
    const drHead = heads.find(h => h.id === t.debit_acc);
    const crHead = heads.find(h => h.id === t.credit_acc);
    
    const drName = drHead ? getHeadName(drHead).toLowerCase() : "";
    const crName = crHead ? getHeadName(crHead).toLowerCase() : "";
    const narr = t.narration ? t.narration.toLowerCase() : "";
    const amtStr = String(t.amount);
    const matchSearch = drName.includes(searchVal) || crName.includes(searchVal) || narr.includes(searchVal) || t.id.toLowerCase().includes(searchVal) || amtStr.includes(searchVal);
    const matchType = typeFilter === "" || t.voucher_type === typeFilter;
    
    return matchSearch && matchType;
  });

  filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No transactions found.</td></tr>`;
    return;
  }

  filtered.forEach(t => {
    const drHead = heads.find(h => h.id === t.debit_acc);
    const crHead = heads.find(h => h.id === t.credit_acc);

    const tr = document.createElement("tr");
    tr.style.cursor = "pointer";
    tr.title = "Click to edit transaction";
    tr.onclick = (e) => {
      if (e.target.closest('.btn-delete')) return;
      editVoucher(t.id);
    };
    tr.innerHTML = `
      <td>${t.date.split("-").reverse().join("/")}</td>
      <td><span class="badge badge-${t.voucher_type.toLowerCase()}">${t.voucher_type}</span></td>
      <td class="text-danger"><i class="fa-solid fa-circle-down"></i> ${getHeadName(drHead) || t.debit_acc}</td>
      <td class="text-success"><i class="fa-solid fa-circle-up"></i> ${getHeadName(crHead) || t.credit_acc}</td>
      <td class="text-right font-weight-bold">${formatCurrency(t.amount)}</td>
      <td class="text-center no-print">
        <button class="btn-icon btn-delete" title="Delete" onclick="deleteVoucher('${t.id}')">
          <i class="fa-solid fa-trash"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function editVoucher(id) {
  const txn = transactions.find(t => t.id === id);
  if (!txn) return;

  document.getElementById("voucher-id").value = txn.id;
  document.getElementById("v-date").value = txn.date;
  document.getElementById("v-type").value = txn.voucher_type;
  
  adjustVoucherForm();
  
  document.getElementById("v-debit").value = txn.debit_acc;
  document.getElementById("v-credit").value = txn.credit_acc;
  document.getElementById("v-amount").value = txn.amount;
  document.getElementById("v-narration").value = txn.narration || "";

  document.getElementById("voucher-form-title").textContent = "Edit Voucher Entry";
  document.getElementById("btn-save-voucher").querySelector("span").textContent = "Update Entry";

  document.querySelector(".voucher-form-card").scrollIntoView({ behavior: 'smooth' });
}

function deleteVoucher(id) {
  const confirmMsg = "Are you sure you want to delete this transaction?";
  if (confirm(confirmMsg)) {
    transactions = transactions.filter(t => t.id !== id);
    saveToLocalStorage();
    filterVouchers();
  }
}

// ==========================================
// 3. GENERAL LEDGER TAB LOGIC
// ==========================================
function calculateAccountBalance(headId, upToDate = null, fromDate = null) {
  const head = heads.find(h => h.id === headId);
  if (!head) return { opening: 0, debits: 0, credits: 0, closing: 0 };

  const isIncomeOrExpense = head.type === 'Income' || head.type === 'Expense';
  const effectiveFromDate = isIncomeOrExpense ? fromDate : null;

  // Safely parse opening balance as numeric
  const opening = effectiveFromDate ? 0 : (parseFloat(String(head.opening_balance || 0).replace(/[^0-9.-]/g, '')) || 0);
  let debitsBefore = 0;
  let creditsBefore = 0;

  const cleanUpToDate = upToDate ? formatDateString(parseDateSafely(upToDate)) : null;
  const cleanFromDate = effectiveFromDate ? formatDateString(parseDateSafely(effectiveFromDate)) : null;

  transactions.forEach(t => {
    const cleanTDate = formatDateString(parseDateSafely(t.date));
    if (cleanUpToDate && cleanTDate > cleanUpToDate) return;
    if (cleanFromDate && cleanTDate < cleanFromDate) return;

    if (t.debit_acc === headId) {
      debitsBefore += t.amount;
    }
    if (t.credit_acc === headId) {
      creditsBefore += t.amount;
    }
  });

  let closing = 0;
  if (head.type === 'Asset' || head.type === 'Expense') {
    closing = opening + debitsBefore - creditsBefore;
  } else {
    closing = opening + creditsBefore - debitsBefore;
  }

  return {
    opening,
    debits: debitsBefore,
    credits: creditsBefore,
    closing
  };
}

function generateLedger() {
  const headId = document.getElementById("ledger-head-select").value;
  const fromDateVal = document.getElementById("ledger-from-date").value;
  const toDateVal = document.getElementById("ledger-to-date").value;

  if (!headId) return;

  const head = heads.find(h => h.id === headId);
  if (!head) return;

  let openingBal = parseFloat(String(head.opening_balance || 0).replace(/[^0-9.-]/g, '')) || 0;
  let totalPeriodDebits = 0;
  let totalPeriodCredits = 0;

  const isDebitAccount = head.type === 'Asset' || head.type === 'Expense';
  const cronTxns = [...transactions].sort((a, b) => formatDateString(parseDateSafely(a.date)).localeCompare(formatDateString(parseDateSafely(b.date))));

  const cleanFromDateVal = fromDateVal ? formatDateString(parseDateSafely(fromDateVal)) : null;
  const cleanToDateVal = toDateVal ? formatDateString(parseDateSafely(toDateVal)) : null;

  if (cleanFromDateVal) {
    cronTxns.forEach(t => {
      const cleanTDate = formatDateString(parseDateSafely(t.date));
      if (cleanTDate < cleanFromDateVal) {
        if (t.debit_acc === headId) {
          openingBal += (isDebitAccount ? t.amount : -t.amount);
        }
        if (t.credit_acc === headId) {
          openingBal += (isDebitAccount ? -t.amount : t.amount);
        }
      }
    });
  }

  document.getElementById("ledger-title-text").textContent = `${getHeadName(head)} - Ledger A/c`;
  document.getElementById("ledger-meta-type").textContent = `${head.type} (${head.group})`;
  document.getElementById("ledger-meta-opening").textContent = formatCurrency(openingBal);
  
  const dFromFormatted = fromDateVal ? fromDateVal.split("-").reverse().join("/") : "Start";
  const dToFormatted = toDateVal ? toDateVal.split("-").reverse().join("/") : "End";
  document.getElementById("ledger-date-range").textContent = `Date: ${dFromFormatted} to ${dToFormatted}`;

  const tbody = document.getElementById("ledger-tbody");
  tbody.innerHTML = "";

  let currentRunningBal = openingBal;
  const openRow = document.createElement("tr");
  openRow.innerHTML = `
    <td>${fromDateVal || ""}</td>
    <td class="text-muted"><em>Opening Balance b/f</em></td>
    <td>-</td>
    <td class="text-right">-</td>
    <td class="text-right">-</td>
    <td class="text-right font-weight-bold">${formatCurrency(openingBal)}</td>
  `;
  tbody.appendChild(openRow);

  const periodTxns = cronTxns.filter(t => {
    const cleanTDate = formatDateString(parseDateSafely(t.date));
    const matchFrom = !cleanFromDateVal || cleanTDate >= cleanFromDateVal;
    const matchTo = !cleanToDateVal || cleanTDate <= cleanToDateVal;
    return (t.debit_acc === headId || t.credit_acc === headId) && matchFrom && matchTo;
  });

  if (periodTxns.length === 0 && openingBal === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No transactions found in this period.</td></tr>`;
    document.getElementById("ledger-total-debit").textContent = formatCurrency(0);
    document.getElementById("ledger-total-credit").textContent = formatCurrency(0);
    document.getElementById("ledger-final-balance").textContent = formatCurrency(0);
    return;
  }

  periodTxns.forEach(t => {
    const tr = document.createElement("tr");
    tr.style.cursor = "pointer";
    tr.title = "Click to edit transaction";
    tr.onclick = () => {
      switchTab('vouchers');
      editVoucher(t.id);
    };
    let particulars = "";
    let drAmt = "-";
    let crAmt = "-";

    if (t.debit_acc === headId) {
      const oppositeHead = heads.find(h => h.id === t.credit_acc);
      particulars = `To ${getHeadName(oppositeHead)}`;
      drAmt = formatCurrency(t.amount);
      totalPeriodDebits += t.amount;
      currentRunningBal += (isDebitAccount ? t.amount : -t.amount);
    } else {
      const oppositeHead = heads.find(h => h.id === t.debit_acc);
      particulars = `By ${getHeadName(oppositeHead)}`;
      crAmt = formatCurrency(t.amount);
      totalPeriodCredits += t.amount;
      currentRunningBal += (isDebitAccount ? -t.amount : t.amount);
    }

    if (t.narration) {
      particulars += `<br><span style="color: #000000; font-weight: normal; font-size:10.5px; padding-left:12px;">(${t.narration})</span>`;
    }

    tr.innerHTML = `
      <td>${t.date.split("-").reverse().join("/")}</td>
      <td>${particulars}</td>
      <td><span class="badge badge-${t.voucher_type.toLowerCase()}">${t.voucher_type}</span></td>
      <td class="text-right text-danger">${drAmt}</td>
      <td class="text-right text-success">${crAmt}</td>
      <td class="text-right font-weight-bold">${formatCurrency(currentRunningBal)}</td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById("ledger-total-debit").textContent = formatCurrency(totalPeriodDebits);
  document.getElementById("ledger-total-credit").textContent = formatCurrency(totalPeriodCredits);
  document.getElementById("ledger-final-balance").textContent = formatCurrency(currentRunningBal);
}

// ==========================================
// 4. FINANCIAL REPORTS TAB LOGIC
// ==========================================
function switchReport(reportType) {
  currentReportType = reportType;
  
  document.querySelectorAll(".report-tab-btn").forEach(btn => btn.classList.remove("active"));
  if (reportType === 'trial-balance') document.getElementById("btn-tb-tab").classList.add("active");
  if (reportType === 'profit-loss') document.getElementById("btn-pl-tab").classList.add("active");
  if (reportType === 'balance-sheet') document.getElementById("btn-bs-tab").classList.add("active");
  if (reportType === 'expense-report') document.getElementById("btn-er-tab").classList.add("active");
  if (reportType === 'bank-statement') document.getElementById("btn-bank-tab").classList.add("active");

  const bankWrapper = document.getElementById("reports-bank-select-wrapper");
  if (bankWrapper) {
    if (reportType === 'bank-statement') {
      bankWrapper.style.display = "inline-flex";
      const bankSelect = document.getElementById("reports-bank-select");
      if (bankSelect) {
        bankSelect.innerHTML = "";
        const bankHeads = heads.filter(h => h.type === 'Asset' && h.group === 'Bank Accounts');
        let bankOptions = "";
        bankHeads.forEach(h => {
          bankOptions += `<option value="${h.id}">${h.name_en}</option>`;
        });
        bankSelect.innerHTML = bankOptions;
      }
    } else {
      bankWrapper.style.display = "none";
    }
  }

  document.querySelectorAll(".report-panel").forEach(p => p.classList.remove("active"));
  document.getElementById(`${reportType}-panel`).classList.add("active");

  runSelectedReport();
}

// Force English translation values
function getTranslation(key) {
  return translations['en'][key] || key;
}

function runSelectedReport() {
  const monthSelect = document.getElementById("reports-month-select");
  if (!monthSelect) return;
  
  const monthVal = monthSelect.value;
  if (!monthVal) return;

  const parts = monthVal.split("-");
  const year = parseInt(parts[0]);
  const month = parseInt(parts[1]) - 1;

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const fromDate = formatDateString(firstDay);
  const toDate = formatDateString(lastDay);
  
  const displayFrom = fromDate.split("-").reverse().join("/");
  const displayTo = toDate.split("-").reverse().join("/");
  
  document.querySelectorAll(".current-report-date").forEach(el => {
    if (currentReportType === 'profit-loss' || currentReportType === 'expense-report' || currentReportType === 'bank-statement') {
      el.textContent = `${displayFrom} to ${displayTo}`;
    } else {
      el.textContent = displayTo;
    }
  });

  if (currentReportType === 'trial-balance') {
    generateTrialBalance(toDate);
  } else if (currentReportType === 'profit-loss') {
    generateProfitLoss(fromDate, toDate);
  } else if (currentReportType === 'balance-sheet') {
    generateBalanceSheet(toDate);
  } else if (currentReportType === 'expense-report') {
    generateMonthlyExpenseReport(fromDate, toDate);
  } else if (currentReportType === 'bank-statement') {
    generateBankStatement(fromDate, toDate);
  }
}

function generateTrialBalance(toDate) {
  const tbody = document.getElementById("tb-tbody");
  tbody.innerHTML = "";

  let grandTotalDebit = 0;
  let grandTotalCredit = 0;

  heads.forEach(h => {
    const balInfo = calculateAccountBalance(h.id, toDate);
    if (balInfo.closing === 0) return;

    const isDebitType = h.type === 'Asset' || h.type === 'Expense';
    let drVal = 0;
    let crVal = 0;

    if (isDebitType) {
      drVal = balInfo.closing;
      grandTotalDebit += drVal;
    } else {
      crVal = balInfo.closing;
      grandTotalCredit += crVal;
    }

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${getHeadName(h)}</td>
      <td>${h.type}</td>
      <td class="text-right text-danger">${drVal > 0 ? formatCurrency(drVal) : "-"}</td>
      <td class="text-right text-success">${crVal > 0 ? formatCurrency(crVal) : "-"}</td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById("tb-total-debit").textContent = formatCurrency(grandTotalDebit);
  document.getElementById("tb-total-credit").textContent = formatCurrency(grandTotalCredit);

  const alertBox = document.getElementById("tb-validator-alert");
  const diff = Math.abs(grandTotalDebit - grandTotalCredit);
  
  if (diff < 0.01) {
    alertBox.className = "trial-balance-validation alert-success";
    alertBox.innerHTML = `<i class="fa-solid fa-circle-check"></i> <span>${getTranslation('msg_tb_balanced')}</span>`;
  } else {
    alertBox.className = "trial-balance-validation alert-danger text-danger";
    alertBox.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> <span>${getTranslation('msg_tb_unbalanced')} (Difference: ${formatCurrency(diff)})</span>`;
  }
}

function calculateNetProfitLoss(toDate, fromDate = null) {
  let totalIncome = 0;
  let totalExpense = 0;

  heads.forEach(h => {
    if (h.type === 'Income' || h.type === 'Expense') {
      const balInfo = calculateAccountBalance(h.id, toDate, fromDate);
      if (h.type === 'Income') {
        totalIncome += balInfo.closing;
      } else {
        totalExpense += balInfo.closing;
      }
    }
  });

  return {
    totalIncome,
    totalExpense,
    netProfit: totalIncome - totalExpense
  };
}

function generateProfitLoss(fromDate, toDate) {
  const expTbody = document.getElementById("pl-expenses-tbody");
  const incTbody = document.getElementById("pl-incomes-tbody");
  
  expTbody.innerHTML = "";
  incTbody.innerHTML = "";

  let totalExpenseSum = 0;
  let totalIncomeSum = 0;

  heads.forEach(h => {
    if (h.type === 'Income' || h.type === 'Expense') {
      const balInfo = calculateAccountBalance(h.id, toDate, fromDate);
      if (balInfo.closing === 0) return;

      const tr = document.createElement("tr");
      const isExpense = h.type === 'Expense';
      tr.innerHTML = `
        <td>${isExpense ? `<strong>${getHeadName(h)}</strong>` : getHeadName(h)}</td>
        <td class="text-right ${isExpense ? 'text-danger' : 'text-success'}">${formatCurrency(balInfo.closing)}</td>
      `;

      if (isExpense) {
        expTbody.appendChild(tr);
        totalExpenseSum += balInfo.closing;
      } else {
        incTbody.appendChild(tr);
        totalIncomeSum += balInfo.closing;
      }
    }
  });

  if (totalExpenseSum === 0) {
    expTbody.innerHTML = `<tr><td colspan="2" class="text-center text-muted">No expenses recorded.</td></tr>`;
  }
  if (totalIncomeSum === 0) {
    incTbody.innerHTML = `<tr><td colspan="2" class="text-center text-muted">No income recorded.</td></tr>`;
  }

  document.getElementById("pl-total-expenses").textContent = formatCurrency(totalExpenseSum);
  document.getElementById("pl-total-incomes").textContent = formatCurrency(totalIncomeSum);

  const netResults = calculateNetProfitLoss(toDate, fromDate);
  const resultBox = document.getElementById("pl-net-result-box");
  const labelElem = document.getElementById("pl-net-result-label");
  const valElem = document.getElementById("pl-net-result-val");

  if (netResults.netProfit >= 0) {
    resultBox.className = "pl-net-result-card net-profit-theme";
    labelElem.textContent = getTranslation("lbl_net_profit");
    valElem.textContent = formatCurrency(netResults.netProfit);
  } else {
    resultBox.className = "pl-net-result-card net-loss-theme";
    labelElem.textContent = getTranslation("lbl_net_loss");
    valElem.textContent = formatCurrency(Math.abs(netResults.netProfit));
  }
}

function generateBalanceSheet(toDate) {
  const liabTbody = document.getElementById("bs-liabilities-tbody");
  const assetTbody = document.getElementById("bs-assets-tbody");

  liabTbody.innerHTML = "";
  assetTbody.innerHTML = "";

  let totalAssetsSum = 0;
  let totalLiabCapSum = 0;

  heads.filter(h => h.type === 'Asset').forEach(h => {
    const balInfo = calculateAccountBalance(h.id, toDate);
    if (balInfo.closing === 0) return;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${getHeadName(h)}</td>
      <td class="text-right">${formatCurrency(balInfo.closing)}</td>
    `;
    assetTbody.appendChild(tr);
    totalAssetsSum += balInfo.closing;
  });

  heads.filter(h => h.type === 'Liability' || h.type === 'Equity').forEach(h => {
    const balInfo = calculateAccountBalance(h.id, toDate);
    if (balInfo.closing === 0) return;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${getHeadName(h)}</td>
      <td class="text-right">${formatCurrency(balInfo.closing)}</td>
    `;
    liabTbody.appendChild(tr);
    totalLiabCapSum += balInfo.closing;
  });

  const netPL = calculateNetProfitLoss(toDate);
  
  if (netPL.netProfit !== 0) {
    const plTr = document.createElement("tr");
    const displayAmt = formatCurrency(Math.abs(netPL.netProfit));
    const label = netPL.netProfit > 0 ? getTranslation("lbl_net_profit") : `(${getTranslation("lbl_net_loss")})`;
    
    plTr.innerHTML = `
      <td><em>${label} (Retained Earnings)</em></td>
      <td class="text-right ${netPL.netProfit > 0 ? 'text-success' : 'text-danger'}">${netPL.netProfit > 0 ? displayAmt : '-' + displayAmt}</td>
    `;
    liabTbody.appendChild(plTr);
    totalLiabCapSum += netPL.netProfit;
  }

  document.getElementById("bs-total-assets").textContent = formatCurrency(totalAssetsSum);
  document.getElementById("bs-total-liabilities").textContent = formatCurrency(totalLiabCapSum);

  const diff = Math.abs(totalAssetsSum - totalLiabCapSum);
  const valBox = document.getElementById("bs-validation-box");

  if (diff < 0.01) {
    valBox.className = "bs-validation-status alert-success text-success";
    valBox.innerHTML = `<i class="fa-solid fa-scale-balanced"></i> <span>${getTranslation('msg_bs_balanced')}</span>`;
  } else {
    valBox.className = "bs-validation-status alert-danger text-danger";
    valBox.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> <span>${getTranslation('msg_bs_unbalanced')} (Difference: ${formatCurrency(diff)})</span>`;
  }
}

function generateMonthlyExpenseReport(fromDate, toDate) {
  const tbody = document.getElementById("rp-vertical-tbody");
  tbody.innerHTML = "";

  const cashBankHeads = heads.filter(h => h.type === 'Asset' && (h.group === 'Bank Accounts' || h.group === 'Cash Account'));

  // 1. Calculate Combined Opening Balance (Cash + Bank)
  let prevDate = null;
  if (fromDate) {
    const d = parseDateSafely(fromDate);
    d.setDate(d.getDate() - 1);
    prevDate = formatDateString(d);
  }
  
  let openingSum = 0;
  cashBankHeads.forEach(h => {
    openingSum += calculateAccountBalance(h.id, prevDate).closing;
  });

  // Render Opening Balance row (Date, Particulars, Credit, Debit)
  const opRow = document.createElement("tr");
  opRow.style.fontWeight = "bold";
  opRow.style.backgroundColor = "rgba(46, 213, 115, 0.08)";
  
  let opParticulars = `<strong>ખુલતી સિલક / Opening Cash & Bank Balances b/f:</strong><br>`;
  cashBankHeads.forEach(h => {
    const bal = calculateAccountBalance(h.id, prevDate).closing;
    opParticulars += `<span style="font-weight:normal; font-size:11.5px; padding-left:15px;">- ${h.name_en}: ${formatCurrency(bal)}</span><br>`;
  });

  opRow.innerHTML = `
    <td>${fromDate ? fromDate.split("-").reverse().join("/") : "Start"}</td>
    <td>${opParticulars}</td>
    <td class="text-right text-success">${formatCurrency(openingSum)}</td>
    <td class="text-right">-</td>
  `;
  tbody.appendChild(opRow);

  const cleanFromDate = fromDate ? formatDateString(parseDateSafely(fromDate)) : null;
  const cleanToDate = toDate ? formatDateString(parseDateSafely(toDate)) : null;

  // 2. Fetch all cash & bank transactions in date range
  const periodTxns = transactions.filter(t => {
    const cleanTDate = formatDateString(parseDateSafely(t.date));
    const matchFrom = !cleanFromDate || cleanTDate >= cleanFromDate;
    const matchTo = !cleanToDate || cleanTDate <= cleanToDate;
    return matchFrom && matchTo;
  });

  // Sort chronologically by date
  periodTxns.sort((a, b) => formatDateString(parseDateSafely(a.date)).localeCompare(formatDateString(parseDateSafely(b.date))));

  let totalReceipts = 0;
  let totalPayments = 0;

  periodTxns.forEach(t => {
    const drHead = heads.find(h => h.id === t.debit_acc);
    const crHead = heads.find(h => h.id === t.credit_acc);

    const isDrCash = drHead && drHead.group === 'Cash Account';
    const isCrCash = crHead && crHead.group === 'Cash Account';
    const isDrBank = drHead && drHead.group === 'Bank Accounts';
    const isCrBank = crHead && crHead.group === 'Bank Accounts';

    const isDrCashOrBank = isDrCash || isDrBank;
    const isCrCashOrBank = isCrCash || isCrBank;

    if (!isDrCashOrBank && !isCrCashOrBank) {
      return;
    }

    const tr = document.createElement("tr");
    let particulars = "";
    let creditAmt = "-";
    let debitAmt = "-";

    // Format cheque/reference details if bank account is used or mode is cheque
    let refInfo = "";
    if (t.reference) {
      refInfo = `[Cheque/Ref No: ${t.reference}]`;
    } else if (t.mode === 'Cheque' || isDrBank || isCrBank) {
      refInfo = `[By Cheque/Online]`;
    }

    if (isDrCashOrBank && isCrCashOrBank) {
      // Contra/Transfer between Cash/Bank
      particulars = `<strong>Contra: Transfer to ${getHeadName(drHead)} from ${getHeadName(crHead)}</strong>`;
      if (refInfo) {
        particulars += ` <span style="color:var(--warning); font-weight:bold; margin-left:5px;">${refInfo}</span>`;
      }
      creditAmt = formatCurrency(t.amount);
      debitAmt = formatCurrency(t.amount);
      totalReceipts += t.amount;
      totalPayments += t.amount;
    } 
    else if (isDrCashOrBank) {
      // Cash/Bank is Debited -> Receipt (જમા)
      particulars = `<strong>આવક: ${getHeadName(crHead)}</strong>`;
      if (refInfo) {
        particulars += ` <span style="color:var(--warning); font-weight:bold; margin-left:5px;">${refInfo}</span>`;
      }
      creditAmt = formatCurrency(t.amount);
      totalReceipts += t.amount;
    } 
    else if (isCrCashOrBank) {
      // Cash/Bank is Credited -> Payment (ઉધાર)
      particulars = `<strong>જાવક: ${getHeadName(drHead)}</strong>`;
      if (refInfo) {
        particulars += ` <span style="color:var(--warning); font-weight:bold; margin-left:5px;">${refInfo}</span>`;
      }
      debitAmt = formatCurrency(t.amount);
      totalPayments += t.amount;
    }

    if (t.narration) {
      particulars += `<br><span style="font-size:11px; padding-left:10px; color:#000000; font-weight:normal;">(${t.narration})</span>`;
    }

    tr.innerHTML = `
      <td>${t.date.split("-").reverse().join("/")}</td>
      <td>${particulars}</td>
      <td class="text-right text-success">${creditAmt !== "-" ? creditAmt : "-"}</td>
      <td class="text-right text-danger">${debitAmt !== "-" ? debitAmt : "-"}</td>
    `;
    tbody.appendChild(tr);
  });

  // Calculate Combined Closing Balance (Cash + Bank)
  let closingSum = 0;
  cashBankHeads.forEach(h => {
    closingSum += calculateAccountBalance(h.id, toDate).closing;
  });

  // Render Closing Balance row
  const clRow = document.createElement("tr");
  clRow.style.fontWeight = "bold";
  clRow.style.backgroundColor = "rgba(46, 213, 115, 0.08)";
  
  let clParticulars = `<strong>આખર સિલક / Closing Cash & Bank Balances c/o:</strong><br>`;
  cashBankHeads.forEach(h => {
    const bal = calculateAccountBalance(h.id, toDate).closing;
    clParticulars += `<span style="font-weight:normal; font-size:11.5px; padding-left:15px;">- ${h.name_en}: ${formatCurrency(bal)}</span><br>`;
  });

  clRow.innerHTML = `
    <td>${toDate ? toDate.split("-").reverse().join("/") : "End"}</td>
    <td>${clParticulars}</td>
    <td class="text-right">-</td>
    <td class="text-right text-danger">${formatCurrency(closingSum)}</td>
  `;
  tbody.appendChild(clRow);

  // Set footers
  const grandCredit = openingSum + totalReceipts;
  const grandDebit = totalPayments + closingSum;

  document.getElementById("rp-total-receipts-val").textContent = formatCurrency(grandCredit);
  document.getElementById("rp-total-payments-val").textContent = formatCurrency(grandDebit);
}

function generateBankStatement(fromDate, toDate) {
  const tbody = document.getElementById("bank-statement-tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  // Get selected bank ID from dropdown
  const bankSelect = document.getElementById("reports-bank-select");
  let bankId = bankSelect ? bankSelect.value : "";
  if (!bankId) {
    const firstBank = heads.find(h => h.type === 'Asset' && h.group === 'Bank Accounts');
    bankId = firstBank ? firstBank.id : "101";
  }

  const bankHeadObj = heads.find(h => h.id === bankId);
  const bankName = bankHeadObj ? bankHeadObj.name_en : "Bank";

  // Update report H1 title dynamically
  const titleElem = document.getElementById("bank-statement-title");
  if (titleElem) {
    titleElem.textContent = `${bankName} Transaction Statement`;
  }

  // 1. Calculate Opening Bank Balance for the selected bank only
  let prevDate = null;
  if (fromDate) {
    const d = parseDateSafely(fromDate);
    d.setDate(d.getDate() - 1);
    prevDate = formatDateString(d);
  }

  const openingBankSum = calculateAccountBalance(bankId, prevDate).closing;

  // Render Opening Balance row
  const opRow = document.createElement("tr");
  opRow.style.fontWeight = "bold";
  opRow.style.backgroundColor = "rgba(46, 213, 115, 0.08)";
  opRow.innerHTML = `
    <td>${fromDate ? fromDate.split("-").reverse().join("/") : "Start"}</td>
    <td><strong>ખુલતી બેંક સિલક / Opening Bank Balance b/f</strong></td>
    <td>-</td>
    <td>-</td>
    <td>-</td>
    <td class="text-right">${formatCurrency(openingBankSum)}</td>
  `;
  tbody.appendChild(opRow);

  const cleanFromDate = fromDate ? formatDateString(parseDateSafely(fromDate)) : null;
  const cleanToDate = toDate ? formatDateString(parseDateSafely(toDate)) : null;

  // 2. Fetch bank transactions for this bank account in date range
  const bankTxns = transactions.filter(t => {
    const cleanTDate = formatDateString(parseDateSafely(t.date));
    const matchFrom = !cleanFromDate || cleanTDate >= cleanFromDate;
    const matchTo = !cleanToDate || cleanTDate <= cleanToDate;
    const isBankTxn = t.debit_acc === bankId || t.credit_acc === bankId;
    return matchFrom && matchTo && isBankTxn;
  });

  // Sort chronologically
  bankTxns.sort((a, b) => formatDateString(parseDateSafely(a.date)).localeCompare(formatDateString(parseDateSafely(b.date))));

  let totalDeposits = 0;
  let totalWithdrawals = 0;
  let currentRunningBal = openingBankSum;

  bankTxns.forEach(t => {
    const tr = document.createElement("tr");
    let particulars = "";
    let depositAmt = 0;
    let withdrawAmt = 0;

    const isDebited = t.debit_acc === bankId;
    const oppositeHead = heads.find(h => h.id === (isDebited ? t.credit_acc : t.debit_acc));

    if (isDebited) {
      particulars = `<strong>આવક (જમા): ${oppositeHead ? getHeadName(oppositeHead) : t.credit_acc}</strong>`;
      depositAmt = t.amount;
      totalDeposits += t.amount;
      currentRunningBal += t.amount;
    } else {
      particulars = `<strong>જાવક (ઉધાર): ${oppositeHead ? getHeadName(oppositeHead) : t.debit_acc}</strong>`;
      withdrawAmt = t.amount;
      totalWithdrawals += t.amount;
      currentRunningBal -= t.amount;
    }

    if (t.narration) {
      particulars += `<br><span style="font-size:11px; padding-left:10px; color:#000000; font-weight:normal;">(${t.narration})</span>`;
    }

    const chequeVal = t.reference || (t.mode === 'Cheque' ? "Cheque/Online" : "-");

    tr.innerHTML = `
      <td>${t.date.split("-").reverse().join("/")}</td>
      <td>${particulars}</td>
      <td>${chequeVal}</td>
      <td class="text-right text-success">${depositAmt > 0 ? formatCurrency(depositAmt) : "-"}</td>
      <td class="text-right text-danger">${withdrawAmt > 0 ? formatCurrency(withdrawAmt) : "-"}</td>
      <td class="text-right font-weight-bold">${formatCurrency(currentRunningBal)}</td>
    `;
    tbody.appendChild(tr);
  });

  // Render Closing Balance row
  const clRow = document.createElement("tr");
  clRow.style.fontWeight = "bold";
  clRow.style.backgroundColor = "rgba(46, 213, 115, 0.08)";
  clRow.innerHTML = `
    <td>${toDate ? toDate.split("-").reverse().join("/") : "End"}</td>
    <td><strong>આખર બેંક સિલક / Closing Bank Balance c/o</strong></td>
    <td>-</td>
    <td>-</td>
    <td>-</td>
    <td class="text-right">${formatCurrency(currentRunningBal)}</td>
  `;
  tbody.appendChild(clRow);

  // Set totals
  document.getElementById("bank-statement-total-deposit").textContent = formatCurrency(totalDeposits);
  document.getElementById("bank-statement-total-withdraw").textContent = formatCurrency(totalWithdrawals);
}

// ==========================================
// 5. CHART OF ACCOUNT HEADS TAB LOGIC
// ==========================================
function suggestGroup() {
  const type = document.getElementById("h-type").value;
  const groupInput = document.getElementById("h-group");
  
  if (type === 'Asset') groupInput.value = "Fixed Assets";
  else if (type === 'Liability') groupInput.value = "Current Liabilities";
  else if (type === 'Equity') groupInput.value = "Capital Accounts";
  else if (type === 'Income') groupInput.value = "Direct Incomes";
  else if (type === 'Expense') groupInput.value = "Indirect Expenses";
}

function resetHeadForm() {
  document.getElementById("head-id").value = "";
  document.getElementById("h-name-en").value = "";
  document.getElementById("h-name-gu").value = "";
  document.getElementById("h-opening-bal").value = "0";
  document.getElementById("head-form-title").textContent = "Add New Account Head";
  document.getElementById("btn-save-head").querySelector("span").textContent = "Save Head";
  
  suggestGroup();
}

function saveAccountHead(event) {
  event.preventDefault();

  const id = document.getElementById("head-id").value;
  const name_en = document.getElementById("h-name-en").value.trim();
  const name_gu = document.getElementById("h-name-gu").value.trim() || name_en;
  const type = document.getElementById("h-type").value;
  const group = document.getElementById("h-group").value.trim();
  const opening_balance = parseFloat(document.getElementById("h-opening-bal").value) || 0;

  if (!name_en || !type || !group) {
    alert("Please fill all required details.");
    return;
  }

  if (id) {
    const index = heads.findIndex(h => h.id === id);
    if (index > -1) {
      const isSystem = heads[index].is_system;
      heads[index] = { id, name_en, name_gu, type, group, opening_balance, is_system: isSystem };
    }
  } else {
    let baseId = "100";
    if (type === 'Asset') baseId = "1";
    else if (type === 'Liability') baseId = "2";
    else if (type === 'Equity') baseId = "2";
    else if (type === 'Income') baseId = "3";
    else if (type === 'Expense') baseId = "4";

    const matchingIds = heads.filter(h => h.id.startsWith(baseId)).map(h => parseInt(h.id));
    const nextId = matchingIds.length > 0 ? Math.max(...matchingIds) + 1 : parseInt(baseId + "01");

    heads.push({
      id: String(nextId),
      name_en,
      name_gu,
      type,
      group,
      opening_balance,
      is_system: false
    });
  }

  saveToLocalStorage();
  resetHeadForm();
  renderHeads();
  populateDropdowns();

  alert("Account Head saved successfully!");
}

function renderHeads() {
  const searchVal = document.getElementById("head-search").value.toLowerCase();
  const typeFilter = document.getElementById("head-type-filter").value;
  
  const tbody = document.getElementById("heads-tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  const filteredHeads = heads.filter(h => {
    const nameEn = h.name_en.toLowerCase();
    const nameGu = h.name_gu ? h.name_gu.toLowerCase() : "";
    const code = h.id.toLowerCase();
    const grp = h.group.toLowerCase();

    const matchSearch = nameEn.includes(searchVal) || nameGu.includes(searchVal) || code.includes(searchVal) || grp.includes(searchVal);
    const matchType = typeFilter === "" || h.type === typeFilter;

    return matchSearch && matchType;
  });

  filteredHeads.sort((a, b) => parseInt(a.id) - parseInt(b.id));

  filteredHeads.forEach(h => {
    const tr = document.createElement("tr");
    tr.style.cursor = "pointer";
    tr.title = "Click to edit account head";
    tr.onclick = (e) => {
      if (e.target.closest('.btn-delete')) return;
      editHead(h.id);
    };
    const nameHtml = `
      <div style="font-weight: 600;">${h.name_en} ${h.is_system ? `<span class="system-tag">System</span>` : ""}</div>
    `;

    tr.innerHTML = `
      <td><code><strong>${h.id}</strong></code></td>
      <td>${nameHtml}</td>
      <td><span class="badge badge-type-${h.type.toLowerCase()}">${h.type}</span></td>
      <td>${h.group}</td>
      <td class="text-right font-weight-bold">${formatCurrency(h.opening_balance)}</td>
      <td class="text-center no-print">
        ${h.is_system ? '' : `
        <button class="btn-icon btn-delete" title="Delete" onclick="deleteHead('${h.id}')">
          <i class="fa-solid fa-trash"></i>
        </button>
        `}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function editHead(id) {
  const head = heads.find(h => h.id === id);
  if (!head) return;

  document.getElementById("head-id").value = head.id;
  document.getElementById("h-name-en").value = head.name_en;
  document.getElementById("h-name-gu").value = head.name_gu || "";
  document.getElementById("h-type").value = head.type;
  document.getElementById("h-group").value = head.group;
  document.getElementById("h-opening-bal").value = head.opening_balance;

  document.getElementById("head-form-title").textContent = "Edit Account Head";
  document.getElementById("btn-save-head").querySelector("span").textContent = "Update Head";

  document.querySelector(".head-form-card").scrollIntoView({ behavior: 'smooth' });
}

function deleteHead(id) {
  const head = heads.find(h => h.id === id);
  if (!head || head.is_system) return;

  const hasTxns = transactions.some(t => t.debit_acc === id || t.credit_acc === id);
  if (hasTxns) {
    alert("Cannot delete this head! There are transaction entries posted to this account. Delete entries first.");
    return;
  }

  const confirmMsg = `Are you sure you want to delete account head '${head.name_en}'?`;
  if (confirm(confirmMsg)) {
    heads = heads.filter(h => h.id !== id);
    saveToLocalStorage();
    renderHeads();
    populateDropdowns();
  }
}

// ==========================================
// 6. EXCEL INTEGRATION (SheetJS)
// ==========================================
function exportToExcel() {
  const headsRows = heads.map(h => ({
    "Account Code": h.id,
    "Name (English)": h.name_en,
    "Name (Alternative)": h.name_gu || "",
    "Account Type": h.type,
    "Group Category": h.group,
    "Opening Balance (₹)": h.opening_balance
  }));

  const txnRows = transactions.map(t => {
    const drHead = heads.find(h => h.id === t.debit_acc);
    const crHead = heads.find(h => h.id === t.credit_acc);
    return {
      "Transaction ID": t.id,
      "Date (YYYY-MM-DD)": t.date,
      "Voucher Type": t.voucher_type,
      "Debit Account (Dr)": drHead ? drHead.name_en : t.debit_acc,
      "Credit Account (Cr)": crHead ? crHead.name_en : t.credit_acc,
      "Amount (₹)": t.amount,
      "Narration / Details": t.narration || ""
    };
  });

  const depositRows = memberDeposits.map(d => {
    const socBank = heads.find(h => h.id === d.society_bank);
    return {
      "Deposit ID": d.id,
      "Voucher ID": d.voucher_id,
      "Wing": d.wing,
      "Block No": d.block,
      "Member Name": d.member_name,
      "Date (YYYY-MM-DD)": d.date,
      "Transaction Type": d.type,
      "Amount (₹)": d.amount,
      "Member Bank Name": d.member_bank || "",
      "Cheque Number": d.cheque_no || "",
      "Society Bank": socBank ? socBank.name_en : d.society_bank
    };
  });

  const wb = XLSX.utils.book_new();
  const wsHeads = XLSX.utils.json_to_sheet(headsRows);
  const wsTxns = XLSX.utils.json_to_sheet(txnRows);
  const wsDeps = XLSX.utils.json_to_sheet(depositRows);

  XLSX.utils.book_append_sheet(wb, wsHeads, "Chart of Accounts");
  XLSX.utils.book_append_sheet(wb, wsTxns, "Transactions");
  XLSX.utils.book_append_sheet(wb, wsDeps, "Member Deposits");

  const filename = `Orchid_Heights_Full_Backup_${formatDateString(new Date())}.xlsx`;
  XLSX.writeFile(wb, filename);
}

function setupDragAndDrop() {
  const dropzone = document.getElementById("upload-dropzone");
  if (!dropzone) return;
  
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => e.preventDefault(), false);
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, () => dropzone.classList.add('hover'), false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, () => dropzone.classList.remove('hover'), false);
  });

  dropzone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
      processExcelFile(files[0]);
    }
  });
}

function handleExcelUpload(event) {
  const files = event.target.files;
  if (files.length > 0) {
    processExcelFile(files[0]);
  }
}

function processExcelFile(file) {
  const reader = new FileReader();
  const statusBox = document.getElementById("upload-status-box");
  const progressFill = document.getElementById("progress-bar-fill");
  const statusTitle = document.getElementById("status-title");
  const statusPercent = document.getElementById("status-percent");
  const statusDetails = document.getElementById("status-details");

  statusBox.style.display = "block";
  progressFill.style.width = "10%";
  statusTitle.textContent = "Reading Excel workbook...";
  statusPercent.textContent = "10%";
  statusDetails.textContent = "";

  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array', cellDates: true });
      
      progressFill.style.width = "40%";
      statusTitle.textContent = "Parsing sheets...";
      statusPercent.textContent = "40%";

      let rawTxnsJson = [];
      let rawHeadsJson = [];
      let rawDepsJson = [];

      const headsSheetName = workbook.SheetNames.find(n => n.toLowerCase().includes("head") || n.toLowerCase().includes("account"));
      const txnsSheetName = workbook.SheetNames.find(n => n.toLowerCase().includes("trans") || n.toLowerCase().includes("entry") || n.toLowerCase().includes("txn") || n.toLowerCase().includes("sheet1"));
      const depsSheetName = workbook.SheetNames.find(n => n.toLowerCase().includes("deposit") || n.toLowerCase().includes("member"));

      const isSingleSheet = workbook.SheetNames.length === 1;

      if (isSingleSheet) {
        rawTxnsJson = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
      } else {
        if (headsSheetName) {
          rawHeadsJson = XLSX.utils.sheet_to_json(workbook.Sheets[headsSheetName]);
        }
        if (txnsSheetName) {
          rawTxnsJson = XLSX.utils.sheet_to_json(workbook.Sheets[txnsSheetName]);
        } else if (workbook.SheetNames.length > 0) {
          const otherSheet = workbook.SheetNames.find(n => n !== headsSheetName && n !== depsSheetName);
          if (otherSheet) {
            rawTxnsJson = XLSX.utils.sheet_to_json(workbook.Sheets[otherSheet]);
          }
        }
        if (depsSheetName) {
          rawDepsJson = XLSX.utils.sheet_to_json(workbook.Sheets[depsSheetName]);
        }
      }

      progressFill.style.width = "60%";
      statusTitle.textContent = "Validating accounting records...";
      statusPercent.textContent = "60%";

      const importedHeads = [];
      const hasHeadsSheet = headsSheetName && rawHeadsJson.length > 0;

      if (hasHeadsSheet) {
        rawHeadsJson.forEach(row => {
          const id = String(row["Account Code"] || row["Code"] || row["ID"] || "").trim();
          const name_en = String(row["Name (English)"] || row["Name"] || row["Name_EN"] || "").trim();
          const name_gu = String(row["Name (Alternative)"] || row["Name_GU"] || name_en).trim();
          const type = String(row["Account Type"] || row["Type"] || "Expense").trim();
          const group = String(row["Group Category"] || row["Group"] || "Indirect Expenses").trim();
          const opening_balance = parseFloat(row["Opening Balance (₹)"] || row["Opening"] || 0);

          if (id && name_en) {
            importedHeads.push({
              id,
              name_en,
              name_gu,
              type: capitalizeFirstLetter(type),
              group,
              opening_balance,
              is_system: id === "107"
            });
          }
        });
      } else {
        importedHeads.push(...heads);
      }

      const importedTxns = [];
      let skippedCount = 0;

      rawTxnsJson.forEach((row, idx) => {
        // Support both export formats: "Date (YYYY-MM-DD)" and legacy "Date (dd-mm-yyyy)"
        const dateRaw = row["Date (YYYY-MM-DD)"] || row["Date (dd-mm-yyyy)"] || row["Date"] || "";
        // Support both "Voucher Type" (backup export) and simple "Type" (manual import)
        const typeRaw = String(row["Voucher Type"] || row["Type"] || "").trim().toLowerCase();
        const headIdRaw = String(row["Head ID"] || "").trim();
        const categoryRaw = String(row["Category"] || "").trim();
        // Support both "Amount (₹)" (backup export) and plain "Amount" (manual import)
        const amount = parseFloat(row["Amount (\u20B9)"] || row["Amount"] || 0);
        const modeRaw = String(row["Mode"] || "").trim();
        const reference = String(row["Reference"] || "").trim();
        const description = String(row["Description"] || "").trim();

        const debitRaw = String(row["Debit Account (Dr)"] || row["Debit"] || "").trim();
        const creditRaw = String(row["Credit Account (Cr)"] || row["Credit"] || "").trim();

        let debit_acc = null;
        let credit_acc = null;
        let voucher_type = "Journal";
        let narration = "";

        if (debitRaw && creditRaw) {
          // Resolve debit account — auto-create with EXACT name if not found
          debit_acc = resolveAccountCode(debitRaw, importedHeads);
          if (!debit_acc) {
            debit_acc = autoCreateHead(debitRaw, inferAccountType(debitRaw), importedHeads);
          }
          // Resolve credit account — auto-create with EXACT name if not found
          credit_acc = resolveAccountCode(creditRaw, importedHeads);
          if (!credit_acc) {
            credit_acc = autoCreateHead(creditRaw, inferAccountType(creditRaw), importedHeads);
          }
          voucher_type = capitalizeFirstLetter(String(row["Voucher Type"] || row["Type"] || "Journal").trim());
          narration = String(row["Narration / Details"] || row["Narration"] || "").trim();
        } else {
          if (!dateRaw || amount <= 0) {
            skippedCount++;
            return;
          }

          let mainHeadId = null;
          if (headIdRaw) {
            mainHeadId = resolveAccountCode(headIdRaw, importedHeads);
          }
          if (!mainHeadId && categoryRaw) {
            mainHeadId = resolveAccountCode(categoryRaw, importedHeads);
          }
          if (!mainHeadId && categoryRaw) {
            const resolvedType = (typeRaw.includes("income") || typeRaw.includes("receipt")) ? "Income" : "Expense";
            mainHeadId = autoCreateHead(categoryRaw, resolvedType, importedHeads);
          }

          let modeHeadId = null;
          if (modeRaw) {
            modeHeadId = resolveAccountCode(modeRaw, importedHeads);
            if (!modeHeadId) {
              modeHeadId = autoCreateHead(modeRaw, "Asset", importedHeads);
            }
          }

          if (!mainHeadId || !modeHeadId) {
            skippedCount++;
            return;
          }

          if (typeRaw.includes("income") || typeRaw.includes("receipt")) {
            debit_acc = modeHeadId;
            credit_acc = mainHeadId;
            voucher_type = "Receipt";
          } else if (typeRaw.includes("expense") || typeRaw.includes("payment")) {
            debit_acc = mainHeadId;
            credit_acc = modeHeadId;
            voucher_type = "Payment";
          } else if (typeRaw.includes("contra") || typeRaw.includes("transfer")) {
            debit_acc = mainHeadId;
            credit_acc = modeHeadId;
            voucher_type = "Contra";
          } else {
            debit_acc = mainHeadId;
            credit_acc = modeHeadId;
            voucher_type = "Payment";
          }

          if (reference) {
            narration = `[Ref: ${reference}] ${description}`.trim();
          } else {
            narration = description;
          }
        }

        if (debit_acc && credit_acc && amount > 0) {
          const date = parseExcelDate(dateRaw);
          importedTxns.push({
            id: String(row["Transaction ID"] || row["ID"] || "TXN" + (Date.now() + idx)).trim(),
            date: date || formatDateString(new Date()),
            voucher_type,
            debit_acc,
            credit_acc,
            amount,
            narration
          });
        } else {
          skippedCount++;
        }
      });

      const importedDeps = [];
      if (depsSheetName && rawDepsJson.length > 0) {
        rawDepsJson.forEach(row => {
          const id = String(row["Deposit ID"] || row["ID"] || "").trim();
          const voucher_id = String(row["Voucher ID"] || row["Voucher_ID"] || "").trim();
          const wing = String(row["Wing"] || "Wing A").trim();
          const block = String(row["Block No"] || row["Block"] || "").trim();
          const member_name = String(row["Member Name"] || "").trim();
          const dateRaw = row["Date (YYYY-MM-DD)"] || row["Date"] || "";
          const type = String(row["Transaction Type"] || row["Type"] || "Deposit").trim();
          const amount = parseFloat(row["Amount (₹)"] || row["Amount"] || 0);
          const member_bank = String(row["Member Bank Name"] || row["Member Bank"] || "").trim();
          const cheque_no = String(row["Cheque Number"] || row["Cheque No"] || "").trim();
          const rawSocBank = String(row["Society Bank"] || "").trim();
          
          let society_bank = resolveAccountCode(rawSocBank, importedHeads) || "101";

          if (member_name && amount > 0) {
            importedDeps.push({
              id: id || "DEP" + String(Date.now() + Math.random()),
              voucher_id: voucher_id || "TXN" + String(Date.now() + Math.random()),
              wing,
              block,
              member_name,
              date: parseExcelDate(dateRaw) || formatDateString(new Date()),
              type: capitalizeFirstLetter(type),
              amount,
              member_bank,
              cheque_no,
              society_bank
            });
          }
        });
      }

      progressFill.style.width = "90%";
      statusTitle.textContent = "Saving data...";
      statusPercent.textContent = "90%";

      heads = importedHeads;
      transactions = importedTxns;
      if (depsSheetName) {
        memberDeposits = importedDeps;
      }
      saveToLocalStorage();

      progressFill.style.width = "100%";
      statusTitle.textContent = "Import complete!";
      statusPercent.textContent = "100%";
      if (depsSheetName) {
        statusDetails.textContent = `Successfully restored full backup: ${heads.length} Heads, ${transactions.length} Transactions, and ${memberDeposits.length} Member Deposits.`;
      } else {
        statusDetails.textContent = `Successfully imported ${heads.length} Heads and ${transactions.length} Transactions. (Skipped ${skippedCount} invalid rows).`;
      }
      
      initApp();

    } catch (err) {
      console.error(err);
      progressFill.style.width = "100%";
      progressFill.style.backgroundColor = "var(--danger)";
      statusTitle.textContent = "Upload Failed!";
      statusPercent.textContent = "Error";
      statusDetails.textContent = err.message;
    }
  };

  reader.readAsArrayBuffer(file);
}

function capitalizeFirstLetter(string) {
  if (!string) return "";
  return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
}

function resolveAccountCode(rawVal, currentHeads) {
  if (!rawVal) return null;
  let strVal = String(rawVal).trim();
  
  // Normalise well-known bank aliases
  const cleanVal = strVal.toLowerCase().replace(/\s+/g, "");
  if (cleanVal.includes("bank:jcom") || cleanVal === "jcom") {
    strVal = "JCOM BANK";
  } else if (cleanVal.includes("bank:cbi") || cleanVal === "cbi") {
    strVal = "CBI BANK";
  }

  // 1. Exact numeric ID match (e.g. "101")
  let match = currentHeads.find(h => h.id === strVal);
  if (match) return match.id;

  // 2. Exact English name match (case-insensitive)
  match = currentHeads.find(h => h.name_en.toLowerCase() === strVal.toLowerCase());
  if (match) return match.id;

  // 3. Exact alternative/Gujarati name match (case-insensitive)
  match = currentHeads.find(h => h.name_gu.toLowerCase() === strVal.toLowerCase());
  if (match) return match.id;

  // 4. "101 - CBI BANK" format → extract the ID part before the dash
  const beforeDash = strVal.split("-")[0].trim();
  if (beforeDash !== strVal) {           // only if there actually was a dash
    match = currentHeads.find(h => h.id === beforeDash);
    if (match) return match.id;
  }

  // NOTE: Fuzzy / partial-contains match intentionally removed.
  // It caused wrong heads to be picked (e.g. "Bank" matching "JCOM BANK").
  // Unknown accounts are now auto-created with the EXACT name by the caller.

  return null;
}

// Guess account type from raw name keywords (used when auto-creating unknown heads)
function inferAccountType(name) {
  const lower = (name || '').toLowerCase();

  // ── 1. INCOME — checked FIRST so "JCOM Bank Interest" doesn't fall into Asset ──
  // Names that END with "interest", "interest income", "interest received/earned"
  if (/interest(\s+(income|received|earned))?$/.test(lower)) return 'Income';
  // Other clear income keywords
  if (/\bdividend|rental income|rent received|commission received|service income|service charge income/.test(lower)) return 'Income';
  // "income" or "revenue" as a standalone word (not part of "income tax payable" etc.)
  if (/\bincome\b/.test(lower) && !/payable|tax/.test(lower)) return 'Income';
  if (/\brevenue\b/.test(lower)) return 'Income';

  // ── 2. LIABILITY — before Asset so "Bank Loan" → Liability not Asset ──────────
  if (/\bloan\b|payable\b|overdraft|\bcreditor\b|advance received|liability/.test(lower)) return 'Liability';

  // ── 3. EQUITY ────────────────────────────────────────────────────────────────
  if (/\bcapital\b|\bequity\b|\breserve\b|\bsurplus\b|\bfund\b/.test(lower)) return 'Equity';

  // ── 4. ASSET — after income/liability so bank-named income heads resolve correctly
  if (/\bbank\b|\bcash\b|\batm\b|receivable\b|advance paid|fixed deposit|petty cash/.test(lower)) return 'Asset';

  // ── 5. Default: Expense (safest fallback for unknown accounts) ────────────────
  return 'Expense';
}


function autoCreateHead(name, type, currentHeads) {
  // Pick a starting ID range based on type
  let baseId;
  if      (type === 'Asset')     baseId = "1";
  else if (type === 'Liability') baseId = "2";
  else if (type === 'Equity')    baseId = "2";
  else if (type === 'Income')    baseId = "3";
  else                           baseId = "4"; // Expense

  // Find the next available numeric ID in that range
  const existing = currentHeads
    .filter(h => h.id.startsWith(baseId) && /^\d+$/.test(h.id))
    .map(h => parseInt(h.id, 10))
    .filter(n => !isNaN(n));
  const nextId = existing.length > 0
    ? Math.max(...existing) + 1
    : parseInt(baseId + "01", 10);

  // Determine a sensible group
  const lower = (name || '').toLowerCase();
  let group;
  if      (type === 'Expense')   group = 'Direct Expenses';
  else if (type === 'Income')    group = 'Direct Incomes';
  else if (type === 'Liability') group = 'Current Liabilities';
  else if (type === 'Equity')    group = 'Capital Account';
  else if (/bank|atm/.test(lower))  group = 'Bank Accounts';
  else if (/cash/.test(lower))      group = 'Cash Account';
  else                              group = 'Current Assets';

  const newHead = {
    id: String(nextId),
    name_en: name,          // ← EXACT name from Excel, never altered
    name_gu: name,
    type,
    group,
    opening_balance: 0,
    is_system: false
  };
  currentHeads.push(newHead);
  console.log(`[Import] Auto-created head: "${name}" (${type}, ID: ${nextId})`);
  return newHead.id;
}

function parseExcelDate(dateVal) {
  if (!dateVal) return "";
  
  if (dateVal instanceof Date) {
    return formatDateString(dateVal);
  }

  if (typeof dateVal === 'number' || !isNaN(dateVal)) {
    const num = Number(dateVal);
    const date = new Date((num - 25569) * 86400 * 1000);
    return formatDateString(date);
  }

  const dateStr = String(dateVal).trim();
  const parts = dateStr.split("-");
  if (parts.length === 3 && parts[0].length <= 2 && parts[1].length <= 2 && parts[2].length === 4) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2];
    return `${year}-${month}-${day}`;
  }
  
  if (parts.length === 3 && parts[0].length === 4) {
    return dateStr;
  }
  
  const partsSlash = dateStr.split("/");
  if (partsSlash.length === 3 && partsSlash[0].length <= 2 && partsSlash[1].length <= 2 && partsSlash[2].length === 4) {
    const day = partsSlash[0].padStart(2, '0');
    const month = partsSlash[1].padStart(2, '0');
    const year = partsSlash[2];
    return `${year}-${month}-${day}`;
  }
  return dateStr;
}

// ==========================================
// 6. MEMBER DEPOSITS TAB LOGIC
// ==========================================

function initDepositsTab() {
  // 1. Populate blocks 101 to 1204 (48 blocks)
  const blockSelect = document.getElementById("dep-block");
  if (blockSelect) {
    blockSelect.innerHTML = "";
    let options = "";
    for (let floor = 1; floor <= 12; floor++) {
      for (let num = 1; num <= 4; num++) {
        const blockVal = floor * 100 + num;
        options += `<option value="${blockVal}">${blockVal}</option>`;
      }
    }
    blockSelect.innerHTML = options;
  }

  // 2. Populate society bank account dropdown
  const bankSelect = document.getElementById("dep-society-bank");
  if (bankSelect) {
    bankSelect.innerHTML = "";
    const bankHeads = heads.filter(h => h.type === 'Asset' && (h.group === 'Bank Accounts' || h.group === 'Cash Account'));
    let bankOptions = "";
    bankHeads.forEach(h => {
      bankOptions += `<option value="${h.id}">${h.name_en}</option>`;
    });
    bankSelect.innerHTML = bankOptions;
  }

  // 3. Set default date to today
  const dateInput = document.getElementById("dep-date");
  if (dateInput && !dateInput.value) {
    dateInput.value = formatDateString(new Date());
  }

  // 4. Render lists
  renderMemberDeposits();
}

function resetDepositForm() {
  document.getElementById("dep-id").value = "";
  document.getElementById("dep-voucher-id").value = "";
  document.getElementById("dep-member-name").value = "";
  document.getElementById("dep-amount").value = "";
  document.getElementById("dep-member-bank").value = "";
  document.getElementById("dep-cheque-no").value = "";
  document.getElementById("dep-date").value = formatDateString(new Date());
  document.getElementById("dep-type").value = "Deposit";

  document.getElementById("deposit-form-title").textContent = "Record Member Deposit";
  document.getElementById("btn-save-deposit").querySelector("span").textContent = "Save Deposit Entry";
}

function saveMemberDeposit(event) {
  event.preventDefault();

  const id = document.getElementById("dep-id").value || "DEP" + String(Date.now());
  const voucherId = document.getElementById("dep-voucher-id").value || "TXN" + String(Date.now() + 1);

  const wing = document.getElementById("dep-wing").value;
  const block = document.getElementById("dep-block").value;
  const memberName = document.getElementById("dep-member-name").value.trim();
  const date = document.getElementById("dep-date").value;
  const type = document.getElementById("dep-type").value;
  const amount = parseFloat(document.getElementById("dep-amount").value);
  const memberBank = document.getElementById("dep-member-bank").value.trim();
  const chequeNo = document.getElementById("dep-cheque-no").value.trim();
  const societyBankId = document.getElementById("dep-society-bank").value;

  if (!memberName || isNaN(amount) || amount <= 0 || !date || !societyBankId) {
    alert("Please fill in all required fields correctly.");
    return;
  }

  // 1. Create/Update Voucher Transaction for Accounting Integration
  // Deposit: Debit Bank (societyBankId), Credit Liability (206)
  // Withdraw: Debit Liability (206), Credit Bank (societyBankId)
  const debitAcc = type === 'Deposit' ? societyBankId : "206";
  const creditAcc = type === 'Deposit' ? "206" : societyBankId;
  const voucherType = type === 'Deposit' ? 'Receipt' : 'Payment';

  let narration = `[Member Deposit] Wing: ${wing}, Block: ${block}, Member: ${memberName}`;
  if (chequeNo || memberBank) {
    narration += `, Cheque: ${chequeNo || 'N/A'} (Bank: ${memberBank || 'N/A'})`;
  }

  const existingTxnIndex = transactions.findIndex(t => t.id === voucherId);
  const txnObj = {
    id: voucherId,
    date: date,
    voucher_type: voucherType,
    debit_acc: debitAcc,
    credit_acc: creditAcc,
    amount: amount,
    narration: narration
  };

  if (existingTxnIndex > -1) {
    transactions[existingTxnIndex] = txnObj;
  } else {
    transactions.push(txnObj);
  }

  // 2. Create/Update Member Deposit Entry
  const depObj = {
    id: id,
    voucher_id: voucherId,
    wing: wing,
    block: block,
    member_name: memberName,
    date: date,
    type: type,
    amount: amount,
    member_bank: memberBank,
    cheque_no: chequeNo,
    society_bank: societyBankId
  };

  const existingDepIndex = memberDeposits.findIndex(d => d.id === id);
  if (existingDepIndex > -1) {
    memberDeposits[existingDepIndex] = depObj;
  } else {
    memberDeposits.push(depObj);
  }

  // 3. Save and refresh
  saveToLocalStorage();
  resetDepositForm();
  renderMemberDeposits();

  alert("Member deposit entry saved and synced with accounts successfully!");
}

function renderMemberDeposits() {
  const tbody = document.getElementById("deposits-tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  const searchVal = document.getElementById("deposit-search").value.toLowerCase();

  const filtered = memberDeposits.filter(d => {
    const name = d.member_name.toLowerCase();
    const blockStr = `${d.wing} ${d.block}`.toLowerCase();
    const chq = (d.cheque_no || "").toLowerCase();
    const bnk = (d.member_bank || "").toLowerCase();
    return name.includes(searchVal) || blockStr.includes(searchVal) || chq.includes(searchVal) || bnk.includes(searchVal);
  });

  // Sort by date desc
  filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No deposit records found.</td></tr>`;
    return;
  }

  filtered.forEach(d => {
    const tr = document.createElement("tr");
    tr.style.cursor = "pointer";
    tr.title = "Click to edit deposit entry";
    tr.onclick = (e) => {
      if (e.target.closest('.btn-delete')) return;
      editMemberDeposit(d.id);
    };

    let chequeDetails = "-";
    if (d.cheque_no || d.member_bank) {
      chequeDetails = `<strong>${d.cheque_no || 'N/A'}</strong><br><span class="text-muted" style="font-size:11px;">(${d.member_bank || 'N/A'})</span>`;
    }

    const typeBadge = d.type === 'Deposit' 
      ? `<span class="badge badge-receipt">Deposit</span>`
      : `<span class="badge badge-payment">Refund/Withdraw</span>`;

    tr.innerHTML = `
      <td>${d.date.split("-").reverse().join("/")}</td>
      <td><strong>${d.wing} - ${d.block}</strong></td>
      <td>${d.member_name}</td>
      <td>${typeBadge}</td>
      <td>${chequeDetails}</td>
      <td class="text-right font-weight-bold">${formatCurrency(d.amount)}</td>
      <td class="text-center no-print">
        <button class="btn-icon btn-delete" title="Delete" onclick="deleteMemberDeposit('${d.id}')">
          <i class="fa-solid fa-trash"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function editMemberDeposit(id) {
  const dep = memberDeposits.find(d => d.id === id);
  if (!dep) return;

  document.getElementById("dep-id").value = dep.id;
  document.getElementById("dep-voucher-id").value = dep.voucher_id;
  document.getElementById("dep-wing").value = dep.wing;
  document.getElementById("dep-block").value = dep.block;
  document.getElementById("dep-member-name").value = dep.member_name;
  document.getElementById("dep-date").value = dep.date;
  document.getElementById("dep-type").value = dep.type;
  document.getElementById("dep-amount").value = dep.amount;
  document.getElementById("dep-member-bank").value = dep.member_bank || "";
  document.getElementById("dep-cheque-no").value = dep.cheque_no || "";
  document.getElementById("dep-society-bank").value = dep.society_bank;

  document.getElementById("deposit-form-title").textContent = "Edit Deposit Entry";
  document.getElementById("btn-save-deposit").querySelector("span").textContent = "Update Deposit";
}

function deleteMemberDeposit(id) {
  if (!confirm("Are you sure you want to delete this member deposit entry? This will also remove the corresponding accounting voucher transaction.")) {
    return;
  }

  const depIndex = memberDeposits.findIndex(d => d.id === id);
  if (depIndex === -1) return;

  const dep = memberDeposits[depIndex];

  // 1. Delete associated voucher transaction
  const txnIndex = transactions.findIndex(t => t.id === dep.voucher_id);
  if (txnIndex > -1) {
    transactions.splice(txnIndex, 1);
  }

  // 2. Delete member deposit record
  memberDeposits.splice(depIndex, 1);

  // 3. Save and refresh
  saveToLocalStorage();
  renderMemberDeposits();

  alert("Member deposit entry deleted successfully.");
}

function uploadDepositExcel(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });

      // ── Sheet auto-detection ──────────────────────────────────────────────
      // 1. Prefer a sheet whose name suggests deposits / members
      const depositKeywords = ["deposit", "member", "સભ્ય", "જમા", "dip", "dep"];
      let sheetName = workbook.SheetNames.find(n =>
        depositKeywords.some(kw => n.toLowerCase().includes(kw))
      );

      // 2. If no keyword match, try every sheet in order and pick the first
      //    one that looks like it has deposit rows (col index 3 = member name,
      //    col index 5 = amount, at least 1 data row after header).
      if (!sheetName) {
        for (const candidate of workbook.SheetNames) {
          const testJson = XLSX.utils.sheet_to_json(
            workbook.Sheets[candidate], { header: 1 }
          );
          // Need at least header + 1 data row, with a non-empty col-3 (name)
          if (testJson.length >= 2 && testJson[1] && testJson[1][3]) {
            sheetName = candidate;
            break;
          }
        }
      }

      // 3. Absolute fallback – first sheet
      if (!sheetName) sheetName = workbook.SheetNames[0];

      const worksheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (json.length < 2) {
        alert("The Excel file seems to be empty or lacks data rows.");
        return;
      }

      let importCount = 0;
      // Start loop from index 1 (skipping header)
      for (let i = 1; i < json.length; i++) {
        const row = json[i];
        if (row.length === 0 || !row[3]) continue; // Skip empty rows or rows without member name

        const dateVal = row[0];
        const date = dateVal ? parseExcelDate(dateVal) : formatDateString(new Date());

        let wing = String(row[1] || "Wing A").trim();
        if (!wing.toLowerCase().includes("wing b")) {
          wing = "Wing A";
        } else {
          wing = "Wing B";
        }

        const block = String(row[2] || "101").trim();
        const memberName = String(row[3]).trim();

        let type = String(row[4] || "Deposit").trim();
        if (type.toLowerCase().includes("withdraw") || type.toLowerCase().includes("refund") || type.toLowerCase().includes("જાવક") || type.toLowerCase().includes("ઉપાડ")) {
          type = "Withdraw";
        } else {
          type = "Deposit";
        }

        const amount = parseFloat(row[5]);
        if (isNaN(amount) || amount <= 0) continue; // Skip invalid amounts

        const memberBank = row[6] ? String(row[6]).trim() : "";
        const chequeNo = row[7] ? String(row[7]).trim() : "";

        // Resolve society bank
        let societyBankId = "101"; // Default CBI BANK
        const rawSocietyBank = row[8] ? String(row[8]).trim().toLowerCase() : "";
        if (rawSocietyBank.includes("jcom")) {
          societyBankId = "102";
        }

        // Generate unique IDs
        const id = "DEP" + String(Date.now() + i);
        const voucherId = "TXN" + String(Date.now() + i + 1000);

        // Accounting integration voucher details
        const debitAcc = type === 'Deposit' ? societyBankId : "206";
        const creditAcc = type === 'Deposit' ? "206" : societyBankId;
        const voucherType = type === 'Deposit' ? 'Receipt' : 'Payment';

        let narration = `[Member Deposit] Wing: ${wing}, Block: ${block}, Member: ${memberName}`;
        if (chequeNo || memberBank) {
          narration += `, Cheque: ${chequeNo || 'N/A'} (Bank: ${memberBank || 'N/A'})`;
        }

        const txnObj = {
          id: voucherId,
          date: date,
          voucher_type: voucherType,
          debit_acc: debitAcc,
          credit_acc: creditAcc,
          amount: amount,
          narration: narration
        };

        const depObj = {
          id: id,
          voucher_id: voucherId,
          wing: wing,
          block: block,
          member_name: memberName,
          date: date,
          type: type,
          amount: amount,
          member_bank: memberBank,
          cheque_no: chequeNo,
          society_bank: societyBankId
        };

        transactions.push(txnObj);
        memberDeposits.push(depObj);
        importCount++;
      }

      if (importCount > 0) {
        saveToLocalStorage();
        renderMemberDeposits();
        alert(`Successfully imported ${importCount} member deposit entries from sheet "${sheetName}" and updated accounts.`);
      } else {
        alert(`No valid entries were found in sheet "${sheetName}". Please check that the sheet has: Date, Wing, Block No, Member Name, Type, Amount in columns A–F.`);
      }

      // Reset input element value so same file can be uploaded again
      document.getElementById("deposit-excel-file").value = "";

    } catch (err) {
      alert("Error parsing Excel file: " + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
}

window.addEventListener('beforeprint', () => {
  if (currentReportType === 'bank-statement') {
    const bankSelect = document.getElementById("reports-bank-select");
    const bankHeadObj = heads.find(h => h.id === (bankSelect ? bankSelect.value : "101"));
    const bankName = bankHeadObj ? bankHeadObj.name_en : "Bank";
    const monthSelect = document.getElementById("reports-month-select");
    const monthVal = monthSelect ? monthSelect.value : "";
    let monthFormatted = "";
    if (monthVal) {
      const parts = monthVal.split("-");
      monthFormatted = `${parts[1]}-${parts[0]}`; // e.g. "01-2025"
    }
    document.title = `${bankName}_Statement_${monthFormatted}`;
  } else if (currentReportType === 'expense-report') {
    const monthSelect = document.getElementById("reports-month-select");
    const monthVal = monthSelect ? monthSelect.value : "";
    let monthFormatted = "";
    if (monthVal) {
      const parts = monthVal.split("-");
      monthFormatted = `${parts[1]}-${parts[0]}`;
    }
    document.title = `Receipts_Payments_Report_${monthFormatted}`;
  }
});

window.addEventListener('afterprint', () => {
  document.title = "🌸 Orchid Heights Accounting Software";
});
