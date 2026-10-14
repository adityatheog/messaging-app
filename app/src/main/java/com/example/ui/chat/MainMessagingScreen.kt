package com.example.ui.chat

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.VerticalDivider
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.example.data.model.User

@Composable
fun MainMessagingScreen(
    currentUser: User,
    chatViewModel: ChatViewModel,
    onLogoutClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    LaunchedEffect(currentUser.id) {
        chatViewModel.initialize(currentUser.id)
    }

    val users by chatViewModel.users.collectAsState()
    val searchQuery by chatViewModel.searchQuery.collectAsState()
    val selectedUser by chatViewModel.selectedUser.collectAsState()
    val messages by chatViewModel.messages.collectAsState()
    val isSending by chatViewModel.isSending.collectAsState()

    BoxWithConstraints(modifier = modifier.fillMaxSize()) {
        val isExpandedLayout = maxWidth >= 700.dp

        if (isExpandedLayout) {
            // Side-by-side tablet layout (matches MainLayout.jsx with Sidebar & ChatWindow)
            Row(modifier = Modifier.fillMaxSize()) {
                UserListPane(
                    currentUser = currentUser,
                    users = users,
                    searchQuery = searchQuery,
                    selectedUser = selectedUser,
                    onSearchChange = chatViewModel::onSearchQueryChanged,
                    onSelectUser = chatViewModel::selectUser,
                    onLogoutClick = onLogoutClick,
                    modifier = Modifier.width(320.dp)
                )

                VerticalDivider(
                    color = MaterialTheme.colorScheme.outline.copy(alpha = 0.4f),
                    modifier = Modifier.fillMaxHeight()
                )

                ChatPane(
                    currentUser = currentUser,
                    selectedUser = selectedUser,
                    messages = messages,
                    isSending = isSending,
                    onSendMessage = chatViewModel::sendMessage,
                    onBackClick = null,
                    modifier = Modifier.weight(1f)
                )
            }
        } else {
            // Compact handheld layout
            if (selectedUser != null) {
                BackHandler {
                    chatViewModel.selectUser(null)
                }

                ChatPane(
                    currentUser = currentUser,
                    selectedUser = selectedUser,
                    messages = messages,
                    isSending = isSending,
                    onSendMessage = chatViewModel::sendMessage,
                    onBackClick = { chatViewModel.selectUser(null) }
                )
            } else {
                UserListPane(
                    currentUser = currentUser,
                    users = users,
                    searchQuery = searchQuery,
                    selectedUser = null,
                    onSearchChange = chatViewModel::onSearchQueryChanged,
                    onSelectUser = chatViewModel::selectUser,
                    onLogoutClick = onLogoutClick
                )
            }
        }
    }
}
