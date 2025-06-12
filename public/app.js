// Configuração da API
const API_BASE_URL = '/api';
let authToken = localStorage.getItem('authToken');
let currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');

// Utilitários
const api = {
    async request(endpoint, options = {}) {
        const url = `${API_BASE_URL}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...(authToken && { 'Authorization': `Bearer ${authToken}` })
            },
            ...options
        };

        if (config.body && typeof config.body === 'object') {
            config.body = JSON.stringify(config.body);
        }

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Erro na requisição');
            }

            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },

    get(endpoint) {
        return this.request(endpoint);
    },

    post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: data
        });
    },

    put(endpoint, data) {
        return this.request(endpoint, {
            method: 'PUT',
            body: data
        });
    },

    delete(endpoint) {
        return this.request(endpoint, {
            method: 'DELETE'
        });
    }
};

// Gerenciamento de autenticação
const auth = {
    async login(username, password) {
        try {
            const response = await api.post('/auth/login', { username, password });
            authToken = response.token;
            currentUser = response.user;
            
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            
            return response;
        } catch (error) {
            throw error;
        }
    },

    logout() {
        authToken = null;
        currentUser = {};
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser');
        showLogin();
    },

    isAuthenticated() {
        return !!authToken;
    },

    isAdmin() {
        return currentUser.role === 'administrador';
    }
};

// Gerenciamento de páginas
const pageManager = {
    currentPage: 'dashboard',

    showPage(pageId) {
        // Esconder todas as páginas
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });

        // Mostrar página selecionada
        document.getElementById(pageId + 'Page').classList.add('active');

        // Atualizar navegação
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        document.querySelector(`[data-page="${pageId}"]`).classList.add('active');

        this.currentPage = pageId;

        // Carregar dados da página
        this.loadPageData(pageId);
    },

    async loadPageData(pageId) {
        switch (pageId) {
            case 'dashboard':
                await loadDashboard();
                break;
            case 'audits':
                await loadAudits();
                break;
            case 'schedules':
                await loadSchedules();
                break;
            case 'branches':
                await loadBranches();
                break;
            case 'reports':
                // Relatórios são carregados sob demanda
                break;
            case 'users':
                if (auth.isAdmin()) {
                    await loadUsers();
                }
                break;
        }
    }
};

// Funções de carregamento de dados
async function loadDashboard() {
    try {
        showLoading('dashboardPage');
        const data = await api.get('/dashboard');
        
        // Atualizar cards de estatísticas
        document.getElementById('totalBranches').textContent = data.totalBranches;
        document.getElementById('branchesVisitedLastYear').textContent = data.branchesVisitedLastYear;
        document.getElementById('branchesNotVisitedLastYear').textContent = data.branchesNotVisitedLastYear;
        document.getElementById('avgScore').textContent = data.scoreStats.avgScore + '%';

        // Carregar gráficos
        await loadCharts();

        // Carregar atividades recentes
        loadUpcomingVisits(data.upcomingVisits);
        loadRecentAudits(data.recentAudits);

        hideLoading('dashboardPage');
    } catch (error) {
        console.error('Erro ao carregar dashboard:', error);
        showError('Erro ao carregar dados do dashboard');
        hideLoading('dashboardPage');
    }
}

async function loadCharts() {
    try {
        // Gráfico de scores mensais
        const monthlyData = await api.get('/dashboard/charts/monthly-scores');
        createMonthlyScoresChart(monthlyData);

        // Gráfico de distribuição de resumos
        const summaryData = await api.get('/dashboard/charts/summary-distribution');
        createSummaryChart(summaryData);
    } catch (error) {
        console.error('Erro ao carregar gráficos:', error);
    }
}

function createMonthlyScoresChart(data) {
    const ctx = document.getElementById('monthlyScoresChart').getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(item => new Date(item.month).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })),
            datasets: [{
                label: 'Score Médio',
                data: data.map(item => item.avgScore),
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100
                }
            }
        }
    });
}

function createSummaryChart(data) {
    const ctx = document.getElementById('summaryChart').getContext('2d');
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: data.map(item => item.summary),
            datasets: [{
                data: data.map(item => item.total),
                backgroundColor: [
                    '#28a745',
                    '#ffc107',
                    '#dc3545'
                ]
            }]
        },
        options: {
            responsive: true
        }
    });
}

function loadUpcomingVisits(visits) {
    const container = document.getElementById('upcomingVisits');
    container.innerHTML = '';

    if (visits.length === 0) {
        container.innerHTML = '<p class="text-center">Nenhuma visita agendada</p>';
        return;
    }

    visits.forEach(visit => {
        const item = document.createElement('div');
        item.className = 'activity-item';
        item.innerHTML = `
            <div class="activity-info">
                <h4>${visit.branch_name} (${visit.branch_code})</h4>
                <p>${new Date(visit.scheduled_date).toLocaleDateString('pt-BR')} - ${visit.audit_type}</p>
            </div>
        `;
        container.appendChild(item);
    });
}

function loadRecentAudits(audits) {
    const container = document.getElementById('recentAudits');
    container.innerHTML = '';

    if (audits.length === 0) {
        container.innerHTML = '<p class="text-center">Nenhuma auditoria recente</p>';
        return;
    }

    audits.forEach(audit => {
        const item = document.createElement('div');
        item.className = 'activity-item';
        
        let badgeClass = 'badge-success';
        if (audit.general_summary === 'com pontos de atenção') badgeClass = 'badge-warning';
        if (audit.general_summary === 'em desacordo') badgeClass = 'badge-danger';

        item.innerHTML = `
            <div class="activity-info">
                <h4>${audit.branch_name} (${audit.branch_code})</h4>
                <p>${new Date(audit.visit_date).toLocaleDateString('pt-BR')} - ${audit.auditor_name}</p>
            </div>
            <div class="activity-badge ${badgeClass}">
                ${audit.score}%
            </div>
        `;
        container.appendChild(item);
    });
}

async function loadAudits() {
    try {
        showLoading('auditsTable');
        const audits = await api.get('/audits');
        const branches = await api.get('/branches');
        
        // Preencher filtro de filiais
        const branchFilter = document.getElementById('auditBranchFilter');
        branchFilter.innerHTML = '<option value="">Todas as Filiais</option>';
        branches.forEach(branch => {
            branchFilter.innerHTML += `<option value="${branch.id}">${branch.name}</option>`;
        });

        displayAuditsTable(audits);
        hideLoading('auditsTable');
    } catch (error) {
        console.error('Erro ao carregar auditorias:', error);
        showError('Erro ao carregar auditorias');
        hideLoading('auditsTable');
    }
}

function displayAuditsTable(audits) {
    const container = document.getElementById('auditsTable');
    
    if (audits.length === 0) {
        container.innerHTML = '<p class="text-center">Nenhuma auditoria encontrada</p>';
        return;
    }

    let html = `
        <table class="table">
            <thead>
                <tr>
                    <th>Filial</th>
                    <th>Data da Visita</th>
                    <th>Auditor</th>
                    <th>Score</th>
                    <th>Resumo</th>
                    <th>Ações</th>
                </tr>
            </thead>
            <tbody>
    `;

    audits.forEach(audit => {
        let summaryClass = 'text-success';
        if (audit.general_summary === 'com pontos de atenção') summaryClass = 'text-warning';
        if (audit.general_summary === 'em desacordo') summaryClass = 'text-danger';

        html += `
            <tr>
                <td>${audit.branch_name} (${audit.branch_code})</td>
                <td>${new Date(audit.visit_date).toLocaleDateString('pt-BR')}</td>
                <td>${audit.auditor_name}</td>
                <td>${audit.score}%</td>
                <td class="${summaryClass}">${audit.general_summary}</td>
                <td>
                    <button class="btn btn-secondary" onclick="viewAudit(${audit.id})">
                        <i class="fas fa-eye"></i>
                    </button>
                    ${(auth.isAdmin() || audit.auditor_id === currentUser.id) ? 
                        `<button class="btn btn-primary" onclick="editAudit(${audit.id})">
                            <i class="fas fa-edit"></i>
                        </button>` : ''
                    }
                    ${auth.isAdmin() ? 
                        `<button class="btn btn-danger" onclick="deleteAudit(${audit.id})">
                            <i class="fas fa-trash"></i>
                        </button>` : ''
                    }
                </td>
            </tr>
        `;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

async function loadBranches() {
    try {
        showLoading('branchesTable');
        const branches = await api.get('/branches');
        displayBranchesTable(branches);
        hideLoading('branchesTable');
    } catch (error) {
        console.error('Erro ao carregar filiais:', error);
        showError('Erro ao carregar filiais');
        hideLoading('branchesTable');
    }
}

function displayBranchesTable(branches) {
    const container = document.getElementById('branchesTable');
    
    if (branches.length === 0) {
        container.innerHTML = '<p class="text-center">Nenhuma filial encontrada</p>';
        return;
    }

    let html = `
        <table class="table">
            <thead>
                <tr>
                    <th>Código</th>
                    <th>Nome</th>
                    <th>CNPJ</th>
                    <th>Estado</th>
                    <th>Cidade</th>
                    <th>Ações</th>
                </tr>
            </thead>
            <tbody>
    `;

    branches.forEach(branch => {
        html += `
            <tr>
                <td>${branch.code}</td>
                <td>${branch.name}</td>
                <td>${branch.cnpj}</td>
                <td>${branch.state}</td>
                <td>${branch.city}</td>
                <td>
                    <button class="btn btn-secondary" onclick="viewBranch(${branch.id})">
                        <i class="fas fa-eye"></i>
                    </button>
                    ${auth.isAdmin() ? 
                        `<button class="btn btn-primary" onclick="editBranch(${branch.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-danger" onclick="deleteBranch(${branch.id})">
                            <i class="fas fa-trash"></i>
                        </button>` : ''
                    }
                </td>
            </tr>
        `;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

async function loadSchedules() {
    try {
        showLoading('schedulesTable');
        const schedules = await api.get('/schedules');
        displaySchedulesTable(schedules);
        hideLoading('schedulesTable');
    } catch (error) {
        console.error('Erro ao carregar agendamentos:', error);
        showError('Erro ao carregar agendamentos');
        hideLoading('schedulesTable');
    }
}

function displaySchedulesTable(schedules) {
    const container = document.getElementById('schedulesTable');
    
    if (schedules.length === 0) {
        container.innerHTML = '<p class="text-center">Nenhum agendamento encontrado</p>';
        return;
    }

    let html = `
        <table class="table">
            <thead>
                <tr>
                    <th>Filial</th>
                    <th>Data Agendada</th>
                    <th>Tipo de Auditoria</th>
                    <th>Ações</th>
                </tr>
            </thead>
            <tbody>
    `;

    schedules.forEach(schedule => {
        html += `
            <tr>
                <td>${schedule.branch_name} (${schedule.branch_code})</td>
                <td>${new Date(schedule.scheduled_date).toLocaleDateString('pt-BR')}</td>
                <td>${schedule.audit_type}</td>
                <td>
                    <button class="btn btn-primary" onclick="editSchedule(${schedule.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-danger" onclick="deleteSchedule(${schedule.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

async function loadUsers() {
    if (!auth.isAdmin()) return;

    try {
        showLoading('usersTable');
        const users = await api.get('/users');
        displayUsersTable(users);
        hideLoading('usersTable');
    } catch (error) {
        console.error('Erro ao carregar usuários:', error);
        showError('Erro ao carregar usuários');
        hideLoading('usersTable');
    }
}

function displayUsersTable(users) {
    const container = document.getElementById('usersTable');
    
    if (users.length === 0) {
        container.innerHTML = '<p class="text-center">Nenhum usuário encontrado</p>';
        return;
    }

    let html = `
        <table class="table">
            <thead>
                <tr>
                    <th>Usuário</th>
                    <th>Papel</th>
                    <th>Criado em</th>
                    <th>Ações</th>
                </tr>
            </thead>
            <tbody>
    `;

    users.forEach(user => {
        html += `
            <tr>
                <td>${user.username}</td>
                <td>${user.role}</td>
                <td>${new Date(user.created_at).toLocaleDateString('pt-BR')}</td>
                <td>
                    <button class="btn btn-primary" onclick="editUser(${user.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-danger" onclick="deleteUser(${user.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

// Funções de modal
function showModal(modalId) {
    document.getElementById(modalId).style.display = 'block';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Funções de auditoria
async function showNewAuditModal() {
    try {
        const branches = await api.get('/branches');
        const branchSelect = document.getElementById('auditBranch');
        branchSelect.innerHTML = '<option value="">Selecione uma filial</option>';
        branches.forEach(branch => {
            branchSelect.innerHTML += `<option value="${branch.id}">${branch.name} (${branch.code})</option>`;
        });
        
        document.getElementById('auditModalTitle').textContent = 'Nova Auditoria';
        document.getElementById('auditForm').reset();
        showModal('auditModal');
    } catch (error) {
        showError('Erro ao carregar filiais');
    }
}

// Funções de utilidade
function showLoading(containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
}

function hideLoading(containerId) {
    // A função de carregamento específica irá substituir o conteúdo
}

function showError(message) {
    // Criar elemento de alerta
    const alert = document.createElement('div');
    alert.className = 'alert alert-danger';
    alert.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
    
    // Inserir no topo da página
    const container = document.querySelector('#loginModal .modal-content') || document.querySelector('.main-content');
    container.insertBefore(alert, container.firstChild);
    
    // Remover após 5 segundos
    setTimeout(() => {
        if (alert.parentNode) {
            alert.parentNode.removeChild(alert);
        }
    }, 5000);
}

function showSuccess(message) {
    // Criar elemento de alerta
    const alert = document.createElement('div');
    alert.className = 'alert alert-success';
    alert.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;
    
    // Inserir no topo da página
    const container = document.querySelector('.main-content') || document.body;
    container.insertBefore(alert, container.firstChild);
    
    // Remover após 3 segundos
    setTimeout(() => {
        if (alert.parentNode) {
            alert.parentNode.removeChild(alert);
        }
    }, 3000);
}

function showLogin() {
    document.getElementById('app').style.display = 'none';
    document.getElementById('loginModal').style.display = 'block';
}

function hideLogin() {
    document.getElementById('loginModal').style.display = 'none';
    document.getElementById('app').style.display = 'grid';
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, setting up event listeners');
    
    // Verificar autenticação
    if (!auth.isAuthenticated()) {
        showLogin();
    } else {
        // Mostrar informações do usuário
        document.getElementById('userInfo').textContent = `${currentUser.username} (${currentUser.role})`;
        
        // Mostrar/esconder menu de usuários para administradores
        if (auth.isAdmin()) {
            document.getElementById('usersNav').style.display = 'block';
            document.getElementById('newBranchBtn').style.display = 'inline-flex';
        }

        // Carregar página inicial
        pageManager.showPage('dashboard');
    }

    // Login form - CORRIGIDO para interceptar o submit
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        console.log('Login form found, adding event listener');
        loginForm.addEventListener('submit', async function(e) {
            console.log('Form submit event triggered');
            e.preventDefault(); // Impede o envio padrão do formulário
            e.stopPropagation(); // Para a propagação do evento
            
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;

            console.log('Login attempt:', { username, password: '***' });

            if (!username || !password) {
                showError('Por favor, preencha todos os campos');
                return;
            }

            try {
                console.log('Calling auth.login...');
                const response = await auth.login(username, password);
                console.log('Login successful:', response);
                
                hideLogin();
                
                // Mostrar informações do usuário
                document.getElementById('userInfo').textContent = `${currentUser.username} (${currentUser.role})`;
                
                // Mostrar/esconder menu de usuários para administradores
                if (auth.isAdmin()) {
                    document.getElementById('usersNav').style.display = 'block';
                    document.getElementById('newBranchBtn').style.display = 'inline-flex';
                }

                // Carregar página inicial
                pageManager.showPage('dashboard');
                showSuccess('Login realizado com sucesso!');
            } catch (error) {
                console.error('Erro no login:', error);
                showError('Credenciais inválidas. Verifique seu usuário e senha.');
            }
        });
    } else {
        console.error('Login form not found!');
    }

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', function() {
        auth.logout();
    });

    // Navegação
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const page = this.getAttribute('data-page');
            pageManager.showPage(page);
        });
    });

    // Botões de nova auditoria
    document.getElementById('newAuditBtn').addEventListener('click', showNewAuditModal);

    // Form de auditoria
    document.getElementById('auditForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const formData = new FormData(this);
        const data = {};
        
        for (let [key, value] of formData.entries()) {
            if (value === '') continue;
            
            // Converter valores booleanos
            if (value === 'true') value = true;
            if (value === 'false') value = false;
            
            // Converter números
            if (['branch_id', 'nps_score', 'checkups_done', 'tire_quantity', 'imported_tire_quantity', 
                 'pirelli_tire_quantity', 'parts_quantity', 'score'].includes(key)) {
                value = parseInt(value);
            }
            
            if (['cash_balance', 'parts_stock_value', 'tire_stock_value'].includes(key)) {
                value = parseFloat(value);
            }
            
            data[key] = value;
        }

        try {
            await api.post('/audits', data);
            closeModal('auditModal');
            showSuccess('Auditoria criada com sucesso!');
            if (pageManager.currentPage === 'audits') {
                loadAudits();
            }
        } catch (error) {
            showError('Erro ao criar auditoria: ' + error.message);
        }
    });

    // Fechar modais clicando no X
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', function() {
            this.closest('.modal').style.display = 'none';
        });
    });

    // Fechar modais clicando fora
    window.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    });
});

// Funções placeholder para ações futuras
function viewAudit(id) {
    console.log('Ver auditoria:', id);
}

function editAudit(id) {
    console.log('Editar auditoria:', id);
}

function deleteAudit(id) {
    if (confirm('Tem certeza que deseja excluir esta auditoria?')) {
        console.log('Excluir auditoria:', id);
    }
}

function viewBranch(id) {
    console.log('Ver filial:', id);
}

function editBranch(id) {
    console.log('Editar filial:', id);
}

function deleteBranch(id) {
    if (confirm('Tem certeza que deseja excluir esta filial?')) {
        console.log('Excluir filial:', id);
    }
}

function editSchedule(id) {
    console.log('Editar agendamento:', id);
}

function deleteSchedule(id) {
    if (confirm('Tem certeza que deseja excluir este agendamento?')) {
        console.log('Excluir agendamento:', id);
    }
}

function editUser(id) {
    console.log('Editar usuário:', id);
}

function deleteUser(id) {
    if (confirm('Tem certeza que deseja excluir este usuário?')) {
        console.log('Excluir usuário:', id);
    }
}

