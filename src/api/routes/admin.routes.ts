import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import adminController from '../controllers/admin.controller';

const router = Router();

router.use(authenticate);

// GET /api/admin/stats — aggregate company stats
router.get('/stats', adminController.getStats.bind(adminController));

// GET /api/admin/employees — employee list
router.get('/employees', adminController.getEmployees.bind(adminController));

// POST /api/admin/employees/invite — send magic link invites
router.post('/employees/invite', adminController.inviteEmployees.bind(adminController));

// GET /api/admin/reports — report data (CSV or JSON based on ?type=)
router.get('/reports', adminController.getReportData.bind(adminController));

// GET /api/admin/calls — call transcripts for review (pilot monitoring)
// Query: ?limit=30&offset=0&callType=MORNING_PLANNING&sentiment=struggling&userId=...
router.get('/calls', adminController.getCalls.bind(adminController));

// GET /api/admin/usage — AI + messaging cost breakdown for company users
// Query: ?days=30 (default 30)
router.get('/usage', adminController.getUsage.bind(adminController));

export default router;
