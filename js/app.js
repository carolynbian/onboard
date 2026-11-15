/* ============================================================
   初见 Onboard · 页面与交互
   入口：创建工作空间 / 登录 / 角色权限 / 主界面框架
   ============================================================ */
(function () {
  'use strict';

  var store = window.OnboardStore;

  var appEl = document.getElementById('app');
  var modalRoot = document.getElementById('modal-root');
  var toastRoot = document.getElementById('toast-root');

  // 哪些页面属于“管理后台”分组（旧导航用；拆分后台后由 BACKEND_MENUS 控制）
  var BACKEND_PAGES = ['employees', 'leaveAdmin', 'inquiries', 'service', 'signoffAdmin', 'knowledgeGaps', 'policyConflicts', 'analytics', 'developer', 'policies', 'modelConfig', 'retrievalTest'];

  var BACKEND_ENTRY = (window.ONBOARD_BACKEND === 'hr' || window.ONBOARD_BACKEND === 'ops') ? window.ONBOARD_BACKEND : '';
  var BACKEND_TITLES = { hr: 'HR 管理后台', ops: '产品运营后台' };
  var BACKEND_MENUS = {
    hr: ['overview', 'policies', 'employees', 'leaveAdmin', 'inquiries', 'service', 'signoffAdmin', 'policyConflicts'],
    ops: ['analytics', 'knowledgeGaps', 'developer', 'promptRelease']
  };
  var SYS_EXTRA_PAGES = ['modelConfig', 'audit', 'feishu'];
  var EMPLOYEE_PAGES = ['assistant', 'policyCenter', 'org', 'tickets', 'messages', 'mySignoffs', 'traces', 'myLeave'];

  var POLICY_CATEGORIES = ['公司制度', '入职指南', '报销制度', '请假制度', '部门制度', '福利保障'];
  var POLICY_STATUS_LABELS = {
    queued: '排队中',
    parsing: '解析中',
    ready: '待发布',
    published: '已发布',
    failed: '失败',
    offline: '已下架'
  };
  var POLICY_STATUS_CLASS = {
    queued: 'is-queued',
    parsing: 'is-parsing',
    ready: 'is-ready',
    published: 'is-published',
    failed: 'is-failed',
    offline: 'is-offline'
  };
  var policyFilter = { status: 'all', category: '', scope: '', keyword: '' };
  var policyTimer = null;

  // 页面登记表：每个页面都绑一个权限点，进入前必须通过内部检查
  var PAGES = {
    overview: {
      title: '工作概览',
      capability: 'page:overview',
      render: function (user) { return overviewHtml(user); }
    },
    assistant: {
      title: '员工服务助手',
      capability: 'page:assistant',
      render: function (user) { return assistantHtml(user); }
    },
    myLeave: {
      title: '我的年假',
      capability: 'page:my-leave',
      render: function (user) { return myLeaveHtml(user); }
    },
    tickets: {
      title: '工单与入职',
      capability: 'page:tickets',
      render: function (user) { return ticketsHtml(user); }
    },
    messages: {
      title: '消息与待办',
      capability: 'page:messages',
      render: function (user) { return messagesHtml(user); }
    },
    mySignoffs: {
      title: '我的制度签收',
      capability: 'page:my-signoffs',
      render: function (user) { return mySignoffsHtml(user); }
    },
    traces: {
      title: 'Agent 执行轨迹',
      capability: 'page:traces',
      render: function (user) { return tracesHtml(user); }
    },
    policyCenter: {
      title: '制度中心',
      capability: 'page:policy-center',
      render: function (user) { return policyCenterHtml(user); }
    },
    org: {
      title: '组织架构',
      capability: 'page:org',
      render: function (user) { return orgHtml(user); }
    },
    employees: {
      title: '员工管理',
      capability: 'page:employees',
      render: function (user) { return employeesHtml(user); }
    },
    leaveAdmin: {
      title: '年假管理',
      capability: 'page:leave-admin',
      render: function (user) { return leaveAdminHtml(user); }
    },
    inquiries: {
      title: '员工问询',
      capability: 'page:inquiries',
      render: function (user) { return inquiriesHtml(user); }
    },
    service: {
      title: '服务管理',
      capability: 'page:service',
      render: function (user) { return serviceHtml(user); }
    },
    signoffAdmin: {
      title: '制度更新与签收',
      capability: 'page:signoff-admin',
      render: function (user) { return signoffAdminHtml(user); }
    },
    knowledgeGaps: {
      title: '知识缺口诊断',
      capability: 'page:knowledge-gaps',
      render: function (user) { return knowledgeGapsHtml(user); }
    },
    developer: {
      title: '开发者后台',
      capability: 'page:developer',
      render: function (user) {
        developerTab = 'retrieval';
        return developerHtml(user);
      }
    },
    promptRelease: {
      title: 'Prompt 发布',
      capability: 'page:developer',
      render: function (user) {
        developerTab = 'release';
        return developerHtml(user);
      }
    },
    audit: {
      title: '操作审计',
      capability: 'page:audit',
      render: function (user) { return auditHtml(user); }
    },
    feishu: {
      title: '飞书接入',
      capability: 'page:feishu',
      render: function (user) { return feishuHtml(user); }
    },
    analytics: {
      title: '运营分析',
      capability: 'page:analytics',
      render: function (user) { return analyticsHtml(user); }
    },
    policyConflicts: {
      title: '制度冲突检查',
      capability: 'page:policy-conflicts',
      render: function (user) { return policyConflictsHtml(user); }
    },
    policies: {
      title: '制度知识库',
      capability: 'page:policies',
      render: function (user) { return policiesHtml(user); }
    },
    modelConfig: {
      title: '模型配置',
      capability: 'page:model-config',
      render: function (user) { return modelConfigHtml(user); }
    },
    retrievalTest: {
      title: '查找测试',
      capability: 'page:retrieval-test',
      render: function (user) { return retrievalTestHtml(user); }
    }
  };

  /* ================== 小工具 ================== */

  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  function $$(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function todayLabel() {
    var d = new Date();
    var weeks = ['日', '一', '二', '三', '四', '五', '六'];
    return d.getFullYear() + ' 年 ' + (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日 · 星期' + weeks[d.getDay()];
  }

  function toast(message) {
    var el = document.createElement('div');
    el.className = 'toast';
    el.textContent = message;
    toastRoot.appendChild(el);
    window.setTimeout(function () {
      el.classList.add('is-leaving');
      window.setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 240);
    }, 2600);
  }

  function showError(el, message) {
    if (!el) return;
    el.textContent = message;
    el.classList.add('is-visible');
  }

  function hideError(el) {
    if (!el) return;
    el.textContent = '';
    el.classList.remove('is-visible');
  }

  function validateAccount(account) {
    if (!account) return '请填写登录账号。';
    if (account.length < 4) return '登录账号至少 4 位，请再想一个。';
    if (account.length > 30) return '登录账号最多 30 位。';
    if (/\s/.test(account)) return '登录账号里不能有空格。';
    return '';
  }

  function validatePassword(password) {
    if (!password) return '请设置密码。';
    if (password.length < 10) return '密码至少 10 位，请再长一点。';
    if (password.length > 64) return '密码最多 64 位。';
    return '';
  }

  function initials(name) {
    var text = String(name || '').trim();
    return text ? text.charAt(0) : '员';
  }

  // 把错误提示标在出错的输入框下面，避免提示跑出视野、看起来像“点了没反应”
  function markFieldError(input, message) {
    if (!input) return;
    input.classList.add('is-invalid');
    var field = input.parentNode;
    if (!field) return;
    var box = field.querySelector('.field-error');
    if (!box) {
      box = document.createElement('p');
      box.className = 'field-error';
      field.appendChild(box);
    }
    box.textContent = message;
  }

  function clearFieldErrors(root) {
    if (!root) return;
    $$('.input', root).forEach(function (input) {
      input.classList.remove('is-invalid');
    });
    $$('.field-error', root).forEach(function (box) {
      if (box.parentNode) box.parentNode.removeChild(box);
    });
  }

  // 意料之外的错误也要让使用者看得见，而不是静默失败
  function showFatal(message) {
    var box = document.getElementById('fatal-error');
    if (window.console && window.console.error) window.console.error(message);
    if (!box) return;
    box.textContent = message;
    box.hidden = false;
  }

  window.addEventListener('error', function (event) {
    var detail = (event && event.message) ? event.message : '未知错误';
    showFatal('页面出现了一个错误：' + detail + '。请刷新后再试一次；如果一直这样，请把这句话发给开发同学。');
  });

  /* ================== 登录 / 创建工作空间 ================== */

  function brandHtml() {
    return '' +
      '<div class="auth-brand">' +
      '  <div class="brand-mark">初</div>' +
      '  <div class="brand-text">' +
      '    <strong>初见 ONBOARD</strong>' +
      '    <span>企业员工服务 AI 助手</span>' +
      '  </div>' +
      '</div>';
  }

  function renderCreate() {
    stopPolicyTimer();
    appEl.innerHTML = '' +
      '<div class="auth">' +
      '  <div class="auth-card">' +
      brandHtml() +
      '    <h1 class="auth-title">创建你的工作空间</h1>' +
      '    <p class="auth-sub">这是第一次打开。先创建一个属于你公司的工作空间，你本人会成为管理员，之后可以在这里添加员工和其他管理员。</p>' +
      '    <div class="form-error" id="create-error" role="alert"></div>' +
      '    <form id="create-form" novalidate autocomplete="off">' +
      '      <div class="field">' +
      '        <label for="create-name">管理员姓名</label>' +
      '        <input class="input" id="create-name" type="text" maxlength="20" placeholder="例如：李书宁" autocomplete="name">' +
      '      </div>' +
      '      <div class="field">' +
      '        <label for="create-account">登录账号</label>' +
      '        <input class="input" id="create-account" type="text" maxlength="30" placeholder="例如：lishuning" autocomplete="username">' +
      '        <p class="hint">至少 4 位，建议用字母或数字，不能有空格。</p>' +
      '      </div>' +
      '      <div class="field">' +
      '        <label for="create-dept">所在部门（可以留空）</label>' +
      '        <input class="input" id="create-dept" type="text" maxlength="20" placeholder="例如：人力资源部" autocomplete="organization">' +
      '      </div>' +
      '      <div class="field">' +
      '        <label for="create-password">密码</label>' +
      '        <input class="input" id="create-password" type="password" maxlength="64" placeholder="至少 10 位" autocomplete="new-password">' +
      '        <p class="hint">至少 10 位。请记牢，以后登录要用。</p>' +
      '      </div>' +
      '      <div class="field">' +
      '        <label for="create-password2">再输一次密码</label>' +
      '        <input class="input" id="create-password2" type="password" maxlength="64" placeholder="再输一次，确认没有打错" autocomplete="new-password">' +
      '      </div>' +
      '      <button class="btn btn-primary btn-block" type="submit" id="create-submit">创建并进入</button>' +
      '    </form>' +
      '    <div class="auth-foot">' +
      '      <span>演示版 · 数据只保存在这台电脑的浏览器里</span>' +
      '    </div>' +
      '  </div>' +
      '</div>';

    var form = $('#create-form');
    var errEl = $('#create-error');
    var submitBtn = $('#create-submit');
    var creating = false;

    function handleCreateSubmit(event) {
      if (event && event.preventDefault) event.preventDefault();
      if (creating) return;

      hideError(errEl);
      clearFieldErrors(form);

      var nameEl = $('#create-name');
      var accountEl = $('#create-account');
      var departmentEl = $('#create-dept');
      var passwordEl = $('#create-password');
      var password2El = $('#create-password2');

      var name = nameEl.value.trim();
      var account = accountEl.value.trim();
      var department = departmentEl.value.trim();
      var password = passwordEl.value;
      var password2 = password2El.value;

      var message = '';
      var badInput = null;

      if (!name) {
        message = '请填写管理员姓名。';
        badInput = nameEl;
      } else if (name.length > 20) {
        message = '姓名最多 20 个字。';
        badInput = nameEl;
      }
      if (!message) {
        message = validateAccount(account);
        if (message) badInput = accountEl;
      }
      if (!message) {
        message = validatePassword(password);
        if (message) badInput = passwordEl;
      }
      if (!message && password !== password2) {
        message = '两次输入的密码不一致，请再检查一下。';
        badInput = password2El;
      }

      if (message) {
        markFieldError(badInput, message);
        showError(errEl, message);
        if (badInput && badInput.focus) badInput.focus();
        return;
      }

      creating = true;
      try {
        var user = store.createWorkspace({
          name: name,
          account: account,
          department: department,
          password: password
        });
        store.setSession(user.id);
        enterApp();
        toast('工作空间已创建，欢迎你，' + user.name);
      } catch (err) {
        creating = false;
        showFatal('创建账号时出错了：' + ((err && err.message) ? err.message : String(err)) + '。请刷新后再试一次。');
      }
    }

    form.addEventListener('submit', handleCreateSubmit);
    if (submitBtn) submitBtn.addEventListener('click', handleCreateSubmit);

    $('#create-name').focus();
  }

  function renderLogin(prefillAccount) {
    stopPolicyTimer();
    appEl.innerHTML = '' +
      '<div class="login-page">' +
      '  <section class="login-brand">' +
      '    <div class="login-brand-lockup">' +
      '      <div class="brand-mark">初</div>' +
      '      <div class="brand-text">' +
      '        <strong>初见 ONBOARD</strong>' +
      '        <span>' + (BACKEND_ENTRY ? esc(BACKEND_TITLES[BACKEND_ENTRY]) : '员工服务 AI 助手') + '</span>' +
      '      </div>' +
      '    </div>' +
      '    <div class="login-brand-main">' +
      '      <h1 class="login-slogan">从第一天起，<br>让每个问题都有据可依。</h1>' +
      '      <p class="login-subline">公司的制度，你的假期，工作中的小疑问。<br>一个属于员工的、值得信赖的服务入口。</p>' +
      '    </div>' +
      '    <div class="login-brand-foot">演示版 · 数据只保存在这台电脑的浏览器里</div>' +
      '  </section>' +
      '  <section class="login-panel">' +
      '    <div class="login-card">' +
      '      <div class="login-tabs" role="tablist" aria-label="登录方式">' +
      '        <button type="button" class="login-tab is-active" role="tab" aria-selected="true" data-login-tab="employee">员工登录</button>' +
      '        <button type="button" class="login-tab" role="tab" aria-selected="false" data-login-tab="admin">管理后台</button>' +
      '      </div>' +
      '      <p class="login-hint" id="login-hint">用你的员工编号或员工账号登录</p>' +
      '      <div class="form-error" id="login-error" role="alert"></div>' +
      '      <form id="login-form" novalidate autocomplete="off">' +
      '        <div class="field">' +
      '          <label for="login-account" id="login-account-label">员工编号 / 员工账号</label>' +
      '          <input class="input" id="login-account" type="text" maxlength="30" placeholder="请输入员工编号或员工账号" autocomplete="username">' +
      '        </div>' +
      '        <div class="field">' +
      '          <label for="login-password">密码</label>' +
      '          <div class="password-field">' +
      '            <input class="input" id="login-password" type="password" maxlength="64" placeholder="请输入密码" autocomplete="current-password">' +
      '            <label class="show-password">' +
      '              <input type="checkbox" id="show-password-input">' +
      '              <span>显示密码</span>' +
      '            </label>' +
      '          </div>' +
      '        </div>' +
      '        <div class="login-help-row">' +
      '          <button type="button" class="linkish" id="forgot-password">忘记密码？</button>' +
      '        </div>' +
      '        <p class="forgot-tip" id="forgot-tip" hidden>请联系公司 HR 或系统管理员重置密码。</p>' +
      '        <button class="btn btn-primary btn-block" type="submit" id="login-submit">登录</button>' +
      '      </form>' +
      '    </div>' +
      '    <p class="login-foot">账号由公司管理员分配，无公开注册</p>' +
      '    <p class="login-feishu-entry"><a href="' + ((BACKEND_ENTRY || ASSISTANT_ENTRY) ? '../feishu/index.html' : 'feishu/index.html') + '">通过飞书工作台访问 →</a></p>' +
      '    <button type="button" class="login-demo-link" id="reset-demo">演示用：清空本机数据</button>' +
      '  </section>' +
      '</div>';

    var form = $('#login-form');
    var errEl = $('#login-error');
    var accountEl = $('#login-account');
    var accountLabel = $('#login-account-label');
    var hintEl = $('#login-hint');
    var passwordEl = $('#login-password');
    var submitBtn = $('#login-submit');
    var showPasswordInput = $('#show-password-input');
    var forgotTip = $('#forgot-tip');
    var tabs = $$('.login-tab', appEl);
    var loggingIn = false;
    var accountName = '员工编号 / 员工账号';
    var loginMode = 'employee';

    var MODE_TEXT = {
      employee: {
        accountLabel: '员工编号 / 员工账号',
        placeholder: '请输入员工编号或员工账号',
        hint: '用你的员工编号或员工账号登录'
      },
      admin: {
        accountLabel: '管理账号',
        placeholder: '请输入管理账号',
        hint: '用管理账号登录管理后台（HR 管理员 / 产品运营 / 系统管理员）'
      }
    };

    function applyMode(mode) {
      var text = MODE_TEXT[mode] || MODE_TEXT.employee;
      loginMode = MODE_TEXT[mode] ? mode : 'employee';
      accountName = text.accountLabel;
      accountLabel.textContent = text.accountLabel;
      accountEl.setAttribute('placeholder', text.placeholder);
      hintEl.textContent = text.hint;
      tabs.forEach(function (tab) {
        var isActive = tab.getAttribute('data-login-tab') === mode;
        tab.classList.toggle('is-active', isActive);
        tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });
      hideError(errEl);
      clearFieldErrors(form);
      if (forgotTip) forgotTip.hidden = true;
      accountEl.focus();
    }

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        applyMode(tab.getAttribute('data-login-tab'));
      });
    });

    if (BACKEND_ENTRY) applyMode('admin');

    if (showPasswordInput) {
      showPasswordInput.addEventListener('change', function () {
        passwordEl.type = showPasswordInput.checked ? 'text' : 'password';
      });
    }

    var forgotBtn = $('#forgot-password');
    if (forgotBtn) {
      forgotBtn.addEventListener('click', function () {
        if (forgotTip) forgotTip.hidden = false;
      });
    }

    if (prefillAccount) accountEl.value = prefillAccount;

    function handleLoginSubmit(event) {
      if (event && event.preventDefault) event.preventDefault();
      if (loggingIn) return;

      hideError(errEl);
      clearFieldErrors(form);

      var account = accountEl.value.trim();
      var password = passwordEl.value;

      if (!account) {
        markFieldError(accountEl, '请填写' + accountName + '。');
        showError(errEl, '请把账号和密码都填上。');
        accountEl.focus();
        return;
      }
      if (!password) {
        markFieldError(passwordEl, '请填写密码。');
        showError(errEl, '请把账号和密码都填上。');
        passwordEl.focus();
        return;
      }

      loggingIn = true;
      try {
        var result = store.verifyLogin(account, password);
        if (result.status === 'disabled') {
          loggingIn = false;
          showError(errEl, '该账号已停用，请联系公司管理员。');
          passwordEl.value = '';
          passwordEl.focus();
          return;
        }
        if (result.status !== 'ok') {
          loggingIn = false;
          showError(errEl, '登录失败：账号或密码不正确，请重新输入。');
          passwordEl.value = '';
          passwordEl.focus();
          return;
        }
        store.setSession(result.user.id);
        routeAfterLogin(result.user);
      } catch (err) {
        loggingIn = false;
        showFatal('登录时出错了：' + ((err && err.message) ? err.message : String(err)) + '。请刷新后再试一次。');
      }
    }

    form.addEventListener('submit', handleLoginSubmit);
    if (submitBtn) submitBtn.addEventListener('click', handleLoginSubmit);

    $('#reset-demo').addEventListener('click', function () {
      openConfirmModal({
        title: '清空本机演示数据',
        message: '会清空这台电脑上保存的工作空间和账号，回到“创建工作空间”的状态。这个操作不能撤销。',
        confirmText: '清空数据',
        danger: true,
        onConfirm: function () {
          store.resetAll();
          renderCreate();
          toast('本机演示数据已清空');
        }
      });
    });

    if (prefillAccount) {
      passwordEl.focus();
    } else {
      accountEl.focus();
    }
  }

  /* ================== 主界面 ================== */

  function navIcon(page) {
    if (page === 'overview') {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<rect x="3.5" y="3.5" width="7" height="7" rx="1.6"></rect>' +
        '<rect x="13.5" y="3.5" width="7" height="7" rx="1.6"></rect>' +
        '<rect x="3.5" y="13.5" width="7" height="7" rx="1.6"></rect>' +
        '<rect x="13.5" y="13.5" width="7" height="7" rx="1.6"></rect>' +
        '</svg>';
    }
    if (page === 'org') {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<rect x="4.5" y="3.5" width="15" height="6" rx="1.4"></rect>' +
        '<rect x="2.5" y="14.5" width="6.5" height="6" rx="1.4"></rect>' +
        '<rect x="15" y="14.5" width="6.5" height="6" rx="1.4"></rect>' +
        '<path d="M12 9.5v5"></path>' +
        '<path d="M5.75 14.5v-2h12.5v2"></path>' +
        '</svg>';
    }
    if (page === 'policyCenter') {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v18H6.5A2.5 2.5 0 0 1 4 18.5Z"></path>' +
        '<path d="M4 17.5A2.5 2.5 0 0 1 6.5 15H19"></path>' +
        '<path d="M8.5 7h6"></path>' +
        '</svg>';
    }
    if (page === 'assistant') {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4 3v-3H6.5A2.5 2.5 0 0 1 4 14.5Z"></path>' +
        '<path d="M8.5 9h7M8.5 12.5h4"></path>' +
        '</svg>';
    }
    if (page === 'employees') {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<circle cx="9" cy="8" r="3.2"></circle>' +
        '<path d="M3.6 19.4c0-3 2.4-5 5.4-5s5.4 2 5.4 5"></path>' +
        '<path d="M15.6 5.2a3 3 0 0 1 0 5.6"></path>' +
        '<path d="M16.8 14.6c2.2.6 3.6 2.4 3.6 4.8"></path>' +
        '</svg>';
    }
    if (page === 'policies') {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M6.5 3.5h7l4 4V20a1.5 1.5 0 0 1-1.5 1.5H6.5A1.5 1.5 0 0 1 5 20V5a1.5 1.5 0 0 1 1.5-1.5Z"></path>' +
        '<path d="M13.5 3.5V8h4"></path>' +
        '<path d="M8.5 12h7M8.5 15.5h7M8.5 19h4"></path>' +
        '</svg>';
    }
    if (page === 'modelConfig') {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<circle cx="12" cy="12" r="3.2"></circle>' +
        '<path d="M19.4 13.5a7.5 7.5 0 0 0 0-3l1.8-1.4-2-3.5-2.2.9a7.4 7.4 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.5a7.4 7.4 0 0 0-2.6 1.5l-2.2-.9-2 3.5 1.8 1.4a7.5 7.5 0 0 0 0 3l-1.8 1.4 2 3.5 2.2-.9a7.4 7.4 0 0 0 2.6 1.5l.4 2.5h4l.4-2.5a7.4 7.4 0 0 0 2.6-1.5l2.2.9 2-3.5-1.8-1.4Z"></path>' +
        '</svg>';
    }
    if (page === 'retrievalTest') {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<circle cx="10.5" cy="10.5" r="6.5"></circle>' +
        '<path d="m15.5 15.5 4.5 4.5"></path>' +
        '<path d="M8 10.5h5M10.5 8v5"></path>' +
        '</svg>';
    }
    if (page === 'inquiries') {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M5 4.5h14a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18V6A1.5 1.5 0 0 1 5 4.5Z"></path>' +
        '<path d="M7.5 8.5h9M7.5 12h9M7.5 15.5h5"></path>' +
        '</svg>';
    }
    if (page === 'tickets' || page === 'service') {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M4 5.5h16v4a2 2 0 0 0 0 5v4H4v-4a2 2 0 0 0 0-5Z"></path>' +
        '<path d="M9 8.5h6M9 12h6M9 15.5h3"></path>' +
        '</svg>';
    }
    if (page === 'messages') {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5H10l-4 3v-3H5A1.5 1.5 0 0 1 3.5 16V7A1.5 1.5 0 0 1 5 5.5Z"></path>' +
        '<path d="M8 9h8M8 12h5"></path>' +
        '</svg>';
    }
    if (page === 'mySignoffs' || page === 'signoffAdmin') {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M7 3.5h7l4 4V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z"></path>' +
        '<path d="M13.5 3.5V8h4"></path>' +
        '<path d="m8.5 13 2 2 4-4"></path>' +
        '</svg>';
    }
    if (page === 'knowledgeGaps') {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M9 4.5h7a1.5 1.5 0 0 1 1.5 1.5v2H9Z"></path>' +
        '<path d="M6.5 8h11a1.5 1.5 0 0 1 1.5 1.5V19a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19V9.5A1.5 1.5 0 0 1 6.5 8Z"></path>' +
        '<path d="m9 14 2 2 4-4"></path>' +
        '</svg>';
    }
    if (page === 'traces') {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<circle cx="6" cy="6" r="2"></circle>' +
        '<circle cx="18" cy="12" r="2"></circle>' +
        '<circle cx="6" cy="18" r="2"></circle>' +
        '<path d="M8 6h4a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2"></path>' +
        '<path d="M8 18h4a2 2 0 0 0 2-2v-2a2 2 0 0 1 2-2"></path>' +
        '</svg>';
    }
    if (page === 'developer') {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="m8 7-4 5 4 5"></path>' +
        '<path d="m16 7 4 5-4 5"></path>' +
        '<path d="m13.5 5-3 14"></path>' +
        '</svg>';
    }
    if (page === 'promptRelease') {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M7 3.5h7l4 4V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z"></path>' +
        '<path d="M13.5 3.5V8h4"></path>' +
        '<path d="m8.5 13 2 2 4-4"></path>' +
        '</svg>';
    }
    if (page === 'audit') {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M6 4.5h12a1.5 1.5 0 0 1 1.5 1.5v13A1.5 1.5 0 0 1 18 20.5H6A1.5 1.5 0 0 1 4.5 19V6A1.5 1.5 0 0 1 6 4.5Z"></path>' +
        '<path d="M8 9h8M8 12.5h8M8 16h5"></path>' +
        '</svg>';
    }
    if (page === 'feishu') {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M4 6.5h16v11H4Z"></path>' +
        '<path d="m4 7 8 6 8-6"></path>' +
        '</svg>';
    }
    if (page === 'analytics') {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M4 20V10"></path>' +
        '<path d="M10 20V4"></path>' +
        '<path d="M16 20v-7"></path>' +
        '<path d="M22 20H2"></path>' +
        '</svg>';
    }
    if (page === 'policyConflicts') {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M12 3.5 21 20H3Z"></path>' +
        '<path d="M12 9v5"></path>' +
        '<path d="M12 17.5v.01"></path>' +
        '</svg>';
    }
    if (page === 'leaveAdmin' || page === 'myLeave') {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<rect x="3.5" y="5" width="17" height="15.5" rx="2"></rect>' +
        '<path d="M3.5 9.5h17"></path>' +
        '<path d="M8 3.5v3M16 3.5v3"></path>' +
        '<path d="M8 13.5h2M14 13.5h2M8 17h2M14 17h2"></path>' +
        '</svg>';
    }
    return '';
  }

  // 只把当前角色有权限的页面放进导航；真正的拦截在 route() 里
  function allowedPages(user) {
    return Object.keys(PAGES).filter(function (key) {
      return window.OnboardRoles.can(user, PAGES[key].capability);
    });
  }

  function navButtonHtml(key, activePage) {
    var active = key === activePage ? ' is-active' : '';
    return '<button type="button" class="nav-item' + active + '" data-page="' + key + '">' +
      navIcon(key) +
      '<span>' + esc(PAGES[key].title) + '</span>' +
      '</button>';
  }

  // 分成“员工服务”和“管理后台”两组，管理员能一眼看到管理后台在哪
  function navGroupsHtml(user, activePage) {
    var service = [];
    var backend = [];

    allowedPages(user).forEach(function (key) {
      if (BACKEND_PAGES.indexOf(key) >= 0) backend.push(key);
      else service.push(key);
    });

    var html = '';
    if (service.length) {
      html += '<div class="nav-label">员工服务</div>' +
        service.map(function (key) { return navButtonHtml(key, activePage); }).join('');
    }
    if (backend.length) {
      html += '<div class="nav-label">管理后台</div>' +
        backend.map(function (key) { return navButtonHtml(key, activePage); }).join('');
    }
    return html;
  }

  function sidebarHtml(user, activePage) {
    if (BACKEND_ENTRY) return backendSidebarHtml(user, activePage, BACKEND_ENTRY);
    return employeeSidebarHtml(user, activePage);
  }

  function canAccessBackend(user, backend) {
    if (!user || !backend) return false;
    return window.OnboardRoles.can(user, 'backend:' + backend);
  }

  function getBackendMenu(user, backend) {
    var base = (BACKEND_MENUS[backend] || []).slice();
    if (window.OnboardRoles.can(user, 'backend:access') && !canAccessBackend(user, backend)) {
      // 无此后台权限时也返回空菜单，页面本身会显示无权限页
      return [];
    }
    if (window.OnboardRoles.can(user, 'model:manage') || window.OnboardRoles.can(user, 'page:model-config')) {
      base = base.concat(SYS_EXTRA_PAGES);
    }
    return base.filter(function (key) {
      return PAGES[key] && window.OnboardRoles.can(user, PAGES[key].capability);
    });
  }

  function employeeSidebarHtml(user, activePage) {
    var roleLabel = window.OnboardRoles.labelOf(user.role);
    var pages = EMPLOYEE_PAGES.filter(function (key) {
      return PAGES[key] && window.OnboardRoles.can(user, PAGES[key].capability);
    });

    return '' +
      '<aside class="sidebar">' +
      '  <a class="sidebar-home-link" href="index.html">← 返回门户首页</a>' +
      '  <div class="brand">' +
      '    <div class="brand-mark">初</div>' +
      '    <div class="brand-text">' +
      '      <strong>初见 ONBOARD</strong>' +
      '      <span>员工服务 AI 助手</span>' +
      '    </div>' +
      '  </div>' +
      '  <nav class="sidebar-nav" aria-label="主导航">' +
      '    <div class="nav-label">员工服务</div>' +
      pages.map(function (key) { return navButtonHtml(key, activePage); }).join('') +
      '  </nav>' +
      '  <a class="sidebar-learning-link" href="academy/index.html">产品学习后台<span>→</span></a>' +
      '  <div class="sidebar-foot">' +
      '    <div class="user-card">' +
      '      <div class="avatar">' + esc(initials(user.name)) + '</div>' +
      '      <div class="user-meta">' +
      '        <div class="user-name">' + esc(user.name) + '</div>' +
      '        <div class="user-sub">' + esc(user.department) + ' · ' + esc(roleLabel) + '</div>' +
      '      </div>' +
      '    </div>' +
      '    <div class="user-actions">' +
      '      <button type="button" class="mini-btn" data-action="change-password">修改密码</button>' +
      '      <button type="button" class="mini-btn" data-action="logout">退出登录</button>' +
      '    </div>' +
      '    <div class="sidebar-ver">演示版 v2026-11-08</div>' +
      '  </div>' +
      '</aside>';
  }

  function backendSidebarHtml(user, activePage, backend) {
    var title = BACKEND_TITLES[backend];
    var menu = getBackendMenu(user, backend);
    var mainPages = menu.filter(function (key) { return SYS_EXTRA_PAGES.indexOf(key) === -1; });
    var extraPages = menu.filter(function (key) { return SYS_EXTRA_PAGES.indexOf(key) !== -1; });
    var otherBackend = backend === 'hr' ? 'ops' : 'hr';
    var switchHtml = '';
    if (window.OnboardRoles.can(user, 'backend:access') && canAccessBackend(user, otherBackend)) {
      switchHtml = '<a class="backend-switch-link" href="../' + otherBackend + '/index.html">切换到' + BACKEND_TITLES[otherBackend] + ' →</a>';
    }

    return '' +
      '<aside class="sidebar">' +
      '  <a class="sidebar-home-link" href="../index.html">← 返回门户首页</a>' +
      '  <div class="brand">' +
      '    <div class="brand-mark">' + (backend === 'hr' ? 'H' : 'O') + '</div>' +
      '    <div class="brand-text">' +
      '      <strong>' + esc(title) + '</strong>' +
      '      <span>初见 Onboard</span>' +
      '    </div>' +
      '  </div>' +
      '  <nav class="sidebar-nav" aria-label="后台导航">' +
      '    <div class="nav-label">' + esc(title) + '</div>' +
      mainPages.map(function (key) { return navButtonHtml(key, activePage); }).join('') +
      (extraPages.length ? '<div class="nav-label">系统管理</div>' + extraPages.map(function (key) { return navButtonHtml(key, activePage); }).join('') : '') +
      switchHtml +
      '  </nav>' +
      '  <a class="sidebar-learning-link" href="../academy/index.html">产品学习后台<span>→</span></a>' +
      '  <div class="sidebar-foot">' +
      '    <div class="user-card">' +
      '      <div class="avatar">' + esc(initials(user.name)) + '</div>' +
      '      <div class="user-meta">' +
      '        <div class="user-name">' + esc(user.name) + '</div>' +
      '        <div class="user-sub">' + esc(user.department) + ' · ' + esc(window.OnboardRoles.labelOf(user.role)) + '</div>' +
      '      </div>' +
      '    </div>' +
      '    <div class="user-actions">' +
      '      <button type="button" class="mini-btn" data-action="change-password">修改密码</button>' +
      '      <button type="button" class="mini-btn" data-action="logout">退出登录</button>' +
      '    </div>' +
      '    <div class="sidebar-ver">演示版 v2026-11-08</div>' +
      '  </div>' +
      '</aside>';
  }

  function overviewHtml(user) {
    return '' +
      '<section class="welcome-card">' +
      '  <span class="welcome-eyebrow">工作概览</span>' +
      '  <h2 class="welcome-title">欢迎你，' + esc(user.name) + '</h2>' +
      '  <p class="welcome-text">这里是「初见 Onboard」的工作概览。员工咨询、制度库、年假、工单和入职任务，之后都会从左侧导航里进入。</p>' +
      '  <p class="welcome-note">演示版：示例数据都会带“示例”标记；你的账号信息只保存在这台电脑的浏览器里。</p>' +
      '</section>';
  }

  function stateMessageHtml(user, title, description) {
    return '' +
      '<section class="state-card">' +
      '  <h2 class="state-title">' + esc(title) + '</h2>' +
      '  <p class="state-text">' + esc(description) + '</p>' +
      '  <p class="state-meta">你当前的角色：' + esc(window.OnboardRoles.labelOf(user.role)) + '</p>' +
      '  <button type="button" class="btn btn-primary" data-action="back-overview">返回工作概览</button>' +
      '</section>';
  }

  /* ================== 组织架构 ================== */

  function orgHtml(actor) {
    var departments = store.getDepartments();
    var enabledUsers = store.listUsers().filter(function (user) {
      return user.enabled !== false;
    });
    var canManage = window.OnboardRoles.can(actor, 'employee:manage');
    var companyName = store.getCompanyName();

    // 按部门分组（部门顺序沿用部门列表）
    var groups = departments.map(function (dept) {
      return { department: dept, members: [] };
    });
    var groupIndex = {};
    groups.forEach(function (group, index) {
      groupIndex[group.department] = index;
    });

    enabledUsers.forEach(function (user) {
      var dept = user.department || '未分配部门';
      if (groupIndex[dept] === undefined) {
        groupIndex[dept] = groups.length;
        groups.push({ department: dept, members: [] });
      }
      groups[groupIndex[dept]].members.push(user);
    });

    var groupsHtml = groups.map(function (group) {
      var membersHtml = group.members.map(function (user) {
        var isSelf = user.id === actor.id;
        return '' +
          '<div class="org-member">' +
          '  <span class="avatar avatar-sm">' + esc(initials(user.name)) + '</span>' +
          '  <span class="org-member-name">' + esc(user.name) + (isSelf ? '<span class="emp-self">（我）</span>' : '') + '</span>' +
          '</div>';
      }).join('');

      return '' +
        '<section class="org-dept">' +
        '  <div class="org-dept-head">' +
        '    <h3>' + esc(group.department) + '</h3>' +
        '    <span class="org-dept-count">' + group.members.length + ' 人</span>' +
        '  </div>' +
        (membersHtml ? '<div class="org-members">' + membersHtml + '</div>' : '<p class="org-empty">暂无启用的成员</p>') +
        '</section>';
    }).join('');

    return '' +
      '<section class="page-head">' +
      '  <div>' +
      '    <h2 class="page-head-title">组织架构</h2>' +
      '    <p class="page-head-sub">按部门查看同事 · 只显示启用的账号，不代表上下级关系</p>' +
      '  </div>' +
      '</section>' +
      (canManage
        ? '<section class="org-admin-bar">' +
          '  <span class="org-admin-label">管理员操作</span>' +
          '  <div class="page-actions">' +
          '    <button type="button" class="btn btn-ghost" data-action="add-department">新增部门</button>' +
          '    <button type="button" class="btn btn-primary" data-action="go-employees">员工管理</button>' +
          '  </div>' +
          '</section>'
        : '') +
      '<section class="org-company">' +
      '  <div class="org-company-mark">' +
      '    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '      <path d="M4 20V6.5A1.5 1.5 0 0 1 5.5 5h9A1.5 1.5 0 0 1 16 6.5V20"></path>' +
      '      <path d="M16 10h3.5A1.5 1.5 0 0 1 21 11.5V20"></path>' +
      '      <path d="M2.5 20h19"></path>' +
      '      <path d="M7.5 9h3M7.5 12.5h3M7.5 16h3"></path>' +
      '    </svg>' +
      '  </div>' +
      '  <div class="org-company-meta">' +
      '    <h2 class="org-company-name">' + esc(companyName) + '</h2>' +
      '    <p class="org-company-sub">共 ' + enabledUsers.length + ' 位启用的员工 · ' + groups.length + ' 个部门</p>' +
      '  </div>' +
      '</section>' +
      (groupsHtml ? '<div class="org-grid">' + groupsHtml + '</div>' : '<p class="org-empty-all">还没有部门。</p>');
  }

  function openAddDepartmentModal() {
    var actor = store.currentUser();
    if (!actor || !window.OnboardRoles.can(actor, 'employee:manage')) {
      toast('你没有新增部门的权限。');
      return;
    }

    modalRoot.innerHTML = '' +
      '<div class="modal-overlay" id="dept-overlay">' +
      '  <div class="modal modal-sm" role="dialog" aria-modal="true" aria-labelledby="dept-title">' +
      '    <div class="modal-head">' +
      '      <h3 id="dept-title">新增部门</h3>' +
      '      <button type="button" class="icon-btn" data-close="1" aria-label="关闭">×</button>' +
      '    </div>' +
      '    <p class="modal-sub">新部门会出现在组织架构和员工管理的部门下拉里。</p>' +
      '    <div class="form-error" id="dept-error" role="alert"></div>' +
      '    <form id="dept-form" novalidate autocomplete="off">' +
      '      <div class="field">' +
      '        <label for="dept-name">部门名称</label>' +
      '        <input class="input" id="dept-name" type="text" maxlength="20" placeholder="例如：市场部">' +
      '      </div>' +
      '      <div class="modal-foot">' +
      '        <button type="button" class="btn btn-ghost" data-close="1">取消</button>' +
      '        <button type="submit" class="btn btn-primary">保存</button>' +
      '      </div>' +
      '    </form>' +
      '  </div>' +
      '</div>';

    var overlay = document.getElementById('dept-overlay');
    var form = document.getElementById('dept-form');
    var errEl = document.getElementById('dept-error');
    var closeModal = wireModalClose(overlay);

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      hideError(errEl);

      var me = store.currentUser();
      if (!me || !window.OnboardRoles.can(me, 'employee:manage')) {
        showError(errEl, '你没有新增部门的权限。');
        return;
      }

      var result = store.addDepartment(document.getElementById('dept-name').value.trim());
      if (!result.ok) {
        showError(errEl, result.message);
        return;
      }

      closeModal();
      route();
      toast('已新增部门：' + result.department);
    });

    document.getElementById('dept-name').focus();
  }

  /* ================== 员工管理 ================== */

  function employeesHtml(actor) {
    var employees = store.listUsers();

    var rows = employees.map(function (emp) {
      var isSelf = emp.id === actor.id;
      var editable = window.OnboardRoles.canEditUser(actor, emp);
      var statusHtml = emp.enabled === false
        ? '<span class="status-badge status-off">停用</span>'
        : '<span class="status-badge status-on">启用</span>';
      var editBtn = editable
        ? '<button type="button" class="btn btn-ghost btn-sm" data-employee-id="' + esc(emp.id) + '">编辑</button>'
        : '<button type="button" class="btn btn-ghost btn-sm" data-employee-id="' + esc(emp.id) + '" disabled title="' + (isSelf ? '不能编辑当前登录的账号' : '你没有编辑这个账号的权限') + '">编辑</button>';

      return '' +
        '<tr>' +
        '  <td>' +
        '    <div class="emp-cell">' +
        '      <span class="avatar avatar-sm">' + esc(initials(emp.name)) + '</span>' +
        '      <span class="emp-name">' + esc(emp.name) + (isSelf ? '<span class="emp-self">（我）</span>' : '') + '</span>' +
        '    </div>' +
        '  </td>' +
        '  <td class="cell-mono">' + esc(emp.account) + '</td>' +
        '  <td>' + esc(emp.department) + '</td>' +
        '  <td>' + esc(window.OnboardRoles.labelOf(emp.role)) + '</td>' +
        '  <td>' + statusHtml + '</td>' +
        '  <td>' + editBtn + '</td>' +
        '</tr>';
    }).join('');

    return '' +
      '<section class="page-head">' +
      '  <div>' +
      '    <h2 class="page-head-title">员工管理</h2>' +
      '    <p class="page-head-sub">管理员工账号、角色与部门 · 共 ' + employees.length + ' 位员工 · 预置部门为示例数据</p>' +
      '  </div>' +
      '  <div class="page-actions">' +
      '    <button type="button" class="btn btn-ghost" data-action="import-employees">批量导入</button>' +
      '    <button type="button" class="btn btn-primary" data-action="add-employee">新增员工</button>' +
      '  </div>' +
      '</section>' +
      '<div class="table-card">' +
      '  <table class="data-table">' +
      '    <thead>' +
      '      <tr><th>员工</th><th>员工编号</th><th>部门</th><th>角色</th><th>状态</th><th>操作</th></tr>' +
      '    </thead>' +
      '    <tbody>' + rows + '</tbody>' +
      '  </table>' +
      '</div>';
  }

  function departmentFieldHtml(departments, selected) {
    var options = departments.map(function (dept) {
      return '<option value="' + esc(dept) + '"' + (dept === selected ? ' selected' : '') + '>' + esc(dept) + '</option>';
    }).join('');

    if (selected && departments.indexOf(selected) === -1) {
      options = '<option value="' + esc(selected) + '" selected>' + esc(selected) + '</option>' + options;
    }

    return '' +
      '<select class="input" id="emp-dept">' + options + '<option value="__new__">＋ 输入新部门…</option></select>' +
      '<input class="input emp-dept-new" id="emp-dept-new" type="text" maxlength="20" placeholder="请输入新部门名称" hidden>';
  }

  function roleOptionsHtml(actor, selectedRole) {
    return window.OnboardRoles.ROLE_ORDER.filter(function (role) {
      return window.OnboardRoles.canAssignRole(actor, role);
    }).map(function (role) {
      return '<option value="' + role + '"' + (role === selectedRole ? ' selected' : '') + '>' +
        esc(window.OnboardRoles.labelOf(role)) +
        '</option>';
    }).join('');
  }

  function wireDepartmentField() {
    var select = document.getElementById('emp-dept');
    var newInput = document.getElementById('emp-dept-new');
    if (!select || !newInput) return;

    select.addEventListener('change', function () {
      var isNew = select.value === '__new__';
      newInput.hidden = !isNew;
      if (isNew) newInput.focus();
    });
  }

  function readDepartment() {
    var select = document.getElementById('emp-dept');
    var newInput = document.getElementById('emp-dept-new');
    if (!select) return '';
    if (select.value === '__new__') return newInput ? newInput.value.trim() : '';
    return select.value;
  }

  // 弹窗通用的关闭逻辑（点遮罩、点关闭、按 Esc）
  function wireModalClose(overlay) {
    function closeModal() {
      document.removeEventListener('keydown', onKeydown);
      modalRoot.innerHTML = '';
    }

    function onKeydown(event) {
      if (event.key === 'Escape') closeModal();
    }

    document.addEventListener('keydown', onKeydown);
    overlay.addEventListener('click', function (event) {
      if (event.target === overlay) closeModal();
    });
    $$('[data-close]', overlay).forEach(function (btn) {
      btn.addEventListener('click', closeModal);
    });

    return closeModal;
  }

  function openCreateEmployeeModal() {
    var actor = store.currentUser();
    if (!actor || !window.OnboardRoles.can(actor, 'employee:manage')) {
      toast('你没有新增员工的权限。');
      return;
    }

    modalRoot.innerHTML = '' +
      '<div class="modal-overlay" id="emp-overlay">' +
      '  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="emp-modal-title">' +
      '    <div class="modal-head">' +
      '      <h3 id="emp-modal-title">新增员工</h3>' +
      '      <button type="button" class="icon-btn" data-close="1" aria-label="关闭">×</button>' +
      '    </div>' +
      '    <p class="modal-sub">员工编号同时是登录账号，创建后不能修改。</p>' +
      '    <div class="form-error" id="emp-error" role="alert"></div>' +
      '    <form id="emp-form" novalidate autocomplete="off">' +
      '      <div class="field">' +
      '        <label for="emp-name">姓名</label>' +
      '        <input class="input" id="emp-name" type="text" maxlength="20" placeholder="例如：王小雨">' +
      '      </div>' +
      '      <div class="field">' +
      '        <label for="emp-account">员工编号</label>' +
      '        <input class="input" id="emp-account" type="text" maxlength="30" placeholder="例如：EMP1024">' +
      '        <p class="hint">至少 4 位，不能有空格，创建后不能修改。</p>' +
      '      </div>' +
      '      <div class="field">' +
      '        <label for="emp-dept">部门</label>' +
      departmentFieldHtml(store.getDepartments(), '') +
      '      </div>' +
      '      <div class="field">' +
      '        <label for="emp-role">角色</label>' +
      '        <select class="input" id="emp-role">' + roleOptionsHtml(actor, 'employee') + '</select>' +
      '      </div>' +
      '      <div class="field">' +
      '        <label for="emp-password">初始密码</label>' +
      '        <input class="input" id="emp-password" type="password" maxlength="64" placeholder="至少 10 位" autocomplete="new-password">' +
      '        <p class="hint">至少 10 位，员工第一次登录时使用。</p>' +
      '      </div>' +
      '      <div class="modal-foot">' +
      '        <button type="button" class="btn btn-ghost" data-close="1">取消</button>' +
      '        <button type="submit" class="btn btn-primary">创建员工</button>' +
      '      </div>' +
      '    </form>' +
      '  </div>' +
      '</div>';

    var overlay = document.getElementById('emp-overlay');
    var form = document.getElementById('emp-form');
    var errEl = document.getElementById('emp-error');
    var closeModal = wireModalClose(overlay);

    wireDepartmentField();

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      hideError(errEl);

      var me = store.currentUser();
      if (!me || !window.OnboardRoles.can(me, 'employee:manage')) {
        showError(errEl, '你没有新增员工的权限。');
        return;
      }

      var role = document.getElementById('emp-role').value;
      // 权限再查一次：即使有人改了页面上的下拉选项，也分配不了高权限角色
      if (!window.OnboardRoles.canAssignRole(me, role)) {
        showError(errEl, '你没有创建这个角色的权限。');
        return;
      }

      var result = store.createEmployee({
        name: document.getElementById('emp-name').value.trim(),
        account: document.getElementById('emp-account').value.trim(),
        department: readDepartment(),
        role: role,
        password: document.getElementById('emp-password').value
      });

      if (!result.ok) {
        showError(errEl, result.message);
        return;
      }

      closeModal();
      route();
      toast('已新增员工：' + result.user.name);
    });

    document.getElementById('emp-name').focus();
  }

  function openEditEmployeeModal(employeeId) {
    var actor = store.currentUser();
    var target = store.getUserById(employeeId);

    if (!actor || !target) {
      toast('找不到这个员工。');
      return;
    }
    if (!window.OnboardRoles.canEditUser(actor, target)) {
      toast(target.id === actor.id ? '不能编辑当前登录的账号。' : '你没有编辑这个账号的权限。');
      return;
    }

    modalRoot.innerHTML = '' +
      '<div class="modal-overlay" id="emp-overlay">' +
      '  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="emp-modal-title">' +
      '    <div class="modal-head">' +
      '      <h3 id="emp-modal-title">编辑员工</h3>' +
      '      <button type="button" class="icon-btn" data-close="1" aria-label="关闭">×</button>' +
      '    </div>' +
      '    <p class="modal-sub">员工编号和角色创建后不能修改；密码留空表示不修改。</p>' +
      '    <div class="form-error" id="emp-error" role="alert"></div>' +
      '    <form id="emp-form" novalidate autocomplete="off">' +
      '      <div class="field">' +
      '        <label for="emp-name">姓名</label>' +
      '        <input class="input" id="emp-name" type="text" maxlength="20" value="' + esc(target.name) + '">' +
      '      </div>' +
      '      <div class="field">' +
      '        <label>员工编号（不可修改）</label>' +
      '        <input class="input" type="text" value="' + esc(target.account) + '" readonly disabled>' +
      '      </div>' +
      '      <div class="field">' +
      '        <label>角色（不可修改）</label>' +
      '        <input class="input" type="text" value="' + esc(window.OnboardRoles.labelOf(target.role)) + '" readonly disabled>' +
      '      </div>' +
      '      <div class="field">' +
      '        <label for="emp-dept">部门</label>' +
      departmentFieldHtml(store.getDepartments(), target.department) +
      '      </div>' +
      '      <div class="field">' +
      '        <label class="toggle-line"><input type="checkbox" id="emp-enabled"' + (target.enabled === false ? '' : ' checked') + '> 启用这个账号</label>' +
      '        <p class="hint">取消勾选后，这个账号将不能登录。</p>' +
      '      </div>' +
      '      <div class="field">' +
      '        <label for="emp-password">重置密码（留空表示不修改）</label>' +
      '        <input class="input" id="emp-password" type="password" maxlength="64" placeholder="留空则保持原密码" autocomplete="new-password">' +
      '        <p class="hint">如果要改，至少 10 位。</p>' +
      '      </div>' +
      '      <div class="modal-foot">' +
      '        <button type="button" class="btn btn-ghost" data-close="1">取消</button>' +
      '        <button type="submit" class="btn btn-primary">保存修改</button>' +
      '      </div>' +
      '    </form>' +
      '  </div>' +
      '</div>';

    var overlay = document.getElementById('emp-overlay');
    var form = document.getElementById('emp-form');
    var errEl = document.getElementById('emp-error');
    var closeModal = wireModalClose(overlay);

    wireDepartmentField();

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      hideError(errEl);

      var me = store.currentUser();
      var fresh = store.getUserById(target.id);
      // 权限再查一次，防止有人绕过界面直接触发保存
      if (!me || !fresh || !window.OnboardRoles.canEditUser(me, fresh)) {
        showError(errEl, '你没有编辑这个账号的权限。');
        return;
      }

      var result = store.updateEmployee({
        id: fresh.id,
        name: document.getElementById('emp-name').value.trim(),
        department: readDepartment(),
        enabled: document.getElementById('emp-enabled').checked,
        password: document.getElementById('emp-password').value
      });

      if (!result.ok) {
        showError(errEl, result.message);
        return;
      }

      closeModal();
      route();
      toast('已保存：' + result.user.name);
    });

    document.getElementById('emp-name').focus();
  }

  /* ================== 批量导入员工 ================== */

  function parseRoleInput(text) {
    var value = String(text == null ? '' : text).trim();
    if (!value) return '';
    var map = {
      '员工': 'employee',
      'employee': 'employee',
      'HR 管理员': 'hr_admin',
      'HR管理员': 'hr_admin',
      'hr_admin': 'hr_admin',
      '产品运营': 'ops_admin',
      'ops_admin': 'ops_admin',
      '系统管理员': 'sys_admin',
      'sys_admin': 'sys_admin'
    };
    if (Object.prototype.hasOwnProperty.call(map, value)) return map[value];
    var lower = value.toLowerCase();
    return map[lower] || '';
  }

  function parseCsvRows(text) {
    var rows = [];
    var row = [];
    var field = '';
    var inQuotes = false;

    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      if (inQuotes) {
        if (ch === '"') {
          if (text.charAt(i + 1) === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(field);
        field = '';
      } else if (ch === '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else if (ch !== '\r') {
        field += ch;
      }
    }
    row.push(field);
    rows.push(row);

    return rows.filter(function (cells) {
      return cells.some(function (cell) { return String(cell).trim() !== ''; });
    });
  }

  // Excel/WPS 在中文系统上可能存成 GBK，这里优先按 UTF-8 读，不行再按 GBK
  function decodeCsvBuffer(buffer) {
    var bytes = new Uint8Array(buffer);
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch (err) {
      try {
        return new TextDecoder('gbk').decode(bytes);
      } catch (err2) {
        return new TextDecoder('utf-8').decode(bytes);
      }
    }
  }

  function buildTemplateCsv() {
    return '\ufeff姓名,员工编号,部门,角色\r\n';
  }

  function downloadTemplate() {
    var blob = new Blob([buildTemplateCsv()], { type: 'text/csv;charset=utf-8' });

    if (window.navigator && window.navigator.msSaveOrOpenBlob) {
      window.navigator.msSaveOrOpenBlob(blob, '员工导入模板.csv');
      return;
    }

    var url = window.URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = '员工导入模板.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(function () { window.URL.revokeObjectURL(url); }, 1000);
  }

  /**
   * 只做校验，不写任何数据。
   * 返回 { ok:true, rows:[...] } 或 { ok:false, message }
   */
  function buildImportPreview(actor, rawRows) {
    var header = rawRows[0].map(function (cell) {
      return String(cell).replace(/^\ufeff/, '').trim();
    });
    var columns = {
      name: header.indexOf('姓名'),
      account: header.indexOf('员工编号'),
      department: header.indexOf('部门'),
      role: header.indexOf('角色')
    };

    if (columns.name < 0 || columns.account < 0 || columns.department < 0 || columns.role < 0) {
      return { ok: false, message: '模板格式不对：第一行需要包含“姓名、员工编号、部门、角色”四列，请重新下载模板。' };
    }

    var existing = {};
    store.listUsers().forEach(function (user) {
      existing[String(user.account || '').toLowerCase()] = true;
    });

    var seen = {};
    var rows = [];

    for (var i = 1; i < rawRows.length; i++) {
      var cells = rawRows[i];
      var name = String(cells[columns.name] == null ? '' : cells[columns.name]).trim();
      var account = String(cells[columns.account] == null ? '' : cells[columns.account]).trim();
      var department = String(cells[columns.department] == null ? '' : cells[columns.department]).trim();
      var roleText = String(cells[columns.role] == null ? '' : cells[columns.role]).trim();
      var role = parseRoleInput(roleText);
      var issues = [];

      if (!name) {
        issues.push('姓名为空');
      } else if (name.length > 20) {
        issues.push('姓名超过 20 个字');
      }

      if (!account) {
        issues.push('员工编号为空');
      } else {
        if (account.length < 4) issues.push('员工编号至少 4 位');
        else if (account.length > 30) issues.push('员工编号最多 30 位');
        if (/\s/.test(account)) issues.push('员工编号不能有空格');

        var key = account.toLowerCase();
        if (existing[key]) {
          issues.push('员工编号已存在');
        } else if (seen[key]) {
          issues.push('文件内员工编号重复');
        }
        if (!existing[key] && !seen[key]) seen[key] = true;
      }

      if (!department) {
        issues.push('部门为空');
      } else if (department.length > 20) {
        issues.push('部门名称超过 20 个字');
      }

      if (!roleText) {
        issues.push('角色为空');
      } else if (!role) {
        issues.push('角色不合法（可填：员工 / HR 管理员 / 产品运营 / 系统管理员）');
      } else if (!window.OnboardRoles.canAssignRole(actor, role)) {
        issues.push('你没有导入这个角色的权限');
      }

      rows.push({
        line: i + 1,
        name: name,
        account: account,
        department: department,
        roleText: roleText,
        role: role,
        issues: issues,
        ok: issues.length === 0
      });
    }

    return { ok: true, rows: rows };
  }

  function openImportEmployeesModal() {
    var actor = store.currentUser();
    if (!actor || !window.OnboardRoles.can(actor, 'employee:manage')) {
      toast('你没有批量导入的权限。');
      return;
    }

    modalRoot.innerHTML = '' +
      '<div class="modal-overlay" id="import-overlay">' +
      '  <div class="modal modal-wide" role="dialog" aria-modal="true" aria-labelledby="import-title">' +
      '    <div class="modal-head">' +
      '      <h3 id="import-title">批量导入员工</h3>' +
      '      <button type="button" class="icon-btn" data-close="1" aria-label="关闭">×</button>' +
      '    </div>' +
      '    <div class="form-error" id="import-error" role="alert"></div>' +
      '    <div id="import-step-upload">' +
      '      <p class="modal-sub">先下载模板，用 Excel 或 WPS 填写后保存为 CSV 再上传。上传后只会预览，不会直接写入。</p>' +
      '      <ol class="import-guide">' +
      '        <li>模板列：姓名、员工编号、部门、角色。</li>' +
      '        <li>角色可填：员工 / HR 管理员 / 产品运营 / 系统管理员。</li>' +
      '        <li>部门可以填已有部门，也可以填新部门（导入时自动加入部门列表）。</li>' +
      '        <li>员工编号建议按文本填写，避免 Excel 把 001 自动变成 1。</li>' +
      '      </ol>' +
      '      <div class="import-actions">' +
      '        <button type="button" class="btn btn-ghost" id="download-template">下载模板（CSV）</button>' +
      '        <label class="btn btn-primary file-btn">选择 CSV 文件<input type="file" id="import-file" accept=".csv,text/csv" hidden></label>' +
      '      </div>' +
      '    </div>' +
      '    <div id="import-step-preview" hidden>' +
      '      <p class="import-summary" id="import-summary"></p>' +
      '      <div class="import-table-wrap">' +
      '        <table class="data-table import-table">' +
      '          <thead><tr><th>行</th><th>姓名</th><th>员工编号</th><th>部门</th><th>角色</th><th>结果</th><th>说明</th></tr></thead>' +
      '          <tbody id="import-rows"></tbody>' +
      '        </table>' +
      '      </div>' +
      '      <div class="field">' +
      '        <label for="import-password">统一初始密码</label>' +
      '        <input class="input" id="import-password" type="password" maxlength="64" placeholder="至少 10 位，所有导入账号都用这个密码" autocomplete="new-password">' +
      '        <p class="hint">导入后请告诉员工用“员工编号 + 这个密码”登录，并建议第一次登录后修改。</p>' +
      '      </div>' +
      '      <div class="modal-foot">' +
      '        <button type="button" class="btn btn-ghost" id="import-back">重新选择</button>' +
      '        <button type="button" class="btn btn-primary" id="import-confirm">确认导入</button>' +
      '      </div>' +
      '    </div>' +
      '    <div id="import-step-result" hidden>' +
      '      <p class="import-result-text" id="import-result-text"></p>' +
      '      <div class="modal-foot"><button type="button" class="btn btn-primary" id="import-done">完成</button></div>' +
      '    </div>' +
      '  </div>' +
      '</div>';

    var overlay = document.getElementById('import-overlay');
    var errEl = document.getElementById('import-error');
    var uploadStep = document.getElementById('import-step-upload');
    var previewStep = document.getElementById('import-step-preview');
    var resultStep = document.getElementById('import-step-result');
    var fileInput = document.getElementById('import-file');
    var summaryEl = document.getElementById('import-summary');
    var rowsEl = document.getElementById('import-rows');
    var closeModal = wireModalClose(overlay);
    var preview = null;

    document.getElementById('download-template').addEventListener('click', downloadTemplate);

    function showUpload() {
      preview = null;
      uploadStep.hidden = false;
      previewStep.hidden = true;
      resultStep.hidden = true;
      fileInput.value = '';
      hideError(errEl);
    }

    function renderPreview() {
      var passed = preview.filter(function (row) { return row.ok; }).length;
      var failed = preview.length - passed;

      summaryEl.textContent = '共 ' + preview.length + ' 行：通过 ' + passed + ' 行，有问题 ' + failed +
        ' 行。有问题的行不会被导入。';

      rowsEl.innerHTML = preview.map(function (row) {
        var status = row.ok
          ? '<span class="status-badge status-on">通过</span>'
          : '<span class="status-badge status-off">不通过</span>';
        var note = row.ok ? '—' : esc(row.issues.join('；'));

        return '' +
          '<tr>' +
          '  <td>' + row.line + '</td>' +
          '  <td>' + esc(row.name || '（空）') + '</td>' +
          '  <td class="cell-mono">' + esc(row.account || '（空）') + '</td>' +
          '  <td>' + esc(row.department || '（空）') + '</td>' +
          '  <td>' + esc(row.roleText || '（空）') + '</td>' +
          '  <td>' + status + '</td>' +
          '  <td class="import-note">' + note + '</td>' +
          '</tr>';
      }).join('');

      uploadStep.hidden = true;
      previewStep.hidden = false;
      resultStep.hidden = true;
      document.getElementById('import-password').focus();
    }

    fileInput.addEventListener('change', function () {
      var file = fileInput.files && fileInput.files[0];
      if (!file) return;
      hideError(errEl);

      if (!/\.csv$/i.test(file.name)) {
        showError(errEl, '请上传 CSV 文件：在 Excel 里选“另存为 → CSV（逗号分隔）”后再上传。');
        fileInput.value = '';
        return;
      }

      var reader = new FileReader();
      reader.onload = function () {
        try {
          var text = decodeCsvBuffer(reader.result);
          var rawRows = parseCsvRows(text);

          if (rawRows.length < 2) {
            showError(errEl, '这个文件里没有数据行，请按模板填写后再上传。');
            fileInput.value = '';
            return;
          }

          var built = buildImportPreview(store.currentUser(), rawRows);
          if (!built.ok) {
            showError(errEl, built.message);
            fileInput.value = '';
            return;
          }

          preview = built.rows;
          renderPreview();
        } catch (err) {
          showError(errEl, '读取文件失败：' + ((err && err.message) ? err.message : String(err)));
          fileInput.value = '';
        }
      };
      reader.onerror = function () {
        showError(errEl, '读取文件失败，请重新选择。');
      };
      reader.readAsArrayBuffer(file);
    });

    document.getElementById('import-back').addEventListener('click', showUpload);

    document.getElementById('import-confirm').addEventListener('click', function () {
      hideError(errEl);
      if (!preview) return;

      var me = store.currentUser();
      if (!me || !window.OnboardRoles.can(me, 'employee:manage')) {
        showError(errEl, '你没有批量导入的权限。');
        return;
      }

      var password = document.getElementById('import-password').value;
      if (password.length < 10) {
        showError(errEl, '统一初始密码至少 10 位。');
        return;
      }
      if (password.length > 64) {
        showError(errEl, '统一初始密码最多 64 位。');
        return;
      }

      var hasValid = preview.some(function (row) { return row.ok; });
      if (!hasValid) {
        showError(errEl, '没有通过校验的行，请修改文件后重新上传。');
        return;
      }

      var imported = 0;
      var skipped = 0;
      var extraNotes = [];

      preview.forEach(function (row) {
        if (!row.ok) {
          skipped++;
          return;
        }
        // 再查一次权限，防止界面被改过
        if (!window.OnboardRoles.canAssignRole(me, row.role)) {
          skipped++;
          extraNotes.push('第 ' + row.line + ' 行：没有导入这个角色的权限');
          return;
        }

        var result = store.createEmployee({
          name: row.name,
          account: row.account,
          department: row.department,
          role: row.role,
          password: password
        });

        if (result.ok) {
          imported++;
        } else {
          skipped++;
          extraNotes.push('第 ' + row.line + ' 行：' + result.message);
        }
      });

      document.getElementById('import-result-text').textContent =
        '已导入 ' + imported + ' 行，跳过 ' + skipped + ' 行。' +
        (extraNotes.length ? '（' + extraNotes.join('；') + '）' : '') +
        (imported ? ' 请把“员工编号 + 统一初始密码”告诉对应员工。' : '');
      if (imported > 0) {
        store.logAudit('导入数据', '员工 CSV 导入 ' + imported + ' 条', me);
      }

      previewStep.hidden = true;
      resultStep.hidden = false;

      route();
    });

    document.getElementById('import-done').addEventListener('click', closeModal);
  }

  /* ================== 制度知识库 ================== */

  function todayISO() {
    var d = new Date();
    var month = d.getMonth() + 1;
    var day = d.getDate();
    return d.getFullYear() + '-' + (month < 10 ? '0' + month : month) + '-' + (day < 10 ? '0' + day : day);
  }

  function formatFileSize(size) {
    var value = Number(size || 0);
    if (value < 1024) return value + ' B';
    if (value < 1024 * 1024) return (value / 1024).toFixed(1) + ' KB';
    return (value / (1024 * 1024)).toFixed(2) + ' MB';
  }

  function fileExtOf(fileName) {
    var name = String(fileName || '');
    var index = name.lastIndexOf('.');
    return index < 0 ? '' : name.slice(index + 1).toLowerCase();
  }

  function bufferToBase64(buffer) {
    var bytes = new Uint8Array(buffer);
    var binary = '';
    var chunk = 0x8000;
    for (var i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return window.btoa(binary);
  }

  function base64ToBlob(base64, fileType) {
    var binary = window.atob(base64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    var mime = 'application/octet-stream';
    if (fileType === 'pdf') mime = 'application/pdf';
    else if (fileType === 'doc') mime = 'application/msword';
    else if (fileType === 'docx') mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    else if (fileType === 'txt') mime = 'text/plain';

    return new Blob([bytes], { type: mime });
  }

  function policyStatusGroup(status) {
    if (status === 'published') return 'published';
    if (status === 'failed') return 'failed';
    if (status === 'offline') return 'offline';
    return 'pending';
  }

  function policyStatusBadge(status) {
    var label = POLICY_STATUS_LABELS[status] || status;
    var cls = POLICY_STATUS_CLASS[status] || '';
    return '<span class="policy-status ' + cls + '">' + esc(label) + '</span>';
  }

  function policyTabsHtml() {
    var tabs = [
      { key: 'all', label: '全部' },
      { key: 'published', label: '已发布' },
      { key: 'pending', label: '待发布' },
      { key: 'failed', label: '失败' },
      { key: 'offline', label: '已下架' }
    ];
    return tabs.map(function (tab) {
      var active = policyFilter.status === tab.key ? ' is-active' : '';
      return '<button type="button" class="policy-tab' + active + '" data-policy-status="' + tab.key + '">' + tab.label + '</button>';
    }).join('');
  }

  function policiesHtml(actor) {
    var departments = store.getDepartments();

    var categoryOptions = '<option value="">全部分类</option>' + POLICY_CATEGORIES.map(function (category) {
      var selected = policyFilter.category === category ? ' selected' : '';
      return '<option value="' + esc(category) + '"' + selected + '>' + esc(category) + '</option>';
    }).join('');

    var scopeOptions = '<option value="">全部适用范围</option>' +
      '<option value="全员"' + (policyFilter.scope === '全员' ? ' selected' : '') + '>全员</option>' +
      departments.map(function (dept) {
        return '<option value="' + esc(dept) + '"' + (policyFilter.scope === dept ? ' selected' : '') + '>' + esc(dept) + '</option>';
      }).join('');

    return '' +
      '<section class="page-head">' +
      '  <div>' +
      '    <h2 class="page-head-title">制度知识库</h2>' +
      '    <p class="page-head-sub">上传制度原文，确认解析内容后发布，才会用于回答员工问题</p>' +
      '  </div>' +
      '  <div class="page-actions">' +
      '    <button type="button" class="btn btn-primary" data-action="upload-policy">上传制度</button>' +
      '  </div>' +
      '</section>' +
      '<div class="policy-filters">' +
      '  <div class="policy-tabs">' + policyTabsHtml() + '</div>' +
      '  <div class="policy-filter-row">' +
      '    <select class="input input-sm" id="policy-filter-category">' + categoryOptions + '</select>' +
      '    <select class="input input-sm" id="policy-filter-scope">' + scopeOptions + '</select>' +
      '    <input class="input input-sm policy-search" id="policy-filter-keyword" type="search" value="' + esc(policyFilter.keyword) + '" placeholder="按制度名称搜索">' +
      '    <span class="policy-count" id="policy-count"></span>' +
      '  </div>' +
      '</div>' +
      '<div class="table-card">' +
      '  <table class="data-table policy-table">' +
      '    <thead><tr><th>制度名称</th><th>分类</th><th>适用范围</th><th>版本号</th><th>生效日期</th><th>状态</th><th>操作</th></tr></thead>' +
      '    <tbody id="policy-list"></tbody>' +
      '  </table>' +
      '</div>' +
      '<p class="policy-note">只有已发布、在有效期内、适用员工部门的制度才会用于回答；扫描件 PDF 需要先做文字识别。</p>';
  }

  function policyRowHtml(policy) {
    var actions = '<button type="button" class="btn btn-ghost btn-sm" data-policy-action="detail" data-policy-id="' + esc(policy.id) + '">查看详情</button>';

    if (policy.status === 'ready' || policy.status === 'offline') {
      var publishLabel = '发布';
      if (policy.status === 'ready') {
        var gate = store.getPolicyConflictGate(policy.id);
        if (gate.unreviewed > 0) publishLabel = '尚有 ' + gate.unreviewed + ' 项未确认';
      }
      actions += '<button type="button" class="btn btn-primary btn-sm" data-policy-action="publish" data-policy-id="' + esc(policy.id) + '">' + esc(publishLabel) + '</button>';
    }
    if (policy.status === 'published') {
      actions += '<button type="button" class="btn btn-ghost btn-sm" data-policy-action="offline" data-policy-id="' + esc(policy.id) + '">下架</button>';
    }
    if (policy.status === 'failed') {
      actions += '<button type="button" class="btn btn-primary btn-sm" data-policy-action="retry" data-policy-id="' + esc(policy.id) + '">重试</button>';
    }
    actions += '<button type="button" class="btn btn-ghost btn-sm" data-policy-action="download" data-policy-id="' + esc(policy.id) + '">下载原文</button>';

    var failNote = policy.status === 'failed' && policy.failReason
      ? '<div class="policy-fail-reason">' + esc(policy.failReason) + '</div>'
      : '';

    return '' +
      '<tr>' +
      '  <td>' +
      '    <div class="policy-name">' + esc(policy.name) + '</div>' +
      '    <div class="policy-file">' + esc(policy.fileName) + ' · ' + esc(formatFileSize(policy.fileSize)) + '</div>' +
      '  </td>' +
      '  <td>' + esc(policy.category) + '</td>' +
      '  <td>' + esc(policy.scope) + '</td>' +
      '  <td>' + esc(policy.version) + '</td>' +
      '  <td>' + esc(policy.effectiveDate) + '</td>' +
      '  <td>' + policyStatusBadge(policy.status) + failNote + '</td>' +
      '  <td><div class="policy-actions">' + actions + '</div></td>' +
      '</tr>';
  }

  function renderPolicyList() {
    var list = document.getElementById('policy-list');
    if (!list) return;

    var policies = store.listPolicies();
    var keyword = policyFilter.keyword.trim().toLowerCase();

    var filtered = policies.filter(function (policy) {
      if (policyFilter.status !== 'all' && policyStatusGroup(policy.status) !== policyFilter.status) return false;
      if (policyFilter.category && policy.category !== policyFilter.category) return false;
      if (policyFilter.scope) {
        if (policyFilter.scope === '全员') {
          if (policy.scope !== '全员') return false;
        } else if (policy.scope !== policyFilter.scope && policy.scope !== '全员') {
          return false;
        }
      }
      if (keyword && String(policy.name).toLowerCase().indexOf(keyword) === -1) return false;
      return true;
    });

    $$('.policy-tab', appEl).forEach(function (tab) {
      tab.classList.toggle('is-active', tab.getAttribute('data-policy-status') === policyFilter.status);
    });

    var countEl = document.getElementById('policy-count');
    if (countEl) {
      countEl.textContent = policies.length
        ? '共 ' + policies.length + ' 条，当前显示 ' + filtered.length + ' 条'
        : '';
    }

    if (!filtered.length) {
      list.innerHTML = '<tr><td colspan="7" class="policy-empty">' +
        (policies.length ? '没有符合条件的制度，换个筛选条件试试。' : '还没有上传任何制度，点右上角“上传制度”开始。') +
        '</td></tr>';
      return;
    }

    list.innerHTML = filtered.map(policyRowHtml).join('');
  }

  function stopPolicyTimer() {
    if (policyTimer) {
      window.clearInterval(policyTimer);
      policyTimer = null;
    }
  }

  function startPolicyTimer() {
    stopPolicyTimer();
    policyTimer = window.setInterval(function () {
      if (!store.advancePolicies()) return;
      if (document.getElementById('policy-list')) renderPolicyList();
    }, 2200);
  }

  function wirePoliciesPage() {
    $$('.policy-tab', appEl).forEach(function (tab) {
      tab.addEventListener('click', function () {
        policyFilter.status = tab.getAttribute('data-policy-status');
        renderPolicyList();
      });
    });

    var categorySelect = document.getElementById('policy-filter-category');
    if (categorySelect) {
      categorySelect.addEventListener('change', function () {
        policyFilter.category = categorySelect.value;
        renderPolicyList();
      });
    }

    var scopeSelect = document.getElementById('policy-filter-scope');
    if (scopeSelect) {
      scopeSelect.addEventListener('change', function () {
        policyFilter.scope = scopeSelect.value;
        renderPolicyList();
      });
    }

    var keywordInput = document.getElementById('policy-filter-keyword');
    if (keywordInput) {
      keywordInput.addEventListener('input', function () {
        policyFilter.keyword = keywordInput.value;
        renderPolicyList();
      });
    }

    var list = document.getElementById('policy-list');
    if (list) {
      list.addEventListener('click', function (event) {
        var btn = event.target && event.target.closest ? event.target.closest('[data-policy-action]') : null;
        if (!btn) return;
        handlePolicyAction(btn.getAttribute('data-policy-action'), btn.getAttribute('data-policy-id'));
      });
    }

    var uploadBtn = $('[data-action="upload-policy"]', appEl);
    if (uploadBtn) uploadBtn.addEventListener('click', openUploadPolicyModal);
  }

  function buildPolicyDemoText(meta) {
    return [
      '【演示解析结果】',
      '本演示环境未接入真实的 PDF / Word 解析服务，下面正文为示例内容，用于演示预览效果（文字编码、表格展示）。',
      '——————————————————————',
      '《' + meta.name + '》',
      '分类：' + meta.category,
      '适用范围：' + meta.scope,
      '版本号：' + meta.version,
      '生效日期：' + meta.effectiveDate,
      '原始文件：' + meta.fileName,
      '',
      '第一章 总则',
      '第一条 为规范公司相关管理，结合公司实际情况，制定本制度。',
      '第二条 本制度适用于' + meta.scope + '。',
      '',
      '第二章 具体规定',
      '第三条 员工应按照本制度规定的流程办理相关事项。',
      '第四条 如遇特殊情况，可向人力资源部咨询。',
      '',
      '表格示例（用于确认表格是否保留）：',
      '项目        | 标准              | 备注',
      '申请时限    | 提前 3 个工作日    | 特殊情况除外',
      '审批人      | 直属主管           | 金额较大时需二级审批',
      '办理周期    | 每月 15 日前       | 节假日顺延',
      '',
      '（本页为演示内容；接入真实解析服务后，这里会显示从原始文件提取的正文。）'
    ].join('\n');
  }

  /**
   * 决定这条制度解析成功还是失败。
   * 演示环境：txt 读真实内容；PDF/Word 用模拟解析；旧版 .doc 和疑似扫描件会失败。
   */
  function planPolicyParse(meta, textContent) {
    if (meta.fileType === 'doc') {
      return { ok: false, reason: '旧版 .doc 暂不支持，请用 Word 另存为 .docx 后重新上传。' };
    }
    if (/扫描|扫描件|scan/i.test(meta.fileName)) {
      return { ok: false, reason: '疑似扫描件，没有提取到文字；扫描件 PDF 需要先做文字识别。' };
    }
    if (meta.fileType === 'txt') {
      var text = String(textContent || '');
      if (!text.trim()) return { ok: false, reason: '文件内容为空。' };
      var clipped = text.length > 30000 ? text.slice(0, 30000) + '\n\n（内容较长，预览只显示前 30000 个字符）' : text;
      return { ok: true, text: clipped };
    }
    return { ok: true, text: buildPolicyDemoText(meta) };
  }

  function openUploadPolicyModal() {
    var actor = store.currentUser();
    if (!actor || !window.OnboardRoles.can(actor, 'policy:manage')) {
      toast('你没有上传制度的权限。');
      return;
    }

    var departments = store.getDepartments();
    var categoryOptions = '<option value="">请选择分类</option>' + POLICY_CATEGORIES.map(function (category) {
      return '<option value="' + esc(category) + '">' + esc(category) + '</option>';
    }).join('');
    var scopeOptions = '<option value="全员">全员</option>' + departments.map(function (dept) {
      return '<option value="' + esc(dept) + '">' + esc(dept) + '</option>';
    }).join('');

    modalRoot.innerHTML = '' +
      '<div class="modal-overlay" id="policy-upload-overlay">' +
      '  <div class="modal modal-wide" role="dialog" aria-modal="true" aria-labelledby="policy-upload-title">' +
      '    <div class="modal-head">' +
      '      <h3 id="policy-upload-title">上传制度</h3>' +
      '      <button type="button" class="icon-btn" data-close="1" aria-label="关闭">×</button>' +
      '    </div>' +
      '    <p class="modal-sub">上传后会在后台排队解析，解析完成后先进入“待发布”，确认预览无误再手动发布。</p>' +
      '    <div class="form-error" id="policy-upload-error" role="alert"></div>' +
      '    <form id="policy-upload-form" novalidate autocomplete="off">' +
      '      <div class="field">' +
      '        <label for="policy-name">制度名称</label>' +
      '        <input class="input" id="policy-name" type="text" maxlength="40" placeholder="例如：差旅报销管理办法">' +
      '      </div>' +
      '      <div class="field">' +
      '        <label for="policy-category">分类</label>' +
      '        <select class="input" id="policy-category">' + categoryOptions + '</select>' +
      '      </div>' +
      '      <div class="field">' +
      '        <label for="policy-scope">适用范围</label>' +
      '        <select class="input" id="policy-scope">' + scopeOptions + '</select>' +
      '      </div>' +
      '      <div class="field-row">' +
      '        <div class="field">' +
      '          <label for="policy-version">版本号</label>' +
      '          <input class="input" id="policy-version" type="text" maxlength="20" placeholder="例如：V1.0">' +
      '        </div>' +
      '        <div class="field">' +
      '          <label for="policy-date">生效日期</label>' +
      '          <input class="input" id="policy-date" type="date" value="' + todayISO() + '">' +
      '        </div>' +
      '      </div>' +
      '      <div class="field">' +
      '        <label for="policy-file">制度文件</label>' +
      '        <input class="input" id="policy-file" type="file" accept=".pdf,.doc,.docx,.txt">' +
      '        <p class="hint" id="policy-file-hint">支持 PDF、Word（.doc / .docx）和文本（.txt）；演示版单个文件请小于 1.5MB。</p>' +
      '      </div>' +
      '      <div class="field">' +
      '        <label class="eval-confirm"><input type="checkbox" id="policy-require-signoff"> 需要员工签收</label>' +
      '        <p class="hint">勾选后，员工会在“消息与待办”里看到待签收提醒，可在制度中心查看后签收。</p>' +
      '      </div>' +
      '      <div class="modal-foot">' +
      '        <button type="button" class="btn btn-ghost" data-close="1">取消</button>' +
      '        <button type="submit" class="btn btn-primary">上传并解析</button>' +
      '      </div>' +
      '    </form>' +
      '  </div>' +
      '</div>';

    var overlay = document.getElementById('policy-upload-overlay');
    var form = document.getElementById('policy-upload-form');
    var errEl = document.getElementById('policy-upload-error');
    var fileInput = document.getElementById('policy-file');
    var fileHint = document.getElementById('policy-file-hint');
    var closeModal = wireModalClose(overlay);
    var chosenFile = null;
    var uploading = false;

    fileInput.addEventListener('change', function () {
      chosenFile = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
      if (chosenFile) {
        fileHint.textContent = '已选择：' + chosenFile.name + '（' + formatFileSize(chosenFile.size) + '）';
      }
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      hideError(errEl);

      var me = store.currentUser();
      if (!me || !window.OnboardRoles.can(me, 'policy:manage')) {
        showError(errEl, '你没有上传制度的权限。');
        return;
      }
      if (uploading) return;

      var meta = {
        name: document.getElementById('policy-name').value.trim(),
        category: document.getElementById('policy-category').value,
        scope: document.getElementById('policy-scope').value,
        version: document.getElementById('policy-version').value.trim(),
        effectiveDate: document.getElementById('policy-date').value
      };

      if (!chosenFile) {
        showError(errEl, '请选择要上传的制度文件。');
        return;
      }

      var ext = fileExtOf(chosenFile.name);
      if (['pdf', 'doc', 'docx', 'txt'].indexOf(ext) === -1) {
        showError(errEl, '只支持 PDF、Word（.doc / .docx）和文本（.txt）文件。');
        return;
      }
      if (chosenFile.size > 1.5 * 1024 * 1024) {
        showError(errEl, '演示版单个文件请小于 1.5MB。');
        return;
      }

      uploading = true;
      var submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      var reader = new FileReader();
      reader.onload = function () {
        try {
          var buffer = reader.result;
          var fileData = bufferToBase64(buffer);
          var textContent = ext === 'txt' ? decodeCsvBuffer(buffer) : '';
          var plan = planPolicyParse({
            name: meta.name,
            category: meta.category,
            scope: meta.scope,
            version: meta.version,
            effectiveDate: meta.effectiveDate,
            fileName: chosenFile.name,
            fileType: ext
          }, textContent);

          var result = store.createPolicy({
            name: meta.name,
            category: meta.category,
            scope: meta.scope,
            version: meta.version,
            effectiveDate: meta.effectiveDate,
            fileName: chosenFile.name,
            fileType: ext,
            fileSize: chosenFile.size,
            fileData: fileData,
            parseOk: plan.ok,
            parsedText: plan.text || '',
            failReason: plan.reason || '',
            requireSignoff: document.getElementById('policy-require-signoff').checked,
            uploadedBy: me.id
          });

          if (!result.ok) {
            uploading = false;
            if (submitBtn) submitBtn.disabled = false;
            showError(errEl, result.message);
            return;
          }

          closeModal();
          route();
          toast('已上传，正在后台排队解析…');
        } catch (err) {
          uploading = false;
          if (submitBtn) submitBtn.disabled = false;
          showError(errEl, '读取文件失败：' + ((err && err.message) ? err.message : String(err)));
        }
      };
      reader.onerror = function () {
        uploading = false;
        if (submitBtn) submitBtn.disabled = false;
        showError(errEl, '读取文件失败，请重新选择。');
      };
      reader.readAsArrayBuffer(chosenFile);
    });

    document.getElementById('policy-name').focus();
  }

  function openPolicyDetailModal(policyId) {
    var actor = store.currentUser();
    if (!actor || !window.OnboardRoles.can(actor, 'page:policies')) {
      toast('你没有查看制度的权限。');
      return;
    }
    var policy = store.getPolicyById(policyId);
    if (!policy) {
      toast('找不到这条制度。');
      return;
    }

    var previewText = policy.parsedText;
    if (!previewText) {
      if (policy.status === 'failed') {
        previewText = '解析失败：' + (policy.failReason || '未知原因') + '\n\n可以点“重试”重新解析，或重新上传文件。';
      } else {
        previewText = '还在排队或解析中，稍等几秒再打开查看。';
      }
    }

    modalRoot.innerHTML = '' +
      '<div class="modal-overlay" id="policy-detail-overlay">' +
      '  <div class="modal modal-wide" role="dialog" aria-modal="true" aria-labelledby="policy-detail-title">' +
      '    <div class="modal-head">' +
      '      <h3 id="policy-detail-title">制度详情</h3>' +
      '      <button type="button" class="icon-btn" data-close="1" aria-label="关闭">×</button>' +
      '    </div>' +
      '    <div class="policy-detail-meta">' +
      '      <div><span class="policy-detail-label">制度名称</span><span class="policy-detail-value">' + esc(policy.name) + '</span></div>' +
      '      <div><span class="policy-detail-label">分类</span><span class="policy-detail-value">' + esc(policy.category) + '</span></div>' +
      '      <div><span class="policy-detail-label">适用范围</span><span class="policy-detail-value">' + esc(policy.scope) + '</span></div>' +
      '      <div><span class="policy-detail-label">版本号</span><span class="policy-detail-value">' + esc(policy.version) + '</span></div>' +
      '      <div><span class="policy-detail-label">生效日期</span><span class="policy-detail-value">' + esc(policy.effectiveDate) + '</span></div>' +
      '      <div><span class="policy-detail-label">状态</span><span class="policy-detail-value">' + policyStatusBadge(policy.status) + '</span></div>' +
      '      <div><span class="policy-detail-label">原始文件</span><span class="policy-detail-value">' + esc(policy.fileName) + '（' + esc(formatFileSize(policy.fileSize)) + '）</span></div>' +
      '      <div><span class="policy-detail-label">上传时间</span><span class="policy-detail-value">' + esc(String(policy.createdAt).replace('T', ' ').slice(0, 19)) + '</span></div>' +
      '    </div>' +
      '    <p class="policy-detail-sub">解析文字预览（请确认没有乱码、表格没有丢失）</p>' +
      '    <pre class="policy-preview" id="policy-preview">' + esc(previewText) + '</pre>' +
      '    <div class="modal-foot">' +
      '      <button type="button" class="btn btn-ghost" data-close="1">关闭</button>' +
      '      <button type="button" class="btn btn-ghost" data-policy-action="download" data-policy-id="' + esc(policy.id) + '">下载原文</button>' +
      (policy.status === 'ready' || policy.status === 'offline'
        ? '<button type="button" class="btn btn-primary" data-policy-action="publish" data-policy-id="' + esc(policy.id) + '">发布</button>'
        : '') +
      (policy.status === 'published'
        ? '<button type="button" class="btn btn-ghost" data-policy-action="offline" data-policy-id="' + esc(policy.id) + '">下架</button>'
        : '') +
      (policy.status === 'failed'
        ? '<button type="button" class="btn btn-primary" data-policy-action="retry" data-policy-id="' + esc(policy.id) + '">重试</button>'
        : '') +
      '    </div>' +
      '  </div>' +
      '</div>';

    var overlay = document.getElementById('policy-detail-overlay');
    var closeModal = wireModalClose(overlay);

    $$('[data-policy-action]', overlay).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var action = btn.getAttribute('data-policy-action');
        var id = btn.getAttribute('data-policy-id');
        if (action === 'download') {
          downloadPolicyFile(id, policy.fileName);
          return;
        }
        closeModal();
        handlePolicyAction(action, id);
      });
    });
  }

  function actionPublishPolicy(policyId) {
    var me = store.currentUser();
    if (!me || !window.OnboardRoles.can(me, 'policy:manage')) {
      toast('你没有发布制度的权限。');
      return;
    }
    var result = store.publishPolicy(policyId);
    if (!result.ok) {
      toast(result.message);
      return;
    }
    route();
    toast('已发布：' + result.policy.name);
  }

  function actionOfflinePolicy(policyId) {
    var me = store.currentUser();
    if (!me || !window.OnboardRoles.can(me, 'policy:manage')) {
      toast('你没有下架制度的权限。');
      return;
    }
    var result = store.offlinePolicy(policyId);
    if (!result.ok) {
      toast(result.message);
      return;
    }
    route();
    toast('已下架：' + result.policy.name);
  }

  function actionRetryPolicy(policyId) {
    var me = store.currentUser();
    if (!me || !window.OnboardRoles.can(me, 'policy:manage')) {
      toast('你没有重试解析的权限。');
      return;
    }
    var result = store.retryPolicy(policyId);
    if (!result.ok) {
      toast(result.message);
      return;
    }
    route();
    toast('已重新排队解析…');
  }

  // 下载原始文件：必须登录；管理员凭管理权限，员工凭同一套可见性规则
  function downloadPolicyFile(policyId, fileName) {
    var me = store.currentUser();
    if (!me) {
      toast('请先登录。');
      renderLogin();
      return;
    }

    var policy = store.getPolicyById(policyId);
    if (!policy) {
      toast('找不到这条制度。');
      return;
    }

    // 与列表、详情、后续问答共用同一个判断，不另写一套
    var allowed = window.OnboardRoles.can(me, 'policy:manage') || store.isPolicyVisibleTo(policy, me);
    if (!allowed) {
      toast('你没有下载这份制度的权限。');
      return;
    }

    var fileData = store.getPolicyFileData(policyId);
    if (!fileData) {
      toast('原始文件不存在。');
      return;
    }

    var blob = base64ToBlob(fileData, policy.fileType);
    var url = window.URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = fileName || policy.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(function () { window.URL.revokeObjectURL(url); }, 1000);
  }

  function handlePolicyAction(action, policyId) {
    if (action === 'detail') return openPolicyDetailModal(policyId);
    if (action === 'publish') return actionPublishPolicy(policyId);
    if (action === 'offline') return actionOfflinePolicy(policyId);
    if (action === 'retry') return actionRetryPolicy(policyId);
    if (action === 'download') return downloadPolicyFile(policyId);
  }

  /* ================== 制度中心（员工端） ================== */

  var policyCenterFilter = { category: '', keyword: '' };

  function fileTypeLabel(fileType) {
    var map = { pdf: 'PDF', doc: 'DOC', docx: 'DOCX', txt: 'TXT' };
    return map[fileType] || '文件';
  }

  function fileTypeIconSvg() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M6.5 3.5h7l4 4V20a1.5 1.5 0 0 1-1.5 1.5H6.5A1.5 1.5 0 0 1 5 20V5a1.5 1.5 0 0 1 1.5-1.5Z"></path>' +
      '<path d="M13.5 3.5V8h4"></path>' +
      '<path d="M8.5 12.5h7M8.5 16h5"></path>' +
      '</svg>';
  }

  function policyCenterScopeText(policy) {
    return policy.scope === '全员' ? '全员可见' : policy.scope + '专属';
  }

  function policyCenterHtml(actor) {
    var department = actor.department || '未分配部门';
    var categoryOptions = '<option value="">全部分类</option>' + POLICY_CATEGORIES.map(function (category) {
      var selected = policyCenterFilter.category === category ? ' selected' : '';
      return '<option value="' + esc(category) + '"' + selected + '>' + esc(category) + '</option>';
    }).join('');

    return '' +
      '<section class="policy-hero">' +
      '  <h2 class="policy-hero-title">每一项制度，都有清晰的依据</h2>' +
      '  <p class="policy-hero-dept">你的部门：<strong>' + esc(department) + '</strong></p>' +
      '  <p class="policy-hero-note">可查看全员及本部门的有效制度</p>' +
      '</section>' +
      '<div class="policy-center-filters">' +
      '  <select class="input input-sm" id="center-filter-category">' + categoryOptions + '</select>' +
      '  <input class="input input-sm policy-search" id="center-filter-keyword" type="search" value="' + esc(policyCenterFilter.keyword) + '" placeholder="按制度名称搜索">' +
      '  <span class="policy-count" id="policy-center-count"></span>' +
      '</div>' +
      '<div class="policy-center-grid" id="policy-center-grid"></div>' +
      '<p class="policy-demo-note" id="policy-demo-note" hidden>仅用于演示，正式使用前由管理员替换。</p>';
  }

  function policyCenterCardHtml(policy) {
    var scopeClass = policy.scope === '全员' ? 'is-all' : 'is-dept';
    return '' +
      '<article class="policy-card">' +
      '  <div class="policy-card-top">' +
      '    <span class="policy-card-icon">' + fileTypeIconSvg() +
      '      <span class="policy-file-type">' + esc(fileTypeLabel(policy.fileType)) + '</span>' +
      '    </span>' +
      '    <span class="policy-scope-tag ' + scopeClass + '">' + esc(policyCenterScopeText(policy)) + '</span>' +
      '  </div>' +
      '  <div class="policy-card-category">' + esc(policy.category) + '</div>' +
      '  <h3 class="policy-card-title">' + esc(policy.name) + '</h3>' +
      '  <p class="policy-card-meta">' + esc(policy.version) + ' · 生效日期 ' + esc(policy.effectiveDate) + '</p>' +
      '  <button type="button" class="btn btn-ghost policy-card-btn" data-policy-center-id="' + esc(policy.id) + '">查看制度正文</button>' +
      '</article>';
  }

  function renderPolicyCenterList() {
    var grid = document.getElementById('policy-center-grid');
    if (!grid) return;

    var actor = store.currentUser();
    if (!actor) return;

    // 员工端、详情、下载、后续问答都走 store.listVisiblePolicies 这一套规则
    var visible = store.listVisiblePolicies(actor);
    var keyword = policyCenterFilter.keyword.trim().toLowerCase();

    var filtered = visible.filter(function (policy) {
      if (policyCenterFilter.category && policy.category !== policyCenterFilter.category) return false;
      if (keyword && String(policy.name).toLowerCase().indexOf(keyword) === -1) return false;
      return true;
    });

    var countEl = document.getElementById('policy-center-count');
    if (countEl) countEl.textContent = visible.length ? '共 ' + visible.length + ' 份可查看制度' : '';

    if (!filtered.length) {
      grid.innerHTML = '<div class="policy-empty-state">' +
        '<div class="policy-empty-icon">' + fileTypeIconSvg() + '</div>' +
        '<h3>暂时没有符合条件的制度</h3>' +
        '<p>换个分类或清空搜索试试；如果确实找不到需要的制度，可以联系 HR 或系统管理员。</p>' +
        '</div>';
    } else {
      grid.innerHTML = filtered.map(policyCenterCardHtml).join('');
    }

    var demoNote = document.getElementById('policy-demo-note');
    if (demoNote) {
      var hasDemo = visible.some(function (policy) {
        return String(policy.name).indexOf('示例') !== -1;
      });
      demoNote.hidden = !hasDemo;
    }
  }

  function wirePolicyCenterPage() {
    var categorySelect = document.getElementById('center-filter-category');
    if (categorySelect) {
      categorySelect.addEventListener('change', function () {
        policyCenterFilter.category = categorySelect.value;
        renderPolicyCenterList();
      });
    }

    var keywordInput = document.getElementById('center-filter-keyword');
    if (keywordInput) {
      keywordInput.addEventListener('input', function () {
        policyCenterFilter.keyword = keywordInput.value;
        renderPolicyCenterList();
      });
    }

    var grid = document.getElementById('policy-center-grid');
    if (grid) {
      grid.addEventListener('click', function (event) {
        var btn = event.target && event.target.closest ? event.target.closest('[data-policy-center-id]') : null;
        if (!btn) return;
        openPolicyCenterDetail(btn.getAttribute('data-policy-center-id'));
      });
    }
  }

  function openPolicyCenterDetail(policyId) {
    var actor = store.currentUser();
    if (!actor) {
      renderLogin();
      return;
    }

    // 详情同样只认共享的可见性规则
    var policy = store.findVisiblePolicy(actor, policyId);
    if (!policy) {
      toast('这份制度暂时不可查看，可能已下架或不在你的适用范围内。');
      route();
      return;
    }

    var previewText = policy.parsedText || '（这份制度暂无可预览的正文）';
    var signoff = policy.requireSignoff ? store.getPolicySignoff(actor, policy.id) : null;

    modalRoot.innerHTML = '' +
      '<div class="modal-overlay" id="policy-center-detail-overlay">' +
      '  <div class="modal modal-wide" role="dialog" aria-modal="true" aria-labelledby="policy-center-detail-title">' +
      '    <div class="modal-head">' +
      '      <h3 id="policy-center-detail-title">制度正文</h3>' +
      '      <button type="button" class="icon-btn" data-close="1" aria-label="关闭">×</button>' +
      '    </div>' +
      '    <div class="policy-detail-meta">' +
      '      <div><span class="policy-detail-label">制度名称</span><span class="policy-detail-value">' + esc(policy.name) + '</span></div>' +
      '      <div><span class="policy-detail-label">分类</span><span class="policy-detail-value">' + esc(policy.category) + '</span></div>' +
      '      <div><span class="policy-detail-label">适用范围</span><span class="policy-detail-value">' + esc(policyCenterScopeText(policy)) + '</span></div>' +
      '      <div><span class="policy-detail-label">版本号</span><span class="policy-detail-value">' + esc(policy.version) + '</span></div>' +
      '      <div><span class="policy-detail-label">生效日期</span><span class="policy-detail-value">' + esc(policy.effectiveDate) + '</span></div>' +
      '      <div><span class="policy-detail-label">原始文件</span><span class="policy-detail-value">' + esc(policy.fileName) + '</span></div>' +
      (policy.requireSignoff
        ? '<div><span class="policy-detail-label">签收要求</span><span class="policy-detail-value">' +
          (signoff ? '已签收（' + esc(formatDateTime(signoff.signedAt)) + '）' : '需要签收') + '</span></div>'
        : '') +
      '    </div>' +
      '    <pre class="policy-preview">' + esc(previewText) + '</pre>' +
      '    <div class="modal-foot">' +
      '      <button type="button" class="btn btn-ghost" data-close="1">关闭</button>' +
      '      <button type="button" class="btn btn-ghost" data-policy-action="download" data-policy-id="' + esc(policy.id) + '">下载原文</button>' +
      (policy.requireSignoff && !signoff
        ? '<button type="button" class="btn btn-primary" id="policy-center-signoff">我已阅读并确认签收</button>'
        : '') +
      '    </div>' +
      '  </div>' +
      '</div>';

    var overlay = document.getElementById('policy-center-detail-overlay');
    var closeModal = wireModalClose(overlay);

    $$('[data-policy-action="download"]', overlay).forEach(function (btn) {
      btn.addEventListener('click', function () {
        downloadPolicyFile(policy.id, policy.fileName);
      });
    });

    var signBtn = document.getElementById('policy-center-signoff');
    if (signBtn) {
      signBtn.addEventListener('click', function () {
        var result = store.signPolicy(actor, policy.id);
        if (!result.ok) {
          toast(result.message);
          return;
        }
        toast('已签收，待办里会同步更新');
        closeModal();
        openPolicyCenterDetail(policy.id);
      });
    }
  }

  /* ================== 年假管理（HR 后台） ================== */

  var leaveYearFilter = new Date().getFullYear();

  function leaveYears() {
    var current = new Date().getFullYear();
    var years = [];
    for (var y = current - 1; y <= current + 2; y++) years.push(String(y));
    return years;
  }

  function formatDateTime(iso) {
    if (!iso) return '—';
    return String(iso).replace('T', ' ').slice(0, 16);
  }

  function formatDays(value) {
    var number = Number(value);
    if (!isFinite(number)) return '0';
    return String(Math.round(number * 100) / 100);
  }

  function parseLeaveDays(text) {
    var raw = String(text == null ? '' : text).trim();
    if (!raw) return { ok: false, message: '请填写天数。' };
    if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
      return { ok: false, message: '天数只能填数字（最多两位小数），例如 2 或 1.5。' };
    }
    var value = Math.round(Number(raw) * 100) / 100;
    if (!isFinite(value)) return { ok: false, message: '天数只能填数字。' };
    if (value === 0) return { ok: false, message: '天数不能为 0。' };
    if (value > 365) return { ok: false, message: '单次调整不能超过 365 天。' };
    return { ok: true, value: value };
  }

  function leaveYearOptionsHtml(selected) {
    return leaveYears().map(function (year) {
      return '<option value="' + year + '"' + (year === String(selected) ? ' selected' : '') + '>' + year + ' 年</option>';
    }).join('');
  }

  function leaveAdminHtml(actor) {
    return '' +
      '<section class="page-head">' +
      '  <div>' +
      '    <h2 class="page-head-title">年假管理</h2>' +
      '    <p class="page-head-sub">余额由流水合计得出；每次调整、导入都会留下记录</p>' +
      '  </div>' +
      '  <div class="page-actions">' +
      '    <button type="button" class="btn btn-ghost" data-action="import-leave">导入余额</button>' +
      '    <button type="button" class="btn btn-primary" data-action="adjust-leave">调整年假</button>' +
      '  </div>' +
      '</section>' +
      '<div class="leave-filters">' +
      '  <label class="leave-filter-label" for="leave-year">年度</label>' +
      '  <select class="input input-sm" id="leave-year">' + leaveYearOptionsHtml(leaveYearFilter) + '</select>' +
      '  <span class="policy-count" id="leave-count"></span>' +
      '</div>' +
      '<div class="table-card">' +
      '  <table class="data-table leave-table">' +
      '    <thead><tr><th>员工</th><th>年度</th><th>剩余年假（天）</th><th>最后更新时间</th><th>变更记录</th></tr></thead>' +
      '    <tbody id="leave-list"></tbody>' +
      '  </table>' +
      '</div>' +
      '<p class="policy-note">余额由 HR 维护；导入余额会生成对账调整流水，历史变动始终保留。</p>';
  }

  function renderLeaveTable() {
    var tbody = document.getElementById('leave-list');
    if (!tbody) return;

    var users = store.listUsers();
    var year = String(leaveYearFilter);
    var countEl = document.getElementById('leave-count');
    if (countEl) countEl.textContent = users.length ? '共 ' + users.length + ' 位员工 · 年度 ' + year : '';

    if (!users.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="policy-empty">还没有员工，先到“员工管理”新增或导入员工。</td></tr>';
      return;
    }

    tbody.innerHTML = users.map(function (user) {
      var balance = store.getLeaveBalance(user.id, year);
      var entries = store.listLeaveEntries(user.id, year);
      var lastUpdated = store.getLeaveLastUpdated(user.id, year);
      var balanceClass = balance < 0 ? ' is-negative' : '';
      var disabledTag = user.enabled === false ? '<span class="leave-disabled">已停用</span>' : '';

      return '' +
        '<tr>' +
        '  <td>' +
        '    <div class="emp-cell">' +
        '      <span class="avatar avatar-sm">' + esc(initials(user.name)) + '</span>' +
        '      <span class="emp-name">' + esc(user.name) + disabledTag +
        '        <span class="leave-account">' + esc(user.account) + '</span>' +
        '      </span>' +
        '    </div>' +
        '  </td>' +
        '  <td>' + esc(year) + '</td>' +
        '  <td><span class="leave-balance' + balanceClass + '">' + esc(formatDays(balance)) + '</span></td>' +
        '  <td>' + esc(formatDateTime(lastUpdated)) + '</td>' +
        '  <td><button type="button" class="btn btn-ghost btn-sm" data-leave-ledger="' + esc(user.id) + '"' + (entries.length ? '' : ' disabled') + '>查看 ' + entries.length + ' 条流水</button></td>' +
        '</tr>';
    }).join('');
  }

  function wireLeavePage() {
    var yearSelect = document.getElementById('leave-year');
    if (yearSelect) {
      yearSelect.addEventListener('change', function () {
        leaveYearFilter = Number(yearSelect.value);
        renderLeaveTable();
      });
    }

    var adjustBtn = $('[data-action="adjust-leave"]', appEl);
    if (adjustBtn) adjustBtn.addEventListener('click', function () { openAdjustLeaveModal(); });

    var importBtn = $('[data-action="import-leave"]', appEl);
    if (importBtn) importBtn.addEventListener('click', openImportLeaveModal);

    var list = document.getElementById('leave-list');
    if (list) {
      list.addEventListener('click', function (event) {
        var btn = event.target && event.target.closest ? event.target.closest('[data-leave-ledger]') : null;
        if (!btn) return;
        openLeaveLedgerModal(btn.getAttribute('data-leave-ledger'));
      });
    }
  }

  function openAdjustLeaveModal() {
    var actor = store.currentUser();
    if (!actor || !window.OnboardRoles.can(actor, 'leave:manage')) {
      toast('你没有调整年假的权限。');
      return;
    }

    var users = store.listUsers();
    if (!users.length) {
      toast('还没有员工，无法调整年假。');
      return;
    }

    var userOptions = users.map(function (user) {
      return '<option value="' + esc(user.id) + '">' + esc(user.name) + '（' + esc(user.account) + '）</option>';
    }).join('');

    modalRoot.innerHTML = '' +
      '<div class="modal-overlay" id="leave-adjust-overlay">' +
      '  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="leave-adjust-title">' +
      '    <div class="modal-head">' +
      '      <h3 id="leave-adjust-title">调整年假</h3>' +
      '      <button type="button" class="icon-btn" data-close="1" aria-label="关闭">×</button>' +
      '    </div>' +
      '    <p class="modal-sub">每次调整都会生成一条流水，余额等于全部流水的合计。</p>' +
      '    <div class="form-error" id="leave-adjust-error" role="alert"></div>' +
      '    <form id="leave-adjust-form" novalidate autocomplete="off">' +
      '      <div class="field">' +
      '        <label for="leave-user">员工</label>' +
      '        <select class="input" id="leave-user">' + userOptions + '</select>' +
      '      </div>' +
      '      <div class="field">' +
      '        <label for="leave-year-input">年度</label>' +
      '        <select class="input" id="leave-year-input">' + leaveYearOptionsHtml(leaveYearFilter) + '</select>' +
      '      </div>' +
      '      <p class="leave-preview" id="leave-preview">当前余额：0 天</p>' +
      '      <div class="field-row">' +
      '        <div class="field">' +
      '          <label for="leave-direction">调整方式</label>' +
      '          <select class="input" id="leave-direction">' +
      '            <option value="increase">增加</option>' +
      '            <option value="decrease">减少</option>' +
      '          </select>' +
      '        </div>' +
      '        <div class="field">' +
      '          <label for="leave-days">天数</label>' +
      '          <input class="input" id="leave-days" type="text" inputmode="decimal" placeholder="例如 2 或 1.5">' +
      '        </div>' +
      '      </div>' +
      '      <div class="field">' +
      '        <label for="leave-reason">调整原因</label>' +
      '        <input class="input" id="leave-reason" type="text" maxlength="100" placeholder="例如：补录 2026 年度年假额度">' +
      '      </div>' +
      '      <div class="modal-foot">' +
      '        <button type="button" class="btn btn-ghost" data-close="1">取消</button>' +
      '        <button type="submit" class="btn btn-primary">保存调整</button>' +
      '      </div>' +
      '    </form>' +
      '  </div>' +
      '</div>';

    var overlay = document.getElementById('leave-adjust-overlay');
    var form = document.getElementById('leave-adjust-form');
    var errEl = document.getElementById('leave-adjust-error');
    var userSelect = document.getElementById('leave-user');
    var yearSelect = document.getElementById('leave-year-input');
    var directionSelect = document.getElementById('leave-direction');
    var daysInput = document.getElementById('leave-days');
    var reasonInput = document.getElementById('leave-reason');
    var previewEl = document.getElementById('leave-preview');
    var closeModal = wireModalClose(overlay);

    function updatePreview() {
      var current = store.getLeaveBalance(userSelect.value, yearSelect.value);
      var parsed = parseLeaveDays(daysInput.value);
      var after = current;
      if (parsed.ok) after = directionSelect.value === 'decrease' ? current - parsed.value : current + parsed.value;
      previewEl.textContent = '当前余额：' + formatDays(current) + ' 天' + (parsed.ok ? '，调整后：' + formatDays(after) + ' 天' : '');
    }

    [userSelect, yearSelect, directionSelect, daysInput].forEach(function (el) {
      el.addEventListener('input', updatePreview);
      el.addEventListener('change', updatePreview);
    });
    updatePreview();

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      hideError(errEl);

      var me = store.currentUser();
      if (!me || !window.OnboardRoles.can(me, 'leave:manage')) {
        showError(errEl, '你没有调整年假的权限。');
        return;
      }

      var parsed = parseLeaveDays(daysInput.value);
      if (!parsed.ok) {
        showError(errEl, parsed.message);
        return;
      }

      var reason = reasonInput.value.trim();
      if (!reason) {
        showError(errEl, '请填写调整原因。');
        return;
      }

      var result = store.addLeaveEntry({
        userId: userSelect.value,
        year: yearSelect.value,
        delta: directionSelect.value === 'decrease' ? -parsed.value : parsed.value,
        reason: reason,
        type: 'manual',
        createdBy: me.id
      });

      if (!result.ok) {
        showError(errEl, result.message);
        return;
      }

      closeModal();
      route();
      toast('已生成 1 条年假流水');
    });

    daysInput.focus();
  }

  function openLeaveLedgerModal(userId) {
    var actor = store.currentUser();
    if (!actor || !window.OnboardRoles.can(actor, 'page:leave-admin')) {
      toast('你没有查看年假流水的权限。');
      return;
    }

    var user = store.getUserById(userId);
    if (!user) {
      toast('找不到这个员工。');
      return;
    }

    var year = String(leaveYearFilter);
    var entries = store.listLeaveEntries(userId, year);
    var balance = store.getLeaveBalance(userId, year);

    var rows = entries.map(function (entry) {
      var delta = Number(entry.delta);
      var typeLabel = store.LEAVE_ENTRY_LABELS[entry.type] || '调整';
      return '' +
        '<tr>' +
        '  <td>' + esc(formatDateTime(entry.createdAt)) + '</td>' +
        '  <td>' + esc(entry.reason) + '</td>' +
        '  <td><span class="leave-type">' + esc(typeLabel) + '</span></td>' +
        '  <td class="leave-delta ' + (delta >= 0 ? 'is-plus' : 'is-minus') + '">' + (delta > 0 ? '+' : '') + esc(formatDays(delta)) + '</td>' +
        '</tr>';
    }).join('');

    modalRoot.innerHTML = '' +
      '<div class="modal-overlay" id="leave-ledger-overlay">' +
      '  <div class="modal modal-wide" role="dialog" aria-modal="true" aria-labelledby="leave-ledger-title">' +
      '    <div class="modal-head">' +
      '      <h3 id="leave-ledger-title">年假流水</h3>' +
      '      <button type="button" class="icon-btn" data-close="1" aria-label="关闭">×</button>' +
      '    </div>' +
      '    <p class="modal-sub">' + esc(user.name) + '（' + esc(user.account) + '） · ' + esc(year) + ' 年 · 当前余额 ' + esc(formatDays(balance)) + ' 天</p>' +
      '    <div class="import-table-wrap">' +
      '      <table class="data-table">' +
      '        <thead><tr><th>时间</th><th>原因</th><th>类型</th><th>增减（天）</th></tr></thead>' +
      '        <tbody>' + (rows || '<tr><td colspan="4" class="policy-empty">这个年度还没有流水。</td></tr>') + '</tbody>' +
      '      </table>' +
      '    </div>' +
      '    <p class="policy-note">历史流水永久保留，不能删除。</p>' +
      '    <div class="modal-foot"><button type="button" class="btn btn-primary" data-close="1">关闭</button></div>' +
      '  </div>' +
      '</div>';

    wireModalClose(document.getElementById('leave-ledger-overlay'));
  }

  function downloadLeaveTemplateCsv() {
    var content = '\ufeff员工账号,年度,余额（天）\r\n';
    var blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
    var url = window.URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = '年假余额导入模板.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(function () { window.URL.revokeObjectURL(url); }, 1000);
  }

  function buildLeaveImportPreview(rawRows) {
    var header = rawRows[0].map(function (cell) {
      return String(cell).replace(/^\ufeff/, '').trim();
    });

    function findColumn(names) {
      for (var i = 0; i < names.length; i++) {
        var index = header.indexOf(names[i]);
        if (index !== -1) return index;
      }
      return -1;
    }

    var accountIndex = findColumn(['员工账号', '员工编号', '账号']);
    var yearIndex = findColumn(['年度', '年份']);
    var balanceIndex = findColumn(['余额（天）', '余额(天)', '余额']);

    if (accountIndex < 0 || yearIndex < 0 || balanceIndex < 0) {
      return { ok: false, message: '模板格式不对：第一行需要包含“员工账号、年度、余额（天）”三列，请重新下载模板。' };
    }

    var seen = {};
    var rows = [];

    for (var i = 1; i < rawRows.length; i++) {
      var cells = rawRows[i];
      var account = String(cells[accountIndex] == null ? '' : cells[accountIndex]).trim();
      var year = String(cells[yearIndex] == null ? '' : cells[yearIndex]).trim();
      var balanceText = String(cells[balanceIndex] == null ? '' : cells[balanceIndex]).trim();
      var issues = [];

      var user = account ? store.findUserByAccount(account) : null;
      if (!account) issues.push('员工账号为空');
      else if (!user) issues.push('员工账号不存在');

      if (!/^\d{4}$/.test(year) || Number(year) < 2000 || Number(year) > 2100) {
        issues.push('年度不合法');
      }

      var imported = null;
      if (!balanceText) {
        issues.push('余额为空');
      } else if (!/^-?\d+(\.\d{1,2})?$/.test(balanceText)) {
        issues.push('余额只能填数字（可以是负数）');
      } else {
        imported = Math.round(Number(balanceText) * 100) / 100;
      }

      var key = user && /^\d{4}$/.test(year) ? user.id + '|' + year : '';
      if (key) {
        if (seen[key]) issues.push('文件内重复');
        seen[key] = true;
      }

      var current = user && /^\d{4}$/.test(year) ? store.getLeaveBalance(user.id, year) : 0;
      var diff = imported === null ? null : Math.round((imported - current) * 100) / 100;

      rows.push({
        line: i + 1,
        account: account,
        user: user,
        year: year,
        imported: imported,
        current: current,
        diff: diff,
        issues: issues,
        ok: issues.length === 0
      });
    }

    return { ok: true, rows: rows };
  }

  function openImportLeaveModal() {
    var actor = store.currentUser();
    if (!actor || !window.OnboardRoles.can(actor, 'leave:manage')) {
      toast('你没有导入年假余额的权限。');
      return;
    }

    modalRoot.innerHTML = '' +
      '<div class="modal-overlay" id="leave-import-overlay">' +
      '  <div class="modal modal-wide" role="dialog" aria-modal="true" aria-labelledby="leave-import-title">' +
      '    <div class="modal-head">' +
      '      <h3 id="leave-import-title">导入年假余额</h3>' +
      '      <button type="button" class="icon-btn" data-close="1" aria-label="关闭">×</button>' +
      '    </div>' +
      '    <p class="modal-sub">模板列：员工账号、年度、余额（天）。上传后先预览，确认后才写入；与现有余额不一致时会生成一条“对账调整”流水，不会覆盖历史。</p>' +
      '    <div class="form-error" id="leave-import-error" role="alert"></div>' +
      '    <div class="import-actions">' +
      '      <button type="button" class="btn btn-ghost" id="download-leave-template">下载模板（CSV）</button>' +
      '      <label class="btn btn-primary file-btn">选择 CSV 文件<input type="file" id="leave-import-file" accept=".csv,text/csv" hidden></label>' +
      '    </div>' +
      '    <div id="leave-import-preview" hidden>' +
      '      <p class="import-summary" id="leave-import-summary"></p>' +
      '      <div class="import-table-wrap">' +
      '        <table class="data-table import-table">' +
      '          <thead><tr><th>行</th><th>员工</th><th>年度</th><th>当前余额</th><th>导入余额</th><th>差额</th><th>结果</th><th>说明</th></tr></thead>' +
      '          <tbody id="leave-import-rows"></tbody>' +
      '        </table>' +
      '      </div>' +
      '      <div class="modal-foot">' +
      '        <button type="button" class="btn btn-ghost" id="leave-import-back">重新选择</button>' +
      '        <button type="button" class="btn btn-primary" id="leave-import-confirm">确认导入</button>' +
      '      </div>' +
      '    </div>' +
      '    <div id="leave-import-result" hidden>' +
      '      <p class="import-result-text" id="leave-import-result-text"></p>' +
      '      <div class="modal-foot"><button type="button" class="btn btn-primary" id="leave-import-done">完成</button></div>' +
      '    </div>' +
      '  </div>' +
      '</div>';

    var overlay = document.getElementById('leave-import-overlay');
    var errEl = document.getElementById('leave-import-error');
    var fileInput = document.getElementById('leave-import-file');
    var previewBox = document.getElementById('leave-import-preview');
    var summaryEl = document.getElementById('leave-import-summary');
    var rowsEl = document.getElementById('leave-import-rows');
    var resultBox = document.getElementById('leave-import-result');
    var closeModal = wireModalClose(overlay);
    var preview = null;

    document.getElementById('download-leave-template').addEventListener('click', downloadLeaveTemplateCsv);

    function renderPreview() {
      var passed = preview.filter(function (row) { return row.ok; }).length;
      var failed = preview.length - passed;
      var adjustments = preview.filter(function (row) { return row.ok && row.diff !== 0; }).length;

      summaryEl.textContent = '共 ' + preview.length + ' 行：通过 ' + passed + ' 行，有问题 ' + failed +
        ' 行。其中 ' + adjustments + ' 行会生成对账调整流水，余额一致的行会跳过。';

      rowsEl.innerHTML = preview.map(function (row) {
        var status = row.ok
          ? '<span class="status-badge status-on">通过</span>'
          : '<span class="status-badge status-off">不通过</span>';
        var note = row.ok
          ? (row.diff === 0 ? '余额一致，无需调整' : '将生成对账调整流水')
          : esc(row.issues.join('；'));

        return '' +
          '<tr>' +
          '  <td>' + row.line + '</td>' +
          '  <td>' + esc(row.user ? (row.user.name + '（' + row.account + '）') : (row.account || '（空）')) + '</td>' +
          '  <td>' + esc(row.year || '（空）') + '</td>' +
          '  <td>' + (row.user ? esc(formatDays(row.current)) : '—') + '</td>' +
          '  <td>' + (row.imported === null ? '—' : esc(formatDays(row.imported))) + '</td>' +
          '  <td>' + (row.diff === null ? '—' : (row.diff > 0 ? '+' : '') + esc(formatDays(row.diff))) + '</td>' +
          '  <td>' + status + '</td>' +
          '  <td class="import-note">' + note + '</td>' +
          '</tr>';
      }).join('');

      fileInput.value = '';
      previewBox.hidden = false;
      resultBox.hidden = true;
    }

    fileInput.addEventListener('change', function () {
      var file = fileInput.files && fileInput.files[0];
      if (!file) return;
      hideError(errEl);

      if (!/\.csv$/i.test(file.name)) {
        showError(errEl, '请上传 CSV 文件：在 Excel 里选“另存为 → CSV（逗号分隔）”后再上传。');
        fileInput.value = '';
        return;
      }

      var reader = new FileReader();
      reader.onload = function () {
        try {
          var text = decodeCsvBuffer(reader.result);
          var rawRows = parseCsvRows(text);
          if (rawRows.length < 2) {
            showError(errEl, '这个文件里没有数据行，请按模板填写后再上传。');
            fileInput.value = '';
            return;
          }
          var built = buildLeaveImportPreview(rawRows);
          if (!built.ok) {
            showError(errEl, built.message);
            fileInput.value = '';
            return;
          }
          preview = built.rows;
          renderPreview();
        } catch (err) {
          showError(errEl, '读取文件失败：' + ((err && err.message) ? err.message : String(err)));
          fileInput.value = '';
        }
      };
      reader.onerror = function () {
        showError(errEl, '读取文件失败，请重新选择。');
      };
      reader.readAsArrayBuffer(file);
    });

    document.getElementById('leave-import-back').addEventListener('click', function () {
      preview = null;
      previewBox.hidden = true;
      resultBox.hidden = true;
      fileInput.value = '';
      hideError(errEl);
    });

    document.getElementById('leave-import-confirm').addEventListener('click', function () {
      hideError(errEl);
      if (!preview) return;

      var me = store.currentUser();
      if (!me || !window.OnboardRoles.can(me, 'leave:manage')) {
        showError(errEl, '你没有导入年假余额的权限。');
        return;
      }

      var hasValid = preview.some(function (row) { return row.ok; });
      if (!hasValid) {
        showError(errEl, '没有通过校验的行，请修改文件后重新上传。');
        return;
      }

      var adjusted = 0;
      var skipped = 0;
      var notes = [];

      preview.forEach(function (row) {
        if (!row.ok) {
          skipped++;
          return;
        }
        if (row.diff === 0) {
          skipped++;
          return;
        }
        var result = store.addLeaveEntry({
          userId: row.user.id,
          year: row.year,
          delta: row.diff,
          reason: '对账调整：导入余额 ' + formatDays(row.imported) + ' 天（调整前 ' + formatDays(row.current) + ' 天）',
          type: 'reconcile',
          createdBy: me.id
        });
        if (result.ok) {
          adjusted++;
        } else {
          skipped++;
          notes.push('第 ' + row.line + ' 行：' + result.message);
        }
      });

      document.getElementById('leave-import-result-text').textContent =
        '已生成 ' + adjusted + ' 条对账调整流水，跳过 ' + skipped + ' 行。' +
        (notes.length ? '（' + notes.join('；') + '）' : '') +
        ' 历史变动全部保留。';

      previewBox.hidden = true;
      resultBox.hidden = false;
      route();
    });

    document.getElementById('leave-import-done').addEventListener('click', function () {
      closeModal();
    });
  }

  /* ================== 我的年假（员工端） ================== */

  function myLeaveYears(actor) {
    var entries = store.listLeaveEntriesFor(actor, actor.id);
    var years = [];
    entries.forEach(function (entry) {
      var year = String(entry.year);
      if (years.indexOf(year) === -1) years.push(year);
    });
    years.sort(function (a, b) { return Number(b) - Number(a); });
    return years;
  }

  function myLeaveHtml(actor) {
    var years = myLeaveYears(actor);
    var body;

    if (!years.length) {
      body = '<div class="policy-empty-state my-leave-empty">' +
        '<div class="policy-empty-icon">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<rect x="3.5" y="5" width="17" height="15.5" rx="2"></rect>' +
        '<path d="M3.5 9.5h17"></path>' +
        '<path d="M8 3.5v3M16 3.5v3"></path>' +
        '</svg>' +
        '</div>' +
        '<h3>还没有你的年假记录</h3>' +
        '<p>请联系 HR 录入你的年假数据；没有记录不代表余额为零。</p>' +
        '</div>';
    } else {
      body = '<div class="table-card">' +
        '<table class="data-table leave-table">' +
        '  <thead><tr><th>年度</th><th>剩余年假（天）</th><th>最后更新时间</th><th>变更记录</th></tr></thead>' +
        '  <tbody id="my-leave-list"></tbody>' +
        '</table>' +
        '</div>';
    }

    return '' +
      '<section class="page-head">' +
      '  <div>' +
      '    <h2 class="page-head-title">我的年假</h2>' +
      '    <p class="page-head-sub">以下是你各年度的年假余额与变动记录</p>' +
      '  </div>' +
      '</section>' +
      body +
      '<p class="policy-note">余额由 HR 维护。</p>';
  }

  function renderMyLeaveTable() {
    var tbody = document.getElementById('my-leave-list');
    if (!tbody) return;

    var actor = store.currentUser();
    if (!actor) return;

    tbody.innerHTML = myLeaveYears(actor).map(function (year) {
      var balance = store.getLeaveBalanceFor(actor, actor.id, year);
      var entries = store.listLeaveEntriesFor(actor, actor.id, year);
      var lastUpdated = store.getLeaveLastUpdatedFor(actor, actor.id, year);
      var balanceClass = balance < 0 ? ' is-negative' : '';

      return '' +
        '<tr>' +
        '  <td>' + esc(year) + ' 年</td>' +
        '  <td><span class="leave-balance' + balanceClass + '">' + esc(formatDays(balance)) + '</span></td>' +
        '  <td>' + esc(formatDateTime(lastUpdated)) + '</td>' +
        '  <td><button type="button" class="btn btn-ghost btn-sm" data-my-leave-year="' + esc(year) + '" data-my-leave-user="' + esc(actor.id) + '">查看 ' + entries.length + ' 条流水</button></td>' +
        '</tr>';
    }).join('');
  }

  function wireMyLeavePage() {
    var list = document.getElementById('my-leave-list');
    if (!list) return;

    list.addEventListener('click', function (event) {
      var btn = event.target && event.target.closest ? event.target.closest('[data-my-leave-year]') : null;
      if (!btn) return;
      openMyLeaveLedgerModal(btn.getAttribute('data-my-leave-user'), btn.getAttribute('data-my-leave-year'));
    });
  }

  function openMyLeaveLedgerModal(targetUserId, year) {
    var actor = store.currentUser();
    if (!actor) {
      renderLogin();
      return;
    }

    // 内部检查：只有本人（或有年假管理权限的人）能看这份流水，
    // 即使有人把页面上的按钮参数改成别人的 ID，也会被这里拒绝。
    if (!store.canViewUserLeave(actor, targetUserId)) {
      toast('你只能查看自己的年假记录。');
      return;
    }

    var user = store.getUserById(targetUserId);
    if (!user) {
      toast('找不到这个员工。');
      return;
    }

    var entries = store.listLeaveEntriesFor(actor, targetUserId, year);
    var balance = store.getLeaveBalanceFor(actor, targetUserId, year);

    var rows = entries.map(function (entry) {
      var delta = Number(entry.delta);
      var typeLabel = store.LEAVE_ENTRY_LABELS[entry.type] || '调整';
      return '' +
        '<tr>' +
        '  <td>' + esc(formatDateTime(entry.createdAt)) + '</td>' +
        '  <td>' + esc(entry.reason) + '</td>' +
        '  <td><span class="leave-type">' + esc(typeLabel) + '</span></td>' +
        '  <td class="leave-delta ' + (delta >= 0 ? 'is-plus' : 'is-minus') + '">' + (delta > 0 ? '+' : '') + esc(formatDays(delta)) + '</td>' +
        '</tr>';
    }).join('');

    modalRoot.innerHTML = '' +
      '<div class="modal-overlay" id="my-leave-ledger-overlay">' +
      '  <div class="modal modal-wide" role="dialog" aria-modal="true" aria-labelledby="my-leave-ledger-title">' +
      '    <div class="modal-head">' +
      '      <h3 id="my-leave-ledger-title">我的年假流水</h3>' +
      '      <button type="button" class="icon-btn" data-close="1" aria-label="关闭">×</button>' +
      '    </div>' +
      '    <p class="modal-sub">' + esc(user.name) + '（' + esc(user.account) + '） · ' + esc(year) + ' 年 · 当前余额 ' + esc(formatDays(balance)) + ' 天</p>' +
      '    <div class="import-table-wrap">' +
      '      <table class="data-table">' +
      '        <thead><tr><th>时间</th><th>原因</th><th>类型</th><th>增减（天）</th></tr></thead>' +
      '        <tbody>' + (rows || '<tr><td colspan="4" class="policy-empty">这个年度还没有流水。</td></tr>') + '</tbody>' +
      '      </table>' +
      '    </div>' +
      '    <p class="policy-note">历史记录由 HR 维护，不能删除；余额由 HR 维护。</p>' +
      '    <div class="modal-foot"><button type="button" class="btn btn-primary" data-close="1">关闭</button></div>' +
      '  </div>' +
      '</div>';

    wireModalClose(document.getElementById('my-leave-ledger-overlay'));
  }

  /* ================== 模型配置（仅系统管理员） ================== */

  function modelConfigHtml(actor) {
    var config = store.getModelConfig();
    var versionText = config.version ? 'v' + config.version : '尚未保存';
    var keyPlaceholder = config.hasKey ? '已加密保存，留空保留现有凭据' : '请输入模型服务密钥';

    var audits = store.listAuditLog(50).filter(function (item) {
      return item && item.action === '修改模型配置';
    }).slice(0, 5);

    var auditRows = audits.map(function (item) {
      return '<tr>' +
        '<td>' + esc(formatDateTime(item.createdAt)) + '</td>' +
        '<td>' + esc(item.actorName || '未知') + '</td>' +
        '<td>' + esc(item.detail || '') + '</td>' +
        '</tr>';
    }).join('') || '<tr><td colspan="3" class="policy-empty">还没有模型配置变更记录。</td></tr>';

    return '' +
      '<section class="page-head">' +
      '  <div>' +
      '    <h2 class="page-head-title">模型配置</h2>' +
      '    <p class="page-head-sub">仅系统管理员可见；保存后密钥加密存放，页面不再显示明文</p>' +
      '  </div>' +
      '</section>' +
      '<div class="model-grid">' +
      '  <form class="model-card" id="model-config-form" novalidate autocomplete="off">' +
      '    <h3 class="model-card-title">对话模型连接</h3>' +
      '    <div class="form-error" id="model-error" role="alert"></div>' +
      '    <div class="field">' +
      '      <label for="model-base-url">接口地址</label>' +
      '      <input class="input" id="model-base-url" type="url" maxlength="300" placeholder="https://api.example.com/v1" value="' + esc(config.baseUrl) + '">' +
      '    </div>' +
      '    <div class="field">' +
      '      <label for="model-name">模型名称</label>' +
      '      <input class="input" id="model-name" type="text" maxlength="80" placeholder="例如：deepseek-chat" value="' + esc(config.model) + '">' +
      '    </div>' +
      '    <div class="field">' +
      '      <label for="model-key">密钥</label>' +
      '      <input class="input" id="model-key" type="password" maxlength="200" autocomplete="new-password" placeholder="' + esc(keyPlaceholder) + '">' +
      '      <p class="hint">保存后会加密存放；再次打开本页面不会显示明文，留空表示保留现有凭据。</p>' +
      '    </div>' +
      '    <div class="field-row">' +
      '      <div class="field">' +
      '        <label for="model-temperature">回答随机度（0–1）</label>' +
      '        <input class="input" id="model-temperature" type="number" min="0" max="1" step="0.1" value="' + esc(String(config.temperature)) + '">' +
      '      </div>' +
      '      <div class="field">' +
      '        <label for="model-max-tokens">单次回答最大长度</label>' +
      '        <input class="input" id="model-max-tokens" type="number" min="512" max="6000" step="1" value="' + esc(String(config.maxTokens)) + '">' +
      '      </div>' +
      '    </div>' +
      '    <div class="model-actions">' +
      '      <button type="submit" class="btn btn-primary">保存配置</button>' +
      '      <button type="button" class="btn btn-ghost" id="model-test-btn">测试已保存连接</button>' +
      '    </div>' +
      '    <p class="model-message" id="model-message" hidden></p>' +
      '  </form>' +
      '  <aside class="model-card model-info">' +
      '    <h3 class="model-card-title">说明</h3>' +
      '    <dl class="model-info-list">' +
      '      <dt>配置版本</dt><dd>' + esc(versionText) + '</dd>' +
      '      <dt>回答之前一定先验证</dt><dd>模型回答必须先核对已发布且适用的制度原文，依据不足时明确说“没找到”，不能编造。</dd>' +
      '      <dt>密钥存放方式</dt><dd>服务端加密，不向浏览器回传</dd>' +
      '    </dl>' +
      '    <p class="model-demo-note">演示版说明：当前为纯本机运行、没有服务端，密钥会用本机设备密钥加密后保存在浏览器存储里，页面不显示明文；接入后端后应改为服务端加密保管。</p>' +
      '  </aside>' +
      '</div>' +
      '<section class="model-card model-audit">' +
      '  <h3 class="model-card-title">操作审计</h3>' +
      '  <div class="import-table-wrap">' +
      '    <table class="data-table"><thead><tr><th>时间</th><th>操作人</th><th>变更</th></tr></thead><tbody>' + auditRows + '</tbody></table>' +
      '  </div>' +
      '</section>' +
      '<p class="policy-note">外部模型会收到员工的问题和相关制度片段；年假余额由系统直接读取，不交给模型计算。</p>';
  }

  function showModelMessage(element, type, text) {
    if (!element) {
      toast(text);
      return;
    }
    element.hidden = false;
    element.className = 'model-message is-' + type;
    element.textContent = text;
  }

  function describeModelError(status, data) {
    var detail = '';
    if (data && data.error) {
      var raw = data.error.message || data.error.code || '';
      if (raw) detail = '（服务返回：' + String(raw).slice(0, 100) + '）';
    }
    if (status === 401 || status === 403) return '连接失败：密钥无效，或没有访问该模型的权限。' + detail;
    if (status === 404) return '连接失败：接口地址可能不对，或模型名称不存在。' + detail;
    if (status === 400) return '连接失败：请求被拒绝，可能是密钥无效或模型名称不存在。' + detail;
    if (status === 429) return '连接失败：请求太频繁或额度用完，请稍后再试。' + detail;
    if (status >= 500) return '连接失败：模型服务端出现故障（HTTP ' + status + '），请稍后重试。' + detail;
    return '连接失败：接口返回 HTTP ' + status + '。' + detail;
  }

  function testModelConnection(messageEl, errEl, button) {
    var actor = store.currentUser();
    if (!actor || !window.OnboardRoles.can(actor, 'page:model-config')) {
      showError(errEl, '只有系统管理员可以测试模型连接。');
      return;
    }

    var config = store.getModelConfig();
    if (!config.version || !config.baseUrl || !config.model || !config.hasKey) {
      showError(errEl, '请先保存配置（接口地址、模型名称和密钥都保存好）再测试。');
      return;
    }

    hideError(errEl);
    if (button) button.disabled = true;
    showModelMessage(messageEl, '', '正在测试连接…');

    var startedAt = Date.now();

    store.getModelSecret().then(function (apiKey) {
      if (!apiKey) throw new Error('无法读取已保存的密钥，请重新填写密钥并保存。');

      var url = config.baseUrl.replace(/\/+$/, '') + '/chat/completions';
      var controller = window.AbortController ? new window.AbortController() : null;
      var timer = null;
      if (controller) {
        timer = window.setTimeout(function () { controller.abort(); }, 15000);
      }

      var options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + apiKey
        },
        body: JSON.stringify({
          model: config.model,
          messages: [{ role: 'user', content: '请只回复“连接正常”四个字。' }],
          temperature: config.temperature,
          max_tokens: config.maxTokens
        })
      };
      if (controller) options.signal = controller.signal;

      return window.fetch(url, options).then(function (response) {
        if (timer) window.clearTimeout(timer);
        return response.text().then(function (text) {
          var data = null;
          try { data = JSON.parse(text); } catch (error) { data = null; }
          var elapsed = Date.now() - startedAt;

          if (!response.ok) {
            throw new Error(describeModelError(response.status, data));
          }

          var units = 0;
          if (data && data.usage) {
            if (typeof data.usage.total_tokens === 'number') units = data.usage.total_tokens;
            else if (typeof data.usage.totalTokens === 'number') units = data.usage.totalTokens;
          }

          showModelMessage(messageEl, 'success', '连接成功，用时 ' + elapsed + ' 毫秒，消耗 ' + units + ' 个计算单位。');
        });
      });
    }).catch(function (error) {
      var text;
      if (error && error.name === 'AbortError') {
        text = '连接超时：接口在 15 秒内没有响应，请检查接口地址和网络。';
      } else if (error && error.name === 'TypeError') {
        text = '无法连接：接口地址可能不对、网络不可达，或浏览器跨域（CORS）限制导致请求被拦截。';
      } else if (error && error.message) {
        text = error.message;
      } else {
        text = '连接失败，请检查接口地址、密钥和模型名称。';
      }
      showModelMessage(messageEl, 'error', text);
    }).then(function () {
      if (button) button.disabled = false;
    });
  }

  function wireModelConfigPage() {
    var form = document.getElementById('model-config-form');
    if (!form) return;

    var errEl = document.getElementById('model-error');
    var messageEl = document.getElementById('model-message');
    var testBtn = document.getElementById('model-test-btn');
    var keyInput = document.getElementById('model-key');

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      hideError(errEl);

      var actor = store.currentUser();
      if (!actor || !window.OnboardRoles.can(actor, 'page:model-config')) {
        showError(errEl, '只有系统管理员可以修改模型配置。');
        return;
      }

      var submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      store.saveModelConfig({
        baseUrl: document.getElementById('model-base-url').value,
        model: document.getElementById('model-name').value,
        apiKey: keyInput.value,
        temperature: document.getElementById('model-temperature').value,
        maxTokens: document.getElementById('model-max-tokens').value
      }).then(function (result) {
        if (submitBtn) submitBtn.disabled = false;
        if (!result.ok) {
          showError(errEl, result.message);
          return;
        }
        toast('已保存模型配置（版本 v' + result.version + '），密钥已加密保存');
        route();
      }).catch(function (error) {
        if (submitBtn) submitBtn.disabled = false;
        showError(errEl, '保存失败：' + ((error && error.message) ? error.message : String(error)));
      });
    });

    if (testBtn) {
      testBtn.addEventListener('click', function () {
        testModelConnection(messageEl, errEl, testBtn);
      });
    }
  }

  /* ================== 员工服务助手（聊天，仅本人记录） ================== */

  var chatState = { sessionId: null, pending: false, composing: false, generating: {} };
  var ASSISTANT_ENTRY = window.ONBOARD_ENTRY === 'assistant';

  function chatComposerHtml() {
    return '<div class="chat-composer">' +
      '  <div class="chat-input-row">' +
      '    <textarea class="chat-input" id="chat-input" rows="2" maxlength="2000" placeholder="输入你的问题，例如：我还有几天年假？"></textarea>' +
      '    <button type="button" class="chat-send" id="chat-send" aria-label="发送">' +
      '      <svg class="chat-send-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '        <path d="M12 19V5"></path>' +
      '        <path d="m5.5 11.5 6.5-6.5 6.5 6.5"></path>' +
      '      </svg>' +
      '      <span class="chat-spinner" aria-hidden="true"></span>' +
      '    </button>' +
      '  </div>' +
      '  <p class="chat-hint">回答前核对制度与数据</p>' +
      '  <p class="chat-hint">制度解释附原文依据；个人信息仅查询本人记录。依据不足时会明确说明。</p>' +
      '</div>';
  }

  function chatQuickIcon(kind) {
    if (kind === 'policy') {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v18H6.5A2.5 2.5 0 0 1 4 18.5Z"></path>' +
        '<path d="M4 17.5A2.5 2.5 0 0 1 6.5 15H19"></path>' +
        '<path d="M8.5 7h6"></path>' +
        '</svg>';
    }
    if (kind === 'leave') {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<rect x="3.5" y="5" width="17" height="15.5" rx="2"></rect>' +
        '<path d="M3.5 9.5h17"></path>' +
        '<path d="M8 3.5v3M16 3.5v3"></path>' +
        '<path d="M8 13.5h8M8 17h5"></path>' +
        '</svg>';
    }
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M12 3.5 20 7.5v9L12 20.5 4 16.5v-9Z"></path>' +
      '<path d="M12 12v8.5M12 12l8-4.5M12 12 4 7.5"></path>' +
      '</svg>';
  }

  function assistantHtml(actor) {
    return '' +
      '<section class="page-head">' +
      '  <div>' +
      '    <h2 class="page-head-title">员工服务助手</h2>' +
      '    <p class="page-head-sub">可以问制度、年假和办事流程；回答会附制度原文依据</p>' +
      '  </div>' +
      '</section>' +
      '<div class="chat-layout">' +
      '  <aside class="chat-side">' +
      '    <button type="button" class="btn btn-primary chat-new-btn" data-action="new-chat">＋ 开始新咨询</button>' +
      '    <div class="chat-side-heading">最近咨询</div>' +
      '    <div class="chat-session-list" id="chat-session-list"></div>' +
      '  </aside>' +
      '  <section class="chat-main">' +
      '    <div class="chat-scroll" id="chat-scroll">' +
      '      <div id="chat-messages"></div>' +
      '    </div>' +
      chatComposerHtml() +
      '  </section>' +
      '</div>';
  }

  function chatWelcomeHtml() {
    return '' +
      '<div class="chat-welcome">' +
      '  <h3 class="chat-welcome-title">工作中的疑问，从这里开始。</h3>' +
      '  <div class="chat-quick-grid">' +
      '    <button type="button" class="chat-quick-card" data-chat-question="公司有哪些制度？">' +
      '      <span class="chat-quick-icon">' + chatQuickIcon('policy') + '</span>' +
      '      <span class="chat-quick-label">了解公司制度</span>' +
      '    </button>' +
      '    <button type="button" class="chat-quick-card" data-chat-question="我还有几天年假？">' +
      '      <span class="chat-quick-icon">' + chatQuickIcon('leave') + '</span>' +
      '      <span class="chat-quick-label">查查我的年假</span>' +
      '    </button>' +
      '    <button type="button" class="chat-quick-card" data-chat-question="请假流程怎么走？">' +
      '      <span class="chat-quick-icon">' + chatQuickIcon('howto') + '</span>' +
      '      <span class="chat-quick-label">找到办事方法</span>' +
      '    </button>' +
      '  </div>' +
      '  <p class="chat-try-title">试着问问</p>' +
      '  <button type="button" class="chat-try-item" data-chat-question="年假可以结转到明年吗？">年假可以结转到明年吗？</button>' +
      '  <button type="button" class="chat-try-item" data-chat-question="试用期有哪些规定？">试用期有哪些规定？</button>' +
      '</div>';
  }

  function chatThreadHtml(session) {
    var rows = (session.messages || []).map(function (message) {
      var isUser = message.role === 'user';
      var bubble = isUser
        ? '<div class="chat-bubble">' + esc(message.content) + '</div>'
        : chatAssistantBubbleHtml(message);
      var extra = (!isUser && message.status === 'done' && message.answer) ? chatFeedbackHtml(message) : '';
      var head = (!isUser && ASSISTANT_ENTRY) ? assistantEntryMessageHeadHtml() : '';
      return '<div class="chat-msg ' + (isUser ? 'is-user' : 'is-assistant') + '">' + head + bubble + extra + '</div>';
    }).join('');
    return '<div class="chat-thread">' + rows + '</div>';
  }

  function chatFeedbackHtml(message) {
    var handoff = '<button type="button" class="feedback-btn feedback-handoff" data-handoff-message="' + esc(message.id) + '">转人工</button>';

    if (message.feedback) {
      var label = message.feedback.helpful
        ? '有帮助'
        : '没有帮助' + (message.feedback.reason ? '（' + message.feedback.reason + '）' : '');
      return '<div class="chat-feedback is-done">' +
        '<span class="chat-feedback-done">已反馈：' + esc(label) + '</span>' +
        handoff +
        '</div>';
    }

    return '<div class="chat-feedback" data-feedback-message="' + esc(message.id) + '">' +
      '<span class="chat-feedback-label">这条回答有帮助吗？</span>' +
      '<button type="button" class="feedback-btn" data-feedback-helpful="1">有帮助</button>' +
      '<button type="button" class="feedback-btn" data-feedback-helpful="0">没有帮助</button>' +
      handoff +
      '</div>';
  }

  function chatAssistantBubbleHtml(message) {
    if (message.status === 'pending') {
      return '<div class="chat-bubble chat-pending"><span class="chat-thinking" aria-hidden="true"></span>正在查询并核对依据，请稍候…</div>';
    }

    if (message.status === 'failed') {
      return '<div class="chat-bubble chat-failed">' +
        '<p class="chat-failed-text">生成失败：' + esc(message.error || '未知原因') + '</p>' +
        '<button type="button" class="btn btn-ghost btn-sm chat-retry" data-retry-message="' + esc(message.id) + '">重试</button>' +
        '</div>';
    }

    if (message.answer) return chatAnswerBubbleHtml(message);
    return '<div class="chat-bubble">' + esc(message.content) + '</div>';
  }

  function chatCitationHtml(citation) {
    return '<details class="citation-item">' +
      '<summary>' + citation.display + '. ' + esc(citation.policyName) + ' · ' + esc(citation.version) + ' · ' + esc(citation.positionLabel) + '</summary>' +
      '<div class="citation-body">' +
      '<p><span class="citation-label">制度名称：</span>' + esc(citation.policyName) + '</p>' +
      '<p><span class="citation-label">版本：</span>' + esc(citation.version) + '</p>' +
      '<p><span class="citation-label">位置：</span>' + esc(citation.positionLabel) + '</p>' +
      '<p class="citation-quote"><span class="citation-label">原文摘录：</span>' + esc(citation.text) + '</p>' +
      '<a href="#" class="citation-download" data-download-policy="' + esc(citation.policyId) + '">下载原始文档</a>' +
      '</div>' +
      '</details>';
  }

  function chatLeaveCardHtml(card) {
    var balanceHtml = card.hasRecord
      ? '<span class="leave-card-number">' + esc(formatDays(card.balance)) + '</span><span class="leave-card-unit">天</span>'
      : '<span class="leave-card-empty">暂无记录</span>';

    var changesHtml;
    if (card.changes && card.changes.length) {
      changesHtml = '<details class="leave-card-changes">' +
        '<summary>最近余额变动</summary>' +
        '<ul>' + card.changes.map(function (change) {
          var delta = Number(change.delta);
          return '<li>' +
            '<span class="leave-change-time">' + esc(formatDateTime(change.createdAt)) + '</span>' +
            '<span class="leave-change-reason">' + esc(change.reason) + '</span>' +
            '<span class="leave-change-delta ' + (delta >= 0 ? 'is-plus' : 'is-minus') + '">' + (delta > 0 ? '+' : '') + esc(formatDays(delta)) + '</span>' +
            '</li>';
        }).join('') + '</ul>' +
        '</details>';
    } else {
      changesHtml = '<p class="leave-card-nochange">这个年度还没有余额变动。</p>';
    }

    var exampleHtml = card.isExample ? '<p class="leave-card-example">示例数据，非真实年假</p>' : '';

    return '<div class="leave-card">' +
      '<div class="leave-card-head"><span class="leave-card-title">我的年假</span><span class="leave-card-year">' + esc(card.year) + ' 年度</span></div>' +
      '<div class="leave-card-balance">' + balanceHtml + '</div>' +
      '<p class="leave-card-asof">截至 ' + esc(card.asOf) + (card.lastUpdated ? '（账本最后更新：' + esc(formatDateTime(card.lastUpdated)) + '）' : '') + '</p>' +
      changesHtml + exampleHtml +
      '<p class="leave-card-source">余额由 HR 维护，直接读取年假账本，未经模型计算。</p>' +
      '</div>';
  }

  var ANSWER_STATUS_LABELS = { verified: '依据充分', partial: '部分有依据', insufficient: '依据不足', conflict: '存在冲突' };
  var VERIFY_RESULT_LABELS = { pass: '通过', partial: '部分通过', fail: '未通过', skipped: '未执行' };

  function chatConflictHtml(conflicts) {
    return '<div class="conflict-block">' + conflicts.map(function (conflict) {
      return '<div class="conflict-card">' +
        '<p class="conflict-title">发现制度冲突：「' + esc(conflict.term) + '」的要求不一致</p>' +
        '<div class="conflict-grid">' +
        chatConflictSideHtml('制度一', conflict.left, conflict.leftValue, conflict.unit) +
        chatConflictSideHtml('制度二', conflict.right, conflict.rightValue, conflict.unit) +
        '</div>' +
        '<p class="conflict-note">两处要求不能同时成立，系统不替你选择，建议转人工确认。</p>' +
        '</div>';
    }).join('') + '</div>';
  }

  function chatConflictSideHtml(label, citation, value, unit) {
    return '<div class="conflict-side">' +
      '<p class="conflict-side-title">' + esc(label) + '：' + esc(citation.policyName) + ' · ' + esc(citation.version) + '</p>' +
      '<p class="conflict-side-value">' + esc(String(value)) + ' ' + esc(unit) + '</p>' +
      '<p class="conflict-side-position">' + esc(citation.positionLabel) + '</p>' +
      '<p class="conflict-side-text">' + esc(citation.text) + '</p>' +
      '</div>';
  }

  function chatVerificationHtml(verification) {
    if (!verification || !verification.length) return '';
    return '<details class="verification-block">' +
      '<summary>查看验证过程</summary>' +
      '<ul class="verification-list">' + verification.map(function (item) {
        var label = VERIFY_RESULT_LABELS[item.result] || '未通过';
        return '<li class="verification-item">' +
          '<span class="verification-name">' + esc(item.name) + '</span>' +
          '<span class="verification-result is-' + esc(item.result) + '">' + label + '</span>' +
          '<p class="verification-detail">' + esc(item.detail || '') + '</p>' +
          '</li>';
      }).join('') + '</ul>' +
      '</details>';
  }

  function chatAnswerBubbleHtml(message) {
    var answer = message.answer || {};
    var conclusions = answer.conclusions || [];
    var citations = answer.citations || [];

    var numberMap = {};
    citations.forEach(function (citation, position) {
      numberMap[citation.index] = position + 1;
    });
    var displayCitations = citations.map(function (citation, position) {
      return {
        display: position + 1,
        policyId: citation.policyId,
        policyName: citation.policyName,
        version: citation.version,
        positionLabel: citation.positionLabel,
        text: citation.text
      };
    });

    var rows = conclusions.map(function (item) {
      var sups = (item.citations || []).map(function (index) {
        return '<sup class="cite-mark">' + (numberMap[index] || '?') + '</sup>';
      }).join('');
      return '<li>' + esc(item.text) + sups + '</li>';
    }).join('');

    var statusHtml = '';
    if (answer.status && ANSWER_STATUS_LABELS[answer.status]) {
      statusHtml = '<p class="chat-status is-' + esc(answer.status) + '">' + ANSWER_STATUS_LABELS[answer.status] + '</p>';
    } else if (answer.mode === 'refused') {
      statusHtml = '<p class="chat-answer-mode is-refused">' + (answer.refuseType === 'dept' ? '超出可见范围' : '无法查询他人信息') + '</p>';
    } else if (answer.mode === 'clarify') {
      statusHtml = '<p class="chat-answer-mode is-clarify">需要补充说明</p>';
    } else if (answer.mode === 'partial') {
      statusHtml = '<p class="chat-answer-mode is-partial">只能部分回答</p>';
    } else if (answer.mode === 'insufficient') {
      statusHtml = '<p class="chat-answer-mode is-insufficient">依据不足</p>';
    }

    var missing = answer.missing ? '<p class="chat-missing">缺少：' + esc(answer.missing) + '</p>' : '';
    var note = answer.note ? '<p class="chat-answer-note">' + esc(answer.note) + '</p>' : '';

    var cardHtml = answer.leaveCard ? chatLeaveCardHtml(answer.leaveCard) : '';
    var conflictHtml = answer.conflicts && answer.conflicts.length ? chatConflictHtml(answer.conflicts) : '';
    var verificationHtml = answer.verification && answer.verification.length ? chatVerificationHtml(answer.verification) : '';

    var citationBlock = '';
    if (displayCitations.length) {
      citationBlock = '<details class="citation-block">' +
        '<summary>回答依据 · ' + displayCitations.length + ' 处引用</summary>' +
        '<div class="citation-list">' + displayCitations.map(chatCitationHtml).join('') + '</div>' +
        '</details>';
    }

    var exampleNote = answer.exampleNotice
      ? '<p class="chat-example-note">当前引用示例制度，仅用于体验，不代表真实公司政策。</p>'
      : '';

    var meta = '<p class="chat-answer-meta">耗时 ' + Math.round(answer.elapsedMs || 0) + ' 毫秒 · 模型：' + esc(answer.modelName || '未知') + '</p>';

    var conclusionsHtml = rows ? '<ol class="chat-conclusions">' + rows + '</ol>' : '';

    return '<div class="chat-bubble chat-answer">' +
      statusHtml +
      cardHtml + conflictHtml + conclusionsHtml +
      note + missing + citationBlock + verificationHtml + exampleNote + meta +
      '</div>';
  }

  function assistantAvatarSvg() {
    return '<svg class="assistant-avatar-svg" viewBox="0 0 220 240" role="img" aria-label="小初：戴耳机的圆润机器人">' +
      '<ellipse class="avatar-shadow" cx="110" cy="226" rx="70" ry="9"></ellipse>' +
      '<g class="avatar-body">' +
      '  <rect x="58" y="150" width="104" height="68" rx="30" fill="#cfe8fb" stroke="#a9cdf0" stroke-width="4"></rect>' +
      '  <rect x="88" y="166" width="44" height="36" rx="12" fill="#eaf6ff" stroke="#a9cdf0" stroke-width="3"></rect>' +
      '</g>' +
      '<g class="avatar-head">' +
      '  <rect x="36" y="28" width="148" height="120" rx="56" fill="#d9efff" stroke="#a9cdf0" stroke-width="4"></rect>' +
      '  <path d="M36 82 C36 40 70 18 110 18 C150 18 184 40 184 82" fill="none" stroke="#8fb9e0" stroke-width="10" stroke-linecap="round"></path>' +
      '  <rect x="18" y="74" width="26" height="54" rx="13" fill="#a9cdf0"></rect>' +
      '  <rect x="176" y="74" width="26" height="54" rx="13" fill="#a9cdf0"></rect>' +
      '  <rect x="52" y="44" width="116" height="88" rx="30" fill="#0f2948" stroke="#0b2038" stroke-width="4"></rect>' +
      '  <g class="avatar-face-idle">' +
      '    <circle class="avatar-eye" cx="86" cy="78" r="8" fill="#5fe3ff"></circle>' +
      '    <circle class="avatar-eye" cx="134" cy="78" r="8" fill="#5fe3ff"></circle>' +
      '    <path class="avatar-smile" d="M84 102 Q110 118 136 102" fill="none" stroke="#5fe3ff" stroke-width="5" stroke-linecap="round"></path>' +
      '  </g>' +
      '  <g class="avatar-face-thinking">' +
      '    <path d="M78 78 Q86 70 94 78" fill="none" stroke="#5fe3ff" stroke-width="5" stroke-linecap="round"></path>' +
      '    <path d="M126 78 Q134 70 142 78" fill="none" stroke="#5fe3ff" stroke-width="5" stroke-linecap="round"></path>' +
      '    <circle cx="110" cy="105" r="5" fill="#5fe3ff"></circle>' +
      '  </g>' +
      '  <g class="avatar-thinking-dots" fill="#5fe3ff">' +
      '    <circle cx="90" cy="16" r="4"></circle><circle cx="110" cy="8" r="4"></circle><circle cx="130" cy="16" r="4"></circle>' +
      '  </g>' +
      '</g>' +
      '</svg>';
  }

  function assistantMiniSvg() {
    return '<svg viewBox="0 0 32 32" aria-hidden="true">' +
      '<rect x="3" y="6" width="26" height="20" rx="9" fill="#d9efff" stroke="#a9cdf0" stroke-width="2"></rect>' +
      '<rect x="8" y="10" width="16" height="12" rx="5" fill="#0f2948"></rect>' +
      '<circle cx="13" cy="16" r="2" fill="#5fe3ff"></circle>' +
      '<circle cx="19" cy="16" r="2" fill="#5fe3ff"></circle>' +
      '</svg>';
  }

  function assistantEntryMessageHeadHtml() {
    return '<div class="entry-msg-head">' +
      '<span class="entry-msg-avatar">' + assistantMiniSvg() + '</span>' +
      '<span class="entry-msg-name">小初</span>' +
      '<span class="entry-msg-sub">基于公司已发布制度与个人记录</span>' +
      '</div>';
  }

  function entryWelcomeHtml(actor) {
    var name = actor && actor.name ? actor.name : '同事';
    return '<div class="entry-welcome">' +
      '<h3 class="entry-welcome-title">' + esc(name) + '，你好 👋 今天有什么可以帮你？</h3>' +
      '<p class="entry-welcome-sub">可以直接问我，也可以从下面的话题开始。</p>' +
      '<div class="entry-welcome-chips">' +
      '  <button type="button" class="entry-chip" data-entry-question="我今年还剩多少年假？">我的年假</button>' +
      '  <button type="button" class="entry-chip" data-entry-question="报销流程怎么走？">报销怎么办</button>' +
      '  <button type="button" class="entry-chip" data-entry-question="入职第一天需要准备什么？">新人入职指南</button>' +
      '  <button type="button" class="entry-chip" data-entry-question="请假流程怎么走？">请假与考勤</button>' +
      '</div>' +
      '<p class="entry-welcome-tip">回答会附上制度依据。需要人工协助时，可在回答下方转工单。</p>' +
      '</div>';
  }

  function assistantEntryShellHtml(actor) {
    var name = actor && actor.name ? actor.name : '同事';

    return '' +
      '<div class="entry-shell">' +
      '  <header class="entry-topbar">' +
      '    <div class="entry-brand">' +
      '      <span class="entry-brand-logo">初</span>' +
      '      <div>' +
      '        <p class="entry-brand-name">初见 Onboard</p>' +
      '        <p class="entry-brand-tag">员工服务中心</p>' +
      '      </div>' +
      '    </div>' +
      '    <nav class="entry-links">' +
      '      <a href="../index.html#/overview" title="产品学习（后续阶段开放）">产品学习</a>' +
      '      <a href="../index.html#/overview">工作台</a>' +
      '    </nav>' +
      '    <div class="entry-user">' +
      '      <span class="entry-user-avatar">' + esc(initials(name)) + '</span>' +
      '      <span class="entry-user-name">' + esc(name) + '</span>' +
      '      <button type="button" class="mini-btn" data-action="logout">退出</button>' +
      '    </div>' +
      '  </header>' +
      '  <main class="entry-main">' +
      '    <aside class="entry-visual">' +
      '      <div class="assistant-avatar' + (chatState.pending ? ' is-thinking' : '') + '">' + assistantAvatarSvg() + '</div>' +
      '      <p class="entry-avatar-name">小初</p>' +
      '      <p class="entry-avatar-sub">员工服务助手</p>' +
      '      <div class="entry-quick">' +
      '        <button type="button" class="entry-quick-item" data-entry-question="我今年还剩多少年假？">我的年假</button>' +
      '        <button type="button" class="entry-quick-item" data-entry-question="报销流程怎么走？">报销怎么办</button>' +
      '        <button type="button" class="entry-quick-item" data-entry-question="入职第一天需要准备什么？">新人入职指南</button>' +
      '        <button type="button" class="entry-quick-item" data-entry-question="请假流程怎么走？">请假与考勤</button>' +
      '        <a class="entry-quick-item" href="../index.html#/tickets">查看工单</a>' +
      '      </div>' +
      '    </aside>' +
      '    <section class="entry-chat">' +
      '      <header class="entry-chat-head">' +
      '        <div>' +
      '          <h1 class="entry-chat-title">和小初聊聊</h1>' +
      '          <p class="entry-chat-sub">公司制度 · 入职指引 · 员工服务</p>' +
      '        </div>' +
      '        <div class="entry-chat-tools">' +
      '          <select class="input input-sm" id="chat-history-select" aria-label="历史咨询"><option value="">历史咨询</option></select>' +
      '          <button type="button" class="btn btn-ghost btn-sm" id="entry-new-chat">新咨询</button>' +
      '        </div>' +
      '      </header>' +
      '      <div class="chat-scroll" id="chat-scroll"><div id="chat-messages"></div></div>' +
      chatComposerHtml() +
      '      <p class="entry-composer-tip">回答会附上制度依据。需要人工协助时，可在回答下方转工单。</p>' +
      '    </section>' +
      '  </main>' +
      '</div>';
  }

  function renderEntryHistory(actor) {
    var select = document.getElementById('chat-history-select');
    if (!select || !actor) return;

    var sessions = store.listMyChatSessions(actor).slice(0, 12);
    select.innerHTML = '<option value="">历史咨询</option>' + sessions.map(function (session) {
      return '<option value="' + esc(session.id) + '"' + (session.id === chatState.sessionId ? ' selected' : '') + '>' +
        esc(session.title) + '</option>';
    }).join('');
  }

  function toggleAssistantAvatarThinking(loading) {
    var avatar = document.querySelector('.assistant-avatar');
    if (avatar) avatar.classList.toggle('is-thinking', !!loading);
  }

  function wireEntryExtras(actor) {
    var select = document.getElementById('chat-history-select');
    if (select) {
      select.addEventListener('change', function () {
        var sessionId = select.value;
        if (!sessionId) {
          chatState.sessionId = null;
          renderAssistantMain(actor);
          return;
        }
        var session = store.getMyChatSession(actor, sessionId);
        if (!session) {
          toast('只能查看自己的咨询记录。');
          return;
        }
        chatState.sessionId = session.id;
        renderAssistantMain(actor);
      });
    }

    var newBtn = document.getElementById('entry-new-chat');
    if (newBtn) {
      newBtn.addEventListener('click', function () {
        chatState.sessionId = null;
        renderAssistantMain(actor);
        var input = document.getElementById('chat-input');
        if (input) input.focus();
      });
    }

    $$('.entry-quick [data-entry-question]', appEl).forEach(function (btn) {
      btn.addEventListener('click', function () {
        sendChatQuestion(btn.getAttribute('data-entry-question'));
      });
    });

    var messagesEl = document.getElementById('chat-messages');
    if (messagesEl) {
      messagesEl.addEventListener('click', function (event) {
        var btn = event.target && event.target.closest ? event.target.closest('[data-entry-question]') : null;
        if (!btn) return;
        sendChatQuestion(btn.getAttribute('data-entry-question'));
      });
    }
  }

  function renderAssistantEntryShell(actor) {
    stopPolicyTimer();
    appEl.innerHTML = assistantEntryShellHtml(actor);
    document.title = '小初 · 员工服务助手';

    var logoutBtn = $('[data-action="logout"]', appEl);
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function () {
        openConfirmModal({
          title: '退出登录',
          message: '确定要退出登录吗？你的工作空间数据会保留，下次用账号和密码还能进来。',
          confirmText: '退出登录',
          onConfirm: function () {
            var me = store.currentUser();
            store.clearSession();
            renderLogin(me ? me.account : '');
            toast('已退出登录');
          }
        });
      });
    }

    renderAssistantMain(actor);
    wireAssistantPage();
    wireEntryExtras(actor);
    setChatSending(chatState.pending);
    resumePendingAnswers(actor);
  }

  function renderAssistantMain(actor) {
    var messagesEl = document.getElementById('chat-messages');
    if (!messagesEl || !actor) return;

    var session = chatState.sessionId ? store.getMyChatSession(actor, chatState.sessionId) : null;
    if (chatState.sessionId && !session) chatState.sessionId = null;

    messagesEl.innerHTML = session ? chatThreadHtml(session) : (ASSISTANT_ENTRY ? entryWelcomeHtml(actor) : chatWelcomeHtml());

    if (ASSISTANT_ENTRY) {
      renderEntryHistory(actor);
      toggleAssistantAvatarThinking(chatState.pending);
    }

    var scroll = document.getElementById('chat-scroll');
    if (scroll) scroll.scrollTop = scroll.scrollHeight;
  }

  function renderChatSessionList(actor) {
    var list = document.getElementById('chat-session-list');
    if (!list || !actor) return;

    var sessions = store.listMyChatSessions(actor).slice(0, 12);
    if (!sessions.length) {
      list.innerHTML = '<p class="chat-side-empty">还没有咨询记录。</p>';
      return;
    }

    list.innerHTML = sessions.map(function (session) {
      var active = session.id === chatState.sessionId ? ' is-active' : '';
      return '<button type="button" class="chat-session-item' + active + '" data-chat-session="' + esc(session.id) + '">' + esc(session.title) + '</button>';
    }).join('');
  }

  function setChatSending(loading) {
    var button = document.getElementById('chat-send');
    if (button) {
      button.classList.toggle('is-loading', !!loading);
      button.disabled = !!loading;
    }
    toggleAssistantAvatarThinking(!!loading);
  }

  function sendChatQuestion(rawText) {
    var actor = store.currentUser();
    if (!actor) {
      renderLogin();
      return;
    }

    var text = String(rawText == null ? '' : rawText).trim();
    if (!text) return;
    if (text.length > 2000) {
      toast('问题最多 2000 个字。');
      return;
    }
    if (chatState.pending) return;

    var session = chatState.sessionId ? store.getMyChatSession(actor, chatState.sessionId) : null;
    if (chatState.sessionId && !session) chatState.sessionId = null;

    var result = session
      ? store.appendChatMessage(actor, session.id, 'user', text)
      : store.createChatSession(actor, text);

    if (!result.ok) {
      toast(result.message);
      return;
    }

    session = result.session;
    chatState.sessionId = session.id;

    var input = document.getElementById('chat-input');
    if (input) {
      input.value = '';
      input.focus();
    }

    var pending = store.appendChatMessage(actor, session.id, 'assistant', '', { status: 'pending' });
    if (!pending.ok) {
      toast(pending.message);
      return;
    }

    if (document.getElementById('chat-messages')) renderAssistantMain(actor);
    renderChatSessionList(actor);

    chatState.pending = true;
    setChatSending(true);
    startChatAnswer(actor, session.id, text, pending.message.id);
  }

  function startChatAnswer(actor, sessionId, question, assistantMessageId) {
    if (!window.OnboardAnswer || !assistantMessageId) return;
    if (!chatState.generating) chatState.generating = {};
    if (chatState.generating[assistantMessageId]) return;
    chatState.generating[assistantMessageId] = true;

    window.OnboardAnswer.generateAnswer(actor, question).then(function (result) {
      delete chatState.generating[assistantMessageId];

      var me = store.currentUser();
      if (me) {
        if (result.ok) {
          store.updateChatMessage(me, sessionId, assistantMessageId, {
            content: '',
            status: 'done',
            answer: result.answer,
            error: ''
          });
        } else {
          store.updateChatMessage(me, sessionId, assistantMessageId, {
            content: '',
            status: 'failed',
            answer: null,
            error: result.error,
            elapsedMs: result.elapsedMs || 0,
            modelName: result.modelName || ''
          });
        }
      }

      chatState.pending = false;
      setChatSending(false);

      var current = store.currentUser();
      if (current) {
        if (chatState.sessionId === sessionId && document.getElementById('chat-messages')) renderAssistantMain(current);
        renderChatSessionList(current);
      }
    }).catch(function (error) {
      delete chatState.generating[assistantMessageId];
      chatState.pending = false;
      setChatSending(false);

      var me = store.currentUser();
      if (!me) return;
      store.updateChatMessage(me, sessionId, assistantMessageId, {
        content: '',
        status: 'failed',
        answer: null,
        error: '生成失败：' + ((error && error.message) ? error.message : String(error))
      });
      if (document.getElementById('chat-messages')) renderAssistantMain(me);
    });
  }

  // 用户切走再回来（或刷新页面）时，继续处理还没生成的回答
  function resumePendingAnswers(actor) {
    if (!actor) return;
    var sessions = store.listMyChatSessions(actor);
    sessions.forEach(function (session) {
      var messages = session.messages || [];
      for (var i = messages.length - 1; i >= 0; i--) {
        var message = messages[i];
        if (!message || message.status !== 'pending') continue;
        if (chatState.generating[message.id]) return;

        var question = '';
        for (var j = i - 1; j >= 0; j--) {
          if (messages[j] && messages[j].role === 'user') {
            question = messages[j].content;
            break;
          }
        }
        if (question) startChatAnswer(actor, session.id, question, message.id);
        return;
      }
    });
  }

  function retryChatAnswer(messageId) {
    var actor = store.currentUser();
    if (!actor || !chatState.sessionId) return;

    var session = store.getMyChatSession(actor, chatState.sessionId);
    if (!session) return;

    var messages = session.messages || [];
    var index = -1;
    for (var i = 0; i < messages.length; i++) {
      if (messages[i] && messages[i].id === messageId) {
        index = i;
        break;
      }
    }
    if (index === -1) return;

    var question = '';
    for (var j = index - 1; j >= 0; j--) {
      if (messages[j] && messages[j].role === 'user') {
        question = messages[j].content;
        break;
      }
    }
    if (!question) return;

    store.updateChatMessage(actor, session.id, messageId, {
      status: 'pending',
      answer: null,
      error: '',
      content: ''
    });
    if (document.getElementById('chat-messages')) renderAssistantMain(actor);
    renderChatSessionList(actor);

    chatState.pending = true;
    setChatSending(true);
    startChatAnswer(actor, session.id, question, messageId);
  }

  function handleFeedbackButton(button) {
    var actor = store.currentUser();
    if (!actor) {
      renderLogin();
      return;
    }

    var wrap = button.closest('[data-feedback-message]');
    if (!wrap) return;

    var messageId = wrap.getAttribute('data-feedback-message');
    var sessionId = chatState.sessionId;
    if (!sessionId) return;

    if (button.getAttribute('data-feedback-helpful') === '1') {
      var result = store.addChatFeedback(actor, sessionId, messageId, { helpful: true });
      if (!result.ok) {
        toast(result.message);
        return;
      }
      toast('感谢反馈，已记录');
      renderAssistantMain(actor);
      return;
    }

    openFeedbackModal(actor, sessionId, messageId);
  }

  function buildHandoffSummary(question, answer) {
    var lines = ['问题：' + question];
    var conclusions = (answer.conclusions || []).map(function (item) {
      return String(item.text || '').trim();
    }).filter(Boolean);

    if (conclusions.length) {
      lines.push('回答结论：');
      conclusions.forEach(function (text, index) {
        lines.push((index + 1) + '. ' + text);
      });
    }

    if (answer.leaveCard) {
      lines.push('年假信息：' + answer.leaveCard.year + ' 年度，余额 ' + answer.leaveCard.balance + ' 天');
    }
    if (answer.missing) {
      lines.push('缺少的信息：' + answer.missing);
    }
    if (!conclusions.length && !answer.leaveCard) {
      lines.push('（这条回答没有可用结论，请补充你想问的事项）');
    }

    return lines.join('\n');
  }

  function openHandoffModal(messageId) {
    var actor = store.currentUser();
    if (!actor) {
      renderLogin();
      return;
    }

    var sessionId = chatState.sessionId;
    var session = sessionId ? store.getMyChatSession(actor, sessionId) : null;
    if (!session) return;

    var messages = session.messages || [];
    var index = -1;
    for (var i = 0; i < messages.length; i++) {
      if (messages[i] && messages[i].id === messageId) {
        index = i;
        break;
      }
    }
    if (index === -1) return;

    var message = messages[index];
    if (message.role !== 'assistant' || !message.answer) return;

    var question = '';
    for (var j = index - 1; j >= 0; j--) {
      if (messages[j] && messages[j].role === 'user') {
        question = messages[j].content;
        break;
      }
    }

    var summary = buildHandoffSummary(question || '（未记录问题）', message.answer).slice(0, 1000);

    modalRoot.innerHTML = '' +
      '<div class="modal-overlay" id="handoff-overlay">' +
      '  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="handoff-title">' +
      '    <div class="modal-head">' +
      '      <h3 id="handoff-title">转人工</h3>' +
      '      <button type="button" class="icon-btn" data-close="1" aria-label="关闭">×</button>' +
      '    </div>' +
      '    <p class="modal-sub">下面是根据你的问题和回答结论整理的事项摘要。只有你确认提交的这段摘要会发给 HR，整段聊天不会转过去。</p>' +
      '    <div class="form-error" id="handoff-error" role="alert"></div>' +
      '    <div class="field">' +
      '      <label for="handoff-summary">事项摘要（可以修改）</label>' +
      '      <textarea class="input" id="handoff-summary" rows="8" maxlength="1000">' + esc(summary) + '</textarea>' +
      '    </div>' +
      '    <div class="modal-foot">' +
      '      <button type="button" class="btn btn-ghost" data-close="1">取消</button>' +
      '      <button type="button" class="btn btn-primary" id="handoff-submit">确认提交</button>' +
      '    </div>' +
      '  </div>' +
      '</div>';

    var overlay = document.getElementById('handoff-overlay');
    var closeModal = wireModalClose(overlay);
    var errEl = document.getElementById('handoff-error');

    document.getElementById('handoff-submit').addEventListener('click', function () {
      hideError(errEl);
      var text = document.getElementById('handoff-summary').value.trim();
      if (!text) {
        showError(errEl, '请填写事项摘要。');
        return;
      }
      var result = store.createTicket(actor, { summary: text, sessionId: chatState.sessionId || '' });
      if (!result.ok) {
        showError(errEl, result.message);
        return;
      }
      closeModal();
      toast('已提交工单，可在“工单与入职”里查看进度');
    });
  }

  function openFeedbackModal(actor, sessionId, messageId) {
    modalRoot.innerHTML = '' +
      '<div class="modal-overlay" id="feedback-overlay">' +
      '  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="feedback-title">' +
      '    <div class="modal-head">' +
      '      <h3 id="feedback-title">没有帮助的原因</h3>' +
      '      <button type="button" class="icon-btn" data-close="1" aria-label="关闭">×</button>' +
      '    </div>' +
      '    <p class="modal-sub">反馈会保留原问题、当时的完整回答和引用制度版本，方便 HR 复盘。</p>' +
      '    <div class="form-error" id="feedback-error" role="alert"></div>' +
      '    <div class="field">' +
      '      <label for="feedback-reason">问题类型</label>' +
      '      <select class="input" id="feedback-reason">' +
      '        <option value="">请选择原因</option>' +
      store.FEEDBACK_REASONS.map(function (reason) {
        return '<option value="' + esc(reason) + '">' + esc(reason) + '</option>';
      }).join('') +
      '      </select>' +
      '    </div>' +
      '    <div class="field">' +
      '      <label for="feedback-note">补充说明（选填）</label>' +
      '      <textarea class="input" id="feedback-note" rows="3" maxlength="200" placeholder="可以补充具体情况，最多 200 个字"></textarea>' +
      '    </div>' +
      '    <div class="modal-foot">' +
      '      <button type="button" class="btn btn-ghost" data-close="1">取消</button>' +
      '      <button type="button" class="btn btn-primary" id="feedback-submit">提交反馈</button>' +
      '    </div>' +
      '  </div>' +
      '</div>';

    var overlay = document.getElementById('feedback-overlay');
    var closeModal = wireModalClose(overlay);
    var errEl = document.getElementById('feedback-error');

    document.getElementById('feedback-submit').addEventListener('click', function () {
      hideError(errEl);

      var reason = document.getElementById('feedback-reason').value;
      var note = document.getElementById('feedback-note').value;

      if (!reason) {
        showError(errEl, '请选择没有帮助的原因。');
        return;
      }

      var result = store.addChatFeedback(actor, sessionId, messageId, {
        helpful: false,
        reason: reason,
        note: note
      });
      if (!result.ok) {
        showError(errEl, result.message);
        return;
      }

      closeModal();
      toast('反馈已记录，感谢你的补充');
      renderAssistantMain(store.currentUser());
    });
  }

  function wireAssistantPage() {
    var input = document.getElementById('chat-input');
    var sendBtn = document.getElementById('chat-send');
    var messagesEl = document.getElementById('chat-messages');
    var listEl = document.getElementById('chat-session-list');
    if (!input || !sendBtn || !messagesEl) return;

    messagesEl.addEventListener('click', function (event) {
      var target = event.target;
      if (!target || !target.closest) return;

      var handoffButton = target.closest('[data-handoff-message]');
      if (handoffButton) {
        openHandoffModal(handoffButton.getAttribute('data-handoff-message'));
        return;
      }

      var feedbackButton = target.closest('[data-feedback-helpful]');
      if (feedbackButton) {
        handleFeedbackButton(feedbackButton);
        return;
      }

      var retry = target.closest('[data-retry-message]');
      if (retry) {
        retryChatAnswer(retry.getAttribute('data-retry-message'));
        return;
      }

      var download = target.closest('[data-download-policy]');
      if (download) {
        event.preventDefault();
        downloadPolicyFile(download.getAttribute('data-download-policy'), '');
        return;
      }

      var btn = target.closest('[data-chat-question]');
      if (!btn) return;
      sendChatQuestion(btn.getAttribute('data-chat-question'));
    });

    var newBtn = $('[data-action="new-chat"]', appEl);
    if (newBtn) {
      newBtn.addEventListener('click', function () {
        chatState.sessionId = null;
        var me = store.currentUser();
        if (me) {
          renderAssistantMain(me);
          renderChatSessionList(me);
        }
        input.focus();
      });
    }

    if (listEl) {
      listEl.addEventListener('click', function (event) {
        var btn = event.target && event.target.closest ? event.target.closest('[data-chat-session]') : null;
        if (!btn) return;
        var me = store.currentUser();
        // 内部校验：会话只属于本人
        var session = store.getMyChatSession(me, btn.getAttribute('data-chat-session'));
        if (!session) {
          toast('只能查看自己的咨询记录。');
          return;
        }
        chatState.sessionId = session.id;
        renderAssistantMain(me);
        renderChatSessionList(me);
        input.focus();
      });
    }

    input.addEventListener('compositionstart', function () {
      chatState.composing = true;
    });
    input.addEventListener('compositionend', function () {
      chatState.composing = false;
    });

    input.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter') return;
      if (event.shiftKey) return; // Shift+Enter 换行
      // 输入法选字时的回车不发送
      if (event.isComposing || chatState.composing || event.keyCode === 229) return;
      event.preventDefault();
      sendChatQuestion(input.value);
    });

    sendBtn.addEventListener('click', function () {
      sendChatQuestion(input.value);
    });

    input.focus();
  }

  /* ================== 查找测试（仅管理员，验收检索用） ================== */

  function retrievalTestHtml(actor) {
    var policies = store.listPolicies();
    var policyOptions = policies.map(function (policy) {
      return '<option value="' + esc(policy.id) + '">' + esc(policy.name) + '（' + esc(policy.version) + '）</option>';
    }).join('');
    var scopeOptions = ['全员'].concat(store.getDepartments()).map(function (scope) {
      return '<option value="' + esc(scope) + '">' + esc(scope) + '</option>';
    }).join('');

    return '' +
      '<section class="page-head">' +
      '  <div>' +
      '    <h2 class="page-head-title">查找测试</h2>' +
      '    <p class="page-head-sub">只做原文查找、不生成回答；仅管理员可见，用于验收检索效果</p>' +
      '  </div>' +
      '</section>' +
      '<form class="model-card retrieval-form" id="retrieval-form" autocomplete="off">' +
      '  <div class="field">' +
      '    <label for="retrieval-question">问题</label>' +
      '    <input class="input" id="retrieval-question" type="text" maxlength="200" placeholder="例如：年假可以结转到明年吗？">' +
      '  </div>' +
      '  <div class="model-actions">' +
      '    <button type="submit" class="btn btn-primary">查找原文</button>' +
      '    <span class="retrieval-tip">先按你的可见制度过滤，再按关键词命中与语义相似度合并排序。</span>' +
      '  </div>' +
      '</form>' +
      '<details class="model-card retrieval-scope-tool">' +
      '  <summary>验收辅助：调整某份制度的适用范围</summary>' +
      '  <p class="retrieval-scope-note">只改适用范围，不改正文和版本；改完重新查找就能看到结果变化。</p>' +
      '  <div class="field-row">' +
      '    <div class="field"><label for="retrieval-scope-policy">制度</label><select class="input" id="retrieval-scope-policy">' + policyOptions + '</select></div>' +
      '    <div class="field"><label for="retrieval-scope-value">适用范围</label><select class="input" id="retrieval-scope-value">' + scopeOptions + '</select></div>' +
      '  </div>' +
      '  <div class="model-actions"><button type="button" class="btn btn-ghost" id="retrieval-scope-apply">应用适用范围</button></div>' +
      '</details>' +
      '<div id="retrieval-result"></div>' +
      '<p class="policy-note">本页只验证检索：不会调用模型，也不会生成回答；员工端问答会在后续步骤接入。</p>';
  }

  function highlightRetrievalTerms(escapedText, question) {
    var terms = (window.OnboardRetrieval.DOMAIN_TERMS || []).filter(function (term) {
      return question.indexOf(term) !== -1;
    }).sort(function (left, right) {
      return right.length - left.length;
    }).slice(0, 8);

    var html = escapedText;
    terms.forEach(function (term) {
      var safe = esc(term);
      html = html.split(safe).join('<mark>' + safe + '</mark>');
    });
    return html;
  }

  function renderRetrievalResult(actor, question) {
    var resultEl = document.getElementById('retrieval-result');
    if (!resultEl) return;

    var outcome = window.OnboardRetrieval.searchPolicyPassages(actor, question);
    if (!outcome.ok) {
      resultEl.innerHTML = '<div class="model-card"><p class="retrieval-empty">' + esc(outcome.message) + '</p></div>';
      return;
    }

    var visibleText = outcome.visiblePolicies.length
      ? outcome.visiblePolicies.map(function (policy) {
          return policy.name + '（' + policy.version + '，' + policy.scope + '）';
        }).join('、')
      : '没有可见的制度';

    var header = '<div class="model-card retrieval-summary">' +
      '<p><strong>问题：</strong>' + esc(outcome.question) + '</p>' +
      '<p>可见制度 ' + outcome.visiblePolicies.length + ' 份 · 候选原文 ' + outcome.passageCount + ' 段 · 命中 ' + outcome.results.length + ' 段 · 用时 ' + outcome.elapsedMs + ' 毫秒</p>' +
      '<p class="retrieval-scope">可检索范围：' + esc(visibleText) + '</p>' +
      '</div>';

    if (!outcome.results.length) {
      resultEl.innerHTML = header + '<div class="model-card"><p class="retrieval-empty">没有找到相关原文，可以换一种问法再试。</p></div>';
      return;
    }

    var cards = outcome.results.map(function (item, index) {
      return '<article class="model-card retrieval-card">' +
        '<div class="retrieval-card-head">' +
        '  <span class="retrieval-rank">' + (index + 1) + '</span>' +
        '  <span class="retrieval-policy">' + esc(item.policyName) + '</span>' +
        '  <span class="retrieval-meta">' + esc(item.version) + ' · ' + esc(item.scope) + ' · ' + esc(item.positionLabel) + '</span>' +
        '  <span class="retrieval-score">综合 ' + item.score + '（关键词 ' + item.keywordScore + ' / 语义 ' + item.semanticScore + '）</span>' +
        '</div>' +
        '<p class="retrieval-text">' + highlightRetrievalTerms(esc(item.text), question) + '</p>' +
        '<p class="retrieval-cite">来源：' + esc(item.policyName) + ' · ' + esc(item.version) + ' · ' + esc(item.positionLabel) + '</p>' +
        '</article>';
    }).join('');

    resultEl.innerHTML = header + '<div class="retrieval-list">' + cards + '</div>';
  }

  function wireRetrievalTestPage() {
    var form = document.getElementById('retrieval-form');
    var input = document.getElementById('retrieval-question');
    if (!form || !input) return;

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var me = store.currentUser();
      if (!me || !window.OnboardRoles.can(me, 'page:retrieval-test')) {
        toast('只有管理员可以使用查找测试。');
        return;
      }
      var question = input.value.trim();
      if (!question) {
        toast('请输入问题。');
        return;
      }
      renderRetrievalResult(me, question);
    });

    input.focus();

    var applyScopeBtn = document.getElementById('retrieval-scope-apply');
    if (applyScopeBtn) {
      applyScopeBtn.addEventListener('click', function () {
        var me = store.currentUser();
        if (!me || !window.OnboardRoles.can(me, 'page:retrieval-test')) {
          toast('只有管理员可以调整适用范围。');
          return;
        }
        var policyId = document.getElementById('retrieval-scope-policy').value;
        var scope = document.getElementById('retrieval-scope-value').value;
        var result = store.changePolicyScope(policyId, scope);
        if (!result.ok) {
          toast(result.message);
          return;
        }
        toast('已把“' + result.policy.name + '”的适用范围改为“' + scope + '”，可重新查找验证');
      });
    }
  }

  /* ================== 员工问询（HR 复盘） ================== */

  var inquiryFilter = { status: 'all', keyword: '' };

  function inquiryStatusBadge(status) {
    var labels = { done: '已完成', failed: '执行失败', pending: '生成中', empty: '无回答' };
    return '<span class="inquiry-status is-' + esc(status) + '">' + (labels[status] || status) + '</span>';
  }

  function inquiriesHtml(actor) {
    return '' +
      '<section class="page-head">' +
      '  <div>' +
      '    <h2 class="page-head-title">员工问询</h2>' +
      '    <p class="page-head-sub">全部咨询记录与反馈（仅 HR 管理员 / 系统管理员可见）</p>' +
      '  </div>' +
      '</section>' +
      '<div class="inquiries-filters">' +
      '  <input class="input input-sm" id="inquiry-search" type="search" placeholder="搜索问题、员工姓名或账号">' +
      '  <select class="input input-sm" id="inquiry-status">' +
      '    <option value="all">全部咨询</option>' +
      '    <option value="negative">无帮助反馈</option>' +
      '    <option value="failed">执行失败</option>' +
      '    <option value="done">已完成</option>' +
      '  </select>' +
      '  <span class="policy-count" id="inquiry-count"></span>' +
      '</div>' +
      '<div class="table-card">' +
      '  <table class="data-table inquiry-table">' +
      '    <thead><tr><th>问题</th><th>员工（部门）</th><th>时间</th><th>状态与反馈</th><th>操作</th></tr></thead>' +
      '    <tbody id="inquiry-list"></tbody>' +
      '  </table>' +
      '</div>' +
      '<p class="policy-note">员工端对话默认只对本人可见；HR 可在这里复盘全部咨询与反馈。反馈记录会保留当时的回答和引用制度版本。</p>';
  }

  function renderInquiriesList(actor) {
    var tbody = document.getElementById('inquiry-list');
    if (!tbody) return;

    var sessions = store.listChatSessionsForReview(actor);
    var keyword = String(inquiryFilter.keyword || '').trim().toLowerCase();

    var filtered = sessions.filter(function (session) {
      if (inquiryFilter.status === 'negative' && session.negativeCount === 0) return false;
      if (inquiryFilter.status === 'failed' && session.status !== 'failed') return false;
      if (inquiryFilter.status === 'done' && session.status !== 'done') return false;
      if (keyword) {
        var haystack = session.searchText || [session.title, session.userName, session.account, session.department].join(' ').toLowerCase();
        if (haystack.indexOf(keyword) === -1) return false;
      }
      return true;
    });

    var countEl = document.getElementById('inquiry-count');
    if (countEl) countEl.textContent = '共 ' + filtered.length + ' 条咨询';

    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="policy-empty">没有符合条件的咨询。</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(function (session) {
      var feedbackHtml = '';
      if (session.feedbackCount) {
        if (session.positiveCount) {
          feedbackHtml += '<span class="inquiry-fb is-positive">有帮助 ×' + session.positiveCount + '</span>';
        }
        if (session.negativeCount) {
          feedbackHtml += '<span class="inquiry-fb is-negative">无帮助 ×' + session.negativeCount +
            (session.latestNegativeReason ? '（' + esc(session.latestNegativeReason) + '）' : '') + '</span>';
        }
      } else {
        feedbackHtml = '<span class="inquiry-fb">未反馈</span>';
      }

      return '<tr>' +
        '<td class="inquiry-question">' + esc(session.title) +
        (session.latestQuestion && session.latestQuestion !== session.title
          ? '<span class="inquiry-sub">最新问题：' + esc(session.latestQuestion) + '</span>'
          : '') +
        '</td>' +
        '<td>' + esc(session.userName) + '<span class="leave-account">' + esc(session.account) + ' · ' + esc(session.department) + '</span></td>' +
        '<td>' + esc(formatDateTime(session.updatedAt)) + '</td>' +
        '<td>' + inquiryStatusBadge(session.status) + feedbackHtml + '</td>' +
        '<td><button type="button" class="btn btn-ghost btn-sm" data-inquiry-session="' + esc(session.id) + '">查看详情</button></td>' +
        '</tr>';
    }).join('');
  }

  function inquiryMessageHtml(message) {
    if (message.role === 'user') {
      return '<div class="inquiry-msg is-user">' +
        '<p class="inquiry-msg-who">员工</p>' +
        '<p class="inquiry-msg-text">' + esc(message.content) + '</p>' +
        '</div>';
    }

    if (message.status === 'pending') {
      return '<div class="inquiry-msg is-assistant"><p class="inquiry-msg-who">助手</p><p class="inquiry-msg-text">正在查询并核对依据…</p></div>';
    }
    if (message.status === 'failed') {
      return '<div class="inquiry-msg is-assistant"><p class="inquiry-msg-who">助手</p><p class="inquiry-msg-text is-failed">生成失败：' + esc(message.error || '未知原因') + '</p></div>';
    }

    var answer = message.answer || {};
    var conclusions = (answer.conclusions || []).map(function (item) {
      return '<li>' + esc(item.text) + '</li>';
    }).join('');
    var citations = (answer.citations || []).map(function (citation) {
      return '<li>' + esc(citation.policyName) + ' · ' + esc(citation.version) + ' · ' + esc(citation.positionLabel) + '</li>';
    }).join('');
    var feedbackHtml = message.feedback
      ? '<p class="inquiry-msg-feedback">反馈：' + (message.feedback.helpful ? '有帮助' : '没有帮助（' + esc(message.feedback.reason) + '）') + ' · ' + esc(formatDateTime(message.feedback.createdAt)) + '</p>'
      : '';

    return '<div class="inquiry-msg is-assistant">' +
      '<p class="inquiry-msg-who">助手' + (answer.status && ANSWER_STATUS_LABELS[answer.status] ? ' · ' + ANSWER_STATUS_LABELS[answer.status] : '') + '</p>' +
      (conclusions ? '<ol class="inquiry-conclusions">' + conclusions + '</ol>' : '') +
      (citations ? '<div class="inquiry-citations"><span class="citation-label">引用：</span><ul>' + citations + '</ul></div>' : '') +
      feedbackHtml +
      '</div>';
  }

  function inquiryFeedbackRecordHtml(feedback) {
    var snapshot = feedback.answerSnapshot || {};
    var citations = (snapshot.citations || []).map(function (citation) {
      return esc(citation.policyName) + ' ' + esc(citation.version) + '（' + esc(citation.positionLabel) + '）';
    }).join('；');
    var conclusions = (snapshot.conclusions || []).map(function (item) {
      return '<li>' + esc(item.text) + '</li>';
    }).join('');

    return '<div class="inquiry-feedback-record">' +
      '<p class="inquiry-feedback-title">' + (feedback.helpful ? '有帮助' : '没有帮助') +
      (feedback.reason ? '（' + esc(feedback.reason) + '）' : '') + ' · ' + esc(formatDateTime(feedback.createdAt)) + '</p>' +
      '<p><span class="citation-label">原问题：</span>' + esc(feedback.question) + '</p>' +
      '<p><span class="citation-label">当时的引用版本：</span>' + (citations || '—') + '</p>' +
      '<p><span class="citation-label">补充说明：</span>' + esc(feedback.note || '—') + '</p>' +
      (conclusions ? '<details class="inquiry-snapshot"><summary>当时的完整回答</summary><ol>' + conclusions + '</ol></details>' : '') +
      '</div>';
  }

  function openInquiryDetailModal(sessionId) {
    var actor = store.currentUser();
    var detail = store.getChatSessionForReview(actor, sessionId);
    if (!detail) {
      toast('你只能查看本人或有权限查看的咨询。');
      return;
    }

    var user = detail.user;
    var messagesHtml = (detail.messages || []).map(inquiryMessageHtml).join('');
    var feedbacksHtml = (detail.feedbacks || []).map(inquiryFeedbackRecordHtml).join('') || '<p class="policy-empty">这段咨询还没有反馈。</p>';

    modalRoot.innerHTML = '' +
      '<div class="modal-overlay" id="inquiry-overlay">' +
      '  <div class="modal modal-wide" role="dialog" aria-modal="true" aria-labelledby="inquiry-title">' +
      '    <div class="modal-head">' +
      '      <h3 id="inquiry-title">咨询详情</h3>' +
      '      <button type="button" class="icon-btn" data-close="1" aria-label="关闭">×</button>' +
      '    </div>' +
      '    <p class="modal-sub">' + esc(detail.title) + ' · ' + esc(user ? user.name : '（账号已删除）') +
      '（' + esc(user ? user.account : '') + ' · ' + esc(user ? user.department : '') + '） · ' +
      '最后更新 ' + esc(formatDateTime(detail.updatedAt)) + '</p>' +
      '    <div class="inquiry-detail">' +
      '      <div class="inquiry-detail-messages">' + messagesHtml + '</div>' +
      '      <div class="inquiry-detail-feedbacks">' +
      '        <h4 class="inquiry-detail-heading">反馈记录</h4>' + feedbacksHtml +
      '      </div>' +
      '    </div>' +
      '    <div class="modal-foot"><button type="button" class="btn btn-primary" data-close="1">关闭</button></div>' +
      '  </div>' +
      '</div>';

    wireModalClose(document.getElementById('inquiry-overlay'));
  }

  function wireInquiriesPage() {
    var search = document.getElementById('inquiry-search');
    var statusSelect = document.getElementById('inquiry-status');
    var list = document.getElementById('inquiry-list');
    if (!list) return;

    var me = store.currentUser();

    if (search) {
      search.addEventListener('input', function () {
        inquiryFilter.keyword = search.value;
        renderInquiriesList(store.currentUser());
      });
    }
    if (statusSelect) {
      statusSelect.addEventListener('change', function () {
        inquiryFilter.status = statusSelect.value;
        renderInquiriesList(store.currentUser());
      });
    }

    list.addEventListener('click', function (event) {
      var btn = event.target && event.target.closest ? event.target.closest('[data-inquiry-session]') : null;
      if (!btn) return;
      openInquiryDetailModal(btn.getAttribute('data-inquiry-session'));
    });
  }

  /* ================== 工单与入职（员工） ================== */

  function ticketStatusBadge(status) {
    return '<span class="ticket-status is-' + esc(status) + '">' + esc(store.ticketStatusLabel(status)) + '</span>';
  }

  function ticketTimelineHtml(ticket) {
    return '<ul class="ticket-timeline-list">' + (ticket.timeline || []).map(function (event) {
      return '<li>' +
        '<span class="ticket-event-time">' + esc(formatDateTime(event.createdAt)) + '</span>' +
        '<span class="ticket-event-actor">' + esc(event.actorName || '系统') + '</span>' +
        '<span class="ticket-event-text">' + esc(event.text || '') + '</span>' +
        '</li>';
    }).join('') + '</ul>';
  }

  function ticketCardHtml(ticket, options) {
    var opts = options || {};
    var replyForm = ticket.status === 'closed'
      ? '<p class="ticket-closed">工单已关闭，不能再回复。</p>'
      : '<div class="ticket-reply">' +
        '<textarea class="input" id="ticket-reply-' + esc(ticket.id) + '" rows="2" maxlength="500" placeholder="补充说明或回复…"></textarea>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-ticket-reply="' + esc(ticket.id) + '">提交回复</button>' +
        '</div>';

    return '<article class="ticket-card" data-ticket-card-id="' + esc(ticket.id) + '">' +
      '<div class="ticket-card-head">' +
      '  <h3 class="ticket-title">' + esc(ticket.title) + '</h3>' +
      '  ' + ticketStatusBadge(ticket.status) +
      '</div>' +
      '<p class="ticket-meta">' +
      (opts.showEmployee ? '员工：' + esc(ticket.employeeName) + '（' + esc(ticket.department) + '） · ' : '') +
      '提交于 ' + esc(formatDateTime(ticket.createdAt)) +
      ' · 经办人：' + esc(ticket.assigneeName || '尚未指派') +
      '</p>' +
      '<details class="ticket-timeline" open><summary>处理记录</summary>' + ticketTimelineHtml(ticket) + '</details>' +
      replyForm +
      '</article>';
  }

  function todayDateOnly() {
    var now = new Date();
    var month = now.getMonth() + 1;
    var day = now.getDate();
    return now.getFullYear() + '-' + (month < 10 ? '0' + month : month) + '-' + (day < 10 ? '0' + day : day);
  }

  function onboardingTaskState(task) {
    if (task.completed) return { code: 'done', label: '已完成' };
    if (task.dueDate && task.dueDate < todayDateOnly()) return { code: 'overdue', label: '已逾期' };
    return { code: 'todo', label: '待完成' };
  }

  function onboardingTaskCardHtml(task) {
    var state = onboardingTaskState(task);

    return '<article class="onboarding-task is-' + state.code + '" data-onboarding-task-id="' + esc(task.id) + '">' +
      '<div class="task-head">' +
      '  <h4 class="task-name">' + esc(task.name) + '</h4>' +
      '  <span class="task-status is-' + state.code + '">' + state.label + '</span>' +
      '</div>' +
      (task.description ? '<p class="task-desc">' + esc(task.description) + '</p>' : '') +
      '<p class="task-meta">截止日期：' + esc(task.dueDate) + '（相对入职日 +' + esc(String(task.dueDays)) + ' 天） · 入职日：' + esc(task.onboardingDate) + ' · 分派：' + esc(task.assignedBy || 'HR') + '</p>' +
      (task.completed
        ? '<p class="task-done-meta">已于 ' + esc(formatDateTime(task.completedAt)) + ' 由你本人确认完成</p>'
        : '<button type="button" class="btn btn-ghost btn-sm" data-task-complete="' + esc(task.id) + '">标记完成</button>') +
      '</article>';
  }

  function ticketsHtml(actor) {
    var mine = store.listMyTickets(actor);
    var assigned = store.listAssignedTickets(actor);
    var tasks = store.listEmployeeOnboardingTasks(actor, actor.id);

    var html = '<section class="page-head">' +
      '  <div>' +
      '    <h2 class="page-head-title">工单与入职</h2>' +
      '    <p class="page-head-sub">查看你提交给 HR 的工单和处理进度</p>' +
      '  </div>' +
      '</section>';

    html += '<div class="ticket-section"><h3 class="ticket-section-title">入职任务</h3>' +
      '<p class="task-note">勾选完成只代表你本人确认，不代表邮箱、设备、门禁等外部系统已经实际开通。</p>' +
      (tasks.length
        ? tasks.map(onboardingTaskCardHtml).join('')
        : '<div class="ticket-empty">还没有入职任务。</div>') +
      '</div>';

    html += '<div class="ticket-section"><h3 class="ticket-section-title">我的工单</h3>';
    if (!mine.length) {
      html += '<div class="ticket-empty">还没有工单。在“员工服务助手”里点回答下方的“转人工”就能提交问题。</div>';
    } else {
      html += mine.map(function (ticket) { return ticketCardHtml(ticket, {}); }).join('');
    }
    html += '</div>';

    if (assigned.length) {
      html += '<div class="ticket-section"><h3 class="ticket-section-title">指派给我的工单</h3>' +
        assigned.map(function (ticket) { return ticketCardHtml(ticket, { showEmployee: true }); }).join('') +
        '</div>';
    }

    html += '<p class="policy-note">工单状态由 HR 更新；员工和 HR 的回复都会记录在同一条时间线上。</p>';
    return html;
  }

  function wireTicketsPage() {
    var container = document.getElementById('page-content');
    if (!container) return;

    container.addEventListener('click', function (event) {
      var taskBtn = event.target && event.target.closest ? event.target.closest('[data-task-complete]') : null;
      if (taskBtn) {
        var taskResult = store.completeOnboardingTask(store.currentUser(), taskBtn.getAttribute('data-task-complete'));
        if (!taskResult.ok) {
          toast(taskResult.message);
          return;
        }
        toast('已标记完成（仅代表你本人确认）');
        route();
        return;
      }

      var btn = event.target && event.target.closest ? event.target.closest('[data-ticket-reply]') : null;
      if (!btn) return;

      var ticketId = btn.getAttribute('data-ticket-reply');
      var textarea = document.getElementById('ticket-reply-' + ticketId);
      if (!textarea) return;

      var actor = store.currentUser();
      var result = store.replyTicket(actor, ticketId, textarea.value);
      if (!result.ok) {
        toast(result.message);
        return;
      }
      toast('已提交回复');
      route();
    });
  }

  /* ================== 服务管理（HR / 管理员） ================== */

  function serviceHtml(actor) {
    return '' +
      '<section class="page-head">' +
      '  <div>' +
      '    <h2 class="page-head-title">服务管理</h2>' +
      '    <p class="page-head-sub">处理员工转人工工单，并维护、分派入职任务</p>' +
      '  </div>' +
      '</section>' +
      '<div class="table-card">' +
      '  <table class="data-table inquiry-table">' +
      '    <thead><tr><th>工单</th><th>员工（部门）</th><th>状态</th><th>经办人</th><th>更新时间</th><th>操作</th></tr></thead>' +
      '    <tbody id="service-list"></tbody>' +
      '  </table>' +
      '</div>' +
      '<p class="policy-note">员工和 HR 的回复、状态变化都会记录在同一条工单时间线上，并保留操作人和时间。</p>' +
      '<section class="service-card">' +
      '  <div class="service-card-head">' +
      '    <h3 class="service-card-title">反馈跟进</h3>' +
      '    <span class="policy-count" id="feedback-followup-count"></span>' +
      '  </div>' +
      '  <p class="service-hint">员工点“没有帮助”后会自动出现在这里。反馈不会自动修改制度或设置，改进需要人工确认。</p>' +
      '  <div class="table-card">' +
      '    <table class="data-table inquiry-table"><thead><tr><th>问题</th><th>员工（部门）</th><th>原因</th><th>时间</th><th>状态</th><th>操作</th></tr></thead><tbody id="feedback-followup-list"></tbody></table>' +
      '  </div>' +
      '</section>' +
      '<div class="service-grid">' +
      '  <section class="service-card">' +
      '    <div class="service-card-head">' +
      '      <h3 class="service-card-title">入职任务模板</h3>' +
      '      <button type="button" class="btn btn-ghost btn-sm" id="task-template-add">新增模板</button>' +
      '    </div>' +
      '    <div class="table-card">' +
      '      <table class="data-table"><thead><tr><th>名称</th><th>说明</th><th>截止天数</th><th>操作</th></tr></thead><tbody id="task-template-list"></tbody></table>' +
      '    </div>' +
      '  </section>' +
      '  <section class="service-card">' +
      '    <h3 class="service-card-title">分派入职任务</h3>' +
      '    <p class="service-hint">按员工入职日 + 相对天数生成日历截止日期；分派时保存当时的任务快照，之后修改模板不影响已分派任务。</p>' +
      '    <div class="field"><label for="task-assign-employee">员工</label><select class="input" id="task-assign-employee"></select></div>' +
      '    <div class="field"><label>任务模板</label><div class="task-assign-list" id="task-assign-templates"></div></div>' +
      '    <button type="button" class="btn btn-primary" id="task-assign-submit">分派任务</button>' +
      '  </section>' +
      '</div>' +
      '<section class="service-card">' +
      '  <h3 class="service-card-title">已分派的入职任务</h3>' +
      '  <div class="table-card">' +
      '    <table class="data-table inquiry-table"><thead><tr><th>员工（部门）</th><th>任务</th><th>截止日期</th><th>状态</th><th>完成时间</th></tr></thead><tbody id="task-assigned-list"></tbody></table>' +
      '  </div>' +
      '</section>' +
      '<p class="policy-note">员工勾选完成只代表本人确认，不代表外部系统已开通。</p>';
  }

  function renderServiceList(actor) {
    var tbody = document.getElementById('service-list');
    if (!tbody) return;

    var tickets = store.listTicketsForService(actor);
    if (!tickets.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="policy-empty">还没有员工提交工单。</td></tr>';
      return;
    }

    tbody.innerHTML = tickets.map(function (ticket) {
      var firstLine = String(ticket.summary || '').split('\n')[0];
      return '<tr>' +
        '<td class="inquiry-question">' + esc(ticket.title) +
        '<span class="inquiry-sub">' + esc(firstLine) + '</span></td>' +
        '<td>' + esc(ticket.employeeName) + '<span class="leave-account">' + esc(ticket.department) + '</span></td>' +
        '<td>' + ticketStatusBadge(ticket.status) + '</td>' +
        '<td>' + esc(ticket.assigneeName || '未指派') + '</td>' +
        '<td>' + esc(formatDateTime(ticket.updatedAt)) + '</td>' +
        '<td><button type="button" class="btn btn-ghost btn-sm" data-service-ticket="' + esc(ticket.id) + '">查看处理</button></td>' +
        '</tr>';
    }).join('');
  }

  function renderTaskTemplates(actor) {
    var tbody = document.getElementById('task-template-list');
    if (!tbody) return;

    var templates = store.listTaskTemplates(actor);
    if (!templates.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="policy-empty">还没有任务模板，先新增一个。</td></tr>';
      return;
    }

    tbody.innerHTML = templates.map(function (template) {
      return '<tr>' +
        '<td>' + esc(template.name) + '</td>' +
        '<td class="inquiry-question">' + esc(template.description || '—') + '</td>' +
        '<td>+' + esc(String(template.dueDays)) + ' 天</td>' +
        '<td>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-template-edit="' + esc(template.id) + '">编辑</button> ' +
        '<button type="button" class="btn btn-ghost btn-sm" data-template-delete="' + esc(template.id) + '">删除</button>' +
        '</td>' +
        '</tr>';
    }).join('');
  }

  function renderAssignTaskOptions(actor) {
    var employeeSelect = document.getElementById('task-assign-employee');
    var templateList = document.getElementById('task-assign-templates');
    if (!employeeSelect || !templateList) return;

    var employees = store.listUsers().filter(function (user) {
      return user && user.enabled !== false;
    });
    employeeSelect.innerHTML = employees.map(function (user) {
      return '<option value="' + esc(user.id) + '">' + esc(user.name) + '（' + esc(user.department) + '）</option>';
    }).join('');

    var templates = store.listTaskTemplates(actor);
    templateList.innerHTML = templates.length
      ? templates.map(function (template) {
        return '<label class="task-assign-item"><input type="checkbox" value="' + esc(template.id) + '"> ' +
          esc(template.name) + '<span>+' + esc(String(template.dueDays)) + ' 天</span></label>';
      }).join('')
      : '<p class="service-hint">还没有任务模板，请先新增。</p>';
  }

  function renderAssignedTasks(actor) {
    var tbody = document.getElementById('task-assigned-list');
    if (!tbody) return;

    var tasks = store.listAllOnboardingTasks(actor);
    if (!tasks.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="policy-empty">还没有分派过入职任务。</td></tr>';
      return;
    }

    tbody.innerHTML = tasks.map(function (task) {
      var state = onboardingTaskState(task);
      return '<tr>' +
        '<td>' + esc(task.employeeName) + '<span class="leave-account">' + esc(task.department) + '</span></td>' +
        '<td>' + esc(task.name) + '</td>' +
        '<td>' + esc(task.dueDate) + '</td>' +
        '<td><span class="task-status is-' + state.code + '">' + state.label + '</span></td>' +
        '<td>' + (task.completedAt ? esc(formatDateTime(task.completedAt)) : '—') + '</td>' +
        '</tr>';
    }).join('');
  }

  function refreshServiceTaskViews(actor) {
    renderTaskTemplates(actor);
    renderAssignTaskOptions(actor);
    renderAssignedTasks(actor);
  }

  function followupStatusBadge(code) {
    return '<span class="followup-status is-' + esc(code) + '">' + esc(store.feedbackFollowUpLabel(code)) + '</span>';
  }

  function renderFeedbackFollowups(actor) {
    var tbody = document.getElementById('feedback-followup-list');
    if (!tbody) return;

    var feedbacks = store.listNegativeFeedbacksForService(actor);
    var countEl = document.getElementById('feedback-followup-count');
    if (countEl) countEl.textContent = '共 ' + feedbacks.length + ' 条差评';

    if (!feedbacks.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="policy-empty">还没有差评反馈。</td></tr>';
      return;
    }

    tbody.innerHTML = feedbacks.map(function (feedback) {
      return '<tr>' +
        '<td class="inquiry-question">' + esc(feedback.question || '（未记录问题）') + '</td>' +
        '<td>' + esc(feedback.userName || '') + '<span class="leave-account">' + esc(feedback.department || '') + '</span></td>' +
        '<td>' + esc(feedback.reason || '—') + '</td>' +
        '<td>' + esc(formatDateTime(feedback.createdAt)) + '</td>' +
        '<td>' + followupStatusBadge(feedback.followUpStatus || 'pending') + '</td>' +
        '<td><button type="button" class="btn btn-ghost btn-sm" data-followup-feedback="' + esc(feedback.id) + '">查看跟进</button></td>' +
        '</tr>';
    }).join('');
  }

  function openFeedbackFollowUpModal(feedbackId) {
    var actor = store.currentUser();
    var feedback = store.getFeedbackForService(actor, feedbackId);
    if (!feedback) {
      toast('找不到这条反馈，或没有权限查看。');
      return;
    }

    var snapshot = feedback.answerSnapshot || {};
    var conclusions = (snapshot.conclusions || []).map(function (item) {
      return '<li>' + esc(item.text) + '</li>';
    }).join('');
    var citations = (snapshot.citations || []).map(function (citation) {
      return '<li>' + esc(citation.policyName) + ' · ' + esc(citation.version) + ' · ' + esc(citation.positionLabel) + '</li>';
    }).join('');
    var history = (feedback.followUpHistory || []).slice().reverse().map(function (entry) {
      return '<li>' +
        '<span class="ticket-event-time">' + esc(formatDateTime(entry.createdAt)) + '</span>' +
        '<span class="ticket-event-actor">' + esc(entry.actorName) + '</span>' +
        '<span class="ticket-event-text">' + esc(store.feedbackFollowUpLabel(entry.status)) + (entry.note ? '：' + esc(entry.note) : '') + '</span>' +
        '</li>';
    }).join('');
    var statusOptions = store.FEEDBACK_FOLLOWUP_STATUSES.map(function (item) {
      return '<option value="' + esc(item.code) + '"' + (item.code === (feedback.followUpStatus || 'pending') ? ' selected' : '') + '>' + esc(item.label) + '</option>';
    }).join('');
    var answerMeta = (snapshot.status ? '回答状态：' + esc(snapshot.status) : '') +
      (snapshot.modelName ? ' · 模型：' + esc(snapshot.modelName) : '');

    modalRoot.innerHTML = '' +
      '<div class="modal-overlay" id="followup-overlay">' +
      '  <div class="modal modal-wide" role="dialog" aria-modal="true" aria-labelledby="followup-title">' +
      '    <div class="modal-head">' +
      '      <h3 id="followup-title">反馈跟进</h3>' +
      '      <button type="button" class="icon-btn" data-close="1" aria-label="关闭">×</button>' +
      '    </div>' +
      '    <p class="modal-sub">' + esc(feedback.userName || '') + '（' + esc(feedback.department || '') + '） · ' +
      esc(formatDateTime(feedback.createdAt)) + ' · ' + followupStatusBadge(feedback.followUpStatus || 'pending') + '</p>' +
      '    <div class="feedback-followup-detail">' +
      '      <div class="feedback-followup-column">' +
      '        <h4 class="inquiry-detail-heading">原问题</h4>' +
      '        <p class="service-summary-text">' + esc(feedback.question || '（未记录问题）') + '</p>' +
      '        <h4 class="inquiry-detail-heading">原回答</h4>' +
      '        <p class="service-hint">' + (answerMeta || '（无回答信息）') + '</p>' +
      '        <ol class="inquiry-conclusions">' + (conclusions || '<li>（没有可展示的结论）</li>') + '</ol>' +
      '        <h4 class="inquiry-detail-heading">引用版本</h4>' +
      '        <ul class="followup-citation-list">' + (citations || '<li>（没有引用）</li>') + '</ul>' +
      '      </div>' +
      '      <div class="feedback-followup-column">' +
      '        <h4 class="inquiry-detail-heading">员工反馈</h4>' +
      '        <p class="followup-line"><span class="citation-label">原因：</span>' + esc(feedback.reason || '—') + '</p>' +
      '        <p class="followup-line"><span class="citation-label">补充说明：</span>' + esc(feedback.note || '—') + '</p>' +
      '        <h4 class="inquiry-detail-heading">处理记录</h4>' +
      '        <ul class="ticket-timeline-list">' + (history || '<li>还没有处理记录。</li>') + '</ul>' +
      '        <div class="field">' +
      '          <label for="followup-status">处理状态</label>' +
      '          <select class="input" id="followup-status">' + statusOptions + '</select>' +
      '        </div>' +
      '        <div class="field">' +
      '          <label for="followup-note">处理说明</label>' +
      '          <textarea class="input" id="followup-note" rows="3" maxlength="500" placeholder="记录处理方式或改进计划">' + esc(feedback.followUpNote || '') + '</textarea>' +
      '        </div>' +
      '        <div class="service-actions">' +
      '          <button type="button" class="btn btn-primary btn-sm" id="followup-save">保存跟进</button>' +
      '          <button type="button" class="btn btn-ghost btn-sm" id="followup-eval"' + (feedback.evalQuestionId ? ' disabled>已加入评测集' : '>加入评测集') + '</button>' +
      '        </div>' +
      '        <p class="service-hint">反馈不会自动修改制度或任何设置，改进必须由人确认。</p>' +
      '      </div>' +
      '    </div>' +
      '    <div class="modal-foot"><button type="button" class="btn btn-primary" data-close="1">关闭</button></div>' +
      '  </div>' +
      '</div>';

    var overlay = document.getElementById('followup-overlay');
    wireModalClose(overlay);

    document.getElementById('followup-save').addEventListener('click', function () {
      var result = store.updateFeedbackFollowUp(actor, feedback.id, {
        status: document.getElementById('followup-status').value,
        note: document.getElementById('followup-note').value
      });
      if (!result.ok) {
        toast(result.message);
        return;
      }
      toast('已保存反馈处理记录');
      renderFeedbackFollowups(actor);
      openFeedbackFollowUpModal(feedback.id);
    });

    document.getElementById('followup-eval').addEventListener('click', function () {
      openEvalQuestionModal(feedback);
    });
  }

  function openEvalQuestionModal(feedback) {
    var actor = store.currentUser();

    modalRoot.innerHTML = '' +
      '<div class="modal-overlay" id="eval-overlay">' +
      '  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="eval-title">' +
      '    <div class="modal-head">' +
      '      <h3 id="eval-title">加入评测集</h3>' +
      '      <button type="button" class="icon-btn" data-close="1" aria-label="关闭">×</button>' +
      '    </div>' +
      '    <p class="modal-sub">把这道差评问题保存成以后可以反复测试的题目。保存前请人工确认题目里已经去掉敏感内容（姓名、联系方式、工号等）。评测集本身在阶段 10 完善。</p>' +
      '    <div class="form-error" id="eval-error" role="alert"></div>' +
      '    <div class="field">' +
      '      <label for="eval-question">评测题目（可以修改）</label>' +
      '      <textarea class="input" id="eval-question" rows="4" maxlength="300">' + esc(feedback.question || '') + '</textarea>' +
      '    </div>' +
      '    <label class="eval-confirm"><input type="checkbox" id="eval-confirm"> 我已确认已去除敏感内容（姓名、联系方式、工号等）</label>' +
      '    <div class="modal-foot">' +
      '      <button type="button" class="btn btn-ghost" data-close="1">取消</button>' +
      '      <button type="button" class="btn btn-primary" id="eval-save">保存到评测集</button>' +
      '    </div>' +
      '  </div>' +
      '</div>';

    var overlay = document.getElementById('eval-overlay');
    var closeModal = wireModalClose(overlay);
    var errEl = document.getElementById('eval-error');

    document.getElementById('eval-save').addEventListener('click', function () {
      hideError(errEl);

      var confirmed = document.getElementById('eval-confirm').checked;
      if (!confirmed) {
        showError(errEl, '请先确认已去除敏感内容。');
        return;
      }

      var question = document.getElementById('eval-question').value;
      var result = store.addEvaluationQuestion(actor, feedback.id, { question: question, confirmed: true });
      if (!result.ok) {
        showError(errEl, result.message);
        return;
      }

      closeModal();
      toast('已保存为评测题（评测集将在阶段 10 完善）');
      renderFeedbackFollowups(store.currentUser());
    });
  }


  function openTaskTemplateModal(templateId) {
    var actor = store.currentUser();
    var templates = store.listTaskTemplates(actor);
    var template = null;
    for (var i = 0; i < templates.length; i++) {
      if (templates[i].id === templateId) {
        template = templates[i];
        break;
      }
    }

    var isEdit = !!template;
    var name = isEdit ? template.name : '';
    var description = isEdit ? template.description : '';
    var dueDays = isEdit ? template.dueDays : 3;

    modalRoot.innerHTML = '' +
      '<div class="modal-overlay" id="template-overlay">' +
      '  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="template-title">' +
      '    <div class="modal-head">' +
      '      <h3 id="template-title">' + (isEdit ? '编辑入职任务模板' : '新增入职任务模板') + '</h3>' +
      '      <button type="button" class="icon-btn" data-close="1" aria-label="关闭">×</button>' +
      '    </div>' +
      '    <p class="modal-sub">截止天数按员工入职日之后的日历日计算，例如入职日 +3 天。修改模板不会改动已分派任务。</p>' +
      '    <div class="form-error" id="template-error" role="alert"></div>' +
      '    <div class="field"><label for="template-name">名称</label><input class="input" id="template-name" type="text" maxlength="40" value="' + esc(name) + '" placeholder="例如：签署劳动合同"></div>' +
      '    <div class="field"><label for="template-description">说明</label><textarea class="input" id="template-description" rows="3" maxlength="300" placeholder="这项任务要做什么、去哪里办理">' + esc(description) + '</textarea></div>' +
      '    <div class="field"><label for="template-due-days">相对入职日的截止天数</label><input class="input" id="template-due-days" type="number" min="0" max="365" step="1" value="' + esc(String(dueDays)) + '"></div>' +
      '    <div class="modal-foot">' +
      '      <button type="button" class="btn btn-ghost" data-close="1">取消</button>' +
      '      <button type="button" class="btn btn-primary" id="template-save">保存</button>' +
      '    </div>' +
      '  </div>' +
      '</div>';

    var overlay = document.getElementById('template-overlay');
    var closeModal = wireModalClose(overlay);
    var errEl = document.getElementById('template-error');

    document.getElementById('template-save').addEventListener('click', function () {
      hideError(errEl);

      var payload = {
        name: document.getElementById('template-name').value,
        description: document.getElementById('template-description').value,
        dueDays: document.getElementById('template-due-days').value
      };

      var result = isEdit
        ? store.updateTaskTemplate(actor, template.id, payload)
        : store.createTaskTemplate(actor, payload);

      if (!result.ok) {
        showError(errEl, result.message);
        return;
      }

      closeModal();
      toast(isEdit ? '模板已更新' : '模板已新增');
      refreshServiceTaskViews(store.currentUser());
    });
  }

  function openServiceTicketModal(ticketId) {
    var actor = store.currentUser();
    var ticket = store.getTicketForActor(actor, ticketId);
    if (!ticket) {
      toast('找不到这张工单，或没有权限查看。');
      return;
    }

    var users = store.listUsers().filter(function (user) {
      return user && user.enabled !== false;
    });
    var assignOptions = users.map(function (user) {
      return '<option value="' + esc(user.id) + '"' + (user.id === ticket.assigneeId ? ' selected' : '') + '>' +
        esc(user.name) + '（' + esc(user.department) + '）</option>';
    }).join('');
    var statusOptions = store.TICKET_STATUSES.map(function (item) {
      return '<option value="' + esc(item.code) + '"' + (item.code === ticket.status ? ' selected' : '') + '>' + esc(item.label) + '</option>';
    }).join('');
    var summaryHtml = esc(ticket.summary).replace(/\n/g, '<br>');

    modalRoot.innerHTML = '' +
      '<div class="modal-overlay" id="service-overlay">' +
      '  <div class="modal modal-wide" role="dialog" aria-modal="true" aria-labelledby="service-title">' +
      '    <div class="modal-head">' +
      '      <h3 id="service-title">工单处理</h3>' +
      '      <button type="button" class="icon-btn" data-close="1" aria-label="关闭">×</button>' +
      '    </div>' +
      '    <p class="modal-sub">' + esc(ticket.employeeName) + '（' + esc(ticket.department) + '） · ' +
      '提交于 ' + esc(formatDateTime(ticket.createdAt)) + ' · ' + ticketStatusBadge(ticket.status) + '</p>' +
      '    <div class="service-detail">' +
      '      <div class="service-summary">' +
      '        <h4 class="inquiry-detail-heading">事项摘要（员工确认过）</h4>' +
      '        <p class="service-summary-text">' + summaryHtml + '</p>' +
      '      </div>' +
      '      <div class="service-timeline">' +
      '        <h4 class="inquiry-detail-heading">时间线</h4>' + ticketTimelineHtml(ticket) +
      '      </div>' +
      '    </div>' +
      '    <div class="service-controls">' +
      '      <div class="field">' +
      '        <label for="service-assign">指派经办人</label>' +
      '        <select class="input" id="service-assign">' + assignOptions + '</select>' +
      '        <button type="button" class="btn btn-ghost btn-sm" id="service-assign-save">保存指派</button>' +
      '      </div>' +
      '      <div class="field">' +
      '        <label for="service-status">修改状态</label>' +
      '        <select class="input" id="service-status">' + statusOptions + '</select>' +
      '        <button type="button" class="btn btn-ghost btn-sm" id="service-status-save">保存状态</button>' +
      '      </div>' +
      '      <div class="field">' +
      '        <label for="service-reply">回复员工</label>' +
      '        <textarea class="input" id="service-reply" rows="3" maxlength="500" placeholder="写下处理结果或需要员工补充的信息"></textarea>' +
      '        <button type="button" class="btn btn-ghost btn-sm" id="service-reply-save">提交回复</button>' +
      '      </div>' +
      '    </div>' +
      '    <div class="modal-foot"><button type="button" class="btn btn-primary" data-close="1">关闭</button></div>' +
      '  </div>' +
      '</div>';

    var overlay = document.getElementById('service-overlay');
    wireModalClose(overlay);

    function afterAction(result, successMessage) {
      if (!result.ok) {
        toast(result.message);
        return;
      }
      toast(successMessage);
      renderServiceList(store.currentUser());
      openServiceTicketModal(ticketId);
    }

    document.getElementById('service-assign-save').addEventListener('click', function () {
      var assigneeId = document.getElementById('service-assign').value;
      afterAction(store.assignTicket(store.currentUser(), ticketId, assigneeId), '已指派经办人');
    });

    document.getElementById('service-status-save').addEventListener('click', function () {
      var status = document.getElementById('service-status').value;
      afterAction(store.updateTicketStatus(store.currentUser(), ticketId, status), '已更新工单状态');
    });

    document.getElementById('service-reply-save').addEventListener('click', function () {
      var text = document.getElementById('service-reply').value;
      afterAction(store.replyTicket(store.currentUser(), ticketId, text), '已回复员工');
    });
  }

  function wireServicePage() {
    var page = document.getElementById('page-content');
    if (!page) return;

    page.addEventListener('click', function (event) {
      var target = event.target;
      if (!target || !target.closest) return;

      var followupBtn = target.closest('[data-followup-feedback]');
      if (followupBtn) {
        openFeedbackFollowUpModal(followupBtn.getAttribute('data-followup-feedback'));
        return;
      }

      var serviceBtn = target.closest('[data-service-ticket]');
      if (serviceBtn) {
        openServiceTicketModal(serviceBtn.getAttribute('data-service-ticket'));
        return;
      }

      if (target.closest('#task-template-add')) {
        openTaskTemplateModal('');
        return;
      }

      var editBtn = target.closest('[data-template-edit]');
      if (editBtn) {
        openTaskTemplateModal(editBtn.getAttribute('data-template-edit'));
        return;
      }

      var deleteBtn = target.closest('[data-template-delete]');
      if (deleteBtn) {
        var templateId = deleteBtn.getAttribute('data-template-delete');
        openConfirmModal({
          title: '删除入职任务模板',
          message: '删除模板不会影响已经分派给员工的任务（任务保存的是当时的快照）。确定删除吗？',
          confirmText: '删除',
          danger: true,
          onConfirm: function () {
            var result = store.deleteTaskTemplate(store.currentUser(), templateId);
            if (!result.ok) {
              toast(result.message);
              return;
            }
            toast('已删除模板');
            refreshServiceTaskViews(store.currentUser());
          }
        });
        return;
      }

      if (target.closest('#task-assign-submit')) {
        var employeeSelect = document.getElementById('task-assign-employee');
        var checked = Array.prototype.slice.call(document.querySelectorAll('#task-assign-templates input[type="checkbox"]:checked')).map(function (box) {
          return box.value;
        });
        var assigned = store.assignOnboardingTasks(store.currentUser(), employeeSelect ? employeeSelect.value : '', checked);
        if (!assigned.ok) {
          toast(assigned.message);
          return;
        }
        toast('已分派 ' + assigned.created.length + ' 项任务' +
          (assigned.skipped.length ? '，跳过 ' + assigned.skipped.length + ' 项（之前已分派过）' : ''));
        refreshServiceTaskViews(store.currentUser());
      }
    });
  }

  /* ================== 消息与待办（员工） ================== */

  function messagesHtml(actor) {
    var items = store.listMyMessages(actor);
    var unread = items.filter(function (item) { return !item.read; }).length;
    var pending = items.filter(function (item) { return !item.completed; }).length;

    return '' +
      '<section class="page-head">' +
      '  <div>' +
      '    <h2 class="page-head-title">消息与待办</h2>' +
      '    <p class="page-head-sub">汇总与你有关的入职任务、工单更新、反馈处理和待签收制度；打开页面时读取最新内容</p>' +
      '  </div>' +
      '</section>' +
      '<div class="messages-toolbar">' +
      '  <span class="messages-summary" id="messages-summary">共 ' + items.length + ' 项 · 未读 ' + unread + ' 项 · 待完成 ' + pending + ' 项</span>' +
      '  <div class="messages-actions">' +
      '    <button type="button" class="btn btn-ghost btn-sm" id="messages-refresh">刷新</button>' +
      '    <button type="button" class="btn btn-primary btn-sm" id="messages-read-all">全部标为已读</button>' +
      '  </div>' +
      '</div>' +
      '<div class="messages-list" id="messages-list"></div>' +
      '<p class="policy-note">“已读”表示你看过；“完成”表示业务上已经办结，两者分开记录、分开操作。只显示你自己的事项。</p>';
  }

  function renderMessagesList(actor) {
    var list = document.getElementById('messages-list');
    if (!list) return;

    var items = store.listMyMessages(actor);
    var summary = document.getElementById('messages-summary');
    if (summary) {
      var unread = items.filter(function (item) { return !item.read; }).length;
      var pending = items.filter(function (item) { return !item.completed; }).length;
      summary.textContent = '共 ' + items.length + ' 项 · 未读 ' + unread + ' 项 · 待完成 ' + pending + ' 项';
    }

    if (!items.length) {
      list.innerHTML = '<div class="ticket-empty">目前没有与你相关的待办或消息。</div>';
      return;
    }

    list.innerHTML = items.map(function (item) {
      return '<article class="message-item' + (item.read ? '' : ' is-unread') + (item.completed ? ' is-completed' : '') + '" data-message-key="' + esc(item.key) + '">' +
        '<div class="message-main">' +
        '  <span class="message-type">' + esc(item.type) + '</span>' +
        '  <p class="message-title">' + esc(item.title) + '</p>' +
        '  <p class="message-detail">' + esc(item.detail || '') + '</p>' +
        '</div>' +
        '<div class="message-side">' +
        '  <span class="message-time">' + esc(formatDateTime(item.time)) + '</span>' +
        '  <span class="message-read ' + (item.read ? 'is-read' : 'is-unread') + '">' + (item.read ? '已读' : '未读') + '</span>' +
        '  <span class="message-business ' + (item.completed ? 'is-done' : 'is-pending') + '">' + esc(item.statusLabel) + '</span>' +
        '  <div class="message-actions">' +
        (item.read ? '' : '<button type="button" class="btn btn-ghost btn-sm" data-message-read="' + esc(item.key) + '">标为已读</button>') +
        (item.actionType === 'task' && !item.completed
          ? '<button type="button" class="btn btn-primary btn-sm" data-message-complete="' + esc(item.target.taskId) + '">标记完成</button>'
          : '') +
        '    <button type="button" class="btn btn-ghost btn-sm" data-message-open="' + esc(item.key) + '">去处理</button>' +
        '  </div>' +
        '</div>' +
        '</article>';
    }).join('');
  }

  function openMessageTarget(item) {
    if (!item) return;
    var actor = store.currentUser();
    if (!actor) return;

    store.markMessageRead(actor, item.key);
    var target = item.target || {};

    if (item.actionType === 'feedback') {
      if (target.sessionId) chatState.sessionId = target.sessionId;
      go('assistant');
      return;
    }

    if (item.actionType === 'policy') {
      go('policyCenter');
      openPolicyCenterDetail(target.policyId);
      return;
    }

    if (item.actionType === 'signoff') {
      go('mySignoffs');
      openMySignoffReadModal(target.campaignId);
      return;
    }

    go('tickets');
    var selector = '';
    if (item.actionType === 'task') selector = '[data-onboarding-task-id="' + target.taskId + '"]';
    else if (item.actionType === 'ticket') selector = '[data-ticket-card-id="' + target.ticketId + '"]';
    if (!selector) return;

    var focusTarget = function () {
      var element = document.querySelector(selector);
      if (!element) return;
      element.classList.add('is-focused');
      if (element.scrollIntoView) {
        try {
          element.scrollIntoView({ block: 'center', behavior: 'smooth' });
        } catch (error) {
          try { element.scrollIntoView(); } catch (ignored) { /* 忽略 */ }
        }
      }
    };

    focusTarget();
    // 页面路由/哈希变化可能再渲染一次，稍后再聚焦一次，保证定位到对应工单/任务
    window.setTimeout(focusTarget, 120);
  }

  function wireMessagesPage() {
    var list = document.getElementById('messages-list');
    if (!list) return;

    var actor = store.currentUser();

    var refreshBtn = document.getElementById('messages-refresh');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', function () {
        toast('已刷新，显示最新事项');
        route();
      });
    }

    var readAllBtn = document.getElementById('messages-read-all');
    if (readAllBtn) {
      readAllBtn.addEventListener('click', function () {
        var result = store.markAllMessagesRead(actor);
        if (!result.ok) {
          toast(result.message);
          return;
        }
        toast('已把 ' + result.count + ' 项标为已读');
        route();
      });
    }

    list.addEventListener('click', function (event) {
      var target = event.target;
      if (!target || !target.closest) return;

      var readBtn = target.closest('[data-message-read]');
      if (readBtn) {
        store.markMessageRead(actor, readBtn.getAttribute('data-message-read'));
        route();
        return;
      }

      var completeBtn = target.closest('[data-message-complete]');
      if (completeBtn) {
        var completeResult = store.completeOnboardingTask(actor, completeBtn.getAttribute('data-message-complete'));
        if (!completeResult.ok) {
          toast(completeResult.message);
          return;
        }
        toast('已标记完成（仅代表你本人确认）');
        route();
        return;
      }

      var openBtn = target.closest('[data-message-open]');
      var key = openBtn ? openBtn.getAttribute('data-message-open') : '';
      if (!key) {
        var row = target.closest('[data-message-key]');
        key = row ? row.getAttribute('data-message-key') : '';
      }
      if (!key) return;

      var items = store.listMyMessages(actor);
      for (var i = 0; i < items.length; i++) {
        if (items[i].key === key) {
          openMessageTarget(items[i]);
          return;
        }
      }
    });
  }

  /* ================== 制度更新与签收（HR） ================== */

  function signoffAdminHtml(actor) {
    return '' +
      '<section class="page-head">' +
      '  <div>' +
      '    <h2 class="page-head-title">制度更新与签收</h2>' +
      '    <p class="page-head-sub">对已发布制度发起签收：先看版本差异，再选范围；发起时保存完整正文快照</p>' +
      '  </div>' +
      '</section>' +
      '<section class="service-card">' +
      '  <h3 class="service-card-title">已发布制度</h3>' +
      '  <div class="table-card">' +
      '    <table class="data-table inquiry-table"><thead><tr><th>制度名称</th><th>版本</th><th>适用范围</th><th>操作</th></tr></thead><tbody id="signoff-policy-list"></tbody></table>' +
      '  </div>' +
      '</section>' +
      '<section class="service-card">' +
      '  <h3 class="service-card-title">签收活动</h3>' +
      '  <div class="table-card">' +
      '    <table class="data-table inquiry-table"><thead><tr><th>制度</th><th>版本</th><th>签收范围</th><th>发起时间</th><th>应签收</th><th>已签收</th><th>完成比例</th><th>操作</th></tr></thead><tbody id="signoff-campaign-list"></tbody></table>' +
      '  </div>' +
      '</section>' +
      '<p class="policy-note">发起时会把当时的制度正文完整保存为不可更改的快照；收件人按发起那一刻的名单确定，之后新入职员工不会自动加入。签收只代表员工已知悉制度内容。</p>';
  }

  function renderSignoffAdmin(actor) {
    var policyBody = document.getElementById('signoff-policy-list');
    var campaignBody = document.getElementById('signoff-campaign-list');
    if (!policyBody || !campaignBody) return;

    var policies = store.listPolicies().filter(function (policy) {
      return policy && policy.status === 'published';
    });
    if (!policies.length) {
      policyBody.innerHTML = '<tr><td colspan="4" class="policy-empty">还没有已发布的制度。</td></tr>';
    } else {
      policyBody.innerHTML = policies.map(function (policy) {
        return '<tr>' +
          '<td>' + esc(policy.name) + '</td>' +
          '<td>' + esc(policy.version) + '</td>' +
          '<td>' + esc(policy.scope) + '</td>' +
          '<td><button type="button" class="btn btn-ghost btn-sm" data-signoff-start="' + esc(policy.id) + '">发起签收</button></td>' +
          '</tr>';
      }).join('');
    }

    var campaigns = store.listSignoffCampaigns(actor);
    if (!campaigns.length) {
      campaignBody.innerHTML = '<tr><td colspan="8" class="policy-empty">还没有发起过签收。</td></tr>';
      return;
    }

    campaignBody.innerHTML = campaigns.map(function (campaign) {
      var required = campaign.recipients.length;
      var signed = campaign.signatures.length;
      var percent = required ? Math.round((signed / required) * 100) : 0;
      return '<tr>' +
        '<td>' + esc(campaign.policyName) + '</td>' +
        '<td>' + esc(campaign.snapshotVersion) + '</td>' +
        '<td>' + esc(campaign.scope) + '</td>' +
        '<td>' + esc(formatDateTime(campaign.createdAt)) + '</td>' +
        '<td>' + required + '</td>' +
        '<td>' + signed + '</td>' +
        '<td>' + percent + '%</td>' +
        '<td><button type="button" class="btn btn-ghost btn-sm" data-signoff-progress="' + esc(campaign.id) + '">查看未签收</button></td>' +
        '</tr>';
    }).join('');
  }

  function signoffDiffHtml(preview) {
    var diff = preview.diff || { added: [], removed: [], changed: [] };
    var html = '';

    if (!preview.hasPrevious) {
      html += '<p class="signoff-note">没有找到上一版本，本次按首次发布处理，全部正文视为新增。</p>';
    }

    function lineList(title, className, lines) {
      if (!lines.length) return '';
      var sliced = lines.slice(0, 30);
      return '<div class="signoff-diff-block"><p class="signoff-diff-title ' + className + '">' + title + '（' + lines.length + '）</p><ul>' +
        sliced.map(function (line) {
          return '<li>' + esc(line) + '</li>';
        }).join('') +
        (lines.length > sliced.length ? '<li>……还有 ' + (lines.length - sliced.length) + ' 行</li>' : '') +
        '</ul></div>';
    }

    html += lineList('新增内容', 'is-added', diff.added);
    html += lineList('删除内容', 'is-removed', diff.removed);
    if (diff.changed.length) {
      html += '<div class="signoff-diff-block"><p class="signoff-diff-title is-changed">修改内容（' + diff.changed.length + '）</p><ul>' +
        diff.changed.slice(0, 30).map(function (item) {
          return '<li><span class="diff-from">原：' + esc(item.from) + '</span><span class="diff-to">新：' + esc(item.to) + '</span></li>';
        }).join('') + '</ul></div>';
    }

    if (!diff.added.length && !diff.removed.length && !diff.changed.length) {
      html += '<p class="signoff-note">与上一版本相比没有变化。</p>';
    }

    return html;
  }

  function openStartSignoffModal(policyId) {
    var actor = store.currentUser();
    var preview = store.previewSignoffDiff(actor, policyId);
    if (!preview.ok) {
      toast(preview.message);
      return;
    }

    var departments = store.getDepartments();
    var scopeOptions = ['全员'].concat(departments).map(function (scope) {
      return '<option value="' + esc(scope) + '">' + esc(scope) + '</option>';
    }).join('');

    modalRoot.innerHTML = '' +
      '<div class="modal-overlay" id="signoff-start-overlay">' +
      '  <div class="modal modal-wide" role="dialog" aria-modal="true" aria-labelledby="signoff-start-title">' +
      '    <div class="modal-head">' +
      '      <h3 id="signoff-start-title">发起签收 · ' + esc(preview.policy.name) + '</h3>' +
      '      <button type="button" class="icon-btn" data-close="1" aria-label="关闭">×</button>' +
      '    </div>' +
      '    <p class="modal-sub">当前版本 ' + esc(preview.policy.version) + '。下面是相对上一版本的内容差异；确认后会把当前完整正文保存为不可更改的快照。</p>' +
      '    <div class="form-error" id="signoff-start-error" role="alert"></div>' +
      '    <div class="signoff-diff">' + signoffDiffHtml(preview) + '</div>' +
      '    <div class="field">' +
      '      <label for="signoff-scope">签收范围</label>' +
      '      <select class="input" id="signoff-scope">' + scopeOptions + '</select>' +
      '      <p class="hint">收件人以发起这一刻的名单为准，之后新入职员工不会自动加入。</p>' +
      '    </div>' +
      '    <div class="modal-foot">' +
      '      <button type="button" class="btn btn-ghost" data-close="1">取消</button>' +
      '      <button type="button" class="btn btn-primary" id="signoff-start-confirm">确认发起</button>' +
      '    </div>' +
      '  </div>' +
      '</div>';

    var overlay = document.getElementById('signoff-start-overlay');
    var closeModal = wireModalClose(overlay);
    var errEl = document.getElementById('signoff-start-error');

    document.getElementById('signoff-start-confirm').addEventListener('click', function () {
      hideError(errEl);
      var result = store.createSignoffCampaign(actor, {
        policyId: policyId,
        scope: document.getElementById('signoff-scope').value
      });
      if (!result.ok) {
        showError(errEl, result.message);
        return;
      }
      closeModal();
      toast('已发起签收，共 ' + result.campaign.recipients.length + ' 人');
      route();
    });
  }

  function openSignoffProgressModal(campaignId) {
    var actor = store.currentUser();
    var campaign = store.getSignoffCampaignForActor(actor, campaignId);
    if (!campaign) {
      toast('找不到这次签收活动，或没有权限查看。');
      return;
    }

    var signedMap = {};
    campaign.signatures.forEach(function (signature) { signedMap[signature.userId] = signature; });
    var unsigned = campaign.recipients.filter(function (recipient) { return !signedMap[recipient.userId]; });
    var required = campaign.recipients.length;
    var signed = campaign.signatures.length;
    var percent = required ? Math.round((signed / required) * 100) : 0;

    var unsignedHtml = unsigned.length
      ? unsigned.map(function (recipient) {
        return '<li>' + esc(recipient.name) + '（' + esc(recipient.account) + ' · ' + esc(recipient.department) + '）</li>';
      }).join('')
      : '<li>所有人都已签收。</li>';

    var signedHtml = campaign.signatures.length
      ? campaign.signatures.map(function (signature) {
        return '<li>' + esc(signature.name) + '（' + esc(signature.department) + '） · ' + esc(formatDateTime(signature.signedAt)) + ' · 版本 ' + esc(signature.version) + '</li>';
      }).join('')
      : '<li>还没有人签收。</li>';

    modalRoot.innerHTML = '' +
      '<div class="modal-overlay" id="signoff-progress-overlay">' +
      '  <div class="modal modal-wide" role="dialog" aria-modal="true" aria-labelledby="signoff-progress-title">' +
      '    <div class="modal-head">' +
      '      <h3 id="signoff-progress-title">签收进度 · ' + esc(campaign.policyName) + '</h3>' +
      '      <button type="button" class="icon-btn" data-close="1" aria-label="关闭">×</button>' +
      '    </div>' +
      '    <p class="modal-sub">版本 ' + esc(campaign.snapshotVersion) + ' · 范围 ' + esc(campaign.scope) + ' · 发起于 ' + esc(formatDateTime(campaign.createdAt)) +
      ' · 完成 ' + signed + '/' + required + '（' + percent + '%）</p>' +
      '    <div class="signoff-progress-two">' +
      '      <div><h4 class="inquiry-detail-heading">未签收名单（' + unsigned.length + '）</h4><ul class="signoff-name-list">' + unsignedHtml + '</ul></div>' +
      '      <div><h4 class="inquiry-detail-heading">已签收（' + signed + '）</h4><ul class="signoff-name-list">' + signedHtml + '</ul></div>' +
      '    </div>' +
      '    <p class="signoff-note">签收只代表员工已知悉制度内容，不代表掌握程度或考试通过。</p>' +
      '    <div class="modal-foot"><button type="button" class="btn btn-primary" data-close="1">关闭</button></div>' +
      '  </div>' +
      '</div>';

    wireModalClose(document.getElementById('signoff-progress-overlay'));
  }

  function wireSignoffAdminPage() {
    var page = document.getElementById('page-content');
    if (!page) return;

    page.addEventListener('click', function (event) {
      var target = event.target;
      if (!target || !target.closest) return;

      var startBtn = target.closest('[data-signoff-start]');
      if (startBtn) {
        openStartSignoffModal(startBtn.getAttribute('data-signoff-start'));
        return;
      }

      var progressBtn = target.closest('[data-signoff-progress]');
      if (progressBtn) {
        openSignoffProgressModal(progressBtn.getAttribute('data-signoff-progress'));
      }
    });
  }

  /* ================== 我的制度签收（员工） ================== */

  function mySignoffsHtml(actor) {
    return '' +
      '<section class="page-head">' +
      '  <div>' +
      '    <h2 class="page-head-title">我的制度签收</h2>' +
      '    <p class="page-head-sub">阅读需要你签收的制度，确认已知悉内容</p>' +
      '  </div>' +
      '</section>' +
      '<div id="my-signoff-pending"></div>' +
      '<div id="my-signoff-signed"></div>' +
      '<p class="policy-note">签收只代表你已知悉该制度的内容，不代表掌握程度或考试通过；签收时间和版本会被记录。</p>';
  }

  function renderMySignoffs(actor) {
    var pendingBox = document.getElementById('my-signoff-pending');
    var signedBox = document.getElementById('my-signoff-signed');
    if (!pendingBox || !signedBox) return;

    var campaigns = store.listSignoffCampaigns(actor);
    var pending = [];
    var signed = [];
    campaigns.forEach(function (campaign) {
      if (store.campaignSignatureFor(campaign, actor.id)) signed.push(campaign);
      else pending.push(campaign);
    });

    pendingBox.innerHTML = '<div class="ticket-section"><h3 class="ticket-section-title">待我签收（' + pending.length + '）</h3>' +
      (pending.length
        ? pending.map(function (campaign) {
          return '<article class="signoff-card">' +
            '<div class="ticket-card-head"><h4 class="ticket-title">' + esc(campaign.policyName) + '</h4><span class="ticket-status is-pending">待签收</span></div>' +
            '<p class="ticket-meta">版本 ' + esc(campaign.snapshotVersion) + ' · 范围 ' + esc(campaign.scope) + ' · 发起于 ' + esc(formatDateTime(campaign.createdAt)) + '</p>' +
            '<button type="button" class="btn btn-primary btn-sm" data-signoff-read="' + esc(campaign.id) + '">阅读并签收</button>' +
            '</article>';
        }).join('')
        : '<div class="ticket-empty">目前没有需要你签收的制度。</div>') +
      '</div>';

    signedBox.innerHTML = '<div class="ticket-section"><h3 class="ticket-section-title">已签收（' + signed.length + '）</h3>' +
      (signed.length
        ? signed.map(function (campaign) {
          var signature = store.campaignSignatureFor(campaign, actor.id);
          return '<article class="signoff-card is-signed">' +
            '<div class="ticket-card-head"><h4 class="ticket-title">' + esc(campaign.policyName) + '</h4><span class="ticket-status is-resolved">已签收</span></div>' +
            '<p class="ticket-meta">版本 ' + esc(campaign.snapshotVersion) + ' · 签收于 ' + esc(formatDateTime(signature.signedAt)) + '</p>' +
            '<button type="button" class="btn btn-ghost btn-sm" data-signoff-read="' + esc(campaign.id) + '">查看正文</button>' +
            '</article>';
        }).join('')
        : '<div class="ticket-empty">还没有签收记录。</div>') +
      '</div>';
  }

  function openMySignoffReadModal(campaignId) {
    var actor = store.currentUser();
    var campaign = store.getSignoffCampaignForActor(actor, campaignId);
    if (!campaign) {
      toast('找不到这次签收活动，或没有权限查看。');
      return;
    }

    var signature = store.campaignSignatureFor(campaign, actor.id);

    modalRoot.innerHTML = '' +
      '<div class="modal-overlay" id="my-signoff-overlay">' +
      '  <div class="modal modal-wide" role="dialog" aria-modal="true" aria-labelledby="my-signoff-title">' +
      '    <div class="modal-head">' +
      '      <h3 id="my-signoff-title">' + esc(campaign.policyName) + '</h3>' +
      '      <button type="button" class="icon-btn" data-close="1" aria-label="关闭">×</button>' +
      '    </div>' +
      '    <p class="modal-sub">版本 ' + esc(campaign.snapshotVersion) + ' · 范围 ' + esc(campaign.scope) + ' · 发起于 ' + esc(formatDateTime(campaign.createdAt)) + '</p>' +
      '    <p class="signoff-disclaimer">签收只代表你已知悉该制度的内容，不代表掌握程度或考试通过。</p>' +
      '    <pre class="policy-preview signoff-snapshot">' + esc(campaign.snapshotText) + '</pre>' +
      '    <div class="modal-foot">' +
      '      <button type="button" class="btn btn-ghost" data-close="1">关闭</button>' +
      (signature
        ? '<span class="signoff-signed-text">已于 ' + esc(formatDateTime(signature.signedAt)) + ' 签收（版本 ' + esc(signature.version) + '）</span>'
        : '<button type="button" class="btn btn-primary" id="my-signoff-confirm">我已阅读并确认</button>') +
      '    </div>' +
      '  </div>' +
      '</div>';

    var overlay = document.getElementById('my-signoff-overlay');
    var closeModal = wireModalClose(overlay);
    var confirmBtn = document.getElementById('my-signoff-confirm');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', function () {
        var result = store.signSignoffCampaign(actor, campaign.id);
        if (!result.ok) {
          toast(result.message);
          return;
        }
        closeModal();
        toast('已签收，已记录签收时间与版本');
        route();
      });
    }
  }

  function wireMySignoffsPage() {
    var page = document.getElementById('page-content');
    if (!page) return;
    page.addEventListener('click', function (event) {
      var btn = event.target && event.target.closest ? event.target.closest('[data-signoff-read]') : null;
      if (!btn) return;
      openMySignoffReadModal(btn.getAttribute('data-signoff-read'));
    });
  }

  /* ================== 知识缺口诊断（管理工作台） ================== */

  function gapStatusBadge(code) {
    return '<span class="gap-status is-' + esc(code) + '">' + esc(store.gapStatusLabel(code)) + '</span>';
  }

  function knowledgeGapsHtml(actor) {
    return '' +
      '<section class="page-head">' +
      '  <div>' +
      '    <h2 class="page-head-title">知识缺口诊断</h2>' +
      '    <p class="page-head-sub">汇总回答依据不足、员工反馈没有帮助、被转人工的问题，归组后跟进补充</p>' +
      '  </div>' +
      '</section>' +
      '<p class="gap-group-note">说明：目前按关键词相近归组，不是真正的语义聚类，不同说法可能被分成不同组。</p>' +
      '<div class="messages-toolbar">' +
      '  <span class="messages-summary" id="knowledge-gap-summary"></span>' +
      '</div>' +
      '<div class="knowledge-gap-list" id="knowledge-gap-list"></div>';
  }

  function renderKnowledgeGaps(actor) {
    var list = document.getElementById('knowledge-gap-list');
    if (!list) return;

    var gaps = store.listKnowledgeGaps(actor);
    var summary = document.getElementById('knowledge-gap-summary');
    var occurrences = gaps.reduce(function (sum, gap) { return sum + gap.count; }, 0);
    if (summary) summary.textContent = '共 ' + gaps.length + ' 个缺口事项 · ' + occurrences + ' 次出现';

    if (!gaps.length) {
      list.innerHTML = '<div class="ticket-empty">还没有知识缺口。员工回答依据不足、点“没有帮助”或转人工后会自动出现在这里。</div>';
      return;
    }

    list.innerHTML = gaps.map(function (gap) {
      var assignee = gap.assigneeName ? esc(gap.assigneeName) : '<span class="gap-unassigned">未指派</span>';
      return '<article class="knowledge-gap-item">' +
        '<div class="knowledge-gap-main">' +
        '  <p class="knowledge-gap-title">' + esc(gap.title) + '</p>' +
        '  <div class="knowledge-gap-meta">' +
        gap.sources.map(function (source) {
          return '<span class="gap-source">' + esc(source) + '</span>';
        }).join('') +
        '    <span class="knowledge-gap-count">出现 ' + gap.count + ' 次</span>' +
        '    <span>最近 ' + esc(formatDateTime(gap.lastTime)) + '</span>' +
        '    <span>部门：' + esc(gap.departments.join('、') || '—') + '</span>' +
        '  </div>' +
        '</div>' +
        '<div class="knowledge-gap-side">' +
        '  <span class="knowledge-gap-assignee">跟进：' + assignee + '</span>' +
        gapStatusBadge(gap.status) +
        (gap.evalQuestionId ? '<span class="gap-eval-tag">已加入评测集</span>' : '') +
        '  <button type="button" class="btn btn-ghost btn-sm" data-gap-open="' + esc(gap.key) + '">查看处理</button>' +
        '</div>' +
        '</article>';
    }).join('');
  }

  function openGapDetailModal(gapKey) {
    var actor = store.currentUser();
    var gaps = store.listKnowledgeGaps(actor);
    var gap = null;
    gaps.forEach(function (item) { if (item.key === gapKey) gap = item; });
    if (!gap) {
      toast('找不到这个缺口事项，或它已经不存在了。');
      return;
    }

    var assignees = store.listGapAssignees(actor);
    var assigneeOptions = '<option value="">未指派</option>' + assignees.map(function (user) {
      return '<option value="' + esc(user.id) + '"' + (user.id === gap.assigneeId ? ' selected' : '') + '>' +
        esc(user.name) + '（' + esc(user.department) + '）</option>';
    }).join('');
    var statusOptions = store.GAP_STATUSES.map(function (item) {
      return '<option value="' + esc(item.code) + '"' + (item.code === gap.status ? ' selected' : '') + '>' + esc(item.label) + '</option>';
    }).join('');

    var eventsHtml = gap.events.map(function (event) {
      return '<li>' +
        '<span class="gap-event-time">' + esc(formatDateTime(event.time)) + '</span>' +
        '<span class="gap-source">' + esc(event.source) + '</span>' +
        '<span class="gap-event-question">' + esc(event.question) + '</span>' +
        '<span class="gap-event-meta">' + esc(event.userName || '') + (event.department ? ' · ' + esc(event.department) : '') + '</span>' +
        '</li>';
    }).join('');

    modalRoot.innerHTML = '' +
      '<div class="modal-overlay" id="gap-detail-overlay">' +
      '  <div class="modal modal-wide" role="dialog" aria-modal="true" aria-labelledby="gap-detail-title">' +
      '    <div class="modal-head">' +
      '      <h3 id="gap-detail-title">知识缺口处理</h3>' +
      '      <button type="button" class="icon-btn" data-close="1" aria-label="关闭">×</button>' +
      '    </div>' +
      '    <p class="modal-sub">' + gapStatusBadge(gap.status) + ' 出现 ' + gap.count + ' 次 · 最近 ' + esc(formatDateTime(gap.lastTime)) + ' · 部门：' + esc(gap.departments.join('、') || '—') + '</p>' +
      '    <div class="gap-detail-grid">' +
      '      <div>' +
      '        <h4 class="inquiry-detail-heading">相关提问</h4>' +
      '        <ul class="gap-event-list">' + eventsHtml + '</ul>' +
      '      </div>' +
      '      <div>' +
      '        <div class="field">' +
      '          <label for="gap-assignee">跟进人</label>' +
      '          <select class="input" id="gap-assignee">' + assigneeOptions + '</select>' +
      '        </div>' +
      '        <div class="field">' +
      '          <label for="gap-status">处理状态</label>' +
      '          <select class="input" id="gap-status">' + statusOptions + '</select>' +
      '        </div>' +
      '        <div class="field">' +
      '          <label for="gap-note">处理说明</label>' +
      '          <textarea class="input" id="gap-note" rows="4" maxlength="500" placeholder="例如：补充报销材料清单，已更新制度">' + esc(gap.note || '') + '</textarea>' +
      '        </div>' +
      '        <div class="service-actions">' +
      '          <button type="button" class="btn btn-primary btn-sm" id="gap-save">保存处理</button>' +
      '          <button type="button" class="btn btn-ghost btn-sm" id="gap-eval"' + (gap.evalQuestionId ? ' disabled>已加入评测集' : '>加入评测集') + '</button>' +
      '        </div>' +
      '        <p class="service-hint">加入评测集前必须确认题目里已经去掉个人敏感信息。</p>' +
      '      </div>' +
      '    </div>' +
      '    <div class="modal-foot"><button type="button" class="btn btn-primary" data-close="1">关闭</button></div>' +
      '  </div>' +
      '</div>';

    var overlay = document.getElementById('gap-detail-overlay');
    wireModalClose(overlay);

    document.getElementById('gap-save').addEventListener('click', function () {
      var result = store.updateGapState(actor, gap.key, {
        assigneeId: document.getElementById('gap-assignee').value,
        status: document.getElementById('gap-status').value,
        note: document.getElementById('gap-note').value
      });
      if (!result.ok) {
        toast(result.message);
        return;
      }
      toast('已保存缺口处理记录');
      route();
      openGapDetailModal(gap.key);
    });

    var evalBtn = document.getElementById('gap-eval');
    if (evalBtn) {
      evalBtn.addEventListener('click', function () {
        openGapEvalModal(gap);
      });
    }
  }

  function openGapEvalModal(gap) {
    var actor = store.currentUser();

    modalRoot.innerHTML = '' +
      '<div class="modal-overlay" id="gap-eval-overlay">' +
      '  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="gap-eval-title">' +
      '    <div class="modal-head">' +
      '      <h3 id="gap-eval-title">加入评测集</h3>' +
      '      <button type="button" class="icon-btn" data-close="1" aria-label="关闭">×</button>' +
      '    </div>' +
      '    <p class="modal-sub">把这个知识缺口问题保存成以后回归测试的题目。保存前请人工确认题目里已经去掉个人敏感信息（姓名、联系方式、工号等）。</p>' +
      '    <div class="form-error" id="gap-eval-error" role="alert"></div>' +
      '    <div class="field">' +
      '      <label for="gap-eval-question">评测题目（可以修改）</label>' +
      '      <textarea class="input" id="gap-eval-question" rows="4" maxlength="300">' + esc(gap.title) + '</textarea>' +
      '    </div>' +
      '    <label class="eval-confirm"><input type="checkbox" id="gap-eval-confirm"> 我已确认已去除个人敏感信息</label>' +
      '    <div class="modal-foot">' +
      '      <button type="button" class="btn btn-ghost" data-close="1">取消</button>' +
      '      <button type="button" class="btn btn-primary" id="gap-eval-save">保存到评测集</button>' +
      '    </div>' +
      '  </div>' +
      '</div>';

    var overlay = document.getElementById('gap-eval-overlay');
    var closeModal = wireModalClose(overlay);
    var errEl = document.getElementById('gap-eval-error');

    document.getElementById('gap-eval-save').addEventListener('click', function () {
      hideError(errEl);
      if (!document.getElementById('gap-eval-confirm').checked) {
        showError(errEl, '请先确认已去除个人敏感信息。');
        return;
      }

      var result = store.addGapEvalQuestion(actor, gap.key, {
        question: document.getElementById('gap-eval-question').value,
        confirmed: true
      });
      if (!result.ok) {
        showError(errEl, result.message);
        return;
      }
      closeModal();
      toast('已保存为评测题（评测集将在阶段 10 完善）');
      route();
    });
  }

  function wireKnowledgeGapsPage() {
    var page = document.getElementById('page-content');
    if (!page) return;
    page.addEventListener('click', function (event) {
      var btn = event.target && event.target.closest ? event.target.closest('[data-gap-open]') : null;
      if (!btn) return;
      openGapDetailModal(btn.getAttribute('data-gap-open'));
    });
  }

  /* ================== Agent 执行轨迹 ================== */

  function traceResultLabel(result) {
    if (result === 'pass') return '通过';
    if (result === 'fail') return '未通过';
    if (result === 'partial') return '部分通过';
    if (result === 'skipped') return '未执行';
    return '—';
  }

  function traceResultClass(result) {
    return ['pass', 'fail', 'partial', 'skipped'].indexOf(result) !== -1 ? result : 'skipped';
  }

  function traceAnswerStatusLabel(status) {
    if (status === 'verified') return '依据充分';
    if (status === 'partial') return '部分有依据';
    if (status === 'insufficient') return '依据不足';
    if (status === 'conflict') return '存在冲突';
    return status || '—';
  }

  function traceAnswerStatusClass(status) {
    if (status === 'verified') return 'pass';
    if (status === 'partial') return 'partial';
    return 'fail';
  }

  function formatTraceDuration(ms) {
    if (ms === null || ms === undefined || ms === '' || !isFinite(Number(ms))) return '—';
    var value = Math.max(0, Number(ms));
    if (value >= 1000) return (Math.round(value / 100) / 10) + ' 秒';
    return Math.round(value) + ' 毫秒';
  }

  // 检查回答当时引用的原文，现在是否还和制度里一致
  function passageSliceStatus(passage) {
    var policy = passage && passage.policyId ? store.getPolicyById(passage.policyId) : null;
    if (!policy || policy.status !== 'published') {
      return {
        code: 'offline',
        label: '制度已下架',
        hint: '这份制度现在不在已发布状态，无法再确认当时的原文。'
      };
    }

    var currentText = String(policy.parsedText || '').replace(/\s+/g, '');
    var citedText = String(passage.text || '').replace(/\s+/g, '');
    if (!citedText || currentText.indexOf(citedText) === -1) {
      return {
        code: 'changed',
        label: '当前切片已变化',
        hint: '这份制度的内容后来被修改，下面展示的是回答当时的原文。'
      };
    }

    return { code: 'same', label: '原文一致', hint: '' };
  }

  function traceFallbackStages(trace) {
    var answer = (trace && trace.answer) || {};
    var citations = answer.citations || [];
    var stages = [];

    stages.push({ key: 'intent', name: '理解意图', result: 'skipped', durationMs: null, detail: '旧回答没有记录这个阶段。' });
    stages.push({
      key: 'retrieval',
      name: '查找制度原文',
      result: citations.length ? 'pass' : 'fail',
      durationMs: null,
      detail: citations.length ? ('找到 ' + citations.length + ' 段相关原文。') : '没有找到相关原文。',
      passages: citations.map(function (citation) {
        return {
          policyId: citation.policyId,
          policyName: citation.policyName,
          version: citation.version,
          positionLabel: citation.positionLabel,
          text: citation.text
        };
      })
    });
    stages.push({ key: 'generation', name: '生成回答', result: 'pass', durationMs: null, detail: '旧回答没有记录这个阶段。' });

    var verification = answer.verification || [];
    var ruleEntries = verification.filter(function (item) {
      return item && item.name && item.name.indexOf('AI') === -1;
    });
    var ruleFailed = ruleEntries.filter(function (item) { return item.result === 'fail'; }).length;
    var rulePassed = ruleEntries.filter(function (item) { return item.result === 'pass'; }).length;
    stages.push({
      key: 'rule',
      name: '规则核验',
      result: ruleEntries.length ? (ruleFailed ? (rulePassed ? 'partial' : 'fail') : 'pass') : 'skipped',
      durationMs: null,
      detail: ruleEntries.length
        ? ruleEntries.map(function (item) { return item.name + '：' + traceResultLabel(item.result); }).join('；')
        : '旧回答没有规则核验记录。'
    });

    var aiEntry = verification.filter(function (item) {
      return item && item.name && item.name.indexOf('AI') !== -1;
    })[0];
    stages.push({
      key: 'semantic',
      name: '语义核验',
      result: aiEntry ? (aiEntry.result || 'skipped') : 'skipped',
      durationMs: null,
      detail: aiEntry ? (aiEntry.detail || '') : '旧回答没有语义核验记录。'
    });

    stages.push({
      key: 'final',
      name: '最终状态',
      result: traceAnswerStatusClass(answer.status),
      durationMs: 0,
      detail: '最终状态：' + traceAnswerStatusLabel(answer.status) + '。'
    });

    return stages;
  }

  function buildTraceStages(trace) {
    var answer = (trace && trace.answer) || {};
    if (Array.isArray(answer.trace) && answer.trace.length) return answer.trace;
    return traceFallbackStages(trace);
  }

  function tracesHtml(actor) {
    var viewAll = store.canViewAllAnswerTraces(actor);
    return '' +
      '<section class="page-head">' +
      '  <div>' +
      '    <h2 class="page-head-title">Agent 执行轨迹</h2>' +
      '    <p class="page-head-sub">' + (viewAll ? '可以查看所有人的回答轨迹，用来定位问题' : '查看你自己最近的问答经过的每个阶段') + '</p>' +
      '  </div>' +
      '</section>' +
      '<p class="gap-group-note">用途：出了问题时能定位是没找到制度原文、生成错了，还是被核验拦住。' + (viewAll ? '管理员可以看到所有人的轨迹。' : '你只能看到自己的轨迹。') + '</p>' +
      '<div class="table-card">' +
      '  <table class="data-table inquiry-table"><thead><tr>' +
      (viewAll ? '<th>员工</th>' : '') +
      '<th>问题</th><th>时间</th><th>最终状态</th><th>总耗时</th><th>操作</th></tr></thead>' +
      '  <tbody id="trace-list"></tbody></table>' +
      '</div>';
  }

  function renderTraces(actor) {
    var body = document.getElementById('trace-list');
    if (!body) return;

    var traces = store.listAnswerTraces(actor);
    var viewAll = store.canViewAllAnswerTraces(actor);
    var columnCount = viewAll ? 6 : 5;

    if (!traces.length) {
      body.innerHTML = '<tr><td colspan="' + columnCount + '" class="policy-empty">还没有回答轨迹。</td></tr>';
      return;
    }

    body.innerHTML = traces.map(function (trace) {
      var answer = trace.answer || {};
      return '<tr>' +
        (viewAll ? '<td>' + esc(trace.userName) + '<span class="leave-account">' + esc(trace.department) + '</span></td>' : '') +
        '<td class="inquiry-question">' + esc(trace.question) + '</td>' +
        '<td>' + esc(formatDateTime(trace.createdAt)) + '</td>' +
        '<td><span class="trace-status is-' + traceAnswerStatusClass(answer.status) + '">' + esc(traceAnswerStatusLabel(answer.status)) + '</span></td>' +
        '<td>' + esc(formatTraceDuration(answer.elapsedMs)) + '</td>' +
        '<td><button type="button" class="btn btn-ghost btn-sm" data-trace-open="' + esc(trace.id) + '">查看轨迹</button></td>' +
        '</tr>';
    }).join('');
  }

  function openTraceModal(traceId) {
    var actor = store.currentUser();
    var traces = store.listAnswerTraces(actor);
    var trace = null;
    traces.forEach(function (item) { if (item.id === traceId) trace = item; });
    if (!trace) {
      toast('找不到这条回答轨迹，或没有权限查看。');
      return;
    }

    var stages = buildTraceStages(trace);
    var body = stages.map(function (stage, index) {
      var duration = formatTraceDuration(stage.durationMs);
      var html = '<li class="trace-stage is-' + traceResultClass(stage.result) + '">' +
        '<div class="trace-stage-head">' +
        '  <span class="trace-stage-index">' + (index + 1) + '</span>' +
        '  <span class="trace-stage-name">' + esc(stage.name) + '</span>' +
        '  <span class="trace-badge is-' + traceResultClass(stage.result) + '">' + esc(traceResultLabel(stage.result)) + '</span>' +
        '  <span class="trace-duration">耗时 ' + esc(duration) + '</span>' +
        '</div>' +
        '<p class="trace-stage-detail">' + esc(stage.detail || '') + '</p>';

      var passages = stage.passages || [];
      if (stage.key === 'retrieval' && passages.length) {
        html += '<ul class="trace-passages">' + passages.map(function (passage) {
          var slice = passageSliceStatus(passage);
          return '<li>' +
            '<div class="trace-passage-head">' +
            '  <span class="trace-passage-policy">《' + esc(passage.policyName) + '》 ' + esc(passage.version) + ' · ' + esc(passage.positionLabel) + '</span>' +
            '  <span class="trace-slice is-' + slice.code + '">' + esc(slice.label) + '</span>' +
            '</div>' +
            '<p class="trace-passage-text">' + esc(passage.text) + '</p>' +
            (slice.hint ? '<p class="trace-slice-hint">' + esc(slice.hint) + '</p>' : '') +
            '</li>';
        }).join('') + '</ul>';
      }

      return html + '</li>';
    }).join('');

    modalRoot.innerHTML = '' +
      '<div class="modal-overlay" id="trace-overlay">' +
      '  <div class="modal modal-wide" role="dialog" aria-modal="true" aria-labelledby="trace-title">' +
      '    <div class="modal-head">' +
      '      <h3 id="trace-title">回答执行轨迹</h3>' +
      '      <button type="button" class="icon-btn" data-close="1" aria-label="关闭">×</button>' +
      '    </div>' +
      '    <p class="modal-sub">' + esc(trace.userName) + (trace.department ? '（' + esc(trace.department) + '）' : '') +
      ' · ' + esc(formatDateTime(trace.createdAt)) + ' · 最终状态：' + traceAnswerStatusLabel((trace.answer || {}).status) + '</p>' +
      '    <p class="trace-question">' + esc(trace.question) + '</p>' +
      '    <ol class="trace-stages">' + body + '</ol>' +
      '    <div class="modal-foot"><button type="button" class="btn btn-primary" data-close="1">关闭</button></div>' +
      '  </div>' +
      '</div>';

    wireModalClose(document.getElementById('trace-overlay'));
  }

  function wireTracesPage() {
    var page = document.getElementById('page-content');
    if (!page) return;
    page.addEventListener('click', function (event) {
      var btn = event.target && event.target.closest ? event.target.closest('[data-trace-open]') : null;
      if (!btn) return;
      openTraceModal(btn.getAttribute('data-trace-open'));
    });
  }

  /* ================== 开发者后台 · 检索调试 / 切片管理 ================== */

  var developerTab = 'retrieval';
  var developerChunkTimer = null;
  var developerEvalTimer = null;
  var developerEvalBusy = false;
  var promptEditingVersionId = null;
  var promptCompareResult = null;
  var releaseRegressionTimer = null;

  function developerHtml(actor) {
    return '' +
      '<section class="page-head">' +
      '  <div>' +
      '    <h2 class="page-head-title">开发者后台</h2>' +
      '    <p class="page-head-sub">面向系统管理员的调试与配置入口（检索调试、切片管理）</p>' +
      '  </div>' +
      '</section>' +
      '<div class="dev-tabs">' +
      '  <button type="button" class="dev-tab' + (developerTab === 'retrieval' ? ' is-active' : '') + '" data-dev-tab="retrieval">检索调试</button>' +
      '  <button type="button" class="dev-tab' + (developerTab === 'chunks' ? ' is-active' : '') + '" data-dev-tab="chunks">切片管理</button>' +
      '  <button type="button" class="dev-tab' + (developerTab === 'evalSet' ? ' is-active' : '') + '" data-dev-tab="evalSet">评测集</button>' +
      '  <button type="button" class="dev-tab' + (developerTab === 'evalRuns' ? ' is-active' : '') + '" data-dev-tab="evalRuns">运行记录</button>' +
      '  <button type="button" class="dev-tab' + (developerTab === 'prompt' ? ' is-active' : '') + '" data-dev-tab="prompt">Prompt 管理</button>' +
      '  <button type="button" class="dev-tab' + (developerTab === 'release' ? ' is-active' : '') + '" data-dev-tab="release">Prompt 发布</button>' +
      '  <span class="dev-tabs-hint">更多标签页会在后续阶段加入</span>' +
      '</div>' +
      '<div class="dev-stats" id="dev-stats"></div>' +
      '<div class="dev-tab-panel' + (developerTab === 'retrieval' ? '' : ' is-hidden') + '" id="dev-panel-retrieval">' +
      '  <div class="dev-layout">' +
      '    <section class="dev-panel">' +
      '      <h3 class="dev-panel-title">检索参数</h3>' +
      '      <div class="field">' +
      '        <label for="dev-passage-limit">最终保留的原文数量（1–20）</label>' +
      '        <input class="input" id="dev-passage-limit" type="number" min="1" max="20" step="1">' +
      '      </div>' +
      '      <div class="field">' +
      '        <label for="dev-semantic-candidates">意思相近候选数量</label>' +
      '        <input class="input" id="dev-semantic-candidates" type="number" min="1" max="100" step="1">' +
      '      </div>' +
      '      <div class="field">' +
      '        <label for="dev-keyword-candidates">关键词命中候选数量</label>' +
      '        <input class="input" id="dev-keyword-candidates" type="number" min="1" max="100" step="1">' +
      '      </div>' +
      '      <p class="dev-explain">意思相近与关键词命中两路候选合并后，最终只取前几段；部门权限过滤始终在排序之前。</p>' +
      '      <div class="field">' +
      '        <button type="button" class="btn btn-primary" id="dev-save-draft">保存草稿</button>' +
      '        <p class="hint">只是保存草稿，不会立刻影响员工；生效要走阶段 11 的发布流程。</p>' +
      '      </div>' +
      '      <p class="dev-draft-status" id="dev-draft-status"></p>' +
      '    </section>' +
      '    <section class="dev-panel">' +
      '      <h3 class="dev-panel-title">检索测试</h3>' +
      '      <div class="field">' +
      '        <label for="dev-question">问题</label>' +
      '        <input class="input" id="dev-question" type="text" maxlength="300" placeholder="例如：年假可以结转到明年吗？">' +
      '      </div>' +
      '      <div class="field">' +
      '        <label for="dev-department">以哪个部门的员工身份测试</label>' +
      '        <select class="input" id="dev-department"></select>' +
      '      </div>' +
      '      <div class="field">' +
      '        <button type="button" class="btn btn-primary" id="dev-run">开始检索</button>' +
      '      </div>' +
      '      <div class="dev-results" id="dev-results"><p class="service-hint">修改左侧参数后点“开始检索”，结果会显示在这里。</p></div>' +
      '    </section>' +
      '  </div>' +
      '</div>' +
      '<div class="dev-tab-panel' + (developerTab === 'chunks' ? '' : ' is-hidden') + '" id="dev-panel-chunks">' +
      '  <div class="dev-layout">' +
      '    <section class="dev-panel">' +
      '      <h3 class="dev-panel-title">切片参数</h3>' +
      '      <div class="field">' +
      '        <label for="chunk-policy-select">选择制度</label>' +
      '        <select class="input" id="chunk-policy-select"></select>' +
      '      </div>' +
      '      <div class="field">' +
      '        <label for="chunk-length">切分长度（80–800 字）</label>' +
      '        <input class="input" id="chunk-length" type="number" min="80" max="800" step="10">' +
      '      </div>' +
      '      <div class="field">' +
      '        <button type="button" class="btn btn-primary" id="chunk-rebuild">重新建立索引</button>' +
      '        <p class="hint">重新建立是后台任务，按制度原文重新切分，手动修改过的片段会被覆盖。</p>' +
      '      </div>' +
      '      <div class="chunk-task-status" id="chunk-task-status"><p class="service-hint">还没有运行中的切分任务。</p></div>' +
      '      <p class="dev-explain">检查一下金额和它适用的条件有没有被切到两段里。</p>' +
      '    </section>' +
      '    <section class="dev-panel">' +
      '      <h3 class="dev-panel-title">制度片段</h3>' +
      '      <div id="chunk-list" class="chunk-list"></div>' +
      '    </section>' +
      '  </div>' +
      '</div>' +
      '<div class="dev-tab-panel' + (developerTab === 'evalSet' ? '' : ' is-hidden') + '" id="dev-panel-evalSet">' +
      '  <p class="gap-group-note">目前没有自动语义评分，也不做大规模压力测试。</p>' +
      '  <div class="dev-toolbar">' +
      '    <button type="button" class="btn btn-primary btn-sm" id="eval-add">新增题目</button>' +
      '    <button type="button" class="btn btn-ghost btn-sm" id="eval-import-feedback">从差评导入</button>' +
      '    <button type="button" class="btn btn-ghost btn-sm" id="eval-import-gap">从缺口导入</button>' +
      '    <button type="button" class="btn btn-ghost btn-sm" id="eval-import-acceptance">导入验收题库</button>' +
      '    <button type="button" class="btn btn-primary btn-sm" id="eval-run-selected">运行评测</button>' +
      '    <span class="messages-summary" id="eval-set-count"></span>' +
      '  </div>' +
      '  <div class="eval-question-list" id="eval-question-list"></div>' +
      '</div>' +
      '<div class="dev-tab-panel' + (developerTab === 'evalRuns' ? '' : ' is-hidden') + '" id="dev-panel-evalRuns">' +
      '  <p class="gap-group-note">目前没有自动语义评分，也不做大规模压力测试。运行中的记录每 2 秒自动刷新。</p>' +
      '  <div class="eval-run-list" id="eval-run-list"></div>' +
      '</div>' +
      '<div class="dev-tab-panel' + (developerTab === 'prompt' ? '' : ' is-hidden') + '" id="dev-panel-prompt">' +
      '  <p class="gap-group-note">Prompt 修改会保存为草稿版本，不会立刻影响员工；正式生效要走阶段 11 的发布流程。A/B 对比是离线对比，不等于线上真实用户的随机实验。</p>' +
      '  <div class="dev-layout">' +
      '    <section class="dev-panel">' +
      '      <h3 class="dev-panel-title">Prompt 内容</h3>' +
      '      <div id="prompt-editor"></div>' +
      '      <div class="field">' +
      '        <label for="prompt-change-reason">修改原因（保存草稿版本时记录）</label>' +
      '        <input class="input" id="prompt-change-reason" type="text" maxlength="300" placeholder="例如：减少过度推断，要求逐条引用原文">' +
      '      </div>' +
      '      <div class="field">' +
      '        <button type="button" class="btn btn-primary" id="prompt-save">保存为新草稿版本</button>' +
      '      </div>' +
      '      <p class="service-hint" id="prompt-save-hint"></p>' +
      '    </section>' +
      '    <section class="dev-panel">' +
      '      <h3 class="dev-panel-title">版本历史</h3>' +
      '      <div id="prompt-version-list" class="prompt-version-list"></div>' +
      '      <h3 class="dev-panel-title">A/B 对比</h3>' +
      '      <div class="field">' +
      '        <label for="prompt-version-a">版本 A</label>' +
      '        <select class="input" id="prompt-version-a"></select>' +
      '      </div>' +
      '      <div class="field">' +
      '        <label for="prompt-version-b">版本 B</label>' +
      '        <select class="input" id="prompt-version-b"></select>' +
      '      </div>' +
      '      <div class="field">' +
      '        <label>同一批评测题</label>' +
      '        <div id="prompt-eval-list" class="prompt-eval-list"></div>' +
      '      </div>' +
      '      <div class="dev-toolbar">' +
      '        <button type="button" class="btn btn-ghost btn-sm" id="prompt-select-all">全选</button>' +
      '        <button type="button" class="btn btn-ghost btn-sm" id="prompt-clear-all">清空</button>' +
      '        <button type="button" class="btn btn-primary btn-sm" id="prompt-compare">开始对比</button>' +
      '      </div>' +
      '    </section>' +
      '  </div>' +
      '  <div class="prompt-compare-result" id="prompt-compare-result"></div>' +
      '</div>' +
      '<div class="dev-tab-panel' + (developerTab === 'release' ? '' : ' is-hidden') + '" id="dev-panel-release">' +
      '  <p class="gap-group-note">离线评测不能覆盖所有真实情况；回归只覆盖所选的那几道题；回滚也需要重新回归，不是一键切换。</p>' +
      '  <div id="release-online"></div>' +
      '  <div id="release-drafts"></div>' +
      '  <div id="release-history"></div>' +
      '</div>';
  }

  function renderDeveloperPage(actor) {
    var stats = document.getElementById('dev-stats');
    if (developerChunkTimer) {
      window.clearTimeout(developerChunkTimer);
      developerChunkTimer = null;
    }
    if (developerEvalTimer) {
      window.clearTimeout(developerEvalTimer);
      developerEvalTimer = null;
    }
    if (releaseRegressionTimer) {
      window.clearTimeout(releaseRegressionTimer);
      releaseRegressionTimer = null;
    }

    var settings = store.getDeveloperSettings(actor);
    if (!settings) {
      if (stats) stats.innerHTML = '<p class="service-hint">只有系统管理员可以使用开发者后台。</p>';
      return;
    }

    var form = settings.draft || settings.online;
    if (stats) {
      stats.innerHTML = [
        { label: '当前配置版本', value: settings.configVersion },
        { label: '在线提示词版本', value: settings.promptVersion },
        { label: '当前原文数量设置', value: String(settings.online.passageLimit) },
        { label: '评测题数量', value: String(settings.evaluationCount) }
      ].map(function (item) {
        return '<div class="dev-stat"><span class="dev-stat-label">' + esc(item.label) + '</span><span class="dev-stat-value">' + esc(item.value) + '</span></div>';
      }).join('');
    }

    var limitInput = document.getElementById('dev-passage-limit');
    if (limitInput) limitInput.value = String(form.passageLimit);
    var semanticInput = document.getElementById('dev-semantic-candidates');
    if (semanticInput) semanticInput.value = String(form.semanticCandidates);
    var keywordInput = document.getElementById('dev-keyword-candidates');
    if (keywordInput) keywordInput.value = String(form.keywordCandidates);

    var deptSelect = document.getElementById('dev-department');
    if (deptSelect && !deptSelect.options.length) {
      deptSelect.innerHTML = store.getDepartments().map(function (dept) {
        return '<option value="' + esc(dept) + '">' + esc(dept) + '</option>';
      }).join('');
    }

    var draftStatus = document.getElementById('dev-draft-status');
    if (draftStatus) {
      if (settings.draft) {
        draftStatus.textContent = '已保存草稿 ' + settings.draft.version + '：原文 ' + settings.draft.passageLimit +
          '，语义候选 ' + settings.draft.semanticCandidates + '，关键词候选 ' + settings.draft.keywordCandidates +
          '；保存于 ' + formatDateTime(settings.draft.savedAt) + '（未发布，不影响员工）。';
      } else {
        draftStatus.textContent = '还没有草稿，当前表单使用的是线上配置。';
      }
    }

    $$('[data-dev-tab]', appEl).forEach(function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-dev-tab') === developerTab);
    });
    var retrievalPanel = document.getElementById('dev-panel-retrieval');
    var chunksPanel = document.getElementById('dev-panel-chunks');
    var evalSetPanel = document.getElementById('dev-panel-evalSet');
    var evalRunsPanel = document.getElementById('dev-panel-evalRuns');
    var promptPanel = document.getElementById('dev-panel-prompt');
    var releasePanel = document.getElementById('dev-panel-release');
    if (retrievalPanel) retrievalPanel.classList.toggle('is-hidden', developerTab !== 'retrieval');
    if (chunksPanel) chunksPanel.classList.toggle('is-hidden', developerTab !== 'chunks');
    if (evalSetPanel) evalSetPanel.classList.toggle('is-hidden', developerTab !== 'evalSet');
    if (evalRunsPanel) evalRunsPanel.classList.toggle('is-hidden', developerTab !== 'evalRuns');
    if (promptPanel) promptPanel.classList.toggle('is-hidden', developerTab !== 'prompt');
    if (releasePanel) releasePanel.classList.toggle('is-hidden', developerTab !== 'release');

    initChunkPolicySelect(actor);
    if (developerTab === 'chunks') renderChunkPanel(actor);
    if (developerTab === 'evalSet') renderEvalSet(actor);
    if (developerTab === 'evalRuns') renderEvalRuns(actor);
    if (developerTab === 'prompt') renderPromptPanel(actor);
    if (developerTab === 'release') renderReleasePanel(actor);
  }

  function initChunkPolicySelect(actor) {
    var select = document.getElementById('chunk-policy-select');
    if (!select) return;

    var policies = store.listPolicies().filter(function (policy) {
      return policy && policy.parsedText;
    });
    if (!policies.length) {
      select.innerHTML = '<option value="">没有可切分的制度</option>';
      return;
    }

    var current = select.value;
    select.innerHTML = policies.map(function (policy) {
      return '<option value="' + esc(policy.id) + '">' + esc(policy.name) + '（' + esc(policy.version) + '）</option>';
    }).join('');
    if (current && policies.some(function (policy) { return policy.id === current; })) {
      select.value = current;
    }
  }

  function renderChunkTask(task) {
    var box = document.getElementById('chunk-task-status');
    if (!box) return;
    if (!task) {
      box.innerHTML = '<p class="service-hint">还没有运行中的切分任务。</p>';
      return;
    }

    var statusLabel = task.status === 'done' ? '已完成' : (task.status === 'failed' ? '失败' : '进行中');
    var resultHtml = '';
    if (task.result) {
      resultHtml = '<p class="chunk-task-result">结果：共 ' + task.result.chunkCount + ' 段，切分长度 ' +
        task.result.chunkLength + ' 字，版本 ' + esc(task.result.version) + '。</p>';
    }

    box.innerHTML = '<div class="chunk-task">' +
      '<div class="chunk-task-head"><span>后台切分任务</span><span>状态：' + esc(statusLabel) + '</span></div>' +
      '<div class="chunk-progress"><span style="width:' + Math.max(0, Math.min(100, Number(task.progress) || 0)) + '%"></span></div>' +
      '<p class="chunk-task-message">' + esc(task.message || '') + '</p>' +
      resultHtml +
      '</div>';
  }

  function renderChunkList(policy, index) {
    var list = document.getElementById('chunk-list');
    if (!list) return;

    if (!index || !index.chunks || !index.chunks.length) {
      list.innerHTML = '<p class="service-hint">这份制度还没有片段。</p>';
      return;
    }

    list.innerHTML = '<p class="chunk-list-meta">共 ' + index.chunks.length + ' 个片段 · 切分长度 ' +
      index.chunkLength + ' 字 · 最近更新 ' + esc(formatDateTime(index.updatedAt)) + '</p>' +
      index.chunks.map(function (chunk) {
        return '<article class="chunk-card" data-chunk-id="' + esc(chunk.id) + '">' +
          '<div class="chunk-card-head">' +
          '  <span class="chunk-number">#' + chunk.index + '</span>' +
          '  <span class="chunk-position">' + esc(chunk.title) + ' · ' + esc(chunk.pageLabel) + '</span>' +
          '  <span class="chunk-count">' + chunk.charCount + ' 字</span>' +
          (chunk.edited ? '<span class="chunk-edited">已手动修改</span>' : '') +
          '</div>' +
          '<p class="chunk-source">制度：' + esc(policy.name) + ' · 版本：' + esc(index.version) +
          ' · 标题：' + esc(chunk.title) + ' · 页码：' + esc(chunk.pageLabel) + '</p>' +
          '<pre class="chunk-text">' + esc(chunk.text) + '</pre>' +
          '<div class="chunk-actions"><button type="button" class="btn btn-ghost btn-sm" data-chunk-edit="' + esc(chunk.id) + '">修改这段</button></div>' +
          '</article>';
      }).join('');
  }

  function renderChunkPanel(actor) {
    var select = document.getElementById('chunk-policy-select');
    var list = document.getElementById('chunk-list');
    if (!select || !list) return;

    var policyId = select.value || (select.options.length ? select.options[0].value : '');
    if (!policyId) {
      list.innerHTML = '<p class="service-hint">请先选择一份有正文的制度。</p>';
      return;
    }

    var result = store.ensurePolicyChunks(actor, policyId);
    if (!result.ok) {
      list.innerHTML = '<p class="service-hint">' + esc(result.message) + '</p>';
      return;
    }

    var lengthInput = document.getElementById('chunk-length');
    if (lengthInput) lengthInput.value = String(result.index.chunkLength);

    renderChunkList(result.policy, result.index);

    var latest = store.getLatestChunkTask(actor, policyId);
    if (latest && latest.status === 'running') {
      pollChunkTask(actor, latest.id);
    } else if (latest) {
      renderChunkTask(latest);
    }
  }

  function pollChunkTask(actor, taskId) {
    if (developerChunkTimer) {
      window.clearTimeout(developerChunkTimer);
      developerChunkTimer = null;
    }

    function step() {
      store.advanceChunkTasks();
      var task = store.getChunkTask(taskId);
      renderChunkTask(task);
      if (task && task.status === 'running') {
        developerChunkTimer = window.setTimeout(step, 300);
        return;
      }
      developerChunkTimer = null;
      renderChunkPanel(actor);
    }

    step();
  }

  function openChunkEditModal(actor, policyId, chunkId) {
    var index = store.getPolicyChunks(actor, policyId);
    if (!index) {
      toast('找不到切片索引。');
      return;
    }

    var chunk = null;
    index.chunks.forEach(function (item) { if (item.id === chunkId) chunk = item; });
    if (!chunk) {
      toast('找不到这个片段。');
      return;
    }

    modalRoot.innerHTML = '' +
      '<div class="modal-overlay" id="chunk-edit-overlay">' +
      '  <div class="modal modal-wide" role="dialog" aria-modal="true" aria-labelledby="chunk-edit-title">' +
      '    <div class="modal-head">' +
      '      <h3 id="chunk-edit-title">修改片段 #' + chunk.index + '</h3>' +
      '      <button type="button" class="icon-btn" data-close="1" aria-label="关闭">×</button>' +
      '    </div>' +
      '    <p class="modal-sub">制度：' + esc(chunk.policyName || '') + ' · 版本 ' + esc(index.version) +
      ' · 标题：' + esc(chunk.title) + ' · 页码：' + esc(chunk.pageLabel) + '</p>' +
      '    <p class="service-hint">修改只作用于切片索引；来源信息（制度、版本、标题、页码）会保留。</p>' +
      '    <div class="field">' +
      '      <label for="chunk-edit-text">片段内容</label>' +
      '      <textarea class="input" id="chunk-edit-text" rows="10" maxlength="3000">' + esc(chunk.text) + '</textarea>' +
      '    </div>' +
      '    <div class="modal-foot">' +
      '      <button type="button" class="btn btn-ghost" data-close="1">取消</button>' +
      '      <button type="button" class="btn btn-primary" id="chunk-edit-save">保存片段</button>' +
      '    </div>' +
      '  </div>' +
      '</div>';

    var overlay = document.getElementById('chunk-edit-overlay');
    var closeModal = wireModalClose(overlay);

    document.getElementById('chunk-edit-save').addEventListener('click', function () {
      var result = store.updatePolicyChunk(actor, policyId, chunkId, document.getElementById('chunk-edit-text').value);
      if (!result.ok) {
        toast(result.message);
        return;
      }
      closeModal();
      toast('片段已保存');
      renderChunkPanel(actor);
    });
  }

  function readDeveloperNumber(element, min, max) {
    var value = Number(element.value);
    if (!isFinite(value) || Math.floor(value) !== value || value < min || value > max) return null;
    return value;
  }

  function renderDeveloperResults(result) {
    var box = document.getElementById('dev-results');
    if (!box) return;

    if (!result.ok) {
      box.innerHTML = '<p class="service-hint">' + esc(result.message || '检索失败，请检查问题。') + '</p>';
      return;
    }

    var counts = result.candidateCounts || {};
    var meta = '可见制度 ' + result.visiblePolicies.length + ' 份 · 原文片段 ' + result.passageCount + ' 段 · ' +
      '语义候选 ' + (counts.semantic || 0) + ' / 关键词候选 ' + (counts.keyword || 0) + ' / 合并后 ' + (counts.merged || 0) + ' · ' +
      '耗时 ' + result.elapsedMs + ' 毫秒';

    if (!result.results.length) {
      box.innerHTML = '<p class="dev-results-meta">' + esc(meta) + '</p><p class="service-hint">没有找到达到阈值的原文片段。</p>';
      return;
    }

    box.innerHTML = '<p class="dev-results-meta">' + esc(meta) + '</p>' +
      '<p class="dev-score-note">排名分数仅用于排序，不是可信概率。</p>' +
      result.results.map(function (item, index) {
        return '<article class="dev-result">' +
          '<div class="dev-result-rank">#' + (index + 1) + '</div>' +
          '<div class="dev-result-main">' +
          '  <p class="dev-result-policy">《' + esc(item.policyName) + '》 ' + esc(item.version) + ' · ' + esc(item.positionLabel) + '</p>' +
          '  <p class="dev-result-text">' + esc(item.text) + '</p>' +
          '  <p class="dev-result-score">排名分数 ' + esc(String(item.score)) + '（语义 ' + esc(String(item.semanticScore)) + ' / 关键词 ' + esc(String(item.keywordScore)) + '）</p>' +
          '</div>' +
          '</article>';
      }).join('');
  }

  function wireDeveloperPage() {
    var actor = store.currentUser();
    if (!actor) return;

    $$('[data-dev-tab]', appEl).forEach(function (btn) {
      btn.addEventListener('click', function () {
        developerTab = btn.getAttribute('data-dev-tab');
        $$('[data-dev-tab]', appEl).forEach(function (item) {
          item.classList.toggle('is-active', item.getAttribute('data-dev-tab') === developerTab);
        });
        var panelIds = {
          retrieval: 'dev-panel-retrieval',
          chunks: 'dev-panel-chunks',
          evalSet: 'dev-panel-evalSet',
          evalRuns: 'dev-panel-evalRuns',
          prompt: 'dev-panel-prompt',
          release: 'dev-panel-release'
        };
        Object.keys(panelIds).forEach(function (key) {
          var panel = document.getElementById(panelIds[key]);
          if (panel) panel.classList.toggle('is-hidden', key !== developerTab);
        });
        if (developerTab === 'chunks') renderChunkPanel(actor);
        if (developerTab === 'evalSet') renderEvalSet(actor);
        if (developerTab === 'evalRuns') renderEvalRuns(actor);
        if (developerTab === 'prompt') renderPromptPanel(actor);
        if (developerTab === 'release') renderReleasePanel(actor);
      });
    });

    var chunkSelect = document.getElementById('chunk-policy-select');
    if (chunkSelect) {
      chunkSelect.addEventListener('change', function () {
        renderChunkPanel(actor);
      });
    }

    var chunkRebuild = document.getElementById('chunk-rebuild');
    if (chunkRebuild) {
      chunkRebuild.addEventListener('click', function () {
        var select = document.getElementById('chunk-policy-select');
        var policyId = select ? select.value : '';
        if (!policyId) {
          toast('请先选择一份制度。');
          return;
        }
        var result = store.startChunkRebuild(actor, policyId, document.getElementById('chunk-length').value);
        if (!result.ok) {
          toast(result.message);
          return;
        }
        toast('已提交后台切分任务，正在处理…');
        renderChunkTask(result.task);
        pollChunkTask(actor, result.task.id);
      });
    }

    var chunkList = document.getElementById('chunk-list');
    if (chunkList) {
      chunkList.addEventListener('click', function (event) {
        var btn = event.target && event.target.closest ? event.target.closest('[data-chunk-edit]') : null;
        if (!btn) return;
        var select = document.getElementById('chunk-policy-select');
        if (!select || !select.value) return;
        openChunkEditModal(actor, select.value, btn.getAttribute('data-chunk-edit'));
      });
    }

    var evalAdd = document.getElementById('eval-add');
    if (evalAdd) {
      evalAdd.addEventListener('click', function () {
        openEvalQuestionModal(actor, null);
      });
    }

    var evalImportFeedback = document.getElementById('eval-import-feedback');
    if (evalImportFeedback) {
      evalImportFeedback.addEventListener('click', function () {
        var result = store.importEvalFromFeedbacks(actor);
        if (!result.ok) { toast(result.message); return; }
        toast(result.count ? ('已从差评导入 ' + result.count + ' 道题') : '没有新的差评可以导入');
        renderEvalSet(actor);
      });
    }

    var evalImportGap = document.getElementById('eval-import-gap');
    if (evalImportGap) {
      evalImportGap.addEventListener('click', function () {
        var result = store.importEvalFromGaps(actor);
        if (!result.ok) { toast(result.message); return; }
        toast(result.count ? ('已从知识缺口导入 ' + result.count + ' 道题') : '没有新的缺口可以导入');
        renderEvalSet(actor);
      });
    }

    var evalImportAcceptance = document.getElementById('eval-import-acceptance');
    if (evalImportAcceptance) {
      evalImportAcceptance.addEventListener('click', function () {
        var result = store.ensureAcceptanceEvalQuestions(actor);
        if (!result.ok) { toast(result.message); return; }
        toast(result.count ? ('已导入验收题库 ' + result.count + ' 道题') : '验收题库已经导入过了');
        renderEvalSet(actor);
      });
    }

    var evalRunSelected = document.getElementById('eval-run-selected');
    if (evalRunSelected) {
      evalRunSelected.addEventListener('click', function () {
        var ids = Array.from(document.querySelectorAll('[data-eval-select]:checked')).map(function (input) {
          return input.getAttribute('data-eval-select');
        });
        if (!ids.length) {
          toast('请先勾选要运行的评测题。');
          return;
        }
        var result = store.startEvalRun(actor, ids);
        if (!result.ok) { toast(result.message); return; }
        developerTab = 'evalRuns';
        toast('已开始后台评测，运行记录会自动刷新');
        route();
      });
    }

    var evalQuestionList = document.getElementById('eval-question-list');
    if (evalQuestionList) {
      evalQuestionList.addEventListener('click', function (event) {
        var target = event.target;
        if (!target || !target.closest) return;

        var editBtn = target.closest('[data-eval-edit]');
        if (editBtn) {
          openEvalQuestionModal(actor, editBtn.getAttribute('data-eval-edit'));
          return;
        }

        var deleteBtn = target.closest('[data-eval-delete]');
        if (deleteBtn) {
          var questionId = deleteBtn.getAttribute('data-eval-delete');
          openConfirmModal({
            title: '删除评测题',
            message: '确定要删除这道评测题吗？已运行过的记录会保留。',
            confirmText: '删除',
            danger: true,
            onConfirm: function () {
              var result = store.deleteEvalQuestion(actor, questionId);
              if (!result.ok) { toast(result.message); return; }
              toast('已删除评测题');
              renderEvalSet(actor);
            }
          });
        }
      });
    }

    var evalRunList = document.getElementById('eval-run-list');
    if (evalRunList) {
      evalRunList.addEventListener('click', function (event) {
        var btn = event.target && event.target.closest ? event.target.closest('[data-eval-review-status]') : null;
        if (!btn) return;
        var runId = btn.getAttribute('data-eval-review-run');
        var index = Number(btn.getAttribute('data-eval-review-index'));
        var status = btn.getAttribute('data-eval-review-status');
        var reasonInput = document.getElementById('eval-review-reason-' + runId + '-' + index);
        var result = store.reviewEvalResult(actor, runId, index, {
          status: status,
          reason: reasonInput ? reasonInput.value : ''
        });
        if (!result.ok) { toast(result.message); return; }
        toast(status === 'pass' ? '已标记人工通过' : '已标记人工不通过');
        renderEvalRuns(actor);
      });
    }

    var promptSave = document.getElementById('prompt-save');
    if (promptSave) {
      promptSave.addEventListener('click', function () {
        var manager = store.getPromptManager(actor);
        if (!manager) return;
        var prompts = {};
        manager.defs.forEach(function (def) {
          var textarea = document.getElementById('prompt-content-' + def.key);
          prompts[def.key] = textarea ? textarea.value : '';
        });
        var result = store.savePromptVersion(actor, {
          prompts: prompts,
          reason: document.getElementById('prompt-change-reason').value
        });
        if (!result.ok) {
          toast(result.message);
          return;
        }
        promptEditingVersionId = result.version.id;
        toast('已保存为草稿版本 ' + result.version.version + '（未发布）');
        renderPromptPanel(actor);
      });
    }

    var promptVersionList = document.getElementById('prompt-version-list');
    if (promptVersionList) {
      promptVersionList.addEventListener('click', function (event) {
        var btn = event.target && event.target.closest ? event.target.closest('[data-prompt-load]') : null;
        if (!btn) return;
        promptEditingVersionId = btn.getAttribute('data-prompt-load');
        renderPromptPanel(actor);
      });
    }

    var promptSelectAll = document.getElementById('prompt-select-all');
    if (promptSelectAll) {
      promptSelectAll.addEventListener('click', function () {
        Array.from(document.querySelectorAll('[data-prompt-eval]')).forEach(function (input) { input.checked = true; });
      });
    }

    var promptClearAll = document.getElementById('prompt-clear-all');
    if (promptClearAll) {
      promptClearAll.addEventListener('click', function () {
        Array.from(document.querySelectorAll('[data-prompt-eval]')).forEach(function (input) { input.checked = false; });
      });
    }

    var promptCompare = document.getElementById('prompt-compare');
    if (promptCompare) {
      promptCompare.addEventListener('click', function () {
        var evalIds = Array.from(document.querySelectorAll('[data-prompt-eval]:checked')).map(function (input) {
          return input.getAttribute('data-prompt-eval');
        });
        if (!evalIds.length) {
          toast('请至少勾选一道评测题。');
          return;
        }
        var versionA = document.getElementById('prompt-version-a').value;
        var versionB = document.getElementById('prompt-version-b').value;
        if (!versionA || !versionB || versionA === versionB) {
          toast('请选择两个不同的 Prompt 版本。');
          return;
        }

        var resultBox = document.getElementById('prompt-compare-result');
        if (resultBox) resultBox.innerHTML = '<p class="service-hint">正在用同一批原文逐题运行两个版本，请稍候…</p>';
        store.comparePromptVersions(actor, { versionA: versionA, versionB: versionB, evalIds: evalIds }).then(function (result) {
          if (!result.ok) {
            toast(result.message);
            if (resultBox) resultBox.innerHTML = '';
            return;
          }
          promptCompareResult = result.comparison;
          renderPromptComparison(result.comparison);
        }).catch(function () {
          toast('对比运行失败，请重试。');
          if (resultBox) resultBox.innerHTML = '';
        });
      });
    }

    var releasePanel = document.getElementById('dev-panel-release');
    if (releasePanel) {
      releasePanel.addEventListener('click', function (event) {
        var target = event.target;
        if (!target || !target.closest) return;

        var runBtn = target.closest('[data-release-run]');
        if (runBtn) {
          var draftId = runBtn.getAttribute('data-release-run');
          var runResult = store.startDraftRegression(actor, draftId);
          if (!runResult.ok) {
            toast(runResult.message);
            return;
          }
          toast('已开始回归，正在逐题运行…');
          renderReleasePanel(actor);
          pollReleaseRegression(actor, draftId);
          return;
        }

        var publishBtn = target.closest('[data-release-publish]');
        if (publishBtn) {
          var publishDraftId = publishBtn.getAttribute('data-release-publish');
          var messageEl = document.querySelector('[data-release-message="' + publishDraftId + '"]');
          var select = document.querySelector('[data-release-regression="' + publishDraftId + '"]');
          var confirmInput = document.querySelector('[data-release-confirm="' + publishDraftId + '"]');
          var noteInput = document.querySelector('[data-release-note="' + publishDraftId + '"]');
          var publishResult = store.publishDraft(actor, {
            draftId: publishDraftId,
            regressionId: select ? select.value : '',
            confirmed: !!(confirmInput && confirmInput.checked),
            note: noteInput ? noteInput.value : ''
          });
          if (!publishResult.ok) {
            if (messageEl) messageEl.textContent = publishResult.message;
            toast(publishResult.message);
            return;
          }
          toast('已发布版本 ' + publishResult.version);
          renderReleasePanel(actor);
          return;
        }

        var restoreBtn = target.closest('[data-release-restore]');
        if (restoreBtn) {
          var version = restoreBtn.getAttribute('data-release-restore');
          openConfirmModal({
            title: '恢复为新草稿',
            message: '会把历史版本 ' + version + ' 恢复成一个新草稿。它不会直接替换线上版本，仍需重新运行回归并人工确认发布。',
            confirmText: '恢复为新草稿',
            onConfirm: function () {
              var restoreResult = store.restoreReleaseVersionAsDraft(actor, version);
              if (!restoreResult.ok) { toast(restoreResult.message); return; }
              toast('已恢复为草稿 ' + restoreResult.draft.draftVersion + '，请重新回归');
              renderReleasePanel(actor);
            }
          });
        }
      });
    }

    var saveBtn = document.getElementById('dev-save-draft');    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        var result = store.saveDeveloperDraft(actor, {
          passageLimit: document.getElementById('dev-passage-limit').value,
          semanticCandidates: document.getElementById('dev-semantic-candidates').value,
          keywordCandidates: document.getElementById('dev-keyword-candidates').value
        });
        if (!result.ok) {
          toast(result.message);
          return;
        }
        toast('草稿已保存（未发布，不会影响员工）');
        renderDeveloperPage(actor);
      });
    }

    var runBtn = document.getElementById('dev-run');
    if (runBtn) {
      runBtn.addEventListener('click', function () {
        var question = document.getElementById('dev-question').value.trim();
        if (!question) {
          toast('请先输入要测试的问题。');
          return;
        }

        var limit = readDeveloperNumber(document.getElementById('dev-passage-limit'), 1, 20);
        var semantic = readDeveloperNumber(document.getElementById('dev-semantic-candidates'), 1, 100);
        var keyword = readDeveloperNumber(document.getElementById('dev-keyword-candidates'), 1, 100);
        if (limit === null || semantic === null || keyword === null) {
          toast('检索参数不合法：原文数量 1–20，候选数量 1–100。');
          return;
        }

        var department = document.getElementById('dev-department').value;
        var syntheticActor = {
          id: 'dev-test-' + department,
          name: '检索调试（' + department + '）',
          role: 'employee',
          department: department,
          enabled: true
        };

        var result = window.OnboardRetrieval.searchPolicyPassages(syntheticActor, question, {
          topK: limit,
          semanticCandidates: semantic,
          keywordCandidates: keyword
        });
        renderDeveloperResults(result);
      });
    }
  }

  /* ================== 评测集与运行记录 ================== */

  function evalRefuseLabel(question) {
    if (!question.shouldRefuse) return '正常回答';
    return question.refuseType === 'unauthorized' ? '越权应拒答' : '依据不足应拒答';
  }

  function renderEvalSet(actor) {
    var list = document.getElementById('eval-question-list');
    if (!list) return;

    store.ensureAcceptanceEvalQuestions(actor);
    var questions = store.listEvaluationQuestions(actor);
    var countEl = document.getElementById('eval-set-count');
    if (countEl) countEl.textContent = '共 ' + questions.length + ' 道题';

    if (!questions.length) {
      list.innerHTML = '<div class="ticket-empty">还没有评测题。可以新增，或从差评、知识缺口、验收题库导入。</div>';
      return;
    }

    list.innerHTML = questions.map(function (question) {
      var policyText = question.expectedPolicies.length ? question.expectedPolicies.join('、') : '未设置';
      var keywordText = question.expectedKeywords.length ? question.expectedKeywords.join('、') : '未设置';
      return '<article class="eval-question">' +
        '<label class="eval-select"><input type="checkbox" data-eval-select="' + esc(question.id) + '"> 选择</label>' +
        '<div class="eval-question-main">' +
        '  <p class="eval-question-name">' + esc(question.name) +
        (question.sourceType ? '<span class="eval-source-tag">' + esc(question.sourceType === 'acceptance' ? '验收题库' : (question.sourceType === 'feedback' ? '差评' : (question.sourceType === 'gap' ? '知识缺口' : '手工'))) + '</span>' : '') +
        '</p>' +
        '  <p class="eval-question-text">' + esc(question.question) + '</p>' +
        '  <p class="eval-question-meta">部门：' + esc(question.department) + ' · 应引用：' + esc(policyText) +
        ' · 关键词：' + esc(keywordText) + ' · 预期：' + esc(evalRefuseLabel(question)) + '</p>' +
        '</div>' +
        '<div class="eval-question-actions">' +
        '  <button type="button" class="btn btn-ghost btn-sm" data-eval-edit="' + esc(question.id) + '">编辑</button>' +
        '  <button type="button" class="btn btn-ghost btn-sm" data-eval-delete="' + esc(question.id) + '">删除</button>' +
        '</div>' +
        '</article>';
    }).join('');
  }

  function openEvalQuestionModal(actor, questionId) {
    var questions = store.listEvaluationQuestions(actor);
    var question = null;
    questions.forEach(function (item) { if (item.id === questionId) question = item; });

    var departments = store.getDepartments();
    var policyNames = [];
    store.listPolicies().forEach(function (policy) {
      if (policy && policy.name && policyNames.indexOf(policy.name) === -1) policyNames.push(policy.name);
    });

    var deptOptions = departments.map(function (dept) {
      return '<option value="' + esc(dept) + '"' + (question && question.department === dept ? ' selected' : '') + '>' + esc(dept) + '</option>';
    }).join('');
    var policyChecks = policyNames.map(function (name) {
      var checked = question && question.expectedPolicies.indexOf(name) !== -1;
      return '<label class="eval-policy-item"><input type="checkbox" class="eval-policy-check" value="' + esc(name) + '"' + (checked ? ' checked' : '') + '> ' + esc(name) + '</label>';
    }).join('');

    modalRoot.innerHTML = '' +
      '<div class="modal-overlay" id="eval-question-overlay">' +
      '  <div class="modal modal-wide" role="dialog" aria-modal="true" aria-labelledby="eval-question-title">' +
      '    <div class="modal-head">' +
      '      <h3 id="eval-question-title">' + (question ? '编辑评测题' : '新增评测题') + '</h3>' +
      '      <button type="button" class="icon-btn" data-close="1" aria-label="关闭">×</button>' +
      '    </div>' +
      '    <div class="form-error" id="eval-question-error" role="alert"></div>' +
      '    <div class="field">' +
      '      <label for="eval-name">题目名称</label>' +
      '      <input class="input" id="eval-name" type="text" maxlength="60" value="' + esc(question ? question.name : '') + '">' +
      '    </div>' +
      '    <div class="field">' +
      '      <label for="eval-question">问题</label>' +
      '      <textarea class="input" id="eval-question" rows="3" maxlength="500">' + esc(question ? question.question : '') + '</textarea>' +
      '    </div>' +
      '    <div class="field">' +
      '      <label for="eval-department">以哪个部门身份提问</label>' +
      '      <select class="input" id="eval-department">' + deptOptions + '</select>' +
      '    </div>' +
      '    <div class="field">' +
      '      <label>应该引用哪些制度</label>' +
      '      <div class="eval-policy-list">' + (policyChecks || '<p class="service-hint">还没有制度可以选择。</p>') + '</div>' +
      '    </div>' +
      '    <div class="field">' +
      '      <label for="eval-keywords">回答里应当出现的关键词（用逗号分隔）</label>' +
      '      <input class="input" id="eval-keywords" type="text" placeholder="例如：650 元/晚, 提前审批" value="' + esc(question ? question.expectedKeywords.join(', ') : '') + '">' +
      '    </div>' +
      '    <div class="field">' +
      '      <label class="eval-confirm"><input type="checkbox" id="eval-refuse"' + (question && question.shouldRefuse ? ' checked' : '') + '> 是否应该拒答（依据不足或越权）</label>' +
      '      <select class="input" id="eval-refuse-type">' +
      '        <option value="insufficient"' + (question && question.refuseType === 'insufficient' ? ' selected' : '') + '>依据不足拒答</option>' +
      '        <option value="unauthorized"' + (question && question.refuseType === 'unauthorized' ? ' selected' : '') + '>越权拒答</option>' +
      '      </select>' +
      '    </div>' +
      '    <div class="modal-foot">' +
      '      <button type="button" class="btn btn-ghost" data-close="1">取消</button>' +
      '      <button type="button" class="btn btn-primary" id="eval-question-save">保存</button>' +
      '    </div>' +
      '  </div>' +
      '</div>';

    var overlay = document.getElementById('eval-question-overlay');
    var closeModal = wireModalClose(overlay);
    var errEl = document.getElementById('eval-question-error');

    document.getElementById('eval-question-save').addEventListener('click', function () {
      hideError(errEl);
      var policies = Array.from(overlay.querySelectorAll('.eval-policy-check:checked')).map(function (input) {
        return input.value;
      });
      var keywords = document.getElementById('eval-keywords').value.split(/[,，、\s]+/).filter(Boolean);
      var input = {
        name: document.getElementById('eval-name').value,
        question: document.getElementById('eval-question').value,
        department: document.getElementById('eval-department').value,
        expectedPolicies: policies,
        expectedKeywords: keywords,
        shouldRefuse: document.getElementById('eval-refuse').checked,
        refuseType: document.getElementById('eval-refuse').checked ? document.getElementById('eval-refuse-type').value : ''
      };

      var result = question
        ? store.updateEvalQuestion(actor, question.id, input)
        : store.createEvalQuestion(actor, input);
      if (!result.ok) {
        showError(errEl, result.message);
        return;
      }
      closeModal();
      toast(question ? '评测题已更新' : '评测题已新增');
      renderEvalSet(actor);
    });
  }

  function evalCheckBadge(passed, passText, failText) {
    return '<span class="eval-check ' + (passed ? 'is-pass' : 'is-fail') + '">' + esc(passed ? passText : failText) + '</span>';
  }

  function renderEvalRuns(actor) {
    var list = document.getElementById('eval-run-list');
    if (!list) return;
    if (developerEvalTimer) {
      window.clearTimeout(developerEvalTimer);
      developerEvalTimer = null;
    }

    var runs = store.listEvalRuns(actor);
    if (!runs.length) {
      list.innerHTML = '<div class="ticket-empty">还没有运行记录。在“评测集”里勾选题目后点“运行评测”。</div>';
      return;
    }

    list.innerHTML = runs.map(function (run) {
      var statusLabel = run.status === 'running' ? '运行中' : '已完成';
      var reviewed = run.results.filter(function (item) { return item.manual && item.manual.status; }).length;
      var resultsHtml = run.results.map(function (result, index) {
        var policyCheck = result.checks.policy;
        var keywordCheck = result.checks.keyword;
        var refusalCheck = result.checks.refusal;
        var policyBadge = !policyCheck.applicable
          ? '<span class="eval-check is-skipped">未设置</span>'
          : (policyCheck.passed ? '<span class="eval-check is-pass">命中</span>' : '<span class="eval-check is-fail">未命中：' + esc(policyCheck.missing.join('、')) + '</span>');
        var keywordBadge = !keywordCheck.applicable
          ? '<span class="eval-check is-skipped">未设置</span>'
          : (keywordCheck.passed ? '<span class="eval-check is-pass">出现</span>' : '<span class="eval-check is-fail">缺少：' + esc(keywordCheck.missing.join('、')) + '</span>');
        var refusalBadge = refusalCheck.expected
          ? (refusalCheck.passed ? '<span class="eval-check is-pass">符合（拒答）</span>' : '<span class="eval-check is-fail">不符合（应拒答）</span>')
          : (refusalCheck.passed ? '<span class="eval-check is-pass">符合（正常回答）</span>' : '<span class="eval-check is-fail">不符合（不应拒答）</span>');
        var manual = result.manual || {};
        var manualBadge = manual.status === 'pass'
          ? '<span class="eval-manual is-pass">人工通过</span>'
          : (manual.status === 'fail' ? '<span class="eval-manual is-fail">人工不通过</span>' : '<span class="eval-manual">待人工复核</span>');

        return '<article class="eval-result">' +
          '<div class="eval-result-head">' +
          '  <span class="eval-result-score">' + result.score + ' 分</span>' +
          '  <span class="eval-result-title">' + esc(result.name) + '</span>' +
          '  <span class="eval-result-status ' + (result.passed ? 'is-pass' : 'is-fail') + '">' + (result.passed ? '自动通过' : '自动未通过') + '</span>' +
          '  ' + manualBadge +
          '</div>' +
          '<p class="eval-result-question">' + esc(result.question) + ' · 身份：' + esc(result.department) + '</p>' +
          '<div class="eval-checks">' +
          '  <span>制度引用：' + policyBadge + '</span>' +
          '  <span>关键词：' + keywordBadge + '</span>' +
          '  <span>拒答：' + refusalBadge + '</span>' +
          '  <span>回答状态：' + esc(result.answerStatus || '—') + '</span>' +
          '</div>' +
          '<div class="eval-review">' +
          '  <input class="input input-sm" id="eval-review-reason-' + esc(run.id) + '-' + index + '" placeholder="人工复核理由（不通过必填）" value="' + esc(manual.reason || '') + '">' +
          '  <button type="button" class="btn btn-ghost btn-sm" data-eval-review-run="' + esc(run.id) + '" data-eval-review-index="' + index + '" data-eval-review-status="pass">人工通过</button>' +
          '  <button type="button" class="btn btn-ghost btn-sm" data-eval-review-run="' + esc(run.id) + '" data-eval-review-index="' + index + '" data-eval-review-status="fail">人工不通过</button>' +
          '</div>' +
          '</article>';
      }).join('');

      return '<article class="eval-run">' +
        '<div class="eval-run-head">' +
        '  <span class="eval-run-time">' + esc(formatDateTime(run.createdAt)) + '</span>' +
        '  <span class="eval-run-status ' + (run.status === 'running' ? 'is-running' : 'is-done') + '">' + statusLabel + '</span>' +
        '  <span>进度 ' + run.completed + '/' + run.total + '</span>' +
        '  <span>自动通过 ' + run.passCount + '/' + run.total + '（' + run.passRate + '%）</span>' +
        '  <span>人工复核 ' + reviewed + '/' + run.results.length + '</span>' +
        '</div>' +
        (run.status === 'running' ? '<p class="eval-run-hint">后台逐题运行中，每 2 秒自动刷新…</p>' : '') +
        resultsHtml +
        '</article>';
    }).join('');

    var hasRunning = runs.some(function (run) { return run.status === 'running'; });
    if (hasRunning) {
      developerEvalTimer = window.setTimeout(function () {
        advanceEvalRun(actor);
      }, 2000);
    }
  }

  function advanceEvalRun(actor) {
    if (developerEvalBusy) return;
    var running = store.listEvalRuns(actor).filter(function (run) { return run.status === 'running'; });
    if (!running.length) return;

    developerEvalBusy = true;
    store.runNextEvalQuestion(actor, running[0].id).then(function () {
      developerEvalBusy = false;
      renderEvalRuns(actor);
    }).catch(function () {
      developerEvalBusy = false;
      renderEvalRuns(actor);
    });
  }

  /* ================== Prompt 管理与 A/B 对比 ================== */

  function renderPromptEditor(manager, version) {
    var editor = document.getElementById('prompt-editor');
    if (!editor) return;

    editor.innerHTML = manager.defs.map(function (def) {
      return '<div class="prompt-block">' +
        '<div class="prompt-block-head"><span class="prompt-block-name">' + esc(def.name) + '</span></div>' +
        '<p class="prompt-block-desc">' + esc(def.description) + '</p>' +
        '<textarea class="input prompt-textarea" id="prompt-content-' + esc(def.key) + '" rows="6" maxlength="5000">' +
        esc(version.prompts[def.key] || '') + '</textarea>' +
        '</div>';
    }).join('');
  }

  function renderPromptPanel(actor) {
    var manager = store.getPromptManager(actor);
    if (!manager) return;

    var versions = manager.versions;
    var selected = manager.current;
    versions.forEach(function (item) {
      if (item.id === promptEditingVersionId) selected = item;
    });
    promptEditingVersionId = selected.id;

    renderPromptEditor(manager, selected);

    var versionList = document.getElementById('prompt-version-list');
    if (versionList) {
      versionList.innerHTML = versions.map(function (item) {
        return '<div class="prompt-version-item' + (item.id === selected.id ? ' is-current' : '') + '">' +
          '<div class="prompt-version-main">' +
          '  <span class="prompt-version-tag">' + esc(item.version) + '</span>' +
          '  <span class="prompt-version-meta">' + esc(item.editor) + ' · ' + esc(formatDateTime(item.createdAt)) + '</span>' +
          '  <p class="prompt-version-reason">修改原因：' + esc(item.reason || '—') + '</p>' +
          '</div>' +
          '<button type="button" class="btn btn-ghost btn-sm" data-prompt-load="' + esc(item.id) + '">载入编辑</button>' +
          '</div>';
      }).join('');
    }

    var selectA = document.getElementById('prompt-version-a');
    var selectB = document.getElementById('prompt-version-b');
    var options = versions.map(function (item) {
      return '<option value="' + esc(item.id) + '">' + esc(item.version) + '（' + esc(item.editor) + '）</option>';
    }).join('');
    if (selectA) {
      var previousA = selectA.value;
      selectA.innerHTML = options;
      selectA.value = versions.some(function (item) { return item.id === previousA; }) ? previousA : versions[0].id;
    }
    if (selectB) {
      var previousB = selectB.value;
      selectB.innerHTML = options;
      selectB.value = versions.some(function (item) { return item.id === previousB; }) ? previousB : (versions[1] ? versions[1].id : versions[0].id);
    }

    store.ensureAcceptanceEvalQuestions(actor);
    var questions = store.listEvaluationQuestions(actor);
    var evalList = document.getElementById('prompt-eval-list');
    if (evalList) {
      evalList.innerHTML = questions.map(function (question) {
        return '<label class="prompt-eval-item"><input type="checkbox" data-prompt-eval="' + esc(question.id) + '"> ' +
          esc(question.name) + '</label>';
      }).join('');
    }

    var hint = document.getElementById('prompt-save-hint');
    if (hint) {
      hint.textContent = '当前编辑的是草稿版本 ' + selected.version + '（' + selected.editor + ' · ' +
        formatDateTime(selected.createdAt) + '）。保存后会生成新版本，不会立刻影响员工。';
    }

    renderPromptComparison(promptCompareResult);
  }

  function promptChecksText(checks) {
    var parts = [];
    if (checks && checks.policy) {
      parts.push('制度引用：' + (!checks.policy.applicable ? '未设置' : (checks.policy.passed ? '命中' : '未命中')));
    }
    if (checks && checks.keyword) {
      parts.push('关键词：' + (!checks.keyword.applicable ? '未设置' : (checks.keyword.passed ? '出现' : '缺少')));
    }
    if (checks && checks.refusal) {
      parts.push('拒答：' + (checks.refusal.expected
        ? (checks.refusal.passed ? '符合（拒答）' : '不符合（应拒答）')
        : (checks.refusal.passed ? '符合（正常回答）' : '不符合（不应拒答）')));
    }
    return parts.join(' · ');
  }

  function renderPromptComparison(comparison) {
    var box = document.getElementById('prompt-compare-result');
    if (!box) return;

    if (!comparison) {
      box.innerHTML = '';
      return;
    }

    var warningHtml = comparison.warnings && comparison.warnings.length
      ? '<ul class="prompt-warning-list">' + comparison.warnings.map(function (warning) {
        return '<li>' + esc(warning) + '</li>';
      }).join('') + '</ul>'
      : '';

    var questionsHtml = comparison.questions.map(function (item) {
      var citationsHtml = item.citations.length
        ? '<p class="prompt-citations">原文：' + item.citations.map(function (citation) {
          return '《' + esc(citation.policyName) + '》' + esc(citation.version) + ' · ' + esc(citation.positionLabel);
        }).join('；') + '</p>'
        : '<p class="prompt-citations">没有找到原文。</p>';

      function column(label, side) {
        return '<section class="prompt-compare-column">' +
          '<h4>' + esc(label) + ' · ' + esc(side.status) + ' · ' + side.score + ' 分</h4>' +
          '<p class="prompt-answer-text">' + (side.text ? esc(side.text) : '（没有回答内容）') + '</p>' +
          '<p class="prompt-checks">' + esc(promptChecksText(side.checks)) + '</p>' +
          '</section>';
      }

      return '<article class="prompt-compare-question">' +
        '<p class="prompt-compare-question-title">' + esc(item.question) + '</p>' +
        '<p class="prompt-compare-meta">身份：' + esc(item.department) + ' · 模型：' + esc(item.modelName || '—') + '</p>' +
        citationsHtml +
        '<div class="prompt-compare-columns">' +
        column('版本 A', item.a) +
        column('版本 B', item.b) +
        '</div>' +
        '</article>';
    }).join('');

    box.innerHTML = '<div class="prompt-compare-box ' + (comparison.comparable ? 'is-comparable' : 'is-warning') + '">' +
      '<div class="prompt-compare-head">' +
      '  <strong>条件检查</strong>' +
      '  <span class="prompt-compare-badge ' + (comparison.comparable ? 'is-pass' : 'is-fail') + '">' +
      (comparison.comparable ? '条件一致，可肉眼比较' : '不可直接比较') + '</span>' +
      '</div>' +
      '<p class="prompt-compare-conditions">模型：' + esc(comparison.modelName) +
      ' · 版本 A：' + esc(comparison.versionA.version) + ' · 版本 B：' + esc(comparison.versionB.version) +
      ' · 同一批评测题：' + comparison.questions.length + ' 道 · 每道题复用同一批原文</p>' +
      warningHtml +
      '<p class="service-hint">' + esc(comparison.note) + '</p>' +
      questionsHtml +
      '</div>';
  }

  /* ================== Prompt 发布工作流 ================== */

  function releaseShortText(text, length) {
    var value = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
    return value.length > length ? value.slice(0, length) + '…' : value;
  }

  function releaseDiffRows(rows) {
    if (!rows.length) return '<p class="service-hint">与线上版本没有差异。</p>';
    return '<table class="release-diff"><thead><tr><th>项目</th><th>线上</th><th>草稿</th></tr></thead><tbody>' +
      rows.map(function (row) {
        return '<tr class="is-changed">' +
          '<td>' + esc(row.label) + '</td>' +
          '<td class="release-diff-online">' + esc(releaseShortText(row.online, 120)) + '</td>' +
          '<td class="release-diff-draft">' + esc(releaseShortText(row.draft, 120)) + '</td>' +
          '</tr>';
      }).join('') + '</tbody></table>';
  }

  function renderReleasePanel(actor) {
    var config = store.getReleaseConfig(actor);
    if (!config) return;

    var onlineBox = document.getElementById('release-online');
    if (onlineBox) {
      var online = config.online;
      onlineBox.innerHTML = '<div class="release-online-card">' +
        '<div class="release-online-head"><strong>当前线上版本 ' + esc(online.version) + '</strong>' +
        '<span class="service-hint">' + esc(online.publishedBy || '') + ' · ' + esc(formatDateTime(online.publishedAt)) + '</span></div>' +
        '<p class="release-online-meta">原文数量 ' + online.settings.retrieval.passageLimit +
        ' · 语义候选 ' + online.settings.retrieval.semanticCandidates +
        ' · 关键词候选 ' + online.settings.retrieval.keywordCandidates +
        (online.note ? ' · 说明：' + esc(online.note) : '') + '</p>' +
        '</div>';
    }

    var draftsBox = document.getElementById('release-drafts');
    if (draftsBox) {
      var drafts = config.drafts.filter(function (item) { return item.status === 'draft'; });
      var draftsHtml = drafts.length ? drafts.map(function (draft) {
        var diffRows = store.diffDraftVsOnline(actor, draft.id);
        var latest = store.latestRegressionForDraft(actor, draft.id);
        var completed = store.listCompletedRegressions(actor, draft.id);

        var regressionSummary = '<p class="service-hint">还没有回归记录，发布前必须先运行回归。</p>';
        if (latest) {
          if (latest.status === 'running') {
            regressionSummary = '<p class="release-regression-running">回归进行中 ' + latest.completed + '/' + latest.total + ' 道题…</p>';
          } else if (latest.status === 'done') {
            regressionSummary = '<p class="release-regression-summary ' + (latest.passAll ? 'is-pass' : 'is-fail') + '">' +
              (latest.passAll ? '回归全部通过（' + latest.total + ' 道题）' : '回归未通过：' + latest.total + ' 道题中 ' + (latest.total - latest.results.filter(function (item) { return item.b.passed; }).length) + ' 道未通过') +
              '</p>' +
              (latest.failureReasons.length ? '<ul class="release-failure-list">' + latest.failureReasons.map(function (reason) {
                return '<li>' + esc(reason) + '</li>';
              }).join('') + '</ul>' : '');
          } else {
            regressionSummary = '<p class="release-regression-summary is-fail">回归失败，请重新运行。</p>';
          }
        }

        var regressionOptions = completed.map(function (task) {
          return '<option value="' + esc(task.id) + '">' + esc(formatDateTime(task.startedAt)) + '（' +
            (task.passAll ? '全部通过' : '有未通过') + '，' + task.total + ' 题）</option>';
        }).join('');

        return '<article class="release-draft">' +
          '<div class="release-draft-head">' +
          '  <strong>' + esc(draft.draftVersion) + '</strong>' +
          '  <span class="release-draft-meta">基于线上 ' + esc(draft.basedOn) + ' · 保存于 ' + esc(formatDateTime(draft.createdAt)) + ' · ' + esc(draft.createdBy) + '</span>' +
          '</div>' +
          '<p class="release-draft-reason">修改原因：' + esc(draft.reason || '—') + '</p>' +
          '<h4 class="release-section-title">与线上版本的差异</h4>' +
          releaseDiffRows(diffRows) +
          '<h4 class="release-section-title">回归结果</h4>' +
          regressionSummary +
          '<div class="release-regression-controls">' +
          '  <button type="button" class="btn btn-ghost btn-sm" data-release-run="' + esc(draft.id) + '">运行回归</button>' +
          (completed.length ? '<select class="input input-sm" data-release-regression="' + esc(draft.id) + '">' + regressionOptions + '</select>' : '') +
          '</div>' +
          '<h4 class="release-section-title">人工确认发布</h4>' +
          '<div class="release-publish-controls">' +
          '  <label class="eval-confirm"><input type="checkbox" data-release-confirm="' + esc(draft.id) + '"> 我已确认发布</label>' +
          '  <input class="input input-sm" data-release-note="' + esc(draft.id) + '" maxlength="300" placeholder="发布说明（至少 5 个字）">' +
          '  <button type="button" class="btn btn-primary btn-sm" data-release-publish="' + esc(draft.id) + '">人工确认发布</button>' +
          '</div>' +
          '<p class="release-message" data-release-message="' + esc(draft.id) + '"></p>' +
          '</article>';
      }).join('') : '<div class="ticket-empty">还没有草稿。在“Prompt 管理”里保存草稿后会出现在这里。</div>';

      draftsBox.innerHTML = '<h3 class="service-card-title">待发布草稿（' + drafts.length + '）</h3>' + draftsHtml;
    }

    var historyBox = document.getElementById('release-history');
    if (historyBox) {
      var history = config.history.slice().reverse();
      historyBox.innerHTML = '<h3 class="service-card-title">历史线上版本（可恢复为新草稿）</h3>' +
        (history.length ? history.map(function (item) {
          return '<div class="release-history-item">' +
            '<div><strong>' + esc(item.version) + '</strong> <span class="service-hint">' + esc(formatDateTime(item.publishedAt)) + ' · ' + esc(item.publishedBy || '') + '</span>' +
            '<p class="service-hint">' + esc(item.note || '') + '</p></div>' +
            '<button type="button" class="btn btn-ghost btn-sm" data-release-restore="' + esc(item.version) + '">恢复为新草稿</button>' +
            '</div>';
        }).join('') : '<p class="service-hint">还没有历史版本。发布新版本后，之前的版本会出现在这里。</p>');
    }
  }

  function pollReleaseRegression(actor, draftId) {
    if (releaseRegressionTimer) {
      window.clearTimeout(releaseRegressionTimer);
      releaseRegressionTimer = null;
    }

    function step() {
      store.runNextDraftRegression(actor, draftId).then(function () {
        renderReleasePanel(actor);
        var latest = store.latestRegressionForDraft(actor, draftId);
        if (latest && latest.status === 'running') {
          releaseRegressionTimer = window.setTimeout(step, 1200);
        } else {
          releaseRegressionTimer = null;
        }
      }).catch(function () {
        releaseRegressionTimer = null;
        renderReleasePanel(actor);
      });
    }

    step();
  }

  /* ================== 运营分析（产品运营） ================== */

  var analyticsRange = 30;
  var analyticsCache = null;

  function formatAnalyticsDuration(ms) {
    if (ms === null || ms === undefined || !isFinite(Number(ms))) return '—';
    var value = Math.max(0, Number(ms));
    if (value < 60 * 1000) return Math.round(value / 1000) + ' 秒';
    if (value < 3600 * 1000) return (Math.round(value / 6000) / 10) + ' 分钟';
    return (Math.round(value / 36000) / 100) + ' 小时';
  }

  function analyticsHtml(actor) {
    return '' +
      '<section class="page-head">' +
      '  <div>' +
      '    <h2 class="page-head-title">运营分析</h2>' +
      '    <p class="page-head-sub">给产品运营看的使用情况与问题分布；每个数字都可以点开核对原始记录</p>' +
      '  </div>' +
      '</section>' +
      '<div class="analytics-range">' +
      [7, 30, 90].map(function (days) {
        return '<button type="button" class="analytics-range-btn' + (analyticsRange === days ? ' is-active' : '') + '" data-analytics-range="' + days + '">近 ' + days + ' 天</button>';
      }).join('') +
      '</div>' +
      '<div class="analytics-metrics" id="analytics-metrics"></div>' +
      '<div class="analytics-charts">' +
      '  <section class="analytics-card">' +
      '    <h3 class="analytics-card-title">咨询主题分布</h3>' +
      '    <p class="analytics-definition">按关键词归类为：年假、报销、入职、请假、薪酬福利、其他。</p>' +
      '    <div id="analytics-topics"></div>' +
      '  </section>' +
      '  <section class="analytics-card">' +
      '    <h3 class="analytics-card-title">未解决问题排行</h3>' +
      '    <p class="analytics-definition">“未解决”是代理指标：依据不足、差评或转人工；不是满意度。</p>' +
      '    <div id="analytics-unresolved"></div>' +
      '  </section>' +
      '</div>' +
      '<p class="gap-group-note analytics-note">口径说明：主题按关键词归类；“未解决”是代理指标（依据不足、差评或转人工）；入职任务逾期是当前快照；制度签收完成率是累计值。不要把它们说成满意度或节省的工时。</p>';
  }

  function analyticsMetricCard(key, label, value, definition) {
    return '<button type="button" class="analytics-metric" data-analytics-metric="' + key + '">' +
      '<span class="analytics-metric-label">' + esc(label) + '</span>' +
      '<span class="analytics-metric-value">' + esc(value) + '</span>' +
      '<span class="analytics-metric-def">' + esc(definition) + '</span>' +
      '</button>';
  }

  function renderAnalyticsPage(actor) {
    var metricsBox = document.getElementById('analytics-metrics');
    var topicsBox = document.getElementById('analytics-topics');
    var unresolvedBox = document.getElementById('analytics-unresolved');
    if (!metricsBox || !topicsBox || !unresolvedBox) return;

    analyticsCache = store.getAnalytics(actor, analyticsRange);
    var stats = analyticsCache;
    if (!stats) {
      metricsBox.innerHTML = '<p class="service-hint">没有统计权限。</p>';
      return;
    }

    var total = stats.totals.consultations;
    var resolvedRate = total ? Math.round((stats.totals.resolved / total) * 100) : 0;
    var handoffRate = total ? Math.round((stats.totals.handoff / total) * 100) : 0;

    metricsBox.innerHTML = [
      analyticsMetricCard('consultations', '咨询总数', String(total), '按咨询会话创建时间统计（近 ' + stats.rangeDays + ' 天）。'),
      analyticsMetricCard('resolved', '已解决比例', resolvedRate + '%（' + stats.totals.resolved + '/' + total + '）', '代理指标：会话没有依据不足、差评或转人工时计为已解决；不是满意度。'),
      analyticsMetricCard('handoff', '转人工比例', handoffRate + '%（' + stats.totals.handoff + '/' + total + '）', '会话生成了人工工单的比例（近 ' + stats.rangeDays + ' 天）。'),
      analyticsMetricCard('response', '工单平均首次响应', formatAnalyticsDuration(stats.totals.avgFirstResponseMs), '工单创建到 HR 第一次回复/改状态的平均时长；未响应工单不计入平均值（已响应 ' + stats.totals.respondedTickets + ' 单）。'),
      analyticsMetricCard('overdue', '入职任务逾期数', String(stats.totals.overdueTasks), '当前快照：未完成且截止日期早于今天，不受时间范围影响。'),
      analyticsMetricCard('signoff', '制度签收完成率', stats.totals.signoffRate + '%（' + stats.totals.signoffSigned + '/' + stats.totals.signoffRequired + '）', '累计值：所有签收活动已签收人次 / 应签收人次。')
    ].join('');

    topicsBox.innerHTML = stats.topicDistribution.map(function (item) {
      var percent = total ? Math.round((item.count / total) * 100) : 0;
      return '<button type="button" class="analytics-bar-row" data-analytics-topic="' + esc(item.topic) + '">' +
        '<span class="analytics-bar-label">' + esc(item.topic) + '</span>' +
        '<span class="analytics-bar-track"><span class="analytics-bar-fill" style="width:' + percent + '%"></span></span>' +
        '<span class="analytics-bar-value">' + item.count + '（' + percent + '%）</span>' +
        '</button>';
    }).join('');

    unresolvedBox.innerHTML = stats.unresolvedRanking.length
      ? stats.unresolvedRanking.map(function (item) {
        return '<button type="button" class="analytics-bar-row" data-analytics-unresolved="' + esc(item.topic) + '">' +
          '<span class="analytics-bar-label">' + esc(item.topic) + '</span>' +
          '<span class="analytics-bar-track"><span class="analytics-bar-fill is-warn" style="width:' + (stats.totals.unresolved ? Math.round((item.count / stats.totals.unresolved) * 100) : 0) + '%"></span></span>' +
          '<span class="analytics-bar-value">' + item.count + ' 条</span>' +
          '</button>';
      }).join('')
      : '<p class="service-hint">这个时间范围内没有未解决记录。</p>';
  }

  function analyticsSessionRecordHtml(record) {
    return '<li class="analytics-record">' +
      '<p class="analytics-record-title">' + esc(record.title) + '</p>' +
      '<p class="analytics-record-meta">' + esc(formatDateTime(record.time)) + ' · ' + esc(record.userName) +
      (record.department ? ' · ' + esc(record.department) : '') +
      (record.reasons && record.reasons.length ? ' · ' + esc(record.reasons.join('、')) : '') +
      (record.ticketTitle ? ' · 工单：' + esc(record.ticketTitle) : '') + '</p>' +
      '</li>';
  }

  function openAnalyticsRecordsModal(title, groups) {
    var groupsHtml = (groups || []).map(function (group) {
      var records = group.records || [];
      return '<section class="analytics-record-group">' +
        '<h4 class="analytics-record-group-title">' + esc(group.label) + '（' + records.length + '）</h4>' +
        (records.length ? '<ul class="analytics-record-list">' + records.map(function (record) {
          if (group.kind === 'response') {
            return '<li class="analytics-record">' +
              '<p class="analytics-record-title">' + esc(record.title) + '</p>' +
              '<p class="analytics-record-meta">' + esc(record.employeeName) + (record.department ? ' · ' + esc(record.department) : '') +
              ' · 创建 ' + esc(formatDateTime(record.createdAt)) +
              (record.responded ? ' · 首次响应 ' + esc(formatDateTime(record.firstResponseAt)) + ' · ' + esc(formatAnalyticsDuration(record.durationMs)) : ' · 尚未响应') +
              '</p></li>';
          }
          if (group.kind === 'task') {
            return '<li class="analytics-record">' +
              '<p class="analytics-record-title">' + esc(record.name) + '</p>' +
              '<p class="analytics-record-meta">' + esc(record.employeeName) + (record.department ? ' · ' + esc(record.department) : '') + ' · 截止 ' + esc(record.dueDate) + ' · ' + esc(record.statusLabel) + '</p></li>';
          }
          if (group.kind === 'signoff') {
            return '<li class="analytics-record">' +
              '<p class="analytics-record-title">' + esc(record.policyName) + '</p>' +
              '<p class="analytics-record-meta">范围 ' + esc(record.scope) + ' · 已签收 ' + record.signed + '/' + record.required + '（' + record.rate + '%）</p></li>';
          }
          return analyticsSessionRecordHtml(record);
        }).join('') + '</ul>' : '<p class="service-hint">没有记录。</p>') +
        '</section>';
    }).join('');

    modalRoot.innerHTML = '' +
      '<div class="modal-overlay" id="analytics-records-overlay">' +
      '  <div class="modal modal-wide" role="dialog" aria-modal="true" aria-labelledby="analytics-records-title">' +
      '    <div class="modal-head">' +
      '      <h3 id="analytics-records-title">' + esc(title) + '</h3>' +
      '      <button type="button" class="icon-btn" data-close="1" aria-label="关闭">×</button>' +
      '    </div>' +
      '    <div class="analytics-record-groups">' + groupsHtml + '</div>' +
      '    <div class="modal-foot"><button type="button" class="btn btn-primary" data-close="1">关闭</button></div>' +
      '  </div>' +
      '</div>';

    wireModalClose(document.getElementById('analytics-records-overlay'));
  }

  function wireAnalyticsPage() {
    var actor = store.currentUser();
    var page = document.getElementById('page-content');
    if (!page || !actor) return;

    $$('[data-analytics-range]', page).forEach(function (btn) {
      btn.addEventListener('click', function () {
        analyticsRange = Number(btn.getAttribute('data-analytics-range')) || 30;
        route();
      });
    });

    page.addEventListener('click', function (event) {
      var target = event.target;
      if (!target || !target.closest) return;
      if (!analyticsCache) return;

      var metricBtn = target.closest('[data-analytics-metric]');
      if (metricBtn) {
        var key = metricBtn.getAttribute('data-analytics-metric');
        var stats = analyticsCache;
        if (key === 'consultations') {
          openAnalyticsRecordsModal('咨询总数 · 原始咨询记录', [{ label: '咨询记录', records: stats.lists.consultations }]);
        } else if (key === 'resolved') {
          openAnalyticsRecordsModal('已解决比例 · 原始记录', [
            { label: '已解决', records: stats.lists.resolved },
            { label: '未解决', records: stats.lists.unresolved }
          ]);
        } else if (key === 'handoff') {
          openAnalyticsRecordsModal('转人工比例 · 原始记录', [{ label: '生成工单的咨询', records: stats.lists.handoff }]);
        } else if (key === 'response') {
          openAnalyticsRecordsModal('工单平均首次响应 · 原始工单', [{ label: '工单响应记录', kind: 'response', records: stats.lists.responses }]);
        } else if (key === 'overdue') {
          openAnalyticsRecordsModal('入职任务逾期 · 当前快照', [{ label: '逾期任务', kind: 'task', records: stats.lists.overdueTasks }]);
        } else if (key === 'signoff') {
          openAnalyticsRecordsModal('制度签收完成率 · 累计记录', [{ label: '签收活动', kind: 'signoff', records: stats.lists.signoffs }]);
        }
        return;
      }

      var topicBtn = target.closest('[data-analytics-topic]');
      if (topicBtn) {
        var topic = topicBtn.getAttribute('data-analytics-topic');
        var topicItem = analyticsCache.topicDistribution.filter(function (item) { return item.topic === topic; })[0];
        openAnalyticsRecordsModal('咨询主题：' + topic, [{ label: topic + ' 咨询', records: topicItem ? topicItem.records : [] }]);
        return;
      }

      var unresolvedBtn = target.closest('[data-analytics-unresolved]');
      if (unresolvedBtn) {
        var unresolvedTopic = unresolvedBtn.getAttribute('data-analytics-unresolved');
        var rankItem = analyticsCache.unresolvedRanking.filter(function (item) { return item.topic === unresolvedTopic; })[0];
        openAnalyticsRecordsModal('未解决排行：' + unresolvedTopic, [{ label: '未解决记录', records: rankItem ? rankItem.records : [] }]);
      }
    });
  }

  /* ================== 制度冲突检查 ================== */

  function policyConflictsHtml(actor) {
    return '' +
      '<section class="page-head">' +
      '  <div>' +
      '    <h2 class="page-head-title">制度冲突检查</h2>' +
      '    <p class="page-head-sub">待发布制度与已发布、范围相同或重叠的制度逐段对比，由负责人逐项确认后才能发布</p>' +
      '  </div>' +
      '</section>' +
      '<p class="gap-group-note">这是候选差异检查，不是法律判断，也不是完整语义推理；可能漏检，也可能把不同情境误列为差异。</p>' +
      '<div id="policy-conflict-list"></div>';
  }

  function renderPolicyConflicts(actor) {
    var list = document.getElementById('policy-conflict-list');
    if (!list) return;

    var policies = store.listPolicies().filter(function (policy) {
      return policy && policy.status === 'ready';
    });
    if (!policies.length) {
      list.innerHTML = '<div class="ticket-empty">目前没有“待发布”的制度。上传并等待解析完成后，会出现在这里。</div>';
      return;
    }

    list.innerHTML = policies.map(function (policy) {
      var gate = store.getPolicyConflictGate(policy.id);
      var publishLabel = gate.unreviewed > 0 ? '尚有 ' + gate.unreviewed + ' 项未确认' : '发布';
      return '<article class="conflict-policy">' +
        '<div class="conflict-policy-main">' +
        '  <p class="conflict-policy-name">' + esc(policy.name) + ' <span class="conflict-policy-meta">' + esc(policy.version) + ' · ' + esc(policy.scope) + '</span></p>' +
        '  <p class="conflict-policy-stats">候选差异 ' + gate.total + ' 项 · 已确认 ' + gate.reviewed + ' 项 · 未确认 ' + gate.unreviewed + ' 项</p>' +
        '</div>' +
        '<div class="conflict-policy-actions">' +
        '  <button type="button" class="btn btn-primary btn-sm" data-conflict-open="' + esc(policy.id) + '">检查与确认</button>' +
        '  <button type="button" class="btn ' + (gate.unreviewed > 0 ? 'btn-ghost' : 'btn-primary') + ' btn-sm" data-conflict-publish="' + esc(policy.id) + '">' + esc(publishLabel) + '</button>' +
        '</div>' +
        '</article>';
    }).join('');
  }

  function conflictSideHtml(label, side) {
    return '<div class="conflict-side">' +
      '<p class="conflict-side-label">' + esc(label) + '</p>' +
      '<p class="conflict-side-policy">《' + esc(side.policyName) + '》 ' + esc(side.version) + ' · ' + esc(side.positionLabel) + '</p>' +
      '<p class="conflict-side-text">' + esc(side.text) + '</p>' +
      '</div>';
  }

  function openPolicyConflictModal(policyId) {
    var actor = store.currentUser();
    var result = store.listPolicyConflictCandidates(actor, policyId);
    if (!result.ok) {
      toast(result.message);
      return;
    }

    var candidates = result.candidates;
    var candidatesHtml = candidates.length ? candidates.map(function (candidate, index) {
      var decisionName = 'conflict-decision-' + candidate.signature;
      return '<article class="conflict-candidate">' +
        '<div class="conflict-candidate-head">' +
        '  <span class="conflict-type">' + esc(candidate.typeLabel) + '</span>' +
        '  <span class="conflict-index">#' + (index + 1) + '</span>' +
        (candidate.reviewed ? '<span class="conflict-reviewed">已确认：' + (candidate.decision === 'conflict' ? '确实冲突，需要处理' : '不冲突，只是情境不同') + '</span>' : '<span class="conflict-pending">待确认</span>') +
        '</div>' +
        '<div class="conflict-columns">' +
        conflictSideHtml('新制度（待发布）', candidate.newSide) +
        conflictSideHtml('已发布制度', candidate.oldSide) +
        '</div>' +
        '<div class="conflict-review-controls">' +
        '  <label><input type="radio" name="' + esc(decisionName) + '" value="conflict"' + (candidate.decision === 'conflict' ? ' checked' : '') + '> 确实冲突，需要处理</label>' +
        '  <label><input type="radio" name="' + esc(decisionName) + '" value="different"' + (candidate.decision === 'different' ? ' checked' : '') + '> 不冲突，只是情境不同</label>' +
        '  <textarea class="input input-sm" id="conflict-reason-' + esc(candidate.signature) + '" rows="2" maxlength="300" placeholder="判断理由（必填）">' + esc(candidate.reason || '') + '</textarea>' +
        '  <button type="button" class="btn btn-ghost btn-sm" data-conflict-save="' + esc(candidate.signature) + '">保存判断</button>' +
        '</div>' +
        '</article>';
    }).join('') : '<div class="ticket-empty">没有发现候选差异，可以直接发布。</div>';

    modalRoot.innerHTML = '' +
      '<div class="modal-overlay" id="policy-conflict-overlay">' +
      '<div class="modal modal-wide" role="dialog" aria-modal="true" aria-labelledby="policy-conflict-title">' +
      '  <div class="modal-head">' +
      '    <h3 id="policy-conflict-title">冲突检查 · ' + esc(result.policy.name) + '</h3>' +
      '    <button type="button" class="icon-btn" data-close="1" aria-label="关闭">×</button>' +
      '  </div>' +
      '  <p class="modal-sub">候选 ' + result.total + ' 项 · 已确认 ' + result.reviewed + ' 项 · 未确认 ' + result.unreviewed + ' 项。请逐项判断并写理由。</p>' +
      '  <div class="conflict-candidates">' + candidatesHtml + '</div>' +
      '  <div class="modal-foot">' +
      '    <button type="button" class="btn btn-ghost" data-close="1">关闭</button>' +
      '    <button type="button" class="btn ' + (result.unreviewed > 0 ? 'btn-ghost' : 'btn-primary') + '" data-conflict-publish="' + esc(policyId) + '">' + (result.unreviewed > 0 ? '尚有 ' + result.unreviewed + ' 项未确认' : '发布') + '</button>' +
      '  </div>' +
      '</div></div>';

    var overlay = document.getElementById('policy-conflict-overlay');
    wireModalClose(overlay);

    $$('[data-conflict-save]', overlay).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var signature = btn.getAttribute('data-conflict-save');
        var radios = overlay.querySelectorAll('input[name="conflict-decision-' + signature + '"]');
        var decision = '';
        Array.prototype.forEach.call(radios, function (radio) {
          if (radio.checked) decision = radio.value;
        });
        var reasonEl = document.getElementById('conflict-reason-' + signature);
        var saveResult = store.reviewPolicyConflict(actor, policyId, signature, decision, reasonEl ? reasonEl.value : '');
        if (!saveResult.ok) {
          toast(saveResult.message);
          return;
        }
        toast('已保存判断');
        renderPolicyConflicts(actor);
        openPolicyConflictModal(policyId);
      });
    });
  }

  function wirePolicyConflictsPage() {
    var page = document.getElementById('page-content');
    if (!page) return;
    page.addEventListener('click', function (event) {
      var target = event.target;
      if (!target || !target.closest) return;

      var openBtn = target.closest('[data-conflict-open]');
      if (openBtn) {
        openPolicyConflictModal(openBtn.getAttribute('data-conflict-open'));
        return;
      }

      var publishBtn = target.closest('[data-conflict-publish]');
      if (publishBtn) {
        var policyId = publishBtn.getAttribute('data-conflict-publish');
        var result = store.publishPolicy(policyId);
        if (!result.ok) {
          toast(result.message);
          return;
        }
        var overlay = document.getElementById('policy-conflict-overlay');
        if (overlay) modalRoot.innerHTML = '';
        toast('已发布：' + result.policy.name);
        route();
      }
    });
  }

  /* ================== 飞书接入（预备功能，仅系统管理员） ================== */

  function feishuHtml(actor) {
    var config = store.getFeishuConfig(actor);
    if (!config) {
      return '<section class="page-head"><h2 class="page-head-title">飞书接入</h2></section><p class="service-hint">只有系统管理员可以配置飞书接入。</p>';
    }
    var bindings = store.listFeishuBindings(actor);
    var users = store.listUsers().filter(function (user) { return user && user.enabled !== false; });

    return '' +
      '<section class="page-head">' +
      '  <div>' +
      '    <h2 class="page-head-title">飞书接入</h2>' +
      '    <p class="page-head-sub">企业应用信息与飞书身份绑定（预备功能）</p>' +
      '  </div>' +
      '</section>' +
      '<p class="gap-group-note">当前未与真实企业飞书联调，不含机器人消息通知。</p>' +
      '<p class="service-hint">员工通过飞书打开本产品时，<strong>不会按姓名自动创建账号</strong>。必须由管理员把某个飞书身份明确绑定到某个已有员工账号；绑定后该员工用飞书进入时，权限与账号完全一致。</p>' +
      '<div class="feishu-grid">' +
      '  <section class="service-card">' +
      '    <h3 class="service-card-title">企业应用信息</h3>' +
      '    <div class="field"><label for="feishu-app-name">应用名称</label><input class="input" id="feishu-app-name" type="text" maxlength="40" value="' + esc(config.appName) + '"></div>' +
      '    <div class="field"><label for="feishu-app-id">App ID</label><input class="input" id="feishu-app-id" type="text" maxlength="100" value="' + esc(config.appId) + '"></div>' +
      '    <div class="field">' +
      '      <label for="feishu-app-secret">App Secret</label>' +
      '      <input class="input" id="feishu-app-secret" type="password" maxlength="200" autocomplete="new-password" placeholder="' + (config.hasSecret ? '已加密保存，留空则不修改' : '填写后加密保存，不会回显') + '">' +
      '      <p class="hint">密钥使用本机设备密钥加密保存，页面不会显示明文。</p>' +
      '    </div>' +
      '    <p class="service-hint" id="feishu-config-status">' +
      (config.updatedAt ? ('最近保存：' + esc(formatDateTime(config.updatedAt)) + ' · ' + esc(config.updatedBy || '') + ' · 密钥' + (config.hasSecret ? '已设置' : '未设置')) : '还没有保存过企业应用信息。') +
      '    </p>' +
      '    <div class="service-actions"><button type="button" class="btn btn-primary btn-sm" id="feishu-save">保存企业应用信息</button></div>' +
      '  </section>' +
      '  <section class="service-card">' +
      '    <h3 class="service-card-title">飞书身份绑定</h3>' +
      '    <p class="service-hint">绑定到已有员工账号；同一个飞书身份和同一个员工账号都只能各绑定一次。</p>' +
      '    <div class="field"><label for="feishu-identity">飞书身份标识（open_id / user_id）</label><input class="input" id="feishu-identity" type="text" maxlength="100" placeholder="例如：ou_xxx 或 user_id"></div>' +
      '    <div class="field"><label for="feishu-employee">绑定到员工账号</label><select class="input" id="feishu-employee">' +
      users.map(function (user) {
        return '<option value="' + esc(user.id) + '">' + esc(user.name) + '（' + esc(user.account) + ' · ' + esc(user.department) + '）</option>';
      }).join('') +
      '    </select></div>' +
      '    <div class="service-actions"><button type="button" class="btn btn-primary btn-sm" id="feishu-bind">绑定飞书身份</button></div>' +
      '    <div class="table-card" style="margin-top:12px;">' +
      '      <table class="data-table inquiry-table"><thead><tr><th>飞书身份标识</th><th>员工账号</th><th>姓名</th><th>部门</th><th>绑定时间</th><th>操作</th></tr></thead><tbody>' +
      (bindings.length ? bindings.map(function (binding) {
        return '<tr><td class="cell-mono">' + esc(binding.feishuId) + '</td><td>' + esc(binding.employeeAccount) + '</td><td>' + esc(binding.employeeName) +
          '</td><td>' + esc(binding.department) + '</td><td>' + esc(formatDateTime(binding.createdAt)) +
          '</td><td><button type="button" class="btn btn-ghost btn-sm" data-feishu-unbind="' + esc(binding.id) + '">解除绑定</button></td></tr>';
      }).join('') : '<tr><td colspan="6" class="policy-empty">还没有飞书身份绑定。</td></tr>') +
      '      </tbody></table>' +
      '    </div>' +
      '  </section>' +
      '</div>';
  }

  function wireFeishuPage() {
    var actor = store.currentUser();
    if (!actor) return;

    var saveBtn = document.getElementById('feishu-save');
    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        saveBtn.disabled = true;
        store.saveFeishuConfig(actor, {
          appName: document.getElementById('feishu-app-name').value,
          appId: document.getElementById('feishu-app-id').value,
          appSecret: document.getElementById('feishu-app-secret').value
        }).then(function (result) {
          saveBtn.disabled = false;
          if (!result.ok) { toast(result.message); return; }
          toast('飞书企业应用信息已保存（密钥已加密）');
          route();
        }).catch(function () {
          saveBtn.disabled = false;
          toast('保存失败，请重试。');
        });
      });
    }

    var bindBtn = document.getElementById('feishu-bind');
    if (bindBtn) {
      bindBtn.addEventListener('click', function () {
        var result = store.bindFeishuIdentity(actor, {
          feishuId: document.getElementById('feishu-identity').value,
          employeeId: document.getElementById('feishu-employee').value
        });
        if (!result.ok) { toast(result.message); return; }
        toast('已绑定飞书身份');
        route();
      });
    }

    var page = document.getElementById('page-content');
    if (page) {
      page.addEventListener('click', function (event) {
        var btn = event.target && event.target.closest ? event.target.closest('[data-feishu-unbind]') : null;
        if (!btn) return;
        var bindingId = btn.getAttribute('data-feishu-unbind');
        openConfirmModal({
          title: '解除飞书绑定',
          message: '解除后，这个飞书身份将无法进入本产品，员工账号本身和权限不受影响。',
          confirmText: '解除绑定',
          danger: true,
          onConfirm: function () {
            var result = store.unbindFeishuIdentity(actor, bindingId);
            if (!result.ok) { toast(result.message); return; }
            toast('已解除飞书绑定');
            route();
          }
        });
      });
    }
  }

  /* ================== 操作审计（系统管理员） ================== */

  var auditActionFilter = 'all';
  var auditTimeFilter = 'all';
  var AUDIT_TIME_OPTIONS = [
    { value: 'all', label: '全部时间' },
    { value: 'today', label: '今天' },
    { value: '7', label: '近 7 天' },
    { value: '30', label: '近 30 天' },
    { value: '90', label: '近 90 天' }
  ];

  function auditCutoff(timeFilter) {
    if (timeFilter === 'today') {
      var now = new Date();
      return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    }
    if (timeFilter === '7' || timeFilter === '30' || timeFilter === '90') {
      return Date.now() - Number(timeFilter) * 24 * 3600 * 1000;
    }
    return 0;
  }

  function auditHtml(actor) {
    var logs = store.listAuditLog(500);
    var actions = [];
    logs.forEach(function (entry) {
      if (entry && entry.action && actions.indexOf(entry.action) === -1) actions.push(entry.action);
    });

    var cutoff = auditCutoff(auditTimeFilter);
    var filtered = logs.filter(function (entry) {
      if (!entry) return false;
      if (auditActionFilter !== 'all' && entry.action !== auditActionFilter) return false;
      if (cutoff && new Date(entry.createdAt).getTime() < cutoff) return false;
      return true;
    });

    return '' +
      '<section class="page-head">' +
      '  <div>' +
      '    <h2 class="page-head-title">操作审计</h2>' +
      '    <p class="page-head-sub">记录谁、在什么时间、对什么对象、做了什么关键操作</p>' +
      '  </div>' +
      '</section>' +
      '<p class="gap-group-note">这是事实线索，不等于完整的合规认证。</p>' +
      '<div class="messages-toolbar">' +
      '  <div class="messages-actions">' +
      '    <select class="input input-sm" id="audit-action-filter" aria-label="操作类型筛选">' +
      '      <option value="all">全部操作类型</option>' +
      actions.map(function (action) {
        return '<option value="' + esc(action) + '"' + (auditActionFilter === action ? ' selected' : '') + '>' + esc(action) + '</option>';
      }).join('') +
      '    </select>' +
      '    <select class="input input-sm" id="audit-time-filter" aria-label="时间筛选">' +
      AUDIT_TIME_OPTIONS.map(function (item) {
        return '<option value="' + esc(item.value) + '"' + (auditTimeFilter === item.value ? ' selected' : '') + '>' + esc(item.label) + '</option>';
      }).join('') +
      '    </select>' +
      '    <span class="messages-summary">共 ' + filtered.length + ' 条记录</span>' +
      '  </div>' +
      '</div>' +
      '<div class="table-card">' +
      '  <table class="data-table inquiry-table"><thead><tr><th>操作</th><th>操作者</th><th>目标标识</th><th>时间</th></tr></thead><tbody>' +
      (filtered.length ? filtered.map(function (entry) {
        return '<tr><td>' + esc(entry.action || '') + '</td><td>' + esc(entry.actorName || '') +
          '</td><td>' + esc(entry.target || '—') + '</td><td>' + esc(formatDateTime(entry.createdAt)) + '</td></tr>';
      }).join('') : '<tr><td colspan="4" class="policy-empty">没有符合条件的审计记录。</td></tr>') +
      '</tbody></table>' +
      '</div>';
  }

  function wireAuditPage() {
    var actionSelect = document.getElementById('audit-action-filter');
    var timeSelect = document.getElementById('audit-time-filter');
    function apply() {
      auditActionFilter = actionSelect ? actionSelect.value : 'all';
      auditTimeFilter = timeSelect ? timeSelect.value : 'all';
      route();
    }
    if (actionSelect) actionSelect.addEventListener('change', apply);
    if (timeSelect) timeSelect.addEventListener('change', apply);
  }

  /* ================== 后台无权限页 ================== */

  function renderBackendDenied(user, backend) {
    stopPolicyTimer();
    var title = BACKEND_TITLES[backend] || '管理后台';
    appEl.innerHTML = '' +
      '<div class="portal-page">' +
      '  <header class="portal-topbar">' +
      '    <div class="portal-brand"><span class="portal-brand-mark">初</span><span class="portal-brand-name">初见 Onboard</span></div>' +
      '    <div class="portal-user"><span class="portal-user-name">' + esc(user.name) + ' · ' + esc(window.OnboardRoles.labelOf(user.role)) + '</span></div>' +
      '  </header>' +
      '  <main class="portal-main">' +
      '    <div class="backend-denied-card">' +
      '      <span class="portal-card-kicker">权限校验未通过</span>' +
      '      <h1 class="portal-title">当前账号无权进入' + esc(title) + '</h1>' +
      '      <p class="portal-subtitle">当前角色是“' + esc(window.OnboardRoles.labelOf(user.role)) + '”。后台数据接口也会按角色再次校验，不能通过直接输入地址绕过。</p>' +
      '      <div class="backend-denied-actions">' +
      '        <a class="btn btn-primary" href="../index.html">返回首页</a>' +
      '        <button type="button" class="btn btn-ghost" id="backend-denied-logout">退出当前账号</button>' +
      '      </div>' +
      '    </div>' +
      '  </main>' +
      '  <footer class="portal-footer">服务端按账号角色校验权限 · 学习演示独立于真实业务</footer>' +
      '</div>';

    var logoutBtn = document.getElementById('backend-denied-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function () {
        store.clearSession();
        renderLogin();
        toast('已退出当前账号');
      });
    }
  }

  /* ================== 路由与权限检查 ================== */

  function pageFromHash() {
    var raw = String(window.location.hash || '').replace(/^#\/?/, '');
    if (!raw) return 'overview';
    return raw.split('?')[0];
  }

  /**
   * 内部页面权限检查：页面必须存在，且当前角色有对应的权限点。
   * 所有页面渲染都必须先经过这里，不能只靠导航栏隐藏入口。
   */
  function canViewPage(user, page) {
    var def = PAGES[page];
    if (!def) return false;
    return window.OnboardRoles.can(user, def.capability);
  }

  function go(page) {
    var target = '#/' + page;
    if (window.location.hash !== target) {
      window.location.hash = target;
    }
    route();
  }

  function enterApp() {
    if (window.location.hash) {
      window.location.hash = '';
    }
    route();
  }

  function routeAfterLogin(user) {
    if (ASSISTANT_ENTRY) {
      enterApp();
      return;
    }

    var canHr = canAccessBackend(user, 'hr');
    var canOps = canAccessBackend(user, 'ops');

    if (BACKEND_ENTRY) {
      if (canAccessBackend(user, BACKEND_ENTRY)) {
        window.location.hash = '';
        route();
        return;
      }
      if (canHr) {
        window.location.href = '../hr/index.html';
        return;
      }
      if (canOps) {
        window.location.href = '../ops/index.html';
        return;
      }
      window.location.href = '../index.html#/assistant';
      return;
    }

    if (canHr && canOps) {
      window.location.hash = '';
      route();
      return;
    }
    if (canHr) {
      window.location.href = 'hr/index.html';
      return;
    }
    if (canOps) {
      window.location.href = 'ops/index.html';
      return;
    }
    window.location.hash = '#/assistant';
    route();
  }

  /* ================== 门户首页（网站根地址，未带 # 路由时显示） ================== */

  function renderPortal(user) {
    stopPolicyTimer();
    var roleLabel = user ? window.OnboardRoles.labelOf(user.role) : '';
    var canHR = !!(user && window.OnboardRoles.can(user, 'page:employees'));
    var canOps = !!(user && window.OnboardRoles.can(user, 'page:analytics'));

    function portalCard(options) {
      var content = '<span class="portal-card-kicker">' + esc(options.kicker) + '</span>' +
        '<h2 class="portal-card-title">' + esc(options.title) + '</h2>' +
        '<p class="portal-card-desc">' + esc(options.description) + '</p>' +
        '<p class="portal-card-audience">' + esc(options.audience) + '</p>';

      if (options.disabled) {
        return '<div class="portal-card is-disabled">' + content +
          '<p class="portal-card-denied">当前账号无此后台权限</p>' +
          '</div>';
      }

      return '<a class="portal-card" href="' + esc(options.href) + '">' + content +
        '<span class="portal-card-enter">' + esc(options.enterText) + ' →</span>' +
        '</a>';
    }

    var employeeCard = portalCard({
      kicker: '员工服务',
      title: '员工页',
      description: '咨询制度、查询本人年假，跟进工单与入职任务。',
      audience: '适用：所有已登录成员',
      href: '#/assistant',
      enterText: user ? '进入员工页' : '登录后进入'
    });

    var hrCard;
    if (user && !canHR) {
      hrCard = portalCard({
        kicker: '管理后台',
        title: 'HR 管理后台',
        description: '维护组织与员工信息，管理制度发布和员工服务。',
        audience: '适用：HR、系统管理员',
        disabled: true,
        href: '',
        enterText: ''
      });
    } else {
      hrCard = portalCard({
        kicker: '管理后台',
        title: 'HR 管理后台',
        description: '维护组织与员工信息，管理制度发布和员工服务。',
        audience: '适用：HR、系统管理员',
        href: 'hr/index.html',
        enterText: user ? '进入 HR 管理后台' : '登录后进入'
      });
    }

    var opsCard;
    if (user && !canOps) {
      opsCard = portalCard({
        kicker: '运营后台',
        title: '产品运营后台',
        description: '观察产品运行质量，优化知识检索、提示词和评测。',
        audience: '适用：产品运营、系统管理员',
        disabled: true,
        href: '',
        enterText: ''
      });
    } else {
      opsCard = portalCard({
        kicker: '运营后台',
        title: '产品运营后台',
        description: '观察产品运行质量，优化知识检索、提示词和评测。',
        audience: '适用：产品运营、系统管理员',
        href: 'ops/index.html',
        enterText: user ? '进入产品运营后台' : '登录后进入'
      });
    }

    var learningCard = portalCard({
      kicker: '学习演示',
      title: '学习后台',
      description: '学习产品设计、PRD 与架构，通过案例和实训理解 AI 助手。学习内容对所有人开放，其中调用 AI 的功能需要登录。',
      audience: '已开放 · /academy',
      href: 'academy/index.html',
      enterText: '进入学习后台'
    });

    var userHtml = user
      ? '<span class="portal-user-name">' + esc(user.name) + ' · ' + esc(roleLabel) + '</span>'
      : '<a class="portal-login-link" href="#/overview">登录</a>';

    appEl.innerHTML = '' +
      '<div class="portal-page">' +
      '  <header class="portal-topbar">' +
      '    <div class="portal-brand">' +
      '      <span class="portal-brand-mark">初</span>' +
      '      <span class="portal-brand-name">初见 Onboard</span>' +
      '    </div>' +
      '    <div class="portal-user">' + userHtml + '</div>' +
      '  </header>' +
      '  <main class="portal-main">' +
      '    <div class="portal-intro">' +
      '      <h1 class="portal-title">选择你的工作空间</h1>' +
      '      <p class="portal-subtitle">从员工服务到产品运营，让每个角色专注自己的工作。</p>' +
      '    </div>' +
      '    <div class="portal-grid">' + employeeCard + hrCard + opsCard + learningCard + '</div>' +
      '  </main>' +
      '  <footer class="portal-footer">服务端按账号角色校验权限 · 学习演示独立于真实业务</footer>' +
      '</div>';

    document.title = '选择你的工作空间 · 初见 Onboard';

    $$('.portal-card[href]', appEl).forEach(function (card) {
      card.addEventListener('click', function (event) {
        var href = card.getAttribute('href') || '';
        if (href.indexOf('#/') === 0) {
          event.preventDefault();
          go(href.slice(2));
          return;
        }
        if (href) {
          event.preventDefault();
          window.location.href = href;
        }
      });
    });
  }

  function renderShell(user, page, view) {
    stopPolicyTimer();

    if (ASSISTANT_ENTRY) {
      renderAssistantEntryShell(user);
      return;
    }

    var def = PAGES[page] || null;
    var title = '工作概览';
    var content = overviewHtml(user);
    var activePage = '';

    if (view === 'notfound') {
      title = '页面不存在';
      content = stateMessageHtml(user, '没有找到这个页面', '你访问的页面可能不存在，或者地址写错了。请从左侧导航进入。');
    } else if (view === 'denied') {
      title = '无权访问';
      content = stateMessageHtml(user, '你没有访问这个页面的权限', '这个页面只对特定角色开放。如果工作确实需要，请联系公司管理员。');
    } else if (def) {
      title = def.title;
      activePage = page;
      content = def.render(user);
    }

    appEl.innerHTML = '' +
      '<div class="app-shell">' +
      sidebarHtml(user, activePage) +
      '  <div class="main-col">' +
      '    <header class="topbar">' +
      '      <h1 id="page-title">' + esc(title) + '</h1>' +
      '      <div class="topbar-side">' +
      '        <span class="chip chip-role" title="你当前登录的角色">' + esc(window.OnboardRoles.labelOf(user.role)) + '</span>' +
      '        <span class="chip">演示版</span>' +
      '        <span class="topbar-date">' + esc(todayLabel()) + '</span>' +
      '      </div>' +
      '    </header>' +
      '    <main class="content" id="page-content">' + content + '</main>' +
      '  </div>' +
      '</div>';

    $$('.nav-item[data-page]', appEl).forEach(function (item) {
      item.addEventListener('click', function () {
        go(item.getAttribute('data-page'));
      });
    });

    var backBtn = $('[data-action="back-overview"]', appEl);
    if (backBtn) {
      backBtn.addEventListener('click', function () {
        go('overview');
      });
    }

    var addEmployeeBtn = $('[data-action="add-employee"]', appEl);
    if (addEmployeeBtn) {
      addEmployeeBtn.addEventListener('click', openCreateEmployeeModal);
    }

    var importEmployeesBtn = $('[data-action="import-employees"]', appEl);
    if (importEmployeesBtn) {
      importEmployeesBtn.addEventListener('click', openImportEmployeesModal);
    }

    var goEmployeesBtn = $('[data-action="go-employees"]', appEl);
    if (goEmployeesBtn) {
      goEmployeesBtn.addEventListener('click', function () {
        go('employees');
      });
    }

    var addDepartmentBtn = $('[data-action="add-department"]', appEl);
    if (addDepartmentBtn) {
      addDepartmentBtn.addEventListener('click', openAddDepartmentModal);
    }

    $$('[data-employee-id]', appEl).forEach(function (btn) {
      btn.addEventListener('click', function () {
        openEditEmployeeModal(btn.getAttribute('data-employee-id'));
      });
    });

    var passwordBtn = $('[data-action="change-password"]', appEl);
    if (passwordBtn) {
      passwordBtn.addEventListener('click', function () {
        var me = store.currentUser();
        if (!me || !window.OnboardRoles.isEnabled(me)) {
          renderLogin();
          return;
        }
        openPasswordModal(me);
      });
    }

    var logoutBtn = $('[data-action="logout"]', appEl);
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function () {
        openConfirmModal({
          title: '退出登录',
          message: '确定要退出登录吗？你的工作空间数据会保留，下次用账号和密码还能进来。',
          confirmText: '退出登录',
          onConfirm: function () {
            var me = store.currentUser();
            store.clearSession();
            renderLogin(me ? me.account : '');
            toast('已退出登录');
          }
        });
      });
    }

    if (page === 'policies' && view === 'page') {
      store.advancePolicies();
      renderPolicyList();
      wirePoliciesPage();
      startPolicyTimer();
    }

    if (page === 'policyCenter' && view === 'page') {
      renderPolicyCenterList();
      wirePolicyCenterPage();
    }

    if (page === 'leaveAdmin' && view === 'page') {
      renderLeaveTable();
      wireLeavePage();
    }

    if (page === 'myLeave' && view === 'page') {
      renderMyLeaveTable();
      wireMyLeavePage();
    }

    if (page === 'modelConfig' && view === 'page') {
      wireModelConfigPage();
    }

    if (page === 'assistant' && view === 'page') {
      renderAssistantMain(user);
      renderChatSessionList(user);
      wireAssistantPage();
      setChatSending(chatState.pending);
      resumePendingAnswers(user);
    }

    if (page === 'retrievalTest' && view === 'page') {
      wireRetrievalTestPage();
    }

    if (page === 'inquiries' && view === 'page') {
      renderInquiriesList(user);
      wireInquiriesPage();
    }

    if (page === 'tickets' && view === 'page') {
      wireTicketsPage();
    }

    if (page === 'messages' && view === 'page') {
      renderMessagesList(user);
      wireMessagesPage();
    }

    if (page === 'signoffAdmin' && view === 'page') {
      renderSignoffAdmin(user);
      wireSignoffAdminPage();
    }

    if (page === 'mySignoffs' && view === 'page') {
      renderMySignoffs(user);
      wireMySignoffsPage();
    }

    if (page === 'knowledgeGaps' && view === 'page') {
      renderKnowledgeGaps(user);
      wireKnowledgeGapsPage();
    }

    if (page === 'traces' && view === 'page') {
      renderTraces(user);
      wireTracesPage();
    }

    if (page === 'developer' && view === 'page') {
      renderDeveloperPage(user);
      wireDeveloperPage();
    }

    if (page === 'analytics' && view === 'page') {
      renderAnalyticsPage(user);
      wireAnalyticsPage();
    }

    if (page === 'audit' && view === 'page') {
      wireAuditPage();
    }

    if (page === 'feishu' && view === 'page') {
      wireFeishuPage();
    }

    if (page === 'policyConflicts' && view === 'page') {
      renderPolicyConflicts(user);
      wirePolicyConflictsPage();
    }

    if (page === 'service' && view === 'page') {
      renderServiceList(user);
      renderFeedbackFollowups(user);
      renderTaskTemplates(user);
      renderAssignTaskOptions(user);
      renderAssignedTasks(user);
      wireServicePage();
    }
  }

  // 页面入口：所有渲染都先经过权限检查
  function route() {
    try {
      if (!store.hasWorkspace()) {
        renderCreate();
        return;
      }

      var user = store.currentUser();
      var hash = window.location.hash;
      if (user && !window.OnboardRoles.isEnabled(user)) {
        store.clearSession();
        renderLogin();
        toast('该账号已停用，请联系公司管理员。');
        return;
      }

      if (BACKEND_ENTRY) {
        if (!user) {
          renderLogin();
          return;
        }
        if (!canAccessBackend(user, BACKEND_ENTRY)) {
          renderBackendDenied(user, BACKEND_ENTRY);
          return;
        }

        var backendPage = (!hash || hash === '#' || hash === '#/')
          ? (BACKEND_ENTRY === 'hr' ? 'overview' : 'analytics')
          : pageFromHash();
        var backendMenu = getBackendMenu(user, BACKEND_ENTRY);
        if (!PAGES[backendPage]) {
          renderShell(user, backendPage, 'notfound');
          return;
        }
        if (backendMenu.indexOf(backendPage) === -1 || !canViewPage(user, backendPage)) {
          renderShell(user, backendPage, 'denied');
          return;
        }
        renderShell(user, backendPage, 'page');
        return;
      }

      if (!hash || hash === '#' || hash === '#/') {
        renderPortal(user);
        return;
      }

      if (!user) {
        renderLogin();
        return;
      }

      if (ASSISTANT_ENTRY) {
        renderAssistantEntryShell(user);
        return;
      }

      var page = pageFromHash();
      if (!PAGES[page]) {
        renderShell(user, page, 'notfound');
        return;
      }
      if (EMPLOYEE_PAGES.indexOf(page) === -1) {
        if (BACKEND_MENUS.hr.indexOf(page) !== -1 && canAccessBackend(user, 'hr')) {
          window.location.href = 'hr/index.html#/' + page;
          return;
        }
        if (BACKEND_MENUS.ops.indexOf(page) !== -1 && canAccessBackend(user, 'ops')) {
          window.location.href = 'ops/index.html#/' + page;
          return;
        }
        renderShell(user, page, 'denied');
        return;
      }
      if (!canViewPage(user, page)) {
        renderShell(user, page, 'denied');
        return;
      }
      renderShell(user, page, 'page');
    } catch (err) {
      appEl.innerHTML = '<div class="noscript-tip">页面加载出了点问题，请刷新一下再试一次。</div>';
      if (window.console && window.console.error) window.console.error(err);
    }
  }

  /* ================== 二次确认弹窗（代替浏览器原生弹窗） ================== */

  function openConfirmModal(options) {
    var opts = options || {};
    var confirmText = opts.confirmText || '确定';

    modalRoot.innerHTML = '' +
      '<div class="modal-overlay" id="confirm-overlay">' +
      '  <div class="modal modal-sm" role="dialog" aria-modal="true" aria-labelledby="confirm-title">' +
      '    <div class="modal-head">' +
      '      <h3 id="confirm-title">' + esc(opts.title || '确认') + '</h3>' +
      '      <button type="button" class="icon-btn" data-close="1" aria-label="关闭">×</button>' +
      '    </div>' +
      '    <p class="modal-sub confirm-text">' + esc(opts.message || '') + '</p>' +
      '    <div class="modal-foot">' +
      '      <button type="button" class="btn btn-ghost" data-close="1">取消</button>' +
      '      <button type="button" class="btn ' + (opts.danger ? 'btn-danger' : 'btn-primary') + '" id="confirm-ok">' + esc(confirmText) + '</button>' +
      '    </div>' +
      '  </div>' +
      '</div>';

    var overlay = document.getElementById('confirm-overlay');
    var okBtn = document.getElementById('confirm-ok');

    function closeModal() {
      document.removeEventListener('keydown', onKeydown);
      modalRoot.innerHTML = '';
    }

    function onKeydown(event) {
      if (event.key === 'Escape') closeModal();
    }

    document.addEventListener('keydown', onKeydown);

    overlay.addEventListener('click', function (event) {
      if (event.target === overlay) closeModal();
    });

    $$('[data-close]', overlay).forEach(function (btn) {
      btn.addEventListener('click', closeModal);
    });

    okBtn.addEventListener('click', function () {
      closeModal();
      if (typeof opts.onConfirm === 'function') opts.onConfirm();
    });

    okBtn.focus();
  }

  /* ================== 修改密码弹窗 ================== */

  function openPasswordModal(user) {
    if (!user) {
      renderLogin();
      return;
    }

    modalRoot.innerHTML = '' +
      '<div class="modal-overlay" id="pw-overlay">' +
      '  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="pw-title">' +
      '    <div class="modal-head">' +
      '      <h3 id="pw-title">修改密码</h3>' +
      '      <button type="button" class="icon-btn" data-close="1" aria-label="关闭">×</button>' +
      '    </div>' +
      '    <p class="modal-sub">修改后，下次登录请用新密码。密码至少 10 位。</p>' +
      '    <div class="form-error" id="pw-error" role="alert"></div>' +
      '    <form id="pw-form" novalidate autocomplete="off">' +
      '      <div class="field">' +
      '        <label for="pw-current">当前密码</label>' +
      '        <input class="input" id="pw-current" type="password" maxlength="64" placeholder="请输入现在的密码" autocomplete="current-password">' +
      '      </div>' +
      '      <div class="field">' +
      '        <label for="pw-new">新密码</label>' +
      '        <input class="input" id="pw-new" type="password" maxlength="64" placeholder="至少 10 位" autocomplete="new-password">' +
      '      </div>' +
      '      <div class="field">' +
      '        <label for="pw-new2">再输一次新密码</label>' +
      '        <input class="input" id="pw-new2" type="password" maxlength="64" placeholder="再输一次，确认没有打错" autocomplete="new-password">' +
      '      </div>' +
      '      <div class="modal-foot">' +
      '        <button type="button" class="btn btn-ghost" data-close="1">取消</button>' +
      '        <button type="submit" class="btn btn-primary">保存新密码</button>' +
      '      </div>' +
      '    </form>' +
      '  </div>' +
      '</div>';

    var overlay = document.getElementById('pw-overlay');
    var form = document.getElementById('pw-form');
    var errEl = document.getElementById('pw-error');

    function closeModal() {
      document.removeEventListener('keydown', onKeydown);
      modalRoot.innerHTML = '';
    }

    function onKeydown(event) {
      if (event.key === 'Escape') closeModal();
    }

    document.addEventListener('keydown', onKeydown);
    overlay.addEventListener('click', function (event) {
      if (event.target === overlay) closeModal();
    });
    $$('[data-close]', overlay).forEach(function (btn) {
      btn.addEventListener('click', closeModal);
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      hideError(errEl);

      var current = document.getElementById('pw-current').value;
      var next = document.getElementById('pw-new').value;
      var nextAgain = document.getElementById('pw-new2').value;
      var me = store.currentUser();

      if (!me) {
        closeModal();
        renderLogin();
        return;
      }

      var message = '';
      if (!current) {
        message = '请先输入当前密码。';
      } else if (!store.checkPassword(me, current)) {
        message = '当前密码不正确，请再确认一下。';
      } else {
        message = validatePassword(next);
        if (!message && next === current) message = '新密码不能和当前密码一样，请换一个。';
        if (!message && next !== nextAgain) message = '两次输入的新密码不一致，请再检查一下。';
      }

      if (message) {
        showError(errEl, message);
        return;
      }

      store.updatePassword(me.id, next);
      closeModal();
      toast('密码已更新，下次登录请用新密码');
    });

    document.getElementById('pw-current').focus();
  }

  /* ================== 启动 ================== */

  function boot() {
    window.addEventListener('hashchange', route);
    route();
  }

  boot();

  if (!store.isPersistent()) {
    window.setTimeout(function () {
      toast('浏览器没有允许保存本地数据，刷新后可能需要重新创建。建议用 Edge 或 Chrome 打开这个页面。');
    }, 700);
  }
})();
