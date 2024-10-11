document.addEventListener("DOMContentLoaded", () => {
    const loadingScreen = document.getElementById("loading-screen");
    const chatContainer = document.getElementById("chat-container");
    const chatBox = document.getElementById("chat-box");
    const chatInput = document.getElementById("chat-input");
    const sendBtn = document.getElementById("send-btn");
    const clearBtn = document.getElementById("clear-btn");
    const modelSelectors = document.querySelectorAll(".selector-button");
    let selectedModel = "gpt4"; // Default model

    const botTypingAnimation = `<div class="message bot"><img class="avatar" src="assets/bot-avatar.png"><div class="typing-indicator"><span></span><span></span><span></span></div></div>`;

    // Simulate loading screen
    setTimeout(() => {
        loadingScreen.style.opacity = '0';
        setTimeout(() => {
            loadingScreen.classList.add("hidden");
            chatContainer.classList.remove("hidden");
            setTimeout(() => {
                chatContainer.classList.add("visible");
            }, 50);
        }, 500);
    }, 1500);

    const sendMessage = async () => {
        const message = chatInput.value.trim();
        if (message) {
            addMessage(message, "user");
            chatInput.value = "";

            // Show bot typing animation
            chatBox.insertAdjacentHTML('beforeend', botTypingAnimation);
            chatBox.scrollTop = chatBox.scrollHeight;

            try {
                const response = await fetch('/api/send_text', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ message, model: selectedModel })
                });

                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }

                const data = await response.json();
                const aiMessage = data.choices[0].message.content;

                // Remove typing animation and display AI response
                removeTypingIndicator();
                addMessage(aiMessage, "bot");
            } catch (error) {
                console.error('Fetch operation error:', error);
                removeTypingIndicator();
                addMessage("Error: Unable to fetch AI response", "bot");
            }
        } else {
            showNotification("Please enter a message before sending.");
        }
    };

    const removeTypingIndicator = () => {
        const typingIndicator = document.querySelector('.typing-indicator');
        if (typingIndicator) {
            typingIndicator.parentElement.remove();
        }
    };

    const addMessage = (text, sender) => {
        const messageElement = document.createElement("div");
        messageElement.classList.add("message", sender);

        const avatar = document.createElement("img");
        avatar.classList.add("avatar");
        avatar.src = sender === "user" ? "assets/user_avatar.png" : "assets/bot-avatar.png";

        const messageText = document.createElement("div");
        messageText.innerHTML = text.replace(/\n/g, '<br>');

        const copyIcon = document.createElement("img");
        copyIcon.src = "assets/copy_icon.png";
        copyIcon.classList.add("copy-icon");
        copyIcon.title = "Copy to clipboard";
        copyIcon.onclick = () => {
            navigator.clipboard.writeText(text).then(() => {
                showNotification("Text copied to clipboard!");
            });
        };

        messageElement.appendChild(avatar);
        messageElement.appendChild(messageText);
        messageElement.appendChild(copyIcon);

        chatBox.appendChild(messageElement);
        chatBox.scrollTop = chatBox.scrollHeight;

        messageElement.addEventListener("mouseenter", () => {
            copyIcon.classList.add("visible");
        });
        messageElement.addEventListener("mouseleave", () => {
            copyIcon.classList.remove("visible");
        });
    };

    clearBtn.addEventListener("click", () => {
        chatBox.innerHTML = "";
        showNotification("Chat cleared!");
    });

    sendBtn.addEventListener("click", sendMessage);
    chatInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            sendMessage();
        }
    });

    const showNotification = (message) => {
        const notification = document.getElementById("notification");
        notification.textContent = message;
        notification.classList.remove("hidden");
        notification.classList.add("visible");

        setTimeout(() => {
            notification.classList.remove("visible");
            notification.classList.add("hidden");
        }, 2000);
    };

    modelSelectors.forEach(button => {
        button.addEventListener("click", () => {
            selectedModel = button.getAttribute("data-model");
            showNotification(`AI model changed to ${selectedModel === 'gpt4' ? 'GPT-4' : 'Claude 3'}`);
            modelSelectors.forEach(btn => btn.classList.remove("active"));
            button.classList.add("active");
        });
    });
});
