// ===== BarberCash - Data Layer =====
// localStorage-based persistence with CRUD operations

const STORAGE_KEY = 'barbercash_transactions';

const Professionals = [
  { id: 'gabriel', name: 'Gabriel', initials: 'GA', color: '#6366f1' },
  { id: 'everton', name: 'Everton', initials: 'EV', color: '#22d3ee' },
  { id: 'sem-nome', name: 'Sem Nome', initials: 'SN', color: '#a78bfa' }
];

const Categories = {
  income: [
    { id: 'service', label: 'Serviço', icon: '✂️', examples: 'Corte, barba, etc.' },
    { id: 'product', label: 'Produto', icon: '🧴', examples: 'Pomada, óleo, etc.' }
  ],
  expense: [
    { id: 'direct_cost', label: 'Custo Direto', icon: '🪒', examples: 'Lâminas, produtos' },
    { id: 'indirect_cost', label: 'Custo Indireto', icon: '🏠', examples: 'Aluguel, luz, internet' }
  ]
};

// Generate UUID
function generateId() {
  return 'tx_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
}

// Get all transactions
function getTransactions() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('Error reading transactions:', e);
    return [];
  }
}

// Save all transactions
function saveTransactions(transactions) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  } catch (e) {
    console.error('Error saving transactions:', e);
  }
}

// Add a transaction
function addTransaction(tx) {
  const transaction = {
    id: generateId(),
    type: tx.type, // 'income' or 'expense'
    category: tx.category, // 'service', 'product', 'direct_cost', 'indirect_cost'
    description: tx.description || '',
    amount: parseFloat(tx.amount),
    professionalId: tx.professionalId || null,
    date: tx.date || getTodayStr(),
    createdAt: new Date().toISOString()
  };
  const transactions = getTransactions();
  transactions.unshift(transaction);
  saveTransactions(transactions);
  return transaction;
}

// Update a transaction
function updateTransaction(id, updates) {
  const transactions = getTransactions();
  const index = transactions.findIndex(t => t.id === id);
  if (index === -1) return null;
  transactions[index] = { ...transactions[index], ...updates };
  saveTransactions(transactions);
  return transactions[index];
}

// Delete a transaction
function deleteTransaction(id) {
  const transactions = getTransactions();
  const filtered = transactions.filter(t => t.id !== id);
  saveTransactions(filtered);
  return filtered;
}

// Clear all transactions
function clearAllTransactions() {
  localStorage.removeItem(STORAGE_KEY);
}

// Get today's date as YYYY-MM-DD
function getTodayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + 
    String(d.getMonth() + 1).padStart(2, '0') + '-' + 
    String(d.getDate()).padStart(2, '0');
}

// Format money
function formatMoney(value) {
  return 'R$ ' + parseFloat(value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// Format date for display
function formatDateDisplay(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  return parts[2] + '/' + parts[1] + '/' + parts[0];
}

// Get professional name by ID
function getProfessionalName(id) {
  const prof = Professionals.find(p => p.id === id);
  return prof ? prof.name : '—';
}

// Get category label
function getCategoryLabel(categoryId) {
  const allCats = [...Categories.income, ...Categories.expense];
  const cat = allCats.find(c => c.id === categoryId);
  return cat ? cat.label : categoryId;
}

// Get category icon
function getCategoryIcon(categoryId) {
  const allCats = [...Categories.income, ...Categories.expense];
  const cat = allCats.find(c => c.id === categoryId);
  return cat ? cat.icon : '📋';
}

// Filter transactions by period
function filterByPeriod(transactions, period, refDate) {
  const ref = refDate ? new Date(refDate + 'T12:00:00') : new Date();
  
  return transactions.filter(tx => {
    const txDate = new Date(tx.date + 'T12:00:00');
    
    if (period === 'day') {
      return tx.date === formatDateISO(ref);
    } else if (period === 'week') {
      const startOfWeek = new Date(ref);
      startOfWeek.setDate(ref.getDate() - ref.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      return txDate >= startOfWeek && txDate <= endOfWeek;
    } else if (period === 'month') {
      return txDate.getMonth() === ref.getMonth() && txDate.getFullYear() === ref.getFullYear();
    }
    return true;
  });
}

function formatDateISO(date) {
  return date.getFullYear() + '-' + 
    String(date.getMonth() + 1).padStart(2, '0') + '-' + 
    String(date.getDate()).padStart(2, '0');
}

// Calculate report data
function calculateReport(transactions) {
  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const profit = totalIncome - totalExpenses;

  // Revenue per professional
  const profData = {};
  Professionals.forEach(p => {
    profData[p.id] = {
      name: p.name,
      income: 0,
      directCosts: 0,
      proportionalCosts: 0,
      profit: 0
    };
  });

  // Sum income per professional
  transactions.filter(t => t.type === 'income').forEach(t => {
    const pid = t.professionalId || 'sem-nome';
    if (profData[pid]) {
      profData[pid].income += t.amount;
    }
  });

  // Direct costs assigned to specific professional
  const assignedCosts = transactions.filter(t => t.type === 'expense' && t.professionalId);
  assignedCosts.forEach(t => {
    if (profData[t.professionalId]) {
      profData[t.professionalId].directCosts += t.amount;
    }
  });

  // Unassigned costs (indirect) - split proportionally
  const unassignedCosts = transactions
    .filter(t => t.type === 'expense' && !t.professionalId)
    .reduce((sum, t) => sum + t.amount, 0);
  
  const costPerProfessional = unassignedCosts / Professionals.length;
  Professionals.forEach(p => {
    profData[p.id].proportionalCosts = costPerProfessional;
    profData[p.id].profit = profData[p.id].income - profData[p.id].directCosts - profData[p.id].proportionalCosts;
  });

  return {
    totalIncome,
    totalExpenses,
    profit,
    profData,
    incomeCount: transactions.filter(t => t.type === 'income').length,
    expenseCount: transactions.filter(t => t.type === 'expense').length
  };
}
