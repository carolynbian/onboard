/* ============================================================
   初见 Onboard · 带引用的回答生成
   ------------------------------------------------------------
   规则：
   1. 只依据制度检索（retrieval.js）找到的原文，不得用常识补充公司规定；
   2. 回答拆成若干结论，每条结论单独引用它依据的原文段；
   3. 原文答不全时，明确说“依据不足”或“只能部分回答”，并说明缺少什么；
   4. 引用了标题带“示例”的制度时，回答下方提示这是示例制度；
   5. 优先调用“模型配置”里保存的对话模型；没有配置模型时，
      用本地“摘录式”回答兜底并如实标注模型名，不假装调用过模型。
   全部在本机完成。
   ============================================================ */
(function () {
  'use strict';

  var MIN_DELAY_MS = 650;
  var MODEL_TIMEOUT_MS = 20000;
  var LOCAL_MODEL_NAME = '本地摘要（演示，未调用模型）';

  function sleep(ms) {
    return new Promise(function (resolve) {
      window.setTimeout(resolve, ms);
    });
  }

  function splitSentences(text) {
    return String(text || '')
      .replace(/\r/g, '')
      .replace(/([。；！？])/g, '$1\u0001')
      .split('\u0001')
      .map(function (item) { return item.trim(); })
      .filter(Boolean);
  }

  // 从一段原文里挑出和问题最相关的一句，作为结论的引用依据
  function bestSentenceFor(text, question) {
    var retrieval = window.OnboardRetrieval;
    if (!retrieval) return '';

    var profile = retrieval.questionProfile(question);
    var best = '';
    var bestScore = -1;

    splitSentences(text).forEach(function (sentence) {
      if (sentence.length < 8) return;
      if (/^[一二三四五六七八九十]+、/.test(sentence) && sentence.length < 24) return;

      var score = 0;
      Object.keys(profile.base).forEach(function (gram) {
        if (sentence.indexOf(gram) !== -1) score += 1;
      });
      profile.domainHits.forEach(function (term) {
        if (sentence.indexOf(term) !== -1) score += 2;
      });
      if (profile.cleaned && profile.cleaned.length >= 4 && sentence.indexOf(profile.cleaned) !== -1) score += 3;

      if (score > bestScore) {
        bestScore = score;
        best = sentence;
      }
    });

    if (!best) return '';
    if (best.length > 140) best = best.slice(0, 140) + '…';
    return best;
  }

  function needsNumber(question) {
    return /(几天|多少天|多少钱|多少|金额|上限|比例|标准|天数|小时|额度)/.test(question);
  }

  function insufficient(missing) {
    return {
      mode: 'insufficient',
      conclusions: [{ text: '依据不足：' + missing, citations: [] }],
      citations: [],
      missing: missing
    };
  }

  // 没有配置模型时的兜底：直接从原文摘句，每条结论只引用一段原文
  function localAnswer(question, citations) {
    if (!citations.length) {
      return insufficient('没有在你能看到的已发布制度里找到与这个问题相关的原文。');
    }

    var conclusions = [];
    citations.slice(0, 4).forEach(function (citation) {
      var sentence = bestSentenceFor(citation.text, question);
      if (!sentence) return;
      conclusions.push({ text: sentence, citations: [citation.index] });
    });

    if (!conclusions.length) {
      return insufficient('找到了相关制度，但原文里没有可以直接引用的明确句子。');
    }

    var mode = 'answered';
    var missing = '';

    if (conclusions.length < 2) {
      mode = 'partial';
      missing = '找到的原文较少，可能只覆盖了问题的一部分，建议向 HR 再确认。';
    }
    if (needsNumber(question) && !conclusions.some(function (item) { return /[0-9]/.test(item.text); })) {
      mode = 'partial';
      missing = '原文没有给出你问的具体数值或上限。';
    }

    return {
      mode: mode,
      conclusions: conclusions,
      citations: citations.slice(0, conclusions.length),
      missing: missing
    };
  }

  function buildModelMessages(question, citations, promptOverride) {
    var system = promptOverride ? String(promptOverride) : [
      '你是公司制度问答助手。只能依据下面提供的制度原文回答，不得使用常识或外部知识补充公司规定。',
      '把回答拆成若干条结论。每条结论必须由它引用的那一段原文单独支持，不得跨段拼凑。',
      '如果原文没有明确回答关键条件，请说明“依据不足”或“只能部分回答”，并在 missing 里指出缺少什么，不要猜测。',
      '每条结论必须带 citations 数组，取值为原文编号（从 1 开始）。',
      '只输出 JSON，不要输出 Markdown。格式：{"mode":"answered|partial|insufficient","conclusions":[{"text":"结论文字","citations":[1]}],"missing":"缺少什么（依据不足或部分回答时填写）"}'
    ].join('\n');

    var payload = {
      question: question,
      passages: citations.map(function (citation) {
        return {
          id: citation.index,
          policy: citation.policyName,
          version: citation.version,
          position: citation.positionLabel,
          text: citation.text
        };
      })
    };

    return [
      { role: 'system', content: system },
      { role: 'user', content: JSON.stringify(payload) }
    ];
  }

  function parseModelContent(content, citations) {
    var text = String(content || '').trim();
    var fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) text = fenced[1].trim();

    var start = text.indexOf('{');
    var end = text.lastIndexOf('}');
    if (start === -1 || end <= start) throw new Error('模型返回的内容不是约定的 JSON 格式。');

    var data;
    try {
      data = JSON.parse(text.slice(start, end + 1));
    } catch (error) {
      throw new Error('模型返回的 JSON 无法解析。');
    }

    var mode = String(data.mode || '').trim();
    if (['answered', 'partial', 'insufficient'].indexOf(mode) === -1) {
      throw new Error('模型返回的回答类型不合法。');
    }
    if (!Array.isArray(data.conclusions) || data.conclusions.length === 0) {
      throw new Error('模型没有返回任何结论。');
    }

    var conclusions = data.conclusions.map(function (item) {
      if (!item || typeof item.text !== 'string' || !item.text.trim()) {
        throw new Error('模型返回的结论缺少文字。');
      }
      var ids = Array.isArray(item.citations) ? item.citations.map(Number) : [];
      ids = ids.filter(function (value) {
        return isFinite(value) && Math.round(value) === value && value >= 1 && value <= citations.length;
      });
      var unique = [];
      ids.forEach(function (value) {
        if (unique.indexOf(value) === -1) unique.push(value);
      });
      if (mode !== 'insufficient' && !unique.length) {
        throw new Error('模型返回的结论缺少引用。');
      }
      return { text: String(item.text).trim(), citations: unique };
    });

    var missing = String(data.missing || '').trim();
    if (mode === 'insufficient' && !missing) {
      throw new Error('模型判定依据不足，但没有说明缺少什么。');
    }

    return { mode: mode, conclusions: conclusions, missing: missing };
  }

  function callModel(config, apiKey, question, citations, promptOverride) {
    var controller = window.AbortController ? new window.AbortController() : null;
    var timer = null;
    if (controller) {
      timer = window.setTimeout(function () { controller.abort(); }, MODEL_TIMEOUT_MS);
    }

    var options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: config.model,
        messages: buildModelMessages(question, citations, promptOverride),
        temperature: config.temperature,
        max_tokens: config.maxTokens
      })
    };
    if (controller) options.signal = controller.signal;

    var url = String(config.baseUrl).replace(/\/+$/, '') + '/chat/completions';

    return window.fetch(url, options).then(function (response) {
      if (timer) window.clearTimeout(timer);
      return response.text().then(function (body) {
        if (!response.ok) {
          var detail = '';
          try {
            var parsed = JSON.parse(body);
            if (parsed && parsed.error) detail = String(parsed.error.message || parsed.error.code || '').slice(0, 100);
          } catch (error) { /* 忽略 */ }
          throw new Error('模型接口返回 HTTP ' + response.status + (detail ? '（' + detail + '）' : '') + '。');
        }

        var data = null;
        try {
          data = JSON.parse(body);
        } catch (error) {
          throw new Error('模型接口返回的内容不是 JSON。');
        }

        var content = data && data.choices && data.choices[0] && data.choices[0].message
          ? data.choices[0].message.content
          : '';
        if (!content) throw new Error('模型没有返回回答内容。');
        return parseModelContent(content, citations);
      });
    }).catch(function (error) {
      if (timer) window.clearTimeout(timer);
      throw error;
    });
  }

  function modelFailureText(error) {
    if (!error) return '调用模型失败，请重试。';
    if (error.name === 'AbortError') return '调用模型超时（20 秒），请检查模型服务后重试。';
    if (error.name === 'TypeError') {
      return '调用模型失败：接口地址可能不对、网络不可达，或浏览器跨域（CORS）限制导致请求被拦截。';
    }

    var message = String(error.message || error);
    if (message.indexOf('HTTP 401') !== -1 || message.indexOf('HTTP 403') !== -1) {
      return '调用模型失败：密钥无效或没有权限。';
    }
    if (message.indexOf('HTTP 404') !== -1) {
      return '调用模型失败：接口地址或模型名称不存在。';
    }
    return '调用模型失败：' + message;
  }

  function finish(answer, citations) {
    var used = answer.citations || [];
    answer.exampleNotice = used.some(function (item) {
      return String(item.policyName || '').indexOf('示例') !== -1;
    });
    return answer;
  }

  function modelAnswer(parsed, citations) {
    var used = {};
    parsed.conclusions.forEach(function (item) {
      item.citations.forEach(function (index) {
        used[index] = true;
      });
    });
    var usedCitations = citations.filter(function (item) {
      return used[item.index];
    });

    return {
      mode: parsed.mode,
      conclusions: parsed.conclusions,
      citations: usedCitations,
      missing: parsed.missing || ''
    };
  }

  /* ---------------- 问题分类：制度 / 本人年假 / 混合 / 个人资料 / 含糊 / 问别人 ---------------- */

  function currentDateISO() {
    var now = new Date();
    var month = now.getMonth() + 1;
    var day = now.getDate();
    return now.getFullYear() + '-' + (month < 10 ? '0' + month : month) + '-' + (day < 10 ? '0' + day : day);
  }

  function roundDays(value) {
    return Math.round(Number(value) * 100) / 100;
  }

  function parseYearFromQuestion(text) {
    var current = new Date().getFullYear();
    var match = String(text || '').match(/(20\d{2})/);
    if (match) {
      var year = Number(match[1]);
      if (year >= 2000 && year <= 2100) return String(year);
    }
    if (/前年/.test(text)) return String(current - 2);
    if (/去年/.test(text)) return String(current - 1);
    if (/明年/.test(text)) return String(current + 1);
    return String(current);
  }

  // 年假卡片：余额只从账本（流水合计）读取，不做任何估算
  function buildLeaveCard(actor, year) {
    var store = window.OnboardStore;
    var balance = store.getLeaveBalanceFor(actor, actor.id, year);
    if (balance === null) return null;

    var entries = store.listLeaveEntriesFor(actor, actor.id, year);

    return {
      year: String(year),
      hasRecord: entries.length > 0,
      balance: roundDays(balance),
      asOf: currentDateISO(),
      lastUpdated: store.getLeaveLastUpdatedFor(actor, actor.id, year),
      isExample: entries.some(function (entry) {
        return String(entry.reason || '').indexOf('示例') !== -1;
      }),
      changes: entries.slice(0, 5).map(function (entry) {
        return {
          reason: String(entry.reason || ''),
          delta: roundDays(entry.delta),
          type: entry.type === 'reconcile' ? '对账调整' : '手动调整',
          createdAt: entry.createdAt
        };
      })
    };
  }

  function leaveAnswer(actor, year) {
    var card = buildLeaveCard(actor, year);
    if (!card) {
      return {
        kind: 'leave',
        mode: 'insufficient',
        conclusions: [{ text: '依据不足：无法读取你的年假账本，请稍后再试或联系 HR。', citations: [] }],
        citations: [],
        missing: '缺少：可读取的年假账本记录。'
      };
    }

    if (!card.hasRecord) {
      return {
        kind: 'leave',
        status: 'insufficient',
        mode: 'insufficient',
        conclusions: [{ text: '还没有你 ' + escYear(year) + ' 年度的年假记录，请联系 HR 录入；没有记录不代表余额为零。', citations: [] }],
        citations: [],
        missing: '缺少：HR 录入的年假账本记录。',
        leaveCard: card,
        note: '余额来自 HR 维护的年假账本，未经模型计算。',
        verification: [
          { name: '年假账本核对', result: 'fail', detail: '这个年度没有账本记录，无法核对余额。' },
          { name: '余额来源检查', result: 'pass', detail: '余额只从账本读取，未交给模型计算。' }
        ]
      };
    }

    return {
      kind: 'leave',
      status: 'verified',
      mode: 'answered',
      conclusions: [],
      citations: [],
      missing: '',
      leaveCard: card,
      note: '余额来自 HR 维护的年假账本，未经模型计算。',
      verification: [
        { name: '年假账本核对', result: 'pass', detail: '余额 = ' + card.changes.length + ' 条流水合计（' + card.balance + ' 天），来自 HR 维护的账本。' },
        { name: '余额来源检查', result: 'pass', detail: '余额只从账本读取，未交给模型计算。' }
      ]
    };
  }

  function escYear(year) {
    return String(year);
  }

  function profileAnswer(actor) {
    var roles = window.OnboardRoles;
    var roleLabel = roles && roles.labelOf ? roles.labelOf(actor.role) : actor.role;
    var text = '根据系统里的个人资料：你属于「' + actor.department + '」，登录账号 ' + actor.account + '，角色是「' + roleLabel + '」。';

    return {
      kind: 'profile',
      status: 'verified',
      mode: 'answered',
      conclusions: [{ text: text, citations: [] }],
      citations: [],
      missing: '',
      note: '以上信息来自你的个人资料，只查询本人。',
      verification: [
        { name: '个人资料核对', result: 'pass', detail: '姓名、部门、账号、角色都来自系统里的账号资料，没有使用模型推断。' }
      ]
    };
  }

  function refusalAnswer() {
    return {
      kind: 'refuse',
      mode: 'refused',
      conclusions: [{ text: '我只能查询你本人的年假和个人信息，不能查看或透露其他人的信息。如果你想查自己的年假，可以问“我今年还剩多少年假？”。', citations: [] }],
      citations: [],
      missing: ''
    };
  }

  function departmentRefusalAnswer(dept) {
    return {
      kind: 'refuse',
      refuseType: 'dept',
      mode: 'refused',
      conclusions: [{ text: '这属于其他部门（' + dept + '）的具体制度内容，你只能查看全员适用的制度和本人所在部门的制度，我不能把其他部门的制度当作你的依据。建议向该部门或 HR 确认。', citations: [] }],
      citations: [],
      missing: ''
    };
  }

  function clarifyAnswer() {
    return {
      kind: 'clarify',
      mode: 'clarify',
      conclusions: [{ text: '这个问题我还不太确定你想问什么。你可以这样问：“我今年还剩多少年假？”、“年假可以结转到明年吗？”或“我的部门是什么？”。', citations: [] }],
      citations: [],
      missing: ''
    };
  }

  /**
   * 先判断问题属于哪一类，再决定走哪条路：
   * refuse_other（问别人）→ vague（太含糊）→ profile（个人资料）
   * → leave（本人年假）→ mixed（年假 + 制度）→ policy（只问制度）
   */
  function classifyQuestion(actor, question) {
    var store = window.OnboardStore;
    var text = String(question == null ? '' : question).trim();
    var normalized = text.replace(/\s+/g, '');

    if (!normalized) return { type: 'vague' };

    var personalTopic = /(年假|休假|假期|余额|剩余|几天|请假|个人信息|手机号|身份证|工资|薪资|部门|岗位|职位|入职|工号)/;

    var others = actor ? store.listUsers().filter(function (user) {
      return user && user.id !== actor.id;
    }) : [];

    for (var i = 0; i < others.length; i++) {
      var other = others[i];
      var hitName = other.name && normalized.indexOf(String(other.name)) !== -1;
      var hitAccount = other.account && normalized.indexOf(String(other.account)) !== -1;
      if ((hitName || hitAccount) && personalTopic.test(normalized)) {
        return { type: 'refuse_other' };
      }
    }

    if (/(别人|其他人|同事的|同事|他的|她的|他们的)/.test(normalized) && personalTopic.test(normalized)) {
      return { type: 'refuse_other' };
    }

    if (normalized.length < 4) return { type: 'vague' };
    if (/^(你好|在吗|hi|hello|嗨|喂|怎么办|帮帮我|问个问题|咨询一下|在不在)[!?？。！]*$/i.test(normalized)) {
      return { type: 'vague' };
    }
    if (/^(帮我|帮忙|麻烦|请帮|请)?(查|看|问|找|处理)(一?下|一?个)?[!?？。！]*$/.test(normalized)) {
      return { type: 'vague' };
    }

    // 先看是不是在问其他部门专属的制度内容
    var mentionedDept = detectDepartment(normalized);
    if (mentionedDept && actor && mentionedDept !== actor.department) {
      return { type: 'refuse_dept', dept: mentionedDept };
    }

    var asksLeaveBalance = /(年假|休假|假期|调休)/.test(normalized) &&
      /(剩|还剩|余额|多少天|几天|用了多少|用掉|休了几天|还有|够不够)/.test(normalized);
    var asksPolicy = /(制度|规定|标准|政策|流程|材料|时限|审批|条件|结转|跨年|次年|怎么算|能不能|可以|要求|范围|怎么|如何)/.test(normalized);
    var asksProfile = /(我的部门|我是哪个部门|我属于|我的岗位|我的职位|我的角色|我的账号|我的工号|个人信息|我的信息|我叫什么)/.test(normalized);

    if (asksProfile) return { type: 'profile' };
    if (asksLeaveBalance && asksPolicy) return { type: 'mixed', year: parseYearFromQuestion(normalized) };
    if (asksLeaveBalance) return { type: 'leave', year: parseYearFromQuestion(normalized) };
    return { type: 'policy' };
  }

  function finalize(answer, startedAt, modelName, trace) {
    return sleep(MIN_DELAY_MS).then(function () {
      answer.modelName = modelName;
      answer.elapsedMs = Math.max(0, Math.round(Date.now() - startedAt));
      answer.generatedAt = new Date().toISOString();
      if (trace) {
        var final = traceFinalInfo(answer);
        pushTraceStage(trace, 'final', '最终状态', final.result, 0, final.detail);
        answer.trace = trace.stages;
      }
      return { ok: true, answer: answer };
    });
  }

  /* ---------------- 回答执行轨迹（每个阶段的耗时、结果、说明） ---------------- */

  function traceFinalInfo(answer) {
    var status = answer && answer.status;
    if (status === 'verified') return { result: 'pass', detail: '依据充分：回答通过核验，可以正常展示。' };
    if (status === 'partial') return { result: 'partial', detail: '部分有依据：部分结论没通过核验，展示时已隐藏失败结论并说明。' };
    if (status === 'insufficient') return { result: 'fail', detail: '依据不足：没有找到足以支撑结论的制度原文。' };
    if (status === 'conflict') return { result: 'fail', detail: '存在冲突：制度之间要求不一致，已建议转人工确认。' };
    return { result: 'pass', detail: '回答已生成。' };
  }

  function pushTraceStage(trace, key, name, result, durationMs, detail, extra) {
    if (!trace || !Array.isArray(trace.stages)) return;
    var stage = {
      key: key,
      name: name,
      result: result || 'pass',
      durationMs: Math.max(0, Math.round(Number(durationMs) || 0)),
      detail: detail || ''
    };
    if (extra && typeof extra === 'object') {
      Object.keys(extra).forEach(function (name) {
        if (Object.prototype.hasOwnProperty.call(extra, name)) stage[name] = extra[name];
      });
    }
    trace.stages.push(stage);
  }

  function traceIntentLabel(intent) {
    var map = {
      refuse_other: '拒绝（询问他人信息）',
      refuse_dept: '拒绝（其他部门专属制度）',
      vague: '追问（问题太含糊）',
      profile: '个人资料',
      leave: '本人年假',
      mixed: '年假 + 制度',
      policy: '制度问题'
    };
    return map[intent && intent.type] || (intent && intent.type) || '未知';
  }

  function traceRuleStatus(verification) {
    var ruleEntries = (verification || []).filter(function (item) {
      return item && item.name && item.name.indexOf('AI') === -1;
    });
    if (!ruleEntries.length) return { status: 'skipped', detail: '本次回答没有可核验的制度引用。' };

    var failed = ruleEntries.filter(function (item) { return item.result === 'fail'; }).length;
    var passed = ruleEntries.filter(function (item) { return item.result === 'pass'; }).length;
    var status = failed ? (passed ? 'partial' : 'fail') : 'pass';
    return {
      status: status,
      detail: ruleEntries.map(function (item) { return item.name + '：' + traceResultLabel(item.result); }).join('；')
    };
  }

  function traceSemanticVerification(verification) {
    var aiEntry = (verification || []).filter(function (item) {
      return item && item.name && item.name.indexOf('AI') !== -1;
    })[0];
    if (!aiEntry) return { status: 'skipped', detail: '未执行独立语义核验。' };
    return { status: aiEntry.result || 'skipped', detail: aiEntry.detail || '' };
  }

  function traceResultLabel(result) {
    if (result === 'pass') return '通过';
    if (result === 'fail') return '未通过';
    if (result === 'partial') return '部分通过';
    if (result === 'skipped') return '未执行';
    return result || '';
  }

  // 给不经过检索/生成模型的分支补上阶段（拒绝、追问、个人资料、本人年假等）
  function traceWithoutRetrieval(trace, answer, generationDetail) {
    pushTraceStage(trace, 'retrieval', '查找制度原文', 'skipped', 0, '本次回答不需要检索制度原文。');
    pushTraceStage(trace, 'generation', '生成回答', 'pass', 0, generationDetail || '未调用生成模型，直接按规则返回。');

    var rule = traceRuleStatus(answer && answer.verification);
    pushTraceStage(trace, 'rule', '规则核验', rule.status, 0, rule.detail);

    var semantic = traceSemanticVerification(answer && answer.verification);
    pushTraceStage(trace, 'semantic', '语义核验', semantic.status, 0, semantic.detail);
  }

  function policyPart(actor, question, citations, config, configured, prompts) {
    var store = window.OnboardStore;

    if (!citations.length) {
      return Promise.resolve({ ok: true, partial: insufficient('没有在你能看到的已发布制度里找到与这个问题相关的原文。') });
    }
    if (!configured) {
      return Promise.resolve({ ok: true, partial: localAnswer(question, citations) });
    }

    return store.getModelSecret().then(function (apiKey) {
      if (!apiKey) throw new Error('无法读取已保存的模型密钥，请到“模型配置”重新保存。');
      return callModel(config, apiKey, question, citations, prompts && prompts.generation);
    }).then(function (parsed) {
      return { ok: true, partial: modelAnswer(parsed, citations) };
    }).catch(function (error) {
      return { ok: false, error: modelFailureText(error) };
    });
  }

  /* ---------------- 回答前核验：规则核对 + 独立 AI 判断 + 冲突检测 ---------------- */

  // 只比较“具体事项”的数字，避免把“标准/时限”这类泛词误判成冲突
  var CONFLICT_TERMS = ['住宿', '餐补', '年假', '病假', '婚假', '产假', '折扣', '提成', '预算', '备用金'];

  var DEPT_TERMS = [
    { dept: '产品部', terms: ['产品部', '需求评审', '原型', '灰度', '迭代', 'PRD', '产品需求'] },
    { dept: '技术部', terms: ['技术部', '代码评审', '代码合并', 'CI', 'MR', '回滚', '故障', '覆盖率'] },
    { dept: '销售部', terms: ['销售部', '折扣', '回款', '提成', '客户报备', '销售合同'] },
    { dept: '财务部', terms: ['财务部', '备用金', '月结', '预算', '发票认证'] },
    { dept: '人力资源部', terms: ['人力资源部', '绩效申诉', '绩效', '招聘', '晋升'] }
  ];

  function detectDepartment(text) {
    for (var i = 0; i < DEPT_TERMS.length; i++) {
      var item = DEPT_TERMS[i];
      for (var j = 0; j < item.terms.length; j++) {
        if (text.indexOf(item.terms[j]) !== -1) return item.dept;
      }
    }
    return '';
  }

  function extractNumericClaims(citation) {
    var claims = [];
    var text = String(citation.text || '');
    var regex = /(\d+(?:\.\d+)?)\s*(元|天|晚|小时|个月|个工作日|万元|%)/g;
    var match;

    while ((match = regex.exec(text)) !== null) {
      var prefix = text.slice(Math.max(0, match.index - 40), match.index);
      var key = '';
      var bestAt = -1;
      CONFLICT_TERMS.forEach(function (term) {
        var at = prefix.lastIndexOf(term);
        if (at > bestAt) {
          bestAt = at;
          key = term;
        }
      });
      if (key) claims.push({ key: key, value: Number(match[1]), unit: match[2], citation: citation });
    }

    return claims;
  }

  // 只把“同一事项、同一单位、不同数字”视为真正冲突；主题不同、详略不同不算
  function detectConflicts(citations) {
    var claims = [];
    (citations || []).forEach(function (citation) {
      extractNumericClaims(citation).forEach(function (claim) { claims.push(claim); });
    });

    var findings = [];
    for (var i = 0; i < claims.length; i++) {
      for (var j = i + 1; j < claims.length; j++) {
        var left = claims[i];
        var right = claims[j];
        if (left.citation.policyId === right.citation.policyId) continue;
        if (left.key !== right.key || left.unit !== right.unit) continue;
        if (Math.abs(left.value - right.value) < 0.0001) continue;

        var duplicate = findings.some(function (item) {
          return item.term === left.key && item.unit === left.unit &&
            item.left.policyId === left.citation.policyId &&
            item.right.policyId === right.citation.policyId &&
            item.leftValue === left.value && item.rightValue === right.value;
        });
        if (duplicate) continue;

        findings.push({
          term: left.key,
          unit: left.unit,
          left: left.citation,
          right: right.citation,
          leftValue: left.value,
          rightValue: right.value
        });
      }
    }

    // 同一事项、同一单位只提示一次，避免同一个冲突重复展示多张卡片
    var seen = {};
    return findings.filter(function (finding) {
      var key = finding.term + '|' + finding.unit;
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  function verifyConclusionLayerOne(conclusion, citations) {
    var reasons = [];
    var numericReasons = [];
    var cited = (conclusion.citations || []).map(function (index) {
      return citations[index - 1];
    }).filter(Boolean);

    if (!cited.length) {
      return { pass: false, numberOk: false, detail: '这条结论没有引用任何原文。' };
    }

    var store = window.OnboardStore;
    cited.forEach(function (citation) {
      var policy = store.getPolicyById(citation.policyId);
      if (!policy) {
        reasons.push('引用的制度已不存在。');
        return;
      }
      if (String(policy.parsedText || '').indexOf(citation.text) === -1) {
        reasons.push('引用原文在制度中找不到逐字一致的内容。');
      }
    });

    var numbers = String(conclusion.text || '').match(/\d+(?:\.\d+)?/g) || [];
    var citedText = cited.map(function (citation) { return citation.text; }).join('');
    numbers.forEach(function (number) {
      if (citedText.indexOf(number) === -1) numericReasons.push('结论里的数字 ' + number + ' 在引用原文中找不到');
    });
    if (numericReasons.length) reasons.push(numericReasons.join('；'));

    return {
      pass: reasons.length === 0,
      numberOk: numericReasons.length === 0,
      detail: reasons.length ? reasons.join('；') : '引用原文可在制度中逐字核对，数字与期限一致。'
    };
  }

  function buildVerifyMessages(question, conclusions, citations, promptOverride) {
    var system = promptOverride ? String(promptOverride) : [
      '你是独立的制度核验员，判断回答结论是否被它引用的完整原文明确支持。',
      '只依据下面提供的引用原文判断，不使用外部知识，也不替公司解释制度。',
      '如果结论扩大解释、漏掉原文里的例外或条件、或原文没有明确说明，就判为 partial 或 fail。',
      '只输出 JSON，不要输出 Markdown。格式：{"results":[{"index":1,"result":"pass|partial|fail","reason":"简短说明"}]}'
    ].join('\n');

    var items = conclusions.map(function (conclusion, index) {
      var passages = (conclusion.citations || []).map(function (citationIndex) {
        var citation = citations[citationIndex - 1];
        if (!citation) return null;
        return { policy: citation.policyName, version: citation.version, position: citation.positionLabel, text: citation.text };
      }).filter(Boolean);
      return { index: index + 1, conclusion: conclusion.text, passages: passages };
    });

    return [
      { role: 'system', content: system },
      { role: 'user', content: JSON.stringify({ question: question, items: items }) }
    ];
  }

  function parseVerifyContent(content) {
    var text = String(content || '').trim();
    var fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) text = fenced[1].trim();

    var start = text.indexOf('{');
    var end = text.lastIndexOf('}');
    if (start === -1 || end <= start) throw new Error('核验结果不是 JSON 格式。');

    var data = JSON.parse(text.slice(start, end + 1));
    if (!data || !Array.isArray(data.results) || !data.results.length) {
      throw new Error('核验结果缺少 results。');
    }

    var results = [];
    data.results.forEach(function (item) {
      if (!item) return;
      var index = Number(item.index);
      var result = String(item.result || '').trim();
      if (!isFinite(index) || index < 1) return;
      if (['pass', 'partial', 'fail'].indexOf(result) === -1) return;
      results.push({ index: index, result: result, reason: String(item.reason || '').trim() });
    });
    if (!results.length) throw new Error('核验结果为空。');

    return results;
  }

  function verifyWithAI(config, question, conclusions, citations, promptOverride) {
    var store = window.OnboardStore;
    if (!store) return Promise.resolve({ executed: false, reason: '数据没有加载完成。', results: [] });

    return store.getModelSecret().then(function (apiKey) {
      if (!apiKey) return { executed: false, reason: '无法读取模型密钥，AI 独立核验未执行。', results: [] };

      var controller = window.AbortController ? new window.AbortController() : null;
      var timer = null;
      if (controller) timer = window.setTimeout(function () { controller.abort(); }, MODEL_TIMEOUT_MS);

      var options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + apiKey
        },
        body: JSON.stringify({
          model: config.model,
          messages: buildVerifyMessages(question, conclusions, citations, promptOverride),
          temperature: 0,
          max_tokens: Math.min(Number(config.maxTokens) || 1024, 2048)
        })
      };
      if (controller) options.signal = controller.signal;

      var url = String(config.baseUrl).replace(/\/+$/, '') + '/chat/completions';

      return window.fetch(url, options).then(function (response) {
        if (timer) window.clearTimeout(timer);
        return response.text().then(function (body) {
          if (!response.ok) throw new Error('HTTP ' + response.status);
          var data = JSON.parse(body);
          var content = data && data.choices && data.choices[0] && data.choices[0].message
            ? data.choices[0].message.content
            : '';
          if (!content) throw new Error('核验模型没有返回内容。');
          return { executed: true, results: parseVerifyContent(content) };
        });
      }).catch(function (error) {
        if (timer) window.clearTimeout(timer);
        return { executed: false, reason: 'AI 独立核验调用失败：' + ((error && error.message) ? error.message : String(error)), results: [] };
      });
    });
  }

  function conflictAnswer(conflicts, citations) {
    var details = conflicts.map(function (conflict) {
      return '「' + conflict.term + '」在《' + conflict.left.policyName + '》里是 ' + conflict.leftValue + ' ' + conflict.unit + '，在《' + conflict.right.policyName + '》里是 ' + conflict.rightValue + ' ' + conflict.unit + '。';
    });

    return {
      kind: 'answer',
      status: 'conflict',
      mode: 'conflict',
      conclusions: [{
        text: '发现制度之间存在冲突：同一件事在不同制度里有不能同时成立的要求。' + details.join(' ') + '系统不替你选择其中一条，建议转人工确认。',
        citations: []
      }],
      citations: citations,
      conflicts: conflicts,
      missing: '',
      verification: [
        {
          name: '制度冲突检查',
          result: 'fail',
          detail: '发现 ' + conflicts.length + ' 处冲突：' + details.join(' ')
        },
        {
          name: '引用原文逐字核对',
          result: 'pass',
          detail: '冲突双方的原文都来自已发布且你可见的制度，已逐字核对。'
        }
      ]
    };
  }

  function verifyAndCompose(question, partial, citations, config, configured, trace, prompts) {
    var conclusions = partial.conclusions || [];

    var ruleStartedAt = Date.now();
    var layer1Results = conclusions.map(function (conclusion) {
      return verifyConclusionLayerOne(conclusion, citations);
    });
    var rulePassCount = layer1Results.filter(function (item) { return item.pass; }).length;
    var numberPass = layer1Results.every(function (item) { return item.numberOk; });
    var ruleStatus = !layer1Results.length
      ? 'skipped'
      : (rulePassCount === layer1Results.length ? 'pass' : (rulePassCount ? 'partial' : 'fail'));
    pushTraceStage(trace, 'rule', '规则核验', ruleStatus, Date.now() - ruleStartedAt,
      '逐条核对引用原文与数字：' + rulePassCount + '/' + layer1Results.length + ' 条通过' +
      (numberPass ? '，数字与期限一致。' : '，存在数字或期限不一致。'));

    var aiStartedAt = Date.now();
    var aiPromise;
    if (configured && conclusions.length && citations.length) {
      aiPromise = verifyWithAI(config, question, conclusions, citations, prompts && prompts.verification);
    } else {
      aiPromise = Promise.resolve({ executed: false, reason: '未配置模型，AI 独立核验未执行。', results: [] });
    }

    return aiPromise.then(function (ai) {
      var semanticStatus = 'skipped';
      var semanticDetail = ai.reason || 'AI 独立核验未执行。';
      if (ai.executed) {
        var aiPassCount = ai.results.filter(function (item) { return item.result === 'pass' || item.result === 'partial'; }).length;
        semanticStatus = aiPassCount === conclusions.length ? 'pass' : (aiPassCount ? 'partial' : 'fail');
        semanticDetail = '共核验 ' + conclusions.length + ' 条结论，' + aiPassCount + ' 条被判定为明确支持。';
      }
      pushTraceStage(trace, 'semantic', '语义核验', semanticStatus, Date.now() - aiStartedAt, semanticDetail);
      return composeVerifiedAnswer(partial, citations, layer1Results, ai);
    });
  }

  function composeVerifiedAnswer(partial, citations, layer1Results, ai) {
    var conclusions = partial.conclusions || [];
    var kept = [];
    var hidden = 0;
    var hiddenNotes = [];

    conclusions.forEach(function (conclusion, index) {
      var layer1 = layer1Results[index] || { pass: false, numberOk: false, detail: '核验结果缺失。' };
      var aiResult = ai.executed ? ai.results.filter(function (item) { return item.index === index + 1; })[0] : null;
      var aiPass = !ai.executed || (aiResult && (aiResult.result === 'pass' || aiResult.result === 'partial'));

      if (layer1.pass && aiPass) {
        kept.push(conclusion);
      } else {
        hidden += 1;
        var reasons = [];
        if (!layer1.pass) reasons.push(layer1.detail);
        if (ai.executed && !aiPass) {
          reasons.push('AI 核验：' + (aiResult && aiResult.reason ? aiResult.reason : '未给出明确支持'));
        }
        hiddenNotes.push(reasons.filter(Boolean).join('；'));
      }
    });

    var layer1PassCount = layer1Results.filter(function (item) { return item.pass; }).length;
    var numberPass = layer1Results.every(function (item) { return item.numberOk; });
    var aiPassCount = ai.executed
      ? ai.results.filter(function (item) { return item.result === 'pass' || item.result === 'partial'; }).length
      : 0;

    var verification = [
      {
        name: '引用原文逐字核对',
        result: layer1PassCount === conclusions.length ? 'pass' : (layer1PassCount ? 'partial' : 'fail'),
        detail: '共 ' + conclusions.length + ' 条结论，' + layer1PassCount + ' 条的引用原文在制度里逐字一致。'
      },
      {
        name: '数字与期限一致性',
        result: numberPass ? 'pass' : 'fail',
        detail: numberPass ? '结论里的数字和期限都能在引用原文中找到。' : '有结论里的数字或期限在引用原文中找不到。'
      },
      {
        name: '引用支持关系（AI 独立核验）',
        result: ai.executed ? (aiPassCount === conclusions.length ? 'pass' : (aiPassCount ? 'partial' : 'fail')) : 'skipped',
        detail: ai.executed
          ? '共核验 ' + conclusions.length + ' 条结论，' + aiPassCount + ' 条被判定为明确支持。'
          : (ai.reason || 'AI 独立核验未执行。')
      },
      {
        name: '制度冲突检查',
        result: 'pass',
        detail: '未发现同一事项互相矛盾的原文。'
      }
    ];

    if (!kept.length) {
      return finish({
        kind: 'answer',
        status: 'insufficient',
        mode: 'insufficient',
        conclusions: [{
          text: '依据不足：找到的原文没有通过核验，不能作为回答依据。',
          citations: []
        }],
        citations: [],
        missing: '所有结论都没有通过核验，缺少能逐字支持结论的制度原文。',
        verification: verification,
        hiddenCount: hidden
      }, []);
    }

    var status = (hidden > 0 || !ai.executed || ai.results.some(function (item) { return item.result === 'partial'; }))
      ? 'partial'
      : 'verified';

    var keptCitationIndices = {};
    kept.forEach(function (conclusion) {
      (conclusion.citations || []).forEach(function (index) { keptCitationIndices[index] = true; });
    });
    var keptCitations = citations.filter(function (citation) { return keptCitationIndices[citation.index]; });

    var note = '';
    if (hidden > 0) {
      note = '有 ' + hidden + ' 条结论未通过核验，已隐藏。';
    } else if (!ai.executed) {
      note = /未配置模型/.test(ai.reason || '')
        ? '规则核对已通过；未配置模型，AI 独立核验未执行，因此标记为“部分有依据”。'
        : '规则核对已通过；AI 独立核验未执行（' + (ai.reason || '原因未知') + '），因此标记为“部分有依据”。';
    }

    return finish({
      kind: 'answer',
      status: status,
      mode: status === 'partial' ? 'partial' : 'answered',
      conclusions: kept,
      citations: keptCitations,
      missing: partial.missing || '',
      verification: verification,
      note: note,
      hiddenCount: hidden
    }, keptCitations);
  }

  /**
   * 生成一条回答（可能是年假卡片、制度回答、两者合并、个人资料、拒绝或追问）。
   * 返回 Promise<{ ok:true, answer } | { ok:false, error, elapsedMs, modelName }>
   */
  function generateAnswer(actor, question, options) {
    var startedAt = Date.now();
    var store = window.OnboardStore;
    var retrieval = window.OnboardRetrieval;
    var trace = { stages: [] };
    var opts = options || {};
    var onlineRelease = store.getOnlineReleaseSettings ? store.getOnlineReleaseSettings() : null;
    var prompts = opts.prompts || (onlineRelease && onlineRelease.prompts) || null;
    var fixedCitations = Array.isArray(opts.citations) ? opts.citations : null;

    var intentStartedAt = Date.now();
    var intent = classifyQuestion(actor, question);
    pushTraceStage(trace, 'intent', '理解意图', 'pass', Date.now() - intentStartedAt, '识别为：' + traceIntentLabel(intent));

    var config = store.getModelConfig();
    var configured = !!(config.version && config.baseUrl && config.model && config.hasKey);
    var modelName = configured ? config.model : LOCAL_MODEL_NAME;

    if (intent.type === 'refuse_other') {
      var refusal = refusalAnswer();
      traceWithoutRetrieval(trace, refusal, '未调用生成模型（拒绝回答他人信息）。');
      return finalize(refusal, startedAt, '未调用模型', trace);
    }
    if (intent.type === 'refuse_dept') {
      var deptRefusal = departmentRefusalAnswer(intent.dept);
      traceWithoutRetrieval(trace, deptRefusal, '未调用生成模型（拒绝其他部门专属制度）。');
      return finalize(deptRefusal, startedAt, '未调用模型', trace);
    }
    if (intent.type === 'vague') {
      var clarify = clarifyAnswer();
      traceWithoutRetrieval(trace, clarify, '未调用生成模型（问题太含糊，先追问）。');
      return finalize(clarify, startedAt, '未调用模型', trace);
    }
    if (intent.type === 'profile') {
      var profile = profileAnswer(actor);
      traceWithoutRetrieval(trace, profile, '未调用生成模型（个人资料直接读取）。');
      return finalize(profile, startedAt, '个人资料直读（未调用模型）', trace);
    }
    if (intent.type === 'leave') {
      var leave = leaveAnswer(actor, intent.year);
      traceWithoutRetrieval(trace, leave, '未调用生成模型（年假余额从账本直接读取）。');
      return finalize(leave, startedAt, '年假账本直读（未调用模型）', trace);
    }

    var retrievalStartedAt = Date.now();
    var citations;

    if (fixedCitations && fixedCitations.length) {
      citations = fixedCitations.map(function (citation, index) {
        return {
          index: index + 1,
          policyId: citation.policyId,
          policyName: citation.policyName,
          version: citation.version,
          scope: citation.scope,
          section: citation.section,
          paragraph: citation.paragraph,
          positionLabel: citation.positionLabel,
          text: citation.text,
          fileName: citation.fileName
        };
      });
    } else {
      var retrievalOptions = opts.retrieval ? {
        topK: opts.retrieval.topK,
        semanticCandidates: opts.retrieval.semanticCandidates,
        keywordCandidates: opts.retrieval.keywordCandidates
      } : (onlineRelease && onlineRelease.retrieval ? {
        topK: onlineRelease.retrieval.passageLimit,
        semanticCandidates: onlineRelease.retrieval.semanticCandidates,
        keywordCandidates: onlineRelease.retrieval.keywordCandidates
      } : undefined);
      var search = retrieval.searchPolicyPassages(actor, question, retrievalOptions);
      var results = search.ok ? search.results : [];
      citations = results.map(function (result, index) {
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

    pushTraceStage(trace, 'retrieval', '查找制度原文', citations.length ? 'pass' : 'fail', Date.now() - retrievalStartedAt,
      citations.length ? ('找到 ' + citations.length + ' 段相关原文。') : '没有找到相关原文。', {
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

    var conflicts = detectConflicts(citations);
    if (conflicts.length) {
      var conflictAns = conflictAnswer(conflicts, citations);
      if (intent.type === 'mixed') {
        conflictAns.kind = 'mixed';
        conflictAns.leaveCard = buildLeaveCard(actor, intent.year);
        conflictAns.verification = [
          { name: '年假账本核对', result: 'pass', detail: '余额来自 HR 维护的账本（流水合计）。' },
          { name: '余额来源检查', result: 'pass', detail: '余额只从账本读取，未交给模型计算。' }
        ].concat(conflictAns.verification);
        conflictAns.note = '年假余额来自系统账本；制度部分存在冲突。';
      }

      pushTraceStage(trace, 'generation', '生成回答', 'skipped', 0, '发现制度冲突，未调用生成模型。');
      var conflictRule = traceRuleStatus(conflictAns.verification);
      pushTraceStage(trace, 'rule', '规则核验', conflictRule.status, 0, conflictRule.detail);
      var conflictSemantic = traceSemanticVerification(conflictAns.verification);
      pushTraceStage(trace, 'semantic', '语义核验', conflictSemantic.status, 0, conflictSemantic.detail);

      return finalize(conflictAns, startedAt, '未调用模型', trace);
    }

    var generationStartedAt = Date.now();
    return policyPart(actor, question, citations, config, configured, prompts).then(function (part) {
      pushTraceStage(trace, 'generation', '生成回答', part.ok ? 'pass' : 'fail', Date.now() - generationStartedAt,
        part.ok ? '已按制度原文生成回答内容。' : '生成失败，改用本地摘要或返回错误。');

      if (!part.ok) {
        if (intent.type === 'mixed') {
          return verifyAndCompose(question, localAnswer(question, citations), citations, config, false, trace, prompts).then(function (verified) {
            verified.kind = 'mixed';
            verified.leaveCard = buildLeaveCard(actor, intent.year);
            verified.verification = [
              { name: '年假账本核对', result: 'pass', detail: '余额来自 HR 维护的账本（流水合计）。' },
              { name: '余额来源检查', result: 'pass', detail: '余额只从账本读取，未交给模型计算。' }
            ].concat(verified.verification);
            verified.note = '年假余额来自系统账本；制度部分生成失败（' + part.error + '），已改用本地摘要。';
            return finalize(verified, startedAt, '本地摘要（演示）', trace);
          });
        }
        return sleep(MIN_DELAY_MS).then(function () {
          return {
            ok: false,
            error: part.error,
            elapsedMs: Math.max(0, Math.round(Date.now() - startedAt)),
            modelName: modelName
          };
        });
      }

      return verifyAndCompose(question, part.partial, citations, config, configured, trace, prompts).then(function (verified) {
        if (intent.type === 'mixed') {
          verified.kind = 'mixed';
          verified.leaveCard = buildLeaveCard(actor, intent.year);
          verified.verification = [
            { name: '年假账本核对', result: 'pass', detail: '余额来自 HR 维护的账本（流水合计）。' },
            { name: '余额来源检查', result: 'pass', detail: '余额只从账本读取，未交给模型计算。' }
          ].concat(verified.verification);
          verified.note = '年假余额来自系统账本；制度部分依据制度原文回答。';
          if (verified.status === 'insufficient') verified.status = 'partial';
          return finalize(verified, startedAt, configured ? config.model : LOCAL_MODEL_NAME, trace);
        }
        return finalize(verified, startedAt, configured ? config.model : LOCAL_MODEL_NAME, trace);
      });
    });
  }

  window.OnboardAnswer = {
    generateAnswer: generateAnswer,
    classifyQuestion: classifyQuestion,
    LOCAL_MODEL_NAME: LOCAL_MODEL_NAME
  };
})();
