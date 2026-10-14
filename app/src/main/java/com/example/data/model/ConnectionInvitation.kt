package com.example.data.model

data class ConnectionInvitation(
    val id: String,
    val inviterId: String,
    val inviterName: String,
    val inviterUsername: String,
    val inviteCode: String,
    val inviteUri: String,
    val createdAt: Long = System.currentTimeMillis(),
    val status: String = "active" // "active", "accepted", "expired"
)
