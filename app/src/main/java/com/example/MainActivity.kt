package com.example

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.data.model.AuthState
import com.example.data.model.User
import com.example.data.storage.MessageRepository
import com.example.ui.auth.AuthViewModel
import com.example.ui.auth.LoginScreen
import com.example.ui.auth.RegisterScreen
import com.example.ui.chat.ChatViewModel
import com.example.ui.chat.MainMessagingScreen
import com.example.ui.theme.MessagingAppTheme

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val repository = MessageRepository(applicationContext)

        setContent {
            MessagingAppTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    val authViewModel: AuthViewModel = viewModel(
                        factory = object : ViewModelProvider.Factory {
                            @Suppress("UNCHECKED_CAST")
                            override fun <T : ViewModel> create(modelClass: Class<T>): T {
                                return AuthViewModel(repository) as T
                            }
                        }
                    )

                    val chatViewModel: ChatViewModel = viewModel(
                        factory = object : ViewModelProvider.Factory {
                            @Suppress("UNCHECKED_CAST")
                            override fun <T : ViewModel> create(modelClass: Class<T>): T {
                                return ChatViewModel(repository) as T
                            }
                        }
                    )

                    AppContent(
                        repository = repository,
                        authViewModel = authViewModel,
                        chatViewModel = chatViewModel
                    )
                }
            }
        }
    }
}

@Composable
fun AppContent(
    repository: MessageRepository,
    authViewModel: AuthViewModel,
    chatViewModel: ChatViewModel,
    modifier: Modifier = Modifier
) {
    val authState by authViewModel.authState.collectAsState()
    val isLoading by authViewModel.isLoading.collectAsState()
    val errorMessage by authViewModel.errorMessage.collectAsState()
    var showRegister by remember { mutableStateOf(false) }

    val currentActiveUser: User? = when (val state = authState) {
        is AuthState.Authenticated -> state.user
        else -> null
    }

    LaunchedEffect(currentActiveUser?.id) {
        if (currentActiveUser != null) {
            repository.ensureUser(
                id = currentActiveUser.id,
                username = currentActiveUser.username,
                fullName = currentActiveUser.fullName
            )
        }
    }

    if (currentActiveUser != null) {
        MainMessagingScreen(
            currentUser = currentActiveUser,
            chatViewModel = chatViewModel,
            onLogoutClick = {
                authViewModel.logout()
                chatViewModel.reset()
            },
            modifier = modifier
        )
    } else {
        if (showRegister) {
            RegisterScreen(
                onCreatePrivacyIdentity = {
                    authViewModel.createPrivacyIdentity()
                },
                onRegisterClick = { u, p, fn ->
                    authViewModel.register(u, p, fn)
                },
                onNavigateToLogin = {
                    authViewModel.clearError()
                    showRegister = false
                },
                isLoading = isLoading,
                errorMessage = errorMessage,
                modifier = modifier
            )
        } else {
            LoginScreen(
                onCreatePrivacyIdentity = {
                    authViewModel.createPrivacyIdentity()
                },
                onLoginClick = { u, p ->
                    authViewModel.login(u, p)
                },
                onNavigateToRegister = {
                    authViewModel.clearError()
                    showRegister = true
                },
                isLoading = isLoading,
                errorMessage = errorMessage,
                modifier = modifier
            )
        }
    }
}
