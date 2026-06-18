<script setup lang="ts">
</script>

<template>
  <div class="not-found">
    <div class="content">
      <h1 class="code">404</h1>
      <p class="message">页面不存在</p>
      <router-link to="/" class="home-link">返回首页</router-link>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.not-found {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
}

.content {
  text-align: center;
}

.code {
  font-size: 120px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.1);
  line-height: 1;
  margin-bottom: 16px;
}

.message {
  color: rgba(255, 255, 255, 0.6);
  font-size: 18px;
  margin-bottom: 32px;
}

.home-link {
  display: inline-block;
  padding: 12px 32px;
  background: #4a90d9;
  color: #fff;
  text-decoration: none;
  border-radius: 8px;
  font-size: 15px;
  transition: all 0.2s;

  &:hover {
    background: #357abd;
  }
}
</style>
