package com.example.data.model

import com.google.firebase.Timestamp
import com.google.firebase.firestore.DocumentId
import com.google.firebase.firestore.IgnoreExtraProperties
import com.google.firebase.firestore.ServerTimestamp

@IgnoreExtraProperties
data class FirestoreUserProfile(
    @DocumentId val id: String = "",
    val username: String = "",
    val fullName: String = "",
    val isOnline: Boolean = false,
    val isVerified: Boolean = false,
    val isBlocked: Boolean = false,
    val safetyNumber: String = "",
    val pairwiseQueueAddress: String = "",
    val disappearingTimerSeconds: Int = 0,
    @ServerTimestamp val createdAt: Timestamp? = null,
    @ServerTimestamp val lastSeen: Timestamp? = null
) {
    fun toDomainUser(): User {
        val sNumber = safetyNumber.ifBlank { User.generateDefaultSafetyNumber(id) }
        val qAddr = pairwiseQueueAddress.ifBlank { "sx://broker.simplexlink.net/q/${id.take(8)}" }
        return User(
            id = id,
            username = username,
            fullName = fullName,
            isOnline = isOnline,
            lastSeen = lastSeen?.toDate()?.time ?: System.currentTimeMillis(),
            isVerified = isVerified,
            isBlocked = isBlocked,
            safetyNumber = sNumber,
            pairwiseQueueAddress = qAddr,
            disappearingTimerSeconds = disappearingTimerSeconds
        )
    }
}

@IgnoreExtraProperties
data class FirestoreMessage(
    @DocumentId val id: String = "",
    val senderId: String = "",
    val receiverId: String = "",
    val content: String = "",
    val read: Boolean = false,
    val delivered: Boolean = true,
    val isGroup: Boolean = false,
    val replyToId: String? = null,
    val replyToText: String? = null,
    val replyToSender: String? = null,
    val messageType: String = "TEXT",
    val mediaUrl: String? = null,
    val mediaName: String? = null,
    val mediaSize: Long = 0L,
    val audioDurationSeconds: Int = 0,
    val reactions: Map<String, List<String>> = emptyMap(),
    val isEdited: Boolean = false,
    val disappearingAfterSeconds: Int = 0,
    @ServerTimestamp val createdAt: Timestamp? = null
) {
    fun toDomainMessage(): Message {
        return Message(
            id = id,
            senderId = senderId,
            receiverId = receiverId,
            content = content,
            timestamp = createdAt?.toDate()?.time ?: System.currentTimeMillis(),
            isRead = read,
            isDelivered = delivered,
            isGroup = isGroup,
            replyToId = replyToId,
            replyToText = replyToText,
            replyToSender = replyToSender,
            messageType = messageType,
            mediaUrl = mediaUrl,
            mediaName = mediaName,
            mediaSize = mediaSize,
            audioDurationSeconds = audioDurationSeconds,
            reactions = reactions,
            isEdited = isEdited,
            disappearingAfterSeconds = disappearingAfterSeconds
        )
    }
}

