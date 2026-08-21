/** Where the editor lives.
 *
 *  Renaming this is not a security control — anyone who wants to find an admin
 *  panel will. What it does buy is quiet: the automated scanners that probe
 *  /admin, /wp-admin and friends all day stop finding anything, and each probe
 *  they don't make is a serverless invocation nobody pays for.
 *
 *  Kept as one constant because the guard in hooks.server.js and every link in
 *  the editor have to agree with the route directory's name. They disagree
 *  silently: a stale link 404s, but a stale guard prefix leaves the editor
 *  unprotected. admin-paths.test.js asserts nothing hardcodes it. */
export const ADMIN_BASE = '/vinyadmin';

export const adminPath = (rest = '') => (rest ? `${ADMIN_BASE}/${rest}` : ADMIN_BASE);
