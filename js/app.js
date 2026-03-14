// ===== BarberCash - Main Application =====

let currentTab = 'income';
let editingTxId = null;
let reportGenerated = false;
let reportPeriod = 'month';
let reportRefDate = getTodayStr();

// ===== Toast System =====
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  toast.innerHTML = `<span>${icons[type] || ''}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('hide');
    setTimeout(() => toast.remove(), 400);
  }, 2800);
}

// ===== Navigation =====
function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  
  document.getElementById('page-' + tab).classList.add('active');
  document.querySelector(`[data-tab="${tab}"]`).classList.add('active');

  // Re-animate page
  const page = document.getElementById('page-' + tab);
  page.style.animation = 'none';
  page.offsetHeight; // trigger reflow
  page.style.animation = '';

  if (tab === 'history') renderHistory();
  if (tab === 'reports' && reportGenerated) generateReport();
}

// ===== Income Form =====
function setupIncomeForm() {
  const form = document.getElementById('incomeForm');
  const dateInput = document.getElementById('incomeDate');
  dateInput.value = getTodayStr();

  // Type pills
  document.querySelectorAll('#page-income .type-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('#page-income .type-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
    });
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const category = document.querySelector('#page-income .type-pill.active')?.dataset.value;
    const amount = document.getElementById('incomeAmount').value;
    const professional = document.getElementById('incomeProfessional').value;
    const description = document.getElementById('incomeDescription').value;
    const date = dateInput.value;

    if (!category) { showToast('Selecione o tipo (Serviço ou Produto)', 'error'); return; }
    if (!amount || parseFloat(amount) <= 0) { showToast('Informe um valor válido', 'error'); return; }
    if (!professional) { showToast('Selecione o profissional', 'error'); return; }

    addTransaction({
      type: 'income',
      category,
      description: description || (category === 'service' ? 'Serviço' : 'Produto'),
      amount: parseFloat(amount),
      professionalId: professional,
      date
    });

    showToast(`Entrada de ${formatMoney(amount)} registrada! 💰`);
    form.reset();
    dateInput.value = getTodayStr();
    document.querySelectorAll('#page-income .type-pill').forEach(p => p.classList.remove('active'));
    document.querySelector('#page-income .type-pill[data-value="service"]').classList.add('active');
    reportGenerated = false;
  });
}

// ===== Expense Form =====
function setupExpenseForm() {
  const form = document.getElementById('expenseForm');
  const dateInput = document.getElementById('expenseDate');
  dateInput.value = getTodayStr();

  document.querySelectorAll('#page-expense .type-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('#page-expense .type-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
    });
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const category = document.querySelector('#page-expense .type-pill.active')?.dataset.value;
    const amount = document.getElementById('expenseAmount').value;
    const professional = document.getElementById('expenseProfessional').value;
    const description = document.getElementById('expenseDescription').value;
    const date = dateInput.value;

    if (!category) { showToast('Selecione o tipo de custo', 'error'); return; }
    if (!amount || parseFloat(amount) <= 0) { showToast('Informe um valor válido', 'error'); return; }

    addTransaction({
      type: 'expense',
      category,
      description: description || getCategoryLabel(category),
      amount: parseFloat(amount),
      professionalId: professional || null,
      date
    });

    showToast(`Saída de ${formatMoney(amount)} registrada! 📝`);
    form.reset();
    dateInput.value = getTodayStr();
    document.querySelectorAll('#page-expense .type-pill').forEach(p => p.classList.remove('active'));
    document.querySelector('#page-expense .type-pill[data-value="direct_cost"]').classList.add('active');
    reportGenerated = false;
  });
}

// ===== History =====
function renderHistory() {
  const list = document.getElementById('historyList');
  const filterType = document.getElementById('historyFilterType')?.value || 'all';
  let transactions = getTransactions();

  if (filterType !== 'all') {
    transactions = transactions.filter(t => t.type === filterType);
  }

  // Sort by date descending
  transactions.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

  if (transactions.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="icon">📋</div>
        <p>Nenhuma transação registrada.<br>Comece registrando uma entrada ou saída.</p>
      </div>`;
    document.getElementById('historyCount').textContent = '0 transações';
    return;
  }

  document.getElementById('historyCount').textContent = `${transactions.length} transação${transactions.length > 1 ? 'ões' : ''}`;

  list.innerHTML = transactions.map((tx, i) => `
    <li class="tx-item" style="animation-delay: ${i * 0.03}s">
      <div class="tx-icon ${tx.type}">${getCategoryIcon(tx.category)}</div>
      <div class="tx-info">
        <div class="tx-desc">${escapeHtml(tx.description)}</div>
        <div class="tx-meta">
          <span>${formatDateDisplay(tx.date)}</span>
          <span>•</span>
          <span>${getCategoryLabel(tx.category)}</span>
          ${tx.professionalId ? `<span>•</span><span>${getProfessionalName(tx.professionalId)}</span>` : ''}
        </div>
      </div>
      <div class="tx-amount ${tx.type}">${tx.type === 'income' ? '+' : '-'}${formatMoney(tx.amount)}</div>
      <div class="tx-actions">
        <button class="btn btn-outline btn-icon" onclick="openEditModal('${tx.id}')" title="Editar">✏️</button>
        <button class="btn btn-danger btn-icon" onclick="confirmDeleteTx('${tx.id}')" title="Excluir">🗑️</button>
      </div>
    </li>
  `).join('');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ===== Edit Modal =====
function openEditModal(txId) {
  editingTxId = txId;
  const transactions = getTransactions();
  const tx = transactions.find(t => t.id === txId);
  if (!tx) return;

  document.getElementById('editType').value = tx.type;
  document.getElementById('editCategory').value = tx.category;
  document.getElementById('editAmount').value = tx.amount;
  document.getElementById('editDescription').value = tx.description;
  document.getElementById('editDate').value = tx.date;
  document.getElementById('editProfessional').value = tx.professionalId || '';

  document.getElementById('editModal').classList.remove('hidden');
}

function closeEditModal() {
  document.getElementById('editModal').classList.add('hidden');
  editingTxId = null;
}

function saveEdit() {
  if (!editingTxId) return;

  const updates = {
    type: document.getElementById('editType').value,
    category: document.getElementById('editCategory').value,
    amount: parseFloat(document.getElementById('editAmount').value),
    description: document.getElementById('editDescription').value,
    date: document.getElementById('editDate').value,
    professionalId: document.getElementById('editProfessional').value || null
  };

  if (!updates.amount || updates.amount <= 0) {
    showToast('Informe um valor válido', 'error');
    return;
  }

  updateTransaction(editingTxId, updates);
  showToast('Transação atualizada! ✅');
  closeEditModal();
  renderHistory();
  reportGenerated = false;
}

function confirmDeleteTx(txId) {
  const tx = getTransactions().find(t => t.id === txId);
  if (!tx) return;
  
  if (confirm(`Excluir "${tx.description}" — ${formatMoney(tx.amount)}?`)) {
    deleteTransaction(txId);
    showToast('Transação removida', 'info');
    renderHistory();
    reportGenerated = false;
  }
}

// ===== Clear History =====
function confirmClearHistory() {
  document.getElementById('clearModal').classList.remove('hidden');
}

function closeClearModal() {
  document.getElementById('clearModal').classList.add('hidden');
}

function executeClearHistory() {
  clearAllTransactions();
  showToast('Histórico limpo com sucesso!', 'info');
  closeClearModal();
  renderHistory();
  reportGenerated = false;
}

// ===== Reports =====
Chart.register(ChartDataLabels); // Registra plugin globalmente
let pieChart = null;
let barChart = null;

function setPeriod(period) {
  reportPeriod = period;
  document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`.period-btn[data-period="${period}"]`).classList.add('active');
  if (reportGenerated) generateReport();
}

function generateReport() {
  reportGenerated = true;
  const allTransactions = getTransactions();
  const filtered = filterByPeriod(allTransactions, reportPeriod, reportRefDate);
  const report = calculateReport(filtered);

  // Update stat cards
  document.getElementById('statIncome').textContent = formatMoney(report.totalIncome);
  document.getElementById('statExpense').textContent = formatMoney(report.totalExpenses);
  document.getElementById('statProfit').textContent = formatMoney(report.profit);

  // Update professional cards
  const profsContainer = document.getElementById('profsContainer');
  profsContainer.innerHTML = Professionals.map(p => {
    const data = report.profData[p.id];
    const totalCost = data.directCosts + data.proportionalCosts;
    return `
      <div class="prof-card">
        <div class="prof-avatar ${p.id}">${p.initials}</div>
        <div class="prof-info">
          <div class="prof-name">${p.name}</div>
          <div class="prof-detail">
            Custos: ${formatMoney(totalCost)}
            ${data.proportionalCosts > 0 ? `(${formatMoney(data.proportionalCosts)} proporcional)` : ''}
          </div>
        </div>
        <div class="prof-values">
          <div class="prof-revenue">${formatMoney(data.income)}</div>
          <div class="prof-profit" style="color: ${data.profit >= 0 ? 'var(--success)' : 'var(--danger)'}">
            Lucro: ${formatMoney(data.profit)}
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Show report section
  document.getElementById('reportResults').classList.remove('hidden');

  // Render Charts
  renderPieChart(report);
  renderBarChart(report);
}

function renderPieChart(report) {
  const ctx = document.getElementById('pieChart').getContext('2d');
  const labels = Professionals.map(p => p.name);
  const data = Professionals.map(p => report.profData[p.id].income);
  const colors = Professionals.map(p => p.color);

  if (pieChart) pieChart.destroy();
  
  pieChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderWidth: 0,
        hoverOffset: 12
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#8b8fa3',
            font: { family: 'Inter', size: 12, weight: '500' },
            padding: 16,
            usePointStyle: true,
            pointStyleWidth: 10
          }
        },
        tooltip: {
          backgroundColor: '#1e2235',
          titleColor: '#f0f0f5',
          bodyColor: '#f0f0f5',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          cornerRadius: 8,
          padding: 12,
          titleFont: { family: 'Inter', weight: '600' },
          bodyFont: { family: 'Inter' },
          callbacks: {
            label: ctx => ` ${ctx.label}: ${formatMoney(ctx.raw)}`
          }
        },
        datalabels: {
          color: '#ffffff',
          font: { family: 'Inter', weight: 'bold', size: 13 },
          formatter: (value, ctx) => {
             if (value === 0) return '';
             let sum = 0;
             let dataArr = ctx.chart.data.datasets[0].data;
             dataArr.map(data => { sum += data; });
             let percentage = (value * 100 / sum).toFixed(1) + "%";
             return percentage;
          },
          textShadowBlur: 4,
          textShadowColor: 'rgba(0,0,0,0.5)'
        }
      }
    }
  });
}

function renderBarChart(report) {
  const ctx = document.getElementById('barChart').getContext('2d');

  if (barChart) barChart.destroy();

  const labels = [...Professionals.map(p => p.name), 'Geral'];
  const incomes = [...Professionals.map(p => report.profData[p.id].income), report.totalIncome];
  const costs = [...Professionals.map(p => report.profData[p.id].directCosts + report.profData[p.id].proportionalCosts), report.totalExpenses];
  const profits = [...Professionals.map(p => report.profData[p.id].profit), report.profit];

  barChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Receitas',
          data: incomes,
          backgroundColor: 'rgba(0, 123, 255, 0.8)', // Neon Blue
          borderColor: '#007bff',
          borderWidth: 1,
          borderRadius: 4
        },
        {
          label: 'Custos',
          data: costs,
          backgroundColor: 'rgba(255, 0, 127, 0.8)', // Neon Pink
          borderColor: '#ff007f',
          borderWidth: 1,
          borderRadius: 4
        },
        {
          label: 'Lucro',
          data: profits,
          backgroundColor: (ctx) => ctx.raw >= 0 ? 'rgba(0, 230, 118, 0.8)' : 'rgba(255, 0, 127, 0.4)', // Neon Green or faded Pink
          borderColor: (ctx) => ctx.raw >= 0 ? '#00e676' : '#ff007f',
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
          display: true,
          position: 'bottom',
          labels: { color: '#8b8fa3', font: { family: 'Inter', size: 11 }, usePointStyle: true, pointStyleWidth: 12, padding: 20 }
        },
        tooltip: {
          backgroundColor: '#1e2235',
          titleColor: '#f0f0f5',
          bodyColor: '#f0f0f5',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          cornerRadius: 8,
          padding: 12,
          titleFont: { family: 'Inter', weight: '600' },
          bodyFont: { family: 'Inter' },
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${formatMoney(ctx.raw)}`
          }
        },
        datalabels: {
          anchor: 'end',
          align: 'end',
          offset: 2,
          color: (ctx) => {
             if (ctx.datasetIndex === 2 && ctx.raw < 0) return '#f87171';
             return '#e0e2ed';
          },
          font: { family: 'Inter', weight: 'bold', size: 9 },
          formatter: (value) => {
            if (value === 0) return '';
            // Formatação compacta para evitar que os números de barras diferentes se sobreponham
            // Ex: 1000 -> 1k, 1500 -> 1.5k, etc
            if (Math.abs(value) >= 1000) {
              return (value / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 1 }) + 'k';
            }
            return Math.round(value).toString();
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: '#8b8fa3',
            font: { family: 'Inter', size: 10, weight: '600' }
          }
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: {
            color: '#5a5e72',
            font: { family: 'Inter', size: 10 },
            callback: v => 'R$ ' + v.toLocaleString('pt-BR')
          },
          suggestedMax: report.totalIncome * 1.15 
        }
      }
    }
  });
}

// ===== Export to XLSX =====
function exportReport() {
  const allTransactions = getTransactions();
  const filtered = filterByPeriod(allTransactions, reportPeriod, reportRefDate);
  
  if (filtered.length === 0) {
    showToast('Não há dados para exportar neste período', 'error');
    return;
  }

  const report = calculateReport(filtered);

  // Sheet 1: Transactions
  const txData = filtered.map(tx => ({
    'Data': formatDateDisplay(tx.date),
    'Tipo': tx.type === 'income' ? 'Entrada' : 'Saída',
    'Categoria': getCategoryLabel(tx.category),
    'Descrição': tx.description,
    'Profissional': tx.professionalId ? getProfessionalName(tx.professionalId) : '—',
    'Valor (R$)': tx.amount
  }));

  // Sheet 2: Summary
  const summaryData = [
    { 'Indicador': 'Receita Total', 'Valor (R$)': report.totalIncome },
    { 'Indicador': 'Custos Totais', 'Valor (R$)': report.totalExpenses },
    { 'Indicador': 'Lucro Líquido', 'Valor (R$)': report.profit },
    { 'Indicador': '', 'Valor (R$)': '' },
    ...Professionals.map(p => ({
      'Indicador': `${p.name} - Receita`,
      'Valor (R$)': report.profData[p.id].income
    })),
    ...Professionals.map(p => ({
      'Indicador': `${p.name} - Lucro`,
      'Valor (R$)': report.profData[p.id].profit
    }))
  ];

  try {
    const wb = XLSX.utils.book_new();
    
    const ws1 = XLSX.utils.json_to_sheet(txData);
    ws1['!cols'] = [
      { wch: 12 }, { wch: 10 }, { wch: 16 }, { wch: 25 }, { wch: 12 }, { wch: 14 }
    ];
    XLSX.utils.book_append_sheet(wb, ws1, 'Transações');

    const ws2 = XLSX.utils.json_to_sheet(summaryData);
    ws2['!cols'] = [{ wch: 25 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws2, 'Resumo');

    const periodLabel = {
      day: 'Dia',
      week: 'Semana',
      month: 'Mês'
    }[reportPeriod];

    XLSX.writeFile(wb, `BarberCash_Relatorio_${periodLabel}_${reportRefDate}.xlsx`);
    showToast('Planilha exportada com sucesso! 📊');
  } catch (err) {
    console.error('Export error:', err);
    showToast('Erro ao exportar. Tente novamente.', 'error');
  }
}

// ===== Backup Handlers =====
function handleExportBackup() {
  const result = exportBackup();
  if (result) {
    showToast('Backup exportado com sucesso! 💾');
  } else {
    showToast('Não há dados para exportar', 'error');
  }
}

function handleImportBackup(input) {
  const file = input.files[0];
  if (!file) return;
  
  importBackup(file).then(result => {
    showToast(`${result.imported} transações importadas! 📂`);
    if (result.skipped > 0) {
      setTimeout(() => showToast(`${result.skipped} já existiam (ignoradas)`, 'info'), 500);
    }
    renderHistory();
    reportGenerated = false;
  }).catch(err => {
    showToast(err, 'error');
  });
  
  input.value = '';
}

// ===== Initialization =====
function init() {
  setupIncomeForm();
  setupExpenseForm();

  // Nav buttons
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // History filter
  document.getElementById('historyFilterType')?.addEventListener('change', renderHistory);

  // Period buttons
  document.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', () => setPeriod(btn.dataset.period));
  });

  // Date for reports
  const reportDateInput = document.getElementById('reportDate');
  if (reportDateInput) {
    reportDateInput.value = getTodayStr();
    reportDateInput.addEventListener('change', (e) => {
      reportRefDate = e.target.value;
      if (reportGenerated) generateReport();
    });
  }

  // Set default active tab
  switchTab('income');
}

document.addEventListener('DOMContentLoaded', init);
