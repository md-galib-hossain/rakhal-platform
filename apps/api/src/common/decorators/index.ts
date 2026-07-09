/**
 * Reusable parameter decorators for controllers.
 *
 *   import { CurrentUserId, CurrentFarmId } from 'src/common/decorators';
 *
 * They read context populated by the auth/tenant guards, so the matching guards
 * must be applied to the route (see TEMPLATE_OVERVIEW §6).
 */
export * from './current-user.decorator';
export * from './current-farm.decorator';
export * from './current-language.decorator';
