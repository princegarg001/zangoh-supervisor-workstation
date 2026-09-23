// Resolves the acting supervisor. Authentication is out of scope for the challenge,
// so identity comes from the `x-supervisor-id` header (falls back to the default).
const config = require('../config');

module.exports = function currentSupervisor(req, res, next) {
  req.supervisorId = req.get('x-supervisor-id') || config.defaultSupervisorId;
  next();
};
