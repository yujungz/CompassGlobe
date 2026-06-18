import { Router } from 'express'
import axios from 'axios'
import crypto from 'node:crypto'
import fs from 'node:fs'

const router = Router()

const TDT_KEY = process.env.TDT_KEY || ''
const AMAP_KEY = process.env.AMAP_KEY || ''

// 和风天气 JWT(Ed25519) 认证配置
const QWEATHER_API_HOST = process.env.QWEATHER_API_HOST || '' // 例如 k57p44c8p6.re.qweatherapi.com
const QWEATHER_PROJECT_ID = process.env.QWEATHER_PROJECT_ID || '' // sub
const QWEATHER_CREDENTIAL_ID = process.env.QWEATHER_CREDENTIAL_ID || '' // kid
const QWEATHER_PRIVATE_KEY_PATH = process.env.QWEATHER_PRIVATE_KEY_PATH || ''

const isQWeatherConfigured = () =>
  !!(QWEATHER_API_HOST && QWEATHER_PROJECT_ID && QWEATHER_CREDENTIAL_ID && QWEATHER_PRIVATE_KEY_PATH)

// 和风 JWT 令牌生成 + 短期缓存（exp 前自动刷新，避免每次请求重签）
let qweatherTokenCache: { token: string; exp: number } | null = null
const getQWeatherToken = (): string => {
  const now = Math.floor(Date.now() / 1000)
  if (qweatherTokenCache && qweatherTokenCache.exp - now > 60) {
    return qweatherTokenCache.token
  }
  const privateKey = crypto.createPrivateKey({
    key: fs.readFileSync(QWEATHER_PRIVATE_KEY_PATH, 'utf8'),
    format: 'pem',
  })
  const iat = now - 30 // 官方建议 iat 设为当前时间前 30 秒，防时钟误差
  const header = { alg: 'EdDSA', kid: QWEATHER_CREDENTIAL_ID }
  const payload = { sub: QWEATHER_PROJECT_ID, iat, exp: iat + 900 }
  const b64url = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const signingInput = `${b64url(header)}.${b64url(payload)}`
  const sig = crypto.sign(null, Buffer.from(signingInput), privateKey) // Ed25519: 算法参数传 null
  const token = `${signingInput}.${sig.toString('base64url')}`
  qweatherTokenCache = { token, exp: iat + 900 }
  return token
}

// 下发天地图密钥（前端地球仪瓦片图层使用）
// 天地图瓦片密钥本质为客户端密钥，会暴露在浏览器，生产环境应在天地图控制台配置域名白名单
router.get('/tdt-key', (_req, res) => {
  res.json({ key: TDT_KEY })
})

// 获取位置信息
router.get('/location', async (req, res) => {
  const { longitude, latitude } = req.query

  if (!longitude || !latitude) {
    return res.status(400).json({ error: '缺少经纬度参数' })
  }

  try {
    // 逆地理编码
    let address = ''
    if (AMAP_KEY) {
      const response = await axios.get('https://restapi.amap.com/v3/geocode/regeo', {
        params: {
          key: AMAP_KEY,
          location: `${longitude},${latitude}`,
          extensions: 'base',
        },
      })
      if (response.data.status === '1') {
        address = response.data.regeocode.formatted_address
      }
    }

    // 计算时区（简化版）
    const timezone = `UTC${Math.round(parseFloat(longitude as string) / 15) >= 0 ? '+' : ''}${Math.round(parseFloat(longitude as string) / 15)}`

    res.json({
      longitude: parseFloat(longitude as string),
      latitude: parseFloat(latitude as string),
      timezone,
      address,
    })
  } catch (error) {
    console.error('获取位置信息失败:', error)
    res.json({
      longitude: parseFloat(longitude as string),
      latitude: parseFloat(latitude as string),
      timezone: 'UTC+8',
      address: '',
    })
  }
})

// 海拔数据源：主备双源，自动降级
// 主源 Open-Meteo（Copernicus DEM，全球覆盖含海底），备源 OpenTopoData（SRTM90m）
// 两者均为 WGS-84 国际源，直接传入经纬度，无需 GCJ-02 坐标转换
const fetchAltitudeFromOpenMeteo = async (lat: number, lon: number): Promise<number | null> => {
  const resp = await axios.get('https://api.open-meteo.com/v1/elevation', {
    params: { latitude: lat, longitude: lon },
    timeout: 5000,
  })
  // Open-Meteo 的 elevation 恒为数组，单点也返回 [elev]
  const elev = resp.data?.elevation?.[0]
  return typeof elev === 'number' ? elev : null
}

const fetchAltitudeFromOpenTopoData = async (lat: number, lon: number): Promise<number | null> => {
  const resp = await axios.get('https://api.opentopodata.org/v1/srtm90m', {
    params: { locations: `${lat},${lon}` },
    timeout: 5000,
  })
  // 海洋/无 DEM 覆盖处 elevation 为 null
  const elev = resp.data?.results?.[0]?.elevation
  return typeof elev === 'number' ? elev : null
}

// 获取海拔（主备双源，自动降级）
router.get('/altitude', async (req, res) => {
  const { longitude, latitude } = req.query

  if (!longitude || !latitude) {
    return res.status(400).json({ error: '缺少经纬度参数' })
  }

  const lat = parseFloat(latitude as string)
  const lon = parseFloat(longitude as string)
  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    return res.status(400).json({ error: '经纬度参数无效' })
  }

  // 主源：Open-Meteo
  try {
    const altitude = await fetchAltitudeFromOpenMeteo(lat, lon)
    if (altitude !== null) {
      return res.json({ altitude, source: 'open-meteo' })
    }
  } catch (e) {
    console.warn('Open-Meteo 海拔查询失败，降级到 OpenTopoData:', (e as Error).message)
  }

  // 备源：OpenTopoData (SRTM90m)
  try {
    const altitude = await fetchAltitudeFromOpenTopoData(lat, lon)
    if (altitude !== null) {
      return res.json({ altitude, source: 'opentopodata' })
    }
  } catch (e) {
    console.warn('OpenTopoData 海拔查询失败:', (e as Error).message)
  }

  // 双源均无数据（如深海、无 DEM 覆盖区域）
  res.json({ altitude: 0, source: 'none' })
})

// 获取天气（和风天气 JWT 认证；未配置或失败时返回兜底数据）
router.get('/weather', async (req, res) => {
  const { longitude, latitude } = req.query

  if (!longitude || !latitude) {
    return res.status(400).json({ error: '缺少经纬度参数' })
  }

  const fallback = {
    temperature: 25,
    humidity: 60,
    windSpeed: 10,
    windDirection: '东南风',
    weather: '晴',
  }

  if (!isQWeatherConfigured()) {
    return res.json(fallback)
  }

  try {
    const token = getQWeatherToken()
    const response = await axios.get(`https://${QWEATHER_API_HOST}/v7/weather/now`, {
      params: { location: `${longitude},${latitude}`, lang: 'zh' },
      headers: { Authorization: `Bearer ${token}` },
      timeout: 8000,
    })

    if (response.data?.code === '200' && response.data.now) {
      const now = response.data.now
      return res.json({
        temperature: parseInt(now.temp),
        humidity: parseInt(now.humidity),
        windSpeed: parseInt(now.windSpeed),
        windDirection: now.windDir,
        weather: now.text,
      })
    }
    console.warn('和风天气返回非 200:', response.data)
    return res.json(fallback)
  } catch (error) {
    console.error('获取天气失败:', (error as Error).message)
    return res.json(fallback)
  }
})

export default router
