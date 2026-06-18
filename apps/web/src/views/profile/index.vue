<script setup lang="ts">
// 个人中心页面
</script>

<template>
  <div class="profile-page">
    <div class="profile-header">
      <div class="avatar">
        <span class="avatar-text">用</span>
      </div>
      <div class="user-info">
        <h2 class="username">用户昵称</h2>
        <p class="phone">138****8888</p>
      </div>
    </div>

    <div class="profile-menu">
      <div class="menu-item">
        <span class="menu-icon">📝</span>
        <span class="menu-text">修改昵称</span>
        <span class="menu-arrow">›</span>
      </div>
      <div class="menu-item">
        <span class="menu-icon">🔒</span>
        <span class="menu-text">修改密码</span>
        <span class="menu-arrow">›</span>
      </div>
      <div class="menu-item">
        <span class="menu-icon">📱</span>
        <span class="menu-text">绑定手机</span>
        <span class="menu-arrow">›</span>
      </div>
      <div class="menu-item">
        <span class="menu-icon">📊</span>
        <span class="menu-text">历史记录</span>
        <span class="menu-arrow">›</span>
      </div>
      <div class="menu-item">
        <span class="menu-icon">⚙️</span>
        <span class="menu-text">设置</span>
        <span class="menu-arrow">›</span>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.profile-page {
  min-height: 100vh;
  background: #f5f5f5;
}

.profile-header {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  padding: 40px 20px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: #4a90d9;
  display: flex;
  align-items: center;
  justify-content: center;

  &-text {
    color: #fff;
    font-size: 24px;
    font-weight: 600;
  }
}

.user-info {
  .username {
    color: #fff;
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 4px;
  }

  .phone {
    color: rgba(255, 255, 255, 0.6);
    font-size: 14px;
  }
}

.profile-menu {
  background: #fff;
  margin: 16px;
  border-radius: 12px;
  overflow: hidden;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #f0f0f0;

  &:last-child {
    border-bottom: none;
  }

  &:active {
    background: #f9f9f9;
  }

  .menu-icon {
    font-size: 20px;
    margin-right: 12px;
  }

  .menu-text {
    flex: 1;
    font-size: 15px;
    color: #333;
  }

  .menu-arrow {
    font-size: 18px;
    color: #ccc;
  }
}
</style>
