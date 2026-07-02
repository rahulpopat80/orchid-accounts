// Automated accounting math verification test
const { defaultHeads, defaultTransactions } = require('./seed-data.js');

console.log("=== Running Automated Double-Entry Bookkeeping Math Validation ===");

// 1. Verify Trial Balance
let totalDebit = 0;
let totalCredit = 0;

console.log("\nCalculating account balances...");
defaultHeads.forEach(head => {
  let opening = head.opening_balance || 0;
  let debits = 0;
  let credits = 0;

  defaultTransactions.forEach(t => {
    if (t.debit_acc === head.id) {
      debits += t.amount;
    }
    if (t.credit_acc === head.id) {
      credits += t.amount;
    }
  });

  let balance = 0;
  if (head.type === 'Asset' || head.type === 'Expense') {
    balance = opening + debits - credits;
  } else {
    balance = opening + credits - debits;
  }

  if (balance !== 0) {
    console.log(`- Account: ${head.name_en} (${head.type}) -> Balance: ${balance}`);
  }

  // Add to Trial Balance
  const isDebit = head.type === 'Asset' || head.type === 'Expense';
  if (isDebit) {
    totalDebit += balance;
  } else {
    totalCredit += balance;
  }
});

console.log("\n--- Trial Balance Summary ---");
console.log(`Total Debits:  ₹${totalDebit}`);
console.log(`Total Credits: ₹${totalCredit}`);

const diff = Math.abs(totalDebit - totalCredit);
if (diff < 0.01) {
  console.log("✅ PASS: Trial Balance is perfectly balanced! Debit matches Credit.");
} else {
  console.error(`❌ FAIL: Trial Balance is out of balance by ₹${diff}!`);
  process.exit(1);
}

// 2. Verify Balance Sheet Equation (Assets = Liabilities + Equity + Net Profit)
let assets = 0;
let liabilities = 0;
let equity = 0;
let income = 0;
let expenses = 0;

defaultHeads.forEach(head => {
  let opening = head.opening_balance || 0;
  let debits = 0;
  let credits = 0;

  defaultTransactions.forEach(t => {
    if (t.debit_acc === head.id) {
      debits += t.amount;
    }
    if (t.credit_acc === head.id) {
      credits += t.amount;
    }
  });

  let balance = 0;
  if (head.type === 'Asset' || head.type === 'Expense') {
    balance = opening + debits - credits;
  } else {
    balance = opening + credits - debits;
  }

  if (head.type === 'Asset') assets += balance;
  if (head.type === 'Liability') liabilities += balance;
  if (head.type === 'Equity') equity += balance;
  if (head.type === 'Income') income += balance;
  if (head.type === 'Expense') expenses += balance;
});

const netProfit = income - expenses;
const totalLiabAndCapital = liabilities + equity + netProfit;

console.log("\n--- Balance Sheet Summary ---");
console.log(`Total Assets:                     ₹${assets}`);
console.log(`Liabilities + Capital + Profit:   ₹${totalLiabAndCapital} (Liab: ₹${liabilities}, Equity: ₹${equity}, Net Profit: ₹${netProfit})`);

const bsDiff = Math.abs(assets - totalLiabAndCapital);
if (bsDiff < 0.01) {
  console.log("✅ PASS: Balance Sheet matches! Assets equal Liabilities + Equity + Net Profit.");
} else {
  console.error(`❌ FAIL: Balance Sheet does not match! Difference: ₹${bsDiff}`);
  process.exit(1);
}

console.log("\n=== All validation checks passed! ===");
