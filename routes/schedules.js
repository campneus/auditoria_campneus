const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Listar agendamentos
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date, branch_id } = req.query;

    let query = `
      SELECT s.*, b.name as branch_name, b.code as branch_code
      FROM schedules s
      JOIN branches b ON s.branch_id = b.id
      WHERE 1=1
    `;
    const values = [];
    let paramCount = 1;

    if (start_date) {
      query += ` AND s.scheduled_date >= $${paramCount++}`;
      values.push(start_date);
    }

    if (end_date) {
      query += ` AND s.scheduled_date <= $${paramCount++}`;
      values.push(end_date);
    }

    if (branch_id) {
      query += ` AND s.branch_id = $${paramCount++}`;
      values.push(branch_id);
    }

    query += ` ORDER BY s.scheduled_date ASC`;

    const result = await db.query(query, values);
    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao listar agendamentos:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Obter agendamento por ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(`
      SELECT s.*, b.name as branch_name, b.code as branch_code
      FROM schedules s
      JOIN branches b ON s.branch_id = b.id
      WHERE s.id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Agendamento não encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao obter agendamento:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Criar agendamento
router.post('/', authenticateToken, [
  body('branch_id').isInt().withMessage('ID da filial deve ser um número'),
  body('scheduled_date').isISO8601().withMessage('Data do agendamento deve ser válida'),
  body('audit_type').isIn(['completa', 'parcial', 'somente estoque']).withMessage('Tipo de auditoria inválido')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { branch_id, scheduled_date, audit_type } = req.body;

    // Verificar se já existe agendamento para a mesma filial na mesma data
    const existing = await db.query(
      'SELECT id FROM schedules WHERE branch_id = $1 AND scheduled_date = $2',
      [branch_id, scheduled_date]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Já existe agendamento para esta filial nesta data' });
    }

    const result = await db.query(
      'INSERT INTO schedules (branch_id, scheduled_date, audit_type) VALUES ($1, $2, $3) RETURNING *',
      [branch_id, scheduled_date, audit_type]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao criar agendamento:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Atualizar agendamento
router.put('/:id', authenticateToken, [
  body('scheduled_date').optional().isISO8601().withMessage('Data do agendamento deve ser válida'),
  body('audit_type').optional().isIn(['completa', 'parcial', 'somente estoque']).withMessage('Tipo de auditoria inválido')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { scheduled_date, audit_type } = req.body;

    // Construir query dinamicamente
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (scheduled_date) {
      updates.push(`scheduled_date = $${paramCount++}`);
      values.push(scheduled_date);
    }
    if (audit_type) {
      updates.push(`audit_type = $${paramCount++}`);
      values.push(audit_type);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }

    values.push(id);
    const query = `UPDATE schedules SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;

    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Agendamento não encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar agendamento:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Deletar agendamento
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query('DELETE FROM schedules WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Agendamento não encontrado' });
    }

    res.json({ message: 'Agendamento deletado com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar agendamento:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;

