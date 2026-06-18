<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables'

const router = useRouter()
const { isLoggedIn, logout } = useAuth()

const isMobile = ref(window.innerWidth < 768)

window.addEventListener('resize', () => {
  isMobile.value = window.innerWidth < 768
})

const menuVisible = ref(false)

const handleLogout = () => {
  logout()
  router.push('/login')
}

const toggleMenu = () => {
  menuVisible.value = !menuVisible.value
}
</script>

<template>
  <header class="navbar">
    <div class="navbar-left">
      <router-link to="/" class="logo">
        <span class="logo-icon">🌍</span>
        <span class="logo-text">风水地球仪</span>
      </router-link>
    </div>

    <!-- Desktop Navigation -->
    <nav class="navbar-center hidden-mobile">
      <router-link to="/" class="nav-link">首页</router-link>
      <router-link v-if="isLoggedIn" to="/analysis" class="nav-link">风水分析</router-link>
      <router-link v-if="isLoggedIn" to="/history" class="nav-link">历史记录</router-link>
    </nav>

    <div class="navbar-right hidden-mobile">
      <template v-if="isLoggedIn">
        <router-link to="/profile" class="nav-link">个人中心</router-link>
        <button class="btn-logout" @click="handleLogout">退出</button>
      </template>
      <template v-else>
        <router-link to="/login" class="nav-link">登录</router-link>
        <router-link to="/register" class="btn-register">注册</router-link>
      </template>
    </div>

    <!-- Mobile Menu Button -->
    <button class="menu-btn hidden-desktop" @click="toggleMenu">
      <span class="menu-icon">{{ menuVisible ? '✕' : '☰' }}</span>
    </button>

    <!-- Mobile Menu -->
    <div v-if="menuVisible && isMobile" class="mobile-menu">
      <router-link to="/" class="mobile-nav-link" @click="menuVisible = false">首页</router-link>
      <router-link v-if="isLoggedIn" to="/analysis" class="mobile-nav-link" @click="menuVisible = false">
        风水分析
      </router-link>
      <router-link v-if="isLoggedIn" to="/history" class="mobile-nav-link" @click="menuVisible = false">
        历史记录
      </router-link>
      <template v-if="isLoggedIn">
        <router-link to="/profile" class="mobile-nav-link" @click="menuVisible = false">个人中心</router-link>
        <button class="mobile-nav-link logout" @click="handleLogout">退出登录</button>
      </template>
      <template v-else>
        <router-link to="/login" class="mobile-nav-link" @click="menuVisible = false">登录</router-link>
        <router-link to="/register" class="mobile-nav-link" @click="menuVisible = false">注册</router-link>
      </template>
    </div>
  </header>
</template>

<style lang="scss" scoped>
.navbar {
  height: 56px;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  position: relative;
  z-index: 100;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.navbar-left {
  .logo {
    display: flex;
    align-items: center;
    text-decoration: none;
    color: #fff;

    &-icon {
      font-size: 24px;
      margin-right: 8px;
    }

    &-text {
      font-size: 18px;
      font-weight: 600;
    }
  }
}

.navbar-center {
  display: flex;
  gap: 24px;

  .nav-link {
    color: rgba(255, 255, 255, 0.8);
    text-decoration: none;
    font-size: 14px;
    transition: color 0.2s;

    &:hover,
    &.router-link-active {
      color: #fff;
    }
  }
}

.navbar-right {
  display: flex;
  align-items: center;
  gap: 16px;

  .nav-link {
    color: rgba(255, 255, 255, 0.8);
    text-decoration: none;
    font-size: 14px;
    transition: color 0.2s;

    &:hover {
      color: #fff;
    }
  }

  .btn-logout {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.3);
    color: #fff;
    padding: 6px 16px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    transition: all 0.2s;

    &:hover {
      background: rgba(255, 255, 255, 0.1);
      border-color: rgba(255, 255, 255, 0.5);
    }
  }

  .btn-register {
    background: #4a90d9;
    color: #fff;
    text-decoration: none;
    padding: 6px 16px;
    border-radius: 4px;
    font-size: 14px;
    transition: background 0.2s;

    &:hover {
      background: #357abd;
    }
  }
}

.menu-btn {
  background: transparent;
  border: none;
  color: #fff;
  font-size: 24px;
  cursor: pointer;
  padding: 4px 8px;

  .menu-icon {
    display: block;
    width: 24px;
    height: 24px;
    line-height: 24px;
  }
}

.mobile-menu {
  position: absolute;
  top: 56px;
  left: 0;
  right: 0;
  background: #1a1a2e;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);

  .mobile-nav-link {
    color: rgba(255, 255, 255, 0.8);
    text-decoration: none;
    padding: 12px 16px;
    border-radius: 4px;
    transition: background 0.2s;

    &:hover {
      background: rgba(255, 255, 255, 0.1);
    }

    &.logout {
      background: transparent;
      border: none;
      text-align: left;
      cursor: pointer;
      color: #ff6b6b;
    }
  }
}
</style>
