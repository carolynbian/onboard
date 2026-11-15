/* ============================================================
   初见 Onboard · 本机数据与账号逻辑
   ------------------------------------------------------------
   所有数据都只保存在当前浏览器里（localStorage），不会上传到任何服务器。
   密码以“随机盐值 + SHA-256 摘要”的形式保存，不保存明文。
   ============================================================ */
(function () {
  'use strict';

  var DATA_KEY = 'onboard.data.v1';
  var SESSION_KEY = 'onboard.session.v1';
  var DEFAULT_DEPARTMENT = '人力资源部';
  var DATA_VERSION = 23;
  var DEFAULT_DEPARTMENTS = ['产品部', '技术部', '销售部', '财务部', '人力资源部'];
  var DEFAULT_COMPANY_NAME = '我的公司';

  // 制度知识库：原始文件单独存一个键，避免每次保存元数据都重写大文件
  var POLICY_FILE_PREFIX = 'onboard.policyfile.';
  var POLICY_QUEUE_MS = 700;
  var POLICY_PARSE_MS = 1800;

  // 模型配置：密钥加密后单独保存，不放进主数据里
  var MODEL_CONFIG_KEY = 'onboard.model.config.v1';
  var FEISHU_CONFIG_KEY = 'onboard.feishu.config.v1';
  var DEVICE_KEY = 'onboard.devicekey.v1';

  // 浏览器不允许保存本地数据时的内存兜底（刷新后会丢，仅保证当前页面可用）
  var memory = {};

  function readRaw(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (err) {
      return memory[key] || null;
    }
  }

  function writeRaw(key, raw) {
    memory[key] = raw;
    try {
      window.localStorage.setItem(key, raw);
      return true;
    } catch (err) {
      return false;
    }
  }

  function removeRaw(key) {
    delete memory[key];
    try {
      window.localStorage.removeItem(key);
    } catch (err) {
      /* 忽略：没有本地存储时无需删除 */
    }
  }

  function readJson(key) {
    var raw = readRaw(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (err) {
      return null;
    }
  }

  function writeJson(key, value) {
    return writeRaw(key, JSON.stringify(value));
  }

  function defaultDepartments() {
    return DEFAULT_DEPARTMENTS.slice();
  }

  function emptyData() {
    return {
      version: DATA_VERSION,
      workspace: null,
      users: [],
      departments: defaultDepartments(),
      policies: [],
      leaveEntries: [],
      auditLog: [],
      chatSessions: [],
      feedbacks: [],
      tickets: [],
      taskTemplates: [],
      onboardingTasks: [],
      evalQuestions: [],
      policySignoffs: [],
      messageReads: {},
      signoffCampaigns: [],
      gapStates: {},
      developerSettings: null,
      policyChunkIndexes: [],
      chunkTasks: [],
      evalRuns: [],
      promptConfig: null,
      releaseConfig: null,
      draftRegressions: [],
      policyConflictReviews: [],
      feishuBindings: []
    };
  }

  // 把旧版本数据补齐成新结构：角色代码、是否启用、部门列表
  function normalizeData(data) {
    var changed = false;

    if (data.version !== DATA_VERSION) {
      data.version = DATA_VERSION;
      changed = true;
    }

    if (!Array.isArray(data.departments)) {
      data.departments = [];
      changed = true;
    }

    if (!Array.isArray(data.policies)) {
      data.policies = [];
      changed = true;
    }

    if (!Array.isArray(data.leaveEntries)) {
      data.leaveEntries = [];
      changed = true;
    }

    if (!Array.isArray(data.auditLog)) {
      data.auditLog = [];
      changed = true;
    } else {
      var normalizedAudit = data.auditLog.map(function (entry) {
        if (!entry || typeof entry !== 'object') return entry;
        return {
          id: entry.id,
          actorId: entry.actorId,
          actorName: entry.actorName,
          action: sanitizeAuditText(entry.action),
          target: sanitizeAuditText(entry.target || entry.detail || ''),
          detail: sanitizeAuditText(entry.detail || ''),
          createdAt: entry.createdAt
        };
      });
      if (JSON.stringify(normalizedAudit) !== JSON.stringify(data.auditLog)) {
        data.auditLog = normalizedAudit;
        changed = true;
      }
    }

    if (!Array.isArray(data.chatSessions)) {
      data.chatSessions = [];
      changed = true;
    }

    if (!Array.isArray(data.feedbacks)) {
      data.feedbacks = [];
      changed = true;
    }

    if (!Array.isArray(data.tickets)) {
      data.tickets = [];
      changed = true;
    }

    if (!Array.isArray(data.taskTemplates)) {
      data.taskTemplates = [];
      changed = true;
    }

    if (!Array.isArray(data.onboardingTasks)) {
      data.onboardingTasks = [];
      changed = true;
    }

    if (!Array.isArray(data.evalQuestions)) {
      data.evalQuestions = [];
      changed = true;
    }

    if (!Array.isArray(data.policySignoffs)) {
      data.policySignoffs = [];
      changed = true;
    }

    if (!data.messageReads || typeof data.messageReads !== 'object' || Array.isArray(data.messageReads)) {
      data.messageReads = {};
      changed = true;
    }

    if (!Array.isArray(data.signoffCampaigns)) {
      data.signoffCampaigns = [];
      changed = true;
    }

    if (!data.gapStates || typeof data.gapStates !== 'object' || Array.isArray(data.gapStates)) {
      data.gapStates = {};
      changed = true;
    }

    var normalizedDeveloper = normalizeDeveloperSettings(data.developerSettings);
    if (JSON.stringify(normalizedDeveloper) !== JSON.stringify(data.developerSettings)) {
      data.developerSettings = normalizedDeveloper;
      changed = true;
    }

    if (!Array.isArray(data.policyChunkIndexes)) {
      data.policyChunkIndexes = [];
      changed = true;
    }

    if (!Array.isArray(data.chunkTasks)) {
      data.chunkTasks = [];
      changed = true;
    }

    if (!Array.isArray(data.evalRuns)) {
      data.evalRuns = [];
      changed = true;
    }

    if (Array.isArray(data.evalQuestions)) {
      var normalizedEvalQuestions = data.evalQuestions.map(normalizeEvalQuestion);
      if (JSON.stringify(normalizedEvalQuestions) !== JSON.stringify(data.evalQuestions)) {
        data.evalQuestions = normalizedEvalQuestions;
        changed = true;
      }
    }

    var normalizedPrompts = normalizePromptConfig(data.promptConfig);
    if (JSON.stringify(normalizedPrompts) !== JSON.stringify(data.promptConfig)) {
      data.promptConfig = normalizedPrompts;
      changed = true;
    }

    if (!Array.isArray(data.draftRegressions)) {
      data.draftRegressions = [];
      changed = true;
    }

    if (!Array.isArray(data.policyConflictReviews)) {
      data.policyConflictReviews = [];
      changed = true;
    }

    if (!Array.isArray(data.feishuBindings)) {
      data.feishuBindings = [];
      changed = true;
    }

    var normalizedRelease = normalizeReleaseConfig(data);
    if (JSON.stringify(normalizedRelease) !== JSON.stringify(data.releaseConfig)) {
      data.releaseConfig = normalizedRelease;
      changed = true;
    }

    if (Array.isArray(data.policies)) {
      data.policies.forEach(function (policy) {
        if (policy && typeof policy.requireSignoff !== 'boolean') {
          policy.requireSignoff = false;
          changed = true;
        }
      });
    }

    // 旧数据里的差评没有跟进状态，默认视为“待处理”
    if (Array.isArray(data.feedbacks)) {
      data.feedbacks.forEach(function (feedback) {
        if (!feedback || typeof feedback !== 'object') return;
        if (!feedback.followUpStatus) {
          feedback.followUpStatus = 'pending';
          changed = true;
        }
        if (typeof feedback.followUpNote !== 'string') {
          feedback.followUpNote = '';
          changed = true;
        }
        if (!Array.isArray(feedback.followUpHistory)) {
          feedback.followUpHistory = [];
          changed = true;
        }
      });
    }

    // 旧版本里的回答消息没有状态，按“已完成”处理；没有 messages 的会话补空数组
    data.chatSessions.forEach(function (session) {
      if (!session || typeof session !== 'object') return;
      if (!Array.isArray(session.messages)) {
        session.messages = [];
        changed = true;
      }
      session.messages.forEach(function (message) {
        if (message && message.role === 'assistant' && !message.status) {
          message.status = 'done';
          changed = true;
        }
      });
    });

    if (data.workspace && typeof data.workspace.companyName !== 'string') {
      data.workspace.companyName = DEFAULT_COMPANY_NAME;
      changed = true;
    }

    // 预置的五个示例部门始终保留
    for (var d = 0; d < DEFAULT_DEPARTMENTS.length; d++) {
      if (data.departments.indexOf(DEFAULT_DEPARTMENTS[d]) === -1) {
        data.departments.push(DEFAULT_DEPARTMENTS[d]);
        changed = true;
      }
    }

    for (var i = 0; i < data.users.length; i++) {
      var user = data.users[i];
      if (!user || typeof user !== 'object') continue;

      var role = window.OnboardRoles.normalizeRole(user.role);
      if (user.role !== role) {
        user.role = role;
        changed = true;
      }

      if (typeof user.enabled !== 'boolean') {
        user.enabled = true;
        changed = true;
      }

      // 账号已有的部门也加进列表，方便以后在下拉里选
      if (user.department && data.departments.indexOf(user.department) === -1) {
        data.departments.push(user.department);
        changed = true;
      }
    }

    // 工作空间创建者永远保留系统管理员身份（防止旧数据或误操作把自己的角色弄丢）
    if (data.workspace && data.workspace.adminUserId) {
      for (var a = 0; a < data.users.length; a++) {
        var adminUser = data.users[a];
        if (adminUser && adminUser.id === data.workspace.adminUserId) {
          if (adminUser.role !== 'sys_admin') {
            adminUser.role = 'sys_admin';
            changed = true;
          }
          if (adminUser.enabled === false) {
            adminUser.enabled = true;
            changed = true;
          }
          break;
        }
      }
    }

    return { data: data, changed: changed };
  }

  function loadData() {
    var data = readJson(DATA_KEY);
    if (!data || typeof data !== 'object' || !Array.isArray(data.users)) return emptyData();
    if (!data.workspace) data.workspace = null;

    var normalized = normalizeData(data);
    if (normalized.changed) saveData(normalized.data);
    return normalized.data;
  }

  function saveData(data) {
    return writeJson(DATA_KEY, data);
  }

  function hasWorkspace() {
    var data = loadData();
    return !!(data.workspace && data.users.length > 0);
  }

  function getSession() {
    return readJson(SESSION_KEY);
  }

  function currentUser() {
    var session = getSession();
    if (!session || !session.userId) return null;
    var users = loadData().users;
    for (var i = 0; i < users.length; i++) {
      if (users[i] && users[i].id === session.userId) return users[i];
    }
    return null;
  }

  function setSession(userId) {
    return writeJson(SESSION_KEY, { userId: userId, loginAt: new Date().toISOString() });
  }

  function clearSession() {
    removeRaw(SESSION_KEY);
  }

  function randomHex(byteLength) {
    var size = byteLength || 16;
    var bytes = new Uint8Array(size);
    var cryptoObj = window.crypto || window.msCrypto;
    if (cryptoObj && cryptoObj.getRandomValues) {
      cryptoObj.getRandomValues(bytes);
    } else {
      for (var i = 0; i < size; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    var out = '';
    for (var j = 0; j < size; j++) {
      out += (bytes[j] < 16 ? '0' : '') + bytes[j].toString(16);
    }
    return out;
  }

  function hashPassword(password, salt) {
    return window.OnboardCrypto.sha256Hex(salt + '::' + password);
  }

  function uid(prefix) {
    return prefix + '_' + Date.now().toString(36) + randomHex(4);
  }

  function normalizeAccount(account) {
    return String(account == null ? '' : account).trim().toLowerCase();
  }

  function findUserByAccount(account) {
    var target = normalizeAccount(account);
    if (!target) return null;
    var users = loadData().users;
    for (var i = 0; i < users.length; i++) {
      if (users[i] && normalizeAccount(users[i].account) === target) return users[i];
    }
    return null;
  }

  /**
   * 创建工作空间：第一个账号自动成为系统管理员。
   * info = { name, account, department, password }
   */
  function createWorkspace(info) {
    var data = loadData();
    var salt = randomHex(16);
    var user = {
      id: uid('user'),
      name: String(info.name || '').trim(),
      account: String(info.account || '').trim(),
      department: String(info.department || '').trim() || DEFAULT_DEPARTMENT,
      role: 'sys_admin',
      enabled: true,
      salt: salt,
      passwordHash: hashPassword(info.password, salt),
      createdAt: new Date().toISOString()
    };
    var now = new Date().toISOString();
    data.workspace = {
      id: uid('ws'),
      createdAt: now,
      adminUserId: user.id,
      companyName: DEFAULT_COMPANY_NAME
    };
    data.users = [user];
    saveData(data);
    return user;
  }

  /**
   * 登录校验，返回结果对象：
   * { status: 'ok', user } | { status: 'invalid' } | { status: 'disabled' }
   * “停用”只在账号密码都正确时才返回，避免泄露账号是否存在。
   */
  function verifyLogin(account, password) {
    var user = findUserByAccount(account);
    if (!user) return { status: 'invalid' };
    if (hashPassword(password, user.salt) !== user.passwordHash) return { status: 'invalid' };
    if (user.enabled === false) return { status: 'disabled' };
    return { status: 'ok', user: user };
  }

  function checkPassword(user, password) {
    if (!user) return false;
    return hashPassword(password, user.salt) === user.passwordHash;
  }

  function updatePassword(userId, newPassword) {
    var data = loadData();
    for (var i = 0; i < data.users.length; i++) {
      var user = data.users[i];
      if (user && user.id === userId) {
        user.salt = randomHex(16);
        user.passwordHash = hashPassword(newPassword, user.salt);
        user.passwordUpdatedAt = new Date().toISOString();
        saveData(data);
        return true;
      }
    }
    return false;
  }

  function listUsers() {
    return loadData().users.slice();
  }

  function getUserById(userId) {
    var users = loadData().users;
    for (var i = 0; i < users.length; i++) {
      if (users[i] && users[i].id === userId) return users[i];
    }
    return null;
  }

  function getDepartments() {
    return loadData().departments.slice();
  }

  function getCompanyName() {
    var data = loadData();
    return (data.workspace && data.workspace.companyName) || DEFAULT_COMPANY_NAME;
  }

  /**
   * 新增部门，返回 { ok:true, department } 或 { ok:false, message }。
   * 权限判断在页面层做，这里只做数据校验。
   */
  function addDepartment(name) {
    var dept = String(name == null ? '' : name).trim();
    if (!dept) return { ok: false, message: '请填写部门名称。' };
    if (dept.length > 20) return { ok: false, message: '部门名称最多 20 个字。' };

    var data = loadData();
    if (data.departments.indexOf(dept) !== -1) {
      return { ok: false, message: '这个部门已经存在了。' };
    }

    data.departments.push(dept);
    saveData(data);
    return { ok: true, department: dept };
  }

  function sanitizeAuditText(value) {
    return String(value == null ? '' : value)
      .replace(/(密码|password|passwd|密钥|api[_-]?key|secret|token)\s*[:=：]?\s*[^\s，,；;]{2,}/gi, '$1 [已隐藏]')
      .slice(0, 200);
  }

  // 审计只记“谁、何时、对什么对象、做了什么”，绝不写入密码或密钥内容
  function pushAuditEntry(data, action, target, actor) {
    var user = actor || currentUser();
    data.auditLog.unshift({
      id: uid('audit'),
      actorId: user ? user.id : '',
      actorName: user ? user.name : '系统',
      action: sanitizeAuditText(action),
      target: sanitizeAuditText(target),
      detail: '',
      createdAt: new Date().toISOString()
    });
  }

  function logAudit(action, target, actor) {
    var data = loadData();
    pushAuditEntry(data, action, target, actor);
    if (!saveData(data)) return { ok: false, message: '审计记录保存失败。' };
    return { ok: true };
  }

  /**
   * 新增员工账号：姓名、员工编号、部门、角色、初始密码。
   * 员工编号就是登录账号，创建后不能修改。
   * 权限判断在页面层做，这里只做数据校验。
   */
  function createEmployee(info) {
    var data = loadData();
    var name = String(info.name || '').trim();
    var account = String(info.account || '').trim();
    var department = String(info.department || '').trim();
    var role = window.OnboardRoles.normalizeRole(info.role);
    var password = String(info.password || '');

    if (!name) return { ok: false, message: '请填写姓名。' };
    if (name.length > 20) return { ok: false, message: '姓名最多 20 个字。' };
    if (!account) return { ok: false, message: '请填写员工编号。' };
    if (account.length < 4) return { ok: false, message: '员工编号至少 4 位。' };
    if (account.length > 30) return { ok: false, message: '员工编号最多 30 位。' };
    if (/\s/.test(account)) return { ok: false, message: '员工编号里不能有空格。' };
    if (findUserByAccount(account)) return { ok: false, message: '这个员工编号已经被使用，请换一个。' };
    if (!department) return { ok: false, message: '请选择或填写部门。' };
    if (!password) return { ok: false, message: '请设置初始密码。' };
    if (password.length < 10) return { ok: false, message: '初始密码至少 10 位。' };
    if (password.length > 64) return { ok: false, message: '初始密码最多 64 位。' };

    var salt = randomHex(16);
    var user = {
      id: uid('user'),
      name: name,
      account: account,
      department: department,
      role: role,
      enabled: true,
      salt: salt,
      passwordHash: hashPassword(password, salt),
      createdAt: new Date().toISOString()
    };

    data.users.push(user);
    if (data.departments.indexOf(department) === -1) data.departments.push(department);
    pushAuditEntry(data, '创建员工', '员工 ' + name + '（' + account + '）');
    saveData(data);
    return { ok: true, user: user };
  }

  /**
   * 修改员工：姓名、部门、启用/停用、重置密码（密码留空表示不改）。
   * 员工编号（账号）不允许修改。
   */
  function updateEmployee(info) {
    var data = loadData();
    var user = null;
    for (var i = 0; i < data.users.length; i++) {
      if (data.users[i] && data.users[i].id === info.id) {
        user = data.users[i];
        break;
      }
    }
    if (!user) return { ok: false, message: '找不到这个员工。' };

    var name = String(info.name || '').trim();
    var department = String(info.department || '').trim();

    if (!name) return { ok: false, message: '请填写姓名。' };
    if (name.length > 20) return { ok: false, message: '姓名最多 20 个字。' };
    if (!department) return { ok: false, message: '请选择或填写部门。' };

    var password = String(info.password || '');
    if (password && password.length < 10) return { ok: false, message: '新密码至少 10 位。' };
    if (password && password.length > 64) return { ok: false, message: '新密码最多 64 位。' };

    user.name = name;
    user.department = department;
    if (typeof info.enabled === 'boolean') user.enabled = info.enabled;

    if (password) {
      user.salt = randomHex(16);
      user.passwordHash = hashPassword(password, user.salt);
      user.passwordUpdatedAt = new Date().toISOString();
    }

    if (data.departments.indexOf(department) === -1) data.departments.push(department);
    pushAuditEntry(data, '修改员工', '员工 ' + user.name + '（' + user.account + '）');
    saveData(data);
    return { ok: true, user: user };
  }

  /* ================== 制度知识库 ================== */

  function listPolicies() {
    return loadData().policies.slice();
  }

  function getPolicyById(policyId) {
    var policies = loadData().policies;
    for (var i = 0; i < policies.length; i++) {
      if (policies[i] && policies[i].id === policyId) return policies[i];
    }
    return null;
  }

  /**
   * 上传一条制度：元数据写进数据里，原始文件单独保存。
   * info = { name, category, scope, version, effectiveDate, fileName, fileType,
   *          fileSize, fileData(base64), parseOk, parsedText, failReason, uploadedBy }
   */
  function createPolicy(info) {
    var data = loadData();

    var name = String(info.name || '').trim();
    var category = String(info.category || '').trim();
    var scope = String(info.scope || '').trim();
    var version = String(info.version || '').trim();
    var effectiveDate = String(info.effectiveDate || '').trim();
    var fileName = String(info.fileName || '').trim();
    var fileType = String(info.fileType || '').trim();

    if (!name) return { ok: false, message: '请填写制度名称。' };
    if (name.length > 40) return { ok: false, message: '制度名称最多 40 个字。' };
    if (!category) return { ok: false, message: '请选择分类。' };
    if (!scope) return { ok: false, message: '请选择适用范围。' };
    if (!version) return { ok: false, message: '请填写版本号。' };
    if (version.length > 20) return { ok: false, message: '版本号最多 20 个字。' };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)) return { ok: false, message: '请选择生效日期。' };
    if (!fileName) return { ok: false, message: '请选择要上传的文件。' };
    if (!info.fileData) return { ok: false, message: '原始文件读取失败，请重新选择。' };

    var policy = {
      id: uid('policy'),
      name: name,
      category: category,
      scope: scope,
      version: version,
      effectiveDate: effectiveDate,
      fileName: fileName,
      fileType: fileType,
      fileSize: Number(info.fileSize || 0),
      status: 'queued',
      createdAt: new Date().toISOString(),
      parseStartedAt: '',
      parseFinishedAt: '',
      publishedAt: '',
      failReason: '',
      parsedText: '',
      parseOk: info.parseOk === true,
      pendingText: String(info.parsedText || ''),
      pendingFail: String(info.failReason || ''),
      requireSignoff: info.requireSignoff === true,
      uploadedBy: String(info.uploadedBy || '')
    };

    var fileSaved = writeRaw(POLICY_FILE_PREFIX + policy.id, String(info.fileData));
    if (!fileSaved) {
      return { ok: false, message: '本机存储空间不足，原始文件没保存成功，请换小一点的文件。' };
    }

    data.policies.unshift(policy);
    pushAuditEntry(data, '上传制度', '制度《' + name + '》 ' + version);
    if (!saveData(data)) {
      removeRaw(POLICY_FILE_PREFIX + policy.id);
      return { ok: false, message: '保存失败，本机存储空间可能已满。' };
    }

    return { ok: true, policy: policy };
  }

  /**
   * 后台解析状态推进（按时间推进，刷新页面也会继续）：
   * 排队中 → 解析中 → 待发布 / 失败
   */
  function advancePolicies() {
    var data = loadData();
    if (!Array.isArray(data.policies) || !data.policies.length) return false;

    var now = Date.now();
    var changed = false;

    data.policies.forEach(function (policy) {
      if (!policy) return;

      if (policy.status === 'queued') {
        var createdAt = Date.parse(policy.createdAt) || now;
        if (now - createdAt >= POLICY_QUEUE_MS) {
          policy.status = 'parsing';
          policy.parseStartedAt = new Date().toISOString();
          changed = true;
        }
      } else if (policy.status === 'parsing') {
        var startedAt = Date.parse(policy.parseStartedAt) || Date.parse(policy.createdAt) || now;
        if (now - startedAt >= POLICY_PARSE_MS) {
          if (policy.parseOk) {
            policy.status = 'ready';
            policy.parsedText = policy.pendingText || '';
          } else {
            policy.status = 'failed';
            policy.failReason = policy.pendingFail || '解析失败，请重试。';
          }
          policy.parseFinishedAt = new Date().toISOString();
          changed = true;
        }
      }
    });

    if (changed) saveData(data);
    return changed;
  }

  // 调整制度的适用部门：检索与制度中心都会立刻按新的可见范围生效
  function changePolicyScope(policyId, scope) {
    var data = loadData();
    var target = String(scope || '').trim();
    if (!target) return { ok: false, message: '请选择适用范围。' };
    if (target !== '全员' && data.departments.indexOf(target) === -1) {
      return { ok: false, message: '适用范围需要是“全员”或现有部门。' };
    }

    for (var i = 0; i < data.policies.length; i++) {
      var policy = data.policies[i];
      if (policy && policy.id === policyId) {
        if (policy.status !== 'published' && policy.status !== 'offline' && policy.status !== 'ready') {
          return { ok: false, message: '只有已发布、已下架或待发布的制度可以调整适用范围。' };
        }
        policy.scope = target;
        saveData(data);
        return { ok: true, policy: policy };
      }
    }
    return { ok: false, message: '找不到这条制度。' };
  }

  function retryPolicy(policyId) {
    var data = loadData();
    for (var i = 0; i < data.policies.length; i++) {
      var policy = data.policies[i];
      if (policy && policy.id === policyId) {
        if (policy.status !== 'failed') return { ok: false, message: '只有解析失败的制度可以重试。' };
        policy.status = 'queued';
        policy.createdAt = new Date().toISOString();
        policy.parseStartedAt = '';
        policy.parseFinishedAt = '';
        policy.failReason = '';
        policy.parsedText = '';
        saveData(data);
        return { ok: true, policy: policy };
      }
    }
    return { ok: false, message: '找不到这条制度。' };
  }

  function publishPolicy(policyId) {
    var data = loadData();
    for (var i = 0; i < data.policies.length; i++) {
      var policy = data.policies[i];
      if (policy && policy.id === policyId) {
        if (policy.status !== 'ready' && policy.status !== 'offline') {
          return { ok: false, message: '只有“待发布”或“已下架”的制度可以发布。' };
        }
        if (policy.status === 'ready') {
          var gate = getPolicyConflictGate(policyId);
          if (gate.unreviewed > 0) {
            return { ok: false, message: '尚有 ' + gate.unreviewed + ' 项未确认', code: 'conflict_unreviewed', unreviewed: gate.unreviewed };
          }
        }
        policy.status = 'published';
        policy.publishedAt = new Date().toISOString();
        pushAuditEntry(data, '发布制度', '制度《' + policy.name + '》 ' + policy.version);
        saveData(data);
        return { ok: true, policy: policy };
      }
    }
    return { ok: false, message: '找不到这条制度。' };
  }

  function offlinePolicy(policyId) {
    var data = loadData();
    for (var i = 0; i < data.policies.length; i++) {
      var policy = data.policies[i];
      if (policy && policy.id === policyId) {
        if (policy.status !== 'published') return { ok: false, message: '只有已发布的制度可以下架。' };
        policy.status = 'offline';
        pushAuditEntry(data, '下架制度', '制度《' + policy.name + '》 ' + policy.version);
        saveData(data);
        return { ok: true, policy: policy };
      }
    }
    return { ok: false, message: '找不到这条制度。' };
  }

  // 原始文件只通过页面上的受控下载读取，不暴露任何可猜测的地址
  function getPolicyFileData(policyId) {
    if (!policyId) return null;
    return readRaw(POLICY_FILE_PREFIX + policyId);
  }

  /* ---------- 制度可见性：列表 / 详情 / 下载 / 后续问答 都只能用这一套规则 ---------- */

  function currentDateISO() {
    var d = new Date();
    var month = d.getMonth() + 1;
    var day = d.getDate();
    return d.getFullYear() + '-' + (month < 10 ? '0' + month : month) + '-' + (day < 10 ? '0' + day : day);
  }

  function isPolicyEffective(policy, today) {
    if (!policy || !policy.effectiveDate) return false;
    var date = today || currentDateISO();
    return String(policy.effectiveDate) <= date;
  }

  /**
   * 唯一的“谁能看到哪份制度”判断：
   * 已发布 + 在有效期内 + 适用范围是“全员”或本人所在部门。
   * 智能问答也必须调用这个函数，不能另外实现一套。
   */
  function isPolicyVisibleTo(policy, user) {
    if (!policy || !user) return false;
    if (user.enabled === false) return false;
    if (policy.status !== 'published') return false;
    if (!isPolicyEffective(policy)) return false;
    if (policy.scope === '全员') return true;
    return String(policy.scope || '').trim() === String(user.department || '').trim();
  }

  function listVisiblePolicies(user) {
    return listPolicies().filter(function (policy) {
      return isPolicyVisibleTo(policy, user);
    });
  }

  function findVisiblePolicy(user, policyId) {
    var policies = listVisiblePolicies(user);
    for (var i = 0; i < policies.length; i++) {
      if (policies[i].id === policyId) return policies[i];
    }
    return null;
  }

  /* ================== 年假管理（流水制） ================== */

  var LEAVE_ENTRY_LABELS = { manual: '手动调整', reconcile: '对账调整' };

  function round2(value) {
    return Math.round(Number(value) * 100) / 100;
  }

  function listLeaveEntries(userId, year) {
    var entries = loadData().leaveEntries.filter(function (entry) {
      if (!entry) return false;
      if (userId && entry.userId !== userId) return false;
      if (year !== undefined && year !== null && String(entry.year) !== String(year)) return false;
      return true;
    });

    entries.sort(function (a, b) {
      return String(b.createdAt).localeCompare(String(a.createdAt));
    });
    return entries;
  }

  function getLeaveBalance(userId, year) {
    return round2(listLeaveEntries(userId, year).reduce(function (sum, entry) {
      return sum + Number(entry.delta || 0);
    }, 0));
  }

  function getLeaveLastUpdated(userId, year) {
    var entries = listLeaveEntries(userId, year);
    return entries.length ? entries[0].createdAt : '';
  }

  /**
   * 新增一条年假流水（余额永远通过流水合计得出，不单独存余额字段）。
   * info = { userId, year, delta, reason, type: 'manual'|'reconcile', createdBy }
   * delta 为正表示增加，为负表示减少。
   */
  function addLeaveEntry(info) {
    var data = loadData();

    var user = null;
    for (var i = 0; i < data.users.length; i++) {
      if (data.users[i] && data.users[i].id === info.userId) {
        user = data.users[i];
        break;
      }
    }
    if (!user) return { ok: false, message: '请选择员工。' };

    var year = String(info.year == null ? '' : info.year).trim();
    if (!/^\d{4}$/.test(year) || Number(year) < 2000 || Number(year) > 2100) {
      return { ok: false, message: '年度不合法，请选择 2000–2100 之间的年份。' };
    }

    if (info.delta === '' || info.delta === null || typeof info.delta === 'undefined') {
      return { ok: false, message: '请填写调整天数。' };
    }
    var delta = Number(info.delta);
    if (!isFinite(delta)) {
      return { ok: false, message: '调整天数只能填数字，例如 2 或 1.5。' };
    }
    if (delta === 0) {
      return { ok: false, message: '调整天数不能为 0。' };
    }
    if (Math.abs(delta) > 365) {
      return { ok: false, message: '单次调整不能超过 365 天。' };
    }
    delta = round2(delta);

    var reason = String(info.reason || '').trim();
    if (!reason) return { ok: false, message: '请填写调整原因。' };
    if (reason.length > 100) return { ok: false, message: '调整原因最多 100 个字。' };

    var entry = {
      id: uid('leave'),
      userId: user.id,
      year: year,
      delta: delta,
      reason: reason,
      type: info.type === 'reconcile' ? 'reconcile' : 'manual',
      createdAt: new Date().toISOString(),
      createdBy: String(info.createdBy || '')
    };

    data.leaveEntries.push(entry);
    pushAuditEntry(data, '调整年假', '员工 ' + user.name + ' · ' + year + ' 年度 · ' + (delta > 0 ? '+' : '') + delta + ' 天');
    if (!saveData(data)) return { ok: false, message: '保存失败，本机存储空间可能已满。' };

    return { ok: true, entry: entry };
  }

  /**
   * 谁能查看某个员工的年假：
   * 本人可以；有“leave:manage”权限的 HR/系统管理员也可以（后台管理用）。
   * 员工端的“我的年假”只能查自己，页面按钮被改也绕不过这里。
   */
  function canViewUserLeave(actor, targetUserId) {
    if (!actor || !targetUserId) return false;
    if (actor.id === targetUserId) return true;
    return window.OnboardRoles.can(actor, 'leave:manage');
  }

  function listLeaveEntriesFor(actor, targetUserId, year) {
    if (!canViewUserLeave(actor, targetUserId)) return [];
    return listLeaveEntries(targetUserId, year);
  }

  function getLeaveBalanceFor(actor, targetUserId, year) {
    if (!canViewUserLeave(actor, targetUserId)) return null;
    return getLeaveBalance(targetUserId, year);
  }

  function getLeaveLastUpdatedFor(actor, targetUserId, year) {
    if (!canViewUserLeave(actor, targetUserId)) return '';
    return getLeaveLastUpdated(targetUserId, year);
  }

  /* ================== 模型配置（密钥加密保存在本机） ================== */

  function bytesToBase64(bytes) {
    var binary = '';
    for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return window.btoa(binary);
  }

  function base64ToBytes(text) {
    var binary = window.atob(String(text || ''));
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function getSubtleCrypto() {
    var cryptoObj = window.crypto;
    return cryptoObj && cryptoObj.subtle ? cryptoObj : null;
  }

  function ensureDeviceKeyRaw() {
    var cryptoObj = getSubtleCrypto();
    if (!cryptoObj) throw new Error('当前浏览器不支持安全加密（crypto.subtle 不可用）。');

    var raw = readRaw(DEVICE_KEY);
    if (raw) return raw;

    var bytes = new Uint8Array(32);
    cryptoObj.getRandomValues(bytes);
    raw = bytesToBase64(bytes);
    writeRaw(DEVICE_KEY, raw);
    return raw;
  }

  function getDeviceCryptoKey() {
    var cryptoObj = getSubtleCrypto();
    if (!cryptoObj) return Promise.reject(new Error('当前浏览器不支持安全加密（crypto.subtle 不可用）。'));
    var raw = base64ToBytes(ensureDeviceKeyRaw());
    return cryptoObj.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  }

  // 密钥使用本机设备密钥做 AES-GCM 加密后保存；页面上永远不出现明文
  function encryptSecret(plainText) {
    return getDeviceCryptoKey().then(function (key) {
      var cryptoObj = getSubtleCrypto();
      var iv = new Uint8Array(12);
      cryptoObj.getRandomValues(iv);
      var data = new TextEncoder().encode(String(plainText));
      return cryptoObj.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, data).then(function (cipherBuffer) {
        return bytesToBase64(iv) + '.' + bytesToBase64(new Uint8Array(cipherBuffer));
      });
    });
  }

  function decryptSecret(payload) {
    if (!payload) return Promise.resolve('');
    var parts = String(payload).split('.');
    if (parts.length !== 2) return Promise.resolve('');
    return getDeviceCryptoKey().then(function (key) {
      var cryptoObj = getSubtleCrypto();
      var iv = base64ToBytes(parts[0]);
      var data = base64ToBytes(parts[1]);
      return cryptoObj.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, data).then(function (plainBuffer) {
        return new TextDecoder().decode(plainBuffer);
      }).catch(function () {
        return '';
      });
    }).catch(function () {
      return '';
    });
  }

  /**
   * 读取模型配置（不含密钥，只告诉调用方“是否已保存密钥”）。
   */
  function getModelConfig() {
    var config = readJson(MODEL_CONFIG_KEY);
    if (!config || typeof config !== 'object') config = {};

    return {
      baseUrl: String(config.baseUrl || ''),
      model: String(config.model || ''),
      temperature: typeof config.temperature === 'number' ? config.temperature : 0.3,
      maxTokens: typeof config.maxTokens === 'number' ? config.maxTokens : 1024,
      version: Number(config.version || 0),
      updatedAt: String(config.updatedAt || ''),
      updatedBy: String(config.updatedBy || ''),
      hasKey: !!config.keyEncrypted
    };
  }

  /**
   * 保存模型配置：校验 → 加密密钥（如填写）→ 版本号 +1 → 写入操作审计。
   * 返回 { ok:true, version } 或 { ok:false, message }。
   */
  function saveModelConfig(info) {
    var baseUrl = String(info.baseUrl || '').trim();
    var model = String(info.model || '').trim();
    var temperature = Number(info.temperature);
    var maxTokens = Number(info.maxTokens);
    var apiKey = String(info.apiKey || '');

    if (!/^https?:\/\/.+/i.test(baseUrl)) {
      return Promise.resolve({ ok: false, message: '接口地址需要以 http:// 或 https:// 开头。' });
    }
    if (!model) {
      return Promise.resolve({ ok: false, message: '请填写模型名称。' });
    }
    if (!isFinite(temperature) || temperature < 0 || temperature > 1) {
      return Promise.resolve({ ok: false, message: '回答随机度需要在 0 到 1 之间。' });
    }
    if (Math.round(temperature * 10) !== temperature * 10) {
      return Promise.resolve({ ok: false, message: '回答随机度请按 0.1 的步长填写。' });
    }
    if (!isFinite(maxTokens) || Math.round(maxTokens) !== maxTokens || maxTokens < 512 || maxTokens > 6000) {
      return Promise.resolve({ ok: false, message: '单次回答最大长度需要在 512 到 6000 之间（整数）。' });
    }

    var current = readJson(MODEL_CONFIG_KEY) || {};
    if (!apiKey && !current.keyEncrypted) {
      return Promise.resolve({ ok: false, message: '请填写模型服务密钥。' });
    }

    var encryptPromise = apiKey ? encryptSecret(apiKey) : Promise.resolve(current.keyEncrypted || '');

    return encryptPromise.then(function (keyEncrypted) {
      var version = Number(current.version || 0) + 1;
      var actor = currentUser();
      var updatedBy = actor ? actor.name : '';
      var now = new Date().toISOString();

      var changed = [];
      if (String(current.baseUrl || '') !== baseUrl) changed.push('接口地址');
      if (String(current.model || '') !== model) changed.push('模型名称');
      if (Number(current.temperature) !== temperature) changed.push('回答随机度');
      if (Number(current.maxTokens) !== maxTokens) changed.push('单次回答最大长度');
      if (apiKey) changed.push('密钥');

      var saved = writeJson(MODEL_CONFIG_KEY, {
        baseUrl: baseUrl,
        model: model,
        temperature: temperature,
        maxTokens: maxTokens,
        version: version,
        updatedAt: now,
        updatedBy: updatedBy,
        keyEncrypted: keyEncrypted
      });

      if (!saved) return { ok: false, message: '保存失败，本机存储空间可能已满。' };

      var data = loadData();
      pushAuditEntry(data, '修改模型配置', '模型配置 v' + version, actor);
      saveData(data);

      return { ok: true, version: version };
    }).catch(function (err) {
      return { ok: false, message: '密钥加密失败：' + ((err && err.message) ? err.message : String(err)) };
    });
  }

  // 只在“测试连接”时内部解密使用，不对外返回
  function getModelSecret() {
    var config = readJson(MODEL_CONFIG_KEY);
    if (!config || !config.keyEncrypted) return Promise.resolve('');
    return decryptSecret(config.keyEncrypted);
  }

  function listAuditLog(limit) {
    var log = loadData().auditLog.slice();
    return typeof limit === 'number' ? log.slice(0, limit) : log;
  }

  /* ================== 员工服务助手（咨询会话，仅本人可见） ================== */

  var CHAT_MAX_TEXT = 2000;
  var CHAT_TITLE_MAX = 20;

  function chatTitleOf(text) {
    var value = String(text || '').replace(/\s+/g, ' ').trim();
    return value.length > CHAT_TITLE_MAX ? value.slice(0, CHAT_TITLE_MAX) + '…' : value;
  }

  /**
   * 咨询会话只属于提问的员工本人。
   * 列表、读取、追加消息都用当前登录用户校验，不提供“按 ID 随便读”的接口。
   */
  function listMyChatSessions(actor) {
    if (!actor) return [];
    return loadData().chatSessions.filter(function (session) {
      return session && session.userId === actor.id;
    }).sort(function (a, b) {
      return String(b.updatedAt).localeCompare(String(a.updatedAt));
    });
  }

  function getMyChatSession(actor, sessionId) {
    if (!actor || !sessionId) return null;
    var sessions = loadData().chatSessions;
    for (var i = 0; i < sessions.length; i++) {
      var session = sessions[i];
      if (session && session.id === sessionId && session.userId === actor.id) return session;
    }
    return null;
  }

  function createChatSession(actor, firstQuestion) {
    if (!actor) return { ok: false, message: '请先登录。' };

    var text = String(firstQuestion == null ? '' : firstQuestion).trim();
    if (!text) return { ok: false, message: '请输入你的问题。' };
    if (text.length > CHAT_MAX_TEXT) return { ok: false, message: '问题最多 2000 个字。' };

    var now = new Date().toISOString();
    var session = {
      id: uid('chat'),
      userId: actor.id,
      title: chatTitleOf(text),
      createdAt: now,
      updatedAt: now,
      messages: [{ id: uid('msg'), role: 'user', content: text, createdAt: now }]
    };

    var data = loadData();
    data.chatSessions.unshift(session);
    saveData(data);
    return { ok: true, session: session };
  }

  function appendChatMessage(actor, sessionId, role, content, extra) {
    if (!actor) return { ok: false, message: '请先登录。' };
    if (role !== 'user' && role !== 'assistant') return { ok: false, message: '消息类型不合法。' };

    var text = String(content == null ? '' : content).trim();
    var status = extra && extra.status ? String(extra.status) : '';
    if (!text && status !== 'pending') return { ok: false, message: '消息不能为空。' };
    if (role === 'user' && text.length > CHAT_MAX_TEXT) return { ok: false, message: '问题最多 2000 个字。' };

    var data = loadData();
    var session = null;
    for (var i = 0; i < data.chatSessions.length; i++) {
      if (data.chatSessions[i] && data.chatSessions[i].id === sessionId) {
        session = data.chatSessions[i];
        break;
      }
    }
    if (!session) return { ok: false, message: '找不到这段咨询。' };
    if (session.userId !== actor.id) return { ok: false, message: '只能查看自己的咨询记录。' };

    var now = new Date().toISOString();
    var message = { id: uid('msg'), role: role, content: text, createdAt: now };

    if (extra && typeof extra === 'object') {
      if (extra.status) message.status = extra.status;
      if (extra.answer) message.answer = extra.answer;
      if (extra.error) message.error = extra.error;
    }

    session.messages.push(message);
    session.updatedAt = now;
    if (role === 'user' && !session.title) session.title = chatTitleOf(text);

    saveData(data);
    return { ok: true, session: session, message: message };
  }

  // 只更新自己的咨询消息（生成完成/失败时改同一条占位消息，不会新增一条回答）
  function updateChatMessage(actor, sessionId, messageId, patch) {
    if (!actor) return { ok: false, message: '请先登录。' };

    var data = loadData();
    var session = null;
    for (var i = 0; i < data.chatSessions.length; i++) {
      if (data.chatSessions[i] && data.chatSessions[i].id === sessionId) {
        session = data.chatSessions[i];
        break;
      }
    }
    if (!session) return { ok: false, message: '找不到这段咨询。' };
    if (session.userId !== actor.id) return { ok: false, message: '只能修改自己的咨询记录。' };

    for (var j = 0; j < session.messages.length; j++) {
      if (session.messages[j] && session.messages[j].id === messageId) {
        var fields = ['content', 'status', 'answer', 'error', 'elapsedMs', 'modelName'];
        if (patch && typeof patch === 'object') {
          fields.forEach(function (field) {
            if (Object.prototype.hasOwnProperty.call(patch, field)) session.messages[j][field] = patch[field];
          });
        }
        session.updatedAt = new Date().toISOString();
        saveData(data);
        return { ok: true, message: session.messages[j] };
      }
    }
    return { ok: false, message: '找不到这条消息。' };
  }

  /* ================== 回答反馈与 HR 员工问询 ================== */

  var FEEDBACK_REASONS = ['回答不准确', '制度已过时', '没有解决问题', '引用不匹配'];

  function cloneJson(value) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      return null;
    }
  }

  function canReviewAllChats(actor) {
    return !!(actor && window.OnboardRoles && window.OnboardRoles.can(actor, 'feedback:view-all'));
  }

  /**
   * 记录一条回答反馈：保存原问题、当时的完整回答、当时引用的制度版本和时间。
   * 只能给本人的回答反馈；同一条回答只能反馈一次。
   */
  function addChatFeedback(actor, sessionId, messageId, input) {
    if (!actor) return { ok: false, message: '请先登录。' };

    var data = loadData();
    var session = null;
    for (var i = 0; i < data.chatSessions.length; i++) {
      if (data.chatSessions[i] && data.chatSessions[i].id === sessionId) {
        session = data.chatSessions[i];
        break;
      }
    }
    if (!session) return { ok: false, message: '找不到这段咨询。' };
    if (session.userId !== actor.id) return { ok: false, message: '只能给自己的咨询反馈。' };

    var messages = session.messages || [];
    var messageIndex = -1;
    for (var j = 0; j < messages.length; j++) {
      if (messages[j] && messages[j].id === messageId) {
        messageIndex = j;
        break;
      }
    }
    if (messageIndex === -1) return { ok: false, message: '找不到这条回答。' };

    var message = messages[messageIndex];
    if (message.role !== 'assistant') return { ok: false, message: '只能对回答反馈。' };
    if (message.status !== 'done' || !message.answer) {
      return { ok: false, message: '这条回答还没有完成，暂时不能反馈。' };
    }
    if (message.feedback) return { ok: false, message: '这条回答已经反馈过了。' };

    var helpful = !!(input && input.helpful === true);
    var reason = String((input && input.reason) || '').trim();
    var note = String((input && input.note) || '').trim();

    if (!helpful) {
      if (FEEDBACK_REASONS.indexOf(reason) === -1) return { ok: false, message: '请选择没有帮助的原因。' };
      if (note.length > 200) return { ok: false, message: '补充说明最多 200 个字。' };
    } else {
      reason = '';
      note = '';
    }

    var question = '';
    for (var k = messageIndex - 1; k >= 0; k--) {
      if (messages[k] && messages[k].role === 'user') {
        question = messages[k].content;
        break;
      }
    }

    var now = new Date().toISOString();
    var feedback = {
      id: uid('fb'),
      sessionId: sessionId,
      messageId: messageId,
      userId: actor.id,
      userName: actor.name,
      department: actor.department,
      question: question,
      answerSnapshot: cloneJson(message.answer),
      helpful: helpful,
      reason: reason,
      note: note,
      createdAt: now,
      followUpStatus: 'pending',
      followUpNote: '',
      followUpHistory: []
    };

    data.feedbacks.push(feedback);
    message.feedback = { id: feedback.id, helpful: helpful, reason: reason, note: note, createdAt: now };
    session.updatedAt = now;
    saveData(data);

    return { ok: true, feedback: feedback };
  }

  // HR / 系统管理员：列出全部咨询（员工端仍只能看自己的）
  function listChatSessionsForReview(actor) {
    if (!canReviewAllChats(actor)) return [];

    var data = loadData();
    return data.chatSessions.map(function (session) {
      if (!session) return null;

      var user = getUserById(session.userId);
      var messages = session.messages || [];
      var hasPending = false;
      var hasFailed = false;
      var hasDone = false;

      messages.forEach(function (message) {
        if (!message || message.role !== 'assistant') return;
        if (message.status === 'pending') hasPending = true;
        else if (message.status === 'failed') hasFailed = true;
        else if (message.status === 'done') hasDone = true;
      });

      var sessionFeedbacks = data.feedbacks.filter(function (feedback) {
        return feedback && feedback.sessionId === session.id;
      });
      var negative = sessionFeedbacks.filter(function (feedback) { return !feedback.helpful; });
      var positive = sessionFeedbacks.filter(function (feedback) { return feedback.helpful; });

      return {
        id: session.id,
        title: session.title,
        userId: session.userId,
        userName: user ? user.name : '（账号已删除）',
        account: user ? user.account : '',
        department: user ? user.department : '',
        searchText: [session.title, user ? user.name : '', user ? user.account : '', user ? user.department : '']
          .concat(messages.filter(function (message) { return message && message.role === 'user'; })
            .map(function (message) { return message.content; }))
          .join(' ').toLowerCase(),
        latestQuestion: (function () {
          for (var i = messages.length - 1; i >= 0; i--) {
            if (messages[i] && messages[i].role === 'user') return messages[i].content;
          }
          return '';
        })(),
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        messageCount: messages.length,
        status: hasPending ? 'pending' : (hasFailed ? 'failed' : (hasDone ? 'done' : 'empty')),
        feedbackCount: sessionFeedbacks.length,
        positiveCount: positive.length,
        negativeCount: negative.length,
        latestNegativeReason: negative.length ? negative[negative.length - 1].reason : '',
        latestFeedbackAt: sessionFeedbacks.length ? sessionFeedbacks[sessionFeedbacks.length - 1].createdAt : ''
      };
    }).filter(Boolean).sort(function (left, right) {
      return String(right.updatedAt).localeCompare(String(left.updatedAt));
    });
  }

  // 查看某段咨询详情：本人或有复盘权限的 HR / 系统管理员
  function getChatSessionForReview(actor, sessionId) {
    if (!actor || !sessionId) return null;

    var data = loadData();
    var session = null;
    for (var i = 0; i < data.chatSessions.length; i++) {
      if (data.chatSessions[i] && data.chatSessions[i].id === sessionId) {
        session = data.chatSessions[i];
        break;
      }
    }
    if (!session) return null;
    if (session.userId !== actor.id && !canReviewAllChats(actor)) return null;

    return {
      id: session.id,
      title: session.title,
      userId: session.userId,
      user: getUserById(session.userId),
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      messages: session.messages || [],
      feedbacks: data.feedbacks.filter(function (feedback) {
        return feedback && feedback.sessionId === session.id;
      })
    };
  }

  /* ================== 转人工工单 ================== */

  var TICKET_STATUSES = [
    { code: 'pending', label: '待处理' },
    { code: 'processing', label: '处理中' },
    { code: 'resolved', label: '已解决' },
    { code: 'closed', label: '已关闭' }
  ];

  function ticketStatusLabel(code) {
    for (var i = 0; i < TICKET_STATUSES.length; i++) {
      if (TICKET_STATUSES[i].code === code) return TICKET_STATUSES[i].label;
    }
    return code || '';
  }

  function ticketTitleOf(summary) {
    var firstLine = String(summary || '').split('\n')[0].replace(/^问题[：:]\s*/, '').trim();
    return firstLine.length > 30 ? firstLine.slice(0, 30) + '…' : firstLine;
  }

  function canViewAllTickets(actor) {
    return !!(actor && window.OnboardRoles && window.OnboardRoles.can(actor, 'ticket:manage-all'));
  }

  function findTicket(data, ticketId) {
    for (var i = 0; i < data.tickets.length; i++) {
      if (data.tickets[i] && data.tickets[i].id === ticketId) return data.tickets[i];
    }
    return null;
  }

  function ticketActorLabel(actor) {
    var roles = window.OnboardRoles;
    return roles && roles.labelOf ? roles.labelOf(actor.role) : '员工';
  }

  /**
   * 员工确认摘要后提交工单。只保存员工确认过的摘要，不保存整段聊天。
   */
  function createTicket(actor, input) {
    if (!actor) return { ok: false, message: '请先登录。' };

    var summary = String((input && input.summary) || '').trim();
    if (!summary) return { ok: false, message: '请填写事项摘要。' };
    if (summary.length > 1000) return { ok: false, message: '事项摘要最多 1000 个字。' };

    var data = loadData();
    var now = new Date().toISOString();
    var ticket = {
      id: uid('ticket'),
      title: ticketTitleOf(summary),
      sessionId: String((input && input.sessionId) || ''),
      employeeId: actor.id,
      employeeName: actor.name,
      department: actor.department,
      summary: summary,
      status: 'pending',
      assigneeId: '',
      assigneeName: '',
      timeline: [{
        id: uid('ticketevent'),
        type: 'created',
        actorId: actor.id,
        actorName: actor.name,
        actorRole: ticketActorLabel(actor),
        text: '提交工单',
        fromStatus: '',
        toStatus: 'pending',
        createdAt: now
      }],
      createdAt: now,
      updatedAt: now
    };

    data.tickets.unshift(ticket);
    saveData(data);
    return { ok: true, ticket: ticket };
  }

  function listMyTickets(actor) {
    if (!actor) return [];
    return loadData().tickets.filter(function (ticket) {
      return ticket && ticket.employeeId === actor.id;
    }).sort(function (left, right) {
      return String(right.updatedAt).localeCompare(String(left.updatedAt));
    });
  }

  function listAssignedTickets(actor) {
    if (!actor) return [];
    return loadData().tickets.filter(function (ticket) {
      return ticket && ticket.assigneeId === actor.id && ticket.employeeId !== actor.id;
    }).sort(function (left, right) {
      return String(right.updatedAt).localeCompare(String(left.updatedAt));
    });
  }

  // HR / 管理员：全部工单；普通经办人：只看分给自己的
  function listTicketsForService(actor) {
    if (!actor) return [];
    if (canViewAllTickets(actor)) {
      return loadData().tickets.slice().sort(function (left, right) {
        return String(right.updatedAt).localeCompare(String(left.updatedAt));
      });
    }
    return listAssignedTickets(actor);
  }

  function getTicketForActor(actor, ticketId) {
    if (!actor || !ticketId) return null;
    var ticket = findTicket(loadData(), ticketId);
    if (!ticket) return null;
    if (ticket.employeeId === actor.id) return ticket;
    if (ticket.assigneeId === actor.id) return ticket;
    if (canViewAllTickets(actor)) return ticket;
    return null;
  }

  function assignTicket(actor, ticketId, assigneeId) {
    if (!actor) return { ok: false, message: '请先登录。' };
    if (!canViewAllTickets(actor)) return { ok: false, message: '只有 HR / 管理员可以指派经办人。' };

    var assignee = getUserById(assigneeId);
    if (!assignee || assignee.enabled === false) return { ok: false, message: '请选择一位启用中的经办人。' };

    var data = loadData();
    var ticket = findTicket(data, ticketId);
    if (!ticket) return { ok: false, message: '找不到这张工单。' };

    var now = new Date().toISOString();
    ticket.assigneeId = assignee.id;
    ticket.assigneeName = assignee.name;
    ticket.updatedAt = now;
    ticket.timeline.push({
      id: uid('ticketevent'),
      type: 'assign',
      actorId: actor.id,
      actorName: actor.name,
      actorRole: ticketActorLabel(actor),
      text: '指派给 ' + assignee.name,
      createdAt: now
    });
    saveData(data);
    return { ok: true, ticket: ticket };
  }

  function replyTicket(actor, ticketId, text) {
    if (!actor) return { ok: false, message: '请先登录。' };
    var content = String(text || '').trim();
    if (!content) return { ok: false, message: '请填写回复内容。' };
    if (content.length > 500) return { ok: false, message: '回复最多 500 个字。' };

    var data = loadData();
    var ticket = findTicket(data, ticketId);
    if (!ticket) return { ok: false, message: '找不到这张工单。' };

    var isOwner = ticket.employeeId === actor.id;
    var isAssignee = ticket.assigneeId === actor.id;
    if (!isOwner && !isAssignee && !canViewAllTickets(actor)) {
      return { ok: false, message: '你没有回复这张工单的权限。' };
    }
    if (ticket.status === 'closed') return { ok: false, message: '工单已关闭，不能再回复。' };

    var now = new Date().toISOString();
    ticket.timeline.push({
      id: uid('ticketevent'),
      type: 'reply',
      actorId: actor.id,
      actorName: actor.name,
      actorRole: isOwner ? '员工' : ticketActorLabel(actor),
      text: content,
      createdAt: now
    });
    ticket.updatedAt = now;
    saveData(data);
    return { ok: true, ticket: ticket };
  }

  function updateTicketStatus(actor, ticketId, status) {
    if (!actor) return { ok: false, message: '请先登录。' };
    if (!canViewAllTickets(actor)) return { ok: false, message: '只有 HR / 管理员可以修改工单状态。' };

    var label = ticketStatusLabel(status);
    if (['pending', 'processing', 'resolved', 'closed'].indexOf(status) === -1) {
      return { ok: false, message: '状态不合法。' };
    }

    var data = loadData();
    var ticket = findTicket(data, ticketId);
    if (!ticket) return { ok: false, message: '找不到这张工单。' };
    if (ticket.status === status) return { ok: false, message: '工单已经是这个状态了。' };

    var now = new Date().toISOString();
    var fromLabel = ticketStatusLabel(ticket.status);
    ticket.status = status;
    ticket.updatedAt = now;
    ticket.timeline.push({
      id: uid('ticketevent'),
      type: 'status',
      actorId: actor.id,
      actorName: actor.name,
      actorRole: ticketActorLabel(actor),
      text: '状态由「' + fromLabel + '」改为「' + label + '」',
      fromStatus: ticket.status,
      toStatus: status,
      createdAt: now
    });
    saveData(data);
    return { ok: true, ticket: ticket };
  }

  /* ================== 入职任务（模板与分派） ================== */

  function canManageOnboarding(actor) {
    return !!(actor && window.OnboardRoles && window.OnboardRoles.can(actor, 'ticket:manage-all'));
  }

  function dateOnly(value) {
    var text = String(value || '');
    return text.slice(0, 10);
  }

  function addDays(dateText, days) {
    var parts = String(dateText || '').split('-');
    var date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    if (isNaN(date.getTime())) return '';
    date.setDate(date.getDate() + Number(days));
    var month = date.getMonth() + 1;
    var day = date.getDate();
    return date.getFullYear() + '-' + (month < 10 ? '0' + month : month) + '-' + (day < 10 ? '0' + day : day);
  }

  function validateTemplateInput(info) {
    var name = String((info && info.name) || '').trim();
    var description = String((info && info.description) || '').trim();
    var dueDays = Number(info && info.dueDays);

    if (!name) return { ok: false, message: '请填写任务名称。' };
    if (name.length > 40) return { ok: false, message: '任务名称最多 40 个字。' };
    if (description.length > 300) return { ok: false, message: '任务说明最多 300 个字。' };
    if (!isFinite(dueDays) || Math.round(dueDays) !== dueDays || dueDays < 0 || dueDays > 365) {
      return { ok: false, message: '截止天数需要填 0–365 之间的整数。' };
    }
    return { ok: true, name: name, description: description, dueDays: dueDays };
  }

  function listTaskTemplates(actor) {
    if (!canManageOnboarding(actor)) return [];
    return loadData().taskTemplates.slice();
  }

  function createTaskTemplate(actor, info) {
    if (!canManageOnboarding(actor)) return { ok: false, message: '只有 HR / 管理员可以维护入职任务模板。' };

    var checked = validateTemplateInput(info);
    if (!checked.ok) return checked;

    var data = loadData();
    var duplicate = data.taskTemplates.some(function (template) {
      return String(template.name) === checked.name;
    });
    if (duplicate) return { ok: false, message: '已经有同名的任务模板了。' };

    var now = new Date().toISOString();
    var template = {
      id: uid('tasktpl'),
      name: checked.name,
      description: checked.description,
      dueDays: checked.dueDays,
      createdAt: now,
      updatedAt: now
    };
    data.taskTemplates.push(template);
    saveData(data);
    return { ok: true, template: template };
  }

  function updateTaskTemplate(actor, templateId, info) {
    if (!canManageOnboarding(actor)) return { ok: false, message: '只有 HR / 管理员可以维护入职任务模板。' };

    var checked = validateTemplateInput(info);
    if (!checked.ok) return checked;

    var data = loadData();
    var template = null;
    for (var i = 0; i < data.taskTemplates.length; i++) {
      if (data.taskTemplates[i] && data.taskTemplates[i].id === templateId) {
        template = data.taskTemplates[i];
        break;
      }
    }
    if (!template) return { ok: false, message: '找不到这个任务模板。' };

    var duplicate = data.taskTemplates.some(function (item) {
      return item.id !== templateId && String(item.name) === checked.name;
    });
    if (duplicate) return { ok: false, message: '已经有同名的任务模板了。' };

    template.name = checked.name;
    template.description = checked.description;
    template.dueDays = checked.dueDays;
    template.updatedAt = new Date().toISOString();
    saveData(data);
    return { ok: true, template: template };
  }

  function deleteTaskTemplate(actor, templateId) {
    if (!canManageOnboarding(actor)) return { ok: false, message: '只有 HR / 管理员可以维护入职任务模板。' };

    var data = loadData();
    var before = data.taskTemplates.length;
    data.taskTemplates = data.taskTemplates.filter(function (template) {
      return template.id !== templateId;
    });
    if (data.taskTemplates.length === before) return { ok: false, message: '找不到这个任务模板。' };

    saveData(data);
    return { ok: true };
  }

  /**
   * 把模板分派给员工：按员工入职日 + 相对天数生成日历截止日期，
   * 并把当时的名称、说明、天数保存为快照；之后模板改动不影响已分派任务。
   */
  function assignOnboardingTasks(actor, employeeId, templateIds) {
    if (!canManageOnboarding(actor)) return { ok: false, message: '只有 HR / 管理员可以分派入职任务。' };

    var data = loadData();
    var employee = null;
    for (var i = 0; i < data.users.length; i++) {
      if (data.users[i] && data.users[i].id === employeeId) {
        employee = data.users[i];
        break;
      }
    }
    if (!employee) return { ok: false, message: '请选择员工。' };
    if (employee.enabled === false) return { ok: false, message: '这个员工账号已停用，不能分派任务。' };

    var ids = Array.isArray(templateIds) ? templateIds : [];
    var templates = data.taskTemplates.filter(function (template) {
      return ids.indexOf(template.id) !== -1;
    });
    if (!templates.length) return { ok: false, message: '请至少选择一个任务模板。' };

    var onboardingDate = dateOnly(employee.createdAt) || new Date().toISOString().slice(0, 10);
    var existingTemplateIds = {};
    data.onboardingTasks.forEach(function (task) {
      if (task && task.employeeId === employee.id) existingTemplateIds[task.templateId] = true;
    });

    var now = new Date().toISOString();
    var created = [];
    var skipped = [];

    templates.forEach(function (template) {
      if (existingTemplateIds[template.id]) {
        skipped.push(template.name);
        return;
      }
      var dueDate = addDays(onboardingDate, template.dueDays);
      var task = {
        id: uid('task'),
        employeeId: employee.id,
        employeeName: employee.name,
        department: employee.department,
        templateId: template.id,
        name: template.name,
        description: template.description,
        dueDays: template.dueDays,
        onboardingDate: onboardingDate,
        dueDate: dueDate,
        snapshot: {
          name: template.name,
          description: template.description,
          dueDays: template.dueDays
        },
        completed: false,
        completedAt: '',
        assignedBy: actor.name,
        assignedAt: now
      };
      data.onboardingTasks.push(task);
      existingTemplateIds[template.id] = true;
      created.push(task);
    });

    if (created.length) saveData(data);
    return { ok: true, created: created, skipped: skipped };
  }

  function listEmployeeOnboardingTasks(actor, employeeId) {
    if (!actor) return [];
    var targetId = employeeId || actor.id;
    if (targetId !== actor.id && !canManageOnboarding(actor)) return [];
    return loadData().onboardingTasks.filter(function (task) {
      return task && task.employeeId === targetId;
    }).sort(function (left, right) {
      return String(left.dueDate).localeCompare(String(right.dueDate));
    });
  }

  function listAllOnboardingTasks(actor) {
    if (!canManageOnboarding(actor)) return [];
    return loadData().onboardingTasks.slice().sort(function (left, right) {
      return String(left.dueDate).localeCompare(String(right.dueDate));
    });
  }

  function completeOnboardingTask(actor, taskId) {
    if (!actor) return { ok: false, message: '请先登录。' };

    var data = loadData();
    var task = null;
    for (var i = 0; i < data.onboardingTasks.length; i++) {
      if (data.onboardingTasks[i] && data.onboardingTasks[i].id === taskId) {
        task = data.onboardingTasks[i];
        break;
      }
    }
    if (!task) return { ok: false, message: '找不到这个入职任务。' };
    if (task.employeeId !== actor.id) return { ok: false, message: '只能完成自己的入职任务。' };
    if (task.completed) return { ok: false, message: '这个任务已经标记完成了。' };

    task.completed = true;
    task.completedAt = new Date().toISOString();
    saveData(data);
    return { ok: true, task: task };
  }

  /* ================== 差评反馈跟进（服务管理） ================== */

  var FEEDBACK_FOLLOWUP_STATUSES = [
    { code: 'pending', label: '待处理' },
    { code: 'processing', label: '处理中' },
    { code: 'handled', label: '已处理' }
  ];

  function feedbackFollowUpLabel(code) {
    for (var i = 0; i < FEEDBACK_FOLLOWUP_STATUSES.length; i++) {
      if (FEEDBACK_FOLLOWUP_STATUSES[i].code === code) return FEEDBACK_FOLLOWUP_STATUSES[i].label;
    }
    return code || '';
  }

  function canManageFeedbackFollowUps(actor) {
    return !!(actor && window.OnboardRoles && window.OnboardRoles.can(actor, 'ticket:manage-all'));
  }

  // 差评自动成为待处理事项；按时间倒序列出
  function listNegativeFeedbacksForService(actor) {
    if (!canManageFeedbackFollowUps(actor)) return [];
    return loadData().feedbacks.filter(function (feedback) {
      return feedback && feedback.helpful === false;
    }).sort(function (left, right) {
      return String(right.createdAt).localeCompare(String(left.createdAt));
    });
  }

  function getFeedbackForService(actor, feedbackId) {
    if (!canManageFeedbackFollowUps(actor) || !feedbackId) return null;
    var feedbacks = loadData().feedbacks;
    for (var i = 0; i < feedbacks.length; i++) {
      if (feedbacks[i] && feedbacks[i].id === feedbackId) return feedbacks[i];
    }
    return null;
  }

  function updateFeedbackFollowUp(actor, feedbackId, input) {
    if (!canManageFeedbackFollowUps(actor)) {
      return { ok: false, message: '只有 HR / 管理员可以处理反馈。' };
    }

    var status = String((input && input.status) || '').trim();
    var note = String((input && input.note) || '').trim();
    var valid = FEEDBACK_FOLLOWUP_STATUSES.some(function (item) { return item.code === status; });
    if (!valid) return { ok: false, message: '反馈处理状态不合法。' };
    if (note.length > 500) return { ok: false, message: '处理说明最多 500 个字。' };

    var data = loadData();
    var feedback = null;
    for (var i = 0; i < data.feedbacks.length; i++) {
      if (data.feedbacks[i] && data.feedbacks[i].id === feedbackId) {
        feedback = data.feedbacks[i];
        break;
      }
    }
    if (!feedback) return { ok: false, message: '找不到这条反馈。' };
    if (feedback.followUpStatus === status && feedback.followUpNote === note) {
      return { ok: false, message: '状态和说明都没有变化。' };
    }

    var now = new Date().toISOString();
    feedback.followUpStatus = status;
    feedback.followUpNote = note;
    feedback.followUpUpdatedAt = now;
    feedback.followUpBy = actor.name;
    feedback.followUpHistory.push({
      id: uid('fbhistory'),
      status: status,
      note: note,
      actorId: actor.id,
      actorName: actor.name,
      createdAt: now
    });
    saveData(data);
    return { ok: true, feedback: feedback };
  }

  /**
   * 把差评问题保存成评测题（阶段 10 的评测集使用）。
   * 需要人工确认已去除敏感内容；不会自动修改制度或任何设置。
   */
  function addEvaluationQuestion(actor, feedbackId, input) {
    if (!canManageFeedbackFollowUps(actor)) {
      return { ok: false, message: '只有 HR / 管理员可以加入评测集。' };
    }
    if (!input || input.confirmed !== true) {
      return { ok: false, message: '请先确认已去除敏感内容。' };
    }

    var question = String(input.question || '').trim();
    if (!question) return { ok: false, message: '请填写评测题目。' };
    if (question.length > 300) return { ok: false, message: '评测题目最多 300 个字。' };

    var data = loadData();
    var feedback = null;
    for (var i = 0; i < data.feedbacks.length; i++) {
      if (data.feedbacks[i] && data.feedbacks[i].id === feedbackId) {
        feedback = data.feedbacks[i];
        break;
      }
    }
    if (!feedback) return { ok: false, message: '找不到这条反馈。' };
    if (feedback.helpful !== false) return { ok: false, message: '只有“没有帮助”的反馈可以加入评测集。' };

    var duplicate = data.evalQuestions.some(function (item) {
      return item && item.question === question;
    });
    if (duplicate) return { ok: false, message: '评测集里已经有这道题了。' };

    var now = new Date().toISOString();
    var evalQuestion = {
      id: uid('evalq'),
      question: question,
      sourceFeedbackId: feedbackId,
      createdBy: actor.name,
      createdAt: now
    };
    data.evalQuestions.push(evalQuestion);
    feedback.evalQuestionId = evalQuestion.id;
    saveData(data);
    return { ok: true, evalQuestion: evalQuestion };
  }

  function listEvaluationQuestions(actor) {
    if (!canManageFeedbackFollowUps(actor)) return [];
    return loadData().evalQuestions.slice();
  }

  /* ================== 制度签收 与 消息与待办 ================== */

  function signPolicy(actor, policyId) {
    if (!actor) return { ok: false, message: '请先登录。' };
    var policy = findVisiblePolicy(actor, policyId);
    if (!policy) return { ok: false, message: '这份制度暂时不可查看，可能已下架或不在你的适用范围内。' };
    if (!policy.requireSignoff) return { ok: false, message: '这份制度不需要签收。' };

    var data = loadData();
    var already = data.policySignoffs.some(function (item) {
      return item && item.policyId === policyId && item.userId === actor.id;
    });
    if (already) return { ok: false, message: '你已经签收过这份制度了。' };

    var record = {
      id: uid('signoff'),
      policyId: policyId,
      userId: actor.id,
      signedAt: new Date().toISOString()
    };
    data.policySignoffs.push(record);
    saveData(data);
    return { ok: true, signoff: record };
  }

  function getPolicySignoff(actor, policyId) {
    if (!actor || !policyId) return null;
    var records = loadData().policySignoffs;
    for (var i = 0; i < records.length; i++) {
      if (records[i] && records[i].policyId === policyId && records[i].userId === actor.id) return records[i];
    }
    return null;
  }

  function listPendingSignoffPolicies(actor) {
    if (!actor) return [];
    return listVisiblePolicies(actor).filter(function (policy) {
      return policy.requireSignoff && !getPolicySignoff(actor, policy.id);
    });
  }

  function readMapFor(data, userId) {
    if (!data.messageReads[userId] || typeof data.messageReads[userId] !== 'object') data.messageReads[userId] = {};
    return data.messageReads[userId];
  }

  function markMessageRead(actor, messageKey) {
    if (!actor || !messageKey) return { ok: false, message: '参数不完整。' };
    var data = loadData();
    var map = readMapFor(data, actor.id);
    if (map[messageKey]) return { ok: true, already: true };
    map[messageKey] = new Date().toISOString();
    saveData(data);
    return { ok: true };
  }

  function markAllMessagesRead(actor) {
    if (!actor) return { ok: false, message: '请先登录。' };
    var items = listMyMessages(actor);
    var data = loadData();
    var map = readMapFor(data, actor.id);
    var now = new Date().toISOString();
    items.forEach(function (item) {
      map[item.key] = now;
    });
    saveData(data);
    return { ok: true, count: items.length };
  }

  /**
   * 汇总当前员工的消息与待办。只返回本人的事项：
   * 入职任务、工单的新回复/状态变化、差评反馈处理结果、待签收制度。
   */
  function listMyMessages(actor) {
    if (!actor) return [];
    var data = loadData();
    var readMap = readMapFor(data, actor.id);
    var items = [];

    data.onboardingTasks.forEach(function (task) {
      if (!task || task.employeeId !== actor.id) return;
      var overdue = !task.completed && task.dueDate && task.dueDate < currentDateISO();
      items.push({
        key: 'task:' + task.id,
        type: '入职任务',
        title: task.name,
        detail: (task.description || '') + '（截止 ' + task.dueDate + '）',
        time: task.completedAt || task.assignedAt || task.createdAt || '',
        read: !!readMap['task:' + task.id],
        completed: !!task.completed,
        statusLabel: task.completed ? '已完成' : (overdue ? '已逾期' : '待完成'),
        actionType: 'task',
        target: { page: 'tickets', taskId: task.id }
      });
    });

    data.tickets.forEach(function (ticket) {
      if (!ticket || ticket.employeeId !== actor.id) return;
      var done = ticket.status === 'resolved' || ticket.status === 'closed';
      (ticket.timeline || []).forEach(function (event) {
        if (!event || (event.type !== 'reply' && event.type !== 'status')) return;
        if (event.actorId === actor.id) return;

        var key = 'ticket:' + ticket.id + ':' + event.id;
        items.push({
          key: key,
          type: '工单更新',
          title: event.type === 'reply' ? '工单回复：' + ticket.title : '工单状态更新：' + ticket.title,
          detail: event.text || '',
          time: event.createdAt || ticket.updatedAt,
          read: !!readMap[key],
          completed: done,
          statusLabel: done ? ticketStatusLabel(ticket.status) : (ticket.status === 'processing' ? '处理中' : '待处理'),
          actionType: 'ticket',
          target: { page: 'tickets', ticketId: ticket.id }
        });
      });
    });

    data.feedbacks.forEach(function (feedback) {
      if (!feedback || feedback.userId !== actor.id || feedback.helpful !== false) return;
      var handled = feedback.followUpStatus === 'handled';
      (feedback.followUpHistory || []).forEach(function (entry) {
        if (!entry) return;
        var key = 'feedback:' + feedback.id + ':' + entry.id;
        items.push({
          key: key,
          type: '反馈处理',
          title: '反馈处理结果：' + (feedback.reason || '没有帮助'),
          detail: entry.note || feedbackFollowUpLabel(entry.status),
          time: entry.createdAt,
          read: !!readMap[key],
          completed: handled,
          statusLabel: feedbackFollowUpLabel(feedback.followUpStatus || 'pending'),
          actionType: 'feedback',
          target: { page: 'assistant', sessionId: feedback.sessionId }
        });
      });
    });

    // 签收活动（发起时确定的名单；新入职员工不会自动加入）
    var campaignPolicyIds = [];
    data.signoffCampaigns.forEach(function (campaign) {
      if (!campaign) return;
      var isRecipient = (campaign.recipients || []).some(function (recipient) {
        return recipient.userId === actor.id;
      });
      if (!isRecipient) return;
      if (campaignSignatureFor(campaign, actor.id)) return;

      campaignPolicyIds.push(campaign.policyId);
      var key = 'signoff:' + campaign.id;
      items.push({
        key: key,
        type: '制度签收',
        title: '待签收：' + campaign.policyName,
        detail: '版本 ' + campaign.snapshotVersion + ' · ' + campaign.scope + ' · 发起于 ' + String(campaign.createdAt).slice(0, 10),
        time: campaign.createdAt,
        read: !!readMap[key],
        completed: false,
        statusLabel: '待签收',
        actionType: 'signoff',
        target: { page: 'mySignoffs', campaignId: campaign.id }
      });
    });

    listPendingSignoffPolicies(actor).forEach(function (policy) {
      if (campaignPolicyIds.indexOf(policy.id) !== -1) return;
      var key = 'policy:' + policy.id;
      items.push({
        key: key,
        type: '制度签收',
        title: '待签收：' + policy.name,
        detail: '版本 ' + policy.version + ' · 生效 ' + policy.effectiveDate,
        time: policy.publishedAt || (policy.effectiveDate + 'T00:00:00'),
        read: !!readMap[key],
        completed: false,
        statusLabel: '待签收',
        actionType: 'policy',
        target: { page: 'policyCenter', policyId: policy.id }
      });
    });

    items.sort(function (left, right) {
      return String(right.time || '').localeCompare(String(left.time || ''));
    });
    return items;
  }

  /* ================== 制度更新与签收（签收活动） ================== */

  function canManageSignoffs(actor) {
    return !!(actor && window.OnboardRoles && window.OnboardRoles.can(actor, 'policy:manage'));
  }

  function splitPolicyLines(text) {
    return String(text || '').replace(/\r\n/g, '\n').split('\n').map(function (line) {
      return line.trim();
    }).filter(Boolean);
  }

  function lineBigrams(text) {
    var value = String(text || '').replace(/[，。；：！？、,.!?;:"'“”‘’（）()\[\]【】《》<>\s]/g, '');
    var grams = [];
    for (var i = 0; i < value.length - 1; i++) grams.push(value.slice(i, i + 2));
    return grams;
  }

  function lineSimilarity(left, right) {
    var leftGrams = lineBigrams(left);
    var rightGrams = lineBigrams(right);
    if (!leftGrams.length || !rightGrams.length) return 0;
    var rightCount = {};
    rightGrams.forEach(function (gram) { rightCount[gram] = (rightCount[gram] || 0) + 1; });
    var common = 0;
    leftGrams.forEach(function (gram) {
      if (rightCount[gram]) {
        common += 1;
        rightCount[gram] -= 1;
      }
    });
    return common / Math.max(leftGrams.length, rightGrams.length);
  }

  // 行级对比：按 LCS 找未变行，再在变动块里配对出“修改”
  function diffPolicyTexts(currentText, previousText) {
    var current = splitPolicyLines(currentText);
    var previous = splitPolicyLines(previousText);
    var rows = current.length;
    var cols = previous.length;
    var dp = [];
    for (var i = 0; i <= rows; i++) {
      dp.push(new Array(cols + 1).fill(0));
    }
    for (i = rows - 1; i >= 0; i--) {
      for (var j = cols - 1; j >= 0; j--) {
        dp[i][j] = current[i] === previous[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }

    var matches = [];
    i = 0;
    j = 0;
    while (i < rows && j < cols) {
      if (current[i] === previous[j]) {
        matches.push({ currentIndex: i, previousIndex: j });
        i += 1;
        j += 1;
      } else if (dp[i + 1][j] >= dp[i][j + 1]) {
        i += 1;
      } else {
        j += 1;
      }
    }

    var added = [];
    var removed = [];
    var changed = [];

    function pairBlock(previousLines, currentLines) {
      var pairCount = Math.min(previousLines.length, currentLines.length);
      for (var k = 0; k < pairCount; k++) {
        if (lineSimilarity(previousLines[k], currentLines[k]) >= 0.5) {
          changed.push({ from: previousLines[k], to: currentLines[k] });
        } else {
          removed.push(previousLines[k]);
          added.push(currentLines[k]);
        }
      }
      previousLines.slice(pairCount).forEach(function (line) { removed.push(line); });
      currentLines.slice(pairCount).forEach(function (line) { added.push(line); });
    }

    var previousCursor = -1;
    var currentCursor = -1;
    matches.forEach(function (match) {
      pairBlock(previous.slice(previousCursor + 1, match.previousIndex), current.slice(currentCursor + 1, match.currentIndex));
      previousCursor = match.previousIndex;
      currentCursor = match.currentIndex;
    });
    pairBlock(previous.slice(previousCursor + 1), current.slice(currentCursor + 1));

    return { added: added, removed: removed, changed: changed };
  }

  function findPreviousPolicyText(data, policy) {
    var candidates = data.policies.filter(function (item) {
      return item && item.id !== policy.id && item.name === policy.name &&
        item.parsedText && String(item.createdAt) < String(policy.createdAt);
    }).sort(function (left, right) {
      return String(right.createdAt).localeCompare(String(left.createdAt));
    });
    if (candidates.length) return candidates[0].parsedText;

    var campaigns = data.signoffCampaigns.filter(function (campaign) {
      return campaign && campaign.policyId === policy.id && campaign.snapshotText;
    }).sort(function (left, right) {
      return String(right.createdAt).localeCompare(String(left.createdAt));
    });
    return campaigns.length ? campaigns[0].snapshotText : '';
  }

  // 发起前预览差异（不会写入任何数据）
  function previewSignoffDiff(actor, policyId) {
    if (!canManageSignoffs(actor)) return { ok: false, message: '只有 HR / 管理员可以发起签收。' };
    var data = loadData();
    var policy = null;
    for (var i = 0; i < data.policies.length; i++) {
      if (data.policies[i] && data.policies[i].id === policyId) {
        policy = data.policies[i];
        break;
      }
    }
    if (!policy) return { ok: false, message: '找不到这份制度。' };
    if (policy.status !== 'published') return { ok: false, message: '只有已发布的制度可以发起签收。' };
    if (!policy.parsedText) return { ok: false, message: '这份制度还没有可阅读的正文。' };

    var previousText = findPreviousPolicyText(data, policy);
    var diff = diffPolicyTexts(policy.parsedText, previousText);
    return {
      ok: true,
      policy: policy,
      hasPrevious: !!previousText,
      diff: diff
    };
  }

  function createSignoffCampaign(actor, info) {
    if (!canManageSignoffs(actor)) return { ok: false, message: '只有 HR / 管理员可以发起签收。' };

    var data = loadData();
    var policy = null;
    for (var i = 0; i < data.policies.length; i++) {
      if (data.policies[i] && data.policies[i].id === info.policyId) {
        policy = data.policies[i];
        break;
      }
    }
    if (!policy) return { ok: false, message: '找不到这份制度。' };
    if (policy.status !== 'published') return { ok: false, message: '只有已发布的制度可以发起签收。' };
    if (!policy.parsedText) return { ok: false, message: '这份制度还没有可阅读的正文。' };

    var scope = String(info.scope || '全员').trim();
    if (scope !== '全员' && data.departments.indexOf(scope) === -1) {
      return { ok: false, message: '签收范围需要是“全员”或现有部门。' };
    }

    var recipients = data.users.filter(function (user) {
      return user && user.enabled !== false && (scope === '全员' || user.department === scope);
    }).map(function (user) {
      return { userId: user.id, name: user.name, account: user.account, department: user.department };
    });
    if (!recipients.length) return { ok: false, message: '这个范围内没有可签收的员工。' };

    var previousText = findPreviousPolicyText(data, policy);
    var diff = diffPolicyTexts(policy.parsedText, previousText);
    var now = new Date().toISOString();

    var campaign = {
      id: uid('campaign'),
      policyId: policy.id,
      policyName: policy.name,
      snapshotVersion: policy.version,
      snapshotText: policy.parsedText,
      snapshotFileName: policy.fileName,
      scope: scope,
      recipients: recipients,
      signatures: [],
      diff: diff,
      createdBy: actor.name,
      createdAt: now
    };

    data.signoffCampaigns.unshift(campaign);
    pushAuditEntry(data, '发起签收', '制度《' + campaign.policyName + '》 ' + campaign.snapshotVersion + ' · ' + campaign.scope, actor);
    saveData(data);
    return { ok: true, campaign: campaign };
  }

  function getSignoffCampaignForActor(actor, campaignId) {
    if (!actor || !campaignId) return null;
    var data = loadData();
    var campaign = null;
    for (var i = 0; i < data.signoffCampaigns.length; i++) {
      if (data.signoffCampaigns[i] && data.signoffCampaigns[i].id === campaignId) {
        campaign = data.signoffCampaigns[i];
        break;
      }
    }
    if (!campaign) return null;
    if (canManageSignoffs(actor)) return campaign;
    var isRecipient = campaign.recipients.some(function (recipient) {
      return recipient.userId === actor.id;
    });
    return isRecipient ? campaign : null;
  }

  function campaignSignatureFor(campaign, userId) {
    for (var i = 0; i < (campaign.signatures || []).length; i++) {
      if (campaign.signatures[i].userId === userId) return campaign.signatures[i];
    }
    return null;
  }

  function listSignoffCampaigns(actor) {
    if (!actor) return [];
    var data = loadData();
    var campaigns = canManageSignoffs(actor)
      ? data.signoffCampaigns.slice()
      : data.signoffCampaigns.filter(function (campaign) {
        return campaign && campaign.recipients.some(function (recipient) {
          return recipient.userId === actor.id;
        });
      });
    return campaigns.sort(function (left, right) {
      return String(right.createdAt).localeCompare(String(left.createdAt));
    });
  }

  function signSignoffCampaign(actor, campaignId) {
    if (!actor) return { ok: false, message: '请先登录。' };
    var data = loadData();
    var campaign = null;
    for (var i = 0; i < data.signoffCampaigns.length; i++) {
      if (data.signoffCampaigns[i] && data.signoffCampaigns[i].id === campaignId) {
        campaign = data.signoffCampaigns[i];
        break;
      }
    }
    if (!campaign) return { ok: false, message: '找不到这次签收活动。' };

    var isRecipient = campaign.recipients.some(function (recipient) {
      return recipient.userId === actor.id;
    });
    if (!isRecipient) return { ok: false, message: '这次签收没有把你列入范围。' };
    if (campaignSignatureFor(campaign, actor.id)) return { ok: false, message: '你已经签收过这份制度了。' };

    campaign.signatures.push({
      userId: actor.id,
      name: actor.name,
      department: actor.department,
      version: campaign.snapshotVersion,
      signedAt: new Date().toISOString()
    });
    saveData(data);
    return { ok: true, campaign: campaign };
  }

  /* ================== 知识缺口诊断（管理工作台） ================== */

  var GAP_STATUSES = [
    { code: 'pending', label: '待处理' },
    { code: 'processing', label: '处理中' },
    { code: 'supplemented', label: '已补充知识' },
    { code: 'ignored', label: '无需处理' }
  ];

  function gapStatusLabel(code) {
    for (var i = 0; i < GAP_STATUSES.length; i++) {
      if (GAP_STATUSES[i].code === code) return GAP_STATUSES[i].label;
    }
    return code || '';
  }

  function canManageGaps(actor) {
    return !!(actor && window.OnboardRoles && window.OnboardRoles.can(actor, 'page:knowledge-gaps'));
  }

  // 这里用“关键词相近”做演示归组，不是真正的语义聚类
  function gapNormalizeQuestion(text) {
    return String(text || '').replace(/[\s，。！？、；：,.!?;:~～（）()【】\[\]「」《》"“”'']/g, '').toLowerCase();
  }

  function gapBigrams(text) {
    var value = gapNormalizeQuestion(text);
    var grams = [];
    for (var i = 0; i < value.length - 1; i++) grams.push(value.slice(i, i + 2));
    return grams;
  }

  function gapSimilarity(leftBigrams, rightBigrams) {
    if (!leftBigrams.length || !rightBigrams.length) return 0;
    var leftSet = {};
    var rightSet = {};
    leftBigrams.forEach(function (gram) { leftSet[gram] = true; });
    rightBigrams.forEach(function (gram) { rightSet[gram] = true; });
    var common = 0;
    Object.keys(leftSet).forEach(function (gram) { if (rightSet[gram]) common += 1; });
    return common / (Object.keys(leftSet).length + Object.keys(rightSet).length - common);
  }

  function gapKeyOf(text) {
    var value = gapNormalizeQuestion(text);
    var hash = 2166136261;
    for (var i = 0; i < value.length; i++) {
      hash ^= value.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return 'gap:' + (hash >>> 0).toString(16);
  }

  function knowledgeGapEvents(data) {
    var userById = {};
    data.users.forEach(function (user) { userById[user.id] = user; });
    var events = [];

    data.chatSessions.forEach(function (session) {
      if (!session) return;
      var question = '';
      (session.messages || []).forEach(function (message) {
        if (!message) return;
        if (message.role === 'user') {
          question = message.content || question;
          return;
        }
        if (message.role !== 'assistant' || message.status !== 'done' || !message.answer) return;
        var answerStatus = message.answer.status || message.answer.mode;
        if (answerStatus !== 'insufficient') return;
        var user = userById[session.userId];
        events.push({
          question: question || session.title || '（未记录问题）',
          source: '依据不足',
          time: message.createdAt || session.updatedAt,
          department: user ? user.department : '',
          userName: user ? user.name : ''
        });
      });
    });

    data.feedbacks.forEach(function (feedback) {
      if (!feedback || feedback.helpful !== false) return;
      events.push({
        question: feedback.question || '（未记录问题）',
        source: '没有帮助',
        time: feedback.createdAt,
        department: feedback.department || '',
        userName: feedback.userName || ''
      });
    });

    data.tickets.forEach(function (ticket) {
      if (!ticket) return;
      events.push({
        question: ticket.title || ticket.summary || '（未记录问题）',
        source: '转人工',
        time: ticket.createdAt,
        department: ticket.department || '',
        userName: ticket.employeeName || ''
      });
    });

    return events.sort(function (left, right) {
      return String(left.time || '').localeCompare(String(right.time || ''));
    });
  }

  function listGapAssignees(actor) {
    if (!canManageGaps(actor)) return [];
    return loadData().users.filter(function (user) {
      return user && user.enabled !== false &&
        ['hr_admin', 'sys_admin', 'ops_admin'].indexOf(user.role) !== -1;
    }).map(function (user) {
      return { id: user.id, name: user.name, department: user.department };
    });
  }

  function listKnowledgeGaps(actor) {
    if (!canManageGaps(actor)) return [];
    var data = loadData();
    var events = knowledgeGapEvents(data);
    var groups = [];

    events.forEach(function (event) {
      var bigrams = gapBigrams(event.question);
      var best = null;
      var bestScore = 0;
      groups.forEach(function (group) {
        var score = gapSimilarity(group.bigrams, bigrams);
        if (score > bestScore) {
          bestScore = score;
          best = group;
        }
      });
      if (best && bestScore >= 0.5) {
        best.events.push(event);
      } else {
        groups.push({ bigrams: bigrams, events: [event] });
      }
    });

    return groups.map(function (group) {
      var first = group.events[0];
      var key = gapKeyOf(first.question);
      var state = data.gapStates[key] || {};

      var departments = [];
      var sources = [];
      var lastTime = '';
      group.events.forEach(function (event) {
        if (event.department && departments.indexOf(event.department) === -1) departments.push(event.department);
        if (event.source && sources.indexOf(event.source) === -1) sources.push(event.source);
        if (String(event.time || '') > String(lastTime)) lastTime = event.time;
      });

      return {
        key: key,
        title: first.question,
        count: group.events.length,
        lastTime: lastTime,
        departments: departments,
        sources: sources,
        events: group.events,
        status: state.status || 'pending',
        statusLabel: gapStatusLabel(state.status || 'pending'),
        assigneeId: state.assigneeId || '',
        assigneeName: state.assigneeName || '',
        note: state.note || '',
        evalQuestionId: state.evalQuestionId || '',
        updatedAt: state.updatedAt || ''
      };
    }).sort(function (left, right) {
      return String(right.lastTime || '').localeCompare(String(left.lastTime || ''));
    });
  }

  function updateGapState(actor, gapKey, input) {
    if (!canManageGaps(actor)) return { ok: false, message: '只有管理工作台可以处理知识缺口。' };

    var status = String((input && input.status) || '').trim();
    var validStatus = GAP_STATUSES.some(function (item) { return item.code === status; });
    if (!validStatus) return { ok: false, message: '知识缺口状态不合法。' };

    var note = String((input && input.note) || '').trim();
    if (note.length > 500) return { ok: false, message: '处理说明最多 500 个字。' };

    var data = loadData();
    var assigneeId = String((input && input.assigneeId) || '').trim();
    var assigneeName = '';
    if (assigneeId) {
      var assignee = null;
      data.users.forEach(function (user) {
        if (user && user.id === assigneeId && user.enabled !== false) assignee = user;
      });
      if (!assignee) return { ok: false, message: '找不到这位跟进人。' };
      assigneeName = assignee.name;
    }

    var current = data.gapStates[gapKey] || {};
    var now = new Date().toISOString();
    var history = current.history || [];
    history.push({
      id: uid('gaphistory'),
      status: status,
      assigneeName: assigneeName,
      note: note,
      actorId: actor.id,
      actorName: actor.name,
      createdAt: now
    });

    data.gapStates[gapKey] = {
      status: status,
      assigneeId: assigneeId,
      assigneeName: assigneeName,
      note: note,
      evalQuestionId: current.evalQuestionId || '',
      updatedAt: now,
      updatedBy: actor.name,
      history: history.slice(-20)
    };
    saveData(data);
    return { ok: true, state: data.gapStates[gapKey] };
  }

  function addGapEvalQuestion(actor, gapKey, input) {
    if (!canManageGaps(actor)) return { ok: false, message: '只有管理工作台可以加入评测集。' };
    if (!input || input.confirmed !== true) {
      return { ok: false, message: '请先确认已去除个人敏感信息。' };
    }

    var question = String(input.question || '').trim();
    if (!question) return { ok: false, message: '请填写评测题目。' };
    if (question.length > 300) return { ok: false, message: '评测题目最多 300 个字。' };

    var data = loadData();
    var duplicate = data.evalQuestions.some(function (item) {
      return item && item.question === question;
    });
    if (duplicate) return { ok: false, message: '评测集里已经有这道题了。' };

    var now = new Date().toISOString();
    var evalQuestion = {
      id: uid('evalq'),
      question: question,
      sourceType: 'gap',
      sourceGapKey: gapKey,
      createdBy: actor.name,
      createdAt: now
    };
    data.evalQuestions.push(evalQuestion);

    var current = data.gapStates[gapKey] || {};
    data.gapStates[gapKey] = {
      status: current.status || 'pending',
      assigneeId: current.assigneeId || '',
      assigneeName: current.assigneeName || '',
      note: current.note || '',
      evalQuestionId: evalQuestion.id,
      updatedAt: now,
      updatedBy: current.updatedBy || actor.name,
      history: current.history || []
    };
    saveData(data);
    return { ok: true, evalQuestion: evalQuestion };
  }

  /* ================== 回答执行轨迹 ================== */

  function canViewAllAnswerTraces(actor) {
    return !!(actor && window.OnboardRoles && window.OnboardRoles.can(actor, 'trace:view-all'));
  }

  function listAnswerTraces(actor) {
    if (!actor) return [];
    var data = loadData();
    var viewAll = canViewAllAnswerTraces(actor);
    var userById = {};
    data.users.forEach(function (user) { userById[user.id] = user; });

    var traces = [];
    data.chatSessions.forEach(function (session) {
      if (!session) return;
      if (!viewAll && session.userId !== actor.id) return;

      (session.messages || []).forEach(function (message, index) {
        if (!message || message.role !== 'assistant' || message.status !== 'done' || !message.answer) return;
        var question = '';
        for (var i = index - 1; i >= 0; i--) {
          if (session.messages[i] && session.messages[i].role === 'user') {
            question = session.messages[i].content;
            break;
          }
        }
        var user = userById[session.userId];
        traces.push({
          id: message.id,
          sessionId: session.id,
          messageId: message.id,
          userId: session.userId,
          userName: user ? user.name : '',
          department: user ? user.department : '',
          question: question || session.title || '（未记录问题）',
          createdAt: message.createdAt || session.updatedAt,
          answer: message.answer
        });
      });
    });

    return traces.sort(function (left, right) {
      return String(right.createdAt || '').localeCompare(String(left.createdAt || ''));
    });
  }

  /* ================== 开发者后台（检索调试） ================== */

  function defaultDeveloperSettings() {
    var config = window.ONBOARD_CONFIG || {};
    var retrieval = config.retrieval || {};

    return {
      configVersion: 'v1',
      promptVersion: config.promptVersion || 'prompt-v1',
      online: {
        passageLimit: typeof retrieval.topK === 'number' ? retrieval.topK : 6,
        semanticCandidates: typeof retrieval.semanticCandidates === 'number' ? retrieval.semanticCandidates : 30,
        keywordCandidates: typeof retrieval.keywordCandidates === 'number' ? retrieval.keywordCandidates : 30
      },
      draft: null,
      draftCount: 0
    };
  }

  function normalizeDeveloperSettings(raw) {
    var defaults = defaultDeveloperSettings();
    var source = raw && typeof raw === 'object' ? raw : {};
    var online = source.online && typeof source.online === 'object' ? source.online : {};

    function pickNumber(value, fallback, min, max) {
      var number = Number(value);
      if (!isFinite(number) || Math.floor(number) !== number) return fallback;
      if (number < min || number > max) return fallback;
      return number;
    }

    return {
      configVersion: String(source.configVersion || defaults.configVersion),
      promptVersion: String(source.promptVersion || defaults.promptVersion),
      online: {
        passageLimit: pickNumber(online.passageLimit, defaults.online.passageLimit, 1, 20),
        semanticCandidates: pickNumber(online.semanticCandidates, defaults.online.semanticCandidates, 1, 100),
        keywordCandidates: pickNumber(online.keywordCandidates, defaults.online.keywordCandidates, 1, 100)
      },
      draft: source.draft && typeof source.draft === 'object' ? {
        passageLimit: pickNumber(source.draft.passageLimit, defaults.online.passageLimit, 1, 20),
        semanticCandidates: pickNumber(source.draft.semanticCandidates, defaults.online.semanticCandidates, 1, 100),
        keywordCandidates: pickNumber(source.draft.keywordCandidates, defaults.online.keywordCandidates, 1, 100),
        version: String(source.draft.version || ''),
        savedAt: String(source.draft.savedAt || ''),
        savedBy: String(source.draft.savedBy || '')
      } : null,
      draftCount: pickNumber(source.draftCount, 0, 0, 99999)
    };
  }

  function canAccessDeveloper(actor) {
    return !!(actor && window.OnboardRoles && window.OnboardRoles.can(actor, 'page:developer'));
  }

  function getDeveloperSettings(actor) {
    if (!canAccessDeveloper(actor)) return null;
    var data = loadData();
    var settings = normalizeDeveloperSettings(data.developerSettings);
    return {
      configVersion: settings.configVersion,
      promptVersion: settings.promptVersion,
      online: {
        passageLimit: settings.online.passageLimit,
        semanticCandidates: settings.online.semanticCandidates,
        keywordCandidates: settings.online.keywordCandidates
      },
      draft: settings.draft ? {
        passageLimit: settings.draft.passageLimit,
        semanticCandidates: settings.draft.semanticCandidates,
        keywordCandidates: settings.draft.keywordCandidates,
        version: settings.draft.version,
        savedAt: settings.draft.savedAt,
        savedBy: settings.draft.savedBy
      } : null,
      evaluationCount: data.evalQuestions.length
    };
  }

  // 只保存草稿，不改线上配置；正式生效要等阶段 11 的发布流程
  function saveDeveloperDraft(actor, input) {
    if (!canAccessDeveloper(actor)) return { ok: false, message: '只有开发者后台可以保存检索参数。' };

    function readInteger(value, min, max, label) {
      var number = Number(value);
      if (!isFinite(number) || Math.floor(number) !== number) {
        return { ok: false, message: label + '需要填写整数。' };
      }
      if (number < min || number > max) {
        return { ok: false, message: label + '需要在 ' + min + ' 到 ' + max + ' 之间。' };
      }
      return { ok: true, value: number };
    }

    var limit = readInteger(input && input.passageLimit, 1, 20, '最终保留的原文数量');
    if (!limit.ok) return limit;
    var semantic = readInteger(input && input.semanticCandidates, 1, 100, '意思相近候选数量');
    if (!semantic.ok) return semantic;
    var keyword = readInteger(input && input.keywordCandidates, 1, 100, '关键词命中候选数量');
    if (!keyword.ok) return keyword;

    var data = loadData();
    var settings = normalizeDeveloperSettings(data.developerSettings);
    settings.draftCount += 1;
    settings.draft = {
      passageLimit: limit.value,
      semanticCandidates: semantic.value,
      keywordCandidates: keyword.value,
      version: 'draft-' + settings.draftCount,
      savedAt: new Date().toISOString(),
      savedBy: actor.name
    };
    data.developerSettings = settings;
    saveData(data);
    return { ok: true, draft: settings.draft };
  }

  /* ================== 切片管理（开发者后台） ================== */

  function canManageChunks(actor) {
    return !!canAccessDeveloper(actor);
  }

  function isChunkHeading(line) {
    return /^[一二三四五六七八九十]+[、.．]/.test(line) || /^第[一二三四五六七八九十]+[章节]/.test(line);
  }

  function buildPolicyChunks(policy, chunkLength) {
    var text = String(policy.parsedText || '');
    var lines = text.replace(/\r\n/g, '\n').split('\n');
    var target = Math.max(80, Math.min(800, Number(chunkLength) || 240));
    var pageSize = 800;
    var chunks = [];
    var current = '';
    var currentSection = '';
    var cursor = 0;

    function flush() {
      if (!current.trim()) {
        current = '';
        return;
      }
      var chunkText = current.trim();
      var at = text.indexOf(chunkText, cursor);
      if (at === -1) at = cursor;
      cursor = at + chunkText.length;
      var page = Math.floor(at / pageSize) + 1;
      chunks.push({
        id: 'chunk-' + (chunks.length + 1),
        index: chunks.length + 1,
        text: chunkText,
        charCount: chunkText.length,
        charStart: at,
        charEnd: at + chunkText.length,
        section: currentSection,
        title: currentSection || policy.name,
        policyName: policy.name,
        version: policy.version,
        scope: policy.scope,
        page: page,
        pageLabel: '第 ' + page + ' 页（按每页 800 字估算）',
        edited: false
      });
      current = '';
    }

    lines.forEach(function (rawLine) {
      var line = String(rawLine || '').trim();
      if (!line) return;

      if (isChunkHeading(line)) {
        flush();
        currentSection = line.slice(0, 40);
      }

      var pieces = [];
      if (line.length > target) {
        for (var start = 0; start < line.length; start += target) {
          pieces.push(line.slice(start, start + target));
        }
      } else {
        pieces.push(line);
      }

      pieces.forEach(function (piece) {
        if (current && (current + '\n' + piece).length > target) flush();
        current = current ? current + '\n' + piece : piece;
      });
    });
    flush();

    return chunks;
  }

  function findPolicyChunkIndex(data, policyId) {
    for (var i = 0; i < data.policyChunkIndexes.length; i++) {
      if (data.policyChunkIndexes[i] && data.policyChunkIndexes[i].policyId === policyId) {
        return data.policyChunkIndexes[i];
      }
    }
    return null;
  }

  function ensurePolicyChunks(actor, policyId) {
    if (!canManageChunks(actor)) return { ok: false, message: '只有开发者后台可以管理切片。' };
    var data = loadData();
    var policy = getPolicyById(policyId);
    if (!policy || !policy.parsedText) return { ok: false, message: '这份制度还没有可切分的正文。' };

    var existing = findPolicyChunkIndex(data, policyId);
    if (existing) return { ok: true, index: existing, policy: policy };

    var chunks = buildPolicyChunks(policy, 240);
    var index = {
      policyId: policy.id,
      version: policy.version,
      chunkLength: 240,
      chunks: chunks,
      updatedAt: new Date().toISOString(),
      builtBy: actor.name
    };
    data.policyChunkIndexes.push(index);
    saveData(data);
    return { ok: true, index: index, policy: policy };
  }

  function getPolicyChunks(actor, policyId) {
    if (!canManageChunks(actor)) return null;
    return findPolicyChunkIndex(loadData(), policyId);
  }

  function updatePolicyChunk(actor, policyId, chunkId, text) {
    if (!canManageChunks(actor)) return { ok: false, message: '只有开发者后台可以修改切片。' };
    var value = String(text == null ? '' : text).trim();
    if (!value) return { ok: false, message: '片段内容不能为空。' };
    if (value.length > 3000) return { ok: false, message: '单个片段最多 3000 个字符。' };

    var data = loadData();
    var index = findPolicyChunkIndex(data, policyId);
    if (!index) return { ok: false, message: '这份制度还没有切片索引。' };

    var chunk = null;
    index.chunks.forEach(function (item) {
      if (item.id === chunkId) chunk = item;
    });
    if (!chunk) return { ok: false, message: '找不到这个片段。' };

    chunk.text = value;
    chunk.charCount = value.length;
    chunk.edited = true;
    index.updatedAt = new Date().toISOString();
    index.editedBy = actor.name;
    saveData(data);
    return { ok: true, chunk: chunk };
  }

  function startChunkRebuild(actor, policyId, chunkLength) {
    if (!canManageChunks(actor)) return { ok: false, message: '只有开发者后台可以重新建立索引。' };

    var length = Number(chunkLength);
    if (!isFinite(length) || Math.floor(length) !== length || length < 80 || length > 800) {
      return { ok: false, message: '切分长度需要是 80 到 800 之间的整数。' };
    }

    var data = loadData();
    var policy = getPolicyById(policyId);
    if (!policy || !policy.parsedText) return { ok: false, message: '这份制度还没有可切分的正文。' };

    var task = {
      id: uid('chunktask'),
      policyId: policyId,
      policyName: policy.name,
      version: policy.version,
      chunkLength: length,
      status: 'running',
      progress: 0,
      message: '已进入后台队列，准备重新切分…',
      startedAt: new Date().toISOString(),
      finishedAt: '',
      result: null
    };
    data.chunkTasks.unshift(task);
    saveData(data);
    return { ok: true, task: task };
  }

  // 后台任务的进度推进（演示版在本机模拟，由页面定时调用）
  function advanceChunkTasks() {
    var data = loadData();
    var touched = false;

    data.chunkTasks.forEach(function (task) {
      if (!task || task.status !== 'running') return;
      touched = true;
      task.progress = Math.min(100, (Number(task.progress) || 0) + 25);

      if (task.progress < 100) {
        task.message = '正在切分制度正文… ' + task.progress + '%';
        return;
      }

      var policy = getPolicyById(task.policyId);
      if (!policy || !policy.parsedText) {
        task.status = 'failed';
        task.message = '切分失败：制度正文不存在或已被移除。';
        task.finishedAt = new Date().toISOString();
        return;
      }

      var chunks = buildPolicyChunks(policy, task.chunkLength);
      var existing = findPolicyChunkIndex(data, task.policyId);
      if (existing) {
        existing.version = policy.version;
        existing.chunkLength = task.chunkLength;
        existing.chunks = chunks;
        existing.updatedAt = new Date().toISOString();
        existing.builtBy = '后台任务';
      } else {
        data.policyChunkIndexes.push({
          policyId: policy.id,
          version: policy.version,
          chunkLength: task.chunkLength,
          chunks: chunks,
          updatedAt: new Date().toISOString(),
          builtBy: '后台任务'
        });
      }

      task.status = 'done';
      task.progress = 100;
      task.message = '切分完成，共 ' + chunks.length + ' 段。';
      task.finishedAt = new Date().toISOString();
      task.result = {
        chunkCount: chunks.length,
        chunkLength: task.chunkLength,
        version: policy.version
      };
    });

    if (touched) saveData(data);
    return data.chunkTasks.slice();
  }

  function getChunkTask(taskId) {
    var tasks = loadData().chunkTasks;
    for (var i = 0; i < tasks.length; i++) {
      if (tasks[i] && tasks[i].id === taskId) return tasks[i];
    }
    return null;
  }

  function getLatestChunkTask(actor, policyId) {
    if (!canManageChunks(actor)) return null;
    var tasks = loadData().chunkTasks.filter(function (task) {
      return task && task.policyId === policyId;
    });
    return tasks.length ? tasks[0] : null;
  }

  /* ================== 评测集与运行记录（开发者后台） ================== */

  function canManageEval(actor) {
    return !!canAccessDeveloper(actor);
  }

  function normalizeEvalQuestion(item) {
    var source = item && typeof item === 'object' ? item : {};
    var question = String(source.question || '').trim();

    return {
      id: source.id,
      name: String(source.name || ('评测题：' + question.slice(0, 24))),
      question: question,
      department: String(source.department || '技术部'),
      expectedPolicies: Array.isArray(source.expectedPolicies) ? source.expectedPolicies.filter(Boolean).map(String) : [],
      expectedKeywords: Array.isArray(source.expectedKeywords) ? source.expectedKeywords.filter(Boolean).map(String) : [],
      shouldRefuse: source.shouldRefuse === true,
      refuseType: String(source.refuseType || ''),
      sourceType: String(source.sourceType || ''),
      sourceId: String(source.sourceId || ''),
      sourceFeedbackId: String(source.sourceFeedbackId || ''),
      sourceGapKey: String(source.sourceGapKey || ''),
      createdBy: String(source.createdBy || ''),
      createdAt: String(source.createdAt || '')
    };
  }

  function evalInputToQuestion(input, previous) {
    var name = String((input && input.name) || '').trim();
    var question = String((input && input.question) || '').trim();
    if (!name) return { ok: false, message: '请填写题目名称。' };
    if (name.length > 60) return { ok: false, message: '题目名称最多 60 个字。' };
    if (!question) return { ok: false, message: '请填写问题。' };
    if (question.length > 500) return { ok: false, message: '问题最多 500 个字。' };

    var departments = loadData().departments;
    var department = String((input && input.department) || '').trim();
    if (!department || departments.indexOf(department) === -1) {
      return { ok: false, message: '请选择一个有效的提问部门。' };
    }

    var policies = Array.isArray(input && input.expectedPolicies) ? input.expectedPolicies.slice() : [];
    var keywords = Array.isArray(input && input.expectedKeywords) ? input.expectedKeywords.slice() : [];
    var shouldRefuse = !!(input && input.shouldRefuse);
    var refuseType = String((input && input.refuseType) || '');
    if (shouldRefuse && refuseType !== 'insufficient' && refuseType !== 'unauthorized') {
      return { ok: false, message: '请选择拒答类型（依据不足或越权）。' };
    }
    if (!shouldRefuse) refuseType = '';

    return {
      ok: true,
      value: {
        name: name,
        question: question,
        department: department,
        expectedPolicies: policies.filter(Boolean).map(String),
        expectedKeywords: keywords.filter(Boolean).map(String),
        shouldRefuse: shouldRefuse,
        refuseType: refuseType,
        previous: previous || null
      }
    };
  }

  function listEvaluationQuestions(actor) {
    if (!canManageFeedbackFollowUps(actor) && !canManageEval(actor)) return [];
    return loadData().evalQuestions.map(normalizeEvalQuestion);
  }

  function createEvalQuestion(actor, input) {
    if (!canManageEval(actor)) return { ok: false, message: '只有开发者后台可以维护评测集。' };
    var checked = evalInputToQuestion(input, null);
    if (!checked.ok) return checked;

    var data = loadData();
    var now = new Date().toISOString();
    var item = normalizeEvalQuestion({
      id: uid('evalq'),
      name: checked.value.name,
      question: checked.value.question,
      department: checked.value.department,
      expectedPolicies: checked.value.expectedPolicies,
      expectedKeywords: checked.value.expectedKeywords,
      shouldRefuse: checked.value.shouldRefuse,
      refuseType: checked.value.refuseType,
      sourceType: 'manual',
      createdBy: actor.name,
      createdAt: now
    });
    data.evalQuestions.push(item);
    saveData(data);
    return { ok: true, question: item };
  }

  function updateEvalQuestion(actor, questionId, input) {
    if (!canManageEval(actor)) return { ok: false, message: '只有开发者后台可以维护评测集。' };
    var data = loadData();
    var target = null;
    data.evalQuestions.forEach(function (item) {
      if (item && item.id === questionId) target = item;
    });
    if (!target) return { ok: false, message: '找不到这道评测题。' };

    var checked = evalInputToQuestion(input, target);
    if (!checked.ok) return checked;

    target.name = checked.value.name;
    target.question = checked.value.question;
    target.department = checked.value.department;
    target.expectedPolicies = checked.value.expectedPolicies;
    target.expectedKeywords = checked.value.expectedKeywords;
    target.shouldRefuse = checked.value.shouldRefuse;
    target.refuseType = checked.value.refuseType;
    saveData(data);
    return { ok: true, question: target };
  }

  function deleteEvalQuestion(actor, questionId) {
    if (!canManageEval(actor)) return { ok: false, message: '只有开发者后台可以维护评测集。' };
    var data = loadData();
    var before = data.evalQuestions.length;
    data.evalQuestions = data.evalQuestions.filter(function (item) {
      return !item || item.id !== questionId;
    });
    if (data.evalQuestions.length === before) return { ok: false, message: '找不到这道评测题。' };
    saveData(data);
    return { ok: true };
  }

  function importEvalFromFeedbacks(actor) {
    if (!canManageEval(actor)) return { ok: false, message: '只有开发者后台可以导入评测题。' };
    var data = loadData();
    var existing = {};
    data.evalQuestions.forEach(function (item) {
      if (item && item.sourceFeedbackId) existing[item.sourceFeedbackId] = true;
    });

    var added = 0;
    data.feedbacks.forEach(function (feedback) {
      if (!feedback || feedback.helpful !== false || existing[feedback.id]) return;
      var question = String(feedback.question || '').trim();
      if (!question) return;
      data.evalQuestions.push(normalizeEvalQuestion({
        id: uid('evalq'),
        name: '差评：' + String(feedback.reason || '没有帮助').slice(0, 20),
        question: question,
        department: data.departments.indexOf(feedback.department) !== -1 ? feedback.department : '技术部',
        expectedPolicies: [],
        expectedKeywords: [],
        shouldRefuse: false,
        sourceType: 'feedback',
        sourceFeedbackId: feedback.id,
        createdBy: actor.name,
        createdAt: new Date().toISOString()
      }));
      added += 1;
    });

    if (added) saveData(data);
    return { ok: true, count: added };
  }

  function importEvalFromGaps(actor) {
    if (!canManageEval(actor)) return { ok: false, message: '只有开发者后台可以导入评测题。' };
    var gaps = listKnowledgeGaps(actor);
    var data = loadData();
    var existing = {};
    data.evalQuestions.forEach(function (item) {
      if (item && item.sourceGapKey) existing[item.sourceGapKey] = true;
    });

    var added = 0;
    gaps.forEach(function (gap) {
      if (existing[gap.key]) return;
      var department = gap.events.length && data.departments.indexOf(gap.events[0].department) !== -1
        ? gap.events[0].department
        : '技术部';
      data.evalQuestions.push(normalizeEvalQuestion({
        id: uid('evalq'),
        name: '缺口：' + String(gap.title || '').slice(0, 20),
        question: gap.title,
        department: department,
        expectedPolicies: [],
        expectedKeywords: [],
        shouldRefuse: false,
        sourceType: 'gap',
        sourceGapKey: gap.key,
        createdBy: actor.name,
        createdAt: new Date().toISOString()
      }));
      added += 1;
    });

    if (added) saveData(data);
    return { ok: true, count: added };
  }

  function ensureAcceptanceEvalQuestions(actor) {
    if (!canManageEval(actor)) return { ok: false, message: '只有开发者后台可以导入评测题。' };
    var bank = Array.isArray(window.ONBOARD_QA_BANK) ? window.ONBOARD_QA_BANK : [];
    if (!bank.length) return { ok: true, count: 0 };

    var data = loadData();
    var existing = {};
    data.evalQuestions.forEach(function (item) {
      if (item && item.sourceId) existing[item.sourceId] = true;
    });

    var added = 0;
    bank.forEach(function (seed) {
      if (!seed || !seed.question || existing[seed.sourceId]) return;
      data.evalQuestions.push(normalizeEvalQuestion({
        id: uid('evalq'),
        name: seed.name || ('验收题：' + String(seed.question).slice(0, 24)),
        question: seed.question,
        department: seed.department || '技术部',
        expectedPolicies: seed.expectedPolicies || [],
        expectedKeywords: seed.expectedKeywords || [],
        shouldRefuse: seed.shouldRefuse === true,
        refuseType: seed.refuseType || '',
        sourceType: 'acceptance',
        sourceId: seed.sourceId || '',
        createdBy: actor.name,
        createdAt: new Date().toISOString()
      }));
      added += 1;
    });

    if (added) saveData(data);
    return { ok: true, count: added };
  }

  function evalFetchPolicyNames(data, answer) {
    return ((answer && answer.citations) || []).map(function (citation) {
      return String(citation.policyName || '');
    });
  }

  function evalRefusalInfo(answer) {
    var text = ((answer && answer.conclusions) || []).map(function (item) {
      return String(item.text || '');
    }).join(' ');
    var refused = !!(answer && (answer.mode === 'refused' || answer.status === 'insufficient')) ||
      /只能查看本人|超出可见范围|无法查看|不能查看|拒绝/.test(text);
    return { refused: refused, text: text };
  }

  function evaluateQuestionWithAnswer(question, answerResult) {
    var answer = answerResult && answerResult.ok ? answerResult.answer : null;
    var answerStatus = answer && answer.status ? answer.status : (answer && answer.mode ? answer.mode : 'error');
    var refusal = evalRefusalInfo(answer);
    var citedPolicies = evalFetchPolicyNames(null, answer);

    var policyCheck = {
      applicable: question.expectedPolicies.length > 0,
      passed: true,
      expected: question.expectedPolicies.slice(),
      hits: [],
      missing: []
    };
    if (policyCheck.applicable) {
      question.expectedPolicies.forEach(function (name) {
        if (citedPolicies.indexOf(name) !== -1) policyCheck.hits.push(name);
        else policyCheck.missing.push(name);
      });
      policyCheck.passed = policyCheck.missing.length === 0;
    }

    var keywordCheck = {
      applicable: question.expectedKeywords.length > 0,
      passed: true,
      expected: question.expectedKeywords.slice(),
      hits: [],
      missing: []
    };
    if (keywordCheck.applicable) {
      question.expectedKeywords.forEach(function (keyword) {
        if (refusal.text.indexOf(keyword) !== -1) keywordCheck.hits.push(keyword);
        else keywordCheck.missing.push(keyword);
      });
      keywordCheck.passed = keywordCheck.missing.length === 0;
    }

    var refusalCheck = {
      applicable: true,
      passed: true,
      expected: question.shouldRefuse,
      expectedType: question.refuseType || '',
      actual: refusal.refused
    };
    if (question.shouldRefuse) {
      refusalCheck.passed = refusal.refused;
    } else {
      refusalCheck.passed = !refusal.refused;
    }

    var checks = [policyCheck, keywordCheck, refusalCheck].filter(function (check) { return check.applicable; });
    var passedChecks = checks.filter(function (check) { return check.passed; }).length;
    var score = checks.length ? Math.round((passedChecks / checks.length) * 100) : 0;

    return {
      questionId: question.id,
      name: question.name,
      question: question.question,
      department: question.department,
      shouldRefuse: question.shouldRefuse,
      refuseType: question.refuseType || '',
      answerStatus: answerStatus,
      answerText: refusal.text,
      citedPolicies: citedPolicies,
      checks: {
        policy: policyCheck,
        keyword: keywordCheck,
        refusal: refusalCheck
      },
      score: score,
      passed: passedChecks === checks.length && checks.length > 0,
      manual: { status: '', reason: '', reviewedBy: '', reviewedAt: '' }
    };
  }

  function startEvalRun(actor, evalIds) {
    if (!canManageEval(actor)) return { ok: false, message: '只有开发者后台可以运行评测。' };
    var ids = Array.isArray(evalIds) ? evalIds : [];
    var data = loadData();
    var questions = data.evalQuestions.filter(function (item) {
      return item && ids.indexOf(item.id) !== -1;
    }).map(normalizeEvalQuestion);
    if (!questions.length) return { ok: false, message: '请至少选择一道评测题。' };

    var run = {
      id: uid('evalrun'),
      status: 'running',
      createdAt: new Date().toISOString(),
      finishedAt: '',
      total: questions.length,
      completed: 0,
      passCount: 0,
      passRate: 0,
      questions: questions.map(function (item) {
        return {
          id: item.id,
          name: item.name,
          question: item.question,
          department: item.department,
          expectedPolicies: item.expectedPolicies,
          expectedKeywords: item.expectedKeywords,
          shouldRefuse: item.shouldRefuse,
          refuseType: item.refuseType
        };
      }),
      results: [],
      createdBy: actor.name
    };
    data.evalRuns.unshift(run);
    saveData(data);
    return { ok: true, run: run };
  }

  function finishEvalRun(data, run) {
    run.status = 'done';
    run.finishedAt = new Date().toISOString();
    run.passCount = run.results.filter(function (item) { return item.passed; }).length;
    run.passRate = run.total ? Math.round((run.passCount / run.total) * 100) : 0;
  }

  /**
   * 后台逐题运行一道题（由页面定时调用）。生成回答后自动检查：
   * 应引用制度是否命中、关键词是否出现、拒答是否符合预期，并计算得分。
   */
  function runNextEvalQuestion(actor, runId) {
    if (!canManageEval(actor)) return Promise.resolve({ ok: false, message: '只有开发者后台可以运行评测。' });

    var data = loadData();
    var run = null;
    data.evalRuns.forEach(function (item) {
      if (item && item.id === runId) run = item;
    });
    if (!run) return Promise.resolve({ ok: false, message: '找不到这次评测运行。' });
    if (run.status !== 'running') return Promise.resolve({ ok: true, run: run, done: true });
    if (run.completed >= run.questions.length) {
      finishEvalRun(data, run);
      saveData(data);
      return Promise.resolve({ ok: true, run: run, done: true });
    }

    var question = run.questions[run.completed];
    var syntheticActor = {
      id: 'eval-' + question.department,
      name: '评测身份（' + question.department + '）',
      role: 'employee',
      department: question.department,
      enabled: true
    };

    return window.OnboardAnswer.generateAnswer(syntheticActor, question.question).then(function (answerResult) {
      var fresh = loadData();
      var freshRun = null;
      fresh.evalRuns.forEach(function (item) {
        if (item && item.id === runId) freshRun = item;
      });
      if (!freshRun || freshRun.status !== 'running') {
        return { ok: true, run: freshRun, done: true };
      }

      var result = evaluateQuestionWithAnswer(question, answerResult);
      freshRun.results.push(result);
      freshRun.completed += 1;
      if (freshRun.completed >= freshRun.total) finishEvalRun(fresh, freshRun);
      saveData(fresh);
      return { ok: true, run: freshRun, done: freshRun.status === 'done' };
    }).catch(function (error) {
      var fresh = loadData();
      var freshRun = null;
      fresh.evalRuns.forEach(function (item) {
        if (item && item.id === runId) freshRun = item;
      });
      if (freshRun && freshRun.status === 'running') {
        freshRun.results.push({
          questionId: question.id,
          name: question.name,
          question: question.question,
          department: question.department,
          shouldRefuse: question.shouldRefuse,
          refuseType: question.refuseType || '',
          answerStatus: 'error',
          answerText: '运行失败：' + ((error && error.message) ? error.message : String(error)),
          citedPolicies: [],
          checks: {
            policy: { applicable: question.expectedPolicies.length > 0, passed: false, expected: question.expectedPolicies, hits: [], missing: question.expectedPolicies },
            keyword: { applicable: question.expectedKeywords.length > 0, passed: false, expected: question.expectedKeywords, hits: [], missing: question.expectedKeywords },
            refusal: { applicable: true, passed: false, expected: question.shouldRefuse, expectedType: question.refuseType || '', actual: false }
          },
          score: 0,
          passed: false,
          manual: { status: '', reason: '', reviewedBy: '', reviewedAt: '' }
        });
        freshRun.completed += 1;
        if (freshRun.completed >= freshRun.total) finishEvalRun(fresh, freshRun);
        saveData(fresh);
      }
      return { ok: false, run: freshRun, message: '运行失败' };
    });
  }

  function reviewEvalResult(actor, runId, resultIndex, input) {
    if (!canManageEval(actor)) return { ok: false, message: '只有开发者后台可以人工复核。' };
    var status = String((input && input.status) || '');
    if (status !== 'pass' && status !== 'fail') return { ok: false, message: '复核结果只能是“通过”或“不通过”。' };
    var reason = String((input && input.reason) || '').trim();
    if (reason.length > 300) return { ok: false, message: '复核理由最多 300 个字。' };
    if (status === 'fail' && !reason) return { ok: false, message: '标记不通过时请写理由。' };

    var data = loadData();
    var run = null;
    data.evalRuns.forEach(function (item) { if (item && item.id === runId) run = item; });
    if (!run) return { ok: false, message: '找不到这次评测运行。' };

    var result = run.results[resultIndex];
    if (!result) return { ok: false, message: '找不到这条评测结果。' };

    result.manual = {
      status: status,
      reason: reason,
      reviewedBy: actor.name,
      reviewedAt: new Date().toISOString()
    };
    saveData(data);
    return { ok: true, result: result };
  }

  function listEvalRuns(actor) {
    if (!canManageEval(actor)) return [];
    return loadData().evalRuns.slice();
  }

  function getEvalRun(actor, runId) {
    if (!canManageEval(actor)) return null;
    var runs = loadData().evalRuns;
    for (var i = 0; i < runs.length; i++) {
      if (runs[i] && runs[i].id === runId) return runs[i];
    }
    return null;
  }

  /* ================== Prompt 管理（开发者后台） ================== */

  var PROMPT_DEFS = [
    {
      key: 'intent',
      name: '理解意图',
      description: '决定问题走哪条路。当前是本地规则判定（不调用模型）；这里记录判定口径，供对照和说明。修改它不会改变本地规则，但会在草稿版本里保留。'
    },
    {
      key: 'generation',
      name: '生成回答',
      description: '调用模型生成制度回答时使用的系统指令：只能依据给定原文、结论要逐条引用、依据不足要说明。'
    },
    {
      key: 'verification',
      name: '核验回答',
      description: '独立核验模型判断结论是否被引用原文明确支持；用于回答前的规则 + 语义核验。'
    }
  ];

  var DEFAULT_PROMPTS = {
    intent: [
      '【本地规则判定，不调用模型】',
      '先拒绝询问他人年假/个人信息的问题；再拒绝其他部门专属制度的问题。',
      '问题太短或太含糊时先追问。',
      '然后识别：个人资料、本人年假、年假 + 制度、纯制度问题。'
    ].join('\n'),
    generation: [
      '你是公司制度问答助手。只能依据下面提供的制度原文回答，不得使用常识或外部知识补充公司规定。',
      '把回答拆成若干条结论。每条结论必须由它引用的那一段原文单独支持，不得跨段拼凑。',
      '如果原文没有明确回答关键条件，请说明“依据不足”或“只能部分回答”，并在 missing 里指出缺少什么，不要猜测。',
      '每条结论必须带 citations 数组，取值为原文编号（从 1 开始）。',
      '只输出 JSON，不要输出 Markdown。格式：{"mode":"answered|partial|insufficient","conclusions":[{"text":"结论文字","citations":[1]}],"missing":"缺少什么（依据不足或部分回答时填写）"}'
    ].join('\n'),
    verification: [
      '你是独立的制度核验员，判断回答结论是否被它引用的完整原文明确支持。',
      '只依据下面提供的引用原文判断，不使用外部知识，也不替公司解释制度。',
      '如果结论扩大解释、漏掉原文里的例外或条件、或原文没有明确说明，就判为 partial 或 fail。',
      '只输出 JSON，不要输出 Markdown。格式：{"results":[{"index":1,"result":"pass|partial|fail","reason":"简短说明"}]}'
    ].join('\n')
  };

  function defaultPromptVersion() {
    return {
      id: 'prompt-v1',
      version: 'v1',
      editor: '系统初始',
      createdAt: '2026-11-07T00:00:00.000Z',
      reason: '初始版本（与当前线上提示词一致）',
      prompts: {
        intent: DEFAULT_PROMPTS.intent,
        generation: DEFAULT_PROMPTS.generation,
        verification: DEFAULT_PROMPTS.verification
      }
    };
  }

  function normalizePromptConfig(raw) {
    var source = raw && typeof raw === 'object' ? raw : {};
    var versions = Array.isArray(source.versions) ? source.versions.filter(function (item) {
      return item && item.id && item.prompts;
    }) : [];

    var normalized = versions.map(function (item, index) {
      return {
        id: String(item.id),
        version: String(item.version || ('v' + (index + 1))),
        editor: String(item.editor || ''),
        createdAt: String(item.createdAt || ''),
        reason: String(item.reason || ''),
        prompts: {
          intent: String((item.prompts && item.prompts.intent) || DEFAULT_PROMPTS.intent),
          generation: String((item.prompts && item.prompts.generation) || DEFAULT_PROMPTS.generation),
          verification: String((item.prompts && item.prompts.verification) || DEFAULT_PROMPTS.verification)
        }
      };
    });

    if (!normalized.length) normalized.push(defaultPromptVersion());
    return { versions: normalized };
  }

  function canManagePrompts(actor) {
    return !!canAccessDeveloper(actor);
  }

  function getPromptManager(actor) {
    if (!canManagePrompts(actor)) return null;
    var config = normalizePromptConfig(loadData().promptConfig);
    var versions = config.versions.slice().sort(function (left, right) {
      return String(right.createdAt).localeCompare(String(left.createdAt));
    });
    return {
      defs: PROMPT_DEFS.map(function (def) { return { key: def.key, name: def.name, description: def.description }; }),
      versions: versions,
      current: versions[0]
    };
  }

  function getPromptVersion(actor, versionId) {
    if (!canManagePrompts(actor)) return null;
    var config = normalizePromptConfig(loadData().promptConfig);
    var found = null;
    config.versions.forEach(function (item) {
      if (item.id === versionId) found = item;
    });
    return found;
  }

  function savePromptVersion(actor, input) {
    if (!canManagePrompts(actor)) return { ok: false, message: '只有开发者后台可以维护 Prompt。' };

    var reason = String((input && input.reason) || '').trim();
    if (!reason) return { ok: false, message: '请填写修改原因。' };
    if (reason.length > 300) return { ok: false, message: '修改原因最多 300 个字。' };

    var prompts = (input && input.prompts) || {};
    var cleaned = {};
    for (var i = 0; i < PROMPT_DEFS.length; i++) {
      var key = PROMPT_DEFS[i].key;
      var content = String(prompts[key] || '').trim();
      if (!content) return { ok: false, message: '“' + PROMPT_DEFS[i].name + '”的内容不能为空。' };
      if (content.length > 5000) return { ok: false, message: '“' + PROMPT_DEFS[i].name + '”最多 5000 个字。' };
      cleaned[key] = content;
    }

    var data = loadData();
    var config = normalizePromptConfig(data.promptConfig);
    var number = config.versions.length + 1;
    var version = {
      id: uid('promptv'),
      version: 'v' + number,
      editor: actor.name,
      createdAt: new Date().toISOString(),
      reason: reason,
      prompts: cleaned
    };
    config.versions.push(version);
    data.promptConfig = config;
    saveData(data);
    createReleaseDraft(actor, { prompts: cleaned, reason: reason });
    return { ok: true, version: version };
  }

  function citationsFromPassages(results) {
    return (results || []).map(function (result, index) {
      return {
        index: index + 1,
        policyId: result.policyId,
        policyName: result.policyName,
        version: result.version,
        scope: result.scope,
        section: result.section,
        paragraph: result.paragraph,
        positionLabel: result.positionLabel,
        text: result.text,
        fileName: result.fileName
      };
    });
  }

  function answerDisplayText(answer) {
    if (!answer) return '';
    var parts = ((answer.conclusions) || []).map(function (item) {
      return String(item.text || '');
    }).filter(Boolean);
    if (answer.note) parts.push(String(answer.note));
    if (answer.missing) parts.push('缺少：' + answer.missing);
    return parts.join('\n');
  }

  function answerCitationTexts(answer) {
    return ((answer && answer.citations) || []).map(function (citation) {
      return String(citation.policyName || '') + '|' + String(citation.version || '') + '|' + String(citation.text || '');
    });
  }

  /**
   * A/B 对比：两个 Prompt 版本在同一批评测题、同一批原文上各跑一遍。
   * 明确检查模型与原文是否一致；不一致时标记“不可直接比较”。
   */
  function comparePromptVersions(actor, input) {
    if (!canManagePrompts(actor)) return Promise.resolve({ ok: false, message: '只有开发者后台可以对比 Prompt。' });

    var versionA = getPromptVersion(actor, input && input.versionA);
    var versionB = getPromptVersion(actor, input && input.versionB);
    if (!versionA || !versionB) return Promise.resolve({ ok: false, message: '请选择两个有效的 Prompt 版本。' });
    if (versionA.id === versionB.id) return Promise.resolve({ ok: false, message: '请选择两个不同的版本。' });

    var ids = Array.isArray(input && input.evalIds) ? input.evalIds : [];
    var data = loadData();
    var questions = data.evalQuestions.filter(function (item) {
      return item && ids.indexOf(item.id) !== -1;
    }).map(normalizeEvalQuestion);
    if (!questions.length) return Promise.resolve({ ok: false, message: '请至少选择一道评测题。' });

    var config = storeModelConfigForCompare();
    var configured = !!(config.version && config.baseUrl && config.model && config.hasKey);
    var comparisons = [];
    var index = 0;

    function runNext() {
      if (index >= questions.length) {
        var modelNames = comparisons.map(function (item) { return item.modelName; });
        var sameModel = modelNames.every(function (name) { return name === modelNames[0]; });
        var passagesEqual = comparisons.every(function (item) {
          return JSON.stringify(item.citationsA) === JSON.stringify(item.citationsB);
        });
        var warnings = [];
        if (!configured) warnings.push('未配置模型：两边都使用本地摘要，Prompt 实际没有参与，不可直接比较。');
        if (!sameModel) warnings.push('两次运行的模型不一致（' + modelNames.join(' / ') + '），不可直接比较。');
        if (!passagesEqual) warnings.push('两道回答使用的原文不完全一致，不可直接比较。');
        var comparable = configured && sameModel && passagesEqual;

        return Promise.resolve({
          ok: true,
          comparison: {
            versionA: { id: versionA.id, version: versionA.version, reason: versionA.reason, editor: versionA.editor },
            versionB: { id: versionB.id, version: versionB.version, reason: versionB.reason, editor: versionB.editor },
            modelName: configured ? config.model : '本地摘要（演示，未调用模型）',
            createdAt: new Date().toISOString(),
            comparable: comparable,
            warnings: warnings,
            note: '这是离线对比，不等于线上真实用户的随机实验。',
            questions: comparisons
          }
        });
      }

      var question = questions[index];
      var syntheticActor = {
        id: 'prompt-ab-' + question.department,
        name: 'Prompt 对比（' + question.department + '）',
        role: 'employee',
        department: question.department,
        enabled: true
      };
      var search = window.OnboardRetrieval.searchPolicyPassages(syntheticActor, question.question);
      var citations = citationsFromPassages(search.ok ? search.results : []);

      return window.OnboardAnswer.generateAnswer(syntheticActor, question.question, {
        prompts: versionA.prompts,
        citations: citations
      }).then(function (resultA) {
        var answerA = resultA && resultA.ok ? resultA.answer : null;
        return window.OnboardAnswer.generateAnswer(syntheticActor, question.question, {
          prompts: versionB.prompts,
          citations: citations
        }).then(function (resultB) {
          var answerB = resultB && resultB.ok ? resultB.answer : null;
          var scoreA = evaluateQuestionWithAnswer(question, resultA);
          var scoreB = evaluateQuestionWithAnswer(question, resultB);

          comparisons.push({
            questionId: question.id,
            name: question.name,
            question: question.question,
            department: question.department,
            citations: citations.map(function (citation) {
              return {
                policyName: citation.policyName,
                version: citation.version,
                positionLabel: citation.positionLabel,
                text: citation.text
              };
            }),
            citationsA: answerCitationTexts(answerA),
            citationsB: answerCitationTexts(answerB),
            modelName: (answerA && answerA.modelName) || (answerB && answerB.modelName) || '',
            a: {
              text: answerDisplayText(answerA),
              status: answerA ? (answerA.status || answerA.mode || '') : 'error',
              modelName: answerA ? answerA.modelName : '',
              score: scoreA.score,
              passed: scoreA.passed,
              checks: scoreA.checks
            },
            b: {
              text: answerDisplayText(answerB),
              status: answerB ? (answerB.status || answerB.mode || '') : 'error',
              modelName: answerB ? answerB.modelName : '',
              score: scoreB.score,
              passed: scoreB.passed,
              checks: scoreB.checks
            }
          });
          index += 1;
          return runNext();
        });
      });
    }

    return runNext();
  }

  function storeModelConfigForCompare() {
    var config = getModelConfig();
    return config || {};
  }

  /* ================== Prompt 发布工作流（草稿 / 回归 / 发布 / 回滚） ================== */

  function cloneReleaseSettings(settings) {
    var source = settings || {};
    var retrieval = source.retrieval || {};
    var prompts = source.prompts || {};
    return {
      retrieval: {
        passageLimit: Number(retrieval.passageLimit) || 6,
        semanticCandidates: Number(retrieval.semanticCandidates) || 30,
        keywordCandidates: Number(retrieval.keywordCandidates) || 30
      },
      prompts: {
        intent: String(prompts.intent || DEFAULT_PROMPTS.intent),
        generation: String(prompts.generation || DEFAULT_PROMPTS.generation),
        verification: String(prompts.verification || DEFAULT_PROMPTS.verification)
      }
    };
  }

  function normalizeReleaseConfig(data) {
    var developer = normalizeDeveloperSettings(data.developerSettings);
    var promptBase = normalizePromptConfig(data.promptConfig).versions[0] || defaultPromptVersion();
    var source = data.releaseConfig && typeof data.releaseConfig === 'object' ? data.releaseConfig : {};
    var onlineSource = source.online && typeof source.online === 'object' ? source.online : null;

    var online = onlineSource ? {
      version: String(onlineSource.version || 'v1'),
      settings: cloneReleaseSettings(onlineSource.settings),
      publishedAt: String(onlineSource.publishedAt || ''),
      publishedBy: String(onlineSource.publishedBy || '系统初始'),
      note: String(onlineSource.note || '')
    } : {
      version: 'v1',
      settings: cloneReleaseSettings({
        retrieval: {
          passageLimit: developer.online.passageLimit,
          semanticCandidates: developer.online.semanticCandidates,
          keywordCandidates: developer.online.keywordCandidates
        },
        prompts: promptBase.prompts
      }),
      publishedAt: '2026-11-07T00:00:00.000Z',
      publishedBy: '系统初始',
      note: '初始线上配置'
    };

    var history = Array.isArray(source.history) ? source.history.filter(function (item) {
      return item && item.version && item.settings;
    }).map(function (item) {
      return {
        version: String(item.version),
        settings: cloneReleaseSettings(item.settings),
        publishedAt: String(item.publishedAt || ''),
        publishedBy: String(item.publishedBy || ''),
        note: String(item.note || '')
      };
    }) : [];

    var drafts = Array.isArray(source.drafts) ? source.drafts.filter(function (item) {
      return item && item.id && item.settings;
    }).map(function (item) {
      return {
        id: String(item.id),
        draftVersion: String(item.draftVersion || ''),
        basedOn: String(item.basedOn || online.version),
        createdAt: String(item.createdAt || ''),
        createdBy: String(item.createdBy || ''),
        reason: String(item.reason || ''),
        status: String(item.status || 'draft'),
        settings: cloneReleaseSettings(item.settings),
        publishedVersion: String(item.publishedVersion || ''),
        publishedAt: String(item.publishedAt || ''),
        restoredFrom: String(item.restoredFrom || '')
      };
    }) : [];

    return {
      online: online,
      history: history,
      drafts: drafts,
      onlineCounter: Number(source.onlineCounter) || (Number(String(online.version).replace(/[^0-9]/g, '')) || 1),
      draftCounter: Number(source.draftCounter) || drafts.length
    };
  }

  function canManageReleases(actor) {
    return !!canAccessDeveloper(actor);
  }

  function getReleaseConfig(actor) {
    if (!canManageReleases(actor)) return null;
    return normalizeReleaseConfig(loadData());
  }

  function getOnlineReleaseSettings() {
    var data = loadData();
    return normalizeReleaseConfig(data).online.settings;
  }

  function createReleaseDraft(actor, input) {
    if (!canManageReleases(actor)) return { ok: false, message: '只有开发者后台可以创建发布草稿。' };
    var data = loadData();
    var config = normalizeReleaseConfig(data);
    var developer = normalizeDeveloperSettings(data.developerSettings);

    var retrieval = input && input.retrieval ? input.retrieval : (developer.draft ? {
      passageLimit: developer.draft.passageLimit,
      semanticCandidates: developer.draft.semanticCandidates,
      keywordCandidates: developer.draft.keywordCandidates
    } : developer.online);

    var prompts = input && input.prompts ? input.prompts : (normalizePromptConfig(data.promptConfig).versions[0] || defaultPromptVersion()).prompts;
    var reason = String((input && input.reason) || '').trim();
    if (!reason) return { ok: false, message: '请填写草稿的修改原因。' };

    config.draftCounter += 1;
    var draft = {
      id: uid('release'),
      draftVersion: 'draft-' + config.draftCounter,
      basedOn: config.online.version,
      createdAt: new Date().toISOString(),
      createdBy: actor.name,
      reason: reason,
      status: 'draft',
      settings: cloneReleaseSettings({ retrieval: retrieval, prompts: prompts }),
      publishedVersion: '',
      publishedAt: '',
      restoredFrom: String((input && input.restoredFrom) || '')
    };
    config.drafts.unshift(draft);
    data.releaseConfig = config;
    saveData(data);
    return { ok: true, draft: draft };
  }

  function listReleaseDrafts(actor) {
    var config = getReleaseConfig(actor);
    return config ? config.drafts.slice() : [];
  }

  function getReleaseDraft(actor, draftId) {
    var drafts = listReleaseDrafts(actor);
    var found = null;
    drafts.forEach(function (item) { if (item.id === draftId) found = item; });
    return found;
  }

  function diffDraftVsOnline(actor, draftId) {
    if (!canManageReleases(actor)) return [];
    var config = normalizeReleaseConfig(loadData());
    var draft = null;
    config.drafts.forEach(function (item) { if (item.id === draftId) draft = item; });
    if (!draft) return [];

    var online = config.online.settings;
    var rows = [];
    [
      { key: 'passageLimit', label: '最终保留原文数量' },
      { key: 'semanticCandidates', label: '意思相近候选数量' },
      { key: 'keywordCandidates', label: '关键词命中候选数量' }
    ].forEach(function (item) {
      if (String(online.retrieval[item.key]) !== String(draft.settings.retrieval[item.key])) {
        rows.push({ key: 'retrieval.' + item.key, label: item.label, online: String(online.retrieval[item.key]), draft: String(draft.settings.retrieval[item.key]) });
      }
    });
    PROMPT_DEFS.forEach(function (def) {
      if (String(online.prompts[def.key]) !== String(draft.settings.prompts[def.key])) {
        rows.push({ key: 'prompts.' + def.key, label: def.name, online: online.prompts[def.key], draft: draft.settings.prompts[def.key] });
      }
    });
    return rows;
  }

  function fnvFingerprint(text) {
    var value = String(text || '');
    var hash = 2166136261;
    for (var i = 0; i < value.length; i++) {
      hash ^= value.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return (hash >>> 0).toString(16);
  }

  function knowledgeFingerprint(data) {
    var policies = data.policies.map(function (policy) {
      return [policy.id, policy.status, policy.version, fnvFingerprint(policy.parsedText || '')].join('|');
    }).sort().join('\n');
    var chunks = data.policyChunkIndexes.map(function (index) {
      return [index.policyId, index.chunkLength, index.updatedAt, (index.chunks || []).map(function (chunk) {
        return chunk.id + ':' + chunk.charCount + ':' + fnvFingerprint(chunk.text);
      }).join(',')].join('|');
    }).sort().join('\n');
    return fnvFingerprint(policies + '\n--\n' + chunks);
  }

  function modelFingerprint() {
    return fnvFingerprint(JSON.stringify(getModelConfig()));
  }

  function evalQuestionsFingerprint(questions) {
    return fnvFingerprint(JSON.stringify(questions || []));
  }

  function releaseEvalSnapshot(question) {
    return {
      id: question.id,
      name: question.name,
      question: question.question,
      department: question.department,
      expectedPolicies: question.expectedPolicies,
      expectedKeywords: question.expectedKeywords,
      shouldRefuse: question.shouldRefuse,
      refuseType: question.refuseType
    };
  }

  function latestRegressionForDraft(actor, draftId) {
    if (!canManageReleases(actor)) return null;
    var tasks = loadData().draftRegressions.filter(function (task) {
      return task && task.draftId === draftId;
    });
    return tasks.length ? tasks[0] : null;
  }

  function listCompletedRegressions(actor, draftId) {
    if (!canManageReleases(actor)) return [];
    return loadData().draftRegressions.filter(function (task) {
      return task && task.draftId === draftId && task.status === 'done';
    });
  }

  function hasRunningRegression(data) {
    return data.draftRegressions.some(function (task) { return task && task.status === 'running'; }) ||
      data.evalRuns.some(function (run) { return run && run.status === 'running'; });
  }

  function startDraftRegression(actor, draftId) {
    if (!canManageReleases(actor)) return { ok: false, message: '只有开发者后台可以运行回归。' };
    var data = loadData();
    if (hasRunningRegression(data)) return { ok: false, message: '已有评测任务在运行，请等待完成。' };

    var config = normalizeReleaseConfig(data);
    var draft = null;
    config.drafts.forEach(function (item) { if (item.id === draftId && item.status === 'draft') draft = item; });
    if (!draft) return { ok: false, message: '找不到这个未发布的草稿。' };

    var questions = data.evalQuestions.filter(function (item) {
      return item && String(item.question || '').trim();
    }).slice(0, 10).map(releaseEvalSnapshot);
    if (!questions.length) return { ok: false, message: '评测集里没有可用的评测题，请先添加题目。' };

    var task = {
      id: uid('regression'),
      draftId: draft.id,
      draftVersion: draft.draftVersion,
      status: 'running',
      startedAt: new Date().toISOString(),
      finishedAt: '',
      total: questions.length,
      completed: 0,
      questions: questions,
      results: [],
      passAll: false,
      failureReasons: [],
      environment: {
        knowledgeFingerprint: knowledgeFingerprint(data),
        modelFingerprint: modelFingerprint(),
        evalFingerprint: evalQuestionsFingerprint(questions),
        onlineVersion: config.online.version,
        onlinePrompts: draft.settings ? config.online.settings.prompts : null,
        draftSettings: cloneReleaseSettings(draft.settings)
      }
    };
    data.draftRegressions.unshift(task);
    saveData(data);
    return { ok: true, task: task };
  }

  function finishDraftRegression(data, task) {
    task.status = 'done';
    task.finishedAt = new Date().toISOString();
    task.passAll = task.results.length > 0 && task.results.every(function (item) { return item.b.passed; });
    task.failureReasons = task.results.filter(function (item) { return !item.b.passed; }).map(function (item) {
      var reasons = [];
      if (item.b.checks.policy.applicable && !item.b.checks.policy.passed) reasons.push('制度引用未命中');
      if (item.b.checks.keyword.applicable && !item.b.checks.keyword.passed) reasons.push('关键词未出现');
      if (!item.b.checks.refusal.passed) reasons.push('拒答不符合预期');
      return item.name + '：' + (reasons.join('、') || '得分未通过');
    });
  }

  function runNextDraftRegression(actor, draftId) {
    if (!canManageReleases(actor)) return Promise.resolve({ ok: false, message: '只有开发者后台可以运行回归。' });
    var data = loadData();
    var task = null;
    data.draftRegressions.forEach(function (item) {
      if (item && item.draftId === draftId && item.status === 'running') task = item;
    });
    if (!task) return Promise.resolve({ ok: true, done: true });
    if (task.completed >= task.questions.length) {
      finishDraftRegression(data, task);
      saveData(data);
      return Promise.resolve({ ok: true, task: task, done: true });
    }

    var question = task.questions[task.completed];
    var syntheticActor = {
      id: 'regression-' + question.department,
      name: '回归评测（' + question.department + '）',
      role: 'employee',
      department: question.department,
      enabled: true
    };
    var retrieval = window.OnboardRetrieval.searchPolicyPassages(syntheticActor, question.question, {
      topK: task.environment.draftSettings.retrieval.passageLimit,
      semanticCandidates: task.environment.draftSettings.retrieval.semanticCandidates,
      keywordCandidates: task.environment.draftSettings.retrieval.keywordCandidates
    });
    var citations = citationsFromPassages(retrieval.ok ? retrieval.results : []);

    function runSide(prompts) {
      return window.OnboardAnswer.generateAnswer(syntheticActor, question.question, {
        prompts: prompts,
        citations: citations
      });
    }

    return runSide(task.environment.onlinePrompts).then(function (resultA) {
      return runSide(task.environment.draftSettings.prompts).then(function (resultB) {
        var fresh = loadData();
        var freshTask = null;
        fresh.draftRegressions.forEach(function (item) {
          if (item && item.id === task.id) freshTask = item;
        });
        if (!freshTask || freshTask.status !== 'running') return { ok: true, task: freshTask, done: true };

        var scoreA = evaluateQuestionWithAnswer(question, resultA);
        var scoreB = evaluateQuestionWithAnswer(question, resultB);
        freshTask.results.push({
          evalId: question.id,
          name: question.name,
          question: question.question,
          department: question.department,
          citations: citations.map(function (citation) {
            return { policyName: citation.policyName, version: citation.version, positionLabel: citation.positionLabel, text: citation.text };
          }),
          a: { text: answerDisplayText(resultA && resultA.answer), status: resultA && resultA.answer ? (resultA.answer.status || resultA.answer.mode) : 'error', score: scoreA.score, passed: scoreA.passed, checks: scoreA.checks },
          b: { text: answerDisplayText(resultB && resultB.answer), status: resultB && resultB.answer ? (resultB.answer.status || resultB.answer.mode) : 'error', score: scoreB.score, passed: scoreB.passed, checks: scoreB.checks }
        });
        freshTask.completed += 1;
        if (freshTask.completed >= freshTask.total) finishDraftRegression(fresh, freshTask);
        saveData(fresh);
        return { ok: true, task: freshTask, done: freshTask.status === 'done' };
      });
    }).catch(function () {
      var fresh = loadData();
      var freshTask = null;
      fresh.draftRegressions.forEach(function (item) {
        if (item && item.id === task.id) freshTask = item;
      });
      if (freshTask && freshTask.status === 'running') {
        freshTask.status = 'failed';
        freshTask.finishedAt = new Date().toISOString();
        freshTask.failureReasons = ['回归运行失败：生成回答时出错'];
        saveData(fresh);
      }
      return { ok: false, task: freshTask, done: true };
    });
  }

  function publishDraft(actor, input) {
    if (!canManageReleases(actor)) return { ok: false, message: '只有开发者后台可以发布。' };
    if (!input || input.confirmed !== true) return { ok: false, message: '请先勾选“我已确认发布”。' };
    var note = String((input && input.note) || '').trim();
    if (note.length < 5) return { ok: false, message: '发布说明至少写 5 个字。' };

    var data = loadData();
    var config = normalizeReleaseConfig(data);
    var draft = null;
    config.drafts.forEach(function (item) { if (item.id === input.draftId) draft = item; });
    if (!draft) return { ok: false, message: '找不到这个草稿。' };
    if (draft.status !== 'draft') return { ok: false, message: '这个草稿已经发布过，不能重复发布。' };

    var task = null;
    data.draftRegressions.forEach(function (item) {
      if (item && item.id === input.regressionId && item.draftId === draft.id) task = item;
    });
    if (!task) return { ok: false, message: '请选择一次针对这个草稿的回归记录。' };
    if (task.status !== 'done') return { ok: false, message: '这次回归还没有完成，不能发布。' };

    if (config.online.version !== draft.basedOn) {
      return { ok: false, message: '线上版本已经被其他人更新（当前线上 ' + config.online.version + '，草稿基于 ' + draft.basedOn + '），请重新基于最新线上版本创建草稿。' };
    }
    if (knowledgeFingerprint(data) !== task.environment.knowledgeFingerprint) {
      return { ok: false, message: '回归开始后制度知识库发生了变化（制度发布/下架/修改或切片变化），不能发布，请重新回归。' };
    }
    if (modelFingerprint() !== task.environment.modelFingerprint) {
      return { ok: false, message: '回归开始后模型连接设置发生了变化，不能发布，请重新回归。' };
    }
    var allPassed = task.results.length > 0 && task.results.every(function (item) {
      return item.b && item.b.passed;
    });
    if (!allPassed) {
      var failureNames = task.results.filter(function (item) { return !(item.b && item.b.passed); }).map(function (item) {
        return item.name;
      });
      return { ok: false, message: '回归中还有未通过的题目：' + (failureNames.join('、') || '存在未通过项') + '。必须全部通过才能发布。' };
    }
    var currentQuestions = data.evalQuestions.filter(function (item) {
      return task.questions.some(function (snapshot) { return snapshot.id === item.id; });
    }).map(releaseEvalSnapshot);
    if (evalQuestionsFingerprint(currentQuestions) !== task.environment.evalFingerprint) {
      return { ok: false, message: '回归开始后参与回归的评测题被修改或删除了，不能发布，请重新回归。' };
    }

    config.onlineCounter += 1;
    var nextVersion = 'v' + config.onlineCounter;
    config.history.push({
      version: config.online.version,
      settings: cloneReleaseSettings(config.online.settings),
      publishedAt: config.online.publishedAt,
      publishedBy: config.online.publishedBy,
      note: config.online.note
    });
    config.online = {
      version: nextVersion,
      settings: cloneReleaseSettings(draft.settings),
      publishedAt: new Date().toISOString(),
      publishedBy: actor.name,
      note: note
    };
    config.drafts.forEach(function (item) {
      if (item.id === draft.id) {
        item.status = 'published';
        item.publishedVersion = nextVersion;
        item.publishedAt = config.online.publishedAt;
      }
    });
    data.releaseConfig = config;

    var settings = normalizeDeveloperSettings(data.developerSettings);
    settings.configVersion = nextVersion;
    settings.promptVersion = nextVersion;
    settings.online = {
      passageLimit: draft.settings.retrieval.passageLimit,
      semanticCandidates: draft.settings.retrieval.semanticCandidates,
      keywordCandidates: draft.settings.retrieval.keywordCandidates
    };
    settings.draft = null;
    data.developerSettings = settings;

    data.auditLog.unshift({
      id: uid('audit'),
      actorId: actor.id,
      actorName: actor.name,
      action: '发布提示词',
      target: '提示词与检索配置 v' + nextVersion + '（草稿 ' + draft.draftVersion + '）',
      detail: '发布版本 ' + nextVersion,
      createdAt: new Date().toISOString()
    });
    saveData(data);
    return { ok: true, version: nextVersion, draft: draft };
  }

  function restoreReleaseVersionAsDraft(actor, version) {
    if (!canManageReleases(actor)) return { ok: false, message: '只有开发者后台可以回滚。' };
    var config = normalizeReleaseConfig(loadData());
    var snapshot = null;
    config.history.forEach(function (item) { if (item.version === version) snapshot = item; });
    if (!snapshot) return { ok: false, message: '找不到这个历史版本。' };

    config.draftCounter += 1;
    var draft = {
      id: uid('release'),
      draftVersion: 'draft-' + config.draftCounter,
      basedOn: config.online.version,
      createdAt: new Date().toISOString(),
      createdBy: actor.name,
      reason: '从历史版本 ' + version + ' 恢复为新草稿',
      status: 'draft',
      settings: cloneReleaseSettings(snapshot.settings),
      publishedVersion: '',
      publishedAt: '',
      restoredFrom: version
    };
    config.drafts.unshift(draft);
    var data = loadData();
    data.releaseConfig = config;
    saveData(data);
    return { ok: true, draft: draft };
  }

  /* ================== 运营分析（产品运营） ================== */

  var ANALYTICS_TOPICS = [
    { key: '年假', terms: ['年假', '年休', '结转', '休假', '调休'] },
    { key: '报销', terms: ['报销', '发票', '票据', '费用', '差旅', '住宿', '餐补', '交通'] },
    { key: '入职', terms: ['入职', '新人', '试用期', '转正', '报到', '劳动合同'] },
    { key: '请假', terms: ['请假', '病假', '事假', '婚假', '产假', '丧假'] },
    { key: '薪酬福利', terms: ['薪酬', '薪资', '工资', '福利', '绩效', '奖金', '补贴'] }
  ];

  function analyticsTopicOf(text) {
    var value = String(text || '');
    for (var i = 0; i < ANALYTICS_TOPICS.length; i++) {
      var terms = ANALYTICS_TOPICS[i].terms;
      for (var j = 0; j < terms.length; j++) {
        if (value.indexOf(terms[j]) !== -1) return ANALYTICS_TOPICS[i].key;
      }
    }
    return '其他';
  }

  function analyticsSessionQuestion(session) {
    var messages = (session && session.messages) || [];
    for (var i = 0; i < messages.length; i++) {
      if (messages[i] && messages[i].role === 'user' && messages[i].content) return messages[i].content;
    }
    return (session && session.title) || '（未记录问题）';
  }

  function analyticsSessionRecord(session, user, reasons, ticket) {
    return {
      id: session.id,
      title: analyticsSessionQuestion(session),
      time: session.createdAt,
      userName: user ? user.name : '（账号已删除）',
      department: user ? user.department : '',
      reasons: reasons || [],
      ticketTitle: ticket ? ticket.title : ''
    };
  }

  function canViewAnalytics(actor) {
    return !!(actor && window.OnboardRoles && window.OnboardRoles.can(actor, 'page:analytics'));
  }

  function getAnalytics(actor, days) {
    if (!canViewAnalytics(actor)) return null;
    var rangeDays = [7, 30, 90].indexOf(Number(days)) !== -1 ? Number(days) : 30;
    var since = new Date(Date.now() - rangeDays * 24 * 3600 * 1000).toISOString();
    var data = loadData();
    var userById = {};
    data.users.forEach(function (user) { userById[user.id] = user; });

    var sessions = data.chatSessions.filter(function (session) {
      return session && String(session.createdAt || '') >= since;
    });

    var feedbacksBySession = {};
    data.feedbacks.forEach(function (feedback) {
      if (!feedback || feedback.helpful !== false) return;
      if (!feedbacksBySession[feedback.sessionId]) feedbacksBySession[feedback.sessionId] = [];
      feedbacksBySession[feedback.sessionId].push(feedback);
    });
    var ticketsBySession = {};
    data.tickets.forEach(function (ticket) {
      if (!ticket || !ticket.sessionId) return;
      if (!ticketsBySession[ticket.sessionId]) ticketsBySession[ticket.sessionId] = [];
      ticketsBySession[ticket.sessionId].push(ticket);
    });

    var sessionRows = sessions.map(function (session) {
      var messages = session.messages || [];
      var reasons = [];
      var insufficient = messages.some(function (message) {
        return message && message.role === 'assistant' && message.answer &&
          (message.answer.status === 'insufficient' || message.answer.mode === 'insufficient');
      });
      if (insufficient) reasons.push('依据不足');
      var negative = feedbacksBySession[session.id];
      if (negative && negative.length) reasons.push('差评');
      var tickets = ticketsBySession[session.id];
      if (tickets && tickets.length) reasons.push('转人工');
      var question = analyticsSessionQuestion(session);
      return {
        session: session,
        question: question,
        topic: analyticsTopicOf(question),
        user: userById[session.userId],
        resolved: reasons.length === 0,
        reasons: reasons,
        ticket: tickets && tickets.length ? tickets[0] : null
      };
    });

    var resolvedRows = sessionRows.filter(function (row) { return row.resolved; });
    var unresolvedRows = sessionRows.filter(function (row) { return !row.resolved; });
    var handoffRows = sessionRows.filter(function (row) { return !!row.ticket; });

    // 工单平均首次响应时长（创建到 HR 第一次回复/改状态）
    var rangeTickets = data.tickets.filter(function (ticket) {
      return ticket && String(ticket.createdAt || '') >= since;
    });
    var responseRows = rangeTickets.map(function (ticket) {
      var first = null;
      (ticket.timeline || []).forEach(function (event) {
        if (!event || event.type === 'created') return;
        if (event.type !== 'reply' && event.type !== 'status') return;
        if (!first || String(event.createdAt) < String(first.createdAt)) first = event;
      });
      var durationMs = first ? (new Date(first.createdAt).getTime() - new Date(ticket.createdAt).getTime()) : null;
      return {
        id: ticket.id,
        title: ticket.title,
        employeeName: ticket.employeeName,
        department: ticket.department,
        createdAt: ticket.createdAt,
        firstResponseAt: first ? first.createdAt : '',
        durationMs: durationMs,
        responded: !!first
      };
    });
    var respondedRows = responseRows.filter(function (row) { return row.responded; });
    var avgResponseMs = respondedRows.length
      ? Math.round(respondedRows.reduce(function (sum, row) { return sum + Math.max(0, row.durationMs); }, 0) / respondedRows.length)
      : null;

    // 入职任务逾期：当前快照
    var today = currentDateISO();
    var overdueTasks = data.onboardingTasks.filter(function (task) {
      return task && !task.completed && task.dueDate && task.dueDate < today;
    }).map(function (task) {
      return {
        id: task.id,
        name: task.name,
        employeeName: task.employeeName || '',
        department: task.department || '',
        dueDate: task.dueDate,
        statusLabel: '已逾期'
      };
    });

    // 制度签收完成率：累计值
    var signoffRequired = 0;
    var signoffSigned = 0;
    var signoffRows = data.signoffCampaigns.map(function (campaign) {
      var required = (campaign.recipients || []).length;
      var signed = (campaign.signatures || []).length;
      signoffRequired += required;
      signoffSigned += signed;
      return {
        id: campaign.id,
        policyName: campaign.policyName,
        scope: campaign.scope,
        required: required,
        signed: signed,
        rate: required ? Math.round((signed / required) * 100) : 0,
        createdAt: campaign.createdAt
      };
    });
    var signoffRate = signoffRequired ? Math.round((signoffSigned / signoffRequired) * 100) : 0;

    var topicRows = {};
    ANALYTICS_TOPICS.forEach(function (topic) { topicRows[topic.key] = []; });
    topicRows['其他'] = [];
    sessionRows.forEach(function (row) {
      topicRows[row.topic].push(row);
    });
    var topicDistribution = Object.keys(topicRows).map(function (key) {
      return {
        topic: key,
        count: topicRows[key].length,
        records: topicRows[key].map(function (row) {
          return analyticsSessionRecord(row.session, row.user, row.reasons, row.ticket);
        })
      };
    });

    var unresolvedRanking = Object.keys(topicRows).map(function (key) {
      var rows = topicRows[key].filter(function (row) { return !row.resolved; });
      return {
        topic: key,
        count: rows.length,
        records: rows.map(function (row) {
          return analyticsSessionRecord(row.session, row.user, row.reasons, row.ticket);
        })
      };
    }).filter(function (item) { return item.count > 0; }).sort(function (left, right) { return right.count - left.count; });

    return {
      rangeDays: rangeDays,
      since: since,
      totals: {
        consultations: sessionRows.length,
        resolved: resolvedRows.length,
        unresolved: unresolvedRows.length,
        handoff: handoffRows.length,
        avgFirstResponseMs: avgResponseMs,
        respondedTickets: respondedRows.length,
        overdueTasks: overdueTasks.length,
        signoffRequired: signoffRequired,
        signoffSigned: signoffSigned,
        signoffRate: signoffRate
      },
      lists: {
        consultations: sessionRows.map(function (row) {
          return analyticsSessionRecord(row.session, row.user, row.reasons, row.ticket);
        }),
        resolved: resolvedRows.map(function (row) {
          return analyticsSessionRecord(row.session, row.user, row.reasons, row.ticket);
        }),
        unresolved: unresolvedRows.map(function (row) {
          return analyticsSessionRecord(row.session, row.user, row.reasons, row.ticket);
        }),
        handoff: handoffRows.map(function (row) {
          return analyticsSessionRecord(row.session, row.user, row.reasons, row.ticket);
        }),
        responses: responseRows,
        overdueTasks: overdueTasks,
        signoffs: signoffRows
      },
      topicDistribution: topicDistribution,
      unresolvedRanking: unresolvedRanking
    };
  }

  /* ================== 制度冲突检查（待发布 vs 已发布） ================== */

  var CONFLICT_CHECKS = {
    amount: '金额不同',
    duration: '期限不同',
    approval: '审批条件不同'
  };

  function conflictPolicyScopesOverlap(left, right) {
    if (!left || !right) return false;
    if (left === '全员' || right === '全员') return true;
    return left === right;
  }

  function splitPolicyClauses(policy) {
    var text = String((policy && policy.parsedText) || '');
    var lines = text.replace(/\r\n/g, '\n').split('\n');
    var section = '';
    var paragraph = 0;
    var clauses = [];
    lines.forEach(function (raw) {
      var line = String(raw || '').trim();
      if (!line) return;
      if (/^[一二三四五六七八九十]+[、.．]/.test(line) || /^第[一二三四五六七八九十]+[章节]/.test(line)) {
        section = line.slice(0, 40);
      }
      paragraph += 1;
      clauses.push({
        section: section,
        paragraph: paragraph,
        positionLabel: (section ? section + ' · ' : '') + '第 ' + paragraph + ' 段',
        text: line
      });
    });
    return clauses;
  }

  function extractAmountFacts(text) {
    var facts = [];
    var regex = /(\d+(?:\.\d+)?)\s*(万元|元|%)/g;
    var match;
    while ((match = regex.exec(String(text || ''))) !== null) {
      facts.push(Number(match[1]) + match[2]);
    }
    return facts;
  }

  function extractDurationFacts(text) {
    var cleaned = String(text || '').replace(/(\d+(?:\.\d+)?)\s*(万元|元|%)/g, ' ');
    var facts = [];
    var regex = /(\d+(?:\.\d+)?)\s*(个工作日|工作日|天|日|个月|月|年|小时)/g;
    var match;
    while ((match = regex.exec(cleaned)) !== null) {
      facts.push(Number(match[1]) + match[2]);
    }
    return facts;
  }

  var APPROVAL_TERMS = ['部门负责人', '直属上级', '总经理', '副总', '经理', '总监', 'HRBP', 'HR', '财务', '审批', '批准', '事前', '书面', '申请', '备案', '负责人'];

  function extractApprovalTerms(text) {
    var source = String(text || '');
    var terms = [];
    APPROVAL_TERMS.forEach(function (term) {
      if (source.indexOf(term) !== -1) terms.push(term);
    });
    return terms;
  }

  function conflictTokens(text) {
    var value = String(text || '').replace(/[\s，。；：！？、,.!?;:"'“”‘’（）()\[\]【】《》<>\d]/g, '');
    var grams = [];
    for (var i = 0; i < value.length - 1; i++) grams.push(value.slice(i, i + 2));
    return grams;
  }

  function conflictSimilarity(left, right) {
    var leftSet = {};
    var rightSet = {};
    left.forEach(function (gram) { leftSet[gram] = true; });
    right.forEach(function (gram) { rightSet[gram] = true; });
    var common = 0;
    Object.keys(leftSet).forEach(function (gram) { if (rightSet[gram]) common += 1; });
    var union = Object.keys(leftSet).length + Object.keys(rightSet).length - common;
    return union ? common / union : 0;
  }

  function conflictSignature(type, newPolicy, newClause, oldPolicy, oldClause) {
    return fnvFingerprint([
      type,
      newPolicy.id,
      newPolicy.version,
      newClause.paragraph,
      newClause.text,
      oldPolicy.id,
      oldPolicy.version,
      oldClause.paragraph,
      oldClause.text
    ].join('||'));
  }

  function buildPolicyConflictCandidates(policyId) {
    var data = loadData();
    var policy = null;
    data.policies.forEach(function (item) {
      if (item && item.id === policyId) policy = item;
    });
    if (!policy || policy.status !== 'ready' || !policy.parsedText) return [];

    var published = data.policies.filter(function (item) {
      return item && item.id !== policy.id && item.status === 'published' &&
        conflictPolicyScopesOverlap(item.scope, policy.scope);
    });
    var newClauses = splitPolicyClauses(policy);
    var candidates = [];
    var seen = {};

    published.forEach(function (oldPolicy) {
      var oldClauses = splitPolicyClauses(oldPolicy);
      newClauses.forEach(function (newClause) {
        var newTokens = conflictTokens(newClause.text);
        oldClauses.forEach(function (oldClause) {
          var score = conflictSimilarity(newTokens, conflictTokens(oldClause.text));
          if (score < 0.25) return;

          var newAmounts = extractAmountFacts(newClause.text);
          var oldAmounts = extractAmountFacts(oldClause.text);
          var newDurations = extractDurationFacts(newClause.text);
          var oldDurations = extractDurationFacts(oldClause.text);
          var newApproval = extractApprovalTerms(newClause.text);
          var oldApproval = extractApprovalTerms(oldClause.text);

          function pushCandidate(type, baseScore) {
            var signature = conflictSignature(type, policy, newClause, oldPolicy, oldClause);
            if (seen[signature]) return;
            seen[signature] = true;
            candidates.push({
              signature: signature,
              type: type,
              typeLabel: CONFLICT_CHECKS[type],
              score: Math.round(baseScore * 1000) / 1000,
              newSide: {
                policyId: policy.id,
                policyName: policy.name,
                version: policy.version,
                positionLabel: newClause.positionLabel,
                text: newClause.text
              },
              oldSide: {
                policyId: oldPolicy.id,
                policyName: oldPolicy.name,
                version: oldPolicy.version,
                positionLabel: oldClause.positionLabel,
                text: oldClause.text
              }
            });
          }

          if (newAmounts.length && oldAmounts.length && newAmounts.join(',') !== oldAmounts.join(',')) {
            pushCandidate('amount', score);
          }
          if (newDurations.length && oldDurations.length && newDurations.join(',') !== oldDurations.join(',')) {
            pushCandidate('duration', score);
          }
          if (newApproval.join(',') !== oldApproval.join(',') && (newApproval.length || oldApproval.length) && score >= 0.35) {
            pushCandidate('approval', score);
          }
        });
      });
    });

    candidates.sort(function (left, right) { return right.score - left.score; });
    return candidates.slice(0, 60);
  }

  function conflictReviewsFor(policyId) {
    var data = loadData();
    return data.policyConflictReviews.filter(function (review) {
      return review && review.policyId === policyId;
    });
  }

  function getPolicyConflictGate(policyId) {
    var data = loadData();
    var policy = null;
    data.policies.forEach(function (item) { if (item && item.id === policyId) policy = item; });
    if (!policy || policy.status !== 'ready') {
      return { required: false, total: 0, reviewed: 0, unreviewed: 0 };
    }
    var candidates = buildPolicyConflictCandidates(policyId);
    var reviews = conflictReviewsFor(policyId);
    var reviewed = 0;
    candidates.forEach(function (candidate) {
      if (reviews.some(function (review) { return review.signature === candidate.signature; })) reviewed += 1;
    });
    return {
      required: true,
      total: candidates.length,
      reviewed: reviewed,
      unreviewed: Math.max(0, candidates.length - reviewed)
    };
  }

  function listPolicyConflictCandidates(actor, policyId) {
    if (!actor || !window.OnboardRoles.can(actor, 'policy:manage')) {
      return { ok: false, message: '只有 HR / 管理员可以做冲突检查。' };
    }
    var data = loadData();
    var policy = null;
    data.policies.forEach(function (item) { if (item && item.id === policyId) policy = item; });
    if (!policy) return { ok: false, message: '找不到这份制度。' };
    if (policy.status !== 'ready') return { ok: false, message: '只有“待发布”的制度需要做冲突检查。' };

    var candidates = buildPolicyConflictCandidates(policyId);
    var reviews = conflictReviewsFor(policyId);
    var reviewMap = {};
    reviews.forEach(function (review) { reviewMap[review.signature] = review; });

    candidates = candidates.map(function (candidate) {
      var review = reviewMap[candidate.signature] || null;
      return Object.assign({}, candidate, {
        reviewed: !!review,
        decision: review ? review.decision : '',
        reason: review ? review.reason : '',
        reviewerName: review ? review.reviewerName : '',
        reviewedAt: review ? review.reviewedAt : ''
      });
    });

    var reviewedCount = candidates.filter(function (item) { return item.reviewed; }).length;
    return {
      ok: true,
      policy: policy,
      candidates: candidates,
      total: candidates.length,
      reviewed: reviewedCount,
      unreviewed: candidates.length - reviewedCount
    };
  }

  function reviewPolicyConflict(actor, policyId, signature, decision, reason) {
    if (!actor || !window.OnboardRoles.can(actor, 'policy:manage')) {
      return { ok: false, message: '只有 HR / 管理员可以确认冲突检查。' };
    }
    if (decision !== 'conflict' && decision !== 'different') {
      return { ok: false, message: '请选择“确实冲突”或“不冲突，只是情境不同”。' };
    }
    var text = String(reason || '').trim();
    if (!text) return { ok: false, message: '请填写判断理由。' };
    if (text.length > 300) return { ok: false, message: '判断理由最多 300 个字。' };

    var candidates = buildPolicyConflictCandidates(policyId);
    var target = null;
    candidates.forEach(function (item) { if (item.signature === signature) target = item; });
    if (!target) return { ok: false, message: '这条候选差异已经变化，请刷新后重新确认。' };

    var data = loadData();
    var existing = null;
    data.policyConflictReviews.forEach(function (review) {
      if (review && review.policyId === policyId && review.signature === signature) existing = review;
    });
    var now = new Date().toISOString();
    if (existing) {
      existing.decision = decision;
      existing.reason = text;
      existing.reviewerId = actor.id;
      existing.reviewerName = actor.name;
      existing.reviewedAt = now;
    } else {
      data.policyConflictReviews.push({
        id: uid('conflict'),
        policyId: policyId,
        signature: signature,
        decision: decision,
        reason: text,
        reviewerId: actor.id,
        reviewerName: actor.name,
        reviewedAt: now
      });
    }
    var conflictPolicyName = '';
    data.policies.forEach(function (policy) {
      if (policy && policy.id === policyId) conflictPolicyName = policy.name;
    });
    pushAuditEntry(data, '处理冲突确认', '制度《' + conflictPolicyName + '》 · ' + target.typeLabel, actor);
    saveData(data);
    return { ok: true };
  }

  /* ================== 飞书接入（预备功能，未真实联调） ================== */

  function canManageFeishu(actor) {
    return !!(actor && window.OnboardRoles && window.OnboardRoles.can(actor, 'page:feishu'));
  }

  function getFeishuConfig(actor) {
    if (!canManageFeishu(actor)) return null;
    var config = readJson(FEISHU_CONFIG_KEY) || {};
    return {
      appName: String(config.appName || ''),
      appId: String(config.appId || ''),
      hasSecret: !!config.appSecretEncrypted,
      updatedAt: String(config.updatedAt || ''),
      updatedBy: String(config.updatedBy || '')
    };
  }

  function saveFeishuConfig(actor, info) {
    if (!canManageFeishu(actor)) return Promise.resolve({ ok: false, message: '只有系统管理员可以配置飞书接入。' });

    var appName = String((info && info.appName) || '').trim();
    var appId = String((info && info.appId) || '').trim();
    var appSecret = String((info && info.appSecret) || '');
    if (!appName) return Promise.resolve({ ok: false, message: '请填写企业应用名称。' });
    if (appName.length > 40) return Promise.resolve({ ok: false, message: '企业应用名称最多 40 个字。' });
    if (!appId) return Promise.resolve({ ok: false, message: '请填写 App ID。' });
    if (appId.length > 100 || /\s/.test(appId)) return Promise.resolve({ ok: false, message: 'App ID 格式不正确。' });
    if (appSecret && (appSecret.length < 8 || appSecret.length > 200)) {
      return Promise.resolve({ ok: false, message: 'App Secret 长度不正确（8–200 位）。' });
    }

    var previous = readJson(FEISHU_CONFIG_KEY) || {};
    var secretPromise = appSecret
      ? encryptSecret(appSecret)
      : Promise.resolve(previous.appSecretEncrypted || '');

    return secretPromise.then(function (encrypted) {
      var now = new Date().toISOString();
      var saved = writeJson(FEISHU_CONFIG_KEY, {
        appName: appName,
        appId: appId,
        appSecretEncrypted: encrypted,
        updatedAt: now,
        updatedBy: actor.name
      });
      if (!saved) return { ok: false, message: '保存失败，本机存储空间可能已满。' };
      logAudit('修改飞书接入配置', '飞书应用 ' + appName + '（' + appId + '）', actor);
      return { ok: true };
    }).catch(function (error) {
      return { ok: false, message: '密钥加密失败：' + ((error && error.message) ? error.message : String(error)) };
    });
  }

  function listFeishuBindings(actor) {
    if (!canManageFeishu(actor)) return [];
    var data = loadData();
    var userById = {};
    data.users.forEach(function (user) { userById[user.id] = user; });
    return data.feishuBindings.map(function (binding) {
      var user = userById[binding.employeeId];
      return {
        id: binding.id,
        feishuId: binding.feishuId,
        employeeId: binding.employeeId,
        employeeName: user ? user.name : '（账号已删除）',
        employeeAccount: user ? user.account : '',
        department: user ? user.department : '',
        createdAt: binding.createdAt,
        createdBy: binding.createdBy
      };
    }).sort(function (left, right) {
      return String(right.createdAt).localeCompare(String(left.createdAt));
    });
  }

  function bindFeishuIdentity(actor, input) {
    if (!canManageFeishu(actor)) return { ok: false, message: '只有系统管理员可以绑定飞书身份。' };
    var feishuId = String((input && input.feishuId) || '').trim();
    var employeeId = String((input && input.employeeId) || '').trim();
    if (!feishuId) return { ok: false, message: '请填写飞书身份标识。' };
    if (feishuId.length < 2 || feishuId.length > 100 || /\s/.test(feishuId)) {
      return { ok: false, message: '飞书身份标识格式不正确。' };
    }
    if (!employeeId) return { ok: false, message: '请选择要绑定的员工账号。' };

    var data = loadData();
    var employee = null;
    data.users.forEach(function (user) {
      if (user && user.id === employeeId) employee = user;
    });
    if (!employee) return { ok: false, message: '找不到这个员工账号。' };
    if (employee.enabled === false) return { ok: false, message: '这个员工账号已停用，不能绑定。' };
    if (data.feishuBindings.some(function (binding) { return binding.feishuId === feishuId; })) {
      return { ok: false, message: '这个飞书身份已经绑定过员工账号了。' };
    }
    if (data.feishuBindings.some(function (binding) { return binding.employeeId === employeeId; })) {
      return { ok: false, message: '这个员工账号已经绑定过其他飞书身份了。' };
    }

    var binding = {
      id: uid('feishu'),
      feishuId: feishuId,
      employeeId: employeeId,
      createdAt: new Date().toISOString(),
      createdBy: actor.name
    };
    data.feishuBindings.push(binding);
    pushAuditEntry(data, '绑定飞书身份', '飞书身份 ' + feishuId + ' → 员工 ' + employee.name + '（' + employee.account + '）', actor);
    saveData(data);
    return { ok: true, binding: binding };
  }

  function unbindFeishuIdentity(actor, bindingId) {
    if (!canManageFeishu(actor)) return { ok: false, message: '只有系统管理员可以解除飞书绑定。' };
    var data = loadData();
    var target = null;
    data.feishuBindings.forEach(function (binding) { if (binding.id === bindingId) target = binding; });
    if (!target) return { ok: false, message: '找不到这条绑定。' };

    data.feishuBindings = data.feishuBindings.filter(function (binding) { return binding.id !== bindingId; });
    pushAuditEntry(data, '解除飞书绑定', '飞书身份 ' + target.feishuId, actor);
    saveData(data);
    return { ok: true };
  }

  // 飞书入口只按“已明确绑定”的关系找账号；没有绑定就返回 null，绝不按姓名自动创建
  function getFeishuBoundUser(feishuId) {
    var value = String(feishuId || '').trim();
    if (!value) return null;
    var data = loadData();
    var binding = null;
    data.feishuBindings.forEach(function (item) {
      if (item && item.feishuId === value) binding = item;
    });
    if (!binding) return null;
    var user = null;
    data.users.forEach(function (item) {
      if (item && item.id === binding.employeeId) user = item;
    });
    if (!user || user.enabled === false) return null;
    return { user: user, binding: binding };
  }

  function resetAll() {
    removeRaw(MODEL_CONFIG_KEY);
    removeRaw(DEVICE_KEY);
    var data = readJson(DATA_KEY);
    if (data && Array.isArray(data.policies)) {
      data.policies.forEach(function (policy) {
        if (policy && policy.id) removeRaw(POLICY_FILE_PREFIX + policy.id);
      });
    }
    removeRaw(DATA_KEY);
    removeRaw(SESSION_KEY);
  }

  function isPersistent() {
    try {
      var probe = '__onboard_probe__';
      window.localStorage.setItem(probe, '1');
      window.localStorage.removeItem(probe);
      return true;
    } catch (err) {
      return false;
    }
  }

  function canUseBackend(user, backend) {
    return !!(user && window.OnboardRoles && window.OnboardRoles.can(user, 'backend:' + backend));
  }

  function currentSessionHasBackend(backend) {
    var user = currentUser();
    if (!user) return true;
    return canUseBackend(user, backend);
  }

  function guardHrResult(fn) {
    return function () {
      if (!currentSessionHasBackend('hr')) return { ok: false, message: '当前账号无权进入 HR 管理后台。' };
      return fn.apply(null, arguments);
    };
  }

  function guardHrArray(fn) {
    return function () {
      if (!currentSessionHasBackend('hr')) return [];
      return fn.apply(null, arguments);
    };
  }

  function guardHrNullable(fn) {
    return function () {
      if (!currentSessionHasBackend('hr')) return null;
      return fn.apply(null, arguments);
    };
  }

  function guardAuditLog(fn) {
    return function () {
      var user = currentUser();
      if (user && window.OnboardRoles.normalizeRole(user.role) !== 'sys_admin') return [];
      return fn.apply(null, arguments);
    };
  }

  window.OnboardStore = {
    hasWorkspace: hasWorkspace,
    currentUser: currentUser,
    findUserByAccount: findUserByAccount,
    listUsers: listUsers,
    getUserById: getUserById,
    getDepartments: getDepartments,
    getCompanyName: getCompanyName,
    addDepartment: guardHrResult(addDepartment),
    createWorkspace: createWorkspace,
    createEmployee: guardHrResult(createEmployee),
    updateEmployee: guardHrResult(updateEmployee),
    listPolicies: listPolicies,
    getPolicyById: getPolicyById,
    createPolicy: guardHrResult(createPolicy),
    advancePolicies: advancePolicies,
    retryPolicy: guardHrResult(retryPolicy),
    publishPolicy: guardHrResult(publishPolicy),
    offlinePolicy: guardHrResult(offlinePolicy),
    getPolicyFileData: getPolicyFileData,
    isPolicyEffective: isPolicyEffective,
    isPolicyVisibleTo: isPolicyVisibleTo,
    listVisiblePolicies: listVisiblePolicies,
    findVisiblePolicy: findVisiblePolicy,
    changePolicyScope: guardHrResult(changePolicyScope),
    LEAVE_ENTRY_LABELS: LEAVE_ENTRY_LABELS,
    listLeaveEntries: guardHrArray(listLeaveEntries),
    getLeaveBalance: getLeaveBalance,
    getLeaveLastUpdated: getLeaveLastUpdated,
    addLeaveEntry: guardHrResult(addLeaveEntry),
    canViewUserLeave: canViewUserLeave,
    listLeaveEntriesFor: listLeaveEntriesFor,
    getLeaveBalanceFor: getLeaveBalanceFor,
    getLeaveLastUpdatedFor: getLeaveLastUpdatedFor,
    getModelConfig: getModelConfig,
    saveModelConfig: saveModelConfig,
    getModelSecret: getModelSecret,
    listAuditLog: guardAuditLog(listAuditLog),
    logAudit: logAudit,
    CHAT_MAX_TEXT: CHAT_MAX_TEXT,
    listMyChatSessions: listMyChatSessions,
    getMyChatSession: getMyChatSession,
    createChatSession: createChatSession,
    appendChatMessage: appendChatMessage,
    updateChatMessage: updateChatMessage,
    FEEDBACK_REASONS: FEEDBACK_REASONS,
    addChatFeedback: addChatFeedback,
    listChatSessionsForReview: guardHrArray(listChatSessionsForReview),
    getChatSessionForReview: guardHrNullable(getChatSessionForReview),
    TICKET_STATUSES: TICKET_STATUSES,
    ticketStatusLabel: ticketStatusLabel,
    createTicket: createTicket,
    listMyTickets: listMyTickets,
    listAssignedTickets: listAssignedTickets,
    listTicketsForService: guardHrArray(listTicketsForService),
    getTicketForActor: getTicketForActor,
    assignTicket: assignTicket,
    replyTicket: replyTicket,
    updateTicketStatus: updateTicketStatus,
    listTaskTemplates: guardHrArray(listTaskTemplates),
    createTaskTemplate: guardHrResult(createTaskTemplate),
    updateTaskTemplate: guardHrResult(updateTaskTemplate),
    deleteTaskTemplate: guardHrResult(deleteTaskTemplate),
    assignOnboardingTasks: guardHrResult(assignOnboardingTasks),
    listEmployeeOnboardingTasks: listEmployeeOnboardingTasks,
    listAllOnboardingTasks: guardHrArray(listAllOnboardingTasks),
    completeOnboardingTask: completeOnboardingTask,
    FEEDBACK_FOLLOWUP_STATUSES: FEEDBACK_FOLLOWUP_STATUSES,
    feedbackFollowUpLabel: feedbackFollowUpLabel,
    listNegativeFeedbacksForService: guardHrArray(listNegativeFeedbacksForService),
    getFeedbackForService: guardHrNullable(getFeedbackForService),
    updateFeedbackFollowUp: guardHrResult(updateFeedbackFollowUp),
    addEvaluationQuestion: addEvaluationQuestion,
    listEvaluationQuestions: listEvaluationQuestions,
    createEvalQuestion: createEvalQuestion,
    updateEvalQuestion: updateEvalQuestion,
    deleteEvalQuestion: deleteEvalQuestion,
    importEvalFromFeedbacks: importEvalFromFeedbacks,
    importEvalFromGaps: importEvalFromGaps,
    ensureAcceptanceEvalQuestions: ensureAcceptanceEvalQuestions,
    startEvalRun: startEvalRun,
    runNextEvalQuestion: runNextEvalQuestion,
    reviewEvalResult: reviewEvalResult,
    listEvalRuns: listEvalRuns,
    getEvalRun: getEvalRun,
    getPromptManager: getPromptManager,
    getPromptVersion: getPromptVersion,
    savePromptVersion: savePromptVersion,
    comparePromptVersions: comparePromptVersions,
    getReleaseConfig: getReleaseConfig,
    getOnlineReleaseSettings: getOnlineReleaseSettings,
    createReleaseDraft: createReleaseDraft,
    listReleaseDrafts: listReleaseDrafts,
    getReleaseDraft: getReleaseDraft,
    diffDraftVsOnline: diffDraftVsOnline,
    startDraftRegression: startDraftRegression,
    runNextDraftRegression: runNextDraftRegression,
    publishDraft: publishDraft,
    restoreReleaseVersionAsDraft: restoreReleaseVersionAsDraft,
    latestRegressionForDraft: latestRegressionForDraft,
    listCompletedRegressions: listCompletedRegressions,
    getFeishuConfig: getFeishuConfig,
    saveFeishuConfig: saveFeishuConfig,
    listFeishuBindings: listFeishuBindings,
    bindFeishuIdentity: bindFeishuIdentity,
    unbindFeishuIdentity: unbindFeishuIdentity,
    getFeishuBoundUser: getFeishuBoundUser,
    getAnalytics: getAnalytics,
    getPolicyConflictGate: getPolicyConflictGate,
    listPolicyConflictCandidates: listPolicyConflictCandidates,
    reviewPolicyConflict: reviewPolicyConflict,
    signPolicy: signPolicy,
    getPolicySignoff: getPolicySignoff,
    listPendingSignoffPolicies: listPendingSignoffPolicies,
    listMyMessages: listMyMessages,
    markMessageRead: markMessageRead,
    markAllMessagesRead: markAllMessagesRead,
    previewSignoffDiff: guardHrResult(previewSignoffDiff),
    createSignoffCampaign: guardHrResult(createSignoffCampaign),
    listSignoffCampaigns: listSignoffCampaigns,
    getSignoffCampaignForActor: getSignoffCampaignForActor,
    campaignSignatureFor: campaignSignatureFor,
    signSignoffCampaign: signSignoffCampaign,
    GAP_STATUSES: GAP_STATUSES,
    gapStatusLabel: gapStatusLabel,
    listKnowledgeGaps: listKnowledgeGaps,
    listGapAssignees: listGapAssignees,
    updateGapState: updateGapState,
    addGapEvalQuestion: addGapEvalQuestion,
    listAnswerTraces: listAnswerTraces,
    canViewAllAnswerTraces: canViewAllAnswerTraces,
    getDeveloperSettings: getDeveloperSettings,
    saveDeveloperDraft: saveDeveloperDraft,
    canAccessDeveloper: canAccessDeveloper,
    canUseBackend: canUseBackend,
    ensurePolicyChunks: ensurePolicyChunks,
    getPolicyChunks: getPolicyChunks,
    updatePolicyChunk: updatePolicyChunk,
    startChunkRebuild: startChunkRebuild,
    advanceChunkTasks: advanceChunkTasks,
    getChunkTask: getChunkTask,
    getLatestChunkTask: getLatestChunkTask,
    verifyLogin: verifyLogin,
    checkPassword: checkPassword,
    updatePassword: updatePassword,
    setSession: setSession,
    clearSession: clearSession,
    resetAll: resetAll,
    isPersistent: isPersistent
  };
})();
