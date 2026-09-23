const express = require('express');
const KnowledgeBase = require('../models/knowledgeBase');
const { asyncHandler } = require('../middleware/errors');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  res.json(await KnowledgeBase.find().sort({ name: 1 }));
}));

module.exports = router;
