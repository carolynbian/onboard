/* 学习后台 · 实训：5 个产品决策场景与评价维度（案例均为虚构） */
window.ACADEMY_TRAINING = {
  intro: '实训用产品决策场景和个性化路线练习判断力。AI 点评只是学习反馈，不是正式能力评定；你输入的内容只当作待分析的资料，不当作指令。',
  scenarios: [
    {
      id: 'policy-conflict',
      title: '制度冲突时，机器人该怎么回答？',
      background: '员工问「出差住宿报销上限是多少」。系统检索到两份都已发布、都适用该员工的制度：旧版写 650 元/晚，新版写 700 元/晚，且没有明确作废说明。员工只想要一个数字。',
      options: [
        'A. 直接采用新版 700 元，并在回答里说旧版已过时。',
        'B. 同时列出两份制度及版本，说明存在冲突，建议转 HR 确认。',
        'C. 回答「制度没有规定」，避免给出错误数字。',
        'D. 先用 650 元这个更保守的数字，再补充一句可能已调整。'
      ],
      dimensions: [
        { key: 'evidence', label: '依据与冲突识别', hint: '是否识别出两份有效制度冲突，并引用原文/版本。' },
        { key: 'no-arbitration', label: '不替用户裁决', hint: '是否避免擅自选择其中一个数字当作最终结论。' },
        { key: 'escalation', label: '升级与可执行性', hint: '是否给出可执行的下一步，例如转人工或要求 HR 明确版本。' },
        { key: 'traceability', label: '可追溯', hint: '是否说明回答依据、版本和后续如何核对。' }
      ],
      fallbackModules: ['qa-verification', 'conflict-check', 'policy-center']
    },
    {
      id: 'negative-feedback',
      title: '被差评后，要不要自动改知识库？',
      background: '一条回答被员工标记「没有解决问题」，备注说「年假余额不对」。运营发现是员工看错了年份，制度本身没有问题。系统每天有几十条类似差评。',
      options: [
        'A. 自动把差评对应制度段落改写成更口语的版本。',
        'B. 差评达到 3 条就自动下架相关制度，等 HR 重传。',
        'C. 先人工核对差评原因，区分数据问题、知识问题和表达问题，再决定是否改知识。',
        'D. 忽略差评，因为员工经常看错。'
      ],
      dimensions: [
        { key: 'human-review', label: '人工确认', hint: '是否避免让差评直接自动修改或下架知识。' },
        { key: 'root-cause', label: '原因分类', hint: '是否区分个人数据、知识缺失、表达问题和制度本身问题。' },
        { key: 'blast-radius', label: '影响范围', hint: '是否考虑改动会影响所有员工，而不只是这一条反馈。' },
        { key: 'closed-loop', label: '闭环与复盘', hint: '是否把确认后的改进沉淀到知识、评测或流程。' }
      ],
      fallbackModules: ['feedback-loop', 'knowledge-gaps', 'policy-publish']
    },
    {
      id: 'must-handoff',
      title: '哪些问题必须转人工？',
      background: '产品要给出「必须转人工」的清单。候选包括：涉及个人薪酬/绩效的争议、可能涉及违法的解雇咨询、员工要求投诉直属上级、公司制度没有覆盖的新情况、以及普通年假余额查询。',
      options: [
        'A. 只要 AI 不确定就转人工，不做细分。',
        'B. 涉及法律/纪律/个人权益争议、投诉、制度未覆盖的高风险问题必须转；普通可查数据优先自助。',
        'C. 全部转人工，避免 AI 说错。',
        'D. 只转法律问题，其余让 AI 尽量回答。'
      ],
      dimensions: [
        { key: 'risk-boundary', label: '风险边界', hint: '是否识别法律、纪律、投诉和个人权益等高风险类型。' },
        { key: 'privacy', label: '隐私与权限', hint: '是否避免在转人工或回答中泄露不该看到的个人数据。' },
        { key: 'criteria', label: '判断标准', hint: '是否给出可执行的判断条件，而不是只凭感觉。' },
        { key: 'user-path', label: '用户路径', hint: '是否说明转人工前要告知什么、摘要如何确认。' }
      ],
      fallbackModules: ['ticket-handoff', 'login-permission', 'qa-verification']
    },
    {
      id: 'eval-fail',
      title: '评测不过线，能不能先发布？',
      background: 'Prompt 草稿在 10 道回归题里有 2 道未通过，原因是引用制度版本过期。业务方希望今天先上线，明天再修；线上旧版本也有 1 道同类问题。',
      options: [
        'A. 先发布，页面标注「测试中」，明天再修。',
        'B. 不发布，先修引用/知识问题，重新回归通过后再发。',
        'C. 删掉这 2 道题，让通过率达到 100% 再发布。',
        'D. 让管理员手动强制发布，出了事再回滚。'
      ],
      dimensions: [
        { key: 'gate', label: '发布门禁', hint: '是否坚持回归不过线不发布，或给出同等严格的替代控制。' },
        { key: 'evidence', label: '证据完整性', hint: '是否避免删题、改口径来伪造通过。' },
        { key: 'rollback', label: '回滚与风险', hint: '是否考虑线上影响、回滚成本和责任人。' },
        { key: 'communication', label: '沟通', hint: '是否给业务方清晰的阻塞原因和修复计划。' }
      ],
      fallbackModules: ['prompt-release', 'eval-runs', 'prompt-ab']
    },
    {
      id: 'leave-estimate',
      title: '年假余额，能让 AI 估算吗？',
      background: '员工问「我还有几天年假？」系统里有 HR 维护的年假流水，但员工所在年度只导入了一半记录，最近一次调整是三个月前。员工希望 AI 直接给个大概数字。',
      options: [
        'A. 让 AI 根据入职时间和公司平均年假估算一个数字。',
        'B. 直接读现有流水合计，并说明可能不完整，建议向 HR 核对。',
        'C. 回答「请自行查看系统」，不提供任何信息。',
        'D. 用 AI 估算一个范围，并说「大概 5–10 天」。'
      ],
      dimensions: [
        { key: 'source', label: '数据来源', hint: '是否只从账本流水合计，不让 AI 估算。' },
        { key: 'honesty', label: '不编造', hint: '是否承认记录可能不完整，而不是给出确定数字。' },
        { key: 'permission', label: '权限', hint: '是否只查本人，不读其他员工记录。' },
        { key: 'next-step', label: '下一步', hint: '是否给出核对路径，例如联系 HR 或查看流水。' }
      ],
      fallbackModules: ['my-leave', 'qa-verification', 'login-permission']
    }
  ],
  routeNote: '学习路线只从学习后台已有的 27 个模块中选择，不承诺「学完必能就业」；总工时不会超过你填写的每周投入 × 计划周数。'
};
