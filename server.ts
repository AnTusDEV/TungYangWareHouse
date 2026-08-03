import express from 'express';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import mssql from 'mssql';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

app.use(express.json({ limit: '10mb' }));

// --- USER & AUTH PERSISTENCE ---
interface ServerUser {
  id: string;
  username: string;
  passwordHash: string;
  fullName: string;
  position: string;
  notes?: string;
  role: 'admin' | 'user';
  status: 'active' | 'locked';
  createdAt: string;
  updatedAt?: string;
}

const USERS_FILE_PATH = path.join(process.cwd(), 'data', 'users.json');

function ensureDataDirExists() {
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function loadServerUsers(): ServerUser[] {
  ensureDataDirExists();
  if (fs.existsSync(USERS_FILE_PATH)) {
    try {
      const raw = fs.readFileSync(USERS_FILE_PATH, 'utf-8');
      const users = JSON.parse(raw);
      if (Array.isArray(users) && users.length > 0) {
        return users;
      }
    } catch (e) {
      console.error('Error reading users.json:', e);
    }
  }

  // Seed initial default users
  const defaultAdminHash = bcrypt.hashSync('admin123', 10);
  const defaultUserHash = bcrypt.hashSync('user123', 10);

  const initialUsers: ServerUser[] = [
    {
      id: 'usr_admin',
      username: 'admin',
      passwordHash: defaultAdminHash,
      fullName: 'Quản Trị Viên Hệ Thống',
      position: 'Quản trị viên',
      notes: 'Tài khoản quản trị cao nhất hệ thống',
      role: 'admin',
      status: 'active',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'usr_nhanvien',
      username: 'nhanvien',
      passwordHash: defaultUserHash,
      fullName: 'Nguyễn Văn Kho',
      position: 'Thủ kho',
      notes: 'Tài khoản nhân viên vận hành kho',
      role: 'user',
      status: 'active',
      createdAt: new Date().toISOString(),
    },
  ];

  try {
    fs.writeFileSync(USERS_FILE_PATH, JSON.stringify(initialUsers, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error writing initial users.json:', e);
  }

  return initialUsers;
}

function saveServerUsers(users: ServerUser[]) {
  ensureDataDirExists();
  try {
    fs.writeFileSync(USERS_FILE_PATH, JSON.stringify(users, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error saving users.json:', e);
  }
}

function sanitizeUser(u: ServerUser) {
  const { passwordHash, ...safe } = u;
  return safe;
}

// --- AUTH API ROUTES ---
app.post('/api/auth/login', (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu' });
    }

    const cleanUsername = String(username).trim().toLowerCase();
    const users = loadServerUsers();
    const user = users.find((u) => u.username.toLowerCase() === cleanUsername);

    if (!user) {
      return res.status(400).json({ success: false, message: 'Tên đăng nhập hoặc mật khẩu không chính xác' });
    }

    if (user.status === 'locked') {
      return res.status(400).json({ success: false, message: 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Quản trị viên!' });
    }

    const isMatch = bcrypt.compareSync(String(password), user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Tên đăng nhập hoặc mật khẩu không chính xác' });
    }

    const token = `token_${user.id}_${Date.now()}`;
    res.json({
      success: true,
      user: sanitizeUser(user),
      token,
      message: 'Đăng nhập thành công',
    });
  } catch (err: any) {
    console.error('Login Error:', err);
    res.status(500).json({ success: false, message: err.message || 'Lỗi hệ thống khi đăng nhập' });
  }
});

app.get('/api/auth/me', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, message: 'Chưa đăng nhập' });
    }
    const token = authHeader.replace('Bearer ', '').trim();
    const parts = token.split('_');
    const userId = parts[1];

    const users = loadServerUsers();
    const user = users.find((u) => u.id === userId);

    if (!user) {
      return res.status(401).json({ success: false, message: 'Tài khoản không tồn tại' });
    }

    if (user.status === 'locked') {
      return res.status(403).json({ success: false, message: 'Tài khoản đã bị khóa' });
    }

    res.json({ success: true, user: sanitizeUser(user) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/auth/profile', (req, res) => {
  try {
    const { userId, fullName, position, notes } = req.body || {};
    if (!userId) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin tài khoản' });
    }

    const users = loadServerUsers();
    const userIndex = users.findIndex((u) => u.id === userId);

    if (userIndex === -1) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    }

    users[userIndex].fullName = String(fullName || '').trim();
    users[userIndex].position = String(position || '').trim();
    users[userIndex].notes = String(notes || '').trim();
    users[userIndex].updatedAt = new Date().toISOString();

    saveServerUsers(users);

    res.json({
      success: true,
      user: sanitizeUser(users[userIndex]),
      message: 'Cập nhật thông tin cá nhân thành công',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/auth/change-password', (req, res) => {
  try {
    const { userId, currentPassword, newPassword, confirmPassword } = req.body || {};

    if (!userId || !currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ success: false, message: 'Vui lòng điền đầy đủ các trường thông tin' });
    }

    if (String(newPassword).length < 8) {
      return res.status(400).json({ success: false, message: 'Mật khẩu mới phải có tối thiểu 8 ký tự' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Xác nhận mật khẩu mới không trùng khớp' });
    }

    const users = loadServerUsers();
    const userIndex = users.findIndex((u) => u.id === userId);

    if (userIndex === -1) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản' });
    }

    const user = users[userIndex];
    const isCurrentValid = bcrypt.compareSync(String(currentPassword), user.passwordHash);

    if (!isCurrentValid) {
      return res.status(400).json({ success: false, message: 'Mật khẩu hiện tại không chính xác' });
    }

    users[userIndex].passwordHash = bcrypt.hashSync(String(newPassword), 10);
    users[userIndex].updatedAt = new Date().toISOString();

    saveServerUsers(users);

    res.json({
      success: true,
      message: 'Đổi mật khẩu thành công! Vui lòng đăng nhập lại.',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/users', (req, res) => {
  try {
    const users = loadServerUsers();
    res.json({
      success: true,
      users: users.map(sanitizeUser),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/users', (req, res) => {
  try {
    const { username, password, fullName, position, notes, role } = req.body || {};

    if (!username || !password || !fullName || !position) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập đầy đủ Tên đăng nhập, Mật khẩu, Họ tên và Chức vụ' });
    }

    const cleanUsername = String(username).trim().toLowerCase();
    if (!/^[a-zA-Z0-9_.-]+$/.test(cleanUsername)) {
      return res.status(400).json({ success: false, message: 'Tên đăng nhập chỉ chứa chữ cái, số, dấu gạch dưới hoặc gạch nối' });
    }

    if (String(password).length < 8) {
      return res.status(400).json({ success: false, message: 'Mật khẩu phải từ 8 ký tự trở lên' });
    }

    const users = loadServerUsers();
    if (users.some((u) => u.username.toLowerCase() === cleanUsername)) {
      return res.status(400).json({ success: false, message: 'Tên đăng nhập này đã tồn tại trong hệ thống' });
    }

    const newUser: ServerUser = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      username: cleanUsername,
      passwordHash: bcrypt.hashSync(String(password), 10),
      fullName: String(fullName).trim(),
      position: String(position).trim(),
      notes: notes ? String(notes).trim() : '',
      role: role === 'admin' ? 'admin' : 'user',
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    saveServerUsers(users);

    res.json({
      success: true,
      user: sanitizeUser(newUser),
      message: 'Tạo tài khoản mới thành công',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/users/:id/status', (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (status !== 'active' && status !== 'locked') {
      return res.status(400).json({ success: false, message: 'Trạng thái không hợp lệ' });
    }

    const users = loadServerUsers();
    const userIndex = users.findIndex((u) => u.id === id);

    if (userIndex === -1) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    }

    users[userIndex].status = status;
    users[userIndex].updatedAt = new Date().toISOString();
    saveServerUsers(users);

    res.json({
      success: true,
      user: sanitizeUser(users[userIndex]),
      message: status === 'locked' ? 'Đã khóa tài khoản' : 'Đã mở khóa tài khoản',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/users/:id/reset-password', (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || String(newPassword).length < 8) {
      return res.status(400).json({ success: false, message: 'Mật khẩu mới phải từ 8 ký tự trở lên' });
    }

    const users = loadServerUsers();
    const userIndex = users.findIndex((u) => u.id === id);

    if (userIndex === -1) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    }

    users[userIndex].passwordHash = bcrypt.hashSync(String(newPassword), 10);
    users[userIndex].updatedAt = new Date().toISOString();
    saveServerUsers(users);

    res.json({
      success: true,
      message: 'Đặt lại mật khẩu thành công',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/users/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, position, notes, role } = req.body;

    const users = loadServerUsers();
    const userIndex = users.findIndex((u) => u.id === id);

    if (userIndex === -1) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    }

    if (fullName) users[userIndex].fullName = String(fullName).trim();
    if (position) users[userIndex].position = String(position).trim();
    if (notes !== undefined) users[userIndex].notes = String(notes).trim();
    if (role === 'admin' || role === 'user') users[userIndex].role = role;

    users[userIndex].updatedAt = new Date().toISOString();
    saveServerUsers(users);

    res.json({
      success: true,
      user: sanitizeUser(users[userIndex]),
      message: 'Cập nhật thông tin tài khoản thành công',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/users/:id', (req, res) => {
  try {
    const { id } = req.params;
    const users = loadServerUsers();
    const filtered = users.filter((u) => u.id !== id);

    if (filtered.length === users.length) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản để xóa' });
    }

    saveServerUsers(filtered);
    res.json({ success: true, message: 'Xóa tài khoản thành công' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

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

// ==========================================
// SQL SERVER (MSSQL) ENDPOINTS
// ==========================================

async function getMSSQLPool(config: any, includeDatabase = true) {
  const host = config?.host || process.env.MSSQL_HOST || 'SERVER_LAN';
  const port = Number(config?.port || process.env.MSSQL_PORT || 1433);
  const user = config?.user || process.env.MSSQL_USER || 'antu';
  const password = config?.password !== undefined ? config.password : (process.env.MSSQL_PASSWORD || 'Ty2025@@');
  const database = config?.database || process.env.MSSQL_DATABASE || 'inventory_db';
  const encrypt = config?.encrypt === true;

  const mssqlConfig: mssql.config = {
    server: host,
    port,
    user,
    password,
    options: {
      encrypt,
      trustServerCertificate: true,
      enableArithAbort: true,
    },
    connectionTimeout: 10000,
    requestTimeout: 15000,
  };

  if (includeDatabase && database) {
    mssqlConfig.database = database;
  }

  const pool = new mssql.ConnectionPool(mssqlConfig);
  await pool.connect();
  return pool;
}

// 1. Test SQL Server Connection
app.post('/api/mssql/test', async (req, res) => {
  let pool;
  try {
    const config = req.body;
    pool = await getMSSQLPool(config, false);
    await pool.request().query('SELECT 1');

    const dbName = sanitizeIdentifier(config?.database || 'inventory_db');
    if (dbName) {
      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = N'${dbName}')
        BEGIN
          CREATE DATABASE [${dbName}];
        END
      `);
    }
    await pool.close();

    pool = await getMSSQLPool(config, true);
    await pool.request().query('SELECT 1');
    await pool.close();

    res.json({
      success: true,
      message: `Kết nối thành công tới SQL Server (${config.host || 'SERVER_LAN'}:${config.port || 1433}) - CSDL: ${config.database || 'inventory_db'}`,
    });
  } catch (err: any) {
    if (pool) {
      try { await pool.close(); } catch (_) {}
    }
    console.error('SQL Server Test Connection Error:', err);
    res.status(400).json({
      success: false,
      message: err.message || 'Không thể kết nối tới SQL Server',
      code: err.code,
    });
  }
});

// 2. Initialize SQL Server Tables
app.post('/api/mssql/init-tables', async (req, res) => {
  let pool;
  try {
    const config = req.body;
    const dbName = sanitizeIdentifier(config?.database || 'inventory_db');
    pool = await getMSSQLPool(config, false);

    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = N'${dbName}')
      BEGIN
        CREATE DATABASE [${dbName}];
      END
    `);
    await pool.close();

    pool = await getMSSQLPool(config, true);

    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = N'categories')
      CREATE TABLE categories (
        id VARCHAR(50) PRIMARY KEY,
        code VARCHAR(50) NOT NULL,
        name NVARCHAR(255) NOT NULL,
        description NVARCHAR(MAX),
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE()
      );

      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = N'warehouses')
      CREATE TABLE warehouses (
        id VARCHAR(50) PRIMARY KEY,
        code VARCHAR(50) NOT NULL,
        name NVARCHAR(255) NOT NULL,
        location NVARCHAR(MAX),
        manager NVARCHAR(255),
        description NVARCHAR(MAX),
        is_default BIT DEFAULT 0,
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE()
      );

      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = N'units')
      CREATE TABLE units (
        id VARCHAR(50) PRIMARY KEY,
        name NVARCHAR(255) NOT NULL,
        description NVARCHAR(MAX),
        created_at DATETIME DEFAULT GETDATE()
      );

      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = N'items')
      CREATE TABLE items (
        id VARCHAR(50) PRIMARY KEY,
        code VARCHAR(50) NOT NULL,
        name NVARCHAR(255) NOT NULL,
        category_id VARCHAR(50),
        category_name NVARCHAR(255),
        unit_id VARCHAR(50),
        unit_name NVARCHAR(255),
        warehouse_id VARCHAR(50),
        warehouse_name NVARCHAR(255),
        stock_quantity INT DEFAULT 0,
        min_stock_level INT DEFAULT 0,
        max_stock_level INT DEFAULT 100,
        note NVARCHAR(MAX),
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE()
      );

      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = N'stock_vouchers')
      CREATE TABLE stock_vouchers (
        id VARCHAR(50) PRIMARY KEY,
        code VARCHAR(50) NOT NULL,
        type VARCHAR(10) NOT NULL,
        date VARCHAR(20) NOT NULL,
        person NVARCHAR(255),
        department NVARCHAR(255),
        warehouse_id VARCHAR(50),
        warehouse_name NVARCHAR(255),
        note NVARCHAR(MAX),
        total_quantity INT DEFAULT 0,
        created_at DATETIME DEFAULT GETDATE()
      );

      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = N'stock_voucher_items')
      CREATE TABLE stock_voucher_items (
        id INT IDENTITY(1,1) PRIMARY KEY,
        voucher_id VARCHAR(50) NOT NULL,
        item_id VARCHAR(50) NOT NULL,
        item_code VARCHAR(50),
        item_name NVARCHAR(255),
        unit_name NVARCHAR(255),
        quantity INT DEFAULT 0,
        current_stock INT DEFAULT 0
      );

      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = N'inventory_logs')
      CREATE TABLE inventory_logs (
        id VARCHAR(50) PRIMARY KEY,
        voucher_id VARCHAR(50) NOT NULL,
        voucher_code VARCHAR(50) NOT NULL,
        type VARCHAR(10) NOT NULL,
        date VARCHAR(20) NOT NULL,
        item_id VARCHAR(50) NOT NULL,
        item_code VARCHAR(50),
        item_name NVARCHAR(255),
        category_name NVARCHAR(255),
        warehouse_id VARCHAR(50),
        warehouse_name NVARCHAR(255),
        quantity INT DEFAULT 0,
        previous_stock INT DEFAULT 0,
        new_stock INT DEFAULT 0,
        person NVARCHAR(255),
        department NVARCHAR(255),
        note NVARCHAR(MAX),
        created_at DATETIME DEFAULT GETDATE()
      );
    `);

    await pool.close();

    res.json({
      success: true,
      message: `Khởi tạo bảng SQL Server thành công trong CSDL '${dbName}'!`,
    });
  } catch (err: any) {
    if (pool) {
      try { await pool.close(); } catch (_) {}
    }
    console.error('SQL Server Init Tables Error:', err);
    res.status(400).json({
      success: false,
      message: err.message || 'Không thể khởi tạo bảng trên SQL Server',
    });
  }
});

// 3. Fetch All Data SQL Server
app.post('/api/mssql/fetch-all', async (req, res) => {
  let pool;
  try {
    const config = req.body;
    pool = await getMSSQLPool(config, true);

    const itemsRes = await pool.request().query('SELECT * FROM items ORDER BY updated_at DESC');
    const catsRes = await pool.request().query('SELECT * FROM categories ORDER BY created_at ASC');
    const whsRes = await pool.request().query('SELECT * FROM warehouses ORDER BY created_at ASC');
    const unitsRes = await pool.request().query('SELECT * FROM units ORDER BY created_at ASC');
    const vouchersRes = await pool.request().query('SELECT * FROM stock_vouchers ORDER BY created_at DESC');
    const voucherItemsRes = await pool.request().query('SELECT * FROM stock_voucher_items');
    const logsRes = await pool.request().query('SELECT * FROM inventory_logs ORDER BY created_at DESC');

    await pool.close();

    res.json({
      success: true,
      items: itemsRes.recordset,
      categories: catsRes.recordset,
      warehouses: whsRes.recordset,
      units: unitsRes.recordset,
      vouchers: vouchersRes.recordset,
      voucherItems: voucherItemsRes.recordset,
      logs: logsRes.recordset,
    });
  } catch (err: any) {
    if (pool) {
      try { await pool.close(); } catch (_) {}
    }
    console.error('SQL Server Fetch All Error:', err);
    res.status(400).json({
      success: false,
      message: err.message || 'Lỗi khi tải dữ liệu từ SQL Server',
    });
  }
});

// 4. Save Item SQL Server
app.post('/api/mssql/save-item', async (req, res) => {
  let pool;
  try {
    const { config, item } = req.body;
    pool = await getMSSQLPool(config, true);

    const request = pool.request();
    request.input('id', mssql.VarChar(50), item.id);
    request.input('code', mssql.VarChar(50), item.code);
    request.input('name', mssql.NVarChar(255), item.name);
    request.input('category_id', mssql.VarChar(50), item.categoryId || '');
    request.input('category_name', mssql.NVarChar(255), item.categoryName || '');
    request.input('unit_id', mssql.VarChar(50), item.unitId || '');
    request.input('unit_name', mssql.NVarChar(255), item.unitName || '');
    request.input('warehouse_id', mssql.VarChar(50), item.warehouseId || '');
    request.input('warehouse_name', mssql.NVarChar(255), item.warehouseName || '');
    request.input('stock_quantity', mssql.Int, item.stockQuantity || 0);
    request.input('min_stock_level', mssql.Int, item.minStockLevel || 0);
    request.input('max_stock_level', mssql.Int, item.maxStockLevel || 100);
    request.input('note', mssql.NVarChar(mssql.MAX), item.note || '');

    await request.query(`
      IF EXISTS (SELECT 1 FROM items WHERE id = @id)
      BEGIN
        UPDATE items SET
          code = @code,
          name = @name,
          category_id = @category_id,
          category_name = @category_name,
          unit_id = @unit_id,
          unit_name = @unit_name,
          warehouse_id = @warehouse_id,
          warehouse_name = @warehouse_name,
          stock_quantity = @stock_quantity,
          min_stock_level = @min_stock_level,
          max_stock_level = @max_stock_level,
          note = @note,
          updated_at = GETDATE()
        WHERE id = @id;
      END
      ELSE
      BEGIN
        INSERT INTO items (id, code, name, category_id, category_name, unit_id, unit_name, warehouse_id, warehouse_name, stock_quantity, min_stock_level, max_stock_level, note, created_at, updated_at)
        VALUES (@id, @code, @name, @category_id, @category_name, @unit_id, @unit_name, @warehouse_id, @warehouse_name, @stock_quantity, @min_stock_level, @max_stock_level, @note, GETDATE(), GETDATE());
      END
    `);

    await pool.close();
    res.json({ success: true });
  } catch (err: any) {
    if (pool) { try { await pool.close(); } catch (_) {} }
    res.status(400).json({ success: false, message: err.message });
  }
});

// 5. Delete Item SQL Server
app.post('/api/mssql/delete-item', async (req, res) => {
  let pool;
  try {
    const { config, id } = req.body;
    pool = await getMSSQLPool(config, true);
    const request = pool.request();
    request.input('id', mssql.VarChar(50), id);
    await request.query('DELETE FROM items WHERE id = @id');
    await pool.close();
    res.json({ success: true });
  } catch (err: any) {
    if (pool) { try { await pool.close(); } catch (_) {} }
    res.status(400).json({ success: false, message: err.message });
  }
});

// 6. Save Warehouse SQL Server
app.post('/api/mssql/save-warehouse', async (req, res) => {
  let pool;
  try {
    const { config, warehouse } = req.body;
    pool = await getMSSQLPool(config, true);

    const request = pool.request();
    request.input('id', mssql.VarChar(50), warehouse.id);
    request.input('code', mssql.VarChar(50), warehouse.code);
    request.input('name', mssql.NVarChar(255), warehouse.name);
    request.input('location', mssql.NVarChar(mssql.MAX), warehouse.location || '');
    request.input('manager', mssql.NVarChar(255), warehouse.manager || '');
    request.input('description', mssql.NVarChar(mssql.MAX), warehouse.description || '');
    request.input('is_default', mssql.Bit, warehouse.isDefault ? 1 : 0);

    await request.query(`
      IF EXISTS (SELECT 1 FROM warehouses WHERE id = @id)
      BEGIN
        UPDATE warehouses SET
          code = @code,
          name = @name,
          location = @location,
          manager = @manager,
          description = @description,
          is_default = @is_default,
          updated_at = GETDATE()
        WHERE id = @id;
      END
      ELSE
      BEGIN
        INSERT INTO warehouses (id, code, name, location, manager, description, is_default, created_at, updated_at)
        VALUES (@id, @code, @name, @location, @manager, @description, @is_default, GETDATE(), GETDATE());
      END
    `);

    await pool.close();
    res.json({ success: true });
  } catch (err: any) {
    if (pool) { try { await pool.close(); } catch (_) {} }
    res.status(400).json({ success: false, message: err.message });
  }
});

// 7. Delete Warehouse SQL Server
app.post('/api/mssql/delete-warehouse', async (req, res) => {
  let pool;
  try {
    const { config, id } = req.body;
    pool = await getMSSQLPool(config, true);
    const request = pool.request();
    request.input('id', mssql.VarChar(50), id);
    await request.query('DELETE FROM warehouses WHERE id = @id');
    await pool.close();
    res.json({ success: true });
  } catch (err: any) {
    if (pool) { try { await pool.close(); } catch (_) {} }
    res.status(400).json({ success: false, message: err.message });
  }
});

// 8. Save Category SQL Server
app.post('/api/mssql/save-category', async (req, res) => {
  let pool;
  try {
    const { config, category } = req.body;
    pool = await getMSSQLPool(config, true);

    const request = pool.request();
    request.input('id', mssql.VarChar(50), category.id);
    request.input('code', mssql.VarChar(50), category.code);
    request.input('name', mssql.NVarChar(255), category.name);
    request.input('description', mssql.NVarChar(mssql.MAX), category.description || '');

    await request.query(`
      IF EXISTS (SELECT 1 FROM categories WHERE id = @id)
      BEGIN
        UPDATE categories SET
          code = @code,
          name = @name,
          description = @description,
          updated_at = GETDATE()
        WHERE id = @id;
      END
      ELSE
      BEGIN
        INSERT INTO categories (id, code, name, description, created_at, updated_at)
        VALUES (@id, @code, @name, @description, GETDATE(), GETDATE());
      END
    `);

    await pool.close();
    res.json({ success: true });
  } catch (err: any) {
    if (pool) { try { await pool.close(); } catch (_) {} }
    res.status(400).json({ success: false, message: err.message });
  }
});

// 9. Delete Category SQL Server
app.post('/api/mssql/delete-category', async (req, res) => {
  let pool;
  try {
    const { config, id } = req.body;
    pool = await getMSSQLPool(config, true);
    const request = pool.request();
    request.input('id', mssql.VarChar(50), id);
    await request.query('DELETE FROM categories WHERE id = @id');
    await pool.close();
    res.json({ success: true });
  } catch (err: any) {
    if (pool) { try { await pool.close(); } catch (_) {} }
    res.status(400).json({ success: false, message: err.message });
  }
});

// 10. Save Unit SQL Server
app.post('/api/mssql/save-unit', async (req, res) => {
  let pool;
  try {
    const { config, unit } = req.body;
    pool = await getMSSQLPool(config, true);

    const request = pool.request();
    request.input('id', mssql.VarChar(50), unit.id);
    request.input('name', mssql.NVarChar(255), unit.name);
    request.input('description', mssql.NVarChar(mssql.MAX), unit.description || '');

    await request.query(`
      IF EXISTS (SELECT 1 FROM units WHERE id = @id)
      BEGIN
        UPDATE units SET
          name = @name,
          description = @description
        WHERE id = @id;
      END
      ELSE
      BEGIN
        INSERT INTO units (id, name, description, created_at)
        VALUES (@id, @name, @description, GETDATE());
      END
    `);

    await pool.close();
    res.json({ success: true });
  } catch (err: any) {
    if (pool) { try { await pool.close(); } catch (_) {} }
    res.status(400).json({ success: false, message: err.message });
  }
});

// 11. Delete Unit SQL Server
app.post('/api/mssql/delete-unit', async (req, res) => {
  let pool;
  try {
    const { config, id } = req.body;
    pool = await getMSSQLPool(config, true);
    const request = pool.request();
    request.input('id', mssql.VarChar(50), id);
    await request.query('DELETE FROM units WHERE id = @id');
    await pool.close();
    res.json({ success: true });
  } catch (err: any) {
    if (pool) { try { await pool.close(); } catch (_) {} }
    res.status(400).json({ success: false, message: err.message });
  }
});

// 12. Save Voucher & Items & Logs SQL Server
app.post('/api/mssql/save-voucher', async (req, res) => {
  let pool;
  try {
    const { config, voucher, logs, updatedItems } = req.body;
    pool = await getMSSQLPool(config, true);

    const reqV = pool.request();
    reqV.input('id', mssql.VarChar(50), voucher.id);
    reqV.input('code', mssql.VarChar(50), voucher.code);
    reqV.input('type', mssql.VarChar(10), voucher.type);
    reqV.input('date', mssql.VarChar(20), voucher.date);
    reqV.input('person', mssql.NVarChar(255), voucher.person || '');
    reqV.input('department', mssql.NVarChar(255), voucher.department || '');
    reqV.input('warehouse_id', mssql.VarChar(50), voucher.warehouseId || '');
    reqV.input('warehouse_name', mssql.NVarChar(255), voucher.warehouseName || '');
    reqV.input('note', mssql.NVarChar(mssql.MAX), voucher.note || '');
    reqV.input('total_quantity', mssql.Int, voucher.totalQuantity || 0);

    await reqV.query(`
      IF EXISTS (SELECT 1 FROM stock_vouchers WHERE id = @id)
      BEGIN
        UPDATE stock_vouchers SET
          code = @code,
          type = @type,
          date = @date,
          person = @person,
          department = @department,
          warehouse_id = @warehouse_id,
          warehouse_name = @warehouse_name,
          note = @note,
          total_quantity = @total_quantity
        WHERE id = @id;
      END
      ELSE
      BEGIN
        INSERT INTO stock_vouchers (id, code, type, date, person, department, warehouse_id, warehouse_name, note, total_quantity, created_at)
        VALUES (@id, @code, @type, @date, @person, @department, @warehouse_id, @warehouse_name, @note, @total_quantity, GETDATE());
      END
    `);

    for (const vi of voucher.items || []) {
      const reqItem = pool.request();
      reqItem.input('voucher_id', mssql.VarChar(50), voucher.id);
      reqItem.input('item_id', mssql.VarChar(50), vi.itemId);
      reqItem.input('item_code', mssql.VarChar(50), vi.itemCode || '');
      reqItem.input('item_name', mssql.NVarChar(255), vi.itemName || '');
      reqItem.input('unit_name', mssql.NVarChar(255), vi.unitName || '');
      reqItem.input('quantity', mssql.Int, vi.quantity || 0);
      reqItem.input('current_stock', mssql.Int, vi.currentStock || 0);

      await reqItem.query(`
        INSERT INTO stock_voucher_items (voucher_id, item_id, item_code, item_name, unit_name, quantity, current_stock)
        VALUES (@voucher_id, @item_id, @item_code, @item_name, @unit_name, @quantity, @current_stock);
      `);
    }

    for (const log of logs || []) {
      const reqLog = pool.request();
      reqLog.input('id', mssql.VarChar(50), log.id);
      reqLog.input('voucher_id', mssql.VarChar(50), log.voucherId);
      reqLog.input('voucher_code', mssql.VarChar(50), log.voucherCode);
      reqLog.input('type', mssql.VarChar(10), log.type);
      reqLog.input('date', mssql.VarChar(20), log.date);
      reqLog.input('item_id', mssql.VarChar(50), log.itemId);
      reqLog.input('item_code', mssql.VarChar(50), log.itemCode || '');
      reqLog.input('item_name', mssql.NVarChar(255), log.itemName || '');
      reqLog.input('category_name', mssql.NVarChar(255), log.categoryName || '');
      reqLog.input('warehouse_id', mssql.VarChar(50), log.warehouseId || '');
      reqLog.input('warehouse_name', mssql.NVarChar(255), log.warehouseName || '');
      reqLog.input('quantity', mssql.Int, log.quantity || 0);
      reqLog.input('previous_stock', mssql.Int, log.previousStock || 0);
      reqLog.input('new_stock', mssql.Int, log.newStock || 0);
      reqLog.input('person', mssql.NVarChar(255), log.person || '');
      reqLog.input('department', mssql.NVarChar(255), log.department || '');
      reqLog.input('note', mssql.NVarChar(mssql.MAX), log.note || '');

      await reqLog.query(`
        IF EXISTS (SELECT 1 FROM inventory_logs WHERE id = @id)
        BEGIN
          UPDATE inventory_logs SET
            quantity = @quantity,
            previous_stock = @previous_stock,
            new_stock = @new_stock
          WHERE id = @id;
        END
        ELSE
        BEGIN
          INSERT INTO inventory_logs (id, voucher_id, voucher_code, type, date, item_id, item_code, item_name, category_name, warehouse_id, warehouse_name, quantity, previous_stock, new_stock, person, department, note, created_at)
          VALUES (@id, @voucher_id, @voucher_code, @type, @date, @item_id, @item_code, @item_name, @category_name, @warehouse_id, @warehouse_name, @quantity, @previous_stock, @new_stock, @person, @department, @note, GETDATE());
        END
      `);
    }

    for (const item of updatedItems || []) {
      const reqStock = pool.request();
      reqStock.input('id', mssql.VarChar(50), item.id);
      reqStock.input('stock_quantity', mssql.Int, item.stockQuantity || 0);

      await reqStock.query(`
        UPDATE items
        SET stock_quantity = @stock_quantity, updated_at = GETDATE()
        WHERE id = @id;
      `);
    }

    await pool.close();
    res.json({ success: true });
  } catch (err: any) {
    if (pool) { try { await pool.close(); } catch (_) {} }
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
