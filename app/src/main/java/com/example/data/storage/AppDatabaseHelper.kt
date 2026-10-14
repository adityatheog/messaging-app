package com.example.data.storage

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

class AppDatabaseHelper(context: Context) : SQLiteOpenHelper(
    context.applicationContext,
    DATABASE_NAME,
    null,
    DATABASE_VERSION
) {
    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE users (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                full_name TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                last_seen INTEGER NOT NULL
            );
            """.trimIndent()
        )

        db.execSQL(
            """
            CREATE TABLE messages (
                id TEXT PRIMARY KEY,
                sender_id TEXT NOT NULL,
                receiver_id TEXT NOT NULL,
                content TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                is_read INTEGER NOT NULL DEFAULT 0
            );
            """.trimIndent()
        )

        db.execSQL("CREATE INDEX idx_msg_participants ON messages(sender_id, receiver_id);")
        db.execSQL("CREATE INDEX idx_msg_timestamp ON messages(timestamp);")
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        db.execSQL("DROP TABLE IF EXISTS messages")
        db.execSQL("DROP TABLE IF EXISTS users")
        onCreate(db)
    }

    companion object {
        private const val DATABASE_NAME = "messaging_app.db"
        private const val DATABASE_VERSION = 1
    }
}
