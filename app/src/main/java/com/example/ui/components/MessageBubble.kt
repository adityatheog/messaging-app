package com.example.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.DoneAll
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Reply
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.model.Message
import com.example.ui.theme.Emerald400
import com.example.ui.theme.Emerald600
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun MessageBubble(
    message: Message,
    isSent: Boolean,
    currentUserId: String = "",
    senderName: String? = null,
    onReplyClick: ((Message) -> Unit)? = null,
    onReactionToggle: ((String, String) -> Unit)? = null,
    onEditClick: ((Message) -> Unit)? = null,
    onDeleteClick: ((Message) -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    val clipboardManager = LocalClipboardManager.current
    var showContextMenu by remember { mutableStateOf(false) }
    var isPlayingAudio by remember { mutableStateOf(false) }
    var audioProgress by remember { mutableStateOf(0f) }
    val coroutineScope = rememberCoroutineScope()

    val bubbleShape = if (isSent) {
        RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp, bottomStart = 16.dp, bottomEnd = 4.dp)
    } else {
        RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp, bottomStart = 4.dp, bottomEnd = 16.dp)
    }

    val bubbleBg = if (isSent) {
        Emerald600
    } else {
        MaterialTheme.colorScheme.surfaceVariant
    }

    val textColor = if (isSent) Color.White else MaterialTheme.colorScheme.onSurface
    val timeColor = if (isSent) Color.White.copy(alpha = 0.8f) else MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)
    val quoteBg = if (isSent) Color.Black.copy(alpha = 0.18f) else MaterialTheme.colorScheme.surface.copy(alpha = 0.7f)

    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 3.dp),
        horizontalArrangement = if (isSent) Arrangement.End else Arrangement.Start
    ) {
        Box(
            modifier = Modifier
                .widthIn(min = 90.dp, max = 310.dp)
                .clip(bubbleShape)
                .background(bubbleBg)
                .pointerInput(message.id) {
                    detectTapGestures(
                        onLongPress = {
                            showContextMenu = true
                        }
                    )
                }
                .padding(horizontal = 12.dp, vertical = 8.dp)
                .testTag(if (isSent) "message_bubble_sent" else "message_bubble_received")
        ) {
            Column(
                horizontalAlignment = if (isSent) Alignment.End else Alignment.Start
            ) {
                if (!isSent && senderName != null) {
                    Text(
                        text = senderName,
                        color = Emerald400,
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(bottom = 3.dp)
                    )
                }

                if (!message.replyToText.isNullOrBlank()) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(bottom = 6.dp)
                            .clip(RoundedCornerShape(6.dp))
                            .background(quoteBg)
                            .padding(horizontal = 8.dp, vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(3.dp, 28.dp)
                                .background(if (isSent) Color.White else Emerald600)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            if (!message.replyToSender.isNullOrBlank()) {
                                Text(
                                    text = message.replyToSender,
                                    color = if (isSent) Color.White else Emerald600,
                                    style = MaterialTheme.typography.labelSmall,
                                    fontWeight = FontWeight.Bold,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                            }
                            Text(
                                text = message.replyToText,
                                color = if (isSent) Color.White.copy(alpha = 0.9f) else MaterialTheme.colorScheme.onSurfaceVariant,
                                style = MaterialTheme.typography.bodySmall,
                                fontSize = 12.sp,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                    }
                }

                if (message.messageType == "VOICE") {
                    val durationSecs = if (message.audioDurationSeconds > 0) message.audioDurationSeconds else 8
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        IconButton(
                            onClick = {
                                if (isPlayingAudio) {
                                    isPlayingAudio = false
                                } else {
                                    isPlayingAudio = true
                                    coroutineScope.launch {
                                        for (i in 1..100) {
                                            if (!isPlayingAudio) break
                                            audioProgress = i / 100f
                                            delay((durationSecs * 10L))
                                        }
                                        isPlayingAudio = false
                                        audioProgress = 0f
                                    }
                                }
                            },
                            modifier = Modifier
                                .size(36.dp)
                                .clip(CircleShape)
                                .background(if (isSent) Color.White.copy(alpha = 0.25f) else Emerald600.copy(alpha = 0.15f))
                        ) {
                            Icon(
                                imageVector = if (isPlayingAudio) Icons.Default.Pause else Icons.Default.PlayArrow,
                                contentDescription = if (isPlayingAudio) "Pause" else "Play",
                                tint = if (isSent) Color.White else Emerald600,
                                modifier = Modifier.size(20.dp)
                            )
                        }

                        Spacer(modifier = Modifier.width(8.dp))

                        Row(
                            modifier = Modifier.weight(1f),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(2.dp)
                        ) {
                            val barHeights = listOf(10, 16, 24, 14, 20, 26, 18, 12, 22, 28, 18, 14, 24, 16, 12, 8)
                            barHeights.forEachIndexed { idx, height ->
                                val active = (idx.toFloat() / barHeights.size) <= audioProgress
                                val barColor = if (isSent) {
                                    if (active) Color.White else Color.White.copy(alpha = 0.4f)
                                } else {
                                    if (active) Emerald600 else MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.35f)
                                }
                                Box(
                                    modifier = Modifier
                                        .weight(1f)
                                        .height(height.dp)
                                        .clip(RoundedCornerShape(1.dp))
                                        .background(barColor)
                                )
                            }
                        }

                        Spacer(modifier = Modifier.width(8.dp))

                        Text(
                            text = String.format("0:%02d", durationSecs),
                            color = timeColor,
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.Medium
                        )
                    }
                }

                if (message.messageType == "IMAGE") {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(130.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(if (isSent) Color.Black.copy(alpha = 0.2f) else MaterialTheme.colorScheme.surface)
                            .padding(8.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(
                                imageVector = Icons.Default.Image,
                                contentDescription = "Image attachment",
                                tint = if (isSent) Color.White else Emerald600,
                                modifier = Modifier.size(40.dp)
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = message.mediaName ?: "Encrypted_Image.png",
                                color = textColor,
                                style = MaterialTheme.typography.bodySmall,
                                fontWeight = FontWeight.Medium
                            )
                            Text(
                                text = "E2EE Encrypted Payload",
                                color = timeColor,
                                style = MaterialTheme.typography.labelSmall
                            )
                        }
                    }
                    Spacer(modifier = Modifier.height(4.dp))
                }

                if (message.messageType == "DOCUMENT") {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp))
                            .background(if (isSent) Color.Black.copy(alpha = 0.2f) else MaterialTheme.colorScheme.surface)
                            .padding(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .clip(RoundedCornerShape(6.dp))
                                .background(if (isSent) Color.White.copy(alpha = 0.2f) else Emerald600.copy(alpha = 0.15f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Description,
                                contentDescription = "Document",
                                tint = if (isSent) Color.White else Emerald600,
                                modifier = Modifier.size(20.dp)
                            )
                        }
                        Spacer(modifier = Modifier.width(8.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = message.mediaName ?: "Document.pdf",
                                color = textColor,
                                style = MaterialTheme.typography.bodySmall,
                                fontWeight = FontWeight.Bold,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                            Text(
                                text = "1.2 MB · Verified Payload",
                                color = timeColor,
                                style = MaterialTheme.typography.labelSmall
                            )
                        }
                    }
                    Spacer(modifier = Modifier.height(4.dp))
                }

                if (message.content.isNotBlank() && (message.messageType == "TEXT" || message.messageType == "IMAGE")) {
                    Text(
                        text = message.content,
                        color = textColor,
                        style = MaterialTheme.typography.bodyLarge,
                        lineHeight = 20.sp
                    )
                }

                Row(
                    modifier = Modifier.padding(top = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    if (message.isEdited) {
                        Text(
                            text = "edited",
                            color = timeColor,
                            style = MaterialTheme.typography.labelSmall,
                            fontStyle = FontStyle.Italic
                        )
                    }

                    Text(
                        text = message.formattedTime,
                        color = timeColor,
                        style = MaterialTheme.typography.labelSmall
                    )

                    if (isSent) {
                        when {
                            message.isRead -> {
                                Icon(
                                    imageVector = Icons.Default.DoneAll,
                                    contentDescription = "Read",
                                    tint = Color(0xFFA7F3D0),
                                    modifier = Modifier.size(15.dp)
                                )
                            }
                            message.isDelivered -> {
                                Icon(
                                    imageVector = Icons.Default.DoneAll,
                                    contentDescription = "Delivered",
                                    tint = Color.White.copy(alpha = 0.7f),
                                    modifier = Modifier.size(15.dp)
                                )
                            }
                            else -> {
                                Icon(
                                    imageVector = Icons.Default.Check,
                                    contentDescription = "Sent",
                                    tint = Color.White.copy(alpha = 0.6f),
                                    modifier = Modifier.size(15.dp)
                                )
                            }
                        }
                    }
                }

                if (message.hasReactions) {
                    FlowRow(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 4.dp),
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        message.reactions.forEach { (emoji, users) ->
                            if (users.isNotEmpty()) {
                                val userReacted = users.contains(currentUserId)
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(12.dp))
                                        .background(
                                            if (userReacted) {
                                                if (isSent) Color.White.copy(alpha = 0.3f) else Emerald600.copy(alpha = 0.2f)
                                            } else {
                                                if (isSent) Color.Black.copy(alpha = 0.15f) else MaterialTheme.colorScheme.surface
                                            }
                                        )
                                        .clickable {
                                            onReactionToggle?.invoke(message.id, emoji)
                                        }
                                        .padding(horizontal = 6.dp, vertical = 2.dp)
                                ) {
                                    Text(
                                        text = "$emoji ${users.size}",
                                        fontSize = 11.sp,
                                        color = textColor
                                    )
                                }
                            }
                        }
                    }
                }
            }

            DropdownMenu(
                expanded = showContextMenu,
                onDismissRequest = { showContextMenu = false }
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    val reactions = listOf("+1", "like", "agree", "thanks", "laugh", "ack")
                    reactions.forEach { label ->
                        Text(
                            text = label,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier
                                .clickable {
                                    onReactionToggle?.invoke(message.id, label)
                                    showContextMenu = false
                                }
                                .padding(4.dp)
                        )
                    }
                }

                DropdownMenuItem(
                    text = { Text("Reply") },
                    leadingIcon = { Icon(Icons.Default.Reply, contentDescription = null) },
                    onClick = {
                        onReplyClick?.invoke(message)
                        showContextMenu = false
                    }
                )

                DropdownMenuItem(
                    text = { Text("Copy text") },
                    leadingIcon = { Icon(Icons.Default.ContentCopy, contentDescription = null) },
                    onClick = {
                        clipboardManager.setText(AnnotatedString(message.content))
                        showContextMenu = false
                    }
                )

                if (isSent) {
                    DropdownMenuItem(
                        text = { Text("Edit message") },
                        leadingIcon = { Icon(Icons.Default.Edit, contentDescription = null) },
                        onClick = {
                            onEditClick?.invoke(message)
                            showContextMenu = false
                        }
                    )
                }

                DropdownMenuItem(
                    text = { Text("Delete") },
                    leadingIcon = { Icon(Icons.Default.Delete, contentDescription = null) },
                    onClick = {
                        onDeleteClick?.invoke(message)
                        showContextMenu = false
                    }
                )
            }
        }
    }
}
