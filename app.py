import os
import warnings
import logging
import json
import re
from functools import lru_cache
from datetime import datetime

from flask import Flask, request, jsonify, send_from_directory
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_cors import CORS
from marshmallow import Schema, fields, ValidationError
import requests
from user_agents import parse
from colorama import init, Fore, Style
from dotenv import load_dotenv

init(autoreset=True)
load_dotenv()

warnings.filterwarnings("ignore", message="Using the in-memory storage for tracking rate limits")
warnings.filterwarnings("ignore", category=UserWarning)

class CustomFormatter(logging.Formatter):
    FORMAT = "%(asctime)s | %(levelname)s | %(message)s"
    
    COLORS = {
        logging.DEBUG: Fore.CYAN,
        logging.INFO: Fore.GREEN,
        logging.WARNING: Fore.YELLOW,
        logging.ERROR: Fore.RED,
        logging.CRITICAL: Fore.RED + Style.BRIGHT
    }

    def format(self, record):
        color = self.COLORS.get(record.levelno, '')
        formatter = logging.Formatter(color + self.FORMAT + Style.RESET_ALL, 
                                   datefmt='%Y-%m-%d %H:%M:%S')
        return formatter.format(record)

def setup_logging():
    handler = logging.StreamHandler()
    handler.setFormatter(CustomFormatter())
    logger = logging.getLogger(__name__)
    logger.setLevel(logging.INFO)
    logger.addHandler(handler)
    return logger

logger = setup_logging()

app = Flask(__name__, static_folder='frontend', static_url_path='')
CORS(app)
limiter = Limiter(app=app, key_func=get_remote_address)

class APIConfig:
    @staticmethod
    def get_config(model, user_message, settings):
        base_configs = {
            'gpt4': {
                'url': "https://chatgpt-vision1.p.rapidapi.com/gpt4",
                'payload': {
                    "messages": [{"role": "user", "content": user_message}],
                    "web_access": settings.get('webAccess', False)
                },
                'host': "chatgpt-vision1.p.rapidapi.com"
            },
            'claude3': {
                'url': "https://claude-3-5-sonnet.p.rapidapi.com/",
                'payload': {
                    "model": "claude-3-5-sonnet",
                    "messages": [{"role": "user", "content": user_message}]
                },
                'host': "claude-3-5-sonnet.p.rapidapi.com"
            },
            'dalle': {
                'url': "https://chatgpt-vision1.p.rapidapi.com/texttoimageplus",
                'payload': {
                    "text": user_message,
                    "width": int(settings.get('width', 1024)),
                    "height": int(settings.get('height', 1024))
                },
                'host': "chatgpt-vision1.p.rapidapi.com"
            },
            'vision': {
                'url': "https://chatgpt-vision1.p.rapidapi.com/matagvision2",
                'payload': {
                    "messages": [{
                        "role": "user",
                        "content": [{"type": "text", "text": user_message}]
                    }],
                    "web_access": settings.get('webAccess', False)
                },
                'host': "chatgpt-vision1.p.rapidapi.com"
            },
            'ai_gf': {
                'url': "https://open-ai21.p.rapidapi.com/chatbotapi",
                'payload': {
                    "bot_id": "t0Lc3tlS8ppiLxz9EmpBkFXVeCnx2X23vxL171099103621V927EIwsX0KsFBlQrjTC8k4ArZdvjnSDuMP",
                    "messages": [{"role": "user", "content": user_message}],
                    "user_id": "",
                    "temperature": 1,
                    "top_k": 100,
                    "top_p": 1,
                    "max_tokens": 512,
                    "model": "gpt 3.5"
                },
                'host': "open-ai21.p.rapidapi.com"
            }
        }
        return base_configs.get(model)

class MessageSchema(Schema):
    message = fields.String(required=True, validate=lambda x: len(x) > 0)
    model = fields.String(required=True, validate=lambda x: x in ['gpt4', 'claude3', 'dalle', 'vision', 'ai_gf'])
    settings = fields.Dict(required=True)

class Utils:
    @staticmethod
    def get_user_ip():
        return request.headers.getlist("X-Forwarded-For")[0] if request.headers.getlist("X-Forwarded-For") else request.remote_addr

    @staticmethod
    @lru_cache(maxsize=1000)
    def get_device_info(ip, user_agent_string):
        try:
            ip_response = requests.get(f"http://ip-api.com/json/{ip}", timeout=5)
            ip_response.raise_for_status()
            ip_info = ip_response.json()
            
            user_agent = parse(user_agent_string)
            
            return {
                "IP Info": ip_info,
                "Device Type": "Mobile" if user_agent.is_mobile else ("Tablet" if user_agent.is_tablet else "Desktop"),
                "Browser": f"{user_agent.browser.family} {user_agent.browser.version_string}",
                "Operating System": f"{user_agent.os.family} {user_agent.os.version_string}",
                "Device": user_agent.device.family,
                "Is Bot": user_agent.is_bot,
                "User Agent": user_agent_string
            }
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to get device information: {e}")
            return {"error": "Failed to get device information"}

    @staticmethod
    def format_response(text):
        """Format response text with proper code blocks, inline code, and other formatting"""
        
        replacements = [
            (r"\n\n", "<br><br>"),  # Replace double newlines with <br><br>
            (r'\*\*(.*?)\*\*', r'<strong>\1</strong>'),  # Bold text: **bold**
            (r'\*(.*?)\*', r'<em>\1</em>'),  # Italic text: *italic*
            # Multiline code blocks ```code```
            (r'```(?:\w+\n)?([\s\S]*?)```', r'<pre><code>\1</code></pre>'),
            (r'`([^`]+)`', r'<code>\1</code>'),  # Inline code blocks `code`
            # LaTeX inline math \( ... \)
            (r'\\\((.*?)\\\)', r'\\(\1\\)'),  # Handles inline LaTeX
            # LaTeX block math \[ ... \]
            (r'\\\[(.*?)\\\]', r'\\[\1\\]'),  # Handles block LaTeX
            # Headers (### Header)
            (r'###\s(.*?)(<br>|$)', r'<h3>\1</h3><br>'),
            # Numbered lists (1. List item)
            (r'(\d+)\.\s', r'<br>\1. ')  # Ensures numbered lists are spaced
        ]
        
        formatted_text = text
        for pattern, replacement in replacements:
            formatted_text = re.sub(pattern, replacement, formatted_text)

        # Replace MathJax errors with a styled error message
        return formatted_text.replace("Math input error", "<span class='math-error'>Math input error</span>")

@app.route('/')
def serve_frontend():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    if os.path.exists(os.path.join(app.static_folder, path)):
        if "script.js" not in path and "style.css" not in path:
            logger.info(f"Serving static file: {path}")
        return send_from_directory(app.static_folder, path)
    logger.warning(f"File not found: {path}")
    return "File not found", 404

@app.route('/api/get_rapidapi_key', methods=['GET'])
def get_rapidapi_key():
    api_key = os.getenv("RAPIDAPI_KEY")
    if not api_key:
        return jsonify({"error": "RapidAPI key not configured"}), 500
    return jsonify({"key": api_key})

@app.route('/api/send_text', methods=['POST'])
@limiter.limit("5 per minute")
def send_text():
    try:
        data = MessageSchema().load(request.json)
        user_message = data['message']
        selected_model = data['model']
        settings = data['settings']
        
        config = APIConfig.get_config(selected_model, user_message, settings)
        if not config:
            return jsonify({"error": "Invalid model selected"}), 400

        api_key = os.getenv("RAPIDAPI_KEY")
        if not api_key:
            return jsonify({"error": "API key not configured"}), 500

        headers = {
            "x-rapidapi-key": api_key,
            "x-rapidapi-host": config['host'],
            "Content-Type": "application/json"
        }

        logger.info(f"Sending request to {config['url']}")
        response = requests.post(
            config['url'],
            json=config['payload'],
            headers=headers,
            timeout=180
        )
        response.raise_for_status()
        response_data = response.json()

        ai_message = process_ai_response(response_data, selected_model)
        return jsonify({"message": ai_message}), 200

    except ValidationError as err:
        logger.error(f"Validation error: {err.messages}")
        return jsonify({"error": err.messages}), 400
    except requests.exceptions.RequestException as e:
        logger.error(f"API request failed: {e}")
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        return jsonify({"error": "An unexpected error occurred"}), 500

def process_ai_response(response_data, selected_model):
    try:
        if selected_model == 'dalle':
            return response_data.get('generated_image', 'No image URL returned')
            
        if selected_model == 'vision':
            return Utils.format_response(response_data.get('result', 'No result returned'))
            
        if selected_model in ['claude3', 'gpt4', 'ai_gf']:
            if 'result' in response_data:
                return Utils.format_response(response_data['result'])
            if 'choices' in response_data:
                return Utils.format_response(response_data['choices'][0]['message']['content'])
            
        logger.error(f"Unexpected response structure for {selected_model}: {response_data}")
        return f"Error: Unexpected response structure for {selected_model}"
        
    except KeyError as e:
        logger.error(f"Missing key in response: {e}")
        return f"Error: Missing key in response: {e}"

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    logger.info(f"Starting server on port {port}...")
    app.run(host='0.0.0.0', port=port, debug=True)
