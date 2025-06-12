const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Dashboard principal
router.get('/', authenticateToken, async (req, res) => {
  try {
    const dashboardData = {};

    // Total de filiais
    const totalBranches = await db.query('SELECT COUNT(*) as total FROM branches');
    dashboardData.totalBranches = parseInt(totalBranches.rows[0].total);

    // Filiais visitadas nos últimos 12 meses
    const branchesVisitedLastYear = await db.query(`
      SELECT COUNT(DISTINCT branch_id) as total 
      FROM audits 
      WHERE visit_date >= CURRENT_DATE - INTERVAL '12 months'
    `);
    dashboardData.branchesVisitedLastYear = parseInt(branchesVisitedLastYear.rows[0].total);

    // Filiais sem visita nos últimos 12 meses
    const branchesNotVisitedLastYear = await db.query(`
      SELECT COUNT(*) as total 
      FROM branches b 
      WHERE NOT EXISTS (
        SELECT 1 FROM audits a 
        WHERE a.branch_id = b.id 
        AND a.visit_date >= CURRENT_DATE - INTERVAL '12 months'
      )
    `);
    dashboardData.branchesNotVisitedLastYear = parseInt(branchesNotVisitedLastYear.rows[0].total);

    // Filiais visitadas nos últimos 6 meses
    const branchesVisitedLast6Months = await db.query(`
      SELECT COUNT(DISTINCT branch_id) as total 
      FROM audits 
      WHERE visit_date >= CURRENT_DATE - INTERVAL '6 months'
    `);
    dashboardData.branchesVisitedLast6Months = parseInt(branchesVisitedLast6Months.rows[0].total);

    // Resumo geral das auditorias
    const generalSummary = await db.query(`
      SELECT 
        general_summary,
        COUNT(*) as total
      FROM audits 
      WHERE visit_date >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY general_summary
    `);
    dashboardData.generalSummary = generalSummary.rows.reduce((acc, row) => {
      acc[row.general_summary] = parseInt(row.total);
      return acc;
    }, {});

    // Análise por mês (últimos 12 meses)
    const monthlyAnalysis = await db.query(`
      SELECT 
        DATE_TRUNC('month', visit_date) as month,
        COUNT(*) as total_audits,
        AVG(score) as avg_score
      FROM audits 
      WHERE visit_date >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', visit_date)
      ORDER BY month
    `);
    dashboardData.monthlyAnalysis = monthlyAnalysis.rows.map(row => ({
      month: row.month,
      totalAudits: parseInt(row.total_audits),
      avgScore: parseFloat(row.avg_score || 0).toFixed(2)
    }));

    // Análise por estado
    const stateAnalysis = await db.query(`
      SELECT 
        b.state,
        COUNT(DISTINCT b.id) as total_branches,
        COUNT(a.id) as total_audits,
        AVG(a.score) as avg_score
      FROM branches b
      LEFT JOIN audits a ON b.id = a.branch_id 
        AND a.visit_date >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY b.state
      ORDER BY b.state
    `);
    dashboardData.stateAnalysis = stateAnalysis.rows.map(row => ({
      state: row.state,
      totalBranches: parseInt(row.total_branches),
      totalAudits: parseInt(row.total_audits || 0),
      avgScore: parseFloat(row.avg_score || 0).toFixed(2)
    }));

    // Próximas visitas (próximos 30 dias)
    const upcomingVisits = await db.query(`
      SELECT s.*, b.name as branch_name, b.code as branch_code
      FROM schedules s
      JOIN branches b ON s.branch_id = b.id
      WHERE s.scheduled_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
      ORDER BY s.scheduled_date
      LIMIT 10
    `);
    dashboardData.upcomingVisits = upcomingVisits.rows;

    // Últimas visitas realizadas
    const recentAudits = await db.query(`
      SELECT 
        a.id, a.visit_date, a.score, a.general_summary,
        b.name as branch_name, b.code as branch_code,
        u.username as auditor_name
      FROM audits a
      JOIN branches b ON a.branch_id = b.id
      JOIN users u ON a.auditor_id = u.id
      ORDER BY a.visit_date DESC
      LIMIT 10
    `);
    dashboardData.recentAudits = recentAudits.rows;

    // Estatísticas de scores
    const scoreStats = await db.query(`
      SELECT 
        AVG(score) as avg_score,
        MIN(score) as min_score,
        MAX(score) as max_score,
        COUNT(*) as total_audits
      FROM audits 
      WHERE visit_date >= CURRENT_DATE - INTERVAL '12 months'
    `);
    dashboardData.scoreStats = {
      avgScore: parseFloat(scoreStats.rows[0].avg_score || 0).toFixed(2),
      minScore: parseInt(scoreStats.rows[0].min_score || 0),
      maxScore: parseInt(scoreStats.rows[0].max_score || 0),
      totalAudits: parseInt(scoreStats.rows[0].total_audits || 0)
    };

    res.json(dashboardData);
  } catch (error) {
    console.error('Erro ao obter dados do dashboard:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Dados para gráficos específicos
router.get('/charts/monthly-scores', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        DATE_TRUNC('month', visit_date) as month,
        AVG(score) as avg_score,
        COUNT(*) as total_audits
      FROM audits 
      WHERE visit_date >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', visit_date)
      ORDER BY month
    `);

    res.json(result.rows.map(row => ({
      month: row.month,
      avgScore: parseFloat(row.avg_score || 0).toFixed(2),
      totalAudits: parseInt(row.total_audits)
    })));
  } catch (error) {
    console.error('Erro ao obter dados de scores mensais:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.get('/charts/summary-distribution', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        general_summary,
        COUNT(*) as total
      FROM audits 
      WHERE visit_date >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY general_summary
    `);

    res.json(result.rows.map(row => ({
      summary: row.general_summary,
      total: parseInt(row.total)
    })));
  } catch (error) {
    console.error('Erro ao obter distribuição de resumos:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;

