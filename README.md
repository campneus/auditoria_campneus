# Sistema de Auditoria de Filiais

Sistema web completo para gerenciar auditorias, agendamentos e históricos de filiais empresariais.

## Características

- **Dashboard Intuitivo**: Visualização de dados importantes com gráficos e estatísticas
- **Gestão de Auditorias**: Registro completo de visitas com formulário detalhado
- **Agendamento de Visitas**: Sistema de calendário para programar auditorias
- **Relatórios Avançados**: Múltiplos tipos de relatórios para análise
- **Controle de Usuários**: Sistema de autenticação com diferentes níveis de acesso
- **Interface Responsiva**: Funciona perfeitamente em desktop e mobile

## Tecnologias

- **Backend**: Node.js, Express.js
- **Banco de Dados**: PostgreSQL
- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Gráficos**: Chart.js
- **Autenticação**: JWT
- **Deploy**: Render

## Instalação

1. Clone o repositório
2. Instale as dependências:
   ```bash
   npm install
   ```

3. Configure as variáveis de ambiente no arquivo `.env`:
   ```
   PGHOST=seu_host_postgresql
   PGDATABASE=auditoria_db
   PGUSER=seu_usuario
   PGPASSWORD=sua_senha
   PGPORT=5432
   PORT=3000
   NODE_ENV=production
   JWT_SECRET=sua_chave_secreta
   ```

4. Execute o script SQL para criar as tabelas:
   ```sql
   -- Execute o conteúdo do arquivo auditoria_db_schema.sql
   ```

5. Inicie o servidor:
   ```bash
   npm start
   ```

## Deploy no Render

1. Conecte seu repositório ao Render
2. Configure as variáveis de ambiente no painel do Render
3. O deploy será automático

## Usuários Padrão

- **Administrador**: 
  - Usuário: `admin`
  - Senha: `senha_hash_admin`

- **Auditor**: 
  - Usuário: `auditor1`
  - Senha: `senha_hash_auditor1`

## Funcionalidades

### Dashboard
- Total de filiais
- Filiais visitadas nos últimos 12 meses
- Alertas de filiais sem visita
- Gráficos de performance
- Próximas visitas agendadas
- Últimas auditorias realizadas

### Auditorias
- Formulário completo de auditoria
- Campos para todos os aspectos da visita
- Sistema de pontuação (0-100%)
- Categorização por resumo geral
- Histórico completo de visitas

### Agendamentos
- Calendário de visitas
- Tipos de auditoria (completa, parcial, somente estoque)
- Visualização por período

### Relatórios
- Última visita por filial
- Filiais para auditar
- Auditorias por período
- Performance dos auditores
- Análise por estado

### Gestão de Usuários (Administradores)
- Criar/editar/excluir usuários
- Controle de permissões
- Dois níveis: Administrador e Auditor

## Estrutura do Projeto

```
sistema-auditoria/
├── config/
│   └── database.js          # Configuração do PostgreSQL
├── controllers/             # Controladores (futuro)
├── middleware/
│   └── auth.js             # Middleware de autenticação
├── models/                 # Modelos (futuro)
├── routes/
│   ├── auth.js            # Rotas de autenticação
│   ├── users.js           # Rotas de usuários
│   ├── branches.js        # Rotas de filiais
│   ├── audits.js          # Rotas de auditorias
│   ├── schedules.js       # Rotas de agendamentos
│   ├── dashboard.js       # Rotas do dashboard
│   └── reports.js         # Rotas de relatórios
├── public/
│   ├── index.html         # Interface principal
│   ├── styles.css         # Estilos CSS
│   └── app.js            # JavaScript frontend
├── views/                 # Views (futuro)
├── .env                   # Variáveis de ambiente
├── package.json           # Dependências
└── server.js             # Servidor principal
```

## API Endpoints

### Autenticação
- `POST /api/auth/login` - Login de usuário

### Usuários
- `GET /api/users` - Listar usuários (admin)
- `POST /api/users` - Criar usuário (admin)
- `PUT /api/users/:id` - Atualizar usuário (admin)
- `DELETE /api/users/:id` - Deletar usuário (admin)

### Filiais
- `GET /api/branches` - Listar filiais
- `GET /api/branches/:id` - Obter filial
- `POST /api/branches` - Criar filial (admin)
- `PUT /api/branches/:id` - Atualizar filial (admin)
- `DELETE /api/branches/:id` - Deletar filial (admin)

### Auditorias
- `GET /api/audits` - Listar auditorias
- `GET /api/audits/:id` - Obter auditoria
- `POST /api/audits` - Criar auditoria
- `PUT /api/audits/:id` - Atualizar auditoria
- `DELETE /api/audits/:id` - Deletar auditoria (admin)

### Agendamentos
- `GET /api/schedules` - Listar agendamentos
- `GET /api/schedules/:id` - Obter agendamento
- `POST /api/schedules` - Criar agendamento
- `PUT /api/schedules/:id` - Atualizar agendamento
- `DELETE /api/schedules/:id` - Deletar agendamento

### Dashboard
- `GET /api/dashboard` - Dados do dashboard
- `GET /api/dashboard/charts/monthly-scores` - Scores mensais
- `GET /api/dashboard/charts/summary-distribution` - Distribuição de resumos

### Relatórios
- `GET /api/reports/last-visit-by-branch` - Última visita por filial
- `GET /api/reports/branches-to-audit` - Filiais para auditar
- `GET /api/reports/audits-by-period` - Auditorias por período
- `GET /api/reports/auditor-performance` - Performance dos auditores
- `GET /api/reports/scores-by-state` - Scores por estado

## Segurança

- Autenticação JWT
- Rate limiting
- Helmet para headers de segurança
- Validação de entrada
- Controle de acesso baseado em roles

## Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature
3. Commit suas mudanças
4. Push para a branch
5. Abra um Pull Request

## Licença

MIT License

