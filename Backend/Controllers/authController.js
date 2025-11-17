const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../Config/database');

const ADMIN_CREDENTIALS = {
  user_id: 'ADMIN',
  password: 'ProcuBid@Admin@2468@',
  role: 'admin',
  name: 'Administrator'
};

const SYSADMIN_CREDENTIALS = {
  user_id: 'SYSADMIN',
  password: 'ProcuBid*SYS*1357*',
  role: 'system_admin',
  name: 'System Administrator'
};

const login = async (req, res) => {
  try {
    console.log('Login request received');
    
    // Get credentials
    const { user_id, password } = req.body || {};
    
    if (!user_id || !password) {
      return res.status(400).json({ success: false, error: 'Missing credentials' });
    }

    console.log('Attempting login for:', user_id);

    // Admin login
    if (user_id.toUpperCase() === 'ADMIN') {
      if (password !== ADMIN_CREDENTIALS.password) {
        return res.status(401).json({ success: false, error: 'Invalid admin credentials' });
      }

      const token = jwt.sign(
        { id: 'admin-id', role: 'admin', user_id: 'ADMIN' },
        process.env.JWT_SECRET
      );

      return res.json({
        success: true,
        token,
        user: {
          id: 'admin-id',
          user_id: 'ADMIN',
          name: 'Administrator',
          email: 'admin@eauction.com',
          role: 'admin',
          company: 'Anunine Holdings Pvt Ltd'
        }
      });
    }

    // System Admin login
    if (user_id.toUpperCase() === 'SYSADMIN') {
      if (password !== SYSADMIN_CREDENTIALS.password) {
        return res.status(401).json({ success: false, error: 'Invalid system admin credentials' });
      }

      const token = jwt.sign(
        { id: 'sysadmin-id', role: 'system_admin', user_id: 'SYSADMIN' },
        process.env.JWT_SECRET
      );

      return res.json({
        success: true,
        token,
        user: {
          id: 'sysadmin-id',
          user_id: 'SYSADMIN',
          name: 'System Administrator',
          email: 'sysadmin@eauction.com',
          role: 'system_admin',
          company: 'Anunine Holdings Pvt Ltd'
        }
      });
    }

    // Bidder login
    if (!user_id.toUpperCase().startsWith('B')) {
      return res.status(401).json({ success: false, error: 'Invalid user ID format' });
    }

    const { data: users, error: dbError } = await query(
      'SELECT * FROM users WHERE user_id = ? AND is_active = TRUE AND deleted_at IS NULL',
      [user_id.toUpperCase()]
    );

    if (dbError || !users || users.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const user = users[0];

    // Check password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign(
      { id: user.id, role: user.role, user_id: user.user_id },
      process.env.JWT_SECRET
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role,
        company: user.company
      }
    });

  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    const { data: users, error } = await query(
      'SELECT password_hash FROM users WHERE id = ?',
      [userId]
    );

    if (error || !users || users.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    
    if (!isMatch) {
      return res.status(400).json({ success: false, error: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const { error: updateError } = await query(
      'UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?',
      [hashedPassword, userId]
    );

    if (updateError) throw updateError;

    res.json({ success: true, message: 'Password changed successfully' });

  } catch (error) {
    console.error('Change password error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = { login, changePassword };