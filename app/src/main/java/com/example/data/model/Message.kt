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
    val isRead: Boolean = false
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
}
