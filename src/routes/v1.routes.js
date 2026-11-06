import { Router } from 'express';
import {
  verifySingle,
  verifyBatch,
  checkDisposableDomain,
  getHealth,
} from '../controllers/verify.controller.js';
import {
  validateBody,
  singleEmailSchema,
  batchEmailSchema,
} from '../middlewares/validator.middleware.js';

const router = Router();

// Single email verification endpoint
router.post('/verify', validateBody(singleEmailSchema), verifySingle);

// Batch email verification endpoint (up to 50 emails)
router.post('/verify/batch', validateBody(batchEmailSchema), verifyBatch);

// Fast O(1) in-memory disposable domain lookup
router.get('/disposable/:domain', checkDisposableDomain);

// Healthcheck under /v1/health
router.get('/health', getHealth);

export default router;
