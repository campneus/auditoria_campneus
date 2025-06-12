const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Relatório de última visita por filial
router.get('/last-visit-by-branch', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        b.id,
        b.code,
        b.name,
        b.state,
        b.city,
        a.visit_date as last_visit_date,
        a.score as last_score,
        a.general_summary as last_summary,
        u.username as last_auditor,
        CASE 
          WHEN a.visit_date IS NULL THEN 'Nunca visitada'
          WHEN a.visit_date < CURRENT_DATE - INTERVAL '12 months' THEN 'Mais de 1 ano'
          WHEN a.visit_date < CURRENT_DATE - INTERVAL '6 months' THEN 'Mais de 6 meses'
          ELSE 'Recente'
        END as visit_status
      FROM branches b
      LEFT JOIN LATERAL (
        SELECT * FROM audits a2 
        WHERE a2.branch_id = b.id 
        ORDER BY a2.visit_date DESC 
        LIMIT 1
      ) a ON true
      LEFT JOIN users u ON a.auditor_id = u.id
      ORDER BY b.name
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao gerar relatório de última visita:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Relatório de filiais para auditar (sem visita recente)
router.get('/branches-to-audit', authenticateToken, async (req, res) => {
  try {
    const { months = 12 } = req.query;
    
    const result = await db.query(`
      SELECT 
        b.id,
        b.code,
        b.name,
        b.state,
        b.city,
        a.visit_date as last_visit_date,
        CASE 
          WHEN a.visit_date IS NULL THEN 'Nunca visitada'
          ELSE CONCAT(
            EXTRACT(DAYS FROM CURRENT_DATE - a.visit_date), 
            ' dias atrás'
          )
        END as days_since_last_visit
      FROM branches b
      LEFT JOIN LATERAL (
        SELECT * FROM audits a2 
        WHERE a2.branch_id = b.id 
        ORDER BY a2.visit_date DESC 
        LIMIT 1
      ) a ON true
      WHERE a.visit_date IS NULL 
         OR a.visit_date < CURRENT_DATE - INTERVAL '${months} months'
      ORDER BY a.visit_date ASC NULLS FIRST, b.name
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao gerar relatório de filiais para auditar:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Relatório de auditorias por período
router.get('/audits-by-period', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date, branch_id, auditor_id } = req.query;

    let query = `
      SELECT 
        a.id,
        a.visit_date,
        a.score,
        a.general_summary,
        a.month_analyzed,
        b.code as branch_code,
        b.name as branch_name,
        b.state,
        b.city,
        u.username as auditor_name,
        a.notes
      FROM audits a
      JOIN branches b ON a.branch_id = b.id
      JOIN users u ON a.auditor_id = u.id
      WHERE 1=1
    `;

    const values = [];
    let paramCount = 1;

    if (start_date) {
      query += ` AND a.visit_date >= $${paramCount++}`;
      values.push(start_date);
    }

    if (end_date) {
      query += ` AND a.visit_date <= $${paramCount++}`;
      values.push(end_date);
    }

    if (branch_id) {
      query += ` AND a.branch_id = $${paramCount++}`;
      values.push(branch_id);
    }

    if (auditor_id) {
      query += ` AND a.auditor_id = $${paramCount++}`;
      values.push(auditor_id);
    }

    query += ` ORDER BY a.visit_date DESC`;

    const result = await db.query(query, values);
    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao gerar relatório de auditorias por período:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Relatório de performance por auditor
router.get('/auditor-performance', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    let query = `
      SELECT 
        u.id,
        u.username,
        COUNT(a.id) as total_audits,
        AVG(a.score) as avg_score,
        MIN(a.score) as min_score,
        MAX(a.score) as max_score,
        COUNT(CASE WHEN a.general_summary = 'de acordo' THEN 1 END) as audits_ok,
        COUNT(CASE WHEN a.general_summary = 'com pontos de atenção' THEN 1 END) as audits_attention,
        COUNT(CASE WHEN a.general_summary = 'em desacordo' THEN 1 END) as audits_nok
      FROM users u
      LEFT JOIN audits a ON u.id = a.auditor_id
    `;

    const values = [];
    let paramCount = 1;

    if (start_date || end_date) {
      query += ` AND (`;
      if (start_date) {
        query += ` a.visit_date >= $${paramCount++}`;
        values.push(start_date);
      }
      if (end_date) {
        if (start_date) query += ` AND`;
        query += ` a.visit_date <= $${paramCount++}`;
        values.push(end_date);
      }
      query += `)`;
    }

    query += `
      WHERE u.role = 'auditor'
      GROUP BY u.id, u.username
      ORDER BY total_audits DESC
    `;

    const result = await db.query(query, values);
    
    res.json(result.rows.map(row => ({
      ...row,
      total_audits: parseInt(row.total_audits || 0),
      avg_score: parseFloat(row.avg_score || 0).toFixed(2),
      min_score: parseInt(row.min_score || 0),
      max_score: parseInt(row.max_score || 0),
      audits_ok: parseInt(row.audits_ok || 0),
      audits_attention: parseInt(row.audits_attention || 0),
      audits_nok: parseInt(row.audits_nok || 0)
    })));
  } catch (error) {
    console.error('Erro ao gerar relatório de performance por auditor:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Relatório de scores por estado
router.get('/scores-by-state', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        b.state,
        COUNT(a.id) as total_audits,
        AVG(a.score) as avg_score,
        MIN(a.score) as min_score,
        MAX(a.score) as max_score,
        COUNT(CASE WHEN a.general_summary = 'de acordo' THEN 1 END) as audits_ok,
        COUNT(CASE WHEN a.general_summary = 'com pontos de atenção' THEN 1 END) as audits_attention,
        COUNT(CASE WHEN a.general_summary = 'em desacordo' THEN 1 END) as audits_nok
      FROM branches b
      LEFT JOIN audits a ON b.id = a.branch_id 
        AND a.visit_date >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY b.state
      ORDER BY avg_score DESC NULLS LAST
    `);

    res.json(result.rows.map(row => ({
      ...row,
      total_audits: parseInt(row.total_audits || 0),
      avg_score: parseFloat(row.avg_score || 0).toFixed(2),
      min_score: parseInt(row.min_score || 0),
      max_score: parseInt(row.max_score || 0),
      audits_ok: parseInt(row.audits_ok || 0),
      audits_attention: parseInt(row.audits_attention || 0),
      audits_nok: parseInt(row.audits_nok || 0)
    })));
  } catch (error) {
    console.error('Erro ao gerar relatório de scores por estado:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;

