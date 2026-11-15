/* ============================================================
   初见 Onboard · 制度检索
   ------------------------------------------------------------
   只做“找原文”，不生成回答。
   规则：
   1. 先按当前登录用户的可见性过滤制度（与制度中心同一套规则：
      已发布 + 在有效期内 + 全员或本人部门），再排序；
   2. 兼顾“关键词命中”和“意思相近”（本地轻量语义相似度），合并排序；
   3. 每段原文带上制度、版本、章节、段号，供后续引用。
   全部在本机完成，不联网。
   ============================================================ */
(function () {
  'use strict';

  var TOP_K = 6;
  var MIN_SCORE = 0.12;
  var DEFAULT_SEMANTIC_CANDIDATES = 200;
  var DEFAULT_KEYWORD_CANDIDATES = 200;
  var CHUNK_TARGET = 240;
  var CHUNK_MAX = 420;

  var STOP_BIGRAMS = [
    '什么', '怎么', '哪些', '是否', '如何', '可以', '请问', '一下', '这个', '那个',
    '还有', '多少', '几天', '我的', '我们', '你们', '他们', '没有', '不能', '需要',
    '应该', '告诉', '知道', '想问', '问一', '查一', '帮我看', '能不', '可以吗', '为什',
    '公司', '咱们', '贵司', '请问'
  ];

  var DOMAIN_TERMS = [
    '年假', '请假', '病假', '事假', '婚假', '产假', '陪产假', '丧假', '调休', '加班',
    '试用期', '转正', '入职', '离职', '报销', '出差', '住宿', '餐补', '交通', '发票',
    '审批', '流程', '材料', '时限', '标准', '额度', '折扣', '回款', '提成', '合同',
    '绩效', '考核', '招聘', '面试', '培训', '档案', '安全', '发布', '上线', '制度',
    '范围', '申请', '条件', '天数', '金额', '比例', '生效', '版本', '部门', '全员',
    '结转', '跨年', '次年', '余额', '剩余', '查询', '休假', '假期', '费用', '票据',
    '差旅', '目标', '预算', '付款', '月结', '评审', '需求', '代码', '故障', '值班',
    '回滚', '灰度', '验收', '签订', '薪资', '薪酬', '证明', '期限', '工作日', '截止'
  ];

  var SYNONYMS = {
    '年假': ['年休', '带薪年假', '年假余额', '结转', '次年', '跨年', '余额'],
    '休假': ['年假', '年休', '请假', '假期', '休息'],
    '结转': ['留到明年', '留到以后', '次年', '跨年', '延期', '余额'],
    '请假': ['休假', '假期', '请假单', '事假', '病假'],
    '病假': ['生病', '医院证明', '病假条'],
    '报销': ['费用', '票据', '发票', '报销单'],
    '出差': ['差旅', '住宿', '餐补', '交通'],
    '试用期': ['试用', '转正', '考核'],
    '转正': ['试用期', '评估'],
    '制度': ['规定', '办法', '规范'],
    '流程': ['步骤', '办理', '申请', '审批'],
    '材料': ['证明', '清单', '文件'],
    '时限': ['期限', '工作日', '天内', '截止'],
    '入职': ['报到', '劳动合同'],
    '离职': ['辞职', '离职证明'],
    '加班': ['调休', '值班', '加班费'],
    '工资': ['薪资', '薪酬', '计薪'],
    '招聘': ['面试', 'offer', '需求'],
    '绩效': ['考核', '评估', '申诉'],
    '安全': ['密钥', '漏洞', '权限'],
    '预算': ['费用', '额度', '超支']
  };

  var STOP_CHARS = '的了呢吗吧啊我你他她它们是在有和与及或要会能可什么怎么哪些如何请问一下这个那个还有多少几天就不把被给对从到让用做没找看查说讲告诉知道想需要应该';

  function cleanText(text) {
    return String(text == null ? '' : text)
      .replace(/[，。；：！？、,.!?;:"'“”‘’（）()\[\]【】《》<>\s]/g, '');
  }

  function countBigrams(text) {
    var counts = {};
    var value = cleanText(text);
    for (var i = 0; i < value.length - 1; i++) {
      var gram = value.slice(i, i + 2);
      if (STOP_BIGRAMS.indexOf(gram) !== -1) continue;
      counts[gram] = (counts[gram] || 0) + 1;
    }
    return counts;
  }

  function cosine(left, right) {
    var dot = 0;
    var leftLength = 0;
    var rightLength = 0;
    var gram;
    for (gram in left) {
      if (!Object.prototype.hasOwnProperty.call(left, gram)) continue;
      leftLength += left[gram] * left[gram];
    }
    for (gram in right) {
      if (!Object.prototype.hasOwnProperty.call(right, gram)) continue;
      rightLength += right[gram] * right[gram];
    }
    for (gram in left) {
      if (!Object.prototype.hasOwnProperty.call(left, gram)) continue;
      if (right[gram]) dot += left[gram] * right[gram];
    }
    if (!leftLength || !rightLength) return 0;
    return dot / (Math.sqrt(leftLength) * Math.sqrt(rightLength));
  }

  function questionProfile(question) {
    var cleaned = cleanText(question);
    var base = countBigrams(cleaned);
    var expanded = {};
    var gram;

    for (gram in base) {
      if (Object.prototype.hasOwnProperty.call(base, gram)) expanded[gram] = base[gram];
    }

    var domainHits = [];
    DOMAIN_TERMS.forEach(function (term) {
      if (cleaned.indexOf(term) !== -1) domainHits.push(term);
    });

    Object.keys(SYNONYMS).forEach(function (key) {
      if (cleaned.indexOf(key) === -1) return;
      SYNONYMS[key].forEach(function (word) {
        var grams = countBigrams(word);
        Object.keys(grams).forEach(function (synGram) {
          expanded[synGram] = (expanded[synGram] || 0) + 0.8 * grams[synGram];
        });
      });
    });

    return {
      cleaned: cleaned,
      base: base,
      expanded: expanded,
      domainHits: domainHits,
      baseCount: Object.keys(base).length
    };
  }

  // 把制度正文切成“可引用的原文段”，并记下章节与段号
  function splitPolicyPassages(policy) {
    var text = String((policy && policy.parsedText) || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    if (!text.trim()) return [];

    var lines = text.split('\n');
    var blocks = [];
    var currentSection = '';
    var buffer = [];

    function flush() {
      if (!buffer.length) return;
      var content = buffer.join('\n').trim();
      buffer = [];
      if (content) blocks.push({ section: currentSection, text: content });
    }

    lines.forEach(function (line) {
      var trimmed = line.trim();
      if (!trimmed) {
        flush();
        return;
      }
      if (/^(文件编号|版本号|演示生效日期|适用范围|制度维护部门|变更摘要)[：:]/.test(trimmed)) {
        return;
      }
      var heading = /^[一二三四五六七八九十]+、/.test(trimmed) && trimmed.length <= 30;
      if (heading) {
        flush();
        currentSection = trimmed;
        buffer.push(trimmed);
        return;
      }
      buffer.push(trimmed);
    });
    flush();

    var passages = [];
    var paragraph = 0;
    var cursor = 0;

    blocks.forEach(function (block) {
      var sentences = block.text.replace(/([。；！？])/g, '$1\u0001').split('\u0001').filter(function (item) {
        return item.trim();
      });

      var chunk = '';
      var chunks = [];

      sentences.forEach(function (sentence) {
        if (chunk && (chunk + sentence).length > CHUNK_TARGET && chunk.length >= 120) {
          chunks.push(chunk.trim());
          chunk = '';
        }
        if (!chunk && sentence.length > CHUNK_MAX) {
          for (var start = 0; start < sentence.length; start += CHUNK_TARGET) {
            chunks.push(sentence.slice(start, start + CHUNK_TARGET + 40).trim());
          }
          return;
        }
        chunk += sentence;
      });
      if (chunk.trim()) chunks.push(chunk.trim());

      chunks.forEach(function (chunkText) {
        if (!chunkText) return;
        var at = text.indexOf(chunkText, cursor);
        if (at === -1) at = cursor;
        cursor = at + chunkText.length;
        paragraph += 1;
        passages.push({
          policyId: policy.id,
          policyName: policy.name,
          category: policy.category,
          version: policy.version,
          scope: policy.scope,
          effectiveDate: policy.effectiveDate,
          fileName: policy.fileName,
          section: block.section || '',
          paragraph: paragraph,
          charStart: at,
          charEnd: at + chunkText.length,
          positionLabel: (block.section ? block.section + ' · ' : '') + '第 ' + paragraph + ' 段',
          text: chunkText
        });
      });
    });

    return passages;
  }

  function scorePassage(profile, passage, passageProfile) {
    var keywordHits = 0;
    var gram;
    var text = passage.text;

    for (gram in profile.base) {
      if (!Object.prototype.hasOwnProperty.call(profile.base, gram)) continue;
      if (text.indexOf(gram) !== -1) keywordHits += 1;
    }
    profile.domainHits.forEach(function (term) {
      if (text.indexOf(term) !== -1) keywordHits += 2;
    });

    var keywordDenominator = profile.baseCount + profile.domainHits.length * 2;
    var keywordScore = keywordDenominator ? keywordHits / keywordDenominator : 0;

    if (profile.cleaned.length >= 4 && text.indexOf(profile.cleaned) !== -1) {
      keywordScore = Math.min(1, keywordScore + 0.3);
    }

    var semanticScore = cosine(profile.expanded, passageProfile);
    var combined = 0.5 * keywordScore + 0.5 * semanticScore;

    return {
      keywordScore: keywordScore,
      semanticScore: semanticScore,
      combined: combined
    };
  }

  function searchPolicyPassages(user, question, options) {
    var store = window.OnboardStore;
    var opts = options || {};
    var topK = typeof opts.topK === 'number' ? opts.topK : TOP_K;
    var semanticLimit = typeof opts.semanticCandidates === 'number' ? opts.semanticCandidates : DEFAULT_SEMANTIC_CANDIDATES;
    var keywordLimit = typeof opts.keywordCandidates === 'number' ? opts.keywordCandidates : DEFAULT_KEYWORD_CANDIDATES;

    if (!store) return { ok: false, results: [], message: '数据没有加载完成。' };
    if (!user) return { ok: false, results: [], message: '请先登录。' };

    var cleanedQuestion = String(question == null ? '' : question).trim();
    if (!cleanedQuestion) return { ok: false, results: [], message: '请输入问题。' };

    // 第 1 步（永远先做）：只保留这位员工有权看到的制度
    var visiblePolicies = store.listVisiblePolicies(user);

    var startedAt = Date.now();
    var passages = [];

    visiblePolicies.forEach(function (policy) {
      if (!policy || !policy.parsedText) return;
      splitPolicyPassages(policy).forEach(function (passage) {
        passages.push(passage);
      });
    });

    // 第 2 步：对可见范围内的原文片段打分（关键词 + 语义）
    var profile = questionProfile(cleanedQuestion);
    var scored = [];

    passages.forEach(function (passage) {
      var passageProfile = countBigrams(passage.text);
      var scores = scorePassage(profile, passage, passageProfile);
      if (scores.combined < (typeof opts.minScore === 'number' ? opts.minScore : MIN_SCORE)) return;
      scored.push({
        passage: passage,
        keywordScore: scores.keywordScore,
        semanticScore: scores.semanticScore,
        score: scores.combined
      });
    });

    // 第 3 步：两路各取候选，合并后再按综合分排序，最终只留 topK
    var semanticRanked = scored.slice().sort(function (left, right) {
      if (right.semanticScore !== left.semanticScore) return right.semanticScore - left.semanticScore;
      return right.score - left.score;
    });
    var keywordRanked = scored.slice().sort(function (left, right) {
      if (right.keywordScore !== left.keywordScore) return right.keywordScore - left.keywordScore;
      return right.score - left.score;
    });

    var semanticList = semanticRanked.slice(0, Math.max(0, semanticLimit));
    var keywordList = keywordRanked.slice(0, Math.max(0, keywordLimit));
    var mergedMap = {};

    semanticList.concat(keywordList).forEach(function (item) {
      var key = item.passage.policyId + '|' + item.passage.charStart + '|' + item.passage.charEnd;
      if (!mergedMap[key]) mergedMap[key] = item;
    });

    var merged = Object.keys(mergedMap).map(function (key) { return mergedMap[key]; });
    merged.sort(function (left, right) {
      if (right.score !== left.score) return right.score - left.score;
      return right.keywordScore - left.keywordScore;
    });

    var results = merged.slice(0, topK).map(function (item) {
      return {
        score: Math.round(item.score * 1000) / 1000,
        keywordScore: Math.round(item.keywordScore * 1000) / 1000,
        semanticScore: Math.round(item.semanticScore * 1000) / 1000,
        policyId: item.passage.policyId,
        policyName: item.passage.policyName,
        category: item.passage.category,
        version: item.passage.version,
        scope: item.passage.scope,
        effectiveDate: item.passage.effectiveDate,
        fileName: item.passage.fileName,
        section: item.passage.section,
        paragraph: item.passage.paragraph,
        positionLabel: item.passage.positionLabel,
        charStart: item.passage.charStart,
        charEnd: item.passage.charEnd,
        text: item.passage.text
      };
    });

    return {
      ok: true,
      question: cleanedQuestion,
      visiblePolicies: visiblePolicies.map(function (policy) {
        return {
          id: policy.id,
          name: policy.name,
          version: policy.version,
          scope: policy.scope,
          effectiveDate: policy.effectiveDate
        };
      }),
      passageCount: passages.length,
      candidateCounts: {
        semantic: semanticList.length,
        keyword: keywordList.length,
        merged: merged.length
      },
      results: results,
      elapsedMs: Date.now() - startedAt
    };
  }

  window.OnboardRetrieval = {
    searchPolicyPassages: searchPolicyPassages,
    splitPolicyPassages: splitPolicyPassages,
    questionProfile: questionProfile,
    DOMAIN_TERMS: DOMAIN_TERMS
  };
})();
