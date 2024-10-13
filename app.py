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
from user_agents import parse
import logging

# Load environment variables
load_dotenv()

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__, static_folder='frontend', static_url_path='')
CORS(app)
limiter = Limiter(key_func=get_remote_address, app=app)

# Telegram bot setup
telegram_token = os.getenv("TELEGRAM_TOKEN")
telegram_chat_id = os.getenv("TELEGRAM_CHAT_ID")
bot = Bot(token=telegram_token)

class MessageSchema(Schema):
    message = fields.String(required=True, validate=lambda x: len(x) > 0)
    model = fields.String(required=True, validate=lambda x: x in ['gpt4', 'claude3', 'dalle'])

def get_user_ip():
    if request.headers.getlist("X-Forwarded-For"):
        ip = request.headers.getlist("X-Forwarded-For")[0]
    else:
        ip = request.remote_addr
    return ip

def get_device_info(ip, user_agent_string):
    try:
        # Get IP-based information
        ip_response = requests.get(f"http://ip-api.com/json/{ip}")
        ip_response.raise_for_status()
        ip_info = ip_response.json()

        # Parse User-Agent string
        user_agent = parse(user_agent_string)

        device_info = {
            "IP Info": ip_info,
            "Device Type": "Mobile" if user_agent.is_mobile else ("Tablet" if user_agent.is_tablet else "Desktop"),
            "Browser": f"{user_agent.browser.family} {user_agent.browser.version_string}",
            "Operating System": f"{user_agent.os.family} {user_agent.os.version_string}",
            "Device": user_agent.device.family,
            "Is Bot": user_agent.is_bot,
            "User Agent": user_agent_string
        }

        return device_info
    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to get device information: {e}")
        return {"error": "Failed to get device information"}

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
    user_ip = get_user_ip()
    user_agent = request.headers.get('User-Agent')
    current_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    api_key = os.getenv("GPT_API_KEY")
    api_key_claude = os.getenv("CLAUDE_API_KEY")
    api_key_dalle = os.getenv("DALLE_API_KEY")

    if not api_key or not api_key_claude or not api_key_dalle:
        return jsonify({"error": "API keys not configured"}), 500

    url = None
    payload = None
    headers = None

    if selected_model == 'gpt4':
        url = "https://chatgpt-42.p.rapidapi.com/gpt4"
        payload = {
            "messages": [{"role": "assistant", "content": user_message}],
            "web_access": True
        }
        headers = {
            "x-rapidapi-key": api_key,
            "x-rapidapi-host": "chatgpt-42.p.rapidapi.com",
            "Content-Type": "application/json"
        }
    elif selected_model == 'claude3':
        url = "https://claude-3-haiku-ai.p.rapidapi.com/"
        payload = {
            "model": "claude-3-haiku-20240307",
            "messages": [{"role": "assistant", "content": user_message}]
        }
        headers = {
            "x-rapidapi-key": api_key_claude,
            "x-rapidapi-host": "claude-3-haiku-ai.p.rapidapi.com",
            "Content-Type": "application/json"
        }
    else:  # selected_model == 'dalle'
        url = "https://chatgpt-42.p.rapidapi.com/texttoimage"
        payload = {
            "text": user_message,
            "width": 1024,
            "height": 1024
        }
        headers = {
            "x-rapidapi-key": api_key_dalle,
            "x-rapidapi-host": "chatgpt-42.p.rapidapi.com",
            "Content-Type": "application/json"
        }

    try:
        logger.info(f"Sending request to {url} with payload: {payload}")
        response = requests.post(url, json=payload, headers=headers, timeout=180)
        response.raise_for_status()
        response_data = response.json()
        logger.info(f"Received response: {response_data}")

        if selected_model == 'dalle':
            ai_message = response_data.get('generated_image', 'No image URL returned')
        elif selected_model == 'gpt4':
            ai_message = response_data.get('result', 'No result returned')
        else:
            ai_message = response_data['choices'][0]['message']['content']

        device_info = get_device_info(user_ip, user_agent)

        telegram_message = (
            f"Time: {current_time}\n"
            f"User Message:\n```txt\n{user_message}\n```\n"
            f"Device Information:\n```yml\n"
            f"IP: {device_info['IP Info'].get('query', 'Unknown')}\n"
            f"Location: {device_info['IP Info'].get('city', 'Unknown')}, {device_info['IP Info'].get('country', 'Unknown')}\n"
            f"ISP: {device_info['IP Info'].get('isp', 'Unknown')}\n"
            f"Device Type: {device_info['Device Type']}\n"
            f"Browser: {device_info['Browser']}\n"
            f"Operating System: {device_info['Operating System']}\n"
            f"Device Model: {device_info['Device']}\n"
            f"Is Bot: {device_info['Is Bot']}\n"
            f"User Agent: {device_info['User Agent']}\n```\n\n"
            f"AI Response:\n```txt\n{ai_message}\n```\n\n"
            f"Full API Response:\n```json\n{response_data}\n```\n"
            f"__________________________"
        )
        bot.send_message(chat_id=telegram_chat_id, text=telegram_message, parse_mode='Markdown')

        return jsonify(response_data), 200

    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to communicate with the API: {e}")
        return jsonify({"error": "Failed to communicate with the API"}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 8080)))
