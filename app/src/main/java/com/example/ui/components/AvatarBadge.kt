package com.example.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.model.User
import com.example.ui.theme.AvatarColors
import com.example.ui.theme.Green500

fun getAvatarColorForId(id: String): Color {
    if (id.isEmpty()) return AvatarColors[0]
    val sum = id.fold(0) { acc, char -> acc + char.code }
    return AvatarColors[kotlin.math.abs(sum) % AvatarColors.size]
}

@Composable
fun AvatarBadge(
    user: User,
    size: Dp = 48.dp,
    showOnlineIndicator: Boolean = true,
    modifier: Modifier = Modifier
) {
    val backgroundColor = getAvatarColorForId(user.id)
    val indicatorSize = if (size > 40.dp) 14.dp else 10.dp
    val fontSize = (size.value * 0.36f).sp

    Box(
        modifier = modifier.size(size),
        contentAlignment = Alignment.Center
    ) {
        Box(
            modifier = Modifier
                .size(size)
                .clip(CircleShape)
                .background(backgroundColor),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = user.initials,
                color = Color.White,
                fontSize = fontSize,
                fontWeight = FontWeight.Bold
            )
        }

        if (showOnlineIndicator && user.isOnline) {
            Box(
                modifier = Modifier
                    .size(indicatorSize)
                    .align(Alignment.BottomEnd)
                    .clip(CircleShape)
                    .border(2.dp, MaterialTheme.colorScheme.surface, CircleShape)
                    .background(Green500)
            )
        }
    }
}

@Composable
fun GroupAvatarBadge(
    groupName: String,
    size: Dp = 48.dp,
    avatarColor: Color = Color(0xFF10B981),
    modifier: Modifier = Modifier
) {
    val fontSize = (size.value * 0.36f).sp
    val initials = groupName.trim().take(2).uppercase().ifEmpty { "G" }

    Box(
        modifier = modifier
            .size(size)
            .clip(CircleShape)
            .background(avatarColor),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = initials,
            color = Color.White,
            fontSize = fontSize,
            fontWeight = FontWeight.Bold
        )
    }
}

