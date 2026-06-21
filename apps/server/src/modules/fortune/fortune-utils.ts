import { Lunar, Solar } from 'lunar-typescript'

export interface BaZiInfo {
  yearPillar: string
  monthPillar: string
  dayPillar: string
  timePillar: string
}

export interface DaYunInfo {
  startYear: number        // 起运年份
  startAge: number         // 几岁起运
  startDate: string        // 起运日期描述
  forward: boolean         // 顺行/逆行
  currentDaYun: {          // 预测年所在的大运
    index: number           // 第几步大运
    startYear: number
    endYear: number
    stemBranch: string      // 干支
  } | null
  daYunList: Array<{       // 完整大运列表
    index: number
    startAge: number
    startYear: number
    endYear: number
    stemBranch: string
  }>
}

export interface FortuneCalcResult {
  baZi: BaZiInfo
  zodiac: string
  constellation: string
  predictYear: number
  solarBirth: { year: number; month: number; day: number }
  daYun: DaYunInfo
}

/**
 * 计算八字、大运、生肖、星座、预测年份
 */
export function calculateFortune(params: {
  birthYear: number
  birthMonth: number
  birthDay: number
  birthHour: number
  isLunar: boolean
  gender: string // "male" or "female"
}): FortuneCalcResult {
  let solar: Solar

  if (params.isLunar) {
    const lunar = Lunar.fromYmd(params.birthYear, params.birthMonth, params.birthDay)
    solar = lunar.getSolar()
  } else {
    solar = Solar.fromYmd(params.birthYear, params.birthMonth, params.birthDay)
  }

  const lunar = solar.getLunar()
  const eightChar = lunar.getEightChar()

  // 设置时辰
  const hourIdx = Math.floor(((params.birthHour || 0) + 1) % 24 / 2)
  eightChar.setSect(hourIdx)

  // 八字四柱
  const baZi: BaZiInfo = {
    yearPillar: eightChar.getYear(),
    monthPillar: eightChar.getMonth(),
    dayPillar: eightChar.getDay(),
    timePillar: eightChar.getTime(),
  }

  // 生肖
  const zodiac = lunar.getYearShengXiao()

  // 星座
  const constellation = solar.getXingZuo()

  // 预测年份（6月30日为界）
  const now = new Date()
  const cutoff = new Date(now.getFullYear(), 5, 30)
  const predictYear = now <= cutoff ? now.getFullYear() : now.getFullYear() + 1

  // ===== 大运计算 =====
  // 性别: 1=男, 0=女 (lunar-typescript 的约定)
  const genderCode = params.gender === 'male' ? 1 : 0
  const yun = eightChar.getYun(genderCode)

  const startYear = yun.getStartYear()      // 起运公历年
  const startMonth = yun.getStartMonth()    // 起运公历月
  const startDay = yun.getStartDay()        // 起运公历日
  const forward = yun.isForward()           // 顺行(true)/逆行(false)

  const daYunArr = yun.getDaYun()           // 大运数组，每步大运10年

  // startAge 在第一个 DaYun 对象上
  const startAge = daYunArr.length > 0 ? daYunArr[0].getStartAge() : 1

  const daYunList: DaYunInfo['daYunList'] = daYunArr
    .filter(item => item.getGanZhi() && item.getGanZhi().trim() !== '') // 过滤空干支的第一条
    .map((item, idx) => ({
      index: idx,
      startAge: item.getStartAge(),
      startYear: item.getStartYear(),
      endYear: item.getEndYear(),
      stemBranch: `${item.getGanZhi()}`,
    }))

  // 找到预测年对应的大运
  let currentDaYun: DaYunInfo['currentDaYun'] = null
  for (let i = 0; i < daYunList.length; i++) {
    const d = daYunList[i]
    if (predictYear >= d.startYear && predictYear <= d.endYear) {
      currentDaYun = {
        index: i,
        startYear: d.startYear,
        endYear: d.endYear,
        stemBranch: d.stemBranch,
      }
      break
    }
  }

  // 起运日历年份 = 出生年 + 起运年龄
  const qiYunYear = solar.getYear() + startAge

  const daYun: DaYunInfo = {
    startYear: qiYunYear,
    startAge,
    startDate: `公历 ${qiYunYear}年${startMonth}月${startDay}日（${startAge}周岁起运）`,
    forward,
    currentDaYun,
    daYunList,
  }

  return {
    baZi,
    zodiac,
    constellation,
    predictYear,
    solarBirth: { year: solar.getYear(), month: solar.getMonth(), day: solar.getDay() },
    daYun,
  }
}
