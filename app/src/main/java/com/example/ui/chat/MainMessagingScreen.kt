package com.example.ui.chat

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Box
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
import com.example.ui.components.CallOverlay

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

    val currentTab by chatViewModel.currentTab.collectAsState()
    val users by chatViewModel.users.collectAsState()
    val rawContacts by chatViewModel.rawContacts.collectAsState()
    val groups by chatViewModel.groups.collectAsState()
    val invitation by chatViewModel.myInvitation.collectAsState()
    val searchQuery by chatViewModel.searchQuery.collectAsState()
    val selectedTarget by chatViewModel.selectedTarget.collectAsState()
    val messages by chatViewModel.messages.collectAsState()
    val isSending by chatViewModel.isSending.collectAsState()
    val replyingTo by chatViewModel.replyingTo.collectAsState()
    val editingMessage by chatViewModel.editingMessage.collectAsState()
    val activeCall by chatViewModel.activeCall.collectAsState()

    Box(modifier = modifier.fillMaxSize()) {
        BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
            val isExpandedLayout = maxWidth >= 700.dp

            if (isExpandedLayout) {
                // Side-by-side tablet / desktop layout
                Row(modifier = Modifier.fillMaxSize()) {
                    UserListPane(
                        currentUser = currentUser,
                        users = users,
                        rawContacts = rawContacts,
                        groups = groups,
                        invitation = invitation,
                        currentTab = currentTab,
                        searchQuery = searchQuery,
                        selectedTarget = selectedTarget,
                        onTabChange = chatViewModel::setTab,
                        onSearchChange = chatViewModel::onSearchQueryChanged,
                        onSelectUser = chatViewModel::selectUser,
                        onSelectGroup = chatViewModel::selectGroup,
                        onCreateGroup = chatViewModel::createGroup,
                        onGenerateNewInvitation = chatViewModel::generateNewInvitation,
                        onAcceptInvitationCode = chatViewModel::acceptInvitationCode,
                        onToggleVerifyContact = chatViewModel::toggleVerifyContact,
                        onToggleBlockContact = chatViewModel::toggleBlockContact,
                        onLogoutClick = onLogoutClick,
                        modifier = Modifier.width(340.dp)
                    )

                    VerticalDivider(
                        color = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f),
                        modifier = Modifier.fillMaxHeight()
                    )

                    ChatPane(
                        currentUser = currentUser,
                        target = selectedTarget,
                        messages = messages,
                        isSending = isSending,
                        replyingTo = replyingTo,
                        editingMessage = editingMessage,
                        onSendMessage = chatViewModel::sendMessage,
                        onSendVoiceMessage = chatViewModel::sendVoiceMessage,
                        onSendAttachment = chatViewModel::sendMediaAttachment,
                        onToggleReaction = chatViewModel::toggleReaction,
                        onSetReplyingTo = chatViewModel::setReplyingTo,
                        onSetEditingMessage = chatViewModel::setEditingMessage,
                        onDeleteMessage = chatViewModel::deleteMessage,
                        onStartVoiceCall = chatViewModel::startVoiceCall,
                        onToggleVerifyContact = chatViewModel::toggleVerifyContact,
                        onBackClick = null,
                        modifier = Modifier.weight(1f)
                    )
                }
            } else {
                // Compact handheld phone layout
                if (selectedTarget != null) {
                    BackHandler {
                        chatViewModel.selectTarget(null)
                    }

                    ChatPane(
                        currentUser = currentUser,
                        target = selectedTarget,
                        messages = messages,
                        isSending = isSending,
                        replyingTo = replyingTo,
                        editingMessage = editingMessage,
                        onSendMessage = chatViewModel::sendMessage,
                        onSendVoiceMessage = chatViewModel::sendVoiceMessage,
                        onSendAttachment = chatViewModel::sendMediaAttachment,
                        onToggleReaction = chatViewModel::toggleReaction,
                        onSetReplyingTo = chatViewModel::setReplyingTo,
                        onSetEditingMessage = chatViewModel::setEditingMessage,
                        onDeleteMessage = chatViewModel::deleteMessage,
                        onStartVoiceCall = chatViewModel::startVoiceCall,
                        onToggleVerifyContact = chatViewModel::toggleVerifyContact,
                        onBackClick = { chatViewModel.selectTarget(null) }
                    )
                } else {
                    UserListPane(
                        currentUser = currentUser,
                        users = users,
                        rawContacts = rawContacts,
                        groups = groups,
                        invitation = invitation,
                        currentTab = currentTab,
                        searchQuery = searchQuery,
                        selectedTarget = null,
                        onTabChange = chatViewModel::setTab,
                        onSearchChange = chatViewModel::onSearchQueryChanged,
                        onSelectUser = chatViewModel::selectUser,
                        onSelectGroup = chatViewModel::selectGroup,
                        onCreateGroup = chatViewModel::createGroup,
                        onGenerateNewInvitation = chatViewModel::generateNewInvitation,
                        onAcceptInvitationCode = chatViewModel::acceptInvitationCode,
                        onToggleVerifyContact = chatViewModel::toggleVerifyContact,
                        onToggleBlockContact = chatViewModel::toggleBlockContact,
                        onLogoutClick = onLogoutClick
                    )
                }
            }
        }

        // Active Voice Call Overlay (if call in progress)
        if (activeCall != null) {
            CallOverlay(
                activeCall = activeCall!!,
                onToggleMute = chatViewModel::toggleMuteCall,
                onToggleSpeaker = chatViewModel::toggleSpeakerCall,
                onEndCall = chatViewModel::endVoiceCall
            )
        }
    }
}
