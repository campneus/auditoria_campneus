const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Listar filiais
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM branches ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao listar filiais:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Obter filial por ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('SELECT * FROM branches WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Filial não encontrada' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao obter filial:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Criar filial (apenas administradores)
router.post('/', authenticateToken, requireRole(['administrador']), [
  body('code').notEmpty().withMessage('Código é obrigatório'),
  body('name').notEmpty().withMessage('Nome é obrigatório'),
  body('cnpj').notEmpty().withMessage('CNPJ é obrigatório'),
  body('state').notEmpty().withMessage('Estado é obrigatório'),
  body('city').notEmpty().withMessage('Cidade é obrigatória')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { code, name, cnpj, state, city } = req.body;

    // Verificar se código ou CNPJ já existem
    const existing = await db.query('SELECT id FROM branches WHERE code = $1 OR cnpj = $2', [code, cnpj]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Código ou CNPJ já existe' });
    }

    const result = await db.query(
      'INSERT INTO branches (code, name, cnpj, state, city) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [code, name, cnpj, state, city]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao criar filial:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Atualizar filial (apenas administradores)
router.put('/:id', authenticateToken, requireRole(['administrador']), [
  body('code').optional().notEmpty().withMessage('Código não pode estar vazio'),
  body('name').optional().notEmpty().withMessage('Nome não pode estar vazio'),
  body('cnpj').optional().notEmpty().withMessage('CNPJ não pode estar vazio'),
  body('state').optional().notEmpty().withMessage('Estado não pode estar vazio'),
  body('city').optional().notEmpty().withMessage('Cidade não pode estar vazia')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { code, name, cnpj, state, city } = req.body;

    // Construir query dinamicamente
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (code) {
      updates.push(`code = $${paramCount++}`);
      values.push(code);
    }
    if (name) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (cnpj) {
      updates.push(`cnpj = $${paramCount++}`);
      values.push(cnpj);
    }
    if (state) {
      updates.push(`state = $${paramCount++}`);
      values.push(state);
    }
    if (city) {
      updates.push(`city = $${paramCount++}`);
      values.push(city);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }

    values.push(id);
    const query = `UPDATE branches SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;

    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Filial não encontrada' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar filial:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Deletar filial (apenas administradores)
router.delete('/:id', authenticateToken, requireRole(['administrador']), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query('DELETE FROM branches WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Filial não encontrada' });
    }

    res.json({ message: 'Filial deletada com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar filial:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;

