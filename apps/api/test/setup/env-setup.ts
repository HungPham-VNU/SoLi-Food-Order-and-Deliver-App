/**
 * Loads environment variables before Jest imports any test file.
 *
 * Local development always uses a dedicated test database:
 *   - TEST_DATABASE_URL when provided, or
 *   - a local test DB derived from DATABASE_URL, e.g. food_order_test.
 *
 * CI keeps its existing DATABASE_URL behavior so workflow provisioning remains
 * separate from local developer safety.
 */
import { configureE2eEnvironment } from './e2e-env';

configureE2eEnvironment();
