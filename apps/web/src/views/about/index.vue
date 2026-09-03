<script setup lang="ts">
import NavBar from '@/components/common/NavBar.vue'
import appQr from '@/assets/app-qr.png'
</script>

<template>
  <div class="about-page">
    <NavBar />
    <div class="about-wrap">
      <div class="about-card">
        <h1 class="page-title">关于我们</h1>

        <!-- 公司信息 -->
        <section class="info-section">
          <h2 class="section-title">公司信息</h2>
          <ul class="info-list">
            <li><span class="info-label">公司</span><span class="info-value">广州市双鱼文化科技有限公司</span></li>
            <li><span class="info-label">联系邮箱</span><span class="info-value">yujun_gz@sina.com</span></li>
          </ul>
        </section>

        <div class="divider"></div>

        <!-- 加入我们 -->
        <section class="join-section">
          <h2 class="section-title">加入我们</h2>
          <div class="qr-box">
            <img :src="appQr" alt="应用访问二维码" class="qr-img" />
            <p class="qr-tip">使用手机扫描二维码，即可进入应用</p>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.about-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  color: #fff;
}

.about-wrap {
  max-width: 720px;
  margin: 0 auto;
  padding: 24px 16px 48px;
}

.about-card {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 24px 20px;
}

.page-title {
  margin: 0 0 20px;
  font-size: 26px;
  text-align: center;
}

.section-title {
  margin: 0 0 12px;
  font-size: 17px;
  color: rgba(255, 255, 255, 0.9);
}

.info-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;

  li {
    display: flex;
    gap: 12px;
    font-size: 14px;
    line-height: 1.6;
  }

  .info-label {
    flex-shrink: 0;
    color: rgba(255, 255, 255, 0.5);

    &::after {
      content: '：';
    }
  }

  .info-value {
    color: rgba(255, 255, 255, 0.85);
    word-break: break-all;
  }
}

.divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.1);
  margin: 20px 0;
}

.join-section {
  text-align: center;
}

.qr-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
}

.qr-img {
  width: 220px;
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  background: #fff;
  padding: 8px;
  box-sizing: border-box;
}

.qr-tip {
  margin: 0;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
}
</style>
