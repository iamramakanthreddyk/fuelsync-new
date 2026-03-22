/**
 * Async Error Wrapper
 * Eliminates repetitive try-catch blocks in Express route handlers
 * 
 * BEFORE (verbose):
 * router.get('/items', async (req, res, next) => {
 *   try {
 *     const items = await Item.findAll();
 *     res.json({ data: items });
 *   } catch (error) {
 *     next(error);
 *   }
 * });
 * 
 * AFTER (clean):
 * router.get('/items', asyncHandler(async (req, res) => {
 *   const items = await Item.findAll();
 *   res.json({ data: items });
 * }));
 */

/**
 * Wrap async route handlers to catch errors automatically
 * @param {Function} fn - The async route handler function
 * @returns {Function} - Wrapped function that automatically catches errors
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Wrap async middleware to catch errors automatically
 * @param {Function} fn - The async middleware function
 * @returns {Function} - Wrapped middleware
 */
const asyncMiddleware = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  asyncHandler,
  asyncMiddleware,
};
