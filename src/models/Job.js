// src/models/Job.js
const { pool } = require('../config/database');

class Job {
  static async findAll(userId, date) {
    let query = 'SELECT * FROM jobs WHERE user_id = $1 ORDER BY scheduled_date DESC, created_at DESC';
    const params = [userId];
    
    if (date) {
      query = 'SELECT * FROM jobs WHERE user_id = $1 AND scheduled_date = $2 ORDER BY created_at DESC';
      params.push(date);
    }
    
    const result = await pool.query(query, params);
    return result.rows;
  }

  static async findById(userId, id) {
    const result = await pool.query(
      'SELECT * FROM jobs WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    return result.rows[0];
  }

  static async findByDoNumber(userId, doNumber) {
    const result = await pool.query(
      'SELECT * FROM jobs WHERE do_number = $1 AND user_id = $2',
      [doNumber, userId]
    );
    return result.rows[0];
  }

  // ===== CHECK IF DO NUMBER EXISTS =====
  static async checkDoNumberExists(doNumber) {
    const result = await pool.query(
      'SELECT id, do_number FROM jobs WHERE do_number = $1',
      [doNumber]
    );
    return result.rows.length > 0;
  }

  // ===== CHECK MULTIPLE DO NUMBERS =====
  static async checkDoNumbersExists(doNumbers) {
    if (!doNumbers || doNumbers.length === 0) return {};
    
    const placeholders = doNumbers.map((_, i) => `$${i + 1}`).join(',');
    const query = `SELECT do_number FROM jobs WHERE do_number IN (${placeholders})`;
    
    const result = await pool.query(query, doNumbers);
    
    // Return an object with DO numbers as keys and boolean as value
    const existsMap = {};
    doNumbers.forEach(doNumber => {
      existsMap[doNumber] = result.rows.some(row => row.do_number === doNumber);
    });
    
    return existsMap;
  }

  static async create(jobData) {
    const {
      do_number, customer_name, customer_company, phone,
      delivery_address, postcode, recipient_name, recipient_phone,
      boxes, weight, contents, status, scheduled_date,
      special_instructions, barcodes, detrack_id, source,
      group_name, pickup_address, user_id, group_id
    } = jobData;

    const query = `
      INSERT INTO jobs (
        do_number, customer_name, customer_company, phone,
        delivery_address, postcode, recipient_name, recipient_phone,
        boxes, weight, contents, status, scheduled_date,
        special_instructions, barcodes, detrack_id, source,
        group_name, pickup_address, user_id, group_id, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
      RETURNING id
    `;
    
    const result = await pool.query(query, [
      do_number, 
      customer_name, 
      customer_company, 
      phone,
      delivery_address, 
      postcode, 
      recipient_name, 
      recipient_phone,
      boxes, 
      weight, 
      contents, 
      status, 
      scheduled_date,
      special_instructions, 
      JSON.stringify(barcodes), 
      detrack_id, 
      source,
      group_name, 
      pickup_address, 
      user_id, 
      group_id,
      new Date().toISOString(),
      new Date().toISOString()
    ]);
    
    return result.rows[0];
  }

  static async updateLabelUrl(doNumber, labelUrl) {
    await pool.query(
      'UPDATE jobs SET label_url = $1 WHERE do_number = $2',
      [labelUrl, doNumber]
    );
  }

  static async upsert(jobData) {
    const {
      do_number, customer_name, customer_company, phone,
      delivery_address, postcode, recipient_name, recipient_phone,
      boxes, weight, contents, status, scheduled_date,
      special_instructions, barcodes, detrack_id, source,
      group_name, pickup_address, user_id, group_id
    } = jobData;

    const query = `
      INSERT INTO jobs (
        do_number, customer_name, customer_company, phone,
        delivery_address, postcode, recipient_name, recipient_phone,
        boxes, weight, contents, status, scheduled_date,
        special_instructions, barcodes, detrack_id, source,
        group_name, pickup_address, user_id, group_id, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
      ON CONFLICT (do_number) DO UPDATE SET
        customer_name = EXCLUDED.customer_name,
        customer_company = EXCLUDED.customer_company,
        phone = EXCLUDED.phone,
        delivery_address = EXCLUDED.delivery_address,
        postcode = EXCLUDED.postcode,
        recipient_name = EXCLUDED.recipient_name,
        recipient_phone = EXCLUDED.recipient_phone,
        boxes = EXCLUDED.boxes,
        weight = EXCLUDED.weight,
        contents = EXCLUDED.contents,
        status = EXCLUDED.status,
        scheduled_date = EXCLUDED.scheduled_date,
        special_instructions = EXCLUDED.special_instructions,
        barcodes = EXCLUDED.barcodes,
        detrack_id = EXCLUDED.detrack_id,
        group_name = EXCLUDED.group_name,
        pickup_address = EXCLUDED.pickup_address,
        user_id = EXCLUDED.user_id,
        group_id = EXCLUDED.group_id,
        updated_at = CURRENT_TIMESTAMP
    `;
    
    const result = await pool.query(query, [
      do_number, 
      customer_name, 
      customer_company, 
      phone,
      delivery_address, 
      postcode, 
      recipient_name, 
      recipient_phone,
      boxes, 
      weight, 
      contents, 
      status, 
      scheduled_date,
      special_instructions, 
      JSON.stringify(barcodes), 
      detrack_id, 
      source,
      group_name, 
      pickup_address, 
      user_id, 
      group_id,
      new Date().toISOString(),
      new Date().toISOString()
    ]);
    
    return result.rows[0];
  }

  static async getBoxStatus(userId, doNumber) {
    const result = await pool.query(
      'SELECT barcodes, scans FROM jobs WHERE do_number = $1 AND user_id = $2',
      [doNumber, userId]
    );
    return result.rows[0];
  }

  static async updateScans(userId, doNumber, scans) {
    await pool.query(
      'UPDATE jobs SET scans = $1, updated_at = CURRENT_TIMESTAMP WHERE do_number = $2 AND user_id = $3',
      [JSON.stringify(scans), doNumber, userId]
    );
  }
}

module.exports = Job;