package com.example.ui.chat

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
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

data class UserConversationItem(
    val user: User,
    val lastMessage: Message? = null,
    val unreadCount: Int = 0
)

class ChatViewModel(private val repository: MessageRepository) : ViewModel() {

    private val _users = MutableStateFlow<List<UserConversationItem>>(emptyList())
    val users: StateFlow<List<UserConversationItem>> = _users.asStateFlow()

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    private val _selectedUser = MutableStateFlow<User?>(null)
    val selectedUser: StateFlow<User?> = _selectedUser.asStateFlow()

    private val _messages = MutableStateFlow<List<Message>>(emptyList())
    val messages: StateFlow<List<Message>> = _messages.asStateFlow()

    private val _isSending = MutableStateFlow(false)
    val isSending: StateFlow<Boolean> = _isSending.asStateFlow()

    private var currentUserId: String = ""
    private var messagesJob: Job? = null
    private var pollingJob: Job? = null

    fun initialize(userId: String) {
        if (currentUserId == userId) return
        currentUserId = userId
        loadUsers()
        observeUpdates()
        startPeriodicSync()
    }

    fun onSearchQueryChanged(query: String) {
        _searchQuery.value = query
        loadUsers()
    }

    fun selectUser(user: User?) {
        _selectedUser.value = user
        if (user != null) {
            loadMessages(user.id)
            markRead(user.id)
        } else {
            _messages.value = emptyList()
        }
    }

    fun refreshUsers() {
        loadUsers()
    }

    private fun loadUsers() {
        if (currentUserId.isBlank()) return
        viewModelScope.launch {
            val rawUsers = repository.getUsers(currentUserId)
            val query = _searchQuery.value.trim().lowercase()
            val filtered = if (query.isEmpty()) {
                rawUsers
            } else {
                rawUsers.filter {
                    it.username.lowercase().contains(query) ||
                            it.fullName.lowercase().contains(query)
                }
            }

            val items = filtered.map { user ->
                val lastMsg = repository.getLastMessage(currentUserId, user.id)
                val unread = repository.getUnreadCount(currentUserId, user.id)
                UserConversationItem(user, lastMsg, unread)
            }
            _users.value = items
        }
    }

    private fun loadMessages(otherUserId: String) {
        messagesJob?.cancel()
        messagesJob = viewModelScope.launch {
            val list = repository.getMessagesBetween(currentUserId, otherUserId)
            _messages.value = list
        }
    }

    private fun markRead(otherUserId: String) {
        viewModelScope.launch {
            repository.markMessagesAsRead(otherUserId, currentUserId)
            loadUsers()
        }
    }

    fun sendMessage(content: String) {
        val recipient = _selectedUser.value ?: return
        val text = content.trim()
        if (text.isEmpty()) return

        viewModelScope.launch {
            _isSending.value = true
            val result = repository.sendMessage(currentUserId, recipient.id, text)
            if (result.isSuccess) {
                loadMessages(recipient.id)
                loadUsers()
            }
            _isSending.value = false
        }
    }

    private fun observeUpdates() {
        viewModelScope.launch {
            repository.messagesUpdateTrigger.collectLatest { pair ->
                val selected = _selectedUser.value
                if (selected != null && (pair.first == selected.id || pair.second == selected.id)) {
                    loadMessages(selected.id)
                    markRead(selected.id)
                }
                loadUsers()
            }
        }
    }

    private fun startPeriodicSync() {
        pollingJob?.cancel()
        pollingJob = viewModelScope.launch {
            while (true) {
                delay(3000)
                loadUsers()
                val selected = _selectedUser.value
                if (selected != null) {
                    val currentList = repository.getMessagesBetween(currentUserId, selected.id)
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
    }
}
