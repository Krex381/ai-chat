document.addEventListener("DOMContentLoaded", () => {
    const loadingScreen = document.getElementById("loading-screen");
    const chatContainer = document.getElementById("chat-container");
    const chatBox = document.getElementById("chat-box");
    const chatInput = document.getElementById("chat-input");
    const sendBtn = document.getElementById("send-btn");
    const clearBtn = document.getElementById("clear-btn");
    const modelSelect = document.getElementById("model-select");
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
                let aiMessage;

                if (selectedModel === 'dalle') {
                    aiMessage = `<img src="${data.generated_image}" alt="Generated Image" class="image-message" width="1024" height="1024">`;
                } else {
                    aiMessage = data.choices[0].message.content;
                }

                // Remove typing animation and display AI response
                removeTypingIndicator();
                addMessage(aiMessage, "bot", selectedModel === 'dalle');
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

    const addMessage = (text, sender, isHtml = false) => {
        const messageElement = document.createElement("div");
        messageElement.classList.add("message", sender);

        const avatar = document.createElement("img");
        avatar.classList.add("avatar");
        avatar.src = sender === "user" ? "assets/user_avatar.png" : "assets/bot-avatar.png";

        const messageText = document.createElement("div");
        if (isHtml) {
            messageText.innerHTML = text;
        } else {
            messageText.textContent = text;
        }

        const copyIcon = document.createElement("img");
        copyIcon.src = "assets/copy_icon.png";
        copyIcon.classList.add("copy-icon");
        copyIcon.title = "Copy to clipboard";
        copyIcon.onclick = () => {
            const contentToCopy = isHtml ? messageText.innerHTML : messageText.textContent;
            const tempTextArea = document.createElement("textarea");
            tempTextArea.value = contentToCopy;
            document.body.appendChild(tempTextArea);
            tempTextArea.select();
            document.execCommand("copy");
            document.body.removeChild(tempTextArea);
            showNotification("Text copied to clipboard!");
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

    modelSelect.addEventListener("change", () => {
        selectedModel = modelSelect.value;
        showNotification(`AI model changed to ${selectedModel === 'gpt4' ? 'GPT-4' : selectedModel === 'claude3' ? 'Claude 3' : selectedModel === 'dalle' ? 'DALL-E' : 'Unknown Model'}`);
    });
});
