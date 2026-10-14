package com.example.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DoneAll
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.model.Message
import com.example.ui.theme.Blue100
import com.example.ui.theme.Blue600
import com.example.ui.theme.Slate200
import com.example.ui.theme.Slate500
import com.example.ui.theme.Slate900

@Composable
fun MessageBubble(
    message: Message,
    isSent: Boolean,
    modifier: Modifier = Modifier
) {
    val bubbleShape = if (isSent) {
        RoundedCornerShape(topStart = 18.dp, topEnd = 18.dp, bottomStart = 18.dp, bottomEnd = 4.dp)
    } else {
        RoundedCornerShape(topStart = 18.dp, topEnd = 18.dp, bottomStart = 4.dp, bottomEnd = 18.dp)
    }

    val bubbleBg = if (isSent) Blue600 else MaterialTheme.colorScheme.surfaceVariant
    val textColor = if (isSent) Color.White else MaterialTheme.colorScheme.onSurface
    val timeColor = if (isSent) Blue100 else MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)

    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 4.dp),
        horizontalArrangement = if (isSent) Arrangement.End else Arrangement.Start
    ) {
        Box(
            modifier = Modifier
                .widthIn(max = 290.dp)
                .clip(bubbleShape)
                .background(bubbleBg)
                .padding(horizontal = 14.dp, vertical = 10.dp)
                .testTag(if (isSent) "message_bubble_sent" else "message_bubble_received")
        ) {
            Column(
                horizontalAlignment = if (isSent) Alignment.End else Alignment.Start
            ) {
                Text(
                    text = message.content,
                    color = textColor,
                    style = MaterialTheme.typography.bodyLarge,
                    lineHeight = 20.sp
                )

                Row(
                    modifier = Modifier.padding(top = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Text(
                        text = message.formattedTime,
                        color = timeColor,
                        style = MaterialTheme.typography.labelSmall
                    )

                    if (isSent) {
                        Icon(
                            imageVector = Icons.Default.DoneAll,
                            contentDescription = if (message.isRead) "Read" else "Sent",
                            tint = if (message.isRead) Color(0xFF93C5FD) else Blue100.copy(alpha = 0.6f),
                            modifier = Modifier.size(14.dp)
                        )
                    }
                }
            }
        }
    }
}
