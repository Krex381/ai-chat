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
        dalleNegative: document.getElementById("dalle-negative"),
        visionWebAccess: document.getElementById("vision-internet-access")
    };

    let state = {
        selectedModel: "gpt4",
        settings: {
            gpt4: { webAccess: false },
            dalle: { height: 512, width: 512 },
            vision: { webAccess: false }
        },
        requestInProgress: false,
        retryCount: 0,
        maxRetries: 3,
        currentConversationId: null
    };

    const botTypingAnimation = `
        <div class="message bot bot-typing" style="opacity: 0; transform: translateY(20px);">
            <img class="bot-avatar" src="assets/bot-avatar.png" alt="Bot Avatar" 
                onerror="this.src='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAOxAAADsQBlSsOGwAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAVESURBVGiB7VlrTFNnGH7ec3pbLqUtlFIuQrkMECgKKOgQnW5T5+YSt8QsZn9MjMsSjVn2w/3wR7LEuGQxmTFm2Y+5xGXJlmXZ4hJ1KF5QUcALMhQcICBtaaGl0PZ0p+f9dlqsWNree6Dk+dOc877v837Peb/zfufyHsAfwL8YhNcTZGVlhUilUi0hJEkmk0VzHBfNsqxKIBCoCCFKAHIAYgAigJMAHABGAIwQQoYZhhlkWXaAYZgBhmF6u7u7h73V4JkBjUajlMlkKQzDpEgkkiSBQJAgl8tjCSHRhBCVJ3O7AcMwgzzP9/E838MwTBfP8+2EkPa2trZRT+ZyZCA7O1vGcVwOz/OZYrE4QyQSrREKhakAQr0R7gEcADoJIa0Mw7QyDNPC8/yVlpaWUXcDXRrIzc0VDQ0NZYnF4lyRSJQnFovXEUJC/JHsBQghZIgQcp3n+UaCwPNXm5ubx5zFOTWQl5cnGBgYyJBIJAUikShfLBZvBBDkv2SfMQGgked5PcuyFzzPX3NkxK6B/Px84f379zMkEkmhSCTaKhaLs+HfsugtHACNPM9fZFn2PM/zV5ubm6cd3eRwwvz8fGF/f3+mRCIpEolEO8RicQ78X9m8hgNQz/P8OY7jTl+7ds2hEYcGVq9eLR0ZGdkmFot3i8XiXAQu4Y5gATTwPH+K47gzN2/enLK9aDOhRqNRSiSSHRKJZI9YLF4P/1fiQEEA4BbP86dYlj3Z1tbmcCuZZ0Cj0ShlMtlOsVi8VyKRrEVgk+4KAoBbPM+fZFn2hL0VmWdAo9EoZTLZLolEsk8sFq9B4JN+EgKAWzzPH2dZ9mRbW9ucvXyOAY1Go5TJZF9KJJL9YrE4HYuX9JMQANzief4Yy7In2traZucvzDGg0WiUcrn8K6lUekAsFqdhcZN+EgKAWzzPH2VZ9kR7e/vMzAWBVqtVyuXyryUSyUGJRJKOxU/6SQgANPI8/zvLssfa29un6QVBXl5eEMdxB6VS6WGJRJKBpUP6SQgA6Hie/41l2aPNzc0TAoZhvpHL5d9KpdKVWHqkn4QAoJ7n+V8nJiZ+F6ampn4hl8t/lEqlGixd0k9CAKC+tbX1kECtVn8nk8l+kkqlq7D0YQBQz/P8z4KUlJQjMpnsCBY36Sdxm+f5nwQJCQk/y2SyX7F0ST8JAcB1nuePCGJiYn6Ty+W/YWmTfhJ1PM//KoiKivpDLpcfxdIn/STqeJ4/IlAqlcfkcvkxLA/ST6KW5/mjAoVC8adcLj+O5UP6SdTyPH9MoFQqT8jl8r+wfEg/iVqe548LFHK5/KRCoTiJ5UP6SdTwPH9CoFAoTikUilNYXqSfRA3P8ycFCoXib4VCcRrLj/STqOZ5/pRAoVCcUSgUZ7A8ST+Jap7nTwsUCsVZhUJxFsuX9JOo5nn+jEChUJxTKBTnsPxIP4lqnufPChQKxXmFQlGB5Un6SVTzPF8hUCgUFxQKRSWWL+knUcXzfKVAoVBcVCgUVVj+pJ9EFc/zlQKFQnFJoVBcxtIn/SSqeJ6/LFAoFJcVCkU1lgfpJ1HF83y1QKFQXFEoFDVYPqSfRBXP8zUChUJRq1AorrJ9Q4Nui/EThBDSxTBM1cTExFWBWq2+yvf0bWNZNnDJ5vkuhUJRK1Cr1dfYvqFNLMsGJtk838kwTK1ArVZfZ/uG8liWDTyieb6TYZg6gVqtvsl2D+UyDBM4JPN8J8Mw9QK1Wl3Pdg/lMAwTGOTyfCfDMDcEarX6X/xP4B8IKXiHs2/ZkQAAAABJRU5ErkJggg=='">
            <div class="typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        </div>`;

    const startNewConversation = async () => {
        try {
            await fetch('/reset_conversation', {
                method: 'POST'
            });
            state.currentConversationId = null;
            elements.chatBox.innerHTML = "";
            showNotification("Started new conversation!", "success");
        } catch (error) {
            console.error("Failed to reset conversation:", error);
            showNotification("Failed to reset conversation", "error");
        }
    };

    const copyText = async (text) => {
        if (!text) {
            showNotification("Error: No text to copy.", "error");
            return;
        }

        try {
            // Use execCommand as primary method since navigator.clipboard may be undefined
            const textArea = document.createElement("textarea");
            textArea.value = text;
            textArea.style.position = 'fixed'; // Prevent scrolling to bottom
            textArea.style.opacity = '0';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);

            if (successful) {
                showNotification("Text copied to clipboard!", "success");
            } else {
                throw new Error('execCommand copy failed');
            }
        } catch (err) {
            showNotification("Error: Failed to copy text.", "error");
            console.error("Failed to copy text: ", err);
        }
    };

    const simulateLoading = async () => {
        try {
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
        } catch (error) {
            console.error("Loading simulation failed:", error);
            showNotification("Error during initialization", "error");
        }
    };

    const sendMessage = async () => {
        if (state.requestInProgress) {
            showNotification("Please wait for the current request to complete.", "warning");
            return;
        }

        const message = elements.chatInput.value.trim();
        if (!message) {
            showNotification("Error: Please enter a message.", "error");
            return;
        }

        state.requestInProgress = true;
        state.retryCount = 0;

        addMessage(message, "user");
        elements.chatInput.value = "";
        elements.chatBox.scrollTop = elements.chatBox.scrollHeight;

        const sendRequest = async () => {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 60000); // 30 second timeout

                elements.chatBox.insertAdjacentHTML('beforeend', botTypingAnimation);
                elements.chatBox.scrollTop = elements.chatBox.scrollHeight;

                const payload = {
                    message,
                    model: state.selectedModel,
                    settings: {
                        ...state.settings[state.selectedModel],
                        webAccess: state.settings[state.selectedModel]?.webAccess ?? false,
                        negative_prompt: state.selectedModel === 'dalle' ? state.settings.dalle?.negative ?? '' : undefined
                    }
                };

                if (state.currentConversationId) {
                    payload.conversation_id = state.currentConversationId;
                }

                const response = await fetch('/api/send_text', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(payload),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to send message.');
                }

                const data = await response.json();

                if (data.conversation_id) {
                    state.currentConversationId = data.conversation_id;
                }

                const aiMessage = processAIResponse(data, state.selectedModel);
                
                removeTypingIndicator();
                addMessage(aiMessage.message, "bot", state.selectedModel === 'dalle');

                if (window.MathJax) {
                    await MathJax.typesetPromise([elements.chatBox]);
                }

                elements.chatBox.scrollTop = elements.chatBox.scrollHeight;
            } catch (error) {
                if (error.name === 'AbortError') {
                    removeTypingIndicator();
                    showNotification("Request timed out. Please try again.", "error");
                    return;
                }
                if (state.retryCount < state.maxRetries) {
                    state.retryCount++;
                    showNotification(`Retrying... Attempt ${state.retryCount}/${state.maxRetries}`, "warning");
                    await new Promise(resolve => setTimeout(resolve, 1000 * state.retryCount));
                    return sendRequest();
                }
                removeTypingIndicator();
                addMessage(`Error: ${error.message}`, "bot");
                console.error("API Error:", error);
            } finally {
                state.requestInProgress = false;
            }
        };

        await sendRequest();
    };

    const processAIResponse = (data, model) => {
        let responseMessage;
        switch (model) {
            case 'dalle':
                responseMessage = `<img src="${data.message || ''}" width="${elements.dalleWidth.value || state.settings.dalle.width}" height="${elements.dalleHeight.value || state.settings.dalle.height}" alt="Generated Image" loading="lazy" onerror="this.onerror=null;this.src='assets/error-image.png';" />` || 'No image returned.';
                break;
            case 'vision':
            case 'ai_gf':
            case 'claude3':
            case 'gpt4':
                responseMessage = data.message || `Error: Unexpected response structure for ${model}`;
                break;
            default:
                responseMessage = 'Error: Invalid model selected';
                break;
        }
        return { message: responseMessage };
    };

    const formatResponse = (text) => {
        if (typeof text !== 'string') {
            console.error('Expected a string in formatResponse, but got:', typeof text);
            return String(text);
        }

        const replacements = [
            [/\n\n/g, "<br><br>"],
            [/\*\*(.*?)\*\*/g, '<strong>$1</strong>'],
            [/\*(.*?)\*/g, '<em>$1</em>'],
            [/###\s*(.*?)(<br>|$)/g, '<h3>$1</h3>'],
            [/\\\((.*?)\\\)/g, '\\($1\\)'],
            [/\\\[(.*?)\\\]/g, '\\[$1\\]'],
            [/(\d+)\.\s/g, '<br>$1. '],
            [/```(?:\w+\n)?([\s\S]*?)```/g, (match, p1) => {
                const pre = document.createElement('pre');
                const code = document.createElement('code');
                code.textContent = p1;
                
                const copyBtn = document.createElement('button');
                copyBtn.className = 'icon-btn copy-btn';
                copyBtn.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="copy-icon">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>`;
                
                copyBtn.addEventListener('click', function() {
                    const codeText = this.parentElement.querySelector('code').textContent;
                    const textArea = document.createElement('textarea');
                    textArea.value = codeText;
                    document.body.appendChild(textArea);
                    textArea.select();
                    try {
                        document.execCommand('copy');
                        showNotification('Code copied to clipboard!', 'success');
                    } catch(e) {
                        console.error('Copy failed:', e);
                        showNotification('Failed to copy code', 'error');
                    }
                    document.body.removeChild(textArea);
                });

                pre.appendChild(code);
                pre.appendChild(copyBtn);
                return pre.outerHTML;
            }]
        ];

        return replacements.reduce((acc, [pattern, replacement]) => 
            acc.replace(pattern, replacement), text);
    };

    const addMessage = (text, sender, isHtml = false) => {
        const messageElement = document.createElement("div");
        messageElement.classList.add("message", sender);

        const avatar = document.createElement("img");
        avatar.classList.add("avatar");
        avatar.src = sender === "user" ? "assets/user_avatar.png" : "assets/bot-avatar.png";
        avatar.loading = "lazy";
        avatar.draggable = false;
        avatar.onerror = () => {
            avatar.src = "assets/default-avatar.png";
        };

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
        if (!isHtml) messageElement.appendChild(copyButton);
        elements.chatBox.appendChild(messageElement);
        
        requestAnimationFrame(() => {
            elements.chatBox.scrollTop = elements.chatBox.scrollHeight;
        });
    };

    const removeTypingIndicator = () => {
        const typingIndicator = document.querySelector('.typing-indicator');
        if (typingIndicator) typingIndicator.parentElement.remove();
    };

    const showNotification = (message, type = 'default', duration = 3000) => {
        elements.notification.textContent = message;
        elements.notification.className = 'notification';
        elements.notification.classList.add(type);
        elements.notification.classList.add('visible');

        elements.notification.addEventListener('mousemove', (e) => {
            const rect = elements.notification.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            elements.notification.style.setProperty('--mouse-x', `${x}px`);
            elements.notification.style.setProperty('--mouse-y', `${y}px`);
        });

        let color = '255, 255, 255';
        switch(type) {
            case 'success':
                color = '40, 200, 100';
                break;
            case 'warning':
                color = '255, 170, 0';
                break;
            case 'error':
                color = '255, 50, 50';
                break;
        }
        elements.notification.style.setProperty('--notification-color', color);

        setTimeout(() => {
            elements.notification.classList.remove('visible');
            setTimeout(() => {
                elements.notification.className = 'notification';
            }, 500);
        }, duration);
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
        } else if (model === 'vision') {
            elements.settingsVision.classList.remove("hidden");
            elements.visionWebAccess.checked = state.settings.vision.webAccess;
        }
    };

    elements.settingsBtn.addEventListener("click", openSettingsModal);
    elements.closeSettings.addEventListener("click", closeSettingsModal);

    elements.modelSelect.addEventListener("change", () => {
        state.selectedModel = elements.modelSelect.value;
        showNotification(`Model changed to ${state.selectedModel}`, "success");
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

    elements.visionWebAccess.addEventListener("change", (e) => {
        state.settings.vision.webAccess = e.target.checked;
    });

    elements.clearBtn.addEventListener("click", () => {
        startNewConversation();
    });

    let debounceTimeout;

    const debouncedSendMessage = () => {
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(() => {
            sendMessage();
        }, 300); // 300ms delay
    };

    elements.sendBtn.addEventListener("click", debouncedSendMessage);
    elements.chatInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            debouncedSendMessage();
        }
    });

    elements.modelSelect.addEventListener("change", () => {
        state.selectedModel = elements.modelSelect.value;
        showNotification(`Model changed to ${state.selectedModel}`, "success");
        updateSettingsUI();
    });

    window.addEventListener('error', (e) => {
        console.error('Global error:', e);
        showNotification('An unexpected error occurred', "error", 3000);
    });

    simulateLoading();
});