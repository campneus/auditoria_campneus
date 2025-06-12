const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Listar auditorias com filtros
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { branch_id, auditor_id, start_date, end_date, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT a.*, b.name as branch_name, b.code as branch_code, u.username as auditor_name
      FROM audits a
      JOIN branches b ON a.branch_id = b.id
      JOIN users u ON a.auditor_id = u.id
      WHERE 1=1
    `;
    const values = [];
    let paramCount = 1;

    if (branch_id) {
      query += ` AND a.branch_id = $${paramCount++}`;
      values.push(branch_id);
    }

    if (auditor_id) {
      query += ` AND a.auditor_id = $${paramCount++}`;
      values.push(auditor_id);
    }

    if (start_date) {
      query += ` AND a.visit_date >= $${paramCount++}`;
      values.push(start_date);
    }

    if (end_date) {
      query += ` AND a.visit_date <= $${paramCount++}`;
      values.push(end_date);
    }

    query += ` ORDER BY a.visit_date DESC LIMIT $${paramCount++} OFFSET $${paramCount++}`;
    values.push(limit, offset);

    const result = await db.query(query, values);
    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao listar auditorias:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Obter auditoria por ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(`
      SELECT a.*, b.name as branch_name, b.code as branch_code, u.username as auditor_name
      FROM audits a
      JOIN branches b ON a.branch_id = b.id
      JOIN users u ON a.auditor_id = u.id
      WHERE a.id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Auditoria não encontrada' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao obter auditoria:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Criar auditoria
router.post('/', authenticateToken, [
  body('branch_id').isInt().withMessage('ID da filial deve ser um número'),
  body('visit_date').isISO8601().withMessage('Data da visita deve ser válida'),
  body('month_analyzed').notEmpty().withMessage('Mês analisado é obrigatório'),
  body('scheduled_visit').isBoolean().withMessage('Visita programada deve ser verdadeiro ou falso')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const auditorId = req.user.id;
    const {
      branch_id, visit_date, month_analyzed, scheduled_visit, store_category,
      vat_number, customer_aspect_category, nps_score, checkups_done,
      tyreco_stock, monthly_inventory_status, stock_adjustment_made,
      sales_returns_compliance, tire_quantity, imported_tire_quantity,
      pirelli_tire_quantity, parts_quantity, has_nf_to_ship, cash_balance,
      parts_stock_value, tire_stock_value, general_summary, score, notes
    } = req.body;

    const result = await db.query(`
      INSERT INTO audits (
        branch_id, auditor_id, visit_date, month_analyzed, scheduled_visit,
        store_category, vat_number, customer_aspect_category, nps_score,
        checkups_done, tyreco_stock, monthly_inventory_status,
        stock_adjustment_made, sales_returns_compliance, tire_quantity,
        imported_tire_quantity, pirelli_tire_quantity, parts_quantity,
        has_nf_to_ship, cash_balance, parts_stock_value, tire_stock_value,
        general_summary, score, notes
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20, $21, $22, $23, $24, $25
      ) RETURNING *
    `, [
      branch_id, auditorId, visit_date, month_analyzed, scheduled_visit,
      store_category, vat_number, customer_aspect_category, nps_score,
      checkups_done, tyreco_stock, monthly_inventory_status,
      stock_adjustment_made, sales_returns_compliance, tire_quantity,
      imported_tire_quantity, pirelli_tire_quantity, parts_quantity,
      has_nf_to_ship, cash_balance, parts_stock_value, tire_stock_value,
      general_summary, score, notes
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao criar auditoria:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Atualizar auditoria (apenas administradores ou o próprio auditor)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar se o usuário pode editar esta auditoria
    const auditCheck = await db.query('SELECT auditor_id FROM audits WHERE id = $1', [id]);
    if (auditCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Auditoria não encontrada' });
    }

    if (req.user.role !== 'administrador' && auditCheck.rows[0].auditor_id !== req.user.id) {
      return res.status(403).json({ error: 'Sem permissão para editar esta auditoria' });
    }

    const {
      visit_date, month_analyzed, scheduled_visit, store_category,
      vat_number, customer_aspect_category, nps_score, checkups_done,
      tyreco_stock, monthly_inventory_status, stock_adjustment_made,
      sales_returns_compliance, tire_quantity, imported_tire_quantity,
      pirelli_tire_quantity, parts_quantity, has_nf_to_ship, cash_balance,
      parts_stock_value, tire_stock_value, general_summary, score, notes
    } = req.body;

    const result = await db.query(`
      UPDATE audits SET
        visit_date = COALESCE($1, visit_date),
        month_analyzed = COALESCE($2, month_analyzed),
        scheduled_visit = COALESCE($3, scheduled_visit),
        store_category = COALESCE($4, store_category),
        vat_number = COALESCE($5, vat_number),
        customer_aspect_category = COALESCE($6, customer_aspect_category),
        nps_score = COALESCE($7, nps_score),
        checkups_done = COALESCE($8, checkups_done),
        tyreco_stock = COALESCE($9, tyreco_stock),
        monthly_inventory_status = COALESCE($10, monthly_inventory_status),
        stock_adjustment_made = COALESCE($11, stock_adjustment_made),
        sales_returns_compliance = COALESCE($12, sales_returns_compliance),
        tire_quantity = COALESCE($13, tire_quantity),
        imported_tire_quantity = COALESCE($14, imported_tire_quantity),
        pirelli_tire_quantity = COALESCE($15, pirelli_tire_quantity),
        parts_quantity = COALESCE($16, parts_quantity),
        has_nf_to_ship = COALESCE($17, has_nf_to_ship),
        cash_balance = COALESCE($18, cash_balance),
        parts_stock_value = COALESCE($19, parts_stock_value),
        tire_stock_value = COALESCE($20, tire_stock_value),
        general_summary = COALESCE($21, general_summary),
        score = COALESCE($22, score),
        notes = COALESCE($23, notes)
      WHERE id = $24
      RETURNING *
    `, [
      visit_date, month_analyzed, scheduled_visit, store_category,
      vat_number, customer_aspect_category, nps_score, checkups_done,
      tyreco_stock, monthly_inventory_status, stock_adjustment_made,
      sales_returns_compliance, tire_quantity, imported_tire_quantity,
      pirelli_tire_quantity, parts_quantity, has_nf_to_ship, cash_balance,
      parts_stock_value, tire_stock_value, general_summary, score, notes, id
    ]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar auditoria:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Deletar auditoria (apenas administradores)
router.delete('/:id', authenticateToken, requireRole(['administrador']), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query('DELETE FROM audits WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Auditoria não encontrada' });
    }

    res.json({ message: 'Auditoria deletada com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar auditoria:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;

