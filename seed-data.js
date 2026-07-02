// Seed data for Tally-style double-entry accounting software
const defaultHeads = [
  // --- ASSETS (મિલકતો) ---
  { id: "101", name_en: "CBI BANK", name_gu: "CBI BANK", type: "Asset", group: "Bank Accounts", opening_balance: 0, is_system: false },
  { id: "102", name_en: "JCOM BANK", name_gu: "JCOM BANK", type: "Asset", group: "Bank Accounts", opening_balance: 0, is_system: false },
  { id: "103", name_en: "CBI FD Issue", name_gu: "CBI FD Issue", type: "Asset", group: "Investments", opening_balance: 0, is_system: false },
  { id: "104", name_en: "JCOM FD Issue", name_gu: "JCOM FD Issue", type: "Asset", group: "Investments", opening_balance: 0, is_system: false },
  { id: "105", name_en: "Furniture Purchase", name_gu: "Furniture Purchase", type: "Asset", group: "Fixed Assets", opening_balance: 0, is_system: false },
  { id: "106", name_en: "Electric Equipment Purchase & Expense", name_gu: "Electric Equipment", type: "Asset", group: "Fixed Assets", opening_balance: 0, is_system: false },
  { id: "107", name_en: "Cash in Hand", name_gu: "Cash in Hand", type: "Asset", group: "Cash Account", opening_balance: 0, is_system: true },

  // --- EQUITY & LIABILITIES (મૂડી અને દેવું) ---
  { id: "201", name_en: "Builder Capital Account", name_gu: "Builder Capital Account", type: "Equity", group: "Capital Accounts", opening_balance: 0, is_system: false },
  { id: "206", name_en: "Member Maintenance Deposits", name_gu: "Member Maintenance Deposits", type: "Liability", group: "Current Liabilities", opening_balance: 0, is_system: true },

  // --- INCOME (આવક) ---
  { id: "301", name_en: "Builder Transaction Income", name_gu: "Builder Transaction Income", type: "Income", group: "Direct Incomes", opening_balance: 0, is_system: false },
  { id: "302", name_en: "Maintenance Income", name_gu: "Maintenance Income", type: "Income", group: "Direct Incomes", opening_balance: 0, is_system: false },
  { id: "303", name_en: "Other Income", name_gu: "Other Income", type: "Income", group: "Indirect Incomes", opening_balance: 0, is_system: false },
  { id: "304", name_en: "JCOM FD Interest", name_gu: "JCOM FD Interest", type: "Income", group: "Indirect Incomes", opening_balance: 0, is_system: false },
  { id: "305", name_en: "JCOM Saving Interest", name_gu: "JCOM Saving Interest", type: "Income", group: "Indirect Incomes", opening_balance: 0, is_system: false },
  { id: "306", name_en: "CBI FD Interest", name_gu: "CBI FD Interest", type: "Income", group: "Indirect Incomes", opening_balance: 0, is_system: false },

  // --- EXPENSES (ખર્ચ) ---
  { id: "401", name_en: "CBI Bank Account Charges", name_gu: "CBI Bank Charges", type: "Expense", group: "Indirect Expenses", opening_balance: 0, is_system: false },
  { id: "402", name_en: "Audit Fee", name_gu: "Audit Fee", type: "Expense", group: "Indirect Expenses", opening_balance: 0, is_system: false },
  { id: "403", name_en: "Theater Maintenance", name_gu: "Theater Maintenance", type: "Expense", group: "Direct Expenses", opening_balance: 0, is_system: false },
  { id: "404", name_en: "Fire Bottle Refilling", name_gu: "Fire Bottle Refilling", type: "Expense", group: "Direct Expenses", opening_balance: 0, is_system: false },
  { id: "405", name_en: "Wifi Recharge", name_gu: "Wifi Recharge", type: "Expense", group: "Indirect Expenses", opening_balance: 0, is_system: false },
  { id: "406", name_en: "Plumbing Expense", name_gu: "Plumbing Expense", type: "Expense", group: "Direct Expenses", opening_balance: 0, is_system: false },
  { id: "407", name_en: "Lift Maintenance", name_gu: "Lift Maintenance", type: "Expense", group: "Direct Expenses", opening_balance: 0, is_system: false },
  { id: "408", name_en: "Light Bill", name_gu: "Light Bill", type: "Expense", group: "Direct Expenses", opening_balance: 0, is_system: false },
  { id: "409", name_en: "Garden Maintenance", name_gu: "Garden Maintenance", type: "Expense", group: "Direct Expenses", opening_balance: 0, is_system: false },
  { id: "410", name_en: "Safai Expense", name_gu: "Safai Expense", type: "Expense", group: "Direct Expenses", opening_balance: 0, is_system: false },
  { id: "411", name_en: "Safai Kamdar Salary", name_gu: "Safai Kamdar Salary", type: "Expense", group: "Direct Expenses", opening_balance: 0, is_system: false },
  { id: "412", name_en: "Other Misc. Expense", name_gu: "Other Misc. Expense", type: "Expense", group: "Indirect Expenses", opening_balance: 0, is_system: false },
  { id: "413", name_en: "RTGS / NEFT Charges", name_gu: "RTGS / NEFT Charges", type: "Expense", group: "Indirect Expenses", opening_balance: 0, is_system: false },
  { id: "414", name_en: "Reparing & Maintancne", name_gu: "Reparing & Maintenance", type: "Expense", group: "Direct Expenses", opening_balance: 0, is_system: false },
  { id: "415", name_en: "Security Salary", name_gu: "Security Salary", type: "Expense", group: "Direct Expenses", opening_balance: 0, is_system: false },
  { id: "416", name_en: "Gardner Salary", name_gu: "Gardner Salary", type: "Expense", group: "Direct Expenses", opening_balance: 0, is_system: false },
  { id: "417", name_en: "Berior Reparing Expense", name_gu: "Berior Reparing Expense", type: "Expense", group: "Direct Expenses", opening_balance: 0, is_system: false },
  { id: "418", name_en: "Stationary Purchase", name_gu: "Stationary Purchase", type: "Expense", group: "Indirect Expenses", opening_balance: 0, is_system: false },
  { id: "419", name_en: "JCOM Bank Account Charges", name_gu: "JCOM Bank Charges", type: "Expense", group: "Indirect Expenses", opening_balance: 0, is_system: false },
  { id: "420", name_en: "Diesal Expences", name_gu: "Diesal Expenses", type: "Expense", group: "Direct Expenses", opening_balance: 0, is_system: false },
  { id: "421", name_en: "Gym Maintenance", name_gu: "Gym Maintenance", type: "Expense", group: "Direct Expenses", opening_balance: 0, is_system: false },
  { id: "422", name_en: "Generator Reparing", name_gu: "Generator Reparing", type: "Expense", group: "Direct Expenses", opening_balance: 0, is_system: false },
  { id: "423", name_en: "Lift AMC", name_gu: "Lift AMC", type: "Expense", group: "Direct Expenses", opening_balance: 0, is_system: false },
  { id: "424", name_en: "Maintenance Paid", name_gu: "Maintenance Paid", type: "Expense", group: "Direct Expenses", opening_balance: 0, is_system: false }
];

// Seed opening balance transaction for Cash on 05-07-2024
const defaultTransactions = [
  {
    id: "TXN00001",
    date: "2024-07-05",
    voucher_type: "Journal",
    debit_acc: "107",  // Cash in Hand
    credit_acc: "201", // Builder Capital Account
    amount: 30300,
    narration: "Opening Cash Balance of Orchid Heights as of 05-07-2024"
  }
];

if (typeof module !== 'undefined') {
  module.exports = { defaultHeads, defaultTransactions };
}
