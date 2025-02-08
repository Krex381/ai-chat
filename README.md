# UncensoredAI Chat Application

A sophisticated chat application that leverages multiple AI models through RapidAPI to provide various AI capabilities including text generation, image generation, and vision analysis.

## 🌟 Features

- Multiple AI Model Support:
  - GPT-4
  - Claude 3 Sonnet
  - DALL-E Image Generation
  - ChatGPT Vision
  - AI Girlfriend (Uncensored)
- Real-time message streaming
- Code syntax highlighting
- LaTeX math rendering
- Responsive design
- Message history
- Customizable settings per model
- Copy message functionality
- Loading animations
- Error handling with retries
- Rate limiting
- Caching system

## 🚀 Getting Started

### Prerequisites

- Python 3.8+
- Node.js (for development)
- RapidAPI Key

### Getting Your RapidAPI Key

1. Visit [RapidAPI](https://rapidapi.com/)
2. Create an account or sign in
3. Subscribe to the following APIs:
   - [ChatGPT Vision API](https://rapidapi.com/rphrp1985/api/chatgpt-vision1) for GPT-4, DALL-E, and Vision
   - [Claude-3 Sonnet API](https://rapidapi.com/swift-api-swift-api-default/api/claude-3-5-sonnet) for Claude
   - [OpenAI21 API](https://rapidapi.com/rphrp1985/api/custom-chatbot-api) for AI Girlfriend

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/ai-chat.git
cd ai-chat
```

2. Create and activate a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Create a `.env` file in the project root:
```env
API_KEY=your_rapidapi_key_here
PORT=8080  # Optional, defaults to 8080
```

5. Start the server:
```bash
python app.py
```

6. Open your browser and visit `http://localhost:8080`

## 💻 Development

### Project Structure

```
ai-chat/
├── frontend/
│   ├── index.html
│   ├── style.css
│   ├── script.js
│   └── assets/
├── app.py
├── requirements.txt
└── .env
```

### API Endpoints

- `GET /` - Serves the frontend
- `POST /api/send_text` - Handles AI model interactions
- `POST /reset_conversation` - Resets the conversation history
- `GET /api/get_rapidapi_key` - Retrieves the API key (cached)

### Environment Variables

- `API_KEY` (Required) - Your RapidAPI key
- `PORT` (Optional) - Server port (default: 8080)

## 🛡️ Security Features

- Rate limiting
- Input validation
- Error handling
- XSS protection
- CORS configuration
- Request timeout handling
- Connection pooling
- Cache management

## 🔧 Advanced Configuration

### Model Settings

#### GPT-4
- Web access toggle
- Conversation history support
- Streaming responses

#### DALL-E
- Image dimensions (256-1024)
- Negative prompts
- Quality settings

#### Vision
- Web access toggle
- Multi-modal input support

### Performance Optimization

- Response caching (TTL: 3 minutes)
- Conversation caching (TTL: 30 minutes)
- Connection pooling (200 connections)
- Thread pool (8 workers)
- Request retries (2 attempts)

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⚠️ Disclaimer

Users are responsible for their interactions with the AI models. The platform creators are not liable for any misuse or inappropriate content generation. Please use responsibly and professionally.

## 🙏 Acknowledgments

- RapidAPI for providing API access
- OpenAI for the underlying models
- Anthropic for Claude
- Contributors and feedback providers

## 📞 Support

For support, please open an issue in the GitHub repository or contact the development team.

---
Made with ❤️ by Krex
