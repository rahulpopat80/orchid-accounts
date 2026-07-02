// Tally-Style Double-Entry Accounting Software Logic

// Global State
let heads = [];
let transactions = [];
let currentLanguage = 'en'; // 'en' or 'gu'
let currentReportType = 'trial-balance'; // 'trial-balance', 'profit-loss', 'balance-sheet'
let monthlyChartInstance = null;

// Translation Dictionary (Bilingual Support)
const translations = {
  en: {
    title_dashboard: "Dashboard - Overview",
    title_vouchers: "Voucher Transactions",
    title_ledger: "General Ledger Accounts",
    title_reports: "Financial Reports",
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
};��કતો",
    msg_bs_balanced: "બેલેન્સશીટ સરભર છે! મિલકતો = દેવાં + મૂડી.",
    msg_bs_unbalanced: "ચેતવણી: બેલેન્સશીટ સરભર થતી નથી! શરૂઆતની બાકી અને એન્ટ્રીઓ તપાસો.",
    title_new_head: "નવો ખાતાનો હેડ ઉમેરો",
    lbl_head_en: "ખાતાના હેડનું નામ (અંગ્રેજી)",
    lbl_head_gu: "ખાતાના હેડનું નામ (ગુજરાતી)",
    lbl_head_type_select: "ખાતાનો પ્રકાર",
    lbl_head_group: "સબ-જૂથ (Sub-Group)",
    lbl_head_opening: "શરૂઆતની બાકી (₹)",
    opt_asset: "Asset (મિલકત)",
    opt_liability: "Liability (દેવું)",
    opt_equity: "Equity (મૂડી)",
    opt_income: "Income (આવક)",
    opt_expense: "Expense (ખર્ચ)",
    title_heads_list: "લેજર હેડ્સ લિસ્ટ (Chart of Accounts)",
    opt_all_heads: "તમામ લેજર પ્રકારો",
    col_head_id: "કોડ",
    col_opening: "શરૂઆતની બાકી (₹)",
    title_excel_guide: "એક્સેલ ડાઉનલોડ/અપલોડ ઓપરેશન્સ માર્ગદર્શિકા",
    excel_guide_p1: "તમારા તમામ હિસાબો માઈક્રોસોફ્ટ એક્સેલ ફાઈલ દ્વારા સુરક્ષિત બેકઅપ રાખો અથવા એક્સેલ શીટ અપલોડ કરીને બલ્ક એન્ટ્રીઓ કરો.",
    excel_guide_h_download: "૧. એક્સેલ બેકઅપ/ટેમ્પલેટ ડાઉનલોડ કરો",
    excel_guide_p_download: "નીચેના બટન પર ક્લિક કરીને વર્તમાન ખાતાઓ અને તમામ વાઉચર એન્ટ્રીઓની સિંગલ એક્સેલ શીટ ડાઉનલોડ કરો. આનો ઉપયોગ તમે બેકઅપ અથવા ઓફલાઇન સુધારા કરવાના ટેમ્પલેટ તરીકે કરી શકો છો.",
    btn_download_excel: "એક્સેલ બેકઅપ ડાઉનલોડ કરો (.xlsx)",
    excel_guide_h_upload: "૨. એક્સેલ ડેટા ફાઇલ અપલોડ કરો",
    excel_guide_p_upload: "ખાતરી કરો કે તમારી એક્સેલ શીટમાં 'Chart of Accounts' અને 'Transactions' નામના બે પેજ (Tabs) હોય. ડેબિટ અને ક્રેડિટ ખાતાના નામ અથવા કોડ ગમે તે લખશો તો પણ સિસ્ટમ તેને આપમેળે ઓળખી લેશે.",
    title_excel_upload: "એક્સેલ ફાઇલ અપલોડ કરો",
    excel_upload_p1: "તમારી ફાઇલ અહીં અપલોડ કરવા ક્લિક કરો અથવા ફાઇલને ડ્રેગ કરી અહીં મૂકો",
    search_placeholder: "વાઉચર નોંધ અથવા ખાતાઓ શોધો...",
    search_heads_placeholder: "હેડનું નામ અથવા કોડ શોધો...",
    payment_help: "Payment: રોકડ અથવા બેંકમાંથી ચૂકવેલા નાણાં નોંધવા. ઉધાર (Dr): ખર્ચ/મિલકત ખાતું, જમા (Cr): કેશ/બેંક ખાતું.",
    receipt_help: "Receipt: કોઈપણ આવક કે ફંડ મળેલ હોય તે નોંધવા. ઉધાર (Dr): કેશ/બેંક ખાતું, જમા (Cr): આવક/કેપિટલ ખાતું.",
    contra_help: "Contra: બેંકમાંથી રોકડા ઉપાડવા, બેંકમાં ભરવા કે બેંક ટુ બેંક બદલવા. ઉધાર (Dr): મેળવનાર કેશ/બેંક, જમા (Cr): આપનાર કેશ/બેંક.",
    journal_help: "Journal: હવાલા એન્ટ્રીઓ અથવા રોકડ વગરના અન્ય એડજસ્ટમેન્ટ વ્યવહારોની ખાસ નોંધ માટે."
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
  document.getElementById("reports-date-filter").value = formatDateString(lastDayOfMonth);

  // Setup drag and drop for Excel file
  setupDragAndDrop();
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
}

// Format Date to YYYY-MM-DD
function formatDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Local Storage Helper Functions
function saveToLocalStorage() {
  localStorage.setItem("tally_heads", JSON.stringify(heads));
  localStorage.setItem("tally_transactions", JSON.stringify(transactions));
  localStorage.setItem("tally_lang", currentLanguage);
}

function loadFromLocalStorage() {
  const storedHeads = localStorage.getItem("tally_heads");
  const storedTxns = localStorage.getItem("tally_transactions");
  const storedLang = localStorage.getItem("tally_lang");

  if (storedHeads && storedTxns) {
    heads = JSON.parse(storedHeads);
    transactions = JSON.parse(storedTxns);
  } else {
    // Load from seed-data.js (which must be loaded in HTML before app.js)
    heads = [...defaultHeads];
    transactions = [...defaultTransactions];
    saveToLocalStorage();
  }

  if (storedLang) {
    currentLanguage = storedLang;
  }
}

// Reset data to seed values
function resetToSeedData() {
  const confirmMsg = currentLanguage === 'en' 
    ? "Are you sure you want to reset all data to default template?" 
    : "શું તમે ખરેખર તમામ ડેટાને ડિફોલ્ટ નમૂના સાથે ફરીથી સેટ કરવા માંગો છો?";
  
  if (confirm(confirmMsg)) {
    localStorage.removeItem("tally_heads");
    localStorage.removeItem("tally_transactions");
    initApp();
  }
}

// Translation Engine - Disabled (Locked to English)
function toggleLanguage() {
  currentLanguage = 'en';
}

function translateUI() {
  const langObj = translations[currentLanguage];
  
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
  return translations[currentLanguage][key] || key;
}

// Get Head Name in current active language
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
    runSelectedReport();
  } else if (tabId === 'heads') {
    renderHeads();
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

  // Dynamically name months in labels
  const monthNamesEn = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const monthNamesGu = ["જાન્યુઆરી", "ફેબ્રુઆરી", "માર્ચ", "એપ્રિલ", "મે", "જૂન", "જુલાઈ", "ઓગસ્ટ", "સપ્ટેમ્બર", "ઓક્ટોબર", "નવેમ્બર", "ડિસેમ્બર"];
  const curMonthLabel = currentLanguage === 'en' ? monthNamesEn[currentMonth] : monthNamesGu[currentMonth];

  document.querySelector(".income-kpi .kpi-label").textContent = `${curMonthLabel} ${getTranslation('lbl_incomes')}`;
  document.querySelector(".expense-kpi .kpi-label").textContent = `${curMonthLabel} ${getTranslation('lbl_expenses')}`;

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
      tr.innerHTML = `
        <td>${t.date}</td>
        <td><span class="badge badge-${t.voucher_type.toLowerCase()}">${t.voucher_type}</span></td>
        <td>
          <div class="text-success"><i class="fa-solid fa-circle-down"></i> Dr: ${getHeadName(drHead)}</div>
          <div class="text-danger"><i class="fa-solid fa-circle-up"></i> Cr: ${getHeadName(crHead)}</div>
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
    
    // Label
    const monthNamesEn = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthNamesGu = ["જાન્યુ", "ફેબ્રુ", "માર્ચ", "એપ્રિલ", "મે", "જૂન", "જુલાઈ", "ઓગ", "સપ્ટે", "ઓક્ટો", "નવે", "ડિસે"];
    const mLabel = currentLanguage === 'en' ? `${monthNamesEn[mNum]} ${yNum}` : `${monthNamesGu[mNum]} ${yNum}`;
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
          label: currentLanguage === 'en' ? 'Income' : 'આવક',
          data: incomeData,
          backgroundColor: 'rgba(16, 185, 129, 0.65)',
          borderColor: '#10b981',
          borderWidth: 1,
          borderRadius: 4
        },
        {
          label: currentLanguage === 'en' ? 'Expenses' : 'ખર્ચ',
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
            font: { family: 'Inter, Noto Sans Gujarati' }
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#94a3b8', font: { family: 'Inter, Noto Sans Gujarati' } }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#94a3b8', font: { family: 'Inter, Noto Sans Gujarati' } }
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
  
  // Save selections to restore if possible
  const prevDr = drSelect.value;
  const prevCr = crSelect.value;
  const prevLedger = ledgerSelect ? ledgerSelect.value : "";

  // Reset dropdown HTML
  let drOptions = `<option value="" disabled selected>${currentLanguage === 'en' ? '-- Select Debit Head --' : '-- ઉધાર ખાતું પસંદ કરો --'}</option>`;
  let crOptions = `<option value="" disabled selected>${currentLanguage === 'en' ? '-- Select Credit Head --' : '-- જમા ખાતું પસંદ કરો --'}</option>`;
  let ledgerOptions = "";

  // Sort heads alphabetically by current language name
  const sortedHeads = [...heads].sort((a, b) => getHeadName(a).localeCompare(getHeadName(b)));

  sortedHeads.forEach(h => {
    const name = `${h.id} - ${getHeadName(h)} (${h.type})`;
    
    // Ledger dropdown (all accounts)
    ledgerOptions += `<option value="${h.id}">${name}</option>`;

    // Simple validation engine filtering based on Voucher Type:
    if (voucherType === 'Payment') {
      // Payment: Credit must be Cash/Bank (Outgoing cash). Debit can be anything (mostly Expense/Asset)
      if (isCashOrBank(h)) {
        crOptions += `<option value="${h.id}">${name}</option>`;
      }
      if (!isCashOrBank(h) || h.type === 'Asset') {
        drOptions += `<option value="${h.id}">${name}</option>`;
      }
    } 
    else if (voucherType === 'Receipt') {
      // Receipt: Debit must be Cash/Bank (Incoming cash). Credit can be anything (mostly Income/Equity)
      if (isCashOrBank(h)) {
        drOptions += `<option value="${h.id}">${name}</option>`;
      }
      if (!isCashOrBank(h) || h.type === 'Income' || h.type === 'Equity' || h.type === 'Asset') {
        crOptions += `<option value="${h.id}">${name}</option>`;
      }
    } 
    else if (voucherType === 'Contra') {
      // Contra: Both Debit and Credit must be Cash/Bank (internal transfer)
      if (isCashOrBank(h)) {
        drOptions += `<option value="${h.id}">${name}</option>`;
        crOptions += `<option value="${h.id}">${name}</option>`;
      }
    } 
    else {
      // Journal: Any account can be debited or credited
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

  // Restore previous values if they exist in the new filtered sets
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

// Adjust Voucher Help Text when type changes
function adjustVoucherForm() {
  const vType = document.getElementById("v-type").value;
  const helpTextElem = document.getElementById("voucher-help-text");
  
  // Set help text
  if (vType === 'Payment') {
    helpTextElem.textContent = getTranslation('payment_help');
  } else if (vType === 'Receipt') {
    helpTextElem.textContent = getTranslation('receipt_help');
  } else if (vType === 'Contra') {
    helpTextElem.textContent = getTranslation('contra_help');
  } else {
    helpTextElem.textContent = getTranslation('journal_help');
  }

  // Re-populate debit/credit filters based on type
  populateDropdowns();
}

function resetVoucherForm() {
  document.getElementById("voucher-id").value = "";
  document.getElementById("v-amount").value = "";
  document.getElementById("v-narration").value = "";
  document.getElementById("voucher-form-title").textContent = getTranslation("title_new_voucher");
  document.getElementById("btn-save-voucher").querySelector("span").textContent = getTranslation("btn_save");
  
  // Reset date to today
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
    alert(currentLanguage === 'en' ? "Please fill all required fields!" : "કૃપા કરીને બધી માહિતી ભરો!");
    return;
  }

  if (debit_acc === credit_acc) {
    alert(currentLanguage === 'en' 
      ? "Debit and Credit account cannot be the same! Double-entry requires two different accounts." 
      : "ઉધાર અને જમા ખાતું એક જ ન હોઈ શકે! દ્વિ-નોંધી પદ્ધતિમાં બે અલગ ખાતા હોવા જોઈએ.");
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
  
  // Alert success
  alert(currentLanguage === 'en' ? "Voucher entry saved successfully!" : "વાઉચર એન્ટ્રી સફળતાપૂર્વક સેવ થઇ ગઈ!");
}

// Filter and Render Transaction history list
function filterVouchers() {
  const searchVal = document.getElementById("voucher-search").value.toLowerCase();
  const typeFilter = document.getElementById("voucher-type-filter").value;
  
  const tbody = document.getElementById("vouchers-tbody");
  tbody.innerHTML = "";

  // Filter transactions
  const filtered = transactions.filter(t => {
    const drHead = heads.find(h => h.id === t.debit_acc);
    const crHead = heads.find(h => h.id === t.credit_acc);
    
    const drName = drHead ? getHeadName(drHead).toLowerCase() : "";
    const crName = crHead ? getHeadName(crHead).toLowerCase() : "";
    const narr = t.narration ? t.narration.toLowerCase() : "";
    const matchSearch = drName.includes(searchVal) || crName.includes(searchVal) || narr.includes(searchVal) || t.id.toLowerCase().includes(searchVal);
    const matchType = typeFilter === "" || t.voucher_type === typeFilter;
    
    return matchSearch && matchType;
  });

  // Sort by date desc
  filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No transactions found.</td></tr>`;
    return;
  }

  filtered.forEach(t => {
    const drHead = heads.find(h => h.id === t.debit_acc);
    const crHead = heads.find(h => h.id === t.credit_acc);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${t.date}</td>
      <td><span class="badge badge-${t.voucher_type.toLowerCase()}">${t.voucher_type}</span></td>
      <td class="text-success"><i class="fa-solid fa-circle-down"></i> ${getHeadName(drHead) || t.debit_acc}</td>
      <td class="text-danger"><i class="fa-solid fa-circle-up"></i> ${getHeadName(crHead) || t.credit_acc}</td>
      <td class="text-right font-weight-bold">${formatCurrency(t.amount)}</td>
      <td class="text-center no-print">
        <div class="row-actions">
          <button class="btn-icon btn-edit" title="Edit" onclick="editVoucher('${t.id}')">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button class="btn-icon btn-delete" title="Delete" onclick="deleteVoucher('${t.id}')">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
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
  
  // Re-adjust options first to ensure dropdown values exist
  adjustVoucherForm();
  
  document.getElementById("v-debit").value = txn.debit_acc;
  document.getElementById("v-credit").value = txn.credit_acc;
  document.getElementById("v-amount").value = txn.amount;
  document.getElementById("v-narration").value = txn.narration || "";

  document.getElementById("voucher-form-title").textContent = currentLanguage === 'en' ? "Edit Voucher Entry" : "વાઉચર એન્ટ્રી સુધારો";
  document.getElementById("btn-save-voucher").querySelector("span").textContent = currentLanguage === 'en' ? "Update Entry" : "અપડેટ કરો";

  // Scroll to form on mobile/small screen
  document.querySelector(".voucher-form-card").scrollIntoView({ behavior: 'smooth' });
}

function deleteVoucher(id) {
  const confirmMsg = currentLanguage === 'en' 
    ? "Are you sure you want to delete this transaction?" 
    : "શું તમે ખરેખર આ વ્યવહાર કાઢી નાખવા માંગો છો?";
    
  if (confirm(confirmMsg)) {
    transactions = transactions.filter(t => t.id !== id);
    saveToLocalStorage();
    filterVouchers();
  }
}


// ==========================================
// 3. GENERAL LEDGER TAB LOGIC
// ==========================================
// Calculate Detailed running ledger balance for a head
function calculateAccountBalance(headId, upToDate = null) {
  const head = heads.find(h => h.id === headId);
  if (!head) return { opening: 0, debits: 0, credits: 0, closing: 0 };

  const opening = head.opening_balance || 0;
  let debitsBefore = 0;
  let creditsBefore = 0;

  // Filter transactions before date if specified
  transactions.forEach(t => {
    if (upToDate && new Date(t.date) > new Date(upToDate)) return;

    if (t.debit_acc === headId) {
      debitsBefore += t.amount;
    }
    if (t.credit_acc === headId) {
      creditsBefore += t.amount;
    }
  });

  let closing = 0;
  // Accounting Balance Rule:
  // Debit balance accounts: Asset, Expense
  // Credit balance accounts: Liability, Equity, Income
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

// Generate Printable ledger
function generateLedger() {
  const headId = document.getElementById("ledger-head-select").value;
  const fromDateVal = document.getElementById("ledger-from-date").value;
  const toDateVal = document.getElementById("ledger-to-date").value;

  if (!headId) return;

  const head = heads.find(h => h.id === headId);
  if (!head) return;

  // Calculate opening balance before 'fromDate'
  let openingBal = head.opening_balance || 0;
  let totalPeriodDebits = 0;
  let totalPeriodCredits = 0;

  // Debit balance or Credit balance flag
  const isDebitAccount = head.type === 'Asset' || head.type === 'Expense';

  // Sort transactions chronologically
  const cronTxns = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));

  // Compute opening balance for this period
  if (fromDateVal) {
    cronTxns.forEach(t => {
      if (new Date(t.date) < new Date(fromDateVal)) {
        if (t.debit_acc === headId) {
          openingBal += (isDebitAccount ? t.amount : -t.amount);
        }
        if (t.credit_acc === headId) {
          openingBal += (isDebitAccount ? -t.amount : t.amount);
        }
      }
    });
  }

  // Populate UI labels
  document.getElementById("ledger-title-text").textContent = `${getHeadName(head)} - Ledger A/c`;
  document.getElementById("ledger-meta-type").textContent = `${head.type} (${head.group})`;
  document.getElementById("ledger-meta-opening").textContent = formatCurrency(openingBal);
  
  // Date range label
  const dFromFormatted = fromDateVal ? fromDateVal.split("-").reverse().join("/") : "Start";
  const dToFormatted = toDateVal ? toDateVal.split("-").reverse().join("/") : "End";
  document.getElementById("ledger-date-range").textContent = `${getTranslation('col_date')}: ${dFromFormatted} to ${dToFormatted}`;

  const tbody = document.getElementById("ledger-tbody");
  tbody.innerHTML = "";

  // Render Opening row
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

  // Filter transactions inside date range
  const periodTxns = cronTxns.filter(t => {
    const matchFrom = !fromDateVal || new Date(t.date) >= new Date(fromDateVal);
    const matchTo = !toDateVal || new Date(t.date) <= new Date(toDateVal);
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
    let particulars = "";
    let drAmt = "-";
    let crAmt = "-";

    if (t.debit_acc === headId) {
      // This account is Debited
      const oppositeHead = heads.find(h => h.id === t.credit_acc);
      particulars = `To ${getHeadName(oppositeHead)}`;
      drAmt = formatCurrency(t.amount);
      totalPeriodDebits += t.amount;
      currentRunningBal += (isDebitAccount ? t.amount : -t.amount);
    } else {
      // This account is Credited
      const oppositeHead = heads.find(h => h.id === t.debit_acc);
      particulars = `By ${getHeadName(oppositeHead)}`;
      crAmt = formatCurrency(t.amount);
      totalPeriodCredits += t.amount;
      currentRunningBal += (isDebitAccount ? -t.amount : t.amount);
    }

    // Add narration below particulars if exists
    if (t.narration) {
      particulars += `<br><span class="text-muted" style="font-size:10.5px; padding-left:12px;">(${t.narration})</span>`;
    }

    tr.innerHTML = `
      <td>${t.date.split("-").reverse().join("/")}</td>
      <td>${particulars}</td>
      <td><span class="badge badge-${t.voucher_type.toLowerCase()}">${t.voucher_type}</span></td>
      <td class="text-right text-success">${drAmt}</td>
      <td class="text-right text-danger">${crAmt}</td>
      <td class="text-right font-weight-bold">${formatCurrency(currentRunningBal)}</td>
    `;
    tbody.appendChild(tr);
  });

  // Footer Totals
  document.getElementById("ledger-total-debit").textContent = formatCurrency(totalPeriodDebits);
  document.getElementById("ledger-total-credit").textContent = formatCurrency(totalPeriodCredits);
  document.getElementById("ledger-final-balance").textContent = formatCurrency(currentRunningBal);
}


// ==========================================
// 4. FINANCIAL REPORTS TAB LOGIC
// ==========================================
function switchReport(reportType) {
  currentReportType = reportType;
  
  // Update report tabs styling
  document.querySelectorAll(".report-tab-btn").forEach(btn => btn.classList.remove("active"));
  if (reportType === 'trial-balance') document.getElementById("btn-tb-tab").classList.add("active");
  if (reportType === 'profit-loss') document.getElementById("btn-pl-tab").classList.add("active");
  if (reportType === 'balance-sheet') document.getElementById("btn-bs-tab").classList.add("active");

  // Show active report panel
  document.querySelectorAll(".report-panel").forEach(p => p.classList.remove("active"));
  document.getElementById(`${reportType}-panel`).classList.add("active");

  runSelectedReport();
}

function runSelectedReport() {
  const asOfDate = document.getElementById("reports-date-filter").value;
  
  // Set display date in reports
  const displayDate = asOfDate ? asOfDate.split("-").reverse().join("/") : "30/06/2026";
  document.querySelectorAll(".current-report-date").forEach(el => el.textContent = displayDate);

  if (currentReportType === 'trial-balance') {
    generateTrialBalance(asOfDate);
  } else if (currentReportType === 'profit-loss') {
    generateProfitLoss(asOfDate);
  } else if (currentReportType === 'balance-sheet') {
    generateBalanceSheet(asOfDate);
  }
}

// 4.1 TRIAL BALANCE GENERATOR
function generateTrialBalance(toDate) {
  const tbody = document.getElementById("tb-tbody");
  tbody.innerHTML = "";

  let grandTotalDebit = 0;
  let grandTotalCredit = 0;

  heads.forEach(h => {
    const balInfo = calculateAccountBalance(h.id, toDate);
    if (balInfo.closing === 0) return; // Skip zero-balance accounts to keep report clean

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
      <td><strong>${h.id}</strong> - ${getHeadName(h)}</td>
      <td>${h.type}</td>
      <td class="text-right text-success">${drVal > 0 ? formatCurrency(drVal) : "-"}</td>
      <td class="text-right text-danger">${crVal > 0 ? formatCurrency(crVal) : "-"}</td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById("tb-total-debit").textContent = formatCurrency(grandTotalDebit);
  document.getElementById("tb-total-credit").textContent = formatCurrency(grandTotalCredit);

  // Validate math matching
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

// Helper: Calculate net Profit/Loss up to date
function calculateNetProfitLoss(toDate) {
  let totalIncome = 0;
  let totalExpense = 0;

  heads.forEach(h => {
    if (h.type === 'Income' || h.type === 'Expense') {
      const balInfo = calculateAccountBalance(h.id, toDate);
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

// 4.2 PROFIT & LOSS STATEMENT GENERATOR
function generateProfitLoss(toDate) {
  const expTbody = document.getElementById("pl-expenses-tbody");
  const incTbody = document.getElementById("pl-incomes-tbody");
  
  expTbody.innerHTML = "";
  incTbody.innerHTML = "";

  let totalExpenseSum = 0;
  let totalIncomeSum = 0;

  heads.forEach(h => {
    if (h.type === 'Income' || h.type === 'Expense') {
      const balInfo = calculateAccountBalance(h.id, toDate);
      if (balInfo.closing === 0) return;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${getHeadName(h)}</td>
        <td class="text-right">${formatCurrency(balInfo.closing)}</td>
      `;

      if (h.type === 'Expense') {
        expTbody.appendChild(tr);
        totalExpenseSum += balInfo.closing;
      } else {
        incTbody.appendChild(tr);
        totalIncomeSum += balInfo.closing;
      }
    }
  });

  // Put placeholders if empty
  if (totalExpenseSum === 0) {
    expTbody.innerHTML = `<tr><td colspan="2" class="text-center text-muted">No expenses recorded.</td></tr>`;
  }
  if (totalIncomeSum === 0) {
    incTbody.innerHTML = `<tr><td colspan="2" class="text-center text-muted">No income recorded.</td></tr>`;
  }

  document.getElementById("pl-total-expenses").textContent = formatCurrency(totalExpenseSum);
  document.getElementById("pl-total-incomes").textContent = formatCurrency(totalIncomeSum);

  const netResults = calculateNetProfitLoss(toDate);
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

// 4.3 BALANCE SHEET GENERATOR
function generateBalanceSheet(toDate) {
  const liabTbody = document.getElementById("bs-liabilities-tbody");
  const assetTbody = document.getElementById("bs-assets-tbody");

  liabTbody.innerHTML = "";
  assetTbody.innerHTML = "";

  let totalAssetsSum = 0;
  let totalLiabCapSum = 0;

  // Assets (Debit Balances)
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

  // Liabilities & Capital (Credit Balances)
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

  // Add Net Profit/Loss from P&L into Liabilities/Capital side
  const netPL = calculateNetProfitLoss(toDate);
  
  if (netPL.netProfit !== 0) {
    const plTr = document.createElement("tr");
    // If profit, it increases Capital (Credit). If loss, it reduces it (Debit / Negative)
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

  // Validate double entry balance sheet equation Assets = Liab + Equity
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


// ==========================================
// 5. CHART OF ACCOUNT HEADS TAB LOGIC
// ==========================================
// Suggest a sub-group name based on account type selection
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
  document.getElementById("head-form-title").textContent = getTranslation("title_new_head");
  document.getElementById("btn-save-head").querySelector("span").textContent = getTranslation("btn_save");
  
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
    // Edit existing
    const index = heads.findIndex(h => h.id === id);
    if (index > -1) {
      // Don't allow changing system accounts
      const isSystem = heads[index].is_system;
      heads[index] = { id, name_en, name_gu, type, group, opening_balance, is_system: isSystem };
    }
  } else {
    // Generate new unique ID
    let baseId = "100";
    if (type === 'Asset') baseId = "1";
    else if (type === 'Liability') baseId = "2";
    else if (type === 'Equity') baseId = "2";
    else if (type === 'Income') baseId = "3";
    else if (type === 'Expense') baseId = "4";

    // Find highest ID in that category to increment
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
    const nameGu = h.name_gu.toLowerCase();
    const code = h.id.toLowerCase();
    const grp = h.group.toLowerCase();

    const matchSearch = nameEn.includes(searchVal) || nameGu.includes(searchVal) || code.includes(searchVal) || grp.includes(searchVal);
    const matchType = typeFilter === "" || h.type === typeFilter;

    return matchSearch && matchType;
  });

  // Sort by code ID
  filteredHeads.sort((a, b) => parseInt(a.id) - parseInt(b.id));

  filteredHeads.forEach(h => {
    const tr = document.createElement("tr");
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
        <div class="row-actions">
          <button class="btn-icon btn-edit" title="Edit" onclick="editHead('${h.id}')">
            <i class="fa-solid fa-pen"></i>
          </button>
          ${h.is_system ? '' : `
          <button class="btn-icon btn-delete" title="Delete" onclick="deleteHead('${h.id}')">
            <i class="fa-solid fa-trash"></i>
          </button>
          `}
        </div>
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
  document.getElementById("h-name-gu").value = head.name_gu;
  document.getElementById("h-type").value = head.type;
  document.getElementById("h-group").value = head.group;
  document.getElementById("h-opening-bal").value = head.opening_balance;

  document.getElementById("head-form-title").textContent = "Edit Account Head";
  document.getElementById("btn-save-head").querySelector("span").textContent = "Update Head";

  // Scroll to form
  document.querySelector(".head-form-card").scrollIntoView({ behavior: 'smooth' });
}

function deleteHead(id) {
  const head = heads.find(h => h.id === id);
  if (!head || head.is_system) return;

  // Check if head has transaction entries recorded
  const hasTxns = transactions.some(t => t.debit_acc === id || t.credit_acc === id);
  if (hasTxns) {
    alert(currentLanguage === 'en' 
      ? "Cannot delete this head! There are transaction entries posted to this account. Delete entries first." 
      : "આ ખાતું ડીલીટ થઇ શકે તેમ નથી! આ ખાતામાં ઓલરેડી વ્યવહારો નોંધાયેલા છે.");
    return;
  }

  const confirmMsg = currentLanguage === 'en' 
    ? `Are you sure you want to delete account head '${head.name_en}'?` 
    : `શું તમે ખરેખર '${head.name_gu}' ખાતાનો હેડ કાઢી નાખવા માંગો છો?`;
    
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
// 6.1 EXPORT TO EXCEL
function exportToExcel() {
  // 1. Prepare Heads Sheet rows
  const headsRows = heads.map(h => ({
    "Account Code": h.id,
    "Name (English)": h.name_en,
    "Name (Gujarati)": h.name_gu,
    "Account Type": h.type,
    "Group Category": h.group,
    "Opening Balance (₹)": h.opening_balance
  }));

  // 2. Prepare Transactions Sheet rows
  const txnRows = transactions.map(t => {
    const drHead = heads.find(h => h.id === t.debit_acc);
    const crHead = heads.find(h => h.id === t.credit_acc);
    return {
      "Transaction ID": t.id,
      "Date (YYYY-MM-DD)": t.date,
      "Voucher Type": t.voucher_type,
      "Debit Account (Dr)": drHead ? `${drHead.id} - ${drHead.name_en}` : t.debit_acc,
      "Credit Account (Cr)": crHead ? `${crHead.id} - ${crHead.name_en}` : t.credit_acc,
      "Amount (₹)": t.amount,
      "Narration / Details": t.narration || ""
    };
  });

  // Create Excel workbook
  const wb = XLSX.utils.book_new();
  
  // Convert JSON rows to sheet
  const wsHeads = XLSX.utils.json_to_sheet(headsRows);
  const wsTxns = XLSX.utils.json_to_sheet(txnRows);

  // Append sheets to workbook
  XLSX.utils.book_append_sheet(wb, wsHeads, "Chart of Accounts");
  XLSX.utils.book_append_sheet(wb, wsTxns, "Transactions");

  // Save/Download Excel file
  const filename = `Tally_Backup_${formatDateString(new Date())}.xlsx`;
  XLSX.writeFile(wb, filename);
}

// 6.2 IMPORT FROM EXCEL
function setupDragAndDrop() {
  const dropzone = document.getElementById("upload-dropzone");
  
  // Prevent browser default drag actions
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => e.preventDefault(), false);
  });

  // Add active hover classes
  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, () => dropzone.classList.add('hover'), false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, () => dropzone.classList.remove('hover'), false);
  });

  // Handle dropped files
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

// Parse Excel Workbook content
function processExcelFile(file) {
  const reader = new FileReader();
  const statusBox = document.getElementById("upload-status-box");
  const progressFill = document.getElementById("progress-bar-fill");
  const statusTitle = document.getElementById("status-title");
  const statusPercent = document.getElementById("status-percent");
  const statusDetails = document.getElementById("status-details");

  // Show status indicator
  statusBox.style.display = "block";
  progressFill.style.style = "width: 10%";
  statusTitle.textContent = currentLanguage === 'en' ? "Reading Excel workbook..." : "એક્સેલ ફાઈલ વાંચી રહ્યા છીએ...";
  statusPercent.textContent = "20%";
  statusDetails.textContent = "";

  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      
      progressFill.style.width = "40%";
      statusTitle.textContent = currentLanguage === 'en' ? "Parsing sheets..." : "પેજીસ સ્કેન કરી રહ્યા છીએ...";
      statusPercent.textContent = "40%";

      // Look for the required sheets in Excel
      const headsSheetName = workbook.SheetNames.find(n => n.toLowerCase().includes("head") || n.toLowerCase().includes("account"));
      const txnsSheetName = workbook.SheetNames.find(n => n.toLowerCase().includes("trans") || n.toLowerCase().includes("entry") || n.toLowerCase().includes("txn"));

      if (!headsSheetName || !txnsSheetName) {
        throw new Error(currentLanguage === 'en'
          ? "Invalid template! Make sure Excel file contains sheets named 'Chart of Accounts' and 'Transactions'."
          : "ખોટું ફોર્મેટ! ફાઇલમાં 'Chart of Accounts' અને 'Transactions' શીટ્સ હોવી જરૂરી છે.");
      }

      // Convert sheets to JSON
      const rawHeadsJson = XLSX.utils.sheet_to_json(workbook.Sheets[headsSheetName]);
      const rawTxnsJson = XLSX.utils.sheet_to_json(workbook.Sheets[txnsSheetName]);

      progressFill.style.width = "60%";
      statusTitle.textContent = currentLanguage === 'en' ? "Validating accounting records..." : "એકાઉન્ટિંગ નિયમો ચકાસી રહ્યા છીએ...";
      statusPercent.textContent = "60%";

      // Process Heads (Chart of Accounts)
      const importedHeads = [];
      rawHeadsJson.forEach(row => {
        // Map excel columns to our objects
        const id = String(row["Account Code"] || row["Code"] || row["ID"] || "").trim();
        const name_en = String(row["Name (English)"] || row["Name"] || row["Name_EN"] || "").trim();
        const name_gu = String(row["Name (Gujarati)"] || row["Name_GU"] || name_en).trim();
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
            is_system: id === "107" // Cash in Hand is system
          });
        }
      });

      // Process Transactions
      const importedTxns = [];
      let skippedCount = 0;

      rawTxnsJson.forEach((row, idx) => {
        const id = String(row["Transaction ID"] || row["ID"] || "TXN" + (Date.now() + idx)).trim();
        const date = String(row["Date (YYYY-MM-DD)"] || row["Date"] || formatDateString(new Date())).trim();
        const voucher_type = capitalizeFirstLetter(String(row["Voucher Type"] || row["Type"] || "Journal").trim());
        const amount = parseFloat(row["Amount (₹)"] || row["Amount"] || 0);
        const narration = String(row["Narration / Details"] || row["Narration"] || "").trim();

        // Resolve Debit/Credit accounts (can be written as ID or full name e.g. "101 - CBI BANK" or "CBI BANK")
        const debitRaw = String(row["Debit Account (Dr)"] || row["Debit"] || "").trim();
        const creditRaw = String(row["Credit Account (Cr)"] || row["Credit"] || "").trim();

        const debit_acc = resolveAccountCode(debitRaw, importedHeads);
        const credit_acc = resolveAccountCode(creditRaw, importedHeads);

        if (debit_acc && credit_acc && amount > 0) {
          importedTxns.push({
            id,
            date,
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

      progressFill.style.width = "90%";
      statusTitle.textContent = currentLanguage === 'en' ? "Saving data..." : "ડેટા સાચવી રહ્યા છીએ...";
      statusPercent.textContent = "90%";

      // Save imported results to state
      heads = importedHeads;
      transactions = importedTxns;
      saveToLocalStorage();

      // Complete
      progressFill.style.width = "100%";
      statusTitle.textContent = currentLanguage === 'en' ? "Import complete!" : "ઈમ્પોર્ટ સફળતાપૂર્વક પૂરું થયું!";
      statusPercent.textContent = "100%";
      statusDetails.textContent = currentLanguage === 'en' 
        ? `Successfully imported ${heads.length} Heads and ${transactions.length} Transactions. (Skipped ${skippedCount} invalid rows).`
        : `સફળતાપૂર્વક ${heads.length} ખાતાઓ અને ${transactions.length} વ્યવહારો ઈમ્પોર્ટ થયા. (${skippedCount} ખાલી હરોળ રદ થઇ).`;
      
      // Refresh app
      initApp();

    } catch (err) {
      console.error(err);
      progressFill.style.width = "100%";
      progressFill.style.backgroundColor = "var(--danger)";
      statusTitle.textContent = currentLanguage === 'en' ? "Upload Failed!" : "અપલોડ નિષ્ફળ!";
      statusPercent.textContent = "Error";
      statusDetails.textContent = err.message;
    }
  };

  reader.readAsArrayBuffer(file);
}

// Utility: Cap first letter (Asset, Liability etc)
function capitalizeFirstLetter(string) {
  if (!string) return "";
  return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
}

// Resolve raw excel Debit/Credit value into a valid account code
function resolveAccountCode(rawVal, currentHeads) {
  if (!rawVal) return null;
  
  // 1. Check if raw value is a clean account code directly
  let cleaned = rawVal.split("-")[0].trim(); // Extract ID if written as "101 - CBI Bank"
  let match = currentHeads.find(h => h.id === cleaned);
  if (match) return match.id;

  // 2. Search by English Name
  match = currentHeads.find(h => h.name_en.toLowerCase() === rawVal.toLowerCase());
  if (match) return match.id;

  // 3. Search by Gujarati Name
  match = currentHeads.find(h => h.name_gu.toLowerCase() === rawVal.toLowerCase());
  if (match) return match.id;

  // 4. Loose lookup: check if head name contains the string
  match = currentHeads.find(h => h.name_en.toLowerCase().includes(rawVal.toLowerCase()) || h.name_gu.toLowerCase().includes(rawVal.toLowerCase()));
  if (match) return match.id;

  return null;
}
