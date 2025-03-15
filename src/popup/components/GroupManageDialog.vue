<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    title="分组管理"
    width="300px"
    :show-close="false"
    :close-on-click-modal="true"
    align-center
    :modal-class="'group-dialog-modal'"
  >
    <template #header>
      <!-- 移除 header -->
    </template>

    <div class="group-dialog-content">
      <div
        ref="groupListRef"
        class="group-list"
        @dragstart="handleListDragStart"
        @dragenter="handleListDragEnter"
        @dragend="handleListDragEnd"
      >
        <div
          v-for="group in groups"
          :key="group.id"
          class="group-list-item"
          :data-group-id="group.id"
          draggable="true"
        >
          <div class="group-drag-handle">
            <el-icon><Operation /></el-icon>
          </div>
          <span class="group-name">{{ group.name }}</span>
          <div class="group-actions">
            <el-icon class="edit-icon" @click="startEditGroup(group)"
              ><Edit
            /></el-icon>
            <el-icon class="delete-icon" @click="deleteGroup(group)">
              <Delete />
            </el-icon>
          </div>
        </div>
      </div>
      <div class="add-group-btn" @click="handleAddGroup">
        <el-icon><Plus /></el-icon>
        <span>新建分组</span>
      </div>
    </div>

    <!-- 编辑分组对话框 -->
    <el-dialog
      v-model="showEditDialog"
      :title="editingGroup ? '编辑分组' : '新建分组'"
      width="300px"
      append-to-body
    >
      <el-input
        v-model="editGroupName"
        placeholder="请输入分组名称"
        @keyup.enter="saveGroup"
      />
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="showEditDialog = false">取消</el-button>
          <el-button type="primary" @click="saveGroup">确定</el-button>
        </span>
      </template>
    </el-dialog>
  </el-dialog>
</template>

<script>
import { defineComponent, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Operation, Edit, Delete, Plus } from '@element-plus/icons-vue'
import { groupStore } from '@/store/stock'

export default defineComponent({
  components: {
    Operation,
    Edit,
    Delete,
    Plus
  },
  props: {
    modelValue: {
      type: Boolean,
      required: true
    },
    groups: {
      type: Array,
      required: true
    }
  },
  emits: ['update:modelValue', 'update:groups'],
  setup(props, { emit }) {
    const showEditDialog = ref(false)
    const editGroupName = ref('')
    const editingGroup = ref(null)
    const draggingGroupId = ref(null)
    const groupListRef = ref(null)
    let source = null
    const visible = ref(props.modelValue)
    const localGroups = ref([])

    // 监听 modelValue 变化
    watch(
      () => props.modelValue,
      (val) => {
        visible.value = val
        if (val) {
          // 打开对话框时，复制一份组数据用于编辑
          localGroups.value = JSON.parse(JSON.stringify(props.groups))
        }
      }
    )

    // 监听 visible 变化
    watch(visible, (val) => {
      emit('update:modelValue', val)
    })

    const closeDialog = () => {
      visible.value = false
    }

    const startEditGroup = (group) => {
      editingGroup.value = group
      editGroupName.value = group.name
      showEditDialog.value = true
    }

    const handleAddGroup = () => {
      editingGroup.value = null
      editGroupName.value = ''
      showEditDialog.value = true
    }

    const saveGroup = async () => {
      if (!editGroupName.value.trim()) return

      const success = await groupStore.saveGroup(
        editGroupName.value,
        editingGroup.value?.id
      )

      if (success) {
        showEditDialog.value = false
        editGroupName.value = ''
        editingGroup.value = null
      }
    }

    const deleteGroup = async (group) => {
      if (group.id === 'default') {
        ElMessage.warning('默认分组不能删除')
        return
      }

      if (confirm('确定要删除该分组吗？分组内的股票也会被删除。')) {
        await groupStore.deleteGroup(group.id)
      }
    }

    const handleGroupDrop = async (event, targetGroup) => {
      const draggedGroupId = event.dataTransfer?.getData('text/plain')
      if (!draggedGroupId || draggedGroupId === targetGroup.id) return

      const draggedIndex = localGroups.value.findIndex(
        (g) => g.id === draggedGroupId
      )
      const targetIndex = localGroups.value.findIndex(
        (g) => g.id === targetGroup.id
      )

      if (draggedIndex === -1 || targetIndex === -1) return

      // 保存新的顺序到存储
      await groupStore.saveGroupsOrder()
    }

    // 添加列表拖拽事件处理
    const handleListDragStart = (event) => {
      if (!event.target.classList.contains('group-list-item')) {
        return
      }
      event.target.classList.add('dragging')
      // 存储被拖拽元素的 id
      event.dataTransfer.setData('text/plain', event.target.dataset.groupId)
    }

    const handleListDragEnter = (event) => {
      if (!source) return

      const target = event.target?.closest('.group-list-item')
      if (!target || target === source) return

      const list = groupListRef.value
      const children = Array.from(list.children)
      const sourceIndex = children.indexOf(source)
      const targetIndex = children.indexOf(target)

      if (sourceIndex < targetIndex) {
        target.after(source)
      } else {
        target.before(source)
      }
    }

    const handleListDragEnd = async (event) => {
      if (!source) return

      event.target.classList.remove('dragging')

      // 获取当前分组列表的顺序
      const items = Array.from(groupListRef.value.children)
      const newGroups = items
        .filter((item) => item.classList.contains('group-list-item'))
        .map((item) => {
          const groupId = item.dataset.groupId
          return localGroups.value.find((g) => g.id === groupId)
        })
        .filter(Boolean)

      // 重置 source
      source = null

      // 如果顺序没有变化，直接返回
      if (
        JSON.stringify(newGroups.map((g) => g.id)) ===
        JSON.stringify(localGroups.value.map((g) => g.id))
      ) {
        return
      }

      console.log('New groups order:', newGroups)

      // 更新 groups
      emit('update:groups', newGroups)
    }

    return {
      showEditDialog,
      editGroupName,
      editingGroup,
      draggingGroupId,
      startEditGroup,
      handleAddGroup,
      saveGroup,
      deleteGroup,
      handleGroupDrop,
      closeDialog,
      handleListDragStart,
      handleListDragEnter,
      handleListDragEnd,
      groupListRef,
      visible,
      localGroups
    }
  }
})
</script>

<style lang="less" scoped>
.group-dialog-content {
  .group-list {
    margin-bottom: 12px;

    .group-list-item {
      display: flex;
      align-items: center;
      padding: 8px 12px;
      background: #f5f5f5;
      border-radius: 4px;
      margin-bottom: 8px;
      cursor: move;
      transition: all 0.2s;

      &.dragging {
        color: transparent;
        background: #ccc;
      }

      &:hover {
        background: #e8e8e8;
      }

      .group-drag-handle {
        margin-right: 8px;
        color: #909399;
        cursor: move;

        .el-icon {
          font-size: 16px;
        }
      }

      .group-name {
        flex: 1;
        margin-right: 8px;
      }

      .group-actions {
        display: flex;
        gap: 12px;

        .edit-icon,
        .delete-icon {
          color: #909399;
          cursor: pointer;
          font-size: 16px;

          &:hover {
            color: #409eff;
          }
        }

        .delete-icon:hover {
          color: #f56c6c;
        }
      }
    }
  }

  .add-group-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: #f5f5f5;
    border-radius: 4px;
    cursor: pointer;
    color: #606266;

    &:hover {
      background: #e8e8e8;
    }

    .el-icon {
      font-size: 16px;
    }
  }
}

:deep(.el-dialog) {
  border-radius: 8px;
  margin-top: 20vh !important;

  .el-dialog__header {
    display: none;
  }

  .el-dialog__body {
    padding: 16px;
  }
}

:deep(.group-dialog-modal) {
  background-color: rgba(0, 0, 0, 0.5);
}
</style>
