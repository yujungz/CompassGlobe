// 八卦方位计算（基于经度简化推算）
const BAGUA_DIRECTIONS = ['坎', '艮', '震', '巽', '离', '坤', '兑', '乾']

export const getBaguaDirection = (longitude: number): string => {
  const index = Math.floor((((longitude % 360) + 360) % 360) / 45)
  return BAGUA_DIRECTIONS[index]
}
