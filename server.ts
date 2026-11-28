import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
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

function sanitizeUser(u: ServerUser) {
  const { passwordHash, ...safe } = u;
  return safe;
}

function hashPasswordIfNeeded(pass: string): string {
  if (!pass) return bcrypt.hashSync('12345678', 10);
  if (pass.startsWith('$2a$') || pass.startsWith('$2b$')) {
    return pass;
  }
  return bcrypt.hashSync(pass, 10);
}

function mapDbRowToUser(row: any): ServerUser {
  const isLocked =
    String(row.status || '').trim().toLowerCase() === 'locked' ||
    row.is_active === false ||
    row.is_active === 0 ||
    String(row.is_active || '').trim().toLowerCase() === 'false';

  return {
    id: String(row.id || '').trim(),
    username: String(row.username || '').trim(),
    passwordHash: String(row.password_hash || row.password || '').trim(),
    fullName: String(row.full_name || row.fullName || ''),
    position: String(row.position || ''),
    notes: String(row.notes || ''),
    role: String(row.role || '').trim().toLowerCase() === 'admin' ? 'admin' : 'user',
    status: isLocked ? 'locked' : 'active',
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
  };
}

class DbConnectionError extends Error {
  statusCode = 503;
  constructor(message: string) {
    super(message);
    this.name = 'DbConnectionError';
  }
}

function extractMssqlConfig(req: express.Request): any {
  if (req.body && typeof req.body === 'object' && req.body.config) {
    return req.body.config;
  }
  const headerRaw = req.headers['x-mssql-config'];
  if (typeof headerRaw === 'string' && headerRaw.trim()) {
    try {
      return JSON.parse(decodeURIComponent(headerRaw));
    } catch {
      try {
        return JSON.parse(headerRaw);
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

async function getDbClient(config?: any): Promise<mssql.ConnectionPool> {
  const useCustom = Boolean(config?.isCustom && config?.host);
  const effectiveConfig = useCustom
    ? config
    : process.env.MSSQL_HOST
      ? {}
      : (config || {});

  const targetHost = effectiveConfig?.host || process.env.MSSQL_HOST || 'SERVER_LAN';
  const targetPort = Number(effectiveConfig?.port || process.env.MSSQL_PORT || 1433);
  const targetDb = effectiveConfig?.database || process.env.MSSQL_DATABASE || 'inventory_db_test';

  if (!targetHost) {
    throw new DbConnectionError('Chưa cấu hình máy chủ cơ sở dữ liệu SQL Server.');
  }

  try {
    return await getMSSQLPool(effectiveConfig, true);
  } catch (err: any) {
    throw new DbConnectionError(
      `Không thể kết nối tới cơ sở dữ liệu SQL Server (${targetHost}:${targetPort}/${targetDb}): ${err?.message || 'Lỗi kết nối'}`
    );
  }
}

async function ensureUsersTable(pool: mssql.ConnectionPool) {
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = N'users')
    BEGIN
      CREATE TABLE users (
        id VARCHAR(50) PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        password_hash NVARCHAR(255) NOT NULL,
        full_name NVARCHAR(255) NOT NULL,
        position NVARCHAR(255),
        notes NVARCHAR(MAX),
        role VARCHAR(20) DEFAULT 'user',
        status VARCHAR(20) DEFAULT 'active',
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE()
      );
    END

    BEGIN TRY
      IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'users') AND name = N'password')
        ALTER TABLE users ALTER COLUMN password NVARCHAR(255) NULL;

      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'users') AND name = N'password_hash')
        ALTER TABLE users ADD password_hash NVARCHAR(255) NULL;

      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'users') AND name = N'role')
        ALTER TABLE users ADD role VARCHAR(20) DEFAULT 'user';

      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'users') AND name = N'status')
        ALTER TABLE users ADD status VARCHAR(20) DEFAULT 'active';
    END TRY
    BEGIN CATCH
    END CATCH
  `);
}

async function findUserByUsernameFromDb(username: string, config?: any): Promise<ServerUser | null> {
  const cleanUsername = username.trim().toLowerCase();
  const pool = await getDbClient(config);

  try {
    await ensureUsersTable(pool);
    const req = pool.request();
    req.input('username', mssql.VarChar(50), cleanUsername);
    const res = await req.query('SELECT * FROM users WHERE LOWER(LTRIM(RTRIM(username))) = @username');
    if (res.recordset && res.recordset.length > 0) return mapDbRowToUser(res.recordset[0]);
    return null;
  } finally {
    await pool.close().catch(() => { });
  }
}

async function findUserByIdFromDb(userId: string, config?: any): Promise<ServerUser | null> {
  const cleanId = String(userId).trim();
  const pool = await getDbClient(config);

  try {
    await ensureUsersTable(pool);
    const req = pool.request();
    req.input('id', mssql.VarChar(50), cleanId);
    const res = await req.query('SELECT * FROM users WHERE LTRIM(RTRIM(id)) = @id');
    if (res.recordset && res.recordset.length > 0) return mapDbRowToUser(res.recordset[0]);
    return null;
  } finally {
    await pool.close().catch(() => { });
  }
}

async function getAllUsersFromDb(config?: any): Promise<ServerUser[]> {
  const pool = await getDbClient(config);

  try {
    await ensureUsersTable(pool);
    const res = await pool.request().query('SELECT * FROM users ORDER BY created_at ASC');
    return (res.recordset || []).map(mapDbRowToUser);
  } finally {
    await pool.close().catch(() => { });
  }
}

async function saveUserToDb(user: {
  id: string;
  username: string;
  fullName: string;
  position?: string;
  notes?: string;
  role?: 'admin' | 'user';
  status?: 'active' | 'locked';
  passwordHash?: string;
  password?: string;
}, config?: any): Promise<void> {
  const cleanUsername = user.username.trim().toLowerCase();
  const rawPass = user.passwordHash || user.password;
  const hashToUse = rawPass ? hashPasswordIfNeeded(rawPass) : undefined;

  const pool = await getDbClient(config);

  try {
    await ensureUsersTable(pool);
    const req = pool.request();
    req.input('id', mssql.VarChar(50), user.id);
    req.input('username', mssql.VarChar(50), cleanUsername);
    req.input('full_name', mssql.NVarChar(255), user.fullName);
    req.input('position', mssql.NVarChar(255), user.position || '');
    req.input('notes', mssql.NVarChar(mssql.MAX), user.notes || '');
    req.input('role', mssql.VarChar(20), user.role || 'user');
    req.input('status', mssql.VarChar(20), user.status || 'active');

    if (hashToUse) {
      req.input('password_hash', mssql.NVarChar(255), hashToUse);
      await req.query(`
        IF EXISTS (SELECT 1 FROM users WHERE id = @id)
        BEGIN
          UPDATE users SET
            username = @username,
            password_hash = @password_hash,
            full_name = @full_name,
            position = @position,
            notes = @notes,
            role = @role,
            status = @status,
            updated_at = GETDATE()
          WHERE id = @id;
        END
        ELSE
        BEGIN
          INSERT INTO users (id, username, password_hash, full_name, position, notes, role, status, created_at, updated_at)
          VALUES (@id, @username, @password_hash, @full_name, @position, @notes, @role, @status, GETDATE(), GETDATE());
        END
      `);
    } else {
      await req.query(`
        IF EXISTS (SELECT 1 FROM users WHERE id = @id)
        BEGIN
          UPDATE users SET
            username = @username,
            full_name = @full_name,
            position = @position,
            notes = @notes,
            role = @role,
            status = @status,
            updated_at = GETDATE()
          WHERE id = @id;
        END
        ELSE
        BEGIN
          INSERT INTO users (id, username, password_hash, full_name, position, notes, role, status, created_at, updated_at)
          VALUES (@id, @username, N'', @full_name, @position, @notes, @role, @status, GETDATE(), GETDATE());
        END
      `);
    }
  } finally {
    await pool.close().catch(() => { });
  }
}

async function deleteUserFromDb(userId: string, config?: any): Promise<void> {
  const cleanId = String(userId).trim();
  const pool = await getDbClient(config);

  try {
    await ensureUsersTable(pool);
    const req = pool.request();
    req.input('id', mssql.VarChar(50), cleanId);
    await req.query('DELETE FROM users WHERE LTRIM(RTRIM(id)) = @id');
  } finally {
    await pool.close().catch(() => { });
  }
}

async function updateUserPasswordInDb(userId: string, newPasswordPlain: string, config?: any): Promise<void> {
  const cleanId = String(userId).trim();
  const passwordHash = hashPasswordIfNeeded(newPasswordPlain);
  const pool = await getDbClient(config);

  try {
    await ensureUsersTable(pool);
    const req = pool.request();
    req.input('id', mssql.VarChar(50), cleanId);
    req.input('password_hash', mssql.NVarChar(255), passwordHash);
    await req.query('UPDATE users SET password_hash = @password_hash, updated_at = GETDATE() WHERE LTRIM(RTRIM(id)) = @id');
  } finally {
    await pool.close().catch(() => { });
  }
}

async function updateUserStatusInDb(userId: string, status: 'active' | 'locked', config?: any): Promise<void> {
  const cleanId = String(userId).trim();
  const pool = await getDbClient(config);

  try {
    await ensureUsersTable(pool);
    const req = pool.request();
    req.input('id', mssql.VarChar(50), cleanId);
    req.input('status', mssql.VarChar(20), status);
    req.input('is_active', mssql.Bit, status === 'active' ? 1 : 0);
    await req.query(`
      UPDATE users SET status = @status, updated_at = GETDATE() WHERE LTRIM(RTRIM(id)) = @id;
      IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'users') AND name = N'is_active')
      BEGIN
        UPDATE users SET is_active = @is_active WHERE LTRIM(RTRIM(id)) = @id;
      END
    `);
  } finally {
    await pool.close().catch(() => { });
  }
}

async function updateUserProfileInDb(userId: string, data: { fullName?: string; position?: string; notes?: string; role?: 'admin' | 'user' }, config?: any): Promise<void> {
  const cleanId = String(userId).trim();
  const pool = await getDbClient(config);

  try {
    await ensureUsersTable(pool);
    const req = pool.request();
    req.input('id', mssql.VarChar(50), cleanId);
    const updates: string[] = ['updated_at = GETDATE()'];
    if (data.fullName !== undefined) { req.input('full_name', mssql.NVarChar(255), data.fullName); updates.push('full_name = @full_name'); }
    if (data.position !== undefined) { req.input('position', mssql.NVarChar(255), data.position); updates.push('position = @position'); }
    if (data.notes !== undefined) { req.input('notes', mssql.NVarChar(mssql.MAX), data.notes); updates.push('notes = @notes'); }
    if (data.role !== undefined) { req.input('role', mssql.VarChar(20), data.role); updates.push('role = @role'); }

    await req.query(`UPDATE users SET ${updates.join(', ')} WHERE LTRIM(RTRIM(id)) = @id`);
  } finally {
    await pool.close().catch(() => { });
  }
}

// --- AUTH API ROUTES ---
app.post('/api/auth/login', async (req, res) => {
  try {
    const dbConfig = extractMssqlConfig(req);
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu' });
    }

    const cleanUsername = String(username).trim().toLowerCase();
    const user = await findUserByUsernameFromDb(cleanUsername, dbConfig);

    if (!user) {
      return res.status(400).json({ success: false, message: 'Tên đăng nhập hoặc mật khẩu không chính xác' });
    }

    if (user.status === 'locked') {
      return res.status(400).json({ success: false, message: 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Quản trị viên!' });
    }

    let isMatch = false;
    if (
      user.passwordHash &&
      (user.passwordHash.startsWith('$2a$') || user.passwordHash.startsWith('$2b$') || user.passwordHash.startsWith('$2y$'))
    ) {
      isMatch = bcrypt.compareSync(String(password), user.passwordHash);
    } else if (user.passwordHash && user.passwordHash === String(password)) {
      isMatch = true;
      await updateUserPasswordInDb(user.id, String(password), dbConfig).catch(() => { });
    }

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
    res.status(err?.statusCode || 500).json({ success: false, message: err.message || 'Lỗi hệ thống khi đăng nhập' });
  }
});

app.get('/api/auth/me', async (req, res) => {
  try {
    const dbConfig = extractMssqlConfig(req);
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, message: 'Chưa đăng nhập' });
    }
    const token = authHeader.replace('Bearer ', '').trim();
    const parts = token.split('_');
    const userId = parts[1];

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Token không hợp lệ' });
    }

    const user = await findUserByIdFromDb(userId, dbConfig);

    if (!user) {
      return res.status(401).json({ success: false, message: 'Tài khoản không tồn tại' });
    }

    if (user.status === 'locked') {
      return res.status(403).json({ success: false, message: 'Tài khoản đã bị khóa' });
    }

    res.json({ success: true, user: sanitizeUser(user) });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({ success: false, message: err.message });
  }
});

app.put('/api/auth/profile', async (req, res) => {
  try {
    const dbConfig = extractMssqlConfig(req);
    const { userId, fullName, position, notes } = req.body || {};
    if (!userId) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin tài khoản' });
    }

    const user = await findUserByIdFromDb(userId, dbConfig);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    }

    await updateUserProfileInDb(userId, {
      fullName: String(fullName || '').trim(),
      position: String(position || '').trim(),
      notes: String(notes || '').trim(),
    }, dbConfig);

    const updatedUser = await findUserByIdFromDb(userId, dbConfig);

    res.json({
      success: true,
      user: sanitizeUser(updatedUser!),
      message: 'Cập nhật thông tin cá nhân thành công',
    });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({ success: false, message: err.message });
  }
});

app.put('/api/auth/change-password', async (req, res) => {
  try {
    const dbConfig = extractMssqlConfig(req);
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

    const user = await findUserByIdFromDb(userId, dbConfig);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản' });
    }

    let isCurrentValid = false;
    if (user.passwordHash && (user.passwordHash.startsWith('$2a$') || user.passwordHash.startsWith('$2b$'))) {
      isCurrentValid = bcrypt.compareSync(String(currentPassword), user.passwordHash);
    } else {
      isCurrentValid = user.passwordHash === String(currentPassword);
    }

    if (!isCurrentValid) {
      return res.status(400).json({ success: false, message: 'Mật khẩu hiện tại không chính xác' });
    }

    await updateUserPasswordInDb(userId, String(newPassword), dbConfig);

    res.json({
      success: true,
      message: 'Đổi mật khẩu thành công! Vui lòng đăng nhập lại.',
    });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({ success: false, message: err.message });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const dbConfig = extractMssqlConfig(req);
    const users = await getAllUsersFromDb(dbConfig);

    res.json({
      success: true,
      users: users.map(sanitizeUser),
    });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({ success: false, message: err.message });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const dbConfig = extractMssqlConfig(req);
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

    const existing = await findUserByUsernameFromDb(cleanUsername, dbConfig);
    if (existing) {
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

    await saveUserToDb(newUser, dbConfig);

    res.json({
      success: true,
      user: sanitizeUser(newUser),
      message: 'Tạo tài khoản mới thành công',
    });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({ success: false, message: err.message });
  }
});

app.put('/api/users/:id/status', async (req, res) => {
  try {
    const dbConfig = extractMssqlConfig(req);
    const { id } = req.params;
    const { status } = req.body;

    if (status !== 'active' && status !== 'locked') {
      return res.status(400).json({ success: false, message: 'Trạng thái không hợp lệ' });
    }

    const user = await findUserByIdFromDb(id, dbConfig);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    }

    await updateUserStatusInDb(id, status, dbConfig);
    const updatedUser = await findUserByIdFromDb(id, dbConfig);

    res.json({
      success: true,
      user: sanitizeUser(updatedUser!),
      message: status === 'locked' ? 'Đã khóa tài khoản' : 'Đã mở khóa tài khoản',
    });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({ success: false, message: err.message });
  }
});

app.put('/api/users/:id/reset-password', async (req, res) => {
  try {
    const dbConfig = extractMssqlConfig(req);
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || String(newPassword).length < 8) {
      return res.status(400).json({ success: false, message: 'Mật khẩu mới phải từ 8 ký tự trở lên' });
    }

    const user = await findUserByIdFromDb(id, dbConfig);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    }

    await updateUserPasswordInDb(id, String(newPassword), dbConfig);

    res.json({
      success: true,
      message: 'Đặt lại mật khẩu thành công',
    });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({ success: false, message: err.message });
  }
});

app.put('/api/users/:id', async (req, res) => {
  try {
    const dbConfig = extractMssqlConfig(req);
    const { id } = req.params;
    const { fullName, position, notes, role } = req.body;

    const user = await findUserByIdFromDb(id, dbConfig);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    }

    await updateUserProfileInDb(id, {
      fullName: fullName ? String(fullName).trim() : undefined,
      position: position ? String(position).trim() : undefined,
      notes: notes !== undefined ? String(notes).trim() : undefined,
      role: (role === 'admin' || role === 'user') ? role : undefined,
    }, dbConfig);

    const updatedUser = await findUserByIdFromDb(id, dbConfig);

    res.json({
      success: true,
      user: sanitizeUser(updatedUser!),
      message: 'Cập nhật thông tin tài khoản thành công',
    });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({ success: false, message: err.message });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    const dbConfig = extractMssqlConfig(req);
    const { id } = req.params;
    const user = await findUserByIdFromDb(id, dbConfig);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản để xóa' });
    }

    await deleteUserFromDb(id, dbConfig);

    res.json({ success: true, message: 'Xóa tài khoản thành công' });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({ success: false, message: err.message });
  }
});

// Helper to sanitize database names
function sanitizeIdentifier(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, '');
}

// ==========================================
// SQL SERVER (MSSQL) ENDPOINTS
// ==========================================

async function getMSSQLPool(config: any, includeDatabase = true) {
  const useCustom = Boolean(config?.isCustom && config?.host);
  const effectiveConfig = useCustom
    ? config
    : process.env.MSSQL_HOST
      ? {}
      : (config || {});

  const host = effectiveConfig?.host || process.env.MSSQL_HOST || 'SERVER_LAN';
  const port = Number(effectiveConfig?.port || process.env.MSSQL_PORT || 1433);
  const user = effectiveConfig?.user || process.env.MSSQL_USER || 'antu';
  const password = effectiveConfig?.password !== undefined ? effectiveConfig.password : (process.env.MSSQL_PASSWORD || '');
  const database = effectiveConfig?.database || process.env.MSSQL_DATABASE || 'inventory_db_test';
  const encrypt = effectiveConfig?.encrypt === true;

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
    connectionTimeout: 3000,
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
    const config = { ...(req.body || {}), isCustom: true };
    pool = await getMSSQLPool(config, false);
    await pool.request().query('SELECT 1');

    const dbName = sanitizeIdentifier(config?.database || 'inventory_db_test');
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
      message: `Kết nối thành công tới SQL Server (${config.host || 'SERVER_LAN'}:${config.port || 1433}) - CSDL: ${config.database || 'inventory_db_test'}`,
    });
  } catch (err: any) {
    if (pool) {
      try { await pool.close(); } catch (_) { }
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
    const config = { ...(req.body || {}), isCustom: true };
    const dbName = sanitizeIdentifier(config?.database || 'inventory_db_test');
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

      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = N'departments')
      CREATE TABLE departments (
        id VARCHAR(50) PRIMARY KEY,
        code VARCHAR(50) NOT NULL,
        name NVARCHAR(255) NOT NULL,
        manager NVARCHAR(255),
        phone VARCHAR(50),
        description NVARCHAR(MAX),
        status VARCHAR(20) DEFAULT 'active',
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE()
      );

      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = N'users')
      CREATE TABLE users (
        id VARCHAR(50) PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        password_hash NVARCHAR(255) NOT NULL,
        full_name NVARCHAR(255) NOT NULL,
        position NVARCHAR(255),
        notes NVARCHAR(MAX),
        role VARCHAR(20) DEFAULT 'user',
        status VARCHAR(20) DEFAULT 'active',
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE()
      );

      -- Ensure columns exist on pre-existing tables
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'warehouses') AND name = N'is_default')
        ALTER TABLE warehouses ADD is_default BIT DEFAULT 0;

      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'items') AND name = N'min_stock_level')
        ALTER TABLE items ADD min_stock_level INT DEFAULT 0;

      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'items') AND name = N'max_stock_level')
        ALTER TABLE items ADD max_stock_level INT DEFAULT 100;

      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'items') AND name = N'note')
        ALTER TABLE items ADD note NVARCHAR(MAX);

      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'stock_vouchers') AND name = N'department')
        ALTER TABLE stock_vouchers ADD department NVARCHAR(255);

      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'stock_vouchers') AND name = N'note')
        ALTER TABLE stock_vouchers ADD note NVARCHAR(MAX);

      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'stock_vouchers') AND name = N'total_quantity')
        ALTER TABLE stock_vouchers ADD total_quantity INT DEFAULT 0;

      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'stock_voucher_items') AND name = N'current_stock')
        ALTER TABLE stock_voucher_items ADD current_stock INT DEFAULT 0;

      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'inventory_logs') AND name = N'department')
        ALTER TABLE inventory_logs ADD department NVARCHAR(255);

      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'inventory_logs') AND name = N'note')
        ALTER TABLE inventory_logs ADD note NVARCHAR(MAX);

      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'users') AND name = N'password_hash')
        ALTER TABLE users ADD password_hash NVARCHAR(255) NULL;

      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'users') AND name = N'role')
        ALTER TABLE users ADD role VARCHAR(20) DEFAULT 'user';

      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'users') AND name = N'status')
        ALTER TABLE users ADD status VARCHAR(20) DEFAULT 'active';

      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'departments') AND name = N'phone')
        ALTER TABLE departments ADD phone VARCHAR(50);

      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'departments') AND name = N'status')
        ALTER TABLE departments ADD status VARCHAR(20) DEFAULT 'active';
    `);

    // Seed default users if empty
    const countRes = await pool.request().query('SELECT COUNT(*) as cnt FROM users');
    if (countRes.recordset && countRes.recordset[0] && countRes.recordset[0].cnt === 0) {
      const defaultAdminHash = bcrypt.hashSync('admin123', 10);
      const defaultUserHash = bcrypt.hashSync('user123', 10);
      const seedReq = pool.request();
      seedReq.input('adminHash', mssql.NVarChar(255), defaultAdminHash);
      seedReq.input('userHash', mssql.NVarChar(255), defaultUserHash);
      await seedReq.query(`
        INSERT INTO users (id, username, password_hash, full_name, position, notes, role, status, created_at)
        VALUES 
          ('usr_admin', 'admin', @adminHash, N'Quản Trị Viên Hệ Thống', N'Quản trị viên', N'Tài khoản quản trị cao nhất hệ thống', 'admin', 'active', GETDATE()),
          ('usr_nhanvien', 'nhanvien', @userHash, N'Nguyễn Văn Kho', N'Thủ kho', N'Tài khoản nhân viên vận hành kho', 'user', 'active', GETDATE());
      `);
    }

    await pool.close();

    res.json({
      success: true,
      message: `Khởi tạo bảng SQL Server thành công trong CSDL '${dbName}'!`,
    });
  } catch (err: any) {
    if (pool) {
      try { await pool.close(); } catch (_) { }
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
    let departmentsRecordset: any[] = [];
    try {
      const deptsRes = await pool.request().query(`
        IF EXISTS (SELECT * FROM sys.tables WHERE name = N'departments')
          SELECT * FROM departments ORDER BY created_at ASC
      `);
      departmentsRecordset = deptsRes.recordset || [];
    } catch (err) {
      console.error('Error fetching departments from MSSQL:', err);
    }

    let usersRecordset: any[] = [];
    try {
      const usersRes = await pool.request().query('SELECT * FROM users');
      usersRecordset = usersRes.recordset || [];
    } catch (err) {
      console.error('Error fetching users from MSSQL:', err);
    }

    await pool.close();

    res.json({
      success: true,
      items: itemsRes.recordset,
      categories: catsRes.recordset,
      warehouses: whsRes.recordset,
      units: unitsRes.recordset,
      departments: departmentsRecordset,
      vouchers: vouchersRes.recordset,
      voucherItems: voucherItemsRes.recordset,
      logs: logsRes.recordset,
      users: usersRecordset,
    });
  } catch (err: any) {
    if (pool) {
      try { await pool.close(); } catch (_) { }
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
    if (pool) { try { await pool.close(); } catch (_) { } }
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
    if (pool) { try { await pool.close(); } catch (_) { } }
    res.status(400).json({ success: false, message: err.message });
  }
});

// 6. Save Warehouse SQL Server (and cascade renamed warehouse_name to items)
app.post('/api/mssql/save-warehouse', async (req, res) => {
  let pool;
  let transaction: mssql.Transaction | undefined;
  try {
    const { config, warehouse } = req.body;
    pool = await getMSSQLPool(config, true);
    transaction = new mssql.Transaction(pool);
    await transaction.begin();

    const request = new mssql.Request(transaction);
    request.input('id', mssql.VarChar(50), String(warehouse.id).trim());
    request.input('code', mssql.VarChar(50), String(warehouse.code || '').trim());
    request.input('name', mssql.NVarChar(255), String(warehouse.name || ''));
    request.input('location', mssql.NVarChar(mssql.MAX), String(warehouse.location || ''));
    request.input('manager', mssql.NVarChar(255), String(warehouse.manager || ''));
    request.input('description', mssql.NVarChar(mssql.MAX), String(warehouse.description || ''));
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

        UPDATE items SET
          warehouse_name = @name,
          updated_at = GETDATE()
        WHERE warehouse_id = @id;
      END
      ELSE
      BEGIN
        INSERT INTO warehouses (id, code, name, location, manager, description, is_default, created_at, updated_at)
        VALUES (@id, @code, @name, @location, @manager, @description, @is_default, GETDATE(), GETDATE());
      END
    `);

    await transaction.commit();
    await pool.close();
    res.json({ success: true });
  } catch (err: any) {
    if (transaction) { try { await transaction.rollback(); } catch (_) { } }
    if (pool) { try { await pool.close(); } catch (_) { } }
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
    if (pool) { try { await pool.close(); } catch (_) { } }
    res.status(400).json({ success: false, message: err.message });
  }
});

// 8. Save Category SQL Server (and cascade renamed category_name to items)
app.post('/api/mssql/save-category', async (req, res) => {
  let pool;
  let transaction: mssql.Transaction | undefined;
  try {
    const { config, category } = req.body;
    pool = await getMSSQLPool(config, true);
    transaction = new mssql.Transaction(pool);
    await transaction.begin();

    const request = new mssql.Request(transaction);
    request.input('id', mssql.VarChar(50), String(category.id).trim());
    request.input('code', mssql.VarChar(50), String(category.code || '').trim());
    request.input('name', mssql.NVarChar(255), String(category.name || ''));
    request.input('description', mssql.NVarChar(mssql.MAX), String(category.description || ''));

    await request.query(`
      IF EXISTS (SELECT 1 FROM categories WHERE id = @id)
      BEGIN
        UPDATE categories SET
          code = @code,
          name = @name,
          description = @description,
          updated_at = GETDATE()
        WHERE id = @id;

        UPDATE items SET
          category_name = @name,
          updated_at = GETDATE()
        WHERE category_id = @id;
      END
      ELSE
      BEGIN
        INSERT INTO categories (id, code, name, description, created_at, updated_at)
        VALUES (@id, @code, @name, @description, GETDATE(), GETDATE());
      END
    `);

    await transaction.commit();
    await pool.close();
    res.json({ success: true });
  } catch (err: any) {
    if (transaction) { try { await transaction.rollback(); } catch (_) { } }
    if (pool) { try { await pool.close(); } catch (_) { } }
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
    if (pool) { try { await pool.close(); } catch (_) { } }
    res.status(400).json({ success: false, message: err.message });
  }
});

// 10. Save Unit SQL Server (and cascade renamed unit_name to items)
app.post('/api/mssql/save-unit', async (req, res) => {
  let pool;
  let transaction: mssql.Transaction | undefined;
  try {
    const { config, unit } = req.body;
    pool = await getMSSQLPool(config, true);
    transaction = new mssql.Transaction(pool);
    await transaction.begin();

    const request = new mssql.Request(transaction);
    request.input('id', mssql.VarChar(50), String(unit.id).trim());
    request.input('name', mssql.NVarChar(255), String(unit.name || ''));
    request.input('description', mssql.NVarChar(mssql.MAX), String(unit.description || ''));

    await request.query(`
      IF EXISTS (SELECT 1 FROM units WHERE id = @id)
      BEGIN
        UPDATE units SET
          name = @name,
          description = @description
        WHERE id = @id;

        UPDATE items SET
          unit_name = @name,
          updated_at = GETDATE()
        WHERE unit_id = @id;
      END
      ELSE
      BEGIN
        INSERT INTO units (id, name, description, created_at)
        VALUES (@id, @name, @description, GETDATE());
      END
    `);

    await transaction.commit();
    await pool.close();
    res.json({ success: true });
  } catch (err: any) {
    if (transaction) { try { await transaction.rollback(); } catch (_) { } }
    if (pool) { try { await pool.close(); } catch (_) { } }
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
    if (pool) { try { await pool.close(); } catch (_) { } }
    res.status(400).json({ success: false, message: err.message });
  }
});

// 11a. Atomic Batch Import (Categories, Units, Warehouses, Items) SQL Server
app.post('/api/mssql/import-items-batch', async (req, res) => {
  let pool;
  let transaction: mssql.Transaction | undefined;
  try {
    const { config, categories = [], units = [], warehouses = [], items = [] } = req.body || {};
    pool = await getMSSQLPool(config, true);
    transaction = new mssql.Transaction(pool);
    await transaction.begin();

    for (const category of categories) {
      const reqCat = new mssql.Request(transaction);
      reqCat.input('id', mssql.VarChar(50), String(category.id).trim());
      reqCat.input('code', mssql.VarChar(50), String(category.code || '').trim());
      reqCat.input('name', mssql.NVarChar(255), String(category.name || ''));
      reqCat.input('description', mssql.NVarChar(mssql.MAX), String(category.description || ''));
      await reqCat.query(`
        IF NOT EXISTS (SELECT 1 FROM categories WHERE id = @id)
          INSERT INTO categories (id, code, name, description, created_at, updated_at)
          VALUES (@id, @code, @name, @description, GETDATE(), GETDATE());
      `);
    }

    for (const unit of units) {
      const reqUnit = new mssql.Request(transaction);
      reqUnit.input('id', mssql.VarChar(50), String(unit.id).trim());
      reqUnit.input('name', mssql.NVarChar(255), String(unit.name || ''));
      reqUnit.input('description', mssql.NVarChar(mssql.MAX), String(unit.description || ''));
      await reqUnit.query(`
        IF NOT EXISTS (SELECT 1 FROM units WHERE id = @id)
          INSERT INTO units (id, name, description, created_at)
          VALUES (@id, @name, @description, GETDATE());
      `);
    }

    for (const wh of warehouses) {
      const reqWh = new mssql.Request(transaction);
      reqWh.input('id', mssql.VarChar(50), String(wh.id).trim());
      reqWh.input('code', mssql.VarChar(50), String(wh.code || '').trim());
      reqWh.input('name', mssql.NVarChar(255), String(wh.name || ''));
      reqWh.input('location', mssql.NVarChar(mssql.MAX), String(wh.location || ''));
      reqWh.input('manager', mssql.NVarChar(255), String(wh.manager || ''));
      reqWh.input('description', mssql.NVarChar(mssql.MAX), String(wh.description || ''));
      reqWh.input('is_default', mssql.Bit, wh.isDefault ? 1 : 0);
      await reqWh.query(`
        IF NOT EXISTS (SELECT 1 FROM warehouses WHERE id = @id)
          INSERT INTO warehouses (id, code, name, location, manager, description, is_default, created_at, updated_at)
          VALUES (@id, @code, @name, @location, @manager, @description, @is_default, GETDATE(), GETDATE());
      `);
    }

    for (const item of items) {
      const reqItem = new mssql.Request(transaction);
      reqItem.input('id', mssql.VarChar(50), String(item.id).trim());
      reqItem.input('code', mssql.VarChar(50), String(item.code || '').trim());
      reqItem.input('name', mssql.NVarChar(255), String(item.name || ''));
      reqItem.input('category_id', mssql.VarChar(50), String(item.categoryId || '').trim());
      reqItem.input('category_name', mssql.NVarChar(255), String(item.categoryName || ''));
      reqItem.input('unit_id', mssql.VarChar(50), String(item.unitId || '').trim());
      reqItem.input('unit_name', mssql.NVarChar(255), String(item.unitName || ''));
      reqItem.input('warehouse_id', mssql.VarChar(50), String(item.warehouseId || '').trim());
      reqItem.input('warehouse_name', mssql.NVarChar(255), String(item.warehouseName || ''));
      reqItem.input('stock_quantity', mssql.Int, Math.round(Number(item.stockQuantity) || 0));
      reqItem.input('min_stock_level', mssql.Int, Math.round(Number(item.minStockLevel) || 0));
      reqItem.input('max_stock_level', mssql.Int, Math.round(Number(item.maxStockLevel) || 100));
      reqItem.input('note', mssql.NVarChar(mssql.MAX), String(item.note || ''));
      await reqItem.query(`
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
    }

    await transaction.commit();
    await pool.close();
    res.json({ success: true, importedItems: items.length });
  } catch (err: any) {
    if (transaction) { try { await transaction.rollback(); } catch (_) { } }
    if (pool) { try { await pool.close(); } catch (_) { } }
    console.error('SQL Server Import Items Batch Error:', err);
    res.status(400).json({ success: false, message: err.message });
  }
});

// 11b. Save Department SQL Server
app.post('/api/mssql/save-department', async (req, res) => {
  let pool;
  try {
    const { config, department } = req.body;
    if (!department || !department.id || !department.code || !department.name) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin phòng ban bắt buộc (id, mã, tên)' });
    }
    pool = await getMSSQLPool(config, true);

    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = N'departments')
      CREATE TABLE departments (
        id VARCHAR(50) PRIMARY KEY,
        code VARCHAR(50) NOT NULL,
        name NVARCHAR(255) NOT NULL,
        manager NVARCHAR(255),
        phone VARCHAR(50),
        description NVARCHAR(MAX),
        status VARCHAR(20) DEFAULT 'active',
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE()
      );
    `);

    const request = pool.request();
    request.input('id', mssql.VarChar(50), String(department.id));
    request.input('code', mssql.VarChar(50), String(department.code).trim());
    request.input('name', mssql.NVarChar(255), String(department.name).trim());
    request.input('manager', mssql.NVarChar(255), String(department.manager || '').trim());
    request.input('phone', mssql.VarChar(50), String(department.phone || '').trim());
    request.input('description', mssql.NVarChar(mssql.MAX), String(department.description || '').trim());
    request.input('status', mssql.VarChar(20), department.status === 'inactive' ? 'inactive' : 'active');

    await request.query(`
      IF EXISTS (SELECT 1 FROM departments WHERE id = @id)
      BEGIN
        UPDATE departments SET
          code = @code,
          name = @name,
          manager = @manager,
          phone = @phone,
          description = @description,
          status = @status,
          updated_at = GETDATE()
        WHERE id = @id;
      END
      ELSE
      BEGIN
        INSERT INTO departments (id, code, name, manager, phone, description, status, created_at, updated_at)
        VALUES (@id, @code, @name, @manager, @phone, @description, @status, GETDATE(), GETDATE());
      END
    `);

    await pool.close();
    res.json({ success: true });
  } catch (err: any) {
    if (pool) { try { await pool.close(); } catch (_) { } }
    res.status(400).json({ success: false, message: err.message });
  }
});

// 11c. Delete Department SQL Server
app.post('/api/mssql/delete-department', async (req, res) => {
  let pool;
  try {
    const { config, id } = req.body;
    if (!id) {
      return res.status(400).json({ success: false, message: 'Thiếu mã ID phòng ban' });
    }
    pool = await getMSSQLPool(config, true);
    const request = pool.request();
    request.input('id', mssql.VarChar(50), String(id));
    await request.query(`
      IF EXISTS (SELECT * FROM sys.tables WHERE name = N'departments')
        DELETE FROM departments WHERE id = @id
    `);
    await pool.close();
    res.json({ success: true });
  } catch (err: any) {
    if (pool) { try { await pool.close(); } catch (_) { } }
    res.status(400).json({ success: false, message: err.message });
  }
});

async function ensureVoucherTables(pool: mssql.ConnectionPool) {
  await pool.request().query(`
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

    BEGIN TRY
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'stock_vouchers') AND name = N'department')
        ALTER TABLE stock_vouchers ADD department NVARCHAR(255) NULL;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'stock_voucher_items') AND name = N'unit_name')
        ALTER TABLE stock_voucher_items ADD unit_name NVARCHAR(255) NULL;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'stock_voucher_items') AND name = N'current_stock')
        ALTER TABLE stock_voucher_items ADD current_stock INT DEFAULT 0;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'inventory_logs') AND name = N'department')
        ALTER TABLE inventory_logs ADD department NVARCHAR(255) NULL;
    END TRY
    BEGIN CATCH
    END CATCH
  `);
}

async function insertStockVoucherItems(
  target: mssql.ConnectionPool | mssql.Transaction,
  voucherId: string,
  items: any[]
): Promise<number> {
  if (!items || items.length === 0) return 0;

  const createReq = () =>
    target instanceof mssql.Transaction ? new mssql.Request(target) : target.request();

  const colsRes = await createReq().query(`
    SELECT c.name, c.is_identity, t.name AS type_name
    FROM sys.columns c
    LEFT JOIN sys.types t ON c.user_type_id = t.user_type_id
    WHERE c.object_id = COALESCE(OBJECT_ID(N'dbo.stock_voucher_items'), OBJECT_ID(N'stock_voucher_items'))
  `);

  const columnsMap = new Map<string, { name: string; is_identity: boolean; type_name: string }>();
  for (const row of colsRes.recordset || []) {
    columnsMap.set(String(row.name).toLowerCase(), {
      name: String(row.name),
      is_identity: Boolean(row.is_identity),
      type_name: String(row.type_name || '').toLowerCase(),
    });
  }

  // Fallback / supplement via TDS metadata (works even without VIEW DEFINITION permission or with non-dbo default schema)
  if (columnsMap.size === 0 || !columnsMap.has('id')) {
    try {
      const metaRes = await createReq().query('SELECT TOP 0 * FROM stock_voucher_items');
      const rsCols = metaRes.recordset?.columns || {};
      for (const [colKey, colInfo] of Object.entries(rsCols)) {
        const lower = String(colInfo?.name || colKey).toLowerCase();
        if (!columnsMap.has(lower)) {
          let detectedType = '';
          const rawType: any = colInfo?.type;
          if (rawType === mssql.Int) detectedType = 'int';
          else if (rawType === mssql.BigInt) detectedType = 'bigint';
          else if (rawType === mssql.SmallInt) detectedType = 'smallint';
          else if (rawType === mssql.TinyInt) detectedType = 'tinyint';
          else if (rawType === mssql.Decimal) detectedType = 'decimal';
          else if (rawType === mssql.Numeric) detectedType = 'numeric';
          else if (rawType === mssql.UniqueIdentifier) detectedType = 'uniqueidentifier';
          else if (
            rawType === mssql.VarChar ||
            rawType === mssql.NVarChar ||
            rawType === mssql.Char ||
            rawType === mssql.NChar
          ) {
            detectedType = 'varchar';
          } else if (typeof rawType?.name === 'string') {
            detectedType = rawType.name.toLowerCase();
          }

          columnsMap.set(lower, {
            name: String(colInfo?.name || colKey),
            is_identity: Boolean(colInfo?.identity),
            type_name: detectedType,
          });
        }
      }
    } catch (metaErr) {
      console.error('[insertStockVoucherItems] Failed to inspect TOP 0 columns:', metaErr);
    }
  }

  const idMeta = columnsMap.get('id');
  const hasId = Boolean(idMeta);
  const isIdentity = Boolean(idMeta?.is_identity);
  const typeName = idMeta?.type_name || '';
  const isNumericId = ['int', 'bigint', 'smallint', 'tinyint', 'decimal', 'numeric'].includes(typeName);

  let nextNumericId = 1;
  if (hasId && !isIdentity && isNumericId) {
    const maxRes = await createReq().query(
      'SELECT ISNULL(MAX(TRY_CAST(id AS BIGINT)), 0) AS maxId FROM stock_voucher_items'
    );
    nextNumericId = Number(maxRes.recordset?.[0]?.maxId || 0) + 1;
  }

  const candidateCols: { key: string; param: string }[] = [
    { key: 'voucher_id', param: '@voucher_id' },
    { key: 'item_id', param: '@item_id' },
    { key: 'item_code', param: '@item_code' },
    { key: 'item_name', param: '@item_name' },
    { key: 'unit_name', param: '@unit_name' },
    { key: 'quantity', param: '@quantity' },
    { key: 'current_stock', param: '@current_stock' },
  ];

  const activeCols = candidateCols.filter((c) => columnsMap.size === 0 || columnsMap.has(c.key));
  const insertColNames = activeCols.map((c) => c.key);
  const insertParamNames = activeCols.map((c) => c.param);

  let inserted = 0;
  for (let i = 0; i < items.length; i++) {
    const vi = items[i];
    const reqItem = createReq();
    reqItem.input('voucher_id', mssql.VarChar(50), String(voucherId).trim());
    reqItem.input('item_id', mssql.VarChar(50), String(vi.itemId || '').trim());
    reqItem.input('item_code', mssql.VarChar(50), String(vi.itemCode || '').trim());
    reqItem.input('item_name', mssql.NVarChar(255), String(vi.itemName || ''));
    reqItem.input('unit_name', mssql.NVarChar(255), String(vi.unitName || ''));
    reqItem.input('quantity', mssql.Int, Math.round(Number(vi.quantity) || 0));
    reqItem.input('current_stock', mssql.Int, Math.round(Number(vi.currentStock) || 0));

    if (!hasId || isIdentity) {
      await reqItem.query(`
        INSERT INTO stock_voucher_items (${insertColNames.join(', ')})
        VALUES (${insertParamNames.join(', ')});
      `);
    } else if (typeName === 'uniqueidentifier') {
      await reqItem.query(`
        INSERT INTO stock_voucher_items (id, ${insertColNames.join(', ')})
        VALUES (NEWID(), ${insertParamNames.join(', ')});
      `);
    } else if (isNumericId) {
      reqItem.input('id', mssql.BigInt, nextNumericId++);
      await reqItem.query(`
        INSERT INTO stock_voucher_items (id, ${insertColNames.join(', ')})
        VALUES (@id, ${insertParamNames.join(', ')});
      `);
    } else {
      const strId = `svi_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`;
      reqItem.input('id', mssql.VarChar(50), strId);
      await reqItem.query(`
        INSERT INTO stock_voucher_items (id, ${insertColNames.join(', ')})
        VALUES (@id, ${insertParamNames.join(', ')});
      `);
    }
    inserted++;
  }

  return inserted;
}

// 12. Save Voucher & Items & Logs SQL Server
app.post('/api/mssql/save-voucher', async (req, res) => {
  let pool;
  let transaction: mssql.Transaction | undefined;
  try {
    const { config, voucher, logs, updatedItems } = req.body || {};
    if (!voucher || !voucher.id) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin phiếu để lưu vào SQL Server' });
    }

    pool = await getMSSQLPool(config, true);
    await ensureVoucherTables(pool);

    transaction = new mssql.Transaction(pool);
    await transaction.begin();

    const reqV = new mssql.Request(transaction);
    reqV.input('id', mssql.VarChar(50), String(voucher.id).trim());
    reqV.input('code', mssql.VarChar(50), String(voucher.code || '').trim());
    reqV.input('type', mssql.VarChar(10), voucher.type === 'OUT' ? 'OUT' : 'IN');
    reqV.input('date', mssql.VarChar(20), String(voucher.date || '').trim());
    reqV.input('person', mssql.NVarChar(255), String(voucher.person || ''));
    reqV.input('department', mssql.NVarChar(255), String(voucher.department || ''));
    reqV.input('warehouse_id', mssql.VarChar(50), String(voucher.warehouseId || '').trim());
    reqV.input('warehouse_name', mssql.NVarChar(255), String(voucher.warehouseName || ''));
    reqV.input('note', mssql.NVarChar(mssql.MAX), String(voucher.note || ''));
    reqV.input('total_quantity', mssql.Int, Math.round(Number(voucher.totalQuantity) || 0));

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

    // Replace existing voucher line items and logs for this voucher so updates never duplicate rows
    const reqDelItems = new mssql.Request(transaction);
    reqDelItems.input('voucher_id', mssql.VarChar(50), String(voucher.id).trim());
    await reqDelItems.query('DELETE FROM stock_voucher_items WHERE voucher_id = @voucher_id');

    const reqDelLogs = new mssql.Request(transaction);
    reqDelLogs.input('voucher_id', mssql.VarChar(50), String(voucher.id).trim());
    await reqDelLogs.query('DELETE FROM inventory_logs WHERE voucher_id = @voucher_id');

    const insertedItems = await insertStockVoucherItems(transaction, String(voucher.id).trim(), voucher.items || []);

    for (const log of logs || []) {
      const reqLog = new mssql.Request(transaction);
      reqLog.input('id', mssql.VarChar(50), String(log.id).trim());
      reqLog.input('voucher_id', mssql.VarChar(50), String(log.voucherId || voucher.id).trim());
      reqLog.input('voucher_code', mssql.VarChar(50), String(log.voucherCode || voucher.code || '').trim());
      reqLog.input('type', mssql.VarChar(10), log.type === 'OUT' ? 'OUT' : 'IN');
      reqLog.input('date', mssql.VarChar(20), String(log.date || voucher.date || '').trim());
      reqLog.input('item_id', mssql.VarChar(50), String(log.itemId || '').trim());
      reqLog.input('item_code', mssql.VarChar(50), String(log.itemCode || '').trim());
      reqLog.input('item_name', mssql.NVarChar(255), String(log.itemName || ''));
      reqLog.input('category_name', mssql.NVarChar(255), String(log.categoryName || ''));
      reqLog.input('warehouse_id', mssql.VarChar(50), String(log.warehouseId || '').trim());
      reqLog.input('warehouse_name', mssql.NVarChar(255), String(log.warehouseName || ''));
      reqLog.input('quantity', mssql.Int, Math.round(Number(log.quantity) || 0));
      reqLog.input('previous_stock', mssql.Int, Math.round(Number(log.previousStock) || 0));
      reqLog.input('new_stock', mssql.Int, Math.round(Number(log.newStock) || 0));
      reqLog.input('person', mssql.NVarChar(255), String(log.person || ''));
      reqLog.input('department', mssql.NVarChar(255), String(log.department || ''));
      reqLog.input('note', mssql.NVarChar(mssql.MAX), String(log.note || ''));

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
      const reqStock = new mssql.Request(transaction);
      reqStock.input('id', mssql.VarChar(50), String(item.id).trim());
      reqStock.input('stock_quantity', mssql.Int, Math.round(Number(item.stockQuantity) || 0));

      await reqStock.query(`
        UPDATE items
        SET stock_quantity = @stock_quantity, updated_at = GETDATE()
        WHERE id = @id;
      `);
    }

    await transaction.commit();
    await pool.close();
    res.json({ success: true, insertedItems });
  } catch (err: any) {
    if (transaction) { try { await transaction.rollback(); } catch (_) { } }
    if (pool) { try { await pool.close(); } catch (_) { } }
    console.error('SQL Server Save Voucher Error:', err);
    res.status(400).json({ success: false, message: err.message });
  }
});

// 13. Auto-repair: Insert missing stock_voucher_items reconstructed from inventory_logs
app.post('/api/mssql/repair-voucher-items', async (req, res) => {
  let pool;
  try {
    const { config, voucherId, items } = req.body;
    if (!voucherId || !items || items.length === 0) {
      return res.json({ success: true, inserted: 0 });
    }

    pool = await getMSSQLPool(config, true);
    await ensureVoucherTables(pool);

    // Only insert if this voucher truly has no items yet (safe guard)
    const checkReq = pool.request();
    checkReq.input('voucher_id', mssql.VarChar(50), voucherId);
    const checkRes = await checkReq.query(
      'SELECT COUNT(*) as cnt FROM stock_voucher_items WHERE voucher_id = @voucher_id'
    );
    const existingCount = Number(checkRes.recordset?.[0]?.cnt || 0);

    if (existingCount > 0) {
      await pool.close();
      return res.json({ success: true, inserted: 0, skipped: true });
    }

    const inserted = await insertStockVoucherItems(pool, voucherId, items);

    await pool.close();
    console.log(`[repair-voucher-items] Voucher ${voucherId}: inserted ${inserted} item(s).`);
    res.json({ success: true, inserted });
  } catch (err: any) {
    if (pool) { try { await pool.close(); } catch (_) { } }
    console.error('SQL Server Repair Voucher Items Error:', err);
    res.status(400).json({ success: false, message: err.message });
  }
});

// Delete Voucher (MSSQL)
app.post('/api/mssql/delete-voucher', async (req, res) => {
  let pool;
  let transaction: mssql.Transaction | undefined;
  try {
    const { config, id, updatedItems } = req.body;
    pool = await getMSSQLPool(config, true);
    transaction = new mssql.Transaction(pool);
    await transaction.begin();

    const reqDelItems = new mssql.Request(transaction);
    reqDelItems.input('voucher_id', mssql.VarChar(50), id);
    await reqDelItems.query('DELETE FROM stock_voucher_items WHERE voucher_id = @voucher_id');

    const reqDelLogs = new mssql.Request(transaction);
    reqDelLogs.input('voucher_id', mssql.VarChar(50), id);
    await reqDelLogs.query('DELETE FROM inventory_logs WHERE voucher_id = @voucher_id');

    const reqDelVoucher = new mssql.Request(transaction);
    reqDelVoucher.input('id', mssql.VarChar(50), id);
    await reqDelVoucher.query('DELETE FROM stock_vouchers WHERE id = @id');

    for (const item of updatedItems || []) {
      const reqStock = new mssql.Request(transaction);
      reqStock.input('id', mssql.VarChar(50), item.id);
      reqStock.input('stock_quantity', mssql.Int, item.stockQuantity || 0);
      await reqStock.query(`
        UPDATE items
        SET stock_quantity = @stock_quantity, updated_at = GETDATE()
        WHERE id = @id;
      `);
    }

    await transaction.commit();
    await pool.close();
    res.json({ success: true });
  } catch (err: any) {
    if (transaction) { try { await transaction.rollback(); } catch (_) { } }
    if (pool) { try { await pool.close(); } catch (_) { } }
    console.error('SQL Server Delete Voucher Error:', err);
    res.status(400).json({ success: false, message: err.message });
  }
});

// Save User (MSSQL)
app.post('/api/mssql/save-user', async (req, res) => {
  let pool;
  try {
    const { config, user, passwordHash } = req.body;
    pool = await getMSSQLPool(config, true);

    const request = pool.request();
    request.input('id', mssql.VarChar(50), user.id);
    request.input('username', mssql.VarChar(50), user.username.toLowerCase());
    request.input('full_name', mssql.NVarChar(255), user.fullName);
    request.input('position', mssql.NVarChar(255), user.position || '');
    request.input('notes', mssql.NVarChar(mssql.MAX), user.notes || '');
    request.input('role', mssql.VarChar(20), user.role || 'user');
    request.input('status', mssql.VarChar(20), user.status || 'active');

    const rawPass = passwordHash || user?.passwordHash || user?.password;
    if (rawPass) {
      const encryptedHash = hashPasswordIfNeeded(rawPass);
      request.input('password_hash', mssql.NVarChar(255), encryptedHash);
      await request.query(`
        IF EXISTS (SELECT 1 FROM users WHERE id = @id)
        BEGIN
          UPDATE users SET
            username = @username,
            password_hash = @password_hash,
            full_name = @full_name,
            position = @position,
            notes = @notes,
            role = @role,
            status = @status,
            updated_at = GETDATE()
          WHERE id = @id;
        END
        ELSE
        BEGIN
          INSERT INTO users (id, username, password_hash, full_name, position, notes, role, status, created_at, updated_at)
          VALUES (@id, @username, @password_hash, @full_name, @position, @notes, @role, @status, GETDATE(), GETDATE());
        END
      `);
    } else {
      await request.query(`
        IF EXISTS (SELECT 1 FROM users WHERE id = @id)
        BEGIN
          UPDATE users SET
            username = @username,
            full_name = @full_name,
            position = @position,
            notes = @notes,
            role = @role,
            status = @status,
            updated_at = GETDATE()
          WHERE id = @id;
        END
        ELSE
        BEGIN
          INSERT INTO users (id, username, password_hash, full_name, position, notes, role, status, created_at, updated_at)
          VALUES (@id, @username, N'', @full_name, @position, @notes, @role, @status, GETDATE(), GETDATE());
        END
      `);
    }

    await pool.close();
    res.json({ success: true });
  } catch (err: any) {
    if (pool) { try { await pool.close(); } catch (_) { } }
    res.status(400).json({ success: false, message: err.message });
  }
});

// Delete User (MSSQL)
app.post('/api/mssql/delete-user', async (req, res) => {
  let pool;
  try {
    const { config, id } = req.body;
    pool = await getMSSQLPool(config, true);
    const request = pool.request();
    request.input('id', mssql.VarChar(50), id);
    await request.query('DELETE FROM users WHERE id = @id');
    await pool.close();
    res.json({ success: true });
  } catch (err: any) {
    if (pool) { try { await pool.close(); } catch (_) { } }
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
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
