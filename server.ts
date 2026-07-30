import express from 'express';
import path from 'path';
import mysql from 'mysql2/promise';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Helper to sanitize database names
function sanitizeIdentifier(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, '');
}

// Helper to get MySQL connection
async function getMySQLConnection(config: any, includeDatabase = true) {
  const host = config?.host || process.env.MYSQL_HOST || '127.0.0.1';
  const port = Number(config?.port || process.env.MYSQL_PORT || 3306);
  const user = config?.user || process.env.MYSQL_USER || 'root';
  const password = config?.password !== undefined ? config.password : (process.env.MYSQL_PASSWORD || '');
  const database = config?.database || process.env.MYSQL_DATABASE || 'inventory_db';
  const ssl = config?.ssl ? { rejectUnauthorized: false } : undefined;

  const connConfig: any = {
    host,
    port,
    user,
    password,
    ssl,
    connectTimeout: 8000,
  };

  if (includeDatabase && database) {
    connConfig.database = database;
  }

  return await mysql.createConnection(connConfig);
}

// 1. Test MySQL Connection Endpoint
app.post('/api/mysql/test', async (req, res) => {
  let conn;
  try {
    const config = req.body;
    // Try connecting to MySQL server without specifying DB first to verify credentials & host
    conn = await getMySQLConnection(config, false);
    await conn.query('SELECT 1');

    const dbName = sanitizeIdentifier(config?.database || 'inventory_db');
    if (dbName) {
      await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    }
    await conn.end();

    // Now connect with DB
    conn = await getMySQLConnection(config, true);
    await conn.query('SELECT 1');
    await conn.end();

    res.json({
      success: true,
      message: `Kết nối thành công tới MySQL Server (${config.host || '127.0.0.1'}:${config.port || 3306}) - CSDL: ${config.database || 'inventory_db'}`,
    });
  } catch (err: any) {
    if (conn) {
      try { await conn.end(); } catch (_) {}
    }
    console.error('MySQL Test Connection Error:', err);
    res.status(400).json({
      success: false,
      message: err.message || 'Không thể kết nối tới MySQL server',
      code: err.code,
    });
  }
});

// 2. Initialize Tables Endpoint
app.post('/api/mysql/init-tables', async (req, res) => {
  let conn;
  try {
    const config = req.body;
    const dbName = sanitizeIdentifier(config?.database || 'inventory_db');
    conn = await getMySQLConnection(config, false);
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    await conn.query(`USE \`${dbName}\``);

    // Create categories table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id VARCHAR(50) PRIMARY KEY,
        code VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Create warehouses table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS warehouses (
        id VARCHAR(50) PRIMARY KEY,
        code VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        location TEXT,
        manager VARCHAR(255),
        description TEXT,
        is_default TINYINT(1) DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Create units table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS units (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Create items table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS items (
        id VARCHAR(50) PRIMARY KEY,
        code VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        category_id VARCHAR(50),
        category_name VARCHAR(255),
        unit_id VARCHAR(50),
        unit_name VARCHAR(255),
        warehouse_id VARCHAR(50),
        warehouse_name VARCHAR(255),
        stock_quantity INT DEFAULT 0,
        min_stock_level INT DEFAULT 0,
        max_stock_level INT DEFAULT 100,
        note TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Create stock_vouchers table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS stock_vouchers (
        id VARCHAR(50) PRIMARY KEY,
        code VARCHAR(50) NOT NULL,
        type VARCHAR(10) NOT NULL,
        date VARCHAR(20) NOT NULL,
        person VARCHAR(255),
        department VARCHAR(255),
        warehouse_id VARCHAR(50),
        warehouse_name VARCHAR(255),
        note TEXT,
        total_quantity INT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Create stock_voucher_items table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS stock_voucher_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        voucher_id VARCHAR(50) NOT NULL,
        item_id VARCHAR(50) NOT NULL,
        item_code VARCHAR(50),
        item_name VARCHAR(255),
        unit_name VARCHAR(255),
        quantity INT DEFAULT 0,
        current_stock INT DEFAULT 0
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Create inventory_logs table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS inventory_logs (
        id VARCHAR(50) PRIMARY KEY,
        voucher_id VARCHAR(50) NOT NULL,
        voucher_code VARCHAR(50) NOT NULL,
        type VARCHAR(10) NOT NULL,
        date VARCHAR(20) NOT NULL,
        item_id VARCHAR(50) NOT NULL,
        item_code VARCHAR(50),
        item_name VARCHAR(255),
        category_name VARCHAR(255),
        warehouse_id VARCHAR(50),
        warehouse_name VARCHAR(255),
        quantity INT DEFAULT 0,
        previous_stock INT DEFAULT 0,
        new_stock INT DEFAULT 0,
        person VARCHAR(255),
        department VARCHAR(255),
        note TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await conn.end();

    res.json({
      success: true,
      message: `Khởi tạo bảng MySQL thành công trong CSDL '${dbName}'!`,
    });
  } catch (err: any) {
    if (conn) {
      try { await conn.end(); } catch (_) {}
    }
    console.error('MySQL Init Tables Error:', err);
    res.status(400).json({
      success: false,
      message: err.message || 'Không thể khởi tạo bảng trên MySQL',
    });
  }
});

// 3. Fetch All Data Endpoint
app.post('/api/mysql/fetch-all', async (req, res) => {
  let conn;
  try {
    const config = req.body;
    conn = await getMySQLConnection(config, true);

    const [itemsRows] = await conn.query('SELECT * FROM items ORDER BY updated_at DESC');
    const [catsRows] = await conn.query('SELECT * FROM categories ORDER BY created_at ASC');
    const [whsRows] = await conn.query('SELECT * FROM warehouses ORDER BY created_at ASC');
    const [unitsRows] = await conn.query('SELECT * FROM units ORDER BY created_at ASC');
    const [vouchersRows] = await conn.query('SELECT * FROM stock_vouchers ORDER BY created_at DESC');
    const [voucherItemsRows] = await conn.query('SELECT * FROM stock_voucher_items');
    const [logsRows] = await conn.query('SELECT * FROM inventory_logs ORDER BY created_at DESC');

    await conn.end();

    res.json({
      success: true,
      items: itemsRows,
      categories: catsRows,
      warehouses: whsRows,
      units: unitsRows,
      vouchers: vouchersRows,
      voucherItems: voucherItemsRows,
      logs: logsRows,
    });
  } catch (err: any) {
    if (conn) {
      try { await conn.end(); } catch (_) {}
    }
    console.error('MySQL Fetch All Error:', err);
    res.status(400).json({
      success: false,
      message: err.message || 'Lỗi khi tải dữ liệu từ MySQL',
    });
  }
});

// 4. Save/Upsert Item
app.post('/api/mysql/save-item', async (req, res) => {
  let conn;
  try {
    const { config, item } = req.body;
    conn = await getMySQLConnection(config, true);

    const sql = `
      INSERT INTO items (id, code, name, category_id, category_name, unit_id, unit_name, warehouse_id, warehouse_name, stock_quantity, min_stock_level, max_stock_level, note, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        code = VALUES(code),
        name = VALUES(name),
        category_id = VALUES(category_id),
        category_name = VALUES(category_name),
        unit_id = VALUES(unit_id),
        unit_name = VALUES(unit_name),
        warehouse_id = VALUES(warehouse_id),
        warehouse_name = VALUES(warehouse_name),
        stock_quantity = VALUES(stock_quantity),
        min_stock_level = VALUES(min_stock_level),
        max_stock_level = VALUES(max_stock_level),
        note = VALUES(note),
        updated_at = NOW();
    `;

    await conn.execute(sql, [
      item.id,
      item.code,
      item.name,
      item.categoryId || '',
      item.categoryName || '',
      item.unitId || '',
      item.unitName || '',
      item.warehouseId || '',
      item.warehouseName || '',
      item.stockQuantity || 0,
      item.minStockLevel || 0,
      item.maxStockLevel || 100,
      item.note || '',
    ]);

    await conn.end();
    res.json({ success: true });
  } catch (err: any) {
    if (conn) { try { await conn.end(); } catch (_) {} }
    res.status(400).json({ success: false, message: err.message });
  }
});

// 5. Delete Item
app.post('/api/mysql/delete-item', async (req, res) => {
  let conn;
  try {
    const { config, id } = req.body;
    conn = await getMySQLConnection(config, true);
    await conn.execute('DELETE FROM items WHERE id = ?', [id]);
    await conn.end();
    res.json({ success: true });
  } catch (err: any) {
    if (conn) { try { await conn.end(); } catch (_) {} }
    res.status(400).json({ success: false, message: err.message });
  }
});

// 6. Save Warehouse
app.post('/api/mysql/save-warehouse', async (req, res) => {
  let conn;
  try {
    const { config, warehouse } = req.body;
    conn = await getMySQLConnection(config, true);
    const sql = `
      INSERT INTO warehouses (id, code, name, location, manager, description, is_default, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        code = VALUES(code),
        name = VALUES(name),
        location = VALUES(location),
        manager = VALUES(manager),
        description = VALUES(description),
        is_default = VALUES(is_default),
        updated_at = NOW();
    `;
    await conn.execute(sql, [
      warehouse.id,
      warehouse.code,
      warehouse.name,
      warehouse.location || '',
      warehouse.manager || '',
      warehouse.description || '',
      warehouse.isDefault ? 1 : 0,
    ]);
    await conn.end();
    res.json({ success: true });
  } catch (err: any) {
    if (conn) { try { await conn.end(); } catch (_) {} }
    res.status(400).json({ success: false, message: err.message });
  }
});

// 7. Delete Warehouse
app.post('/api/mysql/delete-warehouse', async (req, res) => {
  let conn;
  try {
    const { config, id } = req.body;
    conn = await getMySQLConnection(config, true);
    await conn.execute('DELETE FROM warehouses WHERE id = ?', [id]);
    await conn.end();
    res.json({ success: true });
  } catch (err: any) {
    if (conn) { try { await conn.end(); } catch (_) {} }
    res.status(400).json({ success: false, message: err.message });
  }
});

// 8. Save Category
app.post('/api/mysql/save-category', async (req, res) => {
  let conn;
  try {
    const { config, category } = req.body;
    conn = await getMySQLConnection(config, true);
    const sql = `
      INSERT INTO categories (id, code, name, description, updated_at)
      VALUES (?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        code = VALUES(code),
        name = VALUES(name),
        description = VALUES(description),
        updated_at = NOW();
    `;
    await conn.execute(sql, [
      category.id,
      category.code,
      category.name,
      category.description || '',
    ]);
    await conn.end();
    res.json({ success: true });
  } catch (err: any) {
    if (conn) { try { await conn.end(); } catch (_) {} }
    res.status(400).json({ success: false, message: err.message });
  }
});

// 9. Delete Category
app.post('/api/mysql/delete-category', async (req, res) => {
  let conn;
  try {
    const { config, id } = req.body;
    conn = await getMySQLConnection(config, true);
    await conn.execute('DELETE FROM categories WHERE id = ?', [id]);
    await conn.end();
    res.json({ success: true });
  } catch (err: any) {
    if (conn) { try { await conn.end(); } catch (_) {} }
    res.status(400).json({ success: false, message: err.message });
  }
});

// 10. Save Unit
app.post('/api/mysql/save-unit', async (req, res) => {
  let conn;
  try {
    const { config, unit } = req.body;
    conn = await getMySQLConnection(config, true);
    const sql = `
      INSERT INTO units (id, name, description)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        description = VALUES(description);
    `;
    await conn.execute(sql, [
      unit.id,
      unit.name,
      unit.description || '',
    ]);
    await conn.end();
    res.json({ success: true });
  } catch (err: any) {
    if (conn) { try { await conn.end(); } catch (_) {} }
    res.status(400).json({ success: false, message: err.message });
  }
});

// 11. Delete Unit
app.post('/api/mysql/delete-unit', async (req, res) => {
  let conn;
  try {
    const { config, id } = req.body;
    conn = await getMySQLConnection(config, true);
    await conn.execute('DELETE FROM units WHERE id = ?', [id]);
    await conn.end();
    res.json({ success: true });
  } catch (err: any) {
    if (conn) { try { await conn.end(); } catch (_) {} }
    res.status(400).json({ success: false, message: err.message });
  }
});

// 12. Save Voucher & Items & Logs
app.post('/api/mysql/save-voucher', async (req, res) => {
  let conn;
  try {
    const { config, voucher, logs, updatedItems } = req.body;
    conn = await getMySQLConnection(config, true);

    // Save stock_voucher
    await conn.execute(`
      INSERT INTO stock_vouchers (id, code, type, date, person, department, warehouse_id, warehouse_name, note, total_quantity)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        code = VALUES(code),
        type = VALUES(type),
        date = VALUES(date),
        person = VALUES(person),
        department = VALUES(department),
        warehouse_id = VALUES(warehouse_id),
        warehouse_name = VALUES(warehouse_name),
        note = VALUES(note),
        total_quantity = VALUES(total_quantity);
    `, [
      voucher.id,
      voucher.code,
      voucher.type,
      voucher.date,
      voucher.person || '',
      voucher.department || '',
      voucher.warehouseId || '',
      voucher.warehouseName || '',
      voucher.note || '',
      voucher.totalQuantity || 0,
    ]);

    // Save line items
    for (const vi of voucher.items || []) {
      await conn.execute(`
        INSERT INTO stock_voucher_items (voucher_id, item_id, item_code, item_name, unit_name, quantity, current_stock)
        VALUES (?, ?, ?, ?, ?, ?, ?);
      `, [
        voucher.id,
        vi.itemId,
        vi.itemCode,
        vi.itemName,
        vi.unitName,
        vi.quantity,
        vi.currentStock,
      ]);
    }

    // Save inventory_logs
    for (const log of logs || []) {
      await conn.execute(`
        INSERT INTO inventory_logs (id, voucher_id, voucher_code, type, date, item_id, item_code, item_name, category_name, warehouse_id, warehouse_name, quantity, previous_stock, new_stock, person, department, note)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          quantity = VALUES(quantity),
          previous_stock = VALUES(previous_stock),
          new_stock = VALUES(new_stock);
      `, [
        log.id,
        log.voucherId,
        log.voucherCode,
        log.type,
        log.date,
        log.itemId,
        log.itemCode,
        log.itemName,
        log.categoryName || '',
        log.warehouseId || '',
        log.warehouseName || '',
        log.quantity || 0,
        log.previousStock || 0,
        log.newStock || 0,
        log.person || '',
        log.department || '',
        log.note || '',
      ]);
    }

    // Update Items
    for (const item of updatedItems || []) {
      await conn.execute(`
        UPDATE items
        SET stock_quantity = ?, updated_at = NOW()
        WHERE id = ?;
      `, [item.stockQuantity, item.id]);
    }

    await conn.end();
    res.json({ success: true });
  } catch (err: any) {
    if (conn) { try { await conn.end(); } catch (_) {} }
    res.status(400).json({ success: false, message: err.message });
  }
});

// Vite middleware for development vs production static serve
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
