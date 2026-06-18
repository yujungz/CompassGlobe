import type { ChatMessage } from '../../lib/ai.js'

// 天气上下文（与前端 WeatherInfo 对应）
interface WeatherContext {
  temperature?: number
  humidity?: number
  windSpeed?: number
  windDirection?: string
  weather?: string
}

export interface FengShuiContext {
  longitude: number
  latitude: number
  altitude?: number | null
  address?: string
  weather?: WeatherContext | null
  bagua?: string
}

const SYSTEM_PROMPT =
  '你是一位精通中国传统风水学的顾问，擅长结合地理、气候与八卦方位进行环境分析。' +
  '请基于用户提供的地点信息给出专业、客观、简洁的风水分析。' +
  '注意：分析结果仅供文化参考与娱乐，不构成专业堪舆或决策建议。'

// 构造风水分析提示词，仅拼入存在的字段
export const buildFengShuiPrompt = (ctx: FengShuiContext): ChatMessage[] => {
  const lines: string[] = []
  lines.push(`- 位置：经度 ${ctx.longitude}°，纬度 ${ctx.latitude}°`)
  if (ctx.address) lines.push(`- 地址：${ctx.address}`)
  if (ctx.altitude != null) lines.push(`- 海拔：${ctx.altitude} 米`)
  if (ctx.weather) {
    const w = ctx.weather
    const parts: string[] = []
    if (w.weather) parts.push(w.weather)
    if (w.temperature != null) parts.push(`温度 ${w.temperature}°C`)
    if (w.humidity != null) parts.push(`湿度 ${w.humidity}%`)
    if (w.windDirection) parts.push(w.windDirection)
    if (w.windSpeed != null) parts.push(`风速 ${w.windSpeed} km/h`)
    if (parts.length) lines.push(`- 天气：${parts.join('，')}`)
  }
  if (ctx.bagua) lines.push(`- 八卦方位：${ctx.bagua}`)

  const baguaHint = ctx.bagua ? `（方位：${ctx.bagua}）` : ''

  const userPrompt = `请对以下地点进行风水分析：

${lines.join('\n')}

请按以下结构输出（纯文本，分节清晰）：

【总体评价】一两句话概括该地的风水总体格局。
【地形与海拔】结合海拔与地理位置分析地势利弊。
【气候与天气】结合当前天气与气候特征分析。
【八卦方位】基于八卦方位${baguaHint}分析方位寓意与吉凶。
【布局与择址建议】给出 2-3 条具体的布局或择址建议。
【综合评分】给出 0-100 的综合风水评分，并简述理由。

语言简洁专业，全文控制在 400 字以内。`

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ]
}
