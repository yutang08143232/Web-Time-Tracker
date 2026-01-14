const SERVER_URL = 'https://yutangxiaowu.cn:6050';

document.addEventListener('DOMContentLoaded', async () => {
  await checkLoginStatus();
  renderStats();

  let resetConfirmTimeout = null;
  const resetBtn = document.getElementById('reset-btn');
  document.getElementById('login-trigger-btn')?.addEventListener('click', () => {
    document.getElementById('auth-modal')?.classList.add('active');
  });

  document.getElementById('close-auth-btn')?.addEventListener('click', () => {
    document.getElementById('auth-modal')?.classList.remove('active');
  });

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.getAttribute('data-tab');
      if (tab === 'login') {
        document.getElementById('login-form').style.display = 'block';
        document.getElementById('register-form').style.display = 'none';
        document.getElementById('reset-form').style.display = 'none';
      } else if (tab === 'register') {
        document.getElementById('login-form').style.display = 'none';
        document.getElementById('register-form').style.display = 'block';
        document.getElementById('reset-form').style.display = 'none';
      } else {
        document.getElementById('login-form').style.display = 'none';
        document.getElementById('register-form').style.display = 'none';
        document.getElementById('reset-form').style.display = 'block';
      }
    });
  });

  document.getElementById('do-login-btn')?.addEventListener('click', async () => {
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    
    if(!username || !password) return alert('请填写完整');
    
    try {
      const res = await fetch(`${SERVER_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (data.code === 0) {
        await chrome.storage.local.set({ 
          token: data.data.token,
          username: username 
        });
        document.getElementById('auth-modal')?.classList.remove('active');
        checkLoginStatus();
        chrome.runtime.sendMessage({ action: 'triggerSync' });
      } else {
        alert(data.msg);
      }
    } catch (e) {
      alert('登录失败: ' + e.message);
    }
  });

  document.getElementById('send-code-btn')?.addEventListener('click', async () => {
    const email = document.getElementById('reg-email').value;
    if(!email) return alert('请输入邮箱');
    
    try {
      const res = await fetch(`${SERVER_URL}/api/sendCode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      alert(data.msg);
    } catch (e) {
      alert('发送失败');
    }
  });

  document.getElementById('do-register-btn')?.addEventListener('click', async () => {
    const username = document.getElementById('reg-username').value;
    const email = document.getElementById('reg-email').value;
    const code = document.getElementById('reg-code').value;
    const password = document.getElementById('reg-password').value;
    
    if(!username || !email || !code || !password) return alert('请填写完整');
    
    try {
      const res = await fetch(`${SERVER_URL}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, code, password })
      });
      const data = await res.json();
      if (data.code === 0) {
        alert('注册成功，请登录');
        document.querySelector('.tab-btn[data-tab="login"]')?.click();
      } else {
        alert(data.msg);
      }
    } catch (e) {
      alert('注册失败');
    }
  });

  document.getElementById('send-reset-code-btn')?.addEventListener('click', async () => {
      const email = document.getElementById('reset-email').value;
      if(!email) return alert('请输入邮箱');
      
      try {
        const res = await fetch(`${SERVER_URL}/api/sendCode`, { // Using sendCode for now
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const data = await res.json();
        alert(data.msg);
      } catch (e) {
        alert('发送失败');
      }
  });

  // Reset Password Submit
  document.getElementById('do-reset-btn')?.addEventListener('click', async () => {
      const email = document.getElementById('reset-email').value;
      const code = document.getElementById('reset-code').value;
      const password = document.getElementById('reset-password').value;
      const confirmPassword = document.getElementById('reset-confirm-password').value;

      if(!email || !code || !password || !confirmPassword) return alert('请填写完整');
      if(password !== confirmPassword) return alert('两次密码不一致');

      try {

        const res = await fetch(`${SERVER_URL}/api/resetPassword`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, code, password })
        });

        if (res.ok) {
            const data = await res.json();
            if (data.code === 0) {
                alert('重置成功，请登录');
                document.querySelector('.tab-btn[data-tab="login"]')?.click();
            } else {
                alert(data.msg || '重置失败');
            }
        } else {
             alert('重置功能需后端支持 (api/resetPassword)');
        }
      } catch (e) {
        alert('请求失败');
      }
  });

  document.getElementById('sync-btn')?.addEventListener('click', () => {
    const btn = document.getElementById('sync-btn');
    btn.textContent = '同步中...';
    btn.disabled = true;
    chrome.runtime.sendMessage({ action: 'triggerSync' }, (response) => {
      btn.textContent = '同步';
      btn.disabled = false;
      if (response && response.success) {
        renderStats(); 
      } else {
        alert('同步失败');
      }
    });
  });

  resetBtn?.addEventListener('click', async () => {
    if (resetBtn.classList.contains('confirming')) {
      clearTimeout(resetConfirmTimeout);
      resetBtn.classList.remove('confirming');
      resetBtn.textContent = '清空数据';
      resetBtn.style.backgroundColor = '#fff';
      resetBtn.style.color = '#d93025';
      
      if (confirm('此操作不可撤销，确定要清空所有统计数据吗？')) {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          await chrome.storage.local.set({ timeData: {} });
        } else {
          alert('无法在普通网页模式下清空数据');
          return;
        }
        renderStats();
      }
    } else {
      resetBtn.classList.add('confirming');
      resetBtn.textContent = '再次点击确认';
      resetBtn.style.backgroundColor = '#d93025';
      resetBtn.style.color = '#fff';
      
      resetConfirmTimeout = setTimeout(() => {
        resetBtn.classList.remove('confirming');
        resetBtn.textContent = '清空数据';
        resetBtn.style.backgroundColor = '#fff';
        resetBtn.style.color = '#d93025';
      }, 3000);
    }
  });

  // 设置逻辑
  const settingsModal = document.getElementById('settings-modal');
  const localFilesCheckbox = document.getElementById('setting-local-files');
  const ipCheckbox = document.getElementById('setting-ip-address');

  async function loadSettings() {
      if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;
      const result = await chrome.storage.local.get(['settings']);
      const settings = result.settings || {};
      if (localFilesCheckbox) {
        localFilesCheckbox.checked = !!settings.trackLocalFiles;
      }
      if (ipCheckbox) {
        ipCheckbox.checked = settings.trackIP !== false; 
      }
  }

  async function saveSettings() {
      if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;
      const settings = {
          trackLocalFiles: localFilesCheckbox ? localFilesCheckbox.checked : false,
          trackIP: ipCheckbox ? ipCheckbox.checked : true
      };
      await chrome.storage.local.set({ settings });
  }

  document.getElementById('settings-btn')?.addEventListener('click', async () => {
      await loadSettings();
      settingsModal.classList.add('active');
  });

  document.getElementById('close-settings-btn')?.addEventListener('click', () => {
      settingsModal.classList.remove('active');
  });

  localFilesCheckbox?.addEventListener('change', saveSettings);
  ipCheckbox?.addEventListener('change', saveSettings);

  document.getElementById('intro-btn')?.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://yutangxiaowu.cn/step/browser-extension/Web_Time_Tracker/intro.html' });
  });

  document.getElementById('refresh-btn')?.addEventListener('click', () => {
    renderStats();
  });
  
  document.getElementById('stats-container')?.addEventListener('click', (e) => {
    const header = e.target.closest('.item-header');
    if (header) {
      const item = header.closest('.item');
      if (item && item.querySelector('.subdomain-list')) {
        item.classList.toggle('expanded');
      }
    }
  });
});

function getApexDomain(hostname) {
  if (!hostname) return 'unknown';
  const parts = hostname.split('.');
  if (parts.length <= 2) return hostname;
  
  const last = parts[parts.length - 1];
  const secondLast = parts[parts.length - 2];
  const compoundTLDs = ['com', 'co', 'org', 'net', 'edu', 'gov', 'mil', 'ac'];
  
  if (last.length === 2 && compoundTLDs.includes(secondLast)) {
    return parts.slice(-3).join('.');
  }
  
  return parts.slice(-2).join('.');
}

async function checkLoginStatus() {
  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;
  
  const { username, token } = await chrome.storage.local.get(['username', 'token']);
  const userEl = document.getElementById('current-user');
  const loginBtn = document.getElementById('login-trigger-btn');
  const syncBtn = document.getElementById('sync-btn');
  
  if (token && username) {
    userEl.innerHTML = `<span>👤 ${username}</span>`;
    loginBtn.textContent = '退出';
    loginBtn.classList.remove('auth-btn'); 
    loginBtn.replaceWith(loginBtn.cloneNode(true));
    document.getElementById('login-trigger-btn').addEventListener('click', async () => {
      if (confirm('确定要退出登录吗？\n注意：退出将同时清空本地的所有统计数据，以防止数据泄露给下一个账号。')) {
        await chrome.storage.local.remove(['token', 'username', 'serverTimeData', 'syncedTimeData', 'timeData']);
        location.reload();
      }
    });
    syncBtn.style.display = 'inline-block';
  }
}

async function renderStats() {
  const container = document.getElementById('stats-container');
  const totalTimeEl = document.getElementById('total-time');
  
  try {
    let timeData = {};
    let serverTimeData = {};
    let syncedTimeData = {};
    
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const data = await chrome.storage.local.get(['timeData', 'serverTimeData', 'syncedTimeData']);
      timeData = data.timeData || {};
      serverTimeData = data.serverTimeData || {};
      syncedTimeData = data.syncedTimeData || {};
    } else {
      console.warn('Extension API not available. Running in preview mode with mock data.');
      if (!document.querySelector('.mock-warning')) {
        const warning = document.createElement('div');
        warning.className = 'empty-state mock-warning';
        warning.style.color = '#d93025';
        warning.innerHTML = '请在 Chrome/Edge 扩展程序中运行此页面<br><small>当前为预览模式 (使用模拟数据)</small>';
      }
      
      timeData = {
        'www.bilibili.com': 300000,
        'search.bilibili.com': 150000,
        'space.bilibili.com': 50000,
        'www.google.com': 650000,
        'mail.google.com': 200000,
        'github.com': 320000,
        'stackoverflow.com': 120000
      };
    }
    
    const mergedData = { ...serverTimeData };
    
    for (const [domain, duration] of Object.entries(timeData)) {
      const lastSynced = syncedTimeData[domain] || 0;
      const delta = Math.max(0, duration - lastSynced);
      
      if (mergedData[domain]) {
        mergedData[domain] += delta;
      } else {
        mergedData[domain] = delta;
      }
    }
    
    const grouped = {};
    Object.entries(mergedData).forEach(([hostname, duration]) => {
      if (duration <= 0) return; // Filter out zero or negative
      const apex = getApexDomain(hostname);
      if (!grouped[apex]) {
        grouped[apex] = {
          apexDomain: apex,
          totalDuration: 0,
          subdomains: []
        };
      }
      grouped[apex].totalDuration += duration;
      grouped[apex].subdomains.push({ hostname, duration });
    });

    const items = Object.values(grouped).sort((a, b) => b.totalDuration - a.totalDuration);

    if (items.length === 0) {
      container.innerHTML = '<div class="empty-state">暂无数据，请先浏览一些网页。</div>';
      totalTimeEl.textContent = '';
      return;
    }

    const totalDuration = items.reduce((sum, item) => sum + item.totalDuration, 0);
    totalTimeEl.textContent = `总计: ${formatTime(totalDuration)}`;

    const maxDuration = items[0].totalDuration;

    let html = '';
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
       html += '<div class="empty-state" style="color:#d93025; padding: 10px 0;">请在 Chrome 扩展程序中运行此页面<br><small>当前为预览模式 (使用模拟数据)</small></div>';
    }

    items.forEach(item => {
      const percentage = (item.totalDuration / maxDuration) * 100;
      
      item.subdomains.sort((a, b) => b.duration - a.duration);
      
      let faviconUrl = '';
      const bestSubdomain = item.subdomains.length > 0 ? item.subdomains[0].hostname : item.apexDomain;
      
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
         const pageUrl = `https://${bestSubdomain}`;
         faviconUrl = chrome.runtime.getURL(`_favicon/?pageUrl=${encodeURIComponent(pageUrl)}&size=32`);
      } else {
         faviconUrl = `https://www.google.com/s2/favicons?domain=${bestSubdomain}&sz=32`;
      }
      
      let subdomainsHtml = '';
      const hasSubdomains = item.subdomains.length > 1 || (item.subdomains.length === 1 && item.subdomains[0].hostname !== item.apexDomain);
      
      if (hasSubdomains) {
        subdomainsHtml = `<div class="subdomain-list">`;
        item.subdomains.forEach(sub => {
           subdomainsHtml += `
             <div class="subdomain-item">
               <div class="subdomain-name" title="${sub.hostname}">${sub.hostname}</div>
               <div class="time">${formatTime(sub.duration)}</div>
             </div>
           `;
        });
        subdomainsHtml += `</div>`;
      }

      const toggleIcon = hasSubdomains ? 
        '<span class="toggle-icon">▶</span>' : 
        '<span class="toggle-icon" style="opacity:0"></span>';

      html += `
        <div class="item">
          <div class="item-header">
            <div class="domain-container">
              <div class="domain" title="${item.apexDomain}">
                ${toggleIcon}
                <img src="${faviconUrl}" style="width:16px;height:16px;vertical-align:middle;margin-right:5px;" onerror="this.src='https://www.google.com/s2/favicons?domain=${item.apexDomain}&sz=32'">
                ${item.apexDomain}
              </div>
            </div>
            <div class="time">${formatTime(item.totalDuration)}</div>
            <button class="delete-btn" title="删除数据" data-domain="${item.apexDomain}">🗑️</button>
          </div>
          <div class="bar-bg">
            <div class="bar-fill" style="width: ${percentage}%"></div>
          </div>
          ${subdomainsHtml}
        </div>
      `;
    });

    container.innerHTML = html;

    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation(); // Prevent toggling details
        const apexDomain = btn.dataset.domain;
        
        if (!confirm(`确定要删除 ${apexDomain} 及其所有子域名的统计数据吗？此操作将同步删除云端数据。`)) {
          return;
        }

        const hostnamesToDelete = [];
        const { timeData = {}, syncedTimeData = {}, serverTimeData = {} } = await chrome.storage.local.get(['timeData', 'syncedTimeData', 'serverTimeData']);
        
        const allHostnames = new Set([
            ...Object.keys(timeData),
            ...Object.keys(syncedTimeData),
            ...Object.keys(serverTimeData)
        ]);

        allHostnames.forEach(hostname => {
            if (getApexDomain(hostname) === apexDomain) {
                hostnamesToDelete.push(hostname);
            }
        });

        if (hostnamesToDelete.length === 0) return;

        try {
            const { token } = await chrome.storage.local.get(['token']);
            if (token) {
                const res = await fetch(`${SERVER_URL}/api/deleteData`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ domains: hostnamesToDelete })
                });
                
                if (!res.ok) {
                    const err = await res.json();
                    alert('云端删除失败: ' + (err.msg || '未知错误'));
                }
            }

            // 2. Clean Local Storage
            hostnamesToDelete.forEach(hostname => {
                delete timeData[hostname];
                delete syncedTimeData[hostname];
                delete serverTimeData[hostname];
            });

            await chrome.storage.local.set({ timeData, syncedTimeData, serverTimeData });
            
            renderStats();

        } catch (error) {
            console.error(error);
            alert('删除操作出错');
        }
      });
    });

  } catch (e) {
    console.error(e);
    container.innerHTML = '<div class="empty-state">加载失败</div>';
  }
}

function formatTime(ms) {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor((ms / (1000 * 60 * 60)));

  if (hours > 0) {
    return `${hours}小时 ${minutes}分`;
  } else if (minutes > 0) {
    return `${minutes}分 ${seconds}秒`;
  } else {
    return `${seconds}秒`;
  }
}
