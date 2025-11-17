const express = require('express');
const router = express.Router();

const { login, changePassword } = require('../Controllers/authController');
const { authenticate } = require('../Middleware/auth');

// Login route
router.post('/login', login);

// Change password route
router.post('/change-password', authenticate, changePassword);

// Get current user
router.get('/current-user', authenticate, (req, res) => {
  res.json({ success: true, user: req.user });
});

module.exports = router;