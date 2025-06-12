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
    login(token, user) {
        authToken = token;
        currentUser = user;
        localStorage.setItem('authToken', token);
        localStorage.setItem('currentUser', JSON.stringify(user));
        
        // Esconder modal de login
        document.getElementById('loginModal').style.display = 'none';
        
        // Mostrar aplicação
        document.getElementById('app').style.display = 'block';
        
        // Atualizar info do usuário
        document.getElementById('userInfo').textContent = `${user.username} (${user.role})`;
        
        // Mostrar menu de usuários se for admin
        if (user.role === 'administrador') {
            document.getElementById('usersNav').style.display = 'block';
        }
        
        // Carregar dashboard
        pageManager.showPage('dashboard');
    },

    logout() {
        authToken = null;
        currentUser = {};
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser');
        
        // Mostrar modal de login
        document.getElementById('loginModal').style.display = 'block';
        
        // Esconder aplicação
        document.getElementById('app').style.display = 'none';
        
        // Limpar formulário
        document.getElementById('loginForm').reset();
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
        const targetPage = document.getElementById(pageId + 'Page');
        if (targetPage) {
            targetPage.classList.add('active');
        }

        // Atualizar navegação
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        const activeLink = document.querySelector(`[data-page="${pageId}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }

        this.currentPage = pageId;

        // Carregar dados da página
        this.loadPageData(pageId);
    },

    async loadPageData(pageId) {
        try {
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
        } catch (error) {
            console.error('Erro ao carregar dados da página:', error);
            showError('Erro ao carregar dados: ' + error.message);
        }
    }
};

// Funções de carregamento de dados
async function loadDashboard() {
    try {
        console.log('Loading dashboard...');
        const data = await api.get('/dashboard');
        console.log('Dashboard data received:', data);

        // Atualizar cards de estatísticas
        const totalBranchesEl = document.getElementById('totalBranches');
        const branchesVisitedLastYearEl = document.getElementById('branchesVisitedLastYear');
        const branchesNotVisitedLastYearEl = document.getElementById('branchesNotVisitedLastYear');
        const branchesVisitedLast6MonthsEl = document.getElementById('branchesVisitedLast6Months');

        if (totalBranchesEl) totalBranchesEl.textContent = data.totalBranches || 0;
        if (branchesVisitedLastYearEl) branchesVisitedLastYearEl.textContent = data.branchesVisitedLastYear || 0;
        if (branchesNotVisitedLastYearEl) branchesNotVisitedLastYearEl.textContent = data.branchesNotVisitedLastYear || 0;
        if (branchesVisitedLast6MonthsEl) branchesVisitedLast6MonthsEl.textContent = data.branchesVisitedLast6Months || 0;

        // Carregar gráficos
        await loadCharts(data);

        // Carregar atividades recentes
        await loadUpcomingVisits();
        await loadRecentAudits();

    } catch (error) {
        console.error('Erro ao carregar dashboard:', error);
        showError('Erro ao carregar dados do dashboard: ' + error.message);
    }
}

async function loadCharts(data) {
    try {
        // Gráfico de scores mensais
        const monthlyChart = document.getElementById('monthlyScoresChart');
        if (monthlyChart) {
            createMonthlyScoresChart(data.monthlyScores || []);
        }

        // Gráfico de resumo geral
        const summaryChart = document.getElementById('summaryChart');
        if (summaryChart) {
            createSummaryChart(data.summaryDistribution || {});
        }
    } catch (error) {
        console.error('Erro ao carregar gráficos:', error);
    }
}

function createMonthlyScoresChart(data) {
    const ctx = document.getElementById('monthlyScoresChart');
    if (!ctx) return;

    try {
        const chart = ctx.getContext('2d');
        new Chart(chart, {
            type: 'line',
            data: {
                labels: data.map(item => item.month) || [],
                datasets: [{
                    label: 'Score Médio',
                    data: data.map(item => item.avgScore) || [],
                    borderColor: '#FFD700',
                    backgroundColor: 'rgba(255, 215, 0, 0.1)',
                    tension: 0.4
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
    } catch (error) {
        console.error('Erro ao criar gráfico mensal:', error);
    }
}

function createSummaryChart(data) {
    const ctx = document.getElementById('summaryChart');
    if (!ctx) return;

    try {
        const chart = ctx.getContext('2d');
        new Chart(chart, {
            type: 'doughnut',
            data: {
                labels: ['De Acordo', 'Com Atenção', 'Em Desacordo'],
                datasets: [{
                    data: [
                        data['de acordo'] || 0,
                        data['com pontos de atenção'] || 0,
                        data['em desacordo'] || 0
                    ],
                    backgroundColor: ['#28a745', '#ffc107', '#dc3545']
                }]
            },
            options: {
                responsive: true
            }
        });
    } catch (error) {
        console.error('Erro ao criar gráfico de resumo:', error);
    }
}

async function loadUpcomingVisits() {
    try {
        const visits = await api.get('/schedules/upcoming');
        const container = document.getElementById('upcomingVisits');
        
        if (!container) return;

        if (visits.length === 0) {
            container.innerHTML = '<p class="no-data">Nenhuma visita agendada</p>';
            return;
        }

        let html = '<ul class="activity-list">';
        visits.forEach(visit => {
            html += `
                <li class="activity-item">
                    <div class="activity-info">
                        <strong>${visit.branch_name}</strong>
                        <span class="activity-date">${new Date(visit.scheduled_date).toLocaleDateString('pt-BR')}</span>
                    </div>
                    <span class="activity-type">${visit.audit_type}</span>
                </li>
            `;
        });
        html += '</ul>';
        
        container.innerHTML = html;
    } catch (error) {
        console.error('Erro ao carregar próximas visitas:', error);
        const container = document.getElementById('upcomingVisits');
        if (container) {
            container.innerHTML = '<p class="error">Erro ao carregar dados</p>';
        }
    }
}

async function loadRecentAudits() {
    try {
        const audits = await api.get('/audits/recent');
        const container = document.getElementById('recentAudits');
        
        if (!container) return;

        if (audits.length === 0) {
            container.innerHTML = '<p class="no-data">Nenhuma auditoria recente</p>';
            return;
        }

        let html = '<ul class="activity-list">';
        audits.forEach(audit => {
            html += `
                <li class="activity-item">
                    <div class="activity-info">
                        <strong>${audit.branch_name}</strong>
                        <span class="activity-date">${new Date(audit.visit_date).toLocaleDateString('pt-BR')}</span>
                    </div>
                    <span class="activity-score">${audit.score}%</span>
                </li>
            `;
        });
        html += '</ul>';
        
        container.innerHTML = html;
    } catch (error) {
        console.error('Erro ao carregar auditorias recentes:', error);
        const container = document.getElementById('recentAudits');
        if (container) {
            container.innerHTML = '<p class="error">Erro ao carregar dados</p>';
        }
    }
}

async function loadAudits() {
    try {
        const audits = await api.get('/audits');
        const container = document.getElementById('auditsContainer');
        
        if (!container) return;

        if (audits.length === 0) {
            container.innerHTML = '<p class="no-data">Nenhuma auditoria encontrada</p>';
            return;
        }

        let html = '<table class="data-table"><thead><tr>';
        html += '<th>Filial</th><th>Data</th><th>Score</th><th>Resumo</th><th>Ações</th>';
        html += '</tr></thead><tbody>';

        audits.forEach(audit => {
            html += `
                <tr>
                    <td>${audit.branch_name}</td>
                    <td>${new Date(audit.visit_date).toLocaleDateString('pt-BR')}</td>
                    <td>${audit.score}%</td>
                    <td><span class="status ${audit.general_summary.replace(' ', '-')}">${audit.general_summary}</span></td>
                    <td>
                        <button onclick="viewAudit(${audit.id})" class="btn btn-sm btn-info">Ver</button>
                        <button onclick="editAudit(${audit.id})" class="btn btn-sm btn-warning">Editar</button>
                        <button onclick="deleteAudit(${audit.id})" class="btn btn-sm btn-danger">Excluir</button>
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table>';
        container.innerHTML = html;
    } catch (error) {
        console.error('Erro ao carregar auditorias:', error);
        showError('Erro ao carregar auditorias: ' + error.message);
    }
}

async function loadSchedules() {
    try {
        const schedules = await api.get('/schedules');
        const container = document.getElementById('schedulesContainer');
        
        if (!container) return;

        if (schedules.length === 0) {
            container.innerHTML = '<p class="no-data">Nenhum agendamento encontrado</p>';
            return;
        }

        let html = '<table class="data-table"><thead><tr>';
        html += '<th>Filial</th><th>Data</th><th>Tipo</th><th>Status</th><th>Ações</th>';
        html += '</tr></thead><tbody>';

        schedules.forEach(schedule => {
            const status = new Date(schedule.scheduled_date) > new Date() ? 'Agendado' : 'Vencido';
            html += `
                <tr>
                    <td>${schedule.branch_name}</td>
                    <td>${new Date(schedule.scheduled_date).toLocaleDateString('pt-BR')}</td>
                    <td>${schedule.audit_type}</td>
                    <td><span class="status ${status.toLowerCase()}">${status}</span></td>
                    <td>
                        <button onclick="editSchedule(${schedule.id})" class="btn btn-sm btn-warning">Editar</button>
                        <button onclick="deleteSchedule(${schedule.id})" class="btn btn-sm btn-danger">Excluir</button>
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table>';
        container.innerHTML = html;
    } catch (error) {
        console.error('Erro ao carregar agendamentos:', error);
        showError('Erro ao carregar agendamentos: ' + error.message);
    }
}

async function loadBranches() {
    try {
        const branches = await api.get('/branches');
        const container = document.getElementById('branchesContainer');
        
        if (!container) return;

        if (branches.length === 0) {
            container.innerHTML = '<p class="no-data">Nenhuma filial encontrada</p>';
            return;
        }

        let html = '<table class="data-table"><thead><tr>';
        html += '<th>Código</th><th>Nome</th><th>CNPJ</th><th>Estado</th><th>Cidade</th><th>Ações</th>';
        html += '</tr></thead><tbody>';

        branches.forEach(branch => {
            html += `
                <tr>
                    <td>${branch.code}</td>
                    <td>${branch.name}</td>
                    <td>${branch.cnpj}</td>
                    <td>${branch.state}</td>
                    <td>${branch.city}</td>
                    <td>
                        <button onclick="viewBranch(${branch.id})" class="btn btn-sm btn-info">Ver</button>
                        <button onclick="editBranch(${branch.id})" class="btn btn-sm btn-warning">Editar</button>
                        <button onclick="deleteBranch(${branch.id})" class="btn btn-sm btn-danger">Excluir</button>
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table>';
        container.innerHTML = html;
    } catch (error) {
        console.error('Erro ao carregar filiais:', error);
        showError('Erro ao carregar filiais: ' + error.message);
    }
}

async function loadUsers() {
    try {
        const users = await api.get('/users');
        const container = document.getElementById('usersContainer');
        
        if (!container) return;

        if (users.length === 0) {
            container.innerHTML = '<p class="no-data">Nenhum usuário encontrado</p>';
            return;
        }

        let html = '<table class="data-table"><thead><tr>';
        html += '<th>Usuário</th><th>Função</th><th>Criado em</th><th>Ações</th>';
        html += '</tr></thead><tbody>';

        users.forEach(user => {
            html += `
                <tr>
                    <td>${user.username}</td>
                    <td>${user.role}</td>
                    <td>${new Date(user.created_at).toLocaleDateString('pt-BR')}</td>
                    <td>
                        <button onclick="editUser(${user.id})" class="btn btn-sm btn-warning">Editar</button>
                        <button onclick="deleteUser(${user.id})" class="btn btn-sm btn-danger">Excluir</button>
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table>';
        container.innerHTML = html;
    } catch (error) {
        console.error('Erro ao carregar usuários:', error);
        showError('Erro ao carregar usuários: ' + error.message);
    }
}

// Funções de modal
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'block';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

// Funções de auditoria
async function showNewAuditModal() {
    try {
        const branches = await api.get('/branches');
        const branchSelect = document.getElementById('auditBranch');
        if (branchSelect) {
            branchSelect.innerHTML = '<option value="">Selecione uma filial</option>';
            branches.forEach(branch => {
                branchSelect.innerHTML += `<option value="${branch.id}">${branch.name} (${branch.code})</option>`;
            });
        }
        
        document.getElementById('auditModalTitle').textContent = 'Nova Auditoria';
        document.getElementById('auditForm').reset();
        showModal('auditModal');
    } catch (error) {
        showError('Erro ao carregar filiais');
    }
}

// Funções de agendamento
async function showNewScheduleModal() {
    try {
        const branches = await api.get('/branches');
        const branchSelect = document.getElementById('scheduleBranch');
        if (branchSelect) {
            branchSelect.innerHTML = '<option value="">Selecione uma filial</option>';
            branches.forEach(branch => {
                branchSelect.innerHTML += `<option value="${branch.id}">${branch.name} (${branch.code})</option>`;
            });
        }
        
        document.getElementById('scheduleModalTitle').textContent = 'Novo Agendamento';
        document.getElementById('scheduleForm').reset();
        showModal('scheduleModal');
    } catch (error) {
        showError('Erro ao carregar filiais');
    }
}

// Funções de filiais
async function showNewBranchModal() {
    document.getElementById('branchModalTitle').textContent = 'Nova Filial';
    document.getElementById('branchForm').reset();
    showModal('branchModal');
}

// Funções de usuários
async function showNewUserModal() {
    document.getElementById('userModalTitle').textContent = 'Novo Usuário';
    document.getElementById('userForm').reset();
    showModal('userModal');
}

// Funções de utilidade
function showError(message) {
    // Criar elemento de alerta
    const alert = document.createElement('div');
    alert.className = 'alert alert-danger';
    alert.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
    
    // Inserir no topo da página
    const container = document.querySelector('.main-content') || document.body;
    container.insertBefore(alert, container.firstChild);
    
    // Remover após 5 segundos
    setTimeout(() => {
        if (alert.parentNode) {
            alert.parentNode.removeChild(alert);
        }
    }, 5000);
}

function showSuccess(message) {
    // Criar elemento de sucesso
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

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, setting up event listeners');

    // Verificar se já está autenticado
    if (auth.isAuthenticated()) {
        auth.login(authToken, currentUser);
    } else {
        // Mostrar modal de login
        document.getElementById('loginModal').style.display = 'block';
        document.getElementById('app').style.display = 'none';
    }

    // Login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        console.log('Login form found, adding event listener');
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const formData = new FormData(this);
            const credentials = {
                username: formData.get('username'),
                password: formData.get('password')
            };

            try {
                const response = await api.post('/auth/login', credentials);
                auth.login(response.token, response.user);
                showSuccess('Login realizado com sucesso!');
            } catch (error) {
                showError('Erro no login: ' + error.message);
            }
        });
    } else {
        console.error('Login form not found!');
    }

    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            auth.logout();
        });
    }

    // Navegação
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const page = this.getAttribute('data-page');
            pageManager.showPage(page);
        });
    });

    // Botões de nova auditoria
    const newAuditBtn = document.getElementById('newAuditBtn');
    if (newAuditBtn) {
        newAuditBtn.addEventListener('click', showNewAuditModal);
    }

    // Botões de novo agendamento
    const newScheduleBtn = document.getElementById('newScheduleBtn');
    if (newScheduleBtn) {
        newScheduleBtn.addEventListener('click', showNewScheduleModal);
    }

    // Botões de nova filial
    const newBranchBtn = document.getElementById('newBranchBtn');
    if (newBranchBtn) {
        newBranchBtn.addEventListener('click', showNewBranchModal);
    }

    // Botões de novo usuário
    const newUserBtn = document.getElementById('newUserBtn');
    if (newUserBtn) {
        newUserBtn.addEventListener('click', showNewUserModal);
    }

    // Form de auditoria
    const auditForm = document.getElementById('auditForm');
    if (auditForm) {
        auditForm.addEventListener('submit', async function(e) {
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
                
                if (['cash_balance', 'parts_stock_value', 'tires_stock_value'].includes(key)) {
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
    }

    // Form de agendamento
    const scheduleForm = document.getElementById('scheduleForm');
    if (scheduleForm) {
        scheduleForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = new FormData(this);
            const data = {};
            
            for (let [key, value] of formData.entries()) {
                if (value === '') continue;
                
                if (key === 'branch_id') {
                    value = parseInt(value);
                }
                
                data[key] = value;
            }

            try {
                await api.post('/schedules', data);
                closeModal('scheduleModal');
                showSuccess('Agendamento criado com sucesso!');
                if (pageManager.currentPage === 'schedules') {
                    loadSchedules();
                }
            } catch (error) {
                showError('Erro ao criar agendamento: ' + error.message);
            }
        });
    }

    // Form de filial
    const branchForm = document.getElementById('branchForm');
    if (branchForm) {
        branchForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = new FormData(this);
            const data = {};
            
            for (let [key, value] of formData.entries()) {
                if (value === '') continue;
                data[key] = value;
            }

            try {
                await api.post('/branches', data);
                closeModal('branchModal');
                showSuccess('Filial criada com sucesso!');
                if (pageManager.currentPage === 'branches') {
                    loadBranches();
                }
            } catch (error) {
                showError('Erro ao criar filial: ' + error.message);
            }
        });
    }

    // Form de usuário
    const userForm = document.getElementById('userForm');
    if (userForm) {
        userForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = new FormData(this);
            const data = {};
            
            for (let [key, value] of formData.entries()) {
                if (value === '') continue;
                data[key] = value;
            }

            try {
                await api.post('/users', data);
                closeModal('userModal');
                showSuccess('Usuário criado com sucesso!');
                if (pageManager.currentPage === 'users') {
                    loadUsers();
                }
            } catch (error) {
                showError('Erro ao criar usuário: ' + error.message);
            }
        });
    }

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

// Funções CRUD implementadas
function viewAudit(id) {
    console.log('Ver auditoria:', id);
    // TODO: Implementar visualização de auditoria
}

async function editAudit(id) {
    try {
        const audit = await api.get(`/audits/${id}`);
        // Preencher formulário com dados da auditoria
        Object.keys(audit).forEach(key => {
            const element = document.getElementById(key) || document.querySelector(`[name="${key}"]`);
            if (element) {
                element.value = audit[key];
            }
        });
        
        document.getElementById('auditModalTitle').textContent = 'Editar Auditoria';
        showModal('auditModal');
    } catch (error) {
        showError('Erro ao carregar auditoria: ' + error.message);
    }
}

async function deleteAudit(id) {
    if (confirm('Tem certeza que deseja excluir esta auditoria?')) {
        try {
            await api.delete(`/audits/${id}`);
            showSuccess('Auditoria excluída com sucesso!');
            loadAudits();
        } catch (error) {
            showError('Erro ao excluir auditoria: ' + error.message);
        }
    }
}

function viewBranch(id) {
    console.log('Ver filial:', id);
    // TODO: Implementar visualização de filial
}

async function editBranch(id) {
    try {
        const branch = await api.get(`/branches/${id}`);
        // Preencher formulário com dados da filial
        Object.keys(branch).forEach(key => {
            const element = document.getElementById('branch' + key.charAt(0).toUpperCase() + key.slice(1)) || 
                           document.querySelector(`[name="${key}"]`);
            if (element) {
                element.value = branch[key];
            }
        });
        
        document.getElementById('branchModalTitle').textContent = 'Editar Filial';
        showModal('branchModal');
    } catch (error) {
        showError('Erro ao carregar filial: ' + error.message);
    }
}

async function deleteBranch(id) {
    if (confirm('Tem certeza que deseja excluir esta filial?')) {
        try {
            await api.delete(`/branches/${id}`);
            showSuccess('Filial excluída com sucesso!');
            loadBranches();
        } catch (error) {
            showError('Erro ao excluir filial: ' + error.message);
        }
    }
}

async function editSchedule(id) {
    try {
        const schedule = await api.get(`/schedules/${id}`);
        // Preencher formulário com dados do agendamento
        Object.keys(schedule).forEach(key => {
            const element = document.getElementById(key) || document.querySelector(`[name="${key}"]`);
            if (element) {
                if (key === 'scheduled_date') {
                    element.value = schedule[key].split('T')[0]; // Formato YYYY-MM-DD
                } else {
                    element.value = schedule[key];
                }
            }
        });
        
        document.getElementById('scheduleModalTitle').textContent = 'Editar Agendamento';
        showModal('scheduleModal');
    } catch (error) {
        showError('Erro ao carregar agendamento: ' + error.message);
    }
}

async function deleteSchedule(id) {
    if (confirm('Tem certeza que deseja excluir este agendamento?')) {
        try {
            await api.delete(`/schedules/${id}`);
            showSuccess('Agendamento excluído com sucesso!');
            loadSchedules();
        } catch (error) {
            showError('Erro ao excluir agendamento: ' + error.message);
        }
    }
}

async function editUser(id) {
    try {
        const user = await api.get(`/users/${id}`);
        // Preencher formulário com dados do usuário (exceto senha)
        document.getElementById('userName').value = user.username;
        document.getElementById('userRole').value = user.role;
        document.getElementById('userPassword').value = ''; // Não mostrar senha atual
        
        document.getElementById('userModalTitle').textContent = 'Editar Usuário';
        showModal('userModal');
    } catch (error) {
        showError('Erro ao carregar usuário: ' + error.message);
    }
}

async function deleteUser(id) {
    if (confirm('Tem certeza que deseja excluir este usuário?')) {
        try {
            await api.delete(`/users/${id}`);
            showSuccess('Usuário excluído com sucesso!');
            loadUsers();
        } catch (error) {
            showError('Erro ao excluir usuário: ' + error.message);
        }
    }
}

// Funções de relatórios
async function generateReport(type) {
    try {
        const reportResults = document.getElementById('reportResults');
        if (!reportResults) return;

        reportResults.innerHTML = '<div class="loading">Gerando relatório...</div>';

        let data;
        let html = '';

        switch (type) {
            case 'last-visit':
                data = await api.get('/reports/last-visit');
                html = '<h4>Última Visita por Filial</h4>';
                if (data.length === 0) {
                    html += '<p class="no-data">Nenhum dado encontrado</p>';
                } else {
                    html += '<table class="data-table"><thead><tr><th>Filial</th><th>Última Visita</th><th>Score</th><th>Status</th></tr></thead><tbody>';
                    data.forEach(item => {
                        const lastVisit = item.last_visit ? new Date(item.last_visit).toLocaleDateString('pt-BR') : 'Nunca';
                        html += `
                            <tr>
                                <td>${item.branch_name}</td>
                                <td>${lastVisit}</td>
                                <td>${item.last_score || '-'}%</td>
                                <td><span class="status ${item.status}">${item.status_text}</span></td>
                            </tr>
                        `;
                    });
                    html += '</tbody></table>';
                }
                break;

            case 'to-audit':
                data = await api.get('/reports/to-audit');
                html = '<h4>Filiais para Auditar</h4>';
                if (data.length === 0) {
                    html += '<p class="no-data">Todas as filiais estão em dia</p>';
                } else {
                    html += '<table class="data-table"><thead><tr><th>Filial</th><th>Última Visita</th><th>Dias sem Visita</th><th>Prioridade</th></tr></thead><tbody>';
                    data.forEach(item => {
                        const lastVisit = item.last_visit ? new Date(item.last_visit).toLocaleDateString('pt-BR') : 'Nunca';
                        const priority = item.days_without_visit > 365 ? 'Alta' : item.days_without_visit > 180 ? 'Média' : 'Baixa';
                        html += `
                            <tr>
                                <td>${item.branch_name}</td>
                                <td>${lastVisit}</td>
                                <td>${item.days_without_visit || 'N/A'}</td>
                                <td><span class="status ${priority.toLowerCase()}">${priority}</span></td>
                            </tr>
                        `;
                    });
                    html += '</tbody></table>';
                }
                break;

            case 'by-period':
                // Implementar filtro de período
                const startDate = prompt('Data inicial (YYYY-MM-DD):');
                const endDate = prompt('Data final (YYYY-MM-DD):');
                
                if (!startDate || !endDate) {
                    reportResults.innerHTML = '<p class="error">Período não informado</p>';
                    return;
                }

                data = await api.get(`/reports/by-period?start=${startDate}&end=${endDate}`);
                html = `<h4>Auditorias de ${new Date(startDate).toLocaleDateString('pt-BR')} a ${new Date(endDate).toLocaleDateString('pt-BR')}</h4>`;
                if (data.length === 0) {
                    html += '<p class="no-data">Nenhuma auditoria encontrada no período</p>';
                } else {
                    html += '<table class="data-table"><thead><tr><th>Filial</th><th>Data</th><th>Score</th><th>Resumo</th><th>Auditor</th></tr></thead><tbody>';
                    data.forEach(item => {
                        html += `
                            <tr>
                                <td>${item.branch_name}</td>
                                <td>${new Date(item.visit_date).toLocaleDateString('pt-BR')}</td>
                                <td>${item.score}%</td>
                                <td><span class="status ${item.general_summary.replace(' ', '-')}">${item.general_summary}</span></td>
                                <td>${item.auditor_name}</td>
                            </tr>
                        `;
                    });
                    html += '</tbody></table>';
                }
                break;

            case 'auditor-performance':
                data = await api.get('/reports/auditor-performance');
                html = '<h4>Performance dos Auditores</h4>';
                if (data.length === 0) {
                    html += '<p class="no-data">Nenhum dado encontrado</p>';
                } else {
                    html += '<table class="data-table"><thead><tr><th>Auditor</th><th>Total de Auditorias</th><th>Score Médio</th><th>Última Auditoria</th></tr></thead><tbody>';
                    data.forEach(item => {
                        const lastAudit = item.last_audit ? new Date(item.last_audit).toLocaleDateString('pt-BR') : 'Nunca';
                        html += `
                            <tr>
                                <td>${item.auditor_name}</td>
                                <td>${item.total_audits}</td>
                                <td>${item.avg_score ? Math.round(item.avg_score) : 0}%</td>
                                <td>${lastAudit}</td>
                            </tr>
                        `;
                    });
                    html += '</tbody></table>';
                }
                break;

            default:
                html = '<p class="error">Tipo de relatório não implementado</p>';
        }

        reportResults.innerHTML = html;
        showSuccess('Relatório gerado com sucesso!');

    } catch (error) {
        console.error('Erro ao gerar relatório:', error);
        const reportResults = document.getElementById('reportResults');
        if (reportResults) {
            reportResults.innerHTML = '<p class="error">Erro ao gerar relatório: ' + error.message + '</p>';
        }
        showError('Erro ao gerar relatório: ' + error.message);
    }
}

