import os
import warnings
import logging
import json
import re
from functools import lru_cache, wraps
from datetime import datetime
from typing import Dict, Any, Optional, Union
from concurrent.futures import ThreadPoolExecutor
import asyncio
from collections import defaultdict
import time

from flask import Flask, request, jsonify, send_from_directory, Response
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_cors import CORS
from marshmallow import Schema, fields, ValidationError
import requests
from requests.adapters import HTTPAdapter, Retry
from user_agents import parse
from colorama import init, Fore, Style
from dotenv import load_dotenv
import cachetools
import prometheus_client
from prometheus_client import Counter, Histogram

# Initialize colorama and load environment variables
init(autoreset=True)
load_dotenv()

# Configure request session with retries and connection pooling
session = requests.Session()
retries = Retry(total=2, backoff_factor=0.1, status_forcelist=[500, 502, 503, 504])
session.mount('https://', HTTPAdapter(max_retries=retries, 
                                    pool_connections=200,  # Increased from 100
                                    pool_maxsize=200))     # Increased from 100

# Suppress specific warnings
warnings.filterwarnings("ignore", message="Using the in-memory storage for tracking rate limits")
warnings.filterwarnings("ignore", category=UserWarning)

# Prometheus metrics
REQUEST_COUNT = Counter('api_requests_total', 'Total API requests', ['endpoint', 'method', 'status'])
REQUEST_LATENCY = Histogram('api_request_latency_seconds', 'API request latency', ['endpoint'])

# Optimize caches with larger sizes and shorter TTL
response_cache = cachetools.TTLCache(maxsize=2000, ttl=180)  # 3 minutes TTL, increased size
conversation_cache = cachetools.TTLCache(maxsize=2000, ttl=1800)  # 30 minutes TTL, increased size

# Optimize cache decorator
def cache_response(func):
    @wraps(func)
    async def wrapper(*args, **kwargs):
        cache_key = f"{request.path}:{request.data.decode('utf-8')}"
        if cache_key in response_cache:
            return response_cache[cache_key]
        result = await func(*args, **kwargs)
        response_cache[cache_key] = result
        return result
    return wrapper

# Conversation history cache with 1-hour TTL
MAX_HISTORY_LENGTH = 10  # Maximum number of messages to keep in history

class CustomFormatter(logging.Formatter):
    FORMAT = "%(asctime)s | %(levelname)s | [%(thread)d] %(message)s"
    
    COLORS = {
        logging.DEBUG: Fore.CYAN,
        logging.INFO: Fore.GREEN,
        logging.WARNING: Fore.YELLOW,
        logging.ERROR: Fore.RED,
        logging.CRITICAL: Fore.RED + Style.BRIGHT
    }

    def format(self, record: logging.LogRecord) -> str:
        color = self.COLORS.get(record.levelno, '')
        formatter = logging.Formatter(color + self.FORMAT + Style.RESET_ALL, 
                                   datefmt='%Y-%m-%d %H:%M:%S')
        return formatter.format(record)

def setup_logging() -> logging.Logger:
    handler = logging.StreamHandler()
    handler.setFormatter(CustomFormatter())
    logger = logging.getLogger(__name__)
    logger.setLevel(logging.INFO)
    logger.addHandler(handler)
    return logger

logger = setup_logging()

# Initialize Flask with async support
app = Flask(__name__, static_folder='frontend', static_url_path='')
CORS(app)
limiter = Limiter(app=app, key_func=get_remote_address)

# Thread pool for concurrent operations
thread_pool = ThreadPoolExecutor(max_workers=8)  # Increased from 4 to 8

@app.route('/reset_conversation', methods=['POST'])
def reset_conversation():
    try:
        ip = Utils.get_user_ip()
        deleted_messages = []
        if ip in conversation_cache:
            deleted_messages = conversation_cache[ip]
            del conversation_cache[ip]
            logger.info(f"Reset conversation for IP {ip}. Deleted {len(deleted_messages)} messages")
        else:
            logger.info(f"No conversation found to reset for IP {ip}")
        return jsonify({"message": "Conversation reset successfully"}), 200
    except Exception as e:
        logger.error(f"Failed to reset conversation for IP {ip}: {str(e)}")
        return jsonify({"error": "Failed to reset conversation"}), 500

class APIConfig:
    @staticmethod
    def get_config(model: str, user_message: str, settings: Dict[str, Any], conversation_id: str = None) -> Optional[Dict[str, Any]]:
        # Get conversation history
        history = []
        if conversation_id and conversation_id in conversation_cache:
            history = conversation_cache[conversation_id]

        base_configs = {
            'gpt4': {
                'url': "https://chatgpt-vision1.p.rapidapi.com/gpt4",
                'payload': {
                    "messages": history + [{"role": "user", "content": user_message}],
                    "web_access": settings.get('webAccess', False)
                },
                'host': "chatgpt-vision1.p.rapidapi.com"
            },
            'claude3': {
                'url': "https://claude-3-5-sonnet.p.rapidapi.com/",
                'payload': {
                    "model": "claude-3-5-sonnet",
                    "messages": history + [{"role": "user", "content": user_message}]
                },
                'host': "claude-3-5-sonnet.p.rapidapi.com"
            },
            'dalle': {
                'url': "https://chatgpt-vision1.p.rapidapi.com/texttoimage3",
                'payload': {
                    "text": user_message,
                    "negative_prompt": settings.get('negative_prompt', ''),
                    "width": int(settings.get('width', 512)),
                    "height": int(settings.get('height', 512))
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
    message = fields.String(required=True, validate=lambda x: len(x.strip()) > 0)
    model = fields.String(required=True, validate=lambda x: x in ['gpt4', 'claude3', 'dalle', 'vision', 'ai_gf'])
    settings = fields.Dict(required=True)
    conversation_id = fields.String(required=False)  # Add this field

class Utils:
    @staticmethod
    def get_user_ip() -> str:
        return request.headers.getlist("X-Forwarded-For")[0] if request.headers.getlist("X-Forwarded-For") else request.remote_addr

    @staticmethod
    def get_device_info(ip: str, user_agent_string: str) -> Dict[str, Any]:
        try:
            ip_info_future = thread_pool.submit(
                lambda: session.get(f"http://ip-api.com/json/{ip}", timeout=5).json()
            )
            
            user_agent = parse(user_agent_string)
            
            return {
                "IP Info": ip_info_future.result(),
                "Device Type": "Mobile" if user_agent.is_mobile else ("Tablet" if user_agent.is_tablet else "Desktop"),
                "Browser": f"{user_agent.browser.family} {user_agent.browser.version_string}",
                "Operating System": f"{user_agent.os.family} {user_agent.os.version_string}",
                "Device": user_agent.device.family,
                "Is Bot": user_agent.is_bot,
                "User Agent": user_agent_string
            }
        except Exception as e:
            logger.error(f"Failed to get device information: {e}")
            return {"error": "Failed to get device information"}

    @staticmethod
    def format_response(text: str) -> str:
        """Format response text with proper code blocks, inline code, and other formatting"""
        if not isinstance(text, str):
            logger.error(f'Expected string in format_response, got: {type(text)}')
            return str(text)

        replacements = [
            (r"\n\n", "<br><br>"),
            (r'\*\*(.*?)\*\*', r'<strong>\1</strong>'),
            (r'\*(.*?)\*', r'<em>\1</em>'),
            (r'```(?:\w+\n)?([\s\S]*?)```', r'<pre><code>\1</code></pre>'),
            (r'\\\((.*?)\\\)', r'\\(\1\\)'),
            (r'\\\[(.*?)\\\]', r'\\[\1\\]'),
            (r'###\s*(.*?)(<br>|$)', r'<h3>\1</h3>'),
            (r'(\d+)\.\s', r'<br>\1. ')
        ]
        
        try:
            formatted_text = text
            for pattern, replacement in replacements:
                formatted_text = re.sub(pattern, replacement, formatted_text)
            return formatted_text.replace("Math input error", "<span class='math-error'>Math input error</span>")
        except Exception as e:
            logger.error(f'Error formatting response: {str(e)}')
            return text

@app.route('/')
def serve_frontend() -> Response:
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def serve_static(path: str) -> Union[Response, tuple]:
    if os.path.exists(os.path.join(app.static_folder, path)):
        if "script.js" not in path and "style.css" not in path:
            logger.info(f"Serving static file: {path}")
        return send_from_directory(app.static_folder, path)
    logger.warning(f"File not found: {path}")
    return "File not found", 404

@app.route('/api/get_rapidapi_key', methods=['GET'])
@cache_response
def get_rapidapi_key() -> tuple:
    api_key = os.getenv("RAPIDAPI_KEY")
    if not api_key:
        return jsonify({"error": "RapidAPI key not configured"}), 500
    return jsonify({"key": api_key})

@app.route('/api/send_text', methods=['POST'])
@limiter.limit("10 per minute")
async def send_text() -> tuple:
    try:
        with REQUEST_LATENCY.labels('/api/send_text').time():
            ip = Utils.get_user_ip()
            logger.info(f"Received request from IP: {ip}")
            
            data = MessageSchema().load(request.json)
            user_message = data['message']
            selected_model = data['model']
            settings = data['settings']
            conversation_id = data.get('conversation_id', Utils.get_user_ip())  # Use IP as fallback
            
            # Get or initialize conversation history
            if conversation_id not in conversation_cache:
                conversation_cache[conversation_id] = []
            
            config = APIConfig.get_config(selected_model, user_message, settings, conversation_id)
            if not config:
                REQUEST_COUNT.labels('/api/send_text', 'POST', 400).inc()
                return jsonify({"error": "Invalid model selected"}), 400

            api_key = os.getenv("API_KEY")
            if not api_key:
                REQUEST_COUNT.labels('/api/send_text', 'POST', 500).inc()
                return jsonify({"error": "API key not configured"}), 500

            headers = {
                "x-rapidapi-key": api_key,
                "x-rapidapi-host": config['host'],
                "Content-Type": "application/json"
            }

            start_time = datetime.now()
            
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                thread_pool,
                lambda: session.post(
                    config['url'],
                    json=config['payload'],
                    headers=headers,
                    timeout=180
                )
            )
            
            end_time = datetime.now()
            logger.info(f"Response time: {(end_time - start_time).total_seconds()} seconds")
            
            response.raise_for_status()
            response_data = response.json()
            
            ai_message = await loop.run_in_executor(
                thread_pool,
                process_ai_response,
                response_data,
                selected_model
            )
            
            # Update conversation history
            conversation_cache[conversation_id].append({"role": "user", "content": user_message})
            conversation_cache[conversation_id].append({"role": "assistant", "content": ai_message})
            
            # Trim history if it exceeds maximum length
            if len(conversation_cache[conversation_id]) > MAX_HISTORY_LENGTH * 2:  # *2 because we store pairs of messages
                conversation_cache[conversation_id] = conversation_cache[conversation_id][-MAX_HISTORY_LENGTH * 2:]
            
            REQUEST_COUNT.labels('/api/send_text', 'POST', 200).inc()
            return jsonify({
                "message": ai_message,
                "conversation_id": conversation_id
            }), 200

    except ValidationError as err:
        REQUEST_COUNT.labels('/api/send_text', 'POST', 400).inc()
        return jsonify({"error": err.messages}), 400
    except requests.exceptions.RequestException as e:
        REQUEST_COUNT.labels('/api/send_text', 'POST', 500).inc()
        logger.error(f"Request error: {str(e)}")
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        REQUEST_COUNT.labels('/api/send_text', 'POST', 500).inc()
        logger.error(f"Unexpected error: {str(e)}")
        return jsonify({"error": "An unexpected error occurred"}), 500

def process_ai_response(response_data: Dict[str, Any], selected_model: str) -> str:
    try:
        logger.info(f"Processing response for model: {selected_model}")
        logger.debug(f"Raw response data: {response_data}")
        
        if selected_model == 'dalle':
            result = response_data.get('generated_image', 'No image URL returned')
            logger.info(f"DALL-E generated image URL: {result}")
            return result
            
        if selected_model == 'vision':
            result = Utils.format_response(response_data.get('result', 'No result returned'))
            logger.info(f"Vision model response: {result[:500]}...")
            return result
            
        if selected_model in ['claude3', 'gpt4', 'ai_gf']:
            if 'result' in response_data:
                result = Utils.format_response(response_data['result'])
                logger.info(f"Model response from 'result': {result[:500]}...")
                return result
            if 'choices' in response_data and response_data['choices']:
                result = Utils.format_response(response_data['choices'][0]['message']['content'])
                logger.info(f"Model response from 'choices': {result[:500]}...")
                return result
            
        logger.error(f"Unexpected response structure for {selected_model}: {response_data}")
        return f"Error: Unexpected response structure for {selected_model}"
        
    except KeyError as e:
        logger.error(f"Missing key in response: {e}")
        return f"Error: Missing key in response: {e}"
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        return f"Error: {str(e)}"

async def stream_response(response_data: Dict[str, Any], selected_model: str):
    try:
        if selected_model in ['claude3', 'gpt4']:
            for chunk in response_data.get('chunks', []):
                yield f"data: {json.dumps({'chunk': chunk})}\n\n"
        else:
            yield f"data: {json.dumps({'message': response_data.get('result', '')})}\n\n"
    except Exception as e:
        logger.error(f"Streaming error: {str(e)}")
        yield f"data: {json.dumps({'error': str(e)})}\n\n"

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    logger.info(f"Starting server on port {port}...")
    app.run(host='0.0.0.0', port=port, debug=True)