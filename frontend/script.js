document.addEventListener("DOMContentLoaded", () => {
    const elements = {
        loadingScreen: document.getElementById("loading-screen"),
        chatContainer: document.getElementById("chat-container"),
        chatBox: document.getElementById("chat-box"),
        chatInput: document.getElementById("chat-input"),
        sendBtn: document.getElementById("send-btn"),
        clearBtn: document.getElementById("clear-btn"),
        modelSelect: document.getElementById("model-select"),
        notification: document.getElementById("notification"),
        settingsBtn: document.getElementById("settings-btn"),
        settingsModal: document.getElementById("settings-modal"),
        closeSettings: document.getElementById("close-settings"),
        settingsGpt4: document.getElementById("settings-gpt4"),
        settingsDalle: document.getElementById("settings-dalle"),
        settingsVision: document.getElementById("settings-vision"),
        gpt4WebAccess: document.getElementById("gpt4-internet-access"),
        dalleHeight: document.getElementById("dalle-height"),
        dalleWidth: document.getElementById("dalle-width"),
        // dalleNegativePrompt: document.getElementById("dalle-negative-prompt"),
        visionWebAccess: document.getElementById("vision-internet-access")
    };

    let state = {
        selectedModel: "gpt4",
        settings: {
            gpt4: { webAccess: false },
            dalle: { height: 512, width: 512 },
            vision: { webAccess: false }
        }
    };

    const botTypingAnimation = `
        <div class="message bot bot-typing">
            <img class="bot-avatar" src="assets/bot-avatar.png" alt="Bot Avatar">
            <div class="typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        </div>`;

    const copyText = (text) => {
        if (!text) {
            showNotification("Error: No text to copy.");
            return;
        }

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                showNotification("Text copied to clipboard!");
            }).catch((err) => {
                showNotification("Error: Failed to copy text.");
                console.error("Failed to copy text: ", err);
            });
        } else {
            const textArea = document.createElement("textarea");
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                showNotification("Text copied to clipboard!");
            } catch (err) {
                showNotification("Error: Failed to copy text.");
                console.error("Failed to copy text: ", err);
            }
            document.body.removeChild(textArea);
        }
    };

    const simulateLoading = async () => {
        await new Promise((resolve) => {
            setTimeout(() => {
                elements.loadingScreen.style.opacity = '0';
                setTimeout(() => {
                    elements.loadingScreen.classList.add("hidden");
                    elements.chatContainer.classList.remove("hidden");
                    elements.chatContainer.classList.add("visible");
                    resolve();
                }, 500);
            }, 1500);
        });
    };

    const sendMessage = async () => {
        const message = elements.chatInput.value.trim();
        if (!message) {
            showNotification("Error: Please enter a message.");
            return;
        }

        addMessage(message, "user");
        elements.chatInput.value = "";
        elements.chatBox.insertAdjacentHTML('beforeend', botTypingAnimation);
        elements.chatBox.scrollTop = elements.chatBox.scrollHeight;

        try {
            // Check if the selected model supports webAccess, only include it for models that need it
            const payload = {
                message,
                model: state.selectedModel,
                settings: {
                    ...state.settings[state.selectedModel],
                    // Only add webAccess if it's defined in the settings of the selected model
                    ...(state.settings[state.selectedModel]?.webAccess !== undefined && { webAccess: state.settings[state.selectedModel].webAccess })
                }
            };
        
            // // Add negativePrompt only for DALL-E model
            // if (state.selectedModel === 'dalle') {
            //     payload.settings.negativePrompt = state.settings.dalle.negativePrompt;
            // }
        
            const response = await fetch('/api/send_text', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
    
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to send message.');
            }

            const data = await response.json();

            const aiMessage = processAIResponse(data, state.selectedModel);
            removeTypingIndicator();
            addMessage(aiMessage, "bot", state.selectedModel === 'dalle');
    
            // Trigger MathJax to process any math expressions in the AI response
            if (window.MathJax) {
                MathJax.typesetPromise([elements.chatBox]);
            }
        } catch (error) {
            removeTypingIndicator();
            addMessage(`Error: ${error.message}`, "bot");
        }
    };

    const processAIResponse = (data, model) => {
        switch (model) {
            case 'dalle':
                return `<img src="${data.generated_image || ''}" width="${elements.dalleWidth.value || state.settings.dalle.width}" height="${elements.dalleHeight.value || state.settings.dalle.height}" alt="Generated Image"  />` || 'No image returned.';
            case 'vision':
                return data.result || 'No result returned.';
            case 'claude3':
                return data?.choices?.[0]?.message?.content || 'Unexpected response for Claude-3.';
            case 'ai_gf':
                return data.result || 'No result returned.';
            case 'gpt4':
            default:
                return data.result || 'Error processing response.';
        }
    };

    const formatResponse = (text) => {
        // Replace double newlines with <br><br>
        let formattedText = text.replace(/\n\n/g, "<br><br>");
    
        // Convert **bold** text to HTML <strong> tags
        formattedText = formattedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
        // Convert *italic* text to HTML <em> tags
        formattedText = formattedText.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
        // Convert ### headers to HTML <h3> tags
        formattedText = formattedText.replace(/###\s*(.*?)(<br>|$)/g, '<h3>$1</h3>');
    
        // Convert LaTeX inline math \( ... \) to MathJax format for inline display
        formattedText = formattedText.replace(/\\\((.*?)\\\)/g, '\\($1\\)');
    
        // Convert LaTeX block math \[ ... \] to MathJax format for block display
        formattedText = formattedText.replace(/\\\[(.*?)\\\]/g, '\\[$1\\]');
    
        // Convert numbered lists (e.g., 1. or 2.) to HTML lists with <br> after each number
        formattedText = formattedText.replace(/(\d+)\.\s/g, '<br>$1. ');
    
        // Convert multiline code blocks (```code```) to HTML <pre><code> tags without language tags
        formattedText = formattedText.replace(/```(?:\w+\n)?([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    
        // Convert inline code blocks (`code`) to HTML <code> tags
        formattedText = formattedText.replace(/`([^`]+)`/g, '<code>$1</code>');
    
        return formattedText;
    };
    
    
    const addMessage = (text, sender, isHtml = false) => {
        const messageElement = document.createElement("div");
        messageElement.classList.add("message", sender);

        const avatar = document.createElement("img");
        avatar.classList.add("avatar");
        avatar.src = sender === "user" ? "assets/user_avatar.png" : "assets/bot-avatar.png";

        const messageText = document.createElement("div");
        messageText.classList.add("message-content");
        messageText.innerHTML = isHtml ? text : formatResponse(text);

        const copyButton = document.createElement("button");
        copyButton.classList.add("icon-btn", "copy-btn");
        copyButton.setAttribute("aria-label", "Copy text");
        copyButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
        `;
        copyButton.addEventListener("click", () => copyText(messageText.innerText));

        messageElement.appendChild(avatar);
        messageElement.appendChild(messageText);
        messageElement.appendChild(copyButton);
        elements.chatBox.appendChild(messageElement);
        elements.chatBox.scrollTop = elements.chatBox.scrollHeight;
    };

    const removeTypingIndicator = () => {
        const typingIndicator = document.querySelector('.typing-indicator');
        if (typingIndicator) typingIndicator.parentElement.remove();
    };

    const showNotification = (message) => {
        elements.notification.textContent = message;
        elements.notification.classList.remove("hidden");
        elements.notification.classList.add("visible");

        setTimeout(() => {
            elements.notification.classList.remove("visible");
            elements.notification.classList.add("hidden");
        }, 2000);
    };

    const openSettingsModal = () => {
        elements.settingsModal.classList.remove("hidden");
        elements.settingsModal.classList.add("visible");
        updateSettingsUI();
    };

    const closeSettingsModal = () => {
        elements.settingsModal.classList.remove("visible");
        elements.settingsModal.classList.add("hidden");
    };

    const updateSettingsUI = () => {
        const model = state.selectedModel;
        elements.settingsGpt4.classList.add("hidden");
        elements.settingsDalle.classList.add("hidden");
        elements.settingsVision.classList.add("hidden");

        if (model === 'gpt4') {
            elements.settingsGpt4.classList.remove("hidden");
            elements.gpt4WebAccess.checked = state.settings.gpt4.webAccess;
        } else if (model === 'dalle') {
            elements.settingsDalle.classList.remove("hidden");
            elements.dalleHeight.value = state.settings.dalle.height;
            elements.dalleWidth.value = state.settings.dalle.width;
            elements.dalleNegativePrompt.value = state.settings.dalle.negativePrompt;
        } else if (model === 'vision') {
            elements.settingsVision.classList.remove("hidden");
            elements.visionWebAccess.checked = state.settings.vision.webAccess;
        }
    };

    elements.settingsBtn.addEventListener("click", openSettingsModal);
    elements.closeSettings.addEventListener("click", closeSettingsModal);

    elements.modelSelect.addEventListener("change", () => {
        state.selectedModel = elements.modelSelect.value;
        showNotification(`Model changed to ${state.selectedModel}`);
        updateSettingsUI();
    });

    elements.gpt4WebAccess.addEventListener("change", (e) => {
        state.settings.gpt4.webAccess = e.target.checked;
    });

    elements.dalleHeight.addEventListener("input", (e) => {
        state.settings.dalle.height = parseInt(e.target.value, 10);
    });

    elements.dalleWidth.addEventListener("input", (e) => {
        state.settings.dalle.width = parseInt(e.target.value, 10);
    });

    // elements.dalleNegativePrompt.addEventListener("input", (e) => {
    //     state.settings.dalle.negativePrompt = e.target.value;
    // });

    elements.visionWebAccess.addEventListener("change", (e) => {
        state.settings.vision.webAccess = e.target.checked;
    });

    elements.clearBtn.addEventListener("click", () => {
        elements.chatBox.innerHTML = "";
        showNotification("Chat cleared!");
    });

    elements.sendBtn.addEventListener("click", sendMessage);
    elements.chatInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") sendMessage();
    });

    simulateLoading();
});
