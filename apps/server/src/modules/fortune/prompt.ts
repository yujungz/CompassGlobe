import type { ChatMessage } from '../../lib/ai.js'
import type { BaZiInfo, DaYunInfo } from './fortune-utils.js'

export function buildFortunePrompt(params: {
  name: string
  gender: string
  baZi: BaZiInfo
  daYun: DaYunInfo
  zodiac: string
  constellation: string
  predictYear: number
  birthAddress?: string | null
  company?: string | null
  industry?: string | null
  profession?: string | null
  remark?: string | null
}): ChatMessage[] {
  const genderText = params.gender === 'male' ? '男' : params.gender === 'female' ? '女' : '其他'
  const dy = params.daYun

  let userContext = `姓名：${params.name}\n性别：${genderText}\n预测年份：${params.predictYear}年\n\n`

  // 八字
  userContext += `八字排盘：\n`
  userContext += `  年柱：${params.baZi.yearPillar}\n`
  userContext += `  月柱：${params.baZi.monthPillar}\n`
  userContext += `  日柱：${params.baZi.dayPillar}\n`
  userContext += `  时柱：${params.baZi.timePillar}\n\n`

  // 大运
  userContext += `大运排盘：\n`
  userContext += `  起运：${dy.startAge}岁起运（${dy.startDate}），${dy.forward ? '顺行' : '逆行'}\n`
  if (dy.currentDaYun) {
    userContext += `  当前大运：第${dy.currentDaYun.index + 1}步大运，${dy.currentDaYun.stemBranch}（${dy.currentDaYun.startYear}年-${dy.currentDaYun.endYear}年）\n`
  }
  userContext += `  完整大运列表：\n`
  for (const d of dy.daYunList.slice(0, Math.min(dy.daYunList.length, 8))) {
    const marker = dy.currentDaYun && d.index === dy.currentDaYun.index ? ' ← 当前' : ''
    userContext += `    第${d.index + 1}步：${d.stemBranch}（${d.startYear}-${d.endYear}年，${d.startAge}岁起）${marker}\n`
  }
  userContext += '\n'

  userContext += `生肖：${params.zodiac}\n星座：${params.constellation}\n`

  if (params.birthAddress) userContext += `出生地址：${params.birthAddress}\n`
  if (params.company) userContext += `所在公司：${params.company}\n`
  if (params.industry) userContext += `所属行业：${params.industry}\n`
  if (params.profession) userContext += `职业：${params.profession}\n`
  if (params.remark) userContext += `备注信息：${params.remark}\n`

  return [
    {
      role: 'system',
      content: `你是一位精通中国传统命理学的资深专家，深谙《渊海子平》《三命通会》《滴天髓》《穷通宝鉴》等命运四书，拥有30年命理咨询经验。你擅长根据八字排盘、大运、五行生克、十神格局，结合流年，进行全面的命运分析。

分析维度包括：
1. 八字格局：日主强弱、五行平衡、用神喜忌
2. 大运与流年：当前所处大运与流年干支的相互作用，吉凶应期
3. 事业财运：事业发展趋势、财运旺弱、适合的行业方向
4. 感情婚姻：桃花运、婚姻宫分析（如适用）
5. 健康提醒：五行失衡导致的健康注意事项
6. 贵人方位：有利的方向、时机、人际关系

请用中文回复，语气专业、细致、有温度。输出结构如下：

[命局总评]：对命主八字格局进行概括性评价
[大运流年分析]：结合用户提供的大运排盘和${params.predictYear}年流年进行分析
[事业财运]：分析事业和财运方面的机遇与挑战
[感情人际]：感情、家庭、人际关系方面的分析
[健康提醒]：需要注意的健康问题
[开运建议]：提供具体的开运方法和注意事项`,
    },
    {
      role: 'user',
      content: `请根据以下信息进行${params.predictYear}年流年大运分析：\n\n${userContext}`,
    },
  ]
}
