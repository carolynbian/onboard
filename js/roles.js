/* ============================================================
   初见 Onboard · 角色与权限
   ------------------------------------------------------------
   四种角色：员工、HR 管理员、产品运营、系统管理员。
   这里定义的 can() 是页面内部的权限检查：渲染任何页面前都会
   先调用它，没有权限就直接拒绝，而不是只靠隐藏按钮。
   ============================================================ */
(function () {
  'use strict';

  var LABELS = {
    employee: '员工',
    hr_admin: 'HR 管理员',
    ops_admin: '产品运营',
    sys_admin: '系统管理员'
  };

  var ROLE_ORDER = ['employee', 'hr_admin', 'ops_admin', 'sys_admin'];

  // 兼容旧数据里的中文角色名（例如老版本的“管理员”）
  var LEGACY_ROLES = {
    '员工': 'employee',
    'HR 管理员': 'hr_admin',
    'HR管理员': 'hr_admin',
    '产品运营': 'ops_admin',
    '管理员': 'sys_admin',
    '系统管理员': 'sys_admin'
  };

  // 权限点统一用“模块:动作”命名，后续页面和操作都从这里取
  var CAPABILITIES = {
    employee: {
      'page:overview': true,
      'page:org': true,
      'page:policy-center': true,
      'page:my-leave': true,
      'page:assistant': true,
      'page:tickets': true,
      'page:messages': true,
      'page:my-signoffs': true,
      'page:traces': true,
      'chat:ask': true,
      'leave:view-own': true,
      'ticket:create': true
    },
    hr_admin: {
      'page:overview': true,
      'page:org': true,
      'page:policy-center': true,
      'page:my-leave': true,
      'page:assistant': true,
      'page:retrieval-test': true,
      'backend:access': true,
      'backend:hr': true,
      'chat:ask': true,
      'leave:view-own': true,
      'ticket:create': true,
      'page:employees': true,
      'employee:manage': true,
      'page:policies': true,
      'policy:manage': true,
      'page:leave-admin': true,
      'leave:manage': true,
      'page:inquiries': true,
      'feedback:view-all': true,
      'page:tickets': true,
      'page:messages': true,
      'page:my-signoffs': true,
      'page:traces': true,
      'trace:view-all': true,
      'ticket:manage': true,
      'ticket:manage-all': true,
      'page:service': true,
      'page:signoff-admin': true,
      'page:knowledge-gaps': true,
      'page:policy-conflicts': true
    },
    ops_admin: {
      'page:overview': true,
      'page:org': true,
      'page:policy-center': true,
      'page:my-leave': true,
      'page:assistant': true,
      'backend:access': true,
      'backend:ops': true,
      'page:quality': true,
      'quality:manage': true,
      'page:learning': true,
      'page:tickets': true,
      'page:messages': true,
      'page:my-signoffs': true,
      'page:knowledge-gaps': true,
      'page:traces': true,
      'page:analytics': true,
      'page:developer': true,
      'chat:ask': true,
      'ticket:create': true
    },
    // 系统管理员拥有全部权限（见 FULL_ACCESS_ROLES）
    sys_admin: {}
  };

  var FULL_ACCESS_ROLES = { sys_admin: true };

  function normalizeRole(role) {
    var text = String(role == null ? '' : role).trim();
    if (Object.prototype.hasOwnProperty.call(LABELS, text)) return text;
    if (Object.prototype.hasOwnProperty.call(LEGACY_ROLES, text)) return LEGACY_ROLES[text];
    return 'employee';
  }

  function labelOf(role) {
    var key = normalizeRole(role);
    return LABELS[key] || LABELS.employee;
  }

  function isEnabled(user) {
    return !!user && user.enabled !== false;
  }

  /**
   * 内部权限判断：没有权限返回 false，调用方必须据此拒绝，
   * 不能只在界面上隐藏按钮。被停用的账号一律没有权限。
   */
  function can(user, capability) {
    if (!user || !capability) return false;
    if (!isEnabled(user)) return false;
    var role = normalizeRole(user.role);
    if (FULL_ACCESS_ROLES[role]) return true;
    var caps = CAPABILITIES[role];
    return !!(caps && caps[capability] === true);
  }

  /**
   * 谁能给新账号分配哪个角色：
   * - 系统管理员：四种角色都可以；
   * - HR 管理员：只能新增“员工”；
   * - 其他角色：不能管理员工。
   * 界面上会把下拉选项按这里过滤，提交时还会再查一次。
   */
  function canAssignRole(actor, role) {
    if (!can(actor, 'employee:manage')) return false;
    var target = normalizeRole(role);
    if (normalizeRole(actor.role) === 'sys_admin') return true;
    return target === 'employee';
  }

  /**
   * 谁能编辑某个账号：
   * - 不能编辑当前登录的账号（避免把自己停用）；
   * - 系统管理员可以编辑所有其他人；
   * - HR 管理员只能编辑“员工”角色的账号。
   */
  function canEditUser(actor, target) {
    if (!actor || !target) return false;
    if (!can(actor, 'employee:manage')) return false;
    if (actor.id === target.id) return false;
    if (normalizeRole(actor.role) === 'sys_admin') return true;
    return normalizeRole(target.role) === 'employee';
  }

  window.OnboardRoles = {
    LABELS: LABELS,
    ROLE_ORDER: ROLE_ORDER,
    normalizeRole: normalizeRole,
    labelOf: labelOf,
    isEnabled: isEnabled,
    can: can,
    canAssignRole: canAssignRole,
    canEditUser: canEditUser
  };
})();
