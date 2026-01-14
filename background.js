const STATE_KEY = 'tracking_state';
const ALARM_NAME = 'save_time_alarm';
const SYNC_ALARM_NAME = 'sync_data_alarm';
const SERVER_URL = 'https://yutangxiaowu.cn:6050';

let isUpdating = false;
let updateQueue = Promise.resolve();

// 获取当前域名
function getHostname(url) {
  try {
    if (!url || url.startsWith('chrome://') || url.startsWith('edge://') || url.startsWith('about:') || url.startsWith('file://')) {
      return null;
    }
    const u = new URL(url);
    return u.hostname;
  } catch (e) {
    return null;
  }
}

// 核心：更新时间逻辑 (串行执行)
function updateTime() {
  updateQueue = updateQueue.then(async () => {
    try {
      const now = Date.now();
      const sessionData = await chrome.storage.session.get([STATE_KEY]);
      const state = sessionData[STATE_KEY];

      if (state && state.url && state.startTime) {
        const duration = now - state.startTime;
        const hostname = getHostname(state.url);

        if (hostname && duration > 0 && duration < 86400000) { // 忽略超过24小时的异常数据
          const localData = await chrome.storage.local.get(['timeData']);
          const timeData = localData.timeData || {};
          
          timeData[hostname] = (timeData[hostname] || 0) + duration;
          
          await chrome.storage.local.set({ timeData });
        }
      }

      if (state) {
        await chrome.storage.session.set({
          [STATE_KEY]: {
            ...state,
            startTime: now
          }
        });
      }
    } catch (e) {
      console.error('Update time failed:', e);
    }
  });
  return updateQueue;
}

// --- 数据同步逻辑 ---
async function syncData() {
  try {
    const { token } = await chrome.storage.local.get(['token']);
    if (!token) return; // 未登录

    // 1. 获取本地数据和上次同步的快照
    const { timeData = {}, syncedTimeData = {} } = await chrome.storage.local.get(['timeData', 'syncedTimeData']);
    
    // 2. 计算增量 (Delta)
    const delta = {};
    let hasDelta = false;
    for (const [domain, duration] of Object.entries(timeData)) {
      const lastSynced = syncedTimeData[domain] || 0;
      if (duration > lastSynced) {
        delta[domain] = duration - lastSynced;
        hasDelta = true;
      }
    }

    // 3. 如果有增量，上传到服务器
    if (hasDelta) {
      const pushRes = await fetch(`${SERVER_URL}/api/syncTime`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ logs: delta })
      });
      
      if (pushRes.ok) {
        await chrome.storage.local.set({ syncedTimeData: { ...timeData } });
      }
    }

    const pullRes = await fetch(`${SERVER_URL}/api/getTime`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (pullRes.ok) {
      const resJson = await pullRes.json();
      if (resJson.code === 0 && resJson.data) {
        await chrome.storage.local.set({ serverTimeData: resJson.data });
      }
    }
    
  } catch (e) {
    console.error('Sync failed:', e);
  }
}

// 设置新的跟踪状态
async function setTrackingState(tabId, url) {
  await updateTime(); // 先结算之前的时间

  const newState = {
    tabId: tabId,
    url: url,
    startTime: Date.now()
  };
  
  await chrome.storage.session.set({ [STATE_KEY]: newState });
}


chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    await setTrackingState(activeInfo.tabId, tab.url);
  } catch (e) {
    // Tab 可能瞬间关闭
    await setTrackingState(null, null);
  }
});

// 2. URL 更新
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    // 只有当前激活的 tab 更新 URL 才处理 (避免后台加载的 tab 干扰)
    const sessionData = await chrome.storage.session.get([STATE_KEY]);
    const state = sessionData[STATE_KEY];
    
    if (state && state.tabId === tabId) {
       await setTrackingState(tabId, tab.url);
    }
  }
});

// 3. 窗口焦点变化
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    await setTrackingState(null, null);
  } else {
    // 获得焦点
    try {
      const [tab] = await chrome.tabs.query({ active: true, windowId: windowId });
      if (tab) {
        await setTrackingState(tab.id, tab.url);
      }
    } catch (e) {
      console.error(e);
    }
  }
});

// 4. 定时保存 & 同步
chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1 });
chrome.alarms.create(SYNC_ALARM_NAME, { periodInMinutes: 5 }); // 每5分钟自动同步

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAME) {
    await updateTime();
  } else if (alarm.name === SYNC_ALARM_NAME) {
    await syncData();
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'triggerSync') {
    syncData().then(() => {
      sendResponse({ success: true });
    }).catch(() => {
      sendResponse({ success: false });
    });
    return true; // 保持通道开启以进行异步响应
  }
});

// 初始化
chrome.runtime.onStartup.addListener(async () => {
  await chrome.storage.session.remove(STATE_KEY);
  syncData(); // 启动时同步一次
});

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.storage.session.remove(STATE_KEY);
  // 尝试立即开始
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    await setTrackingState(tab.id, tab.url, false);
  }
});
