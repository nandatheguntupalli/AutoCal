from flask import Flask, request, Response
import requests
import os
from dotenv import load_dotenv
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

load_dotenv()
CHATGPT_API_KEY = os.getenv("CHATGPT_API_KEY")

if not CHATGPT_API_KEY:
    raise ValueError("ChatGPT API Key Not Found")

@app.route('/autocal/chatgpt', methods=["POST", "OPTIONS"])
def proxy():
    if request.method == 'OPTIONS':
        return '', 204
    
    try:
        incoming = request.get_json()

        headers = {
            "Authorization": f"Bearer {CHATGPT_API_KEY}",
            "Content-Type": "application/json"
        }

        response = requests.post(
            url = "https://api.openai.com/v1/chat/completions", 
            json=incoming,
            headers=headers
        )

        return Response(
            response.content,
            status=response.status_code,
            content_type=response.headers.get("Content-Type", "application/json")
        )

    except requests.exceptions.RequestException as e:
        return f"An error occurred: {e}", 500
