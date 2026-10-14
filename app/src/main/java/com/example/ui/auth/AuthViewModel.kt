package com.example.ui.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.data.model.AuthState
import com.example.data.model.User
import com.example.data.storage.MessageRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class AuthViewModel(private val repository: MessageRepository) : ViewModel() {

    private val _authState = MutableStateFlow<AuthState>(AuthState.Unauthenticated)
    val authState: StateFlow<AuthState> = _authState.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    fun clearError() {
        _errorMessage.value = null
    }

    fun login(username: String, password: String) {
        if (username.isBlank() || password.isBlank()) {
            _errorMessage.value = "Username and password are required"
            return
        }

        viewModelScope.launch {
            _isLoading.value = true
            _errorMessage.value = null
            val result = repository.loginUser(username, password)
            result.fold(
                onSuccess = { user ->
                    _authState.value = AuthState.Authenticated(user, "token_${user.id}")
                },
                onFailure = { err ->
                    _errorMessage.value = err.message ?: "Failed to log in"
                }
            )
            _isLoading.value = false
        }
    }

    fun register(username: String, password: String, fullName: String) {
        viewModelScope.launch {
            _isLoading.value = true
            _errorMessage.value = null
            val result = repository.registerUser(username, password, fullName)
            result.fold(
                onSuccess = { user ->
                    _authState.value = AuthState.Authenticated(user, "token_${user.id}")
                },
                onFailure = { err ->
                    _errorMessage.value = err.message ?: "Failed to register"
                }
            )
            _isLoading.value = false
        }
    }

    fun logout() {
        val current = _authState.value
        if (current is AuthState.Authenticated) {
            viewModelScope.launch {
                repository.logoutUser(current.user.id)
                _authState.value = AuthState.Unauthenticated
            }
        } else {
            _authState.value = AuthState.Unauthenticated
        }
    }

    fun quickLoginDemo(username: String) {
        login(username, "password123")
    }
}
