package com.example.data.model

sealed class CallStatus {
    object Idle : CallStatus()
    data class Outgoing(val peer: User) : CallStatus()
    data class Incoming(val peer: User) : CallStatus()
    data class Connected(val peer: User, val durationSeconds: Int = 0) : CallStatus()
    data class Ended(val reason: String = "Call ended") : CallStatus()
}

data class ActiveCall(
    val peer: User,
    val isIncoming: Boolean,
    val isConnected: Boolean = false,
    val durationSeconds: Int = 0,
    val isMuted: Boolean = false,
    val isSpeakerOn: Boolean = false
) {
    val formattedDuration: String
        get() {
            val mins = durationSeconds / 60
            val secs = durationSeconds % 60
            return String.format("%02d:%02d", mins, secs)
        }
}
