/**
 * Role and Permission Utilities
 * Centralizes role checking and permission logic (removes scattered checks throughout controllers)
 * 
 * BENEFITS:
 * - Single source of truth for role hierarchy
 * - Consistent role name handling (case insensitivity)
 * - Easy to test and maintain
 * - Replaces scattered (user.role || '').toLowerCase() checks
 */

const USER_ROLES = {
  SUPER_ADMIN: 'superadmin',
  OWNER: 'owner',
  MANAGER: 'manager',
  EMPLOYEE: 'employee',
  ADMIN: 'admin',
};

/**
 * Normalize role name (handle case insensitivity, underscore variants)
 * @param {string} role - Role name
 * @returns {string} - Normalized role
 */
function normalizeRole(role) {
  if (!role) return null;
  return role.toLowerCase()
    .replace('_', '')
    .replace('super_admin', 'superadmin')
    .trim();
}

/**
 * Check if user has a specific role
 * @param {Object} user - User object
 * @param {string} requiredRole - Role to check
 * @returns {boolean}
 */
function hasRole(user, requiredRole) {
  if (!user || !user.role) return false;
  return normalizeRole(user.role) === normalizeRole(requiredRole);
}

/**
 * Check if user has ANY of the specified roles
 * @param {Object} user - User object
 * @param {Array<string>} roles - Array of roles to check
 * @returns {boolean}
 */
function hasAnyRole(user, roles = []) {
  if (!user || !user.role) return false;
  const userRole = normalizeRole(user.role);
  return roles.some(role => normalizeRole(role) === userRole);
}

/**
 * Check if user can access a station
 * @param {Object} user - User object
 * @param {string} stationId - Station ID to check
 * @param {Object} station - Station object (optional, for owner checking)
 * @returns {boolean}
 */
function canAccessStation(user, stationId, station) {
  if (!user) return false;

  const role = normalizeRole(user.role);

  // Super admin can access any station
  if (role === USER_ROLES.SUPER_ADMIN) {
    return true;
  }

  // Owner can access their owned stations (requires station object or ownerId validation)
  if (role === USER_ROLES.OWNER) {
    return station ? station.ownerId === user.id : true;
  }

  // Manager/Employee can only access their assigned station
  return user.stationId === stationId;
}

/**
 * Get allowed stations for user based on role
 * @param {Object} user - User object
 * @returns {Array<string>} - Array of station IDs user can access
 */
function getAllowedStationIds(user, userStations = []) {
  if (!user) return [];

  const role = normalizeRole(user.role);

  // Super admin - return all (no filtering)
  if (role === USER_ROLES.SUPER_ADMIN) {
    return null; // Special value indicating "all stations"
  }

  // Owner - return owned stations
  if (role === USER_ROLES.OWNER) {
    return userStations.map(s => s.id);
  }

  // Manager/Employee - return only their assigned station
  return user.stationId ? [user.stationId] : [];
}

/**
 * Role hierarchy - get roles that are "below" the given role
 * @param {string} role - Role to check
 * @returns {Array<string>} - Roles below this one in hierarchy
 */
function getSubordinateRoles(role) {
  const hierarchy = {
    [USER_ROLES.SUPER_ADMIN]: ['admin', 'owner', 'manager', 'employee'],
    [USER_ROLES.OWNER]: ['manager', 'employee'],
    [USER_ROLES.ADMIN]: ['manager', 'employee'],
    [USER_ROLES.MANAGER]: ['employee'],
    [USER_ROLES.EMPLOYEE]: [],
  };
  return hierarchy[normalizeRole(role)] || [];
}

/**
 * Check if user can manage another user based on roles
 * @param {Object} requestingUser - User making the request
 * @param {Object} targetUser - User being managed
 * @returns {boolean}
 */
function canManageUser(requestingUser, targetUser) {
  if (!requestingUser || !targetUser) return false;

  const requestingRole = normalizeRole(requestingUser.role);
  const targetRole = normalizeRole(targetUser.role);

  // Same station required for manager/employee
  if (requestingRole === USER_ROLES.MANAGER || requestingRole === USER_ROLES.EMPLOYEE) {
    if (requestingUser.stationId !== targetUser.stationId) {
      return false;
    }
  }

  // Can only manage users with lower or equal role
  const subordinates = getSubordinateRoles(requestingRole);
  return subordinates.includes(targetRole) || requestingRole === targetRole;
}

/**
 * Get user's access level (numeric, for comparisons)
 * Higher number = more permissions
 * @param {Object} user - User object
 * @returns {number}
 */
function getUserAccessLevel(user) {
  if (!user) return 0;

  const role = normalizeRole(user.role);
  const levels = {
    [USER_ROLES.SUPER_ADMIN]: 4,
    [USER_ROLES.OWNER]: 3,
    [USER_ROLES.ADMIN]: 2,
    [USER_ROLES.MANAGER]: 1,
    [USER_ROLES.EMPLOYEE]: 0,
  };

  return levels[role] || 0;
}

module.exports = {
  USER_ROLES,
  normalizeRole,
  hasRole,
  hasAnyRole,
  canAccessStation,
  getAllowedStationIds,
  getSubordinateRoles,
  canManageUser,
  getUserAccessLevel,
};
