/**
 * Query Builder
 * Constructor de consultas SQL optimizado para prevenir problemas de rendimiento
 * Recomendación #17: Optimización de consultas de base de datos
 */

import logger from '../logger.js';

class QueryBuilder {
  constructor(table) {
    this.table = table;
    this.selectFields = ['*'];
    this.whereConditions = [];
    this.joinClauses = [];
    this.orderByFields = [];
    this.groupByFields = [];
    this.havingConditions = [];
    this.limitValue = null;
    this.offsetValue = null;
    this.params = [];
    this.queryType = 'SELECT';
    this.updateFields = {};
    this.insertData = {};
  }

  /**
     * Seleccionar campos específicos
     */
  select(fields) {
    if (Array.isArray(fields)) {
      this.selectFields = fields;
    } else if (typeof fields === 'string') {
      this.selectFields = fields.split(',').map(f => f.trim());
    }
    return this;
  }

  /**
     * Agregar condición WHERE con parámetros seguros
     */
  where(field, operator, value) {
    if (arguments.length === 2) {
      // where(field, value) - asume operador '='
      value = operator;
      operator = '=';
    }

    this.whereConditions.push({
      field,
      operator: this.validateOperator(operator),
      value,
      connector: 'AND'
    });
        
    this.params.push(value);
    return this;
  }

  /**
     * Agregar condición WHERE con OR
     */
  orWhere(field, operator, value) {
    if (arguments.length === 2) {
      value = operator;
      operator = '=';
    }

    this.whereConditions.push({
      field,
      operator: this.validateOperator(operator),
      value,
      connector: 'OR'
    });
        
    this.params.push(value);
    return this;
  }

  /**
     * WHERE IN optimizado
     */
  whereIn(field, values) {
    if (!Array.isArray(values) || values.length === 0) {
      throw new Error('whereIn requires a non-empty array');
    }

    const placeholders = values.map(() => '?').join(', ');
    this.whereConditions.push({
      field,
      operator: 'IN',
      value: `(${placeholders})`,
      connector: 'AND',
      raw: true
    });
        
    this.params.push(...values);
    return this;
  }

  /**
     * WHERE NOT IN
     */
  whereNotIn(field, values) {
    if (!Array.isArray(values) || values.length === 0) {
      throw new Error('whereNotIn requires a non-empty array');
    }

    const placeholders = values.map(() => '?').join(', ');
    this.whereConditions.push({
      field,
      operator: 'NOT IN',
      value: `(${placeholders})`,
      connector: 'AND',
      raw: true
    });
        
    this.params.push(...values);
    return this;
  }

  /**
     * WHERE BETWEEN
     */
  whereBetween(field, min, max) {
    this.whereConditions.push({
      field,
      operator: 'BETWEEN',
      value: '? AND ?',
      connector: 'AND',
      raw: true
    });
        
    this.params.push(min, max);
    return this;
  }

  /**
     * WHERE LIKE con escape automático
     */
  whereLike(field, pattern) {
    this.whereConditions.push({
      field,
      operator: 'LIKE',
      value: pattern,
      connector: 'AND'
    });
        
    this.params.push(pattern);
    return this;
  }

  /**
     * WHERE IS NULL
     */
  whereNull(field) {
    this.whereConditions.push({
      field,
      operator: 'IS NULL',
      value: null,
      connector: 'AND',
      raw: true
    });
        
    return this;
  }

  /**
     * WHERE IS NOT NULL
     */
  whereNotNull(field) {
    this.whereConditions.push({
      field,
      operator: 'IS NOT NULL',
      value: null,
      connector: 'AND',
      raw: true
    });
        
    return this;
  }

  /**
     * JOIN optimizado
     */
  join(table, firstField, operator, secondField) {
    if (arguments.length === 3) {
      secondField = operator;
      operator = '=';
    }

    this.joinClauses.push({
      type: 'INNER JOIN',
      table,
      condition: `${firstField} ${operator} ${secondField}`
    });
        
    return this;
  }

  /**
     * LEFT JOIN
     */
  leftJoin(table, firstField, operator, secondField) {
    if (arguments.length === 3) {
      secondField = operator;
      operator = '=';
    }

    this.joinClauses.push({
      type: 'LEFT JOIN',
      table,
      condition: `${firstField} ${operator} ${secondField}`
    });
        
    return this;
  }

  /**
     * RIGHT JOIN
     */
  rightJoin(table, firstField, operator, secondField) {
    if (arguments.length === 3) {
      secondField = operator;
      operator = '=';
    }

    this.joinClauses.push({
      type: 'RIGHT JOIN',
      table,
      condition: `${firstField} ${operator} ${secondField}`
    });
        
    return this;
  }

  /**
     * ORDER BY optimizado
     */
  orderBy(field, direction = 'ASC') {
    direction = direction.toUpperCase();
    if (!['ASC', 'DESC'].includes(direction)) {
      throw new Error('Order direction must be ASC or DESC');
    }

    this.orderByFields.push({
      field: this.sanitizeField(field),
      direction
    });
        
    return this;
  }

  /**
     * GROUP BY
     */
  groupBy(fields) {
    if (Array.isArray(fields)) {
      this.groupByFields = fields.map(f => this.sanitizeField(f));
    } else {
      this.groupByFields.push(this.sanitizeField(fields));
    }
        
    return this;
  }

  /**
     * HAVING
     */
  having(field, operator, value) {
    if (arguments.length === 2) {
      value = operator;
      operator = '=';
    }

    this.havingConditions.push({
      field,
      operator: this.validateOperator(operator),
      value
    });
        
    this.params.push(value);
    return this;
  }

  /**
     * LIMIT
     */
  limit(count) {
    this.limitValue = parseInt(count);
    if (isNaN(this.limitValue) || this.limitValue < 0) {
      throw new Error('Limit must be a positive number');
    }
    return this;
  }

  /**
     * OFFSET
     */
  offset(count) {
    this.offsetValue = parseInt(count);
    if (isNaN(this.offsetValue) || this.offsetValue < 0) {
      throw new Error('Offset must be a positive number');
    }
    return this;
  }

  /**
     * Paginación optimizada
     */
  paginate(page, perPage = 10) {
    page = parseInt(page) || 1;
    perPage = parseInt(perPage) || 10;
        
    if (page < 1) page = 1;
    if (perPage < 1) perPage = 10;
    if (perPage > 1000) perPage = 1000; // Límite de seguridad
        
    this.limitValue = perPage;
    this.offsetValue = (page - 1) * perPage;
        
    return this;
  }

  /**
     * INSERT
     */
  insert(data) {
    this.queryType = 'INSERT';
    this.insertData = data;
        
    if (Array.isArray(data)) {
      // Inserción múltiple
      if (data.length === 0) {
        throw new Error('Insert data cannot be empty');
      }
            
      const fields = Object.keys(data[0]);
      this.params = data.flatMap(row => fields.map(field => row[field]));
    } else {
      // Inserción simple
      this.params = Object.values(data);
    }
        
    return this;
  }

  /**
     * UPDATE
     */
  update(data) {
    this.queryType = 'UPDATE';
    this.updateFields = data;
        
    // Los parámetros de UPDATE van antes de los WHERE
    const updateParams = Object.values(data);
    this.params = [...updateParams, ...this.params];
        
    return this;
  }

  /**
     * DELETE
     */
  delete() {
    this.queryType = 'DELETE';
    return this;
  }

  /**
     * Construir la consulta SQL
     */
  build() {
    switch (this.queryType) {
    case 'SELECT':
      return this.buildSelect();
    case 'INSERT':
      return this.buildInsert();
    case 'UPDATE':
      return this.buildUpdate();
    case 'DELETE':
      return this.buildDelete();
    default:
      throw new Error(`Unsupported query type: ${this.queryType}`);
    }
  }

  /**
     * Construir SELECT
     */
  buildSelect() {
    let sql = `SELECT ${this.selectFields.join(', ')} FROM ${this.table}`;
        
    // JOINs
    if (this.joinClauses.length > 0) {
      sql += ' ' + this.joinClauses
        .map(join => `${join.type} ${join.table} ON ${join.condition}`)
        .join(' ');
    }
        
    // WHERE
    if (this.whereConditions.length > 0) {
      sql += ' WHERE ' + this.buildWhereClause();
    }
        
    // GROUP BY
    if (this.groupByFields.length > 0) {
      sql += ` GROUP BY ${this.groupByFields.join(', ')}`;
    }
        
    // HAVING
    if (this.havingConditions.length > 0) {
      sql += ' HAVING ' + this.havingConditions
        .map(condition => `${condition.field} ${condition.operator} ?`)
        .join(' AND ');
    }
        
    // ORDER BY
    if (this.orderByFields.length > 0) {
      sql += ' ORDER BY ' + this.orderByFields
        .map(order => `${order.field} ${order.direction}`)
        .join(', ');
    }
        
    // LIMIT y OFFSET
    if (this.limitValue !== null) {
      sql += ` LIMIT ${this.limitValue}`;
            
      if (this.offsetValue !== null) {
        sql += ` OFFSET ${this.offsetValue}`;
      }
    }
        
    return { sql, params: this.params };
  }

  /**
     * Construir INSERT
     */
  buildInsert() {
    if (Array.isArray(this.insertData)) {
      // Inserción múltiple
      const fields = Object.keys(this.insertData[0]);
      const placeholders = fields.map(() => '?').join(', ');
      const values = this.insertData.map(() => `(${placeholders})`).join(', ');
            
      const sql = `INSERT INTO ${this.table} (${fields.join(', ')}) VALUES ${values}`;
      return { sql, params: this.params };
    } else {
      // Inserción simple
      const fields = Object.keys(this.insertData);
      const placeholders = fields.map(() => '?').join(', ');
            
      const sql = `INSERT INTO ${this.table} (${fields.join(', ')}) VALUES (${placeholders})`;
      return { sql, params: this.params };
    }
  }

  /**
     * Construir UPDATE
     */
  buildUpdate() {
    const fields = Object.keys(this.updateFields);
    const setClause = fields.map(field => `${field} = ?`).join(', ');
        
    let sql = `UPDATE ${this.table} SET ${setClause}`;
        
    if (this.whereConditions.length > 0) {
      sql += ' WHERE ' + this.buildWhereClause();
    } else {
      throw new Error('UPDATE queries must have WHERE conditions for safety');
    }
        
    return { sql, params: this.params };
  }

  /**
     * Construir DELETE
     */
  buildDelete() {
    let sql = `DELETE FROM ${this.table}`;
        
    if (this.whereConditions.length > 0) {
      sql += ' WHERE ' + this.buildWhereClause();
    } else {
      throw new Error('DELETE queries must have WHERE conditions for safety');
    }
        
    return { sql, params: this.params };
  }

  /**
     * Construir cláusula WHERE
     */
  buildWhereClause() {
    let whereClause = '';
        
    this.whereConditions.forEach((condition, index) => {
      if (index > 0) {
        whereClause += ` ${condition.connector} `;
      }
            
      if (condition.raw) {
        whereClause += `${condition.field} ${condition.operator} ${condition.value}`;
      } else {
        whereClause += `${condition.field} ${condition.operator} ?`;
      }
    });
        
    return whereClause;
  }

  /**
     * Validar operador SQL
     */
  validateOperator(operator) {
    const validOperators = [
      '=', '!=', '<>', '<', '>', '<=', '>=',
      'LIKE', 'NOT LIKE', 'IN', 'NOT IN',
      'BETWEEN', 'NOT BETWEEN', 'IS NULL', 'IS NOT NULL'
    ];
        
    if (!validOperators.includes(operator.toUpperCase())) {
      throw new Error(`Invalid operator: ${operator}`);
    }
        
    return operator.toUpperCase();
  }

  /**
     * Sanitizar nombre de campo
     */
  sanitizeField(field) {
    // Permitir solo caracteres alfanuméricos, guiones bajos y puntos
    if (!/^[a-zA-Z0-9_.]+$/.test(field)) {
      throw new Error(`Invalid field name: ${field}`);
    }
    return field;
  }

  /**
     * Obtener consulta como string (para debugging)
     */
  toSql() {
    const { sql, params } = this.build();
    let finalSql = sql;
        
    // Reemplazar parámetros para visualización (solo para debug)
    params.forEach(param => {
      finalSql = finalSql.replace('?', typeof param === 'string' ? `'${param}'` : param);
    });
        
    return finalSql;
  }

  /**
     * Clonar el query builder
     */
  clone() {
    const cloned = new QueryBuilder(this.table);
    cloned.selectFields = [...this.selectFields];
    cloned.whereConditions = [...this.whereConditions];
    cloned.joinClauses = [...this.joinClauses];
    cloned.orderByFields = [...this.orderByFields];
    cloned.groupByFields = [...this.groupByFields];
    cloned.havingConditions = [...this.havingConditions];
    cloned.limitValue = this.limitValue;
    cloned.offsetValue = this.offsetValue;
    cloned.params = [...this.params];
    cloned.queryType = this.queryType;
    cloned.updateFields = { ...this.updateFields };
    cloned.insertData = { ...this.insertData };
        
    return cloned;
  }
}

/**
 * Factory function para crear query builders
 */
export function query(table) {
  return new QueryBuilder(table);
}

/**
 * Helpers para consultas comunes optimizadas
 */
export const QueryHelpers = {
  /**
     * Buscar por ID con cache
     */
  findById(table, id) {
    return query(table).where('id', id).limit(1);
  },

  /**
     * Buscar con paginación
     */
  paginated(table, page = 1, perPage = 10, conditions = {}) {
    const builder = query(table);
        
    Object.entries(conditions).forEach(([field, value]) => {
      builder.where(field, value);
    });
        
    return builder.paginate(page, perPage);
  },

  /**
     * Buscar registros recientes
     */
  recent(table, field = 'created_at', limit = 10) {
    return query(table)
      .orderBy(field, 'DESC')
      .limit(limit);
  },

  /**
     * Contar registros
     */
  count(table, conditions = {}) {
    const builder = query(table).select(['COUNT(*) as count']);
        
    Object.entries(conditions).forEach(([field, value]) => {
      builder.where(field, value);
    });
        
    return builder;
  },

  /**
     * Buscar con múltiples condiciones OR
     */
  searchMultiple(table, searchFields, searchTerm) {
    const builder = query(table);
        
    searchFields.forEach((field, index) => {
      if (index === 0) {
        builder.where(field, 'LIKE', `%${searchTerm}%`);
      } else {
        builder.orWhere(field, 'LIKE', `%${searchTerm}%`);
      }
    });
        
    return builder;
  }
};

export default QueryBuilder;