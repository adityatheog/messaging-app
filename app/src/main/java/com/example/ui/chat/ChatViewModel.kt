package com.example.ui.chat

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.data.model.ActiveCall
import com.example.data.model.CallStatus
import com.example.data.model.ConnectionInvitation
import com.example.data.model.Group
import com.example.data.model.Message
import com.example.data.model.User
import com.example.data.storage.MessageRepository
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

enum class SimpleXTab {
    CHATS,
    GROUPS,
    CONNECTIONS
}

sealed class ChatTarget {
    data class Direct(val user: User) : ChatTarget()
    data class GroupChat(val group: Group) : ChatTarget()

    val id: String
        get() = when (this) {
            is Direct -> user.id
            is GroupChat -> group.id
        }

    val title: String
        get() = when (this) {
            is Direct -> user.displayName
            is GroupChat -> group.name
        }
}

data class UserConversationItem(
    val user: User,
    val lastMessage: Message? = null,
    val unreadCount: Int = 0
)

class ChatViewModel(private val repository: MessageRepository) : ViewModel() {

    private val _currentTab = MutableStateFlow(SimpleXTab.CHATS)
    val currentTab: StateFlow<SimpleXTab> = _currentTab.asStateFlow()

    private val _users = MutableStateFlow<List<UserConversationItem>>(emptyList())
    val users: StateFlow<List<UserConversationItem>> = _users.asStateFlow()

    private val _rawContacts = MutableStateFlow<List<User>>(emptyList())
    val rawContacts: StateFlow<List<User>> = _rawContacts.asStateFlow()

    private val _groups = MutableStateFlow<List<Group>>(emptyList())
    val groups: StateFlow<List<Group>> = _groups.asStateFlow()

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    private val _selectedTarget = MutableStateFlow<ChatTarget?>(null)
    val selectedTarget: StateFlow<ChatTarget?> = _selectedTarget.asStateFlow()

    // Backward compatibility for selectedUser
    val selectedUser: StateFlow<User?>
        get() = MutableStateFlow((_selectedTarget.value as? ChatTarget.Direct)?.user)

    private val _messages = MutableStateFlow<List<Message>>(emptyList())
    val messages: StateFlow<List<Message>> = _messages.asStateFlow()

    private val _isSending = MutableStateFlow(false)
    val isSending: StateFlow<Boolean> = _isSending.asStateFlow()

    private val _replyingTo = MutableStateFlow<Message?>(null)
    val replyingTo: StateFlow<Message?> = _replyingTo.asStateFlow()

    private val _editingMessage = MutableStateFlow<Message?>(null)
    val editingMessage: StateFlow<Message?> = _editingMessage.asStateFlow()

    private val _myInvitation = MutableStateFlow<ConnectionInvitation?>(null)
    val myInvitation: StateFlow<ConnectionInvitation?> = _myInvitation.asStateFlow()

    private val _activeCall = MutableStateFlow<ActiveCall?>(null)
    val activeCall: StateFlow<ActiveCall?> = _activeCall.asStateFlow()

    private var currentUserId: String = ""
    private var currentUserObj: User? = null
    private var messagesJob: Job? = null
    private var pollingJob: Job? = null
    private var callTimerJob: Job? = null

    fun initialize(userId: String) {
        if (currentUserId == userId) return
        currentUserId = userId
        viewModelScope.launch {
            currentUserObj = repository.getUserById(userId)
            if (currentUserObj != null) {
                _myInvitation.value = repository.createInvitation(currentUserObj!!)
            }
        }
        loadUsersAndGroups()
        observeUpdates()
        startPeriodicSync()
    }

    fun setTab(tab: SimpleXTab) {
        _currentTab.value = tab
    }

    fun onSearchQueryChanged(query: String) {
        _searchQuery.value = query
        loadUsersAndGroups()
    }

    fun selectTarget(target: ChatTarget?) {
        _selectedTarget.value = target
        _replyingTo.value = null
        _editingMessage.value = null

        if (target != null) {
            when (target) {
                is ChatTarget.Direct -> {
                    loadMessages(target.user.id, isGroup = false)
                    markRead(target.user.id)
                }
                is ChatTarget.GroupChat -> {
                    loadMessages(target.group.id, isGroup = true)
                    markGroupRead(target.group.id)
                }
            }
        } else {
            _messages.value = emptyList()
        }
    }

    fun selectUser(user: User?) {
        selectTarget(if (user != null) ChatTarget.Direct(user) else null)
    }

    fun selectGroup(group: Group?) {
        selectTarget(if (group != null) ChatTarget.GroupChat(group) else null)
    }

    fun setReplyingTo(message: Message?) {
        _replyingTo.value = message
    }

    fun setEditingMessage(message: Message?) {
        _editingMessage.value = message
    }

    private fun loadUsersAndGroups() {
        if (currentUserId.isBlank()) return
        viewModelScope.launch {
            val rawUsers = repository.getUsers(currentUserId)
            _rawContacts.value = rawUsers

            val query = _searchQuery.value.trim().lowercase()
            val filteredUsers = if (query.isEmpty()) {
                rawUsers
            } else {
                rawUsers.filter {
                    it.username.lowercase().contains(query) ||
                            it.fullName.lowercase().contains(query)
                }
            }

            val userItems = filteredUsers.map { user ->
                val lastMsg = repository.getLastMessage(currentUserId, user.id)
                val unread = repository.getUnreadCount(currentUserId, user.id)
                UserConversationItem(user, lastMsg, unread)
            }
            _users.value = userItems

            val rawGroups = repository.getGroups(currentUserId)
            val filteredGroups = if (query.isEmpty()) {
                rawGroups
            } else {
                rawGroups.filter {
                    it.name.lowercase().contains(query) ||
                            it.description.lowercase().contains(query)
                }
            }
            _groups.value = filteredGroups
        }
    }

    private fun loadMessages(targetId: String, isGroup: Boolean) {
        messagesJob?.cancel()
        messagesJob = viewModelScope.launch {
            val list = if (isGroup) {
                repository.getGroupMessages(targetId)
            } else {
                repository.getMessagesBetween(currentUserId, targetId)
            }
            _messages.value = list
        }
    }

    private fun markRead(otherUserId: String) {
        viewModelScope.launch {
            repository.markMessagesAsRead(otherUserId, currentUserId)
            loadUsersAndGroups()
        }
    }

    private fun markGroupRead(groupId: String) {
        viewModelScope.launch {
            repository.markGroupMessagesAsRead(groupId)
            loadUsersAndGroups()
        }
    }

    fun sendMessage(content: String) {
        val target = _selectedTarget.value ?: return
        val editing = _editingMessage.value

        if (editing != null) {
            viewModelScope.launch {
                repository.editMessage(editing.id, content)
                _editingMessage.value = null
                reloadCurrentTargetMessages()
            }
            return
        }

        val text = content.trim()
        if (text.isEmpty()) return

        val replyMsg = _replyingTo.value

        viewModelScope.launch {
            _isSending.value = true
            when (target) {
                is ChatTarget.Direct -> {
                    repository.sendMessage(
                        senderId = currentUserId,
                        receiverId = target.user.id,
                        content = text,
                        isGroup = false,
                        replyToId = replyMsg?.id,
                        replyToText = replyMsg?.content?.take(60),
                        replyToSender = replyMsg?.senderId?.let { if (it == currentUserId) "You" else target.user.displayName }
                    )
                }
                is ChatTarget.GroupChat -> {
                    repository.sendMessage(
                        senderId = currentUserId,
                        receiverId = target.group.id,
                        content = text,
                        isGroup = true,
                        replyToId = replyMsg?.id,
                        replyToText = replyMsg?.content?.take(60),
                        replyToSender = replyMsg?.senderId?.let { if (it == currentUserId) "You" else "Member" }
                    )
                }
            }
            _replyingTo.value = null
            reloadCurrentTargetMessages()
            loadUsersAndGroups()
            _isSending.value = false
        }
    }

    fun sendVoiceMessage(durationSeconds: Int) {
        val target = _selectedTarget.value ?: return
        viewModelScope.launch {
            val isGroup = target is ChatTarget.GroupChat
            repository.sendMessage(
                senderId = currentUserId,
                receiverId = target.id,
                content = "🎤 Voice message (${durationSeconds}s)",
                isGroup = isGroup,
                messageType = "VOICE",
                audioDurationSeconds = durationSeconds
            )
            reloadCurrentTargetMessages()
            loadUsersAndGroups()
        }
    }

    fun sendMediaAttachment(type: String, name: String, size: Long, url: String) {
        val target = _selectedTarget.value ?: return
        viewModelScope.launch {
            val isGroup = target is ChatTarget.GroupChat
            repository.sendMessage(
                senderId = currentUserId,
                receiverId = target.id,
                content = if (type == "IMAGE") "📷 Photo: $name" else "📄 File: $name",
                isGroup = isGroup,
                messageType = type,
                mediaName = name,
                mediaSize = size,
                mediaUrl = url
            )
            reloadCurrentTargetMessages()
            loadUsersAndGroups()
        }
    }

    fun toggleReaction(messageId: String, emoji: String) {
        viewModelScope.launch {
            repository.toggleReaction(messageId, emoji, currentUserId)
            reloadCurrentTargetMessages()
        }
    }

    fun deleteMessage(message: Message) {
        viewModelScope.launch {
            repository.deleteMessage(message.id)
            reloadCurrentTargetMessages()
            loadUsersAndGroups()
        }
    }

    fun createGroup(name: String, description: String, members: List<String>) {
        viewModelScope.launch {
            val newGroup = repository.createGroup(name, description, currentUserId, members)
            loadUsersAndGroups()
            selectGroup(newGroup)
        }
    }

    fun generateNewInvitation() {
        viewModelScope.launch {
            val user = currentUserObj ?: repository.getUserById(currentUserId)
            if (user != null) {
                _myInvitation.value = repository.createInvitation(user)
            }
        }
    }

    fun acceptInvitationCode(code: String) {
        viewModelScope.launch {
            val result = repository.acceptInvitationByCode(code, currentUserId)
            if (result.isSuccess) {
                loadUsersAndGroups()
                selectUser(result.getOrNull())
                _currentTab.value = SimpleXTab.CHATS
            }
        }
    }

    fun toggleVerifyContact(userId: String) {
        viewModelScope.launch {
            repository.toggleVerifyContact(userId)
            loadUsersAndGroups()
        }
    }

    fun toggleBlockContact(userId: String) {
        viewModelScope.launch {
            repository.toggleBlockContact(userId)
            loadUsersAndGroups()
        }
    }

    // ==========================================
    // Voice Call Management
    // ==========================================

    fun startVoiceCall(peer: User) {
        callTimerJob?.cancel()
        _activeCall.value = ActiveCall(peer = peer, isIncoming = false, isConnected = false, durationSeconds = 0)

        callTimerJob = viewModelScope.launch {
            delay(2000) // Simulated connection handshake
            _activeCall.value = _activeCall.value?.copy(isConnected = true)
            while (true) {
                delay(1000)
                val curr = _activeCall.value ?: break
                _activeCall.value = curr.copy(durationSeconds = curr.durationSeconds + 1)
            }
        }
    }

    fun endVoiceCall() {
        callTimerJob?.cancel()
        callTimerJob = null
        _activeCall.value = null
    }

    fun toggleMuteCall() {
        val curr = _activeCall.value ?: return
        _activeCall.value = curr.copy(isMuted = !curr.isMuted)
    }

    fun toggleSpeakerCall() {
        val curr = _activeCall.value ?: return
        _activeCall.value = curr.copy(isSpeakerOn = !curr.isSpeakerOn)
    }

    private fun reloadCurrentTargetMessages() {
        val target = _selectedTarget.value ?: return
        when (target) {
            is ChatTarget.Direct -> loadMessages(target.user.id, isGroup = false)
            is ChatTarget.GroupChat -> loadMessages(target.group.id, isGroup = true)
        }
    }

    private fun observeUpdates() {
        viewModelScope.launch {
            repository.messagesUpdateTrigger.collectLatest { pair ->
                val target = _selectedTarget.value
                if (target != null && (pair.first == target.id || pair.second == target.id)) {
                    reloadCurrentTargetMessages()
                }
                loadUsersAndGroups()
            }
        }
    }

    private fun startPeriodicSync() {
        pollingJob?.cancel()
        pollingJob = viewModelScope.launch {
            while (true) {
                delay(3000)
                loadUsersAndGroups()
                val target = _selectedTarget.value
                if (target != null) {
                    val currentList = if (target is ChatTarget.GroupChat) {
                        repository.getGroupMessages(target.group.id)
                    } else {
                        repository.getMessagesBetween(currentUserId, target.id)
                    }
                    if (currentList.size != _messages.value.size ||
                        currentList.lastOrNull()?.id != _messages.value.lastOrNull()?.id
                    ) {
                        _messages.value = currentList
                    }
                }
            }
        }
    }

    override fun onCleared() {
        super.onCleared()
        messagesJob?.cancel()
        pollingJob?.cancel()
        callTimerJob?.cancel()
    }
}
