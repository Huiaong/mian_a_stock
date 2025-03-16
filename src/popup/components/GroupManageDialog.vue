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
          :draggable="!isEditing(group.id)"
        >
          <!-- 编辑状态 -->
          <template v-if="isEditing(group.id)">
            <el-input
              v-model="editGroupName"
              placeholder="请输入分组名称"
              size="small"
              class="edit-input"
              ref="editInputRef"
              @keyup.enter="saveGroup(group.id)"
              @blur="cancelEdit"
              maxlength="6"
              show-word-limit
            >
              <template #suffix>
                <el-button
                  type="primary"
                  link
                  @click="saveGroup(group.id)"
                  :disabled="!editGroupName.trim()"
                >
                  <el-icon><Check /></el-icon>
                </el-button>
                <el-button type="info" link @click="cancelEdit">
                  <el-icon><Close /></el-icon>
                </el-button>
              </template>
            </el-input>
          </template>

          <!-- 非编辑状态 -->
          <template v-else>
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
          </template>
        </div>
      </div>

      <!-- 添加新分组 -->
      <div v-if="isAddingNew" class="group-list-item new-group-item">
        <el-input
          v-model="newGroupName"
          placeholder="请输入分组名称"
          size="small"
          class="edit-input"
          ref="newGroupInputRef"
          @keyup.enter="saveNewGroup"
          @blur="cancelNewGroup"
          maxlength="6"
          show-word-limit
        >
          <template #suffix>
            <el-button
              type="primary"
              link
              @click="saveNewGroup"
              :disabled="!newGroupName.trim()"
            >
              <el-icon><Check /></el-icon>
            </el-button>
            <el-button type="info" link @click="cancelNewGroup">
              <el-icon><Close /></el-icon>
            </el-button>
          </template>
        </el-input>
      </div>

      <!-- 添加分组按钮 -->
      <div v-if="!isAddingNew" class="add-group-btn" @click="startAddNewGroup">
        <el-icon><Plus /></el-icon>
        <span>新建分组</span>
      </div>
    </div>
  </el-dialog>
</template>

<script>
import { defineComponent, ref, watch, nextTick } from 'vue'
import {
  Operation,
  Edit,
  Delete,
  Plus,
  Check,
  Close
} from '@element-plus/icons-vue'
import { groupStore } from '@/store/stock'
import { ElMessageBox, ElMessage } from 'element-plus'

export default defineComponent({
  components: {
    Operation,
    Edit,
    Delete,
    Plus,
    Check,
    Close
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
    const editingGroupId = ref(null)
    const editGroupName = ref('')
    const isAddingNew = ref(false)
    const newGroupName = ref('')
    const groupListRef = ref(null)
    const editInputRef = ref(null)
    const newGroupInputRef = ref(null)
    let source = null
    const visible = ref(props.modelValue)

    // 监听 modelValue 变化
    watch(
      () => props.modelValue,
      (val) => {
        visible.value = val
        if (val) {
          // 重置编辑状态
          editingGroupId.value = null
          isAddingNew.value = false
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

    const isEditing = (groupId) => {
      return editingGroupId.value === groupId
    }

    const startEditGroup = (group) => {
      editingGroupId.value = group.id
      editGroupName.value = group.name

      // 在下一个 tick 聚焦输入框
      nextTick(() => {
        if (editInputRef.value) {
          editInputRef.value.focus()
        }
      })
    }

    const cancelEdit = () => {
      editingGroupId.value = null
      editGroupName.value = ''
    }

    const startAddNewGroup = () => {
      isAddingNew.value = true
      newGroupName.value = ''

      // 在下一个 tick 聚焦输入框
      nextTick(() => {
        if (newGroupInputRef.value) {
          newGroupInputRef.value.focus()
        }
      })
    }

    const cancelNewGroup = () => {
      isAddingNew.value = false
      newGroupName.value = ''
    }

    const saveGroup = async (groupId) => {
      if (!editGroupName.value.trim()) {
        return
      }

      const success = await groupStore.saveGroup(editGroupName.value, groupId)

      if (success) {
        editingGroupId.value = null
        editGroupName.value = ''
      }
    }

    const saveNewGroup = async () => {
      if (!newGroupName.value.trim()) {
        return
      }

      const success = await groupStore.saveGroup(newGroupName.value)

      if (success) {
        isAddingNew.value = false
        newGroupName.value = ''
      }
    }

    const deleteGroup = async (group) => {
      // 检查是否是最后一个分组
      if (props.groups.length <= 1) {
        ElMessage({
          message: '请保留最少一个分组',
          type: 'warning',
          duration: 2000
        })
        return
      }

      ElMessageBox.confirm(
        '确定要删除该分组吗？分组内的股票也会被删除。',
        '删除分组',
        {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning'
        }
      )
        .then(async () => {
          await groupStore.deleteGroup(group.id)
        })
        .catch(() => {
          // 用户取消删除，不做任何操作
        })
    }

    // 添加列表拖拽事件处理
    const handleListDragStart = (event) => {
      if (
        !event.target.classList.contains('group-list-item') ||
        editingGroupId.value
      ) {
        return
      }
      source = event.target
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
      const newGroupIds = items
        .filter((item) => item.classList.contains('group-list-item'))
        .map((item) => {
          return item.dataset.groupId
        })
        .filter(Boolean)

      // 重置 source
      source = null

      const groups = props.groups

      // 如果顺序没有变化，直接返回
      if (
        JSON.stringify(newGroupIds) === JSON.stringify(groups.map((g) => g.id))
      ) {
        return
      }

      emit('update:groups', newGroupIds)
    }

    return {
      editingGroupId,
      editGroupName,
      isAddingNew,
      newGroupName,
      isEditing,
      startEditGroup,
      cancelEdit,
      saveGroup,
      startAddNewGroup,
      cancelNewGroup,
      saveNewGroup,
      deleteGroup,
      closeDialog,
      handleListDragStart,
      handleListDragEnter,
      handleListDragEnd,
      groupListRef,
      editInputRef,
      newGroupInputRef,
      visible
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

      .edit-input {
        flex: 1;
      }
    }

    .new-group-item {
      cursor: default;
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
