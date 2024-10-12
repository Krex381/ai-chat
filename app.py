import os
from flask import Flask, request, jsonify, send_from_directory
import requests
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from datetime import datetime
from dotenv import load_dotenv
from marshmallow import Schema, fields, ValidationError
from telegram import Bot
from flask_cors import CORS

# Load environment variables
load_dotenv()

app = Flask(__name__, static_folder='frontend', static_url_path='')
CORS(app)
limiter = Limiter(key_func=get_remote_address, app=app)

# Telegram bot setup
telegram_token = os.getenv("TELEGRAM_TOKEN")
telegram_chat_id = os.getenv("TELEGRAM_CHAT_ID")
bot = Bot(token=telegram_token)

class MessageSchema(Schema):
    message = fields.String(required=True, validate=lambda x: len(x) > 0)
    model = fields.String(required=True, validate=lambda x: x in ['gpt4', 'claude3'])

@app.route('/')
def serve_frontend():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/api/send_text', methods=['POST'])
@limiter.limit("5 per minute")
def send_text():
    schema = MessageSchema()
    try:
        data = schema.load(request.json)
    except ValidationError as err:
        return jsonify({"error": err.messages}), 400

    user_message = data['message']
    selected_model = data['model']
    user_ip = request.remote_addr
    current_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    api_key = os.getenv("GPT_API_KEY")
    api_key_claude = os.getenv("CLAUDE_API_KEY")

    if not api_key or not api_key_claude:
        return jsonify({"error": "API keys not configured"}), 500

    if selected_model == 'gpt4':
        url = "https://cheapest-gpt-4-turbo-gpt-4-vision-chatgpt-openai-ai-api.p.rapidapi.com/v1/chat/completions"
        payload = {
            "messages": [{"role": "user", "content": user_message}],
            "model": "gpt-4o",
            "max_tokens": 400,
            "temperature": 1
        }
        headers = {
            "x-rapidapi-key": api_key,
            "x-rapidapi-host": "cheapest-gpt-4-turbo-gpt-4-vision-chatgpt-openai-ai-api.p.rapidapi.com",
            "Content-Type": "application/json"
        }
    else:  # selected_model == 'claude3'
        url = "https://claude-3-haiku-ai.p.rapidapi.com/"
        payload = {
            "model": "claude-3-haiku-20240307",
            "messages": [{"role": "user", "content": user_message}]
        }
        headers = {
            "x-rapidapi-key": api_key_claude,
            "x-rapidapi-host": "claude-3-haiku-ai.p.rapidapi.com",
            "Content-Type": "application/json"
        }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=10)
        response.raise_for_status()
        response_data = response.json()

        ai_message = response_data['choices'][0]['message']['content']

        telegram_message = (
            f"Time: {current_time}\n"
            f"User Message:\n{user_message}\n"
            f"IP: {user_ip}\n\n"
            f"AI Response:\n{ai_message}\n\n"
            f"Full API Response:\n{response_data}\n"
            f"__________________________"
        )
        bot.send_message(chat_id=telegram_chat_id, text=telegram_message)

        return jsonify(response_data), 200

    except requests.exceptions.RequestException as e:
        return jsonify({"error": "Failed to communicate with the API"}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 8080)))
