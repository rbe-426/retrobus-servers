/**
 * Réexporte les fonctions et constantes depuis functionUtils
 * Point d'accès unique pour les composants
 */

import {
  FUNCTIONS,
  FUNCTION_GROUPS,
  FUNCTION_DESCRIPTIONS,
  ROLE_FUNCTION_DEFAULTS
} from '../core/FunctionPermissions';

import {
  canAccessFunction,
  hasAnyFunction,
  hasAllFunctions,
  getModuleFunctions,
  getAllModules,
  getUserModuleAccess,
  hasModuleAccess,
  getFunctionDescription,
  groupFunctionsByModule,
  ACCESS
} from '../lib/functionUtils';

export {
  FUNCTIONS,
  FUNCTION_GROUPS,
  FUNCTION_DESCRIPTIONS,
  ROLE_FUNCTION_DEFAULTS,
  canAccessFunction,
  hasAnyFunction,
  hasAllFunctions,
  getModuleFunctions,
  getAllModules,
  getUserModuleAccess,
  hasModuleAccess,
  getFunctionDescription,
  groupFunctionsByModule,
  ACCESS
};
