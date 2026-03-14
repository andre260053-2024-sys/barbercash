// ===== BarberCash - Data Layer (Firebase) =====

const firebaseConfig = {
  apiKey: "AIzaSyDOwLXRyXsP3ekdzxJpFZVi9awq_zQYwXs",
  authDomain: "barbercash-680fd.firebaseapp.com",
  projectId: "barbercash-680fd",
  storageBucket: "barbercash-680fd.firebasestorage.app",
  messagingSenderId: "470125229013",
  appId: "1:470125229013:web:943db79ba0d5774e79435c",
  measurementId: "G-JN0WLCC51G"
};

// Inicializa Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const Professionals = [
  { id: 'gabriel', name: 'Gabriel', initials: 'GA', color: '#7c3aed' }, // Roxo vibrante
  { id: 'everton', name: 'Everton', initials: 'EV', color: '#06b6d4' }, // Ciano vibrante
  { id: 'sem-nome', name: 'Sem Nome', initials: 'SN', color: '#a78bfa' } // Lilás suave
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

// Local state for transactions synced with Firebase
let localTransactions = [];

// Listener em tempo real do Firestore
db.collection("transactions").orderBy("createdAt", "desc").onSnapshot((snapshot) => {
  localTransactions = [];
  snapshot.forEach((doc) => {
    localTransactions.push({ id: doc.id, ...doc.data() });
  });
  
  // Atualiza a UI se as funções do app.js já estiverem carregadas
  if (typeof renderHistory === 'function') {
    renderHistory();
  }
  if (typeof reportGenerated !== 'undefined' && reportGenerated && typeof generateReport === 'function') {
    generateReport();
  }
});

// Get all transactions
function getTransactions() {
  return localTransactions;
}

// Save all (usado apenas pro importBackup)
function saveTransactions(transactions) {
  transactions.forEach(tx => {
    const id = tx.id || generateId();
    db.collection("transactions").doc(id).set(tx);
  });
}

// Add a transaction
function addTransaction(tx) {
  const transaction = {
    type: tx.type,
    category: tx.category,
    description: tx.description || '',
    amount: parseFloat(tx.amount),
    professionalId: tx.professionalId || null,
    date: tx.date || getTodayStr(),
    createdAt: new Date().toISOString()
  };
  const id = generateId();
  db.collection("transactions").doc(id).set(transaction);
  return { id, ...transaction };
}

// Update a transaction
function updateTransaction(id, updates) {
  db.collection("transactions").doc(id).update(updates);
  return { id, ...updates };
}

// Delete a transaction
function deleteTransaction(id) {
  db.collection("transactions").doc(id).delete();
}

// Clear all transactions
function clearAllTransactions() {
  localTransactions.forEach(tx => {
    db.collection("transactions").doc(tx.id).delete();
  });
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

// ===== Backup & Restore =====
function exportBackup() {
  const transactions = getTransactions();
  if (transactions.length === 0) return null;
  
  const ws = XLSX.utils.json_to_sheet(transactions);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Backup_BarberCash');
  
  XLSX.writeFile(wb, `barbercash_backup_${getTodayStr()}.xlsx`);
  return true;
}

function importBackup(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        // raw: false força o SheetJS a retornar os dados formatados como string (ex: "14/03/2026", "106,99")
        const rows = XLSX.utils.sheet_to_json(worksheet, { raw: false, defval: '' });
        
        if (!rows || rows.length === 0) {
          reject('Arquivo inválido ou vazio');
          return;
        }

        const existing = getTransactions();
        const existingIds = new Set(existing.map(t => t.id));
        const newTxs = [];
        
        for (const rawRow of rows) {
          // Normaliza as chaves removendo espaços extras para garantir a leitura
          const row = {};
          for (let key in rawRow) {
             row[key.trim()] = rawRow[key];
          }

          let tx = null;
          
          if (row['id'] && row['amount'] && row['type']) {
            tx = { ...row };
            tx.amount = parseFloat(String(tx.amount).replace(/[^0-9.-]+/g,""));
          } else if (row['Valor (R$)'] !== undefined || row['Valor'] !== undefined) {
             const valKey = row['Valor (R$)'] !== undefined ? 'Valor (R$)' : 'Valor';
             
             // Limpa o valor (troca vírgula por ponto, tira R$)
             let valStr = String(row[valKey]).replace('R$', '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.').trim();
             const amt = parseFloat(valStr) || 0;
             if (amt <= 0) continue; 
             
             let type = 'income';
             const tipoStr = String(row['Tipo']).toLowerCase();
             if (tipoStr.includes('saíd') || tipoStr.includes('said')) type = 'expense';
             
             let categoryId = type === 'income' ? 'service' : 'direct_cost';
             const catLabel = String(row['Categoria']).toLowerCase();
             if (catLabel.includes('produto')) categoryId = 'product';
             if (catLabel.includes('indireto')) categoryId = 'indirect_cost';
             
             let profId = null;
             const profStr = String(row['Profissional']).toLowerCase();
             if (profStr.includes('gabriel')) profId = 'gabriel';
             if (profStr.includes('everton')) profId = 'everton';
             if (profStr.includes('sem nome')) profId = 'sem-nome';
             
             let dateStr = getTodayStr();
             const dStr = String(row['Data']).trim();
             if (dStr) {
               const parts = dStr.split('/');
               if (parts.length === 3) dateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
               else dateStr = dStr; // Se vier num formato diferente, usa como veio
             }
             
             tx = {
               id: generateId(),
               type,
               category: categoryId,
               description: row['Descrição'] || '',
               amount: amt,
               professionalId: profId,
               date: dateStr,
               createdAt: new Date().toISOString()
             };
          }

          if (tx && tx.amount) {
            tx.amount = parseFloat(tx.amount);
            if (tx.professionalId === 'null' || !tx.professionalId) tx.professionalId = null;
            if (!existingIds.has(tx.id)) {
              newTxs.push(tx);
              existingIds.add(tx.id); 
            }
          }
        }

        if (newTxs.length === 0) {
           reject('Nenhuma transação válida e nova encontrada na planilha.');
           return;
        }

        // Salvar apenas as novas no Firebase para economizar requisições
        saveTransactions(newTxs);
        resolve({ imported: newTxs.length, total: existing.length + newTxs.length, skipped: rows.length - newTxs.length });
      } catch (err) {
        reject('Erro ao ler XLSX: ' + err.message);
      }
    };
    reader.onerror = () => reject('Erro ao ler o arquivo');
    reader.readAsArrayBuffer(file);
  });
}
