const express = require('express');
const router = express.Router();
const { getActiveNotice } = require('../controllers/noticeController');

router.get('/', getActiveNotice);

module.exports = router;
