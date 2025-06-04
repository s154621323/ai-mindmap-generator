<script setup>
import { ref, onMounted, nextTick } from 'vue';
import MindMap from 'simple-mind-map';
import { streamGenerateMindMap } from './services/aiService';

// 响应式数据
const promptInput = ref('');
const isGenerating = ref(false);
const statusMessage = ref('就绪');
const mindMapInstance = ref(null);

// 思维导图数据
let currentData = {
  data: {
    text: '根节点',
    uid: '1'
  },
  children: []
};

// 初始化思维导图
onMounted(() => {
  nextTick(() => {
    initMindMap();
  });
});

// 初始化思维导图方法
function initMindMap () {
  const container = document.getElementById('mindMapContainer');
  if (!container) return;

  mindMapInstance.value = new MindMap({
    el: container,
    data: currentData,
    layout: 'logicalStructure',
    theme: 'classic',
    enableFreeDrag: true,
    autoExpand: true
  });

  // 监听数据变化，确保新节点在可视区域
  let waitUid = '';
  mindMapInstance.value.on('data_change_detail', (list) => {
    // 找出新创建节点中的最后一个
    const lastCreate = list.filter((item) => {
      return item.action === 'create';
    })[0];

    if (lastCreate) {
      const uid = lastCreate.data.data.uid;
      const node = mindMapInstance.value.renderer.findNodeByUid(uid);
      if (node) {
        mindMapInstance.value.renderer.moveNodeToCenter(node);
      } else {
        waitUid = uid;
      }
    }
  });

  // 处理渲染完成后的情况
  mindMapInstance.value.on('node_tree_render_end', () => {
    if (waitUid) {
      const node = mindMapInstance.value.renderer.findNodeByUid(waitUid);
      waitUid = '';
      if (node) {
        mindMapInstance.value.renderer.moveNodeToCenter(node);
      }
    }
  });
}

// 开始生成思维导图
async function startGeneration () {
  if (!promptInput.value.trim() || isGenerating.value) return;

  isGenerating.value = true;
  statusMessage.value = '正在生成思维导图...';

  // 重置思维导图
  currentData = {
    data: {
      text: promptInput.value,
      uid: '1'
    },
    children: []
  };

  // 更新思维导图
  if (mindMapInstance.value) {
    mindMapInstance.value.setData(currentData);
  }

  // 在生成过程中禁止用户操作
  disableUserInteraction();

  try {
    // 使用AI服务流式生成思维导图
    await streamGenerateMindMap(promptInput.value, handleNewNode);
    statusMessage.value = '生成完成';
  } catch (error) {
    console.error('生成出错:', error);
    statusMessage.value = '生成过程中出现错误';
  } finally {
    isGenerating.value = false;
    // 恢复用户操作
    enableUserInteraction();
  }
}

// 处理新节点生成
function handleNewNode (nodeData) {
  return new Promise((resolve) => {
    console.log('收到新节点数据:', nodeData);

    // 使用服务端提供的ID或生成新ID
    const uid = nodeData.id;
    // 创建主题节点
    const newNode = {
      data: {
        text: nodeData.text,
        uid
      },
      children: []
    };

    // 将主题节点添加到正确的父节点
    if (nodeData.parentId) {
      // 如果有指定父节点（根节点）
      if (nodeData.parentId === currentData.data.uid) {
        // 添加到根节点
        currentData.children.push(newNode);
      } else {
        // 查找父节点（可能是其他主节点）
        const findAndAddToParent = (nodes, parentId) => {
          for (const node of nodes) {
            if (node.data.uid === parentId) {
              node.children.push(newNode);
              return true;
            }
            if (node.children && node.children.length > 0) {
              if (findAndAddToParent(node.children, parentId)) {
                return true;
              }
            }
          }
          return false;
        };

        // 在整个树中查找父节点
        const found = findAndAddToParent([currentData], nodeData.parentId);
        if (!found) {
          console.error('未找到父节点:', nodeData.parentId);
          // 添加到根节点作为后备方案
          currentData.children.push(newNode);
        }
      }
    } else {
      // 如果没有指定父节点，添加到根节点
      currentData.children.push(newNode);
    }

    // 更新思维导图
    mindMapInstance.value.updateData(currentData);
    console.log('添加主题节点:', uid, '父节点:', nodeData.parentId || '根节点');

    // 返回节点ID用于后续添加子节点
    resolve(uid);
  });
}

// 在AI生成过程中禁止用户操作
function disableUserInteraction () {
  if (mindMapInstance.value) {
    mindMapInstance.value.updateConfig({
      enableFreeDrag: false,
      enableNodeSelection: false,
      enableCreateNode: false
    });
  }
}

// 恢复用户操作
function enableUserInteraction () {
  if (mindMapInstance.value) {
    mindMapInstance.value.updateConfig({
      enableFreeDrag: true,
      enableNodeSelection: true,
      enableCreateNode: true
    });
  }
}
</script>

<template>
  <div class="container">
    <div class="control-panel">
      <h2>AI思维导图生成器</h2>
      <div class="input-group">
        <input type="text" v-model="promptInput" placeholder="输入一个主题，AI将为您生成思维导图" :disabled="isGenerating">
        <button @click="startGeneration" :disabled="isGenerating || !promptInput.trim()">
          {{ isGenerating ? '生成中...' : '生成' }}
        </button>
      </div>
      <div class="status">{{ statusMessage }}</div>
    </div>

    <div id="mindMapContainer"></div>

    <div class="loading-overlay" :class="{ hidden: !isGenerating }">
      <div class="spinner"></div>
      <div class="loading-text">AI正在思考...</div>
    </div>
  </div>
</template>

<style scoped>
.container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  width: 100%;
}

.control-panel {
  background-color: #fff;
  padding: 15px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  z-index: 10;
}

.control-panel h2 {
  margin-bottom: 15px;
  color: #333;
}

.input-group {
  display: flex;
  gap: 10px;
}

.input-group input {
  flex: 1;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.input-group button {
  padding: 10px 20px;
  background-color: #1890ff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.input-group button:hover {
  background-color: #40a9ff;
}

.input-group button:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.status {
  margin-top: 10px;
  font-size: 12px;
  color: #888;
}

#mindMapContainer {
  flex: 1;
  background-color: #f9f9f9;
  position: relative;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(255, 255, 255, 0.8);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 100;
}

.hidden {
  display: none;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(0, 0, 0, 0.1);
  border-radius: 50%;
  border-top-color: #1890ff;
  animation: spin 1s ease-in-out infinite;
}

.loading-text {
  margin-top: 15px;
  font-size: 14px;
  color: #333;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
