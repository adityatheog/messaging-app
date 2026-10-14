package com.example.data.model

import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

data class Message(
    val id: String,
    val senderId: String,
    val receiverId: String,
    val content: String,
    val timestamp: Long = System.currentTimeMillis(),
    val isRead: Boolean = false,
    val isDelivered: Boolean = true,
    val isGroup: Boolean = false,
    val replyToId: String? = null,
    val replyToText: String? = null,
    val replyToSender: String? = null,
    val messageType: String = "TEXT", // "TEXT", "IMAGE", "VOICE", "DOCUMENT"
    val mediaUrl: String? = null,
    val mediaName: String? = null,
    val mediaSize: Long = 0L,
    val audioDurationSeconds: Int = 0,
    val reactions: Map<String, List<String>> = emptyMap(), // emoji -> list of userIds
    val isEdited: Boolean = false,
    val disappearingAfterSeconds: Int = 0
) {
    val formattedTime: String
        get() {
            val formatter = SimpleDateFormat("h:mm a", Locale.getDefault())
            return formatter.format(Date(timestamp))
        }

    val formattedDateOrTime: String
        get() {
            val now = System.currentTimeMillis()
            val diff = now - timestamp
            val oneDay = 24 * 60 * 60 * 1000L
            return if (diff < oneDay) {
                formattedTime
            } else {
                val dateFormatter = SimpleDateFormat("MMM d", Locale.getDefault())
                dateFormatter.format(Date(timestamp))
            }
        }

    val hasReactions: Boolean
        get() = reactions.any { it.value.isNotEmpty() }
}

